import { NextResponse } from "next/server";
import { getStats } from "@/lib/server/db";
import { currentScope } from "@/lib/auth";

export async function GET() {
  const scope = await currentScope();
  return NextResponse.json(getStats(scope));
}
