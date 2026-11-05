'use client';
import {useEffect, useState} from 'react';
import type {Order, Store} from '@/lib/data';
import {SearchableSelect} from './searchable-select';

export function OrderClientEditor({order, store, disabled, onSave}: {order: Order; store: Store; disabled: boolean; onSave: (clientId: string) => boolean}) {
  const [clientId, setClientId] = useState(order.clientId);
  const [saved, setSaved] = useState(false);
  useEffect(() => {setClientId(order.clientId);}, [order.clientId]);
  const original = [...store.clients, ...(store.clientHistory || [])].find(c => c.id === order.clientId);
  return <section className="order-client-editor">
    <label className="form-field">Cliente dell’ordine
      <SearchableSelect aria-label="Cliente dell’ordine" value={clientId} disabled={disabled} onChange={e => {setClientId(e.target.value); setSaved(false);}}>
        {!store.clients.some(c => c.id === order.clientId) && <option value={order.clientId}>{original?.name || 'Cliente precedente'} · storico</option>}
        {store.clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.vat ? ' · '+c.vat : ''}</option>)}
      </SearchableSelect>
    </label>
    <button type="button" className="btn btn-small btn-plain" disabled={disabled || clientId === order.clientId} onClick={() => setSaved(onSave(clientId))}>Salva cliente dell’ordine</button>
    <small>La scelta vale per tutte le lavorazioni dell’ordine. I documenti già emessi conservano la loro intestazione.</small>
    {saved && <small role="status">Cliente aggiornato. Controlla lo stato di salvataggio in alto.</small>}
  </section>;
}
