import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Log in</h1>
      <p className="mt-1 text-sm text-slate-400">Use the email and password for your account.</p>
      <div className="mt-6">
        <LoginForm />
      </div>
      <p className="mt-4 text-sm text-slate-400">
        No account yet?{" "}
        <Link href="/signup" className="text-emerald-400 hover:text-emerald-300">
          Sign up
        </Link>
      </p>
    </>
  );
}
