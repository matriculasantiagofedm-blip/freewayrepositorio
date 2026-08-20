import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { getGeminiApiKey } from '@/lib/gemini-config';

// This is a default, shared instance of Genkit.
// It's used by the flows, which are server-side.
export const ai = genkit({
  plugins: [
    googleAI({ apiKey: getGeminiApiKey() }),
  ],
});
