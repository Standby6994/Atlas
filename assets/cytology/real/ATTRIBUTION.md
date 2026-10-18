# Modelos reais da citologia — créditos

Gerado por `tools/cytology/register.mjs`. Cada vista abaixo usa dados de repositórios científicos abertos ou é um modelo autoral feito a partir de dimensões publicadas (indicado em cada item); as alterações feitas para o Atlas estão descritas em cada item.

## Transporte ativo (`active-transport`)

Membrana montada com moléculas reais (POPC e colesterol do dicionário de componentes do PDB) contendo a bomba de sódio e potássio (Na⁺/K⁺-ATPase de rim de porco, PDB 3WGU: subunidades α, β e γ) e o cotransportador sódio–galactose de Vibrio parahaemolyticus (PDB 3DH4), parente bacteriano dos cotransportadores de glicose humanos. ATP e glicose vêm do dicionário do PDB. Íons aparecem como esferas do tamanho do íon hidratado: Na⁺ lilás (mais fora), K⁺ roxo (mais dentro), H₃O⁺ azul-claro no gradiente de prótons. Números de íons e moléculas são ilustrativos; concentrações reais diferem em ordens de grandeza.

- Protein Data Bank — 3WGU, 3DH4, CCD POV, CCD CLR, CCD ATP, CCD GLC — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 3WGU (https://doi.org/10.2210/pdb3wgu/pdb); PDB 3DH4 (https://doi.org/10.2210/pdb3dh4/pdb); Chemical Component Dictionary POV; Chemical Component Dictionary CLR; Chemical Component Dictionary ATP; Chemical Component Dictionary GLC
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Célula animal (`animal-cell`)

Célula HeLa real (linhagem humana de câncer de colo do útero, em cultura), imageada por microscopia eletrônica FIB-SEM com voxels de 4 nm e segmentada por aprendizado de máquina (OpenOrganelle, HHMI Janelia, CC BY 4.0). A membrana plasmática aparece translúcida para mostrar o interior; a célula, aderida a uma lâmina, é achatada (cerca de 48 × 33 µm de largura e 6 µm de altura); o envelope nuclear, que a fonte segmenta junto com o retículo, foi retirado do retículo; malhas reduzidas para o aparelho. Retículo rugoso e liso não vêm separados na fonte: aqui, o retículo junto ao núcleo aparece como rugoso e o periférico como liso, uma aproximação didática. Lisossomos e endossomos foram segmentados juntos; aparecem os ~900 maiores, e das ~40 mil vesículas, as 2 500 maiores. Ribossomos livres e citosol não têm malha própria nesta escala (ribossomos medem ~25 nm).

- OpenOrganelle — jrc_hela-2 — HHMI Janelia Research Campus (COSEM Project Team). Licença: CC BY 4.0. https://openorganelle.janelia.org/datasets/jrc_hela-2
  - Heinrich L. et al. Whole-cell organelle segmentation in volume electron microscopy. Nature 599, 141–146 (2021); Xu C.S. et al. An open-access volume electron microscopy atlas of whole cells and tissues. Nature 599, 147–151 (2021).
  - Alterações: Malhas reduzidas (simplificação por erro quádrico), recortadas para o corte didático e coloridas por compartimento.

## Apoptose e controle da proliferação (`apoptosis-cancer`)

Montagem com estruturas reais: apoptossomo humano (PDB 5JUY) — a roda de Apaf-1 com o citocromo c liberado da mitocôndria (o sinal) e a caspase-9 ativada —, caspase-3 executora com um inibidor peptídico (PDB 1PAU) e p53 ligada ao DNA (PDB 1TSR), o guardião dos pontos de controle. O DNA danificado é dupla hélice B construída de um passo real (PDB 1BNA) com uma quebra. Corpos apoptóticos, a membrana do fagócito e a célula em divisão são desenhados com uma conta por lipídio, em escala reduzida de detalhe. Escalas e distâncias ilustrativas.

- Protein Data Bank — 5JUY, 1PAU, 1TSR, 1BNA — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 5JUY (https://doi.org/10.2210/pdb5juy/pdb); PDB 1PAU (https://doi.org/10.2210/pdb1pau/pdb); PDB 1TSR (https://doi.org/10.2210/pdb1tsr/pdb); PDB 1BNA (https://doi.org/10.2210/pdb1bna/pdb)
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Célula bacteriana (`bacterial-cell`)

Bactéria em forma de bastonete (como Escherichia coli, ~1,6 × 0,6 µm aqui encurtada) aberta ao meio, montada em escala molecular reduzida: membranas externa e interna e o peptidoglicano entre elas desenhados com uma conta por lipídio ou unidade de parede; centenas de ribossomos com a forma real do ribossomo bacteriano (PDB 4V51, uma conta por resíduo); o nucleoide como fibra de DNA enovelada (ilustrativa) no centro; um plasmídeo em anel; e o flagelo com o motor e o gancho reais de Salmonella (PDB 7CGO) e o filamento de flagelina (PDB 1UCU) por simetria helicoidal. A cápsula aparece como uma camada externa difusa. Quantidades e densidades são ilustrativas; proteínas solúveis e outros componentes foram omitidos.

- Protein Data Bank — 4V51, 7CGO, 1UCU — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 4V51 (https://doi.org/10.2210/pdb4v51/pdb); PDB 7CGO (https://doi.org/10.2210/pdb7cgo/pdb); PDB 1UCU (https://doi.org/10.2210/pdb1ucu/pdb)
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Água e ambiente molecular (`biomolecules-water`)

Moléculas de água com seus hidrogênios (dicionário de componentes do PDB; O vermelho, H branco), arranjadas como no líquido, com as ligações de hidrogênio entre moléculas vizinhas desenhadas como traços. Ao lado: íons Na⁺ e Cl⁻ cada um com sua camada de hidratação (a água vira o oxigênio para o cátion e os hidrogênios para o ânion) e um pedaço de gelo com a rede hexagonal regular, que explica a menor densidade do gelo. A molécula ampliada destaca a polaridade (δ− no oxigênio, δ+ nos hidrogênios). Posições ilustrativas, sem simulação molecular.

- Protein Data Bank —  — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - 
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Ciclo de Calvin (`calvin-cycle`)

Rubisco de espinafre completa (oito subunidades grandes e oito pequenas, montagem biológica da estrutura PDB 8RUC, com o análogo de intermediário 2-carboxiarabinitol-bisfosfato no sítio ativo) cercada pelos metabólitos do ciclo de Calvin do dicionário de componentes do PDB: CO₂, ribulose-1,5-bisfosfato (RuBP), 3-fosfoglicerato, gliceraldeído-3-fosfato, ATP e NADPH. Os metabólitos estão em anéis que lembram a ordem do ciclo; quantidades e distâncias são ilustrativas. As demais enzimas do ciclo não foram incluídas; a regeneração da RuBP aparece como uma fila de moléculas de RuBP saindo do anel.

- Protein Data Bank — 8RUC, CCD CO2, CCD RUB, CCD 3PG, CCD G3H, CCD ATP, CCD NDP — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 8RUC (https://doi.org/10.2210/pdb8ruc/pdb); Chemical Component Dictionary CO2; Chemical Component Dictionary RUB; Chemical Component Dictionary 3PG; Chemical Component Dictionary G3H; Chemical Component Dictionary ATP; Chemical Component Dictionary NDP
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Carboidratos e lipídios (`carbohydrates-lipids`)

Moléculas do dicionário de componentes do PDB em cores por elemento (C cinza, O vermelho, P laranja): glicose (monossacarídeo), uma cadeia de amilose montada com glicoses em hélice (polissacarídeo de reserva, ~6 resíduos por volta), triacilglicerol (triestearina), fosfatidilcolina (POPC), colesterol e os ácidos graxos palmítico (saturado, reto) e oleico (insaturado, com dobra). Geometria das moléculas isoladas, sem interação entre elas.

- Protein Data Bank — CCD GLC, CCD TGL, CCD POV, CCD CLR, CCD PLM, CCD OLA — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - Chemical Component Dictionary GLC; Chemical Component Dictionary TGL; Chemical Component Dictionary POV; Chemical Component Dictionary CLR; Chemical Component Dictionary PLM; Chemical Component Dictionary OLA
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Cardiomiócito: célula muscular cardíaca (`cardiomyocyte`)

Modelo autoral em 3D de um trecho de cardiomiócito ventricular (cerca de 40 µm de comprimento e 16 × 11 µm de seção), com uma ramificação e o disco intercalar que o une à célula vizinha. Corte em degrau: na metade de baixo, o plano corta as miofibrilas, mostrando as faixas dos sarcômeros (linhas Z, bandas I e A, zona H e linha M, período de ~1,9 µm), e as mitocôndrias, com cristas densas; na metade de cima, o corte é mais fundo e mostra as superfícies: retículo sarcoplasmático em rede ao redor das miofibrilas, túbulos T entrando na altura das linhas Z e díades (cisterna do retículo junto ao túbulo T) com canais de Ca²⁺ do tipo L e RyR2. Bombas SERCA aparecem como pontos no retículo. No disco intercalar, as faces transversais concentram junções aderentes e desmossomos, e as longitudinais, junções comunicantes. Canais, bombas e junções estão muito ampliados (dezenas de vezes) para serem vistos; quantidades são ilustrativas.

- Modelo autoral do Atlas Humano — Atlas Humano. Licença: mesma licença do projeto. https://github.com/Standby6994/Atlas
  - Geometria modelada a partir de dimensões publicadas (ver as observações da vista).
  - Base: Geometria modelada a partir de dimensões publicadas de cardiomiócitos ventriculares (sarcômero de ~1,9 µm, miofibrilas de ~1 µm, mitocôndrias de ~1–2 µm, túbulos T de ~0,2 µm).

## Ciclo celular (`cell-cycle`)

Modelo autoral em 3D do ciclo celular de uma célula animal típica, com as fases dispostas num anel: G1 (célula menor, um centrossomo, cromatina descondensada), S (DNA sendo duplicado: focos de replicação em verde no núcleo; o centrossomo também se duplica), G2 (célula maior, dois centrossomos) e M (mitose, aqui na metáfase). Os pontos de controle aparecem como portões no caminho: em G1 (antes da replicação), em G2 (antes da divisão) e o de ligação ao fuso, dentro da mitose, antes da anáfase. Tamanhos de células e núcleos são aproximados; microtúbulos e centríolos ampliados; durações das fases não estão representadas.

- Modelo autoral do Atlas Humano — Atlas Humano. Licença: mesma licença do projeto. https://github.com/Standby6994/Atlas
  - Geometria modelada a partir de dimensões publicadas (ver as observações da vista).
  - Base: Geometria modelada a partir de dimensões publicadas de células animais em cultura (~15–20 µm).

## Diferenciação celular (`cell-differentiation`)

Modelo autoral em 3D sobre diferenciação celular: uma célula-tronco no seu nicho (células de apoio, fibras da matriz extracelular e moléculas sinalizadoras) dá origem, por etapas, a células especializadas — neurônio, fibra muscular esquelética (multinucleada, estriada), célula epitelial absortiva (com microvilosidades) e adipócito (com uma grande gota de gordura). Todos os núcleos guardam o mesmo genoma: os territórios cromossômicos têm as mesmas cores e posições; o que muda é o estado da cromatina (territórios compactados, em roxo escuro, diferentes em cada tipo celular). A rede de regulação gênica aparece como um esquema de nós (fatores de transcrição) e ligações sobre a célula-tronco. Territórios, rede e quantidades são representações didáticas, não medidas.

- Modelo autoral do Atlas Humano — Atlas Humano. Licença: mesma licença do projeto. https://github.com/Standby6994/Atlas
  - Geometria modelada a partir de dimensões publicadas (ver as observações da vista).
  - Base: Geometria modelada a partir de formas e dimensões publicadas de células humanas (neurônio, fibra muscular, enterócito, adipócito).

## Junções celulares (`cell-junctions`)

Pares de membranas de células vizinhas (POPC e colesterol do dicionário de componentes do PDB) com a distância de cada junção e suas proteínas reais: claudina-15 (PDB 4P79) na junção oclusiva, onde as membranas quase se tocam; caderinas (ectodomínio da caderina C, PDB 1L3W) atravessando ~25 nm na junção aderente, ligadas por dentro a filamentos de actina (PDB 6BNO); caderinas e uma placa densa ligada a filamentos intermediários (vimentina, PDB 3UF1) no desmossomo; o canal de conexina-26 (PDB 2ZW3) unindo as duas membranas na junção comunicante; colágeno (PDB 1BKV) e fibronectina (PDB 1FNF) na matriz extracelular. O plasmodesmo vegetal é um canal revestido de membrana atravessando uma parede de fibras de celulose ilustrativas, com o desmotúbulo no centro. Distâncias reais aproximadas; quantidades ilustrativas.

- Protein Data Bank — 1L3W, 4P79, CCD POV, CCD CLR, 2ZW3, 6BNO, 3UF1, 1BKV, 1FNF — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 1L3W (https://doi.org/10.2210/pdb1l3w/pdb); PDB 4P79 (https://doi.org/10.2210/pdb4p79/pdb); Chemical Component Dictionary POV; Chemical Component Dictionary CLR; PDB 2ZW3 (https://doi.org/10.2210/pdb2zw3/pdb); PDB 6BNO (https://doi.org/10.2210/pdb6bno/pdb); PDB 3UF1 (https://doi.org/10.2210/pdb3uf1/pdb); PDB 1BKV (https://doi.org/10.2210/pdb1bkv/pdb); PDB 1FNF (https://doi.org/10.2210/pdb1fnf/pdb)
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Sinalização celular (`cell-signaling`)

Via do AMP cíclico montada com moléculas reais: receptor β2-adrenérgico acoplado à proteína Gs (PDB 3SN6; a lisozima de fusão e o nanocorpo da cristalização foram retirados), adrenalina (epinefrina), cAMP e ATP do dicionário de componentes do PDB, adenilato ciclase com Gαs (PDB 1AZS), proteína quinase A (subunidade catalítica com ATP, PDB 1ATP), fosfodiesterase 4D com cAMP (PDB 2PW3), que encerra o sinal, e o fator de transcrição CREB ligado ao DNA (PDB 1DH3), mais abaixo, representando a resposta no núcleo. Membrana de POPC e colesterol. Distâncias e quantidades são ilustrativas.

- Protein Data Bank — 3SN6, 1AZS, CCD POV, CCD CLR, CCD ALE, CCD CMP, 1ATP, 2PW3, 1DH3 — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 3SN6 (https://doi.org/10.2210/pdb3sn6/pdb); PDB 1AZS (https://doi.org/10.2210/pdb1azs/pdb); Chemical Component Dictionary POV; Chemical Component Dictionary CLR; Chemical Component Dictionary ALE; Chemical Component Dictionary CMP; PDB 1ATP (https://doi.org/10.2210/pdb1atp/pdb); PDB 2PW3 (https://doi.org/10.2210/pdb2pw3/pdb); PDB 1DH3 (https://doi.org/10.2210/pdb1dh3/pdb)
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Cloroplasto (`chloroplast`)

Modelo autoral em 3D de um cloroplasto de folha (cerca de 5,4 × 3 × 2,2 µm), aberto ao longo do comprimento. As dimensões seguem medidas publicadas: grana com 450–600 nm de diâmetro e tilacoides empilhados a cada ~21 nm, espaçamento medido nos tomogramas crioeletrônicos de cloroplastos intactos de espinafre do EMPIAR-12612 (Wietrzynski et al., CC0). Cada granum é uma pilha de tilacoides em forma de disco ligados por lamelas do estroma inclinadas, que contornam as pilhas. Nos grana cortados aparecem as duas membranas de cada tilacoide e o lúmen entre elas. A distância entre as membranas externa e interna do envelope foi ampliada para ficar visível. Número e posição de grana, grãos de amido, plastoglóbulos, nucleoides e ribossomos são ilustrativos.

- Modelo autoral do Atlas Humano — Atlas Humano. Licença: mesma licença do projeto. https://github.com/Standby6994/Atlas
  - Geometria modelada a partir de dimensões publicadas (ver as observações da vista).
  - Base: Geometria modelada; medidas de referência dos tomogramas de cloroplastos de espinafre (Wietrzynski W. et al., Molecular architecture of thylakoid membranes within intact spinach chloroplasts, bioRxiv 2024, doi:10.1101/2024.11.24.625035; dados EMPIAR-12612, CC0).

## Cílios e flagelos (`cilia-flagella`)

Cílio móvel em corte: o axonema 9+2 montado com contas por resíduo da tubulina real (PDB 6DPU) — nove duplas de microtúbulos e o par central —, braços de dineína do motor completo de dineína (PDB 3VKH) e a membrana desenhada com uma conta por lipídio, vistos em corte transversal (o padrão 9+2); abaixo, o corpúsculo basal com nove trios. O flagelo eucariótico, à direita, tem a mesma organização 9+2. O cílio primário, sensorial, tem arranjo 9+0, sem par central nem dineína. O flagelo bacteriano é outra máquina: motor e gancho de Salmonella (PDB 7CGO) e um trecho do filamento de flagelina (PDB 1UCU, por simetria helicoidal). Comprimentos reduzidos; detalhes em escala de contas.

- Protein Data Bank — 6DPU, 3VKH, 7CGO, 1UCU — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 6DPU (https://doi.org/10.2210/pdb6dpu/pdb); PDB 3VKH (https://doi.org/10.2210/pdb3vkh/pdb); PDB 7CGO (https://doi.org/10.2210/pdb7cgo/pdb); PDB 1UCU (https://doi.org/10.2210/pdb1ucu/pdb)
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Citoesqueleto (`cytoskeleton`)

Filamentos do citoesqueleto montados a partir de estruturas reais: filamento de actina por simetria helicoidal de uma subunidade da estrutura de crio-microscopia PDB 6BNO (27,6 Å e −166,6° por subunidade), microtúbulo de 13 protofilamentos com o dímero de tubulina α/β da PDB 6DPU (8 nm por dímero), filamentos intermediários com dímeros em hélice dupla de vimentina (fragmento PDB 3UF1) enrolados como corda, cinesina-1 dimérica (PDB 3KIN) caminhando sobre o microtúbulo e puxando uma vesícula, e, representando o centrossomo, o complexo em anel de γ-tubulina humano (PDB 6V6S), que nucleia o microtúbulo e fica na sua extremidade menos. A vesícula é desenhada com uma conta por lipídio, em escala reduzida de detalhe; comprimentos e quantidades são ilustrativos.

- Protein Data Bank — 6BNO, 6DPU, 3KIN, 3UF1, 6V6S — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 6BNO (https://doi.org/10.2210/pdb6bno/pdb); PDB 6DPU (https://doi.org/10.2210/pdb6dpu/pdb); PDB 3KIN (https://doi.org/10.2210/pdb3kin/pdb); PDB 3UF1 (https://doi.org/10.2210/pdb3uf1/pdb); PDB 6V6S (https://doi.org/10.2210/pdb6v6s/pdb)
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Difusão simples e facilitada (`diffusion-facilitated`)

Membrana montada com moléculas reais (POPC e colesterol do dicionário de componentes do PDB) com o canal de potássio KcsA (PDB 1BL8, tetrâmero, com íons K⁺ em fila no poro) e o transportador de glicose GLUT1 humano (PDB 4PYP). O₂, CO₂ e glicose vêm do dicionário do PDB; íons aparecem como esferas do tamanho do íon hidratado. Moléculas pequenas e apolares (O₂, CO₂) atravessam a bicamada por difusão simples; íons e glicose dependem de canal ou carreador. Quantidades ilustrativas.

- Protein Data Bank — 1BL8, 4PYP, CCD POV, CCD CLR, CCD OXY, CCD CO2, CCD GLC — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 1BL8 (https://doi.org/10.2210/pdb1bl8/pdb); PDB 4PYP (https://doi.org/10.2210/pdb4pyp/pdb); Chemical Component Dictionary POV; Chemical Component Dictionary CLR; Chemical Component Dictionary OXY; Chemical Component Dictionary CO2; Chemical Component Dictionary GLC
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Replicação do DNA (`dna-replication`)

Forquilha de replicação montada com moléculas reais do bacteriófago T7 e de humanos: o anel helicase–primase e as DNA polimerases (com tiorredoxina) do replissomo de T7 (PDB 5IKN) e a DNA ligase I humana (PDB 1X9N). O DNA é dupla hélice B construída de um passo real (PDB 1BNA): fita-molde cinza, fita contínua azul, fragmentos de Okazaki verdes com iniciadores de RNA lilás no começo de cada um. A geometria da forquilha (ângulos, alça da fita descontínua) é ilustrativa.

- Protein Data Bank — 5IKN, 1BNA, 1X9N — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 5IKN (https://doi.org/10.2210/pdb5ikn/pdb); PDB 1BNA (https://doi.org/10.2210/pdb1bna/pdb); PDB 1X9N (https://doi.org/10.2210/pdb1x9n/pdb)
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Endocitose e exocitose (`endocytosis-exocytosis`)

Modelo autoral em 3D de um trecho de membrana plasmática (cerca de 1,9 µm; meio externo acima, citosol abaixo) cortado ao meio, como num corte de microscopia eletrônica. Endocitose mediada por clatrina, da esquerda para o centro: placa revestida, fosseta rasa, fosseta profunda com a dinamina enrolada no pescoço, vesícula revestida livre e vesícula perdendo o revestimento; a carga (partículas presas a receptores) entra com elas. Em seguida, o endossomo inicial (com vesículas internas e túbulos) e o lisossomo, com membranas em degradação e enzimas. À direita, exocitose: vesículas secretoras com conteúdo denso, uma vesícula ancorada à membrana por complexos SNARE, um poro de fusão aberto liberando a carga e uma vesícula já incorporada à membrana. A gaiola de clatrina segue a geometria real (pentágonos e hexágonos); tamanhos de vesículas (60–200 nm) aproximados; membranas com espessura levemente ampliada; quantidades ilustrativas.

- Modelo autoral do Atlas Humano — Atlas Humano. Licença: mesma licença do projeto. https://github.com/Standby6994/Atlas
  - Geometria modelada a partir de dimensões publicadas (ver as observações da vista).
  - Base: Geometria modelada a partir de dimensões publicadas (vesículas revestidas de ~100 nm, gaiolas de clatrina, colar de dinamina, grânulos secretores de ~200 nm).

## Célula fúngica (`fungal-cell`)

Modelo autoral em 3D de uma levedura em brotamento (semelhante a Saccharomyces cerevisiae; célula-mãe com cerca de 5 µm), aberta ao meio como um corte de microscopia eletrônica. A parede tem duas camadas (interna de glucanas e quitina, externa de manoproteínas, fibrilar) e cicatrizes de brotamentos anteriores. Dentro: núcleo com envelope duplo e poros, nucléolo em forma de crescente, vacúolo com grânulos de polifosfato, rede de mitocôndrias tubulares junto à superfície, retículo cortical sob a membrana, gotículas de lipídio e ribossomos (apenas uma amostra do total, que passa de 100 mil por célula). Espessuras de membranas levemente ampliadas; posição e número de organelas ilustrativos.

- Modelo autoral do Atlas Humano — Atlas Humano. Licença: mesma licença do projeto. https://github.com/Standby6994/Atlas
  - Geometria modelada a partir de dimensões publicadas (ver as observações da vista).
  - Base: Geometria modelada a partir de dimensões publicadas de leveduras (célula de 4–6 µm, parede de ~150–200 nm, núcleo de ~1,5–2 µm).

## Gametogênese humana (`gametogenesis`)

Modelo autoral em 3D das células da gametogênese humana em tamanhos relativos reais. Linha masculina (acima): espermatogônia (~12 µm), espermatócito primário em prófase I (~18 µm, o maior da linhagem, com homólogos pareados), espermatócitos secundários, espermátides (redonda, com a vesícula acrossômica, e em alongamento) e o espermatozoide (~55 µm: cabeça com acrossomo e núcleo condensado, peça intermediária com a hélice de mitocôndrias, cauda). Linha feminina (abaixo): ovócito primário (~90 µm) parado na prófase I, com o núcleo grande (vesícula germinativa), zona pelúcida em formação e células foliculares; ovócito secundário ovulado (~120 µm) parado na metáfase II, com o fuso junto à superfície, zona pelúcida, coroa radiada (aberta pela metade) e o primeiro corpúsculo polar no espaço perivitelino. Membranas translúcidas para mostrar o interior; número de cromossomos reduzido; formas ilustrativas.

- Modelo autoral do Atlas Humano — Atlas Humano. Licença: mesma licença do projeto. https://github.com/Standby6994/Atlas
  - Geometria modelada a partir de dimensões publicadas (ver as observações da vista).
  - Base: Geometria modelada a partir de dimensões publicadas de células germinativas humanas (ovócito de ~120 µm, espermatozoide de ~55–60 µm).

## Regulação gênica (`gene-regulation`)

Montagem com moléculas reais: nucleossomos (PDB 1KX5) na cromatina compacta, fator de transcrição CREB ligado ao DNA (PDB 1DH3) num elemento intensificador, proteína de ligação ao TATA (TBP de levedura, PDB 1YTB) no promotor e Argonauta 2 humana com um microRNA (PDB 4W5N) ligado a um mRNA. O DNA livre é dupla hélice B construída de um passo real (PDB 1BNA). O processamento do RNA aparece como um transcrito com íntron em laço, e a estabilidade do mRNA como a cauda poli(A). Distâncias e a dobra do DNA são ilustrativas.

- Protein Data Bank — 1KX5, 1BNA, 1DH3, 1YTB, 4W5N — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 1KX5 (https://doi.org/10.2210/pdb1kx5/pdb); PDB 1BNA (https://doi.org/10.2210/pdb1bna/pdb); PDB 1DH3 (https://doi.org/10.2210/pdb1dh3/pdb); PDB 1YTB (https://doi.org/10.2210/pdb1ytb/pdb); PDB 4W5N (https://doi.org/10.2210/pdb4w5n/pdb)
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Glicólise e fermentação (`glycolysis-fermentation`)

Enzimas reais da glicólise e das fermentações em sequência: hexoquinase (PDB 1HKB), fosfofrutoquinase (PDB 3PFK), gliceraldeído-3-fosfato desidrogenase (PDB 1GPD), piruvato quinase (PDB 1PKN), lactato desidrogenase humana com NADH (PDB 1I10), piruvato descarboxilase (PDB 1PVD) e álcool desidrogenase de levedura (PDB 4W6Z). Glicose, piruvato, ATP, NAD⁺/NADH, lactato, etanol e CO₂ vêm do dicionário de componentes do PDB, em cores por elemento. As etapas intermediárias e suas enzimas foram resumidas; distâncias ilustrativas.

- Protein Data Bank — 1HKB, 3PFK, 1GPD, 1PKN, 1I10, 1PVD, 4W6Z, CCD GLC, CCD ATP, CCD NAD, CCD NAI, CCD PYR, CCD LAC, CCD EOH, CCD CO2 — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 1HKB (https://doi.org/10.2210/pdb1hkb/pdb); PDB 3PFK (https://doi.org/10.2210/pdb3pfk/pdb); PDB 1GPD (https://doi.org/10.2210/pdb1gpd/pdb); PDB 1PKN (https://doi.org/10.2210/pdb1pkn/pdb); PDB 1I10 (https://doi.org/10.2210/pdb1i10/pdb); PDB 1PVD (https://doi.org/10.2210/pdb1pvd/pdb); PDB 4W6Z (https://doi.org/10.2210/pdb4w6z/pdb); Chemical Component Dictionary GLC; Chemical Component Dictionary ATP; Chemical Component Dictionary NAD; Chemical Component Dictionary NAI; Chemical Component Dictionary PYR; Chemical Component Dictionary LAC; Chemical Component Dictionary EOH; Chemical Component Dictionary CO2
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Complexo de Golgi (`golgi`)

Complexo de Golgi real de uma célula HeLa, imageado por microscopia eletrônica FIB-SEM (voxels de 4 nm) e traçado à mão (recorte anotado do OpenOrganelle, HHMI Janelia, CC BY 4.0), com as vesículas e endossomos ao redor. A pilha foi dividida em quatro faixas ao longo da sua espessura — face cis (voltada para o núcleo e o retículo), cisternas, cisternas mediais e face trans —, uma divisão didática por posição, não por marcadores moleculares. Aberto por um plano para mostrar as cisternas.

- OpenOrganelle — jrc_hela-2, recorte anotado crop4 — HHMI Janelia Research Campus (COSEM Project Team). Licença: CC BY 4.0. https://openorganelle.janelia.org/datasets/jrc_hela-2
  - Heinrich L. et al. Whole-cell organelle segmentation in volume electron microscopy. Nature 599, 141–146 (2021); Xu C.S. et al. An open-access volume electron microscopy atlas of whole cells and tissues. Nature 599, 147–151 (2021).
  - Alterações: Malhas de anotação manual reduzidas (simplificação por erro quádrico), abertas por um plano de corte e coloridas por compartimento.

## Ciclo de Krebs (`krebs-cycle`)

Enzimas reais do ciclo de Krebs em anel: citrato sintase (PDB 1CTS), aconitase (PDB 7ACN), isocitrato desidrogenase (PDB 1AI2), succinato desidrogenase/complexo II (PDB 1NEK), fumarase (PDB 1FUO) e malato desidrogenase (PDB 4MDH); a α-cetoglutarato desidrogenase e a succinil-CoA sintetase, enormes, não foram incluídas. Acetil-CoA, oxaloacetato, citrato, isocitrato, α-cetoglutarato, succinil-CoA, succinato, fumarato, malato, CO₂, NADH, FADH₂ e GTP vêm do dicionário de componentes do PDB, em cores por elemento. A esfera translúcida representa a matriz mitocondrial; distâncias ilustrativas.

- Protein Data Bank — 1CTS, 7ACN, 1AI2, 1NEK, 1FUO, 4MDH, CCD ACO, CCD OAA, CCD CIT, CCD ICT, CCD AKG, CCD SIN, CCD FUM, CCD SCA, CCD GTP, CCD MLT, CCD CO2, CCD NAI, CCD FAD — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 1CTS (https://doi.org/10.2210/pdb1cts/pdb); PDB 7ACN (https://doi.org/10.2210/pdb7acn/pdb); PDB 1AI2 (https://doi.org/10.2210/pdb1ai2/pdb); PDB 1NEK (https://doi.org/10.2210/pdb1nek/pdb); PDB 1FUO (https://doi.org/10.2210/pdb1fuo/pdb); PDB 4MDH (https://doi.org/10.2210/pdb4mdh/pdb); Chemical Component Dictionary ACO; Chemical Component Dictionary OAA; Chemical Component Dictionary CIT; Chemical Component Dictionary ICT; Chemical Component Dictionary AKG; Chemical Component Dictionary SIN; Chemical Component Dictionary FUM; Chemical Component Dictionary SCA; Chemical Component Dictionary GTP; Chemical Component Dictionary MLT; Chemical Component Dictionary CO2; Chemical Component Dictionary NAI; Chemical Component Dictionary FAD
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Reações luminosas (`light-reactions`)

Membrana do tilacoide montada com moléculas reais: fotossistema II dímero de cianobactéria (PDB 3WU2), complexo citocromo b6f dímero (PDB 1VF5), fotossistema I de planta com antenas LHCI (PDB 5L8R, ervilha), ferredoxina–NADP⁺ redutase de espinafre (PDB 1FNB), ATP sintase de cloroplasto (PDB 6FKF, espinafre) e plastocianina (PDB 1PLC), em bicamada de galactolipídios (MGDG e DGDG do dicionário de componentes do PDB). Água, O₂, NADP⁺/NADPH e ATP também vêm desse dicionário; prótons aparecem como íons hidrônio, concentrados no lúmen do tilacoide (em cima). O estroma fica embaixo. As antenas LHCII e o empilhamento dos grana não foram incluídos.

- Protein Data Bank — 3WU2, 1VF5, 5L8R, 6FKF, 1PLC, 1FNB, CCD LMG, CCD DGD, CCD POV, CCD NAP, CCD NDP, CCD ATP, CCD HOH, CCD OXY — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 3WU2 (https://doi.org/10.2210/pdb3wu2/pdb); PDB 1VF5 (https://doi.org/10.2210/pdb1vf5/pdb); PDB 5L8R (https://doi.org/10.2210/pdb5l8r/pdb); PDB 6FKF (https://doi.org/10.2210/pdb6fkf/pdb); PDB 1PLC (https://doi.org/10.2210/pdb1plc/pdb); PDB 1FNB (https://doi.org/10.2210/pdb1fnb/pdb); Chemical Component Dictionary LMG; Chemical Component Dictionary DGD; Chemical Component Dictionary POV; Chemical Component Dictionary NAP; Chemical Component Dictionary NDP; Chemical Component Dictionary ATP; Chemical Component Dictionary HOH; Chemical Component Dictionary OXY
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Lisossomos e autofagia (`lysosome-autophagy`)

Modelo autoral em 3D da autofagia e da digestão lisossômica (região de cerca de 3 µm), aberto ao meio. Da esquerda para a direita: o fagóforo, membrana dupla em forma de taça envolvendo parte do citoplasma (um pedaço de mitocôndria e ribossomos); o autofagossomo já fechado, com membrana dupla; um lisossomo, com membrana simples, lúmen ácido (H⁺) e hidrolases, fundindo-se ao autofagossomo; e o autolisossomo, onde a carga é degradada e de onde moléculas pequenas (aminoácidos, açúcares, nucleotídeos) saem por transportadores da membrana para o citosol. Tamanhos de 0,5–1,5 µm aproximados; enzimas, íons e moléculas ampliados e em número ilustrativo.

- Modelo autoral do Atlas Humano — Atlas Humano. Licença: mesma licença do projeto. https://github.com/Standby6994/Atlas
  - Geometria modelada a partir de dimensões publicadas (ver as observações da vista).
  - Base: Geometria modelada a partir de dimensões publicadas (autofagossomos de 0,5–1,5 µm, lisossomos de 0,1–1 µm).

## Meiose (`meiosis`)

Modelo autoral em 3D da meiose numa célula com 2n = 6 (três pares de homólogos; cromossomos de origem materna em vermelho e paterna em azul): prófase I com homólogos pareados (bivalentes) e quiasmas, onde cromátides não irmãs trocaram segmentos; metáfase I com os bivalentes na placa e cada homólogo ligado a um polo; anáfase I separando homólogos (as cromátides-irmãs continuam unidas); meiose II em duas células, separando cromátides-irmãs; e as quatro células haploides resultantes, com combinações diferentes de segmentos. A recombinação aparece como troca de cor no quiasma (anel amarelo). Número de cromossomos reduzido para clareza (a célula humana tem 23 pares); microtúbulos e centríolos ampliados; formas e tempos ilustrativos.

- Modelo autoral do Atlas Humano — Atlas Humano. Licença: mesma licença do projeto. https://github.com/Standby6994/Atlas
  - Geometria modelada a partir de dimensões publicadas (ver as observações da vista).
  - Base: Geometria modelada a partir de dimensões publicadas (cromossomos meióticos de alguns µm, células de ~15–25 µm).

## Mitocôndria (`mitochondrion`)

Uma mitocôndria inteira de uma célula HeLa real (2,7 µm de comprimento), recortada dos volumes de segmentação de microscopia eletrônica FIB-SEM do OpenOrganelle (HHMI Janelia, CC BY 4.0) em resolução de 4 nm: contorno da organela, membranas com as cristas e ribossomos mitocondriais segmentados por aprendizado de máquina. Aberta ao meio ao longo do comprimento para mostrar as cristas. A membrana interna e as cristas são a mesma membrana: a parte junto ao contorno aparece como membrana interna e as dobras que entram na matriz como cristas. A matriz aparece translúcida. O espaço intermembranas é a fresta de ~10 nm entre as membranas, estreita demais para ter peça própria nesta resolução. O DNA mitocondrial não foi segmentado e aparece como nucleoides ilustrativos.

- OpenOrganelle — jrc_hela-2 (volumes de segmentação) — HHMI Janelia Research Campus (COSEM Project Team). Licença: CC BY 4.0. https://openorganelle.janelia.org/datasets/jrc_hela-2
  - Heinrich L. et al. Whole-cell organelle segmentation in volume electron microscopy. Nature 599, 141–146 (2021); Xu C.S. et al. An open-access volume electron microscopy atlas of whole cells and tissues. Nature 599, 147–151 (2021).
  - Alterações: Superfícies extraídas dos volumes de segmentação, suavizadas de leve, reduzidas para o aparelho, abertas por um plano de corte e coloridas por compartimento.

## Mitose (`mitosis`)

Modelo autoral em 3D das etapas da mitose numa célula animal (cerca de 20 µm), lado a lado ao longo do eixo do fuso: prófase (cromossomos condensando dentro do núcleo, centrossomos se afastando), prometáfase (envelope nuclear fragmentado, microtúbulos capturando cinetócoros), metáfase (cromossomos alinhados na placa equatorial, cada cinetócoro ligado a um polo), anáfase (cromátides-irmãs separadas indo aos polos), telófase (núcleos se reorganizando, sulco de clivagem) e citocinese (anel contrátil, ponte com corpo intermediário). Para ficar legível, aparecem 8 pares de cromossomos (a célula humana tem 23 pares); o diâmetro dos microtúbulos e o tamanho dos centríolos foram ampliados (cerca de 2–3×). A membrana aparece translúcida para mostrar o interior. Tempos, formas e posições são ilustrativos.

- Modelo autoral do Atlas Humano — Atlas Humano. Licença: mesma licença do projeto. https://github.com/Standby6994/Atlas
  - Geometria modelada a partir de dimensões publicadas (ver as observações da vista).
  - Base: Geometria modelada a partir de dimensões publicadas (célula de ~20 µm, cromossomos metafásicos de ~2–10 µm de comprimento e ~0,7 µm de largura, fuso de ~15 µm).

## Ácidos nucleicos (`nucleic-acids`)

DNA em dupla hélice B montado repetindo um passo real de par de bases da estrutura PDB 1BNA (dodecâmero de Dickerson, CC0), com 3,38 Å de subida e 36° de giro por par; a sequência alterna A·T e G·C para mostrar os dois pareamentos. O RNA é o RNA transportador de fenilalanina de levedura (PDB 1EHZ), uma cadeia única dobrada sobre si mesma. Cores das bases: A vermelho, T amarelo, G verde, C azul, U lilás. O nucleotídeo isolado vem do mesmo DNA, em cores por elemento (P laranja, O vermelho, N azul, C cinza).

- Protein Data Bank — 1BNA, 1EHZ — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 1BNA (https://doi.org/10.2210/pdb1bna/pdb); PDB 1EHZ (https://doi.org/10.2210/pdb1ehz/pdb)
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Núcleo e cromatina (`nucleus-chromatin`)

O núcleo inteiro de uma célula HeLa real (cerca de 22 × 14 µm, achatado), recortado dos volumes de segmentação de microscopia eletrônica FIB-SEM do OpenOrganelle (HHMI Janelia, CC BY 4.0) em resolução de 32 nm: envelope nuclear, poros nucleares, nucléolo e cromatina densa (heterocromatina), que se concentra junto ao envelope e ao redor do nucléolo. A heterocromatina aqui é a cromatina densa a até ~250 nm do envelope e do nucléolo, onde ela se concentra; o restante da cromatina aparece como eucromatina, translúcida (a fonte não separa os dois tipos). A metade de cima foi retirada para mostrar o interior. A alça de cromatina é ilustrativa (contas de 11 nm, um nucleossomo cada, em escala ampliada).

- OpenOrganelle — jrc_hela-2 (volumes de segmentação) — HHMI Janelia Research Campus (COSEM Project Team). Licença: CC BY 4.0. https://openorganelle.janelia.org/datasets/jrc_hela-2
  - Heinrich L. et al. Whole-cell organelle segmentation in volume electron microscopy. Nature 599, 141–146 (2021); Xu C.S. et al. An open-access volume electron microscopy atlas of whole cells and tissues. Nature 599, 147–151 (2021).
  - Alterações: Superfícies extraídas dos volumes de segmentação, suavizadas de leve, reduzidas para o aparelho, abertas por um plano de corte e coloridas por compartimento.

## Osmose e tonicidade (`osmosis-tonicity`)

À esquerda, na escala molecular: membrana com moléculas reais (POPC e colesterol do dicionário de componentes do PDB) e aquaporina-1 humana (PDB 1J4N, tetrâmero), o canal que deixa passar água; moléculas de água e solutos vêm do dicionário do PDB. À direita, em outra escala (cerca de 1:100 000 em relação às moléculas): hemácias com o contorno bicôncavo medido por Evans e Fung (1972) em meio isotônico, inchadas em meio hipotônico e crenadas em meio hipertônico. As formas das hemácias são modelos matemáticos, não micrografias.

- Protein Data Bank — 1J4N, CCD POV, CCD CLR, CCD HOH, CCD GLC — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 1J4N (https://doi.org/10.2210/pdb1j4n/pdb); Chemical Component Dictionary POV; Chemical Component Dictionary CLR; Chemical Component Dictionary HOH; Chemical Component Dictionary GLC
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Fosforilação oxidativa (`oxidative-phosphorylation`)

Membrana mitocondrial interna montada com moléculas reais: complexo I (PDB 5LDW, camundongo), complexo III dímero (PDB 1BGY, bovino), complexo IV (PDB 1OCC, bovino), citocromo c (PDB 1HRC) e ATP sintase (PDB 5ARA, bovina), em bicamada de POPC com cardiolipina representada pela própria POPC. NADH, FADH₂, ubiquinona, O₂, H₂O e ATP vêm do dicionário de componentes do PDB; prótons aparecem como íons hidrônio (azul-claro), concentrados no espaço intermembranas (em cima). A matriz fica embaixo. O complexo II e a curvatura das cristas não foram incluídos; distâncias entre complexos são ilustrativas.

- Protein Data Bank — 5LDW, 1BGY, 1OCC, 5ARA, 1HRC, CCD U10, CCD POV, CCD NAI, CCD FAD, CCD OXY, CCD HOH, CCD ATP — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 5LDW (https://doi.org/10.2210/pdb5ldw/pdb); PDB 1BGY (https://doi.org/10.2210/pdb1bgy/pdb); PDB 1OCC (https://doi.org/10.2210/pdb1occ/pdb); PDB 5ARA (https://doi.org/10.2210/pdb5ara/pdb); PDB 1HRC (https://doi.org/10.2210/pdb1hrc/pdb); Chemical Component Dictionary U10; Chemical Component Dictionary POV; Chemical Component Dictionary NAI; Chemical Component Dictionary FAD; Chemical Component Dictionary OXY; Chemical Component Dictionary HOH; Chemical Component Dictionary ATP
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Peroxissomo (`peroxisome`)

Peroxissomo em escala molecular: membrana desenhada com uma conta por lipídio (detalhe reduzido), cheia de catalase humana (PDB 1DGF, tetrâmero com heme), e acil-CoA oxidase representada pela catalase em outra cor como enzima oxidativa ilustrativa; água oxigenada, ácido palmítico e O₂ vêm do dicionário de componentes do PDB. Peroxissomos reais medem 0,1–1 µm e contêm muitas outras enzimas; este modelo tem ~60 nm e densidade de proteínas ilustrativa.

- Protein Data Bank — 1DGF, CCD PEO, CCD PLM — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 1DGF (https://doi.org/10.2210/pdb1dgf/pdb); Chemical Component Dictionary PEO; Chemical Component Dictionary PLM
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Célula vegetal (`plant-cell`)

Modelo autoral em 3D de uma célula do mesofilo de folha (cerca de 42 × 28 × 26 µm), aberta ao meio. O vacúolo central ocupa a maior parte do volume, com o tonoplasto translúcido, e empurra o citoplasma contra a parede: os cloroplastos ficam enfileirados junto à membrana, e cordões de citoplasma atravessam o vacúolo. O núcleo fica numa bolsa de citoplasma, com envelope duplo, poros, nucléolo e cromatina; à volta dele, retículo rugoso com ribossomos e dictiossomos (complexo golgiense). Nos cloroplastos e mitocôndrias cortados aparecem grana e cristas. Escalas ampliadas para ficarem visíveis: espessura das membranas, plasmodesmos (cerca de 4×) e ribossomos (cerca de 2×). Número, tamanho e posição das organelas são ilustrativos e variam entre tipos de células vegetais.

- Modelo autoral do Atlas Humano — Atlas Humano. Licença: mesma licença do projeto. https://github.com/Standby6994/Atlas
  - Geometria modelada a partir de dimensões publicadas (ver as observações da vista).
  - Base: Geometria modelada a partir de dimensões publicadas de células do mesofilo, cloroplastos (~5 × 2 µm), mitocôndrias, núcleo, retículo e dictiossomos.

## Membrana plasmática (`plasma-membrane`)

Trecho de membrana plasmática de ~22 nm montado com moléculas reais: fosfatidilcolina POPC e colesterol do dicionário de componentes do PDB (coordenadas ideais), aquaporina-1 humana (PDB 1J4N, tetrâmero) e o transportador de glicose GLUT1 (PDB 4PYP), com cadeias de açúcar (N-acetilglicosamina, manose, galactose, ácido siálico) do lado de fora e um filamento de actina (PDB 6BNO) por dentro. A orientação das proteínas na bicamada foi calculada pela faixa mais hidrofóbica de cada uma. Membranas reais são mais fluidas e variadas; a proporção de colesterol (~30 %) e a densidade das proteínas são ilustrativas.

- Protein Data Bank — 1J4N, 4PYP, CCD POV, CCD CLR, CCD NAG, CCD MAN, CCD GAL, CCD SIA, 6BNO — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 1J4N (https://doi.org/10.2210/pdb1j4n/pdb); PDB 4PYP (https://doi.org/10.2210/pdb4pyp/pdb); Chemical Component Dictionary POV; Chemical Component Dictionary CLR; Chemical Component Dictionary NAG; Chemical Component Dictionary MAN; Chemical Component Dictionary GAL; Chemical Component Dictionary SIA; PDB 6BNO (https://doi.org/10.2210/pdb6bno/pdb)
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Proteínas e enzimas (`proteins-enzymes`)

Hexoquinase I humana (PDB 1HKB) com glicose no sítio ativo, o exemplo clássico de encaixe induzido; os resíduos a até 6 Å da glicose formam o sítio ativo (dourado). ATP, ADP, glicose-6-fosfato, Mg²⁺ e aminoácidos livres vêm do dicionário de componentes do PDB; a minipproteína Trp-cage (PDB 1L2Y) mostra a cadeia polipeptídica e suas ligações peptídicas em cores por elemento. A proteína desnaturada ao lado é uma cadeia estendida ilustrativa, sem a dobra funcional.

- Protein Data Bank — 1HKB, CCD ATP, CCD ADP, CCD G6P, CCD GLY, CCD ALA, CCD SER, CCD LYS, CCD PHE, CCD TRP, 1L2Y — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 1HKB (https://doi.org/10.2210/pdb1hkb/pdb); Chemical Component Dictionary ATP; Chemical Component Dictionary ADP; Chemical Component Dictionary G6P; Chemical Component Dictionary GLY; Chemical Component Dictionary ALA; Chemical Component Dictionary SER; Chemical Component Dictionary LYS; Chemical Component Dictionary PHE; Chemical Component Dictionary TRP; PDB 1L2Y (https://doi.org/10.2210/pdb1l2y/pdb)
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Ribossomo (`ribosome`)

Ribossomo bacteriano 70S de Thermus thermophilus com RNA mensageiro e três RNAs transportadores (sítios A, P e E), da estrutura cristalográfica PDB 4V51 (Selmer et al., Science 2006; CC0). Cada superfície envolve os átomos de uma parte. O RNA mensageiro foi prolongado de forma ilustrativa para ligar o ribossomo aos do polissomo, que são cópias reduzidas do mesmo modelo. O polipeptídio nascente não está resolvido nessa estrutura e aparece como um traço ilustrativo saindo da subunidade grande.

- Protein Data Bank — 4V51 — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 4V51 (https://doi.org/10.2210/pdb4v51/pdb)
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Retículo endoplasmático rugoso (`rough-er`)

Retículo endoplasmático real de uma célula HeLa (cisternas achatadas e túbulos), contínuo com o envelope nuclear, imageado por microscopia eletrônica FIB-SEM (voxels de 4 nm) e traçado à mão (recorte anotado do OpenOrganelle, HHMI Janelia, CC BY 4.0). Os ribossomos não foram segmentados na fonte: aparecem como grânulos de 25 nm distribuídos sobre a face citosólica das cisternas, com densidade ilustrativa. O lúmen aparece translúcido por dentro da membrana. Aberto por um plano.

- OpenOrganelle — jrc_hela-2, recorte anotado crop4 — HHMI Janelia Research Campus (COSEM Project Team). Licença: CC BY 4.0. https://openorganelle.janelia.org/datasets/jrc_hela-2
  - Heinrich L. et al. Whole-cell organelle segmentation in volume electron microscopy. Nature 599, 141–146 (2021); Xu C.S. et al. An open-access volume electron microscopy atlas of whole cells and tissues. Nature 599, 147–151 (2021).
  - Alterações: Malhas de anotação manual reduzidas (simplificação por erro quádrico), abertas por um plano de corte e coloridas por compartimento.

## Sarcômero: unidade contrátil (`sarcomere`)

Trecho de sarcômero montado com estruturas reais: filamento fino cardíaco humano com actina, tropomiosina e troponina (PDB 6KN7, crio-microscopia, estado sem cálcio), cabeças de miosina II ligadas à actina no complexo de rigor (PDB 5H53) formando o filamento espesso (a cauda em hélice dupla é ilustrativa), α-actinina (PDB 4D1E) no disco Z e íons Ca²⁺ e ATP do dicionário de componentes do PDB. A linha M aparece como pontes ilustrativas entre os filamentos espessos. Comprimento reduzido (um sarcômero real mede ~2,2 µm); espaçamentos aproximados.

- Protein Data Bank — 6KN7, 5H53, 4D1E, CCD ATP — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 6KN7 (https://doi.org/10.2210/pdb6kn7/pdb); PDB 5H53 (https://doi.org/10.2210/pdb5h53/pdb); PDB 4D1E (https://doi.org/10.2210/pdb4d1e/pdb); Chemical Component Dictionary ATP
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Retículo endoplasmático liso (`smooth-er`)

Modelo autoral em 3D de retículo endoplasmático liso de um hepatócito (região de cerca de 2,4 × 1,5 µm), aberto ao meio: uma rede de túbulos (50–70 nm de diâmetro) unidos em junções de três vias, contínua com uma cisterna de retículo rugoso à esquerda. Na superfície ficam enzimas de transformação de compostos (citocromos P450, pontos verdes) e de síntese de lipídios (laranja), com gotículas de lipídio brotando da membrana; dentro dos túbulos, íons Ca²⁺ armazenados (vermelho) bombeados pela SERCA (azul). Junto à rede, rosetas de glicogênio, cuja glicose-6-fosfato é convertida em glicose pela glicose-6-fosfatase do retículo (amarelo). Os fosfolipídios recém-produzidos aparecem como moléculas ampliadas (cerca de 4×) inseridas na membrana. Enzimas, íons e moléculas estão ampliados e em número ilustrativo.

- Modelo autoral do Atlas Humano — Atlas Humano. Licença: mesma licença do projeto. https://github.com/Standby6994/Atlas
  - Geometria modelada a partir de dimensões publicadas (ver as observações da vista).
  - Base: Geometria modelada a partir de dimensões publicadas do retículo liso de hepatócitos (túbulos de ~50–70 nm, rosetas de glicogênio de ~100–200 nm).

## Transcrição e processamento de RNA (`transcription-rna`)

RNA polimerase II de levedura em elongação (PDB 1I6H, Gnatt et al., Science 2001), com a fita-molde de DNA e o RNA nascente resolvidos na estrutura. O DNA foi prolongado dos dois lados com dupla hélice B construída de um passo real de DNA (PDB 1BNA); a região promotora (laranja) fica antes do ponto de início. O RNA que sai da enzima foi prolongado de forma ilustrativa, com éxons (verde) e íntrons (lilás); ao lado, o mRNA processado, com cap 5′ (um nucleotídeo de guanina do dicionário de componentes do PDB) e cauda poli(A).

- Protein Data Bank — 1I6H, 1BNA, CCD GTP — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 1I6H (https://doi.org/10.2210/pdb1i6h/pdb); PDB 1BNA (https://doi.org/10.2210/pdb1bna/pdb); Chemical Component Dictionary GTP
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Tradução proteica (`translation-protein`)

Ribossomo bacteriano 70S (PDB 4V51, Thermus thermophilus) com RNA mensageiro e RNAs transportadores nos sítios A, P e E; subunidade menor em bege e maior em azul. Aminoácidos livres vêm do dicionário de componentes do PDB. O mensageiro foi prolongado de forma ilustrativa: o códon de parada (UAA) aparece em vermelho mais adiante, e o polipeptídio nascente, que não está resolvido nessa estrutura, aparece como um traço ilustrativo saindo da subunidade maior.

- Protein Data Bank — 4V51, CCD MET, CCD PHE, CCD LYS, CCD GLY, CCD TRP, CCD LEU, CCD SER, CCD TYR — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 4V51 (https://doi.org/10.2210/pdb4v51/pdb); Chemical Component Dictionary MET; Chemical Component Dictionary PHE; Chemical Component Dictionary LYS; Chemical Component Dictionary GLY; Chemical Component Dictionary TRP; Chemical Component Dictionary LEU; Chemical Component Dictionary SER; Chemical Component Dictionary TYR
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.

## Vacúolo vegetal (`vacuole`)

Modelo autoral em 3D de uma célula vegetal (cerca de 30 × 20 × 18 µm) aberta ao meio, com o vacúolo central ocupando a maior parte do volume. O tonoplasto separa o lúmen (com solutos dissolvidos e cristais de oxalato de cálcio, uma drusa e um feixe de ráfides) do citoplasma periférico, apertado contra a parede, onde ficam núcleo, cloroplastos e mitocôndrias. As setas indicam a pressão de turgor do vacúolo cheio de água contra a parede. A janela ampliada cerca de 300 vezes mostra um trecho do tonoplasto com as bombas de prótons reais, em superfície molecular: a ATPase do tipo V (estrutura de levedura, PDB 3J9T) e a pirofosfatase de prótons vacuolar (feijão-mungo, PDB 4A01), que acumulam H⁺ no lúmen (pontos vermelhos). Na célula, espessuras de membranas ampliadas e quantidades ilustrativas.

- Modelo autoral do Atlas Humano — Atlas Humano. Licença: mesma licença do projeto. https://github.com/Standby6994/Atlas
  - Geometria modelada a partir de dimensões publicadas (ver as observações da vista).
  - Base: Célula e vacúolo modelados a partir de dimensões publicadas.
- Protein Data Bank — 3J9T, 4A01 — wwPDB / RCSB PDB e autores de cada estrutura (Zhao, Benlekbir & Rubinstein, Nature 2015; Lin et al., Nature 2012). Licença: CC0 1.0. https://www.rcsb.org/
  - 3J9T: V-ATPase de Saccharomyces cerevisiae (crio-ME). 4A01: H⁺-pirofosfatase de Vigna radiata (cristalografia).
  - Alterações: Superfícies moleculares calculadas dos átomos, orientadas pela faixa hidrofóbica da membrana, simplificadas e ampliadas na janela.

## Vírus: organização acelular (`viruses-acellular`)

À esquerda, um vírus sem envelope: o capsídeo icosaédrico de 60 subunidades do vírus-satélite do mosaico do Panicum (montagem biológica da estrutura PDB 1STM), com o RNA desenhado de forma ilustrativa por dentro. Ao centro, um vírus envelopado como o SARS-CoV-2 (~100 nm): envelope lipídico desenhado com uma conta por lipídio e espículas reais (glicoproteína S, PDB 6VXX), com o genoma de RNA ilustrativo dentro. À direita, a membrana da célula hospedeira (POPC e colesterol do dicionário de componentes do PDB) com o receptor ACE2 humano ligado ao domínio de ligação da espícula (PDB 6M17); abaixo dela, novas fitas de RNA viral e ribossomos (PDB 4V51, em contas) representam a replicação. Escalas relativas aproximadas.

- Protein Data Bank — 1STM, 6VXX, 6M17, CCD POV, CCD CLR, 4V51 — wwPDB / RCSB PDB e autores de cada estrutura. Licença: CC0 1.0. https://www.rcsb.org/
  - PDB 1STM (https://doi.org/10.2210/pdb1stm/pdb); PDB 6VXX (https://doi.org/10.2210/pdb6vxx/pdb); PDB 6M17 (https://doi.org/10.2210/pdb6m17/pdb); Chemical Component Dictionary POV; Chemical Component Dictionary CLR; PDB 4V51 (https://doi.org/10.2210/pdb4v51/pdb)
  - Alterações: Superfície molecular gaussiana dos átomos pesados, reduzida para o aparelho; cores por parte, por cadeia ou por tipo de base.
