import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MessagesShell } from "@/components/messages/MessagesShell";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesLayout({ children }: { children: ReactNode }) {
  return <MessagesShell>{children}</MessagesShell>;
}
