import { requireUser } from "@/lib/auth/guards";
import { AppSidebar } from "@/components/app-sidebar";
import { UserMenu } from "@/components/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen">
      <AppSidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-background px-4 md:px-6">
          <span className="font-semibold md:hidden">IT Admin</span>
          <div className="flex-1" />
          <UserMenu name={user.name} username={user.username} role={user.role} />
        </header>
        <main className="min-w-0 flex-1 bg-muted/30 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
