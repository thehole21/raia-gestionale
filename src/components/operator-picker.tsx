'use client';
import {MultiPicker} from './multi-picker';
import {operatorIds} from '@/lib/assignments';
import type {Work,Operator} from '@/lib/data';
export function OperatorPicker({work,operators,onChange,label='Operatori'}:{work:Partial<Pick<Work,'operatorId'|'operatorIds'>>;operators:Operator[];onChange:(patch:Partial<Work>)=>void;label?:string}){
 return <MultiPicker label={label} options={operators} values={operatorIds(work)} onChange={ids=>onChange({operatorId:ids[0]||'',operatorIds:ids})}/>;
}
