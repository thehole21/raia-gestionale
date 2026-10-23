import { type Order, type Work, type WorkRow, type Status } from './data';
export function orderRegistrationNumbers(orders:Order[]):Map<string,number>{
 const registered=[...orders].sort((a,b)=>
  (a.created||'9999-99-99').localeCompare(b.created||'9999-99-99')||
  a.id.localeCompare(b.id)
 );
 return new Map(registered.map((order,index)=>[order.id,index+1]));
}
export const executionDay=(order:Order)=>order.executionDate || order.created;
export const orderGroupKey=(order:Order)=>JSON.stringify([order.clientId,Boolean(order.executionDate),executionDay(order)||order.id]);
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
 if(lines.some(l=>['Bozza','Procedere','In attesa File','In attesa conferma','Sospeso'].includes(l.status)))return 'Da elaborare';
 return lines.some(l=>l.status==='Da elaborare')?'Da elaborare':lines.some(l=>l.status==='Preventivo')?'Preventivo':'Sopralluogo';
}
export function groupWork(all:WorkRow[],visible:WorkRow[]) {
 const visibleIds=new Set(visible.map(r=>r.id));
 const map=new Map<string,{key:string;date:string;isExecution:boolean;client:WorkRow['client'];rows:WorkRow[];visible:WorkRow[]}>();
 for(const r of all){const date=executionDay(r.order);const key=orderGroupKey(r.order);
  let group=map.get(key);if(!group){group={key,date,isExecution:!!r.order.executionDate,client:r.client,rows:[],visible:[]};map.set(key,group);}group.rows.push(r);if(visibleIds.has(r.id))group.visible.push(r);
 }
 return [...map.values()].filter(g=>g.visible.length).sort((a,b)=>b.date.localeCompare(a.date)||a.client.name.localeCompare(b.client.name,'it'));
}

export const statusTone=(status:Status)=>['Pronto','Consegnato','Elaborato'].includes(status)?'done':['In lavorazione','In Stampa','In allestimento'].includes(status)?'active':['Sospeso','In attesa File','In attesa conferma','Bozza'].includes(status)?'waiting':'planned';
