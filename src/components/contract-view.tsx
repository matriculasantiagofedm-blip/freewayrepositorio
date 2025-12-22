'use client';
import type { Contract } from '@/lib/types';
import { DeluxePremiumContractTemplate } from './deluxe-premium-contract';
import { PrintButton } from './print-button';
import { Card, CardContent, CardFooter } from './ui/card';
import { AutoMotoContractTemplate } from './auto-moto-contract';

export function ContractView({ contract }: { contract: Contract }) {

  const renderContractTemplate = () => {
    switch(contract.type) {
      case 'Curso Deluxe':
        return <DeluxePremiumContractTemplate contract={contract} />;
      case 'Curso Auto':
      case 'Curso Moto':
        return <AutoMotoContractTemplate contract={contract} />;
      default:
        // Fallback for other contract types
        return (
          <Card className="print:shadow-none print:border-none">
            <CardContent className="prose prose-lg max-w-none text-foreground leading-relaxed relative p-6">
              {contract.folio && <p className="absolute top-4 right-6 text-sm font-semibold text-destructive">Folio: {contract.folio}</p>}
              <h1 className="font-headline text-4xl pt-8">{contract.title}</h1>
              <p>{contract.content}</p>
            </CardContent>
             {contract.createdBy && (
              <CardFooter className="print:block hidden">
                  <div className="text-xs text-muted-foreground mt-8">
                  Confeccionado por: {contract.createdBy}
                  </div>
              </CardFooter>
            )}
          </Card>
        );
    }
  }

  return (
    <div className="max-w-4xl mx-auto bg-background">
      <div className="flex justify-end mb-4 print:hidden">
        <PrintButton text="Imprimir Contrato" />
      </div>
      {renderContractTemplate()}
    </div>
  );
}
