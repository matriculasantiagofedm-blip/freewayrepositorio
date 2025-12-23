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
        const auth = new google.auth.GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/calendar'],
            // Usa la cuenta de servicio específica que tiene acceso al calendario
            clientOptions: {
              subject: 'freeways@project-c95d505f-7783-4848-afe.iam.gserviceaccount.com'
            }
        });

        const calendar = google.calendar({ version: 'v3', auth });
        
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
        };

        const response = await calendar.events.insert({
            calendarId: calendarId,
            requestBody: event,
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

    // Helper to parse time slots like "8:00 am a 10:00 am"
    const parseTime = (timeSlot: string): [string, string] | null => {
        // Match times with am/pm, allowing for "md" as noon/midnight
        const timeParts = timeSlot.match(/(\d{1,2}:\d{2})\s*(am|pm|md)/gi);
        if (!timeParts || timeParts.length < 2) return null;

        const parseTimePart = (part: string) => {
            // Treat "md" as "pm" for parsing noon.
            let sanitizedPart = part.replace('md', 'pm');
            // Ensure format is hh:mm aa for parsing consistency
            if (!/(\d{1,2}:\d{2})\s*(am|pm)/i.test(sanitizedPart)) {
                 // If am/pm is missing, assume it follows the pattern (e.g., from "1:00 a 3:00 pm")
                 sanitizedPart = sanitizedPart.replace(/(\d{1,2}:\d{2})/, '$1 pm');
            }
            return parse(sanitizedPart, 'h:mm a', new Date());
        }
        
        const startTime = parseTimePart(timeParts[0]);
        const endTime = parseTimePart(timeParts[1]);

        return [format(startTime, 'HH:mm:ss'), format(endTime, 'HH:mm:ss')];
    };
    
    for (const practicalClass of input.practicalClasses) {
        if (!practicalClass.date || !practicalClass.time) continue;

        const timeParts = parseTime(practicalClass.time);
        if (!timeParts) {
            errors.push(`Invalid time format for class on ${practicalClass.date}: ${practicalClass.time}`);
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
                errors.push(`Failed to create event for class on ${practicalClass.date}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            errors.push(`Exception creating event for ${practicalClass.date}: ${errorMessage}`);
        }
    }

    return { eventsCreated, errors };
  }
);
