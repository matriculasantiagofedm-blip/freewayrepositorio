'use server';

import { google } from 'googleapis';
import { z } from 'zod';

// Schema para una validación básica
const PingParamsSchema = z.object({
  calendarId: z.string().min(1, 'El ID del calendario es requerido.'),
});

export async function pingCalendarsAction(params: { calendarId: string }) {
  try {
    // Validar la entrada usando Zod
    PingParamsSchema.parse(params);

    // Autenticar usando las credenciales del entorno de ejecución de Google Cloud.
    // Esta es la forma recomendada y más segura en App Hosting.
    // Al especificar 'subject', le decimos que actúe en nombre de la cuenta de servicio
    // que tiene acceso al calendario compartido.
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      clientOptions: {
        subject: 'freeways@project-c95d505f-7783-4848-afe.iam.gserviceaccount.com'
      }
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // Intentar obtener información del calendario específico.
    // Esta es una operación de solo lectura, perfecta para un "ping".
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
    
    // Proporcionar un mensaje de error más detallado
    let errorMessage = 'Ocurrió un error desconocido.';
    if (error instanceof Error) {
        errorMessage = error.message;
        // Si es un error de la API de Google, el mensaje puede estar en un objeto anidado
        const gapiError = error as any;
        if (gapiError.response?.data?.error_description) {
            errorMessage = gapiError.response.data.error_description;
        } else if (gapiError.response?.data?.error) {
            errorMessage = `${gapiError.response.data.error.message} (Code: ${gapiError.response.data.error.code})`;
        }
    }
    
    // Devolver un objeto de error estandarizado
    return {
      success: false,
      message: 'Fallo la conexión con Google Calendar.',
      error: errorMessage,
    };
  }
}
