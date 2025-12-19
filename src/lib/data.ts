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
    title: 'Q3 Marketing Campaign Agreement',
    client: clients[0],
    content: 'This agreement outlines the terms for the Q3 marketing campaign, including deliverables, timelines, and payment schedules.',
    deadlines: [
      { id: 'd1-1', description: 'Initial draft submission', date: sub(new Date(), { days: 5 }) },
      { id: 'd1-2', description: 'Final campaign launch', date: add(new Date(), { days: 25 }) },
    ],
    status: 'active',
  },
  {
    id: '2',
    title: 'Software Development Contract',
    client: clients[1],
    content: 'Contract for the development of a new inventory management system. This includes milestones for alpha, beta, and final release.',
    deadlines: [
      { id: 'd2-1', description: 'Alpha version delivery', date: add(new Date(), { days: 3 }) },
      { id: 'd2-2', description: 'Beta version delivery', date: add(new Date(), { days: 40 }) },
      { id: 'd2-3', description: 'Final release', date: add(new Date(), { days: 80 }) },
    ],
    status: 'active',
  },
  {
    id: '3',
    title: 'Website Redesign Project',
    client: clients[2],
    content: 'Full redesign of the Apex Industries corporate website, focusing on a modern UI/UX and mobile-first approach.',
    deadlines: [
      { id: 'd3-1', description: 'Final design approval', date: sub(new Date(), { days: 20 }) },
    ],
    status: 'completed',
  },
  {
    id: '4',
    title: 'Annual Maintenance & Support',
    client: clients[3],
    content: 'Annual contract for ongoing maintenance and support for Stellar Services\' internal CRM system.',
    deadlines: [
      { id: 'd4-1', description: 'Contract renewal due', date: add(new Date(), { days: 120 }) },
    ],
    status: 'draft',
  },
    {
    id: '5',
    title: 'Consulting Services Retainer',
    client: clients[0],
    content: 'Monthly retainer for strategic business consulting services.',
    deadlines: [
      { id: 'd5-1', description: 'Contract expired', date: sub(new Date(), { days: 10 }) },
    ],
    status: 'expired',
  },
];
