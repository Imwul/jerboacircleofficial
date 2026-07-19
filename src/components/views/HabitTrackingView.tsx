
import React, { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, subDays, isAfter, startOfDay, addDays, addHours, isBefore, differenceInDays } from 'date-fns';
import { User, HabitRecord } from '../../types';
import { StarRating } from '../ui/StarRating';
import { resizeImage } from '../../utils/imageUtils';
import { deriveParticipantJourney } from '../../utils/participantJourney';
import { trackProductEvent } from '../../utils/productAnalytics';

interface HabitTrackingViewProps {
  user: User;
  onUpdateUser: (updates: Partial<User>) => void;
  isAdmin?: boolean;
}

export const HabitTrackingView: React.FC<HabitTrackingViewProps> = ({ user, onUpdateUser, isAdmin = false }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showGoalInput, setShowGoalInput] = useState(false);
  const [tempGoal, setTempGoal] = useState(user.habitGoal || '');
  const [comment, setComment] = useState('');
  const [photoStatus, setPhotoStatus] = useState('');

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

    if (updates.status || updates.photo || updates.comment || updates.rating !== undefined) {
      trackProductEvent('habit_status_update', {
        status: updatedRecord.status,
        isAdmin,
        dateRelation: selectedDateKey === todayKey ? 'today' : selectedDateKey < todayKey ? 'past' : 'future',
        hasPhoto: Boolean(updatedRecord.photo),
        hasComment: Boolean(updatedRecord.comment),
        hasRating: updatedRecord.rating !== undefined,
        participantStage: deriveParticipantJourney(user).stage,
      });
    }

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setPhotoStatus('사진을 장부에 맞게 줄이는 중');
      const compressedBase64 = await resizeImage(file, 1200, 1200);
      handleUpdateRecord({ photo: compressedBase64, mediaType: 'image' });
      setPhotoStatus('오늘의 도판 저장됨');
    } catch (error) {
      console.error('Habit photo upload failed:', error);
      setPhotoStatus('사진을 읽을 수 없음');
    } finally {
      e.currentTarget.value = '';
    }
  };

  const clearPhoto = () => {
    handleUpdateRecord({ photo: undefined, mediaType: undefined });
    setPhotoStatus('오늘의 도판 삭제됨');
  };

  return (
    <div className="flex flex-col h-full bg-stone-50 overflow-y-auto pb-20">
      <div className="p-6 bg-white border-b border-stone-100 space-y-6">
        <div className="habit-register-heading flex justify-between items-start">
          <div className="space-y-1">
            <h2 className="text-2xl font-black tracking-tighter text-stone-900">오늘의 주석</h2>
            <p className="text-[10px] font-bold text-stone-400 tracking-widest">오늘의 흔적은 다음 날 새벽 2시까지 남길 수 있습니다</p>
          </div>
        </div>

        <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-stone-400 tracking-widest">이번 장의 약속</span>
            {(canEdit || isAdmin) && <button onClick={() => setShowGoalInput(true)} className="member-text-action text-[10px] text-stone-400 hover:text-stone-600 underline underline-offset-2 font-bold">수정</button>}
          </div>
          {showGoalInput ? (
            <div className="flex gap-2">
              <input 
                type="text" 
                value={tempGoal} 
                onChange={e => setTempGoal(e.target.value)}
                className="flex-1 bg-white border border-stone-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-1 focus:ring-stone-300"
                placeholder="이번 장에서 이어갈 약속"
              />
              <button onClick={handleSaveGoal} className="bg-stone-900 text-white px-4 py-2 rounded-xl text-xs font-bold">저장</button>
            </div>
          ) : (
            <p className="text-sm font-black tracking-tighter text-stone-800">{user.habitGoal || '아직 정한 약속이 없습니다'}</p>
          )}
        </div>

        <div className="habit-week-strip flex justify-between items-center relative gap-0">
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
                  className={`habit-weekday flex flex-col items-center gap-2 p-2 rounded-xl transition-colors relative z-10 w-full ${isSelected ? 'is-selected' : ''}`}
                >
                  <span className="habit-weekday__name text-[8px] font-bold tracking-widest">{format(day, 'EEE')}</span>
                  <div className={`habit-weekday__date w-8 h-8 rounded-full flex items-center justify-center text-xs font-black tracking-tighter relative ${rewarded ? 'is-rewarded' : ''}`}>
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
            <h3 className="text-sm font-black tracking-tighter text-stone-800 tracking-widest">보관자 판정</h3>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => handleUpdateRecord({ status: currentRecord.status === 'success' ? 'none' : 'success' })}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${currentRecord.status === 'success' ? 'bg-green-50 border-green-500 text-green-700 shadow-inner' : 'bg-white border-stone-100 text-stone-400 hover:border-stone-200'}`}
              >
                <div className="text-2xl">✅</div>
                <span className="text-[10px] font-black tracking-tighter">완료로 봉인</span>
              </button>
              <button 
                onClick={() => handleUpdateRecord({ status: currentRecord.status === 'fail' ? 'none' : 'fail' })}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${currentRecord.status === 'fail' ? 'bg-red-50 border-red-500 text-red-700 shadow-inner' : 'bg-white border-stone-100 text-stone-400 hover:border-stone-200'}`}
              >
                <div className="text-2xl">❌</div>
                <span className="text-[10px] font-black tracking-tighter">미완으로 기록</span>
              </button>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="habit-proof-title text-sm font-black tracking-tighter text-stone-800 tracking-widest">오늘의 도판</h3>
            <div className="habit-proof-uploader aspect-square bg-stone-100 rounded-3xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center text-stone-400 hover:bg-stone-200 transition-colors cursor-pointer overflow-hidden relative group">
              {currentRecord.photo ? (
                <>
                  <img src={currentRecord.photo} alt="인증" className="w-full h-full object-cover" />
                  {(canEdit || isAdmin) && (
                    <div className="habit-proof-overlay absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <label className="habit-proof-small-action">
                        도판 교체
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePhotoUpload}
                        />
                      </label>
                      <button onClick={(e) => { e.stopPropagation(); clearPhoto(); }} className="habit-proof-small-action" type="button">삭제</button>
                    </div>
                  )}
                </>
              ) : (
                <label className={`w-full h-full flex flex-col items-center justify-center ${canEdit || isAdmin ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                  <span className="habit-proof-mark">⚜</span>
                  <span className="text-[10px] font-bold tracking-widest">도판 붙이기</span>
                  <small>오늘의 흔적을 한 장 남깁니다</small>
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
            {(canEdit || isAdmin) && currentRecord.photo && (
              <label className="habit-proof-replace">
                오늘의 도판 다시 붙이기
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                />
              </label>
            )}
            {photoStatus && <p className="habit-proof-status" lang="ko">{photoStatus}</p>}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-black tracking-tighter text-stone-800 tracking-widest">한 줄 주석 (25자)</h3>
            <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm space-y-2">
              <textarea 
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 25))}
                disabled={!canEdit && !isAdmin}
                placeholder="오늘 남길 한 문장"
                className="w-full bg-stone-50 border border-stone-100 rounded-xl p-3 text-sm font-bold outline-none focus:ring-1 focus:ring-stone-200 h-20 resize-none disabled:opacity-50"
              />
              {(canEdit || isAdmin) && (
                <button 
                  onClick={() => handleUpdateRecord({ comment })}
                  className="w-full py-3 bg-stone-900 text-white text-xs font-bold rounded-xl shadow-lg active:scale-95 transition-all"
                >
                  주석 남기기
                </button>
              )}
            </div>
          </div>

          {currentRecord.status === 'success' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="text-sm font-black tracking-tighter text-stone-800 tracking-widest">오늘의 감응</h3>
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
