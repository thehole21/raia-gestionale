import {cookies} from 'next/headers';
import {randomBytes} from 'node:crypto';
import {admin,bearer,config,failure,FIC_SCOPES,sameOrigin,seal} from '@/lib/fic-server';
export const runtime='nodejs';
export async function POST(request:Request){try{sameOrigin(request);const token=bearer(request);await admin(token);const c=config(),state=randomBytes(32).toString('base64url');(await cookies()).set('raia_fic_oauth',seal({state,token,expires:Date.now()+600000},'oauth'),{httpOnly:true,secure:new URL(c.redirect).protocol==='https:',sameSite:'lax',path:'/api/fatture-in-cloud',maxAge:600});const url=new URL('https://api-v2.fattureincloud.it/oauth/authorize');url.search=new URLSearchParams({response_type:'code',client_id:c.clientId,redirect_uri:c.redirect,scope:FIC_SCOPES,state}).toString();return Response.json({url:url.toString()},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
