import { StudioShell } from "@/components/rift/Shell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <StudioShell>{children}</StudioShell>;
}
