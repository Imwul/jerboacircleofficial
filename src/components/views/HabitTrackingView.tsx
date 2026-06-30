
import React, { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, subDays, isAfter, startOfDay, addDays, addHours, isBefore, differenceInDays } from 'date-fns';
import { User, HabitRecord, TIER_COLORS } from '../../types';
import { StarRating } from '../ui/StarRating';

interface HabitTrackingViewProps {
  user: User;
  onUpdateUser: (updates: Partial<User>) => void;
  onLogout: () => void;
  isAdmin?: boolean;
}

export const HabitTrackingView: React.FC<HabitTrackingViewProps> = ({ user, onUpdateUser, onLogout, isAdmin = false }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showGoalInput, setShowGoalInput] = useState(false);
  const [tempGoal, setTempGoal] = useState(user.habitGoal || '');
  const [comment, setComment] = useState('');

  const getEffectiveTodayKey = () => {
    const now = new Date();
    if (now.getHours() < 2) {
      return format(subDays(now, 1), 'yyyy-MM-dd');
    }
    return format(now, 'yyyy-MM-dd');
  };

  const todayKey = getEffectiveTodayKey();
  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const currentRecord = user.habitRecords?.[selectedDateKey] || { status: 'none' };

  useEffect(() => {
    setComment(currentRecord.comment || '');
  }, [selectedDateKey, currentRecord.comment]);

  const isEditable = (dateKey: string) => {
    if (isAdmin) return true;
    const now = new Date();
    const recordDate = parseISO(dateKey);
    // Editable until 2 AM of the day AFTER the record date
    const cutoff = addHours(startOfDay(addDays(recordDate, 1)), 2);
    return isBefore(now, cutoff);
  };

  const canEdit = isEditable(selectedDateKey);

  const weekDays = eachDayOfInterval({
    start: startOfWeek(new Date(), { weekStartsOn: 1 }),
    end: endOfWeek(new Date(), { weekStartsOn: 1 })
  });

  const checkAndAwardStreak = (records: Record<string, HabitRecord>) => {
    const sortedDates = Object.keys(records).sort();
    const updatedRecords = { ...records };
    
    // Reset all rewarded flags and streakIds first
    Object.keys(updatedRecords).forEach(date => {
      updatedRecords[date] = { ...updatedRecords[date], rewarded: false, streakId: undefined };
    });

    let streakDates: string[] = [];
    let streakCount = 0;
    let currentStreakId = 0;

    for (const date of sortedDates) {
      if (updatedRecords[date].status === 'success') {
        streakDates.push(date);
        if (streakDates.length === 3) {
          streakCount++;
          currentStreakId++;
          streakDates.forEach(d => {
            updatedRecords[d].rewarded = true;
            updatedRecords[d].streakId = currentStreakId;
          });
          streakDates = [];
        }
      } else {
        streakDates = [];
      }
    }
    return { updatedRecords, streakCount };
  };

  const handleUpdateRecord = (updates: Partial<HabitRecord>) => {
    if (!canEdit && !isAdmin) return;

    const newRecords = { ...user.habitRecords };
    const updatedRecord = { ...currentRecord, ...updates, timestamp: new Date().toISOString() };
    
    // Auto-success if photo or comment is added (and not already failed)
    if ((updates.photo || updates.comment) && updatedRecord.status === 'none') {
      updatedRecord.status = 'success';
    }

    newRecords[selectedDateKey] = updatedRecord;
    
    // Calculate old streak count
    const { streakCount: oldStreakCount } = checkAndAwardStreak(user.habitRecords || {});
    // Calculate new streak count and get updated records with rewarded flags
    const { updatedRecords, streakCount: newStreakCount } = checkAndAwardStreak(newRecords);

    const coinDiff = newStreakCount - oldStreakCount;
    const newCoins = user.coins + coinDiff;

    onUpdateUser({ ...user, habitRecords: updatedRecords, coins: newCoins });
  };

  // Auto-mark failure for past dates
  useEffect(() => {
    const now = new Date();
    const startDate = parseISO(user.tierStartDate);
    const daysSinceStart = differenceInDays(now, startDate);
    
    let hasChanges = false;
    const newRecords = { ...user.habitRecords };

    for (let i = 0; i <= daysSinceStart; i++) {
      const date = addDays(startDate, i);
      const dateKey = format(date, 'yyyy-MM-dd');
      
      // If it's past the 2 AM cutoff for this date and status is 'none'
      const cutoff = addHours(startOfDay(addDays(date, 1)), 2);
      if (isAfter(now, cutoff) && (!newRecords[dateKey] || newRecords[dateKey].status === 'none')) {
        newRecords[dateKey] = { ...(newRecords[dateKey] || {}), status: 'fail' };
        hasChanges = true;
      }
    }

    if (hasChanges) {
      const { updatedRecords } = checkAndAwardStreak(newRecords);
      onUpdateUser({ ...user, habitRecords: updatedRecords });
    }
  }, []);

  const handleSaveGoal = () => {
    onUpdateUser({ ...user, habitGoal: tempGoal });
    setShowGoalInput(false);
  };

  const isPartOfStreak = (dateKey: string) => {
    return user.habitRecords?.[dateKey]?.rewarded || false;
  };

  const getStreakId = (dateKey: string) => {
    return user.habitRecords?.[dateKey]?.streakId;
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          handleUpdateRecord({ photo: compressedBase64, mediaType: 'image' });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full bg-stone-50 overflow-y-auto pb-20">
      <div className="p-6 bg-white border-b border-stone-100 space-y-6">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h2 className="text-2xl font-black tracking-tighter text-stone-900">습관 트래킹</h2>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">익일 새벽 2시까지 인증 가능</p>
          </div>
          {!isAdmin && <button onClick={onLogout} className="text-[10px] font-bold text-stone-400 hover:text-stone-600 uppercase tracking-widest">로그아웃</button>}
        </div>

        <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">나의 목표</span>
            {(canEdit || isAdmin) && <button onClick={() => setShowGoalInput(true)} className="text-[10px] text-stone-400 hover:text-stone-600 underline underline-offset-2 font-bold">수정</button>}
          </div>
          {showGoalInput ? (
            <div className="flex gap-2">
              <input 
                type="text" 
                value={tempGoal} 
                onChange={e => setTempGoal(e.target.value)}
                className="flex-1 bg-white border border-stone-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-1 focus:ring-stone-300"
                placeholder="목표를 입력하세요"
              />
              <button onClick={handleSaveGoal} className="bg-stone-900 text-white px-4 py-2 rounded-xl text-xs font-bold">저장</button>
            </div>
          ) : (
            <p className="text-sm font-black tracking-tighter text-stone-800">{user.habitGoal || '목표가 설정되지 않았습니다'}</p>
          )}
        </div>

        <div className="flex justify-between items-center relative gap-0">
          {weekDays.map((day, idx) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const isSelected = isSameDay(day, selectedDate);
            const record = user.habitRecords?.[dateKey];
            const rewarded = isPartOfStreak(dateKey);
            const streakId = getStreakId(dateKey);
            
            // Streak pod logic
            const prevDayKey = format(subDays(day, 1), 'yyyy-MM-dd');
            const nextDayKey = format(addDays(day, 1), 'yyyy-MM-dd');
            const hasPrevInStreak = rewarded && getStreakId(prevDayKey) === streakId;
            const hasNextInStreak = rewarded && getStreakId(nextDayKey) === streakId;

            return (
              <div key={dateKey} className="relative flex flex-col items-center flex-1">
                {rewarded && (
                  <div className={`absolute top-7 h-8 bg-primary-100 -z-0 transition-all ${!hasPrevInStreak ? 'left-1 rounded-l-full' : 'left-0'} ${!hasNextInStreak ? 'right-1 rounded-r-full' : 'right-0'}`} />
                )}
                <button 
                  onClick={() => setSelectedDate(day)}
                  className={`flex flex-col items-center gap-2 p-2 rounded-xl transition-all relative z-10 w-full ${isSelected ? 'bg-stone-900 text-white scale-110 shadow-lg' : 'hover:bg-stone-50'}`}
                >
                  <span className={`text-[8px] font-bold uppercase tracking-widest ${isSelected ? 'text-white/60' : 'text-stone-400'}`}>{format(day, 'EEE')}</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black tracking-tighter relative ${isSelected ? 'bg-white/20' : rewarded ? 'bg-primary-500 text-white shadow-sm' : 'bg-stone-50 text-stone-400'}`}>
                    {format(day, 'd')}
                    {record?.status === 'success' && <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />}
                    {record?.status === 'fail' && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-6 space-y-8">
        {isAdmin && (
          <div className="space-y-4">
            <h3 className="text-sm font-black tracking-tighter text-stone-800 uppercase tracking-widest">관리자 수동 조정</h3>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => handleUpdateRecord({ status: currentRecord.status === 'success' ? 'none' : 'success' })}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${currentRecord.status === 'success' ? 'bg-green-50 border-green-500 text-green-700 shadow-inner' : 'bg-white border-stone-100 text-stone-400 hover:border-stone-200'}`}
              >
                <div className="text-2xl">✅</div>
                <span className="text-[10px] font-black tracking-tighter">성공 처리</span>
              </button>
              <button 
                onClick={() => handleUpdateRecord({ status: currentRecord.status === 'fail' ? 'none' : 'fail' })}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${currentRecord.status === 'fail' ? 'bg-red-50 border-red-500 text-red-700 shadow-inner' : 'bg-white border-stone-100 text-stone-400 hover:border-stone-200'}`}
              >
                <div className="text-2xl">❌</div>
                <span className="text-[10px] font-black tracking-tighter">실패 처리</span>
              </button>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-black tracking-tighter text-stone-800 uppercase tracking-widest">인증 사진</h3>
            <div className="aspect-square bg-stone-100 rounded-3xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center text-stone-400 hover:bg-stone-200 transition-colors cursor-pointer overflow-hidden relative group">
              {currentRecord.photo ? (
                <>
                  <img src={currentRecord.photo} alt="인증" className="w-full h-full object-cover" />
                  {(canEdit || isAdmin) && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); handleUpdateRecord({ photo: undefined }); }} className="bg-white text-red-500 px-4 py-2 rounded-xl text-xs font-bold shadow-lg">삭제하기</button>
                    </div>
                  )}
                </>
              ) : (
                <label className={`w-full h-full flex flex-col items-center justify-center ${canEdit || isAdmin ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                  <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="text-[10px] font-bold uppercase tracking-widest">사진 업로드</span>
                  {(canEdit || isAdmin) && (
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handlePhotoUpload}
                    />
                  )}
                </label>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-black tracking-tighter text-stone-800 uppercase tracking-widest">한줄 코멘트 (25자)</h3>
            <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm space-y-2">
              <textarea 
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 25))}
                disabled={!canEdit && !isAdmin}
                placeholder="오늘의 습관을 기록해보세요"
                className="w-full bg-stone-50 border border-stone-100 rounded-xl p-3 text-sm font-bold outline-none focus:ring-1 focus:ring-stone-200 h-20 resize-none disabled:opacity-50"
              />
              {(canEdit || isAdmin) && (
                <button 
                  onClick={() => handleUpdateRecord({ comment })}
                  className="w-full py-3 bg-stone-900 text-white text-xs font-bold rounded-xl shadow-lg active:scale-95 transition-all"
                >
                  코멘트 저장
                </button>
              )}
            </div>
          </div>

          {currentRecord.status === 'success' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="text-sm font-black tracking-tighter text-stone-800 uppercase tracking-widest">만족도 평가</h3>
              <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm">
                <StarRating 
                  value={currentRecord.rating || 0} 
                  onChange={(rating) => handleUpdateRecord({ rating })} 
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

