'use client';
import {type Work,type Production,type SourceRecord,type Store} from '@/lib/data';
function SourceDetails({source}:{source:SourceRecord}){
 const labels=source.headers||['','Entrata','Cliente','Lavoro','Copie','Operatore','Fornitore','Processo','Consegna richiesta','DDT','Consegna','Terminato','Fatturato'];
 return <details className="production-source"><summary>{source.sheet} · riga {source.row}</summary><dl>{source.values.map((v,i)=>v!==null&&v!==undefined&&v!==''?<div key={i}><dt>{labels[i]||`Colonna ${i+1}`}</dt><dd>{typeof v==='boolean'?(v?'Sì':'No'):String(v)}</dd></div>:null)}</dl>{Object.entries(source.comments||{}).map(([cell,note])=><p key={cell}>{cell}: {note}</p>)}</details>;
}
export function RegisterNotes({store,year,month}:{store:Store;year:string;month:string}){
 const registers=(store.productionRegisters||[]).filter(r=>r.periods.some(p=>(!year||p.slice(0,4)===year)&&(!month||p.slice(5,7)===month)));
 if(!registers.length)return null;
 return <details className="production-registers"><summary>Note e sezioni dei registri Excel</summary><p>Intestazioni, note di gruppo e righe senza una lavorazione. Non sono conteggiate come ordini.</p>{registers.map(r=><details key={r.sheet}><summary>{r.sheet}</summary>{r.notes.map(n=><div key={n.row}><small>Riga {n.row}</small><p>{n.values.filter(v=>v!==null&&v!==undefined&&v!==''&&typeof v!=='boolean').map(String).join(' · ')}</p>{Object.entries(n.comments||{}).map(([cell,note])=><p key={cell}>{cell}: {note}</p>)}</div>)}</details>)}</details>;
}
export function ProductionFields({work,onChange}:{work:Partial<Work>;onChange:(p:Production)=>void}) {
 const p:Production=work.production || {quantity:String(work.qty??''),priceUnspecified:false,supplier:'',requestedDate:'',requestedText:'',ddtNumber:'',delivery:'',terminated:false,invoicing:''};
 const change=(key:keyof Production,value:string|boolean)=>onChange({...p,[key]:value});
 const history=[...(work.sourceHistory||[]),...(work.source?[work.source]:[])].filter((s,i,a)=>a.findIndex(x=>x.sheet===s.sheet&&x.row===s.row)===i);
 return <section className="production-fields"><h3>Programmazione e consegna</h3>{p.planningMonths&&<p className="helper-text">Mesi: {p.planningMonths.join(' · ')}</p>}<div className="grid-form">
 <label className="form-field">Evento / gruppo<input value={p.section||''} onChange={e=>change('section',e.target.value)}/></label>
 <label className="form-field">Copie / quantità originale<input value={p.quantity} onChange={e=>change('quantity',e.target.value)} placeholder="Non precisata · es. 100+2"/></label>
 <label className="form-field">Fornitore<input value={p.supplier} onChange={e=>change('supplier',e.target.value)}/></label>
 <label className="form-field">Consegna richiesta<input type="date" value={p.requestedDate} onChange={e=>change('requestedDate',e.target.value)}/></label>
 <label className="form-field">Indicazioni sulla scadenza<input value={p.requestedText} onChange={e=>change('requestedText',e.target.value)} placeholder="Non precisata"/></label>
 <label className="form-field">DDT della lavorazione<input value={p.ddtNumber} onChange={e=>change('ddtNumber',e.target.value)}/></label>
 <label className="form-field">Modalità di consegna<input value={p.delivery} onChange={e=>change('delivery',e.target.value)} placeholder="Es. Ritirano, Noi alla Posta"/></label>
 <label className="form-field">Fatturato / indicazioni<input value={p.invoicing} onChange={e=>change('invoicing',e.target.value)} placeholder="Non indicato"/></label>
 <label className="portal-check"><input type="checkbox" checked={p.terminated} onChange={e=>change('terminated',e.target.checked)}/>Terminato</label>
 <label className="portal-check"><input type="checkbox" checked={p.priceUnspecified} onChange={e=>change('priceUnspecified',e.target.checked)}/>Prezzo da definire</label>
 {p.category==='Libri'&&<><label className="form-field">Numero nel registro Libri<input value={p.bookNumber||''} onChange={e=>change('bookNumber',e.target.value)}/></label><label className="form-field">Orario ingresso<input value={p.entryTime||''} onChange={e=>change('entryTime',e.target.value)}/></label><label className="form-field">Orario uscita<input value={p.exitTime||''} onChange={e=>change('exitTime',e.target.value)}/></label><label className="portal-check"><input type="checkbox" checked={!!p.urgent} onChange={e=>change('urgent',e.target.checked)}/>Urgente</label><label className="form-field">Commenti di produzione<textarea value={p.comments||''} onChange={e=>change('comments',e.target.value)}/></label></>}
 </div>{p.additionalNotes&&<label className="form-field">Annotazioni nelle colonne aggiuntive<textarea value={p.additionalNotes} onChange={e=>change('additionalNotes',e.target.value)}/></label>}
 {history.length>0&&<div><h4>Dati originali e riporti mensili</h4>{history.map(source=><SourceDetails key={source.sheet+source.row} source={source}/>)}</div>}</section>;
}
