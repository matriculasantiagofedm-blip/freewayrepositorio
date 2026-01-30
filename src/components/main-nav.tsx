'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { GanttChartSquare, Users, ClipboardPenLine, RefreshCw, HandCoins, Gauge, Wrench, Car, BookMarked, CalendarClock, FileText, Banknote, ListChecks, Award } from 'lucide-react';
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
        },
        {
            href: '/book-sales',
            label: 'Venta de Libros',
            icon: BookMarked,
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
            href: '/vehicle-schedule',
            label: 'Asignación de Horarios',
            icon: CalendarClock,
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
        }
    ]
  },
  {
    label: 'Reportes',
    icon: ClipboardPenLine,
    roles: ['Administrador', 'Ventas', 'Ventas Externas'],
    children: [
      {
          href: '/contracts',
          label: 'Todos los Contratos',
          icon: FileText,
          roles: ['Administrador'],
      },
      {
          href: '/reports/daily-cash',
          label: 'Caja Diario',
          icon: ClipboardPenLine,
          roles: ['Administrador', 'Ventas', 'Ventas Externas'],
      },
      {
          href: '/reports/finance',
          label: 'Financiero',
          icon: Banknote,
          roles: ['Administrador'],
      },
      {
          href: '/reports/cancellation-payments',
          label: 'Cancelaciones',
          icon: ListChecks,
          roles: ['Administrador', 'Ventas', 'Ventas Externas'],
      },
      {
          href: '/reports/update-payments',
          label: 'Actualizaciones',
          icon: Award,
          roles: ['Administrador', 'Ventas', 'Ventas Externas'],
      },
      {
          href: '/reports/mileage-log',
          label: 'Kilometraje',
          icon: Gauge,
          roles: ['Administrador', 'Ventas', 'Ventas Externas'],
      },
      {
          href: '/reports/vehicle-schedule',
          label: 'Horarios',
          icon: CalendarClock,
          roles: ['Administrador'],
      },
    ]
  },
];

function HoverDropdownMenu({ link, visibleChildren, pathname, linkClass }: any) {
  const [open, setOpen] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOpen = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(true);
  };

  const handleClose = () => {
    timerRef.current = setTimeout(() => {
      setOpen(false);
    }, 100); // 100ms delay to allow moving cursor to content
  };

  const isChildActive = visibleChildren.some((child: any) => pathname.startsWith(child.href!));

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(linkClass, isChildActive && 'text-foreground font-semibold')}
          onMouseEnter={handleOpen}
          onMouseLeave={handleClose}
          aria-haspopup="true"
        >
          {link.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
      >
        {visibleChildren.map((child: any) => (
          <DropdownMenuItem key={child.href} asChild>
            <Link
              href={child.href!}
              className={cn('cursor-pointer', pathname.startsWith(child.href!) && 'font-semibold text-primary')}
            >
              {child.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


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

            if (isMobile) {
              const isChildActive = visibleChildren.some(child => pathname.startsWith(child.href!));
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
              <HoverDropdownMenu key={link.label} link={link} visibleChildren={visibleChildren} pathname={pathname} linkClass={linkClass} />
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
