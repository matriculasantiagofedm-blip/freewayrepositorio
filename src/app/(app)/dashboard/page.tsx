'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, FileText, CalendarClock, Users, Car, Bike, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isPast } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Contract, Deadline } from '@/lib/types';

function toDate(date: any): Date {
  if (date instanceof Date) {
    return date;
  }
  if (date && date.toDate) {
    return date.toDate();
  }
  return new Date();
}

export default function DashboardPage() {
  const { firestore, user } = useFirebase();

  const contractsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, `clients/${user.uid}/contracts`));
  }, [firestore, user]);

  const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);

  const activeContracts = contracts?.filter((c) => c.status === 'active').length || 0;
  const upcomingDeadlines =
    contracts
      ?.flatMap((c) => c.deadlines as Deadline[])
      .filter((d) => d && d.date && !isPast(toDate(d.date))).length || 0;
  
  const totalClients = contracts ? new Set(contracts.map((c) => c.clientId)).size : 0;

  const stats = [
    {
      title: 'Contratos Activos',
      value: isLoading ? '...' : activeContracts,
      icon: FileText,
    },
    {
      title: 'Próximos Vencimientos',
      value: isLoading ? '...' : upcomingDeadlines,
      icon: CalendarClock,
    },
    {
      title: 'Clientes Totales',
      value: isLoading ? '...' : totalClients,
      icon: Users,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold">Panel de Control</h1>
        <Button asChild>
          <Link href="/contracts/new">
            <PlusCircle />
            Nuevo Contrato
          </Link>
        </Button>
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
        <h2 className="mb-4 font-headline text-2xl font-semibold">
          Tipos de Contratos
        </h2>
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
           <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1" className="border rounded-lg">
                <AccordionTrigger className="h-24 text-lg px-6 hover:no-underline [&[data-state=open]>svg]:rotate-90">
                    <div className="flex items-center">
                        <Car className="mr-4 h-8 w-8" />
                        Curso Auto
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <div className="flex flex-col gap-2 px-4 pb-4">
                        <Button asChild variant="ghost" className="justify-start">
                           <Link href="/contracts/auto/basico"><ChevronRight className="mr-2 h-4 w-4" />Curso Básico</Link>
                        </Button>
                        <Button asChild variant="ghost" className="justify-start">
                           <Link href="/contracts/auto/plus"><ChevronRight className="mr-2 h-4 w-4" />Curso Plus</Link>
                        </Button>
                        <Button asChild variant="ghost" className="justify-start">
                           <Link href="/contracts/auto/premium"><ChevronRight className="mr-2 h-4 w-4" />Curso Premium</Link>
                        </Button>
                        <Button asChild variant="ghost" className="justify-start">
                           <Link href="/contracts/auto/deluxe"><ChevronRight className="mr-2 h-4 w-4" />Curso Deluxe</Link>
                        </Button>
                    </div>
                </AccordionContent>
            </AccordionItem>
           </Accordion>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1" className="border rounded-lg">
                  <AccordionTrigger className="h-24 text-lg px-6 hover:no-underline [&[data-state=open]>svg]:rotate-90">
                      <div className="flex items-center">
                          <Bike className="mr-4 h-8 w-8" />
                          Curso Moto
                      </div>
                  </AccordionTrigger>
                  <AccordionContent>
                      <div className="flex flex-col gap-2 px-4 pb-4">
                          <Button asChild variant="ghost" className="justify-start">
                            <Link href="/contracts/moto/basico"><ChevronRight className="mr-2 h-4 w-4" />Curso Básico</Link>
                          </Button>
                          <Button asChild variant="ghost" className="justify-start">
                            <Link href="/contracts/moto/plus"><ChevronRight className="mr-2 h-4 w-4" />Curso Plus</Link>
                          </Button>
                          <Button asChild variant="ghost" className="justify-start">
                            <Link href="/contracts/moto/premium"><ChevronRight className="mr-2 h-4 w-4" />Curso Premium</Link>
                          </Button>
                      </div>
                  </AccordionContent>
              </AccordionItem>
            </Accordion>
        </div>
      </div>
    </div>
  );
}
