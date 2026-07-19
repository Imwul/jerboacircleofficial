import { ThemeColor, Tier, type CalendarEvent, type Curiosity, type User } from '../types';

export interface MembersSyncPayload {
  schemaVersion: 1 | 2 | 3;
  users: User[];
  events: CalendarEvent[];
  curiosities?: Curiosity[];
  themeNames: Record<ThemeColor, string>;
  mainImage: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function stringArray(value: unknown, label: string) {
  assert(Array.isArray(value) && value.length <= 10_000, `${label} 목록이 올바르지 않습니다.`);
  assert(value.every((item) => typeof item === 'string' && item.length <= 500), `${label} 목록에 올바르지 않은 값이 있습니다.`);
}

function validateUser(value: unknown, index: number) {
  assert(isRecord(value), `회원 ${index + 1}의 형식이 올바르지 않습니다.`);
  assert(typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 120, `회원 ${index + 1}의 ID가 올바르지 않습니다.`);
  assert(typeof value.name === 'string' && value.name.length > 0 && value.name.length <= 200, `회원 ${index + 1}의 이름이 올바르지 않습니다.`);
  assert(Object.values(Tier).includes(value.tier as Tier), `회원 ${index + 1}의 단계가 올바르지 않습니다.`);
  assert(typeof value.coins === 'number' && Number.isFinite(value.coins), `회원 ${index + 1}의 문장 수가 올바르지 않습니다.`);
  assert(value.tierDurationWeeks === 2 || value.tierDurationWeeks === 4, `회원 ${index + 1}의 기간이 올바르지 않습니다.`);
  stringArray(value.enrolledEventIds, `회원 ${index + 1}의 신청 기록`);
  if (value.habitRecords !== undefined) assert(isRecord(value.habitRecords), `회원 ${index + 1}의 개인 기록이 올바르지 않습니다.`);
  return value as unknown as User;
}

function validateEvent(value: unknown, index: number) {
  assert(isRecord(value), `프로그램 ${index + 1}의 형식이 올바르지 않습니다.`);
  ['id', 'title', 'description', 'themeName', 'date', 'endDate'].forEach((field) => {
    assert(typeof value[field] === 'string' && String(value[field]).length <= 5_000, `프로그램 ${index + 1}의 ${field} 값이 올바르지 않습니다.`);
  });
  assert(Object.values(ThemeColor).includes(value.theme as ThemeColor), `프로그램 ${index + 1}의 주제 색상이 올바르지 않습니다.`);
  assert(typeof value.cost === 'number' && Number.isFinite(value.cost), `프로그램 ${index + 1}의 비용이 올바르지 않습니다.`);
  assert(typeof value.isReward === 'boolean', `프로그램 ${index + 1}의 보상 설정이 올바르지 않습니다.`);
  if (value.archiveRecordId !== undefined) assert(typeof value.archiveRecordId === 'string' && value.archiveRecordId.length <= 120, `프로그램 ${index + 1}의 공개 기록 연결이 올바르지 않습니다.`);
  if (value.inheritArchiveContent !== undefined) assert(typeof value.inheritArchiveContent === 'boolean', `프로그램 ${index + 1}의 공개 기록 자동 반영 설정이 올바르지 않습니다.`);
  return value as unknown as CalendarEvent;
}

function optionalString(value: unknown, label: string, limit = 5_000) {
  if (value === undefined) return;
  assert(typeof value === 'string' && value.length <= limit, `${label} 값이 올바르지 않습니다.`);
}

function validateCuriosity(value: unknown, index: number) {
  assert(isRecord(value), `Cabinet 표본 ${index + 1}의 형식이 올바르지 않습니다.`);
  ['id', 'ownerId', 'title', 'reflection', 'imageAlt', 'theme', 'medium', 'century', 'region', 'collectedAt', 'createdAt', 'updatedAt'].forEach((field) => {
    assert(typeof value[field] === 'string' && String(value[field]).length > 0 && String(value[field]).length <= 5_000, `Cabinet 표본 ${index + 1}의 ${field} 값이 올바르지 않습니다.`);
  });
  assert(typeof value.image === 'string' && value.image.length > 0 && value.image.length <= 4_000_000, `Cabinet 표본 ${index + 1}의 이미지 값이 올바르지 않습니다.`);
  optionalString(value.maker, `Cabinet 표본 ${index + 1}의 제작자`);
  optionalString(value.notes, `Cabinet 표본 ${index + 1}의 긴 기록`, 50_000);
  optionalString(value.lastViewedAt, `Cabinet 표본 ${index + 1}의 마지막 열람 시각`);
  stringArray(value.tags, `Cabinet 표본 ${index + 1}의 표식`);
  assert(value.visibility === 'public' || value.visibility === 'private', `Cabinet 표본 ${index + 1}의 공개 범위가 올바르지 않습니다.`);
  stringArray(value.bookmarkedBy, `Cabinet 표본 ${index + 1}의 책갈피`);
  assert(isRecord(value.source), `Cabinet 표본 ${index + 1}의 출처가 올바르지 않습니다.`);
  assert(typeof value.source.institution === 'string' && value.source.institution.length > 0 && value.source.institution.length <= 2_000, `Cabinet 표본 ${index + 1}의 출처 기관이 올바르지 않습니다.`);
  optionalString(value.source.reference, `Cabinet 표본 ${index + 1}의 출처 식별자`);
  optionalString(value.source.url, `Cabinet 표본 ${index + 1}의 출처 주소`);
  assert(isRecord(value.encountered), `Cabinet 표본 ${index + 1}의 만남 기록이 올바르지 않습니다.`);
  assert(typeof value.encountered.dateLabel === 'string' && value.encountered.dateLabel.length > 0 && value.encountered.dateLabel.length <= 2_000, `Cabinet 표본 ${index + 1}의 만남 시기가 올바르지 않습니다.`);
  optionalString(value.encountered.place, `Cabinet 표본 ${index + 1}의 만남 장소`);
  optionalString(value.encountered.context, `Cabinet 표본 ${index + 1}의 만남 맥락`);
  return value as unknown as Curiosity;
}

export function parseMembersImport(payload: unknown): MembersSyncPayload {
  assert(isRecord(payload), '파일 또는 코드의 최상위 구조가 올바르지 않습니다.');
  if (typeof payload.version === 'number') assert(payload.version === 1, '지원하지 않는 회원 장부 백업 버전입니다.');
  if (typeof payload.type === 'string') {
    assert(payload.type === 'jerboa-member-register' || payload.type === 'jerboa-sync-recovery', 'Jerboa Circle 회원 장부 백업이 아닙니다.');
  }
  if (payload.type === 'jerboa-sync-recovery') assert(payload.scope === 'members', '아카이브 복구 파일은 회원 장부에 적용할 수 없습니다.');

  const data = isRecord(payload.data) ? payload.data : payload;
  if (typeof data.schemaVersion === 'number') assert(data.schemaVersion === 1 || data.schemaVersion === 2 || data.schemaVersion === 3, '지원하지 않는 회원 장부 데이터 버전입니다.');
  assert(Array.isArray(data.users) && data.users.length <= 10_000, '회원 목록이 올바르지 않습니다.');
  assert(Array.isArray(data.events) && data.events.length <= 10_000, '프로그램 목록이 올바르지 않습니다.');
  if (data.schemaVersion === 3) assert(Array.isArray(data.curiosities), 'Cabinet 표본 목록이 없는 3판 장부입니다.');
  if (data.curiosities !== undefined) assert(Array.isArray(data.curiosities) && data.curiosities.length <= 20_000, 'Cabinet 표본 목록이 올바르지 않습니다.');
  assert(isRecord(data.themeNames), '주제 이름 목록이 올바르지 않습니다.');
  assert(data.mainImage === null || data.mainImage === undefined || typeof data.mainImage === 'string', '대표 이미지 값이 올바르지 않습니다.');

  const themeNames = { ...data.themeNames } as Record<ThemeColor, string>;
  Object.values(ThemeColor).forEach((theme) => {
    assert(typeof themeNames[theme] === 'string' && themeNames[theme].length <= 200, `${theme} 주제 이름이 올바르지 않습니다.`);
  });

  return {
    schemaVersion: 3,
    users: data.users.map(validateUser),
    events: data.events.map(validateEvent),
    ...(Array.isArray(data.curiosities) ? { curiosities: data.curiosities.map(validateCuriosity) } : {}),
    themeNames,
    mainImage: typeof data.mainImage === 'string' ? data.mainImage : null,
  };
}
