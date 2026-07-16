import { defaultSiteText, type SiteText } from '../data/siteText';

const siteTextStorageKey = 'jerboa-circle-site-text';

// Only exact matches for the former shipped copy are migrated. Any sentence
// an editor has changed remains untouched, while untouched legacy defaults no
// longer overwrite the current editorial language after a server sync.
const legacySiteText: Partial<SiteText> = {
  navFeaturedKo: '현재 진행 중인 프로그램',
  navArchiveKo: '지난 프로그램 기록',
  navManifestoKo: '저보아 서클 소개',
  navJoinKo: '문의와 초대',
  navMembersKo: '비공개 장부',
  mastheadCaptionKo: '프로그램과 포스터의 공개 기록벽',
  mastheadIntroKo: '책과 이미지와 신화를 하나의 여정으로 엮는 공개 아카이브.',
  orientationKickerKo: '처음 온 사람을 위한 순서',
  orientationStatementKo: '처음 온 독자는 현재 프로그램을 먼저 확인하고, 지난 기록을 읽은 뒤, 참여가 필요할 때 비공개 장부로 들어갑니다.',
  orientationCurrentKo: '지금 열린 프로그램의 질문, 자료, 여섯 표식을 확인합니다.',
  orientationArchiveKo: '지난 포스터와 문장에서 반복되는 상징을 따라갑니다.',
  orientationPrivateKo: '참여 신청, 출석, 오늘의 기록을 비공개로 남깁니다.',
  featuredKickerKo: '현재 진행 중인 프로그램',
  featuredAnnotation: '강의가 아니라 성배, 숲, 유물, 장미, 불, 별을 지나는 여정.',
  statusCurrent: '열려 있음',
  statusUpcoming: '예고됨',
  archiveKickerKo: '지난 프로그램 기록',
  archiveHeading: '끝난 프로그램은 사라지지 않습니다. 포스터와 문장은 다음 독자를 기다립니다.',
  manifestoKickerKo: '저보아 서클 소개',
  manifestoBody: '저보아 서클의 프로그램은 교육 과정이 아니라 임시 별자리입니다.\n\n책과 이미지와 사물과 장소가 잠시 한 방향을 가리키고, 참가자는 그 사이를 통과한 뒤 조금 다른 눈으로 돌아옵니다.',
  joinKickerKo: '문의와 초대',
  joinHeading: '다음 프로그램, 참여, 기록 열람에 관한 편지를 받습니다.',
  joinCtaLabel: 'Send a Letter',
  detailNavArchiveKo: '기록벽으로 돌아가기',
  detailNavMembersKo: '회원 전용 장부',
  detailKickerKo: '한 프로그램의 기록',
  detailThemeLabel: '주제',
  detailBackLabel: '기록벽으로 돌아가기',
  missingTitle: '아직 필사되지 않은 기록입니다.',
};

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function mergeSiteText(draft?: Partial<SiteText> | null): SiteText {
  const migratedDraft = { ...(draft || {}) };
  (Object.keys(legacySiteText) as Array<keyof SiteText>).forEach((key) => {
    if (migratedDraft[key] === legacySiteText[key]) {
      migratedDraft[key] = defaultSiteText[key];
    }
  });

  return {
    ...defaultSiteText,
    ...migratedDraft,
  };
}

export function readSiteTextDraft(): Partial<SiteText> {
  if (!canUseStorage()) return {};

  try {
    const rawDraft = window.localStorage.getItem(siteTextStorageKey);
    return rawDraft ? (JSON.parse(rawDraft) as Partial<SiteText>) : {};
  } catch {
    return {};
  }
}

export function getSiteText(): SiteText {
  return mergeSiteText(readSiteTextDraft());
}

export function writeSiteTextDraft(draft: Partial<SiteText>) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(siteTextStorageKey, JSON.stringify(draft));
}

export function clearSiteTextDraft() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(siteTextStorageKey);
}
