'use client';

import { useState, useEffect } from 'react';

interface AccordionWrapperProps {
    children: React.ReactNode;
}

export function AccordionWrapper({ children }: AccordionWrapperProps) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return null; // O un esqueleto/placeholder si lo prefieres
    }

    return <>{children}</>;
}
