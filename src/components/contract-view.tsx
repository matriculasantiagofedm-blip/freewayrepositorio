'use client';
import type { Contract } from '@/lib/types';
import { DeluxePremiumContractTemplate } from './deluxe-premium-contract';
import { PrintButton } from './print-button';

export function ContractView({ contract }: { contract: Contract }) {
  return (
    <div className="max-w-4xl mx-auto bg-background">
      <div className="flex justify-end mb-4 print:hidden">
        <PrintButton text="Imprimir Contrato" />
      </div>

      {contract.type === 'Curso Deluxe' ? (
        <DeluxePremiumContractTemplate contract={contract} />
      ) : (
        // Fallback for other contract types
        <div className="prose prose-lg max-w-none text-foreground leading-relaxed">
           {contract.folio && <p className="text-right text-sm text-muted-foreground">Folio: {contract.folio}</p>}
          <h1 className="font-headline text-4xl">{contract.title}</h1>
          <p>{contract.content}</p>
        </div>
      )}
    </div>
  );
}
