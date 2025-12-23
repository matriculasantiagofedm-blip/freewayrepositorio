'use server';

import { google } from 'googleapis';
import { z } from 'zod';

// Schema para una validación básica, aunque no se use en la entrada
const PingParamsSchema = z.object({});

export async function pingCalendarsAction(params: { calendarId: string }) {
  try {
    // Validar la entrada usando Zod (aunque en este caso es simple)
    PingParamsSchema.parse({});

    // Autenticar usando las credenciales del entorno de ejecución de Google Cloud
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      clientOptions: {
        subject: 'freewayseptiembre@gmail.com'
      }
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // Intentar obtener información del calendario específico
    // Esta es una operación de solo lectura, perfecta para un "ping"
    const calendarInfo = await calendar.calendars.get({
      calendarId: params.calendarId,
    });

    if (calendarInfo.status === 200 && calendarInfo.data) {
      console.log('Ping exitoso:', calendarInfo.data);
      return {
        success: true,
        message: `Conexión exitosa con el calendario: "${calendarInfo.data.summary}"`,
      };
    } else {
      throw new Error(
        `La API de Google Calendar devolvió un estado inesperado: ${calendarInfo.status}`
      );
    }
  } catch (error) {
    console.error('Error durante el ping a Google Calendar:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
    
    // Devolver un objeto de error estandarizado
    return {
      success: false,
      message: 'Fallo la conexión con Google Calendar.',
      error: errorMessage,
    };
  }
}
