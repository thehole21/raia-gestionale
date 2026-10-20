const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {prepareImport,dateValue,numberValue}=require('../lib/excel.ts');const {prepareInvoice,draftRows}=require('../lib/billing.ts');
const empty={version:2,clients:[],operators:[],orders:[],drafts:[],activity:[]};
const map={number:'0',client:'1',description:'2',date:'3',qty:'4',price:'5',ddtNumber:'6',ddtDate:'7'};
const rows=[['O-1','Cliente test','Lavoro A','15/10/2026','2','1.250,50','125/26','16/10/2026'],['O-1','Cliente test','Lavoro B','15/10/2026','1','25','125/26','16/10/2026']];
let checks=0;function check(name,fn){fn();checks++;console.log('PASS '+name);}
check('Numeri italiani e data impossibile',()=>{assert.equal(numberValue('1.250,50',0),1250.5);assert.equal(dateValue('31/02/2026'),'');assert.equal(dateValue('15/10/2026'),'2026-10-15');});
const first=prepareImport(empty,rows,map,'','Ottobre 2026',0);
check('Raggruppa due righe e conserva DDT e colonne originali',()=>{assert.equal(first.errors.length,0);assert.equal(first.added,2);assert.equal(first.next.orders.length,1);assert.equal(first.next.orders[0].ddt.number,'125/26');assert.equal(first.next.orders[0].lines[0].source.values[5],'1.250,50');assert.equal(empty.orders.length,0);});
check('Reimportazione dello stesso foglio senza duplicati',()=>{const again=prepareImport(first.next,rows,map,'','Ottobre 2026',0);assert.equal(again.duplicates,2);assert.equal(again.added,0);});
check('Valori negativi e date mancanti bloccati',()=>{const invalid=structuredClone(rows);invalid[0][4]='-1';invalid[1][3]='';const result=prepareImport(empty,invalid,map,'','Ottobre',0);assert.equal(result.errors.length,2);assert.equal(result.added,0);});
check('DDT incompatibile nella stessa commessa segnalato',()=>{const invalid=structuredClone(rows);invalid[1][6]='126/26';assert.equal(prepareImport(empty,invalid,map,'','Ottobre',0).errors.length,1);});
check('Cliente diverso con stesso numero commessa segnalato',()=>{const invalid=structuredClone(rows);invalid[1][1]='Altro cliente';assert.equal(prepareImport(empty,invalid,map,'','Ottobre',0).errors.length,1);});
check('Preparazione fattura conserva DDT ma non abilita invio',()=>{const work=first.next.orders[0].lines.map(w=>w.id);const invoice=prepareInvoice(draftRows(first.next,work));assert.equal(invoice.readyToSend,false);assert.equal(invoice.deliveryNotes[0].number,'125/26');assert.equal(invoice.lines.length,2);assert.ok(invoice.issues.some(s=>s.includes('Aliquota')));});
console.log(checks+' controlli superati.');

const {overallStatus,groupWork}=require('../lib/order-groups.ts');const {flatten}=require('../lib/data.ts');
check('Stato generale: tutti consegnati, tutti pronti e avanzamento parziale',()=>{assert.equal(overallStatus([{status:'Consegnato'},{status:'Consegnato'}]),'Consegnato');assert.equal(overallStatus([{status:'Pronto'},{status:'Consegnato'}]),'Pronto');assert.equal(overallStatus([{status:'Da elaborare'},{status:'Pronto'}]),'In lavorazione');assert.equal(overallStatus([]),'Da elaborare');});
check('Cliente e giornata: due ordini in un solo gruppo, date diverse separate',()=>{const s=structuredClone(first.next);s.orders[0].executionDate='2026-10-16';const other=structuredClone(s.orders[0]);other.id='other';other.number='O-2';other.lines.forEach((l,i)=>l.id='other-'+i);s.orders.push(other);let grouped=groupWork(flatten(s),flatten(s));assert.equal(grouped.length,1);assert.equal(grouped[0].rows.length,4);other.executionDate='2026-10-17';assert.equal(groupWork(flatten(s),flatten(s)).length,2);});
check('Filtri parziali non fanno risultare completato tutto il gruppo',()=>{const s=structuredClone(first.next);s.orders[0].lines[0].status='Consegnato';s.orders[0].lines[1].status='Da elaborare';const all=flatten(s);const grouped=groupWork(all,[all[0]]);assert.equal(grouped[0].visible.length,1);assert.equal(grouped[0].rows.length,2);assert.equal(overallStatus(grouped[0].rows),'In lavorazione');});
check('Importazione supporta esecuzione e scadenza Non precisata',()=>{const mapping={...map,execution:'8',due:'9'};const result=prepareImport(empty,[[...rows[0],'17/10/2026','Non precisata']],mapping,'','Ottobre',0);assert.equal(result.errors.length,0);assert.equal(result.next.orders[0].executionDate,'2026-10-17');assert.equal(result.next.orders[0].due,'');});
console.log('Totale: '+checks+' controlli superati.');
