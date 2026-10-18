/*
 * Only explicitly listed public static assets are stored. Never cache login
 * pages, requests carrying query tokens, API calls or cross-origin responses.
 * Offline on a protected host still needs deployment/device verification.
 * Increment APP_VERSION after changes to shell/data; increment MODEL_VERSION
 * when replacing GLBs. CACHE_ALL downloads sequentially, without decoding GLB.
 */
const APP_VERSION = '2026-10-18-citologia-cores-v42';
const MODEL_VERSION = 'models-v1';
const scopeURL = new URL(self.registration.scope);
const scopeKey = encodeURIComponent(scopeURL.pathname);
const CACHE_PREFIX = 'atlas-humano-' + scopeKey + '-';
const APP_CACHE = CACHE_PREFIX + APP_VERSION;
const MODEL_CACHE = CACHE_PREFIX + MODEL_VERSION;
const CONTENT_CACHE = CACHE_PREFIX + 'content-sha256-v1';
const MAX_ASSET_BYTES = 32 * 1024 * 1024;

const APP_ASSETS = [
  "assets/cytology/real/active-transport-desktop-r1.bin",
  "assets/cytology/real/active-transport-touch-r1.bin",
  "assets/cytology/real/animal-cell-desktop-r1.bin",
  "assets/cytology/real/animal-cell-touch-r1.bin",
  "assets/cytology/real/apoptosis-cancer-desktop-r1.bin",
  "assets/cytology/real/apoptosis-cancer-touch-r1.bin",
  "assets/cytology/real/bacterial-cell-desktop-r1.bin",
  "assets/cytology/real/bacterial-cell-touch-r1.bin",
  "assets/cytology/real/biomolecules-water-desktop-r1.bin",
  "assets/cytology/real/biomolecules-water-touch-r1.bin",
  "assets/cytology/real/calvin-cycle-desktop-r1.bin",
  "assets/cytology/real/calvin-cycle-touch-r1.bin",
  "assets/cytology/real/carbohydrates-lipids-desktop-r1.bin",
  "assets/cytology/real/carbohydrates-lipids-touch-r1.bin",
  "assets/cytology/real/cardiomyocyte-desktop-r1.bin",
  "assets/cytology/real/cardiomyocyte-touch-r1.bin",
  "assets/cytology/real/cell-cycle-desktop-r1.bin",
  "assets/cytology/real/cell-cycle-touch-r1.bin",
  "assets/cytology/real/cell-differentiation-desktop-r1.bin",
  "assets/cytology/real/cell-differentiation-touch-r1.bin",
  "assets/cytology/real/cell-junctions-desktop-r1.bin",
  "assets/cytology/real/cell-junctions-touch-r1.bin",
  "assets/cytology/real/cell-signaling-desktop-r1.bin",
  "assets/cytology/real/cell-signaling-touch-r1.bin",
  "assets/cytology/real/chloroplast-desktop-r1.bin",
  "assets/cytology/real/chloroplast-touch-r1.bin",
  "assets/cytology/real/cilia-flagella-desktop-r1.bin",
  "assets/cytology/real/cilia-flagella-touch-r1.bin",
  "assets/cytology/real/cytoskeleton-desktop-r1.bin",
  "assets/cytology/real/cytoskeleton-touch-r1.bin",
  "assets/cytology/real/diffusion-facilitated-desktop-r1.bin",
  "assets/cytology/real/diffusion-facilitated-touch-r1.bin",
  "assets/cytology/real/dna-replication-desktop-r1.bin",
  "assets/cytology/real/dna-replication-touch-r1.bin",
  "assets/cytology/real/endocytosis-exocytosis-desktop-r1.bin",
  "assets/cytology/real/endocytosis-exocytosis-touch-r1.bin",
  "assets/cytology/real/fungal-cell-desktop-r1.bin",
  "assets/cytology/real/fungal-cell-touch-r1.bin",
  "assets/cytology/real/gametogenesis-desktop-r1.bin",
  "assets/cytology/real/gametogenesis-touch-r1.bin",
  "assets/cytology/real/gene-regulation-desktop-r1.bin",
  "assets/cytology/real/gene-regulation-touch-r1.bin",
  "assets/cytology/real/glycolysis-fermentation-desktop-r1.bin",
  "assets/cytology/real/glycolysis-fermentation-touch-r1.bin",
  "assets/cytology/real/golgi-desktop-r1.bin",
  "assets/cytology/real/golgi-touch-r1.bin",
  "assets/cytology/real/krebs-cycle-desktop-r1.bin",
  "assets/cytology/real/krebs-cycle-touch-r1.bin",
  "assets/cytology/real/light-reactions-desktop-r1.bin",
  "assets/cytology/real/light-reactions-touch-r1.bin",
  "assets/cytology/real/lysosome-autophagy-desktop-r2.bin",
  "assets/cytology/real/lysosome-autophagy-touch-r2.bin",
  "assets/cytology/real/meiosis-desktop-r1.bin",
  "assets/cytology/real/meiosis-touch-r1.bin",
  "assets/cytology/real/mitochondrion-desktop-r1.bin",
  "assets/cytology/real/mitochondrion-touch-r1.bin",
  "assets/cytology/real/mitosis-desktop-r1.bin",
  "assets/cytology/real/mitosis-touch-r1.bin",
  "assets/cytology/real/nucleic-acids-desktop-r1.bin",
  "assets/cytology/real/nucleic-acids-touch-r1.bin",
  "assets/cytology/real/nucleus-chromatin-desktop-r1.bin",
  "assets/cytology/real/nucleus-chromatin-touch-r1.bin",
  "assets/cytology/real/osmosis-tonicity-desktop-r1.bin",
  "assets/cytology/real/osmosis-tonicity-touch-r1.bin",
  "assets/cytology/real/oxidative-phosphorylation-desktop-r1.bin",
  "assets/cytology/real/oxidative-phosphorylation-touch-r1.bin",
  "assets/cytology/real/peroxisome-desktop-r1.bin",
  "assets/cytology/real/peroxisome-touch-r1.bin",
  "assets/cytology/real/plant-cell-desktop-r1.bin",
  "assets/cytology/real/plant-cell-touch-r1.bin",
  "assets/cytology/real/plasma-membrane-desktop-r1.bin",
  "assets/cytology/real/plasma-membrane-touch-r1.bin",
  "assets/cytology/real/proteins-enzymes-desktop-r1.bin",
  "assets/cytology/real/proteins-enzymes-touch-r1.bin",
  "assets/cytology/real/ribosome-desktop-r1.bin",
  "assets/cytology/real/ribosome-touch-r1.bin",
  "assets/cytology/real/rough-er-desktop-r1.bin",
  "assets/cytology/real/rough-er-touch-r1.bin",
  "assets/cytology/real/sarcomere-desktop-r1.bin",
  "assets/cytology/real/sarcomere-touch-r1.bin",
  "assets/cytology/real/smooth-er-desktop-r2.bin",
  "assets/cytology/real/smooth-er-touch-r2.bin",
  "assets/cytology/real/transcription-rna-desktop-r1.bin",
  "assets/cytology/real/transcription-rna-touch-r1.bin",
  "assets/cytology/real/translation-protein-desktop-r1.bin",
  "assets/cytology/real/translation-protein-touch-r1.bin",
  "assets/cytology/real/vacuole-desktop-r1.bin",
  "assets/cytology/real/vacuole-touch-r1.bin",
  "assets/cytology/real/viruses-acellular-desktop-r1.bin",
  "assets/cytology/real/viruses-acellular-touch-r1.bin",
  "assets/cytology/real/ATTRIBUTION.md",
  "practice-session.js",
  "study-entry-routes.js",
  "study-session.js",
  "cytology-surfaces.js",
  "cytology-organelles.js",
  "cytology-processes.js",
  "cytology-materials.js",
  "cytology-real.js",
  "botany-models.js",
  "data/botany-content.json",
  "systematics-view.js",
  "systematics-models.js",
  "systematics-worker.js",
  "systematics-builders.js",
  "systematics-geometry.js",
  "systematics-microbes.js",
  "systematics-plants.js",
  "systematics-vertebrates.js",
  "systematics-invertebrates.js",
  "data/systematics-content.json",
  "assets/cytology/cytology-albedo-4096.jpg",
  "assets/cytology/cytology-albedo-2048.jpg",
  "assets/cytology/cytology-normal-4096.png",
  "assets/cytology/cytology-normal-2048.png",
  "assets/cytology/cytology-roughness-4096.png",
  "assets/cytology/cytology-roughness-2048.png",
  "heart-interior-model.js",
  "ovary-interior-model.js",
  "microscopy-viewer.js",
  "learning-details.js",
  "histology-geometry.js",
  "histology-materials.js",
  "data/organ-detail.json",
  "data/histology-detail.json",
  "data/microscopy-references.json",
  "assets/histology/histology-albedo-4k.png",
  "assets/histology/histology-normal-4k.png",
  "assets/histology/histology-albedo-2k.png",
  "assets/histology/histology-normal-2k.png",
  "images/histology/cardiac-muscle.jpg",
  "images/histology/cardiac-muscle-preview.jpg",
  "images/histology/renal-medulla.jpg",
  "images/histology/renal-medulla-preview.jpg",
  "images/histology/intestinal-mucosa.jpg",
  "images/histology/intestinal-mucosa-preview.jpg",
  "images/histology/thick-skin.jpg",
  "images/histology/thick-skin-preview.jpg",
  "images/histology/ATTRIBUTION.md",
  "selection-highlight.js",
  "tablet-ui.js",
  "render-batches.js",
  "lod-worker.js",
  "process-animations.js",
  "process-digestion.js",
  "process-neuron.js",
  "process-heart.js",
  "ambient-occlusion.js",
  "draw-board.js",
  "study-backup.js",
  "quiz-3d.js",
  "index.html",
  "app.js",
  "styles.css",
  "anatomy-info.js",
  "core-mapping.js",
  "micro-models.js",
  "simulation-engine.js",
  "manifest.webmanifest",
  "internal-models.js",
  "histology-models.js",
  "supplementary-models.js",
  "cytology-models.js",
  "cytology-tools.js",
  "data/cytology-content.json",
  "smart-search.js",
  "picking-index.js",
  "study-selection.js",
  "tissue-materials.js",
  "icons/atlas.svg",
  "icons/atlas-192.png",
  "icons/atlas-512.png",
  "data/physiology.json",
  "data/content-sources.json",
  "data/atlas-systems.json",
  "data/atlas-lexicon.json",
  "data/atlas-female.json",
  "data/atlas-female-body.json",
  "data/simulations.json",
  "data/simulation-sources.json",
  "data/internal-content.json",
  "data/supplementary-content.json",
  "vendor/build/three.module.js",
  "vendor/build/three.core.js",
  "vendor/examples/jsm/controls/OrbitControls.js",
  "vendor/examples/jsm/loaders/GLTFLoader.js",
  "vendor/examples/jsm/loaders/DRACOLoader.js",
  "vendor/examples/jsm/utils/BufferGeometryUtils.js",
  "vendor/bvh/index.module.js",
  "vendor/bvh/LICENSE",
  "vendor/bvh/package.json",
  "models/draco/draco_decoder.js",
  "models/draco/draco_decoder.wasm",
  "models/draco/draco_wasm_wrapper.js",
  "models/License.txt",
  "models/UPSTREAM_LICENSE.txt",
  "models/UPSTREAM_NOTICE.txt",
  "models/BRAIN_ATTRIBUTION.txt",
  "models/FEMALE_ATTRIBUTION.txt",
  "models/FEMALE_BODY_ATTRIBUTION.txt",
  "models/draco/LICENSE.txt",
  "vendor/LICENSE",
  "heart-model.js",
  "reference-organ-models.js",
  "data/heart-annotations.json",
  "data/reference-organs.json",
  "data/reference-part-functions.json",
  "models/DUNDEE_ATTRIBUTION.txt",
  "models/REFERENCE_ATTRIBUTION.txt",
  "models/systematics/ATTRIBUTION.md",
  "MODELOS-ANATOMICOS.md",
  "study-connections.js",
  "reproductive-interior-models.js",
  "data/study-connections.json",
  "data/organ-model-coverage.json",
  "COBERTURA-MODELOS.md",
  "images/histology/renal-cortex.jpg",
  "images/histology/renal-cortex-preview.jpg",
  "images/histology/liver-section.jpg",
  "images/histology/liver-section-preview.jpg",
  "images/histology/pancreas-islet-confocal.jpg",
  "images/histology/pancreas-islet-confocal-preview.jpg",
  "images/histology/ovarian-follicle-real.jpg",
  "images/histology/ovarian-follicle-real-preview.jpg",
  "images/histology/testis-boar.jpg",
  "images/histology/testis-boar-preview.jpg",
  "images/histology/hyaline-cartilage.jpg",
  "images/histology/hyaline-cartilage-preview.jpg",
  "images/histology/thyroid-section.jpg",
  "images/histology/thyroid-section-preview.jpg",
  "images/histology/lung-section.jpg",
  "images/histology/lung-section-preview.jpg",
  "images/histology/dense-connective.jpg",
  "images/histology/dense-connective-preview.jpg",
  "images/histology/peripheral-nerve.jpg",
  "images/histology/peripheral-nerve-preview.jpg",
  "renal-interior-models.js",
  "pulmonary-interior-models.js",
  "images/microscopy/ATTRIBUTION.md",
  "images/microscopy/chloroplast-lettuce-stem-preview.jpg",
  "images/microscopy/chloroplast-lettuce-stem.jpg",
  "images/microscopy/leaf-semithin-reischig-preview.jpg",
  "images/microscopy/leaf-semithin-reischig.jpg",
  "images/microscopy/mitochondria-lung-tem.jpg",
  "images/microscopy/mitosis-vicia-faba-preview.jpg",
  "images/microscopy/mitosis-vicia-faba.jpg",
  "images/microscopy/root-ranunculus-houseman-preview.jpg",
  "images/microscopy/root-ranunculus-houseman.jpg",
  "images/microscopy/stoma-aloe-vera-preview.jpg",
  "images/microscopy/stoma-aloe-vera.jpg",
  "assets/interiors/pulmonary-detailed-v17.bin",
  "assets/interiors/pulmonary-touch-v17.bin",
  "assets/interiors/renal-desktop.bin",
  "assets/interiors/renal-touch.bin",
  "stomach-interior-models.js",
  "small-intestine-interior-models.js",
  "assets/interiors/stomach-desktop-v18.bin",
  "assets/interiors/stomach-touch-v18.bin",
  "assets/interiors/small-intestine-desktop-v18.bin",
  "assets/interiors/small-intestine-touch-v18.bin",
  "images/microscopy/gastric-wall-human.jpg",
  "images/microscopy/gastric-wall-human-preview.jpg",
  "images/microscopy/esophageal-epithelium-human.jpg",
  "images/microscopy/colon-crypts-human.jpg",
  "images/microscopy/colon-crypts-human-preview.jpg",
  "images/microscopy/ATTRIBUTION-DIGESTIVA-V18.md",
  "esophagus-interior-models.js",
  "large-intestine-interior-models.js",
  "assets/interiors/esophagus-desktop-v19.bin",
  "assets/interiors/esophagus-touch-v19.bin",
  "assets/interiors/large-intestine-desktop-v19.bin",
  "assets/interiors/large-intestine-touch-v19.bin",
  "gastric-histology-models.js",
  "colon-histology-models.js",
  "assets/histology/gastric-histology-desktop-v20.bin",
  "assets/histology/gastric-histology-touch-v20.bin",
  "assets/histology/colon-histology-desktop-v20.bin",
  "assets/histology/colon-histology-touch-v20.bin",
  "authored-interiors.js",
  "assets/interiors/heart-desktop-a1.bin",
  "assets/interiors/heart-touch-a1.bin",
  "assets/interiors/ovary-desktop-a1.bin",
  "assets/interiors/ovary-touch-a1.bin",
  "assets/interiors/testis-desktop-a1.bin",
  "assets/interiors/testis-touch-a1.bin",
  "assets/interiors/vagina-desktop-a1.bin",
  "assets/interiors/vagina-touch-a1.bin"
];
const MODEL_ASSETS = [
  "models/skeletal.glb",
  "models/visceral.glb",
  "models/cardiovascular.glb",
  "models/nervous.glb",
  "models/lymphatic.glb",
  "models/muscular.glb",
  "models/joints.glb",
  "models/female-reproductive.glb",
  "models/female-skin.glb",
  "models/female-skeletal.glb",
  "models/female-joints.glb",
  "models/female-muscular.glb",
  "models/female-visceral.glb",
  "models/female-cardiovascular.glb",
  "models/female-nervous.glb",
  "models/female-lymphatic.glb",
  "models/female-reproductive-extra.glb",
  "models/heart-dundee.glb",
  "models/reference/bladder.glb",
  "models/reference/brain.glb",
  "models/reference/eye.glb",
  "models/reference/heart.glb",
  "models/reference/kidney.glb",
  "models/reference/large-intestine.glb",
  "models/reference/larynx.glb",
  "models/reference/liver.glb",
  "models/reference/lungs.glb",
  "models/reference/lymph-node.glb",
  "models/reference/mammary-gland.glb",
  "models/reference/mouth.glb",
  "models/reference/ovary.glb",
  "models/reference/pancreas.glb",
  "models/reference/placenta.glb",
  "models/reference/prostate.glb",
  "models/reference/skin.glb",
  "models/reference/small-intestine.glb",
  "models/reference/spinal-cord.glb",
  "models/reference/spleen.glb",
  "models/reference/synovial-joint.glb",
  "models/reference/thymus.glb",
  "models/reference/tonsil.glb",
  "models/reference/trachea.glb",
  "models/reference/ureter.glb",
  "models/reference/uterine-tube.glb",
  "models/reference/uterus.glb",
  "models/systematics/carp-touch.glb",
  "models/systematics/carp.glb",
  "models/systematics/falcon-touch.glb",
  "models/systematics/falcon.glb",
  "models/systematics/fern-touch.glb",
  "models/systematics/fern.glb",
  "models/systematics/frog-touch.glb",
  "models/systematics/frog.glb",
  "models/systematics/lily-touch.glb",
  "models/systematics/lily.glb",
  "models/systematics/lizard-touch.glb",
  "models/systematics/lizard.glb",
  "models/systematics/locust-touch.glb",
  "models/systematics/locust.glb",
  "models/systematics/moss-touch.glb",
  "models/systematics/moss.glb",
  "models/systematics/mushroom-touch.glb",
  "models/systematics/mushroom.glb",
  "models/systematics/pine-touch.glb",
  "models/systematics/pine.glb",
  "models/systematics/seastar-touch.glb",
  "models/systematics/seastar.glb",
  "models/systematics/snail-touch.glb",
  "models/systematics/snail.glb",
  "models/systematics/sponge-touch.glb",
  "models/systematics/sponge.glb",
];
// Content identity is generated from the published source files. A stable path
// alone never proves that a cached texture or model belongs to this release.
const CONTENT_SHA256 = {
  "assets/cytology/real/active-transport-desktop-r1.bin": "43a752a0658225c02cf1650a0cd195ea30e60f21c0780383eb7c29e6536062d0",
  "assets/cytology/real/active-transport-touch-r1.bin": "3be515bdc0b7c956e93e6a2083fd0d9ab8d6de37b88c68590524460100c462c5",
  "assets/cytology/real/animal-cell-desktop-r1.bin": "bf70b59b7f03c016a0d841caaba10651c8a430962f4762ad3231342ff9ff850a",
  "assets/cytology/real/animal-cell-touch-r1.bin": "d05ba8444a9dedb40b37775e1e2b5e588426a7ed533ed0ee63dab7e5b8935ebd",
  "assets/cytology/real/apoptosis-cancer-desktop-r1.bin": "ffe5511c6a741aca252397ef9c44a5f7619fe6e58e6e459292c5fb3bdfe4b38e",
  "assets/cytology/real/apoptosis-cancer-touch-r1.bin": "9afce2c410861f4012ff16f21247adf285115ca35b06a39bd08fd11ec88afde3",
  "assets/cytology/real/bacterial-cell-desktop-r1.bin": "f88e3eb01da084438b0519ef982b8c7861aa413da809d305c3048998f77a1e30",
  "assets/cytology/real/bacterial-cell-touch-r1.bin": "510ff59d9bc0d1dac1e28bc8c5b943de6c7eaa0d0c66ff3b30e432a5c946d52b",
  "assets/cytology/real/biomolecules-water-desktop-r1.bin": "5b005581d11c7ef54baf6732651db1770610d33ea6e2ce9e3615b82a405642ee",
  "assets/cytology/real/biomolecules-water-touch-r1.bin": "dddba837e85ac26201fe78c7cd7c8673d8cf23ef0a8198f00f8d64f3a6c79be8",
  "assets/cytology/real/calvin-cycle-desktop-r1.bin": "39adfa0e522268887cdc41f6147d7846e1eb17b09c15cf6a0f8fbd55ddd6bc83",
  "assets/cytology/real/calvin-cycle-touch-r1.bin": "b5c85ded31577bbe07d20ba3e073a0d22208f875fd202f37362de2ade1ddb210",
  "assets/cytology/real/carbohydrates-lipids-desktop-r1.bin": "a4c8c38010bf49c083e403a1ab4798c27ec8e06911158d29b802757a36823088",
  "assets/cytology/real/carbohydrates-lipids-touch-r1.bin": "55f2f405271a2414ccb668a382bfa6562c24b7abfec94556a4fde278b451ae14",
  "assets/cytology/real/cardiomyocyte-desktop-r1.bin": "ca6db725848960798ca95550ba9c527ef01ed038cb559a81fd1496c99bbebba0",
  "assets/cytology/real/cardiomyocyte-touch-r1.bin": "a7244dcedf50a793b38cb085b56996ebc624a3e03d9133f0d643b25e364cefd4",
  "assets/cytology/real/cell-cycle-desktop-r1.bin": "296d2d8849441854002bb7d96e84566b3e6b185a1abe1e8190a0f3decf9246d8",
  "assets/cytology/real/cell-cycle-touch-r1.bin": "ab859cfb3a9b8c3728ab2a336c4a584ce420a8c10584d4fb0aa7a792a403c102",
  "assets/cytology/real/cell-differentiation-desktop-r1.bin": "ac6f70b06ceefedb47942b6b7a2612e616885523e4e648b5191499fa6cf49039",
  "assets/cytology/real/cell-differentiation-touch-r1.bin": "f783276564d744a2ab0016d0ca01766dfefd9db11323381a8dd183854e8324ed",
  "assets/cytology/real/cell-junctions-desktop-r1.bin": "e941937d90523d019707c75192847dfcaffb26126a0729a5d327355d5350cf18",
  "assets/cytology/real/cell-junctions-touch-r1.bin": "81dac7cd83893647fa6c004dba15ebf11f56cdb3b876ff98375f19452d9a0c56",
  "assets/cytology/real/cell-signaling-desktop-r1.bin": "c0a15a92124019883047d60baec09a023c66ed0c73e33f0d55001c07901bd4d7",
  "assets/cytology/real/cell-signaling-touch-r1.bin": "f88bde6fb4b000c65f9662f1f0cda568ae4dd3cab6589490aa8172acd29134fe",
  "assets/cytology/real/chloroplast-desktop-r1.bin": "3336dc5ea129fb9f988873dd5e2c8473a985550c15ad140f348d017a1a7907ed",
  "assets/cytology/real/chloroplast-touch-r1.bin": "5c728d0a92dc76a6420e3f03779014d5e75cb6e601ef311a9e02977d5c9febaf",
  "assets/cytology/real/cilia-flagella-desktop-r1.bin": "b30781547219f8135b52188cf92a6078e2a5657ff22b51f7f2da42f546d602cb",
  "assets/cytology/real/cilia-flagella-touch-r1.bin": "883283ee3cd4cf0d48523590191c6c42d56922041781aa4eb0424528ee10325d",
  "assets/cytology/real/cytoskeleton-desktop-r1.bin": "ac91ff7d57ddf50da399d5c63eddcb9ece93085ccb359b964948e929b22afe79",
  "assets/cytology/real/cytoskeleton-touch-r1.bin": "39eae01c5035506a1249f3aeaa7455bb036f7835d75668ac35b80bbe7f3e4fe2",
  "assets/cytology/real/diffusion-facilitated-desktop-r1.bin": "b14949a0e7bbe52947f2645e14af586fcebe55eb5be19ec1e864e8c1737172ab",
  "assets/cytology/real/diffusion-facilitated-touch-r1.bin": "19ffcc631d809d54696675ec78984e0e479fe394954a8b156123e477c5d6f5e0",
  "assets/cytology/real/dna-replication-desktop-r1.bin": "a4f59fb89f7c52b14114c466f601effab7af38c0743c4e5f5ca6f9daca3e53fb",
  "assets/cytology/real/dna-replication-touch-r1.bin": "07afdd6412b615d060ae9dfe4e3465c143146c4d662c05fb4cee711df099b59b",
  "assets/cytology/real/endocytosis-exocytosis-desktop-r1.bin": "3f7f5be68bf64c18654c564556f98df085e5553601b1bc4a83d315881f880e63",
  "assets/cytology/real/endocytosis-exocytosis-touch-r1.bin": "0cddd30f6a0fabe4af80c68169fdb21cc006318e86a4eedc591b74785d9cb9eb",
  "assets/cytology/real/fungal-cell-desktop-r1.bin": "eeb765b8c04871966a6fb87041f89356d4568d6c687da13e36634850b27e46e1",
  "assets/cytology/real/fungal-cell-touch-r1.bin": "4afce99c468aea10eb6244ba734b9de5eb42da531ee8b73662f9e06d241d0f62",
  "assets/cytology/real/gametogenesis-desktop-r1.bin": "5347905e1dbe42fff762700867e59bf5fa057f0cb224268390da03282c52ba2a",
  "assets/cytology/real/gametogenesis-touch-r1.bin": "74b47b08d77750b38eebd1cc5aed1c5f8919345483d46cf976b750d38e8ba4a2",
  "assets/cytology/real/gene-regulation-desktop-r1.bin": "07b54799dd5fd6644580f04022a44f76d71a1de02bf1ce716e775a705d682318",
  "assets/cytology/real/gene-regulation-touch-r1.bin": "bb131dadf5012a0f8f7e46d714b258ce040501aba6f66b9d4082676682fb8e84",
  "assets/cytology/real/glycolysis-fermentation-desktop-r1.bin": "97709e3f307d5597aec8850ff5256d29ffbc1ee7424989668d7cfe51f2d57431",
  "assets/cytology/real/glycolysis-fermentation-touch-r1.bin": "4b35c97da953df0351ac45371a73a88c67ba7daaade5bad10a99ee0a52eab82c",
  "assets/cytology/real/golgi-desktop-r1.bin": "406a2f42588c277197d29409ad68734e6ec43549ece2dceb92d7bae3c7756fc1",
  "assets/cytology/real/golgi-touch-r1.bin": "d708b97d673955e911c017c9b466dc39a54b2be88521f6a8702cd203acbc1f86",
  "assets/cytology/real/krebs-cycle-desktop-r1.bin": "35fa474bee433e42823eed68ad4517f3dcb025d07ec89c6c0edf5ad13a0525e7",
  "assets/cytology/real/krebs-cycle-touch-r1.bin": "b63182e10d24157a4e9b3db20109dc5b054639886ca687495653cb0bf19aaf4e",
  "assets/cytology/real/light-reactions-desktop-r1.bin": "9077aeb23555eb21f055a559d4a6a9bea931d269f4173bcd54381efba8c9c4dd",
  "assets/cytology/real/light-reactions-touch-r1.bin": "58265010ccc9c783eb411582b6e519f1e10f9addd48389aef92ef3c73fc66608",
  "assets/cytology/real/lysosome-autophagy-desktop-r2.bin": "c57e3ab357eea1f6a4c01dbfa9d243bc32e224cc87b43d1bf4c9c4d6a2181b67",
  "assets/cytology/real/lysosome-autophagy-touch-r2.bin": "6b206d9e7c0a5497f6344d2823338df464c757af7c44f5872f33e8c40d1cd2e2",
  "assets/cytology/real/meiosis-desktop-r1.bin": "360c7ad940ce5611dbe5e67db530ce6073c6281112e560a727d89c09bc050bd9",
  "assets/cytology/real/meiosis-touch-r1.bin": "c06d509c889753c39fcd6e868be1351e00f220e78ebe8560225741059ae8bdae",
  "assets/cytology/real/mitochondrion-desktop-r1.bin": "d9323fee9db7330299cb625a9b77e4d16ad3f0d7fcecb554806d23e722b33c14",
  "assets/cytology/real/mitochondrion-touch-r1.bin": "a042aa234d2a22865de7b422bc7a5200fa055136573a24511b3f7069fafb575e",
  "assets/cytology/real/mitosis-desktop-r1.bin": "6667e81db69b22f5545df0cbcf7266b3cf345b9c647313120698cd374abe8b9a",
  "assets/cytology/real/mitosis-touch-r1.bin": "ac4eaba2076da501f65dd9e55c4796b49bc0de2f9d2588b63b63d2286a44b8dc",
  "assets/cytology/real/nucleic-acids-desktop-r1.bin": "76217db0b6753017c1d6607afafc6267cefb4fdd12dde383d51fdc252e39a687",
  "assets/cytology/real/nucleic-acids-touch-r1.bin": "865cfd62b5c0490d0970208170137f5d12a8014d2273e22315ec891a53f8da9e",
  "assets/cytology/real/nucleus-chromatin-desktop-r1.bin": "69fb26a7dba774eb727a8003d137da5e1be7066195c62c56b06bc5bdbcd7633a",
  "assets/cytology/real/nucleus-chromatin-touch-r1.bin": "53ca9f673c281a56c22de6c64c38195dd7331bb07056886df9a2df6c9f9b67ba",
  "assets/cytology/real/osmosis-tonicity-desktop-r1.bin": "326194142fcb14286133028ace64cce6e87aa04bce3999f00fe70b32194e3343",
  "assets/cytology/real/osmosis-tonicity-touch-r1.bin": "694844d253d11422ef11f9263e4b04004d2e70624f325b7e5a4cccf6bc54a462",
  "assets/cytology/real/oxidative-phosphorylation-desktop-r1.bin": "1379018372d5570d1b03a420313587ea756e53bfbe31a6bd31485754f548d77f",
  "assets/cytology/real/oxidative-phosphorylation-touch-r1.bin": "b8bbb8fb4a27275c80b13ff98e1555c0defab37ba1228dafbda7de81b323a62a",
  "assets/cytology/real/peroxisome-desktop-r1.bin": "139a984a9a0b2c0c4e10f1a7d8cbb4da744d08ab6a04ad3fd009dbf49a363171",
  "assets/cytology/real/peroxisome-touch-r1.bin": "8e7c009f76173aa416b765ed9a270cfe42b6e4c2d7d771afc7bd7ad0d8fdd62a",
  "assets/cytology/real/plant-cell-desktop-r1.bin": "4e64a61712fb2be4b67a70bdd54ec805ba4103ca9a7ed4392b8dfceb9136adac",
  "assets/cytology/real/plant-cell-touch-r1.bin": "fe46ab4944b0f41c2b222927600b1327546e39f4e130adaa7324ab32db68d5f5",
  "assets/cytology/real/plasma-membrane-desktop-r1.bin": "439872162285014d3097aa6b49a54cb80212b19bb6668dae2ecee4c6e438010e",
  "assets/cytology/real/plasma-membrane-touch-r1.bin": "f707c336119ff046cd06248ef379e6af68b6e0d5a9089f28046c289b3fee4117",
  "assets/cytology/real/proteins-enzymes-desktop-r1.bin": "6a203b4d7ed8b3d1bea920446c30333df1954a64f7da95207fe62e8a32e32492",
  "assets/cytology/real/proteins-enzymes-touch-r1.bin": "a5f9b43c8c92e6026c9b3fccf12f0909b225904d9e3ea59cf835cbe290881a1f",
  "assets/cytology/real/ribosome-desktop-r1.bin": "70cb2519916a23d34963788e86df1607cd451c8ddb84cf5a92d9dc23edf7cfcf",
  "assets/cytology/real/ribosome-touch-r1.bin": "76ff0a0bdb03d9027011471f5d9a045d379e1c1b5e8db48d02938f13ea32ed65",
  "assets/cytology/real/rough-er-desktop-r1.bin": "84d3d05efde3b8c3781e13b34ca8a7daf2edb82b06e42606b5af0bb139f9a102",
  "assets/cytology/real/rough-er-touch-r1.bin": "a62810f272ce18f3fc5308ac621f7fb46a7fcd795a4830b185a687cdafd045c9",
  "assets/cytology/real/sarcomere-desktop-r1.bin": "a5337df51122f3d58f675a1fa14043eaecc7ad1a63f613c7e9f7da4b21114dc9",
  "assets/cytology/real/sarcomere-touch-r1.bin": "6180656e287d2db9915fc0bcceba426b7fe6c683637b8d487b4139d9856ca117",
  "assets/cytology/real/smooth-er-desktop-r2.bin": "bb69c4b433afda804e15866ce0f1cfd20dc9d3ae359c8a6aeff8be667cda9666",
  "assets/cytology/real/smooth-er-touch-r2.bin": "d7ee1543ae291b2f52c2426906158c78ea75329aa3f7f444d7cc659a369d7535",
  "assets/cytology/real/transcription-rna-desktop-r1.bin": "3fbbb929be9614ed47fdda1dc72ca52975e5313af8c22efa327c57467ae0c88d",
  "assets/cytology/real/transcription-rna-touch-r1.bin": "611931dfea74433f2516a5e8757e8854893403cbc3e474c0805d82fc2ef7ab76",
  "assets/cytology/real/translation-protein-desktop-r1.bin": "9c2d4de2ffb9d2dfe8015127f73cce39d85bd2b356f18ceb7df15e7d8a8f5fad",
  "assets/cytology/real/translation-protein-touch-r1.bin": "219fb9c9227ba632b99fdf4180c044a803b6e3dd892575d3404fe045f860fadf",
  "assets/cytology/real/vacuole-desktop-r1.bin": "60fa9663bc2a6d8bd356b03b0bf5389747878951d24b27dd4c0f65ca745dd36e",
  "assets/cytology/real/vacuole-touch-r1.bin": "4b7c7ae6a109d30a21225fff0d141882d7285eb126f41b9404fb0142ea70862f",
  "assets/cytology/real/viruses-acellular-desktop-r1.bin": "ac67a5829bb9e12af5440d5ed99e7860dfd766f2265cea025ce671b35e4e767b",
  "assets/cytology/real/viruses-acellular-touch-r1.bin": "931b39418e1f99e6ae592233285802bdbbd6c8696e237f873858041aab75d117",
  "assets/cytology/cytology-albedo-4096.jpg": "32e99549fea4a1420ada2f979d41e03ebe1f342a59c24d33475412a0c5ebf2a5",
  "assets/cytology/cytology-albedo-2048.jpg": "3a33900046cee5c4dcf61fed9b9a361fefa0d78c5eeee180633cb145308c3374",
  "assets/cytology/cytology-normal-4096.png": "05c07fba5b79b198daa8a3c26b85dbc892e02020e7e4e753024f9cbc147024b9",
  "assets/cytology/cytology-normal-2048.png": "f9158f0a26579e434f828ad352e8b20b4f0e8e9b801714237fd44e0d78290d90",
  "assets/cytology/cytology-roughness-4096.png": "fdfef6445ae5884a7fb060493ad31b51ba930bd7dc7f30875fdbba4ccfbe4e47",
  "assets/cytology/cytology-roughness-2048.png": "2534e685724954cd8befb6327b6c8d012a1c0270a9503edb742bf36a693d1532",
  "assets/histology/histology-albedo-4k.png": "f42e81cfa2aed5a91ebe66267a40335d61fd554b1d770376ce139a32582a1b01",
  "assets/histology/histology-normal-4k.png": "ee02dabbfde81a91e8b0c0fdc4339a2e35518b11b625ae8d277e8e06221ae85f",
  "assets/histology/histology-albedo-2k.png": "905affbfbbecc6cbec5927fdf0c505ccbd938888861c537f1b6cdba379ece570",
  "assets/histology/histology-normal-2k.png": "b2a85933f7d5f799a9dfd3b0cdc702adeeeaca8ad3e39aafc7d149baff1107a7",
  "images/histology/cardiac-muscle.jpg": "1c5c21889c20c23a6a15e40440830918b671e7ea7a177cac2b015340fb883a67",
  "images/histology/cardiac-muscle-preview.jpg": "eee40221bb8ee3ebed87e6a50adf5312574f762b6330bc3e0676d8ce24e30d8c",
  "images/histology/renal-medulla.jpg": "68a576df6708fb47a66e70286cc3b833e73082105a1621c4205b622f0fc02c31",
  "images/histology/renal-medulla-preview.jpg": "504ee36cc6b544d2e5ecc7817bb288a8ca6fba11e5d00cd7094d063ba7bb9737",
  "images/histology/intestinal-mucosa.jpg": "e41e246542a05a4f7397c9f2699638965fc096c7ff272c6b4e952995dfcdf8fc",
  "images/histology/intestinal-mucosa-preview.jpg": "1fa12ef710a236a3b972fa41638b9cf76be3f1b3505b82ae3c016416b162e3c9",
  "images/histology/thick-skin.jpg": "c96d7378357e1f98085334209ca981e21f0ada9276b88451e15f3bd30d74a43f",
  "images/histology/thick-skin-preview.jpg": "102fb37ac5d886c95818a144d9c51e84b914f9c99668d7124ff4c7715d1ed3a8",
  "images/histology/ATTRIBUTION.md": "2aad399e283ce748adc099af08ea7f778c50424f7c4af63e288a02c41819a4bf",
  "images/histology/renal-cortex.jpg": "1b75254a645d0e38bf9966449a41a6a19a786d348a0356662b40974480e557c3",
  "images/histology/renal-cortex-preview.jpg": "9ef54acc248737ff40609d574f9adc0fff0078ae9ff7366a74d8b8a283176613",
  "images/histology/liver-section.jpg": "9ce4a9d2cfc02cc6b8b38907b07a1bf8850beaacb2d1b6983640113ad6713f9b",
  "images/histology/liver-section-preview.jpg": "cf38e1f8bc32ba98c4dac54f3a591f697507bf7ccaced136c0b8822ebb45381f",
  "images/histology/pancreas-islet-confocal.jpg": "f870b049e8d265c8091e4ba683379b70708381dbbad79eb35b51d52c9e7229cd",
  "images/histology/pancreas-islet-confocal-preview.jpg": "659591ddfc6f590aee7ff9b44c9546eab455ba46667e15157a657e5a36a57e9c",
  "images/histology/ovarian-follicle-real.jpg": "42aaf0fdc106aea4b31f87ded61ebb75f1ecc40ea1776a829b4f54c7589dde38",
  "images/histology/ovarian-follicle-real-preview.jpg": "5eb1079c75e6977cccf3657e561b3e063a4adb5e32b7aad9599ecfeff2848b5f",
  "images/histology/testis-boar.jpg": "d7d9c35f8233579cbad9d30f12eeeec84f5d1b39fb04ccf1a222cf83a8572dda",
  "images/histology/testis-boar-preview.jpg": "16d81cbb8c95b6ed338c10137c02223d6041d31dab7e0240d92ae39c4eefa372",
  "images/histology/hyaline-cartilage.jpg": "8ec400a664557a9f233ce7b3f7a491c7d482b9bbd820086ffba82004a6cd05ef",
  "images/histology/hyaline-cartilage-preview.jpg": "9cccbd3494ca7cfa15b9ff65c321030a4652afaf2bcbf2b4145d20b690599b02",
  "images/histology/thyroid-section.jpg": "8aabf86d2a10fb5a1562c45cf8183ba804c52496c90b7ee6546be26199ab9d3f",
  "images/histology/thyroid-section-preview.jpg": "6fd3d04fafff491243b6b5c02abbd66ae015f6bfb05b6e5c5cf5ef259fc5d101",
  "images/histology/lung-section.jpg": "7c5d1a89457806948927950c9c9065067071d800685d8436f8e018b306e1545f",
  "images/histology/lung-section-preview.jpg": "3588ee320dfba9ffa930e6bafb428030ab9781e6f97f2e716f63fbf114a60349",
  "images/histology/dense-connective.jpg": "c99d93536616389c79998aca240b1e9f37d52ecbe487116efc613132103af487",
  "images/histology/dense-connective-preview.jpg": "bf580980c793f9a5e0eba981bd235596ceef3050291140f3c781868baf4b96b3",
  "images/histology/peripheral-nerve.jpg": "8802d6cf40cb4aa0b478dd8053e56489f4a2be75cf73d4d8947f62e09e3e556b",
  "images/histology/peripheral-nerve-preview.jpg": "1da51d445253b28eec40bc0c9907ab0af986cacb0c50420e8935284efbfcbced",
  "models/skeletal.glb": "c2b70b31ddec4062cbc5ba969fc24ecfed61d00397a0bca795e2701d997200f8",
  "models/visceral.glb": "b21a0f34b3da1bb0b6a9a6ae71d16ffbc036beb504944af2422d4b91a9317fe5",
  "models/cardiovascular.glb": "bc94c7b8eb1712f18ee461e064140e54aa817f3614e0f56a45b00e2a829cfb59",
  "models/nervous.glb": "c7cde35497f887b319c0a84f1b5b605fa3ce66e23084b5e09d6e3825fa5030d9",
  "models/lymphatic.glb": "718cac2b26ad752224cc8a11b2d5bf733fb523b75d9614822a24af7d19202756",
  "models/muscular.glb": "f69ed1287f802a2d603d23293e01512bb57ae77ee7cca1d5527ba00496e51de2",
  "models/joints.glb": "9fdab1a257652597cf8f0b2ac93d12abc817e8f9a9099b9628e764018490afa2",
  "models/female-reproductive.glb": "67b5c7d1a07aface8a0c4611736ebb4d9bc14eb5b68fb5cfdbc504ce93ed7982",
  "models/female-skin.glb": "a11e57628bb411398789b68f8fc8354d0b9269d2c6b7ac0231e3e6a280260a1a",
  "models/female-skeletal.glb": "b74541d157b04e944a6cd477026c7182ed670e61cd81a4abb04abf58cd4ce369",
  "models/female-joints.glb": "f6e1010b382dcc31a4c738ea9623559caa80ca45f111d3361e5297a9a3b4dca3",
  "models/female-muscular.glb": "2d952dce743b95bf42d2f5fe7b2f2ceee3c03acbd26559edb345ff509cb201dc",
  "models/female-visceral.glb": "8d54bc5f98ef0a2ef851afdfe2e082e037df6b2ab314dd6be6f94cc3cb3350b7",
  "models/female-cardiovascular.glb": "591082fa876ff71c3e864e58be525de94df9cf8238ce0c3f59cb5ffe0dcad2ef",
  "models/female-nervous.glb": "391b2039500aa72a1a80cb77d8fa8442e5ae684a373456bb7f7d60472f66b741",
  "models/female-lymphatic.glb": "d405b73af2c1c09b853b0e05da176da38dafbbc8360440b13ea59d50dd345e3f",
  "models/female-reproductive-extra.glb": "e4e99bafcf8215f89aa6d279db624c444137a682716b463dc00761d9fad023b8",
  "models/heart-dundee.glb": "69bd08b81c4577a38ddbe175ccc0c4e933de5bea41ae532e7cf93fecfa35da67",
  "models/reference/bladder.glb": "5be534d0b2cc570d967520403e53ea4c7edc09a9cd48d12d942511225ccda6c4",
  "models/reference/brain.glb": "6dec0c532bdd3c8805af771c973e9e06ed227639e1608770a22510e5aab809d5",
  "models/reference/eye.glb": "b076e0f0410196302c39c9eed6e41b1f3be447d9e123f43b7335449f6a66d72e",
  "models/reference/heart.glb": "f967f4b17717c82dd0839825c024877e7b548d085e93be168906b44e90b897b1",
  "models/reference/kidney.glb": "869dfe500e944d499a5697a164249c28fb82714d43d2c9bf4951ba72fc22084f",
  "models/reference/large-intestine.glb": "1ca15a4c748b79cb10b630d6b7e9e75401acffa3af67ac12d7ea4b001151cc39",
  "models/reference/larynx.glb": "1e31a80b79d60ca5e9e60c1fdc301c2b44d81ee08a274b530a850653896c5d9a",
  "models/reference/liver.glb": "af42ba3d615e0c5646064647a56ce5b6bf9c9eb7bd8986f0ec4edee75d7a95a9",
  "models/reference/lungs.glb": "d2c97bc4e32c97a77ca1aee87d47f5f08644654b8871eee4f1372ec47e27d143",
  "models/reference/lymph-node.glb": "2cb2b203e507d400cf9366ccebccbc18c5dbd80aad870860b673b13bee1d1c78",
  "models/reference/mammary-gland.glb": "6b0da92f35e2fc54739070ab89f5af14f4b8183a5450217c9fbbe25f56456d60",
  "models/reference/mouth.glb": "970d1ae404ab21dfd0e0e0e68059671a1a25cb5aa7170d47556b7815574cef4f",
  "models/reference/ovary.glb": "4c9257ef57616329f331b9ad6e84651007f15ef639f3807fa59db50afb8fcb6a",
  "models/reference/pancreas.glb": "758d361f3fde85ec01e08b1ceee466c13cd03e62c460f310cfb6bb432d685f60",
  "models/reference/placenta.glb": "43597c009295880a82da4bfe724b5782ce31442dc57e76d92d7c0d53b2f300be",
  "models/reference/prostate.glb": "31d9be067a243d02240354dfced33d60c466ab4f8c634767673acc09d74ba489",
  "models/reference/skin.glb": "2bf01872147844ed1c0a71b3ce78e53c2ac14f1c1a65b80560e4b0ab14bd90bc",
  "models/reference/small-intestine.glb": "b09af27d2774a0ed3b4cd72759f78063e767ff6cec5b74403919434b55281dbd",
  "models/reference/spinal-cord.glb": "7b6b1fad27272b460902ab6bb9a68074798a913292af9a8ab8e260c2447d336f",
  "models/reference/spleen.glb": "57fd1482e59ac0bb68033ea463f777ee81a07c028588b613b9a8a6b4d447dcdd",
  "models/reference/synovial-joint.glb": "8c6dde0c7b9ea90318937c642d6a0db827c969235e386fdaf58c933e36439544",
  "models/reference/thymus.glb": "a5bc25cc831bf90abd32e95370f4e6c5097dc1d73edf00608786f82ab031721e",
  "models/reference/tonsil.glb": "d01450c67332829111201b9e4e5cf587ccf883468b49c0a84b15bef7bc9abea6",
  "models/reference/trachea.glb": "21f0de98e83a84b85d506d8786e7f7d0da87edd352c724c92b52035800426608",
  "models/reference/ureter.glb": "8f1a9c156cc59e55928f02f5796313614470b85af1675c9f219b6275e934f058",
  "models/reference/uterine-tube.glb": "27b86958fa45527ac207a215919bb3cb445501b401882a7f6e2e89dae81bfbd1",
  "models/reference/uterus.glb": "db163f39a201d7a5d2ff2a422a52afa635d1daf546e9219df098b49a547e759c",
  "models/systematics/carp-touch.glb": "f6ae8dc5e22930d2c220fed2da3796c39abec5294c37eb608174ae3a73485e02",
  "models/systematics/carp.glb": "9c5b6af30403050715bbb9efe1d413f30d3771d1c9ce856993839ebc1b2ce93f",
  "models/systematics/falcon-touch.glb": "8271e832b05d2228156f3c3036c24cbacd10c30ca103904be81379f2e7f6ceb7",
  "models/systematics/falcon.glb": "58e7e5267e76bbb0908daa0941d5f5b34a635a9be225e40b365c3afe2f380b02",
  "models/systematics/fern-touch.glb": "7a29b34bf7de6c950f6f193aef0943e043f1769bf520846aa2c6878da214196a",
  "models/systematics/fern.glb": "115b62ce9926dd66f1d6e608c9b051b1f30d5e748a458a13ec9a625ebcc22fec",
  "models/systematics/frog-touch.glb": "3f11f5acc444fba51624823b65f0c8fa2f0b1b877add1ede2324b01066514b46",
  "models/systematics/frog.glb": "33d3f9b248c06b70824f396a6109a17078dba9e8b74cea3686f992eec05b01cb",
  "models/systematics/lily-touch.glb": "f0a59474750ee948e6bc2180ffd0a88e81de226db71cc51e5daf4646b67ac2e8",
  "models/systematics/lily.glb": "04d7af720194d2853504483c2ac2b6886e689d737ef2c15e6481dda3ef148f85",
  "models/systematics/lizard-touch.glb": "54c0afea9e3b4bfa079daae43eaa29330a3752f012d5a76dbafa6c56c7bf31da",
  "models/systematics/lizard.glb": "e0fe34aa9668a97683b053647c6334f0796af921fd75aefdfaa451963caf50a8",
  "models/systematics/locust-touch.glb": "1d4b5257872ea2e4545a685d78f43d5f90b317c2a6ce7b6bfa9357f927e80cf5",
  "models/systematics/locust.glb": "8327ea70c643c3ded8a40f9ae0817aa621320e92934aec40df7ffe4e4ecaaef5",
  "models/systematics/moss-touch.glb": "b25bfcb95277ba9b36abc9105f73d802f3041649e7057784c501df082169e5b9",
  "models/systematics/moss.glb": "38c0eed0d85eb2075664afd1c18b7ca243630c5e09ec896211e4bb66f65ed820",
  "models/systematics/mushroom-touch.glb": "65b705527731b5ec963af01525057a10199a701ef13a67accd91c9b2472aa164",
  "models/systematics/mushroom.glb": "447d8b015a981857f0f172b15e0a3aeb13adaaa17d38ffb0e3d8af19fd059ec0",
  "models/systematics/pine-touch.glb": "2274a142e7c95ba8cf59f2333c61a029d6d340e89821a4de2b2a08b55fafee2a",
  "models/systematics/pine.glb": "7f5a7e4720e7af2afa7f06a90d34c2fa247fc836b6409264cc1fbd74bb600433",
  "models/systematics/seastar-touch.glb": "d490a80262f6dbe2545f5c55dfa35c65ce561f69275b0b26037f93efe2140edd",
  "models/systematics/seastar.glb": "d1c899900c2220f7031ea8779f0270838af85a54a4b7bbf8899574e70d1282fc",
  "models/systematics/snail-touch.glb": "f65a63f672df3225c1e2a118b62978bb9ca080e47adae87317d0e68027ab34f2",
  "models/systematics/snail.glb": "ac7680a6c3602cd0bd306ac2444fd1746c27b4c989f4d537c06bccf21e556c72",
  "models/systematics/sponge-touch.glb": "1643e2fbcf067c8c0da9843ab5ae8c63cbf366138d52c8cb7836fd71f831babc",
  "models/systematics/sponge.glb": "94a3b448d7c7063d595b2a2a94135006d5fed5973ff065765d92a02ecb007723",
  "images/microscopy/ATTRIBUTION.md": "562601564ac56176d4385d8e5b19c12be9e15fd7a503bb15941689c85a7f96af",
  "images/microscopy/chloroplast-lettuce-stem-preview.jpg": "3002224b3a921a8b6fda97caa9650f3e9b08ea89c211ccd4b8ceaeb7879c6778",
  "images/microscopy/chloroplast-lettuce-stem.jpg": "e481c7ba63da621c003831ee3c4bcabf320d641ec9f9ea58c8ec0ab2a91c7abf",
  "images/microscopy/leaf-semithin-reischig-preview.jpg": "045a947460b12c751734ce37e54f98cdd333aea78b4f5fcbf14fcdc4949bd580",
  "images/microscopy/leaf-semithin-reischig.jpg": "1c356722198f3a97660b3971702c275af07e0b1d2fcfcf498eba549069342a39",
  "images/microscopy/mitochondria-lung-tem.jpg": "fe0c63d8fb2a2454ae894cafb93e393923d16554423035f59d32c71a52882d5e",
  "images/microscopy/mitosis-vicia-faba-preview.jpg": "a98900143e6960b7558efc0608d95ce13a8ae2599e6dbfba31eb11a474e54ac6",
  "images/microscopy/mitosis-vicia-faba.jpg": "d4f17c640322cacbf52102d523a17f7772190f14194e5ab5e1c3c06d157cac7a",
  "images/microscopy/root-ranunculus-houseman-preview.jpg": "a1c4ccbb063d5fed06abb71ad36c589a58111f4d9c132a8dad14e93e3f9b5cd5",
  "images/microscopy/root-ranunculus-houseman.jpg": "20406d4af114efb5be84d2a924d97c83bbc5d2823a7a2322fe7d22320808fe80",
  "images/microscopy/stoma-aloe-vera-preview.jpg": "434e7500f6f85268c1881d73be157eaca66d194d5abd61748f4dd6e461e772e6",
  "images/microscopy/stoma-aloe-vera.jpg": "c8549314674ad5bfdedffe9fc0950149240354b482a5266793a9d5974872b921",
  "assets/interiors/pulmonary-detailed-v17.bin": "dba48e0bc3a62fe342d3349486a183625cff1ab19a2c0f59d7af7b1e73dadcc6",
  "assets/interiors/pulmonary-touch-v17.bin": "7f255f24f080304cdb68e6b7ebcd2012653edbba611b9c9ad1cf2bd8ef5912e4",
  "assets/interiors/renal-desktop.bin": "6f88a8396cd3bbaa9810fd51553b1a3263999ee7e6e5ad5ffa4fce7e513e8995",
  "assets/interiors/renal-touch.bin": "4c0a93fe17c087c3f3c89a1facf89251ee9e35e5be6e1d41e78f6a0f69973e7d",
  "images/microscopy/gastric-wall-human.jpg": "152fec95bd5a46f8fc75e70273fe24baccd5cc21da70c24b11aee7536f925014",
  "images/microscopy/gastric-wall-human-preview.jpg": "3a6a921c9e8b4a64e6bbede59e848e5f4b01ad7545ec3ee66177fff7cfd67175",
  "images/microscopy/esophageal-epithelium-human.jpg": "eeff44b0ef6c9a7776366bab9e81be32574ca066e1eecbbba29ca842fe1aa3ee",
  "images/microscopy/colon-crypts-human.jpg": "96efa406ba0e1b3276c3c917c11ad4a726ea740cc8d9842a8327a5d7160f70c3",
  "images/microscopy/colon-crypts-human-preview.jpg": "f4d01d691426e9530e1cbbcc854f3b08e9f8cb19272d69912a89d68821ecbcdc",
  "images/microscopy/ATTRIBUTION-DIGESTIVA-V18.md": "2500aff4aa9eb10765cbca72e9f0567cf59d6dd315f6fd92ada96aae42e3b490",
  "assets/interiors/stomach-desktop-v18.bin": "aad4eccbd042a878e272481d2076f67e992d7d80f46a7ec61b355f41fbdf0123",
  "assets/interiors/stomach-touch-v18.bin": "a020b25cd9e081b85afc764c24e7bdd9de23472cce260a94d2d976a670745a1e",
  "assets/interiors/small-intestine-desktop-v18.bin": "37fefe6e18023e1ea2afbfc834d7e8adea49d3e0e64b3477159807f1ef8dd58f",
  "assets/interiors/small-intestine-touch-v18.bin": "e878d022a189ea534dc245fa33d0d4974d281054abdab654b9448c0515199888",
  "assets/interiors/esophagus-desktop-v19.bin": "bbca23e4cfbb4615071fba60d52a2df419f378045feab3b168b0a09910a4d859",
  "assets/interiors/esophagus-touch-v19.bin": "9724a430317e51840782062903c7e62d9ca3b25a6a062966210bf0254778c974",
  "assets/interiors/large-intestine-desktop-v19.bin": "68d06ade78a21a7dcf21051fe66d1b3801ff45accb2308afdf185a54546f33dc",
  "assets/interiors/large-intestine-touch-v19.bin": "a1d8d750554e736c23b3a0db5f8f95ba5160fb60e9f6b3d0a98b891d654eb42c",
  "assets/histology/gastric-histology-desktop-v20.bin": "c2bcea43cf66c314de941888555d96402c415082188c67ebf73987d5ecf795ac",
  "assets/histology/gastric-histology-touch-v20.bin": "70a022bb89f5404e66adcdbb77730d23e4c62ac580fe2050ad3f9f39681bb474",
  "assets/histology/colon-histology-desktop-v20.bin": "a067c99818e41a7e087d6fe412c3572e28fdc635340b26eae7254d3d4fbf3692",
  "assets/histology/colon-histology-touch-v20.bin": "731ac190627bdffc38dc60e6665e1a4baf058d609cfc6e30dbe1255d2913e0bd",
  "assets/interiors/heart-desktop-a1.bin": "d7ffbf367e599c107758b925d28f85766b8fb0047bb7ef6e586724a8d9e09eb5",
  "assets/interiors/heart-touch-a1.bin": "2f489cc7c1c4dc765897981104cb92a97cc450ed3512a73bd0cb81c7ca476780",
  "assets/interiors/ovary-desktop-a1.bin": "5747b19bef946b5295728be9aadf56e78a063007953ed889d4c0d6b08fc54414",
  "assets/interiors/ovary-touch-a1.bin": "a4eda7a716b84440ece9fcb3b4a579ba3bcf32f4d5c9c2fceef67c8387f37482",
  "assets/interiors/testis-desktop-a1.bin": "3048d30e67a5549277f118c33e4e3514b58d4a7a633b5f649d0cad78fc87c765",
  "assets/interiors/testis-touch-a1.bin": "9901241066918d84f6442d92677bb737b58ef6cca34f94a3af160f529d076eb6",
  "assets/interiors/vagina-desktop-a1.bin": "466dac317949322fa601adaaef8b795a3ce88698518d28b01d7b3efd47e34214",
  "assets/interiors/vagina-touch-a1.bin": "21bc44e3e9a0cc5837ac52e98a90051cc904682d73fc12d96eee2ded1f6b63da"
};
const ALL_ASSETS = [...APP_ASSETS, ...MODEL_ASSETS];
const BOOTSTRAP_ASSETS = APP_ASSETS.filter(asset => !CONTENT_SHA256[asset]);
// Touch devices open the light versions (-touch, 2048/2k maps, *-touch.glb scans) and computers the full ones; the
// offline download keeps only the device's own (~126 MB less on the iPad). Must match the `mobile` choices in the modules.
function profileOf(asset) {
  if (/-desktop|-detailed-|-4096\.|-4k\./.test(asset) || (/^models\/systematics\/[^/]+\.glb$/.test(asset) && !asset.endsWith('-touch.glb'))) return 'desktop';
  if (/-touch|-2048\.|-2k\./.test(asset)) return 'touch';
  return null;
}
const PROFILES = ['touch', 'desktop'];
const profileName = value => PROFILES.includes(value) ? value : 'all';
const profileAssets = profile => profile === 'all' ? ALL_ASSETS : ALL_ASSETS.filter(asset => { const own = profileOf(asset); return !own || own === profile; });
// App files go to the network first, but a weak Wi-Fi must not hold the app: past this wait the saved copy is used
// (the network answer still refreshes the cache for the next time).
const NETWORK_TIMEOUT_MS = 4000;
const allowedAssets = new Set(ALL_ASSETS);
const modelAssets = new Set(MODEL_ASSETS);
let cacheAllPromise = null;
let cacheController = null;
let generation = 0;
const verifiedCacheEntries = new Set();
const verifiedResponses = new WeakMap();

function assetURL(asset) { return new URL(asset, scopeURL).href; }
function identifyAsset(request) {
  if (request.method !== 'GET' || request.headers.has('authorization') || request.headers.has('range')) return null;
  const url = new URL(request.url);
  if (url.origin !== scopeURL.origin || url.search || !url.pathname.startsWith(scopeURL.pathname)) return null;
  const relative = url.pathname.slice(scopeURL.pathname.length);
  if (relative === '') return 'index.html';
  return allowedAssets.has(relative) ? relative : null;
}
function isAppClient(source) {
  if (!source?.url) return false;
  try {
    const url = new URL(source.url);
    return url.origin === scopeURL.origin && !url.search &&
      (url.pathname === scopeURL.pathname || url.pathname === scopeURL.pathname + 'index.html');
  } catch { return false; }
}
function cacheName(asset) {
  return modelAssets.has(asset) ? MODEL_CACHE : CONTENT_SHA256[asset] ? CONTENT_CACHE : APP_CACHE;
}
function cacheKey(asset) {
  // Internal keys contain only a public content digest and static relative path.
  // Requests for these keys are never intercepted or fetched from the network.
  return CONTENT_SHA256[asset] && !modelAssets.has(asset)
    ? new URL('.atlas-content/' + CONTENT_SHA256[asset] + '/' + asset, scopeURL).href
    : assetURL(asset);
}
async function hasExpectedContent(asset, response) {
  const expected = CONTENT_SHA256[asset];
  if (!expected) return true;
  if (verifiedResponses.get(response) === expected) return true;
  const bytes = await response.clone().arrayBuffer();
  if (bytes.byteLength > MAX_ASSET_BYTES) return false;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (actual !== expected) return false;
  verifiedResponses.set(response, expected);
  return true;
}
async function readVerified(asset, name, key) {
  const cache = await caches.open(name);
  const response = await cache.match(key);
  if (!response) return null;
  const identity = name + '\n' + key;
  if (!CONTENT_SHA256[asset] || verifiedCacheEntries.has(identity)) return response;
  if (!await validateResponse(asset, response) || !await hasExpectedContent(asset, response)) return null;
  verifiedCacheEntries.add(identity);
  return response;
}
async function legacyCacheNames() {
  return (await caches.keys()).filter(name => name.startsWith(CACHE_PREFIX) &&
    name !== APP_CACHE && name !== MODEL_CACHE && name !== CONTENT_CACHE);
}
async function cachedAsset(asset, { allowLegacy = true, promote = false, epoch = generation } = {}) {
  const direct = await readVerified(asset, cacheName(asset), cacheKey(asset));
  if (direct) return direct;
  if (!allowLegacy || !CONTENT_SHA256[asset] || modelAssets.has(asset)) return null;
  for (const name of await legacyCacheNames()) {
    const response = await readVerified(asset, name, assetURL(asset));
    if (!response) continue;
    if (promote && epoch === generation) {
      // A quota failure must leave the working old download usable. Returning
      // its verified bytes avoids a second download and requires no duplicate.
      try { await store(asset, response, epoch); } catch { /* Keep legacy cache. */ }
    }
    return response;
  }
  return null;
}
async function retireMigratedCaches() {
  // Never erase a complete previous version while the new shell or any heavy
  // content is missing. Count only primary caches here, not borrowed entries.
  if (!(await snapshot(false)).readyProfiles.length) return;
  for (const name of await legacyCacheNames()) await caches.delete(name);
}


async function validateResponse(asset, response) {
  if (!response.ok || response.status !== 200 || response.type === 'opaque' || response.redirected) return false;
  const resolved = new URL(response.url || assetURL(asset));
  if (resolved.href !== assetURL(asset)) return false;
  const mime = (response.headers.get('content-type') || '').toLowerCase();
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_ASSET_BYTES) return false;
  if (mime.includes('text/html')) {
    if (asset !== 'index.html') return false;
    const html = await response.clone().text();
    // A 200 login page under the same route must not replace the offline app.
    return /id=["']anatomy-canvas["']/.test(html) && /data-view=["']physiology["']/.test(html);
  }
  if (asset === 'index.html') return false;
  if (asset.endsWith('.js')) return /javascript|ecmascript/.test(mime);
  if (asset.endsWith('.webmanifest')) {
    if (!/json|manifest|octet-stream/.test(mime)) return false;
    try { return (await response.clone().json()).short_name === 'Atlas Humano'; }
    catch { return false; }
  }
  if (asset.endsWith('.json')) return /json/.test(mime);
  if (asset.endsWith('.css')) return mime.includes('text/css');
  if (asset.endsWith('.md')) return /text\/(plain|markdown)|octet-stream/.test(mime);
  if (asset.endsWith('.png')) return mime.includes('image/png');
  if (/\.jpe?g$/.test(asset)) return mime.includes('image/jpeg');
  if (asset.endsWith('.svg')) return mime.includes('image/svg+xml');
  if (asset.endsWith('.glb') || asset.endsWith('.wasm')) return /octet-stream|gltf|wasm/.test(mime);
  return /text\/plain|octet-stream/.test(mime);
}
async function store(asset, response, epoch = generation) {
  if (epoch !== generation || !await validateResponse(asset, response) || !await hasExpectedContent(asset, response)) return false;
  if (epoch !== generation) return false;
  const cache = await caches.open(cacheName(asset));
  // Browsers filter Set-Cookie from fetch headers; strip auth-related headers
  // as well. The cached key contains no bearer, cookie or query credentials.
  const headers = new Headers(response.headers);
  ['set-cookie', 'www-authenticate', 'authorization', 'proxy-authenticate'].forEach(key => headers.delete(key));
  const safeResponse = new Response(response.clone().body, { status: 200, statusText: 'OK', headers });
  await cache.put(cacheKey(asset), safeResponse);
  if (epoch !== generation) return false;
  if (CONTENT_SHA256[asset]) verifiedCacheEntries.add(cacheName(asset) + '\n' + cacheKey(asset));
  return true;
}
async function download(asset, signal, epoch = generation) {
  const response = await fetch(assetURL(asset), { credentials: 'same-origin', cache: 'reload', redirect: 'follow', signal });
  if (!await store(asset, response, epoch)) throw new Error('Resposta estática inválida: ' + asset);
}

async function snapshot(allowLegacy = true, profile = 'all') {
  // Progress emits once per asset. Enumerate cache keys instead of reopening
  // all static response streams on every progress tick; hash each heavy entry
  // only on its first use in this worker's lifetime.
  const names = [APP_CACHE, MODEL_CACHE, CONTENT_CACHE];
  const legacy = allowLegacy ? await legacyCacheNames() : [];
  const inventories = new Map();
  for (const name of [...names, ...legacy]) {
    const cache = await caches.open(name);
    inventories.set(name, new Set((await cache.keys()).map(request => request.url)));
  }
  const availableIn = async (asset, name, key) => {
    if (!inventories.get(name)?.has(key)) return false;
    return !CONTENT_SHA256[asset] || verifiedCacheEntries.has(name + '\n' + key) ||
      !!await readVerified(asset, name, key);
  };
  const cachedAssets = [];
  for (const asset of ALL_ASSETS) {
    let available = await availableIn(asset, cacheName(asset), cacheKey(asset));
    if (!available && CONTENT_SHA256[asset] && !modelAssets.has(asset)) {
      for (const name of legacy) {
        if (await availableIn(asset, name, assetURL(asset))) { available = true; break; }
      }
    }
    if (available) cachedAssets.push(asset);
  }
  const available = new Set(cachedAssets);
  const ready = name => profileAssets(name).every(asset => available.has(asset));
  const wanted = profileAssets(profile), models = wanted.filter(asset => modelAssets.has(asset));
  const shellReady = wanted.filter(asset => !modelAssets.has(asset)).every(asset => available.has(asset));
  return { profile, cached: wanted.filter(asset => available.has(asset)).length, total: wanted.length,
    modelsCached: models.filter(asset => available.has(asset)).length,
    modelsTotal: models.length, shellReady,
    offlineReady: ready(profile), readyProfiles: PROFILES.filter(ready),
    // A complete cache is observable; a working Safari install/auth gate needs
    // a real device offline check. Do not label this property "offlineTested".
    offlineTested: false };
}
async function status(phase, extras = {}, target = null, profile = 'all') {
  const message = { type: 'ATLAS_CACHE_STATUS', phase, ...await snapshot(true, profile), ...extras };
  if (target?.postMessage) { target.postMessage(message); return; }
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) if (isAppClient(client)) client.postMessage(message);
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // Start with the shell/data. Texture maps, microscopy and GLBs are cached
    // on use or by CACHE_ALL, without delaying initial activation.
    // Each file gets three tries, so one dropped request on a weak Wi-Fi does not cancel the whole update.
    for (const asset of BOOTSTRAP_ASSETS) {
      for (let attempt = 1; ; attempt++) {
        try { await download(asset); break; }
        catch (error) { if (attempt >= 3) throw error; await new Promise(resolve => setTimeout(resolve, 600 * attempt)); }
      }
    }
    // Reuse only byte-identical maps, microscopy and models. Heavy migration is
    // optional for installation: offline/invalid/missing assets keep the old
    // cache intact, and quota failures remain readable there.
    for (const asset of ALL_ASSETS) {
      if (CONTENT_SHA256[asset]) await cachedAsset(asset, { promote: true });
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await retireMigratedCaches();
    await self.clients.claim();
    await status('ready');
  })());
});

self.addEventListener('fetch', event => {
  const asset = identifyAsset(event.request);
  if (!asset) return; // Authentication, tokens, unknown resources stay network-only.
  const epoch = generation;
  event.respondWith((async () => {
    const cached = await cachedAsset(asset);
    if (modelAssets.has(asset) && cached) return cached;
    let storing = Promise.resolve();
    const network = fetch(event.request).then(async response => {
      if (await validateResponse(asset, response)) storing = store(asset, response, epoch).catch(() => false);
      // Preserve online auth decisions (401/403/redirect) rather than serving
      // a cached protected document after an explicit login/logout response.
      return response;
    });
    event.waitUntil(network.then(() => storing, () => {}));
    if (!cached) return network;
    let timer;
    const late = new Promise(resolve => { timer = setTimeout(resolve, NETWORK_TIMEOUT_MS, null); });
    const answer = await Promise.race([network.catch(() => null), late]);
    clearTimeout(timer);
    return answer || cached;
  })());
});

async function cacheAll(profile = 'all') {
  if (cacheAllPromise) return cacheAllPromise;
  const epoch = generation;
  cacheController = new AbortController();
  cacheAllPromise = (async () => {
    const errors = [];
    await status('start', { errors }, null, profile);
    for (const asset of profileAssets(profile)) {
      if (epoch !== generation) return;
      if (!await cachedAsset(asset, { promote: true, epoch })) {
        try { await download(asset, cacheController.signal, epoch); }
        catch (error) {
          if (epoch !== generation) return;
          errors.push(asset); // Fixed public path only; never serialize request/auth error text.
          if (error.name === 'QuotaExceededError') { await status('error', { errors, reason: 'storage-full' }, null, profile); return; }
        }
      }
      await status('progress', { asset, errors: [...errors] }, null, profile);
    }
    if (!errors.length) await retireMigratedCaches();
    await status(errors.length ? 'error' : 'complete', { errors }, null, profile);
  })().finally(() => { cacheController = null; cacheAllPromise = null; });
  return cacheAllPromise;
}
self.addEventListener('message', event => {
  if (!isAppClient(event.source) || !event.data || typeof event.data !== 'object') return;
  const profile = profileName(event.data.profile);
  if (event.data.type === 'CACHE_ALL') event.waitUntil(cacheAll(profile));
  if (event.data.type === 'CACHE_STATUS') event.waitUntil(status('status', {}, event.source, profile));
  if (event.data.type === 'CLEAR_CACHE') event.waitUntil((async () => {
    generation++;
    verifiedCacheEntries.clear();
    cacheController?.abort();
    if (cacheAllPromise) await cacheAllPromise.catch(() => {});
    for (const name of await caches.keys()) if (name.startsWith(CACHE_PREFIX)) await caches.delete(name);
    await status('cleared', { errors: [] }, event.source, profile);
  })());
});
