# Modelos do Atlas: cobertura e limites

## Anatomia efetivamente individualizada

O Atlas mantém 51 vistas e 349 entradas anatômicas descritas. A configuração atual abre dez cortes autorais, 40 referências anatômicas e um esquema. As 49 vistas com referência anterior preservam essas alternativas. Os 36 GLBs originais mantêm seus hashes e tamanhos.

| Corte autoral | Entradas | Organização |
|---|---:|---|
| Coração |22| Câmaras, paredes, valvas, papilares, cordas atrioventriculares por lado, trabéculas, vasos e condução ampliada. |
| Ovário |15| Estágios foliculares comparativos e componentes do folículo antral. |
| Testículo |7| Envoltório, lóbulos, túbulos e continuidade de saída até epidídimo e ducto deferente. |
| Vagina |5| Parede aberta para leitura, canal, epitélio, lâmina própria, musculatura e pregas. |
| Rim |10| Cápsula, córtex, medula, pirâmides/papilas, colunas, cálices, pelve, ureter, artéria e veia. |
| Pulmões |9| Pulmão direito/esquerdo, traqueia, brônquios principais, árvore brônquica, artérias/veias pulmonares, pleura e diafragma. |
| Estômago |9| Parede aberta, regiões gástricas, pregas, mucosa, submucosa, interfaces musculares e serosa. |
| Intestino delgado |9 + 1 indicação| Alças reduzidas e janela jejunal ampliada, com camadas, pregas e vilosidades integradas; contorno da luz vazio e identificado como anotação. |
| Esôfago |5 + 1 indicação| Parede aberta contínua, pregas longitudinais e camadas aninhadas; cavidade vazia indicada por contorno. |
| Intestino grosso |10| Trajeto regional, haustros e tênias; apêndice de ponta cega ligado ao ceco e janela de mucosa com criptas comunicantes com a superfície, em escala independente. |

Os cortes de coração, ovário, testículo e vagina são gerados uma única vez a partir dos mesmos geradores autorais e guardados sem perdas (posições, normais, tons e índices do gerador, em Float32), para abrir sem a pausa de geração no aparelho. A forma, as peças e os limites descritos acima não mudam.

Há 101 entradas com peças selecionáveis e geometria própria; dois contornos de cavidades são indicações separadas, totalizando 103 entradas nos cortes. Isso não completa todas as 349 entradas do catálogo nem as microestruturas de cada órgão. [COBERTURA-MODELOS.md](COBERTURA-MODELOS.md) contém o inventário por órgão, a proveniência das referências e as lacunas conservadoras de correspondência.

Os novos cortes renal e pulmonar usam superfícies trianguladas pré-construídas. No rim, o sistema coletor é contínuo; medula e pirâmides são faces complementares do mesmo parênquima. As sete silhuetas papilares são um exemplo de corte, não uma contagem anatômica total. Os trechos vasculares expostos são hilares e não mostram toda a microcirculação.

No pulmão, as paredes condutoras são ocas e conectadas. Há três e dois volumes lobares, fissuras, pleura parcial e diafragma em dupla cúpula. Os trajetos vasculares e calibres são simplificados. Extremidades distais interrompidas não representam alvéolos. São modelos de ensino, sem segmentação de espécime, escala clínica ou certificação para impressão/procedimentos.

As fontes anatômicas fundamentam relações, sem fornecer as coordenadas autorais: [NCI/SEER—rim](https://training.seer.cancer.gov/anatomy/urinary/components/kidney.html), [NIDDK—função renal](https://www.niddk.nih.gov/health-information/kidney-disease/kidneys-how-they-work), [OpenStax—pulmões](https://openstax.org/books/anatomy-and-physiology-2e/pages/22-2-the-lungs) e [NHLBI—sistema respiratório](https://www.nhlbi.nih.gov/health/lungs/respiratory-system). Os créditos dos arquivos importados permanecem em [Dundee](models/DUNDEE_ATTRIBUTION.txt), [HRA](models/REFERENCE_ATTRIBUTION.txt) e nas licenças originais da pasta models.

Os cortes gástrico e jejunal são superfícies autorais, com espessuras ampliadas para leitura. Regiões do estômago e camadas sobrepostas biologicamente usam faces complementares, sem duplicação coincidente. No delgado, trajeto e parede ampliada têm escalas independentes. Células, microvilosidades, plexos e rede vascular microscópica não são individualizados nesses dois cortes.

Os cortes esofágico e colônico usam malhas pré-calculadas nos dois perfis. O esôfago representa cinco camadas, com as subdivisões da mucosa e glândulas ainda sem individualização. Sua adventícia é a cobertura predominante; a curta porção abdominal com serosa e os esfíncteres funcionais não são peças novas. A janela do cólon representa apenas mucosa, sem prometer submucosa, muscular externa, células ou tecido linfoide do apêndice individualizados. Os segmentos e relevos do trajeto usam faces complementares da mesma parede; as notas de cada seleção declaram essa convenção. As referências biológicas incluem [OpenStax — esôfago](https://openstax.org/books/anatomy-and-physiology-2e/pages/23-3-the-mouth-pharynx-and-esophagus) e [OpenStax — delgado e grosso](https://openstax.org/books/anatomy-and-physiology-2e/pages/23-5-the-small-and-large-intestines). Elas não fornecem as coordenadas autorais.

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

## Tecido, célula e fotografia

A histologia humana reúne 48 vistas/237 componentes; a citologia, 46/316; a botânica, 13/84. Os 821 atalhos humanos/vegetais declaram se a relação é de componente, composição, mecanismo ou contexto. Uma comparação funcional não é uma equivalência anatômica automática.

A microscopia reúne 23 registros/52 marcações, vinculados a 26 vistas (23 delas com destinos de marcações). São 22 microfotografias e um composto com imagem real e segmentação científica. Espécies, estágios e diferenças em relação aos modelos são explicitados. Um folículo primário sem antro não equivale à fase antral; uma ilhota de rato não determina a organização humana; mitose vegetal não contém os centrossomos do exemplo animal 3D.

Os arquivos nativos e as miniaturas oficiais têm resolução, autoria, licença e fonte próprias: [histologia](images/histology/ATTRIBUTION.md) e [vegetal/celular](images/microscopy/ATTRIBUTION.md) e [digestiva](images/microscopy/ATTRIBUTION-DIGESTIVA-V18.md). Não são texturas aplicadas aos órgãos nem evidência de que o modelo 3D foi escaneado.

## Histologia digestiva reformulada

Parede gástrica e mucosa colônica mantêm seus seis/quatro IDs, agora em malhas pré-calculadas de computador/toque. No gástrico, três unidades ilustrativas ligam fovéolas a túbulos cegos: células pertencem à parede, e a luz permanece vazia. Um túbulo por fosseta simplifica a ramificação real. Há três tecidos de contexto sem novo ID; isolar uma peça oculta esse contexto. No cólon, epitélio, criptas e caliciformes partilham um mosaico em contato com a lâmina própria. O campo não contém vilosidades nem redes vasculares/imunes individualizadas. O significado de cada superfície e os limites aparecem ao selecionar. Os 23 registros de microscopia e 52 marcações do acervo permanecem intactos, incluindo as duas fotografias digestivas usadas aqui; foto e modelo não são equivalentes medidos.

## O significado de 4K

| Recurso | Situação |
|---|---|
| Exportação PNG |3840 × 2160 pixels. |
| Histologia | Dois mapas procedurais compartilhados 4096 × 4096 no computador; 2048 × 2048 ativos no toque. |
| Citologia/botânica | Três atlas procedurais compartilhados 4096 × 4096 ou 2048 × 2048; cada peça usa uma região. |
| Coração Dundee | Três mapas originais 2048 × 2048. |
| Referências HRA | Sem fotografias de textura incorporadas. |
| Cortes de rim/pulmões/estômago/delgado/esôfago/grosso | Geometria autoral e acabamento ilustrativo; nenhuma textura fotográfica 4K própria confirmada. |

Uma imagem exportada maior não produz anatomia ausente. A aparência ainda é educativa e varia entre referências. Não foi demonstrado fotorrealismo nem reconstrução molecular medida. As animações de processos são esquemas ilustrativos, e o desempenho no iPad 9 depende de medição no próprio aparelho (Ajustes → "Mostrar FPS").
