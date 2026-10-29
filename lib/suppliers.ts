import {id,type Store} from './data';
export type Supplier={id:string;name:string;email:string;phone:string;notes:string;active:boolean};
export const supplierKey=(name:string)=>name.trim().replace(/\s+/g,' ').toLocaleLowerCase('it');
const initialNames=["ADSystem", "AGL Print", "ArkDisplay", "BERNI", "Brizzi", "Burgo", "CARTOPLST", "CSC etichette", "Cartoplast", "D.&.S grafica", "DAMADA", "DM Packaging", "Digitalflag", "Eurmoma", "Fotolito Moggio", "Grafiche Ripoli", "IMACO", "IMMAGINA", "In casa", "InVolo", "La moderna", "Makito", "PIXART", "PRT VISUAL", "Polyedra", "Promit", "RC allestimenti", "Realisaprint", "Realisaprint, più fornitori", "Roly", "SILAN", "Stamina", "Ultimadisplay", "Valento", "più fornitori", "silver print"];
export const initialSuppliers:Supplier[]=initialNames.map((name,i)=>({id:'supplier-excel-2026-'+i,name,email:'',phone:'',notes:'',active:true}));
export function suppliersOf(store:Store):Supplier[]{return store.suppliers??initialSuppliers;}
export function saveSupplier(store:Store,value:Supplier):Store{
 const list=suppliersOf(store),name=value.name.trim().replace(/\s+/g,' ');
 if(!name)throw new Error('Inserisci il nome del fornitore.');
 if(list.some(s=>s.id!==value.id&&supplierKey(s.name)===supplierKey(name)))throw new Error('Questo fornitore esiste già, anche tra quelli rimossi.');
 const previous=list.find(s=>s.id===value.id),next={...value,name,id:value.id||id()};
 return {...store,suppliers:previous?list.map(s=>s.id===next.id?next:s):[...list,next],orders:previous&&previous.name!==name?store.orders.map(o=>({...o,lines:o.lines.map(w=>w.production&&supplierKey(w.production.supplier)===supplierKey(previous.name)?{...w,production:{...w.production,supplier:name}}:w)})):store.orders};
}
