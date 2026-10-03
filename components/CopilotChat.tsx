"use client";

import { useState } from "react";
import type { CopilotAnswer, CopilotCitation } from "@/lib/copilot-contract";
import { REFUSAL_MESSAGE } from "@/lib/copilot-contract";
import { formatInr } from "@/lib/money";

const EXAMPLES = [
  "How much did I spend on food last month?",
  "How much did I spend on travel?",
  "List my EMI payments",
];

function renderAnswer(answer: string, citations: CopilotCitation[]) {
  const parts = answer.split(/(\[#(?:[^\]]+)\])/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[#([^\]]+)\]$/);
    if (!match) {
      return <span key={`${part}-${index}`}>{part}</span>;
    }
    const id = match[1];
    const citation = citations.find((item) => item.id === id);
    const label = citation?.merchant_name ?? id.slice(0, 8);
    return (
      <a
        key={`${id}-${index}`}
        href={`#source-${id}`}
        className="rounded-sm bg-emerald-500/15 px-1 text-emerald-300 hover:bg-emerald-500/25"
        title={label}
      >
        [{label}]
      </a>
    );
  });
}

export function CopilotChat() {
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CopilotAnswer | null>(null);

  async function ask(nextQuestion: string) {
    const trimmed = nextQuestion.trim();
    if (trimmed.length < 3) {
      return;
    }
    setQuestion(trimmed);
    setStatus("working");
    setError(null);
    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      if (response.status === 401) {
        throw new Error("Please log in again.");
      }
      if (response.status === 402) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Upgrade to Pro");
      }
      if (!response.ok) {
        throw new Error("Copilot could not answer that.");
      }
      const data = (await response.json()) as CopilotAnswer;
      setResult(data);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Copilot failed.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => void ask(example)}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-emerald-500/60 hover:text-white"
          >
            {example}
          </button>
        ))}
      </div>

      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about your spending…"
          className="min-w-0 flex-1 rounded-md border border-slate-700 bg-ink-950 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
        />
        <button
          type="submit"
          disabled={status === "working"}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {status === "working" ? "Thinking…" : "Send"}
        </button>
      </form>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      {result ? (
        <div className="space-y-4">
          {result.usedFallback ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
              {result.answer || REFUSAL_MESSAGE}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800 bg-ink-900 p-4 text-sm leading-7 text-slate-100">
              {renderAnswer(result.answer, result.citations)}
            </div>
          )}

          {!result.usedFallback && result.citations.length > 0 ? (
            <div>
              <h2 className="text-sm font-medium text-slate-300">Sources</h2>
              <ul className="mt-2 space-y-2">
                {result.citations.map((citation) => (
                  <li
                    id={`source-${citation.id}`}
                    key={citation.id}
                    className="rounded-md border border-slate-800 bg-ink-950 px-3 py-2 text-xs text-slate-300"
                  >
                    <span className="text-slate-500">[{citation.id.slice(0, 8)}]</span>{" "}
                    {citation.date} | {citation.merchant_name ?? "Unknown"} |{" "}
                    {formatInr(Number(citation.amount))} | {citation.category ?? "uncategorized"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Ask a question to see a grounded answer from your transactions.</p>
      )}
    </div>
  );
}
