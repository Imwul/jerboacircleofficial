
import React, { useState } from 'react';
import { User, Tier, TIER_COLORS, AVATAR_ICONS, AVATAR_COLORS } from '../../types';
import { differenceInDays, parseISO, addWeeks, startOfDay } from 'date-fns';
import { resizeImage } from '../../utils/imageUtils';

interface ProfileViewProps {
  user: User;
  onUpdateUser: (user: User) => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ user, onUpdateUser, onLogout, onDeleteAccount }) => {
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);

  const getRemainingDays = () => {
    const today = startOfDay(new Date());
    let endDate: Date;
    
    if (user.tierEndDate) {
      endDate = startOfDay(parseISO(user.tierEndDate));
    } else {
      const startDate = startOfDay(parseISO(user.tierStartDate));
      endDate = addWeeks(startDate, user.tierDurationWeeks);
    }
    
    const diff = differenceInDays(endDate, today);
    return diff;
  };

  const remainingDays = getRemainingDays();
  const isExpired = remainingDays < 0;

  const handleUpdateAvatar = (icon: string, color: string) => {
    onUpdateUser({ ...user, avatarIcon: icon, avatarColor: color, profileImage: undefined });
    setIsEditingAvatar(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const resizedImage = await resizeImage(file, 400, 400);
        onUpdateUser({ ...user, profileImage: resizedImage });
        setIsEditingAvatar(false);
      } catch (error) {
        console.error("Failed to resize image", error);
        alert("이미지 업로드에 실패했습니다.");
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-stone-50 p-6 space-y-8 overflow-y-auto">
      <div className="flex flex-col items-center space-y-4">
        <div 
          className="member-seal member-seal--large group cursor-pointer"
          style={{ '--seal-color': user.avatarColor || '#e57758' } as React.CSSProperties}
          onClick={() => setIsEditingAvatar(true)}
        >
          {user.profileImage ? (
            <img src={user.profileImage} alt={user.name} />
          ) : (
            <span className="member-seal__initial">{user.name.slice(0, 1)}</span>
          )}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-stone-900">{user.name}</h2>
          <span className={`inline-block px-3 py-0.5 rounded-full text-[10px] font-bold mt-1 ${TIER_COLORS[user.tier]}`}>
            {user.tier} 단계
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm">
          <div className="text-[10px] font-bold text-stone-400 mb-1">Marks held</div>
          <div className="text-xl font-black text-stone-900">{user.coins} <span className="text-xs text-stone-400">문장</span></div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm">
          <div className="text-[10px] font-bold text-stone-400 mb-1">멤버십 기간</div>
          <div className="text-xl font-black text-stone-900">
            {isExpired ? '만료됨' : remainingDays === 0 ? 'D-Day' : `D-${remainingDays}`}
            <span className="text-xs text-stone-400 ml-1">{isExpired || remainingDays === 0 ? '' : '남음'}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-bold text-stone-400 ml-1">계정 설정</p>
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm divide-y divide-stone-50">
          <button onClick={onLogout} className="w-full p-4 flex items-center justify-between hover:bg-stone-50 transition-colors">
            <span className="text-sm font-bold text-stone-700">로그아웃</span>
            <svg className="w-4 h-4 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
          <button onClick={onDeleteAccount} className="w-full p-4 flex items-center justify-between hover:bg-red-50 transition-colors group">
            <span className="text-sm font-bold text-red-500">계정 삭제</span>
            <svg className="w-4 h-4 text-red-200 group-hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>

      {isEditingAvatar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-6 animate-in slide-in-from-bottom-full duration-300">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-stone-900">회원 표식 수정</h3>
              <button onClick={() => setIsEditingAvatar(false)} className="p-2 hover:bg-stone-100 rounded-full text-stone-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 flex items-center justify-between group cursor-pointer hover:bg-stone-100 transition-all relative">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-stone-800">사진 올리기</div>
                    <div className="text-[10px] text-stone-400 font-medium">인장 안에 들어갈 이미지를 선택합니다</div>
                  </div>
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  onChange={handleImageUpload}
                />
              </div>

              <p className="text-[10px] font-bold text-stone-400">문장 선택</p>
              <div className="grid grid-cols-4 gap-3">
                {AVATAR_ICONS.map(icon => (
                  <button 
                    key={icon}
                    onClick={() => handleUpdateAvatar(icon, user.avatarColor || AVATAR_COLORS[0])}
                    className={`member-seal transition-all ${user.avatarIcon === icon ? 'is-selected' : ''}`}
                    style={{ '--seal-color': user.avatarColor || '#e57758' } as React.CSSProperties}
                  >
                    <span className="member-seal__mark">{icon}</span>
                  </button>
                ))}
              </div>

              <p className="text-[10px] font-bold text-stone-400 pt-2">인장색 선택</p>
              <div className="grid grid-cols-4 gap-3">
                {AVATAR_COLORS.map(color => (
                  <button 
                    key={color}
                    onClick={() => handleUpdateAvatar(user.avatarIcon || AVATAR_ICONS[0], color)}
                    className={`member-seal transition-all relative ${user.avatarColor === color ? 'is-selected' : ''}`}
                    style={{ '--seal-color': color } as React.CSSProperties}
                  >
                    {user.avatarColor === color && <div className="absolute inset-0 flex items-center justify-center">✓</div>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
