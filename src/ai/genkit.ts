import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// This is a default, shared instance of Genkit.
// It's used by the flows, which are server-side.
// The API key is loaded from environment variables for security.
export const ai = genkit({
  plugins: [
    googleAI({ apiKey: process.env.GEMINI_API_KEY }),
  ],
  // Do not configure logging or tracing here.
  // It can interfere with the production environment.
});
