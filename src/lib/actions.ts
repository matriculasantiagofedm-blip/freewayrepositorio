'use server';

import { z } from 'zod';
import { sendAutomatedDeadlineReminders } from '@/ai/flows/automated-deadline-reminders';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getAuth } from 'firebase/auth';
import type { Client, DeluxeContractDetails } from '@/lib/types';

const FormSchema = z.object({
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres.'),
  clientName: z.string().min(3, 'El nombre del cliente es obligatorio.'),
  clientEmail: z.string().email('Por favor, introduce un correo electrónico válido.'),
  content: z.string().min(10, 'El contenido del contrato es demasiado corto.').optional().nullable(),
  type: z.enum([
    'Curso Auto', 
    'Curso Moto', 
    'Curso Mixto'
  ]),
  deadlines: z.array(z.object({
    description: z.string().min(3, 'La descripción es demasiado corta.'),
    date: z.date(),
  })).optional(),
  deluxeDetails: z.object({
      studentIdNumber: z.string().optional(),
      studentAddress: z.string().optional(),
      studentPhone1: z.string().optional(),
      studentPhone2: z.string().optional(),
      vehicleTransmission: z.enum(['Automático', 'Manual']).optional(),
      licenseCategory: z.enum(['A, C', 'A, C, D']).optional(),
      classSchedules: z.array(z.object({
        date: z.date().optional(),
        time: z.string().optional(),
      })).optional(),
      paymentDetails: z.string().optional(),
    }).optional(),
});

export type State = {
  errors?: {
    title?: string[];
    clientName?: string[];
    clientEmail?: string[];
    content?: string[];
    type?: string[];
    deadlines?: string[];
    deluxeDetails?: string[];
    _form?: string[];
  };
  message?: string | null;
};

async function findOrCreateClient(db: any, clientName: string, clientEmail: string, userId: string): Promise<string> {
    const clientsRef = collection(db, 'clients');
    const q = query(clientsRef, where("email", "==", clientEmail), where("userId", "==", userId));
    
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        // Client exists
        return querySnapshot.docs[0].id;
    } else {
        // Client does not exist, create a new one
        const newClientRef = doc(collection(db, 'clients'));
        const newClient: Omit<Client, 'id'> = {
            name: clientName,
            email: clientEmail,
            userId: userId,
            createdAt: serverTimestamp()
        };
        await setDoc(newClientRef, newClient);
        return newClientRef.id;
    }
}


export async function createContract(prevState: State, formData: FormData) {
  // This is a server action, we can initialize firebase here
  const { firestore, auth } = initializeFirebase();
  const user = auth.currentUser;

  if (!user) {
    return {
      errors: { _form: ['Debes iniciar sesión para crear un contrato.'] },
      message: 'Authentication error.',
    };
  }

  const deadlineDescriptions = formData.getAll('deadline.description');
  const deadlineDates = formData.getAll('deadline.date');

  const deadlines = deadlineDescriptions.map((desc, index) => ({
    description: desc as string,
    date: new Date(deadlineDates[index] as string),
  })).filter(d => d.description && d.date);

  const deluxeDetailsString = formData.get('deluxeDetails');
  let deluxeDetails;
  if (deluxeDetailsString && typeof deluxeDetailsString === 'string') {
    deluxeDetails = JSON.parse(deluxeDetailsString);
  }

  const validatedFields = FormSchema.safeParse({
    title: formData.get('title'),
    clientName: formData.get('clientName'),
    clientEmail: formData.get('clientEmail'),
    content: formData.get('content') || null,
    type: formData.get('type'),
    deadlines: deadlines,
    deluxeDetails: deluxeDetails
  });

  if (!validatedFields.success) {
    console.log(validatedFields.error.flatten().fieldErrors);
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'No se pudo crear el contrato. Por favor, revisa los campos.',
    };
  }

  const { title, clientName, clientEmail, content, type, deadlines: parsedDeadlines, deluxeDetails: parsedDeluxeDetails } = validatedFields.data;
  
  try {
    const clientId = await findOrCreateClient(firestore, clientName, clientEmail, user.uid);
    
    const contractsCollection = collection(firestore, 'clients', user.uid, 'contracts');
    
    const contractContent = type === 'Curso Mixto' ? '' : content;

    const newContractData: any = {
        title,
        content: contractContent,
        type,
        deadlines: parsedDeadlines || [],
        clientId: clientId,
        clientEmail: clientEmail,
        clientName: clientName,
        userId: user.uid,
        status: 'active',
        createdAt: serverTimestamp(),
    };

    if (type === 'Curso Mixto' && parsedDeluxeDetails) {
        newContractData.deluxeDetails = parsedDeluxeDetails;
    }


    const newContractRef = await addDoc(contractsCollection, newContractData);

    const contractId = newContractRef.id;

    if (parsedDeadlines && parsedDeadlines.length > 0) {
      await sendAutomatedDeadlineReminders({
        contractId,
        clientEmail,
        userEmail: user.email || 'legaleagle@example.com', 
        deadlines: parsedDeadlines.map(d => ({
            ...d,
            date: d.date.toISOString().split('T')[0] // Format date to YYYY-MM-DD
        })),
      });
    }
  } catch (error) {
    console.error('Error creating contract:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
    return {
      errors: { _form: [errorMessage] },
      message: 'Error de base de datos: No se pudo crear el contrato.',
    };
  }
  
  revalidatePath('/dashboard');
  revalidatePath('/contracts');
  redirect('/dashboard');
}
