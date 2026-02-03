'use server';

import { google } from 'googleapis';

interface CalendarEventArgs {
    summary: string;
    description: string;
    start: { dateTime: string; timeZone: string; };
    end: { dateTime: string; timeZone: string; };
    attendees?: { email: string }[];
    vehicle: string;
}

// Map vehicle names to their calendar ID environment variables
const calendarIdMap: { [key: string]: string | undefined } = {
    'Picanto Blanco': process.env.PICANTO_BLANCO_CALENDAR_ID,
    'Picanto Bronce': process.env.PICANTO_BRONCE_CALENDAR_ID,
    'Spark': process.env.SPARK_CALENDAR_ID,
    'Moto Roja': process.env.MOTO_ROJA_CALENDAR_ID,
    'Moto Negra': process.env.MOTO_NEGRA_CALENDAR_ID,
};

/**
 * Syncs an event to the corresponding Google Calendar based on the vehicle.
 * @param event - The event data to be synced.
 */
export async function syncCalendarEvent(event: CalendarEventArgs) {
  const calendarId = calendarIdMap[event.vehicle];

  if (!calendarId) {
    console.error(`Google Calendar ID for vehicle "${event.vehicle}" not found in environment variables.`);
    return { error: `Calendar ID for ${event.vehicle} not configured.` };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const authClient = await auth.getClient();
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    const calendarEvent = {
        summary: event.summary,
        description: event.description,
        start: event.start,
        end: event.end,
    };

    const res = await calendar.events.insert({
      calendarId: calendarId,
      requestBody: calendarEvent,
    });

    console.log('--- GOOGLE CALENDAR SYNC SUCCESS ---');
    console.log(`Event created for ${event.vehicle}: ${res.data.htmlLink}`);
    
    return {
      id: res.data.id,
      htmlLink: res.data.htmlLink,
    };

  } catch (error: any) {
      console.error('--- GOOGLE CALENDAR SYNC ERROR ---');
      console.error(`Failed to create event for ${event.vehicle} in calendar ${calendarId}.`);
      console.error(error);
      return {
          error: `Error syncing with Google Calendar: ${error.message}`
      };
  }
}
