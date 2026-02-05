
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Timestamp } from 'firebase/firestore';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts various date formats (Date, Firebase Timestamp, ISO string, milliseconds)
 * into a JavaScript Date object. Returns a new Date object representing an
 * invalid date if the input is null, undefined, or cannot be parsed.
 * This ensures that downstream date operations do not throw errors with invalid inputs.
 *
 * @param date - The date value to convert. Can be a Date, Timestamp, string, number, null, or undefined.
 * @returns A valid Date object or a Date object whose getTime() is NaN if the input is invalid.
 */
export function toDate(date: any): Date {
  if (date === null || typeof date === 'undefined') {
    return new Date('invalid');
  }
  if (date instanceof Date) {
    return date;
  }
  // Handle Firestore Timestamp
  if (date instanceof Timestamp) {
    return date.toDate();
  }
  // Handle ISO strings or other string formats
  if (typeof date === 'string') {
    // new Date(string) is robust enough for ISO 8601 and other formats.
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
   // Handle number (milliseconds since epoch)
  if (typeof date === 'number') {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  // Fallback for unexpected types or unparseable strings
  return new Date('invalid');
}
