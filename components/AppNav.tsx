import Link from "next/link";
import { logout } from "@/lib/auth-actions";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/copilot", label: "Copilot" },
  { href: "/forecast", label: "Forecast" },
  { href: "/goals", label: "Goals" },
  { href: "/report", label: "Report" },
  { href: "/billing", label: "Billing" },
];

export function AppNav({ email }: { email: string }) {
  return (
    <aside className="border-b border-slate-800 bg-ink-900 px-4 py-5 lg:border-b-0 lg:border-r">
      <p className="px-2 text-sm font-semibold tracking-tight">Spendsense</p>
      <nav className="mt-6 flex flex-wrap gap-1 lg:flex-col">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-md px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="mt-8 px-2 text-xs text-slate-500">{email}</div>
      <form action={logout} className="mt-3 px-2">
        <button type="submit" className="text-sm text-slate-400 hover:text-white">
          Sign out
        </button>
      </form>
    </aside>
  );
}
