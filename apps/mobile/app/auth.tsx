/**
 * Functional (intentionally unstyled) mobile auth screen. Email+password
 * sign-in / sign-up plus a magic-link option, driven by the shared core auth
 * helpers and the session provider's Supabase client.
 *
 * The design agent owns the styled treatment; this proves the flow works.
 */
import { useState } from "react";
import { Alert, Button, Text, TextInput, View } from "react-native";
import {
  signInWithPassword,
  signUpWithPassword,
  signInWithMagicLink,
} from "@inkd/core/auth";

import { useSession } from "@/providers/session";

type Mode = "sign-in" | "sign-up";

export default function AuthScreen() {
  const { supabase } = useSession();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    try {
      if (mode === "sign-up") {
        const { error } = await signUpWithPassword(supabase, {
          email,
          password,
          displayName: displayName || undefined,
        });
        if (error) throw error;
        Alert.alert("Almost there", "Check your email to confirm your account.");
        setMode("sign-in");
      } else {
        const { error } = await signInWithPassword(supabase, { email, password });
        if (error) throw error;
        // Navigation is handled by the session provider / route guards.
      }
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Try again.");
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
      Alert.alert("Sent", "Check your email for a magic link.");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 22, color: "#fff", marginBottom: 8 }}>
        {mode === "sign-in" ? "Sign in" : "Create account"}
      </Text>

      {mode === "sign-up" && (
        <TextInput
          placeholder="Name"
          placeholderTextColor="#888"
          value={displayName}
          onChangeText={setDisplayName}
          style={{ borderWidth: 1, borderColor: "#333", color: "#fff", padding: 12 }}
        />
      )}

      <TextInput
        placeholder="Email"
        placeholderTextColor="#888"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, borderColor: "#333", color: "#fff", padding: 12 }}
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor="#888"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, borderColor: "#333", color: "#fff", padding: 12 }}
      />

      <Button
        title={pending ? "Working…" : mode === "sign-in" ? "Sign in" : "Sign up"}
        onPress={submit}
        disabled={pending}
      />
      <Button title="Email me a magic link" onPress={magicLink} disabled={pending || !email} />
      <Button
        title={
          mode === "sign-in"
            ? "Need an account? Sign up"
            : "Have an account? Sign in"
        }
        onPress={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
      />
    </View>
  );
}
