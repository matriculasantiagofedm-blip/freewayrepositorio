'use server';

/**
 * @fileOverview This file defines a Genkit flow for sending automated deadline reminders to users and clients.
 *
 * The flow takes contract details, including deadlines, and sends email reminders
 * a week and a day before each deadline.
 *
 * @exports {sendAutomatedDeadlineReminders} - The main function to trigger the reminder flow.
 * @exports {AutomatedDeadlineRemindersInput} - The input type for the sendAutomatedDeadlineReminders function.
 * @exports {AutomatedDeadlineRemindersOutput} - The output type for the sendAutomatedDeadlineReminders function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AutomatedDeadlineRemindersInputSchema = z.object({
  contractId: z.string().describe('The ID of the contract.'),
  clientEmail: z.string().email().describe('The email address of the client.'),
  userEmail: z.string().email().describe('The email address of the user.'),
  deadlines: z.array(
    z.object({
      date: z.string().describe('The deadline date in ISO format (YYYY-MM-DD).'),
      description: z.string().describe('A description of the deadline.'),
    })
  ).describe('An array of deadlines for the contract.'),
});
export type AutomatedDeadlineRemindersInput = z.infer<typeof AutomatedDeadlineRemindersInputSchema>;

const AutomatedDeadlineRemindersOutputSchema = z.object({
  remindersSent: z.boolean().describe('Whether the reminders were successfully sent.'),
});
export type AutomatedDeadlineRemindersOutput = z.infer<typeof AutomatedDeadlineRemindersOutputSchema>;

export async function sendAutomatedDeadlineReminders(input: AutomatedDeadlineRemindersInput): Promise<AutomatedDeadlineRemindersOutput> {
  return automatedDeadlineRemindersFlow(input);
}

const sendReminderEmail = ai.defineTool({
  name: 'sendReminderEmail',
  description: 'Sends an email reminder to a specified recipient with a given subject and body.',
  inputSchema: z.object({
    recipient: z.string().email().describe('The email address of the recipient.'),
    subject: z.string().describe('The subject of the email.'),
    body: z.string().describe('The body of the email.'),
  }),
  outputSchema: z.boolean().describe('Indicates if the email was sent successfully.'),
}, async (input) => {
  // TODO: Replace with actual email sending logic
  console.log(`Sending email to ${input.recipient} with subject ${input.subject}`);
  console.log(`Email body: ${input.body}`);
  return true; // Placeholder return value
});


const automatedDeadlineRemindersFlow = ai.defineFlow(
  {
    name: 'automatedDeadlineRemindersFlow',
    inputSchema: AutomatedDeadlineRemindersInputSchema,
    outputSchema: AutomatedDeadlineRemindersOutputSchema,
  },
  async input => {
    const { clientEmail, userEmail, deadlines, contractId } = input;
    let remindersSent = true;

    for (const deadline of deadlines) {
      const deadlineDate = new Date(deadline.date);
      const oneWeekBefore = new Date(deadlineDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneDayBefore = new Date(deadlineDate.getTime() - 1 * 24 * 60 * 60 * 1000);

      const now = new Date();

      // Check if it's time to send the one-week reminder
      if (
        oneWeekBefore <= now &&
        new Date(now.getTime() - oneWeekBefore.getTime()).getDate() === now.getDate()
      ) {
        // Send one-week reminder
        const weekReminderSubject = `Contract ${contractId}: Deadline approaching in one week!`;
        const weekReminderBody = `This is a reminder that the deadline for ${deadline.description} is approaching in one week, on ${deadline.date}.`;

        const clientWeekResult = await sendReminderEmail({
          recipient: clientEmail,
          subject: weekReminderSubject,
          body: weekReminderBody,
        });
        const userWeekResult = await sendReminderEmail({
          recipient: userEmail,
          subject: weekReminderSubject,
          body: weekReminderBody,
        });

        remindersSent = remindersSent && clientWeekResult && userWeekResult;
      }

      // Check if it's time to send the one-day reminder
      if (
        oneDayBefore <= now &&
        new Date(now.getTime() - oneDayBefore.getTime()).getDate() === now.getDate()
      ) {
        // Send one-day reminder
        const dayReminderSubject = `Contract ${contractId}: Deadline approaching tomorrow!`;
        const dayReminderBody = `This is a reminder that the deadline for ${deadline.description} is approaching tomorrow, on ${deadline.date}.`;

        const clientDayResult = await sendReminderEmail({
          recipient: clientEmail,
          subject: dayReminderSubject,
          body: dayReminderBody,
        });
        const userDayResult = await sendReminderEmail({
          recipient: userEmail,
          subject: dayReminderSubject,
          body: dayReminderBody,
        });

        remindersSent = remindersSent && clientDayResult && userDayResult;
      }
    }

    return { remindersSent };
  }
);
