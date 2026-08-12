'use client';

/**
 * GLOBAL ERROR BOUNDARY
 * Captura cualquier error de render no manejado en producción.
 * Sin este archivo, errores de render muestran el error nativo del browser
 * ("This page couldn't load") en lugar de una pantalla de recuperación.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log al servidor para debugging
  console.error('[GlobalError]', error?.message, error?.digest);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#f8fafc',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            padding: '2rem',
            maxWidth: '420px',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              fontSize: 28,
            }}
          >
            ⚠️
          </div>
          <h1
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#0f172a',
              marginBottom: '0.5rem',
            }}
          >
            Ocurrió un error inesperado
          </h1>
          <p
            style={{
              fontSize: '0.875rem',
              color: '#64748b',
              marginBottom: '1.5rem',
              lineHeight: 1.6,
            }}
          >
            ContractTime encontró un problema al cargar la página.
            Intenta recargar — si el problema persiste, contacta soporte.
          </p>
          <button
            onClick={reset}
            style={{
              background: '#1d4ed8',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '0.65rem 1.5rem',
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: 'pointer',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
