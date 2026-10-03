import { CopilotChat } from "@/components/CopilotChat";
import { PLAN_LIMITS } from "@/lib/stripe";

export default function CopilotPage() {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Copilot</h1>
      <p className="mt-2 text-slate-400">
        Answers use only your retrieved transactions. Free accounts include{" "}
        {PLAN_LIMITS.free.copilotQueriesPerDay} copilot questions per day.
      </p>
      <div className="mt-6">
        <CopilotChat />
      </div>
    </section>
  );
}
