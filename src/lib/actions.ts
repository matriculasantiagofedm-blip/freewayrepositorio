'use server';

import { z } from 'zod';
import { sendAutomatedDeadlineReminders } from '@/ai/flows/automated-deadline-reminders';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getAuth } from 'firebase/auth';

const FormSchema = z.object({
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres.'),
  clientEmail: z.string().email('Por favor, introduce un correo electrónico válido.'),
  content: z.string().min(10, 'El contenido del contrato es demasiado corto.'),
  type: z.enum([
    'Curso Auto', 
    'Curso Moto', 
    'Curso Auto Básico', 
    'Curso Auto Plus', 
    'Curso Auto Premium', 
    'Curso Auto Deluxe',
    'Curso Moto Básico',
    'Curso Moto Plus',
    'Curso Moto Premium'
  ]),
  deadlines: z.array(z.object({
    description: z.string().min(3, 'La descripción es demasiado corta.'),
    date: z.date(),
  })).optional(),
});

export type State = {
  errors?: {
    title?: string[];
    clientEmail?: string[];
    content?: string[];
    type?: string[];
    deadlines?: string[];
    _form?: string[];
  };
  message?: string | null;
};


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
    description: desc,
    date: new Date(deadlineDates[index] as string),
  }));

  const validatedFields = FormSchema.safeParse({
    title: formData.get('title'),
    clientEmail: formData.get('clientEmail'),
    content: formData.get('content'),
    type: formData.get('type'),
    deadlines: deadlines,
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'No se pudo crear el contrato. Por favor, revisa los campos.',
    };
  }

  const { title, clientEmail, content, type, deadlines: parsedDeadlines } = validatedFields.data;

  try {
    const contractsCollection = collection(firestore, 'contracts');
    const newContractRef = await addDoc(contractsCollection, {
      title,
      clientEmail,
      content,
      type,
      deadlines: parsedDeadlines || [],
      userId: user.uid,
      status: 'draft',
      createdAt: serverTimestamp(),
      // In a real app, you'd probably look up the client by email
      // and get their ID, or create a new client.
      clientId: 'temp-client-id', 
    });

    const contractId = newContractRef.id;
    console.log('Creando contrato:', { contractId, title, clientEmail, content, type, parsedDeadlines });

    // Trigger the GenAI flow for automated reminders if there are deadlines
    if (parsedDeadlines && parsedDeadlines.length > 0) {
      await sendAutomatedDeadlineReminders({
        contractId,
        clientEmail,
        userEmail: user.email || 'legaleagle@example.com', // Assuming a static user email
        deadlines: parsedDeadlines.map(d => ({
            ...d,
            date: d.date.toISOString().split('T')[0] // Format date to YYYY-MM-DD
        })),
      });
      console.log('Recordatorios automáticos programados.');
    }
  } catch (error) {
    console.error('Error creando contrato o programando recordatorios:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
    return {
      errors: { _form: [errorMessage] },
      message: 'Error de base de datos o IA: No se pudo crear el contrato.',
    };
  }
  
  revalidatePath('/dashboard');
  redirect('/dashboard');
}
