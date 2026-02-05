import { Timestamp, FieldValue } from 'firebase/firestore';

export interface User {
  uid: string;
  email: string;
  role: 'Ventas' | 'Ventas Externas' | 'Administrador';
}

export interface Client {
  id: string;
  name: string;
  email: string;
  idNumber?: string;
  phone?: string;
  userId: string;
  createdAt: Timestamp | FieldValue;
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
  paymentDetails?: string;
  paymentAmount?: number;
  paymentInstallments?: (Date | Timestamp | FieldValue | undefined)[];
  vehicleTransmission?: 'Automático' | 'Manual';
  licenseCategory?: 'A, C' | 'A, C, D';
  theoreticalClassSchedule?: string;
  theoreticalClasses?: (Date | Timestamp | FieldValue | undefined)[];
  classSchedules?: { date?: Date | Timestamp | FieldValue; time?: string }[];
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
  paymentDeadline?: Date | Timestamp | FieldValue | null;
  vehicle?: VehicleName;
  vehicleTransmission?: 'Automático' | 'Manual' | 'Moto';
  licenseCategory?: 'A, C' | 'A, C, D' | 'A, B';
  theoreticalClassSchedule?: string;
  theoreticalClassDates?: (Date | Timestamp | FieldValue | undefined)[];
  practicalClassSchedules?: { date?: Date | Timestamp | FieldValue; time?: string }[];
  motoPracticalClassSchedules?: { date?: Date | Timestamp | FieldValue; time?: string }[];
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
    paymentDeadline?: Date | Timestamp | FieldValue | null;
    selectedPlans?: { name: string; price: number }[];
    theoreticalClassDate?: Date | Timestamp | FieldValue;
    theoreticalClassTime?: string;
    paymentType?: string;
}

export interface Contract {
  id: string;
  folioNumber: number;
  title: string;
  clientName: string;
  clientEmail: string;
  clientId: string;
  type: ContractType;
  status: ContractStatus;
  userId: string;
  createdAt: Timestamp | FieldValue;
  createdBy?: string;
  deluxeDetails?: Partial<DeluxeContractDetails>;
  autoMotoDetails?: Partial<AutoMotoContractDetails>;
  ampliacionesDetails?: Partial<AmpliacionesContractDetails>;
  certificateGeneratedAt?: Timestamp | FieldValue;
  certificateFolio?: string;
  studentIdNumber?: string;
  clauses?: string;
  content?: string;
}

export interface Certificate {
  id: string;
  contractId: string;
  clientId: string;
  userId: string;
  folio: string;
  clientName: string;
  courseName: string;
  issueDate: Timestamp | FieldValue;
  cip: string;
  licenseType: string;
  contract?: Contract;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  secondLastName?: string;
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
  paymentDate: Timestamp | FieldValue;
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
  paymentDate: Timestamp | FieldValue;
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
  date: Timestamp | FieldValue;
  userId: string;
  cars: VehicleMileage[];
  totalDistance?: number;
}

export type MaintenanceLog = {
  id: string;
  date: Timestamp | FieldValue;
  userId: string;
  vehicle: VehicleName;
  mileage: number;
  type: MaintenanceType;
  description: string;
  cost: number;
  nextServiceDate?: Timestamp | FieldValue;
};

export type VehicleName = 'Picanto Blanco' | 'Picanto Bronce' | 'Spark' | 'Moto Roja' | 'Moto Negra';
export type TimeSlot = '8am-10am' | '10am-12pm' | '1pm-3pm' | '3pm-5pm';
export type InstructorName = 'Julisse Alonso' | 'Emmanuel Camargo' | 'Adrian Gordon' | '';
export type MaintenanceType = 'Cambio de Aceite' | 'Revisión de Frenos' | 'Rotación de Llantas' | 'Mantenimiento General' | 'Otro';