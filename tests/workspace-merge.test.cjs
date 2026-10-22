const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {mergeWorkspace}=require('../lib/workspace-merge.ts');
const clone=structuredClone;
const base={version:2,clients:[{id:'c',name:'Cliente'}],operators:[],orders:Array.from({length:5},(_,i)=>({id:'o'+i,clientId:'c',lines:[{id:'w'+i,notes:'',qty:1}]})),drafts:[],activity:[]};
let server=clone(base);
for(let i=0;i<5;i++){const local=clone(base);local.orders[i].lines[0].notes='Operatore '+i;server=mergeWorkspace(base,local,server);}
assert(server.orders.every((o,i)=>o.lines[0].notes==='Operatore '+i));
const a=clone(base),b=clone(base);a.orders[0].lines[0].qty=2;b.orders[0].lines[0].qty=3;
assert.throws(()=>mergeWorkspace(base,a,b),/contemporanee/);
assert.deepEqual(mergeWorkspace(base,a,a),a);
const deleted=clone(base);deleted.orders.shift();assert.throws(()=>mergeWorkspace(base,a,deleted));
const first=clone(base);first.orders[0].lines[0].notes='first';const second=clone(first);second.orders[1].lines[0].notes='second';const remote=clone(base);remote.orders[4].lines[0].notes='remote';
const saved=mergeWorkspace(base,first,remote),visible=mergeWorkspace(first,second,saved),saved2=mergeWorkspace(first,second,saved);
assert.deepEqual(visible,saved2);assert.equal(saved2.orders[4].lines[0].notes,'remote');assert.equal(saved2.orders[1].lines[0].notes,'second');
assert.equal(base.orders[0].lines[0].notes,'');
console.log('PASS: 5 operatori, conflitti, cancellazione, coda e nessuna mutazione.');
