import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createUser, findUserByUsername } from "@/lib/server/users";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (username.length < 3 || username.length > 32) {
    return NextResponse.json(
      { error: "Username must be 3–32 characters" },
      { status: 400 }
    );
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return NextResponse.json(
      { error: "Username: lowercase letters, numbers, and underscores only" },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }
  if (await findUserByUsername(username)) {
    return NextResponse.json(
      { error: "Username already taken" },
      { status: 409 }
    );
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const user = await createUser(username, passwordHash);

  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  await session.save();

  return NextResponse.json({
    user: { id: user.id, username: user.username, createdAt: user.createdAt },
  });
}