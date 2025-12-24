
import type { Timestamp } from 'firebase/firestore';

export interface Deadline {
  id: string;
  description: string;
  date: Date;
}

export interface ClassSchedule {
  date: Date;
  time: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  idNumber?: string;
  userId: string;
  createdAt: Timestamp;
}

export type ContractStatus = 'draft' | 'active' | 'completed' | 'expired';
export type ContractType = 
  | 'Curso Auto' 
  | 'Curso Moto' 
  | 'Curso Mixto'
  | 'Curso Deluxe'
  | 'Ampliaciones';

export interface DeluxeContractDetails {
  studentIdNumber: string;
  studentAddress: string;
  studentPhone1: string;
  studentPhone2: string;
  vehicleTransmission: 'Automático' | 'Manual';
  licenseCategory: 'A, C' | 'A, C, D';
  theoreticalClassSchedule?: 'Lunes' | 'Miércoles';
  theoreticalClasses?: (Date | undefined)[];
  classSchedules: { date?: Date; time?: string }[];
  paymentDetails: string;
  paymentInstallments?: (Date | undefined)[];
  paymentAmount?: number;
}

export interface AutoMotoContractDetails {
  studentIdNumber?: string;
  studentAddress?: string;
  studentPhone1?: string;
  studentPhone2?: string;
  courseValue?: number;
  downPayment?: number;
  balance?: number;
  paymentDeadline?: Date;
  vehicle?: 'Spark' | 'P. Blanco' | 'P. Bronce' | 'Moto';
  vehicleTransmission?: 'Automático' | 'Manual' | 'Moto';
  licenseCategory?: 'A, C' | 'A, C, D' | 'A, B';
  theoreticalClassSchedule?: string;
  theoreticalClassDates?: (Date | undefined)[];
  practicalClassSchedules?: { date?: Date; time?: string }[];
}


export interface Contract {
  id: string;
  folio: string;
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
  createdBy?: string; // User role who created the contract
  deluxeDetails?: DeluxeContractDetails;
  autoMotoDetails?: AutoMotoContractDetails;
}
