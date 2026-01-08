'use client';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarInset,
  SidebarTrigger,
  SidebarRail,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { GanttChartSquare } from 'lucide-react';
import Link from 'next/link';
import { UserNav } from '@/components/user-nav';
import { MainNav } from '@/components/main-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {

  return (
      <SidebarProvider>
        <Sidebar className="print-hide">
          <SidebarRail />
          <SidebarHeader>
            <Link
              href="/dashboard"
              className="mb-2 flex items-center gap-2 overflow-hidden text-lg font-semibold"
            >
              <GanttChartSquare className="h-6 w-6 shrink-0 text-primary" />
              <span className="font-headline">ContractTime</span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <MainNav />
          </SidebarContent>
          <SidebarFooter>
             <UserNav />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:pt-4 print-hide">
            <SidebarTrigger className="sm:hidden" />
            <div className="flex-1" />
            {/* UserNav moved to sidebar footer */}
          </header>
          <main className="flex-1 p-4 sm:px-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
  );
}
