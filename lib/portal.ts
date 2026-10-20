export type BookSpec = { title: string; pages: number; format: string; paperWeight: number; paper: string; print: string; colorPages: number; colorLocations: string; cover: string; copies: number; notes: string };
export type Quote = { id: string; spec: BookSpec; book_path: string; cover_path: string; order_id: string; status: 'processing'|'confirmed'|'shipped'|'delivered'|'cancelled'; carrier: string|null; tracking_number: string|null; created_at: string };
export const progressLabels = ['In elaborazione', 'Ordine confermato', 'Spedito', 'Consegnato'];
export const progressKeys = ['processing','confirmed','shipped','delivered'];
export const specLabels: Record<keyof BookSpec,string> = { title:'Titolo',pages:'Pagine',format:'Formato',paperWeight:'Grammatura (g/m²)',paper:'Carta',print:'Stampa',colorPages:'Pagine con inserti a colori',colorLocations:'Posizione inserti',cover:'Copertina',copies:'Copie',notes:'Note' };
export const emptySpec: BookSpec = {title:'',pages:100,format:'A5',paperWeight:80,paper:'Uso mano',print:'Bianco e nero',colorPages:0,colorLocations:'',cover:'Morbida',copies:1,notes:''};
