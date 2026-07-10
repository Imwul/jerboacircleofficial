import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { ParticipantJourneyStage, User } from '../types';

export const participantJourneyLabels: Record<ParticipantJourneyStage, { ko: string; en: string; tone: string }> = {
  'first-visit': { ko: '첫 방문', en: 'First visit', tone: 'neutral' },
  invited: { ko: '초대됨', en: 'Invited', tone: 'pending' },
  active: { ko: '활동 중', en: 'Active', tone: 'active' },
  lapsed: { ko: '쉬는 중', en: 'Lapsed', tone: 'quiet' },
  returning: { ko: '돌아옴', en: 'Returning', tone: 'returning' },
  'season-complete': { ko: '시즌 완료', en: 'Season complete', tone: 'complete' },
};

export interface ParticipantJourneySummary {
  stage: ParticipantJourneyStage;
  label: string;
  englishLabel: string;
  tone: string;
  lastActiveAt?: string;
  daysSinceActive: number | null;
  activityCount: number;
  note: string;
}

function safeDate(value: string | undefined) {
  if (!value) return null;

  try {
    const parsed = parseISO(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

function maxDate(values: Array<string | undefined>) {
  return values
    .map(safeDate)
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
}

export function stampParticipantActivity(user: User, at = new Date()): User {
  const stamp = at.toISOString();
  return {
    ...user,
    firstJoinedAt: user.firstJoinedAt || stamp,
    lastActiveAt: stamp,
  };
}

export function deriveParticipantJourney(user: User, now = new Date()): ParticipantJourneySummary {
  const habitDates = Object.entries(user.habitRecords ?? {})
    .filter(([, record]) => record.status === 'success' || Boolean(record.comment) || Boolean(record.photo))
    .map(([dateKey, record]) => record.timestamp || dateKey);
  const lastActiveDate = maxDate([user.lastActiveAt, ...habitDates, user.firstJoinedAt]);
  const activityCount = habitDates.length + user.enrolledEventIds.length;
  const daysSinceActive = lastActiveDate ? differenceInCalendarDays(now, lastActiveDate) : null;
  const hasStarted = Boolean(user.firstJoinedAt || lastActiveDate || activityCount > 0);
  const tierEndDate = safeDate(user.tierEndDate);
  const completedSeason = Boolean(user.completedSeasonIds?.length) || Boolean(tierEndDate && tierEndDate < now && activityCount > 0);
  const invitedDate = safeDate(user.invitedAt);

  let stage: ParticipantJourneyStage = user.journeyStage ?? 'active';

  if (!hasStarted) {
    stage = user.invitedAt ? 'invited' : 'first-visit';
  } else if (completedSeason || user.journeyStage === 'season-complete') {
    stage = 'season-complete';
  } else if (user.journeyStage === 'lapsed' && daysSinceActive !== null && daysSinceActive <= 7) {
    stage = 'returning';
  } else if (daysSinceActive !== null && daysSinceActive >= 21) {
    stage = 'lapsed';
  } else if (user.journeyStage === 'invited' && activityCount === 0) {
    stage = 'invited';
  } else if (user.journeyStage === 'returning' && daysSinceActive !== null && daysSinceActive <= 14) {
    stage = 'returning';
  } else {
    stage = 'active';
  }

  const label = participantJourneyLabels[stage];
  const lastActiveAt = lastActiveDate ? lastActiveDate.toISOString() : undefined;

  return {
    stage,
    label: label.ko,
    englishLabel: label.en,
    tone: label.tone,
    lastActiveAt,
    daysSinceActive,
    activityCount,
    note: lastActiveDate
      ? `마지막 흔적 ${format(lastActiveDate, 'yyyy.MM.dd')}`
      : invitedDate
        ? `초대일 ${format(invitedDate, 'yyyy.MM.dd')}`
        : '아직 남긴 흔적이 없습니다',
  };
}
