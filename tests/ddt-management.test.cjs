const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),path=require('node:path');
function load(file,globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:()=>({}),...globals});return exports;}
const {ddtInvoiceLink}=load('lib/fic-ddt-status.ts');
assert.equal(ddtInvoiceLink({merged_in:null}).state,'unbilled');
assert.equal(ddtInvoiceLink({}).state,'unknown');
assert.equal(ddtInvoiceLink({merged_in:{id:12}}).id,12);
assert.equal(ddtInvoiceLink({merged_in:'12'}).id,12);
for(const merged_in of [true,{},'unknown',0])assert.equal(ddtInvoiceLink({merged_in}).state,'unknown');
assert.equal(ddtInvoiceLink({is_marked:true,merged_in:null}).state,'unbilled');
class FicError extends Error{constructor(message,status=400){super(message);this.status=status;}}
async function check(statuses,remove=false,{type='delivery_note',setup=false,rpcError=false}={}){
 let calls=0;const methods=[];
 const db={from:()=>({select:()=>({limit:async()=>({error:setup?{}:null})})}),rpc:async()=>{calls++;return {error:rpcError?{}:null};}};
 const {inspectDdt}=load('lib/fic-ddt-management.ts',{require:()=>({FicError}),AbortSignal,fetch:async(url,opts)=>{methods.push(opts.method);const status=statuses.shift();assert.ok(status,'unexpected fetch');if(status==='timeout')throw Error('timeout');return new Response(status===200?JSON.stringify({data:{id:2,type,number:9}}):null,{status});}});
 try{return {result:await inspectDdt({db,userId:'actor'},'token',1,2,remove),calls,methods};}catch(e){return {error:e.message,calls,methods};}
}
(async()=>{
 assert.equal((await check([200])).calls,0);
 assert.equal((await check([404,200])).calls,1);
 assert.equal((await check([200,200,404,200],true)).calls,1);
 for(const status of [401,403,429,500,'timeout'])assert.equal((await check([status])).calls,0);
 assert.equal((await check([404,403])).calls,0);
 assert.equal((await check([200,403],true)).calls,0);
 assert.equal((await check([200,200,200],true)).calls,0);
 assert.equal((await check([200],true,{type:'invoice'})).calls,0);
 assert.equal((await check([],true,{setup:true})).methods.length,0);
 assert.ok((await check([404,200],false,{rpcError:true})).error);
 console.log('PASS DDT deletion, exact 404 + company verification, failure preservation, invoice type protection, status from remote links only.');
})().catch(e=>{console.error(e);process.exitCode=1;});

(async()=>{
 const calls=[];
 const mocks={ddtContext:async()=>({}),bearer:()=> 'token',connection:async()=>({tokens:{access_token:'token'},row:{company_id:1}}),sameOrigin:()=>{},FicError,ddtInvoiceLink,
 failure:e=>new Response(JSON.stringify({error:e.message}),{status:e.status||500}),
 ficGet:async(token,url)=>{calls.push(url);if(url.includes('?type=delivery_note'))return {data:[{id:1,number:1,merged_in:{id:10}},{id:2,number:2,merged_in:null}],current_page:1,last_page:2,total:30};if(url.includes('/10?'))return {data:{id:10,type:'invoice',number:7}};throw Error('API unavailable');}};
 const route=load('src/app/api/fatture-in-cloud/ddt/manage/route.ts',{require:()=>mocks,Response,URL});
 const listed=await (await route.GET({url:'https://local.test?page=1'})).json();
 assert.equal(calls.length,1,'list must not wait for linked invoices');
 assert.equal(listed.documents[0].state,'unknown');assert.equal(listed.documents[0].invoiceId,10);assert.equal(listed.documents[1].state,'unbilled');assert.equal(listed.next,2);
 const checked=await (await route.POST({json:async()=>({action:'verify-invoices',ids:[10,10,11]})})).json();
 assert.equal(checked.invoices.length,2);assert.equal(checked.invoices[0].state,'billed');assert.equal(checked.invoices[1].state,'unknown');assert.equal(calls.length,3,'deduplicate invoice checks');
 const invalid=await route.POST({json:async()=>({action:'verify-invoices',ids:[-1]})});assert.equal(invalid.status,400);
 console.log('PASS immediate DDT list, deferred invoice checks, deduplication and API failure safety.');
})().catch(e=>{console.error(e);process.exitCode=1;});
