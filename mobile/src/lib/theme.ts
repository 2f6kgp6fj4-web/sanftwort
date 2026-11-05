import { useColorScheme } from "react-native";

const light = {
  bg: "#FAF7F2",
  card: "#FFFFFF",
  sunk: "#F3EEE6",
  ink: "#1F2430",
  muted: "#5D6472",
  line: "#E7E1D8",
  hot: "#E4572E",
  warm: "#F2A541",
  cool: "#2FA58C",
  coolBg: "#E6F5F1",
  accent: "#1F2430",
  accentInk: "#FFFFFF",
  danger: "#C2410C",
};

const dark: typeof light = {
  bg: "#14161C",
  card: "#1D2028",
  sunk: "#191C23",
  ink: "#EEF0F4",
  muted: "#A3A9B6",
  line: "#2C303A",
  hot: "#F0714C",
  warm: "#F2B35E",
  cool: "#43BFA3",
  coolBg: "#173029",
  accent: "#EEF0F4",
  accentInk: "#14161C",
  danger: "#F59E6B",
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}

export const radius = { s: 10, m: 14, l: 20, pill: 999 };
export const space = (n: number) => n * 4;
