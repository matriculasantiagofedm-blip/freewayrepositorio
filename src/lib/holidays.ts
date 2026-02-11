'use client';

import { isSameDay } from 'date-fns';

export interface Holiday {
  date: Date;
  name: string;
}

/**
 * Calcula la fecha de Pascua (Domingo de Resurrección) para un año dado.
 * Algoritmo de Gauss.
 */
export function getEaster(year: number): Date {
  const f = Math.floor,
    G = year % 19,
    C = f(year / 100),
    H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
    I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
    J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
    L = I - J,
    month = 3 + f((L + 40) / 44),
    day = L + 28 - 31 * f(month / 4);

  return new Date(year, month - 1, day);
}

/**
 * Retorna la lista de feriados nacionales de Panamá para un año específico.
 */
export function getPanamaHolidays(year: number): Holiday[] {
  const fixed = [
    { month: 0, day: 1, name: 'Año Nuevo' },
    { month: 0, day: 9, name: 'Día de los Mártires' },
    { month: 4, day: 1, name: 'Día del Trabajo' },
    { month: 10, day: 3, name: 'Separación de Colombia' },
    { month: 10, day: 4, name: 'Día de los Símbolos Patrios' },
    { month: 10, day: 5, name: 'Consolidación de la Separación' },
    { month: 10, day: 10, name: 'Grito de Villa de los Santos' },
    { month: 10, day: 28, name: 'Independencia de España' },
    { month: 11, day: 8, name: 'Día de las Madres' },
    { month: 11, day: 20, name: 'Día de Duelo Nacional' },
    { month: 11, day: 25, name: 'Navidad' },
  ];

  const holidays: Holiday[] = fixed.map(h => ({
    date: new Date(year, h.month, h.day),
    name: h.name
  }));

  const easter = getEaster(year);
  
  // Viernes Santo (2 días antes de Pascua)
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  holidays.push({ date: goodFriday, name: 'Viernes Santo' });

  // Carnaval (Lunes y Martes - 48 y 47 días antes de Pascua)
  const carnavalMon = new Date(easter);
  carnavalMon.setDate(easter.getDate() - 48);
  holidays.push({ date: carnavalMon, name: 'Lunes de Carnaval' });

  const carnavalTue = new Date(easter);
  carnavalTue.setDate(easter.getDate() - 47);
  holidays.push({ date: carnavalTue, name: 'Martes de Carnaval' });

  return holidays;
}

/**
 * Verifica si una fecha dada es feriado en Panamá.
 */
export function isPanamaHoliday(date: Date): Holiday | null {
  if (!date || isNaN(date.getTime())) return null;
  const yearHolidays = getPanamaHolidays(date.getFullYear());
  return yearHolidays.find(h => isSameDay(h.date, date)) || null;
}
