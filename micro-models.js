import * as THREE from 'three';

// Educational models, drawn with Three.js primitives. They are not microscopy,
// scans, patient anatomy, or quantitatively accurate molecular/organ dimensions.
// Scientific references: OpenStax Anatomy and Physiology 2e, sections 5.1,
// 10.2–10.3, 12.2, 22.1, and 25.4. https://openstax.org/details/books/anatomy-and-physiology-2e

const C = { gold: 0xf3c862, red: 0xe76572, blue: 0x61a7db, pink: 0xef9cbb,
  orange: 0xed9b54, purple: 0x9d89db, green: 0x7bbfa8, cream: 0xeadbc0,
  white: 0xe7edf5, brown: 0x85604b, yellow: 0xf3df84 };
const v = (p) => new THREE.Vector3(...p);
const mat = (color, opacity = 1) => new THREE.MeshStandardMaterial({ color,
  roughness: 0.58, metalness: 0.04, transparent: opacity < 1, opacity,
  depthWrite: opacity >= 0.95, side: THREE.DoubleSide });
function sphere(p, radius, color, opacity = 1, scale = [1, 1, 1]) {
  const o = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), mat(color, opacity));
  o.position.copy(v(p)); o.scale.set(...scale); return o;
}
function box(p, size, color, opacity = 1) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(...size), mat(color, opacity));
  o.position.copy(v(p)); return o;
}
function tube(points, radius, color, opacity = 1, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(v), closed, 'centripetal');
  return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(96, points.length * 12), radius, 24, closed), mat(color, opacity));
}
function rod(a, b, radius, color) {
  const d = v(b).sub(v(a));
  const o = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, d.length(), 32), mat(color));
  o.position.copy(v(a).add(v(b)).multiplyScalar(0.5));
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return o;
}
function ring(p, radius, thickness, color, axis = 'z') {
  const o = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 24, 72), mat(color));
  o.position.copy(v(p)); if (axis === 'x') o.rotation.y = Math.PI / 2;
  if (axis === 'y') o.rotation.x = Math.PI / 2; return o;
}
function context(title, description) {
  const group = new THREE.Group(); group.name = title;
  group.userData = { schematic: true, educational: true, coordinateSystem: 'Y-up; +Z anterior; independent normalized scene', notRealHistology: true };
  const parts = [];
  function part(object, name, pt, coreId, fn, mechanism, uerj, commonMistake, parent = group) {
    object.name = name;
    const item = { object, name, pt, coreId, function: fn, mechanism, uerj, commonMistake };
    object.traverse((child) => { child.userData = { ...child.userData, microPart: name, schematic: true }; });
    parent.add(object); parts.push(item); return object;
  }
  return { group, title, description, parts, part };
}

function nephron() {
  const r = context('Néfron — esquema 3D', 'Modelo didático independente, sem escala histológica. Mostra o caminho do filtrado e a relação com capilares. O ducto coletor recebe vários néfrons e, em sentido anatômico estrito, não integra o néfron.');
  const corpuscle = r.part(new THREE.Group(), 'renal-corpuscle', 'Corpúsculo renal', 'nephron',
    'Iniciar a formação do filtrado glomerular.', 'O corpúsculo reúne glomérulo e cápsula glomerular; a pressão favorece a ultrafiltração do plasma.',
    'Relacionar filtração, pressão capilar e seletividade da barreira renal.', 'O filtrado inicial não é a urina definitiva; células sanguíneas e a maior parte das proteínas são retidas.');
  r.part(sphere([-0.37, 0.31, 0], 0.115, C.cream, 0.24), 'bowman-capsule', 'Cápsula glomerular (Bowman)', 'bowman-capsule',
    'Receber o filtrado no espaço capsular.', 'A camada visceral tem podócitos que participam da barreira de filtração; o espaço capsular continua no túbulo proximal.',
    'Identificar o destino do filtrado após atravessar a barreira.', 'A cápsula não filtra por bombeamento nem transforma todo o sangue em urina.', corpuscle);
  const glomerulus = new THREE.Group();
  for (let j = 0; j < 5; j++) {
    const pts = Array.from({ length: 32 }, (_, i) => {
      const a = i * Math.PI * 2 / 32;
      return [-0.37 + 0.066 * Math.cos(a), 0.31 + 0.055 * Math.sin(a), (j - 2) * 0.022 + 0.01 * Math.sin(3 * a)];
    }); glomerulus.add(tube(pts, 0.008, C.red, 1, true));
  }
  r.part(glomerulus, 'glomerulus', 'Glomérulo', 'glomerulus', 'Filtrar água e pequenos solutos do plasma.',
    'Capilares fenestrados, membrana basal e fendas entre podócitos compõem uma barreira seletiva; a força motriz envolve pressões hidrostática e oncótica.',
    'Explicar a presença de glicose no filtrado e a retenção de células e proteínas.', 'Filtração glomerular não é transporte ativo de cada substância.', corpuscle);
  r.part(tube([[-0.59, 0.35, 0], [-0.49, 0.36, 0], [-0.43, 0.33, 0]], 0.017, C.red), 'afferent-arteriole', 'Arteríola aferente', 'nephron',
    'Levar sangue ao glomérulo.', 'Sua resistência regula o fluxo e influencia a pressão nos capilares glomerulares.',
    'Comparar chegada e saída do sangue no corpúsculo.', 'A arteríola aferente contém sangue, não filtrado tubular.');
  r.part(tube([[-0.32, 0.35, -0.02], [-0.24, 0.39, -0.03], [-0.18, 0.36, -0.05]], 0.011, C.red), 'efferent-arteriole', 'Arteríola eferente', 'nephron',
    'Retirar sangue do glomérulo e alimentar a circulação pós-glomerular.', 'Origina capilares peritubulares ou vasos retos; seu calibre funcional afeta as pressões renais.',
    'Reconhecer dois leitos capilares separados por uma arteríola.', 'Eferente não significa veia; o desenho do calibre é apenas ilustrativo.');
  r.part(tube([[-0.34, 0.21, 0.02], [-0.26, 0.19, 0.02], [-0.20, 0.27, 0.02], [-0.13, 0.20, 0.02], [-0.04, 0.27, 0.02], [0.01, 0.19, 0.02], [-0.06, 0.14, 0.02]], 0.021, C.orange),
    'proximal-tubule', 'Túbulo contorcido proximal', 'proximal-tubule', 'Reabsorver grande parte da água, do sódio e de outros solutos; participar da secreção.',
    'Transporte de sódio sustenta reabsorção de glicose e aminoácidos; a água acompanha os solutos por osmose.',
    'Explicar reabsorção de glicose e glicosúria quando a capacidade de transporte é excedida.', 'A glicose do filtrado costuma ser reabsorvida; sua filtração não implica excreção normal.');
  r.part(tube([[-0.06, 0.14, 0.02], [-0.06, -0.22, 0.02], [-0.05, -0.35, 0.02], [0.04, -0.40, 0.02]], 0.017, C.blue),
    'henle-descending', 'Alça de Henle: ramo descendente', 'henle-loop', 'Favorecer a saída de água e a concentração do líquido tubular.',
    'A alta permeabilidade à água, diante do gradiente osmótico medular, permite sua saída por osmose.',
    'Relacionar contracorrente, osmose e gradiente medular.', 'Não atribuir ao ramo descendente a principal reabsorção ativa de NaCl do ramo ascendente espesso.');
  r.part(tube([[0.04, -0.40, 0.02], [0.14, -0.35, 0.02], [0.15, -0.20, 0.02], [0.15, 0.15, 0.02]], 0.017, C.orange),
    'henle-ascending', 'Alça de Henle: ramo ascendente', 'henle-loop', 'Reabsorver sais e ajudar a construir o gradiente osmótico medular.',
    'O ramo ascendente é pouco permeável à água; no segmento espesso, o transporte de Na+, K+ e Cl− contribui para o gradiente.',
    'Justificar por que água e sais se comportam de modo diferente nos dois ramos.', 'A água não acompanha livremente o NaCl no ramo ascendente.');
  r.part(tube([[0.15, 0.15, 0.02], [0.10, 0.25, 0.02], [0.18, 0.34, 0.02], [0.27, 0.25, 0.02], [0.35, 0.32, 0.02], [0.43, 0.22, 0.02]], 0.020, C.purple),
    'distal-tubule', 'Túbulo contorcido distal', 'distal-tubule', 'Ajustar a composição do líquido tubular.',
    'Participa do transporte de eletrólitos; segmentos distais e conectores têm respostas hormonais específicas, incluindo controle do cálcio e do sódio.',
    'Relacionar homeostase mineral, hormônios e transporte tubular.', 'Não supor que todos os segmentos distais tenham a mesma permeabilidade à água.');
  r.part(tube([[0.45, 0.43, 0.02], [0.45, 0.22, 0.02], [0.45, -0.47, 0.02]], 0.028, C.green), 'collecting-duct', 'Ducto coletor', 'collecting-duct',
    'Ajustar a excreção final de água, eletrólitos e ácido.', 'ADH aumenta a disponibilidade de aquaporinas e a reabsorção de água; aldosterona favorece reabsorção de Na+ e secreção de K+ em células principais.',
    'Prever os efeitos de ADH elevado sobre volume e concentração da urina.', 'ADH não cria água nem bombeia água ativamente; depende do gradiente osmótico.');
  const capillaries = new THREE.Group();
  capillaries.add(tube([[-0.18, 0.36, -0.06], [-0.13, 0.1, -0.07], [-0.13, -0.34, -0.07], [0.01, -0.46, -0.07], [0.22, -0.34, -0.07], [0.22, 0.12, -0.07]], 0.008, C.red));
  capillaries.add(tube([[0.22, 0.12, -0.07], [0.28, -0.34, -0.08], [0.02, -0.49, -0.08], [-0.18, -0.34, -0.08], [-0.18, 0.08, -0.08]], 0.008, C.blue));
  r.part(capillaries, 'renal-capillary-network', 'Circulação pós-glomerular (esquema)', 'capillaries', 'Receber substâncias reabsorvidas e preservar trocas na medula.',
    'Capilares peritubulares e vasos retos atendem regiões diferentes; vasos retos atuam como trocadores em contracorrente.',
    'Distinguir sangue, interstício e luz tubular ao explicar a reabsorção.', 'O desenho combina relações funcionais; não representa a geometria exata de todos os tipos de néfron.');
  return r;
}

function alveolar() {
  const r = context('Unidade alveolar — esquema 3D', 'Modelo didático de alvéolos e circulação pulmonar. Formas, espessuras e células estão ampliadas para leitura; não reproduz uma imagem histológica.');
  const branch = new THREE.Group();
  branch.add(tube([[0, 0.46, 0], [0, 0.30, 0], [0, 0.16, 0]], 0.040, C.cream));
  branch.add(tube([[0, 0.22, 0], [-0.13, 0.15, 0], [-0.21, 0.05, 0]], 0.029, C.cream));
  branch.add(tube([[0, 0.22, 0], [0.13, 0.15, 0], [0.21, 0.05, 0]], 0.029, C.cream));
  r.part(branch, 'alveolar-duct', 'Via aérea distal e ducto alveolar (esquema)', 'alveoli', 'Conduzir ar à região de trocas gasosas.',
    'A ventilação desloca o ar em conjunto; na barreira alveolocapilar os gases passam por difusão.',
    'Diferenciar ventilação pulmonar de hematose.', 'Movimento do ar pelas vias aéreas não é sinônimo de difusão através da parede alveolar.');
  const centers = [[-0.22, 0.0, 0], [0, -0.12, 0.02], [0.22, 0, 0], [-0.13, 0.10, -0.14], [0.13, 0.10, -0.14]];
  const sacs = new THREE.Group(); centers.forEach((p) => sacs.add(sphere(p, 0.145, C.pink, 0.46)));
  r.part(sacs, 'alveoli', 'Alvéolos: parede com pneumócitos tipo I', 'alveoli', 'Oferecer grande superfície para difusão de O2 e CO2.',
    'Pneumócitos tipo I são achatados; a barreira fina e as diferenças de pressão parcial favorecem a difusão entre ar e sangue.',
    'Relacionar área, espessura e gradiente de pressão parcial à eficiência da hematose.', 'O2 e CO2 não atravessam a barreira alveolar por transporte ativo.');
  const network = new THREE.Group();
  centers.forEach(([x, y, z], j) => {
    for (let k = 0; k < 3; k++) {
      const rr = 0.146, offset = (k - 1) * 0.06;
      const pts = Array.from({ length: 32 }, (_, i) => { const a = i * Math.PI * 2 / 32; return [x + rr * Math.cos(a), y + offset, z + rr * Math.sin(a)]; });
      network.add(tube(pts, 0.006, j % 2 ? C.red : C.blue, 1, true));
    }
  });
  r.part(network, 'alveolar-capillaries', 'Rede capilar alveolar', 'capillaries', 'Aproximar o sangue do ar alveolar.',
    'A perfusão leva CO2 para eliminação e permite captar O2; a cor é um código didático de oxigenação, não a cor real do sangue venoso.',
    'Interpretar a relação ventilação/perfusão e a circulação pulmonar.', 'Sangue pouco oxigenado também contém O2 e é vermelho, não azul.');
  r.part(tube([[-0.45, 0.25, 0.06], [-0.39, 0.08, 0.08], [-0.33, -0.11, 0.09]], 0.019, C.blue), 'pulmonary-arteriole', 'Arteríola pulmonar', 'alveoli',
    'Levar à rede alveolar sangue vindo do coração direito.', 'Em geral contém sangue com menor oxigenação que o sangue que retorna pelas veias pulmonares.',
    'Explicar a exceção pulmonar ao uso impreciso de “artéria = sangue rico em O2”.', 'Artérias são definidas pela direção de saída do coração, não pela quantidade de oxigênio.');
  r.part(tube([[0.33, -0.11, 0.09], [0.39, 0.08, 0.08], [0.45, 0.25, 0.06]], 0.019, C.red), 'pulmonary-venule', 'Vênula pulmonar', 'alveoli',
    'Recolher sangue após a hematose.', 'O sangue segue pelas veias pulmonares até o átrio esquerdo.',
    'Relacionar hematose e trajeto da pequena circulação.', 'Veia não significa obrigatoriamente sangue pouco oxigenado.');
  const typeII = new THREE.Group(); centers.slice(0, 3).forEach(([x, y, z]) => typeII.add(sphere([x + 0.065, y + 0.05, z + 0.117], 0.026, C.gold)));
  r.part(typeII, 'type-ii-pneumocytes', 'Pneumócitos tipo II (ampliados)', 'alveoli', 'Produzir surfactante e contribuir para renovação do epitélio.',
    'O surfactante reduz a tensão superficial no filme líquido, ajudando a manter os alvéolos abertos.',
    'Explicar a dificuldade respiratória associada à falta de surfactante.', 'Surfactante não transporta O2 nem aumenta a tensão superficial.');
  r.part(ring([0, -0.12, 0.141], 0.070, 0.004, C.gold), 'surfactant-film', 'Surfactante: símbolo do filme superficial', 'alveoli',
    'Reduzir a tendência ao colapso alveolar.', 'Moléculas anfipáticas alteram as forças na interface ar-líquido; o anel é um símbolo, não uma camada com espessura real.',
    'Vincular tensão superficial e estabilidade alveolar.', 'O símbolo dourado não representa uma cartilagem ou um anel anatômico.');
  return r;
}

function sarcomere() {
  const r = context('Sarcômero — esquema 3D', 'Unidade contrátil da musculatura estriada, representada em corte didático. Moléculas e espaçamentos não estão em escala; eixo longitudinal X, visão frontal +Z.');
  const zDiscs = new THREE.Group(); [-0.55, 0.55].forEach((x) => zDiscs.add(box([x, 0, 0], [0.023, 0.44, 0.30], C.purple, 0.73)));
  r.part(zDiscs, 'z-discs', 'Discos Z', 'sarcomere', 'Delimitar o sarcômero e ancorar filamentos finos.',
    'Na contração, os discos Z se aproximam porque aumenta a sobreposição dos filamentos.',
    'Reconhecer sarcômero como o intervalo entre dois discos Z.', 'O encurtamento do sarcômero não exige que actina e miosina encurtem.');
  const thick = new THREE.Group();
  for (const y of [-0.075, 0.075]) for (const z of [-0.065, 0.065]) {
    thick.add(rod([-0.30, y, z], [0.30, y, z], 0.019, C.red));
    for (const x of [-0.24, -0.16, 0.16, 0.24]) {
      const dy = y > 0 ? 0.043 : -0.043;
      thick.add(rod([x, y, z], [x + (x > 0 ? -0.02 : 0.02), y + dy, z], 0.005, C.red));
      thick.add(sphere([x + (x > 0 ? -0.02 : 0.02), y + dy, z], 0.012, C.red));
    }
  }
  r.part(thick, 'myosin-thick-filaments', 'Filamentos espessos: miosina', 'sarcomere', 'Gerar força por ciclos de pontes cruzadas com a actina.',
    'A ligação de ATP favorece o desprendimento da cabeça; a hidrólise prepara o ciclo, e a liberação de fosfato se associa ao golpe de força.',
    'Explicar por que ATP é necessário para contração e relaxamento e interpretar rigor mortis.', 'A cabeça de miosina não permanece ligada à actina durante todo o ciclo.');
  const thin = new THREE.Group();
  for (const y of [-0.15, 0, 0.15]) for (const z of [-0.105, 0.105]) {
    for (const side of [-1, 1]) {
      thin.add(rod([side * 0.55, y, z], [side * 0.075, y, z], 0.007, C.blue));
      for (let j = 0; j < 18; j++) {
        const x = side * (0.09 + j * 0.025);
        thin.add(sphere([x, y + 0.007 * Math.sin(j * 1.3), z + 0.007 * Math.cos(j * 1.3)], 0.009, C.blue));
      }
    }
  }
  r.part(thin, 'actin-thin-filaments', 'Filamentos finos: actina', 'sarcomere', 'Oferecer locais de interação para as cabeças de miosina.',
    'Filamentos finos deslizam para o centro do sarcômero; seu comprimento permanece essencialmente constante.',
    'Comparar bandas A e I e zona H durante a contração: a banda A mantém o comprimento; I e H diminuem.', 'Deslizamento não é transformação de actina em miosina.');
  r.part(box([0, 0, 0], [0.012, 0.25, 0.20], C.white, 0.7), 'm-line', 'Linha M', 'sarcomere', 'Organizar o centro do sarcômero e estabilizar filamentos espessos.',
    'Proteínas da linha M conectam e alinham filamentos espessos.', 'Localizar a linha M entre os dois discos Z.', 'A linha M não é a fronteira entre sarcômeros.');
  const regulation = new THREE.Group();
  [-1, 1].forEach((side) => {
    regulation.add(tube(Array.from({ length: 22 }, (_, i) => [side * (0.09 + i * 0.021), 0.15 + 0.012 * Math.sin(i * 0.8), 0.116 + 0.008 * Math.cos(i * 0.8)]), 0.004, C.green));
    [0.17, 0.31, 0.45].forEach((x) => regulation.add(sphere([side * x, 0.16, 0.132], 0.012, C.purple)));
  });
  r.part(regulation, 'troponin-tropomyosin', 'Troponina e tropomiosina (ampliadas)', 'sarcomere', 'Regular a exposição dos locais de ligação na actina.',
    'Ca2+ liga-se à troponina; a mudança conformacional desloca a tropomiosina e permite a interação actina-miosina.',
    'Conectar liberação de Ca2+ pelo retículo sarcoplasmático ao início da contração.', 'No músculo estriado esquelético, o Ca2+ regulatório liga-se à troponina, não diretamente à tropomiosina.');
  const calcium = new THREE.Group(); [-0.31, -0.17, 0.17, 0.31].forEach((x) => calcium.add(sphere([x, 0.21, 0.13], 0.013, C.gold)));
  r.part(calcium, 'calcium-symbols', 'Ca2+ regulatório: símbolos', 'sarcomere', 'Sinalizar a ativação do aparato contrátil.',
    'A remoção de Ca2+ do citosol, por transporte que consome ATP, favorece o relaxamento.',
    'Distinguir papel sinalizador do Ca2+ e papel energético do ATP.', 'As esferas são símbolos de íons ampliados, não organelas ou vesículas reais.');
  return r;
}

function neuron() {
  const r = context('Neurônio mielinizado — esquema 3D', 'Representação didática de um neurônio com mielina periférica. Ramificações, bainhas e núcleo foram ampliados; não representa um tipo neuronal específico nem uma reconstrução real.');
  r.part(sphere([-0.27, 0, 0], 0.12, C.orange, 0.84), 'neuron-soma', 'Corpo celular (soma)', 'neuron', 'Manter o metabolismo e integrar sinais recebidos.',
    'Potenciais graduados recebidos pelo neurônio influenciam o disparo de potenciais de ação na região inicial do axônio.',
    'Comparar integração de sinais, potencial graduado e potencial de ação.', 'Nem todo sinal recebido causa automaticamente um potencial de ação.');
  r.part(sphere([-0.27, 0, 0.070], 0.042, C.purple), 'neuron-nucleus', 'Núcleo do neurônio (exposto no esquema)', 'neuron',
    'Conter material genético e participar do controle da expressão gênica.', 'A produção de proteínas sustenta a estrutura e a função neuronal.',
    'Relacionar organelas e manutenção celular.', 'O núcleo não conduz o impulso nervoso ao longo do axônio.');
  const dendrites = new THREE.Group();
  for (let j = 0; j < 5; j++) {
    const yy = (j - 2) * 0.12, zz = (j % 2 ? -1 : 1) * 0.04;
    dendrites.add(tube([[-0.34, yy * 0.2, 0], [-0.45, yy * 0.65, zz], [-0.60, yy, zz]], 0.012, C.orange));
    dendrites.add(tube([[-0.46, yy * 0.7, zz], [-0.52, yy + 0.05, zz + 0.03], [-0.59, yy + 0.08, zz + 0.03]], 0.007, C.orange));
  }
  r.part(dendrites, 'neuron-dendrites', 'Dendritos', 'neuron', 'Ampliar a superfície de recepção de sinais.',
    'Receptores e canais de membrana permitem sinais sinápticos; potenciais graduados contribuem para integração neuronal.',
    'Identificar regiões de recepção, integração e propagação em um neurônio típico.', 'A direção típica é útil no esquema, mas a diversidade de circuitos não se reduz a uma regra morfológica absoluta.');
  r.part(tube([[-0.16, 0, 0], [-0.06, 0, 0], [0.29, 0, 0], [0.61, 0, 0]], 0.011, C.gold), 'neuron-axon', 'Axônio', 'neuron',
    'Propagar potenciais de ação até as terminações.', 'A abertura de canais dependentes de voltagem participa da despolarização e repolarização; a bomba Na+/K+ mantém os gradientes ao longo do tempo.',
    'Relacionar gradientes iônicos, canais e propagação sem perda de amplitude.', 'A bomba Na+/K+ não é a causa imediata da repolarização de cada potencial de ação; o efluxo de K+ é central.');
  const sheaths = new THREE.Group();
  [0.025, 0.17, 0.315, 0.46].forEach((x) => {
    const o = new THREE.Mesh(new THREE.CapsuleGeometry(0.030, 0.069, 6, 18), mat(C.cream));
    o.rotation.z = Math.PI / 2; o.position.set(x, 0, 0); sheaths.add(o);
  });
  r.part(sheaths, 'neuron-myelin', 'Bainhas de mielina', 'neuron', 'Aumentar a eficiência da condução axonal.',
    'A mielina altera as propriedades elétricas da membrana; células de Schwann formam mielina periférica, e oligodendrócitos formam mielina no sistema nervoso central.',
    'Comparar condução em fibras mielinizadas e não mielinizadas.', 'A bainha é produzida por células gliais; não é uma secreção do axônio.');
  const nodes = new THREE.Group(); [0.0975, 0.2425, 0.3875, 0.5325].forEach((x) => nodes.add(ring([x, 0, 0], 0.014, 0.004, C.purple, 'x')));
  r.part(nodes, 'ranvier-nodes', 'Nódulos de Ranvier', 'neuron', 'Permitir a regeneração do potencial de ação entre segmentos mielinizados.',
    'A concentração de canais dependentes de voltagem em regiões nodais favorece a condução saltatória.',
    'Explicar o sentido de “saltatória” sem sugerir interrupção do circuito elétrico.', 'O impulso não salta fisicamente pelo espaço exterior ao axônio.');
  const terminals = new THREE.Group();
  for (const y of [-0.13, 0, 0.13]) {
    terminals.add(tube([[0.59, 0, 0], [0.66, y * 0.6, 0], [0.73, y, 0]], 0.008, C.gold));
    terminals.add(sphere([0.73, y, 0], 0.024, C.orange));
  }
  r.part(terminals, 'axon-terminals', 'Terminações axonais (região pré-sináptica)', 'synapse', 'Transmitir sinais para outra célula na sinapse.',
    'Em sinapses químicas, a entrada de Ca2+ na terminação favorece exocitose de neurotransmissores; receptores pós-sinápticos determinam a resposta.',
    'Distinguir sinal elétrico no axônio e transmissão química na fenda sináptica.', 'Neurotransmissor não é o próprio potencial de ação; existem também sinapses elétricas.');
  return r;
}

function skin() {
  const r = context('Pele em corte — esquema 3D', 'Corte didático com estruturas ampliadas e camadas transparentes. A hipoderme está incluída como tecido subjacente; não é uma camada da pele em sentido anatômico estrito.');
  r.part(box([0, 0.25, -0.035], [1.02, 0.065, 0.15], C.cream, 0.78), 'epidermis', 'Epiderme', 'epidermis',
    'Oferecer barreira contra agentes externos e perda de água.', 'Epitélio estratificado pavimentoso queratinizado; recebe nutrientes por difusão a partir da derme e não tem vasos sanguíneos.',
    'Relacionar queratinização, proteção e organização dos tecidos.', 'A epiderme é avascular; capilares desenhados abaixo dela estão na derme.');
  r.part(box([0, 0.047, -0.035], [1.02, 0.34, 0.15], C.pink, 0.27), 'dermis', 'Derme', 'dermis',
    'Sustentar a epiderme e alojar vasos, nervos e anexos.', 'Tecido conjuntivo com fibras, matriz extracelular e circulação; glândulas e folículos são anexos de origem epitelial.',
    'Distinguir tecidos epitelial e conjuntivo em um mesmo órgão.', 'A presença de glândulas na derme não transforma toda a derme em tecido epitelial.');
  r.part(box([0, -0.285, -0.035], [1.02, 0.30, 0.15], C.yellow, 0.19), 'hypodermis', 'Hipoderme (tecido subcutâneo)', 'skin',
    'Conectar a pele aos planos profundos, amortecer e abrigar reservas.', 'Tecido conjuntivo com quantidade variável de tecido adiposo participa do isolamento e armazenamento energético.',
    'Relacionar adipócitos, reserva lipídica e isolamento térmico.', 'Hipoderme não é sinônimo de epiderme e não integra a pele em todas as definições anatômicas.');
  const fat = new THREE.Group();
  for (let i = 0; i < 8; i++) fat.add(sphere([-0.42 + i * 0.12, -0.30 + (i % 2) * 0.035, 0.065], 0.060, C.gold, 0.86, [1, 0.85, 0.75]));
  r.part(fat, 'subcutaneous-adipocytes', 'Tecido adiposo subcutâneo', 'skin', 'Armazenar lipídios e participar da proteção térmica e mecânica.',
    'Triglicerídeos são reserva energética; adipócitos também têm funções endócrinas.',
    'Comparar reserva lipídica e glicídica e reconhecer tecido conjuntivo especializado.', 'Gordura subcutânea não é uma camada de células epiteliais queratinizadas.');
  r.part(tube([[-0.23, -0.18, 0.06], [-0.24, 0, 0.06], [-0.26, 0.25, 0.06]], 0.037, C.brown), 'hair-follicle', 'Folículo piloso', 'skin',
    'Produzir e alojar o pelo.', 'Células na região de crescimento originam a haste queratinizada; o folículo se associa a glândulas e músculo eretor.',
    'Relacionar proliferação celular e queratinização.', 'A parte visível da haste do pelo não possui células vivas com metabolismo ativo.');
  r.part(tube([[-0.23, -0.16, 0.085], [-0.26, 0.24, 0.085], [-0.28, 0.47, 0.085]], 0.013, 0x4f382d), 'hair-shaft', 'Haste do pelo', 'skin',
    'Participar de proteção e sensibilidade por sua relação com o folículo.', 'A haste é formada por células queratinizadas; deslocamentos podem estimular receptores associados ao folículo.',
    'Distinguir estrutura queratinizada e região celular produtora.', 'Pelos humanos têm importância limitada para isolamento em comparação com a pelagem de muitos outros mamíferos.');
  const sebaceous = new THREE.Group();
  [[-0.13, 0.12, 0.095], [-0.10, 0.07, 0.095], [-0.15, 0.055, 0.095]].forEach((p) => sebaceous.add(sphere(p, 0.035, C.yellow)));
  sebaceous.add(tube([[-0.13, 0.10, 0.095], [-0.23, 0.09, 0.08]], 0.009, C.yellow));
  r.part(sebaceous, 'sebaceous-gland', 'Glândula sebácea', 'skin', 'Secretar sebo associado à proteção da superfície e dos pelos.',
    'Em muitos locais o sebo chega ao folículo; sua composição lipídica auxilia a lubrificação.',
    'Distinguir secreções e funções de anexos cutâneos.', 'Sebo não é suor e não tem como principal função promover resfriamento por evaporação.');
  const sweat = new THREE.Group();
  const coil = Array.from({ length: 110 }, (_, i) => { const a = i * Math.PI * 8 / 109; return [0.27 + 0.060 * Math.cos(a), -0.09 + i * 0.00048, 0.092 + 0.035 * Math.sin(a)]; });
  sweat.add(tube(coil, 0.010, C.purple));
  sweat.add(tube([coil[coil.length - 1], [0.29, 0.06, 0.095], [0.30, 0.18, 0.095], [0.30, 0.284, 0.095]], 0.010, C.purple));
  r.part(sweat, 'eccrine-sweat-gland', 'Glândula sudorípara écrina e ducto', 'sweat-glands', 'Produzir suor que pode contribuir para o resfriamento.',
    'A evaporação do suor retira calor; a eficiência depende da umidade, ventilação e possibilidade de evaporação.',
    'Relacionar termorregulação, evaporação e condições ambientais.', 'Suor que apenas escorre sem evaporar não produz o mesmo resfriamento por mudança de estado.');
  const sensory = new THREE.Group();
  sensory.add(sphere([-0.40, -0.04, 0.10], 0.043, C.gold, 0.72, [0.72, 1.25, 0.6]));
  for (let i = 0; i < 4; i++) { const o = ring([-0.40, -0.04, 0.13], 0.018 + i * 0.008, 0.002, C.orange); o.scale.set(0.72, 1.25, 1); sensory.add(o); }
  sensory.add(tube([[-0.40, -0.04, 0.10], [-0.36, -0.16, 0.10], [-0.05, -0.20, 0.10], [0.05, -0.36, 0.10]], 0.005, C.gold));
  r.part(sensory, 'cutaneous-sensory-ending', 'Terminação sensorial encapsulada (esquema)', 'skin', 'Detectar estímulos mecânicos e enviar sinais aferentes.',
    'Deformação pode ativar canais mecanossensíveis; diferentes receptores cutâneos respondem a estímulos e velocidades de adaptação diferentes.',
    'Relacionar estímulo mecânico, transdução e condução nervosa.', 'O desenho simboliza uma terminação; não atribuir a todos os receptores cutâneos a mesma função ou profundidade.');
  const vessels = new THREE.Group();
  vessels.add(tube([[-0.47, -0.125, 0.13], [-0.12, -0.125, 0.13], [0.44, -0.125, 0.13]], 0.010, C.red));
  vessels.add(tube([[-0.47, -0.16, 0.12], [-0.12, -0.16, 0.12], [0.44, -0.16, 0.12]], 0.010, C.blue));
  for (const x of [-0.40, -0.02, 0.13, 0.42]) vessels.add(tube([[x, -0.125, 0.13], [x - 0.015, 0.08, 0.13], [x, 0.20, 0.13], [x + 0.02, 0.08, 0.13], [x + 0.025, -0.16, 0.12]], 0.004, C.red));
  r.part(vessels, 'dermal-vessels', 'Vasos e alças capilares da derme', 'capillaries', 'Nutrir tecidos e participar do controle da perda de calor.',
    'Vasodilatação cutânea pode aumentar a transferência de calor para a superfície; vasoconstrição reduz o fluxo superficial.',
    'Integrar circulação, sudorese e termorregulação.', 'Vasodilatação não garante perda de calor em qualquer ambiente; o gradiente térmico importa.');
  r.part(rod([-0.23, -0.05, 0.095], [-0.42, 0.20, 0.095], 0.012, C.green), 'arrector-pili', 'Músculo eretor do pelo', 'skin',
    'Alterar a posição do pelo por contração involuntária.', 'Músculo liso associado ao folículo; sua contração produz a piloereção.',
    'Comparar músculos liso e estriado e respostas autonômicas.', 'Arrepio não equivale a uma contração voluntária do músculo esquelético.');
  return r;
}

/** Returns an independent educational Three.js scene, or null for unknown IDs.
 * The caller owns disposal. Parts may be Meshes or Groups and are pickable by
 * recursive raycasting. Names and all explanatory fields are supplied in parts.
 */
export function buildMicroModel(id) {
  const build = { nephron, 'alveolar-unit': alveolar, sarcomere, neuron, 'skin-section': skin }[id];
  if (!build) return null;
  const { group, title, description, parts } = build();
  group.userData.modelId = id;
  return { group, title, description, parts };
}
