 'use client';
import {useRef,useState,useEffect} from 'react';
import {Trash2,X} from 'lucide-react';
import {type Order,isInvoiced} from '@/lib/data';
import {DeleteOrder} from './delete-order';
export function DeleteWorkButton({order,workId,canDelete,getRevision}:{order:Order;workId?:string;canDelete:boolean;getRevision:()=>number}){
 const [open,setOpen]=useState(false),dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(open)dialog.current?.showModal();},[open]);
 const label=workId?'Elimina riga':'Elimina ordine';
 return <><button type="button" className="job-delete-button" disabled={!canDelete} onClick={()=>setOpen(true)} aria-label={label+': '+(workId?order.lines.find(w=>w.id===workId)?.description:order.title||order.number)}><Trash2 size={14}/>{label}</button>{open&&<dialog ref={dialog} className="raia-edit-dialog" onCancel={()=>setOpen(false)}><header><h2>{label}</h2><button type="button" className="icon-btn" aria-label="Chiudi eliminazione" onClick={()=>setOpen(false)}><X size={20}/></button></header><DeleteOrder order={order} workId={workId} canDelete={canDelete} getRevision={getRevision}/></dialog>}</>;
}
export function OrderActions({order,selected,onSelectAll,canDelete,getRevision}:{order:Order;selected:string[];onSelectAll:(ids:string[],checked:boolean)=>void;canDelete:boolean;getRevision:()=>number}){
 const eligible=order.lines.filter(w=>!isInvoiced(w)),ids=eligible.map(w=>w.id),count=ids.filter(id=>selected.includes(id)).length,checkbox=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(checkbox.current)checkbox.current.indeterminate=count>0&&count<ids.length;},[count,ids.length]);
 return <div className="order-actions"><label><input ref={checkbox} type="checkbox" aria-label={'Seleziona tutte le righe di '+(order.title||order.number)} checked={ids.length>0&&count===ids.length} disabled={!ids.length} onChange={e=>onSelectAll(ids,e.target.checked)}/>Seleziona tutto</label><DeleteWorkButton order={order} canDelete={canDelete} getRevision={getRevision}/></div>;
}
