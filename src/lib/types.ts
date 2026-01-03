

import type { Timestamp } from 'firebase/firestore';

export interface User {
  uid: string;
  email: string;
  role: 'Ventas' | 'Ventas Externas' | 'Administrador';
}

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
  paymentDetails?: 'Premium B/ 201.00' | 'Deluxe B/ 270.00';
  paymentAmount?: number;
  paymentInstallments?: (Date | undefined)[];
  vehicleTransmission: 'Automático' | 'Manual';
  licenseCategory: 'A, C' | 'A, C, D';
  theoreticalClassSchedule?: 'Lunes' | 'Miércoles';
  theoreticalClasses?: (Date | undefined)[];
  classSchedules?: { date?: Date; time?: string }[];
}

export interface AutoMotoContractDetails {
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
  motoPracticalClassSchedules?: { date?: Date; time?: string }[];
  paidInFull?: boolean;
}


export interface AmpliacionesContractDetails {
    studentAddress?: string;
    studentPhone1?: string;
    studentPhone2?: string;
    courseValue?: number;
    downPayment?: number;
    balance?: number;
    paymentDeadline?: Date;
    selectedPlans?: { name: string; price: number }[];
    theoreticalClassDate?: Date;
    theoreticalClassTime?: string;
}

export interface Contract {
  id: string;
  folioNumber: number; // folioNumber (number) is now folio (string)
  title: string;
  client?: Client; // This might be populated after fetching
  clientName: string; // This is now a composite of the name fields
  clientEmail: string;
  clientId: string; // The ID of the client document in the /clients collection
  studentIdNumber?: string; // Denormalized for searching
  studentAddress?: string;
  studentPhone1?: string;
  studentPhone2?: string;
  content: string;
  deadlines: Deadline[];
  status: ContractStatus;
  type: ContractType;
  userId: string;
  createdAt: Timestamp;
  createdBy?: string; // User role who created the contract
  deluxeDetails?: Partial<DeluxeContractDetails>;
  autoMotoDetails?: Partial<AutoMotoContractDetails>;
  ampliacionesDetails?: Partial<AmpliacionesContractDetails>;
  certificateGeneratedAt?: Timestamp; // Campo para registrar la generación del certificado
}

export interface CertificateData {
  folio: string;
  clientName: string;
  courseName: string;
  issueDate: Timestamp;
  cip: string;
  licenseType: string;
}

// Kept for backwards compatibility with the print page, can be removed later
export interface Certificate {
  id: string;
  contractId: string;
  clientId: string;
  userId: string;
  folio: string;
  clientName: string;
  courseName: string;
  issueDate: Timestamp;
  cip: string;
  licenseType: string;
  contract?: Contract;
}
