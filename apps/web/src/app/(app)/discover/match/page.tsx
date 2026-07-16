import type { Metadata } from "next";
import { MatchInspirationView } from "@/components/discover/match/MatchInspirationView";

export const metadata: Metadata = {
  title: "Match my inspiration",
  description:
    "Upload a tattoo you love and INKD finds artists whose work matches that aesthetic — by style, subject, color and composition.",
};

export default function MatchInspirationPage() {
  return (
    <div className="py-2">
      <MatchInspirationView />
    </div>
  );
}
