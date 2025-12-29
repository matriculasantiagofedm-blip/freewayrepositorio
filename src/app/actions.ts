'use server';

import { ai } from '@/ai/genkit';
import { generateContractWithFolioFlow } from '@/ai/flows/generate-contract-folio';
import type { GenerateContractInput } from '@/lib/types';
import { z } from 'zod';
import { google } from 'googleapis';

export async function createContractAction(input: GenerateContractInput) {
  try {
    const result = await generateContractWithFolioFlow(input);
    
    if (result.error) {
      throw new Error(result.error);
    }
    return result;
  } catch (error) {
    console.error('[createContractAction] Unexpected error:', error);
    if (error instanceof Error) {
      return { contract: null, folio: '', error: error.message };
    }
    return { contract: null, folio: '', error: 'Ocurrió un error inesperado en el servidor.' };
  }
}

const PingCalendarInputSchema = z.object({
  calendarId: z.string(),
});

export async function pingCalendarsAction(input: z.infer<typeof PingCalendarInputSchema>) {
    try {
        const auth = new google.auth.GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
            clientOptions: {
              subject: 'freeways@project-c95d505f-7783-4848-afe.iam.gserviceaccount.com'
            }
        });

        const authClient = await auth.getClient();
        const calendar = google.calendar({ version: 'v3', auth: authClient });

        await calendar.calendarList.get({ calendarId: input.calendarId });
        
        return {
            success: true,
            message: 'Conexión exitosa.',
            calendarId: input.calendarId
        };
    } catch (error: any) {
        let errorMessage = 'Error desconocido al contactar la API de Google Calendar.';
        if (error.response?.data?.error?.message) {
            errorMessage = `(${error.response.status}) ${error.response.data.error.message}`;
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        return {
            success: false,
            message: 'Fallo la conexión.',
            error: errorMessage,
            calendarId: input.calendarId
        };
    }
}
