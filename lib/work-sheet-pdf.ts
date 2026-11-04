import type {Order,Store,Work} from './data';
import {fmtDate,quantityLabel,billingState} from './data';
import {operatorIds} from './assignments';
import {statusText} from './order-groups';
const techLabels:Record<string,string>={format:'Formato finito',openFormat:'Formato aperto',material:'Carta / materiale',weight:'Grammatura / spessore',pages:'Pagine / facciate',colors:'Colori / stampa',binding:'Rilegatura',finishing:'Finiture / plastificazione',dimensions:'Dimensioni / sviluppo',files:'File / revisione',packaging:'Imballaggio',instructions:'Altre caratteristiche tecniche'};
const clean=(s:unknown)=>String(s??'').replace(/[–—‑]/g,'-').replace(/[“”]/g,'"').replace(/[’‘]/g,"'").replace(/…/g,'...').replace(/\t/g,'  ');
export async function buildWorkSheetPdf(order:Order,store:Store,code:string,logoBytes?:Uint8Array):Promise<Blob>{
 const {jsPDF}=await import('jspdf');
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a3',compress:true});
 const logo=logoBytes||new Uint8Array(await (await fetch('/images/raia-logo-transparent.png')).arrayBuffer());
 const client=store.clients.find(c=>c.id===order.clientId),roster=[...store.operators,...(store.operatorHistory||[])];
 const assigned=(w:Work)=>operatorIds(w).map(id=>roster.find(o=>o.id===id)?.name||'Non disponibile').join(', ');
 const ink='#28282c',wine='#812c46',muted='#79767a',line='#ddd4d8';
 function font(size:number,bold=false,color=ink){doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(color);}
 function text(value:unknown,x:number,y:number,size=10,bold=false,color=ink){font(size,bold,color);doc.text(clean(value),x,y);}
 function wrap(value:unknown,width:number,size=10){font(size);return doc.splitTextToSize(clean(value),width) as string[];}
 function frame(){doc.setDrawColor(line);doc.setLineWidth(.2);doc.setLineDashPattern([1,2],0);doc.line(210,9,210,288);doc.setLineDashPattern([],0);text('PIEGA CENTRALE',196,291,6,false,muted);}
 frame();
 // Outer face: back on the left, front cover on the right.
 doc.addImage(logo,'PNG',247,20,126,62.7,undefined,'FAST');
 text('SCHEDA DI LAVORO',228,105,10,true,wine);text(code,228,120,26,true,wine);
 const titleLines=wrap(order.title||order.number,174,22);let cy=139;
 for(const l of titleLines.slice(0,5)){text(l,228,cy,22,true);cy+=9;}
 if(titleLines.length>5)text('Titolo completo nelle schede interne',228,cy+1,9,false,muted);
 cy=Math.max(cy+10,193);const cn=wrap(client?.name||'Cliente non indicato',174,17);for(const l of cn.slice(0,3)){text(l,228,cy,17,true);cy+=7;}
 text('ORDINE',228,240,8,true,muted);text(fmtDate(order.created),228,247,12);
 text('LAVORAZIONI',323,240,8,true,muted);text(String(order.lines.length),323,247,12,true);
 text('Riferimento ordine: '+order.number,228,263,8,false,muted);
 text('A3 / 420 × 297 mm  -  Piegare a metà in formato A4',228,279,8,false,muted);
 text('RAIA / PRODUZIONE',14,23,10,true,wine);text('Riepilogo ordine',14,38,22,true);
 text(code,14,49,10,false,muted);doc.setDrawColor(line);doc.line(14,56,196,56);
 let sy=66;
 for(let i=0;i<Math.min(9,order.lines.length);i++){
  const w=order.lines[i],ls=wrap(w.description,135,10);text(String(i+1).padStart(2,'0'),14,sy,10,true,wine);
  ls.slice(0,2).forEach((l,j)=>text(l,27,sy+j*4.5,10));text(quantityLabel(w),168,sy,9,true);sy+=Math.max(13,ls.slice(0,2).length*4.5+5);doc.line(14,sy-4,196,sy-4);
 }
 text('Dettagli completi di tutte le righe nelle pagine interne.',14,Math.min(sy+4,207),9,false,muted);
 text('PASSAGGI / CONTROLLO FINALE',14,228,9,true,wine);
 for(const [i,label] of ['File verificati','Materiali verificati','Quantità e finiture controllate','Imballaggio e consegna'].entries()){doc.rect(14,237+i*9,3,3);text(label,21,240+i*9,10);doc.line(105,241+i*9,196,241+i*9);}
 let panel=-1,x=14,y=0,work:Work=order.lines[0],index=0;
 function newPanel(continued=false){panel++;if(panel%2===0){doc.addPage('a3','landscape');frame();}x=panel%2===0?14:224;y=22;text(code,x,y,10,true,wine);text(`LAVORAZIONE ${index+1} / ${order.lines.length}${continued?' - SEGUE':''}`,x+88,y,8,true,muted);y+=10;for(const l of wrap(work.description,182,17).slice(0,3)){text(l,x,y,17,true);y+=7;}y+=5;}
 function ensure(height:number){if(y+height>270)newPanel(true);}
 function pair(a:string,av:unknown,b:string,bv:unknown){const al=wrap(av||'____________________________',86,10),bl=wrap(bv||'____________________________',86,10);let offset=0;while(offset<Math.max(al.length,bl.length)){ensure(20);const capacity=Math.max(1,Math.floor((265-y-7)/4.5));const count=Math.min(capacity,Math.max(al.length,bl.length)-offset);text(a,x,y,8,true,muted);text(b,x+96,y,8,true,muted);y+=6;al.slice(offset,offset+count).forEach((l,i)=>text(l,x,y+i*4.5,10));bl.slice(offset,offset+count).forEach((l,i)=>text(l,x+96,y+i*4.5,10));y+=count*4.5+7;offset+=count;}}
 function block(label:string,value:unknown){if(!value)return;const ls=wrap(value,182,10);ensure(16);text(label,x,y,8,true,wine);y+=6;for(const l of ls){ensure(6);text(l,x,y,10);y+=4.5;}y+=6;}
 for(index=0;index<order.lines.length;index++){
  work=order.lines[index];newPanel();if(wrap(work.description,182,17).length>3)block('DESCRIZIONE COMPLETA',work.description);
  block('ORDINE / CLIENTE',[order.title||order.number,client?.name].filter(Boolean).join(' - '));
  pair('QUANTITÀ',quantityLabel(work),'PROCESSO',statusText(work.status));
  pair('DATA ORDINE',fmtDate(order.created),'CONSEGNA RICHIESTA',fmtDate(work.production?work.production.requestedDate:order.due));
  pair('OPERATORI',assigned(work),'FORNITORI',work.production?.supplier);
  pair('MODALITÀ CONSEGNA',work.production?.delivery,'DDT',order.ddt?.number||work.production?.ddtNumber);
  pair('REGISTRO',work.production?.category==='Libri'?'Libri':'Lavorazioni generali','FATTURATO',billingState(work,store.drafts)==='billed'?'Sì':billingState(work,store.drafts)==='draft'?'In bozza':'No');
  pair('ESECUZIONE',fmtDate(order.executionDate||''),'TERMINATO',work.production?.terminated?'Sì':'No');
  const entries=Object.entries(techLabels);for(let t=0;t<entries.length;t+=2){const [ka,la]=entries[t],[kb,lb]=entries[t+1];pair(la.toUpperCase(),work.technical?.[ka],lb.toUpperCase(),work.technical?.[kb]);}
  if(work.production?.category==='Libri')pair('INGRESSO / USCITA',[work.production.entryTime,work.production.exitTime].filter(Boolean).join(' / '),'URGENZA',work.production.urgent?'Urgente':'No');
  block('NOTE ORDINE',order.notes);block('GRUPPO / EVENTO',work.production?.section);block('COMMENTI DI PRODUZIONE',work.production?.comments);block('ANNOTAZIONI AGGIUNTIVE',work.production?.additionalNotes);
  const left=wrap(work.notes||'',86,10),right=wrap(work.notesRight||'',86,10);let off=0;
  do{ensure(55);text('NOTE LAVORAZIONE',x,y,9,true,wine);text('NOTE LAVORAZIONE / 2',x+96,y,9,true,wine);y+=7;const n=Math.min(Math.max(left.length,right.length)-off,Math.floor((259-y)/5));const count=Math.max(n,8);for(let j=0;j<count;j++){if(left[off+j])text(left[off+j],x,y+j*5,10);if(right[off+j])text(right[off+j],x+96,y+j*5,10);doc.setDrawColor(line);doc.line(x,y+j*5+1.7,x+86,y+j*5+1.7);doc.line(x+96,y+j*5+1.7,x+182,y+j*5+1.7);}y+=count*5+9;off+=count;if(off<Math.max(left.length,right.length))newPanel(true);}while(off<Math.max(left.length,right.length));
  ensure(24);text('ALTRI OPERATORI / FIRME',x,y,8,true,wine);doc.line(x,y+9,x+182,y+9);doc.line(x,y+18,x+182,y+18);y+=25;
 }
 if(panel%2===0){x=224;text(code,x,22,10,true,wine);text('Annotazioni di reparto',x,38,19,true);for(let yy=55;yy<274;yy+=10){doc.setDrawColor(line);doc.line(x,yy,x+182,yy);}}
 for(let p=1;p<=doc.getNumberOfPages();p++){doc.setPage(p);text(`${code}  /  ${p} di ${doc.getNumberOfPages()}`,14,288,7,false,muted);}
 doc.setProperties({title:`Scheda lavoro ${code} - ${order.title||order.number}`,author:'RAIA',subject:'Cartellina di produzione A3 piegabile'});
 return doc.output('blob');
}
