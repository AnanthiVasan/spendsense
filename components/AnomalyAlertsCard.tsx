import type { AlertRow } from "@/lib/anomaly";
import { formatInr } from "@/lib/money";
import { RecheckAlertsButton } from "./RecheckAlertsButton";

export function AnomalyAlertsCard({ alerts }: { alerts: AlertRow[] }) {
  const top = alerts.slice(0, 4);

  return (
    <article className="mt-8 rounded-lg border border-slate-800 bg-ink-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-slate-300">Anomaly alerts</h2>
          <p className="mt-1 text-sm text-slate-500">
            Unusually large spends vs each category’s mean + 2σ.
          </p>
        </div>
        <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-medium text-rose-300">
          {alerts.length}
        </span>
      </div>

      {top.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No anomaly alerts yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {top.map((alert) => (
            <li key={alert.id} className="text-sm text-slate-300">
              <p>
                {alert.merchantName ?? "Unknown"} | {formatInr(Number(alert.amount))} |{" "}
                {alert.category ?? "other"}
              </p>
              <p className="text-xs text-slate-500">{alert.reason}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <RecheckAlertsButton />
      </div>
    </article>
  );
}
