import { Timestamp, FieldValue } from 'firebase/firestore';

export interface User {
  uid: string;
  email: string;
  role: 'Ventas' | 'Ventas Externas' | 'Administrador';
}

export interface UserProfile {
  id: string;
  uid: string;
  role: string;
  name: string;
  lastActive: any;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  participantRoles: Record<string, string>;
  participantNames: Record<string, string>;
  lastMessage?: string;
  updatedAt: any;
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
  | 'Curso Solo Practica'
  | 'Ampliaciones';

export type ClassStatus = 'scheduled' | 'missed' | 'completed' | 'refueled' | 'rescheduled' | 'cancelled_vehicle';

export interface PracticalClassSlot {
  date?: any;
  time?: string;
  vehicle?: VehicleName;
  instructor?: InstructorName;
  status?: ClassStatus;
  refueled?: boolean;
}

export interface DeluxeContractDetails {
  coursePlan?: string;
  idType?: string;
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
  classSchedules?: PracticalClassSlot[];
  paymentType?: string;
  instructor?: InstructorName;
  courseValue?: number;
  enrollmentFee?: number;
  downPayment?: number;
  balance?: number;
  paymentDeadline?: any;
}

export interface AutoMotoContractDetails {
  idType?: string;
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
  vehicleType?: 'Auto' | 'Motocicleta';
  vehicleTransmission?: 'Automático' | 'Manual' | 'Moto';
  licenseCategory?: string;
  theoreticalClassSchedule?: string;
  theoreticalClassDates?: any[];
  practicalClassSchedules?: PracticalClassSlot[];
  motoPracticalClassSchedules?: PracticalClassSlot[];
  paidInFull?: boolean;
  paymentType?: string;
  instructor?: InstructorName;
  photoDataUri?: string;
  idCardDataUri?: string;
  licenseDataUri?: string;
}

export interface AmpliacionesContractDetails {
  idType?: string;
  studentIdNumber: string;
  studentAddress: string;
  studentPhone1: string;
  studentPhone2?: string;
  courseValue: number;
  downPayment: number;
  balance: number;
  paymentDeadline?: any;
  licenseCategory: string;
  theoreticalClassDate?: any;
  theoreticalClassTime?: string;
  paymentType: string;
  photoDataUri?: string;
  idCardDataUri?: string;
  licenseDataUri?: string;
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
  isOnline?: boolean;
  deluxeDetails?: Partial<DeluxeContractDetails>;
  autoMotoDetails?: Partial<AutoMotoContractDetails>;
  ampliacionesDetails?: Partial<AmpliacionesContractDetails>;
  certificateGeneratedAt?: any;
  certificateFolio?: string;
  studentIdNumber?: string;
  clauses?: string;
  content?: string;
  certificateFirstName?: string;
  certificateMiddleName?: string;
  certificateLastName?: string;
  certificateSecondLastName?: string;
  certificateMarriedLastName?: string;
  certificateLicenseType?: string;
  certificateCip?: string;
  certificateIdType?: string;
  isCorrection?: boolean;
  isUpdate?: boolean;
  isManualPrint?: boolean;
  photoDataUri?: string;
  idCardDataUri?: string;
  licenseDataUri?: string;
}

export interface ManualSchedule {
  id: string;
  studentName: string;
  coursePlan?: string;
  date: any;
  timeSlot: TimeSlot;
  vehicle: string;
  instructor: string;
  classNumber: number;
  classType: 'Práctica' | 'Teórica';
  status?: ClassStatus;
  refueled?: boolean;
  userId: string;
  createdAt: any;
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
  idType?: string;
  licenseType: string;
  contract?: Contract;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  secondLastName?: string;
  marriedLastName?: string;
  photoDataUri?: string;
  idCardDataUri?: string;
  licenseDataUri?: string;
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
  yappy: number;
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

export type VehicleName = 'Picanto Blanco' | 'Picanto Bronce' | 'Spark' | 'Pick up' | 'Moto Roja' | 'Moto Negra' | 'Skoda Automatico' | 'Skoda Manual' | 'Hyundai Manual';
export type TimeSlot = '8am-10am' | '10am-12pm' | '1pm-3pm' | '3pm-5pm';
export type InstructorName = 'Emmanuel Camargo' | 'Adrian Gordon' | 'Roberto Brown' | 'Marco Franco' | '';
export type MaintenanceType = 'Cambio de Aceite' | 'Revisión de Frenos' | 'Rotación de Llantas' | 'Mantenimiento General' | 'Otro';

export type Message = {
    id: string;
    text: string;
    sender: 'me' | 'client';
    time: string;
    status: 'sent' | 'delivered' | 'read';
    timestamp?: any;
};
