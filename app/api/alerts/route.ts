import { NextResponse } from "next/server";
import { detectAnomalies, listAlerts } from "@/lib/anomaly";
import { requireUserId } from "@/lib/require-user";

export const runtime = "nodejs";

export async function GET() {
  const authz = await requireUserId();
  if (authz.error) {
    return authz.error;
  }

  try {
    const alerts = await listAlerts(authz.userId);
    return NextResponse.json({ alerts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "alerts_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  const authz = await requireUserId();
  if (authz.error) {
    return authz.error;
  }

  try {
    await detectAnomalies(authz.userId);
    const alerts = await listAlerts(authz.userId);
    return NextResponse.json({ alerts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "detect_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
