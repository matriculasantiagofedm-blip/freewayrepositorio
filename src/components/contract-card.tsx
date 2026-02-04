
import type { Contract } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function ContractCard({ contract }: { contract: Contract }) {
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
  
  return (
    <Card className={cn(
      "flex flex-col transition-all duration-300 hover:shadow-lg hover:-translate-y-1 h-full"
    )}>
      <CardHeader>
        <div className="flex items-start justify-between">
            <CardTitle className="font-headline text-lg">{contract.title}</CardTitle>
            <Badge variant="outline" className={cn("capitalize shrink-0", statusColors[contract.status])}>
                {statusTranslations[contract.status]}
            </Badge>
        </div>
        <CardDescription className="flex items-center gap-2 pt-2">
           <span>{contract.clientName}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-sm text-muted-foreground line-clamp-2">{contract.clauses || 'Sin cláusulas definidas.'}</p>
      </CardContent>
    </Card>
  );
}
