import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        {/* Hero Section */}
        <section className={styles.hero}>
          <h1 className={styles.title}>FuolSatck</h1>
          <p className={styles.tagline}>Innovative solutions for modern challenges</p>
        </section>

        {/* Features Section */}
        <section className={styles.features}>
          <h2>Features</h2>
          <ul className={styles.featureList}>
            <li>⚡ Fast and reliable performance</li>
            <li>🔒 Robust security built‑in</li>
            <li>🎨 Clean black‑white design</li>
            <li>🌐 Cross‑platform compatibility</li>
          </ul>
        </section>

        {/* Call‑to‑Action */}
        <div className={styles.ctas}>
          <a
            className={styles.primary}
            href="/" /* placeholder – replace with real link */
          >
            Get Started
          </a>
          <a
            className={styles.secondary}
            href="https://github.com" /* placeholder – docs link */
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </div>
      </main>
    </div>
  );
}
