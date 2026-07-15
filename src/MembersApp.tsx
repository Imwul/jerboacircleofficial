
import React, { useState, useEffect, useRef, Component } from 'react';
import { INITIAL_USERS, INITIAL_EVENTS } from './constants';
import { User, CalendarEvent, ThemeColor } from './types';
import { LoginView } from './components/views/LoginView';
import { CalendarView } from './components/views/CalendarView';
import { ProfileView } from './components/views/ProfileView';
import { AdminView } from './components/views/AdminView';
import { HabitTrackingView } from './components/views/HabitTrackingView';
import { EventFormModal, type EventRecurrence } from './components/modals/EventFormModal';
import { generateRecurringEvents } from './utils/dateUtils';
import { format, parseISO, setHours, setMinutes, addHours } from 'date-fns';
import { loadServerSync, saveServerSync, ServerSyncError } from './utils/serverSync';
import { usePageMetadata } from './utils/pageMetadata';
import { downloadLatestSyncRecovery, readSyncRecovery, writeSyncRecovery } from './utils/syncRecovery';
import { roleSessionToken } from './utils/roleAuth';
import { deriveParticipantJourney, stampParticipantActivity } from './utils/participantJourney';
import { trackProductEvent } from './utils/productAnalytics';
import { events as archiveRecords, getPublicArchiveEvents } from './data/events';
import ConnectivityNotice from './components/ui/ConnectivityNotice';
import ConfirmDialog from './components/ui/ConfirmDialog';
import { parseMembersImport, type MembersSyncPayload } from './utils/membersImport';
import { useDialogFocus } from './utils/useDialogFocus';
import { memberScribePlate } from './data/manuscriptPlates';
import './MembersArchive.css';
import './MembersStability.css';
import './MembersLayoutFinal.css';

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
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 text-2xl">!</div>
          <h1 className="text-xl font-black text-stone-900 mb-2">장부가 잠시 닫혔습니다</h1>
          <p className="text-sm text-stone-500 mb-6">데이터가 너무 크거나 일시적으로 열 수 없는 상태입니다.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-stone-900 text-white rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all"
            >
              다시 열기
            </button>
            <button
              onClick={() => {
                const entries = Object.fromEntries(
                  Object.keys(localStorage)
                    .filter((key) => key.startsWith('jerboa'))
                    .map((key) => [key, localStorage.getItem(key)]),
                );
                const url = URL.createObjectURL(new Blob([
                  JSON.stringify({ exportedAt: new Date().toISOString(), entries }, null, 2),
                ], { type: 'application/json' }));
                const link = document.createElement('a');
                link.href = url;
                link.download = `jerboa-emergency-backup-${new Date().toISOString().slice(0, 10)}.json`;
                link.click();
                URL.revokeObjectURL(url);
              }}
              className="px-6 py-3 bg-white text-stone-700 border border-stone-200 rounded-xl font-bold text-sm"
            >
              응급 백업 받기
            </button>
          </div>
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

type SyncTone = 'idle' | 'pending' | 'sealed' | 'local' | 'warning';

function syncToneFor(status: string): SyncTone {
  if (/실패|미연결|닫힘|닫혔|읽을 수|올바르지|잘못|가득|먼저|충돌|보류/.test(status)) return 'warning';
  if (/로컬|초안|보관 중/.test(status)) return 'local';
  if (/봉인 중|여는 중|생성 중|연결 대기|기다리는 중/.test(status)) return 'pending';
  if (/봉인됨|열람됨|생성됨|완료|적용/.test(status)) return 'sealed';
  return 'idle';
}

function syncTitleFor(tone: SyncTone, status: string) {
  if (tone === 'warning') return '장부가 잠시 닫혔습니다';
  if (tone === 'local') return '로컬 초안 보관 중';
  if (tone === 'pending' && status.includes('봉인 중')) return '공동 장부에 봉인 중';
  if (tone === 'pending' && status.includes('여는 중')) return '공동 장부 여는 중';
  if (tone === 'pending') return '공동 장부 연결 중';
  if (tone === 'sealed' && status.includes('열람')) return '공동 장부 열람됨';
  if (tone === 'sealed') return '공동 장부에 봉인됨';
  return '공동 장부 대기';
}

function RegisterSyncStatus({ status, compact = false }: { status: string; compact?: boolean }) {
  const tone = syncToneFor(status);

  return (
    <div className={`archive-sync-ledger${compact ? ' is-compact' : ''}`} data-sync-state={tone}>
      <span lang="en">Colophon</span>
      <strong lang="ko">{syncTitleFor(tone, status)}</strong>
      <small lang="ko">{status}</small>
    </div>
  );
}

function App() {
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
  const [notice, setNotice] = useState<string | null>(null);
  const [serverSyncStatus, setServerSyncStatus] = useState('공동 장부 연결을 기다리는 중');
  const [hasServerConflict, setHasServerConflict] = useState(false);
  const [hasMemberRecovery, setHasMemberRecovery] = useState(() => Boolean(readSyncRecovery<MembersSyncPayload>('members')));
  const [pendingMembersImport, setPendingMembersImport] = useState<{ data: MembersSyncPayload; source: 'code' | 'file' } | null>(null);
  const [memberSyncKey, setMemberSyncKey] = useState(() => {
    const legacyKey = localStorage.getItem('jerboa_members_sync_key')
      || localStorage.getItem('jerboa_keeper_sync_key')
      || '';
    const sessionKey = sessionStorage.getItem('jerboa_members_sync_key') || legacyKey;
    localStorage.removeItem('jerboa_members_sync_key');
    localStorage.removeItem('jerboa_keeper_sync_key');
    if (sessionKey) sessionStorage.setItem('jerboa_members_sync_key', sessionKey);
    return sessionKey;
  });
  const hasServerHydrated = useRef(false);
  const localNoticeArmed = useRef(false);
  const skipNextLocalNotice = useRef(false);
  const serverSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverSavedAt = useRef<string | null>(null);
  
  const [clipboard, setClipboard] = useState<CalendarEvent | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedDateForNewEvent, setSelectedDateForNewEvent] = useState<Date>(new Date());
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const createMembersSyncPayload = (): MembersSyncPayload => ({
    schemaVersion: 1,
    users,
    events,
    themeNames,
    mainImage,
  });

  const captureMembersRecovery = (reason: string, remoteSavedAt?: string | null) => {
    writeSyncRecovery('members', createMembersSyncPayload(), {
      baseSavedAt: serverSavedAt.current,
      remoteSavedAt,
      reason,
    });
    setHasMemberRecovery(true);
  };

  const applyMembersSyncPayload = (payload: Partial<MembersSyncPayload>) => {
    if (payload.users) setUsers(payload.users);
    if (payload.events) setEvents(payload.events);
    if (payload.themeNames) setThemeNames({ ...DEFAULT_THEME_NAMES, ...payload.themeNames });
    setMainImage(payload.mainImage || null);
  };

  const updateMemberSyncKey = (value: string) => {
    setMemberSyncKey(value);
    if (value) sessionStorage.setItem('jerboa_members_sync_key', value);
    else sessionStorage.removeItem('jerboa_members_sync_key');
  };

  const saveMembersToServer = async (source = '자동 저장') => {
    const authSession = roleSessionToken('member-admin');
    if (!memberSyncKey.trim() && !authSession) {
      setServerSyncStatus('공동 장부 열쇠 없음 / 로컬 장부 보관 중');
      return false;
    }

    try {
      setServerSyncStatus(`${source} / 공동 장부에 봉인 중`);
      const result = await saveServerSync('members', createMembersSyncPayload(), memberSyncKey, {
        baseSavedAt: serverSavedAt.current,
        authSession,
      });
      serverSavedAt.current = result.savedAt || serverSavedAt.current;
      setServerSyncStatus(`공동 장부에 봉인됨 / ${format(new Date(result.savedAt || new Date()), 'HH:mm:ss')}`);
      return true;
    } catch (error) {
      if (error instanceof ServerSyncError && error.message === 'sync_conflict') {
        captureMembersRecovery('member_sync_conflict', error.savedAt);
        serverSavedAt.current = error.savedAt || serverSavedAt.current;
        setHasServerConflict(true);
        setServerSyncStatus('공동 장부가 먼저 바뀌었습니다 / 열람 후 다시 봉인');
        return false;
      }
      setServerSyncStatus('공동 장부가 잠시 닫혔습니다 / 로컬 초안 보관 중');
      if (!(error instanceof Error) || error.message !== 'sync_unavailable') {
        console.error('Server save failed:', error);
      }
      return false;
    }
  };

  const loadMembersFromServer = async () => {
    const authSession = roleSessionToken('member-admin');
    if (!memberSyncKey.trim() && !authSession) {
      setServerSyncStatus('공동 장부 열쇠 없음 / 로컬 장부로 시작');
      hasServerHydrated.current = true;
      localNoticeArmed.current = true;
      return;
    }

    try {
      setServerSyncStatus('공동 장부 여는 중');
      const result = await loadServerSync<MembersSyncPayload>('members', memberSyncKey, { authSession });
      setHasServerConflict(false);

      if (result.exists && result.saved?.data) {
        skipNextLocalNotice.current = true;
        applyMembersSyncPayload(result.saved.data);
        serverSavedAt.current = result.saved.savedAt;
        setServerSyncStatus(`공동 장부 열람됨 / ${format(new Date(result.saved.savedAt), 'HH:mm:ss')}`);
      } else {
        setServerSyncStatus('공동 장부 없음 / 새 장부 생성 중');
        const created = await saveServerSync('members', createMembersSyncPayload(), memberSyncKey, { authSession });
        serverSavedAt.current = created.savedAt || null;
        setServerSyncStatus('공동 장부 생성됨 / 첫 판본 봉인됨');
      }
    } catch (error) {
      setServerSyncStatus('공동 장부가 잠시 닫혔습니다 / 로컬 초안 보관 중');
      if (!(error instanceof Error) || error.message !== 'sync_unavailable') {
        console.error('Server load failed:', error);
      }
    } finally {
      hasServerHydrated.current = true;
      localNoticeArmed.current = true;
    }
  };

  useEffect(() => {
    void loadMembersFromServer();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentUser, activeTab]);

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
        setNotice('로컬 장부가 가득 찼습니다. 사진 크기를 줄이거나 오래된 데이터를 정리해주세요.');
      }
    }
    if (!localNoticeArmed.current) return;
    if (skipNextLocalNotice.current) {
      skipNextLocalNotice.current = false;
      return;
    }
    triggerSaveNotification();
  }, [users, events, themeNames, mainImage, memberSyncKey]);

  useEffect(() => {
    if (!hasServerHydrated.current) return;
    if (hasServerConflict) return;
    if (serverSaveTimer.current) clearTimeout(serverSaveTimer.current);

    serverSaveTimer.current = setTimeout(() => {
      void saveMembersToServer();
    }, 900);

    return () => {
      if (serverSaveTimer.current) clearTimeout(serverSaveTimer.current);
    };
  }, [users, events, themeNames, mainImage, hasServerConflict]);

  useEffect(() => {
    if (lastSaved) {
      const timer = setTimeout(() => setLastSaved(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastSaved]);

  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(null), 4200);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  const triggerSaveNotification = () => {
    setLastSaved(format(new Date(), 'HH:mm:ss'));
  };

  const [syncCodeToDisplay, setSyncCodeToDisplay] = useState<string | null>(null);
  const syncCodeDialogRef = useDialogFocus<HTMLDivElement>(Boolean(syncCodeToDisplay), () => setSyncCodeToDisplay(null));

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
      
      const data = parseMembersImport(JSON.parse(decodedData));
      setPendingMembersImport({ data, source: 'code' });
      setNotice(`장부 코드 검증됨 / 회원 ${data.users.length}명 · 프로그램 ${data.events.length}개`);
      return true;
    } catch (err) { 
      console.error("Import error:", err);
      setNotice(err instanceof Error ? `장부 코드 적용 보류 / ${err.message}` : '잘못된 장부 코드입니다. 코드를 다시 확인해주세요.');
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
      if (file.size > 12_000_000) throw new Error('파일이 12MB를 넘어 안전하게 확인할 수 없습니다.');
      const raw = await file.text();
      const data = parseMembersImport(JSON.parse(raw));
      setPendingMembersImport({ data, source: 'file' });
      setNotice(`백업 파일 검증됨 / 회원 ${data.users.length}명 · 프로그램 ${data.events.length}개`);
      return true;
    } catch (error) {
      console.error('File import failed:', error);
      setNotice(error instanceof Error ? `백업 파일 적용 보류 / ${error.message}` : '백업 파일을 읽을 수 없습니다.');
    }
    return false;
  };

  const confirmMembersImport = async () => {
    if (!pendingMembersImport) return;
    const pending = pendingMembersImport;
    setPendingMembersImport(null);
    applyMembersSyncPayload(pending.data);
    setNotice('검증된 비공개 장부를 이 기기에 적용했습니다.');
    try {
      const result = await saveServerSync('members', pending.data, memberSyncKey, {
        baseSavedAt: serverSavedAt.current,
        authSession: roleSessionToken('member-admin'),
      });
      serverSavedAt.current = result.savedAt || serverSavedAt.current;
      setServerSyncStatus(`${pending.source === 'file' ? '백업 파일' : '장부 코드'} 적용 / 공동 장부에 봉인됨`);
    } catch (error) {
      if (error instanceof ServerSyncError && error.message === 'sync_conflict') {
        writeSyncRecovery('members', pending.data, {
          reason: 'member_import_conflict',
          baseSavedAt: serverSavedAt.current,
          remoteSavedAt: error.savedAt,
        });
        setHasMemberRecovery(true);
        serverSavedAt.current = error.savedAt || serverSavedAt.current;
        setHasServerConflict(true);
        setServerSyncStatus('가져온 장부는 로컬에 보관됨 / 공동 장부 열람 후 다시 봉인');
        return;
      }
      console.error('Import server save failed:', error);
      setServerSyncStatus('가져온 장부는 로컬에 보관됨 / 공동 장부 봉인 실패');
    }
  };

  const handleUserLogin = (user: User) => {
    const latestUser = users.find(u => u.id === user.id) || user;
    const activeUser = stampParticipantActivity(latestUser);
    setUsers(prev => prev.map(u => u.id === activeUser.id ? activeUser : u));
    setCurrentUser(activeUser);
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
    setUsers(prev => prev.map(u => (
      u.id === activeUserData.id
        ? stampParticipantActivity({ ...u, ...updates })
        : u
    )));
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

  const handleEventSubmit = (eventData: Partial<CalendarEvent>, recurrence?: EventRecurrence) => {
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
      maxParticipants: eventData.maxParticipants,
      archiveRecordId: eventData.archiveRecordId,
    };

    if (editingEvent) {
      setEvents(prev => prev.map(ev => ev.id === editingEvent.id ? baseEvent : ev));
    } else {
      if (recurrence) {
        const newEvents = generateRecurringEvents(baseEvent, { 
          type: recurrence.type, 
          value: recurrence.value,
          daysOfWeek: recurrence.daysOfWeek
        });
        if (newEvents.length === 0) {
          setNotice('반복 일정 조건을 확인해주세요.');
          return;
        }
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
      setNotice('이 장은 이미 정원이 찼습니다.'); return;
    }
    if (!event.isReward && activeUserData.coins < event.cost) {
      setNotice('이 장에 들어가기 위한 문장이 부족합니다.'); return;
    }
    const updatedUser = {
      ...stampParticipantActivity(activeUserData),
      coins: event.isReward ? activeUserData.coins + event.cost : activeUserData.coins - event.cost,
      enrolledEventIds: [...activeUserData.enrolledEventIds, event.id]
    };
    trackProductEvent('member_event_join', {
      eventId: event.id,
      theme: event.theme,
      isReward: event.isReward,
      cost: event.cost,
      participantStage: deriveParticipantJourney(activeUserData).stage,
    });
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  const cancelEvent = (event: CalendarEvent) => {
    if (!activeUserData) return;
    const updatedUser = {
      ...stampParticipantActivity(activeUserData),
      coins: event.isReward ? activeUserData.coins - event.cost : activeUserData.coins + event.cost,
      enrolledEventIds: activeUserData.enrolledEventIds.filter(id => id !== event.id)
    };
    trackProductEvent('member_event_cancel', {
      eventId: event.id,
      theme: event.theme,
      isReward: event.isReward,
      cost: event.cost,
      participantStage: deriveParticipantJourney(activeUserData).stage,
    });
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  const todayKeyForArchive = format(new Date(), 'yyyy-MM-dd');
  const nextMemberProgramme = activeUserData
    ? events
      .filter((event) => activeUserData.enrolledEventIds.includes(event.id) && parseISO(event.endDate || event.date).getTime() >= Date.now())
      .sort((a, b) => a.date.localeCompare(b.date))[0]
    : undefined;
  const todayReflectionComplete = activeUserData?.habitRecords?.[todayKeyForArchive]?.status === 'success';
  const completedToday = users.filter(user => user.habitRecords?.[todayKeyForArchive]?.status === 'success').length;
  const totalEnrollments = users.reduce((sum, user) => sum + user.enrolledEventIds.length, 0);
  const journeySummaries = users.map((user) => deriveParticipantJourney(user));
  const activeParticipants = journeySummaries.filter((summary) => summary.stage === 'active' || summary.stage === 'returning').length;
  const lapsedParticipants = journeySummaries.filter((summary) => summary.stage === 'lapsed').length;
  const archiveSectionTitle = !currentUser
    ? 'Antecamera'
    : currentUser === 'admin'
      ? activeTab === 'admin' ? 'Keeper Desk' : 'Itinerary'
      : activeTab === 'habit' ? 'Marginalia' : activeTab === 'profile' ? 'Folio' : 'Itinerary';
  const archiveSectionNote = !currentUser
    ? '이름을 선택하면 개인 장부와 프로그램 기록으로 들어갑니다.'
    : currentUser === 'admin'
      ? '프로그램 일정, 회원 기록, 공동 장부, 백업 파일을 정돈하는 보관자 책상입니다.'
      : '참여할 장을 확인하고, 오늘의 주석과 개인 기록을 남기는 비공개 장부입니다.';

  usePageMetadata({
    title: `${archiveSectionTitle} | Jerboa Circle Private Room`,
    description: archiveSectionNote,
    canonicalPath: '/members/',
    noIndex: true,
  });

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
          {currentUser ? (
            <nav className="archive-cabinet" aria-label="Private room sequence">
              <button className={activeTab === 'calendar' ? 'is-active' : ''} onClick={() => setActiveTab('calendar')}>
                <span lang="en">Itinerary</span>
                <small lang="ko">열린 장 {events.length}개</small>
              </button>
              {currentUser !== 'admin' && (
                <button className={activeTab === 'habit' ? 'is-active' : ''} onClick={() => setActiveTab('habit')}>
                  <span lang="en">Marginalia</span>
                  <small lang="ko">오늘의 주석 {completedToday}개</small>
                </button>
              )}
              {currentUser !== 'admin' && (
                <button className={activeTab === 'profile' ? 'is-active' : ''} onClick={() => setActiveTab('profile')}>
                  <span lang="en">Folio</span>
                  <small lang="ko">개인 장부</small>
                </button>
              )}
              {currentUser === 'admin' && (
                <button className={activeTab === 'admin' ? 'is-active' : ''} onClick={() => setActiveTab('admin')}>
                  <span lang="en">Keeper Desk</span>
                  <small lang="ko">보관자 필사실</small>
                </button>
              )}
            </nav>
          ) : (
            <div className="archive-cabinet-note">
              <span lang="en">Choose a register</span>
              <small lang="ko">이름을 선택하면 개인 장부가 열립니다</small>
            </div>
          )}
          <a className="archive-godmode-link" href="/godmode/">
            <span lang="en"><i aria-hidden="true">⚜</i> Keeper Desk</span>
            <small lang="ko">보관자 문구실</small>
          </a>
          <figure className="archive-source-plate">
            <img src={memberScribePlate.src} alt={memberScribePlate.alt} loading="lazy" decoding="async" />
            <figcaption>
              <a href={memberScribePlate.sourceUrl} target="_blank" rel="noreferrer">
                <span lang="en">St Luke, c. 1275–1325</span>
                <small>{memberScribePlate.repository} · {memberScribePlate.rights}</small>
              </a>
            </figcaption>
          </figure>
        </aside>

        <div className="archive-workbench">
          <ConnectivityNotice context="비공개 장부" />
          {lastSaved && (
            <div className="archive-save-notice">
              로컬 초안 보관 중 / {lastSaved}
            </div>
          )}
          {notice && (
            <div className="archive-notice" role="status" lang="ko">
              {notice}
            </div>
          )}
          {hasServerConflict && (
            <div className="archive-notice archive-notice--sync-conflict" role="alert" lang="ko">
              <span>공동 장부가 다른 곳에서 먼저 바뀌어 자동 저장을 잠시 멈췄습니다.</span>
              {hasMemberRecovery && (
                <button type="button" onClick={() => downloadLatestSyncRecovery('members')}>로컬 복구 파일 받기</button>
              )}
              <button type="button" onClick={loadMembersFromServer}>공동 장부 다시 열기</button>
            </div>
          )}
          
          <header className="archive-topbar">
            <div className="archive-topbar-copy">
              <p lang="en">Jerboa Circle / private room</p>
              <h1 lang="en">{archiveSectionTitle}</h1>
              <span lang="ko">{archiveSectionNote}</span>
              <RegisterSyncStatus status={serverSyncStatus} />
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

          {currentUser && (
            <section className="archive-context" aria-label="Archive summary">
              <div>
                <span lang="en">Programme folios</span>
                <small lang="ko">등록된 장</small>
                <strong>{events.length}</strong>
              </div>
              <div>
                <span lang="en">Filed attendances</span>
                <small lang="ko">기록된 신청</small>
                <strong>{totalEnrollments}</strong>
              </div>
              <div>
                <span lang="en">Reader folios</span>
                <small lang="ko">활동/복귀 중</small>
                <strong>{activeParticipants}</strong>
              </div>
              <div>
                <span lang="en">Marks today</span>
                <small lang="ko">{lapsedParticipants > 0 ? `쉬는 중 ${lapsedParticipants}명` : '오늘 주석을 남긴 회원'}</small>
                <strong>{completedToday}</strong>
              </div>
            </section>
          )}

          {activeUserData && (
            <section className="member-next-actions" aria-labelledby="member-next-actions-title">
              <div>
                <span lang="en">Next folio</span>
                <h2 id="member-next-actions-title" lang="ko">지금 이어서 할 일</h2>
              </div>
              <article>
                <small lang="ko">다음 참여 프로그램</small>
                {nextMemberProgramme ? (
                  <>
                    <strong>{nextMemberProgramme.title}</strong>
                    <span lang="ko">{format(parseISO(nextMemberProgramme.date), 'M월 d일 HH:mm')}</span>
                    <button type="button" onClick={() => setActiveTab('calendar')}><span lang="ko">일정에서 열기</span></button>
                  </>
                ) : (
                  <>
                    <strong lang="ko">신청한 다음 프로그램이 없습니다.</strong>
                    <button type="button" onClick={() => setActiveTab('calendar')}><span lang="ko">열린 장 살펴보기</span></button>
                  </>
                )}
              </article>
              <article>
                <small lang="ko">오늘의 개인 기록</small>
                <strong lang="ko">{todayReflectionComplete ? '오늘의 주석을 남겼습니다.' : '아직 끝내지 않은 주석이 있습니다.'}</strong>
                <button type="button" onClick={() => setActiveTab('habit')}><span lang="ko">{todayReflectionComplete ? '기록 다시 보기' : '이어서 기록하기'}</span></button>
              </article>
            </section>
          )}

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
                />
              ) : (
                <AdminView 
                  users={users} 
                  events={events}
                  onUpdateUser={(user) => setUsers(prev => prev.map(u => u.id === user.id ? user : u))}
                  onAddUser={(user) => setUsers(prev => [...prev, user])}
                  onDeleteUser={handleDeleteUser}
                  onExportAllData={handleExportAllData} 
                  onDownloadAllData={handleDownloadAllData}
                  onImportAllDataFile={handleImportAllDataFile}
                  onSaveServerData={() => saveMembersToServer('수동 공동 장부 봉인')}
                  onLoadServerData={loadMembersFromServer}
                  serverSyncStatus={serverSyncStatus}
                  syncKey={memberSyncKey}
                  onSyncKeyChange={updateMemberSyncKey}
                  onLogout={handleLogout} 
                  mainImage={mainImage}
                  onUpdateMainImage={setMainImage}
                />
              )
            ) : activeTab === 'calendar' ? (
              <CalendarView events={events} user={activeUserData} users={users} onJoinEvent={joinEvent} onCancelEvent={cancelEvent} isAdmin={false} />
            ) : activeTab === 'habit' ? (
              <HabitTrackingView 
                user={activeUserData!} 
                onUpdateUser={handleUpdateUser} 
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
            <nav className="archive-mobile-tabs" aria-label="Mobile private room navigation">
              <button aria-current={activeTab === 'calendar' ? 'page' : undefined} onClick={() => setActiveTab('calendar')} className={activeTab === 'calendar' ? 'is-active' : ''}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span lang="ko">여정함</span>
              </button>
              <button aria-current={activeTab === 'habit' ? 'page' : undefined} onClick={() => setActiveTab('habit')} className={activeTab === 'habit' ? 'is-active' : ''}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span lang="ko">주석</span>
              </button>
              <button aria-current={activeTab === 'profile' ? 'page' : undefined} onClick={() => setActiveTab('profile')} className={activeTab === 'profile' ? 'is-active' : ''}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <span lang="ko">표지</span>
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
            archiveRecords={getPublicArchiveEvents(archiveRecords).map(({ id, title, edition }) => ({ id, title, edition }))}
          />
          <ConfirmDialog
            open={Boolean(pendingMembersImport)}
            title="검증된 비공개 장부를 적용할까요?"
            description={pendingMembersImport
              ? `회원 ${pendingMembersImport.data.users.length}명과 프로그램 ${pendingMembersImport.data.events.length}개를 확인했습니다. 현재 이 기기의 회원·일정·개인 기록은 가져온 장부로 교체됩니다.`
              : ''}
            confirmLabel="검증된 장부 적용"
            onCancel={() => setPendingMembersImport(null)}
            onConfirm={() => { void confirmMembersImport(); }}
          />
          {syncCodeToDisplay && (
            <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-labelledby="sync-code-title">
              <div ref={syncCodeDialogRef} className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                <div className="p-6 space-y-4">
                  <h2 id="sync-code-title" className="text-xl font-black text-stone-900">동기화 코드</h2>
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
                    aria-label="동기화 코드 닫기"
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
