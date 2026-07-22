import type { ArchiveRecordFormState } from './archiveRecordForm';

const storageKey = 'jerboa-keeper-programme-working-copies-v1';
const maxWorkingCopies = 12;

export interface KeeperProgrammeWorkingCopy {
  recordId: string;
  title: string;
  savedAt: string;
  isCustom: boolean;
  form: ArchiveRecordFormState;
}

export type KeeperProgrammeWorkingCopyMap = Record<string, KeeperProgrammeWorkingCopy>;

export function readKeeperProgrammeWorkingCopies(): KeeperProgrammeWorkingCopyMap {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || '{}') as KeeperProgrammeWorkingCopyMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeKeeperProgrammeWorkingCopy(copy: KeeperProgrammeWorkingCopy) {
  if (typeof window === 'undefined') return false;
  try {
    const copies = readKeeperProgrammeWorkingCopies();
    const ordered = [copy, ...Object.values(copies).filter((item) => item.recordId !== copy.recordId)]
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
      .slice(0, maxWorkingCopies);
    const nextCopies = Object.fromEntries(
      ordered.map((item) => [item.recordId, item]),
    );
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextCopies));
    } catch {
      const compactCopies = Object.fromEntries(ordered.map((item) => [
        item.recordId,
        !item.form.posterImage.startsWith('data:')
          ? item
          : { ...item, form: { ...item.form, posterImage: '' } },
      ]));
      window.localStorage.setItem(storageKey, JSON.stringify(compactCopies));
    }
    return true;
  } catch {
    return false;
  }
}

export function removeKeeperProgrammeWorkingCopy(recordId: string) {
  if (typeof window === 'undefined') return;
  const copies = readKeeperProgrammeWorkingCopies();
  delete copies[recordId];
  window.localStorage.setItem(storageKey, JSON.stringify(copies));
}

export function clearKeeperProgrammeWorkingCopies() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey);
}
