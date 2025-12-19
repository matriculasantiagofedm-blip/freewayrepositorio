'use client';
import type { Contract, Deadline } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Printer } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

function toDate(date: any): Date {
  if (date instanceof Date) {
    return date;
  }
  if (date && date.toDate) {
    return date.toDate();
  }
  return new Date();
}

export function ContractView({ contract }: { contract: Contract }) {
    const statusColors = {
        active: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700',
        draft: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700',
        completed: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700',
        expired: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
    };

    const statusTranslations: { [key: string]: string } = {
        active: 'Activo',
        draft: 'Borrador',
        completed: 'Completado',
        expired: 'Expirado',
    }

  const handlePrint = () => {
    window.print();
  };
  
  const client = 'client' in contract ? contract.client : { name: 'Unknown', avatarUrl: '' };

  return (
    <div className="max-w-4xl mx-auto bg-background">
        <div className="flex justify-end mb-4 print:hidden">
            <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Contrato
            </Button>
        </div>
      <Card className="p-8 print:shadow-none print:border-none print:p-0">
        <CardHeader className="text-center p-0 mb-8 border-b pb-8">
            <CardTitle className="font-headline text-4xl">{contract.title}</CardTitle>
            <CardDescription className="text-lg pt-2">{contract.type}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <div className="flex flex-col gap-2">
                    <h3 className="font-semibold text-muted-foreground uppercase text-sm tracking-wider">Cliente</h3>
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={client?.avatarUrl} alt={client?.name} />
                            <AvatarFallback>{client?.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold text-base">{client?.name}</p>
                            <p className="text-sm text-muted-foreground">{contract.clientEmail}</p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <h3 className="font-semibold text-muted-foreground uppercase text-sm tracking-wider">Estado</h3>
                     <Badge variant="outline" className={cn("capitalize text-base w-fit px-3 py-1", statusColors[contract.status])}>
                        {statusTranslations[contract.status]}
                    </Badge>
                </div>
                <div className="flex flex-col gap-2">
                     <h3 className="font-semibold text-muted-foreground uppercase text-sm tracking-wider">Fecha de Creación</h3>
                     <p className="text-base">{format(toDate(contract.createdAt), 'PPP', { locale: es })}</p>
                </div>
            </div>
            
            <Separator className="my-8" />

            <div>
                <h3 className="font-headline text-2xl font-semibold mb-4">Contenido del Contrato</h3>
                <div className="prose prose-lg max-w-none text-foreground leading-relaxed">
                    <p>{contract.content}</p>
                </div>
            </div>

            {contract.deadlines && contract.deadlines.length > 0 && (
                <>
                    <Separator className="my-8" />
                    <div>
                        <h3 className="font-headline text-2xl font-semibold mb-4">Vencimientos Clave</h3>
                        <ul className="space-y-4">
                        {contract.deadlines.map((deadline: Deadline, index) => (
                            <li key={index} className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                                <span className="font-medium text-base">{deadline.description}</span>
                                <span className="font-mono text-sm text-foreground bg-background/50 border rounded-md px-3 py-1">{format(toDate(deadline.date), 'PPP', { locale: es })}</span>
                            </li>
                        ))}
                        </ul>
                    </div>
                </>
            )}
        </CardContent>
        <CardFooter className="mt-12 text-center text-xs text-muted-foreground p-0 pt-8 border-t">
            <p>Este es un documento generado por ContractTime. ID del Contrato: {contract.id}</p>
        </CardFooter>
      </Card>
    </div>
  );
}
