
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
import { useDb, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { CHANNELS } from '@/lib/chat-config';
import { toDate } from '@/lib/utils';

const navLinks = [
  {
    href: '/dashboard',
    label: 'Panel de Control',
    roles: ['Administrador', 'Ventas', 'Ventas Externas'],
  },
  {
    href: '/chat',
    label: 'Mensajería',
    roles: ['Administrador', 'Ventas', 'Ventas Externas'],
    showBadge: true,
  },
  {
    href: '/clients',
    label: 'Clientes',
    roles: ['Administrador', 'Ventas', 'Ventas Externas'],
  },
  {
    label: 'Operaciones',
    roles: ['Administrador', 'Ventas', 'Ventas Externas'],
    children: [
        {
            href: '/logs',
            label: 'Bitácoras de Control',
            roles: ['Administrador', 'Ventas Externas'],
        },
        {
            href: '/surveys',
            label: 'Encuestas de Satisfacción',
            roles: ['Administrador', 'Ventas Externas'],
        },
        {
            href: '/certificates',
            label: 'Certificados (Impresión)',
            roles: ['Administrador'],
        },
        {
            href: '/updates',
            label: 'Actualizaciones',
            roles: ['Administrador', 'Ventas', 'Ventas Externas'],
        },
        {
            href: '/cancellations',
            label: 'Gestionar Saldos',
            roles: ['Administrador', 'Ventas', 'Ventas Externas'],
        },
        {
            separator: true,
            roles: ['Administrador', 'Ventas', 'Ventas Externas'],
        },
        {
            href: '/book-sales',
            label: 'Venta de Libros',
            roles: ['Administrador', 'Ventas', 'Ventas Externas'],
        }
    ]
  },
  {
    label: 'Vehículos',
    roles: ['Administrador', 'Ventas', 'Ventas Externas'],
    children: [
        {
            href: '/mileage-log',
            label: 'Kilometraje',
            roles: ['Administrador', 'Ventas', 'Ventas Externas'],
        },
        {
            href: '/maintenance',
            label: 'Mantenimiento',
            roles: ['Administrador'],
        }
    ]
  },
  {
    label: 'Reportes',
    roles: ['Administrador', 'Ventas', 'Ventas Externas'],
    children: [
      {
          href: '/reports/vehicle-schedule',
          label: 'Agenda Práctica',
          roles: ['Administrador', 'Ventas', 'Ventas Externas'],
      },
      {
          href: '/reports/theory-schedule',
          label: 'Agenda Teórica',
          roles: ['Administrador', 'Ventas', 'Ventas Externas'],
      },
      {
          href: '/reports/certificates-summary',
          label: 'Consolidado Certificados',
          roles: ['Administrador'],
      },
      {
          href: '/contracts',
          label: 'Todos los Contratos',
          roles: ['Administrador'],
      },
      {
          separator: true,
          roles: ['Administrador', 'Ventas', 'Ventas Externas'],
      },
      {
          href: '/reports/cancellation-payments',
          label: 'Cancelaciones',
          roles: ['Administrador', 'Ventas', 'Ventas Externas'],
      },
      {
          href: '/reports/update-payments',
          label: 'Actualizaciones',
          roles: ['Administrador', 'Ventas', 'Ventas Externas'],
      },
      {
          separator: true,
          roles: ['Administrador', 'Ventas', 'Ventas Externas'],
      },
      {
          href: '/reports/daily-cash',
          label: 'Caja Diario',
          roles: ['Administrador', 'Ventas', 'Ventas Externas'],
      },
      {
          href: '/reports/finance',
          label: 'Financiero',
          roles: ['Administrador'],
      },
       {
          separator: true,
          roles: ['Administrador', 'Ventas', 'Ventas Externas'],
      },
      {
          href: '/reports/mileage-log',
          label: 'Kilometraje',
          roles: ['Administrador', 'Ventas', 'Ventas Externas'],
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
    }, 100); 
  };

  const isChildActive = visibleChildren.some((child: any) => child.href && pathname.startsWith(child.href!));

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
        {visibleChildren.map((child: any, index: number) => {
          if (child.separator) {
            return <DropdownMenuSeparator key={`sep-${index}`} />;
          }
          return (
            <DropdownMenuItem key={child.href} asChild>
                <Link
                href={child.href!}
                className={cn('cursor-pointer', pathname.startsWith(child.href!) && 'font-semibold text-primary')}
                >
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
  const db = useDb();
  const { user } = useUser();
  const pathname = usePathname();
  const { role } = useCurrentRole();
  const [hasRecentActivity, setHasRecentActivity] = React.useState(false);

  // Monitor de actividad reciente en los canales permitidos
  React.useEffect(() => {
    if (!db || !role || !user) return;

    const allowedChannels = CHANNELS.filter(c => c.roles.includes(role));
    const unsubs: (() => void)[] = [];

    allowedChannels.forEach(channel => {
      const q = query(collection(db, 'chatChannels', channel.id, 'messages'), orderBy('createdAt', 'desc'), limit(1));
      const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const lastMsg = snap.docs[0].data();
          const lastMsgTime = toDate(lastMsg.createdAt).getTime();
          // Si el mensaje tiene menos de 10 minutos y no es mío, marcar actividad
          if (Date.now() - lastMsgTime < 600000 && lastMsg.senderId !== user.uid) {
            setHasRecentActivity(true);
          }
        }
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach(un => un());
  }, [db, role, user]);

  // Si entramos al chat, limpiar el indicador
  React.useEffect(() => {
    if (pathname === '/chat') {
      setHasRecentActivity(false);
    }
  }, [pathname]);

  if (!role) return null;

  const links = navLinks.filter(link => link.roles.includes(role));

  const navClass = isMobile
    ? "grid items-start gap-2"
    : "flex items-center gap-4 lg:gap-5";

  const linkClass = isMobile
    ? "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
    : "text-muted-foreground transition-colors hover:text-foreground text-sm font-medium flex items-center";

  const activeLinkClass = isMobile ? 'bg-muted text-primary' : 'text-foreground font-semibold';

  return (
    <nav className={cn(navClass, className)}>
      {links.map((link) => {
        if (link.children) {
            const visibleChildren = link.children.filter(child => child.roles.includes(role));
            if (visibleChildren.length === 0) return null;

            if (isMobile) {
              const isChildActive = visibleChildren.some(child => child.href && pathname.startsWith(child.href!));
              return (
                <React.Fragment key={link.label}>
                   <span className={cn(linkClass, 'font-semibold', isChildActive ? 'text-primary' : 'text-foreground' )}>
                      {link.label}
                  </span>
                  <div className="grid auto-rows-auto items-start pl-7 text-base">
                    {visibleChildren.map((child, index) => {
                      if (child.separator) {
                        return <Separator key={`sep-mobile-${index}`} className="my-2" />;
                      }
                      return (
                       <Link
                        key={child.href}
                        href={child.href!}
                        className={cn("rounded-lg py-2 text-muted-foreground transition-all hover:text-primary flex items-center", child.href && pathname.startsWith(child.href!) && 'text-primary font-semibold')}
                      >
                        {child.label}
                      </Link>
                    )})}
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
              className={cn(linkClass, (pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href!))) && activeLinkClass, "relative")}
            >
              {link.label}
              {link.showBadge && hasRecentActivity && (
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-600 rounded-full animate-pulse shadow-sm" />
              )}
            </Link>
        );
      })}
    </nav>
  );
}
