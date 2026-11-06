const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),path=require('node:path');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,file);
const clean=require('../lib/fic-documents.ts'),status=require('../lib/fic-ddt-status.ts');
class FicError extends Error{constructor(message,status=400){super(message);this.status=status;}}
function setup({mixed=false,linked=false,missing=false,badOptions=false}={}){
 const paths=[],options={create_from:['1','2'],custom_official_option:'preserved'},sources=[1,2].map(id=>({id,type:'delivery_note',number:id,entity:{id:mixed?id:10,name:'Cliente'},merged_in:linked?{id:99}:null}));if(missing)delete sources[0].merged_in;
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/fic-ddt-join.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>n.includes('fic-documents')?clean:n.includes('fic-ddt-status')?status:{FicError,ficGet:async(token,url)=>{paths.push(url);if(url.includes('/join?'))return {data:{type:'invoice',entity:{id:10,name:'Cliente'},items_list:[{name:'Righe ufficiali',qty:url.includes('group=1')?4:2,net_price:5,vat:{id:0}}]},options:badOptions?{create_from:['1']}:options};return {data:sources.find(s=>url.endsWith('/'+s.id))};}}});return {...exports,paths,options,sources};
}
(async()=>{
 const api=setup();for(const ids of [[],[1,1],[0],['1'],[1.2]])assert.throws(()=>api.joinIds(ids));
 for(const group of [false,true]){const result=await api.joinDdtData('token',4,[1,2],group);assert.equal(result.options,api.options);assert.equal(result.data.items_list[0].qty,group?4:2);assert.ok(api.paths.some(p=>p===`/c/4/issued_documents/join?ids=1,2&group=${group?1:0}&e_invoice=1`));}
 for(const config of [{mixed:true},{linked:true},{missing:true},{badOptions:true}]){const check=setup(config);await assert.rejects(()=>check.joinDdtData('t',4,[1,2],false));if(!config.badOptions)assert.ok(!check.paths.some(p=>p.includes('/join?')));}
 const verify=setup({linked:true});await verify.verifyJoinedInvoice('t',4,[1,2],99);await assert.rejects(()=>verify.verifyJoinedInvoice('t',4,[1,2],100));
 console.log('PASS official join/group endpoints, unchanged API options, remote-generated rows, same customer, linked/unknown DDT rejection and exact post-create invoice links.');
})().catch(e=>{console.error(e);process.exitCode=1;});
