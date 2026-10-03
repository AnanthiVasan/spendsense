import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { auth } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <AppNav email={session.user.email ?? ""} />
      <div className="px-6 py-8">{children}</div>
    </div>
  );
}
