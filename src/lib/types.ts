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
  createdAt: Timestamp | FieldValue | Date | any;
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
  paymentInstallments?: (Date | Timestamp | FieldValue | any)[];
  vehicleTransmission?: 'Automático' | 'Manual';
  licenseCategory?: 'A, C' | 'A, C, D';
  theoreticalClassSchedule?: string;
  theoreticalClasses?: (Date | Timestamp | FieldValue | any)[];
  classSchedules?: { date?: Date | Timestamp | FieldValue | any; time?: string }[];
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
  paymentDeadline?: Date | Timestamp | FieldValue | any;
  vehicle?: VehicleName;
  vehicleTransmission?: 'Automático' | 'Manual' | 'Moto';
  licenseCategory?: 'A, C' | 'A, C, D' | 'A, B';
  theoreticalClassSchedule?: string;
  theoreticalClassDates?: (Date | Timestamp | FieldValue | any)[];
  practicalClassSchedules?: { date?: Date | Timestamp | FieldValue | any; time?: string }[];
  motoPracticalClassSchedules?: { date?: Date | Timestamp | FieldValue | any; time?: string }[];
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
    paymentDeadline?: Date | Timestamp | FieldValue | any;
    selectedPlans?: { name: string; price: number }[];
    theoreticalClassDate?: Date | Timestamp | FieldValue | any;
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
  createdAt: Timestamp | FieldValue | Date | any;
  createdBy?: string;
  deluxeDetails?: Partial<DeluxeContractDetails>;
  autoMotoDetails?: Partial<AutoMotoContractDetails>;
  ampliacionesDetails?: Partial<AmpliacionesContractDetails>;
  certificateGeneratedAt?: Timestamp | FieldValue | Date | any;
  certificateFolio?: string;
  studentIdNumber?: string;
  clauses?: string;
  content?: string;
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
  paymentDate: Timestamp | FieldValue | Date | any;
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
  paymentDate: Timestamp | FieldValue | Date | any;
  bookSaleFolio: number;
  bookTitle: string;
  clientName: string;
  studentIdNumber: string;
  userId: string;
  createdBy?: string;
}

export interface MileageLog {
  id: string;
  date: Timestamp | FieldValue | Date | any;
  userId: string;
  cars: VehicleMileage[];
  totalDistance?: number;
}

export interface VehicleMileage {
  name: VehicleName;
  initialMileage: number;
  finalMileage: number;
  distance: number;
}

export type MaintenanceLog = {
  id: string;
  date: Timestamp | FieldValue | Date | any;
  userId: string;
  vehicle: VehicleName;
  mileage: number;
  type: MaintenanceType;
  description: string;
  cost: number;
  nextServiceDate?: Timestamp | FieldValue | Date | any;
};

export type VehicleName = 'Picanto Blanco' | 'Picanto Bronce' | 'Spark' | 'Moto Roja' | 'Moto Negra';
export type TimeSlot = '8am-10am' | '10am-12pm' | '1pm-3pm' | '3pm-5pm';
export type InstructorName = 'Julisse Alonso' | 'Emmanuel Camargo' | 'Adrian Gordon' | '';
export type MaintenanceType = 'Cambio de Aceite' | 'Revisión de Frenos' | 'Rotación de Llantas' | 'Mantenimiento General' | 'Otro';