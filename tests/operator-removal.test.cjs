const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=process.env.RAIA_PROJECT||path.resolve(__dirname,'..'),ts=require(path.join(root,'node_modules/typescript'));
const raw=fs.readFileSync(path.join(root,'supabase/functions/raia-admin/index.ts'),'utf8').replace(/^import .*;\r?\n/,'');
const code=ts.transpileModule(raw,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
async function run(actorRole,targetRole,targetTitle,targetId='target',actorActive=true){
 const profiles=[{id:'actor',role:actorRole,active:actorActive},{id:'target',name:'Staff',role:targetRole,title:targetTitle,active:true}];let handler;
 const service={auth:{getUser:async()=>({data:{user:{id:'actor',email:'test@example.invalid'}}})},from:()=>{let filters=[],patch;const query={
  select(){return query;},eq(k,v){filters.push([k,v]);return query;},
  update(v){patch=v;return query;},async single(){const row=profiles.find(p=>filters.every(([k,v])=>p[k]===v));if(!row)return {error:{message:'missing'}};if(patch)Object.assign(row,patch);return {data:row};}
 };return query;}};
 vm.runInNewContext(code,{createClient:()=>service,Response,Date,Number,Deno:{env:{get:()=>''},serve:fn=>handler=fn}});
 const response=await handler(new Request('https://test.invalid',{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify({action:'remove',id:targetId})}));
 return {status:response.status,profiles};
}
(async()=>{
 let r=await run('admin','operator',null);assert.equal(r.status,200);assert.equal(r.profiles[1].active,false);assert.ok(r.profiles[1].deleted_at);
 for(const args of [['operator','operator',null],['admin','admin',null],['admin','operator','Tecnico'],['admin','operator',null,'actor'],['admin','operator',null,'target',false]]){
  r=await run(...args);assert.ok(r.status>=400);assert.equal(r.profiles[1].active,true);
 }
 console.log('PASS admin removal, operator denial, inactive actor, self/admin/Technician protection and logical history preservation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
