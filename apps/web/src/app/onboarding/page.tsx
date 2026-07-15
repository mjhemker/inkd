import type { Metadata } from "next";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata: Metadata = { title: "Get set up" };

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
