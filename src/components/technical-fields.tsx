'use client';
import type {Work,Store} from '@/lib/data';
import {technicalFields} from '@/lib/technical-fields';
export function TechnicalFields({work,onChange,store}:{store:Pick<Store,'technicalFields'>;work:Partial<Work>;onChange:(patch:Partial<Work>)=>void}){
 return <section className="technical-fields"><h3>Caratteristiche tecniche</h3><div className="grid-form">{technicalFields(store).filter(f=>f.enabled).map(({key,label})=><label className="form-field" key={key}>{label}<input value={work.technical?.[key]||''} onChange={e=>onChange({technical:{...work.technical,[key]:e.target.value}})}/></label>)}</div></section>;
}
export function WorkNotes({work,onChange}:{work:Partial<Work>;onChange:(patch:Partial<Work>)=>void}){
 return <section className="work-notes-columns"><label className="form-field">Note lavorazione<textarea className="work-notes-editor" rows={10} value={work.notes||''} onChange={e=>onChange({notes:e.target.value})}/></label><label className="form-field">Note lavorazione · seconda colonna<textarea className="work-notes-editor" rows={10} value={work.notesRight||''} onChange={e=>onChange({notesRight:e.target.value})}/></label></section>;
}
