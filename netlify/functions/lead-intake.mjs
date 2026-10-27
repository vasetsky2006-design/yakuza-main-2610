/*! build 7.0.4 2026-10-18 */
const MAX_BODY_BYTES = 12_000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 8;
const recentRequests = new Map();

const allowedValues = {
  need: new Set([
    "Продажі та конверсію",
    "Клієнтський сервіс",
    "Контроль якості",
    "Операції та звіти",
    "Логістику або автопарк",
    "Маркетинг і соцмережі",
    "Інше"
  ]),
  role: new Set([
    "Власник / керівник",
    "Керівник продажів",
    "Керівник сервісу або якості",
    "Операційний керівник",
    "Люди / навчання",
    "Інше"
  ]),
  timing: new Set([
    "Цього тижня",
    "Цього місяця",
    "Поки досліджую варіанти",
    "Не визначився(-лась)"
  ]),
  // brief.html (data-flow="brief") — детальний бриф, другий крок воронки.
  teamSize: new Set(["1–4", "5–10", "11–25", "26–50", "51+"]),
  dialogs: new Set(["до 100", "100–500", "500–1 000", "1 000–5 000", "5 000+"]),
  channel: new Set(["Дзвінки", "Месенджери", "Електронна пошта", "Зустрічі"]),
  dataRights: new Set(["Підтверджено", "Перевіряємо", "Не підтверджено"]),
  changeOwner: new Set(["Призначено", "Ще не призначено"]),
  crmOutcomes: new Set(["Є", "Частково", "Немає"])
};

const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders
  },
  body: JSON.stringify(body)
});

const isWebRequest = (input) => Boolean(input && typeof input.method === "string" && input.headers?.get);

const responseFromLegacy = (result) => new Response(result.statusCode === 204 ? null : result.body, {
  status: result.statusCode,
  headers: result.headers
});

const trimmed = (value, max = 160) => typeof value === "string" ? value.trim().slice(0, max) : "";

function requestOrigin(event) {
  return event.headers?.origin || event.headers?.Origin || "";
}

function clientKey(event) {
  return event.headers?.["x-nf-client-connection-ip"]
    || event.headers?.["x-forwarded-for"]?.split(",")[0]?.trim()
    || "anonymous";
}

function isAllowedOrigin(event) {
  const origin = requestOrigin(event);
  const configured = process.env.LEAD_ALLOWED_ORIGIN?.trim();
  if (!origin) return true;
  // An explicit comma-separated allowlist replaces the production defaults.
  const allowed = configured ? configured.split(",").map(value => value.trim()).filter(Boolean) : [
    "https://yakuza.pp.ua",
    "https://www.yakuza.pp.ua",
    "https://yakuza-prodavai.netlify.app"
  ];
  return allowed.includes(origin);
}

function gateIsOpen() {
  return process.env.LEAD_ENDPOINT_ENABLED === "true"
    && process.env.LEGAL_GATE_APPROVED === "true";
}

function rateLimited(event) {
  const now = Date.now();
  const key = clientKey(event);
  const current = (recentRequests.get(key) || []).filter((stamp) => now - stamp < RATE_WINDOW_MS);
  if (current.length >= RATE_LIMIT) {
    recentRequests.set(key, current);
    return true;
  }
  current.push(now);
  recentRequests.set(key, current);
  return false;
}

// v7.0.4: обов'язковий контакт — телефон, @нік (Telegram/Instagram) або посилання t.me / instagram.com.
// Ті самі правила, що й у site.js (classifyContact).
function classifyContact(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || raw.length > 120) return "";
  const digits = raw.replace(/[\s().\-]/g, "");
  if (/^\+?\d{9,15}$/u.test(digits)) return "phone";
  if (/^@[A-Za-z0-9_.]{3,32}$/u.test(raw)) return "handle";
  if (/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/[A-Za-z0-9_+]{3,64}\/?$/iu.test(raw)) return "telegram_link";
  if (/^(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|ig\.me\/m)\/[A-Za-z0-9_.]{1,30}\/?(?:\?\S*)?$/iu.test(raw)) return "instagram_link";
  return "";
}

function validateContact(payload) {
  if (!payload || typeof payload !== "object") return "contact_required";
  const raw = typeof payload.lead_contact === "string" ? payload.lead_contact.trim() : "";
  if (!raw) return "contact_required";
  return classifyContact(raw) ? "" : "contact_invalid";
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "Некоректний формат заявки.";
  const flow = payload.flow === "brief" ? "brief" : "short";
  if (!allowedValues.need.has(payload.need) || !allowedValues.role.has(payload.role)) {
    return "Оберіть значення зі списку для кожного обов'язкового поля.";
  }
  if (payload.consent !== true) return "Потрібне підтвердження безпечного формату заявки.";
  if (trimmed(payload.segment, 80).length > 80) return "Значення сегмента завелике.";

  if (flow === "short") {
    if (!allowedValues.timing.has(payload.timing)) return "Оберіть значення зі списку для кожного обов'язкового поля.";
    return "";
  }

  // flow === "brief": детальний бриф має власний, ширший набір обов'язкових полів.
  if (!allowedValues.teamSize.has(payload.teamSize)) return "Оберіть значення зі списку для кожного обов'язкового поля.";
  if (!allowedValues.dialogs.has(payload.dialogs)) return "Оберіть значення зі списку для кожного обов'язкового поля.";
  if (!allowedValues.dataRights.has(payload.dataRights)) return "Оберіть значення зі списку для кожного обов'язкового поля.";
  if (!allowedValues.changeOwner.has(payload.changeOwner)) return "Оберіть значення зі списку для кожного обов'язкового поля.";
  if (!allowedValues.crmOutcomes.has(payload.crmOutcomes)) return "Оберіть значення зі списку для кожного обов'язкового поля.";
  const channels = Array.isArray(payload.channel) ? payload.channel : (payload.channel ? [payload.channel] : []);
  if (channels.length > 4 || channels.some((value) => !allowedValues.channel.has(value))) return "Некоректний вибір каналів.";
  return "";
}

function buildRecord(payload) {
  const flow = payload.flow === "brief" ? "brief" : "short";
  const base = {
    flow,
    need: payload.need,
    role: payload.role,
    segment: trimmed(payload.segment, 80),
    consent: true,
    lead_name: trimmed(payload.lead_name, 120),
    lead_company: trimmed(payload.lead_company, 160),
    lead_contact: trimmed(payload.lead_contact, 120),
    source: "yakuza-sales-site",
    receivedAt: new Date().toISOString()
  };
  if (flow === "short") return { ...base, timing: payload.timing };
  const channels = Array.isArray(payload.channel) ? payload.channel : (payload.channel ? [payload.channel] : []);
  return {
    ...base,
    teamSize: payload.teamSize,
    dialogs: payload.dialogs,
    channel: channels.filter((value) => allowedValues.channel.has(value)).slice(0, 4).join(", "),
    dataRights: payload.dataRights,
    changeOwner: payload.changeOwner,
    crmOutcomes: payload.crmOutcomes
  };
}

export default async function handler(input) {
  // Netlify's ESM runtime calls a default export with a Web Request. Keep the
  // legacy event path for contract tests and older local adapters, but always
  // return a Web Response to Netlify so the function cannot surface a 502.
  const webRequest = isWebRequest(input);
  const event = webRequest
    ? {
        httpMethod: input.method,
        headers: Object.fromEntries(input.headers.entries()),
        body: ""
      }
    : input;
  const respond = (result) => webRequest ? responseFromLegacy(result) : result;
  const originHeaders = requestOrigin(event) && isAllowedOrigin(event) ? { "access-control-allow-origin": requestOrigin(event), vary: "Origin" } : {};
  if (event.httpMethod !== "POST") return respond(json(405, { ok: false, code: "method_not_allowed" }, { allow: "POST", ...originHeaders }));
  if (!isAllowedOrigin(event)) return respond(json(403, { ok: false, code: "origin_not_allowed" }, originHeaders));

  // The default is fail-closed. Do not parse the body while the legal gate is closed.
  if (!gateIsOpen()) return respond(json(503, { ok: false, code: "endpoint_disabled" }, originHeaders));
  if (rateLimited(event)) return respond(json(429, { ok: false, code: "rate_limited" }, originHeaders));

  const body = webRequest ? await input.text() : (typeof event.body === "string" ? event.body : "");
  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) return respond(json(413, { ok: false, code: "body_too_large" }, originHeaders));

  let payload;
  try {
    payload = JSON.parse(body || "{}");
  } catch {
    return respond(json(400, { ok: false, code: "invalid_json" }, originHeaders));
  }

  if (trimmed(payload["bot-field"] || payload.website, 120)) return respond(json(204, { ok: false, code: "spam_rejected" }, originHeaders));
  const validationError = validatePayload(payload);
  if (validationError) return respond(json(400, { ok: false, code: "invalid_payload" }, originHeaders));
  const contactError = validateContact(payload);
  if (contactError) return respond(json(400, { ok: false, code: contactError }, originHeaders));

  const sinkUrl = process.env.LEAD_SINK_URL?.trim();
  if (!sinkUrl) return respond(json(503, { ok: false, code: "sink_not_configured" }, originHeaders));
  let parsedSink;
  try { parsedSink = new URL(sinkUrl); } catch { return respond(json(503, { ok: false, code: "sink_not_configured" }, originHeaders)); }
  if (!/^https?:$/u.test(parsedSink.protocol)) return respond(json(503, { ok: false, code: "sink_not_configured" }, originHeaders));

  const headers = { "content-type": "application/json", "x-yakuza-lead-token": process.env.LEAD_SINK_TOKEN || "" };
  let upstream;
  try {
    upstream = await fetch(parsedSink, {
      method: "POST",
      headers,
      body: JSON.stringify(buildRecord(payload)),
      signal: AbortSignal.timeout(8_000)
    });
  } catch {
    return respond(json(502, { ok: false, code: "sink_unavailable" }, originHeaders));
  }
  if (!upstream.ok) return respond(json(502, { ok: false, code: "sink_rejected" }, originHeaders));

  // Some sinks (e.g. a Google Apps Script Web App) can only ever reply with a
  // real HTTP 200 — they have no way to set a custom status code — so an
  // app-level failure (bad token, sheet error) still looks like upstream.ok
  // above. Peek at the JSON body and treat an explicit ok:false as a rejection
  // too, so a misconfigured sink fails loudly instead of silently losing leads.
  let upstreamBody;
  try {
    upstreamBody = await upstream.json();
  } catch {
    upstreamBody = null;
  }
  if (upstreamBody && upstreamBody.ok === false) {
    return respond(json(502, { ok: false, code: "sink_rejected" }, originHeaders));
  }

  return respond(json(200, { ok: true }, originHeaders));
}

export const __test = { gateIsOpen, validatePayload, validateContact, classifyContact, buildRecord };
