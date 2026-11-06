import {matchesRequestedDocument} from '@/lib/fic-document-match';
import {orderRegistrationNumbers} from '@/lib/order-groups';
import {randomUUID} from 'node:crypto';
import {ddtContext} from '@/lib/fic-ddt-server';
import {bearer,connection,ficGet,FicError,failure,sameOrigin,seal,unseal} from '@/lib/fic-server';
import {resolveFicClient,searchFicClients} from '@/lib/fic-client-search';
import {deliverySelection,workDdtNumber} from '@/lib/delivery-selection';
import type {Store} from '@/lib/data';
export const runtime='nodejs';export const maxDuration=60;
const json=(data:unknown)=>Response.json(data,{headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){try{
 const ctx=await ddtContext(bearer(request)),c=await connection(ctx);
 if(!c?.row.company_id)throw new FicError('Un amministratore deve collegare Fatture in Cloud e scegliere l’azienda.');
 const q=new URL(request.url).searchParams;
 if(q.get('action')==='clients')return json(await searchFicClients(c.tokens.access_token,c.row.company_id,q));
 const orderId=q.get('orderId');if(!orderId)throw new FicError('Ordine richiesto.');
 const {data:ws,error:wsError}=await ctx.userDb.from('raia_workspace').select('payload,revision').eq('id',1).single();
 if(wsError||!ws)throw new FicError('Ordini non disponibili.');
 const store=ws.payload as Store,order=store.orders.find(o=>o.id===orderId);
 if(!order)throw new FicError('Ordine non disponibile.');
 const operationId=q.get('operationId');
 if(operationId){
  const legacy=operationId==='legacy';
  const table=legacy?'raia_fic_ddts':'raia_fic_deliveries',key=legacy?'order_id':'id',value=legacy?orderId:operationId;
  const {data:op,error}=await ctx.db.from(table).select('*').eq(key,value).eq('order_id',orderId).single();
  if(error||!op)throw new FicError('DDT non trovato.');
  const remoteId=op.remote_id||Number(q.get('remoteId'));
  if(!Number.isSafeInteger(remoteId)||remoteId<1)throw new FicError('Esito da verificare in Fatture in Cloud: inserisci l’ID del documento se già presente.',409);
  const doc=(await ficGet(c.tokens.access_token,`/c/${op.company_id}/issued_documents/${remoteId}`)).data;
  if(!op.remote_id&&!matchesRequestedDocument(doc,op.request_data))throw new FicError('DDT non corrispondente alla richiesta.');
  const number=String(doc.number)+(doc.numeration||'');
  const {error:saveError}=await ctx.db.from(table).update({remote_id:doc.id,remote_number:number,status:'created'}).eq(key,value);if(saveError)throw saveError;
  const {error:finish}=await ctx.userDb.rpc(legacy?'raia_finish_fic_ddt':'raia_finish_delivery',{...(legacy?{target_order:orderId}:{operation_id:operationId}),document_id:doc.id,document_number:number});
  if(finish)throw new FicError('Documento trovato; riprova per aggiornare il gestionale.');
  return json({created:true,number,url:doc.url});
 }
 const client=store.clients.find(v=>v.id===order.clientId)||store.clientHistory?.find(v=>v.id===order.clientId);
 const [opsResult,oldResult,selectedClient]=await Promise.all([
  ctx.db.from('raia_fic_deliveries').select('id,work_ids,status,remote_id,remote_number,updated_at').eq('order_id',orderId).neq('status','failed').order('updated_at'),
  ctx.db.from('raia_fic_ddts').select('status,remote_id,remote_number').eq('order_id',orderId).neq('status','failed').maybeSingle(),
  resolveFicClient(c.tokens.access_token,c.row.company_id,client)
 ]);
 if(opsResult.error)throw opsResult.error;if(oldResult.error)throw oldResult.error;
 const documents=[...(opsResult.data||[]),...(oldResult.data?[{...oldResult.data,id:'legacy',work_ids:order.lines.map(w=>w.id)}]:[])];
 return json({companyId:c.row.company_id,companyName:c.row.companies.find((v:any)=>v.id===c.row.company_id)?.name,revision:ws.revision,client:selectedClient,clientName:client?.name,documents,lines:order.lines.map(w=>({id:w.id,description:w.description,qty:w.qty,unit:w.unit,ddt:workDdtNumber(w,order),reserved:documents.some(d=>d.work_ids.includes(w.id))}))});
}catch(e){return failure(e);}}
export async function POST(request:Request){let ctx:Awaited<ReturnType<typeof ddtContext>>|undefined;let claimed=false,operationId='';try{
 sameOrigin(request);ctx=await ddtContext(bearer(request));const c=await connection(ctx);if(!c?.row.company_id)throw new FicError('Collegamento mancante.');
 const body=await request.json(),orderId=body.orderId;
 const {data:ws,error}=await ctx.userDb.from('raia_workspace').select('payload,revision').eq('id',1).single();if(error||!ws)throw new FicError('Ordini non disponibili.');
 let payload:any,workIds:string[];
 if(body.confirmation){const p=unseal<any>(body.confirmation,'ddt-preview-v2');if(p.user!==ctx.userId||p.expires<Date.now()||p.orderId!==orderId||p.revision!==ws.revision||p.companyId!==c.row.company_id)throw new FicError('Anteprima scaduta o dati modificati. Riapri il DDT.',409);payload=p.payload;workIds=p.workIds;operationId=p.operationId;
 }else{
  if(body.companyId!==c.row.company_id||body.revision!==ws.revision)throw new FicError('Dati aggiornati nel frattempo. Riapri il DDT.',409);
  const order=(ws.payload as Store).orders.find(o=>o.id===orderId);if(!order)throw new FicError('Ordine non disponibile.');
  let lines;try{lines=deliverySelection(order,body.workIds);}catch(e){throw new FicError((e as Error).message);}
  workIds=lines.map(w=>w.id);operationId=randomUUID();
  if(!Number.isSafeInteger(body.clientId)||body.clientId<1||!/^\d{4}-\d{2}-\d{2}$/.test(body.date)||Number.isNaN(Date.parse(body.date+'T12:00:00Z'))||new Date(body.date+'T12:00:00Z').toISOString().slice(0,10)!==body.date)throw new FicError('Controlla cliente e data.');
  const entity=(await ficGet(c.tokens.access_token,`/c/${c.row.company_id}/entities/clients/${body.clientId}`)).data;if(!entity?.name)throw new FicError('Cliente non valido.');
  for(const field of ['destination','carrier','packages','reason'])if(typeof body[field]!=='string'||body[field].length>500)throw new FicError('Dati di trasporto non validi.');
  if(!body.destination.trim()||!body.reason.trim())throw new FicError('Inserisci destinazione e causale.');
  payload={type:'delivery_note',entity,date:body.date,subject:'Ordine n. '+(orderRegistrationNumbers((ws.payload as Store).orders).get(order.id)||order.number),visible_subject:'Ordine n. '+(orderRegistrationNumbers((ws.payload as Store).orders).get(order.id)||order.number)+(order.title?' · '+order.title:''),e_invoice:false,show_totals:'none',dn_ai_destination:body.destination,dn_ai_transporter:body.carrier,dn_ai_packages_number:body.packages,dn_ai_causal:body.reason,items_list:lines.map(l=>({name:l.description,qty:l.qty,measure:l.unit,net_price:0}))};
  return json({confirmation:seal({payload,workIds,operationId,user:ctx.userId,orderId,revision:ws.revision,companyId:c.row.company_id,expires:Date.now()+600000},'ddt-preview-v2'),customer:entity.name,lines:payload.items_list});
 }
 const {data:claim,error:claimError}=await ctx.userDb.rpc('raia_claim_delivery',{operation_id:operationId,target_order:orderId,selected_ids:workIds,expected_revision:ws.revision,target_company:c.row.company_id,document_data:payload});
 if(claimError||!claim?.claimed)throw new FicError('Una riga ha già un DDT o una richiesta in corso. Riapri l’elenco e verifica l’esito.',409);
 claimed=true;
 const response=await fetch(`https://api-v2.fattureincloud.it/c/${c.row.company_id}/issued_documents`,{method:'POST',headers:{Authorization:'Bearer '+c.tokens.access_token,'Content-Type':'application/json'},body:JSON.stringify({data:payload}),cache:'no-store',signal:AbortSignal.timeout(20000)});
 const result=await response.json();
 if(!response.ok){if(response.status>=400&&response.status<500&&![408,409,429].includes(response.status)){const {error:release}=await ctx.db.from('raia_fic_deliveries').update({status:'failed'}).eq('id',operationId);if(release)throw release;claimed=false;throw new FicError(result.error?.message||'DDT rifiutato: controlla i dati.');}throw Error();}
 const doc=result.data;if(!Number.isSafeInteger(doc?.id))throw Error();const number=String(doc.number)+(doc.numeration||'');
 const {error:save}=await ctx.db.from('raia_fic_deliveries').update({remote_id:doc.id,remote_number:number,status:'created'}).eq('id',operationId);if(save)throw save;
 const {error:finish}=await ctx.userDb.rpc('raia_finish_delivery',{operation_id:operationId,document_id:doc.id,document_number:number});if(finish)throw finish;
 claimed=false;return json({created:true,number,url:doc.url});
}catch(e){if(claimed&&ctx){await ctx.db.from('raia_fic_deliveries').update({status:'reconcile'}).eq('id',operationId).is('remote_id',null);return failure(new FicError('Esito da verificare. Riapri DDT e premi Verifica esito sulla richiesta; non reinviarla.',409));}return failure(e);}}
