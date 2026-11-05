import {createClient} from '@supabase/supabase-js';
import {admin,bearer,connection,FicError,failure,sameOrigin} from '@/lib/fic-server';
export const runtime='nodejs';
export const maxDuration=60;
const base='https://api-v2.fattureincloud.it';
export async function POST(request:Request){try{
 sameOrigin(request);
 const ctx=await admin(bearer(request));
 const body=await request.json();
 if(typeof body.draftId!=='string'||!['verify','delete'].includes(body.action))throw new FicError('Richiesta non valida.');
 const {data:op,error}=await ctx.db.from('raia_fic_invoices').select('*').eq('draft_id',body.draftId).single();
 if(error||!op?.remote_id)throw new FicError('Fattura non collegata o già rimossa. Aggiorna la pagina.',409);
 const c=await connection(ctx);
 if(!c||c.row.company_id!==op.company_id)throw new FicError('Seleziona nelle impostazioni la stessa azienda della fattura.',409);
 const secret=process.env.SUPABASE_SECRET_KEY;
 if(!secret)throw new FicError('Configurare SUPABASE_SECRET_KEY sul server.',503);
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 // Check that the migration is available before deleting anything remotely.
 const {error:setupError}=await db.from('raia_fic_invoice_removals').select('id').limit(0);
 if(setupError)throw new FicError('Aggiornamento database necessario: applicare fic-invoice-removal.sql su Supabase.',503);
 const path=`/c/${op.company_id}/issued_documents/${op.remote_id}`;
 const remote=(method='GET')=>fetch(base+path,{method,headers:{Authorization:'Bearer '+c.tokens.access_token,Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000)});
 let response=await remote();
 if(response.ok){
  const doc=(await response.json()).data;
  if(doc?.id!==op.remote_id||doc.type!=='invoice')throw new FicError('Il documento non corrisponde alla fattura collegata.',409);
  if(body.action==='verify')return Response.json({exists:true},{headers:{'Cache-Control':'no-store'}});
  if(body.confirm!==true)throw new FicError('Conferma richiesta.');
  const deleted=await remote('DELETE');
  if(!deleted.ok)throw new FicError('Fatture in Cloud non ha confermato la cancellazione. Controlla lo stato del documento e i permessi; il gestionale non è stato modificato.',409);
  response=await remote();
 }
 // Only an actual 404 authorizes unlinking, never a timeout, 403, 429 or 5xx.
 if(response.status!==404)throw new FicError('Impossibile confermare la cancellazione su Fatture in Cloud. Nessun collegamento rimosso: riprova con Verifica cancellazione.',409);
 // A valid company-scoped request distinguishes a missing document from inaccessible company.
 const company=await fetch(base+`/c/${op.company_id}/issued_documents/info?type=invoice`,{headers:{Authorization:'Bearer '+c.tokens.access_token},cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!company.ok)throw new FicError('Impossibile verificare l’accesso all’azienda. Ricollega Fatture in Cloud.',409);
 const {error:removeError}=await db.rpc('raia_remove_deleted_fic_invoice',{target_draft:body.draftId,target_company:op.company_id,document_id:op.remote_id,actor_id:ctx.userId});
 if(removeError)throw new FicError('Fattura assente su Fatture in Cloud, ma aggiornamento locale non riuscito. Riprova Verifica cancellazione.',409);
 return Response.json({removed:true},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}}
