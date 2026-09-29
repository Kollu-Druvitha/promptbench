import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getUserById, toPublicUser, User } from "@/lib/server/users";

// -------------------------------------------------------------------------
// Session helpers built on iron-session (encrypted stateless cookie — no
// session DB needed). currentScope() returns "local" for anonymous visitors
// (existing data/db.json) or the user id for logged-in users.
// -------------------------------------------------------------------------

export interface SessionData {
  userId?: string;
  username?: string;
}

const COOKIE_NAME = "promptbench_session";

// Ephemeral fallback secret (per warm instance) used when the host hasn't set
// PROMPTBENCH_SESSION_SECRET. Sessions only survive while the instance is
// warm, and a loud warning is logged — the real fix is setting the env var.
let ephemeralSecret: string | null = null;
function fallbackSecret(): string {
  if (!ephemeralSecret) {
    let s = Math.random().toString(36).slice(2) + Date.now().toString(36);
    while (s.length < 32) s += Math.random().toString(36).slice(2);
    ephemeralSecret = s;
    console.error(
      "[auth] PROMPTBENCH_SESSION_SECRET is missing or shorter than 32 chars — " +
        "using an ephemeral per-process secret, so logins won't survive cold starts. " +
        "Set it in your host's environment variables."
    );
  }
  return ephemeralSecret;
}

export function getSessionSecret(): string {
  const secret = process.env.PROMPTBENCH_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    return fallbackSecret();
  }
  return secret;
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), {
    password: getSessionSecret(),
    cookieName: COOKIE_NAME,
  });
}

/** The logged-in User, or null. */
export async function currentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session.userId) return null;
  return await getUserById(session.userId);
}

/** Storage scope: the userId for logged-in users, "local" otherwise. */
export async function currentScope(): Promise<string> {
  const session = await getSession();
  return session.userId ?? "local";
}

export async function currentPublicUser() {
  const user = await currentUser();
  return user ? toPublicUser(user) : null;
}