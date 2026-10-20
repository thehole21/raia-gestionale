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
 for(const order of orders)if(!order.ddt?.number||!order.ddt.date)issues.push('DDT da completare per '+order.number+'.');
 for(const row of rows)if(row.vatId===undefined)issues.push('Aliquota IVA da associare: '+row.description+'.');
 for(const row of rows){
  if(/^(si|sì|true)$/i.test(row.production?.invoicing?.trim()||''))issues.push('Già fatturato nel registro Excel: '+row.description+'.');
  if(row.production?.priceUnspecified)issues.push('Prezzo da definire: '+row.description+'.');
  if(row.qty<=0)issues.push('Quantità numerica da precisare: '+row.description+'.');
 }
 issues.push('Collegamento Fatture in Cloud e condizioni di pagamento da configurare.');
 return {version:1,provider:'fatture-in-cloud',readyToSend:false,issues,customer:client?{...client}:null,
  deliveryNotes:orders.map(o=>({orderId:o.id,orderNumber:o.number,number:o.ddt?.number||'',date:o.ddt?.date||''})),
  lines:rows.map(r=>({workId:r.id,orderId:r.order.id,description:r.description,deliveryNoteNumber:r.production?.ddtNumber||r.order.ddt?.number||'',quantity:r.qty,unit:r.unit,netUnitPrice:r.price,vatId:r.vatId??null})),
  currency:'EUR',paymentMethodId:null,paymentDueDate:null,companyId:null,remoteDocumentId:null};
}
export function draftRows(store:Store,workIds:string[]){return flatten(store).filter(r=>workIds.includes(r.id));}
