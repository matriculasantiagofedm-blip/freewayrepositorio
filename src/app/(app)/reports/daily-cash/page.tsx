/**
 * RECURSO ELIMINADO
 * El reporte de caja diaria ha sido removido del sistema por solicitud del usuario.
 */
import { redirect } from 'next/navigation';

export default function DailyCashRedirect() {
    redirect('/reports');
    return null;
}
