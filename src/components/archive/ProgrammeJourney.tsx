import { useId } from 'react';

interface ProgrammeJourneyProps {
  className?: string;
  passage: string[];
}

export default function ProgrammeJourney({ className = '', passage }: ProgrammeJourneyProps) {
  const headingId = useId();

  return (
    <section
      className={`programme-journey-sequence ${className}`.trim()}
      aria-labelledby={headingId}
    >
      <header>
        <span lang="en">Procession</span>
        <h2 id={headingId} lang="ko">여정</h2>
        <small lang="ko">{passage.length}개의 통과 지점</small>
      </header>
      <ol>
        {passage.map((item, index) => (
          <li key={`${index}-${item}`}>
            <span className="programme-journey-index" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <strong lang={/[가-힣]/.test(item) ? 'ko' : 'en'}>{item}</strong>
          </li>
        ))}
      </ol>
    </section>
  );
}
