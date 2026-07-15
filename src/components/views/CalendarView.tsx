
import React, { useEffect, useRef, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, parseISO, isSameMonth, startOfDay, startOfWeek, endOfWeek, isAfter, isValid } from 'date-fns';
import { CalendarEvent, User, THEME_CONFIG, ThemeColor } from '../../types';
import ConfirmDialog from '../ui/ConfirmDialog';

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
}

function parseEventDate(value?: string) {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function defaultCalendarDate(events: CalendarEvent[]) {
  const today = startOfDay(new Date());
  const nextEvent = [...events]
    .map((event) => parseEventDate(event.date))
    .filter((date): date is Date => Boolean(date))
    .filter((date) => isSameDay(date, today) || isAfter(date, today))
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return nextEvent || today;
}

function escapeCalendarText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}

function formatCalendarDate(value: string) {
  const parsed = parseEventDate(value);
  return parsed?.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z') || '';
}

function downloadEventCalendar(event: CalendarEvent) {
  const startsAt = formatCalendarDate(event.date);
  const endsAt = formatCalendarDate(event.endDate);
  if (!startsAt || !endsAt) return;

  const calendarBody = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Jerboa Circle//Private Register//KO',
    'BEGIN:VEVENT',
    `UID:${event.id}@jerboa-circle`,
    `DTSTAMP:${formatCalendarDate(new Date().toISOString())}`,
    `DTSTART:${startsAt}`,
    `DTEND:${endsAt}`,
    `SUMMARY:${escapeCalendarText(event.title)}`,
    `DESCRIPTION:${escapeCalendarText([event.description, event.detailedDescription].filter(Boolean).join('\n\n'))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const url = URL.createObjectURL(new Blob([calendarBody], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${event.title.replace(/[^a-z0-9가-힣]+/gi, '-').replace(/^-+|-+$/g, '') || 'jerboa-event'}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

export const CalendarView: React.FC<CalendarViewProps> = ({ 
  events, user, users, isAdmin, onJoinEvent, onCancelEvent, onAddEvent, onEditEvent, onDeleteEvent, onCopyEvent, onPasteEvent, onClearClipboard, copiedEventTitle
}) => {
  const initialDate = defaultCalendarDate(events);
  const [currentMonth, setCurrentMonth] = useState(initialDate);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [expandedEvents, setExpandedEvents] = useState<Record<string, 'summary' | 'detail'>>({});
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState<CalendarEvent | null>(null);
  const hasAlignedInitialDate = useRef(false);

  const handleEventClick = (eventId: string) => {
    setExpandedEvents(prev => {
      const currentState = prev[eventId];
      if (!currentState || currentState === 'summary') return { ...prev, [eventId]: 'detail' };
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
  };

  const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
  });

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => {
      const eventDate = parseEventDate(event.date);
      return eventDate ? isSameDay(eventDate, date) : false;
    });
  };

  const selectedEvents = getEventsForDate(selectedDate);
  const undatedEvents = events.filter((event) => !parseEventDate(event.date));
  const nextAvailableDate = [...events]
    .map((event) => parseEventDate(event.date))
    .filter((date): date is Date => Boolean(date))
    .filter((date) => !isSameDay(date, selectedDate))
    .sort((a, b) => {
      const today = startOfDay(new Date()).getTime();
      const aFuture = a.getTime() >= today;
      const bFuture = b.getTime() >= today;
      if (aFuture !== bFuture) return aFuture ? -1 : 1;
      return a.getTime() - b.getTime();
    })[0];

  useEffect(() => {
    if (hasAlignedInitialDate.current || events.length === 0) return;

    const nextDate = defaultCalendarDate(events);
    setCurrentMonth(nextDate);
    setSelectedDate(nextDate);
    hasAlignedInitialDate.current = true;
  }, [events]);

  const isEnrolled = (eventId: string) => {
    if (user === 'admin' || !user) return false;
    return user.enrolledEventIds.includes(eventId);
  };

  return (
    <div className="archive-calendar-view flex flex-col h-full bg-stone-50">
      <div className="archive-calendar-toolbar p-4 bg-white border-b border-stone-100 flex items-center justify-between sticky top-0 z-10">
        <div className="archive-calendar-period flex items-center gap-2">
          <button aria-label="이전 달" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="archive-calendar-nav p-1 hover:bg-stone-50 rounded-full text-stone-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h2 className="archive-calendar-month text-xl font-black text-stone-800">
            {format(currentMonth, 'yyyy MM')} 장부
          </h2>
          <button aria-label="다음 달" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="archive-calendar-nav p-1 hover:bg-stone-50 rounded-full text-stone-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      <div className="archive-calendar-scroll">
        <div className="archive-calendar-grid grid grid-cols-7 gap-px bg-stone-100 border-b border-stone-100">
          {weekLabels.map((d, i) => (
            <div key={d} className={`archive-weekday bg-white py-3 text-center text-[10px] font-black ${i === 6 ? 'is-sunday' : i === 5 ? 'is-saturday' : ''}`} lang="en">{d}</div>
          ))}
          {days.map(day => {
            const dateEvents = getEventsForDate(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);

            return (
              <button
                type="button"
                key={day.toString()}
                onClick={() => setSelectedDate(day)}
                aria-label={`${format(day, 'yyyy-MM-dd')} 프로그램 ${dateEvents.length}개`}
                aria-pressed={isSameDay(day, selectedDate)}
                className={`archive-calendar-day bg-white min-h-[70px] p-1.5 cursor-pointer transition-colors relative text-left ${!isCurrentMonth ? 'opacity-30' : ''} ${isSameDay(day, selectedDate) ? 'is-selected' : ''}`}
              >
                <div className="flex flex-col h-full justify-between">
                  <div className="flex justify-between items-start">
                    <span className="calendar-date-mark text-[11px] font-black w-6 h-6 flex items-center justify-center transition-colors">
                      {format(day, 'd')}
                    </span>
                  </div>
                  {dateEvents.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-1">
                      {dateEvents.slice(0, 4).map(e => (
                        <div key={e.id} className={`archive-event-dot w-1.5 h-1.5 rounded-full ${THEME_CONFIG[e.theme].bg} ring-1 ring-white shadow-sm`} />
                      ))}
                      {dateEvents.length > 4 && <div className="text-[8px] font-bold text-stone-300">+{dateEvents.length - 4}</div>}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="archive-calendar-detail flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-stone-800">
            <span lang="ko">{format(selectedDate, 'MM dd')} 프로그램</span>
          </h3>
          {isAdmin && (
            <div className="flex gap-2">
              {copiedEventTitle && (
                <button
                  onClick={() => onPasteEvent?.(selectedDate)}
                  className="text-[10px] bg-amber-50 text-amber-600 px-3 py-1 rounded-full font-bold border border-amber-100 animate-pulse"
                >
                  <span>복사한 프로그램 배치 / {copiedEventTitle}</span>
                </button>
              )}
              <button
                onClick={() => onAddEvent?.(selectedDate)}
                className="text-[10px] bg-stone-900 text-white px-3 py-1 rounded-full font-bold shadow-lg active:scale-95 transition-transform"
              >
                <span>+ 프로그램 추가</span>
              </button>
            </div>
          )}
        </div>

        {selectedEvents.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <p className="text-xs font-bold text-stone-300 tracking-widest">이 날짜에는 프로그램이 없습니다.</p>
            {nextAvailableDate && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(nextAvailableDate);
                  setCurrentMonth(nextAvailableDate);
                }}
                className="mt-3 px-4 py-2 bg-stone-900 text-white text-xs font-bold rounded-xl"
              >
                <span className="archive-ko-label">{format(nextAvailableDate, 'MM dd')} 프로그램 보기</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {selectedEvents.map(event => {
              const enrolledCount = users.filter(u => u.enrolledEventIds.includes(event.id)).length;
              const enrolled = isEnrolled(event.id);
              const eventStart = parseEventDate(event.date);
              const eventEnd = parseEventDate(event.endDate);
              
              return (
                <article
                  key={event.id}
                  onClick={() => handleEventClick(event.id)}
                  onKeyDown={(keyboardEvent) => {
                    if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                      keyboardEvent.preventDefault();
                      handleEventClick(event.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={Boolean(expandedEvents[event.id])}
                  aria-label={`${event.title} 상세 ${expandedEvents[event.id] ? '닫기' : '열기'}`}
                  className={`p-5 rounded-3xl border-2 ${THEME_CONFIG[event.theme].border} ${THEME_CONFIG[event.theme].bg} text-white shadow-2xl shadow-stone-200 relative overflow-hidden group transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer`}
                >
                  <div className="relative z-10 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="text-[10px] font-black opacity-70">{event.themeName}</div>
                        <h4 className="text-xl font-black leading-none">{event.title}</h4>
                      </div>
                      <div className="text-[11px] font-black bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                        {eventStart && eventEnd ? `${format(eventStart, 'HH mm')} / ${format(eventEnd, 'HH mm')}` : '시간 미정'}
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
                          <span className="text-[9px] font-black tracking-widest opacity-50">참여 인원</span>
                          <div className="flex items-center gap-1.5">
                            <div className="flex -space-x-2">
                              {users.filter(u => u.enrolledEventIds.includes(event.id)).slice(0, 3).map(u => (
                                <div
                                  key={u.id}
                                  className="member-seal member-seal--small"
                                  style={{ '--seal-color': u.avatarColor || '#e57758' } as React.CSSProperties}
                                >
                                  {u.profileImage ? <img src={u.profileImage} alt="" /> : <span className="member-seal__initial">{u.name.slice(0, 1)}</span>}
                                </div>
                              ))}
                            </div>
                            <span className="text-xs font-black">{enrolledCount} / {event.maxParticipants || '∞'}</span>
                          </div>
                        </div>
                        <div className="w-px h-6 bg-white/10" />
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black tracking-widest opacity-50">{event.isReward ? '지급' : '필요 문장'}</span>
                          <span className="text-xs font-black">{event.cost} <span className="text-[8px] opacity-60">문장</span></span>
                        </div>
                      </div>

                      {isAdmin ? (
                        <div className="flex gap-2">
                          <button aria-label={`${event.title} 캘린더 파일 받기`} onClick={(e) => { e.stopPropagation(); downloadEventCalendar(event); }} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14M7 21h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          </button>
                          <button aria-label={`${event.title} 복사`} onClick={(e) => { e.stopPropagation(); onCopyEvent?.(event); }} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                          </button>
                          <button aria-label={`${event.title} 수정`} onClick={(e) => { e.stopPropagation(); onEditEvent?.(event); }} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button
                            aria-label={`${event.title} 삭제`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDeleteEvent(event);
                            }}
                            className="p-2 bg-white/10 hover:bg-red-500/40 rounded-xl transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            aria-label={`${event.title} 캘린더 파일 받기`}
                            onClick={(e) => { e.stopPropagation(); downloadEventCalendar(event); }}
                            className="px-3 py-2 rounded-xl text-xs font-black shadow-lg transition-all active:scale-95 bg-white/20"
                          >
                            <span>캘린더</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); enrolled ? onCancelEvent(event) : onJoinEvent(event); }}
                            className={`px-6 py-2 rounded-xl text-xs font-black shadow-lg transition-all active:scale-95 ${enrolled ? 'bg-white text-stone-900' : 'bg-stone-900 text-white'}`}
                          >
                            <span>{enrolled ? '참여 취소' : '참여하기'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                    {event.archiveRecordId && (
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-black">
                        <span className="border border-white/30 px-2 py-1 opacity-80" lang="ko">
                          {event.inheritArchiveContent ? '공개 판본 자동 반영' : '회차별 문구 유지'}
                        </span>
                        <a
                          href={`/archive/${event.archiveRecordId}/`}
                          onClick={(clickEvent) => clickEvent.stopPropagation()}
                          className="inline-flex underline underline-offset-4 opacity-80 hover:opacity-100"
                        >
                          <span lang="ko">공개 프로그램 기록과 읽기 자료 보기</span>
                        </a>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {undatedEvents.length > 0 && (
          <section className="archive-undated-events" aria-labelledby="undated-events-title">
            <div>
              <h4 id="undated-events-title" lang="ko">날짜 확인이 필요한 프로그램</h4>
              <p lang="ko">이전 장부에서 날짜를 읽을 수 없는 기록입니다. 오늘 일정에는 포함하지 않았습니다.</p>
            </div>
            <ul>
              {undatedEvents.map((event) => (
                <li key={event.id}>
                  <span lang="ko">{event.title}</span>
                  {isAdmin && <button type="button" onClick={() => onEditEvent?.(event)}><span lang="ko">날짜 수정</span></button>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <ConfirmDialog
        open={Boolean(pendingDeleteEvent)}
        title="프로그램을 삭제할까요?"
        description={pendingDeleteEvent ? `“${pendingDeleteEvent.title}” 일정과 모든 참가 신청 기록이 함께 제거됩니다.` : ''}
        confirmLabel="프로그램 삭제"
        tone="danger"
        onCancel={() => setPendingDeleteEvent(null)}
        onConfirm={() => {
          if (pendingDeleteEvent) onDeleteEvent?.(pendingDeleteEvent);
          setPendingDeleteEvent(null);
        }}
      />
    </div>
  );
};
