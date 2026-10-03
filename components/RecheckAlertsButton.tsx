"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RecheckAlertsButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onClick() {
    setStatus("working");
    setMessage(null);
    try {
      const response = await fetch("/api/alerts", { method: "POST" });
      if (response.status === 401) {
        throw new Error("Please log in again.");
      }
      if (!response.ok) {
        throw new Error("Could not recompute alerts.");
      }
      const data = (await response.json()) as { alerts: unknown[] };
      setStatus("idle");
      setMessage(`Found ${data.alerts.length} alert${data.alerts.length === 1 ? "" : "s"}.`);
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not recompute alerts.");
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
        {status === "working" ? "Checking…" : "Re-check for anomalies"}
      </button>
      {message ? (
        <p className={`text-sm ${status === "error" ? "text-rose-400" : "text-slate-400"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
