import { useEffect, useState } from "react";
import { Linking, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import type { InResult, Result, SendResult } from "../lib/api";
import { radius, space, useColors } from "../lib/theme";
import { Button, Card, Note } from "./ui";

function Heat({ before, after, label }: { before: number; after: number; label?: string }) {
  const c = useColors();
  return (
    <View style={s.heatRow} accessible accessibilityLabel={`Hitze vorher ${before} Grad, nachher ${after} Grad`}>
      <Text style={[s.heatNum, { color: c.hot }]}>{before}°</Text>
      <View style={{ alignItems: "center" }}>
        <Ionicons name="arrow-forward" size={22} color={c.muted} />
        {label ? <Text style={[s.heatLabel, { color: c.muted }]}>{label}</Text> : null}
      </View>
      <Text style={[s.heatNum, { color: c.cool }]}>{after}°</Text>
    </View>
  );
}

function VersionCard({ label, text, index }: { label: string; text: string; index: number }) {
  const c = useColors();
  const [value, setValue] = useState(text);
  const [copied, setCopied] = useState(false);
  useEffect(() => setValue(text), [text]);

  const copy = async () => {
    await Clipboard.setStringAsync(value);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  const share = () => Share.share({ message: value }).catch(() => {});
  const whatsapp = async () => {
    const url = `whatsapp://send?text=${encodeURIComponent(value)}`;
    if (await Linking.canOpenURL(url).catch(() => false)) Linking.openURL(url);
    else share();
  };

  return (
    <Card style={{ gap: space(2.5) }}>
      <Text style={[s.verLabel, { color: c.cool }]}>{label.toUpperCase()}</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        multiline
        scrollEnabled={false}
        accessibilityLabel={`Version ${index + 1}, bearbeitbar`}
        style={[s.verText, { color: c.ink }]}
      />
      <View style={s.row}>
        <Button
          kind="ghost"
          title={copied ? "Kopiert" : "Kopieren"}
          onPress={copy}
          icon={<Ionicons name={copied ? "checkmark" : "copy-outline"} size={17} color={c.ink} />}
          style={{ flex: 1 }}
        />
        <Button kind="ghost" title="Senden" onPress={share} icon={<Ionicons name="share-outline" size={17} color={c.ink} />} style={{ flex: 1 }} />
        <Pressable accessibilityLabel="Per WhatsApp senden" onPress={whatsapp} style={[s.iconBtn, { borderColor: c.line, backgroundColor: c.card }]}>
          <Ionicons name="logo-whatsapp" size={20} color={c.ink} />
        </Pressable>
      </View>
    </Card>
  );
}

export function ResultView({
  result,
  onMoreLikeMe,
  busy,
}: {
  result: Result;
  onMoreLikeMe: () => void;
  busy: boolean;
}) {
  const c = useColors();

  if (result.safety) {
    return (
      <Card style={{ borderColor: c.hot, borderWidth: 2, gap: space(2) }}>
        <Text style={[s.safetyTitle, { color: c.ink }]}>Hier geht es um mehr als Worte</Text>
        <Text style={[s.body, { color: c.ink }]}>{result.safety.message}</Text>
      </Card>
    );
  }

  const r = result as SendResult | InResult;
  const eingang = r.mode === "eingang";

  return (
    <View style={{ gap: space(3) }}>
      <Heat before={r.heat_before} after={r.heat_after} label={eingang ? "deine Antwort" : undefined} />

      {eingang ? (
        <View style={{ gap: space(2) }}>
          <Note title="Worum es eigentlich geht" tone="sunk">
            <Text style={[s.body, { color: c.ink }]}>{(r as InResult).kern}</Text>
            {(r as InResult).fragen.map((f, i) => (
              <Text key={i} style={[s.body, { color: c.ink }]}>• {f}</Text>
            ))}
          </Note>
          {(r as InResult).dahinter ? <Note title="Was dahinterstecken könnte" tone="sunk">{(r as InResult).dahinter}</Note> : null}
          {(r as InResult).ignorieren ? <Note title="Nicht auf die Goldwaage legen" tone="sunk">{(r as InResult).ignorieren}</Note> : null}
          {!(r as InResult).antwort_noetig ? (
            <Note title="Gut zu wissen">Diese Nachricht braucht eigentlich keine Antwort. Wenn du reagieren willst, reicht etwas Kurzes.</Note>
          ) : null}
        </View>
      ) : (
        <View style={s.klar}>
          {[
            ["Gefühl", (r as SendResult).gefuehl],
            ["Bedürfnis", (r as SendResult).beduerfnis],
            ["Bitte", (r as SendResult).bitte],
          ].map(([k, v]) => (
            <View key={k} style={[s.klarItem, { backgroundColor: c.sunk }]}>
              <Text style={[s.klarKey, { color: c.muted }]}>{k.toUpperCase()}</Text>
              <Text style={[s.klarVal, { color: c.ink }]}>{v}</Text>
            </View>
          ))}
        </View>
      )}

      {r.versions.map((v, i) => (
        <VersionCard key={`${i}-${v.text.slice(0, 12)}`} label={v.label} text={v.text} index={i} />
      ))}

      <Button
        kind="ghost"
        title="Klingt nicht nach mir – nochmal"
        onPress={onMoreLikeMe}
        loading={busy}
        icon={<Ionicons name="refresh" size={17} color={c.ink} />}
      />

      {!eingang && (r as SendResult).gegenueber ? <Note title="So könnte es deinem Gegenüber gehen">{(r as SendResult).gegenueber}</Note> : null}
      {r.tipp ? <Note title={eingang ? "Tipp" : "Für das Gespräch danach"}>{r.tipp}</Note> : null}
    </View>
  );
}

const s = StyleSheet.create({
  heatRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space(4), paddingVertical: space(1) },
  heatNum: { fontSize: 44, fontWeight: "800", letterSpacing: -1, fontVariant: ["tabular-nums"] },
  heatLabel: { fontSize: 12, marginTop: 2 },
  klar: { gap: space(2) },
  klarItem: { borderRadius: radius.m, padding: space(3) },
  klarKey: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, marginBottom: 2 },
  klarVal: { fontSize: 15, lineHeight: 21 },
  verLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.7 },
  verText: { fontSize: 17, lineHeight: 24, padding: 0 },
  row: { flexDirection: "row", gap: space(2), alignItems: "center" },
  iconBtn: { width: 44, height: 42, borderRadius: radius.m, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  body: { fontSize: 15, lineHeight: 21 },
  safetyTitle: { fontSize: 18, fontWeight: "700" },
});
