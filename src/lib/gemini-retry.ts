/**
 * @fileOverview Utilidad para ejecutar funciones con reintentos automáticos y espera exponencial.
 * Específicamente diseñado para manejar límites de cuota (429) y errores de servidor (500) en la API de Gemini.
 */

export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 2000
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    // Verificamos si es un error de cuota (429), del servidor (500) o agotamiento de recursos
    const isRetryable = 
      error.status === 429 || 
      error.status === 500 || 
      error.message?.includes('429') || 
      error.message?.includes('500') ||
      error.code === 'RESOURCE_EXHAUSTED';

    if (isRetryable && maxRetries > 0) {
      console.warn(`⚠️ Límite de cuota o error de servidor detectado. Reintentando en ${delay}ms... (Intentos restantes: ${maxRetries})`);
      
      // Esperamos el tiempo definido
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Reintentamos con el doble de tiempo (Backoff Exponencial)
      return withExponentialBackoff(fn, maxRetries - 1, delay * 2);
    }

    // Si no es un error reintentable o no quedan intentos, lanzamos el error
    throw error;
  }
}
