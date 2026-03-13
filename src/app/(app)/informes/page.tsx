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
  ShieldCheck,
  FileText,
  BookOpen,
  ClipboardList
} from 'lucide-react';
import { useCurrentRole } from '@/hooks/use-current-role';

export default function ReportsIndexPage() {
  const { role } = useCurrentRole();
  const isAdmin = role === 'Administrador';

  const reportCards = [
    {
      title: 'Cierre de Caja',
      description: 'Arqueo diario de ingresos por métodos de pago físicos (Efectivo, Yappy, BAC, etc).',
      href: '/informes/daily-cash',
      icon: Wallet,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      roles: ['Administrador', 'Ventas', 'Ventas Externas']
    },
    {
      title: 'Agenda Práctica Semanal',
      description: 'Agenda consolidada por vehículo y disponibilidad de turnos prácticos en formato semanal.',
      href: '/informes/vehicle-schedule',
      icon: CalendarRange,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      roles: ['Administrador', 'Ventas', 'Ventas Externas']
    },
    {
      title: 'Inicios de Clases',
      description: 'Listado semanal de estudiantes que inician su capacitación práctica por primera vez.',
      href: '/informes/practical-starts',
      icon: ClipboardList,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      roles: ['Administrador', 'Ventas Externas']
    },
    {
      title: 'Agenda Teórica Semanal',
      description: 'Listado semanal de alumnos citados para capacitación teórica presencial.',
      href: '/informes/theoretical-schedule',
      icon: BookOpen,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      roles: ['Administrador', 'Ventas', 'Ventas Externas']
    },
    {
      title: 'Reporte de Abonos',
      description: 'Detalle de pagos de saldos realizados por los estudiantes.',
      href: '/informes/cancellation-payments',
      icon: RefreshCw,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      roles: ['Administrador', 'Ventas', 'Ventas Externas']
    },
    {
      title: 'Actualizaciones',
      description: 'Ingresos por trámites de duplicados o actualizaciones de vigencia.',
      href: '/informes/update-payments',
      icon: FileText,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      roles: ['Administrador', 'Ventas', 'Ventas Externas']
    },
    {
      title: 'Control de Certificados',
      description: 'Consolidado global de folios emitidos para auditoría interna.',
      href: '/informes/certificates-summary',
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
        <h1 className="font-headline text-3xl font-bold uppercase tracking-tight text-slate-900">Centro de Informes</h1>
        <p className="text-muted-foreground font-medium">Herramientas de control y análisis de gestión.</p>
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
                  Abrir Informe <ArrowRight className="h-3 w-3" />
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
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Información Confidencial</p>
              <p className="text-sm text-slate-600 font-medium">Los informes estratégicos de la empresa están protegidos para el personal administrativo.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
