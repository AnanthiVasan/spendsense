import { CategorizeButton } from "@/components/CategorizeButton";
import { MockDataBadge } from "@/components/MockDataBadge";
import { RecheckAlertsButton } from "@/components/RecheckAlertsButton";
import { TransactionsTable } from "@/components/TransactionsTable";
import { listLinkedAccounts, listTransactions, plaidUiState } from "@/lib/accounts";
import { auth } from "@/lib/auth";

export default async function TransactionsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const { mock } = plaidUiState();

  let institutionName: string | null = null;
  let transactions: Awaited<ReturnType<typeof listTransactions>> = [];
  let dbError: string | null = null;

  if (userId) {
    try {
      const [accounts, rows] = await Promise.all([
        listLinkedAccounts(userId),
        listTransactions(userId, 150),
      ]);
      institutionName = accounts.find((account) => account.institutionName)?.institutionName ?? null;
      transactions = rows;
    } catch {
      dbError = "Database is not configured yet. Set DATABASE_URL and apply migrations.";
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        {mock ? <MockDataBadge /> : null}
      </div>
      <p className="mt-2 text-slate-400">
        {institutionName
          ? `Activity from ${institutionName}. Amber rows are low-confidence; rose rows are anomaly alerts.`
          : "Connect a bank on the dashboard or run npm run seed to load transactions."}
      </p>
      {dbError ? <p className="mt-3 text-sm text-amber-300">{dbError}</p> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <CategorizeButton />
        <RecheckAlertsButton />
      </div>
      <TransactionsTable transactions={transactions} />
    </section>
  );
}
