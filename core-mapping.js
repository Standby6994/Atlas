// Conservative educational mapping. A null result deliberately delegates to
// the app's tissue/class description; it does not mean the mesh is unidentified.
// Do not infer an organ's function from an artery, ligament or nerve named after it.

function normalize(value) {
  return String(value ?? '').slice(0, 600).normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase().replace(/\.(?:l|r|\d+)$/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim()
    .replace(/^vh [fm] /, '').replace(/\s+[lr]$/, '').replace(/\s+/g, ' ');
}

const indexes = new WeakMap();
function indexFor(cores) {
  const list = Array.isArray(cores) ? cores : cores?.structures;
  if (!Array.isArray(list)) return { list: [], byId: new Map(), exact: new Map() };
  let index = indexes.get(list);
  if (index && index.size === list.length) return index;
  const byId = new Map(), exact = new Map();
  for (const core of list) {
    if (!core || typeof core.id !== 'string') continue;
    byId.set(core.id, core);
    // Exact comparisons are literal. No unescaped user/source name becomes regex.
    for (const value of [core.id, core.name, ...(core.meshNames || []), ...(core.aliases || [])]) {
      const key = normalize(value);
      if (!key) continue;
      const previous = exact.get(key);
      exact.set(key, exact.has(key) && (!previous || previous.id !== core.id) ? null : core);
    }
  }
  index = { list, byId, exact, size: list.length };
  indexes.set(list, index);
  return index;
}

function hit(name, regex) { return regex.test(name); }

// Explicit rules precede any source regex and are independent of core order.
const specificRules = [
  ['right-atrium', /\b(right atrium|atrium right|atrio direito)\b/],
  ['left-atrium', /\b(left atrium|atrium left|atrio esquerdo)\b/],
  ['right-ventricle', /\b(right ventricle|ventricle right|ventriculo direito)\b/],
  ['left-ventricle', /\b(left ventricle|ventricle left|ventriculo esquerdo)\b/],
  ['tricuspid-valve', /\btricuspid\w*( valve)?\b|\bright atrioventricular valve\b/],
  ['mitral-valve', /\b(mitral|bicuspid)\w*( valve)?\b|\bleft atrioventricular valve\b/],
  ['aortic-valve', /\baortic (valve|cusp)\w*\b|\bvalv[au]la? aortic\w*\b/],
  ['aortic-valve', /\b(left coronary leaflet|right coronary leaflet|non coronary leaflet)\b/],
  ['pulmonary-valve', /\bpulmonary (valve|cusp)\w*\b|\bvalv[au]la? pulmonar\b/],
  ['sinoatrial-node', /\b(sinoatrial|sinus node|no sinoatrial)\b/],
  ['glomerulus', /\bglomerul(us|i|o|os)\b/],
  ['bowman-capsule', /\bbowman\b|\bglomerular capsule\b/],
  ['proximal-tubule', /\bproximal (convoluted )?tubul\w*\b/],
  ['distal-tubule', /\bdistal (convoluted )?tubul\w*\b/],
  ['henle-loop', /\bhenle\b|\bnephron loop\b/],
  ['collecting-duct', /\bcollecting (duct|tubule)\w*\b/],
  ['nephron', /\b(nephron|nefron)\w*\b/],
  ['vas-deferens', /\b(vas deferens|ductus deferens|ducto deferente|ductos deferentes)\b/],
  ['seminal-vesicles', /\bseminal (vesicle|gland)\w*\b|\bvesicula[s]? seminal\w*\b/],
  ['uterine-tubes', /\b(fallopian|uterine tube|uterine tubes|tuba uterina|tubas uterinas|oviduct)\w*\b/],
  ['endometrium', /\bendometri\w*\b/],
  ['uterine-cervix', /\b(cervix|colo do utero)\b|\buterine cervical canal\b/],
  ['epididymis', /\bepididym\w*\b|\bepididim\w*\b/],
  ['pineal-gland', /\bpineal\b|\bepiphysis cerebri\b/],
  ['parathyroid', /\bparathyroid\w*\b|\bparatireoid\w*\b/],
  ['adrenal-glands', /\b(adrenal|suprarenal|suprarrenal)\w*\b/],
  ['pituitary', /\b(pituitary|hypophys\w*|hipofis\w*)\b/],
  ['hypothalamus', /\b(hypothalam\w*|hipotalam\w*)\b/],
  ['cerebellum', /\b(cerebell\w*|cerebel\w*)\b/],
  ['brainstem', /\b(brain stem|brainstem|midbrain|pons|medulla oblongata|tronco encefalico|mesencefalo|bulbo encefalico)\b/],
  ['spinal-cord', /\b(spinal cord|medula espinal|medula espinhal)\b/],
  ['cerebral-cortex', /\b(cerebral cortex|cerebrum|cortex cerebral)\b/],
  ['bone-marrow', /\b(bone marrow|medula ossea)\b/],
  ['sweat-glands', /\b(sweat gland|sweat glands|sudoriferous|sudoripar\w*)\b/],
  ['mammary-glands', /\b(mammary gland|mammary glands|breast|mama|mamas)\b/],
  ['intestinal-villi', /\b(intestinal villi|intestinal villus|microvilli|vilosidades intestinais)\b/],
  ['alveoli', /\balveol\w*\b/],
];

const organRules = [
  ['ovaries', /\b(ovary|ovaries|ovarian|ovario|ovarios)\b/],
  ['uterus', /\b(uterus|utero|myometrium|miometrio|uterine segment)\b/],
  ['vagina', /\bvagina\b/],
  ['testes', /\b(testis|testes|testicle|testicles|testiculo|testiculos|seminiferous tubules)\b/],
  ['prostate', /\b(prostate|prostata)\b/],
  ['penis', /\b(penis|penile|corpus cavernosum|corpora cavernosa|corpus spongiosum)\b/],
  ['placenta', /\bplacenta\b/],
  ['heart', /\b(heart|coracao|myocardium|miocardio)\b/],
  ['lungs', /\b(lung|lungs|pulmao|pulmoes)\b/],
  ['kidneys', /\b(kidney|kidneys|rim|rins|renal cortex|renal medulla|renal pelvis)\b/],
  ['urinary-bladder', /\b(bladder|bexiga|detrusor)\b/],
  ['urethra', /\b(urethra|uretra)\b/],
  ['ureters', /\b(ureter|ureters|ureteres)\b/],
  ['gallbladder', /\b(gallbladder|gall bladder|vesicula biliar)\b/],
  ['liver', /\b(liver|figado|hepatic lobe)\b/],
  ['stomach', /\b(stomach|estomago)\b/],
  ['pancreas', /\b(pancreas)\b/],
  ['esophagus', /\b(esophagus|oesophagus|esofago)\b/],
  ['small-intestine', /\b(small intestine|duodenum|jejunum|ileum|intestino delgado|duodeno|jejuno|ileo)\b/],
  ['large-intestine', /\b(large intestine|colon|cecum|caecum|rectum|intestino grosso|reto|ceco)\b/],
  ['salivary-glands', /\b(salivary|parotid|submandibular|sublingual gland|glandula sublingual)\w*\b/],
  ['thyroid', /\b(thyroid|tireoide)\b/],
  ['thymus', /\b(thymus|timo)\b/],
  ['spleen', /\b(spleen|baco)\b/],
  ['tonsils', /\b(tonsil|tonsils|adenoid|adenoids|tonsila|tonsilas|amigdala)\b/],
  ['nasal-cavity', /\b(nasal cavity|nasal cavities|cavidade nasal|fossa nasal)\b/],
  ['larynx', /\b(larynx|laringe|epiglottis|epiglote)\b/],
  ['trachea', /\b(trachea|traqueia)\b/],
  ['bronchi', /\b(bronchus|bronchi|bronchiole|bronchioles|bronquio|bronquios|bronquiolo|bronquiolos)\b/],
  ['diaphragm', /\b(diaphragm|diafragma)\b/],
  ['pleura', /\b(pleura|pleural membrane)\b/],
  ['mouth', /\b(mouth|oral cavity|tongue|boca|lingua|teeth|tooth)\b/],
  ['eye', /\b(eye|eyeball|retina|cornea|lens|iris|olho|cristalino)\b/],
  ['ear', /\b(ear|cochlea|vestibule|semicircular canal|tympanic membrane|orelha|ouvido|coclea)\b/],
  ['epidermis', /\b(epidermis|epiderme)\b/],
  ['dermis', /\b(dermis|derme)\b/],
  ['skin', /\b(skin|pele|integument)\b/],
  ['brain', /\b(brain|encephalon|encefalo)\b/],
];

const blockedOrganParts = /\b(artery|arteries|arterial|vein|veins|venous|nerve|nerves|plexus|ganglion|root|ramus|ligament|ligaments|tendon|tendons|fascia|aponeurosis|bursa|cartilage|muscle|muscles|sphincter|valve|valves|duct|ducts|capsule|bone|bones|joint|joints|sinus|fossa|foramen|canal|articular|articulacao|arteria|veia|nervo|ligamento|tendao|musculo|node|nodes|nucleus|nuclei|tract|tracts|peduncle|commissure|aqueduct|tentorium|dura|arachnoid|pia|meninges|mesentery|mesocolon|fold)\b/;

// Source regex is optional and must be small and structurally simple. Regex
// errors, lookarounds, backreferences and nested repetitions cannot affect matching.
function safePattern(source) {
  if (typeof source !== 'string' || source.length > 140 || /[^a-zA-Z0-9 _\-\[\]()|^$?+*.,\\]/.test(source)) return null;
  if (/\\[1-9]|\(\?|\([^)]*[+*][^)]*\)[+*?]|(?:\+|\*){2}|\.\*/.test(source)) return null;
  try { return new RegExp(source, 'i'); } catch { return null; }
}

export function resolveCore(name, system, cores) {
  const n = normalize(name);
  if (!n) return null;
  const index = indexFor(cores), core = id => index.byId.get(id) || null;
  const layer = normalize(typeof system === 'object' ? system?.id : system);

  // A literal exact match is reliable and does not inherit functions by substring.
  const exact = index.exact.get(n);
  if (exact) return exact;
  // Regional node names often contain the name/adjective of the neighboring
  // organ (gastric, thyroid, diaphragmatic...). They are still lymph nodes.
  if ((layer === 'lymphatic' || layer === 'lymphatic immune') && /\b(node|nodes)\b/.test(n)) return core('lymph-nodes');
  if ((layer === 'female' || /^vh[_ -]f[_ -]/i.test(String(name))) && /^(internal cervical os|external cervical os|cervical canal)$/.test(n)) return core('uterine-cervix');
  if (/^vh[_ -]f[_ -]/i.test(String(name)) && n === 'cornua') return core('uterus');

  const artery = hit(n, /\b(artery|arteries|arterial|arteria|arterias)\b/);
  const vein = hit(n, /\b(vein|veins|venous|veia|veias)\b/);
  const nerve = hit(n, /\b(nerve|nerves|nervo|nervos)\b/);
  // Contradictory tissue classes are not a safe route to one organ/core entry.
  if (Number(artery) + Number(vein) + Number(nerve) > 1) return null;
  if (artery || vein) {
    if (hit(n, /\bpulmonary\b|\bpulmonar\b/)) return core(artery ? 'pulmonary-arteries' : 'pulmonary-veins');
    if (vein && hit(n, /\b(vena cava|veia cava|veias cavas)\b/)) return core('vena-cava');
    if (artery) return null; // The database has no general artery entry; use familyInfo.
    return core('veins');
  }
  if (hit(n, /\b(vena cava|veia cava)\b/)) return core('vena-cava');
  if (hit(n, /\baorta\b|\baortic arch\b/)) return core('aorta');
  if (hit(n, /\bpulmonary trunk\b/)) return core('pulmonary-arteries');
  if (hit(n, /\b(capillary|capillaries|capilar|capilares)\b/) && !hit(n, /\blymph\w*\b/)) return core('capillaries');
  if (hit(n, /\b(arteriole|arterioles|arteriola|arteriolas)\b/)) return core('arterioles');
  if (hit(n, /\b(sagittal sinus|transverse sinus|sigmoid sinus|cavernous sinus|dural venous sinus)\b/)) return core('veins');
  if (hit(n, /\b(lymph node|lymph nodes|linfonodo|linfonodos)\b/)) return core('lymph-nodes');
  if (hit(n, /\b(lymphatic vessel|lymphatic vessels|lymphatic duct|thoracic duct|cisterna chyli|vaso linfatico|vasos linfaticos)\b/)) return core('lymphatic-vessels');
  // This named branch of the facial nerve lacks the word "nerve" and must
  // not inherit the ear entry merely because tympani matches an ear keyword.
  if (hit(n, /\bchorda tympani\b/)) return core('peripheral-nerves');
  if (nerve) return core('peripheral-nerves');
  if (hit(n, /\b(sympathetic|parasympathetic|simpatico|parassimpatico|autonomic)\b/)) return core('autonomic-nervous-system');

  // The source groups teeth and air-filled sinuses with the skeleton, and
  // several connective supports with muscles. Layer membership is not tissue.
  if (hit(n, /\b(tooth|teeth|molar|premolar|incisor|canine)\b|\bsinus of .*bone\b/)) return null;
  if (hit(n, /\b(sheath|sheaths|bursae|tendinous ring|linea alba|iliopectineal arch|superior tarsus|inferior tarsus)\b/)) return null;
  // Named connective tissues win over bones/organs mentioned in their attachment.
  if (hit(n, /\b(tendon|tendons|tendao|tendoes)\b/)) return core('tendons');
  if (hit(n, /\b(ligament|ligaments|ligamento|ligamentos)\b/)) return core('ligaments');
  if (hit(n, /\b(cartilage|cartilagem|meniscus|labrum|intervertebral disc|articular disc)\b/)) return core('cartilage');
  if (hit(n, /\b(fascia|aponeurosis|bursa|retinaculum|intermuscular septum|interosseous membrane)\b/)) return null;
  if (hit(n, /\b(nucleus|nuclei|tract|tracts|peduncle|commissure|aqueduct|tentorium|dura|arachnoid|pia|meninges|mesentery|mesocolon|fold)\b/)) return null;
  // These are a motor pathway and a urine-collecting cavity respectively;
  // selecting the whole organ may include them, but raw-part text must not
  // claim that the pyramid controls ventilation or that the pelvis filters.
  if (hit(n, /\bpyramid of medulla oblongata\b|\brenal pelvis\b/)) return null;
  if (hit(n, /\b(sphincter|dilator pupillae|sphincter pupillae|ciliary muscle)\b/)) return null;
  if (hit(n, /\b(diaphragm|diafragma)\b/) && !blockedOrganParts.test(n.replace(/\bmuscle\b/g, ''))) return core('diaphragm');
  if (hit(n, /\b(muscle|muscles|musculo|musculos)\b/) || layer === 'muscular') {
    if (hit(n, /\b(heart|cardiac|myocardium|papillary|ventricle|ventricular|atrium|atrial)\b/) || layer === 'cardiovascular') {
      for (const [id, pattern] of specificRules.slice(0, 4)) if (pattern.test(n)) return core(id);
      return core('heart');
    }
    if (hit(n, /\b(smooth|visceral|iris|ciliary|stomach|intestine|uterus|bladder|esophagus)\b/)) return null;
    return core('skeletal-muscle');
  }
  if (hit(n, /\b(bronchus|bronchi|bronchiole|bronchioles|bronquio|bronquios|bronquiolo|bronquiolos)\b/)) return core('bronchi');

  // Safe named organs/ducts. Generic tissue markers still block organ inheritance.
  for (const [id, pattern] of specificRules) {
    if (!pattern.test(n)) continue;
    let remainder = n.replace(pattern, ' ').trim();
    if (id.endsWith('-valve')) remainder = remainder.replace(/\b(valve|cusp|leaflet)\w*\b/g, '');
    if (id === 'bowman-capsule') remainder = remainder.replace(/\bcapsule\b/g, '');
    if (!blockedOrganParts.test(remainder)) return core(id);
  }
  if (hit(n, /\b(synovial joint|synovial joints)\b/)) return core('synovial-joints');
  if (hit(n, /\b(bone|bones|osso|ossos|vertebra|vertebrae|rib|ribs|femur|tibia|fibula|humerus|radius|ulna|clavicle|scapula|sternum|patella|sacrum|coccyx|mandible|maxilla|calcaneus|talus|metacarpal|metatarsal|phalanx|phalanges)\b/) || layer === 'skeletal') {
    if (!hit(n, /\b(joint|joints|articulation|articular|articulacao|capsule|foramen|fossa|canal|cells)\b/)) return core('bone');
    return null;
  }
  if (blockedOrganParts.test(n)) return null;
  for (const [id, pattern] of organRules) if (pattern.test(n)) return core(id);

  // Custom patterns may add a new unambiguous organ name, but never override
  // anatomical tissue class guards. Ambiguous matches fail closed.
  const matches = [];
  for (const candidate of index.list) {
    if ((candidate.meshPatterns || []).some(p => {
      const regex = safePattern(p);
      return regex && (regex.test(n) || regex.test(String(name).slice(0, 600)));
    })) matches.push(candidate);
  }
  return matches.length === 1 ? matches[0] : null;
}

export function listMappings(cores, atlas) {
  const result = [];
  if (!atlas || typeof atlas !== 'object') return result;
  for (const [system, entries] of Object.entries(atlas)) {
    if (!Array.isArray(entries)) continue;
    for (const item of entries) {
      const name = typeof item === 'string' ? item : item?.name;
      if (typeof name !== 'string') continue;
      const matched = resolveCore(name, system, cores);
      result.push({ name, system, coreId: matched?.id ?? null });
    }
  }
  return result;
}

// Selection aggregation is intentionally separate from raw part identification.
// Selecting "heart" can reveal chambers and valves without relabeling each part.
export function getCoreMeshNames(selectedCore, registry) {
  if (!selectedCore?.id || !registry) return [];
  const entries = registry instanceof Map ? [...registry.entries()]
    : Array.isArray(registry) ? registry.map((v, i) => [i, v]) : Object.entries(registry);
  const names = new Set();
  const heartIds = new Set(['heart', 'right-atrium', 'left-atrium', 'right-ventricle', 'left-ventricle',
    'tricuspid-valve', 'mitral-valve', 'aortic-valve', 'pulmonary-valve', 'sinoatrial-node']);
  const foreignVessel = /\b(artery|arteries|arterial|vein|veins|venous|vessel|vessels|nerve|nerves|aorta|vena cava|pulmonary trunk|arteria|veia|nervo|lymphatic)\b/;
  for (const [key, item] of entries) {
    const name = typeof item === 'string' ? item : item?.name ?? (typeof key === 'string' ? key : null);
    if (!name) continue;
    const n = normalize(name), system = normalize(item?.system);
    const direct = item?.coreId === selectedCore.id;
    if (selectedCore.id === 'heart') {
      if (foreignVessel.test(n) || system === 'nervous' || /\b(cerebral|brain|lateral ventricle|third ventricle|fourth ventricle)\b/.test(n)) continue;
      if (heartIds.has(item?.coreId) || /\b(heart|coracao|right atrium|left atrium|right ventricle|left ventricle|atrium|atrial|ventricular|myocardium|pericardium|epicardium|endocardium|interatrial|interventricular|tricuspid|mitral|papillary muscle|trabeculae carneae|atrioventricular valve|left coronary leaflet|right coronary leaflet|non coronary leaflet)\b/.test(n)
        || /\b(aortic|pulmonary) (valve|cusp)\b/.test(n)) names.add(name);
      continue;
    }
    if (selectedCore.id === 'lungs') {
      if (foreignVessel.test(n) || /\b(bronch\w*|trachea|larynx|pleura|ligament|diaphragm)\b/.test(n)) continue;
      if (item?.coreId === 'lungs' || /\b(lung|lungs|pulmao|pulmoes|alveol\w*)\b/.test(n)) names.add(name);
      continue;
    }
    if (selectedCore.id === 'kidneys') {
      if (foreignVessel.test(n) || /\b(ureter|urethra|adrenal|suprarenal|ligament)\b/.test(n)) continue;
      if (item?.coreId === 'kidneys' || /\b(kidney|kidneys|rim|rins|renal cortex|renal medulla|renal pelvis|renal pyramid|renal papilla)\b/.test(n)) names.add(name);
      continue;
    }
    if (direct) names.add(name);
  }
  return [...names];
}
