import type { BookSpec, BookItem } from './portal';
// Enable after the reviewed Supabase migration is applied and submission tests pass.
export const BOOK_SUBMISSION_ENABLED=false;
export const PRICE_VERSION='raia-libri-2026-03-v1';
export const COVER_COATED='Patinata 250 g plastificata';
export const COVER_MARKED='Marcata 250 g';
export const IVORY='Edizioni avorio 80 gr M. 1,6';
export const DISCOUNTS=[{from:1,percent:0},{from:50,percent:3},{from:100,percent:5},{from:200,percent:8},{from:300,percent:12},{from:500,percent:18}] as const;
export type BookPriceItem={title:string;copies:number;baseUnit:number;discountPercent:number;unitNet:number;net:number};
export type BookPrice={version:string;items:BookPriceItem[];printNet:number;minimumFee:number;shippingNet:number;shipments:number;totalNet:number;vatIncluded:false};
const cents=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export function baseBookUnit(s:Pick<BookItem,'format'|'paper'|'paperWeight'|'pages'|'colorPages'|'cover'|'flaps'>){
 const small=s.format==='15x21',ivory=s.paper===IVORY;
 const kg=small?({80:22.5,90:25.34,100:28.16}[s.paperWeight as 80|90|100]):({80:28,90:31.5,100:35}[s.paperWeight as 80|90|100]);
 // Exact dependencies of LIBRI C12:C15 and C19:C22; no intermediate rounding.
 const page=kg*(ivory?1.32*1.25:1.2*1.25)/16000+(small?0.05/8:0.033/4);
 let unit=page*s.pages+0.9+0.6+(small?0.035:0.065)*s.colorPages;
 if(s.flaps)unit+=0.35;
 if(s.cover===COVER_MARKED)unit+=small?(s.flaps?-0.15:-0.08):(s.flaps?0.3:0.26);
 return unit;
}
export function bookPrice(spec:BookSpec):{price:BookPrice|null;errors:string[]}{
 const errors:string[]=[],books=[spec,...(spec.additionalBooks||[])],kind=spec.orderKind||'standard',shipments=spec.shipments??0;
 if(!['standard','sample','mixed'].includes(kind))errors.push('Tipo di ordine non valido.');
 if(books.length>10||(kind!=='mixed'&&books.length!==1)||(kind==='mixed'&&books.length<2))errors.push('La lista mista deve contenere da 2 a 10 titoli.');
 if(!Number.isInteger(shipments)||shipments<0||shipments>100000)errors.push('Numero di spedizioni non valido.');
 books.forEach((s,i)=>{
  if(!['15x21','17x24'].includes(s.format))errors.push(`Titolo ${i+1}: scegli un formato del listino.`);
  if(!['Uso mano',IVORY].includes(s.paper)||![80,90,100].includes(s.paperWeight)||(s.paper===IVORY&&s.paperWeight!==80))errors.push(`Titolo ${i+1}: carta non prevista dal listino.`);
  if(![COVER_COATED,COVER_MARKED].includes(s.cover)||typeof s.flaps!=='boolean')errors.push(`Titolo ${i+1}: scegli copertina e alette.`);
  if(!Number.isInteger(s.pages)||s.pages<1||s.pages>5000)errors.push(`Titolo ${i+1}: pagine da 1 a 5000.`);
  if(!Number.isInteger(s.copies)||s.copies<1||s.copies>100000||(kind==='sample'&&s.copies!==1))errors.push(`Titolo ${i+1}: numero di copie non valido.`);
  if(!Number.isInteger(s.colorPages)||s.colorPages<0||s.colorPages>s.pages)errors.push(`Titolo ${i+1}: gli inserti colore non possono superare le pagine totali.`);
  if((s.print==='Bianco e nero'&&s.colorPages!==0)||(s.print==='Bianco e nero con inserti a colori'&&s.colorPages<1)||!['Bianco e nero','Bianco e nero con inserti a colori'].includes(s.print))errors.push(`Titolo ${i+1}: verifica stampa e inserti colore.`);
 });
 if(errors.length)return {price:null,errors};
 const items=books.map(s=>{
  const baseUnit=kind==='sample'?(s.colorPages>0?45:30):baseBookUnit(s);
  const discountPercent=kind==='sample'?0:DISCOUNTS.filter(t=>s.copies>=t.from).at(-1)!.percent;
  const net=cents(baseUnit*s.copies*(1-discountPercent/100));
  return {title:s.title,copies:s.copies,baseUnit,discountPercent,unitNet:Number((net/s.copies).toFixed(8)),net};
 });
 const minimumFee=kind==='sample'?0:books.some(s=>s.copies<20)?(kind==='mixed'?50:30):0;
 const printNet=cents(items.reduce((n,i)=>n+i.net,0)),shippingNet=shipments*5;
 return {price:{version:PRICE_VERSION,items,printNet,minimumFee,shippingNet,shipments,totalNet:cents(printNet+minimumFee+shippingNet),vatIncluded:false},errors:[]};
}
