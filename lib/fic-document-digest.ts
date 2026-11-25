import {createHash} from 'node:crypto';
// JSONB changes object key order. Compare content, preserving array order.
export function documentDigest(value:unknown):string{
 const stable=(v:any):any=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,stable(v[k])])):v;
 return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}
