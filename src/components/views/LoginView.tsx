
import React, { useState } from 'react';
import { User } from '../../types';
import { format, subDays } from 'date-fns';
import { privateArchivePlate } from '../../data/manuscriptPlates';
import { authenticateRole } from '../../utils/roleAuth';
import { deriveParticipantJourney } from '../../utils/participantJourney';

interface LoginViewProps {
  users: User[];
  onUserLogin: (user: User) => void;
  onAdminLogin: () => void;
  onImportData: (code: string) => boolean;
  mainImage: string | null;
}

export const LoginView: React.FC<LoginViewProps> = ({ users, onUserLogin, onAdminLogin, onImportData, mainImage }) => {
  const [importCode, setImportCode] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [isAdminChecking, setIsAdminChecking] = useState(false);

  const getTodayKey = () => {
    const now = new Date();
    if (now.getHours() < 2) {
      return format(subDays(now, 1), 'yyyy-MM-dd');
    }
    return format(now, 'yyyy-MM-dd');
  };

  const todayKey = getTodayKey();
  const entryImage = mainImage || privateArchivePlate;

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setIsAdminChecking(true);

    try {
      await authenticateRole('member-admin', adminPassword);
      onAdminLogin();
      setShowAdminModal(false);
      setAdminPassword('');
    } catch (error) {
      setAdminError(error instanceof Error && error.message === 'role_auth_not_configured'
        ? '서버에 보관자 역할 열쇠가 아직 설정되지 않았습니다.'
        : '보관자 역할 열쇠가 일치하지 않습니다.');
    } finally {
      setIsAdminChecking(false);
    }
  };

  return (
    <div className="member-login">
      <section className="member-login-hero" aria-labelledby="member-login-title">
        <div className="member-login-title">
          <h1 id="member-login-title" lang="en">
            Reader folios
          </h1>
        </div>
        <figure className="member-login-manuscript">
          <img src={entryImage} alt="" aria-hidden="true" />
        </figure>
        <div className="member-login-intent">
          <p lang="ko"><span lang="ko">이름을 선택해 열린 장과 자신의 기록으로 들어갑니다.</span></p>
        </div>
      </section>

      <section className="member-records" aria-labelledby="member-records-title">
        <header className="member-records-header">
          <h2 id="member-records-title" lang="ko">참여자 장부</h2>
          <strong>{String(users.length).padStart(2, '0')}</strong>
          <p lang="ko">이름을 열면 최근 흔적과 다음 장이 이어집니다.</p>
        </header>
        <div className="member-record-list">
          {users.map((user, index) => {
            const journey = deriveParticipantJourney(user);
            const completedToday = user.habitRecords?.[todayKey]?.status === 'success';

            return (
              <button
                key={user.id}
                onClick={() => onUserLogin(user)}
                className="member-record-row"
              >
                <span className="member-record-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
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
                <div className="record-title">
                  <strong>{user.name}</strong>
                  <span lang="ko">{journey.label}</span>
                </div>
                <p className="record-meta" lang="ko">
                  <span>{user.tier}</span>
                  <span>{journey.note}</span>
                </p>
                <span className="member-record-mark" data-complete={completedToday ? 'true' : 'false'} lang="ko">
                  <i aria-hidden="true">{completedToday ? '✦' : '✧'}</i>
                  {completedToday ? '오늘의 흔적 있음' : '다음 흔적을 기다림'}
                </span>
                <div className="record-arrow" aria-hidden="true">
                  <span>→</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="member-login-actions">
        <button 
          onClick={() => setShowAdminModal(true)}
          className="w-full py-3 text-stone-400 hover:text-stone-600 text-xs font-bold tracking-widest transition-colors"
        >
          <span className="archive-ko-label">보관자 입장</span>
        </button>

        <div className="member-login-import">
          <button 
            onClick={() => setShowImport(!showImport)}
            className="text-[10px] text-stone-300 hover:text-stone-500 underline underline-offset-4"
          >
            <span className="archive-ko-label">{showImport ? '가져오기 닫기' : '장부 코드 가져오기'}</span>
          </button>
          
          {showImport && (
            <div className="w-full space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <textarea
                value={importCode}
                onChange={(e) => setImportCode(e.target.value)}
                placeholder="장부 코드를 붙여넣으세요"
                className="w-full p-3 text-[10px] font-mono bg-stone-50 border border-stone-200 rounded-xl h-24 focus:ring-1 focus:ring-stone-300 outline-none"
              />
              <button
                onClick={() => {
                  if (onImportData(importCode)) {
                    setImportCode('');
                    setShowImport(false);
                  }
                }}
                className="w-full py-2 bg-stone-800 text-white text-xs font-bold rounded-xl hover:bg-stone-900 transition-colors"
              >
                <span className="archive-ko-label">장부 불러오기</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {showAdminModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="admin-login-title">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-6 animate-in zoom-in-95 duration-300 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 id="admin-login-title" className="text-lg font-black text-stone-900">보관자 입장</h3>
              <button aria-label="보관자 입장 닫기" onClick={() => { setShowAdminModal(false); setAdminError(''); setAdminPassword(''); }} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 tracking-widest">장부 열쇠</label>
                <input 
                  type="password" 
                  value={adminPassword} 
                  onChange={e => setAdminPassword(e.target.value)}
                  className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-stone-200"
                  placeholder="장부 열쇠를 입력하세요"
                  autoFocus
                />
                {adminError && <p className="text-xs text-red-500 font-bold">{adminError}</p>}
              </div>
              <button type="submit" disabled={isAdminChecking} className="w-full py-3 bg-stone-900 text-white text-xs font-bold rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50">
                <span className="archive-ko-label">{isAdminChecking ? '역할 확인 중' : '보관자 책상 열기'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
