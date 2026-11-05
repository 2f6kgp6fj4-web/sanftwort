import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { WEB_URL } from "../lib/api";
import { useApp } from "../lib/app-state";
import { buy, loadPackages, purchasesAvailable, restore, type PurchasesPackage } from "../lib/purchases";
import { radius, space, useColors } from "../lib/theme";
import { Button } from "../components/ui";

const BENEFITS = [
  "Unbegrenzt formulieren und antworten",
  "Sprechen, einfügen oder aus WhatsApp teilen",
  "Klingt nach dir: Schreibstil und Partner-Profil",
  "Ein Abo für euch beide – per Familienfreigabe",
];

function periodLabel(p: PurchasesPackage) {
  switch (p.packageType) {
    case "ANNUAL":
      return "Jährlich";
    case "MONTHLY":
      return "Monatlich";
    case "WEEKLY":
      return "Wöchentlich";
    default:
      return p.product.title;
  }
}

function perMonth(p: PurchasesPackage) {
  if (p.packageType !== "ANNUAL" || !p.product.price) return "";
  const m = p.product.price / 12;
  try {
    return `${new Intl.NumberFormat("de-DE", { style: "currency", currency: p.product.currencyCode }).format(m)} im Monat`;
  } catch {
    return "";
  }
}

function trialLabel(p: PurchasesPackage) {
  const i = p.product.introPrice;
  if (!i || i.price !== 0) return "";
  const unit = { DAY: "Tage", WEEK: "Wochen", MONTH: "Monate", YEAR: "Jahre" }[i.periodUnit as string] || "";
  const n = i.periodNumberOfUnits;
  if (i.periodUnit === "WEEK" && n === 1) return "7 Tage gratis testen";
  return `${n} ${unit} gratis testen`;
}

export default function Paywall() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const app = useApp();
  const [pkgs, setPkgs] = useState<PurchasesPackage[] | null>(null);
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadPackages()
      .then((p) => setPkgs(p))
      .catch(() => setPkgs([]));
  }, []);

  const done = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await app.refresh(true);
    router.back();
  };

  const purchase = async () => {
    const p = pkgs?.[sel];
    if (!p) return;
    setBusy(true);
    try {
      if (await buy(p)) await done();
    } catch (e: any) {
      Alert.alert("Kauf nicht möglich", e?.message || "Bitte versuch es später nochmal.");
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async () => {
    setBusy(true);
    try {
      if (await restore()) await done();
      else Alert.alert("Nichts gefunden", "Zu deinem Store-Konto gibt es kein aktives Sanftwort Plus.");
    } catch (e: any) {
      Alert.alert("Wiederherstellen fehlgeschlagen", e?.message || "Bitte versuch es später nochmal.");
    } finally {
      setBusy(false);
    }
  };

  const left = app.status?.left;
  const chosen = pkgs?.[sel];
  const trial = chosen ? trialLabel(chosen) : "";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: space(4), paddingBottom: insets.bottom + space(6), paddingHorizontal: space(5), gap: space(5) }}
    >
      <View style={s.top}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Schließen" hitSlop={12}>
          <Ionicons name="close" size={28} color={c.muted} />
        </Pressable>
      </View>

      <View style={{ gap: space(2) }}>
        <Text style={[s.h1, { color: c.ink }]}>Sanftwort Plus</Text>
        <Text style={[s.lead, { color: c.muted }]}>
          {left === 0
            ? `Deine ${app.status?.free ?? 5} Gratis-Nachrichten diese Woche sind aufgebraucht. Nächste Woche gibt es neue – oder du machst jetzt einfach weiter.`
            : "Für alle, die im Alltag nicht mehr aneinander vorbeireden wollen."}
        </Text>
      </View>

      <View style={{ gap: space(3) }}>
        {BENEFITS.map((b) => (
          <View key={b} style={s.benefit}>
            <Ionicons name="checkmark-circle" size={22} color={c.cool} />
            <Text style={[s.bText, { color: c.ink }]}>{b}</Text>
          </View>
        ))}
      </View>

      {pkgs === null ? (
        <ActivityIndicator color={c.ink} />
      ) : !purchasesAvailable() || pkgs.length === 0 ? (
        <View style={[s.pkg, { borderColor: c.line, backgroundColor: c.card }]}>
          <Text style={[s.pTitle, { color: c.ink }]}>Gleich verfügbar</Text>
          <Text style={[s.pSub, { color: c.muted }]}>Die Abos werden gerade im App Store freigeschaltet. Bitte schau später nochmal vorbei.</Text>
        </View>
      ) : (
        <View style={{ gap: space(2.5) }}>
          {pkgs.map((p, i) => {
            const on = i === sel;
            const best = p.packageType === "ANNUAL";
            return (
              <Pressable
                key={p.identifier}
                onPress={() => setSel(i)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[s.pkg, { borderColor: on ? c.cool : c.line, borderWidth: on ? 2 : 1, backgroundColor: c.card }]}
              >
                {best ? (
                  <View style={[s.badge, { backgroundColor: c.cool }]}>
                    <Text style={s.badgeText}>Beliebteste Wahl</Text>
                  </View>
                ) : null}
                <View style={s.pkgRow}>
                  <View style={{ gap: 2, flex: 1 }}>
                    <Text style={[s.pTitle, { color: c.ink }]}>{periodLabel(p)}</Text>
                    {perMonth(p) ? <Text style={[s.pSub, { color: c.muted }]}>{perMonth(p)}</Text> : null}
                    {trialLabel(p) ? <Text style={[s.pSub, { color: c.cool }]}>{trialLabel(p)}</Text> : null}
                  </View>
                  <Text style={[s.price, { color: c.ink }]}>{p.product.priceString}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {purchasesAvailable() && pkgs && pkgs.length > 0 ? (
        <View style={{ gap: space(2) }}>
          <Button title={trial ? trial : "Weiter"} onPress={purchase} loading={busy} />
          <Text style={[s.fine, { color: c.muted }]}>
            {trial ? `Danach ${chosen?.product.priceString} pro ${chosen?.packageType === "ANNUAL" ? "Jahr" : "Monat"}. ` : ""}
            Verlängert sich automatisch, jederzeit in den Store-Einstellungen kündbar.
          </Text>
        </View>
      ) : null}

      <View style={s.links}>
        <Pressable onPress={doRestore} accessibilityRole="button">
          <Text style={[s.linkText, { color: c.muted }]}>Käufe wiederherstellen</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")} accessibilityRole="link">
          <Text style={[s.linkText, { color: c.muted }]}>Nutzungsbedingungen</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(`${WEB_URL}/datenschutz.html`)} accessibilityRole="link">
          <Text style={[s.linkText, { color: c.muted }]}>Datenschutz</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "flex-end" },
  h1: { fontSize: 32, fontWeight: "800", letterSpacing: -0.8 },
  lead: { fontSize: 16, lineHeight: 23 },
  benefit: { flexDirection: "row", gap: space(3), alignItems: "center" },
  bText: { flex: 1, fontSize: 16, lineHeight: 22 },
  pkg: { borderRadius: radius.l, padding: space(4), gap: space(1) },
  pkgRow: { flexDirection: "row", alignItems: "center", gap: space(3) },
  badge: { position: "absolute", top: -11, left: 14, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  pTitle: { fontSize: 17, fontWeight: "700" },
  pSub: { fontSize: 14 },
  price: { fontSize: 18, fontWeight: "800" },
  fine: { fontSize: 12, lineHeight: 17, textAlign: "center" },
  links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space(4) },
  linkText: { fontSize: 13, textDecorationLine: "underline" },
});
