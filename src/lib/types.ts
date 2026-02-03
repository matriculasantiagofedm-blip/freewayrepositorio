

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
  paymentType?: string;
  instructor?: InstructorName;
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
  vehicle?: 'Spark' | 'P. Blanco' | 'P. Bronce' | 'Motocicleta';
  vehicleTransmission?: 'Automático' | 'Manual' | 'Moto';
  licenseCategory?: 'A, C' | 'A, C, D' | 'A, B';
  theoreticalClassSchedule?: string;
  theoreticalClassDates?: (Date | undefined)[];
  practicalClassSchedules?: { date?: Date; time?: string }[];
  motoPracticalClassSchedules?: { date?: Date; time?: string }[];
  paidInFull?: boolean;
  paymentType?: string;
  instructor?: InstructorName;
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
    paymentType?: string;
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

export interface Transaction {
  id: string;
  contrato: string;
  cedula: string;
  clientName: string;
  service: string;
  amount: number;
  paymentType: string;
  cash: number;
  debit: number;
  credit: number;
  global: number;
  bac: number;
  general: number;
  cheques: number;
  createdBy?: string;
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
  createdBy?: string;
}

export interface BookSalePayment {
  id: string;
  amount: number;
  paymentDate: Timestamp;
  bookSaleFolio: number;
  bookTitle: string;
  clientName: string;
  studentIdNumber: string;
  userId: string;
  createdBy?: string;
}

export interface VehicleMileage {
  name: VehicleName;
  initialMileage: number;
  finalMileage: number;
  distance: number;
}

export interface MileageLog {
  id: string;
  date: Timestamp;
  userId: string;
  cars: VehicleMileage[];
  totalDistance?: number;
}

export type MaintenanceType = 'Cambio de Aceite' | 'Revisión de Frenos' | 'Rotación de Llantas' | 'Mantenimiento General' | 'Otro';

export interface MaintenanceLog {
  id: string;
  date: Timestamp;
  userId: string;
  vehicle: VehicleName;
  mileage: number;
  type: MaintenanceType;
  description: string;
  cost: number;
  nextServiceDate?: Timestamp;
}

export type VehicleName = 'Picanto Blanco' | 'Picanto Bronce' | 'Spark' | 'Moto Roja' | 'Moto Negra';
export type TimeSlot = '8am-10am' | '10am-12pm' | '1pm-3pm' | '3pm-5pm';
export type InstructorName = 'Julisse Alonso' | 'Emmanuel Camargo' | 'Adrian Gordon' | '';

export interface VehicleAssignment {
  vehicle: VehicleName;
  timeSlot: TimeSlot;
  instructor: InstructorName;
  studentName: string;
}

export interface VehicleSchedule {
  id: string;
  date: Timestamp;
  userId: string;
  assignments: VehicleAssignment[];
}
