import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { events, type ArchiveEvent, type EventStatus } from '../data/events';
import { defaultSiteText, type SiteText } from '../data/siteText';
import {
  applyArchiveDrafts,
  clearAllArchiveDrafts,
  clearArchiveDraft,
  readArchiveDrafts,
  writeArchiveDraft,
  writeArchiveDrafts,
  type ArchiveEventDraft,
  type ArchiveDraftMap,
} from '../utils/archiveDrafts';
import { loadServerSync, saveServerSync } from '../utils/serverSync';
import {
  clearSiteTextDraft,
  getSiteText,
  mergeSiteText,
  writeSiteTextDraft,
} from '../utils/siteTextDrafts';
import './HomePage.css';

interface KeeperFormState {
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

interface ArchiveSyncPayload {
  drafts?: ArchiveDraftMap;
  siteText?: Partial<SiteText>;
}

const siteTextFields: Array<{
  key: keyof SiteText;
  label: string;
  area?: boolean;
}> = [
  { key: 'wordmarkSmall', label: '헤더 작은 문구' },
  { key: 'navFeaturedEn', label: '탭 1 영어' },
  { key: 'navFeaturedKo', label: '탭 1 한글' },
  { key: 'navArchiveEn', label: '탭 2 영어' },
  { key: 'navArchiveKo', label: '탭 2 한글' },
  { key: 'navManifestoEn', label: '탭 3 영어' },
  { key: 'navManifestoKo', label: '탭 3 한글' },
  { key: 'navJoinEn', label: '탭 4 영어' },
  { key: 'navJoinKo', label: '탭 4 한글' },
  { key: 'navMembersEn', label: '탭 5 영어' },
  { key: 'navMembersKo', label: '탭 5 한글' },
  { key: 'mastheadRing', label: '인장 원형 문구', area: true },
  { key: 'mastheadCaptionEn', label: '인장 캡션 영어' },
  { key: 'mastheadCaptionKo', label: '인장 캡션 한글' },
  { key: 'mastheadIntroEn', label: '대문 영어 문장', area: true },
  { key: 'mastheadIntroKo', label: '대문 한글 설명', area: true },
  { key: 'orientationKickerEn', label: '첫 안내 영어 표제' },
  { key: 'orientationKickerKo', label: '첫 안내 한글 표제' },
  { key: 'orientationStatementKo', label: '첫 안내 핵심 설명', area: true },
  { key: 'orientationCurrentKo', label: '첫 안내 / 현재 프로그램' },
  { key: 'orientationArchiveKo', label: '첫 안내 / 지난 기록' },
  { key: 'orientationPrivateKo', label: '첫 안내 / 회원 장부' },
  { key: 'ritualOne', label: '의식 1' },
  { key: 'ritualTwo', label: '의식 2' },
  { key: 'ritualThree', label: '의식 3' },
  { key: 'ritualFour', label: '의식 4' },
  { key: 'featuredKickerEn', label: '현재 프로그램 영어 표제' },
  { key: 'featuredKickerKo', label: '현재 프로그램 한글 표제' },
  { key: 'featuredAnnotation', label: '현재 프로그램 한글 주석', area: true },
  { key: 'journeyLabel', label: '여정 표 제목' },
  { key: 'materialsLabel', label: '자료 표 제목' },
  { key: 'metaEdition', label: '메타 / 판본' },
  { key: 'metaDate', label: '메타 / 일자' },
  { key: 'metaStatus', label: '메타 / 상태' },
  { key: 'metaFormat', label: '메타 / 형식' },
  { key: 'statusCurrent', label: '상태 / 현재' },
  { key: 'statusUpcoming', label: '상태 / 예정' },
  { key: 'statusPast', label: '상태 / 지난 기록' },
  { key: 'archiveKickerEn', label: '아카이브 영어 표제' },
  { key: 'archiveKickerKo', label: '아카이브 한글 표제' },
  { key: 'archiveHeading', label: '아카이브 큰 문장', area: true },
  { key: 'manifestoKickerEn', label: '소개 영어 표제' },
  { key: 'manifestoKickerKo', label: '소개 한글 표제' },
  { key: 'manifestoBody', label: '소개 본문', area: true },
  { key: 'joinKickerEn', label: '문의 영어 표제' },
  { key: 'joinKickerKo', label: '문의 한글 표제' },
  { key: 'joinHeading', label: '문의 큰 문장', area: true },
  { key: 'joinCtaLabel', label: '문의 버튼 문구' },
  { key: 'joinCtaHref', label: '문의 버튼 링크' },
  { key: 'footerLeft', label: '푸터 왼쪽' },
  { key: 'footerRight', label: '푸터 오른쪽' },
  { key: 'detailNavArchiveEn', label: '상세 / 기록벽 영어' },
  { key: 'detailNavArchiveKo', label: '상세 / 기록벽 한글' },
  { key: 'detailNavMembersEn', label: '상세 / 회원실 영어' },
  { key: 'detailNavMembersKo', label: '상세 / 회원실 한글' },
  { key: 'detailKickerKo', label: '상세 / 표제 한글' },
  { key: 'detailThemeLabel', label: '상세 / 주제 라벨' },
  { key: 'detailBackLabel', label: '상세 / 돌아가기 버튼' },
  { key: 'missingKicker', label: '없는 기록 / 표제' },
  { key: 'missingTitle', label: '없는 기록 / 제목' },
];

function toFormState(event: ArchiveEvent): KeeperFormState {
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

function toDraft(form: KeeperFormState): ArchiveEventDraft {
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
    passage: form.passageText
      .split(/\n|\//)
      .map((item) => item.trim())
      .filter(Boolean),
    materials: form.materialsText
      .split(/\n|\//)
      .map((item) => item.trim())
      .filter(Boolean),
    themes: form.themesText
      .split(/\n|\//)
      .map((theme) => theme.trim())
      .filter(Boolean),
    location: form.location,
    ctaLabel: form.ctaLabel,
  };
}

function timeLabel(date = new Date()) {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function KeeperPage() {
  const [mode, setMode] = useState<'events' | 'text'>(() => (
    window.location.pathname.replace(/\/+$/, '').endsWith('/godmode') ? 'text' : 'events'
  ));
  const [version, setVersion] = useState(0);
  const archiveEvents = useMemo(() => applyArchiveDrafts(events), [version]);
  const [selectedId, setSelectedId] = useState(archiveEvents[0].id);
  const selectedEvent = archiveEvents.find((event) => event.id === selectedId) ?? archiveEvents[0];
  const [form, setForm] = useState(() => toFormState(selectedEvent));
  const [siteTextForm, setSiteTextForm] = useState<SiteText>(() => getSiteText());
  const draftCount = useMemo(() => Object.keys(readArchiveDrafts()).length, [version]);
  const [serverKey, setServerKey] = useState(() => localStorage.getItem('jerboa_keeper_sync_key') || '');
  const [syncStatus, setSyncStatus] = useState('서버 보관소 대기');
  const isDirty = JSON.stringify(form) !== JSON.stringify(toFormState(selectedEvent));
  const isTextDirty = JSON.stringify(siteTextForm) !== JSON.stringify(getSiteText());

  function selectEvent(event: ArchiveEvent) {
    setSelectedId(event.id);
    setForm(toFormState(event));
  }

  function updateField<Key extends keyof KeeperFormState>(key: Key, value: KeeperFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateSiteTextField(key: keyof SiteText, value: string) {
    setSiteTextForm((current) => ({ ...current, [key]: value }));
  }

  function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    writeArchiveDraft(selectedEvent.id, toDraft(form));
    setVersion((current) => current + 1);
    setSyncStatus(`로컬 초안 저장됨 / ${timeLabel()}`);
  }

  function saveSiteTextDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    writeSiteTextDraft(siteTextForm);
    setSyncStatus(`문구실 저장됨 / ${timeLabel()}`);
  }

  function resetSiteTextDraft() {
    clearSiteTextDraft();
    setSiteTextForm(defaultSiteText);
    setSyncStatus('문구실 원본 복원됨');
  }

  function resetDraft() {
    clearArchiveDraft(selectedEvent.id);
    const baseEvent = events.find((event) => event.id === selectedEvent.id) ?? events[0];
    setForm(toFormState(baseEvent));
    setVersion((current) => current + 1);
    setSyncStatus('선택 기록 원본 복원됨');
  }

  function updateServerKey(value: string) {
    setServerKey(value);
    localStorage.setItem('jerboa_keeper_sync_key', value);
  }

  async function saveArchiveToServer() {
    try {
      if (isDirty) {
        writeArchiveDraft(selectedEvent.id, toDraft(form));
      }
      setSyncStatus('서버 보관소 저장 중');
      if (mode === 'text' || isTextDirty) {
        writeSiteTextDraft(siteTextForm);
      }

      const drafts = {
        ...readArchiveDrafts(),
        ...(isDirty ? { [selectedEvent.id]: toDraft(form) } : {}),
      };
      const result = await saveServerSync<ArchiveSyncPayload>('archive', {
        drafts,
        siteText: siteTextForm,
      }, serverKey);
      setVersion((current) => current + 1);
      setSyncStatus(`서버 저장됨 / ${timeLabel(result.savedAt ? new Date(result.savedAt) : new Date())}`);
    } catch (error) {
      console.error('Archive server save failed:', error);
      setSyncStatus('서버 저장 실패 / 키 또는 연결 확인');
    }
  }

  async function loadArchiveFromServer() {
    try {
      setSyncStatus('서버 보관소 불러오는 중');
      const result = await loadServerSync<ArchiveSyncPayload>('archive', serverKey);
      if (result.exists && result.saved?.data) {
        if (result.saved.data.drafts) {
          writeArchiveDrafts(result.saved.data.drafts);
        }
        if (result.saved.data.siteText) {
          const nextSiteText = mergeSiteText(result.saved.data.siteText);
          writeSiteTextDraft(nextSiteText);
          setSiteTextForm(nextSiteText);
        }
        const nextEvents = applyArchiveDrafts(events);
        const nextSelected = nextEvents.find((event) => event.id === selectedId) ?? nextEvents[0];
        setForm(toFormState(nextSelected));
        setVersion((current) => current + 1);
        setSyncStatus(`서버 초안 적용됨 / ${timeLabel(new Date(result.saved.savedAt))}`);
      } else {
        setSyncStatus('서버에 저장된 초안 없음');
      }
    } catch (error) {
      console.error('Archive server load failed:', error);
      setSyncStatus('서버 불러오기 실패 / 키 또는 연결 확인');
    }
  }

  function downloadArchiveDrafts() {
    const payload = {
      type: 'jerboa-archive-drafts',
      version: 1,
      exportedAt: new Date().toISOString(),
      drafts: readArchiveDrafts(),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `jerboa-archive-drafts-${new Date().toISOString().slice(0, 16).replace(':', '')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importArchiveDrafts(file: File) {
    try {
      const payload = JSON.parse(await file.text());
      const drafts = payload.drafts || payload.data?.drafts || payload;
      if (!drafts || typeof drafts !== 'object') {
        throw new Error('Invalid draft file');
      }
      writeArchiveDrafts(drafts);
      const nextEvents = applyArchiveDrafts(events);
      const nextSelected = nextEvents.find((event) => event.id === selectedId) ?? nextEvents[0];
      setForm(toFormState(nextSelected));
      setVersion((current) => current + 1);
      setSyncStatus('초안 파일 적용됨');
    } catch (error) {
      console.error('Archive draft import failed:', error);
      setSyncStatus('초안 파일을 읽을 수 없음');
    }
  }

  function clearEveryDraft() {
    if (!confirm('모든 포스터 초안을 지울까요? 공개 원본 데이터는 유지됩니다.')) return;
    clearAllArchiveDrafts();
    const baseEvent = events.find((event) => event.id === selectedId) ?? events[0];
    setForm(toFormState(baseEvent));
    setVersion((current) => current + 1);
    setSyncStatus('모든 로컬 초안 삭제됨');
  }

  function readPosterFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        updateField('posterImage', reader.result);
      }
    });
    reader.readAsDataURL(file);
  }

  return (
    <div className="public-home keeper-home">
      <header className="archive-header">
        <a className="archive-wordmark" href="/" aria-label="Jerboa Circle archive home">
          <span>Jerboa</span>
          <span>Circle</span>
          <small lang="ko">기록 보관자</small>
        </a>
        <nav className="archive-nav keeper-nav" aria-label="Keeper navigation">
          <a className="archive-nav-memory" href="/"><span lang="ko">기록벽</span></a>
          <a className="archive-private-door" href="/members/"><span lang="ko">회원실</span></a>
          <a className="archive-nav-textroom" href="/godmode/"><span lang="ko">문구실</span></a>
        </nav>
      </header>

      <main className="keeper-room">
        <aside className="keeper-register" aria-label="Programme register">
          <p className="section-kicker">Keeper desk / marginal edition room</p>
          <h1>Register of passages</h1>
          <p lang="ko">
            포스터 / 문구 / 여정 / 자료 묶음을 고쳐 Circle의 보이는 기억에 반영합니다
          </p>
          <ul className="keeper-purpose-list">
            <li lang="ko">프로그램 모드에서는 포스터와 개별 기록을 수정합니다</li>
            <li lang="ko">문구실에서는 공개 화면의 고정 문장을 수정합니다</li>
            <li lang="ko">서버 저장을 눌러 여러 사람에게 같은 기록을 보여줍니다</li>
          </ul>
          <p className="keeper-draft-count" lang="ko">
            {mode === 'text'
              ? isTextDirty ? '저장되지 않은 문구실 수정 있음' : '문구실 준비됨'
              : isDirty ? '저장되지 않은 수정 있음' : `저장된 초안 ${draftCount}`}
          </p>
          <div className="keeper-mode-switch" aria-label="Keeper mode">
            <button
              className={mode === 'events' ? 'is-active' : ''}
              onClick={() => setMode('events')}
              type="button"
            >
              프로그램
            </button>
            <button
              className={mode === 'text' ? 'is-active' : ''}
              onClick={() => setMode('text')}
              type="button"
            >
              문구실
            </button>
          </div>
          <div className="keeper-sync-panel" aria-label="Archive sync controls">
            <label>
              <span>서버 키</span>
              <input
                type="password"
                value={serverKey}
                onChange={(event) => updateServerKey(event.target.value)}
                placeholder="보관자 열쇠"
              />
            </label>
            <div className="keeper-sync-actions">
              <button type="button" onClick={saveArchiveToServer}>서버 저장</button>
              <button type="button" onClick={loadArchiveFromServer}>서버 불러오기</button>
              <button type="button" onClick={downloadArchiveDrafts}>파일 백업</button>
              <label>
                파일 적용
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) {
                      void importArchiveDrafts(file);
                      event.currentTarget.value = '';
                    }
                  }}
                />
              </label>
              <button type="button" onClick={clearEveryDraft}>초안 삭제</button>
            </div>
            <small>{syncStatus}</small>
          </div>
          {mode === 'events' ? (
            <div className="keeper-list">
              {archiveEvents.map((event) => (
                <button
                  className={event.id === selectedId ? 'is-selected' : ''}
                  key={event.id}
                  onClick={() => selectEvent(event)}
                  type="button"
                >
                  <span>{event.edition}</span>
                  <strong>{event.title}</strong>
                  <small>{event.date}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="keeper-list">
              <button className="is-selected" type="button">
                <span>✠ Text room</span>
                <strong>Text register</strong>
                <small>모든 고정 문구</small>
              </button>
            </div>
          )}
        </aside>

        {mode === 'text' ? (
          <section className="keeper-editor godmode-editor" aria-label="Site text editor">
            <div className="keeper-preview godmode-preview">
              <div>
                <span>✠ Text room</span>
                <h2>Text register</h2>
                <p lang="ko">공개 기록벽의 고정 문구를 이곳에서 직접 고칩니다.</p>
              </div>
            </div>

            <form className="keeper-form godmode-form" onSubmit={saveSiteTextDraft}>
              <div className="keeper-editor-heading">
                <p className="section-kicker">Text room / site language</p>
                <h2>Text fields</h2>
              </div>

              <div className="godmode-field-grid">
                {siteTextFields.map((field) => (
                  <label className="keeper-field godmode-field" key={field.key}>
                    <span>{field.label}</span>
                    {field.area ? (
                      <textarea
                        rows={field.key === 'manifestoBody' ? 5 : 3}
                        value={siteTextForm[field.key]}
                        onChange={(event) => updateSiteTextField(field.key, event.target.value)}
                      />
                    ) : (
                      <input
                        value={siteTextForm[field.key]}
                        onChange={(event) => updateSiteTextField(field.key, event.target.value)}
                      />
                    )}
                  </label>
                ))}
              </div>

              <div className="keeper-actions">
                <button className="archive-cta" type="submit">문구 초안 저장</button>
                <button className="archive-cta inverse" onClick={resetSiteTextDraft} type="button">문구 원본 복원</button>
                <button className="archive-cta" onClick={saveArchiveToServer} type="button">서버 저장</button>
                <a className="archive-cta" href="/">공개 화면 보기</a>
              </div>
            </form>
          </section>
        ) : (
          <section className="keeper-editor" aria-label="Selected archive record editor">
          <div className="keeper-preview">
            <img src={form.posterImage} alt={`${form.title} poster preview`} />
          </div>

          <form className="keeper-form" onSubmit={saveDraft}>
            <div className="keeper-editor-heading">
              <p className="section-kicker">{selectedEvent.edition} / 편집 중</p>
              <h2>{form.title}</h2>
            </div>

            <label className="keeper-field">
              <span>판본</span>
              <input value={form.edition} onChange={(event) => updateField('edition', event.target.value)} />
            </label>

            <label className="keeper-field">
              <span>제목</span>
              <input value={form.title} onChange={(event) => updateField('title', event.target.value)} />
            </label>

            <label className="keeper-field">
              <span>부제</span>
              <input value={form.subtitle} onChange={(event) => updateField('subtitle', event.target.value)} />
            </label>

            <label className="keeper-field">
              <span>라틴 문장</span>
              <input value={form.latinQuote} onChange={(event) => updateField('latinQuote', event.target.value)} />
            </label>

            <label className="keeper-field">
              <span>여백 주석</span>
              <textarea
                rows={2}
                value={form.marginalia}
                onChange={(event) => updateField('marginalia', event.target.value)}
              />
            </label>

            <div className="keeper-field-grid">
              <label className="keeper-field">
                <span>일자</span>
                <input value={form.date} onChange={(event) => updateField('date', event.target.value)} />
              </label>

              <label className="keeper-field">
                <span>상태</span>
                <select value={form.status} onChange={(event) => updateField('status', event.target.value as EventStatus)}>
                  <option value="current">current</option>
                  <option value="upcoming">upcoming</option>
                  <option value="past">past</option>
                </select>
              </label>
            </div>

            <label className="keeper-field">
              <span>포스터 이미지 URL</span>
              <input value={form.posterImage} onChange={(event) => updateField('posterImage', event.target.value)} />
            </label>

            <label className="keeper-field">
              <span>포스터 이미지 업로드</span>
              <input accept="image/*" onChange={readPosterFile} type="file" />
            </label>

            <label className="keeper-field">
              <span>짧은 설명</span>
              <textarea
                rows={3}
                value={form.shortDescription}
                onChange={(event) => updateField('shortDescription', event.target.value)}
              />
            </label>

            <label className="keeper-field">
              <span>긴 설명</span>
              <textarea
                rows={5}
                value={form.longDescription}
                onChange={(event) => updateField('longDescription', event.target.value)}
              />
            </label>

            <label className="keeper-field">
              <span>여정 단계</span>
              <textarea
                rows={3}
                value={form.passageText}
                onChange={(event) => updateField('passageText', event.target.value)}
              />
            </label>

            <label className="keeper-field">
              <span>자료 묶음</span>
              <textarea
                rows={3}
                value={form.materialsText}
                onChange={(event) => updateField('materialsText', event.target.value)}
              />
            </label>

            <label className="keeper-field">
              <span>주제</span>
              <textarea
                rows={3}
                value={form.themesText}
                onChange={(event) => updateField('themesText', event.target.value)}
              />
            </label>

            <div className="keeper-field-grid">
              <label className="keeper-field">
                <span>형식</span>
                <input value={form.location} onChange={(event) => updateField('location', event.target.value)} />
              </label>

              <label className="keeper-field">
                <span>버튼 문구</span>
                <input value={form.ctaLabel} onChange={(event) => updateField('ctaLabel', event.target.value)} />
              </label>
            </div>

            <div className="keeper-actions">
              <button className="archive-cta" type="submit">초안 저장</button>
              <button className="archive-cta inverse" onClick={resetDraft} type="button">원본 복원</button>
              <a className="archive-cta" href="/">공개 화면 보기</a>
            </div>

            <aside className="keeper-record-preview" aria-label="Public archive record preview">
              <span>{form.edition}</span>
              <h3>{form.title}</h3>
              <p>{form.subtitle}</p>
              <p>{form.marginalia}</p>
              <small>{form.shortDescription}</small>
            </aside>
          </form>
          </section>
        )}
      </main>
    </div>
  );
}
