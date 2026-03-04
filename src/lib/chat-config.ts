
import { MessageSquare, Users } from 'lucide-react';

export const CHANNELS = [
  { id: 'admin_ventas', label: 'Ventas ↔ Administración', roles: ['Administrador', 'Ventas'], color: 'bg-blue-600' },
  { id: 'admin_ventasext', label: 'Ventas Ext ↔ Administración', roles: ['Administrador', 'Ventas Externas'], color: 'bg-purple-600' },
  { id: 'internal_admin', label: 'Solo Administradores', roles: ['Administrador'], color: 'bg-slate-800' },
  { id: 'internal_ventas', label: 'Solo Ventas (Interno)', roles: ['Administrador'], color: 'bg-blue-500' },
  { id: 'internal_ventasext', label: 'Solo Ventas Ext (Interno)', roles: ['Administrador'], color: 'bg-purple-500' },
];

export function getChannelLabel(id: string) {
  return CHANNELS.find(c => c.id === id)?.label || 'Canal Desconocido';
}
