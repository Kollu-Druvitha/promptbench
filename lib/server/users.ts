import fs from "fs";
import path from "path";

// -------------------------------------------------------------------------
// User registry + per-user data stores (lightweight personalization).
//
// Auth lives in data/users.json (id, username, bcrypt hash). Everything
// else is sharded per user: data/users/<id>/db.json holds that user's test
// history and prefs.json holds their learned preference weights. This keeps
// the zero-native-deps, JSON-file philosophy of the project while enabling
// true "this model is best FOR YOU" recommendations.
// -------------------------------------------------------------------------

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

function ensureUsers(): UserDb {
  if (!fs.existsSync(USERS_FILE)) {
    const initial: UserDb = { users: [] };
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  const raw = fs.readFileSync(USERS_FILE, "utf-8");
  try {
    return JSON.parse(raw) as UserDb;
  } catch {
    return { users: [] };
  }
}

function writeUsers(db: UserDb) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(db, null, 2));
}

export function userDataDir(userId: string): string {
  return path.join(DATA_DIR, "users", userId);
}

export function createUser(username: string, passwordHash: string): User {
  const db = ensureUsers();
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
  writeUsers(db);
  fs.mkdirSync(userDataDir(user.id), { recursive: true });
  savePreferences(user.id, DEFAULT_PREFS);
  return user;
}

export function findUserByUsername(username: string): User | null {
  const db = ensureUsers();
  const name = username.trim().toLowerCase();
  return db.users.find((u) => u.username === name) ?? null;
}

export function getUserById(id: string): User | null {
  const db = ensureUsers();
  return db.users.find((u) => u.id === id) ?? null;
}

export function toPublicUser(user: User) {
  return { id: user.id, username: user.username, createdAt: user.createdAt };
}

// -------------------------------------------------------------------------
// Per-user preference profile (the "personalization" the recommender uses).
// -------------------------------------------------------------------------
export function getPreferences(userId: string): UserPreferences {
  const file = path.join(userDataDir(userId), "prefs.json");
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as Partial<UserPreferences>;
    return {
      quality:
        typeof raw.quality === "number" && raw.quality > 0 ? raw.quality : 1,
      speed: typeof raw.speed === "number" && raw.speed > 0 ? raw.speed : 1,
      value: typeof raw.value === "number" && raw.value > 0 ? raw.value : 1,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePreferences(
  userId: string,
  prefs: Partial<UserPreferences>
): UserPreferences {
  const current = getPreferences(userId);
  const clamp = (n: number) => Math.max(0.5, Math.min(3, Number(n) || 1));
  const saved: UserPreferences = {
    quality: clamp(prefs.quality ?? current.quality),
    speed: clamp(prefs.speed ?? current.speed),
    value: clamp(prefs.value ?? current.value),
  };
  fs.mkdirSync(userDataDir(userId), { recursive: true });
  fs.writeFileSync(
    path.join(userDataDir(userId), "prefs.json"),
    JSON.stringify(saved, null, 2)
  );
  return saved;
}