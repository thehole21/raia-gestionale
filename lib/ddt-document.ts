export type DdtIssuer={name:string;address:string;vat:string;rea:string};
export type DdtDocument={issuer:DdtIssuer;recipient:string;recipientAddress:string;recipientTax:string;destination:string;reason:string;carrier:string;transportDate:string;packages:string;notes:string;lines:{description:string;quantity:string;unit:string}[]};
export const defaultDdtIssuer:DdtIssuer={name:'RAIA S.r.l.',address:'Via Bruno Pontecorvo, 46 — 00012 Guidonia Montecelio (RM)',vat:'09368991007',rea:'1158444 · CCIAA di Roma'};
export function validateDdt(number:string,date:string,d:DdtDocument){
 if(!number.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(date))return 'Inserisci numero e data del DDT.';
 if(!d.issuer.name.trim()||!d.issuer.address.trim()||!d.issuer.vat.trim())return 'Completa i dati del mittente.';
 if(!d.recipient.trim()||!d.recipientAddress.trim()||!d.recipientTax.trim()||!d.destination.trim())return 'Completa destinatario, indirizzo, P. IVA / C.F. e destinazione.';
 if(!d.carrier.trim()||!d.reason.trim()||!d.transportDate)return 'Completa causale, trasportatore e data di trasporto.';
 if(!d.lines.length||d.lines.some(l=>!l.description.trim()||!l.quantity.trim()||!l.unit.trim()||!/[1-9]/.test(l.quantity)))return 'Completa descrizione, quantità e unità di ogni riga.';
 return '';
}
export async function buildDdtPdf(number:string,date:string,d:DdtDocument){
 const {jsPDF}=await import('jspdf');const pdf=new jsPDF();let y=18;
 const line=(text:string,bold=false)=>{pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(10);for(const part of pdf.splitTextToSize(text,178)){if(y>270){pdf.addPage();y=18;}pdf.text(part,16,y);y+=5;}};
 pdf.setTextColor(113,43,65);pdf.setFontSize(18);pdf.text('DOCUMENTO DI TRASPORTO',16,y);y+=10;pdf.setTextColor(35,35,35);line('N. '+number+' del '+date,true);y+=5;
 line('MITTENTE',true);line(d.issuer.name);line(d.issuer.address);line('P. IVA / C.F. '+d.issuer.vat);if(d.issuer.rea)line('REA '+d.issuer.rea);y+=5;
 line('DESTINATARIO',true);line(d.recipient);line(d.recipientAddress);line('P. IVA / C.F. '+d.recipientTax);line('Destinazione: '+d.destination);y+=5;
 line('Causale: '+d.reason);line('Trasporto a cura di: '+d.carrier);line('Data trasporto: '+d.transportDate);if(d.packages)line('Colli: '+d.packages);y+=6;
 const heading=()=>{if(y>255){pdf.addPage();y=18;}pdf.setFillColor(242,229,234);pdf.rect(16,y-4,178,8,'F');pdf.setFont('helvetica','bold');pdf.setFontSize(10);pdf.text('Descrizione dei beni',18,y+1);pdf.text('Quantità / unità',151,y+1);y+=10;};heading();
 for(const row of d.lines){const description=pdf.splitTextToSize(row.description,125),qty=pdf.splitTextToSize(row.quantity+' '+row.unit,40);const length=Math.max(description.length,qty.length);pdf.setFont('helvetica','normal');for(let i=0;i<length;i++){if(y>268){pdf.addPage();y=18;heading();pdf.setFont('helvetica','normal');}if(description[i])pdf.text(description[i],18,y);if(qty[i])pdf.text(qty[i],151,y);y+=5;}pdf.setDrawColor(225,215,219);pdf.line(16,y,194,y);y+=6;}
 if(d.notes){y+=3;line('Note: '+d.notes);}y+=8;line('Firma mittente __________________    Firma destinatario __________________');y+=5;line('Firma trasportatore __________________');
 for(let p=1;p<=pdf.getNumberOfPages();p++){pdf.setPage(p);pdf.setFontSize(8);pdf.setTextColor(110);pdf.text('DDT '+number+' · '+date+' — Pagina '+p+' / '+pdf.getNumberOfPages(),16,287);}
 return pdf.output('blob');
}
