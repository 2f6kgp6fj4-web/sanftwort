import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WEB_URL } from "../lib/api";
import { useApp } from "../lib/app-state";
import { manageSubscriptions, restore } from "../lib/purchases";
import { prefs } from "../lib/storage";
import { radius, space, useColors } from "../lib/theme";
import { Button } from "../components/ui";

function Row({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.row, { borderColor: c.line, opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={20} color={c.ink} />
      <Text style={[s.rowText, { color: c.ink }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={c.muted} />
    </Pressable>
  );
}

export default function Settings() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const app = useApp();
  const pro = !!app.status?.pro;

  const invite = () =>
    Share.share({
      message:
        "Kleine Bitte: Wie möchtest du Kritik oder schwierige Themen von mir am liebsten hören? Ein, zwei Sätze reichen – z. B. direkt, nicht vor anderen, lieber mit Vorschlag. Ich nutze das, damit ich fairer schreibe.",
    }).catch(() => {});

  const doRestore = async () => {
    try {
      if (await restore()) {
        await app.refresh(true);
        Alert.alert("Wiederhergestellt", "Sanftwort Plus ist aktiv.");
      } else Alert.alert("Nichts gefunden", "Zu deinem Store-Konto gibt es kein aktives Sanftwort Plus.");
    } catch {
      Alert.alert("Wiederherstellen fehlgeschlagen", "Bitte versuch es später nochmal.");
    }
  };

  const reset = () =>
    Alert.alert("Einstellungen zurücksetzen?", "Schreibstil, Partner-Profil und deine Einwilligung werden auf diesem Gerät gelöscht.", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Zurücksetzen",
        style: "destructive",
        onPress: async () => {
          await prefs.resetAll();
          app.setStyle("");
          app.setProfile("");
          await app.setConsent(false);
          router.replace("/onboarding");
        },
      },
    ]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: space(5), paddingBottom: insets.bottom + space(8), gap: space(6) }}
    >
      <View style={s.top}>
        <Text style={[s.h1, { color: c.ink }]}>Einstellungen</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Schließen" hitSlop={12}>
          <Ionicons name="close" size={28} color={c.muted} />
        </Pressable>
      </View>

      <View style={[s.plan, { backgroundColor: pro ? c.coolBg : c.card, borderColor: pro ? c.cool : c.line }]}>
        <Text style={[s.planTitle, { color: c.ink }]}>{pro ? "Sanftwort Plus ist aktiv" : "Gratis-Version"}</Text>
        <Text style={[s.help, { color: c.muted }]}>
          {pro
            ? "Unbegrenzt formulieren. Mit Familienfreigabe kann dein Partner Plus mitnutzen."
            : `${app.status?.left ?? "–"} von ${app.status?.free ?? 5} Nachrichten diese Woche frei.`}
        </Text>
        {pro ? (
          <Button kind="ghost" title="Abo verwalten" onPress={manageSubscriptions} />
        ) : (
          <Button kind="ghost" title="Plus ansehen" onPress={() => router.push("/paywall")} />
        )}
      </View>

      <View style={{ gap: space(2) }}>
        <Text style={[s.h2, { color: c.ink }]}>Klingt nach dir</Text>
        <Text style={[s.help, { color: c.muted }]}>Füg zwei, drei Nachrichten ein, wie du sonst schreibst. Dann passt Sanftwort Wortwahl, Länge und Emojis an.</Text>
        <TextInput
          value={app.style}
          onChangeText={app.setStyle}
          multiline
          maxLength={600}
          placeholder="hey, bin gleich da 😅 holst du noch milch?"
          placeholderTextColor={c.muted}
          style={[s.input, { color: c.ink, borderColor: c.line, backgroundColor: c.card }]}
        />
      </View>

      <View style={{ gap: space(2) }}>
        <Text style={[s.h2, { color: c.ink }]}>So hört dein Partner Kritik am liebsten</Text>
        <Text style={[s.help, { color: c.muted }]}>Wird bei Nachrichten an deinen Partner berücksichtigt. Am besten fragst du direkt nach.</Text>
        <TextInput
          value={app.profile}
          onChangeText={app.setProfile}
          multiline
          maxLength={600}
          placeholder="Direkt, aber nicht vor anderen. Kein „immer“. Lieber mit konkretem Vorschlag."
          placeholderTextColor={c.muted}
          style={[s.input, { color: c.ink, borderColor: c.line, backgroundColor: c.card }]}
        />
        <Button kind="ghost" title="Partner fragen" onPress={invite} icon={<Ionicons name="paper-plane-outline" size={17} color={c.ink} />} />
      </View>

      <View style={{ gap: space(2) }}>
        <Text style={[s.h2, { color: c.ink }]}>Aus WhatsApp teilen</Text>
        <Text style={[s.help, { color: c.muted }]}>
          Nachricht lange drücken → Weiterleiten- oder Teilen-Symbol → „Sanftwort“. Erscheint Sanftwort nicht, tippe im
          Teilen-Menü auf „Mehr“ und schalte es ein. Auf dem iPhone kannst du auch Text markieren → „Teilen…“.
        </Text>
      </View>

      <View>
        {!pro ? <Row icon="refresh-outline" label="Käufe wiederherstellen" onPress={doRestore} /> : null}
        <Row icon="shield-checkmark-outline" label="Datenschutz" onPress={() => Linking.openURL(`${WEB_URL}/datenschutz.html`)} />
        <Row icon="document-text-outline" label="Impressum" onPress={() => Linking.openURL(`${WEB_URL}/impressum.html`)} />
        <Row icon="mail-outline" label="Feedback senden" onPress={() => Linking.openURL("mailto:Alex.rechling@gmx.de?subject=Sanftwort%20Feedback")} />
        <Row icon="trash-outline" label="Einstellungen zurücksetzen" onPress={reset} />
      </View>

      <Text style={[s.small, { color: c.muted }]}>
        Sanftwort {Constants.expoConfig?.version} · Texte werden nicht gespeichert.{"\n"}Kein Ersatz für Paarberatung oder Therapie. In Krisen:
        TelefonSeelsorge 0800 111 0 111 · Hilfetelefon Gewalt gegen Frauen 116 016.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  h1: { fontSize: 28, fontWeight: "800", letterSpacing: -0.6 },
  h2: { fontSize: 17, fontWeight: "700" },
  help: { fontSize: 14, lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: radius.m, padding: space(3), minHeight: 84, fontSize: 16, lineHeight: 22, textAlignVertical: "top" },
  plan: { borderWidth: 1, borderRadius: radius.l, padding: space(4), gap: space(2.5) },
  planTitle: { fontSize: 18, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: space(3), paddingVertical: space(3.5), borderBottomWidth: StyleSheet.hairlineWidth },
  rowText: { flex: 1, fontSize: 16 },
  small: { fontSize: 12, lineHeight: 17, textAlign: "center" },
});
