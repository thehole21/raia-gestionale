'use client';
import {useEffect,useRef,useState} from 'react';
import {X,Check} from 'lucide-react';
import type {Client} from '@/lib/data';
const fields=[['name','Nome / ragione sociale'],['email','Email'],['phone','Telefono'],['address','Indirizzo'],['postalCode','CAP'],['city','Città'],['province','Provincia'],['country','Paese'],['vat','Partita IVA'],['taxCode','Codice fiscale'],['recipientCode','Codice destinatario SDI'],['pec','PEC']] as const;
type Values=Partial<Record<typeof fields[number][0],string>>;
export function ClientEditor({client,onClose,onSave}:{client:Client;onClose:()=>void;onSave:(changes:Values)=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const form=useRef<HTMLFormElement>(null);
 const [values,setValues]=useState<Values>(()=>Object.fromEntries(fields.map(([key])=>[key,client[key]||''])));
 const [confirmExit,setConfirmExit]=useState(false);
 useEffect(()=>{const element=dialog.current;if(!element)return;element.showModal();return()=>{if(element.open)element.close();};},[]);
 const initialValues=Object.fromEntries(fields.map(([key])=>[key,client[key]||'']));
 const dirty=fields.some(([key])=>(values[key]||'').trim()!==(initialValues[key]||'').trim());
 function requestClose(){if(dirty)setConfirmExit(true);else onClose();}
 return <dialog ref={dialog} className="raia-edit-dialog" aria-labelledby="client-edit-title" onCancel={e=>{e.preventDefault();requestClose();}}>
  <header><div><h2 id="client-edit-title">Modifica cliente</h2><p className="client-edit-hint">I dati completi saranno inclusi nelle preparazioni di fatturazione.</p></div><button type="button" className="icon-btn" aria-label="Chiudi" onClick={requestClose}><X size={20}/></button></header>
  <form ref={form} onSubmit={e=>{e.preventDefault();if(!values.name?.trim())return;onSave(Object.fromEntries(Object.entries(values).map(([key,value])=>[key,value?.trim()||''])));}}>
   <div className="client-edit-fields">{fields.map(([key,label])=><label key={key} className="form-field"><span>{label}</span><input required={key==='name'} autoFocus={key==='name'} type={key==='email'||key==='pec'?'email':key==='phone'?'tel':'text'} value={values[key]||''} onChange={e=>setValues(old=>({...old,[key]:e.target.value}))}/></label>)}</div>
   <footer><button type="button" className="btn btn-plain" onClick={requestClose}>Annulla</button><button type="submit" className="btn btn-primary"><Check size={16}/> Salva modifiche</button></footer>
  </form>
  {confirmExit&&<div className="unsaved-prompt-backdrop"><section className="unsaved-prompt" role="alertdialog" aria-modal="true" aria-labelledby="client-unsaved-title"><h3 id="client-unsaved-title">Modifiche non salvate</h3><p>Vuoi salvare le modifiche prima di uscire?</p><div><button type="button" className="btn btn-primary" onClick={()=>form.current?.requestSubmit()}>Salvare e uscire</button><button type="button" className="btn btn-plain" onClick={onClose}>Uscire senza salvare</button><button type="button" className="btn btn-plain" onClick={()=>setConfirmExit(false)}>Continua a modificare</button></div></section></div>}
 </dialog>;
}
