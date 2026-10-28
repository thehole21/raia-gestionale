import {type Store,type Order,type DeliveryNote,type Draft,flatten} from './data';
import {orderGroupKey} from './order-groups';
import {prepareInvoice,draftRows} from './billing';
export function sharedDDT(orders:Order[],anchor:Order){
 const members=orders.filter(o=>orderGroupKey(o)===orderGroupKey(anchor));
 const numbers=new Set(members.flatMap(o=>[o.ddt?.number||'',...o.lines.map(w=>w.production?.ddtNumber||'')]).map(n=>n.trim()).filter(Boolean));
 const dates=new Set(members.map(o=>o.ddt?.date||'').filter(Boolean));
 const conflict=numbers.size>1||dates.size>1;
 return {members,conflict,numbers:[...numbers],value:{number:conflict?'':[...numbers][0]||'',date:conflict?'':[...dates][0]||'',document:conflict?undefined:members.find(o=>o.ddt?.document)?.ddt?.document}};
}
const editable=(d:Draft)=>!d.remoteDocumentId&&(!d.status||['draft','validated'].includes(d.status));
export function saveGroupDDT(store:Store,anchor:Order,ddt:DeliveryNote):Store{
 const existing=sharedDDT(store.orders,anchor).value;
 if(!ddt.document&&existing.number===ddt.number&&existing.date===ddt.date&&existing.document)ddt={...ddt,document:existing.document};
 if(ddt.number&&store.orders.some(o=>orderGroupKey(o)!==orderGroupKey(anchor)&&o.ddt?.number===ddt.number&&o.ddt?.date?.slice(0,4)===ddt.date.slice(0,4)))throw new Error('Questo numero DDT è già usato da un altro gruppo nello stesso anno.');
 const members=sharedDDT(store.orders,anchor).members,ids=new Set(members.map(o=>o.id));
 const linked=new Set(members.flatMap(o=>o.lines.map(w=>w.invoiceId)).filter(Boolean));
 if(store.drafts.some(d=>linked.has(d.id)&&!editable(d)))throw new Error('DDT collegato a una fattura già elaborata: non modificabile.');
 const next={...store,orders:store.orders.map(o=>ids.has(o.id)?{...o,ddt:{...ddt},lines:o.lines.map(w=>({...w,production:w.production?{...w.production,ddtNumber:ddt.number}:undefined}))}:o)};
 return {...next,drafts:next.drafts.map(d=>linked.has(d.id)?{...d,status:'draft',preparedInvoice:prepareInvoice(draftRows(next,d.workIds))}:d)};
}
export function inheritGroupDDT(orders:Order[],order:Order):Order{
 const shared=sharedDDT(orders,order);
 if(shared.conflict||!shared.value.number)return order;
 return {...order,ddt:shared.value,lines:order.lines.map(w=>({...w,production:w.production?{...w.production,ddtNumber:shared.value.number}:undefined}))};
}
export function groupInvoiceRows(store:Store,ids:string[]){
 const all=flatten(store),keys=new Set(all.filter(r=>ids.includes(r.id)).map(r=>orderGroupKey(r.order)));
 return all.filter(r=>keys.has(orderGroupKey(r.order)));
}
export function prepareGroupDraft(store:Store,ids:string[],fresh:Draft):Store{
 const rows=flatten(store).filter(r=>ids.includes(r.id));
 const groupRows=groupInvoiceRows(store,ids);
 if(!rows.length||new Set(rows.map(r=>r.client.id)).size!==1)throw new Error('Seleziona lavorazioni di un solo cliente.');
 if(rows.some(r=>/^(si|sì|true)$/i.test(r.production?.invoicing?.trim()||'')))throw new Error('Il gruppo contiene lavori già fatturati nel registro. Verifica prima di preparare una nuova fattura.');
 const linked=[...new Set(groupRows.map(r=>r.invoiceId).filter(Boolean))];
 if(linked.length>1)throw new Error('Il gruppo ha più bozze esistenti: elimina le bozze modificabili e prepara una sola fattura.');
 const previous=linked.length?store.drafts.find(d=>d.id===linked[0]):undefined;
 if(linked.length&&(!previous||!editable(previous)))throw new Error('Il gruppo è già collegato a una fattura elaborata. Non viene creata una seconda fattura.');
 const draft={...(previous||fresh),clientId:rows[0].client.id,status:'draft' as const,workIds:[...new Set([...(previous?.workIds||[]),...rows.map(r=>r.id)])]};
 const next={...store,orders:store.orders.map(o=>({...o,lines:o.lines.map(w=>draft.workIds.includes(w.id)?{...w,invoiceId:draft.id}:w)}))};
 draft.preparedInvoice=prepareInvoice(draftRows(next,draft.workIds));
 return {...next,drafts:[draft,...store.drafts.filter(d=>d.id!==draft.id)]};
}

export function changeGroupDates(store:Store,orderId:string,changes:Pick<Order,'created'|'executionDate'|'due'>):Store{
 return {...store,orders:store.orders.map(o=>o.id===orderId?{...o,...changes}:o)};
}
