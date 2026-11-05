import type {Order,Store,Work} from './data';
import {fmtDate,quantityLabel} from './data';
import {operatorIds} from './assignments';
import {statusText} from './order-groups';
import {technicalFields} from './technical-fields';
import {orderRegistrationNumbers} from './order-groups';
const clean=(s:unknown)=>String(s??'').replace(/[–—‑]/g,'-').replace(/[“”]/g,'"').replace(/[’‘]/g,"'").replace(/…/g,'...').replace(/\t/g,'  ');
export async function buildWorkSheetPdf(order:Order,store:Store,code:string,logoBytes?:Uint8Array,monogramBytes?:Uint8Array):Promise<Blob>{
 code=String(orderRegistrationNumbers(store.orders).get(order.id)||order.number);
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
 text('ENTRATA ORDINE N.',232,251,9,true,muted);text(code,232,262,17,true,wine);
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
 const x=224,width=182;
 for(let index=0;index<order.lines.length;index++){
  const work=order.lines[index];
  const fields:[string,string][]=[['QUANTITÀ',quantityLabel(work)],['PROCESSO',statusText(work.status)],['DATA ORDINE',fmtDate(order.created)],['CONSEGNA RICHIESTA',fmtDate(work.production?work.production.requestedDate:order.due)],['OPERATORI',assigned(work)],['FORNITORI',work.production?.supplier||''],['MODALITÀ CONSEGNA',work.production?.delivery||''],['DDT',order.ddt?.number||work.production?.ddtNumber||'']];
  for(const f of technicalFields(store).filter(f=>f.enabled&&work.technical?.[f.key]?.trim()))fields.push([f.label.toUpperCase(),work.technical![f.key]]);
  if(work.production?.category==='Libri')fields.push(['INGRESSO / USCITA',[work.production.entryTime,work.production.exitTime].filter(Boolean).join(' / ')],['URGENZA',work.production.urgent?'Urgente':'No']);
  function layout(draw:boolean,size:number){
   let y=19;const leading=size*.44,labelSize=Math.max(8,size-2);
   const put=(v:unknown,xx:number,yy:number,ss=size,bold=false,color=ink)=>{if(draw)text(v,xx,yy,ss,bold,color);};
   if(draw)doc.addImage(monogram,'PNG',x,13,10,10,undefined,'FAST');
   for(const l of wrap([order.title||order.number,client?.name].filter(Boolean).join(' · '),166,9)){put(l,x+15,y,9,false,muted);y+=4;}
   y=Math.max(y+7,32);put('ENTRATA ORDINE N. '+code,x,y,10,true,wine);put(`LAVORAZIONE ${index+1} / ${order.lines.length}`,x+113,y,9,true,muted);y+=10;
   for(const l of wrap(work.description,width,18)){put(l,x,y,18,true);y+=7;}y+=3;
   // Three aligned columns keep the technical summary on the front of the folder.
   for(let i=0;i<fields.length;i+=3){let height=0;for(let j=0;j<3&&fields[i+j];j++){const [label,value]=fields[i+j],xx=x+j*62;let yy=y;for(const l of wrap(label,58,labelSize)){put(l,xx,yy,labelSize,true,muted);yy+=labelSize*.4;}yy+=1.5;for(const l of wrap(value||'—',58,size)){put(l,xx,yy);yy+=leading;}height=Math.max(height,yy-y);}y+=height+3;}
   function block(label:string,value:unknown){if(!value)return;put(label,x,y,labelSize,true,wine);y+=5;for(const l of wrap(value,width,size)){put(l,x,y);y+=leading;}y+=3;}
   block('COMMENTI DI PRODUZIONE',work.production?.comments);block('ANNOTAZIONI AGGIUNTIVE',work.production?.additionalNotes);
   put('NOTE LAVORAZIONE',x,y,10,true,wine);y+=7;
   const left=wrap(work.notes||'',86,size),right=wrap(work.notesRight||'',86,size),count=Math.max(4,left.length,right.length),spacing=7;
   for(let i=0;i<count;i++){if(left[i])put(left[i],x,y);if(right[i])put(right[i],x+96,y);if(draw){doc.setDrawColor(line);doc.setLineWidth(.15);doc.line(x,y+2,x+86,y+2);doc.line(x+96,y+2,x+182,y+2);}y+=spacing;}y+=5;
   put('ALTRI OPERATORI / FIRME',x,y,labelSize,true,wine);y+=8;if(draw){doc.setDrawColor(line);doc.line(x,y,x+182,y);}y+=8;
   block('NOTE ORDINE',order.notes);block('GRUPPO / EVENTO',work.production?.section);
   return y;
  }
  let size=11.5;while(size>9&&layout(false,size)>274)size-=.5;
  if(layout(false,size)>274)throw new Error(`La lavorazione ${index+1} contiene troppo testo per una sola facciata leggibile. Riduci le note o suddividi la lavorazione prima di stampare la cartellina.`);
  doc.addPage('a3','landscape');doc.setDrawColor(line);doc.setLineWidth(.3);doc.roundedRect(217,7,196,276,2,2);doc.setDrawColor(wine);doc.setLineWidth(1);doc.line(224,7,256,7);doc.setLineWidth(.2);layout(true,size);
 }
 const sheets=doc.getNumberOfPages();
 for(let p=1;p<=sheets;p++){doc.setPage(p);text(`Entrata ordine n. ${code}  /  ${p} di ${sheets}`,p===1?14:224,288,8,false,muted);}
 doc.setProperties({title:`Scheda lavoro ${code} - ${order.title||order.number}`,author:'RAIA',subject:'Cartellina di produzione A3 piegabile'});
 return doc.output('blob');
}
