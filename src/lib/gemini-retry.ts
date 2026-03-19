'use client';

/**
 * @fileOverview Utilidad para manejar reintentos con espera exponencial.
 * Útil para mitigar errores 429 (Rate Limit) de APIs de IA.
 */

export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 2000
): Promise<T> {
  let currentDelay = initialDelay;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      // Verificamos si es error de cuota (429) o error de servidor (500)
      const isRateLimit = error.status === 429 || error.message?.includes('429') || error.code === 'RESOURCE_EXHAUSTED';
      const isServerError = error.status === 500 || error.message?.includes('500');

      if ((isRateLimit || isServerError) && i < maxRetries) {
        console.warn(`[IA Retry] Intento ${i + 1} fallido. Reintentando en ${currentDelay}ms...`);
        
        await new Promise((resolve) => setTimeout(resolve, currentDelay));
        
        // Aumentamos el tiempo de espera exponencialmente (2s, 4s, 8s...)
        currentDelay *= 2;
        continue;
      }

      // Si no es reintentable o agotamos intentos, lanzamos el error
      throw error;
    }
  }
  throw new Error("Máximo de reintentos alcanzado en la comunicación con el modelo de IA");
}
