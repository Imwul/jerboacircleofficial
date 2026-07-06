import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { ADMIN_PASSWORD } from '../constants';
import { events, type ArchiveEvent, type EventStatus } from '../data/events';
import type { SiteText } from '../data/siteText';
import {
  applyArchiveDrafts,
  readArchiveDrafts,
  writeArchiveDraft,
  writeArchiveDrafts,
  type ArchiveDraftMap,
  type ArchiveEventDraft,
} from '../utils/archiveDrafts';
import { loadServerSync, saveServerSync } from '../utils/serverSync';
import { getSiteText, writeSiteTextDraft } from '../utils/siteTextDrafts';
import { editorialPlates } from '../data/manuscriptPlates';
import { resizeImage } from '../utils/imageUtils';
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

function DetailKeeperPanel({ event, onSaved }: { event: ArchiveEvent; onSaved: () => void }) {
  const [code, setCode] = useState(() => localStorage.getItem('jerboa_keeper_sync_key') || '');
  const [unlocked, setUnlocked] = useState(false);
  const [form, setForm] = useState(() => toDetailForm(event));
  const [status, setStatus] = useState('Keeper seal이 닫혀 있습니다');

  const statusTone = status.includes('실패') || status.includes('닫혔') || status.includes('없음')
    ? 'warning'
    : status.includes('봉인') || status.includes('반영') || status.includes('준비')
      ? 'sealed'
      : 'idle';

  function updateField<Key extends keyof DetailFormState>(key: Key, value: DetailFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function unlockEditor() {
    if (!code.trim()) {
      setStatus('Keeper seal을 열 열쇠를 입력하세요');
      return;
    }

    localStorage.setItem('jerboa_keeper_sync_key', code);
    setUnlocked(true);
    setStatus(code === ADMIN_PASSWORD ? '로컬 초안층이 열렸습니다' : '공동 장부 열쇠로 초안층이 열렸습니다');
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
    writeArchiveDraft(event.id, toDetailDraft(form, event));
    setStatus('로컬 초안 보관 중');
    onSaved();
  }

  async function publishToServer() {
    try {
      const nextDraft = toDetailDraft(form, event);
      writeArchiveDraft(event.id, nextDraft);
      await saveServerSync<ArchiveSyncPayload>('archive', {
        drafts: {
          ...readArchiveDrafts(),
          [event.id]: nextDraft,
        },
        siteText: getSiteText(),
      }, code);
      setStatus('공동 장부에 봉인됨');
      onSaved();
    } catch (error) {
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
          placeholder="Keeper seal key"
        />
        <button type="button" onClick={unlockEditor}><span className="keeper-button-label">Seal 열기</span></button>
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
            <a href={`${detailRootHref()}godmode/`}><span className="keeper-button-label">Keeper Desk</span></a>
          </div>
        </form>
      )}
    </details>
  );
}

function EventDetail({ event, siteText, onSaved }: { event: ArchiveEvent; siteText: SiteText; onSaved: () => void }) {
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
              <dt lang={detailTextLang(siteText.detailThemeLabel)}>{siteText.detailThemeLabel}</dt>
              <dd lang={detailTextLang(event.themes.join(' / '))}>{event.themes.join(' / ')}</dd>
            </div>
          </dl>
          <a className="archive-cta" href={detailRootHref()}>
            {siteText.detailBackLabel}
          </a>
        </article>
      </main>
    </div>
  );
}

export default function ArchiveDetailPage({ id }: { id: string | undefined }) {
  const [version, setVersion] = useState(0);
  const [siteText, setSiteText] = useState(() => getSiteText());
  const archiveEvents = useMemo(() => applyArchiveDrafts(events), [version]);
  const event = useMemo(
    () => archiveEvents.find((archiveEvent) => archiveEvent.id === id),
    [archiveEvents, id],
  );

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

  return <EventDetail event={event} siteText={siteText} onSaved={() => setVersion((current) => current + 1)} />;
}
