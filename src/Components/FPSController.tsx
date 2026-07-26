import { useEffect, useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Euler } from 'three';
import { usePlannerStore } from '../store/plannerStore';
import { offsetPolygon, pointInPolygon } from './polygonGeometry';

interface FPSControllerProps {
  eyeHeight?: number;
  moveSpeed?: number;
  lookSensitivity?: number;
  playerRadius?: number;
}

export function FPSController({
  eyeHeight = 1.6,
  moveSpeed = 3.5,
  lookSensitivity = 0.003,
  playerRadius = 0.35,
}: FPSControllerProps) {
  const { camera, gl } = useThree();
  const room = usePlannerStore((state) => state.room);
  const isPointerDown = useRef(false);
  const prevPointerPos = useRef({ x: 0, y: 0 });
  const moveState = useRef({ forward: false, backward: false, left: false, right: false });
  const eulerRef = useRef(new Euler(0, 0, 0, 'YXZ'));

  // Calculate inner polygon boundary offset by player radius so camera never clips through walls
  const innerPolygon = useMemo(() => {
    return offsetPolygon(room.vertices, -playerRadius);
  }, [room.vertices, playerRadius]);

  useEffect(() => {
    // Initial camera position INSIDE the room at 1.6m height
    camera.position.set(0, eyeHeight, 0);
    camera.rotation.set(0, 0, 0);
    eulerRef.current.setFromQuaternion(camera.quaternion, 'YXZ');
    camera.updateMatrixWorld();

    const domElement = gl.domElement;

    // 1. Disable mouse scroll zooming completely
    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      e.stopPropagation();
    }

    // 2. Pointer / Touch drag 360° look
    function handlePointerDown(e: PointerEvent) {
      isPointerDown.current = true;
      prevPointerPos.current = { x: e.clientX, y: e.clientY };
    }

    function handlePointerMove(e: PointerEvent) {
      if (!isPointerDown.current) return;
      const deltaX = e.clientX - prevPointerPos.current.x;
      const deltaY = e.clientY - prevPointerPos.current.y;

      eulerRef.current.y -= deltaX * lookSensitivity;
      eulerRef.current.x -= deltaY * lookSensitivity;
      // Clamp pitch so camera can look straight up at ceiling or down at floor without flipping
      eulerRef.current.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, eulerRef.current.x));

      camera.quaternion.setFromEuler(eulerRef.current);
      camera.updateMatrixWorld();
      prevPointerPos.current = { x: e.clientX, y: e.clientY };
    }

    function handlePointerUp() {
      isPointerDown.current = false;
    }

    // 3. WASD / Arrow key movement
    function handleKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') moveState.current.forward = true;
      if (key === 's' || e.key === 'ArrowDown') moveState.current.backward = true;
      if (key === 'a' || e.key === 'ArrowLeft') moveState.current.left = true;
      if (key === 'd' || e.key === 'ArrowRight') moveState.current.right = true;
    }

    function handleKeyUp(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') moveState.current.forward = false;
      if (key === 's' || e.key === 'ArrowDown') moveState.current.backward = false;
      if (key === 'a' || e.key === 'ArrowLeft') moveState.current.left = false;
      if (key === 'd' || e.key === 'ArrowRight') moveState.current.right = false;
    }

    domElement.addEventListener('wheel', handleWheel, { passive: false });
    domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      domElement.removeEventListener('wheel', handleWheel);
      domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [camera, gl.domElement, eyeHeight, lookSensitivity]);

  useFrame((_, delta) => {
    const speed = moveSpeed * delta;
    const forward = new Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0; // keep walking horizontal at 1.6m eye level
    forward.normalize();

    // Right vector (strafe right for D): forward x UP(0, 1, 0)
    const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();

    const moveVector = new Vector3();

    if (moveState.current.forward) moveVector.addScaledVector(forward, speed);
    if (moveState.current.backward) moveVector.addScaledVector(forward, -speed);
    if (moveState.current.left) moveVector.addScaledVector(right, -speed);
    if (moveState.current.right) moveVector.addScaledVector(right, speed);

    if (moveVector.lengthSq() > 0) {
      const currentX = camera.position.x;
      const currentZ = camera.position.z;
      const targetX = currentX + moveVector.x;
      const targetZ = currentZ + moveVector.z;

      // 1. Try full step
      if (pointInPolygon(innerPolygon, targetX, targetZ)) {
        camera.position.x = targetX;
        camera.position.z = targetZ;
      }
      // 2. Try wall-slide along X axis only
      else if (pointInPolygon(innerPolygon, targetX, currentZ)) {
        camera.position.x = targetX;
      }
      // 3. Try wall-slide along Z axis only
      else if (pointInPolygon(innerPolygon, currentX, targetZ)) {
        camera.position.z = targetZ;
      }

      camera.position.y = eyeHeight;
      camera.updateMatrixWorld();
    }
  });

  return null;
}
