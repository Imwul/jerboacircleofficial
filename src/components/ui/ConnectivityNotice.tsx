import { useEffect, useRef, useState } from 'react';

export default function ConnectivityNotice({ context = '이 화면' }: { context?: string }) {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const [restored, setRestored] = useState(false);
  const wasOffline = useRef(!online);

  useEffect(() => {
    let restoredTimer: number | undefined;
    const markOnline = () => {
      setOnline(true);
      if (wasOffline.current) {
        setRestored(true);
        restoredTimer = window.setTimeout(() => setRestored(false), 5000);
      }
      wasOffline.current = false;
    };
    const markOffline = () => {
      wasOffline.current = true;
      setRestored(false);
      setOnline(false);
    };
    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);
    return () => {
      if (restoredTimer) window.clearTimeout(restoredTimer);
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
    };
  }, []);

  if (online && !restored) return null;
  if (restored) {
    return (
      <div className="connectivity-notice is-restored" role="status" aria-live="polite">
        <strong lang="ko">연결이 돌아왔습니다.</strong>
        <span lang="ko">이 기기의 변경은 그대로 남아 있습니다. 공동 장부 반영을 다시 시도해주세요.</span>
      </div>
    );
  }
  return (
    <div className="connectivity-notice" role="status" aria-live="polite">
      <strong lang="ko">연결이 끊겨 로컬 초안으로 보관 중입니다.</strong>
      <span lang="ko">{context}의 변경은 이 기기에 남아 있으며, 다시 연결된 뒤 공동 장부에 봉인할 수 있습니다.</span>
    </div>
  );
}
