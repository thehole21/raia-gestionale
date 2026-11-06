'use client';
import {useState} from 'react';
import {id, type Store} from '@/lib/data';
import {processesOf, validateProcesses, type ProcessDefinition} from '@/lib/processes';

export function ProcessSettings({store, disabled, onSave}: {store: Store; disabled: boolean; onSave: (value: ProcessDefinition[]) => void}) {
  const [processes, setProcesses] = useState(() => processesOf(store));
  const [message, setMessage] = useState('');
  function change(processId: string, patch: Partial<ProcessDefinition>) {
    setMessage('');
    setProcesses(current => current.map(p => p.id === processId ? {...p, ...patch} : p));
  }
  return <section className="workspace-card settings-panel">
    <div className="card-top"><div><h2>Processo</h2>
    <p>Personalizza nomi, colore del riquadro e colore del testo. Le voci rimosse restano leggibili nei lavori già registrati.</p></div></div>
    <form className="settings-editor-body" onSubmit={e => {
      e.preventDefault();
      try {
        validateProcesses(processes);
        onSave(processes.map(p => ({...p, label: p.label.trim()})));
        setMessage('Configurazione aggiornata. Controlla lo stato di salvataggio del gestionale.');
      } catch (error) { setMessage((error as Error).message); }
    }}>
      <fieldset disabled={disabled} className="process-settings-fields">
        <div className="process-settings-list">{processes.filter(p => p.active).map(p => <div className="process-settings-row" key={p.id}>
          <label className="form-field">Nome<input required maxLength={80} value={p.label} onChange={e => change(p.id, {label: e.target.value})}/></label>
          <label>Riquadro<input type="color" aria-label={'Colore riquadro '+p.label} value={p.background} onChange={e => change(p.id, {background: e.target.value})}/></label>
          <label>Testo<input type="color" aria-label={'Colore testo '+p.label} value={p.foreground} onChange={e => change(p.id, {foreground: e.target.value})}/></label>
          <span className="process-preview" style={{background: p.background, color: p.foreground}}>{p.label || 'Anteprima'}</span>
          <button type="button" className="btn btn-small btn-plain" onClick={() => change(p.id, {active: false})}>Rimuovi</button>
        </div>)}</div>
        <div className="backup-actions">
          <button type="button" className="btn btn-plain" onClick={() => {setProcesses(current => [...current, {id:'process_'+id(), label:'Nuovo processo', background:'#eadb91', foreground:'#302b19', active:true}]); setMessage('');}}>+ Aggiungi processo</button>
          <button className="btn btn-primary">Salva processi</button>
        </div>
      </fieldset>
      {message && <p role="status">{message}</p>}
    </form>
  </section>;
}
