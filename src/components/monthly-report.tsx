'use client';
import {useMemo,useState} from 'react';
import {type Store,type Order,fmtDate,workDue} from '@/lib/data';
import {newestEntryFirst} from '@/lib/order-groups';

export function MonthlyReport({store,onOpen}:{store:Store;onOpen:(order:Order)=>void}){
 const [activeOnly,setActiveOnly]=useState(false);
 const clients=useMemo(()=>new Map([...(store.clientHistory||[]),...store.clients].map(c=>[c.id,c.name])),[store.clients,store.clientHistory]);
 const all=useMemo(()=>[...store.orders].sort(newestEntryFirst),[store.orders]);
 const active=useMemo(()=>all.filter(o=>!o.lines.length||o.lines.some(w=>!w.production?.terminated)),[all]);
 const orders=activeOnly?active:all;
 const months=useMemo(()=>{const groups=new Map<string,Order[]>();for(const order of orders){const key=/^\d{4}-(0[1-9]|1[0-2])-/.test(order.created)?order.created.slice(0,7):'';const group=groups.get(key)||[];group.push(order);groups.set(key,group);}return [...groups].sort(([a],[b])=>b.localeCompare(a));},[orders]);
 const monthLabel=(key:string)=>key?new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(new Date(key+'-01T12:00:00')):'Data non precisata';
 return <section className="monthly-report"><div className="eyebrow">ORGANIZZAZIONE</div><div className="titlebar"><div><h1>Report</h1><p>Tutti i lavori in ordine di entrata, dal più recente.</p></div></div><div className="report-filters" aria-label="Filtra lavori"><strong>Lavori</strong><button type="button" aria-pressed={!activeOnly} onClick={()=>setActiveOnly(false)}>Tutti <span>{all.length}</span></button><button type="button" aria-pressed={activeOnly} onClick={()=>setActiveOnly(true)}>Solo Attivi <span>{active.length}</span></button></div>{months.map(([month,entries])=><section className="report-month" key={month||'unknown'} aria-label={monthLabel(month)}><h2>{monthLabel(month)} <span>{entries.length}</span></h2><div className="report-columns-head" aria-hidden="true"><div className="report-row"><span>Cliente</span><span>Lavoro</span><span>Entrata</span><span>Consegna richiesta</span></div></div><div className="report-grid">{entries.map(order=>{
 const dates=[...new Set(order.lines.map(w=>workDue(w,order)).filter(Boolean))].sort();
 const texts=[...new Set(order.lines.map(w=>w.production?.requestedText).filter(Boolean))];
 const delivery=dates.length?fmtDate(dates[0])+(dates.length>1?' +'+(dates.length-1):''):texts.join(' · ')||'Non precisata';
 const title=order.title?.trim()||order.number;
 return <article className="report-row" key={order.id}><strong title={clients.get(order.clientId)||'Cliente non disponibile'}>{clients.get(order.clientId)||'Cliente non disponibile'}</strong><button type="button" title={title} aria-label={'Apri '+title+' in Panoramica'} onClick={()=>onOpen(order)}>{title}</button><time dateTime={order.created||undefined}>{order.created?fmtDate(order.created):'—'}</time><span title={[...dates.map(fmtDate),...texts].join(' · ')||'Non precisata'}>{delivery}</span></article>;
 })}</div></section>)}{!orders.length&&<p className="helper-text">Nessun lavoro {activeOnly?'attivo':''} da mostrare.</p>}</section>;
}
