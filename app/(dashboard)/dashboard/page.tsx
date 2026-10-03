import { AnomalyAlertsCard } from "@/components/AnomalyAlertsCard";
import { ConnectBankButton } from "@/components/ConnectBankButton";
import { MockDataBadge } from "@/components/MockDataBadge";
import { listLinkedAccounts, monthSpend, plaidUiState } from "@/lib/accounts";
import { listAlerts } from "@/lib/anomaly";
import { auth } from "@/lib/auth";
import { formatInr } from "@/lib/money";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const { mock } = plaidUiState();

  let accounts: Awaited<ReturnType<typeof listLinkedAccounts>> = [];
  let spend = 0;
  let alerts: Awaited<ReturnType<typeof listAlerts>> = [];
  let dbError: string | null = null;

  if (userId) {
    try {
      [accounts, spend, alerts] = await Promise.all([
        listLinkedAccounts(userId),
        monthSpend(userId),
        listAlerts(userId),
      ]);
    } catch {
      dbError = "Database is not configured yet. Set DATABASE_URL and apply migrations.";
    }
  }

  const institutionName = accounts.find((account) => account.institutionName)?.institutionName;

  return (
    <section>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        {mock ? <MockDataBadge /> : null}
      </div>
      <p className="mt-2 text-slate-400">
        Signed in as {session?.user?.email}. Connect a bank to pull about 90 days of transactions.
      </p>
      {dbError ? <p className="mt-3 text-sm text-amber-300">{dbError}</p> : null}

      <div className="mt-6">
        <ConnectBankButton />
        {institutionName ? (
          <p className="mt-3 text-sm text-slate-300">Connected: {institutionName}</p>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No institution connected yet.</p>
        )}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <article className="rounded-lg border border-slate-800 bg-ink-900 p-4">
          <p className="text-sm text-slate-400">This month (outflows)</p>
          <p className="mt-2 text-2xl font-semibold">{formatInr(spend)}</p>
        </article>
        <article className="rounded-lg border border-slate-800 bg-ink-900 p-4">
          <p className="text-sm text-slate-400">Accounts linked</p>
          <p className="mt-2 text-2xl font-semibold">{accounts.length}</p>
        </article>
        <article className="rounded-lg border border-slate-800 bg-ink-900 p-4">
          <p className="text-sm text-slate-400">Institution</p>
          <p className="mt-2 text-lg font-semibold">{institutionName ?? "—"}</p>
        </article>
      </div>

      <AnomalyAlertsCard alerts={alerts} />
    </section>
  );
}
