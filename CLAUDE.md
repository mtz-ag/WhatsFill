# WhatsFill+IA — Guia para Claude Code

> **Este é o branch `claude/whatsfill-ia`.** O WhatsFill normal vive em
> `claude/extensao-claude-analise-i9spxw` e continua sendo a ferramenta de produção dele. Tudo
> abaixo vale para os dois; o que é exclusivo daqui está na seção **Avaliação por IA**.
>
> Conserto que vale para os dois: faça no branch normal e traga para cá com merge. Duplicar
> `panel.js` (6.000+ linhas) é como as duas versões divergem em uma semana.
>
> **A série da versão diz qual das duas está carregada: produção é `0.x`, este branch é `1.x`.**
> As duas carregam da MESMA pasta, então dar checkout aqui troca a extensão em produção sem
> avisar ninguém — o nome (`WhatsFill+IA`) e a série são os únicos sinais. A regra anterior era
> "versão sempre maior na IA" e quebrou no primeiro dia em que as duas subiram (31/08): regra que
> exige alguém lembrar não é regra.

> **Este é o branch `claude/extensao-claude-analise-i9spxw`** — a ferramenta de produção dele, e
> onde o trabalho normal acontece.
>
> **Existe um segundo branch: `claude/whatsfill-ia`** (WhatsFill+IA), que soma uma avaliação de
> contexto por IA. Ele não vai para produção e **nada de IA entra aqui** — a regra "Sem IA na
> extração" continua valendo neste branch. Conserto que vale para os dois: faça AQUI e leve para
> lá com merge. Duplicar `panel.js` (6.000+ linhas) é como as duas versões divergem em uma semana.

## PROTOCOLO OBRIGATÓRIO ANTES DE QUALQUER EXECUÇÃO

> Antes de implementar, refatorar ou executar qualquer tarefa, SEMPRE verifique:
>
> 0. **`REGRAS.md`** — a lista das regras que ELE ditou, com **onde cada uma vive** (código, quadro
>    ou Config). Serve para uma coisa: antes de mexer, saber se a regra que você vai tocar está no
>    código (vale sempre) ou depende de um campo preenchido / de ele ter importado o quadro.
> 1. **`registro.md`** — log de mudanças, decisões e pendências. **A entrada do TOPO é a de
>    passagem de contexto** (*"ESTADO DE AGORA"*): é a única que descreve o presente — o que está
>    no ar, o que espera decisão dele e o que ele precisa fazer na mão. Se a versão do
>    `manifest.json` for maior que a do título dela, ela envelheceu: confira antes de confiar, e
>    **reescreva-a** em vez de acrescentar uma segunda.
> 2. **`CLAUDE.md`** (este arquivo) — regras e armadilhas conhecidas
> 3. **`README.md`** — arquitetura, medições ao vivo e o porquê de cada escolha
>
> Ao concluir tarefa significativa, registre no **TOPO** do `registro.md`.

---

## Visão Geral

Extensão Chrome (MV3) que acelera o atendimento no **mobiliza.app**: classifica o contato a
partir do que ele escreveu, aplica etiquetas e envia respostas prontas ou modelos aprovados.
O painel fica **encaixado na borda direita da página**, empurrando o layout em vez de cobri-lo.

**Objetivo final: automação.** O atendimento é assíncrono — pede nome/cidade, passa ao próximo,
volta quando a pessoa responde. Na reabertura a classificação já tem que estar feita.

### Estrutura

```
manifest.json           MV3, permissões mínimas ("storage" + "power" + host_permissions)
src/background.js       clique no ícone: encaixa na aba ou abre janela separada
src/page-hook.js        mundo MAIN: captura o Bearer e grava requisições
src/content.js          carregador (content script clássico -> import dinâmico)
src/main.js             monta o painel encaixado e a ponte de mensagens
src/window.html/.js     o mesmo painel em janela separada (modo secundário)
src/panel/panel.js      a interface (arquivo grande; o resto é biblioteca)
src/lib/dom.js          ÚNICO arquivo com seletores da página
src/lib/dock.js         empurra a página (padding no html) em vez de cobri-la
src/lib/page.js         interface única: chamada direta na aba, mensagem na janela
src/lib/rpc.js|rpc-host.js  ponte painel <-> aba
src/lib/bus.js          ponte mundo MAIN <-> ISOLATED (token só em memória)
src/lib/api.js          rotas da API, transporte plugável
src/lib/contract.js     contrato de escrita aprendido (puro, testado)
src/lib/recorder.js     captura as requisições que ensinam o contrato
src/lib/fields.js       schema, leitura e escrita de campos personalizados
src/lib/extract.js      parser determinístico
src/lib/cities.js       municípios do IBGE, normalização, cidade -> link
src/lib/tags.js         etiquetas: COREDE, regras de conteúdo
src/lib/categorizar.js  etiqueta de CIDADE para a base inteira (puro, testado)
src/lib/hsm.js          modelos de mensagem aprovados
src/lib/vars.js         variáveis dos templates e bloqueio por variável faltante
src/lib/ia.js           prompt, esquema e TRAVAS da decisão por IA (puro, testado)
src/lib/ia-cliente.js   ponte painel <-> service worker (a chave nunca entra na página)
src/lib/sugestao.js     tabela de regras da rodada, e os verbetes dela (puro, testado)
src/lib/arvore.js       o fluxo como ARVORE: sinais, ramos dele, decisao (puro, testado)
src/lib/anuncios.js     ANUNCIOS do momento: texto que reconhece + o que fazer (puro, testado)
src/lib/observacoes.js  o caderno das sugestoes erradas, com o caso junto (puro, testado)
src/fluxo.html/.css/.js JANELA do fluxo: o QUADRO (caixas soltas, fios, arrastar, editar)
src/lib/fluxo-msg.js    a mensagem que pede ao service worker para abrir a janela
src/data/coredes-rs.json  município -> COREDE (planilha oficial da SPGG-RS)
tools/make-icons.mjs    desenha os ícones
tests/*.test.mjs        Node puro, sem dependência
```

O resto da submissão na loja (`STORE.md`, `PRIVACY.md`, `tools/package.mjs` e o ícone promo) foi
apagado em 02/09/2026 — está no histórico do git se algum dia voltar a fazer sentido.

### Stack

JavaScript puro, ES modules, **sem build step**. Node 18+ só para os testes.

---

## Armadilhas desta API (custaram horas — não redescubra)

- **`GET /core/v1/contact/{id}` precisa de `isToIncludeCustomFields=true`.** Sem isso devolve
  `customFieldValues: []` com status 200, e a extensão acha que todo contato está vazio.
- **A API responde 200 e IGNORA o valor** quando o formato não serve. Por isso toda escrita é
  conferida relendo o contato. Nunca confie no 2xx.
- **`DATE` e `MULTISELECT` exigem contrato próprio.** Cair no contrato de texto manda o valor em
  `valueString` num campo que guarda em `valuesDateTime`/`valuesId` — 200 sem gravar.
- **Nunca resolva campo por `key`.** As keys estão desalinhadas dos rótulos neste ambiente
  ("Data de conclusão" tem key `data-de-atualiza-o-d`). Sempre pelo `name` exato do schema.
- **A API valida `Origin`.** Requisição fora da aba do mobiliza volta `500 Origin not allowed`.
- **O painel nativo "Dados do contato" não se atualiza** após escrita externa; só relê no F5.
  Não use ele para verificar nada.
- **A PASTA DO REPOSITORIO E A EXTENSAO, entao arquivo temporario ali quebra o carregamento.**
  Nome comecando com `_` e reservado pelo Chrome: um `_s.cjs` que eu deixei na raiz derrubou a
  extensao inteira com *"Cannot load extension with file or directory name _s.cjs"* e
  *"Nao foi possivel carregar manifesto"* (01/09/2026). O erro nao aponta para o codigo, aponta
  para o manifesto — da a impressao de que o manifesto quebrou.
  **Script de apoio vai para a pasta de rascunho fora do repositorio, nunca para a raiz.** Se for
  inevitavel criar na raiz, apague no mesmo comando. `tests/_harness.mjs` e do projeto e nao
  incomoda: o Chrome reclama do que esta na RAIZ.
- **Recarregar a extensão órfã as abas abertas** (`Extension context invalidated`): o painel
  falha em silêncio até dar F5. Já causou diagnóstico errado duas vezes.
- **Uma pasta, DUAS extensões — e trocar de branch troca o que o Chrome carrega.** O Chrome
  carrega de `OneDrive/Documents/GitHub/WhatsFill`, que é o repositório: dar checkout no
  `claude/whatsfill-ia` troca a extensão em produção pela da IA, sem avisar ninguém. É por isso
  que os dois sinais existem: o **nome** (`WhatsFill` aqui, `WhatsFill+IA` lá) e a **série da
  versão** — produção é **0.x**, o branch da IA é **1.x**. A série é o que não precisa de
  manutenção: "sempre maior na IA" quebra na primeira vez que os dois sobem no mesmo dia, e
  quebrou (31/08). Em 29/08 isto
  aconteceu ao contrário e pareceu que a IA tinha vazado para produção — o sintoma foi
  `git status` acusando 17 arquivos que ninguém editou, todos idênticos ao outro branch.
  **Antes de apagar arquivo que não deveria estar aí, rode `git status` e compare com o outro
  branch**: apagar o órfão à mão é o conserto errado (ele volta no checkout, e um commit
  descuidado apaga o trabalho do outro branch). O certo é `git restore .` + checkout do branch
  certo. Para usar as duas ao mesmo tempo, `git worktree` em pasta separada.
- **"O fix não funcionou" pode ser "o fix não chegou".** A pasta que o Chrome carrega não é
  necessariamente a que o GitHub Desktop atualiza — cópia da extensão DENTRO da pasta da
  extensão (zip descompactado, `dist/`, que é gitignorado) fica congelada para sempre. Custou uma
  tarde de correção em cima de código que nunca rodou. **Antes de qualquer diagnóstico, confira a
  versão no cabeçalho do painel** (`versaoCarregada`) contra a do `manifest.json`, e o "Carregado
  de" em `chrome://extensions` contra o caminho do repositório. Mudou comportamento visível?
  **Suba a `version` do manifesto no mesmo commit** — é o que torna a conferência possível.
- **Rajada de requisições derruba a API — e a plataforma junto.** `Failed to fetch` não é erro
  HTTP: é o preflight CORS recusado, o que um limitador de taxa devolve. Cada contato aberto
  custa uma sessão na plataforma + 3 chamadas nossas, então **toda volta de laço precisa de
  respiro**, não só as que enviam.
- **O pior instante para gastar rede é o que a extensão escolhia sozinha.** "Erro de carregamento
  ao iniciar o atendimento" foi isso: `load()` disparava no instante da troca de URL, junto com a
  rajada da própria plataforma para o MESMO atendimento. Some com `reexaminarMensagens` refazendo
  a leitura a cada mudança do sinal de conversa (que muda várias vezes durante a renderização) e
  com o cache de modelos guardando um canal só (a conta alterna instâncias) — 10 a 14 requisições
  por contato aberto. Hoje: `ESPERA_LOAD_MS`/`ESPERA_REEXAME_MS` e cache por canal. **Reação de
  tela é imediata; só a rede espera** — o contrário parece painel travado.
- **Desenho não é escolha: `renderAll()` roda o tempo todo.** Rede disparada de dentro de um
  `render*` vira uma requisição por redesenho (troca de atendimento, mensagem nova, cada
  `setStatus`) — e a guarda "só se ainda não carregou" só segura depois do SUCESSO, então a
  listagem que falha repete justo quando o certo era parar. Carregamento de aba nasce do
  **clique** (ver `prepararCidades`), e falha vira botão de tentar de novo, nunca nova tentativa
  automática.
- **Antes de culpar o laço de 500ms, meça.** `pageStateLocal` parece caro (`isConcluded` varre
  `span, div` lendo `textContent`) e não é: 2,9 ms com 800 mensagens na tela, medido com
  Playwright. Um "conserto" ali teria custado uma tarde sem tocar no problema real, que era rede.
- **Reabrir o atendimento NÃO reabre a janela de 24h.** Ela é regra do WhatsApp, não da
  plataforma: depois do Reiniciar, texto livre continua não chegando em quem está sem retorno há
  dias. Na rodada dos concluídos só sai modelo aprovado.
- **A lista de concluídos é o ÚNICO gancho de fila sem `data-cy` conhecido.** É o ícone de caixa
  ao lado de "Outros", e adivinhar nome de `data-cy`/ícone **falhou na máquina dele**. A rodada
  agora **clica e confere**: candidatos são os clicáveis da barra que não são as três abas nem
  busca; a confirmação é por eliminação (estar nos concluídos = nenhuma aba de texto com
  `bg-gray-300`); errou, desfaz e tenta o próximo. Achou o `data-cy` de verdade? Ponha em
  `CY_CONCLUIDOS` e a tentativa nem roda.
- **A fila carrega 50 por vez.** O resto só vem no "Ver mais", que é manual e é o único gancho
  da fila sem `data-cy`. Sem clicar nele, a rodada enxerga uma fatia e acha que acabou.
- **`getIncomingText` só devolve mensagem COM TEXTO — figura é invisível para a rodada.** Quem
  manda só uma imagem (o "bom dia" ilustrado, comum nesta base) chegava como *"não escreveu
  nada"* e era assumido sem receber resposta. O tipo vem no campo `type` de
  `/chat/v1/message` (`TEXT`, `IMAGE`, `STICKER`, `AUDIO`, `VIDEO`, `DOCUMENT`; direção é
  `TO_HUB`/`FROM_HUB`) — conferido no bundle em 29/08/2026. Quem precisa enxergar mídia usa
  `getConversation().entrantes`, que traz `{texto, tipo}` **sem** filtrar; `incoming` continua
  sendo só texto, porque é a base do parser e parser não lê figura.
- **O contador de "Meus" da plataforma NÃO é o total — ela pede para a API não contar.** Ao abrir
  a aba, o app chama `GET /chat/v6/session?skipCount=true&…&statuses=IN_PROGRESS&userId=…`, e com
  `skipCount=true` a resposta vem com `totalItems: 0`. Medido lado a lado em 30/08/2026: badge
  **76**, total real **353**. Para saber o número de verdade é a mesma rota com
  `skipCount=false` e `pageSize=1` (só o `totalItems` interessa). O `userId` sai de
  `GET /core/v1/agent/me` (campo `userId`) — descobrir por ali, e não decodificando o Bearer, é
  o que faz funcionar também no modo janela, onde o token nunca chega ao painel.
- **Progresso do dia é `COMPLETED` + `timestampFilter`, NÃO a queda dos abertos.** O total de
  abertos sobe quando chega gente nova: medido ao vivo, foi de 353 a 359 enquanto se conversava.
  Quem usa "abertos" como medida de progresso vê o número CRESCER num dia de trabalho bom. Os
  status válidos de `/chat/v6/session` são `IN_PROGRESS`, `COMPLETED` e `PENDING` — qualquer
  outro nome devolve 400 (sondados: RESOLVED, DONE, CLOSED, FINISHED, ARCHIVED, NEW, OPEN).
  `timestampFilter` com a meia-noite LOCAL filtra pela ATUALIZAÇÃO (quando foi concluído); com
  `timestampField=createdat` o número é outro — 82 contra 38, conferidos lado a lado.
- **A sessão NÃO é "a conversa de hoje", e 50 mensagens cegavam o painel.** Medido em
  30/08/2026 num atendimento comum: sessão criada em **20/07**, ainda aberta em **30/08** (41
  dias), com **168 mensagens em 4 páginas**. `getMessages` lia só a página 1 — os últimos 20
  dias —, então **118 mensagens eram invisíveis**. Era esta a causa de "não reconhece o conteúdo
  quando é do dia anterior": o pedido estava lá, numa mensagem que ninguém leu. Hoje são 200 por
  página, com segunda página quando `isLastPage` for `false`. **Subir o `pageSize` não custa
  requisição** — é a mesma chamada com resposta maior, e nesta API o que derruba é número de
  requisições, não tamanho de resposta.
- **O áudio traz a TRANSCRIÇÃO na própria mensagem: `details.transcription.text`.** Conferido ao
  vivo em 31/08/2026: de 12 mídias, 9 tinham transcrição (uma com 2838 caracteres). É o que a
  plataforma mostra na tela como "Transcrição". Sem ler esse campo, áudio chega como mensagem
  VAZIA — o botão de copiar a conversa copiava cinco `[audio]` e mais nada. `getConversation`
  devolve isso em `entrantes[].texto` com a marca `transcrito: true`. **O parser LÊ a transcrição, mas sempre rebaixada** (decisão dele, 31/08): passa por
  `extract.rebaixarParaPalpite`, que força `confidence: 'aproximada'` (fica fora da gravação
  automática — só `crm`/`exata` gravam sozinhos) e `informada: false` (não substitui o que já
  está no CRM, porque substituir exige a pessoa ter ESCRITO). Roda depois da passada normal,
  então o que foi digitado sempre ganha do que foi falado. Tem teste; se ele cair, transcrição
  volta a poder ser gravada sozinha em eleitor real.
- **`` NÃO funciona antes de palavra acentuada.** `` é fronteira de `w`, e `é` não é `w`:
  `/é nós/` **nunca** casa no começo da string. Foi assim que "É nós." — a frase exata que ele
  mandou de exemplo — passou batido na primeira versão do detector de despedida. Em padrão que
  começa com acento use `(^|s)`. Vale para todo o vocabulário daqui: "é nós", "ótimo", "amém".
- **A lista de etiquetas da caixa da rodada NÃO é a do contato.** Ela vem de `tagSuggestions` —
  só o que a rodada sugere ou reconhece. No contato da print (31/08) a caixa mostrava 3 etiquetas
  e o cabeçalho da plataforma mostrava 5, e a que faltava era justamente a que deveria dispensar
  o contato da fila. Regra que decide por etiqueta tem que ler `state.contact.tagsId` cruzado
  com `tagsLib.allTags()`, nunca a lista da tela.
- **`templatesLib.wasSent` só enxerga o que saiu PELO PAINEL.** Modelo disparado pela automação
  da plataforma, pelo chatbot do anúncio ou à mão por outra pessoa não deixa rastro ali — e a
  rodada sugeria "mande o modelo" para quem estava com o modelo na tela algumas mensagens acima
  (31/08). Quem precisa saber o que JÁ FOI usa `getConversation().nossas` (o que mandamos, com
  texto) ou `nossaUltimaAt` (quando). O registro de envios continua valendo para anti-duplicata
  do próprio painel; ele só não é a verdade sobre a conversa.
- **A origem do anúncio é DADO, não texto.** O bloco "ANÚNCIO | FACEBOOK" com o link `fb.me` que
  aparece no topo da conversa vem da sessão: `utm.source` ("FACEBOOK"), `utm.campaign`,
  `utm.referralUrl` e `utm.sourceId` (conferidos ao vivo em 31/08/2026). Casar isso por regra de
  texto é adivinhar o que já está dito num campo. O painel manda os quatro para o texto das
  regras e usa `utm.source`/`utm.referralUrl` para a etiqueta de anúncio.
- **Rota nova? Leia o bundle do app em vez de chutar.** Quando a navegação está bloqueada e não dá
  para inspecionar a rede, o `main.*.js` do mobiliza é a fonte da verdade e está a um `fetch` de
  distância — as URLs, os métodos e os parâmetros estão como texto no código Angular. Foi assim que
  saíram `listContacts` e `createTag` (20/08/2026), e foi assim que dois chutes meus caíram:
  **`isToIncludeCustomFieldValues`** (a listagem) é parâmetro DIFERENTE de
  `isToIncludeCustomFields` (o `GET` individual) — com o nome errado a API responde 200 e ignora,
  e a categorização teria concluído "nenhum contato tem cidade"; e **criar etiqueta é `PUT`, não
  `POST`**, com body `{message, textColor, bgColor}`. Receita:
  `fetch('/main.<hash>.js').then(r=>r.text())` e procure `core/v\d+/<recurso>`.
- **Ler o código do app ≠ ter executado a rota.** `listContacts` e `createTag` foram lidas, não
  chamadas. Por isso a aba Cidades cria **uma** etiqueta como sonda antes das outras: se a primeira
  falhar, nenhuma outra é tentada.
- **`POST /core/v1/contact/filter` filtra POR ETIQUETA — e o campo mora num chunk lazy.** Procurar
  o filtro no `main.js` leva à conclusão errada (foi o que aconteceu): lá só existe `textSearch` e
  `tagsIdBySearchText`, que é de sessões de chat e significa "procurar texto entre as etiquetas".
  O filtro da tela de Contatos está no chunk próprio dela (`2647.*.js`, componente
  `contacts-filter`, método `submitFilter`) e aceita: `name`, `phonenumber`, `instagram`, `email`,
  **`tagsId` + `tagsOperator`** ('OR'), **`exceptTagsId` + `exceptTagsOperator`**, `origins`,
  `importedAt`, `portfolioIds`, `customFieldValuesFilters`. `exceptTagsId` é o que permite pedir
  "tem SERRA e ainda NÃO tem a etiqueta de cidade" sem baixar a base.
  **Lição:** rota de tela lazy não está no `main.js` — pegue a lista de chunks no `runtime.*.js`
  e varra todos (são estáticos, não a API: varrer não tem custo de rate limit).
- **A aba Cidades grava cidade E COREDE na mesma requisição.** O COREDE é derivado da cidade e
  `applyTags` aceita array, então somar não custa escrita a mais. **Cuidado com o apelido:** o nome
  do COREDE na planilha não é sempre o da etiqueta no CRM ("Paranhana Encosta da Serra" está como
  "Vale do Paranhana"), e `store.tagAliases` é o que resolve — em `analisarParaCidades` os apelidos
  são achatados como chaves extras do mapa. Sem isso, COREDE existente vira "falta criar" e
  duplica a etiqueta com outro nome.
- **COREDE não é Região Metropolitana, e a diferença parece bug.** Canoas está na RMPA e o COREDE
  dela é **Vale do Rio dos Sinos**, não Metropolitano Delta do Jacuí — junto de Esteio, Sapucaia e
  São Leopoldo. Foi conferido em 01/09/2026 contra a composição oficial: as duas listas do
  `coredes-rs.json` batem município a município. **Antes de "corrigir" um COREDE que parece errado,
  confira o arquivo contra a planilha da SPGG** — mudar o mapa por intuição de proximidade
  geográfica erra a etiqueta de milhares de contatos de uma vez, e o filtro dele passa a mentir.
  Se o COREDE certo aparecer errado na TELA, o suspeito é o rótulo (ver `store.tagAliases` acima),
  não o dado.
- **O CRM tem etiquetas de RÓTULO REPETIDO, então nunca compare etiqueta por id.** Ele tem
  "1 Sem Retorno"/"2 Sem Retorno", e apareceu "Serra" duas vezes com ids diferentes: um mapa
  `nome → etiqueta` guarda uma e o contato carrega a outra. Comparar id produziu
  `Caxias do Sul → Serra (tem: Serra)` em 1293 contatos. Compare **rótulo normalizado** — é o que
  o filtro da plataforma usa. `categorizar.etiquetasComRotuloRepetido` detecta e a aba avisa.
- **Toda escrita em massa precisa de SONDA que relê.** "A API responde 200 e ignora" vale igual na
  aba Cidades: ela contava como gravado sem conferir, e podia relatar 5 mil sucessos com zero
  etiqueta aplicada — descoberto só quando alguém foi procurar os contatos no CRM. Hoje o primeiro
  gravado de cada lote é relido (`conferirEtiquetasGravadas`) e o lote para se não entrou. Uma
  leitura por lote basta: pegar formato errado exige um exemplo, não auditoria.
- **"Nada falta aplicar" NÃO significa "está pronto".** Se a etiqueta que o contato deveria ter
  ainda não existe no CRM, ela nem entra na lista de alvos — e a conta ingênua conclui que o
  contato está completo. Foi assim que 6002 apareceram como "já com cidade e COREDE" no dia em que
  só 20 tinham sido gravados: contatos com o COREDE aplicado e a etiqueta de cidade inexistente.
  Em `categorizar.analisar` a ordem dos baldes é por urgência (`paraGravar` → `esperandoCriacao` →
  `jaOk`) e `precisaCriar` é o que separa os dois últimos. Tem teste de regressão.
- **Aplicar o COREDE certo não tira o errado.** Contato cuja cidade é de um COREDE mas que carrega
  a etiqueta de outro fica com os DOIS, e passa a aparecer no filtro das duas regiões.
  `coredeDivergente` detecta e a tela avisa — **não remove**, porque pode ser a cidade que está
  errada, e remover etiqueta é destrutivo.
- **`faltamCriar` conta ETIQUETAS, `esperandoCriacao` conta CONTATOS.** Um contato pode faltar as
  duas (cidade e COREDE). Misturar as duas unidades na tela já gerou a pergunta *"os 586 tem cidade
  porque 43 etiquetas?"* — toda contagem exibida diz a unidade, e a tela confere a soma.
- **Etiqueta de cidade é o nome do município e nada mais** — sem prefixo (decisão dele, 20/08:
  *"deixe somente caxias do sul"*). É seguro porque **nenhum dos 497 municípios do RS tem o mesmo
  nome de um dos 28 COREDEs** (conferido, e há teste travando isso): cidade e região não colidem.
- **Etiqueta com nome errado se conserta RENOMEANDO, não mexendo nos contatos.**
  `POST /core/v1/tag/{id}` (sim: `POST` atualiza, `PUT` cria) muda o rótulo, e todos que a têm
  passam a mostrar o nome novo — uma requisição, em vez de duas por contato, e sem janela em que o
  contato fica sem etiqueta. Passe as cores ATUAIS no body: omitir reseta a cor sem querer.
- **`normalize` NÃO serve para conferir grafia** — ela aplica os ALIASES ("sto" → "santo", "poa" →
  "porto alegre"), então "Sto Angelo" e "Santo Ângelo" ficam idênticos e o campo abreviado passa
  por correto. Para comparar o que está ESCRITO use `cities.semAcentoNemCaixa`.
  `cities.conferirGrafia` é quem decide, e a regra que a mantém útil é: **acento e caixa não são
  erro** (resolvem para o mesmo município e geram a mesma etiqueta) — avisar disso treinaria a
  ignorar o aviso.
- **A cidade sumia quando a conversa tinha MAIS DE UMA mensagem.** `extract` chamava
  `matchCityComContexto(joined)` — a conversa inteira colada num texto so —, e dentro dela o caminho
  *"texto curto e a propria resposta"* exige **30 caracteres**. Ou seja: funcionava apenas com UMA
  mensagem; qualquer segunda, mesmo um "oi", estourava o limite e a cidade sumia. Explicou tres
  anotacoes dele de uma vez (*"cidade vazia mas ela respondeu"*, *"nao pegou cidade"*, e a Silvia
  concluida em silencio depois de responder). Hoje a busca e **mensagem a mensagem, da mais nova
  para a mais antiga** — os tres caminhos sao os mesmos, o que mudou foi onde procuram. Bonus: a
  pista de uma mensagem nao alcanca mais o texto da seguinte, que a juncao permitia.
- **A acao do ANUNCIO e do momento da CHEGADA, e sem trava ela se repete para sempre.** Duas
  anotacoes de 03/09/2026: a **Lucia** ja tinha dado nome, cidade e confirmado presenca, e a caixa
  oferecia de novo a resposta pronta do anuncio; o **Deoclecio** ja tinha mandado seis videos depois
  disso. A causa e a armadilha ja registrada — **o texto do anuncio fica na conversa para sempre** —
  e a trava que existia (`silencio`) cobre so quem decidiu nao mandar NADA. Hoje
  `decidirComAnuncio` recebe `jaSaiu`, e quem calcula pergunta a **CONVERSA**, nunca ao registro de
  envios: `resposta` olha se aquele texto (com as variantes) ja saiu, `dados` usa
  `jaPediramDados`, que casa pelo invariante `Nome / Cidade`. **Acao configurada e do momento da
  chegada: cumprida, o anuncio se cala e o quadro decide.**
- **Comparar com o modelo "da vez" nao serve depois que o padrao passou a REVEZAR entre tres.**
  `modeloJaNaConversa` olhava so o modelo que sairia agora; bastava a roleta andar entre duas
  passadas para o recibo ser reenviado (anotacoes da Mary e da Eliana, 02/09). Hoje, quando a
  escolha e `deOnde: 'padrao'`, a conferencia varre os TRES — eles dizem a mesma coisa, entao ter
  recebido um e ter recebido o recibo. Regra geral: **conferencia de duplicata tem que cobrir todo
  o conjunto que pode sair, nao o item sorteado.**
- **"Nao mande o mesmo conteudo de novo" pressupoe que o conteudo e o mesmo.**
  `voltou-por-outro-anuncio` mandava a mensagem do momento para quem voltava clicando num anuncio
  cujo modelo NUNCA tinha saido (anotacao da Eroni, 03/09). Ela passou a exigir
  `modeloJaNaConversa`: para o Telmo (mesmo modelo, mesmo dia) continua verdadeiro, para quem pediu
  outra coisa e falso e o caso desce para `anuncio-modelo-e-dados`.
- **`etiqueta-dispensa-da-fila` DEIXOU DE SER PROTECAO** (pedido dele, 03/09, anotacao do Paulo
  Cezar): *"engajado recebe mensagem do momento uma vez por dia e depois toda vez que aparecer pode
  concluir em vez de pular"*. Pular deixava o atendimento ABERTO — o engajado que manda video o dia
  inteiro voltava a custar uma abertura por rodada, para sempre, sem nunca receber nada. Duas
  consequencias: ela nao barra mais a acao do anuncio (`efeito` deixou de ser `silencio`) e
  `remetenteDentroDeProtecao` nao a confere mais; **a protecao que continua de pe e
  `sem-interesse`**, com a despedida.
- **Pergunta sobre o que o mandato FAZ ("tem alguem que vem na casa da gente pra conversar") nao
  casava com nada.** Anotacao da Teresinha (03/09): sem "?", sem "por que", sem "qual a posicao" —
  e a rodada sugeriu CONCLUIR. *"a regra de sempre responder uma pergunta tem que valer"*. Entraram
  "tem alguem que/pra", "tem como" e "voces fazem/atendem/vem" em `PERGUNTAS_QUE_PEDEM_VOCE`, que
  sao guardadas por POSICAO (comeco da mensagem ou "?") — sem essa guarda, *"aqui tem alguem que
  apoia voces"* viraria pergunta.
- **A ajuda financeira VOLTOU para cima do modelo, desfazendo a decisao dele de 02/09.** Anotacao
  da Regina (03/09), que escreveu *"Eu preciso pagar umas contas que estao muito atrasada"* e
  recebeu o modelo padrao: *"modelo fora de contexto, ela quer ajuda financeira, mandar mensagem
  pronta referente"*. O argumento de 02/09 continua verdadeiro sobre o TEXTO (o modelo nao promete
  nada); o que o caso real mostrou e outra coisa — **propaganda como primeira resposta a um pedido
  de socorro e a resposta errada mesmo quando o texto e inofensivo.**

- **Quem escreve VARIAS mensagens seguidas esta conversando, e o tamanho de cada uma nao muda
  isso.** Print dele (03/09/2026, Porto Alegre): cinco mensagens sobre a cobertura da imprensa,
  duas delas perguntas, e a rodada mandou o MODELO e concluiu — *"quando tiver mensagens assim, ao
  menos tem que deixar aberta a conversa"*. Nada pegava: ~230 caracteres (o corte de texto longo e
  400), nao e reacao, nao e despedida, e *"ja tomaram providencias?"* nao esta em lista de pergunta
  nenhuma — ninguem cadastra isso. Hoje `conversaPedeRespostaPessoal` conta as mensagens
  PROPRIAS da rajada: **3 delas, ou 2 somando 250 caracteres**. Duas coisas a lembrar: os cortes
  foram calibrados em dois casos reais (este e a anotacao do jairoc) e mexer neles muda quanta
  gente sai da automacao; e a mensagem GERADA pelo anuncio **nao conta como propria**, senao quem
  clica em tres anuncios (a Eroni) vai para atendimento manual em vez de receber o modelo — mesmo
  criterio de `soExpressaApoio`, e o painel precisa passar `state.padroesDeAnuncio`.

- **Confirmacao de presenca em evento NAO se responde: pula, e ele atende no fim** (pedido dele,
  03/09/2026, print da Elci). Ela escreveu duas vezes *"Quero confirmar minha presenca no evento"*
  e recebeu *"Que bom!... Nome / Cidade"* + conclusao. Ele: *"nao e para responder, e para pular e
  eu atendo no final"*. A tecla e **2 e nao 3**: confirmacao de presenca nao e atendimento que se
  fecha, e uma LISTA que alguem monta — concluir tiraria da tela justamente quem ele quer atender
  depois. Isto **substituiu `confirmou-presenca-com-dados`** (tecla 8, do caso do Deoclecio em
  02/09), que foi apagada junto com a caixa "confirmou presenca no evento" do ramo "sem pendencia":
  duas regras para a mesma situacao divergem na primeira semana. O sinal e so o **"sim"** — quem
  responde que nao vai segue o fluxo normal, e o preambulo de evento continua no TEXTO da tecla 4.
  A regra esta em `arvore.PROTECOES`, entao vale mesmo antes de ele importar o quadro novo.
- **Botao "Baixar o padrao de hoje" na janela do fluxo** (pedido dele, 03/09: *"me de o botao de
  download, esse caminho ficou esquisito"*). Ele estava certo duas vezes: o caminho era uma pasta
  temporaria, e o problema de fundo e pior — **ele dependia de eu lembrar de gerar e mandar o
  arquivo**. Com o botao, o padrao de agora esta a um clique. Baixar nao mexe no quadro, de
  proposito: e o vizinho seguro do "Resetar para o padrao", que substitui tudo.

- **Toda caixa tem EXCECAO, e ela vale tambem nas caixas de REGRA** (pedido dele, 03/09/2026:
  *"algo que notei que esta faltando nos ramos e em geral: condicao de mandar mensagem e
  excecao"*). Ele apontou o buraco mais caro do quadro livre — o mesmo que `problemas` acusava sem
  poder resolver: a caixa dele PARECE a regra do codigo e tem o mesmo desfecho na tela, mas nao
  carrega as guardas dela (`!enviadoHoje && !modeloJaNaConversa`). Ate entao a unica forma de dizer
  "mande, mas nao quando X" era nao usar a caixa. Tres coisas a lembrar: a excecao e conferida
  **antes de tudo**, inclusive antes da `quando` da regra; ela so **ESTREITA** (nenhuma mensagem
  passa a sair por causa de uma excecao, algumas deixam de sair — por isso e seguro deixa-la mexer
  em caixa de regra, que era o unico lugar do quadro fechado para ele); e ela **conta como guarda
  no `repeteSozinha`**, com a polaridade invertida da condicao (o ENVIO tem que tornar a excecao
  verdadeira). `chaveDeComparacao` inclui a excecao: "mande o modelo" e "mande o modelo exceto
  quando ja mandamos" sao caixas diferentes, e trata-las como a mesma faria o cartao "O padrao
  mudou?" dizer que ele ja tem uma guarda que nao tem.

- **Mexeu no `fluxoPadrao`? Gere o arquivo e MANDE para ele no mesmo turno.** Combinado de
  03/09/2026: *"arrume o ramo, eu vou importar. Todas as mudancas feitas aqui, se afetarem o ramo,
  voce deve me passar o ramo atual"*. `node tools/exportar-fluxo.mjs <saida.json>` escreve o padrao
  de agora no formato que a janela importa, **confere relendo** (a peneira do `deArquivo` descarta
  regra que sumiu, sinal desconhecido e tecla inventada — arquivo que perde ramo na importacao
  chegaria a ele como "veio faltando pedaco") e imprime o fluxo em texto para conferir antes de
  mandar. **A saida vai FORA do repositorio**, que e a pasta que o Chrome carrega. E **nao commite
  um retrato**: snapshot envelhece no primeiro commit que mexe no padrao, e fluxo velho e pior que
  nenhum — ele reimporta e volta no tempo sem perceber. O gerador e versionado; o arquivo, nao.

- **PROTECAO do codigo vale mesmo fora do quadro dele — e este foi o custo de "nada entra
  sozinho".** O quadro e uma COPIA do padrao, e regra nova nunca chega nele: desenho certo, porque
  no quadro a POSICAO e a prioridade. O preco apareceu em 03/09/2026: ele reportou DUAS vezes no
  mesmo dia a conversa em que so nos falamos recebendo mensagem, eu criei `ultima-e-nossa`, e ela
  **nao podia decidir nada para ele** — existia so no padrao, esperando ele encaixar pelo cartao
  "O padrao mudou?", enquanto a mensagem continuava saindo para eleitor. A saida e a distincao
  entre **preferencia** (onde, o que, em que ordem: dele) e **protecao** ("nao mande nada": nao ha
  ordem em que seja outra coisa). `arvore.PROTECOES` e a lista, curta, e o criterio de entrada e
  duro: **efeito `silencio` na tabela e nenhum ramo que envie**. Tendo a caixa no quadro, quem
  decide e o QUADRO; desligada por ele, continua desligada. A lista so cobre a AUSENCIA, e o
  resultado carrega `id: 'protecao:<regra>'` e `caminho: ['protecao do codigo']`, para o Andamento
  dizer de onde veio.

- **Conversa que termina em mensagem NOSSA nao recebe nada — e a conversa VAZIA era a que
  escapava.** Print dele (03/09/2026): a conversa tinha so o nosso disparo, ele assumiu o
  atendimento e a rodada mandou o pedido de nome e cidade em cima. *"pegando conversas que a ultima
  mensagem foi minha e mandando mensagem, e pra concluir sem mandar nada"*. `hsm.decidirSemResposta`
  ja cobria parte disso e roda ANTES da tabela — mas ela olha `ultima`, e **numa conversa sem
  nenhuma mensagem do contato nao ha `ultima` do lado dele para olhar**: o caso descia ate
  `nunca-pediram-dados`, que envia. Hoje ha a regra `ultima-e-nossa` (tecla 3), com o sinal
  valendo `'vazia'` no segundo caso — string que e verdadeira e ainda diz na caixa QUAL dos dois e.
- **Etiqueta de ASSESSOR so conclui, e e lista SEPARADA da que dispensa da fila.** Pedido dele
  (03/09): *"contatos com etiqueta de assessor so conclua"*. A outra lista hoje manda a mensagem do
  momento uma vez; esta nao manda **nada, nunca** — quem trabalha no mandato nao e publico de
  material de campanha. `etiqueta-so-conclui` fica ACIMA de `etiqueta-dispensa-da-fila`, porque as
  duas casariam no mesmo contato e o desfecho mais silencioso tem que ganhar.
- **Lista de etiquetas casa por trecho CONTIDO, e por isso precisou de EXCECAO.** `assessor` pegava
  as tres etiquetas de assessor **e tambem `CONTATO-ASSESSOR`**, que e eleitor trazido por um
  assessor — ele corrigiu na hora: *"com excecao do contato assessor"*. Trocar "contido" por
  "comeca com" resolveria este caso e quebraria o outro (a etiqueta que dispensa precisa casar no
  MEIO do rotulo: "Apoiador Muito engajado"). Hoje **item com traco na frente e excecao**:
  `assessor, -contato-assessor`. Vale para as duas listas, e a excecao e conferida ANTES da
  inclusao.

- **Rascunho da IA que falha NAO pode parar a rodada — e parou.** Em 03/09/2026 um `auto.motivo`
  orfao (sobra de uma troca minha) virou `auto is not defined` dentro do caminho do rascunho:
  `processarRespondido` devolveu `erro`, `percorrerFila` PAROU, e a rodada de 37 contatos encerrou
  ali. Relato dele: *"parou a rodada, o que nao e pra acontecer"*. A regra ja estava escrita neste
  arquivo (*"falha de IA nunca para a rodada"*) e este caminho nao a seguia. Hoje a chamada esta
  dentro de `try`, e a falha vira linha de aviso. **Erro de ambiente PARA a rodada de proposito**
  (aba trocou, campo de mensagem sumiu); conveniencia que quebra, nao.
- **`checar-referencias.mjs` NAO pega variavel fora de escopo, e nao da para pegar sem parser.**
  Tentei: uma passada que acusasse `nome.campo` sem declaracao deu 33 falsos, e o corte que a
  deixou quieta (nome que aparece uma vez so no arquivo) **nao pegava o caso real** — `auto`
  aparece dezenas de vezes em `panel.js` (`state.auto`, `salvarAuto`), so nao NAQUELE escopo. Fica
  registrado para ninguem refazer a tentativa: o que protege e o `try`, nao o verificador. A
  tentativa deixou dois consertos de verdade no `soCodigo`: as FLAGS da expressao regular agora
  somem junto com ela (um `i` solto virava falso positivo) e desestruturacao e `for...of` contam
  como declaracao.
- **O rascunho da IA pedia o que ja estava no CADASTRO.** Print da Catarina (03/09): *"a IA
  perguntou nome — o nome dela e Catarina, eu apaguei a parte perguntando"*.
  `montarContatoRascunho` mandava so a cidade. Hoje manda o cadastro inteiro com o pedido
  explicito de nao pedir de novo. **O nome vai para a IA SABER que ja o temos, nunca para usar**: a
  regra de nao chamar a pessoa pelo nome (decisao dele, 10/08) continua no prompt de sistema.

- **Sao DUAS caixas de automatico, e a pergunta "esta rodada anda sozinha?" tem uma resposta so.**
  `cfg.automatizarComIA` e a fila dos "Meus"; `cfg.automaticoNovos` e a dos Novos (pedido dele,
  03/09: *"nos novos as mensagens raramente saem do contexto, faca um botao para mandar mensagem
  automatica nos novos"*). Separadas de proposito: na chegada o que sai e previsivel (recibo do
  anuncio + pedido de dados), na fila dos "Meus" chega desabafo e pedido de ajuda. Quem le e
  **`rodadaAutomatica()`**, um lugar so, porque TRES pontos perguntam isso — a execucao da tecla, a
  da IA e a pergunta da cidade —, e tres leituras separadas divergem na primeira caixa nova. O
  estado da rodada em curso e `state.auto.automatico`, zerado no `finally` do `rodar` (rodada que
  morre por erro deixaria a proxima andando sozinha).
- **Rodada automatica sem IA travaria na PERGUNTA DA CIDADE.** A caixa espera um clique que ninguem
  vai dar, e `cidadeConferidaPelaIA` so responde com a IA ligada — que nao e como o automatico dos
  Novos vai rodar na maior parte das vezes. Hoje `confirmarCidadeSePendente` **nao grava e nao
  pergunta** nesse caso, com a linha no Andamento. Nao gravar e o desfecho CERTO e nao um remendo:
  a regra dele e que nenhuma cidade de palpite vai para o CRM sem confirmacao, e o palpite volta na
  passada seguinte. **Toda pergunta nova que pode abrir dentro da rodada precisa das duas coisas:
  resposta automatica ou um jeito de nao abrir.**

- **A RODADA DOS NOVOS era um motor a parte, e por isso envelheceu sozinha.** Relato dele
  (03/09/2026): *"o iniciar conversas nao foi atualizado com as regras atuais"*. Estava certo — e a
  distancia era grande: todo o redesenho da chegada (reconhecer de QUAL anuncio, mandar o modelo
  daquele anuncio como recibo, pedir nome e cidade em seguida, so entao a pendencia) foi escrito em
  `processarRespondido`, e `processarNovo` continuava com **uma frase unica** (`padraoNovos`) no
  lugar do cadastro de anuncios, **o formulario como unica mensagem possivel** e **o quadro sem voz
  nenhuma**. O efeito e o pior tipo: quem chega pelo anuncio esta EXATAMENTE nessa fila, entao o
  ramo "pessoa chegando" que ele montou quase nunca decidia a chegada de verdade. Hoje
  `processarNovo` **assume e delega** — 120 linhas de decisao propria viraram doze. Tres coisas a
  lembrar: **assumir vem antes de decidir e nao e escolha** (contato em "Novos" esta PENDENTE, sem
  campo de mensagem, e nenhuma decisao do fluxo poderia ser executada); o contato entao **sai da
  fila mesmo quando o fluxo nao manda nada**, e por isso o resultado carrega `saiuDaFila: true` —
  sem isso um `pulado` faz a posicao andar sobre uma lista que ja encurtou e o contato que
  escorregou nunca e aberto, em silencio; e **a rodada passou a PERGUNTAR contato a contato**, como
  a dos "Meus", a menos que "Automatizar" esteja marcado.
- **Rodada com motor proprio nao herda conserto.** E a familia do "uma pasta, DUAS extensoes": duas
  copias da mesma decisao divergem na primeira semana, e a que ninguem olha e a que manda mensagem
  errada. Antes de escrever decisao dentro de uma rodada nova, pergunte se o quadro nao decide
  isso — e se decidir, delegue. O que se perdeu ao apagar o motor antigo tem endereco: *so
  cumprimentou* virou a caixa com o sinal `soCortesia`, *ja informou nome ou cidade* e o parser do
  `load()`, e o formulario continua saindo pela tecla que o quadro escolher.

- **A PLATAFORMA escreve no fluxo do contato, e nos liamos como fala dela.** A anotacao mais grave
  que apareceu (02/09/2026): o **Carlos** mandou um audio e o que chegou no lugar foi *"Nao foi
  possivel transcrever este audio"*. `semInteresse` leu o "Nao foi possivel" como recusa: ele foi
  **etiquetado como sem interesse e concluido em silencio**, sendo apoiador do anuncio — etiqueta
  permanente errada, no CRM, num eleitor real. A **Vera** teve dois *"*Atencao:* o tipo da mensagem
  enviada pelo contato nao e suportado."* lidos como apoio, e recebeu o modelo em cima de um aviso de
  erro. Hoje `cortesia.ehMensagemDaPlataforma` reconhece esses textos e o painel **esvazia** o
  `texto` (marcando `sistema: true`) num lugar so, antes de qualquer regra ver. Tres coisas:
  **esvaziar e nao descartar** ("mandou um audio e nao deu para ler" e diferente de "nao mandou
  nada"); o **asterisco do `*Atencao:*` e obrigatorio**, porque gente escreve "Atencao:" sem ele e
  apagar a fala de quem falou de verdade e pior que ler o ruido; e fica no PAINEL e nao em `api.js`,
  que nao importa nada de proposito.
- **Caixa de PALAVRAS nao sabe se a mensagem e SO aquilo — e "so mandou bom dia" prometia isso no
  nome.** Anotacao da Teresinha (02/09): ela escreveu *"Boa tarde queria saber mais"*, *"Como faso
  pra conversar com voces"* e *"Boa tarde o senhor ta concorendo tambem"*, e recebeu a mensagem do
  momento porque "boa tarde" estava contido. Mesmo defeito da print da Cris (desabafo de 437
  caracteres comecando com "Oi. Bom dia,"). A caixa virou o sinal **`soCortesia`**, que pergunta se
  TODAS as ultimas mensagens sao so cumprimento. **O painel passa a RAJADA** (`rajadaFinal`), nao as
  tres ultimas da conversa: sem esse recorte o sinal continuaria verdadeiro depois de respondermos, e
  a caixa mandaria a mensagem do momento em toda passada — `problemas` acusou isso na hora.

- **Casamento APROXIMADO de cidade em texto livre grava etiqueta errada no CRM.** Anotacao do Luiz
  Zanchet (02/09/2026): *"Seja bem vindo at a vitoria"* — "ate a vitoria" com um "e" comido — virou
  **Vitoria das Missoes** com confianca `aproximada`, e a etiqueta do municipio foi parar no
  contato. O caminho "texto curto e a propria resposta" de `matchCityComContexto` chamava `matchCity`
  e aceitava qualquer confianca. Hoje aceita `exata`, **ou** `aproximada` quando o casamento consumiu
  a MENSAGEM INTEIRA (`normalize(matched) === formaCanonica(bruto)`) — que e a mesma conferencia de
  `isCityAlone`, e o que mantem "Sao lourenso" funcionando. **A tolerancia a erro de digitacao existe
  para a POSICAO da cidade, onde ja se sabe que aquilo e uma cidade; em texto livre ela transforma
  "vitoria", "esperanca" e "progresso" em municipio.**
- **Ir CONDICIONAL e recusa.** *"Eu irei so se ele vier para Bento Goncalves"* (Elsa, 02/09) nao
  casava com nada e o caso seguia como se ela nao tivesse falado do evento. Os padroes de recusa
  ganharam a condicao (`vou/irei/vamos + so se|caso|quando`, `so vou se`, `se ele vier`), e ficam
  ANTES da lista do "vai" pelo mesmo motivo do "gostaria... mas": a ressalva e o que decide.
- **A trava de POSICAO das perguntas e cega demais para pergunta de politica.**
  `conversaTemPerguntaAberta` so aceita o padrao no COMECO da mensagem ou com "?" — guarda boa, que
  existe porque "pq" no meio de frase e conjuncao (print do Ciro). Mas a Eliana (02/09) colou o texto
  do anuncio e emendou *"gostaria de saber se tem algum projeto para criar leis mais rigidas"*, tudo
  numa mensagem so e sem interrogacao: a pergunta ficou no meio e foi descartada. Hoje ha
  `PERGUNTAS_INEQUIVOCAS`, que valem em qualquer posicao — "tem algum projeto/lei", "vao
  apoiar/votar", "o que vao fazer sobre". **"tem algum material/conteudo" fica de fora de proposito:**
  aquilo o modelo responde, e e a maior parte do que chega.

- **Grito de campanha nao e confirmacao de presenca.** `confirmaPresenca` aceitava o verbo SOLTO
  (`vou|irei|vamos` seguido de espaco ou fim), e nesta base isso e *"Juntos vamos"*, *"Vamos vencer
  Flavio"* e ate *"vou votar em voces"* — duas anotacoes dele com pessoas recebendo texto de evento.
  Hoje o verbo precisa vir com o que o torna presenca: **"sim"**, um lugar (**la**, **ai**), ou um
  verbo de comparecer; ou ser a mensagem inteira, que e a resposta seca a "voce vai?". Nao da para
  resolver pelo contexto ("so olhe se o convite saiu") porque o convite e modelo aprovado da
  plataforma e o painel nao o reconhece por id.
- **`conversaPedeRespostaPessoal` passava SO O TIPO da mensagem, e com isso anulava o conserto do
  audio transcrito.** O laco fazia `pedeRespostaPessoal({ tipo: msg?.tipo })`, jogando fora `texto` e
  `transcrito` — entao audio COM transcricao continuava dizendo *"so da para responder depois de
  abrir"*, com a transcricao inteira do lado. A regra de 01/09 estava certa e testada; o defeito era
  a chamada nao deixa-la ver nada. **Funcao pura com teste nao garante nada se quem chama filtrar os
  campos que ela le.**
- **`respondeuOsDados` tem que ser cortado na NOSSA ULTIMA mensagem, nao so no pedido.** Recortar
  "depois do pedido" nao se apaga nunca: a resposta dela continua sendo posterior ao pedido para
  sempre, entao a rodada agradecia de novo a cada passada (anotacao da Iraci, que respondeu, foi
  agradecida, mandou dois emojis e quase recebeu outro agradecimento). Cortar na nossa ultima
  mensagem e o que faz o sinal significar **"ela respondeu e nos ainda nao respondemos de volta"**.
- **O texto `pedido-emprego` existia sem NINGUEM aciona-lo.** Estava escrito, revisado, entre os
  `RESTRITOS` da IA e com etiqueta propria — e nenhuma regra ou caixa o alcancava, entao quem
  perguntava como trabalhar no mandato recebia agradecimento generico (anotacao do Kelvem, que
  perguntou e emendou *"No caso vcs nao pagam"*). Hoje ha `cortesia.pedeEmprego`, que le a RAJADA
  (o pedido vem partido) e tem lista de guarda contra o falso positivo — *"vamos trabalhar juntos"*
  e *"obrigado pelo trabalho"* sao a fala mais comum desta base. **Resposta pronta sem gatilho e
  trabalho parado: ao criar uma, crie no mesmo commit quem a chama.**

- **IBGE fora do ar apagava o reconhecimento de cidade INTEIRO, em silencio.** `loadMunicipios` ia
  a rede e, falhando, caia numa lista montada com o que ele ja tinha cadastrado em `cityLinks` —
  quase sempre vazia. Com a lista vazia `matchCity` compara contra nada e **nenhuma cidade e
  reconhecida nunca**; o unico sinal era um `console.warn`, e o sintoma na tela e o campo Cidade
  vazio com a cidade escrita na conversa. Relato dele em 02/09/2026 (*"nao capturou porto alegre"*),
  e eu peguei por acidente: montando o teste o meu proprio banco caiu no `IBGE 503` e **nenhuma** das
  dezessete formas de escrever Porto Alegre passou, nem o nome puro. Hoje o fallback e o
  `src/data/coredes-rs.json` que **ja vem no pacote** (497 municipios, a mesma fonte que decide o
  COREDE — entao as duas nao podem discordar sobre quais municipios existem). Duas coisas a lembrar:
  ele fica **depois** do IBGE, que continua sendo a autoridade quando a rede funciona; e a lista de
  emergencia **nao e gravada no cache do storage**, senao ela viraria a definitiva e o IBGE nunca
  mais seria consultado. Tem teste que finge o 503.

- **A cidade pode ser RECONHECIDA e mesmo assim não valer.** `matchCity("Canoas RS")` sempre achou
  Canoas; o que falhava era a igualdade que decide se a pessoa **informou** a cidade
  (`cidadeSozinha`, `isCityAlone`), porque `"canoas rs" !== "canoas"`. O sintoma na tela é
  **Cidade: (vazia)** com a cidade escrita na conversa, e o efeito é `informada: false`: não
  substitui o CRM e fica esperando um clique que a rodada automatizada nunca dá. Quem compara
  "isto é exatamente o município?" usa `cities.semSufixoDeEstado`, nunca `normalize` cru.
  **A lista de siglas precisa ser completa ou o defeito parece aleatório:** o primeiro conserto
  cobriu só `rs` e o print seguinte trouxe `rgds` — hoje são `rs`, `rgs`, `rgds`, `r s` e o estado
  por extenso. **`rio grande` sozinho nunca entra: é município.**
- **Comentário que descreve a ordem não é a ordem.** Em `processarRespondido` a IA era chamada
  **antes** de `sugerirAcao`, com um comentário logo acima afirmando que a regex já havia filtrado
  os casos conhecidos. Não havia. Com "Automatizar com IA" ligado, a escolha da IA era executada
  direto e regra nenhuma era consultada: quem só escreveu *"Amém"* recebeu mais uma mensagem 36 min
  depois, porque `ultima-e-despedida` nunca foi olhada. A trava de duplicata não pegou porque
  compara por MODELO, e eram modelos diferentes. **Consertado em 01/09/2026** — hoje
  `sugestao === null` é o gatilho da IA, como o desenho sempre disse. Se for mexer nessa ordem de
  novo: o teste é ler o CÓDIGO, não o comentário.
- **Pergunta que a rodada faz precisa de regra para a RESPOSTA — senão o caso desce a tabela até
  quem ENVIA.** A regra que manda perguntar *"em que você precisa de ajuda?"* existia e funcionava;
  o passo seguinte não existia. A contato respondeu *"é sobre as irregularidades sobre compra
  assistida em Eldorado do Sul"* — denúncia sobre programa público, o trabalho do mandato — e
  recebeu **material de campanha**, porque sem sinal o caso caiu em `conteudo-pedido` (01/09/2026).
  Criou opção que faz pergunta? A regra que reconhece a resposta entra no mesmo commit, e ela é
  `respondeu-nossa-pergunta` (tecla 6). O reconhecimento é por **invariante da nossa pergunta**
  (`templates.ehPerguntaComoAjudar`) mais a HORA das mensagens.
- **A tabela de regras é mais ESTREITA que a IA, e isso muda o cálculo de quando pular a IA.** Para
  o que as regras **não sabem**, pular a IA economiza. Para o que elas **erram**, pular a IA tira a
  rede de segurança — e foi o que a reordenação de 01/09 fez neste caso: uma regra casou (tecla 1,
  enviar modelo), a IA não foi ouvida, e a propaganda saiu. Antes da reordenação ela provavelmente
  teria escalado.
- **Acao que mexe em TUDO precisa de volta, nao so de confirmacao.** Os botoes que substituem o
  quadro do fluxo perguntavam antes; "Arrumar o quadro" nao, e ele reposiciona todas as caixas —
  o arranjo feito a mao inteiro, sem volta. Resultado: *"acabei de perder todo meu trabalho"*
  (01/09/2026). Hoje ha desfazer de 20 passos, empilhado dentro do `gravar` (assim vale para toda
  chamada, inclusive as futuras) e **gravado no armazenamento** — desfazer so em memoria nao serve,
  porque a reacao natural a um estrago e fechar a janela para ver se volta.
- **A ORDEM das regras agora e dele, na JANELA do fluxo (src/fluxo.html) — e regra nova do codigo entra na POSICAO DO
  CODIGO.** `sugestao.ordenar` herda a posicao do vizinho de cima que a ordem salva conhece. Sem
  isso, regra nova nasceria em ultimo lugar em quem ja tem ordem salva, e um conserto viraria
  defeito calado na atualizacao — foi o risco concreto da `respondeu-nossa-pergunta`, criada para
  impedir propaganda em cima de denuncia. Tem teste. Duas consequencias a lembrar: **ordem errada
  agora e decisao dele**, e **desligar regra alta nao e neutro** (as de baixo passam a decidir, e
  varias ENVIAM). Condicao continua no codigo de proposito: e ela que decide o que sai para eleitor.

- **A janela do fluxo desenha o DESFECHO, e desfecho que envelhece vira mapa mentiroso.** O
  verbete (`SOBRE`) descreve a condicao; o que sai para o eleitor vem de `TECLAS` + `ramos`, e as
  tres regras cuja `tecla` e FUNCAO precisam dos dois lados escritos. `regrasComDesfechoIncoerente`
  exige as tres coisas (tecla com verbete, funcao com os dois ramos, selo concordando com a tecla)
  e o teste roda a funcao nas 8 combinacoes de `respondidoHoje` x `momentoJaEnviado` x
  `podeMandarMomento` para comparar com a lista escrita. **Mexeu na funcao `tecla`? O `ramos` do
  verbete entra no mesmo commit** — senao a janela promete um desfecho que o codigo nao produz
  mais, e e olhando essa janela que ele decide a ORDEM. Lembrar tambem que **fixar a tecla na
  janela muda o efeito da regra**: o `efeito` do verbete e o do codigo, e quem le a cor do cartao
  tem que ler `efeitoDaRegra(id, fluxo)`, nunca `SOBRE[id].efeito` cru.

- **O pedido de dados tem TRES formas, e trava de duplicata que olha o ID do modelo nao ve as outras
  duas.** Print do Deoclecio (02/09/2026): contato com TODAS as etiquetas recebeu *"Que bom! Sera uma
  grande satisfacao contar com voce... Nome / Cidade"* **duas vezes**. A trava era
  `wasSent(contato, pedirDados.id)` — so a forma que sairia AGORA. Basta `confirmaPresenca` responder
  diferente entre duas passadas (ela le a rajada depois da nossa ultima mensagem, e a rajada muda)
  para a trava olhar um id que nunca saiu e concluir que ninguem pediu nada. Somava-se o registro de
  envios so enxergar o que saiu PELO PAINEL. Hoje quem responde e a CONVERSA, por
  `templates.ehPedidoDeDados` (invariante `Nome / Cidade`): pega toda variante, toda redacao antiga e
  todo envio fora do painel. **Nunca amarre trava de duplicata a id de modelo nem a fatia de texto** —
  a versao anterior comparava os caracteres 40 a 100 do texto atual, e variante com preambulo de
  evento ja deixava de casar.
- **`confirmaPresenca` mudava o TEXTO da tecla 4 e nao existia como desfecho, entao "confirmou e nao
  falta dado nenhum" pedia o cadastro de novo.** Duas caixas fecham isso:
  `confirmou-presenca-com-dados` (tecla 8, agradece e conclui, quando ja ha etiqueta de cidade) e
  "confirmou presenca no evento" dentro de "sem pendencia", que alcanca `nunca-pediram-dados` para
  quem confirmou e NAO tem cidade — esse segundo caso tambem caia no vazio quando ela nao vinha de
  anuncio reconhecido, achado escrevendo o teste do primeiro.

- **REMETENTE DENTRO DE PROTECAO: o mesmo erro aconteceu DUAS vezes, e agora a janela acusa.** Em
  01/09 "mensagem padrao" caiu dentro de "Recusou ou veio hostilizar"; em 02/09 "mandar modelo
  conforme o anuncio" caiu no mesmo lugar. Medido no quadro dele: **o hostil recebia o pedido de nome
  e cidade** e **a pessoa normal nao recebia o modelo** — escapava para "pessoa retornando" e
  terminava agradecida por um apoio que nunca expressou. O motivo e o desenho do motor: **o filho e
  testado ANTES da acao do proprio no, e so e alcancado quando o PAI casa**, entao por um remetente
  dentro de uma protecao significa "quando eu reconhecer que nao devo mandar nada, mande isto". Duas
  ocorrencias iguais e problema de FERRAMENTA, nao de quem usa: hoje `arvore.problemas` acusa
  (`remetenteDentroDeProtecao`) — caixa de efeito `silencio` com descendente que ENVIA. A conferencia
  fica **acima do `continue` das caixas de regra**, porque as protecoes deste projeto SAO regras do
  codigo (`sem-interesse`, `etiqueta-dispensa-da-fila`); na primeira versao ela ficou depois e nao
  via o caso real. Tem teste travando as duas coisas.
- **`fluxo.teclas` e por ID DA REGRA, entao fixar a tecla vale para TODAS as copias daquela caixa.**
  `acaoDoNo` le `fixadas[regra.id]`, nao o id do no. No quadro dele "So se despediu" aparece duas
  vezes e as duas mostram "VOCE FIXOU" — uma edicao so. Consequencia: nao existe fixar a tecla de uma
  copia e nao da outra; para isso, a caixa tem que ser dele (sem regra), e ai perde as guardas.

- **Trocar o DESFECHO de uma caixa de regra nao troca a CONDICAO dela — e a condicao pode ser o
  bloqueio.** Ele abriu a caixa "respondeu com os dados" (a regra `conteudo-pedido`) e trocou o
  desfecho para a tecla 8, querendo *"agradecer a atencao e encerrar sem mandar modelo"*. Nao
  funcionaria: a condicao daquela regra exige `!modeloJaNaConversa`, e com o modelo saindo na
  chegada ela deixou de casar. Medido: quem respondia com os dados nao recebia NADA (sem etiqueta de
  cidade) ou era concluida em silencio por `ja-respondemos-antes`. **Quando a intencao dele nao cabe
  na condicao da regra, o certo e regra NOVA, nao trocar a tecla da existente** — hoje e
  `respondeu-os-dados` (tecla 8), com o sinal `respondeuOsDados` calculado no painel.
- **Protecao que vive so num lado da bifurcacao de cidade e protecao pela metade.**
  `etiqueta-dispensa-da-fila` vivia dentro de "com etiqueta de cidade": quem carregava a etiqueta e
  NAO tinha cidade nunca era protegido — recebia o modelo, e passaria a receber o agradecimento.
  Subiu para cima da bifurcacao, junto da recusa, e ha teste exigindo que as duas vencam nos DOIS
  lados. O comentario da recusa ja dizia isso desde 01/09; a licao e que dizer nao basta, tem que
  ter teste dos dois lados.

- **FIXAR A TECLA numa caixa dele NAO herda as guardas da regra do codigo — e isso vira maquina de
  repetir.** Caso real (02/09/2026): ele montou *"mandar modelo conforme o anuncio"* com a condicao
  "Reconheci de QUAL anuncio ela veio" e a **tecla 1 fixa**, e o motor mostrou o modelo saindo em
  TODA passada, para sempre. Dois motivos somados: a condicao e estado do contato (continua
  verdadeira depois de mandarmos) e `conteudo-pedido` exige `!enviadoHoje && !modeloJaNaConversa`,
  que a caixa dele nao exigia. **A caixa PARECE a regra e tem o mesmo desfecho na tela** — o que
  falta e invisivel. Hoje `arvore.problemas` acusa (`repeteSozinha`): caixa dele, que ENVIA, cuja
  condicao nao inclui nenhum sinal que o proprio envio apaga (`SINAIS_QUE_O_ENVIO_APAGA`) e que nao
  casa por palavra na ULTIMA mensagem. Palavra na ultima e guarda (a ultima muda quando ela escreve);
  em "qualquer mensagem" nao e (o texto fica la para sempre).
- **`veioDeAnuncio` e `anuncioReconhecido` sao coisas diferentes, e escolher o segundo mata o modelo
  padrao.** A origem (`utm.source`) diz que veio de anuncio e vale sempre; `anuncioReconhecido` so e
  verdade para anuncio que ele cadastrou na Config. Caixa de "mandar o modelo" condicionada ao
  SEGUNDO nunca alcanca quem chegou por anuncio nao cadastrado — e e exatamente para esses que o
  modelo padrao (com rodizio) existe. Ele caiu nisso na primeira caixa que montou a mao.

- **Mudar `fluxoPadrao` NAO muda o quadro dele — e por meses isso significou que melhoria no padrao
  era invisivel ou custava o quadro inteiro.** Relato dele em 02/09/2026, depois de eu reordenar a
  chegada pelo anuncio varias vezes num dia: *"a ramificacao nao foi atualizada"*. Estava certo: o
  quadro de trabalho e uma COPIA, "Resetar para o padrao" e o unico caminho de volta, e ele joga fora
  o arranjo feito a mao. Hoje existe o cartao **"O padrao mudou?"** na janela, com
  `arvore.diferencaDoPadrao`: lista o que o padrao decide e o quadro dele nao (com botao "Por", que
  traz o ramo INTEIRO e diz quantas caixas vem) e o que e so dele. **Nada entra sozinho** — no quadro
  a posicao e a prioridade, e enfiar caixa por conta propria mudaria a rodada sem ninguem escolher
  onde. A comparacao e por CONTEUDO (regra do codigo, ou sinal + palavras), nunca por id: os ids do
  quadro dele nasceram noutro momento. Caixa que so AGRUPA fica fora — e estrutura, nao decisao, e
  todas colidiriam na mesma chave. **Mexeu no `fluxoPadrao`? Diga a ele que o cartao vai acusar** —
  senao a mudanca continua invisivel, que era o defeito.

- **A tecla `a` e a UNICA do projeto que manda duas mensagens, e foi escolha dele.** Desenho de
  02/09/2026: *"o modelo seria uma resposta automatica ao anuncio, o atendimento vem depois disso
  que seria pedir dados e responder as perguntas"* — e, perguntado se "depois" era a mesma passada
  ou a seguinte, escolheu **a mesma**, sabendo que sao duas mensagens seguidas para o mesmo numero.
  O motivo: com uma por passada, quem recebia o modelo e sumia nunca era perguntada, e sem nome e
  cidade nao ha o que classificar. **A regra `anuncio-modelo-e-dados` exige as DUAS metades
  disponiveis** — faltando uma, ela nao casa e `conteudo-pedido`/`nunca-pediram-dados` resolvem
  cada pedaco sozinho; e a oferta na caixa exige os dois textos destravados, porque tecla que trava
  no meio deixa o contato com o recibo e sem o pedido. **Se a segunda mensagem falhar a rodada PARA**
  com resultado `enviado`: seguir a fila esconderia o contato pela metade.
- **Na chegada pelo anuncio, tres pendencias ficam ACIMA do modelo, contra a ordem que ele
  descreveu.** Ele pediu "pendencia depois do modelo", e isso vale para as neutras (bom dia, figura,
  despedida). Nao vale para
  **pediu algo sem dizer o que** (print da Mari) e **pergunta de
  razao ou de posicao** (print da Clair): nesses dois, mandar a nossa mensagem primeiro E o dano,
  nao o atraso.
  **"Pediu ajuda financeira" estava nesta lista e SAIU, por decisao dele** (02/09, no mesmo dia):
  *"o modelo nao ira confirmar apoio ao pedido de ajuda ou confirmar que ira ajudar entao pode ser
  respondido apos"*. Ele esta certo sobre o TEXTO — o modelo e recibo de cadastro e nao promete
  nada, entao manda-lo antes nao e promessa de beneficio. **Mas a tecla `a` leva o pedido de dados
  junto**, entao quem pediu remedio recebe recibo + formulario antes da negativa; foi dito a ele. O modelo nao deixa de sair — sai na passada seguinte. Foi dito a ele.

- **O MODELO PADRAO nao entrega conteudo: ele CONFIRMA que a pessoa vai receber.** Correcao dele em
  02/09/2026: *"o modelo padrao e uma confirmacao para a pessoa que ela ira receber nosso
  conteudo"*, e *"se a pessoa ja respondeu a cidade a chance de ela ter recebido um modelo e muito
  grande entao nao tem necessidade de mandar o padrao novamente"*. Eu havia entendido o contrario e
  argumentei *"o que ela clicou para receber e o conteudo"* — com essa frase ele escolheu criar uma
  caixa que mandava o modelo para quem chega do anuncio ja com etiqueta de cidade, e desfez a
  escolha minutos depois. **Consequencia pratica: cidade conhecida e indicio de recibo ja enviado,
  entao o vazio nesse caso e o desfecho CERTO** — nao ha o que mandar sozinho, e a caixa de
  pergunta pede ele ou a IA. Tem teste travando isso para ninguem "consertar" achando que e buraco.
  **A unica excecao que ele nomeou e evento confirmando presenca**, que hoje so troca o TEXTO da
  tecla 4 (`confirmaPresenca` -> `pedir-dados-evento-sim/nao`): nao e regra, nao e sinal, e quem
  responde ao convite **ja tendo cidade** nao recebe recomendacao nenhuma.
- **Resposta pronta que FUNDE duas coisas nao tem como ser usada pela metade.** As duas de evento
  confirmam a presenca **e** pedem `Nome / Cidade` no mesmo texto, e nao existia versao so com a
  primeira metade — entao quem ja tinha tudo no CRM recebia o formulario junto do "que bom", por
  qualquer caminho: a rodada, ou ele clicando na resposta rapida. Diagnostico dele (02/09):
  *"ela ja vem incluso pedindo dados; se usar a mensagem rapida sempre ira pedir os dados"*. Eu
  tinha ido caçar a trava de duplicata; a raiz era o TEXTO. **Antes de blindar a trava, leia o que
  a mensagem diz** — trava nenhuma conserta um texto que pede o que nao devia pedir.
  `presenca-confirmada` e a metade que faltava, e o teste exige `!ehPedidoDeDados` no texto base e
  em cada variante: se uma reescrita futura devolver o bloco do cadastro, o defeito volta calado,
  porque a tecla continua se chamando "agradecer a presenca".
- **Tecla que serve a mais de uma situacao escolhe o TEXTO junto com o rotulo.** A tecla 8 atende
  apoio generico e confirmacao de presenca; a condicao que troca o texto e a MESMA da regra
  `confirmou-presenca-com-dados` (`confirmouPresenca && temEtiquetaDeCidade`), escrita nos dois
  lugares de proposito — a regra decide o DESTAQUE, o painel decide o TEXTO, e divergir faria a
  caixa prometer "agradeca a presenca" e mandar o agradecimento de apoio. A trava por variavel de
  cada texto tambem e separada: `apoioTrava` alimenta a regra `so-expressa-apoio` e nao pode sumir
  com a tecla do outro caso.
- **Caixa de PALAVRAS casa por trecho contido, entao ela nao sabe se a mensagem e SO aquilo.** A
  caixa "so mandou bom dia" pegava um desabafo de 437 caracteres que comecava com *"Oi. Bom dia,"*
  (print da Cris, 02/09). O nome da caixa diz "so mandou", a condicao nao verifica isso, e o
  resultado era mensagem de campanha em cima de um desabafo. **A protecao e de ORDEM:**
  `ultima-pede-resposta-pessoal` (texto longo / audio) fica ACIMA de toda caixa de palavra, entao
  quem escreve conversa nunca e decidido por palavra solta. Regra que vale sempre que voce criar
  caixa de palavras com nome que promete exclusividade.
- **`ja-respondemos-antes` e a caixa mais GENERICA do lado de quem volta, e generico nao pode ficar
  em cima.** Ela nao olha o que a pessoa escreveu — so que ja fomos atendidos antes — e mandava a
  mensagem do momento. Em terceiro lugar no ramo "com etiqueta de cidade", vencia todas as caixas
  que reconhecem conteudo. Hoje fica embaixo das pendencias, como o lado "sem etiqueta" ja fazia:
  **quando os dois lados do quadro discordam na ordem, um dos dois esta errado** — foi assim que
  este apareceu.
- **A tecla 6 e o caminho da IA, e por isso ela e o desfecho certo para desabafo.** *"a IA devia ter
  assumido e mandado uma mensagem personalizada"* (02/09). O painel chama a IA em
  `!sugestao || sugestao.tecla === '6'`, e quando ela escala o rascunho personalizado pode sair.
  Mandar qualquer mensagem PRONTA nesse caso e o erro — nao existe resposta pronta para desabafo.
- **Sinal que junta "ela escreveu depois" com "o parser achou algo" tem que rodar o parser SO no
  depois.** `respondeuOsDados` somava `respostasApos` com `state.informouNomeOuCidade`, que roda na
  CONVERSA INTEIRA — e nesta base a pessoa diz de onde e antes de qualquer pedido. Bastava ela
  escrever qualquer coisa depois (um "ok", um link) para as duas metades darem verdadeiro:
  agradeciamos por um dado que ela nunca deu e concluiamos o atendimento (print dele, 02/09,
  *"agradecimento saindo sem a pessoa responder nome e cidade"*). O comentario do sinal ja dizia
  *"o parser achou nome ou cidade no que ela escreveu"* — a intencao estava certa e o codigo nao a
  cumpria. **Mesma familia do "comentario que descreve a ordem nao e a ordem".**
- **No modo `respostaAoPedido` o parser devolve QUALQUER palavra solta como cidade
  `nao-reconhecida`** — medido: um link do Instagram volta como `cidade: "www.instagram.com"`. A
  generosidade e de proposito (e ela que faz "maria cachoeirinha" virar nome e cidade sem
  separador), mas quem pergunta *"ela respondeu?"* tem que exigir cidade RECONHECIDA ou nome. So
  isso ja reproduzia a print inteira, e sozinho teria feito o conserto anterior parecer que
  funcionou. **Nunca teste so \`if (palpite.cidade)\` no modo generoso; olhe a confianca.**
- **`anuncios.reconhecer` le o DADO da plataforma, nao so o que ela digitou.** Ele lia so
  `state.incoming`, entao quem chegava pelo anuncio e nao repetia o texto dele ficava sem anuncio
  reconhecido — com a etiqueta ADS aplicada e o modelo generico oferecido (print da Ines, 02/09,
  *"nao reconheceu o anuncio"*). Hoje entram tambem `utm.campaign`, `utm.headline` e
  `utm.referralUrl`, que sao a identidade da campanha e existem mesmo quando ela nao escreve nada.
  **`utm.source` fica de fora**: e so "FACEBOOK", diz que veio de anuncio e nao de QUAL, e um trecho
  com "face" casaria com todos de uma vez. Nas regras de etiqueta ele entra porque la a pergunta e
  outra. **Reconhecer continua exigindo o anuncio cadastrado na Config** — lista vazia nao e
  defeito, e o nome da campanha aparece no cabecalho do painel, que e de onde sai o trecho.
- **A etiqueta ADS e ORIGEM e nunca decide o modelo** (decisao dele, 02/09/2026: *"o conteudo a ser
  mandado nao deve ser decidido pelo ads, e sim pelo texto do ads"*). Ela entrava como
  `origem: 'conteudo'` com `fallback: true`, marcador que a fazia perder de qualquer tema de verdade
  mas **vencer quando nao havia tema nenhum** — que e exatamente quem chega do anuncio e nao diz
  mais nada. Print da Vera: anuncio das Escolas Civico-Militares e a caixa oferecendo
  "Campanha Martim", porque a Config mapeia `ADS -> Campanha Martim`. Hoje a ADS tem
  `origem: 'anuncio'`, continua sendo aplicada no CRM e servindo ao filtro, e nao entra na lista que
  escolhe o modelo; o `fallback` de `escolherConteudo` foi apagado junto, porque ramo morto dentro
  de um desempate e o que alguem religa sem querer. **Quem escolhe o modelo e so
  `anuncios.modeloDoAnuncio`.**
- **Para achar de onde veio um modelo errado, leia a linha do conteudo na caixa.** Ela e escrita por
  tres caminhos diferentes e cada um tem um rotulo: `anuncio: <nome>` (anuncio reconhecido),
  `anuncio nao reconhecido — modelo padrao`, ou `Conteudo pedido: <etiqueta>` (o caminho da etiqueta
  de conteudo). Foi assim que a print da Vera se resolveu sem adivinhacao — o rotulo dizia qual das
  tres portas tinha atendido.
- **Fechar um caminho errado sem escrever a mensagem nova troca o defeito por uma caixa muda.**
  Tirando a ADS da escolha, quem chega por anuncio nao cadastrado e sem modelo padrao ficava com
  *"nenhum conteudo reconhecido"* — mandando ele procurar uma etiqueta de tema que nunca vai
  existir. A caixa diz as duas saidas que resolvem: cadastrar o anuncio, ou preencher os modelos
  padrao.
- **Os conteudos da rodada vem de DUAS fontes, e fechar uma so nao fecha nada.** `tags.suggest` acha
  pelo texto; `tags.conteudosJaAplicados` reconstroi a partir das etiquetas que o contato JA tem no
  CRM, usando as regras dele **e as CHAVES da tabela "Modelo por conteudo"**. Tirar a ADS da
  primeira (1.62.0) deixou a segunda devolvendo `ADS` como conteudo, porque ele tem
  `ADS = Campanha Martim` na tabela — print da Liana, com o anuncio ja cadastrado e o modelo errado
  saindo do mesmo jeito. Hoje as duas consultam `tags.etiquetasDeOrigem()`, **uma funcao so**: duas
  listas separadas divergem na primeira fonte nova. **Mexeu no que e "conteudo"? Sao os dois
  lugares.**
- **Deduplicacao por nome entre as duas listas ESCONDE vazamento.** A entrada do CRM so era
  descartada quando o nome batia com o que `suggest` achou — com o nome batendo, tudo parecia certo;
  bastava o rotulo no CRM diferir de um espaco para escapar. Filtre por IDENTIDADE na origem, nunca
  confie na deduplicacao de quem chama para garantir uma regra.
- **"Conteudo preferido" e ETIQUETA; "modelo padrao" e MODELO — e o botao de fechar confundia os
  dois.** Sem conteudo reconhecido, "Enviar conteudo + agradecer + concluir" caia no preferido, que
  so vira mensagem se tambem houver linha na tabela "Modelo por conteudo": duas configuracoes para
  mandar um modelo, e o botao travava faltando qualquer uma. Piorou quando a ADS deixou de ser
  conteudo, porque quem chega por anuncio passou a nao ter conteudo nenhum. Hoje o vazio manda o
  **modelo padrao** (com o rodizio andando so no envio) e o preferido ficou como ultimo recurso.
  **Nesse caminho nao se aplica etiqueta de conteudo**: o preferido afirma "o conteudo e este, o
  parser e que nao viu" e a etiqueta registra a afirmacao dele; o padrao nao afirma nada sobre o que
  ela pediu, e etiqueta inventada fica permanente no CRM.
- **Apelido de cidade casa no texto NORMALIZADO; nao remova pelo nome oficial no texto CRU.**
  `matchCity` casa depois de `normalize`, que expande `poa` -> `porto alegre`, e tambem `cxs`, `sm`,
  `sto`, `pto`. Quem calculava a sobra da resposta removia o nome OFICIAL do texto cru: com "POA"
  nao removia nada, e o apelido virava o NOME ("Poa", "Vera Poa"), com a cidade rebaixada a palpite
  (relato dele, 02/09). Hoje `cities.semACidade` procura o menor trecho de palavras cujo
  `normalize()` contem o municipio -- mesma funcao dos dois lados, entao nao ha como discordarem.
  **A sobra preserva acento e caixa**, porque ela vira o nome do eleitor no CRM.
- **A caixa "Automatizar" controla as REGRAS tambem, e nao consulta `ia.ligada`.** O rotulo dizia so
  *"Automatizar com IA"* e o aviso embaixo dizia que ela *"nao faz nada enquanto a avaliacao por IA
  estiver desmarcada"* — **falso**: a automacao das regras (`state.auto.cfg.automatizarComIA &&
  sugestao`) nao olha `state.ia.ligada`, entao com a IA desligada a rodada continua executando a
  tecla que a regra recomenda, e **a maioria das regras ENVIA**. Ele viu duas mensagens sairem
  sozinhas e perguntou *"tem algum gatilho no momento que pede sem ser no modo IA?"* — tinha, e a
  tela mandava procurar no lugar errado. **Interruptor que faz duas coisas tem que dizer as duas no
  nome.**
- **Para saber POR QUE a rodada mandou algo, o lugar e o log do Andamento.** Cada envio automatico
  escreve `automatico pelo fluxo ("<regra>", caminho X > Y): <o que foi feito>`. Sem olhar o log, a
  reconstrucao e adivinhacao — os textos sao editaveis por ele, entao o mesmo texto nao identifica a
  tecla que o mandou.
- **Mensagem enviada FORA do `if` da tecla vai em todas elas.** O agradecimento (*"Obrigado pela
  atencao! Qualquer coisa, e so chamar"* — um ENCERRAMENTO) era enviado depois do bloco do modelo,
  sem condicao: a tecla `a` mandava tres mensagens, e a terceira fechava a conversa que o pedido de
  dados acabara de abrir (print dele, 02/09, *"nao existe agradecer depois de pedir dados"*). Era
  sobra de quando a tecla 1 era "modelo + agradecimento" e a `a` nao existia. **Criou tecla nova que
  reusa um bloco de envio? Confira o que ja estava DEPOIS do bloco** — e lembre do invariante: a
  tecla `a` e a unica que manda duas mensagens.
- **O titulo da caixa da rodada descreve a SITUACAO, nunca uma das teclas.** Ele dizia *"Enviar o
  modelo X + agradecimento e concluir?"*, que era a frase da tecla 1, encimando dez opcoes — com a
  tecla `a` na lista, o titulo prometia agradecimento e a opcao prometia pedido de dados. Duas
  frases sobre o mesmo contato, discordando, e foi por ai que ele viu o defeito. Cada opcao ja diz o
  que faz; o titulo so precisa dizer onde estamos.
- **Trava de variavel amarra so a tecla que MANDA aquele texto.** `modeloTravado` e a trava do
  agradecimento, e a tecla `a` estava presa nela — sumiria por causa de uma mensagem que nao envia,
  com o motivo na tela falando de um texto fora do caminho. O aviso tambem mentia: dizia *"Modelo X
  travado"* quando o travado era o agradecimento, mandando procurar no lugar errado.
- **Antes de oferecer opcoes a ele, confira se voce entendeu o que a coisa FAZ.** A escolha dele e
  boa na medida em que a minha descricao e verdadeira; descricao errada nao produz escolha errada
  dele, produz escolha errada minha assinada por ele. Foi o que aconteceu com o modelo padrao acima.

- **O TEXTO do anuncio fica na conversa PARA SEMPRE, e isso torna "reconheceu o anuncio" perigoso
  como gatilho.** Os anuncios do momento (`store.anuncios`, aba Config) casam por trecho contido na
  conversa INTEIRA — tem que ser, porque a mensagem do anuncio nem sempre e a primeira (a print da
  Erenita, 01/09, tinha uma figura antes). A consequencia e que quem clicou no anuncio em julho
  continua "reconhecido" em setembro: um gatilho ingenuo mandaria a acao do anuncio de novo a cada
  passada. Por isso `anuncios.decidirComAnuncio` **nunca passa por cima de regra cujo efeito e
  `silencio`** — recusa, despedida, etiqueta que dispensa da fila. E o mesmo erro do "Amem" que
  recebeu mais uma mensagem 36 min depois, e tem teste para as tres. Regra que IA enviar de
  qualquer forma perde para o anuncio de proposito: ai o anuncio decide **o que** sai, e escolha
  explicita dele nao se substitui por deducao.
- **A acao do anuncio nao pode ser TEXTO LIVRE, e `ACOES` e lista de PERMISSAO.** Sao quatro:
  mandar modelo aprovado, mandar resposta pronta, pedir nome e cidade, ou so etiquetar e devolver
  ao quadro. Um campo de texto nessa tela transformaria configuracao de anuncio em redator de
  mensagem sem revisao — a mesma fronteira que faz a IA escolher e nunca escrever. Acao
  desconhecida vinda do armazenamento **cai para `fluxo`**, nao e descartada: perder o registro
  apagaria os trechos que ele digitou, e `fluxo` e o desfecho mais conservador que existe ali.
- **As etiquetas do anuncio entram com origem `anuncio`, NUNCA `conteudo`.** `conteudo` e o que
  decide qual modelo enviar: uma etiqueta de campanha ali disputaria essa escolha com
  "Conteudo Zucco"/"Conteudo Flavio" — o mesmo problema que obrigou a etiqueta ADS a ter
  `fallback`. Elas existem porque **ADS diz que veio de anuncio e nao de QUAL**, e sem isso nao ha
  como filtrar depois quem chegou por qual campanha. Quem manda o modelo e a acao, nao a etiqueta.
- **`state.anuncio` e do contato, e tem que ser zerado na troca.** E calculado em
  `refreshTagSuggestions` e lido em tres lugares (etiquetas, acao da rodada, sinal do quadro). Sem
  o `state.anuncio = null` no `load()`, o anuncio do contato ANTERIOR decidiria o que a rodada
  manda para o proximo — a mesma armadilha da pergunta de cidade, executando a decisao de um em
  outro.
- **`anuncios` e a UNICA fonte; `modeloPorTexto` foi migrado e nao e mais consultado.** A migracao
  (`migracoes.anunciosDoModeloPorTexto`) roda uma vez e nunca sobrescreve o que ele editou. Se as
  duas fossem consultadas, **apagar um anuncio nao teria efeito**: a linha velha continuaria
  mandando o modelo que ele acabou de tirar do ar. `hsm.parseModeloPorTexto`/`formatModeloPorTexto`
  ficaram sem uso em `src/` (so os testes de `hsm` os cobrem) — a tela que os usava nao existe mais.

- **A ARVORE do fluxo e o motor quando ela existe, e ela nasce IGUAL a tabela.** `store.fluxo.arvore`
  so passa a existir depois de ele abrir a janela; ai `panel.sugerirAcaoComFluxo` chama
  `arvore.decidir` em vez de `sugerirAcao`. A semeadura e `arvorePadrao(fluxo)` — as dezesseis
  regras achatadas, **carregando a ordem e as desligadas da versao de lista** —, e o teste exige que
  as duas decidam igual em 400 contextos sorteados com semente fixa. **Se essa assercao cair, abrir
  a janela passa a mudar a rodada sem ninguem ter pedido.** Duas consequencias praticas: nunca faca
  a arvore nascer agrupada (agrupar ja e decisao, e decisao e dele), e regra nova do codigo so
  aparece para quem ja tem arvore se alguem a acrescentar — a heranca de posicao do `ordenar` vale
  na semeadura, nao depois.
- **No que casa e nao resolve NAO para a busca — de proposito.** A arvore cresce "de acordo com a
  demanda", entao ramo pela metade vai existir (ele cria a condicao hoje e escolhe a acao amanha).
  Se a busca parasse ali, o contato sairia da rodada sem nada acontecer e sem nada na tela dizendo
  por que — buraco silencioso, o pior tipo de defeito deste projeto. Hoje ela segue para os irmaos
  e `arvore.problemas` acusa o no na faixa vermelha da janela.
- **Condicao de ramo e SINAL da lista mais palavras, nunca texto livre** (escolha dele, 01/09). Os
  sinais de `arvore.SINAIS` sao chaves que o painel POE NO CONTEXTO: acrescentar um sinal la exige
  alguem calcular a coisa aqui, com teste, senao o ramo nunca casa e nao acusa. Foi por isso que
  `textos`, `ultimoTexto` e `veioDeAnuncio` entraram no ctx de `sugerirAcaoComFluxo` — sem o texto,
  todo ramo de palavra falharia calado.
- **Um ramo pode mandar uma RESPOSTA PRONTA, e ai a `sugestao.tecla` vem NULA.** E a tecla `f`
  (letra, como o `s`, porque os digitos ja tem significado no dedo dele). Quem ler `sugestao.tecla`
  para achar a opcao — o destaque, a automacao — tem que tratar `sugestao.resposta` junto, senao a
  rodada diz "tecla nao disponivel" e para em todo contato desses. **`pedido-ajuda` sai sozinho por
  este caminho, decisao dele (01/09):** o texto NEGA o pedido, e o risco da Lei 9.504/97 e prometer
  beneficio. A trava da IA (`ia.RESTRITOS`) continua de pe — a IA segue sem poder escolher esse
  texto; o que pode e um ramo que ELE escreveu.
- **Um ramo tambem pode ENTREGAR o caso para a IA** (`acao.ia`, pedido dele 01/09) — e ai a tecla
  vem nula do mesmo jeito. Ate entao a IA so entrava onde NENHUM ramo resolvia: ela era o resto.
  Agora e tambem uma escolha. Quem le `sugestao` tem que testar `sugestao.ia` **antes** de procurar
  a tecla, e a automacao das regras tem que PULAR esses casos: quem os executa e a automacao da IA,
  que ja existia. As travas dela nao mudaram (`validarDecisao`, `RESTRITOS`, teto no service
  worker) — nao ha caminho novo para o dinheiro nem para o eleitor.
- **Gesto invisivel e gesto que nao existe.** Ligar duas caixas so dava arrastando uma em cima da
  outra, escrito no cabecalho da janela, e ele perguntou *"como faco para linkar as caixas?"*. O
  mesmo tinha acontecido com o arrastar, que eu havia trocado por botoes. Recurso de quadro precisa
  de alca visivel (o `.pino` na borda direita), nao de instrucao em texto.
- **MOVER e LIGAR nao podem ser o mesmo gesto.** Soltar uma caixa em cima de outra religava o ramo —
  era o unico jeito de ligar antes do pino, e virou armadilha no instante em que o pino nasceu: ele
  arruma o quadro, encosta uma caixa na outra sem querer, e o ramo troca de pai, apagando a ligacao
  anterior em silencio (*"esta removendo ligacao quando tem mais de uma"*, 01/09, com print). Num
  quadro cheio a 35% de zoom as caixas tem 91px: encostar e o normal, nao a excecao. Hoje arrastar
  SO move; ligar e so o pino. **Gesto destrutivo nunca pode ser o mesmo gesto do inofensivo** — e
  quando um gesto novo cobre o antigo, o antigo sai, nao fica como atalho.
- **Gesto tem DIRECAO, e direcao nao se adivinha olhando um pino.** O pino puxa do PAI para o
  FILHO: de A ate B significa "B vai para dentro de A". Ele leu ao contrario — puxava de duas
  caixas ate a mesma caixa esperando ligar as duas A ela, e cada puxada arrancava a caixa do pai
  anterior (*"ao acertar ele remove a outra caixa"*, 01/09). Eu perdi tempo medindo o TAMANHO do
  pino, e ele corrigiu: *"nao e tamanho"*. **Antes de otimizar a mira, confira se o gesto faz o que
  a pessoa acha que faz.** Duas coisas resolveram: a frase ao vivo durante o arrasto com os DOIS
  nomes e o "sai de X" (a metade que ele nao via acontecer), e a lista "Por este ramo dentro de..."
  no editor — **lista nao tem direcao**, e e por isso que ela e o caminho confiavel.
- **"Ligar duas caixas na mesma" e uma operacao de VARIAS PARA UMA, e nenhum arrasto expressa
  isso.** Ele pediu dez vezes; eu entreguei tres caminhos e os tres eram uma-por-vez-com-direcao
  (pino de saida, pino de entrada, lista "por este ramo dentro de"). Cada puxada e uma ligacao so,
  e quando ele pegava a ponta errada a puxada seguinte DESFAZIA a anterior — foi o que ele viu dez
  vezes. **Pior: o pino de entrada que eu criei para "consertar" deu a ele um jeito mais tentador
  de cometer o mesmo erro** (o filho esta sempre embaixo, entao a entrada da caixa de cima e o que
  a mao alcanca). O que resolveu foi a lista de caixas de selecao "Ramos dentro deste": as marcadas
  SAO os filhos, sem direcao, sem mira e sem ordem. **Quando o pedido e N para 1, a resposta e um
  lugar onde os N aparecem juntos.**
- **Nunca jogue a verificacao para segundo plano.** Rodei `checar-modulos` junto com o start do
  servidor num comando com `&`, nao li a saida, e mandei uma janela que nao carregava: o proprio
  verificador dizia *"1 com erro de sintaxe"* (um `const` redeclarado) e eu so descobri pelo console
  do navegador. Verificacao lida depois nao e verificacao.
- **Arquivo de fluxo e ENTRADA NAO CONFIAVEL, e `JSON.parse` nao basta.** O que vem no arquivo
  decide o que a rodada manda para eleitor real. `arvore.sanitizar` peneira campo a campo: regra
  que sumiu do codigo, sinal desconhecido e tecla inventada sao DESCARTADOS com aviso — nunca
  aceitos como ramo que nunca casa e ninguem entende. Tem teto de nos (400) e de fundura (8), id
  repetido ganha id novo, e campo desconhecido nao passa. `deArquivo` devolve `{ok:false, erro}`
  em vez de lancar, porque quem chama e a tela. **O aviso do que foi descartado tem que sobreviver
  ao carregamento**: eu apagava com a linha de sucesso, e ela sumia justo quando ele iria olhar o
  quadro novo e estranhar o ramo faltando.
- **O quadro grava sozinho; `fluxosSalvos` e outra coisa.** `fluxo.arvore` e o quadro de trabalho e
  e gravado a cada mexida. Os salvos com nome sao VERSOES dele (poder experimentar e voltar), e
  ficam numa chave propria — nao na lista de mescla do `store.get`, porque mesclar array daria o
  resultado errado. As contagens de vitoria NAO vao no arquivo exportado: sao medicao desta
  maquina, nao o fluxo.
- **`arvore.fluxoPadrao()` e um DOCUMENTO mantido a partir do que ele escreve, nao codigo meu.**
  Combinado em 01/09: *"preciso de um reset para o padrao do fluxo atual, quando eu mandar aqui
  voce atualiza o padrao"*. Ele escreve nas OBSERVACOES de cada caixa (`no.nota`, texto que nao
  muda comportamento nenhum), aperta "Copiar o fluxo", cola aqui, e eu edito o `fluxoPadrao`.
  **Nao altere essa funcao sem ele pedir**: e o estado ao qual ele volta quando o quadro ficou
  confuso, e e justamente nesse momento que ele nao vai conferir ramo por ramo.
- **O que sai da janela para mim e o FLUXO INTEIRO, nunca so as observacoes.** Eu ia fazer o botao
  copiando so as notas e ele cortou: *"nao faz sentido eu colar para voce sem voce ter a visao do
  fluxo"*. Certo — *"essa aqui esta pegando gente demais"* nao diz nada sem o ramo, a condicao, o
  desfecho e a posicao na arvore, e eu responderia adivinhando. `arvore.paraTexto` numera os ramos
  (`2.1` e o primeiro filho do segundo) para nos dois apontarmos para o mesmo lugar. Vale para
  qualquer relatorio que eu criar depois: **contexto junto do comentario, ou o comentario nao serve.**
- **No QUADRO, a prioridade entre irmaos e a ALTURA na tela** — `arvore.ordenarPorPosicao`, chamada
  depois de todo arrasto. E a unica regra honesta num quadro livre: guardar uma ordem invisivel ao
  lado da posicao faria a tela mostrar um ramo acima do outro e a rodada obedecer o contrario, e
  ele decide a prioridade OLHANDO. Consequencia a lembrar: mover uma caixa para cima MUDA o que a
  rodada faz, mesmo sem tocar em condicao nenhuma.
- **`setPointerCapture` LANCA quando o `pointerId` nao esta ativo**, e a excecao sobe no meio do
  `pointerdown`: o estado do arrasto fica montado e a caixa gruda no ponteiro sem soltar — o
  sintoma e exatamente *"nao consigo arrastar"*. Acontece com caneta, com toque que virou gesto do
  navegador e em automacao (peguei assim). Toda captura de ponteiro vai dentro de `try`.
- **Arrastar um ramo para dentro de um filho dele mesmo faz o ramo SUMIR** — ele sai da arvore
  junto com o novo pai, continua gravado e nao aparece mais. `arvore.reparentar` recusa (devolve a
  arvore intacta) e a tela so acende como alvo quem aceita: prometer um movimento que vai ser
  recusado e pior que nao prometer nada. Tem teste.
- **Nao entregue outro desenho quando ele mandar um desenho.** Eu troquei o leque do quadro dele
  por um esquema indentado, com o argumento de que o leque nao cabe quando a arvore cresce. O
  argumento estava certo e a entrega estava errada: *"a visualizacao continua sem ter nenhuma
  referencia com o que mandei"*. O problema de espaco se resolve com o quadro sendo MAIOR que a
  tela (arrastar o fundo, zoom, "caber na tela"), nao encolhendo o desenho dele.

- **Regra nova no TOPO da tabela tem que ser conferida contra as regras que ela passou a vencer.**
  Pôr algo em primeiro lugar é dizer "isto vence as outras quinze", e em 01/09/2026 eu não olhei
  quais: `sem-interesse` passou a engolir `confirmaPresenca`, e quem respondeu ao convite do evento
  com *"Não conseguirei ir!"* foi etiquetado sem interesse e **concluído em silêncio** — a pessoa
  mais engajada possível (veio pelo anúncio E respondeu) tratada como quem pediu para não ser mais
  chamada. Eu havia testado 19 casos, 12 deles falso positivo, e nenhum era RSVP, porque eu estava
  pensando em hostilidade. **Checklist:** liste as regras que a nova passa a vencer e escreva um
  teste para cada uma que ainda deve ganhar dela.
- **Recusar o EVENTO não é recusar o CONTATO.** `RECUSA_DE_PRESENCA` em `cortesia.js` tira
  `semInteresse` da frente quando a negativa é sobre ir/comparecer/estar presente — aí
  `confirmaPresenca` decide e a tecla 4 manda "não tem problema" + pede os dados. A ordem interna
  importa: a recusa explícita vem ANTES, porque *"não vou mais receber isso, me tira da lista"* tem
  verbo de ir dentro e é recusa de contato.
- **Detector de "sem interesse" vive ou morre pelo FALSO POSITIVO.** Apoiador xinga o adversário em
  terceira pessoa o tempo todo (*"o Lula é um ladrão safado, golpista"*) — é o tipo de mensagem mais
  comum desta base. Regra que olhasse só o insulto tiraria da fila justamente quem mais apoia e
  deixaria rótulo permanente no CRM. Por isso `cortesia.semInteresse` exige insulto **junto** de
  fala em segunda pessoa, e mantém uma lista de **negativas benignas**: *"Não faço parte de nenhum
  grupo político"* é resposta de apoiadora (está no teste do parser), e "não sei" é resposta à
  cidade. Das 19 asserções da regra, 12 são falso positivo — é onde está o risco.
- **A tecla 6 ("Responder à mão") é justamente onde a IA tem que ser chamada.** Ela significa, por
  definição, que nenhuma regra sabe o que mandar — o buraco que a avaliação de contexto existe para
  tapar. Ao reordenar regra-antes-da-IA eu deixei a tecla 6 sem IA, e a rodada passou a parar em
  todo áudio e todo texto longo: *"ela parou de ver praticamente tudo e está passando pra mim"*
  (01/09). Hoje a condição é `!sugestao || sugestao.tecla === '6'`. As outras teclas seguem sem IA
  de propósito: quem manda concluir (3) ou mandar o modelo (1) já sabe o que fazer.
- **Áudio TRANSCRITO não "precisa ser aberto" — e alegar isso na tela é mentira visível.** O motivo
  nasceu quando áudio chegava vazio; hoje a transcrição vem na mensagem, o painel a mostra e o
  parser a lê. A caixa aparecia com a transcrição inteira do lado dizendo que era preciso abrir, e o
  estrago não era cosmético: a regra da tecla 6 vencia **pelo formato**, sem ninguém olhar o
  conteúdo. Regra que decide por tipo de mídia precisa perguntar antes se há texto disponível.
- **Automatizar a rodada é executar as REGRAS, não só a IA.** A metade que o conserto acima exigiu:
  com a regra decidindo antes, a IA não é chamada nos casos conhecidos, `recomendada` fica nula e a
  caixa abriria esperando clique em todo contato com regra — a rodada pararia em quase todos.
  Trocar "manda mensagem errada" por "não anda" não é conserto. Hoje a automação usa a tecla que a
  caixa mostraria em destaque. **Exceção única: a tecla 6** ("Responder à mão"), que por definição
  precisa de gente. Consequência a lembrar: **a maioria das regras ENVIA**, então automação ligada
  manda mensagem sem perguntar em muito mais casos do que antes.
- **Pontuação que some COLA as palavras — troque por espaço, nunca apague.** `normalize` apagava o
  ponto, então "Livramento.RS" virava "livramentors" e o encurtamento `/\blivramento\b/` deixava de
  casar: a fronteira de palavra ia embora junto com o ponto. As formas com espaço e com hífen
  sempre funcionaram, o que faz o defeito parecer "às vezes não pega cidade" — e o contato real que
  escreveu `S.do Livramento.RS` (01/09/2026) recebeu sugestão de **pedir os dados que ele acabara
  de mandar**. Vale para qualquer separador que você for limpar num normalizador: espaço preserva
  a fronteira, sumiço destrói. Tem teste de regressão com a string exata.
- **Aceitar a cidade no popup marca `confirmada: true`, e é isso que libera as etiquetas.** Sem a
  marca, o aceite gravava a cidade e deixava cidade/COREDE de fora, porque `etiquetaConfiavel` só
  olhava `crm`/`exata`. Confirmação dele vale como valor do CRM: foi ele que olhou a conversa.
- **Etiqueta de cidade entra por DOIS caminhos, e o nome tem uma fonte só.** No fluxo normal via
  `tags.suggest` (`origem: 'cidade'`) e em massa pela aba Cidades. Os dois pegam o nome de
  `categorizar.nomeDaEtiqueta` — duas fontes criariam duas etiquetas para a mesma cidade e
  partiriam o filtro dele em duas.
- **Cidade trocada tira a etiqueta de cidade E a de região.** `etiquetasDeRegiaoASair` trata as
  duas famílias (`tags.cityTagIds` + `tags.regionTagIds`), e só tira a antiga **se a nova ficar** —
  senão o contato acaba sem etiqueta de lugar nenhuma. Sem a metade da cidade, trocar de município
  deixava o contato em dois filtros de cidade ao mesmo tempo.
- **A etiqueta de CIDADE é o que permite filtrar por município.** A API só filtra por etiqueta, e
  o COREDE agrupa dezenas de municípios — daí a aba Cidades. Ela **nunca** cria etiqueta a partir
  do que está escrito no campo Cidade sem casar com os 497 municípios da planilha oficial: o campo
  é texto livre, e "não sei"/"aaa"/cidade de outro estado viraria etiqueta permanente no CRM.
  O que não casa vai para a lista de revisão na tela. Ver `categorizar.analisar`.

- **"Confirmado" sozinho NAO e confirmacao de presenca.** Anotacao da Nice (04/09/2026): *"Nossos
  votos, estao confirmados: Capitao Martim para Deputado Estadual, Capitao Zucco para
  Governador..."* — declaracao de VOTO — e a rodada a PULOU como quem confirma presenca em evento.
  O padrao aceitava a palavra solta em qualquer posicao, e nesta base "confirmado" e dito de voto,
  de chapa e de agenda. Hoje ela precisa vir **com o que a torna presenca** (presenca, ida,
  participacao, "estarei") ou **ser a mensagem inteira**. E o mesmo conserto que "vamos"/"vou"
  soltos levaram em 02/09, e pela mesma razao: **verbo sozinho e vocabulario de campanha, nao
  resposta ao convite.**
- **`momentoJaEnviado` nao e "ja respondi hoje", e a etiqueta de engajado confundia os dois.**
  Anotacao da Janete (04/09): ela tem "Engajado", mandou dois audios e clicou em dois anuncios, e a
  caixa ofereceu a mensagem do momento — *"ja mandei mensagem hoje, mesmo nao sendo do momento; nao
  mandar quando ja respondi"*. A guarda que existia so sabia da mensagem do momento: quem respondeu
  a mao, ou com outra resposta pronta, nao aparecia ali, e o engajado que fala o dia inteiro recebia
  a mensagem do momento por cima da conversa que acabara de ter. Hoje
  `etiqueta-dispensa-da-fila` olha `respondidoHoje` primeiro — a mesma guarda que
  `ultima-e-so-reacao` ja usava.


- **A IA nao tem relogio, e instrucao no prompt nao da um.** Relato dele (04/09/2026): *"a IA esta
  sem acesso a data e hora atual; botei nos comandos extras da IA para ver a data e hora atual mas
  nao mudou nada"*. Estava certo nas duas metades — **nada no prompt levava data nenhuma** (nem
  "agora", nem quando cada mensagem chegou), e as instrucoes extras dele vao para o prompt de
  SISTEMA, que e texto: mandar o modelo "ver a hora" nao da hora a ele. Hoje `montarContato` e
  `montarContatoRascunho` abrem com `agoraEmPortugues(agora)` e marcam cada mensagem com
  `quandoFoi(at, agora)` — `hoje 11:29`, `ontem 18:07`, `02/09 13:35`. **O relogio fica no bloco do
  CONTATO e NUNCA no de sistema**: o sistema leva `cache_control: ephemeral`, e o horario ali
  invalidaria o cache a cada chamada — a diferenca entre 10% e 100% do preco de entrada. Mensagem
  sem `at` sai sem marca, de proposito: inventar horario faria a IA raciocinar sobre dado falso.
- **O relogio entrou no caminho da DECISAO e faltou no do RASCUNHO — que e o que escreve para
  eleitor.** Print dele (04/09/2026): *"Boa noite!"* as **16:21**, e ele: *"ja tinha falado para
  checar hora e data atual antes de formular mensagem"*. `montarContato` abria com
  `agoraEmPortugues`; `montarContatoRascunho` so carimbava cada mensagem com `quandoFoi`, e a
  ultima fala dela estava marcada `ontem 20:21` — "boa noite" era a deducao natural. **Carimbar as
  mensagens nao e ter relogio**: e saber quando as coisas foram, sem saber quando e agora. Ao dar
  contexto novo a IA, confira os DOIS blocos: sao duas funcoes, e a que escreve texto e a que
  custa caro.
- **Saudacao nao se pede ao modelo: calcula-se.** `saudacaoDeAgora` decide pela hora do relogio, o
  bloco do contato diz qual e **por extenso**, e `revisarRascunho` **troca** a errada quando ela
  abre o texto (unica correcao que ela faz no rascunho, com aviso dizendo que trocou). Instrucao no
  prompt e pedido — a mesma licao do relogio, um dia depois. Rascunho sem saudacao continua sem:
  acrescentar uma seria escrever no lugar da IA.

- **Mudar a FORMA do que se passa para uma funcao pura quebra quem ela chama, em silencio.** Ao
  dar horario as mensagens, `mensagensParaIA` passou a devolver `{texto, at}` em vez de string — e
  `gabinete.precisaDoDossie` faz `join('\n')`, que viraria `[object Object]`: o dossie deixaria de
  ser pedido sem erro nenhum. Peguei conferindo os chamadores, nao por teste. **Toda vez que o
  formato de um argumento mudar, procure quem mais o recebe.**
- **Pergunta pendente e a da RAJADA, nao a da ultima mensagem.** Print da Ieda (04/09/2026):
  *"Obrigada pelas relevantes informacoes!"*, *"Voce e candidato daqui do RS?"*, *"Boa tarde!"* — e
  a rodada ofereceu a mensagem do momento. Ele: *"ja vimos antes que responder a pergunta e
  prioridade"*. `terminouComPergunta` olhava so a ultima mensagem com texto, entao o cumprimento em
  cima escondia a pergunta. Hoje e `perguntaPendente`, que varre tudo o que chegou desde a nossa
  ultima fala — por definicao, o que ainda nao foi respondido. **O que cancela e uma RETRATACAO
  explicita** ("deixa pra la", "esquece", "ja resolvi") vinda DEPOIS da pergunta, e nao uma mensagem
  qualquer em cima; e a mesma ideia da retratacao em `semInteresse`.


- **LISTA DE FORMAS DE PERGUNTAR NAO FECHA — a inversao e que fecha.** Tres anotacoes, tres vezes o
  mesmo conserto (acrescentar uma forma a lista) e tres vezes o mesmo defeito de volta: Teresinha
  (*"tem alguem que vem na casa da gente pra conversar"*), Paulo Quevedo (*"Colorado ou
  Gremista?"*) e Ieda (*"Voce e candidato daqui do RS?"*, 04/09/2026). Ninguem cadastra todas as
  maneiras de perguntar. Hoje `conversaTemPerguntaAberta` inverteu: **e pergunta a menos que uma
  resposta PRONTA a responda**, e essas estao escritas em `RESPONDIDA_POR_PRONTA` — as cinco
  exclusoes dele (pedido de material, "tudo bem?", oferta de ajuda, material para compartilhar,
  grupo). Em 03/09 eu tentei alargar para "qualquer ?" **sem** escrever as exclusoes e quebrei as
  cinco; elas so existiam por acidente, por nao casarem com a lista curta. **A guarda de POSICAO
  continua** (sem "?", so conta abrindo a mensagem): e ela que impede o "pq" explicativo. E o custo
  e conhecido e e o lado barato: mais contato indo para a tecla 6.
- **Excecao que ele nomeia vai na CONDICAO, nao na posicao.** Ele definiu a excecao do tempo no dia
  em que criou a regra — *"unico pretexto que exclui a necessidade de hora e pergunta pendente"* — e
  eu a implementei como ORDEM (`contexto-de-outro-dia` abaixo de `pergunta-aberta`). Ordem so cobre
  o que a regra de cima reconhece, e no dia seguinte a Ieda escapou. Hoje a excecao esta no
  `quando` da propria regra, e por isso vale **onde quer que a caixa esteja no quadro dele** —
  inclusive nos quadros ja exportados. **Posicao e preferencia dele; excecao que ele nomeou e regra
  dele.**


- **"Pode contar comigo" nao e confirmacao de presenca — e o TERCEIRO apagamento dessa lista pelo
  mesmo motivo.** Anotacao do Guilherme (04/09/2026): *"Pode contar comigo e toda minha familia
  somos muitos e somos Bolsonarista ate a morte"* fez a rodada PULA-LO como quem confirma presenca.
  *"nao e evento, somente apoiando"*. Antes dele sairam "vamos"/"vou" soltos (02/09) e "confirmado"
  solto (04/09). **A regra que fica: vocabulario de campanha nao e resposta ao convite** — e a frase
  continua em `EXPRESSOES_DE_APOIO`, que e de onde ela deve decidir.
- **Guarda que depende de um campo da Config preenchido NAO e guarda.** Anotacao do Geminiano
  (04/09): a caixa dizia *pediu "ADS" e ha modelo mapeado — mande*. A guarda de 02/09 (a etiqueta
  ADS e ORIGEM, nunca conteudo) monta a lista de `etiquetaAnuncio` + as etiquetas de cada anuncio —
  entao com o campo VAZIO a ADS volta a ser conteudo pela tabela "Modelo por conteudo", onde ele tem
  `ADS = Campanha Martim`. Hoje `tags.ORIGEM_SEMPRE` e o piso: o nome e literal de proposito, e
  nenhum conteudo se chama ADS.


- **A negativa de ABERTURA so vale se a mensagem FOR a negativa — e a piada custou uma etiqueta
  permanente.** Anotacao do Alfredo (04/09/2026): ele mandou uma foto e escreveu *"Nao precisa muito
  pra ser feliz 😂😂😂😂"* — piada sobre a propria foto — e foi **etiquetado como sem interesse e
  concluido em silencio**. `COMECA_NEGANDO` existe porque a pergunta que fizemos era FECHADA
  ("posso te mandar os conteudos?"), e resposta a pergunta fechada e curta; uma frase de trinta e
  nove caracteres que segue falando de outra coisa nao responde pergunta nenhuma. Hoje ela exige
  **mensagem curta (<= 28) ou o "nao" colado no que se recusa** (`NEGACAO_COM_OBJETO`). Das doze
  asercoes do teste, nove sao falso positivo — e onde mora o risco desta regra.
- **O numero do ADVERSARIO e o espelho do "22", com a mesma guarda.** Anotacao da Rosa Maria
  (04/09): *"MINHA CONCIENCIA DIZ QUE TENHO QUE SER 13"* e, na seguinte, so *"13"* — e a rodada
  ofereceu a mensagem do momento. *"13 e numero do Lula, adversario; e comum repetirem 13 para
  mostrar hostilidade"*. O numero SOLTO nao basta (13 e endereco, hora e idade): vale como a
  mensagem inteira, ou colado num verbo de votar/ser.
- **"Obrigada por nada" e despedida, e o desfecho da despedida e o que ele queria.** Anotacao da Eva
  (04/09): ela pediu ajuda financeira, recebeu a negativa e respondeu *"Entao deixa muito obrigada
  por nada"*; a rodada ofereceu a mensagem do momento. *"vou concluir sem mandar nada"* — que e
  exatamente a tecla 3 da despedida. `DESPEDIDA_AMARGA` **nao passa pela conferencia do "sobrou
  conteudo"**: a frase inteira e a despedida, e exigir que nada sobre a faria deixar de contar.
- **A SIGLA DO ESTADO depois do nome e contexto de cidade.** Duas anotacoes de 04/09 (Maria Virginia
  e Carmem): as duas escreveram o cadastro inteiro numa frase so — *"cidade de Gravatai rs Maria
  Virginia da Silva"*, *"CARMEM ... CRUZ. URUGUAIANA RS FRONTEIRA."* —, sem pista na frente e longe
  do corte de "texto curto". **Ninguem escreve "RS" depois de uma palavra que nao e cidade daqui**:
  a sigla e a afirmacao de que o que vem antes e um lugar. A passada olha para TRAS da sigla (as
  pistas normais olham para a frente) e exige casamento `exata` — "rs" tambem e risada nesta base.
  Entrou junto `cidade de/do/da`, que faltava na lista de pistas.


- **A etiqueta de ORIGEM tinha uma TERCEIRA porta: a regra de conteudo dele.** Anotacao da Fatima
  Silva (04/09/2026): a caixa dizia *pediu "ADS" e ha modelo mapeado*, um dia depois de a ADS ter
  sido barrada. As duas portas conhecidas estavam fechadas (`conteudosJaAplicados` e o piso
  `ORIGEM_SEMPRE`) — faltava o laco de `tagRules` dentro do `suggest`: **uma regra dele cujo alvo e
  a etiqueta de origem** (o texto do anuncio casa, a regra aponta para ADS, ADS volta como
  conteudo). Terceira porta do mesmo vazamento. **"Duas listas separadas divergem" vale tambem para
  dois PONTOS de filtragem**: agora as tres consultam `etiquetasDeOrigem()`.
- **A SIGLA do estado vem com separador no meio: `R / S`, `R-S`, `R.S`.** Anotacao do Romario
  (04/09): *"Romario gralow cidade Panambi R / S"* — e a cidade sumiu, com a mesma pessoa tendo
  escrito o nome certo. E a repeticao da licao de 01/09 (`rs`, `rgs`, `rgds`): **sigla incompleta
  faz o defeito parecer aleatorio.** Entrou junto a pista `cidade <nome>` sem preposicao, que e como
  ele escreveu.
- **"Me liga" tem resposta pronta propria** (pedido dele, 04/09, anotacao da Jucileia): *"caso raro
  que a pessoa pede ligacao: criar mensagem falando que nao podemos e dando uma desculpa; nao
  fazemos ligacoes, a plataforma nao aceita e e contraproducente"*. O texto **nao promete retorno** —
  quem pede ligacao esta esperando o telefone tocar, e um "vamos ver" deixa a pessoa aguardando algo
  que nao vem. `cortesia.pedeLigacao` e a lista, curta e literal: alargar mandaria a recusa para quem
  so falou de telefone ("meu telefone mudou", "liguei para o CRAS"), e o texto E uma recusa.


- **O modelo PADRAO so sai na PRIMEIRA vinda pelo anuncio.** Regra dele (04/09/2026): *"a excecao
  de mandar modelo novamente e somente quando o modelo nao e o padrao; contato que nao e a primeira
  vez que vem por anuncio nao recebe modelo padrao"*. E a definicao que ele deu no mesmo recado:
  **"padrao" e todo anuncio que NAO esta listado na Config** — reconhecido e o que ele cadastrou e
  deixou ligado; o resto cai no padrao. As tres guardas ficam em `panel.js`, na montagem de
  `modelosPadrao`: `veioDeUmAnuncio && !temEtiquetaDeCidade && !jaRespondemosAntes`. `jaRespondemosAntes`
  e o "nao e a primeira vez" **entregue**, e nao "ja falamos": pergunta nao conta (licao da Ivone,
  31/08). **O modelo do anuncio RECONHECIDO nao e travado por nada disto** — ela clicou pedindo
  aquilo, e aquilo e conteudo de verdade, nao recibo.


- **"Mensagem a mensagem" tinha DUAS portas, e so uma foi consertada em 02/09.** O caminho generoso
  (`respostaAoPedido`, dentro do `extract`) continuou olhando a conversa INTEIRA colada — e a
  conferencia que o protege ("o que sobra depois da cidade tem que ser um nome de gente") passava a
  ver o texto do anuncio junto, entao **nada era aceito**. Quem chega pelo anuncio tem SEMPRE duas
  mensagens: o modo generoso nao funcionava justamente para a maior parte de quem chega. Tres
  anotacoes de 04/09/2026 com a mesma forma (nome completo + cidade numa frase so) e a mesma
  queixa. Medido: a resposta que da `Chuvisca` sozinha devolve vazio com a mensagem do anuncio
  junto. **Conserto que muda ONDE se procura tem que ser aplicado a todos os caminhos que
  procuram** — e agora mensagem que casa mas nao passa na conferencia nao derruba mais a passada
  inteira, so segue para a proxima.
- **Tirar a cidade do meio da frase deixa a PREPOSICAO pendurada, e ela conta como palavra do
  nome.** *"<Nome> de Minas do Leao"* vira a sobra `<Nome> de` — que estourava o limite de quatro
  palavras do nome por causa de um "de" que e da cidade, nao do nome. `semConectorSolto` tira nas
  duas pontas.
- **Abreviacao de CIDADE so vale colada na sigla do estado.** `RG RS` e Rio Grande (anotacao de
  04/09/2026), mas `RG` e o documento de identidade, e um apelido em `ALIASES` valeria no texto
  inteiro: *"meu RG e 123"* viraria Rio Grande na base toda. Por isso existe `SIGLAS_DE_CIDADE`,
  lido **so** na passada que olha para tras da sigla do estado — a mesma razao pela qual
  `rio grande` sozinho nunca entra na limpeza do nome do estado. A lista e literal e so cresce com
  caso trazido por ele.
- **Valor em dinheiro tambem se escreve por EXTENSO.** O marcador exigia digito antes de "reais", e
  *"Qualquer mil reais ja me ajuda"* (anotacao de 04/09) passou batido duas vezes na mesma rajada —
  o caso foi para a tecla 6 em vez da resposta que nega. A palavra do valor precisa vir **colada**
  em "reais": "mil" sozinho e a quantidade de tudo nesta base ("mil abracos", "mil vezes").
  Entraram junto `aluguel`, `farmacia` e `conta de luz/agua` nas NECESSIDADES, que continuam
  exigindo o verbo de pedir.

- **Quem ABRE o caso de material e o NOSSO pedido de endereco, e ele nao conclui.** Relato dele
  (04/09/2026), com a print do modelo aprovado: *"pedi o endereco pelo modelo e nao etiquetou e
  concluiu"*. O que existia era so a outra ponta — `cortesia.informouEndereco`, para quando ELA
  responde. Hoje `templates.ehPedidoDeEndereco` reconhece o nosso pedido **por invariante**
  ("endereco completo", ou a enumeracao rua + numero + bairro), e duas coisas acontecem: a etiqueta
  de material e aplicada dentro do `sendTemplate` (o ponto UNICO por onde tudo sai) e a rodada
  **deixa o atendimento ABERTO**. Concluir ali e pior que nos outros casos: a conversa acabou de
  fazer uma pergunta, e fechar diz "nao precisa responder" para quem ia mandar o endereco.
  **Por invariante e nao por id** porque este pedido sai por MODELO APROVADO, cuja redacao e da
  plataforma e muda sem passar por nos.

- **O formulario seco, dias depois, chega sem contexto — e a tecla 5 passou a levar o pedido
  junto.** Print dele (04/09/2026): o contato mandou uma imagem de bom dia as 08:18 e recebeu as
  21:16 *"ATENCAO! Para eu poder salvar seu contato me diga seu: Nome, Cidade"*. Ele: *"soltou sem
  contexto nenhum"*, e a ideia veio junto — *"sera a mensagem do momento + notei que estou sem seu
  nome aqui nos meus contatos e nao sei de onde voce e"*. **Nao e tecla nova**: e a tecla 5 trocando
  de TEXTO quando o contato ja recebeu o formulario e continua sem nome e sem cidade, o mesmo
  desenho de `confirmaPresenca` na tecla 4 — e o rotulo da opcao muda junto, senao a rodada mandaria
  duas coisas diferentes com o mesmo nome na tela.
- **O id da mensagem combinada continua sendo o do MOMENTO, e e o que impede a repeticao.** A
  anti-duplicata precisa enxergar as duas formas como a mesma entrega (quem recebeu a combinada
  recebeu a do momento), e e isso que faz `momentoJaEnviado` apagar o sinal na passada seguinte. Id
  proprio faria a caixa oferecer a mesma coisa todo dia.
- **Texto que pede dados sem a linha `Nome , Cidade` quebra o reconhecimento da resposta.** O
  invariante e o que `templates.ehPedidoDeDados` casa; sem ele a resposta dela deixa de ser lida
  como resposta ao formulario e a rodada pede outra vez — foi o que custou tres anotacoes quando o
  separador do template mudou. O campo novo da Config avisa na tela quando o texto perde a linha, e
  ha teste no `templates.test.mjs`.

- **Ruido da plataforma que carrega LINK vira DADO — e virou cidade no CRM.** Print dele
  (05/09/2026): o fluxo trazia *"Aguardando mensagem. Essa acao pode levar alguns instantes. Saiba
  mais: https://faq.whatsapp.com/..."* e o painel mostrava **Cidade: faq.whatsapp.com**, com a
  resposta do grupo oferecendo *"Este e o grupo de faq.whatsapp.com"*. Medido:
  `ehMensagemDaPlataforma` devolvia false. Mesma familia do Carlos e da Vera (02/09), com a
  diferenca que torna esta pior — no modo `respostaAoPedido` o parser aceita QUALQUER palavra solta,
  entao a URL do aviso virou municipio. **Aviso novo da plataforma entra em
  `MENSAGENS_DA_PLATAFORMA` no mesmo dia em que aparecer**, e o conserto NAO limpa o que ja foi
  gravado.

- **Xingamento no IMPERATIVO e segunda pessoa, e a lista nao sabia disso.** Print dele (05/09/2026):
  a contato chegou pelo anuncio e um minuto depois escreveu *"Entao va para o inferno..
  desgracado"* — *"chegou hostilizando e extensao nao reconheceu"*. Medido, as duas metades
  falhavam: `desgracado` nao estava em `AGRESSAO`, e *"va para o inferno"* nao estava em
  `DIRIGIDA_A_NOS`, que so conhecia PRONOMES. Testando antes de mexer, *"vai tomar no cu"* e
  *"voce e um desgracado"* tambem passavam batido — nao era o caso, era a regra inteira. **A guarda
  que fica:** o imperativo sozinho so conta quando e a mensagem INTEIRA, porque *"kkkk vai tomar no
  cu esse Lula"* e apoiador falando do adversario — mesma disciplina do "confirmado" e do "13".
- **Instrucao extra da IA que e MECANICA vira conserto, nao pedido.** *"a IA nao segue todas as
  instrucoes? pedi para nao usar travessao eme e continua usando"* (05/09/2026). Prompt e pedido;
  `revisarRascunho` e regra — hoje ela troca o traco eme por hifen e avisa. O criterio para entrar
  la e **mecanico e sem julgamento**: abrir com "entendi" (a outra instrucao dele) so gera AVISO,
  porque consertar exigiria reescrever a frase, e conteudo (*"de corda para quem busca
  remuneracao"*) fica so no prompt. **E confira quem CHAMA:** o painel jogava fora os avisos de
  `validarRascunho` e chamava `revisarRascunho` com o OBJETO (`[object Object]`), entao nenhum aviso
  jamais apareceu na tela.

- **A IA ESCREVE onde o deterministico nao resolve; ela nao escolhe mais resposta pronta.** Regra
  dele (06/09/2026): *"o botao de chamar IA foi feito exatamente pra isso: quando nenhuma resposta
  serve, ela da uma resposta personalizada. Essa e a funcao dela. Tudo que o deterministico nao
  consegue resolver, ela resolve"*. A contradicao que saiu: **tecla 6 significa, por definicao, que
  nenhuma resposta pronta serve** — e a IA escolhia uma, de um conjunto que a regra acabara de
  dizer que nao servia, e com "Automatizar" marcado mandava e concluia. Era o unico ponto em que a
  IA substituia uma decisao do quadro. Hoje as tres portas (nada decidiu, tecla 6, ramo `acao.ia`)
  tem um desfecho so: **rascunho no campo de mensagem**, e ele manda. **Sairam junto** a tecla 0,
  `enviarEscolhaDaIA`, o bloco "a IA assume a rodada" e as linhas da opiniao dela na caixa — 181
  linhas removidas, porque funcao sem gatilho e a armadilha do `pedido-emprego`. `avaliarComIA`
  continua viva no botao "Avaliar o contato aberto" da Config. **Fica mais barato** (uma chamada em
  vez de duas quando ela escalava) e **a rodada automatica para nesses ~5%**, com o rascunho pronto
  — que e o que a tecla 6 sempre significou.

- **Ligar a IA muda DUAS coisas, e uma delas so existia no modo automatico.** Relato dele
  (06/09/2026): *"ao ativar a IA ela esta ignorando o fluxo; a IA deve assumir para ter certeza que
  a cidade esta correta e em casos que eu deveria assumir para responder"*. Medido em 20.000
  contextos, nos dois quadros: a IA e consultada em **5,4% a 5,8%** — quase tudo **tecla 6** —, e o
  fluxo resolve **94%** sozinho; o relato de "ignorando o fluxo" nao se sustenta no numero. O que
  faltava era a outra metade: `cidadeConferidaPelaIA` exigia `rodadaAutomatica()`, entao **rodando
  contato a contato ligar a IA nao conferia cidade nenhuma**. Hoje ela vale com a IA ligada e a
  rodada andando (fora da rodada, nao: cada chamada e dinheiro). **O unico ponto em que a IA
  substitui o quadro e a tecla 6 com "Automatizar" marcado** — e o log passou a dizer de quem ela
  tomou o caso, porque a linha so dizia "IA assumiu". Tensao registrada: tecla 6 significa que
  NENHUMA resposta pronta serve, e o que a IA manda ali e uma resposta pronta.

- **O QUADRO tem versao, e ela tem que estar na tela.** Pedido dele (05/09/2026): *"o fluxo
  atualmente nao fala qual versao ele esta utilizando"*. O quadro e uma COPIA do padrao e caixa nova
  so decide depois que ele importa — o quadro dele passou o dia 05/09 no arranjo da 2.41.0 enquanto
  o padrao andava ate a 2.55.0, e a unica forma de saber era eu escrever no registro. A versao ja
  existia **dentro do `nome` do arquivo** (`"fluxo padrao 2.54.0"`), que e texto que ele reescreve:
  hoje e o campo `extensao`, separado do `versao` que e o FORMATO do arquivo. **O carimbo e posto no
  `gravar`**, nao em cada botao — sao quatro caminhos que trocam o quadro inteiro, e o quinto
  carimbaria errado. E a linha da janela mostra DUAS coisas de naturezas diferentes: a versao (um
  carimbo, envelhece) e **quantas caixas do padrao de hoje faltam** (medido a cada desenho, nao
  depende de ninguem lembrar de carimbar). **Quadro ou arquivo sem carimbo fica "desconhecida"** —
  preencher com a versao de agora carimbaria como novo um quadro velho.

- **`session.utm` é "veio de anúncio NESTA sessão"; a ETIQUETA é "veio de anúncio".** Print dele
  (05/09/2026, o Orides): etiqueta **ADS** no CRM, mandou um vídeo do TikTok e recebeu as
  boas-vindas de *"chegou sem anúncio"* com o pedido de cadastro junto — *"a pessoa com etiqueta de
  ADS e parou no ramo de sem etiqueta"*. Quem clicou semanas atrás e volta sozinho abre sessão sem
  `utm`. O SINAL do quadro passou a ser `utm` **ou** etiqueta de origem; as outras duas leituras de
  `utm` ficaram como estavam de propósito — `prepararEntrantes` marca a primeira mensagem DESTA
  sessão (etiqueta velha marcaria a fala de outra visita) e a etiqueta de origem só é aplicada a
  quem chega agora. Mesma lição da etiqueta de sem interesse: **detector é palpite, a marca é
  decisão, e decisão não se redescobre.**
- **A CONVERSA e a memoria da SESSAO; o CRM e a memoria de verdade.** Print da Rosa (05/09/2026),
  dois dias depois do Orides e pelo mesmo motivo: figura de "bom dia", etiquetas de cidade, COREDE e
  conteudo no CRM, e ela recebeu as **boas-vindas do gabinete** — *"nao foi a primeira vez que a
  pessoa veio, mesmo que esteja sem etiqueta ADS; correto seria mensagem do momento, dois casos
  seguidos ja"*. Voltar sozinha abre **sessao nova**: `state.nossas` nasce vazio, entao
  `jaRespondemosAntes` dava falso e o quadro a mandava para o ramo *"anuncio — pessoa nova"*, onde
  `chegada-boas-vindas` a apresentou pela segunda vez. Hoje o sinal soma duas marcas do CRM: a
  **Data de conclusao do contato** (so a extensao grava, ao concluir — falso positivo e impossivel)
  e a **etiqueta de cidade que JA ESTAVA la**, que e a decisao dele de 02/09 (*"se a pessoa ja
  respondeu a cidade a chance de ela ter recebido um modelo e muito grande"*). Duas coisas: a
  etiqueta que esta rodada VAI gravar nao conta (`cidadeJaNoCrm` e separado de
  `temEtiquetaDeCidade`), senao quem responde o cadastro na primeira vinda vira retorno na mesma
  passada; e o **custo, dito a ele** — contato de base importada, com cidade preenchida e
  conversando pela primeira vez, passa a receber a mensagem do momento em vez das boas-vindas.
  Medido: 2,9% dos contextos com etiqueta de cidade mudam de desfecho, e **dois tercos deles nao
  tinham desfecho nenhum** (o ramo da chegada nao tem `ja-respondemos-antes`).
- **"Ja veio antes" esta na TELA: o botao "Ver conversa anterior".** Foi ele quem apontou
  (05/09/2026): *"tem uma trava que identifica pessoa nova, que e conversa anterior; normalmente eu
  tenho que clicar para abrir a conversa do dia anterior"*. A plataforma so mostra esse botao quando
  existe atendimento anterior — e e o que a API nao da: `getConversation` e por SESSAO, entao
  conversa sem nada nosso pode ser a primeira vinda ou a decima. `dom.temConversaAnterior` le por
  TEXTO (o `data-cy` nao e conhecido), rejeitando o que esta dentro de balao de mensagem, e o
  painel guarda em `state.temConversaAnterior`, zerado na troca de contato. **Falhar devolve
  `false`**, e ai decide a etiqueta de cidade, como antes.
- **A DATA DE CONCLUSAO nao prova entrega — e eu escrevi que "falso positivo e impossivel".** Print
  da Neiva (05/09/2026, horas depois do conserto da Rosa): chegou pelo anuncio do Facebook, escreveu
  so o texto do anuncio, **sem etiqueta de cidade**, e recebeu o modelo + agradecimento em vez do
  modelo + o pedido de cadastro. *"Comecou a mandar agradecimento em vez de pedir os dados; segundo
  caso ja, e claramente e pessoa nova que chegou por anuncio."* A data prova que ja **CONCLUIMOS** um
  atendimento, nao que ja **ENTREGAMOS** alguma coisa — e esta rodada conclui em silencio o tempo
  todo (tecla 3, `ultima-e-nossa`, `etiqueta-so-conclui`): num dia de 268 conclusoes ela esta em
  quase todo mundo. **E a licao da Ivone (31/08) na forma que eu nao reconheci: pergunta nao e
  entrega, e conclusao tambem nao.** Medido: com o sinal verdadeiro o caso vai para
  `conteudo-pedido` (tecla 1); com ele falso, para `anuncio-modelo-e-dados` (tecla `a`).
- **CONVERSA LONGA nao e decidida por "sem interesse" — recusa de verdade e curta.** Print dele
  (05/09/2026): um contato que chegou pelo anuncio escreveu **927 caracteres** de analise politica
  (muculmanos, Xandao, o "golpe apos a eleicao") e foi etiquetado como sem interesse. *"Duas
  conversas longas foram reconhecidas como sem interesse; for assim, eu que analiso ou a IA."*
  Quem pede para sair escreve uma linha e vai embora; quem escreve nove esta conversando, mesmo com
  o assunto raivoso — e e ai que o detector erra, porque **esta base e de apoiadores que falam mal
  do adversario**. A guarda do texto curto ja existia dentro de `COMECA_NEGANDO` (28 caracteres, o
  caso do Alfredo); agora vale para a regra inteira, como `!c.pedeRespostaPessoal` na `quando`.
  **Na CONDICAO e nao na ordem**, porque `sem-interesse` e protecao do codigo e decide tambem nos
  quadros ja exportados, onde caixa nova nunca chega. O custo: quem escreve um textao pedindo para
  sair vai para a tecla 6 em vez de ser marcado — o lado barato, porque esta e a regra mais
  destrutiva do arquivo (etiqueta permanente **e** conclusao em silencio). **O texto da print nao
  reproduz o defeito** (`semInteresse` devolve null para ele, inteiro e em pedacos): o gatilho esta
  no que a print nao mostra, e a guarda cobre a classe sem depender de achar o padrao.
- **A copia que ninguem exercita e a que envelhece — e uma delas estava numa ABA.** Pedido dele
  (05/09/2026): *"faca um botao de chamar IA na aba das respostas que bote o texto na caixa"*. O
  cartao ja existia, e montava a chamada de `iaCliente.rascunhar` **por conta propria**, em vez de
  chamar `rascunharParaEle` (a tecla 8). Resultado: ficou tres consertos atras — nao mandava o
  **Nome** (a Catarina, 03/09), nao pedia o cadastro nem tinha o **PISO** do bloco `Nome , Cidade`
  (05/09), e **jogava fora os avisos** da revisao (a saudacao trocada, o traco eme). A rodada e
  exercitada centenas de vezes por dia e a aba nao, entao a divergencia nao aparece em relato
  nenhum: aparece so quando ele usa o botao. **Ao consertar um caminho, procure quem mais faz a
  mesma coisa** — `grep` pelo nome da funcao de baixo nivel (`iaCliente.rascunhar`), nao pela de
  cima.
- **Botao que nao diz a TECLA vira um segundo vocabulario.** Os cartoes da aba Respostas nasceram
  antes do quadro, com nomes proprios ("Pedir os dados e seguir"), e o trabalho dele hoje e por
  tecla. Enquanto o nome nao disser qual e, nao ha como notar que uma das duas versoes envelheceu —
  foi exatamente o que aconteceu com o cartao da IA. Hoje cada cartao diz a tecla, e o **link de
  grupo** — que nao corresponde a tecla nenhuma e cujo proprio comentario dizia *"nao faz parte do
  dia a dia"* — desceu para o fim da aba. **Nao foi removido:** funcao so sai quando ele pede.
- **"Estou com" nao e apoio: o que qualifica e o OBJETO ser NOS.** Print da Elenir (05/09/2026):
  *"Nao posso falar. **Estou com** infeccao urinaria e respiratoria. muita tosse e febre. Falarei
  assim que for possivel..."* — e a rodada agradeceu o APOIO e concluiu. O padrao aceitava
  `(estou|tamo|to)\s*(com|junto|juntos)` com qualquer coisa depois do "com", e "estou com" e a forma
  mais comum de dizer o que se TEM: duvida, problema, fome, medo, febre. **A guarda ja estava
  escrita tres linhas abaixo, para o padrao vizinho** (*"'com voces' sozinho ficou de fora de
  proposito"*) e nao tinha sido aplicada aqui. Hoje "junto" vale sozinho e "com" exige o objeto
  (voces, o senhor, a campanha...), com `contigo` entrando junto.
- **Mal-estar nao se responde com material de campanha, e concluir e pior que nao responder.**
  Mesmo caso, a outra metade: nada reconhecia que ela estava doente. *"Caso de mal estar foi
  ignorado e concluido."* `cortesia.naoPodeFalarAgora` cobre as duas situacoes que tem o mesmo
  desfecho — **quem esta passando mal** e **quem avisa que fala depois** — e a regra
  `nao-pode-falar-agora` (tecla 6) foi JUNTADA na caixa de `ultima-pede-resposta-pessoal`, que diz
  a mesma coisa: aqui precisa de gente. **Primeira pessoa e obrigatoria**, e e o que sustenta o
  detector: nesta base a doenca aparece na fala politica (*"o Brasil esta doente"*), no pedido de
  remedio (regra propria, acima desta) e na noticia de terceiro (*"minha vizinha esta internada"*).
  Metade das asercoes do teste e falso positivo. **Concluir e o pior desfecho**: ela avisou que
  voltaria, e fechar responde que nao precisa.
- **RAJADA de cliques em anuncio nao e pedido de conteudo: e navegacao.** Print da Irene
  (05/09/2026): tres cliques seguidos em anuncios diferentes do Instagram, nada mais escrito, e a
  caixa ofereceu o modelo de UM deles. *"Rajada de entrada em anuncio, mensagem do momento e
  concluir."* O modelo de um responde a um terco do que ela fez, escolhido pela ordem em que a
  rodada varre a conversa; mandar os tres seria rajada para o mesmo numero. **A guarda que define a
  regra e a ERONI (03/09)**, onde ele decidiu o contrario (mandar o modelo novo): la ela ESCREVEU
  alem de clicar. Por isso `rajadaDeAnuncios` exige que a rajada seja **so cliques** — quem escreveu
  esta falando, quem so clicou, nao. A caixa fica acima das DUAS portas do modelo (o grupo do
  anuncio reconhecido e `conteudo-pedido`) e acima do recibo da chegada.
- **A marca de "mensagem gerada pelo anuncio" cobria so o PRIMEIRO clique.** `prepararEntrantes`
  marcava a primeira mensagem de uma sessao com `utm`, e os cliques seguintes dependiam da lista de
  padroes que ele cadastrou — que nao fecha (a licao de 04/09: o anuncio muda de redacao e a lista
  nao). Dos tres textos da Irene, so um casava. Hoje entra tambem o formato do texto pre-preenchido
  (`^ola!? eu <algo>`), **valido apenas dentro de sessao que veio de anuncio**, sem "?" e com ate
  160 caracteres: e o que separa *"Ola! Eu apoio as Escolas Civico-Militares"* de *"Ola! Eu queria
  saber se voces tem..."*.
- **O rascunho e a PROXIMA mensagem dele, nao a de um terceiro que chegou agora.** Relato dele
  (05/09/2026): *"a IA pegou o contexto de umas 3 mensagens e ignorou a minha resposta e respondeu
  todas; eu queria que ela ficasse ciente do contexto e respondesse a ultima mensagem do contato e
  tambem identificar o que ja respondi; ela tem que ser uma sequencia das minhas mensagens, no
  momento esta agindo como uma terceira pessoa na conversa"*. Tres coisas mudaram no bloco do
  contato: **o que ja foi respondido tem marca propria** (`← ja respondida`) — ate entao a
  distincao era a AUSENCIA de `← SEM RESPOSTA`, e **ausencia nao e sinal**: o modelo via uma pilha
  de falas dela com uma nossa no meio e tratava tudo como pendente; **a resposta tem EIXO** (o que
  ela quer agora, com as outras pendentes reconhecidas numa frase, nunca respondidas uma a uma); e
  **a VOZ** e dita explicitamente — havendo fala nossa, "voce e a MESMA pessoa que escreveu as
  falas NOS". **Isto NAO desfaz o conserto da Janete** (04/09): ignorar continua proibido, e a
  rajada inteira continua marcada; o que mudou e a forma.
- **O eixo nao pode ser "a ultima" ao pe da letra.** A primeira versao dizia isso e cai no caso
  comum de a ultima ser *"obrigada"* — o eixo viraria o agradecimento e a pergunta ficaria sem
  resposta. Peguei lendo o prompt gerado, nao por teste. Hoje o texto diz **"a mais recente que
  pede ou pergunta alguma coisa"**, com a cortesia respondida em duas palavras.
- **`revisarRascunho` avisa quando o rascunho se APRESENTA havendo conversa** (`jaFalamos`, que
  `ia-cliente` calcula das proprias mensagens). So aviso, nunca conserto: consertar exigiria
  reescrever a frase, e a disciplina daquela funcao e corrigir apenas o mecanico (a saudacao
  errada, o traco eme).

- **A QUERY STRING do link tem "?", e por isso todo video repassado virava PERGUNTA.** Relato dele
  (05/09/2026): *"varios casos da pessoa mandando link e reconhece como conversa e passa pra mim"*.
  O teste de pergunta e `texto.includes('?')`, e `?igsh=`, `?utm_source=` e `?v=` sao parte do
  endereco — medido, um link do Instagram sozinho volta como *"fez uma pergunta que nenhuma
  resposta pronta responde"*, e `perguntaPendente` volta `true`, o que ainda impede concluir.
  Somava-se a conta de tamanho: tres links com legenda curta dao 224 caracteres e viravam
  *"escreveu 3 mensagens proprias"*. **`semLinks` tira o link antes das duas contas** — mesmo
  criterio que ja tira o texto gerado pelo anuncio: o que ela nao escreveu nao conta como escrita
  dela. Regra geral: **antes de medir texto de gente, tire o que e endereco de maquina.**
- **O rascunho da IA nao pedia o cadastro, e `revisarRascunho` estava MORTA neste caminho.** Print
  dele (05/09/2026): *"faltou detalhes, nao pediu dados"*. Duas coisas: o prompt tinha o bloco que
  diz o que NÃO pedir (o caso da Catarina) e nada dizia o que pedir — hoje manda fechar com
  `ia.PEDIDO_DE_DADOS_NO_RASCUNHO`, **literal**, porque a linha `Nome , Cidade` e o INVARIANTE que
  `ehPedidoDeDados` reconhece (pedido com as palavras da IA nao e visto pela rodada, que pede de
  novo), com PISO no painel se ela nao copiar; e `revisarRascunho` era chamada com o **objeto**
  (`String({...})` da `[object Object]`) e **depois** de o texto ir para o campo, entao nenhum aviso
  jamais apareceu e a troca da saudacao errada nunca chegou ao eleitor. **Funcao pura testada nao
  garante nada se quem chama passar o argumento errado** — mesma familia do
  `conversaPedeRespostaPessoal` que passava so o tipo.

- **Preposicao colada no artigo apaga as formas mais naturais — e o defeito parece "a regra nao
  existe".** Print dele (05/09/2026): *"Vc esta chamando gente pra trabalhar na campanha tou
  precisando"*, e nenhum detector viu nada. A lista dizia `(no|na) + (o mandato|a campanha)`, e
  **"no o mandato" nao existe**: *"trabalhar NA campanha"*, *"NO mandato"* e *"NO gabinete"* nunca
  casaram, embora *"trabalhar para a campanha"* casasse desde 02/09. Em lista de formas, **a
  preposicao e o artigo sao pecas separadas**. A metade cara da regra continua sendo o falso
  positivo: *"quero trabalhar na campanha"* e o que um VOLUNTARIO escreve, e o texto que nega abre
  com *"procurar trabalho cansa"* — por isso as guardas literais (*"sou voluntaria"*, *"de graca"*,
  *"sem ganhar nada"*), com *"e remunerado ou voluntario?"* continuando do lado do pedido.

- **Caixa que ENVIA um texto com pedido de dados precisa da guarda do pedido de dados.** Print dele
  (05/09/2026): contato com etiqueta de cidade (Erechim) e de conteudo recebeu as boas-vindas com o
  *"nos informe Nome , Cidade"* dentro. *"ja tem os dados e pediu novamente; a mensagem padrao
  provavelmente so tem pedindo dados"*. Duas causas somadas, e as duas ja estao registradas aqui em
  outras palavras: a caixa `chegada-boas-vindas` nasceu (04/09) com duas condicoes e **nenhuma
  guarda sobre ja termos o cadastro**, enquanto `nunca-pediram-dados`, tres linhas abaixo, tem tres;
  e o TEXTO funde apresentacao com formulario, entao nao havia como dar as boas-vindas sem pedir o
  cadastro — o mesmo defeito das duas respostas de evento (02/09). Hoje existe
  `boas-vindas-tem-dados`, a metade sem o pedido, e quem escolhe o texto e o painel pela conta
  **exportada** `sugestao.pedirDadosNaoCabe` (`jaDeuNomeECidade || jaPediramDados ||
  temEtiquetaDeCidade`), a MESMA que guarda o formulario. **Troca de TEXTO e nao de caixa**, como a
  tecla 4 no evento e a tecla 5 no pedido junto do momento: duas caixas para a mesma situacao
  divergem na primeira semana.

- **O MATERIAL pedido nao vence com o dia, e a excecao vale nas DUAS caixas que o enterravam.**
  Regra dele (05/09/2026), com a print do anuncio CONVERSE CONOSCO: *"o modelo de material e uma
  excecao, ele sempre tem que ser mandado quando requisitado; nesse caso mandou mensagem do momento
  e concluiu"*. Ela escreveu *"Ola! Eu quero receber o Material da Direita"* as 13:23 e a rodada so
  a alcancou no dia seguinte. Medido: `contexto-de-outro-dia` fica **acima da entrega do modelo nos
  tres ramos**, entao o pedido virava "o contexto passou". A segunda caixa saiu da varredura e nao
  do relato: `respondeu-os-dados` agradece e conclui *"sem mandar modelo, porque o modelo ja foi o
  recibo da chegada"* — argumento que deixa de valer quando o recibo nao foi, e era a UNICA que
  ainda enterrava o pedido (4.201 de 10.000; depois, 0). **A guarda contra a repeticao e a ENTREGA,
  nunca a janela de tempo:** `cortesia.pedeMaterial` le a conversa INTEIRA (ao contrario do
  `informouEndereco`) e o painel soma `!modeloJaNaConversa && !enviadoHoje` — sem essa metade, o
  texto do anuncio, que fica na conversa para sempre, viraria maquina de repetir. **A mensagem
  gerada pelo anuncio CONTA aqui**, e e o oposto do `soExpressaApoio`: la o texto do anuncio nao
  pode virar fala dela; aqui **o clique E o pedido**. O detector exige **verbo E objeto**, com o
  objeto numa lista curta de permissao: *"quero receber"* sozinho pega *"quero receber a visita de
  voces"*, e *"material"* sozinho pega *"obrigada pelo material"*.

- **UMA caixa por desfecho: situacoes que levam a mesma mensagem sao JUNTADAS (`tambemQuando`).**
  Pedido dele (04/09/2026), com a print de duas caixas identicas *"Conclui sem enviar nada (tecla
  3)"*: *"junte todas as situacoes que sao usadas na mesma tecla"*. `tambemQuando` e a lista de
  regras a mais que liberam a caixa, e elas valem por **OU** — o contrario de `maisCondicoes`, que e
  **E**. Juntas: (esta OU aquela) E as condicoes extras E nenhuma excecao. O padrao foi de 70 para
  60 caixas.
  **So se junta o que esta COLADO na ordem de decisao.** `etiqueta-so-conclui` e proteção e vem no
  topo; `ultima-e-despedida` tem o mesmo desfecho e vive la embaixo, onde precisa perder para a
  pergunta e para o pedido de dinheiro — juntar as duas moveria uma delas. A prova de que um merge
  e seguro e a varredura: **0 decisoes diferentes em 10.000 contextos sorteados**.
- **Regra dentro de `tambemQuando` continua "no quadro" — e esquecer isso quebrou 32% das
  decisoes.** `decidir` so aplica a PROTECAO do codigo para regra que o quadro NAO tem, e a conta
  lia apenas `no.regra`. Ao juntar `informou-endereco` dentro da caixa de `confirmou-presenca`, ela
  sumiu da conta, a protecao passou a disparar ANTES da arvore e venceu ate a recusa: `s` virando 2
  ou 3 em um terco dos contextos. Peguei na varredura, nao por teste — **toda mudanca estrutural no
  quadro se prova com a varredura antes/depois**.

- **O quadro se le pelo que NOS mandamos, nao pelo texto de quem chega.** Relato dele (04/09/2026),
  com a print de um cartao: *"no momento o fluxo se baseia no texto de quem vem, eu quero me basear
  no que vamos falar e nas nossas respostas rapidas — na print a ordem esta trocada"*. Estava: a
  linha grande do cartao era a descricao do CONTATO ("so expressou apoio") e o que sai para o
  eleitor ficava na ultima linha, pequeno, atras de uma seta. Hoje o cartao abre com o desfecho, a
  condicao vem como `quando:` e o nome da caixa desceu para o rodape — ele continua existindo
  porque e a etiqueta com que nos dois apontamos para a mesma caixa. **No editor a ordem inverteu
  junto**: primeiro "Vamos mandar…", depois "So quando o contato…". E a TECLA saiu da frente
  (`Agradece o apoio, e conclui (tecla I)`): ela e detalhe do dedo dele na caixa da rodada, nao o
  assunto do quadro.

- **O quadro decide por CONDICOES E EXCECOES; a ordem virou desempate.** Pedido dele (04/09/2026):
  *"o fluxo trabalha com prioridade quando devia estar trabalhando com condicoes e excecoes; se
  todas condicoes sao aceitas, enviar mensagem de acordo"*. Ele estava apontando um numero, e o
  numero era feio: medido em 3.000 contextos sorteados, **10,5 regras distintas casavam ao mesmo
  tempo** e em **85% deles mais de uma MANDARIA mensagem** — quem escolhia era a ALTURA da caixa.
  Com uma condicao so por caixa, a condicao significa "eu poderia atender este contato"; com todas,
  ela passa a significar "eu sou a resposta certa para ele". Hoje a caixa tem `condicao` +
  `maisCondicoes[]` (todas verdadeiras, E) e `excecao` + `maisExcecoes[]` (nenhuma verdadeira).
  **Numa caixa de REGRA a condicao extra ESTREITA** — a `quando` do codigo continua mandando, e o
  que ele acrescenta e somado com E: nenhuma mensagem passa a sair por causa disso, que e a mesma
  disciplina da excecao.
- **O EMPATE e medido no contato real, nunca no papel.** Quando duas caixas casam juntas e as duas
  enviam, a de cima ganha (escolha dele) e a rodada ACUSA no Andamento, com o nome de quem perdeu.
  Uma varredura estatica do quadro ("estas duas podem casar juntas?") acusaria quase todos os pares
  — e alarme que toca sempre se aprende a ignorar. `decidir` devolve `empate: [rotulos]`, e so conta
  quem ENVIA: duas caixas que concluem em silencio nao custam nada.

- **Regra que ELE dita nao pode virar DEFAULT de campo que ele ja preencheu — ela nunca chega.**
  Relato dele (04/09/2026): *"pra onde esta indo parar as regras que eu falo?"*, com a print de uma
  contato que chegou pelo anuncio do Instagram pedindo material, tinha cidade e etiqueta de
  conteudo, e foi **concluida sem receber nada**. A etiqueta dela era `CONTATO-ASSESSOR`.
  A regra e de 03/09 (*"com excecao do contato assessor"*) e eu a implementei mudando o VALOR PADRAO
  do campo para `assessor, -contato-assessor`. So que `store.get` mescla o default apenas nas chaves
  que FALTAM: quem ja tinha `assessor` salvo — ele — continuou com `assessor`, e a excecao nunca
  chegou. Medido: com a config antiga, `CONTATO-ASSESSOR` casa com `assessor` e cai em
  "so conclui"; com o piso do codigo, nao casa, e ela recebe o modelo do conteudo que pediu.
  **Onde a regra dele vira comportamento: no codigo (piso), nao no default.** E o mesmo conserto do
  `tags.ORIGEM_SEMPRE` — a guarda que depende de o campo estar escrito nao e guarda. Hoje
  `NUNCA_SO_CONCLUI` acrescenta `-contato-assessor` sempre, e o assessor de verdade continua sendo
  pego.

- **A mensagem GERADA pelo anuncio e identificada por DADO, e a lista de padroes virou reforco.**
  Print dele (04/09/2026): a contato chegou pelo anuncio do Facebook, escreveu so a mensagem
  pre-preenchida e recebeu o **agradecimento pelo apoio** — *"mandou mensagem agradecendo apoio
  sendo que e a primeira vez que aparece o contato"*. Medido: o padrao cadastrado e
  `^ol[aá]!? eu apoio` e a redacao nova diz *"Ola! Eu **estou do lado da seguranca e** apoio o
  Capitao Martim"*. Nao casou — entao o texto DO ANUNCIO contou como fala dela e `soExpressaApoio`
  deu verdadeiro. **O anuncio mudou de redacao e a lista nao**, que e a mesma armadilha das formas
  de perguntar. Hoje o painel marca `geradaPeloAnuncio` na **primeira mensagem de uma sessao com
  `utm`** — `getConversation` e por SESSAO e o `utm` tambem, entao a primeira mensagem de uma sessao
  dessas e, por construcao, o clique que a abriu. A marca fica em `prepararEntrantes`, junto da de
  `sistema`: **um lugar so, antes de qualquer regra ver**. A lista continua valendo para o segundo
  clique, num anuncio que nao abriu sessao nova.

- **O quadro tem DOIS ramos, e a divisao nao e enfeite — ela guarda decisoes que nao estao escritas
  em regra nenhuma.** Em 04/09/2026 eu medi que os ramos eram quase copias (21 das 24 regras
  duplicadas, 36 caixas em 69) e que junta-los mudava 0,34% das decisoes; recomendei a lista unica,
  ele aprovou, testou **e cortou no mesmo dia**: *"nao estou gostando desse fluxo, parece ter criado
  mais problemas, antes estava separado por categoria... agora ficou uma salada"*. Revertido.
  **A medicao respondia a pergunta errada.** "Quanto muda o desfecho" nao mede o que o ramo faz por
  ele: a divisao e como ele LE o quadro e decide a ordem, olhando. E o custo apareceu em producao no
  mesmo dia — com a lista unica, `nunca-pediram-dados` passou a pedir nome e cidade para quem **nunca
  veio de anuncio**, porque essa condicao vivia na POSICAO (a caixa so existia dentro do grupo do
  anuncio reconhecido). Print dele: uma conversa que so tinha um convite de grupo aceito recebeu
  *"ATENCAO! me diga seu Nome, Cidade"* e foi concluida.
  **A licao que fica:** quando uma regra so vale num ramo, mova essa condicao para o `quando` da
  regra — **uma de cada vez, quando o caso aparecer** —, nunca reestruture o quadro para economizar
  caixas. E duplicacao continua sendo o defeito registrado quatro vezes aqui: as duas coisas sao
  verdade ao mesmo tempo, e a que decide e ele.

- **A CHEGADA e um ramo de PRIORIDADE, entao tudo o que falta nela vira "o modelo decidiu".** Relato
  dele (04/09/2026): *"o fluxo de chegada parece ter sido deixado pra tras, confira; muitas regras
  se aplicam la tambem"*. O ramo geral ("pessoa retornando") **nao tem condicao** — e a rede que
  pega o que a chegada nao resolve —, entao caixa faltando na chegada nao vira buraco: vira
  **inversao de ordem**. A chegada ia do bloco de perguntas direto ao MODELO, e as caixas que a
  volta tem no meio nao existiam ali. Medido com um modelo disponivel: denuncia respondida a nossa
  pergunta, pedido de emprego, pedido de ligacao, "respondeu nome e cidade" e despedida recebiam
  todos a **tecla 1**, contra 6 / pedido-emprego / pedido-ligacao / i / 3 na volta. A pior era a
  denuncia — a regra `respondeu-nossa-pergunta` existe desde 01/09 exatamente para isso e protegia
  so metade da base. **Ao criar caixa que impede envio, ponha-a nos DOIS ramos** — e o teste que
  segura isso compara os dois no mesmo contexto, em vez de procurar a caixa.
- **A diferenca que FICA entre os dois ramos e o RECIBO, e so ela** (decisao dele, 02/09): na
  chegada o modelo do anuncio vem acima das pendencias neutras (figura, cumprimento, despedida),
  porque o recibo e o que ela clicou para receber e o atraso custa um dia. Elas voltaram para a
  chegada em 04/09 **abaixo do recibo** — o que estava errado nao era a ordem, era elas nao
  existirem ali: quem chegava e so se despedia caia na caixa do TEMPO e recebia a mensagem do
  momento por cima de um "amem".

- **Quem faz a rodada pular o caso de MATERIAL e a etiqueta, nao o detector.** Regra dele
  (04/09/2026): *"para pular o contato sempre sera depois que eu pedir o endereco e etiqueta for
  colocada"*. O detector (`informouEndereco`) le a RAJADA e serve para uma coisa so: reconhecer a
  resposta dela e APLICAR a marca. Ele some assim que respondemos — e e por isso que ele nao pode
  ser o gatilho: quem carrega o caso adiante e a etiqueta no CRM, ate ele tira-la, que e o gesto de
  "esta conversa foi transferida". Mesma licao da susana (03/09): **detector e palpite; a marca e
  decisao, e decisao nao se redescobre.** Na primeira versao (v2.24.0) o detector decidia sozinho,
  lendo a conversa INTEIRA — uma rua citada num desabafo de julho deixaria o contato pulado para
  sempre.
- **O "pular" GRAVA uma coisa desde 04/09/2026: a etiqueta de quem mandou o ENDERECO.** A decisao
  dele de 31/08 (*"ao pular tem gravado dados no CRM, o que faz eu perder tempo"*) continua valendo
  para todo o resto — nenhum campo, nenhuma data de conclusao, nenhuma pergunta de cidade. A
  excecao existe porque o pulo nao deixa rastro nenhum, e o caso do endereco E uma LISTA: ele
  transfere essas conversas ao responsavel pelo envio no fim do dia, e sem marca teria que
  reencontra-las na fila inteira. Uma escrita de etiqueta, so quando o endereco foi reconhecido, e
  **tambem quando e ele que aperta o 2** — marcar so no automatico faria a marca depender de quem
  apertou.
- **Digito solto nao e numero de casa, e e por isso que reclamacao de rua nao vira endereco.**
  `informouEndereco` conta MARCAS (via, bairro, a palavra "endereco", complemento, numero) e exige
  duas, sendo uma delas um lugar; o CEP basta sozinho. O numero so conta **depois de virgula**,
  **fechando a mensagem** ou com o `nº` explicito — aceita-lo em qualquer posicao faz *"a rua aqui
  esta esburacada ha 20 anos"* virar endereco, e reclamacao de rua e comum nesta base. Metade das
  asercoes do teste sao falso positivo, que e onde mora o risco: a etiqueta fica permanente no CRM.
  **Cruzar com "pediu material" foi cortado por ele e estava certo**: nesta base *"quero receber o
  material"* e conteudo DIGITAL, a frase mais comum que chega, e vem do texto do proprio anuncio —
  a metade "material" nao separa nada, e so o endereco separa.

- **Esconder um CARTAO esconde tudo o que estiver dentro dele — inclusive o que nao tem nada a ver.**
  Relato dele (04/09/2026): *"nao achei esse campo na extensao na aba automatizado"*. Os campos
  "Etiqueta de SEM INTERESSE" e "Etiqueta de quem PEDIU DINHEIRO OU EMPREGO" viviam dentro de
  `renderCartaoReabrir`, **escondido desde 15/08** por causa da rodada de "sem retorno" — e foram
  junto sem ninguem notar. Duas regras que gravam no CRM ficaram **impossiveis de configurar**, e
  uma delas passou dois dias na lista de pendencias como coisa para ele preencher **num campo que
  nao existia na tela**. Hoje ha `renderCartaoEtiquetas`, visivel. **Ao esconder um cartao, confira
  o que mais esta dentro** — e prefira esconder a LINHA que o coloca na tela apenas quando tudo ali
  pertence ao que se esta escondendo.


## Armadilhas do próprio painel

- **`store.get` só mescla defaults em ALGUMAS chaves.** Chave nova dentro de um objeto já salvo
  (`settings`, `auto`, `ia`, …) chega como `undefined` em quem já usava, e o default nunca o
  alcança. Custou um teto de gasto que nasceria desligado justamente em quem mais usa. Campo novo
  em objeto existente? Confira se a chave está na lista de mescla do `get`.
- **A caixa da rodada vive FORA do `.wf-root`, e não pode voltar para dentro.** Esconder o painel
  é `transform: translateX(100%)` (classe `wf-collapsed`), e **transform arrasta os filhos**: a
  caixa deslizava para fora da tela junto, e ele precisa dela justamente com o painel escondido
  (*"preciso de espaço na area de trabalho"*, 31/08). Como irmã, ela precisa de três coisas por
  conta própria, e as três estão no CSS: o **z-index 998** (herdava do painel), as **variáveis de
  cor** (seletor compartilhado — e SÓ as variáveis: o `background` do `.wf-root` cobriria a tela
  de branco e mataria a transparência) e o **tema escuro** via `~ .wf-pergunta-fundo`, porque
  `.wf-root.wf-dark` não alcança irmão. Medido no navegador: painel `805..1185` → `1185..1565`,
  caixa `346..840` nos dois estados.
- **z-index do painel é 998, e é de propósito.** Os overlays do Material (menu, diálogo,
  select, tooltip) vivem em 1000 e precisam abrir POR CIMA. Conteúdo da página não passa de 50.
  Subir o painel para o máximo faz ele engolir o diálogo de Etiquetas e o menu do Concluir.
- **`disabled` calculado a partir de `state.busy` na renderização.** Se algo renderizar DENTRO
  de uma ação, os botões nascem mortos. Por isso `withBusy` redesenha no `finally` — não tire.
- **Overlay que a extensão abriu, a extensão fecha.** Diálogo do Material esquecido aberto é
  modal e trava o painel inteiro (ver `hsm.abrirDialogo`).
- **Concluir são DOIS cliques.** O botão do rodapé abre um menu ("Classificar e concluir" /
  "Concluir"); quem fecha o atendimento é o item (`[data-cy="menu-button-session-finish"]`). Com
  um clique só, o atendimento fica em andamento e nada acusa — `hasOpenDialog()` não vê menu.
  O sumiço do "Concluir" não serve como confirmação, porque o item do menu tem o mesmo texto.
- **"Concluído" tem DOIS retratos de tela, e um deles não tem "Reiniciar".** Medido ao vivo: o
  atendimento fechado mostra o rótulo **"Concluído"** no cabeçalho e o rodapé vira "Nenhuma
  classificação definida" — nenhum botão Reiniciar em lugar nenhum. Procurar só por "Reiniciar"
  deixou a rodada esperando 30 min por um atendimento já concluído. Mexeu em sinal de tela?
  Rode `node tools/checar-dom.mjs`, que confere os dois retratos (precisa de Playwright; fora
  das seis suítes de propósito).
- **A pergunta da rodada não pode escurecer nem bloquear a conversa.** A decisão que ela pede
  depende de ler o que a pessoa escreveu: a camada é `pointer-events: none` e sem fundo, a caixa
  é arrastável pelo título e a posição fica no `settings`. Mexeu no CSS dela? Rode
  `node tools/checar-pergunta.mjs`. Como a página ficou clicável, atalho de tecla **ignora
  evento vindo de campo de texto** — senão o "2" digitado na conversa conclui o atendimento.
  O que ele precisar no meio da rodada tem que estar DENTRO da caixa: as respostas prontas são
  `montarRespostasRapidas`, e enviar dali não fecha a pergunta.
- **Anti-duplicata por MODELO não impede mandar duas vezes — e "contato já tratado" também não.**
  O contato recebeu a resposta pronta numa rodada e o modelo aprovado na seguinte, 32 min depois:
  chaves diferentes, e o `Set` de contatos tratados nasce vazio a cada rodada. Some com a fila que
  devolve o concluído ao TOPO (a rodada seguinte começa por ele) e vira máquina de repetir. São
  **duas travas, não uma**: `contatosTratados` dentro da rodada e `hsm.decidirReenvio` entre
  rodadas — este pergunta à **conversa**, que inclui o que ele mandou à mão. Já foi apagado uma
  vez trocado pelo `Set`; não troque de novo.
- **`load()` NÃO roda dentro de `withBusy`** — `state.busy` é falso enquanto ele carrega, então
  ele e `reexaminarMensagens` podem estar no ar juntos. Pergunta aberta dentro de um deles ganha
  uma gêmea quando chega mensagem nova; responder uma deixa a outra na tela. Toda pergunta que
  nasce de gravação precisa de guarda de instância única (ver `perguntaDeCidade`).
- **Canal (número) fora do ar: a plataforma ACEITA o envio e a mensagem não chega.** A tarja do
  topo diz *"O WhatsApp (51) 9…-… foi desconectado da Z-API"*. O balão aparece na conversa e
  fica lá sem entregar — a rodada contaria como enviado, marcaria no anti-duplicata e
  concluiria. Falha silenciosa com a tela dizendo que deu certo. A conta tem VÁRIAS instâncias e
  cai uma por vez, então a trava compara o número da tarja com o do cabeçalho da conversa
  (`dom.canalDesconectado` + `dom.numeroDaConversa`). "Desconectado" sozinho não basta: contato
  escreve isso na conversa — exija também Z-API/reconexão.
- **Pergunta não-bloqueante sobrevive à troca de contato — e vira gravação na pessoa errada.**
  Medido ao vivo: painel dizendo "Abra um atendimento" com uma caixa perguntando por "Estrela
  Velha" sobre a conversa de outro. A caixa é filha do `root`, e `renderAll` só troca `header` e
  `body`; ela fica. Pior que a tela suja: `state.draft` e `state.contact` já são do contato novo,
  então responder gravava a cidade de um em outro. Duas travas: `load()` cancela a caixa aberta
  (`cancelarPerguntaDeCidade`), e `saveClassification` guarda o id do contato ANTES da pergunta e
  desiste da gravação inteira se ele mudou.
- **Regra da rodada que depende de estado invisível parece defeito.** A conclusão automática
  ("última mensagem minha") ganhou uma exceção para quem não tinha etiqueta de conteúdo, e o
  relato foi "alguns concluem e outros não". Funcionava como projetado — e mesmo assim estava
  errado. Se a rodada tratar dois contatos de forma diferente, o motivo tem que estar na tela.
- **Pergunta diferente pede parser diferente — `respostaAfirmativa` NÃO serve para presença.** Ele
  foi escrito para *"quer receber conteúdo?"*, onde "gostaria" é um sim, e contra as respostas do
  convite de evento erra os DOIS lados: *"Gostaria de estar mas sem condições"* virava sim, *"vou
  sim"* virava não. Presença tem `cortesia.confirmaPresenca`, com duas diferenças de desenho: a
  **negativa vence** e olha a **mensagem inteira** (quem não pode ir começa dizendo que queria — a
  intenção está na ressalva, não na abertura, e por isso não há "primeiras quatro palavras" aqui).
  E **"sim" solto não conta**: pode ser resposta a outra pergunta.
- **Mudou o texto de uma pergunta? O parser da resposta muda junto.** A pergunta de interesse
  passou a pedir "Sim / Nome / Cidade" e, de repente, `respostaAfirmativa` (limite de palavras +
  negação em qualquer lugar) recusava a resposta certa, e o "Sim" virava o nome do eleitor. Toda
  pergunta nova: confira `tags.respostaAfirmativa` e `NAO_E_NOME` em `extract.js`.
- **Bloqueio de variável nunca pode virar saída de rodada.** Faltou `{{primeiro_nome}}`? Isso
  tira a OPÇÃO da pergunta, com o motivo na tela — nunca o contato da fila. Já entrou por duas
  portas diferentes (sem conteúdo, sem nome) e as duas viraram pulo silencioso.
- **Na ponte de mensagens, argumento omitido chega como `null`.** O padrão `= {}` só cobre
  `undefined`: desestruturar dá TypeError e `slice(0, null)` devolve vazio. Use `opts || {}`.
  Pelo mesmo motivo, método de `page.js` que alguém chama com `.catch()` tem que ser `async`.
- **Diálogo de CONFIRMAÇÃO a rodada resolve; de FORMULÁRIO ela devolve.** *"Uma mensagem está
  aguardando resposta do contato… Tem certeza de que deseja concluir?"* (print de 01/09) parava a
  rodada em todo contato — *"é para concluir e continuar mas está parando tudo"*. Confirmar não
  decide nada novo: a conclusão foi pedida dois cliques antes. Quem separa os dois é
  `dom.getConfirmacaoDeConclusao`, e a trava é o **teste de campo vindo primeiro**: qualquer
  `input`/`select`/`mat-select`/`textarea`/`mat-radio-group` dentro do diálogo devolve `null`,
  mesmo havendo um botão "Concluir" ao lado — errar para o lado de não clicar custa uma rodada
  parada, errar para o outro grava decisão que ninguém tomou. Exige também que o texto fale de
  concluir/encerrar, e limita a **duas** confirmações por conclusão. O texto do que foi aceito vai
  para o log da rodada, uma vez: este diálogo avisa que mensagens pendentes serão canceladas.
- **Diálogo do Material é MODAL e mata a rodada em silêncio.** Anexar figura no meio da
  resposta à mão deixa um diálogo por cima; o clique no próximo item da fila não chega ao item e
  a rodada terminava dizendo "a fila acabou". Antes de abrir o próximo contato, espere a tela
  ficar livre — **não feche**: o diálogo é dele, e fechar descarta o que ele estava mandando.
- **`confirm()` nativo não pode aparecer dentro da rodada.** Ele abre DEPOIS da decisão, fora do
  lugar onde ele está olhando, e trava o laço num diálogo do navegador. Aviso de duplicata vira
  linha da pergunta da rodada; quem chama passa `jaConfirmado: true`.
- **A pergunta que VOCÊ fez também é contexto.** Quando a nossa última mensagem foi o pedido de
  dados, o que vem depois é a resposta: `extract(..., { respostaAoPedido: true })` casa o
  município sem pista e sem limite de tamanho, e o que sobra vira o nome — é assim que
  "maria cachoeirinha" dá nome Maria e cidade Cachoeirinha, sem separador nenhum. **A trava:** se
  a sobra não for nome de gente, nada é aceito — senão o slogan do anúncio respondido ao
  formulário viraria cidade "Rio Grande" e nome "Vamos Juntos Mudar O".
- **A cidade só sai de CONTEXTO, nunca de menção solta** (decisão dele, 31/08). O gatilho foi
  *"Vamos juntos mudar o Rio Grande"* — o estado na forma curta, que a guarda `NOME_DO_ESTADO`
  não pegava porque ela só apaga "Rio Grande do Sul" por extenso. Hoje valem três caminhos, e só
  eles: resposta ao formulário, mensagem **curta** que é a própria cidade, e menção precedida de
  pista (`PISTAS_DE_CIDADE`: "moro em", "sou de", "aqui em", "minha cidade é", "em"…). Nome de
  município no meio de uma frase prova que o texto contém um nome de município, não que a pessoa
  more lá.
- **O nome do ESTADO contém o nome de um município.** "Rio Grande do Sul" tem "Rio Grande"
  dentro, e o casamento procura o município em qualquer lugar do texto — quem escrevia "sou do
  Rio Grande do Sul" era gravado em Rio Grande, com o COREDE errado junto. A frase inteira é
  apagada antes de casar (`NOME_DO_ESTADO` em `cities.js`).
- **O vocabulário da campanha também casa com município.** **Capitão** é cidade do RS e é a
  patente do candidato: toda mensagem de aceite do anúncio virava cidade Capitão, com confiança
  `exata` — a que grava sem clique. Duas travas em `cities.js`: a expressão
  ("capitao martim") é apagada antes de casar, e o município está em `cidadesIgnoradas`.
  Nome de gente novo na campanha, confira se colide com a lista do IBGE.
- **Etiqueta que o contato JÁ tem é invisível para `suggest()`.** Ele só devolve o que as regras
  acham nas mensagens; etiqueta aplicada à mão (ou por nós numa passada anterior, quando a
  campanha do anúncio ainda casava) não aparecia, e o fecho com conteúdo travava dizendo "nenhum
  conteúdo reconhecido". Ver `tags.conteudosJaAplicados`.
- **Etiqueta que o contato já tem também tem `marcada: false`** — é o que impede reaplicar o que
  já está lá. Quem procurar a etiqueta certa só entre as que vão ser gravadas não a acha
  justamente quando ela já está certa. Foi o que quase furou a limpeza de COREDE duplicado
  (`etiquetasDeRegiaoASair`): procure em `tagSuggestions` inteira, decida com `marcada` depois.
- **COREDE errado sobra quando a cidade preenche BURACO, não quando substitui.** A limpeza olhava
  só `entrada.substituiu`; contato com campo Cidade vazio ganhava o COREDE novo e ficava com o
  velho junto (visto ao vivo: "Caçapava do Sul" com Campanha **e** Médio Alto Uruguai). Regra:
  COREDE que não é o da cidade sai — mas só se o certo ficar, senão o contato fica sem nenhum.
- **`chrome.windows` NAO existe em content script — como `chrome.power`.** O painel encaixado roda
  dentro da pagina do mobiliza, e `chrome.windows.create` ali e `undefined`. Eu escrevi a primeira
  versao do botao do fluxo com a chamada direta no painel e peguei antes de rodar; a lista de APIs
  que so o service worker alcanca ja tinha `power` e agora tem `windows`. Abertura de janela vira
  mensagem para o `background.js`, e a constante da mensagem fica em arquivo proprio
  (`lib/fluxo-msg.js`) porque os dois lados a importam.
- **Aba acordada e computador acordado são problemas DIFERENTES.** O áudio do `keepalive`
  impede o Chrome de congelar a aba; ele não impede o Windows de suspender por inatividade, e
  rodada longa não toca em teclado nem mouse. A segunda trava é `chrome.power` (`'display'`, no
  service worker — content script não alcança), pedida no começo da rodada e solta no `finally`.
- **Aba escondida é aba CONGELADA, não lenta.** Medido: `setInterval(120ms)` deu **zero**
  disparos em mais de um minuto. Congela junto o JavaScript da plataforma, então mover só as
  nossas esperas para fora da aba não resolveria — o Angular também para. O que descongela é
  áudio tocando (`keepalive.js`), e áudio exige gesto: ligar sempre a partir de um clique.
  **TODO laço longo precisa disso, não só as rodadas.** A aba Cidades nasceu sem keepalive e uma
  gravação de 2000 contatos parou no meio, em silêncio, quando ele tirou a aba da frente. Escreveu
  laço novo que percorre base? Ligue `keepalive` e, no `finally`, registre se `ativo()` ficou falso
  — é o dado que distingue "acabou" de "congelou".

- **Falha de ETIQUETA nunca bloqueia o envio da mensagem.** Em 20/08/2026 a etiqueta de cidade
  (nova em quase todo contato) não entrou no CRM, `confirmarNoCrm` acusou, `'etiquetas'` estava nos
  bloqueantes, `saveClassification` devolveu `false` e a rodada **parou de enviar modelo**.
  Prioridade invertida: etiqueta é organização interna, a mensagem é o que o contato recebe. Hoje
  `essenciais` tem só `Cidade` e a data de conclusão — campos do próprio contato. Problema de
  etiqueta vai para o status **e para o log da rodada** (o status é sobrescrito pela linha
  seguinte, e sem o log o conserto viraria falha silenciosa).

- **"Ela já respondeu" e "nós já sabemos" são sinais DIFERENTES, e confundi-los pede o que ela
  acabou de escrever.** Anotação do Plauto (03/09/2026): a última mensagem era *"Plauto Velho,
  cidade São Leopoldo"* e a caixa sugeria *"peça os dados esta vez"*. `respondeuOsDados` não
  alcança — ele exige que o NOSSO pedido tenha saído, e ela se adiantou. As outras guardas de
  `nunca-pediram-dados` olham o que foi GRAVADO (`temEtiquetaDeCidade`, `jaPediramDados`), e as
  duas são falsas no exato instante em que ela responde: a etiqueta ainda não existe no CRM.
  `jaDeuNomeECidade` é a metade que faltava — o parser leu nome **e** cidade reconhecida no que ELA
  escreveu, e por isso **roda na conversa inteira**: "ela já disse de onde é" não deixa de ser
  verdade com o tempo, ao contrário de "ela acabou de responder" (a armadilha de 02/09, que é sobre
  o OUTRO sinal). Ele só BLOQUEIA o pedido; nunca manda nada.
- **O modelo PADRÃO não sai para quem já tem etiqueta de cidade — e a decisão valia por metade.**
  Anotação da Maria Bernardete (03/09): cidade no CRM, anúncio não reconhecido, e a caixa oferecendo
  o modelo padrão. A decisão dele de 02/09 estava escrita só dentro de `anuncio-modelo-e-dados`
  (`!temEtiquetaDeCidade`); `conteudo-pedido` não exige nada, e é ele que manda o modelo sozinho.
  Hoje o padrão **não é sequer carregado** nesse caso. **Anúncio RECONHECIDO continua mandando o
  modelo dele mesmo com cidade** — ela clicou pedindo aquilo, e há teste travando ("com cidade: o
  modelo sai igual"). Fechar um caminho sem escrever a saída deixaria os dois casos mudos, então a
  chegada ganhou `so-expressa-apoio` **em ÚLTIMO lugar**: a mensagem do anúncio É apoio escrito, e
  `soExpressaApoio` só a descarta com o anúncio cadastrado — em cima, essa caixa agradeceria a
  chegada de todo anúncio novo e engoliria o recibo. Tem teste exigindo a posição.
- **A anotação da rodada guarda a VERSÃO que decidiu.** Num dia com vários consertos, data sozinha
  não distingue anotação pendente de anotação já atendida: de um lote de oito (03/09), **três já
  estavam consertadas** e eu medi caso a caso para descobrir que não havia nada a fazer. Antes de
  trabalhar num relatório de observações, compare a `v` de cada linha com o que já está no
  `registro.md`.

- **Quando o TEMPO decide o desfecho, o corte é o DIA LOCAL — não um número de horas.** Critério
  dele para o apoio (03/09/2026): *"se foi no dia anterior, é mensagem do momento; se foi recente,
  mensagem de apoio"*. `cortesia.deOutroDia` compara datas locais porque é o que ele LÊ: a
  plataforma separa a conversa por data, e 23h contra 1h da manhã são "ontem e hoje" para quem olha
  e duas horas para quem conta. **Pergunta pendente passa por cima do tempo, e passa por ORDEM** —
  as caixas de pergunta ficam acima do apoio nos dois ramos, com teste comparando as posições.
- **Campo novo lido por uma tecla-FUNÇÃO entra na matriz do teste.** Ela varia hoje
  `respondidoHoje` × `momentoJaEnviado` × `podeMandarMomento` × `apoioDeOutroDia`. Faltando um, a
  tecla que depende dele nunca aparece e o teste acusa o verbete de *"inventar um desfecho"* que
  existe de verdade — foi o que aconteceu ao acrescentar o tempo. E confira o `efeito` do verbete:
  duas saídas que ENVIAM não fazem `'depende'`, e `regrasComDesfechoIncoerente` pega isso.

- **São TRÊS as pendências que ficam acima do modelo na chegada — a terceira entrou em 03/09 e o
  caso era "crítico".** Print dele: a contato chegou pelo anúncio e escreveu **314 caracteres**
  pedindo *"uma cola com letras maiores, do primeiro ao último"* porque tem *"muita gente idosa
  pedindo"*, e se oferecia para imprimir. A rodada mandou o cartão da campanha e **concluiu** —
  *"ignorou o pedido e concluiu"*. **Nada pegava, e não havia como pegar por lista:** ela DISSE o
  que queria (`pediu-algo-sem-dizer-o-que` não casa) e não era pergunta de razão nem de posição
  (`pergunta-aberta` não casa). O único sinal de "isto é conversa" é o TAMANHO, e ele estava
  calculado e correto — `ultima-pede-resposta-pessoal` simplesmente **não existia no ramo da
  chegada**, por ser uma das pendências neutras que ele mandou resolver na volta (02/09). A
  distinção que faltava: pendência neutra (figura, cumprimento, despedida) custa **um dia de
  atraso** no recibo; aqui mandar a nossa mensagem primeiro **É o dano**, e concluir apaga o
  pedido. **O custo aceito:** quem chega mandando áudio sem transcrição, arquivo ou texto longo
  não recebe o recibo nessa passada e vai para ele.

- **Regra que vive só num lado da bifurcação de cidade é regra pela metade — aconteceu de novo, com
  o APOIO.** Já estava registrado para `etiqueta-dispensa-da-fila`; `so-expressa-apoio` tinha o
  mesmo defeito e ninguém viu, porque o sintoma é invisível: quem voltava **com** etiqueta de cidade
  e só escrevia apoio não caía em lugar nenhum e descia até `ja-respondemos-antes`, a caixa mais
  genérica do ramo, que não olha o que a pessoa escreveu. Efeito prático: o critério de tempo que
  ele definiu em 03/09 (apoio de ontem → mensagem do momento) valia só para **metade da base**.
  Achado comparando o quadro dele com o padrão, não por relato. Hoje a caixa nasce dentro de
  `dosDoisLados`, que é o que garante os dois — e o teste **decide de verdade nos dois lados** em
  vez de só procurar a caixa, então ele cai também se alguém puser algo genérico por cima.

- **O que torna o pedido INDEFINIDO é o objeto dele — "preciso de" sozinho não é sinal de nada.**
  Print da Odete (03/09/2026): *"Preciso do nome de um deputado federal que seja de direita"*, e a
  rodada perguntou *"em que você precisa de ajuda?"*. Ele: *"interpretou 'preciso' fora de contexto,
  já estava explicado"* — e, na mensagem seguinte, ela já tinha resolvido sozinha. O padrão era
  `preciso de|da|do` e mais nada: a regra se chama *"pediu algo sem dizer o quê"* e **não olhava o
  quê**. Mesma família do *"só mandou bom dia"* que pegava um desabafo de 437 caracteres — nome de
  caixa prometendo uma condição que a condição não verifica. Hoje o objeto tem que estar numa lista
  curta de PERMISSÃO (ajuda, força, apoio, socorro, uma mão) ou ser a própria pessoa ("preciso do
  senhor"). **Reconhecer o objeto CONCRETO seria o caminho errado**: são infinitos, e errar para
  esse lado devolve o defeito.

- **"Pedido" é INTENÇÃO, não forma de frase — e por isso o desfecho virou "fica com ele ou com a
  IA".** Decisão dele em 03/09/2026, logo depois de eu ajustar o padrão da Odete: *"já que pedido é
  algo difícil de ser identificado, será agora pra mim ou IA responder"*. Ele está certo sobre a
  natureza do sinal: ajustar a expressão conserta o caso e não conserta a classe, e toda tentativa
  de cercá-la por texto erra para um dos dois lados — pergunta em cima de quem já explicou (Odete),
  ou material de campanha em cima de quem pede socorro (Mari). **O que a regra protege não mudou**:
  `pediu-algo-sem-dizer-o-que` continua no alto, continua vencendo a despedida e continua impedindo
  que as caixas de baixo enviem. O que mudou é só o desfecho — tecla **6** em vez da 9, e a pergunta
  *"em que posso ajudar"* segue a um clique. Saiu junto a guarda `podePerguntarAjuda`: ela existia
  porque a regra DISPARAVA aquele texto, e mantê-la faria o caso de maior risco do arquivo escapar
  para as caixas que enviam quando o template estivesse travado por variável. **Consequência: a
  rodada PARA nesses contatos** em vez de perguntar e seguir.

- **"Me diga seu Nome, Cidade" pressupõe uma conversa em andamento — e sem ela a mensagem fica
  deslocada.** Print do Tilin (03/09/2026): a conversa inteira eram dois avisos *"o tipo da mensagem
  enviada pelo contato não é suportado"* e um *"Número privado"*. Sem texto, sem nome, sem cidade e
  sem nem o telefone — e a rodada mandou o pedido de cadastro e concluiu. Ele: *"eu não tenho
  nenhuma informação nesse caso, então é para perguntar se a pessoa tem interesse em receber
  conteúdo"*. A pergunta de interesse resolve porque **cria o contexto que falta** (diz o que temos
  a oferecer) e **já pede nome e cidade na mesma mensagem**, então nada se perde. A regra é
  `nada-legivel-dela`, e o sinal exige que TODAS as mensagens dela sejam ruído da plataforma
  (`sistema: true`) — uma figura no meio é algo que ele pode olhar, e aí quem decide é
  `ultima-e-so-reacao`. Fica **abaixo do modelo** (quem tem modelo mapeado recebe o recibo, que
  responde melhor que uma pergunta) e **acima do pedido de dados**. Não confundir com
  `nunca-perguntaram-interesse`, que ele descartou do quadro em 01/09: aquela pergunta para todo
  mundo que nunca foi perguntado, que é quase a base inteira.

- **A IA lia `state.incoming`, que NÃO tem a transcrição do áudio — ela estava cega justamente onde
  existe para enxergar.** Print da Sueli (03/09/2026): 29 segundos de áudio, transcrição visível na
  tela da plataforma, e o rascunho saiu falando de outra coisa. *"A IA não pegou o texto
  transcrito"*. A causa é a assimetria registrada no `api.js` desde 31/08: `incoming` filtra
  `m.text`, e áudio **não tem** `text` — a transcrição mora em `details.transcription.text` e só
  chega em `entrantes`. A ressalva original (*"incoming continua como era: é a base do parser"*)
  vale para o PARSER, que não deve gravar cidade a partir de fala ouvida por máquina; para a IA é o
  contrário, porque áudio é a maior fatia do que a regex não cobre nesta base. Hoje os três
  caminhos da IA (avaliar, rascunhar, e o `gabinete` de cada um) usam `mensagensParaIA()`, que lê
  `entrantes` e marca `(áudio, transcrito automaticamente)`. **Regra geral: quem alimenta a IA usa
  `entrantes`, nunca `incoming`** — e a guarda "o contato não escreveu nada" também, senão o
  contato que só falou nunca chega a ser rascunhado.

- **"Como consigo adesivo, bandeira, camiseta?" é pergunta de LOGÍSTICA, e o modelo não a
  responde.** Anotação do Valdomiro (03/09/2026): ele perguntou isso e recebeu o cartão da campanha,
  com a conversa concluída em seguida — *"não respondeu a pergunta e concluiu"*. A exclusão
  registrada aqui (*"tem algum material/conteúdo fica de fora de propósito"*) continua certa e é
  sobre outra coisa: quem pede material tem resposta pronta. Quem pergunta **como pega** material
  físico precisa de quem sabe onde tem, quem entrega e quando — mandar o modelo é responder "pega o
  material" a quem perguntou como. Hoje `(como|onde) (consigo|conseguir|faço|faz|fazer)` entra em
  `PERGUNTAS_QUE_PEDEM_VOCE`, com a guarda de posição de sempre. **Duas travas mantêm a exclusão
  antiga:** `PEDIDO_DE_MATERIAL` desarma a mensagem inteira (*"como consigo receber o conteúdo?"*
  segue sendo caso de modelo), e **"posso" ficou de fora** — *"como posso ajudar?"* é oferta, e
  oferta é o público principal desta base.

- **Caixa de tecla FIXA não tem guarda — e a segunda vez não precisa de repetição automática para
  acontecer.** Print da Carmem Souza (03/09/2026): a caixa da rodada mostrava em amarelo *"Hoje este
  contato já recebeu: Mensagem do momento às 09:36"* e recomendava, em destaque, a tecla 5. Ele:
  *"já identificou que mandou e sugeriu mandar novamente"*. A caixa *"só cumprimentou"* tem
  `acao.tecla: '5'` fixa e nenhuma guarda; `ultima-e-so-reacao`, logo abaixo, nunca teve o problema
  porque a tecla dela é FUNÇÃO e olha `respondidoHoje`. **`repeteSozinha` não acusava, e estava
  certo:** `soCortesia` lê a rajada depois da nossa última mensagem, então o envio apaga o sinal.
  O que houve foi ela **escrever de novo no mesmo dia** — a rajada encheu com outro cumprimento e a
  caixa ofereceu a mesma mensagem outra vez. Hoje a caixa tem `excecao: momentoJaEnviado`, que é
  literalmente o que o aviso amarelo diz. **Lição para toda caixa de tecla fixa que ENVIA: a
  pergunta não é só "ela repete sozinha?", é "o que impede a segunda vez?"** — e o aviso amarelo do
  painel é a lista de guardas que faltam.

- **Detector que olha só a ÚLTIMA mensagem falha na rajada — e o teste que "prova" que ele funciona
  pode ser o que esconde isso.** Anotação da susana (03/09/2026), na segunda vez que ela apareceu:
  *"segunda vez que ela vem e eu já tinha especificado que era hostil, por que não gravou?"*. Ela
  xingou o aliado, escreveu mais duas mensagens, e a última era *"9"* — `semInteresse` lia só a
  última com texto e não via nada. **Eu tinha travado esse insulto com um teste de UMA mensagem, que
  é exatamente a forma que a função enxergava**: o teste passava enquanto a produção falhava. Hoje
  ela lê a rajada, mensagem a mensagem com todas as guardas, e o que substitui o "só a última vale"
  é a **retratação**: pedir material ou dizer que está junto DEPOIS cancela; um "9" não. A recusa é
  testada antes da retratação — *"não quero receber nada"* tem "receber" dentro e se cancelava
  sozinha (três asserções caíram de uma vez).
- **Etiqueta que a rodada APLICA também precisa ser LIDA na volta.** Mesma anotação: a etiqueta de
  sem interesse estava no contato, e nada a consultava — na visita seguinte o detector tinha que
  redescobrir a hostilidade a partir do que ela escrevesse naquele dia. **Detector é palpite; a
  etiqueta é decisão dele, e decisão dele não se redescobre.** Hoje `etiquetaQueSoConclui` soma
  `auto.etiquetaSemInteresse` à lista dele, com o mesmo desfecho (conclui, não manda nada, nunca).
  **Depende do campo estar preenchido na Config** — vazio, não faz nada.

- **"Responder a pergunta" e "mandar para ele" são coisas diferentes — e confundir as duas custa
  metade da automação.** Print do Paulo Quevedo (03/09/2026): imagem de bom dia, dois links e, por
  último, *"Colorado ou Gremista?"*. A rodada recomendou CONCLUIR. Ele: *"qual a regra que já
  tínhamos acertado? tem pergunta não conclui"*. A primeira tentativa foi alargar
  `conversaTemPerguntaAberta` para "qualquer ?" — e caíram cinco exclusões que ele já tinha decidido
  (*"pode me mandar o material?"*, *"Tudo bem?"*, *"Como posso ajudar na campanha?"*, *"tem algum
  material para eu compartilhar?"*, *"tem algum grupo?"*). **As cinco continuam sendo respondidas**:
  a exclusão diz QUEM responde (o modelo, a mensagem do momento), não SE responde. O que faltava era
  um sinal mais fraco — `terminouComPergunta` — que faz uma coisa só: **impedir a conclusão em
  silêncio**. Ele vale só na ÚLTIMA mensagem, exclui cortesia ("Tudo bem?", "tudo certo?"), e a
  única regra que o consulta é `ja-respondemos-antes`, que é a mais genérica do quadro e a única
  capaz de concluir com uma interrogação na frente (a despedida e a reação SÃO a última mensagem).

- **Transcrição de áudio NÃO pode decidir "sem interesse".** Anotação do lopezp4295 (03/09/2026):
  a rodada sugeriu a tecla `s` sobre um áudio em que a pessoa dizia *"eu não tenho, eu não tenho,
  né, nenhum… os números dos candidatos"* — e, na MESMA mensagem, *"mas eu vou ir votar, sim"*. Ele:
  *"de onde saiu a frase para sugerir sem interesse? transcrição para ser respondida por mim ou
  IA"*. Duas causas: `nao tenho` seco estava em `RECUSA_EXPLICITA` (não tenho o número, não tenho
  WhatsApp — recusa é *"não tenho interesse"*, e essa forma ficou), e a função lia transcrição.
  **É a regra mais destrutiva do arquivo** — etiqueta permanente no CRM + conclusão em silêncio — e
  fala passada por reconhecimento automático é o pior insumo possível: vem cheia de repetição e de
  "não" solto. Mesma disciplina do parser desde 31/08, levada ao extremo: aqui a transcrição **não
  conta**, e o áudio vira caso de `ultima-pede-resposta-pessoal`. **Recusa de verdade a pessoa
  escreve.**
- **Grupo com condição própria esconde as caixas que estão dentro dele.** Anotação da Maria Genoli
  (03/09/2026): dois áudios longos contando que está doente, e a rodada mandou o **modelo padrão**.
  O lado "sem etiqueta de cidade" tinha *"com pendência"* (exigindo `!respondidoHoje`) com TODAS as
  caixas que leem o texto, e *"sem pendência"* com duas que não olham nada. Bastava termos
  respondido no mesmo dia para o quadro **parar de ler a conversa**. A guarda existia porque a caixa
  do cumprimento repetia a mensagem do momento; hoje ela tem `excecao: momentoJaEnviado` e
  `ultima-e-so-reacao` olha `respondidoHoje` na própria tecla. **Guarda mora na CAIXA, onde dá para
  testá-la — não num grupo acima, onde ela silencia tudo o que está dentro.** Os dois lados da
  bifurcação passaram a ter a mesma forma, e as duas caixas de *"sem pendência"* viraram cópias
  mortas e foram removidas (o verificador de caixas mortas acusou).

- **O rascunho da IA não via a NOSSA fala — ela escrevia sem saber o que já tinha sido
  respondido.** Print da Maria Geny (03/09/2026): ela mandou um áudio às 21:39, nós já tínhamos
  respondido às 19:47, e o rascunho respondeu a mensagem ANTERIOR à nossa resposta. Ele: *"ignorou a
  última mensagem da pessoa e a minha resposta, e respondeu a penúltima mensagem dela"*. A IA não
  tinha como acertar: `montarContatoRascunho` mandava só as mensagens DELA, numeradas, sem a nossa
  fala no meio e sem dizer qual estava pendente — para o modelo era uma pilha de falas soltas, e
  responder qualquer uma era igualmente plausível. Hoje vai a conversa inteira, com `NÓS:`/`ELA:` e
  a marca **← RESPONDA A ESTA** na última dela (que é a última DELA, não a última da conversa: se
  nós falamos por último, a marca continua na fala que ficou sem resposta). **`mensagensParaIA` (só
  o que ela escreveu) continua certo para a DECISÃO** — escolher entre respostas prontas é sobre o
  que ela pediu; quem ESCREVE precisa dos dois lados, e é `conversaParaIA`.

- **O invariante do pedido de dados era o SEPARADOR, e ele mudou — `jaPediramDados` ficou falso
  para todo mundo.** `ehPedidoDeDados` exigia `nome / cidade` com barra, e o texto em uso passou a
  ser `Nome , Cidade` com vírgula. Efeito silencioso e grande: a rodada voltava a pedir nome e
  cidade a quem já tinha recebido o formulário. **Custou três anotações antes de aparecer** — Iris,
  Plauto e jairoc, todos dizendo *"já foi pedido dados"* —, e nas três eu procurei a causa no
  quadro. **Escrever "reconhece pelo invariante" não torna invariante o que está escrito:** barra,
  vírgula, hífen e "e" são a mesma frase para quem lê, e a regra hoje aceita as quatro. Antes de
  culpar a ordem das caixas por um "pediu de novo", teste `ehPedidoDeDados` no texto ATUAL do
  template.
- **O nome do ESTADO por extenso estoura a janela de "texto curto".** `matchCityComContexto` aceita
  a cidade sem pista quando a mensagem tem até 30 caracteres — e *"Iolanda de Capão da Canoa Rio
  Grande do Sul."* tem 43. Sem o estado são 25, e a cidade era achada. `formaCanonica` apagava o
  estado só na hora de casar, depois da conta de tamanho. Hoje ele sai antes. **"de" sozinho não
  entra na lista de pistas** e não pode entrar: é a preposição mais comum do português, e
  transformaria "material de campanha" em município.
- **Marcar UMA mensagem como pendente criou o defeito oposto.** O conserto da Maria Geny pôs
  `← RESPONDA A ESTA` na última fala dela; no dia seguinte a Janete mandou um áudio longo e, horas
  depois, clicou num anúncio — e o rascunho respondeu **só o clique** (*"IA ignorou rajada de
  mensagens"*). O que separa "já respondido" de "pendente" **não é a posição da última, é a NOSSA
  última fala**: tudo o que ela escreveu depois disso está esperando, e é a rajada inteira. Hoje
  todas vêm marcadas `← SEM RESPOSTA`, com a contagem no pedido ("responda a TODAS elas, juntas") e
  um texto próprio para quando não há nenhuma.

- **O invariante do pedido de dados tinha TRÊS cópias, e consertar uma não conserta as outras.**
  Depois de arrumar `templates.ehPedidoDeDados` (a barra virou vírgula no texto), ele reportou:
  *"já havia mandado modelo, contato deu os dados, e a sugestão foi mandar modelo novamente"*. O
  painel tinha a **sua própria** expressão, `PEDIU_NOME_E_CIDADE`, ainda exigindo a barra — e ela
  governa duas coisas de uma vez: se o parser lê a mensagem seguinte como RESPOSTA ao formulário
  (`respostaAoPedido`) e se `respondeuOsDados` é verdadeiro. Com ela furada, quem se cadastrava
  recebia o modelo de novo. **Hoje o painel CHAMA `templates.ehPedidoDeDados`** — o `CLAUDE.md` já
  mandava usá-la, e o painel não usava. Duas cópias de um invariante divergem na primeira reescrita
  do texto.
- **O anúncio reconhecido é o MAIS RECENTE, não o de trecho mais longo.** Duas anotações do João
  Carlos (04/09/2026), no mesmo contato: ele clicou em *"Eu escolho o lado da Liberdade"*, depois
  respondeu ao convite de evento, e por último escreveu *"ero receber o Material da Direita"* — e o
  anúncio reconhecido era o primeiro. *"O modelo também pegou o primeiro do contexto, pegue o
  último."* `reconhecer` juntava a conversa inteira num string só, o que **apaga a ordem**, e o
  desempate virava tamanho — o clique de semana passada vencendo o de agora. Hoje ela varre mensagem
  a mensagem, da mais nova para a mais antiga; **dentro de uma mensagem** o trecho mais longo
  continua ganhando (dois anúncios da mesma campanha compartilham a abertura). A `utm` entra no fim
  da lista de propósito: é a campanha desta sessão, e ganha de qualquer clique antigo.
- **Palpite de cidade `nao-reconhecida` NÃO pode virar a pergunta "Cidade a gravar".** Anotação dele
  (04/09): a caixa abriu com **"Mathias"**, que é o sobrenome dela (*"Taila, Mathias"*) — *"não
  existe no IBGE, não aceite o palpite"*. Aquela confiança é o modo generoso do parser devolvendo
  **qualquer palavra solta** (é o mesmo caminho que já fez um link do Instagram voltar como cidade);
  ela existe para a lista de revisão da aba Cidades, onde nada é gravado. A pergunta continua
  valendo para `aproximada`, onde o parser achou um município de verdade e a dúvida é se é ESTE.

- **O critério de TEMPO não era do apoio: é geral, e virou caixa própria.** Ele o definiu em 03/09
  dentro de `so-expressa-apoio` (*"se foi no dia anterior, é mensagem do momento"*), e quatro
  anotações de 04/09 mostraram que a razão nunca teve a ver com apoio — **Bia** e **Noeli**
  responderam nome e cidade ONTEM e a caixa oferecia o agradecimento, **Giovani** mandou um texto
  político ontem à noite e a caixa oferecia o modelo, **Beatriz Pansaia** o mesmo com o
  agradecimento. *"Responder o conteúdo de ontem soa a quem não estava lá."* Hoje é
  `contexto-de-outro-dia` (tecla 5), e `so-expressa-apoio` voltou a ser só "agradece" — um conceito,
  um lugar. **A posição é a regra inteira:** fica **abaixo** de tudo o que precisa de gente (pedido
  de dinheiro, pergunta, áudio, denúncia respondida — *"único pretexto que exclui a necessidade de
  hora é pergunta pendente"*) e **abaixo do anúncio reconhecido** (clicar num anúncio é pedir uma
  coisa específica, e escolha explícita dela não se substitui por dedução). Na CHEGADA ela fica
  ainda mais baixo, sob `anuncio-modelo-e-dados`: quem nunca recebeu nada tem direito ao recibo
  mesmo que a rodada só a alcance no dia seguinte — o contrário tiraria o recibo de quase todo
  mundo, porque a rodada quase sempre roda depois.

## Avaliação por IA (só neste branch)

- **A IA escolhe, não escreve.** Ela devolve o id de uma resposta pronta ou "escalar". O texto
  que sai é, byte a byte, um que ele escreveu. Essa fronteira é o que torna o erro recuperável:
  o pior caso é a resposta pronta errada, não uma frase inventada num mandato.
- **A chave da API NUNCA entra na página.** `page-hook.js` roda no mundo MAIN, o mesmo contexto
  JS do Angular do mobiliza — chave ali é chave publicada. A chamada sai do `background.js`
  (service worker), que lê `store.iaChave` e devolve só a decisão. Também fica fora do
  `exportJson`.
- **As travas moram em `validarDecisao`, não no prompt.** Prompt é pedido; validação é regra. Id
  inventado vira `incerto`; confiança abaixo de `CONFIANCA_MINIMA` vira `incerto`; e escolher
  `pedido-ajuda`/`pedido-emprego` (`RESTRITOS`) **vira escalada**, nunca envio — são os de risco
  jurídico (Lei 9.504/97). `incerto` = o painel se comporta como antes da IA existir.
- **A regex roda ANTES e a IA só vê o que sobrou.** Ordem mais barata e mais segura ao mesmo
  tempo: o caso conhecido é pego de graça e não depende de a IA estar no ar, com crédito ou de
  bom humor.
- **Falha de IA nunca para a rodada.** Sem chave, sem rede, sem crédito, resposta ilegível: tudo
  vira `incerto`. Mesma prioridade do canal caído — o que o contato recebe vem primeiro.
- **ESCALAR ABRE A CAIXA; nao pula.** Ate 02/09/2026 a escalada da IA devolvia `pulado` **sem
  perguntar nada** e sem olhar caixa de selecao nenhuma — nem a de automatizar, nem a de pular por
  etiqueta. O contato sumia da rodada com o motivo so no log, e o relato dele foi *"pulando contato
  sem eu pedir mesmo a minha mensagem nao sendo a ultima e com o box de pular desmarcado"*. A
  incoerencia era com a propria **tecla 6**: as duas coisas significam "aqui precisa de gente", e a
  tecla 6 abre a caixa (e a excecao que a automacao respeita). Hoje as duas fazem o mesmo, e a
  escalada vira uma linha `⚠` na caixa dizendo por que o caso esta com ele. **A automacao nao age
  num caso escalado**: `recomendada` exige `decisaoIA.acao === 'responder'`, e a automacao
  deterministica exige `sugestao` — as duas continuam de fora, o que e o que torna seguro deixar de
  retornar ali.

- **A recomendação é tecla 0, e não substitui tecla existente.** Trocar o significado de uma
  tecla que ele já tem no dedo é como o "2" digitado na conversa acabou concluindo atendimento.
- **Automatizar a rodada é automatizar TODA pergunta dela, inclusive a da cidade.** A caixa
  "Automatizar com IA" nasceu mandando a resposta escolhida — e a rodada continuou parando, porque
  o popup "Cidade a gravar" esperava um clique que ninguém ia dar. Regra que vale para toda
  pergunta nova: **se ela pode abrir dentro da rodada, ela precisa de resposta automática ou de um
  jeito de não abrir.** Uma pergunta sem dono trava a fila inteira em silêncio.
- **A IA pode confirmar cidade; inventar município, não.** `validarCidade` só aceita correção que
  case com a lista do IBGE, e o que vai para o CRM é o nome **oficial** da lista, não o que ela
  digitou (duas grafias = duas etiquetas para o mesmo município). Confiança baixa, JSON ilegível e
  nome de fora viram `incerto`, que **não grava e não recusa**: recusa é decisão dele, e guardar
  "não é Canoas" porque o modelo ficou em 60% seria transformar dúvida em fato.
- **O rascunho da IA NUNCA envia sozinho — retirado em 03/09/2026, a pedido dele.** Existia o
  caminho do envio automatico (decisao dele de 20/08), com quatro travas: ligado na Config, zero
  avisos de `revisarRascunho`, a IA nao ter pedido revisao, e confianca >= 0,9. **As quatro
  funcionaram e a mensagem saiu mesmo assim** — o log dizia *"rascunho da IA enviado sozinho
  (confianca 92%, sem avisos)"*, ele viu e cortou: *"retire essa mensagem automatica, so no modo IA
  manda sem eu escolher"*. Licao que fica: **trava boa nao transforma texto inventado em texto
  revisado**; o que ela faz e reduzir a frequencia do erro, e mensagem de WhatsApp nao volta. Hoje
  `rascunharParaEle` usa `setComposerText` e **nunca** `sendText`, e a rodada segue para a caixa,
  onde ele escolhe. `ia.podeEnviarSozinho`, `CONFIANCA_RASCUNHO_AUTO` e a caixa da Config foram
  APAGADOS junto — funcao sem gatilho e a armadilha do `pedido-emprego`, e esta em especial e a que
  alguem religa sem querer.
- **Com o automático DESLIGADO, o rascunho continua só aparecendo para ele.** O texto cai no campo de
  mensagem (`setComposerText`, nunca `sendText`) e quem aperta enviar é ele. É o laço que ele já
  fazia à mão (copiar para uma IA, editar, mandar) sem o copiar e colar, e sem mudar a última
  parte. O prompt usa as **respostas prontas dele como exemplo de estilo** — sai de graça, já
  está no prompt cacheado, e é a amostra mais fiel da voz dele que existe. `revisarRascunho`
  levanta a mão (marcador esquecido, promessa de bem ou benefício, texto longo) mas **nunca
  esconde o texto**: esconder tiraria a decisão dele.
- **`cache_control` no prompt de sistema segura o custo — QUANDO o modelo cacheia.** O catálogo
  + regras são **~1.300 tokens** com as 11 respostas de fábrica (medido 29/08; o número antigo
  aqui, 3.700, estava errado e foi ele que fez a estimativa de custo sair 3× alta). O mínimo para
  cachear **não cresce com a geração**: 512 no Opus 5, 1.024 no Sonnet 5, **4.096 no Haiku 4.5** —
  ou seja, no padrão atual o cache **não pega**, e não pega em silêncio (`cacheLido: 0`, sem erro).
  Por isso `CACHE_MINIMO_TOKENS` + `vaiCachear` existem: o painel ensinava que "SEM CACHE" é sinal
  de problema, e no Haiku isso apareceria em 100% das chamadas estando tudo certo. **Alarme que
  toca sempre é alarme que se aprende a ignorar** — e aí não toca no dia em que é de verdade.
  Mexeu no tamanho do prompt ou no modelo? O teste de `vaiCachear` trava os dois lados.
- **A assinatura Claude Pro/Max NÃO cobre a API.** São faturas separadas: a assinatura é do
  claude.ai e do Claude Code; a chave `sk-ant-…` é pré-paga por token no console. "Uso meu plano"
  foi a suposição dele em 29/08 e não existe — cada avaliação é despesa NOVA em cima do plano.
  Daí `ia.tetoUsd` (padrão US$ 20/mês), obrigado no **`background.js`**, o único ponto por onde o
  dinheiro sai. Teto no painel é teto que um caminho novo esquece de chamar. Sem botão de zerar
  o contador **de propósito**: zerar é o único controle que torna o teto decorativo — precisa de
  mais, levanta o teto, que fica salvo e visível.
- **O Opus 5 PENSA por padrão, e o pensamento cabe dentro do `max_tokens`.** Diferente do 4.8/4.7.
  Ele é cobrado como saída (US$ 25/MTok), então teto apertado não economiza: trunca. Com os 512
  que estavam na decisão, o raciocínio comia a cota e o JSON saía cortado — **chamada paga que
  vira `incerto`, sem nada na tela dizendo por quê**. Quem segura custo é `output_config.effort`,
  não `max_tokens`. Mexeu em modelo? Confira as duas coisas juntas.
- **`effort` não vale para todo modelo — e o Haiku 4.5 está no seletor.** Ele recusa o parâmetro
  com 400, ou seja: a opção mais barata do menu, a que se escolhe justamente quando o gasto
  preocupa, é a que quebraria. `MODELOS_COM_ESFORCO` é **lista de permissão**, nunca de bloqueio —
  a inversa faz todo modelo futuro nascer quebrado até alguém notar.

- **MERGE TEM DOIS LADOS — e eu conferi um só.** No merge `c7a6d59` (31/08) o git removeu duas
  funções inteiras do `panel.js` (`avaliarComIA` e `tentarRascunhoAutomatico`) e eu não vi: conferi
  que nada de PRODUÇÃO tinha se perdido e não conferi o lado da IA. **Nada acusou**: o arquivo
  ficou sintaticamente válido, com duas chamadas para funções inexistentes; `node --check` não vê,
  `checar-modulos.mjs` não vê (só olha `SyntaxError`) e nenhuma suíte importa o `panel.js`, que
  precisa de `window`. Ia estourar `avaliarComIA is not defined` no meio de uma rodada. Depois de
  merge, rode **`node tools/checar-referencias.mjs`** e confira os DOIS lados com `git diff` contra
  cada branch.

- **Opção na pergunta da rodada sem `if` que a execute manda OUTRA mensagem.** A tecla 0 (a
  recomendação da IA) devolvia `ia:<id>` e nenhum ramo tratava esse valor: a escolha caía no fim de
  `tratarContato` e enviava o modelo do conteúdo — mensagem errada, para eleitor de verdade — e
  quebrava quando não havia modelo. Sintaxe válida, nenhuma função faltando: a passada de chamadas
  do `checar-referencias.mjs` não pegava, porque o que faltava era o ramo. Hoje ele confere também
  que todo `valor:` das opções tem um `=== '…'` (ou um `startsWith('…'` quando o valor é montado).
  **Criou opção? O ramo entra no mesmo commit.**

- **A caixa da rodada precisa CABER na tela, e ela e modal para a rodada.** Relato dele
  (04/09/2026): *"cortado e nao consigo pegar a resposta"* — dez opcoes mais as treze respostas
  rapidas abertas passavam do fim da janela, e a unica saida era Esc, que descarta a decisao. Hoje
  `.wf-pergunta` tem `max-height` + `overflow-y: auto`. Tres coisas: **`box-sizing: border-box` e
  obrigatorio** (sem ele o `max-height` vale so para o conteudo, e os 14px de padding de cima e de
  baixo mais a borda somam 30px que estouram — medido, a caixa passava 18px do fim da janela mesmo
  com o limite escrito); **arrastada, o limite e escrito pelo JS** em `aplicarPosicao`, porque o
  espaco disponivel depende do `top` e nao ha como dizer isso em CSS; e o **titulo e `sticky`**,
  senao rolar ate as respostas rapidas leva a alca de arrastar para fora da vista, justo quando a
  caixa esta grande demais. O limite vai na CAIXA e nunca no fundo: o fundo e `pointer-events:
  none` de proposito, e capturar rolagem ali travaria a conversa atras.


## Regras do projeto

- **Sem IA na extração.** Custo por contato. Parser determinístico: regex, dicionário, lista de
  referência (IBGE, COREDEs) e confirmação humana em 1 clique.
- **Não adivinhar formato de escrita.** O gravador (`recorder.js`) observa a plataforma fazendo
  uma vez e copia. Sem contrato aprendido, a extensão **recusa** em vez de tentar.
- **Automático só grava o determinístico:** o COREDE e as etiquetas de conteúdo. Palpite
  aproximado sempre espera clique. **Cidade está FORA do automático por pedido dele:** casar
  exato com o IBGE prova que o texto é nome de município, não que seja a cidade dele ("meu genro
  mora em Santiago" casa igual). Toda cidade de palpite passa por `confirmarCidadeSePendente`
  antes de ir pro CRM — inclusive na gravação automática, que era a metade que ele via.
- **Nunca sobrescrever o que já está no CRM.** O automático só preenche buraco. **Uma exceção:**
  a cidade que a própria pessoa informou — respondendo o formulário **ou** mandando uma mensagem
  que é só o nome do município — substitui a do CRM, com casamento exato e nome COMPLETO (nunca
  prefixo), levando a etiqueta de COREDE antiga junto. Cidade citada no meio de uma frase não
  substitui nada.
- **Resposta não chama o contato pelo nome.** Decisão do Thiago (10/08), e vale para resposta
  nova: o nome do CRM erra demais para ir num texto que a pessoa lê (apelido do perfil, cidade
  no campo do nome, sigla colada, `[NOVO] …`), e sem valor ele **bloqueia o envio**. Continuamos
  extraindo e gravando o Nome — ele só não sai na mensagem. `vars.semVocativo` é a regra.
- **Escolha explícita dele não se substitui por dedução, nem quando a dedução está certa.** A
  rodada trocava o modelo escolhido por uma resposta de texto quando a janela de 24h estava
  aberta — dedução correta, e mesmo assim defeito: ele escolheu no seletor e saiu outra coisa.
  Ser esperto não compra o direito de contrariar o que está escrito na tela.
- **Na dúvida, recusar com o motivo na tela.** Vale para modelo ambíguo, etiqueta não
  encontrada, variável não resolvida e conteúdo que casou com duas regras.
- **Se a plataforma mudar de layout**, o conserto é em `dom.js` (seletores) e `dock.js` (o
  empurrão). Em nenhum outro lugar.
- **Prefira `data-cy` a texto ou classe do Tailwind.** É gancho de teste da plataforma (abas da
  fila, item da fila, busca, filtro), não muda com tradução nem com tema.

## Eficiência e disciplina de saída

> Este arquivo é lido a cada turno — mantenha-o curto. Regra que não paga o próprio custo sai.

- **Raciocínio completo, saída enxuta.** Sem abertura bajuladora nem fecho vazio.
- **Edição cirúrgica vence reescrever o arquivo inteiro.**
- **Não chute** rota, formato de body ou seletor: verifique no navegador.
- **Leia cada arquivo uma vez.**
- **Instrução do Thiago sempre vence estas regras.**

> **"Nossa mensagem foi X?" nunca se responde comparando com UM texto.** Toda resposta tem
> variantes, e o pedido de dados tem três formas (`pedir-dados` e os dois de evento). Comparar
> com o texto base fazia a resposta do contato deixar de ser lida como resposta — *"deu a cidade
> e não pegou"*, 01/09. Case pelo **invariante** (a linha `Nome / Cidade`), que é o que os testes
> já protegem em cada texto.
>
> **E vale para os DOIS lados: reconhecer a nossa PERGUNTA tem o mesmo problema.** Comparar com o
> texto atual do template só enxerga o que saiu com a redação de hoje — e este projeto reescreve
> resposta com frequência, então **cada reescrita deixa uma safra de conversas invisíveis**. A
> Loreta recebeu *"Para eu poder salvar seu contato me passe seu: Nome / Cidade"* em 31/08, redação
> que já não existia; nenhum trecho literal casou, `jaRespondemosAntes` concluiu que já havíamos
> ENTREGADO algo a ela, e a rodada mandou a mensagem do momento **em vez do modelo que ela nunca
> recebeu**. Quem precisa saber "esta mensagem nossa era o pedido de dados?" usa
> `templates.ehPedidoDeDados`, nunca o texto do template.

## Testes

> **`node --check` NÃO basta, e já derrubou a extensão.** Ele analisa `.js` como **CommonJS**
> (modo solto); o Chrome carrega como **ES module**, que é sempre strict. Em 30/08/2026 um
> `.join('

')` virou string com quebra de linha CRUA, o `--check` disse OK e o painel parou
> de carregar — sem erro visível na aba, porque o content script morre antes de desenhar.
> Antes de dar tarefa por concluída: `node tools/checar-modulos.mjs`, que importa todo arquivo de
> `src/` e reclama só de `SyntaxError`.

Node 18+, sem dependência. Antes de dar tarefa por concluída, as quinze suítes passando:

```bash
node tests/parser.test.mjs && node tests/contract.test.mjs && node tests/vars.test.mjs && node tests/tags.test.mjs && node tests/hsm.test.mjs && node tests/conversa.test.mjs && node tests/templates.test.mjs && node tests/categorizar.test.mjs && node tests/cortesia.test.mjs && node tests/sugestao.test.mjs && node tests/ia.test.mjs && node tests/gabinete.test.mjs && node tests/arvore.test.mjs && node tests/anuncios.test.mjs && node tests/observacoes.test.mjs
```

Rodam offline: a lista de municípios do `parser.test.mjs` sai de `src/data/coredes-rs.json`,
plantada no storage antes do import. Buscar no IBGE deixava **12 asserções falhando juntas**
onde a rede é bloqueada, por um motivo que não tem nada a ver com o parser.
Lógica que grava em dado real tem teste. Bug encontrado ao vivo vira teste de regressão.

## Git

- **Commits em português, sem acentos:** `tipo(escopo): resumo`
  - Tipos: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`
  - Exemplo: `fix(fields): le customFieldValues no formato real da api`
- **Nunca `git add -A`** — adicione arquivos explicitamente.
- **Commit e push sem perguntar**, sempre que a tarefa fechar (autorização permanente do Thiago).
- **Todo commit leva o `registro.md` junto.** Entrada nova no TOPO, com causa raiz quando for
  correção. Commit sem registro é conserto que ninguém vai conseguir explicar daqui a um mês —
  e este projeto já teve diagnóstico refeito três vezes por falta disso.
- **Armadilha nova de plataforma entra aqui**, no `CLAUDE.md`, no mesmo commit. Só o que se
  paga: fato que custou horas e que a próxima sessão redescobriria do zero.

## Ambiente

- Cliente: campanha política no RS. Dados reais de eleitores — **toda escrita é em produção.**
- Contato de teste: "Thiago Tim" no CRM — é o número do próprio Thiago. Teste sempre nele.
  **Nunca escreva telefone ou nome real de eleitor em arquivo do repositório** (código, teste,
  doc ou registro): use dados fictícios.
- **Não vai para a Chrome Web Store.** Uso interno, carregada descompactada. Nada de trabalho
  para atender exigência de loja (pacote, formulário, política pública).
- Recarregar código: `chrome://extensions` -> recarregar -> **F5 na aba do mobiliza**.
- Repositório **privado**: `github.com/thiagokcw-coder/WhatsFill`. `gh` CLI autenticado.
- **`gh` no PowerShell devolve exit 255 mesmo quando dá certo** — ele escreve o progresso do
  git em stderr e o PowerShell transforma em `NativeCommandError`. Confira pelo `gh repo view`,
  nunca pelo código de saída. Preferir o Bash para `gh` e `git`.
