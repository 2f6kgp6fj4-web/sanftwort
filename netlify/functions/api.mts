import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import Anthropic from "@anthropic-ai/sdk";
import {
  FREE_PER_WEEK,
  SUB_ACTIVE,
  SYSTEM_PROMPT,
  accessFromSession,
  buildUserPrompt,
  isAccessActive,
  normalizeResult,
  normalizeEingang,
  RESULT_TOOL,
  EINGANG_TOOL,
  SYSTEM_PROMPT_EINGANG,
  sha256,
  validateInput,
  verifyStripeSignature,
  weekKey,
  FREE_APP_PER_WEEK,
  IP_APP_CAP_PER_WEEK,
  validInstallId,
  rcEntitlementActive,
} from "../../lib/core.mjs";

const MODEL = Netlify.env.get("SW_MODEL") || "claude-haiku-5-5";
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "cache-control": "no-store" } });

const accessStore = () => getStore({ name: "access", consistency: "strong" });
const quotaStore = () => getStore({ name: "quota", consistency: "strong" });

async function getAccess(token: string | null) {
  if (!token || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(token)) return null;
  return (await accessStore().get(token, { type: "json" })) as any;
}

async function quota(context: Context) {
  const key = `${weekKey()}/${sha256((context.ip || "?") + (Netlify.env.get("TOKEN_SECRET") || "sw"))}`;
  const used = Number(await quotaStore().get(key)) || 0;
  return { key, used, left: Math.max(0, FREE_PER_WEEK - used) };
}

function accessInfo(access: any) {
  return { pro: true, plan: access.plan, until: access.until || null };
}

async function status(req: Request, context: Context) {
  const access = await getAccess(req.headers.get("x-sw-token"));
  if (isAccessActive(access)) return json(accessInfo(access));
  const q = await quota(context);
  return json({ pro: false, left: q.left, free: FREE_PER_WEEK });
}

async function translate(req: Request, context: Context) {
  const r = await runTranslate(await req.json().catch(() => null), req.headers.get("x-sw-token"), context);
  return json(r.body, r.status);
}

type Gate = { pro: boolean; left: number; free: number; commit: () => Promise<void> };

async function webGate(token: string | null, context: Context): Promise<Gate> {
  const access = await getAccess(token);
  if (isAccessActive(access)) return { pro: true, left: Infinity, free: FREE_PER_WEEK, commit: async () => {} };
  const q = await quota(context);
  return { pro: false, left: q.left, free: FREE_PER_WEEK, commit: () => quotaStore().set(q.key, String(q.used + 1)).then(() => {}) };
}

// ---------- App ----------
const rcStore = () => getStore({ name: "rc", consistency: "strong" });

async function rcPro(installId: string, fresh: boolean): Promise<boolean> {
  const secret = Netlify.env.get("REVENUECAT_SECRET");
  if (!secret) return false;
  const store = rcStore();
  if (!fresh) {
    const c = (await store.get(installId, { type: "json" })) as any;
    if (c && Date.now() - c.at < (c.active ? 15 : 2) * 60_000) return !!c.active;
  }
  try {
    const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(installId)}`, {
      headers: { authorization: `Bearer ${secret}`, accept: "application/json" },
    });
    if (!r.ok) { console.error("revenuecat", r.status); return false; }
    const active = rcEntitlementActive(await r.json(), Netlify.env.get("RC_ENTITLEMENT") || "plus");
    await store.setJSON(installId, { active, at: Date.now() });
    return active;
  } catch (e) {
    console.error("revenuecat", e);
    return false;
  }
}

async function appGate(req: Request, context: Context): Promise<Gate | Response> {
  const id = req.headers.get("x-sw-install");
  if (!validInstallId(id)) return json({ error: "Bitte die App neu starten." }, 400);
  if (await rcPro(id!, req.headers.get("x-sw-fresh") === "1"))
    return { pro: true, left: Infinity, free: FREE_APP_PER_WEEK, commit: async () => {} };
  const wk = weekKey();
  const key = `app/${wk}/${id}`;
  const ipKey = `appip/${wk}/${sha256((context.ip || "?") + (Netlify.env.get("TOKEN_SECRET") || "sw"))}`;
  const store = quotaStore();
  const used = Number(await store.get(key)) || 0;
  const ipUsed = Number(await store.get(ipKey)) || 0;
  const left = Math.max(0, Math.min(FREE_APP_PER_WEEK - used, IP_APP_CAP_PER_WEEK - ipUsed));
  return {
    pro: false, left, free: FREE_APP_PER_WEEK,
    commit: async () => { await store.set(key, String(used + 1)); await store.set(ipKey, String(ipUsed + 1)); },
  };
}

async function appStatus(req: Request, context: Context) {
  const g = await appGate(req, context);
  if (g instanceof Response) return g;
  return json({ pro: g.pro, left: g.pro ? null : g.left, free: g.free });
}

async function appTranslate(req: Request, context: Context) {
  const g = await appGate(req, context);
  if (g instanceof Response) return g;
  const r = await runTranslate(await req.json().catch(() => null), g);
  return json(r.body, r.status);
}

async function runTranslate(body: any, gateOrToken: Gate | string | null, context?: Context): Promise<{ status: number; body: any }> {
  const input = validateInput(body);
  if ("error" in input) return { status: 400, body: { error: input.error } };

  const gate = typeof gateOrToken === "object" && gateOrToken !== null ? gateOrToken : await webGate(gateOrToken, context!);
  const pro = gate.pro;
  if (!pro && gate.left <= 0) return { status: 402, body: { error: "limit", free: gate.free } };

  if (!process.env.ANTHROPIC_BASE_URL && !process.env.ANTHROPIC_API_KEY)
    return { status: 503, body: { error: "KI ist gerade nicht verfügbar." } };
  const eingang = input.mode === "eingang";

  const client = new Anthropic();
  let result;
  for (let attempt = 0; attempt < 2; attempt++) {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2500,
      system: eingang ? SYSTEM_PROMPT_EINGANG : SYSTEM_PROMPT,
      tools: [(eingang ? EINGANG_TOOL : RESULT_TOOL) as any],
      tool_choice: { type: "tool", name: "antwort" },
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    });
    const block: any = msg.content.find((b: any) => b.type === "tool_use");
    try {
      result = eingang ? normalizeEingang(block?.input) : normalizeResult(block?.input);
      break;
    } catch (e) {
      console.error("parse failed", e, msg.stop_reason, JSON.stringify(block?.input || msg.content).slice(0, 300));
    }
  }
  if (!result) return { status: 502, body: { error: "Das hat nicht geklappt. Bitte nochmal versuchen." } };

  let left: number | null = pro ? null : gate.left;
  if (!pro && !result.safety) {
    await gate.commit();
    left = gate.left - 1;
  }
  return { status: 200, body: { ...result, pro, left } };
}

// Für den iPhone-Kurzbefehl und andere Integrationen: Text rein, beste Version als reiner Text raus.
async function kurzbefehl(req: Request, url: URL, context: Context) {
  const raw = await req.text();
  let body: any;
  try { body = JSON.parse(raw); } catch { body = { text: raw }; }
  if (typeof body !== "object" || body === null) body = { text: String(body) };
  body.mode = body.mode || url.searchParams.get("modus") || "senden";
  body.recipient = body.recipient || url.searchParams.get("an") || (body.mode === "eingang" ? "ex" : "partner");
  const token = req.headers.get("x-sw-token") || url.searchParams.get("code");
  const r = await runTranslate(body, token, context);
  const text = (t: string, status = 200) =>
    new Response(t, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  if (r.status === 402)
    return text(`Deine 3 Gratis-Übersetzungen diese Woche sind aufgebraucht.\nUnbegrenzt weiter: ${url.origin}/#preise`, 402);
  if (r.status !== 200) return text(r.body.error || "Das hat nicht geklappt.", r.status);
  if (r.body.safety) return text(r.body.safety.message);
  const best = r.body.versions[0].text;
  const kern = r.body.mode === "eingang" && r.body.kern ? `Worum es eigentlich geht: ${r.body.kern}\n\n` : "";
  return text(url.searchParams.get("nur") === "text" ? best : `${kern}${best}`);
}

async function activate(url: URL) {
  const token = url.searchParams.get("session_id");
  const access = await getAccess(token);
  if (!access) return json({ ready: false });
  return json({ ready: true, active: isAccessActive(access), ...accessInfo(access) });
}

async function webhook(req: Request) {
  const payload = await req.text();
  const secret = Netlify.env.get("STRIPE_WEBHOOK_SECRET") || "";
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret))
    return json({ error: "bad_signature" }, 400);

  const event = JSON.parse(payload);
  const obj = event.data?.object || {};
  const store = accessStore();

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    if (obj.payment_status === "unpaid") return json({ ok: true, skipped: "unpaid" });
    const access = accessFromSession(obj);
    await store.setJSON(obj.id, access);
    if (access.sub) await store.set(`sub/${access.sub}`, obj.id);
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const token = await store.get(`sub/${obj.id}`);
    if (token) {
      const access = (await store.get(token, { type: "json" })) as any;
      if (access) {
        access.active = event.type === "customer.subscription.updated" && SUB_ACTIVE.has(obj.status);
        await store.setJSON(token, access);
      }
    }
  }
  return json({ ok: true });
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api\//, "");
  try {
    if (route === "translate" && req.method === "POST") return await translate(req, context);
    if (route === "status") return await status(req, context);
    if (route === "app/translate" && req.method === "POST") return await appTranslate(req, context);
    if (route === "app/status") return await appStatus(req, context);
    if (route === "kurzbefehl" && req.method === "POST") return await kurzbefehl(req, url, context);
    if (route === "activate") return await activate(url);
    if (route === "stripe-webhook" && req.method === "POST") return await webhook(req);
    return json({ error: "not_found" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "Da ist etwas schiefgelaufen. Bitte nochmal versuchen." }, 500);
  }
};

export const config: Config = {
  path: "/api/*",
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
