import {ddtContext} from './fic-ddt-server';
import {FicError} from './fic-server';
type Context=Awaited<ReturnType<typeof ddtContext>>;
export type TrackedDdt={remote_id:number;remote_number:string;order_id?:string;request_data:any};
// Keyset pagination across all three generations of the document ledger.
export async function trackedDdts(ctx:Context,company:number,after=0,limit=30){
 const results=await Promise.all(['raia_fic_deliveries','raia_fic_ddts','raia_fic_documents'].map(table=>{
  let q=ctx.db.from(table).select(table==='raia_fic_documents'?'remote_id,remote_number,request_data':'remote_id,remote_number,order_id,request_data').eq('company_id',company).gt('remote_id',after).order('remote_id').limit(limit);
  q=table==='raia_fic_documents'?q.eq('target_type','delivery_note').eq('status','created'):q.neq('status','failed');return q;
 }));
 for(const r of results)if(r.error)throw new FicError('Elenco DDT non disponibile.',503);
 const unique=new Map<number,TrackedDdt>();for(const r of results)for(const row of r.data||[]){const d=row as unknown as TrackedDdt;if(!unique.has(d.remote_id))unique.set(d.remote_id,d);}
 return [...unique.values()].sort((a,b)=>a.remote_id-b.remote_id).slice(0,limit);
}
export async function trackedDdt(ctx:Context,company:number,id:number){const rows=await trackedDdts(ctx,company,id-1,1);if(rows[0]?.remote_id!==id)throw new FicError('DDT non collegato o già rimosso.',404);return rows[0];}
export async function inspectDdt(ctx:Context,token:string,company:number,id:number,remove=false){
 const base=`https://api-v2.fattureincloud.it/c/${company}/issued_documents`;
 const call=(path:string,method='GET')=>fetch(base+path,{method,headers:{Authorization:'Bearer '+token,Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(12000)});
 // Fail before any remote deletion when the database migration is unavailable.
 const {error:setup}=await ctx.db.from('raia_fic_ddt_removals').select('id').limit(0);
 if(setup)throw new FicError('Aggiornamento database DDT necessario.',503);
 let response=await call('/'+id);
 if(response.ok){
  const doc=(await response.json()).data;
  if(doc?.id!==id||doc.type!=='delivery_note')throw new FicError('Il documento non è il DDT collegato.',409);
  if(!remove)return {removed:false,number:String(doc.number)+(doc.numeration||''),url:doc.url};
  const deleted=await call('/'+id,'DELETE');
  if(!deleted.ok)throw new FicError('Fatture in Cloud non ha confermato la cancellazione del DDT. Nessun riferimento locale rimosso.',409);
  response=await call('/'+id);
 }
 if(response.status!==404)throw new FicError('Verifica DDT non riuscita. Nessun riferimento rimosso; riprova tra poco.',response.status===429?429:502);
 const access=await call('/info?type=delivery_note');
 if(!access.ok)throw new FicError('Accesso all’azienda non verificato. Il DDT resta nel gestionale.',409);
 const {error}=await ctx.db.rpc('raia_remove_deleted_fic_ddt',{target_company:company,document_id:id,actor_id:ctx.userId});
 if(error)throw new FicError('DDT assente in Fatture in Cloud: riprova la sincronizzazione per aggiornare il gestionale.',409);
 return {removed:true};
}
