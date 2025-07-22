"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, X } from "lucide-react"
import { de } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps {
  startDate?: Date
  endDate?: Date
  onDateRangeChange?: (startDate: Date | undefined, endDate: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
}

export function DateRangePicker({ 
  startDate, 
  endDate, 
  onDateRangeChange, 
  placeholder = "Zeitraum auswählen...",
  disabled = false 
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const handleDateSelect = (date: Date | undefined) => {
    if (!startDate || (startDate && endDate)) {
      // Erste Auswahl oder neue Auswahl
      onDateRangeChange?.(date, undefined)
    } else {
      // Zweite Auswahl
      if (date && date < startDate) {
        onDateRangeChange?.(date, startDate)
      } else {
        onDateRangeChange?.(startDate, date)
      }
      setIsOpen(false)
    }
  }

  const clearDates = () => {
    onDateRangeChange?.(undefined, undefined)
  }

  const formatDateRange = () => {
    if (startDate && endDate) {
      return `${format(startDate, "dd.MM.yyyy", { locale: de })} - ${format(endDate, "dd.MM.yyyy", { locale: de })}`
    } else if (startDate) {
      return `Ab ${format(startDate, "dd.MM.yyyy", { locale: de })}`
    }
    return placeholder
  }

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "justify-start text-left font-normal min-w-[200px]",
              !startDate && !endDate && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatDateRange()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={startDate}
            onSelect={handleDateSelect}
            initialFocus
            locale={de}
            disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
          />
        </PopoverContent>
      </Popover>
      
      {(startDate || endDate) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearDates}
          className="h-8 w-8 p-0"
          disabled={disabled}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
} 