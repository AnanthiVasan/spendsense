"use client";

import { useEffect, useState } from "react";
import type { MonthlyReport } from "@/lib/report-narrative";
import { formatInr } from "@/lib/money";

type Payload = {
  report: MonthlyReport;
  availableMonths: string[];
};

export function ReportView({ initialMonth }: { initialMonth?: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(initialMonth ?? "");

  useEffect(() => {
    let cancelled = false;
    const query = month ? `?month=${month}` : "";
    fetch(`/api/report${query}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the report.");
        return response.json() as Promise<Payload>;
      })
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        if (!month) setMonth(data.report.month);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the report.");
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  if (error) return <p className="mt-4 text-sm text-rose-300">{error}</p>;
  if (!payload) return <p className="mt-4 text-sm text-slate-500">Loading report…</p>;

  const { report } = payload;
  const metrics = report.metrics;
  const maxCategory = Math.max(...metrics.categories.map((category) => category.amount), 1);

  return (
    <div className="mt-6 space-y-6">
      <label className="block text-sm text-slate-400">
        Month
        <select
          className="mt-1 block rounded-md border border-slate-700 bg-ink-950 px-3 py-2 text-sm text-slate-100"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        >
          {payload.availableMonths
            .slice()
            .reverse()
            .map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
        </select>
      </label>

      <div className="flex flex-wrap items-end gap-4">
        <p className="text-6xl font-semibold tabular-nums">{report.score}</p>
        <p className="pb-2 text-lg text-emerald-300">{report.scoreLabel}</p>
      </div>

      <p className="max-w-3xl text-sm leading-7 text-slate-200">{report.narrative}</p>

      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          ["Income", formatInr(metrics.totalIncome)],
          ["Spend", formatInr(metrics.totalSpend)],
          ["Net savings", formatInr(metrics.netSavings)],
          ["Savings rate", `${Math.round(metrics.savingsRate * 100)}%`],
          ["MoM spend", formatInr(metrics.spendDelta)],
          ["Anomalies", String(metrics.anomalyCount)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-800 bg-ink-900 p-3">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="mt-1 text-lg font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <div>
        <h2 className="text-sm font-medium text-slate-300">Spend by category</h2>
        <ul className="mt-3 space-y-2">
          {metrics.categories.map((category) => (
            <li key={category.category}>
              <div className="flex justify-between text-sm text-slate-300">
                <span className="capitalize">{category.category}</span>
                <span>
                  {formatInr(category.amount)} · {Math.round(category.share * 100)}%
                </span>
              </div>
              <div className="mt-1 h-2 rounded bg-slate-800">
                <div
                  className="h-2 rounded bg-emerald-500"
                  style={{ width: `${Math.max(4, (category.amount / maxCategory) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {report.actionItems.map((item) => (
          <article key={item.title} className="rounded-lg border border-slate-800 bg-ink-900 p-4">
            <h3 className="text-sm font-medium">{item.title}</h3>
            <p className="mt-2 text-sm text-slate-400">{item.detail}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
