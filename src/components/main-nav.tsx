'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GanttChartSquare, FileText, Users, ClipboardPenLine, RefreshCw, HandCoins, Gauge, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentRole } from '@/hooks/use-current-role';

const allLinks = [
  {
    href: '/dashboard',
    label: 'Panel de Control',
    icon: GanttChartSquare,
    roles: ['Administrador', 'Ventas', 'Ventas Externas'],
  },
  {
    href: '/contracts',
    label: 'Todos los Contratos',
    icon: FileText,
    roles: ['Administrador'],
  },
  {
    href: '/clients',
    label: 'Clientes',
    icon: Users,
    roles: ['Administrador'],
  },
   {
    href: '/reports',
    label: 'Reportes',
    icon: ClipboardPenLine,
    roles: ['Administrador', 'Ventas', 'Ventas Externas'],
  },
  {
    href: '/updates',
    label: 'Actualizaciones',
    icon: RefreshCw,
    roles: ['Administrador', 'Ventas', 'Ventas Externas'],
  },
  {
    href: '/cancellations',
    label: 'Gestionar Saldos',
    icon: HandCoins,
    roles: ['Administrador', 'Ventas', 'Ventas Externas'],
  },
  {
    href: '/mileage-log',
    label: 'Kilometraje',
    icon: Gauge,
    roles: ['Administrador', 'Ventas', 'Ventas Externas'],
  },
  {
    href: '/maintenance',
    label: 'Mantenimiento',
    icon: Wrench,
    roles: ['Administrador'],
  },
];

export function MainNav({ className, isMobile = false }: { className?: string, isMobile?: boolean }) {
  const pathname = usePathname();
  const { role } = useCurrentRole();

  if (!role) return null;

  const links = allLinks.filter(link => link.roles.includes(role));

  const navClass = isMobile
    ? "grid items-start gap-4"
    : "flex items-center gap-4 lg:gap-5";

  const linkClass = isMobile
    ? "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
    : "text-muted-foreground transition-colors hover:text-foreground";


  return (
    <nav className={cn(navClass, className)}>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(linkClass, (pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))) && (isMobile ? 'bg-muted text-primary' : 'text-foreground font-semibold'))}
        >
          {isMobile && <link.icon className="h-4 w-4" />}
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
