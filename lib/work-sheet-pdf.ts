import type {Order,Store,Work} from './data';
import {fmtDate,quantityLabel,billingState} from './data';
import {operatorIds} from './assignments';
import {statusText} from './order-groups';
const techLabels:Record<string,string>={format:'Formato finito',openFormat:'Formato aperto',material:'Carta / materiale',weight:'Grammatura / spessore',pages:'Pagine / facciate',colors:'Colori / stampa',binding:'Rilegatura',finishing:'Finiture / plastificazione',dimensions:'Dimensioni / sviluppo',files:'File / revisione',packaging:'Imballaggio',instructions:'Altre caratteristiche tecniche'};
const clean=(s:unknown)=>String(s??'').replace(/[–—‑]/g,'-').replace(/[“”]/g,'"').replace(/[’‘]/g,"'").replace(/…/g,'...').replace(/\t/g,'  ');
export async function buildWorkSheetPdf(order:Order,store:Store,code:string,logoBytes?:Uint8Array,monogramBytes?:Uint8Array):Promise<Blob>{
 const {jsPDF}=await import('jspdf');
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a3',compress:true});
 const logo=logoBytes||new Uint8Array(await (await fetch('/images/raia-logo-transparent.png')).arrayBuffer());
 const monogram=monogramBytes||new Uint8Array(await (await fetch('/images/raia-monogram-transparent.png')).arrayBuffer());
 const client=store.clients.find(c=>c.id===order.clientId),roster=[...store.operators,...(store.operatorHistory||[])];
 const assigned=(w:Work)=>operatorIds(w).map(id=>roster.find(o=>o.id===id)?.name||'Non disponibile').join(', ');
 const ink='#28282c',wine='#812c46',muted='#79767a',line='#ddd4d8';
 function font(size:number,bold=false,color=ink){doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(color);}
 function text(value:unknown,x:number,y:number,size=10,bold=false,color=ink){font(size,bold,color);doc.text(clean(value),x,y);}
 function wrap(value:unknown,width:number,size=10){font(size);return doc.splitTextToSize(clean(value),width) as string[];}
 function grid(gx:number,gy:number,width:number,height:number){doc.setDrawColor('#e5dce0');doc.setLineWidth(.15);for(let xx=0;xx<=width;xx+=8)doc.line(gx+xx,gy,gx+xx,gy+height);for(let yy=0;yy<=height;yy+=8)doc.line(gx,gy+yy,gx+width,gy+yy);doc.rect(gx,gy,width,height);}
 function frame(){for(const px of [7,217]){doc.setDrawColor(line);doc.setLineWidth(.3);doc.roundedRect(px,7,196,276,2,2);doc.setDrawColor(wine);doc.setLineWidth(1);doc.line(px+7,7,px+39,7);}doc.setLineWidth(.2);}

 frame();
 // Outer face: back on the left, front cover on the right.
 doc.addImage(logo,'PNG',267,17,100.8,50.16,undefined,'FAST');
 function right(value:unknown,yy:number,size:number,bold=false,color=ink){font(size,bold,color);doc.text(clean(value),394,yy,{align:'right'});}
 right('ORDINE · '+fmtDate(order.created),80,12,true,wine);
 const details=[client?.phone&&'Tel. '+client.phone,client?.email, [client?.address,client?.postalCode,client?.city,client?.province].filter(Boolean).join(' '),client?.vat&&'P. IVA '+client.vat,client?.taxCode&&'C.F. '+client.taxCode,client?.pec&&'PEC '+client.pec].filter(Boolean);
 let cy=89;for(const d of details){for(const l of wrap(d,162,10)){right(l,cy,10);cy+=4.5;}}
 cy=Math.max(124,cy+10);right('CLIENTE',cy,10,true,wine);cy+=10;
 for(const l of wrap(client?.name||'Cliente non indicato',162,23)){right(l,cy,23,true);cy+=9;}
 cy=Math.max(173,cy+13);font(11,true,wine);doc.text('PROGETTO',315,cy,{align:'center'});cy+=12;
 const titleLines=wrap(order.title||order.number,166,25);
 for(const l of titleLines.slice(0,5)){font(25,true);doc.text(l,315,cy,{align:'center'});cy+=10;}
 text('SCHEDA DI LAVORO',232,251,9,true,muted);text(code,232,262,17,true,wine);
 right('LAVORAZIONI',251,9,true,muted);right(String(order.lines.length),265,28,true,wine);

 text('RAIA / PRODUZIONE',14,23,10,true,wine);text('Riepilogo ordine',14,38,22,true);
 text(code,14,49,10,false,muted);doc.setDrawColor(line);doc.line(14,56,196,56);
 let sy=66;
 for(let i=0;i<Math.min(9,order.lines.length);i++){
  const w=order.lines[i],ls=wrap(w.description,135,10);text(String(i+1).padStart(2,'0'),14,sy,10,true,wine);
  ls.slice(0,2).forEach((l,j)=>text(l,27,sy+j*4.5,10));text(quantityLabel(w),168,sy,9,true);sy+=Math.max(13,ls.slice(0,2).length*4.5+5);doc.line(14,sy-4,196,sy-4);
 }
 if(sy<190){text('APPUNTI',14,sy+5,8,true,wine);grid(14,sy+10,182,Math.min(48,210-sy-10));}
 text('PASSAGGI / CONTROLLO FINALE',14,228,9,true,wine);
 for(const [i,label] of ['File verificati','Materiali verificati','Quantità e finiture controllate','Imballaggio e consegna'].entries()){doc.rect(14,237+i*9,3,3);text(label,21,240+i*9,10);doc.line(105,241+i*9,196,241+i*9);}
 let panel=-1,x=14,y=0,work:Work=order.lines[0],index=0;
 function newPanel(continued=false){
  // A new job always starts on a new physical sheet; every verso stays empty.
  panel++;if(!continued&&panel%2!==0)panel++;
  if(panel%2===0){doc.addPage('a3','landscape');doc.addPage('a3','landscape');frame();}
  x=panel%2===0?14:224;y=19;
  doc.addImage(monogram,'PNG',x,13,11,11,undefined,'FAST');
  for(const l of wrap([order.title||order.number,client?.name].filter(Boolean).join(' · '),166,9)){text(l,x+16,y,9,false,muted);y+=4;}
  y=Math.max(y+8,35);text(code,x,y,11,true,wine);text(`LAVORAZIONE ${index+1} / ${order.lines.length}${continued?' - SEGUE':''}`,x+88,y,9,true,muted);
  y+=12;for(const l of wrap(work.description,182,20).slice(0,3)){text(l,x,y,20,true);y+=8;}y+=6;
 }
 function ensure(height:number){if(y+height>270)newPanel(true);}
 function pair(a:string,av:unknown,b:string,bv:unknown){const al=wrap(av||'________________________',86,12),bl=wrap(bv||'________________________',86,12);let offset=0;while(offset<Math.max(al.length,bl.length)){ensure(23);const capacity=Math.max(1,Math.floor((265-y-8)/5.5));const count=Math.min(capacity,Math.max(al.length,bl.length)-offset);text(a,x,y,9,true,muted);text(b,x+96,y,9,true,muted);y+=7;al.slice(offset,offset+count).forEach((l,i)=>text(l,x,y+i*5.5,12));bl.slice(offset,offset+count).forEach((l,i)=>text(l,x+96,y+i*5.5,12));y+=count*5.5+7;offset+=count;}}
 function block(label:string,value:unknown){if(!value)return;const ls=wrap(value,182,12);ensure(20);text(label,x,y,9,true,wine);y+=7;for(const l of ls){ensure(7);text(l,x,y,12);y+=5.5;}y+=7;}
 for(index=0;index<order.lines.length;index++){
  work=order.lines[index];newPanel();if(wrap(work.description,182,20).length>3)block('DESCRIZIONE COMPLETA',work.description);
  pair('QUANTITÀ',quantityLabel(work),'PROCESSO',statusText(work.status));
  pair('DATA ORDINE',fmtDate(order.created),'CONSEGNA RICHIESTA',fmtDate(work.production?work.production.requestedDate:order.due));
  pair('OPERATORI',assigned(work),'FORNITORI',work.production?.supplier);
  pair('MODALITÀ CONSEGNA',work.production?.delivery,'DDT',order.ddt?.number||work.production?.ddtNumber);
  pair('REGISTRO',work.production?.category==='Libri'?'Libri':'Lavorazioni generali','FATTURATO',billingState(work,store.drafts)==='billed'?'Sì':billingState(work,store.drafts)==='draft'?'In bozza':'No');
  pair('ESECUZIONE',fmtDate(order.executionDate||''),'TERMINATO',work.production?.terminated?'Sì':'No');
  const entries=Object.entries(techLabels);for(let t=0;t<entries.length;t+=2){const [ka,la]=entries[t],[kb,lb]=entries[t+1];pair(la.toUpperCase(),work.technical?.[ka],lb.toUpperCase(),work.technical?.[kb]);}
  if(work.production?.category==='Libri')pair('INGRESSO / USCITA',[work.production.entryTime,work.production.exitTime].filter(Boolean).join(' / '),'URGENZA',work.production.urgent?'Urgente':'No');
  block('NOTE ORDINE',order.notes);block('GRUPPO / EVENTO',work.production?.section);block('COMMENTI DI PRODUZIONE',work.production?.comments);block('ANNOTAZIONI AGGIUNTIVE',work.production?.additionalNotes);
  const left=wrap(work.notes||'',86,12),rightNotes=wrap(work.notesRight||'',86,12);let off=0;
  do{ensure(80);text('NOTE LAVORAZIONE',x,y,11,true,wine);y+=9;const n=Math.min(Math.max(left.length,rightNotes.length)-off,Math.floor((258-y)/8));const count=Math.max(n,7);for(let j=0;j<count;j++){if(left[off+j])text(left[off+j],x,y+j*8,12);if(rightNotes[off+j])text(rightNotes[off+j],x+96,y+j*8,12);doc.setDrawColor(line);doc.line(x,y+j*8+2.5,x+86,y+j*8+2.5);doc.line(x+96,y+j*8+2.5,x+182,y+j*8+2.5);}y+=count*8+9;off+=count;if(off<Math.max(left.length,rightNotes.length))newPanel(true);}while(off<Math.max(left.length,rightNotes.length));
  ensure(24);text('ALTRI OPERATORI / FIRME',x,y,10,true,wine);doc.line(x,y+9,x+182,y+9);doc.line(x,y+18,x+182,y+18);y+=25;
 }
 doc.addPage('a3','landscape');
 const sheets=doc.getNumberOfPages()/2;
 for(let p=1;p<=doc.getNumberOfPages();p+=2){doc.setPage(p);text(`${code}  /  ${Math.ceil(p/2)} di ${sheets}`,14,288,8,false,muted);}
 doc.setProperties({title:`Scheda lavoro ${code} - ${order.title||order.number}`,author:'RAIA',subject:'Cartellina di produzione A3 piegabile'});
 return doc.output('blob');
}
