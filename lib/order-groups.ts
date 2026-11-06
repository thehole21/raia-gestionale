import { type Order, type Work, type WorkRow, type Status } from './data';
export function orderRegistrationNumbers(orders:Order[]):Map<string,number>{
 const registered=[...orders].sort((a,b)=>
  (a.created||'9999-99-99').localeCompare(b.created||'9999-99-99')||
  a.id.localeCompare(b.id)
 );
 return new Map(registered.map((order,index)=>[order.id,index+1]));
}
export const executionDay=(order:Order)=>order.executionDate || order.created;
export const newestEntryFirst=(a:Order,b:Order)=>(b.created||'').localeCompare(a.created||'')||b.id.localeCompare(a.id);
export const orderGroupKey=(order:Order)=>order.id;
export const orderTitle=(order:Order)=>order.title?.trim() || 'Senza titolo';
export const planningPeriod=(order:Order)=>order.planningMonth || executionDay(order).slice(0,7);
export const workPeriods=(r:WorkRow)=>r.production?.planningMonths || [planningPeriod(r.order)];
export const matchesPeriod=(r:WorkRow,year:string,month:string)=>workPeriods(r).some(p=>(!year||p.slice(0,4)===year)&&(!month||p.slice(5,7)===month));
export function overallStatus(lines:Pick<Work,'status'|'production'>[]):Status {
 if(!lines.length)return 'Da elaborare';
 if(lines.every(l=>l.status==='Consegnato'))return 'Consegnato';
 if(lines.every(l=>l.production?.terminated || ['Pronto','Consegnato'].includes(l.status)))return 'Pronto';
 if(lines.every(l=>l.status===lines[0].status))return lines[0].status;
 if(lines.every(l=>['Pronto','Consegnato'].includes(l.status)))return 'Pronto';
 if(lines.every(l=>['Elaborato','Pronto','Consegnato'].includes(l.status)))return 'Elaborato';
 if(lines.some(l=>['In lavorazione','In Stampa','In allestimento','Elaborato','Pronto','Consegnato'].includes(l.status)))return 'In lavorazione';
 if(lines.some(l=>['Bozza','Procedere','Attendere','Tassativa per','In attesa File','In attesa conferma','Sospeso'].includes(l.status)))return 'Da elaborare';
 return lines.some(l=>l.status==='Da elaborare')?'Da elaborare':lines.some(l=>l.status==='Preventivo')?'Preventivo':'Sopralluogo';
}
export function groupWork(all:WorkRow[],visible:WorkRow[]) {
 const visibleOrders=new Set(visible.map(r=>r.order.id));
 const visibleIds=new Set(visible.map(r=>r.id));
 const map=new Map<string,{key:string;date:string;isExecution:boolean;client:WorkRow['client'];rows:WorkRow[];visible:WorkRow[]}>();
 for(const r of all){if(!visibleOrders.has(r.order.id))continue;const date=executionDay(r.order);const key=orderGroupKey(r.order);
  let group=map.get(key);if(!group){group={key,date,isExecution:!!r.order.executionDate,client:r.client,rows:[],visible:[]};map.set(key,group);}group.rows.push(r);if(visibleIds.has(r.id))group.visible.push(r);
 }
 return [...map.values()].filter(g=>g.visible.length).sort((a,b)=>newestEntryFirst(a.rows[0].order,b.rows[0].order));
}

export const statusText=(status:string)=>status==='In Stampa'?'In stampa':status==='In attesa File'?'In attesa file':status;
export const statusTone=(status:Status)=>['Preventivo','Sopralluogo','Bozza'].includes(status)?'soft-yellow':['In attesa File','In attesa conferma'].includes(status)?'navy':status==='In Stampa'?'aqua':status==='In allestimento'?'dark-red':status==='Tassativa per'?'orange':status==='Pronto'?'dark-green':['Attendere','Procedere'].includes(status)?'white':['Consegnato','Elaborato'].includes(status)?'done':status==='In lavorazione'?'active':status==='Sospeso'?'waiting':'planned';
