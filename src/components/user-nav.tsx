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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCurrentRole } from '@/hooks/use-current-role';
import { Skeleton } from './ui/skeleton';
import { useUser, useFirebase } from './firebase-provider';

export function UserNav() {
  const { user, isUserLoading } = useUser();
  const { role: currentUser } = useCurrentRole();
  const { logout } = useFirebase();
  const router = useRouter();


  const handleLogout = async () => {
    await logout();
    router.push('/');
  }

  const getInitials = (role: string | null): string => {
    if (!role) return '';
    const words = role.split(' ');
    return words.map(word => word[0]).join('').toUpperCase();
  };

  if (isUserLoading) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  // Si no hay usuario o rol cargado, no mostramos el menú de usuario.
  // Esto elimina cualquier botón de "Login" que pudiera aparecer aquí.
  if (!user || !currentUser) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {currentUser ? getInitials(currentUser) : <User />}
              </AvatarFallback>
            </Avatar>
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