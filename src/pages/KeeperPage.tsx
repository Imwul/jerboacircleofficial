import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { events, type ArchiveEvent, type EventStatus } from '../data/events';
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
  const [version, setVersion] = useState(0);
  const archiveEvents = useMemo(() => applyArchiveDrafts(events), [version]);
  const [selectedId, setSelectedId] = useState(archiveEvents[0].id);
  const selectedEvent = archiveEvents.find((event) => event.id === selectedId) ?? archiveEvents[0];
  const [form, setForm] = useState(() => toFormState(selectedEvent));
  const draftCount = useMemo(() => Object.keys(readArchiveDrafts()).length, [version]);
  const [serverKey, setServerKey] = useState(() => localStorage.getItem('jerboa_keeper_sync_key') || '');
  const [syncStatus, setSyncStatus] = useState('서버 보관소 대기');
  const isDirty = JSON.stringify(form) !== JSON.stringify(toFormState(selectedEvent));

  function selectEvent(event: ArchiveEvent) {
    setSelectedId(event.id);
    setForm(toFormState(event));
  }

  function updateField<Key extends keyof KeeperFormState>(key: Key, value: KeeperFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    writeArchiveDraft(selectedEvent.id, toDraft(form));
    setVersion((current) => current + 1);
    setSyncStatus(`로컬 초안 저장됨 / ${timeLabel()}`);
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
      const drafts = {
        ...readArchiveDrafts(),
        ...(isDirty ? { [selectedEvent.id]: toDraft(form) } : {}),
      };
      const result = await saveServerSync('archive', { drafts }, serverKey);
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
      const result = await loadServerSync<{ drafts: ArchiveDraftMap }>('archive', serverKey);
      if (result.exists && result.saved?.data?.drafts) {
        writeArchiveDrafts(result.saved.data.drafts);
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
          <a href="/">기록벽</a>
          <a href="/members/">회원실</a>
        </nav>
      </header>

      <main className="keeper-room">
        <aside className="keeper-register" aria-label="Programme register">
          <p className="section-kicker">Keeper desk / marginal edition room</p>
          <h1>Register of passages</h1>
          <p lang="ko">
            포스터 / 문구 / 여정 / 자료 묶음을 고쳐 Circle의 보이는 기억에 반영합니다
          </p>
          <p className="keeper-draft-count" lang="ko">
            {isDirty ? '저장되지 않은 수정 있음' : `저장된 초안 ${draftCount}`}
          </p>
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
        </aside>

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
      </main>
    </div>
  );
}
