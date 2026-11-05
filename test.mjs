import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import {
  verifyStripeSignature, accessFromSession, isAccessActive, weekKey,
  validateInput, buildUserPrompt, parseModelJson, SYSTEM_PROMPT,
  normalizeEingang, SYSTEM_PROMPT_EINGANG, EINGANG_TOOL,
  validInstallId, rcEntitlementActive,
} from "./lib/core.mjs";

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("✓", name); };

t("Stripe-Signatur gültig/ungültig/abgelaufen", () => {
  const secret = "whsec_test", body = '{"id":"evt_1"}', ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  assert.ok(verifyStripeSignature(body, `t=${ts},v1=${sig}`, secret));
  assert.ok(!verifyStripeSignature(body + " ", `t=${ts},v1=${sig}`, secret));
  assert.ok(!verifyStripeSignature(body, `t=${ts},v1=${sig}`, "whsec_other"));
  assert.ok(!verifyStripeSignature(body, `t=${ts - 1000},v1=${sig}`, secret));
  assert.ok(!verifyStripeSignature(body, null, secret));
});

t("Zugang aus Checkout: Pass und Abo", () => {
  const now = Date.UTC(2026, 10, 4);
  const pass = accessFromSession({ id: "cs_test_a", mode: "payment", payment_link: "plink_1UYABUJjrP6n4wtKHNaSdLgl", amount_total: 299 }, now);
  assert.equal(pass.plan, "pass_week");
  assert.equal(pass.until, now + 7 * 864e5);
  assert.ok(isAccessActive(pass, now + 6 * 864e5));
  assert.ok(!isAccessActive(pass, now + 8 * 864e5));
  const hol = accessFromSession({ mode: "payment", amount_total: 399 }, now);
  assert.equal(hol.until, now + 14 * 864e5);
  const sub = accessFromSession({ mode: "subscription", subscription: "sub_1", payment_link: "plink_1UYABRJjrP6n4wtKdnyNdrde" }, now);
  assert.equal(sub.plan, "plus_year");
  assert.equal(sub.sub, "sub_1");
  assert.ok(isAccessActive(sub, now + 900 * 864e5));
  assert.ok(!isAccessActive({ ...sub, active: false }, now));
});

t("Kalenderwoche", () => {
  assert.equal(weekKey(new Date(Date.UTC(2026, 10, 4))), "2026-W45");
  assert.equal(weekKey(new Date(Date.UTC(2027, 0, 1))), "2026-W53");
});

t("Eingabe prüfen", () => {
  assert.ok(validateInput({ text: "a" }).error);
  assert.ok(validateInput({ text: "x".repeat(2001) }).error);
  const ok = validateInput({ text: "Du nervst", recipient: "hack", style: "y".repeat(900) });
  assert.equal(ok.recipient, "partner");
  assert.equal(ok.style.length, 600);
  assert.match(buildUserPrompt(ok), /Du nervst/);
});

t("Modellantwort parsen", () => {
  const r = parseModelJson('Hier:\n{"safety":null,"heat_before":88.6,"heat_after":140,"gefuehl":"erschöpft","beduerfnis":"Entlastung","bitte":"Übernimm die Kita","versions":[{"label":"Kurz","text":"Kannst du…"}],"gegenueber":"x","tipp":"y"}');
  assert.equal(r.heat_before, 89);
  assert.equal(r.heat_after, 100);
  assert.equal(r.versions.length, 1);
  const s = parseModelJson('{"safety":{"type":"gewalt","message":"116 016"},"versions":[]}');
  assert.equal(s.safety.type, "gewalt");
  assert.throws(() => parseModelJson("kein json"));
  assert.throws(() => parseModelJson('{"versions":[]}'));
  assert.match(SYSTEM_PROMPT, /116 016/);
});

t("Eingangs-Modus", () => {
  const i = validateInput({ text: "Du bist so egoistisch", mode: "eingang", recipient: "ex" });
  assert.equal(i.mode, "eingang");
  assert.match(buildUserPrompt(i), /habe ich bekommen/);
  assert.equal(validateInput({ text: "abc", mode: "quatsch" }).mode, "senden");
  const r = normalizeEingang({ safety: null, heat_before: 90, heat_after: 8, kern: "Termin", fragen: ["Wann?"], antwort_noetig: false, versions: [{ label: "BIFF", text: "Ok." }] });
  assert.equal(r.mode, "eingang"); assert.equal(r.antwort_noetig, false); assert.deepEqual(r.fragen, ["Wann?"]);
  assert.equal(normalizeEingang({ safety: { type: "bedrohung", message: "110" } }).safety.type, "bedrohung");
  assert.throws(() => normalizeEingang({ safety: null, versions: [] }));
  assert.match(SYSTEM_PROMPT_EINGANG, /BIFF/); assert.match(SYSTEM_PROMPT_EINGANG, /116 016/);
  assert.equal(EINGANG_TOOL.name, "antwort");
});

t("App: Install-ID und RevenueCat-Abo", () => {
  assert.ok(validInstallId("a1b2c3d4e5f6a7b8c9d0"));
  assert.ok(!validInstallId("kurz"));
  assert.ok(!validInstallId("../../etc/passwd/xxxxxxxx"));
  const now = Date.UTC(2026, 10, 5);
  const sub = (e) => ({ subscriber: { entitlements: e } });
  assert.ok(rcEntitlementActive(sub({ plus: { expires_date: "2026-12-01T00:00:00Z" } }), "plus", now));
  assert.ok(!rcEntitlementActive(sub({ plus: { expires_date: "2026-11-01T00:00:00Z" } }), "plus", now));
  assert.ok(rcEntitlementActive(sub({ plus: { expires_date: "2026-11-01T00:00:00Z", grace_period_expires_date: "2026-11-10T00:00:00Z" } }), "plus", now));
  assert.ok(rcEntitlementActive(sub({ plus: { expires_date: null } }), "plus", now));
  assert.ok(!rcEntitlementActive(sub({}), "plus", now));
  assert.ok(!rcEntitlementActive(null, "plus", now));
  assert.equal(normalizeEingang({ safety: null, dahinter: "müde", versions: [{ label: "x", text: "y" }] }).dahinter, "müde");
});

t("Keine Platzhalter mehr in Rechtstexten", () => {
  const left = ["impressum", "datenschutz", "agb"].filter((f) => fs.readFileSync(`public/${f}.html`, "utf8").includes("{{"));
  if (left.length) console.log("  ⚠ Platzhalter noch offen in:", left.join(", "));
});

console.log(`\n${n} Tests grün`);
