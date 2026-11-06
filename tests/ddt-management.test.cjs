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
