
import React, { useState } from 'react';
import { User, Tier, TIER_COLORS, type CalendarEvent, type ParticipantJourneyStage } from '../../types';
import { resizeImage } from '../../utils/imageUtils';
import { HabitTrackingView } from './HabitTrackingView';
import { format, isBefore, isValid, parseISO, startOfDay, subDays } from 'date-fns';
import { deriveParticipantJourney, participantJourneyLabels } from '../../utils/participantJourney';

interface AdminViewProps {
  users: User[];
  events: CalendarEvent[];
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onAddUser: (user: User) => void;
  onExportAllData: () => void;
  onDownloadAllData: () => void;
  onImportAllDataFile: (file: File) => Promise<boolean>;
  onSaveServerData: () => Promise<boolean>;
  onLoadServerData: () => Promise<void>;
  serverSyncStatus: string;
  syncKey: string;
  onSyncKeyChange: (value: string) => void;
  onLogout: () => void;
  mainImage: string | null;
  onUpdateMainImage: (image: string | null) => void;
}

type RosterSnapshot = Record<string, string[]>;

const rosterSnapshotStorageKey = 'jerboa-facilitator-roster-baseline';

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function createRosterSnapshot(events: CalendarEvent[], users: User[]): RosterSnapshot {
  return Object.fromEntries(events.map((event) => [
    event.id,
    users
      .filter((user) => user.enrolledEventIds.includes(event.id))
      .map((user) => user.id)
      .sort(),
  ]));
}

function readRosterSnapshot(): RosterSnapshot {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(rosterSnapshotStorageKey);
    return raw ? (JSON.parse(raw) as RosterSnapshot) : {};
  } catch {
    return {};
  }
}

function writeRosterSnapshot(snapshot: RosterSnapshot) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(rosterSnapshotStorageKey, JSON.stringify(snapshot));
}

function getRosterChanges(baseline: RosterSnapshot, events: CalendarEvent[], users: User[]) {
  const userById = new Map(users.map((user) => [user.id, user]));
  const currentSnapshot = createRosterSnapshot(events, users);

  return events.flatMap((event) => {
    const previousIds = new Set(baseline[event.id] ?? []);
    const currentIds = new Set(currentSnapshot[event.id] ?? []);
    const joined = [...currentIds].filter((id) => !previousIds.has(id));
    const cancelled = [...previousIds].filter((id) => !currentIds.has(id));

    return [
      ...joined.map((userId) => ({ event, user: userById.get(userId), type: 'joined' as const })),
      ...cancelled.map((userId) => ({ event, user: userById.get(userId), type: 'cancelled' as const })),
    ].filter((change) => change.user);
  });
}

function parseEventDate(value?: string) {
  if (!value) return null;
  const date = parseISO(value);
  return isValid(date) ? date : null;
}

function getEventSortTime(event: CalendarEvent) {
  return (parseEventDate(event.date) ?? parseEventDate(event.endDate))?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function formatEventDateLabel(value: string) {
  const date = parseEventDate(value);
  if (!date) return '날짜 미정';

  return value.includes('T') ? format(date, 'yyyy.MM.dd HH:mm') : format(date, 'yyyy.MM.dd');
}

export const AdminView: React.FC<AdminViewProps> = ({ 
  users,
  events,
  onUpdateUser,
  onDeleteUser,
  onAddUser,
  onExportAllData,
  onDownloadAllData,
  onImportAllDataFile,
  onSaveServerData,
  onLoadServerData,
  serverSyncStatus,
  syncKey,
  onSyncKeyChange,
  onLogout,
  mainImage,
  onUpdateMainImage,
}) => {
  const [activeTab, setActiveTab] = useState<'operations' | 'users' | 'settings'>('operations');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingHabitUser, setViewingHabitUser] = useState<User | null>(null);
  const [bulkEditDateModalOpen, setBulkEditDateModalOpen] = useState(false);
  const [bulkEndDate, setBulkEndDate] = useState('');
  const [journeyFilter, setJourneyFilter] = useState<ParticipantJourneyStage | 'all'>('all');
  const [rosterBaseline, setRosterBaseline] = useState(() => readRosterSnapshot());
  const journeyStages: ParticipantJourneyStage[] = ['first-visit', 'invited', 'active', 'returning', 'lapsed', 'season-complete'];

  const getTodayKey = () => {
    const now = new Date();
    if (now.getHours() < 2) {
      return format(subDays(now, 1), 'yyyy-MM-dd');
    }
    return format(now, 'yyyy-MM-dd');
  };

  const todayKey = getTodayKey();
  const todayStart = startOfDay(new Date());
  const upcomingEvents = [...events]
    .filter((event) => {
      const eventDate = parseEventDate(event.endDate || event.date);
      return eventDate ? !isBefore(startOfDay(eventDate), todayStart) : true;
    })
    .sort((a, b) => getEventSortTime(a) - getEventSortTime(b));
  const nextSessions = upcomingEvents.slice(0, 6).map((event) => {
    const enrolledUsers = users.filter((user) => user.enrolledEventIds.includes(event.id));
    const missingReflectionUsers = enrolledUsers.filter((user) => user.habitRecords?.[todayKey]?.status !== 'success');
    const capacity = event.maxParticipants ?? null;
    const capacityRatio = capacity ? enrolledUsers.length / capacity : 0;

    return {
      event,
      enrolledUsers,
      missingReflectionUsers,
      capacity,
      capacityRatio,
      isCapacityWarning: Boolean(capacity && capacityRatio >= 0.8),
      needsDateReview: !parseEventDate(event.date) || !parseEventDate(event.endDate),
    };
  });
  const rosterChanges = getRosterChanges(rosterBaseline, events, users);
  const capacityWarnings = nextSessions.filter((session) => session.isCapacityWarning);
  const missingReflectionCount = nextSessions.reduce((sum, session) => sum + session.missingReflectionUsers.length, 0);
  const usersWithJourney = users.map((user) => ({
    user,
    journey: deriveParticipantJourney(user),
  }));
  const visibleUsers = usersWithJourney.filter(({ journey }) => (
    journeyFilter === 'all' || journey.stage === journeyFilter
  ));
  const journeyCounts = journeyStages.reduce((counts, stage) => ({
    ...counts,
    [stage]: usersWithJourney.filter(({ journey }) => journey.stage === stage).length,
  }), {} as Partial<Record<ParticipantJourneyStage, number>>);

  function refreshRosterBaseline() {
    const nextSnapshot = createRosterSnapshot(events, users);
    writeRosterSnapshot(nextSnapshot);
    setRosterBaseline(nextSnapshot);
  }

  function downloadAttendanceCsv(event: CalendarEvent) {
    const enrolledUsers = users.filter((user) => user.enrolledEventIds.includes(event.id));
    const rows = [
      ['event_id', 'event_title', 'event_date', 'member_name', 'journey_stage', 'today_reflection', 'coins'],
      ...enrolledUsers.map((user) => {
        const journey = deriveParticipantJourney(user);
        return [
          event.id,
          event.title,
          event.date,
          user.name,
          journey.stage,
          user.habitRecords?.[todayKey]?.status || 'none',
          String(user.coins),
        ];
      }),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `jerboa-attendance-${event.title.replace(/[^a-z0-9가-힣]+/gi, '-').replace(/^-+|-+$/g, '') || event.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const handleBulkEditSave = () => {
    if (bulkEndDate) {
      users.forEach(user => {
        onUpdateUser({ ...user, tierEndDate: bulkEndDate });
      });
      setBulkEditDateModalOpen(false);
      setBulkEndDate('');
    }
  };

  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const resizedImage = await resizeImage(file, 800, 800);
        onUpdateMainImage(resizedImage);
      } catch (error) {
        console.error("Failed to resize image", error);
        alert("이미지 업로드에 실패했습니다.");
      }
    }
  };

  const handleSaveUser = () => {
    if (editingUser) {
      const exists = users.find(u => u.id === editingUser.id);
      if (exists) {
        onUpdateUser(editingUser);
      } else {
        onAddUser(editingUser);
      }
      setEditingUser(null);
    }
  };

  if (viewingHabitUser) {
    const latestUser = users.find(u => u.id === viewingHabitUser.id) || viewingHabitUser;
    return (
      <div className="fixed inset-0 bg-white z-[150] flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-4 bg-white border-b border-stone-100 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button aria-label="회원 목록으로 돌아가기" onClick={() => setViewingHabitUser(null)} className="p-2 hover:bg-stone-50 rounded-full text-stone-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-xl font-black text-stone-800">{latestUser.name} 수련 기록</h2>
          </div>
          <span className="text-[10px] font-black text-stone-400 tracking-widest bg-stone-50 px-3 py-1 rounded-full">보관자 열람</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <HabitTrackingView 
            user={latestUser} 
            onUpdateUser={onUpdateUser} 
            onLogout={() => {}} 
            isAdmin={true} 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-stone-50">
      <div className="p-4 bg-white border-b border-stone-100 flex items-center justify-between sticky top-0 z-10">
        <h2 className="text-xl font-black text-stone-800">보관자 책상</h2>
        <button onClick={onLogout} className="text-[10px] font-bold text-stone-400 hover:text-stone-600"><span className="archive-ko-label">장부 닫기</span></button>
      </div>

      <div className="flex bg-white border-b border-stone-100">
        <button
          onClick={() => setActiveTab('operations')}
          className={`flex-1 py-3 text-[10px] font-bold transition-all ${activeTab === 'operations' ? 'text-stone-900 border-b-2 border-stone-900' : 'text-stone-400'}`}
        >
          <span className="archive-ko-label">운영실</span>
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-3 text-[10px] font-bold transition-all ${activeTab === 'users' ? 'text-stone-900 border-b-2 border-stone-900' : 'text-stone-400'}`}
        >
          <span className="archive-ko-label">회원 등록부</span>
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-3 text-[10px] font-bold transition-all ${activeTab === 'settings' ? 'text-stone-900 border-b-2 border-stone-900' : 'text-stone-400'}`}
        >
          <span className="archive-ko-label">장부 도구</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'operations' ? (
          <div className="space-y-4 pb-20">
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-label="운영 요약">
              <div className="bg-white p-4 rounded-3xl border border-stone-100 shadow-sm">
                <span className="text-[9px] font-black text-stone-400 tracking-widest">운영 확인</span>
                <strong className="block text-2xl font-black text-stone-900">{upcomingEvents.length}</strong>
              </div>
              <div className="bg-white p-4 rounded-3xl border border-stone-100 shadow-sm">
                <span className="text-[9px] font-black text-stone-400 tracking-widest">정원 경고</span>
                <strong className="block text-2xl font-black text-stone-900">{capacityWarnings.length}</strong>
              </div>
              <div className="bg-white p-4 rounded-3xl border border-stone-100 shadow-sm">
                <span className="text-[9px] font-black text-stone-400 tracking-widest">미기록 참여자</span>
                <strong className="block text-2xl font-black text-stone-900">{missingReflectionCount}</strong>
              </div>
              <div className="bg-white p-4 rounded-3xl border border-stone-100 shadow-sm">
                <span className="text-[9px] font-black text-stone-400 tracking-widest">명단 변화</span>
                <strong className="block text-2xl font-black text-stone-900">{rosterChanges.length}</strong>
              </div>
            </section>

            <section className="bg-white p-4 rounded-3xl border border-stone-100 shadow-sm space-y-3" aria-label="명단 변화">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-stone-900">Roster changes</h3>
                  <p className="text-[10px] font-bold text-stone-400">마지막 기준 저장 이후 신청/취소 변화</p>
                </div>
                <button type="button" onClick={refreshRosterBaseline} className="text-[10px] bg-stone-100 text-stone-600 px-3 py-2 rounded-full font-bold hover:bg-stone-200 transition-colors">
                  기준 갱신
                </button>
              </div>
              {rosterChanges.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {rosterChanges.slice(0, 8).map((change) => (
                    <div key={`${change.event.id}-${change.user!.id}-${change.type}`} className="p-3 bg-stone-50 rounded-2xl border border-stone-100 flex items-center justify-between gap-3">
                      <div>
                        <strong className="block text-sm text-stone-800">{change.user!.name}</strong>
                        <span className="text-[10px] text-stone-400 font-bold">{change.event.title}</span>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-1 rounded-full ${change.type === 'joined' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-500'}`}>
                        {change.type === 'joined' ? '신청' : '취소'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-bold text-stone-400">기준 이후 명단 변화가 없습니다.</p>
              )}
            </section>

            <section className="space-y-3" aria-label="다가오는 세션 운영">
              <h3 className="text-xs font-bold text-stone-400 tracking-widest ml-1">다가오는 / 확인 필요 세션</h3>
              {nextSessions.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {nextSessions.map(({ event, enrolledUsers, missingReflectionUsers, capacity, capacityRatio, isCapacityWarning, needsDateReview }) => (
                    <article key={event.id} className="bg-white p-5 rounded-3xl border border-stone-100 shadow-sm space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-black text-stone-400">{formatEventDateLabel(event.date)}</span>
                          <h4 className="text-lg font-black text-stone-900">{event.title}</h4>
                          <p className="text-xs font-bold text-stone-400">
                            {needsDateReview ? '날짜 확인 필요 / ' : ''}{event.themeName} / {event.isReward ? '문장 지급' : `${event.cost} 문장 필요`}
                          </p>
                        </div>
                        <button type="button" onClick={() => downloadAttendanceCsv(event)} className="text-[10px] bg-stone-900 text-white px-3 py-2 rounded-full font-bold shadow-sm">
                          출석 CSV
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-stone-50 rounded-2xl p-3">
                          <span className="block text-[9px] font-black text-stone-400">신청</span>
                          <strong className="text-lg font-black">{enrolledUsers.length}{capacity ? `/${capacity}` : ''}</strong>
                        </div>
                        <div className={`rounded-2xl p-3 ${isCapacityWarning ? 'bg-red-50 text-red-600' : 'bg-stone-50 text-stone-700'}`}>
                          <span className="block text-[9px] font-black">정원</span>
                          <strong className="text-lg font-black">{capacity ? `${Math.round(capacityRatio * 100)}%` : '제한 없음'}</strong>
                        </div>
                        <div className="bg-stone-50 rounded-2xl p-3">
                          <span className="block text-[9px] font-black text-stone-400">오늘 미기록</span>
                          <strong className="text-lg font-black">{missingReflectionUsers.length}</strong>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {enrolledUsers.length > 0 ? (
                          enrolledUsers.slice(0, 8).map((user) => {
                            const journey = deriveParticipantJourney(user);
                            const reflected = user.habitRecords?.[todayKey]?.status === 'success';
                            return (
                              <div key={user.id} className="flex items-center justify-between gap-2 text-xs font-bold text-stone-500">
                                <span>{user.name}</span>
                                <span>{journey.label} / {reflected ? '오늘 기록 있음' : '오늘 기록 없음'}</span>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-xs font-bold text-stone-400">아직 신청한 회원이 없습니다.</p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="bg-white p-5 rounded-3xl border border-stone-100 shadow-sm text-xs font-bold text-stone-400">
                  예정된 세션이 없습니다.
                </div>
              )}
            </section>
          </div>
        ) : activeTab === 'users' ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-bold text-stone-400 ml-1">등록된 회원 / {users.length}</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => setBulkEditDateModalOpen(true)}
                  className="text-[10px] bg-stone-100 text-stone-600 px-3 py-1 rounded-full font-bold hover:bg-stone-200 transition-colors"
                >
                  <span className="archive-ko-label">종료일 표시</span>
                </button>
                <button 
                  onClick={() => setEditingUser({
                    id: Math.random().toString(36).substr(2, 9),
                    name: '',
                    journeyStage: 'invited',
                    invitedAt: new Date().toISOString(),
                    tier: Tier.SILT,
                    coins: 0,
                    tierStartDate: new Date().toISOString(),
                    tierDurationWeeks: 4,
                    enrolledEventIds: [],
                    avatarIcon: '⚜',
                    avatarColor: '#e57758',
                  })}
                  className="text-[10px] bg-stone-900 text-white px-3 py-1 rounded-full font-bold shadow-lg"
                >
                  <span className="archive-ko-label">+ 기록 추가</span>
                </button>
              </div>
            </div>

            <section className="bg-white p-4 rounded-3xl border border-stone-100 shadow-sm space-y-3" aria-label="참가자 여정 현황">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {journeyStages.map((stage) => (
                  <button
                    type="button"
                    key={stage}
                    onClick={() => setJourneyFilter(journeyFilter === stage ? 'all' : stage)}
                    className={`p-3 rounded-2xl border text-left transition-all ${journeyFilter === stage ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-100 bg-stone-50 text-stone-600'}`}
                  >
                    <span className="block text-[9px] font-black tracking-widest">{participantJourneyLabels[stage].ko}</span>
                    <strong className="text-lg font-black">{journeyCounts[stage] ?? 0}</strong>
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-bold text-stone-400">
                {journeyFilter === 'all' ? '전체 여정 상태를 보는 중' : `${participantJourneyLabels[journeyFilter].ko} 회원만 보는 중`}
              </p>
            </section>
            
            <div className="grid grid-cols-1 gap-3">
              {visibleUsers.map(({ user, journey }) => (
                <div key={user.id} className="member-record-row bg-white p-5 rounded-3xl border border-stone-100 shadow-sm group hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    <div
                      className="member-seal"
                      style={{ '--seal-color': user.avatarColor || '#e57758' } as React.CSSProperties}
                    >
                      {user.profileImage ? (
                        <img src={user.profileImage} alt={user.name} />
                      ) : (
                        <span className="member-seal__initial">{user.name.slice(0, 1)}</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="font-black text-stone-900 text-base">{user.name}</div>
                        <span className="px-2 py-0.5 bg-stone-100 text-stone-500 text-[8px] font-black border border-stone-200 rounded-md">
                          {journey.label}
                        </span>
                        {user.habitRecords?.[todayKey]?.status === 'success' && (
                          <div className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black border border-blue-200 rounded-md rotate-[-5deg] shadow-sm animate-in zoom-in-50 duration-300">
                            수련 완료
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${TIER_COLORS[user.tier]}`}>{user.tier}</span>
                        <span className="text-[10px] text-stone-400 font-bold tracking-tight">{user.coins} <span className="text-[8px] opacity-60">문장</span></span>
                        <span className="text-[10px] text-stone-400 font-bold tracking-tight">{journey.note}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button aria-label={`${user.name} 수련 기록 보기`} onClick={() => setViewingHabitUser(user)} className="p-2.5 hover:bg-stone-50 rounded-2xl text-stone-400 transition-colors" title="습관 관리">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                    <button aria-label={`${user.name} 회원 기록 수정`} onClick={() => setEditingUser(user)} className="p-2.5 hover:bg-stone-50 rounded-2xl text-stone-400 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button
                      aria-label={`${user.name} 회원 기록 삭제`}
                      onClick={() => {
                        if (confirm(`${user.name} 회원 기록을 삭제할까요? 신청 내역과 개인 기록도 함께 사라집니다.`)) {
                          onDeleteUser(user.id);
                        }
                      }}
                      className="p-2.5 hover:bg-red-50 rounded-2xl text-red-300 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-20">
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-stone-400 tracking-widest ml-1">장부 표지</h3>
              <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm space-y-4">
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-32 h-32 rounded-3xl bg-stone-50 border-2 border-dashed border-stone-200 flex items-center justify-center overflow-hidden relative group">
                    {mainImage ? (
                      <>
                        <img src={mainImage} alt="Main" className="w-full h-full object-cover" />
                        <button 
                          aria-label="장부 표지 이미지 삭제"
                          onClick={() => onUpdateMainImage(null)}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </>
                    ) : (
                      <div className="text-center space-y-1">
                        <svg className="w-8 h-8 text-stone-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span className="text-[10px] font-bold text-stone-300 tracking-widest">이미지 없음</span>
                      </div>
                    )}
                  </div>
                  <div className="relative w-full">
                    <button className="w-full py-3 bg-stone-100 text-stone-600 text-xs font-bold rounded-xl hover:bg-stone-200 transition-colors">
                      {mainImage ? '이미지 교체' : '이미지 올리기'}
                    </button>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      onChange={handleMainImageUpload}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-stone-400 tracking-widest ml-1">공동 장부 동기화</h3>
              <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm space-y-3">
                <label className="block space-y-2">
                  <span className="text-[10px] font-bold text-stone-400 tracking-widest">공동 장부 열쇠</span>
                  <input
                    type="password"
                    value={syncKey}
                    onChange={(event) => onSyncKeyChange(event.target.value)}
                    placeholder="보관자 열쇠"
                    className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-stone-200"
                  />
                </label>
                <div>
                  <div className="font-bold text-stone-800">공유 장부</div>
                  <div className="text-[10px] text-stone-400 font-medium mt-1">{serverSyncStatus}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={onSaveServerData}
                    className="w-full p-3 bg-stone-900 text-white border border-stone-900 rounded-xl text-xs font-bold"
                  >
                    <span className="archive-ko-label">공동 장부에 봉인</span>
                  </button>
                  <button
                    onClick={onLoadServerData}
                    className="w-full p-3 bg-stone-100 text-stone-700 border border-stone-200 rounded-xl text-xs font-bold"
                  >
                    <span className="archive-ko-label">공동 장부 열람</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-stone-400 tracking-widest ml-1">장부 이동</h3>
              <div className="grid grid-cols-1 gap-2">
                <button onClick={onExportAllData} className="w-full p-4 bg-white border border-stone-100 rounded-2xl flex items-center justify-between group hover:bg-stone-50 transition-colors">
                  <div className="text-left">
                    <div className="font-bold text-stone-800">장부 코드 만들기</div>
                    <div className="text-[10px] text-stone-400 font-medium">비공개 장부 데이터를 클립보드에 복사합니다</div>
                  </div>
                  <svg className="w-5 h-5 text-stone-300 group-hover:text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                </button>
                <button onClick={onDownloadAllData} className="w-full p-4 bg-white border border-stone-100 rounded-2xl flex items-center justify-between group hover:bg-stone-50 transition-colors">
                  <div className="text-left">
                    <div className="font-bold text-stone-800">백업 파일 내려받기</div>
                    <div className="text-[10px] text-stone-400 font-medium">복구용 JSON 장부를 저장합니다</div>
                  </div>
                  <span className="archive-ko-label text-[10px] text-stone-400 font-black">Json</span>
                </button>
                <label className="w-full p-4 bg-white border border-stone-100 rounded-2xl flex items-center justify-between group hover:bg-stone-50 transition-colors cursor-pointer">
                  <div className="text-left">
                    <div className="font-bold text-stone-800">백업 파일 가져오기</div>
                    <div className="text-[10px] text-stone-400 font-medium">복구 후 공동 장부에 바로 봉인합니다</div>
                  </div>
                  <span className="archive-ko-label text-[10px] text-stone-400 font-black">불러오기</span>
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (file) {
                        void onImportAllDataFile(file);
                        event.currentTarget.value = '';
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm">
              <div className="font-bold text-stone-800">로컬 장부</div>
              <div className="text-[10px] text-stone-400 font-medium mt-1">
                이 브라우저에도 저장하고, 연결되면 공동 장부와 맞춥니다
              </div>
            </div>
          </div>
        )}
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="member-editor-title">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-6 animate-in zoom-in-95 duration-300 shadow-2xl">
            <h3 id="member-editor-title" className="text-lg font-black text-stone-900">회원 기록 수정</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 tracking-widest">이름</label>
                <input 
                  type="text" 
                  value={editingUser.name} 
                  onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                  className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-stone-200"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 tracking-widest">단계</label>
                <div className="grid grid-cols-3 gap-2">
                  {[Tier.SILT, Tier.CREST, Tier.ERG].map(t => (
                    <button 
                      key={t}
                      onClick={() => setEditingUser({...editingUser, tier: t})}
                      className={`py-2 rounded-xl text-[10px] font-bold tracking-widest transition-all ${editingUser.tier === t ? TIER_COLORS[t] : 'bg-stone-50 text-stone-400 hover:bg-stone-100'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 tracking-widest">문장 수</label>
                <input 
                  type="number" 
                  value={editingUser.coins} 
                  onChange={e => setEditingUser({...editingUser, coins: parseInt(e.target.value) || 0})}
                  className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-stone-200"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 tracking-widest">마감일</label>
                <input 
                  type="date" 
                  value={editingUser.tierEndDate || ''} 
                  onChange={e => setEditingUser({...editingUser, tierEndDate: e.target.value})}
                  className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-stone-200"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 tracking-widest">참가자 여정</label>
                <select
                  value={editingUser.journeyStage || deriveParticipantJourney(editingUser).stage}
                  onChange={e => setEditingUser({
                    ...editingUser,
                    journeyStage: e.target.value as ParticipantJourneyStage,
                    invitedAt: editingUser.invitedAt || new Date().toISOString(),
                  })}
                  className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-stone-200"
                >
                  {journeyStages.map((stage) => (
                    <option value={stage} key={stage}>{participantJourneyLabels[stage].ko}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 tracking-widest">여정 메모</label>
                <textarea
                  value={editingUser.journeyNotes || ''}
                  onChange={e => setEditingUser({...editingUser, journeyNotes: e.target.value})}
                  className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-stone-200 h-20 resize-none"
                  placeholder="복귀 연락, 시즌 완료, 다음 초대 등 운영 메모"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditingUser(null)} className="flex-1 py-3 bg-stone-100 text-stone-500 text-xs font-bold rounded-xl"><span className="archive-ko-label">취소</span></button>
              <button onClick={handleSaveUser} className="flex-1 py-3 bg-stone-900 text-white text-xs font-bold rounded-xl shadow-lg"><span className="archive-ko-label">기록 저장</span></button>
            </div>
          </div>
        </div>
      )}
      {bulkEditDateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="bulk-date-title">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-6 animate-in zoom-in-95 duration-300 shadow-2xl">
            <h3 id="bulk-date-title" className="text-lg font-black text-stone-900">마감일 표시</h3>
            <p className="text-xs text-stone-500">모든 회원 기록에 같은 마감일을 적용합니다</p>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-stone-400 tracking-widest">마감일</label>
              <input 
                type="date" 
                value={bulkEndDate} 
                onChange={e => setBulkEndDate(e.target.value)}
                className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-stone-200"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setBulkEditDateModalOpen(false)} className="flex-1 py-3 bg-stone-100 text-stone-500 text-xs font-bold rounded-xl"><span className="archive-ko-label">취소</span></button>
              <button onClick={handleBulkEditSave} className="flex-1 py-3 bg-stone-900 text-white text-xs font-bold rounded-xl shadow-lg"><span className="archive-ko-label">적용</span></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
