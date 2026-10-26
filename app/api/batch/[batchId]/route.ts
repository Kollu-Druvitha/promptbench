import { NextRequest, NextResponse } from "next/server";
import { getBatch } from "@/lib/server/db";
import { currentScope } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const scope = await currentScope();
  const record = await getBatch(batchId, scope);
  if (!record) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }
  return NextResponse.json(record);
}
