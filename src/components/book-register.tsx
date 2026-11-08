'use client';
import {useOrderWindow} from './order-window';
import {useMemo} from 'react';
import {ProcessSelect, ProcessBadge} from './process-controls';
import {EntryDate} from './overview-register';
import {workDdtNumber} from '@/lib/delivery-selection';

import {QuantityEditor,DueEditor,DeliveryEditor} from './inline-work-fields';
import {OperatorPicker} from './operator-picker';
import {SupplierSelect} from './supplier-select';
import type {Supplier} from '@/lib/suppliers';
import {memo} from 'react';
import {BillingMark} from './billing-mark';
import {OrderTitleEditor,type SaveOrderTitle} from './order-title-editor';
import {type ReactNode} from 'react';
import {ChevronRight,ArrowUpRight,AlertTriangle} from 'lucide-react';
import {type Work,type WorkRow,type Operator,isInvoiced} from '@/lib/data';
import {bookProduction} from '@/lib/work-categories';
import {groupWork,overallStatus} from '@/lib/order-groups';
import {isOrderSolicited} from '@/lib/order-solicitation';

function BookRegisterView({targetOrderId,suppliers,renderActions,renderDelete,onTitleSave,all,visible,operators,selected,onSelect,onUpdate,onOpen,onToggleSolicited,canDelete,getRevision,orderNumbers,now}:{suppliers:Supplier[];targetOrderId?:string;interactionVersion:string;renderActions:(order:WorkRow['order'])=>ReactNode;renderDelete:(order:WorkRow['order'],workId:string)=>ReactNode;onTitleSave:SaveOrderTitle;orderNumbers:Map<string,number>;canDelete:boolean;getRevision:()=>number;all:WorkRow[];visible:WorkRow[];operators:Operator[];selected:string[];onSelect:(id:string,checked:boolean)=>void;onUpdate:(id:string,changes:Partial<Work>)=>void;onOpen:(row:WorkRow)=>void;onToggleSolicited:(orderId:string,solicited:boolean)=>void;now:number}){
 const groups=useMemo(()=>groupWork(all,visible),[all,visible]);
 const {shown,footer}=useOrderWindow(groups,targetOrderId);
 const change=(r:WorkRow,patch:Partial<ReturnType<typeof bookProduction>>)=>onUpdate(r.id,{production:{...bookProduction(r,r.order),...patch}});
 return <div className="overview-register books-register"><div className="register-toolbar"><span>{visible.length} libri · {groups.length} ordini</span></div>{shown.map(g=>{
  const main=g.visible[0];
  return <section id={'overview-order-'+g.key} tabIndex={-1} className={"register-group"+(g.key===targetOrderId?" report-order-target":"")} key={g.key}><button type="button" className="register-group-heading" onClick={()=>onOpen(main)}><span className="register-company"><small>CLIENTE · LIBRI</small><strong>{g.client.name}</strong></span><ProcessBadge className="register-overall" status={overallStatus(g.rows)}/><span className="register-group-action">Dettagli ordine <ChevronRight size={18}/></span></button>{g.visible.length<g.rows.length&&<p className="register-filter-note">{g.visible.length} di {g.rows.length} libri corrispondono ai filtri. Stato generale calcolato sull’intero ordine.</p>}
  <div className="register-order"><div className="register-order-title"><EntryDate date={main.order.created} orderNumber={orderNumbers.get(main.order.id)||'—'}/><OrderTitleEditor order={main.order} onSave={onTitleSave}/><span className="register-count">Tot. Lavori <strong>{main.order.lines.length}</strong></span></div><div className="register-order-actions">{renderActions(main.order)}</div><div className="register-products">{g.visible.map(r=>{
   const p=bookProduction(r,r.order);
   const solicited=isOrderSolicited(r.order,now);
   return <article className={'register-work'+(solicited?' register-work-solicited':'')} key={r.id} aria-label={'Libro: '+r.description}><div className="register-work-top"><div className="register-job"><div className="register-job-meta"><button type="button" className={'register-solicit'+(solicited?' register-solicit-active':'')} aria-label={(solicited?'Rimuovi sollecito: ':'Sollecita: ')+r.order.number} aria-pressed={solicited} onClick={()=>onToggleSolicited(r.order.id,!solicited)}><AlertTriangle size={16}/></button><span>Libro {p.bookNumber||'—'}</span></div><button type="button" className="register-job-link" onClick={()=>onOpen(r)}><strong>{r.description}</strong><ArrowUpRight size={17}/></button></div>{renderDelete(r.order,r.id)}<label className="register-select"><input type="checkbox" aria-label={'Seleziona '+r.description} disabled={isInvoiced(r)} checked={selected.includes(r.id)} onChange={e=>onSelect(r.id,e.target.checked)}/><span>Seleziona</span></label></div><dl className="register-data">
    <div className="register-field"><dt>Copie</dt><dd><QuantityEditor row={r} onUpdate={onUpdate}/></dd></div>
    <div className="register-field"><dt>Operatore</dt><dd><OperatorPicker work={r} operators={operators} label={'Operatori di '+r.description} onChange={patch=>onUpdate(r.id,patch)}/></dd></div>
    <div className="register-field"><dt>Fornitori</dt><dd><SupplierSelect suppliers={suppliers} label={'Fornitori di '+r.description} value={p.supplier} onChange={supplier=>change(r,{supplier})}/></dd></div><div className="register-field"><dt>Processo</dt><dd><ProcessSelect value={r.status} label={'Processo di '+r.description} onChange={status=>onUpdate(r.id,{status})}/></dd></div>

    <div className="register-field"><dt>Consegna richiesta</dt><dd><DueEditor row={r} onUpdate={onUpdate}/></dd></div>
    <div className="register-field"><dt>DDT</dt><dd>{workDdtNumber(r,r.order)||'—'}</dd></div>
    <div className="register-field"><dt>Terminato</dt><dd><label><input type="checkbox" aria-label={'Terminato: '+r.description} checked={p.terminated} onChange={e=>change(r,{terminated:e.target.checked})}/>{p.terminated?'Sì':'No'}</label></dd></div>
    <div className="register-field"><dt>Fatturato</dt><dd><BillingMark rows={[r]}/></dd></div><div className="register-field"><dt>Modalità consegna</dt><dd><DeliveryEditor row={r} onUpdate={onUpdate}/></dd></div>    <div className="register-field"><dt>Urgenza</dt><dd><label className={p.urgent?'book-urgent':''}><input type="checkbox" aria-label={'Urgenza: '+r.description} checked={!!p.urgent} onChange={e=>change(r,{urgent:e.target.checked})}/>{p.urgent?'Sì':'No'}</label></dd></div>    <div className="register-field"><dt>Orario uscita</dt><dd>{p.exitTime||'—'}</dd></div><div className="register-field"><dt>Orario ingresso</dt><dd>{p.entryTime||'—'}</dd></div></dl>{p.comments&&<div className="register-notes"><p><strong>Commenti</strong>{p.comments}</p></div>}</article>;

  })}</div></div></section>;
 })}{footer}</div>;
}

export const BookRegister=memo(BookRegisterView);
