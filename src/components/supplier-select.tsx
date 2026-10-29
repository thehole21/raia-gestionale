'use client';
import {type Supplier,supplierKey} from '@/lib/suppliers';
export function SupplierSelect({suppliers,value,onChange,label='Fornitore'}:{suppliers:Supplier[];value:string;onChange:(v:string)=>void;label?:string}){
 const choices=suppliers.filter(s=>s.active).sort((a,b)=>a.name.localeCompare(b.name,'it'));
 const current=choices.find(s=>supplierKey(s.name)===supplierKey(value));
 return <select aria-label={label} value={current?.name||value} onChange={e=>onChange(e.target.value)}><option value="">Non assegnato</option>{value&&!current&&<option value={value} disabled>{value} · storico</option>}{choices.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select>;
}
