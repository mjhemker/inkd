/**
 * Settings → Shop (mobile mirror of apps/web/src/components/shop/ShopSettingsPanel).
 * Two jobs: 1) become / manage a shop (an artist-account capability, one shop
 * per profile), 2) respond to invites from OTHER shops and see the shops you
 * belong to.
 */
import { useState } from "react";
import { router } from "expo-router";
import { Text, View } from "react-native";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Icon,
  Input,
  Spinner,
  TextArea,
  useToast,
} from "@inkd/ui/native";
import {
  shopModeLabel,
  useMyShop,
  useMyShopInvites,
  useMyShopMemberships,
  useShopInviteActions,
  useShopMutations,
} from "@inkd/core";
import { useTheme } from "@/providers/theme";

export function ShopSettingsSection() {
  const { data: shop, isLoading } = useMyShop();

  if (isLoading) {
    return (
      <View className="items-center justify-center py-10">
        <Spinner size="large" />
      </View>
    );
  }

  return (
    <View className="gap-8">
      {shop ? (
        <ManageShopCard
          shopName={shop.name}
          shopHandle={shop.handle}
          published={shop.is_published}
          avatarUrl={shop.avatar_url}
        />
      ) : (
        <CreateShopCard />
      )}
      <MyInvitesCard />
      <MyMembershipsCard />
    </View>
  );
}

function ManageShopCard({
  shopName,
  shopHandle,
  published,
  avatarUrl,
}: {
  shopName: string;
  shopHandle: string;
  published: boolean;
  avatarUrl: string | null;
}) {
  return (
    <Card padding="lg" className="gap-4">
      <View className="flex-row items-center gap-3">
        <Avatar src={avatarUrl ?? undefined} name={shopName} size="lg" shape="square" />
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-sans-semibold text-content-primary">{shopName}</Text>
          <Text className="font-mono text-sm text-content-muted">@{shopHandle}</Text>
        </View>
        <Badge variant={published ? "success" : "neutral"}>{published ? "Published" : "Draft"}</Badge>
      </View>
      <Text className="text-sm text-content-secondary">
        You own a shop. Manage its roster, membership modes, profile and locations from the shop
        dashboard.
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <Button onPress={() => router.push("/studio/shop")}>
          Manage shop
          <Icon name="arrow-right" size={16} color="#FAFAFA" />
        </Button>
        <Button variant="outline" onPress={() => router.push(`/shop/${shopHandle}` as never)}>
          View public page
        </Button>
      </View>
    </Card>
  );
}

function CreateShopCard() {
  const { colors } = useTheme();
  const { toast } = useToast();
  const { create } = useShopMutations();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");

  async function submit() {
    if (!name.trim() || !handle.trim()) return;
    try {
      await create.mutateAsync({
        name: name.trim(),
        handle: handle.trim().replace(/^@/, ""),
        bio: bio.trim() || null,
      });
      toast({ title: "Shop created", description: "Add your roster and publish when ready.", variant: "success" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: "Couldn't create shop",
        description: /duplicate|unique/i.test(msg) ? "That handle is taken." : msg,
        variant: "danger",
      });
    }
  }

  return (
    <Card padding="lg" className="gap-4">
      <View className="gap-1.5">
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-surface-overlay">
          <Icon name="layout-grid" size={22} color={colors.text.accent} />
        </View>
        <Text className="font-display text-xl text-content-primary">Create a shop</Text>
        <Text className="text-sm text-content-secondary">
          A shop is an artist account that hosts other artists — as a promotional showcase or a full
          management layer. You can run a shop and keep your own artist profile. One shop per account.
        </Text>
      </View>
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-content-secondary">Shop name</Text>
        <Input value={name} onChangeText={setName} placeholder="Fells Point Ink" />
      </View>
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-content-secondary">Handle</Text>
        <Input value={handle} onChangeText={setHandle} placeholder="fells-point-ink" autoCapitalize="none" />
        <Text className="text-xs text-content-muted">
          Your public page will be /shop/{handle.trim().replace(/^@/, "") || "your-shop"}
        </Text>
      </View>
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-content-secondary">Bio (optional)</Text>
        <TextArea value={bio} onChangeText={setBio} numberOfLines={3} />
      </View>
      <Button onPress={() => void submit()} loading={create.isPending} className="self-start">
        Create shop
      </Button>
    </Card>
  );
}

function MyInvitesCard() {
  const { toast } = useToast();
  const { data: invites, isLoading } = useMyShopInvites();
  const { accept, decline } = useShopInviteActions();
  if (isLoading || !invites || invites.length === 0) return null;

  return (
    <Card padding="lg" className="gap-4">
      <View className="gap-1">
        <Text className="font-display text-lg text-content-primary">Shop invites</Text>
        <Text className="text-sm text-content-secondary">
          Shops that invited you to join. You choose whether to accept.
        </Text>
      </View>
      {invites.map((invite) => (
        <View
          key={invite.id}
          className="flex-row flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4"
        >
          <View className="flex-row items-center gap-3">
            <Avatar src={invite.shop?.avatar_url ?? undefined} name={invite.shop?.name ?? "Shop"} size="md" shape="square" />
            <View className="gap-0.5">
              <Text className="font-sans-semibold text-content-primary">{invite.shop?.name ?? "A shop"}</Text>
              <Text className="text-xs text-content-muted">
                Invited as {shopModeLabel(invite.membership_mode)} · {invite.role}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <Button
              size="sm"
              loading={accept.isPending}
              onPress={() =>
                void accept
                  .mutateAsync(invite.id)
                  .then(() => toast({ title: "Joined shop", variant: "success" }))
                  .catch((err) => toast({ title: "Couldn't accept", description: String(err), variant: "danger" }))
              }
            >
              <Icon name="check" size={15} color="#FAFAFA" />
              Accept
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onPress={() =>
                void decline
                  .mutateAsync(invite.id)
                  .then(() => toast({ title: "Invite declined" }))
                  .catch((err) => toast({ title: "Couldn't decline", description: String(err), variant: "danger" }))
              }
            >
              Decline
            </Button>
          </View>
        </View>
      ))}
    </Card>
  );
}

function MyMembershipsCard() {
  const { toast } = useToast();
  const { data: memberships, isLoading } = useMyShopMemberships();
  const { leave } = useShopInviteActions();
  // Hide the owner's own shop membership here (managed from the dashboard).
  const joined = (memberships ?? []).filter((m) => m.role !== "owner");
  if (isLoading || joined.length === 0) return null;

  return (
    <Card padding="lg" className="gap-4">
      <Text className="font-display text-lg text-content-primary">Shops you belong to</Text>
      {joined.map((m) => (
        <View
          key={m.id}
          className="flex-row flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4"
        >
          <View className="flex-row items-center gap-3">
            <Avatar src={m.shop?.avatar_url ?? undefined} name={m.shop?.name ?? "Shop"} size="md" shape="square" />
            <View className="gap-0.5">
              <Text
                onPress={() => m.shop?.handle && router.push(`/shop/${m.shop.handle}` as never)}
                className="font-sans-semibold text-content-primary"
              >
                {m.shop?.name ?? "A shop"}
              </Text>
              <Text className="text-xs text-content-muted">
                {shopModeLabel(m.membership_mode)} · {m.role}
              </Text>
            </View>
          </View>
          <Button
            variant="ghost"
            size="sm"
            loading={leave.isPending}
            onPress={() =>
              void leave
                .mutateAsync(m.id)
                .then(() => toast({ title: "Left shop", variant: "success" }))
                .catch((err) => toast({ title: "Couldn't leave", description: String(err), variant: "danger" }))
            }
          >
            Leave
          </Button>
        </View>
      ))}
    </Card>
  );
}
