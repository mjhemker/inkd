import type { Metadata } from "next";
import { Suspense } from "react";
import { DiscoverView } from "@/components/discover/DiscoverView";

export const metadata: Metadata = {
  title: "Discover",
  description:
    "Find tattoo artists near you by style, city, price band and open books — on a live local map.",
};

export default function DiscoverPage() {
  // useSearchParams (URL-driven filters) needs a Suspense boundary in App Router.
  return (
    <Suspense fallback={null}>
      <DiscoverView />
    </Suspense>
  );
}
