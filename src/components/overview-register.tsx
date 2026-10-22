'use client';
import {useId,useState,type ReactNode} from 'react';
import {ChevronDown,ChevronRight,ArrowUpRight,AlertTriangle} from 'lucide-react';
import {type Operator,type Work,type WorkRow,type Status,STATUSES,fmtDate,quantityLabel,workDue,isInvoiced} from '@/lib/data';
import {groupWork,overallStatus} from '@/lib/order-groups';
import {isOrderSolicited} from '@/lib/order-solicitation';

function EntryDate({date,time,orderNumber}:{date:string;time?:string;orderNumber:number|string}){
 const parsed=/^\d{4}-\d{2}-\d{2}$/.test(date)?new Date(date+'T12:00:00'):null;
 const valid=parsed&&Number.isFinite(parsed.getTime());
 return <div className="register-entry"><div className="register-entry-heading"><span>ENTRATA ORDINE</span><strong>N. {orderNumber}</strong></div>{valid?<time dateTime={date}><strong>{date.slice(8,10)}</strong><span>{new Intl.DateTimeFormat('it-IT',{month:'long',year:'numeric'}).format(parsed!)}</span></time>:<strong className="register-date-unknown">Non precisata</strong>}{time&&<small>Ore {time}</small>}</div>;
}
function DataCell({label,children}:{label:string;children:ReactNode}){return <div className="register-field"><dt>{label}</dt><dd>{children}</dd></div>;}
export function OverviewRegister({all,visible,operators,selected,onSelect,onUpdate,onOpen,onToggleSolicited,orderNumbers,now}:{all:WorkRow[];visible:WorkRow[];operators:Operator[];selected:string[];onSelect:(id:string,checked:boolean)=>void;onUpdate:(id:string,changes:Partial<Work>)=>void;onOpen:(row:WorkRow)=>void;onToggleSolicited:(orderId:string,solicited:boolean)=>void;orderNumbers:Map<string,number>;now:number}){
 const [expanded,setExpanded]=useState<string[]>([]),prefix=useId(),groups=groupWork(all,visible);
 const multiple=groups.filter(g=>g.visible.length>1),allOpen=multiple.length>0&&multiple.every(g=>expanded.includes(g.key));
 function toggle(key:string){setExpanded(old=>old.includes(key)?old.filter(k=>k!==key):[...old,key]);}
 function record(r:WorkRow,parent?:WorkRow){
  const p=r.production,books=p?.category==='Libri',due=workDue(r,r.order),historical=!!r.operatorId&&!operators.some(o=>o.id===r.operatorId);
  const solicited=isOrderSolicited(r.order,now);
  return <article className={'register-work'+(solicited?' register-work-solicited':'')} key={r.id} aria-label={'Lavoro: '+r.description}>
   <div className="register-work-top">{(!parent||parent.order.id!==r.order.id)&&<EntryDate date={r.order.created} time={p?.entryTime} orderNumber={orderNumbers.get(r.order.id)||'—'}/>}<div className="register-job"><div className="register-job-meta"><button type="button" className={'register-solicit'+(solicited?' register-solicit-active':'')} aria-label={solicited?'Rimuovi il sollecito dall’ordine '+r.order.number:'Sollecita ordine '+r.order.number} aria-pressed={solicited} title={solicited?'Ordine sollecitato':'Sollecita ordine'} onClick={()=>onToggleSolicited(r.order.id,!solicited)}><AlertTriangle size={16}/></button>{parent&&parent.order.id===r.order.id&&p?.entryTime&&<span>Ingresso ore {p.entryTime}</span>}{books&&<span>Libro {p?.bookNumber||''}</span>}{p?.urgent&&<strong className="register-urgent">Urgente</strong>}</div><button type="button" className="register-job-link" onClick={()=>onOpen(r)}><strong>{r.description}</strong><ArrowUpRight size={17}/></button>{p?.section&&<p>{p.section}</p>}</div><label className="register-select"><input type="checkbox" aria-label={'Seleziona '+r.description} disabled={isInvoiced(r)} checked={selected.includes(r.id)} onChange={e=>onSelect(r.id,e.target.checked)}/><span>Seleziona</span></label></div>
   <dl className="register-data">
    <DataCell label="Copie / quantità">{quantityLabel(r)}</DataCell>
    <DataCell label="Operatore"><select aria-label={'Operatore di '+r.description} value={r.operatorId} onChange={e=>onUpdate(r.id,{operatorId:e.target.value})}><option value="">Non assegnato</option>{historical&&<option disabled value={r.operatorId}>{r.operator.name} · storico</option>}{operators.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></DataCell>
    <DataCell label="Fornitore">{p?.supplier||'—'}</DataCell>
    <DataCell label="Processo"><select className="register-process" aria-label={'Processo di '+r.description} value={r.status} onChange={e=>onUpdate(r.id,{status:e.target.value as Status})}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></DataCell>
    <DataCell label="Consegna richiesta">{due?<time dateTime={due}>{fmtDate(due)}</time>:p?.requestedText||'Non precisata'}</DataCell>
    <DataCell label="DDT">{p?.ddtNumber||r.order.ddt?.number||'—'}</DataCell>
    <DataCell label="Consegna">{p?.delivery||'—'}</DataCell>
    <DataCell label="Terminato">{p?<label className="register-terminated"><input type="checkbox" aria-label={'Terminato: '+r.description} checked={p.terminated} onChange={e=>onUpdate(r.id,{production:{...p,terminated:e.target.checked}})}/>{p.terminated?'Sì':'No'}</label>:['Pronto','Consegnato'].includes(r.status)?'Sì':'No'}</DataCell>
    <DataCell label="Fatturato">{p?.invoicing||(r.invoiceId?'In bozza':'—')}</DataCell>
    {p?.exitTime&&<DataCell label="Orario uscita">{p.exitTime}</DataCell>}
    {r.order.executionDate&&(!parent||parent.order.executionDate!==r.order.executionDate)&&<DataCell label="Esecuzione">{fmtDate(r.order.executionDate)}</DataCell>}
   </dl>
   {(p?.comments||p?.additionalNotes||r.notes||r.order.notes)&&<div className="register-notes">{p?.comments&&<p><strong>Commenti</strong>{p.comments}</p>}{p?.additionalNotes&&<p><strong>Annotazioni</strong>{p.additionalNotes}</p>}{r.notes&&<p><strong>Note lavoro</strong>{r.notes}</p>}{r.order.notes&&r.order.notes!==r.notes&&<p><strong>Note ordine</strong>{r.order.notes}</p>}</div>}
  </article>;
 }
 return <div className="overview-register"><div className="register-toolbar"><span>{groups.length} gruppi · {visible.length} lavori</span>{multiple.length>0&&<button type="button" className="btn btn-plain" onClick={()=>setExpanded(allOpen?[]:multiple.map(g=>g.key))}>{allOpen?'Comprimi gli altri lavori':'Mostra tutti i lavori'}</button>}</div>{groups.map((g,index)=>{
  const open=expanded.includes(g.key),remaining=g.visible.slice(1),status=overallStatus(g.rows),panel=prefix+'-group-'+index;
  return <section className="register-group" key={g.key}>
   <button type="button" className="register-group-heading" aria-expanded={remaining.length?open:undefined} aria-controls={remaining.length?panel:undefined} onClick={()=>remaining.length?toggle(g.key):onOpen(g.visible[0])}>
    <span className="register-company"><small>CLIENTE</small><strong>{g.client.name}</strong></span><span className={'register-overall '+(['Pronto','Consegnato'].includes(status)?'register-done':'')}>{status}</span><span className="register-group-action">{remaining.length?(open?'Chiudi gli altri lavori':`+ ${remaining.length} ${remaining.length===1?'altro lavoro':'altri lavori'} della stessa giornata`):'Dettagli'}{open&&remaining.length?<ChevronDown size={18}/>:<ChevronRight size={18}/>}</span>
   </button>
   {g.visible.length<g.rows.length&&<p className="register-filter-note">{g.visible.length} di {g.rows.length} lavori corrispondono ai filtri. Lo stato generale considera l’intero gruppo.</p>}
   {record(g.visible[0])}
   {remaining.length>0&&<div id={panel} hidden={!open} className="register-cascade">{open&&remaining.map(r=>record(r,g.visible[0]))}</div>}
  </section>;
 })}</div>;
}
