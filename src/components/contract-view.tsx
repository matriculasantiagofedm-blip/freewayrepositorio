'use client';
import type { Contract, ContractType } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { AutoMotoContractTemplate } from './auto-moto-contract';
import { AmpliacionesContractTemplate } from './ampliaciones-contract';
import { DeluxePremiumContractTemplatePreview } from './deluxe-premium-contract-preview';

export function ContractView({ contract, type }: { contract: Contract, type?: ContractType }) {

  const renderContractTemplate = () => {
    const rawType = String(
      type ||
      contract.type ||
      (contract as any).contractType ||
      contract.title ||
      ''
    ).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const planStr = String(
      contract.autoMotoDetails?.coursePlan ||
      (contract as any).details?.coursePlan ||
      (contract as any).coursePlan ||
      ''
    ).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const isSoloPractica = 
      rawType.includes('practica') ||
      planStr.includes('practica') ||
      planStr.includes('basico 8') ||
      planStr.includes('plus 10') ||
      planStr.includes('reforzamiento') ||
      (contract.autoMotoDetails as any)?.isSoloPractica === true ||
      (contract as any)?.isSoloPractica === true;

    if (rawType.includes('amplia')) {
      return <AmpliacionesContractTemplate contract={contract} />;
    }
    if (!isSoloPractica && (rawType.includes('deluxe') || rawType.includes('premium'))) {
      return <DeluxePremiumContractTemplatePreview contract={contract} />;
    }
    return <AutoMotoContractTemplate contract={contract} />;
  }

  return (
    <div className="max-w-4xl mx-auto bg-background print:max-w-none print:mx-0">
      {renderContractTemplate()}
    </div>
  );
}
