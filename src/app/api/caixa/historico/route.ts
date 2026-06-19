import { NextResponse } from "next/server";
import { listClosedSessions } from "@/lib/cash-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ sessions: await listClosedSessions() });
}
