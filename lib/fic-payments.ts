export function applyPaymentTerms(document:any,previous?:any){
 return {...document,payments_list:(document.payments_list||[]).map((payment:any,i:number)=>{
  const days=payment.payment_terms?.days,old=previous?.payments_list?.[i];
  if(payment.status==='paid'||!Number.isInteger(days)||days<0||!/^\d{4}-\d{2}-\d{2}$/.test(document.date||''))return payment;
  const changed=previous&&(document.date!==previous.date||JSON.stringify(payment.payment_terms)!==JSON.stringify(old?.payment_terms));
  if(payment.due_date&&!changed)return payment;
  const date=new Date(document.date+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);
  if(payment.payment_terms?.type==='end_of_month')date.setUTCMonth(date.getUTCMonth()+1,0);
  return {...payment,due_date:date.toISOString().slice(0,10)};
 })};
}
// Use the amount due calculated by Fatture in Cloud; never recalculate VAT locally.
export function reconcilePayments(document:any,amountDue:unknown){
 if(!['invoice','receipt','proforma'].includes(document.type))return document;
 if(typeof amountDue!=='number'||!Number.isFinite(amountDue)||amountDue<0)throw Error('Totale da pagare non valido restituito da Fatture in Cloud.');
 const cents=(n:number)=>Math.round(n*100),target=cents(amountDue);
 const payments=(document.payments_list||[]).map((p:any)=>({...p}));
 if(payments.some((p:any)=>typeof p.amount!=='number'||!Number.isFinite(p.amount)||p.amount<0))throw Error('Controlla gli importi delle scadenze di pagamento.');
 const sum=payments.reduce((n:number,p:any)=>n+cents(p.amount),0),difference=target-sum;
 if(!difference)return document;
 if(!payments.length)payments.push({amount:target/100,due_date:document.date,status:'not_paid'});
 else{
  let index=-1;for(let i=payments.length-1;i>=0;i--)if(!payments[i].status||payments[i].status==='not_paid'){index=i;break;}
  if(index<0||cents(payments[index].amount)+difference<0)throw Error('Il totale delle scadenze non coincide con la fattura. Correggi i pagamenti: gli importi già pagati non vengono modificati automaticamente.');
  payments[index].amount=(cents(payments[index].amount)+difference)/100;
 }
 return {...document,payments_list:payments};
}
