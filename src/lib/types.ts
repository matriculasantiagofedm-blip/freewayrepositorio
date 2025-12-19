import type { Timestamp } from 'firebase/firestore';

export interface Deadline {
  id: string;
  description: string;
  date: Date | Timestamp;
}

export interface ClassSchedule {
  date: Date | Timestamp;
  time: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  userId: string;
  createdAt: Timestamp;
}

export type ContractStatus = 'draft' | 'active' | 'completed' | 'expired';
export type ContractType = 
  | 'Curso Auto' 
  | 'Curso Moto' 
  | 'Curso Mixto';

export interface DeluxeContractDetails {
  studentIdNumber: string;
  studentAddress: string;
  studentPhone1: string;
  studentPhone2: string;
  vehicleTransmission: 'Automático' | 'Manual';
  licenseCategory: 'A, C' | 'A, C, D';
  classSchedules: ClassSchedule[];
  paymentDetails: string;
}

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
  deluxeDetails?: DeluxeContractDetails;
}
