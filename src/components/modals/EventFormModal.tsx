
import React, { useState, useEffect } from 'react';
import { format, parseISO, addMinutes } from 'date-fns';
import { CalendarEvent, ThemeColor, THEME_CONFIG } from '../../types';

interface EventFormModalProps {
  isOpen: boolean;
  event?: CalendarEvent | null;
  initialDate?: Date;
  onSave: (event: CalendarEvent, recurrence?: any) => void;
  onClose: () => void;
  themeNames: Record<ThemeColor, string>;
}

export const EventFormModal: React.FC<EventFormModalProps> = ({ isOpen, event, initialDate, onSave, onClose, themeNames }) => {
  if (!isOpen) return null;

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
  
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'count' | 'date'>('count');
  const [recurrenceValue, setRecurrenceValue] = useState<number | string>(4);
  const [selectedDays, setSelectedDays] = useState<number[]>([new Date(date).getDay()]);

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

  const handleSave = () => {
    const startDate = parseISO(date);
    const endDate = addMinutes(startDate, duration);
    
    const newEvent: CalendarEvent = {
      id: event?.id || Math.random().toString(36).substr(2, 9),
      title,
      description,
      detailedDescription,
      theme,
      themeName,
      cost,
      isReward,
      date,
      endDate: format(endDate, "yyyy-MM-dd'T'HH:mm"),
      maxParticipants: maxParticipants || undefined,
      recurringGroupId: event?.recurringGroupId
    };

    const recurrence = isRecurring ? {
      type: recurrenceType,
      value: recurrenceValue,
      daysOfWeek: selectedDays
    } : undefined;

    onSave(newEvent, recurrence);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-6 animate-in zoom-in-95 duration-300 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-black tracking-tighter text-stone-900">{event ? '일정 수정' : '새 일정 추가'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-stone-400 tracking-widest">일정 제목</label>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)}
              className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-stone-200"
              placeholder="일정 제목을 입력하세요"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-stone-400 tracking-widest">요약 설명</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-stone-200 min-h-[60px] resize-none"
              placeholder="프로그램의 요약 설명을 입력하세요"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-stone-400 tracking-widest">상세 설명</label>
            <textarea 
              value={detailedDescription} 
              onChange={e => setDetailedDescription(e.target.value)}
              className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-stone-200 min-h-[100px] resize-none"
              placeholder="프로그램의 상세 설명을 입력하세요"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-stone-400 tracking-widest">날짜 및 시간</label>
              <input 
                type="datetime-local" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-stone-200"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-stone-400 tracking-widest">소요 시간</label>
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
            <label className="text-[10px] font-bold text-stone-400 tracking-widest">테마 선택</label>
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
              placeholder="테마 이름을 입력하세요 (예: 독서 모임)"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-stone-400 tracking-widest">참여 비용 / 보상</label>
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
                  {isReward ? '보상' : '비용'}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-stone-400 tracking-widest">최대 인원</label>
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
                <label className="text-[10px] font-bold text-stone-400 tracking-widest">반복 일정 설정</label>
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
                      onChange={e => setRecurrenceType(e.target.value as any)}
                      className="bg-white border border-stone-200 rounded-lg p-2 text-[10px] font-bold outline-none"
                    >
                      <option value="count">반복 횟수</option>
                      <option value="date">종료 날짜</option>
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

        <div className="flex gap-2 pt-4">
          <button onClick={onClose} className="flex-1 py-4 bg-stone-100 text-stone-500 text-sm font-black tracking-tighter rounded-2xl active:scale-95 transition-all">취소</button>
          <button onClick={handleSave} className="flex-1 py-4 bg-stone-900 text-white text-sm font-black tracking-tighter rounded-2xl shadow-xl active:scale-95 transition-all">저장하기</button>
        </div>
      </div>
    </div>
  );
};
