export type PendingEditChange = { key: string; dirty: boolean; save: () => boolean };
export function announcePendingEdit(change:PendingEditChange){window.dispatchEvent(new CustomEvent<PendingEditChange>('raia-pending-edit',{detail:change}));}
