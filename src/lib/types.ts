
import { z } from 'zod';

// Reemplazamos Timestamp con Date para desacoplar el tipo de la librería de Firebase
// y evitar errores de compilación en Next.js.
// La conversión a Timestamp se manejará en la capa de acceso a datos.
type FirestoreTimestamp = Date;

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
  createdAt: FirestoreTimestamp;
  // Agregamos campos que estaban implícitos en los detalles del contrato
  studentAddress?: string;
  studentPhone1?: string;
  studentPhone2?: string;
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
  studentPhone2?: string;
  vehicleTransmission: 'Automático' | 'Manual';
  licenseCategory: 'A, C' | 'A, C, D';
  theoreticalClassSchedule?: 'Lunes' | 'Miércoles';
  theoreticalClasses?: (FirestoreTimestamp | undefined)[];
  classSchedules: { date?: FirestoreTimestamp; time?: string }[];
  paymentDetails: string;
  paymentInstallments?: (FirestoreTimestamp | undefined)[];
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
  paymentDeadline?: FirestoreTimestamp;
  vehicle?: 'Spark' | 'P. Blanco' | 'P. Bronce' | 'Moto';
  vehicleTransmission?: 'Automático' | 'Manual' | 'Moto';
  licenseCategory?: 'A, C' | 'A, C, D' | 'A, B';
  theoreticalClassSchedule?: string;
  theoreticalClassDates?: (FirestoreTimestamp | undefined)[];
  practicalClassSchedules?: { date?: FirestoreTimestamp; time?: string }[];
  motoPracticalClassSchedules?: { date?: FirestoreTimestamp; time?: string }[];
}

export interface AmpliacionesContractDetails {
    studentIdNumber?: string;
    studentAddress?: string;
    studentPhone1?: string;
    studentPhone2?: string;
    courseValue?: number;
    downPayment?: number;
    balance?: number;
    paymentDeadline?: FirestoreTimestamp;
    selectedPlans?: { name: string; price: number }[];
    theoreticalClassDate?: FirestoreTimestamp;
    theoreticalClassTime?: string;
}


export interface Contract {
  id: string;
  title: string;
  folioNumber?: number; // Added folio number
  client?: Client; // This might be populated after fetching
  clientName: string;
  clientEmail: string;
  clientId: string; // The ID of the client document in the /clients collection
  studentIdNumber?: string; // Denormalized for searching
  content: string;
  deadlines: Deadline[];
  status: ContractStatus;
  type: ContractType;
  userId: string;
  createdAt: FirestoreTimestamp;
  createdBy?: string; // User role who created the contract
  deluxeDetails?: Partial<DeluxeContractDetails>;
  autoMotoDetails?: Partial<AutoMotoContractDetails>;
  ampliacionesDetails?: Partial<AmpliacionesContractDetails>;
}

const GenerateContractDataSchema = z.object({
  clientName: z.string(),
  clientEmail: z.string().email(),
  contractType: z.string(),
  studentIdNumber: z.string(),
  userId: z.string(),
  createdBy: z.string(),
});

const GenerateContractDetailsSchema = z.any();

export const GenerateContractInputSchema = z.object({
  contractData: GenerateContractDataSchema,
  details: GenerateContractDetailsSchema,
});
export type GenerateContractInput = z.infer<typeof GenerateContractInputSchema>;
