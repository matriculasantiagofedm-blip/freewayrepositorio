'use server';
/**
 * @fileoverview A tool for searching the Panamanian traffic regulations.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {reglamentoDeTransito} from '@/lib/reglamento-transito';

export const searchReglamentoTool = ai.defineTool(
  {
    name: 'searchReglamento',
    description: 'Searches the Panamanian traffic regulations for a specific topic or article. Use this to verify user answers or find topics for new questions.',
    inputSchema: z.object({
      query: z.string().describe('The search term, topic, or article number to look for. E.g., "velocidad en zona escolar" or "Artículo 95".'),
    }),
    outputSchema: z.string().describe('A snippet of the regulation text that matches the query, or a message if nothing is found.'),
  },
  async (input) => {
    const query = input.query.toLowerCase();
    
    // Simple search implementation: split by article and filter
    const articles = reglamentoDeTransito.split(/(?=Artículo \d+)/);
    
    const relevantArticles = articles.filter(article => article.toLowerCase().includes(query)).slice(0, 3); // Limit to 3 results
    
    if (relevantArticles.length > 0) {
      // Return a concatenated string of matching articles, truncated to a reasonable length.
      return relevantArticles.join('\n---\n').substring(0, 4000);
    }

    return 'No se encontró información sobre ese tema en el reglamento.';
  }
);
