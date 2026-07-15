"use client";

import { useParams } from "next/navigation";
import { BookFlow } from "@/components/book/book-flow";

/**
 * Public booking entry: /book/<artistHandle>. Standalone (no app shell) so it
 * reads like the artist's own booking page. Submitting requires a signed-in
 * client; the flow bounces to /auth with a return path when needed.
 */
export default function BookArtistPage() {
  const params = useParams<{ artistHandle: string }>();
  const handle = Array.isArray(params.artistHandle)
    ? params.artistHandle[0]
    : params.artistHandle;
  return <BookFlow handle={handle ?? ""} />;
}
