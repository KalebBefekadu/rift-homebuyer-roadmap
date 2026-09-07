import { ProductShell } from "@/components/rift/ProductShell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ProductShell v="sell">{children}</ProductShell>;
}
