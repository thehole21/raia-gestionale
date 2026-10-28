'use client';
import {OrderTitleEditor,type SaveOrderTitle} from './order-title-editor';
import {type ReactNode} from 'react';
import {Check} from 'lucide-react';
import {type WorkRow,fmtDate,money,sumWork,initials} from '@/lib/data';
import {groupWork,overallStatus,orderTitle,statusTone} from '@/lib/order-groups';
export function WorkGroups({renderActions,onTitleSave,all,visible,renderRows}:{renderActions:(order:WorkRow['order'])=>ReactNode;onTitleSave:SaveOrderTitle;all:WorkRow[];visible:WorkRow[];renderRows:(rows:WorkRow[])=>ReactNode}){
 const groups=groupWork(all,visible);
 return <div className="day-groups"><div className="day-toolbar"><span>{groups.length} ordini indipendenti</span></div>{groups.length===0&&<p className="helper-text">Nessun lavoro presente per il periodo o i filtri selezionati.</p>}{groups.map((g,i)=>{
 const status=overallStatus(g.rows),done=g.rows.filter(l=>l.production?.terminated || ['Pronto','Consegnato'].includes(l.status)).length;
 const orders=[...new Map(g.rows.map(r=>[r.order.id,r.order])).values()];
 return <section className="day-group day-open" key={g.key}><div className="day-heading"><span className="company-avatar">{initials(g.client.name)}</span><span className="day-title"><strong>{g.client.name}</strong><small>{g.isExecution?'Esecuzione':'Data ordine'} · {g.date?fmtDate(g.date):'Non precisata'}{!g.isExecution?' · esecuzione non indicata':''}</small><span className="day-preview">{g.rows.map(r=>r.description).join(' · ')}</span></span><span className="day-progress"><span>{done===g.rows.length?<Check size={13}/>:null}{done}/{g.rows.length} pronti o consegnati</span><progress aria-label="Avanzamento lavori" value={done} max={g.rows.length}/></span><span data-tone={statusTone(status)} className={'overall-status '+(['Pronto','Consegnato'].includes(status)?'overall-done':'')}>{status}</span><span className="day-value">{g.rows.some(r=>r.production?.priceUnspecified || (r.production&&!r.qty))?'Da definire':money(g.rows.reduce((sum,r)=>sum+sumWork(r),0))}<small>{g.rows.length} lavori</small></span></div>{<div id={'day-panel-'+i} className="day-panel"><div className="day-context"><span>{orders.map(o=>o.number).join(' / ')}</span><span>{g.visible.length<g.rows.length?g.visible.length+' di '+g.rows.length+' lavori corrispondono ai filtri. Stato calcolato su tutti.':'Ogni lavorazione mantiene il proprio stato e operatore.'}</span></div>{orders.filter(o=>g.visible.some(r=>r.order.id===o.id)).map(o=><div key={o.id}><div className="register-order-title"><OrderTitleEditor order={o} onSave={onTitleSave}/><span className="register-count">Tot. Lavori <strong>{o.lines.length}</strong></span>{renderActions(o)}</div>{renderRows(g.visible.filter(r=>r.order.id===o.id))}</div>)}</div>}</section>;
 })}</div>;
}
