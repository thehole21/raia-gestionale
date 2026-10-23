import {createClient} from "npm:@supabase/supabase-js@2.118.0";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
Deno.serve(async req=>{
 if(req.method!=="POST")return reply({error:"Metodo non consentito."},405);
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const token=req.headers.get("authorization")?.replace(/^Bearer /,"");if(!token)return reply({error:"Accesso richiesto."},401);
 const service=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await service.auth.getUser(token);if(error||!user?.email)return reply({error:"Sessione scaduta."},401);
 const {data:profile}=await service.from("raia_profiles").select("role,active").eq("id",user.id).single();
 if(!profile?.active||!["admin","operator"].includes(profile.role))return reply({error:"Accesso non abilitato."},403);
 try{
 const body=await req.json();
 if(typeof body.orderId!=="string"||!body.orderId||body.orderId.length>150||typeof body.workId!=="string"||!body.workId||body.workId.length>150||typeof body.password!=="string"||!body.password||body.password.length>128||!Number.isSafeInteger(body.expectedRevision))return reply({error:"Dati non validi."},400);
 const proof=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const verified=await proof.auth.signInWithPassword({email:user.email,password:body.password});
 if(verified.error||verified.data.user?.id!==user.id)return reply({error:"Password non corretta o verifica temporaneamente limitata."},403);
 await proof.auth.signOut({scope:"local"});
 const result=await service.rpc("raia_delete_work",{target_order_id:body.orderId,target_work_id:body.workId,actor_id:user.id,expected_revision:body.expectedRevision});
 if(result.error){const m=result.error.message;return reply({error:m.includes("DRAFT_LINKED")?"Riga collegata a una bozza: rimuovi prima la bozza.":m.includes("CONFLICT")?"Dati aggiornati da un altro operatore. Ricarica prima di eliminare.":"Eliminazione non riuscita."},409);}
 return reply({ok:true});
 }catch{return reply({error:"Richiesta non valida."},400);}
});
