'use server';

/**
 * @fileOverview Generates a short summary of a contract's key terms and dates for quick review.
 *
 * - contractSummaryForQuickReview - A function that generates the contract summary.
 * - ContractSummaryForQuickReviewInput - The input type for the contractSummaryForQuickReview function.
 * - ContractSummaryForQuickReviewOutput - The return type for the contractSummaryForQuickReview function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ContractSummaryForQuickReviewInputSchema = z.object({
  contractText: z
    .string()
    .describe('The complete text of the contract to be summarized.'),
});
export type ContractSummaryForQuickReviewInput = z.infer<
  typeof ContractSummaryForQuickReviewInputSchema
>;

const ContractSummaryForQuickReviewOutputSchema = z.object({
  summary: z
    .string()
    .describe(
      'A concise summary of the contract, including key terms and dates.'
    ),
});
export type ContractSummaryForQuickReviewOutput = z.infer<
  typeof ContractSummaryForQuickReviewOutputSchema
>;

export async function contractSummaryForQuickReview(
  input: ContractSummaryForQuickReviewInput
): Promise<ContractSummaryForQuickReviewOutput> {
  return contractSummaryForQuickReviewFlow(input);
}

const prompt = ai.definePrompt({
  name: 'contractSummaryForQuickReviewPrompt',
  input: {schema: ContractSummaryForQuickReviewInputSchema},
  output: {schema: ContractSummaryForQuickReviewOutputSchema},
  prompt: `Summarize the following contract, focusing on key terms and dates:

{{{contractText}}}`,
});

const contractSummaryForQuickReviewFlow = ai.defineFlow(
  {
    name: 'contractSummaryForQuickReviewFlow',
    inputSchema: ContractSummaryForQuickReviewInputSchema,
    outputSchema: ContractSummaryForQuickReviewOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
