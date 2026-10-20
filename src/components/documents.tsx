'use client';
import { useEffect, useState } from 'react';
import { Upload, Download, Trash2, FileText } from 'lucide-react';
import { cloud } from '@/lib/supabase';
import { useAccess } from './access';
type Doc = { key: string; name: string; blob?: Blob };
function local(action: 'list'|'put'|'delete', key: string, value?: Doc): Promise<Doc[]> {
 return new Promise((resolve,reject) => {
  const open=indexedDB.open('raia-documents-demo',1);
  open.onupgradeneeded=()=>open.result.createObjectStore('files',{keyPath:'key'});
  open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{ const db=open.result; const tx=db.transaction('files',action==='list'?'readonly':'readwrite'); const store=tx.objectStore('files');
   const req=action==='list'?store.getAll():action==='put'?store.put(value):store.delete(key);
   tx.oncomplete=()=>{ resolve(action==='list'?(req.result as Doc[]).filter(d=>d.key.startsWith(key)):[]); db.close(); }; tx.onerror=()=>{reject(tx.error);db.close();};
  };
 });
}
export function Documents({ orderId }: {orderId:string}) {
 const {demo,profile}=useAccess(); const [docs,setDocs]=useState<Doc[]>([]);const [selected,setSelected]=useState<Doc|null>(null); const [url,setUrl]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const prefix=orderId+'/';
 async function load(){
  if(demo) return local('list',prefix);
  const {data,error}=await cloud().storage.from('raia-documents').list(orderId,{limit:1000});if(error)throw error;
  return (data||[]).filter(d=>d.id).map(d=>({key:prefix+d.name,name:decodeURIComponent(d.name.split('--').slice(1).join('--')||d.name)}));
 }
 useEffect(()=>{let live=true;setDocs([]);setSelected(null);setError('');load().then(items=>{if(live){setDocs(items);setSelected(items[0]||null);}}).catch(()=>{if(live)setError('Impossibile caricare gli allegati.');});return()=>{live=false;};},[orderId,demo]);
 useEffect(()=>{let live=true;let objectUrl='';setUrl('');if(!selected)return;
  (async()=>{let blob=selected.blob;if(!blob){const {data,error}=await cloud().storage.from('raia-documents').download(selected.key);if(error)throw error;blob=data;}if(live){objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}})().catch(()=>{if(live)setError('Impossibile aprire il PDF. Riprova.');});
  return()=>{live=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[selected]);
 async function upload(file?:File){if(!file)return;setBusy(true);setError('');try{
  if(file.size>20*1024*1024 || !file.name.toLowerCase().endsWith('.pdf') || !new TextDecoder().decode(await file.slice(0,5).arrayBuffer()).startsWith('%PDF-'))throw new Error('Seleziona un PDF valido, fino a 20 MB.');
  const key=prefix+crypto.randomUUID()+'--'+encodeURIComponent(file.name);const doc={key,name:file.name,blob:file};
  if(demo)await local('put',key,doc);else {const {error}=await cloud().storage.from('raia-documents').upload(key,file,{contentType:'application/pdf',upsert:false});if(error)throw error;}
  setDocs(await load());setSelected(doc);
 }catch(e){setError(e instanceof Error?e.message:'Caricamento non riuscito.');}finally{setBusy(false);}}
 return <section className="documents"><div className="document-heading"><div><h3>Documenti</h3><p>PDF del lavoro · massimo 20 MB per file</p></div><label className="btn btn-plain"><Upload size={16}/>{busy?'Caricamento…':'Carica PDF'}<input aria-label="Carica PDF" type="file" accept="application/pdf,.pdf" hidden disabled={busy} onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/></label></div>{error&&<p role="alert" className="error-text">{error}</p>}{docs.length?<><div className="pdf-toolbar"><select aria-label="Documento da visualizzare" value={selected?.key||''} onChange={e=>setSelected(docs.find(d=>d.key===e.target.value)||null)}>{docs.map(d=><option key={d.key} value={d.key}>{d.name}</option>)}</select>{url&&<a className="btn btn-plain" href={url} download={selected?.name}><Download size={16}/>Scarica</a>}{profile.role==='admin'&&selected&&<button type="button" className="icon-btn" aria-label="Elimina PDF" disabled={busy} onClick={async()=>{if(!confirm('Eliminare questo PDF?'))return;setBusy(true);try{if(demo)await local('delete',selected.key);else{const {error}=await cloud().storage.from('raia-documents').remove([selected.key]);if(error)throw error;}const items=await load();setDocs(items);setSelected(items[0]||null);}catch{setError('Eliminazione non riuscita.');}finally{setBusy(false);}}}><Trash2 size={16}/></button>}</div>{url?<iframe className="pdf-viewer" title={'Anteprima '+selected?.name} src={url+'#toolbar=1&navpanes=0'} />:<p>Apertura documento…</p>}</>:<div className="document-empty"><FileText size={24}/><span>Nessun documento allegato</span><small>Carica il primo PDF: verrà aperto qui.</small></div>}{demo&&<small>Allegati salvati solo su questo dispositivo, separatamente dal backup JSON.</small>}</section>;
}
