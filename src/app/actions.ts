
'use server';

// This file is now redundant as the action is exported directly from the flow.
// It can be removed in the future if no other server actions are added here.
// For now, we re-export to avoid breaking existing imports.

export { generateContractFolioAction } from '@/ai/flows/generate-contract-folio';
