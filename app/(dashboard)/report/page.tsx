import { ReportView } from "@/components/ReportView";

export default function ReportPage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Monthly report</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        Figures are computed from your ledger. The narrative restates them and does not invent numbers.
      </p>
      <ReportView />
    </section>
  );
}
