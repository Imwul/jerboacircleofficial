
import React, { useState, useEffect, useRef, Component } from 'react';
import { INITIAL_USERS, INITIAL_EVENTS } from './constants';
import { User, CalendarEvent, ThemeColor } from './types';
import { LoginView } from './components/views/LoginView';
import { CalendarView } from './components/views/CalendarView';
import { ProfileView } from './components/views/ProfileView';
import { AdminView } from './components/views/AdminView';
import { HabitTrackingView } from './components/views/HabitTrackingView';
import { EventFormModal } from './components/modals/EventFormModal';
import { generateRecurringEvents } from './utils/dateUtils';
import { format, parseISO, setHours, setMinutes, addHours } from 'date-fns';
import { loadServerSync, saveServerSync } from './utils/serverSync';
import './MembersArchive.css';

const generateId = () => Math.random().toString(36).substr(2, 9);

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-stone-50 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 text-2xl">⚠️</div>
          <h1 className="text-xl font-black text-stone-900 mb-2">앱에 오류가 발생했습니다</h1>
          <p className="text-sm text-stone-500 mb-6">데이터가 너무 크거나 일시적인 오류일 수 있습니다.</p>
          <button 
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="px-6 py-3 bg-stone-900 text-white rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all"
          >
            데이터 초기화 후 재시작
          </button>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

const DEFAULT_THEME_NAMES: Record<ThemeColor, string> = {
  [ThemeColor.SAGE]: '문턱',
  [ThemeColor.TERRACOTTA]: '주석회',
  [ThemeColor.SLATE]: '도상 연구',
  [ThemeColor.SAND]: '장소 읽기',
  [ThemeColor.CHARCOAL]: '검은 장',
  [ThemeColor.MAUVE]: '심야 독회',
  [ThemeColor.OLIVE]: '보존',
  [ThemeColor.ROSE]: '장미 표식',
  [ThemeColor.INDIGO]: '별의 장',
  [ThemeColor.LIME]: '연금술 노트',
};

const STORAGE_KEYS = {
  USERS: 'jerboa_users',
  EVENTS: 'jerboa_events',
  THEMES: 'jerboa_themes',
};

interface MembersSyncPayload {
  users: User[];
  events: CalendarEvent[];
  themeNames: Record<ThemeColor, string>;
  mainImage: string | null;
}

function App() {
  console.log('App component rendering');
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USERS);
      return saved ? JSON.parse(saved) : INITIAL_USERS;
    } catch (e) {
      console.error('Error parsing users from localStorage', e);
      return INITIAL_USERS;
    }
  });

  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
      return saved ? JSON.parse(saved) : INITIAL_EVENTS;
    } catch (e) {
      console.error('Error parsing events from localStorage', e);
      return INITIAL_EVENTS;
    }
  });

  const [themeNames, setThemeNames] = useState<Record<ThemeColor, string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.THEMES);
      return saved ? { ...DEFAULT_THEME_NAMES, ...JSON.parse(saved) } : DEFAULT_THEME_NAMES;
    } catch (e) {
      console.error('Error parsing themes from localStorage', e);
      return DEFAULT_THEME_NAMES;
    }
  });

  const [mainImage, setMainImage] = useState<string | null>(() => {
    return localStorage.getItem('jerboa_main_image');
  });

  const [currentUser, setCurrentUser] = useState<User | 'admin' | null>(null);
  const [activeTab, setActiveTab] = useState<'calendar' | 'habit' | 'profile' | 'admin'>('calendar');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [serverSyncStatus, setServerSyncStatus] = useState('서버 연결 대기');
  const hasServerHydrated = useRef(false);
  const serverSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [clipboard, setClipboard] = useState<CalendarEvent | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedDateForNewEvent, setSelectedDateForNewEvent] = useState<Date>(new Date());
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const createMembersSyncPayload = (): MembersSyncPayload => ({
    users,
    events,
    themeNames,
    mainImage,
  });

  const applyMembersSyncPayload = (payload: Partial<MembersSyncPayload>) => {
    if (payload.users) setUsers(payload.users);
    if (payload.events) setEvents(payload.events);
    if (payload.themeNames) setThemeNames({ ...DEFAULT_THEME_NAMES, ...payload.themeNames });
    setMainImage(payload.mainImage || null);
  };

  const saveMembersToServer = async (source = '자동 저장') => {
    try {
      setServerSyncStatus(`${source} 중`);
      const result = await saveServerSync('members', createMembersSyncPayload());
      setServerSyncStatus(`서버 저장됨 / ${format(new Date(result.savedAt || new Date()), 'HH mm ss')}`);
      return true;
    } catch (error) {
      setServerSyncStatus('서버 저장 실패 / 로컬 보관 중');
      console.error('Server save failed:', error);
      return false;
    }
  };

  const loadMembersFromServer = async () => {
    try {
      setServerSyncStatus('서버 장부 불러오는 중');
      const result = await loadServerSync<MembersSyncPayload>('members');

      if (result.exists && result.saved?.data) {
        applyMembersSyncPayload(result.saved.data);
        setServerSyncStatus(`서버 장부 적용됨 / ${format(new Date(result.saved.savedAt), 'HH mm ss')}`);
      } else {
        setServerSyncStatus('서버 장부 없음 / 새 장부 생성 중');
        await saveServerSync('members', createMembersSyncPayload());
        setServerSyncStatus('서버 장부 생성됨');
      }
    } catch (error) {
      setServerSyncStatus('서버 미연결 / 로컬 장부 사용 중');
      console.error('Server load failed:', error);
    } finally {
      hasServerHydrated.current = true;
    }
  };

  useEffect(() => {
    void loadMembersFromServer();
  }, []);

  // 로컬 저장은 즉시, 서버 저장은 여러 사용자를 위해 짧게 모아 자동 반영합니다.
  useEffect(() => {
    try {
      // 로컬 스토리지에는 항상 즉시 저장
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
      localStorage.setItem(STORAGE_KEYS.THEMES, JSON.stringify(themeNames));
      if (mainImage) {
        localStorage.setItem('jerboa_main_image', mainImage);
      } else {
        localStorage.removeItem('jerboa_main_image');
      }
    } catch (e) {
      console.error('Error saving to localStorage:', e);
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        alert('저장 공간이 부족합니다. 사진 크기를 줄이거나 데이터를 정리해주세요.');
      }
    }
    triggerSaveNotification();
  }, [users, events, themeNames, mainImage]);

  useEffect(() => {
    if (!hasServerHydrated.current) return;
    if (serverSaveTimer.current) clearTimeout(serverSaveTimer.current);

    serverSaveTimer.current = setTimeout(() => {
      void saveMembersToServer();
    }, 900);

    return () => {
      if (serverSaveTimer.current) clearTimeout(serverSaveTimer.current);
    };
  }, [users, events, themeNames, mainImage]);

  useEffect(() => {
    if (lastSaved) {
      const timer = setTimeout(() => setLastSaved(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastSaved]);

  const triggerSaveNotification = () => {
    setLastSaved(format(new Date(), 'HH mm ss'));
  };

  const [syncCodeToDisplay, setSyncCodeToDisplay] = useState<string | null>(null);

  const handleExportAllData = () => {
    const allData = { users, events, themeNames, mainImage, exportedAt: new Date().toISOString() };
    const base64Code = btoa(encodeURIComponent(JSON.stringify(allData)));
    try {
      navigator.clipboard.writeText(base64Code);
    } catch (e) {
      console.error("Clipboard write failed", e);
    }
    setSyncCodeToDisplay(base64Code);
  };

  const handleImportAllData = (base64Code: string) => {
    try {
      let decodedData: string;
      const trimmedCode = base64Code.trim();
      if (trimmedCode.startsWith('{')) {
        decodedData = trimmedCode;
      } else {
        try {
          // Try decoding with URI component (for UTF-8 support)
          decodedData = decodeURIComponent(atob(trimmedCode));
        } catch (e) {
          // Fallback to direct atob if URI decoding fails
          decodedData = atob(trimmedCode);
        }
      }
      
      const parsed = JSON.parse(decodedData);
      const data = parsed.data || parsed;
      
      if (data.users && data.events && data.themeNames) {
        if (confirm("비공개 장부 데이터를 불러오시겠습니까?\n(기존 기록이 덮어씌워집니다)")) {
          applyMembersSyncPayload(data);
          void saveServerSync('members', data).then(() => {
            setServerSyncStatus('가져오기 완료 / 서버 저장됨');
          }).catch((error) => {
            console.error('Import server save failed:', error);
            setServerSyncStatus('가져오기 완료 / 서버 저장 실패');
          });
          alert("데이터를 성공적으로 불러왔습니다.");
          return true;
        }
      } else {
        alert("데이터 형식이 올바르지 않습니다.");
      }
    } catch (err) { 
      console.error("Import error:", err);
      alert("잘못된 장부 코드입니다. 코드를 다시 확인해주세요."); 
    }
    return false;
  };

  const handleDownloadAllData = () => {
    const payload = {
      type: 'jerboa-member-register',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: createMembersSyncPayload(),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `jerboa-member-register-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportAllDataFile = async (file: File) => {
    try {
      const raw = await file.text();
      const payload = JSON.parse(raw);
      const data = payload.data || payload;
      if (!data.users || !data.events || !data.themeNames) {
        alert('데이터 형식이 올바르지 않습니다.');
        return false;
      }

      if (confirm('백업 파일의 장부를 불러오시겠습니까? 기존 데이터가 덮어씌워집니다.')) {
        applyMembersSyncPayload(data);
        await saveServerSync('members', data);
        setServerSyncStatus('백업 파일 적용 / 서버 저장됨');
        return true;
      }
    } catch (error) {
      console.error('File import failed:', error);
      alert('백업 파일을 읽을 수 없습니다.');
    }
    return false;
  };

  const handleUserLogin = (user: User) => {
    const latestUser = users.find(u => u.id === user.id) || user;
    setCurrentUser(latestUser);
    setActiveTab('calendar');
  };

  const handleAdminLogin = () => {
    setCurrentUser('admin');
    setActiveTab('calendar');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('calendar');
  };

  // 현재 로그인한 유저의 최신 데이터를 가져오는 헬퍼
  const activeUserData = currentUser && currentUser !== 'admin' 
    ? users.find(u => u.id === currentUser.id) || null 
    : null;

  const handleUpdateUser = (updates: Partial<User>) => {
    if (!activeUserData || currentUser === 'admin') return;
    setUsers(prev => prev.map(u => u.id === activeUserData.id ? { ...u, ...updates } : u));
  };

  const handleDeleteUser = (userId: string) => {
    setUsers(prev => prev.filter(u => u.id !== userId));
    if (currentUser && currentUser !== 'admin' && currentUser.id === userId) {
      handleLogout();
    }
  };

  const openAddEventModal = (date?: Date) => {
    setEditingEvent(null);
    setSelectedDateForNewEvent(date || new Date());
    setIsEventModalOpen(true);
  };

  const openEditEventModal = (event: CalendarEvent) => {
    setEditingEvent(event);
    setIsEventModalOpen(true);
  };

  const handleCopyEvent = (event: CalendarEvent) => setClipboard(event);
  const handleClearClipboard = () => setClipboard(null);

  const handlePasteEvent = (targetDate: Date) => {
    if (!clipboard) return;
    const sourceDate = parseISO(clipboard.date);
    const sourceEndDate = clipboard.endDate ? parseISO(clipboard.endDate) : addHours(sourceDate, 2);
    const newDate = setMinutes(setHours(targetDate, sourceDate.getHours()), sourceDate.getMinutes());
    const duration = sourceEndDate.getTime() - sourceDate.getTime();
    const newEndDate = new Date(newDate.getTime() + (isNaN(duration) || duration <= 0 ? 7200000 : duration));

    const pastedEvent: CalendarEvent = {
      ...clipboard, id: generateId(),
      date: format(newDate, "yyyy-MM-dd'T'HH:mm"),
      endDate: format(newEndDate, "yyyy-MM-dd'T'HH:mm"),
      recurringGroupId: undefined
    };
    setEvents(prev => [...prev, pastedEvent]);
    setClipboard(null);
  };

  const handleEventSubmit = (eventData: Partial<CalendarEvent>, recurrence?: { type: 'count' | 'date', count: number, endDate: string, daysOfWeek: number[] }) => {
    const selectedColor = (eventData.theme as ThemeColor) || ThemeColor.SAGE;
    const newThemeName = eventData.themeName || themeNames[selectedColor];

    if (themeNames[selectedColor] !== newThemeName) {
      setThemeNames(prev => ({ ...prev, [selectedColor]: newThemeName }));
    }

    const baseEvent: CalendarEvent = {
      id: editingEvent ? editingEvent.id : generateId(),
      title: eventData.title || '새 여정',
      description: eventData.description || '',
      detailedDescription: eventData.detailedDescription || '',
      theme: selectedColor,
      themeName: newThemeName,
      cost: eventData.cost || 0,
      isReward: eventData.isReward || false,
      date: eventData.date!,
      endDate: eventData.endDate!,
      maxParticipants: eventData.maxParticipants
    };

    if (editingEvent) {
      setEvents(prev => prev.map(ev => ev.id === editingEvent.id ? baseEvent : ev));
    } else {
      if (recurrence) {
        const newEvents = generateRecurringEvents(baseEvent, { 
          type: recurrence.type, 
          value: recurrence.type === 'count' ? recurrence.count : recurrence.endDate,
          daysOfWeek: recurrence.daysOfWeek
        });
        setEvents(prev => [...prev, ...newEvents]);
      } else {
        setEvents(prev => [...prev, baseEvent]);
      }
    }
    setIsEventModalOpen(false);
    setEditingEvent(null);
  };

  const handleDeleteEvent = (event: CalendarEvent) => {
    setEvents(prev => prev.filter(e => e.id !== event.id));
    setUsers(prev => prev.map(u => ({ ...u, enrolledEventIds: u.enrolledEventIds.filter(id => id !== event.id) })));
  };

  const joinEvent = (event: CalendarEvent) => {
    if (!activeUserData) return;
    const currentParticipants = users.filter(u => u.enrolledEventIds.includes(event.id)).length;
    if (event.maxParticipants && currentParticipants >= event.maxParticipants) {
      alert("정원이 초과되었습니다."); return;
    }
    if (!event.isReward && activeUserData.coins < event.cost) {
      alert("문장이 부족합니다."); return;
    }
    const updatedUser = {
      ...activeUserData,
      coins: event.isReward ? activeUserData.coins + event.cost : activeUserData.coins - event.cost,
      enrolledEventIds: [...activeUserData.enrolledEventIds, event.id]
    };
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  const cancelEvent = (event: CalendarEvent) => {
    if (!activeUserData) return;
    const updatedUser = {
      ...activeUserData,
      coins: event.isReward ? activeUserData.coins - event.cost : activeUserData.coins + event.cost,
      enrolledEventIds: activeUserData.enrolledEventIds.filter(id => id !== event.id)
    };
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  const todayKeyForArchive = format(new Date(), 'yyyy-MM-dd');
  const completedToday = users.filter(user => user.habitRecords?.[todayKeyForArchive]?.status === 'success').length;
  const totalEnrollments = users.reduce((sum, user) => sum + user.enrolledEventIds.length, 0);
  const archiveSectionTitle = !currentUser
    ? 'Antecamera'
    : currentUser === 'admin'
      ? activeTab === 'admin' ? 'Scriptorium' : 'Itinerary'
      : activeTab === 'habit' ? 'Marginalia' : activeTab === 'profile' ? 'Folio' : 'Itinerary';
  const archiveSectionNote = !currentUser
    ? '회원 이름을 선택하면 개인 장부와 프로그램 기록으로 들어갑니다.'
    : currentUser === 'admin'
      ? '프로그램 일정, 회원 기록, 서버 저장, 백업 파일을 관리하는 관리자 화면입니다.'
      : '참여할 프로그램을 확인하고, 오늘의 기록과 개인 정보를 남기는 회원실입니다.';

  return (
    <ErrorBoundary>
      <div className="members-archive min-h-screen text-stone-900 font-sans">
        <aside className="archive-sidebar" aria-label="Private archive navigation">
          <a className="archive-sigil" href="/">
            <span>Jerboa</span>
            <span>Circle</span>
          </a>
          <a className="archive-public-return" href="/">
            <span lang="en">Public archive</span>
            <small lang="ko">메인 기록벽으로 돌아가기</small>
          </a>
          <nav className="archive-cabinet">
            <button className={activeTab === 'calendar' ? 'is-active' : ''} onClick={() => setActiveTab('calendar')}>
              <span lang="en">Itinerary</span>
              <small lang="ko">프로그램 일정 {events.length}개</small>
            </button>
            <button className={activeTab === 'profile' || activeTab === 'admin' ? 'is-active' : ''} onClick={() => currentUser && currentUser !== 'admin' ? setActiveTab('profile') : setActiveTab('admin')}>
              <span lang="en">Folio</span>
              <small lang="ko">회원 장부 {users.length}명</small>
            </button>
            <button className={activeTab === 'calendar' ? 'is-active' : ''} onClick={() => setActiveTab('calendar')}>
              <span lang="en">Seats</span>
              <small lang="ko">신청된 자리 {totalEnrollments}개</small>
            </button>
            <button className={activeTab === 'calendar' ? 'is-active' : ''} onClick={() => setActiveTab('calendar')}>
              <span lang="en">Threshold</span>
              <small lang="ko">지금 열려 있는 프로그램</small>
            </button>
            <button className={activeTab === 'habit' ? 'is-active' : ''} onClick={() => currentUser && currentUser !== 'admin' && setActiveTab('habit')}>
              <span lang="en">Marginalia</span>
              <small lang="ko">오늘 남긴 기록 {completedToday}개</small>
            </button>
            <button className={activeTab === 'admin' ? 'is-active' : ''} onClick={() => currentUser === 'admin' && setActiveTab('admin')}>
              <span lang="en">Keeper</span>
              <small lang="ko">{currentUser === 'admin' ? '관리자 화면 열림' : '관리자만 접근 가능'}</small>
            </button>
          </nav>
          <div className="archive-sidebar-foot">
              <span lang="en">Private memory room</span>
            <span lang="ko">{serverSyncStatus}</span>
          </div>
          <a className="archive-godmode-link" href="/godmode/">
            <span lang="en"><i aria-hidden="true">✠</i> Text room</span>
            <small lang="ko">진입금지 / 문구실</small>
          </a>
        </aside>

        <div className="archive-workbench">
          {lastSaved && (
            <div className="archive-save-notice">
              장부에 기록됨 / {lastSaved}
            </div>
          )}
          
          <header className="archive-topbar">
            <div>
              <p lang="en">Jerboa Circle / private room</p>
              <h1 lang="en">{archiveSectionTitle}</h1>
              <span lang="ko">{archiveSectionNote}</span>
              <span className="archive-server-line" lang="ko">{serverSyncStatus}</span>
            </div>
            <div className="archive-topbar-actions">
              {currentUser === 'admin' && (
                <button onClick={() => setActiveTab(activeTab === 'calendar' ? 'admin' : 'calendar')}>
                  <span lang="en">{activeTab === 'calendar' ? 'Scriptorium' : 'Itinerary'}</span>
                </button>
              )}
              {currentUser && (
                <button onClick={handleLogout}><span className="archive-ko-label">장부 닫기</span></button>
              )}
            </div>
          </header>

          <section className="archive-context" aria-label="Archive summary">
            <div>
              <span lang="en">Open passages</span>
              <small lang="ko">등록된 프로그램</small>
              <strong>{events.length}</strong>
            </div>
            <div>
              <span lang="en">Marked seats</span>
              <small lang="ko">전체 참여 신청</small>
              <strong>{totalEnrollments}</strong>
            </div>
            <div>
              <span lang="en">Readers</span>
              <small lang="ko">회원 수</small>
              <strong>{users.length}</strong>
            </div>
            <div>
              <span lang="en">Today notes</span>
              <small lang="ko">오늘 기록한 회원</small>
              <strong>{completedToday}</strong>
            </div>
          </section>

          <main className="archive-main">
            {!currentUser ? (
              <LoginView 
                users={users} 
                onUserLogin={handleUserLogin} 
                onAdminLogin={handleAdminLogin} 
                onImportData={handleImportAllData} 
                mainImage={mainImage}
              />
            ) : currentUser === 'admin' ? (
              activeTab === 'calendar' ? (
                <CalendarView 
                  events={events} user="admin" users={users} isAdmin={true}
                  onJoinEvent={() => {}} onCancelEvent={() => {}} 
                  onAddEvent={openAddEventModal} onEditEvent={openEditEventModal}
                  onDeleteEvent={handleDeleteEvent} onCopyEvent={handleCopyEvent}
                  onPasteEvent={handlePasteEvent} onClearClipboard={handleClearClipboard}
                  copiedEventTitle={clipboard?.title}
                  onLogout={handleLogout}
                />
              ) : (
                <AdminView 
                  users={users} 
                  onUpdateUser={(user) => setUsers(prev => prev.map(u => u.id === user.id ? user : u))}
                  onAddUser={(user) => setUsers(prev => [...prev, user])}
                  onDeleteUser={handleDeleteUser}
                  onExportAllData={handleExportAllData} 
                  onDownloadAllData={handleDownloadAllData}
                  onImportAllDataFile={handleImportAllDataFile}
                  onSaveServerData={() => saveMembersToServer('수동 서버 저장')}
                  onLoadServerData={loadMembersFromServer}
                  serverSyncStatus={serverSyncStatus}
                  onLogout={handleLogout} 
                  mainImage={mainImage}
                  onUpdateMainImage={setMainImage}
                />
              )
            ) : activeTab === 'calendar' ? (
              <CalendarView events={events} user={activeUserData} users={users} onJoinEvent={joinEvent} onCancelEvent={cancelEvent} isAdmin={false} onLogout={handleLogout} />
            ) : activeTab === 'habit' ? (
              <HabitTrackingView 
                user={activeUserData!} 
                onUpdateUser={handleUpdateUser} 
                onLogout={handleLogout}
                isAdmin={false}
              />
            ) : (
              <ProfileView 
                user={activeUserData!} 
                onLogout={handleLogout}
                onUpdateUser={handleUpdateUser}
                onDeleteAccount={() => handleDeleteUser(activeUserData!.id)}
              />
            )}
          </main>
          
          {currentUser && currentUser !== 'admin' && (
            <nav className="archive-mobile-tabs">
              <button onClick={() => setActiveTab('calendar')} className={activeTab === 'calendar' ? 'is-active' : ''}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span>여정함</span>
              </button>
              <button onClick={() => setActiveTab('habit')} className={activeTab === 'habit' ? 'is-active' : ''}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>주석</span>
              </button>
              <button onClick={() => setActiveTab('profile')} className={activeTab === 'profile' ? 'is-active' : ''}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <span>표지</span>
              </button>
            </nav>
          )}
          <EventFormModal 
            isOpen={isEventModalOpen} 
            onClose={() => setIsEventModalOpen(false)} 
            onSave={handleEventSubmit} 
            initialDate={selectedDateForNewEvent} 
            event={editingEvent} 
            themeNames={themeNames}
          />
          {syncCodeToDisplay && (
            <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                <div className="p-6 space-y-4">
                  <h2 className="text-xl font-black text-stone-900">동기화 코드</h2>
                  <p className="text-sm text-stone-500">
                    아래 코드가 클립보드에 복사되었습니다. 만약 복사되지 않았다면 직접 복사해주세요.
                  </p>
                  <textarea 
                    className="w-full h-32 p-3 text-xs font-mono text-stone-600 bg-stone-50 border border-stone-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                    readOnly
                    value={syncCodeToDisplay}
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  />
                  <button 
                    onClick={() => setSyncCodeToDisplay(null)}
                    className="w-full py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-colors"
                  >
                    <span className="archive-ko-label">닫기</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;
