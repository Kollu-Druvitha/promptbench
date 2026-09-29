import path from "path";
import { kvGetJson, kvSetJson } from "@/lib/server/storage";

// ---------------------------------------------------------------------------
// User registry + per-user data stores (lightweight personalization).
//
// Auth lives in the "users" document (id, username, bcrypt hash). Everything
// else is sharded per user: their test history on "db:<userId>" and their
// preference weights on "prefs:<userId>". The backend (local JSON files in
// dev, Upstash Redis on serverless) is decided in lib/server/storage.ts.
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface UserPreferences {
  quality: number; // multiplier on the quality utility (default 1)
  speed: number; // multiplier on the speed utility
  value: number; // multiplier on the cost/value utility
}

interface UserDb {
  users: User[];
}

export const DEFAULT_PREFS: UserPreferences = { quality: 1, speed: 1, value: 1 };

async function ensureUsers(): Promise<UserDb> {
  return kvGetJson<UserDb>("users", USERS_FILE, () => ({ users: [] }));
}

async function writeUsers(db: UserDb): Promise<void> {
  await kvSetJson("users", USERS_FILE, db);
}

export function userDataDir(userId: string): string {
  return path.join(DATA_DIR, "users", userId);
}

export async function createUser(
  username: string,
  passwordHash: string
): Promise<User> {
  const db = await ensureUsers();
  const name = username.trim().toLowerCase();
  if (db.users.some((u) => u.username === name)) {
    throw new Error("Username already taken");
  }
  const user: User = {
    id: `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    username: name,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  await writeUsers(db);
  await savePreferences(user.id, DEFAULT_PREFS);
  return user;
}

export async function findUserByUsername(
  username: string
): Promise<User | null> {
  const db = await ensureUsers();
  const name = username.trim().toLowerCase();
  return db.users.find((u) => u.username === name) ?? null;
}

export async function getUserById(id: string): Promise<User | null> {
  const db = await ensureUsers();
  return db.users.find((u) => u.id === id) ?? null;
}

export function toPublicUser(user: User) {
  return { id: user.id, username: user.username, createdAt: user.createdAt };
}

// ---------------------------------------------------------------------------
// Per-user preference profile (the "personalization" the recommender uses).
// ---------------------------------------------------------------------------
export async function getPreferences(
  userId: string
): Promise<UserPreferences> {
  const file = path.join(userDataDir(userId), "prefs.json");
  const raw = await kvGetJson<Partial<UserPreferences>>(`prefs:${userId}`, file, () => ({}));
  return {
    quality:
      typeof raw.quality === "number" && raw.quality > 0 ? raw.quality : 1,
    speed: typeof raw.speed === "number" && raw.speed > 0 ? raw.speed : 1,
    value: typeof raw.value === "number" && raw.value > 0 ? raw.value : 1,
  };
}

export async function savePreferences(
  userId: string,
  prefs: Partial<UserPreferences>
): Promise<UserPreferences> {
  const current = await getPreferences(userId);
  const clamp = (n: number) => Math.max(0.5, Math.min(3, Number(n) || 1));
  const saved: UserPreferences = {
    quality: clamp(prefs.quality ?? current.quality),
    speed: clamp(prefs.speed ?? current.speed),
    value: clamp(prefs.value ?? current.value),
  };
  await kvSetJson(`prefs:${userId}`, path.join(userDataDir(userId), "prefs.json"), saved);
  return saved;
}