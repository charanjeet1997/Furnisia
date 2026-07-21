import { MeshStandardMaterial, type MeshStandardMaterialParameters } from 'three';

export interface ClipUniforms {
  cameraAxisValue: { value: number };
  threshold: { value: number };
  wallSign: { value: number };
  fadeWidth: { value: number };
}

// Injects a per-fragment clip into MeshStandardMaterial's own shader (via onBeforeCompile,
// so PBR lighting/shadows stay intact) instead of toggling a whole mesh's .visible in JS.
// axisValue = camera.position.x/y/z (whichever axis this wall cares about), threshold = the
// wall's own plane position on that axis, wallSign = +1/-1 for which side counts as "visible".
// wallSign * (axisValue - threshold) > 0 means the camera is on the visible side.
export function createClippedMaterial(
  params: MeshStandardMaterialParameters,
  threshold: number,
  wallSign: number,
  fadeWidth = 0.12,
): { material: MeshStandardMaterial; uniforms: ClipUniforms } {
  const uniforms: ClipUniforms = {
    cameraAxisValue: { value: 0 },
    threshold: { value: threshold },
    wallSign: { value: wallSign },
    fadeWidth: { value: fadeWidth },
  };

  const material = new MeshStandardMaterial({ transparent: true, ...params });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader =
      `
      uniform float cameraAxisValue;
      uniform float threshold;
      uniform float wallSign;
      uniform float fadeWidth;
      ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      float clipD = wallSign * (cameraAxisValue - threshold);
      float clipAlpha = smoothstep(-fadeWidth, fadeWidth, clipD);
      if (clipAlpha < 0.02) discard;
      gl_FragColor.a *= clipAlpha;`,
    );
  };

  return { material, uniforms };
}
