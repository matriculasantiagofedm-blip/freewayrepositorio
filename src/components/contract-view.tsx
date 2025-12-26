'use client';
import type { Contract } from '@/lib/types';
import { DeluxePremiumContractTemplate } from './deluxe-premium-contract';
import { PrintButton } from './print-button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { AutoMotoContractTemplate } from './auto-moto-contract';

export function ContractView({ contract }: { contract: Contract }) {

  const renderContractTemplate = () => {
    switch(contract.type) {
      case 'Curso Deluxe':
        return <DeluxePremiumContractTemplate contract={contract} />;
      case 'Curso Auto':
      case 'Curso Moto':
      case 'Curso Mixto':
        return <AutoMotoContractTemplate contract={contract} />;
      default:
        // Fallback for other contract types like Ampliaciones
        return (
          <Card className="print:shadow-none print:border-none">
            <CardHeader>
                {contract.folio && <p className="text-right text-sm font-semibold text-destructive print:text-black">Folio: {contract.folio}</p>}
                <CardTitle className="font-headline text-4xl pt-8">{contract.title}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-lg max-w-none text-foreground leading-relaxed p-6">
                <p>{contract.content}</p>
                 {contract.type === 'Ampliaciones' && contract.ampliacionesDetails?.selectedPlans && (
                    <div className='mt-6'>
                        <h3 className='font-bold'>Planes Seleccionados</h3>
                        <ul className='list-disc pl-5'>
                            {contract.ampliacionesDetails.selectedPlans.map(plan => (
                                <li key={plan.name}>{plan.name} - B/.{plan.price.toFixed(2)}</li>
                            ))}
                        </ul>
                         <p className='font-bold mt-4'>Total: B/.{contract.ampliacionesDetails.courseValue?.toFixed(2)}</p>
                    </div>
                )}
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
