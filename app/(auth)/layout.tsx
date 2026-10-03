export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
        Spendsense
      </p>
      <div className="mt-6 rounded-xl border border-slate-800 bg-ink-900 p-6 shadow-xl">
        {children}
      </div>
    </main>
  );
}
