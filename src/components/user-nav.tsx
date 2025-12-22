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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, ChevronsUpDown } from 'lucide-react';
import { useAuth, useUser, initiateAnonymousSignIn } from '@/firebase';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const roles = ['Ventas', 'Ventas Externas', 'Administrador'];

export function UserNav() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [auth, user, isUserLoading]);
  
  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser && roles.includes(storedUser)) {
        setCurrentUser(storedUser);
    } else {
        const defaultRole = roles[0];
        setCurrentUser(defaultRole);
        localStorage.setItem('currentUser', defaultRole);
    }
  }, []);

  const handleRoleChange = (role: string) => {
      setCurrentUser(role);
      localStorage.setItem('currentUser', role);
      // Dispara un evento para notificar a otros componentes del cambio de rol
      window.dispatchEvent(new Event('storage'));
  };


  if (isUserLoading || !currentUser) {
    return <div>Cargando...</div>;
  }

  if (!user) {
    return (
      <Button onClick={() => initiateAnonymousSignIn(auth)}>Iniciar Sesión</Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
            <div className='flex items-center gap-2'>
                 <User className="h-4 w-4" />
                 <span className="truncate">{currentUser}</span>
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
              {user.isAnonymous ? user.uid.slice(0,10) + '...' : user.email || 'legaleagle@example.com'}
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
        <DropdownMenuGroup>
            <DropdownMenuLabel>Seleccionar Rol</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={currentUser} onValueChange={handleRoleChange}>
                {roles.map(role => (
                    <DropdownMenuRadioItem key={role} value={role}>
                        {role}
                    </DropdownMenuRadioItem>
                ))}
            </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => auth.signOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
