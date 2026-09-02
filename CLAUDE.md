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
> 1. **`registro.md`** — log de mudanças, decisões e pendências
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
src/fluxo.html/.css/.js JANELA do fluxo: o QUADRO (caixas soltas, fios, arrastar, editar)
src/lib/fluxo-msg.js    a mensagem que pede ao service worker para abrir a janela
src/data/coredes-rs.json  município -> COREDE (planilha oficial da SPGG-RS)
tools/make-icons.mjs    desenha os ícones
tests/*.test.mjs        Node puro, sem dependência
```

`STORE.md`, `PRIVACY.md` e `tools/package.mjs` são resto da submissão na loja, abandonada.

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
- **O rascunho pode ENVIAR sozinho, e é a única coisa do projeto que faz isso.** Decisão dele
  (20/08/2026), tomada depois de eu apontar o risco: é o único caminho em que texto **gerado** por
  IA chega a um eleitor sem revisão humana, em nome de um mandato, e mensagem de WhatsApp não
  volta. Só acontece quando a IA **escala** (nenhuma resposta pronta serve) — as prontas continuam
  sendo o caminho normal. Quem decide é `ia.podeEnviarSozinho`, puro e testado, e ele exige as
  **quatro travas juntas**: (1) `ia.enviarRascunhoAuto` ligado na Config, que nasce desligado;
  (2) **zero avisos** de `revisarRascunho` — marcador, promessa de entrega, menção a
  cesta/remédio/dinheiro/emprego (Lei 9.504/97), texto longo; (3) a IA não ter marcado
  `precisaDeRevisao` (ausente conta como SIM); (4) confiança ≥ `CONFIANCA_RASCUNHO_AUTO` (0,9,
  maior que o 0,7 da decisão). A trava (2) é a mais valiosa porque **não depende de a IA ser
  honesta sobre si mesma**; a (4) é a mais fraca e por isso nunca é a única. Qualquer falha de
  rede ou formato também vira "não envia". **O texto enviado vai inteiro para o log da rodada** —
  é a única forma de auditar depois o que a IA falou em nome do mandato.
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

Node 18+, sem dependência. Antes de dar tarefa por concluída, as catorze suítes passando:

```bash
node tests/parser.test.mjs && node tests/contract.test.mjs && node tests/vars.test.mjs && node tests/tags.test.mjs && node tests/hsm.test.mjs && node tests/conversa.test.mjs && node tests/templates.test.mjs && node tests/categorizar.test.mjs && node tests/cortesia.test.mjs && node tests/sugestao.test.mjs && node tests/ia.test.mjs && node tests/gabinete.test.mjs && node tests/arvore.test.mjs && node tests/anuncios.test.mjs
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
