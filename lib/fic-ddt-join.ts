import {ficGet,FicError} from './fic-server';
import {cleanDocument} from './fic-documents';
import {ddtInvoiceLink} from './fic-ddt-status';
export function joinIds(value:unknown):number[]{
 if(!Array.isArray(value)||!value.length||value.length>50||value.some(v=>!Number.isSafeInteger(v)||v<1)||new Set(value).size!==value.length)throw new FicError('Seleziona da 1 a 50 DDT distinti.');
 return value as number[];
}
export async function readJoinSources(token:string,company:number,ids:number[]){
 const sources:any[]=[];
 for(let i=0;i<ids.length;i+=5)sources.push(...await Promise.all(ids.slice(i,i+5).map(async id=>(await ficGet(token,`/c/${company}/issued_documents/${id}`)).data)));
 return sources;
}
export function validateJoinSources(sources:any[]){
 if(sources.some(s=>s?.type!=='delivery_note'))throw new FicError('Seleziona soltanto documenti di trasporto.');
 if(!sources[0]?.entity?.id||sources.some(s=>s.entity?.id!==sources[0].entity.id))throw new FicError('I DDT da unire devono appartenere allo stesso cliente Fatture in Cloud.');
 for(const s of sources){const link=ddtInvoiceLink(s);if(link.state!=='unbilled')throw new FicError(`DDT ${s.number}: ${link.state==='linked'?'già collegato a un documento':'collegamento da verificare in Fatture in Cloud'}. Aggiorna l’elenco.`,409);}
}
export async function joinDdtData(token:string,company:number,ids:number[],group:boolean){
 const sources=await readJoinSources(token,company,ids);validateJoinSources(sources);
 const result=await ficGet(token,`/c/${company}/issued_documents/join?ids=${ids.join(',')}&group=${group?1:0}&e_invoice=1`);
 const from=result.options?.create_from;
 if(!Array.isArray(from)||from.length!==ids.length||from.some((v:any)=>!ids.includes(Number(v)))||new Set(from.map(Number)).size!==ids.length)throw new FicError('Fatture in Cloud non ha restituito tutti i riferimenti DDT. Nessuna fattura creata.',502);
 if(result.data?.type!=='invoice'||result.data?.entity?.id!==sources[0].entity.id)throw new FicError('Risposta di unione non coerente con i DDT selezionati.',502);
 // The official options (especially create_from) must reach Create unchanged.
 return {sources,source:sources[0],data:cleanDocument(result.data),options:result.options};
}
export async function verifyJoinedInvoice(token:string,company:number,ids:number[],invoiceId:number){
 const sources=await readJoinSources(token,company,ids);
 if(sources.some(s=>s.type!=='delivery_note'||ddtInvoiceLink(s).id!==invoiceId))throw new FicError('Fattura creata, ma collegamenti DDT non ancora confermati da Fatture in Cloud. Usa Verifica operazione; non creare una seconda fattura.',409);
}

// A locally recorded invoice can have been deleted directly in Fatture in Cloud.
// Release its source reservations only after an exact 404 and a valid company request.
export async function reconcileJoinReservations(service:any,token:string,company:number,ids:number[],actor:string){
 const {data,error}=await service.from('raia_fic_documents').select('id,remote_id,remote_number,work_ids').eq('company_id',company).eq('target_type','invoice').eq('status','created').or(ids.map(id=>`source_ids.cs.[${id}]`).join(','));
 if(error)throw new FicError('Verifica delle fatture collegate non disponibile.',503);
 for(const op of data||[]){
  if(!Number.isSafeInteger(op.remote_id))throw new FicError('Una fattura precedente richiede una verifica.',409);
  const response=await fetch(`https://api-v2.fattureincloud.it/c/${company}/issued_documents/${op.remote_id}`,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(response.ok)throw new FicError(`Esiste già la fattura ${op.remote_number||op.remote_id} per uno dei DDT selezionati. Verifica il collegamento in Fatture in Cloud.`,409);
  if(response.status!==404)throw new FicError('Impossibile verificare la fattura precedente. Nessun collegamento modificato.',409);
  await ficGet(token,`/c/${company}/issued_documents/info?type=invoice`);
  const result=op.work_ids?.length?await service.rpc('raia_remove_deleted_fic_invoice',{target_draft:'ficdoc_'+op.id,target_company:company,document_id:op.remote_id,actor_id:actor}):await service.from('raia_fic_documents').update({status:'removed',updated_at:new Date().toISOString()}).eq('id',op.id).eq('status','created');
  if(result.error)throw new FicError('Aggiornamento della fattura eliminata non riuscito. Riprova.',409);
 }
}
