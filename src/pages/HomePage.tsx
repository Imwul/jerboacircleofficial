import './HomePage.css';

const themes = ['Grail', 'Forest', 'Relic', 'Rose', 'Fire', 'Star'];

const archiveItems = [
  ['I', 'A Reading at the Edge of the Room', 'winter gathering'],
  ['II', 'Letters to Unmade Places', 'correspondence study'],
  ['III', 'The Museum After Hours', 'slow looking session'],
  ['IV', 'Small Fires, Long Tables', 'shared text and supper'],
];

function SiteHeader() {
  return (
    <header className="public-header" aria-label="Jerboa Circle navigation">
      <a className="public-wordmark" href="#top" aria-label="Jerboa Circle home">
        Jerboa Circle
      </a>
      <nav className="public-nav" aria-label="Primary navigation">
        <a href="#philosophy">Philosophy</a>
        <a href="#program">Program</a>
        <a href="#archive">Archive</a>
        <a href="#about">About</a>
        <a href="#join">Join</a>
      </nav>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="hero-section section-reveal" id="top">
      <p className="eyebrow">Independent literary and artistic circle</p>
      <h1>A quiet room for literature, art, and the long conversation between them.</h1>
      <a className="textual-cta" href="#join">Request an invitation</a>
    </section>
  );
}

function PhilosophySection() {
  return (
    <section className="editorial-section philosophy-section section-reveal" id="philosophy">
      <div className="section-marker">01 / Philosophy</div>
      <div className="editorial-copy">
        <p>
          Jerboa Circle gathers around works that ask for attention. We read slowly,
          make carefully, and treat conversation as a form of cultural practice.
        </p>
        <div className="principle-list" aria-label="Jerboa Circle principles">
          <span>Reading as ritual</span>
          <span>Art as attention</span>
          <span>Conversation as archive</span>
        </div>
      </div>
    </section>
  );
}

function ProgramSection() {
  return (
    <section className="program-section section-reveal" id="program">
      <div className="section-marker">02 / Current Program</div>
      <div className="program-inner">
        <p className="program-kicker">Scintilla Animae</p>
        <h2>Six small flames arranged as a season of reading, image, memory, and myth.</h2>
        <p className="program-note">
          A current cycle for those drawn to hidden symbols, old questions, and
          contemporary forms of devotion.
        </p>
        <div className="theme-rhythm" aria-label="Scintilla Animae themes">
          {themes.map((theme, index) => (
            <div className="theme-line" key={theme}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{theme}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArchiveSection() {
  return (
    <section className="archive-section section-reveal" id="archive">
      <div className="section-marker">03 / Archive</div>
      <div className="archive-list">
        {archiveItems.map(([number, title, format]) => (
          <article className="archive-row" key={title}>
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{format}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function AboutSection() {
  return (
    <section className="editorial-section about-section section-reveal" id="about">
      <div className="section-marker">04 / About</div>
      <div className="editorial-copy">
        <p>
          Jerboa Circle is an independent gathering for literary study, artistic
          exchange, and intimate public programs. It moves between the table, the
          page, the image, and the voice.
        </p>
      </div>
    </section>
  );
}

function JoinSection() {
  return (
    <section className="join-section section-reveal" id="join">
      <p className="eyebrow">An invitation, not an account</p>
      <h2>Enter quietly. Bring a text, a question, or a fragment of attention.</h2>
      <a className="textual-cta" href="mailto:hello@jerboacircle.com">Write to Jerboa Circle</a>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="public-footer">
      <span>Jerboa Circle</span>
      <a href="./members/">Members</a>
    </footer>
  );
}

export default function HomePage() {
  return (
    <div className="public-home">
      <SiteHeader />
      <main>
        <HeroSection />
        <PhilosophySection />
        <ProgramSection />
        <ArchiveSection />
        <AboutSection />
        <JoinSection />
      </main>
      <SiteFooter />
    </div>
  );
}
