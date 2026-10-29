'use client';
import { createContext, useContext, useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { cloud, cloudConfigured } from '@/lib/supabase';
export type Profile = { id: string; name: string; email: string; role: 'admin' | 'operator'; title?: string | null; active: boolean; deleted_at?: string | null };
const Access = createContext<{ profile: Profile; demo: boolean }>({ profile: { id: 'demo', name: 'Amministratore', email: '', role: 'admin', active: true }, demo: true });
export const useAccess = () => useContext(Access);
export function AccessGate({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(cloudConfigured);
  const [demo, setDemo] = useState(false);
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!cloudConfigured) return;
    let live = true;
    async function load() {
      try {
        const { data: { user }, error } = await cloud().auth.getUser();
        if (!live) return;
        if (!user || error) { setProfile(null); return; }
        const result = await cloud().from('raia_profiles').select('*').eq('id', user.id).single();
        if (!live) return;
        if (result.error || !result.data?.active) { setProfile(null); setMessage('Accesso non abilitato. Contatta l’amministratore.'); }
        else setProfile(result.data as Profile);
      } catch { if (live) setMessage('Connessione non disponibile. Riprova.'); }
      finally { if (live) setLoading(false); }
    }
    const { data: { subscription } } = cloud().auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('reset');
      if (event === 'SIGNED_OUT') setProfile(null);
      else setTimeout(() => { void load(); }, 0);
    });
    if (new URLSearchParams(location.search).has('reset')) setMode('reset');
    void load();
    const timer = setInterval(() => { void load(); }, 60000);
    return () => { live = false; subscription.unsubscribe(); clearInterval(timer); };
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      if (mode === 'forgot') {
        const { error } = await cloud().auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + '/?reset=1' });
        if (error) throw error;
        setMessage('Se l’indirizzo è abilitato, riceverai un link per reimpostare la password.');
      } else if (mode === 'reset') {
        const { error } = await cloud().auth.updateUser({ password }); if (error) throw error;
        await cloud().auth.signOut(); history.replaceState(null, '', '/'); setMode('login'); setPassword(''); setMessage('Password aggiornata. Accedi con la nuova password.');
      } else {
        const { error } = await cloud().auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error;
      }
    } catch { setMessage(mode === 'login' ? 'Accesso non riuscito. Verifica email e password o riprova più tardi.' : 'Operazione non riuscita. Verifica il link e riprova; potrebbe essere scaduto.'); }
    finally { setBusy(false); }
  }
  if ((profile && mode !== 'reset') || demo) return <Access.Provider value={{ profile: profile || { id: 'demo', name: 'Amministratore', email: '', role: 'admin', active: true }, demo }}>{children}</Access.Provider>;
  return <main className="auth-screen"><section className="auth-card"><img className="auth-logo" src="/images/raia-logo-transparent.png" alt="RAIA"/><div className="eyebrow">GESTIONALE · LAVORI</div><h1>{loading ? 'Connessione…' : mode === 'forgot' ? 'Recupera password' : mode === 'reset' ? 'Nuova password' : 'Il tuo spazio di lavoro.'}</h1><p>Ordini, lavorazioni e documenti. Tutto in un unico posto.</p>{!loading && (cloudConfigured ? <form id="staff-login-form" key={mode} onSubmit={submit} className="settings-form">{mode !== 'reset' && <label className="form-field">Email<input id="staff-login-email" name="username" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required/></label>}{mode !== 'forgot' && <label className="form-field">Password<input id="staff-login-password" name="password" type="password" autoComplete={mode === 'reset' ? 'new-password' : 'current-password'} minLength={mode === 'reset' ? 12 : 1} required value={password} onChange={e => setPassword(e.target.value)}/></label>}<button className="btn btn-primary" disabled={busy}>{busy ? 'Attendi…' : mode === 'forgot' ? 'Invia link di recupero' : mode === 'reset' ? 'Salva password' : 'Accedi'}</button><button type="button" className="btn btn-plain" onClick={() => { setMode(mode === 'login' ? 'forgot' : 'login'); setMessage(''); }}>{mode === 'login' ? 'Password dimenticata?' : 'Torna all’accesso'}</button></form> : <><div className="warning-strip">Collegamento Supabase da configurare. Puoi esplorare la demo locale con dati di esempio.</div><button className="btn btn-primary" onClick={() => setDemo(true)}>Esplora la demo</button></>)}{message && <p role="status">{message}</p>}<small>Accesso riservato agli operatori abilitati.</small></section></main>;
}
