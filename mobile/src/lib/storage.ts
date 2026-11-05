import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

// Kleine Werte im Schlüsselbund (iOS) bzw. Keystore (Android).
// Auf dem iPhone bleibt die Geräte-ID dadurch auch nach einer Neuinstallation erhalten,
// damit das Gratis-Kontingent nicht durch Neuinstallieren umgangen wird.

const KEYS = {
  install: "sw_install_id",
  consent: "sw_consent_v1",
  style: "sw_style",
  profile: "sw_partner_profile",
  recipient: "sw_recipient",
} as const;

async function get(key: string) {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function set(key: string, value: string) {
  try {
    if (value) await SecureStore.setItemAsync(key, value);
    else await SecureStore.deleteItemAsync(key);
  } catch {}
}

let installCache: string | null = null;

export async function getInstallId(): Promise<string> {
  if (installCache) return installCache;
  let id = await get(KEYS.install);
  if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
    id = Crypto.randomUUID().replace(/-/g, "");
    await set(KEYS.install, id);
  }
  installCache = id;
  return id;
}

export const prefs = {
  getConsent: async () => (await get(KEYS.consent)) === "yes",
  setConsent: (v: boolean) => set(KEYS.consent, v ? "yes" : ""),
  getStyle: async () => (await get(KEYS.style)) || "",
  setStyle: (v: string) => set(KEYS.style, v.slice(0, 600)),
  getProfile: async () => (await get(KEYS.profile)) || "",
  setProfile: (v: string) => set(KEYS.profile, v.slice(0, 600)),
  getRecipient: async () => (await get(KEYS.recipient)) || "partner",
  setRecipient: (v: string) => set(KEYS.recipient, v),
  resetAll: async () => {
    await Promise.all([KEYS.consent, KEYS.style, KEYS.profile, KEYS.recipient].map((k) => set(k, "")));
  },
};
