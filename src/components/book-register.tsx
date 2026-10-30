'use client';
import {memo} from 'react';
import {BillingMark} from './billing-mark';
import {OrderTitleEditor,type SaveOrderTitle} from './order-title-editor';
import {Fragment,type ReactNode} from 'react';
import {ChevronRight,ArrowUpRight,AlertTriangle,Trash2,X} from 'lucide-react';
import {type Work,type WorkRow,type Operator,type Status,STATUSES,fmtDate,isInvoiced,quantityLabel,workDue} from '@/lib/data';
import {BOOK_DELIVERIES,bookProduction} from '@/lib/work-categories';
import {groupWork,overallStatus,orderTitle,statusTone} from '@/lib/order-groups';
import {isOrderSolicited} from '@/lib/order-solicitation';
import {DeleteOrder} from './delete-order';
const columns=['N.','Cliente','Data ingresso','Orario ingresso','Titolo lavoro','Copie','Operatore','Processo','Commenti','Consegna richiesta','Urgenza','Orario uscita','Consegna','Terminato','Fatturato'];
function BookRegisterView({renderActions,renderDelete,onTitleSave,all,visible,operators,selected,onSelect,onUpdate,onOpen,onToggleSolicited,canDelete,getRevision,now}:{interactionVersion:string;renderActions:(order:WorkRow['order'])=>ReactNode;renderDelete:(order:WorkRow['order'],workId:string)=>ReactNode;onTitleSave:SaveOrderTitle;canDelete:boolean;getRevision:()=>number;all:WorkRow[];visible:WorkRow[];operators:Operator[];selected:string[];onSelect:(id:string,checked:boolean)=>void;onUpdate:(id:string,changes:Partial<Work>)=>void;onOpen:(row:WorkRow)=>void;onToggleSolicited:(orderId:string,solicited:boolean)=>void;now:number}){
 const groups=groupWork(all,visible);
 const change=(r:WorkRow,patch:Partial<ReturnType<typeof bookProduction>>)=>onUpdate(r.id,{production:{...bookProduction(r,r.order),...patch}});
 return <div className="overview-register books-register"><div className="register-toolbar"><span>{visible.length} libri · {groups.length} ordini</span></div>{groups.map(g=>{
  const main=g.visible[0];
  return <section className="register-group" key={g.key}><button type="button" className="register-group-heading" onClick={()=>onOpen(main)}><span className="register-company"><small>CLIENTE · LIBRI</small><strong>{g.client.name}</strong></span><span className="register-overall" data-tone={statusTone(overallStatus(g.rows))}>{overallStatus(g.rows)}</span><span className="register-group-action">Dettagli ordine <ChevronRight size={18}/></span></button>{g.visible.length<g.rows.length&&<p className="register-filter-note">{g.visible.length} di {g.rows.length} libri corrispondono ai filtri. Stato generale calcolato sull’intero ordine.</p>}
  <div className="book-register-scroll" tabIndex={0} role="region" aria-label={'Registro libri di '+g.client.name}><table className="book-register-table"><caption className="sr-only">Registro libri di {g.client.name}</caption><thead><tr><th aria-label="Selezione"/>{columns.map(c=><th key={c}>{c}</th>)}<th aria-label="Dettagli"/></tr></thead><tbody>{g.visible.map((r,i)=>{
   const p=bookProduction(r,r.order),historic=!!r.operatorId&&!operators.some(o=>o.id===r.operatorId),sameDate=i>0&&r.order.created===main.order.created,due=workDue(r,r.order);
   const solicited=isOrderSolicited(r.order,now);
   return <Fragment key={r.id}>{(i===0||g.visible[i-1].order.id!==r.order.id)&&<tr className="book-order-title"><td colSpan={17}><div className="register-order-title"><OrderTitleEditor order={r.order} onSave={onTitleSave}/><span className="register-count">Tot. Lavori <strong>{r.order.lines.length}</strong></span>{renderActions(r.order)}</div></td></tr>}<tr className={(i?'book-cascade-row ':'')+(solicited?'book-solicited-row':'')}>
    <td data-label="Seleziona"><input type="checkbox" aria-label={'Seleziona '+r.description} disabled={isInvoiced(r)} checked={selected.includes(r.id)} onChange={e=>onSelect(r.id,e.target.checked)}/></td>
    <td data-label="N.">{p.bookNumber||'—'}</td><td data-label="Cliente" className={i?'book-shared-value':''}>{!i&&r.client.name}</td>
    <td data-label="Data ingresso" className={sameDate?'book-shared-value':'book-entry-date'}>{!sameDate&&(r.order.created?<time dateTime={r.order.created}>{fmtDate(r.order.created)}</time>:'Non precisata')}</td>
    <td data-label="Orario ingresso">{p.entryTime||'—'}</td>
    <td data-label="Titolo lavoro" className="book-title-cell"><button type="button" className={'register-solicit'+(solicited?' register-solicit-active':'')} aria-label={solicited?'Rimuovi il sollecito dall’ordine '+r.order.number:'Sollecita ordine '+r.order.number} aria-pressed={solicited} title={solicited?'Ordine sollecitato':'Sollecita ordine'} onClick={()=>onToggleSolicited(r.order.id,!solicited)}><AlertTriangle size={16}/></button><button type="button" className="register-job-link" onClick={()=>onOpen(r)}><strong>{r.description}</strong></button>{renderDelete(r.order,r.id)}</td>
    <td data-label="Copie">{quantityLabel(r)}</td>
    <td data-label="Operatore"><select aria-label={'Operatore di '+r.description} value={r.operatorId} onChange={e=>onUpdate(r.id,{operatorId:e.target.value})}><option value="">Non assegnato</option>{historic&&<option disabled value={r.operatorId}>{r.operator.name} · storico</option>}{operators.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></td>
    <td data-label="Processo"><select className="register-process" data-tone={statusTone(r.status)} aria-label={'Processo di '+r.description} value={r.status} onChange={e=>onUpdate(r.id,{status:e.target.value as Status})}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></td>
    <td data-label="Commenti" className="book-comments">{p.comments||'—'}</td>
    <td data-label="Consegna richiesta">{due?fmtDate(due):p.requestedText||'Non precisata'}</td>
    <td data-label="Urgenza"><label className={p.urgent?'book-urgent':''}><input type="checkbox" aria-label={'Urgenza: '+r.description} checked={!!p.urgent} onChange={e=>change(r,{urgent:e.target.checked})}/>{p.urgent?'Sì':'No'}</label></td>
    <td data-label="Orario uscita">{p.exitTime||'—'}</td>
    <td data-label="Consegna"><select aria-label={'Consegna di '+r.description} value={p.delivery} onChange={e=>change(r,{delivery:e.target.value})}><option value="">Non precisata</option>{p.delivery&&!BOOK_DELIVERIES.some(v=>v===p.delivery)&&<option value={p.delivery}>{p.delivery}</option>}{BOOK_DELIVERIES.map(v=><option key={v}>{v}</option>)}</select></td>
    <td data-label="Terminato"><label><input type="checkbox" aria-label={'Terminato: '+r.description} checked={p.terminated} onChange={e=>change(r,{terminated:e.target.checked})}/>{p.terminated?'Sì':'No'}</label></td>
    <td data-label="Fatturato"><BillingMark rows={[r]}/></td><td data-label="Dettagli"><button type="button" className="icon-btn" aria-label={'Apri '+r.description} onClick={()=>onOpen(r)}><ArrowUpRight size={17}/></button></td>
   </tr></Fragment>;
  })}</tbody></table></div></section>;
 })}</div>;
}

export const BookRegister=memo(BookRegisterView);
