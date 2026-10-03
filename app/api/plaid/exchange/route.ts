import { NextResponse } from "next/server";
import { z } from "zod";
import { exchangePublicToken } from "@/lib/plaid";
import { requireUserId } from "@/lib/require-user";

export const runtime = "nodejs";

const bodySchema = z.object({
  public_token: z.string().min(1),
});

export async function POST(request: Request) {
  const authz = await requireUserId();
  if (authz.error) {
    return authz.error;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "public_token is required" }, { status: 400 });
  }

  try {
    const result = await exchangePublicToken(authz.userId, parsed.data.public_token);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "exchange_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
