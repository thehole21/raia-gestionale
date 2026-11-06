import {ficGet,FicError} from './fic-server';
import type {Client} from './data';
export async function searchFicClients(token:string,company:number,params:URLSearchParams){
 const page=Number(params.get('page')||1);
 if(!Number.isSafeInteger(page)||page<1||page>10000)throw new FicError('Pagina non valida.');
 const tokens=(params.get('search')||'').slice(0,120).match(/[\p{L}\p{N}]+/gu)||[];
 const query=tokens.map(t=>`(name contains '${t}' or vat_number contains '${t}' or tax_code contains '${t}')`).join(' and ');
 return ficGet(token,`/c/${company}/entities/clients?per_page=50&page=${page}&fieldset=detailed${query?'&q='+encodeURIComponent(query):''}`);
}
export async function resolveFicClient(token:string,company:number,client?:Client){
 if(!client)return null;
 if(client.ficEntityId&&(!client.ficCompanyId||client.ficCompanyId===company))return (await ficGet(token,`/c/${company}/entities/clients/${client.ficEntityId}`)).data;
 // Local clients are never matched implicitly to a fiscal entity.
 return null;
}
