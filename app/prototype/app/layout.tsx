import { ClientShell } from "@/components/rift/Shell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ClientShell>{children}</ClientShell>;
}
