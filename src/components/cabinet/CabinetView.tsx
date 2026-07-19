import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Curiosity, User } from '../../types';
import { resizeImage } from '../../utils/imageUtils';
import { uploadCabinetImage } from '../../utils/cabinetMedia';
import { useDialogFocus } from '../../utils/useDialogFocus';

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
  const context = item.encountered.context || item.encountered.place || item.encountered.dateLabel;
  return `${elapsed} · ${context}`;
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

function CuriosityMeta({ item, compact = false }: { item: Curiosity; compact?: boolean }) {
  return (
    <dl className={`cabinet-provenance${compact ? ' is-compact' : ''}`}>
      <div>
        <dt lang="en">Source</dt>
        <dd>
          {item.source.url ? (
            <a href={item.source.url} target="_blank" rel="noreferrer">{item.source.institution}</a>
          ) : item.source.institution}
          {item.source.reference && <small>{item.source.reference}</small>}
        </dd>
      </div>
      <div>
        <dt lang="en">Encountered</dt>
        <dd>
          {item.encountered.place && <span>{item.encountered.place}</span>}
          <small>{item.encountered.dateLabel}</small>
          {!compact && item.encountered.context && <small>{item.encountered.context}</small>}
        </dd>
      </div>
    </dl>
  );
}

function CabinetCard({
  item,
  collector,
  isBookmarked,
  onOpen,
  onBookmark,
}: {
  item: Curiosity;
  collector: string;
  isBookmarked: boolean;
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
            <h3 lang="en">{item.title}</h3>
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
        {item.maker && <p className="cabinet-maker">{item.maker}</p>}
        <p className="cabinet-reflection" lang="ko">{item.reflection}</p>
        <ul className="cabinet-tags" aria-label="Curiosity tags">
          {item.tags.slice(0, 4).map((tag) => <li key={tag}>{tag}</li>)}
        </ul>
        <CuriosityMeta item={item} compact />
        <p className="cabinet-card-foot">
          <span lang="ko">수집자 {collector}</span>
          <span>{item.visibility === 'private' ? 'Private folio' : 'Shared folio'}</span>
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
      onNotice?.('이미지 파일만 Cabinet에 넣을 수 있습니다.');
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
      imageAlt: form.imageAlt.trim() || `${form.title.trim()} Cabinet 표본`,
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
    onNotice?.(previous ? 'Cabinet 표본의 새 판본을 봉인했습니다.' : '새 표본을 Cabinet에 들였습니다.');
  };

  const deleteCuriosity = () => {
    if (!editor?.itemId) return;
    onChange(curiosities.filter((item) => item.id !== editor.itemId));
    setEditor(null);
    setDetailId(null);
    setDetailRoute(null);
    onNotice?.('표본을 Cabinet에서 꺼내 별도 기록으로 돌려보냈습니다.');
  };

  if (detail) {
    const collector = names.get(detail.ownerId) || 'Unknown collector';
    const canEdit = detail.ownerId === user.id;
    const librarianLine = related[0]
      ? `이 표본은 ${related[0].title}와 ${detail.theme}의 표식 및 ${detail.tags.filter((tag) => related[0].tags.includes(tag)).join(', ') || '닮은 긴장'}을 함께 품고 있습니다.`
      : `당신의 Cabinet에서 아직 홀로 놓인 ${detail.theme}의 표본입니다. 다음에 닮은 흔적이 들어오면 곁에 놓일 것입니다.`;

    return (
      <section className="cabinet-detail" aria-labelledby="cabinet-detail-title">
        <div className="cabinet-detail-nav">
          <button type="button" onClick={() => { setDetailId(null); setDetailRoute(null); }}><span aria-hidden="true">←</span> Cabinet으로</button>
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
          <p className="cabinet-detail-index">Curiosity {String(curiosities.indexOf(detail) + 1).padStart(3, '0')}</p>
          <h2 id="cabinet-detail-title" lang="en">{detail.title}</h2>
          {detail.maker && <p className="cabinet-detail-maker">{detail.maker}</p>}
          <p className="cabinet-detail-reflection" lang="ko">{detail.reflection}</p>
        </header>
        <div className="cabinet-detail-body">
          <article>
            <p lang="ko">{detail.notes || detail.reflection}</p>
            <ul className="cabinet-tags" aria-label="Curiosity tags">
              {detail.tags.map((tag) => <li key={tag}>{tag}</li>)}
            </ul>
          </article>
          <aside>
            <CuriosityMeta item={detail} />
            <dl className="cabinet-object-facts">
              <div><dt>Theme</dt><dd>{detail.theme}</dd></div>
              <div><dt>Medium</dt><dd>{detail.medium}</dd></div>
              <div><dt>Century</dt><dd>{detail.century}</dd></div>
              <div><dt>Region</dt><dd>{detail.region}</dd></div>
              <div><dt>Collector</dt><dd>{collector}</dd></div>
              <div><dt>Folio</dt><dd>{detail.visibility === 'private' ? 'Private' : 'Shared'}</dd></div>
            </dl>
            {canEdit && <button className="cabinet-text-action" type="button" onClick={() => openEdit(detail)}>이 표본의 기록 다듬기</button>}
          </aside>
        </div>
        <aside className="cabinet-librarian-note" aria-label="Librarian guidance">
          <p lang="en">A note from the old librarian</p>
          <strong lang="ko">{librarianLine}</strong>
        </aside>
        <section className="cabinet-related" aria-labelledby="cabinet-related-title">
          <header>
            <p lang="en">Nearby curiosities</p>
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
          <span>Private repository</span>
          <span>Folio I</span>
        </p>
        <div>
          <h2 id="cabinet-title" lang="en">Cabinet</h2>
          <p lang="en">A Repository of Collected Wonders</p>
        </div>
        <blockquote lang="ko">
          한 사람의 시선을 바꾼 사물과 문장, 생물과 장소가 출처를 잃지 않은 채 오래 머무는 방.
        </blockquote>
      </header>

      <section className="cabinet-owner" aria-labelledby="cabinet-owner-title">
        <div>
          <p lang="en">Personal collection</p>
          <h3 id="cabinet-owner-title" lang="en">Cabinet of <span lang="ko">{user.name}</span></h3>
          <strong>{mine.length} Curiosities</strong>
        </div>
        <dl>
          <div>
            <dt>Themes</dt>
            <dd>{unique(mine.map((item) => item.theme)).slice(0, 5).join(' / ') || '아직 이름 붙지 않은 관심'}</dd>
          </div>
          <div>
            <dt>First object</dt>
            <dd>{[...mine].sort((a, b) => a.collectedAt.localeCompare(b.collectedAt))[0]?.encountered.dateLabel || '첫 표본을 기다리는 중'}</dd>
          </div>
        </dl>
      </section>

      {rediscovery && (
        <section className="cabinet-rediscovery" aria-labelledby="cabinet-rediscovery-title">
          <figure>
            <img src={rediscovery.image} alt={rediscovery.imageAlt} loading="eager" decoding="async" />
          </figure>
          <div>
            <p lang="en">Returned to the reading table</p>
            <h3 id="cabinet-rediscovery-title" lang="en">{rediscovery.title}</h3>
            <p lang="ko">{rediscovery.reflection}</p>
            <small>{rediscoveryLine(rediscovery)}</small>
            <button type="button" onClick={() => openDetail(rediscovery)}>다시 펼쳐보기</button>
          </div>
        </section>
      )}

      <section className="cabinet-catalogue" aria-labelledby="cabinet-catalogue-title">
        <header>
          <div>
            <p lang="en">The catalogue</p>
            <h3 id="cabinet-catalogue-title" lang="ko">천천히 넘겨보는 표본 장부</h3>
          </div>
          <div className="cabinet-scope" aria-label="Cabinet collection scope">
            <button type="button" aria-pressed={scope === 'mine'} onClick={() => setScope('mine')}>나의 Cabinet</button>
            <button type="button" aria-pressed={scope === 'circle'} onClick={() => setScope('circle')}>공동 열람실</button>
          </div>
        </header>

        <div className="cabinet-tools" role="search" aria-label="Cabinet search and organization">
          <label className="cabinet-search">
            <span lang="en">Find</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목, 표식, 출처, 만남 검색" />
          </label>
          <div className="cabinet-shelves" aria-label="Cabinet shelves">
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
            <label><span>Theme</span><select value={theme} onChange={(event) => setTheme(event.target.value)}><option value="">All themes</option>{themes.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Medium</span><select value={medium} onChange={(event) => setMedium(event.target.value)}><option value="">All media</option>{media.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Century</span><select value={century} onChange={(event) => setCentury(event.target.value)}><option value="">All centuries</option>{centuries.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Region</span><select value={region} onChange={(event) => setRegion(event.target.value)}><option value="">All regions</option>{regions.map((value) => <option key={value}>{value}</option>)}</select></label>
          </div>
        </div>

        <div className="cabinet-result-line">
          <p><strong>{filtered.length}</strong> curiosities · {shelfLabel(shelf)}</p>
          {(query || theme || medium || century || region || shelf !== 'all') && <button type="button" onClick={clearFilters}>분류 지우기</button>}
        </div>

        {pageItems.length > 0 ? (
          <div className="cabinet-grid">
            {pageItems.map((item) => (
              <CabinetCard
                key={item.id}
                item={item}
                collector={names.get(item.ownerId) || 'Unknown collector'}
                isBookmarked={item.bookmarkedBy.includes(user.id)}
                onOpen={() => openDetail(item)}
                onBookmark={() => toggleBookmark(item)}
              />
            ))}
          </div>
        ) : (
          <div className="cabinet-empty">
            <p lang="en">This drawer is quiet.</p>
            <strong lang="ko">아직 이 분류에 놓인 표본이 없습니다.</strong>
            <button type="button" onClick={clearFilters}>다른 서랍 열기</button>
          </div>
        )}

        {pageCount > 1 && (
          <nav className="cabinet-pagination" aria-label="Cabinet catalogue pages">
            <button type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>이전 장</button>
            <span>{page} / {pageCount}</span>
            <button type="button" disabled={page === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>다음 장</button>
          </nav>
        )}
      </section>

      {scope === 'mine' && (
        <section className="cabinet-contribute" aria-labelledby="cabinet-contribute-title">
          <div>
            <p lang="en">A place remains unfilled</p>
            <h3 id="cabinet-contribute-title" lang="ko">오래 간직할 만한 것을 만났다면</h3>
            <p lang="ko">무엇인지보다 어디에서 왔고, 당신이 언제 만났는지를 먼저 기억해 주세요.</p>
          </div>
          <button type="button" onClick={openNew}>새 표본 들이기 <span aria-hidden="true">🜔</span></button>
        </section>
      )}

      {editor && (
        <div className="cabinet-editor-backdrop" role="dialog" aria-modal="true" aria-labelledby="cabinet-editor-title">
          <div className="cabinet-editor" ref={editorRef}>
            <header>
              <div>
                <p lang="en">Accession register</p>
                <h2 id="cabinet-editor-title" lang="ko">{editor.mode === 'new' ? '새 표본 들이기' : '표본 기록 다듬기'}</h2>
              </div>
              <button type="button" onClick={() => setEditor(null)} aria-label="Cabinet editor 닫기">×</button>
            </header>
            <form onSubmit={saveCuriosity}>
              <fieldset>
                <legend>Object</legend>
                <label><span>Title</span><input required value={form.title} onChange={(event) => updateForm('title', event.target.value)} /></label>
                <label><span>Maker / Author</span><input value={form.maker} onChange={(event) => updateForm('maker', event.target.value)} /></label>
                <label className="is-wide"><span>Short reflection</span><textarea required rows={3} value={form.reflection} onChange={(event) => updateForm('reflection', event.target.value)} /></label>
                <label className="is-wide"><span>Long note</span><textarea rows={7} value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} /></label>
              </fieldset>
              <fieldset>
                <legend>Image</legend>
                <label className="is-wide cabinet-file-field"><span>Image file</span><input type="file" accept="image/*" onChange={(event) => { void prepareImage(event.target.files?.[0]); }} /><small>{isPreparingImage ? '도판을 장부에 맞게 준비하는 중…' : imageStorageNote}</small></label>
                <label className="is-wide"><span>or Image URL</span><input value={form.image.startsWith('data:') ? '' : form.image} onChange={(event) => updateForm('image', event.target.value)} placeholder="https://…" /></label>
                {form.image && <figure className="cabinet-editor-preview"><img src={form.image} alt="선택한 표본 미리보기" /></figure>}
                <label className="is-wide"><span>Image description</span><input value={form.imageAlt} onChange={(event) => updateForm('imageAlt', event.target.value)} placeholder="보이지 않을 때에도 표본을 이해할 수 있는 설명" /></label>
              </fieldset>
              <fieldset>
                <legend>Classification</legend>
                <label><span>Theme</span><input required value={form.theme} onChange={(event) => updateForm('theme', event.target.value)} placeholder="Mysticism" /></label>
                <label><span>Medium</span><input required value={form.medium} onChange={(event) => updateForm('medium', event.target.value)} placeholder="Manuscript" /></label>
                <label><span>Century</span><input required value={form.century} onChange={(event) => updateForm('century', event.target.value)} placeholder="15th century" /></label>
                <label><span>Region</span><input required value={form.region} onChange={(event) => updateForm('region', event.target.value)} placeholder="France" /></label>
                <label className="is-wide"><span>Tags</span><input value={form.tags} onChange={(event) => updateForm('tags', event.target.value)} placeholder="bird, forest, pilgrimage" /></label>
              </fieldset>
              <fieldset className="cabinet-history-fields">
                <legend>Two histories</legend>
                <div>
                  <h3 lang="en">Source</h3>
                  <p lang="ko">이 사물이 어디에서 왔는지 기록합니다.</p>
                  <label><span>Institution / Book / Personal Photograph</span><input required value={form.sourceInstitution} onChange={(event) => updateForm('sourceInstitution', event.target.value)} /></label>
                  <label><span>Shelfmark / Page</span><input value={form.sourceReference} onChange={(event) => updateForm('sourceReference', event.target.value)} /></label>
                  <label><span>Source URL</span><input type="url" value={form.sourceUrl} onChange={(event) => updateForm('sourceUrl', event.target.value)} /></label>
                </div>
                <div>
                  <h3 lang="en">Encountered</h3>
                  <p lang="ko">이 사물이 당신의 삶에 들어온 순간을 기록합니다.</p>
                  <label><span>Place</span><input value={form.encounteredPlace} onChange={(event) => updateForm('encounteredPlace', event.target.value)} placeholder="Paris" /></label>
                  <label><span>Date / Season</span><input required value={form.encounteredDate} onChange={(event) => updateForm('encounteredDate', event.target.value)} placeholder="October 2028" /></label>
                  <label><span>Context</span><input value={form.encounteredContext} onChange={(event) => updateForm('encounteredContext', event.target.value)} placeholder="Read during the Rose Cycle" /></label>
                </div>
              </fieldset>
              <fieldset>
                <legend>Folio</legend>
                <label><span>Collected date</span><input required type="date" value={form.collectedAt} onChange={(event) => updateForm('collectedAt', event.target.value)} /></label>
                <label><span>Visibility</span><select value={form.visibility} onChange={(event) => updateForm('visibility', event.target.value)}><option value="private">Private · 나만 열람</option><option value="public">Shared · 회원 열람실</option></select></label>
              </fieldset>
              <footer>
                {editor.mode === 'edit' && (
                  <div className="cabinet-delete">
                    {!confirmDelete ? (
                      <button type="button" onClick={() => setConfirmDelete(true)}>Cabinet에서 꺼내기</button>
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
