/*
 * Educational physiology engine. Controls and results use physiological units with approximate
 * textbook reference values for a healthy adult; the relations are textbook simplifications
 * (ventilation = rate × tidal volume, Fick's law, cardiac output = HR × SV, latent heat of sweat),
 * not fitted clinical models. Graph coordinates use a fixed [0, 1] scale; each axis label states
 * the physical range it maps to.
 */
const COLORS = {
  blue: '#36b9e9', pink: '#fc7188', amber: '#ffb85c', purple: '#a994ff',
  green: '#6dd3a9', muted: '#b0bfcc',
};
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const fmt = (value, decimals = 0) => new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: decimals, maximumFractionDigits: decimals,
}).format(value);
const index = value => `${fmt(clamp(value) * 100)}/100`;

function line(name, color, fn, count = 121) {
  const points = Array.from({ length: count }, (_, i) => {
    const x = i / (count - 1);
    const y = fn(x);
    return [x, clamp(Number.isFinite(y) ? y : 0)];
  });
  return { name, color, points };
}

function interpolate(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (x <= points[i][0]) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
  }
  return points[points.length - 1][1];
}

function readValues(sim, input) {
  const clean = {};
  for (const p of sim.parameters || []) {
    const raw = input?.[p.id];
    const parsed = typeof raw === 'string' && raw.trim() !== ''
      ? Number(raw.replace(',', '.')) : typeof raw === 'number' ? raw : NaN;
    const fallback = Number.isFinite(Number(p.default)) ? Number(p.default) : 0;
    clean[p.id] = clamp(Number.isFinite(parsed) ? parsed : fallback, p.min, p.max);
  }
  return clean;
}

function controlDescription(sim, values) {
  return (sim.parameters || []).map(p => {
    const digits = Number(p.step) < 1 ? 1 : 0;
    const unit = p.unit === 'índice didático' ? 'índ.' : p.unit;
    return `${p.label}: ${fmt(values[p.id], digits)} ${unit}`;
  }).join('; ');
}

/**
 * @param {object} sim One module from data/simulations.json.
 * @param {Record<string, number|string>} values Controls keyed by parameter id.
 * @returns {object} Curves, results, explanation and sanitized control values.
 */
export function computeSimulation(sim, values = {}) {
  sim = sim || {};
  const v = readValues(sim, values);
  const relativeAxis = 'Índice didático (0–100)';
  const finish = result => {
    const explanation = [
      sim.causalExplanation || '', result.explanation || '',
      sim.caveat || '', `Controles: ${controlDescription(sim, v)}.`,
    ].filter(Boolean).join(' ');
    return { ...result, explanation, controlValues: v };
  };

  switch (sim.id) {
    case 'ventilacao': {
      const rate = v.frequencia;
      const tidal = v.amplitude;
      const resistance = v.resistencia;
      const DEAD_SPACE = 150; // mL, anatomical dead space of an adult
      const minute = rate * tidal / 1000;
      const alveolar = rate * Math.max(0, tidal - DEAD_SPACE) / 1000;
      // Sinusoidal breathing: V(t) = VT(1 − cos ωt)/2, so peak flow = π·VT·f/60.
      const peakFlow = Math.PI * tidal / 1000 * rate / 60;
      const pressure = resistance * peakFlow;
      const omega = 2 * Math.PI * rate / 60;
      const FLOW_AXIS = 1.6;
      return finish({
        lines: [
          line('Volume acima do repouso', COLORS.blue, x => tidal * (1 - Math.cos(omega * 10 * x)) / 2 / 1000),
          line('Fluxo de ar', COLORS.amber, x => 0.5 + peakFlow * Math.sin(omega * 10 * x) / (2 * FLOW_AXIS)),
        ],
        xLabel: 'Tempo: 0–10 s',
        yLabel: 'Volume: 0–1.000 mL · Fluxo: −1,6 a +1,6 L/s (meio = 0)',
        result1: { label: 'Ventilação alveolar', value: `${fmt(alveolar, 1)} L/min`, note: `Ventilação total ${fmt(minute, 1)} L/min; ${DEAD_SPACE} mL de cada ciclo ficam no espaço morto.` },
        result2: { label: 'Pressão para o pico de fluxo', value: `${fmt(pressure, 1)} cmH₂O`, note: `Pico de ${fmt(peakFlow, 2)} L/s × resistência ${fmt(resistance, 1)}.` },
        explanation: tidal <= DEAD_SPACE
          ? 'O volume corrente não supera o espaço morto: o ar novo não chega aos alvéolos, ainda que exista ventilação total.'
          : `Acima de 50 no fluxo, o ar entra; abaixo, sai. Respirar mais fundo rende mais ventilação alveolar do que respirar mais rápido, porque cada ciclo perde os mesmos ${DEAD_SPACE} mL no espaço morto. Para o mesmo fluxo, uma resistência maior exige uma diferença de pressão maior (ΔP = R × fluxo).`,
        state: { frequency: rate, tidalVolume: tidal, minuteVentilation: minute, alveolarVentilation: alveolar, peakFlow, pressure },
      });
    }

    case 'trocas-gasosas': {
      const NORMAL_GRADIENT = 60, NORMAL_THICKNESS = 0.5;
      const thickness = v.espessura;
      const perfusion = v.perfusao;
      // Fick: diffusion ∝ ΔP / thickness (area and solubility fixed), as % of a normal alveolus.
      const diffusionAt = gradient => 100 * (gradient / NORMAL_GRADIENT) / (thickness / NORMAL_THICKNESS);
      const diffusion = diffusionAt(v.gradiente);
      const useful = Math.min(diffusion, perfusion);
      let condition = 'O transporte útil fica limitado pelo menor entre a difusão e a perfusão.';
      if (v.gradiente === 0) condition = 'Sem diferença de P_O₂ não há fluxo líquido de O₂, mesmo que as moléculas continuem em movimento aleatório.';
      if (perfusion === 0) condition += ' Sem perfusão, o O₂ que difunde não é levado embora pelo sangue.';
      return finish({
        lines: [
          line('Difusão', COLORS.blue, x => diffusionAt(80 * x) / 200),
          line('Transporte útil', COLORS.pink, x => Math.min(diffusionAt(80 * x), perfusion) / 200),
        ],
        xLabel: 'Diferença de P_O₂: 0–80 mmHg', yLabel: '% do alvéolo normal (0–200%)',
        result1: { label: 'Difusão de O₂', value: `${fmt(diffusion)}% do normal`, note: `${fmt(v.gradiente)} mmHg através de ${fmt(thickness, 1)} µm de barreira.` },
        result2: { label: 'Transporte útil', value: `${fmt(useful)}% do normal`, note: `Perfusão: ${fmt(perfusion)}% do normal.` },
        explanation: `${condition} Pela lei de Fick, dobrar a espessura da barreira reduz a difusão à metade; dobrar a diferença de pressão a dobra.`,
        state: { oxygenDiffusion: diffusion, usefulTransport: useful, perfusion },
      });
    }

    case 'debito-cardiaco': {
      const rate = v.frequencia;
      const stroke = v.volume_sistolico;
      const mlMinute = rate * stroke;
      const litres = mlMinute / 1000;
      // 17.6 L/min is only the upper product of the interface controls.
      const axisMaximum = 160 * 110 / 1000;
      return finish({
        lines: [line('Débito', COLORS.pink, x => (40 + 120 * x) * stroke / 1000 / axisMaximum)],
        xLabel: 'FC: 40–160 batimentos/min', yLabel: 'Débito: 0–17,6 L/min',
        result1: { label: 'Débito / ventrículo', value: `${fmt(litres, 2)} L/min`, note: `${fmt(rate)} batimentos/min × ${fmt(stroke)} mL/batimento.` },
        result2: { label: 'Bombeado em 1 min', value: `${fmt(mlMinute)} mL`, note: 'Não somar os dois ventrículos: os circuitos estão em série.' },
        explanation: 'Aqui existe um cálculo fisiológico documentado: débito = frequência × volume sistólico. A curva mantém o volume sistólico escolhido e varia a frequência no eixo. O teto do eixo é uma escolha da interface, não um limite de saúde; não se calcula pressão arterial.',
        state: { frequency: rate, strokeVolume: stroke, cardiacOutputLitres: litres },
      });
    }

    case 'glicemia': {
      const carbs = v.refeicao;
      const sensitivity = v.resposta_insulina / 100;
      const glucagon = v.glucagon / 100;
      // Authored curve with textbook landmarks: fasting ~85–100 mg/dL; 60 g at normal sensitivity peaks near
      // 140 mg/dL around 45 min and returns below 140 mg/dL by 2 h. Not a fitted metabolic model.
      const fasting = 88 * (1 + 0.15 * (glucagon - 1));
      const peakTime = 45 / Math.sqrt(sensitivity);
      const rise = 4.6 * Math.pow(carbs, 0.6) * (1.4 - 0.4 * Math.min(sensitivity, 1));
      const glucoseAt = minutes => fasting + (carbs ? rise * (minutes / peakTime) * Math.exp(1 - minutes / peakTime) : 0);
      const AXIS = 250, MINUTES = 180;
      const glucoseLine = line('Glicose (mg/dL)', COLORS.amber, x => glucoseAt(MINUTES * x) / AXIS);
      const peak = carbs ? glucoseAt(Math.min(peakTime, MINUTES)) : fasting;
      const twoHours = glucoseAt(120);
      return finish({
        lines: [
          glucoseLine,
          line('Ação insulínica (relativa)', COLORS.purple, x => carbs ? 0.6 * sensitivity * (carbs / 150) * ((MINUTES * x + 10) / (peakTime + 10)) * Math.exp(1 - (MINUTES * x + 10) / (peakTime + 10)) : 0),
          line('Liberação hepática (relativa)', COLORS.green, () => 0.2 * glucagon),
        ],
        xLabel: 'Tempo após a refeição: 0–180 min', yLabel: 'Glicose: 0–250 mg/dL; demais curvas relativas',
        result1: { label: 'Pico de glicemia', value: `${fmt(peak)} mg/dL`, note: carbs ? `Por volta de ${fmt(Math.min(peakTime, MINUTES))} min; jejum ${fmt(fasting)} mg/dL.` : `Sem refeição; jejum ${fmt(fasting)} mg/dL.` },
        result2: { label: 'Glicemia em 2 h', value: `${fmt(twoHours)} mg/dL`, note: 'Teste oral (75 g): < 140 normal; 140–199 intolerância; ≥ 200 sugere diabetes.' },
        explanation: carbs === 0
          ? 'Sem refeição não aparece o pico pós-prandial. O glucagon ainda ajusta a glicemia de jejum pela liberação hepática de glicose.'
          : 'A refeição eleva o pico; com menor sensibilidade à insulina, os tecidos captam menos glicose e a curva sobe mais e demora a voltar. A linha roxa representa a ação da insulina nos tecidos, não a concentração do hormônio. O glucagon eleva a glicemia de jejum.',
        state: { carbohydrateGrams: carbs, insulinSensitivity: sensitivity, glucagon, peakGlucose: peak, twoHourGlucose: twoHours },
      });
    }

    case 'rim-adh': {
      const SOLUTE_LOAD = 600; // mOsm excreted per day
      const MIN_OSM = 50;
      const adh = v.adh;
      const medulla = v.gradiente_medular;
      const filteredPerDay = v.filtracao * 1.44; // mL/min → L/day
      const urineOsmAt = hormone => MIN_OSM + (medulla - MIN_OSM) * Math.min(1, hormone / 5);
      const urineOsm = urineOsmAt(adh);
      const volumeAt = hormone => SOLUTE_LOAD / urineOsmAt(hormone);
      const volume = volumeAt(adh);
      const reabsorbed = 100 * (1 - volume / filteredPerDay);
      const condition = medulla <= 300
        ? 'Sem gradiente medular, o ADH abre aquaporinas, mas não há para onde a água sair por osmose: a urina não fica mais concentrada que o plasma (~300 mOsm/L).'
        : adh === 0
          ? 'Sem ADH o ducto coletor fica pouco permeável à água e a urina sai diluída e abundante (como no diabetes insípido).'
          : 'Com o gradiente preservado, mais ADH insere aquaporinas no ducto coletor: a água sai para a medula, a urina se concentra e o volume diminui.';
      return finish({
        lines: [
          line('Osmolaridade da urina', COLORS.blue, x => urineOsmAt(10 * x) / 1400),
          line('Volume urinário', COLORS.amber, x => volumeAt(10 * x) / 14),
        ],
        xLabel: 'ADH plasmático: 0–10 pg/mL', yLabel: 'Osmolaridade: 0–1.400 mOsm/L · Volume: 0–14 L/dia',
        result1: { label: 'Urina', value: `${fmt(urineOsm)} mOsm/L`, note: `Volume de ${fmt(volume, 1)} L/dia para ${SOLUTE_LOAD} mOsm de solutos.` },
        result2: { label: 'Água reabsorvida', value: `${fmt(reabsorbed, 1)}% do filtrado`, note: `${fmt(filteredPerDay)} L filtrados por dia.` },
        explanation: `${condition} A maior parte do filtrado é reabsorvida antes do ducto coletor, mesmo sem ADH; o hormônio ajusta o último 1–7%.`,
        state: { adh, medullaryOsmolality: medulla, urineOsmolality: urineOsm, urineVolume: volume, reabsorbedPercent: reabsorbed },
      });
    }

    case 'reflexo-sinapse': {
      const REST = -70, THRESHOLD_DEPOLARIZATION = 15, PEAK = 30;
      const fires = v.estimulo >= THRESHOLD_DEPOLARIZATION;
      const myelin = v.mielina / 100;
      const release = v.liberacao / 100;
      const events = fires ? Math.min(3, 1 + Math.floor((v.estimulo - THRESHOLD_DEPOLARIZATION) / 9)) : 0;
      const velocity = 2 + 78 * myelin; // m/s
      const travelMs = 1000 / velocity; // over about 1 m of nerve
      const delay = 0.12 + 0.2 * (1 - myelin);
      const centres = Array.from({ length: events }, (_, i) => delay + i * 0.18);
      const toAxis = mV => (mV + 90) / 130;
      const membrane = x => {
        let peak = 0, undershoot = 0;
        for (const centre of centres) {
          peak = Math.max(peak, Math.exp(-Math.pow((x - centre) / 0.019, 2)));
          undershoot = Math.max(undershoot, Math.exp(-Math.pow((x - centre - 0.055) / 0.025, 2)));
        }
        const local = fires ? 0 : Math.min(v.estimulo, THRESHOLD_DEPOLARIZATION) * Math.exp(-Math.pow((x - 0.12) / 0.05, 2));
        return toAxis(REST + local + (PEAK - REST) * peak - 10 * undershoot);
      };
      const postsynaptic = x => {
        let activity = 0;
        for (const centre of centres) activity = Math.max(activity, Math.exp(-Math.pow((x - centre - 0.065) / 0.06, 2)));
        return toAxis(REST + 15 * release * activity);
      };
      return finish({
        lines: [line('Axônio (mV)', COLORS.purple, membrane), line('Neurônio seguinte (mV)', COLORS.blue, postsynaptic)],
        xLabel: 'Sequência do sinal (tempo relativo)', yLabel: 'Potencial de membrana: −90 a +40 mV',
        result1: { label: 'Disparo', value: fires ? `${events} ${events > 1 ? 'potenciais' : 'potencial'} de ação` : 'Sem disparo', note: fires ? 'Cada potencial chega a cerca de +30 mV, qualquer que seja o estímulo.' : `A membrana chega a ${fmt(REST + v.estimulo)} mV, abaixo do limiar de −55 mV.` },
        result2: { label: 'Velocidade de condução', value: `${fmt(velocity)} m/s`, note: `Cerca de ${fmt(travelMs)} ms para percorrer 1 m de nervo.` },
        explanation: `${fires
          ? 'O estímulo levou a membrana ao limiar (−55 mV) e abriu canais de Na⁺ dependentes de voltagem: o potencial de ação tem amplitude fixa (tudo ou nada). Estímulos mais fortes aumentam a frequência de disparos, não a altura de cada um.'
          : 'O estímulo causou só uma despolarização local, que não alcançou o limiar e não se propaga.'} ${release === 0 && fires
          ? 'Sem Ca²⁺ no terminal, o neurotransmissor não é liberado e o neurônio seguinte não responde.'
          : 'A entrada de Ca²⁺ no terminal libera o neurotransmissor, que despolariza o neurônio seguinte (potencial pós-sináptico excitatório).'} A mielina permite a condução saltatória entre os nódulos de Ranvier.`,
        state: { fires, pulseCount: events, myelin, synapticRelease: release, conductionVelocity: velocity },
      });
    }

    case 'digestao-ph': {
      const enzyme = v.enzima / 100;
      const substrate = v.substrato / 100;
      // A visual saturation response, with no claimed Km, rate or concentration.
      const substrateEffect = 1.4 * substrate / (0.4 + substrate);
      const capacity = enzyme * substrateEffect;
      const pepsin = [[1,.60],[2,1],[3,.65],[4,.20],[5,.05],[6,0],[7,0],[8,0],[9,0]];
      const amylase = [[1,0],[2,0],[3,0],[4,.05],[5,.30],[6,.80],[7,1],[8,.50],[9,.10]];
      const pepsinNow = capacity * interpolate(pepsin, v.ph);
      const amylaseNow = capacity * interpolate(amylase, v.ph);
      const percent = value => `${fmt(clamp(value) * 100)}% do máximo`;
      return finish({
        lines: [
          line('Pepsina + proteína', COLORS.amber, x => capacity * interpolate(pepsin, 1 + 8 * x)),
          line('Amilase + amido', COLORS.blue, x => capacity * interpolate(amylase, 1 + 8 * x)),
        ],
        xLabel: 'pH do ensaio: 1–9', yLabel: 'Atividade: 0–100% do máximo de cada enzima',
        result1: { label: 'Pepsina no pH atual', value: percent(pepsinNow), note: `pH ${fmt(v.ph, 1)}; ótimo próximo de 2 (estômago).` },
        result2: { label: 'Amilase no pH atual', value: percent(amylaseNow), note: 'Ótimo próximo de 7 (boca e intestino).' },
        explanation: `${enzyme === 0 || substrate === 0
          ? 'Sem enzima ou sem o substrato específico, não há conversão neste ensaio.'
          : 'O pH altera a forma do sítio ativo e, com ela, a atividade; a quantidade de enzima e de substrato limita a conversão.'} Cada enzima está em % do próprio máximo, porque usam substratos diferentes.`,
        state: { ph: v.ph, enzyme, substrate, relativePepsinActivity: pepsinNow, relativeAmylaseActivity: amylaseNow },
      });
    }

    case 'ciclo-ovariano': {
      const day = v.dia;
      const lhPeak = v.sinal_lh;
      const progesteronePeak = v.funcao_lutea;
      const BASAL_LH = 8;
      // A surge clearly above the basal 5–10 UI/L is needed for ovulation in this example.
      const eventEnabled = lhPeak > 10;
      const estrogen = [[1,.15],[5,.20],[9,.50],[12,.90],[14,.50],[17,.35],[21,.55],[24,.40],[28,.10]];
      const lhProfile = [[1,0],[5,0],[9,.03],[12,.2],[14,1],[16,.03],[21,0],[28,0]];
      const progesterone = [[1,.05],[5,.05],[9,.05],[14,.08],[17,.50],[21,1],[24,.75],[28,.05]];
      const E2_PEAK = 350, LH_AXIS = 80, P4_AXIS = 25;
      const estradiolAt = d => E2_PEAK * interpolate(estrogen, d);
      const lhAt = d => BASAL_LH + Math.max(0, lhPeak - BASAL_LH) * interpolate(lhProfile, d);
      const progesteroneAt = d => eventEnabled ? Math.max(0.3, progesteronePeak * interpolate(progesterone, d)) : 0.3;
      let stage;
      if (day <= 5) stage = 'Menstrual';
      else if (day < 14) stage = 'Folicular';
      else if (!eventEnabled) stage = 'Sem ovulação';
      else if (day < 15) stage = 'Ovulatória';
      else stage = 'Lútea';
      return finish({
        lines: [
          line('Estradiol', COLORS.pink, x => estradiolAt(1 + 27 * x) / 400),
          line('LH', COLORS.purple, x => lhAt(1 + 27 * x) / LH_AXIS),
          line('Progesterona', COLORS.amber, x => progesteroneAt(1 + 27 * x) / P4_AXIS),
          { name: 'Dia escolhido', color: COLORS.muted, points: [[(day - 1) / 27, 0], [(day - 1) / 27, 1]] },
        ],
        xLabel: 'Dia do ciclo: 1–28', yLabel: 'Estradiol 0–400 pg/mL · LH 0–80 UI/L · Progesterona 0–25 ng/mL',
        result1: { label: 'Fase', value: stage, note: `Dia ${fmt(day)} de um ciclo exemplar de 28 dias.` },
        result2: { label: 'Hormônios no dia', value: `P4 ${fmt(progesteroneAt(day), 1)} ng/mL`, note: `Estradiol ${fmt(estradiolAt(day))} pg/mL · LH ${fmt(lhAt(day))} UI/L.` },
        explanation: eventEnabled
          ? `O estradiol crescente do folículo dominante dispara o pico de LH (aqui ${fmt(lhPeak)} UI/L), que leva à ovulação por volta do dia 14. O folículo rompido vira corpo lúteo, que secreta progesterona (${progesteronePeak ? `até ${fmt(progesteronePeak)} ng/mL` : 'ausente neste cenário'}) e prepara o endométrio. Sem gravidez, o corpo lúteo regride, a progesterona cai e começa a menstruação.`
          : 'O LH ficou nos níveis basais, sem pico: não há ovulação nem corpo lúteo, e a progesterona permanece baixa (ciclo anovulatório).',
        state: { day, stage, ovulationEnabled: eventEnabled, corpusLuteumShown: eventEnabled && day >= 15, progesterone: progesteroneAt(day) },
      });
    }

    case 'sarcomero': {
      const calcium = v.calcio;
      const atp = v.atp;
      // Troponin activation: Hill curve with half activation near 1 µM.
      const activation = calcium ** 2.5 / (calcium ** 2.5 + 1);
      const atpLevel = Math.min(1, atp / 5);
      const frequency = (v.estimulos - 1) / 29;
      const locked = atp === 0;
      const REST_LENGTH = 2.5, MIN_LENGTH = 1.9, A_BAND = 1.6, AXIS = 3;
      const drive = x => {
        const recruitment = 1 - Math.exp(-x * (1 + 6 * frequency) * (0.5 + 2 * atpLevel));
        const recovery = Math.exp(-Math.max(0, x - 0.65) * (4 + 8 * atpLevel));
        return recruitment * recovery;
      };
      // With ATP absent, keep a hypothetical pre-existing attached state (rigor), not an automatic relaxation.
      const lengthAt = x => locked ? 2.1 : REST_LENGTH - (REST_LENGTH - MIN_LENGTH) * activation * drive(x);
      const minimum = Math.min(...Array.from({ length: 121 }, (_, i) => lengthAt(i / 120)));
      const inactive = activation < 0.05;
      const contraction = locked ? 'Rigor: pontes presas' : inactive ? 'Sem ativação por Ca²⁺' : 'Ciclagem das pontes';
      return finish({
        lines: [line('Comprimento do sarcômero', COLORS.pink, x => lengthAt(x) / AXIS), line('Banda A', COLORS.purple, () => A_BAND / AXIS)],
        xLabel: 'Estímulo e recuperação (tempo relativo)', yLabel: 'Comprimento: 0–3 µm',
        result1: { label: 'Estado das pontes', value: contraction, note: `Ca²⁺ ${fmt(calcium, 1)} µM ativa ${fmt(activation * 100)}% da troponina; ATP ${fmt(atp, 1)} mM.` },
        result2: { label: 'Comprimento mínimo', value: `${fmt(minimum, 2)} µm`, note: `Repouso ${fmt(REST_LENGTH, 1)} µm; a banda A fica em ${fmt(A_BAND, 1)} µm.` },
        explanation: locked
          ? 'Sem ATP a miosina não se solta da actina: as pontes ficam presas e o sarcômero não relaxa nem encurta (rigor, como no rigor mortis).'
          : inactive
            ? 'Com Ca²⁺ de repouso (~0,1 µM), tropomiosina cobre os sítios da actina. Há ATP, mas sem Ca²⁺ ligado à troponina não há contração.'
            : 'O Ca²⁺ liga-se à troponina e expõe os sítios da actina; o ATP permite cada ciclo de ligação e desligamento das pontes. Estímulos mais frequentes somam contrações. As linhas Z se aproximam e a banda I e a zona H encurtam, mas a banda A e os filamentos mantêm o comprimento.',
        state: { calcium, activation, atp, bridgeCyclingEnabled: !locked && !inactive, possibleRigor: locked, minimumLength: minimum },
      });
    }

    case 'termorregulacao': {
      const LATENT_W_PER_L_H = 670; // ~2 400 kJ per litre evaporated, delivered over one hour
      const BLOOD_W_PER_L_MIN = 60 * 2; // 60 W per L/min for each °C, with 2 °C between core and skin
      const efficiency = humidity => clamp((100 - humidity) / 90);
      const evaporative = humidity => v.suor * efficiency(humidity) * LATENT_W_PER_L_H;
      const evaporation = evaporative(v.umidade);
      const skinHeat = v.vasodilatacao * BLOOD_W_PER_L_MIN;
      const AXIS = 1400;
      return finish({
        lines: [
          line('Perda por evaporação', COLORS.blue, x => evaporative(10 + 85 * x) / AXIS),
          line('Calor levado à pele', COLORS.pink, () => skinHeat / AXIS),
        ],
        xLabel: 'Umidade relativa: 10–95%', yLabel: 'Potência: 0–1.400 W',
        result1: { label: 'Perda por evaporação', value: `${fmt(evaporation)} W`, note: `${fmt(v.suor, 1)} L/h de suor com ${fmt(v.umidade)}% de umidade.` },
        result2: { label: 'Calor levado à pele', value: `${fmt(skinHeat)} W`, note: 'Em repouso o corpo produz ~100 W; exercício intenso, 800 W ou mais.' },
        explanation: `${v.suor === 0
          ? 'Sem suor, esse mecanismo evaporativo fica ausente; restam irradiação, condução e convecção.'
          : 'Só o suor que evapora retira calor: com o ar úmido, ele escorre sem evaporar e a perda cai.'} A vasodilatação cutânea leva mais sangue quente à pele, de onde o calor sai para o ambiente se ele estiver mais frio que a pele.`,
        state: { humidity: v.umidade, sweatRate: v.suor, skinBloodFlow: v.vasodilatacao, evaporativeLoss: evaporation, skinHeatTransport: skinHeat },
      });
    }

    default:
      return finish({
        lines: [], xLabel: 'Sem módulo ativo', yLabel: relativeAxis,
        result1: { label: 'Módulo', value: 'Não disponível', note: 'Identificador sem relação implementada.' },
        result2: { label: 'Resultado', value: '—', note: 'Selecione um dos dez módulos de fisiologia.' },
        explanation: 'Não foi calculada uma resposta para este identificador.',
      });
  }
}
