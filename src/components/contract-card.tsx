import type { Contract, Deadline } from '@/lib/types';
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
import { formatDistanceToNow, isPast } from 'date-fns';
import { CalendarClock } from 'lucide-react';
import { es } from 'date-fns/locale';

function toDate(date: any): Date {
  if (date instanceof Date) {
    return date;
  }
  if (date && date.toDate) {
    return date.toDate();
  }
  return new Date();
}


function getNextDeadline(contract: Contract): {
  deadline: Deadline | null;
  distance: string;
  isOverdue: boolean;
} {
  const deadlines = (contract.deadlines as Deadline[] || []).map(d => ({...d, date: toDate(d.date)}));

  const upcomingDeadlines = deadlines
    .filter((d) => !isPast(d.date))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (upcomingDeadlines.length > 0) {
    const next = upcomingDeadlines[0];
    return {
      deadline: next,
      distance: formatDistanceToNow(next.date, { addSuffix: true, locale: es }),
      isOverdue: false,
    };
  }

  const pastDeadlines = deadlines
    .filter((d) => isPast(d.date))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
    
  if(pastDeadlines.length > 0) {
    const last = pastDeadlines[0];
     return {
      deadline: last,
      distance: formatDistanceToNow(last.date, { addSuffix: true, locale: es }),
      isOverdue: true,
    };
  }

  return { deadline: null, distance: 'Sin vencimientos', isOverdue: false };
}

export function ContractCard({ contract }: { contract: Contract }) {
  const { deadline, distance, isOverdue } = getNextDeadline(contract);

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

  const isUrgent = !isOverdue && deadline && (deadline.date.getTime() - new Date().getTime()) < 7 * 24 * 60 * 60 * 1000;
  
  return (
    <Card className={cn(
      "flex flex-col transition-all duration-300 hover:shadow-lg hover:-translate-y-1 h-full",
      isUrgent && "border-primary ring-2 ring-primary/50",
      isOverdue && contract.status !== 'completed' && "border-destructive/50"
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
        <p className="text-sm text-muted-foreground line-clamp-2">{contract.content}</p>
      </CardContent>
      <CardFooter>
        <div className={cn(
            "flex items-center gap-2 text-sm",
            isOverdue && contract.status !== 'completed' ? "text-destructive" : "text-muted-foreground",
            isUrgent && "text-primary font-semibold"
        )}>
          <CalendarClock className="h-4 w-4" />
          <p>
            {deadline ? `${deadline.description}: ${distance}` : 'Sin vencimientos'}
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}
