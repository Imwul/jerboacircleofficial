
import React, { useState } from 'react';
import { User, Tier, TIER_COLORS } from '../../types';
import { resizeImage } from '../../utils/imageUtils';
import { HabitTrackingView } from './HabitTrackingView';
import { format, subDays } from 'date-fns';

interface AdminViewProps {
  users: User[];
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onAddUser: (user: User) => void;
  onExportAllData: () => void;
  onLogout: () => void;
  mainImage: string | null;
  onUpdateMainImage: (image: string | null) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ 
  users, onUpdateUser, onDeleteUser, onAddUser, onExportAllData, onLogout, mainImage, onUpdateMainImage 
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingHabitUser, setViewingHabitUser] = useState<User | null>(null);
  const [bulkEditDateModalOpen, setBulkEditDateModalOpen] = useState(false);
  const [bulkEndDate, setBulkEndDate] = useState('');

  const getTodayKey = () => {
    const now = new Date();
    if (now.getHours() < 2) {
      return format(subDays(now, 1), 'yyyy-MM-dd');
    }
    return format(now, 'yyyy-MM-dd');
  };

  const todayKey = getTodayKey();

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
            <button onClick={() => setViewingHabitUser(null)} className="p-2 hover:bg-stone-50 rounded-full text-stone-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-xl font-black text-stone-800">{latestUser.name}님의 습관 관리</h2>
          </div>
          <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest bg-stone-50 px-3 py-1 rounded-full">관리자 모드</span>
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
        <h2 className="text-xl font-black text-stone-800">관리자 모드</h2>
        <button onClick={onLogout} className="text-[10px] font-bold text-stone-400 hover:text-stone-600 uppercase">로그아웃</button>
      </div>

      <div className="flex bg-white border-b border-stone-100">
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-3 text-[10px] font-bold uppercase transition-all ${activeTab === 'users' ? 'text-stone-900 border-b-2 border-stone-900' : 'text-stone-400'}`}
        >
          멤버 관리
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-3 text-[10px] font-bold uppercase transition-all ${activeTab === 'settings' ? 'text-stone-900 border-b-2 border-stone-900' : 'text-stone-400'}`}
        >
          시스템 설정
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'users' ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-bold text-stone-400 uppercase ml-1">멤버 리스트 ({users.length})</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => setBulkEditDateModalOpen(true)}
                  className="text-[10px] bg-stone-100 text-stone-600 px-3 py-1 rounded-full font-bold hover:bg-stone-200 transition-colors"
                >
                  일괄 종료일 설정
                </button>
                <button 
                  onClick={() => setEditingUser({ id: Math.random().toString(36).substr(2, 9), name: '', tier: Tier.SILT, coins: 0, tierStartDate: new Date().toISOString(), tierDurationWeeks: 4, enrolledEventIds: [] })}
                  className="text-[10px] bg-stone-900 text-white px-3 py-1 rounded-full font-bold shadow-lg"
                >
                  + 멤버 추가
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {users.map(user => (
                <div key={user.id} className="bg-white p-5 rounded-3xl border border-stone-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-stone-50 overflow-hidden shadow-inner text-white leading-none" style={{ backgroundColor: user.avatarColor }}>
                      {user.profileImage ? (
                        <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        user.avatarIcon || '☻'
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="font-black text-stone-900 text-base">{user.name}</div>
                        {user.habitRecords?.[todayKey]?.status === 'success' && (
                          <div className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black border border-blue-200 rounded-md rotate-[-5deg] shadow-sm animate-in zoom-in-50 duration-300">
                            습관 달성!
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${TIER_COLORS[user.tier]}`}>{user.tier}</span>
                        <span className="text-[10px] text-stone-400 font-bold tracking-tight">{user.coins} <span className="text-[8px] opacity-60 uppercase">Coins</span></span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setViewingHabitUser(user)} className="p-2.5 hover:bg-stone-50 rounded-2xl text-stone-400 transition-colors" title="습관 관리">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                    <button onClick={() => setEditingUser(user)} className="p-2.5 hover:bg-stone-50 rounded-2xl text-stone-400 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button onClick={() => onDeleteUser(user.id)} className="p-2.5 hover:bg-red-50 rounded-2xl text-red-300 transition-colors">
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
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest ml-1">대문 이미지 설정</h3>
              <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm space-y-4">
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-32 h-32 rounded-3xl bg-stone-50 border-2 border-dashed border-stone-200 flex items-center justify-center overflow-hidden relative group">
                    {mainImage ? (
                      <>
                        <img src={mainImage} alt="Main" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => onUpdateMainImage(null)}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </>
                    ) : (
                      <div className="text-center space-y-1">
                        <svg className="w-8 h-8 text-stone-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">이미지 없음</span>
                      </div>
                    )}
                  </div>
                  <div className="relative w-full">
                    <button className="w-full py-3 bg-stone-100 text-stone-600 text-xs font-bold rounded-xl hover:bg-stone-200 transition-colors">
                      {mainImage ? '이미지 변경' : '이미지 업로드'}
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
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest ml-1">데이터 관리</h3>
              <div className="grid grid-cols-1 gap-2">
                <button onClick={onExportAllData} className="w-full p-4 bg-white border border-stone-100 rounded-2xl flex items-center justify-between group hover:bg-stone-50 transition-colors">
                  <div className="text-left">
                    <div className="font-bold text-stone-800">동기화 코드 생성</div>
                    <div className="text-[10px] text-stone-400 font-medium">모든 데이터를 클립보드에 복사합니다</div>
                  </div>
                  <svg className="w-5 h-5 text-stone-300 group-hover:text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                </button>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm">
              <div className="font-bold text-stone-800">서버 연결 없음</div>
              <div className="text-[10px] text-stone-400 font-medium mt-1">
                데이터는 이 브라우저에 바로 저장됩니다. 다른 기기로 옮길 때는 동기화 코드를 생성해 가져오세요.
              </div>
            </div>
          </div>
        )}
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-6 animate-in zoom-in-95 duration-300 shadow-2xl">
            <h3 className="text-lg font-black text-stone-900">멤버 정보 수정</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">이름</label>
                <input 
                  type="text" 
                  value={editingUser.name} 
                  onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                  className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-stone-200"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">티어</label>
                <div className="grid grid-cols-3 gap-2">
                  {[Tier.SILT, Tier.CREST, Tier.ERG].map(t => (
                    <button 
                      key={t}
                      onClick={() => setEditingUser({...editingUser, tier: t})}
                      className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${editingUser.tier === t ? TIER_COLORS[t] : 'bg-stone-50 text-stone-400 hover:bg-stone-100'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">보유 코인</label>
                <input 
                  type="number" 
                  value={editingUser.coins} 
                  onChange={e => setEditingUser({...editingUser, coins: parseInt(e.target.value) || 0})}
                  className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-stone-200"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">종료일</label>
                <input 
                  type="date" 
                  value={editingUser.tierEndDate || ''} 
                  onChange={e => setEditingUser({...editingUser, tierEndDate: e.target.value})}
                  className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-stone-200"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditingUser(null)} className="flex-1 py-3 bg-stone-100 text-stone-500 text-xs font-bold rounded-xl">취소</button>
              <button onClick={handleSaveUser} className="flex-1 py-3 bg-stone-900 text-white text-xs font-bold rounded-xl shadow-lg">저장하기</button>
            </div>
          </div>
        </div>
      )}
      {bulkEditDateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-6 animate-in zoom-in-95 duration-300 shadow-2xl">
            <h3 className="text-lg font-black text-stone-900">일괄 종료일 설정</h3>
            <p className="text-xs text-stone-500">모든 멤버의 멤버십 종료일을 동일하게 설정합니다.</p>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">일괄 종료일</label>
              <input 
                type="date" 
                value={bulkEndDate} 
                onChange={e => setBulkEndDate(e.target.value)}
                className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-sm font-bold outline-none focus:ring-1 focus:ring-stone-200"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setBulkEditDateModalOpen(false)} className="flex-1 py-3 bg-stone-100 text-stone-500 text-xs font-bold rounded-xl">취소</button>
              <button onClick={handleBulkEditSave} className="flex-1 py-3 bg-stone-900 text-white text-xs font-bold rounded-xl shadow-lg">일괄 적용</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
