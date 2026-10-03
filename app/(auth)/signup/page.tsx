import Link from "next/link";
import { SignupForm } from "@/components/SignupForm";

export default function SignupPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Create an account</h1>
      <p className="mt-1 text-sm text-slate-400">Passwords are stored as bcrypt hashes.</p>
      <div className="mt-6">
        <SignupForm />
      </div>
      <p className="mt-4 text-sm text-slate-400">
        Already registered?{" "}
        <Link href="/login" className="text-emerald-400 hover:text-emerald-300">
          Log in
        </Link>
      </p>
    </>
  );
}
