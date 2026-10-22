import type { Store } from './data';
const same=(a:unknown,b:unknown):boolean=>JSON.stringify(a)===JSON.stringify(b);
export class WorkspaceConflict extends Error {
 constructor(path:string){super('Modifiche contemporanee sullo stesso elemento ('+path+'). Le tue modifiche sono conservate qui: esportale prima di ricaricare i dati condivisi.');}
}
// Merge independent records; a work item and financial preparations stay atomic.
export function mergeWorkspace(base:Store,local:Store,remote:Store):Store {
 function merge(b:any,l:any,r:any,path:string):any {
  if(same(l,b))return r;
  if(same(r,b)||same(l,r))return l;
  if(path==='drafts')throw new WorkspaceConflict('preparazioni fatture');
  if(Array.isArray(b)&&Array.isArray(l)&&Array.isArray(r)&&[...b,...l,...r].every(x=>x&&typeof x.id==='string')){
   const bm=new Map(b.map(x=>[x.id,x])),lm=new Map(l.map(x=>[x.id,x])),rm=new Map(r.map(x=>[x.id,x]));
   const result=[...new Set([...r,...l].map(x=>x.id))].map(id=>merge(bm.get(id),lm.get(id),rm.get(id),path+'['+id+']')).filter(x=>x!==undefined);
   return path==='activity'?result.sort((a,b)=>b.at.localeCompare(a.at)).slice(0,80):result;
  }
  // Do not combine edits to the same work/client, or resurrect deleted records.
  if(path.includes('.lines[')||path.startsWith('clients['))throw new WorkspaceConflict(path);
  if(b&&l&&r&&!Array.isArray(b)&&typeof b==='object'&&typeof l==='object'&&typeof r==='object'){
   return Object.fromEntries([...new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)])].map(k=>[k,merge(b[k],l[k],r[k],path?path+'.'+k:k)]));
  }
  throw new WorkspaceConflict(path);
 }
 return merge(base,local,remote,'');
}
