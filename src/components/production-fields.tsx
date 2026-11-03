'use client';
import {SupplierSelect} from './supplier-select';
import type {Supplier} from '@/lib/suppliers';
import {BOOK_DELIVERIES,type WorkCategory} from '@/lib/work-categories';
import {type Work,type Production,type SourceRecord,fmtDate} from '@/lib/data';
function SourceDetails({source}:{source:SourceRecord}){
 const labels=source.headers||['','Entrata','Cliente','Lavoro','Copie','Operatore','Fornitore','Processo','Consegna richiesta','DDT','Consegna','Terminato','Fatturato'];
 return <details className="production-source"><summary>{source.sheet} · riga {source.row}</summary><dl>{source.values.map((v,i)=>v!==null&&v!==undefined&&v!==''?<div key={i}><dt>{labels[i]||`Colonna ${i+1}`}</dt><dd>{typeof v==='boolean'?(v?'Sì':'No'):String(v)}</dd></div>:null)}</dl>{Object.entries(source.comments||{}).map(([cell,note])=><p key={cell}>{cell}: {note}</p>)}</details>;
}
export function ProductionFields({work,onChange,suppliers,dueFallback=''}:{dueFallback?:string;suppliers:Supplier[];work:Partial<Work>;onChange:(p:Production)=>void}) {
 const p:Production=work.production || {quantity:String(work.qty??''),priceUnspecified:false,supplier:'',requestedDate:dueFallback,requestedText:'',ddtNumber:'',delivery:'',terminated:false,invoicing:''};
 const change=(key:keyof Production,value:string|boolean)=>onChange({...p,[key]:value});
 const history=[...(work.sourceHistory||[]),...(work.source?[work.source]:[])].filter((s,i,a)=>a.findIndex(x=>x.sheet===s.sheet&&x.row===s.row)===i);
 return <section className="production-fields"><h3>Programmazione e consegna</h3>{p.planningMonths&&<p className="helper-text">Mesi: {p.planningMonths.join(' · ')}</p>}<div className="grid-form">
 <div className="form-field"><span>Registro</span><strong className="readonly-value">{p.category==='Libri'?'Libri':'Lavorazioni generali'}</strong></div>
 <label className="form-field">Evento / gruppo<input value={p.section||''} onChange={e=>change('section',e.target.value)}/></label>
 <div className="form-field"><span>Fornitore</span><strong className="readonly-value">{p.supplier||'Non assegnato'}</strong></div>
 <div className="form-field"><span>Consegna richiesta</span><strong className="readonly-value">{p.requestedDate?fmtDate(p.requestedDate):p.requestedText||'Non precisata'}</strong></div>
 
 <div className="form-field"><span>Modalità di consegna</span><strong className="readonly-value">{p.delivery||'Non precisata'}</strong></div>
 <div className="form-field"><span>Terminato</span><strong className="readonly-value">{p.terminated?'Sì':'No'}</strong></div>
 <label className="portal-check"><input type="checkbox" checked={p.priceUnspecified} onChange={e=>change('priceUnspecified',e.target.checked)}/>Prezzo da definire</label>
 {p.category==='Libri'&&<><label className="form-field">Numero nel registro Libri<input value={p.bookNumber||''} onChange={e=>change('bookNumber',e.target.value)}/></label><label className="form-field">Orario ingresso<input value={p.entryTime||''} onChange={e=>change('entryTime',e.target.value)}/></label><label className="form-field">Orario uscita<input value={p.exitTime||''} onChange={e=>change('exitTime',e.target.value)}/></label><div className="form-field"><span>Urgente</span><strong className="readonly-value">{p.urgent?'Sì':'No'}</strong></div><label className="form-field">Commenti di produzione<textarea value={p.comments||''} onChange={e=>change('comments',e.target.value)}/></label></>}
 </div>{p.additionalNotes&&<label className="form-field">Annotazioni nelle colonne aggiuntive<textarea value={p.additionalNotes} onChange={e=>change('additionalNotes',e.target.value)}/></label>}
 {history.length>0&&<div><h4>Dati originali e riporti mensili</h4>{history.map(source=><SourceDetails key={source.sheet+source.row} source={source}/>)}</div>}</section>;
}
