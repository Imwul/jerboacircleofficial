import type { ArchiveVisibility, ArchiveWorkflowStatus } from '../../data/events';

export type KeeperOperation = 'idle' | 'saving' | 'syncing' | 'loading' | 'publishing' | 'unpublishing';

interface KeeperEditorActionBarProps {
  mode: 'events' | 'references' | 'text';
  dirty: boolean;
  busy: boolean;
  operation: KeeperOperation;
  error: string;
  lastSavedAt: string | null;
  remoteKnown: boolean;
  hasRemoteDifference: boolean;
  workflowStatus?: ArchiveWorkflowStatus;
  visibility?: ArchiveVisibility;
  publicationBlocked?: boolean;
  hasPublication?: boolean;
  onSave: () => void;
  onSync: () => void;
  onPublish?: () => void;
  onUnpublish?: () => void;
  onDiscard: () => void;
}

const workflowLabels: Record<ArchiveWorkflowStatus, string> = {
  draft: '초안',
  preview: '미리보기',
  published: '발행됨',
  archived: '보관됨',
};

const visibilityLabels: Record<ArchiveVisibility, string> = {
  public: '공개',
  unlisted: '주소로만 공개',
  private: '비공개',
};

const operationLabels: Record<KeeperOperation, string> = {
  idle: '',
  saving: '기기에 저장 중...',
  syncing: '공동 장부에 반영 중...',
  loading: '공동 장부를 불러오는 중...',
  publishing: '게시 중...',
  unpublishing: '게시를 취소하는 중...',
};

function savedTimeLabel(value: string | null) {
  if (!value) return '아직 직접 저장하지 않음';
  return `마지막 저장 ${new Date(value).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })}`;
}

export default function KeeperEditorActionBar({
  mode,
  dirty,
  busy,
  operation,
  error,
  lastSavedAt,
  remoteKnown,
  hasRemoteDifference,
  workflowStatus,
  visibility,
  publicationBlocked = false,
  hasPublication = false,
  onSave,
  onSync,
  onPublish,
  onUnpublish,
  onDiscard,
}: KeeperEditorActionBarProps) {
  const recordLabel = mode === 'events' ? '프로그램' : mode === 'references' ? '자료' : '문구';
  const statusLabel = operation !== 'idle'
    ? operationLabels[operation]
    : error
      ? error
      : dirty
        ? '저장되지 않은 변경 사항이 있습니다.'
        : savedTimeLabel(lastSavedAt);
  const publicationPolicyLabel = mode !== 'events'
    ? ''
    : workflowStatus === 'published' && visibility === 'public'
      ? '공개 중인 기록은 변경사항 저장 시 즉시 공개됩니다. 게시 버튼은 검증된 발행 이력을 남깁니다.'
      : '임시 저장과 공동 장부 저장만으로는 공개되지 않습니다. 게시해야 공개됩니다.';

  return (
    <section
      className="keeper-editor-actionbar"
      data-dirty={dirty}
      data-error={Boolean(error)}
      aria-label={`${recordLabel} 저장과 게시`}
      aria-busy={busy}
    >
      <div className="keeper-editor-action-state">
        <strong lang="ko">{recordLabel} 편집</strong>
        <span role={error ? 'alert' : 'status'} aria-live={error ? 'assertive' : 'polite'} lang="ko">
          {statusLabel}
        </span>
        {publicationPolicyLabel && <small className="keeper-editor-publication-policy" lang="ko">{publicationPolicyLabel}</small>}
      </div>
      <div className="keeper-editor-action-meta" aria-label="현재 기록 상태">
        {workflowStatus && <span lang="ko">단계: {workflowLabels[workflowStatus]}</span>}
        {visibility && <span lang="ko">공개: {visibilityLabels[visibility]}</span>}
        <span data-state={!remoteKnown ? 'unknown' : hasRemoteDifference ? 'pending' : 'synced'} lang="ko">
          {!remoteKnown ? '공동 장부 미확인' : hasRemoteDifference ? '공동 장부와 다름' : '공동 장부와 일치'}
        </span>
      </div>
      <div className="keeper-editor-action-buttons">
        <button type="button" disabled={!dirty || busy} onClick={onSave}>
          <span lang="ko">{operation === 'saving' ? '저장 중...' : '임시 저장'}</span>
        </button>
        <button type="button" disabled={busy || (!dirty && !hasRemoteDifference)} onClick={onSync}>
          <span lang="ko">{operation === 'syncing' ? '저장 중...' : '변경사항 저장'}</span>
        </button>
        <button type="button" disabled={!dirty || busy} onClick={onDiscard}>
          <span lang="ko">저장 전으로 되돌리기</span>
        </button>
        {mode === 'events' && onPublish && (
          <button
            className="keeper-editor-publish"
            type="button"
            disabled={busy || publicationBlocked}
            onClick={onPublish}
          >
            <span lang="ko">
              {operation === 'publishing' ? '게시 중...' : hasPublication ? '변경사항 게시' : '게시하기'}
            </span>
          </button>
        )}
        {mode === 'events' && onUnpublish && (
          <button
            className="keeper-editor-unpublish"
            type="button"
            disabled={busy}
            onClick={onUnpublish}
          >
            <span lang="ko">{operation === 'unpublishing' ? '취소 중...' : '게시 취소'}</span>
          </button>
        )}
      </div>
    </section>
  );
}
