import "../global.css";

import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "@/providers/session";
import { ThemeProvider, useTheme } from "@/providers/theme";
import { PushSync } from "@/components/PushSync";
import {
  useFonts,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from "@expo-google-fonts/bricolage-grotesque";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from "@expo-google-fonts/jetbrains-mono";
import {
  Caveat_600SemiBold,
  Caveat_700Bold,
} from "@expo-google-fonts/caveat";

// Hold the native splash until the brand faces are registered — text should
// never flash in a fallback system font. See tailwind.config.js for the family
// names these register under (font-display, font-sans*, font-mono*).
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    Caveat_600SemiBold,
    Caveat_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SessionProvider>
          <ThemedRoot />
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * Reads the active theme so the StatusBar contrast and the router's default
 * screen background follow Dark / Light. Kept as a child of ThemeProvider.
 */
function ThemedRoot() {
  const { resolved, colors } = useTheme();
  return (
    <>
      <StatusBar style={resolved === "light" ? "dark" : "light"} />
      {/* Headless: registers the Expo push token on login + routes taps. */}
      <PushSync />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface.base },
        }}
      />
    </>
  );
}
