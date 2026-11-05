import {STATUSES, type Store} from './data';
import {statusText, statusTone} from './order-groups';

export type ProcessDefinition = {
  id: string;
  label: string;
  background: string;
  foreground: string;
  active: boolean;
};

const palettes: Record<string, [string, string]> = {
  'soft-yellow': ['#eadb91', '#302b19'], navy: ['#193e6d', '#ffffff'],
  aqua: ['#48c7ae', '#101713'], 'dark-red': ['#9d2335', '#ffffff'],
  orange: ['#e87c1e', '#18100b'], 'dark-green': ['#17643e', '#ffffff'],
  white: ['#ffffff', '#3d4148'], done: ['#17643e', '#ffffff'],
  active: ['#315d84', '#ffffff'], waiting: ['#ece5db', '#514536'],
  planned: ['#f0ecee', '#55434b'],
};

export const defaultProcesses: ProcessDefinition[] = STATUSES.map(id => {
  const [background, foreground] = palettes[statusTone(id)];
  return {id, label: statusText(id), background, foreground, active: true};
});

export function processesOf(store: Pick<Store, 'processes'>) {
  return store.processes ?? defaultProcesses;
}

export function processLabel(store: Pick<Store, 'processes'>, status: string) {
  return processesOf(store).find(p => p.id === status)?.label || statusText(status);
}

export function processFromText(store: Pick<Store, 'processes'>, value: string) {
  const normalized = value.trim().toLocaleLowerCase('it');
  return processesOf(store).find(p => p.label.toLocaleLowerCase('it') === normalized || p.id.toLocaleLowerCase('it') === normalized)?.id;
}

export function validateProcesses(processes: ProcessDefinition[]) {
  if (processes.length > 200) throw Error('Puoi configurare al massimo 200 processi.');
  if (!processes.some(p => p.active)) throw Error('Mantieni almeno un processo disponibile.');
  const names = processes.filter(p => p.active).map(p => p.label.trim().toLocaleLowerCase('it'));
  if (new Set(names).size !== names.length) throw Error('Ogni processo deve avere un nome diverso.');
  if (processes.some(p => !p.label.trim() || p.label.trim().length > 80 || !/^#[0-9a-f]{6}$/i.test(p.background) || !/^#[0-9a-f]{6}$/i.test(p.foreground))) {
    throw Error('Controlla nomi e colori dei processi.');
  }
}
