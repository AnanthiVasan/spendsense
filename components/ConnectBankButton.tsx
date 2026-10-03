"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
import { MOCK_PUBLIC_TOKEN } from "@/lib/plaid-mock";

type LinkTokenResponse = {
  linkToken: string;
  expiration: string;
  mock: boolean;
};

export function ConnectBankButton() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const finishLink = useCallback(
    async (publicToken: string) => {
      setStatus("working");
      const exchangeResponse = await fetch("/api/plaid/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token: publicToken }),
      });
      if (!exchangeResponse.ok) {
        throw new Error("Could not exchange the Plaid token.");
      }

      const syncResponse = await fetch("/api/plaid/sync", { method: "POST" });
      if (!syncResponse.ok) {
        throw new Error("Could not sync transactions.");
      }

      setStatus("idle");
      router.push("/transactions");
      router.refresh();
    },
    [router],
  );

  const onSuccess = useCallback(
    async (publicToken: string | null) => {
      if (!publicToken) {
        setMessage("Plaid did not return a public token.");
        setStatus("error");
        return;
      }
      try {
        await finishLink(publicToken);
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Link failed.");
      }
    },
    [finishLink],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: () => {
      setStatus("idle");
    },
  });

  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  async function onConnect() {
    setStatus("working");
    setMessage(null);
    try {
      const response = await fetch("/api/plaid/link-token", { method: "POST" });
      if (response.status === 401) {
        throw new Error("Please log in again.");
      }
      if (!response.ok) {
        throw new Error("Could not create a Plaid link token.");
      }
      const data = (await response.json()) as LinkTokenResponse;
      if (data.mock) {
        await finishLink(MOCK_PUBLIC_TOKEN);
        return;
      }
      setLinkToken(data.linkToken);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not start Plaid Link.");
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void onConnect()}
        disabled={status === "working"}
        className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-emerald-400 disabled:opacity-60"
      >
        {status === "working" ? "Connecting…" : "Connect bank"}
      </button>
      {message ? <p className="text-sm text-rose-400">{message}</p> : null}
    </div>
  );
}
