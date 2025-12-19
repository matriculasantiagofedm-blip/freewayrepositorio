import type { Timestamp } from 'firebase/firestore';

export interface Deadline {
  id: string;
  description: string;
  date: Date | Timestamp;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  userId: string;
  createdAt: Timestamp;
}

export type ContractStatus = 'draft' | 'active' | 'completed' | 'expired';
export type ContractType = 
  | 'Curso Auto' 
  | 'Curso Moto' 
  | 'Curso Auto Básico' 
  | 'Curso Auto Plus' 
  | 'Curso Auto Premium' 
  | 'Curso Auto Deluxe'
  | 'Curso Moto Básico'
  | 'Curso Moto Plus'
  | 'Curso Moto Premium';

export interface Contract {
  id: string;
  title: string;
  client?: Client; // This might be populated after fetching
  clientName: string;
  clientEmail: string;
  clientId: string; // The ID of the client document in the /clients collection
  content: string;
  deadlines: Deadline[];
  status: ContractStatus;
  type: ContractType;
  userId: string;
  createdAt: Timestamp;
}
