
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
    <div className="flex flex-col items-center justify-center min-h-full p-6 space-y-8 bg-white relative">
      <div className="flex flex-col items-center space-y-4 text-center">
        {mainImage && (
          <div className="w-32 h-32 rounded-3xl overflow-hidden shadow-2xl border-4 border-white ring-1 ring-stone-100 mb-2 animate-in zoom-in duration-500">
            <img src={mainImage} alt="Club Main" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="space-y-1">
          <p className="italic text-stone-400 text-sm font-medium">everyone is welcomed at the...</p>
          <h1 className="text-4xl font-black text-stone-900">
            Jerboa<span className="text-primary-600">Circle</span>
          </h1>
        </div>
      </div>

      <div className="w-full space-y-4">
        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] font-black text-stone-400 uppercase">멤버 선택</p>
          <div className="h-px flex-1 bg-stone-100 ml-4" />
        </div>
        <div className="grid grid-cols-1 gap-3">
          {users.map(user => (
            <button
              key={user.id}
              onClick={() => onUserLogin(user)}
              className="flex items-center gap-4 p-5 bg-white hover:bg-stone-50 border border-stone-100 rounded-[2rem] transition-all active:scale-[0.97] group shadow-sm hover:shadow-md"
            >
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner overflow-hidden ring-4 ring-stone-50 text-white leading-none"
                style={{ backgroundColor: user.avatarColor || '#e5e5e5' }}
              >
                {user.profileImage ? (
                  <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.avatarIcon || '☻'
                )}
              </div>
              <div className="flex-1 text-left space-y-0.5">
                <div className="flex items-center gap-2">
                  <div className="font-black text-stone-900 text-base">{user.name}</div>
                  {user.habitRecords?.[todayKey]?.status === 'success' && (
                    <div className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black border border-blue-200 rounded-md rotate-[-5deg] shadow-sm animate-in zoom-in-50 duration-300">
                      습관 달성!
                    </div>
                  )}
                </div>
                <div className="text-[9px] text-stone-400 font-black uppercase">{user.tier} Tier</div>
              </div>
              <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center text-stone-300 group-hover:text-stone-900 group-hover:bg-white transition-all shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="w-full pt-8 border-t border-stone-100 space-y-4">
        <button 
          onClick={() => setShowAdminModal(true)}
          className="w-full py-3 text-stone-400 hover:text-stone-600 text-xs font-bold uppercase tracking-widest transition-colors"
        >
          관리자 로그인
        </button>

        <div className="flex flex-col items-center gap-2">
          <button 
            onClick={() => setShowImport(!showImport)}
            className="text-[10px] text-stone-300 hover:text-stone-500 underline underline-offset-4"
          >
            {showImport ? '가져오기 닫기' : '동기화 코드로 데이터 가져오기'}
          </button>
          
          {showImport && (
            <div className="w-full space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <textarea
                value={importCode}
                onChange={(e) => setImportCode(e.target.value)}
                placeholder="여기에 코드를 붙여넣으세요"
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
                데이터 불러오기
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-8 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">
          Local Save Ready
        </span>
      </div>

      {showAdminModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-6 animate-in zoom-in-95 duration-300 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-stone-900">관리자 로그인</h3>
              <button onClick={() => { setShowAdminModal(false); setAdminError(''); setAdminPassword(''); }} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">비밀번호</label>
                <input 
                  type="password" 
                  value={adminPassword} 
                  onChange={e => setAdminPassword(e.target.value)}
                  className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-stone-200"
                  placeholder="비밀번호를 입력하세요"
                  autoFocus
                />
                {adminError && <p className="text-xs text-red-500 font-bold">{adminError}</p>}
              </div>
              <button type="submit" className="w-full py-3 bg-stone-900 text-white text-xs font-bold rounded-xl shadow-lg active:scale-95 transition-all">
                로그인
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
