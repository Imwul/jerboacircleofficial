import { useEffect, useMemo, useRef, useState } from 'react';
import type { ArchiveEvent } from '../../data/events';
import {
  archiveConnectionDirectionLabel,
  getArchiveConnections,
  getArchiveReferencesForEvent,
  type ArchiveProgrammeConnection,
  type ArchiveReference,
} from '../../data/archiveKnowledge';

interface ArchiveConstellationProps {
  records: ArchiveEvent[];
  references?: ArchiveReference[];
}

interface NodePosition {
  x: number;
  y: number;
}

interface ConstellationLink {
  sourceId: string;
  targetId: string;
  kind: ArchiveProgrammeConnection['kind'];
}

function positionRecords(records: ArchiveEvent[]) {
  const current = records.find((record) => record.status === 'current');
  const ordered = records
    .filter((record) => record.id !== current?.id)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const positions = new Map<string, NodePosition>();

  if (current) positions.set(current.id, { x: 50, y: 48 });
  if (!current && ordered[0]) positions.set(ordered.shift()!.id, { x: 50, y: 48 });

  let cursor = 0;
  let ring = 0;
  while (cursor < ordered.length) {
    const count = Math.min(8 + ring * 4, ordered.length - cursor);
    const radiusX = Math.min(42, 25 + ring * 8);
    const radiusY = Math.min(42, 32 + ring * 6);
    for (let index = 0; index < count; index += 1) {
      const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / count) + (ring * 0.23);
      positions.set(ordered[cursor + index].id, {
        x: 50 + Math.cos(angle) * radiusX,
        y: 48 + Math.sin(angle) * radiusY,
      });
    }
    cursor += count;
    ring += 1;
  }

  return positions;
}

function buildLinks(records: ArchiveEvent[], references?: ArchiveReference[]) {
  const visibleIds = new Set(records.map((record) => record.id));
  const links = new Map<string, ConstellationLink>();

  records.forEach((record) => {
    getArchiveConnections(record, records, references).forEach((connection) => {
      if (!visibleIds.has(connection.event.id)) return;
      const pair = [record.id, connection.event.id].sort();
      const key = pair.join('::');
      if (!links.has(key)) {
        links.set(key, {
          sourceId: pair[0],
          targetId: pair[1],
          kind: connection.kind,
        });
      }
    });
  });

  return [...links.values()];
}

function drawConstellation(
  canvas: HTMLCanvasElement,
  positions: Map<string, NodePosition>,
  links: ConstellationLink[],
  selectedId: string,
) {
  const bounds = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(bounds.width * ratio);
  canvas.height = Math.round(bounds.height * ratio);
  const context = canvas.getContext('2d');
  if (!context) return;
  context.scale(ratio, ratio);
  context.clearRect(0, 0, bounds.width, bounds.height);

  links.forEach((link) => {
    const source = positions.get(link.sourceId);
    const target = positions.get(link.targetId);
    if (!source || !target) return;
    const isSelected = link.sourceId === selectedId || link.targetId === selectedId;
    context.beginPath();
    context.moveTo((source.x / 100) * bounds.width, (source.y / 100) * bounds.height);
    context.lineTo((target.x / 100) * bounds.width, (target.y / 100) * bounds.height);
    context.strokeStyle = isSelected ? 'rgba(10, 10, 10, 0.72)' : 'rgba(10, 10, 10, 0.2)';
    context.lineWidth = isSelected ? 1.8 : 0.8;
    if (link.kind === 'shared-reference' || link.kind === 'shared-source') context.setLineDash([5, 5]);
    else if (link.kind === 'shared-theme' || link.kind === 'thematic') context.setLineDash([2, 5]);
    else context.setLineDash([]);
    context.stroke();
  });
  context.setLineDash([]);
}

export default function ArchiveConstellation({ records, references: referenceRecords }: ArchiveConstellationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const current = records.find((record) => record.status === 'current') ?? records[0];
  const [selectedId, setSelectedId] = useState(current?.id ?? '');
  const positions = useMemo(() => positionRecords(records), [records]);
  const links = useMemo(() => buildLinks(records, referenceRecords), [records, referenceRecords]);
  const selected = records.find((record) => record.id === selectedId) ?? current;
  const references = selected ? getArchiveReferencesForEvent(selected, referenceRecords) : [];
  const selectedConnections = selected ? getArchiveConnections(selected, records, referenceRecords) : [];

  useEffect(() => {
    if (!records.some((record) => record.id === selectedId)) setSelectedId(current?.id ?? '');
  }, [records, selectedId, current?.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const render = () => drawConstellation(canvas, positions, links, selectedId);
    render();
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [positions, links, selectedId]);

  if (records.length === 0) {
    return <div className="archive-empty-state" role="status">표시할 기록이 없습니다.</div>;
  }

  return (
    <section className="archive-constellation" aria-label="프로그램 관계 별자리">
      <div className="constellation-field">
        <canvas ref={canvasRef} aria-hidden="true" />
        {records.map((record) => {
          const position = positions.get(record.id) ?? { x: 50, y: 50 };
          const isSelected = selected?.id === record.id;
          return (
            <button
              type="button"
              className="constellation-node"
              data-current={record.status === 'current' || undefined}
              data-selected={isSelected || undefined}
              aria-pressed={isSelected}
              aria-label={`${record.title}, ${record.edition}, ${record.status === 'current' ? '현재 열린 프로그램' : '보관된 프로그램'}`}
              key={record.id}
              onClick={() => setSelectedId(record.id)}
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
            >
              <span>{record.edition.replace('Edition ', 'E.')}</span>
              <strong lang={/[가-힣]/.test(record.title) ? 'ko' : 'en'}>{record.title}</strong>
              {record.status === 'current' && <small>Open now</small>}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="constellation-selection" aria-live="polite">
          <div>
            <span>{selected.edition} / {selected.status === 'current' ? '현재 열린 프로그램' : '보관된 프로그램'}</span>
            <h3>{selected.title}</h3>
            <p lang="ko">{selected.shortDescription}</p>
          </div>
          <dl>
            <div>
              <dt>테마</dt>
              <dd>{selected.themes.join(' / ')}</dd>
            </div>
            <div>
              <dt>자료 노드</dt>
              <dd>{references.slice(0, 4).map((reference) => reference.title).join(' / ') || '아직 연결된 자료 없음'}</dd>
            </div>
            <div>
              <dt>이어지는 판본</dt>
              <dd>{selectedConnections.slice(0, 3).map((connection) => `${archiveConnectionDirectionLabel(connection.direction)} ${connection.event.edition}`).join(' / ') || '첫 연결점'}</dd>
            </div>
          </dl>
          <a className="archive-cta" href={selected.ctaHref}>
            <span className="archive-cta-label">기록 열기</span>
          </a>
        </div>
      )}
      <p className="constellation-legend" lang="ko">
        실선은 판본의 흐름, 긴 점선은 공통 자료, 짧은 점선은 공통 테마를 뜻합니다. 현재 열린 프로그램은 중심에서 강조됩니다.
      </p>
    </section>
  );
}
