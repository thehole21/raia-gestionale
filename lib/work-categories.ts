import {type Work,type Order,type Production} from './data';
export type WorkCategory='general'|'books';
export const BOOK_DELIVERIES=['GLS cliente','BRT da cliente','misto panella e brt','PANELLA','NOI','SNC TRASPORTI','Ritirano'] as const;
export function workCategory(work:Work,order?:Order):WorkCategory {
 if(work.production?.category)return work.production.category==='Libri'?'books':'general';
 return /^libri\b/i.test(work.source?.sheet||'')||!!order?.customerRequestId?'books':'general';
}
export function bookProduction(work:Partial<Work>,order?:Order):Production {
 return {quantity:String(work.qty??''),priceUnspecified:false,supplier:'',requestedDate:order?.due||'',requestedText:'',ddtNumber:'',delivery:'',terminated:['Pronto','Consegnato'].includes(work.status||''),invoicing:'',...work.production,category:'Libri'};
}
