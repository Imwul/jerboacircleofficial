import { ThemeColor, Tier, type CalendarEvent, type User } from '../types';

export interface MembersSyncPayload {
  schemaVersion: 1;
  users: User[];
  events: CalendarEvent[];
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
  return value as unknown as CalendarEvent;
}

export function parseMembersImport(payload: unknown): MembersSyncPayload {
  assert(isRecord(payload), '파일 또는 코드의 최상위 구조가 올바르지 않습니다.');
  if (typeof payload.version === 'number') assert(payload.version === 1, '지원하지 않는 회원 장부 백업 버전입니다.');
  if (typeof payload.type === 'string') {
    assert(payload.type === 'jerboa-member-register' || payload.type === 'jerboa-sync-recovery', 'Jerboa Circle 회원 장부 백업이 아닙니다.');
  }
  if (payload.type === 'jerboa-sync-recovery') assert(payload.scope === 'members', '아카이브 복구 파일은 회원 장부에 적용할 수 없습니다.');

  const data = isRecord(payload.data) ? payload.data : payload;
  if (typeof data.schemaVersion === 'number') assert(data.schemaVersion === 1, '지원하지 않는 회원 장부 데이터 버전입니다.');
  assert(Array.isArray(data.users) && data.users.length <= 10_000, '회원 목록이 올바르지 않습니다.');
  assert(Array.isArray(data.events) && data.events.length <= 10_000, '프로그램 목록이 올바르지 않습니다.');
  assert(isRecord(data.themeNames), '주제 이름 목록이 올바르지 않습니다.');
  assert(data.mainImage === null || data.mainImage === undefined || typeof data.mainImage === 'string', '대표 이미지 값이 올바르지 않습니다.');

  const themeNames = { ...data.themeNames } as Record<ThemeColor, string>;
  Object.values(ThemeColor).forEach((theme) => {
    assert(typeof themeNames[theme] === 'string' && themeNames[theme].length <= 200, `${theme} 주제 이름이 올바르지 않습니다.`);
  });

  return {
    schemaVersion: 1,
    users: data.users.map(validateUser),
    events: data.events.map(validateEvent),
    themeNames,
    mainImage: typeof data.mainImage === 'string' ? data.mainImage : null,
  };
}
