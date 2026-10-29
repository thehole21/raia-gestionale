'use client';
import {SupplierSelect} from './supplier-select';
import type {Supplier} from '@/lib/suppliers';
import {bookProduction} from '@/lib/work-categories';
import {BillingMark} from './billing-mark';
import {OrderTitleEditor,type SaveOrderTitle} from './order-title-editor';
import {type ReactNode} from 'react';
import {ChevronRight,ArrowUpRight,AlertTriangle} from 'lucide-react';
import {type Operator,type Work,type WorkRow,type Status,STATUSES,fmtDate,quantityLabel,workDue,isInvoiced} from '@/lib/data';
import {groupWork,overallStatus,orderTitle,statusTone} from '@/lib/order-groups';
import {isOrderSolicited} from '@/lib/order-solicitation';

function EntryDate({date,time,orderNumber}:{date:string;time?:string;orderNumber:number|string}){
 const parsed=/^\d{4}-\d{2}-\d{2}$/.test(date)?new Date(date+'T12:00:00'):null;
 const valid=parsed&&Number.isFinite(parsed.getTime());
 return <div className="register-entry"><div className="register-entry-heading"><span>ENTRATA ORDINE</span><strong>N. {orderNumber}</strong></div>{valid?<time dateTime={date}><strong>{date.slice(8,10)}</strong><span>{new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(parsed!)}</span></time>:<strong className="register-date-unknown">Non precisata</strong>}{time&&<small>Ore {time}</small>}</div>;
}
function DataCell({label,children}:{label:string;children:ReactNode}){return <div className="register-field"><dt>{label}</dt><dd>{children}</dd></div>;}
export function OverviewRegister({suppliers,renderActions,renderDelete,onTitleSave,all,visible,operators,selected,onSelect,onUpdate,onOpen,onToggleSolicited,orderNumbers,now}:{suppliers:Supplier[];renderActions:(order:WorkRow['order'])=>ReactNode;renderDelete:(order:WorkRow['order'],workId:string)=>ReactNode;onTitleSave:SaveOrderTitle;all:WorkRow[];visible:WorkRow[];operators:Operator[];selected:string[];onSelect:(id:string,checked:boolean)=>void;onUpdate:(id:string,changes:Partial<Work>)=>void;onOpen:(row:WorkRow)=>void;onToggleSolicited:(orderId:string,solicited:boolean)=>void;orderNumbers:Map<string,number>;now:number}){
 const groups=groupWork(all,visible);
 function record(r:WorkRow,parent?:WorkRow){
  const p=r.production,books=p?.category==='Libri',due=workDue(r,r.order),historical=!!r.operatorId&&!operators.some(o=>o.id===r.operatorId);
  const solicited=isOrderSolicited(r.order,now);
  return <article className={'register-work'+(solicited?' register-work-solicited':'')} key={r.id} aria-label={'Lavoro: '+r.description}>
   <div className="register-work-top"><div className="register-job"><div className="register-job-meta"><button type="button" className={'register-solicit'+(solicited?' register-solicit-active':'')} aria-label={solicited?'Rimuovi il sollecito dall’ordine '+r.order.number:'Sollecita ordine '+r.order.number} aria-pressed={solicited} title={solicited?'Ordine sollecitato':'Sollecita ordine'} onClick={()=>onToggleSolicited(r.order.id,!solicited)}><AlertTriangle size={16}/></button>{parent&&parent.order.id===r.order.id&&p?.entryTime&&<span>Ingresso ore {p.entryTime}</span>}{books&&<span>Libro {p?.bookNumber||''}</span>}{p?.urgent&&<strong className="register-urgent">Urgente</strong>}</div><button type="button" className="register-job-link" onClick={()=>onOpen(r)}><strong>{r.description}</strong><ArrowUpRight size={17}/></button>{p?.section&&<p>{p.section}</p>}</div>{renderDelete(r.order,r.id)}<label className="register-select"><input type="checkbox" aria-label={'Seleziona '+r.description} disabled={isInvoiced(r)} checked={selected.includes(r.id)} onChange={e=>onSelect(r.id,e.target.checked)}/><span>Seleziona</span></label></div>
   <dl className="register-data">
    <DataCell label="Copie / quantità">{quantityLabel(r)}</DataCell>
    <DataCell label="Operatore"><select aria-label={'Operatore di '+r.description} value={r.operatorId} onChange={e=>onUpdate(r.id,{operatorId:e.target.value})}><option value="">Non assegnato</option>{historical&&<option disabled value={r.operatorId}>{r.operator.name} · storico</option>}{operators.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></DataCell>
    <DataCell label="Fornitore"><SupplierSelect suppliers={suppliers} label={'Fornitore di '+r.description} value={p?.supplier||''} onChange={supplier=>onUpdate(r.id,{production:{...bookProduction(r,r.order),category:p?.category||'Lavori',supplier}})}/></DataCell>
    <DataCell label="Processo"><select className="register-process" data-tone={statusTone(r.status)} aria-label={'Processo di '+r.description} value={r.status} onChange={e=>onUpdate(r.id,{status:e.target.value as Status})}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></DataCell>
    <DataCell label="Consegna richiesta">{due?<time dateTime={due}>{fmtDate(due)}</time>:p?.requestedText||'Non precisata'}</DataCell>
    <DataCell label="Consegna">{p?.delivery||'—'}</DataCell>
    <DataCell label="Terminato">{p?<label className="register-terminated"><input type="checkbox" aria-label={'Terminato: '+r.description} checked={p.terminated} onChange={e=>onUpdate(r.id,{production:{...p,terminated:e.target.checked}})}/>{p.terminated?'Sì':'No'}</label>:['Pronto','Consegnato'].includes(r.status)?'Sì':'No'}</DataCell>
    <DataCell label="Fatturato"><BillingMark rows={[r]}/></DataCell>
    {p?.exitTime&&<DataCell label="Orario uscita">{p.exitTime}</DataCell>}
    {r.order.executionDate&&(!parent||parent.order.executionDate!==r.order.executionDate)&&<DataCell label="Esecuzione">{fmtDate(r.order.executionDate)}</DataCell>}
   </dl>
   {(p?.comments||p?.additionalNotes||r.notes||r.order.notes)&&<div className="register-notes">{p?.comments&&<p><strong>Commenti</strong>{p.comments}</p>}{p?.additionalNotes&&<p><strong>Annotazioni</strong>{p.additionalNotes}</p>}{r.notes&&<p><strong>Note lavoro</strong>{r.notes}</p>}{r.order.notes&&r.order.notes!==r.notes&&<p><strong>Note ordine</strong>{r.order.notes}</p>}</div>}
  </article>;
 }
 return <div className="overview-register"><div className="register-toolbar"><span>{groups.length} ordini · {visible.length} lavorazioni</span></div>{groups.map(g=>{
 const status=overallStatus(g.rows),orders=[...new Map(g.visible.map(r=>[r.order.id,r.order])).values()];
 return <section className="register-group" key={g.key}>
 <button type="button" className="register-group-heading" onClick={()=>onOpen(g.visible[0])}><span className="register-company"><small>CLIENTE</small><strong>{g.client.name}</strong></span><span data-tone={statusTone(status)} className={'register-overall '+(['Pronto','Consegnato'].includes(status)?'register-done':'')}>{status}</span><span className="register-group-action">Dettagli ordine <ChevronRight size={18}/></span></button>
 {g.visible.length<g.rows.length&&<p className="register-filter-note">{g.visible.length} di {g.rows.length} lavorazioni corrispondono ai filtri. Lo stato generale considera l’intero ordine.</p>}
 {orders.map((order,index)=><div className="register-order" key={order.id}><div className="register-order-title">{(index===0||order.created!==orders[0].created)&&<EntryDate date={order.created} orderNumber={orderNumbers.get(order.id)||'—'}/>}<OrderTitleEditor order={order} onSave={onTitleSave}/><span className="register-count">Tot. Lavori <strong>{order.lines.length}</strong></span>{renderActions(order)}</div><div className="register-products">{g.visible.filter(r=>r.order.id===order.id).map(r=>record(r,g.visible[0]))}</div></div>)}
 </section>;
 })}</div>;
}
