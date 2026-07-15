import type { Metadata } from "next";
import { PlaceholderScreen } from "@/components/placeholder-screen";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <PlaceholderScreen
      eyebrow="Profile"
      title="Profile"
      subtitle="The page clients see — portfolio, reviews, rates and availability."
      icon="user"
      emptyTitle="Your profile is a blank canvas"
      description="Import your portfolio from Instagram or upload work, set your styles and rates, and open your books."
      actionLabel="Start onboarding"
      actionHref="/onboarding"
    />
  );
}
