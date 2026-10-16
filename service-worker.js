/*
 * Only explicitly listed public static assets are stored. Never cache login
 * pages, requests carrying query tokens, API calls or cross-origin responses.
 * Offline on a protected host still needs deployment/device verification.
 * Increment APP_VERSION after changes to shell/data; increment MODEL_VERSION
 * when replacing GLBs. CACHE_ALL downloads sequentially, without decoding GLB.
 */
const APP_VERSION = '2026-10-16-motion-lod-v27';
const MODEL_VERSION = 'models-v1';
const scopeURL = new URL(self.registration.scope);
const scopeKey = encodeURIComponent(scopeURL.pathname);
const CACHE_PREFIX = 'atlas-humano-' + scopeKey + '-';
const APP_CACHE = CACHE_PREFIX + APP_VERSION;
const MODEL_CACHE = CACHE_PREFIX + MODEL_VERSION;
const CONTENT_CACHE = CACHE_PREFIX + 'content-sha256-v1';
const MAX_ASSET_BYTES = 32 * 1024 * 1024;

const APP_ASSETS = [
  "practice-session.js",
  "study-entry-routes.js",
  "study-session.js",
  "cytology-surfaces.js",
  "cytology-organelles.js",
  "cytology-processes.js",
  "cytology-materials.js",
  "botany-models.js",
  "data/botany-content.json",
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
  "ambient-occlusion.js",
  "draw-board.js",
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
  "models/draco/LICENSE.txt",
  "vendor/LICENSE",
  "heart-model.js",
  "reference-organ-models.js",
  "data/heart-annotations.json",
  "data/reference-organs.json",
  "data/reference-part-functions.json",
  "models/DUNDEE_ATTRIBUTION.txt",
  "models/REFERENCE_ATTRIBUTION.txt",
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
  "assets/histology/colon-histology-touch-v20.bin"
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
];
// Content identity is generated from the published source files. A stable path
// alone never proves that a cached texture or model belongs to this release.
const CONTENT_SHA256 = {
  "assets/cytology/cytology-albedo-4096.jpg": "2316444ac14ce708f221b178966f43049fe5405188d6db90e9d1cbbc4f9d3a5c",
  "assets/cytology/cytology-albedo-2048.jpg": "b9c77126dda2fddd352538e3ab3d98e78b864933c42ab0ff73ffc9230c567e9e",
  "assets/cytology/cytology-normal-4096.png": "9bd6ec30748cf4405a14cea3baaff5b22bb32587e267150a92055ba0741c2f6d",
  "assets/cytology/cytology-normal-2048.png": "fef4989e9305c49774d1f0a9d23545b10051ab5583152f26cdaa027c0fb20ad0",
  "assets/cytology/cytology-roughness-4096.png": "f99fb10d0410de42c643f476b55d521e7337de4a1eec635eb3d9dc0009cc6351",
  "assets/cytology/cytology-roughness-2048.png": "afed9b7ea6cbfaa8874f2fc3f75ae774e58f937d05c6ea69425a1e616a9c7bde",
  "assets/histology/histology-albedo-4k.png": "fa56d28ab8851ba7b755e5ac1736e24ec14a4894431b5ef458fbef4180bc37d7",
  "assets/histology/histology-normal-4k.png": "c4f61efd61a63bbd4cf409a2e0adb5f2f9f1d162650a37ef0846ad968e5d2e53",
  "assets/histology/histology-albedo-2k.png": "905affbfbbecc6cbec5927fdf0c505ccbd938888861c537f1b6cdba379ece570",
  "assets/histology/histology-normal-2k.png": "b2a85933f7d5f799a9dfd3b0cdc702adeeeaca8ad3e39aafc7d149baff1107a7",
  "images/histology/cardiac-muscle.jpg": "4fbf98487adc57355ea00b98368ad034c3636989cff0be1c3c70a4b5848a4b41",
  "images/histology/cardiac-muscle-preview.jpg": "49afa126f88c6630211f27b651407e8df7aad9900952269e945d9d869ecbe565",
  "images/histology/renal-medulla.jpg": "b0ed41d5f80a9768bf59759539885f57b15d70e778bb50d1a07670c5b974f116",
  "images/histology/renal-medulla-preview.jpg": "57a36724c49301b8180ae61bae33a980ef26ed616f1958ed66a458dca5dce974",
  "images/histology/intestinal-mucosa.jpg": "4bb765688d17fba439c46c9f893006e89981b061a2b2ab8401ca1ed7c02c27ab",
  "images/histology/intestinal-mucosa-preview.jpg": "ac3cc8cafe6b6d9fc1f9bf4eaad4502ef0b097eb84bd7f0ec67dfcbcc0af2b87",
  "images/histology/thick-skin.jpg": "aecef01be18f78b14e7a7493576c143658874fa9fe19adc982cd3fbf65965f74",
  "images/histology/thick-skin-preview.jpg": "ff6e8ae7704d824f5ce38edc0dea03fb65bff4e081f28ba416bf769f3968f977",
  "images/histology/ATTRIBUTION.md": "2aad399e283ce748adc099af08ea7f778c50424f7c4af63e288a02c41819a4bf",
  "images/histology/renal-cortex.jpg": "9f4edc564d51b8d043d2270700d6340137e02cca30fe6e4d6395db42e149598d",
  "images/histology/renal-cortex-preview.jpg": "9ba0d9246946307d917e273229071133435cd7023f295f6b090574e51aea164d",
  "images/histology/liver-section.jpg": "35144ad3d7ab0c4dbe5a0278844cf6b31102c708a622880bc42babf377eebef2",
  "images/histology/liver-section-preview.jpg": "1c895df61c6f889bb61e9bea1cf557d8d511b51f663a5c50f06b0c412e07f47b",
  "images/histology/pancreas-islet-confocal.jpg": "527ba78ca5ac009e6aaac7289eb72df3689af4e93caff58b14e6375892308fe7",
  "images/histology/pancreas-islet-confocal-preview.jpg": "527ba78ca5ac009e6aaac7289eb72df3689af4e93caff58b14e6375892308fe7",
  "images/histology/ovarian-follicle-real.jpg": "52c72dc398b999f865dfb50346f11c9951434bf1088b97173ed4889790fe73a4",
  "images/histology/ovarian-follicle-real-preview.jpg": "52c72dc398b999f865dfb50346f11c9951434bf1088b97173ed4889790fe73a4",
  "images/histology/testis-boar.jpg": "e5d32d4661567f46f9b8d76e157c6ff00a0ad89d8e168766c7a70e6d8bd24b0b",
  "images/histology/testis-boar-preview.jpg": "e5d32d4661567f46f9b8d76e157c6ff00a0ad89d8e168766c7a70e6d8bd24b0b",
  "images/histology/hyaline-cartilage.jpg": "115768f99bdea50a8e2ada5b8935bf2d8111b47691902a4a0af7ed895d432be1",
  "images/histology/hyaline-cartilage-preview.jpg": "c5bdc0647d4d9ec9ac9964acfffc5114fde76c4fbcf32d73aec31b086e6940a8",
  "images/histology/thyroid-section.jpg": "2502c2561a024d3e57dbe1531ea4f101329a04b48185ce1db5ff707dd33c9b86",
  "images/histology/thyroid-section-preview.jpg": "2502c2561a024d3e57dbe1531ea4f101329a04b48185ce1db5ff707dd33c9b86",
  "images/histology/lung-section.jpg": "71731bd1aa89a5ff8f9a801acee8f897c65e5f8b26bc9d882bb8645d926edcf2",
  "images/histology/lung-section-preview.jpg": "71731bd1aa89a5ff8f9a801acee8f897c65e5f8b26bc9d882bb8645d926edcf2",
  "images/histology/dense-connective.jpg": "c7134b5b3b725247bee5333ea889add3e82278040d72fb4e789407badee6d7fc",
  "images/histology/dense-connective-preview.jpg": "c7134b5b3b725247bee5333ea889add3e82278040d72fb4e789407badee6d7fc",
  "images/histology/peripheral-nerve.jpg": "6fb71ab792abbbfd7452066946b5da84545d60bc99d01c22604a11802c1a81ec",
  "images/histology/peripheral-nerve-preview.jpg": "6fb71ab792abbbfd7452066946b5da84545d60bc99d01c22604a11802c1a81ec",
  "models/skeletal.glb": "c2b70b31ddec4062cbc5ba969fc24ecfed61d00397a0bca795e2701d997200f8",
  "models/visceral.glb": "b21a0f34b3da1bb0b6a9a6ae71d16ffbc036beb504944af2422d4b91a9317fe5",
  "models/cardiovascular.glb": "bc94c7b8eb1712f18ee461e064140e54aa817f3614e0f56a45b00e2a829cfb59",
  "models/nervous.glb": "c7cde35497f887b319c0a84f1b5b605fa3ce66e23084b5e09d6e3825fa5030d9",
  "models/lymphatic.glb": "718cac2b26ad752224cc8a11b2d5bf733fb523b75d9614822a24af7d19202756",
  "models/muscular.glb": "f69ed1287f802a2d603d23293e01512bb57ae77ee7cca1d5527ba00496e51de2",
  "models/joints.glb": "9fdab1a257652597cf8f0b2ac93d12abc817e8f9a9099b9628e764018490afa2",
  "models/female-reproductive.glb": "67b5c7d1a07aface8a0c4611736ebb4d9bc14eb5b68fb5cfdbc504ce93ed7982",
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
  "images/microscopy/ATTRIBUTION.md": "562601564ac56176d4385d8e5b19c12be9e15fd7a503bb15941689c85a7f96af",
  "images/microscopy/chloroplast-lettuce-stem-preview.jpg": "5ab99b10b9805531edd6df74ca183dea81f365ec89b85cdf556fe46f4cac7c90",
  "images/microscopy/chloroplast-lettuce-stem.jpg": "f18b305f3d300bbefff7aa150317ef1fd9e35ecd521cdd730c236b0891cf97e3",
  "images/microscopy/leaf-semithin-reischig-preview.jpg": "d24b95acd1824903a1c83f9ee0c0e28e9dab798551610f16fe683334b4723ae5",
  "images/microscopy/leaf-semithin-reischig.jpg": "54ae4c47ae0d259560ac15112ca6ec07482fa011dd07bce9cab564625e3accaf",
  "images/microscopy/mitochondria-lung-tem.jpg": "e8656f87df4075e7093b57afda0bad18fef1bc71c825de918345d6db6a01ced7",
  "images/microscopy/mitosis-vicia-faba-preview.jpg": "18f1854b1e0678b09933933020091ae274433d56496355343dc1f3a11a1a8b7c",
  "images/microscopy/mitosis-vicia-faba.jpg": "1ae8593fb2bda1806c16efc3852de6a5038cb5a05921fec9c2801e45832072d1",
  "images/microscopy/root-ranunculus-houseman-preview.jpg": "5836b81bd0af310a84777fa664e1626f533e411c8a66bea266d3d7572aeb5286",
  "images/microscopy/root-ranunculus-houseman.jpg": "dbdffca300e44a3cffc122ef323ce9e18d84b5791253c17830a1bcb95396f985",
  "images/microscopy/stoma-aloe-vera-preview.jpg": "a9472af8523bdb10afa84fdbce6f930ff6b4f7a0bac346c98861f0950b0ef3ea",
  "images/microscopy/stoma-aloe-vera.jpg": "72bcfb1b536fc0c5d41e00eaa359a44c8ac8ef3882742fc3956d25f8c636d666",
  "assets/interiors/pulmonary-detailed-v17.bin": "dba48e0bc3a62fe342d3349486a183625cff1ab19a2c0f59d7af7b1e73dadcc6",
  "assets/interiors/pulmonary-touch-v17.bin": "7f255f24f080304cdb68e6b7ebcd2012653edbba611b9c9ad1cf2bd8ef5912e4",
  "assets/interiors/renal-desktop.bin": "6f88a8396cd3bbaa9810fd51553b1a3263999ee7e6e5ad5ffa4fce7e513e8995",
  "assets/interiors/renal-touch.bin": "4c0a93fe17c087c3f3c89a1facf89251ee9e35e5be6e1d41e78f6a0f69973e7d",
  "images/microscopy/gastric-wall-human.jpg": "92e035e1d875899d374e5dadd8f6f5d8fcd62e1f09bb443d368c9b165c3f56d5",
  "images/microscopy/gastric-wall-human-preview.jpg": "5e4e1a9da8c87572660844115eac38162da98b17347f1f8931eb23f01a08efe5",
  "images/microscopy/esophageal-epithelium-human.jpg": "1fff314c80f74f8ba83b3fe2e5d34a2326248dfb38291be2861663e900a9860a",
  "images/microscopy/colon-crypts-human.jpg": "2d7f66dc9317ce60f5f138f4af8f50d7ce331facf16f97a07e433b7779432c5a",
  "images/microscopy/colon-crypts-human-preview.jpg": "38e796ebde331e02ce68c915b076e2bfa07c97f2c38d5176efe488538341cf09",
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
  "assets/histology/colon-histology-touch-v20.bin": "731ac190627bdffc38dc60e6665e1a4baf058d609cfc6e30dbe1255d2913e0bd"
};
const ALL_ASSETS = [...APP_ASSETS, ...MODEL_ASSETS];
const BOOTSTRAP_ASSETS = APP_ASSETS.filter(asset => !CONTENT_SHA256[asset]);
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
  if (!(await snapshot(false)).offlineReady) return;
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

async function snapshot(allowLegacy = true) {
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
  const shellReady = APP_ASSETS.every(asset => available.has(asset));
  return { cached: cachedAssets.length, total: ALL_ASSETS.length,
    modelsCached: MODEL_ASSETS.filter(asset => available.has(asset)).length,
    modelsTotal: MODEL_ASSETS.length, shellReady,
    offlineReady: shellReady && MODEL_ASSETS.every(asset => available.has(asset)),
    // A complete cache is observable; a working Safari install/auth gate needs
    // a real device offline check. Do not label this property "offlineTested".
    offlineTested: false };
}
async function status(phase, extras = {}, target = null) {
  const message = { type: 'ATLAS_CACHE_STATUS', phase, ...await snapshot(), ...extras };
  if (target?.postMessage) { target.postMessage(message); return; }
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) if (isAppClient(client)) client.postMessage(message);
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // Start with the shell/data. Texture maps, microscopy and GLBs are cached
    // on use or by CACHE_ALL, without delaying initial activation.
    for (const asset of BOOTSTRAP_ASSETS) await download(asset);
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
    try {
      const response = await fetch(event.request);
      if (await validateResponse(asset, response)) {
        event.waitUntil(store(asset, response, epoch).catch(() => false));
      }
      // Preserve online auth decisions (401/403/redirect) rather than serving
      // a cached protected document after an explicit login/logout response.
      return response;
    } catch (error) {
      if (cached) return cached;
      throw error;
    }
  })());
});

async function cacheAll() {
  if (cacheAllPromise) return cacheAllPromise;
  const epoch = generation;
  cacheController = new AbortController();
  cacheAllPromise = (async () => {
    const errors = [];
    await status('start', { errors });
    for (const asset of ALL_ASSETS) {
      if (epoch !== generation) return;
      if (!await cachedAsset(asset, { promote: true, epoch })) {
        try { await download(asset, cacheController.signal, epoch); }
        catch (error) {
          if (epoch !== generation) return;
          errors.push(asset); // Fixed public path only; never serialize request/auth error text.
          if (error.name === 'QuotaExceededError') { await status('error', { errors, reason: 'storage-full' }); return; }
        }
      }
      await status('progress', { asset, errors: [...errors] });
    }
    if (!errors.length) await retireMigratedCaches();
    await status(errors.length ? 'error' : 'complete', { errors });
  })().finally(() => { cacheController = null; cacheAllPromise = null; });
  return cacheAllPromise;
}
self.addEventListener('message', event => {
  if (!isAppClient(event.source) || !event.data || typeof event.data !== 'object') return;
  if (event.data.type === 'CACHE_ALL') event.waitUntil(cacheAll());
  if (event.data.type === 'CACHE_STATUS') event.waitUntil(status('status', {}, event.source));
  if (event.data.type === 'CLEAR_CACHE') event.waitUntil((async () => {
    generation++;
    verifiedCacheEntries.clear();
    cacheController?.abort();
    if (cacheAllPromise) await cacheAllPromise.catch(() => {});
    for (const name of await caches.keys()) if (name.startsWith(CACHE_PREFIX)) await caches.delete(name);
    await status('cleared', { errors: [] }, event.source);
  })());
});
