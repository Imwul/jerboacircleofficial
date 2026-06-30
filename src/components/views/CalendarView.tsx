
import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, parseISO, isSameMonth, startOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { CalendarEvent, User, THEME_CONFIG, ThemeColor } from '../../types';

interface CalendarViewProps {
  events: CalendarEvent[];
  user: User | 'admin' | null;
  users: User[];
  isAdmin: boolean;
  onJoinEvent: (event: CalendarEvent) => void;
  onCancelEvent: (event: CalendarEvent) => void;
  onAddEvent?: (date: Date) => void;
  onEditEvent?: (event: CalendarEvent) => void;
  onDeleteEvent?: (event: CalendarEvent) => void;
  onCopyEvent?: (event: CalendarEvent) => void;
  onPasteEvent?: (date: Date) => void;
  onClearClipboard?: () => void;
  copiedEventTitle?: string;
  onLogout: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ 
  events, user, users, isAdmin, onJoinEvent, onCancelEvent, onAddEvent, onEditEvent, onDeleteEvent, onCopyEvent, onPasteEvent, onClearClipboard, copiedEventTitle, onLogout 
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [expandedEvents, setExpandedEvents] = useState<Record<string, 'summary' | 'detail'>>({});

  const handleEventClick = (eventId: string) => {
    setExpandedEvents(prev => {
      const currentState = prev[eventId];
      if (!currentState) return { ...prev, [eventId]: 'summary' };
      if (currentState === 'summary') return { ...prev, [eventId]: 'detail' };
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
  };

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end: endOfWeek(endOfMonth(currentMonth))
  });

  const getEventsForDate = (date: Date) => {
    return events.filter(e => isSameDay(parseISO(e.date), date));
  };

  const selectedEvents = getEventsForDate(selectedDate);

  const isEnrolled = (eventId: string) => {
    if (user === 'admin' || !user) return false;
    return user.enrolledEventIds.includes(eventId);
  };

  return (
    <div className="flex flex-col h-full bg-stone-50">
      <div className="p-4 bg-white border-b border-stone-100 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-stone-50 rounded-full text-stone-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h2 className="text-xl font-black text-stone-800">
            {format(currentMonth, 'yyyy.MM')} Register
          </h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-stone-50 rounded-full text-stone-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        <button onClick={onLogout} className="text-[10px] font-bold text-stone-400 hover:text-stone-600 uppercase tracking-widest">Close register</button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-stone-100 border-b border-stone-100">
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <div key={d} className={`bg-white py-3 text-center text-[10px] font-black uppercase ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-stone-400'}`}>{d}</div>
        ))}
        {days.map(day => {
          const dateEvents = getEventsForDate(day);
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());
          const isCurrentMonth = isSameMonth(day, currentMonth);
          
          return (
            <div 
              key={day.toString()} 
              onClick={() => setSelectedDate(day)}
              className={`bg-white min-h-[70px] p-1.5 cursor-pointer transition-all relative ${isSelected ? 'bg-stone-50' : 'hover:bg-stone-50/50'} ${!isCurrentMonth ? 'opacity-30' : ''}`}
            >
              <div className="flex flex-col h-full justify-between">
                <div className="flex justify-between items-start">
                  <span className={`text-[11px] font-black w-6 h-6 flex items-center justify-center rounded-full transition-colors ${isToday ? 'bg-primary-600 text-white shadow-lg shadow-primary-200' : isSelected ? 'bg-stone-900 text-white' : 'text-stone-400'}`}>
                    {format(day, 'd')}
                  </span>
                </div>
                {dateEvents.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {dateEvents.slice(0, 4).map(e => (
                      <div key={e.id} className={`w-1.5 h-1.5 rounded-full ${THEME_CONFIG[e.theme].bg} ring-1 ring-white shadow-sm`} />
                    ))}
                    {dateEvents.length > 4 && <div className="text-[8px] font-bold text-stone-300">+{dateEvents.length - 4}</div>}
                  </div>
                )}
              </div>
              {isSelected && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-stone-900" />}
            </div>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-stone-800">
            {format(selectedDate, 'MM.dd')} Gatherings
          </h3>
          {isAdmin && (
            <div className="flex gap-2">
              {copiedEventTitle && (
                <button 
                  onClick={() => onPasteEvent?.(selectedDate)}
                  className="text-[10px] bg-amber-50 text-amber-600 px-3 py-1 rounded-full font-bold border border-amber-100 animate-pulse"
                >
                  Place copy ({copiedEventTitle})
                </button>
              )}
              <button 
                onClick={() => onAddEvent?.(selectedDate)}
                className="text-[10px] bg-stone-900 text-white px-3 py-1 rounded-full font-bold shadow-lg active:scale-95 transition-transform"
              >
                + Add gathering
              </button>
            </div>
          )}
        </div>

        {selectedEvents.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <div className="text-4xl opacity-20">☁️</div>
            <p className="text-xs font-bold text-stone-300 uppercase tracking-widest">No gathering recorded</p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedEvents.map(event => {
              const enrolledCount = users.filter(u => u.enrolledEventIds.includes(event.id)).length;
              const enrolled = isEnrolled(event.id);
              
              return (
                <div 
                  key={event.id}
                  onClick={() => handleEventClick(event.id)}
                  className={`p-5 rounded-3xl border-2 ${THEME_CONFIG[event.theme].border} ${THEME_CONFIG[event.theme].bg} text-white shadow-2xl shadow-stone-200 relative overflow-hidden group transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer`}
                >
                  <div className="relative z-10 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="text-[10px] font-black uppercase opacity-70">{event.themeName}</div>
                        <h4 className="text-xl font-black leading-none">{event.title}</h4>
                      </div>
                      <div className="text-[11px] font-black bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                        {format(parseISO(event.date), 'HH:mm')} - {format(parseISO(event.endDate), 'HH:mm')}
                      </div>
                    </div>
                    
                    <p className={`text-sm font-medium opacity-80 leading-relaxed ${expandedEvents[event.id] ? '' : 'line-clamp-2'}`}>
                      {event.description}
                    </p>
                    
                    {expandedEvents[event.id] === 'detail' && event.detailedDescription && (
                      <div className="pt-2 mt-2 border-t border-white/20">
                        <p className="text-sm font-medium opacity-90 leading-relaxed whitespace-pre-wrap">
                          {event.detailedDescription}
                        </p>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black uppercase tracking-widest opacity-50">Attendance</span>
                          <div className="flex items-center gap-1.5">
                            <div className="flex -space-x-2">
                              {users.filter(u => u.enrolledEventIds.includes(event.id)).slice(0, 3).map(u => (
                                <div key={u.id} className="w-5 h-5 rounded-full border border-white/20 bg-white/10 flex items-center justify-center text-[8px] overflow-hidden text-white" style={{ backgroundColor: u.avatarColor }}>
                                  {u.profileImage ? <img src={u.profileImage} className="w-full h-full object-cover" /> : u.avatarIcon}
                                </div>
                              ))}
                            </div>
                            <span className="text-xs font-black">{enrolledCount} / {event.maxParticipants || '∞'}</span>
                          </div>
                        </div>
                        <div className="w-px h-6 bg-white/10" />
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black uppercase tracking-widest opacity-50">{event.isReward ? 'Credit' : 'Cost'}</span>
                          <span className="text-xs font-black">{event.cost} <span className="text-[8px] opacity-60">COINS</span></span>
                        </div>
                      </div>

                      {isAdmin ? (
                        <div className="flex gap-2">
                          <button onClick={(e) => { e.stopPropagation(); onCopyEvent?.(event); }} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); onEditEvent?.(event); }} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); onDeleteEvent?.(event); }} className="p-2 bg-white/10 hover:bg-red-500/40 rounded-xl transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={(e) => { e.stopPropagation(); enrolled ? onCancelEvent(event) : onJoinEvent(event); }}
                          className={`px-6 py-2 rounded-xl text-xs font-black shadow-lg transition-all active:scale-95 ${enrolled ? 'bg-white text-stone-900' : 'bg-stone-900 text-white'}`}
                        >
                          {enrolled ? 'Remove mark' : 'Mark attendance'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
