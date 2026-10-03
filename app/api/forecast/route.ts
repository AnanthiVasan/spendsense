import { NextResponse } from "next/server";
import { getForecastPayload } from "@/lib/forecast-narrative";
import { requireUserId } from "@/lib/require-user";

export const runtime = "nodejs";

export async function GET() {
  const authz = await requireUserId();
  if (authz.error) {
    return authz.error;
  }

  try {
    const payload = await getForecastPayload(authz.userId);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "forecast_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
