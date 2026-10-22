import type {SupabaseClient} from '@supabase/supabase-js';
import type {BookSpec} from './portal';
export async function validPdf(file:File){return file.size<=20*1024*1024&&new TextDecoder().decode(await file.slice(0,5).arrayBuffer())==='%PDF-';}
export async function uploadExtraBooks(client:SupabaseClient,userId:string,rid:string,spec:BookSpec,files:Record<number,{book?:File;cover?:File}>){
 const additionalBooks=[];
 for(const [i,item] of (spec.additionalBooks||[]).entries()){
  const paths={book:userId+'/'+rid+'/extra-'+i+'-book.pdf',cover:userId+'/'+rid+'/extra-'+i+'-cover.pdf'};
  for(const kind of ['book','cover'] as const){
   const file=files[i]?.[kind];if(!file||!await validPdf(file))throw new Error('PDF_REQUIRED');
   const {error}=await client.storage.from('raia-customer-files').upload(paths[kind],file,{contentType:'application/pdf',upsert:false});
   if(error){const {data}=await client.storage.from('raia-customer-files').list(userId+'/'+rid);if(!data?.some(f=>f.name==='extra-'+i+'-'+kind+'.pdf'))throw error;}
  }
  additionalBooks.push({...item,bookPath:paths.book,coverPath:paths.cover});
 }
 const {pricing:ignored,...clean}=spec;void ignored;return {...clean,additionalBooks};
}
