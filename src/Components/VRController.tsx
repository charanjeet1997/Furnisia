import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { CylinderGeometry, MeshBasicMaterial, Mesh } from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';

interface VRControllerProps {
  laserColor?: number;
  showButton?: boolean;
}

export function VRController({ laserColor = 0x6366f1, showButton = true }: VRControllerProps) {
  const { gl, scene } = useThree();

  useEffect(() => {
    if (!('xr' in navigator)) return;
    gl.xr.enabled = true;

    // 1. WebXR VR Button
    let button: HTMLElement | null = null;
    if (showButton) {
      button = VRButton.createButton(gl);
      button.style.position = 'fixed';
      button.style.bottom = '24px';
      button.style.left = '50%';
      button.style.transform = 'translateX(-50%)';
      button.style.zIndex = '9999';
      button.style.background = '#6366f1';
      button.style.color = '#ffffff';
      button.style.border = 'none';
      button.style.borderRadius = '30px';
      button.style.padding = '12px 28px';
      button.style.fontSize = '14px';
      button.style.fontWeight = 'bold';
      button.style.boxShadow = '0 8px 24px rgba(99, 102, 241, 0.4)';
      button.style.cursor = 'pointer';

      document.body.appendChild(button);
    }

    // 2. 3D Controller & Hand Tracking Models
    const controllerModelFactory = new XRControllerModelFactory();

    // Controller 0 (Left / Right)
    const controller1 = gl.xr.getController(0);
    scene.add(controller1);

    const controllerGrip1 = gl.xr.getControllerGrip(0);
    controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
    scene.add(controllerGrip1);

    // Controller 1 (Right / Left)
    const controller2 = gl.xr.getController(1);
    scene.add(controller2);

    const controllerGrip2 = gl.xr.getControllerGrip(1);
    controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
    scene.add(controllerGrip2);

    // 3. Laser Pointer Rays attached to VR hands
    const rayGeo = new CylinderGeometry(0.002, 0.002, 2, 8);
    rayGeo.rotateX(-Math.PI / 2);
    rayGeo.translate(0, 0, -1);
    const rayMat = new MeshBasicMaterial({ color: laserColor, opacity: 0.8, transparent: true });

    const laser1 = new Mesh(rayGeo, rayMat);
    const laser2 = new Mesh(rayGeo, rayMat);
    controller1.add(laser1);
    controller2.add(laser2);

    return () => {
      if (button) button.remove();
      scene.remove(controller1);
      scene.remove(controllerGrip1);
      scene.remove(controller2);
      scene.remove(controllerGrip2);
    };
  }, [gl, scene, laserColor, showButton]);

  return null;
}
