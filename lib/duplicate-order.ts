import {id,today,type Order,type Store} from './data';
export function duplicateOrder(source:Order,operators:Store['operators']):Order{
 return {id:id(),number:'',title:source.title||'',clientId:'',created:today(),executionDate:'',due:'',notes:source.notes,lines:source.lines.map(w=>({
  id:id(),description:w.description,commercialDescription:w.commercialDescription,qty:w.qty,unit:w.unit,price:w.price,status:'Da elaborare',operatorId:'',operatorIds:[],invoiceId:null,
  notes:w.notes,notesRight:w.notesRight||'',technical:structuredClone(w.technical||{}),
  ...(w.production?{production:{quantity:w.production.quantity,priceUnspecified:w.production.priceUnspecified,supplier:w.production.supplier,requestedDate:'',requestedText:'',ddtNumber:'',delivery:w.production.delivery,terminated:false,invoicing:'',category:w.production.category,comments:w.production.comments||'',additionalNotes:w.production.additionalNotes||''}}:{})
 }))};
}
