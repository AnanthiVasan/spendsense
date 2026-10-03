"use client";

export function BillingActions({ tier }: { tier: "free" | "pro" }) {
  async function checkout() {
    const response = await fetch("/api/stripe/checkout", { method: "POST" });
    const data = (await response.json()) as { url?: string; error?: string };
    if (data.url) {
      window.location.href = data.url;
    }
  }

  async function portal() {
    const response = await fetch("/api/stripe/portal", { method: "POST" });
    const data = (await response.json()) as { url?: string; message?: string };
    if (data.url) {
      window.location.href = data.url;
      return;
    }
    if (data.message) {
      window.alert(data.message);
    }
  }

  if (tier === "free") {
    return (
      <button
        type="button"
        onClick={() => void checkout()}
        className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-emerald-400"
      >
        Upgrade to Pro
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void portal()}
      className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-100 hover:border-slate-500"
    >
      Manage billing
    </button>
  );
}
