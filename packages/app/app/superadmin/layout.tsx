import { AdminShell } from "@/components/admin-shell";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell soloSuperAdmin>{children}</AdminShell>;
}
