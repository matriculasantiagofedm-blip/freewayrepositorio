import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, FileText, CalendarClock, Users } from 'lucide-react';
import { contracts } from '@/lib/data';
import { ContractCard } from '@/components/contract-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isPast } from 'date-fns';
import type { Contract, ContractType } from '@/lib/types';

export default function DashboardPage() {
  const activeContracts = contracts.filter((c) => c.status === 'active').length;
  const upcomingDeadlines = contracts
    .flatMap((c) => c.deadlines)
    .filter((d) => !isPast(d.date)).length;
  const totalClients = new Set(contracts.map((c) => c.client.id)).size;

  const stats = [
    {
      title: 'Contratos Activos',
      value: activeContracts,
      icon: FileText,
    },
    {
      title: 'Próximos Vencimientos',
      value: upcomingDeadlines,
      icon: CalendarClock,
    },
    {
      title: 'Clientes Totales',
      value: totalClients,
      icon: Users,
    },
  ];
  
  const contractTypes: ContractType[] = ['Curso Auto', 'Curso Moto'];
  const contractsByType = contractTypes.map(type => ({
    type,
    contracts: contracts.filter(c => c.type === type),
  }));

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

      <div className="space-y-8">
        {contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              Aún no hay contratos
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Comienza creando un nuevo contrato.
            </p>
            <Button asChild className="mt-6">
              <Link href="/contracts/new">
                <PlusCircle />
                Crear Contrato
              </Link>
            </Button>
          </div>
        ) : (
          contractsByType.map(({ type, contracts: typedContracts }) => (
            typedContracts.length > 0 && (
              <div key={type}>
                <h2 className="mb-4 font-headline text-2xl font-semibold">
                  {type}
                </h2>
                <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {typedContracts.map((contract) => (
                    <ContractCard key={contract.id} contract={contract} />
                  ))}
                </div>
              </div>
            )
          ))
        )}
      </div>
    </div>
  );
}
