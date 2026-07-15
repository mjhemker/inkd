/**
 * "Start a conversation" entry point (`/messages/new?to=<profileId>`). Resolves
 * which side of the thread is the artist vs. the client from the two profiles
 * involved, then finds an existing thread between them or creates one.
 *
 * `threads.artist_id` references `artist_profiles.id` while `threads.client_id`
 * references `profiles.id` directly (SPEC §2 data model), so the caller-facing
 * "profileId" the route receives has to be resolved against `artist_profiles`
 * before we know which column it belongs in.
 */
import type { InkdSupabaseClient } from "../supabase/client";
import type { Thread } from "../types/rows";
import { getArtistProfileByProfileId } from "./artistProfiles";
import { createThread } from "./messaging";
import { unwrapMaybe } from "./helpers";

export class ThreadStartError extends Error {}

export interface ResolveThreadParams {
  /** The signed-in viewer's `profiles.id`. */
  currentProfileId: string;
  /** The signed-in viewer's `artist_profiles.id`, if they have one. */
  currentArtistProfileId?: string | null;
  /** The `profiles.id` of the person the viewer wants to message. */
  targetProfileId: string;
}

async function findExistingThread(
  client: InkdSupabaseClient,
  artistId: string,
  clientId: string,
): Promise<Thread | null> {
  return unwrapMaybe(
    await client
      .from("threads")
      .select("*")
      .eq("artist_id", artistId)
      .eq("client_id", clientId)
      .maybeSingle(),
  );
}

/**
 * Find (or create) the thread between the current viewer and `targetProfileId`.
 * Whichever side has an `artist_profiles` row becomes the thread's artist; the
 * other becomes the client. Throws `ThreadStartError` if neither side is an
 * artist (threads always need exactly one), or if the ids match.
 */
export async function resolveAndStartThread(
  client: InkdSupabaseClient,
  { currentProfileId, currentArtistProfileId, targetProfileId }: ResolveThreadParams,
): Promise<Thread> {
  if (!targetProfileId) {
    throw new ThreadStartError("Missing the person to message.");
  }
  if (targetProfileId === currentProfileId) {
    throw new ThreadStartError("You can't start a thread with yourself.");
  }

  const targetArtist = await getArtistProfileByProfileId(client, targetProfileId);

  let artistId: string | null = null;
  let clientId: string | null = null;

  if (targetArtist) {
    artistId = targetArtist.id;
    clientId = currentProfileId;
  } else if (currentArtistProfileId) {
    artistId = currentArtistProfileId;
    clientId = targetProfileId;
  }

  if (!artistId || !clientId) {
    throw new ThreadStartError(
      "This conversation needs an artist on one side — that profile isn't an artist yet.",
    );
  }

  const existing = await findExistingThread(client, artistId, clientId);
  if (existing) return existing;

  return createThread(client, { artist_id: artistId, client_id: clientId });
}
