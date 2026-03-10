import { DashboardLayoutInner } from "./dashboard-layout-inner"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardLayoutInner>{children}</DashboardLayoutInner>
}
