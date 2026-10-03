import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
        Spendsense
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">
        See where your money goes.
      </h1>
      <p className="mt-4 max-w-xl text-slate-400">
        Sign in to open your dashboard. Bank linking, copilot, and billing land in later
        steps — this build is auth, Postgres, and gated app routes.
      </p>
      <div className="mt-8 flex gap-3">
        {session?.user ? (
          <Link
            href="/dashboard"
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-emerald-400"
          >
            Open dashboard
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-emerald-400"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100 hover:border-slate-500"
            >
              Create account
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
