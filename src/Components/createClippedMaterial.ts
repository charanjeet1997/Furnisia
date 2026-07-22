import { MeshStandardMaterial, type MeshStandardMaterialParameters } from 'three';

export interface ClipUniforms {
  cameraAxisValue: { value: number };
  targetAxisValue: { value: number };
  threshold: { value: number };
  fadeWidth: { value: number };
}

// Injects a per-fragment clip into MeshStandardMaterial's own shader (via onBeforeCompile,
// so PBR lighting/shadows stay intact) instead of toggling a whole mesh's .visible in JS.
//
// Generalized for arbitrary wall angles (not just axis-aligned): the caller computes
// `cameraAxisValue = dot(camera.xz, wallOutwardNormal)` and
// `targetAxisValue = dot(orbitTarget.xz, wallOutwardNormal)` once per frame (see
// polygonGeometry's WallEdge.normal) and `threshold = dot(pointOnWall, wallOutwardNormal)`
// (a fixed plane offset).
//
// A wall hides only when its plane SEPARATES the camera from the orbit target — camera on
// the outward side AND target on the inward side. Testing the camera side alone is correct
// only for convex rooms: in concave shapes (L/T/U) a notch wall's plane extends across the
// rest of the room, so a back wall viewed across the notch also has its outer face toward
// the camera and would be culled despite being the very wall being looked at.
export function createClippedMaterial(
  params: MeshStandardMaterialParameters,
  threshold: number,
  fadeWidth = 0.12,
): { material: MeshStandardMaterial; uniforms: ClipUniforms } {
  const uniforms: ClipUniforms = {
    cameraAxisValue: { value: 0 },
    targetAxisValue: { value: 0 },
    threshold: { value: threshold },
    fadeWidth: { value: fadeWidth },
  };

  const material = new MeshStandardMaterial({ transparent: true, ...params });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader =
      `
      uniform float cameraAxisValue;
      uniform float targetAxisValue;
      uniform float threshold;
      uniform float fadeWidth;
      ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      // Hide only when this wall's plane separates the camera (outward side) from the orbit
      // target (inward side) — i.e. the wall actually stands between viewer and viewed point.
      float camOutside = 1.0 - smoothstep(-fadeWidth, fadeWidth, threshold - cameraAxisValue);
      float targetInside = smoothstep(-fadeWidth, fadeWidth, threshold - targetAxisValue);
      float clipAlpha = 1.0 - camOutside * targetInside;
      if (clipAlpha < 0.02) discard;
      gl_FragColor.a *= clipAlpha;`,
    );
  };

  return { material, uniforms };
}
