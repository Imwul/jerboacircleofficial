
import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO, addMinutes, isBefore, isValid } from 'date-fns';
import { CalendarEvent, ThemeColor, THEME_CONFIG } from '../../types';
import { useDialogFocus } from '../../utils/useDialogFocus';

export interface EventRecurrence {
  type: 'count' | 'date';
  value: number | string;
  daysOfWeek: number[];
}

interface EventFormModalProps {
  isOpen: boolean;
  event?: CalendarEvent | null;
  initialDate?: Date;
  onSave: (event: CalendarEvent, recurrence?: EventRecurrence) => void;
  onClose: () => void;
  themeNames: Record<ThemeColor, string>;
  archiveRecords: Array<{
    id: string;
    title: string;
    edition: string;
    shortDescription: string;
    longDescription: string;
    themes: string[];
  }>;
}

export const EventFormModal: React.FC<EventFormModalProps> = ({ isOpen, event, initialDate, onSave, onClose, themeNames, archiveRecords }) => {
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [detailedDescription, setDetailedDescription] = useState(event?.detailedDescription || '');
  const [theme, setTheme] = useState<ThemeColor>(event?.theme || ThemeColor.SAGE);
  const [themeName, setThemeName] = useState(event?.themeName || themeNames[event?.theme || ThemeColor.SAGE]);
  const [cost, setCost] = useState(event?.cost || 0);
  const [isReward, setIsReward] = useState(event?.isReward || false);
  const [date, setDate] = useState(event?.date || format(initialDate || new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [duration, setDuration] = useState(() => {
    if (event && event.date && event.endDate) {
      return Math.round((new Date(event.endDate).getTime() - new Date(event.date).getTime()) / 60000);
    }
    return 60;
  });
  const [maxParticipants, setMaxParticipants] = useState(event?.maxParticipants || 0);
  const [archiveRecordId, setArchiveRecordId] = useState(event?.archiveRecordId || '');
  const [inheritArchiveContent, setInheritArchiveContent] = useState(Boolean(event?.inheritArchiveContent));
  
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'count' | 'date'>('count');
  const [recurrenceValue, setRecurrenceValue] = useState<number | string>(4);
  const [selectedDays, setSelectedDays] = useState<number[]>([new Date(date).getDay()]);
  const dialogRef = useDialogFocus<HTMLDivElement>(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      setTitle(event?.title || '');
      setDescription(event?.description || '');
      setDetailedDescription(event?.detailedDescription || '');
      setTheme(event?.theme || ThemeColor.SAGE);
      setThemeName(event?.themeName || themeNames[event?.theme || ThemeColor.SAGE]);
      setCost(event?.cost || 0);
      setIsReward(event?.isReward || false);
      setDate(event?.date || format(initialDate || new Date(), "yyyy-MM-dd'T'HH:mm"));
      
      if (event && event.date && event.endDate) {
        setDuration(Math.round((new Date(event.endDate).getTime() - new Date(event.date).getTime()) / 60000));
      } else {
        setDuration(60);
      }
      
      setMaxParticipants(event?.maxParticipants || 0);
      setArchiveRecordId(event?.archiveRecordId || '');
      setInheritArchiveContent(Boolean(event?.inheritArchiveContent));
      setIsRecurring(false);
      setRecurrenceType('count');
      setRecurrenceValue(4);
      setSelectedDays([new Date(event?.date || initialDate || new Date()).getDay()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, event, initialDate]); // Removed themeNames to prevent resetting user input if global themes sync

  const handleThemeChange = (newTheme: ThemeColor) => {
    setTheme(newTheme);
    setThemeName(themeNames[newTheme]);
  };

  const applyArchiveRecord = (recordId: string) => {
    const record = archiveRecords.find((candidate) => candidate.id === recordId);
    if (!record) return;
    setTitle(record.title);
    setDescription(record.shortDescription);
    setDetailedDescription(record.longDescription);
    setThemeName(record.themes.slice(0, 3).join(' / ') || themeNames[theme]);
  };

  const validationMessage = useMemo(() => {
    if (!title.trim()) return '프로그램 제목을 입력하세요.';
    if (inheritArchiveContent && !archiveRecordId) return '자동 반영할 공개 프로그램 기록을 선택하세요.';

    const startDate = parseISO(date);
    if (!isValid(startDate)) return '날짜와 시간을 확인하세요.';
    if (!Number.isFinite(duration) || duration <= 0) return '진행 시간을 확인하세요.';

    if (isRecurring) {
      if (selectedDays.length === 0) return '반복할 요일을 하나 이상 선택하세요.';
      if (recurrenceType === 'count' && Number(recurrenceValue) < 1) {
        return '반복 횟수는 1 이상이어야 합니다.';
      }
      if (recurrenceType === 'date') {
        const endDate = parseISO(String(recurrenceValue));
        if (!isValid(endDate)) return '반복 종료일을 선택하세요.';
        if (isBefore(endDate, startDate)) return '반복 종료일은 시작일 이후여야 합니다.';
      }
    }

    return '';
  }, [archiveRecordId, date, duration, inheritArchiveContent, isRecurring, recurrenceType, recurrenceValue, selectedDays.length, title]);

  const handleSave = () => {
    if (validationMessage) return;

    const startDate = parseISO(date);
    const endDate = addMinutes(startDate, duration);
    
    const newEvent: CalendarEvent = {
      id: event?.id || Math.random().toString(36).substr(2, 9),
      title: title.trim(),
      description,
      detailedDescription,
      theme,
      themeName,
      cost,
      isReward,
      date,
      endDate: format(endDate, "yyyy-MM-dd'T'HH:mm"),
      maxParticipants: maxParticipants || undefined,
      recurringGroupId: event?.recurringGroupId,
      archiveRecordId: archiveRecordId || undefined,
      inheritArchiveContent: archiveRecordId ? inheritArchiveContent : false,
    };

    const recurrence = isRecurring ? {
      type: recurrenceType,
      value: recurrenceType === 'count' ? Number(recurrenceValue) : recurrenceValue,
      daysOfWeek: selectedDays
    } : undefined;

    onSave(newEvent, recurrence);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="event-form-title">
      <div ref={dialogRef} className="bg-white w-full max-w-md rounded-3xl p-6 space-y-6 animate-in zoom-in-95 duration-300 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 id="event-form-title" className="text-xl font-black tracking-tighter text-stone-900">
            <span lang="en">{event ? 'Revised passage' : 'New passage'}</span> / <span lang="ko">{event ? '프로그램 수정' : '프로그램 추가'}</span>
          </h3>
          <button aria-label="프로그램 편집 닫기" onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-stone-400 tracking-widest"><span lang="en">Name</span> / <span lang="ko">프로그램 제목</span></label>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)}
              className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-stone-200"
              placeholder="여정의 제목을 입력하세요"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-stone-400 tracking-widest"><span lang="en">Public folio</span> / <span lang="ko">연결할 공개 프로그램 기록</span></label>
            <select
              value={archiveRecordId}
              onChange={(event) => {
                const nextId = event.target.value;
                setArchiveRecordId(nextId);
                if (!nextId) {
                  setInheritArchiveContent(false);
                  return;
                }
                if (!archiveRecordId || inheritArchiveContent) {
                  setInheritArchiveContent(true);
                  applyArchiveRecord(nextId);
                }
              }}
              className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-stone-200"
            >
              <option value="">연결하지 않음</option>
              {archiveRecordId && !archiveRecords.some((record) => record.id === archiveRecordId) && (
                <option value={archiveRecordId}>연결 기록을 찾을 수 없음 / {archiveRecordId}</option>
              )}
              {archiveRecords.map((record) => <option value={record.id} key={record.id}>{record.edition} / {record.title}</option>)}
            </select>
            {archiveRecordId && (
              <label className="flex items-start gap-2 border border-stone-200 bg-stone-50 p-3 text-[11px] font-bold text-stone-600">
                <input
                  type="checkbox"
                  checked={inheritArchiveContent}
                  onChange={(event) => {
                    setInheritArchiveContent(event.target.checked);
                    if (event.target.checked) applyArchiveRecord(archiveRecordId);
                  }}
                  className="mt-0.5"
                />
                <span lang="ko">공개 기록이 바뀌면 이 일정의 제목·소개·주제도 자동으로 갱신합니다.</span>
              </label>
            )}
            <p className="text-[10px] text-stone-400" lang="ko">
              {inheritArchiveContent
                ? '일시·정원·신청 조건만 이 일정에서 관리합니다. 소개 문장은 공개 판본을 따릅니다.'
                : '회차별 제목과 설명을 따로 유지합니다. 읽기 자료와 아카이브 계보만 공개 기록으로 연결합니다.'}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-stone-400 tracking-widest"><span lang="en">Marginal note</span> / <span lang="ko">짧은 설명</span></label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-stone-200 min-h-[60px] resize-none"
              placeholder="짧은 주석을 입력하세요"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-stone-400 tracking-widest"><span lang="en">Record</span> / <span lang="ko">상세 설명</span></label>
            <textarea 
              value={detailedDescription} 
              onChange={e => setDetailedDescription(e.target.value)}
              className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-stone-200 min-h-[100px] resize-none"
              placeholder="상세한 장부 기록을 입력하세요"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-stone-400 tracking-widest"><span lang="en">Hour</span> / <span lang="ko">날짜와 시간</span></label>
              <input 
                type="datetime-local" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-stone-200"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-stone-400 tracking-widest"><span lang="en">Measure</span> / <span lang="ko">진행 시간</span></label>
              <select 
                value={duration} 
                onChange={e => setDuration(parseInt(e.target.value) || 30)}
                className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-stone-200"
              >
                {duration % 30 !== 0 && (
                  <option value={duration}>
                    {Math.floor(duration / 60) > 0 ? `${Math.floor(duration / 60)}시간 ` : ''}
                    {duration % 60 > 0 ? `${duration % 60}분` : ''}
                  </option>
                )}
                {[...Array(24)].map((_, i) => {
                  const mins = (i + 1) * 30;
                  const hours = Math.floor(mins / 60);
                  const remainMins = mins % 60;
                  const label = hours > 0 
                    ? remainMins > 0 ? `${hours}시간 ${remainMins}분` : `${hours}시간`
                    : `${remainMins}분`;
                  return <option key={mins} value={mins}>{label}</option>;
                })}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-stone-400 tracking-widest"><span lang="en">Rubric</span> / <span lang="ko">분류 색과 이름</span></label>
            <div className="grid grid-cols-5 gap-2">
              {Object.keys(THEME_CONFIG).map(t => (
                <button 
                  key={t}
                  onClick={() => handleThemeChange(t as ThemeColor)}
                  className={`h-10 rounded-xl transition-all ${THEME_CONFIG[t as ThemeColor].bg} ${theme === t ? 'ring-2 ring-stone-900 ring-offset-2 scale-95 shadow-inner' : 'opacity-60 hover:opacity-100 hover:scale-105'}`}
                  title={themeNames[t as ThemeColor] || t}
                />
              ))}
            </div>
            <input 
              type="text" 
              value={themeName} 
              onChange={e => setThemeName(e.target.value)}
              className="w-full p-2 bg-stone-50 border border-stone-100 rounded-xl text-[10px] font-bold outline-none focus:ring-1 focus:ring-stone-200 mt-2"
              placeholder="분류 이름을 입력하세요 (예: 문턱)"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-stone-400 tracking-widest"><span lang="en">Mark</span> / <span lang="ko">필요 문장 또는 지급 문장</span></label>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  value={cost} 
                  onChange={e => setCost(parseInt(e.target.value) || 0)}
                  className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-stone-200"
                />
                <button 
                  onClick={() => setIsReward(!isReward)}
                  className={`px-4 rounded-xl text-[10px] font-bold tracking-widest transition-all ${isReward ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-400'}`}
                >
                  <span lang="ko">{isReward ? '지급' : '필요'}</span>
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-stone-400 tracking-widest"><span lang="en">Seats</span> / <span lang="ko">최대 참여 인원</span></label>
              <input 
                type="number" 
                value={maxParticipants} 
                onChange={e => setMaxParticipants(parseInt(e.target.value) || 0)}
                className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-stone-200"
                placeholder="0 = 무제한"
              />
            </div>
          </div>

          {!event && (
            <div className="pt-4 border-t border-stone-100 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-stone-400 tracking-widest"><span lang="en">Return</span> / <span lang="ko">반복 일정 만들기</span></label>
                <button 
                  onClick={() => setIsRecurring(!isRecurring)}
                  className={`w-10 h-5 rounded-full transition-all relative ${isRecurring ? 'bg-stone-900' : 'bg-stone-200'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isRecurring ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
              
              {isRecurring && (
                <div className="bg-stone-50 p-4 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex gap-2">
                    {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                      <button 
                        key={day}
                        onClick={() => setSelectedDays(prev => prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i])}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${selectedDays.includes(i) ? 'bg-stone-900 text-white' : 'bg-white text-stone-400'}`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-4">
                    <select 
                      value={recurrenceType} 
                      onChange={(event) => {
                        const nextType = event.target.value === 'date' ? 'date' : 'count';
                        const parsedDate = parseISO(date);
                        setRecurrenceType(nextType);
                        setRecurrenceValue(nextType === 'count' ? 4 : format(isValid(parsedDate) ? parsedDate : new Date(), 'yyyy-MM-dd'));
                      }}
                      className="bg-white border border-stone-200 rounded-lg p-2 text-[10px] font-bold outline-none"
                    >
                      <option value="count">횟수로 반복</option>
                      <option value="date">종료일로 반복</option>
                    </select>
                    {recurrenceType === 'count' ? (
                      <input 
                        type="number" 
                        value={recurrenceValue} 
                        onChange={e => setRecurrenceValue(parseInt(e.target.value) || 1)}
                        className="flex-1 bg-white border border-stone-200 rounded-lg p-2 text-[10px] font-bold outline-none"
                      />
                    ) : (
                      <input 
                        type="date" 
                        value={recurrenceValue as string} 
                        onChange={e => setRecurrenceValue(e.target.value)}
                        className="flex-1 bg-white border border-stone-200 rounded-lg p-2 text-[10px] font-bold outline-none"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {validationMessage && (
          <p className="text-xs font-bold text-red-500" role="alert" lang="ko">{validationMessage}</p>
        )}

        <div className="flex gap-2 pt-4">
          <button onClick={onClose} className="flex-1 py-4 bg-stone-100 text-stone-500 text-sm font-black tracking-tighter rounded-2xl active:scale-95 transition-all"><span lang="ko">닫기</span></button>
          <button onClick={handleSave} disabled={Boolean(validationMessage)} className="flex-1 py-4 bg-stone-900 text-white text-sm font-black tracking-tighter rounded-2xl shadow-xl active:scale-95 transition-all disabled:opacity-40"><span lang="ko">프로그램 저장</span></button>
        </div>
      </div>
    </div>
  );
};
