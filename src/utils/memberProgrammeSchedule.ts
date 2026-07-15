import type { ArchiveEvent } from '../data/events';
import type { CalendarEvent } from '../types';

export interface MemberScheduleIssue {
  id: string;
  eventId: string;
  severity: 'error' | 'warning';
  message: string;
}

export function resolveMemberProgrammeEvents(
  events: CalendarEvent[],
  archiveRecords: ArchiveEvent[],
) {
  const recordsById = new Map(archiveRecords.map((record) => [record.id, record]));
  return events.map((event) => {
    if (!event.archiveRecordId || !event.inheritArchiveContent) return event;
    const record = recordsById.get(event.archiveRecordId);
    if (!record) return event;
    return {
      ...event,
      title: record.title,
      description: record.shortDescription,
      detailedDescription: record.longDescription,
      themeName: record.themes.slice(0, 3).join(' / ') || event.themeName,
    };
  });
}

export function inspectMemberSchedule(
  events: CalendarEvent[],
  archiveRecords: ArchiveEvent[],
): MemberScheduleIssue[] {
  const recordIds = new Set(archiveRecords.map((record) => record.id));
  const seenEventIds = new Set<string>();
  const issues: MemberScheduleIssue[] = [];

  events.forEach((event) => {
    if (seenEventIds.has(event.id)) {
      issues.push({ id: `duplicate-${event.id}`, eventId: event.id, severity: 'error', message: `${event.title}: 일정 ID가 중복됩니다.` });
    }
    seenEventIds.add(event.id);
    if (event.archiveRecordId && !recordIds.has(event.archiveRecordId)) {
      issues.push({ id: `missing-record-${event.id}`, eventId: event.id, severity: 'error', message: `${event.title}: 연결한 공개 프로그램 기록을 찾을 수 없습니다.` });
    }
    if (event.inheritArchiveContent && !event.archiveRecordId) {
      issues.push({ id: `inherit-without-record-${event.id}`, eventId: event.id, severity: 'error', message: `${event.title}: 자동 반영할 공개 프로그램을 선택해야 합니다.` });
    }
    const start = Date.parse(event.date);
    const end = Date.parse(event.endDate);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      issues.push({ id: `invalid-time-${event.id}`, eventId: event.id, severity: 'error', message: `${event.title}: 시작과 종료 시간을 확인하세요.` });
    }
    if (event.archiveRecordId && !event.inheritArchiveContent) {
      issues.push({ id: `custom-copy-${event.id}`, eventId: event.id, severity: 'warning', message: `${event.title}: 공개 기록과 연결됐지만 회차별 문장을 별도로 유지합니다.` });
    }
  });

  return issues;
}
