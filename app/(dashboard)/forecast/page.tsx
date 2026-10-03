import { ForecastChart } from "@/components/ForecastChart";
import { getForecastPayload } from "@/lib/forecast-narrative";
import { auth } from "@/lib/auth";
import { formatInr } from "@/lib/money";

export default async function ForecastPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  let payload: Awaited<ReturnType<typeof getForecastPayload>> | null = null;
  let dbError: string | null = null;
  try {
    payload = await getForecastPayload(userId);
  } catch {
    dbError = "Database is not configured yet. Set DATABASE_URL and run npm run seed.";
  }

  const forecast = payload?.forecast;
  const negative = forecast?.summary.firstNegativeDay;

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Forecast</h1>
      <p className="mt-2 text-slate-400">
        30-day cash-flow heuristic. Numbers are computed in code; Gemini (or the mock template) only
        writes the explanation.
      </p>
      {dbError ? <p className="mt-4 text-sm text-amber-300">{dbError}</p> : null}

      {forecast && payload ? (
        <>
          <p className="mt-6 text-sm leading-7 text-slate-200">{payload.narrative}</p>
          {payload.mock ? (
            <p className="mt-2 text-xs text-slate-500">Narrative is mock (no GEMINI_API_KEY).</p>
          ) : null}

          {negative ? (
            <p className="mt-4 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              Projected balance goes negative on {negative} (low {formatInr(forecast.summary.lowestBalance)}
              ).
            </p>
          ) : null}

          <div className="mt-6 rounded-lg border border-slate-800 bg-ink-900 p-4">
            <ForecastChart points={forecast.points} />
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-ink-900 p-4">
              <dt className="text-sm text-slate-400">Projected end balance</dt>
              <dd className="mt-2 text-xl font-semibold">
                {formatInr(forecast.summary.projectedEndBalance)}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-ink-900 p-4">
              <dt className="text-sm text-slate-400">Projected inflow</dt>
              <dd className="mt-2 text-xl font-semibold text-emerald-400">
                {formatInr(forecast.summary.totalProjectedInflow)}
              </dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-ink-900 p-4">
              <dt className="text-sm text-slate-400">Projected outflow</dt>
              <dd className="mt-2 text-xl font-semibold">
                {formatInr(forecast.summary.totalProjectedOutflow)}
              </dd>
            </div>
          </dl>

          <div className="mt-6">
            <h2 className="text-sm font-medium text-slate-300">Recurring items</h2>
            {forecast.summary.recurringItems.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">None detected in the last 90 days.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-slate-300">
                {forecast.summary.recurringItems.map((item) => (
                  <li key={`${item.label}-${item.cadence}`}>
                    {item.label} · {item.cadence} · {formatInr(item.amount)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
