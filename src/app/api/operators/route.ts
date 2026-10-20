import {adminAction} from '@/lib/edge-admin';
export const runtime='nodejs';
export const GET=(request:Request)=>adminAction(request,'list');
export const POST=(request:Request)=>adminAction(request,'create');
export const PATCH=(request:Request)=>adminAction(request,'set-active');
