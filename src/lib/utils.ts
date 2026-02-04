import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Timestamp } from 'firebase/firestore';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toDate(date: any): Date {
  if (!date) return new Date('invalid');
  if (date instanceof Date) {
    return date;
  }
  // Handle Firestore Timestamp
  if (date instanceof Timestamp) {
    return date.toDate();
  }
  // Handle ISO strings or other string formats
  if (typeof date === 'string') {
    // Attempt to parse, replacing hyphens for better cross-browser compatibility
    const parsed = new Date(date.replace(/-/g, '/'));
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
   // Handle number (milliseconds)
  if (typeof date === 'number') {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  // Fallback for unexpected types
  return new Date('invalid');
}
