'use client';
import {type Supplier,sortSuppliers,supplierAppearance} from '@/lib/suppliers';
import {supplierNames} from '@/lib/assignments';
import {MultiPicker} from './multi-picker';
export function SupplierSelect({suppliers,value,onChange,label='Fornitori'}:{suppliers:Supplier[];value:string;onChange:(v:string)=>void;label?:string}){
 return <MultiPicker label={label} values={supplierNames(value)} options={sortSuppliers(suppliers.filter(s=>s.active)).map(s=>({id:s.name,name:s.name,...supplierAppearance(s.name)}))} onChange={values=>onChange(values.join('; '))}/>;
}
