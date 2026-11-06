import {ddtContext} from '@/lib/fic-ddt-server';
import {bearer,connection,failure,FicError,sameOrigin,ficGet} from '@/lib/fic-server';
import {inspectDdt,trackedDdts} from '@/lib/fic-ddt-management';
import {ddtInvoiceLink} from '@/lib/fic-ddt-status';
export const runtime='nodejs';export const maxDuration=60;
const json=(data:unknown)=>Response.json(data,{headers:{'Cache-Control':'no-store'}});
async function context(request:Request){const ctx=await ddtContext(bearer(request)),c=await connection(ctx);if(!c?.row.company_id)throw new FicError('Un amministratore deve collegare Fatture in Cloud.',409);return {ctx,c};}
export async function GET(request:Request){try{
 const {c}=await context(request),q=new URL(request.url).searchParams,page=Number(q.get('page')||1);
 if(!Number.isSafeInteger(page)||page<1||page>100000)throw new FicError('Pagina non valida.');
 const words=(q.get('search')||'').slice(0,120).match(/[\p{L}\p{N}]+/gu)||[];
 const filter=words.map(w=>`(entity.name contains '${w}' or any_subject contains '${w}'${/^\d+$/.test(w)?' or number = '+Number(w):''})`).join(' and ');
 const result=await ficGet(c.tokens.access_token,`/c/${c.row.company_id}/issued_documents?type=delivery_note&per_page=25&page=${page}&fieldset=detailed&sort=-date,-number${filter?'&q='+encodeURIComponent(filter):''}`);
 const linked=new Map<number,Promise<any>>(),deadline=Date.now()+20000;
 const documents:any[]=[];
 for(let i=0;i<(result.data||[]).length;i+=3){documents.push(...await Promise.all(result.data.slice(i,i+3).map(async(d:any)=>{
  const link=ddtInvoiceLink(d);let state:string=link.state==='linked'?'unknown':link.state,invoiceNumber='';
  if(link.id&&Date.now()<deadline){try{if(!linked.has(link.id))linked.set(link.id,ficGet(c.tokens.access_token,`/c/${c.row.company_id}/issued_documents/${link.id}?fields=id,type,number,numeration`));const invoice=(await linked.get(link.id)).data;if(invoice?.type==='invoice'){state='billed';invoiceNumber=String(invoice.number)+(invoice.numeration||'');}else state='unknown';}catch{state='unknown';}}
  return {id:d.id,number:String(d.number)+(d.numeration||''),client:d.entity?.name||'',clientId:d.entity?.id||0,subject:d.visible_subject||d.subject||'',date:d.date,state,invoiceNumber};
 })));}
 return json({documents,next:result.current_page<result.last_page?page+1:0,total:result.total});
 }catch(e){return failure(e);}}
export async function POST(request:Request){try{
 sameOrigin(request);const {ctx,c}=await context(request),body=await request.json();
 if(body.action==='sync'){
  const after=Number(body.after||0);if(!Number.isSafeInteger(after)||after<0)throw new FicError('Pagina non valida.');
  const rows=await trackedDdts(ctx,c.row.company_id,after,6);let removed=0;
  // At most three simultaneous reads, and bounded work per request. Never block navigation.
  for(let i=0;i<rows.length;i+=3){const results=await Promise.allSettled(rows.slice(i,i+3).map(d=>inspectDdt(ctx,c.tokens.access_token,c.row.company_id,d.remote_id)));for(const r of results){if(r.status==='rejected')throw r.reason;if(r.value.removed)removed++;}}
  return json({removed,next:rows.length===6?rows.at(-1)!.remote_id:0});
 }
 if(!['open','delete'].includes(body.action)||!Number.isSafeInteger(body.id)||body.id<1)throw new FicError('Richiesta non valida.');
 if(body.action==='delete'&&body.confirm!==true)throw new FicError('Conferma la cancellazione.');
 return json(await inspectDdt(ctx,c.tokens.access_token,c.row.company_id,body.id,body.action==='delete'));
 }catch(e){return failure(e);}}
