import { NextResponse } from "next/server";
import { getStats } from "@/lib/server/db";

export async function GET() {
  return NextResponse.json(getStats());
}
