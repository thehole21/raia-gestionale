import type {Work} from './data';
export const operatorIds=(w:Partial<Pick<Work,'operatorId'|'operatorIds'>>):string[]=>[...new Set(w.operatorIds??(w.operatorId?[w.operatorId]:[]))];
export const supplierNames=(value:string)=>value.split(';').map(s=>s.trim()).filter(Boolean);
