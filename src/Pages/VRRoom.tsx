import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCopy, FiShare2, FiCheck, FiSun, FiMoon } from 'react-icons/fi';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping } from 'three';
import { usePlannerStore } from '../store/plannerStore';
import { Room } from '../Components/Room';
import { FurnitureModel } from '../Components/FurnitureModel';
import { FPSController } from '../Components/FPSController';
import styles from './VRRoom.module.css';

type Atmosphere = 'day' | 'sunset' | 'night';

export function VRRoom() {
  const navigate = useNavigate();
  const placedItems = usePlannerStore((state) => state.placedItems);
  const [atmosphere, setAtmosphere] = useState<Atmosphere>('day');
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const vrUrl = window.location.href;

  function handleCopy() {
    navigator.clipboard.writeText(vrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.leftGroup}>
          <button type="button" className={styles.headerButton} onClick={() => navigate('/planner')}>
            <FiArrowLeft size={18} />
            <span>Planner</span>
          </button>

          <div className={styles.atmosphereGroup}>
            <button
              type="button"
              className={`${styles.atmosphereBtn} ${atmosphere === 'day' ? styles.atmosphereBtnActive : ''}`}
              onClick={() => setAtmosphere('day')}
            >
              <FiSun size={14} />
              <span>Day</span>
            </button>

            <button
              type="button"
              className={`${styles.atmosphereBtn} ${atmosphere === 'sunset' ? styles.atmosphereBtnActive : ''}`}
              onClick={() => setAtmosphere('sunset')}
            >
              🌇
              <span>Sunset</span>
            </button>

            <button
              type="button"
              className={`${styles.atmosphereBtn} ${atmosphere === 'night' ? styles.atmosphereBtnActive : ''}`}
              onClick={() => setAtmosphere('night')}
            >
              <FiMoon size={14} />
              <span>Night</span>
            </button>
          </div>
        </div>

        <div className={styles.rightGroup}>
          <button type="button" className={styles.headerButton} onClick={() => setShowShareModal(true)}>
            <FiShare2 size={16} />
            <span>VR Headset URL</span>
          </button>
        </div>
      </div>

      <div className={styles.canvasWrapper}>
        <Canvas
          shadows="variance"
          gl={{
            preserveDrawingBuffer: true,
            toneMapping: ACESFilmicToneMapping,
            toneMappingExposure: 1.15,
          }}
          camera={{ position: [0, 1.6, 0], fov: 75 }}
        >
          <FPSController eyeHeight={1.6} moveSpeed={2.5} />

          {/* Photorealistic ArchViz Lighting Setup */}
          {atmosphere === 'day' && (
            <>
              {/* Soft sky fill + warm wood floor bounce */}
              <hemisphereLight skyColor="#e0f2fe" groundColor="#d97706" intensity={0.7} />
              {/* Natural directional sunlight streaming into room */}
              <directionalLight
                position={[4, 5, 2]}
                intensity={1.1}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-radius={6}
                shadow-bias={-0.0001}
                color="#fffdfa"
              />
              {/* Soft ambient indoor bounce */}
              <directionalLight position={[-3, 4, -3]} intensity={0.3} color="#fef3c7" />
            </>
          )}

          {atmosphere === 'sunset' && (
            <>
              <hemisphereLight skyColor="#fdba74" groundColor="#78350f" intensity={0.8} />
              <directionalLight
                position={[5, 2, 4]}
                intensity={1.5}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-radius={8}
                color="#f97316"
              />
            </>
          )}

          {atmosphere === 'night' && (
            <>
              <hemisphereLight skyColor="#1e1b4b" groundColor="#0f172a" intensity={0.35} />
              {/* Downward spotlight for cozy interior illumination */}
              <spotLight
                position={[0, 2.4, 0]}
                intensity={2.2}
                distance={8}
                angle={Math.PI / 3}
                penumbra={0.8}
                color="#ffedd5"
                castShadow
                shadow-mapSize={[1024, 1024]}
              />
            </>
          )}

          <Room disableClipping={true} />

          {placedItems.map((item) => (
            <FurnitureModel key={item.id} item={item} />
          ))}
        </Canvas>
      </div>

      <div className={styles.vrBanner}>
        <div className={styles.vrBannerTitle}>🥽 1:1 Scale Immersive VR Experience</div>
        <div>Drag mouse to look 360° inside · Use <strong>W A S D</strong> or <strong>Arrow Keys</strong> to walk</div>
      </div>

      {showShareModal && (
        <div className={styles.modalOverlay} onClick={() => setShowShareModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>
              <span>🥽 VR Headset Connection</span>
            </div>
            <div className={styles.modalText}>
              Open this link inside the Web Browser of your <strong>Meta Quest</strong>, <strong>Apple Vision Pro</strong>, or mobile VR headset to explore this 3D room in Virtual Reality:
            </div>

            <div className={styles.urlInputRow}>
              <input type="text" readOnly value={vrUrl} className={styles.urlInput} />
              <button type="button" className={styles.copyButton} onClick={handleCopy}>
                {copied ? <FiCheck size={16} /> : <FiCopy size={16} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <button type="button" className={styles.closeModalButton} onClick={() => setShowShareModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
