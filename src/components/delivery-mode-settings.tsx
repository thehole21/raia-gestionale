'use client';
import {useState} from 'react';
import {BOOK_DELIVERIES} from '@/lib/work-categories';

export function DeliveryModeSettings({values=BOOK_DELIVERIES,onSave,disabled}:{values?:readonly string[];onSave:(values:string[])=>void;disabled:boolean}){
 const [name,setName]=useState('');
 const next=name.trim();
 const duplicate=values.some(value=>value.toLocaleLowerCase('it')===next.toLocaleLowerCase('it'));
 return <section className="workspace-card settings-panel"><div className="card-top"><div><h2>Modalità consegna</h2><p>Opzioni disponibili in Panoramica. I lavori già registrati conservano la modalità salvata.</p></div></div><div className="settings-editor-body"><form className="portal-actions" onSubmit={e=>{e.preventDefault();if(!next||duplicate||disabled)return;onSave([...values,next]);setName('');}}><input aria-label="Nuova modalità consegna" value={name} maxLength={100} onChange={e=>setName(e.target.value)}/><button className="btn btn-primary" disabled={disabled||!next||duplicate}>Aggiungi</button></form><ul>{values.map(value=><li key={value}>{value} <button type="button" className="btn btn-small btn-plain" disabled={disabled} aria-label={'Rimuovi '+value} onClick={()=>onSave(values.filter(v=>v!==value))}>Rimuovi</button></li>)}</ul></div></section>;
}
