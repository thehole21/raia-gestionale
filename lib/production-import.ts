import { type Store, type Work, type Status, STATUSES } from './data';

export const productionHeaders = ['entrata','cliente','lavoro','copie','operatore','fornitore','processo','consegna richiesta','ddt','consegna','terminato','fatturato'];
const text = (v: unknown) => v == null ? '' : String(v).trim();
const norm = (v: unknown) => text(v).toLocaleLowerCase('it').replace(/\s+/g, ' ');
export const isProductionSheet = (headers: unknown[]) => productionHeaders.every(h => headers.some(v => norm(v) === h));
const clientKey = (v: unknown) => norm(v).replace(/\s+/g,'');
const key = (s: string) => encodeURIComponent(s);
function date(v: unknown): string {
  if (!v) return '';
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
  const s=text(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` : '';
}
export function prepareProductionImport(store: Store, data: unknown[][], sheet: string, header=0) {
  const next: Store = structuredClone(store);
  const errors: string[] = [];
  let added=0, duplicates=0;
  const headers=data[header] || [];
  if (!isProductionSheet(headers)) return {next,added,duplicates,errors:['Intestazioni della programmazione non riconosciute.']};
  const indexes=Object.fromEntries(productionHeaders.map(h=>[h,headers.findIndex(v=>norm(v)===h)]));
  const months=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  const month=months.findIndex(m=>norm(sheet).includes(m))+1;
  const year=sheet.match(/\b20\d{2}\b/)?.[0];
  if(!month||!year) errors.push('Il nome del foglio deve contenere mese e anno.');
  const planningMonth=year&&month?`${year}-${String(month).padStart(2,'0')}`:'';
  const existing=new Set(next.orders.flatMap(o=>o.lines.map(l=>l.importKey).filter(Boolean)));
  let previousClient='', previousDate='';
  for(let i=header+1;i<data.length;i++){
    const row=data[i]||[];
    const get=(name:string)=>row[indexes[name]];
    // The template contains hundreds of prefilled false checkboxes, not jobs.
    if(!productionHeaders.some(h=>h!=='terminato'&&text(get(h)))) {previousClient='';previousDate='';continue;}
    const description=text(get('lavoro'));
    const explicitClient=text(get('cliente'));
    const clientName=explicitClient||previousClient;
    const entry=date(get('entrata')) || ((!explicitClient||clientKey(explicitClient)===clientKey(previousClient)) ? previousDate : '');
    if(!description||!clientName||!entry){errors.push(`Riga ${i+1}: cliente, lavoro o data di entrata mancanti/non riconosciuti.`);continue;}
    previousClient=clientName;previousDate=entry;
    const importKey=`programmazione:${norm(sheet)}:${i+1}`;
    if(existing.has(importKey)){duplicates++;continue;}
    let client=next.clients.find(c=>clientKey(c.name)===clientKey(clientName));
    if(!client){client={id:'excel_client_'+key(clientKey(clientName)),name:clientName,email:'',phone:'',vat:'',city:''};next.clients.push(client);}
    const operatorName=text(get('operatore'));
    let operator=next.operators.find(o=>norm(o.name)===norm(operatorName));
    if(operatorName&&!operator){operator={id:'excel_operator_'+key(norm(operatorName)),name:operatorName};next.operators.push(operator);}
    const orderId=`excel_${key(norm(sheet))}_${key(client.id)}_${entry}`;
    let order=next.orders.find(o=>o.id===orderId);
    if(!order){order={id:orderId,number:`OTT-${year}-${String(i+1).padStart(3,'0')}`,clientId:client.id,created:entry,executionDate:'',due:'',notes:'',planningMonth,lines:[]};order.number=`${sheet.slice(0,3).toUpperCase()}-${year}-${String(i+1).padStart(3,'0')}`;next.orders.push(order);}
    const rawQty=get('copie'), quantity=text(rawQty);
    const qty=typeof rawQty==='number'?rawQty:/^\d+(?:[.,]\d+)?$/.test(quantity)?Number(quantity.replace(',','.')):0;
    const process=text(get('processo'));
    const status=STATUSES.find(s=>norm(s)===norm(process)) || 'Da elaborare';
    if(process&&!STATUSES.some(s=>norm(s)===norm(process))){errors.push(`Riga ${i+1}: processo non riconosciuto «${process}».`);continue;}
    const rawDue=get('consegna richiesta');
    const line:Work={
      id:`excel_${key(norm(sheet))}_row_${i+1}`,importKey,description,qty,unit:'pz',price:0,status:status as Status,
      operatorId:operator?.id||'',invoiceId:null,notes:'',
      production:{quantity,priceUnspecified:true,supplier:text(get('fornitore')),requestedDate:date(rawDue),requestedText:date(rawDue)?'':text(rawDue),ddtNumber:text(get('ddt')),delivery:text(get('consegna')),terminated:get('terminato')===true,invoicing:text(get('fatturato'))},
      source:{sheet,row:i+1,values:row.map(v=>v instanceof Date?date(v):v)}
    };
    order.lines.push(line);existing.add(importKey);added++;
  }
  for(const order of next.orders.filter(o=>o.planningMonth===planningMonth)){
    const dues=[...new Set(order.lines.map(l=>l.production?.requestedDate||'').filter(Boolean))];
    order.due=dues.length===1?dues[0]:'';
    const ddts=[...new Set(order.lines.map(l=>l.production?.ddtNumber||'').filter(Boolean))];
    if(ddts.length===1)order.ddt={number:ddts[0],date:''};
  }
  return {next,added,duplicates,errors};
}
