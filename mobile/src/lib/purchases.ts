import { Platform } from "react-native";
import Purchases, { LOG_LEVEL, PURCHASES_ERROR_CODE, type PurchasesPackage } from "react-native-purchases";

export const ENTITLEMENT = "plus";

const KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_RC_IOS_KEY,
  android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY,
});

let configured = false;

export function purchasesAvailable() {
  return !!KEY && configured;
}

export function configurePurchases(appUserID: string) {
  if (configured || !KEY) return;
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: KEY, appUserID });
    configured = true;
  } catch (e) {
    console.warn("Purchases.configure failed", e);
  }
}

export async function hasPlus(): Promise<boolean> {
  if (!purchasesAvailable()) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return !!info.entitlements.active[ENTITLEMENT];
  } catch {
    return false;
  }
}

export async function loadPackages(): Promise<PurchasesPackage[]> {
  if (!purchasesAvailable()) return [];
  const offerings = await Purchases.getOfferings();
  const pkgs = offerings.current?.availablePackages ?? [];
  const order = ["ANNUAL", "MONTHLY", "WEEKLY"];
  return [...pkgs].sort((a, b) => order.indexOf(a.packageType) - order.indexOf(b.packageType));
}

/** true = gekauft, false = abgebrochen. Wirft bei echten Fehlern. */
export async function buy(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const r = await Purchases.purchasePackage(pkg);
    return !!r.customerInfo.entitlements.active[ENTITLEMENT];
  } catch (e: any) {
    if (e?.userCancelled || e?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return false;
    throw e;
  }
}

export async function restore(): Promise<boolean> {
  if (!purchasesAvailable()) return false;
  const info = await Purchases.restorePurchases();
  return !!info.entitlements.active[ENTITLEMENT];
}

export async function manageSubscriptions() {
  if (!purchasesAvailable()) return;
  try {
    await Purchases.showManageSubscriptions();
  } catch {}
}

export type { PurchasesPackage };
