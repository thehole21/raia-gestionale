const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const code=ts.transpileModule(fs.readFileSync('src/app/api/fatture-in-cloud/documents/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
async function request(query,get){const exports={};vm.runInNewContext(code,{exports,URL,Response,process:{env:{SUPABASE_SECRET_KEY:'test',NEXT_PUBLIC_SUPABASE_URL:'https://test.invalid'}},require:name=>{
if(name==='node:crypto')return require(name);
if(name==='@supabase/supabase-js')return {createClient:()=>({})};
if(name==='@/lib/fic-ddt-status')return require('../lib/fic-ddt-status.ts');
if(name==='@/lib/fic-server')return {admin:async()=>({}),bearer:()=>'',connection:async()=>({row:{company_id:1},tokens:{access_token:'token'}}),ficGet:get,FicError:Error,failure:e=>Response.json({error:e.message},{status:500})};
return {};
}});return (await exports.GET(new Request('https://test.invalid?mode=relations&'+query))).json();}
(async()=>{
let r=await request('type=invoice&ids=90&page=1',async()=>({data:[{id:1,type:'delivery_note',merged_in:90},{id:2,type:'delivery_note',merged_in:{id:90}},{id:3,merged_in:91}],last_page:2}));
assert.deepEqual(r.links.map(l=>l.document.id),[1,2]);assert.equal(r.next,2);
r=await request('type=invoice&ids=90&page=2',async()=>({data:[{id:4,type:'delivery_note',merged_in:90},{id:5}],last_page:2}));assert.equal(r.links[0].document.id,4);assert.equal(r.next,null);assert.equal(r.unknown,true);
r=await request('type=delivery_note&ids=1,2,3,4',async(_,url)=>{const id=Number(url.split('/').pop().split('?')[0]);if(id===1)return {data:{merged_in:90}};if(id===90)return {data:{id:90,type:'invoice',number:7}};if(id===2)return {data:{merged_in:null}};if(id===3)return {data:{merged_in:91}};if(id===91)return {data:{id:91,type:'quote'}};throw Error('unavailable');});
assert.equal(r.links.length,1);assert.equal(r.links[0].document.number,7);assert.deepEqual(r.unknown.sort(),[3,4]);
console.log('PASS bidirectional links, multiple DDTs, pagination, unlinked documents and unknown/error safety.');
})().catch(e=>{console.error(e);process.exitCode=1;});
