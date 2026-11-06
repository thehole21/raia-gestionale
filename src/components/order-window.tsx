'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
const batch=12;
// All data stays searchable/exportable; mount additional order editors as needed.
export function useOrderWindow<T extends {key:string}>(groups:T[]){
 const key=useMemo(()=>JSON.stringify(groups.map(g=>g.key)),[groups]);
 const [window,setWindow]=useState({key,limit:batch});
 const limit=window.key===key?window.limit:batch;
 const sentinel=useRef<HTMLDivElement>(null);
 const more=()=>setWindow(current=>({key,limit:Math.min(groups.length,(current.key===key?current.limit:batch)+batch)}));
 useEffect(()=>{if(limit>=groups.length||!sentinel.current||typeof IntersectionObserver==='undefined')return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))setWindow(current=>({key,limit:Math.min(groups.length,(current.key===key?current.limit:batch)+batch)}));},{rootMargin:'600px'});observer.observe(sentinel.current);return()=>observer.disconnect();},[key,limit,groups.length]);
 useEffect(()=>{const print=()=>flushSync(()=>setWindow({key,limit:groups.length}));globalThis.window.addEventListener('beforeprint',print);return()=>globalThis.window.removeEventListener('beforeprint',print);},[key,groups.length]);
 return {shown:groups.slice(0,limit),footer:limit<groups.length?<div ref={sentinel} className="order-load-more"><span>Mostrati {limit} di {groups.length} ordini · gli altri compaiono scorrendo</span><button type="button" className="btn btn-plain" onClick={more}>Mostra altri ordini</button></div>:null};
}
