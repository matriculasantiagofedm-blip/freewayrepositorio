import { add, sub } from 'date-fns';
import type { Client, Contract } from './types';
import { PlaceHolderImages } from './placeholder-images';

const findImage = (id: string) => PlaceHolderImages.find(img => img.id === id)?.imageUrl ?? 'https://picsum.photos/seed/placeholder/100/100';

export const clients: Client[] = [
  { id: '1', name: 'Innovate Corp', email: 'contact@innovatecorp.com', avatarUrl: findImage('client-1') },
  { id: '2', name: 'Quantum Solutions', email: 'hello@quantumsolutions.dev', avatarUrl: findImage('client-2') },
  { id: '3', name: 'Apex Industries', email: 'support@apexindustries.io', avatarUrl: findImage('client-3') },
  { id: '4', name: 'Stellar Services', email: 'info@stellarservices.net', avatarUrl: findImage('client-4') },
];

export const contracts: Contract[] = [
  {
    id: '1',
    title: 'Acuerdo de Campaña de Marketing Q3',
    client: clients[0],
    content: 'Este acuerdo describe los términos para la campaña de marketing del tercer trimestre, incluidos los entregables, los plazos y los cronogramas de pago.',
    deadlines: [
      { id: 'd1-1', description: 'Entrega del borrador inicial', date: sub(new Date(), { days: 5 }) },
      { id: 'd1-2', description: 'Lanzamiento final de la campaña', date: add(new Date(), { days: 25 }) },
    ],
    status: 'active',
  },
  {
    id: '2',
    title: 'Contrato de Desarrollo de Software',
    client: clients[1],
    content: 'Contrato para el desarrollo de un nuevo sistema de gestión de inventario. Esto incluye hitos para las versiones alfa, beta y final.',
    deadlines: [
      { id: 'd2-1', description: 'Entrega de la versión Alfa', date: add(new Date(), { days: 3 }) },
      { id: 'd2-2', description: 'Entrega de la versión Beta', date: add(new Date(), { days: 40 }) },
      { id: 'd2-3', description: 'Lanzamiento final', date: add(new Date(), { days: 80 }) },
    ],
    status: 'active',
  },
  {
    id: '3',
    title: 'Proyecto de Rediseño de Sitio Web',
    client: clients[2],
    content: 'Rediseño completo del sitio web corporativo de Apex Industries, centrándose en una interfaz de usuario/experiencia de usuario moderna y un enfoque móvil.',
    deadlines: [
      { id: 'd3-1', description: 'Aprobación final del diseño', date: sub(new Date(), { days: 20 }) },
    ],
    status: 'completed',
  },
  {
    id: '4',
    title: 'Mantenimiento y Soporte Anual',
    client: clients[3],
    content: 'Contrato anual para el mantenimiento y soporte continuo del sistema CRM interno de Stellar Services.',
    deadlines: [
      { id: 'd4-1', description: 'Renovación de contrato pendiente', date: add(new Date(), { days: 120 }) },
    ],
    status: 'draft',
  },
    {
    id: '5',
    title: 'Retainer de Servicios de Consultoría',
    client: clients[0],
    content: 'Retainer mensual para servicios de consultoría estratégica de negocios.',
    deadlines: [
      { id: 'd5-1', description: 'Contrato expirado', date: sub(new Date(), { days: 10 }) },
    ],
    status: 'expired',
  },
];
