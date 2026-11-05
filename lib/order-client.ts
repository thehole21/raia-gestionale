import {type Store} from './data';
import {draftRows, prepareInvoice} from './billing';

export function changeOrderClient(store: Store, orderId: string, clientId: string): Store {
  const order = store.orders.find(o => o.id === orderId);
  if (!order || !store.clients.some(c => c.id === clientId)) throw Error('Seleziona un cliente presente nell’anagrafica.');
  if (order.clientId === clientId) return store;
  const workIds = new Set(order.lines.map(w => w.id));
  const linked = store.drafts.filter(d => d.workIds.some(id => workIds.has(id)));
  if (linked.some(d => ['creating', 'sending', 'reconcile'].includes(d.status || ''))) {
    throw Error('Verifica prima l’esito del documento in corso di creazione.');
  }
  const next = {...store, orders: store.orders.map(o => o.id === orderId ? {...o, clientId} : o)};
  const drafts = store.drafts.map(draft => {
    if (!linked.includes(draft) || draft.remoteDocumentId || ['created', 'sent'].includes(draft.status || '')) return draft;
    const rows = draftRows(next, draft.workIds);
    if (new Set(rows.map(r => r.client.id)).size !== 1) throw Error('La bozza include altri ordini del cliente precedente. Separa o elimina quella bozza prima di cambiare cliente.');
    return {...draft, clientId, status: 'draft' as const, preparedInvoice: prepareInvoice(rows)};
  });
  return {...next, drafts};
}
