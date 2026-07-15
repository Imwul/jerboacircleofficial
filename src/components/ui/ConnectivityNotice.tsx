import { useEffect, useState } from 'react';

export default function ConnectivityNotice({ context = '이 화면' }: { context?: string }) {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);

  useEffect(() => {
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);
    return () => {
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
    };
  }, []);

  if (online) return null;
  return (
    <div className="connectivity-notice" role="status" aria-live="polite">
      <strong lang="ko">연결이 끊겨 로컬 초안으로 보관 중입니다.</strong>
      <span lang="ko">{context}의 변경은 이 기기에 남아 있으며, 다시 연결된 뒤 공동 장부에 봉인할 수 있습니다.</span>
    </div>
  );
}
