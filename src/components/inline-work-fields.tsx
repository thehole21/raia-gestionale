'use client';
import {useEffect,useState,useRef} from 'react';
import {type WorkRow,type Work,workDue} from '@/lib/data';
import {bookProduction} from '@/lib/work-categories';
export function QuantityEditor({row,onUpdate}:{row:WorkRow;onUpdate:(id:string,patch:Partial<Work>)=>void}){
 const saved=row.production?.quantity??String(row.qty),[value,setValue]=useState(saved),[error,setError]=useState('');
 useEffect(()=>{setValue(saved);setError('');},[saved]);
 function save(){const text=value.trim();if(text===saved)return;if(!text||!/^\d+(?:[.,]\d+)?(?:\s*\+\s*\d+(?:[.,]\d+)?)*$/.test(text)){setError('Inserisci una quantità, es. 100 oppure 100+2.');return;}const qty=text.includes('+')?0:Number(text.replace(',','.'));onUpdate(row.id,{qty,production:{...bookProduction(row,row.order),category:row.production?.category||'Lavori',quantity:text}});setError('');}
 return <div><input className="inline-quantity" aria-label={'Quantità di '+row.description} aria-invalid={!!error} inputMode="decimal" value={value} onChange={e=>setValue(e.target.value)} onBlur={save} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}if(e.key==='Escape'){setValue(saved);setError('');}}}/>{error&&<small role="alert">{error}</small>}</div>;
}
export function DueEditor({row,onUpdate}:{row:WorkRow;onUpdate:(id:string,patch:Partial<Work>)=>void}){
 const input=useRef<HTMLInputElement>(null),due=workDue(row,row.order);
 return <div className="inline-due" onClick={e=>{if((e.target as HTMLElement).closest("button"))return;try{input.current?.showPicker();}catch{}}}><input ref={input} type="date" aria-label={'Consegna richiesta di '+row.description} value={due||''} onClick={()=>{try{input.current?.showPicker();}catch{}}} onChange={e=>{if(!e.target.validity.valid)return;onUpdate(row.id,{production:{...bookProduction(row,row.order),category:row.production?.category||'Lavori',requestedDate:e.target.value,requestedText:''}});}}/>{!due&&<small>Non precisata</small>}{due&&<button type="button" aria-label={'Rimuovi scadenza di '+row.description} onClick={()=>onUpdate(row.id,{production:{...bookProduction(row,row.order),category:row.production?.category||'Lavori',requestedDate:'',requestedText:''}})}>×</button>}</div>;
}
