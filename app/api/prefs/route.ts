import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getPreferences, savePreferences } from "@/lib/server/users";

// GET /api/prefs — the current user's learned preference weights (null if
// anonymous, in which case the recommender runs with uniform weights).
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ user: null, prefs: null });
  return NextResponse.json({ user: { id: user.id, username: user.username }, prefs: await getPreferences(user.id) });
}

// PUT /api/prefs — persist a user's personalization weights.
export async function PUT(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to save this workspace's preferences" },
      { status: 401 }
    );
  }
  let body: { quality?: number; speed?: number; value?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  // Merge so a partial update can't clobber other axes.
  const current = await getPreferences(user.id);
  const prefs = await savePreferences(user.id, {
    quality: body.quality ?? current.quality,
    speed: body.speed ?? current.speed,
    value: body.value ?? current.value,
  });
  return NextResponse.json({ prefs });
}