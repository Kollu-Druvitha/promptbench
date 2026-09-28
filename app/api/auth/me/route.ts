import { NextResponse } from "next/server";
import { currentPublicUser } from "@/lib/auth";

export async function GET() {
  const user = await currentPublicUser();
  return NextResponse.json({ user });
}