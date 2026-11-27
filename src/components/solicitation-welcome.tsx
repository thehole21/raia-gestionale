 'use client';
import {useEffect,useRef,useState} from 'react';
import {AlertTriangle,ArrowUpRight,X} from 'lucide-react';
export function SolicitationWelcome({count,onView}:{count:number;onView:()=>void}){
 const [snapshot]=useState(count),[open,setOpen]=useState(true);
 const [greeting]=useState(()=>{const hour=Number(new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',hourCycle:'h23'}).format(new Date()));return hour>=8&&hour<14?'Buongiorno!':hour>=14&&hour<20?'Buonasera!':'Ancora sveglio?!';});
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();},[open]);
 if(!open)return null;
 return <dialog ref={dialog} className="solicitation-welcome" aria-labelledby="solicitation-welcome-title" onCancel={()=>setOpen(false)} onClick={event=>{if(event.target===event.currentTarget){const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)setOpen(false);}}}>
 <button type="button" className="icon-btn welcome-dismiss" aria-label="Chiudi avviso" onClick={()=>setOpen(false)}><X size={20}/></button>
 <div className="welcome-alert-symbol"><AlertTriangle size={28}/></div><p className="welcome-greeting">{greeting} <span aria-hidden="true">😊</span></p>
 <h2 id="solicitation-welcome-title">Ci sono <strong>{snapshot}</strong><br/>Commesse Sollecitate</h2>
 <p className="welcome-note">{snapshot?'Uno sguardo alle priorità, prima di iniziare.':'Nessuna commessa sollecitata al momento.'}</p>
 <div className="welcome-actions"><button type="button" className="btn btn-plain" onClick={()=>setOpen(false)}>Chiudi</button><button type="button" className="btn btn-primary" onClick={()=>{setOpen(false);onView();}}>Vedi <ArrowUpRight size={17}/></button></div>
 </dialog>;
}
