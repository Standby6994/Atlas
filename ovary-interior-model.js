import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createOrganModelContext } from './internal-models.js';

/* Authored teaching reconstruction. Follicular stages are juxtaposed for
 * comparison, not a count of follicles in one patient or one ovarian cycle.
 * The exposed section really contains openings in the cortical mesh; separate
 * follicular walls and recessed cavities occupy those openings. No GLB scan is
 * modified and no primitive sphere/box is used for follicular architecture.
 */
const SOURCES = [
  'https://histology.leeds.ac.uk/home/female/ovary/',
  'https://www.histologyguide.org/slideview/MHS-259-Ovary/18-slide-1.html',
  'https://openstax.org/books/anatomy-and-physiology-2e/pages/27-2-anatomy-and-physiology-of-the-ovarian-reproductive-system',
];
const COLORS = {
  cortex: 0xd69b96, medulla: 0xb87a83, stroma: 0xbe8588,
  follicle: 0xc78b83, theca: 0xc07b86, fibrous: 0xd6b1a0,
  granulosa: 0xb98bba, nucleus: 0x70527e, oocyte: 0xf0c9b3,
  zona: 0xe5ccd7, fluid: 0xb7d4d8, luteal: 0xd9aa6c,
  artery: 0xc85564, vein: 0x637da9,
};
const TAU = Math.PI * 2;

function ellipse(cx, cy, rx, ry, count, phase = 0, ripple = .012) {
  return Array.from({ length: count }, (_, i) => {
    const a = i / count * TAU;
    const f = 1 + ripple * Math.sin(a * 3 + phase) + ripple * .55 * Math.cos(a * 5 - phase * .7);
    return [cx + rx * f * Math.cos(a), cy + ry * f * Math.sin(a)];
  });
}

function smoothLoop(points, count) {
  return new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal')
    .getPoints(count).slice(0, count).map(p => [p.x, p.y]);
}

function inside(point, loop) {
  let result = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i], b = loop[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}

/* Conforming longest-edge refinement: neighboring triangles share midpoint
 * vertices, so refinement introduces neither T-junctions nor surface cracks.
 * Dense boundary loops are shorter than the target edge and remain unchanged.
 */
function refineFace(points, triangles, target, rounds = 6) {
  let tris = triangles;
  const midpoint = new Map();
  const key = (a, b) => a < b ? a + ':' + b : b + ':' + a;
  for (let pass = 0; pass < rounds; pass++) {
    const marked = new Set();
    for (const t of tris) for (let i = 0; i < 3; i++) {
      const a = t[i], b = t[(i + 1) % 3], p = points[a], q = points[b];
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) > target) marked.add(key(a, b));
    }
    if (!marked.size) break;
    const getMid = (a, b) => {
      const k = key(a, b);
      if (!marked.has(k)) return null;
      if (!midpoint.has(k)) {
        midpoint.set(k, points.length);
        points.push([(points[a][0] + points[b][0]) * .5, (points[a][1] + points[b][1]) * .5]);
      }
      return midpoint.get(k);
    };
    const next = [];
    for (const [a, b, c] of tris) {
      const ab = getMid(a, b), bc = getMid(b, c), ca = getMid(c, a);
      const n = [ab, bc, ca].filter(x => x !== null).length;
      if (!n) next.push([a, b, c]);
      else if (n === 3) next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
      else if (n === 1) {
        if (ab !== null) next.push([a, ab, c], [ab, b, c]);
        else if (bc !== null) next.push([b, bc, a], [bc, c, a]);
        else next.push([c, ca, b], [ca, a, b]);
      } else if (ab !== null && bc !== null) next.push([b, bc, ab], [a, ab, c], [ab, bc, c]);
      else if (bc !== null && ca !== null) next.push([c, ca, bc], [b, bc, a], [bc, ca, a]);
      else next.push([a, ab, ca], [c, ca, b], [ca, ab, b]);
    }
    tris = next;
  }
  return tris;
}

function sectionGeometry(outer, holes, depth, front, mobile, options = {}) {
  const loops = [outer, ...holes].map((p, i) => {
    const loop = p.map(([x, y]) => new THREE.Vector2(x, y));
    if (THREE.ShapeUtils.isClockWise(loop) !== (i === 0)) loop.reverse();
    return loop;
  });
  const points = loops.flat().map(p => [p.x, p.y]);
  const originalCount = points.length;
  let tris = THREE.ShapeUtils.triangulateShape(loops[0], loops.slice(1));
  tris = tris.map(([a, b, c]) => {
    const p = points[a], q = points[b], s = points[c];
    return (q[0] - p[0]) * (s[1] - p[1]) - (q[1] - p[1]) * (s[0] - p[0]) < 0 ? [a, c, b] : [a, b, c];
  });
  tris = refineFace(points, tris, options.edge || (mobile ? .033 : .022));
  const pos = [], index = [];
  const relief = options.relief ?? .0016;
  const surface = (x, y) => front + relief * (Math.sin(41 * x + 17 * y) * .45 + Math.sin(23 * y - 13 * x) * .35 + Math.cos(67 * x - 29 * y) * .2);
  for (const [x, y] of points) pos.push(x, y, surface(x, y));
  const stride = points.length;
  for (const [x, y] of points) pos.push(x, y, front - depth);
  for (const [a, b, c] of tris) index.push(a, b, c, a + stride, c + stride, b + stride);
  let offset = 0;
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i++) {
      const a = offset + i, b = offset + (i + 1) % loop.length;
      index.push(a, b + stride, b, a, a + stride, b + stride);
    }
    offset += loop.length;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  geometry.userData = { organCutSection: true, genuineCavities: holes.length, originalBoundaryVertices: originalCount, surfaceRelief: relief, contours: [outer, ...holes] };
  return geometry;
}

// A recessed, smoothly curved fluid boundary; the anterior opening is empty.
function basinGeometry(loop, front, depth, mobile) {
  const N = loop.length, levels = mobile ? 14 : 22, p = [], ix = [];
  const center = loop.reduce((s, q) => [s[0] + q[0] / N, s[1] + q[1] / N], [0, 0]);
  for (let j = 0; j < levels; j++) {
    const t = j / levels, f = Math.cos(t * Math.PI / 2), z = front - depth * Math.sin(t * Math.PI / 2);
    for (const q of loop) p.push(center[0] + (q[0] - center[0]) * f, center[1] + (q[1] - center[1]) * f, z);
  }
  const tip = p.length / 3; p.push(...center, front - depth);
  for (let j = 0; j < levels - 1; j++) for (let i = 0; i < N; i++) {
    const a = j * N + i, b = j * N + (i + 1) % N;
    ix.push(a, a + N, b + N, a, b + N, b);
  }
  for (let i = 0; i < N; i++) ix.push((levels - 1) * N + i, tip, (levels - 1) * N + (i + 1) % N);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geometry.setIndex(ix); geometry.computeVertexNormals();
  geometry.userData = { follicularRecess: true, openFront: true, depth };
  return geometry;
}

export function createOvaryInteriorModel(definition = {}, { mobile = false } = {}) {
  const title = 'Ovário — corte folicular e anatomia interna';
  const description = 'Córtex contínuo com folículos encaixados, medula vascular e folículo antral aberto em camadas selecionáveis. Estágios lado a lado para comparação; ampliação e proporções didáticas.';
  const r = createOrganModelContext('ovary', title, description, 'Corte longitudinal autoral do ovário; +Z é a face exposta. Estágios ampliados para comparação, sem escala histométrica.');
  const count = mobile ? 64 : 96;
  const make = (outer, holes, depth, front, color, options) => {
    const mesh = r.mesh(sectionGeometry(outer, holes, depth, front, mobile, options), color);
    mesh.userData.geometryKind = 'continuous-follicular-section';
    return mesh;
  };
  const combine = (objects, color) => {
    if (objects.length === 1) return objects[0];
    const temporary = objects.map(o => { o.updateMatrix(); return o.geometry.clone().applyMatrix4(o.matrix); });
    const geometry = mergeGeometries(temporary);
    temporary.forEach(g => g.dispose());
    const mesh = r.mesh(geometry, color); mesh.userData.geometryKind = 'merged-organic-detail';
    return mesh;
  };
  const bundle = (...objects) => { const group = new THREE.Group(); objects.flat().forEach(o => group.add(o)); return group; };
  const add = (object, id, label, fn, tissue, details = {}) => r.part(object, id, label, fn, tissue, {
    geometryIdentified: true, authoredReconstruction: true, anatomicalReference: false,
    sourceUrls: SOURCES, ...details,
  });
  const cell = (x, y, rx, ry, z, color, phase = 0) => make(ellipse(x, y, rx, ry, mobile ? 16 : 24, phase, .07), [], .012, z, color, { edge: mobile ? .025 : .014, relief: .001 });
  const nuclei = (cx, cy, rx, ry, n, z, color = COLORS.nucleus, phase = 0) => {
    const objects = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + phase, f = 1 + .025 * Math.sin(i * 2.3);
      const o = cell(cx + rx * f * Math.cos(a), cy + ry * f * Math.sin(a), .0048, .007, z + .001 * Math.sin(i), color, i);
      objects.push(o);
    }
    return combine(objects, color);
  };
  const outer = smoothLoop([[-.73,.045],[-.62,.28],[-.30,.425],[.10,.415],[.46,.30],[.72,.085],[.65,-.205],[.29,-.405],[-.11,-.435],[-.46,-.335],[-.68,-.17]], mobile ? 144 : 208);
  const medullaLoop = smoothLoop([[-.37,.035],[-.29,.125],[-.125,.12],[-.092,.005],[-.13,-.127],[-.29,-.145]], count);
  const mature = { x: .353, y: .065, rx: .286, ry: .249, phase: .7 };
  const stage = {
    primary: { x: -.500, y: .012, rx: .061, ry: .060, phase: .3 },
    secondary: { x: -.333, y: .243, rx: .085, ry: .073, phase: 1.7 },
    growing: { x: -.069, y: .281, rx: .121, ry: .101, phase: 2.3 },
    luteal: { x: -.029, y: -.282, rx: .147, ry: .116, phase: .4 },
  };
  const loopFor = (s, scale = 1) => ellipse(s.x, s.y, s.rx * scale, s.ry * scale, count, s.phase, .014);
  const primordialPositions = [[-.51,.22],[-.575,.155],[-.637,.080],[-.626,-.046],[-.56,-.157],[-.425,-.266],[-.32,-.32],[-.225,.347]];
  const primordialLoops = primordialPositions.map(([x, y], i) => ellipse(x, y, .020 + .002 * Math.sin(i), .018 + .002 * Math.cos(i), mobile ? 32 : 48, i, .05));
  const lutealLoop = Array.from({ length: count }, (_, i) => {
    const a = i / count * TAU, f = 1 + .07 * Math.sin(a * 7 + .4) + .027 * Math.sin(a * 11);
    return [stage.luteal.x + stage.luteal.rx * f * Math.cos(a), stage.luteal.y + stage.luteal.ry * f * Math.sin(a)];
  });
  const corticalHoles = [medullaLoop, loopFor(mature), loopFor(stage.primary), loopFor(stage.secondary), loopFor(stage.growing), lutealLoop, ...primordialLoops];
  const cortex = make(outer, corticalHoles, .23, .008, COLORS.cortex, { edge: mobile ? .036 : .023, relief: .0022 });
  cortex.userData.corticalFollicleCavities = corticalHoles.length - 1;
  add(cortex, 'cortex', 'Córtex ovariano', 'Abrigar folículos no estroma cortical e sustentar seu desenvolvimento.', 'connective');
  add(make(medullaLoop, [], .215, .009, COLORS.medulla), 'medulla', 'Medula ovariana', 'Conduzir vasos e sustentar a região interna do ovário.', 'connective');

  const primordialWalls = [], primordialOocytes = [], primordialNuclei = [];
  primordialLoops.forEach((loop, i) => {
    const [x, y] = primordialPositions[i];
    const inner = ellipse(x, y, .0133, .0125, mobile ? 32 : 48, i, .035);
    primordialWalls.push(make(loop, [inner], .043, .020, COLORS.follicle, { edge: .014 }));
    primordialOocytes.push(cell(x, y, .0128, .0121, .020, COLORS.oocyte, i));
    for (let j = 0; j < 5; j++) {
      const a = j / 5 * TAU + i;
      primordialNuclei.push(cell(x + .016 * Math.cos(a), y + .0144 * Math.sin(a), .0019, .0043, .023, COLORS.nucleus, i + j));
    }
  });
  add(bundle(combine(primordialWalls, COLORS.follicle), combine(primordialOocytes, COLORS.oocyte), combine(primordialNuclei, COLORS.nucleus)), 'primordial_follicles', 'Folículos primordiais (ampliados)', 'Preservar oócitos primários circundados por uma camada de células foliculares achatadas.', 'organ');

  const p = stage.primary, primaryInner = ellipse(p.x, p.y, .036, .034, count, p.phase, .02);
  add(bundle(make(loopFor(p), [primaryInner], .071, .024, COLORS.granulosa), cell(p.x, p.y, .034, .032, .024, COLORS.oocyte), nuclei(p.x, p.y, .049, .046, mobile ? 12 : 17, .027)), 'primary_follicle', 'Folículo primário unilaminar', 'Reconhecer a camada de células cúbicas que envolve o oócito em crescimento.', 'organ');
  const s = stage.secondary, secondaryInner = ellipse(s.x, s.y, .039, .034, count, s.phase, .02);
  add(bundle(make(loopFor(s), [secondaryInner], .094, .026, COLORS.granulosa), cell(s.x, s.y, .031, .027, .027, COLORS.oocyte), make(secondaryInner, [ellipse(s.x, s.y, .032, .028, count, s.phase, .02)], .050, .029, COLORS.zona), nuclei(s.x, s.y, .050, .043, mobile ? 15 : 21, .030), nuclei(s.x, s.y, .071, .058, mobile ? 22 : 32, .030, COLORS.nucleus, .11)), 'secondary_follicle', 'Folículo secundário multilaminar (pré-antral)', 'Mostrar várias camadas de granulosa e zona pelúcida, antes de uma cavidade antral definida.', 'organ', { commonMistake: 'Aqui, secundário designa o estágio multilaminar pré-antral. Algumas fontes usam secundário para o folículo antral; o critério visível é a presença de antro.' });

  const g = stage.growing;
  const earlyHoles = [smoothLoop([[g.x-.025,g.y+.020],[g.x-.036,g.y+.045],[g.x+.010,g.y+.058],[g.x+.046,g.y+.025],[g.x+.030,g.y+.007]], count), smoothLoop([[g.x+.019,g.y-.012],[g.x+.054,g.y-.006],[g.x+.072,g.y-.035],[g.x+.021,g.y-.050]], count)];
  const growingWall = make(loopFor(g), earlyHoles, .118, .026, COLORS.granulosa);
  const growingFluid = earlyHoles.map(loop => r.mesh(basinGeometry(loop, .022, .06, mobile), COLORS.fluid));
  add(bundle(growingWall, combine(growingFluid, COLORS.fluid), cell(g.x-.045, g.y-.032, .025, .023, .030, COLORS.oocyte), nuclei(g.x, g.y, .098, .079, mobile ? 28 : 40, .030)), 'growing_follicle', 'Folículo antral em crescimento', 'Mostrar pequenos espaços com líquido que se unem e ampliam o antro.', 'organ');

  // One continuous outer boundary marks the mature follicle. It does not
  // duplicate the separate theca or granulosa geometry inside that boundary.
  const matureOuter = loopFor(mature), matureInner = loopFor(mature, .943);
  add(make(matureOuter, [matureInner], .218, .018, COLORS.follicle), 'mature_follicle', 'Folículo antral maduro — limite externo', 'Identificar o folículo completo pela sua margem externa no córtex; suas camadas internas são selecionáveis separadamente.', 'organ');
  const thecaInner = loopFor(mature, .84), thecaBoundary = loopFor(mature, .894);
  const thecaFibrous = make(matureInner, [thecaBoundary], .211, .025, COLORS.fibrous);
  const thecaCellular = make(thecaBoundary, [thecaInner], .205, .029, COLORS.theca);
  add(bundle(thecaFibrous, thecaCellular, nuclei(mature.x, mature.y, mature.rx*.865, mature.ry*.865, mobile ? 45 : 70, .032)), 'theca', 'Teca do folículo antral', 'Sustentar o folículo e produzir precursores androgênicos na teca interna vascularizada.', 'connective');
  const antrumLoop = loopFor(mature, .734);
  add(bundle(make(thecaInner, [antrumLoop], .195, .036, COLORS.granulosa), nuclei(mature.x, mature.y, mature.rx*.797, mature.ry*.797, mobile ? 50 : 76, .040), nuclei(mature.x, mature.y, mature.rx*.754, mature.ry*.754, mobile ? 46 : 69, .040, COLORS.nucleus, .037)), 'granulosa', 'Granulosa do folículo antral', 'Revestir o antro sem vasos no seu interior e converter andrógenos em estradiol sob ação do FSH.', 'epithelium');
  const fluid = r.mesh(basinGeometry(antrumLoop, .027, .148, mobile), COLORS.fluid);
  fluid.userData.geometryKind = 'open-follicular-antrum';
  add(fluid, 'antrum', 'Antro folicular', 'Formar a cavidade preenchida por líquido folicular; o modelo mostra sua superfície interna rebaixada.', 'organ', { commonMistake: 'O antro é uma cavidade com líquido. A superfície azulada é uma convenção para revelar sua profundidade, não uma camada celular.' });

  const oo = { x: .237, y: .083, rx: .039, ry: .036 };
  const zonaOuter = ellipse(oo.x, oo.y, .054, .050, count, .7, .013), zonaInner = ellipse(oo.x, oo.y, .041, .038, count, .7, .013);
  const cumulusLoop = smoothLoop([[.142,.074],[.153,.026],[.190,.024],[.222,.019],[.271,.033],[.293,.084],[.274,.132],[.233,.147],[.187,.126],[.154,.120]], count);
  const cumulus = make(cumulusLoop, [zonaOuter], .104, .050, COLORS.granulosa);
  const cumulusNuclei = [];
  for (let i = 0; i < (mobile ? 20 : 34); i++) {
    const a = i / (mobile ? 20 : 34) * TAU, rad = 1.08 + .075 * Math.sin(i * 1.1);
    cumulusNuclei.push(cell(oo.x + .056 * rad * Math.cos(a), oo.y + .051 * rad * Math.sin(a), .0038, .005, .054, COLORS.nucleus, i));
  }
  add(bundle(cumulus, combine(cumulusNuclei, COLORS.nucleus)), 'cumulus_oophorus', 'Cúmulo oóforo', 'Ligar o complexo do oócito à granulosa mural e manter as células de suporte próximas ao oócito.', 'epithelium');
  add(make(zonaOuter, [zonaInner], .071, .062, COLORS.zona, { relief: .0006, edge: mobile ? .020 : .012 }), 'zona_pellucida', 'Zona pelúcida', 'Circundar o oócito com matriz glicoproteica que participa das interações na fecundação.', 'connective');
  add(bundle(make(ellipse(oo.x, oo.y, oo.rx, oo.ry, count, .7, .018), [], .076, .065, COLORS.oocyte, { relief: .003, edge: mobile ? .018 : .010 }), cell(oo.x-.007, oo.y+.004, .0135, .013, .070, COLORS.nucleus, .4)), 'oocyte', 'Ovócito do folículo antral (ampliado)', 'Constituir a célula germinativa sustentada pelas células foliculares; a retomada da meiose depende da maturação e do pico de LH.', 'organ', { commonMistake: 'Oócito e folículo são estruturas diferentes. Esta representação não identifica uma célula já ovulada nem mostra todas as etapas meióticas.' });

  const lutealCavity = Array.from({ length: count }, (_, i) => {
    const a = i / count * TAU, f = 1 + .21 * Math.sin(a * 7 + .4);
    return [stage.luteal.x + .048 * f * Math.cos(a), stage.luteal.y + .043 * f * Math.sin(a)];
  });
  const lutealNuclei = [];
  for (let i = 0; i < (mobile ? 35 : 58); i++) {
    const a = i * 2.399963, f = .40 + .48 * Math.sqrt((i + 1) / (mobile ? 35 : 58));
    lutealNuclei.push(cell(stage.luteal.x + stage.luteal.rx * f * Math.cos(a), stage.luteal.y + stage.luteal.ry * f * Math.sin(a), .004, .0053, .031, COLORS.nucleus, i));
  }
  add(bundle(make(lutealLoop, [lutealCavity], .173, .026, COLORS.luteal, { relief: .004 }), r.mesh(basinGeometry(lutealCavity, .021, .082, mobile), COLORS.medulla), combine(lutealNuclei, COLORS.nucleus)), 'corpus_luteum', 'Corpo lúteo — estágio após ovulação', 'Mostrar a parede folicular luteinizada, dobrada e vascularizada, que secreta principalmente progesterona.', 'organ');

  const vesselObjects = { artery: [], vein: [] };
  const vessel = (kind, points, radii) => vesselObjects[kind].push(r.taperedTube(points, radii, COLORS[kind]));
  vessel('artery', [[-.84,-.052,-.066],[-.55,-.047,-.043],[-.32,-.01,.019],[-.18,.01,.024]], [.019,.016,.012,.009]);
  vessel('vein', [[-.85,-.102,-.066],[-.56,-.112,-.043],[-.29,-.07,.025],[-.15,-.064,.026]], [.024,.023,.018,.012]);
  vessel('artery', [[-.31,-.01,.019],[-.27,.085,.028],[-.21,.102,.029],[-.15,.032,.031]], [.010,.009,.008,.006]);
  vessel('vein', [[-.29,-.07,.025],[-.29,.061,.037],[-.19,.078,.038]], [.012,.009,.006]);
  vessel('artery', [[-.18,.01,.024],[-.075,.080,.022],[.015,.197,.018],[.16,.269,.029],[.30,.298,.029]], [.009,.007,.005,.004,.003]);
  vessel('vein', [[-.15,-.064,.026],[-.044,-.101,.027],[.074,-.180,.026],[.222,-.191,.029],[.35,-.158,.031]], [.011,.009,.006,.004,.003]);
  vessel('artery', [[-.26,-.05,.029],[-.185,-.16,.030],[-.12,-.215,.035],[-.06,-.193,.038]], [.008,.006,.004,.003]);
  vessel('vein', [[-.25,-.08,.037],[-.18,-.18,.043],[-.13,-.255,.044],[-.10,-.306,.040]], [.009,.007,.005,.003]);
  // Small branches end outside the granulosa; its vascular supply is via the
  // surrounding theca. No artery is drawn through the antral fluid or oocyte.
  for (let i = 0; i < 5; i++) {
    const a = .40 + i * .42, x = mature.x + mature.rx*.88*Math.cos(a), y = mature.y + mature.ry*.88*Math.sin(a);
    vessel('artery', [[.16+.04*i,.269-.005*i,.029],[(x+.16+.04*i)*.5,(y+.269-.005*i)*.5,.031],[x,y,.034]], [.003,.0026,.0018]);
  }
  add(bundle(combine(vesselObjects.artery, COLORS.artery), combine(vesselObjects.vein, COLORS.vein)), 'ovarian_vessels', 'Vasos ovarianos e ramos medulares', 'Conduzir sangue pela medula e distribuir ramos ao estroma, à teca e ao corpo lúteo.', 'vascular');

  const model = r.finish();
  model.bounds = new THREE.Box3().setFromObject(model.group);
  model.sources = SOURCES;
  model.defaultClip = 'none';
  model.authoredReconstruction = true;
  model.anatomicalReference = false;
  model.geometryIdentified = true;
  model.preserveMaterials = false;
  model.limits = 'Reconstrução anatômica autoral para ensino, orientada por referências histológicas. Folículos e corpo lúteo são estágios comparativos, sem escala medida, contagem clínica ou representação de um único ciclo. Cores distinguem peças; a superfície do antro indica líquido e profundidade. Não é uma lâmina microscópica nem anatomia individual.';
  model.group.userData = { ...model.group.userData, authoredReconstruction: true, anatomicalReference: false, geometryIdentified: true, defaultClip: 'none', stageComparison: true, follicularCavities: corticalHoles.length - 1, sourceUrls: SOURCES, mobile };
  for (const item of model.parts) item.object.traverse(o => { o.userData.geometryIdentified = true; o.userData.authoredReconstruction = true; o.userData.anatomicalReference = false; });
  model.stats.drawCalls = model.stats.meshes;
  model.stats.quality = mobile ? 'adaptativa para toque' : 'detalhada';
  model.stats.genuineCorticalCavities = corticalHoles.length - 1;
  return model;
}

export const ovaryInteriorSources = SOURCES;
