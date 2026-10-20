'use client';
import { useState } from 'react';
import { type Order, type DeliveryNote } from '@/lib/data';
export function DeliveryNoteSection({order,onSave}:{order:Order;onSave:(ddt:DeliveryNote)=>void}){
 const [number,setNumber]=useState(order.ddt?.number||'');const [date,setDate]=useState(order.ddt?.date||'');const [message,setMessage]=useState('');
 return <section className="ddt-section"><h3>Documento di trasporto</h3><p>Riferimento DDT collegato al lavoro e alla futura fattura.</p><div className="grid-form"><label className="form-field">Numero DDT<input value={number} maxLength={80} onChange={e=>{setNumber(e.target.value);setMessage('');}} placeholder="Es. 125/2026"/></label><label className="form-field">Data DDT<input type="date" value={date} onChange={e=>{setDate(e.target.value);setMessage('');}}/></label></div><button type="button" className="btn btn-plain" onClick={()=>{if((number.trim()&&!date)||(!number.trim()&&date)){setMessage('Inserisci sia il numero sia la data del DDT.');return;}onSave({number:number.trim(),date});setMessage('DDT aggiornato. Verifica lo stato del salvataggio in alto.');}}>Salva DDT</button>{message&&<p role="status" className="helper-text">{message}</p>}</section>;
}
