/**
 * Shop dashboard (mobile mirror of apps/web/src/components/shop/ShopDashboardView).
 * Owner-only: roster + invites, the managed-members calendar read, the shop's
 * own profile editor, and its locations (shared with the owner artist's studio
 * locations). Guarded like other /studio screens via <ArtistOnly>.
 */
import { useMemo, useState } from "react";
import { router } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Icon,
  Input,
  Spinner,
  Tabs,
  TextArea,
  Toggle,
  ToastProvider,
  useToast,
} from "@inkd/ui/native";
import {
  SHOP_MEMBER_ROLES,
  SHOP_MEMBERSHIP_MODES,
  shopMemberCapabilities,
  useCurrentArtistProfile,
  useMyShop,
  useShopManagedAgenda,
  useShopMemberMutations,
  useShopMutations,
  useShopRoster,
  type ShopMemberRole,
  type ShopMembershipMode,
  type ShopRosterMember,
} from "@inkd/core";
import { LocationsEditor, PickerSelect } from "@/components/artist";

import { ScreenHeader } from "@/components/ScreenHeader";
import { ArtistOnly } from "@/components/ArtistOnly";
import { useTheme } from "@/providers/theme";

const TABS = [
  { value: "roster", label: "Roster" },
  { value: "calendar", label: "Managed calendar" },
  { value: "profile", label: "Shop profile" },
  { value: "locations", label: "Locations" },
];

export default function ShopDashboardScreen() {
  return (
    <ArtistOnly>
      <ToastProvider>
        <ShopDashboardContent />
      </ToastProvider>
    </ArtistOnly>
  );
}

function ShopDashboardContent() {
  const { colors } = useTheme();
  const { data: artist, isLoading: aLoading } = useCurrentArtistProfile();
  const { data: shop, isLoading: sLoading } = useMyShop();
  const [tab, setTab] = useState("roster");

  if (aLoading || sLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface-base">
        <Spinner size="large" />
      </SafeAreaView>
    );
  }

  if (!artist || !shop) {
    return (
      <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
        <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 py-8">
          <ScreenHeader eyebrow="Shop" title="Shop" subtitle="Run a shop that hosts other artists." />
          <Card padding="lg" className="items-start gap-4">
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-surface-overlay">
              <Icon name="layout-grid" size={22} color={colors.text.accent} />
            </View>
            <View className="gap-1.5">
              <Text className="font-display text-xl text-content-primary">Create your shop</Text>
              <Text className="max-w-md text-content-secondary">
                Turn your artist account into a shop that hosts other artists — as a promotional
                showcase or a full management layer.
              </Text>
            </View>
            <Button onPress={() => router.push("/settings")}>
              Set up a shop
              <Icon name="arrow-right" size={16} color={colors.text.primary} />
            </Button>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-6 py-6">
        <View className="gap-3">
          <View className="flex-row items-center gap-3">
            <Avatar src={shop.avatar_url ?? undefined} name={shop.name} size="lg" shape="square" />
            <View className="flex-1 gap-0.5">
              <Text className="font-display text-2xl text-content-primary">{shop.name}</Text>
              <Text className="font-mono text-sm text-content-muted">@{shop.handle}</Text>
            </View>
          </View>
          <View className="flex-row flex-wrap items-center gap-2">
            <Badge variant={shop.is_published ? "success" : "neutral"}>
              {shop.is_published ? "Published" : "Draft"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onPress={() => router.push(`/shop/${shop.handle}` as never)}
            >
              View public page
              <Icon name="arrow-right" size={15} color={colors.text.secondary} />
            </Button>
          </View>
        </View>

        <Tabs value={tab} onValueChange={setTab} items={TABS} />

        {tab === "roster" && <RosterTab shopId={shop.id} />}
        {tab === "calendar" && <ManagedCalendarTab shopId={shop.id} />}
        {tab === "profile" && <ProfileTab shopId={shop.id} />}
        {tab === "locations" && <LocationsEditor artist={artist} variant="settings" />}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------
function RosterTab({ shopId }: { shopId: string }) {
  const { data: roster, isLoading } = useShopRoster(shopId);
  const members = roster ?? [];
  const owner = members.find((m) => m.role === "owner");
  const active = members.filter((m) => m.role !== "owner" && m.status === "active");
  const invited = members.filter((m) => m.status === "invited");

  return (
    <View className="gap-8">
      <InviteForm shopId={shopId} />

      {isLoading ? (
        <Spinner size="large" />
      ) : (
        <>
          {invited.length > 0 && (
            <View className="gap-3">
              <Text className="font-mono text-xs uppercase tracking-wide text-content-muted">
                Pending invites
              </Text>
              {invited.map((m) => (
                <MemberRow key={m.id} member={m} shopId={shopId} />
              ))}
            </View>
          )}

          <View className="gap-3">
            <Text className="font-mono text-xs uppercase tracking-wide text-content-muted">
              Roster
            </Text>
            {owner && <MemberRow member={owner} shopId={shopId} readOnly />}
            {active.length === 0 && !owner ? (
              <Card padding="md">
                <Text className="text-sm text-content-secondary">
                  No members yet — invite an artist above.
                </Text>
              </Card>
            ) : (
              active.map((m) => <MemberRow key={m.id} member={m} shopId={shopId} />)
            )}
          </View>
        </>
      )}
    </View>
  );
}

function InviteForm({ shopId }: { shopId: string }) {
  const { colors } = useTheme();
  const { toast } = useToast();
  const { inviteByHandle } = useShopMemberMutations(shopId);
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState<ShopMemberRole>("resident");
  const [mode, setMode] = useState<ShopMembershipMode>("promotional");

  const roleOptions = SHOP_MEMBER_ROLES.filter((r) => r.value !== "owner").map((r) => ({
    value: r.value,
    label: r.label,
  }));
  const modeOptions = SHOP_MEMBERSHIP_MODES.map((m) => ({ value: m.value, label: m.label }));

  async function submit() {
    if (!handle.trim()) return;
    try {
      const result = await inviteByHandle.mutateAsync({
        handleOrEmail: handle.trim(),
        role,
        membershipMode: mode,
      });
      if (result && "error" in result) {
        toast({ title: "Couldn't send invite", description: result.error, variant: "danger" });
        return;
      }
      setHandle("");
      toast({ title: "Invite sent", description: "They'll get a notification to accept.", variant: "success" });
    } catch (err) {
      toast({
        title: "Couldn't send invite",
        description: err instanceof Error ? err.message : String(err),
        variant: "danger",
      });
    }
  }

  return (
    <Card padding="lg" className="gap-4">
      <View className="gap-1">
        <Text className="font-display text-lg text-content-primary">Invite an artist</Text>
        <Text className="text-sm text-content-secondary">
          Invite by @handle or email. They must accept before they join — you can&apos;t add anyone
          unilaterally.
        </Text>
      </View>
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-content-secondary">Handle or email</Text>
        <Input
          value={handle}
          onChangeText={setHandle}
          placeholder="@artist or artist@email.com"
          autoCapitalize="none"
        />
      </View>
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-content-secondary">Role</Text>
        <PickerSelect value={role} onValueChange={(v) => setRole(v as ShopMemberRole)} options={roleOptions} title="Choose a role" />
      </View>
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-content-secondary">Mode</Text>
        <PickerSelect value={mode} onValueChange={(v) => setMode(v as ShopMembershipMode)} options={modeOptions} title="Choose a mode" />
        <Text className="text-xs text-content-muted">
          {SHOP_MEMBERSHIP_MODES.find((m) => m.value === mode)?.description}
        </Text>
      </View>
      <Button onPress={() => void submit()} loading={inviteByHandle.isPending} className="self-start">
        <Icon name="plus" size={16} color={colors.text.primary} />
        Send invite
      </Button>
    </Card>
  );
}

function MemberRow({
  member,
  shopId,
  readOnly = false,
}: {
  member: ShopRosterMember;
  shopId: string;
  readOnly?: boolean;
}) {
  const { colors } = useTheme();
  const { toast } = useToast();
  const { setRole, setMode, remove } = useShopMemberMutations(shopId);
  const profile = member.artist?.profile;
  const name = profile?.display_name || (profile?.handle ? `@${profile.handle}` : "Artist");
  const caps = shopMemberCapabilities(member);

  const roleOptions = SHOP_MEMBER_ROLES.filter((r) => r.value !== "owner").map((r) => ({
    value: r.value,
    label: r.label,
  }));
  const modeOptions = SHOP_MEMBERSHIP_MODES.map((m) => ({ value: m.value, label: m.label }));

  return (
    <Card padding="md" className="gap-3">
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <View className="flex-row items-center gap-3">
          <Avatar src={profile?.avatar_url ?? undefined} name={name} size="md" />
          <View className="gap-0.5">
            <Text className="text-sm font-sans-semibold text-content-primary">{name}</Text>
            {profile?.handle && (
              <Text className="font-mono text-xs text-content-muted">@{profile.handle}</Text>
            )}
          </View>
        </View>
        <View className="flex-row items-center gap-1.5">
          {member.status === "invited" && (
            <Badge variant="warning" size="sm">
              Invited
            </Badge>
          )}
          {member.role === "owner" && (
            <Badge variant="ember" size="sm">
              Owner
            </Badge>
          )}
          {caps.shopCanViewAgenda && (
            <Badge variant="brand" size="sm">
              <Icon name="calendar" size={12} color={colors.text.primary} />
              <Text className="ml-1 text-xs text-brand-on">Calendar shared</Text>
            </Badge>
          )}
        </View>
      </View>

      {!readOnly && (
        <View className="gap-3">
          <View className="flex-row gap-3">
            <View className="flex-1 gap-1.5">
              <Text className="text-xs font-medium text-content-muted">Role</Text>
              <PickerSelect
                size="sm"
                value={member.role}
                options={roleOptions}
                title="Choose a role"
                onValueChange={(v) =>
                  void setRole
                    .mutateAsync({ memberId: member.id, role: v as ShopMemberRole })
                    .catch((err) =>
                      toast({ title: "Couldn't update role", description: String(err), variant: "danger" }),
                    )
                }
              />
            </View>
            <View className="flex-1 gap-1.5">
              <Text className="text-xs font-medium text-content-muted">Mode</Text>
              <PickerSelect
                size="sm"
                value={member.membership_mode}
                options={modeOptions}
                title="Choose a mode"
                onValueChange={(v) =>
                  void setMode
                    .mutateAsync({ memberId: member.id, mode: v as ShopMembershipMode })
                    .catch((err) =>
                      toast({ title: "Couldn't update mode", description: String(err), variant: "danger" }),
                    )
                }
              />
            </View>
          </View>
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            loading={remove.isPending}
            onPress={() =>
              void remove
                .mutateAsync(member.id)
                .then(() => toast({ title: "Member removed", variant: "success" }))
                .catch((err) =>
                  toast({ title: "Couldn't remove", description: String(err), variant: "danger" }),
                )
            }
          >
            <Icon name="x" size={15} color="#F87171" />
            Remove
          </Button>
        </View>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Managed calendar
// ---------------------------------------------------------------------------
function ManagedCalendarTab({ shopId }: { shopId: string }) {
  const { colors } = useTheme();
  const { data: agenda, isLoading } = useShopManagedAgenda(shopId);
  const byMember = useMemo(() => {
    const rows = agenda ?? [];
    const map = new Map<string, { name: string; handle: string | null; rows: typeof rows }>();
    for (const r of rows) {
      const key = r.member_artist_id;
      if (!map.has(key)) map.set(key, { name: r.member_name ?? "Artist", handle: r.member_handle, rows: [] });
      map.get(key)!.rows.push(r);
    }
    return Array.from(map.values());
  }, [agenda]);

  return (
    <View className="gap-5">
      <Card padding="md" className="flex-row items-start gap-3">
        <Icon name="shield" size={18} color={colors.text.accent} />
        <Text className="flex-1 text-sm text-content-secondary">
          You only see the calendar of members on a <Text className="font-sans-semibold">managed</Text>{" "}
          membership who have accepted. Promotional members keep their bookings private.
        </Text>
      </Card>

      {isLoading ? (
        <Spinner size="large" />
      ) : byMember.length === 0 ? (
        <Card padding="lg">
          <Text className="text-sm text-content-secondary">
            No upcoming sessions from managed members yet.
          </Text>
        </Card>
      ) : (
        byMember.map((m) => (
          <View key={m.handle ?? m.name} className="gap-2">
            <Text className="text-sm font-sans-semibold text-content-primary">{m.name}</Text>
            <Card padding="none">
              {m.rows.map((r, i) => (
                <View
                  key={r.session_id}
                  className={`flex-row items-center justify-between gap-3 px-4 py-3 ${
                    i > 0 ? "border-t border-border-subtle" : ""
                  }`}
                >
                  <Text className="text-sm text-content-secondary">
                    Session #{r.session_number ?? "—"}
                  </Text>
                  <Text className="font-mono text-sm text-content-primary">
                    {r.scheduled_start
                      ? new Date(r.scheduled_start).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "Unscheduled"}
                  </Text>
                  <Badge variant="neutral" size="sm">
                    {r.session_status}
                  </Badge>
                </View>
              ))}
            </Card>
          </View>
        ))
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Shop profile
// ---------------------------------------------------------------------------
function ProfileTab({ shopId }: { shopId: string }) {
  const { toast } = useToast();
  const { data: shop } = useMyShop();
  const { update, setPublished, remove } = useShopMutations();
  const [name, setName] = useState(shop?.name ?? "");
  const [bio, setBio] = useState(shop?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(shop?.avatar_url ?? "");

  if (!shop) return null;

  async function save() {
    try {
      await update.mutateAsync({
        shopId,
        patch: {
          name: name.trim(),
          bio: bio.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        },
      });
      toast({ title: "Shop saved", variant: "success" });
    } catch (err) {
      toast({
        title: "Couldn't save",
        description: err instanceof Error ? err.message : String(err),
        variant: "danger",
      });
    }
  }

  return (
    <View className="gap-6">
      <Card padding="lg" className="gap-4">
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-content-secondary">Shop name</Text>
          <Input value={name} onChangeText={setName} />
        </View>
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-content-secondary">Handle</Text>
          <Input value={shop.handle} editable={false} />
          <Text className="text-xs text-content-muted">Your public page is /shop/{shop.handle}</Text>
        </View>
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-content-secondary">Bio</Text>
          <TextArea value={bio} onChangeText={setBio} numberOfLines={4} />
        </View>
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-content-secondary">Avatar URL</Text>
          <Input value={avatarUrl} onChangeText={setAvatarUrl} placeholder="https://…" autoCapitalize="none" />
        </View>
        <Button onPress={() => void save()} loading={update.isPending} className="self-start">
          Save shop
        </Button>
      </Card>

      <Card padding="lg" className="flex-row items-center justify-between gap-4">
        <View className="flex-1 gap-1">
          <Text className="text-sm font-medium text-content-primary">Publish shop</Text>
          <Text className="text-sm text-content-secondary">
            When published, your shop appears in Discover and its public page is live.
          </Text>
        </View>
        <Toggle
          checked={shop.is_published}
          onCheckedChange={(v) =>
            void setPublished
              .mutateAsync({ shopId, isPublished: v })
              .then(() => toast({ title: v ? "Shop published" : "Shop unpublished", variant: "success" }))
              .catch((err) => toast({ title: "Couldn't update", description: String(err), variant: "danger" }))
          }
        />
      </Card>

      <Card padding="lg" className="gap-3 border-danger-500/40 bg-danger-500/5">
        <Text className="text-sm font-medium text-danger-500">Delete shop</Text>
        <Text className="text-sm text-content-secondary">
          Removes the shop and its roster. Member artists&apos; own accounts and data are untouched.
        </Text>
        <Button
          variant="outline"
          className="self-start border-danger-500/50"
          loading={remove.isPending}
          onPress={() =>
            void remove
              .mutateAsync(shopId)
              .then(() => {
                toast({ title: "Shop deleted", variant: "success" });
                router.replace("/studio");
              })
              .catch((err) =>
                toast({ title: "Couldn't delete", description: String(err), variant: "danger" }),
              )
          }
        >
          <Icon name="alert-triangle" size={15} color="#F87171" />
          Delete shop
        </Button>
      </Card>
    </View>
  );
}
