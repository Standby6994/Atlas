/*
 * Educational physiology engine. Apart from cardiac output, numerical curves
 * are authored visual indices, not fitted physiological or clinical equations.
 * All graph coordinates use a fixed [0, 1] scale rather than per-curve rescaling.
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
      const expansion = v.amplitude / 100;
      // Resistance is an authored attenuation, not a calibrated airway model.
      const flowScale = expansion / (1 + 4 * v.resistencia / 100);
      const phase = x => 2 * Math.PI * rate * 10 * x / 60;
      const relativeFlow = flowScale * rate / 30;
      return finish({
        lines: [
          line('Expansão', COLORS.blue, x => expansion * (1 - Math.cos(phase(x))) / 2),
          line('Fluxo de ar', COLORS.amber, x => 0.5 + 0.45 * relativeFlow * Math.sin(phase(x))),
        ],
        xLabel: 'Tempo do exemplo: 0–10 s',
        yLabel: 'Índice; fluxo entra >50, sai <50',
        result1: { label: 'Ritmo', value: `${fmt(rate)} ciclos/min`, note: 'A frequência altera o número de ciclos, mantendo a amplitude escolhida.' },
        result2: { label: 'Fluxo relativo', value: index(relativeFlow), note: 'Maior expansão favorece fluxo; maior resistência o limita sob o mesmo esforço.' },
        explanation: 'A linha de fluxo usa 50 como zero: acima é entrada; abaixo é saída. Nas transições entre inspiração e expiração, o fluxo é zero. O índice combina ritmo, expansão e resistência apenas para comparação. Sem volume corrente em litros, não é calculada ventilação-minuto em L/min.',
        state: { frequency: rate, expansion, flowScale },
      });
    }

    case 'trocas-gasosas': {
      const gradient = v.gradiente / 80;
      const thickness = v.espessura;
      const perfusion = v.perfusao / 100;
      const diffusion = gradient / thickness;
      const useful = Math.min(diffusion, perfusion);
      let condition = 'O transporte útil é limitado pelo fator menos disponível no desenho; o índice não é saturação arterial.';
      if (v.gradiente === 0) condition = 'O gradiente de O₂ é zero: não há fluxo líquido impulsionado por esse gradiente, mesmo que as moléculas continuem em movimento aleatório.';
      if (perfusion === 0) condition += ' Sem perfusão, a região não transporta O₂ pelo sangue, ainda que exista um gradiente local.';
      return finish({
        lines: [
          line('Difusão', COLORS.blue, x => x * gradient / thickness),
          line('Transporte útil', COLORS.pink, x => Math.min(x * gradient / thickness, perfusion)),
        ],
        xLabel: `Gradiente: 0–${fmt(v.gradiente)} mmHg`, yLabel: relativeAxis,
        result1: { label: 'Potencial difusivo', value: index(diffusion), note: `Barreira: ${fmt(thickness, 1)} × a referência visual.` },
        result2: { label: 'Transporte útil', value: index(useful), note: `Perfusão escolhida: ${fmt(v.perfusao)}/100.` },
        explanation: condition,
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
      const meal = v.refeicao / 100;
      const response = v.resposta_insulina / 100;
      const glucagon = v.glucagon / 100;
      const pulse = (x, onset) => {
        const t = Math.max(0, (x - onset) * 8);
        return t === 0 ? 0 : t * Math.exp(1 - t);
      };
      const glucose = x => clamp(0.22 + 0.15 * glucagon
        + 0.62 * meal * pulse(x, 0.08) * Math.exp(-2.2 * response * x));
      const uptake = x => response * meal * pulse(x, 0.17);
      const supply = () => 0.6 * glucagon;
      const glucoseLine = line('Glicose', COLORS.amber, glucose);
      const peak = Math.max(...glucoseLine.points.map(p => p[1]));
      return finish({
        lines: [glucoseLine, line('Ação insulínica', COLORS.purple, uptake), line('Oferta hepática', COLORS.green, supply)],
        xLabel: 'Tempo após estímulo (relativo)', yLabel: relativeAxis,
        result1: { label: 'Pico de glicose', value: index(peak), note: 'Índice do exemplo, sem conversão para mg/dL.' },
        result2: { label: 'Resposta à insulina', value: `${fmt(v.resposta_insulina)}/100`, note: `Glucagon: ${fmt(v.glucagon)}/100; maior sinal favorece oferta hepática.` },
        explanation: meal === 0
          ? 'Sem entrada alimentar, não aparece um pico pós-refeição. O controle de ação insulínica não inventa um estímulo alimentar; o glucagon ainda modifica a oferta hepática ilustrada.'
          : 'A refeição aumenta o pico; uma resposta maior à insulina favorece o retorno ao nível de referência. A linha insulínica representa ação nos tecidos, não concentração de hormônio. O sinal de glucagon modifica a oferta hepática. Os perfis são comparativos, sem diagnóstico ou dinâmica metabólica calibrada.',
        state: { meal, insulinResponse: response, glucagon, relativeGlucosePeak: peak },
      });
    }

    case 'rim-adh': {
      const adh = v.adh / 100;
      const gradient = v.gradiente_medular / 100;
      const input = v.filtracao / 150;
      const permeabilityEffect = adh * gradient;
      const recovered = input * permeabilityEffect;
      const urineWater = input * (1 - 0.8 * permeabilityEffect);
      const condition = gradient === 0
        ? 'O gradiente medular foi removido. Aumentar ADH pode aumentar permeabilidade, mas não garante fluxo osmótico líquido de água ou concentração de urina sem esse gradiente.'
        : adh === 0
          ? 'O sinal de ADH está ausente. O desenho não adiciona a recuperação de água dependente desse sinal no coletor; há reabsorção em outros segmentos, omitida aqui.'
          : 'Com gradiente preservado, maior ADH favorece aquaporinas e recuperação de água no coletor, reduzindo água eliminada. Não confundir a entrada de filtrado com a urina final.';
      return finish({
        lines: [
          line('Água reabsorvida', COLORS.blue, x => input * adh * gradient * x),
          line('Água na urina', COLORS.amber, x => input * (1 - 0.8 * adh * gradient * x)),
        ],
        xLabel: 'Ação do ADH escolhido: 0–100%', yLabel: relativeAxis,
        result1: { label: 'Reabsorção relativa', value: index(recovered), note: `Gradiente medular: ${fmt(v.gradiente_medular)}/100.` },
        result2: { label: 'Água urinária', value: index(urineWater), note: `Entrada de filtrado: ${fmt(v.filtracao)} índ.; não é mL/min.` },
        explanation: `${condition} As curvas são índices separados; não representam percentagens do filtrado nem um balanço quantitativo de água.`,
        state: { adh, medullaryGradient: gradient, relativeWaterRecovery: recovered, relativeUrineWater: urineWater },
      });
    }

    case 'reflexo-sinapse': {
      const threshold = 45; // An arbitrary teaching threshold, not a clinical one.
      const fires = v.estimulo >= threshold;
      const myelin = v.mielina / 100;
      const release = v.liberacao / 100;
      const events = fires ? 1 + Math.floor((v.estimulo - threshold) / 55 * 3) : 0;
      const delay = 0.16 + 0.16 * (1 - myelin);
      const centres = Array.from({ length: events }, (_, i) => delay + i * 0.18);
      const spike = x => {
        let peak = 0;
        let undershoot = 0;
        for (const centre of centres) {
          peak = Math.max(peak, Math.exp(-Math.pow((x - centre) / 0.019, 2)));
          undershoot = Math.max(undershoot, Math.exp(-Math.pow((x - centre - 0.055) / 0.025, 2)));
        }
        return 0.25 + 0.7 * peak - 0.12 * undershoot;
      };
      const postsynaptic = x => {
        let activity = 0;
        for (const centre of centres) {
          activity = Math.max(activity, Math.exp(-Math.pow((x - centre - 0.065) / 0.06, 2)));
        }
        return 0.25 + 0.5 * release * activity;
      };
      return finish({
        lines: [line('Axônio', COLORS.purple, spike), line('Pós-sinapse', COLORS.blue, postsynaptic)],
        xLabel: 'Sequência do sinal (tempo relativo)', yLabel: 'Potencial relativo; não é mV',
        result1: { label: 'Disparo', value: fires ? `${events} pulso${events > 1 ? 's' : ''}` : 'Sem disparo', note: 'Amplitude de cada pulso é fixa; limiar 45 apenas no desenho.' },
        result2: { label: 'Transmissão', value: index(fires ? release : 0), note: `Mielina: ${fmt(v.mielina)}/100; menor integridade aumenta atraso.` },
        explanation: `${fires
          ? 'O estímulo ultrapassou o limiar didático. Estímulos maiores aumentam a contagem ilustrativa de pulsos, preservando a amplitude de cada potencial de ação.'
          : 'O estímulo não atingiu o limiar didático; neste ensaio não há potencial de ação nem resposta sináptica causada por ele.'} ${release === 0 && fires
          ? 'O pulso pré-sináptico permanece, mas sem liberação dependente de Ca²⁺ não aparece o potencial pós-sináptico provocado por essa sinapse.'
          : 'A liberação dependente de Ca²⁺ modula a resposta pós-sináptica excitadora; ela não altera a amplitude do pulso que chegou ao terminal.'} O atraso é relativo, sem velocidade em m/s.`,
        state: { fires, pulseCount: events, myelin, synapticRelease: release, relativeDelay: delay },
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
      return finish({
        lines: [
          line('Pepsina + proteína', COLORS.amber, x => capacity * interpolate(pepsin, 1 + 8 * x)),
          line('Amilase + amido', COLORS.blue, x => capacity * interpolate(amylase, 1 + 8 * x)),
        ],
        xLabel: 'pH do ensaio: 1–9', yLabel: 'Atividade relativa (0–100)',
        result1: { label: 'Pepsina no pH atual', value: index(pepsinNow), note: `pH ${fmt(v.ph, 1)}; proteína como substrato.` },
        result2: { label: 'Amilase no pH atual', value: index(amylaseNow), note: `Enzima ${fmt(v.enzima)}/100; substrato ${fmt(v.substrato)}/100.` },
        explanation: `${enzyme === 0 || substrate === 0
          ? 'Sem enzima ou sem o substrato específico, o indicador de conversão fica zero neste ensaio.'
          : 'O pH muda a atividade; enzima e substrato controlam a conversão dentro de uma resposta limitada ilustrativa.'} As enzimas usam substratos diferentes. Os índices não permitem comparar suas velocidades absolutas, determinar Km ou aplicar uma dose de antiácido.`,
        state: { ph: v.ph, enzyme, substrate, relativePepsinActivity: pepsinNow, relativeAmylaseActivity: amylaseNow },
      });
    }

    case 'ciclo-ovariano': {
      const day = v.dia;
      const lh = v.sinal_lh / 100;
      const luteal = v.funcao_lutea / 100;
      // Zero disables this example's event; other values scale its illustration.
      // This is not a physiological LH threshold or a probability of ovulation.
      const eventEnabled = lh > 0;
      const estrogen = [[1,.15],[5,.20],[9,.50],[12,.90],[14,.50],[17,.35],[21,.55],[24,.40],[28,.10]];
      const lhProfile = [[1,.10],[5,.10],[9,.12],[12,.25],[14,1],[16,.12],[21,.10],[28,.10]];
      const progesterone = [[1,.05],[5,.05],[9,.05],[14,.10],[17,.50],[21,.85],[24,.65],[28,.05]];
      const p = d => eventEnabled ? interpolate(progesterone, d) * luteal : 0;
      let stage;
      if (day <= 5) stage = 'Menstrual inicial';
      else if (day < 14) stage = 'Folicular';
      else if (!eventEnabled) stage = 'Sem ovulação';
      else if (day < 15) stage = 'Ovulatória';
      else stage = 'Lútea';
      return finish({
        lines: [
          line('Estradiol', COLORS.pink, x => interpolate(estrogen, 1 + 27 * x)),
          line('LH', COLORS.purple, x => lh * interpolate(lhProfile, 1 + 27 * x)),
          line('Progesterona', COLORS.amber, x => p(1 + 27 * x)),
          { name: 'Dia escolhido', color: COLORS.muted, points: [[(day - 1) / 27, 0], [(day - 1) / 27, 1]] },
        ],
        xLabel: 'Dia do ciclo exemplar: 1–28', yLabel: 'Sinal hormonal relativo (0–100)',
        result1: { label: 'Fase do exemplo', value: stage, note: `Dia ${fmt(day)}; não é previsão de fase individual.` },
        result2: { label: 'Progesterona lútea', value: index(p(day)), note: eventEnabled ? `Função lútea: ${fmt(v.funcao_lutea)}/100.` : 'Sem evento ovulatório, não se forma o pico lúteo normal.' },
        explanation: eventEnabled
          ? `O pico de LH foi mantido no exemplo com amplitude ${fmt(v.sinal_lh)}/100. A fase lútea só sucede o evento ovulatório. ${luteal === 0 ? 'O controle de produção lútea está em zero; não aparece o suporte de progesterona típico dessa fase.' : 'A intensidade escolhida de função lútea modula o sinal de progesterona após a ovulação.'} As curvas mostram um ciclo exemplar inteiro, sem estimar janela fértil.`
          : 'O sinal de LH está em zero e desativa a ovulação neste cenário. Não se forma corpo lúteo nem pico de progesterona lútea normal. A curva de estradiol preserva apenas um traçado folicular comparativo; não é previsão hormonal de um ciclo anovulatório real. O início menstrual indicado é uma condição inicial, não uma consequência calculada desse cenário.',
        state: { day, stage, ovulationEnabled: eventEnabled, corpusLuteumShown: eventEnabled && day >= 15, relativeLutealSignal: p(day) },
      });
    }

    case 'sarcomero': {
      const calcium = v.calcio / 100;
      const atp = v.atp / 100;
      const frequency = (v.estimulos - 1) / 29;
      const locked = atp === 0;
      const drive = x => {
        const recruitment = 1 - Math.exp(-x * (1 + 6 * frequency) * (0.5 + 2 * atp));
        const recovery = Math.exp(-Math.max(0, x - 0.65) * (4 + 8 * atp));
        return recruitment * recovery;
      };
      // With ATP absent, retain a hypothetical pre-existing attached state.
      // Lack of ATP is not represented as an automatic relaxed state.
      const zDistance = x => locked ? 0.72 : 1 - 0.35 * calcium * drive(x);
      const contraction = locked ? 'Bloqueio / rigor possível' : calcium === 0 ? 'Sem ativação por Ca²⁺' : 'Ciclagem habilitada';
      return finish({
        lines: [line('Distância Z–Z', COLORS.pink, zDistance), line('Banda A', COLORS.purple, () => 0.6)],
        xLabel: 'Estímulo e recuperação (tempo relativo)', yLabel: 'Extensão relativa (0–100)',
        result1: { label: 'Estado das pontes', value: contraction, note: `Ca²⁺ ${fmt(v.calcio)}/100; ATP ${fmt(v.atp)}/100.` },
        result2: { label: 'Banda A', value: 'Constante', note: `${fmt(v.estimulos)} pulsos ilustrativos/s; filamentos não encurtam.` },
        explanation: locked
          ? 'Sem ATP não há ciclagem normal, desligamento energético das pontes ou recuperação ativa normal de Ca²⁺. O desenho retém uma posição com pontes previamente formadas, que podem permanecer presas: rigor possível. Não é uma previsão de rigidez instantânea nem de comprimento; mudar estímulos não supera o bloqueio energético.'
          : calcium === 0
            ? 'Sem ativação por Ca²⁺, os sítios da actina permanecem protegidos neste cenário. Há ATP, mas a sua presença isolada não inicia o encurtamento. Mais estímulos no controle não substituem a ativação por cálcio.'
            : 'Ca²⁺ habilita a exposição dos sítios; ATP permite ciclos e recuperação. Mais estímulos aproximados favorecem somação no traçado ilustrativo. ATP altera a dinâmica do desenho, sem estabelecer uma relação calibrada entre sua quantidade e força. Linhas Z aproximam-se, mas a banda A e os filamentos conservam extensão.',
        state: { calciumActivation: calcium, atpAvailable: atp, bridgeCyclingEnabled: !locked && calcium > 0, possibleRigor: locked, stimulation: v.estimulos },
      });
    }

    case 'termorregulacao': {
      const sweat = v.suor / 100;
      const skinFlow = v.vasodilatacao / 100;
      const capacity = humidity => (100 - humidity) / 90;
      const evaporation = sweat * capacity(v.umidade);
      return finish({
        lines: [
          line('Evaporação', COLORS.blue, x => sweat * capacity(10 + 85 * x)),
          line('Fluxo cutâneo', COLORS.pink, () => skinFlow),
        ],
        xLabel: 'Umidade relativa: 10–95%', yLabel: relativeAxis,
        result1: { label: 'Evaporação útil', value: index(evaporation), note: `Umidade ${fmt(v.umidade)}%; suor ${fmt(v.suor)}/100.` },
        result2: { label: 'Fluxo cutâneo', value: index(skinFlow), note: 'Condição fixa: ambiente mais frio que a pele.' },
        explanation: `${sweat === 0
          ? 'Sem suor disponível, esse mecanismo evaporativo fica ausente no desenho; outros mecanismos de troca ainda podem existir.'
          : 'Com a mesma produção de suor, maior umidade reduz a evaporação útil. Suor que escorre não dissipa o mesmo calor que suor evaporado.'} O controle de fluxo cutâneo representa uma via distinta de transferência, sob ambiente mais frio que a pele. As duas linhas são índices e não devem ser somadas como watts ou balanço térmico.`,
        state: { humidity: v.umidade, sweat, skinBloodFlow: skinFlow, relativeEvaporativeCooling: evaporation },
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
