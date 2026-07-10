import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  archiveCollections,
  archiveSeasons,
  events,
  getCollectionsForEvent,
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
import { resizeImage } from '../utils/imageUtils';
import { usePageMetadata } from '../utils/pageMetadata';
import { downloadLatestSyncRecovery, readSyncRecovery, writeSyncRecovery } from '../utils/syncRecovery';
import { authenticateRole, roleSessionToken } from '../utils/roleAuth';
import { trackProductEvent } from '../utils/productAnalytics';
import './HomePage.css';
import './EditorialStability.css';

interface ArchiveSyncPayload {
  drafts?: ArchiveDraftMap;
  siteText?: Partial<SiteText>;
}

function detailRootHref() {
  return window.location.pathname.includes('/archive/') ? '../../' : './';
}

function detailTextLang(text: string) {
  return /[가-힣]/.test(text) ? 'ko' : 'en';
}

interface DetailFormState {
  kind: ArchiveContentKind;
  visibility: ArchiveVisibility;
  workflowStatus: ArchiveWorkflowStatus;
  seasonId: string;
  collectionIdsText: string;
  edition: string;
  title: string;
  subtitle: string;
  latinQuote: string;
  marginalia: string;
  date: string;
  status: EventStatus;
  posterImage: string;
  shortDescription: string;
  longDescription: string;
  passageText: string;
  materialsText: string;
  themesText: string;
  location: string;
  ctaLabel: string;
}

function toDetailForm(event: ArchiveEvent): DetailFormState {
  return {
    kind: event.kind,
    visibility: event.visibility,
    workflowStatus: event.workflowStatus,
    seasonId: event.seasonId,
    collectionIdsText: event.collectionIds.join(' / '),
    edition: event.edition,
    title: event.title,
    subtitle: event.subtitle,
    latinQuote: event.latinQuote,
    marginalia: event.marginalia,
    date: event.date,
    status: event.status,
    posterImage: event.posterImage,
    shortDescription: event.shortDescription,
    longDescription: event.longDescription,
    passageText: event.passage.join(' / '),
    materialsText: event.materials.join(' / '),
    themesText: event.themes.join(' / '),
    location: event.location,
    ctaLabel: event.ctaLabel,
  };
}

function toDetailDraft(form: DetailFormState, event: ArchiveEvent): ArchiveEventDraft {
  return {
    kind: form.kind,
    visibility: form.visibility,
    workflowStatus: form.workflowStatus,
    seasonId: form.seasonId,
    collectionIds: splitDetailList(form.collectionIdsText),
    edition: form.edition,
    title: form.title,
    subtitle: form.subtitle,
    latinQuote: form.latinQuote,
    marginalia: form.marginalia,
    date: form.date,
    status: form.status,
    posterImage: form.posterImage,
    shortDescription: form.shortDescription,
    longDescription: form.longDescription,
    passage: form.passageText.split(/\n|\//).map((item) => item.trim()).filter(Boolean),
    materials: form.materialsText.split(/\n|\//).map((item) => item.trim()).filter(Boolean),
    themes: form.themesText.split(/\n|\//).map((item) => item.trim()).filter(Boolean),
    location: form.location,
    ctaLabel: form.ctaLabel,
    ctaHref: event.ctaHref || `./archive/${event.id}/`,
  };
}

function splitDetailList(value: string) {
  return value.split(/\n|\//).map((item) => item.trim()).filter(Boolean);
}

function validateDetailForm(form: DetailFormState) {
  const requiredFields: Array<[keyof DetailFormState, string]> = [
    ['edition', '판본'],
    ['title', '제목'],
    ['subtitle', '부제'],
    ['date', '일자'],
    ['posterImage', '포스터 이미지'],
    ['shortDescription', '짧은 설명'],
    ['longDescription', '긴 설명'],
    ['location', '형식'],
    ['ctaLabel', '버튼 문구'],
  ];

  const emptyField = requiredFields.find(([key]) => !String(form[key]).trim());
  if (emptyField) return `${emptyField[1]}을 입력하세요`;
  if (!archiveSeasons.some((season) => season.id === form.seasonId)) return '시즌을 선택하세요';
  if (splitDetailList(form.collectionIdsText).length === 0) return '컬렉션을 하나 이상 입력하세요';
  if (splitDetailList(form.passageText).length === 0) return '여정을 하나 이상 입력하세요';
  if (splitDetailList(form.materialsText).length === 0) return '자료를 하나 이상 입력하세요';
  if (splitDetailList(form.themesText).length === 0) return '주제를 하나 이상 입력하세요';
  return '';
}

function DetailKeeperPanel({
  event,
  onSaved,
  serverSavedAt,
  onServerSavedAt,
}: {
  event: ArchiveEvent;
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
      drafts: {
        ...readArchiveDrafts(),
        [event.id]: nextDraft,
      },
      siteText: getSiteText(),
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
      updateField('posterImage', resizedPoster);
      setStatus('새 도판이 초안에 붙었습니다');
    } catch (error) {
      console.error('Poster upload failed:', error);
      setStatus('도판을 읽을 수 없음');
    } finally {
      event.currentTarget.value = '';
    }
  }

  function saveLocal(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    const validation = validateDetailForm(form);
    if (validation) {
      setStatus(`입력 확인 / ${validation}`);
      return;
    }
    writeArchiveDraft(event.id, toDetailDraft(form, event), { label: form.workflowStatus });
    setStatus('로컬 초안 보관 중');
    onSaved();
  }

  async function publishToServer() {
    try {
      const validation = validateDetailForm(form);
      if (validation) {
        setStatus(`입력 확인 / ${validation}`);
        return;
      }
      const nextDraft = toDetailDraft(form, event);
      writeArchiveDraft(event.id, nextDraft, { label: form.workflowStatus });
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
              <select value={form.kind} onChange={(event) => updateField('kind', event.target.value as ArchiveContentKind)}>
                <option value="workshop">workshop</option>
                <option value="essay">essay</option>
                <option value="exhibition">exhibition</option>
                <option value="project">project</option>
                <option value="archive-record">archive-record</option>
              </select>
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
          <div className="detail-keeper-grid">
            <label>
              <span>시즌</span>
              <select value={form.seasonId} onChange={(event) => updateField('seasonId', event.target.value)}>
                {archiveSeasons.map((season) => (
                  <option value={season.id} key={season.id}>{season.label} / {season.title}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span>컬렉션 ID</span>
            <input
              list="detail-archive-collection-ids"
              value={form.collectionIdsText}
              onChange={(event) => updateField('collectionIdsText', event.target.value)}
            />
          </label>
          <datalist id="detail-archive-collection-ids">
            {archiveCollections.map((collection) => (
              <option value={collection.id} key={collection.id}>{collection.title}</option>
            ))}
          </datalist>
          <label>
            <span>포스터 URL</span>
            <input value={form.posterImage} onChange={(event) => updateField('posterImage', event.target.value)} />
          </label>
          <div className="keeper-poster-upload">
            <figure>
              <img src={form.posterImage} alt="" />
            </figure>
            <label>
              <span>새 도판 붙이기</span>
              <small>파일을 올리면 웹용 크기로 줄인 뒤 이 기록에 붙습니다</small>
              <input accept="image/*" onChange={readPosterFile} type="file" />
            </label>
          </div>
          <div className="detail-keeper-taxonomy">
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

function EventDetail({
  event,
  siteText,
  onSaved,
  serverSavedAt,
  onServerSavedAt,
}: {
  event: ArchiveEvent;
  siteText: SiteText;
  onSaved: () => void;
  serverSavedAt: string | null;
  onServerSavedAt: (savedAt: string | null) => void;
}) {
  const season = getSeasonById(event.seasonId);
  const collections = getCollectionsForEvent(event);

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
      <main className="detail-record section-reveal">
        <aside className="detail-poster">
          <img src={event.posterImage} alt={`${event.title} poster`} decoding="async" width={1200} height={1600} />
        </aside>
        <article className="detail-copy">
          <p className="section-kicker">
            <span className="kicker-en" lang="en">{event.edition}</span>
            <span className="kicker-divider" aria-hidden="true"> / </span>
            <span className="kicker-ko" lang="ko">{siteText.detailKickerKo}</span>
          </p>
          <h1>{event.title}</h1>
          <p className="event-subtitle">{event.subtitle}</p>
          <p className="latin-line">{event.latinQuote}</p>
          <p className="marginal-note" lang="ko">{event.marginalia}</p>
          <figure className="detail-manuscript-plate" aria-hidden="true">
            <img src={editorialPlates.detail} alt="" loading="lazy" decoding="async" />
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
          <dl className="event-meta detail-meta">
            <div>
              <dt lang={detailTextLang(siteText.metaEdition)}>{siteText.metaEdition}</dt>
              <dd lang={detailTextLang(event.edition)}>{event.edition}</dd>
            </div>
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
            <div>
              <dt lang={detailTextLang(siteText.detailThemeLabel)}>{siteText.detailThemeLabel}</dt>
              <dd lang={detailTextLang(event.themes.join(' / '))}>{event.themes.join(' / ')}</dd>
            </div>
          </dl>
          <a className="archive-cta" href={detailRootHref()}>
            {siteText.detailBackLabel}
          </a>
        </article>
      </main>
      <DetailKeeperPanel
        event={event}
        onSaved={onSaved}
        onServerSavedAt={onServerSavedAt}
        serverSavedAt={serverSavedAt}
      />
    </div>
  );
}

export default function ArchiveDetailPage({ id }: { id: string | undefined }) {
  const [version, setVersion] = useState(0);
  const [siteText, setSiteText] = useState(() => getSiteText());
  const [serverSavedAt, setServerSavedAt] = useState<string | null>(null);
  const archiveEvents = useMemo(() => applyArchiveDrafts(events), [version]);
  const event = useMemo(
    () => archiveEvents.find((archiveEvent) => (
      archiveEvent.id === id
      && archiveEvent.visibility !== 'private'
      && archiveEvent.workflowStatus !== 'archived'
    )),
    [archiveEvents, id],
  );

  usePageMetadata({
    title: event ? `${event.title} | Jerboa Circle` : `${siteText.missingTitle} | Jerboa Circle`,
    description: event ? event.shortDescription : 'Jerboa Circle archive record was not found.',
    canonicalPath: event ? `/archive/${event.id}/` : undefined,
  });

  useEffect(() => {
    let ignore = false;

    async function loadPublicArchive() {
      try {
        const result = await loadServerSync<ArchiveSyncPayload>('archive');
        if (ignore || !result.exists || !result.saved?.data) return;

        if (result.saved.data.drafts) {
          writeArchiveDrafts(result.saved.data.drafts);
        }

        if (result.saved.data.siteText) {
          writeSiteTextDraft(result.saved.data.siteText);
          setSiteText(getSiteText());
        }

        setServerSavedAt(result.saved.savedAt);
        setVersion((current) => current + 1);
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'sync_unavailable') {
          console.warn('Public archive sync skipped:', error);
        }
      }
    }

    void loadPublicArchive();

    return () => {
      ignore = true;
    };
  }, []);

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
          <p className="section-kicker">{siteText.missingKicker}</p>
          <h1 lang="ko">{siteText.missingTitle}</h1>
          <a className="archive-cta" href={detailRootHref()}>
            {siteText.detailBackLabel}
          </a>
        </main>
      </div>
    );
  }

  return (
    <EventDetail
      event={event}
      onSaved={() => setVersion((current) => current + 1)}
      onServerSavedAt={setServerSavedAt}
      serverSavedAt={serverSavedAt}
      siteText={siteText}
    />
  );
}
