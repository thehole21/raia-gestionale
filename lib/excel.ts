import { STATUSES, id, type Store, type Status } from './data';
export const fields = [['ddtNumber','Numero DDT'],['ddtDate','Data DDT'],['number','Commessa'],['client','Cliente *'],['description','Lavorazione *'],['date','Data ordine'],['execution','Data esecuzione'],['due','Consegna'],['qty','Quantità'],['unit','Unità'],['price','Prezzo unitario'],['status','Stato'],['operator','Operatore'],['notes','Note']] as const;
export type Mapping = Record<string, string>;
export function numberValue(value: unknown, fallback: number) {
 if(value === '' || value === null || value === undefined)return fallback;
 if(typeof value==='number')return value;
 let text=String(value).trim().replace(/[€\s]/g,'');
 if(text.includes(',')) text=text.replace(/\./g,'').replace(',','.');
 return Number(text);
}
export function dateValue(value:unknown):string {
 if(value instanceof Date && !isNaN(value.getTime()))return [value.getFullYear(),String(value.getMonth()+1).padStart(2,'0'),String(value.getDate()).padStart(2,'0')].join('-');
 const s=String(value||'').trim(); if(!s)return '';
 const it=s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
 const iso=it?it[3]+'-'+it[2].padStart(2,'0')+'-'+it[1].padStart(2,'0'):s.slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return '';
 const parsed=new Date(iso+'T12:00:00Z');return !isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===iso?iso:'';
}
export function prepareImport(store:Store,rows:unknown[][],mapping:Mapping,fallbackDate:string,sheet:string,headerRow:number) {
 const next:Store=structuredClone(store);const errors:string[]=[];let added=0,duplicates=0;
 const known=new Set(next.orders.flatMap(o=>o.lines.map(l=>(l as typeof l & {importKey?:string}).importKey).filter(Boolean)));
 const text=(value:unknown)=>String(value??'').trim();
 rows.forEach((row,index)=>{
  if(row.every(v=>v===null||v===undefined||v===''))return;
  const get=(key:string)=>mapping[key]!==undefined&&mapping[key]!==''?row[Number(mapping[key])]:'';
  const clientName=text(get('client')),description=text(get('description'));
  const created=dateValue(get('date')||fallbackDate),due=/^non precisata$/i.test(text(get('due')))?'':dateValue(get('due'));
  const executionDate=dateValue(get('execution')); if(get('execution')&&!executionDate){errors.push('Riga '+(index+headerRow+2)+': data esecuzione non valida.');return;}
  const qty=numberValue(get('qty'),1),price=numberValue(get('price'),0);
  const state=text(get('status')) || 'Da elaborare';const status=STATUSES.find(s=>s.toLocaleLowerCase('it')===state.toLocaleLowerCase('it'));
  const rowNumber=index+headerRow+2;
  if(!clientName||!description||!created||(!due&&get('due')&&!/^non precisata$/i.test(text(get('due'))))||!Number.isFinite(qty)||qty<=0||!Number.isFinite(price)||price<0||!status){errors.push('Riga '+rowNumber+': verifica cliente, lavorazione, date, quantità, prezzo e stato.');return;}
  const importKey=JSON.stringify([sheet,rowNumber,row]);if(known.has(importKey)){duplicates++;return;}known.add(importKey);
  let client=next.clients.find(c=>c.name.toLocaleLowerCase('it')===clientName.toLocaleLowerCase('it'));
  if(!client){client={id:id(),name:clientName,email:'',phone:'',vat:'',city:''};next.clients.push(client);}
  const operatorName=text(get('operator'));let operator=next.operators.find(o=>o.name.toLocaleLowerCase('it')===operatorName.toLocaleLowerCase('it'));
  if(operatorName&&!operator){errors.push('Riga '+rowNumber+': operatore “'+operatorName+'” non presente. Crealo nelle impostazioni oppure non associare questa colonna.');return;}
  const ddtNumber=text(get('ddtNumber')),ddtDate=dateValue(get('ddtDate')); if((ddtNumber&&!ddtDate)||(!ddtNumber&&ddtDate)){errors.push('Riga '+rowNumber+': DDT incompleto.');return;}
  const number=text(get('number'))||'IMP-'+created.replaceAll('-','')+'-'+rowNumber+'-'+sheet;
  let order=next.orders.find(o=>o.number===number);
  if(order&&(order.clientId!==client.id||order.created!==created||(order.executionDate||'')!==executionDate)){errors.push('Riga '+rowNumber+': numero commessa già associato a cliente o data diversi.');return;}
  if(!order){order={id:id(),number,clientId:client.id,created,executionDate,due,notes:'',lines:[]};next.orders.push(order);}
  if(ddtNumber){if(order.ddt&&(order.ddt.number!==ddtNumber||order.ddt.date!==ddtDate)){errors.push('Riga '+rowNumber+': DDT diverso per la stessa commessa.');return;}order.ddt={number:ddtNumber,date:ddtDate};}
  order.lines.push({id:id(),description,qty,unit:text(get('unit'))||'pz',price,status:status as Status,operatorId:operator?.id||'',invoiceId:null,notes:text(get('notes')),importKey,source:{sheet,row:rowNumber,values:row}} as typeof order.lines[number]);added++;
 });
 return {next,errors,added,duplicates};
}
