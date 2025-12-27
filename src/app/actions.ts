'use server';

import { google } from 'googleapis';
import { z } from 'zod';
import {
  generateContractWithSequentialFolio,
  type GenerateContractInput,
} from '@/ai/flows/generate-contract-folio';

const PingParamsSchema = z.object({
  calendarId: z.string().min(1, 'El ID del calendario es requerido.'),
});

export async function pingCalendarsAction(params: { calendarId: string }) {
  try {
    PingParamsSchema.parse(params);

    const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });

    const authClient = await auth.getClient();
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    const calendarInfo = await calendar.calendars.get({
      calendarId: params.calendarId,
    });

    if (calendarInfo.status === 200 && calendarInfo.data) {
      return {
        success: true,
        message: `Conexión exitosa con el calendario: "${calendarInfo.data.summary}"`,
        calendarId: params.calendarId
      };
    } else {
      throw new Error(
        `La API de Google Calendar devolvió un estado inesperado: ${calendarInfo.status}`
      );
    }
  } catch (error) {
    let errorMessage = 'Ocurrió un error desconocido.';
    if (error instanceof Error) {
        errorMessage = error.message;
        const gapiError = error as any;
        if (gapiError.response?.data?.error?.message) {
            errorMessage = `(${gapiError.response.status}) ${gapiError.response.data.error.message}`;
        } else if (gapiError.errors?.[0]?.message) {
            errorMessage = gapiError.errors[0].message;
        }
    }
    
    return {
      success: false,
      message: 'Fallo la conexión con Google Calendar.',
      error: errorMessage,
      calendarId: params.calendarId
    };
  }
}

export async function createContractAction(input: GenerateContractInput) {
  try {
    const result = await generateContractWithSequentialFolio(input);
    if (result.error) {
      // Re-throw the specific error from the flow to be caught by the client
      throw new Error(result.error);
    }
    return result;
  } catch (error) {
    // Catch any other unexpected errors during the action execution
    console.error('[createContractAction] Unexpected error:', error);
    if (error instanceof Error) {
      return { contract: null, folio: '', error: error.message };
    }
    return { contract: null, folio: '', error: 'Ocurrió un error inesperado en el servidor.' };
  }
}
