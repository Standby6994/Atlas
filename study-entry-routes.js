// Reviewed entry points for the current tissue/cell reconstructions.
// A partial structure or a contextual view must not be presented as a complete
// geometric equivalent. Empty partIds intentionally mean no individual piece.
const route=(mode,partIds,scope,note)=>Object.freeze({mode,partIds:Object.freeze(partIds),scope,note});

export const STUDY_ENTRY_ROUTES=Object.freeze({
  nephron:route('histo-renal-tubules',[],'overview',
    'A vista compara cortes dos segmentos tubulares e do ducto coletor. Não mostra o trajeto contínuo de um néfron; o corpúsculo renal possui uma vista própria.'),
  glomerulus:route('histo-renal-corpuscle',['glomerulus'],'exact',
    'O destaque corresponde aos capilares glomerulares do corpúsculo renal.'),
  'bowman-capsule':route('histo-renal-corpuscle',['capsule'],'partial',
    'O destaque corresponde à folha parietal da cápsula glomerular. A folha visceral é formada pelos podócitos, disponíveis como outra peça da mesma vista.'),
  'proximal-tubule':route('histo-renal-tubules',['proximal'],'exact',
    'O destaque corresponde ao túbulo proximal em corte. A vista permite comparar seu epitélio com os outros segmentos; não representa sua trajetória contorcida completa.'),
  'henle-loop':route('histo-renal-tubules',['thin_limb'],'partial',
    'O destaque corresponde a um segmento delgado da alça em corte. Não representa a alça inteira nem individualiza os ramos descendente e ascendente ou o segmento ascendente espesso.'),
  'distal-tubule':route('histo-renal-tubules',['distal'],'exact',
    'O destaque corresponde ao túbulo distal em corte, comparado aos demais segmentos tubulares.'),
  'collecting-duct':route('histo-renal-tubules',['collecting'],'exact',
    'O destaque corresponde ao ducto coletor em corte. O sistema coletor recebe líquido de vários néfrons e é apresentado ao lado dos seus segmentos.'),
  alveoli:route('histo-alveolar-tissue',[],'overview',
    'A vista mostra espaços aéreos e septos alveolares com pneumócitos, capilares e macrófago. Selecione cada componente para identificar sua contribuição às trocas gasosas.'),
  neuron:route('histo-nervous-tissue',['neuron','dendrites','axon','terminal'],'exact',
    'O destaque reúne corpo celular, dendritos, axônio e terminal axônico do neurônio. Mielina e célula glial permanecem como componentes distintos no contexto.'),
  synapse:route('histo-nervous-tissue',['terminal'],'partial',
    'O destaque corresponde ao terminal axônico pré-sináptico. Esta peça não representa uma sinapse completa com fenda, vesículas e membrana pós-sináptica individualizadas.'),
  sarcomere:route('cyto-sarcomere',[],'overview',
    'A vista apresenta a unidade contrátil entre dois discos Z. Actina, miosina, linha M e regulação possuem peças próprias; cálcio e ATP são símbolos ampliados.'),
  skin:route('histo-skin',[],'overview',
    'A vista mostra um corte didático de pele espessa e a hipoderme associada. A hipoderme é tecido subcutâneo e não uma camada da pele propriamente dita.'),
  epidermis:route('histo-skin',['basal','living_layers','corneum','melanocyte'],'exact',
    'O destaque reúne os compartimentos epidérmicos representados: camada basal, camadas vivas, estrato córneo e melanócito.'),
  dermis:route('histo-skin',['dermis'],'exact',
    'O destaque corresponde ao tecido conjuntivo dérmico. Os vasos dérmicos são uma peça separada da mesma vista.'),
  'sweat-glands':route('histo-skin',[],'context',
    'Esta reconstrução da pele ainda não possui uma glândula sudorípara individualizada. A vista oferece contexto tecidual; nenhuma outra peça é destacada como se fosse a glândula.')
});

// Keep the five previous dropdown entry points usable without loading their
// older primitive scenes. Labels may change, but old IDs remain valid aliases.
export const LEGACY_STUDY_ENTRY_ALIASES=Object.freeze({
  'micro-nephron':'nephron',
  'micro-alveolar-unit':'alveoli',
  'micro-neuron':'neuron',
  'micro-sarcomere':'sarcomere',
  'micro-skin-section':'skin'
});

export function resolveStudyEntry(coreIdOrLegacyMode){
  if(typeof coreIdOrLegacyMode!=='string')return null;
  const key=Object.hasOwn(LEGACY_STUDY_ENTRY_ALIASES,coreIdOrLegacyMode)?LEGACY_STUDY_ENTRY_ALIASES[coreIdOrLegacyMode]:coreIdOrLegacyMode;
  return Object.hasOwn(STUDY_ENTRY_ROUTES,key)?STUDY_ENTRY_ROUTES[key]:null;
}
