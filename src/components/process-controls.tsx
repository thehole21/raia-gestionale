'use client';
import {createContext, useContext, type ReactNode} from 'react';
import {defaultProcesses, type ProcessDefinition} from '@/lib/processes';
import {statusText} from '@/lib/order-groups';
import {SearchableSelect} from './searchable-select';

export const ProcessContext = createContext<ProcessDefinition[]>(defaultProcesses);

export function ProcessText({status}: {status: string}) {
  const processes = useContext(ProcessContext);
  return processes.find(p => p.id === status)?.label || statusText(status);
}

export function ProcessBadge({status, className = 'status', children}: {status: string; className?: string; children?: ReactNode}) {
  const processes = useContext(ProcessContext);
  const process = processes.find(p => p.id === status) || defaultProcesses.find(p => p.id === status);
  return <span className={className} style={process ? {background: process.background, color: process.foreground, borderColor: process.background} : undefined}>
    {children}<ProcessText status={status}/>
  </span>;
}

export function ProcessSelect({value, onChange, label, className = 'register-process'}: {value: string; onChange: (value: string) => void; label: string; className?: string}) {
  const processes = useContext(ProcessContext);
  const current = processes.find(p => p.id === value);
  return <SearchableSelect aria-label={label} className={className} value={value} onChange={e => onChange(e.target.value)} style={current ? {background: current.background, color: current.foreground, borderColor: current.background} : undefined}>
    {!current?.active && <option value={value} disabled>{current?.label || statusText(value)} · storico</option>}
    {processes.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
  </SearchableSelect>;
}

export function ProcessFilter({value, onChange}: {value: string; onChange: (value: string) => void}) {
  const processes = useContext(ProcessContext);
  return <SearchableSelect aria-label="Filtra per processo" value={value} onChange={e => onChange(e.target.value)}>
    <option value="">Tutti i processi</option>
    {processes.map(p => <option key={p.id} value={p.id}>{p.label}{p.active ? '' : ' · storico'}</option>)}
  </SearchableSelect>;
}
