'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode, ChangeEvent } from 'react';
import {
  LayoutGrid, ListTodo, Folders, Users, ReceiptText, Settings2, Search, Plus, ChevronRight,
  ChevronDown, ChevronLeft, ArrowUpRight, Filter, X, Check, CalendarDays, Clock3,
  CheckCircle2, AlertTriangle, ClipboardList, Download, Upload, Trash2,
  ExternalLink, FileText, Menu, Layers3, Building2, Sparkles,
  ArrowRight, ArrowLeft, ShieldAlert, Bell, Hash, RotateCcw,
} from 'lucide-react';
import {
  type Store, type Work, type WorkRow, type Status, type Order, type Client,
  STATUSES, money, fmtDate, shortDate, today, id, initials, sumWork, isClosed, flatten, seeded, migrateV1,
} from '@/lib/data';

import { ProductionFields, RegisterNotes } from '@/src/components/production-fields';
import { quantityLabel, workAmount, workDue, isInvoiced, isWorkClosed } from '@/lib/data';
import { AccessGate, useAccess } from '@/src/components/access';
import { StaffQuote } from '@/src/components/staff-quote';
import { Operators } from '@/src/components/operators';
import { CustomerRequest } from '@/src/components/quote-components';
import { Documents } from '@/src/components/documents';
import { ExcelImport } from '@/src/components/excel-import';
import { useWorkspace } from '@/lib/use-workspace';
import { CancelledOrders } from '@/src/components/cancelled-orders';
import { DeleteOrder } from '@/src/components/delete-order';
import { WorkGroups } from '@/src/components/work-groups';
import { OrderDates } from '@/src/components/order-dates';
import { overallStatus, executionDay, planningPeriod, matchesPeriod, workPeriods } from '@/lib/order-groups';
import { DeliveryNoteSection } from '@/src/components/delivery-note';
import { prepareInvoice, draftRows } from '@/lib/billing';
import { cloud } from '@/lib/supabase';
type Section = 'work' | 'orders' | 'clients' | 'billing' | 'estimator' | 'settings';
type FilterType = 'all' | 'active' | 'working' | 'ready' | 'unbilled' | 'delivered' | 'cancelled';
type NewLine = { key: string; description: string; qty: string; unit: string; price: string; status: Status; operatorId: string };
const DATA_KEY = 'raia_workspace_v2_next_demo';
const OLD_DATA_KEY = 'raia_workspace_v1_2026';
const sections: { key: Section; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'work', label: 'Panoramica', icon: ListTodo },
  { key: 'orders', label: 'Storico', icon: Folders },
  { key: 'clients', label: 'Clienti', icon: Users },
  { key: 'billing', label: 'Fatturazione', icon: ReceiptText },
  { key: 'estimator', label: 'Preventivatore', icon: FileText },
  { key: 'settings', label: 'Impostazioni', icon: Settings2 },
];
const statusColor: Record<Status, string> = {
  'Sospeso':'gray', 'In attesa conferma':'amber', 'Bozza':'violet', 'Procedere':'gray', 'In Stampa':'blue', 'In allestimento':'blue', 'In attesa File':'amber',
  'Sopralluogo': 'violet', 'Preventivo': 'violet', 'Da elaborare': 'gray',
  'In lavorazione': 'blue', 'Elaborato': 'amber', 'Pronto': 'green', 'Consegnato': 'green',
};
function StatusLabel({ status }: { status: Status }) {
  return <span className={'status status--' + statusColor[status]}><span className="status-dot" />{status}</span>;
}
function Empty({ title, detail, icon = <Search size={24} /> }: { title: string; detail: string; icon?: ReactNode }) {
  return <div className="empty"><span className="empty-icon">{icon}</span><strong>{title}</strong><p>{detail}</p></div>;
}
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="form-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function newLine(operatorId: string): NewLine {
  return { key: id(), description: '', qty: '1', unit: 'pz', price: '', status: 'Da elaborare', operatorId };
}
export default function Page() { return <AccessGate><Workspace/></AccessGate>; }
function Workspace() {
  const { demo, profile } = useAccess();
  const { db, setDb, ready: hydrated, status: saveStatus, failure, getRevision } = useWorkspace(demo);
  const [showImport, setShowImport] = useState(false);
  const [settingsTab,setSettingsTab]=useState('account');
  const defaultAssignee = profile.title === 'Tecnico' ? '' : db.operators.some(o=>o.id===profile.id) ? profile.id : ''; 
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [section, setSection] = useState<Section>('work');
  const [quick, setQuick] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');


  const [selectedWork, setSelectedWork] = useState<string[]>([]);
  const [drawerWorkId, setDrawerWorkId] = useState<string | null>(null);
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  useEffect(()=>{try{setSidebarCollapsed(localStorage.getItem('raia-sidebar-collapsed')==='true');}catch{}},[]);
  function toggleSidebar(){setSidebarCollapsed(value=>{try{localStorage.setItem('raia-sidebar-collapsed',String(!value));}catch{}return !value;});}
  const [toastMessage, setToastMessage] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [orderClient, setOrderClient] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [executionDate, setExecutionDate] = useState('');
  const [orderDue, setOrderDue] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderLines, setOrderLines] = useState<NewLine[]>([]);
  const [newClient, setNewClient] = useState({ name: '', email: '', city: '', phone: '', vat: '' });
  const [editWork, setEditWork] = useState<Partial<Work>>({});

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSection('work'); setTimeout(() => searchRef.current?.focus(), 0); }
      if (e.key === 'Escape') { setShowNewOrder(false); setShowNewClient(false); setShowDraft(false); setDrawerWorkId(null); setDrawerOrderId(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => { if (drawerWorkId) setEditWork(flatten(db).find(w => w.id === drawerWorkId) || {}); }, [drawerWorkId]); // intentional initial snapshot
  useEffect(() => () => { if (toastTimeout.current) clearTimeout(toastTimeout.current); }, []);

  function notify(msg: string) { setToastMessage(msg); if (toastTimeout.current) clearTimeout(toastTimeout.current); toastTimeout.current = setTimeout(() => setToastMessage(''), 3800); }
  function write(update: (current: Store) => Store) { setDb(current => update(current)); }
  function activity(current: Store, message: string): Store { return { ...current, activity: [{ id: id(), at: today(), text: message }, ...current.activity].slice(0, 80) }; }
  function navigate(s: Section) { setSection(s); setMobileNav(false); setDrawerOrderId(null); setDrawerWorkId(null); if (s !== 'work') { setSelectedWork([]); } }

  const rows = useMemo(() => flatten(db), [db]);
  const indexed = useMemo(() => new Map(rows.map(r => [r.id, r])), [rows]);
  const totalPending = rows.filter(r => !isWorkClosed(r)).length;
  const inProgress = rows.filter(r => ['In lavorazione','In Stampa','In allestimento'].includes(r.status)).length;
  const ready = rows.filter(r => r.status === 'Pronto' || r.status === 'Elaborato').length;
  const uninvoicedRows = rows.filter(r => !isInvoiced(r));
  const toInvoice = uninvoicedRows.reduce((s, r) => s + sumWork(r), 0);
  const overdue = rows.filter(r => !isWorkClosed(r) && r.order.due && r.order.due < today()).length;
  const hasWorkTerm = (r: WorkRow, term: string) => [r.description, r.client.name, r.order.number, r.order.ddt?.number, r.operator.name, r.status, r.order.notes, r.notes, r.order.created, r.order.executionDate, r.production?.supplier, r.production?.ddtNumber, r.production?.delivery, r.production?.invoicing, r.production?.section, r.production?.category, r.production?.comments].join(' ').toLocaleLowerCase('it').includes(term);
  const filtered = useMemo(() => rows.filter(r => {
    if (!matchesPeriod(r,year,month)) return false;
    if (search && !hasWorkTerm(r, search.trim().toLocaleLowerCase('it'))) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    if (operatorFilter && r.operatorId !== operatorFilter) return false;
    if (clientFilter && r.client.id !== clientFilter) return false;
    if (quick === 'active' && isWorkClosed(r)) return false;
    if (quick === 'working' && !['In lavorazione','In Stampa','In allestimento'].includes(r.status)) return false;
    if (quick === 'ready' && !['Pronto', 'Elaborato'].includes(r.status)) return false;
    if (quick === 'unbilled' && isInvoiced(r)) return false;
    if (quick === 'delivered' && r.status !== 'Consegnato') return false;
    return true;
  }).sort((a, b) => executionDay(b.order).localeCompare(executionDay(a.order)) || b.order.number.localeCompare(a.order.number)), [rows, search, statusFilter, operatorFilter, clientFilter, quick, year, month]);
  const selected = selectedWork.map(wid => indexed.get(wid)).filter((r): r is WorkRow => !!r && !isInvoiced(r));
  const selectedClients = new Set(selected.map(r => r.client.id));
  const validSelected = selected.length > 0 && selectedClients.size === 1;
  const orderDrawer = db.orders.find(o => o.id === drawerOrderId) || null;
  const workDrawer = drawerWorkId ? indexed.get(drawerWorkId) : null;

  function updateWork(workId: string, changes: Partial<Work>) {
    write(current => activity({ ...current, orders: current.orders.map(order => ({ ...order, lines: order.lines.map(w => w.id === workId ? { ...w, ...changes } : w) })) }, `Lavorazione aggiornata`));
  }
  function setSelected(wid: string, checked: boolean) { setSelectedWork(previous => checked ? [...new Set([...previous, wid])] : previous.filter(x => x !== wid)); }
  function startOrder(clientId = '') {
    setOrderClient(clientId || db.clients[0]?.id || ''); setOrderDate(today()); setExecutionDate(''); setOrderDue(''); setOrderNotes(''); setOrderLines([newLine(defaultAssignee)]); setShowNewOrder(true);
  }
  function saveNewOrder(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const lines = orderLines.filter(l => l.description.trim());
    if (!orderClient || !lines.length) { notify('Inserisci un cliente e almeno una lavorazione.'); return; }
    if (lines.some(l => !Number.isFinite(Number(l.qty)) || Number(l.qty) <= 0 || Number(l.price) < 0 || !Number.isFinite(Number(l.price)))) { notify('Controlla quantità e prezzi.'); return; }
    const max = Math.max(0, ...db.orders.map(o => Number(o.number.replace(/\D/g, '')) || 0));
    const number = 'R-' + String(max + 1).padStart(6, '0');
    const order: Order = { id: id(), number, clientId: orderClient, created: orderDate || today(), executionDate, due: orderDue, notes: orderNotes.trim(), lines: lines.map(l => ({ id: id(), description: l.description.trim(), qty: Number(l.qty), unit: l.unit || 'pz', price: Number(l.price), status: l.status, operatorId: l.operatorId, invoiceId: null, notes: '' })) };
    write(s => activity({ ...s, orders: [order, ...s.orders] }, `Creato lavoro ${number} con ${lines.length} lavorazioni`));
    setShowNewOrder(false); setSection('work'); setQuick('all'); setSearch(''); setClientFilter(''); setStatusFilter(''); setOperatorFilter(''); notify(`${number} creata: ${lines.length} lavorazioni visibili nell’elenco.`);
  }
  function saveNewClient(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!newClient.name.trim()) return;
    const client = { ...newClient, id: id(), name: newClient.name.trim() };
    write(s => activity({ ...s, clients: [...s.clients, client] }, `Aggiunto cliente ${client.name}`));
    setNewClient({ name: '', email: '', city: '', phone: '', vat: '' }); setShowNewClient(false); notify('Cliente creato. Puoi subito associargli un lavoro.');
  }
  function openWork(w: WorkRow) { setDrawerOrderId(null); setDrawerWorkId(w.id); setEditWork({ ...w }); }
  function saveEditWork(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!workDrawer) return;
    if (!String(editWork.description || '').trim() || !Number.isFinite(Number(editWork.qty)) || !Number.isFinite(Number(editWork.price)) || (Number(editWork.qty) < 0 || (!editWork.production && Number(editWork.qty) === 0)) || Number(editWork.price) < 0) { notify('Descrizione, quantità e prezzo non validi.'); return; }
    updateWork(workDrawer.id, { description: String(editWork.description).trim(), qty: Number(editWork.qty), price: Number(editWork.price), unit: String(editWork.unit || 'pz'), status: (editWork.status || 'Da elaborare') as Status, operatorId: String(editWork.operatorId), notes: String(editWork.notes || ''), production: editWork.production });
    setDrawerWorkId(null); notify('Lavorazione salvata.');
  }
  function createDraft() {
    if (!validSelected) { notify('Seleziona lavori non ancora assegnati a una bozza, tutti dello stesso cliente.'); return; }
    const draftId = id(); const number = 'BOZ-' + String(db.drafts.length + 1).padStart(4, '0'); const workIds = selected.map(r => r.id);
    const clientId = selected[0].client.id;
    write(s => activity({ ...s, drafts: [{ id: draftId, number, created: today(), clientId, workIds, status: 'draft', submissionKey: crypto.randomUUID(), preparedInvoice: prepareInvoice(selected) }, ...s.drafts], orders: s.orders.map(order => ({ ...order, lines: order.lines.map(w => workIds.includes(w.id) ? { ...w, invoiceId: draftId } : w) })) }, `Creata bozza interna ${number}`));
    setSelectedWork([]); setShowDraft(false); setSection('billing'); notify(`${number} preparata. Nessuna fattura inviata.`);
  }
  function deleteDraft(draftId: string) {
    if (!window.confirm('Eliminare la bozza? Le lavorazioni torneranno disponibili per nuove bozze.')) return;
    write(s => activity({ ...s, drafts: s.drafts.filter(d => d.id !== draftId), orders: s.orders.map(order => ({ ...order, lines: order.lines.map(w => w.invoiceId === draftId ? { ...w, invoiceId: null } : w) })) }, 'Bozza interna eliminata'));
    notify('Bozza eliminata e lavorazioni liberate.');
  }
  function download(content: string, filename: string, mime: string) { const blob = new Blob([content], { type: mime }); const href = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = href; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(href), 1000); }
  function exportCSV() {
    const value = (s: unknown) => '"' + String(typeof s === 'string' && /^[=+@\-\t\r]/.test(s) ? "'" + s : s ?? '').replaceAll('"', '""') + '"';
    const header = ['Data','Lavoro','Cliente','Lavorazione','Quantità','Unità','Prezzo unitario','Importo','Stato','Operatore','Scadenza','Bozza','Numero DDT','Data DDT','Data esecuzione','Mese programmazione','Fornitore','Modalità consegna','Terminato','Fatturato','Foglio origine','Riga origine','Sezione','Categoria','Numero libro','Orario ingresso','Orario uscita','Urgente','Commenti','Altre annotazioni'];
    const body = rows.map(r => [r.order.created, r.order.number, r.client.name, r.description, r.production ? r.production.quantity : r.qty, r.unit, r.production?.priceUnspecified ? '' : r.price, r.production?.priceUnspecified || (r.production&&!r.qty) ? '' : sumWork(r), r.status, r.operator.name, workDue(r,r.order) || r.production?.requestedText || '', r.invoiceId || '', r.production?.ddtNumber || r.order.ddt?.number || '', r.order.ddt?.date || '', r.order.executionDate || '', workPeriods(r).join(', '), r.production?.supplier || '', r.production?.delivery || '', r.production ? (r.production.terminated?'Sì':'No') : '', r.production?.invoicing || '', r.source?.sheet || '', r.source?.row || '', r.production?.section || '', r.production?.category || '', r.production?.bookNumber || '', r.production?.entryTime || '', r.production?.exitTime || '', r.production?.urgent ? 'Sì' : '', r.production?.comments || '', r.production?.additionalNotes || ''].map(value).join(';'));
    download('\uFEFF' + [header.map(value).join(';'), ...body].join('\r\n'), 'raia-lavorazioni.csv', 'text/csv;charset=utf-8');
  }
  async function importBackup(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    try { const parsed: unknown = JSON.parse(await file.text());
      if (parsed && typeof parsed === 'object' && (parsed as Store).version === 2 && Array.isArray((parsed as Store).orders) && Array.isArray((parsed as Store).clients) && Array.isArray((parsed as Store).drafts)) {
        if (!demo && db.orders.some(old => !(parsed as Store).orders.some(incoming => incoming.id === old.id && old.lines.every(line => incoming.lines.some(item => item.id === line.id))))) { notify('Il ripristino non può eliminare ordini o lavori esistenti. Usa la cancellazione con password.'); return; }
        if (!window.confirm('Caricare i dati di questo backup?')) return;
        setDb(parsed as Store); setSelectedWork([]); notify('Backup della V2 importato.');
      } else { notify('File JSON non compatibile con la V2.'); }
    } catch { notify('Impossibile leggere questo file JSON.'); }
    finally { e.target.value = ''; }
  }
  const tabSet: { id: FilterType; label: string; count: number }[] = [
    { id: 'all', label: 'Tutti', count: rows.length }, { id: 'active', label: 'Da seguire', count: totalPending },
    { id: 'working', label: 'In lavorazione', count: inProgress }, { id: 'ready', label: 'Pronti / elaborati', count: ready },
    { id: 'unbilled', label: 'Da fatturare', count: uninvoicedRows.length }, { id: 'delivered', label: 'Consegnati', count: rows.filter(r => r.status === 'Consegnato').length },
  ];
  const closeOverlay = () => { setShowNewOrder(false); setShowNewClient(false); setShowDraft(false); setDrawerWorkId(null); setDrawerOrderId(null); };

  const workTable = (items: WorkRow[], compact = false) => <div className="table-scroll"><table className={'work-table ' + (compact ? 'table--compact' : '')}>
    <thead><tr><th className="check-col"><input type="checkbox" aria-label="Seleziona lavori visibili" checked={items.filter(r => !isInvoiced(r)).length > 0 && items.filter(r => !isInvoiced(r)).every(r => selectedWork.includes(r.id))} onChange={e => {
      const ids = items.filter(r => !isInvoiced(r)).map(r => r.id);
      setSelectedWork(old => e.target.checked ? [...new Set([...old, ...ids])] : old.filter(s => !ids.includes(s)));
    }} /></th><th>CLIENTE / LAVORO</th><th>LAVORAZIONE</th><th>Q.TÀ</th><th>STATO</th><th>OPERATORE</th><th>CONSEGNA RICHIESTA</th><th>FORNITORE / CONSEGNA</th><th>DDT</th><th>TERMINATO</th><th>FATTURATO</th><th className="align-right">IMPORTO</th><th /></tr></thead>
    <tbody>{items.map(r => <tr key={r.id} className={selectedWork.includes(r.id) ? 'row-selected' : ''}>
      <td className="check-col"><input type="checkbox" aria-label={'Seleziona ' + r.description} disabled={isInvoiced(r)} checked={selectedWork.includes(r.id)} onChange={e => setSelected(r.id, e.target.checked)} /></td>
      <td><button className="cell-link company-cell" onClick={() => { setDrawerWorkId(null); setDrawerOrderId(r.order.id); }}><span className="company-avatar">{initials(r.client.name)}</span><span><strong>{r.client.name}</strong><small>{r.order.number} · {shortDate(r.order.created)}</small></span></button></td>
      <td><button className="cell-link job-cell" onClick={() => openWork(r)}><strong>{r.description}</strong>{(r.production?.section||r.production?.category==='Libri')&&<small>{[r.production?.category==='Libri'?'Libri':'',r.production?.section].filter(Boolean).join(' · ')}</small>}<small>{r.invoiceId ? 'Nella bozza ' + (db.drafts.find(d => d.id === r.invoiceId)?.number || '') : 'Apri dettagli e modifica'}</small></button></td>
      <td className="qty-cell">{quantityLabel(r)}</td>
      <td><select title="Cambia stato" aria-label={'Stato di ' + r.description} className={'inline-status inline-status--' + statusColor[r.status]} value={r.status} onChange={e => updateWork(r.id, { status: e.target.value as Status })}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></td>
      <td><select title="Cambia operatore" aria-label={'Operatore di ' + r.description} className="inline-operator" value={r.operatorId} onChange={e => updateWork(r.id, { operatorId: e.target.value })}><option value="">Non assegnato</option>{db.operators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}</select></td>
      <td className="date-cell"><span className={workDue(r,r.order) && workDue(r,r.order) < today() && !isWorkClosed(r) ? 'due-late' : ''}>{workDue(r,r.order) ? shortDate(workDue(r,r.order)) : r.production?.requestedText || 'Non precisata'}</span></td>
      <td><span>{r.production?.supplier || '—'}</span><small className="production-sub">{r.production?.delivery || ''}</small></td>
      <td>{r.production?.ddtNumber || r.order.ddt?.number || '—'}</td>
      <td>{r.production ? <input type="checkbox" aria-label={'Terminato: '+r.description} checked={r.production.terminated} onChange={e=>updateWork(r.id,{production:{...r.production!,terminated:e.target.checked}})}/> : '—'}</td>
      <td>{r.production?.invoicing || (r.invoiceId?'In bozza':'—')}</td>
      <td className="align-right amount-cell">{workAmount(r)}</td>
      <td><button className="row-arrow" title="Apri dettaglio" aria-label={'Apri ' + r.description} onClick={() => openWork(r)}><ChevronRight size={16}/></button></td>
    </tr>)}</tbody>
  </table></div>;

  if (!hydrated) return <main className="auth-screen"><section className="auth-card"><h1>RAIA</h1><p>{failure || 'Caricamento del gestionale…'}</p>{failure && <button className="btn btn-primary" onClick={() => location.reload()}>Riprova</button>}</section></main>;
  const periodFilters = <div className="period-filters"><select aria-label="Anno" value={year} onChange={e=>setYear(e.target.value)}><option value="">Tutti gli anni</option>{[...new Set([...(db.planningPeriods||[]),...rows.flatMap(workPeriods)].map(p=>p.slice(0,4)).filter(Boolean))].sort().reverse().map(y=><option key={y}>{y}</option>)}</select><select aria-label="Mese di programmazione" value={month} onChange={e=>setMonth(e.target.value)}><option value="">Tutti i mesi di programmazione</option>{['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'].map((m,i)=><option key={m} value={String(i+1).padStart(2,'0')}>{m}</option>)}</select>{(year||month)&&<button className="btn btn-plain" onClick={()=>{setYear('');setMonth('');}}>Azzera periodo</button>}</div>;
  return <div className={"app-frame dashboard-refined"+(sidebarCollapsed?" sidebar-compact":"")}>
    {mobileNav && <button className="mobile-cover" onClick={() => setMobileNav(false)} aria-label="Chiudi menu" />}
    <aside className={'sidebar ' + (mobileNav ? 'sidebar-open' : '')}>
      <div className="brand"><img className="sidebar-full-logo" src="/images/raia-logo-transparent.png" alt="RAIA"/><img className="sidebar-small-logo" src="/images/raia-monogram-transparent.png" alt="RAIA"/></div>
      <button type="button" className="sidebar-toggle" onClick={toggleSidebar} aria-expanded={!sidebarCollapsed} aria-label={sidebarCollapsed?"Espandi menu laterale":"Riduci menu laterale"} title={sidebarCollapsed?"Espandi menu":"Riduci menu"}>{sidebarCollapsed?<ChevronRight size={17}/>:<ChevronLeft size={17}/>}<span>Riduci menu</span></button><span className="nav-label">AREA DI LAVORO</span>
      <nav className="nav-links" aria-label="Navigazione principale">{sections.map(item => <button key={item.key} title={item.label} aria-label={item.label} aria-current={section===item.key?"page":undefined} className={'nav-link ' + (section === item.key ? 'active' : '')} onClick={() => navigate(item.key)}><item.icon size={18} strokeWidth={1.8}/><span>{item.label}</span>{item.key === 'work' && <span className="nav-count">{rows.length}</span>}</button>)}</nav>
      <div className="nav-divider" /><span className="nav-label">DOCUMENTI E DATI</span>
      <button className="nav-link" title="Importa Excel" aria-label="Importa Excel" onClick={()=>setShowImport(true)}><Upload size={17}/><span>Importa Excel</span></button>
      <div className="sidebar-bottom"><div className="demo-notice"><span className="notice-top"><span className="notice-led"/> {demo ? "Demo locale" : "Area riservata"}</span><p>{demo ? "Dati di esempio su questo dispositivo." : "Accesso riservato al personale abilitato."}</p></div></div>
    </aside>
    <div className="main-side">
      <header className="topbar"><button className="icon-btn menu-button" onClick={() => setMobileNav(true)} title="Apri menu"><Menu size={21}/></button><div className="topbar-left"><span>RAIA / Ufficio</span><ChevronRight size={14}/><strong>{sections.find(x => x.key === section)?.label}</strong></div><div className="topbar-right"><span className="topbar-demo" role="status">{saveStatus}</span><button className="topbar-icon" title="Vai ai lavori da seguire" onClick={() => { navigate('work'); setQuick('active'); }}><Bell size={18}/></button><span className="user-dot">{initials(profile.name)}</span><span className="user-name">{profile.name}<small>{demo ? "Demo locale" : profile.title || (profile.role === "admin" ? "Amministratore" : "Operatore")}</small></span>{!demo && <button className="btn btn-plain" onClick={async()=>{if(saveStatus === "Salvataggio…" || failure){notify("Attendi il salvataggio o esporta le modifiche prima di uscire.");return;}await cloud().auth.signOut();}}>Esci</button>}</div></header>
      <main className="content">{failure && <div className="warning-strip" role="alert"><span>{failure}</span><button className="btn btn-plain" onClick={()=>download(JSON.stringify(db,null,2),'raia-modifiche-non-salvate.json','application/json')}>Esporta modifiche</button><button className="btn btn-plain" onClick={()=>{if(confirm('Ricaricare i dati salvati? Le modifiche non salvate devono essere esportate prima.'))location.reload();}}>Ricarica</button></div>}<fieldset className="workspace-fieldset" disabled={!!failure}>
        {section === 'work' && <>
          <div className="eyebrow dashboard-date">IL PUNTO SUI LAVORI <span className="eyebrow-line" />{fmtDate(today())}</div>
          <div className="titlebar"><div><h1>Panoramica</h1><p>Organizza il lavoro. Segui ogni dettaglio.</p></div><div className="title-actions"><button className="btn btn-plain" onClick={()=>setShowImport(true)}><Upload size={16}/> Importa Excel</button><button className="btn btn-plain" onClick={() => { setNewClient({ name: '', email: '', city: '', phone: '', vat: '' }); setShowNewClient(true); }}><Users size={16}/> Nuovo cliente</button><button className="btn btn-primary" onClick={() => startOrder()}><Plus size={17}/> Nuovo lavoro</button></div></div>
          <div className="metrics">
            <button className={'metric ' + (quick === 'all' ? 'metric-chosen' : '')} onClick={() => setQuick('all')}><div className="metric-top"><span>Lavorazioni totali</span><span className="metric-icon neutral"><Layers3 size={20}/></span></div><strong>{rows.length}</strong><small>Tutte le voci registrate <ArrowUpRight size={13}/></small></button>
            <button className={'metric ' + (quick === 'active' ? 'metric-chosen' : '')} onClick={() => setQuick('active')}><div className="metric-top"><span>Lavori da seguire</span><span className="metric-icon orange"><Clock3 size={20}/></span></div><strong>{totalPending}</strong><small>Ancora in corso <ArrowUpRight size={13}/></small></button>
            <button className={'metric ' + (quick === 'working' ? 'metric-chosen' : '')} onClick={() => setQuick('working')}><div className="metric-top"><span>In produzione</span><span className="metric-icon blue"><ListTodo size={20}/></span></div><strong>{inProgress}</strong><small>Stato: in lavorazione <ArrowUpRight size={13}/></small></button>
            <button className={'metric ' + (quick === 'unbilled' ? 'metric-chosen' : '')} onClick={() => setQuick('unbilled')}><div className="metric-top"><span>Importo non in bozze</span><span className="metric-icon mint"><ReceiptText size={20}/></span></div><strong className="metric-euros">{money(toInvoice)}</strong><small>Valore indicativo, non fiscale <ArrowUpRight size={13}/></small></button>
          </div>
          <div className="workspace-card">
            <div className="card-top"><div><h2>Registro lavorazioni {quick!=='cancelled'&&<span className="head-count">{filtered.length}</span>}</h2><p>Apri un gruppo per gestire i lavori. Lo stato generale si aggiorna da solo.</p></div><button disabled={quick==='cancelled'} className="btn btn-small btn-plain" onClick={exportCSV}><Download size={15}/> Esporta CSV</button></div>
            <div className="tabs" role="tablist" aria-label="Filtra lavorazioni">{tabSet.map(t => <button key={t.id} role="tab" aria-selected={quick === t.id} className={'tab ' + (quick === t.id ? 'tab-active' : '')} onClick={() => setQuick(t.id)}>{t.label}<span>{t.count}</span></button>)}<button role="tab" aria-selected={quick==='cancelled'} className={'tab '+(quick==='cancelled'?'tab-active':'')} onClick={()=>setQuick('cancelled')}>Ordini annullati</button></div>
            {quick==='cancelled'?<CancelledOrders demo={demo}/>:<>{clientFilter && <div className="client-filter-bar">Lavori di: <strong>{db.clients.find(c => c.id === clientFilter)?.name}</strong><button onClick={() => setClientFilter('')}>Rimuovi filtro <X size={13}/></button></div>}{periodFilters}<RegisterNotes store={db} year={year} month={month}/><div className="filterbar"><div className="search-field"><Search size={18}/><input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca azienda, prodotto, lavoro, operatore…" aria-label="Cerca tutti i lavori"/><kbd>Ctrl K</kbd>{search && <button aria-label="Cancella ricerca" onClick={() => setSearch('')}><X size={15}/></button>}</div>
              <div className="filter-controls"><select aria-label="Filtra per stato" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">Tutti gli stati</option>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select><select aria-label="Filtra per operatore" value={operatorFilter} onChange={e => setOperatorFilter(e.target.value)}><option value="">Tutti gli operatori</option>{db.operators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}</select></div>
            </div>
            {!filtered.length ? <Empty title="Nessun lavoro trovato" detail="Prova a cambiare i filtri o inserisci un nuovo lavoro."/> : <WorkGroups all={rows} visible={filtered} renderRows={items=>workTable(items,true)}/>}
            <div className="table-foot"><span>Mostrate <strong>{filtered.length}</strong> di {rows.length} lavorazioni</span><span><span className="foot-dot"/> Modifica stato e operatore direttamente dalla tabella</span></div></>}
          </div>
        </>}

        {section === 'orders' && <><div className="eyebrow">ORGANIZZAZIONE</div><div className="titlebar"><div><h1>Storico</h1><p>Un gruppo per cliente e giornata. Aprilo per gestire i singoli lavori.</p></div><button className="btn btn-primary" onClick={() => startOrder()}><Plus size={17}/> Nuovo lavoro</button></div><div className="section-filter"><div className="search-field"><Search size={17}/><input placeholder="Cerca per cliente, descrizione o numero lavoro…" value={search} onChange={e => setSearch(e.target.value)}/></div></div>{periodFilters}<RegisterNotes store={db} year={year} month={month}/><div className="workspace-card order-groups-card"><WorkGroups all={rows} visible={rows.filter(r=>matchesPeriod(r,year,month)&&(!search||hasWorkTerm(r,search.trim().toLocaleLowerCase('it'))))} renderRows={items=>workTable(items,true)}/></div></>}

        {section === 'clients' && <><div className="eyebrow">ANAGRAFICHE</div><div className="titlebar"><div><h1>Clienti</h1><p>Tutte le aziende con storico lavori e lavori sempre collegati.</p></div><button className="btn btn-primary" onClick={() => setShowNewClient(true)}><Plus size={17}/> Nuovo cliente</button></div><div className="section-filter"><div className="search-field"><Search size={17}/><input placeholder="Cerca un cliente…" value={search} onChange={e => setSearch(e.target.value)}/></div></div><div className="client-grid">{db.clients.filter(c => [c.name, c.email, c.vat].join(' ').toLocaleLowerCase('it').includes(search.toLocaleLowerCase('it'))).map(c => {
          const own = rows.filter(r => r.client.id === c.id); return <button key={c.id} className="client-card" onClick={() => { setClientFilter(c.id); setStatusFilter(''); setOperatorFilter(''); setSection('work'); setQuick('all'); setSearch(''); }}><div className="client-card-head"><span className="company-avatar large">{initials(c.name)}</span><ArrowUpRight size={18}/></div><strong>{c.name}</strong><small>{c.email || 'Nessuna email'} </small><span className="client-contact">{[c.phone,c.address,[c.postalCode,c.city,c.province,c.country].filter(Boolean).join(" "),c.vat&&"P. IVA: "+c.vat,c.taxCode&&"CF: "+c.taxCode,c.recipientCode&&"SDI: "+c.recipientCode,c.pec&&"PEC: "+c.pec].filter(Boolean).map((value,i)=><span key={i} style={{display:"block"}}>{value}</span>)}</span><div className="client-stats"><span><b>{new Set(own.map(r => r.order.id)).size}</b> lavori</span><span><b>{own.length}</b> lavori</span></div><div className="client-open">Visualizza tutti i lavori <ArrowRight size={15}/></div></button>;
        })}</div></>}

        {section === 'billing' && <><div className="eyebrow">AMMINISTRAZIONE</div><div className="titlebar"><div><h1>Bozze di fatturazione</h1><p>Raggruppa i lavori di uno stesso cliente, anche appartenenti a lavori diversi.</p></div><button className="btn btn-primary" onClick={() => { setSection('work'); setQuick('unbilled'); }}><Plus size={17}/> Seleziona lavori</button></div><div className="warning-strip"><ShieldAlert size={19}/><span><strong>Fatture in Cloud da collegare.</strong> Puoi già preparare le lavorazioni e i riferimenti DDT. L’invio fiscale sarà disponibile dopo la configurazione e la verifica dei dati.</span></div><div className="metrics metrics-three"><div className="metric"><div className="metric-top">Bozze interne <ReceiptText size={19}/></div><strong>{db.drafts.length}</strong></div><div className="metric"><div className="metric-top">Lavorazioni nelle bozze <ClipboardList size={19}/></div><strong>{rows.filter(r => r.invoiceId).length}</strong></div><div className="metric"><div className="metric-top">Importo ancora libero <Clock3 size={19}/></div><strong className="metric-euros">{money(toInvoice)}</strong></div></div><div className="workspace-card"><div className="card-top"><div><h2>Documenti preparati</h2><p>Solo bozze interne, nessun invio fiscale.</p></div></div>{db.drafts.length ? db.drafts.map(draft => {
          const own = draft.workIds.map(wid => indexed.get(wid)).filter((r): r is WorkRow => !!r);
          return <div key={draft.id} className="draft-row"><div className="draft-icon"><FileText size={21}/></div><div className="draft-info"><strong>{draft.number} · {db.clients.find(c => c.id === draft.clientId)?.name}</strong><small>{fmtDate(draft.created)} · {own.length} lavorazioni · {new Set(own.map(r => r.order.id)).size} lavori</small><span>{own.map(r => r.description).join(' · ')}</span></div><button className="btn btn-plain" onClick={()=>{const payload=prepareInvoice(draftRows(db,draft.workIds));download(JSON.stringify(payload,null,2),draft.number+'-preparazione.json','application/json');notify('Preparazione esportata con riferimenti DDT e controlli. Nessuna fattura inviata.');}}>Prepara dati API</button><span className="status status--amber">Bozza</span><b>{money(own.reduce((a, r) => a + sumWork(r), 0))}</b><button className="icon-btn" title="Elimina la bozza" onClick={() => deleteDraft(draft.id)}><Trash2 size={18}/></button></div>;
        }) : <Empty title="Nessuna bozza ancora" detail="Vai su Tutti i lavori, seleziona le righe di un cliente e scegli Prepara bozza." icon={<ReceiptText size={25}/>} />}</div></>}

        {section === 'estimator' && <StaffQuote db={db} canSubmit={!failure && saveStatus !== 'Salvataggio…'} onCreated={()=>window.dispatchEvent(new Event('focus'))}/>}
        {section === 'settings' && <><div className="eyebrow">CONFIGURAZIONE</div><div className="titlebar"><div><h1>Impostazioni</h1><p>Il tuo account e le impostazioni del gestionale.</p></div></div><nav className="settings-nav" aria-label="Sezioni impostazioni">{[{id:'account',label:'Il mio account'},...(profile.role==='admin'?[{id:'users',label:'Utenti e permessi'},{id:'backup',label:'Backup e dati'}]:[])].map(t=><button type="button" key={t.id} aria-current={settingsTab===t.id?'page':undefined} className={settingsTab===t.id?'active':''} onClick={()=>setSettingsTab(t.id)}>{t.label}</button>)}</nav><div className="settings-grid settings-organized">{settingsTab==='account'&&<section className="workspace-card settings-panel"><div className="card-top"><div><h2>Il tuo account</h2><p>{profile.name} · {profile.email}</p></div></div><p className="settings-footnote">Ruolo: {profile.title || (profile.role === "admin" ? "Amministratore" : "Operatore")}</p></section>}{profile.role === "admin" && <>{settingsTab==='users'&&<Operators onCreated={()=>{window.dispatchEvent(new Event("focus"));notify("Account creato. Elenco assegnazioni aggiornato.");}}/>}{settingsTab==='backup'&&<section className="workspace-card settings-panel"><div className="card-top"><div><h2>Backup e dati</h2><p>{demo ? "I dati della demo rimangono su questo dispositivo." : "Esporta una copia dei dati del gestionale. I PDF si archiviano separatamente."}</p></div></div><div className="backup-actions"><button className="btn btn-plain" onClick={() => download(JSON.stringify(db, null, 2), 'raia-backup-v2.json', 'application/json')}><Download size={17}/> Esporta backup JSON</button><button className="btn btn-plain" onClick={() => fileRef.current?.click()}><Upload size={17}/> Importa backup JSON</button><input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importBackup}/><button disabled={!demo} className="btn btn-danger" onClick={() => { if (window.confirm('Vuoi ripristinare i dati di esempio? Perderai le modifiche locali della V2.')) { setDb(seeded()); setSelectedWork([]); setClientFilter(''); notify('Dati di esempio ripristinati.'); } }}><RotateCcw size={17}/> Ripristina dati demo</button></div><div className="settings-footnote">{demo ? "Configura Supabase per attivare accessi e dati condivisi." : "Gli account revocati non possono più leggere o modificare dati e documenti."}</div></section>}</>}</div></>}
      </fieldset></main>
    </div>

    {section === 'work' && selected.length > 0 && <div className="selection-bar"><span className="selection-badge">{selected.length}</span><div><strong>{selected.length} {selected.length === 1 ? 'lavorazione selezionata' : 'lavorazioni selezionate'}</strong><small>{selectedClients.size > 1 ? 'Seleziona lavori dello stesso cliente per creare una bozza.' : money(selected.reduce((s, r) => s + sumWork(r), 0)) + ' · importo imponibile indicativo'}</small></div><button className="btn btn-plain" onClick={() => setSelectedWork([])}>Deseleziona</button><button className="btn btn-primary" disabled={!validSelected} onClick={() => setShowDraft(true)}><ReceiptText size={17}/> Prepara bozza</button></div>}

    {(showNewOrder || showNewClient || showDraft || workDrawer || orderDrawer) && <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) closeOverlay(); }}>
      {showNewClient && <section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-client-title"><div className="modal-head"><div><span className="eyebrow">ANAGRAFICA</span><h2 id="new-client-title">Nuovo cliente</h2></div><button className="icon-btn" onClick={closeOverlay}><X size={20}/></button></div><form onSubmit={saveNewClient}><div className="modal-body grid-form"><Field label="Ragione sociale *"><input required autoFocus value={newClient.name} onChange={e => setNewClient(s => ({ ...s, name: e.target.value }))} placeholder="Nome azienda"/></Field><Field label="Partita IVA"><input value={newClient.vat} onChange={e => setNewClient(s => ({ ...s, vat: e.target.value }))} placeholder="Da verificare in fase fiscale"/></Field><Field label="Email"><input type="email" value={newClient.email} onChange={e => setNewClient(s => ({ ...s, email: e.target.value }))}/></Field><Field label="Telefono"><input value={newClient.phone} onChange={e => setNewClient(s => ({ ...s, phone: e.target.value }))}/></Field><Field label="Città"><input value={newClient.city} onChange={e => setNewClient(s => ({ ...s, city: e.target.value }))}/></Field></div><div className="modal-foot"><button type="button" className="btn btn-plain" onClick={closeOverlay}>Annulla</button><button type="submit" className="btn btn-primary"><Plus size={16}/> Crea cliente</button></div></form></section>}
      {showNewOrder && <section className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="new-order-title"><div className="modal-head"><div><span className="eyebrow">INSERIMENTO RAPIDO</span><h2 id="new-order-title">Nuovo lavoro</h2><p>Puoi aggiungere più lavorazioni nello stesso ordine.</p></div><button className="icon-btn" onClick={closeOverlay}><X size={20}/></button></div><form onSubmit={saveNewOrder}><div className="modal-body"><div className="grid-form"><Field label="Cliente *"><select required value={orderClient} onChange={e => setOrderClient(e.target.value)}>{db.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Data ordine"><input required type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)}/></Field><Field label="Data di esecuzione" hint="Se non indicata, il gruppo utilizza la data ordine."><input type="date" value={executionDate} onChange={e=>setExecutionDate(e.target.value)}/></Field><Field label="Scadenza"><select aria-label="Scadenza nuovo lavoro" value={orderDue?'date':'unknown'} onChange={e=>setOrderDue(e.target.value==='unknown'?'':orderDate||today())}><option value="unknown">Non precisata</option><option value="date">Data precisa</option></select>{orderDue&&<input type="date" aria-label="Data scadenza nuovo lavoro" value={orderDue} onChange={e=>setOrderDue(e.target.value)}/>}</Field><Field label="Note lavoro"><input value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Informazioni utili"/></Field></div><div className="line-editor-head"><strong>Lavorazioni</strong><button className="btn btn-small btn-plain" type="button" onClick={() => setOrderLines(lines => [...lines, newLine(defaultAssignee)])}><Plus size={14}/> Aggiungi riga</button></div>{orderLines.map((line, i) => <div className="new-line" key={line.key}><span className="line-index">{i + 1}</span><input aria-label={`Descrizione riga ${i + 1}`} required placeholder="Descrizione prodotto / lavorazione" value={line.description} onChange={e => setOrderLines(lines => lines.map(l => l.key === line.key ? { ...l, description: e.target.value } : l))}/><input aria-label={`Quantità riga ${i + 1}`} min="0.01" step="any" type="number" required value={line.qty} onChange={e => setOrderLines(lines => lines.map(l => l.key === line.key ? { ...l, qty: e.target.value } : l))}/><input aria-label={`Prezzo riga ${i + 1}`} min="0" step="0.01" type="number" required placeholder="€/pz" value={line.price} onChange={e => setOrderLines(lines => lines.map(l => l.key === line.key ? { ...l, price: e.target.value } : l))}/><select title="Operatore" aria-label={`Operatore riga ${i + 1}`} value={line.operatorId} onChange={e => setOrderLines(lines => lines.map(l => l.key === line.key ? { ...l, operatorId: e.target.value } : l))}><option value="">Non assegnato</option>{db.operators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}</select><button className="icon-btn" title="Elimina riga" type="button" disabled={orderLines.length === 1} onClick={() => setOrderLines(lines => lines.filter(l => l.key !== line.key))}><X size={17}/></button></div>)}<p className="helper-text">Puoi modificare lo stato di ciascuna lavorazione dopo aver creato la lavoro.</p></div><div className="modal-foot"><span className="modal-total">Importo <strong>{money(orderLines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0))}</strong></span><button type="button" className="btn btn-plain" onClick={closeOverlay}>Annulla</button><button className="btn btn-primary" type="submit"><Check size={16}/> Salva lavoro</button></div></form></section>}
      {showDraft && <section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="eyebrow">FATTURAZIONE</span><h2>Prepara bozza interna</h2></div><button className="icon-btn" onClick={closeOverlay}><X size={20}/></button></div><div className="modal-body"><div className="warning-strip"><ShieldAlert size={18}/><span>Prepara i dati della fattura, inclusi i DDT. Il collegamento a Fatture in Cloud non è ancora attivo.</span></div><div className="summary-lines"><p><b>Cliente:</b> {selected[0]?.client.name}</p>{selected.map(r => <div key={r.id} className="summary-line"><span>{r.order.number} · {r.description}</span><strong>{money(sumWork(r))}</strong></div>)}<div className="billing-check"><h3>Controllo dati per Fatture in Cloud</h3><ul>{prepareInvoice(selected).issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul></div><div className="summary-total"><strong>Totale imponibile indicativo</strong><strong>{money(selected.reduce((s, r) => s + sumWork(r), 0))}</strong></div></div></div><div className="modal-foot"><button className="btn btn-plain" onClick={closeOverlay}>Annulla</button><button className="btn btn-primary" onClick={createDraft}><Check size={16}/> Salva preparazione</button></div></section>}
      {workDrawer && <aside className="drawer" role="dialog" aria-modal="true" aria-label="Dettaglio lavorazione"><div className="drawer-top"><div><span className="eyebrow">DETTAGLIO LAVORO</span><h2>{workDrawer.description}</h2><p>{workDrawer.client.name} · {workDrawer.order.number}</p></div><button className="icon-btn" onClick={closeOverlay}><X size={20}/></button></div><form onSubmit={saveEditWork}><div className="drawer-body"><div className="drawer-ref"><Building2 size={19}/><span>{workDrawer.client.name}</span><button type="button" onClick={() => { setDrawerOrderId(workDrawer.order.id); setDrawerWorkId(null); }}>Apri lavoro <ArrowUpRight size={14}/></button></div><Field label="Descrizione lavorazione"><input required value={editWork.description ?? ''} onChange={e => setEditWork(w => ({ ...w, description: e.target.value }))}/></Field><div className="grid-form"><Field label="Quantità"><input type="number" required min={editWork.production ? "0" : "0.01"} step="any" value={editWork.qty ?? 1} onChange={e => setEditWork(w => ({ ...w, qty: Number(e.target.value), production:w.production?{...w.production,quantity:e.target.value}:undefined }))}/></Field><Field label="Prezzo unitario (€)"><input type="number" required min="0" step="0.01" value={editWork.price ?? 0} onChange={e => setEditWork(w => ({ ...w, price: Number(e.target.value) }))}/></Field><Field label="Unità"><input value={editWork.unit ?? 'pz'} onChange={e => setEditWork(w => ({ ...w, unit: e.target.value }))}/></Field><Field label="Operatore"><select value={editWork.operatorId || ''} onChange={e => setEditWork(w => ({ ...w, operatorId: e.target.value }))}><option value="">Non assegnato</option>{db.operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field><Field label="Stato"><select value={editWork.status || 'Da elaborare'} onChange={e => setEditWork(w => ({ ...w, status: e.target.value as Status }))}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></Field><Field label="Consegna lavoro"><div className="readonly-field"><CalendarDays size={15}/>{workDrawer.order.due ? fmtDate(workDrawer.order.due) : 'Non precisata'}</div></Field></div><ProductionFields work={editWork} onChange={production=>setEditWork(w=>({...w,production,qty:/^\d+(?:[.,]\d+)?$/.test(production.quantity)?Number(production.quantity.replace(',','.')):0}))}/><Field label="Note lavorazione"><textarea rows={3} value={editWork.notes || ''} onChange={e => setEditWork(w => ({ ...w, notes: e.target.value }))} placeholder="Indicazioni per la produzione…"/></Field><OrderDates key={'dates-'+workDrawer.order.id} order={workDrawer.order} onSave={changes=>write(s=>({...s,orders:s.orders.map(o=>o.id===workDrawer.order.id?{...o,...changes}:o)}))}/><DeliveryNoteSection key={workDrawer.order.id} order={workDrawer.order} onSave={ddt=>write(s=>({...s,orders:s.orders.map(o=>o.id===workDrawer.order.id?{...o,ddt}:o)}))}/>{workDrawer.order.customerRequestId && <CustomerRequest key={workDrawer.order.customerRequestId} id={workDrawer.order.customerRequestId}/>}<Documents orderId={workDrawer.order.id}/><DeleteOrder key={workDrawer.order.id} order={workDrawer.order} canDelete={!failure && saveStatus !== "Salvataggio…"} getRevision={getRevision}/><div className="drawer-subtitle">Altri lavori nello stesso lavoro</div>{workDrawer.order.lines.filter(w => w.id !== workDrawer.id).map(w => <button type="button" key={w.id} className="sibling" onClick={() => { setDrawerWorkId(w.id); setEditWork({ ...w }); }}><span>{w.description}<small>{quantityLabel(w)} · {w.status}</small></span><ChevronRight size={16}/></button>)}<div className="drawer-amount"><span>Importo riga</span><strong>{editWork.production?.priceUnspecified || (editWork.production && !editWork.qty) ? 'Da definire' : money((Number(editWork.qty) || 0) * (Number(editWork.price) || 0))}</strong></div></div><div className="drawer-foot"><button type="button" className="btn btn-plain" onClick={closeOverlay}>Chiudi</button><button type="submit" className="btn btn-primary"><Check size={16}/> Salva modifiche</button></div></form></aside>}
      {orderDrawer && !workDrawer && <aside className="drawer" role="dialog" aria-modal="true" aria-label="Dettaglio lavoro"><div className="drawer-top"><div><span className="eyebrow">CARTELLA LAVORO</span><h2>{orderDrawer.number}</h2><p>{db.clients.find(c => c.id === orderDrawer.clientId)?.name}</p></div><button className="icon-btn" onClick={closeOverlay}><X size={20}/></button></div><div className="drawer-body"><div className="order-meta"><div><small>DATA ORDINE</small><strong>{fmtDate(orderDrawer.created)}</strong></div><div><small>CONSEGNA</small><strong>{orderDrawer.due ? fmtDate(orderDrawer.due) : 'Non precisata'}</strong></div></div><div className="order-overall"><span>Stato generale</span><StatusLabel status={overallStatus(orderDrawer.lines)}/></div><OrderDates key={'dates-'+orderDrawer.id} order={orderDrawer} onSave={changes=>write(s=>({...s,orders:s.orders.map(o=>o.id===orderDrawer.id?{...o,...changes}:o)}))}/><DeliveryNoteSection key={orderDrawer.id} order={orderDrawer} onSave={ddt=>write(s=>({...s,orders:s.orders.map(o=>o.id===orderDrawer.id?{...o,ddt}:o)}))}/>{orderDrawer.customerRequestId && <CustomerRequest key={orderDrawer.customerRequestId} id={orderDrawer.customerRequestId}/>}<Documents orderId={orderDrawer.id}/><div className="drawer-subtitle">{orderDrawer.lines.length} lavorazioni nella cartella</div>{orderDrawer.lines.map(line => <button className="folder-line" key={line.id} onClick={() => { setDrawerOrderId(null); openWork({ ...line, client: db.clients.find(c => c.id === orderDrawer.clientId)!, order: orderDrawer, operator: db.operators.find(o => o.id === line.operatorId)! }); }}><div><strong>{line.description}</strong><small>{quantityLabel(line)} · {workAmount(line)}</small></div><StatusLabel status={line.status}/><ChevronRight size={16}/></button>)}{orderDrawer.notes && <div className="order-note"><strong>Note lavoro</strong><p>{orderDrawer.notes}</p></div>}<div className="drawer-amount"><span>Totale lavori</span><strong>{orderDrawer.lines.some(l=>l.production?.priceUnspecified || (l.production&&!l.qty))?'Da definire':money(orderDrawer.lines.reduce((s, l) => s + sumWork(l), 0))}</strong></div><DeleteOrder key={orderDrawer.id} order={orderDrawer} canDelete={!failure && saveStatus !== "Salvataggio…"} getRevision={getRevision}/><p className="helper-text">I lavori mantengono stato e operatore indipendenti, anche se appartengono allo stesso lavoro.</p></div><div className="drawer-foot"><button className="btn btn-primary" onClick={closeOverlay}>Chiudi cartella</button></div></aside>}
    </div>}
    {showImport && <ExcelImport store={db} onClose={()=>setShowImport(false)} onImport={next=>{setDb(next);setShowImport(false);setSearch('');setYear('');setMonth('');notify('Importazione applicata. Controlla lo stato del salvataggio in alto.');}}/>}
    {toastMessage && <div className="toast"><CheckCircle2 size={18}/>{toastMessage}<button onClick={() => setToastMessage('')}><X size={15}/></button></div>}
  </div>;
}
