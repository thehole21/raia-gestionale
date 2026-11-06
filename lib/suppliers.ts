import {supplierNames} from './assignments';
import {id,type Store} from './data';
export type Supplier={id:string;name:string;email:string;phone:string;notes:string;active:boolean;color?:string};
export const supplierKey=(name:string)=>name.trim().replace(/\s+/g,' ').toLocaleLowerCase('it');
const initialNames=["ADSystem", "AGL Print", "ArkDisplay", "BERNI", "Brizzi", "Burgo", "CARTOPLST", "CSC etichette", "Cartoplast", "D.&.S grafica", "DAMADA", "DM Packaging", "Digitalflag", "Eurmoma", "Fotolito Moggio", "Grafiche Ripoli", "IMACO", "IMMAGINA", "In casa", "InVolo", "La moderna", "Makito", "PIXART", "PRT VISUAL", "Polyedra", "Promit", "RC allestimenti", "Realisaprint", "Realisaprint, più fornitori", "Roly", "SILAN", "Stamina", "Ultimadisplay", "Valento", "più fornitori", "silver print"];
export const initialSuppliers:Supplier[]=initialNames.map((name,i)=>({id:'supplier-excel-2026-'+i,name,email:'',phone:'',notes:'',active:true}));
export function suppliersOf(store:Store):Supplier[]{return store.suppliers??initialSuppliers;}
export function saveSupplier(store:Store,value:Supplier):Store{
 const list=suppliersOf(store),name=value.name.trim().replace(/\s+/g,' ');
 if(!name)throw new Error('Inserisci il nome del fornitore.');
 if(list.some(s=>s.id!==value.id&&supplierKey(s.name)===supplierKey(name)))throw new Error('Questo fornitore esiste già, anche tra quelli rimossi.');
 if(value.color&&!/^#[0-9a-f]{6}$/i.test(value.color))throw new Error('Scegli un colore valido.');
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
const otherAppearance={group:'other',groupLabel:'Altri fornitori',background:'#f4f3f5',foreground:'#38353b',rank:10000};
const appearanceByName=new Map(supplierGroups.flatMap((spec,group)=>spec.names.map((name,position)=>[colorKey(name),{group:String(group),groupLabel:spec.label,background:spec.background,foreground:spec.foreground,rank:group*100+position}] as const)));
export function supplierAppearance(value:string|Supplier){
 const name=typeof value==='string'?value:value.name;
 const original=appearanceByName.get(colorKey(name))||otherAppearance;
 const background=(typeof value!=='string'&&value.color?value.color:original.background).toLowerCase();
 const preset=supplierGroups.find(g=>g.background===background);
 const rgb=[1,3,5].map(i=>parseInt(background.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const luminance=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
 const foreground=preset?.foreground||(luminance>.179?'#20252c':'#ffffff');
 return {group:background,groupLabel:preset?.label||(background===otherAppearance.background?'Altri fornitori':'Colore '+background.toUpperCase()),background,foreground,rank:preset?supplierGroups.indexOf(preset)*100:10000,position:original.rank};
}
export function sortSuppliers(suppliers:Supplier[]):Supplier[]{return [...suppliers].sort((a,b)=>{const x=supplierAppearance(a),y=supplierAppearance(b);return x.rank-y.rank||x.group.localeCompare(y.group)||x.position-y.position;});}
export function supplierColorGroups(suppliers:Supplier[]){return [...new Map(sortSuppliers([...initialSuppliers,...suppliers]).map(s=>{const a=supplierAppearance(s);return [a.group,a] as const;})).values()];}

type SupplierOption={id:string;name:string}&ReturnType<typeof supplierAppearance>;
const optionCache=new WeakMap<Supplier[],SupplierOption[]>();
export function supplierOptions(suppliers:Supplier[]):SupplierOption[]{
 const cached=optionCache.get(suppliers);if(cached)return cached;
 const options=sortSuppliers(suppliers.filter(s=>s.active)).map(s=>({id:s.name,name:s.name,...supplierAppearance(s)}));
 optionCache.set(suppliers,options);return options;
}
