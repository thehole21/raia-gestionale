import {Check,Minus} from 'lucide-react';
import {bookProduction} from '@/lib/work-categories';
import type {Work,WorkRow} from '@/lib/data';
export function BillingMark({rows,onUpdate}:{rows:WorkRow[];onUpdate?:(id:string,patch:Partial<Work>)=>void}){
 const billed=rows.filter(r=>r.billingState==='billed').length,done=rows.length>0&&billed===rows.length;
 const label=done?'Fatturato':billed?'Fatturato parzialmente':rows.some(r=>r.billingState==='draft')?'In bozza':'Non fatturato';
 const row=rows[0];
 if(onUpdate&&rows.length===1&&!(done&&row.invoiceId))return <label className="register-terminated"><input type="checkbox" aria-label={'Fatturato: '+row.description} checked={done} onChange={e=>onUpdate(row.id,{production:{...bookProduction(row,row.order),category:row.production?.category||(row.order.customerRequestId?'Libri':'Lavori'),invoicing:e.target.checked?'Sì':''}})}/>{done?'Sì':label==='In bozza'?'In bozza':'No'}</label>;
 return <span className={'billing-mark '+(done?'billing-mark-done':'')} role="img" aria-label={label} title={label}>{done?<Check size={16}/>:<Minus size={14}/>}<span>{done?'Sì':billed?billed+'/'+rows.length:label==='In bozza'?'In bozza':'No'}</span></span>;
}
