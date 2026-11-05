const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const path=require('node:path'),root=path.resolve(__dirname,'..');
async function edge(name,role,action,active=true){
 let handler,calls=0;
 const service={auth:{getUser:async()=>({data:{user:{id:'actor',email:'test@example.invalid'}}})},from:()=>{const q={select:()=>q,eq:()=>q,single:async()=>({data:{role,active}})};return q;},rpc:async()=>{calls++;return {data:1};}};
 const raw=fs.readFileSync(path.join(root,'supabase/functions',name,'index.ts'),'utf8').replace(/^import .*;\r?\n/,'');
 vm.runInNewContext(ts.transpileModule(raw,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{createClient:()=>service,Response,Date,Number,Deno:{env:{get:()=>''},serve:fn=>handler=fn}});
 const res=await handler(new Request('https://test.invalid',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({action,orderId:'order',workId:'work',clientId:'client',expectedRevision:1})}));return {status:res.status,calls};
}
async function invoice(statuses,action='verify',role='admin'){
 let calls=0;const methods=[];
 class FicError extends Error{constructor(m,status=400){super(m);this.status=status;}}
 const db={from:()=>{const q={select:()=>q,eq:()=>q,single:async()=>({data:{company_id:1,remote_id:2}}),limit:async()=>({})};return q;},rpc:async()=>{calls++;return {};}};
 const code=ts.transpileModule(fs.readFileSync(path.join(root,'src/app/api/fatture-in-cloud/invoices/remove/route.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,process:{env:{SUPABASE_SECRET_KEY:'test',NEXT_PUBLIC_SUPABASE_URL:'https://test.invalid'}},Response,AbortSignal,fetch:async(url,opts)=>{methods.push(opts.method||'GET');const status=statuses.shift();assert.ok(status,'unexpected fetch');return new Response(status===200?JSON.stringify({data:{id:2,type:'invoice'}}):null,{status});},require:n=>n==='@supabase/supabase-js'?{createClient:()=>db}:{FicError,admin:async()=>{if(role!=='admin')throw new FicError('Forbidden',403);return {db,userId:'actor'};},bearer:()=>'',sameOrigin:()=>{},connection:async()=>({row:{company_id:1},tokens:{access_token:'test'}}),failure:e=>Response.json({error:e.message},{status:e.status||502})}});
 const result=await exports.POST(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({draftId:'draft',action,confirm:true})}));return {status:result.status,calls,methods};
}
(async()=>{
 for(const name of ['raia-admin','raia-delete-work']){assert.deepEqual(await edge(name,'operator','delete-order'),{status:200,calls:1});assert.equal((await edge(name,'operator','delete-order',false)).calls,0);}
 assert.equal((await edge('raia-admin','operator','delete-client')).status,403);assert.equal((await edge('raia-admin','admin','delete-client')).status,200);
 assert.equal((await invoice([404,200])).calls,1);
 assert.equal((await invoice([200])).calls,0);
 for(const status of [401,403,429,500])assert.equal((await invoice([status])).calls,0);
 assert.equal((await invoice([404,403])).calls,0);
 assert.equal((await invoice([200,204,404,200],'delete')).calls,1);
 assert.equal((await invoice([200,403],'delete')).calls,0);
 assert.equal((await invoice([200,204,200],'delete')).calls,0);
 assert.equal((await invoice([],'delete','operator')).status,403);
 console.log('PASS deletion without password, active session/role guards, remote 404 reconciliation, API failure preservation, confirmed deletion.');
})().catch(e=>{console.error(e);process.exitCode=1;});
