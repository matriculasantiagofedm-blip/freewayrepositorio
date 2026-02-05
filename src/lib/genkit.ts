import { gemini15Flash, googleAI } from '@genkit-ai/google-genai';
import { genkit } from 'genkit';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    }),
  ],
  model: gemini15Flash,
});