'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {FileText,RefreshCw,Trash2,ExternalLink} from 'lucide-react';
import {cloud} from '@/lib/supabase';
import {fmtDate,type Store} from '@/lib/data';
import dynamic from 'next/dynamic';
import {useAccess} from './access';
const FicDocumentsPanel=dynamic(()=>import('./fic-documents-panel').then(m=>m.FicDocumentsPanel));
export async function ddtRequest(body?:unknown,page=1,search='',signal?:AbortSignal){
 const {data:{session}}=await cloud().auth.getSession();if(!session)throw Error('Accedi nuovamente.');
 const r=await fetch('/api/fatture-in-cloud/ddt/manage'+(body?'':'?page='+page+'&search='+encodeURIComponent(search)),{method:body?'POST':'GET',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Operazione non riuscita.');
 if(data.removed){window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('raia-ddt-changed'));}return data;
}
const syncRequests=new Map<number,Promise<any>>();
function sync(after:number){if(!syncRequests.has(after))syncRequests.set(after,ddtRequest({action:'sync',after}).finally(()=>syncRequests.delete(after)));return syncRequests.get(after)!;}
export function DdtSync({disabled}:{disabled:boolean}){
 useEffect(()=>{
  if(disabled)return;let stopped=false,after=0,timer:ReturnType<typeof setTimeout>;
  async function tick(){let delay=120000;try{if(!document.hidden&&navigator.onLine){const run=async()=>{const r=await sync(after);after=r.next;};if(navigator.locks)await navigator.locks.request('raia-ddt-sync',{ifAvailable:true},async lock=>{if(lock)await run();});else await run();if(after)delay=15000;}}catch{/* Keep local documents and retry later; never interrupt navigation. */}finally{if(!stopped)timer=setTimeout(tick,delay);}}
  timer=setTimeout(tick,2500);return()=>{stopped=true;clearTimeout(timer);};
 },[disabled]);return null;
}
type Ddt={id:number;number:string;client:string;subject:string;date:string;state:'billed'|'unbilled'|'unknown';invoiceNumber:string;clientId:number};
export function DdtPanel({demo,store}:{demo:boolean;store:Store}){
 const {profile}=useAccess(),admin=profile.role==='admin';
 const [selected,setSelected]=useState<Ddt[]>([]),[joinRequest,setJoinRequest]=useState<{ids:number[];group:boolean;key:number}>();
 const joinKey=useRef(0);
 function toggle(d:Ddt){setSelected(old=>old.some(x=>x.id===d.id)?old.filter(x=>x.id!==d.id):[...old,d]);}
 function join(group:boolean){setJoinRequest({ids:selected.map(d=>d.id),group,key:++joinKey.current});}
 const [documents,setDocuments]=useState<Ddt[]>([]),[next,setNext]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[search,setSearch]=useState(''),[query,setQuery]=useState(''),[pdf,setPdf]=useState(''),[filter,setFilter]=useState('all'),[loading,setLoading]=useState(false),[total,setTotal]=useState(0);
 const abort=useRef<AbortController|null>(null),sequence=useRef(0);
 useEffect(()=>{const timer=setTimeout(()=>setQuery(search.trim()),300);return()=>clearTimeout(timer);},[search]);
 const load=useCallback(async(page=1)=>{if(demo)return;abort.current?.abort();const controller=new AbortController();abort.current=controller;const seq=++sequence.current;setLoading(true);setError('');try{const d=await ddtRequest(undefined,page,query,controller.signal);if(seq!==sequence.current)return;setDocuments(old=>page>1?[...new Map([...old,...d.documents].map(v=>[v.id,v])).values()]:d.documents);setNext(d.next);setTotal(d.total||0);}catch(e){if(!controller.signal.aborted&&seq===sequence.current)setError((e as Error).message);}finally{if(seq===sequence.current)setLoading(false);}},[demo,query]);
 useEffect(()=>{setDocuments([]);setNext(0);void load();const changed=()=>{void load();};const refresh=()=>{if(!document.hidden)void load();};window.addEventListener('raia-ddt-changed',changed);window.addEventListener('focus',refresh);return()=>{abort.current?.abort();++sequence.current;window.removeEventListener('raia-ddt-changed',changed);window.removeEventListener('focus',refresh);};},[load]);
 async function act(d:Ddt,action:'open'|'delete'){
  if(action==='delete'&&!window.confirm(`Eliminare il DDT n. ${d.number} di ${d.client}? Verrà cancellato anche da Fatture in Cloud. Le lavorazioni torneranno disponibili per un nuovo DDT. Le fatture restano invariate.`))return;
  setBusy(true);setError('');setMessage('');setPdf('');try{const r=await ddtRequest({action,id:d.id,confirm:action==='delete'});if(r.removed){setMessage('DDT eliminato e ordine aggiornato.');await load();}else if(r.url)setPdf(r.url);}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function reconcile(){setBusy(true);setError('');setMessage('');let cursor=0,count=0;try{do{const r=await sync(cursor);count+=r.removed;cursor=r.next;}while(cursor);await load();setMessage(count?`${count} DDT cancellati in Fatture in Cloud rimossi dal gestionale.`:'DDT aggiornati: nessuna cancellazione da sincronizzare.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const sameClient=selected[0]?.clientId;
 const eligible=(d:Ddt)=>d.state==='unbilled'&&!!d.clientId&&(!sameClient||d.clientId===sameClient);
 const visible=documents.filter(d=>filter==='all'||d.state===filter);
 useEffect(()=>{if(filter==='all'||!next||loading||busy||error||visible.length>=25)return;const timer=setTimeout(()=>{void load(next);},400);return()=>clearTimeout(timer);},[filter,next,loading,busy,error,visible.length,load]);
 return <><div className="eyebrow">DOCUMENTI DI TRASPORTO</div><div className="titlebar"><div><h1>DDT</h1><p>Tutti i DDT di Fatture in Cloud, dal più recente.</p></div><button className="btn btn-primary" disabled={busy||demo} onClick={reconcile}><RefreshCw size={17}/>{busy?'Aggiornamento…':'Sincronizza DDT'}</button></div>
 <div className="workspace-card ddt-manager"><p>Lo stato viene verificato sui collegamenti di Fatture in Cloud. Una fattura creata separatamente, senza collegare il DDT, non lo rende fatturato in questo elenco.</p><div className="ddt-filter-bar">{[['all','Tutti'],['unbilled','Da fatturare'],['billed','Fatturati'],['unknown','Da verificare']].map(([value,label])=><button key={value} className={'btn btn-small '+(filter===value?'btn-primary':'btn-plain')} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div><input type="search" className="picker-search" autoComplete="off" aria-label="Cerca DDT in Fatture in Cloud" placeholder="Cerca numero DDT, cliente o ordine…" value={search} onChange={e=>setSearch(e.target.value)}/>
 {demo&&<p>La gestione dei DDT richiede l’accesso a Fatture in Cloud.</p>}{error&&<p role="alert" className="error-text">{error}</p>}{message&&<p role="status">{message}</p>}{pdf&&<a className="btn btn-primary" href={pdf} target="_blank" rel="noreferrer"><ExternalLink size={16}/>Apri / stampa PDF</a>}
 {admin&&<div className="ddt-join-toolbar"><label><input type="checkbox" aria-label="Seleziona tutti i DDT visibili dello stesso cliente" checked={visible.some(eligible)&&visible.filter(eligible).every(d=>selected.some(s=>s.id===d.id))} onChange={e=>{if(!e.target.checked){setSelected(old=>old.filter(d=>!visible.some(v=>v.id===d.id)));return;}const client=sameClient||visible.find(d=>d.state==='unbilled')?.clientId;setSelected(old=>[...new Map([...old,...visible.filter(d=>d.state==='unbilled'&&d.clientId===client)].map(d=>[d.id,d])).values()].slice(0,50));}}/> Seleziona tutti i DDT visibili dello stesso cliente</label><strong>{selected.length} selezionati{selected.length?' · '+selected[0].client:''}</strong><button className="btn btn-primary" disabled={demo||busy||!selected.length} onClick={()=>join(false)}>Unisci</button><button className="btn btn-primary" disabled={demo||busy||!selected.length} onClick={()=>join(true)}>Unisci e raggruppa</button>{!!selected.length&&<button className="btn btn-plain" onClick={()=>setSelected([])}>Annulla selezione</button>}<small>Unisci mantiene le righe separate. Unisci e raggruppa accorpa gli articoli tramite Fatture in Cloud.</small></div>}
 <div className="ddt-manager-list">{visible.map(d=><article key={d.id}>{admin&&<input type="checkbox" aria-label={'Seleziona DDT '+d.number} checked={selected.some(s=>s.id===d.id)} disabled={busy||demo||(!selected.some(s=>s.id===d.id)&&(!eligible(d)||selected.length>=50))} onChange={()=>toggle(d)}/>}<FileText size={23}/><div><strong>DDT {d.number}</strong><span>{d.client}</span><small>{fmtDate(d.date)} · {d.subject}</small></div><span className={'ddt-state ddt-state-'+d.state}>{d.state==='billed'?'Fatturato · n. '+d.invoiceNumber:d.state==='unbilled'?'Da fatturare':'Da verificare'}</span><div className="ddt-manager-actions"><button className="btn btn-small" disabled={busy||demo} onClick={()=>act(d,'open')}>Apri PDF</button><button className="btn btn-small ddt-delete" disabled={busy||demo} onClick={()=>act(d,'delete')}><Trash2 size={15}/>Elimina</button></div></article>)}</div>{loading&&<p role="status">Caricamento e verifica con Fatture in Cloud…</p>}{!visible.length&&!loading&&<p>{next?'Ricerca nelle pagine successive…':'Nessun DDT corrispondente.'}</p>}<p className="helper-text">{documents.length} di {total} DDT caricati · {visible.length} visibili</p>{!!next&&<button className="btn btn-plain" disabled={busy||loading} onClick={()=>load(next)}>Carica altri DDT</button>}</div>{admin&&<FicDocumentsPanel store={store} demo={demo} editorOnly joinRequest={joinRequest} onCreated={()=>{setSelected([]);void load();}}/>}</>;
}
