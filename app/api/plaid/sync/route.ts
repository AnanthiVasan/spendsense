import { NextResponse } from "next/server";
import { syncTransactions } from "@/lib/plaid";
import { requireUserId } from "@/lib/require-user";

export const runtime = "nodejs";

export async function POST() {
  const authz = await requireUserId();
  if (authz.error) {
    return authz.error;
  }

  try {
    const result = await syncTransactions(authz.userId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "sync_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
