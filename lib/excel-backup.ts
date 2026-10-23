import * as XLSX from 'xlsx';
import {flatten,today,type Store,type Order,type Client,type WorkRow} from './data';
import {workPeriods} from './order-groups';
import {workCategory} from './work-categories';
export type ArchivedOrder={id:number;order_data:Order;client_data:Client|null;actor_name:string|null;deleted_at:string};
const months=['GENNAIO','FEBBRAIO','MARZO','APRILE','MAGGIO','GIUGNO','LUGLIO','AGOSTO','SETTEMBRE','OTTOBRE','NOVEMBRE','DICEMBRE'];
const general=['','Entrata','Cliente','Lavoro','copie','Operatore','Fornitore','Processo','Consegna richiesta','DDT','Consegna','Terminato','Fatturato'];
const books=['N.','Cliente','Data ingresso','Orario ingresso','Titolo Lavoro','Copie','Operatore','Processo','Commenti','Consegna','URGENZA','Orario uscita','DDT','Consegna','Terminato','Fatturato'];
const extra=['Numero ordine','Data esecuzione','Note lavoro','Note ordine','Sezione','Annotazioni','Prezzo unitario','Unità','Sollecitato','ID ordine','ID lavorazione','Commenti lavorazione','Fornitore lavorazione','Data DDT','Titolo ordine'];
const date=(value:string|undefined):Date|string=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?new Date(value+'T12:00:00'):value||'';
function row(r:WorkRow,book:boolean){
 const p=r.production,qty=p?.quantity??r.qty,op=r.operator.name==='—'?'':r.operator.name;
 const due=date(p?.requestedDate||(!p?r.order.due:''))||p?.requestedText||'Non precisata';
 const ended=p?p.terminated:['Pronto','Consegnato'].includes(r.status),billed=p?.invoicing||(r.invoiceId?'In bozza':'');
 const common=book?[p?.bookNumber||'',r.client.name,date(r.order.created),p?.entryTime||'',r.description,qty,op,r.status,p?.comments||'',due,p?.urgent||false,p?.exitTime||'',p?.ddtNumber||r.order.ddt?.number||'',p?.delivery||'',ended,billed]:['',date(r.order.created),r.client.name,r.description,qty,op,p?.supplier||'',r.status,due,p?.ddtNumber||r.order.ddt?.number||'',p?.delivery||'',ended,billed];
 return [...common,r.order.number,date(r.order.executionDate),r.notes,r.order.notes,p?.section||'',p?.additionalNotes||'',p?.priceUnspecified?'Da definire':r.price,r.unit,r.order.solicited||false,r.order.id,r.id,p?.comments||'',p?.supplier||'',date(r.order.ddt?.date),r.order.title||''];
}
export function buildExcelBackup(store:Store,archived:ArchivedOrder[]=[]){
 const wb=XLSX.utils.book_new();
 const add=(name:string,headers:string[],data:unknown[][],book=false)=>{
  const ws=XLSX.utils.aoa_to_sheet([headers,...data],{dateNF:'dd/mm/yyyy'});
  ws['!cols']=headers.map(h=>({wch:/Lavoro|lavoro|Note|Commenti|Annotazioni/.test(h)?46:/Cliente|Operatore|Fornitore/.test(h)?25:/ID/.test(h)?28:18}));
  if(name.startsWith('LIBRI')||months.some(m=>name.startsWith(m)))ws['!cols'][0]={wch:7};
  ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:data.length,c:headers.length-1}})};
  // Explicit strings from aoa_to_sheet remain text, even if they start with '='.
  XLSX.utils.book_append_sheet(wb,ws,name.slice(0,31));
 };
 const rows=flatten(store).sort((a,b)=>(a.order.created||'9999').localeCompare(b.order.created||'9999')||a.client.name.localeCompare(b.client.name,'it')||a.id.localeCompare(b.id));
 const periods=new Set((store.planningPeriods||[]).filter(p=>/^\d{4}-\d{2}$/.test(p)));
 for(const r of rows)for(const p of workPeriods(r))if(/^\d{4}-\d{2}$/.test(p))periods.add(p);
 const years=[...new Set([...periods].map(p=>p.slice(0,4)).concat(rows.map(r=>r.order.created.slice(0,4)).filter(y=>/^\d{4}$/.test(y))))].sort();
 if(!years.length)years.push(today().slice(0,4));
 const bookYear=(r:WorkRow)=>r.source?.sheet.match(/^libri\s+(\d{4})/i)?.[1]||r.order.created.slice(0,4)||workPeriods(r).find(Boolean)?.slice(0,4)||years[0];
 for(const r of rows.filter(r=>workCategory(r,r.order)==='books'))if(!years.includes(bookYear(r)))years.push(bookYear(r));
 for(const year of years.sort()){
  months.forEach((month,index)=>{const period=year+'-'+String(index+1).padStart(2,'0');add(month+' '+year,[...general,...extra],rows.filter(r=>workCategory(r,r.order)==='general'&&workPeriods(r).includes(period)).map(r=>row(r,false)));});
  add('LIBRI '+year,[...books,...extra],rows.filter(r=>workCategory(r,r.order)==='books'&&bookYear(r)===year).map(r=>row(r,true)),true);
 }
 const undated=rows.filter(r=>workCategory(r,r.order)==='general'&&!workPeriods(r).some(p=>/^\d{4}-\d{2}$/.test(p)));
 if(undated.length)add('SENZA PERIODO',[...general,...extra],undated.map(r=>row(r,false)));
 const clientKeys=['name','email','phone','address','postalCode','city','province','country','vat','taxCode','recipientCode','pec','id'] as const;
 add('CLIENTI',['Cliente','Email','Telefono','Indirizzo','CAP','Città','Provincia','Paese','Partita IVA','Codice fiscale','SDI','PEC','ID cliente'],store.clients.map(c=>clientKeys.map(k=>c[k]||'')));
 add('OPERATORI',['Nome','ID','Selezionabile'],[...store.operators.map(o=>[o.name,o.id,'Sì']),...(store.operatorHistory||[]).filter(o=>!store.operators.some(a=>a.id===o.id)).map(o=>[o.name,o.id,'No · storico'])]);
 add('BOZZE FATTURE',['Numero','Cliente','Data','Stato','Lavorazioni','ID'],store.drafts.map(d=>[d.number,store.clients.find(c=>c.id===d.clientId)?.name||d.clientId,date(d.created),d.status||'draft',d.workIds.join(', '),d.id]));
 add('ORDINI ANNULLATI',['Ordine','Cliente','Lavorazione','Copie','Processo precedente','Annullato il','Annullato da','ID ordine'],archived.flatMap(a=>a.order_data.lines.map(l=>[a.order_data.number,a.client_data?.name||'',l.description,l.production?.quantity??l.qty,l.status,a.deleted_at,a.actor_name||'',a.order_data.id])));
 const annotations:unknown[][]=[];
 for(const register of store.productionRegisters||[])for(const note of register.notes)annotations.push([register.sheet,note.row,note.values.map(v=>v??'').join(' | '),Object.values(note.comments||{}).join('\n')]);
 for(const r of rows)for(const source of r.sourceHistory?.length?r.sourceHistory:r.source?[r.source]:[])if(Object.keys(source.comments||{}).length)annotations.push([source.sheet,source.row,r.description,Object.entries(source.comments||{}).map(([cell,value])=>cell+': '+value).join('\n')]);
 add('ANNOTAZIONI',['Foglio originale','Riga originale','Contenuto','Commenti originali'],annotations);
 return wb;
}
