"use client"

import * as React from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// Feriados de Panamá (2024-2025)
const panamaHolidays: Date[] = [
  // 2024
  new Date(2024, 0, 1),   // Año Nuevo
  new Date(2024, 0, 9),   // Día de los Mártires
  new Date(2024, 1, 13),  // Martes de Carnaval
  new Date(2024, 2, 29),  // Viernes Santo
  new Date(2024, 4, 1),   // Día del Trabajo
  new Date(2024, 10, 3),  // Separación de Panamá de Colombia
  new Date(2024, 10, 5),  // Día de Colón
  new Date(2024, 10, 10), // Primer Grito de Independencia
  new Date(2024, 10, 28), // Independencia de Panamá de España
  new Date(2024, 11, 8),  // Día de la Madre
  new Date(2024, 11, 20), // Duelo Nacional
  new Date(2024, 11, 25), // Navidad

  // 2025
  new Date(2025, 0, 1),   // Año Nuevo
  new Date(2025, 0, 9),   // Día de los Mártires
  new Date(2025, 2, 4),   // Martes de Carnaval
  new Date(2025, 3, 18),  // Viernes Santo
  new Date(2025, 4, 1),   // Día del Trabajo
  new Date(2025, 10, 3),  // Separación de Panamá de Colombia
  new Date(2025, 10, 5),  // Día de Colón
  new Date(2025, 10, 10), // Primer Grito de Independencia
  new Date(2025, 10, 28), // Independencia de Panamá de España
  new Date(2025, 11, 8),  // Día de la Madre
  new Date(2025, 11, 20), // Duelo Nacional
  new Date(2025, 11, 25), // Navidad
];

interface DatePickerProps {
    date: Date | undefined;
    onDateSelect: (date: Date | undefined) => void;
    disabled?: boolean;
}

export function DatePicker({ date, onDateSelect, disabled }: DatePickerProps) {

  const isDayDisabled = (day: Date) => {
    // Deshabilitar fines de semana
    const dayOfWeek = day.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return true;
    }
    // Deshabilitar feriados
    return panamaHolidays.some(
      (holiday) => day.toDateString() === holiday.toDateString()
    );
  };


  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onDateSelect}
          initialFocus
          disabled={[
            ...panamaHolidays,
            { dayOfWeek: [0, 6] }, // Sábados y Domingos
            { before: new Date() } // Días pasados
          ]}
        />
      </PopoverContent>
    </Popover>
  )
}
