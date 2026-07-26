import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCopy, FiShare2, FiCheck } from 'react-icons/fi';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { usePlannerStore } from '../store/plannerStore';
import { Room } from '../Components/Room';
import { FurnitureModel } from '../Components/FurnitureModel';
import styles from './VRRoom.module.css';

export function VRRoom() {
  const navigate = useNavigate();
  const placedItems = usePlannerStore((state) => state.placedItems);
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
          gl={{ preserveDrawingBuffer: true, xr: true }}
          camera={{ position: [0, 1.6, 2], fov: 75 }}
        >
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
          <Room />
          {placedItems.map((item) => (
            <FurnitureModel key={item.id} item={item} />
          ))}
          <OrbitControls target={[0, 1.4, 0]} enableZoom={true} enablePan={true} maxPolarAngle={Math.PI / 2 + 0.1} />
        </Canvas>
      </div>

      <div className={styles.vrBanner}>
        <div className={styles.vrBannerTitle}>🥽 1:1 Scale Immersive VR Experience</div>
        <div>Rotate & pan to explore your room from inside at eye level (1.6m).</div>
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
