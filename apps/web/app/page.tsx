const features = [
  {
    title: 'Bluff-first gameplay',
    body: 'Players submit decoy answers, vote for the real one, and score by spotting truth or fooling the room.'
  },
  {
    title: 'Made for async + live social play',
    body: 'Start with a clean browser experience that works for phones, laptops, and party screens before going native.'
  },
  {
    title: 'Monorepo-ready architecture',
    body: 'Shared game rules, UI primitives, and typed contracts keep the web app and future mobile clients aligned.'
  }
];

const phases = ['Create a lobby', 'Deal a prompt', 'Submit a decoy', 'Vote', 'Reveal', 'Score'];

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="container grid hero-grid">
          <div>
            <span className="badge">Decoy · web-first party game</span>
            <h1 className="h1">Lie well. Guess better.</h1>
            <p className="lead">
              Decoy is a social bluffing game for fast lobbies, chaotic reveals, and dead-serious accusations in the group chat.
              The first release targets the web with a Next.js app deployed on Vercel, then expands into native iOS and Android.
            </p>
            <div className="actions">
              <a className="button button-primary" href="#mvp">View MVP scope</a>
              <a className="button button-secondary" href="https://vercel.com" target="_blank" rel="noreferrer">Deploy via Vercel</a>
            </div>
          </div>

          <div className="card hero-card">
            <div className="kpis">
              <div className="card kpi">
                <strong>6</strong>
                <p>Core round phases captured in the shared <span className="code">game-engine</span> package.</p>
              </div>
              <div className="card kpi">
                <strong>1</strong>
                <p>Web app first. Native shells come later once gameplay and retention feel right.</p>
              </div>
              <div className="card kpi">
                <strong>Vercel</strong>
                <p>Host the Next.js client and edge-friendly APIs with room for realtime extensions.</p>
              </div>
              <div className="card kpi">
                <strong>Monorepo</strong>
                <p>Shared packages for config, domain types, UI, backend orchestration, and rules.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="mvp">
        <div className="container">
          <h2 className="section-title">MVP shape</h2>
          <div className="grid feature-grid">
            {features.map((feature) => (
              <article className="card feature" key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Round loop</h2>
          <div className="grid feature-grid">
            {phases.map((phase, index) => (
              <article className="card feature" key={phase}>
                <h3>{String(index + 1).padStart(2, '0')}</h3>
                <p>{phase}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">Bootstrapped for a web-first launch with room for shared logic, realtime multiplayer, and future native clients.</div>
      </footer>
    </main>
  );
}
