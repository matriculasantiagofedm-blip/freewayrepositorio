'use client';
import type { Contract, Client } from '@/lib/types';
import { Button } from './ui/button';
import { Printer } from 'lucide-react';
import { DeluxePremiumContractTemplate } from './deluxe-premium-contract';

export function ContractView({ contract }: { contract: Contract }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto bg-background">
        <div className="flex justify-end mb-4 print:hidden">
            <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Contrato
            </Button>
        </div>
      
      {contract.type === 'Curso Mixto' ? (
        <DeluxePremiumContractTemplate contract={contract} />
      ) : (
        // Fallback for other contract types
        <div className="prose prose-lg max-w-none text-foreground leading-relaxed">
          <h1 className="font-headline text-4xl">{contract.title}</h1>
          <p>{contract.content}</p>
        </div>
      )}
    </div>
  );
}
