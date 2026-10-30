'use client';
import { useEffect, useRef, useState, useMemo, useCallback, type SetStateAction } from 'react';
import { seeded, migrateV1, type Store } from './data';
import { cloud } from './supabase';
import { mergeWorkspace } from './workspace-merge';
export function useWorkspace(demo: boolean) {
  const [db, rawSet] = useState<Store>(demo ? seeded : () => ({ version: 2, clients: [], operators: [], orders: [], drafts: [], activity: [] }));
  const [ready, setReady] = useState(false); const [status, setStatus] = useState('Caricamento…');
  const [failure, setFailure] = useState('');
  const roster = useRef(db.operators);
  const confirmed = useRef(db);
  const current = useRef(db); const revision = useRef(0); const queue = useRef(Promise.resolve()); const blocked = useRef(false);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        let initial: Store;
        if (demo) {
          const saved = localStorage.getItem('raia_workspace_v2_next_demo');
          const legacy = localStorage.getItem('raia_workspace_v1_2026');
          initial = saved ? JSON.parse(saved) : legacy ? migrateV1(JSON.parse(legacy)) || seeded() : seeded();
          if (!initial || initial.version !== 2 || !Array.isArray(initial.orders)) throw new Error('Backup locale non valido.');
        } else {
          const { data, error } = await cloud().from('raia_workspace').select('payload,revision').eq('id', 1).single();
          if (error) throw new Error('Database non disponibile. Verifica la configurazione Supabase.');
          initial = data.payload; revision.current = data.revision;
        }
        if (live) { confirmed.current = initial; roster.current = initial.operators; current.current = initial; rawSet(initial); setReady(true); setStatus(demo ? 'Demo · salvato nel browser' : 'Tutte le modifiche salvate'); }
      } catch (e) { if (live) setFailure(e instanceof Error ? e.message : 'Caricamento non riuscito.'); }
    })();
    return () => { live = false; };
  }, [demo]);
  const pending = useRef(0);
  useEffect(() => { const guard = (e: BeforeUnloadEvent) => { if (pending.current || blocked.current) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard); }, []);
  useEffect(() => {
    if (demo || !ready) return;
    let live = true;
    async function refresh() {
      if (pending.current || blocked.current) return;
      const startRevision = revision.current;
      const check=await cloud().from('raia_workspace').select('revision').eq('id',1).single();
      if(!live||check.error||!check.data||check.data.revision<=revision.current||pending.current||blocked.current)return;
      const { data, error } = await cloud().from('raia_workspace').select('payload,revision').eq('id',1).single();
      if (!live || error || !data || pending.current || blocked.current || revision.current !== startRevision) return;
      if (data.revision > revision.current) { confirmed.current = data.payload; revision.current = data.revision; roster.current = data.payload.operators; current.current = data.payload; rawSet(data.payload); }
    }
    const timer = setInterval(() => { void refresh(); },15000);
    window.addEventListener('focus',refresh);
    return () => { live=false;clearInterval(timer);window.removeEventListener('focus',refresh); };
  },[demo,ready]);
  function setDb(action: SetStateAction<Store>) {
    if (!ready || blocked.current) return;
    const base = current.current;
    const next = typeof action === 'function' ? action(current.current) : action;
    current.current = next; rawSet(next); setStatus('Salvataggio…'); pending.current++;
    queue.current = queue.current.then(async () => {
      if (blocked.current) return;
      try {
        if (demo) localStorage.setItem('raia_workspace_v2_next_demo', JSON.stringify(next));
        else {
          let saved = false;
          for(let attempt=0;attempt<8;attempt++) {
            const candidate = mergeWorkspace(base,next,confirmed.current);
            const {data,error} = await cloud().rpc('raia_save_workspace',{expected_revision:revision.current,next_payload:candidate});
            if(!error) {
              revision.current=data; confirmed.current=candidate;
              // Rebase changes queued while this request was in flight.
              const visible=mergeWorkspace(next,current.current,candidate);
              current.current=visible;roster.current=candidate.operators;rawSet(visible);
              saved=true;break;
            }
            if(!error.message.includes('CONFLICT'))throw new Error('Salvataggio non riuscito. Esporta le modifiche in sospeso prima di ricaricare.');
            const fresh=await cloud().from('raia_workspace').select('payload,revision').eq('id',1).single();
            if(fresh.error||!fresh.data)throw new Error('Impossibile aggiornare i dati condivisi. Esporta le modifiche prima di ricaricare.');
            confirmed.current=fresh.data.payload;revision.current=fresh.data.revision;
          }
          if(!saved)throw new Error('Molti aggiornamenti contemporanei. Esporta le modifiche in sospeso prima di ricaricare.');
        }
        setStatus(pending.current>1 ? 'Salvataggio…' : demo ? 'Demo · salvato nel browser' : 'Tutte le modifiche salvate');
      } catch (e) { blocked.current = true; setStatus('Modifiche non salvate'); setFailure(e instanceof Error ? e.message : 'Salvataggio non riuscito.'); }
    }).finally(() => { pending.current--; });
  }
  const visibleDb=useMemo(()=>demo?db:{...db,operators:roster.current},[db,demo]);
  const getRevision=useCallback(()=>revision.current,[]);
  return {db:visibleDb,setDb,ready,status,failure,getRevision};
}
