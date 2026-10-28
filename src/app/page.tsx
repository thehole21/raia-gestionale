'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode, ChangeEvent } from 'react';
import {
  LayoutGrid, ListTodo, Folders, Users, ReceiptText, Settings2, Search, Plus, ChevronRight,
  ChevronDown, ChevronLeft, ArrowUpRight, Filter, X, Check, CalendarDays, Clock3,
  CheckCircle2, AlertTriangle, ClipboardList, Download, Upload, Trash2,
  ExternalLink, FileText, Menu, Layers3, Building2, Sparkles,
  ArrowRight, ArrowLeft, ShieldAlert, Bell, Hash, Pencil,
} from 'lucide-react';
import {
  type Store, type Work, type WorkRow, type Status, type Order, type Client,
  STATUSES, money, fmtDate, shortDate, today, id, initials, sumWork, isClosed, flatten, seeded, migrateV1,
} from '@/lib/data';

import { ProductionFields } from '@/src/components/production-fields';
import { quantityLabel, workAmount, workDue, isInvoiced, isWorkClosed } from '@/lib/data';
import { AccessGate, useAccess } from '@/src/components/access';
import { StaffQuote } from '@/src/components/staff-quote';
import { Operators } from '@/src/components/operators';
import { CustomerRequest } from '@/src/components/quote-components';
import { Documents } from '@/src/components/documents';
import {ExcelBackupButton} from '@/src/components/excel-backup-button';
import { ExcelImport } from '@/src/components/excel-import';
import { useWorkspace } from '@/lib/use-workspace';
import { CancelledOrders } from '@/src/components/cancelled-orders';
import { DeleteOrder } from '@/src/components/delete-order';
import {DeleteClient} from '@/src/components/delete-client';
import {ClientEditor} from '@/src/components/client-editor';
import {DocumentLauncher} from '@/src/components/document-launcher';
import {BillingMark} from '@/src/components/billing-mark';
import {DdtGenerator} from '@/src/components/ddt-generator';
import type {DeliveryNote} from '@/lib/data';
import {OrderActions,DeleteWorkButton} from '@/src/components/order-actions';
import {BookRegister} from '@/src/components/book-register';
import {workCategory,bookProduction,type WorkCategory} from '@/lib/work-categories';
import { OverviewRegister } from '@/src/components/overview-register';
import type { PendingEditChange } from '@/lib/pending-edits';
import { WorkGroups } from '@/src/components/work-groups';
import { OrderDates } from '@/src/components/order-dates';
import { overallStatus, executionDay, planningPeriod, matchesPeriod, workPeriods, orderRegistrationNumbers } from '@/lib/order-groups';
import {sharedDDT,changeGroupDates,saveGroupDDT,inheritGroupDDT,groupInvoiceRows,prepareGroupDraft} from '@/lib/group-documents';
import { DeliveryNoteSection } from '@/src/components/delivery-note';
import { prepareInvoice, draftRows } from '@/lib/billing';
import { automaticSolicitationKey, isOrderAutomaticallySolicited, isOrderSolicited } from '@/lib/order-solicitation';
import { cloud } from '@/lib/supabase';
type Section = 'work' | 'orders' | 'clients' | 'billing' | 'estimator' | 'settings';
type FilterType = 'all' | 'active' | 'solicited' | 'planned' | 'working' | 'ready' | 'unbilled' | 'delivered' | 'cancelled';
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
  const [category,setCategory]=useState<WorkCategory>('general');
  const [orderCategory,setOrderCategory]=useState<WorkCategory>('general');
  const [quick, setQuick] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');


  const [selectedWork, setSelectedWork] = useState<string[]>([]);
  const [drawerWorkId, setDrawerWorkId] = useState<string | null>(null);
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [closeAfterSave,setCloseAfterSave]=useState(false);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [editingClient,setEditingClient]=useState<Client|null>(null);
  const [confirmUnsavedExit,setConfirmUnsavedExit]=useState(false);
  const [,setPendingSectionChanges]=useState(false);
  const pendingSectionSaves=useRef(new Map<string,()=>boolean>());
  const pendingExitAction=useRef<()=>void>(()=>{});
  const requestCloseRef=useRef<()=>void>(()=>{});
  const [showDraft, setShowDraft] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  useEffect(()=>{try{setSidebarCollapsed(localStorage.getItem('raia-sidebar-collapsed')==='true');}catch{}},[]);
  function toggleSidebar(){setSidebarCollapsed(value=>{try{localStorage.setItem('raia-sidebar-collapsed',String(!value));}catch{}return !value;});}
  const [toastMessage, setToastMessage] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [orderClient, setOrderClient] = useState('');
  const [inlineClientOpen,setInlineClientOpen]=useState(false);
  const [inlineClient,setInlineClient]=useState({name:'',email:'',phone:''});
  const [orderDate, setOrderDate] = useState('');
  const [executionDate, setExecutionDate] = useState('');
  const [orderDue, setOrderDue] = useState('');
  const [orderTitle, setOrderTitle] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderLines, setOrderLines] = useState<NewLine[]>([]);
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '', address: '', postalCode: '', city: '', province: '', country: 'IT', vat: '', taxCode: '', recipientCode: '', pec: '' });
  const [editWork, setEditWork] = useState<Partial<Work>>({});
  const [savedEditWork, setSavedEditWork] = useState<Partial<Work>>({});

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(()=>{const handler=(event:Event)=>{const {key,dirty,save}=(event as CustomEvent<PendingEditChange>).detail;if(dirty)pendingSectionSaves.current.set(key,save);else pendingSectionSaves.current.delete(key);setPendingSectionChanges(pendingSectionSaves.current.size>0);};window.addEventListener('raia-pending-edit',handler);return()=>window.removeEventListener('raia-pending-edit',handler);},[]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSection('work'); setTimeout(() => searchRef.current?.focus(), 0); }
      if (e.key === 'Escape') { requestCloseRef.current(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => { if (drawerWorkId) {const w=flatten(db).find(w=>w.id===drawerWorkId);const initial=w?{...w,...(workCategory(w,w.order)==='books'?{production:bookProduction(w,w.order)}:{})}:{};setEditWork(initial);setSavedEditWork(initial);} }, [drawerWorkId]); // intentional initial snapshot
  useEffect(() => () => { if (toastTimeout.current) clearTimeout(toastTimeout.current); }, []);

  function notify(msg: string) { setToastMessage(msg); if (toastTimeout.current) clearTimeout(toastTimeout.current); toastTimeout.current = setTimeout(() => setToastMessage(''), 3800); }
  function write(update: (current: Store) => Store) { setDb(current => update(current)); }
  function activity(current: Store, message: string): Store { return { ...current, activity: [{ id: id(), at: today(), text: message }, ...current.activity].slice(0, 80) }; }
  function navigate(s: Section) { requestExit(()=>{setSection(s);setMobileNav(false);setDrawerOrderId(null);setDrawerWorkId(null);if(s!=='work')setSelectedWork([]);}); }

  const rows = useMemo(() => flatten(db), [db]);
  const orderNumbers = useMemo(() => orderRegistrationNumbers(db.orders), [db.orders]);
  const overviewRows = useMemo(()=>rows.filter(r=>workCategory(r,r.order)===category),[rows,category]);
  const indexed = useMemo(() => new Map(rows.map(r => [r.id, r])), [rows]);
  const totalPending = overviewRows.filter(r => !isWorkClosed(r)).length;
  const solicitedOrders = new Set(overviewRows.filter(r => isOrderSolicited(r.order, now)).map(r => r.order.id)).size;
  const isPlanned = (r:WorkRow) => !isWorkClosed(r) && ['Bozza','Procedere','Da elaborare'].includes(r.status);
  const planned = overviewRows.filter(isPlanned).length;
  const inProgress = overviewRows.filter(r => ['In lavorazione','In Stampa','In allestimento'].includes(r.status)).length;
  const ready = overviewRows.filter(r => r.status === 'Pronto' || r.status === 'Elaborato').length;
  const uninvoicedRows = rows.filter(r => !isInvoiced(r));
  const toInvoice = uninvoicedRows.reduce((s, r) => s + sumWork(r), 0);
  const overdue = rows.filter(r => !isWorkClosed(r) && r.order.due && r.order.due < today()).length;
  const hasWorkTerm = (r: WorkRow, term: string) => [r.description, r.order.title, r.client.name, r.order.number, r.order.ddt?.number, r.operator.name, r.status, r.order.notes, r.notes, r.order.created, r.order.executionDate, r.production?.supplier, r.production?.ddtNumber, r.production?.delivery, r.production?.invoicing, r.production?.section, r.production?.category, r.production?.comments].join(' ').toLocaleLowerCase('it').includes(term);
  const filtered = useMemo(() => overviewRows.filter(r => {
    if (!matchesPeriod(r,year,month)) return false;
    if (search && !hasWorkTerm(r, search.trim().toLocaleLowerCase('it'))) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    if (operatorFilter && r.operatorId !== operatorFilter) return false;
    if (clientFilter && r.client.id !== clientFilter) return false;
    if (quick === 'active' && isWorkClosed(r)) return false;
    if (quick === 'solicited' && !isOrderSolicited(r.order, now)) return false;
    if (quick === 'planned' && !isPlanned(r)) return false;
    if (quick === 'working' && !['In lavorazione','In Stampa','In allestimento'].includes(r.status)) return false;
    if (quick === 'ready' && !['Pronto', 'Elaborato'].includes(r.status)) return false;
    if (quick === 'unbilled' && isInvoiced(r)) return false;
    if (quick === 'delivered' && r.status !== 'Consegnato') return false;
    return true;
  }).sort((a, b) => executionDay(b.order).localeCompare(executionDay(a.order)) || b.order.number.localeCompare(a.order.number)), [overviewRows, search, statusFilter, operatorFilter, clientFilter, quick, year, month, now]);
  const selected = rows.filter(r=>selectedWork.includes(r.id)&&!isInvoiced(r));
  const selectedClients = new Set(selected.map(r => r.client.id));
  const validSelected = selected.length > 0 && selectedClients.size === 1;
  const orderDrawer = db.orders.find(o => o.id === drawerOrderId) || null;
  const workDrawer = drawerWorkId ? indexed.get(drawerWorkId) : null;
  const workFingerprint=(work:Partial<Work>)=>JSON.stringify([work.description,work.qty,work.price,work.unit,work.status,work.operatorId,work.notes,work.production?{...work.production,ddtNumber:undefined}:null]);
  const workChangesPending=!!workDrawer&&workFingerprint(editWork)!==workFingerprint(savedEditWork);

  function validAssignee(next: string, previous = '') { return !next || next === previous || db.operators.some(o => o.id === next); }
  function updateWork(workId: string, changes: Partial<Work>) {
    const previous = db.orders.flatMap(o=>o.lines).find(w=>w.id===workId)?.operatorId || '';
    if (changes.operatorId !== undefined && !validAssignee(changes.operatorId,previous)) { notify('Operatore non più disponibile. Scegli un account attivo dalle Impostazioni.'); return; }
    write(current => activity({ ...current, orders: current.orders.map(order => ({ ...order, lines: order.lines.map(w => w.id === workId ? { ...w, ...changes, production:changes.production?{...changes.production,ddtNumber:order.ddt?.number||w.production?.ddtNumber||''}:w.production } : w) })) }, `Lavorazione aggiornata`));
  }
  function updateClient(clientId: string, changes: Partial<Client>) {
    write(current => {
      const client = current.clients.find(item => item.id === clientId);
      if (!client) return current;
      const next = { ...current, clients: current.clients.map(item => item.id === clientId ? { ...item, ...changes } : item) };
      const drafts = next.drafts.map(draft => draft.clientId === clientId ? { ...draft, preparedInvoice: prepareInvoice(draftRows(next, draft.workIds)) } : draft);
      return activity({ ...next, drafts }, `Aggiornata anagrafica cliente ${client.name}`);
    });
  }
  function deleteClientFromDemo(clientId: string) {
    write(current => {
      const client = current.clients.find(item => item.id === clientId);
      if (!client || current.orders.some(order => order.clientId === clientId) || current.drafts.some(draft => draft.clientId === clientId)) return current;
      return activity({ ...current, clients: current.clients.filter(item => item.id !== clientId) }, `Eliminato cliente ${client.name}`);
    });
    notify('Cliente eliminato.');
  }
  function toggleOrderSolicited(orderId: string, solicited: boolean) {
    const order = db.orders.find(item => item.id === orderId);
    if (!order || isOrderSolicited(order, now) === solicited) return;
    const automaticKey = automaticSolicitationKey(order, now);
    write(current => activity({ ...current, orders: current.orders.map(item => item.id === orderId ? {
      ...item,
      solicited,
      solicitedAutoDismissedDue: solicited ? undefined : automaticKey || item.solicitedAutoDismissedDue,
    } : item) }, `${solicited ? 'Sollecitato' : 'Rimosso sollecito da'} ordine ${order.number}`));
  }
  function setSelected(wid: string, checked: boolean) { setSelectedWork(previous => checked ? [...new Set([...previous, wid])] : previous.filter(x => x !== wid)); }
  function startOrder(clientId = '') {
    setOrderCategory(category);
    setInlineClientOpen(false);setInlineClient({name:'',email:'',phone:''});
    setOrderClient(clientId || db.clients[0]?.id || ''); setOrderDate(today()); setExecutionDate(''); setOrderDue(''); setOrderNotes(''); setOrderTitle(''); setOrderLines([newLine(defaultAssignee)]); setShowNewOrder(true);
  }
  function createInlineClient() {
    const name=inlineClient.name.trim(),email=inlineClient.email.trim();
    if(!name){notify('Inserisci il nome del cliente.');return;}
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){notify('Controlla l’indirizzo email del cliente.');return;}
    const existing=db.clients.find(c=>c.name.trim().toLocaleLowerCase('it')===name.toLocaleLowerCase('it'));
    if(existing){setOrderClient(existing.id);setInlineClientOpen(false);notify('Cliente già presente: selezionato per il lavoro.');return;}
    const client:Client={id:id(),name,email,phone:inlineClient.phone.trim(),city:'',vat:''};
    write(s=>activity({...s,clients:[...s.clients,client]},`Aggiunto cliente ${name}`));
    setOrderClient(client.id);setInlineClientOpen(false);setInlineClient({name:'',email:'',phone:''});notify('Cliente creato e selezionato per il lavoro.');
  }
  function saveNewOrder(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(inlineClientOpen){notify('Crea e seleziona il cliente, oppure chiudi il riquadro Nuovo cliente prima di salvare il lavoro.');return;}
    const lines = orderLines.filter(l => l.description.trim());
    if (!orderTitle.trim() || !orderClient || !lines.length) { notify('Inserisci titolo, cliente e almeno una lavorazione.'); return; }
    if (lines.some(l => !Number.isFinite(Number(l.qty)) || Number(l.qty) <= 0 || Number(l.price) < 0 || !Number.isFinite(Number(l.price)))) { notify('Controlla quantità e prezzi.'); return; }
    if (lines.some(l=>!validAssignee(l.operatorId))) { notify('Un operatore non è più disponibile. Aggiorna l’assegnazione prima di salvare.'); return; }
    const max = Math.max(0, ...db.orders.map(o => Number(o.number.replace(/\D/g, '')) || 0));
    const number = 'R-' + String(max + 1).padStart(6, '0');
    const order: Order = { id: id(), title: orderTitle.trim(), number, clientId: orderClient, created: orderDate || today(), executionDate, due: orderDue, notes: orderNotes.trim(), lines: lines.map(l => ({ id: id(), description: l.description.trim(), qty: Number(l.qty), unit: l.unit || 'pz', price: Number(l.price), status: l.status, operatorId: l.operatorId, invoiceId: null, notes: '',production:{...bookProduction({qty:Number(l.qty),status:l.status,production:undefined},{due:orderDue} as Order),category:orderCategory==='books'?'Libri':'Lavori',priceUnspecified:true} })) };
    write(s => activity({ ...s, orders: [inheritGroupDDT(s.orders,order), ...s.orders] }, `Creato lavoro ${number} con ${lines.length} lavorazioni`));
    setShowNewOrder(false); setCategory(orderCategory); setSection('work'); setQuick('all'); setSearch(''); setClientFilter(''); setStatusFilter(''); setOperatorFilter(''); notify(`${number} creata: ${lines.length} lavorazioni visibili nell’elenco.`);
  }
  function openWork(w: WorkRow) { requestExit(()=>{const initial={ ...w,...(workCategory(w,w.order)==='books'?{production:bookProduction(w,w.order)}:{}) };setDrawerOrderId(null);setDrawerWorkId(w.id);setEditWork(initial);setSavedEditWork(initial);}); }
  function persistEditWork():boolean {
    if (!workDrawer) return false;
    if (!validAssignee(editWork.operatorId || '',workDrawer.operatorId)) { notify('Operatore non più disponibile. Aggiorna l’assegnazione prima di salvare.'); return false; }
    if (!String(editWork.description || '').trim() || !Number.isFinite(Number(editWork.qty)) || !Number.isFinite(Number(editWork.price)) || (Number(editWork.qty) < 0 || (!editWork.production && Number(editWork.qty) === 0)) || Number(editWork.price) < 0) { notify('Descrizione, quantità e prezzo non validi.'); return false; }
    if(workDrawer && workFingerprint({...workDrawer,...(workCategory(workDrawer,workDrawer.order)==='books'?{production:bookProduction(workDrawer,workDrawer.order)}:{})})!==workFingerprint(savedEditWork)){notify('Questo lavoro è stato aggiornato nel frattempo. Copia le tue modifiche e riapri il dettaglio prima di salvare.');return false;}
    const changes={ description: String(editWork.description).trim(), qty: Number(editWork.qty), price: Number(editWork.price), unit: String(editWork.unit || 'pz'), status: (editWork.status || 'Da elaborare') as Status, operatorId: String(editWork.operatorId), notes: String(editWork.notes || ''), production: editWork.production };
    updateWork(workDrawer.id, changes);setEditWork(current=>({...current,...changes}));setSavedEditWork(current=>({...current,...changes}));notify('Lavorazione salvata.');return true;
  }
  function saveEditWork(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();if(failure||closeAfterSave)return;
    if(!persistEditWork())return;
    for(const save of [...pendingSectionSaves.current.values()])if(!save())return;
    setCloseAfterSave(true);
  }
  useEffect(()=>{if(!closeAfterSave||saveStatus==='Salvataggio…')return;setCloseAfterSave(false);if(failure)return;finishOverlay();},[closeAfterSave,saveStatus,failure]);
  function createDraft() {
    if (!validSelected) { notify('Seleziona lavori non ancora assegnati a una bozza, tutti dello stesso cliente.'); return; }
    const number = 'BOZ-' + String(db.drafts.length + 1).padStart(4, '0');
    const fresh={id:id(),number,created:today(),clientId:selected[0].client.id,workIds:[],submissionKey:crypto.randomUUID()};
    try { prepareGroupDraft(db,selectedWork,fresh); } catch(error){notify((error as Error).message);return;}
    write(s=>activity(prepareGroupDraft(s,selectedWork,fresh),'Preparata fattura unica per ordine'));
    setSelectedWork([]);setShowDraft(false);setSection('billing');notify('Bozza unica preparata o aggiornata. Nessuna fattura inviata.');
  }
  function saveTitle(orderId:string,title:string,previous:string):boolean {
    try {write(s=>{const order=s.orders.find(o=>o.id===orderId);if(!order||(order.title||'')!==previous)throw new Error('Titolo aggiornato da un altro operatore.');return activity({...s,orders:s.orders.map(o=>o.id===orderId?{...o,title}:o)},'Modificato titolo del lavoro');});return true;}catch(error){notify((error as Error).message);return false;}
  }
  function saveDates(order:Order,changes:Pick<Order,'created'|'executionDate'|'due'>):boolean {
    try {changeGroupDates(db,order.id,changes);write(s=>changeGroupDates(s,order.id,changes));return true;}catch(error){notify((error as Error).message);return false;}
  }
  function saveGeneratedDDT(order:Order,ddt:DeliveryNote):boolean {
    try {saveGroupDDT(db,order,ddt);write(s=>({...saveGroupDDT(s,order,ddt),ddtIssuer:ddt.document?.issuer||s.ddtIssuer}));return true;}catch(error){notify((error as Error).message);return false;}
  }
  function saveDDT(order:Order,ddt:{number:string;date:string}):boolean {
    try {saveGroupDDT(db,order,ddt);}catch(error){notify((error as Error).message);return false;}
    write(s=>activity(saveGroupDDT(s,order,ddt),'Aggiornato DDT del ordine'));return true;
  }

  function deleteDraft(draftId: string) {
    const target=db.drafts.find(d=>d.id===draftId);
    if(target?.remoteDocumentId||target&&target.status&&!['draft','validated'].includes(target.status)){notify('Documento già elaborato: non può essere eliminato come una bozza locale.');return;}
    if (!window.confirm('Eliminare la bozza? Le lavorazioni torneranno disponibili per nuove bozze.')) return;
    write(s => activity({ ...s, drafts: s.drafts.filter(d => d.id !== draftId), orders: s.orders.map(order => ({ ...order, lines: order.lines.map(w => w.invoiceId === draftId ? { ...w, invoiceId: null } : w) })) }, 'Bozza interna eliminata'));
    notify('Bozza eliminata e lavorazioni liberate.');
  }
  function download(content: string, filename: string, mime: string) { const blob = new Blob([content], { type: mime }); const href = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = href; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(href), 1000); }
  function exportCSV() {
    const value = (s: unknown) => '"' + String(typeof s === 'string' && /^[=+@\-\t\r]/.test(s) ? "'" + s : s ?? '').replaceAll('"', '""') + '"';
    const header = ['Data','Lavoro','Cliente','Lavorazione','Quantità','Unità','Prezzo unitario','Importo','Stato','Operatore','Scadenza','Bozza','Numero DDT','Data DDT','Data esecuzione','Mese programmazione','Fornitore','Modalità consegna','Terminato','Fatturato','Foglio origine','Riga origine','Sezione','Categoria','Numero libro','Orario ingresso','Orario uscita','Urgente','Commenti','Altre annotazioni'];
    const body = filtered.map(r => [r.order.created, r.order.number, r.client.name, r.description, r.production ? r.production.quantity : r.qty, r.unit, r.production?.priceUnspecified ? '' : r.price, r.production?.priceUnspecified || (r.production&&!r.qty) ? '' : sumWork(r), r.status, r.operator.name, workDue(r,r.order) || r.production?.requestedText || '', r.invoiceId || '', r.production?.ddtNumber || r.order.ddt?.number || '', r.order.ddt?.date || '', r.order.executionDate || '', workPeriods(r).join(', '), r.production?.supplier || '', r.production?.delivery || '', r.production ? (r.production.terminated?'Sì':'No') : '', r.production?.invoicing || '', r.source?.sheet || '', r.source?.row || '', r.production?.section || '', r.production?.category || '', r.production?.bookNumber || '', r.production?.entryTime || '', r.production?.exitTime || '', r.production?.urgent ? 'Sì' : '', r.production?.comments || '', r.production?.additionalNotes || ''].map(value).join(';'));
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
    { id: 'all', label: 'Tutti', count: overviewRows.length }, { id: 'active', label: 'Da seguire', count: totalPending },
    { id: 'solicited', label: 'Ordini Sollecitati', count: solicitedOrders },
    { id: 'planned', label: 'In programma', count: planned }, { id: 'working', label: 'In lavorazione', count: inProgress }, { id: 'ready', label: 'Pronti / elaborati', count: ready },
    { id: 'unbilled', label: 'Da fatturare', count: overviewRows.filter(r=>!isInvoiced(r)).length }, { id: 'delivered', label: 'Consegnati', count: overviewRows.filter(r => r.status === 'Consegnato').length },
  ];
  function finishOverlay(){setConfirmUnsavedExit(false);setShowNewOrder(false);setShowNewClient(false);setShowDraft(false);setDrawerWorkId(null);setDrawerOrderId(null);pendingSectionSaves.current.clear();setPendingSectionChanges(false);}
  function requestExit(action:()=>void=finishOverlay,workAlreadySaved=false){pendingExitAction.current=action;if((workChangesPending&&!workAlreadySaved)||pendingSectionSaves.current.size>0){setConfirmUnsavedExit(true);return;}action();}
  function closeOverlay(){requestExit();}
  requestCloseRef.current=closeOverlay;
  function saveAndExit(){if(pendingSectionSaves.current.size>0)for(const save of pendingSectionSaves.current.values())if(!save())return;if(workChangesPending&&!persistEditWork())return;pendingExitAction.current();}
  function exitWithoutSaving(){pendingExitAction.current();}

  const renderDelete=(order:Order,workId:string)=><DeleteWorkButton order={order} workId={workId} canDelete={!failure&&saveStatus!=="Salvataggio…"} getRevision={getRevision}/>;
  const renderActions=(order:Order)=><><span className="order-billed">Fatturato <BillingMark rows={rows.filter(r=>r.order.id===order.id)}/></span><OrderActions order={order} selected={selectedWork} onSelectAll={(ids,checked)=>setSelectedWork(previous=>checked?[...new Set([...previous,...ids])]:previous.filter(id=>!ids.includes(id)))} canDelete={!failure&&saveStatus!=="Salvataggio…"} getRevision={getRevision}/></>;
  const workTable = (items: WorkRow[], compact = false) => <div className="table-scroll"><table className={'work-table ' + (compact ? 'table--compact' : '')}>
    <thead><tr><th className="check-col"><input type="checkbox" aria-label="Seleziona lavori visibili" checked={items.filter(r => !isInvoiced(r)).length > 0 && items.filter(r => !isInvoiced(r)).every(r => selectedWork.includes(r.id))} onChange={e => {
      const ids = items.filter(r => !isInvoiced(r)).map(r => r.id);
      setSelectedWork(old => e.target.checked ? [...new Set([...old, ...ids])] : old.filter(s => !ids.includes(s)));
    }} /></th><th>CLIENTE / LAVORO</th><th>LAVORAZIONE</th><th>Q.TÀ</th><th>STATO</th><th>OPERATORE</th><th>CONSEGNA RICHIESTA</th><th>FORNITORE / CONSEGNA</th><th>TERMINATO</th><th>FATTURATO</th><th className="align-right">IMPORTO</th><th /></tr></thead>
    <tbody>{items.map(r => <tr key={r.id} className={selectedWork.includes(r.id) ? 'row-selected' : ''}>
      <td className="check-col"><input type="checkbox" aria-label={'Seleziona ' + r.description} disabled={isInvoiced(r)} checked={selectedWork.includes(r.id)} onChange={e => setSelected(r.id, e.target.checked)} /></td>
      <td><button className="cell-link company-cell" onClick={() => { setDrawerWorkId(null); setDrawerOrderId(r.order.id); }}><span className="company-avatar">{initials(r.client.name)}</span><span><strong>{r.client.name}</strong><small>{r.order.number} · {shortDate(r.order.created)}</small></span></button></td>
      <td><button className="cell-link job-cell" onClick={() => openWork(r)}><strong>{r.description}</strong>{(r.production?.section||r.production?.category==='Libri')&&<small>{[r.production?.category==='Libri'?'Libri':'',r.production?.section].filter(Boolean).join(' · ')}</small>}<small>{r.invoiceId ? 'Nella bozza ' + (db.drafts.find(d => d.id === r.invoiceId)?.number || '') : 'Apri dettagli e modifica'}</small></button></td>
      <td className="qty-cell">{quantityLabel(r)}</td>
      <td><select title="Cambia stato" aria-label={'Stato di ' + r.description} className={'inline-status inline-status--' + statusColor[r.status]} value={r.status} onChange={e => updateWork(r.id, { status: e.target.value as Status })}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></td>
      <td><select title="Cambia operatore" aria-label={'Operatore di ' + r.description} className="inline-operator" value={r.operatorId} onChange={e => updateWork(r.id, { operatorId: e.target.value })}><option value="">Non assegnato</option>{r.operatorId&&!db.operators.some(o=>o.id===r.operatorId)&&<option disabled value={r.operatorId}>{r.operator.name} · storico</option>}{db.operators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}</select></td>
      <td className="date-cell"><span className={workDue(r,r.order) && workDue(r,r.order) < today() && !isWorkClosed(r) ? 'due-late' : ''}>{workDue(r,r.order) ? shortDate(workDue(r,r.order)) : r.production?.requestedText || 'Non precisata'}</span></td>
      <td><span>{r.production?.supplier || '—'}</span><small className="production-sub">{r.production?.delivery || ''}</small></td>
      <td>{r.production ? <input type="checkbox" aria-label={'Terminato: '+r.description} checked={r.production.terminated} onChange={e=>updateWork(r.id,{production:{...r.production!,terminated:e.target.checked}})}/> : '—'}</td>
      <td><BillingMark rows={[r]}/></td>
      <td className="align-right amount-cell">{workAmount(r)}{renderDelete(r.order,r.id)}</td>
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
          <div className="titlebar"><div><h1>Panoramica</h1><p>Organizza il lavoro. Segui ogni dettaglio.</p></div><div className="title-actions"><button className="btn btn-plain" onClick={()=>setShowImport(true)}><Upload size={16}/> Importa Excel</button><button className="btn btn-plain" onClick={() => { setNewClient({ name: '', email: '', phone: '', address: '', postalCode: '', city: '', province: '', country: 'IT', vat: '', taxCode: '', recipientCode: '', pec: '' }); setShowNewClient(true); }}><Users size={16}/> Nuovo cliente</button><button className="btn btn-primary" onClick={() => startOrder()}><Plus size={17}/> Nuovo lavoro</button></div></div>
          <nav className="register-category-nav" aria-label="Tipo di lavorazione">{[{id:'general',label:'Lavorazioni generali'},{id:'books',label:'Libri'}].map(t=><button type="button" key={t.id} aria-pressed={category===t.id} className={category===t.id?'active':''} onClick={()=>{setCategory(t.id as WorkCategory);setSelectedWork([]);setQuick('all');}}>{t.label}<span>{rows.filter(r=>workCategory(r,r.order)===t.id).length}</span></button>)}</nav>
          <div className="metrics metrics-four">
            <button className={'metric ' + (quick === 'all' ? 'metric-chosen' : '')} onClick={() => setQuick('all')}><div className="metric-top"><span>Lavorazioni totali</span><span className="metric-icon neutral"><Layers3 size={20}/></span></div><strong>{overviewRows.length}</strong><small>Tutte le voci del registro <ArrowUpRight size={13}/></small></button>
            <button className={'metric ' + (quick === 'active' ? 'metric-chosen' : '')} onClick={() => setQuick('active')}><div className="metric-top"><span>Lavori da seguire</span><span className="metric-icon orange"><Clock3 size={20}/></span></div><strong>{totalPending}</strong><small>Ancora in corso <ArrowUpRight size={13}/></small></button>
            <button className={'metric ' + (quick === 'planned' ? 'metric-chosen' : '')} onClick={() => setQuick('planned')}><div className="metric-top"><span>In programma</span><span className="metric-icon blue"><CalendarDays size={20}/></span></div><strong>{planned}</strong><small>Bozza, procedere e da elaborare <ArrowUpRight size={13}/></small></button>
            <button className={'metric ' + (quick === 'solicited' ? 'metric-chosen' : '')} onClick={() => setQuick('solicited')}><div className="metric-top"><span>Ordini Sollecitati</span><span className="metric-icon orange"><AlertTriangle size={20}/></span></div><strong>{solicitedOrders}</strong><small>Ordini segnalati <ArrowUpRight size={13}/></small></button>
          </div>
          <div className="workspace-card">
            <div className="card-top"><div><h2>{category==='books'?'Registro libri':'Registro lavorazioni generali'} {quick!=='cancelled'&&<span className="head-count">{filtered.length}</span>}</h2><p>Ogni ordine ha le proprie righe, anche per lo stesso cliente nella stessa giornata.</p></div><button disabled={quick==='cancelled'} className="btn btn-small btn-plain" onClick={exportCSV}><Download size={15}/> Esporta CSV</button></div>
            <div className="tabs" role="tablist" aria-label="Filtra lavorazioni">{tabSet.map(t => <button key={t.id} role="tab" aria-selected={quick === t.id} className={'tab ' + (quick === t.id ? 'tab-active' : '')} onClick={() => setQuick(t.id)}>{t.label}<span>{t.count}</span></button>)}<button role="tab" aria-selected={quick==='cancelled'} className={'tab '+(quick==='cancelled'?'tab-active':'')} onClick={()=>setQuick('cancelled')}>Ordini annullati</button></div>
            {quick==='cancelled'?<CancelledOrders demo={demo} category={category}/>:<>{clientFilter && <div className="client-filter-bar">Lavori di: <strong>{db.clients.find(c => c.id === clientFilter)?.name}</strong><button onClick={() => setClientFilter('')}>Rimuovi filtro <X size={13}/></button></div>}{periodFilters}<div className="filterbar"><div className="search-field"><Search size={18}/><input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca azienda, prodotto, lavoro, operatore…" aria-label="Cerca tutti i lavori"/><kbd>Ctrl K</kbd>{search && <button aria-label="Cancella ricerca" onClick={() => setSearch('')}><X size={15}/></button>}</div>
              <div className="filter-controls"><select aria-label="Filtra per stato" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">Tutti gli stati</option>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select><select aria-label="Filtra per operatore" value={operatorFilter} onChange={e => setOperatorFilter(e.target.value)}><option value="">Tutti gli operatori</option>{db.operators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}</select></div>
            </div>
            {!filtered.length ? <Empty title="Nessun lavoro trovato" detail="Prova a cambiare i filtri o inserisci un nuovo lavoro."/> : category==='books'?<BookRegister renderActions={renderActions} renderDelete={renderDelete} onTitleSave={saveTitle} canDelete={!failure && saveStatus !== "Salvataggio…"} getRevision={getRevision} all={overviewRows} visible={filtered} operators={db.operators} selected={selectedWork} onSelect={setSelected} onUpdate={updateWork} onOpen={openWork} onToggleSolicited={toggleOrderSolicited} now={now}/>:<OverviewRegister renderActions={renderActions} renderDelete={renderDelete} onTitleSave={saveTitle} all={overviewRows} visible={filtered} operators={db.operators} selected={selectedWork} onSelect={setSelected} onUpdate={updateWork} onOpen={openWork} onToggleSolicited={toggleOrderSolicited} orderNumbers={orderNumbers} now={now}/>}
            <div className="table-foot"><span>Mostrate <strong>{filtered.length}</strong> di {overviewRows.length} lavorazioni</span><span><span className="foot-dot"/> Modifica processo e operatore direttamente nel registro</span></div></>}
          </div>
        </>}

        {section === 'orders' && <><div className="eyebrow">ORGANIZZAZIONE</div><div className="titlebar"><div><h1>Storico</h1><p>Ogni richiesta è un ordine distinto, con tutte le sue righe già visibili.</p></div><button className="btn btn-primary" onClick={() => startOrder()}><Plus size={17}/> Nuovo lavoro</button></div><div className="section-filter"><div className="search-field"><Search size={17}/><input placeholder="Cerca per cliente, descrizione o numero lavoro…" value={search} onChange={e => setSearch(e.target.value)}/></div></div>{periodFilters}<div className="workspace-card order-groups-card">{clientFilter&&<div className="client-filter-bar">Lavori di: <strong>{db.clients.find(c=>c.id===clientFilter)?.name}</strong><button onClick={()=>setClientFilter('')}>Mostra tutti i clienti <X size={13}/></button></div>}<WorkGroups renderActions={renderActions} onTitleSave={saveTitle} all={rows} visible={rows.filter(r=>(!clientFilter||r.client.id===clientFilter)&&matchesPeriod(r,year,month)&&(!search||hasWorkTerm(r,search.trim().toLocaleLowerCase('it'))))} renderRows={items=>workTable(items,true)}/></div></>}

        {section === 'clients' && <><div className="eyebrow">ANAGRAFICHE</div><div className="titlebar"><div><h1>Clienti</h1><p>Tutte le aziende con storico lavori e lavori sempre collegati.</p></div><button className="btn btn-primary" onClick={() => setShowNewClient(true)}><Plus size={17}/> Nuovo cliente</button></div><div className="section-filter"><div className="search-field"><Search size={17}/><input placeholder="Cerca un cliente…" value={search} onChange={e => setSearch(e.target.value)}/></div></div><div className="client-grid">{db.clients.filter(c => [c.name, c.email, c.vat].join(' ').toLocaleLowerCase('it').includes(search.toLocaleLowerCase('it'))).map(c => {
          const own = rows.filter(r => r.client.id === c.id),clientOrders=db.orders.filter(order=>order.clientId===c.id),clientDrafts=db.drafts.filter(draft=>draft.clientId===c.id);
          return <article key={c.id} className="client-card"><button type="button" className="client-edit-main" aria-label={"Modifica cliente "+c.name} onClick={()=>setEditingClient({...c})}><div className="client-card-head"><span className="company-avatar large">{initials(c.name)}</span><Pencil size={18}/></div><strong>{c.name}</strong><small>{c.email || 'Nessuna email'} </small><span className="client-contact">{[c.phone,c.address,[c.postalCode,c.city,c.province,c.country].filter(Boolean).join(" "),c.vat&&"P. IVA: "+c.vat,c.taxCode&&"CF: "+c.taxCode,c.recipientCode&&"SDI: "+c.recipientCode,c.pec&&"PEC: "+c.pec].filter(Boolean).map((value,i)=><span key={i} style={{display:"block"}}>{value}</span>)}</span><div className="client-stats"><span><b>{new Set(own.map(r => r.order.id)).size}</b> lavori</span><span><b>{own.length}</b> lavorazioni</span></div></button><div className="client-card-actions"><button type="button" className="client-open" onClick={() => { setClientFilter(c.id); setStatusFilter(''); setOperatorFilter(''); setSection('orders'); setYear(''); setMonth(''); setQuick('all'); setSearch(''); }}>Visualizza tutti i lavori <ArrowRight size={15}/></button><DeleteClient client={c} orderCount={clientOrders.length} draftCount={clientDrafts.length} canDelete={!failure&&saveStatus!=="Salvataggio…"} getRevision={getRevision} onDeleteDemo={()=>deleteClientFromDemo(c.id)}/></div></article>;
        })}</div><p className="client-delete-note">* L’eliminazione è bloccata se il cliente ha bozze di fatturazione o un account attivo nel portale clienti. In demo, non è possibile eliminare clienti con ordini collegati.</p></>}

        {section === 'billing' && <><div className="eyebrow">AMMINISTRAZIONE</div><div className="titlebar"><div><h1>Fatturazione</h1><p>Seleziona un ordine per preparare la fattura o il suo DDT.</p></div><button className="btn btn-primary" onClick={() => { setSection('work'); setQuick('unbilled'); }}><Plus size={17}/> Seleziona lavori</button></div><div className="warning-strip"><ShieldAlert size={19}/><span><strong>Fatture in Cloud da collegare.</strong> Puoi già preparare le lavorazioni e i riferimenti DDT. L’invio fiscale sarà disponibile dopo la configurazione e la verifica dei dati.</span></div><DocumentLauncher store={db} onOpenOrder={order=>{setDrawerWorkId(null);setDrawerOrderId(order.id);}} onPrepare={ids=>{setSelectedWork(ids);setShowDraft(true);}}/><div className="metrics metrics-three"><div className="metric"><div className="metric-top">Bozze interne <ReceiptText size={19}/></div><strong>{db.drafts.length}</strong></div><div className="metric"><div className="metric-top">Lavorazioni nelle bozze <ClipboardList size={19}/></div><strong>{rows.filter(r => r.invoiceId).length}</strong></div><div className="metric"><div className="metric-top">Importo ancora libero <Clock3 size={19}/></div><strong className="metric-euros">{money(toInvoice)}</strong></div></div><div className="workspace-card"><div className="card-top"><div><h2>Documenti preparati</h2><p>Solo bozze interne, nessun invio fiscale.</p></div></div>{db.drafts.length ? db.drafts.map(draft => {
          const own = draft.workIds.map(wid => indexed.get(wid)).filter((r): r is WorkRow => !!r);
          return <div key={draft.id} className="draft-row"><div className="draft-icon"><FileText size={21}/></div><div className="draft-info"><strong>{draft.number} · {db.clients.find(c => c.id === draft.clientId)?.name}</strong><small>{fmtDate(draft.created)} · {own.length} lavorazioni · {new Set(own.map(r => r.order.id)).size} lavori</small><span>{own.map(r => r.description).join(' · ')}</span></div><button className="btn btn-plain" onClick={()=>{const payload=prepareInvoice(draftRows(db,draft.workIds));download(JSON.stringify(payload,null,2),draft.number+'-preparazione.json','application/json');notify('Preparazione esportata con riferimenti DDT e controlli. Nessuna fattura inviata.');}}>Prepara dati API</button><span className={'status '+(draft.remoteDocumentId?'status--green':'status--amber')}>{draft.remoteDocumentId?'Fattura creata':'Bozza'}</span><b>{money(own.reduce((a, r) => a + sumWork(r), 0))}</b><button className="icon-btn" title="Elimina la bozza" onClick={() => deleteDraft(draft.id)}><Trash2 size={18}/></button></div>;
        }) : <Empty title="Nessuna bozza ancora" detail="Vai su Tutti i lavori, seleziona le righe di un cliente e scegli Prepara bozza." icon={<ReceiptText size={25}/>} />}</div></>}

        {section === 'estimator' && <StaffQuote db={db} canSubmit={!failure && saveStatus !== 'Salvataggio…'} onCreated={()=>window.dispatchEvent(new Event('focus'))}/>}
        {section === 'settings' && <><div className="eyebrow">CONFIGURAZIONE</div><div className="titlebar"><div><h1>Impostazioni</h1><p>Il tuo account e le impostazioni del gestionale.</p></div></div><nav className="settings-nav" aria-label="Sezioni impostazioni">{[{id:'account',label:'Il mio account'},...(profile.role==='admin'?[{id:'users',label:'Utenti e permessi'},{id:'backup',label:'Backup e dati'}]:[])].map(t=><button type="button" key={t.id} aria-current={settingsTab===t.id?'page':undefined} className={settingsTab===t.id?'active':''} onClick={()=>setSettingsTab(t.id)}>{t.label}</button>)}</nav><div className="settings-grid settings-organized">{settingsTab==='account'&&<section className="workspace-card settings-panel"><div className="card-top"><div><h2>Il tuo account</h2><p>{profile.name} · {profile.email}</p></div></div><p className="settings-footnote">Ruolo: {profile.title || (profile.role === "admin" ? "Amministratore" : "Operatore")}</p></section>}{profile.role === "admin" && <>{settingsTab==='users'&&<Operators onCreated={()=>{window.dispatchEvent(new Event("focus"));notify("Elenco operatori aggiornato.");}}/>}{settingsTab==='backup'&&<section className="workspace-card settings-panel"><div className="card-top"><div><h2>Backup e dati</h2><p>{demo ? "I dati della demo rimangono su questo dispositivo." : "Esporta una copia dei dati del gestionale. I PDF si archiviano separatamente."}</p></div></div><div className="backup-actions"><ExcelBackupButton store={db} demo={demo} pending={!hydrated || saveStatus === "Salvataggio…"}/><button className="btn btn-plain" onClick={() => download(JSON.stringify(db, null, 2), 'raia-backup-v2.json', 'application/json')}><Download size={17}/> Esporta backup JSON</button><button className="btn btn-plain" onClick={() => fileRef.current?.click()}><Upload size={17}/> Importa backup JSON</button><input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importBackup}/></div><p className="settings-footnote">Excel esporta i registri mensili, i libri e le anagrafiche. Per ripristinare il gestionale usa il backup JSON; i PDF vanno archiviati separatamente.</p><div className="settings-footnote">{demo ? "Configura Supabase per attivare accessi e dati condivisi." : "Gli account revocati non possono più leggere o modificare dati e documenti."}</div></section>}</>}</div></>}
      </fieldset></main>
    </div>

    {section === 'work' && selected.length > 0 && <div className="selection-bar"><span className="selection-badge">{selected.length}</span><div><strong>{selected.length} {selected.length === 1 ? 'lavorazione selezionata' : 'lavorazioni selezionate'}</strong><small>{selectedClients.size > 1 ? 'Seleziona lavori dello stesso cliente per creare una bozza.' : money(selected.reduce((s, r) => s + sumWork(r), 0)) + ' · importo imponibile indicativo'}</small></div><button className="btn btn-plain" onClick={() => setSelectedWork([])}>Deseleziona</button><button className="btn btn-primary" disabled={!validSelected} onClick={() => setShowDraft(true)}><ReceiptText size={17}/> Prepara bozza</button></div>}

    {(showNewOrder || showNewClient || showDraft || workDrawer || orderDrawer) && <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) closeOverlay(); }}>
      {showNewClient && <section className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="new-client-title"><div className="modal-head"><div><span className="eyebrow">ANAGRAFICA</span><h2 id="new-client-title">Nuovo cliente</h2><p>Completa i dati di contatto e fatturazione.</p></div><button className="icon-btn" onClick={closeOverlay}><X size={20}/></button></div><form onSubmit={e=>{e.preventDefault();if(!newClient.name.trim())return;const client={...newClient,id:id(),name:newClient.name.trim()};write(s=>activity({...s,clients:[...s.clients,client]},`Aggiunto cliente ${client.name}`));setNewClient({name:'',email:'',phone:'',address:'',postalCode:'',city:'',province:'',country:'IT',vat:'',taxCode:'',recipientCode:'',pec:''});setShowNewClient(false);notify('Cliente creato. Puoi subito associargli un lavoro.');}}><div className="modal-body grid-form"><Field label="Nome / ragione sociale *"><input required autoFocus maxLength={160} value={newClient.name} onChange={e=>setNewClient(s=>({...s,name:e.target.value}))} placeholder="Nome azienda"/></Field><Field label="Partita IVA"><input maxLength={32} value={newClient.vat} onChange={e=>setNewClient(s=>({...s,vat:e.target.value}))}/></Field><Field label="Codice fiscale"><input maxLength={32} value={newClient.taxCode} onChange={e=>setNewClient(s=>({...s,taxCode:e.target.value}))}/></Field><Field label="Email"><input type="email" maxLength={254} value={newClient.email} onChange={e=>setNewClient(s=>({...s,email:e.target.value}))}/></Field><Field label="Telefono"><input type="tel" maxLength={60} value={newClient.phone} onChange={e=>setNewClient(s=>({...s,phone:e.target.value}))}/></Field><Field label="Indirizzo"><input maxLength={200} value={newClient.address} onChange={e=>setNewClient(s=>({...s,address:e.target.value}))}/></Field><Field label="CAP"><input maxLength={16} value={newClient.postalCode} onChange={e=>setNewClient(s=>({...s,postalCode:e.target.value}))}/></Field><Field label="Città"><input maxLength={120} value={newClient.city} onChange={e=>setNewClient(s=>({...s,city:e.target.value}))}/></Field><Field label="Provincia"><input maxLength={80} value={newClient.province} onChange={e=>setNewClient(s=>({...s,province:e.target.value}))}/></Field><Field label="Paese"><input maxLength={80} value={newClient.country} onChange={e=>setNewClient(s=>({...s,country:e.target.value}))} placeholder="IT"/></Field><Field label="Codice destinatario SDI"><input maxLength={16} value={newClient.recipientCode} onChange={e=>setNewClient(s=>({...s,recipientCode:e.target.value}))}/></Field><Field label="PEC"><input type="email" maxLength={254} value={newClient.pec} onChange={e=>setNewClient(s=>({...s,pec:e.target.value}))}/></Field></div><div className="modal-foot"><button type="button" className="btn btn-plain" onClick={closeOverlay}>Annulla</button><button type="submit" className="btn btn-primary"><Plus size={16}/> Crea cliente</button></div></form></section>}
      {showNewOrder && <section className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="new-order-title"><div className="modal-head"><div><span className="eyebrow">INSERIMENTO RAPIDO</span><h2 id="new-order-title">Nuovo lavoro</h2><p>Puoi aggiungere più lavorazioni nello stesso ordine.</p></div><button className="icon-btn" onClick={closeOverlay}><X size={20}/></button></div><form onSubmit={saveNewOrder}><div className="modal-body"><Field label="Registro"><select value={orderCategory} onChange={e=>setOrderCategory(e.target.value as WorkCategory)}><option value="general">Lavorazioni generali</option><option value="books">Libri</option></select></Field><div className="new-order-client-toolbar"><span>Cliente del lavoro</span><button type="button" className="btn btn-small btn-plain" aria-expanded={inlineClientOpen} aria-controls="inline-client-editor" onClick={()=>setInlineClientOpen(v=>!v)}><Plus size={15}/> Nuovo cliente</button></div>{inlineClientOpen&&<section className="inline-client-editor" id="inline-client-editor" aria-label="Crea cliente nel nuovo lavoro"><h3>Nuovo cliente</h3><div className="grid-form"><Field label="Nome o ragione sociale *"><input autoFocus maxLength={160} value={inlineClient.name} onChange={e=>setInlineClient(c=>({...c,name:e.target.value}))}/></Field><Field label="Email"><input type="email" maxLength={254} value={inlineClient.email} onChange={e=>setInlineClient(c=>({...c,email:e.target.value}))}/></Field><Field label="Telefono"><input type="tel" maxLength={60} value={inlineClient.phone} onChange={e=>setInlineClient(c=>({...c,phone:e.target.value}))}/></Field></div><div className="portal-actions"><button type="button" className="btn btn-primary" onClick={createInlineClient}>Crea e seleziona cliente</button><button type="button" className="btn btn-plain" onClick={()=>setInlineClientOpen(false)}>Annulla</button></div></section>}<div className="grid-form"><Field label="Cliente *"><select required value={orderClient} onChange={e => setOrderClient(e.target.value)}>{db.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Data ordine"><input required type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)}/></Field><Field label="Data di esecuzione" hint="Se non indicata, il gruppo utilizza la data ordine."><input type="date" value={executionDate} onChange={e=>setExecutionDate(e.target.value)}/></Field><Field label="Scadenza"><select aria-label="Scadenza nuovo lavoro" value={orderDue?'date':'unknown'} onChange={e=>setOrderDue(e.target.value==='unknown'?'':orderDate||today())}><option value="unknown">Non precisata</option><option value="date">Data precisa</option></select>{orderDue&&<input type="date" aria-label="Data scadenza nuovo lavoro" value={orderDue} onChange={e=>setOrderDue(e.target.value)}/>}</Field><Field label="Note lavoro"><input value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Informazioni utili"/></Field></div><Field label="Titolo del lavoro *"><input required maxLength={200} value={orderTitle} onChange={e=>setOrderTitle(e.target.value)} placeholder="Es. Lavoro 1"/></Field><div className="line-editor-head"><strong>Tot. Lavori: {orderLines.length}</strong><button className="btn btn-small btn-plain" type="button" onClick={() => setOrderLines(lines => [...lines, newLine(defaultAssignee)])}><Plus size={14}/> Aggiungi riga</button></div>{orderLines.map((line, i) => <div className="new-line new-line-without-price" key={line.key}><span className="line-index">{i + 1}</span><input aria-label={`Descrizione riga ${i + 1}`} required placeholder="Descrizione prodotto / lavorazione" value={line.description} onChange={e => setOrderLines(lines => lines.map(l => l.key === line.key ? { ...l, description: e.target.value } : l))}/><input aria-label={`Quantità riga ${i + 1}`} min="0.01" step="any" type="number" required value={line.qty} onChange={e => setOrderLines(lines => lines.map(l => l.key === line.key ? { ...l, qty: e.target.value } : l))}/><select title="Operatore" aria-label={`Operatore riga ${i + 1}`} value={line.operatorId} onChange={e => setOrderLines(lines => lines.map(l => l.key === line.key ? { ...l, operatorId: e.target.value } : l))}><option value="">Non assegnato</option>{db.operators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}</select><button className="icon-btn" title="Elimina riga" type="button" disabled={orderLines.length === 1} onClick={() => setOrderLines(lines => lines.filter(l => l.key !== line.key))}><X size={17}/></button></div>)}<p className="helper-text">Puoi modificare lo stato di ciascuna lavorazione dopo aver creato il lavoro.</p></div><div className="modal-foot"><span className="modal-total">Tot. Lavori <strong>{orderLines.length}</strong></span><button type="button" className="btn btn-plain" onClick={closeOverlay}>Annulla</button><button className="btn btn-primary" type="submit"><Check size={16}/> Salva lavoro</button></div></form></section>}
      {showDraft && <section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="eyebrow">FATTURAZIONE</span><h2>Prepara bozza interna</h2></div><button className="icon-btn" onClick={closeOverlay}><X size={20}/></button></div><div className="modal-body"><div className="warning-strip"><ShieldAlert size={18}/><span>Include soltanto le righe selezionate. Se esiste una bozza dello medesimo ordine, aggiunge queste righe a quella bozza senza creare una seconda fattura. Il collegamento a Fatture in Cloud non è ancora attivo.</span></div><div className="summary-lines"><p><b>Cliente:</b> {selected[0]?.client.name}</p>{selected.map(r => <div key={r.id} className="summary-line"><span>{r.order.number} · {r.description}</span><strong>{money(sumWork(r))}</strong></div>)}<div className="billing-check"><h3>Controllo dati per Fatture in Cloud</h3><ul>{prepareInvoice(selected).issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul></div><div className="summary-total"><strong>Totale imponibile indicativo</strong><strong>{money(selected.reduce((s, r) => s + sumWork(r), 0))}</strong></div></div></div><div className="modal-foot"><button className="btn btn-plain" onClick={closeOverlay}>Annulla</button><button className="btn btn-primary" onClick={createDraft}><Check size={16}/> Salva preparazione</button></div></section>}
      {workDrawer && <aside className="drawer" role="dialog" aria-modal="true" aria-label="Dettaglio lavorazione"><div className="drawer-top"><div><span className="eyebrow">DETTAGLIO LAVORO</span><h2>{workDrawer.description}</h2><p>{workDrawer.client.name} · {workDrawer.order.number}</p></div><button className="icon-btn" onClick={closeOverlay}><X size={20}/></button></div><form onSubmit={saveEditWork}><div className="drawer-body"><div className="drawer-ref"><button type="button" onClick={() => { setDrawerOrderId(workDrawer.order.id); setDrawerWorkId(null); }}>Apri lavoro <ArrowUpRight size={14}/></button></div><Field label="Descrizione lavorazione"><input required value={editWork.description ?? ''} onChange={e => setEditWork(w => ({ ...w, description: e.target.value }))}/></Field><div className="grid-form"><Field label="Quantità">{editWork.production?<input required value={editWork.production.quantity} onChange={e=>{const value=e.target.value;setEditWork(w=>({...w,production:{...w.production!,quantity:value},qty:/^\d+(?:[.,]\d+)?$/.test(value)?Number(value.replace(',','.')):0}));}}/>:<input type="number" min="0.01" step="any" required value={editWork.qty??1} onChange={e=>setEditWork(w=>({...w,qty:Number(e.target.value)}))}/>}</Field><Field label="Unità"><input value={editWork.unit ?? 'pz'} onChange={e => setEditWork(w => ({ ...w, unit: e.target.value }))}/></Field><Field label="Operatore"><select value={editWork.operatorId || ''} onChange={e => setEditWork(w => ({ ...w, operatorId: e.target.value }))}><option value="">Non assegnato</option>{editWork.operatorId&&!db.operators.some(o=>o.id===editWork.operatorId)&&<option disabled value={editWork.operatorId}>{db.operatorHistory?.find(o=>o.id===editWork.operatorId)?.name||'Non disponibile'} · storico</option>}{db.operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field><Field label="Stato"><select value={editWork.status || 'Da elaborare'} onChange={e => setEditWork(w => ({ ...w, status: e.target.value as Status }))}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></Field></div><ProductionFields work={editWork} onChange={production=>setEditWork(w=>({...w,production,qty:/^\d+(?:[.,]\d+)?$/.test(production.quantity)?Number(production.quantity.replace(',','.')):0}))}/><Field label="Note lavorazione"><textarea rows={3} value={editWork.notes || ''} onChange={e => setEditWork(w => ({ ...w, notes: e.target.value }))} placeholder="Indicazioni per la produzione…"/></Field><OrderDates showDue={!editWork.production} key={'dates-'+workDrawer.order.id} order={workDrawer.order} onSave={changes=>saveDates(workDrawer.order,changes)}/><details className="drawer-documents"><summary>Documento di trasporto (DDT)</summary><DeliveryNoteSection key={workDrawer.order.id} order={{...workDrawer.order,ddt:sharedDDT(db.orders,workDrawer.order).value}} conflict={sharedDDT(db.orders,workDrawer.order).conflict} onSave={ddt=>saveDDT(workDrawer.order,ddt)}/><DdtGenerator key={"ddt-generator-"+workDrawer.order.id} order={workDrawer.order} store={db} status={saveStatus} failure={failure} onSave={ddt=>saveGeneratedDDT(workDrawer.order,ddt)}/></details>{workDrawer.order.customerRequestId && <CustomerRequest key={workDrawer.order.customerRequestId} id={workDrawer.order.customerRequestId}/>}<Documents orderId={workDrawer.order.id}/><DeleteOrder key={workDrawer.order.id} order={workDrawer.order} canDelete={!failure && saveStatus !== "Salvataggio…"} getRevision={getRevision}/><div className="drawer-subtitle">Altre righe di questo ordine</div>{workDrawer.order.lines.filter(w => w.id !== workDrawer.id).map(w => <button type="button" key={w.id} className="sibling" onClick={() => { openWork(indexed.get(w.id)!); }}><span>{w.description}<small>{quantityLabel(w)} · {w.status}</small></span><ChevronRight size={16}/></button>)}<div className="drawer-amount"><span>Importo riga</span><strong>{editWork.production?.priceUnspecified || (editWork.production && !editWork.qty) ? 'Da definire' : money((Number(editWork.qty) || 0) * (Number(editWork.price) || 0))}</strong></div></div><div className="drawer-foot"><button type="button" className="btn btn-plain" onClick={closeOverlay}>Chiudi</button><button type="submit" disabled={closeAfterSave||!!failure} className="btn btn-primary"><Check size={16}/> {closeAfterSave?'Salvataggio…':'Salva modifiche'}</button></div></form></aside>}
      {orderDrawer && !workDrawer && <aside className="drawer" role="dialog" aria-modal="true" aria-label="Dettaglio lavoro"><div className="drawer-top"><div><span className="eyebrow">CARTELLA LAVORO</span><h2>{orderDrawer.number}</h2><p>{db.clients.find(c => c.id === orderDrawer.clientId)?.name}</p></div><button className="icon-btn" onClick={closeOverlay}><X size={20}/></button></div><div className="drawer-body"><div className="order-overall"><span>Stato generale</span><StatusLabel status={overallStatus(orderDrawer.lines)}/></div><OrderDates key={'dates-'+orderDrawer.id} order={orderDrawer} onSave={changes=>saveDates(orderDrawer,changes)}/><details className="drawer-documents"><summary>Documento di trasporto (DDT)</summary><DeliveryNoteSection key={orderDrawer.id} order={{...orderDrawer,ddt:sharedDDT(db.orders,orderDrawer).value}} conflict={sharedDDT(db.orders,orderDrawer).conflict} onSave={ddt=>saveDDT(orderDrawer,ddt)}/><DdtGenerator key={"ddt-generator-"+orderDrawer.id} order={orderDrawer} store={db} status={saveStatus} failure={failure} onSave={ddt=>saveGeneratedDDT(orderDrawer,ddt)}/></details>{orderDrawer.customerRequestId && <CustomerRequest key={orderDrawer.customerRequestId} id={orderDrawer.customerRequestId}/>}<Documents orderId={orderDrawer.id}/><div className="drawer-subtitle">{orderDrawer.lines.length} lavorazioni nella cartella</div>{orderDrawer.lines.map(line => <button className="folder-line" key={line.id} onClick={() => { setDrawerOrderId(null); openWork({ ...line, client: db.clients.find(c => c.id === orderDrawer.clientId)!, order: orderDrawer, operator: db.operators.find(o => o.id === line.operatorId)! }); }}><div><strong>{line.description}</strong><small>{quantityLabel(line)} · {workAmount(line)}</small></div><StatusLabel status={line.status}/><ChevronRight size={16}/></button>)}{orderDrawer.notes && <div className="order-note"><strong>Note lavoro</strong><p>{orderDrawer.notes}</p></div>}<div className="drawer-amount"><span>Totale lavori</span><strong>{orderDrawer.lines.some(l=>l.production?.priceUnspecified || (l.production&&!l.qty))?'Da definire':money(orderDrawer.lines.reduce((s, l) => s + sumWork(l), 0))}</strong></div><DeleteOrder key={orderDrawer.id} order={orderDrawer} canDelete={!failure && saveStatus !== "Salvataggio…"} getRevision={getRevision}/><p className="helper-text">I lavori mantengono stato e operatore indipendenti, anche se appartengono allo stesso lavoro.</p></div><div className="drawer-foot"><button className="btn btn-primary" onClick={closeOverlay}>Chiudi cartella</button></div></aside>}
    </div>}
    {confirmUnsavedExit&&<div className="unsaved-prompt-backdrop"><section className="unsaved-prompt" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-exit-title"><h3 id="unsaved-exit-title">Modifiche non salvate</h3><p>Vuoi salvare le modifiche prima di uscire?</p><div><button type="button" className="btn btn-primary" onClick={saveAndExit}>Salvare e uscire</button><button type="button" className="btn btn-plain" onClick={exitWithoutSaving}>Uscire senza salvare</button><button type="button" className="btn btn-plain" onClick={()=>setConfirmUnsavedExit(false)}>Continua a modificare</button></div></section></div>}
    {editingClient && <ClientEditor key={editingClient.id} client={editingClient} onClose={()=>setEditingClient(null)} onSave={changes=>{if(JSON.stringify(db.clients.find(c=>c.id===editingClient.id))!==JSON.stringify(editingClient)){notify('Il cliente è stato aggiornato nel frattempo. Copia le modifiche e riapri la scheda.');return;}updateClient(editingClient.id,changes);setEditingClient(null);notify("Dati cliente aggiornati e preparazioni di fatturazione riallineate.");}}/>}
    {showImport && <ExcelImport store={db} onClose={()=>setShowImport(false)} onImport={next=>{setDb(next);setShowImport(false);setSearch('');setYear('');setMonth('');notify('Importazione applicata. Controlla lo stato del salvataggio in alto.');}}/>}
    {toastMessage && <div className="toast"><CheckCircle2 size={18}/>{toastMessage}<button onClick={() => setToastMessage('')}><X size={15}/></button></div>}
  </div>;
}
