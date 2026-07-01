import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { events, type ArchiveEvent, type EventStatus } from '../data/events';
import {
  applyArchiveDrafts,
  clearArchiveDraft,
  readArchiveDrafts,
  writeArchiveDraft,
  type ArchiveEventDraft,
} from '../utils/archiveDrafts';
import './HomePage.css';

interface KeeperFormState {
  edition: string;
  title: string;
  subtitle: string;
  latinQuote: string;
  date: string;
  status: EventStatus;
  posterImage: string;
  shortDescription: string;
  longDescription: string;
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
    date: event.date,
    status: event.status,
    posterImage: event.posterImage,
    shortDescription: event.shortDescription,
    longDescription: event.longDescription,
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
    date: form.date,
    status: form.status,
    posterImage: form.posterImage,
    shortDescription: form.shortDescription,
    longDescription: form.longDescription,
    themes: form.themesText
      .split(/\n|\//)
      .map((theme) => theme.trim())
      .filter(Boolean),
    location: form.location,
    ctaLabel: form.ctaLabel,
  };
}

export default function KeeperPage() {
  const [version, setVersion] = useState(0);
  const archiveEvents = useMemo(() => applyArchiveDrafts(events), [version]);
  const [selectedId, setSelectedId] = useState(archiveEvents[0].id);
  const selectedEvent = archiveEvents.find((event) => event.id === selectedId) ?? archiveEvents[0];
  const [form, setForm] = useState(() => toFormState(selectedEvent));
  const draftCount = useMemo(() => Object.keys(readArchiveDrafts()).length, [version]);

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
  }

  function resetDraft() {
    clearArchiveDraft(selectedEvent.id);
    const baseEvent = events.find((event) => event.id === selectedEvent.id) ?? events[0];
    setForm(toFormState(baseEvent));
    setVersion((current) => current + 1);
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
          <p className="section-kicker">Keeper mode / local draft room</p>
          <h1>Archive cabinet</h1>
          <p lang="ko">
            포스터와 문구를 임시로 고쳐 보고 같은 브라우저의 공개 화면에 반영합니다
          </p>
          <p className="keeper-draft-count" lang="ko">저장된 초안 {draftCount}</p>
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
          </form>
        </section>
      </main>
    </div>
  );
}
