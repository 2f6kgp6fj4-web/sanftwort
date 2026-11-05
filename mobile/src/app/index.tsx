import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from "react-native";
import { Redirect, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useShareIntentContext } from "expo-share-intent";
import { LimitError, RECIPIENTS, translate, type Mode, type Recipient, type Result } from "../lib/api";
import { useApp } from "../lib/app-state";
import { estimateHeat } from "../lib/heat";
import { prefs } from "../lib/storage";
import { radius, space, useColors } from "../lib/theme";
import { useDictation } from "../lib/useDictation";
import { ResultView } from "../components/ResultView";
import { Button, Chip, Segmented } from "../components/ui";

const MODES: { key: Mode; label: string }[] = [
  { key: "senden", label: "Ich will was sagen" },
  { key: "eingang", label: "Ich hab was bekommen" },
];

const COPY: Record<Mode, { placeholder: string; cta: string; busy: string; who: string }> = {
  senden: {
    placeholder: "Sag oder schreib, was dich gerade beschäftigt – ungefiltert. Z. B.: „Du hast SCHON WIEDER nicht Bescheid gesagt, dass du später kommst.“",
    cta: "Sanft formulieren",
    busy: "Kühle runter …",
    who: "An wen?",
  },
  eingang: {
    placeholder: "Füg die Nachricht ein, die du bekommen hast. Sanftwort zeigt dir, was dahintersteckt, und schlägt eine ruhige Antwort vor.",
    cta: "Verstehen & antworten",
    busy: "Lese mit …",
    who: "Von wem?",
  },
};

export default function Home() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const app = useApp();
  const share = useShareIntentContext();
  const scroll = useRef<ScrollViewInstance>(null);
  const resultY = useRef(0);

  const [mode, setMode] = useState<Mode>("senden");
  const [recipient, setRecipient] = useState<Recipient>("partner");
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const textRef = useRef(text);
  textRef.current = text;

  const dictation = useDictation(useCallback(() => textRef.current, []), setText);

  useEffect(() => {
    prefs.getRecipient().then((r) => RECIPIENTS.some((x) => x.key === r) && setRecipient(r as Recipient));
  }, []);

  // Text aus dem Teilen-Menü (z. B. aus WhatsApp) übernehmen
  useEffect(() => {
    if (share.hasShareIntent && share.shareIntent?.text) {
      setText(share.shareIntent.text.slice(0, 2000));
      setMode("eingang");
      setResult(null);
      setError("");
      share.resetShareIntent();
    }
  }, [share.hasShareIntent, share.shareIntent, share.resetShareIntent]);

  const pickRecipient = (r: Recipient) => {
    setRecipient(r);
    prefs.setRecipient(r);
  };

  const paste = async () => {
    const t = await Clipboard.getStringAsync().catch(() => "");
    if (t) {
      setText((prev) => (prev.trim() ? `${prev.trim()}\n${t}` : t).slice(0, 2000));
      setResult(null);
    }
  };

  const run = async (morelikeme = false) => {
    if (dictation.listening) dictation.stop();
    const t = text.trim();
    if (t.length < 3) {
      setError(mode === "senden" ? "Sag oder schreib erst, was dich beschäftigt." : "Füg erst die Nachricht ein.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await translate({
        mode,
        text: t,
        recipient,
        style: app.style || undefined,
        profile: mode === "senden" && recipient === "partner" ? app.profile || undefined : undefined,
        morelikeme,
      });
      setResult(r);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      app.refresh();
      setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, resultY.current - 12), animated: true }), 120);
    } catch (e: any) {
      if (e instanceof LimitError) router.push("/paywall");
      else setError(e?.message || "Das hat nicht geklappt.");
    } finally {
      setBusy(false);
    }
  };

  if (app.ready && !app.consent) return <Redirect href="/onboarding" />;

  const heat = mode === "senden" ? estimateHeat(text) : 0;
  const st = app.status;
  const pill = st?.pro ? "Plus" : st ? `${st.left ?? 0} von ${st.free} frei` : "";

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ paddingTop: insets.top + space(2), paddingBottom: insets.bottom + space(10), paddingHorizontal: space(4), gap: space(4) }}
      >
        <View style={s.header}>
          <View style={s.logo}>
            <View style={s.logoDot} />
            <Text style={[s.logoText, { color: c.ink }]}>Sanftwort</Text>
          </View>
          <View style={s.headerRight}>
            {pill ? (
              <Pressable
                onPress={() => router.push(st?.pro ? "/settings" : "/paywall")}
                accessibilityRole="button"
                accessibilityLabel={st?.pro ? "Sanftwort Plus aktiv" : `${pill}, mehr Übersetzungen freischalten`}
                style={[s.pill, { borderColor: st?.pro ? c.cool : c.line, backgroundColor: c.card }]}
              >
                <Text style={[s.pillText, { color: st?.pro ? c.cool : c.muted }]}>{pill}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => router.push("/settings")} accessibilityRole="button" accessibilityLabel="Einstellungen" hitSlop={10}>
              <Ionicons name="settings-outline" size={24} color={c.ink} />
            </Pressable>
          </View>
        </View>

        <Segmented
          options={MODES}
          value={mode}
          onChange={(m) => {
            setMode(m);
            setResult(null);
            setError("");
          }}
        />

        <View style={{ gap: space(2) }}>
          <Text style={[s.label, { color: c.muted }]}>{COPY[mode].who}</Text>
          <View style={s.chips}>
            {RECIPIENTS.map((r) => (
              <Chip key={r.key} label={r.label} active={recipient === r.key} onPress={() => pickRecipient(r.key)} />
            ))}
          </View>
        </View>

        <View style={[s.inputCard, { backgroundColor: c.card, borderColor: dictation.listening ? c.hot : c.line }]}>
          <TextInput
            value={text}
            onChangeText={(t) => {
              setText(t);
              if (result) setResult(null);
            }}
            placeholder={dictation.listening ? "Ich höre zu …" : COPY[mode].placeholder}
            placeholderTextColor={c.muted}
            multiline
            maxLength={2000}
            textAlignVertical="top"
            accessibilityLabel={mode === "senden" ? "Was du sagen willst" : "Die Nachricht, die du bekommen hast"}
            style={[s.input, { color: c.ink }]}
          />
          {mode === "senden" ? (
            <View style={s.meter} accessible accessibilityLabel={`Geschätzte Hitze ${heat} Grad`}>
              <Text style={[s.meterLabel, { color: c.muted }]}>Hitze</Text>
              <View style={[s.bar, { backgroundColor: c.line }]}>
                <View style={[s.barFill, { width: `${heat}%`, backgroundColor: heat > 60 ? c.hot : heat > 35 ? c.warm : c.cool }]} />
              </View>
              <Text style={[s.meterDeg, { color: c.ink }]}>{heat}°</Text>
            </View>
          ) : null}
          <View style={s.tools}>
            <Pressable
              onPress={dictation.toggle}
              accessibilityRole="button"
              accessibilityLabel={dictation.listening ? "Diktieren beenden" : "Sprechen statt tippen"}
              style={[s.mic, { backgroundColor: dictation.listening ? c.hot : c.accent }]}
            >
              <Ionicons name={dictation.listening ? "stop" : "mic"} size={22} color={dictation.listening ? "#fff" : c.accentInk} />
              <Text style={[s.micText, { color: dictation.listening ? "#fff" : c.accentInk }]}>{dictation.listening ? "Fertig" : "Sprechen"}</Text>
            </Pressable>
            <Pressable onPress={paste} accessibilityRole="button" accessibilityLabel="Text einfügen" style={[s.tool, { borderColor: c.line }]}>
              <Ionicons name="clipboard-outline" size={18} color={c.ink} />
              <Text style={[s.toolText, { color: c.ink }]}>Einfügen</Text>
            </Pressable>
            {text ? (
              <Pressable
                onPress={() => {
                  setText("");
                  setResult(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="Text löschen"
                style={[s.tool, { borderColor: c.line }]}
              >
                <Ionicons name="close" size={18} color={c.ink} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {error ? <Text style={[s.error, { color: c.danger }]}>{error}</Text> : null}

        <Button title={busy ? COPY[mode].busy : COPY[mode].cta} onPress={() => run(false)} loading={busy && !result} disabled={busy} />

        {result ? (
          <View onLayout={(e) => (resultY.current = e.nativeEvent.layout.y)}>
            <ResultView result={result} onMoreLikeMe={() => run(true)} busy={busy} />
          </View>
        ) : (
          <Text style={[s.hint, { color: c.muted }]}>
            Tipp: In WhatsApp eine Nachricht markieren → Teilen → Sanftwort. Sie landet direkt hier.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: space(3) },
  logo: { flexDirection: "row", alignItems: "center", gap: space(2) },
  logoDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#2FA58C", borderWidth: 5, borderColor: "#E4572E" },
  logoText: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  pill: { borderWidth: 1, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11 },
  pillText: { fontSize: 13, fontWeight: "600" },
  label: { fontSize: 13, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space(2) },
  inputCard: { borderWidth: 1.5, borderRadius: radius.l, padding: space(3.5), gap: space(3) },
  input: { minHeight: 150, maxHeight: 320, fontSize: 17, lineHeight: 24, padding: 0 },
  meter: { flexDirection: "row", alignItems: "center", gap: space(2.5) },
  meterLabel: { fontSize: 13 },
  bar: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  meterDeg: { fontSize: 14, fontWeight: "700", minWidth: 36, textAlign: "right", fontVariant: ["tabular-nums"] },
  tools: { flexDirection: "row", gap: space(2), alignItems: "center" },
  mic: { flexDirection: "row", alignItems: "center", gap: space(1.5), borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 16 },
  micText: { fontSize: 15, fontWeight: "700" },
  tool: { flexDirection: "row", alignItems: "center", gap: space(1.5), borderWidth: 1, borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: 13 },
  toolText: { fontSize: 15, fontWeight: "500" },
  error: { fontSize: 15, textAlign: "center" },
  hint: { fontSize: 14, lineHeight: 20, textAlign: "center", paddingHorizontal: space(4) },
});
