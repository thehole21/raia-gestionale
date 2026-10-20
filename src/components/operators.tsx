'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { cloud } from '@/lib/supabase';
import { type Profile, useAccess } from './access';
export function Operators({ onCreated }: { onCreated: (id: string, name: string) => void }) {
  const { demo, profile } = useAccess(); const [users, setUsers] = useState<Profile[]>([]);
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  async function call(method = 'GET', body?: unknown) {
    const { data: { session } } = await cloud().auth.getSession();
    const response = await fetch('/api/operators', { method, headers: { Authorization: `Bearer ${session?.access_token || ''}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error); return result;
  }
  async function load() { try { setUsers(await call()); } catch(e) { setMessage((e as Error).message); } }
  useEffect(() => { if (!demo && profile.role === 'admin') void load(); }, [demo, profile.role]);
  if (profile.role !== 'admin') return null;
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const values = Object.fromEntries(new FormData(form)); setBusy(true); setMessage('');
    try { const user = await call('POST', values); onCreated(user.id,user.name); form.reset(); await load(); setMessage('Account creato. Comunica la password alla persona attraverso un canale riservato.'); } catch(e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="workspace-card settings-panel"><div className="card-top"><div><h2>Utenti e permessi</h2><p>Gli amministratori possono gestire gli utenti; gli operatori non vedono questa sezione. La revoca conserva lo storico dei lavori.</p></div></div>{demo ? <div className="backup-actions"><p>Gli accessi reali saranno disponibili dopo il collegamento a Supabase. La demo non crea account.</p></div> : <><form className="settings-form" onSubmit={create}><label className="form-field">Nome<input name="name" required maxLength={120}/></label><label className="form-field">Email<input name="email" type="email" required/></label><label className="form-field">Password iniziale (almeno 12 caratteri)<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label><label className="form-field">Ruolo<select name="role" defaultValue="operator" required><option value="operator">Operatore</option><option value="admin">Amministratore</option></select><small>L’amministratore può creare account e gestirne gli accessi.</small></label><button className="btn btn-primary" disabled={busy}>Crea account</button></form><div className="backup-actions">{users.map(user => <div className="account-row" key={user.id}><span><strong>{user.name}</strong><small>{user.email} · {(user.title || (user.role === 'admin' ? 'Amministratore' : 'Operatore')) + ' · ' + (user.active ? 'Attivo' : 'Accesso revocato')}</small></span>{user.role !== 'admin' && <button className="btn btn-plain" disabled={busy} onClick={async () => { if (!window.confirm(`${user.active ? 'Revocare' : 'Riattivare'} l’accesso di ${user.name}?`)) return; setBusy(true); try { await call('PATCH',{ id:user.id, active:!user.active }); await load(); } catch(e) { setMessage((e as Error).message); } finally { setBusy(false); } }}>{user.active ? 'Revoca accesso' : 'Riattiva'}</button>}</div>)}</div></>}{message && <p className="settings-footnote" role="status">{message}</p>}</section>;
}
