
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardPenLine, ListChecks } from 'lucide-react';
import Link from 'next/link';
import { useCurrentRole } from '@/hooks/use-current-role';

export default function ReportsPage() {
  const { role } = useCurrentRole();

  const allReports = [
    {
      title: 'Reporte de Caja Diario',
      description: 'Genera el reporte de caja para el día actual.',
      href: '/reports/daily-cash',
      icon: ClipboardPenLine,
      roles: ['Administrador'],
    },
    {
      title: 'Listado de Pagos',
      description: 'Ver y filtrar todos los pagos de cancelación registrados.',
      href: '/reports/cancellation-payments',
      icon: ListChecks,
      roles: ['Administrador'],
    },
  ];

  const reports = allReports.filter(report => report.roles.includes(role || ''));

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-headline text-3xl font-bold">Reportes</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Link href={report.href} key={report.title} className="no-underline">
            <Card className="hover:shadow-lg transition-shadow h-full">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <report.icon className="h-6 w-6 text-primary" />
                  <CardTitle>{report.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{report.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
