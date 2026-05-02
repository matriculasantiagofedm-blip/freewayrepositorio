'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { useCurrentRole } from '@/hooks/use-current-role';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Separator } from './ui/separator';

const navLinks = [
  { href: '/dashboard', label: 'Panel de Control', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
  { href: '/clients', label: 'Clientes', roles: ['Administrador'] },
  { href: '/leads', label: 'CRM / Mensajes', roles: ['Administrador', 'Ventas', 'Ventas Externas', 'SuperAdmin', 'Owner', 'Dueño'] },
  {
    label: 'Caja y Operaciones',
    roles: ['Administrador', 'Ventas', 'Ventas Externas'],
    children: [
        { href: '/cancellations', label: 'Gestionar Saldos', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
        { href: '/updates', label: 'Actualizaciones', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
        { href: '/book-sales', label: 'Venta de Libros', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
        { separator: true, roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
        { href: '/exams', label: 'Exámenes Teóricos', roles: ['Administrador', 'Ventas Externas'] },
        { href: '/logs', label: 'Bitácoras de Control', roles: ['Administrador', 'Ventas Externas'] },
        { href: '/surveys', label: 'Encuestas', roles: ['Administrador', 'Ventas Externas'] },
        { href: '/att-evaluations', label: 'Evaluaciones ATTT', roles: ['Administrador', 'Ventas Externas'] },
        { href: '/certificates', label: 'Impresión Certificados', roles: ['Administrador'] }
    ]
  },
  {
    label: 'Vehículos',
    roles: ['Administrador', 'Ventas', 'Ventas Externas'],
    children: [
        { href: '/mileage-log', label: 'Kilometraje', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
        { href: '/maintenance', label: 'Mantenimiento', roles: ['Administrador'] }
    ]
  },
  {
    label: 'Informes',
    roles: ['Administrador', 'Ventas', 'Ventas Externas'],
    children: [
      { href: '/informes', label: 'Centro de Informes', roles: ['Administrador', 'Ventas', 'Ventas Externas', 'SuperAdmin', 'Owner', 'Dueño'] },
      { separator: true, roles: ['Administrador', 'Ventas', 'Ventas Externas', 'SuperAdmin', 'Owner', 'Dueño'] },
      { href: '/informes/packages', label: 'Catálogo de Planes', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
      { href: '/informes/vehicle-schedule', label: 'Agenda Práctica Semanal', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
      { href: '/informes/theoretical-schedule', label: 'Agenda Teórica Semanal', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
      { href: '/informes/practical-starts', label: 'Inicios Prácticos', roles: ['Administrador', 'Ventas'] },
      { href: '/informes/quality-monitoring', label: 'Control de Calidad', roles: ['Administrador', 'SuperAdmin', 'Owner', 'Dueño', 'Ventas Externas'] },
      { href: '/informes/cancellation-payments', label: 'Reporte Abonos', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
      { href: '/informes/update-payments', label: 'Reporte Actualización', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
      { href: '/informes/certificates-summary', label: 'Control Certificados', roles: ['Administrador'] },
      { separator: true, roles: ['Administrador'] },
      { href: '/contracts', label: 'Archivo de Contratos', roles: ['Administrador'] }
    ]
  },
  {
    label: 'Contabilidad',
    roles: ['Administrador', 'SuperAdmin', 'Owner', 'Dueño', 'Ventas', 'Ventas Externas'],
    children: [
      { href: '/contabilidad', label: 'Dashboard Gastos', roles: ['Administrador', 'SuperAdmin', 'Owner', 'Dueño'] },
      { href: '/contabilidad/nuevo', label: 'Registrar Gasto (IA)', roles: ['Administrador', 'SuperAdmin', 'Owner', 'Dueño', 'Ventas', 'Ventas Externas'] },
      { separator: true, roles: ['Administrador', 'SuperAdmin', 'Owner', 'Dueño', 'Ventas'] },
      { href: '/informes/financial-statements', label: 'Estados Financieros', roles: ['Administrador', 'SuperAdmin', 'Owner', 'Dueño', 'Ventas', 'Ventas Externas'] },
      { href: '/informes/general-ledger', label: 'Mayor General', roles: ['Administrador', 'SuperAdmin', 'Owner', 'Dueño', 'Ventas', 'Ventas Externas'] },
      { href: '/informes/providers-ledger', label: 'Mayor de Proveedores', roles: ['Administrador', 'SuperAdmin', 'Owner', 'Dueño', 'Ventas', 'Ventas Externas'] },
      { href: '/informes/daily-cash', label: 'Cierre de Caja Diario', roles: ['Administrador', 'SuperAdmin', 'Owner', 'Dueño', 'Ventas', 'Ventas Externas'] }
    ]
  },
];

function HoverDropdownMenu({ link, visibleChildren, pathname, linkClass }: any) {
  const [open, setOpen] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOpen = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(true);
  };

  const handleClose = () => {
    timerRef.current = setTimeout(() => setOpen(false), 100);
  };

  const isChildActive = visibleChildren.some((child: any) => child.href && pathname.startsWith(child.href!));

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={cn(linkClass, isChildActive && 'text-foreground font-semibold')} onMouseEnter={handleOpen} onMouseLeave={handleClose}>
          {link.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onMouseEnter={handleOpen} onMouseLeave={handleClose}>
        {visibleChildren.map((child: any, index: number) => {
          if (child.separator) return <DropdownMenuSeparator key={`sep-${index}`} />;
          return (
            <DropdownMenuItem key={child.href} asChild>
                <Link href={child.href!} className={cn('cursor-pointer', pathname.startsWith(child.href!) && 'font-semibold text-primary')}>
                {child.label}
                </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MainNav({ className, isMobile = false }: { className?: string, isMobile?: boolean }) {
  const pathname = usePathname();
  const { role } = useCurrentRole();

  if (!role) return null;

  const links = navLinks.filter(link => link.roles.some(r => r.toLowerCase() === role.toLowerCase()));

  const navClass = isMobile ? "grid items-start gap-2" : "flex items-center gap-4 lg:gap-5";
  const linkClass = isMobile ? "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:text-primary" : "text-muted-foreground hover:text-foreground text-sm font-medium flex items-center";
  const activeLinkClass = isMobile ? 'bg-muted text-primary' : 'text-foreground font-semibold';

  return (
    <nav className={cn(navClass, className)}>
      {links.map((link) => {
        if (link.children) {
            const visibleChildren = link.children.filter(child => child.roles.some((r: string) => r.toLowerCase() === role.toLowerCase()));
            if (visibleChildren.length === 0) return null;
            if (isMobile) {
              const isChildActive = visibleChildren.some(child => child.href && pathname.startsWith(child.href!));
              return (
                <React.Fragment key={link.label}>
                   <span className={cn(linkClass, 'font-semibold', isChildActive ? 'text-primary' : 'text-foreground' )}>{link.label}</span>
                  <div className="grid auto-rows-auto items-start pl-7 text-base">
                    {visibleChildren.map((child, index) => {
                      if (child.separator) return <Separator key={`sep-mobile-${index}`} className="my-2" />;
                      return <Link key={child.href} href={child.href!} className={cn("rounded-lg py-2 text-muted-foreground hover:text-primary flex items-center", child.href && pathname.startsWith(child.href!) && 'text-primary font-semibold')}>{child.label}</Link>
                    })}
                  </div>
                </React.Fragment>
              )
            }
            return <HoverDropdownMenu key={link.label} link={link} visibleChildren={visibleChildren} pathname={pathname} linkClass={linkClass} />;
        }
        return <Link key={link.href} href={link.href!} className={cn(linkClass, (pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href!))) && activeLinkClass)}>{link.label}</Link>;
      })}
    </nav>
  );
}
