'use client';
import {type Supplier,supplierOptions} from '@/lib/suppliers';
import {supplierNames} from '@/lib/assignments';
import {MultiPicker} from './multi-picker';
export function SupplierSelect({suppliers,value,onChange,label='Fornitori'}:{suppliers:Supplier[];value:string;onChange:(v:string)=>void;label?:string}){
 return <MultiPicker label={label} values={supplierNames(value)} options={supplierOptions(suppliers)} onChange={values=>onChange(values.join('; '))}/>;
}
