# Cobertura das 51 vistas anatômicas — revisão v19

O Atlas dispõe de 51 vistas e 349 entradas de estruturas internas. A cobertura padrão desta revisão é de **dez cortes reconstruídos para ensino, 40 referências anatômicas e um esquema**. Isso não significa que todos os órgãos tenham interiores inteiramente modelados.

Os dez cortes autorais são coração (22 peças), ovário (15), testículo (7), vagina (5), rim (10), pulmões (9), estômago (9) delgado (9 peças de tecido e um contorno da luz), esôfago (5 camadas e um contorno) e intestino grosso (10 peças/recortes em duas escalas). São 101 entradas com geometria própria e dois contornos educativos de cavidades; estes não são tecido nem preenchimento sólido. Há 103 entradas nesses cortes ao incluir essas indicações de espaço. As 49 vistas que já contavam com referência anatômica continuam com suas fontes integradas, inclusive como alternativas quando há um corte autoral. O vaso linfático mantém um esquema educativo.

## Corpo feminino por sistemas

O seletor "Corpo feminino" abre um segundo corpo, com nove camadas, a partir do conjunto United Female v1.10 do Human Reference Atlas (Kristen Browne e Heidi Schlehlein, CC BY 4.0), feito com o Visible Human Female da National Library of Medicine. Os créditos e as alterações estão em [FEMALE_BODY_ATTRIBUTION.txt](models/FEMALE_BODY_ATTRIBUTION.txt); o inventário com nomes em português, hashes e posicionamento está em data/atlas-female-body.json.

| Camada | Peças | Triângulos | Arquivo(s) |
|---|---:|---:|---:|
| Esqueleto (parcial) | 65 | 272.639 | 1,04 MB |
| Órgãos e vísceras | 241 | 581.494 | 2,39 MB |
| Reprodutor feminino | 38 | 111.258 | 1,67 MB |
| Coração e vasos | 124 | 322.982 | 1,49 MB |
| Encéfalo, medula e olhos | 362 | 893.717 | 4,12 MB |
| Órgãos linfáticos | 14 | 75.542 | 0,33 MB |
| Músculos (olhos e joelhos) | 16 | 95.020 | 0,50 MB |
| Discos, cartilagens e ligamentos | 68 | 73.392 | 0,38 MB |
| Pele e mamas | 20 | 491.005 | 1,52 MB |
| **Total** | **948** | **2.917.049** | **13,4 MB** |

O reprodutor reaproveita o arquivo female-reproductive.glb (útero, colo, tubas e ovários, geometria idêntica à do conjunto) e acrescenta vagina, junção cervicovaginal, escavação vesicouterina e ligamentos. A placenta a termo ficou fora deste corpo. A fonte tinha 7.756.626 triângulos; a simplificação foi limitada a 0,05 mm de desvio de superfície, e as superfícies exportadas com normais por face (pele, boca, olhos, mucosas) receberam normais suaves. Não há textura fotográfica.

Limites: o esqueleto tem coluna (C1–L6; a doadora tem seis vértebras lombares), sacro, cóccix, ossos do quadril, esterno, manúbrio e a região dos joelhos; faltam crânio, costelas, clavículas, escápulas, membros superiores, mãos e pés. Os músculos são só os extrínsecos dos olhos e o reto femoral junto ao joelho. Não há nervos periféricos, estômago, esôfago, tireoide, suprarrenais nem vasos linfáticos. O linfonodo é um modelo mesentérico detalhado (Yao). Os dois corpos não são misturados: nenhum órgão masculino é encaixado no feminino.

## Resolução, textura e evidência

A exportação 4K gera uma imagem de 3840 × 2160 pixels. O coração Dundee tem três mapas incorporados de 2048 × 2048; os 27 arquivos do catálogo HRA não contêm imagens ou mapas de textura. Nenhuma textura fotográfica 4K de órgão foi confirmada. O acabamento procedural da anatomia é ilustrativo e compartilha um mapa de microvariação de 256 × 256; não deriva de fotografia ou escaneamento tecidual.

Os mapas de 4096 × 4096 da histologia são procedurais e pertencem às vistas histológicas, não a todos os órgãos macroscópicos. Fotografias de microscopia são recursos bidimensionais separados. Aumentar resolução não produz camada, vaso ou célula que falte na malha.

## Como interpretar correspondências e lacunas

A coluna de correspondências informa quantas das entradas canônicas têm uma ligação explicitamente revisada com um nó geométrico da referência. Ela é conservadora: nomes regionais disponíveis na fonte podem ainda não ter ligação canônica revisada. Portanto, zero não significa necessariamente ausência de toda anatomia interna.

As peças autorais são reconstruções educacionais, sem segmentação de espécime, escala clínica ou validação diagnóstica. Este inventário é estático: contagens de IDs e presença das fábricas não comprovam renderização. Os testes gráficos integrados de testículo/vagina na v14 e de rim/pulmões na v17 estão registrados separadamente em VALIDACAO.md e nos respectivos relatórios de navegador.

Há 65 registros explícitos entre fonte e entrada canônica, correspondentes a 54 IDs canônicos distintos; várias superfícies podem ligar-se à mesma entrada. A contagem por órgão na tabela considera as entradas distintas.

## Inventário por órgão

| Órgão | Vista padrão / origem de referência | Entradas canônicas | Correspondências explícitas na referência | Peças do corte autoral | Limite e próximo detalhe necessário |
|---|---|---:|---:|---:|---|
| Coração | Corte autoral / HRA | 22 | 9 | 22 | Reconstrução educacional; o corte não altera nem completa a segmentação das fontes originais. Validar contornos, continuidade e aparência de valvas, cordas e trabéculas; expandir sistema coronariano sem alterar fontes originais. |
| Pulmões | Corte autoral / HRA | 9 | 0 | 9 | Reconstrução educacional; o corte não altera nem completa a segmentação das fontes originais. Corte autoral com árvore condutora contínua e vasos selecionáveis. Ampliar transição acinar/alveolar em escala separada e verificar identificação regional mais fina. |
| Rim | Corte autoral / HRA | 10 | 2 | 10 | Reconstrução educacional; o corte não altera nem completa a segmentação das fontes originais. Corte autoral com sistema coletor e regiões renais selecionáveis. Acrescentar o néfron longitudinal em escala própria e aprofundar a rede vascular microscópica. |
| Fígado | Referência anatômica / HRA | 7 | 1 | 0 | Lobos, superfícies, impressões e ligamentos; não lóbulos/sinusoides microscópicos. Adicionar unidades portais, lóbulos, sinusoides e vias biliares com escala e direção de fluxo declaradas. |
| Estômago | Corte autoral / Z-Anatomy | 9 | 0 | 9 | Reconstrução educacional; o corte não altera nem completa a segmentação das fontes originais. Separar mucosa, submucosa e muscular externa com glândulas regionais reconhecíveis. |
| Intestino delgado | Corte autoral / HRA | 10 | 3 | 9 | Reconstrução educacional; o corte não altera nem completa a segmentação das fontes originais. Modelar camadas, criptas e vilosidades, distinguindo duodeno, jejuno e íleo. |
| Intestino grosso | Corte autoral / HRA | 10 | 7 | 10 | Reconstrução educacional; o corte não altera nem completa a segmentação das fontes originais. Trajeto regional contínuo, saculações, tênias e janela da mucosa sem vilosidades. Ampliar camadas da parede e tecido linfoide do apêndice em escala própria. |
| Pâncreas | Referência anatômica / HRA | 7 | 3 | 0 | Cabeça, colo, corpo, cauda e processo uncinado; não ilhotas nem ácinos. Separar sistema ductal, ácinos e ilhotas, distinguindo secreção exócrina e endócrina. |
| Vesícula biliar | Referência anatômica / Z-Anatomy | 6 | 0 | 0 | Extração macroscópica do acervo corporal; não comprova camadas histológicas ou todos os componentes internos. Completar mucosa pregueada, parede muscular e conexões ductais verificadas. |
| Esôfago | Corte autoral / Z-Anatomy | 6 | 0 | 5 | Reconstrução educacional; o corte não altera nem completa a segmentação das fontes originais. Corte com cinco camadas selecionáveis e luz vazia sinalizada. Ampliar glândulas/ductos e comunicação com o epitélio em escala histológica. |
| Bexiga urinária | Referência anatômica / HRA | 6 | 2 | 0 | Colo, fundo, trígono e óstios ureterais; não verificar células ou camadas por estes nós. Individualizar detrusor, urotélio e relações do trígono, sem inferir camadas a partir de rótulos regionais. |
| Encéfalo | Referência anatômica / HRA | 8 | 4 | 0 | Atlas Allen: estruturas regionais internas, ventrículos, substância branca, núcleos e giros. Anatomia espelhada e reescalada conforme documentação. Revisar correspondências regionais e trajetos; esclarecer escala, espelhamento e origem de atlas. |
| Medula espinal | Referência anatômica / HRA | 7 | 0 | 0 | Segmentos cervicais, torácicos, lombares e sacrais; não secção transversal com cornos/tractos detalhados. Adicionar secção transversal com cornos, funículos e raízes identificáveis. |
| Olho | Referência anatômica / HRA | 10 | 8 | 0 | Retina, íris, cristalino, humores, córnea, coroide, esclera, corpo ciliar e ligamento suspensor; componentes internos separáveis. Completar correspondências anatômicas explícitas e ligar retina e segmentos anteriores à microestrutura apropriada. |
| Orelha | Referência anatômica / Z-Anatomy | 9 | 4 | 0 | Extração macroscópica do acervo corporal; não comprova camadas histológicas ou todos os componentes internos. Incorporar ossículos e órgão de Corti, diferenciando componentes auditivos e vestibulares. |
| Tireoide | Referência anatômica / Z-Anatomy | 5 | 0 | 0 | Extração macroscópica do acervo corporal; não comprova camadas histológicas ou todos os componentes internos. Individualizar cápsula, vascularização e folículos com epitélio e coloide. |
| Suprarrenal | Referência anatômica / Z-Anatomy | 6 | 0 | 0 | Extração macroscópica do acervo corporal; não comprova camadas histológicas ou todos os componentes internos. Separar zonas corticais e medula com camadas e vasos identificáveis. |
| Hipófise | Referência anatômica / Z-Anatomy | 5 | 0 | 0 | Extração macroscópica do acervo corporal; não comprova camadas histológicas ou todos os componentes internos. Completar correspondências das duas porções, sistema porta, haste e terminações neurosecretoras. |
| Testículo | Corte autoral / Z-Anatomy | 7 | 0 | 7 | Reconstrução educacional; o corte não altera nem completa a segmentação das fontes originais. Conferir renderização do corte autoral e organização de túbulos, rede, dúctulos e epidídimo; verificar textura e seleção. |
| Ovário | Corte autoral / HRA | 15 | 0 | 15 | Reconstrução educacional; o corte não altera nem completa a segmentação das fontes originais. Validar camadas foliculares e relações entre estágios; corpo lúteo deve permanecer um estágio comparativo. |
| Útero | Referência anatômica / HRA | 7 | 2 | 0 | Corpo, fundo, paredes, colo e óstios cervicais; não assumir camadas endometriais/cavidade verdadeira só por rótulos. Adicionar corte com endométrio, miométrio e cavidade, separando colo e corpo. |
| Próstata | Referência anatômica / HRA | 5 | 2 | 0 | Zonas periférica/central/transição, estroma anterior, ductos e estruturas relacionadas. Revisar zonas, estroma, uretra e conexões ductais, sem confundir zona macroscópica com ácino. |
| Pele | Referência anatômica / HRA | 8 | 0 | 0 | Apenas superfície corporal; não epiderme/derme/anexos microscópicos. Separar camadas e anexos; a superfície corporal de referência não contém a histologia cutânea completa. |
| Músculo esquelético | Referência anatômica / Z-Anatomy | 8 | 0 | 0 | Extração macroscópica do acervo corporal; não comprova camadas histológicas ou todos os componentes internos. Modelar fascículos, bainhas conjuntivas e arquitetura intramuscular; distinguir bíceps de todos os músculos. |
| Osso | Referência anatômica / Z-Anatomy | 7 | 0 | 0 | Extração macroscópica do acervo corporal; não comprova camadas histológicas ou todos os componentes internos. Adicionar matriz cortical/trabecular, medula e superfícies de remodelação; o fêmur não representa todos os ossos. |
| Linfonodo | Referência anatômica / HRA | 8 | 6 | 0 | Modelo mesentérico Yao: cápsula, folículos, medula, domínio T e vasos aferentes/eferentes; não deriva automaticamente de Visible Human. Revisar identidade dos domínios celulares e trajeto dos seios; separar malha regional de uma célula específica. |
| Baço | Referência anatômica / HRA | 6 | 0 | 0 | Superfícies e hilo; não polpa vermelha/branca real. Adicionar polpa branca e vermelha com cordões e sinusoides. |
| Timo | Referência anatômica / HRA | 5 | 0 | 0 | Órgão e lobos direito/esquerdo; não lóbulos/córtex/medula/corpúsculos reais. Adicionar lóbulos com córtex, medula, células epiteliais e corpúsculos de Hassall. |
| Traqueia | Referência anatômica / HRA | 5 | 1 | 0 | Traqueia, cartilagem e carina; não epitélio ciliado microscópico. Completar mucosa, submucosa, cartilagem e músculo posterior. |
| Pênis | Referência anatômica / Z-Anatomy | 6 | 0 | 0 | Extração macroscópica do acervo corporal; não comprova camadas histológicas ou todos os componentes internos. Revisar corpos eréteis, túnicas e uretra; representar tecido vascular erétil de forma contínua. |
| Cavidade nasal | Referência anatômica / Z-Anatomy | 5 | 0 | 0 | Extração macroscópica do acervo corporal; não comprova camadas histológicas ou todos os componentes internos. Completar septo, conchas e interfaces respiratória/olfatória sem confundi-las. |
| Laringe | Referência anatômica / HRA | 6 | 0 | 0 | Estruturas macroscópicas identificadas no crosswalk; não modelo histológico nem fotografia. Revisar cartilagens, músculos, pregas e luz; relacionar a mucosa às diferentes regiões. |
| Ureter | Referência anatômica / HRA | 5 | 0 | 0 | Estruturas macroscópicas identificadas no crosswalk; não modelo histológico nem fotografia. Adicionar camadas da parede e pregas epiteliais, sem atribuir filtração à via coletora. |
| Uretra | Referência anatômica / Z-Anatomy | 5 | 0 | 0 | Extração macroscópica do acervo corporal; não comprova camadas histológicas ou todos os componentes internos. Representar as transições de epitélio e a organização dos esfíncteres. |
| Boca e dente em corte | Referência anatômica / HRA | 6 | 0 | 0 | Boca, língua, dentes, mandíbula, gengiva e glândulas salivares macroscópicas; sem corte histológico do dente. Adicionar dente em corte com esmalte, dentina e polpa; fonte macroscópica não é um corte dentário histológico. |
| Glândula salivar | Referência anatômica / Z-Anatomy | 5 | 0 | 0 | Extração macroscópica do acervo corporal; não comprova camadas histológicas ou todos os componentes internos. Separar ácinos e ductos e representar diferenças entre glândulas e secreções. |
| Paratireoide | Referência anatômica / Z-Anatomy | 5 | 0 | 0 | Extração macroscópica do acervo corporal; não comprova camadas histológicas ou todos os componentes internos. Adicionar arquitetura glandular, vasos e composição celular com cautela sobre células oxífilas. |
| Glândula pineal | Referência anatômica / Z-Anatomy | 5 | 0 | 0 | Extração macroscópica do acervo corporal; não comprova camadas histológicas ou todos os componentes internos. Adicionar organização de pinealócitos, glia e estroma sem criar equivalência com uma glândula folicular. |
| Epidídimo | Referência anatômica / Z-Anatomy | 5 | 0 | 0 | Extração macroscópica do acervo corporal; não comprova camadas histológicas ou todos os componentes internos. Representar túbulo, parede e transições regionais; distinguir estereocílios de cílios móveis. |
| Ducto deferente | Referência anatômica / Z-Anatomy | 5 | 0 | 0 | Extração macroscópica do acervo corporal; não comprova camadas histológicas ou todos os componentes internos. Adicionar mucosa e camadas musculares espessas com continuidade anatômica. |
| Vesícula seminal | Referência anatômica / Z-Anatomy | 5 | 0 | 0 | Extração macroscópica do acervo corporal; não comprova camadas histológicas ou todos os componentes internos. Adicionar pregas mucosas, epitélio secretor e musculatura, sem representar como reservatório de espermatozoides. |
| Vagina | Corte autoral / sem referência anatômica integrada | 5 | 0 | 5 | Reconstrução educacional; o corte não altera nem completa a segmentação das fontes originais. Conferir renderização do corte autoral, pregas e camadas; preservar relações entre epitélio, lâmina própria e musculatura. |
| Tuba uterina | Referência anatômica / HRA | 5 | 0 | 0 | Estruturas macroscópicas identificadas no crosswalk; não modelo histológico nem fotografia. Adicionar mucosa pregueada e distribuição regional de células ciliadas/secretoras. |
| Glândula mamária | Referência anatômica / HRA | 5 | 0 | 0 | Mama com lobos, ducto lactífero, seio, aréola e gordura; sem alvéolos microscópicos de lactação. Adicionar unidades alveolares e ductais, distinguindo estados secretórios e estroma. |
| Placenta | Referência anatômica / HRA | 6 | 0 | 0 | Placenta, placas, âmnio e cordão/vasos; sem vilosidades microscópicas individuais. Representar vilosidades e barreira materno-fetal com compartimentos sanguíneos separados. |
| Tonsila palatina | Referência anatômica / HRA | 5 | 0 | 0 | Estruturas macroscópicas identificadas no crosswalk; não modelo histológico nem fotografia. Adicionar criptas, epitélio e tecido linfoide com arquitetura reconhecível. |
| Articulação sinovial | Referência anatômica / HRA | 6 | 0 | 0 | Joelho esquerdo como exemplo de articulação sinovial; não representa todas as articulações nem sarcômeros/músculos. Individualizar cartilagem, sinóvia, cápsula, ligamentos e cavidade; o exemplo de joelho não representa todas as articulações. |
| Nervo periférico | Referência anatômica / Z-Anatomy | 5 | 0 | 0 | Extração macroscópica do acervo corporal; não comprova camadas histológicas ou todos os componentes internos. Adicionar fascículos e envoltórios com mielina e axônios individualizados. |
| Artéria, veia e capilar | Referência anatômica / Z-Anatomy | 6 | 0 | 0 | Extração macroscópica do acervo corporal; não comprova camadas histológicas ou todos os componentes internos. Separar íntima, média e adventícia e comparar artéria, veia e capilar. |
| Vaso linfático | Esquema / sem referência anatômica integrada | 5 | 0 | 0 | Esquema educacional sem referência anatômica correspondente integrada. Substituir esquema por parede e valvas contínuas verificadas, diferenciando capilar inicial e coletor. |
| Diafragma | Referência anatômica / Z-Anatomy | 5 | 0 | 0 | Extração macroscópica do acervo corporal; não comprova camadas histológicas ou todos os componentes internos. Individualizar porções musculares, centro tendíneo e hiatos, mantendo aberturas como espaços. |

## Sistemática: organismos 3D

Reconstruções autorais geradas no aparelho (sem arquivo de malha baixado), em `systematics-*.js`. Não são escaneamentos de espécimes; cores, espessuras de envoltórios, padrões moleculares e o número de estruturas repetidas são didáticos. Contagens medidas em 2026-10-17 (desktop / toque).

| Grupo | Organismo | Partes | Triângulos | Limites declarados |
|---|---|---|---|---|
| Bacteria | Escherichia coli | 10 | 327.810 / 110.720 | Envoltório espessado, flagelos encurtados, amostra de ribossomos e fímbrias; célula real quase incolor. |
| Archaea | Halobacterium salinarum | 9 | 334.880 / 113.398 | Rede da camada S e nervuras das vesículas de gás ampliadas; cor lembra carotenoides. |
| Eukarya (protozoários) | Paramecium caudatum | 12 | 621.569 / 79.664 | Menos cílios que os reais, relevo da película ampliado, organelas em tamanhos aproximados. |

Os outros 19 grupos da árvore têm classificação e fisiologia comparada em `data/systematics-content.json`, sem modelo 3D próprio por enquanto; mamíferos abrem o corpo humano do Atlas.

## Verificação técnica e limites

Os 36 arquivos GLB foram inspecionados diretamente: cabeçalho, metadados de geometria, imagens incorporadas, tamanho e SHA-256. Seus hashes são comparados ao manifesto distribuído. As correspondências explicitadas em organ-detail.json foram aceitas apenas quando o nó com sourceName contém geometria no arquivo usado pela vista.

A auditoria é reproduzível por qa-organ-coverage-v19.py e seu relatório qa-organ-coverage-v19.json. O inventário legível pelo aplicativo está em data/organ-model-coverage.json. Testes de fluxo, seleção, exportação, aparelho físico e aparência biológica não são substituídos por este inventário.
