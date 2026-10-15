# WhatsFill+IA — Guia para Claude Code

> **Este é o branch `claude/whatsfill-ia`.** O WhatsFill normal vive em
> `claude/extensao-claude-analise-i9spxw` e continua sendo a ferramenta de produção dele. Tudo
> abaixo vale para os dois; o que é exclusivo daqui está na seção **Avaliação por IA**.
>
> Conserto que vale para os dois: faça no branch normal e traga para cá com merge. Duplicar
> `panel.js` (6.000+ linhas) é como as duas versões divergem em uma semana.
>
> **A série da versão diz qual das duas está carregada: produção é `0.x`; aqui é tudo o que NÃO
> for `0.x`.** Conferido em 07/09/2026: produção é `WhatsFill` **0.63.0**, e este branch é
> `WhatsFill+IA` **2.87.0**. (O texto antigo dizia "este branch é `1.x`" e envelheceu — a série
> daqui já passou por 1.x e 2.x, e o que separa as duas é o **zero** de produção, que nunca muda.)
> As duas carregam da MESMA pasta, então dar checkout aqui troca a extensão em produção sem
> avisar ninguém — o nome (`WhatsFill+IA`) e a série são os únicos sinais. A regra anterior era
> "versão sempre maior na IA" e quebrou no primeiro dia em que as duas subiram (31/08): regra que
> exige alguém lembrar não é regra.
>
> **Havia um segundo bloco aqui, vindo do outro branch por merge**, dizendo *"este é o branch
> `claude/extensao-claude-analise-i9spxw`"* e *"nada de IA entra aqui"* — **falso neste arquivo**,
> e era a primeira coisa que uma sessão nova lia. Removido em 07/09/2026. Se ele voltar num merge,
> remova de novo: o cabeçalho tem que dizer de qual branch É este arquivo.

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
src/lib/imagem.js       envio de IMAGEM com legenda, na cadeia gravada da plataforma (puro, testado)
src/lib/fields.js       schema, leitura e escrita de campos personalizados
src/lib/extract.js      parser determinístico
src/lib/cities.js       municípios do IBGE, normalização, cidade -> link
src/lib/tags.js         etiquetas: COREDE, regras de conteúdo
src/lib/categorizar.js  etiqueta de CIDADE para a base inteira (puro, testado)
src/lib/hsm.js          modelos de mensagem aprovados
src/lib/vars.js         variáveis dos templates e bloqueio por variável faltante
src/lib/ia.js           prompt, esquema e TRAVAS da decisão por IA (puro, testado)
src/lib/atendimento.js  o PADRAO DE ATENDIMENTO que ELE escreveu — documento dele, não mexer
src/lib/ia-cliente.js   ponte painel <-> service worker (a chave nunca entra na página)
src/lib/sugestao.js     tabela de regras da rodada, e os verbetes dela (puro, testado)
src/lib/arvore.js       o fluxo como ARVORE: sinais, ramos dele, decisao (puro, testado)
src/lib/anuncios.js     ANUNCIOS do momento: texto que reconhece + o que fazer (puro, testado)
src/lib/perfis.js       os CANDIDATOS: quem atende cada canal e o que e dele (puro, testado)
src/lib/lote.js         DISPARO: pecas de texto (com arte ou sem), revezando (puro, testado)
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
- **`\b` NÃO funciona antes de palavra acentuada.** `\b` é fronteira de `\w`, e `é` não é
  `\w`: `/\bé nós/` **nunca** casa no começo da string. Foi assim que "É nós." — a frase exata
  que ele mandou de exemplo — passou batido na primeira versão do detector de despedida. Em
  padrão que começa com acento use `(^|\s)`. Vale para todo o vocabulário daqui: "é nós",
  "ótimo", "amém". **E vale do outro lado também** — ver a fronteira que não FECHA depois de
  letra acentuada, mais abaixo.
- **"DINHEIRO" solto nao e pedido: e o vocabulario de politica desta base.** Print da Elenir Minozzo
  (06/09/2026): 858 caracteres de critica politica — *"MENOS DEPENDENTE DAS CESTAS BASICAS E SEM
  SUBSIDIOS DO GOVERNO FEDERAL"*, *"Tem que acabar com essas benesses e auxilios pecuniarios"*,
  *"BASTA! Dinheiro ACABA."* — e ela recebeu **a negativa de ajuda financeira**. Medido: casou por
  `\bdinheiro\b`. Ela estava dizendo o CONTRARIO de pedir. Hoje `dinheiro`, `grana`, `emprestimo` e
  `doacao` estao na mesma condicao das NECESSIDADES: **so valem junto de um verbo de pedir**. O que
  decide sozinho e so o que ninguem escreve sem estar pedindo — a chave PIX e um valor concreto.
- **Antes de por trava na IA, PROVE que foi a IA.** Nas prints da Dima e da Sandra eu deduzi que o
  texto vinha da IA porque *"nenhuma resposta pronta alcanca este contexto"* — e o caminho estava
  certo para o QUADRO e errado para a conversa real, porque `pedeAjudaFinanceira` alcancava por
  causa de uma palavra solta. Ele corrigiu: *"foi o deterministico novamente mandando mensagem, no
  outro caso foi tambem; volte a mensagem automatica da IA"*. A lista de casos sensiveis que eu
  criei (2.73) viveu uma hora e **foi retirada**: barrar a IA era tratar o sintoma no lugar errado, e
  o preco era a rodada automatica parar justamente nos casos que ela existe para resolver. **Onde se
  olha e o Andamento da rodada**, que registra cada envio automatico com o motivo.
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
- **A PLATAFORMA TEM DISPARO EM MASSA PROPRIO, e e `chat/v1/campaign`** (lido no bundle em
  26/09/2026, quando ele perguntou como mandar a colinha para os concluidos de ontem). Modelo do
  tipo **Campanha**, descrito por ela mesma como *"disparo em massa de mensagens. Permite o uso de
  imagens, videos e documentos"*, com criar, `estimate`, `submit`, `pause`, `resume`, `cancel`,
  `summary`, `submission/export`, duplicar, arquivar e uma tela de **historico de disparo**. O
  publico (`public.type`) e um de quatro: `ALL`, **`PHONE_LIST`** (`{phoneList:[numeros]}`),
  **`FILTER`** (o MESMO objeto do filtro de Contatos — `tagsId`, `exceptTagsId`,
  `customFieldValuesFilters`) e `IMPORT_SPREADSHEET`; teto de 50.000 (10.000 em Sequencia), e so
  contato com telefone definido conta. **Sendo modelo aprovado, a campanha ATRAVESSA a janela de
  24h** — que e o que barra texto livre e imagem solta —, **e nao reabre atendimento nenhum**, que
  e o padrao que ele desligou em 15/08. O status `WAITING_TEMPLATE` ("Aguardando modelo") diz o
  preco: a campanha espera a aprovacao da Meta. **Antes de escrever rodada que manda a mesma coisa
  para muita gente, e aqui que se olha** — e a propria tela avisa, mostrando a qualidade do numero
  pela Meta com *"Evite disparos em massa para manter este numero ativo"* (na BAIXA, *"os contatos
  estao denunciando suas mensagens"*); o erro `CHANNEL_TIER_EXCEEDED` e o teto diario do numero.
- **A JANELA DE 24h E PROPRIEDADE DO CANAL, E REABRIR NAO E O QUE O WHATSAPP VE** (27/09/2026, pergunta
  dele: *"e uma plataforma nao oficial, abrir conversa e ato que so acontece na plataforma; qual a
  diferenca de eu enviar pelo celular e pela plataforma?"*). **Ele esta certo nas duas metades.**
  **(1) Reabrir e status do CRM** (`COMPLETED` -> `IN_PROGRESS`) e o WhatsApp nao ve nada disso — a
  frase de 15/08 (*"reabrir gente fria em sequencia e o padrao que mais se parece com disparo em
  massa"*) **culpa o ato errado**: o que e visto sao as MENSAGENS (quantas, com que intervalo, quao
  parecidas, para quem), e reabrir era so o passo antes de cada envio. Nao use "nao reabre atendimento"
  como argumento de seguranca.
  **(2) O app separa os canais em dois mundos, com estas palavras:**
  `whatsAppOfficialChannels = type === Dialog360 || type === CloudApi` e
  `whatsAppUnofficialChannels = type === ZAPI || type === EvolutionAPI`, rotulados na tela como
  **"WhatsApp"** e **"WhatsApp (nao oficial)"**. **E a capacidade vem em `channel.typeDetails`:**
  **`sessionDurationInMinutes`** e a janela — **`-1` significa SEM JANELA** (o codigo sai na hora) —,
  **`mustUseTemplate`** diz se fora da janela so passa modelo aprovado, `canDefineTemplate` e o
  `canSendTemplate` da tela, e **`canSendCampaign`** diz se a Campanha funciona naquele canal (mais
  `canStartNewSession`, `canSendSequence`, `allowedAttachments`, `maxFilesPerSend`,
  `templateProperties`).
  **Consequencia:** num canal NAO OFICIAL nao ha janela de 24h nem modelo aprovado — texto livre sai
  a qualquer hora, sem aprovacao da Meta —, e a Campanha pode nem existir ali. O que NAO muda e o
  `status` **`FLAGGED`** (*"sinalizado como enviando SPAM"*): ele e o WhatsApp punindo o PADRAO, e num
  numero nao oficial o castigo e a conta, sem recurso; `quality`, `RESTRICTED` e
  `CHANNEL_TIER_EXCEEDED` sao da Cloud API e podem nao significar nada num canal Z-API.
  **Sendo Z-API ou Evolution, a plataforma e um cliente pareado a conta dele** — para o WhatsApp e o
  mesmo aparelho da mao dele. Entao celular e plataforma nao sao remetentes diferentes: **a diferenca
  e o ritmo e a repeticao**, e 150 mensagens iguais digitadas no celular derrubariam igual.
  **Antes de afirmar qualquer coisa sobre janela, modelo aprovado ou campanha, leia o TIPO do canal** —
  `GET /chat/v4/channel/my` + `chat/v1/channel/type-details`. O painel hoje assume a janela para todo
  mundo (a decisao de agosto) e `state.session.expired` vem da API por sessao: se para canal nao
  oficial ela devolve sempre `false`, o painel acerta por acidente — **isso nao foi medido.**
- **TEXTO REPETIDO EM SEQUENCIA DERRUBA O NUMERO, E O ORCAMENTO E DEZ** (correcao dele, 26/09/2026:
  *"mentira, porque ja derrubei o numero ao mandar a mesma mensagem em sequencia para menos de 10
  pessoas que chegaram por anuncio"*, depois de eu escrever que a Meta mede denuncia e nao repeticao).
  **Ele esta certo, e o app separa isso em TRES eixos que eu havia juntado num so:**
  `channel.status` **`FLAGGED`** = *"foi sinalizado como enviando SPAM pela Meta/WhatsApp"* (padrao de
  envio, NADA a ver com denuncia — e o caso dele); `channel.status` **`RESTRICTED`** = *"atingiu o
  limite conversas iniciadas nas ultimas 24 horas"* (volume); e `channel.quality` `HIGH|MEDIUM|LOW`,
  que e o eixo da denuncia (MEDIUM ja diz *"evite disparos em massa"*, LOW diz *"os contatos estao
  denunciando suas mensagens"*). Os outros `status` sao `CONNECTED`, `BANNED`, `DISCONNECTED`.
  **Consequencia para qualquer rodada que mande a mesma coisa para muita gente: variacao de texto nao
  e cosmetica, e o volume por dia e um teto de verdade** — e por isso que a mensagem do momento tem
  variacoes revezando. **E o painel nao ve nada disso:** ele so enxerga o canal CAIDO, por TEXTO da
  tarja (`dom.canalDesconectado`). `GET /chat/v4/channel/my` devolve os canais da conta com `status`,
  `quality` e o numero formatado numa requisicao so, e `POST /chat/v1/channel/{id}/limit` valida o
  teto antes de disparar. **Ao propor envio em lote, a saude do canal vem ANTES do resto** — e modelo
  de categoria MARKETING (a colinha e) e o mais vigiado dos dois.
- **O CONCLUIDO SABE QUANDO FOI CONCLUIDO: o campo e `endAt`.** A tela nao mostra data na lista de
  concluidos e mesmo assim pede a lista **`orderByDesc=endat`**, ordenando os itens por `endAt` —
  entao a lista JA esta em ordem de conclusao e a data vem em cada item. A rota e
  **`/chat/v7/session`** (nossas contagens usam a v6) com `statuses=COMPLETED` e `pageSize=50`, e o
  item traz `contactId`, `endAt`, `expired` e `lastMessageIn`: **"quem eu concluí ontem e ainda esta
  dentro da janela de 24h" e uma varredura de paginas, sem abrir contato nenhum.** Cuidado com o
  `includeDetails`: o enum e `AGENTDETAILS`, `CONTACTDETAILS`, `CHANNELDETAILS`,
  `CHANNELTYPEDETAILS`, `DEPARTMENTSDETAILS`, `GROUPDETAILS`, `STATUSREASONDETAILS` — **`All`, que e
  o que a nossa `api.js` manda, NAO esta na lista** e deve estar sendo ignorado (nas contagens nao
  incomoda, porque so lemos `totalItems`).
- **`customFieldValuesFilters` FOI DECIFRADO, e e o MESMO corpo do contrato de ESCRITA** (26/09/2026):
  cada item e `{customFieldId, valueString | valuesInteger[] | valuesFloat[] | valuesId[] |
  valuesDateTime[] | valueBoolean}`, montado no app pela mesma funcao que monta a gravacao do campo
  (`generateBodyForUpdateCustomFieldValue`) — ou seja, **o que o `contract.js` aprendeu para gravar
  vale para filtrar**. Isto corrige o comentario de `api.filterContacts`, que dizia nao decifrado.
  Consequencia: da para pedir ao servidor "quem tem a Data de conclusao do contato igual a tal dia",
  e ele consegue isso a mao no filtro de Contatos e no publico da campanha. **A lacuna e do dado, nao
  da rota:** aquele campo so preenche buraco e so em contato classificado, entao quem ja tinha sido
  concluido antes fica de fora — essa metade so o `endAt` fecha.
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
- **O APÓSTROFO SOME, O PONTO VIRA ESPAÇO** (22/09/2026). `Sant'Ana do Livramento` (IBGE) e a etiqueta
  dele `SANTANA DO LIVRAMENTO` eram chaves diferentes, então o nome OFICIAL casava como `aproximada` — a
  confiança que não grava — e a etiqueta não era reconhecida. Separador ENTRE palavras (ponto, hífen) vira
  espaço; DENTRO de uma palavra (apóstrofo) some. **Mexeu em `semAcentoNemCaixa`? Rode a prova de colisão
  contra os dois arquivos de municípios** — as 8 colisões que existem são de acento e são antigas.
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

- **Mexeu no `fluxoPadrao`? Rode `node tools/exportar-fluxo.mjs` e commite `tools/fluxo-padrao.json`
  junto.** Combinado de 03/09/2026: *"arrume o ramo, eu vou importar. Todas as mudancas feitas aqui,
  se afetarem o ramo, voce deve me passar o ramo atual"*. O gerador escreve o padrao de agora no
  formato que a janela importa, **confere relendo** (a peneira do `deArquivo` descarta regra que
  sumiu, sinal desconhecido e tecla inventada — arquivo que perde ramo na importacao chegaria a ele
  como "veio faltando pedaco") e imprime o fluxo em texto.
  **O ARQUIVO E VERSIONADO desde 12/09/2026, a pedido dele** (*"o fluxo ficou fora do GitHub"*) — o
  caminho e FIXO porque e o link que ele guarda. Ate entao a saida ia para fora do repositorio, com
  o argumento de que **retrato commitado envelhece** no primeiro commit que mexe no padrao, e fluxo
  velho e pior que nenhum: ele reimporta e volta no tempo sem perceber. **O argumento era verdadeiro
  e deixou de ser** — `tests/arvore.test.mjs` chama `conferir()` e cai quando o arquivo nao e o
  `fluxoPadrao` de agora, entao **arquivo velho nao passa nos testes e nao chega a ser commitado**.
  Duas coisas a lembrar: as caixas de AGRUPAMENTO recebem id derivado do rotulo (`g:<slug>`) so na
  exportacao, porque `novoId()` carrega o relogio e faria o `git diff` acusar mudanca onde nao
  houve — **o diff so mexe quando o quadro mexe, e e isso que torna o arquivo util no GitHub**; e a
  conferencia compara **so a arvore**, nunca o carimbo da versao, senao todo bump de manifesto
  obrigaria a regerar e o carimbo deixaria de dizer QUANDO o quadro mudou. Passar um caminho
  (`node tools/exportar-fluxo.mjs <saida.json>`) continua escrevendo noutro lugar, para mandar a ele
  a mao — **fora do repositorio**, que e a pasta que o Chrome carrega.

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

- **DESLIGAR O ANUNCIO NAO PODE TRANSFORMAR O TEXTO DELE EM FALA DELA** (15/10/2026, print: *"essa
  pra ser a mensagem de um anuncio antigo, ja e pra estar desativado"*). `ehOTextoDoAnuncio` chamava
  `reconhecer`, que **filtra os ligados** — medido: ligado da true e os detectores se calam;
  **desligado dava false**, e `soExpressaApoio` dizia *"escreveu apoio em mensagem propria"* em cima
  de uma frase que a CAMPANHA escreveu. **Sao DUAS perguntas e so uma depende do desligado:** *"o
  que mandar?"* (acao, modelo, `anuncioReconhecido`) respeita a campanha encerrada; *"de quem e esta
  frase?"* nao — o texto pre-preenchido fica na conversa PARA SEMPRE. Hoje `reconhecer` tem
  `incluirDesligados` e **so `ehOTextoDoAnuncio` a usa**. Nesta print nao mordeu por acidente (o
  texto abre com *"Ola! Eu..."* e a heuristica o marcou assim mesmo); anuncio sem essa forma morde.
  **E a assercao do teste gravava o defeito**, com um comentario meu dizendo *"a mesma regra do
  `reconhecer`"* — invertida. **Ao escrever "e a mesma regra de X", escreva a PERGUNTA que cada uma
  responde; se forem perguntas diferentes, nao e a mesma regra.**
  **E o que a print mostrava nao era isso:** o desligado funcionou (nenhum modelo, nenhuma acao), e
  quem decidiu foi `nunca-pediram-dados` -> tecla 4, com o `pedir-dados` DELE (o de fabrica nao tem
  Instagram nem grupo). **Desligar anuncio nao alcanca texto de resposta pronta** — dito a ele.

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
- **ENDERECO DE MAQUINA nunca e cidade — e a terceira vez foi a que nao tinha origem para
  consertar.** Print da Maria Antonia (06/09/2026): o campo Cidade dela tinha **`vt.tiktok.com`**,
  um link que ELA mandou. As duas vezes anteriores (o Instagram em 02/09, o FAQ do WhatsApp em
  05/09) foram consertadas cada uma na sua origem; aqui nao ha origem — quem manda o link e a
  pessoa. Por isso a peneira virou FORMA: `cities.ehEnderecoDeMaquina` barra `://`, `www.`, dominio
  com sufixo, `@` e sequencia longa de digitos, e e consultada dentro de `naoPodeSerCidade`, que e
  por onde o modo generoso ja perguntava. **Metade das asercoes do teste e sobre o que NAO pode ser
  barrado** ("S.do Livramento", "Santo Antonio da Patrulha"): barrar municipio de verdade e o
  defeito oposto.
- **LIXO no campo Cidade nao conta como "o que ja esta no CRM", e sem isso a IA nunca era
  consultada.** Mesmo caso: ela escreveu *"Moro em Cachoeirinha..."*, o parser achava a cidade com
  confianca `exata`, e **nada acontecia** — `podeSubstituirCidade` exige `informada`, que so e
  verdade na resposta ao formulario ou na mensagem que E a cidade. Sem substituicao nao ha palpite
  PENDENTE, e sem palpite pendente nem a caixa abre nem `cidadeConferidaPelaIA` roda: *"a IA ficou
  responsavel por verificar a cidade, quando estiver no automatizado tem que resolver casos como
  esse"*. Hoje um valor do CRM que e endereco de maquina deixa o palpite `exata` passar — e **passar
  nao e gravar**: ele entra como pendente, e quem decide continua sendo a IA ou ele. **Cidade de
  outro estado ficou de fora de proposito:** "Curitiba" nao casa com os 497 mas e um lugar de
  verdade, e troca-la por uma cidade citada de passagem seria inventar.
- **O CLIQUE no anuncio so vale enquanto nao for respondido — e o modelo segue o clique.** Regra
  dele (06/09/2026), com quatro prints da Sirlene em ordem: *"o modelo so sai novamente no contexto
  do anuncio; se tiver resposta minha apos o anuncio, nao mandar"*. Ela clicou em 04/09, recebeu a
  mensagem do momento em 05/09 e de novo na manha de 06/09, escreveu *"10.122 ja esta anotado"* as
  12:31 e as 13:23 recebeu o MODELO institucional — *"o modelo tem sido mandado fora de contexto,
  achei que tinha sido arrumado mas continua"*. E a armadilha ja registrada (**o texto do anuncio
  fica na conversa para sempre**) chegando por outra porta: `state.anuncio` responde "de qual
  anuncio ela veio", e isso nunca deixa de ser verdade. Hoje ha `state.anuncioSemResposta`, que le
  **so a rajada** (o que ela escreveu desde a nossa ultima fala) e so aceita a `utm` quando ainda
  nao falamos nada na sessao — a `utm` e da SESSAO e nao tem horario proprio. **`state.anuncio`
  continua sendo quem aplica as etiquetas de origem**, que sao permanentes de proposito; o que passou
  a depender da resposta e o MODELO e o sinal `anuncioReconhecido` do quadro.
- **As guardas de tempo de `conteudo-pedido` eram todas sobre o MODELO, e nenhuma sabia que ja
  tinhamos falado hoje.** `enviadoHoje` e `modeloJaNaConversa` respondem "o modelo ja saiu?"; o que
  acontece quase sempre e outra coisa — a mensagem do momento sai de manha, a pessoa agradece, e a
  regra le a **etiqueta de conteudo** dela como se fosse um pedido de agora. **A etiqueta e
  permanente; o pedido e da rajada** (mesma distincao da `momentoJaEnviado` da Janete, 04/09). Hoje
  a regra exige `!respondidoHoje`, com duas excecoes que sao as duas coisas que ela acabou de pedir
  e ainda nao recebeu: **clique de anuncio sem resposta** e **material pedido** (05/09).
- **Isto REFINOU a decisao de 01/09, e o invariante dela continua de pe.** Naquele dia ele disse *"se
  continuar como na print o modelo nunca sera enviado porque esta concluindo apos resolver a
  pendencia"*, e o teste travava *"segunda passada MANDA O MODELO"*. O modelo continua nao ficando
  preso atras da pendencia — o que mudou e QUANDO ele se solta: na primeira passada de um dia em que
  ainda nao falamos, em vez de na segunda passada do mesmo dia. O que tornava aquilo um risco real
  era a caixa do cumprimento repetir a mensagem do momento a cada passada, e ela ganhou
  `excecao: momentoJaEnviado` em 03/09.
- **A CHEGADA nao tinha FECHO, e barrar o modelo revelou isso.** O ramo do retorno sempre terminou em
  `ja-respondemos-antes`, que nao olha o texto e por isso pega o que ninguem pegou; a chegada nao
  tinha nada disso — quem atravessava as vinte caixas sem casar saia da rodada **sem desfecho, em
  silencio**. Nao incomodava enquanto `conteudo-pedido` era largo o bastante para varrer o resto.
  Medido: com a guarda nova, 14 casos em 30.000 passariam a ficar sem desfecho, **todos ali**. Hoje a
  chegada termina em `ja-respondemos-antes` tambem, e a condicao dela virou
  `jaRespondemosAntes || respondidoHoje` — "ja respondemos antes" e "ja respondemos hoje" sao os dois
  lados da mesma coisa, e os ramos do retorno nao mudam porque quem chega neles ja tem o primeiro.
- **O id da CAIXA nao e o id da REGRA, e comparar por id nunca funcionou no quadro.** Print da
  Rosane (06/09/2026): ela respondeu o cadastro (nome e "Caxias do sul") e recebeu *"obrigado pelo
  APOIO e pelo carinho de sempre"*; ele apagou a mensagem. **O detector estava certo** —
  `soExpressaApoio` devolve null para o texto dela. O defeito era uma comparacao no painel,
  `sugestao?.id === 'respondeu-os-dados'`, que escolhia entre os tres textos da tecla `i`: no quadro
  o id e **`r:respondeu-os-dados:com-cidade`**, porque o `r()` do `fluxoPadrao` reescreve o id de
  proposito (a mesma regra vive nos dois ramos, e id repetido e o que `problemas` acusa). Medido:
  `false` em 100% dos casos — **o conserto de 2.65 nunca decidiu nada.** Somava-se `tambemQuando`:
  a caixa junta `respondeu-os-dados` com `so-expressa-apoio`, entao nem o id da caixa diria qual das
  duas casou. **Quem precisa saber "qual regra decidiu" tem que olhar o SINAL** (`c.respondeuOsDados`),
  como `ehPresencaSemPendencia` sempre fez tres blocos acima. Tem teste travando a armadilha.
- **VOTO DE BOA VONTADE nao e declaracao de apoio, e so conta se for a mensagem inteira.** Relato
  dele (06/09/2026), depois de eu listar as condicoes: *"muito vago esses termos e podem pegar em
  mais contextos, o que mais pode ser feito?"*. Medido antes de mexer: **15 de 19** frases plausiveis
  desta base davam apoio sem ser apoio — *"estou sem forca nenhuma, muito cansada"*, *"faca forca com
  o prefeito por nos"* (um PEDIDO), *"tentei falar com a prefeitura sem sucesso"*, *"Deus te abencoe,
  preciso de uma cesta basica"*, *"estou torcendo para conseguir a cirurgia"*. **A divisao e por
  NATUREZA:** "eu apoio", "conte comigo", "vou votar", "sou seu eleitor" declaram lealdade e sao
  dirigidos a NOS, entao valem onde estiverem; "forca", "parabens", "sucesso", "Deus te abencoe",
  "torcendo" sao votos de boa vontade — sozinhos sao carinho, e no meio de uma frase **quem decide e
  o resto da frase**. Depois: **0 falsos positivos, 0 apoios perdidos**. Entraram junto duas guardas
  do mesmo tipo — `vamos vencer` exige objeto politico ou ser a mensagem inteira (*"vamos vencer essa
  doenca"* nao e apoio), e `eleitor`/`fa` exigem o **seu** (*"sou eleitor de Caxias do Sul"* e
  endereco). E a terceira vez que este projeto aprende isto: a caixa do "so mandou bom dia" pegando o
  desabafo da Cris, e o "boa tarde queria saber mais" da Teresinha.
- **A TECLA 6 e a porta da IA, e no automatico ela ENVIA — entao "vai para a IA" nao e o mesmo que
  "vai para gente".** Print da Dima Souza (06/09/2026): 1min34 de audio transcrito — pensionista,
  viuva, cirurgia de 18 mil pela frente — e a rodada mandou uma mensagem que ele apagou. *"Bote
  transcricao desse tipo para IA ou eu atender sempre; o automatizado mandou mensagem ignorando o
  contexto do pedido de ajuda."* **O quadro estava certo**: medido nos dois quadros (o dele e o
  padrao), o caso da tecla 6 — nenhuma resposta pronta o alcanca. O que saiu foi o rascunho da IA,
  que com "Automatizar" marcada vai sozinho desde a 2.60. Hoje `rascunhoPodeSairSozinho` recebe os
  SINAIS do contato e barra os casos **sensiveis**: conversa longa ou audio, pedido de dinheiro,
  mal-estar, pedido sem objeto e recusa. **As duas travas antigas olham o TEXTO que voltou; esta
  olha o CASO** — nao e o rascunho que esta errado, e quem tem que decidir. O rascunho continua
  sendo escrito e posto no campo: o que volta a ser dele e o ultimo passo.
- **A pior alucinacao nao e o tom errado: e AFIRMAR que alguem ja fez alguma coisa.** Print da Sandra
  Grandini (06/09/2026): ela escreveu so *"E a respeito do material?"* e o rascunho respondeu *"Ja
  encaminhei seu pedido ao assessor da sua regiao para providenciar o material. Voce deve receber em
  breve."* Ele apagou: *"a IA alucinou ou ignorou contexto, ela nunca nos forneceu endereco entao nao
  tem como fazer entrega"*. **Nada daquilo aconteceu** — nao ha assessor designado, ninguem
  encaminhou nada, e sem endereco nao ha entrega. Medido antes de mexer: `revisarRascunho` devolvia
  **zero avisos** e o texto saiu sozinho. Hoje ha `AVISOS_QUE_IMPEDEM_ENVIO.afirmouAcao` (verbos de
  **encaminhamento e providencia**, nao de fala — *"ja falei sobre isso"* continua passando), a
  promessa passou a cobrir a voz DELA (*"voce deve receber"*, *"recebera"*, *"esta a caminho"*),
  `pedeMaterial` entrou nos casos sensiveis, e o prompt ganhou a **regra 5**, escrita como proibicao
  com os exemplos do caso real. **O que a IA pode dizer com verdade e o que ELE vai fazer depois de
  ler** — "vou verificar", "me diga o endereco".
- **A FRONTEIRA DE PALAVRA nao fecha depois de letra ACENTUADA, e nao so antes dela.** O padrao
  novo da promessa usava `\b` nas duas pontas de `(voc[êe]|vc|...)` e **nao casava com "Voce deve
  receber"**: `você` termina em `ê`, que nao e caractere de palavra em ASCII, entao a fronteira de
  fechamento nunca acontece. E a armadilha do *"É nós"* (31/08) do outro lado da palavra — la o
  problema era ABRIR com acento, aqui e FECHAR. **Use `(^|[^\p{L}])` com a flag `u` nas duas
  pontas**, que e como o resto do `cortesia.js` ja escreve. Peguei medindo: a trava estava escrita
  e devolvia zero avisos.

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

- **"GABINETE" saiu do vocabulario: e EQUIPE ou ASSESSORIA** (decisao dele, 07/09/2026). Trocar so o
  texto de FABRICA nao faz a regra chegar nele — as respostas dele estao GRAVADAS, e `store.get` so
  mescla default em chave que falta (a armadilha do `-contato-assessor`, 04/09). Por isso ha
  `templates.migrarGabineteParaEquipe` na fila do `list()`. **A concordancia e metade do trabalho**:
  trocar a palavra e deixar o artigo produz *"falando com o equipe"* saindo para eleitor, entao a
  lista casa a preposicao junto (`do`->`da`, `ao`->`a`, `nosso`->`nossa`), e o PLURAL vira
  **mandatos** (*"vale para todos os gabinetes"* fala dos outros parlamentares). **Nao foi trocado
  de proposito:** o nome interno (`store.ia.gabinete`, `gabinete.js`, o dossie) e o detector de
  `cortesia` que reconhece *"trabalhar no gabinete"* — ali a palavra e o que A PESSOA escreve. E
  **detector que casa a palavra antiga para de ver o caso**: `SE_APRESENTANDO` ganhou `equipe` e
  `assessoria` no mesmo commit, senao continuaria "funcionando" cego.

- **"QUERO FALAR COM O DEPUTADO": o encontro e na AGENDA, e a Assembleia esta fora de questao.**
  Regra dele (08/09/2026), com o print do pastor e o texto que ele digitou a mao: *"neste momento de
  eleicoes somente se encontrando com ele em algum evento da agenda, pedimos desculpas mas nada e
  repassado para o whats pessoal do capitao por motivos de seguranca"*. **A segunda metade e a que
  se erra sozinho:** *"fora de eleicoes tem a opcao de encontrar na assembleia mas agora esta fora de
  questao"* — oferece-la agora e abrir porta que nao abre, a familia do "procure a coordenacao"
  (07/09). A resposta pronta e `falar-com-deputado`, e o teste trava as tres AUSENCIAS dela: sem
  Assembleia, sem promessa de levar recado, e **sem `{{link_grupo}}`** (a agenda mora em
  `agenda-grupo`, e a variavel vazia BLOQUEIA o envio — o recado central nao pode depender de um
  campo da Config). O gatilho e `cortesia.pedeFalarComDeputado`, e **o que qualifica e o OBJETO ser
  ELE**: *"falar com voces"* e a conversa em curso, *"falei com o deputado ontem"* e passado, e
  *"me passa o whats dele"* nao tem verbo de falar e e o mesmo pedido.
- **QUALIFICADOR EM GRUPO OPCIONAL E QUALIFICADOR QUE NAO EXISTE.** Anotacao da Geci (06/09/2026):
  *"Tamo junto estaremos de maos dadas e venceremos amem"* fez a rodada PULA-LA como quem confirma
  presenca em evento — *"nao e evento, os termos estao muito vagos e sendo aplicados em contextos
  demais"*. O padrao era `(estarei|estaremos)(\s+(la|ai|presente|junto|com voces))?`: o `?` no fim
  torna o verbo sozinho suficiente, e a lista de qualificadores vira enfeite. **E a QUARTA vez que
  `confirmaPresenca` aprende isto** — sairam "vamos"/"vou" soltos (02/09), "confirmado" solto
  (04/09) e "pode contar comigo" (04/09). **Vocabulario de campanha nao e resposta ao convite**, e o
  verbo sozinho so vale como a MENSAGEM INTEIRA. Ao escrever padrao assim, pergunte o que ele casa
  com o grupo opcional vazio.
- **AVISO DA PLATAFORMA NAO E ARQUIVO ESPERANDO ALGUEM ABRIR.** Anotacao do Clovis (07/09/2026): a
  conversa era so *"*Atencao:* o tipo da mensagem enviada pelo contato nao e suportado."* e a caixa
  mandou responder a mao, *"mandou um audio — so da para responder depois de abrir"*. O ruido da
  plataforma **ja era** reconhecido (`prepararEntrantes` esvazia o texto e marca `sistema: true`,
  02/09); faltava a outra metade — a mensagem continua com o `tipo`, e `pedeRespostaPessoal`
  disparava por ele. Hoje `msg.sistema` devolve `null` ali. **Esvaziar o texto num lugar so nao
  basta se outro sinal decidir pelo TIPO** — e o motivo na tela era falso, que e a mesma razao do
  conserto do audio transcrito (01/09): nao ha audio para abrir, a plataforma disse que nao
  conseguiu entregar.
- **"NAO E LUGAR" NAO E O MESMO QUE "NAO RECONHECO", e a peneira que separa os dois e o
  VOCABULARIO.** Print do Sabino (08/09/2026): campo Cidade valendo **`transformar nosso pais`** —
  *"a extensao esta falhando em limpar ou corrigir cidades erradas"*. A limpeza da 2.93 so tratava
  lixo por FORMA (`ehEnderecoDeMaquina`), e frase comum ficava de fora com o argumento de que podia
  ser cidade de outro estado. **Verdade para "Curitiba"; falsa para uma frase com verbo dentro.**
  `cities.naoPodeSerNomeDeLugar` soma a segunda peneira: nome de municipio e substantivo proprio
  mais conector, e verbo, pronome e adverbio nunca aparecem. **A PROVA E CONTRA OS 5.571 MUNICIPIOS
  DO BRASIL, nunca contra os 497 do RS** — e foi ela que salvou a lista: contra o RS caia 1 falso
  positivo, contra o Brasil **21**, em tres classes que ninguem adivinha. **`Para` normaliza para
  `para`** e colidia com a preposicao (12 municipios); **`Patrocinio` E municipio** em MG, SP e PR;
  **`Sem-Peixe`** tirou `sem`; **`Nossa Senhora ...`** obrigou a guardar `nossa` e **`Mariano Moro`**
  a guardar `moro`. Depois: 0 em 5.571. `curl` na
  `servicodados.ibge.gov.br/api/v1/localidades/municipios` traz a lista inteira em um pedido — **rode
  a prova antes de acrescentar palavra**, o erro dela apaga a cidade de um eleitor real. A peneira
  vale em QUATRO pontos (a origem no `naoPodeSerCidade`, a limpeza, a substituicao e a leitura da
  conversa anterior), e continua fora do `somenteExatos`: apagar pede ato deliberado.
- **DA PARA MEDIR NA API DE VERDADE, pela aba dele — e "a tela mostra" nao e "o CRM tem".** Feito em
  07/09/2026, duas vezes, e as duas mudaram o diagnostico. **A receita:** o `page-hook` ja intercepta
  o Bearer; do lado da pagina, `postMessage({__whatsfill:'cs', type:'ping'}, location.origin)` e
  escutar a resposta `{__whatsfill:'page', type:'token'}` devolve o token — `window.postMessage`
  atravessa os mundos, entao funciona de qualquer contexto. Dai: `GET /chat/v1/message?sessionId=…`
  para as mensagens cruas, `POST /core/v1/contact/filter` com `{name:'<trecho>'}` para achar o
  contato e `GET /core/v1/contact/{id}?isToIncludeCustomFields=true` para ver **o que esta gravado**.
  **Foi assim que a leitura dele sobre a transcricao se mostrou invertida** e que a Cidade
  contaminada deixou de ser suspeita e virou fato. Duas disciplinas: **so leitura** (nunca escrever
  por ali), e **nenhum dado de eleitor entra em arquivo do repositorio** — o que se registra e a
  FORMA (chaves, tamanhos, confianca), nunca o conteudo. A API e lenta e tem limitador: ~10s por
  sessao, com pausa entre chamadas, e nada de varredura.
- **QUEM PERGUNTA RESPEITAVA O `pendente`; QUEM ESCREVE NAO SABIA DA MARCA.** Print de 07/09/2026,
  com ele dizendo *"contato novo e esse erro de cidade foi feito agora"*: o campo Cidade valia
  **`mais Apoiadores com patrocinio`** — um trecho da mensagem dele —, num contato aberto e
  concluido no mesmo dia. A cadeia, medida ponta a ponta: `extract.cityPositionGuess` devolve o
  **segundo pedaco depois da virgula** como palpite `nao-reconhecida` (sem casar com municipio
  nenhum, de proposito — ele existe para virar sugestao na tela e revisao na aba Cidades);
  `applyGuesses` marca `pendente: true`; **`confirmarCidadeSePendente` desiste em tres situacoes e
  volta sem mexer no rascunho** (palpite que nao e municipio, da 04/09; rodada automatica sem IA,
  da 03/09; e a pergunta que outra instancia ja esta fazendo); e o laco do `changes` **nao olhava
  `pendente`**. Medido: a palavra aparecia num lugar so do `panel.js`, dentro de quem PERGUNTA.
  **A guarda de 04/09 foi criada para PROTEGER** — tirar o palpite ruim da caixa — **e foi ela que
  abriu isto**: antes dela a caixa abria e o Esc apagava o rascunho. Hoje a regra inteira e
  `fields.deveGravarEntrada`, no **ponto unico de escrita**, com teste: saida nova de
  `confirmarCidadeSePendente` nao vira vazamento novo. Duas coisas a lembrar: a de 03/09 escrevia
  *"nao gravada"* no Andamento **e gravava** — log que mentia, e agora e verdade; e as duas vezes
  anteriores desta familia (`faq.whatsapp.com` em 05/09, `vt.tiktok.com` em 06/09) foram
  consertadas cada uma na sua ORIGEM, o que so funciona enquanto o valor tem FORMA que
  `cities.ehEnderecoDeMaquina` reconheca — aqui e frase comum, e **a origem certa do conserto era
  a escrita**. A licao de 06/09 (*antes de por trava na IA, prove que foi a IA*) valeu de novo: os
  candidatos que eu listei eram tres, e o culpado era o que eu tinha listado primeiro.
- **PROPOSTA COMERCIAL NAO ABRE PORTA, e "procure a coordenacao" e a porta que nao existe.** Regra
  dele (07/09/2026), sobre o contato que oferecia patrocinio: *"nada sera aceito agora em periodo
  eleitoral, os contratos que deviam ser feitos ja foram feitos"*. O rascunho tinha explicado a lei
  e mandado *"conversar direto com a coordenacao"* — e **nao ha coordenacao para conversar**: a
  frase promete uma conversa que nao vai acontecer, a familia da promessa de entrega. O que se faz
  no lugar e o que ele aprovou no ChatGPT: **agradecer o apoio e responder o resto**, silencio sobre
  a oferta. Duas metades: a **regra 7** do prompt e a trava `mandouProcurarNos`. **A trava e maior
  que o caso, e e por isso que ela e mecanica: quem escreve para o WhatsApp do mandato JA ESTA
  falando com a equipe** — manda-la procurar a equipe, a coordenacao ou a campanha e devolve-la para
  onde ela ja esta. A conferencia e **frase a frase** (sem isso, *"vou verificar com a equipe. Se
  precisar, procure a Secretaria"* casaria por pedacos de duas frases), encaminhar para FORA
  continua livre (prefeitura, CRAS, SINE) e a **primeira pessoa** tambem (*"vou verificar com a
  equipe"* e a frase que a regra 5 da como exemplo do que se pode dizer com verdade). Dez das vinte
  assercoes sao falso positivo.
- **REGRA QUE VIVE NO MEIO DE UM DOCUMENTO DE 3.804 TOKENS E REGRA QUE O MODELO PEQUENO NAO
  CUMPRE.** Print de 07/09/2026 (o contato que oferecia patrocinio): o rascunho saiu com ~880
  caracteres, virou aula sobre a lei eleitoral, e ele comparou com o ChatGPT — *"o problema e o
  modelo haiku?"*. **Medido: o item 22 do padrao DELE ja manda "mensagem simples: 1 a 3 frases"**, e
  o padrao e **75% do prompt de sistema** (3.804 de 5.005 tokens), entao a regra fica longe do ponto
  em que o modelo comeca a escrever. A saida e **citar a regra ao lado do pedido**, nunca reescrever
  o documento dele — mesma razao pela qual a saudacao e o relogio ficam no fim do bloco do contato.
  O teste exige que o item 22 continue existindo, senao a citacao vira referencia para o que sumiu.
  **E antes de culpar o modelo, separe as tres causas:** o que o prompt manda e nao e cumprido (aqui
  o modelo pesa), o que e OBRIGACAO nossa e o outro lado nao tinha (o pedido de dados sai por regra
  dele de 05/09), e o que o prompt manda e foi cumprido de forma pesada (o bloco da lei 9.504
  virando aula). **O custo por rascunho, medido:** Haiku US$ 0,0029 quente / US$ 0,0086 frio;
  Sonnet 5 o dobro; Opus 5 cinco vezes. A conferencia de cidade e US$ 0,0010 e nao cacheia (410
  tokens, muito abaixo dos 4.096). Trocar de modelo nao e a alavanca do gasto — volume de chamadas
  e, e o numero real esta no painel.
- **AUDIO ENCAMINHADO E CONVERSA DE OUTRAS PESSOAS, e a transcricao dele chega igual.** Print da
  Irene (07/09/2026): *"falhou em pegar o texto da transcricao"* — a rodada respondera sozinha
  *"deve ter dado ruim no audio, pode enviar de novo?"*. **Medido na API antes de mexer, e a leitura
  estava invertida:** os cinco audios chegaram COM transcricao (1.909 caracteres somados,
  `processing: false`, `error` vazio), e ela chegou inteira a IA. O que a IA fez foi **responder o
  conteudo de DENTRO de um audio encaminhado** — o ultimo do lote e uma pessoa dizendo a outra *"nao
  deu pra ouvir nada que voce botou ali, ta mudo?"*. **A assinatura do encaminhamento e o tempo:**
  cinco gravacoes de minutos entregues em dois segundos nao foram gravadas ali. E a mesma classe da
  legenda de repasse (o Eraldo, 06/09) — **pergunta que veio dentro do material que circula nao e
  pergunta para nos** —, so que aqui o que denuncia esta no conteudo, e nao no tipo da mensagem.
  Duas metades: `AVISOS_QUE_IMPEDEM_ENVIO.pediuReenvio` barra o envio automatico (mecanico, porque o
  painel SABE se chegou texto legivel dela — por isso e condicionado a `recebemosDela`: audio sem
  transcricao existe, e ai pedir para reenviar e a resposta CERTA), e a **regra 6** do prompt diz
  que audio circula. **E o lote passou a ser RECONHECIDO na 2.85, com o criterio que ele nomeou:**
  *"realmente nao e possivel audios com aquele tempo naquele espaco de tempo"*.
  `cortesia.marcarLoteEncaminhado` agrupa os audios seguidos e pergunta se o lote CABERIA na janela
  em que chegou — o primeiro pode ter sido gravado antes da janela, os outros nao, entao o minimo e
  **a soma das duracoes menos a do primeiro**. Tres coisas a lembrar: a API **nao devolve duracao**
  (o tempo na tela e o player lendo o arquivo), entao a conta usa `details.file.size` com
  **16.000 bytes/s**, o DOBRO da densidade medida (~8.200), para sempre errar para o lado de nao
  acusar; o relogio e o **`timestamp` do WhatsApp** e nao o `createdAt`, porque aparelho sem rede
  entrega tudo junto ao reconectar e so o `ts` continua espalhado; e vale **so para audio** — video
  ja e repasse, e a densidade dele acusaria dois videos quaisquer. A marca fica em
  `prepararEntrantes` (um lugar so) e acende tres coisas: a transcricao vai marcada para a IA,
  `ehRepasse` passa a valer, e a pergunta de dentro dela deixa de contar (a regra do Eraldo).
  **`pedeRespostaPessoal` continua verdadeiro de proposito:** reconhecer o encaminhamento nao pode
  virar atalho para a rodada responder sozinha — o caso continua indo para ele ou para a IA.
- **A IA inventa no PRESENTE tambem: "temos adesivos e camisetas disponiveis".** Print do Lucas
  Mendes (07/09/2026): ele perguntou *"como faco para conseguir um bone ou acessorio"* e o rascunho
  abriu afirmando o estoque — *"a IA confirmou algo sem saber"*. E a irma do caso da Sandra (06/09)
  com o verbo trocado de tempo: la a invencao era sobre o passado (*"ja encaminhei"*), aqui e sobre
  o que EXISTE. Nada no prompt fala de material fisico, e a pergunta era justamente como conseguir.
  Hoje ha `AVISOS_QUE_IMPEDEM_ENVIO.afirmouTer` e a proibicao escrita na regra 5. **A guarda que
  sustenta a regra e a NEGATIVA**: *"nao temos adesivos para enviar"* e o texto CERTO para esse
  caso, entao a negacao vence e e testada antes. E **"material" ficou de fora de proposito**: nesta
  base *"quero receber o material"* e conteudo DIGITAL, o pedido mais comum que chega.

- **A EXTENSAO DISPARA `Escape` NO DOCUMENT — entao atalho de Esc que nao confere `isTrusted` e
  atalho que ela aperta sozinha.** Relato dele (07/09/2026): *"mesmo erro, comecou e parou sem eu
  mandar"*, com o log dizendo **"voce parou a rodada pelo Esc"** numa rodada em que ele nao tocou no
  teclado. A causa esta escrita no proprio projeto: `dom.fecharOverlay` e `hsm` fazem
  `document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}))` para fechar menu e dialogo
  do Material — **em toda passada que envia**. O evento borbulha e chega em todo mundo que escuta.
  **`isTrusted` e a leitura exata**: teclado de verdade vem `true`, `dispatchEvent` vem `false`.
  Estava faltando em QUATRO lugares (o controle da rodada, a caixa da pergunta — onde Esc significa
  parar a rodada desde sempre —, o editor da Config e o editor de resposta), e vale tambem para o
  Esc que a plataforma vier a disparar amanha.

- **A CONVERSA ANTERIOR tem ROTA, e o botao da tela E essa rota.** Lido no bundle em 07/09/2026, a
  pedido dele: o `h-button` "Ver conversa anterior" emite `loadPreviousEvent`, e quem atende chama
  **`GET /chat/v1/session/{id}/previous`** (devolve o id da anterior, e e ele que LIGA o botao:
  `hasMorePrevious = id != null`) e so entao `GET /chat/v2/session/{id}`. **Nao e preciso clicar em
  nada** — com o id, `getMessages(id)` faz o resto, paginado e testado. **A CADEIA e o que ele
  chamou de "multiplas instancias"**: carregada uma, o app pergunta o `/previous` DAQUELA e o botao
  reaparece; a regra dele e **uma abertura so**. O que vem de la e palpite de CADASTRO rebaixado e
  **nao entra em `state.incoming`/`state.entrantes`** — eles sao a memoria DESTA sessao, e a rajada,
  o tempo e o "ja respondemos" decidem sobre eles. **O corpo do `/previous` nunca foi visto ao
  vivo** (a API recusa origem de fora da aba): o leitor aceita string, string entre aspas e objeto
  com `id`, e qualquer falha vira "nao ha anterior" — que e o caso normal, e o proprio app pede essa
  rota com `suppressError`.

- **AS TRES RODADAS TEM UM MOTOR SO — e o que envelhece hoje e o AVISO, nao a decisao.** Medido em
  06/09/2026 a pedido dele (*"veja se a automatizacao dos outros esta atualizada"*): **Meus** e
  **Outros** chamam a MESMA funcao (`processarRespondido`), e **Novos** (`processarNovo`) assume e
  delega para ela. `processarRespondido` **nao recebe a aba**, e nada no caminho da decisao pergunta
  em qual fila esta — entao conserto de regra chega nas tres de graca, e a armadilha de 03/09 (*"a
  rodada dos Novos era um motor a parte"*) esta fechada. **O que NAO e comum e a tela:** cada rodada
  tem o seu `confirm`, e `rodadaAutomatica()` le `cfg.automatizarComIA` sem olhar a fila — a caixa
  "Automatizar a rodada" faz a rodada dos **Outros** enviar e concluir sozinha, e o aviso de la
  dizia *"voce decide contato a contato"*, que e falso com ela marcada. **Nos Outros isso e mais
  grave que nas outras filas: o atendimento e de outro operador.** Ao criar rodada nova, herde o
  motor E confira o que o `confirm` dela promete.

- **A causa que ELE aponta pode ser a metade certa de um defeito com duas metades.** Print da Maria
  Antonia (06/09/2026): perguntou *"o senhor e candidato a qual partido"* no dia 05, mandou um link
  do TikTok no dia 06, e recebeu a mensagem do momento. *"ignorou por causa do link no final"* —
  verdade: `ultima-e-so-reacao` fica acima de `pergunta-aberta` e olha so a ULTIMA mensagem. **Mas
  ao medir, os dois detectores de pergunta devolviam FALSE para a frase dela**: sem "?", a guarda de
  posicao so aceita o padrao ABRINDO a mensagem, e ela abriu com "Boa noite capitao". Consertar so a
  ordem teria deixado o caso dele igual e a print voltaria. **Meça o SINAL antes de mexer na ORDEM:
  caixa que perde e problema de posicao; sinal falso e problema de deteccao, e os dois produzem a
  mesma print.** O que subiu para `PERGUNTAS_INEQUIVOCAS` foi so o "qual" + substantivo (posicao,
  opiniao, proposta, partido, numero, cargo) — a guarda de posicao existe pelo "pq", que e conjuncao
  disfarcada, e "qual" nunca e. Junto saiu o terceiro buraco: **"gostaria DE saber" nunca casou**,
  porque `PERGUNTA_DECLARADA` exigia o verbo colado em "saber" — a licao do "trabalhar NA campanha"
  outra vez, a preposicao e o adverbio sao pecas separadas.

- **A caixa pode CASAR e mesmo assim perder — e o mesmo sintoma tem as duas causas.** Print da
  Leonilda (06/09/2026), horas depois da Noeli e com a mesma frase dele: *"aconteceu a mesma coisa,
  bom dia depois modelo"*. Aqui `contexto-de-outro-dia` casava; ela **perdia para o grupo do anuncio
  reconhecido**, que estava logo acima no bloco de quem retorna. **O sinal que separa as duas causas
  e o QUADRO CONTRA A TABELA**: medido no contexto dela, o quadro dava tecla 1 e `sugerirAcao` dava
  5 — discordancia entre os dois motores e problema de POSICAO; os dois concordando no desfecho
  errado e problema de CONDICAO. Meça os dois antes de escolher onde mexer. O conserto foi mover o
  tempo para cima do grupo do anuncio **so no bloco de quem retorna**: o argumento da posicao antiga
  era o RECIBO (*"um clique de ontem continua sendo um pedido"*), e neste bloco o clique dela ja foi
  respondido. Na CHEGADA continua abaixo do recibo. Excecao dele que nao depende disso: o material
  pedido, que mora na CONDICAO.

- **Guarda na CONDICAO faz a caixa sair da frente — e quem entra no lugar pode ser justamente quem
  ela existia para impedir.** Print da Noeli (06/09/2026): escreveu no dia 05 e recebeu **o modelo
  da campanha** no dia 06 — *"ignorou a regra da perda de contexto e mandou modelo"*. A regra nao
  foi ignorada: **nao casou**. As duas guardas do momento moravam na `quando`, e o comentario que eu
  escrevi em 04/09 dizia com todas as letras que sem elas *"o quadro decide como antes"* — e decidir
  como antes, ali, e mandar o modelo. **O desenho certo ja estava em `ultima-e-so-reacao` e
  `ja-respondemos-antes`: a guarda decide o DESFECHO (tecla 5 ou 3), nao se a caixa casa.** Regra
  geral: **antes de por uma guarda na condicao, pergunte quem decide quando ela barrar** — se a
  resposta for uma caixa que ENVIA, a guarda tem que virar desfecho. Mexeu na funcao `tecla`? O
  `ramos` do verbete entra no mesmo commit, senao `regrasComDesfechoIncoerente` acusa.

- **"Nunca concluir com pergunta em aberto" tem que valer em TODA caixa que conclui — e faltava em
  `respondeu-os-dados`.** Print da Mari (06/09/2026): respondeu ao formulario por audio (*"Boa
  tarde, tudo bem com voce? Sou de Caxias do Sul."*) e recebeu *"Obrigado de coracao pelo apoio e
  pela confianca"*, com o atendimento fechado em cima do *"tudo bem com voce?"*. A regra e dele, de
  03/09; `ja-respondemos-antes` ganhou a guarda naquele dia e esta caixa, criada em 02/09, ficou sem
  — **o sintoma e invisivel**, porque a resposta sai educada e a pergunta morre junto com o
  atendimento. **Ao criar caixa que CONCLUI, a pergunta e "o que impede fechar em cima de uma
  pergunta?"** — a irma da pergunta de 03/09 sobre teclas fixas ("o que impede a segunda vez?").
  Custo dito a ele: `perguntaPendente` conta "tudo bem?", que e metade das respostas ao formulario.
- **Tecla que serve a TRES situacoes escolhe o texto junto do rotulo.** A tecla `i` mandava
  `agradecer-apoio` para quem so deu a cidade — o texto certo (`agradecer-info`) existia e nenhuma
  regra o alcancava, a armadilha do `pedido-emprego` de novo. Hoje sao tres: presenca confirmada,
  resposta ao cadastro, apoio; a regra decide o DESTAQUE e o painel decide o TEXTO.

- **A LEGENDA de um repasse nao e pergunta para nos.** Print do Eraldo (06/09/2026): video
  encaminhado com a legenda *"Voce e Patriota? Entao coloque este Video nos grupos !"* caiu em
  `pergunta-aberta` (tecla 6) e a IA escreveu uma resposta longa sobre recursos de terceiros — ele
  apagou. *"pergunta com link usa a regra de mandar mensagem do momento ou agradecer as informacoes
  e encerrar"*. A pergunta da legenda e RETORICA e nem e dirigida a nos: ela veio escrita no
  material que circula em grupo. **Nao e o conserto de 05/09** (`semLinks` tirava o "?" da query
  string; aqui a interrogacao e texto de verdade — o que a desqualifica e o que ela acompanha).
  **O corte e VIDEO ou LINK, e nao figura**, o mesmo de `ehRepasse`: figura nesta base tambem e a
  foto do exame e do documento, e *"olha meu exame, voces ajudam?"* continua sendo pergunta. Uma
  assercao de 05/09 foi INVERTIDA por isto, com o motivo escrito no teste.

- **GENERO: na duvida, neutro — e o nome do cadastro NAO serve para deduzir.** Print da Marli
  (06/09/2026): a IA escreveu *"Voce esta COBERTO de razao em cobrar"* para uma contato chamada
  Marli. O sinal confiavel e como ela fala de si na conversa (*"obrigada"*, *"cansada"*); o nome do
  cadastro e o MESMO que a regra 1 manda nao usar porque erra demais — confiar nele para deduzir
  genero seria confiar, para uma coisa, no dado que nao se confia para outra. **Ficou no PROMPT, e
  nao virou aviso**, porque a disciplina de `revisarRascunho` e: mecanico vira conserto, verificavel
  vira aviso, o resto fica no prompt — e aqui **sem saber o genero o aviso tocaria tambem nos
  rascunhos certos**, inclusive quando a IA acerta o feminino. Os exemplos de contorno vao escritos
  ("coberto de razao" -> "tem toda razao"): mandar "escreva no neutro" sem mostrar como deixa o
  modelo no masculino, que e o padrao dele em portugues.

- **`atendimento.PADRAO_DE_ATENDIMENTO` e um DOCUMENTO DELE, como o `fluxoPadrao` — nao altere sem
  ele pedir.** Entregue em 06/09/2026 (*"a IA deve seguir esse padrao para responder"*), 37 secoes,
  e virou o corpo do prompt de sistema do rascunho. **Arquivo proprio** porque `ia.js` e mecanica e
  isto e conteudo; **constante e nao arquivo lido**, porque o prompt de sistema leva `cache_control`
  e o cache so pega enquanto o prefixo for identico — leitura de arquivo tem estados, e cada estado
  seria um prompt diferente. **O que FICA escrito fora dele** e o que ele nao cobre: nao chamar pelo
  nome (10/08), nada de `{{variaveis}}`, o formato de saida e a lei 9.504/97 nomeada. **Um conflito
  real, resolvido a favor dele:** o prompt antigo mandava encaminhar ao CRAS no pedido de ajuda, e o
  padrao poe *"Procure o CRAS"* na lista do que NAO dizer (soa a minimizacao) — a instrucao saiu, e
  o TEXTO PRONTO `pedido-ajuda`, que lista SINE e CRAS com detalhe, nao foi tocado: e dele.
  **Efeito medido no custo:** o prompt foi de 1.169 para 4.715 tokens e **cruzou o minimo de cache
  do Haiku (4.096)** — cache quente custa US$ 0,0022 contra US$ 0,0029 de antes; frio, US$ 0,0076.

- **As TRES NEGATIVAS saem uma vez por contato, e nunca mais.** Print da Cleonice (06/09/2026): ela
  ja tinha recebido a negativa de ajuda financeira, mandou um audio longo e recebeu a MESMA negativa
  de novo — ele apagou a mensagem na plataforma. *"so deve ser mandado uma vez"*. **O detector nao
  estava errado**: `pedeAjudaFinanceira` le a RAJADA, ela pediu de novo, o sinal ficou verdadeiro de
  novo. O que faltava e que **dizer "nao podemos" duas vezes nao e responder, e repetir**. A trava
  (`negativaJaSaiu`) mora no SINAL e nao numa excecao da caixa, porque as caixas do pedido de
  dinheiro sao DELE: excecao nova so chegaria depois de ele importar o fluxo, e esta precisa valer
  hoje — mesmo desenho do `apoioTrava`. Pergunta a CONVERSA (a mensagem sai tambem pela mao dele, e
  a que ele APAGOU continua contando). **A segunda metade do pedido veio de graca:** barrada a
  repeticao, o caso desce sozinho para `ultima-pede-resposta-pessoal` (tecla 6), que era o outro
  pedido dele (*"o contexto tambem pedia resposta minha ou de IA por ser conversa extensa"*) —
  **sem reordenar nada**, e reordenar seria caro: por "conversa longa" acima do pedido de dinheiro
  mandaria para ele todo audio de quem pede socorro, inclusive na primeira vez.

- **O RASCUNHO DA IA VOLTOU A SAIR SOZINHO — decisao dele, e ele ja tinha cortado isto uma vez.**
  Print de 06/09/2026: *"o box de IA esta ligado, entao aqui deveria chamar a IA para escrever e
  enviar"*. **Antes de mudar comportamento, conferi: a IA NAO estava ligada** — o que estava marcado
  era "Automatizar a rodada", e a prova estava na propria print (o aviso *"com a avaliacao por IA
  desmarcada..."* so aparece nessa combinacao). **A tela era a culpada, por dois defeitos meus:** o
  aviso mandava procurar a caixa na aba Config, de onde ela saiu uma hora antes; e a caixa da IA
  morava DENTRO do cartao dos Novos, longe do botao "Comecar pelos Meus". `ia.ligada` e chave unica
  e vale para as duas filas — hoje o interruptor e um so, no topo da aba. **O comportamento novo:**
  com as duas caixas marcadas, o rascunho e ENVIADO sem perguntar; isto atravessa a fronteira "o que
  sai e byte a byte um texto que ele escreveu", que era o que tornava o erro recuperavel. As travas
  que ficam sao duas e estao em `ia.rascunhoPodeSairSozinho`: **marcador esquecido** e **promessa de
  entregar** (Lei 9.504/97). Sao CONSTANTES comparadas por identidade — reescrever o texto do aviso
  sem reescrever a trava a faria deixar de casar em silencio. **E ha agora um SEGUNDO ponto de saida
  de mensagem** (`page.sendText` direto, texto livre nao passa por `sendTemplate`): a marca do
  endereco foi copiada para la, porque e por invariante do texto e sem ela o caso de material some
  da lista dele.

- **Mudou o papel de uma funcao? A TELA que a descreve envelheceu junto.** Pedido dele (06/09/2026),
  quatro horas depois da 2.58: *"confira se os botoes de ligar a IA seguem essas regras"*. A aba
  Config ainda dizia *"a IA le a conversa e ESCOLHE entre as suas respostas prontas"* e *"ela nunca
  escreve o que sai"* — verdade de manha, mentira a tarde, e **do tipo que continua parecendo
  verdade**. Junto saiu o botao *"Avaliar o contato aberto"*, que testava o caminho morto (previa um
  desfecho que o painel nao produz mais: botao de teste assim da confianca na coisa errada), e com
  ele `avaliarComIA`, que ficou sem chamador. **A armadilha da remocao:** o CUSTO por chamada era
  escrito dentro de `avaliarComIA` — sem move-lo para `rascunharParaEle` o painel ficaria sem numero
  de gasto nenhum. **Ao apagar uma funcao, procure o que so ela fazia de util.** E o interruptor
  duplicado da IA (Config + Automatizado, mesma chave) virou um so, na tela em que ele aperta
  "Comecar".

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

- **A TABELA E A ARVORE SAO DOIS MOTORES, E MOVER A REGRA NUMA NAO MOVE NA OUTRA** (14/10/2026, duas
  prints: o limite de 48h nao decidia nada). **A v3.152 moveu `contexto-de-outro-dia` de 20o para 7o
  em `sugestao.js` (a LISTA) e nao moveu a caixa em `arvore.fluxoPadrao()` (a ARVORE).** A lista so
  decide quando NAO ha quadro; **a arvore e o motor sempre que ha** — e ele tem quadro desde
  02/09. A regra que ele pediu nunca rodou uma vez.
  **Mexeu na ORDEM de `REGRAS`? Mexa no `fluxoPadrao` no mesmo commit** (sao TRES lugares: chegada,
  retorno sem cidade, retorno com cidade), regere `tools/fluxo-padrao.json` e **diga a ele que
  precisa IMPORTAR** — padrao novo nao entra no quadro dele sozinho.
  **E A MINHA MEDICAO CONFIRMOU O ERRO EM VEZ DE PEGA-LO:** montei o ctx a mao com
  `pedeRespostaPessoal: null`, e o painel compoe esse sinal como `conversaPedeRespostaPessoal ||
  pedeRoupa || pedeMaterialEscrito || falouAlgoProprio` (panel.js:9538) — era o `falouAlgoProprio`
  que casava. **Reconstrucao de contexto COPIA a composicao do painel, nunca a funcao de nome
  parecido**, senao se mede a propria suposicao. Com a composicao certa os dois motores
  DISCORDARAM, que e a assinatura de problema de posicao.
  **"EM DIA COM O PADRAO" ERA AFIRMACAO FALSA:** `diferencaDoPadrao` so comparava PRESENCA, e no
  quadro **a ordem E a prioridade** — mudanca so de ordem era invisivel com a tela dizendo que
  estava tudo em dia. Hoje ela devolve `foraDeOrdem`, o **conjunto MINIMO** (o que sobra da maior
  subsequencia comum): listar todo par invertido num quadro de 60 caixas seria o alarme que toca
  sempre, porque o arranjo e dele. Nao e erro, e informacao.

- **O VERBETE PROMETE UMA POSICAO, E E POR ELE QUE ELE DECIDE ONDE POR A CAIXA NO QUADRO**
  (14/10/2026, print: *"nao foi aplicada o limite de 48 horas, e o fluxo que faltou atualizar?"* —
  clique do anuncio em 03/10, resposta da IA em 14/10, onze dias depois).
  **Medido primeiro, porque as duas causas dao a mesma print:** `contextoPerdido` = true, o campo
  `horasContextoPerdido` chega nele (`auto` esta na mescla e nao e por candidato), **a tabela e o
  quadro PADRAO concordam em `contexto-de-outro-dia` -> tecla 5**, e o texto que saiu e **byte a
  byte** `ia.PEDIDO_DE_DADOS_NO_RASCUNHO`. Motores concordando no desfecho CERTO = o codigo decide
  bem; quem decidiu foi o QUADRO dele, com a caixa na posicao antiga.
  **O defeito meu:** `SOBRE['contexto-de-outro-dia']` ainda dizia que as excecoes estavam na
  condicao (sairam na v3.153) e que a caixa ficava *"ABAIXO de tudo o que precisa de voce"* (a
  posicao de antes da v3.152). **E este texto que ele le na janela para decidir a ordem do quadro:
  prosa velha aqui vira ordem errada la.** A regra *"desfecho que envelhece vira mapa mentiroso"*
  vale para o `quando`, nao so para os `ramos`.
  **Trave a AFIRMACAO, nao a frase:** o teste percorre as regras ACIMA da caixa do tempo e exige que
  nenhuma tecla alcancavel ali ENVIE conteudo. Ele falhou na primeira vez e estava certo —
  `etiqueta-dispensa-da-fila` e `depende` (o engajado recebe a do momento uma vez por dia, 03/09):
  as teclas acima sao `s`,`2`,`3`,`6` ou a propria `5`, **nunca `1`, `4` ou `a`**.
  **E O CARTAO "O PADRAO MUDOU?" NAO ACUSA CAIXA QUE SO MUDOU DE LUGAR:** `diferencaDoPadrao`
  compara PRESENCA (`faltando`/`sobrando`) por chave de conteudo, e no quadro **a posicao E a
  prioridade** — entao mudanca que e so de ordem (a v3.152 inteira) e invisivel para ele. Nao foi
  consertado de proposito: listar toda inversao entre o padrao e o quadro seria o alarme que toca
  sempre, porque aquele arranjo e dele. **Mexeu na ORDEM do `fluxoPadrao`? Diga a ele em texto —
  o cartao nao vai dizer.**

- **A RODADA REMOVE AS ETIQUETAS QUE ELE LISTAR, E A POSICAO E TUDO** (14/10/2026: *"crie um espaco
  no automatizado para remover etiquetas, as etiquetas que eu listar nesse espaco devem ser
  removidas"*; de QUEM elas saem foi escolha dele: **"de quem a rodada atender"**).
  **A remocao vem logo depois do `load()`, antes de TODA saida antecipada** de `processarRespondido`
  (canal removido, barreira do candidato, contato ja tratado, erro de ambiente): **a etiqueta mais
  provavel de ele listar e justo uma das que fazem a rodada PULAR** — a de material pula para sempre.
  Depois da decisao, a lista nao funcionaria nos casos para os quais ele a criou. **E o defeito do
  canal removido (14/10) com outro nome — meca a ORDEM, nao so o sinal (quinta vez).**
  **Custa ZERO em quem nao tem nenhuma delas:** `applyTags` devolve `skipped` sem requisicao quando a
  uniao nao muda, e `lote.etiquetasQueSaem` pergunta antes de chamar.
  **DESMARQUE o que saiu em `state.tagSuggestions`:** `saveClassification` grava no fim da passada o
  que esta marcado la, e cidade/COREDE/conteudo nascem marcadas — sem isso a mesma passada remove e
  regrava, com **o Andamento dizendo que removeu**. Elas voltam na passada SEGUINTE porque sao
  DERIVADAS do cadastro, e o cartao diz isso: listar etiqueta de cidade e guerra perdida.
  **SONDA de uma releitura por RODADA** (`lote.etiquetaSaiuMesmo`), tres estados: `ainda-la` PARA a
  rodada (o 200 mentiu), `nao-da-para-saber` segue com aviso, lista vazia depois e `removido`. **O
  veredito e DEVOLVIDO, nunca escrito em `state.auto.parar`** — aquela bandeira e a do botao "Parar"
  dele, e o log culparia a remocao quando ele mesmo apertasse.
  **Nome fora do CRM aqui AVISA e segue**, ao contrario da lista de PULAR, que recusa a rodada: la o
  nome errado faz **alguem RECEBER** um disparo; aqui so deixa a etiqueta onde estava.
  **O preco esta na tela:** listando a etiqueta de SEM INTERESSE ou de assessor, ela deixa de
  proteger na mesma passada. **O disparo NAO remove** (nao carrega o contato, e a etiqueta dele e o
  que impede o reenvio). `colisaoDeRemocao` acusa etiqueta que esta nesta lista E num campo que a
  rodada aplica. **E a CONSEQUENCIA depende de QUEM aplica — a primeira versao do aviso errou
  isso** (print dele, 14/10, com *"1 TESTE DISPARO"*): so as QUATRO da rodada do fluxo saem e voltam
  "em toda passada"; a do DISPARO (`auto.etiquetaLote`) e aplicada em `processarLote`, outra rodada,
  e o preco dela e o oposto — **ela e a memoria que impede o reenvio**, entao tira-la devolve a
  pessoa para os proximos lotes. O aviso NOMEIA o campo, em vez de mandar procurar entre cinco.
  A conferencia **nao enxerga** a tabela "Etiqueta por palavra do que saiu" (chave propria, fora de
  `auto`), e a tela diz isso.

- **AS DUAS EXCECOES DO LIMITE CAIRAM NO MESMO DIA, POR DECISAO DELE** (14/10/2026: *"pedido de
  material e so para periodo eleitoral e ja acabou, e pergunta pendente apos 12 dias e melhor
  ignorar"*). Eram DELE e viveram cinco semanas — o material (05/09) e a pergunta (04/09) —, e caem
  pelo mesmo motivo, que e do mundo e nao do codigo: **a eleicao acabou em 04/10**. A regra virou o
  que ele pediu desde a primeira frase: **passado o limite, o fluxo nao decide mais nada.**
  **A unica guarda que fica e MINHA e esta dita a ele:** quem so se DESPEDIU nao recebe a mensagem
  do momento.
  **E eu movi a caixa na CHEGADA e DESFIZ:** o recibo do anuncio hoje e material de campanha de uma
  eleicao encerrada, entao o argumento de por o tempo acima dele estava certo — **e a edicao estava
  errada**, porque aquela posicao e do QUADRO (04/09) e **reordenar o quadro dele por conta propria
  e o que este projeto nao faz**. Revertido, com o porque gravado no teste. Quem chegou pelo anuncio
  ha doze dias e nunca recebeu nada continua recebendo o recibo, e mudar isso e decisao dele.

- **48 HORAS: PASSADO O LIMITE, SO A MENSAGEM DO MOMENTO — E MUDAR A REGUA NAO BASTAVA**
  (14/10/2026: *"estou respondendo mensagens de 12 dias atras (...) bote um limite de 48 horas para
  seguir o fluxo normalmente, senao mandar mensagem do momento"*). A regra do tempo JA existia
  (`contexto-de-outro-dia`, 04/09) e ja mandava a do momento; o que ela nao fazia era **vencer** —
  era a **20a** da lista, entao doze dias ainda caiam em `nunca-pediram-dados`,
  `anuncio-modelo-e-dados`, `pergunta-aberta` e `ultima-pede-resposta-pessoal`. **Medir o sinal nao
  basta: meca a ORDEM** (segunda vez em dois dias).
  **A regua virou HORAS** (`cortesia.contextoPerdido`) e o limite e campo (`auto.horasContextoPerdido`,
  nasce em 48, `0` desliga) — numero que ele ditou nao vira constante (licao do teto de 45, 02/10).
  **`deOutroDia` NAO foi removida:** ela e sinal do QUADRO, e sinal que some do codigo e descartado
  de quadro ja exportado — o ramo dele sumiria sem ninguem pedir.
  **A caixa subiu para a 7a posicao**, logo abaixo das seis protecoes que nao enviam nada.
  **Tres excecoes vencem o limite:** pergunta pendente e material pedido (dele, 04 e 05/09) e quem
  so se DESPEDIU (minha, dita a ele). **`perguntaAberta` teve de entrar junto de `perguntaPendente`:**
  sao chaves diferentes, e subindo acima de `pergunta-aberta` a excecao dele valeria pela metade.
  **Inversao que e escolha dele:** *"pediu algo sem dizer o que"* passou a PERDER para o tempo.
  **Duas armadilhas na mesma edicao:** escrevi `!c.ehDespedida` e a chave do painel e
  `ultimaEhDespedida` (regra que le chave que o painel nao escreve esta MORTA e o teste nao ve —
  18/09); e o verificador de **caixa morta** acusou as tres caixas do padrao assim que o sinal mudou
  de nome, porque **o amostrador de contextos do teste tambem lista os sinais** — sinal novo entra
  la tambem, senao as caixas que so ele aciona aparecem como mortas.

- **A BARREIRA DO CANDIDATO PULAVA O CANAL REMOVIDO ANTES DE A OPCAO DE CONCLUIR EXISTIR PARA ELE**
  (14/10/2026, print dele: *"nao esta concluindo"*, com a plataforma marcando **"Canal removido"** e
  o atendimento dizendo *"no canal null"*). **Numero removido da conta nao esta em candidato nenhum
  POR DEFINICAO**, entao `situacaoDoCanal` devolvia `desconhecido` e a barreira de 25/09 — que roda
  no comeco de `processarRespondido` — **pulava o contato antes de o bloco do canal removido rodar**.
  A opcao estava escrita, a caixa marcada, e o codigo nunca era alcancado. **E a tela mandava "some o
  numero ao candidato certo na aba Config": arrumar um cadastro que nao tem conserto.**
  **O conserto e de ORDEM:** o bloco do removido subiu para antes da barreira, logo depois do
  `load()`. A barreira continua certa para o que foi escrita — numero que EXISTE e e de outro
  candidato, ou que ainda nao foi cadastrado. **Removido nao e cadastro faltando.**
  **A licao, pela quarta vez: guarda nova so vale onde ela e ALCANCADA** — familia do *"excecao so
  vale onde aquela regra alcanca"* (09/09) e do *"a caixa pode casar e mesmo assim perder"* (06/09).
  **Medir o SINAL nao basta: meca a ORDEM.** O veredito estava certo; quem decidia era outra coisa,
  tres mil linhas acima.

- **"CANAL REMOVIDO" E "CANAL FORA DO AR" SAO ESTADOS DIFERENTES, COM DESFECHOS OPOSTOS**
  (14/10/2026: *"adicione a opcao de concluir no automatizado quando o canal estiver removido"*).
  **Fora do ar volta**, entao o certo e PULAR e esperar — concluir ali apagaria da fila quem nunca
  recebeu nada, e e o que a trava de 01/10 faz. **Removido NAO volta**: o numero saiu da conta, nao
  ha por onde mandar, e pular deixa o atendimento aberto na fila **para sempre**.
  **E a conferencia tem de ser pela API, nao pela tela:** a trava velha le a TARJA
  (*"desconectado da Z-API"*), que fala do outro caso — e **numero removido pode nao gerar tarja
  nenhuma**, entao a rodada seguiria e tentaria enviar por um canal que nao existe. Quem responde e
  `GET /chat/v4/channel/my` contra o `channelId` da sessao, e por isso o bloco novo vem **ANTES** do
  da tarja em `processarRespondido`.
  **TRES ESTADOS, NUNCA DOIS:** `lote.canalSumiuDaConta` devolve `removido`, `esta-la` e
  **`nao-da-para-saber`** — a licao do `donoDoCanal` (25/09) e do `undefined !== 'CONNECTED'`
  (01/10). Este veredito manda **CONCLUIR**, que escreve no CRM e tira a pessoa da fila: colapsar
  *"nao consegui ler"* em *"removido"* concluiria contato por causa de erro de rede, em silencio.
  **Lista VAZIA tambem nao e "todos removidos"** — conta sem canal e possivel, resposta vazia por
  erro e muito mais provavel, e o preco de errar e concluir a fila inteira. Metade das doze
  assercoes e sobre o que NAO pode virar "removido".
  **Uma requisicao por RODADA, nunca por contato** (`canaisFrescos`, 5 min de frescor, atualizando
  `state.canais` de graca) — e **lista velha nao decide conclusao**: canal criado no meio-tempo
  pareceria removido.
  **`primaria` e so realce de tecla** — conferido antes de por "Concluir" em destaque:
  `perguntarNaRodada` so desenha e espera, quem decide sem perguntar e o chamador. A caixa
  `auto.concluirCanalRemovido` nasce **desligada** e **depende de "Automatizar"**, e o rotulo diz
  "na rodada automatica" em vez de prometer efeito que ela sozinha nao tem.
  **So entrou em `processarRespondido`** — as tres filas usam esse motor, entao chega nas tres de
  graca; as duas rodadas de "sem retorno" ficaram como estavam, escondidas desde 15/08.

- **A "DATA DE CONCLUSAO DO CONTATO" GUARDA O PRIMEIRO CONTATO DESDE 07/10/2026, E SO ANDA PARA
  TRAS** (pedido dele: *"preciso que a data de conclusao permaneca a data da primeira vez que a
  pessoa entrou em contato, e se possivel arrumar todas as datas ao atender"*).
  **Foi barato porque a data NAO e mais sinal da rodada:** ela alimentava `jaRespondemosAntes` e
  **saiu em 05/09** (a print da Neiva). Conferir isso antes de escrever linha e o que tornou a
  mudanca segura — mexer no significado dela hoje nao muda decisao nenhuma do fluxo.
  **A fonte saiu de medicao, nao de escolha:** na exportacao de 02/10 (9.457 contatos) a **Data de
  cadastro esta em 100%** deles e **so 145 (2%) nasceram de importacao em massa** (mesmo minuto),
  entao nos outros 98% a criacao do contato E a chegada da pessoa. `fields.primeiroContato` pega o
  menor dia entre o cadastro, as mensagens desta sessao e as da anterior **quando ela ja estiver
  carregada** — ela nao e buscada por isto, porque custa duas requisicoes em todo contato aberto.
  **O invariante que substitui a trava velha e "so anda para tras".** A regra antiga era *"so
  preenche buraco, nunca reescreve"*, escrita para um valor que significava CONCLUSAO; guardando a
  CHEGADA, a mesma preocupacao pede o contrario. Nunca empurrar para frente da tudo o que a trava
  velha dava: nenhuma passada estraga valor certo, nao ha oscilacao, e reabrir a conversa continua
  inofensivo. **Ancora so para o campo VAZIO** — corrigir nao precisa, a data ja esta la e ja se
  sabe errada.
  **E o estrago media 18%:** 1.702 contatos com a data 31+ dias depois do cadastro, ate 404 dias.
  **O campo continua se chamando "conclusao"** (o nome e do CRM), e **a correcao aparece no
  cabecalho e no Andamento**: e a UNICA escrita do painel que reescreve dado que ja estava no CRM.

- **`AAAA-MM-DD` NAO PODE PASSAR POR `new Date()`** (07/10/2026, pego antes de ir ao ar). A string
  sem hora e lida como **UTC**, e em UTC−3 ela volta um dia: `2026-08-13` vira 12/08. Num campo que
  se regrava a cada atendimento isso e a data andando para tras sozinha, em dado de eleitor, toda
  passada. `fields.diaLocalDe` devolve intacta a forma que ja e dia local e so converte o que tem
  hora de verdade. **Vale para toda comparacao de dia neste projeto** — `hojeLocal` sempre foi
  local justamente por isto.

- **30 CONVERSAS INICIADAS BANIRAM UM NUMERO SECUNDARIO — e o secundario e o que MENOS aguenta**
  (03/10/2026: *"nao usarei o numero principal pra isso, acabei de mandar 30 mensagens em outro
  numero e foi banido"*). E a medicao mais dura deste projeto, e ela **corrige o conselho que eu
  tinha acabado de dar** (*"se o plano e queimar, ponha o secundario na frente da fila"*).
  **O que o WhatsApp olha e a RECIPROCIDADE.** O numero principal tem historico — gente que escreveu
  primeiro (o anuncio traz inbound real), conversa de verdade, resposta. Um numero que **so manda e
  nunca recebe**, abrindo trinta conversas com desconhecidos numa tarde, e a assinatura de spam mais
  limpa que existe: dura MENOS, nao mais. **Numero novo nao nasce pronto** — precisa de conversa de
  verdade antes de qualquer volume, e isso e tempo, nao configuracao.
  **E derruba a aritmetica do "mando o maximo e sou banido"** (proposta dele na mesma conversa): o
  ban nao espera a lista acabar, corta no meio. O teste dele entregou **30** e perdeu o numero.
  **O teto de 45/dia (numero DELE, 01/10) esta ACIMA do que derrubou um numero de verdade.** O padrao
  **nao foi mudado** — valor dele nao se mexe em silencio —, mas o campo carrega a medicao ao lado,
  em vermelho, onde ele digita.
  **A regra que fica:** para quem JA conversou, texto livre e conversa e nao queima nada; para quem
  NUNCA falou, o caminho sancionado e modelo aprovado, e para volume e a **Campanha** da plataforma
  — que existe porque a Meta precisa saber de antemao o que vai ser disparado.

- **"GUARDAR PARA SOLTAR TUDO DE UMA VEZ" NAO TEM FILA PARA ENCHER — por este caminho, e PAUSA 0**
  (03/10/2026, correcao dele: *"guardar mensagem para soltar tudo de uma vez e exatamente o que eu
  queria, liberar em determinado horario era so um bonus"*). Cada mensagem e **uma chamada de API no
  instante do envio**: no disparo por etiqueta sao ~8 requisicoes por contato, e as oito acontecem
  naquele contato, naquele momento. Nao ha nada a preparar antes — entao guardar localmente e soltar
  depois e, byte a byte, a mesma coisa que rodar com a pausa em 0 (que existe desde a v3.144) na hora
  que ele escolher (o agendamento da v3.145).
  **O que nao existe e o INSTANTANEO:** o limitador recusa rajada (o `Failed to fetch`), a rodada
  espera 30s/1min/2min e tres seguidos param. Mandar em PARALELO seria a forma de forcar, e e
  exatamente *"rajada de requisicoes derruba a API — e a plataforma junto"*, com o agravante de o
  erro deixar de ter dono. **Nao implemente paralelismo sem ele pedir sabendo disto.**
  **Quem guarda e solta de verdade e a CAMPANHA da plataforma** (`chat/v1/campaign`): roda no
  servidor, nao depende da aba, e os dois blocos sao **modelo aprovado** e **`canSendCampaign`** do
  `typeDetails`. Esse campo **ja vinha junto com os numeros e ninguem o mostrava** — hoje o cartao
  "Por qual numero" escreve se o canal ACEITA, NAO aceita, ou se a plataforma nao informou (campo
  ausente nao vira texto afirmativo, a licao de 01/10). Custo: zero requisicao.

- **DESLIGAR A INTERNET DO CELULAR NAO TIRA O NUMERO DO AR NEM ENFILEIRA NADA** (03/10/2026, teste
  dele: *"eu achava que ao desligar a internet do celular as mensagens iriam sair somente quando eu
  ligasse novamente; as mensagens foram iguais pela plataforma"*). O canal Z-API e um aparelho
  **PAREADO** a conta — como o WhatsApp Web —, e desde o multi-aparelho ele tem **conexao propria**
  com o servidor do WhatsApp: manda com o celular sem rede, desligado ou sem bateria; o celular so
  precisa aparecer de tempos em tempos para a sessao nao expirar.
  **Isto REFINA a entrada de 27/09** (*"a plataforma e um cliente pareado a conta dele — para o
  WhatsApp e o mesmo aparelho da mao dele"*): e o mesmo aparelho para efeito de **REPUTACAO**, e
  **nao** para efeito de conexao. O que tira o numero do ar e desconectar a SESSAO (Aparelhos
  conectados, ou o painel da Z-API) — e voltar custa ler o QR.
  **A tela ja responde se o numero caiu:** o cartao "Por qual numero" mostra o `healthStatus` de cada
  canal. Sonda de 01/10 (a mensagem em fila sai na reconexao?) **continua em aberto** — o teste dele
  nao a respondeu, porque o canal nunca caiu.

- **AGENDAR E A RODADA, NUNCA AS MENSAGENS — e o agendamento vive na ABA** (03/10/2026, escolha dele
  entre tres caminhos: *"montar agora e sair depois"*). Guardar mensagem para soltar tudo de uma vez
  e o padrao que derrubou um numero dele com menos de dez envios (26/09); o que espera e a RODADA, e
  na hora ela anda com a mesma pausa e os mesmos freios.
  **Quatro decisoes que o tornam seguro, e nenhuma e opcional:**
  **(1) o keepalive sobe no CLIQUE de agendar** e fica tocando a espera inteira — aba escondida e aba
  CONGELADA, e audio exige gesto do usuario; **a conta de travas de energia e equilibrada** (a espera
  solta a dela antes de a rodada pedir a sua, senao a trava fica presa para sempre).
  **(2) horario que passou ha mais de 10 min NAO dispara** — aba congelada que acorda duas horas
  depois comecaria um disparo em massa fora da janela que ele escolheu.
  **(3) as ETIQUETAS sao conferidas ao agendar** (nome nao muda sozinho, e descobrir as 14:00 queima
  a janela); **o canal no ar e o saldo do dia, na hora**, que e onde decidem.
  **(4) o `confirm` e no AGENDAR e a rodada comeca sem perguntar** — dialogo esperando clique as
  14:00 e rodada parada com ninguem na frente.
  **So memoria, nunca armazenamento:** agendamento que sobrevive ao F5 dispara num dia em que ele nem
  lembra de ter marcado. E **a espera fica fora do `withBusy`** (20/09): o interruptor e unico, e
  segura-lo por horas mataria todo botao do painel.
  **O caminho pela FILA nao e agendavel, de proposito:** la o percurso e a lista que ELE filtrou na
  tela, e o que estiver filtrado daqui a cinco horas nao e o que ele viu ao agendar.

- **OS LIMITES DE RITMO SAIRAM (pausa >= 3s e <= 200 contatos), E O DE 200 ERA O `pageSize`**
  (03/10/2026: *"o disparo esta com um limitador que nao deixa botar abaixo de 3 segundos e 200
  contatos, tire esses limites e me explique porque existem"*).
  **O que cada um protegia, para ninguem repor achando que e enfeite:** a **pausa de 3s** protegia a
  API (cada contato do disparo por etiqueta custa ~8 requisicoes, e o limitador recusa o preflight
  CORS — o `Failed to fetch`; a rodada que estourou em 24/09 fez 444) **e o numero** (o que pune e o
  RITMO e a REPETICAO: menos de dez iguais em sequencia derrubaram um numero dele, 26/09). O **teto
  de 200** era o **tamanho da PAGINA** do `contact/filter`: pedir 500 nao adiantava porque a lista
  acabava em 200.
  **Tirar o teto do CAMPO sem paginar seria mentira** — o numero subiria na tela e a rodada
  continuaria parando em 200, dizendo que percorreu tudo. Hoje `contatosDoFiltro` pede mais paginas
  ate encher o que ele pediu, uma requisicao a cada 200.
  **Os dois viraram AVISO**, que so aparece quando ele passa do que era o limite. **O que continua
  barrando e o que barra de verdade:** o teto por numero por dia, a barreira do canal, os tres
  engasgos de rede que param a rodada e o botao Parar.
  **E os clamps estavam em 17 pontos** (cartoes, confirms, `rodar`): viraram `limiteDaRodada()` e
  `pausaDaRodada()`, num lugar so. Trocar o teto em 16 deixaria o 17o capando **em silencio** — a
  classe do `teto is not defined` de 02/10 com o sinal trocado: la o campo faltava e estourava, aqui
  ele existiria e mentiria. **Pausa: texto sem digito volta ao PADRAO de 8s, nunca a zero.**

- **LISTA DE EXCLUSAO CASA POR NOME EXATO, E NOME ERRADO RECUSA A RODADA** (02/10/2026: *"bote nos
  disparos uma caixa para inserir etiquetas que devem ser puladas"*). `auto.disparoEtiquetasPuladas`
  + `lote.nomesPulados` + `tagsPuladasDoDisparo`, valendo nos TRES botoes da aba Disparo.
  **Exato, e nao o trecho contido de `etiquetaDaLista`:** o filtro do servidor precisa do **id**, que
  so sai do nome exato; e numa lista de EXCLUSAO o trecho contido e perigoso ao contrario — digitar
  `a` tiraria meia base do disparo sem nada na tela dizendo quem sumiu.
  **Nome que nao existe no CRM RECUSA a rodada, com os nomes escritos.** E a regra de 01/10 na lista
  nova, e aqui ela e mais cara: nome errado some do `exceptTagsId` **em silencio** e quem ele mandou
  pular RECEBE. A conferencia e antes de comecar, nas tres rodadas — inclusive na da fila, onde nao
  ha `exceptTagsId` nenhum segurando.
  **A lista entra em DOIS lugares por rodada**, como a etiqueta do recibo: no `exceptTagsId` (o
  servidor nem traz) e por CONTATO (de graca, porque a lista de etiquetas e cacheada), que pega a
  etiqueta aplicada entre o filtro e a vez daquele contato.
  **Ela decide ANTES do recibo e da conversa em `porqueNaoMandar`:** os tres desfechos sao iguais
  (pular), entao a ordem nao muda comportamento — muda o MOTIVO da linha do Andamento, e o certo e o
  que ele reconhece. **Etiqueta sem `id` nao pula ninguem:** id vazio casaria com qualquer coisa.

- **CAMPO NOVO NO RETORNO: ELE TEM DE ENTRAR NA DESESTRUTURACAO DE QUEM O USA** (02/10/2026, print
  dele com **`teto is not defined`** ao apertar "Disparar para a etiqueta"). Na v3.140
  `saldoDosNumerosDoLote` passou a devolver `teto`, eu usei o campo nas contas e nas mensagens dos
  dois abridores de rodada e **nao o acrescentei ao `const { fila, envios, dia, saldo } = ...`** —
  `ReferenceError` nos DOIS caminhos que abrem atendimento, parados desde entao. O erro estoura
  depois de montar a lista e antes do `confirm`: nada foi enviado nem marcado.
  **E a licao de 04/09 ao contrario, e e mais facil de cometer:** mudar a FORMA do retorno quebra
  quem recebe, e isso se procura; **acrescentar campo nao quebra ninguem** — quebra so quem passa a
  USAR o campo sem te-lo desestruturado, e o defeito fica dormindo ate aquela linha rodar.
  **NENHUM verificador pega, e isto foi MEDIDO de novo:** `checar-modulos` so ve `SyntaxError`; a
  passada de escopo de 25/09 compara CHAMADAS de funcao de MODULO contra nomes da closure, e aqui e
  um VALOR entre duas funcoes do mesmo nivel; nenhum teste importa `panel.js`. Um passe novo que
  comparasse, por funcao da closure, os nomes usados contra os declarados deu **41.048 falsos
  positivos** — mesmo desfecho da tentativa larga de 03/09. **Nao refaca:** o que protege e o `grep`
  pelo nome do campo contra a lista de chamadores, no mesmo commit em que o campo nasce.

- **O CAMINHO POR ETIQUETA NAO RESOLVE VARIAVEL, E MANDAVA AS CHAVES A MOSTRA** (achado medindo em
  02/10/2026, ao por o texto sem imagem). `processarContatoDoLote` passava `par.legenda` **cru** para
  o envio — o percurso por etiqueta **nao chama `load()`** de proposito (a decisao vale para a lista
  inteira, e abrir contato e o que derruba a API), entao nao ha contato de onde tirar `{{cidade}}`.
  E o cartao anunciava *"Variaveis: {{saudacao}} {{cidade}} ..."*, que e verdade so no percurso pela
  FILA, onde a conversa esta carregada e `vars.render` roda.
  **O conserto ingenuo seria pior que o defeito:** usar o `state.contact` que estiver aberto mandaria
  **o dado de OUTRA pessoa**. Hoje a rodada **se recusa a comecar** quando acha chaves no texto,
  dizendo qual peca e as duas saidas (tirar a variavel, ou usar o caminho pela fila).
  **Ao escrever hint de recurso que vale em UM dos caminhos, diga em qual** — e ao criar caminho de
  envio que nao carrega o contato, procure o que o outro caminho renderiza.

- **`api.mandarTexto` DEVOLVE O `status`, E E ELE QUE DECIDE A CONCLUSAO NO DISPARO DE SO TEXTO**
  (02/10/2026). A guarda de 01/10 (*"concluir CANCELA mensagem em fila"*) lia o status da mensagem de
  IMAGEM; sem imagem nao havia status, e o atendimento seria concluido em cima da propria mensagem em
  fila. **Ao criar caminho de envio novo, procure a guarda que lia o status do caminho antigo.**

- **A ARTE DO DISPARO FICOU OPCIONAL, E O PRE-REQUISITO DA IMAGEM ACOMPANHOU** (02/10/2026: *"preciso
  que tenha a opcao de so mandar texto sem imagem"*). A peca e um TEXTO com arte OPCIONAL: sem arte
  sai `api.mandarTexto` (etiqueta) ou `page.sendText` (fila); com arte, a cadeia de cinco passos de
  sempre. **Arte SEM texto continua fora** — imagem muda nao sai daqui (20/09), e e pelo TEXTO que
  `jaRecebeu` reconhece na conversa quem ja recebeu.
  **E o contrato de envio de imagem deixou de ser exigido quando nenhuma peca leva arte:** era
  exigido sempre, entao o disparo de texto ficava bloqueado por um passo que nada naquele disparo
  usaria — a familia do pre-requisito que envelhece junto com o desenho que o criou (26/09).

- **QUANTAS PECAS E DELE, MAS AS CHAVES VAO ATE O TETO** (02/10/2026: *"a opcao de mandar imagens nao
  precisa ser 4, bote a opcao de adicionar ou remover quantidades"*). `auto.lotePecas` (nasce com 4,
  teto `lote.MAX_PECAS` = 8) decide quantas a tela mostra e quantas `paresProntos` varre; **as CHAVES
  (`chavesNoAuto`, a lista do perfil, o `AUTO_VAZIO`) enumeram 1..MAX**, porque a chave da peca 7 tem
  de existir ANTES de ele criar a peca 7 — senao `exigirChaveConhecida` recusa a gravacao no dia em
  que ele a criar, e o defeito aparece so entao.
  **REMOVER NAO APAGA:** baixar a conta para de USAR a ultima peca; o texto e a arte continuam
  guardados e voltam se ele adicionar de novo. Apagar seria o gesto destrutivo escondido no botao
  inofensivo (01/09) — quem libera espaco e o "Tirar" da propria imagem.
  **O TETO E 8 POR CAUSA DO ARMAZENAMENTO, medido:** a extensao nao pede `unlimitedStorage`, entao
  `chrome.storage.local` tem ~10 MB, e cada arte guardada pode ter 2 MB de bytes — **~2,7 MB em
  base64**. Oito cheias estouram a cota e a escrita falharia no meio de uma edicao; por isso o cartao
  mostra quanto as artes ocupam e avisa acima de 7 MB. **E o `load()` le so as pecas EM USO**, nao as
  oito: ler quatro artes a mais em todo contato aberto e memoria por nada.

- **CAMPO QUE EXISTE E NAO APARECE E CAMPO QUE NAO EXISTE** (02/10/2026: *"com relacao a etiqueta
  deve ter a opcao de mudar para outra etiqueta e trocar a vontade, creio que no momento so tem
  colinha"*). **Medido: o campo sempre foi texto livre e aceita qualquer etiqueta** — `COLINHA` e so
  o valor de fabrica. O que havia era um campo **enterrado no meio de um cartao de 340 linhas, abaixo
  das quatro artes**: a familia do campo no cartao errado (04/09), com a diferenca de que aqui nada
  estava escondido — estava LONGE.
  Hoje as duas etiquetas que decidem o disparo ficam juntas no cartao "Para quem", e o botao **"Ver
  as etiquetas do CRM"** carrega a lista **no clique, nunca no desenho**: trocar de etiqueta passou a
  ser ler e copiar, em vez de acertar a grafia de cabeca — que e o que faz a rodada recusar.
  **Antes de criar controle novo porque ele disse que nao existe, procure o controle** — e se ele
  existir, o conserto e de LUGAR.

- **O MESMO CARTAO EM DUAS ABAS E UMA CONFIGURACAO SO, E A TELA TEM DE DIZER ISSO** (02/10/2026, a
  aba Disparo). O Ritmo (`auto.limite`, `auto.pausaSeg`) vale para TODAS as rodadas, e aparece nas
  duas abas: uma copia por aba divergiria na primeira correcao. O que faltava era a linha dizendo que
  o valor e comum — sem ela, trocar o limite no disparo mudaria a rodada dos "Meus" sem ele perceber.

- **NUMERO QUE ELE DITOU NUM DIA NAO PODE VIRAR CONSTANTE — ele volta como trava que ele nao
  alcanca** (02/10/2026: *"a restricao dos contatos deveria ser opcional, bote uma caixa para
  inserir o numero desejado, acabou de me bloquear"*). O **45** saiu da frase dele de 01/10
  (*"limite de 45 por numero"*) e eu o escrevi como `lote.TETO_POR_NUMERO`: a rodada se recusava a
  comecar e as unicas saidas que a mensagem oferecia eram marcar outro numero ou **esperar a virada
  do dia**. Hoje `auto.tetoPorNumero` e o valor dele e a constante e so o PADRAO.
  **`0` e a escolha explicita de nao ter teto**, com o aviso do risco do lado (o `RESTRICTED` de
  26/09 e o WhatsApp recusando por conversas INICIADAS em 24h) — risco e decisao dele, como no
  `FLAGGED`, que avisa e nao barra.
  **E `clampInt(v, 0, ...)` E O DEFEITO NESSE CAMPO:** ela devolve o MINIMO para texto sem digito,
  entao campo apagado ou "quarenta" digitado gravariam **0 = sem teto** — a protecao desligada por
  um escorregao, em silencio. Texto sem digito volta ao PADRAO, nos dois lados (a tela e
  `lote.tetoDoCfg`, que peneira o que ja esta no armazenamento); desligar exige digitar o zero.
  **Teto desligado devolve `Infinity`**, entao todo lugar que escrevia o numero passa por
  `lote.textoDoTeto` — *"cabem Infinity hoje"* num `confirm` de disparo seria a tela afirmando
  bobagem no pior momento. E o contador **continua contando**: desligar para de BARRAR, nao apaga a
  medida.
  **Ao transformar uma frase dele em limite de codigo, pergunte onde ele troca esse numero** — e a
  recusa tem de dizer a CONTA de cada numero e ONDE se mexe, senao ela e um muro (a licao de 25/09
  sobre o veredito que nao dizia por que nada saiu, aplicada antes de a rodada comecar).

- **`state.auto.rodando` DESLIGA O PAINEL PARA A CONVERSA QUE ELE ABRE — e isso mata qualquer rodada
  em que a tela e DELE** (02/10/2026, o modo de so abrir: *"faca um modo so para abrir o contato e
  deixar nos meus sem enviar nada e quando concluir abrir o proximo contato"*).
  **Medido:** `applyPageState` devolve antes do `load()` quando `rodando` e verdadeiro, e os dois
  temporizadores (`load` e `reexame`) desistem pelo mesmo teste. A guarda esta CERTA para as rodadas
  normais — ali **quem troca de atendimento e a propria rodada**, e um `load()` por fora carregaria
  o contato duas vezes e gravaria no CRM no meio de um envio.
  **No modo de so abrir a premissa se inverte:** a rodada cria o atendimento pela API e **nao abre
  conversa nenhuma na tela**; quem abre e ele. Sem a marca nova (`state.auto.telaEDele`, pedida no
  `rodar` e zerada no `finally` junto do `automatico`), o painel ficaria **mudo justo no contato que
  ele acabou de receber** — sem classificacao, sem etiqueta sugerida e sem resposta pronta.
  **Ao escrever rodada nova, pergunte QUEM abre a conversa na tela** — e `withBusy` continua proibido
  em espera longa (20/09): esta rodada vai por `semTravarOPainel`, porque ela espera por ELE.

- **"FICOU EM MEUS" ERA HIPOTESE, E AGORA A SONDA LE DE VOLTA** (02/10/2026). `PUT /chat/v1/session`
  nunca foi executado — o corpo foi lido no bundle em 01/10 —, e **que o atendimento criado caia em
  `IN_PROGRESS` com ele, e nao `PENDING` na fila dos "Novos", e a hipotese em que o modo de so abrir
  se apoia inteiro**. Por isso a sessao e RELIDA (`GET /chat/v1/session/{id}`) e
  `lote.ondeCaiuOAtendimento` da o veredito.
  **SAO SEIS ESTADOS E NAO DOIS** — a licao de 25/09 (`donoDoCanal` devolvendo `null` para duas
  situacoes opostas) somada a de 01/10 (`undefined !== 'CONNECTED'` e verdadeiro): `meu`,
  `em-andamento` (sem dono legivel — SEGUE, dizendo que nao deu para conferir), `pendente`,
  `de-outro`, `concluido` e `desconhecido`. **Ausencia de informacao nao e evidencia nos DOIS
  sentidos:** nem "esta tudo bem", nem "deu errado".
  **O que cai em `pendente`, `de-outro`, `concluido` ou `desconhecido` PARA no primeiro contato**, e o
  preco de a hipotese estar errada e **um atendimento aberto e nada mais** — sem envio, sem etiqueta,
  sem escrita no CRM. E a disciplina de "uma sonda antes das outras" aplicada a LEITURA.
  **A linha da sonda registra as CHAVES da sessao, nunca os valores** (`lote.chavesDaSessao`): a
  sessao carrega telefone e nome de eleitor, e o que serve para saber o que a rota devolve sao os
  nomes dos campos — a disciplina de 07/09 de medir na API de verdade.

- **ABRIR CONVERSA CONTA NO TETO DO NUMERO, e aqui o contador anda ANTES de qualquer mensagem**
  (02/10/2026). No lote de imagem o contador so anda depois de a mensagem sair (contar antes queimaria
  saldo por falha nossa); no modo de so abrir **o que e contado e a CONVERSA INICIADA, que ja
  aconteceu** — e `RESTRICTED` e literalmente *"atingiu o limite de conversas iniciadas nas ultimas 24
  horas"*. Os dois modos dividem o mesmo orcamento de 45 por numero, por dia, na mesma fila.
  **O que o contador NAO ve e o que ele manda a mao** depois, na conversa aberta — dito a ele.

- **ESPERAR "ELE CONCLUIR" TEM DOIS JEITOS, E O ANTIGO PRESSUPOE A CONVERSA NA TELA** (02/10/2026).
  `esperarVoceConcluir` trata "voce foi para outro atendimento" como *"deixei este para depois,
  siga"* — certo quando a RODADA abriu a conversa, e errado quando o atendimento nasceu pela API: ali
  "nao esta na tela" e o estado NORMAL no comeco da espera, e a rodada abriria o contato seguinte
  **um segundo depois**. Hoje e a mesma funcao com `trocaSegue: false`, e a conclusao e perguntada em
  duas portas: a TELA a cada segundo (de graca) e a **API de 30 em 30 segundos** (`perguntarAApi`),
  para alcancar quem conclui com a tela noutro lugar ou do celular. **Falha de leitura nao e
  "concluiu" nem "parou"** — e a politica da barreira do canal.
  **E a linha de status e reescrita a cada leitura**, nao so no comeco: abrindo o contato, o `load()`
  escreve a barra com o que carregou e o aviso de "atenda e conclua" sumiria justo durante o
  atendimento.

- **LIMITE QUE SO CONTA `'enviado'` NAO EXISTE EM RODADA QUE NAO ENVIA** (02/10/2026, segunda vez).
  `percorrerContatos` contava `r.resultado === 'enviado'`, entao o modo de so abrir (`'triado'`)
  andaria pelos 200 contatos da lista ignorando o numero do cartao de Ritmo. `percorrerFila` ja
  usava `CONTA_NO_LIMITE` com o comentario explicando a primeira vez (a rodada de so reiniciar) — a
  conta agora e a mesma nos dois percursos, e `lastSendAt` continua sendo so de envio de verdade,
  porque ele e o intervalo que protege o numero no WhatsApp.

- **MARCAR NO INSTANTE DO ENVIO SO ALCANCA O QUE SAIU PELO PAINEL — a verdade do que saiu e a
  CONVERSA** (02/10/2026, *"so no automatizado esta sendo colocada a etiqueta"*). A v3.135 marcou nos
  quatro pontos de saida e a v3.137 nos ramos que so INSEREM; **os dois continuam valendo e os dois
  sao pequenos demais**, porque sai muita coisa por fora: ele digitando na conversa, as respostas
  rapidas da **propria plataforma**, o chatbot do anuncio, outra pessoa da equipe, o celular.
  **No automatizado quem manda e o painel — por isso so ali funcionava.**
  **QUARTA vez da mesma licao** (etiqueta de material 3.40, de pedido 3.46, negativa repetida 12/09):
  **marca amarrada a QUAL caminho enviou morre quando o caminho muda**, e a resposta e sempre
  perguntar a CONVERSA. `getConversation().nossas` existe para isto desde 31/08 — o `api.js` ja dizia
  que `wasSent` so enxerga o painel.
  Hoje `etiquetarPorPalavraDoQueJaSaiu` roda no `load()`, depois de `refreshTagSuggestions`, contra
  TUDO o que nos mandamos nesta conversa. **Guardas:** so ESCREVE com regra casada e etiqueta
  faltando (abrir dez vezes nao custa escrita), fica dentro de `try` (falha de etiqueta nao derruba o
  `load`), a linha do Andamento so aparece quando marcou, e e a conversa da SESSAO.
  **Ao criar marca nova que depende do que NOS mandamos, comece pela conversa e nao pelo ponto de
  envio** — o ponto de envio e otimizacao, a conversa e a verdade.

- **COLAR NAO E ENVIAR, E MARCA QUE MORA DEPOIS DO `page.sendText` NAO ACONTECE EM METADE DOS
  ENVIOS** (02/10/2026, *"estou colando uma mensagem pronta e nao esta botando a etiqueta por
  palavra"*). **Medido: a regra dele casava e a tabela estava salva** — o defeito era o CAMINHO.
  `sendTemplate` tem, logo no comeco, o ramo
  `if (!send || !state.settings.autoSend) { setComposerText(text); return true; }` — e ele e **DUAS
  coisas**: o botao "Inserir" da aba Respostas **e TODA resposta pronta quando o "Enviar automatico"
  esta desligado**, inclusive as da caixa da rodada. Do lado DELE a mensagem sai igual; do lado do
  painel nunca houve envio para marcar. **`enviarModelo` tem o ramo gemeo** (o dialogo fica pronto e
  ele aperta "Enviar mensagem").
  **Ao por marca no "ponto unico por onde tudo sai", conte os RAMOS e nao so as funcoes** — sao duas
  funcoes com dois ramos cada, e a licao de 15/09 ("confira que sao DOIS pontos") so cobria metade.
  **O rascunho da IA fica de fora de proposito:** quando ela ENVIA, marca; quando o texto fica no
  campo para ele ajustar, **o texto ainda vai mudar**, e marcar ali etiqueta uma frase que nao
  existe.
  **O preco esta na tela:** colar e nao mandar deixa a etiqueta aplicada — o lado barato, porque
  etiqueta e organizacao interna e nao marcar quem recebeu some com o caso da lista dele.
  **E A ETIQUETA DE MATERIAL TEM O BURACO IDENTICO E NAO FOI MEXIDA:** `abreCasoDeMaterial` ->
  `etiquetarEndereco` mora na mesma posicao, entao com o envio automatico desligado quem recebe o
  pedido de endereco nao e marcado. Nao foi tocada porque ela faz a rodada **PULAR o contato para
  sempre** e passa pela conferencia da IA — marcar a partir de texto que talvez nao tenha saido e o
  que a decisao de 24/09 evitou. **Decisao dele.**

- **`UNDEFINED` NAO E "O NUMERO CAIU", E O CAMPO DA CONEXAO E `healthStatus`** (01/10/2026, print
  dele: a rodada se recusou a comecar com *"status UNDEFINED · qualidade UNDEFINED"* num numero que
  estava NO AR). A barreira da v3.135 fazia `status !== 'CONNECTED'`, e **`undefined !== 'CONNECTED'`
  e verdadeiro**: ausencia de informacao virou evidencia.
  **E a ausencia era ESPERADA:** `status` e `quality` sao da **Cloud API** e o canal dele e
  `ZAPI_WHATSAPP`. A armadilha ja estava escrita aqui desde 26/09 (*"quality, RESTRICTED e
  CHANNEL_TIER_EXCEEDED sao da Cloud API e podem nao significar nada num canal Z-API"*) — eu li,
  escrevi, e mapeei os dois como universais. **E a licao de 25/09 outra vez** (`donoDoCanal`
  devolvendo `null` para duas situacoes opostas): **estados diferentes precisam de respostas
  diferentes**, e colapsar "nao sei" em "esta ruim" trava a rodada.
  **O campo que existe nos DOIS mundos e `channel.healthStatus`** (`ChannelHealthStatus`): `OK`
  ("Estavel"), `CHECK` ("Verificando conexao"), `ALERT` ("Em alerta"), `CRITICAL` ("Critica a
  conexao com o WhatsApp") e `DISCONNECTED` ("Numero de telefone foi desconectado"). **E ele que
  pinta a tarja do cabecalho** — a mesma informacao que a extensao lia por TEXTO, agora por API e
  sem depender de conversa aberta.
  **O criterio de `lote.porqueNaoUsarONumero`: BARRA o que impede a mensagem de CHEGAR** —
  `healthStatus` DISCONNECTED/CRITICAL e `status` BANNED/DISCONNECTED/RESTRICTED. **`FLAGGED` so
  AVISA**, de proposito: "sinalizado como SPAM" ainda entrega, e mandar sabendo e decisao dele.
  **Os dois campos vazios tambem so avisam** — e o aviso aparece na tela, porque barreira que nao
  protege e pior calada.
  **Campo que a plataforma nao mandou NAO vira texto na tela** ("UNDEFINED", "?" ou "sem status" e
  a tela afirmando que leu algo que nao leu). E **sem `typeDetails` a janela de 24h e `-1` (SEM
  janela)**, que e o que o proprio app faz (`?? -1`): `Number(undefined)` e `NaN`, e a linha
  prometia uma janela que o canal nao tem.
  **A licao geral: ler o bundle da o NOME do campo; so a execucao diz quais campos VEM.** Na
  primeira execucao de `canaisDaConta`, tres dos sete campos vieram vazios — a disciplina de "uma
  sonda antes das outras" vale para LEITURA tambem, e nao so para escrita.

- **A BARREIRA DO CANAL CAIDO LE A TELA, ENTAO ELA NAO EXISTE EM RODADA QUE NAO ABRE CONVERSA**
  (01/10/2026, *"caso caia o numero preciso que pare o envio, anteriormente ficou enviando"*).
  **Medido: `page.canalForaDoAr` junta DUAS leituras do DOM** — a tarja de desconexao e **o numero da
  conversa ABERTA** — e o envio em lote nao abre conversa nenhuma: ele cria o atendimento pela API e
  manda pela API. Sem conversa aberta nao ha numero para comparar, e o UNICO ponto do painel que
  chamava aquela guarda era o caminho da rodada de fila. **O lote nao tinha barreira: tinha a
  ausencia dela.**
  **O que serve aqui e a API: `GET /chat/v4/channel/my` devolve o `status` de cada canal**
  (`CONNECTED`, `DISCONNECTED`, `BANNED`, `FLAGGED`, `RESTRICTED`) sem depender de tela, e e a mesma
  leitura que o cartao ja fazia. Confere em TRES lugares: antes de comecar (toda a fila — e aqui, nao
  so no cartao, porque **a tarja mora no CABECALHO, que e a tela que ele esconde durante a rodada**),
  de dez em dez contatos, e na mensagem em FILA.
  **`QUEUED` tem duas causas e desfechos OPOSTOS, e por isso o status do canal e consultado antes de
  decidir:** com o numero NO AR a fila e passageira e o certo e so nao concluir (concluir cancelaria
  o proprio envio, a guarda da v3.133); com o numero FORA aquela mensagem nao vai a lugar nenhum, e
  seguir e o *"ficou enviando"*.
  **E nesse caso a ETIQUETA NAO e aplicada**, de proposito: ela exclui o contato de todos os lotes
  futuros (`exceptTagsId`), entao marcar quem nao recebeu nada o apagaria da lista PARA SEMPRE. Sem a
  marca ele volta amanha; o preco, dito na linha, e receber duas vezes se a fila for entregue depois.
  **Falha ao LER o status nao e "o numero caiu"** — devolve vazio com aviso no log, como a guarda da
  tela sempre fez: o limitador recusa requisicao com frequencia, e parar a rodada por leitura que nao
  voltou e a automacao desligada.
  **E A PERGUNTA QUE FICA EM ABERTO: reconectando o numero, a mensagem em fila sai?** Nao foi
  observado. O que se sabe aponta para SIM — a plataforma ACEITA o envio com o canal fora e o balao
  fica la (31/08), e o dialogo da tela diz que concluir **CANCELA** as pendentes, ou seja elas existem
  com intencao de sair. **Isso e risco e nao alivio:** 40 mensagens iguais em rajada no instante da
  reconexao e o padrao que derrubou o numero dele com menos de dez (26/09). **Concluir cancela;
  deixar aberto entrega** — a decisao e dele. A sonda e mandar UMA no contato de teste com o numero
  fora e reconectar.

- **TETO DE 45 POR NUMERO, POR DIA, COM A FILA DELE** (pedido dele, 01/10/2026: *"limite de 45 por
  numero; quando chegar em 45 e para trocar por um numero seguinte da lista que eu especificar"*).
  `auto.loteCanais` (ids, na ordem dele) + `store.loteEnvios` (`{canalId: {dia, enviados}}`) +
  `lote.numeroDaVez`. Era um `<select>` de UM numero.
  **POR DIA e a unica parte que ele nao disse:** o teto que o WhatsApp cobra e o das ultimas 24h (o
  `RESTRICTED` de 26/09), e **contador vitalicio queimaria o numero no primeiro lote e nunca mais o
  liberaria** — com o `exceptTagsId` fazendo a lista de amanha ser de gente nova, os numeros tem de
  voltar a servir. **O corte e o DIA LOCAL** (03/09), e a contagem e por CANAL e nao por candidato.
  **A vez e do PRIMEIRO da fila com saldo**, nao "o proximo depois do ultimo": assim o numero que ele
  sobe passa a ser usado na hora, e rodada interrompida recomeca onde parou **sem ponteiro nenhum
  guardado** — o contador do dia ja diz tudo.
  **O contador anda depois de a mensagem SAIR**, como o ponteiro do revezamento: contar o que nao
  saiu queima saldo por falha nossa, e saldo queimado so volta amanha.
  **`filaDeNumeros` cai no `loteCanalId` antigo quando a fila esta vazia** — sem isso, subir a versao
  desligaria o lote de quem ja o tinha configurado. **A POSICAO esta escrita em cada linha** (`1º`,
  `2º`): ordem guardada sem aparecer na tela e a armadilha de 01/09 do quadro.
  **Fila esgotada PARA a rodada com `parar: true`** (nao e erro: o resto fica para amanha), e
  esgotada antes de comecar ela se recusa a comecar.

- **ETIQUETA POR PALAVRA NO QUE NOS MANDAMOS, E SAO QUATRO PONTOS DE SAIDA** (pedido dele,
  01/10/2026: *"quando eu enviar uma palavra chave uma etiqueta que eu escolher tambem seja
  colocada"*). `store.etiquetasPorEnvio` + `tags.etiquetasDoEnvio` + `etiquetarPorPalavra` no painel.
  **E o ESPELHO de `tagRules`, e por isso e outra lista:** aquela casa no que o CONTATO escreveu e
  decide qual CONTEUDO mandar; esta casa no que SAIU e registra o que NOS fizemos. Misturar faria uma
  palavra do nosso texto decidir qual modelo enviar — a confusao que a etiqueta ADS custou tres vezes.
  **Os QUATRO pontos sao `enviarModelo`, `sendTemplate`, o envio do rascunho da IA e a legenda do
  LOTE** — a mesma contagem que custou a etiqueta de material em 15/09.
  **Nasce VAZIA** (ao contrario de `tagRules`, que tem valores de campanha dele): regra inventada
  aqui poe etiqueta permanente em eleitor real. **NAO passa pela conferencia da IA** (a regra de
  17/09 e para etiqueta que afirma o que a PESSOA quis dizer; esta afirma o que NOS mandamos, e esta
  escrito no texto). **Falha de etiqueta nao bloqueia o envio** (20/08).
  **E o leitor do formato `padrao = Etiqueta` virou UM** (`tags.lerRegrasDeTexto`): eram duas tabelas
  com o mesmo formato e o parser morava dentro do botao da primeira. Padrao invalido agora e
  DEVOLVIDO e aparece na tela, em vez de sumir em silencio.

- **O `accept` DO SELETOR E A LISTA DE PERMISSAO DA PLATAFORMA, E O EXPLORER ESCONDE O RESTO**
  (01/10/2026, *"a extensao ao escolher imagem nao atualiza o explorer, baixei uma imagem nova e ela
  nao mostra"* — e, perguntado, *"e por ser png"*). **Medido: nao havia nada a atualizar.** O campo
  era `accept={imagemLib.MIMES_ACEITOS}`, que e `image/jpeg,image/jpg`, entao a janela do Windows
  **filtrava o arquivo recem-baixado para fora da listagem**. O diagnostico natural ("listagem
  velha") era o errado, e o certo estava numa linha de `accept`.
  **O conserto NAO toca na lista da plataforma, e e esse o ponto:** a armadilha de 20/09 continua de
  pe (o passo do `transform` e o unico valor que nao da para derivar, e o que a plataforma faz com
  PNG **ninguem viu** — liberar ali seria hipotese, e hipotese aqui e arte muda chegando em eleitor).
  Hoje o PNG **para antes**: `createImageBitmap` + canvas em `converterParaJpeg`, e o que vai para o
  armazenamento e JPEG — a cadeia de envio recebe exatamente o que ja recebia. Sao TRES listas agora:
  `MIMES_ACEITOS` (a plataforma), `CONVERTIVEIS_AQUI` (o navegador, antes dela ver) e
  `MIMES_DO_SELETOR` (a soma, que e o que o Explorer mostra), e o teste exige que o seletor **nunca
  mostre menos** que a plataforma aceita.
  **Quatro coisas para quem mexer:** **fundo BRANCO e obrigatorio** (JPEG nao tem transparencia, e
  PNG recortado em canvas vazio sai com fundo PRETO); **JPEG que ja cabe vai byte a byte**, porque
  reconverter perde qualidade de graca; **os dois tetos sao dois de proposito** (guardar 2 MB,
  escolher 12 MB — PNG e inchado, e recusar pelo tamanho do ORIGINAL recusa o que cabe); e **imagem
  menor que 1600px nunca e ampliada**, que so gastaria armazenamento. A linha de status **diz o que
  foi feito com a arte dele** — conversao silenciosa em dado dele nao serve.
  **E a outra metade de "nao atualiza": campo de arquivo precisa de `value = ''` depois de usar** —
  sem isso o MESMO arquivo escolhido de novo nao dispara `change`, e o botao fica mudo justo depois
  de uma recusa ou de ele trocar a arte mantendo o nome.
  **Global do navegador novo custa uma linha em `GLOBAIS` do `checar-referencias.mjs`**, que acusou
  `createImageBitmap` como chamada sem declaracao.

- **PRE-REQUISITO DE RODADA ENVELHECE JUNTO COM O DESENHO QUE O CRIOU** (26/09/2026, pergunta dele:
  *"em Meus esta dando esse erro, isso nao e um resquicio do padrao anterior? agora temos os modelos
  por anuncio"*). A rodada dos "Meus" se RECUSAVA a comecar sem a tabela *"Modelo por conteudo"* —
  trava escrita quando aquela tabela era o UNICO jeito de saber qual modelo mandar. **Hoje ela e a
  TERCEIRA da fila**, atras de `anuncios.modeloDoAnuncio` e do modelo padrao com rodizio.
  **Medido em 20.000 contextos: sem modelo NENHUM a rodada ainda decide em 100% deles**, e a tecla 1
  aparecia em 6 de 20.000 — ela conclui, pula, pede o cadastro, manda a do momento e chama a IA sem
  tocar na tabela. **A assimetria ja era a prova: "Novos" e "Outros" nunca tiveram essa trava, e as
  tres usam o mesmo motor.**
  **O que acordou o resquicio foi a v3.123**: a tabela virou POR CANDIDATO e a do candidato novo
  nasce vazia — a trava dormia desde que o anuncio passou a decidir e voltou barrando a fila inteira.
  **Ao separar uma chave por perfil, procure quem a usa como PRE-REQUISITO**: o valor vazio deixa de
  ser "ainda nao configurei" e vira "nao posso trabalhar".
  **A informacao desceu para o CONTATO**, onde ja existia e e melhor (a caixa diz o que fazer agora e
  o que fazer para nao repetir), e a rodada avisa UMA vez, no comeco, quando as TRES fontes estao
  vazias — avisa e SEGUE, como a barreira do canal. **Ao apagar uma trava, escreva onde a informacao
  dela passa a aparecer.**
- **`<select>` SO MOSTRA O QUE ESTA NAS `option`, E POR ISSO ELE PARECE APAGAR O QUE ESTA GRAVADO**
  (25/09/2026, *"ao trocar os perfis esta removendo os modelos setados para cada anuncio"*).
  **Medido: o armazenamento nunca foi tocado** — ida e volta entre os candidatos devolvia
  `campanha_martim_01` intacto. Os modelos aprovados sao do CANAL: trocando de candidato, o nome
  salvo nao esta entre as `option`, o select cai no vazio e a tela diz *"— escolha o modelo —"* sobre
  um valor gravado. **E nao e cosmetico: o `gravar` monta a linha inteira a partir da tela, entao o
  primeiro clique em qualquer outro campo do cartao apaga de verdade.**
  **No cartao dos MODELOS PADRAO era pior**: aquele select nao tem opcao vazia, entao o navegador
  marcava o PRIMEIRO modelo do canal como se fosse o salvo — a tela mostrando um e o rodizio usando
  outro. **A regra: select cujo valor salvo pode nao estar na lista carrega o salvo como opcao
  propria, marcada, com o aviso do lado** — e o projeto ja fazia isso na caixa do modelo da rodada
  (*"o modelo salvo nao esta na lista deste canal"*), tres mil linhas acima, no mesmo arquivo.
  **Ao medir "sumiu", separe o DADO da TELA antes de consertar**: as duas produzem a mesma queixa, e
  o conserto e em lugares opostos.
- **FUNCAO DE MODULO NAO ENXERGA NOME DA CLOSURE, E AGORA O VERIFICADOR PEGA** (25/09/2026, *"iniciei
  o automatizado mas nao esta fazendo nada"*, com o Andamento dizendo `perfilAtivo is not defined`).
  `carregarModelosPadrao` e declarada na COLUNA 0 de `panel.js`, fora da closure do painel, e a
  v3.123 a fez chamar `perfilAtivo()` — **ReferenceError em todo contato que chega por anuncio**. E a
  mesma classe do `dom.numeroDaConversa()` chamado do painel, registrada 24 horas antes e no mesmo
  arquivo. **O conserto ja estava do lado: `carregarAnuncios(perfil)` recebe o perfil por ARGUMENTO,
  exatamente por isso.**
  **E o verificador passou a pegar, com a passada ESTREITA que e a unica que funciona:** compara o
  corpo das funcoes declaradas na coluna 0 contra os nomes declarados INDENTADOS — os dois escopos
  que nao se enxergam. Medido nos dois sentidos: acusa 2 no commit que quebrou (com dono e linha
  certos), cala no conserto, **0 falsos positivos em 44 arquivos**. **Isto NAO desmente a tentativa
  de 03/09**, que era larga (variavel fora de escopo em qualquer lugar) e deu 33 falsos. Cuidado ao
  mexer: o alcance de uma funcao de modulo termina no `}` da coluna 0 **ou na proxima funcao de
  modulo, o que vier antes** — sem isso ela engole a seguinte e acusa com o dono errado.
  **E o VEREDITO da rodada passou a dizer POR QUE nada saiu.** Ele contava (*"0 enviado(s), 37
  pulado(s)"*) e nao dizia o motivo, entao rodada que pula a fila inteira pela mesma razao (a
  barreira do canal) parecia rodada que funcionou. So aparece quando NADA foi enviado e 80% dos
  pulados tem o mesmo motivo: com envio no meio, pular e o normal e a linha viraria alarme que toca
  sempre. **Ao escrever resumo de laco, pergunte se ele distingue "fez o trabalho" de "nao pode
  fazer nada".**
- **A CAIXA QUE CONCLUI EM PRIMEIRO LUGAR E A QUE ENTERRA A PERGUNTA** (25/09/2026, o Nelson:
  etiqueta ENGAJADO, perguntou *"Quais planos mais urgente?"* as 10:18 e a rodada concluiu as 12:26 —
  *"ignorou a pergunta e concluiu, tive que retornar e responder"*). **Medido: os detectores
  acertaram todos** — `perguntaPendente` true, e SEM a etiqueta o caso dava `pergunta-aberta`
  (tecla 6). `etiqueta-dispensa-da-fila` decide em SEXTO lugar e `pergunta-aberta` em DECIMO NONO.
  **Terceira caixa a receber a regra dele de 03/09** (*"tem pergunta nao conclui"*), depois de
  `ja-respondemos-antes` e `respondeu-os-dados` — e a UNICA das tres que decide no topo, entao era
  ela que enterrava a pergunta de quem mais fala com o mandato. **A guarda foi para o DESFECHO e nao
  para o `quando`** (licao da Noeli, 06/09): no `quando`, quem entra no lugar e `ja-respondemos-antes`,
  que ENVIA. **Ao consertar uma caixa que conclui, confira as OUTRAS que concluem acima dela** — a
  regra so vale onde foi escrita, e `etiqueta-so-conclui` (assessor) continua de fora de proposito,
  porque ela e decisao dele sobre quem trabalha no mandato.
- **O ENDERECO VEM PARTIDO PORQUE NOS PEDIMOS PARTIDO** (23/09/2026: o modelo pede *"rua, numero,
  bairro e cidade"*, ela respondeu em TRES mensagens, e a rodada concluiu sem etiquetar —
  *"a instrucao e deixar aberto para eu transferir depois"*). **Medido: `informouEndereco` devolvia
  null para as tres, e para as tres JUNTAS** — a conta das duas marcas era dentro de UMA mensagem, a
  rua veio sem a palavra "rua" e "CIDADE:" nao era marca. O resto da cadeia estava certo: com o sinal
  ligado a decisao e tecla 2 (pula, deixa aberto); sem ele, `ja-respondemos-antes` CONCLUI. Hoje
  `respondendoNossoPedido` (a NOSSA ultima mensagem ser o pedido) soma os campos na rajada. **Pela
  ULTIMA e nao por "ja pedimos": a etiqueta e permanente e manda pular para sempre.** E a conta e de
  **campos DISTINTOS** — somar ocorrencias fazia "cidade" duas vezes bastar, e o teste pegou.

- **SINAL NOVO EM `pedeRespostaPessoal` CALA A PROTEÇÃO `sem-interesse`** (22/09/2026, regressão da
  v3.96). A regra só decide com `!pedeRespostaPessoal`; pôr ali um sinal que liga com fala curta fez a
  recusa *"Pago multa e não dou voto"* virar caso da IA, que fechou pedindo o cadastro. **Ao somar um
  sinal a `pedeRespostaPessoal`, confira quem lê esse sinal como GUARDA** — e a recusa tem de desligá-lo.

- **A ETIQUETA DE MATERIAL SAIA DO NOSSO PEDIDO DE ENDERECO DO VOLUNTARIADO** (24/09/2026, pergunta
  dele: *"de onde saiu a etiqueta de material dessa conversa?"*). **Medido: `pedeMaterial` e
  `pedeMaterialEscrito` = `null`** — ela nunca pediu nada; quem casou foi `pedeEmprego` (tipo
  `campanha`), saiu a resposta `trabalhar-na-campanha`, e o texto DELA pede *"endereco completo (rua,
  numero e bairro)"*: `ehPedidoDeEndereco` casou no que **NOS** mandamos e a marca do envio etiquetou.
  Ela recusou o voluntariado e nunca mandou endereco — e a etiqueta **manda PULAR em toda passada,
  para sempre**. **Decisao dele: neste caminho a marca espera ela MANDAR o endereco**; o caminho do
  MATERIAL continua marcando no nosso pedido (04/09). O invariante que separa os dois ja existia:
  `ehNegativaDeTrabalho`, e a conjuncao e `templates.abreCasoDeMaterial`. **So os TRES pontos que
  MARCAM mudaram** — `respondendoNossoPedido`, `vaiPedirEndereco` (deixar ABERTO) e o aviso
  `enderecoSemMaterial` continuam com `ehPedidoDeEndereco` puro, porque ali a pergunta e outra
  (*"nos pedimos o endereco?"*), e silenciar o aviso apagaria o caso do "Silva pinturas" (12/09), que
  o criou. **Ao silenciar um invariante, ponha a guarda de COBERTURA no teste**: so e seguro enquanto
  ele cala UM texto, e a proxima reescrita do texto do material apagaria a etiqueta em silencio.

- **A JANELINHA DO CONTADOR CUSTAVA DUAS CONTAGENS POR CONTATO CONCLUIDO** (24/09/2026, a rodada
  parada por limite de requisicoes em `GET /chat/v6/session` com **222 concluidos no dia**).
  `contarMeuDia` pede a MESMA rota duas vezes com **`skipCount=false`**, o parametro que manda a API
  **CALCULAR o total** — a consulta mais cara deste painel, e a que a plataforma evita pedindo a dela
  com `skipCount=true` (registrado em 30/08). E `agendarContagem` dispara **a cada conclusao**:
  simulado com os numeros da print, 271 medicoes = **542 requisicoes** numa rodada de 37 min. Hoje ha
  **piso de 30 s** entre medicoes (74 medicoes, −73%), o botao "Atualizar" passa por cima
  (`forcado`), e as duas contagens **deixaram de sair em `Promise.all`** — duas consultas de contagem
  no mesmo instante e rajada contra o limitador. **Ao por um gatilho "atualiza a cada X", pergunte
  quanto X acontece numa RODADA** — uma vez por conclusao a mao e barato; 222 vezes seguidas, nao. O
  teste conta quantas requisicoes ficam no ar ao mesmo tempo.
- **"CARREGANDO..." PARA SEMPRE: o cabecalho nao envelhecia com o `catch` do `load()`** (mesma
  print). O erro ia para o rodape e o cabecalho continuava anunciando um carregamento que tinha
  terminado em falha; o painel parecia travado. E a falha da CONTAGEM mandava *"de F5 e recomece com
  uma pausa maior"* — conselho de rodada, numa janelinha que tem botao de Atualizar e nao estava
  rodando nada: `traduzirErroDeRede` passou a receber o *como seguir* de quem chama. **Mensagem que
  acerta o sintoma e erra a acao custa uma sessao de diagnostico** — e a licao de 20/09 vale de novo:
  ao escrever "estou fazendo X", escreva junto o que a tela diz quando X falhou.

- **ENGASGO DE REDE NÃO PARA A RODADA; DEFEITO PARA** (22/09/2026, *"fetch failed está parando bastante o
  automatizado"*). Qualquer `erro` parava o laço, inclusive o `Failed to fetch` do limitador de taxa, cuja
  ação certa é esperar. Hoje `api.ehErroDeRede` separa os dois, o engasgo espera (30 s / 1 min / 2 min) e
  segue para o PRÓXIMO, e três seguidos param. **Não refaça o contato que falhou**: o erro pode ter vindo
  depois do envio. E o transporte põe a ROTA na frente do `Failed to fetch` — é por ela que se mede de
  onde vem o excesso.

- **"ELA FALOU ALGO" É A INVERSÃO, NÃO MAIS UMA LISTA DE PERGUNTAS** (22/09/2026). A pergunta sem "?"
  que não abre a mensagem (*"E quais os projetos dele"*) CONCLUÍA, e a fala que não é pergunta
  (*"queria entender a proposta"*) recebia o modelo. `cortesia.falouAlgoProprio` lista o que NÃO pede
  resposta e o resto com 3+ palavras de conteúdo vai para `pedeRespostaPessoal` (tecla 6). **O
  `jaSabemos` é obrigatório**: sem o nome e a cidade que o parser tirou, a resposta ao formulário
  viraria caso da IA. **Ao mexer em `PALAVRAS_SEM_CONTEUDO`, "não" fica de fora** — é a negação que faz
  *"não recebi o material"* pedir resposta.

- **ABRIR ATENDIMENTO NOVO POR API: `PUT /chat/v1/session`, E O `senderId` NAO E IDENTIDADE**
  (01/10/2026, pedido dele: *"teremos que abrir um novo atendimento e abrir a conversa por la e
  mandar a colinha... tem que ser escolhida a equipe e o numero"*). Corpo lido no bundle, no
  `execute()` do dialogo do botao `data-cy="button-start-session"`:
  `{contactId, templateId: null, departmentId, channelId, compiledTemplate: null}` — **os dois nulos
  sao o caminho SEM modelo aprovado**, que e o unico possivel em canal nao oficial. **PUT cria**
  (como em `createTag`, onde POST atualiza). Junto entraram `GET /core/v1/department` (as equipes),
  `GET /chat/v4/channel/my` (os numeros com `status`, `quality`, `type`, `typeDetails`) e
  `api.mandarTexto`, que usa a **MESMA rota do envio de imagem** (`PUT .../message`) com
  `type: 'TEXT'` — `page.sendText` nao serve aqui, porque digita no campo da conversa ABERTA e nesta
  rodada nao ha conversa na tela.
  **A CORRECAO QUE DESTRAVOU ISSO: `senderId` e um uuid v4 gerado POR MENSAGEM**, nao a identidade
  da sessao. O `api.js` dizia *"toda mensagem da sessao carrega o mesmo senderId"* desde 20/09 e e
  falso — o app faz `senderId: uuid()` em `createMessage`, `sendFileMessage` e
  `resendTemplateMessage`. A crenca antiga tornava este pedido impossivel: **atendimento
  recem-criado nao tem mensagem de onde copiar**, e o envio de imagem exige o campo. Hoje ha
  `api.novoSenderId()`.
  **"Ja existe um atendimento" NAO e erro** — e o caso que a propria tela trata com um botao; para a
  rodada e PULO (entrar no meio da conversa de alguem). Erro desconhecido PARA a rodada no primeiro
  contato, porque **a rota nunca foi executada** e o primeiro e a sonda (o botao "Testar em UM
  contato" faz isso de proposito).
  **E o `exceptTagsId` do filtro de contatos e o que torna o lote REPETIVEL:** a lista sai com
  `tagsId: [etiqueta escolhida]` e `exceptTagsId: [sem interesse, etiqueta do lote]`, entao quem ja
  recebeu nao volta. O filtro da TELA daria o primeiro e nunca o segundo — e por isso a etiqueta e
  escolhida no cartao, nao filtrada na tela de Contatos.
  **`rodar` ganhou `percorrer`, que troca o PERCURSO e nao o motor:** `percorrerFila` anda pela fila,
  `percorrerContatos` anda pela lista da API. Keepalive, trava de suspensao, janelinha, log e
  veredito nao foram duplicados — *"rodada com motor proprio nao herda conserto"* (03/09). As duas
  pre-conferencias de fila ficam de fora quando ha `percorrer`: ali seriam alarme falso.
  **CONCLUIR e `POST /chat/v1/session/{id}/complete` com corpo VAZIO** (decisao dele, 01/10: *"sim
  tem que concluir"*) — e exatamente o que o botao "Concluir" da tela chama; o corpo cheio
  (`statusReasonId`, `statusReasonEnum`, `statusReasonAmount`) e a outra opcao do menu,
  "Classificar e concluir", que e escolha dele por contato. `concluirPeloPainel` nao serve: e DOM e
  precisa da conversa ABERTA.
  **E A GUARDA QUE O BUNDLE ENTREGOU JUNTO: concluir CANCELA mensagem em fila.** Antes de concluir, a
  tela chama `validateQueuedMessages` e avisa que *"essas mensagens serao canceladas"* — o mesmo texto
  ja registrado em 01/09 como o dialogo que a rodada resolve. Pela API **nao ha dialogo**, entao a
  rodada cancelaria o proprio envio e contaria como enviado. Hoje `imagem.enviarImagem` devolve o
  **`status`** da mensagem e `QUEUED` **nao e concluido** — o atendimento fica aberto e a linha diz
  por que. **Ao concluir por API depois de mandar, confira o status da mensagem.**
  A ordem e **abrir -> mandar -> marcar -> concluir**, e cada passo falha sem desfazer o anterior.
  **A conclusao NAO grava a "Data de conclusao do contato"**: aquele campo e escrita nossa
  (`saveClassification`) e a decisao de 31/08 vale — a unica escrita no CRM deste lote e a etiqueta.
  **Custo: ~8 requisicoes por contato** (1 abrir + 5 imagem + 1 etiqueta + 1 concluir) contra ~9 da
  rodada de fila, porque **esta nao chama `load()`** — a decisao nao depende da conversa e as
  etiquetas vieram no filtro.
- **ENVIO EM LOTE (imagem + legenda) E UMA RODADA FORA DO QUADRO, E AS PROTECOES CONTINUAM**
  (01/10/2026, pedido dele: *"preciso enviar uma imagem e um texto especifico fora do fluxo... e va
  variando entre umas 4 imagens e descricoes diferentes enquanto manda"*). `lib/lote.js` + o cartao
  na aba Automatizado + `processarLote`. **Tres coisas para quem mexer:**
  **(1) O par e imagem COM texto** — cruzar 4 artes com 4 descricoes daria 16 combinacoes e legenda
  falando de uma imagem que nao e a que foi. Par pela metade fica fora do revezamento; par VAZIO
  nao e falta.
  **(2) Fora do quadro NAO e fora das protecoes:** barreira do canal, etiqueta de sem interesse /
  assessor, e *"ja recebeu QUALQUER par"* — este ultimo e a armadilha do rodizio (02/09), em que a
  conferencia olhava so o item sorteado e bastava o ponteiro andar para o contato receber de novo.
  O ponteiro e o `varianteIndex` (id `lote-imagem`) e **so anda depois que a mensagem sai**.
  **(3) `continuaNaFila: true` era OBRIGATORIO e a falta e invisivel:** `enviado` conta no limite,
  entao sem a marca `saiuDaLista` da true, a posicao nao anda e a rodada reabre o MESMO contato toda
  volta — o `visitados` evita o envio duplo ao custo de uma abertura extra por contato, e abertura e
  o que derruba a API. **Ao escrever rodada que nao conclui nem assume, diga que o contato continua
  na fila.**
  **(4) A ETIQUETA DO LOTE e a trava do reenvio, e nao so o recibo** (01/10/2026, pedido dele: *"ao
  mandar essa imagem bote a etiqueta COLINHA"*). `auto.etiquetaLote`, **nasce com `COLINHA`** porque
  `auto` esta na mescla do `get` e campo em branco nunca chegaria (a armadilha de 04/09); vazio e a
  escolha explicita de mandar sem marcar. **Ela e consultada ANTES da conversa** em
  `lote.porqueNaoMandar`: conversa e memoria da SESSAO (a armadilha da Rosa, 05/09) e quem volta dias
  depois receberia a arte outra vez — a etiqueta e a memoria de verdade. **Nao passa pela conferencia
  da IA** (a regra de 17/09 e para etiqueta que afirma o que a PESSOA quis dizer; esta afirma o que
  NOS fizemos) e **nao e por candidato** (etiqueta e organizacao interna, nao o que o eleitor recebe).
  **Ela BARRA antes da fila e nunca no meio dela:** etiqueta que nao existe no CRM falha para TODOS e
  a rodada se recusa a comecar — o oposto da regra de 20/08, que vale para a falha de UM contato. A
  comparacao e por `tag.id` contra `state.contact.tagsId`: por rotulo seria a armadilha do rotulo
  repetido, e pela lista da caixa da rodada seria a de 31/08.
  **E o custo medido e ~9 requisicoes por contato** (1 abertura + 3 do `load` + **5 do envio de
  imagem**): 40 contatos sao ~360, e a rodada que estourou o limitador em 24/09 fez 444 — o limite e
  a pausa sao o freio. **Reaproveitar o `fileId` entre contatos cortaria para ~5 e e HIPOTESE**: o
  envio gravado tem um `fileId` por mensagem e ninguem observou a plataforma aceitar o mesmo arquivo
  em duas: a sonda e mandar duas no contato de teste com o mesmo id e reler a resposta.
- **A IMAGEM SAI POR CINCO PASSOS, E CADA METADE TEM QUE SAIR DE UM LUGAR DIFERENTE** (20/09/2026,
  gravado observando ele mandar uma à mão). `POST /core/v1/file/upload` → **`PUT` dos bytes no
  endereço assinado do S3** → `POST /core/v1/file/transform` → `PUT /core/v1/file` (devolve o
  `fileId`) → `PUT /chat/v1/session/{id}/message` com `type: 'IMAGE'`. **Os quatro na API do mobiliza
  saem da ABA** (ela valida o `Origin`) e **o PUT no S3 sai do SERVICE WORKER** — requisição de
  content script para outro host esbarra no CORS, e quem carrega `host_permissions` é o worker. O
  que atravessa a ponte é a CHAVE do armazenamento, nunca os bytes. Duas coisas a lembrar: o
  endereço assinado leva `X-Amz-SignedHeaders=content-type`, então **o `Content-Type` do PUT tem que
  ser o mesmo que foi assinado**, senão volta 403; e o `POST .../read` que aparece na gravação é a
  plataforma marcando a conversa como lida, **não** faz parte do envio.
- **A LEGENDA É O `text` DA MENSAGEM DE IMAGEM, E SÓ CONTA SE VOLTAR NA RESPOSTA.** O envio gravado
  tinha `text: null` (ele mandou sem legenda), então **que o campo aceita legenda é hipótese** — e
  hipótese aqui é imagem muda chegando em eleitor. Por isso `legendaEntrou` relê a resposta e, não
  voltando, `sendTemplate` manda o texto do jeito de sempre: o pior caso vira duas mensagens. É a
  armadilha mais antiga do projeto (*a API responde 200 e ignora*) aplicada a um campo novo.
- **FORMATO DE IMAGEM É LISTA DE PERMISSÃO: só JPEG, porque só JPEG foi observado.** O passo do
  `transform` é o único cujo valor não se deriva (`.jpeg` → `jpg`); o que a plataforma faz com PNG
  **ninguém viu**. A lista inversa faria todo formato novo nascer aceito até alguém notar — e o
  "notar" seria uma arte que não chega. Para liberar outro: mandar um à mão com o gravador ligado.
- **O VERIFICADOR DE REFERÊNCIAS NÃO ENTENDIA `'\\\\'`, e isso vale nos DOIS sentidos**
  (20/09/2026). Ele acusou **61 problemas inventados** — `Anthropic()`, `cadastro()`, `bastante()`,
  todas palavras de dentro de comentário. Causa: o fim de string era `c === fecho && anterior !== '\\'`,
  e numa string de duas barras escapadas a aspa de fechamento parece escapada; a string "não
  fechava", o pareamento de aspas saía deslocado dali em diante e comentário virava código à vista.
  **O outro lado é pior e é silencioso:** deslocado, o pareamento também apaga código de verdade, e
  aí o verificador deixa de ver a chamada que sumiu — que é a única coisa que ele existe para ver.
  Hoje a barra invertida consome o par, como já fazia na regex. **Se ele começar a acusar dezenas de
  palavras em português, o defeito é dele, não do código** — procure a string que não fechou.

- **ESPERA LONGA NAO PODE PASSAR POR `withBusy` — ela sequestra o painel inteiro** (20/09/2026, *"travou
  para começar os novos, o botão bloqueou"*). `withBusy` abre com `if (state.busy) return`: é um
  interruptor ÚNICO, então o laço que esperava ele mandar a imagem à mão (até 200 s) matava TODO botão do
  painel em silêncio, inclusive "Começar pelos Novos". Pior: a espera é exatamente aquela em que ele
  precisa da plataforma **e** do painel. A forma veio do aprendizado do contrato de escrita, que faz o
  mesmo desde sempre (150 s) e não incomodava por ser botão raro. Hoje o caminho é
  **`semTravarOPainel(chave, fn)`**, com trava por TAREFA, e quem espera tem botão de PARAR e **rodada
  numerada** — parar e recomeçar deixa o laço antigo vivo por até 2 s, e ao acabar ele desligaria a
  gravação que a rodada nova ligou. **Regra: `withBusy` é para ação que o painel termina sozinho; espera
  que quem termina é ELE, na outra metade da tela, nunca.**
- **AVISO QUE NAO ENVELHECE COM O QUE JA FOI FEITO E AVISO QUE MENTE** (mesma print). O texto *"falta o
  passo de aprender o envio"* continuava na tela com o envio já aprendido, porque não consultava
  `state.contratoImagem`. É a família do aviso que mandava procurar o interruptor na aba errada (06/09) e
  do log que dizia *"não gravada"* e gravava (07/09). **Ao escrever aviso de "falta fazer X", escreva
  junto o que ele diz DEPOIS de X feito** — e deixe só a parte que continua verdadeira.

- **O CLIQUE NO ANUNCIO E O PEDIDO ESCRITO SAO SINAIS DIFERENTES** (19/09/2026, o Jair: escreveu pedindo
  material na chegada e recebeu so o recibo). `pedeMaterial` conta o clique de proposito (o anuncio de
  material E o pedido); para dizer "ela pediu algo que o recibo nao responde" o sinal e
  `pedeMaterialEscrito`, que entra em `pedeRespostaPessoal` como a roupa. **Conserto de uma caixa do ramo
  de quem VOLTA nao alcanca a CHEGADA** — a v3.86 consertou `ja-respondemos-antes` e o mesmo pedido caiu
  no recibo um dia depois.
- **REGRA QUE LE CHAVE QUE O PAINEL NAO ESCREVE ESTA MORTA, E O TESTE NAO VE** (18/09/2026, a Rita:
  pediu adesivo e bandeira, recebeu a mensagem do momento e bloqueou o numero). A guarda do material em
  `sugestao.js` lia `c.pedeMaterial`; o painel escreve `materialPendente`. Duas regras mortas por DUAS
  SEMANAS, com testes verdes, porque os testes montavam o contexto a mao com o nome que a regra lia.
  **Ao escrever `c.<chave>` numa regra, procure a mesma chave no objeto que o painel monta** — e o teste
  de regressao se monta com o contexto que o PAINEL produz, nunca com o nome que a regra espera.
- **A IA VE O CONTEXTO; QUEM REPETIA ERA `revisarRascunho`** (15/09/2026). Relato dele: *"a IA tem
  agradecido multiplas vezes pelo apoio e dado boa tarde multiplas vezes, uma mensagem apos a
  outra"*. Medido: o bloco do contato ja manda a conversa inteira com NOS/ELA, ja marca
  `← ja respondida`, a VOZ ja manda emendar e a regra de 12/09 ja manda nao repetir — e o rascunho
  repetido saiu com **zero avisos**; pior, a saudacao ERRADA era **consertada**, ou seja, a segunda
  "boa tarde" do dia saia bem-formada. A linha *"se abrir com saudacao, a correta agora e X"* e a
  **segunda** do bloco e a VOZ vem depois da conversa: **licao do item 22 (07/09) outra vez**. Hoje
  `ia.semSaudacao` TIRA a saudacao quando `jaFalamosHoje`, e `ia.semRepetirONosso` tira a frase que
  reescreve a nossa ultima fala (80% das palavras de conteudo). **Tres guardas:** pergunta nunca sai,
  frase com menos de duas palavras de conteudo nao conta, e piso de 40 caracteres — sobrando so a
  repeticao, o texto FICA e `sopraRepeticao` barra o envio automatico. **Sem contexto nao confere
  nada** (rascunho pedido a mao). **Ao por regra nova no prompt, ponha-a onde o modelo escreve — e
  pergunte se ela nao e mecanica.**
- **REDESENHAR NAO PERDE A ROLAGEM; O CONTEUDO QUE CHEGA DEPOIS PERDE** (13/09/2026). Relato dele:
  *"varios botoes ao serem clicados rolam a pagina da extensao"*. Medido: `replaceChildren` + desenho
  na mesma tarefa mantem a rolagem (1500 → 1500); desenho curto com o resto chegando depois a leva
  para 240 e ela nao volta — e as abas Automatizado e Config tem pedacos que esperam o armazenamento.
  Hoje `panel/rolagem.js` guarda antes de `renderAll` e devolve a cada mudanca do corpo (no mesmo
  passe do `encolherExplicacoes`), por 4 s, soltando na roda/toque/tecla/barra. **Nao ponha
  `scrollIntoView` nem `focus()` DENTRO do corpo** sem soltar a guarda antes: dentro da janela, a
  guarda le qualquer mudanca da rolagem como o navegador mexendo e puxa de volta.
  **E o navegador empurra para BAIXO tambem (v3.59, mesmo dia):** *"ao adicionar anuncio novo ele rola
  toda vez pro fim"* — a ANCORAGEM de rolagem do Chrome segura na tela o que estava visivel quando o
  conteudo ACIMA muda de altura, e a lista de anuncios some e volta acima do resto (1764 → 2765). A
  guarda da v3.58 so devolvia a queda. Hoje `.wf-body` tem `overflow-anchor: none` e a guarda devolve
  nos dois sentidos. **Ao medir defeito de rolagem, meca os DOIS sentidos**: a primeira medicao so
  procurava a queda, e o caso dele era o contrario.
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

- **A CAMPANHA ACABOU, E A REGRA 12 CONTINUAVA OFERECENDO VAGA NELA** (15/10/2026, *"Quanto paga?"*
  recebeu *"nao estamos contratando, so estamos trabalhando com voluntarios... se tiver interesse
  nesse formato, me avise"* — *"resposta ainda se tratando de campanha, a campanha acabou do martim
  e a conversa era um provavel engano de remetente"*).
  **Medido: o texto e BYTE A BYTE o modelo escrito na regra 12.** Nao foi resposta pronta e nao foi
  o detector — **`pedeEmprego` NAO CHEGA A IA** (nao esta em nenhum argumento de `rascunhar`), e
  quem mandou o caso para la foi `pergunta-aberta`. A regra 12 esta em TODA chamada e foi puxada
  pela proximidade com "paga". **Antes de culpar o detector por um texto da IA, confira se ele
  chega ao prompt.**
  **E O DOSSIE NAO CHEGA NESTE CASO:** medido, *"Quanto paga?"* nao aciona `precisaDoDossie`, entao
  as linhas sobre a eleicao de 04/10 **nunca entram**. Fato que desmente uma regra tem de morar
  DENTRO dela (07/09) — no dossie ele e condicional, e a regra e incondicional.
  **O convite ao voluntariado virou frase PROIBIDA, escrita**: proibicao que nao nomeia a frase nao
  diz ao modelo qual evitar. E *"a campanha acabou"* entrou na lista do que NAO se diz ao eleitor.
  **ESCOPO:** *"Quanto paga?"* / *"qual o valor?"* soltos sao pergunta de PRECO — engano de
  destinatario —, e a resposta e a da regra 9, que e a frase que ELE digitou a mao. Terceira vez da
  licao de 10/09: **ao escrever regra sobre um assunto, escreva tambem o que ela NAO cobre.**
  **E o detector decidia sozinho dizendo que nao decidia:** `MENCIONA_REMUNERACAO` era item de
  `QUER_TRABALHAR` e o comentario em cima dizia *"sozinha ela nao decide nada"*. Hoje sao duas —
  `REMUNERACAO_DO_TRABALHO` (salario, remunerado, quanto vou ganhar) decide; `PRECO_SOLTO` nao.
  **Fica em aberto:** `"voces estao contratando?"` nao casa (o padrao exige objeto depois do verbo)
  e o comentario do codigo diz que casa — mesma classe, nao consertado junto porque alarga no
  commit que estreita.

- **RESPOSTA PRONTA COM VARIANTES SAIA DUAS VEZES, E A SEGUNDA PARECIA OUTRA MENSAGEM** (15/10/2026,
  *"novamente repeticao, a pessoa finalizou a conversa"*). `agradecer-apoio` saiu as 13:11 na
  **variante 2** e as 13:48 no **texto base** — byte a byte a mesma resposta pronta.
  **NAO foi a IA, e a medicao disse isso ANTES de eu mexer:** `semRepetirONosso` TIRARIA a frase
  identica (*"Que Deus abencoe voce e sua familia"*), e ela saiu inteira — logo o texto nunca passou
  pela revisao, porque **resposta pronta nao passa por la**. Eu ia consertar o prompt pela terceira
  vez e teria consertado o lugar errado. **Antes de culpar a IA por repeticao, rode a guarda nos
  dois textos: se ela TIRARIA algo, o texto nao veio da IA.**
  **E a armadilha de 02/09 numa porta nova** — *a conferencia de duplicata tem de cobrir todo o
  conjunto que pode sair, nao o item sorteado*: aquele dia a licao foi aplicada ao MODELO PADRAO com
  rodizio, e as RESPOSTAS PRONTAS com variantes ficaram de fora.
  Hoje `templates.ehAgradecimentoDeApoio` reconhece pelo INVARIANTE e o painel cala
  `soExpressaApoio` quando ele ja saiu. **No SINAL e nao em excecao da caixa** (a trava da Cleonice,
  06/09), entao vale no quadro dele sem importar. **O ajudante foi GENERALIZADO em vez de
  duplicado:** `negativaJaSaiu` -> `respostaJaSaiu`.
  **Medido:** calado o sinal decide `ja-respondemos-antes` -> tecla 3 (conclui sem enviar nada), que
  e silencioso — a guarda nao empurra para caixa que envia. **E a COBERTURA e a prova:** 3/3 das
  formas e ZERO falso positivo contra todas as respostas de fabrica.

- **ANUNCIO DESLIGADO E SEM RECIBO: SAI A MENSAGEM DO DIA, NAO O FORMULARIO SECO** (pedido dele,
  dito DUAS vezes — 14/10 *"no caso era pra mandar mensagem do dia"* e 15/10 *"mesmo caso
  novamente"*. Na primeira eu medi, expliquei e devolvi a decisao a ele; **ele repetir E a
  decisao**).
  **Medido, e o escopo e estreito:** o formulario sozinho so aparece quando **nao ha recibo nenhum**
  — com modelo, `anuncio-modelo-e-dados` decide acima e manda recibo + dados (tecla `a`). Entao a
  mudanca so morde no anuncio que ele desligou ou nunca cadastrou.
  **A mudanca mora no DESFECHO** (tecla-funcao de `nunca-pediram-dados`), nao na posicao: a guarda
  decide o desfecho e nao se a caixa casa (06/09), e excecao que ele nomeia vai no codigo e nao no
  quadro (04/09). **Medido: vale no quadro dele SEM importar nada** — o arquivo 3.151.0 ja da tecla 5.
  **O cadastro atrasa, nao some:** saida a do momento, `momentoJaEnviado` vale e a passada seguinte
  pede nome e cidade. Sem momento configurado, o formulario continua.
  **O selo continua `envia` e nao `depende`** — as duas saidas MANDAM —, e **a matriz do teste de
  tecla-funcao ganhou `veioDeAnuncio` e `anuncioReconhecido`**: campo novo lido por tecla-funcao
  entra la, senao o teste acusa o verbete de inventar um desfecho que existe.

- **A REGRA ANTI-REPETICAO MANDAVA ESCREVER A REPETICAO** (15/10/2026, *"repeticao ocorrendo"*:
  10:59 *"Agradeco por compartilhar essa informacao. Estamos atentos e acompanhando situacoes como
  essa."*; ela reforca as 11:00; 11:51 *"Agradeco por reforcar essa preocupacao. Estamos atentos e
  acompanhando as informacoes com responsabilidade."*).
  **O modelo OBEDECEU:** o fim da regra dizia *"se nao houver nada novo, escreva uma linha curta que
  reconheca o que ela disse"* — e, sendo a primeira mensagem ja um reconhecimento, a unica forma de
  cumprir era reconhecer de novo com outras palavras. **Toda regra que obriga um CONTEUDO e uma
  hipotese de repeticao** (17/09), e desta vez a obrigada era a propria anti-repeticao.
  **`semRepetirONosso` nao pega e NAO e para baixar a regua:** medido, as frases compartilham **60%**
  e **50%** das palavras de conteudo contra os 80% da regua — **isto e PARAFRASE**, e a 50% a guarda
  passaria a apagar frase legitima (duas frases sobre o mesmo assunto compartilham metade das
  palavras). Ha assercao travando isso. **A guarda estava bem alimentada** — conferi `nossaUltima`
  antes de mexer na regua.
  **O desfecho e `naoHaOQueResponder`** (24/09), que ja abstem e ja manda a mensagem do dia; a
  **regra 16 foi alargada junto**, senao a regra colada no pedido mandaria marcar um campo que o
  sistema define so para "nao entendi" — **duas descricoes do mesmo campo discordando e como o
  modelo escolhe a que preferir.**

- **COMEMORAR TAMBEM E APOIO, E APOIO NAO SE CORRIGE — e quem corrigiu foi um FATO que eu escrevi**
  (15/10/2026, print: ela comemorou *"todos meus candidatos se elegerao, so Flavio mas vai ser
  Presidente com certeza"* e recebeu *"a Presidencia ainda sera decidida no segundo turno, em 25 de
  outubro"*; ele apagou: *"cortou o apoio da pessoa em vez de torcer junto"*).
  **Medido: o dossie FOI puxado** (`precisaDoDossie` true) e dele chegam a IA **nove linhas sobre o
  2o turno**, que eu acrescentei na vespera para impedir pedido de voto em eleicao encerrada. **O
  fato existia para NAO pedir voto e virou correcao em cima de quem veio comemorar** — a licao de
  08/09 (*regra sem escopo e cumprida ate onde ela nao devia ir*) **com o agravante de que era um
  FATO, e fato nao parece regra: parece informacao inofensiva.**
  **Ao por numero, data ou placar no dossie, escreva COLADO nele para que serve e onde ele PARA** —
  e em PROSA, nunca em linha `> `, que `semBlocoDeRevisao` corta antes do modelo.
  **A regra 17 cobria so o xingamento** e hoje cobre comemoracao e previsao. **A guarda que a mantem
  util:** quem PERGUNTA de verdade continua sendo respondida, e o 2o turno entra como CONVITE
  (*"agora e levar todo mundo no dia 25"*), nunca como reparo.
  **Nenhum detector novo:** `soExpressaApoio` devolve null para a comemoracao e NAO foi alargado —
  **forma de expressar apoio nao fecha em lista (SEXTA vez)**, e o conserto e o que a IA le.
  **E a QUARTA mensagem da plataforma lida como fala dela:** *"...nao foi encontrada na base de
  dados, solicite mais informacoes ao contato"* — a pior da familia, porque **da uma ORDEM** sentada
  no fluxo de quem escreve. Recorte pela frase do meio; a abertura e o fecho mudam de redacao.

- **A ELEICAO FOI EM 04/10/2026, E O DOSSIE ESTAVA ESCRITO NO FUTURO** (14/10/2026, *"pesquise e
  atualize o dossie"*). **Capitao Martim REELEITO** com 37.589 votos (41º de 55, +29% sobre 2022);
  Zucco governador eleito no 1º turno (58,05%); Sanderson e Van Hattem senadores eleitos; **Felipe
  Pedri NAO eleito** (12.810 votos, 65º). **Cinco dos seis cargos da colinha estao decididos** — o
  unico que ainda pede voto e a Presidencia, no **2º turno de 25/10/2026**.
  **Consequencia que vale mais que o dossie: pedir voto para deputado, senador ou governador hoje e
  pedir voto em eleicao que acabou**, e quem recebe entende que do outro lado nao ha ninguem
  acompanhando. Entrou em TRES lugares que chegam ao prompt (a regra 5 do cabecalho, o primeiro item
  dos "NUNCA afirmar" e um paragrafo colado na propria regra da colinha) — **regra longe do pedido
  nao e cumprida**, licao de 07/09.
  **A regra da colinha NAO foi mudada**: e decisao dele de 09/09 e continua escrita como ele a
  definiu; o que entrou foi o fato. **Ficam em aberto, e sao dele:** o disparo da colinha continua
  configurado pedindo voto, e o perfil do Felipe Pedri na extensao.

- **A TABELA DA CHAPA E LIDA POR CODIGO, POR POSICAO — e mexer nela desarma a trava em silencio**
  (14/10/2026). `gabinete.chapaDoDossie` pega `cargo`, `nome` e `numero` das **tres primeiras
  colunas**, e alimenta `ia.conferirChapa`, que procura o **nome literal** no rascunho. Eu pus o
  partido dentro da celula do nome (*"Flavio Bolsonaro (PL)"*): a trava deixaria de achar a pessoa e
  **pararia de barrar**, sem teste nenhum caindo. **Coluna nova entra DEPOIS do numero, e o nome
  fica sozinho na celula.** Ha teste exigindo as 6 linhas, nome sem parenteses e numero so de
  digitos.
  **E linha `> ` NAO CHEGA A IA** — `semBlocoDeRevisao` corta as citacoes. Esta registrado desde
  07/09 e eu cai nela assim mesmo: escrevi os dois avisos mais importantes do dia dentro de blocos
  `>` e a medicao mostrou CORTADO nos dois, deixando a regra da colinha chegar ao modelo **sem** o
  aviso de que envelheceu. **O que o modelo precisa ler e prosa normal; `>` e so para humano** — e a
  conferencia e aplicar a peneira (`filter(l => !l.startsWith('> '))`) e procurar o trecho.

- **`chapa()` USA `fetch`, QUE NO NODE PURO NAO ABRE `file://`** (14/10/2026). Medi
  `chapaDoDossie()` e veio **0 entradas**; eu ja ia consertar o leitor. Duas causas minhas, nenhuma
  do codigo: a funcao recebe o TEXTO por argumento e eu a chamei vazia, e `chapa()` le o arquivo
  pela ponte que so existe no harness. **Passando o texto do disco ela devolve as 6 certas.** Antes
  de consertar um leitor que devolve vazio fora dos testes, confira se o vazio nao e a sua chamada.

- **GIRIA GAUCHA: "TEMOS JUNTO GALO VEIO?" NAO ERA APOIO, E A IA PEDIU PARA ELE EXPLICAR**
  (26/09/2026, print de quem chegou pelo anuncio e recebeu *"Voce pode me explicar um pouco melhor o
  que quis dizer com 'galo veio'?"* — *"nao reconheceu girias gauchescas"*). **Duas causas somadas:**
  `soExpressaApoio` conhecia `tamo junto`, `tamos junto`, `estamos junto` e `to junto` e **nao
  `temos junto`**, que e a grafia do falado; e, ja casando, o **`?` de *"galo veio?"*** descartava o
  apoio, porque a funcao se cala havendo pergunta aberta. **QUARTA vez que um "?" que ninguem digitou
  como pergunta custa uma print** (a query string em 05/09, o rabisco em 24/09).
  **O conserto muda o DESFECHO, medido:** com o apoio reconhecido `falouAlgoProprio` se cala sozinho
  (ele consulta `soExpressaApoio`), `pedeRespostaPessoal` cai junto, e o caso sai da tecla 6 para a
  tecla `a` — o recibo do anuncio com o pedido de cadastro.
  **`semVocativoDeTratamento` vale SO dentro de `soExpressaApoio`**: `conversaTemPerguntaAberta`
  fica intacta, entao *"galo veio, voces tem material?"* continua sendo pergunta. `veio` e `velho`
  sozinhos ficam fora da lista.
  **E a REGRA 18 e a metade que cobre a classe:** a regra 16 foi CUMPRIDA ao pe da letra — a IA nao
  inventou e nao devolveu as palavras dele, ela PERGUNTOU, que a 16 nao proibia. E a forma do *"como
  esta o capitao"* (17/09): **"nao invente" nao significa "nao responda", e aqui nao significa
  tambem "peca para explicar"**. O dano e desta base: quem escreve e do RS, e pedir a um gaucho que
  explique "galo velho" diz que quem responde nao e daqui. A fronteira mora dentro da regra (nao e
  licenca para imitar o sotaque; pergunta com giria dentro continua sendo respondida), e a 16 passou
  a apontar para a 18.
- **O `checar-referencias` E LENTO, E NAO SAO AS EXPRESSOES REGULARES** (medido em 26/09/2026, as
  tres versoes em sequencia na mesma maquina: **199 s** antes da passada de escopo, **169 s** com ela
  na forma de uma regex por nome por linha, **122 s** com a varredura contra `Set`). Duas leituras, e
  a primeira desmente a suspeita que me levou a medir: **a passada de escopo nunca foi a causa** — sem
  ela ja eram 199 s —, e a otimizacao cortou **28%**. **O gargalo que sobra e o `soCodigo`** — 10,7 s so no `panel.js` (695 KB), e ele roda duas
  vezes por arquivo; todas as regex do arquivo ficam abaixo de 20 ms. Fica registrado para ninguem
  refazer a investigacao: acelerar exige mexer no laco char-a-char do `soCodigo`, que e a funcao mais
  delicada dali (a armadilha do `'\\'`, 20/09). A passada de escopo foi otimizada assim mesmo (uma
  varredura de chamadas por linha contra um `Set`, em vez de uma regex por nome por linha), porque
  **verificador lento e verificador que alguem deixa de rodar**.
- **"VOCES PODEM IR PARA O INFERNO" NAO ERA SEM INTERESSE — a lista so tinha o IMPERATIVO**
  (26/09/2026, audio de 8s: *"por mim voces podem ir tudo para o inferno, Flavio, Mizuco e tudo
  junto"*, que recebeu *"respeito sua opiniao"* + o pedido de cadastro — *"claramente sem interesse,
  nao tem necessidade de resposta, nao foi etiquetado tambem"*).
  **Medido, e a primeira suspeita estava errada: NAO era a transcricao** — o mesmo texto DIGITADO
  tambem devolvia null. A lista de 05/09 conhecia *"va para o inferno"* e nao a forma perifrastica
  **com o pronome escrito**, que e MAIS dirigida, nao menos. **Terceira vez da licao do "queria uma
  reuniao" (09/09): a lista era toda de UMA forma verbal.**
  **O conserto nao e acrescentar formas — elas nao fecham.** E separar o DESTINO do verbo
  (`DESTINO_DE_XINGAMENTO`) e deixar a direcao ser provada por `DIRIGIDA_A_NOS`, como `AGRESSAO`
  sempre fez; o imperativo sozinho continua valendo como direcao (05/09).
  **A guarda e o ADVERSARIO na mesma mensagem, e e obrigatoria:** esta base manda o Lula e o PT para
  o inferno o dia inteiro, e sem ela a etiqueta — PERMANENTE no CRM e com conclusao em silencio —
  cairia em cima de quem mais apoia. Mesma mecanica do `SEM_ADVERSARIO_NO_MEIO` da regra do PL.
  **Bateria de 28: 23 antes, 28 depois**, com 5 casos que tem o pronome E o destino e mesmo assim
  nao podem marcar (*"voces viram? o Lula foi pro inferno"*). 14 das 22 assercoes sao falso positivo.
  **E `falouAlgoProprio` se cala sozinho** porque consulta `semInteresse` (22/09) — o caso deixou de
  ir para a tecla 6 sem reordenar nada. **A ETIQUETA em si nunca esteve quebrada:** ela mora na tecla
  `s`, passa pela conferencia da IA (17/09) e depende do campo "Etiqueta de SEM INTERESSE" preenchido.
- **A HEURISTICA DO "OLA" RECUSAVA TEXTO DE ANUNCIO CADASTRADO, E ELE VIRAVA FALA DELE**
  (25/09/2026, o Valdeci: *"nao mandou o modelo do anuncio"*, com o texto pre-preenchido cadastrado
  na Config palavra por palavra). **Medido: `ehOTextoDoAnuncio` = true e
  `pareceTextoProntoDeAnuncio` = false** — e sem a marca `pedeMaterialEscrito` e `falouAlgoProprio`
  ligam, os dois levam a tecla 6, e a IA escreve no lugar do recibo.
  **O defeito e de ORDEM dentro de `prepararEntrantes`:** a PRIMEIRA mensagem so passava pela
  heurística (abre com "Ola", ate 160), e o dado cadastrado so era consultado no terceiro ramo, que
  nunca e alcancado para ela. **E a guarda do Rodrigo (10/09) mordendo pelo outro lado** — ela existe
  para nao apagar a fala de quem chega por anuncio SEM texto pronto, e recusava um texto pronto de
  verdade porque a redacao mudou. **Lista de redacoes nao fecha; o que fecha e o que ELE cadastrou.**
  A guarda que torna isso seguro ja existia: `ehOTextoDoAnuncio` exige cobertura de **60%**, entao o
  pedido dele emendado no texto do anuncio continua contando como fala dele.
- **O ESTOQUE DO MATERIAL VIVE EM TRES LUGARES, E A TRAVA E UM DELES** (25/09/2026, *"inclua
  bandeiras na lista que de material que temos"*). **Medido antes de mexer: a trava barrava a frase
  certa** — *"o que temos sao folhetos, adesivos e bandeiras"* parava a rodada, porque `bandeira`
  estava em `ITEM_FISICO` dentro de `AVISOS_QUE_IMPEDEM_ENVIO.afirmouTer`. Mudar so o prompt seria a
  correcao dele de 12/09 ao contrario (*"eu quero que mude o que a IA diz, nao parar todo tempo para
  eu revisar"*). Os tres sao a **secao 25 do padrao dele**, a **regra 12 do prompt** e a **trava**, e
  ha teste exigindo que concordem. **Ao mexer no que TEMOS, meca a trava contra a frase que a regra
  nova produz, e confira que ela continua barrando alguma coisa** — bone, camiseta e placa ficam,
  porque trava que nao barra nada e decorativa (art. 39, § 6o da Lei 9.504/97). O DETECTOR nao mudou:
  `cortesia.OBJETO_DE_MATERIAL` sempre teve bandeira — a contradicao era entre a linha do ENDERECO
  (que ja mandava pedir o endereco de quem pede bandeira) e a regra 12 (que mandava negar).
- **XINGAR O ADVERSARIO E APOIO, E APOIO NAO SE CORRIGE** (25/09/2026, print de um apoiador que
  escreveu *"tirar fora esta cambada de esquerdista Ladroes"* e recebeu *"prefiro que esse debate
  seja feito com responsabilidade, sem generalizar acusacoes"* — *"quis dar licao de moral pra um
  apoiador, nao e o que queremos"*). **Medido: NENHUM detector viu apoio** — `soExpressaApoio` e
  `trouxeDenuncia` nulos, `semInteresse` nulo (a guarda de 01/09 funcionou), e so `falouAlgoProprio`
  levou a tecla 6. **A IA escreveu por conta propria, e a postura veio das secoes 7 e 14 do padrao
  DELE** — *"nao entre em confronto"*, *"Entendo sua critica"* —, que falam de critica **A NOS** e
  viram aula de civilidade quando o alvo e o ADVERSARIO.
  **E a frase certa ja existia no projeto, NO PROMPT ERRADO:** *"criticar ou xingar o ADVERSARIO (PT,
  Lula, esquerda) — quem faz isso esta do nosso lado"* mora em `TIPOS_DE_ETIQUETA`, que e o prompt
  da CONFERENCIA DE ETIQUETA; quem escreve o rascunho nunca a viu. **Ao escrever regra sobre o que
  esta base e, confira em qual dos prompts ela esta** — sao tres (rascunho, cidade, etiqueta).
  Hoje e a **regra 17**, com a fronteira dentro dela: nao e licenca para a IA xingar junto, ofensa
  contra NOS continua na secao 14 do padrao, e denuncia com alvo e fato continua na regra 15.
  **Nenhum detector novo**: forma de expressar apoio nao fecha em lista (quinta vez), e proibicao
  vale em toda chamada sem gatilho.

- **A REGRA 12 VAZAVA O MOTIVO INTERNO PARA DENTRO DA MENSAGEM** (25/09/2026, a Lizi: *"Oiii tem
  vaga para trabalhar"* recebeu *"A equipe paga da campanha ja foi fechada..."*, e ele reescreveu
  como *"infelizmente nao estamos contratando"*). **A frase estava no prompt palavra por palavra** —
  a regra dizia *"a equipe paga foi fechada na PRE-CAMPANHA"*. **Licao da lista de material (09/09)
  outra vez: texto de prompt vira conteudo da mensagem quando nada diz que nao pode** — e aqui o
  estrago passa do tom, porque contar que existiu equipe paga responde a pergunta que ela nao fez
  (*"e quando abre a proxima?"*). Hoje o motivo continua escrito, **dito como motivo INTERNO que nao
  entra na mensagem**, junto do jeito DELE como modelo e do TAMANHO (sem isso o modelo puxa o texto
  longo da resposta pronta). **Conserto no prompt e nao em trava**, pela correcao dele de 12/09.
  **Medido antes: o roteamento estava CERTO** — `falouAlgoProprio` levou a tecla 6, e SEM ele o caso
  cairia em `nunca-pediram-dados`, que pede nome e cidade a quem perguntou de vaga. **E a assercao
  que caiu travava justamente a frase vazada**: ela exigia a PRESENCA do motivo e nao distinguia
  *"esta escrito"* de *"pode ser dito"*. **Ao escrever regra que explica um porque, diga se ele pode
  ser dito ao eleitor.**

- **MAIS DE UM CANDIDATO: e um LOGIN, e o de fabrica nao migrou nada** (pedido dele,
  24/09/2026: *"a extensao trabalha com o foco no Capitao Martim, ou seja somente um perfil; eu
  preciso da opcao de mais perfis pois tenho agora o Felipe Pedri, entao as respostas devem ser
  especificas pra ele"*). **Medido antes de desenhar:** o nome dele vive em CINCO naturezas — as
  respostas de fabrica (`store.js`, 12 trechos), o prompt (`ia.js`, ~20 linhas vivas), **o documento
  dele** (`atendimento.js`), o dossie empacotado e os detectores (`cortesia.js`, `cities.js`,
  `gabinete.js`). E `session.channelId` **ja existia** e o painel ja o usava para os modelos
  aprovados.
  **O DESENHO MUDOU NO DIA SEGUINTE, por correcao dele** (25/09/2026): *"nao gostei do metodo
  utilizado para os perfis, eu queria algo como um perfil de login no Windows, aparenta estar tudo
  misturado"*. A v3.115 decidia pelo CANAL, sozinha, e a Config empilhava TODOS os candidatos com
  todos os campos — nada disso parece login. **Hoje ele ENTRA como um candidato**
  (`store.perfilAtivo`, seletor no cabecalho) e fica ate trocar; **o canal so AVISA**
  (`perfis.donoDoCanal`, tarja vermelha com o botao de trocar), e a Config edita **um** candidato:
  o que esta logado.
  **`donoDoCanal` devolve NULO quando ninguem reivindicou o numero** — o `doCanal` antigo nunca
  devolvia nulo porque ele ESCOLHIA, e foi APAGADO: ficou sem chamador, que e a armadilha do
  `pedido-emprego`.
  **E NULO SOZINHO NAO BASTA — sao QUATRO estados, nao dois** (25/09/2026, no mesmo dia): *"eu so
  adicionei os dois numeros do Martim, nao adicionei o numero do Felipe Pedri ainda; nao devia ter
  uma barreira caso o numero nao esteja na extensao?"*. **Medido: `donoDoCanal` devolvia `null`
  tanto para "ninguem cadastrou nada" quanto para "tem cadastro e este numero nao esta nele"**, e o
  painel tratava as duas como silencio — ele ficou logado como Martim num atendimento do Felipe, sem
  tarja. **A distincao e se JA EXISTE cadastro**: antes disso acender e alarme em 100% dos
  atendimentos; depois, **a ausencia vira informacao**. Hoje `perfis.situacaoDoCanal` responde
  `quieto`/`meu`/`outro`/`desconhecido` numa funcao so.
  **E o aviso virou BARREIRA, porque a tarja mora no CABECALHO — que e o que ele esconde durante a
  rodada** (*"preciso de espaco na area de trabalho"*, 31/08): o aviso ficava atras da unica tela
  que ele nao esta olhando. `processarRespondido` PULA o contato (nao para a rodada: numero faltando
  na Config viraria rodada travada, e a fila tem os dois numeros misturados), e as duas rodadas
  passam por ali porque `processarNovo` delega. **Ao por aviso de tela para proteger a rodada,
  pergunte se aquela tela esta visivel durante a rodada.**
  **E A CONTA DO CANAL TEM DE SER REFEITA QUANDO O CADASTRO MUDA** (25/09/2026, no mesmo dia): a
  tarja dizia *"o numero nao esta em nenhum candidato"* com o numero JA no campo. **Medido: com o
  numero lido a conta da `meu`; sem ele, `desconhecido`** — a conta estava certa, o defeito era
  QUANDO. Ela rodava uma vez no `load()` e salvar o cadastro so redesenhava a tela. E o **aviso que
  nao envelhece com o que ja foi feito** (20/09) no pior caso: continuava la logo depois de ele
  fazer o que o aviso mandava. Hoje e `recalcularCanalDoAtendimento`, uma funcao so, chamada no
  `load()`, ao trocar de candidato e ao SALVAR — e a tela **diz o que comparou** (o canal e o numero
  lido), porque *"nao esta cadastrado"* e *"nao consegui ler a tela"* pareciam a mesma coisa. **Somar
  o CANAL e o caminho seguro: ele vem da API e nao depende de ler a tela.**
  **O login nao se zera na troca de contato** (login nao cai quando se abre outra conversa); o que
  se zera e a TARJA, que e uma afirmacao sobre o contato aberto.
  **Trocar de candidato RECARREGA na hora** — esperar o proximo `load()` deixaria a tela com as
  respostas do antigo e o nome do novo no cabecalho, que e a pior combinacao porque parece certa.
  **O INVARIANTE que protege a producao: com UM perfil, nada muda** — o de fabrica le as chaves de
  topo (`templates`, `anuncios`), entao **nao houve migracao no dado dele**, e ha teste comparando o
  prompt byte a byte. **Sem valor gravado, o perfil novo le VAZIO e nunca o do outro**: texto do
  Martim saindo pelo numero do Felipe e o defeito que esta tela existe para impedir.
  **E A LISTA COBRIA SO O TEXTO DAS RESPOSTAS PRONTAS** (25/09/2026: *"ao trocar o perfil as
  mensagens nao ficam salvas para cada perfil, acabei de trocar a mensagem do momento e ficou com a
  mensagem do Felipe Pedri; veja se vai acontecer com o resto"*). **Medido: das 18 coisas que SAEM
  para o eleitor, 14 estavam compartilhadas** — a mensagem do momento e as variacoes, o pedido que vai
  junto, as duas ARTES, o modelo aprovado escolhido, o link do grupo (padrao e por cidade), o Modelo
  por conteudo e os modelos padrao do anuncio. **O criterio e um so: entra o que o eleitor recebe, ou
  o que decide o que ele recebe** — o link do grupo vai DENTRO de uma resposta pronta, e o modelo
  aprovado e do CANAL, entao o id do Martim nem existe no canal do Felipe.
  **`auto` NAO pode ser separado inteiro**: ele guarda a configuracao do OPERADOR (limite, pausa,
  "Automatizar", etiquetas do CRM), e separar aquilo faria o interruptor da rodada mudar de estado ao
  trocar de login. A separacao e por SUB-CHAVE (`CHAVES_DO_PERFIL_EM_AUTO`), e `gravarAuto` faz **uma
  escrita por destino** — duas na mesma chave e a segunda passando por cima da primeira.
  **A ARTE e separada pelo NOME DA CHAVE** (`imagemMomentoArquivo:<perfil>`) e nao por `porPerfil`,
  porque quem sobe os bytes e o SERVICE WORKER, que faz `store.get(chave)` e nao sabe quem esta
  logado; o de fabrica fica com o nome de sempre, entao a arte que ele ja tem nao se perde.
  **`padroesDeAnuncio` ficou de FORA depois de medido:** parece do candidato e e a FORMA do texto
  pre-preenchido, sem editor na tela — por perfil, o candidato novo leria lista VAZIA.
  **E o mesmo defeito estava em `entrarComo`**, que recarregava templates e IA e nao o `auto`. **Ao
  por uma chave nova em `CHAVES_DO_PERFIL`, procure os DOIS lugares que releem: o `load()` e a troca
  de login** — e no `load()` o bloco do perfil tem de vir ANTES da chave.
  **O documento dele nao foi editado:** `atendimento.PADRAO_DE_ATENDIMENTO` vai intacto para o
  candidato de fabrica e com o NOME trocado na INJECAO para os outros — o arquivo continua sendo
  dele, com o `git diff` que o protege desde 06/09.
  **CONCORDANCIA e metade do trabalho, pela segunda vez** (a primeira foi "gabinete"->"equipe",
  07/09): o perfil tem `tratamento` ("o Capitao Martim") **e** a forma contraida `de` ("do Capitao
  Martim"), porque "a equipe" pede DE+artigo — a medicao pegou *"a equipe o Capitao Martim"* saindo
  no prompt de HOJE antes de isto ir ao ar.
  **`CHAVES_DO_PERFIL` e lista de PERMISSAO e `exigirChaveConhecida` a faz valer** — sem isso a
  constante seria comentario, a armadilha do `pedido-emprego`. Fica de fora de proposito: o QUADRO
  do fluxo (duas copias divergem numa semana), o parser, as etiquetas de cidade e COREDE, e os
  modelos aprovados, que a plataforma ja entrega por canal.
  **`dom` NAO existe no painel** — escrevi `dom.numeroDaConversa()` direto e seria `ReferenceError`
  no `load()` de TODO contato, no modo janela e no encaixado; o verificador nao pega isso (esta
  registrado que ele nao ve variavel fora de escopo). A leitura de tela atravessa a ponte
  (`page.numeroDoCanal`), como o canal caido.

- **O FORMULARIO SO TINHA TRAVAS DE "JA TEMOS", NENHUMA DE "CABE AGORA"** (24/09/2026, uma contato de
  Minas Gerais que se despediu e recebeu `Nome , Cidade` no fim: *"continua saindo o pedido de dados
  sem contexto"*). **Medido: `pedirDadosNaoCabe` e `casoDeNegativa` falsos, e `ehDespedida`,
  `soExpressaApoio`, `soCortesia` e `perguntaPendente` todos falsos** — as tres travas respondem a
  MESMA pergunta (*"nos ja temos o cadastro?"*) e nao havia como aquilo nao sair. **Ele escolheu duas
  saidas, e elas se somam:** (1) o campo **`naoCabePedirOCadastro`** no esquema, irmao do
  `naoHaOQueResponder` — *"cabe pedir agora?"* e JULGAMENTO —, com a licenca **colada na ordem de
  pedir** (ela CONTRADIZ a ordem duas linhas acima, entao tem de estar do lado dela) e, marcando, o
  PISO se cala e `ia.semOFormulario` tira o bloco LITERAL (parafrase passa de proposito); e (2)
  **`cortesia.disseQueEDeOutroEstado`** dentro de `sugestao.pedirDadosNaoCabe`, valendo nos DOIS
  caminhos — o cadastro serve ao filtro ESTADUAL. **A PRIMEIRA PESSOA e a guarda e foi medida na
  propria print**: *"aqui tem muita gente que e do rio grande do sul"* esta na MESMA mensagem que
  casa. Fora de proposito: **o Para** (normaliza para a preposicao `para` — a armadilha de 08/09),
  **as siglas** (`sp`, `mg`, `ba` em processo e placa) e **"daqui" sozinho** (*"nao sou daqui, sou de
  Cachoeirinha"* e gente do RS falando da CIDADE). 9 casando e 14 falsos positivos barrados.

- **UM "?" NO MEIO DE UM RABISCO DESLIGAVA A ABSTENCAO DA IA** (24/09/2026, *"escreveu algo
  totalmente sem contexto e ininteligivel"*, o texto sendo `Cla?nique..graca.gonho.olho.pranos`).
  **Medido: `perguntaPendente` e `conversaTemPerguntaAberta` davam PERGUNTA** pelo "?" no meio de
  `Cla?nique` — e `perguntaPendente` e **a unica guarda mecanica da abstencao da v3.110**: com ela
  verdadeira, a IA diz *"nao ha o que responder"* e o painel ignora. **O rabisco desligava a regra
  dele no caso que a regra nasceu para resolver.** TERCEIRA vez que um "?" que ninguem digitou como
  pergunta custa uma print (as duas anteriores foram a query string do link, 05/09). Hoje
  `cortesia.semInterrogacaoColada` troca por ESPACO (pontuacao que some cola as palavras) o "?" com
  letra colada dos dois lados, **exigindo MINUSCULA ou digito depois** — a peca que a medicao
  obrigou: `"O senhor e senador?Obrigada"` e pergunta de verdade com o espaco comido, e maiuscula
  depois do "?" e frase nova. **Ao por uma guarda mecanica numa regra nova, meca a guarda contra o
  caso que a regra existe para pegar** — aqui a guarda e a regra estavam no mesmo texto.

- **NAO HA O QUE RESPONDER: A IA ABSTEM, E SAI A MENSAGEM DO MOMENTO** (regra dele, 24/09/2026, com
  a print de *"As outras de Venancio Aires capital do chimarrao"* e o rascunho devolvendo as palavras
  dela: *"nao fez sentido nenhum o que a pessoa falou, nao tem contexto e a IA tentou arrumar uma
  resposta; quando for o caso mandar a mensagem do momento"*). **Medido: dos dezesseis detectores so
  `falouAlgoProprio` casou** — a INVERSAO de 22/09 —, e com ele desligado o quadro ja decide
  `contexto-de-outro-dia`, **tecla 5**. **O conserto NAO e detector:** "isto faz sentido?" e
  JULGAMENTO, a lista nao fecha e erraria apagando a fala de quem falou de verdade. Hoje: **regra 16**
  (proibicao, vale sempre) + o campo **`naoHaOQueResponder`** no esquema, irmao do `precisaDeRevisao`
  — **e barato perguntar**. **A FRONTEIRA mora dentro da regra**: faltar o dado continua sendo a
  regra 14, e assunto dificil continua sendo para responder; sem ela "nao entendi" vira a saida facil
  para toda pergunta incomoda. **A guarda mecanica e uma so: PERGUNTA PENDENTE** — a mensagem do
  momento CONCLUI. **`=== true` e nao `!== false`**: modelo que ignore o campo escreve o rascunho como
  sempre, em vez de calar a resposta de todo mundo em silencio. O envio reusa o caminho da tecla 5.

- **A MARCA DO CLIQUE SO VALIA NA PRIMEIRA MENSAGEM, E COM A REDACAO ANTIGA** (23/09/2026, *"ignorou
  o anuncio"*, com o anuncio no ar e o texto igual ao cadastrado). **Medido: `reconhecer`, o modelo e
  a decisao (tecla `a`) estavam TODOS certos** — o que faltava era a mensagem chegar marcada. Havia
  **duas funcoes decidindo a mesma coisa**: a da primeira mensagem aceita qualquer "Ola" curto; a do
  segundo clique exigia **"Ola! EU ..."**, e este anuncio diz *"Ola! Quero saber mais..."*. Sem marca,
  o texto do anuncio virou fala dela, `falouAlgoProprio` disparou e o caso subiu para a tecla 6.
  Hoje o criterio e o **texto que ELE cadastrou** (`anuncios.ehOTextoDoAnuncio`), com guarda de
  **cobertura de 60%** para o pedido dela colado no texto do anuncio nao sumir. **Ao criar segunda
  regra para reconhecer a mesma coisa, use o dado que ele cadastra, nao a redacao.** E
  `ehMensagemDeAnuncio` estourava com `null` nos padroes (o `= []` so cobre `undefined`) — erro ali
  PARA a rodada.

- **DENUNCIA E ACUSACAO POLITICA NAO SE DISCUTE** (regra dele, 23/09/2026: *"nao entramos em
  detalhes pois essas informacoes nao podem ser verificadas, so agradecemos e desconversamos"*). O
  rascunho respondeu DUAS vezes que *"as denuncias sao serias e precisam ser tratadas com fatos e
  responsabilidade"* — **o mandato opinando sobre acusacao que ninguem conferiu**. Hoje: **regra 15**
  (proibicao, vale sempre) + a linha **colada** quando `cortesia.trouxeDenuncia` casa. **Le a conversa
  INTEIRA** — na print a fala da vez era so *"e assim mesmo que esta ocorrendo"*, e o SEGUIMENTO e que
  errou. Guardas: alvo PUBLICO, crime contra ELA fora, e `!trouxeProblema`. **A repeticao nao se
  conserta baixando o corte de `semRepetirONosso`** (medido: null, porque as PALAVRAS mudaram) — ela
  some quando a regra tira o que havia para repetir. E `semAcentos` nao abaixa a caixa: sem o `i`,
  "LULA" e "TSE" escapavam.

- **"NAO TENHO ESSA INFORMACAO" NAO E A RESPOSTA — falta o dado, responde-se o TEMA** (22/09/2026,
  o caminhoneiro de fronteira: perguntou projeto e agenda, o rascunho saiu com DUAS negativas e nada
  mais). **Medido: nenhuma trava disparou, o dossie FOI puxado e nao cobria o tema** — a IA cumpriu a
  regra 4 ao pe da letra. E a forma do *"como esta o capitao"* (17/09) num assunto novo: **"nao
  invente" nao significa "nao responda"**. Hoje a **regra 14** e a linha **colada** no pedido, com a
  condicao sendo o DOSSIE TER SIDO PUXADO (a conta que ja existia — nenhuma lista nova de formas de
  perguntar). **Fica fora de quem trouxe problema pessoal**, senao ela e a regra 11 mandam o oposto
  sobre perguntar. **TERCEIRA assercao de PROPORCAO que cai sozinha** (a 9 virou "9a de 16" sem nada
  mudar de lugar): proporcao decai a cada regra nova — o invariante e a ADJACENCIA da 8 com a 9.

- **QUEM ATENDE E A EQUIPE, E O RASCUNHO NAO SE APRESENTA POR HABITO** (22/09/2026, print dele:
  *"era pra estar equipe ou assessoria do capitao martim e nesse caso nem era necessario se
  identificar"*). A licenca *"pode dizer que este e o WhatsApp dele"* era MINHA, escrita junto com a
  voz do Capitao (v3.99). **Julgamento fica no prompt** (as tres VOZES mandam nao se apresentar, com
  a excecao da regra 9); **o NOME errado e mecanico** — `ia.semDizerQueEOWhatsAppDele`, na revisao.
  A guarda e o WhatsApp **pessoal** dele, que e a frase certa do `falar-com-deputado`. E a moldura
  era `(?:é|e)\b`: **`\b` nao fecha depois de letra acentuada**, entao a frase da print — a mais
  comum — escapava. **Ao dar voz ou papel a IA, nao invente junto uma frase de apresentacao.**

- **CORTE POR TAMANHO PARTE EMOJI, E O CORPO VIRA JSON INVÁLIDO** (22/09/2026): as DUAS casas
  devolveram 400 no mesmo pedido (*"failed to parse JSON value"*, *"no low surrogate in string"*), e
  nenhuma das mensagens fala em emoji. Emoji é um PAR de caracteres; `slice` no meio dele deixa meia
  letra. Hoje `ia.cortar` recua e `ia.semSurrogateSolto` limpa no `JSON.stringify` do envio — as duas
  camadas, porque corte novo aparece sempre. **Ao cortar texto que vai para a API, use `cortar`.**

- **REGEX MONTADA EM TEMPLATE LITERAL PERDE AS BARRAS — use `String.raw`** (22/09/2026). Em
  `` new RegExp(`...\s...\p{L}...`) `` o `\s` vira `s` e o `\p{L}` vira `p{L}`, sem erro nenhum: a
  primeira expressão de `afirmouTer` era `temoss+` e **nunca casou em duas semanas**, com teste verde
  porque a segunda expressão cobria o caso testado. Ao montar regex com `${...}`, `String.raw` sempre.

- **A VOZ É A DO CAPITÃO MARTIM, E O MATERIAL É SÓ FOLHETO E COLINHA** (decisões dele, 22/09/2026). A
  primeira pessoa do Capitão mora na seção 1 do padrão dele, com duas guardas que não saem: não inventar
  a vida dele (onde está, visita, ligação) e **dizer que é a equipe quando PERGUNTAREM** (regra 9). O
  material **substituiu a regra da Sirlei (09/09)**: o estoque agora é conhecido, e o resto se nega numa
  frase — **escrita como "o que temos são folhetos"**, porque *"consigo te mandar"* dispara a trava de
  promessa. **Ao mudar regra do padrão dele, procure a regra das instruções que diz o contrário** — a
  regra 6 mandava dizer *"ouvi seu áudio"*, que ele acabou de proibir.

- **SAO TRES CASAS DESDE 18/09/2026: Anthropic, OpenAI e OpenRouter (o Qwen).** A casa continua saindo
  do NOME do modelo: **barra no nome e OpenRouter** (`qwen/qwen3.7-plus`). O corpo do OpenRouter leva
  `provider: { data_collection: 'deny', require_parameters: true }` — **nao tire o `deny`**: foi a
  condicao para conversa de eleitor ir a um revendedor que roteia para varios servidores. Chave nova
  de provedor sai do `exportJson` junto com as outras.

- **SAO DOIS MODELOS DESDE 18/09/2026: o do RASCUNHO e o das CONFERENCIAS.** Decisao dele: *"o problema
  realmente e a capacidade desses modelos mais baratos"*. `ia.modeloRascunho` (padrao gpt-5) escreve o
  texto que o eleitor le; `ia.modelo` faz cidade e etiquetas. **Quem le o modelo do rascunho e
  `modeloDoRascunho()` no painel, nunca `state.ia.modelo`** — `iaTemChave` continua sendo do modelo das
  conferencias. Ao criar chamada nova de IA, decida de qual dos dois ela e.

- **O MODO DE TREINO FOI RETIRADO em 18/09/2026, a pedido dele** (*"o sistema de treino ficou irrelevante,
  estou gastando tokens e as respostas nao variam de verdade; retire o treino, a IA tera que ser refinada
  de outra forma"*). Sairam: as tres opcoes, a janela de escolha, a refeita das opcoes iguais, os PERFIS,
  as licoes medidas (`lib/aprendizado.js` apagado) e o interruptor. **O rascunho e UM, sempre.** As
  entradas abaixo que falam de "tres opcoes", "perfis", "refazer" e "licoes" descrevem codigo que NAO
  EXISTE MAIS — ficam pelo que ensinaram (variar pedindo nao funciona; perfil nao muda conteudo; a medida
  de semelhanca pela media esconde frase identica), nao como instrucao. **Nao religue nada disso sem
  ele pedir.** O que ficou: o "O que a IA leu", a revisao mecanica e as travas de envio.

- **ESQUEMA DE SAIDA ESTRUTURADA VAI LITERAL: `minItems` so 0 ou 1, `maxItems` NAO EXISTE — e o erro e
  400** (16/09/2026). Relato dele: *"o modo de treino falhou"*. A v3.61 mandava `minItems: 3,
  maxItems: 3` e **todo rascunho numa casa Claude voltou erro por dois dias, nos dois modos**. Nada
  acusou: o JSON e valido, nenhum teste chama a API, e **os SDKs Python/TS tiram essas restricoes
  sozinhos** — esta extensao usa `fetch` cru. Tambem recusados: `minLength`, `maxLength`, `minimum`,
  `maximum`, `multipleOf`. **Contagem e tamanho moram no texto do pedido e no `validar*`**, e
  `tests/ia.test.mjs` varre os tres esquemas nas duas formas. **Ao mexer num esquema, confira a lista
  de limitacoes da documentacao, nao o que o JSON Schema aceita.**
- **O FLUXO DECIDE SE A IA E CHAMADA, NAO O QUE ELA LE** (16/09/2026). Ele: *"creio que o fluxo esta
  barrando ela de ler o contexto"*. Medido: a conversa vai inteira venha o caso de qualquer caixa; o que
  cortava era a **midia sem texto** (sumia no `filter` de `conversaParaIA`) e a **SESSAO** (quem volta
  abre atendimento novo). Hoje `ia.marcaDeMidia` poe a linha e o atendimento anterior vai num bloco
  proprio, antes e SEM marca de pendente. **E o ultimo `map` de `conversaParaIA` descartava
  `transcrito`**: a regra do audio no pedido nunca ligou. **Campo novo que a IA precisa ler tem de
  passar por ESSE `map`** — ele e o ultimo filtro, depois de o campo ter sido montado.
- **"O QUE A IA LEU" E O PROMPT DE VERDADE, nao uma lista escrita** (16/09/2026, *"qual a visao da IA
  sobre a conversa"*). `ia-cliente.rascunhar` devolve `lidoPelaIA` (o bloco do contato inteiro + o
  resumo do sistema), montado ANTES da chamada para aparecer tambem quando ela falha; o painel guarda em
  `state.lidoPelaIA`, **so em memoria** e zerado no `load()`. **O que ela NAO ve e o que surpreende:**
  figura, figurinha, video, documento e audio sem transcricao somem por inteiro (`conversaParaIA`
  filtra o que nao tem texto), e a conversa de sessoes anteriores nao entra.
- **SAO DOIS MODOS, E O INTERRUPTOR E DELE** (15/09/2026): *"deixe o antigo, que ira rodar sozinho
  ja com o conhecimento, quando estiver com taxa baixa de erro, e crie o modo de treino"*.
  `ia.treinando` decide: **tres rascunhos + caixa de escolha** (treino) ou **um rascunho direto no
  campo** (o antigo) — e **o antigo leva as licoes aprendidas no prompt do mesmo jeito**, que e a
  parte que ele quis preservar. **O modo decide o ESQUEMA (`esquemaDoRascunho(quantas)`), e nao so a
  tela**: pedir tres para usar uma pagaria a saida das outras duas em toda chamada. **No treino a trava
  e ELE, tambem na rodada automatica** (17/09/2026: *"a trava no modo treino sou eu"*): a janela abre
  sempre e, na automatica, **a escolha dele E o envio** (`escolheuEle` libera o envio em
  `processarRespondido`, mesmo com aviso) e a rodada segue. A v3.63 abria e punha a escolha no CAMPO, e
  a rodada parava na caixa da tecla 6 — *"o modo treino interrompeu o fluxo"*. **Ja mudou quatro vezes;
  ao consertar um "falhou", mude UMA coisa
  por vez** — a v3.63 mudou o esquema (a causa) e a exclusao (que nao era causa) juntos.
  **A "taxa baixa de erro" e MEDIDA e tem um nome exato:** de quantas vezes a PRIMEIRA opcao foi a
  escolhida — a primeira e o que a IA mandaria sem treino nenhum. Com 10 escolhas e 80% a tela avisa
  que da para desligar; **quem desliga e ele**, porque trocar o modo sozinho mudaria o que sai para
  eleitor sem ninguem escolher. **Limite da medida, e esta escrito na tela:** ela diz se o primeiro
  texto AGRADA, nao se ele esta CERTO — nao serve para decidir envio automatico, que continua sendo
  a caixa "Automatizar" mais `rascunhoPodeSairSozinho`.
- **"NAO INVENTE" LIDO AO PE DA LETRA VIRA "NAO SEI" PARA CORTESIA** (17/09/2026, *"perguntaram como esta
  o capitao e a IA respondeu 3 vezes que nao sabe"*). A regra 4 e a secao 20 do documento dele
  (*"informacao pessoal do candidato… Nao sabendo: vou verificar"*) nao distinguiam pergunta de carinho
  de pedido de dado. Hoje ha EXCECAO na regra 4 e a linha colada no pedido (`ia.perguntaComoEleEsta`):
  ele esta bem e na correria da campanha; noticia dele no dossie ou nas instrucoes vence. **Ao escrever
  regra que proibe inventar, diga tambem o que NAO e pedido de informacao** — o modelo prefere o "nao
  sei" seguro a julgar.
- **OBRIGACAO ESCRITA PARA O RASCUNHO UNICO VIRA OBRIGACAO NAS TRES** (17/09/2026, *"em todas as opcoes
  ele pediu os dados, entao se eu quero uma opcao sem pedir dados fico sem escolha"*). O "FECHE com o
  formulario" e o PISO do painel foram escritos antes do treino. Hoje, no treino, o bloco vai na
  primeira e pelo menos uma vem sem, e o piso so age quando ELE nao escolheu. **Ao escrever instrucao
  obrigatoria no bloco do contato, diga como ela vale nas tres — e confira se ha piso no painel.**
- **"VARIE" SEM DIZER EM QUE DEIXA O MODELO ESCOLHER O EIXO MAIS BARATO: TROCAR AS PALAVRAS** (17/09/2026,
  *"3 respostas praticamente iguais, so variando o metodo de escrita"*). A v3.67 fechou os eixos que
  inventavam oferta e deixou escrito *"antes tres parecidas do que uma errada"* — com as proibicoes do
  bloco, a parafrase era a unica variacao segura e a instrucao a autorizava. Hoje sao tres ABORDAGENS
  com nome (direta, acolhe, liga ao Capitao Martim) e `ia.semelhancaDasOpcoes` mede no Andamento.
  **Ao fechar um eixo de variacao, de outro no lugar — e nunca escreva a licenca para parecidas.**
- **INSTRUCAO DE VARIAR FAZ O MODELO INVENTAR CONTEUDO — e "varie so a forma" faz o conteudo inventado
  se repetir nas tres** (16/09/2026, print da Margarida: a colinha oferecida nas tres opcoes a quem so
  mandou carinho). *"fechar ou nao com pergunta"* virou *"quer que eu te mande a lista?"*, e *"diferentes
  no JEITO, nao na redacao"* copiou a oferta nas tres. Hoje o pedido proibe oferecer o que ela nao pediu
  (nos dois modos) e exige que o que nao e resposta ao que ela disse NAO esteja nas tres. **Ao pedir
  variacao a um modelo, diga o que NAO pode variar para dentro** — variar sem ter o que variar e
  inventar.
- **AS TRES OPCOES E O QUE ELE ESCOLHE VIRA REGRA MEDIDA NO PROMPT** (15/09/2026). Pedido dele:
  *"faca ela criar 3 diferentes e vou escolher qual eu quero, e ela deve ir aprendendo com minhas
  escolhas"*. **Nao existe treinar modelo aqui** — o que existe e uma chamada com um prompt —, entao
  "aprender" so pode ser: medir o que separa o escolhido dos descartados e escrever isso no prompt.
  `lib/aprendizado.js` faz isso, e as guardas sao o arquivo inteiro:
  **(1) so conta onde os textos DIFERIAM** (tres com saudacao nao ensinam nada sobre saudacao);
  **(2) so FORMA, nunca conteudo** — guardar o texto escolhido e devolve-lo ao prompt faria a cidade
  de um eleitor aparecer na mensagem de outro, que e a proximidade lexical ja paga cinco vezes;
  **(3) cinco escolhas informativas e maioria de 70%** — licao tirada de duas escolhas e ruido
  promovido a regra, e regra daqui muda o que sai para eleitor;
  **(4) o tamanho e aprendido por POSICAO** ("das opcoes que teve, pegou a mais curta?"), nunca em
  numero de frases, que depende do caso;
  **(5) na rodada AUTOMATICA a caixa nao abre** (`melhorOpcao` decide) **e essa escolha nao ensina
  nada** — aprender com a propria preferencia e o laco que faz um vies virar regra.
  **A escolha mora em `rascunharParaEle`**, que e o caminho unico dos tres jeitos de pedir rascunho
  (tecla 8, escalada do fluxo, cartao da aba Respostas) — tres copias divergiriam na primeira semana.
  **As licoes vao no bloco do CONTATO e nao no sistema**: o sistema leva `cache_control`, e licao
  nova ali invalidaria o cache de todo mundo. **Custo medido no Haiku, por mil rascunhos:** quente
  US$ 2,04 -> 3,39; frio US$ 23,30 -> 24,65 — o que multiplica e a SAIDA. Tres chamadas separadas
  custariam ~US$ 70 frios, e e por isso que e UMA chamada com tres textos.
- **`validarRascunho` DEVOLVE `opcoes`, E `texto` CONTINUA SENDO A PRIMEIRA.** Quem so sabia ler um
  rascunho (o log, o cartao da aba Respostas, o envio automatico) nao mudou. **Cada opcao e revisada
  por conta propria** — as travas valem por TEXTO, e uma opcao limpa nao faz a outra ficar limpa. **A
  forma antiga (`{texto, confianca}` sem array) continua aceita**: trocar esquema e o momento em que
  o modelo do outro lado devolve o de ontem, e cair com "a IA nao devolveu rascunho" esconderia isso.
- **`checar-referencias.mjs` LE `nome(` COMO CHAMADA — entao "regra(s)" num texto vira alarme falso.**
  Custou um `regra() — chamada sem declaracao` em 15/09/2026. Plural entre parenteses em string do
  painel: escreva por extenso.
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
- **A EXTENSAO NUNCA APAGOU NADA, e o lixo que ela mesma gravou ficava para sempre.** Print do Jose
  (07/09/2026), campo Cidade valendo `www.threads.com`: *"passou por ele, nao removeu a cidade
  errada"*. Ela preenche buraco e, desde a 2.69, SUBSTITUI lixo quando a pessoa menciona uma cidade
  de verdade — quem nunca mais menciona nao tinha conserto nenhum. Hoje `fields.deveGravarEntrada`
  aceita **uma** escrita de valor vazio, a entrada `limpar`, e ela e montada por
  `marcarCidadeParaLimpar`. **Quatro guardas:** o criterio e a FORMA
  (`cities.ehEnderecoDeMaquina` — nenhum dos 497 municipios e URL, dominio, e-mail ou sequencia de
  digitos, entao apagar nao pode apagar dado bom); **frase comum NAO entra** (*"mais Apoiadores com
  patrocinio"* pode ser cidade de outro estado ou abreviacao, e o lugar dela e a aba Cidades, com
  ele olhando); roda **depois de todo palpite**, porque substituir e melhor que apagar; e fica
  **fora do `somenteExatos`**, que dispara a cada abertura de contato — apagar pede ato deliberado.
  Metade das assercoes do teste e sobre o que NAO pode ser apagado.
- **`mesmoValor` devolvia FALSO para vazio, e isso daria alarme na unica escrita que apaga.** A
  conferencia relê o contato e comparava `doCrm == null` como "nao gravou" — campo apagado volta
  ausente, entao a limpeza que FUNCIONOU seria reportada como falha. E **a conferencia e o que
  responde se a API aceita apagar**: `writeOne` manda `valueString: ''` e o 200 nao prova nada
  (a armadilha registrada no topo deste arquivo). Se a API ignorar o vazio, a linha
  *"a API aceitou mas nao gravou"* aparece no primeiro contato — e nao em silencio.
- **Escrita que APAGA tem que aparecer na tela.** Sem a linha nova no cabecalho ele ficava mudo: a
  linha "Cidade:" some (o valor virou vazio) e o aviso de grafia some junto, enquanto o CRM
  continua com o lixo ate a conclusao gravar. Hoje o cabecalho diz o que vai ser apagado, e o
  Andamento registra `apagando do CRM: <campo> ("<valor>")`.
- **`rajadaFinal` FAZ DUAS COISAS, E SO UMA DELAS SERVE PARA SINAL QUE FICA PENDENTE.** Print do Dair
  (09/09/2026): *"Quero confirmar minha presenca no evento"* as **09:02** e um link as **09:45**; a
  rodada mandou a mensagem do momento e concluiu — *"era pra pular e concluiu por causa do link"*.
  **Medido, e nao foi o link:** com a confirmacao sozinha o sinal e `"sim"`, com o link junto e
  `null`, e invertendo a ordem volta a ser `"sim"`. **A causa e o RELOGIO** —
  `INTERVALO_DA_RAJADA_MS` corta em **30 minutos** e 43 separam as duas, entao a confirmacao virou
  "rajada anterior" **sem nunca ter sido respondida**. As duas metades de `rajadaFinal` respondem
  perguntas diferentes: o corte na NOSSA ultima fala responde *"o que ainda nao respondemos?"*; o
  buraco de 30 minutos responde *"o que ela digitou de uma vez?"*. **Nasceu `desdeNossaUltima`, e a
  regra de escolha esta escrita nela: ESTADO que fica esperando (confirmou presenca, pediu material)
  usa `desdeNossaUltima`; FALA do momento (so cumprimentou, so uma reacao) usa `rajadaFinal`.** As
  guardas: o limite continua sendo a nossa ultima mensagem (senao quem confirmou em julho seria
  pulado para sempre) e a negativa posterior continua vencendo. **A troca e barata porque o desfecho
  e a tecla 2** — pular nao manda nada e nao conclui; o falso negativo e que custou a print.
  **Os outros 16 detectores continuam em `rajadaFinal`** — mudar todos de uma vez seria trocar um
  defeito conhecido por dezesseis desconhecidos.
- **ENCAMINHOU AO ORGAO RESPONSAVEL? PARE AI — servico fora da alcada nao se oferece nem de graca.**
  Print da Bia (09/09/2026): o rascunho fez a parte certa (negou a contratacao, apontou o SINE e o
  Emprega Brasil) e **emendou** *"eu anoto aqui que voce busca panfletagem e posso te ajudar a montar
  um curriculo rapido"*. Ele: *"so encaminhe pro orgao responsavel, evite oferecer servicos fora da
  nossa alcada como fazer curriculo; isso faz a pessoa retornar varias vezes para pedir outras coisas
  e nao e nosso foco"*. **A razao e OPERACIONAL:** cada oferta dessas abre uma porta que alguem vai
  ter de atender depois, e o atendimento nao tem braco. **E a irma do "procure a coordenacao"
  (regra 7) com o sinal trocado** — la a porta prometida nao existia; aqui ela existe e custa caro.
  ~~A guarda e a ultima linha da regra: quem JA procurou o orgao e NAO foi atendida continua sendo
  caso de cobrar o poder publico~~ — **desfeito em 10/09/2026 por decisao dele** (a Irema: *"nos nao
  somos um canal de resolucao de problemas"*); ver a entrada da Irema abaixo. **Ficou no PROMPT e nao virou trava** porque decidir se a oferta esta
  dentro da alcada exige saber qual e a alcada, e isso e julgamento. Medido no texto que saiu: um
  aviso so, nao bloqueante, e `rascunhoPodeSairSozinho` **true**.
- **RECLAMAR DE NAO TER SIDO ATENDIDA E TECLA 6** — decisao dele (09/09/2026), sobre a frase do
  Maicon *"Ninguem quis entrar em contato comigo"*: **"virar tecla 6"**. **Nao tem resposta pronta e
  escrever uma seria pior:** o que ela esta dizendo e que NOS falhamos com ela — texto automatico em
  cima disso **confirma a queixa**, e concluir em silencio confirma duas vezes. Mesma familia de
  `nao-pode-falar-agora`, e pela regra de 04/09 (uma caixa por desfecho) as tres dividem a caixa de
  `ultima-pede-resposta-pessoal` por `tambemQuando`. **A guarda e o ALVO ser NOS**: nesta base
  *"ninguem me respondeu"* e dito o tempo todo sobre a prefeitura, o CRAS, o INSS e o banco, e ai e o
  OPOSTO — e o caso que o mandato encaminha. 12 das 22 assercoes sao falso positivo, tres delas
  vocabulario com "ninguem" dentro (*"ninguem merece esse governo"*, *"ninguem vai nos parar"*).
  **`semAcentos` NAO ABAIXA A CAIXA**, e sem o `i` a guarda do terceiro ficava desligada justo para
  as SIGLAS (*"fui no CRAS"*, *"do INSS"*) — que e como essas instituicoes sao escritas. Confira a
  caixa ao escrever guarda nova neste arquivo.
- **QUEM QUER MARCAR PEDE A COISA, NAO USA O VERBO — e a lista era toda de verbos.** Print do Maicon
  (09/09/2026): *"Queria uma reuniao com deputado"*, e **os OITO detectores devolveram null**; a
  rodada mandou a saudacao de fe — *"pedido de contato foi ignorado e mandou bom dia"*. `QUER_FALAR_
  COM_ELE` conhecia *falar*, *conversar*, *encontrar*, *ver* e o pedido do numero; nao conhecia
  **reuniao, encontro, audiencia, visita, horario**, nem *"marcar/agendar com ele"*, nem *"ele pode
  me receber?"*. **Mesmo defeito do "trabalhar NA campanha" (05/09) e do "gostaria DE saber"
  (06/09): a forma existe, e a mais natural, e a lista nao a tinha.** Sem sinal nenhum o caso desce
  ate a caixa que manda a mensagem do momento — **a caixa nao errou, ela foi a ultima que sobrou**.
  **A guarda que a medicao obrigou:** o verbo de QUERER e obrigatorio, senao *"na reuniao com o
  deputado ontem, ele disse..."* vira pedido e a resposta nega um encontro que ninguem pediu — o erro
  do "representante" pela outra porta. 12 das 23 assercoes sao falso positivo.
  **Fica em aberto e foi dito a ele:** *"Ninguem quis entrar em contato comigo"* (a reclamacao de nao
  ter sido atendido) continua sem detector.
- **A COLINHA VAI DIGITADA DESDE 09/09/2026, E NAO E MATERIAL** — decisao dele: *"quando pedir a
  colinha so passe a lista com os numeros e o que cada um e, nao entra como material"*. **Isto
  SUBSTITUI a regra de 07/09** (*"quem pergunta em quem votar recebe a ARTE, nao a lista digitada"*),
  e o que mudou foi a PROTECAO EXISTIR: naquele dia o argumento era que seis numeros redigitados sao
  seis chances de mandar o eleitor votar em outra pessoa, e nada conferia; desde 08/09
  `conferirChapa` confere e barra o envio. **A arte continua melhor havendo modelo aprovado dela** —
  ele disse em 07/09 que ia criar um e nao existe. Foi a **terceira vez em dois dias** que o caminho
  do material engoliu um pedido que nao era dele (a Cleo, o Oseias, a colinha); `enderecoSemMaterial`
  barrou as tres.
  **Duas coisas que a medicao pegou ANTES de a regra ir para o ar, e as duas sao a mesma licao:**
  *"quero a colinha"* **nao puxava o dossie** (so *"colinha dos candidatos"*, por "candidat") — e
  **regra que manda a IA COPIAR um dado exige que o dado esteja no prompt**, senao ela escreve de
  cabeca, que e o erro do Van Hattem; e **a trava nao cobria o formato que a propria regra produz** —
  a colinha sai como `Capitao Martim - 10122`, e o filtro de contexto de voto conhecia "numero",
  "vote" e o parentese, mas nao o traco: **`Capitao Martim - 2228` passava**. **Ao liberar uma regra
  citando uma trava como a protecao que a torna segura, MEÇA a trava contra a saida que a regra
  produz.**
- **EXCECAO ESCRITA DENTRO DE UMA REGRA SO VALE ONDE AQUELA REGRA ALCANCA.** Print da Sadra
  (09/09/2026): *"Quero umas. Camisetas"* e *"Dos meus candidatos"*, e o atendimento foi **concluido
  sem nada sair** — *"nao identificou que ela queria algo"*. **Medido: `pedeMaterial` CASOU** (o ponto
  no meio nao atrapalha); o caso morreu em `ja-respondemos-antes`, porque ja tinhamos respondido
  hoje. **A excecao do material de 05/09 foi escrita dentro de `conteudo-pedido`, que exige
  `podeEnviar`** — um modelo aprovado —, e camiseta nao tem modelo: o caminho de material FISICO e
  pedir o endereco e repassar a equipe (a Jonice, 08/09), e **nenhuma caixa levava a ele**.
  **O conserto e a licao da Noeli (06/09): a guarda decide o DESFECHO, nao se a caixa casa** — virou
  `if (c.perguntaPendente || c.pedeMaterial) return '6'`, ao lado do que a pergunta pendente ja
  fazia. **Ao escrever excecao, pergunte em quais regras ela precisa existir, nao so naquela em que o
  caso apareceu.** E o `ramos` do verbete entra no mesmo commit.
- **SESSAO NOVA NAO E PESSOA NOVA — tambem para a IA.** Anotacao de 10/09/2026: um audio de apoio de
  quem tem etiqueta de cidade recebeu *"Somos a equipe do Capitao Martim"* e ele: *"se identificar e
  quando a pessoa e nova no WhatsApp ou ela perguntou"*. **O bloco do contato MENTIA:** quem volta
  sozinho abre sessao sem fala NOS, e `montarContatoRascunho` dizia *"e a primeira coisa que o
  atendimento diz a esta pessoa"*; o aviso `jaFalamos` tambem so olhava a sessao. E a armadilha da
  Rosa (05/09), que foi consertada na RODADA e nunca chegou a IA. Hoje o painel passa `jaNosConhece`
  (o `jaRespondemosAntes`), com tres vozes no bloco. **Todo sinal que a rodada aprendeu sobre o
  contato e que muda o que se ESCREVE tem que ir no bloco do contato** — a IA so sabe o que esta
  escrito ali.
- **A FRASE PRONTA DO VOLUNTARIADO TEM PREMISSA, E VIROU A DECIMA TRAVA.** Mesmo caso: *"pra poder te
  ajudar na votacao"* recebeu *"so voluntarios nao remunerados, mande o endereco"* — a resposta
  `trabalhar-na-campanha` usada como base (3.22) para quem so apoiava. `trabalhoInexistente` barra o
  envio quando o rascunho fala de voluntariado/remuneracao e ELA nao falou em trabalhar nem em
  ganhar. **`ajudar` e `ganhar` solto ficam fora de `ELA_FALOU_DE_TRABALHO` e sao a razao da trava**
  — *"vamos ganhar essa"* e o grito de campanha mais comum daqui.
- **ETIQUETA AMARRADA A QUAL TEXTO SAIU MORRE QUANDO O CAMINHO DE RESPOSTA MUDA** — pela segunda vez no
  mesmo dia. A de pedido de dinheiro/emprego so marcava quando saia a resposta pronta que nega
  (`ETIQUETA_PEDIDO_IDS`), e desde a 3.10 esses casos sao respondidos pela IA em texto livre: nunca mais
  marcou (*"como a IA atende pedido de ajuda e dinheiro, a etiqueta nao esta sendo colocada"*, 10/09).
  Hoje a marca sai pelo SINAL (`sugestao.motivoDaEtiquetaDePedido`), na rodada, depois da decisao — e
  voluntario na campanha nao e marcado. **Ao mudar QUEM responde um caso, procure toda marca que
  dependia do texto antigo** (a outra foi o material no modelo aprovado, 3.40).
- **"ENCAMINHAMOS" E PRESENTE, FUTURO E PASSADO — a trava `afirmouAcao` so via o passado.** Print de
  10/09/2026: *"e so mandar seu endereco que encaminhamos ao assessor"* (o repasse condicionado, a unica
  promessa permitida) foi barrado, e ele: *"resposta correta, ja nao tem necessidade de parar"*. Hoje a
  forma em -EI barra sempre; a em -AMOS so com "ja" antes ou "seu pedido" depois; e condicao antes do
  verbo na mesma frase desfaz. **Trava de verbo em portugues tem de olhar o tempo — e a forma de 1a
  pessoa do plural nao tem tempo sozinha.** Essa trava nasceu sem teste nenhum de falso positivo.
- **NEM TODO ANUNCIO TEM TEXTO PRONTO — e a marca "primeira mensagem = clique" apagava a fala dela.**
  Print do Rodrigo (10/09/2026): o anuncio CONVERSE CONOSCO nao preenche texto, a primeira mensagem era
  o pedido da colinha, e `prepararEntrantes` a marcava como `geradaPeloAnuncio` — todo detector pulou.
  Hoje so marca com cara de texto pronto (`pareceTextoProntoDeAnuncio`: abre com "Ola", ate 160). **Regra
  que presume o formato de TODO anuncio quebra no primeiro anuncio de outro formato.** E **regra que so
  existe no prompt precisa de um sinal que leve o caso ate a IA**: a colinha (regra 10) nao tinha, e
  virou `pedeColinha`.
- **O DOSSIE TEM EMENDAS, LEIS E PROJETOS DO MATERIAL DO MANDATO** (10/09/2026). Tres coisas para quem
  mexer nele: **(1)** o PDF dele tinha inconsistencias proprias (um numero de lei repetido, anos que a
  numeracao desmente) — **leia o material com a mesma desconfianca da internet** e marque `[CONFERIR]`
  em vez de corrigir por conta propria; **(2)** conteudo novo no dossie precisa de GATILHO em
  `gabinete.GATILHOS`, senao a pergunta sobre ele nao puxa o arquivo; **(3)** tabela nova no dossie pode
  confundir `chapaDoDossie` — por isso as emendas vao em LISTA. Sem `pdftoppm` nem `pypdf`, PDF do
  ReportLab se le com um extrator Node sem dependencia (streams Flate + `Tj`/`TJ`), fora do repositorio.
- **A LISTA DE CIDADES IGNORADAS E DO TEXTO LIVRE, NAO DO CAMPO.** Print da Nelci (10/09/2026): Cidade
  "Capitao" com o aviso *"nao casa com nenhum dos 497"* — e Capitao e municipio do RS. `cidadesIgnoradas`
  (a patente do candidato) vale em `matchCity`, e `conferirGrafia` julgava o valor JA GRAVADO com ela.
  Hoje, sem casamento, ela procura o nome EXATO na lista inteira antes de acusar; `matchCity("Capitao")`
  continua null. **Guarda feita para o parser nao pode julgar o dado que o operador ja gravou.**
- **OFERECER O VOTO POR DINHEIRO E SEM INTERESSE** (regra dele, 10/09/2026, print da Simone: *"Quer meu
  voto?"* + *"Faz um pix pra mim"*). `semInteresse` le mensagem a mensagem, e a oferta vem PARTIDA em
  duas — nenhuma das duas sozinha e venda, e o "pix" mandava o caso para a negativa de ajuda. Hoje a
  rajada e lida JUNTA para a venda de voto, antes do laco. **Detector cujo caso vem partido em
  mensagens tem de ler a rajada junta** — e as guardas continuam por objeto: o voto e DELA, oferta sem
  dinheiro nao e venda, e "meu voto nao se compra" desfaz.
- **A ETIQUETA DE MATERIAL TINHA DUAS PORTAS FORA DA IA, e com ela no contato a IA nunca era chamada**
  (17/09/2026, *"se a etiqueta e colocada antes, a IA nunca e chamada"*). (1) `etiquetaDeEndereco` casava por
  TRECHO CONTIDO (`etiquetaDaLista`), entao "Material da Direita" contava como a de endereco e o contato era
  PULADO; hoje e rotulo exato. (2) `refreshTagSuggestions` gravava a de material quando uma regra de
  etiqueta, o anuncio ou a tabela de conteudo apontava para ela; hoje ela fica desmarcada e vai para a IA
  por `state.materialPelaRegra`. **Conferencia que mora num ponto unico so vale se NENHUM outro caminho
  grava a mesma etiqueta — procure tambem quem LE a etiqueta para decidir pular.**
- **AS ETIQUETAS DE PEDIDO E SEM INTERESSE TAMBEM PASSAM PELA IA** (17/09/2026, *"o deterministico esta
  botando etiqueta antes da IA confirmar qualquer coisa"*). Material ja conferia; estas duas nao.
  `conferirEtiquetaComIA(tipo, ...)` com `ia.TIPOS_DE_ETIQUETA`. **Sem interesse escolhido pelo FLUXO sem
  o `sim` nao marca NEM conclui** (fica aberto); apertado por ELE, nao se confere. **Etiqueta nova que
  depende de julgamento de texto entra em `TIPOS_DE_ETIQUETA`, nunca direto no `applyTags`.**
- **A ETIQUETA DE MATERIAL PASSA PELA IA ANTES DE ENTRAR** (16/09/2026, pedido dele: *"quando o
  deterministico identificar material, a IA assume e confere"*). Os cinco caminhos que a acendem (modelo,
  resposta pronta e rascunho que pedem endereco; pedido fora do anuncio; endereco dela no pulo) passam
  por `etiquetarEndereco`, e e LA que `iaCliente.conferirMaterial` roda — **conferencia nova de etiqueta
  entra nesse ponto unico, nunca nos chamadores**. So `material` com `CONFIANCA_MATERIAL` marca; `nao` e
  `incerto` nao marcam. **Com a IA desligada, marca como antes.** A mensagem NOSSA que acendeu a
  etiqueta vai em `acabamosDeMandar`: ela saiu agora e ainda nao esta em `state.nossas`, e sem ela a
  IA julgaria um pedido de endereco que nao ve.
- **"MATERIAL" SOZINHO NAO E COISA PARA ENTREGAR, e a lista fisica o tinha dentro** (15/09/2026).
  Relato dele: *"me mostre como a etiqueta de material esta sendo colocada porque tem dado bastante
  erro"*. **Medido: 6 falsos positivos em 16, todos a mesma palavra** — `materia(l|is)` em
  `OBJETO_DE_MATERIAL_FISICO`, entao *"quero receber o material"* (a frase mais comum desta base, e
  DIGITAL) marcava a etiqueta que manda **PULAR o contato para sempre**. **O projeto ja dizia o
  contrario em dois lugares** — o comentario da propria constante e
  `ia.AVISOS_QUE_IMPEDEM_ENVIO.afirmouTer` (*"'material' ficou de fora de proposito"*). **Duas listas
  com doutrinas opostas divergem no primeiro caso real: ao escrever a segunda lista, grep pela
  primeira.** Hoje "material" so marca com o qualificador fisico (impresso, de rua, para
  distribuir/colar/panfletar) e nunca em contexto digital. **Os QUATRO pontos que aplicam a etiqueta
  sao `enviarModelo`, `sendTemplate`, o envio do rascunho da IA e a excecao da rodada** — os tres
  primeiros pelo invariante `templates.ehPedidoDeEndereco` do texto que SAI, o quarto pelo que ELA
  escreveu.
- **A ETIQUETA DE MATERIAL: PRIORIDADE NO MODELO, EXCECAO NO PEDIDO FORA DO ANUNCIO** (regra dele,
  10/09/2026). **`enviarModelo` nunca aplicava a etiqueta** — a marca por `ehPedidoDeEndereco` morava so
  em `sendTemplate` e no caminho da IA, e todo modelo aprovado sai por `enviarModelo`. **Ao por uma
  marca "no ponto unico por onde tudo sai", confira que sao DOIS pontos: resposta pronta e modelo
  aprovado.** A excecao (`pedeMaterialForaDoAnuncio`) ignora o clique no anuncio e o vocabulario de
  conteudo digital (a etiqueta manda PULAR) e marca DEPOIS da decisao da passada, para o modelo continuar
  com prioridade. **E `etiquetaDaLista`/`etiquetaDeEndereco` sao ASSINCRONAS**: `!etiquetaDeEndereco()`
  sem `await` testa uma promessa e e sempre falso — nenhum teste nem verificador pega isso.
- **"VOU LA" SOLTO NAO E CONFIRMACAO DE PRESENCA — QUINTA vez desta lista, 12/09/2026.** Print da
  Laura, audio de 1min16 de militancia e oracao: *"estao botando os folhetos do 3 na minha tela, EU
  VOU LA, rasgo tudo, boto no lixo"* — e a rodada PULOU. Relato dele: *"pulando sem motivo, nao sei
  dizer o porque"*. **Medido: `confirmaPresenca` devolvia "sim"** pelo padrao `(vou|irei|vamos) +
  (la|ai)` em qualquer posicao, e `confirmou-presenca-evento` e a tecla 2. **"Vou la" e fala do dia a
  dia** (*"vou la no CRAS"*, *"vou la ver se resolvo"*): dos nove casos comuns do teste, cinco
  casavam. Hoje ela vale so como a MENSAGEM INTEIRA, e *"vou la sim"* em qualquer posicao (o que
  afirma e o "sim"). Antes dela sairam "vamos"/"vou" soltos (02/09), "confirmado" (04/09), "pode
  contar comigo" (04/09) e "estaremos" (06/09).
- **PULAR NAO DEIXA RASTRO, ENTAO A LINHA DO LOG E TUDO — e ela dizia "voce pulou".** Mesma print.
  O Andamento ja trazia `automatico pelo fluxo ("<regra>", caminho ...)` uma linha acima, mas a
  linha do pulo culpava ELE mesmo quando a decisao foi do fluxo: **duas linhas discordando sobre
  quem decidiu fazem a primeira parecer de outro contato.** Hoje ela diz `pulei pelo fluxo
  ("<regra>")` no caminho automatico. **Ao escrever a linha de um desfecho que nao grava nada,
  diga QUEM decidiu** — e nunca escreva "voce" num caminho que a maquina tambem percorre.

- **ROUPA NAO E MATERIAL — a lei veda e ele nao fornece** (12/09/2026): *"nao fornecemos nenhuma
  roupa"*. Lei 9.504/97, art. 39, § 6o veda distribuir **camisetas, chaveiros, bones, canetas e
  brindes**. Camiseta, camisa, colete e bone moravam em `OBJETO_DE_MATERIAL`, entao o pedido de roupa
  punha a **etiqueta de material (que PULA o contato)** e o rascunho **pedia endereco e prometia
  repasse**. Hoje e `cortesia.pedeRoupa`, somado ao sinal `pedeRespostaPessoal` no painel (tecla 6
  alta nos dois ramos, **sem precisar importar o quadro**) e com a regra no sistema e colada no
  pedido. **Ao tirar item de uma lista de permissao, confira quem mais a consulta como GUARDA** —
  `pedeAjudaFinanceira` usava `OBJETO_DE_MATERIAL` para se calar, e "me arruma um bone" passou a ser
  pedido de dinheiro; e aquela `conversa` NAO passa por `semAcentos`, entao "bone" nao casava "boné".
  **Chaveiro continua na lista do material** — mesma lei, decisao dele.

- **REPETICAO E O MAIOR SINAL DE MAQUINA — e a trava contra ela estava cega, 12/09/2026.** Duas
  prints do mesmo contato: a negativa de ajuda saiu as 10:20 escrita pela IA, ela reescreveu pedindo
  o Pix, e as 14:22 saiu **a mesma negativa outra vez**. Ele: *"IA se repetindo, ja vi outros casos;
  esse e o maior sinal de maquina respondendo, repeticao, nao pode acontecer isso"*. **Medido:
  `negativaJaSaiu` procura o maior pedaco LITERAL da resposta pronta — 815 caracteres** — e desde a
  3.10 o dinheiro e respondido pela IA em texto livre, que nunca contem aquele pedaco: a guarda de
  06/09 devolvia `false` sempre. **TERCEIRA vez da mesma classe** (etiqueta de material 3.40, de
  pedido 3.46): **marca amarrada a QUAL texto saiu morre quando o caminho de resposta muda**, e a
  saida e sempre reconhecer pelo INVARIANTE (`templates.ehNegativaDeAjuda`,
  `ehNegativaDeTrabalho`). Junto entrou a regra no prompt, colada no pedido: *"nao repita o que ja
  dissemos"*, com o que fazer quando ela insiste.
- **VENDA DE VOTO PELO VERBO: "pix pra votar".** Mesmo print. Os padroes da Simone (10/09) exigem o
  OBJETO *"meu/nosso voto"*, e ela escreveu *"pix antes... pra votar"* e *"um pix para votar em
  vcs"* — **a licao do "queria uma reuniao" (09/09) INVERTIDA**: la a lista era toda de verbos e ela
  pediu a coisa; aqui era toda da coisa e ela usou o verbo. O que qualifica e o **elo de finalidade
  colado no verbo de votar**; sem isso *"preciso de um pix pra pagar a luz, e vou votar em voces"*
  viraria venda. 9 das 23 assercoes sao falso positivo. **E um falso positivo ANTIGO caiu junto:**
  *"nao vendo meu voto por pix nenhum"* — apoiador — casava por *"vendo... meu voto"*, porque
  `NAO_VENDE_O_VOTO` exige o voto ANTES da negacao; hoje a negacao desfaz os tres caminhos.

- **VOCABULARIO INTERNO VAZA PARA A MENSAGEM: "transcricao", 12/09/2026.** Print do Jose Carlos: o
  rascunho respondeu *"A transcricao do seu audio chegou aqui e eu li o que voce falou"*, e ele: *"a
  pessoa nem sabe o que e isso e nao precisa saber, e so responder que ouvimos; essa resposta tirou
  credibilidade"*. **Medido: a palavra vem do NOSSO prompt** — a marca da linha diz "transcrito
  automaticamente", a regra 6 fala de transcricao cinco vezes e o padrao dele tem "Audio
  transcrito"; nada dizia que aquilo e interno. **Segunda vez no mesmo dia** (o nome do anuncio,
  3.50): **marca nossa virando conteudo da mensagem.** Hoje `ia.semFalarDeTranscricao` TIRA a frase
  (conserto, nao trava — ele cortou a trava que para a rodada no mesmo dia), sai a FRASE e nao a
  palavra (trocar daria *"o audio do seu audio"*), ha PISO de 40 caracteres para o texto nao virar
  farelo, e a regra esta na regra 6 **e** colada no pedido, so quando ha audio. **Ao escrever marca
  ou regra que fala da nossa maquina, diga que aquilo NAO pode ser dito ao eleitor** — o modelo
  reusa o vocabulario que recebe.

- **UM CAMPO CUJO SIGNIFICADO MUDA COM OUTRO CONTROLE E UM CAMPO CONFUSO — a chave da IA,
  12/09/2026.** Pedido dele: *"o armazenamento da key ficou confuso, deixe um espaco de key para cada
  modelo"*. Havia **um campo so**, e ele era da casa do MODELO ESCOLHIDO: para salvar a chave da
  OpenAI era preciso trocar o modelo, salvar e trocar de volta — e o failsafe precisa das DUAS de uma
  vez. A linha *"Guardadas: Anthropic ✓ · OpenAI —"* era remendo: ela existia porque o campo escondia
  a outra chave. Hoje sao **dois campos visiveis**, cada um dizendo se esta salva, **quais modelos
  atende** e **para que serve agora**. **E por CASA e nao por modelo** — a mesma chave da Anthropic
  atende Haiku, Sonnet e Opus, entao um campo por modelo seria a mesma chave colada seis vezes; o que
  faltava era o campo DIZER quais modelos ele atende. O armazenamento nao mudou (`iaChave` e
  `iaChaveOpenai`, pela razao de 07/09), a guarda do prefixo ficou e passou a dizer **em qual campo**
  a chave vai, e a lista de modelos virou uma so (`CASAS`), usada pelo seletor e pelos campos.

- **ABREVIACAO DE CIDADE SE CORRIGE SOZINHA, E `confianca: 'exata'` NAO E A LINHA DE CORTE.**
  Decisao dele (12/09/2026): *"isso ja era pra estar sendo corrigido pela IA; se ja escreve a cidade
  pode reescrever"*. **Nao precisa de IA:** `POA` resolve para Porto Alegre pela tabela de apelidos
  do `normalize`; e a IA so era consultada havendo palpite PENDENTE, que `POA` no CRM nao gera.
  **Medido, `exata` levaria `Vitoria -> Vitoria das Missoes` e `Esperanca -> Esperanca do Sul`** — o
  caminho do SUFIXO OMITIDO, a armadilha do "Sao Paulo" (08/09) por outra porta, trocando a cidade
  do eleitor com o COREDE junto. **A linha e a IGUALDADE depois de normalizar**
  (`conferirGrafia().podeCorrigirSozinho`): o escrito tem de resolver para o nome INTEIRO do
  municipio — apelido, abreviacao, acento, caixa e sigla do estado passam; erro de digitacao e nome
  parcial continuam pedindo o clique. **Prova no teste: nenhum dos 497 oficiais e reescrito.** Roda
  ANTES das sugestoes de etiqueta (senao a etiqueta sai de `POA`), entra como `from: 'grafia'` (o
  Salvar e a conclusao levam, a gravacao automatica recusa) e **o cabecalho diz o que fez** —
  correcao silenciosa em dado de eleitor e o que ele nao pode ter.

- **BOTAO QUE SO ENCHE O RASCUNHO MANDA SALVAR NUMA ABA QUE NAO ESTA NA TELA — 12/09/2026.**
  Relato dele, print da Cidade valendo `POA`: *"mando corrigir e continua escrito POA em vez de porto
  alegre"*. **Medido: o aviso, o nome oficial e a escrita estavam todos certos** —
  `conferirGrafia('POA')` aponta "Porto Alegre" e `deveGravarEntrada({from:'manual'})` devolve true.
  O defeito era de TELA: o botao "Corrigir para X" punha o valor em `state.draft` e dizia *"Salve
  para gravar no CRM"*, e o **Salvar mora na aba Dados** enquanto o aviso mora no CABECALHO, que
  aparece em TODAS as abas — fechado o atendimento, a correcao ia embora com o rascunho. Hoje o
  clique chama `saveClassification()` (sem data de conclusao, sem concluir, sem tirar etiqueta) e
  **recalcula o aviso**, senao ele fica na tela e parece que nao gravou de novo. **Botao que pede uma
  segunda acao tem de ter essa acao ao alcance da vista** — e "corrigir a grafia" ja e o ato
  deliberado que a regra da escrita exige, entao nao ha segunda decisao a tomar.

- **A MARCA DO ANUNCIO CARREGAVA O TEXTO DO ANUNCIO — 12/09/2026, print da Leonir.** Pergunta dele:
  *"vou ter que listar pra IA as frases especificas que sao de anuncio?"*. **NAO:** o clique e
  reconhecido pelo `utm` da SESSAO (dado, nao texto), e `marcaDaMensagem` escreve na linha que aquilo
  foi escrito pela campanha; a lista da Config e reforco para o SEGUNDO clique da mesma sessao.
  **Medido, o defeito era o NOME dentro da marca:** sem anuncio cadastrado o nome cai no `headline` do
  Facebook, que tinha **277 caracteres** e dizia *"Tenho orgulho de contar com esse apoio... Vote
  Capitao Martim, deputado estadual. 10122"* — e entrava inteiro no meio da linha da conversa. O
  rascunho agradeceu *"o seu apoio ao Flavio, ao Zucco e ao Capitao Martim"*, apoio que ela nunca
  declarou. **Marca que carrega o texto que a IA deveria ignorar nao avisa: abastece.** Hoje
  `ia.nomeCurtoDeAnuncio` corta em 60, e a regra *"o clique nao e fala dela"* vai no sistema E no
  bloco do CONTATO, so quando ha clique na conversa. **Ao escrever marca que cita um dado do
  ambiente, meca o TAMANHO do dado real** — `headline`, `campaign` e `referralUrl` sao texto de
  campanha, nao rotulo.
- **TESTE DE PROPORCAO DO PROMPT CAI SOZINHO — QUATRO vezes ja** (a quarta em 25/09/2026: a
  regra 11 passou de 80,2% para 79,5% das linhas ao entrar a regra 17, sem nada mudar de lugar; hoje
  o invariante e ESTRUTURAL — a regra esta dentro do bloco numerado, e o bloco vem antes do fecho) (10/09 o do padrao, 12/09 o da
  posicao das regras 8 e 9: `> 80% das linhas` virou 79,8% porque o rodape cresceu, sem nada mudar de
  lugar). **Conta a proporcao contra a LISTA que se quer proteger** (as regras numeradas), nunca
  contra o arquivo inteiro.

- **A TRAVA CONHECIA A REDACAO DO MODELO E NAO A QUE A IA ESCREVE — `ehPedidoDeEndereco`,
  12/09/2026.** Print: o rascunho negou o Pix, negou a contratacao, emendou *"mande seu endereco que
  encaminhamos o assessor da regiao"* e fechou pedindo `Nome , Cidade`. Ele: *"pedindo dados fora de
  contexto"* e *"ele nao pediu material tambem e ficou sem sentido encaminhar o assessor"*.
  **`enderecoSemMaterial` existe desde 08/09 para exatamente isso e estava MUDA:** o invariante so
  conhecia "endereco completo" e a enumeracao rua+numero+bairro, que sao a redacao do MODELO
  APROVADO — e o rascunho escreve a forma curta. Medido: `false` no texto que saiu, e
  `rascunhoPodeSairSozinho` **true**. **Terceira vez da mesma licao (a colinha 09/09, a chapa
  10/09): meca a trava contra a forma que quem escreve de verdade produz.** Hoje entra o verbo de
  PEDIR + **"seu endereco"**; a guarda e o possessivo ser DELA (*"meu endereco e rua X"*, *"nao
  tenho seu endereco"*, *"o endereco do CRAS"* ficam fora), e 13 das 24 assercoes sao falso
  positivo. **Nenhuma resposta pronta mudou de resultado** — a do voluntariado ja casava.
  **E A TRAVA DEIXOU DE BARRAR NO MESMO DIA, por correcao dele:** *"eu quero que mude o que a IA diz,
  nao parar todo tempo para eu revisar; isso tira todo sentido do automatizado"*. Ampliar o
  invariante estava certo; deixar a trava barrando transformou um aviso raro em **rodada parada em
  caso comum**. Hoje `enderecoSemMaterial` vive em `AVISOS_QUE_SO_AVISAM` (aparece na tela, nao
  barra), e a regra do endereco esta na regra 12 **e repetida no fim do bloco do CONTATO**. **E a
  segunda vez que ele me corrige com a mesma frase** (a Irema, 10/09): **quando ele descreve um
  COMPORTAMENTO, o conserto e o que a IA le — nunca uma trava depois.** Ao ampliar um detector que
  alimenta uma trava, MEÇA quantas vezes a trava passa a disparar: trava que para a rodada em caso
  comum e a automacao desligada.
- **O CADASTRO NAO FECHA UMA NEGATIVA** (mesmo print). `pedirDadosNoRascunho` tinha uma guarda so —
  `pedirDadosNaoCabe`, que responde *"ja temos o nome e a cidade?"*. Faltava a outra pergunta: *"o
  que vamos dizer agora e um NAO?"*. Hoje ha `sugestao.casoDeNegativa` (`pedeAjudaFinanceira ||
  pedeEmprego`), **separada de proposito**: `pedirDadosNaoCabe` guarda tambem o formulario da RODADA,
  e quem pede dinheiro continua recebendo o pedido de nome e cidade quando ele sai sozinho, sem
  negativa colada. **Guarda nova que nasce dentro de uma conta existente muda todos os caminhos que
  a leem** — a conta nova vai ao lado, com nome que diz o que ela pergunta.

- **"RUA X 120, BAIRRO" NAO ERA ENDERECO — a forma mais comum ficava de fora.** Print da Natalia
  (10/09/2026): ela respondeu o pedido de endereco com o numero COLADO no nome da rua, antes da
  virgula, e a rodada agradeceu e concluiu em vez de pular e marcar. `NUMERO_DA_CASA` so aceitava o
  numero depois de virgula, no fim ou com "no". Hoje ha `NUMERO_COLADO_NA_RUA`, com a guarda no MEIO
  (palavras de reclamacao e de tempo nao contam como nome da rua). **`semAcentos` junta toda quebra de
  linha num espaco** — padrao que depende de `\n` tem de ser conferido no texto original. E a etiqueta
  do pedido de endereco depende do campo "Etiqueta de quem MANDOU ENDERECO" preenchido: vazio, nada e
  marcado, e o log diz isso.
- **"TODO DETECTOR RESPEITA A MARCA DO ANUNCIO" ERA FALSO PARA OS DE PERGUNTA.** Print da Lidia
  (10/09/2026): o texto pre-preenchido *"Ola! Posso ter mais informacoes sobre isso?"* — anuncio
  cadastrado, modelo disponivel, `ehMensagemDeAnuncio` = true — virou pergunta pendente, e na chegada
  a pergunta fica ACIMA do recibo: tecla 6 em vez de `a`. Ele: *"nao reconheceu o anuncio"*.
  `conversaTemPerguntaAberta` e `perguntaPendente` nao recebiam `padroesDeAnuncio` nem olhavam a
  marca. **Detector novo que le a conversa pula `ehMensagemDeAnuncio(m, padroes)` no primeiro passo**
  — e ao afirmar que "todos respeitam", grep por quem recebe `padroesDeAnuncio` e confira os que
  ficaram de fora.
- **EXPLICACAO DE MAIS DE UMA LINHA FICA ATRAS DE "ⓘ DETALHES"** (pedido dele, 10/09/2026: *"o
  frontend continua poluído"*). O corte em tres linhas da 3.7 nao bastou. `panel/detalhes.js` recolhe
  todo `.wf-origin`/`.wf-hint` de mais de uma linha, juntando vizinhas num botao so, e lembra o que
  foi aberto (o painel redesenha a cada `setStatus`). **Ao criar texto que e DADO ou AVISO — nao
  explicacao —, marque `'data-fica': '1'`**, senao ele some atras do botao. **Num CONTEINER a marca
  protege tudo o que esta dentro** — e foi preciso: na 3.37 as linhas do Andamento (`.wf-preview`
  com `"nome — motivo"`) eram cortadas no travessao, e ele: *"aplicou detalhes ate no log, tenha
  discernimento"*. **O criterio:** texto FIXO escrito no codigo e explicacao; texto montado de
  VARIAVEL (nome, motivo, erro, contagem, texto de modelo) e dado — log, lista ou area nova de dado
  nasce com `data-fica` no conteiner. E texto novo de
  explicacao nao precisa de nada: o passe depois do desenho pega sozinho.
  **Na 3.37 (mesmo dia, *"pode resumir mais"*) nas abas Automatizado e Config tambem se resumem os
  ROTULOS, as descricoes (`.wf-preview`) e os avisos (`.wf-block`)**: fica a cabeca, o resto vai. Rotulo
  novo: ponha o NOME do controle antes de ": " ou " — ", que o resto vira detalhe sozinho. **Para medir
  texto do painel, monte-o a 380px** — a 800px tudo cabe numa linha e a medicao diz que nada precisa
  recolher (foi o meu primeiro erro).
- **PERGUNTA RETORICA NAO E PEDIDO — e a proximidade lexical pela QUINTA vez.** Print da Eloiza
  (10/09/2026): *"nao gosto de politica"*, *"e so promessa"*, *"se eu pedisse ajuda pro senhor,
  poderiam me ajudar? nao, ne?"* recebeu a negativa inteira da ajuda financeira (lei, CRAS, Cadastro
  Unico). Ele: *"a IA ignorou o contexto, a pergunta foi retorica"*. **Medido: nenhum detector leu
  pedido** — foi tecla 6 por pergunta aberta, o desfecho certo; a IA respondeu a hipotese ao pe da
  letra com a resposta pronta de pedido de ajuda como base. Regra 13 no prompt + a premissa da
  negativa colada nos exemplos. **"Gabinete" no rascunho agora e trocado mecanicamente**
  (`templates.semGabinete`), porque a proibicao no prompt nao bastou. **E teste de PROPORCAO do
  prompt cai sozinho quando o prompt cresce** — o do padrao exigia "mais da metade" e passou a 49,6%
  sem corte nenhum; exija o texto INTEIRO, que e o corte que se quer pegar.
- **PERGUNTA COM DUAS PARTES: A REGRA QUE SO CONHECE UMA CORTA A OUTRA.** Print da Juscelia
  (10/09/2026): *"O senhor e senador?"* recebeu so *"Somos a equipe do Capitao Martim, em que podemos
  ajudar?"*. Ele: *"a resposta correta seria o Capitao Martim e deputado estadual; as pessoas assumem
  que estao falando com o capitao, ate ai nao tem problema; no momento que perguntam, identificar como
  equipe"*. A regra 9 dizia *"NAO acrescente nada"* — e foi cumprida. **Ao escrever "nao acrescente
  nada", diga o que CONTA como parte da pergunta.** Junto: `conferirChapa` exigia nome e cargo na
  mesma frase, e *"...Capitao Martim. Ele e deputado federal."* passava — **meça a trava contra a
  forma que a regra nova produz** (a licao da colinha, 09/09, de novo). Ele escreveu "federal" e
  corrigiu: o Martim e deputado ESTADUAL.
- **O APOIO SO CONTA SE FOR PARA OS SEIS DA COLINHA** (regra dele, 10/09/2026, com a arte). Print do
  odone: *"PARA NAO VOTAREM NO RIGOTTO... AJUDEM A DIVULGAR"* recebeu o agradecimento pelo apoio,
  porque o padrao de voto aceitava `votarem no` + QUALQUER nome e ignorava o "nao". Medido, o mesmo
  furo estava em `vou votar na Manuela`, `meu voto e do Lula` e `eu apoio o Lula`. Hoje os padroes
  COM objeto so contam se o objeto estiver em `NOS_OS_DA_COLINHA` (os seis + "o senhor", "voces",
  "a chapa"), e `NEGACAO_LOGO_ANTES` desfaz a expressao. **Partido e "direita" sozinhos nao contam**
  — o Ciro continua apoio pelo *"sou Bolsonaro"*. **E a quinta vez da mesma licao: o que qualifica o
  apoio e o OBJETO**, e ao consertar um padrao confira os vizinhos com o mesmo formato. A lista e
  copia da chapa de `gabinete.md`: mudou a colinha, mudam os dois.
- **TOM NAO MUDA A RESPOSTA; PONTO DE VISTA MUDA** (17/09/2026: *"esses perfis direto, acolhedor etc nao
  mudam a resposta; preciso que sejam como se fossem pessoas diferentes com pontos de vista diferentes"*).
  Terceira reescrita do pedido das tres: *"varie"* trocou palavras, *"abordagens"* trocou a ordem das
  frases — as duas pedem jeitos de escrever a MESMA resposta. Hoje sao tres PERFIS
  (`ia.PERFIS_DO_RASCUNHO`: Capitao Martim, a assessora do atendimento, o militante da campanha), e o que
  muda e **o que cada um considera importante responder**. Sao papeis, nao pessoas reais, e nenhum diz
  quem e. **Ao pedir variacao a um modelo, varie a CABECA, nao o tom.**
- **CITAR REGRA DELE PELA METADE E REESCREVE-LA** (18/09/2026, o Adair: o ChatGPT respondeu um desabafo
  em dois paragrafos e nos em uma frase por paragrafo). A linha do TAMANHO citava so a primeira faixa do
  item 22 (*"mensagem simples: 1 a 3 frases"*) e deixava o *"desabafo: 1 a 4 paragrafos"* longe, no
  documento — a repeticao perto do pedido vence. **Ao repetir uma regra do padrao dele perto do pedido,
  repita-a inteira.** E perfil de rascunho nunca "escreve como" uma pessoa real: o do Martim passou a
  falar na primeira pessoa do candidato.
- **A ORDEM DOS CAMPOS DO ESQUEMA E UMA ALAVANCA DE GRACA** (17/09/2026): `abordagem` declarada ANTES de
  `texto` faz o modelo se comprometer com ela antes de escrever, e tres textos iguais ficam muito mais
  dificeis. **Medido, por mil rascunhos no Haiku: 1 chamada com tres = US$ 4,59; TRES chamadas separadas
  (uma por abordagem) = US$ 8,66** — o que pesa e a ENTRADA (o sistema tem ~8.400 tokens e seria pago
  tres vezes), nao a saida. **Antes de propor N chamadas, meca: o prompt de sistema e o custo, e ele
  cacheia.**
- **OPCAO REPETIDA E VERIFICAVEL, ENTAO E CONSERTO E NAO PROMPT** (17/09/2026: *"mesmo que nao case, ja
  deixei explicito para as mensagens serem diferentes"*). Foram quatro tentativas por texto. Hoje
  `ia.paresParecidos` mede, `ia.ancoraNaMesmaPronta` diz QUAL resposta pronta puxou as tres (hipotese
  dele: *"o acesso as nossas mensagens rapidas parece estar limitando o escopo"*) e a chamada e REFEITA
  com `ia.blocoDeRefazer`, mostrando ao modelo o que ele escreveu. **Uma refeita por rascunho**; nao
  melhorou, fica a primeira e o numero vai para o Andamento. **Quando a quarta tentativa de prompt falha,
  o conserto e medir a saida e refazer, nunca reescrever a regra de novo.**
- **APOIO COM EVENTO NAO E PEDIDO DE AJUDA** (17/09/2026, a janta pela campanha que recebeu CRAS tres
  vezes). **Nenhum detector casou**: o CRAS veio da resposta pronta mais PARECIDA no vocabulario.
  `cortesia.ofereceEventoPelaCampanha` exige evento pela campanha E pedido de contribuicao, desliga a
  regra 11 e proibe o vocabulario de assistencia social. **Antes de culpar detector, meca se algum
  casou** — quando nenhum casa, quem decide e a proximidade lexical das respostas prontas.
- **REGRA DE FORMA MANDADA ONDE O CASO NAO PEDE COME O ESPACO DAS TRES** (17/09/2026, *"falei de todas as
  situacoes"*). Varri o prompt de 15 situacoes e achei a regra 11 (*"acolha em UMA frase... e PARE"*) sendo
  escrita em TODA chamada, inclusive para quem so agradeceu: sem problema a acolher, as tres viram o mesmo
  agradecimento curto. Hoje a repeticao colada no pedido e condicional (`trouxeProblema`) e as regras de
  "uma frase e pare" tem endereco: sao a opcao (a). **As linhas que PROIBEM continuam em toda chamada** —
  proibicao nao obriga forma. **Ao por regra colada no pedido, pergunte se ela vale NESTE caso; ao ver tres
  opcoes iguais, monte o prompt de varias situacoes e leia, em vez de conferir a que a print mostrou.**
- **O CRAS SO PARA QUEM DISSE A DIFICULDADE, e e a mesma causa das TRES OPCOES IGUAIS** (17/09/2026).
  A regra 11 manda dizer "onde aquilo se resolve", e nada separava quem contou uma dificuldade de quem so
  escreveu "faz um pix": obrigada a citar o CRAS, a IA escreve a mesma mensagem tres vezes. Hoje o
  encaminhamento depende de ELA dizer a dificuldade concreta, e sem isso e uma frase de "nao podemos" e
  para. **Toda regra que obriga um CONTEUDO e uma hipotese de tres opcoes iguais** — as outras quatro
  estao no registro da v3.76, e a que sobra e medida por `ia.paresParecidos` (Andamento e janela de
  escolha). **Licao aprendida tambem achata: ela vale a risca so na PRIMEIRA opcao.**
- **SAUDE E A EXCECAO DA REGRA 11, E FOI ELE QUEM A ABRIU** (17/09/2026): *"em saude a situacao sempre e
  mais complicada; ao menos teria que perguntar qual o problema"*. A regra 11 (dele, a Irema) manda acolher
  em uma frase, dizer onde se resolve e PARAR — e era ela que despachava a pessoa doente para o posto **e
  deixava as tres opcoes iguais** (sem nada a acolher nem a perguntar, as tres viram o mesmo
  encaminhamento). Hoje `cortesia.falouDeSaude` (mais largo que `MAL_ESTAR`: familia conta, e le a conversa
  inteira) acende a excecao, COLADA na regra que ela excepciona nos dois lugares. **Pedido de dinheiro sem
  doenca continua negado de uma vez.** **Ao ver tres opcoes iguais, olhe que regra do prompt tirou o que
  havia para variar.**
- **NAO SOMOS CANAL DE RESOLUCAO DE PROBLEMAS — A INTENCAO E GANHAR VOTOS** (decisao dele,
  10/09/2026, print da Irema). Uma preocupacao com aposentadoria recebeu, sozinha e com zero avisos,
  triagem de INSS (*"ja deu entrada? foi negado? tem pericia? conte o que aconteceu... fico no
  aguardo"*). **O convite veio da ultima linha da regra 11, escrita por MIM** a partir da resposta
  pronta dele. Eu culpei tambem as respostas prontas `pedido-ajuda`/`pedido-emprego` (terminam com
  *"me conta o que aconteceu"*) e a medicao desmentiu: **os exemplos entram cortados em 500
  caracteres e a frase fica depois do corte** — antes de culpar um exemplo, confira o que do exemplo
  CHEGA ao prompt. Eu fiz uma trava e ele cortou: *"eu nao quero aviso, quero que o comportamento da
  IA mude"*. **Quando ele descreve um COMPORTAMENTO, o conserto e o que a IA le, nao uma trava
  depois:** a regra 11 foi reescrita e repetida no fim do bloco do contato; tirar as frases dos
  exemplos (`semConviteAoCaso`) ficou como garantia, com o texto pronto dele intocado.
- **NAO HA CHANCE DE SER CONTRATADO, E A IA NAO PODE INSINUAR** (anotacao da Solange, 08/09, lida
  em 10/09): *"as contratacoes sao bem limitadas e as decisoes saem da assessoria"*. Regra dele:
  *"contratos de eleicao sao decididos na pre-campanha, nunca iremos contratar ninguem pelo
  WhatsApp"*. **Frase que nao promete nada escapa de toda trava e ainda assim abre porta** — por isso
  a regra 12 escreve as frases proibidas. E `TRABALHAR_PARA_NOS` nao via *"na SUA campanha"*:
  **preposicao, artigo e possessivo sao pecas separadas.**
- **"ESCALAR" NO DOSSIE VIRAVA "VOU VERIFICAR E VOLTO" NO RASCUNHO.** Print do Fernando Britto
  (10/09/2026): perguntaram se ele foi bombeiro e comandante dos salva-vidas, e o rascunho prometeu
  verificar e voltar — com a carreira dele (Marinha, 2005–2020) `[CONFIRMADO]` no dossiê desde 01/09.
  Ele: *"se não tem nenhuma informação a respeito é só falar o que ele foi e deu"*. **Duas causas:**
  a pergunta sem o NOME dele não puxava o dossiê (os gatilhos eram nomes, cargos e partidos), e a
  regra 2 do dossiê mandava *escalar* — linguagem de quando a IA escolhia resposta pronta, que no
  rascunho vira promessa de retorno. **Ao reler instrução antiga para a IA, confira se o verbo ainda
  existe no caminho de hoje.** E `militar` no gatilho nunca depois de hífen: o anúncio *"Escolas
  Cívico-Militares"* chega em quase toda conversa.
- **A PROXIMIDADE LEXICAL DECIDE, E JA CUSTOU QUATRO PRINTS EM SEIS DIAS** (o quarto: *"te ajudar na
  votacao"* puxou o voluntariado, 10/09). *"representante"* puxou a
  resposta do falar-com-deputado (3.14), *"placa"* puxou a lista de materiais (3.23) e *"E o
  deputado ?"* puxou a regra 8 inteira (3.26, print da Denise) — periodo eleitoral, agenda, WhatsApp
  pessoal, para quem so perguntou **quem esta do outro lado**. Ele: *"dando informacoes alem do
  necessario; era falar que era do gabinete e se ater ao pedido"*. **Nos tres o deterministico
  ACERTOU** (`pedeFalarComDeputado` devolve null para a frase dela) e quem errou foi o modelo,
  puxando a regra vizinha que fala do mesmo assunto. **Ao escrever regra sobre um assunto, escreva
  tambem o que ela NAO cobre** — a regra 9 hoje diz *"perguntar se e ele NAO e pedir para falar com
  ele"*, e nomeia o que nao pode entrar na resposta.
  **A frase modelo dele e curta pelo que NAO tem:** *"Somos a equipe do Capitao Martim, em que
  podemos ajudar?"* — duas informacoes e um convite, sem agenda, sem seguranca, sem eleicao.
  > **Ele escreveu "gabinete" no exemplo e eu NAO troquei.** A decisao de 07/09 tirou a palavra do
  > vocabulario (e EQUIPE ou ASSESSORIA), com migracao e proibicao no prompt; hoje ele falava de
  > TAMANHO e ESCOPO, nao de vocabulario. Trocar por conta propria seria o erro da 3.15 de novo. Foi
  > dito a ele que a volta e decisao dele e mexe em tres lugares.
- **O PADRAO DE ATENDIMENTO FOI EDITADO PELA PRIMEIRA VEZ EM 09/09/2026, A PEDIDO DELE.** Ele
  estranhou a frase *"nao precisa se desculpar"* (*"nao lembro de pedir"*), e o **git respondeu**: a
  frase existe so em `atendimento.js`, o arquivo nasceu no commit `17ee6fe` de 06/09 e **nunca tinha
  sido editado** — veio dentro do documento que ele entregou. Perguntado entre a troca cirurgica e a
  ampla, ele disse **"troque"**, e a ampla e a que ataca a causa: **cinco ocorrencias, quatro
  apresentando a frase como algo que se diz e UMA escrevendo a condicao**. Sairam as das secoes 2, 9
  e 27; **ficaram as duas da secao 24, que sao as que trazem a condicao junto**. 4 linhas, nada mais
  do texto dele tocado.
  **Ao ser questionado sobre a origem de um comportamento, RASTREIE no git antes de responder** — foi
  `git log --diff-filter=A` e `-S` que mostraram que nem eu nem ele "implementaram" a frase. E
  **proporcao dentro do documento e causa**: regra que aparece quatro vezes solta e uma vez
  condicionada e cumprida solta.
- **FRASE PRONTA CARREGA UMA PREMISSA, E A PREMISSA NAO VEM JUNTO.** Print da Dileta (09/09/2026):
  ela escreveu duas linhas — *"Bom dia"* e *"Preciso de uma ajuda sua"* — e o rascunho respondeu
  *"nao precisa se desculpar"*. Ele: *"de onde saiu que ela pediu desculpas?"* **Medido: a frase
  aparece CINCO vezes no padrao dele e a condicao que a libera (*"ela se desculpa por ter pedido
  algo"*) aparece UMA. A repeticao venceu a condicao.** **Terceira invencao da mesma familia em tres
  dias, e a pior:** a resposta do "falar com o deputado" para quem pediu um representante (3.14) e a
  lista de materiais recitada (3.23) soam fora de contexto; **esta AFIRMA um fato sobre o que a
  pessoa fez**, e quem le entende que nao foi lida. Virou a trava `desculpaInexistente` (mecanica de
  verdade: a conversa esta ali, e desculpa e palavra, nao julgamento), condicionada como o
  `pediuReenvio` — quem SE desculpa continua ouvindo que nao precisava, porque ai a frase e a certa.
  **E a regra geral mora COLADA nos exemplos**, porque foi a instrucao de usa-los como BASE (3.22)
  que abriu isto: **regra que corrige o efeito de outra tem que morar ao lado dela.**
- **A LISTA DE MATERIAL VIROU LISTA DE ESTOQUE NA MINHA MAO, E ELA NAO E ISSO — o criterio e a
  MARCA.** Print da Sirlei (09/09/2026): ela mandou o endereco inteiro e pediu uma **placa**, e o
  rascunho respondeu *"nao e possivel fornecer placas nem doar esse tipo de bem"* e **recitou a minha
  lista para ela**. Regra dele: *"provavelmente nao temos, mas isso e melhor encaminhar para a equipe
  do material como todo o resto, e a equipe do material decide o que tem e nao tem"*. **Dois defeitos
  meus:** a lista fechada da 3.16 nasceu para separar propaganda de BEM QUE PRECISA SER COMPRADO (a
  cadeira de rodas, a bota) e eu a escrevi de um jeito que fez a IA **recusar propaganda que talvez
  exista**, contra a regra da Jonice; e **texto de prompt foi para dentro da mensagem palavra por
  palavra** — nada dizia que nao podia.
  **O criterio que fica e melhor que qualquer lista: a coisa leva o NOME, o NUMERO ou a MARCA da
  campanha?** Placa, banner e faixa levam; cadeira de rodas e bota nao. **Resolve o item que ninguem
  previu sem precisar prever.** A regra passou a dizer: a lista e EXEMPLO e nao estoque; a IA **nunca
  diz se temos**; **na duvida entre recusar e repassar, REPASSE**; e **nunca liste os itens para o
  contato**. **Ao escrever lista no prompt, diga se ela pode ser dita ao eleitor.**
- **A LISTA DO QUE PODEMOS DAR E DE PERMISSAO, E E CURTA — a de bloqueio durou UM DIA.** Print do
  Oseias (09/09/2026): *"Viu se vc conseguir uma bota de gaucho, numero 42"*, e o rascunho ofereceu o
  endereco e o repasse a equipe de materiais — o caso da Cleo (08/09) repetido com outro objeto, um
  dia depois. **Eu tinha escrito o escopo como lista de BLOQUEIO** (cadeira de rodas, remedio,
  colchao) e bota nao estava nela. Regra dele: *"nossa lista e pequena do que podemos dar, que e
  (folhetos, adesivos etc); todo o resto entra como pedido de emprego, ajuda, doacao"*. **E a
  disciplina que ja estava escrita aqui em `MODELOS_COM_ESFORCO`: lista de permissao, nunca de
  bloqueio — a inversa faz todo item novo nascer aceito ate alguem notar**, e aqui o que nascia
  aceito era um bem que o mandato nao pode dar a eleitor. A lista e **uma so** (o prompt e
  `cortesia.OBJETO_DE_MATERIAL`) e tem teste item a item; a regra de fechamento — *"se voce nao
  encontrar o item NA LISTA, ele nao e material"* — e o que a torna de permissao.
  `pedeAjudaFinanceira` ganhou **pedir que a GENTE consiga uma coisa**, e o que a torna segura sem
  enumerar objetos e a propria lista de permissao (havendo palavra de material, ela nao decide nada).
  **O sujeito e obrigatorio**, senao *"vamos conseguir a vitoria"* vira pedido de doacao — **quinta
  vez que este arquivo aprende que verbo sozinho e fala de campanha**.
- **FRASE DELE SOBRE O CONTEUDO DE UMA RESPOSTA NAO E DECISAO SOBRE QUEM DECIDE O CASO.** Em 09/09 ele
  escreveu *"aqui a resposta rapida sobre trabalhar na campanha bastava"* e eu troquei as caixas de
  emprego de `acao.ia` para a resposta pronta, desfazendo metade da decisao de 08/09. Ele desfez na
  hora: *"eu nao pedi por isso, so queria a resposta aproximada do que falei"*. **Ele estava falando
  do TEXTO.** Quando as duas leituras existem — mudar o texto, ou mudar quem decide —, e para
  perguntar; mudar o quadro ainda custa a ele importar um arquivo. O que ficou da tentativa foi o que
  ele pediu: a resposta `trabalhar-na-campanha`, o `tipo` de `pedeEmprego` e a troca de texto no
  painel.
- **TRABALHAR PARA A CAMPANHA NAO E PROCURAR EMPREGO — dois casos com respostas OPOSTAS num sinal
  so.** Print do Luciano (09/09/2026): *"Posso trabalhar aqui para o Capitao Martim"*, *"Mais preciso
  de material"*, *"E combinarmos quanto vou ganhar"* — militante se oferecendo. `pedido-emprego`
  manda para o SINE, o CRAS e o Emprega Brasil, que nao tem nada a ver. Hoje `pedeEmprego` devolve
  `tipo` (`campanha` | `emprego`) e **quem escolhe o TEXTO e o painel**, como a tecla 4 faz com o
  evento. A resposta nova e a regra dele: *"trabalhamos somente com voluntarios sem remuneracao e
  caso tenha interesse dar o endereco; se ele nao tiver interesse ele vai encerrar a conversa, caso
  contrario e marcado como pedido de material"* — e **o pedido de endereco E o desfecho**, porque
  `ehPedidoDeEndereco` casa e aplica a etiqueta de material (04/09).
  **DOIS detectores estavam mudos, e as duas causas ja sao licoes daqui:** `pedeEmprego` nao tinha o
  NOME do candidato na lista de objetos (so `deputado`/`candidato` — mesma correcao de 08/09 no
  `INSULTO_AO_ALIADO`) e exigia `trabalhar` COLADO na preposicao (*"trabalhar AQUI para"*);
  `pedeMaterial` so aceitava `preciso de` seguido de receber/ter/pegar, ou seja *"preciso de receber
  material"*, que ninguem escreve. **Foi a trava `enderecoSemMaterial` da vespera que revelou o
  segundo** — ela acusou o rascunho, certa sobre a FORMA e errada sobre o CASO: **trava nova que
  acusa onde nao devia e onde um detector esta mudo.**
  **E a 3.15 REVERTEU metade da 3.10**, a pedido dele: as caixas de emprego voltaram de `acao.ia`
  para a resposta pronta. As duas decisoes sao coerentes — em 08/09 a queixa era o detector
  **errando**, aqui ele estava **mudo**. **So o emprego voltou; dinheiro segue na IA.**
  Cuidado ao alargar `trabalh\w*`: ele pega o SUBSTANTIVO (*"o trabalho de voces e otimo"*), e a
  guarda existente acusou na hora — vale `trabalhar|trabalhando`.
- **AS RESPOSTAS PRONTAS IAM SEM NOME E CORTADAS EM OITO — a IA nunca viu 13 das 21.** Print da
  nicce (09/09/2026): ela se ofereceu para divulgar a campanha nas redes e o rascunho perguntou se
  queria *"trabalho remunerado ou voluntario"*, pediu portfolio e prometeu *"registrar sua mensagem
  para que a equipe analise"*. Ele: *"a IA deve usar como base a nossa resposta pra esses casos"* — e
  a resposta existia desde a 3.15, com o texto que ele ditou. **Medido: ela era a NONA e o corte era
  `slice(0, 8)`.** Ficavam de fora tambem as duas de evento, as de boas-vindas e a de perguntar em
  que pode ajudar.
  **O `name` e o que torna as duas regras compativeis.** Na 3.14 eu escrevi *"nao sao um banco de
  respostas, NUNCA copie o conteudo"* (certo para o caso do "representante"); aqui ele pede o
  contrario. As duas convivem porque agora existe o NOME: **tom e tamanho sempre; conteudo quando o
  NOME diz que a resposta atende ESTE caso** — ai ela e a BASE, e a IA nao inventa outra nem faz
  perguntas que a resposta pronta dispensa; **nao atendendo, nao copia nada**. Sem o nome, oito
  textos soltos nao dizem a que caso servem, e escolher vira adivinhacao.
  **Cuidado de borda:** os textos dele sao cheios de `{{saudacao}}`, e agora sao 21 colados no
  pedido — a regra 3 (nunca use variaveis) fica no comeco das instrucoes, entao ela foi CITADA ao
  lado dos exemplos. **Custo medido:** prompt de 6.469 para 8.370 tokens, +US$ 0,19 por mil rascunhos
  quentes e +US$ 2,37 por mil frios; continua cacheando no Haiku.
- **AS RESPOSTAS PRONTAS ENTRAM NO PROMPT COMO EXEMPLO DE ESTILO, E O MODELO AS USA COMO BANCO DE
  RESPOSTAS.** Print de 09/09/2026: a contato escreveu *"Posso falar com algum representante?"* e o
  rascunho respondeu, em cinco frases, que *"no periodo eleitoral nao e possivel disponibilizar o
  contato pessoal do deputado; a forma de falar com ele e nos eventos da agenda"* — a resposta pronta
  `falar-com-deputado` parafraseada. Ele apagou e digitou **uma linha**: *"bom dia, somos da equipe do
  capitao martim do que precisa?"*. **Medido: `pedeFalarComDeputado` devolve null para a frase dela
  (o objeto tem que ser ELE) e o quadro mandou para a IA — o deterministico estava certo.** O defeito
  e `montarSistemaRascunho`: os oito primeiros templates entram com o TEXTO INTEIRO (500 chars) sob o
  rotulo *"Exemplos do jeito de escrever"*, e `falar-com-deputado` e o SEXTO. **"Exemplo" convida a
  copiar**, e "representante" esta perto de "deputado" o bastante para o modelo recuperar o vizinho
  errado. Hoje o rotulo separa VOZ de CONTEUDO e diz que eles **nao sao um banco de respostas**.
  **RECUSAR O QUE NINGUEM PEDIU e a irma de abrir a porta que nao existe** (a regra 7): as duas
  respondem uma pergunta que a pessoa nao fez, e esta ainda faz parecer que ela pediu demais na
  primeira mensagem. A regra 9 e a FRONTEIRA da 8 — quem pergunta se pode falar com ALGUEM esta
  perguntando se ha gente do outro lado, e a resposta e "somos nos, do que precisa?", em uma frase.
  **Nao criei detector nem resposta pronta**: este arquivo ja registra quatro vezes que a lista de
  formas de perguntar nao fecha, e o caso ja chegava a IA pelo caminho certo — faltava ela saber o que
  responder. E a POSICAO da regra e testada (linha 348 de 370, colada na 8): e a licao de 07/09.
- **REGRA SEM ESCOPO E CUMPRIDA ATE ONDE ELA NAO DEVIA IR — e o modelo DIFERENCIOU antes de errar.**
  Print da Cleo (08/09/2026): *"preciso que compre um encosto Rumer ali na ortoponto"* e *"uma loja de
  venda de cadeira de roda"*, e o rascunho pediu o **endereco completo** prometendo repasse a equipe
  de materiais. Pergunta dele: *"a IA deveria saber pelo contexto que nao tem relacao com material de
  campanha, por que ela nao diferenciou?"* — **ela diferenciou**: a primeira frase da mensagem e *"um
  mandato nao pode comprar nem doar bens a eleitor por causa da lei eleitoral"*, que e a secao 9 do
  padrao dele aplicada certo. **Foi erro de ROTEAMENTO, e a culpa e da regra.** Tres medicoes: a
  condicao escrita era a FORMA do pedido (*"ela DISSE qual item quer"*) e nunca a CATEGORIA do item;
  "material" aparecia 5 vezes no prompt e **"material de campanha" ZERO** (eu nunca escrevi a
  fronteira); e a POSICAO decide — regra do material na linha **298** de 350, colada no pedido, secao
  9 na **80**, dentro do documento dele. E a armadilha de 07/09 (o item 22 do tamanho) **com o
  agravante de que a regra PERTO era a errada, e e a unica das duas que diz o que FAZER**: a secao 9
  fecha, a regra 5 abre um procedimento em maiusculas. **Entre uma regra que fecha e uma que abre um
  procedimento, o modelo pega a que abre.** Ao escrever regra com passo concreto, escreva junto onde
  ela PARA e para onde o caso desvia.
  **Os oito detectores devolveram null** — `pedeAjudaFinanceira` porque o verbo dispara (`preciso`) e
  o OBJETO tem que estar em `NECESSIDADES`. **O conserto nao foi acrescentar os objetos** (quarta vez
  que esta base aprende que a lista nao fecha): o invariante e a CONSTRUCAO — alguem pedindo que NOS
  gastemos dinheiro (`preciso que compre`, `voce pode comprar`, `me compra`), que vale para geladeira,
  colchao e consulta sem prever o item. **A guarda e o SUJEITO ser NOS**: *"eu preciso comprar"*,
  *"onde posso comprar"* (`posso` nao bate em `pode`), *"vou comprar"* e *"esses politicos compram
  votos"* ficam de fora. 12 das 19 assercoes sao falso positivo.
  **E a trava usa o invariante que ja existia:** `enderecoSemMaterial` barra o envio quando
  `templates.ehPedidoDeEndereco` casa e o sinal `pedeMaterial` e **false** — **pedir o endereco e o
  passo irreversivel**, e cria a expectativa que a Lei 9.504/97 trata. Medido no texto que saiu: um
  aviso cosmetico e `rascunhoPodeSairSozinho` **true**.
- **O ARGUMENTO DE UMA REGRA E O LIMITE DELA — clicar duas vezes no MESMO anuncio nao e navegar.**
  Print da Aldina (08/09/2026): dois cliques em *"Ola! Eu quero receber o Material da Direita"*, nada
  escrito, e saiu a mensagem do momento — *"ignorou o modelo que e prioritario de pedido de material,
  a pessoa mandou duas vezes"*. Reproduzido: os dois sinais (`rajadaDeAnuncios` e `pedeMaterial`)
  eram verdadeiros, e a rajada fica **acima das duas portas do modelo**. **O argumento escrito na
  propria funcao e o que a limita:** *"o modelo de um deles responde a um terco do que ela fez"* —
  verdade com a Irene (tres anuncios DIFERENTES, 05/09), falso aqui, onde ha um pedido so e o modelo
  daquele anuncio o responde inteiro. A rajada passou a exigir **dois textos distintos** (o texto
  pre-preenchido e a identidade do anuncio na conversa). **O criterio e a REPETICAO, nao o assunto**:
  amarra-lo a "material" faria uma regra depender de outro detector para decidir. Fica em aberto, e
  foi dito a ele: material MISTURADO numa rajada de verdade continua recebendo a mensagem do momento.
  **Ao achar que uma regra pegou demais, releia o argumento com que ela foi escrita — em geral ele ja
  diz onde ela para.**
- **A MARCA QUE TODO DETECTOR RESPEITA PODE NAO CHEGAR A IA — e o texto do anuncio nao chegava.**
  Pergunta dele (08/09/2026): *"atualmente a IA ignora o texto do anuncio?"*. **Medido: nao
  ignorava — lia como fala dela.** `prepararEntrantes` marca `geradaPeloAnuncio` desde 04/09 e
  **todo detector deterministico a respeita**; `conversaParaIA` e `mensagensParaIA` jogavam a marca
  fora. Efeito: o pedido do EIXO manda responder *"a mais recente que pede ou pergunta alguma
  coisa"*, "bom dia" e descartado como cortesia, e **o eixo caia no texto que a campanha escreveu**.
  **O lugar de dizer a NATUREZA de uma mensagem a IA e `marcaDaMensagem`** (ex-`marcaDeAudio`): sao
  tres — audio transcrito (31/08), audio ENCAMINHADO (a Irene, 07/09) e agora o anuncio. **A IA
  recebe texto: tudo o que o painel sabe e nao escreve ali, ela nao sabe.** O NOME do anuncio vai
  junto, e **so na mensagem que da para nomear** (`anuncioDaSessao`): a identidade vem do `utm`, que
  e da SESSAO, entao pertence ao clique que a abriu — o segundo e o terceiro sao reconhecidos pela
  FORMA e podem ser de outro anuncio (a Irene clicou em tres). Em `ia.js` o clique **saiu da
  contagem** e **nao recebe marca nenhuma** (nem `SEM RESPOSTA` nem `ja respondida`) — sem isso a
  instrucao fica ambigua: duas linhas marcadas e a frase no singular embaixo, **achado lendo o bloco
  gerado, nao por teste**. E ha o caso de ela **so clicar e nao escrever nada**, que antes recebia
  *"a ultima fala da conversa e NOSSA"* — mentira.
- **PEDIDO DE DINHEIRO E DE EMPREGO PASSARAM PARA A IA — a terceira correcao da mesma lista trocou
  quem decide.** Pedido dele (08/09/2026): *"o deterministico com relacao ao pedido de emprego e
  dinheiro tem dado errado; quando as palavras chaves referentes aparecerem mande a IA analisar e
  ela envia"*. As duas correcoes anteriores foram ESTREITAR a lista — "dinheiro" solto e vocabulario
  politico desta base (a Elenir, 06/09) e *"preciso de"* sem objeto pega quem ja explicou (a Odete,
  03/09). **Os detectores continuam sendo o GATILHO; o que mudou e o desfecho:** as quatro caixas do
  `fluxoPadrao` (duas no retorno, duas na chegada) trocaram `acao.resposta` por `acao.ia`. A POSICAO
  nao mudou — o pedido continua acima do recibo do anuncio. `pedeLigacao` e `pedeFalarComDeputado`
  ficaram como estavam: ele nomeou dois casos, nao a familia.
  **O que segura o texto agora sao duas coisas, e nenhuma delas e a que parece:** as secoes **9** e
  **13** do padrao DELE (negar com respeito, nunca prometer pagamento nem contratacao) e
  `AVISOS_QUE_IMPEDEM_ENVIO.promessa`. **`ia.RESTRITOS` esta INERTE** — ele impedia a IA de ESCOLHER
  esses dois textos, e a IA deixou de escolher texto pronto em 06/09 (nada chama `iaCliente.avaliar`
  desde entao). O aviso `cita bem ou beneficio` dispara em quase todos e **nao barra**: barrar por
  mencao faria a IA nunca responder o caso, que e o oposto do pedido.
  **Custo dito a ele:** com a IA DESLIGADA esses contatos PARAM na caixa, porque `iaEntra` exige
  `state.ia.ligada` e a automacao deterministica pula caixa que chama a IA.
- **O MODELO TEM SABER PROPRIO QUE CONTRADIZ A CHAPA, e contra prior assim o prompt e so pedido.**
  Print da Nara (08/09/2026): ela perguntou pelos candidatos a **deputado federal** e o rascunho
  respondeu *"nossa chapa tem o Felipe Pedri (numero 2228) e o Marcel Van Hattem (numero 300)"* —
  *"marcou van hattem para deputado federal sendo que e senador"*. **Medido: a tabela do dossie esta
  CERTA e foi mandada inteira no prompt.** Van Hattem **e hoje deputado federal** e nesta eleicao
  concorre ao Senado — o que o modelo sabe por fora briga com a tabela, e ganha. Por isso virou
  **trava** (`ia.conferirChapa` + `AVISOS_QUE_IMPEDEM_ENVIO.chapaTrocada`) e nao so linha de dossie:
  e o erro que **manda o eleitor votar em outra pessoa**. **A chapa sai de `gabinete.chapaDoDossie`,
  lendo o proprio `.md`** — copia em codigo divergiria na primeira troca de nome. E a trava **nao
  depende de `dossieAtivo`**: a tabela pode nao estar no prompt e o modelo escrever os nomes igual.
  **Proximidade pura nao serve para dizer de quem e um numero**, e foi a medicao que pegou: em
  *"Sanderson (222) e Marcel Van Hattem (300)"* o `222` esta a 11 caracteres de "Sanderson" e a 6 de
  "Marcel" — o dono e o mais LONGE, porque `" ("` liga e `" e "` separa. Guardas que a medicao
  obrigou: **"deputado" sozinho nao e cargo** (sem qualificador acusaria metade das frases certas),
  **o Delegado Zucco nao e o Zucco da chapa** (o dossie chama isto de *"o erro mais provavel"*),
  **`bolsonaro` nao vale como apelido** (sozinho e o Jair nesta base) e **numero fora de contexto de
  voto e data** (*"dia 22 em Canoas"*). 14 das 19 assercoes sao falso positivo.
- **AVISO QUE BARRA VAI EM DUAS LINHAS: a CONSTANTE e o detalhe.** `rascunhoPodeSairSozinho` compara
  por IDENTIDADE, entao acrescentar o detalhe dentro da constante faria a trava deixar de barrar em
  silencio. A constante barra; a segunda linha (*"na chapa: X aparece como Y e e Z"*) e o que ele le
  sem reabrir a colinha.
- **O FAILSAFE dizia QUE trocou de casa e nao POR QUE — e o motivo estava a um campo de distancia.**
  Print dele (08/09/2026), com o log dizendo so `RESERVA: claude-haiku-4-5`: *"preciso saber o
  porque que a ia do chatgpt nao mandou mensagem antes de ir pro failsafe, tem que ficar distinto
  qual esta mandando"*. O `background.js` ja punha `motivoDoTitular` desde a 3.5; **`ia-cliente` nao
  o repassava em nenhum dos tres caminhos**. Familia do *"a IA nao escreveu nada"* (2.90) e do log
  que mentia sobre a cidade (03/09): **mensagem que descreve o sintoma esconde a causa.** E o modelo
  **so aparecia quando falhava** — com duas casas configuradas, *"qual esta mandando"* vira
  adivinhacao, entao a linha diz sempre quem atendeu. **Motivo descartado nao se reconstroi:** o
  daquela chamada esta perdido.
- **A IA NAO PESQUISA NA INTERNET, e o dossie e o lugar onde a pesquisa entra REVISADA.** Pergunta
  dele (07/09/2026): *"a ia nao pesquisa na internet quando falta informacoes?"*. Nao — zero
  `tools` nos tres corpos de requisicao, e e uma chamada so. O que existe e `src/data/gabinete.md`,
  pesquisa feita UMA vez, escrita em arquivo com `git diff`, marcada linha a linha (`[CONFIRMADO]` /
  `[CONFERIR]`) e ligada por ele. **Busca ao vivo poria texto de pagina dentro de mensagem enviada
  em nome do mandato** — e uma pagina pode dizer qualquer coisa sobre o candidato: atravessa a
  fronteira que o projeto inteiro segura (o que sai e texto dele, ou rascunho que ele le). E
  **nao teria evitado nenhuma das quatro alucinacoes que viraram trava**: o que faltava nelas era
  dado DELE (estoque de material, quem e o assessor, a agenda, o link do grupo), que nao esta em
  pagina nenhuma.
- **A FONTE MAIS FORTE DO DOSSIE E O MATERIAL DELE, e nao a internet.** O numero de urna 10122
  passou seis dias como `[CONFERIR]` porque nenhuma fonte independente de 2026 o trazia — e quem
  resolveu foi a arte da campanha que ele mandou, mais o Headline do proprio anuncio. Quem esta na
  chapa e com que numero **e decisao dele**, nao fato publico a pesquisar. Ao encontrar lacuna
  assim, peca o material antes de pesquisar mais.
- **NUMERO DE URNA NAO SE REDIGITA: manda-se a ARTE.** Decisao dele (07/09/2026): *"essa colinha
  deve ser mandada pra quem pede"*. Sao seis numeros na chapa, e seis numeros redigitados por um
  modelo sao seis chances de mandar o eleitor votar em outra pessoa — a arte e a mesma informacao
  com zero. A IA pode dizer o numero de UM candidato perguntado diretamente (dado confirmado, esta
  na tabela); montar a chapa inteira e cartao. **O modelo da colinha e dele** (*"vou criar um modelo
  de mensagem pra ela"*).
- **TEXTO LONGO NO PAINEL DE 380px NAO E LEITURA, E EXPLICACAO LONGA VIRA MURO.** Pedido dele
  (08/09/2026), uma hora depois de eu por o padrao num `<details>` da Config: *"faca para que abra em
  popup, as letras estao pequenas demais para ler, e o frontend esta muito poluido... deixar as
  informacoes basicas e outra forma de ler o resto"*. **Duas licoes:** documento para LER abre em
  janela propria (`src/padrao.html`, aberta pelo service worker como a do fluxo — `chrome.windows`
  nao existe em content script), com corpo de 16px e coluna limitada; e as **58** explicacoes
  `.wf-origin` do painel passaram a nascer cortadas em tres linhas, por um PASSE no fim do
  `renderAll` (`encolherExplicacoes`) e nao por 58 edicoes — a medida e o `scrollHeight` DEPOIS do
  desenho, porque so o navegador sabe quantas linhas o texto ocupou, e assim a regra vale para a
  proxima explicacao que alguem escrever. **A conversao de Markdown da janela virou teste**: ela
  quebra em silencio (o texto sai como um bloco so, com os asteriscos a mostra) e ninguem olha o
  console de uma tela de leitura — a primeira versao fazia **132 paragrafos de meia frase**, porque
  cada linha do arquivo virava um `<p>`.
- **O PADRAO DELE VAI IGUAL PARA AS DUAS CASAS, e ha teste porque a igualdade e INVISIVEL.**
  Pergunta dele (08/09/2026): *"a IA do chatgpt tem acesso ao mesmo padrao de comportamento que
  passei pro claude?"*. Sim — medido montando a requisicao dos tres modelos: o texto esta em
  `system` na Anthropic e em `messages[0].role='system'` na OpenAI. **O que torna isso verdade e o
  desenho:** `montarSistema*` nao sabe qual casa vai atender; o que muda e so a FORMA do pedido. O
  teste existe porque, se um dia a montagem da OpenAI passar a cortar o sistema, **nada na tela
  mudaria** e o modelo responderia sem o padrao. Junto veio o botao na Config
  (*"Ver o padrao de atendimento que a IA segue"*), **somente leitura**: o documento e dele, vive em
  `atendimento.js` com historico no git, e editor ali convidaria a mexer sem o `git diff` que
  protege cada mudanca — o que muda toda semana vai nas Instrucoes extras.
- **O FAILSAFE DA IA MORA NO SERVICE WORKER, junto do teto — e nao no painel.** Pedido dele
  (08/09/2026): *"se for algo comum tem que ter um failsafe; eu ja quero botar o chatgpt, entao o
  padrao seria chatgpt atender, se ele falhar tenta com o claude"*. Falhou o titular
  (`ok: false` — 401, 429, 500, timeout, sem rede), a MESMA pergunta e refeita em `ia.modeloReserva`.
  **Fica no worker pela mesma razao do teto: e o unico ponto por onde o dinheiro passa**, entao as
  duas chamadas entram na conta e a segunda nao escapa do limite. **Nao tenta em tres casos, e a
  tela diz os tres** (sem reserva; reserva IGUAL ao titular, que nao e failsafe; sem chave do
  provedor do reserva) — todos parecem configurados. **E os relogios tiveram de ser reajustados:**
  uma chamada ruim virou DUAS, entao o `fetch` foi de 60s para 45s e a ponte de 75s para 100s
  (45+45 < 100). Sem isso o painel desistiria antes de o reserva responder — **o conserto do timeout
  teria desligado o failsafe**. O Andamento marca `RESERVA: <modelo>`, senao o log fala de tokens e
  preco de um modelo que nao e o escolhido na tela.
- **PENDURAR E PIOR QUE FALHAR: a chamada da IA nao tinha TIMEOUT nenhum.** Relato dele
  (08/09/2026): *"IA travou em dois casos, nao carrega a resposta"*, com a rodada parada em
  "Andando…" e nenhuma linha de erro. **Sao dois jeitos de pendurar:** a API nao responder (o
  `fetch` do worker esperava para sempre) e — o que so o lado do PAINEL resolve — **o service worker
  do MV3 ser encerrado no meio da chamada**, quando o `chrome.runtime.sendMessage` nunca recebe
  resposta e a promessa fica pendente, sem erro. A regra *"falha de IA nunca para a rodada"* ja
  existia e nao estava sendo cumprida: **falha vira aviso e a fila anda; pendurar nao vira nada.**
  Hoje sao dois relogios — 60s no `fetch` (`AbortController`) e 75s na ponte (`pedirAoWorker`), o da
  ponte maior para o motivo especifico chegar quando o worker esta vivo. **Toda ponte para o service
  worker precisa de relogio**, e o teste tem que travar as duas pontas: desiste no prazo E o caminho
  normal passa direto.
- **A MARCA AMBIGUA PRECISA DO QUE A DESAMBIGUA AO LADO — "casa" e "casada", 08/09/2026.** Duas
  prints, a mesma frase dele: *"nao sei porque tem etiqueta de material"*. **A Geci** escreveu
  *"ontem eu fui NA CASA nos BAIRRO pedir voto"* — militancia de rua — e `informouEndereco` somou
  as duas marcas exigidas (`BAIRRO` + `COMPLEMENTO`, este por causa de "casa"): etiqueta de material
  e contato PULADO. **"Casa" e a palavra mais ambigua daquela lista** (*"na minha casa"*, *"de casa
  em casa"*); como complemento ela existe, mas ai vem com numero ou "dos fundos". **A Dileta** tinha
  no cabecalho *Cidade: Chapada (aproximada) <- de "casada"*: `matchCity('casada')` da **Chapada** por
  distancia 2, e o caminho da resposta ao formulario aceita `aproximada`. Estado civil e ocupacao
  saem antes de casar, como o vocabulario da campanha. **A prova contra os 6.068 municipios (Brasil
  + RS) achou duas excecoes reais** — `Ilha Solteira` (SP) e `Olho d'Agua do Casado` (AL) —, as duas
  com guarda de contexto. **Rode essa prova sempre que apagar palavra do texto antes de casar.**
- **A PROMESSA MUDA DE PESSOA, NAO DE NATUREZA — e a lista so conhecia a primeira.** Print da Jonice
  (08/09/2026), com a pergunta dele *"esse erro de confirmar algo ja foi resolvido?"*: a mensagem
  dizia *"a gente consegue providenciar"* e, medido, tinha **zero avisos**. `PROMESSA` conhecia
  `vou|vamos|posso|podemos|consigo|conseguimos` — a primeira pessoa. Entraram a impessoal (*"da para
  providenciar"*) e o sujeito de fora (*"a equipe manda"*, *"eles enviam"*). E a irma da voz dela
  (*"voce deve receber"*, a Sandra, 06/09). **E a regra dele para o caso, que era o que faltava:**
  *"iremos repassar para a equipe responsavel dos materiais apos fornecer o endereco, e eles entram
  em contato sobre o que tem ou nao tem e se podem entregar"* — as regras anteriores diziam o que
  NAO afirmar e o rascunho preenchia o vazio sozinho. **A unica promessa que cabe e a de REPASSAR.**
  Fronteira com a regra 7: mandar a pessoa PROCURAR a equipe e devolve-la para onde ja esta; dizer
  que NOS repassamos e o mandato fazendo o proprio trabalho. **Trava que fecha o caminho certo junto
  com o errado e defeito que se paga sem perceber** — o teste exige as quatro variantes do caminho
  certo passando.
- **TEXTO REPETIDO BYTE A BYTE NAO E ALUCINACAO: E CONCATENACAO.** Print do Luiz Cavalheiro
  (08/09/2026), com o bloco `Nome , Cidade` saindo DUAS vezes na mesma mensagem e a pergunta dele —
  *"alucinou?"*. **Modelo nao repete um paragrafo identico**; o que repete e codigo que anexa. A
  causa: o texto combinado (momento + pedido, 04/09) conferia se o campo `pedidoJuntoDoMomento` E um
  pedido valido, e a tela avisa quando nao e — **faltava o outro lado**, ninguem conferia se a
  mensagem do momento **ja** era um. Hoje ha `momentoJaPede`, pelo invariante `ehPedidoDeDados`.
  **Antes de acusar a IA, olhe se as duas metades sao identicas.**
- **A TRANSCRICAO DECIDE "SEM INTERESSE" PELO CAMINHO FORTE, e nunca pela NEGATIVA.** Print do
  Sergio Nunes (08/09/2026): dois audios chamando o mandato de *"assassino, bandido, traidor,
  ladrao"* e, em segunda pessoa, *"ou tu e sem vergonha, ou tu e ordinario, tu e cafajeste"* — e a
  rodada ofereceu responder a mao. Ele: *"claramente sem interesse"*. **Isto AJUSTA a regra dele de
  03/09** (o lopezp4295), que continua valendo onde nasceu: la o gatilho era a negativa, e a fala
  vinha cheia de "nao" solto. **Reconhecimento automatico produz negativa falsa o tempo todo; nao
  produz "tu e cafajeste".** Junto entraram duas coisas: **xingar o nosso lado pelo NOME** (ate
  entao so os apelidos contavam, e a regra dele de 01/09 e mais larga), com a mesma mecanica do
  partido e com o `antes` valendo nas DUAS ordens (*"o PT chamou o Bolsonaro de ladrao mas e
  mentira"* casava); e a poda de `RECUSA_DE_PRESENCA`, que casava em *"nunca vou apoiar essa gente"*
  e **devolvia null antes de qualquer xingamento ser olhado** — a recusa de evento engolindo a
  recusa de contato. Verbo generico agora exige o que o torna presenca; *"nao vou"* sozinho continua
  valendo como MENSAGEM INTEIRA.
- **CIDADE DE FORA DO RS TEM LISTA SEPARADA E ETIQUETA PROPRIA.** Pedido dele (08/09/2026), com a
  print da etiqueta *"Fora do RS"*. `src/data/municipios-br.json` traz os **4.828 municipios do
  Brasil fora do RS** (IBGE), e ela **nunca se mistura com a do RS**: o RS vence por construcao (os
  497 nao estao nela), a etiqueta e outra (cidade e COREDE sao estaduais) e o casamento e **EXATO,
  sem Levenshtein** — muitos nomes sao palavra comum (*Natal*, *Serra*, *Barra*, *Bonito*,
  *Vitoria*). **Duas portas so**, as mesmas do RS: a mensagem que E a cidade (exigindo o texto
  inteiro) e a mencao depois de PISTA. A UF e lida do **valor do campo Cidade** (`cities.ufForaDoRS`)
  e nao do palpite, para alcancar tambem quem ja tem "Curitiba" gravado. **Dois defeitos que a
  medicao achou de brinde:** *"Sao Paulo"* virava **Sao Paulo das Missoes** (o caminho do sufixo
  omitido; hoje o nome literal de fora vence, e a comparacao e pelo NOME do municipio, nao pelo
  trecho casado), e *"Feliz Natal!"* gravava **cidade Feliz** com confianca exata — a mensagem cabe
  na porta do texto curto e `Feliz` esta contido nela.
- **O `fetch` DO NODE NAO ABRE `file://`, e o harness tem uma ponte para isso.** A extensao le os
  dados do pacote com `chrome.runtime.getURL` + `fetch`; nos testes isso falhava com *"fetch
  failed"* e a lista chegava **vazia** — teste verde medindo lista sem nomes. Nao incomodava antes
  porque a unica leitura em arquivo era a do RS, que os testes plantam no storage.
- **"NAO ACHEI O CADASTRO" NAO E "ELA NAO RESPONDEU" — e CIDADE DE OUTRO ESTADO e invisivel.** Print
  da Lenir (08/09/2026): ela respondeu o formulario com *"Lenir"* e *"Curitiba"*, em duas mensagens,
  e no dia seguinte recebeu a mensagem do momento COM o pedido de novo. **Medido: `extract(['Lenir',
  'Curitiba'])` devolve NADA** — Curitiba nao esta entre os 497 municipios do RS (a extensao so
  conhece os daqui, de proposito: a etiqueta serve ao filtro estadual dele), e nome sozinho numa
  mensagem propria nao e alcancado pelo modo generoso, que espera nome e cidade juntos. Com os dois
  vazios, `faltaCadastro` concluia que o formulario tinha sido ignorado. **O texto combinado existe
  para quem IGNOROU** (pedido dele de 04/09), e quem respondeu nao ignorou — mesmo que a resposta
  seja invisivel para o parser. Hoje ha `escreveuDepoisDoPedido`, lido da CONVERSA por
  `respostasApos(..., templates.ehPedidoDeDados)`, **exigindo texto de verdade**: figura, emoji e
  aviso da plataforma continuam contando como ignorado, que e o que preserva o caso de 04/09.
- **FALAR MAL DO PL OU DO REPUBLICANOS E HOSTILIDADE CONTRA NOS; falar mal do PT esta do nosso
  lado.** Regra dele (08/09/2026), literal. Dispensa a segunda pessoa pelo mesmo motivo do
  `INSULTO_AO_ALIADO`: **o alvo esta escrito**, e o que torna `AGRESSAO` ambigua e nao saber a
  direcao. **A segunda metade da regra e a GUARDA da primeira, e e ai que se erra:** as duas siglas
  aparecem na MESMA frase o tempo todo (*"o PL e bem melhor que o PT, que e um bando de ladroes"*).
  Duas travas — janela de 30 caracteres (o insulto tem que estar COLADO na sigla) e **nem o meio nem
  o que vem ANTES do xingamento pode ter o adversario**. A segunda nasceu da medicao: *"comunista e
  ladrao, PL nunca"* casava na ordem inversa, com o meio limpo. `\bpl\b` e a peca arriscada
  (*"sou PL"* e fala comum aqui) e o que a segura e o xingamento ao lado. **18 das 24 assercoes sao
  falso positivo** — `semInteresse` aplica etiqueta permanente e conclui em silencio.
- **DADO QUE FALTA NO DOSSIE PRECISA DE GATILHO, senao o dossie nem e consultado.** Print de
  08/09/2026: a contato perguntou *"E CRISTAO OU COMUNISTA?"* e o rascunho respondeu so a metade do
  partido, abrindo com *"nao vou te passar uma informacao que nao tenho certeza"*. **A IA acertou o
  comportamento e faltava o dado** — o dossie nao tinha uma linha sobre fe. Ele: *"martim e catolico
  ou seja cristao e seu publico normalmente e cristao"*. Duas metades: a secao **Fé** no dossie (com
  o *como responder*, porque *"e evangelico?"* e onde a IA erraria sozinha — a base e majoritariamente
  evangelica e a tentacao de agradar mora ai; foi para a lista do que ela NUNCA afirma), e o
  **gatilho** em `gabinete.GATILHOS`, sem o qual a pergunta da fe sozinha nao puxa o arquivo. Neste
  caso quem puxou foi o *"partido"* da mensagem SEGUINTE — por acidente. **`deus` e `fe` ficaram de
  FORA da lista de proposito e ha teste travando**: sao o fecho de boa parte das mensagens desta
  base, e com elas o dossie entraria em quase toda chamada, contra o pedido dele de 01/09.
- **`[CONFERIR]` E O QUE TORNA SEGURO PESQUISAR.** A regra 4 do dossie diz que linha `[CONFERIR]`
  nao e afirmada ao contato, entao pesquisa nova entra INERTE e vira util quando ele confirma — e
  riscar o que esta errado vale tanto quanto confirmar o certo. Foi assim que os projetos do Martim
  entraram em 07/09 (quatro com numero de PL, seis sem), com `al.rs.gov.br` e `martim.rs` nao
  alcancados na pesquisa: **fonte primaria nao alcancada e razao para marcar, nao para omitir.**
- **Do dossie, so PARTE vai para o prompt:** `semBlocoDeRevisao` corta as linhas `> `, o
  *"Espaco do Thiago"* e as *"Fontes"*. Medido em 07/09: arquivo de 13.184 caracteres, **8.831 no
  prompt** (2.523 tokens). E ele entra **so quando a conversa pede** (`precisaDoDossie`), o que
  custa +US$ 0,25 por mil rascunhos no Haiku. Ao estimar o custo do dossie, meca o texto INJETADO —
  o tamanho do arquivo superestima em um terco.
- **O LINK PADRAO DE GRUPO era inalcancavel SEM CIDADE — e sem cidade e a chegada.** Pedido dele
  (07/09/2026): a resposta que manda entrar no grupo para acompanhar a agenda, *"so que o link do
  grupo cai e eu tenho que trocar, entao tera que ser uma mensagem pronta"*. `cities.linkFor` tinha
  `if (!key) return {reason: 'Cidade nao definida'}` **acima** da consulta ao `defaultGroupLink`, e
  `vars.buildContext` nem chamava a funcao sem cidade: o campo que existe justamente para *"nao
  tenho o grupo desta cidade"* nao valia no caso mais comum de todos, que e **nao ter cidade
  nenhuma**. Quem chega pelo anuncio esta exatamente ai. A prioridade nao mudou (grupo da cidade
  primeiro, padrao depois) e a resposta `link-grupo`, que promete *"o grupo de {{cidade}}"*,
  continua bloqueando sem cidade — **a trava certa para ela e o TEXTO, e nao a falta do link**.
- **Link que cai vira `{{link_grupo}}` na Config, nunca texto colado.** A resposta `agenda-grupo`
  tem base e duas variantes; com o link escrito dentro, trocar o link seriam TRES reescritas e a
  chance de uma ficar velha. Com a variavel e **uma edicao num campo** — e link vazio **bloqueia o
  envio** com o motivo na tela, entao link morto nunca sai para eleitor. O valor de hoje entrou por
  migracao (`migrarLinkDoGrupoAtual`), que **so preenche se estiver vazio** e marca em `migracoes`:
  sem a marca, o link que ele trocar amanha voltaria ao antigo no proximo carregamento do painel.
  **E nao entrou como default do `DEFAULT_STORE`** — o campo pode ja existir vazio no
  armazenamento dele (o botao "Salvar grupos" o escreve), e ai o default nunca o alcancaria.
- **"O sistema de mandar por anuncio ja existe"** — corte dele, 07/09/2026, e estava certo. Eu havia
  criado junto um detector (`perguntaAgenda`), a exclusao em `RESPONDIDA_POR_PRONTA` e DUAS caixas
  no `fluxoPadrao`, invocando a regra *"resposta pronta sem gatilho e trabalho parado"*. O gatilho
  que ele quer e a **acao do anuncio**, que ja existe e e onde ele configura o anuncio novo. Foi
  tudo revertido. **A licao nao e "nao criar gatilho": e perguntar se ja existe um.** E cuidado com
  a meia-reversao: tirar as caixas e deixar a exclusao em `RESPONDIDA_POR_PRONTA` seria pior que
  nao ter feito nada — a pergunta da agenda deixaria de ser tecla 6 e cairia em `conteudo-pedido`,
  ou seja, material de campanha como resposta a *"qual a agenda?"*.
- **MENSAGEM DE ERRO QUE DESCREVE O SINTOMA ESCONDE A CAUSA — e a causa estava no campo do lado.**
  Print dele (07/09/2026) com a pergunta *"qual foi o erro?"*: a caixa da rodada dizia *"a IA nao
  conseguiu rascunhar (a IA nao escreveu nada)"*, que **e o sintoma**. `iaCliente.rascunhar`
  devolve `{texto: '', avisos: [motivo]}` em toda falha, e ali estava escrito o que aconteceu —
  teto de gasto atingido, chave recusada, conta sem credito, resposta ilegivel, sem rede. O
  `if (!bruto)` de `rascunharParaEle` voltava com frase fixa **antes de ler `avisos`**, e nada
  disso chegava a tela nem ao Andamento. O caminho do SUCESSO ja mostrava os avisos (o `barrado`
  junta todos); so o da falha nao. **Regra geral: funcao que devolve motivo em dois campos exige
  que quem chama leia os dois.** E a familia do log que mentia (a cidade *"nao gravada"* que era
  gravada) e do aviso que mandava procurar o interruptor na aba errada.
- **DUAS APIS AGORA, e quem escolhe a casa e o NOME DO MODELO.** Implementado em 07/09/2026 a
  pedido dele (*"faca agora a implementacao para utilizar a api do chatgpt"*), depois da comparacao
  de custo. `ia.provedorDoModelo` decide: `gpt-`, `o1..o9` e `chatgpt` vao para a OpenAI, o resto
  para a Anthropic. **Nao existe campo "provedor"** de proposito — dois controles para a mesma
  coisa divergem, e a divergencia aqui seria muda (chave da Anthropic mandada para a OpenAI da 401
  *"chave recusada"*, mandando conferir uma chave que esta certa). A mesma funcao escolhe o
  endpoint (`ia-cliente.PROVEDORES`) e a chave (`CHAVE_DO_PROVEDOR`, lida no `background.js`):
  **uma fonte de verdade**. `iaChave` continua sendo a da Anthropic — renomear apagaria a que ele
  ja tem salva, porque `store.get` so mescla default em chave que FALTA.
- **`prompt_tokens` da OpenAI INCLUI o cacheado; `input_tokens` da Anthropic NAO.** E a diferenca
  mais facil de errar entre as duas contas, e errar cobra o prompt inteiro DUAS vezes: com ~5.300
  tokens de sistema, cada chamada cacheada apareceria quase 10x mais caro do que e, e o **teto de
  gasto** — a unica trava de dinheiro do projeto — fecharia sozinho no meio de uma rodada. Por isso
  `entrada = prompt_tokens - cached_tokens`. Tem teste.
- **Na OpenAI nao existe ESCRITA de cache, e por isso a chamada fria e relativamente mais barata.**
  O cache e automatico a partir de 1.024 tokens de prefixo, nao se pede (`cache_control` daria 400)
  e escrever nao custa nada; na Anthropic escrever custa **1,25x**. Consequencia na conta, medida:
  do frio para o quente o Haiku vai de $12,00 para $5,92 por mil rascunhos, e o gpt-5 de $16,73
  para $10,77 — a coluna FRIA, que e o caso comum numa rodada espacada, favorece a OpenAI. Os
  fatores sao POR MODELO em `PRECOS_USD_POR_MTOK` (`cacheEscrita: 0`), com o da Anthropic como
  padrao. **Cuidado ao MEDIR:** eu modelei a chamada fria da OpenAI com `cacheEscrito` e o custo
  saiu MENOR que o quente — na OpenAI o prefixo frio e entrada normal, e nao ha campo de escrita.
- **`max_completion_tokens`, NUNCA `max_tokens`: a familia GPT-5 recusa o nome antigo com 400.** E
  a mesma classe da armadilha do `effort` no Haiku, e nao aparece em teste de tela nenhum. Junto
  vem o gemeo do Opus 5: **o raciocinio e cobrado como saida e cabe DENTRO do teto**, entao a
  conferencia de cidade (512 na Anthropic) ganhou **piso de 2.048** nos modelos que raciocinam —
  sem ele o raciocinio consome a cota e o JSON sai truncado, que e chamada paga devolvendo nada.
  Teto nao e gasto: paga-se pelo token produzido. Quem segura a conta e o `reasoning_effort`.
- **O strict mode da OpenAI exige TODA propriedade em `required`** — e os tres esquemas deste
  projeto deixam campos opcionais de proposito (`templateId` so vale respondendo, `cidade` so
  corrigindo, `motivo` e enfeite util). Sem transformar, ele recusa o esquema INTEIRO com 400.
  `ia.esquemaEstrito` faz isso sem mutar o original (a Anthropic usa o mesmo esquema na mesma
  chamada) e **remove `enum` vazio**: `esquemaDaDecisao([])` produziria `enum: []`, que nao casa com
  valor nenhum. Exigir tudo nao muda nada do nosso lado — os tres `validar*` sempre trataram campo
  vazio.
- **`refusal` e canal PROPRIO do strict mode, e nao vem em `content`.** Ler so o `content` faria
  uma recusa do modelo parecer resposta vazia. Vira `null`, que vira `incerto` — o painel se
  comportando como antes da IA existir.
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

Node 18+, sem dependência. Antes de dar tarefa por concluída, as vinte e uma suítes passando:

```bash
node tests/parser.test.mjs && node tests/contract.test.mjs && node tests/vars.test.mjs && node tests/tags.test.mjs && node tests/hsm.test.mjs && node tests/conversa.test.mjs && node tests/templates.test.mjs && node tests/categorizar.test.mjs && node tests/cortesia.test.mjs && node tests/sugestao.test.mjs && node tests/ia.test.mjs && node tests/gabinete.test.mjs && node tests/arvore.test.mjs && node tests/anuncios.test.mjs && node tests/observacoes.test.mjs && node tests/detalhes.test.mjs && node tests/rolagem.test.mjs && node tests/imagem.test.mjs && node tests/perfis.test.mjs && node tests/lote.test.mjs && node tests/atendimento-novo.test.mjs
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
