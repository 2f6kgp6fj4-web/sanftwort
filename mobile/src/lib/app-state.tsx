import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { fetchStatus, type Status } from "./api";
import { getInstallId, prefs } from "./storage";
import { configurePurchases, hasPlus } from "./purchases";

type Ctx = {
  ready: boolean;
  consent: boolean;
  setConsent: (v: boolean) => Promise<void>;
  status: Status | null;
  refresh: (fresh?: boolean) => Promise<void>;
  style: string;
  setStyle: (v: string) => void;
  profile: string;
  setProfile: (v: string) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [consent, setConsentState] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [style, setStyleState] = useState("");
  const [profile, setProfileState] = useState("");

  const refresh = useCallback(async (fresh = false) => {
    const plusLocal = await hasPlus();
    const s = await fetchStatus(fresh || plusLocal);
    if (s) setStatus(plusLocal && !s.pro ? { ...s, pro: true, left: null } : s);
    else if (plusLocal) setStatus({ pro: true, left: null, free: 5 });
  }, []);

  useEffect(() => {
    (async () => {
      const id = await getInstallId();
      configurePurchases(id);
      const [c, st, pr] = await Promise.all([prefs.getConsent(), prefs.getStyle(), prefs.getProfile()]);
      setConsentState(c);
      setStyleState(st);
      setProfileState(pr);
      setReady(true);
      refresh();
    })();
    const sub = AppState.addEventListener("change", (s) => s === "active" && refresh());
    return () => sub.remove();
  }, [refresh]);

  const value = useMemo<Ctx>(
    () => ({
      ready,
      consent,
      setConsent: async (v) => {
        await prefs.setConsent(v);
        setConsentState(v);
      },
      status,
      refresh,
      style,
      setStyle: (v) => {
        setStyleState(v);
        prefs.setStyle(v);
      },
      profile,
      setProfile: (v) => {
        setProfileState(v);
        prefs.setProfile(v);
      },
    }),
    [ready, consent, status, refresh, style, profile],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}
