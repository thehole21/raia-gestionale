const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {cleanDocument,validateDocument,transformTypes,documentSchema}=require('../lib/fic-documents.ts');
const good={type:'quote',entity:{id:12,name:'Test'},date:'2026-11-05',items_list:[{name:'Libri',qty:20,net_price:2,vat:{id:0}}]};
assert.equal(cleanDocument({...good,id:99,number:123,amount_net:99,url:'https://invalid',unknown:'bad'}).id,undefined);
assert.equal(cleanDocument({...good,number:123}).number,undefined);
assert.equal(cleanDocument({...good,unknown:'bad'}).unknown,undefined);
assert.equal(cleanDocument({...good,amount_net:123}).amount_net,undefined);
assert.doesNotThrow(()=>validateDocument(cleanDocument(good)));
for(const doc of [{...good,date:'2026-02-30'},{...good,items_list:[]},{...good,items_list:[{name:'x',qty:0,net_price:1,vat:{id:0}}]},{...good,entity:{}}])assert.throws(()=>validateDocument(doc));
assert.throws(()=>cleanDocument({...good,cassa:Infinity}));
assert.deepEqual(transformTypes.quote,['order','proforma','receipt','invoice']);assert.equal(transformTypes.invoice,undefined);assert.deepEqual(transformTypes.delivery_note,['invoice']);
assert.ok(Object.keys(documentSchema.properties).length>70);
const source=fs.readFileSync(path.join(__dirname,'../src/app/api/fatture-in-cloud/documents/route.ts'),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
async function run({action='create',role='admin',status='prepared',claimError=false,remoteStatus=200,remoteThrows=false,sourceType,sourceTarget='invoice'}={}){
 const op={id:'00000000-0000-4000-8000-000000000001',company_id:1,status,request_data:good,options:{keep_copy:true},remote_id:10,source_id:null};let posts=0,claims=0,finishes=0;const patches=[],paths=[];
 const crypto=require('node:crypto'),hash=crypto.createHash('sha256').update(JSON.stringify(good)).digest('hex');
 const db={from:()=>{const q={select:()=>q,eq:()=>q,single:async()=>({data:op}),update:v=>{patches.push(v);return q;}};return q;},rpc:async(name)=>{if(name==='raia_claim_document'){claims++;return {error:claimError?{}:null};}finishes++;return {};}};
 class FicError extends Error{constructor(m,status=400){super(m);this.status=status;}}
 const exports={};vm.runInNewContext(code,{exports,process:{env:{SUPABASE_SECRET_KEY:'test',NEXT_PUBLIC_SUPABASE_URL:'https://test.invalid'}},URL,Response,AbortSignal,fetch:async()=>{posts++;if(remoteThrows)throw Error('timeout');return Response.json(remoteStatus===200?{data:{id:10,number:3,type:'quote'}}:{error:{message:'invalid'}},{status:remoteStatus});},require:n=>{
  if(n==='node:crypto')return crypto;if(n==='@supabase/supabase-js')return {createClient:()=>db};if(n==='@/lib/fic-documents')return require('../lib/fic-documents.ts');if(n==='@/lib/fic-document-match')return require('../lib/fic-document-match.ts');if(n==='@/lib/order-groups')return {};
  return {FicError,bearer:()=>'',sameOrigin:()=>{},admin:async()=>{if(role!=='admin')throw new FicError('forbidden',403);return {db,userId:'actor'};},connection:async()=>({row:{company_id:1},tokens:{access_token:'test'}}),unseal:()=>({id:op.id,user:'actor',company:1,hash,expires:Date.now()+10000}),ficGet:async(t,url)=>{paths.push(url);if(url.includes('/info'))return {data:{}};if(url.includes('/transform')||url.includes('/join'))return {data:good,options:{keep_copy:true}};return {data:{...good,id:10,type:sourceType||'quote'}};},failure:e=>Response.json({error:e.message},{status:e.status||502})};
 }});
 const response=action==='editor'?await exports.GET(new Request('https://test.invalid?mode=editor&type='+sourceTarget+'&sourceId=10')):await exports.POST(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({action,confirmation:'signed'})}));
 return {status:response.status,posts,claims,finishes,patches,paths};
}
(async()=>{
 let r=await run();assert.equal(r.status,200);assert.equal(r.posts,1);assert.equal(r.finishes,1);
 r=await run({role:'operator'});assert.equal(r.status,403);assert.equal(r.posts,0);
 r=await run({claimError:true});assert.equal(r.posts,0);assert.equal(r.status,409);
 r=await run({status:'created'});assert.equal(r.posts,0);assert.equal(r.claims,0);
 for(const settings of [{remoteStatus:500},{remoteThrows:true}]){r=await run(settings);assert.equal(r.status,409);assert.equal(r.finishes,0);assert.ok(r.patches.some(p=>p.status==='reconcile'));}
 r=await run({remoteStatus:422});assert.equal(r.status,422);assert.ok(r.patches.some(p=>p.status==='failed'));
 r=await run({action:'editor',sourceType:'quote'});assert.equal(r.posts,0);assert.ok(r.paths.some(p=>p.includes('/transform?')&&p.includes('transform_keep_copy=1')));
 r=await run({action:'editor',sourceType:'delivery_note'});assert.ok(r.paths.some(p=>p.includes('/join?')));
 r=await run({action:'editor',sourceType:'invoice'});assert.equal(r.status,400);
 console.log('PASS FIC document fields, fiscal numbering, permitted transformations, admin-only writes, duplicate prevention, uncertain outcomes and no creation during preview.');
})().catch(e=>{console.error(e);process.exitCode=1;});
