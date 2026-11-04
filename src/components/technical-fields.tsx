'use client';
import type {Work} from '@/lib/data';
export const technicalLabels={format:'Formato finito',openFormat:'Formato aperto',material:'Carta / materiale',weight:'Grammatura / spessore',pages:'Pagine / facciate',colors:'Colori / stampa',binding:'Rilegatura',finishing:'Finiture / plastificazione',dimensions:'Dimensioni / sviluppo',files:'File / revisione',packaging:'Imballaggio',instructions:'Altre caratteristiche tecniche'};
export function TechnicalFields({work,onChange}:{work:Partial<Work>;onChange:(patch:Partial<Work>)=>void}){
 return <section className="technical-fields"><h3>Caratteristiche tecniche</h3><div className="grid-form">{Object.entries(technicalLabels).map(([key,label])=><label className="form-field" key={key}>{label}<input value={work.technical?.[key]||''} onChange={e=>onChange({technical:{...work.technical,[key]:e.target.value}})}/></label>)}</div></section>;
}
export function WorkNotes({work,onChange}:{work:Partial<Work>;onChange:(patch:Partial<Work>)=>void}){
 return <section className="work-notes-columns"><label className="form-field">Note lavorazione<textarea className="work-notes-editor" rows={10} value={work.notes||''} onChange={e=>onChange({notes:e.target.value})}/></label><label className="form-field">Note lavorazione · seconda colonna<textarea className="work-notes-editor" rows={10} value={work.notesRight||''} onChange={e=>onChange({notesRight:e.target.value})}/></label></section>;
}
