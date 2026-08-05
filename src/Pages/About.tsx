import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../Components/UI/Header';
import { Footer } from '../Components/UI/Footer';
import styles from './About.module.css';

export function About() {
  const navigate = useNavigate();

  return (
    <div className={styles.appShell}>
      <Header />
      <main className={styles.page}>
        {/* Hero Banner */}
        <section className={styles.hero}>
          <div className={styles.badge}>✦ FURNISIA™ SPATIAL ARCHITECTURE PLATFORM</div>
          <h1 className={styles.title}>Next-Generation 3D & WebXR Room Planning</h1>
          <p className={styles.subtitle}>
            Furnisia™ is a state-of-the-art web application engineered to bridge 2D parametric floorplan design with 1:1 scale Virtual Reality spatial exploration.
          </p>

          <div className={styles.heroActions}>
            <button type="button" className={styles.primaryBtn} onClick={() => navigate('/room-builder')}>
              Launch Room Builder ➔
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={() => navigate('/planner')}>
              Open 3D Planner
            </button>
          </div>
        </section>

        {/* Feature Grid */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>CAPABILITIES</span>
            <h2 className={styles.sectionTitle}>Engineered for Precision & Immersion</h2>
          </div>

          <div className={styles.grid}>
            <div className={styles.card}>
              <div className={styles.cardIcon}>📐</div>
              <h3>Parametric Vector Engine</h3>
              <p>
                Draw custom room polygon shapes with per-wall thickness control, ceiling height adjustments, and real-time parametric door and window cutouts.
              </p>
            </div>

            <div className={styles.card}>
              <div className={styles.cardIcon}>🥽</div>
              <h3>Native 6-DoF WebXR VR</h3>
              <p>
                Step inside your custom room at true 1:1 human scale with WebXR VR support for Meta Quest 2/3, Apple Vision Pro, and PCVR headsets.
              </p>
            </div>

            <div className={styles.card}>
              <div className={styles.cardIcon}>🛋️</div>
              <h3>Smart 3D Furniture Snap</h3>
              <p>
                Smart wall-hugging alignment, surface snapping, 3D transform gizmos, and interactive clearance boundary detection.
              </p>
            </div>

            <div className={styles.card}>
              <div className={styles.cardIcon}>☀️</div>
              <h3>ArchViz Lighting & Shading</h3>
              <p>
                Photorealistic Three.js PBR materials, ACES Filmic tone mapping, ambient shadows, and customizable floor & wall finishes.
              </p>
            </div>
          </div>
        </section>

        {/* System Architecture & Tech Stack */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>ARCHITECTURE</span>
            <h2 className={styles.sectionTitle}>Built with Modern Web Standards</h2>
          </div>

          <div className={styles.techGrid}>
            <div className={styles.techCard}>
              <div className={styles.techCategory}>Core Framework</div>
              <h4>React 18 & TypeScript</h4>
              <p>Type-safe component architecture with Zustand state management and Firebase Cloud database sync.</p>
            </div>

            <div className={styles.techCard}>
              <div className={styles.techCategory}>Graphics Engine</div>
              <h4>Three.js & R3F</h4>
              <p>Hardware-accelerated WebGL 3D rendering pipeline with WebXR stereoscopic VR camera rigging.</p>
            </div>

            <div className={styles.techCard}>
              <div className={styles.techCategory}>Design System</div>
              <h4>Vanilla CSS & Tokens</h4>
              <p>Ultra-fast, zero-runtime dependency design system with glassmorphism and adaptive fluid typography.</p>
            </div>
          </div>
        </section>

        {/* Developer Credit Box */}
        <section className={styles.authorCard}>
          <div className={styles.authorBadge}>AUTHOR & CREATOR</div>
          <h2 className={styles.authorName}>
            Furnisia™ &middot; Designed & Developed by <span>Charanjeet Singh Jaswani</span>
          </h2>
          <p className={styles.authorBio}>
            Crafted with passion for modern spatial web development, interactive 3D graphics, and intuitive user experiences.
          </p>
          <div className={styles.authorFooter}>
            <Link to="/" className={styles.authorLink}>← Back to Dashboard</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
