import { NextRequest, NextResponse } from "next/server";
import { getTest } from "@/lib/server/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const { testId } = await params;
  const record = getTest(testId);
  if (!record) {
    return NextResponse.json({ error: "Test not found" }, { status: 404 });
  }
  return NextResponse.json(record);
}
