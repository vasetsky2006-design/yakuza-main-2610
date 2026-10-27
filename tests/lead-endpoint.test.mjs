import assert from "node:assert/strict";
import handler, { __test } from "../netlify/functions/lead-intake.mjs";

const previousEnabled = process.env.LEAD_ENDPOINT_ENABLED;
const previousLegal = process.env.LEGAL_GATE_APPROVED;
process.env.LEAD_ENDPOINT_ENABLED = "false";
process.env.LEGAL_GATE_APPROVED = "false";
assert.equal(__test.gateIsOpen(), false, "lead endpoint must fail closed by default");
const disabledResponse = await handler({
  httpMethod: "POST",
  headers: {},
  body: JSON.stringify({ lead_contact: "should-not-be-read@example.com" })
});
assert.equal(disabledResponse.statusCode, 503, "closed gate must reject before parsing or delivery");
assert.match(disabledResponse.body, /endpoint_disabled/u, "closed gate should return a non-PII reason");

const webResponse = await handler(new Request("https://yakuza-prodavai.netlify.app/.netlify/functions/lead-intake", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ lead_contact: "should-not-be-read@example.com" })
}));
assert.equal(webResponse.status, 503, "Netlify Web Request path must fail closed before parsing or delivery");
assert.match(await webResponse.text(), /endpoint_disabled/u, "Web Response should return a non-PII reason");

const valid = {
  need: "Продажі та конверсію",
  role: "Власник / керівник",
  timing: "Цього тижня",
  segment: "Відділ продажів",
  consent: true,
  lead_name: "Ім'я тесту",
  lead_company: "Компанія тесту",
  lead_contact: "+380 67 123 45 67"
};
assert.equal(__test.validatePayload(valid), "", "valid payload should pass schema");
assert.notEqual(__test.validatePayload({ ...valid, consent: false }), "", "consent is required");
assert.notEqual(__test.validatePayload({ ...valid, need: "вигадане значення" }), "", "need must use the allowlist");
assert.equal(__test.buildRecord(valid).lead_contact, valid.lead_contact, "record preserves contact only after the gate");

// v7.0.4: contact (phone, Telegram or Instagram) is required server-side.
assert.equal(__test.validateContact(valid), "", "phone contact passes");
for (const ok of ["0671234567", "+380 (67) 123-45-67", "@yakuza_sales", "t.me/yakuza_sales", "https://t.me/yakuza_sales", "https://www.instagram.com/yakuza_sales/"]) {
  assert.equal(__test.validateContact({ lead_contact: ok }), "", `accepted contact: ${ok}`);
}
assert.equal(__test.validateContact({ ...valid, lead_contact: "" }), "contact_required", "empty contact is rejected");
assert.equal(__test.validateContact({ ...valid, lead_contact: "   " }), "contact_required", "blank contact is rejected");
assert.equal(__test.validateContact({ need: valid.need }), "contact_required", "missing contact is rejected");
for (const bad of ["hello", "12345", "@ab", "test@example.com", "x".repeat(130)]) {
  assert.equal(__test.validateContact({ lead_contact: bad }), "contact_invalid", `rejected contact: ${bad.slice(0, 20)}`);
}

const validBrief = {
  flow: "brief",
  need: "Продажі та конверсію",
  role: "Керівник продажів",
  teamSize: "5–10",
  dialogs: "100–500",
  channel: ["Дзвінки", "Месенджери"],
  dataRights: "Підтверджено",
  changeOwner: "Призначено",
  crmOutcomes: "Є",
  segment: "Відділ продажів",
  consent: true,
  lead_name: "Ім'я тесту",
  lead_company: "Компанія тесту",
  lead_contact: "+380 67 123 45 67"
};
assert.equal(__test.validatePayload(validBrief), "", "valid brief payload should pass schema");
assert.notEqual(__test.validatePayload({ ...validBrief, teamSize: "вигадане значення" }), "", "brief teamSize must use the allowlist");
assert.notEqual(__test.validatePayload({ ...validBrief, channel: ["Не існує"] }), "", "brief channel must use the allowlist");
const briefRecord = __test.buildRecord(validBrief);
assert.equal(briefRecord.flow, "brief", "brief record keeps its flow discriminator");
assert.equal(briefRecord.channel, "Дзвінки, Месенджери", "brief record flattens channel selections to a readable string");
assert.equal(briefRecord.timing, undefined, "brief record must not carry the short-flow timing field");
assert.equal(__test.buildRecord(valid).flow, "short", "short-flow record defaults its flow discriminator when absent from the payload");

// Open-gate delivery path: an Apps Script style sink can only ever answer
// with a real HTTP 200 (no custom status codes), so a bad-token or sheet
// error still looks like upstream.ok — the handler must peek at the JSON
// body's `ok` field to catch that instead of silently reporting success.
process.env.LEAD_ENDPOINT_ENABLED = "true";
process.env.LEGAL_GATE_APPROVED = "true";
process.env.LEAD_SINK_URL = "https://script.google.com/macros/s/fake/exec?token=fake";
const previousFetch = globalThis.fetch;

globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, code: "unauthorized" }), { status: 200 });
const rejectedSinkResponse = await handler({
  httpMethod: "POST",
  headers: {},
  body: JSON.stringify(valid)
});
assert.equal(rejectedSinkResponse.statusCode, 502, "an app-level sink failure disguised as HTTP 200 must still be rejected");
assert.match(rejectedSinkResponse.body, /sink_rejected/u);

globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
const acceptedSinkResponse = await handler({
  httpMethod: "POST",
  headers: {},
  body: JSON.stringify(valid)
});
assert.equal(acceptedSinkResponse.statusCode, 200, "a genuine sink success must be reported to the client");
assert.match(acceptedSinkResponse.body, /"ok":true/u);

// Missing / invalid contact must be rejected with 400 before any sink call.
let sinkCalls = 0;
globalThis.fetch = async () => { sinkCalls += 1; return new Response(JSON.stringify({ ok: true }), { status: 200 }); };
const { lead_contact: _omit, ...noContact } = valid;
const missingContactResponse = await handler({ httpMethod: "POST", headers: {}, body: JSON.stringify(noContact) });
assert.equal(missingContactResponse.statusCode, 400, "missing contact must be rejected with 400");
assert.match(missingContactResponse.body, /contact_required/u);
const invalidContactResponse = await handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ ...valid, lead_contact: "hello" }) });
assert.equal(invalidContactResponse.statusCode, 400, "malformed contact must be rejected with 400");
assert.match(invalidContactResponse.body, /contact_invalid/u);
const noConsentResponse = await handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ ...valid, consent: false }) });
assert.equal(noConsentResponse.statusCode, 400, "consent gating still rejects consent:false");
assert.equal(sinkCalls, 0, "rejected payloads must never reach the sink");
const briefNoContact = await handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ ...validBrief, lead_contact: "" }) });
assert.equal(briefNoContact.statusCode, 400, "brief flow also requires contact");

globalThis.fetch = previousFetch;
delete process.env.LEAD_SINK_URL;

if (previousEnabled === undefined) delete process.env.LEAD_ENDPOINT_ENABLED;
else process.env.LEAD_ENDPOINT_ENABLED = previousEnabled;
if (previousLegal === undefined) delete process.env.LEGAL_GATE_APPROVED;
else process.env.LEGAL_GATE_APPROVED = previousLegal;
console.log("lead endpoint contract tests passed");
