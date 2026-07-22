import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  archiveCollections,
  archiveSeasons,
  defaultArchiveContentKinds,
  events,
  getCollectionsForEvent,
  isPublicArchiveEvent,
  getSeasonById,
  type ArchiveContentKind,
  type ArchiveEvent,
  type ArchiveVisibility,
  type ArchiveWorkflowStatus,
  type EventStatus,
} from '../data/events';
import type { SiteText } from '../data/siteText';
import {
  applyArchiveDrafts,
  readArchiveDrafts,
  writeArchiveDraft,
  writeArchiveDrafts,
  type ArchiveDraftMap,
  type ArchiveEventDraft,
} from '../utils/archiveDrafts';
import { loadServerSync, saveServerSync, ServerSyncError } from '../utils/serverSync';
import { getSiteText, writeSiteTextDraft } from '../utils/siteTextDrafts';
import { editorialPlates } from '../data/manuscriptPlates';
import {
  archiveConnectionDirectionLabel,
  archiveReferenceKindLabel,
  archiveReferences,
  getArchiveConnections,
  getArchiveReferencesForEvent,
  type ArchiveProgrammeConnection,
  type ArchiveReference,
} from '../data/archiveKnowledge';
import { resizeImage } from '../utils/imageUtils';
import { uploadArchiveImage } from '../utils/cabinetMedia';
import { usePageMetadata } from '../utils/pageMetadata';
import { downloadLatestSyncRecovery, readSyncRecovery, writeSyncRecovery } from '../utils/syncRecovery';
import { authenticateRole, roleSessionToken } from '../utils/roleAuth';
import { trackProductEvent } from '../utils/productAnalytics';
import RelationshipPicker from '../components/archive/RelationshipPicker';
import ConnectivityNotice from '../components/ui/ConnectivityNotice';
import {
  splitArchiveFormList as splitDetailList,
  toArchiveEventDraft as toDetailDraft,
  toArchiveRecordForm as toDetailForm,
  validateArchiveRecordForm as validateDetailForm,
  type ArchiveRecordFormState as DetailFormState,
} from '../utils/archiveRecordForm';
import {
  applyArchiveReferenceDrafts,
  readArchiveReferenceDrafts,
  writeArchiveReferenceDrafts,
  type ArchiveReferenceDraftMap,
} from '../utils/archiveReferenceDrafts';
import { readArchivePublications, type ArchivePublicationMap } from '../utils/publicationLedger';
import { readArchiveAuditLog, recordArchiveAudit, type ArchiveAuditEntry } from '../utils/archiveAudit';
import './HomePage.css';
import './EditorialStability.css';
import '../JerboaCondoRefine.css';

interface ArchiveSyncPayload {
  schemaVersion?: 1 | 2 | 3;
  drafts?: ArchiveDraftMap;
  siteText?: Partial<SiteText>;
  references?: ArchiveReferenceDraftMap;
  publications?: ArchivePublicationMap;
  auditLog?: ArchiveAuditEntry[];
}

function detailRootHref() {
  return window.location.pathname.includes('/archive/') ? '../../' : './';
}

function detailTextLang(text: string) {
  return /[가-힣]/.test(text) ? 'ko' : 'en';
}

function DetailKeeperPanel({
  event,
  archiveEvents,
  referenceRecords,
  onSaved,
  serverSavedAt,
  onServerSavedAt,
}: {
  event: ArchiveEvent;
  archiveEvents: ArchiveEvent[];
  referenceRecords: ArchiveReference[];
  onSaved: () => void;
  serverSavedAt: string | null;
  onServerSavedAt: (savedAt: string | null) => void;
}) {
  const [code, setCode] = useState('');
  const [unlocked, setUnlocked] = useState(() => Boolean(roleSessionToken('archive-editor')));
  const [form, setForm] = useState(() => toDetailForm(event));
  const [status, setStatus] = useState(() => (
    roleSessionToken('archive-editor') ? '아카이브 편집자 역할이 확인되었습니다' : 'Keeper seal이 닫혀 있습니다'
  ));
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [hasArchiveRecovery, setHasArchiveRecovery] = useState(() => Boolean(readSyncRecovery<ArchiveSyncPayload>('archive')));

  const statusTone = status.includes('실패') || status.includes('닫혔') || status.includes('없음') || status.includes('먼저') || status.includes('보류')
    ? 'warning'
    : status.includes('봉인') || status.includes('반영') || status.includes('준비') || status.includes('확인')
      ? 'sealed'
      : 'idle';

  function updateField<Key extends keyof DetailFormState>(key: Key, value: DetailFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function createDetailArchivePayload(nextDraft: ArchiveEventDraft) {
    return {
      schemaVersion: 3 as const,
      drafts: {
        ...readArchiveDrafts(),
        [event.id]: nextDraft,
      },
      siteText: getSiteText(),
      references: readArchiveReferenceDrafts(),
      publications: readArchivePublications(),
      auditLog: readArchiveAuditLog(),
    };
  }

  function captureArchiveRecovery(nextDraft: ArchiveEventDraft, reason: string, remoteSavedAt?: string | null) {
    writeSyncRecovery('archive', createDetailArchivePayload(nextDraft), {
      baseSavedAt: serverSavedAt,
      remoteSavedAt,
      reason,
    });
    setHasArchiveRecovery(true);
  }

  async function unlockEditor() {
    if (!code.trim()) {
      setStatus('아카이브 편집자 역할 열쇠를 입력하세요');
      return;
    }

    try {
      setIsUnlocking(true);
      await authenticateRole('archive-editor', code);
      setCode('');
      setUnlocked(true);
      setStatus('아카이브 편집자 역할이 확인되었습니다');
    } catch (error) {
      setStatus(error instanceof Error && error.message === 'role_auth_not_configured'
        ? '서버에 아카이브 편집자 역할 열쇠가 아직 설정되지 않았습니다'
        : '아카이브 편집자 역할 열쇠가 일치하지 않습니다');
    } finally {
      setIsUnlocking(false);
    }
  }

  async function readPosterFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setStatus('새 도판을 웹용으로 줄이는 중');
      const resizedPoster = await resizeImage(file, 1600, 2200);
      const authSession = roleSessionToken('archive-editor');
      if (!authSession) throw new Error('archive_media_session_required');
      const posterUrl = await uploadArchiveImage(resizedPoster, file.name, authSession);
      updateField('posterImage', posterUrl);
      if (!form.posterAlt.trim()) updateField('posterAlt', `${form.title} 프로그램 포스터`);
      setStatus('새 도판이 공동 이미지 저장소에 붙었습니다');
    } catch (error) {
      console.error('Poster upload failed:', error);
      setStatus('도판을 읽을 수 없음');
    } finally {
      event.currentTarget.value = '';
    }
  }

  function saveLocal(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    const validation = validateDetailForm(form, archiveEvents, referenceRecords);
    if (validation) {
      setStatus(`입력 확인 / ${validation}`);
      return;
    }
    writeArchiveDraft(event.id, toDetailDraft(form, event), { label: form.workflowStatus });
    recordArchiveAudit({ action: 'edit', targetType: 'programme', targetId: event.id, title: form.title, detail: '상세 미리보기 편집층' });
    setStatus('로컬 초안 보관 중');
    onSaved();
  }

  async function publishToServer() {
    try {
      const validation = validateDetailForm(form, archiveEvents, referenceRecords);
      if (validation) {
        setStatus(`입력 확인 / ${validation}`);
        return;
      }
      const nextDraft = toDetailDraft(form, event);
      writeArchiveDraft(event.id, nextDraft, { label: form.workflowStatus });
      recordArchiveAudit({ action: 'sync', targetType: 'programme', targetId: event.id, title: form.title, detail: '상세 미리보기 편집층' });
      const authSession = roleSessionToken('archive-editor');
      if (!authSession) {
        setStatus('아카이브 편집자 역할 확인이 필요합니다');
        return;
      }
      const result = await saveServerSync<ArchiveSyncPayload>('archive', createDetailArchivePayload(nextDraft), code, {
        baseSavedAt: serverSavedAt,
        authSession,
      });
      onServerSavedAt(result.savedAt || serverSavedAt);
      setStatus('공동 장부에 봉인됨');
      onSaved();
    } catch (error) {
      if (error instanceof ServerSyncError && error.message === 'sync_conflict') {
        captureArchiveRecovery(toDetailDraft(form, event), 'archive_detail_sync_conflict', error.savedAt);
        onServerSavedAt(error.savedAt || serverSavedAt);
        setStatus('공동 장부가 먼저 바뀌었습니다 / Keeper Desk에서 열람 후 다시 봉인');
        return;
      }
      console.error('Detail archive save failed:', error);
      setStatus('공동 장부 봉인 실패 / 열쇠 확인');
    }
  }

  return (
    <details className="detail-keeper-panel" aria-label="Archive record editor">
      <summary>
        <span lang="en">Keeper seal</span>
        <small lang="ko">숨은 초안층 열기</small>
      </summary>
      {!unlocked && (
        <div className="detail-keeper-lock">
          <span lang="en">Keeper layer</span>
          <input
            type="password"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="아카이브 편집자 역할 열쇠"
          />
          <button type="button" onClick={unlockEditor} disabled={isUnlocking}>
            <span className="keeper-button-label">{isUnlocking ? '역할 확인 중' : 'Seal 열기'}</span>
          </button>
        </div>
      )}
      <p className="detail-keeper-status" data-sync-state={statusTone} lang="ko">{status}</p>

      {unlocked && (
        <form className="detail-keeper-form" onSubmit={saveLocal}>
          <label>
            <span>제목</span>
            <input value={form.title} onChange={(event) => updateField('title', event.target.value)} />
          </label>
          <label>
            <span>부제</span>
            <input value={form.subtitle} onChange={(event) => updateField('subtitle', event.target.value)} />
          </label>
          <label>
            <span>짧은 설명</span>
            <textarea rows={3} value={form.shortDescription} onChange={(event) => updateField('shortDescription', event.target.value)} />
          </label>
          <label>
            <span>긴 설명</span>
            <textarea rows={5} value={form.longDescription} onChange={(event) => updateField('longDescription', event.target.value)} />
          </label>
          <div className="detail-keeper-grid">
            <label>
              <span>판본</span>
              <input value={form.edition} onChange={(event) => updateField('edition', event.target.value)} />
            </label>
            <label>
              <span>일자</span>
              <input value={form.date} onChange={(event) => updateField('date', event.target.value)} />
            </label>
            <label>
              <span>상태</span>
              <select value={form.status} onChange={(event) => updateField('status', event.target.value as EventStatus)}>
                <option value="current">current</option>
                <option value="upcoming">upcoming</option>
                <option value="past">past</option>
              </select>
            </label>
          </div>
          <div className="detail-keeper-grid">
            <label>
              <span>종류</span>
              <input
                list={`detail-archive-content-kinds-${event.id}`}
                value={form.kind}
                onChange={(event) => updateField('kind', event.target.value as ArchiveContentKind)}
                placeholder="기존 종류 선택 또는 새 종류 입력"
              />
              <datalist id={`detail-archive-content-kinds-${event.id}`}>
                {defaultArchiveContentKinds.map((kind) => <option value={kind} key={kind} />)}
              </datalist>
            </label>
            <label>
              <span>공개 상태</span>
              <select value={form.visibility} onChange={(event) => updateField('visibility', event.target.value as ArchiveVisibility)}>
                <option value="public">public</option>
                <option value="unlisted">unlisted</option>
                <option value="private">private</option>
              </select>
            </label>
            <label>
              <span>발행 단계</span>
              <select value={form.workflowStatus} onChange={(event) => updateField('workflowStatus', event.target.value as ArchiveWorkflowStatus)}>
                <option value="draft">draft</option>
                <option value="preview">preview</option>
                <option value="published">published</option>
                <option value="archived">archived</option>
              </select>
            </label>
          </div>
          <label>
            <span>시즌</span>
            <select value={form.seasonId} onChange={(event) => updateField('seasonId', event.target.value)}>
              {archiveSeasons.map((season) => (
                <option value={season.id} key={season.id}>{season.label} / {season.title}</option>
              ))}
            </select>
          </label>
          <RelationshipPicker
            label="컬렉션"
            description="이 기록을 묶을 컬렉션을 선택합니다."
            options={archiveCollections.map((collection) => ({ id: collection.id, title: collection.title, meta: collection.visibility }))}
            selectedIds={splitDetailList(form.collectionIdsText)}
            onChange={(ids) => updateField('collectionIdsText', ids.join(' / '))}
          />
          <label>
            <span>포스터 URL</span>
            <input value={form.posterImage} onChange={(event) => updateField('posterImage', event.target.value)} />
          </label>
          <label>
            <span>포스터 대체 텍스트</span>
            <input value={form.posterAlt} onChange={(event) => updateField('posterAlt', event.target.value)} />
          </label>
          <div className="keeper-poster-upload">
            <figure>
              <img src={form.posterImage} alt={form.posterAlt} />
            </figure>
            <label>
              <span>새 도판 붙이기</span>
              <small>파일을 올리면 웹용 크기로 줄인 뒤 이 기록에 붙습니다</small>
              <input accept="image/*" onChange={readPosterFile} type="file" />
            </label>
          </div>
          <div className="detail-keeper-taxonomy">
            <div className="detail-keeper-grid">
              <label>
                <span>예약 공개 시작</span>
                <input type="datetime-local" value={form.publishAt} onChange={(event) => updateField('publishAt', event.target.value)} />
              </label>
              <label>
                <span>예약 공개 종료</span>
                <input type="datetime-local" value={form.unpublishAt} onChange={(event) => updateField('unpublishAt', event.target.value)} />
              </label>
            </div>
            <label>
              <span>여정</span>
              <textarea rows={4} value={form.passageText} onChange={(event) => updateField('passageText', event.target.value)} />
            </label>
            <label>
              <span>자료</span>
              <textarea rows={4} value={form.materialsText} onChange={(event) => updateField('materialsText', event.target.value)} />
            </label>
            <label>
              <span>주제</span>
              <textarea rows={4} value={form.themesText} onChange={(event) => updateField('themesText', event.target.value)} />
            </label>
            <RelationshipPicker
              label="참고자료와 문화 노드"
              description="선택한 자료로 공개 읽기 목록이 자동 생성됩니다."
              options={referenceRecords.map((reference) => ({ id: reference.id, title: reference.title, meta: reference.attribution ?? reference.kind }))}
              selectedIds={splitDetailList(form.referenceIdsText)}
              onChange={(ids) => updateField('referenceIdsText', ids.join(' / '))}
            />
            <RelationshipPicker
              label="이어지는 프로그램"
              description="이 판본과 직접 연결할 프로그램을 선택합니다."
              options={archiveEvents.filter((record) => record.id !== event.id).map((record) => ({ id: record.id, title: record.title, meta: record.edition }))}
              selectedIds={splitDetailList(form.relatedEventIdsText)}
              onChange={(ids) => updateField('relatedEventIdsText', ids.join(' / '))}
            />
          </div>
          <div className="detail-keeper-actions">
            <button type="submit"><span className="keeper-button-label">로컬 초안 봉인</span></button>
            <button type="button" onClick={publishToServer}><span className="keeper-button-label">공동 장부에 봉인</span></button>
            {hasArchiveRecovery && (
              <button type="button" onClick={() => downloadLatestSyncRecovery('archive')}>
                <span className="keeper-button-label">복구 파일 받기</span>
              </button>
            )}
            <a href={`${detailRootHref()}godmode/`}><span className="keeper-button-label">Keeper Desk</span></a>
          </div>
        </form>
      )}
    </details>
  );
}

function ArchiveReferenceIndex({
  references,
  kindLabel,
}: {
  references: ArchiveReference[];
  kindLabel: (kind: ArchiveReference['kind']) => string;
}) {
  return (
    <div className="text-index archive-reference-index">
      <span className="text-index-title"><span lang="ko">자료</span></span>
      <ol>
        {references.map((reference) => (
          <li key={reference.id}>
            <a href={`${detailRootHref()}catalogue/${reference.id}/`}>
              <span className="archive-knowledge-kind" lang="ko">{kindLabel(reference.kind)}</span>
              <strong lang={detailTextLang(reference.title)}>{reference.title}</strong>
              <small lang={detailTextLang([reference.attribution, reference.locator].filter(Boolean).join(' · '))}>
                {[
                  reference.attribution,
                  reference.locator,
                ].filter(Boolean).join(' · ')}
              </small>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

function EventDetail({
  event,
  archiveEvents,
  referenceRecords,
  siteText,
  onSaved,
  serverSavedAt,
  onServerSavedAt,
  isPreview,
}: {
  event: ArchiveEvent;
  archiveEvents: ArchiveEvent[];
  referenceRecords: ArchiveReference[];
  siteText: SiteText;
  onSaved: () => void;
  serverSavedAt: string | null;
  onServerSavedAt: (savedAt: string | null) => void;
  isPreview: boolean;
}) {
  const season = getSeasonById(event.seasonId);
  const collections = getCollectionsForEvent(event);
  const relationRecords = archiveEvents.filter((record) => (
    isPreview ? record.workflowStatus !== 'archived' : isPublicArchiveEvent(record)
  ));
  const references: ArchiveReference[] = getArchiveReferencesForEvent(event, referenceRecords);
  const connections: ArchiveProgrammeConnection[] = getArchiveConnections(event, relationRecords, referenceRecords);

  return (
    <div className="public-home detail-home">
      <header className="archive-header">
        <a className="archive-wordmark" href={detailRootHref()}>
          <span>Jerboa</span>
          <span>Circle</span>
          <small lang="la">{siteText.wordmarkSmall}</small>
        </a>
        <nav className="archive-nav" aria-label="Archive record navigation">
          <a className="archive-nav-memory" href={detailRootHref()}><span className="nav-en" lang="en">{siteText.detailNavArchiveEn}</span><small lang="ko">{siteText.detailNavArchiveKo}</small></a>
          <a className="archive-private-door" href={`${detailRootHref()}members/`}><span className="nav-en" lang="en">{siteText.detailNavMembersEn}</span><small lang="ko">{siteText.detailNavMembersKo}</small></a>
        </nav>
      </header>
      {roleSessionToken('archive-editor') && <ConnectivityNotice context="기록 편집기" />}
      {isPreview && (
        <p className="detail-preview-notice" role="status" lang="ko">
          Keeper 초안 미리보기입니다. 이 주소는 일반 방문자에게 공개되지 않습니다.
        </p>
      )}
      <main className="detail-record section-reveal">
        <aside className="detail-poster">
          <img src={event.posterImage} alt={event.posterAlt ?? `${event.title} poster`} decoding="async" width={1200} height={1600} />
        </aside>
        <article className="detail-copy">
          <p className="section-kicker">
            <span className="kicker-en" lang="en">{event.edition}</span>
          </p>
          <h1 className={event.title.length > 18 ? 'is-long-title' : undefined}>{event.title}</h1>
          <p className="event-subtitle" lang={/[가-힣]/.test(event.subtitle) ? 'ko' : 'en'}>{event.subtitle}</p>
          <p className="latin-line" lang={/[가-힣]/.test(event.latinQuote) ? 'ko' : 'en'}>{event.latinQuote}</p>
          <p className="marginal-note" lang="ko">{event.marginalia}</p>
          <figure className="detail-manuscript-plate" aria-hidden="true">
            <img src={editorialPlates.detail.src} alt="" loading="lazy" decoding="async" />
          </figure>
          <p className="detail-long" lang="ko">{event.longDescription}</p>
          <div className="constellation-grid" aria-label="Archive record path and materials">
            <div className="text-index">
              <span className="text-index-title"><span lang="ko">여정</span></span>
              <ol>
                {event.passage.map((item) => (
                  <li key={item}><span lang={/[가-힣]/.test(item) ? 'ko' : 'en'}>{item}</span></li>
                ))}
              </ol>
            </div>
            <div className="text-index">
              <span className="text-index-title"><span lang="ko">자료</span></span>
              <ol>
                {event.materials.map((item) => (
                  <li key={item}><span lang={/[가-힣]/.test(item) ? 'ko' : 'en'}>{item}</span></li>
                ))}
              </ol>
            </div>
          </div>
          {(references.length > 0 || connections.length > 0) && (
            <section className="detail-archive-context" aria-labelledby="archive-relations-title">
              <p className="section-kicker" id="archive-relations-title">
                <span className="kicker-en" lang="en">Relations</span>
                <span className="kicker-divider" aria-hidden="true"> / </span>
                <span className="kicker-ko" lang="ko">연결</span>
              </p>
              <div className="constellation-grid archive-knowledge-grid">
                <ArchiveReferenceIndex
                  references={references}
                  kindLabel={archiveReferenceKindLabel}
                />
                <div className="text-index archive-connection-index">
                  <span className="text-index-title"><span lang="ko">이어지는 프로그램</span></span>
                  <ol>
                    {connections.map((connection) => (
                      <li key={connection.event.id}>
                        <a href={`${detailRootHref()}archive/${connection.event.id}/`}>
                          <span className="archive-knowledge-kind" lang="ko">
                            {archiveConnectionDirectionLabel(connection.direction)} · {connection.event.edition}
                          </span>
                          <strong lang={/[가-힣]/.test(connection.event.title) ? 'ko' : 'en'}>{connection.event.title}</strong>
                          <small lang="ko">{connection.note}</small>
                        </a>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </section>
          )}
          <dl className="event-meta detail-meta">
            <div>
              <dt lang={detailTextLang(siteText.metaDate)}>{siteText.metaDate}</dt>
              <dd lang={detailTextLang(event.date)}>{event.date}</dd>
            </div>
            <div>
              <dt lang={detailTextLang(siteText.metaFormat)}>{siteText.metaFormat}</dt>
              <dd lang={detailTextLang(event.location)}>{event.location}</dd>
            </div>
            <div>
              <dt lang="ko">시즌</dt>
              <dd>{season ? `${season.label} / ${season.title}` : event.seasonId}</dd>
            </div>
            <div>
              <dt lang="ko">컬렉션</dt>
              <dd>{collections.map((collection) => collection.title).join(' / ') || event.collectionIds.join(' / ')}</dd>
            </div>
          </dl>
          <a className="archive-cta" href={detailRootHref()}>
            <span className="archive-cta-label" lang={detailTextLang(siteText.detailBackLabel)}>{siteText.detailBackLabel}</span>
          </a>
        </article>
      </main>
      {roleSessionToken('archive-editor') && (
        <DetailKeeperPanel
          event={event}
          archiveEvents={archiveEvents}
          referenceRecords={referenceRecords}
          onSaved={onSaved}
          onServerSavedAt={onServerSavedAt}
          serverSavedAt={serverSavedAt}
        />
      )}
    </div>
  );
}

export default function ArchiveDetailPage({ id }: { id: string | undefined }) {
  const [version, setVersion] = useState(0);
  const [siteText, setSiteText] = useState(() => getSiteText());
  const [serverSavedAt, setServerSavedAt] = useState<string | null>(null);
  const [archiveSyncState, setArchiveSyncState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const archiveEvents = useMemo(() => applyArchiveDrafts(events), [version]);
  const referenceRecords = useMemo(() => applyArchiveReferenceDrafts(archiveReferences), [version]);
  const knownRecord = useMemo(() => archiveEvents.find((archiveEvent) => archiveEvent.id === id), [archiveEvents, id]);
  const isPreview = new URLSearchParams(window.location.search).get('preview') === '1'
    && (import.meta.env.DEV || Boolean(roleSessionToken('archive-editor')));
  const event = useMemo(
    () => archiveEvents.find((archiveEvent) => (
      archiveEvent.id === id
      && (isPreview || isPublicArchiveEvent(archiveEvent))
    )),
    [archiveEvents, id, isPreview],
  );

  usePageMetadata({
    title: event ? `${event.title} | Jerboa Circle` : `${siteText.missingTitle} | Jerboa Circle`,
    description: event ? event.shortDescription : 'Jerboa Circle archive record was not found.',
    canonicalPath: event ? `/archive/${event.id}/` : undefined,
    image: event?.posterImage,
    noIndex: isPreview || !event || !isPublicArchiveEvent(event),
    type: event ? 'article' : 'website',
  });

  useEffect(() => {
    let ignore = false;

    async function loadPublicArchive() {
      try {
        const result = await loadServerSync<ArchiveSyncPayload>('archive', '', {
          authSession: isPreview ? roleSessionToken('archive-editor') : null,
        });
        if (ignore) return;
        if (!result.exists || !result.saved?.data) {
          setArchiveSyncState('ready');
          return;
        }

        if (!isPreview && result.saved.data.drafts) {
          writeArchiveDrafts(result.saved.data.drafts);
        }

        if (!isPreview && result.saved.data.siteText) {
          writeSiteTextDraft(result.saved.data.siteText);
          setSiteText(getSiteText());
        }

        if (!isPreview && result.saved.data.references) {
          writeArchiveReferenceDrafts(result.saved.data.references);
        }

        setServerSavedAt(result.saved.savedAt);
        setVersion((current) => current + 1);
        setArchiveSyncState('ready');
      } catch (error) {
        if (!ignore) setArchiveSyncState('unavailable');
        if (!(error instanceof Error) || error.message !== 'sync_unavailable') {
          console.warn('Public archive sync skipped:', error);
        }
      }
    }

    void loadPublicArchive();

    return () => {
      ignore = true;
    };
  }, [isPreview]);

  useEffect(() => {
    if (!event) return;

    trackProductEvent('archive_record_open', {
      recordId: event.id,
      kind: event.kind,
      status: event.status,
      seasonId: event.seasonId,
      collectionCount: event.collectionIds.length,
    });
  }, [event?.id]);

  if (!event) {
    const isUnpublished = Boolean(knownRecord);
    const isLoading = !isUnpublished && archiveSyncState === 'loading';
    const isUnavailable = !isUnpublished && archiveSyncState === 'unavailable';
    const stateKicker = isLoading
      ? 'Collating / 기록 확인 중'
      : isUnavailable
        ? 'Temporarily unavailable / 잠시 닫힘'
        : isUnpublished
          ? 'Reserved folio / 아직 발행되지 않은 기록'
          : siteText.missingKicker;
    const stateTitle = isLoading
      ? '공동 장부에서 기록을 확인하고 있습니다.'
      : isUnavailable
        ? '공동 장부를 잠시 확인할 수 없습니다.'
        : isUnpublished
          ? '이 기록은 아직 공개 판본으로 발행되지 않았습니다.'
          : siteText.missingTitle;
    const stateDescription = isLoading
      ? '확인이 끝나면 기록이 자동으로 열립니다.'
      : isUnavailable
        ? '네트워크 연결을 확인한 뒤 다시 열어주세요. 공개 기록벽은 계속 이용할 수 있습니다.'
        : isUnpublished
          ? '제목과 내용은 공개 준비가 끝난 뒤 이 자리에서 열립니다.'
          : '주소가 바뀌었거나 아직 장부에 없는 기록입니다.';
    return (
      <div className="public-home detail-home">
        <header className="archive-header">
          <a className="archive-wordmark" href={detailRootHref()}>
          <span>Jerboa</span>
          <span>Circle</span>
            <small lang="la">{siteText.wordmarkSmall}</small>
          </a>
        </header>
        <main className="missing-record">
          <p className="section-kicker">{stateKicker}</p>
          <h1 lang="ko">{stateTitle}</h1>
          <p lang="ko">{stateDescription}</p>
          <a className="archive-cta" href={detailRootHref()}>
            <span className="archive-cta-label" lang={detailTextLang(siteText.detailBackLabel)}>{siteText.detailBackLabel}</span>
          </a>
        </main>
      </div>
    );
  }

  return (
    <EventDetail
      archiveEvents={archiveEvents}
      referenceRecords={referenceRecords}
      event={event}
      onSaved={() => setVersion((current) => current + 1)}
      onServerSavedAt={setServerSavedAt}
      serverSavedAt={serverSavedAt}
      isPreview={isPreview}
      siteText={siteText}
    />
  );
}
