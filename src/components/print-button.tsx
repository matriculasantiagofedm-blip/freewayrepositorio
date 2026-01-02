'use client';

import { Button } from './ui/button';
import { Printer } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

export function PrintButton({ text = 'Imprimir' }: { text?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const handlePrint = () => {
    // Add a print parameter to the URL to trigger printing effect
    const printUrl = `${pathname}?print=true`;
    router.push(printUrl, { scroll: false });
  };

  return (
    <Button onClick={handlePrint}>
      <Printer className="mr-2 h-4 w-4" />
      {text}
    </Button>
  );
}
