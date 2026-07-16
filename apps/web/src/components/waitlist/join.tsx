"use client";

/**
 * Connected "join the waitlist" entry point (web). Given an artist id (+ name),
 * loads the artist's public services and submits a new waitlist entry for the
 * current client. Reached from an artist profile / booking flow when a desired
 * time isn't open.
 */
import { useRouter } from "next/navigation";
import { useCurrentProfile, useServices, useJoinWaitlist } from "@inkd/core";
import { Skeleton, useToast } from "@inkd/ui/web";
import { WaitlistJoinForm } from "./join-form";

export function WaitlistJoin({
  artistId,
  artistName,
}: {
  artistId: string;
  artistName?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const profileQ = useCurrentProfile();
  const servicesQ = useServices(artistId);
  const join = useJoinWaitlist(profileQ.data?.id ?? "");

  if (profileQ.isLoading) return <Skeleton className="h-80 w-full" />;

  const services = (servicesQ.data ?? [])
    .filter((s) => s.is_public)
    .map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="mx-auto max-w-lg">
      <WaitlistJoinForm
        artistId={artistId}
        artistName={artistName}
        services={services}
        submitting={join.isPending}
        onSubmit={(input) =>
          join.mutate(input, {
            onSuccess: () => {
              toast({ title: "You're on the waitlist", variant: "success" });
              router.push("/bookings/waitlist");
            },
            onError: (e: unknown) =>
              toast({ title: (e as Error).message ?? "Could not join", variant: "danger" }),
          })
        }
        onCancel={() => router.back()}
      />
    </div>
  );
}
