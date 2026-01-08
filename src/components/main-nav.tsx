
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { GanttChartSquare, FileText, Users, CarFront, ClipboardPenLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentRole } from '@/hooks/use-current-role';

const allLinks = [
  {
    href: '/dashboard',
    label: 'Panel de Control',
    icon: GanttChartSquare,
    roles: ['Administrador', 'Ventas'],
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
    roles: ['Administrador'],
  },
  {
    href: '/contracts/solo-practica',
    label: 'Cursos de Solo Práctica',
    icon: CarFront,
    roles: ['Administrador'],
  },
];

export function MainNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const { role } = useCurrentRole();

  if (!role) return null; // No mostrar nada si el rol no está definido

  const links = allLinks.filter(link => link.roles.includes(role));

  return (
    <nav className={cn('flex flex-col h-full', className)}>
      <SidebarMenu className="flex-1">
        {links.map((link) => (
          <SidebarMenuItem key={link.href}>
            <SidebarMenuButton
              asChild
              isActive={pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))}
              tooltip={link.label}
            >
              <Link href={link.href}>
                <link.icon />
                <span>{link.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </nav>
  );
}
