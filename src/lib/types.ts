

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
  phone?: string;
  userId: string;
  createdAt: Timestamp;
}

export type ContractStatus = 'draft' | 'active' | 'completed' | 'expired';
export type ContractType = 
  | 'Curso Auto' 
  | 'Curso Moto' 
  | 'Curso Mixto'
  | 'Curso Deluxe'
  | 'Ampliaciones'
  | 'Curso Solo Practica';

export interface DeluxeContractDetails {
  studentIdNumber: string;
  studentAddress: string;
  studentPhone1: string;
  studentPhone2?: string;
  paymentDetails?: 'Premium B/ 201.00' | 'Deluxe B/ 270.00';
  paymentAmount?: number;
  paymentInstallments?: (Date | undefined)[];
  vehicleTransmission?: 'Automático' | 'Manual';
  licenseCategory?: 'A, C' | 'A, C, D';
  theoreticalClassSchedule?: 'Lunes' | 'Miércoles';
  theoreticalClasses?: (Date | undefined)[];
  classSchedules?: { date?: Date; time?: string }[];
}

export interface AutoMotoContractDetails {
  studentIdNumber?: string;
  studentAddress?: string;
  studentPhone1?: string;
  studentPhone2?: string;
  coursePlan?: string;
  courseValue?: number;
  downPayment?: number;
  balance?: number;
  paymentDeadline?: Date | null;
  vehicle?: 'Spark' | 'P. Blanco' | 'P. Bronce' | 'Moto' | 'Motocicleta';
  vehicleTransmission?: 'Automático' | 'Manual' | 'Moto';
  licenseCategory?: 'A, C' | 'A, C, D' | 'A, B';
  theoreticalClassSchedule?: string;
  theoreticalClassDates?: (Date | undefined)[];
  practicalClassSchedules?: { date?: Date; time?: string }[];
  motoPracticalClassSchedules?: { date?: Date; time?: string }[];
  paidInFull?: boolean;
}


export interface AmpliacionesContractDetails {
    studentIdNumber?: string;
    studentAddress?: string;
    studentPhone1?: string;
    studentPhone2?: string;
    courseValue?: number;
    downPayment?: number;
    balance?: number;
    paymentDeadline?: Date | null;
    selectedPlans?: { name: string; price: number }[];
    theoreticalClassDate?: Date;
    theoreticalClassTime?: string;
}

export interface Contract {
  id: string;
  folioNumber: number;
  title: string;
  client?: Client;
  clientName: string;
  clientEmail: string;
  clientId: string;
  content: string;
  deadlines: Deadline[];
  status: ContractStatus;
  type: ContractType;
  userId: string;
  createdAt: Timestamp;
  createdBy?: string;
  deluxeDetails?: Partial<DeluxeContractDetails>;
  autoMotoDetails?: Partial<AutoMotoContractDetails>;
  ampliacionesDetails?: Partial<AmpliacionesContractDetails>;
  certificateGeneratedAt?: Timestamp;
}

export interface CertificateData {
  folio: string;
  clientName: string;
  courseName: string;
  issueDate: Timestamp;
  cip: string;
  licenseType: string;
}

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


export interface Report {
  id: string;
  date: Timestamp;
  transactions: Transaction[];
  cashBreakdown: {
    bills: { value: number; quantity: number }[];
    coins: { value: number; quantity: number }[];
  };
  expenses: { description: string; amount: number }[];
  totals: {
    creditCard: number;
    debitCard: number;
    global: number;
    bac: number;
    general: number;
    cheques: number;
    cash: number;
    billed: number;
    totalExpenses: number;
    deposit: number;
    difference: number;
  };
}

export interface Transaction {
  id: string;
  invoice: string;
  cedula: string;
  clientName: string;
  phone: string;
  service: string;
  amount: number;
  cash: number;
  debit: number;
  credit: number;
  global: number;
  bac: number;
  general: number;
  cheques: number;
}

export interface Payment {
  id: string;
  amount: number;
  paymentDate: Timestamp;
  contractId: string;
  contractFolio: number;
  cancellationFolio?: number;
  updateFolio?: number;
  clientId: string;
  clientName: string;
  clientAddress?: string;
  studentIdNumber: string;
  userId: string;
  type: 'abono' | 'cancelacion' | 'actualizacion';
}
