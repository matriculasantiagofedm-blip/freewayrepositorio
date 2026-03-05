
import { MessageSquare, Users } from 'lucide-react';

export const CHANNELS = [
  { id: 'admin_ventas', label: 'Ventas ↔ Administración', roles: ['Administrador', 'Ventas'], color: 'bg-blue-600' },
  { id: 'admin_ventasext', label: 'Ventas Ext ↔ Administración', roles: ['Administrador', 'Ventas Externas'], color: 'bg-purple-600' },
];

export function getChannelLabel(id: string) {
  return CHANNELS.find(c => c.id === id)?.label || 'Canal Desconocido';
}
