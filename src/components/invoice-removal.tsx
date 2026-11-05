'use client';
import {useState} from 'react';
import {cloud} from '@/lib/supabase';
export function InvoiceRemoval({draftId,disabled}:{draftId:string;disabled:boolean}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[confirmed,setConfirmed]=useState(false);
 async function run(action:'verify'|'delete'){
  setBusy(true);setMessage('');
  try{const {data:{session}}=await cloud().auth.getSession();const response=await fetch('/api/fatture-in-cloud/invoices/remove',{method:'POST',headers:{Authorization:'Bearer '+session?.access_token,'Content-Type':'application/json'},body:JSON.stringify({draftId,action,confirm:confirmed})});const result=await response.json();if(!response.ok)throw Error(result.error||'Operazione non riuscita.');if(result.removed){setMessage('Fattura rimossa. Le lavorazioni sono nuovamente non fatturate e l’ordine può essere eliminato.');window.dispatchEvent(new Event('focus'));}else setMessage('La fattura è ancora presente su Fatture in Cloud. Per eliminarla, conferma qui sotto.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
 }
 return <div><button type="button" className="btn btn-small btn-plain" disabled={disabled||busy} onClick={()=>setOpen(!open)}>Elimina / verifica fattura</button>{open&&<div className="delete-confirm"><p>Se hai già eliminato la fattura su Fatture in Cloud, verifica la cancellazione per sbloccare le lavorazioni.</p><button type="button" className="btn btn-plain" disabled={busy||disabled} onClick={()=>run('verify')}>Verifica cancellazione</button><label><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/> Confermo di voler eliminare questa fattura anche da Fatture in Cloud.</label><button type="button" className="btn btn-danger" disabled={busy||disabled||!confirmed} onClick={()=>run('delete')}>{busy?'Verifica in corso…':'Elimina fattura'}</button>{message&&<p role="status">{message}</p>}</div>}</div>;
}
