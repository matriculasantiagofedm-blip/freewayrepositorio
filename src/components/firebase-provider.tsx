'use client';

/**
 * ARCHIVO DE COMPATIBILIDAD
 * Re-exporta todo desde la ubicación oficial en @/firebase para evitar
 * múltiples instancias de FirebaseContext y errores de "useFirebase debe usarse dentro de un FirebaseProvider".
 */

export * from '@/firebase';
