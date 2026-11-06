const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {createReadCoalescer}=require('../lib/inflight-reads.ts');
const {supplierOptions,initialSuppliers}=require('../lib/suppliers.ts');
(async()=>{
 let calls=0,release;const read=createReadCoalescer();const loader=async()=>{calls++;await new Promise(r=>release=r);return {items:[1]};};
 const first=read('token-a/company-1/path',loader),second=read('token-a/company-1/path',loader);await Promise.resolve();release();const [a,b]=await Promise.all([first,second]);assert.equal(calls,1);a.items.push(2);assert.deepEqual(b.items,[1]);
 await read('token-a/company-1/path',async()=>{calls++;return {};});assert.equal(calls,2,'completed responses must not be cached');
 let errors=0;const reject=async()=>{errors++;throw Error('offline');};await Promise.allSettled([read('failure',reject),read('failure',reject)]);assert.equal(errors,1);assert.equal(await read('failure',async()=>42),42);
 let isolated=0;await Promise.all([read('token-a/company-1/x',async()=>++isolated),read('token-b/company-1/x',async()=>++isolated),read('token-a/company-2/x',async()=>++isolated)]);assert.equal(isolated,3);
 const input=structuredClone(initialSuppliers),before=JSON.stringify(input),options=supplierOptions(input);assert.equal(supplierOptions(input),options);assert.equal(JSON.stringify(input),before);assert.equal(options[0].name,'più fornitori');assert.equal(options[1].name,'silver print');const modified=input.map(s=>({...s,active:false}));assert.deepEqual(supplierOptions(modified),[]);
 const start=performance.now();for(let i=0;i<10000;i++)supplierOptions(input);console.log('10.000 accessi alle opzioni fornitori: '+(performance.now()-start).toFixed(2)+' ms');
 console.log('PASS concurrent API read deduplication, fresh subsequent reads, failure retry, token/company isolation, independent response copies and supplier cache invalidation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
