'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase';

const roleMapping: { [key: string]: string } = {
    'admin@contracttime.app': 'Administrador',
    'ventas@contracttime.app': 'Ventas',
    'ventas-externas@contracttime.app': 'Ventas Externas'
};

export function useCurrentRole() {
  const { user, isUserLoading } = useUser();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (isUserLoading) {
      setRole(null);
      return;
    }
    
    if (user && user.email && !user.isAnonymous) {
      const userRole = roleMapping[user.email] || null;
      setRole(userRole);
    } else {
      setRole(null);
    }
  }, [user, isUserLoading]);

  return { role };
}
