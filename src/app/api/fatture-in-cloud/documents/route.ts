import {joinIds,joinDdtData,readJoinSources,validateJoinSources,verifyJoinedInvoice,reconcileJoinReservations} from '@/lib/fic-ddt-join';
import {createClient} from '@supabase/supabase-js';
import {randomUUID,createHash} from 'node:crypto';
import {admin,bearer,connection,ficGet,FicError,failure,sameOrigin,seal,unseal} from '@/lib/fic-server';
import {documentTypes,transformTypes,cleanDocument,validateDocument} from '@/lib/fic-documents';
import {matchesRequestedDocument} from '@/lib/fic-document-match';
import {orderRegistrationNumbers} from '@/lib/order-groups';
import type {Store} from '@/lib/data';
export const runtime='nodejs';export const maxDuration=60;
const json=(v:unknown)=>Response.json(v,{headers:{'Cache-Control':'no-store'}});
const api='https://api-v2.fattureincloud.it';
const sourceDigest=(v:any)=>digest({...cleanDocument(v),number:v.number,updated_at:v.updated_at,merged_in:v.merged_in});
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
async function context(request:Request){const ctx=await admin(bearer(request)),c=await connection(ctx);if(!c?.row.company_id)throw new FicError('Collega Fatture in Cloud e seleziona l’azienda nelle impostazioni.');const secret=process.env.SUPABASE_SECRET_KEY;if(!secret)throw new FicError('Configurare SUPABASE_SECRET_KEY sul server.',503);const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,secret,{auth:{persistSession:false,autoRefreshToken:false}});return {...ctx,c,service:db,company:c.row.company_id as number};}
const id=(v:any)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<=0)throw new FicError('Identificativo documento non valido.');return n;};
async function sourceData(ctx:Awaited<ReturnType<typeof context>>,sourceId:number,target:string){
 const source=(await ficGet(ctx.c.tokens.access_token,`/c/${ctx.company}/issued_documents/${sourceId}`)).data;
 if(!transformTypes[source.type]?.includes(target))throw new FicError('Questa trasformazione non è supportata da Fatture in Cloud.');
 const url=source.type==='delivery_note'?`/c/${ctx.company}/issued_documents/join?ids=${sourceId}&group=0&e_invoice=1`:`/c/${ctx.company}/issued_documents/transform?original_document_id=${sourceId}&new_type=${target}&e_invoice=${target==='invoice'?1:0}&transform_keep_copy=1`;
 const result=await ficGet(ctx.c.tokens.access_token,url);
 return {source,data:cleanDocument(result.data),options:result.options};
}
export async function GET(request:Request){try{
 const ctx=await context(request),q=new URL(request.url).searchParams,mode=q.get('mode')||'list';
 if(mode==='operations'){const {data,error}=await ctx.service.from('raia_fic_documents').select('id,source_id,target_type,status,remote_id,remote_number,created_at').eq('company_id',ctx.company).in('status',['creating','reconcile']).order('created_at',{ascending:false}).limit(50);if(error)throw new FicError('Archivio operazioni non disponibile.',503);return json({data});}
 if(mode==='document'){const doc=(await ficGet(ctx.c.tokens.access_token,`/c/${ctx.company}/issued_documents/${id(q.get('id'))}`)).data;return json({data:doc});}
 const type=q.get('type')||'quote';if(!documentTypes[type])throw new FicError('Tipo documento non valido.');
 if(mode==='editor'){
  const ids=q.has('sourceIds')?joinIds(q.get('sourceIds')!.split(',').map(Number)):null;
  if(ids&&type!=='invoice')throw new FicError('I DDT possono essere uniti in fattura.');
  const [metadata,transformed]=await Promise.all([ficGet(ctx.c.tokens.access_token,`/c/${ctx.company}/issued_documents/info?type=${type}`),ids?joinDdtData(ctx.c.tokens.access_token,ctx.company,ids,q.get('group')==='1'):q.get('sourceId')?sourceData(ctx,id(q.get('sourceId')),type):Promise.resolve(null)]);
  const info=metadata.data;
  return json({info,data:transformed?.data,source:transformed?.source,sources:transformed&&'sources' in transformed?transformed.sources:undefined,companyId:ctx.company});
 }
 const page=Math.max(1,Math.min(100000,Number(q.get('page'))||1));
 const data=await ficGet(ctx.c.tokens.access_token,`/c/${ctx.company}/issued_documents?type=${type}&page=${page}&per_page=25&fieldset=detailed&sort=-date`);
 return json(data);
 }catch(e){return failure(e);}}
export async function POST(request:Request){try{
 sameOrigin(request);const ctx=await context(request);const body=await request.json();
 if(JSON.stringify(body).length>500000)throw new FicError('Documento troppo grande.');
 if(body.action==='recover'){
  const {data:op,error}=await ctx.service.from('raia_fic_documents').select('*').eq('id',body.operationId).eq('company_id',ctx.company).single();if(error||!op||!['creating','reconcile','created'].includes(op.status))throw new FicError('Operazione non recuperabile.');
  const remoteId=op.remote_id||id(body.remoteId);const doc=(await ficGet(ctx.c.tokens.access_token,`/c/${ctx.company}/issued_documents/${remoteId}`)).data;
  if(op.source_ids?.length&&!op.source_id)await verifyJoinedInvoice(ctx.c.tokens.access_token,ctx.company,op.source_ids,remoteId);
  if(!matchesRequestedDocument(doc,op.request_data))throw new FicError('Il documento non corrisponde alla richiesta originale.');
  const {error:saveError}=await ctx.service.rpc('raia_finish_document',{operation_id:op.id,document_id:doc.id,document_number:String(doc.number)+(doc.numeration||''),actor_id:ctx.userId});if(saveError)throw new FicError('Documento trovato, aggiornamento locale da completare. Riprova.',409);
  return json({created:true,data:doc});
 }
 if(body.action==='preview'){
  if(!body.sourceId&&!body.sourceIds&&body.document?.type!=='quote')throw new FicError('Crea un preventivo oppure scegli un documento da trasformare.');
  const ids=body.sourceIds?joinIds(body.sourceIds):null;
  if(ids&&(body.document?.type!=='invoice'||typeof body.group!=='boolean'||body.sourceId))throw new FicError('Unione non valida.');
  if(ids)await reconcileJoinReservations(ctx.service,ctx.c.tokens.access_token,ctx.company,ids,ctx.userId);
  const sourceId=ids?null:body.sourceId?id(body.sourceId):null;
  const transformed=ids?await joinDdtData(ctx.c.tokens.access_token,ctx.company,ids,body.group):sourceId?await sourceData(ctx,sourceId,body.document.type):null;
  let doc:any;try{doc=cleanDocument(body.document);validateDocument(doc);}catch(e){throw new FicError((e as Error).message);}
  if((sourceId||ids)&&doc.entity?.id!==transformed!.source.entity?.id)throw new FicError('La trasformazione deve mantenere il cliente del documento originale.');
  if(!sourceId&&!ids){const client=(await ficGet(ctx.c.tokens.access_token,`/c/${ctx.company}/entities/clients/${id(doc.entity?.id)}`)).data;doc.entity={...client,...doc.entity,id:client.id};}
  const {data:ws,error:wsError}=await ctx.db.from('raia_workspace').select('payload,revision').eq('id',1).single();if(wsError)throw new FicError('Gestionale non disponibile.');
  let workIds:string[]=[];
  if(ids){
   const results=await Promise.all([ctx.service.from('raia_fic_deliveries').select('work_ids').eq('company_id',ctx.company).in('remote_id',ids),ctx.service.from('raia_fic_ddts').select('order_id').eq('company_id',ctx.company).in('remote_id',ids),ctx.service.from('raia_fic_documents').select('work_ids').eq('company_id',ctx.company).eq('status','created').in('remote_id',ids)]);
   for(const r of results)if(r.error)throw r.error;
   workIds=[...new Set([...(results[0].data||[]).flatMap((d:any)=>d.work_ids||[]),...(results[2].data||[]).flatMap((d:any)=>d.work_ids||[]),...(ws.payload as Store).orders.filter(o=>(results[1].data||[]).some((d:any)=>d.order_id===o.id)).flatMap(o=>o.lines.map(l=>l.id))])] as string[];
  }else if(sourceId){
   const {data:previous,error:previousError}=await ctx.service.from('raia_fic_documents').select('work_ids').eq('company_id',ctx.company).eq('remote_id',sourceId).eq('status','created').maybeSingle();if(previousError)throw previousError;
   workIds=previous?.work_ids||[];
   if(transformed?.source.type==='delivery_note'){
    const {data:delivery}=await ctx.service.from('raia_fic_deliveries').select('work_ids').eq('company_id',ctx.company).eq('remote_id',sourceId).maybeSingle();
    workIds=delivery?.work_ids||workIds;
   }
  }else if(body.orderId){
   const store=ws.payload as Store,order=store.orders.find(o=>o.id===body.orderId);if(!order)throw new FicError('Ordine non trovato.');
   const client=store.clients.find(c=>c.id===order.clientId);if(client?.ficEntityId!==doc.entity.id||client?.ficCompanyId!==ctx.company)throw new FicError('Il cliente del documento deve corrispondere al cliente Fatture in Cloud associato all’ordine.');
   workIds=order.lines.map(l=>l.id);doc.subject='Ordine n. '+orderRegistrationNumbers(store.orders).get(order.id);
  }
  if((sourceId||ids)&&workIds.length){const rows=(ws.payload as Store).orders.flatMap(o=>o.lines.filter(l=>workIds.includes(l.id)).map(l=>({o,l})));if(rows.length!==workIds.length)throw new FicError('Una lavorazione collegata non esiste più.');if(doc.type==='invoice'&&rows.some(({l})=>l.invoiceId||/^(si|sì|true)$/i.test(l.production?.invoicing||'')))throw new FicError('Una lavorazione è già fatturata o collegata a una bozza.');}
  const options=transformed?transformed.options:{fix_payments:true};
  const result=await fetch(api+`/c/${ctx.company}/issued_documents/totals`,{method:'POST',headers:{Authorization:'Bearer '+ctx.c.tokens.access_token,'Content-Type':'application/json'},body:JSON.stringify({data:doc,options}),signal:AbortSignal.timeout(20000)});const totals=await result.json();if(!result.ok)throw new FicError(totals.error?.message||'Controlla i campi del documento.');
  const operationId=randomUUID();const {error}=await ctx.service.from('raia_fic_documents').insert({id:operationId,company_id:ctx.company,source_id:sourceId,...(ids?{source_ids:ids,source_fingerprints:Object.fromEntries((transformed as any).sources.map((s:any)=>[s.id,sourceDigest(s)]))}:{}),source_fingerprint:transformed?sourceDigest(transformed.source):null,target_type:doc.type,status:'prepared',request_data:doc,options,work_ids:workIds,workspace_revision:ws.revision,created_by:ctx.userId});if(error)throw new FicError('Impossibile salvare l’anteprima. Verifica la configurazione database.',503);
  return json({operationId,totals:totals.data,data:doc,confirmation:seal({id:operationId,user:ctx.userId,company:ctx.company,hash:digest(doc),expires:Date.now()+600000},'document-preview')});
 }
 if(body.action!=='create')throw new FicError('Operazione non valida.');
 const preview=unseal<any>(body.confirmation,'document-preview');if(preview.user!==ctx.userId||preview.company!==ctx.company||preview.expires<Date.now())throw new FicError('Anteprima scaduta. Ricalcola.',409);
 const {data:op,error}=await ctx.service.from('raia_fic_documents').select('*').eq('id',preview.id).eq('company_id',ctx.company).single();if(error||!op||digest(op.request_data)!==preview.hash)throw new FicError('Anteprima non valida.');
 if(op.status==='created')return json({created:true,data:(await ficGet(ctx.c.tokens.access_token,`/c/${ctx.company}/issued_documents/${op.remote_id}`)).data});
 if(op.source_ids?.length&&!op.source_id){const current=await readJoinSources(ctx.c.tokens.access_token,ctx.company,op.source_ids);validateJoinSources(current);if(current.some(s=>sourceDigest(s)!==op.source_fingerprints?.[s.id]))throw new FicError('Un DDT è cambiato: riapri l’unione.',409);}
 if(op.source_id){const currentSource=(await ficGet(ctx.c.tokens.access_token,`/c/${ctx.company}/issued_documents/${op.source_id}`)).data;if(sourceDigest(currentSource)!==op.source_fingerprint)throw new FicError('Il documento originale è stato modificato. Riapri la trasformazione.',409);}
 const {error:claimError}=await ctx.service.rpc('raia_claim_document',{operation_id:op.id,actor_id:ctx.userId});if(claimError)throw new FicError('Richiesta già inviata, trasformazione già eseguita o lavori modificati. Controlla le operazioni e ricarica.',409);
 try{
  const response=await fetch(api+`/c/${ctx.company}/issued_documents`,{method:'POST',headers:{Authorization:'Bearer '+ctx.c.tokens.access_token,'Content-Type':'application/json'},body:JSON.stringify({data:op.request_data,options:op.options}),signal:AbortSignal.timeout(20000)});
  const result=await response.json();if(!response.ok){if(response.status>=400&&response.status<500&&![408,409,429].includes(response.status)){await ctx.service.from('raia_fic_documents').update({status:'failed'}).eq('id',op.id);throw new FicError(result.error?.message||'Documento rifiutato da Fatture in Cloud.',422);}throw Error('uncertain');}
  const doc=result.data;if(!Number.isSafeInteger(doc?.id))throw Error('uncertain');
  const {error:recordError}=await ctx.service.from('raia_fic_documents').update({remote_id:doc.id,remote_number:String(doc.number)+(doc.numeration||'')}).eq('id',op.id);if(recordError)throw recordError;
  if(op.source_ids?.length&&!op.source_id)await verifyJoinedInvoice(ctx.c.tokens.access_token,ctx.company,op.source_ids,doc.id);
  const {error:finishError}=await ctx.service.rpc('raia_finish_document',{operation_id:op.id,document_id:doc.id,document_number:String(doc.number)+(doc.numeration||''),actor_id:ctx.userId});if(finishError)throw finishError;
  return json({created:true,data:doc});
 }catch(e){if(e instanceof FicError&&e.status===422)throw e;await ctx.service.from('raia_fic_documents').update({status:'reconcile'}).eq('id',op.id);throw new FicError('Esito da verificare. Non inviare di nuovo: usa Verifica operazione per recuperare il documento senza duplicarlo.',409);}
 }catch(e){return failure(e);}}
