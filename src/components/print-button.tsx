'use client';

import { Button } from './ui/button';
import { Printer } from 'lucide-react';

export function PrintButton({ text = 'Imprimir' }: { text?: string }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Button onClick={handlePrint}>
      <Printer className="mr-2 h-4 w-4" />
      {text}
    </Button>
  );
}
