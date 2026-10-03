"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signup, type AuthFormState } from "@/lib/auth-actions";

const initialState: AuthFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-emerald-400 disabled:opacity-60"
    >
      {pending ? "Creating account…" : "Sign up"}
    </button>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signup, initialState);

  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm">
        <span className="text-slate-300">Name</span>
        <input
          name="name"
          type="text"
          required
          autoComplete="name"
          className="mt-1 w-full rounded-md border border-slate-700 bg-ink-950 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-slate-300">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-slate-700 bg-ink-950 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-slate-300">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-slate-700 bg-ink-950 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
        />
      </label>
      {state.error ? <p className="text-sm text-rose-400">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
