'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { GanttChartSquare, FileText, Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrentRole } from '@/hooks/use-current-role';

const allLinks = [
    {
        href: '/dashboard',
        label: 'Panel de Control',
        icon: GanttChartSquare,
        roles: ['Ventas', 'Ventas Externas', 'Administrador'],
    },
    {
        href: '/contracts',
        label: 'Contratos',
        icon: FileText,
        roles: ['Administrador'],
    },
    {
        href: '/clients',
        label: 'Clientes',
        icon: Users,
        roles: ['Ventas', 'Ventas Externas', 'Administrador'],
    },
];

export function MainNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const { role } = useCurrentRole();

  const filteredLinks = allLinks.filter(link => role && link.roles.includes(role));

  if (!role) {
      return null;
  }

  return (
    <nav className={cn('flex flex-col h-full', className)}>
      <SidebarMenu className="flex-1">
        {filteredLinks.map((link) => (
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
