'use client';
import {type Supplier} from '@/lib/suppliers';
import {supplierNames} from '@/lib/assignments';
import {MultiPicker} from './multi-picker';
export function SupplierSelect({suppliers,value,onChange,label='Fornitori'}:{suppliers:Supplier[];value:string;onChange:(v:string)=>void;label?:string}){
 return <MultiPicker label={label} values={supplierNames(value)} options={suppliers.filter(s=>s.active).sort((a,b)=>a.name.localeCompare(b.name,'it')).map(s=>({id:s.name,name:s.name}))} onChange={values=>onChange(values.join('; '))}/>;
}
