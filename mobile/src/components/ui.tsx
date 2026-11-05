import { type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { radius, space, useColors } from "../lib/theme";

export function Button({
  title,
  onPress,
  kind = "primary",
  disabled,
  loading,
  icon,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  kind?: "primary" | "ghost" | "quiet";
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const primary = kind === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        primary
          ? { backgroundColor: c.accent }
          : kind === "ghost"
            ? { borderWidth: 1, borderColor: c.line, backgroundColor: c.card }
            : { backgroundColor: "transparent" },
        primary ? s.btnBig : s.btnSmall,
        (disabled || loading) && { opacity: 0.55 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? c.accentInk : c.ink} />
      ) : (
        <>
          {icon}
          <Text style={[primary ? s.btnBigText : s.btnSmallText, { color: primary ? c.accentInk : c.ink }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[s.chip, { borderColor: active ? c.accent : c.line, backgroundColor: active ? c.accent : "transparent" }]}
    >
      <Text style={[s.chipText, { color: active ? c.accentInk : c.ink }]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useColors();
  return (
    <View style={[s.seg, { backgroundColor: c.sunk, borderColor: c.line }]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={[s.segItem, on && { backgroundColor: c.card, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 }]}
          >
            <Text style={[s.segText, { color: on ? c.ink : c.muted, fontWeight: on ? "700" : "500" }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[s.card, { backgroundColor: c.card, borderColor: c.line }, style]}>{children}</View>;
}

export function Note({ title, children, tone = "cool" }: { title: string; children: ReactNode; tone?: "cool" | "sunk" }) {
  const c = useColors();
  return (
    <View style={[s.note, { backgroundColor: tone === "cool" ? c.coolBg : c.sunk }]}>
      <Text style={[s.noteTitle, { color: c.muted }]}>{title.toUpperCase()}</Text>
      {typeof children === "string" ? <Text style={[s.noteBody, { color: c.ink }]}>{children}</Text> : children}
    </View>
  );
}

const s = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space(2), borderRadius: radius.m },
  btnBig: { paddingVertical: 16, paddingHorizontal: 20, minHeight: 54 },
  btnSmall: { paddingVertical: 10, paddingHorizontal: 14, minHeight: 42 },
  btnBigText: { fontSize: 17, fontWeight: "700" },
  btnSmallText: { fontSize: 15, fontWeight: "600" },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14 },
  chipText: { fontSize: 15, fontWeight: "500" },
  seg: { flexDirection: "row", borderRadius: radius.m, padding: 4, borderWidth: 1, gap: 4 },
  segItem: { flex: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 6, alignItems: "center" },
  segText: { fontSize: 15, textAlign: "center" },
  card: { borderWidth: 1, borderRadius: radius.l, padding: space(4) },
  note: { borderRadius: radius.m, padding: space(3.5), gap: 4 },
  noteTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6 },
  noteBody: { fontSize: 15, lineHeight: 21 },
});
