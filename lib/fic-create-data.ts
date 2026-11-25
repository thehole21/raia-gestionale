export function freshDocumentData(document:any){
 const withoutId=(row:any)=>{const {id,...rest}=row;return rest;};
 return {...document,...(document.items_list?{items_list:document.items_list.map(withoutId)}:{}),...(document.payments_list?{payments_list:document.payments_list.map(withoutId)}:{})};
}
export function ficValidationMessage(result:any){
 const details=result?.error?.validation_result;
 const messages:string[]=[];
 const collect=(v:any)=>{if(typeof v==='string')messages.push(v);else if(Array.isArray(v))v.forEach(collect);else if(v&&typeof v==='object')Object.entries(v).forEach(([key,value])=>{if(typeof value==='string')messages.push(key+': '+value);else collect(value);});};
 collect(details);
 return [result?.error?.message||'Documento rifiutato da Fatture in Cloud.',...messages.slice(0,8)].join(' · ');
}
