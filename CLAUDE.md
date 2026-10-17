# Atlas Humano

Atlas 3D de anatomia, fisiologia, citologia, histologia e botânica voltado ao vestibular da UERJ. Interface e conteúdo em **português (pt-BR)**. PWA estática com renderização em Three.js.

## Como rodar

Não há build, bundler, `package.json` nem dependências a instalar. Basta servir a pasta por HTTP (abrir `index.html` via `file://` não funciona: o app usa ES modules, import map e `fetch`).

```bash
python serve.py
```

Depois abra http://localhost:8000. `serve.py` desliga o cache HTTP (edições aparecem ao recarregar), entrega os MIME corretos (`.js`, `.wasm`, `.glb`) e escuta na rede local: ele imprime o endereço para abrir no iPad pela mesma rede Wi-Fi. Pelo endereço de rede não há HTTPS, então o modo off-line fica desligado; para isso o site precisa estar publicado em HTTPS. `python -m http.server` também funciona, mas o navegador pode reaproveitar arquivos antigos do cache.

Para testar o layout de tablet num computador, abra `http://localhost:8000/?ui=tablet` (e `?ui=desktop` força o layout normal). Com `?` na URL o service worker não intercepta as requisições.

Não há suíte de testes nem linter configurados. Validação é manual, no navegador.

## Service worker e cache (atenção ao testar mudanças)

`service-worker.js` é registrado em contextos seguros, e **localhost conta como seguro**, então ele fica ativo no desenvolvimento.

- Arquivos do app (JS, CSS, JSON, HTML) usam rede primeiro com fallback para cache, logo edições aparecem ao recarregar.
- Arquivos de modelo (`.glb`) usam **cache primeiro**: trocar um GLB não aparece até incrementar `MODEL_VERSION` ou limpar o cache (DevTools → Application → Clear storage).
- Só são cacheados arquivos listados explicitamente em `APP_ASSETS`/listas de modelos. Arquivo novo que deve funcionar off-line precisa ser adicionado lá.
- `CONTENT_SHA256` guarda hashes de texturas e imagens; ao substituir um desses arquivos, atualize o hash correspondente.
- Incremente `APP_VERSION` depois de mudanças no shell/dados que vão para produção.
- A validação de resposta rejeita `.js` servido com MIME errado e HTML que não seja o `index.html` real.

## Estrutura

Tudo fica na raiz; não há pasta `src/`.

### Entrada
- `index.html`: shell da página, todas as vistas (`#view-atlas`, `#view-physiology`, `#view-practice`, `#view-about`), e o import map (`three` → `vendor/build/three.module.js`, `three/addons/` → `vendor/examples/jsm/`).
- `app.js` (~130 KB): orquestrador central. Estado global (`state`), cena/câmera/renderer Three.js, carregamento de dados, troca de vistas, busca, seleção de peças, painel de detalhes e registro do service worker. Os módulos de modelo são carregados sob demanda via `import()` dinâmico conforme o modo/vista.
- `styles.css`: todo o CSS. Os blocos finais cobrem o layout de tablet (`.tablet-ui`, `.tablet-portrait`) e as animações; todas respeitam `prefers-reduced-motion`.
- `tablet-ui.js`: layout de tablet (iPad). Ativado quando `touchDevice` e a menor dimensão da tela ≥ 700 px. O 3D ocupa a tela; catálogo, detalhes e ajustes viram gavetas controladas por `data-catalog`/`data-detail`/`data-settings` em `#view-atlas`. Informa ao `app.js` a área coberta pelas gavetas (`setViewInset`), que desloca a projeção da câmera (`camera.setViewOffset`) para o modelo ficar centrado na parte visível.
- `manifest.webmanifest`, `icons/`: metadados da PWA.

### Módulos de apoio (importados estaticamente por `app.js`)
- `draw-board.js`: quadro de anotações sobre o visualizador (botão "✎ Quadro"). Traços em coordenadas relativas ao viewport, salvos em `localStorage` por modelo (`atlas-board-<modo>`). Os eventos são capturados no `#viewport` em fase de captura: Apple Pencil (`pointerType==='pen'`) sempre desenha; dedo/mouse só no modo quadro, senão seguem para o OrbitControls. O app fornece `sample3D` (conta-gotas lê o 3D) e `snapshot3D` (exportar imagem). Caneta sobre botões/painéis do visualizador não desenha (seletor `UI`); a caneta tem prioridade sobre a palma (traço de palma descartado, giro de palma cancelado com `pointercancel` sintético); depois que a caneta aparece, toques largos (> 44 px), toques no modo quadro e até 500 ms após um traço não desenham nem giram. `touchstart` de `touchType==='stylus'` faz `preventDefault` e o `#viewport` não permite seleção nem lupa, para o Safari não cancelar traços que começam devagar. Teste com `PointerEvent` sintéticos (`pointerType:'pen'`).
- `ambient-occlusion.js`: oclusão ambiente em tela ("Sombreamento de profundidade" nos Ajustes). Roda só no quadro parado, em meia resolução, a partir de uma passada de profundidade que ignora objetos translúcidos e os marcados com `userData.noOcclusion`; o raio acompanha a distância da câmera (`drawOcclusion` em `app.js`).
- `render-batches.js`: lotes de desenho dos sistemas do corpo. As peças de cada sistema são unidas por material em poucas malhas (≈60 chamadas de desenho em vez de ≈1.400). As peças originais ficam na cena, na camada `BATCHED_LAYER` (fora da câmera), e continuam valendo para toque, enquadramento e raio-X. `renderBatches.sync()` roda no fim de `applyVisibility()`: peça oculta sai do lote; peça com material diferente da maioria (selecionada, translúcida) desenha-se sozinha. Qualquer código novo que mude visibilidade ou material de peças do corpo precisa terminar em `applyVisibility()`. Peças espelhadas (escala negativa) têm os triângulos invertidos na união.
- `anatomy-info.js`: sistemas do corpo (`MODEL_SYSTEMS`), normalização e tradução de nomes de malhas.
- `core-mapping.js`: liga nomes de malhas dos GLBs às entradas canônicas de estudo.
- `simulation-engine.js`: simulações fisiológicas.
- `smart-search.js`, `picking-index.js` (raycast com BVH em `vendor/bvh`), `selection-highlight.js`.
- `learning-details.js` + `microscopy-viewer.js`: painéis de detalhe e visualizador de microfotografias.
- `study-*.js`, `practice-session.js`: sessão de estudo, rotas de entrada, conexões entre tópicos e rascunhos da prática discursiva (persistidos em `localStorage`).
- `tissue-materials.js`: acabamento procedural dos tecidos. `userData.relief` (lido dos pais da malha) multiplica o relevo e o contraste do acabamento; os cortes autorais usam `relief:5, surfaceScale:1.2` porque aparecem ~10× maiores que o órgão no corpo.

### Geradores de modelos 3D (carregados sob demanda)
- Cortes autorais de órgãos: `heart-*.js`, `ovary-interior-model.js`, `reproductive-interior-models.js`, `renal-*`, `pulmonary-*`, `stomach-*`, `small-intestine-*`, `large-intestine-*`, `esophagus-*`. Vários decodificam malhas pré-calculadas de `assets/interiors/*.bin` com perfis `desktop` e `touch`.
- `internal-models.js`: modelos internos procedurais e pool de geometria/material compartilhado (`createOrganModelContext`). `organicGeometry` gera uma faixa plana na borda do corte cujo anel externo é compartilhado com a lateral (borda arredondada pelas normais, sem mover vértices originais; `options.bevel=0` desliga) e um atributo `color` com tons de profundidade (cavidades escurecem ao fundo). `mesh()` liga `vertexColors` sozinho quando a geometria tem `color`. As cavidades do coração (`cavitySurface`) usam os mesmos tons.
- `reference-organ-models.js`: órgãos de referência a partir de `models/reference/*.glb`.
- Histologia: `histology-models.js`, `histology-geometry.js`, `histology-materials.js`, `gastric-histology-models.js`, `colon-histology-models.js` (estes últimos leem `assets/histology/*.bin`).
- Citologia: `cytology-models.js`, `cytology-organelles.js`, `cytology-processes.js`, `cytology-surfaces.js`, `cytology-materials.js`, `cytology-tools.js`.
- Botânica: `botany-models.js`. Outros: `micro-models.js`, `supplementary-models.js`.
- Sistemática (modos `syst-<id>`, aba `systematics`, botão "Sistemática" no menu): `systematics-view.js` (árvore filogenética no catálogo, painel de fisiologia comparada, tabela grupo × função e quadro do espécime escaneado com crédito e botão de corte), `systematics-models.js` (malhas e materiais na página; carrega os escaneamentos GLB com o `loader` do app), `systematics-worker.js` (gera a geometria num Web Worker de módulo; sem Worker, cai para a página), `systematics-builders.js` (registro `BUILDERS`), `systematics-geometry.js` (JS puro, sem `three`: ruído, loft com janela de corte, `section`, tubos, fios, lâminas e `bodyShape`, seção elíptica medida de um corpo), `systematics-microbes.js` (E. coli, Halobacterium, Paramecium), `systematics-invertebrates.js` (minhoca, planária, lombriga, hidra, Volvox; interiores do gafanhoto, caramujo e estrela-do-mar; lupas da esponja), `systematics-vertebrates.js` (interiores da carpa, rã, lagarto e falcão) e `systematics-plants.js` (lupas do musgo, samambaia, pinheiro, lírio e cogumelo). Conteúdo em `data/systematics-content.json`: `tree`, `groups` (fisiologia nas seis `functions`), `views` (organismos 3D; ids das `parts` iguais aos dos builders e das regiões do escaneamento; `functions` de cada parte define o destaque) e `sources`. Organismo novo: builder + entrada em `BUILDERS` + view no JSON + `viewId` no nó da árvore + arquivos em `APP_ASSETS` (e GLB em `MODEL_ASSETS` com hash). Pigmento dos modelos autorais fica em cores por vértice e relevo na geometria; perfil de toque com ~45% da densidade. `fitBounds` enquadra as `frameParts`.
- Escaneamentos da Sistemática (`models/systematics/*.glb` e `*-touch.glb`, atribuição em `models/systematics/ATTRIBUTION.md`): view com `scan` {`file`, `touch`, `part` (parte padrão), `regions` (caixas, esferas ou cápsulas que viram partes clicáveis, sem duplicar vértices), `cut`/`cutNormal` (plano do corte lateral), `inner` (cor da face interna), `cutaway:false` (sem corte; usado com lupas)}. Os GLB já vêm normalizados (maior lado = 1, centrados, cabeça para −x, dorso para +y, lado esquerdo para +z): os interiores são escritos nesse mesmo referencial. O corte troca o material do escaneamento por uma cópia com plano de recorte (`userData.originalMaterial`) e mostra uma casca interna de contexto; o toque (`raycastVisible`) ignora a parte recortada. Ao trocar um GLB, refaça o hash em `CONTENT_SHA256` e incremente `MODEL_VERSION`.

### Dados e assets
- `data/*.json`: todo o conteúdo textual (fisiologia, simulações, léxico, sistemas, fontes, citologia, botânica, histologia, conexões de estudo, cobertura). Carregados por `getJSON()` em `app.js` ou por `fetch(new URL(..., import.meta.url))` nos módulos.
- `models/*.glb`: modelos de corpo inteiro por sistema (Draco; decoder em `models/draco/`). `models/reference/`: órgãos individuais (HRA). Licenças e atribuições ficam ao lado e devem ser preservadas.
- `assets/`: texturas procedurais (citologia/histologia) e malhas binárias dos cortes.
- `images/`: microfotografias reais com `ATTRIBUTION*.md`.
- `vendor/`: Three.js, addons (OrbitControls, GLTFLoader, DRACOLoader, BufferGeometryUtils) e three-mesh-bvh, versionados sem npm. Não editar.

### Documentação
- `MODELOS-ANATOMICOS.md` e `COBERTURA-MODELOS.md`: inventário dos modelos, contagens, proveniência e limites. Atualize as contagens se adicionar peças ou vistas.

## Desempenho

- Meta: 60 fps no iPad 9. A cena só é redesenhada quando algo muda (`requestRender`).
- Resolução: `renderQuality.rest` (seletor Qualidade) quando a vista está parada. Durante giro e animações, `drawScene()` desenha numa textura intermediária menor (`renderQuality.motion`, que cai em passos de 0,25 até 0,75× se a média passar de 17,5 ms, salva em `localStorage`) e a amplia no canvas por um shader que repete tone mapping e espaço de cor. O canvas nunca é realocado durante um gesto. 160 ms após parar, um quadro na resolução cheia.
- Troca de modelo: `warmUpScene()` envia texturas (uma por tarefa, com `nextTask()`, para não congelar a tela) e compila shaders (`compileAsync`) antes do primeiro quadro; enquanto isso a imagem anterior fica na tela, esmaecida, com o aviso "Montando o modelo 3D…" (`compileGate`, `updateModelBusy`, classe `.is-building` no `#viewport`). `ensureModelLoaded` espera um quadro pintado (`nextPaint`) antes da geração síncrona. `clearMaterialCache(root)` descarta só os materiais do modelo removido; limpar tudo recompila o corpo inteiro. Ficam prontos em memória 3 modelos de estudo no toque e 4 no computador (`trimStudyModels`).
- Texturas grandes (citologia, histologia) são decodificadas com `createImageBitmap` (fora da thread principal; `imageOrientation:'flipY'` e `texture.flipY=false`). Não volte ao `TextureLoader` para imagens de 2048–4096 px: o envio custava ~280 ms por textura.
- Lista do catálogo e busca: `state.registry` é um `VersionedMap`; `coreMeshNames()` e o índice de peças (`partsSearch`, montado só no primeiro uso) são refeitos apenas quando o registro muda, e os demais índices quando a fonte de conteúdo muda. Antes disso, voltar ao corpo inteiro gastava ~0,9 s só na lista.
- Medir pausas da troca com o painel oculto: um laço de `MessageChannel` (não é limitado em segundo plano como `setTimeout`) registra intervalos > 50 ms.
- Lotes de desenho são fatias por altura (≤ 250 mil triângulos), para o recorte de câmera descartar o que está fora da tela.
- `moveCamera` zera a inércia do OrbitControls antes de animar.
- Versão leve em movimento: cada lote ganha uma cópia simplificada por agrupamento de vértices numa grade de 2,5 mm (`lod-worker.js`, Web Worker). `renderBatches.updateDetail()` (chamado em `drawScene`) só a usa durante o movimento e enquanto a célula ocupa até ~3 px; o quadro parado usa sempre a malha completa. Com todas as camadas: ~10,4 → ~4,0 milhões de triângulos no giro. Verificação: `.atlasCompareLod()` e `.atlasCaptureLod()`.
- O índice de toque (BVH, `picking-index.js`) é montado em blocos que não podem ser interrompidos (~90 ms para 190 mil triângulos no PC). `deferPickingIndex()` adia a montagem enquanto a câmera se move (chamado em `noteMotion` e no início do gesto); sem índice, o toque usa o raycast comum.
- Seleção no corpo: raio-X (`updateXray`) desenha em dourado só as partes encobertas da peça; não deixe os outros órgãos transparentes (transparência em massa desfaz os lotes e multiplica o custo).
- Nada de `backdrop-filter` sobre o canvas: o navegador refaz o desfoque a cada quadro.
- Gavetas do iPad: enquanto `setViewInset` anima o deslocamento da projeção, os quadros seguem a via de movimento (`noteMotion`, sem oclusão); o quadro final, cheio, vem 160 ms depois.
- Seleção: o contorno dourado entra com a câmera (`selectionFade` em `selection-highlight.js`, 1 em todo quadro parado). `moveCamera` dura 420–850 ms conforme o percurso e é instantâneo com `prefers-reduced-motion`.
- Medição: Ajustes → "Mostrar FPS". No console: `document.getElementById('anatomy-canvas').atlasRenderStats()` (chamadas, triângulos e peças por sistema) `.atlasCompareBatches()` (diferença de pixels entre lotes e desenho peça a peça; deve ficar perto de zero) e `.atlasCompareMotion(0.75)` (quadro em movimento contra o quadro direto).

## Convenções

- JavaScript moderno em ES modules puros, sem TypeScript nem transpilação. O código é denso (muitas funções em uma linha, nomes curtos); mantenha esse estilo ao editar.
- Texto visível ao usuário e mensagens de erro em português.
- Dispositivos de toque (`touchDevice` em `app.js`) recebem perfis mais leves (`mobile: true`, arquivos `*-touch*.bin`, texturas 2048 como `histology-*-2k.png`). Em toque, `adaptQuality` baixa a resolução de renderização uma vez se o giro ficar abaixo de ~28 fps, e a exportação usa 2560×1440 pelo menu Compartilhar.
- Alvos de toque no tablet: no mínimo 44 px. Campos de texto com fonte ≥ 16 px (evita o zoom automático do Safari).
- Os wrappers `#viewer-settings` e `#detail-drawer` usam `display:contents` fora do tablet, então não afetam o grid do layout de computador.
- O conteúdo é educacional e conservador: a documentação e os textos declaram explicitamente limites, escalas e fontes. Não afirme precisão anatômica que o modelo não tem.
