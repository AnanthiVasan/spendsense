"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function GoalActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<"accepted" | "dismissed" | null>(null);

  async function update(status: "accepted" | "dismissed") {
    setPending(status);
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setPending(null);
    router.refresh();
  }

  return (
    <div className="mt-4 flex gap-2">
      <button
        type="button"
        disabled={pending !== null}
        onClick={() => void update("accepted")}
        className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-ink-950 hover:bg-emerald-400 disabled:opacity-60"
      >
        {pending === "accepted" ? "Saving…" : "Accept"}
      </button>
      <button
        type="button"
        disabled={pending !== null}
        onClick={() => void update("dismissed")}
        className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:border-slate-500 disabled:opacity-60"
      >
        {pending === "dismissed" ? "Dismissing…" : "Dismiss"}
      </button>
    </div>
  );
}
