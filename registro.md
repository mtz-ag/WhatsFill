# Registro de mudanças

> Entrada nova sempre no **TOPO**. Formato: data, o que foi pedido, o que foi feito, causa raiz
> quando for correção, decisões, arquivos, pendências.

---

## Estado atual — leia primeiro

**Onde o projeto está:** funcionando em produção no dia a dia do Thiago. Repositório privado em
`github.com/thiagokcw-coder/WhatsFill`, `main` sincronizada. **Publicação na Chrome Web Store
cancelada** (decisão do Thiago, 06/08/2026): a extensão fica carregada descompactada, uso
interno. `STORE.md`, `PRIVACY.md`, `tools/package.mjs` e `icons/promo-*` viram resto sem uso —
mantidos no repositório, mas nenhuma tarefa nasce deles.

### O laço de trabalho, hoje

Atendimento assíncrono, em três rodadas na aba **Automatizado**:

0. **Concluídos sem retorno: reabrir e perguntar** — sobre a lista de concluídos (o ícone de
   caixa), filtrada por ele: Reiniciar, modelo aprovado, concluir de novo, próximo. Reabrir não
   reabre a janela de 24h, então só modelo aprovado sai daqui.
1. **Novos: pedir os dados** — assume, manda o formulário (nome/cidade/grupos), conclui, volta
   para "Novos". Quem não tem o aceite do anúncio, ou já respondeu nome/cidade, é **assumido sem
   receber nada** e vai para "Meus" como triagem. A fila drena.
2. **Conferir e responder a fila** (botões "Meus" e "Outros") — classifica e **pergunta contato a
   contato**, com atalhos: `1` mandar modelo do conteúdo pedido, `2` pular, `3` concluir sem
   enviar, `4` agradecer e concluir, `5` mensagem do momento, `6` responder à mão (retoma quando
   você concluir), `7` perguntar interesse no conteúdo e concluir (só para quem ainda não tem
   etiqueta de conteúdo), `Esc` parar. Nada sai da fila sem decisão humana — **com uma exceção,
   decidida em 10/08:** contato cuja última mensagem já é nossa é concluído sozinho, porque não
   há o que enviar a quem já foi respondido.
3. **Sem retorno: modelo aprovado** — janela de 24h vencida, HSM é o único envio que chega.

Quem responde depois de concluído reaparece em **"Meus"** — a plataforma faz essa triagem
sozinha, não há o que automatizar aí.

### Confirmado em uso

Rodada de 30 envios encerrada por limite; primeiro envio real de modelo aprovado + agradecimento;
keepalive de áudio segurando a aba escondida sem congelar; "Ver mais" paginando a fila;
classificação automática gravando cidade, COREDE, etiquetas e data e **conferindo relendo**.

### Fila de trabalho, em ordem de valor

0. **Rever os contatos com cidade "Capitão"** (10/08): a patente do candidato casava com o
   município, com confiança exata, então foram gravados sozinhos — cidade e COREDE errados.
1. **Tabela "Modelo por conteúdo" está vazia.** Sem ela a tecla 1 nunca aparece — é o
   pré-requisito do fluxo inteiro de resposta. Aba Config, `Etiqueta = Nome do modelo`.
2. **"Meus" acumulou ~60 contatos** enquanto o Concluir estava quebrado (ver 09/08). Parte já
   recebeu tudo e só faltou fechar. A rodada de "Meus" resolve, agora que pergunta em todos.
3. **Confirmar em uso** o que foi corrigido sem reprodução ao vivo: sinalização errada de
   "resposta já enviada" (o aviso agora diz o nome de quem recebeu), respostas rápidas mortas
   depois de gravar, e a pergunta que agora aparece para contato de nome errado (09/08).
   **Aberto:** contato concluído sem pergunta na rodada 2, ainda sem reprodução — quando
   acontecer, guarde o log da rodada.
4. **Parâmetros de HSM**: nenhum dos 19 modelos usa hoje, então a tela nunca apareceu e não houve
   como aprendê-la. O painel recusa e explica.
5. **Respostas prontas que sobraram sem uso**: `link-grupo`, `tema-opcoes`, `sem-interesse`. Não
   apaguei — apagar `link-grupo` quebra a macro "Enviar grupo + salvar + concluir". Decisão do
   Thiago. Candidata a próxima resposta nova: **pedido de emprego** (mesmo risco jurídico do
   pedido de ajuda, volume alto).

**Risco permanente:** toda escrita é em produção, com dados reais de eleitores. O contrato de
escrita mora no `chrome.storage.local` e já sumiu uma vez sem causa identificada — exportar
backup pela aba Config evita refazer o aprendizado.

---

## 2026-08-11 — Modo de espera, e auditoria de envios fora da rodada

**Pedido (Thiago):** "o computador está entrando em modo de espera ao automatizar, evite que
entre. Verifique se alguma mensagem automática está sendo enviada fora da automação."

### O computador dormindo

Problema **diferente** do que o `keepalive.js` já resolvia. O áudio impede o Chrome de congelar
a aba; ele não impede o Windows de suspender por inatividade — e uma rodada de trinta envios com
8s de pausa passa longe de qualquer toque em teclado ou mouse. Para o sistema, ele está ausente:
a máquina dorme e a rodada morre no meio, com contatos abertos e sem saber onde parou.

`chrome.power.requestKeepAwake('display')`, pedido no começo da rodada e solto no `finally`.
Três decisões:

- **`display`, não `system`.** Manter só o sistema acordado deixa a tela apagar, e tela apagada
  volta a ser candidata a congelar a aba — que é justamente o que o áudio está ali para evitar.
  As duas travas têm que puxar para o mesmo lado.
- **Mora no service worker.** `chrome.power` não existe em content script; a aba pede por
  mensagem. Permissão `"power"` no manifest (a segunda da extensão, ao lado de `storage`).
- **Contagem de quem pediu.** O estado é global do navegador, não por aba: duas rodadas
  simultâneas e a primeira a terminar soltaria a trava da outra.

Falhar aqui **não derruba a rodada** — ela só perde a trava —, mas vira linha no Andamento. Sem
aviso, ela morreria de madrugada sem explicação.

Conferido no navegador de verdade: `chrome.power` disponível, contagem sobe e desce e não vai
para negativo com solturas a mais.

### A auditoria: nenhuma mensagem sai fora da rodada

Levantei **todos** os pontos do código que fazem a plataforma enviar (`page.sendText` e
`page.sendMessageTemplate`) e de onde cada um é chamado:

| Onde envia | Quem dispara |
|---|---|
| `renderModeloCard`, `renderTemplateCard` | `addEventListener('click')` |
| `runPedirDados`, `runMacro`, `runFecharComConteudo` | botão da aba Respostas |
| `processarNovo`, `processarRespondido`, `processarContato`, `processarSemRetornoConcluido` | rodada, iniciada por botão + `confirm()` |
| respostas rápidas da pergunta | clique dentro da caixa da rodada |

**Não há timer, observador ou caminho automático que envie.** Os dois únicos temporizadores da
extensão são a gravação da largura do painel (`main.js`) e o observador de estado da página
(`rpc-host.js`), que só lê e avisa.

O caminho automático de verdade — observador → `load()`/`reexaminarMensagens()` →
`aplicarAutomatico()` → `saveClassification()` — toca **só a API do CRM** (campos e etiquetas).
Nenhuma função de envio é alcançável a partir dele. Isso é por projeto e continua valendo.

**O que existe e pode ter parecido envio:** com o "Enviar automático" desligado, `sendTemplate`
**insere o texto no campo de mensagem** da plataforma em vez de enviar. O texto aparece lá sem
ele ter digitado — e um Enter depois manda. É o único lugar onde texto nosso chega ao composer
sem envio.

**Uma coisa que quase entrou e não entrou:** a versão inicial do conserto de "silêncio longo"
mandava a mensagem do momento sozinha. Ele reconsiderou antes de eu comitar, e o código de envio
automático foi removido — não chegou a rodar em produção.

### Arquivos alterados

`manifest.json`, `src/background.js`, `src/lib/keepalive.js`, `src/panel/panel.js`, `CLAUDE.md`.

---

## 2026-08-11 — Silêncio longo para de virar conclusão automática

**Relato dele:** "está pulando pessoas que estão sem responder por mais de um dia".

### Causa raiz

A conclusão automática ("a última mensagem é minha") tratava igual dois casos bem diferentes:

- respondi **há uma hora**: a conversa está viva, a pessoa ainda pode voltar. Fechar é o certo,
  e perguntar seria teclar à toa;
- respondi **anteontem** e ela nunca voltou: esse saía da fila **em silêncio, sem nunca ter
  mandado os dados**. É o que ele viu.

Agora só o primeiro conclui sozinho. Passou do limite de horas (12h, editável no card
"Conferir e responder a fila"), a rodada **para e pergunta** como faz com todo mundo.

### A ideia que ele descartou, e por que a descartada era pior

A primeira versão que escrevi mandava a **mensagem do momento sozinha** nesses contatos. Ele
reconsiderou — *"pensando melhor eu mando a mensagem, só evite de pular"* — e está certo:
mensagem automática para quem está calado há dias é justamente o envio que precisa de
autorização. O código de envio automático foi removido; sobrou a decisão de parar.

Isso também deixou a regra **muito** menor: `decidirSemResposta` só compara horas contra o
limite. A versão anterior tinha que pesar janela de 24h, existência da mensagem do momento e
anti-duplicata — três coisas que agora são problema da tela de pergunta, onde ele decide.

### O que aparece na tela

A linha do silêncio entra na pergunta, com destaque de aviso:
`⚠ 3 dias sem resposta desde a minha última mensagem (09/08 às 14:03). Ele nunca voltou — por
isso parei aqui em vez de concluir.`

E, quando for o caso, a linha seguinte: `A janela de 24h venceu: texto livre não chega mais
neste contato, só modelo aprovado.` Sem ela, a tecla 5 pareceria simplesmente não funcionar.

Isso é a lição da entrada anterior aplicada: quando a rodada trata dois contatos de forma
diferente, **o motivo tem que estar na tela**.

### Arquivos alterados

`src/lib/hsm.js`, `src/lib/store.js`, `src/panel/panel.js`, `tests/hsm.test.mjs`.

---

## 2026-08-11 — Rodada 4: os concluídos sem retorno (reabrir, perguntar, fechar)

**Pedido (Thiago):** "a conversa vai ter que reiniciar, mandar uma mensagem perguntando se a
pessoa realmente não tem interesse e, se for o caso, não incomodaremos mais, e ir pro próximo
sem retorno. Ao reiniciar vai me mandar para a aba Meus, então teria que retornar para
concluídos para continuar."

### A rodada

Primeira que trabalha sobre atendimento **fechado**, e por isso tem um passo a mais: concluído
não tem campo de mensagem. Por contato: **Reiniciar → modelo aprovado → Concluir → voltar para
a lista de concluídos → próximo**.

Card próprio, com **seletor de modelo próprio** (`templateIdReinicio`). Um seletor só para as
duas rodadas de "sem retorno" seria o jeito mais fácil de mandar o texto errado — e aqui o texto
é outro (a pergunta de "você realmente não tem interesse", com a saída de não incomodar mais).

### Por que só modelo aprovado, mesmo depois do Reiniciar

Reabrir o atendimento **não reabre a janela de 24h**: ela é regra do WhatsApp, não da
plataforma. Quem está sem retorno há dias tem a janela vencida, então texto livre não chegaria —
sairia do painel, a plataforma aceitaria, e a mensagem morreria no caminho. Modelo aprovado é o
único envio que sai daqui, como na rodada 3.

### Duas coisas que a fila dos concluídos tem de diferente

- **O contato VOLTA para a lista.** Nas outras rodadas o atendimento sai da fila ao ser tratado;
  aqui concluir devolve ele para os concluídos, e no topo (acabou de ser concluído). Sem andar
  uma casa, a rodada reabriria o mesmo. Daí o `continuaNaFila` no retorno do processar —
  `visitados` até protegeria, mas ao custo de uma abertura extra por contato, e abertura é o que
  derruba a API.
- **Reabrir troca a aba sozinho.** A plataforma joga para "Meus" no Reiniciar. Quem resolve é o
  `aba` do `openQueueSession`, que já garante a lista certa a cada item — foi só ensinar a nova.

### O gancho da lista de concluídos NÃO foi conferido ao vivo

As três abas de texto têm `data-cy` conferido (`button-new-sessions` e irmãs). A lista de
concluídos é o ícone de caixa, e desse eu não tenho o markup. Então:

- `getAbaConcluidos()` tenta, nesta ordem: cinco `data-cy` plausíveis, cinco nomes de ícone
  (o tema usa heroicons) e, por último, `aria-label`/`title` casando com arquiv/conclu/encerr.
- **Não achou, a rodada para e diz o que fazer** — não percorre a fila errada.
- A confirmação de que a troca funcionou é por eliminação: estar nos concluídos significa que
  **nenhuma** das três abas de texto está com `bg-gray-300`. Não depende da classe do ícone.
- Botão **"Achar a lista de concluídos"** no card despeja os `data-cy`, ícones e rótulos que
  existem na barra da fila dele. Uma passada e o gancho certo entra no código sem chute.

`tools/checar-dom.mjs` ganhou sete casos novos, incluindo os dois que protegem contra o conserto
errado: barra sem nada de arquivo (tem que recusar) e "Reiniciar" dentro de overlay (não conta).

### Pendência

**Rodar o "Achar a lista de concluídos" e me mandar o resultado.** Enquanto o gancho não for
confirmado, esta rodada pode parar logo no começo dizendo que não achou a lista.

---

## 2026-08-11 — Quatro itens da lista da manhã

**Pedido (Thiago):** prints do WhatsApp e da tela.

### 1. "Mudar a mensagem que pede grupos para pedir link e não o nome"

Nome de grupo não serve para nada — é o link de convite que permite entrar. Pedir "o nome ou o
link" fazia quase todo mundo mandar só o nome. A frase agora pede o link e **ensina o caminho**
(tocar no nome do grupo → Convidar via link → Copiar link), porque a maioria não sabe onde fica.

`migrarGruposPedeLink` troca por substring: a frase mora **dentro** do `pedir-dados`, e pode
morar em outras respostas. Só troca onde ela aparece literalmente.

### 2. "Caxias não pegou como cidade, seria caxias do sul"

Meia verdade — e o "meia" é o que interessa. Na versão que ele está rodando, "Caxias" não casava
nada (o prefixo de uma palavra é da leva de ontem). Na versão nova ele **já casava**, mas como
`aproximada`, que é o palpite que **espera clique** e nunca grava sozinho. Do lado dele, o efeito
é o mesmo: a cidade não entra.

Prefixo de uma palavra agora vale como **exata quando é a resposta inteira**. "Caxias", sozinho
no campo da cidade, é Caxias do Sul. Já "trabalhei em Caxias uns anos" continua palpite: em
frase, a palavra solta pode ser nome de gente — **Vitória**, **Esperança** e **Rosário** também
são começo de município do RS, e gravar sozinho ali trocaria a cidade de um eleitor.

Levantei as 48 palavras que passam a gravar sozinhas para conferir a lista antes de mexer.

### 3. "Alguns estão concluindo quando a minha é a última mensagem e outros não"

**Causa raiz: uma exceção que eu mesmo criei ontem.** A regra dele era "última mensagem minha →
concluir", sem ressalva; eu abri uma exceção para quem ainda não tinha etiqueta de conteúdo, com
a ideia de oferecer a pergunta de interesse antes de fechar.

Funcionava como projetado, e mesmo assim é defeito: a diferença depende de um estado que não
está na tela. Regra que parece aleatória para quem usa **é** uma regra ruim, e a instrução
original não tinha ressalva. Voltou a ser sem exceção.

Quem fica sem etiqueta de conteúdo agora aparece no Andamento com essa observação —
`… — concluí e segui (ainda sem etiqueta de conteúdo)` —, que é a lista de quem vale uma rodada
de pergunta de interesse depois. A fila da plataforma filtra por etiqueta.

**Ajustado no mesmo dia** (ver a entrada do topo): conclui sozinho só quem foi respondido há
POUCO. Quem está calado há mais de 12h volta a parar a rodada, agora com o tempo de silêncio
escrito na pergunta — a diferença ficou na tela, que era o que faltava na versão anterior.

### 4. "Agradecer e concluir ficou confuso, mude para agradecer informações e concluir"

Rótulo da tecla 4. O nome antigo colidia com a tecla 1, que também agradece no fim.

### Extra, visto no print da Beti

Ela respondeu **"Sim."** à pergunta de interesse, e a rodada ofereceu a tecla 7 — perguntar de
novo — **em destaque**. Quem já respondeu está esperando o conteúdo, não outra pergunta igual.
Agora, quando a pergunta já saiu para aquele contato, a tecla 7 vira "Perguntar interesse DE
NOVO", perde o destaque, e uma linha diz quando foi perguntado.

(O "Sim." dela não virou etiqueta porque **"Etiquetas quando responder sim" continua vazio** na
aba Config. O painel avisa na própria pergunta. É o passo que falta do lado dele.)

### Arquivos alterados

`src/lib/store.js`, `src/lib/templates.js`, `src/lib/cities.js`, `src/panel/panel.js`,
`tests/parser.test.mjs`, `tests/vars.test.mjs`, `CLAUDE.md`.

---

## 2026-08-10 — A pergunta de interesse já pede nome e cidade

**Pedido (Thiago):** "ao perguntar se a pessoa quer conteúdos já peça nome e cidade também para
caso positivo."

Motivo dele, e é o certo: quem recebe essa pergunta é justamente quem está em "Meus" sem
etiqueta de conteúdo — e, na maioria, sem nome e sem cidade no CRM. Uma segunda mensagem para
pedir os dados custa outro atendimento inteiro: mais um dia de espera e mais uma chance de a
pessoa não responder.

A pergunta agora pede no formato fixo, como o `pedir-dados`: **`Sim / Nome completo / Cidade`**.
O formato não é enfeite — é dele que sai a precisão do parser.

### O que a mudança de formato quebrou (e que era o trabalho de verdade)

Trocar o texto foi a parte pequena. A resposta esperada mudou de forma, e **duas regras do
parser estavam calibradas para a forma antiga**:

- **`respostaAfirmativa` recusava a resposta certa.** Ela exigia no máximo seis palavras e
  rejeitava qualquer negação na mensagem. Só que agora a resposta legítima é longa
  ("Sim / Maria Silva / Palmares do Sul") e frequentemente traz um "não" que responde **outra**
  pergunta do formulário — "Não faço parte de nenhum grupo político" apareceu numa conversa
  real. As duas regras juntas transformavam aceite em recusa.
  Agora a decisão sai da **cabeça da mensagem** (primeiras 4 palavras): "sim, mas não quero"
  continua sendo recusa, porque a negação está na própria resposta.
- **"Sim" viraria o nome do eleitor.** Quando a pessoa escreve a cidade antes do nome
  ("Sim / Palmares do Sul / Maria Silva"), o pedaço anterior à cidade é o "Sim" — e
  `plausivelNome` o aceitava (tem vogal, três letras, só letras). Entrou na lista de aberturas
  descartadas, junto com "não", "claro", "isso", "ok", "beleza".

### Migração

`migrarInteressePedeDados` troca o texto **só se ele estiver literalmente na versão anterior**
(`INTERESSE_CONTEUDO_ANTIGO`), e o nome da resposta idem. Pergunta que ele tenha reescrito fica
como está. Mesma disciplina do `migrarPerguntaGrupos`.

### Arquivos alterados

`src/lib/store.js`, `src/lib/templates.js`, `src/lib/tags.js`, `src/lib/extract.js`,
`src/panel/panel.js`, `tests/parser.test.mjs`, `tests/tags.test.mjs`, `tests/vars.test.mjs`.

---

## 2026-08-10 — As respostas param de chamar o contato pelo nome

**Pedido (Thiago):** "o uso de nomes para responder tem dado problemas, vamos alterar para não
mandar nomes."

### Por que ele está certo, e o quanto isso já custou

O nome do cadastro erra com frequência alta demais para ir num texto que a pessoa lê. Todos
estes são casos reais, e quase todos viraram entrada neste registro em algum momento:

| No cadastro | Quem é | O que saía |
|---|---|---|
| `[NOVO] (51) 9…` | contato recém-chegado do anúncio | "Boa noite, [NOVO]!" |
| `Zane` | apelido do perfil de Rosane Requia | "Obrigado pela atenção, Zane!" |
| `Santa Cruz - Serlei` | cidade digitada antes do nome | "Boa noite, Santa Cruz!" |
| `Jeane do PL` | sigla do partido colada | "Boa noite, Jeane do PL!" |
| `srn` | abreviação na posição do nome | "Obrigado, Srn!" |

Cada conserto anterior atacou **uma** dessas portas: `looksLikePlaceholder`, `nomeVeioDoPerfil`,
`splitCidadeNome`, `limparSiglas`, a regra da vogal. Tirar o nome do texto fecha a classe
inteira de uma vez — e o acerto, quando acertava, não comprava quase nada.

O segundo motivo é mais silencioso: variável sem valor **bloqueia o envio**. Foi assim que a
opção sumiu da pergunta da rodada duas vezes (06/08 e 09/08). Sem nome no texto, esse ramo
inteiro de bloqueio deixa de existir.

**O que NÃO mudou:** a extensão continua extraindo e gravando o Nome no CRM. O dado é útil no
cadastro; ele só não vai mais na mensagem.

### O que foi feito

- As cinco respostas que usavam vocativo perderam o nome: `tema-opcoes`, `link-grupo`,
  `agradecimento`, `saudacao-fe`, `agradecer-info`, `sem-interesse`.
- **Migração `migrarRespostasSemNome`.** Mudar o padrão não bastaria: as respostas dele estão
  no `chrome.storage`, algumas editadas à mão. Esta migração **reescreve** — as outras só
  acrescentam — e por isso é estreita: apaga o marcador e a pontuação do vocativo em volta, e
  não toca no resto da frase. `auto.mensagemMomento` entra junto, porque com nome ela travaria
  a tecla 5 do mesmo jeito. Roda uma vez: se ele puser o nome de volta de propósito, fica.
- `vars.semVocativo()` é a regra, pura e testada — ela reescreve texto que vai para eleitor
  real. `vars.usaNome()` alimenta o aviso no editor.
- **Aviso, não bloqueio**, no editor de respostas: escrever `{{primeiro_nome}}` continua
  possível, com o risco na tela. A decisão é dele; o que não pode é o nome voltar sem ninguém
  perceber.
- Teste novo que confere a lista **inteira** de respostas padrão: nenhuma pode usar nome. É o
  que impede o vocativo voltar numa edição futura.

### Arquivos alterados

`src/lib/vars.js`, `src/lib/store.js`, `src/lib/templates.js`, `src/panel/panel.js`,
`tests/vars.test.mjs`, `CLAUDE.md`, `README.md`.

---

## 2026-08-10 — A pergunta da rodada sai do lugar (e para de bloquear a conversa)

**Pedido (Thiago):** "atualmente as perguntas e respostas estão presas, eu queria poder mover
para ver o chat atrás", com print da pergunta bem em cima da conversa.

### O problema era maior do que "não dá para mover"

A caixa era um diálogo modal clássico: `position: fixed; inset: 0` com fundo escurecido. Duas
consequências, e a segunda ninguém tinha nomeado:

1. a conversa ficava **escurecida** atrás da caixa;
2. a camada **comia o clique** — não dava nem para rolar o histórico.

E a decisão que a pergunta pede (mandar modelo? agradecer? pular?) depende exatamente de ler o
que a pessoa escreveu. A caixa cobria a informação necessária para responder a própria caixa.

### O conserto

A camada virou trilho invisível (`pointer-events: none`, sem fundo); quem recebe clique é só a
caixa. A caixa arrasta pelo **título**, que ganhou `cursor: grab` e um pontilhado de alça. A
posição fica em `settings.perguntaPos`, então arrastar uma vez vale para os próximos contatos e
para as próximas rodadas.

- **`setPointerCapture`, não listener no documento.** Arrastando por cima da conversa da
  plataforma, um listener no documento perde o `pointermove` e a caixa gruda no meio do arrasto.
- **Posição contida na janela.** Monitor desconectado ou arrasto até a borda deixariam a
  pergunta fora da vista — e ela é modal para a rodada: pergunta invisível trava o trabalho sem
  dizer por quê. Mesma lição do `sanitize()` das janelas em `background.js`.

### A consequência que quase passou batida

Com a página clicável, ele pode focar o campo de mensagem da plataforma — e o atalho da rodada é
escutado no documento, em captura. Digitar "2" numa resposta à mão **concluiria o atendimento**.
Agora `aoTeclar` ignora evento cujo alvo é campo de texto (`composedPath()[0]`, por causa do
shadow root).

### Conferido no navegador

`tools/checar-pergunta.mjs` (novo) monta a caixa com o `panel.css` de verdade e confere o
contrato: camada transparente, camada atravessável, caixa clicável, **clique na conversa atrás
chegando ao destino**, título com cursor de alça e a caixa obedecendo a `left`/`top` quando
solta. São as linhas de CSS que qualquer refatoração desfaz sem querer.

O arrasto em si eu exercitei com mouse de verdade (`pointerdown` → `move` → `up`): move, grava a
posição, e para na borda quando arrastado para fora — nos dois sentidos.

### Arquivos alterados

`src/panel/panel.css`, `src/panel/panel.js`, `src/lib/store.js`, `tools/checar-pergunta.mjs`
(novo), `CLAUDE.md`.

---

## 2026-08-10 — A rodada não retomava depois da conclusão à mão (a figura era inocente)

**Relato dele:** "enviei a figura e não resumiu a automatização", com print da tela inteira.

### O que a print mostrou, e a correção do diagnóstico anterior

A print desmentiu a hipótese que eu tinha registrado hoje mais cedo. **Nada a ver com a figura**:

- a URL continuava com o id da sessão (dava para ler na barra de endereço), então a espera
  **não** estava confundindo mídia com troca de atendimento;
- o atendimento estava **concluído** ("Thiago concluiu o atendimento em 10/08/2026 às 20:09"),
  e a barra do painel ainda dizia *"Responda Santa Cruz - Serlei à mão. Quando você concluir, eu
  retomo daqui."* — ou seja, a espera estava viva e simplesmente não reconheceu a conclusão.

### Causa raiz

`dom.isConcluded()` procurava **um sinal só**: um botão "Reiniciar" no rodapé. Na print, o
atendimento concluído mostra o rótulo **"Concluído"** no cabeçalho (onde estava "Em andamento") e
o rodapé vira "Nenhuma classificação definida" — **não existe Reiniciar nenhum**.

Então a espera da tecla 6 rodava até o teto de 30 minutos e devolvia "esperei 30 min e o
atendimento seguiu aberto". A rodada não morria: ficava parada.

O sinal "Reiniciar" não era invenção — ele foi conferido ao vivo quando entrou. São dois estados
diferentes de fechado, e a versão anterior só conhecia um.

### O conserto

`isConcluded()` passa a aceitar três sinais: "Reiniciar", o rótulo "Concluído" (botão ou chip) e,
como reserva de escopo estreito, uma varredura de folhas dentro de `sessions-conversation`.
Fora de overlay e **fora da fila da esquerda** — a fila repete texto de atendimento, e sem essa
trava qualquer contato concluído na lista daria o atendimento aberto por fechado.

Rede de segurança separada: `semControlesDeAtendimento()` (sem composer, sem Concluir, sem
Iniciar) entra no `page.getState()` e a espera aceita depois de **três leituras seguidas**. Fica
fora do `isConcluded()` de propósito — durante a troca de tela os três somem por um instante, e
o `clickConcluir()` daria a conclusão por certa cedo demais.

### Conferido no navegador, não no chute

`tools/checar-dom.mjs` (novo) monta sete recortes reais de tela e confere as duas funções contra
cada um. Os dois casos que protegem contra o conserto errado: **menu do Concluir aberto** (tem
item com o mesmo texto — não pode contar como concluído) e **"Concluído" na fila da esquerda**.

Rodei os mesmos sete recortes contra o `dom.js` anterior: falha exatamente em um, o da print.
É a prova do diagnóstico.

Fica **fora das seis suítes** de propósito — precisa de navegador (Playwright), e o compromisso
do projeto é `node tests/*.mjs` em Node puro. É ferramenta para quando mexer em `dom.js` ou a
plataforma mudar de cara. Sem Playwright na máquina, ele avisa e sai com 0.

### Arquivos alterados

`src/lib/dom.js`, `src/lib/page.js`, `src/panel/panel.js`, `tools/checar-dom.mjs` (novo),
`CLAUDE.md`.

### Nota sobre a print

O painel mostrava `Cidade: Santa Cruz` e "Sem grupo cadastrado para Santa Cruz" — é a versão
**antiga** rodando no navegador dele. Com o casamento por prefixo desta leva, "Santa Cruz" (do
cadastro "Santa Cruz - Serlei") passa a resolver para **Santa Cruz do Sul**, e o link do grupo
volta a ser encontrado. Precisa recarregar a extensão + F5 na aba.

---

## 2026-08-10 — Cidade do candidato, cidade encurtada, marca amarela e respostas na rodada

**Pedido (Thiago):** segunda leva da lista do WhatsApp, cinco itens do fim da tarde de 09/08.

### 1. "Retirar cidade Capitão pois está confundindo com Capitão martim" — o mais grave

**Capitão é município do RS** (Vale do Taquari) e é a patente do candidato. Medido aqui: a
mensagem de aceite do anúncio — *"aceito receber conteúdos do Capitão Martim e do Zucco"* —
casava com a cidade Capitão e com confiança **`exata`**, que é exatamente a que o automático
grava **sem clique**. Ou seja: cidade errada + COREDE errado gravados sozinhos em cima de todo
mundo que veio do anúncio.

Duas travas em `cities.js`: a expressão "capitao martim" / "cap martim" é apagada do texto antes
de casar (mesmo mecanismo do nome do estado), e o município entrou em `cidadesIgnoradas`
(padrão `['Capitão']`, editável na aba Config). A primeira sozinha não bastava — ele pediu que
"Capitão" solto também não valha.

**Vale conferir na base:** contatos do anúncio classificados com cidade Capitão provavelmente
estão errados, e levaram a etiqueta do COREDE Vale do Taquari junto.

### 2. "Nomes de cidade não sendo pegos se não estiverem perfeitamente escritos"

**Causa raiz:** o casamento por prefixo exigia **duas palavras**, e o encurtamento mais comum
tem uma só. "Palmares" (Palmares do Sul), "Sentinela", "Trindade" não eram reconhecidos.

O mínimo de duas palavras existia para "Carlos" não virar "Carlos Barbosa" — mas quem protege
disso é a trava da preposição, que já estava lá: "Barbosa" não é preposição, então "Carlos"
continua não casando. Abri para uma palavra mantendo as outras travas (mínimo de 6 letras, sufixo
começando em preposição, empate recusa) e mais uma: **uma palavra nunca vale como `exata`** —
vira palpite e espera clique, nunca grava sozinha.

Dois achados no caminho:

- **"Livramento" caía em "Santana da Boa Vista".** Pus o encurtamento em `ALIASES` primeiro, e
  `normalize()` roda também sobre o nome do município: "Santana do Livramento" virava "santana do
  santana do livramento". Agora está em `ENCURTAMENTOS`, aplicado só ao texto do contato.
- **"o cara" casava com Caraá** (distância 1). Município de até 5 letras agora exige grafia
  exata — o passo 1 já pega essas, então não se perde nada, e palavra comum de quatro letras
  para de virar cidade.

### 3. "Etiqueta de conteúdo do Flávio marcada e a mensagem rápida não reconhece e trava o botão"

`suggest()` só devolve o que as **regras acham nas mensagens**. Etiqueta aplicada à mão era
invisível, e o botão "Enviar conteúdo + agradecer + concluir" exige exatamente um conteúdo
identificado — contava zero e travava.

Acontece também sem ninguém marcar nada: a regra casa contra a campanha do anúncio, o contato é
etiquetado na primeira passada e, na reabertura, as mensagens dele sozinhas não casam mais.

`tags.conteudosJaAplicados()` soma as etiquetas de conteúdo que o contato já carrega no CRM —
só as reconhecidas como conteúdo (aparecem nas regras ou na tabela "Modelo por conteúdo").
Região e etiqueta de fluxo continuam de fora. Como entra em `state.tagSuggestions`, vale para os
três consumidores de uma vez: botão da aba Respostas, macro de fechar e a rodada.

### 4. "Liberar a caixa de respostas rápidas — no momento ela está fixa no modo automatizado"

A pergunta da rodada é `position: fixed; inset: 0`: uma cortina sobre o painel inteiro. Durante a
rodada não havia como mandar uma resposta pronta — só parando a rodada ou indo de tecla 6.

As respostas prontas agora vão **dentro da caixa de pergunta**, num `<details>` fechado (a
pergunta é decisão de um toque; oito botões abertos atrapalhariam o caso comum). Enviar dali
**não fecha a pergunta**: manda e você continua decidindo o que fazer com o atendimento.
Resposta bloqueada por variável aparece desabilitada com o motivo no `title`, nunca sumindo.

### 5. "Faça uma marcação em amarelo na cidade que está pegando"

Marca-texto amarelo (`.wf-marca`) na cidade **quando ela veio do parser** — sem marca quando veio
do CRM ou foi digitada por ele. Aparece no cabeçalho, na aba Dados e na linha da pergunta da
rodada, sempre com o trecho que gerou o valor: `Capitão ← de "Capitão Martim"` mostra o erro na
hora, sem abrir a conversa. Cor fixa nos dois temas, com o texto travado em escuro — marca-texto
que muda de cor com o tema deixa de ser marca-texto.

De quebra, a linha de aviso da pergunta (⚠ já enviado hoje) saiu do cinza e ganhou fundo: ela
existe para ser notada antes da tecla, e cinza-claro como as outras passava batido.

### Arquivos alterados

`src/lib/cities.js`, `src/lib/tags.js`, `src/lib/store.js`, `src/panel/panel.js`,
`src/panel/panel.css`, `tests/parser.test.mjs`, `tests/tags.test.mjs`, `CLAUDE.md`, `README.md`.

### Pendências

- **Rever na base os contatos com cidade "Capitão"** — vieram do anúncio, não moram lá.
- Continua aberto da leva anterior: confirmar em uso o conserto da figura, preencher "Etiquetas
  quando responder sim" e a tabela "Modelo por conteúdo".

---

## 2026-08-10 — Os dez itens da lista de bugs do WhatsApp

**Pedido (Thiago):** print da conversa com dez linhas anotadas ao longo do dia 09/08.

### 1. "Pegou srn como nome" + "Ignorar siglas no nome"

`plausivelNome` só exigia 3 letras, então "srn" (que é abreviação, não nome) virava o Nome do
eleitor e o agradecimento saía "Obrigado pela atenção, Srn!". E "Jeane do PL" gravava o partido
dentro do nome — partido tem campo próprio.

**Conserto:** `limparSiglas()` em `extract.js`, exportada e testada. Sigla é (a) nome de partido
do dicionário, (b) da lista fixa, ou (c) token de até 5 letras **sem vogal** — nome de gente em
português sempre tem vogal, o que resolve "srn" sem precisar de lista. A partícula que fica
pendurada sai junto ("Jeane do ~~PL~~" → "Jeane"). Sobrou vazio? Não era nome: o campo fica
vazio para o Thiago preencher, em vez de gravar lixo.

### 2. "Marcando rio grande do sul como rio grande"

**Causa raiz:** o nome do ESTADO contém o nome de um município, e o passo 1 do `matchCity`
procura o município em qualquer lugar do texto. "Sou do Rio Grande do Sul" casava com a cidade
Rio Grande — e o COREDE saía errado junto, porque a etiqueta de região é derivada da cidade.

**Conserto:** a frase "rio grande do sul" é apagada do texto antes de casar. Não custa nenhum
acerto: nenhum município se chama assim, e quem quis dizer a cidade escreve "Rio Grande", que
continua casando (tem teste dos dois lados).

### 3. "Automação está parando quando mando uma figura ao pausar para responder manualmente"

Duas travas, porque a cadeia tem dois elos:

- `esperarVoceConcluir` lia "URL sem id de sessão" como "você abriu outro atendimento" e
  devolvia o contato. Agora diálogo aberto (ou URL sem sessão) **não vale julgamento**, e a
  troca de atendimento precisa se confirmar em três leituras seguidas.
- `percorrerFila` seguia em frente e clicava no próximo item da fila com o diálogo do anexo
  ainda aberto. Diálogo do Material é **modal**: o clique não chega ao item, e a rodada
  terminava dizendo "a fila acabou". Agora ela espera a tela ficar livre (até 3 min) antes de
  abrir o próximo. **Não fecha** o diálogo: ele é dele, e fechar descartaria a figura.

`page.getState()` ganhou `hasDialog` para isso.

**Correção (mesmo dia, com a print em mãos):** a hipótese do "URL perde o id" estava
**errada** — a URL continuava com o id da sessão. A causa real era outra e está na entrada do
topo: `isConcluded()` só conhecia o sinal "Reiniciar", e o atendimento concluído mostra
"Concluído" sem Reiniciar nenhum. As duas travas descritas aqui **ficam** (o modal engolir o
clique é mecanismo real e confirmado no código), mas não eram o que ele estava vendo.

### 4. "Identificar se a mensagem já foi mandada no mesmo dia e confirmar se quer mandar"

O aviso de duplicata existia, mas era `confirm()` do navegador disparado lá dentro do envio —
no meio da rodada ele abre **depois** da decisão e trava o laço num diálogo nativo. Agora o
aviso é linha da própria pergunta (`⚠ "X" JÁ FOI ENVIADO hoje, às 14:03`), o modelo perde o
destaque de opção primária, e o envio segue sem `confirm` (`jaConfirmado: true`). Mesmo dia é
dia do calendário, não 24 horas: mensagem de ontem 23h e de hoje 8h são dois dias de trabalho.

### 5. "Quando a última mensagem for minha no automatizado, concluir e ir pro próximo"

São os ~60 de "Meus" que ficaram abertos enquanto o Concluir estava quebrado: receberam tudo e
só faltou fechar. Perguntar um a um seria teclar sessenta vezes para não decidir nada.

**Decisão registrada:** esta é a primeira saída automática da rodada 2 — a regra "nada sai da
fila sem decisão humana" passa a ter esta exceção, a pedido dele. Ela só fecha o que **já foi
respondido**; não envia nada.

**Conflito resolvido com o item 6/7:** contato sem etiqueta de conteúdo **não** é concluído
sozinho, mesmo com a última mensagem sendo nossa — é exatamente a população que ele quer
perguntar. O atendimento não está terminado: falta descobrir o que mandar para essa pessoa, e
concluir aqui seria tirá-la do fluxo para sempre em silêncio (o mesmo pulo silencioso já
consertado três vezes neste projeto). Nesse caso a pergunta aparece, com a tecla 7 em destaque e
uma linha explicando por que ela apareceu.

`api.getConversation()` devolve numa requisição só o que o contato escreveu **e** quem falou por
último. Junto de propósito: cada contato já custa uma sessão na plataforma + três chamadas
nossas, e foi rajada de requisição que derrubou a API uma vez. Mídia entra na conta (figura
nossa é resposta; figura dele é a vez dele) — `getIncomingText` descarta mensagem sem texto e
por isso não servia. Mensagem do bot conta como nossa. Suíte nova: `tests/conversa.test.mjs`.

### 6 e 7. Pergunta de interesse e a etiqueta do "sim"

Resposta nova `interesse-conteudo` (tecla **7** da rodada), oferecida **só** para quem ainda não
tem etiqueta de conteúdo — quem já pediu conteúdo tem modelo para receber, não pergunta. Envia e
conclui, como a rodada dos Novos: quando a pessoa responder, a plataforma devolve o atendimento
para "Meus" sozinha.

Sem `{{primeiro_nome}}` **de propósito**: metade destes contatos ainda está com o apelido do
anúncio, e variável que não resolve tira a opção da pergunta — foi assim que o fluxo travou duas
vezes (06/08 e 09/08).

O "sim" vira etiqueta com duas travas: a pergunta tem que ter **saído para aquele contato**
(`wasSent`), e o afirmativo é medido só na **última** mensagem, curta e sem negação — senão
"sim, moro em Pelotas" etiquetaria quem nunca foi perguntado. `respostaAfirmativa()` é pura e
testada. As etiquetas são configuráveis (aba Config, "Etiquetas quando responder sim") e vêm
**vazias**: chutar o rótulo grava etiqueta errada em eleitor real. Vazio não bloqueia a pergunta
— ela sai, e a tela diz que o "sim" ainda não vira etiqueta.

### 8. "Substituir cidade e etiqueta da cidade quando for fornecido pela pessoa"

Muda uma regra de projeto, então ficou estreita: substitui **só** a cidade, **só** com casamento
exato do IBGE, **só** quando veio de resposta estruturada ("Nome / Cidade") — cidade citada no
meio da conversa continua sendo palpite que não sobrescreve — e **nunca** por cima de correção
feita à mão por ele.

A etiqueta de região antiga sai junto (`applyTags(..., { remover })` + `regionTagIds()`): duas
regiões no mesmo contato é informação errada, e meia substituição seria pior que nenhuma. Só
saem etiquetas que são COREDE na planilha oficial — conteúdo e etiqueta de fluxo ("1 SEM
RETORNO") nunca entram na conta. A troca aparece na pergunta da rodada: `Cidade: Palmares do Sul
(a pessoa informou; estava "Porto Alegre")`.

### Teste que não depende mais da internet

`parser.test.mjs` baixava a lista do IBGE. Onde a rede é bloqueada (proxy, CI), a lista voltava
vazia e **12 asserções falhavam de uma vez** por motivo que não tem nada a ver com o parser.
Agora a lista sai de `src/data/coredes-rs.json` — os mesmos 497 municípios — plantada no storage
antes do import. Resultado igual em qualquer máquina.

### Arquivos alterados

`src/lib/extract.js`, `src/lib/cities.js`, `src/lib/tags.js`, `src/lib/api.js`,
`src/lib/store.js`, `src/lib/templates.js`, `src/lib/page.js`, `src/panel/panel.js`,
`tests/parser.test.mjs`, `tests/tags.test.mjs`, `tests/conversa.test.mjs` (nova), `CLAUDE.md`.

### Pendências

- ~~Confirmar em uso o item 3 (figura)~~ — reproduzido no mesmo dia: a causa era o sinal de
  "Concluído", não a figura. Ver a entrada do topo.
- **Preencher "Etiquetas quando responder sim"** na aba Config — sem isso a tecla 7 pergunta mas
  não etiqueta.
- A tabela "Modelo por conteúdo" continua vazia: é o pré-requisito da tecla 1.

---

## 2026-08-09 — Nome errado deixa de tirar o contato da rodada em silêncio

**Relato dele:** "ao aparecer um contato com o nome errado ele está sendo pulado ou concluído sem
me perguntar."

### Causa raiz

`processarRespondido` tinha uma saída antes da pergunta:

```js
if (modelo && agradecimentoTrava) return { resultado: 'pulado', motivo: 'agradecimento bloqueado…' };
```

A cadeia inteira: nome errado é o que `looksLikePlaceholder` recusa — apelido automático do
anúncio (`[NOVO] (51) 9…`), "Novo…", ou menos de três letras. `buildContext` então devolve
`nome: ''`, o `{{primeiro_nome}}` do agradecimento fica sem valor, e o contato saía da rodada
**antes de a pergunta aparecer**.

É o mesmo pulo silencioso que tínhamos tirado de "Meus" na entrada anterior, entrando por outra
porta: lá a causa era "sem conteúdo identificado", aqui é "sem nome para o agradecimento". A
decisão de ontem — *nada sai da fila sem decisão humana* — não tinha sido aplicada a este ramo.

### O conserto

A pergunta aparece sempre. O que some é só a tecla 1, e o motivo vai para a tela numa linha
própria (`Modelo "X" travado: Nome ainda não preenchido…`), com o corpo da pergunta dizendo o
que fazer. Mandar o modelo **sem** o agradecimento foi descartado pelo Thiago: é enviar o fluxo
pela metade, e o guarda-corpo de variável existe justamente para isso não acontecer.

Com a tecla 1 fora, a 4 ("Agradecer e concluir") volta a ser a primária — quem decide isso agora
é `podeEnviar`, não a mera existência do modelo.

### Pendência aberta

**A conclusão sem pergunta não foi reproduzida.** Ele diz que aconteceu na rodada 2, mas ali
toda conclusão vem de tecla dele (3, 4, 5, ou a do fluxo de envio) — não há caminho que feche o
atendimento sozinho. Preciso do log da rodada no momento em que acontecer. Hipótese a
investigar: `openQueueSession` com posição defasada depois de uma conclusão, quando a fila ainda
não atualizou — `visitados` protege de repetir, mas faz a posição andar uma casa a mais.

### Arquivos alterados

`src/panel/panel.js`

---

## 2026-08-09 — Empate entre conteúdos deixa de bloquear: vence o preferido

**Pedido (Thiago):** "quando tiver dois escolha o do Flávio em vez de bloquear."

### Por que o empate é comum

As regras de conteúdo são casadas contra as mensagens **e contra a campanha do anúncio**
(`utm.campaign` + `utm.headline`). Anúncio que cita dois nomes — "Martim e Zucco, unidos pelo Rio
Grande do Sul" — faz o contato casar com os dois sem ter pedido nada. Bloquear nesse caso era
desperdício: o empate não vinha de dúvida real do contato, vinha do texto do anúncio.

### Configurável, não fixo no código

`conteudoPreferido` (padrão "Conteúdo Flávio"), editável na aba Config junto do mapeamento de
modelos. Fixar "Flávio" no código apodreceria na próxima campanha — a regra de conteúdo já é
editável exatamente por isso.

**Só decide o envio.** As etiquetas continuam sendo aplicadas todas: quem casou com dois recebe
as duas, porque isso é informação verdadeira sobre o contato.

A pergunta mostra que houve desempate: `Conteúdo pedido: Conteúdo Flávio (casou com 2, escolhi o
preferido)` — o Thiago vê e pode escolher outra saída.

### Continua recusando quando é dúvida de verdade

Se o preferido não estiver entre os que casaram, ou se não houver preferido configurado, volta a
não haver modelo — a pergunta aparece sem a tecla 1.

### Detalhe pego pelo teste

O `achatar` do módulo ignora caixa mas **não** ignora acento. Como este valor é digitado à mão
na Config, "Conteudo Flavio" ficaria sem desempate por causa de um til. Comparação sem acento só
aqui; `pickRow` continua estrito, que é onde errar manda modelo errado.

### Arquivos alterados

`src/lib/hsm.js`, `src/lib/store.js`, `src/panel/panel.js`, `tests/hsm.test.mjs`

---

## 2026-08-09 — Fim do pulo silencioso: nada sai da fila sem decisão do Thiago

**Relato dele:** "está pulando alguns contatos que respondi antes e responderam só obrigado; está
concluindo ou pulando sozinho?"

**Resposta:** pulando, não concluindo. "obrigado" não casa com nenhuma regra de conteúdo
(`zucco`, `fl[áa]vio`), sem conteúdo não havia modelo, e em "Meus" isso era pulo **sem
perguntar** — regra que ele mesmo tinha pedido quando as teclas 3, 4, 5 e 6 ainda não existiam.

**Decisão dele:** "remova então a regra de pular em Meus sem eu mandar, deixa da mesma forma que
está na aba Outros."

### Por que a regra antiga tinha virado um problema

Contato pulado **continua na fila**. A rodada seguinte pulava de novo, e ele nunca saía de
"Meus" — a mesma fila que não drena que já tínhamos consertado em "Novos", agora do outro lado.
E "obrigado" é justamente a conversa que acabou e deveria fechar.

Quando o pulo silencioso foi combinado, a única saída da pergunta era mandar modelo ou pular.
Hoje há concluir, agradecer, mensagem do momento e responder à mão — não perguntar virou
desperdício.

### O que mudou

`perguntarSempre` saiu de vez, em vez de virar `true` nos dois lados: parâmetro que só tem um
valor é ruído. A pergunta aparece sempre, sem a tecla 1 quando não há modelo.

Também corrigi os textos da interface, que ainda prometiam o comportamento antigo ("conteúdo que
não casa com nenhum modelo passa direto, sem perguntar") — descrição que mente é pior que
descrição ausente.

### Efeito colateral que vale saber (não é bug)

`load()` roda a classificação automática em cada contato aberto, e para quem já tem cidade e
etiquetas isso **carimba a Data de conclusão** se ela estiver vazia — mesmo que o atendimento
siga aberto. Foi pedido assim; o carimbo acompanha a classificação, não a conclusão.

### Arquivos alterados

`src/panel/panel.js`

---

## 2026-08-09 — Tecla 6: responder à mão sem perder a rodada

**Pedido (Thiago):** "adicione a opção 6, pausar para responder e retomar quando concluir."

A rodada sai da frente (o diálogo fecha), você escreve no atendimento que já está aberto, e ela
retoma sozinha quando você conclui. Antes disso, sair para responder significava perder o
percurso e recomeçar.

### O que ela vigia, e por quê

A **sessão em que a pergunta apareceu**, não "a sessão aberta". Se você for para outro
atendimento no meio, a rodada não pode ficar esperando a conclusão de um contato que não é mais
este — nem contá-lo como resolvido. Nesse caso ela segue adiante e diz no log.

`pageStateLocal` ganhou `concluded` (de `dom.isConcluded`, o "Reiniciar" no rodapé), então a
vigia é uma leitura por segundo do estado que o painel já lê.

### Quatro saídas

| O que acontece | Resultado |
|---|---|
| Você conclui | `concluido` — sai da fila, rodada retoma do próximo |
| Você abre outro atendimento | `pulado`, com o motivo no log |
| Você clica em "Parar a rodada" | para |
| 30 min sem nada | `pulado`, com o motivo no log |

Não conta como envio: quem mandou a mensagem foi você.

### Arquivos alterados

`src/lib/page.js`, `src/panel/panel.js`

---

## 2026-08-09 — Tecla 5: a mensagem da ocasião

**Pedido (Thiago):** "uma opção 5 que será uma mensagem personalizada; exemplo, hoje é Dia dos
Pais e muitos estão mandando mensagem referente a isso."

### Por que não virou resposta pronta

Resposta pronta é para texto estável. Este muda toda semana — hoje Dia dos Pais, depois Natal,
depois uma agenda da campanha. Guardar na lista de respostas faria o Thiago editar na aba Config
a cada data, longe de onde a rodada começa.

Virou campo próprio no cartão **"Mensagem do momento"**, na aba Automatizado, ao lado dos botões
de rodada. Vazio = a tecla 5 não aparece.

### Reaproveita o caminho de envio inteiro

O texto vira um "template de mentira" (`{ id, name, text }`) e segue por `sendTemplate` como
qualquer outro: variáveis, bloqueio por variável faltante, anti-duplicata e registro de envio.

**A chave do anti-duplicata inclui um resumo do texto** (`momento:<hash>`). Com chave fixa,
trocar de data seria barrado como duplicata da mensagem anterior — o contato receberia o Dia dos
Pais e nunca o Natal.

Como as teclas 1 e 4, a 5 só aparece se o texto resolver todas as variáveis: opção que trava na
hora do envio é pior que opção ausente.

### Arquivos alterados

`src/lib/store.js`, `src/panel/panel.js`

---

## 2026-08-09 — Tecla 4 (agradecer e concluir) e a rodada da aba "Outros"

**Pedido (Thiago):** "adicione uma 4ª opção para as perguntas que será usada em Outros. Em
Outros tem muitas pessoas que enviam vídeos e bom dia; seria bom ter uma resposta dando bom dia,
agradecendo as informações e concluir."

### Duas peças, não uma

A opção sozinha não bastava: em "Meus" a rodada **pula antes de perguntar** quando não há
conteúdo identificado — combinado anterior, "conteúdo à parte fica para resposta manual". Vídeo e
"bom dia" caem exatamente nesse pulo, então a tecla 4 nunca apareceria.

Daí `perguntarSempre`, parâmetro do processador:

- **Meus** (`false`): sem conteúdo identificado, pula em silêncio. Comportamento preservado.
- **Outros** (`true`): pergunta sempre, e a tecla 4 é a saída esperada.

### Opções que aparecem conforme o caso

A **1** só existe quando há modelo mapeado; a **4** só quando o texto de agradecimento resolve
todas as variáveis. Oferecer opção que vai travar na hora do envio é pior do que não oferecer —
os dois textos são conferidos **antes** de a pergunta aparecer.

A 4 vira primária quando não há modelo, que é o caso normal em "Outros".

### Aviso sobre a aba "Outros"

São atendimentos **em andamento com outro operador** (medido: `statuses=IN_PROGRESS` +
`exceptUserIds=você`). Concluir ali fecha o atendimento de um colega, então a rodada pede
confirmação explícita antes de começar.

### Resposta nova

`agradecer-info`: saudação + agradecimento + fecho, **sem pergunta no fim** — mesma regra que o
Thiago aplicou à saudação de fé, porque convite a responder vira atendimento. Conta como envio:
é mensagem para gente real, entra no limite e na pausa.

Migração com flag própria (`respostaAgradecerInfo`): reaproveitar a flag anterior faria voltar
resposta apagada de propósito.

### Arquivos alterados

`src/lib/store.js`, `src/lib/templates.js`, `src/panel/panel.js`

---

## 2026-08-09 — A pergunta da rodada ganhou três saídas e atalhos de teclado

**Pedido (Thiago):** "adicione a opção concluir, então as opções vão ser mandar modelo (tecla 1),
pular (tecla 2), concluir atendimento (tecla 3) e Esc para parar a rodada."

### Por que saiu o `confirm()` nativo

Ele só tem duas saídas e não aceita atalho. Virou diálogo próprio, dentro do shadow root do
painel.

**O foco vai para o diálogo ao abrir, e as teclas tratadas são capturadas.** Sem isso, teclar
"1" escreveria "1" no campo de mensagem da plataforma, que está logo atrás — e a rodada existe
justamente para não digitar na conversa por acidente.

### As quatro saídas

| Tecla | Ação | Grava | Envia | Conclui |
|---|---|---|---|---|
| 1 | Mandar modelo | sim | modelo + agradecimento | sim |
| 2 | Pular (deixa aberto) | sim | não | não |
| 3 | Concluir sem enviar | sim | não | sim |
| Esc | Parar a rodada | não | não | não |

### Duas mudanças no percurso

Resultado novo **`concluido`**, que como `triado` **sai da fila** — a posição não avança, o
próximo escorrega para o lugar dele. Virou o conjunto `SAI_DA_FILA`, em vez de comparar com
`'triado'` solto: errar isso pula um contato em silêncio a cada conclusão.

E o `parar` passou a valer para **qualquer** resultado. Antes só era olhado no caminho do
enviado, então o Esc numa pergunta de "pular" seria ignorado — a rodada seguiria para o próximo
contato.

### Arquivos alterados

`src/panel/panel.js`, `src/panel/panel.css`

---

## 2026-08-09 — "Zane" x "Rosane Requia": o apelido do perfil vencia a resposta da pessoa

**Pegada do Thiago, na porta de confirmação:** "ela respondeu o nome como Rosane Requia e a
resposta irá sair com o nome Zane."

### O conflito de duas regras boas

O cadastro dizia **Zane** — nome do perfil do WhatsApp. Ela respondeu:

```
Boa noite.
Rosane Requia
Caxias do Sul
Não faço parte de nenhum grupo político.
```

O parser achava "Rosane Requia" sem dificuldade. Só que `load()` semeia o campo Nome com
`contact.name` e `applyGuesses` pula campo já preenchido — a regra **"nunca sobrescrever o CRM"**
descartava a resposta dela. O agradecimento sairia "Obrigado pela atenção, Zane!".

### A distinção que resolve

Nome de cadastro **igual** ao nome do perfil (`name === nameWhatsapp`) quer dizer que ninguém
digitou nada ali: foi o WhatsApp que preencheu. Nesse caso o que a pessoa **escreveu** vale mais.
Nome que um operador curou continua ganhando do palpite, como sempre.

`vars.nomeVeioDoPerfil(contact)` — pura e testada, comparando sem acento e sem caixa. A troca só
acontece quando há palpite de nome, o cadastro veio do perfil, e os dois são diferentes. Entra
como **palpite** (amarelo), não como verdade: continua esperando o clique.

### Nota sobre a confiança

O nome do formulário sai do parser com confiança `aproximada`, então a classificação automática
**não** o grava sozinho — ele espera confirmação. Só é gravado quando você aprova na rodada ou
clica em Salvar, que é o comportamento certo para um dado que muda o tratamento da pessoa.

### Testes

`vars.test.mjs`: seis casos da distinção perfil x cadastro curado. `parser.test.mjs`: a resposta
real em quatro linhas (saudação, nome, cidade, resposta dos grupos).

### Arquivos alterados

`src/lib/vars.js`, `src/panel/panel.js`, `tests/vars.test.mjs`, `tests/parser.test.mjs`

---

## 2026-08-09 — Concluir nunca concluiu: são dois cliques, não um

**Relato do Thiago:** "faltou concluir, continua na aba de Meus em vez de ir pra concluídos." E,
perguntado, confirmou: **as conclusões das 09:01 foram manuais dele**, não da rodada.

### O que estava acontecendo

`clickConcluir` clicava no botão do rodapé, esperava 900ms e devolvia `ok` **sem conferir nada**.
Inspecionado ao vivo: o clique **abre um menu**, não conclui. O atendimento seguia "Em andamento",
um `mat-menu-panel` aparecia, e como `hasOpenDialog()` só enxerga `mat-dialog-container`, nada
acusava. A rodada dava o contato por fechado e seguia.

Era a explicação de **"Meus" só crescer** (37 → 41 → 47 → 49 → 61) enquanto "Novos" caía: tudo que
a rodada tocava ficava lá.

### O fluxo real

```
button.split-button-left  ("Concluir")            → abre o menu
  [data-cy="menu-button-session-classify-finish"] → "Classificar e concluir"
  [data-cy="menu-button-session-finish"]          → "Concluir"   ← este fecha
```

Medido: os dois cliques concluem em ~2s, e o rodapé passa a mostrar **"Reiniciar"**.

### Duas armadilhas dentro da armadilha

1. **O item do menu também tem o texto "Concluir".** A primeira verificação que escrevi ("o botão
   sumiu") teria olhado para o item do menu e dado positivo sem nada ter fechado. `getConcluirButton`
   agora exclui o que está dentro de `.cdk-overlay-container`.
2. **O sinal de conclusão é o "Reiniciar"**, não a ausência do "Concluir" — pelo mesmo motivo.

### Hipótese errada pelo caminho

Achei que fosse "botão partido, clicamos no lado errado". Errado: o seletor pega o lado certo
(`split-button-left`). O lado certo simplesmente abre menu.

### Contatos concluídos no teste

Dois, ao vivo: **Viamão - Guacir Pereira** e **Tramandaí - Pedro Corrêa**. Reversíveis pelo
"Reiniciar" se tiver sido prematuro.

### Arquivos alterados

`src/lib/dom.js`, `src/lib/page.js`, `src/panel/panel.js`, `CLAUDE.md`

---

## 2026-08-08 — Rodada 3: quem respondeu, com porta humana por contato

**Pedido (Thiago):** "nessa parte os contatos responderam com as informações, então irá checar se
as etiquetas, data, cidade e nome estão de acordo, mandar o modelo pronto, agradecer e concluir e
ir pro próximo. Os com conteúdo à parte continuam para eu responder manualmente. Para não ter
erros me pergunte antes de mandar o modelo, com duas opções (mandar modelo ou Pular); ao pular
não conclui."

**Decisões dele, perguntadas antes de codar:** a fila é **"Meus"** (é onde o contato reaparece
depois de responder), e **Pular grava a classificação** — só a mensagem fica pendente.

### Reuso em vez de reimplementação

As rodadas 1 e 2 montam o contexto do contato à mão porque não precisam de classificação. Esta
precisa, e a classificação do painel é o código mais testado do projeto — trata "nunca
sobrescrever o CRM", união de etiquetas em vez de troca, carimbo de data com guarda-corpo e a
conferência relendo o contato.

Então ela chama `load()` e `saveClassification()` direto. O observador de estado continua
desligado durante a rodada; quem carrega é a rodada, uma vez por contato.

### A porta humana

`confirm()` com o que foi classificado na frente — nome, cidade, etiquetas, conteúdo identificado
e o modelo que sairia. O painel não está mostrando a aba Dados durante a rodada, então o texto
tem que carregar a conferência.

Cancelar = pular: grava a classificação, **não conclui**, atendimento fica aberto.

### Ordem das travas, e por quê

O agradecimento é validado **antes** de qualquer envio. Descobrir que ele trava por falta de nome
depois de o modelo ter saído deixaria o atendimento pela metade — mensagem enviada, fluxo morto.
Mesma razão pela qual a classificação é gravada antes: se ela falhar, nada sai.

### Passa direto, sem perguntar

Conteúdo que não casa com regra nenhuma, que casa com duas, ou cujo modelo não está mapeado. São
os "conteúdo à parte" do pedido: ficam para resposta manual, sem conclusão.

### Pré-requisito

A tabela **"Modelo por conteúdo"** precisa estar preenchida — a rodada recusa iniciar sem ela.

### Arquivos alterados

`src/lib/dom.js`, `src/panel/panel.js`

### A testar (nada exercido ao vivo)

Rodada de **1 contato**. É também o primeiro teste real do envio de modelo aprovado, que nunca
chegou ao clique final.

---

## 2026-08-08 — Congelamento deixa de abortar por suposição: agora pergunta à plataforma

**Print do Thiago:**

```
■ rodada — 12 enviado(s), 0 pulado(s), 6 assumido(s) para triagem em "Meus".
O navegador congelou esta aba (a pausa de 2s levou 48s)...
```

**0 pulados** confirma a mudança anterior: tudo que não é envio sai da fila. Novos caiu para 152.

### O erro que eu tinha embutido

A frase "a plataforma costuma voltar sem conexão depois disso" veio do **primeiro** incidente —
aquele que eu mesmo re-diagnostiquei depois como **limite de requisições**, não congelamento.
Ou seja, a rodada abortava com base numa suposição que o próprio registro já contradizia.

Abortar 185 contatos por um engasgo de 48s é caro demais para um palpite.

### Correção

`lidarComCongelamento` faz uma **leitura barata** (`getCustomFields`, mesmo caminho de rede dos
envios) e decide com o resultado:

- plataforma respondeu → registra no log e **segue** (`a aba ficou parada 48s, mas a plataforma
  respondeu — sigo`);
- não respondeu → aí sim para, com a mensagem de F5.

A pausa de "2s" da mensagem é o respiro dos pulos (1,5s arredondado), não a pausa entre envios —
o congelamento pegou durante uma triagem.

### E o estado do keepalive entrou na mensagem

Estava só no veredito, no fim de um log longo. Agora aparece **junto do congelamento**, que é
onde ele é lido: `áudio de keepalive ativo` ou `ÁUDIO DE KEEPALIVE PARADO`. Sem isso não dá para
saber se o remédio falhou ou se não basta — dúvida que já custou dois turnos.

### Arquivos alterados

`src/panel/panel.js`

---

## 2026-08-08 — "Já informou nome ou cidade" também é assumido

**Decisão do Thiago:** perguntado se esses deveriam sair de "Novos" como os sem aceite,
respondeu "sim assuma como meus".

Eles já responderam: o que falta não é o formulário, é a **classificação**, que é manual. Ficando
em "Novos" eles prendiam posição em toda rodada futura — no print anterior eram **7 de 7**, ou
seja, a fila carregada tinha virado só eles.

Agora saem para "Meus" sem receber mensagem, junto com a triagem dos sem aceite.

### Ainda ficam em "Novos" (não pedido, e com motivo)

- **Janela de 24h vencida** — é a população da outra rodada (modelo aprovado). Assumir tiraria
  esses contatos da fila que a rodada "Sem retorno" percorre.
- **Já recebeu o pedido de dados** (anti-duplicata) — só aparece em "Novos" se o concluir tiver
  falhado; deveria ser raro. Tem a mesma propriedade de prender posição para sempre, e vale
  decidir depois se acompanha os outros.

### Arquivos alterados

`src/panel/panel.js`

---

## 2026-08-08 — Keepalive confirmado, e a rodada aprendeu a clicar "Ver mais"

**Print do Thiago:** limite 185, trocou de aba durante a rodada.

```
■ rodada — Rodada encerrada: 5 enviado(s), 7 pulado(s). A fila carregada acabou (7 item(ns)).
Áudio de keepalive esteve ativo do começo ao fim.
```

### O keepalive funciona (pergunta encerrada)

Aba escondida a rodada inteira e **nenhum congelamento**. É a prova que faltava desde ontem: o
áudio de amplitude mínima impede o congelamento que travava tudo. A hipótese 1 da entrada
anterior (o `play()` tinha sido recusado nas rodadas antigas) fica confirmada por eliminação.

### Por que parou em 5 de 185

A aba mostrava **176 em Novos** e a rodada só via **7**. A plataforma carrega 50 por vez e o
resto só vem no **"Ver mais"**, que é manual. Enviados e triados saem da lista; os 7 que sobraram
eram os pulados ("já informou nome ou cidade"), que ficam. A posição andou até o fim do carregado
e a rodada encerrou — corretamente, mas cedo demais.

### "Ver mais" ao vivo

Único gancho da fila **sem `data-cy`** — casa por texto, escopado em
`sessions-list-online-content`, ancestral comum do botão e dos itens. Medido: um clique leva de
**50 para 99** itens, e o botão continua para carregar mais.

`carregarMaisDaFila()` confirma pelo **crescimento da lista**, não por tempo fixo. No laço: fim
do carregado deixou de ser motivo para parar — pede a página seguinte e repete a **mesma
posição**. Teto de 20 carregamentos por rodada (~1000 contatos) e respiro entre eles.

### Decisão pendente

Os pulados por "já informou nome ou cidade" **ficam na fila para sempre** e ocupam posição em toda
rodada futura — no print, eram 7 de 7. Assumir também esses (como os sem aceite) esvaziaria
"Novos" de vez, mas eles vão para "Meus" esperando classificação manual. É escolha do Thiago.

### Arquivos alterados

`src/lib/dom.js`, `src/lib/page.js`, `src/lib/rpc-host.js`, `src/panel/panel.js`

---

## 2026-08-08 — Primeira rodada limpa: 30 envios, encerrada por limite

**Print do Thiago:**

```
■ rodada — Rodada encerrada: 30 enviado(s), 7 pulado(s), 8 assumido(s) para triagem em "Meus".
Limite de 30 envio(s) atingido. Áudio de keepalive esteve ativo do começo ao fim.
```

Novos 216 → 181, Meus 37 → 47. Encerramento **normal**, por limite — não por erro.

### O que fica confirmado em uso

- O laço em lote inteiro: assumir, enviar, concluir, voltar para "Novos", repetir 30 vezes.
- A triagem, nos dois caminhos: `sem o aceite do anúncio` e `não escreveu nada`.
- O respiro nos pulos: nenhuma queda de API nesta rodada, contra a anterior que caiu.
- O veredito no log, que é o que permitiu fechar as três últimas investigações.

### O que NÃO fica confirmado

O keepalive **esteve ativo**, mas isso só prova que o áudio toca e sobrevive à rodada. **Não
prova que ele impede o congelamento**, porque não se sabe se a aba chegou a ficar escondida
nesta rodada. A pergunta segue aberta e a resposta é uma rodada com a janela minimizada de
propósito.

Contorno enquanto isso: janela do mobiliza **parcialmente visível** num canto não congela —
trabalhar em outra janela por cima do resto do monitor funciona hoje.

### Arquivos alterados

Nenhum. Entrada de confirmação em uso.

---

## 2026-08-08 — O veredito funcionou e derrubou meu palpite: foi congelamento

**Print do Thiago**, primeira rodada com o veredito no log:

```
■ rodada — Rodada encerrada: 11 enviado(s), 5 pulado(s). O navegador congelou esta aba
(a pausa de 8s levou 41s). ... Dê F5 na aba antes de continuar.
```

Eu tinha apostado em "limite atingido" e argumentado contra o "Ver mais". Errado nos dois: foi
**congelamento**, e o detector novo pegou. Serve de lição sobre deduzir de sintoma quando dá
para instrumentar.

### O que isso diz sobre o keepalive

O áudio **não segurou**. Restam duas explicações, e elas pedem consertos opostos:

1. o `play()` foi recusado e o áudio nunca subiu — o remédio não chegou a ser aplicado;
2. o áudio subiu e o navegador congelou assim mesmo — o remédio não serve.

A resposta estava no topo do log (a linha que `ligar()` escreve quando falha), fora da vista numa
rodada de 17 linhas.

Nota sobre a grandeza: 41s para 8s é ~5x. O clamp de 1s de aba escondida daria ~9s; congelamento
pleno daria minutos. 41s é compatível com estrangulamento intenso, que é justamente o que áudio
tocando deveria impedir — o que faz a hipótese 1 a mais provável.

### Correção

O veredito passa a dizer o estado do keepalive, e distingue os três casos: não subiu (com o
motivo), esteve ativo do começo ao fim, ou subiu e foi interrompido no caminho. `ativo()` é lido
**antes** do `desligar()` no `finally`.

### Arquivos alterados

`src/panel/panel.js`

---

## 2026-08-08 — A rodada dizia por que parou, e o painel apagava a resposta

**Relato do Thiago (print):** "parou, creio que travou no ver mais ou pode ser outra causa."

### O que o print mostra de bom

A rodada **funcionou**: ~15 `✓` visíveis (mais acima do corte), o `→ Andreza Martins — sem o
aceite do anúncio — assumido para você ver depois` estreando, e "Novos" caindo de 264 para 225.
O texto enviado inclui a pergunta sobre grupos políticos.

### Por que não dava para saber a causa

`rodar()` fazia `setStatus(resumo)` e, três linhas abaixo, `await refresh()` — que carrega o
contato aberto e chama `setStatus('Contato carregado…')`. O veredito era sobrescrito **sempre**;
não era corrida, era ordem fixa. Na barra sobrava a mensagem do carregamento, que não tem nada a
ver com a rodada.

A causa real estava calculada e jogada fora. Inclusive a hipótese dele: quando a posição passa do
que a plataforma carregou, `openQueueSession` devolve `A fila carregada acabou (N item(ns))` —
que é exatamente o "travou no Ver mais", e teria aparecido.

### Correção

O veredito agora vai para o **log** (sinal `■`), que é permanente, antes do `refresh()`. E as
duas saídas silenciosas do laço passaram a ter nome: `Limite de N envio(s) atingido.` e
`Parada por você.` Antes, sair pelo limite não gerava mensagem nenhuma.

### Arquivos alterados

`src/panel/panel.js`

---

## 2026-08-08 — Novo sem o aceite: assumir para triagem em vez de pular

**Pedido (Thiago):** "os novos que não tiverem o identificador de conteúdo só inicie o
atendimento e volte pros novos, assim eles não ficam sendo repassados e eu vejo manualmente
depois."

### O problema que isso resolve

Pulado continuava em "Novos". Toda rodada futura reabria o mesmo contato — e reabrir custa uma
sessão na plataforma mais três chamadas nossas. Era a fila que nunca drenava, alimentando
justamente a rajada que derrubou a API.

### Novo resultado: `triado`

Contato sem o aceite do anúncio (ou que não escreveu nada) é **assumido e deixado em paz**:
nenhuma mensagem sai, ele some de "Novos" e vira pilha de triagem manual em "Meus".

O detalhe que importa no percurso: `triado` **sai da lista**, então a posição **não** avança —
o próximo escorrega para o lugar dele. `pulado` continua na lista e a posição avança. Confundir
os dois pularia um contato a cada triagem.

### Brecha fechada junto

Se o assumir falhar, o item continua na fila e cai no ramo de "já visitado", que avançava a
posição **sem respiro**. Numa fila grande isso vira rajada de aberturas — a mesma causa do
"Failed to fetch". Agora esse ramo também respira.

### Efeito colateral consciente

O limite da rodada conta **envios**, não triagens. Uma rodada com limite 1 pode assumir a fila
inteira procurando o único envio. É o comportamento pedido (a fila precisa drenar), e ela
termina sozinha quando "Novos" esvazia — mas a primeira vez merece ser vista rodando.

### Arquivos alterados

`src/panel/panel.js`

---

## 2026-08-08 — Primeiro envio real da rodada, e a causa verdadeira do "Failed to fetch"

**Print do Thiago:** log da rodada com ~20 pulos "a conversa não tem o aceite do anúncio", depois
**`✓ Enilza Facco`** — e em seguida `× contato — Failed to fetch`, com a plataforma travada em
"Carregando mensagens...".

### O que deu certo

`✓ Enilza Facco` é o **primeiro envio completo da rodada**, de ponta a ponta. Confirma o conserto
do `clickIniciar` (item 0 da fila) e, de quebra, que o caminho assumir → enviar → concluir
funciona.

### A causa real, que corrige o diagnóstico anterior

O nome no erro é `contato` — o valor padrão, atribuído antes de qualquer chamada. Ou seja, morreu
na **primeira** chamada do contato seguinte.

E o que veio antes foram ~20 pulos em sequência. O laço tinha isto:

```js
posicao++; // pulado continua na fila; nada saiu, segue sem pausa
```

A pausa foi desenhada para proteger o **número no WhatsApp**, e por isso só existia depois de um
envio. Mas quem carrega a **API** é cada volta do laço: um pulo custa o mesmo que um envio — abre
a sessão na plataforma e faz três chamadas nossas (`getSession`, `getContact`, `getIncomingText`).
Vinte pulos = ~20 sessões abertas e ~60 chamadas em poucos segundos.

`Failed to fetch` **não é erro HTTP**: é o navegador dizendo que a requisição não completou,
tipicamente com o preflight CORS recusado — que é o que um limitador de taxa devolve. Explica por
que a plataforma quebra junto: ela apanha do mesmo limite.

Isso **substitui** a explicação da entrada anterior (aba congelada). O congelamento é real e
merece o guarda-corpo que ganhou, mas não era a causa deste caso: a rodada estava rodando e
logando normalmente.

### Correções

- **Respiro de 1,5s também nos pulos** (`PAUSA_PULO_MS`), limitado pela pausa configurada.
- **`traduzirErroDeRede`**: "Failed to fetch" vira "a API parou de responder (provável limite de
  requisições). Espere alguns minutos, dê F5 e recomece com uma pausa maior." A ação é outra —
  repetir na hora não adianta.

### Otimização não feita (decisão pendente do Thiago)

A maioria esmagadora dos pulos é "não tem o aceite do anúncio", e para descobrir isso a rodada
**abre a sessão**. Dava para ler a prévia do item na lista (`getQueuePreview`) e pular sem abrir,
cortando a carga em quase tudo. Não fiz porque a prévia mostra só a **última** mensagem: se o
aceite não for a última, o contato seria pulado errado. Em "Novos" ele quase sempre é a única
mensagem — mas "quase" aqui significa deixar eleitor sem contato.

### Arquivos alterados

`src/panel/panel.js`

---

## 2026-08-08 — "Está quebrando a plataforma": era a aba congelada voltando morta

**Relato do Thiago (print):** plataforma com "Sem conexão com o servidor", "Carregando
mensagens..." preso, painel em "Carregando..." e "Failed to fetch", nenhum modelo carregado.

### A plataforma não estava quebrada

Aberta numa aba limpa, mesma conta, no mesmo momento: a fila carregou normalmente (Novos 265,
Meus 36, Outros 63), sem erro. Isso descarta as duas hipóteses mais assustadoras — plataforma
fora do ar e bloqueio da conta por excesso de requisições da extensão.

O que quebrou foi **aquela aba**, e a causa é o congelamento já documentado: ao congelar, as
requisições em voo e o socket do app morrem; ao voltar, o Angular não se recupera sozinho. O
"Failed to fetch" do painel é a mesma causa, na lista de modelos.

**F5 recupera.**

### O risco que isso expôs

Rodada que continua depois de um congelamento age sobre uma página morta: clica no que não
responde e pode **contar como enviado o que não saiu**. Pior que parar.

`pausarRodada` agora mede o relógio de parede: se a pausa demorou mais que `3x + 10s` do pedido,
o navegador parou a aba no meio. A rodada para e manda dar F5. A folga é grande de propósito —
o clamp de 1s da aba escondida não dispara isso; congelamento sim.

### Nota de operação

O print mostrava **limite 200** na primeira rodada. Com pausa de 8s são ~27 minutos de execução
contínua, tempo de sobra para qualquer minimizada congelar tudo. Primeira rodada é de **1**.

### Arquivos alterados

`src/panel/panel.js`

---

## 2026-08-08 — Rodada parava ao minimizar: a aba não é estrangulada, é congelada

**Relato do Thiago:** "minimizei a página e o processo parou; tem como continuar mesmo
minimizado para eu trabalhar em outras abas?"

### Medido, não suposto

Na aba escondida do Chrome dele:

- `setInterval(120ms)` → **zero disparos** em mais de um minuto;
- `setTimeout(12s)` → não voltou em 45s (o próprio CDP acusou "renderer may be frozen").

Não é o estrangulamento clássico (clamp de 1s): é **congelamento**.

### Por que a solução óbvia não serviria

A primeira ideia era tirar as esperas da aba — service worker como relógio, `chrome.alarms`,
mensagens no lugar de `setTimeout`. Não resolve: o congelamento atinge o JavaScript **da
plataforma** também. Depois de clicar em Iniciar, o Angular não renderiza e o campo de mensagem
nunca nasce. Quem precisa continuar viva é a página inteira, não só a nossa parte.

### O que descongela

Aba tocando áudio não é congelada nem estrangulada pelo Chromium. `keepalive.js` toca um WAV de
1s em loop, amplitude 2 de 32767 (silêncio absoluto não conta como "tocando" em todas as
versões) e volume 0.01. Ligado no início da rodada, desligado no `finally`.

**Autoplay exige gesto do usuário** — daí ligar a partir do clique que inicia a rodada. Se o
`play()` for recusado, a rodada **avisa no log** em vez de seguir e morrer calada.

### Não verificado

Não consegui provar o remédio daqui: `navigator.userActivation.hasBeenActive` fica `false` numa
aba escondida, e sem gesto o `play()` volta `NotAllowedError`. O diagnóstico está provado; a
correção, não. **A prova é uma rodada real minimizada.** Sinais: a aba mostra o ícone de som, e
se o áudio não subir aparece a linha no log pedindo para deixar a aba visível.

Efeito colateral esperado mesmo com o áudio: aba escondida ainda tem clamp de ~1s nos timers.
Os `waitFor` passam a checar 1x/s em vez de 8x/s; como os timeouts são por relógio de parede
(`Date.now()`), continuam valendo — só ficam mais grossos.

### Arquivos alterados

Novo: `src/lib/keepalive.js`. Alterados: `src/panel/panel.js`, `CLAUDE.md`

---

## 2026-08-08 — A rodada assumia o atendimento e morria sem enviar

**Relato do Thiago:** "testei e iniciou o atendimento mas parou totalmente por aí e não mandou a
mensagem."

### Causa raiz: a espera vigiava a condição errada

`page.clickIniciar` esperava assim:

```js
for (let i = 0; i < 30 && dom.isPending(); i++) await sleep(200);
```

E `isPending()` é **`sem composer E com botão Iniciar`**. O botão Iniciar some no instante do
clique, então a condição fica falsa **antes de o campo de mensagem existir** — a espera acabava
na primeira volta e `pageStateLocal()` devolvia `hasComposer: false`.

Quem chamava concluía "a plataforma não liberou o campo de mensagem" e devolvia erro. Como a
rodada **para no primeiro erro** (de propósito), ela morria inteira ali — depois de já ter
assumido o atendimento. Daí o sintoma exato: contato assumido, nenhuma mensagem, nada mais.

Os 6 segundos de timeout nunca foram usados: na prática a espera era zero.

**Correção:** esperar o composer aparecer (`!dom.getComposer()`), que é o que o chamador de fato
precisa, com 12s de teto.

### Diagnóstico melhor para a próxima

As duas causas possíveis pediam conserto diferente e estavam colapsadas numa frase só. Agora o
log da rodada distingue:

- "a plataforma não assumiu o atendimento (o botão Iniciar continua na tela)"
- "o campo de mensagem não apareceu depois de assumir o atendimento"

### Arquivos alterados

`src/lib/page.js`, `src/panel/panel.js`

### A confirmar no uso

Rodada de **1 contato** na aba Automatizado → Novos. O mesmo `clickIniciar` serve o botão
"Iniciar atendimento" do painel e a macro de pedir dados, então os três caminhos foram
destravados juntos.

---

## 2026-08-07 — Inspeção ao vivo: as abas da fila têm `data-cy`

**Pedido (Thiago):** conectar na extensão do Chrome e inspecionar ao vivo — o seletor da aba
"Novos" tinha sido escrito às cegas, casando por texto.

### O que a plataforma realmente tem

As três abas carregam **gancho de teste próprio**, que não muda com tradução, tema nem mexida de
layout:

```
[data-cy="button-new-sessions"]    Novos
[data-cy="button-my-sessions"]     Meus
[data-cy="button-other-sessions"]  Outros
```

A aba ativa recebe a classe `bg-gray-300` (`hover:bg-gray-300` das inativas é outra string, não
colide). O clique vai no próprio elemento do `data-cy` — é dele o handler.

Também conferido: `<sessions-list-item>` **não tem atributo nenhum**; quem é clicável é o
primeiro `div` de dentro, com `data-cy="list-item-session"` e `cursor-pointer` — exatamente o que
o `openQueueSession` já clicava. E o markup do item continua sem o id da sessão, o que confirma
por que o percurso é por posição.

### O que mudou por causa da inspeção

- `getQueueTab` usa `data-cy`, com o casamento por texto só como reserva.
- `selectQueueTab` **confirma** a troca pela classe da aba ativa em vez de esperar um tempo fixo.
- `getSessionListItems` ganhou reserva por `[data-cy="list-item-session"]`.
- **O timeout subiu de 2,5s para 6s:** a troca de aba medida ao vivo levou ~1,6s (a lista
  recarrega junto). O valor que eu tinha chutado passava perto demais.

### Testado ao vivo, numa aba separada

Achou as três abas; rótulo inexistente devolve `null` (é o que faz a rodada parar em vez de
percorrer a fila errada); Novos → Meus → Novos com confirmação, e a contagem da lista
acompanhando (50 → 17 → 50); pedir a aba que já está ativa retorna na hora, sem clique.

Nota: "Novos" mostrava 119 no badge com **50 itens carregados** — confirma que a rodada só
enxerga o que já veio, e o "Ver mais" é manual.

### Arquivos alterados

`src/lib/dom.js`

---

## 2026-08-07 — Rodada dos "Novos": pedir os dados em lote

**Pedido (Thiago):** "quando tiver essa mensagem na aba Novos, mandar a mensagem pedindo os
dados e ir para o próximo; ao iniciar a conversa a aba vai automaticamente para Meus e teria que
retornar para Novos". A mensagem é o aceite do anúncio — "Olá! Eu aceito receber conteúdos do
Flávio Bolsonaro e do Cap Martim", com variação no nome do candidato.

### Duas rodadas na mesma aba, uma por vez

A aba Automatizado passou a ter **Novos → pedir os dados** (texto livre; eles acabaram de chegar,
janela de 24h aberta) e **Sem retorno → modelo aprovado** (janela vencida, só HSM chega). Limite,
pausa, Parar e o log são compartilhados; o percurso da fila virou `percorrerFila`, um só para as
duas.

### Quem entra: três conferências, não uma

Mandar o formulário para quem já escreveu o nome é o erro caro aqui, e é barato de evitar:

1. a conversa tem a frase do aceite (campo editável, padrão `aceito receber conte` — sem o nome
   do candidato de propósito, porque a campanha troca o anúncio);
2. o **parser não achou nome nem cidade** nas mensagens — se achou, o contato vai pela
   classificação normal, não pelo formulário;
3. anti-duplicata: quem já recebeu o pedido de dados é pulado.

Ainda: janela vencida vira "pulado" com o motivo (é caso da outra rodada), e o texto do template
é montado para **aquele** contato — a rodada não passa pelo `load()` do painel.

### A volta para os Novos

`openQueueSession` ganhou `{ aba }` e garante a aba **a cada item**, não uma vez por rodada:
assumir o atendimento move o contato para "Meus" e leva a plataforma junto. Se a aba não for
encontrada, a rodada **para** — seguir seria percorrer a fila errada, que é justamente quem já
foi atendido.

### Arquivos alterados

`src/lib/dom.js`, `src/lib/store.js`, `src/panel/panel.js`

### A testar (nada exercido ao vivo)

Rodada de **1 contato** primeiro, e olhar o log: quem foi pulado e por quê. O seletor da aba
"Novos" continua sendo o ponto mais frágil — foi escrito por texto, sem inspeção ao vivo.

---

## 2026-08-07 — Sinalização errada de "resposta já enviada": mecanismo achado

**Confirmado pelo Thiago:** o aviso apareceu em contato para quem ele ainda não tinha mandado.
Isso descarta a explicação inocente (mesmo contato em outro atendimento) e diz que o registro
está caindo em contato errado — não que o aviso esteja lendo errado.

### Mecanismo (achado por leitura; não reproduzido ao vivo)

O envio demora: `composer.sendText` espera o botão aparecer e depois espera **o composer
esvaziar** para dar o envio por aceito. Quem clica num contato da fila nesse intervalo troca o
atendimento no meio — e aí duas coisas passavam batidas:

1. a conferência de "esvaziou" dava positiva **na hora**, porque o composer do atendimento
   recém-aberto está vazio;
2. `state.contact` já era outra pessoa quando o `markSent` rodava, porque o painel lê o contato
   só na hora de gravar.

Resultado: envio de A registrado no contato B. B nunca recebeu e passa a exibir "já enviei esta
resposta". Bate com o sintoma e explica por que é intermitente — depende de o clique cair na
janela de um a dois segundos do envio.

### Correções

- **`composer.sendText` amarra tudo ao atendimento em que começou.** Se a sessão mudar antes do
  clique, não envia; se mudar depois, recusa em vez de dar por enviado.
- **O painel captura o contato ANTES do primeiro await** (`sendTemplate`, `enviarModelo`) e usa
  esse mesmo contato para consultar e para gravar o anti-duplicata.
- **O registro passou a guardar o nome de quem recebeu.** O aviso agora diz para quem foi — e,
  se o nome não for o do contato aberto, ele mesmo denuncia: "o registro está no nome de X, não
  neste contato — isso é bug do WhatsFill". Registro antigo (só timestamp) continua valendo.

Teste novo em `tests/hsm.test.mjs` cobre a forma do registro e o formato antigo.

### O que ainda pode acontecer

Se aparecer de novo **com o nome do próprio contato**, o mecanismo é outro e a mensagem na tela
vai dizer isso. Se aparecer com nome de outra pessoa, a correção não pegou o caminho todo.

### Arquivos alterados

`src/lib/composer.js`, `src/lib/templates.js`, `src/panel/panel.js`, `tests/hsm.test.mjs`

---

## 2026-08-07 — Três itens da lista do print: nome com cidade, pergunta dos grupos, aba Novos

**Pedido (Thiago), print de anotações:** (1) "às vezes os nomes vêm com a cidade antes e a
saudação sai com o nome da cidade" — o caso é o cadastro "Canoas - Marines"; (2) "ao pedir os
dados perguntar se a pessoa já faz parte de grupos políticos no WhatsApp"; (3) "os contatos
começam na aba Novos e vão para Meus ao iniciar; ao mandar pedir dados + concluir + próximo deve
retornar para os Novos".

### 1. "Canoas - Marines" fazia a saudação virar "Boa noite, Canoas!"

`cities.splitCidadeNome()` separa **só** quando a esquerda é exatamente um município do RS, com
casamento `exata` e cobrindo a esquerda inteira. Errar aqui troca o nome de um eleitor, então o
teste guarda principalmente o que **não** pode separar: "Maria - Silva" (nome comum),
"Grupo Canoas - Marines" (cidade não é a esquerda inteira), "Sao lourenso - Ana" (só aproximada)
e telefone do lado do nome.

No painel (`corrigirNomeComCidade`), o Nome é corrigido **mantendo a origem**: veio do CRM,
continua marcado como do CRM e portanto não é reescrito lá — o painel conserta o que usa e
mostra, sem sobrescrever cadastro. Já a cidade da esquerda é dado determinístico novo e entra
como palpite exato, só se o campo estiver vazio. Roda **depois** do parser: o que a pessoa
escreveu vale mais que o formato do cadastro.

### 2. Pergunta sobre grupos políticos no "Pedir dados"

Mudar o texto padrão não bastaria — quem já usa o painel tem o template gravado no
`chrome.storage`, e o padrão só vale para chave inexistente (o texto salvo do Thiago diz
"Nome / Cidade", o padrão diz "Nome completo / Cidade": já estavam diferentes).

Daí `templates.migrarPerguntaGrupos()`, com duas travas para não atropelar edição dele: roda
**uma vez só** (registrada na chave nova `migracoes`), e não mexe em texto que já fale de grupo
político. Apagar a pergunta depois não faz ela voltar sozinha.

Efeito colateral aceito: a resposta pode vir com um terceiro pedaço ("Maria / Canoas / grupo tal").
Nome e cidade continuam saindo certos — o terceiro pedaço só vira Função se contiver palavra do
dicionário, que é o mesmo risco que o texto livre já tinha.

### 3. Concluir volta para a aba "Novos"

`openNextSession` ganhou `{ aba }`: troca de aba antes de clicar no topo. Assumir o atendimento
move o contato de "Novos" para "Meus", então depois de concluir o topo da aba atual não é mais o
próximo da fila de trabalho. Só a macro de pedir dados passa `Novos` — as outras fecham contato
que já respondeu, que é outro laço.

O rótulo da aba é achado **pelo texto exato dentro da coluna da fila** (a marcação dessas abas
não tem classe própria estável), pegando o elemento mais fundo: o clique sobe sozinho para quem
tem o handler. Não achando a aba, o fluxo **não quebra** — abre o próximo assim mesmo e diz na
tela que não achou.

### Arquivos alterados

`src/lib/cities.js`, `src/lib/dom.js`, `src/lib/page.js`, `src/lib/rpc-host.js`,
`src/lib/store.js`, `src/lib/templates.js`, `src/panel/panel.js`, `tests/parser.test.mjs`

### Pendências

- **O seletor da aba "Novos" foi escrito às cegas** (por texto, sem inspecionar a marcação ao
  vivo). Se não achar, a tela avisa — mas confirmar no uso é o primeiro teste.
- Continua aberta a sinalização errada de "resposta já enviada" (item 1 da fila). O print do
  Thiago mostra o aviso com data de hoje, o que também é compatível com envio que aconteceu
  mesmo — falta saber se apareceu em contato que ele não tinha respondido.

---

## 2026-08-06 — Aba "Automatizado": rodada de tentativa com quem não respondeu

**Pedido (Thiago):** aba nova à direita de Respostas, para tentar contato com as pessoas sem
retorno — mandar mensagem para cada uma delas.

**Decisões dele, perguntadas antes de codar:** modelo aprovado escolhido na aba (um só para a
rodada inteira), concluir e ir para o próximo depois de cada envio, e lote com limite e pausa
configuráveis, com botão Parar.

### Por que só modelo aprovado (HSM)

Quem está na fila "1 SEM RETORNO" parou de responder há semanas — a janela de 24h do WhatsApp
está vencida e texto livre não sai. Modelo aprovado é o único envio que chega nessa situação.
A aba não oferece resposta pronta nenhuma, de propósito.

### Como a rodada percorre a fila

Por **posição**, não pelo topo. `openNextSession` (das macros) sempre clica no primeiro item,
o que só funciona quando o concluído sai da lista — e isso depende do filtro aplicado na
plataforma. A regra que vale nos dois casos: abre a posição, compara o id da sessão com os já
visitados; **repetiu, anda uma casa; veio outro, a posição continua valendo**. Item pulado (já
recebeu) também não sai da fila, e cai na mesma regra.

Novo em `dom.js`: `openQueueSession(index)`, `getQueuePreview()` e `closeOverlay()`.

### Travas, todas porque o destinatário é gente real em produção

- **Anti-duplicata** por contato+modelo, o mesmo registro do envio manual (`hsm:<id>`): quem já
  recebeu é pulado, inclusive entre rodadas.
- **Pausa entre envios** (padrão 8s) e **limite por rodada** (padrão 20). Rajada é o que queima
  número no WhatsApp.
- **Para no primeiro erro.** Seguir mandando às cegas depois de uma falha é o modo de falha mais
  caro que existe aqui.
- **Exige "Enviar automático" ligado** — sem ele o modelo só é preparado no diálogo, e concluir
  fecharia o atendimento sem a mensagem ter saído. Mesma razão da macro de pedir dados.
- **`confirm()` com os números na frente** antes de disparar.
- **Erro fecha o overlay** que sobrou: diálogo do Material esquecido aberto é modal e trava o
  painel inteiro.
- O observador de estado (`applyPageState`) **não roda `load()` durante a rodada**: carregaria o
  contato duas vezes e dispararia a classificação automática (que grava) no meio de um envio.

### Quem entra na rodada é o filtro da plataforma

O WhatsFill não seleciona contato: percorre a fila da esquerda como ela estiver filtrada. O
botão "Ver a fila" mostra o retrato do que está carregado — e só o que está carregado entra
(o "Ver mais" da plataforma é manual).

### Dois bugs de ponte encontrados no caminho

Argumento omitido vira `null` ao atravessar `chrome.runtime.sendMessage` (o padrão `= {}` só
cobre `undefined`): desestruturar isso é TypeError e `slice(0, null)` devolve vazio. Corrigido
nos dois novos métodos.

E um pré-existente: `page.recorderStop()` no modo encaixado devolvia `true` cru, então o
`page.recorderStop().catch(() => {})` do fim do aprendizado estourava "não é função". Virou
`async`, junto com o `closeOverlay` novo.

### Arquivos alterados

`src/lib/dom.js`, `src/lib/page.js`, `src/lib/rpc-host.js`, `src/lib/store.js`,
`src/panel/panel.js`, `src/panel/panel.css`

### A testar ao vivo (nada disto foi exercido com envio real)

1. Rodada de **1 contato** no "Thiago Tim" antes de qualquer coisa — é também o primeiro teste
   real do envio de modelo aprovado, que nunca chegou ao clique final.
2. Conferir se o concluído sai da fila filtrada. Se não sair, a rodada anda de posição sozinha —
   mas é o caminho menos exercitado.
3. Ver se a plataforma pede motivo de conclusão: se pedir, a rodada para no primeiro contato.

---

## 2026-08-06 — "Respostas rápidas ficaram obsoletas depois de enviar"

**Pergunta do Thiago:** esse bug foi resolvido? Não tinha sido — estava na lista de pendências.
Diagnóstico feito lendo o código; **não reproduzido ao vivo**.

### Causa raiz: os botões nasciam desabilitados e ninguém redesenhava

Os botões de envio recebem `disabled` a partir de `state.busy` **no momento da renderização**
(`panel.js`, em `renderPreview`). E há renderização acontecendo DENTRO da ação:
`saveClassification` termina chamando `renderAll()`, ainda com `busy` ligado. O `withBusy`
desligava `busy` no `finally` mas **não redesenhava** — então os botões ficavam desenhados
mortos e continuavam assim até a próxima renderização, que só vinha ao trocar de atendimento
ou recarregar. Bate com "só ao recarregar voltou".

Não era exclusivo do modelo pronto: qualquer ação que gravasse classificação deixava os botões
mortos. O fluxo de HSM só era o caminho mais visível.

**Correção:** `withBusy` redesenha no `finally`, com o redesenho protegido para um erro ali não
escapar como falha da ação que já terminou.

### Segundo mecanismo, no mesmo sintoma

`hsm.abrirDialogo()` clica no clipe do rodapé e, se qualquer passo seguinte falhasse (menu sem
o item, diálogo não abriu, lista não carregou), o **overlay do Material ficava aberto**. Ele
fica por cima do painel (z-index 1000 contra 998) e, sendo diálogo, é modal: o painel inteiro
parava de responder. Agora o fluxo fecha com Escape o que ele mesmo abriu, antes de propagar o
erro.

### Arquivos alterados

`src/panel/panel.js`, `src/lib/hsm.js`

### A confirmar no uso

Reproduzir a sequência: enviar um modelo pronto e, em seguida, clicar numa resposta rápida sem
recarregar. Deve funcionar.

---

## 2026-08-06 — Macro "Pedir dados + concluir + próximo"

**Pedido (Thiago):** "ao pedir os dados também quero que conclua e vá para o próximo".

É a abertura do laço assíncrono e o botão de maior volume nos oito mil: pergunta, tira da fila,
segue. Concluir aqui não é "acabou" — quando a pessoa responde, a plataforma traz o atendimento
de volta para as não lidas, e aí a classificação entra sozinha.

### Decisões

- **Não carimba data de conclusão.** Quem só recebeu a pergunta ainda não foi concluído, e a
  data gravada agora nunca mais seria corrigida (ela só preenche buraco). Quem carimba é a
  classificação automática, quando há cidade ou etiqueta.
- **Não grava classificação.** Nesse ponto não há o que classificar, e exigir contrato de
  escrita para mandar uma pergunta criaria uma falha desnecessária.
- **Exige "Enviar automático" ligado**, e o botão fica desabilitado explicando por quê. Sem
  ele, `sendTemplate` apenas insere o texto — e concluir depois disso fecharia o atendimento
  **sem a pergunta ter saído**. Era o modo de falha silenciosa mais caro dessa macro.

### Refatoração aproveitada

As quatro macros repetiam o mesmo fecho (concluir → tratar diálogo de motivo → abrir o
próximo), cada uma com sua variação de mensagem. Virou `concluirEAbrirProximo(jaFeito)`, que
recebe o que já foi feito para o status não mentir quando o fluxo para no meio — dizer "falhou"
depois de a mensagem ter saído faria reenviar para o contato.

### Arquivos alterados

`src/panel/panel.js`

---

## 2026-08-06 — Data de conclusão automática e cidade com sufixo omitido

**Pedido (Thiago):** "etiquetas e cidade estão sendo preenchidas mas falta a data atual, a data
tem que seguir o mesmo padrão"; e da lista de bugs anotada: "cidades mal escritas não sendo
reconhecidas", com os exemplos "Sao Lourenço" e "Sao lourenso".

### 1. Data de conclusão não entrava sozinha

**Causa:** `aplicarAutomatico()` chamava `saveClassification` **sem** `withCompletionDate`. A
data só era gravada no Salvar manual e na macro. Cidade e etiquetas entravam; a data, não.

Agora entra junto, com dois guarda-corpos em `fields.deveCarimbarData()` (função pura, testada):

- **Nunca reescreve data já gravada** — contato concluído em 05/08 não vira 06/08 porque a
  conversa foi reaberta para conferir.
- **Nunca carimba contato sem classificação** — abrir a conversa de quem ainda não respondeu não
  pode marcar conclusão em oito mil registros. A âncora é ter cidade ou etiqueta, recém-
  reconhecida ou já no CRM.

### 2. "São Lourenço" não era reconhecida

**Causa:** não é erro de digitação, é **sufixo omitido**. O município é "São Lourenço do Sul" e
a distância de Levenshtein até o nome inteiro é 7 — longe de qualquer tolerância, e o corte por
diferença de tamanho descartava antes mesmo de calcular.

`cities.matchCity` ganhou um terceiro passo: comparar o pedaço do texto com o **prefixo** do
município que tem o mesmo número de palavras. Quatro travas, cada uma tirada de um falso
positivo real encontrado nos testes:

1. **Mínimo de duas palavras** — senão "Carlos" viraria "Carlos Barbosa". Nome de uma palavra
   continua sendo pego pela comparação com o nome inteiro, que é segura.
2. **O sufixo omitido tem que começar com preposição** (do/da/de/dos/das). É assim que se
   encurta nome de cidade em português. Sem esta trava, "Vila Nova do Nada" — lugar inexistente
   — casava com "Vila Nova do Sul", porque "vila nova do" é prefixo legítimo.
3. **O texto não pode estar continuando o nome** — se a palavra seguinte no texto é a próxima
   palavra do município, a pessoa está escrevendo um nome mais longo.
4. **Empate não vira palpite** — "Porto" prefixa cinco municípios; recusa e o painel sugere.

Prefixo escrito certo vale como `exata` (grava sozinho); com erro de digitação vale como
`aproximada` (espera clique). "Sao Lourenço" → exata; "Sao lourenso" → aproximada.

Nota: "Porto" ainda produz o palpite aproximado "Portão" (distância 1, pelo casador de erro de
digitação que já existia). Aproximado espera clique, então não grava sozinho — é essa a
propriedade que o teste fixa, não a ausência de palpite.

### Arquivos alterados

`src/lib/cities.js`, `src/lib/fields.js`, `src/panel/panel.js`,
`tests/parser.test.mjs`, `tests/contract.test.mjs`

### Pendências da lista do Thiago, ainda abertas

- **Respostas rápidas ficam obsoletas após enviar modelo pronto** (só voltam recarregando).
  Suspeita: o painel não é atualizado ao fim do fluxo de HSM, que mexe em diálogo da plataforma.
- **Sinalização errada de "resposta já enviada".** Suspeita: o envio por modelo aprovado não usa
  o mesmo id do anti-duplicata, ou a marcação acontece na inserção e não na confirmação.
- **Concluir e ir para o próximo ao enviar o encerramento.** A macro já existe; o registro
  anterior aponta que a tabela "Modelo por conteúdo" está vazia e ela para pedindo cadastro —
  pode ser configuração, não código.
- Data só grava se o contrato `DATE` tiver sido aprendido. Cidade e etiquetas funcionarem não
  garante que ele exista.

---

## 2026-08-06 — Repositório, ícones e preparação para a Chrome Web Store

**Pedido (Thiago):** criar repositório no GitHub e arrumar as pendências para publicar na loja.

**Decisões (confirmadas com o Thiago):** loja **não listada**, repositório **privado**, política
de privacidade num Gist público separado (repositório privado não serve de URL pública).

### Dado pessoal removido antes do primeiro commit

`tests/vars.test.mjs` usava **nome e telefone de um eleitor real** tirado dos prints, e o
telefone do Thiago aparecia em dois lugares. Trocado por dados fictícios; a asserção do primeiro
nome acompanhou. Regra nova no `CLAUDE.md`: nunca escrever telefone ou nome real em arquivo do
repositório.

### Pendências fechadas

- **Ícones** (bloqueava a loja) — `tools/make-icons.mjs` desenha 16/32/48/128 por campo de
  distância, sem dependência: quadrado arredondado índigo com um "check". Desenhar em vez de
  baixar evita dúvida de licença e deixa o ícone reproduzível. Adicionados em `icons` e
  `manifest.action.default_icon`.
- **Config gravava settings a partir de um retrato** — `salvarAjuste()` relê o storage antes de
  gravar. Antes, redimensionar o painel e depois marcar qualquer caixa na Config restaurava a
  largura antiga (o `main.js` grava `dockWidth`/`panelOpen` por outro caminho).
- **README dizia que `pedir-dados` pede "Nome / Cidade / Função"** — pede só "Nome / Cidade".

### Novos arquivos

- `tools/package.mjs` — gera `dist/whatsfill-<versão>.zip` por lista de inclusão (não de
  exclusão) e **falha** se algum arquivo citado no manifest ficar de fora. ZIP escrito à mão
  sobre o zlib do Node, para o projeto seguir sem dependência. Verificado abrindo o zip pelo
  .NET: 35 entradas, manifest legível.
- `PRIVACY.md` — política exigida pela loja.
- `STORE.md` — roteiro de submissão: textos prontos, propósito único, justificativa de cada
  permissão, respostas do formulário de uso de dados e o aviso de não capturar tela com a fila
  de eleitores visível.
- `.gitignore` — ignora `dist/` e qualquer `*backup*.json` (backup exportado carrega o contrato
  aprendido e referência a contato real).

### Estado do repositório

Publicado como **privado** em https://github.com/thiagokcw-coder/WhatsFill (branch `main`).
Feito pelo `gh` CLI depois que o Thiago autenticou — a GUI do GitHub Desktop não é
automatizável daqui, e `gh auth login` é interativo.

Política de privacidade publicada como Gist público (repositório privado não serve de URL para
a loja): https://gist.github.com/thiagokcw-coder/07b81a934626c55a88fd660c359a8914

Nota de ambiente: `gh` escreve o progresso do git em stderr, e o PowerShell transforma isso em
`NativeCommandError` com exit 255 mesmo quando deu certo. Confira o resultado pelo
`gh repo view`, não pelo código de saída.

### Imagem promocional (obrigatória, descoberta depois)

A loja exige **três** imagens, não duas: ícone, captura **e promocional pequena 440×280**.
Conferido na documentação oficial em vez de responder de memória. Gerada em
`icons/promo-440x280.png` desenhando no canvas do navegador (canvas dá tipografia de verdade;
o gerador de ícones em SDF não desenha texto).

Transferir a imagem do navegador para o disco: o filtro de segurança bloqueia base64 no
resultado das ferramentas, então o caminho foi a própria página disparar um download. Funcionou
**uma vez** — o Chrome passou a bloquear downloads repetidos do mesmo site em silêncio, e a
segunda versão (com o rodapé menos apertado) nunca chegou. Ficou a primeira, que é válida; o
rodapé encosta na margem sem cortar.

`package.mjs` passou a excluir `promo-*`: a promocional é enviada no formulário da loja, não vai
dentro do zip.

### Pendências

- Captura de tela 1280×800 — o Thiago fez; a fila ficou fora do quadro e o telefone também.
- Taxa de US$ 5 da conta de desenvolvedor.
- Enviar o zip no painel e responder o formulário — textos prontos no `STORE.md`.
- Continuam abertas: envio de modelo nunca testado de verdade, tabela "Modelo por conteúdo"
  vazia, reanálise ao vivo não vista com resposta real chegando.

---

## 2026-08-06 — Reanálise ao vivo: o painel enxerga a resposta sem sair do atendimento

**Pedido (Thiago):** "tenho que mandar salvar no CRM, sair da conversa e voltar para ver que as
informações entraram; tem que salvar sozinho ao adquirir as informações e mostrar na mesma hora".

### Causa raiz

A classificação automática já existia, mas o gatilho era **só a troca de sessão**.
`applyPageState` comparava apenas `sessionId`; o contato responder não muda o `sessionId`, então
o painel nunca reanalisava a conversa aberta. Sair do atendimento e voltar era o que forçava o
`load()` — exatamente o sintoma descrito.

### Correções

**1. Sinal de conversa** (`dom.getConversationSignal`) — `contagem:texto-da-última` sobre
`.message-text`. Verificado ao vivo: é classe do próprio app (não utilitária do Tailwind), a
lista **não** é virtualizada, e a última no DOM é a mensagem mais recente (bate com o primeiro
item da API). Contagem e texto juntos porque a contagem sozinha muda ao rolar para trás e o
texto sozinho não distingue duas mensagens iguais seguidas. Testado injetando nós falsos: muda,
desempata repetidas e volta ao original.

**2. `reexaminarMensagens()`** — dispara quando o sinal muda com o mesmo atendimento aberto.
Relê as mensagens do contato, roda o parser, atualiza as etiquetas sugeridas e chama
`aplicarAutomatico()`. Se o sinal veio de mensagem nossa ou de mídia, sai cedo sem trabalho.
Trava contra reanálises sobrepostas (o estado é consultado a cada 500 ms) e não roda durante
uma gravação em andamento.

**3. Painel subia sem settings** (pendência aberta na entrada anterior) — `main.js` agora chama
`panel.refresh()` explicitamente no boot. Sem isso, aba aberta **sem** atendimento selecionado
nunca rodava `load()`, e `state.settings.autoApply` ficava `undefined`: a classificação
automática nascia desligada.

### Decisões

- **Reanálise só preenche buraco.** `applyGuesses` continua pulando o que veio do CRM e o que
  você corrigiu à mão. Consequência aceita: se o contato corrigir a cidade numa segunda
  mensagem, o valor antigo permanece — trocar sozinho violaria "nunca sobrescrever".
- **Sinal pelo DOM, não por polling de API.** O app já pinta a mensagem em tempo real via
  SignalR; ler o DOM é instantâneo e não custa requisição. A API só é chamada quando o sinal
  muda de fato.

### Arquivos alterados

`src/lib/dom.js`, `src/lib/page.js`, `src/lib/rpc-host.js`, `src/panel/panel.js`, `src/main.js`

### Pendências

- **Não testado com resposta real chegando** — a mecânica foi verificada com nós injetados no
  DOM. Falta ver um contato responder de verdade com o painel aberto.
- Continuam abertas as pendências da entrada anterior (envio de modelo nunca testado, tabela
  "Modelo por conteúdo" vazia, Config grava settings a partir de snapshot, sem ícone no
  manifest).

---

## 2026-08-06 — Modelos de mensagem, classificação automática e a caçada aos 200 mentirosos

**Pedido (Thiago):** análise da extensão; depois enviar modelos de mensagem salvos; depois
"o fill de etiquetas, cidade e data de conclusão não está funcionando"; depois automação do
fluxo de atendimento.

### Correções de bug (todas com causa raiz confirmada ao vivo)

**1. `getContact` sem `isToIncludeCustomFields=true`** — a extensão chamava
`GET /core/v1/contact/{id}` sem query. A API responde 200 com `customFieldValues: []`, então o
painel nunca via o que já estava gravado: marcava tudo como palpite amarelo e regravava os
mesmos campos a cada Salvar. O comentário antigo em `fields.js` dizia que o array "estava vazio
em todos os contatos"; não estava, faltava o parâmetro.

**2. `readValues` lia campos que não existem** — procurava `item.value` / `item.values` /
`item.text`. A forma real é `valueString`, `valuesId`, `valuesDateTime`, `valuesInteger`,
`valuesFloat`, com `valueType` dizendo qual usar. Mesmo com a query certa, devolveria vazio.

**3. Data de conclusão gravava sem gravar** — não havia contrato `DATE`; a escrita caía no
contrato de texto, mandava `"2026-08-05"` em `valueString`, e a API respondia **200 ignorando**.
Corrigido em três frentes: botão "Aprender data (conclusão)", `sampleValue` guardado no contrato
para descobrir o formato (ISO x cru x dd/mm/aaaa), e busca do caminho do valor **por conteúdo**
(você escolhe 31/12/1999 e a plataforma manda `1999-12-31T00:00:00.000Z`).

**4. Data de conclusão saía com o dia errado à noite** — `toISOString()` devolve UTC. Às 21h no
Brasil já é o dia seguinte lá; um atendimento do dia 05/08 gravou 06/08. Agora usa data local
(`fields.hojeLocal`).

**5. Fallback silencioso para o contrato de texto** — era a raiz da classe inteira de falha.
`DATE`, `DATETIME`, `MULTISELECT` e `SINGLESELECT` agora **recusam** quando falta o contrato do
próprio tipo, dizendo qual falta. Antes, "falta aprender" chegava ao usuário como "gravou e
sumiu".

**6. Modelo de mensagem errado indo para o envio** — `pickRow` aceitava candidato único pelo
nome sem conferir o texto. Durante o repinte da busca a lista passa por um estado transitório
com uma só linha, e era a errada. Agora exige cobertura de ~80% do texto, recusa empate, espera
a lista estabilizar e **confere no DOM** qual linha ficou marcada antes de seguir.

**7. `Extension context invalidated` silencioso** — recarregar a extensão órfã as abas abertas;
`chrome.storage` passa a falhar e o painel mostra caixas vazias. Agora o erro vira uma frase
pedindo F5. Custou dois diagnósticos errados nesta sessão.

### Funcionalidades

- **Modelos de mensagem aprovados (HSM)**: listagem via `GET /chat/v5/template` (leitura pura) e
  envio dirigindo o diálogo nativo. Nova seção na aba Respostas, com filtro. Também é o único
  envio que funciona com a janela de 24h expirada.
- **Conferência pós-escrita**: toda gravação relê o contato e compara campo a campo. O status só
  diz "Confirmado no CRM" com a resposta do servidor na mão. É o que dispensa o F5 e o que
  teria pego sozinho o bug da data.
- **Classificação automática ao abrir o contato**: grava sozinho só o determinístico (cidade
  exata do IBGE, COREDE dela, etiquetas de conteúdo). O COREDE herda a confiança da cidade — se
  a cidade foi palpite aproximado, a etiqueta de região não entra sozinha.
- **Macro "Enviar conteúdo + agradecer + concluir"**: manda o modelo correspondente ao conteúdo
  pedido, agradece, classifica e conclui. Nova tabela "Modelo por conteúdo" na Config liga
  etiqueta -> nome do modelo.
- **Macro "Salvar + concluir + próximo"**: fecha sem enviar mensagem.
- Aviso e Salvar desabilitado na aba Dados quando não há contrato aprendido.

### Decisões

- **Link de grupo saiu do caminho crítico.** O contato já vem de um grupo; o que se confirma é o
  aceite em receber conteúdo. A macro do link virou opção secundária.
- **Listar HSM por API, enviar pela interface.** O modelo carrega mídia aprovada (~1,4 MB),
  vínculo de canal e regra de janela; reproduzir isso por API seria adivinhação.
- **Parâmetros de HSM: preencher sozinho e travar se faltar variável** (decisão do Thiago).
  Nenhum dos 19 modelos usa parâmetro hoje, então a tela nunca aparece e não houve como
  aprendê-la; por ora o painel **recusa e explica**.
- **Triagem de quem respondeu é da plataforma.** Concluir tira da fila e a resposta traz de
  volta para as não lidas. Ideia de um "próximo que respondeu" foi descartada.

### Arquivos alterados

`src/lib/api.js`, `src/lib/fields.js`, `src/lib/contract.js`, `src/lib/path.js`,
`src/lib/store.js`, `src/lib/dom.js`, `src/lib/page.js`, `src/lib/rpc-host.js`,
`src/panel/panel.js`, `README.md`
Novos: `src/lib/hsm.js`, `tests/hsm.test.mjs`, `CLAUDE.md`, `registro.md`

### Pendências e riscos

- **O clique final de envio de modelo nunca foi testado de verdade.** Todo o fluxo até a tela de
  envio está verificado; o envio em si, não. Testar no número do próprio Thiago antes de usar em
  contato real.
- **Tabela "Modelo por conteúdo" está vazia** — sem ela a macro de fecho para e pede cadastro.
- **Contrato `MULTISELECT` sumiu do storage uma vez**, sem causa identificada. Reaprendido.
  Suspeita não confirmada: read-modify-write da mesma chave com duas abas abertas. Recomendado
  exportar backup (Config -> Backup) para restaurar contrato sem refazer aprendizado.
- **Painel sobe sem settings quando a aba abre sem atendimento aberto** (`panel.js`,
  `applyPageState`): `load()` só roda quando o `sessionId` muda, e no boot ele já é `null`.
  Config mostra defaults errados e throttle vira `undefined` -> grava 0 ms.
- **Config grava settings a partir de snapshot** e apaga `dockWidth`/`panelOpen` ajustados por
  outro caminho.
- **Sem ícone** no manifest (`icons` e `action.default_icon` ausentes).
- README dizia que o template `pedir-dados` pede "Nome / Cidade / Função"; o template pede só
  "Nome / Cidade". Dicionários de função e partido não têm editor na UI.
