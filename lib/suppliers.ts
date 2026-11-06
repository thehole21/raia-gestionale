import {supplierNames} from './assignments';
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
 return {...store,suppliers:previous?list.map(s=>s.id===next.id?next:s):[...list,next],orders:previous&&previous.name!==name?store.orders.map(o=>({...o,lines:o.lines.map(w=>w.production&&supplierNames(w.production.supplier).some(n=>supplierKey(n)===supplierKey(previous.name))?{...w,production:{...w.production,supplier:supplierNames(w.production.supplier).map(n=>supplierKey(n)===supplierKey(previous.name)?name:n).join('; ')}}:w)})):store.orders};
}

// Match spelling variants without changing the stored or displayed supplier names.
const colorKey=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('it').replace(/[^a-z0-9]/g,'');
const supplierGroups=[
 {label:'Grigio',background:'#777e87',foreground:'#ffffff',names:['Più fornitori']},
 {label:'Rosso',background:'#b72d35',foreground:'#ffffff',names:['silver print','d&s grafica','agl print','realisaprint','la moderna','grafiche ripoli','csc etichette','in volo','dm packaging']},
 {label:'Grigio chiaro',background:'#e3e6ea',foreground:'#20252c',names:['digital flag','prt visual','ultima display']},
 {label:'Giallo',background:'#f2cd48',foreground:'#252115',names:['berni','brizzi','polyedra','burgo']},
 {label:'Grigio chiaro',background:'#e3e6ea',foreground:'#20252c',names:['eurmoma','ark display']},
 {label:'Blu',background:'#164c92',foreground:'#ffffff',names:['makito','stamina','roly','valento','imaco','promit']},
 {label:'In Casa',background:'#399eff',foreground:'#101c2b',names:['In Casa']},
];
export function supplierAppearance(name:string){
 const key=colorKey(name);
 for(let group=0;group<supplierGroups.length;group++){const spec=supplierGroups[group],position=spec.names.findIndex(n=>colorKey(n)===key);if(position>=0)return {group:String(group),groupLabel:spec.label,background:spec.background,foreground:spec.foreground,rank:group*100+position};}
 return {group:'other',groupLabel:'Altri fornitori',background:'#f4f3f5',foreground:'#38353b',rank:10000};
}
export function sortSuppliers(suppliers:Supplier[]):Supplier[]{return [...suppliers].sort((a,b)=>supplierAppearance(a.name).rank-supplierAppearance(b.name).rank);}
