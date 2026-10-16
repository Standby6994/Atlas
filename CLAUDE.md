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
- `anatomy-info.js`: sistemas do corpo (`MODEL_SYSTEMS`), normalização e tradução de nomes de malhas.
- `core-mapping.js`: liga nomes de malhas dos GLBs às entradas canônicas de estudo.
- `simulation-engine.js`: simulações fisiológicas.
- `smart-search.js`, `picking-index.js` (raycast com BVH em `vendor/bvh`), `selection-highlight.js`.
- `learning-details.js` + `microscopy-viewer.js`: painéis de detalhe e visualizador de microfotografias.
- `study-*.js`, `practice-session.js`: sessão de estudo, rotas de entrada, conexões entre tópicos e rascunhos da prática discursiva (persistidos em `localStorage`).
- `tissue-materials.js`: acabamento procedural dos tecidos.

### Geradores de modelos 3D (carregados sob demanda)
- Cortes autorais de órgãos: `heart-*.js`, `ovary-interior-model.js`, `reproductive-interior-models.js`, `renal-*`, `pulmonary-*`, `stomach-*`, `small-intestine-*`, `large-intestine-*`, `esophagus-*`. Vários decodificam malhas pré-calculadas de `assets/interiors/*.bin` com perfis `desktop` e `touch`.
- `internal-models.js`: modelos internos procedurais e pool de geometria/material compartilhado (`createOrganModelContext`).
- `reference-organ-models.js`: órgãos de referência a partir de `models/reference/*.glb`.
- Histologia: `histology-models.js`, `histology-geometry.js`, `histology-materials.js`, `gastric-histology-models.js`, `colon-histology-models.js` (estes últimos leem `assets/histology/*.bin`).
- Citologia: `cytology-models.js`, `cytology-organelles.js`, `cytology-processes.js`, `cytology-surfaces.js`, `cytology-materials.js`, `cytology-tools.js`.
- Botânica: `botany-models.js`. Outros: `micro-models.js`, `supplementary-models.js`.

### Dados e assets
- `data/*.json`: todo o conteúdo textual (fisiologia, simulações, léxico, sistemas, fontes, citologia, botânica, histologia, conexões de estudo, cobertura). Carregados por `getJSON()` em `app.js` ou por `fetch(new URL(..., import.meta.url))` nos módulos.
- `models/*.glb`: modelos de corpo inteiro por sistema (Draco; decoder em `models/draco/`). `models/reference/`: órgãos individuais (HRA). Licenças e atribuições ficam ao lado e devem ser preservadas.
- `assets/`: texturas procedurais (citologia/histologia) e malhas binárias dos cortes.
- `images/`: microfotografias reais com `ATTRIBUTION*.md`.
- `vendor/`: Three.js, addons (OrbitControls, GLTFLoader, DRACOLoader, BufferGeometryUtils) e three-mesh-bvh, versionados sem npm. Não editar.

### Documentação
- `MODELOS-ANATOMICOS.md` e `COBERTURA-MODELOS.md`: inventário dos modelos, contagens, proveniência e limites. Atualize as contagens se adicionar peças ou vistas.

## Convenções

- JavaScript moderno em ES modules puros, sem TypeScript nem transpilação. O código é denso (muitas funções em uma linha, nomes curtos); mantenha esse estilo ao editar.
- Texto visível ao usuário e mensagens de erro em português.
- Dispositivos de toque (`touchDevice` em `app.js`) recebem perfis mais leves (`mobile: true`, arquivos `*-touch*.bin`, texturas 2048 como `histology-*-2k.png`). Em toque, `adaptQuality` baixa a resolução de renderização uma vez se o giro ficar abaixo de ~28 fps, e a exportação usa 2560×1440 pelo menu Compartilhar.
- Alvos de toque no tablet: no mínimo 44 px. Campos de texto com fonte ≥ 16 px (evita o zoom automático do Safari).
- Os wrappers `#viewer-settings` e `#detail-drawer` usam `display:contents` fora do tablet, então não afetam o grid do layout de computador.
- O conteúdo é educacional e conservador: a documentação e os textos declaram explicitamente limites, escalas e fontes. Não afirme precisão anatômica que o modelo não tem.
