import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut as firebaseSignOut,
  deleteUser,
  reauthenticateWithPopup,
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
import {
  RunRecord,
  UserProfile,
  AppAnnouncement,
  AdminAuditLog,
  AdminAuditAction,
} from '../types/running';

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

async function reauthenticateForDeletion(user: User) {
  const reauthProvider = new GoogleAuthProvider();
  if (user.email) {
    reauthProvider.setCustomParameters({ login_hint: user.email });
  }
  await reauthenticateWithPopup(user, reauthProvider);
}

export async function deleteCurrentUserAccount(user: User): Promise<void> {
  // Reauthenticate proactively if session is older than 4 minutes so Firestore data isn't deleted before Auth verification succeeds
  if (!user.isAnonymous && user.metadata?.lastSignInTime) {
    const lastSignInMs = new Date(user.metadata.lastSignInTime).getTime();
    if (!isNaN(lastSignInMs) && Date.now() - lastSignInMs > 4 * 60 * 1000) {
      await reauthenticateForDeletion(user);
    }
  }

  // 1. Delete all user runs in Firestore (batched)
  const runsQuery = query(collection(db, 'runs'), where('userId', '==', user.uid));
  let runsSnap;
  try {
    runsSnap = await getDocs(runsQuery);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'runs');
  }

  const runDocs = runsSnap.docs;
  for (let i = 0; i < runDocs.length; i += 400) {
    const chunk = runDocs.slice(i, i + 400);
    const batch = writeBatch(db);
    chunk.forEach((docSnap) => batch.delete(docSnap.ref));
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'runs (batch)');
    }
  }

  // 2. Delete user profile document
  const userPath = `users/${user.uid}`;
  try {
    await deleteDoc(doc(db, 'users', user.uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, userPath);
  }

  // 3. Delete Firebase Authentication account (with recent-login fallback)
  try {
    await deleteUser(user);
  } catch (err: unknown) {
    const authErr = err as { code?: string };
    if (authErr?.code === 'auth/requires-recent-login' && !user.isAnonymous) {
      await reauthenticateForDeletion(user);
      await deleteUser(user);
    } else {
      throw err;
    }
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
  // Never allow regular user profile writes to touch admin-controlled governance or message fields
  const {
    accountStatus: _accountStatus,
    suspensionReason: _suspensionReason,
    adminNotes: _adminNotes,
    directMessageTitle: _directMessageTitle,
    directMessageBody: _directMessageBody,
    directMessageSeverity: _directMessageSeverity,
    directMessageSentAt: _directMessageSentAt,
    directMessageReadAt: _directMessageReadAt,
    ...userWritableProfile
  } = profile;

  const sanitized: UserProfile = {
    ...userWritableProfile,
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

export function subscribeUserProfile(
  userId: string,
  onProfile: (profile: UserProfile | null) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = `users/${userId}`;
  return onSnapshot(
    doc(db, 'users', userId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onProfile(null);
        return;
      }
      const data = snapshot.data() as UserProfile;
      if (data.target6kTimeSeconds === 1260 && !(data as any).hasCustomTarget) {
        delete data.target6kTimeSeconds;
      }
      onProfile(data);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeAppAnnouncement(
  onAnnouncement: (announcement: AppAnnouncement | null) => void
): Unsubscribe {
  const path = 'appConfig/announcement';
  return onSnapshot(
    doc(db, 'appConfig', 'announcement'),
    (snapshot) => {
      if (!snapshot.exists()) {
        onAnnouncement(null);
        return;
      }
      onAnnouncement(snapshot.data() as AppAnnouncement);
    },
    (error) => {
      console.warn('Could not subscribe to app announcement:', error);
    }
  );
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
    if (existing) {
      recordAdminLog(user, {
        action: 'change_pin',
        targetId: user.uid,
        targetLabel: user.email || ADMIN_EMAIL,
        details: `Updated admin passcode (${cleanedPin.length} digits).`,
      }).catch(() => {});
    }
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

export async function recordAdminLog(
  adminUser: User,
  entry: {
    action: AdminAuditAction;
    targetId?: string;
    targetLabel?: string;
    details: string;
  }
): Promise<AdminAuditLog> {
  if (!isAuthorizedAdmin(adminUser)) {
    throw new Error('Unauthorized admin access attempt.');
  }
  const id = sanitizeDocId(`log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const logDoc: AdminAuditLog = {
    id,
    adminUid: adminUser.uid,
    adminEmail: (adminUser.email || ADMIN_EMAIL).slice(0, 256),
    action: entry.action,
    ...(entry.targetId ? { targetId: sanitizeDocId(entry.targetId) } : {}),
    ...(entry.targetLabel ? { targetLabel: entry.targetLabel.slice(0, 256) } : {}),
    details: entry.details.slice(0, 500),
    createdAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, 'adminLogs', id), logDoc);
    return logDoc;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `adminLogs/${id}`);
  }
}

export async function fetchAdminLogs(): Promise<AdminAuditLog[]> {
  try {
    const snap = await getDocs(collection(db, 'adminLogs'));
    const logs = snap.docs.map((d) => d.data() as AdminAuditLog);
    logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return logs;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'adminLogs');
  }
}

export async function clearAdminLogs(adminUser: User, logIds: string[]): Promise<void> {
  if (!isAuthorizedAdmin(adminUser)) {
    throw new Error('Unauthorized admin access attempt.');
  }
  for (let i = 0; i < logIds.length; i += 400) {
    const chunk = logIds.slice(i, i + 400);
    const batch = writeBatch(db);
    chunk.forEach((id) => batch.delete(doc(db, 'adminLogs', sanitizeDocId(id))));
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'adminLogs (batch)');
    }
  }
}

export async function adminDeleteUserRuns(
  adminUser: User,
  targetUserId: string,
  targetLabel?: string,
  skipAuditLog = false
): Promise<number> {
  if (!isAuthorizedAdmin(adminUser)) {
    throw new Error('Unauthorized admin access attempt.');
  }
  const runsQuery = query(collection(db, 'runs'), where('userId', '==', targetUserId));
  let runsSnap;
  try {
    runsSnap = await getDocs(runsQuery);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'runs');
  }

  const runDocs = runsSnap.docs;
  for (let i = 0; i < runDocs.length; i += 400) {
    const chunk = runDocs.slice(i, i + 400);
    const batch = writeBatch(db);
    chunk.forEach((docSnap) => batch.delete(docSnap.ref));
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'runs (batch)');
    }
  }

  if (!skipAuditLog) {
    await recordAdminLog(adminUser, {
      action: 'reset_user_runs',
      targetId: targetUserId,
      targetLabel: targetLabel || targetUserId,
      details: `Deleted ${runDocs.length} workout record${runDocs.length === 1 ? '' : 's'}.`,
    });
  }

  return runDocs.length;
}

export async function adminDeleteUserAccount(
  adminUser: User,
  targetUserId: string,
  targetLabel?: string
): Promise<{ deletedRunsCount: number }> {
  if (!isAuthorizedAdmin(adminUser)) {
    throw new Error('Unauthorized admin access attempt.');
  }
  if (targetUserId === adminUser.uid) {
    throw new Error('Cannot delete the active admin account from the Admin Console.');
  }

  const deletedRunsCount = await adminDeleteUserRuns(adminUser, targetUserId, targetLabel, true);

  const userPath = `users/${targetUserId}`;
  try {
    await deleteDoc(doc(db, 'users', targetUserId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, userPath);
  }

  await recordAdminLog(adminUser, {
    action: 'delete_user',
    targetId: targetUserId,
    targetLabel: targetLabel || targetUserId,
    details: `Deleted user profile and ${deletedRunsCount} workout record${deletedRunsCount === 1 ? '' : 's'}.`,
  });

  return { deletedRunsCount };
}

export async function adminUpdateUserProfile(
  adminUser: User,
  updatedProfile: UserProfile,
  actionType: AdminAuditAction = 'edit_user',
  details?: string
): Promise<UserProfile> {
  if (!isAuthorizedAdmin(adminUser)) {
    throw new Error('Unauthorized admin access attempt.');
  }
  const now = new Date().toISOString();
  const sanitized: UserProfile = {
    ...updatedProfile,
    email: (updatedProfile.email || '').slice(0, 256),
    displayName: (updatedProfile.displayName || '').slice(0, 128),
    targetGoalName: updatedProfile.targetGoalName
      ? updatedProfile.targetGoalName.slice(0, 128)
      : undefined,
    weeklyRunGoal: Math.min(14, Math.max(1, Math.round(updatedProfile.weeklyRunGoal || 3))),
    weeklyDistanceGoalKm:
      updatedProfile.weeklyDistanceGoalKm !== undefined && updatedProfile.weeklyDistanceGoalKm > 0
        ? Math.min(500, Math.max(0, updatedProfile.weeklyDistanceGoalKm))
        : undefined,
    targetDistanceKm:
      updatedProfile.targetDistanceKm !== undefined
        ? Math.min(100, Math.max(0.1, updatedProfile.targetDistanceKm))
        : undefined,
    goalTimeframeWeeks:
      updatedProfile.goalTimeframeWeeks !== undefined
        ? Math.min(104, Math.max(1, Math.round(updatedProfile.goalTimeframeWeeks)))
        : undefined,
    suspensionReason: updatedProfile.suspensionReason
      ? updatedProfile.suspensionReason.slice(0, 300)
      : undefined,
    adminNotes: updatedProfile.adminNotes ? updatedProfile.adminNotes.slice(0, 1000) : undefined,
    directMessageTitle: updatedProfile.directMessageTitle
      ? updatedProfile.directMessageTitle.slice(0, 120)
      : undefined,
    directMessageBody: updatedProfile.directMessageBody
      ? updatedProfile.directMessageBody.slice(0, 1000)
      : undefined,
    updatedAt: now,
  };

  const cleanProfile = cleanObjectForFirestore(sanitized);
  const payload: Record<string, unknown> = { ...cleanProfile };

  if (!updatedProfile.targetGoalDate || !updatedProfile.targetGoalDate.trim()) {
    payload.targetGoalDate = deleteField();
  }
  if (!updatedProfile.target6kTimeSeconds || updatedProfile.target6kTimeSeconds <= 0) {
    payload.target6kTimeSeconds = deleteField();
  }
  if (!updatedProfile.weeklyDistanceGoalKm || updatedProfile.weeklyDistanceGoalKm <= 0) {
    payload.weeklyDistanceGoalKm = deleteField();
  }
  if (!updatedProfile.maxHeartRate || updatedProfile.maxHeartRate < 100) {
    payload.maxHeartRate = deleteField();
  }
  if (!updatedProfile.suspensionReason || !updatedProfile.suspensionReason.trim()) {
    payload.suspensionReason = deleteField();
  }
  if (!updatedProfile.adminNotes || !updatedProfile.adminNotes.trim()) {
    payload.adminNotes = deleteField();
  }
  if (!updatedProfile.directMessageTitle || !updatedProfile.directMessageTitle.trim()) {
    payload.directMessageTitle = deleteField();
  }
  if (!updatedProfile.directMessageBody || !updatedProfile.directMessageBody.trim()) {
    payload.directMessageBody = deleteField();
  }
  if (!updatedProfile.directMessageSeverity) {
    payload.directMessageSeverity = deleteField();
  }
  if (!updatedProfile.directMessageSentAt) {
    payload.directMessageSentAt = deleteField();
  }
  if (!updatedProfile.directMessageReadAt) {
    payload.directMessageReadAt = deleteField();
  }

  const path = `users/${updatedProfile.id}`;
  try {
    await setDoc(doc(db, 'users', updatedProfile.id), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  await recordAdminLog(adminUser, {
    action: actionType,
    targetId: updatedProfile.id,
    targetLabel: updatedProfile.displayName || updatedProfile.email || updatedProfile.id,
    details: details || 'Updated user profile and training settings.',
  });

  return sanitized;
}

export async function adminSendUserMessage(
  adminUser: User,
  targetProfile: UserProfile,
  message: {
    title?: string;
    body: string;
    severity: 'info' | 'warning' | 'success';
  }
): Promise<UserProfile> {
  if (!isAuthorizedAdmin(adminUser)) {
    throw new Error('Unauthorized admin access attempt.');
  }
  const trimmedBody = message.body.trim().slice(0, 1000);
  if (!trimmedBody) {
    throw new Error('Message body cannot be empty.');
  }
  const trimmedTitle = message.title ? message.title.trim().slice(0, 120) : '';
  const now = new Date().toISOString();

  const updatedProfile: UserProfile = {
    ...targetProfile,
    directMessageTitle: trimmedTitle || undefined,
    directMessageBody: trimmedBody,
    directMessageSeverity: message.severity,
    directMessageSentAt: now,
    directMessageReadAt: undefined,
  };

  return adminUpdateUserProfile(
    adminUser,
    updatedProfile,
    'send_user_message',
    `Sent ${message.severity} message${trimmedTitle ? ` ("${trimmedTitle}")` : ''} to ${targetProfile.displayName || targetProfile.email || targetProfile.id}.`
  );
}

export async function adminClearUserMessage(
  adminUser: User,
  targetProfile: UserProfile
): Promise<UserProfile> {
  if (!isAuthorizedAdmin(adminUser)) {
    throw new Error('Unauthorized admin access attempt.');
  }

  const updatedProfile: UserProfile = {
    ...targetProfile,
    directMessageTitle: undefined,
    directMessageBody: undefined,
    directMessageSeverity: undefined,
    directMessageSentAt: undefined,
    directMessageReadAt: undefined,
  };

  return adminUpdateUserProfile(
    adminUser,
    updatedProfile,
    'clear_user_message',
    `Cleared direct message for ${targetProfile.displayName || targetProfile.email || targetProfile.id}.`
  );
}

export async function markDirectMessageRead(userId: string): Promise<void> {
  const path = `users/${userId}`;
  const now = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'users', userId), {
      directMessageReadAt: now,
      updatedAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminSaveRunForUser(
  adminUser: User,
  targetUserId: string,
  run: RunRecord,
  isNew: boolean
): Promise<RunRecord> {
  if (!isAuthorizedAdmin(adminUser)) {
    throw new Error('Unauthorized admin access attempt.');
  }
  const safeId = sanitizeDocId(run.id);
  const now = new Date().toISOString();
  const normalizedRun: RunRecord = {
    ...run,
    id: safeId,
    userId: targetUserId,
    title: (run.title || 'Workout').slice(0, 150),
    notes: run.notes ? run.notes.slice(0, 1000) : undefined,
    createdAt: run.createdAt || now,
    updatedAt: now,
  };

  const cleanRun = cleanObjectForFirestore(normalizedRun);
  const payload: Record<string, unknown> = { ...cleanRun };
  if (!normalizedRun.notes || !normalizedRun.notes.trim()) {
    payload.notes = deleteField();
  }

  const path = `runs/${safeId}`;
  try {
    await setDoc(doc(db, 'runs', safeId), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }

  await recordAdminLog(adminUser, {
    action: isNew ? 'add_run' : 'edit_run',
    targetId: targetUserId,
    targetLabel: normalizedRun.title,
    details: `${isNew ? 'Added' : 'Updated'} ${normalizedRun.distanceKm.toFixed(2)} km (${normalizedRun.runType}) on ${normalizedRun.date}.`,
  });

  return normalizedRun;
}

export async function adminDeleteSingleRun(
  adminUser: User,
  run: RunRecord
): Promise<void> {
  if (!isAuthorizedAdmin(adminUser)) {
    throw new Error('Unauthorized admin access attempt.');
  }
  const safeId = sanitizeDocId(run.id);
  const path = `runs/${safeId}`;
  try {
    await deleteDoc(doc(db, 'runs', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }

  await recordAdminLog(adminUser, {
    action: 'delete_run',
    targetId: run.userId,
    targetLabel: run.title,
    details: `Deleted run "${run.title}" (${run.distanceKm.toFixed(2)} km on ${run.date}).`,
  });
}

export async function adminPurgeOrphanRuns(
  adminUser: User,
  orphanRunIds: string[]
): Promise<number> {
  if (!isAuthorizedAdmin(adminUser)) {
    throw new Error('Unauthorized admin access attempt.');
  }
  if (orphanRunIds.length === 0) return 0;

  for (let i = 0; i < orphanRunIds.length; i += 400) {
    const chunk = orphanRunIds.slice(i, i + 400);
    const batch = writeBatch(db);
    chunk.forEach((id) => batch.delete(doc(db, 'runs', sanitizeDocId(id))));
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'runs (orphan batch)');
    }
  }

  await recordAdminLog(adminUser, {
    action: 'purge_orphan_runs',
    details: `Purged ${orphanRunIds.length} orphaned workout record${orphanRunIds.length === 1 ? '' : 's'} with no user profile.`,
  });

  return orphanRunIds.length;
}

export async function getAppAnnouncement(): Promise<AppAnnouncement | null> {
  try {
    const snap = await getDoc(doc(db, 'appConfig', 'announcement'));
    return snap.exists() ? (snap.data() as AppAnnouncement) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'appConfig/announcement');
  }
}

export async function saveAppAnnouncement(
  adminUser: User,
  announcement: Omit<AppAnnouncement, 'id' | 'updatedAt' | 'updatedBy'>
): Promise<AppAnnouncement> {
  if (!isAuthorizedAdmin(adminUser)) {
    throw new Error('Unauthorized admin access attempt.');
  }
  const payload: AppAnnouncement = {
    id: 'announcement',
    enabled: announcement.enabled,
    title: announcement.title.trim().slice(0, 120),
    message: announcement.message.trim().slice(0, 500),
    severity: announcement.severity,
    updatedAt: new Date().toISOString(),
    updatedBy: (adminUser.email || ADMIN_EMAIL).slice(0, 256),
  };

  try {
    await setDoc(doc(db, 'appConfig', 'announcement'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'appConfig/announcement');
  }

  await recordAdminLog(adminUser, {
    action: 'update_announcement',
    targetId: 'announcement',
    targetLabel: payload.title || 'Global Banner',
    details: `${payload.enabled ? 'Enabled' : 'Disabled'} ${payload.severity} announcement banner.`,
  });

  return payload;
}
