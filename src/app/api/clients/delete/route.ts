import {adminAction} from '@/lib/edge-admin';
export const runtime='nodejs';
export const POST=(request:Request)=>adminAction(request,'delete-client');
