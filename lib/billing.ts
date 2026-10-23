import {orderGroupKey} from './order-groups';
import { flatten, type Store, type WorkRow } from './data';
// Modello interno versionato: NON è il payload pronto per l'API fiscale.
export function prepareInvoice(rows: WorkRow[]) {
 const issues:string[]=[];const client=rows[0]?.client;
 if(!rows.length)issues.push('Nessuna lavorazione selezionata.');
 if(new Set(rows.map(r=>r.client.id)).size>1)issues.push('Le lavorazioni devono appartenere allo stesso cliente.');
 if(client){
  if(!client.vat&&!client.taxCode)issues.push('Partita IVA o codice fiscale del cliente mancante.');
  if(!client.address||!client.postalCode||!client.city||!client.province)issues.push('Indirizzo fiscale del cliente da completare.');
  if(!client.recipientCode&&!client.pec)issues.push('Destinazione elettronica del cliente da verificare.');
 }
 const orders=[...new Map(rows.map(r=>[r.order.id,r.order])).values()];
 const groups=new Set(orders.map(orderGroupKey));
 for(const key of groups){const members=orders.filter(o=>orderGroupKey(o)===key);const numbers=new Set(members.flatMap(o=>[o.ddt?.number||'',...o.lines.map(w=>w.production?.ddtNumber||'')]).filter(Boolean));if(numbers.size>1)issues.push('DDT diversi nello stesso gruppo: uniformare i riferimenti prima della fattura.');}
 for(const order of orders)if(!order.ddt?.number||!order.ddt.date)issues.push('DDT da completare per '+order.number+'.');
 for(const row of rows)if(row.vatId===undefined)issues.push('Aliquota IVA da associare: '+row.description+'.');
 for(const row of rows){
  if(/^(si|sì|true)$/i.test(row.production?.invoicing?.trim()||''))issues.push('Già fatturato nel registro Excel: '+row.description+'.');
  if(row.production?.priceUnspecified)issues.push('Prezzo da definire: '+row.description+'.');
  if(row.qty<=0)issues.push('Quantità numerica da precisare: '+row.description+'.');
 }
 issues.push('Collegamento Fatture in Cloud e condizioni di pagamento da configurare.');
 return {version:1,provider:'fatture-in-cloud',readyToSend:false,issues,customer:client?{...client}:null,
  deliveryNotes:[...new Map(orders.map(o=>[JSON.stringify([o.ddt?.number||o.id,o.ddt?.date||'']),{orderId:o.id,orderNumber:o.number,orderIds:orders.filter(x=>x.ddt?.number===o.ddt?.number&&x.ddt?.date===o.ddt?.date).map(x=>x.id),number:o.ddt?.number||'',date:o.ddt?.date||''}])).values()],
  lines:rows.map(r=>({workId:r.id,orderId:r.order.id,description:r.description,orderTitle:r.order.title||'',deliveryNoteNumber:r.order.ddt?.number||r.production?.ddtNumber||'',quantity:r.qty,unit:r.unit,netUnitPrice:r.price,vatId:r.vatId??null})),
  currency:'EUR',paymentMethodId:null,paymentDueDate:null,companyId:null,remoteDocumentId:null};
}
export function draftRows(store:Store,workIds:string[]){return flatten(store).filter(r=>workIds.includes(r.id));}
