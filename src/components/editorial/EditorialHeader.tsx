type EditorialSection = 'entrance' | 'archive' | 'catalogue' | 'reader';

interface EditorialHeaderProps {
  active?: EditorialSection;
  note?: string;
}

const links: Array<{
  id: EditorialSection;
  href: string;
  label: string;
  note: string;
}> = [
  { id: 'entrance', href: '/', label: 'Entrance', note: '전시 입구' },
  { id: 'archive', href: '/#archive', label: 'Chronicle', note: '프로그램 연대기' },
  { id: 'catalogue', href: '/catalogue/', label: 'Catalogue', note: '자료 도록' },
  { id: 'reader', href: '/members/', label: 'Reading Room', note: '독자의 연구실' },
];

export default function EditorialHeader({
  active,
  note = 'Books, images, and a circle of readers.',
}: EditorialHeaderProps) {
  return (
    <header className="editorial-header" aria-label="Jerboa Circle navigation">
      <a className="editorial-wordmark" href="/" aria-label="Jerboa Circle entrance">
        <span lang="en">Jerboa Circle</span>
        <small lang="en">{note}</small>
      </a>
      <nav className="editorial-navigation" aria-label="주요 공간">
        {links.map((link) => (
          <a
            href={link.href}
            key={link.id}
            aria-current={active === link.id ? 'page' : undefined}
          >
            <span lang="en">{link.label}</span>
            <small lang="ko">{link.note}</small>
          </a>
        ))}
      </nav>
    </header>
  );
}
