import { useId, useMemo, useState } from 'react';

export interface RelationshipPickerOption {
  id: string;
  title: string;
  meta?: string;
}

interface RelationshipPickerProps {
  label: string;
  description: string;
  options: RelationshipPickerOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  emptyLabel?: string;
  actionLabel?: string;
  onAction?: () => void;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

export default function RelationshipPicker({
  label,
  description,
  options,
  selectedIds,
  onChange,
  emptyLabel = '맞는 항목이 없습니다.',
  actionLabel,
  onAction,
}: RelationshipPickerProps) {
  const searchId = useId();
  const [query, setQuery] = useState('');
  const selected = new Set(selectedIds);
  const visibleOptions = useMemo(() => {
    const term = normalize(query);
    if (!term) return options;
    return options.filter((option) => normalize([option.title, option.id, option.meta].filter(Boolean).join(' ')).includes(term));
  }, [options, query]);

  function toggle(id: string) {
    if (selected.has(id)) {
      onChange(selectedIds.filter((selectedId) => selectedId !== id));
      return;
    }
    onChange([...selectedIds, id]);
  }

  return (
    <fieldset className="relationship-picker">
      <legend lang="ko">{label}</legend>
      {actionLabel && onAction && (
        <button className="relationship-picker-action" type="button" onClick={onAction}>
          <span lang="ko">{actionLabel}</span>
        </button>
      )}
      <p lang="ko">{description}</p>
      <label className="relationship-picker-search" htmlFor={searchId}>
        <span lang="ko">검색</span>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="제목 또는 ID"
        />
      </label>
      <div className="relationship-picker-options">
        {visibleOptions.map((option) => (
          <label className={selected.has(option.id) ? 'is-selected' : ''} key={option.id}>
            <input
              type="checkbox"
              checked={selected.has(option.id)}
              onChange={() => toggle(option.id)}
            />
            <span>
              <strong>{option.title}</strong>
              <small>{option.meta ? `${option.meta} · ` : ''}{option.id}</small>
            </span>
          </label>
        ))}
        {visibleOptions.length === 0 && <p className="relationship-picker-empty" role="status" lang="ko">{emptyLabel}</p>}
      </div>
      <small className="relationship-picker-count" aria-live="polite" lang="ko">{selectedIds.length}개 선택됨</small>
    </fieldset>
  );
}
