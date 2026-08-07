import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { trackVREnter } from '../utils/analytics';
import { FiArrowLeft, FiCopy, FiShare2, FiCheck, FiSun, FiMoon, FiHelpCircle } from 'react-icons/fi';
import { Canvas } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import { ACESFilmicToneMapping } from 'three';
import { usePlannerStore } from '../store/plannerStore';
import { useAuth } from '../store/AuthContext';
import { getSavedRoom, getSharedRoom } from '../store/rooms';
import { decodeRoomFromUrl, encodeRoomToUrl } from '../utils/roomEncoder';
import { Room } from '../Components/Room';
import { FurnitureModel } from '../Components/FurnitureModel';
import { FPSController } from '../Components/FPSController';
import { VRController } from '../Components/VRController';
import { TextureLoadingBar } from '../Components/TextureLoadingBar';
import styles from './VRRoom.module.css';

type Atmosphere = 'day' | 'sunset' | 'night';

import { SpotlightTour, type TourStep } from '../Components/UI/SpotlightTour';

const VR_STEPS: TourStep[] = [
  {
    targetId: 'tour-vr-back',
    icon: '⬅️',
    title: 'Return to 3D Planner',
    description: 'Click Planner to exit VR mode and return to editing room walls or furniture placement.',
  },
  {
    targetId: 'tour-vr-atmosphere',
    icon: '🌅',
    title: 'Lighting & Atmosphere',
    description: 'Switch between Day, Sunset, and Night lighting to experience your room layout under different lighting conditions.',
  },
  {
    targetId: 'tour-vr-banner',
    icon: '🥽',
    title: '1:1 Scale FPS Controls',
    description: 'Click and drag your mouse to look 360° around the room. Use W, A, S, D or Arrow Keys to walk inside at true 1:1 human scale!',
  },
];

function VRLoaderOverlay() {
  const { progress, active } = useProgress();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!active && progress >= 100) {
      const timer = setTimeout(() => setVisible(false), 600);
      return () => clearTimeout(timer);
    } else {
      setVisible(true);
    }
  }, [active, progress]);

  if (!visible) return null;

  const displayPercent = Math.min(Math.round(progress), 100);

  return (
    <div className={styles.loadingOverlay}>
      <div className={styles.loadingBox}>
        <div className={styles.loadingVrHeadset}>🥽</div>
        <div className={styles.loadingTitle}>Loading VR Room</div>
        <div className={styles.loadingSubtext}>
          Preparing 1:1 scale spatial 3D environment, furniture models, and realistic lighting…
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${displayPercent}%` }} />
        </div>
        <div className={styles.progressPercent}>{displayPercent}%</div>
      </div>
    </div>
  );
}

export function VRRoom() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlRoomId = searchParams.get('roomId');
  const urlData = searchParams.get('data');
  const { user } = useAuth();
  const placedItems = usePlannerStore((state) => state.placedItems);
  const savedRoomId = usePlannerStore((state) => state.savedRoomId);
  const loadRoom = usePlannerStore((state) => state.loadRoom);
  const [atmosphere, setAtmosphere] = useState<Atmosphere>('day');
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeRoomId = urlRoomId || savedRoomId;

  useEffect(() => {
    trackVREnter(activeRoomId || undefined);
  }, [activeRoomId]);

  useEffect(() => {
    let cancelled = false;

    if (urlRoomId) {
      // Always fetch latest saved room layout from Firestore first
      getSharedRoom(urlRoomId)
        .then((shared) => {
          if (cancelled) return;
          if (shared) {
            loadRoom(shared.room, shared.placedItems, shared.id, shared.name);
            return;
          }
          if (user) {
            return getSavedRoom(user.uid, urlRoomId).then((saved) => {
              if (cancelled) return;
              if (saved) {
                loadRoom(saved.room, saved.placedItems, saved.id, saved.name);
                return;
              }
              if (urlData) {
                const decoded = decodeRoomFromUrl(urlData);
                if (decoded) loadRoom(decoded.room, decoded.placedItems, urlRoomId, decoded.room.name || 'VR Room');
              }
            });
          }
          if (urlData) {
            const decoded = decodeRoomFromUrl(urlData);
            if (decoded) loadRoom(decoded.room, decoded.placedItems, urlRoomId, decoded.room.name || 'VR Room');
          }
        })
        .catch((err) => {
          console.warn('Firestore room fetch notice:', err);
          if (!cancelled && urlData) {
            const decoded = decodeRoomFromUrl(urlData);
            if (decoded) loadRoom(decoded.room, decoded.placedItems, urlRoomId, decoded.room.name || 'VR Room');
          }
        });
    } else if (urlData) {
      const decoded = decodeRoomFromUrl(urlData);
      if (decoded) {
        loadRoom(decoded.room, decoded.placedItems, null, decoded.room.name || 'VR Room');
      }
    }

    return () => {
      cancelled = true;
    };
  }, [urlRoomId, urlData, user, loadRoom]);

  const room = usePlannerStore((state) => state.room);
  const encodedData = encodeRoomToUrl(room, placedItems);
  const roomIdParam = activeRoomId ? `roomId=${activeRoomId}&` : '';
  const vrUrl = `${window.location.origin}/vr-room?${roomIdParam}data=${encodedData}`;

  function handleCopy() {
    navigator.clipboard.writeText(vrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={styles.container}>
      <VRLoaderOverlay />
      <div className={styles.topBar}>
        <div className={styles.leftGroup}>
          <button id="tour-vr-back" type="button" className={styles.headerButton} onClick={() => navigate('/planner')}>
            <FiArrowLeft size={18} />
            <span>Planner</span>
          </button>

          <div id="tour-vr-atmosphere" className={styles.atmosphereGroup}>
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
          <button
            type="button"
            className={styles.headerButton}
            onClick={() => window.dispatchEvent(new CustomEvent('furnisia-start-tour'))}
            title="VR Tour & Controls Guide"
          >
            <FiHelpCircle size={16} />
            <span>Guide</span>
          </button>
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
          <VRController laserColor={0x6366f1} />

          {/* Photorealistic ArchViz Lighting Setup */}
          {atmosphere === 'day' && (
            <>
              {/* Soft sky fill + warm wood floor bounce */}
              <hemisphereLight args={['#e0f2fe', '#d97706', 0.7]} />
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
              <hemisphereLight args={['#fdba74', '#78350f', 0.8]} />
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
              <hemisphereLight args={['#1e1b4b', '#0f172a', 0.35]} />
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
        <TextureLoadingBar />
      </div>

      <div id="tour-vr-banner" className={styles.vrBanner}>
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

      <SpotlightTour tourKey="vr" steps={VR_STEPS} />
    </div>
  );
}

