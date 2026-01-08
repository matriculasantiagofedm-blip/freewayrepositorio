
'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FileText, CalendarClock, Users, Car, Bike, Combine, Crown, Plus, CarFront, RefreshCw, HandCoins } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { isPast } from 'date-fns';
import { collection, query, where }from 'firebase/firestore';
import type { Contract, Deadline } from '@/lib/types';
import { useCurrentRole } from '@/hooks/use-current-role';
import { cn } from '@/lib/utils';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';

function toDate(date: any): Date {
  if (!date) return new Date(0); // Return an invalid date if input is null/undefined
  if (date instanceof Date) {
    return date;
  }
  // Handle Firestore Timestamp
  if (date && typeof date.toDate === 'function') {
    return date.toDate();
  }
  // Handle ISO strings
  if (typeof date === 'string') {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  // Fallback for unexpected types
  return new Date(0);
}

const isOverdue = (contract: Contract): boolean => {
    if (contract.status !== 'active') return false;

    const hasOverdueGeneralDeadline = (contract.deadlines as Deadline[] || [])
        .some(d => d && d.date && isPast(toDate(d.date)));
    
    if (hasOverdueGeneralDeadline) return true;

    if ((contract.type === 'Curso Auto' || contract.type === 'Curso Moto') && contract.autoMotoDetails?.paymentDeadline) {
        const paymentDate = toDate(contract.autoMotoDetails.paymentDeadline);
        if (paymentDate.getTime() > 0 && isPast(paymentDate)) {
            return true;
        }
    }
    
    return false;
}


export default function DashboardPage() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();

  const contractsQuery = useMemoQuery(() => {
    if (!db || !user || !role) return null;
    
    const contractsCollection = collection(db, 'contracts');

    // Admin and Ventas can see all contracts from the root collection
    if (role === 'Administrador' || role === 'Ventas') {
        return query(contractsCollection);
    }

    // Fallback for any other user to see only their contracts
    return query(contractsCollection, where('userId', '==', user.uid));
  }, [db, user, role]);

  const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);

  const activeContracts = contracts?.filter((c) => c.status === 'active').length || 0;
  
  const overdueDeadlines = contracts?.filter(isOverdue).length || 0;
  
  const totalClients = contracts ? new Set(contracts.map((c) => c.clientId)).size : 0;

  const allStats = [
    {
      title: 'Contratos Activos',
      value: isLoading ? '...' : activeContracts,
      icon: FileText,
      href: '/contracts',
      roles: ['Administrador']
    },
    {
      title: 'Vencimientos',
      value: isLoading ? '...' : overdueDeadlines,
      icon: CalendarClock,
      href: '/contracts?filter=overdue',
      roles: ['Administrador']
    },
    {
      title: 'Clientes',
      value: isLoading ? '...' : totalClients,
      icon: Users,
      href: '/clients',
       roles: ['Administrador']
    },
  ];

  const stats = allStats.filter(stat => stat.roles.includes(role || ''));

  const contractTypes = [
      { name: 'Curso Auto', icon: Car, href: '/contracts/new?type=Curso%20Auto', bgColor: 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40', textColor: 'text-blue-600 dark:text-blue-300'},
      { name: 'Curso Moto', icon: Bike, href: '/contracts/new?type=Curso%20Moto', bgColor: 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/40', textColor: 'text-orange-600 dark:text-orange-300'},
      { name: 'Curso Mixto', icon: Combine, href: '/contracts/new?type=Curso%20Mixto', bgColor: 'bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/40', textColor: 'text-purple-600 dark:text-purple-300'},
      { name: 'Curso Deluxe', icon: Crown, href: '/contracts/new?type=Curso%20Deluxe', bgColor: 'bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/40', textColor: 'text-yellow-600 dark:text-yellow-300'},
      { name: 'Ampliaciones', icon: Plus, href: '/contracts/new?type=Ampliaciones', bgColor: 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800', textColor: 'text-slate-600 dark:text-slate-300'},
      { name: 'Curso Solo Practica', icon: CarFront, href: '/contracts/new?type=Curso%20Solo%20Practica', bgColor: 'bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/20 dark:hover:bg-teal-900/40', textColor: 'text-teal-600 dark:text-teal-300'},
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="font-headline text-3xl font-bold">Panel de Control</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
            <Link key={stat.title} href={stat.href} className="no-underline">
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                    <stat.icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    </CardContent>
                </Card>
            </Link>
        ))}
      </div>

      <div>
        <h2 className="text-2xl font-bold font-headline mb-4">Crear Nuevo Contrato</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
          {contractTypes.map((type) => (
            <Card key={type.name} className="transition-all hover:shadow-lg hover:-translate-y-1">
                <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg", type.bgColor)}>
                           <type.icon className={cn("h-6 w-6", type.textColor)} />
                        </div>
                        <span className="font-semibold">{type.name}</span>
                    </div>
                    <Button asChild size="sm">
                        <Link href={type.href}>Crear</Link>
                    </Button>
                </CardContent>
            </Card>
          ))}
        </div>
      </div>
      
      <div>
        <h2 className="text-2xl font-bold font-headline mb-4">Otras Acciones</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
            <Card className="transition-all hover:shadow-lg hover:-translate-y-1">
                <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40">
                           <RefreshCw className="h-6 w-6 text-green-600 dark:text-green-300" />
                        </div>
                        <span className="font-semibold">Actualizaciones</span>
                    </div>
                    <Button asChild size="sm">
                        <Link href="#">Actualizar</Link>
                    </Button>
                </CardContent>
            </Card>
            <Card className="transition-all hover:shadow-lg hover:-translate-y-1">
                <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40">
                           <HandCoins className="h-6 w-6 text-red-600 dark:text-red-300" />
                        </div>
                        <span className="font-semibold">Pago de Saldos Estudiantes</span>
                    </div>
                    <Button asChild size="sm" variant="destructive">
                        <Link href="/cancellations">Gestionar Saldos</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
