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
  createdAt: any;
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
  paymentInstallments?: any[];
  vehicleTransmission?: 'Automático' | 'Manual';
  licenseCategory?: string;
  theoreticalClassSchedule?: string;
  theoreticalClasses?: any[];
  classSchedules?: { date?: any; time?: string; vehicle?: VehicleName; instructor?: InstructorName; }[];
  paymentType?: string;
  instructor?: InstructorName;
  // Campos financieros consistentes
  courseValue?: number;
  downPayment?: number;
  balance?: number;
  paymentDeadline?: any;
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
  paymentDeadline?: any;
  vehicle?: VehicleName;
  vehicleTransmission?: 'Automático' | 'Manual' | 'Moto';
  licenseCategory?: string;
  theoreticalClassSchedule?: string;
  theoreticalClassDates?: any[];
  practicalClassSchedules?: { date?: any; time?: string; vehicle?: VehicleName; instructor?: InstructorName; }[];
  motoPracticalClassSchedules?: { date?: any; time?: string; vehicle?: VehicleName; instructor?: InstructorName; }[];
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
    paymentDeadline?: any;
    selectedPlans?: { name: string; price: number }[];
    theoreticalClassDate?: any;
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
  createdAt: any;
  createdBy?: string;
  deluxeDetails?: Partial<DeluxeContractDetails>;
  autoMotoDetails?: Partial<AutoMotoContractDetails>;
  ampliacionesDetails?: Partial<AmpliacionesContractDetails>;
  certificateGeneratedAt?: any;
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
  issueDate: any;
  cip: string;
  idType?: string; // 'C.I.P.' o 'PASS'
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
  bac: number;
  general: number;
  cheques: number;
  createdBy?: string;
}

export interface Payment {
  id: string;
  amount: number;
  paymentDate: any;
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
  paymentType?: string;
  createdBy?: string;
}

export interface BookSalePayment {
  id: string;
  amount: number;
  paymentDate: any;
  bookSaleFolio: number;
  bookTitle: string;
  clientName: string;
  studentIdNumber: string;
  userId: string;
  paymentType?: string;
  createdBy?: string;
}

export interface MileageLog {
  id: string;
  date: any;
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
  date: any;
  userId: string;
  vehicle: VehicleName;
  mileage: number;
  type: MaintenanceType;
  description: string;
  cost: number;
  nextServiceDate?: any;
};

export type VehicleName = 'Picanto Blanco' | 'Picanto Bronce' | 'Spark' | 'Moto Roja' | 'Moto Negra';
export type TimeSlot = '8am-10am' | '10am-12pm' | '1pm-3pm' | '3pm-5pm';
export type InstructorName = 'Julisse Alonso' | 'Emmanuel Camargo' | 'Adrian Gordon' | '';
export type MaintenanceType = 'Cambio de Aceite' | 'Revisión de Frenos' | 'Rotación de Llantas' | 'Mantenimiento General' | 'Otro';
