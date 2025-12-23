'use server';

/**
 * @fileOverview This file defines a Genkit flow for syncing practical classes with Google Calendar.
 *
 * @exports {syncWithGoogleCalendar} - The main function to trigger the calendar sync flow.
 * @exports {SyncCalendarInput} - The input type for the syncWithGoogleCalendar function.
 * @exports {SyncCalendarOutput} - The output type for the syncWithGoogleCalendar function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { format, parse } from 'date-fns';
import { google } from 'googleapis';

const SyncCalendarInputSchema = z.object({
  clientName: z.string().describe('The name of the client/student.'),
  clientEmail: z.string().email().describe("The client's email address."),
  contractTitle: z.string().describe('The title of the contract.'),
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
        // Use the default service account credentials from the execution environment.
        const auth = new google.auth.GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });

        const authClient = await auth.getClient();
        const calendar = google.calendar({ version: 'v3', auth: authClient });
        
        // This is the specific calendar ID we want to write to.
        const calendarId = 'caa22a55efb4ec8120e449941e8df3d2731613826485af050c0b7ec0b60be588@group.calendar.google.com';

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
            calendarId: calendarId,
            requestBody: event,
            sendUpdates: 'all',
        });

        return {
            success: true,
            eventId: response.data.id || undefined,
        };

    } catch (error) {
        console.error("Error creating Google Calendar event:", error);
        // Re-throw the error so the main flow can catch it and report details.
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

    // Helper to parse time slots like "8:00 am a 10:00 am"
    const parseTime = (timeSlot: string): [string, string] | null => {
        // Normalize input: lowercase, remove "a", trim spaces, handle "md" -> "pm"
        const normalized = timeSlot.toLowerCase().replace(/\s*a\s*/, ' ').replace('md', 'pm').trim();
        const timeParts = normalized.match(/(\d{1,2}:\d{2})\s*(am|pm)?/g);

        if (!timeParts || timeParts.length < 2) return null;
        
        try {
            // Parse start time
            let startTimeStr = timeParts[0];
            if (!/am|pm/.test(startTimeStr)) {
                // If start time is missing am/pm, try to infer from end time
                const endTimeStr = timeParts[1];
                if (endTimeStr && /pm/.test(endTimeStr)) startTimeStr += ' pm';
                else startTimeStr += ' am';
            }
            const startTime = parse(startTimeStr, 'h:mm a', new Date());

            // Parse end time
            let endTimeStr = timeParts[1];
             if (!/am|pm/.test(endTimeStr)) {
                // If end time is missing am/pm, check if it should be PM
                const endHour = parseInt(endTimeStr.split(':')[0], 10);
                const startHour = startTime.getHours();
                if (endHour < startHour || (startHour >= 12 && endHour < 12)) endTimeStr += ' pm';
                else endTimeStr += ' am';
            }
            const endTime = parse(endTimeStr, 'h:mm a', new Date());
            
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

        // Combine date and time to form a full ISO string
        const startDateTimeISO = `${practicalClass.date}T${startTime}`;
        const endDateTimeISO = `${practicalClass.date}T${endTime}`;

        const eventSummary = `Clase Práctica: ${input.contractTitle}`;
        const eventDescription = `Clase práctica para el estudiante ${input.clientName}.`;

        try {
            const result = await createGoogleCalendarEvent({
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
                // If it's a Google API error, the message might be in a nested object
                const gapiError = error as any;
                if (gapiError.response?.data?.error_description) {
                    errorMessage = gapiError.response.data.error_description;
                } else if (gapiError.response?.data?.error?.message) {
                    errorMessage = gapiError.response.data.error.message;
                } else if (gapiError.errors?.[0]?.message) {
                    errorMessage = gapiError.errors[0].message;
                }
            }
            errors.push(`Error al crear evento para ${practicalClass.date}: ${errorMessage}`);
        }
    }

    return { eventsCreated, errors };
  }
);
