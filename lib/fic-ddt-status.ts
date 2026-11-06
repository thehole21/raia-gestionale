// merged_in is returned by the documented detailed IssuedDocument fieldset.
// Missing/unrecognised data is unknown, never silently treated as not invoiced.
export function ddtInvoiceLink(document:any):{state:'unbilled'|'linked'|'unknown';id?:number}{
 if(!Object.hasOwn(document,'merged_in'))return {state:'unknown'};
 const link=document.merged_in;
 if(link===null||Array.isArray(link)&&link.length===0)return {state:'unbilled'};
 const value=Array.isArray(link)&&link.length===1?link[0]:link;
 const raw=typeof value==='object'&&value!==null?value.id:value;
 const id=typeof raw==='number'?raw:typeof raw==='string'&&/^\d+$/.test(raw)?Number(raw):NaN;
 return Number.isSafeInteger(id)&&id>0?{state:'linked',id}:{state:'unknown'};
}
