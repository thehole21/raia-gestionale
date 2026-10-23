import type {DdtDocument,DdtIssuer} from './ddt-document';
export const STATUSES = ['Sopralluogo', 'Preventivo', 'Da elaborare', 'In lavorazione', 'Bozza', 'Procedere', 'In Stampa', 'In allestimento', 'In attesa File', 'In attesa conferma', 'Sospeso', 'Elaborato', 'Pronto', 'Consegnato'] as const;
export type Status = typeof STATUSES[number];
export type Client = { taxCode?: string; recipientCode?: string; pec?: string; address?: string; postalCode?: string; province?: string; country?: string; ficEntityId?: number; id: string; name: string; email: string; phone: string; vat: string; city: string };
export type Operator = { id: string; name: string };
export type SourceRecord = { identity?: string; sheet: string; row: number; values: unknown[]; headers?: string[]; comments?: Record<string,string> };
export type Production = { planningMonths?: string[]; category?: string; section?: string; bookNumber?: string; entryTime?: string; exitTime?: string; urgent?: boolean; comments?: string; additionalNotes?: string; quantity: string; priceUnspecified: boolean; supplier: string; requestedDate: string; requestedText: string; ddtNumber: string; delivery: string; terminated: boolean; invoicing: string };
export const quantityLabel = (w: Pick<Work, 'qty'|'unit'|'production'>) => w.production ? w.production.quantity || 'Non precisata' : w.qty.toLocaleString('it-IT')+' '+w.unit;
export const workAmount = (w: Work) => w.production?.priceUnspecified || (w.production && !w.qty) ? 'Da definire' : money(sumWork(w));
export const workDue = (w: Work, o: Order) => w.production ? w.production.requestedDate : o.due;
export type Work = { production?: Production; vatId?: number; importKey?: string; source?: SourceRecord; sourceHistory?: SourceRecord[]; id: string; description: string; qty: number; unit: string; price: number; status: Status; operatorId: string; invoiceId: string | null; notes: string };
export type DeliveryNote = { document?:DdtDocument; number: string; date: string };
export type Order = { title?: string; planningMonth?: string; customerRequestId?: string; executionDate?: string; ddt?: DeliveryNote; solicited?: boolean; solicitedAutoDismissedDue?: string; id: string; number: string; clientId: string; created: string; due: string; notes: string; lines: Work[] };
export type Draft = { status?: 'draft' | 'validated' | 'creating' | 'created' | 'sending' | 'sent' | 'failed' | 'reconcile'; remoteDocumentId?: number; submissionKey?: string; preparedInvoice?: unknown; id: string; number: string; clientId: string; created: string; workIds: string[] };
export type Activity = { id: string; at: string; text: string };
export type Store = { ddtIssuer?:DdtIssuer; operatorHistory?: Operator[]; planningPeriods?: string[]; productionRegisters?: {sheet:string;periods:string[];notes:{row:number;values:unknown[];comments?:Record<string,string>}[]}[]; version: 2; clients: Client[]; operators: Operator[]; orders: Order[]; drafts: Draft[]; activity: Activity[] };
export type WorkRow = Work & { client: Client; order: Order; operator: Operator };

export const money = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n || 0);
export const fmtDate = (date: string) => date ? new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date + 'T12:00:00')) : '—';
export const shortDate = (date: string) => date ? new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' }).format(new Date(date + 'T12:00:00')) : '—';
export const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const id = () => 'id_' + Math.random().toString(36).slice(2, 8) + '_' + Date.now().toString(36);
export const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('');
export const sumWork = (w: Work) => Math.round((Number(w.qty) || 0) * (Number(w.price) || 0) * 100) / 100;
export const isInvoiced = (w: Work) => !!w.invoiceId || /^(si|sì|true)$/i.test(w.production?.invoicing?.trim() || '');
export const isWorkClosed = (w: Work) => !!w.production?.terminated || isClosed(w.status);
export const isClosed = (s: Status) => ['Consegnato', 'Pronto'].includes(s);
export function flatten(db: Store): WorkRow[] {
  return db.orders.flatMap(order => {
    const client = db.clients.find(c => c.id === order.clientId) || { id: '', name: 'Cliente non trovato', city: '', email: '', phone: '', vat: '' };
    return order.lines.map(line => ({ ...line, client, order, operator: db.operators.find(o => o.id === line.operatorId) || db.operatorHistory?.find(o => o.id === line.operatorId) || { id: '', name: '—' } }));
  });
}
export function seeded(): Store {
  const clients: Client[] = [
    ['c1', 'Tipografia Aurora', 'info@aurora.example', 'Roma'],
    ['c2', 'Studio Forma', 'studio@forma.example', 'Roma'],
    ['c3', 'Alfa Consulting S.r.l.', 'info@alfa.example', 'Roma'],
    ['c4', 'Officina Moderna', 'ufficio@moderna.example', 'Roma'],
    ['c5', 'Istituto Galileo', 'segreteria@galileo.example', 'Roma'],
    ['c6', 'Casa Editrice Linea', 'info@linea.example', 'Roma'],
    ['c7', 'Atelier Verde', 'hello@verde.example', 'Roma'],
    ['c8', 'Associazione Cultura', 'cultura@example.org', 'Roma'],
  ].map(([cid, name, email, city]) => ({ id: cid, name, email, city, vat: '', phone: '' }));
  const operators = Array.from({ length: 5 }, (_, index) => ({ id: 'op' + (index + 1), name: 'Operatore ' + (index + 1) }));
  const w = (wid: string, description: string, qty: number, price: number, status: Status, operatorId: string, unit = 'pz'): Work => ({ id: wid, description, qty, price, status, operatorId, unit, invoiceId: null, notes: '' });
  const orders: Order[] = [
    { id: 'o148', number: 'R-000148', clientId: 'c2', created: '2026-10-15', due: '2026-10-20', notes: 'Materiale per presentazione aziendale', lines: [w('w1', 'Brochure A4 a colori', 250, .65, 'In lavorazione', 'op2'), w('w2', 'Cartelline personalizzate', 40, 3.8, 'Da elaborare', 'op4')] },
    { id: 'o147', number: 'R-000147', clientId: 'c5', created: '2026-10-15', due: '2026-10-18', notes: 'Ritiro in sede', lines: [w('w3', 'Dispense rilegate', 35, 8.5, 'Pronto', 'op1'), w('w4', 'Copertine plastificate', 35, 1.1, 'In lavorazione', 'op1')] },
    { id: 'o146', number: 'R-000146', clientId: 'c1', created: '2026-10-14', due: '2026-10-22', notes: 'Attesa conferma dimensioni', lines: [w('w5', 'Pannelli forex personalizzati', 6, 42, 'Elaborato', 'op3'), w('w6', 'Adesivi sagomati', 80, 1.2, 'Preventivo', 'op3')] },
    { id: 'o145', number: 'R-000145', clientId: 'c3', created: '2026-10-14', due: '2026-10-17', notes: 'Urgente: verificare ultima bozza', lines: [w('w7', 'Biglietti da visita premium', 500, .19, 'In lavorazione', 'op4'), w('w8', 'Etichette adesive', 200, .28, 'In lavorazione', 'op4')] },
    { id: 'o144', number: 'R-000144', clientId: 'c6', created: '2026-10-13', due: '2026-10-24', notes: 'Formato da definire', lines: [w('w9', 'Stampa libri brossurati', 120, 9.3, 'Da elaborare', 'op5')] },
    { id: 'o143', number: 'R-000143', clientId: 'c4', created: '2026-10-12', due: '2026-10-16', notes: 'Verificare misure in sede', lines: [w('w10', 'Insegna da esterno', 1, 620, 'Sopralluogo', 'op2')] },
    { id: 'o142', number: 'R-000142', clientId: 'c7', created: '2026-10-10', due: '2026-10-15', notes: 'Consegnato al cliente', lines: [w('w11', 'Packaging personalizzato', 120, 2.8, 'Consegnato', 'op1'), w('w12', 'Etichette stampate', 120, .45, 'Consegnato', 'op1')] },
    { id: 'o141', number: 'R-000141', clientId: 'c8', created: '2026-10-08', due: '2026-10-25', notes: 'In attesa approvazione', lines: [w('w13', 'Locandine A3', 100, 1.65, 'Preventivo', 'op3')] },
    { id: 'o140', number: 'R-000140', clientId: 'c2', created: '2026-09-26', due: '2026-09-30', notes: '', lines: [w('w14', 'Roll-up espositivo', 2, 89, 'Consegnato', 'op4')] },
    { id: 'o139', number: 'R-000139', clientId: 'c1', created: '2026-09-15', due: '2026-09-22', notes: '', lines: [w('w15', 'Volantini A5', 1200, .1, 'Consegnato', 'op1')] },
    { id: 'o138', number: 'R-000138', clientId: 'c3', created: '2026-08-21', due: '2026-08-26', notes: '', lines: [w('w16', 'Targhe da parete', 4, 46, 'Consegnato', 'op2')] },
    { id: 'o137', number: 'R-000137', clientId: 'c6', created: '2026-08-05', due: '2026-08-14', notes: '', lines: [w('w17', 'Cataloghi a colori', 100, 6.2, 'Consegnato', 'op5')] },
    { id: 'o136', number: 'R-000136', clientId: 'c5', created: '2026-07-15', due: '2026-07-25', notes: '', lines: [w('w18', 'Tesi rilegate', 20, 19, 'Consegnato', 'op3')] },
  ];
  return { version: 2, clients, operators, orders, drafts: [], activity: [
    { id: 'a1', at: '2026-10-15', text: 'Commessa R-000148 aggiornata' },
    { id: 'a2', at: '2026-10-15', text: 'Nuove dispense da consegnare per Istituto Galileo' },
  ] };
}

// Migrazione conservativa del formato JSON locale V1, per chi ha provato il prototipo precedente.
// La V1 non aveva stati/operatore per la singola riga: li ereditiamo dalla commessa.
export function migrateV1(legacy: unknown): Store | null {
  if (!legacy || typeof legacy !== 'object') return null;
  const d = legacy as Record<string, unknown>;
  if (d.version !== 1 || !Array.isArray(d.orders) || !Array.isArray(d.clients) || !Array.isArray(d.operators)) return null;
  const allowed = new Set<string>(STATUSES);
  const orders = (d.orders as Array<Record<string, unknown>>).map(order => ({
    id: String(order.id), number: String(order.number), clientId: String(order.clientId), created: String(order.created), due: String(order.due || ''), notes: String(order.notes || ''),
    lines: (Array.isArray(order.lines) ? order.lines : []).map((line: Record<string, unknown>) => ({
      id: String(line.id), description: String(line.description), qty: Number(line.qty) || 0, unit: String(line.unit || 'pz'), price: Number(line.price) || 0,
      status: (allowed.has(String(order.status)) ? order.status : 'Da elaborare') as Status,
      operatorId: String(order.operatorId || 'op1'), invoiceId: line.invoiceId ? String(line.invoiceId) : null, notes: ''
    }))
  }));
  const clients = (d.clients as Array<Record<string, unknown>>).map(c => ({ id: String(c.id), name: String(c.name), email: String(c.email || ''), phone: String(c.phone || ''), vat: String(c.vat || ''), city: String(c.city || '') }));
  const operators = (d.operators as Array<Record<string, unknown>>).map(o => ({ id: String(o.id), name: String(o.name) }));
  const legacyInvoices = Array.isArray(d.invoices) ? (d.invoices as Array<Record<string, unknown>>) : [];
  const drafts = legacyInvoices.map(inv => ({ id: String(inv.id), number: String(inv.number), clientId: String(inv.clientId), created: String(inv.created), workIds: (Array.isArray(inv.lineIds) ? inv.lineIds : []).map(String) }));
  return { version: 2, clients, operators, orders, drafts, activity: [{ id: id(), at: today(), text: 'Importati dati del prototipo V1' }] };
}
