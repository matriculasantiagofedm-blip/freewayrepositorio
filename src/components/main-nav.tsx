'use client';

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
import { useWindowManager } from '@/contexts/window-manager-context';
import Link from 'next/link';
import { db } from '@/firebase/client';
import { collection, query, where, Timestamp, onSnapshot } from 'firebase/firestore';

/** Cuenta contratos online con pago pendiente en las últimas 48 horas */
function useOnlinePendingCount() {
  const [count, setCount] = React.useState(0);
  React.useEffect(() => {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const q = query(
      collection(db, 'contracts'),
      where('isOnline', '==', true),
      where('paymentStatus', '==', 'pending'),
      where('createdAt', '>=', Timestamp.fromDate(since))
    );
    const unsub = onSnapshot(q, snap => setCount(snap.size), () => setCount(0));
    return () => unsub();
  }, []);
  return count;
}


const navLinks = [
  { href: '/dashboard', label: 'Panel de Control', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
  { href: '/contracts', label: 'Contratos', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
  { href: '/clients', label: 'Clientes', roles: ['Administrador'] },
  { href: '/informes/packages', label: 'Catálogo de Precios', roles: ['Ventas Externas'] },
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
        { href: '/certificates', label: 'Impresión Certificados', roles: ['Administrador'] },
        { href: '/certificates/delivery', label: '🎓 Entrega de Certificados', roles: ['Administrador', 'Ventas', 'Ventas Externas'] }
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
      { href: '/informes/online-contracts', label: '🌐 Contratos Online (Web)', roles: ['Administrador', 'Ventas', 'Ventas Externas', 'SuperAdmin', 'Owner', 'Dueño'] },
      { href: '/informes/vehicle-schedule', label: 'Agenda Práctica Semanal', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
      { href: '/informes/theoretical-schedule', label: 'Agenda Teórica Semanal', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
      { href: '/certificates/delivery', label: '🎓 Entrega de Certificados', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
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

// ── Dropdown menu that opens items as floating windows ─────────────────────────
function HoverDropdownMenu({ link, visibleChildren, linkClass, onlinePendingCount }: any) {
  const [open, setOpen] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const { openWindow } = useWindowManager();

  const handleOpen = () => { if (timerRef.current) clearTimeout(timerRef.current); setOpen(true); };
  const handleClose = () => { timerRef.current = setTimeout(() => setOpen(false), 100); };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(linkClass)}
          onMouseEnter={handleOpen}
          onMouseLeave={handleClose}
          onClick={() => setOpen(o => !o)}
        >
          {link.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onMouseEnter={handleOpen} onMouseLeave={handleClose}>
        {visibleChildren.map((child: any, index: number) => {
          if (child.separator) return <DropdownMenuSeparator key={`sep-${index}`} />;
          const isOnlineContracts = child.href === '/informes/online-contracts';
          return (
            <DropdownMenuItem
              key={child.href}
              className="cursor-pointer"
              onClick={() => {
                setOpen(false);
                openWindow(child.href!, child.label);
              }}
            >
              <span className="flex items-center gap-2 w-full">
                {child.label}
                {isOnlineContracts && onlinePendingCount > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1">
                    {onlinePendingCount}
                  </span>
                )}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Main navigation ────────────────────────────────────────────────────────────
export function MainNav({ 
  className, 
  isMobile = false,
  onNavigate 
}: { 
  className?: string; 
  isMobile?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { role } = useCurrentRole();
  const { openWindow } = useWindowManager();
  const onlinePendingCount = useOnlinePendingCount();

  if (!role) return null;

  const links = navLinks.filter(link => link.roles.some(r => r.toLowerCase() === role.toLowerCase()));

  const navClass = isMobile ? 'grid items-start gap-2' : 'flex items-center gap-4 lg:gap-5';
  const linkClass = isMobile
    ? 'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground hover:text-primary'
    : 'text-muted-foreground hover:text-foreground text-sm font-medium flex items-center';

  return (
    <nav className={cn(navClass, className)}>
      {links.map((link) => {
        if (link.children) {
          const visibleChildren = link.children.filter(
            child => child.roles.some((r: string) => r.toLowerCase() === role.toLowerCase())
          );
          if (visibleChildren.length === 0) return null;

          // Mobile: show items as buttons that navigate directly and close sheet
          if (isMobile) {
            return (
              <React.Fragment key={link.label}>
                <span className={cn(linkClass, 'font-bold text-slate-800 text-xs uppercase tracking-wider mt-2')}>{link.label}</span>
                <div className="grid auto-rows-auto items-start pl-3 text-sm space-y-1">
                  {visibleChildren.map((child, index) => {
                    if (child.separator) return <Separator key={`sep-mobile-${index}`} className="my-1.5" />;
                    return (
                      <Link
                        key={child.href}
                        href={child.href!}
                        onClick={onNavigate}
                        className={cn(
                          "rounded-lg px-3 py-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50/60 flex items-center justify-between text-left font-medium transition-colors",
                          pathname === child.href && "bg-blue-50 text-blue-600 font-bold"
                        )}
                      >
                        <span>{child.label}</span>
                        {child.href === '/informes/online-contracts' && onlinePendingCount > 0 && (
                          <span className="inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1">
                            {onlinePendingCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </React.Fragment>
            );
          }

          return (
            <HoverDropdownMenu
              key={link.label}
              link={link}
              visibleChildren={visibleChildren}
              pathname={pathname}
              linkClass={linkClass}
              onlinePendingCount={onlinePendingCount}
            />
          );
        }

        // Top-level links (Panel de Control, Clientes, etc.)
        return (
          <Link
            key={link.href}
            href={link.href!}
            onClick={onNavigate}
            className={cn(
              linkClass,
              (pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href!))) &&
                (isMobile ? 'bg-blue-50 text-blue-600 font-bold' : 'text-foreground font-semibold')
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
