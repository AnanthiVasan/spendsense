import { NextResponse } from "next/server";
import { z } from "zod";
import { generateMonthlyReport, getOrCreateReport } from "@/lib/report-narrative";
import { isMonthKey, listReportMonths } from "@/lib/report";
import { requireUserId } from "@/lib/require-user";

export const runtime = "nodejs";

const bodySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export async function GET(request: Request) {
  const authz = await requireUserId();
  if (authz.error) {
    return authz.error;
  }

  const month = new URL(request.url).searchParams.get("month") ?? undefined;
  if (month && !isMonthKey(month)) {
    return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  }

  try {
    const payload = await getOrCreateReport(authz.userId, month);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "report_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authz = await requireUserId();
  if (authz.error) {
    return authz.error;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  }

  const months = await listReportMonths(authz.userId);
  const month = parsed.data.month;
  if (!month) {
    return NextResponse.json({ error: "month is required" }, { status: 400 });
  }

  try {
    const report = await generateMonthlyReport(authz.userId, month);
    return NextResponse.json({ report, availableMonths: months });
  } catch (error) {
    const message = error instanceof Error ? error.message : "report_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
