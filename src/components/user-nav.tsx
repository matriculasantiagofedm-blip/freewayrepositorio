'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, ChevronsUpDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCurrentRole } from '@/hooks/use-current-role';
import { Skeleton } from './ui/skeleton';
import { useAuth, useUser } from './firebase-provider';

export function UserNav() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { role: currentUser } = useCurrentRole();
  const router = useRouter();


  const handleLogout = async () => {
    if (auth) {
        await auth.signOut();
    }
    // Limpiar el rol guardado en la sesión al cerrar sesión
    sessionStorage.removeItem('anonymousUserRole');
    (window as any).selectedRoleForAnonymousSession = undefined;

    // Forzar la redirección a la página de inicio y recargar la ventana.
    // Esto asegura que todos los estados de sesión se limpien por completo.
    window.location.href = '/';
  }

  if (isUserLoading || (user && !currentUser)) {
    return <Skeleton className="h-10 w-full" />;
  }

  if (!user) {
    return (
      <Button onClick={() => router.push('/')}>Iniciar Sesión</Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
            <div className='flex items-center gap-2'>
                 <User className="h-4 w-4" />
                 <span className="truncate">{currentUser || 'Usuario'}</span>
            </div>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {currentUser}
            </p>
             <p className="text-xs leading-none text-muted-foreground">
              {user.isAnonymous ? `ID: ${user.uid.substring(0, 10)}...` : user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
           <DropdownMenuItem asChild>
            <Link href="/profile">
              <User className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
