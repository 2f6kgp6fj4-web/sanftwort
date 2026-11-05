import Constants from "expo-constants";
import { getInstallId } from "./storage";

export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL || (Constants.expoConfig?.extra as any)?.apiUrl || "https://sanftwort.netlify.app";
export const WEB_URL: string = (Constants.expoConfig?.extra as any)?.webUrl || API_URL;

export type Mode = "senden" | "eingang";
export type Recipient = "partner" | "familie" | "freund" | "kollege" | "ex";

export const RECIPIENTS: { key: Recipient; label: string }[] = [
  { key: "partner", label: "Partner/in" },
  { key: "familie", label: "Familie" },
  { key: "freund", label: "Freund/in" },
  { key: "kollege", label: "Job" },
  { key: "ex", label: "Ex" },
];

export type Version = { label: string; text: string };

export type SendResult = {
  mode?: undefined;
  safety: null;
  heat_before: number;
  heat_after: number;
  gefuehl: string;
  beduerfnis: string;
  bitte: string;
  versions: Version[];
  gegenueber: string;
  tipp: string;
};

export type InResult = {
  mode: "eingang";
  safety: null;
  heat_before: number;
  heat_after: number;
  kern: string;
  dahinter: string;
  fragen: string[];
  ignorieren: string;
  antwort_noetig: boolean;
  versions: Version[];
  tipp: string;
};

export type SafetyResult = { mode?: string; safety: { type: string; message: string } };

export type Result = (SendResult | InResult | SafetyResult) & { pro?: boolean; left?: number | null };

export type Status = { pro: boolean; left: number | null; free: number };

export class LimitError extends Error {
  constructor(public free: number) {
    super("limit");
  }
}

async function headers(fresh = false) {
  return {
    "content-type": "application/json",
    "x-sw-install": await getInstallId(),
    ...(fresh ? { "x-sw-fresh": "1" } : {}),
  };
}

async function withTimeout(url: string, init: RequestInit, ms = 45000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function fetchStatus(fresh = false): Promise<Status | null> {
  try {
    const r = await withTimeout(`${API_URL}/api/app/status`, { headers: await headers(fresh) }, 15000);
    if (!r.ok) return null;
    return (await r.json()) as Status;
  } catch {
    return null;
  }
}

export type TranslateInput = {
  mode: Mode;
  text: string;
  recipient: Recipient;
  channel?: "nachricht" | "gespraech";
  style?: string;
  profile?: string;
  morelikeme?: boolean;
};

export async function translate(input: TranslateInput): Promise<Result> {
  let r: Response;
  try {
    r = await withTimeout(`${API_URL}/api/app/translate`, {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error("Keine Verbindung. Bitte prüfe dein Internet und versuch es nochmal.");
  }
  const data = await r.json().catch(() => ({}));
  if (r.status === 402) throw new LimitError(data.free ?? 5);
  if (!r.ok) throw new Error(data.error || "Das hat nicht geklappt. Bitte nochmal versuchen.");
  return data as Result;
}
