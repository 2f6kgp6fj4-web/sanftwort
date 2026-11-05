// Grobe Schätzung beim Tippen. Die echte Gradzahl kommt von der KI.
const HOT =
  /\b(immer|nie|niemals|jedes mal|schon wieder|typisch|du bist|egal|interessiert dich|nervt|nervst|scheiße|scheiss|kotzt|idiot|arsch|peinlich|faul|lächerlich|unfähig|hau ab|verpiss|hasse|bescheuert|dumm|selbst schuld|kein bock|null bock|wie immer|kapierst|checkst|sowieso)\b/gi;

export function estimateHeat(t: string): number {
  if (!t.trim()) return 0;
  const letters = t.replace(/[^A-Za-zÄÖÜäöüß]/g, "");
  const caps = letters.length ? letters.replace(/[^A-ZÄÖÜ]/g, "").length / letters.length : 0;
  const ex = (t.match(/!/g) || []).length;
  const hits = (t.match(HOT) || []).length;
  const mixed = (t.match(/\?!|!\?/g) || []).length;
  return Math.min(99, Math.round(12 + caps * 70 + Math.min(ex, 5) * 5 + hits * 13 + mixed * 6));
}
