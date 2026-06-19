import AdminShell from "@/components/admin/AdminShell";
import { getStore } from "@/lib/settings-store";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const store = await getStore();
  return <AdminShell storeName={store.name}>{children}</AdminShell>;
}
