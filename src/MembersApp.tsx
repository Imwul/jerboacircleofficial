
import React, { useState, useEffect, Component } from 'react';
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
  [ThemeColor.SAGE]: '소셜 파티',
  [ThemeColor.TERRACOTTA]: '머스타드 워크숍',
  [ThemeColor.SLATE]: '특별 이벤트',
  [ThemeColor.SAND]: '야외 활동',
  [ThemeColor.CHARCOAL]: '특강',
  [ThemeColor.MAUVE]: '심야 모임',
  [ThemeColor.OLIVE]: '매트 핑크 모임',
  [ThemeColor.ROSE]: '로즈 파티',
  [ThemeColor.INDIGO]: '인디고 나이트',
  [ThemeColor.LIME]: '라임 워크숍',
};

const STORAGE_KEYS = {
  USERS: 'jerboa_users',
  EVENTS: 'jerboa_events',
  THEMES: 'jerboa_themes',
};

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
  
  const [clipboard, setClipboard] = useState<CalendarEvent | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedDateForNewEvent, setSelectedDateForNewEvent] = useState<Date>(new Date());
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // 로컬 저장 전용. 서버 연결 없이 Vercel 정적 배포에서도 즉시 동작합니다.
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
    if (lastSaved) {
      const timer = setTimeout(() => setLastSaved(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastSaved]);

  const triggerSaveNotification = () => {
    setLastSaved(format(new Date(), 'HH:mm:ss'));
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
      try {
        // Try decoding with URI component (for UTF-8 support)
        decodedData = decodeURIComponent(atob(base64Code.trim()));
      } catch (e) {
        // Fallback to direct atob if URI decoding fails
        decodedData = atob(base64Code.trim());
      }
      
      const data = JSON.parse(decodedData);
      
      if (data.users && data.events && data.themeNames) {
        if (confirm("클럽 데이터를 불러오시겠습니까?\n(기존 데이터가 덮어씌워집니다)")) {
          setUsers(data.users);
          setEvents(data.events);
          setThemeNames({ ...DEFAULT_THEME_NAMES, ...data.themeNames });
          setMainImage(data.mainImage || null);
          alert("데이터를 성공적으로 불러왔습니다.");
          return true;
        }
      } else {
        alert("데이터 형식이 올바르지 않습니다.");
      }
    } catch (err) { 
      console.error("Import error:", err);
      alert("잘못된 동기화 코드입니다. 코드를 다시 확인해주세요."); 
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
      title: eventData.title || '새 일정',
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
      alert("코인이 부족합니다."); return;
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

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-stone-50 text-stone-900 font-sans flex justify-center">
        <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative flex flex-col">
          {lastSaved && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-green-600 text-white px-6 py-2 rounded-full shadow-2xl text-xs font-bold animate-pulse">
              이 기기에 저장됨 ({lastSaved})
            </div>
          )}
          
          <header className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-white/90 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-stone-900 rounded-xl flex items-center justify-center shadow-lg shadow-stone-200">
                <span className="text-white text-xs font-black">J</span>
              </div>
              <div className="flex flex-col -space-y-1">
                <div className="font-black text-lg text-stone-900">Jerboa<span className="text-primary-600">Circle</span></div>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <span className="text-[8px] font-black text-green-600 uppercase tracking-widest">Local Save</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {currentUser === 'admin' && (
              <button 
                onClick={() => setActiveTab(activeTab === 'calendar' ? 'admin' : 'calendar')}
                className="text-[10px] bg-stone-50 hover:bg-stone-100 px-4 py-2 rounded-full font-black text-stone-600 border border-stone-200 transition-all active:scale-95 shadow-sm"
              >
                {activeTab === 'calendar' ? '관리 모드' : '달력 보기'}
              </button>
            )}
          </header>

          <main className="flex-1 overflow-hidden relative">
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
            <nav className="border-t border-stone-200 bg-white pb-6 grid grid-cols-3 h-16">
              <button onClick={() => setActiveTab('calendar')} className={`flex flex-col items-center justify-center space-y-1 ${activeTab === 'calendar' ? 'text-primary-600' : 'text-stone-400'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span className="text-[10px] font-medium">일정</span>
              </button>
              <button onClick={() => setActiveTab('habit')} className={`flex flex-col items-center justify-center space-y-1 ${activeTab === 'habit' ? 'text-primary-600' : 'text-stone-400'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-[10px] font-medium">습관 트래킹</span>
              </button>
              <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center justify-center space-y-1 ${activeTab === 'profile' ? 'text-primary-600' : 'text-stone-400'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <span className="text-[10px] font-medium">내 정보</span>
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
                    닫기
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
