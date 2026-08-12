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
src/lib/hsm.js          modelos de mensagem aprovados
src/lib/vars.js         variáveis dos templates e bloqueio por variável faltante
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
- **Rajada de requisições derruba a API — e a plataforma junto.** `Failed to fetch` não é erro
  HTTP: é o preflight CORS recusado, o que um limitador de taxa devolve. Cada contato aberto
  custa uma sessão na plataforma + 3 chamadas nossas, então **toda volta de laço precisa de
  respiro**, não só as que enviam.
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
- **Aba acordada e computador acordado são problemas DIFERENTES.** O áudio do `keepalive`
  impede o Chrome de congelar a aba; ele não impede o Windows de suspender por inatividade, e
  rodada longa não toca em teclado nem mouse. A segunda trava é `chrome.power` (`'display'`, no
  service worker — content script não alcança), pedida no começo da rodada e solta no `finally`.
- **Aba escondida é aba CONGELADA, não lenta.** Medido: `setInterval(120ms)` deu **zero**
  disparos em mais de um minuto. Congela junto o JavaScript da plataforma, então mover só as
  nossas esperas para fora da aba não resolveria — o Angular também para. O que descongela é
  áudio tocando (`keepalive.js`), e áudio exige gesto: ligar sempre a partir de um clique.

## Regras do projeto

- **Sem IA na extração.** Custo por contato. Parser determinístico: regex, dicionário, lista de
  referência (IBGE, COREDEs) e confirmação humana em 1 clique.
- **Não adivinhar formato de escrita.** O gravador (`recorder.js`) observa a plataforma fazendo
  uma vez e copia. Sem contrato aprendido, a extensão **recusa** em vez de tentar.
- **Automático só grava o determinístico:** cidade que casou exato com o IBGE, o COREDE dela e
  as etiquetas de conteúdo. Palpite aproximado sempre espera clique.
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

Node 18+, sem dependência. Antes de dar tarefa por concluída, as seis suítes passando:

```bash
node tests/parser.test.mjs && node tests/contract.test.mjs && node tests/vars.test.mjs && node tests/tags.test.mjs && node tests/hsm.test.mjs && node tests/conversa.test.mjs
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
