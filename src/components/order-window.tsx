'use client';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
const batch=12;
// All data stays searchable/exportable; mount additional order editors as needed.
export function useOrderWindow<T extends {key:string}>(groups:T[],targetOrderId?:string,viewKey="general"){
 const key=useMemo(()=>JSON.stringify(groups.map(g=>g.key)),[groups]);
 const [window,setWindow]=useState({key,limit:batch});
 const restored=useRef(false);
 const saved=useMemo(()=>{try{return JSON.parse(sessionStorage.getItem('raia-overview-position-'+viewKey)||'null');}catch{return null;}},[viewKey]);
 const limit=Math.max(window.key===key?window.limit:batch,!restored.current&&!targetOrderId?(saved?.limit||0):0,targetOrderId?groups.findIndex(g=>g.key===targetOrderId)+1:0);
 useEffect(()=>{if(!targetOrderId)return;const frame=requestAnimationFrame(()=>{const node=document.getElementById('overview-order-'+targetOrderId);if(node){node.scrollIntoView({block:'start',behavior:'instant'});node.focus({preventScroll:true});}});return()=>cancelAnimationFrame(frame);},[targetOrderId,key]);
 useLayoutEffect(()=>{
  if(!groups.length||restored.current)return;restored.current=true;
  if(targetOrderId)return;
  if(saved){setWindow({key,limit:Math.max(batch,saved.limit||batch)});globalThis.window.scrollTo({top:saved.y||0,behavior:'instant'});}
 },[key,groups.length,targetOrderId]);
 useEffect(()=>{
  if(!groups.length)return;let frame=0;
  const save=()=>{try{sessionStorage.setItem('raia-overview-position-'+viewKey,JSON.stringify({y:globalThis.window.scrollY,limit}));}catch{}};
  const scroll=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;save();});};
  globalThis.window.addEventListener('scroll',scroll,{passive:true});globalThis.window.addEventListener('pagehide',save);
  return()=>{if(frame)cancelAnimationFrame(frame);globalThis.window.removeEventListener('scroll',scroll);globalThis.window.removeEventListener('pagehide',save);};
 },[limit,viewKey,groups.length]);
 const sentinel=useRef<HTMLDivElement>(null);
 const more=()=>setWindow(current=>({key,limit:Math.min(groups.length,(current.key===key?current.limit:batch)+batch)}));
 useEffect(()=>{if(limit>=groups.length||!sentinel.current||typeof IntersectionObserver==='undefined')return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))setWindow(current=>({key,limit:Math.min(groups.length,(current.key===key?current.limit:batch)+batch)}));},{rootMargin:'600px'});observer.observe(sentinel.current);return()=>observer.disconnect();},[key,limit,groups.length]);
 useEffect(()=>{const print=()=>flushSync(()=>setWindow({key,limit:groups.length}));globalThis.window.addEventListener('beforeprint',print);return()=>globalThis.window.removeEventListener('beforeprint',print);},[key,groups.length]);
 return {shown:groups.slice(0,limit),footer:limit<groups.length?<div ref={sentinel} className="order-load-more"><span>Mostrati {limit} di {groups.length} commesse · gli altri compaiono scorrendo</span><button type="button" className="btn btn-plain" onClick={more}>Mostra altre commesse</button></div>:null};
}
