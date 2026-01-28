'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { GanttChartSquare, Users, ClipboardPenLine, RefreshCw, HandCoins, Gauge, Wrench, Car, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentRole } from '@/hooks/use-current-role';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navLinks = [
  {
    href: '/dashboard',
    label: 'Panel de Control',
    icon: GanttChartSquare,
    roles: ['Administrador', 'Ventas', 'Ventas Externas'],
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
    label: 'Pagos',
    icon: HandCoins,
    roles: ['Administrador', 'Ventas', 'Ventas Externas'],
    children: [
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
        }
    ]
  },
  {
    label: 'Vehículos',
    icon: Car,
    roles: ['Administrador', 'Ventas', 'Ventas Externas'],
    children: [
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
        }
    ]
  },
];

export function MainNav({ className, isMobile = false }: { className?: string, isMobile?: boolean }) {
  const pathname = usePathname();
  const { role } = useCurrentRole();

  if (!role) return null;

  const links = navLinks.filter(link => link.roles.includes(role));

  const navClass = isMobile
    ? "grid items-start gap-2"
    : "flex items-center gap-4 lg:gap-5";

  const linkClass = isMobile
    ? "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
    : "text-muted-foreground transition-colors hover:text-foreground text-sm font-medium";

  const activeLinkClass = isMobile ? 'bg-muted text-primary' : 'text-foreground font-semibold';

  return (
    <nav className={cn(navClass, className)}>
      {links.map((link) => {
        if (link.children) {
            const visibleChildren = link.children.filter(child => child.roles.includes(role));
            if (visibleChildren.length === 0) return null;

            const isChildActive = visibleChildren.some(child => pathname.startsWith(child.href!));

            if (isMobile) {
              return (
                <React.Fragment key={link.label}>
                   <span className={cn(linkClass, 'font-semibold', isChildActive ? 'text-primary' : 'text-foreground' )}>
                      <link.icon className="h-4 w-4" />
                      {link.label}
                  </span>
                  <div className="grid auto-rows-auto items-start pl-7 text-base">
                    {visibleChildren.map(child => (
                       <Link
                        key={child.href}
                        href={child.href!}
                        className={cn("rounded-lg py-2 text-muted-foreground transition-all hover:text-primary", pathname.startsWith(child.href!) && 'text-primary font-semibold')}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </React.Fragment>
              )
            }
            
            return (
              <DropdownMenu key={link.label}>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className={cn(linkClass, 'gap-1', isChildActive && 'text-foreground font-semibold')}>
                        {link.label}
                        <ChevronDown className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {visibleChildren.map((child) => (
                    <DropdownMenuItem key={child.href} asChild>
                      <Link href={child.href!} className={cn('cursor-pointer', pathname.startsWith(child.href!) && 'font-semibold text-primary')}>
                        {child.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
        }

        return (
            <Link
              key={link.href}
              href={link.href!}
              className={cn(linkClass, (pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href!))) && activeLinkClass)}
            >
              {isMobile && <link.icon className="h-4 w-4" />}
              {link.label}
            </Link>
        );
      })}
    </nav>
  );
}
