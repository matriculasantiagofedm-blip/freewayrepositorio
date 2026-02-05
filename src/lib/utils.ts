import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Timestamp } from 'firebase/firestore';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convierte varios formatos de fecha a un objeto Date de JavaScript.
 */
export function toDate(date: any): Date {
  if (date === null || typeof date === 'undefined') {
    return new Date('invalid');
  }
  if (date instanceof Date) {
    return date;
  }
  if (date instanceof Timestamp) {
    return date.toDate();
  }
  if (typeof date === 'string' || typeof date === 'number') {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date('invalid');
}