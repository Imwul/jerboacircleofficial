
import { addDays, addWeeks, format, parseISO } from 'date-fns';
import { CalendarEvent } from '../types';

export const generateRecurringEvents = (
  baseEvent: CalendarEvent,
  recurrence: { type: 'count' | 'date'; value: number | string; daysOfWeek: number[] }
): CalendarEvent[] => {
  const events: CalendarEvent[] = [];
  const startDate = parseISO(baseEvent.date);
  const endDate = baseEvent.endDate ? parseISO(baseEvent.endDate) : addWeeks(startDate, 1);
  const duration = endDate.getTime() - startDate.getTime();
  
  const recurringGroupId = Math.random().toString(36).substr(2, 9);
  
  let count = 0;
  let currentDate = startDate;
  const limit = recurrence.type === 'count' ? (recurrence.value as number) : 52; // Max 1 year if by date
  const endLimitDate = recurrence.type === 'date' ? parseISO(recurrence.value as string) : null;

  while (count < limit) {
    if (endLimitDate && currentDate > endLimitDate) break;
    
    // Check if current day of week is in selected days
    if (recurrence.daysOfWeek.includes(currentDate.getDay())) {
      const newStartDate = currentDate;
      const newEndDate = new Date(newStartDate.getTime() + duration);
      
      events.push({
        ...baseEvent,
        id: Math.random().toString(36).substr(2, 9),
        date: format(newStartDate, "yyyy-MM-dd'T'HH:mm"),
        endDate: format(newEndDate, "yyyy-MM-dd'T'HH:mm"),
        recurringGroupId
      });
      count++;
    }
    
    currentDate = addDays(currentDate, 1);
    if (count > 100) break; // Safety break
  }
  
  return events;
};
