'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/components/firebase-provider';

// Este es el mapa central de roles. 
// Asocia un correo electrónico de usuario a un rol específico en la aplicación.
const roleMapping: { [key: string]: string } = {
    'ventas123': 'Ventas',
    'Ayax/2022': 'Administrador',
};

export function useCurrentRole() {
  const { user, isUserLoading } = useUser();
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isUserLoading) {
      setRole(null);
      setIsLoading(true);
      return;
    }
    
    // Si el usuario es anónimo, intentamos obtener el rol de la variable global.
    if (user && user.isAnonymous) {
      const selectedRole = (window as any).selectedRoleForAnonymousSession;
      if (selectedRole) {
        // Usamos el mapeo para obtener el rol funcional
        const functionalRole = roleMapping[selectedRole.name] || 'Ventas';
        setRole(functionalRole);
      }
    } else if (user && user.email) {
      // Si es un usuario con email, usamos el mapeo.
      const userRole = roleMapping[user.email] || null;
      setRole(userRole);
    } else {
      setRole(null);
    }
    setIsLoading(false);
  }, [user, isUserLoading]);

  return { role, isLoading };
}
