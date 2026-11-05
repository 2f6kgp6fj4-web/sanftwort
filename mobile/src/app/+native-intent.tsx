// Geteilte Inhalte kommen als sanftwort://dataUrl=… herein. Die verarbeitet expo-share-intent,
// der Router soll dafür einfach den Startbildschirm zeigen.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (path.includes("dataUrl=")) return "/";
    return path;
  } catch {
    return "/";
  }
}
