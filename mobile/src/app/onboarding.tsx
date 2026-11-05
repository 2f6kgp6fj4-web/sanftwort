import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WEB_URL } from "../lib/api";
import { useApp } from "../lib/app-state";
import { radius, space, useColors } from "../lib/theme";
import { Button } from "../components/ui";

const POINTS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: "mic-outline", title: "Sag es, wie es ist", body: "Sprich oder tipp ungefiltert, was dich ärgert. Sanftwort macht daraus eine Nachricht, die ankommt statt verletzt." },
  { icon: "chatbubbles-outline", title: "Versteh, was gemeint ist", body: "Eine Nachricht hat dich getroffen? Du siehst, was dahinterstecken könnte, und bekommst eine ruhige Antwort." },
  { icon: "flask-outline", title: "Nach bewährten Modellen", body: "Gewaltfreie Kommunikation, Paarforschung nach Gottman und die BIFF-Methode – ohne Therapie-Sprech." },
  { icon: "share-outline", title: "Direkt aus WhatsApp", body: "Nachricht markieren, Teilen, Sanftwort. Antwort kopieren, fertig." },
];

export default function Onboarding() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const app = useApp();
  const [agreed, setAgreed] = useState(false);

  const start = async () => {
    await app.setConsent(true);
    router.replace("/");
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top + space(8), paddingBottom: insets.bottom + space(6), paddingHorizontal: space(5), gap: space(5) }}
    >
      <View style={{ gap: space(2) }}>
        <Text style={[s.h1, { color: c.ink }]}>Sag, was dich bewegt.{"\n"}
          <Text style={{ color: c.cool }}>Ohne zu verletzen.</Text>
        </Text>
        <Text style={[s.lead, { color: c.muted }]}>Dein Alltagshelfer für Nachrichten an Partner, Familie und alle, die dir wichtig sind.</Text>
      </View>

      <View style={{ gap: space(4) }}>
        {POINTS.map((p) => (
          <View key={p.title} style={s.point}>
            <View style={[s.iconWrap, { backgroundColor: c.coolBg }]}>
              <Ionicons name={p.icon} size={22} color={c.cool} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[s.pTitle, { color: c.ink }]}>{p.title}</Text>
              <Text style={[s.pBody, { color: c.muted }]}>{p.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[s.consent, { backgroundColor: c.card, borderColor: c.line }]}>
        <Text style={[s.cTitle, { color: c.ink }]}>So gehen wir mit deinen Texten um</Text>
        <Text style={[s.cBody, { color: c.ink }]}>
          Wenn du auf „Formulieren“ tippst, wird dein Text an unseren KI-Anbieter Anthropic (USA) übertragen, um die
          Vorschläge zu erstellen. Wir speichern deine Texte nicht und nutzen sie nicht für Werbung. Spracheingabe
          läuft über die Spracherkennung deines Geräts. Es gibt kein Konto.
        </Text>
        <Pressable onPress={() => Linking.openURL(`${WEB_URL}/datenschutz.html`)} accessibilityRole="link">
          <Text style={[s.link, { color: c.cool }]}>Datenschutzerklärung lesen</Text>
        </Pressable>
        <Pressable
          onPress={() => setAgreed((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          style={s.check}
        >
          <View style={[s.box, { borderColor: agreed ? c.cool : c.muted, backgroundColor: agreed ? c.cool : "transparent" }]}>
            {agreed ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
          </View>
          <Text style={[s.checkText, { color: c.ink }]}>Ich bin einverstanden, dass meine Texte dafür an Anthropic übertragen werden.</Text>
        </Pressable>
      </View>

      <Button title="Loslegen" onPress={start} disabled={!agreed} />
      <Text style={[s.small, { color: c.muted }]}>
        Sanftwort ersetzt keine Paarberatung oder Therapie. In Krisen: TelefonSeelsorge 0800 111 0 111.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 32, lineHeight: 38, fontWeight: "800", letterSpacing: -0.8 },
  lead: { fontSize: 17, lineHeight: 24 },
  point: { flexDirection: "row", gap: space(3), alignItems: "flex-start" },
  iconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  pTitle: { fontSize: 16, fontWeight: "700" },
  pBody: { fontSize: 15, lineHeight: 21 },
  consent: { borderWidth: 1, borderRadius: radius.l, padding: space(4), gap: space(2.5) },
  cTitle: { fontSize: 16, fontWeight: "700" },
  cBody: { fontSize: 14, lineHeight: 20 },
  link: { fontSize: 14, fontWeight: "600" },
  check: { flexDirection: "row", gap: space(3), alignItems: "center", paddingTop: space(1) },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  checkText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  small: { fontSize: 12, lineHeight: 17, textAlign: "center" },
});
