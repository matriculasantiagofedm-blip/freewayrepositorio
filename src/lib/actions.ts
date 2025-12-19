'use server';

import { z } from 'zod';
import { sendAutomatedDeadlineReminders } from '@/ai/flows/automated-deadline-reminders';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

const FormSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters.'),
  clientEmail: z.string().email('Please enter a valid email.'),
  content: z.string().min(10, 'Contract content is too short.'),
  deadlines: z.array(z.object({
    description: z.string().min(3, 'Description is too short.'),
    date: z.date(),
  })).optional(),
});

export type State = {
  errors?: {
    title?: string[];
    clientEmail?: string[];
    content?: string[];
    deadlines?: string[];
    _form?: string[];
  };
  message?: string | null;
};


export async function createContract(prevState: State, formData: FormData) {
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
    deadlines: deadlines,
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Failed to create contract. Please check the fields.',
    };
  }

  const { title, clientEmail, content, deadlines: parsedDeadlines } = validatedFields.data;

  try {
    // Here you would typically save the contract to your database.
    // For this demo, we'll just log it.
    const contractId = `CTR-${Date.now()}`;
    console.log('Creating contract:', { contractId, title, clientEmail, content, parsedDeadlines });

    // Trigger the GenAI flow for automated reminders if there are deadlines
    if (parsedDeadlines && parsedDeadlines.length > 0) {
      await sendAutomatedDeadlineReminders({
        contractId,
        clientEmail,
        userEmail: 'legaleagle@example.com', // Assuming a static user email
        deadlines: parsedDeadlines.map(d => ({
            ...d,
            date: d.date.toISOString().split('T')[0] // Format date to YYYY-MM-DD
        })),
      });
      console.log('Automated reminders scheduled.');
    }
  } catch (error) {
    console.error('Error creating contract or scheduling reminders:', error);
    return {
      errors: { _form: ['An unexpected error occurred. Please try again.'] },
      message: 'Database or AI Error: Failed to Create Contract.',
    };
  }
  
  // Revalidate the dashboard path to show the new contract (if it were real)
  revalidatePath('/dashboard');
  
  // Redirect to the dashboard
  redirect('/dashboard');
}
