'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown,X} from 'lucide-react';
export function MultiPicker({label,options,values,onChange}:{label:string;options:{id:string;name:string}[];values:string[];onChange:(values:string[])=>void}){
 const [open,setOpen]=useState(false),[draft,setDraft]=useState<string[]>([]),[search,setSearch]=useState('');const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(open)dialog.current?.showModal();},[open]);
 const names=values.map(id=>options.find(o=>o.id===id)?.name||id);
 return <><button type="button" className="multi-trigger" aria-label={label} aria-haspopup="dialog" onClick={()=>{setDraft(values);setSearch('');setOpen(true);}}><span>{names.join(', ')||'Non assegnato'}</span><ChevronDown size={13}/></button>{open&&createPortal(<dialog ref={dialog} className="multi-dialog" aria-label={label} onCancel={e=>{e.stopPropagation();setOpen(false);}} onKeyDown={e=>e.stopPropagation()}><header><strong>{label}</strong><button type="button" className="icon-btn" aria-label="Chiudi selezione" onClick={()=>setOpen(false)}><X size={18}/></button></header><input type="search" autoComplete="off" aria-label="Filtra opzioni" placeholder="Cerca…" value={search} onChange={e=>setSearch(e.target.value)}/><div className="multi-options">{[...options,...values.filter(id=>!options.some(o=>o.id===id)).map(id=>({id,name:id+' · storico'}))].filter(o=>o.name.toLocaleLowerCase('it').includes(search.toLocaleLowerCase('it'))).map(o=><label key={o.id}><input type="checkbox" checked={draft.includes(o.id)} onChange={e=>setDraft(v=>e.target.checked?[...v,o.id]:v.filter(id=>id!==o.id))}/>{o.name}</label>)}</div><footer><button type="button" className="btn btn-plain" onClick={()=>setDraft([])}>Nessuno</button><button type="button" className="btn btn-primary" onClick={()=>{onChange(draft);setOpen(false);}}>Applica</button></footer></dialog>,document.body)}</>;
}
