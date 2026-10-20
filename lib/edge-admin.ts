// Server-side proxy: privileged keys stay inside Supabase Edge Functions.
export async function adminAction(request:Request,action:string){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return Response.json({error:'Supabase non configurato.'},{status:503});
 const auth=request.headers.get('authorization');if(!auth?.startsWith('Bearer '))return Response.json({error:'Accesso richiesto.'},{status:401});
 try{
  const body=request.method==='GET'?{}:await request.json();
  const result=await fetch(url+'/functions/v1/raia-admin',{method:'POST',headers:{Authorization:auth,apikey:key,'Content-Type':'application/json'},body:JSON.stringify({...body,action}),cache:'no-store'});
  const data=await result.json();
  return Response.json(result.ok?data:{error:data.error||'Sessione non valida o servizio temporaneamente non disponibile.'},{status:result.status,headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Connessione al servizio non riuscita.'},{status:502});}
}
