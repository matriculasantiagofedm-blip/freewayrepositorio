'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { 
  BarChart3, 
  Wallet, 
  CalendarRange, 
  FileCheck, 
  RefreshCw,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { useCurrentRole } from '@/hooks/use-current-role';

export default function ReportsIndexPage() {
  const { role } = useCurrentRole();
  const isAdmin = role === 'Administrador';

  const reportCards = [
    {
      title: 'Reporte de Caja Diario',
      description: 'Arqueo de ingresos por métodos de pago físicos (BAC, Yappy, Efectivo).',
      href: '/reportes-nuevos-2026/daily-cash',
      icon: Wallet,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      roles: ['Administrador', 'Ventas', 'Ventas Externas']
    },
    {
      title: 'Agenda por Vehículo',
      description: 'Ocupación de la flota y disponibilidad de turnos para clases prácticas.',
      href: '/reportes-nuevos-2026/vehicle-schedule',
      icon: CalendarRange,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      roles: ['Administrador', 'Ventas', 'Ventas Externas']
    },
    {
      title: 'Reporte de Cancelaciones',
      description: 'Detalle de pagos de saldos y abonos realizados a contratos.',
      href: '/reportes-nuevos-2026/cancellation-payments',
      icon: RefreshCw,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      roles: ['Administrador', 'Ventas', 'Ventas Externas']
    },
    {
      title: 'Actualizaciones de Certificados',
      description: 'Registro de cobros por correcciones o actualizaciones de vigencia.',
      href: '/reportes-nuevos-2026/update-payments',
      icon: RefreshCw,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      roles: ['Administrador', 'Ventas', 'Ventas Externas']
    },
    {
      title: 'Consolidado de Certificados',
      description: 'Resumen global de folios emitidos por periodo.',
      href: '/reportes-nuevos-2026/certificates-summary',
      icon: FileCheck,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      roles: ['Administrador']
    },
  ];

  const visibleReports = reportCards.filter(r => r.roles.includes(role || ''));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col">
        <h1 className="font-headline text-3xl font-bold uppercase tracking-tight text-slate-900">Centro de Reportes 2026</h1>
        <p className="text-muted-foreground font-medium">Análisis y control operativo de la escuela.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleReports.map((report) => (
          <Link key={report.title} href={report.href} className="no-underline group">
            <Card className="h-full transition-all hover:shadow-lg hover:border-primary/20">
              <CardHeader className="pb-3">
                <div className={`${report.bgColor} w-12 h-12 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                  <report.icon className={`h-6 w-6 ${report.color}`} />
                </div>
                <CardTitle className="text-lg font-black uppercase tracking-tight">{report.title}</CardTitle>
                <CardDescription className="text-xs font-medium leading-relaxed">
                  {report.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-primary group-hover:translate-x-1 transition-transform">
                  Ver Reporte <ArrowRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {!isAdmin && (
        <Card className="bg-slate-50 border-dashed border-2">
          <CardContent className="p-6 flex items-center gap-4">
            <ShieldCheck className="h-8 w-8 text-slate-400" />
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Aviso de Privacidad</p>
              <p className="text-sm text-slate-600 font-medium">Algunos reportes estratégicos solo son visibles para la Administración Central.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
