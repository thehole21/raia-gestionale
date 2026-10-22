'use client';
import { useEffect, useState } from 'react';
import { type Order, type DeliveryNote } from '@/lib/data';
import {announcePendingEdit} from '@/lib/pending-edits';
export function DeliveryNoteSection({order,onSave}:{order:Order;onSave:(ddt:DeliveryNote)=>void}){
 const [number,setNumber]=useState(order.ddt?.number||'');const [date,setDate]=useState(order.ddt?.date||'');const [message,setMessage]=useState('');
 const [saved,setSaved]=useState({number:order.ddt?.number||'',date:order.ddt?.date||''});
 const dirty=number!==saved.number||date!==saved.date;
 function save(){if(((order.ddt?.number||'')!==saved.number||(order.ddt?.date||'')!==saved.date)){setMessage('Dati aggiornati da un altro operatore. Copia le modifiche e riapri il dettaglio.');return false;}if((number.trim()&&!date)||(!number.trim()&&date)){setMessage('Inserisci sia il numero sia la data del DDT.');return false;}onSave({number:number.trim(),date});setSaved({number,date});setMessage('DDT aggiornato. Verifica lo stato del salvataggio in alto.');return true;}
 useEffect(()=>{announcePendingEdit({key:'ddt-'+order.id,dirty,save});},[number,date,saved,dirty,order.id]);
 useEffect(()=>()=>announcePendingEdit({key:'ddt-'+order.id,dirty:false,save:()=>true}),[order.id]);
 return <section className="ddt-section"><h3>Documento di trasporto</h3><p>Riferimento DDT collegato al lavoro e alla futura fattura.</p><div className="grid-form"><label className="form-field">Numero DDT<input value={number} maxLength={80} onChange={e=>{setNumber(e.target.value);setMessage('');}} placeholder="Es. 125/2026"/></label><label className="form-field">Data DDT<input type="date" value={date} onChange={e=>{setDate(e.target.value);setMessage('');}}/></label></div><button type="button" className="btn btn-plain" onClick={save}>Salva DDT</button>{message&&<p role="status" className="helper-text">{message}</p>}</section>;
}
