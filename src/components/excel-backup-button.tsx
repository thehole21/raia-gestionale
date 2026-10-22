'use client';
import {useState} from 'react';
import {Download} from 'lucide-react';
import {type Store,today} from '@/lib/data';
import {cloud} from '@/lib/supabase';
import type {ArchivedOrder} from '@/lib/excel-backup';
export function ExcelBackupButton({store,demo,pending}:{store:Store;demo:boolean;pending:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function exportExcel(){
  setBusy(true);setError('');
  try{
   const archived:ArchivedOrder[]=[];
   if(!demo)for(let offset=0;;offset+=500){const {data,error}=await cloud().from('raia_deleted_orders').select('id,order_data,client_data,actor_name,deleted_at').order('id').range(offset,offset+499);if(error)throw Error('Impossibile leggere gli ordini annullati. Riprova per ottenere un backup completo.');archived.push(...data);if(data.length<500)break;}
   const [{buildExcelBackup},XLSX]=await Promise.all([import('@/lib/excel-backup'),import('xlsx')]);
   XLSX.writeFile(buildExcelBackup(store,archived),'Programmazione lavori - backup '+today()+'.xlsx',{compression:true});
  }catch(e){setError(e instanceof Error?e.message:'Esportazione non riuscita.');}finally{setBusy(false);}
 }
 return <><button type="button" className="btn btn-plain" disabled={busy||pending} onClick={exportExcel}><Download size={17}/>{busy?'Preparazione Excel…':'Esporta backup Excel'}</button>{error&&<p role="alert" className="error-text">{error}</p>}</>;
}
