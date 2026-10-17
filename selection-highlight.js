import * as THREE from 'three';

export const SELECTION_COLOR = '#ffd36b';
const highlightColor = new THREE.Color(SELECTION_COLOR);
const displayColor = new THREE.Vector3(1, 211 / 255, 107 / 255);
const VERSION = 'atlas-selection-rim-v3';
// 0→1 while the camera glides to a new selection; 1 on every still frame, so settled images are unchanged.
export const selectionFade = { value: 1 };

/** Apply only to the cached selected clone: source textures and shared materials
 * remain intact. A view-dependent rim needs no extra mesh, pass, or idle frames. */
export function highlightSelectedMaterial(material) {
  if (material.userData.atlasSelectionHighlight) return material;
  material.userData.atlasSelectionHighlight = VERSION;
  if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
    const compile = material.onBeforeCompile;
    const cacheKey = material.customProgramCacheKey();
    material.onBeforeCompile = function(shader, renderer) {
      compile.call(this, shader, renderer);
      shader.uniforms.atlasSelectionColor = { value: highlightColor };
      shader.uniforms.atlasSelectionDisplayColor = { value: displayColor };
      shader.uniforms.atlasSelectionFade = selectionFade;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 atlasSelectionColor;\nuniform vec3 atlasSelectionDisplayColor;\nuniform float atlasSelectionFade;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float atlasSelectionRim = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.0);
          totalEmissiveRadiance += atlasSelectionFade * atlasSelectionColor * (0.10 + 1.15 * atlasSelectionRim);`)
        // The Atlas uses sRGB output. Preserve a recognizable gold contour
        // after tone mapping, including on bright, pale valve surfaces.
        .replace('#include <colorspace_fragment>', `#include <colorspace_fragment>
          gl_FragColor.rgb = mix(gl_FragColor.rgb, atlasSelectionDisplayColor, atlasSelectionFade * (0.12 + 0.70 * atlasSelectionRim));`);
    };
    material.customProgramCacheKey = () => cacheKey + '|' + VERSION;
  } else if (material.color) {
    // The heart's educational points share one source MeshBasicMaterial.
    // Only the selected clone turns gold; other points remain green.
    material.color.copy(highlightColor);
  }
  material.needsUpdate = true;
  return material;
}
