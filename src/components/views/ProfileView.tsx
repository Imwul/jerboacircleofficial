
import React, { useState } from 'react';
import { User, AVATAR_ICONS, AVATAR_COLORS } from '../../types';
import { resizeImage } from '../../utils/imageUtils';
import { deriveParticipantJourney } from '../../utils/participantJourney';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useDialogFocus } from '../../utils/useDialogFocus';

interface ProfileViewProps {
  user: User;
  onUpdateUser: (user: User) => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ user, onUpdateUser, onLogout, onDeleteAccount }) => {
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [draftAvatarIcon, setDraftAvatarIcon] = useState(user.avatarIcon || AVATAR_ICONS[0]);
  const [draftAvatarColor, setDraftAvatarColor] = useState(user.avatarColor || AVATAR_COLORS[0]);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const avatarDialogRef = useDialogFocus<HTMLDivElement>(isEditingAvatar, () => setIsEditingAvatar(false));

  const journey = deriveParticipantJourney(user);

  const openAvatarEditor = () => {
    setDraftAvatarIcon(user.avatarIcon || AVATAR_ICONS[0]);
    setDraftAvatarColor(user.avatarColor || AVATAR_COLORS[0]);
    setIsEditingAvatar(true);
  };

  const handleUpdateAvatar = () => {
    onUpdateUser({ ...user, avatarIcon: draftAvatarIcon, avatarColor: draftAvatarColor, profileImage: undefined });
    setIsEditingAvatar(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setUploadError('');
        const resizedImage = await resizeImage(file, 400, 400);
        onUpdateUser({ ...user, profileImage: resizedImage });
        setIsEditingAvatar(false);
      } catch (error) {
        console.error("Failed to resize image", error);
        setUploadError('이미지 업로드에 실패했습니다. 다른 이미지나 더 작은 파일을 선택해주세요.');
      }
    }
  };

  return (
    <div className="member-profile flex flex-col h-full bg-stone-50 p-6 space-y-8 overflow-y-auto">
      {uploadError && <div className="archive-notice" role="alert" lang="ko">{uploadError}</div>}
      <div className="member-profile-identity flex flex-col items-center space-y-4">
        <button
          type="button"
          aria-label="회원 표식 수정"
          className="member-seal member-seal--large group cursor-pointer"
          style={{ '--seal-color': user.avatarColor || '#e57758' } as React.CSSProperties}
          onClick={openAvatarEditor}
        >
          {user.profileImage ? (
            <img src={user.profileImage} alt={user.name} />
          ) : (
            <span className="member-seal__mark">{user.avatarIcon || user.name.slice(0, 1)}</span>
          )}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </div>
        </button>
        <div className="text-center">
          <h2 lang="ko" className="text-2xl font-black text-stone-900">{user.name}</h2>
        </div>
      </div>

      <div className="member-profile-metrics grid grid-cols-1 gap-4">
        <div className="member-profile-metric bg-white p-4 rounded-2xl border border-stone-100 shadow-sm">
          <div className="text-[10px] font-bold text-stone-400 mb-1">Marks held</div>
          <div className="text-xl font-black text-stone-900">{user.coins} <span className="text-xs text-stone-400">문장</span></div>
        </div>
      </div>

      <div className="member-profile-journey bg-white p-5 rounded-3xl border border-stone-100 shadow-sm space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold text-stone-400 mb-1">Journey state</div>
            <div className="text-xl font-black text-stone-900">{journey.label}</div>
          </div>
          <span className="px-3 py-1 rounded-full bg-stone-100 text-[10px] font-black text-stone-500">{journey.englishLabel}</span>
        </div>
        <p className="text-xs font-bold text-stone-400" lang="ko">{journey.note}</p>
        {user.journeyNotes && (
          <p className="text-sm font-bold text-stone-700" lang="ko">{user.journeyNotes}</p>
        )}
      </div>

      <div className="member-profile-account space-y-3">
        <p className="text-xs font-bold text-stone-400 ml-1">장부 설정</p>
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm divide-y divide-stone-50">
          <button onClick={onLogout} className="w-full p-4 flex items-center justify-between hover:bg-stone-50 transition-colors">
            <span className="text-sm font-bold text-stone-700">로그아웃</span>
            <svg className="w-4 h-4 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
          <button
            onClick={() => setDeleteConfirmationOpen(true)}
            className="w-full p-4 flex items-center justify-between hover:bg-red-50 transition-colors group"
          >
            <span className="text-sm font-bold text-red-500">계정 삭제</span>
            <svg className="w-4 h-4 text-red-200 group-hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>

      {isEditingAvatar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="avatar-editor-title">
          <div ref={avatarDialogRef} className="bg-white w-full max-w-md rounded-3xl p-6 space-y-6 animate-in slide-in-from-bottom-full duration-300">
            <div className="flex justify-between items-center">
              <h3 id="avatar-editor-title" className="text-lg font-black text-stone-900">회원 표식 수정</h3>
              <button aria-label="회원 표식 수정 닫기" onClick={() => setIsEditingAvatar(false)} className="p-2 hover:bg-stone-100 rounded-full text-stone-400">
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

              <p className="text-[10px] font-bold text-stone-400">기호 선택</p>
              <div className="grid grid-cols-4 gap-3">
                {AVATAR_ICONS.map((icon, index) => (
                  <button 
                    key={icon}
                    type="button"
                    aria-label={`${index + 1}번 중세 표식 ${icon}`}
                    aria-pressed={draftAvatarIcon === icon}
                    onClick={() => setDraftAvatarIcon(icon)}
                    className={`member-seal member-avatar-symbol transition-all ${draftAvatarIcon === icon ? 'is-selected' : ''}`}
                    style={{ '--seal-color': draftAvatarColor } as React.CSSProperties}
                  >
                    <span className="member-seal__mark">{icon}</span>
                  </button>
                ))}
              </div>

              <p className="text-[10px] font-bold text-stone-400 pt-2">인장색 선택</p>
              <div className="grid grid-cols-4 gap-3">
                {AVATAR_COLORS.map((color, index) => (
                  <button 
                    key={color}
                    type="button"
                    aria-label={`${index + 1}번 인장색`}
                    aria-pressed={draftAvatarColor === color}
                    onClick={() => setDraftAvatarColor(color)}
                    className={`member-seal member-avatar-color transition-all relative ${draftAvatarColor === color ? 'is-selected' : ''}`}
                    style={{ '--seal-color': color, backgroundColor: color } as React.CSSProperties}
                  >
                    {draftAvatarColor === color && <span className="member-avatar-color__check" aria-hidden="true">✓</span>}
                  </button>
                ))}
              </div>
              <div className="member-avatar-editor-actions">
                <button type="button" onClick={() => setIsEditingAvatar(false)}>취소</button>
                <button type="button" className="is-primary" onClick={handleUpdateAvatar}>표식 적용</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={deleteConfirmationOpen}
        title="개인 장부를 삭제할까요?"
        description={`${user.name}님의 개인 기록, 이미지와 프로그램 신청 내역이 모두 사라집니다. 필요한 기록을 먼저 백업해주세요.`}
        confirmLabel="개인 장부 삭제"
        tone="danger"
        onCancel={() => setDeleteConfirmationOpen(false)}
        onConfirm={() => {
          setDeleteConfirmationOpen(false);
          onDeleteAccount();
        }}
      />
    </div>
  );
};
