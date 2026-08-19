import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const DEFAULT_FALLBACK_KEY = 'AIzaSyCqW5aoIkWl4Nv3ZmWbvgtIsCJ3Um9mugw';

// This is a default, shared instance of Genkit.
// It's used by the flows, which are server-side.
export const ai = genkit({
  plugins: [
    googleAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || DEFAULT_FALLBACK_KEY }),
  ],
});
