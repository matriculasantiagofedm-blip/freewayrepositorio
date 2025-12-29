
'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, FileText, CalendarClock, Users, Car, Bike, Combine, Crown, Plus, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { isPast } from 'date-fns';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where }from 'firebase/firestore';
import type { Contract, Deadline } from '@/lib/types';
import { useCurrentRole } from '@/hooks/use-current-role';
import { cn } from '@/lib/utils';

function toDate(date: any): Date {
  if (date instanceof Date) {
    return date;
  }
  if (date && date.toDate) {
    return date.toDate();
  }
  if (typeof date === 'string') {
    const parsedDate = new Date(date);
    if (!isNaN(parsedDate.getTime())) {
      // Adjust for timezone issues with date-only strings
      const timezoneOffset = parsedDate.getTimezoneOffset() * 60000;
      return new Date(parsedDate.getTime() + timezoneOffset);
    }
  }
  return new Date(0); // Return an invalid date if parsing fails
}

export default function DashboardPage() {
  const { firestore, user } = useFirebase();
  const { role } = useCurrentRole();

  const contractsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !role) return null;
    
    // Admin can see all contracts from the root collection
    if (role === 'Administrador') {
        return collection(firestore, 'contracts');
    }

    // Other users see only contracts they created, filtered by their userId
    return query(collection(firestore, 'contracts'), where('userId', '==', user.uid));
  }, [firestore, user, role]);

  const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);

  const activeContracts = contracts?.filter((c) => c.status === 'active').length || 0;
  
  const overdueDeadlines =
    contracts?.reduce((acc, contract) => {
      // 1. Add overdue standard deadlines
      const generalDeadlines = (contract.deadlines as Deadline[] || [])
        .filter(d => d && d.date && isPast(toDate(d.date)));
      
      acc += generalDeadlines.length;

      // 2. Add overdue payment deadline from auto/moto contracts
      if ((contract.type === 'Curso Auto' || contract.type === 'Curso Moto') && contract.autoMotoDetails?.paymentDeadline) {
        const paymentDate = toDate(contract.autoMotoDetails.paymentDeadline);
        if (paymentDate.getTime() > 0 && isPast(paymentDate)) {
          acc += 1;
        }
      }
      
      return acc;
    }, 0) || 0;

  
  const totalClients = contracts ? new Set(contracts.map((c) => c.clientId)).size : 0;

  const stats = [
    {
      title: 'Mis Contratos Activos',
      value: isLoading ? '...' : activeContracts,
      icon: FileText,
    },
    {
      title: 'Mis Vencimientos',
      value: isLoading ? '...' : overdueDeadlines,
      icon: CalendarClock,
    },
    {
      title: 'Mis Clientes',
      value: isLoading ? '...' : totalClients,
      icon: Users,
    },
  ];

  const contractTypes = [
      { name: 'Curso Auto', icon: Car, href: '/contracts/new?type=Curso%20Auto', color: 'bg-blue-200/70 dark:bg-blue-900/50'},
      { name: 'Curso Moto', icon: Bike, href: '/contracts/new?type=Curso%20Moto', color: 'bg-orange-200/70 dark:bg-orange-900/50'},
      { name: 'Curso Mixto', icon: Combine, href: '/contracts/new?type=Curso%20Mixto', color: 'bg-purple-200/70 dark:bg-purple-900/50'},
      { name: 'Curso Deluxe', icon: Crown, href: '/contracts/new?type=Curso%20Deluxe', color: 'bg-yellow-200/70 dark:bg-yellow-900/50'},
      { name: 'Ampliaciones', icon: Plus, href: '/contracts/new?type=Ampliaciones', color: 'bg-green-200/70 dark:bg-green-900/50'},
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="font-headline text-3xl font-bold">Panel de Control</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-2xl font-bold font-headline mb-4">Crear Nuevo Contrato</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {contractTypes.map((type) => (
            <Link key={type.name} href={type.href} className="no-underline">
              <Card className="hover:shadow-lg hover:-translate-y-1 transition-all flex flex-col items-center justify-center text-center p-4 h-full">
                <CardHeader className="p-2">
                    <div className={cn("p-3 rounded-full", type.color)}>
                        <type.icon className="h-8 w-8 text-primary" />
                    </div>
                </CardHeader>
                <CardContent className="p-2">
                  <p className="font-semibold">{type.name}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
