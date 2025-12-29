
import { config } from 'dotenv';
config();

import '@/ai/flows/contract-summary-quick-review.ts';
import '@/ai/flows/automated-deadline-reminders.ts';
import '@/ai/flows/sync-google-calendar.ts';
import '@/ai/flows/create-contract.ts';
