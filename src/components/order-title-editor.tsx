 'use client';
import {useEffect,useState} from 'react';
import {Pencil,Check,X} from 'lucide-react';
import type {Order} from '@/lib/data';
import {announcePendingEdit} from '@/lib/pending-edits';
export type SaveOrderTitle=(id:string,title:string,previous:string)=>boolean;
export function OrderTitleEditor({order,onSave}:{order:Order;onSave:SaveOrderTitle}){
 const [editing,setEditing]=useState(false),[value,setValue]=useState(''),[baseline,setBaseline]=useState(''),[error,setError]=useState('');
 function save(){const title=value.trim();if(!title){setError('Inserisci il titolo del lavoro.');return false;}if(!onSave(order.id,title,baseline)){setError('Titolo aggiornato nel frattempo. Annulla e riapri la modifica.');return false;}setEditing(false);setError('');return true;}
 useEffect(()=>{announcePendingEdit({key:'title-'+order.id,dirty:editing&&value.trim()!==baseline,save});},[editing,value,baseline,order.id,onSave]);
 useEffect(()=>()=>announcePendingEdit({key:'title-'+order.id,dirty:false,save:()=>true}),[order.id]);
 if(!editing)return <button type="button" className="order-title-edit" aria-label={(order.title?'Modifica titolo: '+order.title:'Aggiungi titolo')+' · '+order.number} onClick={()=>{setBaseline(order.title||'');setValue(order.title||'');setError('');setEditing(true);}}><span>{order.title?.trim()||'Aggiungi titolo'}</span><Pencil size={14}/></button>;
 return <div className="order-title-editor"><input autoFocus aria-label={'Titolo del lavoro '+order.number} maxLength={200} value={value} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();save();}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setEditing(false);}}}/><button type="button" className="icon-btn" aria-label="Salva titolo" onClick={save}><Check size={18}/></button><button type="button" className="icon-btn" aria-label="Annulla modifica titolo" onClick={()=>setEditing(false)}><X size={18}/></button>{error&&<small role="alert">{error}</small>}</div>;
}
