import type {Store} from './data';
export const technicalLabels={format:'Formato finito',openFormat:'Formato aperto',material:'Carta / materiale',weight:'Grammatura / spessore',pages:'Pagine / facciate',colors:'Colori / stampa',binding:'Rilegatura',finishing:'Finiture / plastificazione',dimensions:'Dimensioni / sviluppo',files:'File / revisione',packaging:'Imballaggio',instructions:'Altre caratteristiche tecniche'};
export type TechnicalField={key:string;label:string;enabled:boolean;printable?:boolean};
export const technicalFields=(store:Pick<Store,'technicalFields'>):TechnicalField[]=>store.technicalFields??Object.entries(technicalLabels).map(([key,label])=>({key,label,enabled:true}));
