import {createClient} from "npm:@supabase/supabase-js@2.118.0";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
Deno.serve(async req=>{
 if(req.method!=="POST")return reply({error:"Metodo non consentito."},405);
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const token=req.headers.get("authorization")?.replace(/^Bearer /,"");if(!token)return reply({error:"Accesso richiesto."},401);
 const service=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await service.auth.getUser(token);if(error||!user?.email)return reply({error:"Sessione scaduta."},401);
 const {data:profile}=await service.from("raia_profiles").select("role,active").eq("id",user.id).single();
 if(!profile?.active)return reply({error:"Accesso non abilitato."},403);
 try{
 const body=await req.json();
 if(body.action==="delete-order"){
  if(typeof body.orderId!=="string"||body.orderId.length>150||typeof body.password!=="string"||!body.password||body.password.length>128||!Number.isSafeInteger(body.expectedRevision))return reply({error:"Dati non validi."},400);
  const proof=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const verified=await proof.auth.signInWithPassword({email:user.email,password:body.password});
  if(verified.error||verified.data.user?.id!==user.id)return reply({error:"Password non corretta o verifica temporaneamente limitata."},403);
  await proof.auth.signOut({scope:"local"});
  const deleted=await service.rpc("raia_delete_order",{target_order_id:body.orderId,actor_id:user.id,expected_revision:body.expectedRevision});
  if(deleted.error){const m=deleted.error.message;return reply({error:m.includes("DRAFT_LINKED")?"Ordine collegato a una bozza: rimuovila prima di cancellare.":m.includes("CONFLICT")?"Dati aggiornati da un altro operatore. Ricarica prima di cancellare.":"Cancellazione non riuscita."},409);}
  return reply({ok:true});
 }
 if(profile.role!=="admin")return reply({error:"Operazione riservata all’amministratore."},403);
 if(body.action==="list"){
  const result=await service.from("raia_profiles").select("*").order("name");if(result.error)throw result.error;return reply(result.data);
 }
 if(body.action==="create"){
  const {name,email,password,role}=body;
  if(role!=="operator"&&role!=="admin")return reply({error:"Scegli un ruolo valido: operatore o amministratore."},400);
  if(typeof name!=="string"||!name.trim()||name.length>120||typeof email!=="string"||!email.includes("@")||email.length>254||typeof password!=="string"||password.length<12||password.length>128)return reply({error:"Controlla nome, email e password (almeno 12 caratteri)."},400);
  const created=await service.auth.admin.createUser({email:email.trim(),password,email_confirm:true});
  if(created.error||!created.data.user)return reply({error:"Creazione non riuscita. Verifica se l’email è già registrata."},400);
  const newProfile={id:created.data.user.id,name:name.trim(),email:email.trim(),role,active:true};
  const saved=await service.from("raia_profiles").insert(newProfile);
  if(saved.error){await service.auth.admin.deleteUser(created.data.user.id);throw saved.error;}
  return reply(newProfile);
 }
 if(body.action==="set-active"){
  if(typeof body.id!=="string"||typeof body.active!=="boolean"||body.id===user.id)return reply({error:"Richiesta non valida."},400);
  const target=await service.from("raia_profiles").select("role").eq("id",body.id).single();
  if(target.error||target.data?.role!=="operator")return reply({error:"Account non modificabile."},403);
  const result=await service.from("raia_profiles").update({active:body.active}).eq("id",body.id);if(result.error)throw result.error;
  return reply({ok:true});
 }
 return reply({error:"Operazione non valida."},400);
 }catch{return reply({error:"Operazione non riuscita. Riprova."},400);}
});