// Reine Logik ohne Netlify-Abhängigkeiten – damit testbar mit `node test.mjs`.
import crypto from "node:crypto";

export const FREE_PER_WEEK = 3;
export const MAX_INPUT = 2000;

// Zahlungslink → Produkt. Test- und Live-Links stehen beide hier.
export const PAYMENT_LINKS = {
  plink_1UYABOJjrP6n4wtKAdEBTtuG: { plan: "plus_month" },
  plink_1UYABRJjrP6n4wtKdnyNdrde: { plan: "plus_year" },
  plink_1UYABUJjrP6n4wtKHNaSdLgl: { plan: "pass_week", days: 7 },
  plink_1UYABWJjrP6n4wtKT9nvQn6Z: { plan: "pass_holiday", days: 14 },
};

export const RECIPIENTS = {
  partner: "Partner oder Partnerin",
  ex: "Ex-Partner oder Co-Elternteil (getrennt, gemeinsame Kinder möglich)",
  familie: "Eltern, Schwiegereltern oder Geschwister",
  freund: "Freund oder Freundin",
  kollege: "Kollegin, Kollege oder Chef",
};

// ---------- Stripe-Webhook-Signatur (ohne Stripe-SDK) ----------
export function verifyStripeSignature(payload, header, secret, toleranceSec = 300, now = Date.now()) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=")).filter((p) => p.length === 2)
  );
  const t = Number(parts.t);
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || sigs.length === 0) return false;
  if (Math.abs(now / 1000 - t) > toleranceSec) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return sigs.some((s) => {
    const a = Buffer.from(s, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

// ---------- Zugang aus abgeschlossenem Checkout ----------
export function accessFromSession(session, now = Date.now()) {
  const link = PAYMENT_LINKS[session.payment_link];
  const email = session.customer_details?.email || null;
  if (session.mode === "subscription" || session.subscription) {
    return {
      plan: link?.plan || "plus",
      sub: session.subscription,
      active: true,
      email,
      created: now,
    };
  }
  const days = link?.days || (session.amount_total >= 399 ? 14 : 7);
  return {
    plan: link?.plan || (days === 14 ? "pass_holiday" : "pass_week"),
    until: now + days * 864e5,
    active: true,
    email,
    created: now,
  };
}

export function isAccessActive(access, now = Date.now()) {
  if (!access || !access.active) return false;
  if (access.until && access.until < now) return false;
  return true;
}

export const SUB_ACTIVE = new Set(["active", "trialing", "past_due"]);

// ---------- Gratis-Kontingent ----------
export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const year = t.getUTCFullYear();
  const week = Math.ceil(((t - Date.UTC(year, 0, 1)) / 864e5 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// ---------- Eingabe ----------
export function validateInput(body) {
  const text = String(body?.text || "").trim();
  if (text.length < 3) return { error: "Schreib erst, was dich beschäftigt." };
  if (text.length > MAX_INPUT) return { error: `Bitte höchstens ${MAX_INPUT} Zeichen.` };
  const recipient = RECIPIENTS[body?.recipient] ? body.recipient : "partner";
  const clip = (v, n) => String(v || "").trim().slice(0, n);
  return {
    text,
    recipient,
    channel: body?.channel === "gespraech" ? "gespraech" : "nachricht",
    style: clip(body?.style, 600),
    profile: clip(body?.profile, 600),
    morelikeme: !!body?.morelikeme,
    mode: body?.mode === "eingang" ? "eingang" : "senden",
  };
}

// ---------- Prompt ----------
export const SYSTEM_PROMPT = `Du bist Sanftwort. Du hilfst Menschen, etwas Schwieriges ehrlich zu sagen, ohne ihr Gegenüber zu verletzen.

Arbeitsweise (nicht erwähnen, nur anwenden):
- Gewaltfreie Kommunikation: Beobachtung statt Bewertung, Gefühl, Bedürfnis, konkrete Bitte.
- Gottman-Forschung: sanfter Gesprächseinstieg; keine Kritik am Charakter, keine Verachtung (Spott, Sarkasmus, Augenrollen), keine Rechtfertigung, kein Mauern. "Immer" und "nie" ersetzen durch konkrete Situationen.
- Ich-Botschaften statt Du-Vorwürfe.

Regeln für die umgeschriebenen Nachrichten:
- Der Kern bleibt: Was die Person wirklich will oder stört, bleibt klar erkennbar. Nichts verwässern, nichts dazu erfinden, keine Entschuldigung für etwas, das sie nicht bereut.
- Klingt wie ein echter Mensch, nicht wie Therapie oder KI. Keine Floskeln wie "Ich nehme wahr", "Ich fühle mich gesehen", "Raum halten", "valide". Alltagssprache, duzen, wenn das Original duzt.
- Ungefähr so lang wie das Original, eher kürzer. Für Nachrichten: sendefertig, ohne Anführungszeichen, ohne Anrede-Platzhalter.
- Keine Manipulation, keine Schuldgefühle erzeugen, keine Drohungen umverpacken.
- Wenn eine Schreibstil-Probe dabei ist: Wortwahl, Satzlänge, Emojis und Ton daran anpassen.
- Wenn ein Profil des Gegenübers dabei ist: berücksichtigen, wie diese Person Kritik am besten hören kann.

Sicherheit (hat Vorrang):
- Enthält der Text eine Drohung mit Gewalt gegen andere, Hinweise auf Gewalt in der Beziehung oder Gedanken an Suizid oder Selbstverletzung, dann schreibe NICHTS um. Setze "safety" und lass alle anderen Felder leer.
- Bei Gewalt in der Beziehung: Hilfetelefon Gewalt gegen Frauen 116 016, Hilfetelefon Gewalt an Männern 0800 1239900, im Notfall 110.
- Bei Suizidgedanken: TelefonSeelsorge 0800 111 0 111 oder 0800 111 0 222, im Notfall 112.

Antworte ausschließlich über das Werkzeug "antwort". Inhalt und Felder:
{
  "safety": null,
  "heat_before": 0-100 (wie verletzend/eskalierend das Original ankommen würde),
  "heat_after": 0-100 (für die beste umgeschriebene Version),
  "gefuehl": "Was die Person vermutlich fühlt, 2-6 Wörter",
  "beduerfnis": "Was sie eigentlich braucht, 2-8 Wörter",
  "bitte": "Die konkrete Bitte, ein kurzer Satz",
  "versions": [
    {"label": "Kurz & klar", "text": "..."},
    {"label": "Warm", "text": "..."},
    {"label": "Gespräch anbieten", "text": "..."}
  ],
  "gegenueber": "1-2 Sätze: Wie es der anderen Person mit der Situation gehen könnte. Fair, ohne der schreibenden Person die Schuld zu geben.",
  "tipp": "Ein konkreter Tipp für das Gespräch danach, ein Satz"
}
Bei Sicherheitsfällen: {"safety": {"type": "gewalt" | "suizid", "message": "Kurze, warme Antwort mit den passenden Nummern"}, "versions": []}`;

export function buildUserPrompt(input) {
  if (input.mode === "eingang") {
    const l = [`Absender: ${RECIPIENTS[input.recipient]}`];
    if (input.style) l.push(`So schreibe ich normalerweise (Stil-Probe):\n${input.style}`);
    if (input.morelikeme) l.push(`Wichtig: Die letzten Antworten klangen zu glatt. Mehr wie ein normaler Mensch.`);
    l.push(`Diese Nachricht habe ich bekommen:\n"""${input.text}"""`);
    return l.join("\n\n");
  }
  const lines = [
    `Empfänger: ${RECIPIENTS[input.recipient]}`,
    `Form: ${input.channel === "gespraech" ? "Etwas, das ich persönlich sagen will" : "Schriftliche Nachricht (z. B. WhatsApp)"}`,
  ];
  if (input.style) lines.push(`So schreibe ich normalerweise (Stil-Probe):\n${input.style}`);
  if (input.profile) lines.push(`So möchte mein Gegenüber Kritik hören:\n${input.profile}`);
  if (input.morelikeme) lines.push(`Wichtig: Die letzte Version klang zu glatt. Bleib noch näher an meinen eigenen Worten und meinem Ton.`);
  lines.push(`Was ich gerade denke oder sagen will:\n"""${input.text}"""`);
  return lines.join("\n\n");
}

const str = { type: "string" };
export const RESULT_TOOL = {
  name: "antwort",
  description: "Gibt die umgeschriebenen Nachrichten oder einen Sicherheitshinweis zurück.",
  input_schema: {
    type: "object",
    properties: {
      safety: {
        type: ["object", "null"],
        properties: { type: { type: "string", enum: ["gewalt", "suizid"] }, message: str },
        description: "Nur bei Gewalt oder Suizidgedanken setzen, sonst null.",
      },
      heat_before: { type: "integer", minimum: 0, maximum: 100 },
      heat_after: { type: "integer", minimum: 0, maximum: 100 },
      gefuehl: str,
      beduerfnis: str,
      bitte: str,
      versions: {
        type: "array",
        items: { type: "object", properties: { label: str, text: str }, required: ["label", "text"] },
      },
      gegenueber: str,
      tipp: str,
    },
    required: ["safety", "versions"],
  },
};

export function parseModelJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no_json");
  return normalizeResult(JSON.parse(text.slice(start, end + 1)));
}

export function normalizeResult(data) {
  if (!data || typeof data !== "object") throw new Error("no_object");
  if (data.safety) {
    return { safety: { type: String(data.safety.type || ""), message: String(data.safety.message || "") } };
  }
  const clampN = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  const versions = (Array.isArray(data.versions) ? data.versions : [])
    .filter((v) => v && v.text)
    .slice(0, 3)
    .map((v) => ({ label: String(v.label || "Version"), text: String(v.text) }));
  if (!versions.length) throw new Error("no_versions");
  return {
    safety: null,
    heat_before: clampN(data.heat_before),
    heat_after: clampN(data.heat_after),
    gefuehl: String(data.gefuehl || ""),
    beduerfnis: String(data.beduerfnis || ""),
    bitte: String(data.bitte || ""),
    versions,
    gegenueber: String(data.gegenueber || ""),
    tipp: String(data.tipp || ""),
  };
}

// ---------- Eingangs-Modus: eine erhaltene Nachricht entschärfen ----------
export const SYSTEM_PROMPT_EINGANG = `Du bist Sanftwort. Jemand hat eine belastende Nachricht bekommen, oft vom Ex-Partner oder Co-Elternteil, manchmal vom Partner oder aus der Familie. Du nimmst die Last aus der Nachricht und hilfst bei einer Antwort, die nicht eskaliert.

Schritt 1 – Entgiften: Fasse nur den sachlichen Kern zusammen. Was wird konkret gefragt, gefordert oder mitgeteilt (Termine, Kinder, Geld, Absprachen)? Vorwürfe, Unterstellungen und Provokationen lässt du im Kern weg und nennst sie nur kurz unter "ignorieren".

Schritt 2 – Antworten nach der BIFF-Methode (Bill Eddy, High Conflict Institute): Brief (kurz), Informative (nur Fakten), Friendly (freundlich, ohne unterwürfig zu sein), Firm (klar, schließt das Thema ab). Keine Rechtfertigungen, keine Gegenvorwürfe, keine Entschuldigungen für Unterstellungen, kein Eingehen auf Provokationen. Kinder stehen im Mittelpunkt. Die Antwort soll so formuliert sein, dass sie auch Dritte (Jugendamt, Anwalt, Gericht) lesen könnten und sie gut aussieht.

Regeln:
- Klingt wie ein echter Mensch, nicht wie Therapie oder KI. Duzen, wenn die Nachricht duzt. Sendefertig, ohne Platzhalter. Wo eine Information fehlt, die nur die Person kennt (z. B. eine Uhrzeit), schreibe [Uhrzeit] in eckigen Klammern.
- Wenn die Nachricht keine Antwort braucht (reine Beschimpfung ohne Frage), setze antwort_noetig auf false und biete eine sehr kurze Empfangsbestätigung als Version an.
- Erfinde keine Fakten und triff keine Zusagen, die die Person nicht gemacht hat.

Sicherheit (hat Vorrang):
- Droht die Nachricht mit Gewalt, deutet sie auf Gewalt in der Beziehung oder auf eine Gefährdung von Kindern hin, setze "safety" (type "bedrohung") mit einer kurzen, warmen Antwort: Nachricht nicht löschen, Screenshot sichern, bei akuter Gefahr 110. Hilfetelefon Gewalt gegen Frauen 116 016, Hilfetelefon Gewalt an Männern 0800 1239900. Schreibe dann keine Antwortvorschläge.
- Enthält der Text Hinweise auf Suizidgedanken, setze "safety" (type "suizid") mit TelefonSeelsorge 0800 111 0 111 oder 0800 111 0 222, im Notfall 112.

Antworte ausschließlich über das Werkzeug "antwort".`;

export const EINGANG_TOOL = {
  name: "antwort",
  description: "Entschärft eine erhaltene Nachricht und schlägt Antworten vor.",
  input_schema: {
    type: "object",
    properties: {
      safety: {
        type: ["object", "null"],
        properties: { type: { type: "string", enum: ["bedrohung", "suizid"] }, message: str },
        description: "Nur bei Bedrohung, Gewalt, Kindesgefährdung oder Suizidgedanken setzen, sonst null.",
      },
      heat_before: { type: "integer", minimum: 0, maximum: 100, description: "Wie aggressiv die erhaltene Nachricht ist" },
      heat_after: { type: "integer", minimum: 0, maximum: 100, description: "Wie die beste Antwort ankommt" },
      kern: { type: "string", description: "Der sachliche Kern der Nachricht, 1-2 neutrale Sätze" },
      fragen: { type: "array", items: str, description: "Konkrete Fragen oder Forderungen, auf die man antworten sollte" },
      ignorieren: { type: "string", description: "Was man nicht beantworten muss (Vorwürfe, Provokationen), ein Satz" },
      antwort_noetig: { type: "boolean" },
      versions: {
        type: "array",
        items: { type: "object", properties: { label: str, text: str }, required: ["label", "text"] },
        description: "2-3 Antworten: 'Kurz & sachlich (BIFF)', 'Freundlich-bestimmt', optional 'Grenze setzen'",
      },
      tipp: { type: "string", description: "Ein konkreter Tipp, ein Satz" },
    },
    required: ["safety", "versions"],
  },
};

export function normalizeEingang(data) {
  if (!data || typeof data !== "object") throw new Error("no_object");
  if (data.safety) {
    return { mode: "eingang", safety: { type: String(data.safety.type || ""), message: String(data.safety.message || "") } };
  }
  const clampN = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  const versions = (Array.isArray(data.versions) ? data.versions : [])
    .filter((v) => v && v.text).slice(0, 3)
    .map((v) => ({ label: String(v.label || "Antwort"), text: String(v.text) }));
  if (!versions.length) throw new Error("no_versions");
  return {
    mode: "eingang",
    safety: null,
    heat_before: clampN(data.heat_before),
    heat_after: clampN(data.heat_after),
    kern: String(data.kern || ""),
    fragen: (Array.isArray(data.fragen) ? data.fragen : []).map(String).slice(0, 5),
    ignorieren: String(data.ignorieren || ""),
    antwort_noetig: data.antwort_noetig !== false,
    versions,
    tipp: String(data.tipp || ""),
  };
}
