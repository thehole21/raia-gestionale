import type {Order} from './data';

// Identifiers assigned by ordini-raia when submitting an order.
export function orderEntryLabel(order:Pick<Order,'id'|'number'>):string{
 return order.id.startsWith('portal_')&&/^WEB-\d+$/.test(order.number)?'Entrata web':'Entrata commessa';
}
