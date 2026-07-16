/**
 * Auth screen: email+password sign-in and sign-up plus a passwordless
 * magic-link option, styled to match the INKD dark gallery aesthetic used
 * across the app shells. All logic — zod validation via the shared core auth
 * helpers, magic link, error states — is unchanged from the functional pass;
 * this is a reskin using @inkd/ui/native.
 */
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  signInWithPassword,
  signUpWithPassword,
  signInWithMagicLink,
  getCurrentProfile,
  getCurrentArtistProfile,
} from "@inkd/core/auth";
import {
  Button,
  Card,
  CardContent,
  Eyebrow,
  FormField,
  Icon,
  Input,
  Tabs,
  ToastProvider,
  useToast,
} from "@inkd/ui/native";

import { useSession } from "@/providers/session";

type Mode = "sign-in" | "sign-up";

export default function AuthScreen() {
  return (
    <ToastProvider>
      <AuthForm />
    </ToastProvider>
  );
}

function AuthForm() {
  const { supabase } = useSession();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [accountType, setAccountType] = useState<"client" | "artist">("client");
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    try {
      if (mode === "sign-up") {
        const { error } = await signUpWithPassword(supabase, {
          email,
          password,
          displayName: displayName || undefined,
          accountType,
        });
        if (error) throw error;
        toast({
          title: "Almost there",
          description: "Check your email to confirm your account.",
          variant: "success",
        });
        setMode("sign-in");
      } else {
        const { error } = await signInWithPassword(supabase, { email, password });
        if (error) throw error;
        // Route by role + onboarding state, mirroring the web auth callback:
        // artist mid-onboarding → onboarding; everyone else → the shared feed.
        try {
          const profile = await getCurrentProfile(supabase);
          if (profile?.is_artist) {
            const artist = await getCurrentArtistProfile(supabase);
            if (!artist || !artist.onboarding_completed_at) {
              router.replace("/onboarding");
            } else {
              router.replace("/dashboard");
            }
          } else {
            router.replace("/(tabs)");
          }
        } catch {
          router.replace("/(tabs)");
        }
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "danger",
      });
    } finally {
      setPending(false);
    }
  }

  async function magicLink() {
    setPending(true);
    try {
      const { error } = await signInWithMagicLink(supabase, {
        email,
        emailRedirectTo: "inkd://auth-callback",
      });
      if (error) throw error;
      toast({
        title: "Sent",
        description: "Check your email for a magic link.",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "danger",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-base" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-grow justify-center gap-8 px-6 py-10"
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand">
              <Text className="font-display text-xl font-extrabold text-brand-on">
                I
              </Text>
            </View>
            <Eyebrow>Baltimore &middot; Philadelphia</Eyebrow>
            <Text className="text-center font-display text-3xl text-content-primary">
              Welcome to INKD
            </Text>
            <Text className="text-center text-sm text-content-secondary">
              One account for artists and clients.
            </Text>
          </View>

          <Card padding="lg">
            <Tabs
              value={mode}
              onValueChange={(value) => setMode(value as Mode)}
              items={[
                { value: "sign-in", label: "Sign in" },
                { value: "sign-up", label: "Create account" },
              ]}
              className="-mx-5 mb-6 px-5"
            />

            <CardContent className="gap-5">
              {mode === "sign-up" && (
                <FormField label="I'm joining as">
                  <View className="flex-row gap-2.5">
                    {(
                      [
                        { value: "client", title: "I'm getting tattooed", icon: "user" },
                        { value: "artist", title: "I'm a tattoo artist", icon: "sparkles" },
                      ] as const
                    ).map((opt) => {
                      const selected = accountType === opt.value;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => setAccountType(opt.value)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          className={`flex-1 gap-2 rounded-xl border p-3 ${
                            selected
                              ? "border-border-accent bg-surface-overlay"
                              : "border-border-subtle"
                          }`}
                        >
                          <View
                            className={`h-8 w-8 items-center justify-center rounded-lg ${
                              selected ? "bg-brand" : "bg-surface-raised"
                            }`}
                          >
                            <Icon
                              name={opt.icon}
                              size={16}
                              color={selected ? "#0A0A0B" : "#71717A"}
                            />
                          </View>
                          <Text className="text-sm font-sans-semibold text-content-primary">
                            {opt.title}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </FormField>
              )}
              {mode === "sign-up" && (
                <FormField label="Name">
                  <Input
                    placeholder="Your name"
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoComplete="name"
                    leadingIcon={<Icon name="user" size={16} color="#71717A" />}
                  />
                </FormField>
              )}

              <FormField label="Email" required>
                <Input
                  placeholder="you@studio.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  leadingIcon={
                    <Icon name="message-circle" size={16} color="#71717A" />
                  }
                />
              </FormField>

              <FormField label="Password" required description="At least 8 characters">
                <Input
                  placeholder="Your password"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  leadingIcon={<Icon name="shield" size={16} color="#71717A" />}
                  trailingIcon={
                    <Pressable
                      onPress={() => setShowPassword((v) => !v)}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                      hitSlop={8}
                    >
                      <Text className="font-mono text-[11px] uppercase tracking-wide text-content-muted">
                        {showPassword ? "Hide" : "Show"}
                      </Text>
                    </Pressable>
                  }
                />
              </FormField>

              <Button size="lg" onPress={submit} loading={pending} className="mt-1">
                {mode === "sign-in" ? "Sign in" : "Create account"}
              </Button>

              <View className="my-1 flex-row items-center gap-3">
                <View className="h-px flex-1 bg-border-subtle" />
                <Text className="font-mono text-[10px] uppercase tracking-[1.5px] text-content-muted">
                  Or
                </Text>
                <View className="h-px flex-1 bg-border-subtle" />
              </View>

              <Button
                variant="secondary"
                size="lg"
                onPress={magicLink}
                disabled={pending || !email}
                leadingIcon={<Icon name="sparkles" size={16} color="#FAFAFA" />}
              >
                Email me a magic link
              </Button>

              <Text className="text-center text-sm text-content-muted">
                {mode === "sign-in" ? "Need an account? " : "Have an account? "}
                <Text
                  className="font-sans-medium text-content-accent"
                  onPress={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
                >
                  {mode === "sign-in" ? "Sign up" : "Sign in"}
                </Text>
              </Text>
            </CardContent>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
