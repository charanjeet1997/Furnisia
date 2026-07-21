import { MeshStandardMaterial, type MeshStandardMaterialParameters } from 'three';
import type { ClipUniforms } from './createClippedMaterial';

// Same room-side clip as createClippedMaterial, plus a fresnel term so the window reads as
// glass: near-transparent head-on, brighter/more reflective toward grazing edges. Injected
// into MeshStandardMaterial's own shader (vertex needs a world-position varying added; the
// fragment shader already computes a lit `normal` we can reuse for the fresnel dot product).
export function createGlassMaterial(
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

  const material = new MeshStandardMaterial({ transparent: true, metalness: 0, roughness: 0.02, ...params });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGlassWorldPosition;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvGlassWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );

    shader.fragmentShader =
      `
      uniform float cameraAxisValue;
      uniform float threshold;
      uniform float wallSign;
      uniform float fadeWidth;
      varying vec3 vGlassWorldPosition;
      ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      float clipD = wallSign * (cameraAxisValue - threshold);
      float clipAlpha = smoothstep(-fadeWidth, fadeWidth, clipD);
      if (clipAlpha < 0.02) discard;

      vec3 glassViewDir = normalize(cameraPosition - vGlassWorldPosition);
      float glassFresnel = pow(1.0 - clamp(abs(dot(glassViewDir, normal)), 0.0, 1.0), 3.0);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), glassFresnel * 0.6);
      float glassAlpha = clamp(opacity * (0.4 + glassFresnel * 0.6), 0.0, 1.0);
      gl_FragColor.a = glassAlpha * clipAlpha;`,
    );
  };

  return { material, uniforms };
}
