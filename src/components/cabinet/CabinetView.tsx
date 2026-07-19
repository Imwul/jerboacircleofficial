import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Curiosity, User } from '../../types';
import { resizeImage } from '../../utils/imageUtils';
import { uploadCabinetImage } from '../../utils/cabinetMedia';
import { useDialogFocus } from '../../utils/useDialogFocus';
import { readArchiveBookmarks } from '../../utils/readingMarks';

type CabinetScope = 'mine' | 'circle';
type CabinetShelf = 'all' | 'bookmarked' | 'private' | 'public' | 'recent' | 'rediscovered';

interface CabinetViewProps {
  user: User;
  users: User[];
  curiosities: Curiosity[];
  onChange: (curiosities: Curiosity[]) => void;
  onNotice?: (message: string) => void;
  syncKey?: string;
  authSession?: string | null;
}

interface CuriosityFormState {
  title: string;
  maker: string;
  reflection: string;
  notes: string;
  image: string;
  imageAlt: string;
  theme: string;
  medium: string;
  century: string;
  region: string;
  tags: string;
  sourceInstitution: string;
  sourceReference: string;
  sourceUrl: string;
  encounteredPlace: string;
  encounteredDate: string;
  encounteredContext: string;
  collectedAt: string;
  visibility: Curiosity['visibility'];
}

// Three objects make one deliberate catalogue leaf and prevent the repository
// from turning into a long feed, especially on narrow screens.
const PAGE_SIZE = 3;

function emptyForm(): CuriosityFormState {
  return {
    title: '',
    maker: '',
    reflection: '',
    notes: '',
    image: '',
    imageAlt: '',
    theme: '',
    medium: '',
    century: '',
    region: '',
    tags: '',
    sourceInstitution: '',
    sourceReference: '',
    sourceUrl: '',
    encounteredPlace: '',
    encounteredDate: '',
    encounteredContext: '',
    collectedAt: new Date().toISOString().slice(0, 10),
    visibility: 'private',
  };
}

function formFrom(item: Curiosity): CuriosityFormState {
  return {
    title: item.title,
    maker: item.maker || '',
    reflection: item.reflection,
    notes: item.notes || '',
    image: item.image,
    imageAlt: item.imageAlt,
    theme: item.theme,
    medium: item.medium,
    century: item.century,
    region: item.region,
    tags: item.tags.join(', '),
    sourceInstitution: item.source.institution,
    sourceReference: item.source.reference || '',
    sourceUrl: item.source.url || '',
    encounteredPlace: item.encountered.place || '',
    encounteredDate: item.encountered.dateLabel,
    encounteredContext: item.encountered.context || '',
    collectedAt: item.collectedAt,
    visibility: item.visibility,
  };
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function contentLanguage(value: string): 'ko' | 'en' {
  return /[가-힣]/.test(value) ? 'ko' : 'en';
}

function daysSince(value?: string) {
  if (!value) return Number.POSITIVE_INFINITY;
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

function rediscoveryLine(item: Curiosity) {
  const collectedDays = daysSince(item.collectedAt);
  const years = Math.floor(collectedDays / 365);
  const elapsed = years > 0 ? `${years}년 전 수집` : `${Math.max(1, collectedDays)}일 전 수집`;
  const context = displayEncounterContext(item.encountered.context || item.encountered.place || item.encountered.dateLabel);
  return `${elapsed} · ${context}`;
}

const displayTermMap: Record<string, string> = {
  Gnosticism: '영지주의',
  Kabbalah: '카발라',
  Mysticism: '신비주의',
  Pilgrimage: '순례',
  Manuscript: '필사본',
  Watercolour: '수채화',
  'Etching with watercolour': '채색 동판화',
  Britain: '영국',
  France: '프랑스',
};

function displayTerm(value: string) {
  const century = value.match(/^(\d+)(?:st|nd|rd|th) century$/i);
  if (century) return `${century[1]}세기`;
  return displayTermMap[value] || value;
}

function displayDateLabel(value: string) {
  const monthMap: Record<string, string> = {
    January: '1월', February: '2월', March: '3월', April: '4월', May: '5월', June: '6월',
    July: '7월', August: '8월', September: '9월', October: '10월', November: '11월', December: '12월',
  };
  const monthMatch = value.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthMatch && monthMap[monthMatch[1]]) return `${monthMatch[2]}년 ${monthMap[monthMatch[1]]}`;

  const seasonMatch = value.match(/^(Spring|Summer|Autumn|Winter)\s+(\d{4})$/i);
  if (seasonMatch) {
    const seasonMap: Record<string, string> = {
      spring: '봄', summer: '여름', autumn: '가을', winter: '겨울',
    };
    return `${seasonMatch[2]}년 ${seasonMap[seasonMatch[1].toLowerCase()]}`;
  }

  const weekMatch = value.match(/^Week\s+([IVXLCDM]+)\s*·\s*(\d{4})$/i);
  if (weekMatch) {
    const weekMap: Record<string, number> = {
      I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6,
      VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12,
    };
    const week = weekMap[weekMatch[1].toUpperCase()];
    return week ? `${weekMatch[2]}년 ${week}주차` : `${weekMatch[2]}년 ${weekMatch[1]}주차`;
  }

  const cycleMatch = value.match(/^(.+?)\s+Cycle\s*·\s*(\d{4})$/i);
  if (cycleMatch) {
    const cycleMap: Record<string, string> = { Forest: '숲', Fire: '불', Rose: '장미' };
    return `${cycleMatch[2]}년 ${cycleMap[cycleMatch[1]] || cycleMatch[1]} 순환`;
  }

  return value;
}

function displayEncounterContext(value: string) {
  return {
    'Read during the Fire Cycle': '불의 순환을 읽던 중',
    'Found while preparing the Forest Cycle': '숲의 순환을 준비하던 중',
    'First encountered while reading about angelic alphabets': '천사 문자에 관한 책을 읽다가 처음 만남',
    'Shared after a reading on symbolic doubles': '상징적 분신에 관한 낭독 뒤 함께 나눔',
    'Chosen for the opening folio': '첫 장을 위해 고른 표본',
    'Seen after visiting a manuscript room': '필사본 열람실을 다녀온 뒤 만남',
    'Collected while studying the Rose Cycle': '장미 순환을 공부하던 중 수집',
    'Found on a first visit': '첫 방문에서 발견',
  }[value] || value;
}

function shelfLabel(shelf: CabinetShelf) {
  return {
    all: '전체 표본',
    bookmarked: '책갈피',
    private: '비공개',
    public: '공개',
    recent: '최근 수집',
    rediscovered: '오래 못 본 표본',
  }[shelf];
}

function connectionLabel(item: Curiosity, pool: Curiosity[]) {
  const candidate = pool
    .filter((entry) => entry.id !== item.id)
    .map((entry) => {
      const sharedTags = item.tags.filter((tag) => entry.tags.includes(tag));
      return {
        entry,
        sharedTags,
        affinity: (entry.theme === item.theme ? 3 : 0) + sharedTags.length,
      };
    })
    .filter(({ affinity }) => affinity > 0)
    .sort((a, b) => b.affinity - a.affinity)[0];

  if (!candidate) return '';
  const sharedMark = candidate.sharedTags[0] || (candidate.entry.theme === item.theme ? item.theme : '닮은 긴장');
  return `${displayTerm(sharedMark)} 표식으로 이어짐`;
}

function CuriosityMeta({ item, compact = false }: { item: Curiosity; compact?: boolean }) {
  const dateLabel = displayDateLabel(item.encountered.dateLabel);
  const encounteredContext = item.encountered.context ? displayEncounterContext(item.encountered.context) : '';

  return (
    <dl className={`cabinet-provenance${compact ? ' is-compact' : ''}`}>
      <div>
        <dt lang="ko">출처</dt>
        <dd>
          {item.source.url ? (
            <a lang={contentLanguage(item.source.institution)} href={item.source.url} target="_blank" rel="noreferrer">{item.source.institution}</a>
          ) : <span lang={contentLanguage(item.source.institution)}>{item.source.institution}</span>}
          {item.source.reference && <small lang={contentLanguage(item.source.reference)}>{item.source.reference}</small>}
        </dd>
      </div>
      <div>
        <dt lang="ko">만난 때</dt>
        <dd>
          {item.encountered.place && <span lang={contentLanguage(item.encountered.place)}>{item.encountered.place}</span>}
          <small className={`cabinet-encounter-date${contentLanguage(dateLabel) === 'ko' ? ' cabinet-ko-line' : ''}`} lang={contentLanguage(dateLabel)}>{dateLabel}</small>
          {!compact && encounteredContext && <small className="cabinet-encounter-context" lang={contentLanguage(encounteredContext)}>{encounteredContext}</small>}
        </dd>
      </div>
    </dl>
  );
}

function CabinetCard({
  item,
  collector,
  isBookmarked,
  connection,
  onOpen,
  onBookmark,
}: {
  item: Curiosity;
  collector: string;
  isBookmarked: boolean;
  connection?: string;
  onOpen: () => void;
  onBookmark: () => void;
}) {
  return (
    <article className="cabinet-card">
      <button className="cabinet-card-image" type="button" onClick={onOpen} aria-label={`${item.title} 표본 열기`}>
        <img src={item.image} alt={item.imageAlt} loading="lazy" decoding="async" />
      </button>
      <div className="cabinet-card-copy">
        <div className="cabinet-card-heading">
          <button type="button" onClick={onOpen}>
            <h3 lang="en" data-title-length={item.title.length > 32 ? 'long' : 'regular'}>{item.title}</h3>
          </button>
          <button
            className="cabinet-bookmark"
            type="button"
            aria-pressed={isBookmarked}
            aria-label={`${item.title} ${isBookmarked ? '책갈피 해제' : '책갈피 표시'}`}
            onClick={onBookmark}
          >
            {isBookmarked ? '✦' : '✧'}
          </button>
        </div>
        <div className="cabinet-card-intro">
          {item.maker && <p className="cabinet-maker" lang={contentLanguage(item.maker)}>{item.maker}</p>}
          <p className="cabinet-reflection" lang="ko">{item.reflection}</p>
        </div>
        <ul className="cabinet-tags" aria-label="표본의 표식">
          {item.tags.slice(0, 4).map((tag) => <li key={tag}><span lang={contentLanguage(tag)}>{tag}</span></li>)}
        </ul>
        <CuriosityMeta item={item} compact />
        <p className="cabinet-card-foot">
          <span lang="ko">수집자 {collector}</span>
          <span lang="ko">{connection || (item.visibility === 'private' ? '비공개 장부' : '공개 장부')}</span>
        </p>
      </div>
    </article>
  );
}

export function CabinetView({ user, users, curiosities, onChange, onNotice, syncKey, authSession }: CabinetViewProps) {
  const [scope, setScope] = useState<CabinetScope>('mine');
  const [shelf, setShelf] = useState<CabinetShelf>('all');
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState('');
  const [medium, setMedium] = useState('');
  const [century, setCentury] = useState('');
  const [region, setRegion] = useState('');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('curiosity'));
  const [editor, setEditor] = useState<{ mode: 'new' | 'edit'; itemId?: string } | null>(null);
  const [form, setForm] = useState<CuriosityFormState>(emptyForm);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [imageStorageNote, setImageStorageNote] = useState('긴 변 1800px로 조용히 정돈해 보관합니다.');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editorRef = useDialogFocus<HTMLDivElement>(Boolean(editor), () => setEditor(null));

  const names = useMemo(() => new Map(users.map((member) => [member.id, member.name])), [users]);
  const mine = useMemo(() => curiosities.filter((item) => item.ownerId === user.id), [curiosities, user.id]);
  const visiblePool = useMemo(() => (
    scope === 'mine'
      ? mine
      : curiosities.filter((item) => item.visibility === 'public')
  ), [curiosities, mine, scope]);

  const themes = useMemo(() => unique(visiblePool.map((item) => item.theme)), [visiblePool]);
  const media = useMemo(() => unique(visiblePool.map((item) => item.medium)), [visiblePool]);
  const centuries = useMemo(() => unique(visiblePool.map((item) => item.century)), [visiblePool]);
  const regions = useMemo(() => unique(visiblePool.map((item) => item.region)), [visiblePool]);

  const rediscovery = useMemo(() => {
    return [...mine].sort((a, b) => {
      const aDate = a.lastViewedAt || a.createdAt;
      const bDate = b.lastViewedAt || b.createdAt;
      return aDate.localeCompare(bDate);
    })[0];
  }, [mine]);

  const lastOpened = useMemo(() => (
    [...mine]
      .filter((item) => item.lastViewedAt)
      .sort((a, b) => (b.lastViewedAt || '').localeCompare(a.lastViewedAt || ''))[0]
  ), [mine]);
  const publicArchiveBookmarkCount = readArchiveBookmarks().length;

  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    let result = visiblePool.filter((item) => {
      if (theme && item.theme !== theme) return false;
      if (medium && item.medium !== medium) return false;
      if (century && item.century !== century) return false;
      if (region && item.region !== region) return false;
      if (shelf === 'bookmarked' && !item.bookmarkedBy.includes(user.id)) return false;
      if (shelf === 'private' && item.visibility !== 'private') return false;
      if (shelf === 'public' && item.visibility !== 'public') return false;
      if (search) {
        const haystack = [
          item.title,
          item.maker,
          item.reflection,
          item.notes,
          item.theme,
          item.medium,
          item.century,
          item.region,
          item.source.institution,
          item.source.reference,
          item.encountered.place,
          item.encountered.context,
          ...item.tags,
        ].filter(Boolean).join(' ').toLocaleLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    if (shelf === 'recent') result = [...result].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else if (shelf === 'rediscovered') result = [...result].sort((a, b) => (a.lastViewedAt || a.createdAt).localeCompare(b.lastViewedAt || b.createdAt));
    else result = [...result].sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
    return result;
  }, [visiblePool, theme, medium, century, region, shelf, query, user.id]);

  useEffect(() => setPage(1), [scope, shelf, query, theme, medium, century, region]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const detail = detailId ? curiosities.find((item) => item.id === detailId) || null : null;

  const related = useMemo(() => {
    if (!detail) return [];
    return curiosities
      .filter((item) => item.id !== detail.id && (item.visibility === 'public' || item.ownerId === user.id))
      .map((item) => ({
        item,
        affinity: (item.theme === detail.theme ? 3 : 0) + item.tags.filter((tag) => detail.tags.includes(tag)).length,
      }))
      .filter(({ affinity }) => affinity > 0)
      .sort((a, b) => b.affinity - a.affinity)
      .slice(0, 3)
      .map(({ item }) => item);
  }, [curiosities, detail, user.id]);

  const clearFilters = () => {
    setShelf('all');
    setQuery('');
    setTheme('');
    setMedium('');
    setCentury('');
    setRegion('');
  };

  const setDetailRoute = (itemId: string | null) => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', 'cabinet');
    if (itemId) url.searchParams.set('curiosity', itemId);
    else url.searchParams.delete('curiosity');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const openDetail = (item: Curiosity) => {
    setDetailId(item.id);
    setDetailRoute(item.id);
    onChange(curiosities.map((entry) => entry.id === item.id ? { ...entry, lastViewedAt: new Date().toISOString() } : entry));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleBookmark = (item: Curiosity) => {
    const next = item.bookmarkedBy.includes(user.id)
      ? item.bookmarkedBy.filter((id) => id !== user.id)
      : [...item.bookmarkedBy, user.id];
    onChange(curiosities.map((entry) => entry.id === item.id ? { ...entry, bookmarkedBy: next, updatedAt: new Date().toISOString() } : entry));
  };

  const openNew = () => {
    setForm(emptyForm());
    setImageStorageNote('긴 변 1800px로 조용히 정돈해 보관합니다.');
    setConfirmDelete(false);
    setEditor({ mode: 'new' });
  };

  const openEdit = (item: Curiosity) => {
    setForm(formFrom(item));
    setImageStorageNote(item.image.startsWith('data:') ? '이 기기에 보관된 도판입니다.' : '별도 이미지 보관소에 연결된 도판입니다.');
    setConfirmDelete(false);
    setDetailId(null);
    setDetailRoute(null);
    setEditor({ mode: 'edit', itemId: item.id });
  };

  const updateForm = (field: keyof CuriosityFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const prepareImage = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onNotice?.('이미지 파일만 수장고에 넣을 수 있습니다.');
      return;
    }
    if (file.size > 15_000_000) {
      onNotice?.('이미지가 15MB를 넘습니다. 더 작은 원본을 골라주세요.');
      return;
    }
    setIsPreparingImage(true);
    try {
      const resized = await resizeImage(file, 1800, 1800);
      if (syncKey?.trim() || authSession) {
        setImageStorageNote('공동 이미지 보관소에 봉인하는 중…');
        try {
          const uploadedUrl = await uploadCabinetImage(resized, file.name, syncKey, authSession);
          setForm((current) => ({ ...current, image: uploadedUrl }));
          setImageStorageNote('공동 이미지 보관소에 연결되었습니다.');
        } catch (uploadError) {
          console.warn('Cabinet remote media storage unavailable:', uploadError);
          setForm((current) => ({ ...current, image: resized }));
          setImageStorageNote('공동 보관소가 잠시 닫혀 이 기기에 보관합니다.');
        }
      } else {
        setForm((current) => ({ ...current, image: resized }));
        setImageStorageNote('공동 장부 열쇠가 없어 이 기기에 보관합니다.');
      }
    } catch (error) {
      console.error('Cabinet image preparation failed:', error);
      onNotice?.('도판을 준비하지 못했습니다. 다른 이미지를 골라주세요.');
    } finally {
      setIsPreparingImage(false);
    }
  };

  const saveCuriosity = (event: FormEvent) => {
    event.preventDefault();
    const now = new Date().toISOString();
    if (!form.image.trim()) {
      onNotice?.('표본을 기억할 도판이나 사진을 더해주세요.');
      return;
    }
    const previous = editor?.itemId ? curiosities.find((item) => item.id === editor.itemId) : undefined;
    const item: Curiosity = {
      id: previous?.id || `curiosity-${Date.now().toString(36)}`,
      ownerId: previous?.ownerId || user.id,
      title: form.title.trim(),
      maker: form.maker.trim() || undefined,
      reflection: form.reflection.trim(),
      notes: form.notes.trim() || undefined,
      image: form.image.trim(),
      imageAlt: form.imageAlt.trim() || `${form.title.trim()} 수장고 표본`,
      theme: form.theme.trim(),
      medium: form.medium.trim(),
      century: form.century.trim(),
      region: form.region.trim(),
      tags: unique(form.tags.split(',').map((tag) => tag.trim())),
      source: {
        institution: form.sourceInstitution.trim(),
        reference: form.sourceReference.trim() || undefined,
        url: form.sourceUrl.trim() || undefined,
      },
      encountered: {
        place: form.encounteredPlace.trim() || undefined,
        dateLabel: form.encounteredDate.trim(),
        context: form.encounteredContext.trim() || undefined,
      },
      collectedAt: form.collectedAt,
      createdAt: previous?.createdAt || now,
      updatedAt: now,
      lastViewedAt: previous?.lastViewedAt,
      bookmarkedBy: previous?.bookmarkedBy || [],
      visibility: form.visibility,
    };
    const next = previous
      ? curiosities.map((entry) => entry.id === item.id ? item : entry)
      : [item, ...curiosities];
    onChange(next);
    setEditor(null);
    setDetailId(item.id);
    setDetailRoute(item.id);
    onNotice?.(previous ? '수장고 표본의 새 판본을 봉인했습니다.' : '새 표본을 수장고에 들였습니다.');
  };

  const deleteCuriosity = () => {
    if (!editor?.itemId) return;
    onChange(curiosities.filter((item) => item.id !== editor.itemId));
    setEditor(null);
    setDetailId(null);
    setDetailRoute(null);
    onNotice?.('표본을 수장고에서 꺼내 별도 기록으로 돌려보냈습니다.');
  };

  if (detail) {
    const collector = names.get(detail.ownerId) || '이름 없는 수집자';
    const canEdit = detail.ownerId === user.id;
    const librarianLine = related[0]
      ? `이 표본은 ${related[0].title}와 ${displayTerm(detail.theme)}의 표식 및 ${detail.tags.filter((tag) => related[0].tags.includes(tag)).join(', ') || '닮은 긴장'}을 함께 품고 있습니다.`
      : `당신의 수장고에서 아직 홀로 놓인 ${displayTerm(detail.theme)}의 표본입니다. 다음에 닮은 흔적이 들어오면 곁에 놓일 것입니다.`;

    return (
      <section className="cabinet-detail" aria-labelledby="cabinet-detail-title">
        <div className="cabinet-detail-nav">
          <button type="button" onClick={() => { setDetailId(null); setDetailRoute(null); }}><span aria-hidden="true">←</span> 수장고로</button>
          <button
            className="cabinet-bookmark"
            type="button"
            aria-pressed={detail.bookmarkedBy.includes(user.id)}
            onClick={() => toggleBookmark(detail)}
          >
            {detail.bookmarkedBy.includes(user.id) ? '✦ 책갈피됨' : '✧ 책갈피'}
          </button>
        </div>
        <figure className="cabinet-detail-image">
          <img src={detail.image} alt={detail.imageAlt} />
        </figure>
        <header className="cabinet-detail-header">
          <p className="cabinet-detail-index" lang="ko">표본 {String(curiosities.indexOf(detail) + 1).padStart(3, '0')}</p>
          <h2 id="cabinet-detail-title" lang="en">{detail.title}</h2>
          {detail.maker && <p className="cabinet-detail-maker" lang={contentLanguage(detail.maker)}>{detail.maker}</p>}
          <p className="cabinet-detail-reflection" lang="ko">{detail.reflection}</p>
        </header>
        <div className="cabinet-detail-body">
          <article>
            <p lang="ko">{detail.notes || detail.reflection}</p>
            <ul className="cabinet-tags" aria-label="표본의 표식">
              {detail.tags.map((tag) => <li key={tag}><span lang={contentLanguage(tag)}>{tag}</span></li>)}
            </ul>
          </article>
          <aside>
            <CuriosityMeta item={detail} />
            <dl className="cabinet-object-facts">
              <div><dt lang="ko">주제</dt><dd lang="ko">{displayTerm(detail.theme)}</dd></div>
              <div><dt lang="ko">형식</dt><dd lang="ko">{displayTerm(detail.medium)}</dd></div>
              <div><dt lang="ko">시대</dt><dd lang="ko">{displayTerm(detail.century)}</dd></div>
              <div><dt lang="ko">지역</dt><dd lang="ko">{displayTerm(detail.region)}</dd></div>
              <div><dt lang="ko">수집자</dt><dd lang="ko">{collector}</dd></div>
              <div><dt lang="ko">공개 범위</dt><dd lang="ko">{detail.visibility === 'private' ? '비공개' : '공개'}</dd></div>
            </dl>
            {canEdit && <button className="cabinet-text-action" type="button" onClick={() => openEdit(detail)}><span lang="ko">이 표본의 기록 다듬기</span></button>}
          </aside>
        </div>
        <aside className="cabinet-librarian-note" aria-label="옛 사서의 메모">
          <p lang="ko">옛 사서의 메모</p>
          <strong lang="ko">{librarianLine}</strong>
        </aside>
        <section className="cabinet-related" aria-labelledby="cabinet-related-title">
          <header>
            <h3 id="cabinet-related-title" lang="ko">같은 표식을 품은 다른 표본</h3>
          </header>
          {related.length > 0 ? (
            <div>
              {related.map((item) => (
                <button type="button" key={item.id} onClick={() => openDetail(item)}>
                  <img src={item.image} alt="" loading="lazy" />
                  <span lang="en">{item.title}</span>
                  <small>{item.theme} · {item.medium}</small>
                </button>
              ))}
            </div>
          ) : <p lang="ko">아직 이 표본 곁에 놓을 만한 닮은 기록이 없습니다.</p>}
        </section>
      </section>
    );
  }

  return (
    <section className="cabinet-view" aria-labelledby="cabinet-title">
      <header className="cabinet-opening">
        <p className="cabinet-opening-number">
          <span lang="ko">개인 수장고</span>
          <span lang="ko">첫 장</span>
        </p>
        <div>
          <h2 id="cabinet-title" lang="en">Cabinet</h2>
        </div>
        <blockquote lang="ko">
          한 사람의 시선을 바꾼 사물과 문장, 생물과 장소가 출처를 잃지 않은 채 오래 머무는 방.
        </blockquote>
      </header>

      <section className="cabinet-owner" aria-labelledby="cabinet-owner-title">
        <div>
          <h3 id="cabinet-owner-title" lang="ko">{user.name}의 수장고</h3>
          <strong lang="ko">표본 {mine.length}점</strong>
        </div>
        <dl>
          <div>
            <dt lang="ko">주요 표식</dt>
            <dd><span className="cabinet-ko-line" lang="ko">{unique(mine.map((item) => displayTerm(item.theme))).slice(0, 5).join(' / ') || '아직 이름 붙지 않은 관심'}</span></dd>
          </div>
          <div>
            <dt lang="ko">첫 표본</dt>
            <dd><span className="cabinet-ko-line" lang="ko">{displayDateLabel([...mine].sort((a, b) => a.collectedAt.localeCompare(b.collectedAt))[0]?.encountered.dateLabel || '첫 표본을 기다리는 중')}</span></dd>
          </div>
          <div>
            <dt lang="ko">마지막으로 펼침</dt>
            <dd>
              {lastOpened ? (
                <button className="cabinet-owner-link" type="button" lang="en" onClick={() => openDetail(lastOpened)}>{lastOpened.title}</button>
              ) : <span className="cabinet-ko-line" lang="ko">아직 다시 펼친 표본이 없습니다</span>}
            </dd>
          </div>
          <div>
            <dt lang="ko">남긴 표식</dt>
            <dd>
              <span className="cabinet-ko-line" lang="ko">
                <button className="cabinet-owner-link" type="button" onClick={() => setShelf('bookmarked')}>수장고 {mine.filter((item) => item.bookmarkedBy.includes(user.id)).length}</button>
                <span aria-hidden="true"> · </span>
                <a className="cabinet-owner-link" href={`/?filed=1#archive`}>공개 기록 {publicArchiveBookmarkCount}</a>
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {rediscovery && (
        <section className="cabinet-rediscovery" aria-labelledby="cabinet-rediscovery-title">
          <figure>
            <img src={rediscovery.image} alt={rediscovery.imageAlt} loading="eager" decoding="async" />
          </figure>
          <div>
            <p lang="ko">다시 펼친 표본</p>
            <h3 id="cabinet-rediscovery-title" lang="en">{rediscovery.title}</h3>
            <p lang="ko">{rediscovery.reflection}</p>
            <small lang="ko">{rediscoveryLine(rediscovery)}</small>
            <button type="button" onClick={() => openDetail(rediscovery)}>다시 펼쳐보기</button>
          </div>
        </section>
      )}

      <section className="cabinet-catalogue" aria-labelledby="cabinet-catalogue-title">
        <header>
          <div>
            <h3 id="cabinet-catalogue-title" lang="ko">천천히 넘겨보는 표본 장부</h3>
          </div>
          <div className="cabinet-scope" aria-label="수장고 열람 범위">
            <button type="button" aria-pressed={scope === 'mine'} onClick={() => setScope('mine')}>나의 수장고</button>
            <button type="button" aria-pressed={scope === 'circle'} onClick={() => setScope('circle')}>공동 열람실</button>
          </div>
        </header>

        <div className="cabinet-tools" role="search" aria-label="수장고 찾기와 분류">
          <label className="cabinet-search">
            <span lang="ko">찾기</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목, 표식, 출처, 만남 검색" />
          </label>
          <div className="cabinet-shelves" aria-label="수장고 서랍">
            {(['all', 'bookmarked', 'private', 'public', 'recent', 'rediscovered'] as CabinetShelf[]).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={shelf === value}
                disabled={scope === 'circle' && value === 'private'}
                onClick={() => setShelf(value)}
              >
                {shelfLabel(value)}
              </button>
            ))}
          </div>
          <div className="cabinet-facets">
            <label><span>주제</span><select value={theme} onChange={(event) => setTheme(event.target.value)}><option value="">전체 주제</option>{themes.map((value) => <option key={value} value={value}>{displayTerm(value)}</option>)}</select></label>
            <label><span>형식</span><select value={medium} onChange={(event) => setMedium(event.target.value)}><option value="">전체 형식</option>{media.map((value) => <option key={value} value={value}>{displayTerm(value)}</option>)}</select></label>
            <label><span>시대</span><select value={century} onChange={(event) => setCentury(event.target.value)}><option value="">전체 시대</option>{centuries.map((value) => <option key={value} value={value}>{displayTerm(value)}</option>)}</select></label>
            <label><span>지역</span><select value={region} onChange={(event) => setRegion(event.target.value)}><option value="">전체 지역</option>{regions.map((value) => <option key={value} value={value}>{displayTerm(value)}</option>)}</select></label>
          </div>
        </div>

        <div className="cabinet-result-line">
          <p lang="ko"><strong>{filtered.length}</strong>점 · {shelfLabel(shelf)}</p>
          {(query || theme || medium || century || region || shelf !== 'all') && <button type="button" onClick={clearFilters}>분류 지우기</button>}
        </div>

        {pageItems.length > 0 ? (
          <div className="cabinet-grid">
            {pageItems.map((item) => (
              <CabinetCard
                key={item.id}
                item={item}
                collector={names.get(item.ownerId) || '이름 없는 수집자'}
                isBookmarked={item.bookmarkedBy.includes(user.id)}
                connection={connectionLabel(item, visiblePool)}
                onOpen={() => openDetail(item)}
                onBookmark={() => toggleBookmark(item)}
              />
            ))}
          </div>
        ) : (
          <div className="cabinet-empty">
            <strong lang="ko">이 서랍은 아직 조용합니다.</strong>
            {query && <a href={`/?q=${encodeURIComponent(query)}#archive`} lang="ko">공개 기록벽에서 “{query}” 이어 찾기</a>}
            <button type="button" onClick={clearFilters}>다른 서랍 열기</button>
          </div>
        )}

        {pageCount > 1 && (
          <nav className="cabinet-pagination" aria-label="수장고 장 넘기기">
            <button type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>이전 장</button>
            <span>{page} / {pageCount}</span>
            <button type="button" disabled={page === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>다음 장</button>
          </nav>
        )}
      </section>

      {scope === 'mine' && (
        <section className="cabinet-contribute" aria-labelledby="cabinet-contribute-title">
          <div>
            <h3 id="cabinet-contribute-title" lang="ko">오래 간직할 만한 것을 만났다면</h3>
            <p lang="ko">무엇인지보다 어디에서 왔고, 당신이 언제 만났는지를 먼저 기억해 주세요.</p>
          </div>
          <button type="button" onClick={openNew}>새 표본 들이기</button>
        </section>
      )}

      {editor && (
        <div className="cabinet-editor-backdrop" role="dialog" aria-modal="true" aria-labelledby="cabinet-editor-title">
          <div className="cabinet-editor" ref={editorRef}>
            <header>
              <div>
                <h2 id="cabinet-editor-title" lang="ko">{editor.mode === 'new' ? '새 표본 들이기' : '표본 기록 다듬기'}</h2>
              </div>
              <button type="button" onClick={() => setEditor(null)} aria-label="수장고 기록창 닫기">×</button>
            </header>
            <form onSubmit={saveCuriosity}>
              <fieldset>
                <legend>표본</legend>
                <label><span>제목</span><input required value={form.title} onChange={(event) => updateForm('title', event.target.value)} /></label>
                <label><span>제작자 / 저자</span><input value={form.maker} onChange={(event) => updateForm('maker', event.target.value)} /></label>
                <label className="is-wide"><span>짧은 문장</span><textarea required rows={3} value={form.reflection} onChange={(event) => updateForm('reflection', event.target.value)} /></label>
                <label className="is-wide"><span>긴 기록</span><textarea rows={7} value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} /></label>
              </fieldset>
              <fieldset>
                <legend>도판</legend>
                <label className="is-wide cabinet-file-field"><span>이미지 파일</span><input type="file" accept="image/*" onChange={(event) => { void prepareImage(event.target.files?.[0]); }} /><small>{isPreparingImage ? '도판을 장부에 맞게 준비하는 중…' : imageStorageNote}</small></label>
                <label className="is-wide"><span>또는 이미지 주소</span><input value={form.image.startsWith('data:') ? '' : form.image} onChange={(event) => updateForm('image', event.target.value)} placeholder="https://…" /></label>
                {form.image && <figure className="cabinet-editor-preview"><img src={form.image} alt="선택한 표본 미리보기" /></figure>}
                <label className="is-wide"><span>도판 설명</span><input value={form.imageAlt} onChange={(event) => updateForm('imageAlt', event.target.value)} placeholder="보이지 않을 때에도 표본을 이해할 수 있는 설명" /></label>
              </fieldset>
              <fieldset>
                <legend>분류</legend>
                <label><span>주제</span><input required value={form.theme} onChange={(event) => updateForm('theme', event.target.value)} placeholder="신비주의" /></label>
                <label><span>형식</span><input required value={form.medium} onChange={(event) => updateForm('medium', event.target.value)} placeholder="필사본" /></label>
                <label><span>시대</span><input required value={form.century} onChange={(event) => updateForm('century', event.target.value)} placeholder="15세기" /></label>
                <label><span>지역</span><input required value={form.region} onChange={(event) => updateForm('region', event.target.value)} placeholder="프랑스" /></label>
                <label className="is-wide"><span>표식</span><input value={form.tags} onChange={(event) => updateForm('tags', event.target.value)} placeholder="새, 숲, 순례" /></label>
              </fieldset>
              <fieldset className="cabinet-history-fields">
                <legend>두 개의 이력</legend>
                <div>
                  <h3 lang="ko">출처</h3>
                  <p lang="ko">이 사물이 어디에서 왔는지 기록합니다.</p>
                  <label><span>기관 / 책 / 개인 사진</span><input required value={form.sourceInstitution} onChange={(event) => updateForm('sourceInstitution', event.target.value)} /></label>
                  <label><span>청구기호 / 쪽</span><input value={form.sourceReference} onChange={(event) => updateForm('sourceReference', event.target.value)} /></label>
                  <label><span>출처 주소</span><input type="url" value={form.sourceUrl} onChange={(event) => updateForm('sourceUrl', event.target.value)} /></label>
                </div>
                <div>
                  <h3 lang="ko">만남</h3>
                  <p lang="ko">이 사물이 당신의 삶에 들어온 순간을 기록합니다.</p>
                  <label><span>장소</span><input value={form.encounteredPlace} onChange={(event) => updateForm('encounteredPlace', event.target.value)} placeholder="파리" /></label>
                  <label><span>날짜 / 계절</span><input required value={form.encounteredDate} onChange={(event) => updateForm('encounteredDate', event.target.value)} placeholder="2028년 10월" /></label>
                  <label><span>만난 맥락</span><input value={form.encounteredContext} onChange={(event) => updateForm('encounteredContext', event.target.value)} placeholder="장미 순환을 읽던 중" /></label>
                </div>
              </fieldset>
              <fieldset>
                <legend>장부</legend>
                <label><span>수집한 날</span><input required type="date" value={form.collectedAt} onChange={(event) => updateForm('collectedAt', event.target.value)} /></label>
                <label><span>공개 범위</span><select value={form.visibility} onChange={(event) => updateForm('visibility', event.target.value)}><option value="private">나만 열람</option><option value="public">회원 열람실에 공개</option></select></label>
              </fieldset>
              <footer>
                {editor.mode === 'edit' && (
                  <div className="cabinet-delete">
                    {!confirmDelete ? (
                      <button type="button" onClick={() => setConfirmDelete(true)}>수장고에서 꺼내기</button>
                    ) : (
                      <span><em>정말 꺼낼까요?</em><button type="button" onClick={deleteCuriosity}>꺼내기</button><button type="button" onClick={() => setConfirmDelete(false)}>그대로 두기</button></span>
                    )}
                  </div>
                )}
                <button type="submit" disabled={isPreparingImage}>{editor.mode === 'new' ? '표본 봉인하기' : '새 판본 봉인하기'}</button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
