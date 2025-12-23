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

    // Autenticación directa usando la cuenta de servicio que tiene acceso al calendario.
    // Este método es más robusto ya que no depende de la suplantación.
    const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
        // Usar las credenciales predeterminadas del entorno de ejecución (App Hosting)
    });

    const authClient = await auth.getClient();
    const calendar = google.calendar({ version: 'v3', auth: authClient });

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
        } else if (gapiError.response?.data?.error?.message) {
            errorMessage = gapiError.response.data.error.message;
        } else if (gapiError.errors?.[0]?.message) {
            errorMessage = gapiError.errors[0].message;
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
