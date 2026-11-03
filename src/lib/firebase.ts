import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { RunRecord, UserProfile } from '../types/running';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on startup per Firebase guidelines
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is currently offline or unreachable.');
    }
  }
}
testConnection();

// Auth helper
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google', error);
    throw error;
  }
}

export async function signInAnonymousUser() {
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error) {
    console.error('Error signing in anonymously', error);
    throw error;
  }
}

export async function logOut() {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out', error);
    throw error;
  }
}

// Profile management
export async function getOrCreateUserProfile(user: User): Promise<UserProfile> {
  const userDocRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      // Sanitize legacy placeholder 1260 if present
      if (data.target6kTimeSeconds === 1260 && !(data as any).hasCustomTarget) {
        delete data.target6kTimeSeconds;
      }
      return data;
    }
    const defaultProfile: UserProfile = {
      id: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      weeklyRunGoal: 3, // Default 3 runs/week
      unitPreference: 'km',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(userDocRef, defaultProfile);
    return defaultProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
  }
}

// Helper to sanitize document IDs for Firestore compliance
export function sanitizeDocId(id: string): string {
  if (!id) return `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  return id.replace(/[^a-zA-Z0-9_\-\.:]/g, '_').substring(0, 120) || `run_${Date.now()}`;
}

// Helper to remove undefined and NaN fields which Firestore rejects, and deep-clean nested objects
export function cleanObjectForFirestore<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (typeof value === 'number' && isNaN(value)) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      const nested = cleanObjectForFirestore(value);
      if (Object.keys(nested).length > 0) {
        result[key] = nested;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const cleanProfile = cleanObjectForFirestore(profile);
  const path = `users/${profile.id}`;
  try {
    const userDocRef = doc(db, 'users', profile.id);
    await setDoc(userDocRef, { ...cleanProfile, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Runs management
export function subscribeUserRuns(
  userId: string,
  onRuns: (runs: RunRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'runs';
  const q = query(collection(db, path), where('userId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const runs: RunRecord[] = [];
      snapshot.forEach((docSnap) => {
        runs.push(docSnap.data() as RunRecord);
      });
      // Sort newest date first
      runs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      onRuns(runs);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function saveRunRecord(run: RunRecord): Promise<void> {
  const safeId = sanitizeDocId(run.id);
  const currentUid = auth.currentUser?.uid;
  const cleanRun = cleanObjectForFirestore({
    ...run,
    id: safeId,
    userId: currentUid || run.userId,
  });
  const path = `runs/${safeId}`;
  try {
    const docRef = doc(db, 'runs', safeId);
    await setDoc(docRef, { ...cleanRun, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteRunRecord(runId: string): Promise<void> {
  const safeId = sanitizeDocId(runId);
  const path = `runs/${safeId}`;
  try {
    const docRef = doc(db, 'runs', safeId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function batchSaveRuns(runs: RunRecord[]): Promise<void> {
  if (runs.length === 0) return;
  const currentUid = auth.currentUser?.uid;
  // Firestore batches support up to 500 writes
  const chunkSize = 400;
  for (let i = 0; i < runs.length; i += chunkSize) {
    const chunk = runs.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach((r) => {
      const safeId = sanitizeDocId(r.id);
      const cleanRun = cleanObjectForFirestore({
        ...r,
        id: safeId,
        userId: currentUid || r.userId,
      });
      const docRef = doc(db, 'runs', safeId);
      batch.set(docRef, { ...cleanRun, updatedAt: new Date().toISOString() }, { merge: true });
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'runs (batch)');
    }
  }
}
