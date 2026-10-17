import * as THREE from 'three';

/** Small, shared, educational tissue finishes for the original anatomical GLBs.
 * Surface variation is illustrative, not photographic or measured histology.
 * No displacement, geometry mutation, UV generation, or added anatomical parts.
 * WebGLRenderer only: tested against the bundled Three.js r180 shaders.
 * Sources: https://threejs.org/docs/pages/Material.html
 * https://threejs.org/docs/pages/MeshStandardMaterial.html
 * https://threejs.org/docs/pages/DataTexture.html
 */

const VERSION = 'atlas-tissue-v3';
const SIZE = 256;
const PROFILES = {
  bone:       { roughness: .79, tone: .28, variation: .18, bump: .00013, scale: 8, weights: [1,0,0,0], warmth: .055, env: .38, label: 'Superfície mineral fosca com grão em várias escalas; microestrutura ilustrativa.' },
  muscle:     { roughness: .48, tone: .30, variation: .20, bump: .000085, scale: 9, weights: [.12,.10,.78,0], warmth: .04, env: .52, label: 'Acabamento muscular fibroso e úmido; orientação ilustrativa, salvo eixo declarado no esquema.' },
  organ:      { roughness: .33, tone: .23, variation: .16, bump: .000042, scale: 7, weights: [.12,.88,0,0], warmth: .04, env: .58, label: 'Superfície orgânica úmida com granulação multiescala, sem vasos ou alterações patológicas adicionados.' },
  skin:       { roughness: .65, tone: .22, variation: .18, bump: .00011, scale: 8, weights: [.12,.12,0,.76], warmth: .045, env: .42, label: 'Pele com microacabamento irregular e fosco; poros ilustrativos, não uma reconstrução histológica.' },
  cartilage:  { roughness: .29, tone: .09, variation: .07, bump: .000012, scale: 6, weights: [0,1,0,0], warmth: .01, env: .55, label: 'Cartilagem lisa com reflexos suaves; sem fissuras artificiais.' },
  connective: { roughness: .58, tone: .19, variation: .14, bump: .00005, scale: 10, weights: [.2,.1,.7,0], warmth: .015, env: .42, label: 'Acabamento fibroso conjuntivo ilustrativo, sem acrescentar feixes à malha.' },
  vascular:   { roughness: .38, tone: .075, variation: .07, bump: .000008, scale: 8, weights: [.1,.9,0,0], warmth: 0, env: .48, label: 'Superfície vascular lisa; preserva as cores didáticas de artérias e veias.' },
  neural:     { roughness: .44, tone: .16, variation: .13, bump: .00003, scale: 7, weights: [.15,.85,0,0], warmth: .025, env: .48, label: 'Superfície nervosa suave; nenhuma fibra, dobra ou subdivisão anatômica nova.' },
  fat:        { roughness: .53, tone: .20, variation: .14, bump: .00005, scale: 7, weights: [.3,.7,0,0], warmth: .025, env: .44, label: 'Acabamento adiposo suave e irregular; não cria lóbulos ou células na malha.' },
  fluid:      { roughness: null, tone: 0, variation: 0, bump: 0, scale: 1, weights: [0,1,0,0], warmth: 0, env: 1, label: 'Fluido: aparência original preservada.' },
  optical:    { roughness: .08, tone: 0, variation: 0, bump: 0, scale: 1, weights: [0,1,0,0], warmth: 0, env: .35, label: 'Meio óptico liso e transparente; transparência de visualização, não uma medição da transmissão de luz.' }
};
// Approximate educational reference colors, not photographic samples or tissue
// identification. Opt-in only; never replaces didactic vascular/diagram colors.
const NATURAL_COLORS = {
  bone: 0xe4dbc3, muscle: 0x9e373d, organ: 0x9c6055, skin: 0xd49985,
  cartilage: 0xd6d9cf, connective: 0xe4dfce, neural: 0xe9ddbd, fat: 0xe4cd83,
  heart: 0x962f3b, liver: 0x773b3d, kidney: 0x82433b, lung: 0xb67b85,
  spleen: 0x6e3546, pancreas: 0xb68d77, digestive: 0xbb7f75,
  reproductive: 0xb77f82, ovary: 0xc8b49e, bladder: 0xc4a59a
};
const CARDIAC_PROFILE = { ...PROFILES.muscle, roughness: .40, tone: .25,
  variation: .15, bump: .000036, weights: [.10,.75,.15,0], env: .60,
  label: 'Acabamento cardíaco orgânico suave; não representa o percurso real de fascículos ou camadas histológicas.' };
let atlas = null;
let materialCache = new WeakMap();
let meshSources = new WeakMap();
let finishSources = new WeakMap();
let ownedMaterials = new Set();
let environmentCache = new WeakMap();
let sourceUses = new WeakMap();
const ownedEnvironments = new Set();

const normalise = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[_:.-]+/g, ' ');
const matched = (s, regex) => regex.test(s);
const structuralName = metadata => normalise([metadata.sourceName || metadata.name, metadata.za_name, metadata.coreId, metadata.pt].filter(Boolean).join(' '));

// Anatomical identity comes from the named mesh, never from a reused material
// such as HRA's lung_mat on ciliary muscle or Bone_Mat on conjunctiva.
// Cornea, lens and vitreous transparency: National Eye Institute, About the Eye
// https://www.nei.nih.gov/eye-health-information/healthy-vision/nei-for-kids/about-eye
// These alpha values are an educational display choice, not optical measurements.
function opticalAppearance(metadata) {
  if (metadata.schematic || metadata.notRealHistology) return null;
  const name = structuralName(metadata);
  if (/\bvitreous humor\b|\bhumor vitreo\b/.test(name)) return { id: 'vitreous', opacity: .09 };
  if (/\baqueous humor\b|\bhumor aquoso\b/.test(name)) return { id: 'aqueous', opacity: .10 };
  if (/\bcornea\b/.test(name)) return { id: 'cornea', opacity: .16 };
  if (/\blens\b|\bcristalino\b/.test(name) && !/ligament|zonul|capsul|suspensor/.test(name)) return { id: 'lens', opacity: .20 };
  return null;
}

function organCategory(metadata, material, tissue) {
  if (!['organ', 'muscle'].includes(tissue)) return null;
  // Anatomical node metadata is more reliable here than reused source-material
  // names (the acervo assigns some muscle materials to unrelated structures).
  const named = [metadata.organ, metadata.coreId, metadata.name, metadata.za_name].filter(Boolean).join(' ');
  const text = normalise(named || material?.name);
  const system = normalise(metadata.system || metadata.za_system);
  if (/\b(heart|coracao|myocardium|miocardio)\b|cardiac|cardiaco/.test(text) ||
      (system === 'cardiovascular' && /\batrium\b|\bventricle\b|papillary muscle/.test(text))) return 'heart';
  if (/\bliver\b|\bhepar\b|figado/.test(text)) return 'liver';
  if (/kidney|renal cortex|renal medulla|\brim\b|\brins\b/.test(text)) return 'kidney';
  if (/\blung\b|pulmao|pulmoes/.test(text)) return 'lung';
  if (/spleen|baco/.test(text)) return 'spleen';
  if (/pancreas/.test(text)) return 'pancreas';
  if (/ovary|ovaries|ovario/.test(text)) return 'ovary';
  if (/uterus|uterine|utero|vagin|fallopian|tuba uterina/.test(text)) return 'reproductive';
  if (/urinary bladder|bexiga/.test(text)) return 'bladder';
  if (/stomach|intestin|esophag|oesophag|colon|estomago/.test(text)) return 'digestive';
  return null;
}

function naturalPalette(metadata, tissue, organ, enabled) {
  if (!enabled || !NATURAL_COLORS[tissue] || ['vascular', 'fluid'].includes(tissue)) return null;
  if (metadata.schematic || metadata.notRealHistology || /^(micro-|histo-|internal-)/.test(metadata.system || metadata.za_system || '')) return null;
  // HRA supplies distinct colors for identified subdivisions. A single organ
  // color erased cortex/medulla and retina/fovea contrast. Keep that contrast;
  // cardiac muscle and its fibrous valves have separate known finish classes.
  if (metadata.organ && /^(?:VH_[FM]_|Allen_)/.test(metadata.sourceName || '') &&
      !(metadata.organ === 'heart' && ['muscle', 'connective'].includes(tissue))) return null;
  return organ && NATURAL_COLORS[organ] ? organ : tissue;
}

/** Classifies an illustrative surface finish, not an anatomical tissue diagnosis.
 * Explicit anatomical names have priority over reused material names; authored
 * material names have priority over system-wide fallback assignments.
 * Explicit metadata.tissue opts a schematic into a known finish. Other
 * schematics remain excluded, preserving the established teaching colors.
 */
export function classifyTissue(metadata = {}, material = null) {
  if (metadata.tissue && PROFILES[metadata.tissue]) return metadata.tissue;
  if (metadata.schematic || metadata.notRealHistology || /^micro-/.test(metadata.system || '')) return 'none';
  const authored = normalise(metadata.materialName || material?.name);
  const name = structuralName(metadata);
  const system = normalise(metadata.system || metadata.za_system);
  if (/\b(?:aqueous|vitreous) humor\b|\bhumor (?:aquoso|vitreo)\b|\bcerebrospinal fluid\b/.test(name)) return 'fluid';
  if (opticalAppearance(metadata)) return 'optical';
  // Test named vessels before muscles: an artery serving a muscle is a vessel.
  if (/\bartery\b|\barteries\b|\bvein\b|\bvenous\b|\blymphatic vessel\b|\bcapillar/.test(name)) return 'vascular';
  if (/\bcartilage\b|\bcartilagem\b|\bmeniscus\b/.test(name)) return 'cartilage';
  if (/\bligament\b|\bligamentum\b|\btendon\b|\bfascia\b|\baponeuros|\bchordae tendineae\b|\bcordas tendineas\b|\bsclera\b/.test(name)) return 'connective';
  if (/\b(?:mitral|tricuspid|aortic|pulmonary|heart) valve\b|\bvalva (?:mitral|tricuspide|aortica|pulmonar)\b/.test(name)) return 'connective';
  if (/\bmuscle\b|\bmusculo\b|\bmyocardium\b|\bmiocardio\b/.test(name)) return 'muscle';
  if (/\bconjunctiva\b|\bconjuntiva\b|\bciliary body\b|\bciliary processes\b|\biris\b|\bchoroid\b/.test(name)) return 'organ';
  if (/\bretina\b|\bnerve\b|\bnervo\b/.test(name)) return 'neural';
  if (matched(authored, /\blcr\b|cerebrospinal|aqueous humor|vitreous humor/)) return 'fluid';
  if (matched(authored, /cartilage/)) return 'cartilage';
  if (matched(authored, /ligament|fascia|tendon|aponeurosis|suture|articular capsule|bursa|peritoneum/)) return 'connective';
  if (matched(authored, /\bbone\b|\bbone-|teeth|dentine/)) return 'bone';
  if (matched(authored, /artery|arterie|\bvein\b|lymph/)) return 'vascular';
  if (matched(authored, /\bskin\b|epiderm/)) return 'skin';
  if (matched(authored, /\bfat\b|adipose/)) return 'fat';
  if (matched(authored, /brain|nerve|spinal cord|white matter|gray matter/)) return 'neural';
  if (matched(authored, /muscle|trapezius|rotator|pennat|diaphragm|orbicularis|constrictor/)) return 'muscle';
  if (matched(authored, /organ|gland|intestine|mucosa|kidney|liver|lung|uterus|ovary|stomach|gallbladder|ductus|bronchi|cornea|\beye\b|\biris\b/)) return 'organ';
  // Structure names are a fallback; avoid calling a named muscle's artery muscle.
  if (matched(name, /artery|arteries|\bvein\b|venous|lymphatic vessel|capillar/)) return 'vascular';
  if (matched(name, /cartilage|cartilagem/)) return 'cartilage';
  if (matched(name, /ligament|tendon|fascia|aponeuros/)) return 'connective';
  if (matched(name, /epiderm|\bskin\b|\bpele\b|dermis/)) return 'skin';
  if (matched(name, /adipose|adiposo|\bfat\b/)) return 'fat';
  if (system === 'skeletal') return 'bone';
  if (system === 'muscular') return 'muscle';
  if (system === 'nervous') return 'neural';
  if (system === 'joints') return 'connective';
  if (system === 'cardiovascular' || system === 'lymphatic') {
    if (matched(authored + ' ' + name, /heart|atrium|ventric|myocard/)) return 'muscle';
    if (matched(authored + ' ' + name, /gland|spleen|thymus|lymph node/)) return 'organ';
    return 'vascular';
  }
  if (system === 'visceral' || system === 'female' || system === 'female reproductive') return 'organ';
  if (matched(authored, /organ|gland|intestine|kidney|liver|lung|uterus|ovary|stomach/)) return 'organ';
  return 'none';
}

/** One RGBA data texture, 256×256, shared by every finished material.
 * R: mineral grain; G: fine organic grain; B: longitudinal fibrous finish;
 * A: skin microrelief. Alpha is data, never used for opacity.
 * Seeded periodic noise is deterministic and repeatable. No per-organ random
 * lesions, winding marble veins, displacement, or photographic claims.
 */
export function getTissueTexture() {
  if (atlas) return atlas;
  const grids = new Map();
  const hash = (x, y, seed) => { let h = Math.imul(x + seed * 101, 374761393) ^ Math.imul(y + 113, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const noise = (u, v, count, seed) => {
    const key = count + ':' + seed; let grid = grids.get(key);
    if (!grid) { grid = new Float32Array(count * count); for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) grid[y * count + x] = hash(x, y, seed); grids.set(key, grid); }
    const x = u * count, y = v * count, ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const at = (a, b) => grid[((b % count + count) % count) * count + ((a % count + count) % count)];
    return (at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx) * (1 - fy) + (at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx) * fy;
  };
  const fbm = (u, v, seed) => .18 * noise(u, v, 4, seed) + .25 * noise(u, v, 8, seed + 1) + .28 * noise(u, v, 16, seed + 2) + .20 * noise(u, v, 32, seed + 3) + .09 * noise(u, v, 64, seed + 4);
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const u = x / SIZE, v = y / SIZE;
    const mineral = fbm(u, v, 7), organic = fbm(u, v, 31), pores = noise(u, v, 48, 83);
    const fine = noise(u, v, 64, 19);
    // Fine broken longitudinal grain, rather than broad winding marble bands.
    const fibres = .08 + .60 * noise(u * 6, v, 16, 59) + .22 * noise(u * 4, v, 8, 61) + .08 * fine;
    const skin = .55 * fbm(u, v, 97) + .25 * pores + .20 * Math.max(0, .6 - pores);
    const i = (y * SIZE + x) * 4;
    pixels[i] = Math.round(THREE.MathUtils.clamp(.5 + (mineral - .5) * 1.85 + (fine - .5) * .15, 0, 1) * 255);
    pixels[i + 1] = Math.round(THREE.MathUtils.clamp(.5 + (organic - .5) * 1.55 + (fine - .5) * .12, 0, 1) * 255);
    pixels[i + 2] = Math.round(THREE.MathUtils.clamp(fibres, 0, 1) * 255);
    pixels[i + 3] = Math.round(THREE.MathUtils.clamp(.5 + (skin - .40) * 1.8, 0, 1) * 255);
  }
  atlas = new THREE.DataTexture(pixels, SIZE, SIZE, THREE.RGBAFormat, THREE.UnsignedByteType);
  atlas.name = 'Shared multiscale tissue finishes (256px; illustrative)';
  atlas.colorSpace = THREE.NoColorSpace;
  atlas.wrapS = atlas.wrapT = THREE.RepeatWrapping;
  atlas.magFilter = THREE.LinearFilter;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.generateMipmaps = true;
  atlas.anisotropy = 1;
  atlas.needsUpdate = true;
  return atlas;
}

function surfaceFrame(metadata) {
  const named = { x: [1,0,0], y: [0,1,0], z: [0,0,1] };
  const value = named[metadata.fiberAxis] || (Array.isArray(metadata.fiberAxis) ? metadata.fiberAxis : null);
  const axis = new THREE.Vector3(...(value?.length === 3 && value.every(Number.isFinite) ? value : [0,1,0]));
  if (axis.lengthSq() < .001) axis.set(0,1,0); axis.normalize();
  const side = new THREE.Vector3(Math.abs(axis.x) < .9 ? 1 : 0, 0, Math.abs(axis.x) < .9 ? 0 : 1).projectOnPlane(axis).normalize();
  const depth = side.clone().cross(axis).normalize();
  return new THREE.Matrix3().set(side.x,side.y,side.z,axis.x,axis.y,axis.z,depth.x,depth.y,depth.z).toArray();
}

function attachShader(material, finish) {
  if (!finish.textured) return;
  const p = finish.profile === 'cardiac' ? CARDIAC_PROFILE : PROFILES[finish.tissue], strength = finish.strength;
  material.onBeforeCompile = function (shader) {
    const required = ['#include <common>', '#include <normal_vertex>', '#include <project_vertex>'];
    const fragmentRequired = ['#include <common>', '#include <map_fragment>', '#include <roughnessmap_fragment>', '#include <normal_fragment_maps>'];
    if (!required.every(s => shader.vertexShader.includes(s)) || !fragmentRequired.every(s => shader.fragmentShader.includes(s))) {
      console.warn('Tissue finish: unsupported shader; retaining the ordinary PBR material.'); return;
    }
    shader.uniforms.tissueAtlas = { value: getTissueTexture() };
    shader.uniforms.tissueScale = { value: p.scale };
    // relief: authored organ cuts are shown ~10× larger than the same organ in the body, so their finish needs more relief.
    const relief = finish.relief || 1;
    shader.uniforms.tissueTone = { value: p.tone * strength * Math.sqrt(relief) };
    shader.uniforms.tissueRoughness = { value: p.variation * strength };
    shader.uniforms.tissueBump = { value: p.bump * strength * relief };
    shader.uniforms.tissueWeights = { value: new THREE.Vector4(...p.weights) };
    shader.uniforms.tissueWarmth = { value: p.warmth * strength };
    shader.uniforms.tissueFrame = { value: new THREE.Matrix3().fromArray(finish.frame || [1,0,0,0,1,0,0,0,1]) };
    shader.uniforms.tissueScale.value *= finish.surfaceScale || 1;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      varying vec3 vTissuePosition;
      varying vec3 vTissueNormal;
      uniform mat3 tissueFrame;`)
      .replace('#include <normal_vertex>', `#include <normal_vertex>
      vTissueNormal = tissueFrame * inverseTransformDirection(transformedNormal, viewMatrix);`)
      .replace('#include <project_vertex>', `#include <project_vertex>
      vec4 tissuePosition = vec4(transformed, 1.0);
      #ifdef USE_BATCHING
        tissuePosition = batchingMatrix * tissuePosition;
      #endif
      #ifdef USE_INSTANCING
        tissuePosition = instanceMatrix * tissuePosition;
      #endif
      vTissuePosition = tissueFrame * (modelMatrix * tissuePosition).xyz;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vTissuePosition;
      varying vec3 vTissueNormal;
      uniform sampler2D tissueAtlas;
      uniform float tissueScale;
      uniform float tissueTone;
      uniform float tissueRoughness;
      uniform float tissueBump;
      uniform vec4 tissueWeights;
      uniform float tissueWarmth;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      vec3 tissueBlend = abs(normalize(vTissueNormal));
      vec4 tissueSample;
      ${finish.quality === 'mobile' ? `
      vec2 tissueUv;
      if (tissueBlend.x > tissueBlend.y && tissueBlend.x > tissueBlend.z) tissueUv = vTissuePosition.zy;
      else if (tissueBlend.y > tissueBlend.z) tissueUv = vTissuePosition.xz;
      else tissueUv = vTissuePosition.xy;
      tissueSample = texture2D(tissueAtlas, tissueUv * tissueScale);
      if (tissueBlend.y > tissueBlend.x && tissueBlend.y > tissueBlend.z) tissueSample.b = mix(tissueSample.r,tissueSample.g,0.5);
      ` : `
      // Soft triplanar blending avoids the old abrupt projection-axis seam.
      tissueBlend *= tissueBlend; tissueBlend *= tissueBlend;
      tissueBlend /= max(dot(tissueBlend,vec3(1.0)),0.0001);
      vec4 tissueX = texture2D(tissueAtlas,vTissuePosition.zy * tissueScale);
      vec4 tissueY = texture2D(tissueAtlas,vTissuePosition.xz * tissueScale);
      vec4 tissueZ = texture2D(tissueAtlas,vTissuePosition.xy * tissueScale);
      // The end-on view of fibres shows grain, rather than transverse bands.
      tissueY.b = mix(tissueY.r,tissueY.g,0.5);
      tissueSample = tissueX * tissueBlend.x + tissueY * tissueBlend.y + tissueZ * tissueBlend.z;
      `}
      float tissueHeight = dot(tissueSample,tissueWeights);
      float tissueToneValue = tissueTone * (0.65 * (tissueHeight-0.5) + 0.35 * (tissueSample.g-0.5));
      diffuseColor.rgb *= (1.0+tissueToneValue) * (vec3(1.0)+tissueWarmth*(tissueSample.g-0.5)*vec3(1.0,0.15,-0.75));`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + tissueRoughness * (tissueHeight - 0.5), 0.08, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      // Differential bump perturbs only the shading normal, never vertices.
      vec3 tissueDx = dFdx(-vViewPosition);
      vec3 tissueDy = dFdy(-vViewPosition);
      vec3 tissueR1 = cross(tissueDy, normal);
      vec3 tissueR2 = cross(normal, tissueDx);
      float tissueDet = dot(tissueDx, tissueR1);
      vec3 tissueGradient = sign(tissueDet) * (dFdx(tissueHeight) * tissueR1 + dFdy(tissueHeight) * tissueR2);
      if (abs(tissueDet) > 1e-12) normal = normalize(abs(tissueDet) * normal - tissueBump * tissueGradient);`);
  };
  // Tissue parameters are uniforms, so all tissue classes reuse the same program.
  material.customProgramCacheKey = () => VERSION + (finish.quality === 'mobile' ? '-dominant' : '-triplanar');
}

function sourceMaterial(material) {
  return finishSources.get(material) || material;
}

/** Returns a cached clone; never mutates the source material.
 * quality:'light' = ordinary PBR, no texture fetch or extra varyings.
 * quality:'mobile' = one lookup, dominant-axis projection for reduced cost.
 * quality:'balanced'/'detail' = three lookups, soft triplanar projection.
 * naturalColors:false (default) keeps authored colors. When true, an approximate
 * reference palette colors the clone; sources, diagrams and vessels stay intact.
 * Authored maps stay. Optically clear named structures use inexpensive alpha
 * blending to expose their contents; no transmission pass or refraction buffer.
 * Other opacity, alpha test, sides and depth/blend settings stay.
 */
export function createTissueMaterial(original, metadata = {}, options = {}) {
  if (!original) return original;
  const source = sourceMaterial(original);
  if (source.userData?.preserveSourceAppearance) return source;
  const tissue = classifyTissue(metadata, source);
  const optical = opticalAppearance(metadata);
  if (options.enabled === false || tissue === 'none' || (tissue === 'fluid' && !optical) || !source.isMeshStandardMaterial) return source;
  const quality = options.quality || 'balanced';
  const organ = organCategory(metadata, source, tissue);
  const profile = organ === 'heart' && tissue === 'muscle' ? 'cardiac' : tissue;
  const palette = naturalPalette(metadata, tissue, organ, options.naturalColors === true);
  const strength = THREE.MathUtils.clamp(Number.isFinite(options.strength) ? options.strength : 1, 0, 1.5);
  // Custom shaders and authored surface maps are preserved instead of replaced.
  const hasSurfaceMap = source.map || source.normalMap || source.bumpMap || source.roughnessMap || source.displacementMap;
  const customShader = source.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile;
  const textured = !optical && quality !== 'light' && !hasSurfaceMap && !customShader && strength > 0;
  const frame = surfaceFrame(metadata), surfaceScale = THREE.MathUtils.clamp(Number.isFinite(metadata.surfaceScale) ? metadata.surfaceScale : 1, .01, 100);
  const relief = THREE.MathUtils.clamp(Number.isFinite(metadata.relief) ? metadata.relief : 1, 1, 40);
  const key = [tissue, profile, quality, strength, textured, frame.join(','), surfaceScale, relief, palette || 'authored', optical?.id || 'solid', !!optical && options.naturalColors === true].join('|');
  let variants = materialCache.get(source);
  if (!variants) { variants = new Map(); materialCache.set(source, variants); }
  if (variants.has(key)) return variants.get(key);
  const material = source.clone();
  if (customShader) {
    material.onBeforeCompile = source.onBeforeCompile;
    material.customProgramCacheKey = source.customProgramCacheKey;
  }
  const p = optical ? PROFILES.optical : profile === 'cardiac' ? CARDIAC_PROFILE : PROFILES[tissue];
  if (palette && !source.map) material.color.setHex(NATURAL_COLORS[palette]);
  if (!hasSurfaceMap && p.roughness !== null) material.roughness = THREE.MathUtils.lerp(source.roughness, p.roughness, .82 * Math.min(strength, 1));
  if (!source.envMap) material.envMapIntensity = p.env;
  if (optical && !hasSurfaceMap && !customShader) {
    material.opacity = Math.min(source.opacity, optical.opacity);
    material.transparent = true;
    material.depthWrite = false;
    material.forceSinglePass = true;
    if (options.naturalColors === true) material.color.setHex(0xe7f0f2);
  }
  const finish = { version: VERSION, tissue, profile, quality, strength, textured, frame, surfaceScale, relief,
    naturalColors: !!palette && !source.map, naturalPalette: palette && !source.map ? palette : null,
    opticalDisplay: optical && !hasSurfaceMap && !customShader ? { ...optical, measured: false } : null,
    description: p.label + (palette && !source.map ? ' Paleta de tecido aproximativa, não fotográfica.' : '') };
  material.userData = { ...material.userData, tissueFinish: finish };
  material.name = source.name; // Classification must remain stable on later calls.
  attachShader(material, finish);
  finishSources.set(material, source); ownedMaterials.add(material); variants.set(key, material);
  return material;
}

/** Material.clone() does not copy shader callbacks. Call immediately after a
 * styled/highlighted clone: copyTissueFinish(original, original.clone()).
 * It keeps every color/opacity edit already made by the caller.
 */
export function copyTissueFinish(source, target, options = {}) {
  const stored = source?.userData?.tissueFinish;
  if (!target || !stored) return target;
  const finish = { ...stored, textured: stored.textured && options.textured !== false };
  target.userData = { ...target.userData, tissueFinish: { ...finish } };
  if (finish.textured) attachShader(target, finish);
  else if (!stored.textured && source.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) {
    target.onBeforeCompile = source.onBeforeCompile;
    target.customProgramCacheKey = source.customProgramCacheKey;
  } else {
    target.onBeforeCompile = THREE.Material.prototype.onBeforeCompile;
    target.customProgramCacheKey = THREE.Material.prototype.customProgramCacheKey;
  }
  finishSources.set(target, sourceMaterial(source));
  return target;
}

function meshMetadata(mesh, supplied) {
  const names = []; let current = mesh, schematic = false, system = supplied.system || supplied.za_system;
  let tissue = supplied.tissue, fiberAxis = supplied.fiberAxis, surfaceScale = supplied.surfaceScale, organ = supplied.organ, relief = supplied.relief;
  let sourceName = supplied.sourceName;
  for (let depth = 0; current && depth < 12; depth++, current = current.parent) {
    const u = current.userData || {};
    schematic ||= !!(u.schematic || u.notRealHistology);
    // The registry's atlasName may become internal-eye:ref-6 after loading.
    // Keep the original anatomical name across quality/color changes.
    sourceName ||= u.sourceNodeName || u.za_name || u.name;
    if (u.za_name || u.sourceNodeName || u.name || u.atlasName || u.atlas_name) names.push(u.za_name || u.sourceNodeName || u.name || u.atlasName || u.atlas_name);
    system ||= u.za_system || u.system;
    tissue ||= u.tissue;
    organ ||= u.organ;
    fiberAxis ||= u.fiberAxis;
    surfaceScale ??= u.surfaceScale;
    relief ??= u.relief;
  }
  return { ...supplied, tissue, fiberAxis, surfaceScale, relief, organ, sourceName, name: names.join(' ') || supplied.name || mesh.userData.name || mesh.name, system, schematic: schematic || supplied.schematic };
}

/** Apply before saving originalMaterial in the app's selection registry. Safe
 * for later quality changes: own source tracking restores the GLB originals.
 * Caller's styled-material cache should be cleared after changing quality.
 */
export function applyTissueFinish(root, metadata = {}, options = {}) {
  const report = { meshes: 0, finished: 0, excluded: 0, materials: new Set(), tissues: {} };
  root.traverse(mesh => {
    if (!mesh.isMesh || !mesh.material) return;
    report.meshes++;
    let originals = meshSources.get(mesh);
    if (!originals) {
      const current = mesh.userData.originalMaterial || mesh.material;
      originals = Array.isArray(current) ? current.map(sourceMaterial) : sourceMaterial(current);
      meshSources.set(mesh, originals);
      for (const source of new Set(Array.isArray(originals) ? originals : [originals])) sourceUses.set(source, (sourceUses.get(source) || 0) + 1);
    }
    const meta = meshMetadata(mesh, typeof metadata === 'function' ? metadata(mesh) || {} : metadata);
    const apply = original => {
      const finished = createTissueMaterial(original, meta, options);
      report.materials.add(finished);
      const tissue = finished.userData?.tissueFinish?.tissue || 'preserved';
      report.tissues[tissue] = (report.tissues[tissue] || 0) + 1;
      return finished;
    };
    mesh.material = Array.isArray(originals) ? originals.map(apply) : apply(originals);
    mesh.userData.originalMaterial = mesh.material;
    if (Array.isArray(mesh.material) ? mesh.material.some(m => m.userData.tissueFinish) : mesh.material.userData.tissueFinish) report.finished++;
    else report.excluded++;
  });
  return { ...report, materials: report.materials.size };
}

export function getTissueFinishStats() {
  return { version: VERSION, textureCount: atlas ? 1 : 0, textureSize: SIZE,
    estimatedTextureBytesWithMipmaps: atlas ? Math.ceil(SIZE * SIZE * 4 * 4 / 3) : 0,
    cachedMaterials: ownedMaterials.size, extraDrawCalls: 0, extraVertices: 0,
    surfaceTextureLookups: { mobile: 1, balanced: 3, detail: 3, light: 0 },
    environmentCount: ownedEnvironments.size,
    estimatedEnvironmentTextureBytes: [...ownedEnvironments].reduce((total, entry) => total + entry.bytes, 0),
    description: 'Shared multiscale tissue atlas; optional prefiltered studio reflection environment; illustrative appearance, not measured histology.' };
}

/** Release a generated model after clearing the app's styled-material cache.
 * Restores its source references before model.dispose(). Variants still used by
 * other registered meshes are retained. Never disposes source materials/meshes.
 */
export function releaseTissueFinish(root) {
  const sources = new Set(); let meshes = 0, disposedMaterials = 0;
  root?.traverse(mesh => {
    if (!mesh.isMesh) return;
    const originals = meshSources.get(mesh); if (!originals) return;
    meshes++;
    for (const source of new Set(Array.isArray(originals) ? originals : [originals])) {
      sourceUses.set(source, Math.max(0, (sourceUses.get(source) || 0) - 1)); sources.add(source);
    }
    mesh.material = originals; mesh.userData.originalMaterial = originals;
    meshSources.delete(mesh);
  });
  for (const source of sources) {
    if (sourceUses.get(source) > 0) continue;
    const variants = materialCache.get(source);
    if (variants) for (const variant of new Set(variants.values())) {
      variant.dispose(); ownedMaterials.delete(variant); finishSources.delete(variant); disposedMaterials++;
    }
    materialCache.delete(source); sourceUses.delete(source);
  }
  return { meshes, disposedMaterials, cachedMaterials: ownedMaterials.size };
}

/** Procedural photographic-style studio lighting, without photographic assets.
 * Returns {texture,dispose,bytes,size}; assign texture to scene.environment and
 * use scene.environmentIntensity around .45–.7 alongside the existing lights.
 * Shared per renderer/size, with independently disposable leases. bytes covers
 * the retained RGBA16F texture only; PMREM scratch/depth/driver overhead excluded.
 * A renderer should be idle during first generation; this is a one-time pass.
 */
export function createTissueEnvironment(renderer, options = {}) {
  if (!renderer?.isWebGLRenderer) throw new TypeError('Tissue environment requires a Three.js WebGLRenderer.');
  const requested = Number.isFinite(options.size) ? options.size : 64;
  const size = 2 ** Math.round(Math.log2(THREE.MathUtils.clamp(requested, 16, 128)));
  let holder = environmentCache.get(renderer);
  if (!holder) { holder = { generator: new THREE.PMREMGenerator(renderer), entries: new Map() }; environmentCache.set(renderer, holder); }
  let entry = holder.entries.get(size);
  if (!entry) {
    const studio = new THREE.Scene(); studio.background = new THREE.Color().setRGB(.025,.030,.040);
    const geometry = new THREE.BoxGeometry(1,1,1), materials = [];
    const add = (position, scale, color, side = THREE.FrontSide) => {
      const material = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(...color), side, toneMapped: false }); materials.push(material);
      const mesh = new THREE.Mesh(geometry,material); mesh.position.set(...position); mesh.scale.set(...scale); studio.add(mesh);
    };
    add([0,0,0],[20,20,20],[.09,.10,.12],THREE.BackSide);
    add([-3,3.2,4.8],[2.1,4.0,.08],[3.8,3.55,3.25]);
    add([4.8,.8,1.8],[.08,4.8,2.4],[2.05,2.25,2.5]);
    add([-.5,5.2,-.5],[5.0,.08,3.4],[2.6,2.65,2.7]);
    add([-.8,.6,-4.8],[.8,3.6,.08],[1.45,1.58,1.75]);
    let target;
    try { target = holder.generator.fromScene(studio,.035,.1,40,{size}); }
    finally { geometry.dispose(); materials.forEach(material => material.dispose()); }
    target.texture.name = 'Atlas procedural softbox studio (prefiltered)';
    entry = { target, texture: target.texture, bytes: target.width * target.height * 8, size, leases: 0 };
    holder.entries.set(size,entry); ownedEnvironments.add(entry);
  }
  entry.leases++;
  let released = false;
  return { texture: entry.texture, bytes: entry.bytes, size: entry.size,
    dispose() {
      if (released) return; released = true; entry.leases--;
      if (entry.leases > 0) return;
      entry.target.dispose(); holder.entries.delete(size); ownedEnvironments.delete(entry);
      if (!holder.entries.size) { holder.generator.dispose(); environmentCache.delete(renderer); }
    }
  };
}

/** Teardown only: original GLB materials and geometries are never disposed. */
export function disposeTissueMaterials() {
  ownedMaterials.forEach(material => material.dispose()); ownedMaterials.clear();
  if (atlas) atlas.dispose(); atlas = null;
  materialCache = new WeakMap(); meshSources = new WeakMap(); finishSources = new WeakMap(); sourceUses = new WeakMap();
}
