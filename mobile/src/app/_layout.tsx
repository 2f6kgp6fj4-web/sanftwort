import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ShareIntentProvider } from "expo-share-intent";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "../lib/app-state";
import { useColors } from "../lib/theme";

function Root() {
  const c = useColors();
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: "fade" }} />
        <Stack.Screen name="settings" options={{ presentation: "modal" }} />
        <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
      </Stack>
    </>
  );
}

export default function Layout() {
  return (
    <ShareIntentProvider options={{ resetOnBackground: false }}>
      <SafeAreaProvider>
        <AppProvider>
          <Root />
        </AppProvider>
      </SafeAreaProvider>
    </ShareIntentProvider>
  );
}
