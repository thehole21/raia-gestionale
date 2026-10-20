const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {prepareProductionImport,productionHeaders}=require('../lib/production-import.ts');
const {planningPeriod,overallStatus}=require('../lib/order-groups.ts');
const {workAmount}=require('../lib/data.ts');
const empty={version:2,clients:[],operators:[],orders:[],drafts:[],activity:[]};
const data=[[null,...productionHeaders],
 [null,'2026-09-25','Cliente 3','Pannelli','100+2','Mario','Fornitore','In Stampa','2026-10-23','n.42','Ritirano',false,'Al mese successivo'],
 [null,null,null,'Adesivi',20,null,null,'Pronto',null,null,null,true,null],
 [null,'2026-09-25','Cliente3','Catalogo',null,null,null,null,null,null,null,false,null],
 [null,null,null,null,null,null,null,null,null,null,null,false]];
const r=prepareProductionImport(empty,data,'OTTOBRE 2026');
assert.deepEqual(r.errors,[]);assert.equal(r.added,3);assert.equal(r.next.clients.length,1);assert.equal(r.next.orders.length,1);
const order=r.next.orders[0];assert.equal(order.created,'2026-09-25');assert.equal(planningPeriod(order),'2026-10');
assert.equal(order.lines[0].production.quantity,'100+2');assert.equal(order.lines[0].qty,0);assert.equal(workAmount(order.lines[0]),'Da definire');
assert.equal(order.lines[1].production.terminated,true);assert.equal(order.lines[1].status,'Pronto');
assert.equal(order.lines[2].production.quantity,'');assert.equal(order.lines[2].production.requestedDate,'');
assert.equal(overallStatus(order.lines),'In lavorazione');
const replay=prepareProductionImport(r.next,data,'OTTOBRE 2026');
assert.equal(replay.added,0);assert.equal(replay.duplicates,3);
assert.deepEqual(replay.next,r.next);
const invalid=prepareProductionImport(empty,[...data,[null,null,null,'Orfano']], 'OTTOBRE 2026');
assert.equal(invalid.errors.length,1);
console.log('PASS Programmazione: gruppi, normalizzazione clienti, mese, quantità testuali, terminato distinto da consegnato, righe vuote, replay e righe orfane.');
