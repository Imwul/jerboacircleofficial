import { useEffect, useMemo, useState } from 'react';
import { events, getPublicArchiveEvents } from '../data/events';
import {
  archiveReferenceKindLabel,
  archiveReferences,
  getArchiveReference,
  type ArchiveReferenceKind,
} from '../data/archiveKnowledge';
import { applyArchiveDrafts, writeArchiveDrafts, type ArchiveDraftMap } from '../utils/archiveDrafts';
import {
  applyArchiveReferenceDrafts,
  writeArchiveReferenceDrafts,
  type ArchiveReferenceDraftMap,
} from '../utils/archiveReferenceDrafts';
import { usePageMetadata } from '../utils/pageMetadata';
import { loadServerSync } from '../utils/serverSync';
import { getArchiveMediaAsset } from '../data/mediaAssets';
import './HomePage.css';
import './EditorialStability.css';
import '../JerboaCondoRefine.css';

const kinds: Array<ArchiveReferenceKind | 'all'> = ['all', 'book', 'artwork', 'quotation', 'image', 'place', 'theme'];

function readCatalogueQueryState() {
  const params = new URLSearchParams(window.location.search);
  const requestedKind = params.get('kind');
  return {
    query: params.get('q') ?? '',
    kind: kinds.includes(requestedKind as ArchiveReferenceKind | 'all')
      ? requestedKind as ArchiveReferenceKind | 'all'
      : 'all',
  };
}

function textLanguage(text: string) {
  return /[가-힣]/.test(text) ? 'ko' : 'en';
}

function BilingualLabel({ en, ko }: { en: string; ko: string }) {
  return (
    <>
      <span lang="en">{en}</span><span className="bilingual-divider" aria-hidden="true"> / </span><span lang="ko">{ko}</span>
    </>
  );
}

function referenceMetadata(reference: NonNullable<ReturnType<typeof getArchiveReference>>) {
  return [
    { en: 'Creator', ko: '만든 이', value: reference.creator },
    { en: 'Date', ko: '연도', value: reference.date },
    { en: 'Edition', ko: '판본', value: reference.edition },
    { en: 'Locator', ko: '쪽·행', value: reference.locator },
    { en: 'Language', ko: '언어', value: reference.language },
    { en: 'Rights', ko: '권리', value: reference.rights },
  ].filter((row): row is { en: string; ko: string; value: string } => Boolean(row.value));
}

function copyWithSelection(text: string) {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  return copied;
}

function CatalogueHeader() {
  return (
    <header className="archive-header" aria-label="Jerboa Circle catalogue navigation">
      <a className="archive-wordmark" href="/" aria-label="Jerboa Circle archive home">
        <span>Jerboa</span><span>Circle</span><small lang="la">Ad quaerendum.</small>
      </a>
      <nav className="archive-nav" aria-label="Catalogue navigation">
        <a className="archive-nav-memory" href="/#archive"><span className="nav-en">Memory</span><small lang="ko">프로그램 기록벽</small></a>
        <a className="archive-nav-fragments" href="/catalogue/" aria-current="page"><span className="nav-en">Catalogue</span><small lang="ko">자료의 계보</small></a>
        <a className="archive-private-door" href="/members/"><span className="nav-en">Scriptorium</span><small lang="ko">참여자 장부</small></a>
      </nav>
    </header>
  );
}

export default function CataloguePage({ id }: { id?: string }) {
  const [version, setVersion] = useState(0);
  const initialQuery = useMemo(readCatalogueQueryState, []);
  const [query, setQuery] = useState(initialQuery.query);
  const [kind, setKind] = useState<ArchiveReferenceKind | 'all'>(initialQuery.kind);
  const [copyStatus, setCopyStatus] = useState('');
  const publicEvents = useMemo(() => getPublicArchiveEvents(applyArchiveDrafts(events)), [version]);
  const references = useMemo(() => applyArchiveReferenceDrafts(archiveReferences), [version]);
  const selected = getArchiveReference(id, references);
  const selectedMedia = selected?.mediaAssetId ? getArchiveMediaAsset(selected.mediaAssetId) : undefined;
  const usedBy = selected ? publicEvents.filter((event) => event.referenceIds.includes(selected.id)) : [];
  const parent = selected?.parentId ? getArchiveReference(selected.parentId, references) : undefined;
  const children = selected ? references.filter((reference) => reference.parentId === selected.id) : [];
  const metadata = selected ? referenceMetadata(selected) : [];
  const visibleReferences = references.filter((reference) => {
    const kindMatches = kind === 'all' || reference.kind === kind;
    const text = [
      reference.title,
      reference.attribution,
      reference.creator,
      reference.date,
      reference.edition,
      reference.locator,
      reference.language,
      reference.rights,
      reference.citationNote,
      reference.description,
    ].filter(Boolean).join(' ').toLowerCase();
    return kindMatches && text.includes(query.trim().toLowerCase());
  });

  async function copyCitation() {
    if (!selected) return;
    const citation = selected.citationNote ?? [selected.creator ?? selected.attribution, selected.title, selected.edition, selected.locator]
      .filter(Boolean)
      .join(', ');
    let copied = false;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
      await Promise.race([
        navigator.clipboard.writeText(citation),
        new Promise((_, reject) => window.setTimeout(() => reject(new Error('clipboard_timeout')), 700)),
      ]);
      copied = true;
    } catch {
      copied = copyWithSelection(citation);
    }
    setCopyStatus(copied ? '인용 표기를 복사했습니다.' : '복사할 수 없습니다. 인용 표기를 직접 선택해주세요.');
  }

  usePageMetadata({
    title: selected ? `${selected.title} | Jerboa Circle Catalogue` : 'Reference Catalogue | Jerboa Circle',
    description: selected?.description ?? 'Books, artworks, quotations, images, places, and themes connected across Jerboa Circle programmes.',
    canonicalPath: selected ? `/catalogue/${selected.id}/` : '/catalogue/',
    type: selected ? 'article' : 'website',
    noIndex: Boolean(id && !selected),
  });

  useEffect(() => {
    let ignore = false;
    void loadServerSync<{ drafts?: ArchiveDraftMap; references?: ArchiveReferenceDraftMap }>('archive').then((result) => {
      if (ignore || !result.exists || !result.saved?.data) return;
      if (result.saved.data.drafts) writeArchiveDrafts(result.saved.data.drafts);
      if (result.saved.data.references) writeArchiveReferenceDrafts(result.saved.data.references);
      setVersion((current) => current + 1);
    }).catch((error) => {
      if (!(error instanceof Error) || error.message !== 'sync_unavailable') console.warn('Catalogue sync skipped:', error);
    });
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    if (id) return;
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (kind !== 'all') params.set('kind', kind);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`);
  }, [id, query, kind]);

  if (id && !selected) {
    return (
      <div className="public-home detail-home catalogue-home">
        <CatalogueHeader />
        <main className="missing-record">
          <p className="section-kicker">Uncatalogued fragment / 미필사 자료</p>
          <h1 lang="ko">이 자료는 아직 장부에 필사되지 않았습니다.</h1>
          <a className="archive-cta" href="/catalogue/"><span className="archive-cta-label">자료 장부로 돌아가기</span></a>
        </main>
      </div>
    );
  }

  return (
    <div className="public-home detail-home catalogue-home">
      <CatalogueHeader />
      <main className="catalogue-room">
        {selected ? (
          <article className="catalogue-detail">
            <p className="section-kicker"><span lang="en">{selected.kind}</span> / <span lang="ko">{archiveReferenceKindLabel(selected.kind)}</span></p>
            <h1 className={selected.title.length > 64 ? 'is-long-title' : undefined} lang={textLanguage(selected.title)}>{selected.title}</h1>
            {selected.attribution && (!selectedMedia || !selected.attribution.includes(selectedMedia.repositoryObjectId)) && (
              <p className={`event-subtitle${textLanguage(selected.attribution) === 'en' ? ' archive-body-en' : ''}`} lang={textLanguage(selected.attribution)}>{selected.attribution}</p>
            )}
            {selectedMedia && (
              <figure className="catalogue-media-asset">
                <img src={selectedMedia.src} alt={selectedMedia.altText} decoding="async" />
                <figcaption>
                  <strong className="archive-body-en" lang="en">{selectedMedia.repository}</strong>
                  <span className="archive-body-en" lang="en">{selectedMedia.repositoryObjectId}</span>
                </figcaption>
              </figure>
            )}
            <p className="detail-long" lang="ko">{selected.description}</p>

            {(metadata.length > 0 || selected.citationNote || selected.sourceUrl) && (
              <section className="catalogue-provenance" aria-labelledby="catalogue-provenance-title">
                <h2 id="catalogue-provenance-title"><BilingualLabel en="Source" ko="출처" /></h2>
                {metadata.length > 0 && (
                  <dl>
                    {metadata.map(({ en, ko, value }) => (
                      <div key={en}>
                        <dt><BilingualLabel en={en} ko={ko} /></dt>
                        <dd className={textLanguage(value) === 'en' ? 'archive-body-en' : undefined} lang={textLanguage(value)}>{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {selected.citationNote && <p><strong><BilingualLabel en="Citation" ko="인용" /></strong><span className={textLanguage(selected.citationNote) === 'en' ? 'archive-body-en' : undefined} lang={textLanguage(selected.citationNote)}>{selected.citationNote}</span></p>}
                {selected.sourceUrl && <a href={selected.sourceUrl} rel="noreferrer" target="_blank"><span lang="ko">소장기관 원문 보기</span></a>}
                {selectedMedia && <a href={selectedMedia.rightsUrl} rel="noreferrer" target="_blank"><span lang="ko">도판 이용 조건 보기</span></a>}
              </section>
            )}
            <div className="catalogue-export-actions" aria-label="Citation and print actions">
              <button type="button" onClick={() => { void copyCitation(); }}><span lang="ko">인용 복사</span></button>
              <button type="button" onClick={() => window.print()}><span lang="ko">인쇄</span></button>
              {copyStatus && <span role="status" lang="ko">{copyStatus}</span>}
            </div>

            {(parent || children.length > 0) && (
              <section className="catalogue-relations" aria-labelledby="catalogue-family-title">
                <h2 id="catalogue-family-title"><BilingualLabel en="Lineage" ko="계보" /></h2>
                {parent && <a href={`/catalogue/${parent.id}/`}><span lang="ko">상위 원전</span><strong className={textLanguage(parent.title) === 'en' ? 'archive-body-en' : undefined} lang={textLanguage(parent.title)}>{parent.title}</strong></a>}
                {children.map((child) => <a href={`/catalogue/${child.id}/`} key={child.id}><span lang="ko">{archiveReferenceKindLabel(child.kind)}</span><strong className={textLanguage(child.title) === 'en' ? 'archive-body-en' : undefined} lang={textLanguage(child.title)}>{child.title}</strong></a>)}
              </section>
            )}

            <section className="catalogue-programmes" aria-labelledby="catalogue-programmes-title">
              <h2 id="catalogue-programmes-title"><BilingualLabel en="Programmes" ko="연결된 프로그램" /></h2>
              {usedBy.length > 0 ? usedBy.map((event) => (
                <a href={`/archive/${event.id}/`} key={event.id}>
                  <span className="archive-body-en" lang="en">{event.edition}</span><strong className={!/[가-힣]/.test(event.title) ? 'archive-body-en' : undefined} lang={/[가-힣]/.test(event.title) ? 'ko' : 'en'}>{event.title}</strong>
                </a>
              )) : <p lang="ko">아직 공개 프로그램에 연결되지 않은 자료입니다.</p>}
            </section>
            <a className="archive-cta" href="/catalogue/"><span className="archive-cta-label">전체 자료 장부</span></a>
          </article>
        ) : (
          <>
            <header className="catalogue-intro">
              <p className="section-kicker"><span lang="en">Reference catalogue</span> / <span lang="ko">자료의 계보</span></p>
              <h1>Books, images, quotations,<br />places and recurring signs.</h1>
              <p lang="ko">각 판본을 만든 책과 작품, 인용과 도판, 장소와 주제를 한 장부에서 서로 잇습니다.</p>
            </header>
            <div className="catalogue-tools" aria-label="자료 장부 검색과 종류 필터">
              <label><span>Find</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목, 저자, 설명 검색" /></label>
              <div className="archive-filter-set">
                {kinds.map((item) => (
                  <button type="button" className={kind === item ? 'is-active' : ''} aria-pressed={kind === item} key={item} onClick={() => setKind(item)}>
                    <span lang={item === 'all' ? 'en' : 'ko'}>{item === 'all' ? 'All' : archiveReferenceKindLabel(item)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="catalogue-index">
              {visibleReferences.map((reference) => {
                const appearances = publicEvents.filter((event) => event.referenceIds.includes(reference.id)).length;
                return (
                  <a href={`/catalogue/${reference.id}/`} key={reference.id}>
                    <span lang="ko">{archiveReferenceKindLabel(reference.kind)}</span>
                    <strong className={textLanguage(reference.title) === 'en' ? 'archive-body-en' : undefined} lang={textLanguage(reference.title)}>{reference.title}</strong>
                    <small className={textLanguage(reference.attribution ?? reference.description) === 'en' ? 'archive-body-en' : undefined} lang={textLanguage(reference.attribution ?? reference.description)}>{reference.attribution ?? reference.description}</small>
                    {appearances > 0 && <em lang="ko">프로그램 {appearances}</em>}
                  </a>
                );
              })}
            </div>
            {visibleReferences.length === 0 && (
              <div className="archive-empty-state" role="status">
                아직 이 갈래에 놓인 자료가 없습니다. 검색의 폭을 넓히거나 다른 종류를 열어보세요.
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
