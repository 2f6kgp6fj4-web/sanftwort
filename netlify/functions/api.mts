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
  parseModelJson,
  sha256,
  validateInput,
  verifyStripeSignature,
  weekKey,
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
  const input = validateInput(await req.json().catch(() => null));
  if ("error" in input) return json({ error: input.error }, 400);

  const access = await getAccess(req.headers.get("x-sw-token"));
  const pro = isAccessActive(access);
  const q = pro ? null : await quota(context);
  if (q && q.left <= 0) return json({ error: "limit", free: FREE_PER_WEEK }, 402);

  if (!process.env.ANTHROPIC_BASE_URL && !process.env.ANTHROPIC_API_KEY)
    return json({ error: "KI ist gerade nicht verfügbar." }, 503);

  const client = new Anthropic();
  let result;
  for (let attempt = 0; attempt < 2; attempt++) {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    });
    const text = msg.content.map((b: any) => (b.type === "text" ? b.text : "")).join("");
    try {
      result = parseModelJson(text);
      break;
    } catch (e) {
      console.error("parse failed", e, text.slice(0, 300));
    }
  }
  if (!result) return json({ error: "Das hat nicht geklappt. Bitte nochmal versuchen." }, 502);

  let left: number | null = null;
  if (q && !result.safety) {
    await quotaStore().set(q.key, String(q.used + 1));
    left = q.left - 1;
  }
  return json({ ...result, pro, left });
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
  rateLimit: { windowLimit: 40, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
