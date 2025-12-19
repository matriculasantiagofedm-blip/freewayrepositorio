import type { Client, Contract } from './types';
import { PlaceHolderImages } from './placeholder-images';

const findImage = (id: string) => PlaceHolderImages.find(img => img.id === id)?.imageUrl ?? 'https://picsum.photos/seed/placeholder/100/100';

export const clients: Client[] = [
  { id: '1', name: 'Innovate Corp', email: 'contact@innovatecorp.com', avatarUrl: findImage('client-1') },
  { id: '2', name: 'Quantum Solutions', email: 'hello@quantumsolutions.dev', avatarUrl: findImage('client-2') },
  { id: '3', name: 'Apex Industries', email: 'support@apexindustries.io', avatarUrl: findImage('client-3') },
  { id: '4', name: 'Stellar Services', email: 'info@stellarservices.net', avatarUrl: findImage('client-4') },
];

export const contracts: Omit<Contract, 'id' | 'userId' | 'clientId'>[] = [];
