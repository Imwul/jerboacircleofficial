
import React, { useState } from 'react';
import { User } from '../../types';
import { format, subDays } from 'date-fns';

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

  const getTodayKey = () => {
    const now = new Date();
    if (now.getHours() < 2) {
      return format(subDays(now, 1), 'yyyy-MM-dd');
    }
    return format(now, 'yyyy-MM-dd');
  };

  const todayKey = getTodayKey();

  const handleAdminLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === '8888') {
      onAdminLogin();
      setShowAdminModal(false);
      setAdminPassword('');
      setAdminError('');
    } else {
      setAdminError('비밀번호가 일치하지 않습니다.');
    }
  };

  return (
    <div className="member-login flex flex-col items-center justify-center min-h-full p-6 space-y-8 bg-white relative">
      <div className="flex flex-col items-center space-y-4 text-center">
        {mainImage && (
          <div className="archive-frontispiece-image animate-in zoom-in duration-500">
            <img src={mainImage} alt="Jerboa Circle" />
          </div>
        )}
        <div className="space-y-1">
          <p className="italic text-stone-400 text-sm font-medium"><span lang="en">Antecamera</span> / <span lang="ko">회원 입장 화면</span></p>
          <h1 className="text-4xl font-black text-stone-900" lang="en">
            Reader folios
          </h1>
        </div>
      </div>

      <div className="w-full space-y-4">
        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] font-black text-stone-400" lang="ko">회원 이름을 선택하면 개인 장부로 들어갑니다 / {users.length}명</p>
          <div className="h-px flex-1 bg-stone-100 ml-4" />
        </div>
        <div className="grid grid-cols-1 gap-3">
          {users.map(user => (
            <button
              key={user.id}
              onClick={() => onUserLogin(user)}
              className="member-record-row p-5 bg-white hover:bg-stone-50 border border-stone-100 rounded-[2rem] transition-all active:scale-[0.97] group shadow-sm hover:shadow-md"
            >
              <div 
                className="member-seal"
                style={{ '--seal-color': user.avatarColor || '#ef3528' } as React.CSSProperties}
              >
                {user.profileImage ? (
                  <img src={user.profileImage} alt={user.name} />
                ) : (
                  <span className="member-seal__initial">{user.name.slice(0, 1)}</span>
                )}
              </div>
              <div className="record-title text-left space-y-0.5">
                <div className="flex items-center gap-2">
                  <div className="font-black text-stone-900 text-base">{user.name}</div>
                  {user.habitRecords?.[todayKey]?.status === 'success' && (
                    <div className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black border border-blue-200 rounded-md rotate-[-5deg] shadow-sm animate-in zoom-in-50 duration-300">
                      수련 완료
                    </div>
                  )}
                </div>
                <div className="record-meta text-[9px] text-stone-400 font-black" lang="ko">{user.tier} / 개인 기록과 신청 내역</div>
              </div>
              <div className="record-arrow w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center text-stone-300 group-hover:text-stone-900 group-hover:bg-white transition-all shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>
          ))}
        </div>
      </div>

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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-6 animate-in zoom-in-95 duration-300 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-stone-900">보관자 입장</h3>
              <button onClick={() => { setShowAdminModal(false); setAdminError(''); setAdminPassword(''); }} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors">
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
              <button type="submit" className="w-full py-3 bg-stone-900 text-white text-xs font-bold rounded-xl shadow-lg active:scale-95 transition-all">
                <span className="archive-ko-label">보관자 책상 열기</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
