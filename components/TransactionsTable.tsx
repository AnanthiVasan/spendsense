import type { SafeTransaction } from "@/lib/accounts";
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/categories";
import { formatInr } from "@/lib/money";

export function TransactionsTable({ transactions }: { transactions: SafeTransaction[] }) {
  if (transactions.length === 0) {
    return (
      <p className="mt-6 text-sm text-slate-400">
        No transactions yet. Connect a bank from the dashboard or run <code>npm run seed</code>.
      </p>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-slate-800">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-ink-900 text-slate-400">
          <tr>
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium">Merchant</th>
            <th className="px-4 py-2 font-medium">Category</th>
            <th className="px-4 py-2 font-medium">Account</th>
            <th className="px-4 py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => {
            const amount = Number(transaction.amount);
            const lowConfidence =
              transaction.confidence !== null &&
              transaction.confidence < LOW_CONFIDENCE_THRESHOLD;
            return (
              <tr
                key={transaction.id}
                className={`border-t border-slate-800 ${
                  transaction.anomalyReason
                    ? "bg-rose-500/10"
                    : lowConfidence
                      ? "bg-amber-500/10"
                      : ""
                }`}
              >
                <td className="px-4 py-2 text-slate-300">{transaction.occurredOn}</td>
                <td className="px-4 py-2">
                  {transaction.merchantName ?? "Unknown"}
                  {transaction.pending ? (
                    <span className="ml-2 text-xs text-slate-500">pending</span>
                  ) : null}
                  {transaction.anomalyReason ? (
                    <span
                      className="ml-2 inline-flex cursor-help items-center rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-300"
                      title={transaction.anomalyReason}
                    >
                      alert
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-2">
                  <span className="capitalize text-slate-200">
                    {transaction.category ?? "uncategorized"}
                  </span>
                  {transaction.confidence !== null ? (
                    <span
                      className={`ml-2 text-xs ${lowConfidence ? "text-amber-300" : "text-slate-500"}`}
                    >
                      {(transaction.confidence * 100).toFixed(0)}%
                      {lowConfidence ? " low" : ""}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-slate-400">{transaction.accountName ?? "—"}</td>
                <td
                  className={`px-4 py-2 text-right tabular-nums ${
                    amount < 0 ? "text-emerald-400" : "text-slate-100"
                  }`}
                >
                  {formatInr(amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
