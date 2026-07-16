import type { Metadata } from "next";
import { ShopDashboardView } from "@/components/shop/ShopDashboardView";

export const metadata: Metadata = { title: "Shop" };

export default function ShopDashboardPage() {
  return <ShopDashboardView />;
}
