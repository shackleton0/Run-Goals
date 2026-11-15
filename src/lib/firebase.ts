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
  getDocs,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  collection,
  query,
  where,
  onSnapshot,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
export { firebaseConfig };
import { RunRecord, UserProfile } from '../types/running';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

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
export interface GetOrCreateProfileResult {
  profile: UserProfile;
  isNewAccount: boolean;
}

export async function getOrCreateUserProfile(user: User): Promise<GetOrCreateProfileResult> {
  const userDocRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      // Sanitize legacy placeholder 1260 if present
      if (data.target6kTimeSeconds === 1260 && !(data as any).hasCustomTarget) {
        delete data.target6kTimeSeconds;
      }
      return { profile: data, isNewAccount: false };
    }
    const now = new Date().toISOString();
    const defaultProfile: UserProfile = {
      id: user.uid,
      email: (user.email || '').slice(0, 256),
      displayName: (user.displayName || '').slice(0, 128),
      weeklyRunGoal: 3, // Default 3 runs/week
      unitPreference: 'km',
      onboardingCompleted: false,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(userDocRef, defaultProfile);
    return { profile: defaultProfile, isNewAccount: true };
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
  const sanitized: UserProfile = {
    ...profile,
    email: (profile.email || '').slice(0, 256),
    displayName: profile.displayName ? profile.displayName.slice(0, 128) : profile.displayName,
    targetGoalName: profile.targetGoalName ? profile.targetGoalName.slice(0, 128) : profile.targetGoalName,
    weeklyRunGoal: Math.min(14, Math.max(1, Math.round(profile.weeklyRunGoal || 3))),
    weeklyDistanceGoalKm:
      profile.weeklyDistanceGoalKm !== undefined
        ? Math.min(500, Math.max(0, profile.weeklyDistanceGoalKm))
        : undefined,
    targetDistanceKm:
      profile.targetDistanceKm !== undefined
        ? Math.min(100, Math.max(0.1, profile.targetDistanceKm))
        : undefined,
    goalTimeframeWeeks:
      profile.goalTimeframeWeeks !== undefined
        ? Math.min(104, Math.max(1, Math.round(profile.goalTimeframeWeeks)))
        : undefined,
  };
  const cleanProfile = cleanObjectForFirestore(sanitized);
  const path = `users/${profile.id}`;
  try {
    const userDocRef = doc(db, 'users', profile.id);
    const payload: Record<string, unknown> = {
      ...cleanProfile,
      updatedAt: new Date().toISOString(),
    };
    if (!profile.targetGoalDate || !profile.targetGoalDate.trim()) {
      payload.targetGoalDate = deleteField();
    }
    await setDoc(userDocRef, payload, { merge: true });
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

// ============================================================
// Admin Gate, Salted Passcode & Cross-User Data Explorer
// ============================================================

export const ADMIN_EMAIL = 'eskin.adam@gmail.com';

export function isAuthorizedAdmin(user: User | null): boolean {
  return Boolean(
    user &&
      user.email &&
      user.email.toLowerCase() === ADMIN_EMAIL &&
      user.emailVerified !== false
  );
}

export interface AdminConfigRecord {
  id: string;
  pinHash: string;
  pinSalt: string;
  pinLength?: number;
  createdAt?: string;
  updatedAt?: string;
}

function generateAdminSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashAdminPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getAdminConfig(user: User): Promise<AdminConfigRecord | null> {
  if (!isAuthorizedAdmin(user)) {
    throw new Error('Unauthorized admin access attempt.');
  }
  const path = `adminConfig/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'adminConfig', user.uid));
    if (!snap.exists()) return null;
    return snap.data() as AdminConfigRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveAdminPasscode(user: User, pin: string): Promise<AdminConfigRecord> {
  if (!isAuthorizedAdmin(user)) {
    throw new Error('Unauthorized admin access attempt.');
  }
  const cleanedPin = pin.replace(/\D/g, '');
  if (cleanedPin.length < 4 || cleanedPin.length > 8) {
    throw new Error('Passcode must be 4 to 8 digits.');
  }

  const path = `adminConfig/${user.uid}`;
  const docRef = doc(db, 'adminConfig', user.uid);
  const existing = await getAdminConfig(user);
  const now = new Date().toISOString();
  const salt = generateAdminSalt();
  const pinHash = await hashAdminPin(cleanedPin, salt);

  const payload: AdminConfigRecord = {
    id: user.uid,
    pinHash,
    pinSalt: salt,
    pinLength: cleanedPin.length,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  try {
    await setDoc(docRef, payload);
    return payload;
  } catch (error) {
    handleFirestoreError(error, existing ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function verifyAdminPasscode(
  pin: string,
  config: AdminConfigRecord
): Promise<boolean> {
  const cleanedPin = pin.replace(/\D/g, '');
  if (!cleanedPin || !config?.pinHash || !config?.pinSalt) return false;
  const computed = await hashAdminPin(cleanedPin, config.pinSalt);
  return computed === config.pinHash;
}

export async function fetchAllAdminData(): Promise<{
  users: UserProfile[];
  runs: RunRecord[];
}> {
  let users: UserProfile[] = [];
  let runs: RunRecord[] = [];

  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    users = usersSnap.docs.map((d) => d.data() as UserProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
  }

  try {
    const runsSnap = await getDocs(collection(db, 'runs'));
    runs = runsSnap.docs.map((d) => d.data() as RunRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'runs');
  }

  return { users, runs };
}
