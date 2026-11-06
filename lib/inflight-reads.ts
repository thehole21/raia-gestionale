// Only coalesce concurrent reads. Never retain completed results or retry writes.
export function createReadCoalescer(limit=128){
 const pending=new Map<string,Promise<unknown>>();
 return async function read<T>(key:string,load:()=>Promise<T>):Promise<T>{
  const existing=pending.get(key) as Promise<T>|undefined;
  if(existing)return structuredClone(await existing);
  if(pending.size>=limit)return load();
  const request=Promise.resolve().then(load);pending.set(key,request);
  try{return structuredClone(await request);}finally{if(pending.get(key)===request)pending.delete(key);}
 };
}
