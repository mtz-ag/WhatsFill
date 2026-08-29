# WhatsFill — Guia para Claude Code

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
src/lib/triagem.js      quem a rodada NÃO trata: pedido de ajuda/dinheiro (puro, testado)
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
- **Recarregar a extensão órfã as abas abertas** (`Extension context invalidated`): o painel
  falha em silêncio até dar F5. Já causou diagnóstico errado duas vezes.
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
- **"Ajuda" é a mesma palavra dos dois lados da campanha.** *"Quero ajudar"* é apoiador se
  oferecendo — o público principal, já classificado como "Apoiador Muito engajado" no
  `extract.js`. *"Preciso de ajuda"* é o oposto, e é o caso que NUNCA pode receber resposta
  automática (Lei 9.504/97). Um padrão com `/ajuda/` põe metade da base na fila de revisão dele e
  o trabalho para. Em `triagem.js` a oferta desarma a mensagem inteira ANTES de qualquer teste de
  pedido, e há teste para cada lado.
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
- **Diálogo do Material é MODAL e mata a rodada em silêncio.** Anexar figura no meio da
  resposta à mão deixa um diálogo por cima; o clique no próximo item da fila não chega ao item e
  a rodada terminava dizendo "a fila acabou". Antes de abrir o próximo contato, espere a tela
  ficar livre — **não feche**: o diálogo é dele, e fechar descarta o que ele estava mandando.
- **`confirm()` nativo não pode aparecer dentro da rodada.** Ele abre DEPOIS da decisão, fora do
  lugar onde ele está olhando, e trava o laço num diálogo do navegador. Aviso de duplicata vira
  linha da pergunta da rodada; quem chama passa `jaConfirmado: true`.
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

## Testes

Node 18+, sem dependência. Antes de dar tarefa por concluída, as nove suítes passando:

```bash
node tests/parser.test.mjs && node tests/contract.test.mjs && node tests/vars.test.mjs && node tests/tags.test.mjs && node tests/hsm.test.mjs && node tests/conversa.test.mjs && node tests/templates.test.mjs && node tests/categorizar.test.mjs && node tests/triagem.test.mjs
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
