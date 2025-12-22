'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { GanttChartSquare, FileText, Users, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidebarSeparator } from './ui/sidebar';

const links = [
  {
    href: '/dashboard',
    label: 'Panel de Control',
    icon: GanttChartSquare,
  },
  {
    href: '/contracts',
    label: 'Contratos',
    icon: FileText,
  },
  {
    href: '/clients',
    label: 'Clientes',
    icon: Users,
  },
];

const profileLinks = [
    {
        href: '/profile',
        label: 'Perfil',
        icon: User,
    }
]

export function MainNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav className={cn('flex flex-col h-full', className)}>
      <SidebarMenu className="flex-1">
        {links.map((link) => (
          <SidebarMenuItem key={link.href}>
            <SidebarMenuButton
              asChild
              isActive={pathname.startsWith(link.href)}
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

        <SidebarSeparator />

        <SidebarMenu>
            {profileLinks.map((link) => (
            <SidebarMenuItem key={link.href}>
                <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(link.href)}
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
