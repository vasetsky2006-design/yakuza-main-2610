import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/lead-intake.mjs';
const keys = ['LEAD_ENDPOINT_ENABLED','LEGAL_GATE_APPROVED','LEAD_ALLOWED_ORIGIN','LEAD_SINK_URL','LEAD_SINK_TOKEN'];
const payload = {need:'Продажі та конверсію',role:'Власник / керівник',timing:'Цього місяця',consent:true,lead_contact:'@local_contract_test'};
const request = (body=payload, origin='https://yakuza.pp.ua') => new Request('https://yakuza.pp.ua/.netlify/functions/lead-intake', {method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
async function isolated(run) {
  const env=Object.fromEntries(keys.map(k=>[k,process.env[k]])),originalFetch=globalThis.fetch;
  for(const k of keys)delete process.env[k];
  try{await run();}finally{for(const k of keys){if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}globalThis.fetch=originalFetch;}
}
test('disabled intake cannot deliver leads',()=>isolated(async()=>{
  let calls=0;globalThis.fetch=async()=>{calls++;throw Error('No real upstream allowed');};
  const r=await handler(request());assert.equal(r.status,503);assert.equal((await r.json()).code,'endpoint_disabled');assert.equal(calls,0);
}));
test('foreign origins are rejected without reflecting CORS',()=>isolated(async()=>{
  for(const origin of ['https://evil.example','https://yakuza.pp.ua.evil.example','http://yakuza.pp.ua']){
    const r=await handler(request({},origin));assert.equal(r.status,403);assert.equal(r.headers.get('access-control-allow-origin'),null);
  }
  process.env.LEAD_ALLOWED_ORIGIN='https://yakuza.pp.ua, https://www.yakuza.pp.ua';
  assert.equal((await handler(request({},'https://www.yakuza.pp.ua'))).status,503);
}));
test('honeypot returns an empty valid Web Response',()=>isolated(async()=>{
  process.env.LEAD_ENDPOINT_ENABLED='true';process.env.LEGAL_GATE_APPROVED='true';
  const r=await handler(request({...payload,website:'spam'}));assert.equal(r.status,204);assert.equal(await r.text(),'');
}));
