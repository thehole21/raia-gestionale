import {type Store,type Work,type Order,type SourceRecord,type Production,STATUSES} from './data';

export type InputSheet={sheet:string;rows:{row:number;values:unknown[];comments?:Record<string,string>}[]};
const months=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const text=(v:unknown)=>v==null?'':String(v).trim();
const norm=(v:unknown)=>text(v).toLocaleLowerCase('it').replace(/\s+/g,' ');
const clientKey=(v:unknown)=>norm(v).replace(/\s+/g,'');
const key=(v:string)=>encodeURIComponent(v);
function date(v:unknown):string{
 if(v instanceof Date)return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
 const s=text(v),m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
 const iso=m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:/^\d{4}-\d{2}-\d{2}$/.test(s)?s:'';
 if(!iso)return '';
 const d=new Date(iso+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===iso?iso:'';
}
const sourceKey=(s:SourceRecord)=>`programmazione:${norm(s.sheet)}:${s.row}`;
export function prepareWorkbookImport(store:Store,sheets:InputSheet[]){
 const next:Store=structuredClone(store),errors:string[]=[],warnings:string[]=[];
 let added=0,duplicates=0,linked=0,changed=0;
 const originalIds=new Set(store.orders.flatMap(o=>o.lines.map(l=>l.id)));
 const all=next.orders.flatMap(order=>order.lines.map(line=>({order,line})));
 const consumed=new Set<string>();
 const usedIds=new Set(all.map(x=>x.line.id));
 const identity=(client:string,entry:string,description:string,books:boolean)=>JSON.stringify([clientKey(client),entry,norm(description),books?'Libri':'Lavori']);
 const snapshots=(line:Work)=>[line.source,...(line.sourceHistory||[])].filter((x):x is SourceRecord=>!!x);
 const sourceIdentity=(source:SourceRecord,order:Order)=>{
  const b=/^libri\b/i.test(source.sheet),v=source.values;
  const originalClient=text(v[b?1:2]);
  return source.identity||identity((!b&&/^EVENTO\b/i.test(originalClient)?'':originalClient)||next.clients.find(c=>c.id===order.clientId)?.name||'',date(v[b?2:1])||order.created,text(v[b?4:3]),b);
 };
 const comparable=(values:unknown[])=>JSON.stringify(values.slice(3).map(v=>typeof v==='boolean'?v:norm(v)));
 const signature=(values:unknown[],books:boolean)=>JSON.stringify([norm(values[books?5:4]),norm(values[books?12:9]).replace(/\s/g,''),books?norm(values[0]):'']);
 const periods=new Set(next.planningPeriods||[]);
 const registers=next.productionRegisters||[];
 const touched=new Set<string>();
 for(const sheet of sheets){
  const books=/^libri\b/i.test(sheet.sheet),year=sheet.sheet.match(/\b20\d{2}\b/)?.[0];
  const month=months.findIndex(m=>norm(sheet.sheet).includes(m))+1;
  if(!year||(!books&&!month)){errors.push(`Foglio non riconosciuto: ${sheet.sheet}`);continue;}
  const sheetPeriods=new Set<string>();
  let period=books?'':`${year}-${String(month).padStart(2,'0')}`;
  if(period)sheetPeriods.add(period);
  if(period)periods.add(period);
  let prevClient='',prevDate='',block=0,section='';
  let headers:unknown[]=[];
  const notes:{row:number;values:unknown[];comments?:Record<string,string>}[]=[];
  const byRow=new Map(sheet.rows.map(r=>[r.row,r]));
  const max=Math.max(...sheet.rows.map(r=>r.row),0);
  for(let i=1;i<=max;i++){
   const row=byRow.get(i),v=row?.values||[];
   const serialized=v.map(x=>x instanceof Date?date(x):x);
   if(!v.some(x=>text(x)&&typeof x!=='boolean')){prevClient='';prevDate='';block=i;section='';continue;}
   const header=books?norm(v[4])==='titolo lavoro':norm(v[1])==='entrata'&&norm(v[3])==='lavoro';
   if(header){headers=v;prevClient='';prevDate='';block=i;if(row?.comments&&Object.keys(row.comments).length)notes.push({...row,values:serialized});continue;}
   if(books&&date(v[1])&&!v[4]){period=date(v[1]).slice(0,7);periods.add(period);sheetPeriods.add(period);prevClient='';prevDate='';block=i;continue;}
   const ci=books?1:2,di=books?2:1,wi=books?4:3,qi=books?5:4,oi=books?6:5;
   const desc=text(v[wi]),explicit=text(v[ci]);
   const operational=[v[qi],v[oi],v[7],v[books?9:8],v[books?12:9],v[books?13:10],v[books?15:12]].some(x=>text(x));
   const heading=!books&&desc&&!v[di]&&!operational&&/^(EVENTO\b|SPOSTATO\b|\d+\s*CONGRESSO\b)/i.test(desc);
   if(!desc||heading){
    notes.push({row:i,values:serialized,comments:row?.comments});
    if(heading){section=[section,desc].filter(Boolean).join(' · ');if(explicit){prevClient=explicit;prevDate='';block=i;}}
    continue;
   }
   const eventLabel=!books&&/^EVENTO\b/i.test(explicit)&&prevClient;
   if(eventLabel)section=explicit;
   const clientName=eventLabel?prevClient:explicit||prevClient;
   const sameClient=!explicit||eventLabel||clientKey(explicit)===clientKey(prevClient);
   const entry=date(v[di])||(sameClient?prevDate:'');
   if(!clientName){errors.push(`${sheet.sheet}, riga ${i}: cliente non identificabile.`);continue;}
   if(!sameClient)block=i;
   prevClient=clientName;prevDate=entry;
   if(!period){errors.push(`${sheet.sheet}, riga ${i}: mese non identificabile.`);continue;}
   const source:SourceRecord={sheet:sheet.sheet,row:i,values:serialized,headers:headers.map((h,j)=>text(h)||`Colonna ${j+1}`),comments:row?.comments};
   const importKey=sourceKey(source);
   source.identity=identity(clientName,entry,desc,books);
   const sameSheet=all.filter(x=>!consumed.has(norm(sheet.sheet)+'|'+x.line.id)&&snapshots(x.line).some(h=>norm(h.sheet)===norm(sheet.sheet)&&sourceIdentity(h,x.order)===source.identity));
   const exact=sameSheet.filter(x=>snapshots(x.line).some(h=>norm(h.sheet)===norm(sheet.sheet)&&sourceIdentity(h,x.order)===source.identity&&signature(h.values,books)===signature(serialized,books)));
   const reserved=sameSheet.filter(x=>snapshots(x.line).some(old=>norm(old.sheet)===norm(sheet.sheet)&&sheet.rows.some(future=>{
     if(future.row<=i)return false;const f=future.values;
     return norm(f[wi])===norm(desc)&&(!text(f[ci])||clientKey(f[ci])===clientKey(clientName))&&(!date(f[di])||date(f[di])===entry)&&signature(f,books)===signature(old.values,books);
    })));
   const matches=exact.length?exact:sameSheet.filter(x=>!reserved.includes(x));
   if(matches.length){
    // Consume occurrences one by one: two genuinely identical rows remain two jobs.
    // If several different jobs share the identity, an edited row cannot be assigned safely.
    if(!exact.length&&matches.length>1){errors.push(`${sheet.sheet}, riga ${i}: più lavori simili già presenti. Verifica copie e DDT per identificare la riga.`);continue;}
    const target=matches[0];consumed.add(norm(sheet.sheet)+'|'+target.line.id);duplicates++;
    const old=snapshots(target.line).filter(h=>norm(h.sheet)===norm(sheet.sheet)&&sourceIdentity(h,target.order)===source.identity);
    if(!old.some(h=>comparable(h.values)===comparable(serialized))){changed++;warnings.push(`${sheet.sheet}, riga ${i}: lavoro già presente con dati diversi; conservati i dati del gestionale.`);}
    continue;
   }
   const process=text(v[7]),status=STATUSES.find(s=>norm(s)===norm(process))||'Da elaborare';
   if(process&&!STATUSES.some(s=>norm(s)===norm(process))){errors.push(`${sheet.sheet}, riga ${i}: processo non riconosciuto «${process}».`);continue;}
   let client=next.clients.find(c=>clientKey(c.name)===clientKey(clientName));
   if(!client){client={id:'excel_client_'+key(clientKey(clientName)),name:clientName,email:'',phone:'',vat:'',city:''};next.clients.push(client);}
   const operatorName=text(v[oi]);let operator=next.operators.find(o=>norm(o.name)===norm(operatorName));
   if(operatorName&&!operator){operator=next.operatorHistory?.find(o=>norm(o.name)===norm(operatorName))||{id:'excel_operator_'+key(norm(operatorName)),name:operatorName};next.operatorHistory??=[];if(!next.operatorHistory.some(o=>o.id===operator!.id))next.operatorHistory.push(operator);}
   const rawQty=v[qi],quantity=text(rawQty),qty=typeof rawQty==='number'?rawQty:/^\d+(?:[.,]\d+)?$/.test(quantity)?Number(quantity.replace(',','.')):0;
   const due=v[books?9:8];
   const production:Production={quantity,priceUnspecified:true,supplier:books?'':text(v[6]),requestedDate:date(due),requestedText:date(due)?'':text(due),ddtNumber:text(v[books?12:9]),delivery:text(v[books?13:10]),terminated:v[books?14:11]===true,invoicing:text(v[books?15:12]),planningMonths:[period],category:books?'Libri':'Lavori',section,
    ...(books?{bookNumber:text(v[0]),entryTime:text(v[3]),exitTime:text(v[11]),urgent:v[10]===true,comments:text(v[8])}:{}),
    additionalNotes:!books?v.slice(13).map((x,j)=>text(x)?`Colonna ${j+14}: ${text(x)}`:'').filter(Boolean).join('\n'):''};
   const line:Work={id:`excel_${key(norm(sheet.sheet))}_row_${i}`,importKey,description:desc,qty,unit:'pz',price:0,status,operatorId:operator?.id||'',invoiceId:null,notes:'',production,source};
   while(usedIds.has(line.id))line.id+='_new';
   // Link only unambiguous carry-overs: same client, entry date, description and compatible DDT,
   // from a different monthly register. Repeated rows within one sheet stay separate.
   const candidates=entry?all.filter(x=>x.order.clientId===client!.id&&x.order.created===entry&&norm(x.line.description)===norm(desc)&&
    x.line.source&&norm(x.line.source.sheet)!==norm(sheet.sheet)&&
    !consumed.has(norm(sheet.sheet)+'|'+x.line.id)&&
    !(x.line.sourceHistory||[]).some(h=>norm(h.sheet)===norm(sheet.sheet))&&
    (!x.line.production?.ddtNumber||!production.ddtNumber||norm(x.line.production.ddtNumber).replace(/\s/g,'')===norm(production.ddtNumber).replace(/\s/g,''))&&
    (x.line.production?.category||'Lavori')===production.category):[];
   if(candidates.length===1){
    const target=candidates[0],old=target.line;
    const history=[...(old.sourceHistory||[]),old.source!,source].filter((a,j,aList)=>aList.findIndex(b=>sourceKey(a)===sourceKey(b))===j);
    const mergedPeriods=[...new Set([...(old.production?.planningMonths||[target.order.planningMonth||target.order.created.slice(0,7)]),period])].sort();
    const latest=mergedPeriods.at(-1);
    if(!originalIds.has(old.id)&&latest===period){
     const keep={id:old.id,importKey:old.importKey};Object.assign(old,line,keep);
    }
    old.sourceHistory=history;
    old.production={...old.production!,planningMonths:mergedPeriods};
    linked++;consumed.add(norm(sheet.sheet)+'|'+old.id);continue;
   }
   if(candidates.length>1)warnings.push(`${sheet.sheet}, riga ${i}: più corrispondenze possibili, mantenuta separata.`);
   const orderId=`excel_${key(norm(sheet.sheet))}_${key(client.id)}_${entry||'senza-data-'+block}`;
   let order=next.orders.find(o=>o.id===orderId);
   if(!order){order={id:orderId,number:`${books?'LIB':sheet.sheet.slice(0,3).toUpperCase()}-${year}-${String(i).padStart(3,'0')}`,clientId:client.id,created:entry,executionDate:'',due:'',notes:'',planningMonth:period,lines:[]};next.orders.push(order);}
   if(!entry)warnings.push(`${sheet.sheet}, riga ${i}: data d’entrata assente, lasciata non precisata.`);
   order.lines.push(line);all.push({order,line});usedIds.add(line.id);consumed.add(norm(sheet.sheet)+'|'+line.id);touched.add(order.id);added++;
  }
  const register={sheet:sheet.sheet,periods:[...sheetPeriods].sort(),notes};
  const index=registers.findIndex(r=>r.sheet===sheet.sheet);
  if(index>=0)registers[index]=register;else registers.push(register);
 }
 for(const order of next.orders.filter(o=>touched.has(o.id))){
  const dues=[...new Set(order.lines.map(l=>l.production?.requestedDate||'').filter(Boolean))];
  order.due=dues.length===1?dues[0]:'';
  const ddts=[...new Set(order.lines.map(l=>l.production?.ddtNumber||'').filter(Boolean))];
  if(ddts.length===1)order.ddt={number:ddts[0],date:''};
 }
 next.planningPeriods=[...periods].sort();next.productionRegisters=registers;
 return {next,added,duplicates,linked,changed,errors,warnings};
}
