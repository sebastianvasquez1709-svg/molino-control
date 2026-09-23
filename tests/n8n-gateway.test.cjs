'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
let createHandler;
before(async()=>{({createHandler}=await import('../supabase/functions/molino-n8n-trigger/handler.mjs'));});
const token='unit-test-token';
const id='11111111-1111-4111-8111-111111111111';
function req(body,header=token){return new Request('https://example.test',{method:'POST',headers:{'content-type':'application/json',...(header?{'x-molino-n8n-token':header}:{})},body:JSON.stringify(body)});}
function setup(replies){const calls=[],logs=[]; const fn=createHandler({supabaseUrl:'https://project.supabase.co',serviceKey:'test-service-key',log:x=>logs.push(x),randomUUID:()=>id,fetchFn:async(url,options)=>{calls.push({url,options,body:JSON.parse(options.body)});const x=replies.shift();assert.ok(x,'unexpected downstream request');return new Response(JSON.stringify(x.body),{status:x.status||200});}});return{fn,calls,logs};}
test('no token is rejected before any downstream call',async()=>{const {fn,calls}=setup([]);assert.equal((await fn(req({action:'health'},null))).status,401);assert.equal(calls.length,0);});
test('bad token is not treated as a database outage',async()=>{const {fn}=setup([{status:403,body:{code:'42501'}}]);const r=await fn(req({action:'health'}));assert.equal(r.status,401);assert.equal((await r.json()).error,'invalid_token');});
test('unknown actions and extra RPC arguments cannot reach SQL',async()=>{let x=setup([]);assert.equal((await x.fn(req({action:'delete_everything'}))).status,400);x=setup([{body:true}]);assert.equal((await x.fn(req({action:'claim',params:{p_worker_id:'w',p_limit:1,other:'bad'}}))).status,400);assert.equal(x.calls.length,1);});
test('rate limit is explicit and retryable',async()=>{const {fn}=setup([{body:false}]);const r=await fn(req({action:'health'}));assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'60');});
test('signed file URL requires current lease and uses the storage prefix',async()=>{
 const x=setup([{body:true},{body:[{job_id:id,storage_path:'u/hash/file.xlsx',checksum_sha256:'a'.repeat(64),kind:'maestro'}]},{body:{signedURL:'/object/sign/excel-imports/u/hash/file.xlsx?token=TEST'}}]);
 const r=await x.fn(req({action:'file',params:{p_job_id:id,p_worker_id:'w'}}));assert.equal(r.status,200);const body=await r.json();assert.equal(body.data.signed_url,'https://project.supabase.co/storage/v1/object/sign/excel-imports/u/hash/file.xlsx?token=TEST');
 assert.equal(x.calls[2].body.expiresIn,300);assert.ok(!x.logs.join('').includes(token));assert.ok(!x.logs.join('').includes('TEST'));assert.ok(!JSON.stringify(body).includes('test-service-key'));
 const y=setup([{body:true},{body:[]}]);assert.equal((await y.fn(req({action:'file',params:{p_job_id:id,p_worker_id:'other'}}))).status,409);
});
test('unexpected signed URL cannot be used for SSRF',async()=>{const {fn}=setup([{body:true},{body:[{job_id:id,storage_path:'u/file.xlsx'}]},{body:{signedURL:'https://evil.test/file'}}]);assert.equal((await fn(req({action:'file',params:{p_job_id:id,p_worker_id:'w'}}))).status,502);});
test('expired heartbeat or empty close does not report success',async()=>{for(const action of ['heartbeat','finish']){const {fn}=setup([{body:true},{body:action==='heartbeat'?false:[]}]);assert.equal((await fn(req({action,params:{p_job_id:id,p_worker_id:'w'}}))).status,409);}});
test('oversized requests are rejected before SQL',async()=>{const {fn,calls}=setup([]);const r=await fn(req({action:'health',payload:'x'.repeat(2*1024*1024)}));assert.equal(r.status,413);assert.equal(calls.length,0);});
