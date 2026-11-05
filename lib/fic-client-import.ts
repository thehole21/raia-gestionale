import {type Store,type Client} from './data';
type FicClient={id:number;name:string;vat_number?:string;tax_code?:string;email?:string;phone?:string;address_street?:string;address_postal_code?:string;address_city?:string;address_province?:string;country?:string;certified_email?:string;ei_code?:string};
const norm=(s?:string)=>s?.trim().toLocaleLowerCase('it').replace(/[^a-z0-9]/g,'')||'';
export function replaceFicClients(store:Store,source:FicClient[],companyId:number):Store{
 if(!source.length)throw Error('Anagrafica vuota: nessuna sostituzione effettuata.');
 if(source.some(c=>!Number.isSafeInteger(c.id)||!c.name?.trim())||new Set(source.map(c=>c.id)).size!==source.length)throw Error('Anagrafica incompleta o duplicata: importazione annullata.');
 const old=[...(store.clientHistory||[]),...store.clients],mapping=new Map<string,string>();
 const clients:Client[]=source.map(c=>({id:'fic_'+companyId+'_'+c.id,ficEntityId:c.id,ficSnapshot:{...c},ficCompanyId:companyId,name:c.name,email:c.email||'',phone:c.phone||'',vat:c.vat_number||'',taxCode:c.tax_code||'',address:c.address_street||'',postalCode:c.address_postal_code||'',city:c.address_city||'',province:c.address_province||'',country:c.country||'',pec:c.certified_email||'',recipientCode:c.ei_code||''}));
 for(const c of old){let candidates=clients.filter(n=>c.ficEntityId===n.ficEntityId&&c.ficEntityId!==undefined&&(c.ficCompanyId===companyId||c.ficCompanyId===undefined));if(!candidates.length)candidates=clients.filter(n=>(norm(c.vat)&&norm(c.vat)===norm(n.vat))||(norm(c.taxCode)&&norm(c.taxCode)===norm(n.taxCode)));if(!candidates.length)candidates=clients.filter(n=>norm(c.name)===norm(n.name)&&!(norm(c.vat)&&norm(n.vat)&&norm(c.vat)!==norm(n.vat))&&!(norm(c.taxCode)&&norm(n.taxCode)&&norm(c.taxCode)!==norm(n.taxCode)));if(candidates.length===1)mapping.set(c.id,candidates[0].id);}
 const activeIds=new Set(clients.map(c=>c.id));const history=[...new Map(old.filter(c=>!activeIds.has(c.id)).map(c=>{const target=clients.find(n=>n.id===mapping.get(c.id));return [c.id,target?{...target,id:c.id}:c] as const;})).values()];
 return {...store,clients,clientHistory:history,orders:store.orders.map(o=>({...o,clientId:mapping.get(o.clientId)||o.clientId})),drafts:store.drafts.map(d=>({...d,clientId:mapping.get(d.clientId)||d.clientId}))};
}
