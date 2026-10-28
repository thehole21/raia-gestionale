import {Check,Minus} from 'lucide-react';
import type {WorkRow} from '@/lib/data';
export function BillingMark({rows}:{rows:WorkRow[]}){
 const billed=rows.filter(r=>r.billingState==='billed').length,done=rows.length>0&&billed===rows.length;
 const label=done?'Fatturato':billed?'Fatturato parzialmente':rows.some(r=>r.billingState==='draft')?'In bozza':'Non fatturato';
 return <span className={'billing-mark '+(done?'billing-mark-done':'')} role="img" aria-label={label} title={label}>{done?<Check size={16}/>:<Minus size={14}/>}<span>{done?'Sì':billed?billed+'/'+rows.length:label==='In bozza'?'In bozza':'No'}</span></span>;
}
