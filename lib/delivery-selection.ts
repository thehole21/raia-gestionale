import type {Order,Work} from './data';
export function workDdt(work:Work,order:Order){return work.ddt||order.deliveryNotes?.find(d=>d.workIds?.includes(work.id))||order.ddt;}
export function workDdtNumber(work:Work,order:Order){return workDdt(work,order)?.number||work.production?.ddtNumber||'';}
export function deliverySelection(order:Order,ids:unknown,reserved:string[]=[]){
 if(!Array.isArray(ids)||!ids.length||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)throw Error('Seleziona almeno una lavorazione, senza duplicati.');
 const lines=ids.map(id=>order.lines.find(w=>w.id===id));
 if(lines.some(w=>!w))throw Error('Una lavorazione non appartiene a questo ordine.');
 const selected=lines as Work[];
 if(selected.some(w=>workDdtNumber(w,order)||reserved.includes(w.id)))throw Error('Una lavorazione è già inclusa in un DDT o in una richiesta da verificare.');
 if(selected.some(w=>!Number.isFinite(w.qty)||w.qty<=0))throw Error('Completa le quantità delle lavorazioni selezionate.');
 return selected;
}
