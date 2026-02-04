
'use client';
import type { Contract, ContractType } from '@/lib/types';
import { DeluxePremiumContractTemplate } from './deluxe-premium-contract';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { AutoMotoContractTemplate } from './auto-moto-contract';
import { AmpliacionesContractTemplate } from './ampliaciones-contract';

function toDate(date: any): Date {
  if (!date) return new Date('invalid');
  if (date instanceof Date) {
    return date;
  }
  // Handle Firestore Timestamp
  if (date && typeof date.toDate === 'function') {
    return date.toDate();
  }
  // Handle ISO strings or other string formats
  if (typeof date === 'string') {
    // Attempt to parse, replacing hyphens for better cross-browser compatibility
    const parsed = new Date(date.replace(/-/g, '/'));
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  // Fallback for unexpected types
  return new Date('invalid');
}


export function ContractView({ contract, type }: { contract: Contract, type?: ContractType }) {

  const renderContractTemplate = () => {
    const contractType = type || contract.type;
    switch(contractType) {
      case 'Curso Deluxe':
        return <DeluxePremiumContractTemplate contract={contract} />;
      case 'Curso Auto':
      case 'Curso Moto':
      case 'Curso Mixto':
      case 'Curso Solo Practica':
        return <AutoMotoContractTemplate contract={contract} />;
      case 'Ampliaciones':
        return <AmpliacionesContractTemplate contract={contract} />;
      default:
        // Fallback for other contract types or when type is not available
        return (
          <Card className="print:shadow-none print:border-none">
            <CardHeader>
                <CardTitle className="font-headline text-4xl pt-8">{contract.title || 'Contrato'}</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-lg max-w-none text-foreground leading-relaxed p-6">
                <p>{contract.content || 'Contenido no disponible.'}</p>
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
    <div className="max-w-4xl mx-auto bg-background print:max-w-none print:mx-0">
      {renderContractTemplate()}
    </div>
  );
}

    