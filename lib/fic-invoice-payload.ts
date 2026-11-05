import {orderRegistrationNumbers} from './order-groups';
import {workDdt,workDdtNumber} from './delivery-selection';
import type {Store} from './data';
import {draftRows} from './billing';
export type InvoiceInput={draftId:string;revision:number;companyId:number;clientId:number;date:string;due:string;paymentId:number;paymentCode:string;numeration:string;lines:{workId:string;amount:number;vatId:number}[]};
export function invoicePayload(store:Store,input:InvoiceInput,entity:Record<string,unknown>,info:any){
 const draft=store.drafts.find(d=>d.id===input.draftId);if(!draft||draft.remoteDocumentId)throw Error('Bozza mancante o già fatturata.');
 const rows=draftRows(store,draft.workIds);if(!rows.length||rows.length!==draft.workIds.length||new Set(rows.map(r=>r.client.id)).size!==1)throw Error('Righe della bozza non valide.');
 const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
 if(!validDate(input.date)||!validDate(input.due)||input.due<input.date)throw Error('Controlla data fattura e scadenza.');
 if(!info.payment_methods_list?.some((p:any)=>p.id===input.paymentId))throw Error('Seleziona un metodo di pagamento valido.');
 if(!/^MP(?:01|02|03|04|05|06|07|08|09|10|11|12|13|14|15|16|17|18|19|20|21|22|23)$/.test(input.paymentCode))throw Error('Seleziona la modalità di pagamento elettronica.');
 if(typeof input.numeration!=='string'||input.numeration.length>30)throw Error('Numerazione non valida.');
 if(!entity.name||(!entity.vat_number&&!entity.tax_code)||!entity.address_street||!entity.address_city||!entity.address_postal_code)throw Error('Completa l’anagrafica fiscale del cliente in Fatture in Cloud.');
 if(!Array.isArray(input.lines)||input.lines.length!==rows.length||new Set(input.lines.map(l=>l.workId)).size!==rows.length)throw Error('Righe modificate: riapri la bozza.');
 const items=rows.map(r=>{const l=input.lines.find(l=>l.workId===r.id);if(!l||!Number.isFinite(l.amount)||l.amount<=0||!Number.isFinite(r.qty)||r.qty<=0)throw Error('Imponibile e quantità devono essere maggiori di zero: '+r.description);if(!info.vat_types_list?.some((v:any)=>v.id===l.vatId))throw Error('Seleziona l’IVA per '+r.description);if(/^(si|sì|true)$/i.test(r.production?.invoicing?.trim()||''))throw Error('Lavorazione già fatturata: '+r.description);return {name:r.description,description:[r.order.title,workDdtNumber(r,r.order)?'DDT '+workDdtNumber(r,r.order)+(workDdt(r,r.order)?.date?' del '+workDdt(r,r.order)!.date:''):''].filter(Boolean).join(' · '),qty:r.qty,measure:r.unit,net_price:Math.round((l.amount/r.qty)*100000000)/100000000,vat:{id:l.vatId}};});
 const registrations=orderRegistrationNumbers(store.orders);
 const orderSubject=[...new Set(rows.map(r=>'Ordine n. '+(registrations.get(r.order.id)??r.order.number)))].join(' · ');
 return {type:'invoice',entity,date:input.date,numeration:input.numeration,subject:'RAIA/'+draft.id,visible_subject:orderSubject,currency:{id:'EUR'},language:{code:'it'},e_invoice:true,ei_data:{payment_method:input.paymentCode},payment_method:{id:input.paymentId},items_list:items,payments_list:[{amount:0,due_date:input.due,status:'not_paid'}]};
}
