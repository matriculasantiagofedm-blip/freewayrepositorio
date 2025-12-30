
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
        label: 'Todos los Contratos',
        icon: FileText,
        roles: ['Administrador', 'Ventas Externas'],
    },
    {
        href: '/clients',
        label: 'Clientes',
        icon: Users,
        roles: ['Administrador', 'Ventas', 'Ventas Externas'],
    },
];

export function MainNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const { role } = useCurrentRole();

  // Filter links based on the current user's role.
  const filteredLinks = allLinks.filter(link => role && link.roles.includes(role));

  // If the user has no role or no links are available for their role, render nothing.
  // This prevents rendering an empty nav which might cause issues.
  if (!role || filteredLinks.length === 0) {
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
