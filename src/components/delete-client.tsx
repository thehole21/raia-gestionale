'use client';
import {useEffect,useRef,useState} from 'react';
import {Trash2,X} from 'lucide-react';
import {cloud} from '@/lib/supabase';
import {useAccess} from './access';
import type {Client} from '@/lib/data';

export function DeleteClient({client,orderCount,draftCount,canDelete,getRevision,onDeleteDemo}:{client:Client;orderCount:number;draftCount:number;canDelete:boolean;getRevision:()=>number;onDeleteDemo:()=>void}){
 const {demo,profile}=useAccess();
 const dialog=useRef<HTMLDialogElement>(null);
 const [open,setOpen]=useState(false),[password,setPassword]=useState(''),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const element=dialog.current;if(!element)return;if(open&&!element.open)element.showModal();if(!open&&element.open)element.close();},[open]);
 if(!demo&&profile.role!=='admin')return null;
 const demoBlocked=demo&&(orderCount>0||draftCount>0);
 return <>
  <button type="button" className="btn btn-danger client-delete-button" disabled={!canDelete} onClick={()=>{setError('');setOpen(true);}}><Trash2 size={15}/> Elimina cliente</button>
  <dialog ref={dialog} className="raia-edit-dialog client-delete-dialog" aria-labelledby="delete-client-title" onCancel={()=>{if(!busy)setOpen(false);}}>
   <header><div><h2 id="delete-client-title">Elimina {client.name}</h2><p className="client-edit-hint">Questa operazione non può essere annullata.</p></div><button type="button" className="icon-btn" aria-label="Chiudi" disabled={busy} onClick={()=>setOpen(false)}><X size={20}/></button></header>
   <div className="client-delete-details"><p>{orderCount?`${orderCount} ${orderCount===1?'ordine verrà archiviato':'ordini verranno archiviati'} in «Ordini annullati».`: 'Il cliente verrà rimosso dall’anagrafica.'}</p>{draftCount>0&&<p role="alert">Il cliente ha {draftCount} bozze di fatturazione collegate. Rimuovile prima di eliminare il cliente.</p>}{demo&&orderCount>0&&<p role="alert">Nella demo non è possibile archiviare ordini collegati. Accedi all’area Supabase per completare l’operazione.</p>}{demo&&draftCount===0&&orderCount===0&&<p>La demo elimina solo il cliente senza ordini e senza bozze collegate.</p>}{error&&<p role="alert" className="error-text">{error}</p>}</div>
   <label className="client-delete-confirm"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/> Confermo l’eliminazione del cliente e l’archiviazione degli ordini indicati</label>
   {!demo&&<label className="form-field">Password di {profile.email}<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>}
   <footer><button type="button" className="btn btn-plain" disabled={busy} onClick={()=>setOpen(false)}>Annulla</button><button type="button" className="btn btn-danger" disabled={!checked||busy||!canDelete||demoBlocked||draftCount>0||(!demo&&!password)} onClick={async()=>{
    if(demo){onDeleteDemo();setOpen(false);return;}
    setBusy(true);setError('');
    try{
     const {data:{session}}=await cloud().auth.getSession();
     if(!session)throw new Error('Sessione scaduta. Accedi di nuovo.');
     const response=await fetch('/api/clients/delete',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({clientId:client.id,password,expectedRevision:getRevision()})});
     const result=await response.json();
     if(!response.ok)throw new Error(result.error||'Eliminazione non riuscita.');
     location.reload();
    }catch(e){setError(e instanceof Error?e.message:'Eliminazione non riuscita.');setBusy(false);setPassword('');}
   }}>{busy?'Verifica…':'Conferma eliminazione'}</button></footer>
  </dialog>
 </>;
}
