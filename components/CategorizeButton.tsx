"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CategorizeButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onClick() {
    setStatus("working");
    setMessage(null);
    try {
      const response = await fetch("/api/categorize", { method: "POST" });
      if (response.status === 401) {
        throw new Error("Please log in again.");
      }
      if (!response.ok) {
        throw new Error("Categorization failed.");
      }
      const data = (await response.json()) as { categorized: number; mock: boolean };
      setStatus("idle");
      setMessage(
        data.categorized === 0
          ? "No uncategorized transactions."
          : `Categorized ${data.categorized} ${data.mock ? "(mock rules)" : "(Gemini)"}.`,
      );
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Categorization failed.");
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={status === "working"}
        className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-100 hover:border-slate-500 disabled:opacity-60"
      >
        {status === "working" ? "Categorizing…" : "Categorize new"}
      </button>
      {message ? (
        <p className={`text-sm ${status === "error" ? "text-rose-400" : "text-slate-400"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
