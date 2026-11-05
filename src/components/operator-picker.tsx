'use client';
import {useEffect,useRef,useState,useId,createContext,useContext} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown} from 'lucide-react';
import {operatorIds} from '@/lib/assignments';
import type {Work,Operator} from '@/lib/data';
export const OperatorHistoryContext=createContext<Operator[]>([]);
export function OperatorPicker({work,operators,onChange,label='Operatori'}:{work:Partial<Pick<Work,'operatorId'|'operatorIds'>>;operators:Operator[];onChange:(patch:Partial<Work>)=>void;label?:string}){
 const [search,setSearch]=useState('');
 const [mounted,setMounted]=useState(false),[open,setOpen]=useState(false),[position,setPosition]=useState({left:0,top:0,width:230,maxHeight:320});
 const menu=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),menuId=useId();
 const history=useContext(OperatorHistoryContext);
 const selected=operatorIds(work);
 useEffect(()=>setMounted(true),[]);
 useEffect(()=>{if(!open)return;const close=()=>menu.current?.hidePopover();const scroll=(e:Event)=>{if(!menu.current?.contains(e.target as Node))close();};window.addEventListener('resize',close);window.addEventListener('scroll',scroll,true);return()=>{window.removeEventListener('resize',close);window.removeEventListener('scroll',scroll,true);};},[open]);
 function toggle(){if(open){menu.current?.hidePopover();return;}setSearch('');const rect=trigger.current!.getBoundingClientRect(),width=Math.min(Math.max(rect.width,230),window.innerWidth-24),below=window.innerHeight-rect.bottom-12,above=rect.top-12,flip=below<200&&above>below,maxHeight=Math.min(320,Math.max(100,flip?above:below));setPosition({width,left:Math.max(12,Math.min(rect.left,window.innerWidth-width-12)),top:flip?Math.max(12,rect.top-maxHeight-4):rect.bottom+4,maxHeight});menu.current?.showPopover();}
 function change(ids:string[]){onChange({operatorId:ids[0]||'',operatorIds:ids});}
 return <><button ref={trigger} type="button" className="multi-trigger operator-trigger" aria-label={label} aria-expanded={open} aria-controls={menuId} onClick={toggle}><span>{selected.map(id=>operators.find(o=>o.id===id)?.name||history.find(o=>o.id===id)?.name||'Operatore non disponibile').join(', ')||'Non assegnato'}</span><ChevronDown size={13}/></button>{mounted&&createPortal(<div ref={menu} id={menuId} popover="auto" className="operator-dropdown" role="group" aria-label={label} style={position} onToggle={e=>setOpen(e.newState==='open')} onKeyDown={e=>e.stopPropagation()}><input className="picker-search" type="search" autoComplete="off" aria-label="Cerca operatore" placeholder="Cerca operatore…" value={search} onChange={e=>setSearch(e.target.value)}/><div className="operator-options">{operators.length?operators.filter(o=>o.name.toLocaleLowerCase('it').includes(search.toLocaleLowerCase('it'))).map(o=><label key={o.id}><input type="checkbox" checked={selected.includes(o.id)} onChange={e=>change(e.target.checked?[...selected,o.id]:selected.filter(id=>id!==o.id))}/><span>{o.name}</span></label>):<p>Nessun operatore aggiunto nelle impostazioni.</p>}</div><div className="operator-dropdown-footer"><button type="button" onClick={()=>change([])}>Nessuno</button><button type="button" onClick={()=>{menu.current?.hidePopover();trigger.current?.focus();}}>Chiudi</button></div></div>,trigger.current?.closest('dialog')||document.body)}</>;
}
