'use server';

/**
 * @fileOverview This file defines a Genkit flow for syncing practical classes with Google Calendar.
 *
 * @exports {syncWithGoogleCalendar} - The main function to trigger the calendar sync flow.
 * @exports {SyncCalendarInput} - The input type for the syncWithGoogle-calendar function.
 * @exports {SyncCalendarOutput} - The return type for the syncWithGoogleCalendar function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { format, parse } from 'date-fns';
import { google } from 'googleapis';
import type { AutoMotoContractDetails } from '@/lib/types';


const calendarIdMapping: Record<NonNullable<AutoMotoContractDetails['vehicle']>, string> = {
    'Spark': 'spark_915a8e75fb77411f3281b6c402f511ff7ecb16977457a2c8f4257c51cdfdef80@group.calendar.google.com',
    'P. Blanco': 'picanto_blanco_35a77224bcac6dc3d7583f5d04a76e08188a4128c73a69d11125404515815e47@group.calendar.google.com',
    'P. Bronce': 'picanto_bronce_c165061133564b4592330beb28155342d1a48c8a58e7200cee3a8c93d7410c65@group.calendar.google.com',
    'Moto': 'moto_certificados.fedm@gmail.com',
};
const defaultCalendarId = 'caa22a55efb4ec8120e449941e8df3d2731613826485af050c0b7ec0b60be588@group.calendar.google.com';


const SyncCalendarInputSchema = z.object({
  clientName: z.string().describe('The name of the client/student.'),
  clientEmail: z.string().email().describe("The client's email address."),
  contractTitle: z.string().describe('The title of the contract.'),
  vehicle: z.enum(['Spark', 'P. Blanco', 'P. Bronce', 'Moto']).optional(),
  practicalClasses: z.array(
    z.object({
      date: z.string().describe('The date of the class (YYYY-MM-DD).'),
      time: z.string().describe('The time slot of the class (e.g., "8:00 am a 10:00 am").'),
    })
  ).describe('An array of practical classes to be scheduled.'),
});
export type SyncCalendarInput = z.infer<typeof SyncCalendarInputSchema>;

const SyncCalendarOutputSchema = z.object({
  eventsCreated: z.number().describe('The number of calendar events successfully created.'),
  errors: z.array(z.string()).describe('A list of errors that occurred during the process.'),
});
export type SyncCalendarOutput = z.infer<typeof SyncCalendarOutputSchema>;


export async function syncWithGoogleCalendar(input: SyncCalendarInput): Promise<SyncCalendarOutput> {
  return syncGoogleCalendarFlow(input);
}


const createGoogleCalendarEvent = ai.defineTool({
    name: 'createGoogleCalendarEvent',
    description: 'Creates a new event in Google Calendar.',
    inputSchema: z.object({
        calendarId: z.string().describe('The ID of the target Google Calendar.'),
        summary: z.string().describe('The title or summary of the event.'),
        description: z.string().describe('A detailed description of the event.'),
        startTime: z.string().datetime().describe('The start date and time of the event in ISO 8601 format.'),
        endTime: z.string().datetime().describe('The end date and time of the event in ISO 8601 format.'),
        attendeeEmail: z.string().email().describe("The client's email to invite to the event.")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        eventId: z.string().optional(),
    }),
}, async (input) => {
    try {
        const auth = new google.auth.GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });

        const authClient = await auth.getClient();
        const calendar = google.calendar({ version: 'v3', auth: authClient });
        
        const event = {
            summary: input.summary,
            description: input.description,
            start: {
                dateTime: input.startTime,
                timeZone: 'America/Panama',
            },
            end: {
                dateTime: input.endTime,
                timeZone: 'America/Panama',
            },
            attendees: [
                { email: input.attendeeEmail }
            ],
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 }, // 1 day before
                    { method: 'popup', minutes: 120 },     // 2 hours before
                ],
            },
        };

        const response = await calendar.events.insert({
            calendarId: input.calendarId,
            requestBody: event,
            sendUpdates: 'all',
        });

        return {
            success: true,
            eventId: response.data.id || undefined,
        };

    } catch (error) {
        console.error("Error creating Google Calendar event:", error);
        throw error;
    }
});


const syncGoogleCalendarFlow = ai.defineFlow(
  {
    name: 'syncGoogleCalendarFlow',
    inputSchema: SyncCalendarInputSchema,
    outputSchema: SyncCalendarOutputSchema,
  },
  async (input) => {
    let eventsCreated = 0;
    const errors: string[] = [];

    const targetCalendarId = (input.vehicle ? calendarIdMapping[input.vehicle] : defaultCalendarId) || defaultCalendarId;

    const parseTime = (timeSlot: string): [string, string] | null => {
        const normalized = timeSlot.toLowerCase().replace(/\s*a\s*/, ' ').replace('md', 'pm').trim();
        const timeParts = normalized.match(/(\d{1,2}:\d{2})\s*(am|pm)?/g);

        if (!timeParts || timeParts.length < 2) return null;
        
        try {
            let startTimeStr = timeParts[0];
            const endTimeStrRaw = timeParts[1];
            
            const inferAmPm = (timeStr: string, referenceTime?: Date): string => {
                if (/am|pm/.test(timeStr)) return timeStr;
                
                const hour = parseInt(timeStr.split(':')[0], 10);
                if (referenceTime) { // Infer based on reference time
                    const refHour = referenceTime.getHours();
                    if (hour < refHour || (refHour >= 12 && hour < 12)) return `${timeStr} pm`;
                } else { // Default inference
                     if (hour >= 8 && hour < 12) return `${timeStr} am`;
                     if (hour === 12 || (hour >= 1 && hour < 7)) return `${timeStr} pm`;
                }
                return `${timeStr} am`; // Default fallback
            };
            
            startTimeStr = inferAmPm(startTimeStr);
            const startTime = parse(startTimeStr, 'h:mm a', new Date());

            let endTimeStr = inferAmPm(endTimeStrRaw, startTime);
            const endTime = parse(endTimeStr, 'h:mm a', new Date());

            // Handle cases where end time is implicitly the next day (e.g., 10pm to 1am)
            if (endTime <= startTime) {
                endTime.setDate(endTime.getDate() + 1);
            }

            return [format(startTime, 'HH:mm:ss'), format(endTime, 'HH:mm:ss')];
        } catch (e) {
            console.error('Error parsing time slot:', timeSlot, e);
            return null;
        }
    };
    
    for (const practicalClass of input.practicalClasses) {
        if (!practicalClass.date || !practicalClass.time) continue;

        const timeParts = parseTime(practicalClass.time);
        if (!timeParts) {
            errors.push(`Formato de hora inválido para la clase del ${practicalClass.date}: "${practicalClass.time}"`);
            continue;
        }
        
        const [startTime, endTime] = timeParts;

        const startDateTimeISO = `${practicalClass.date}T${startTime}`;
        const endDateTimeISO = `${practicalClass.date}T${endTime}`;

        const eventSummary = `Clase Práctica: ${input.contractTitle}`;
        const eventDescription = `Clase práctica para el estudiante ${input.clientName}. Vehículo: ${input.vehicle || 'No especificado'}.`;

        try {
            const result = await createGoogleCalendarEvent({
                calendarId: targetCalendarId,
                summary: eventSummary,
                description: eventDescription,
                startTime: startDateTimeISO,
                endTime: endDateTimeISO,
                attendeeEmail: input.clientEmail 
            });

            if (result.success) {
                eventsCreated++;
            } else {
                errors.push(`Fallo al crear evento para la clase del ${practicalClass.date}`);
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
            errors.push(`Error al crear evento para ${practicalClass.date} en calendario ${targetCalendarId}: ${errorMessage}`);
        }
    }

    return { eventsCreated, errors };
  }
);
