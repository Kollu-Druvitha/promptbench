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

export function getSessionSecret(): string {
  const secret = process.env.PROMPTBENCH_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "PROMPTBENCH_SESSION_SECRET must be at least 32 characters, set in .env.local"
    );
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