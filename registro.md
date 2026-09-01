# Registro de mudanças

> Entrada nova sempre no **TOPO**. Formato: data, o que foi pedido, o que foi feito, causa raiz
> quando for correção, decisões, arquivos, pendências.

---

## 2026-09-01 — "Diminuir a necessidade de pesquisa", não impedir a pesquisa

**Correção dele:** *"a regra não é impedir de pesquisar e sim diminuir a necessidade de pesquisa"*.

Eu tinha escrito o contrário em dois lugares, e a diferença não é de estilo:

- no **prompt**, o bloco saía como *"informação do gabinete, não pesquise nem invente"*;
- na **tela**, a explicação abria com *"A IA não pesquisa nada — e é bom que não pesquise"*.

### Por que ele está certo

"Não pesquise" é uma ordem sobre o **comportamento** do modelo; o campo existe para resolver um
problema de **informação**. São coisas diferentes, e a minha formulação trocava uma pela outra:
sugeria que a ignorância é desejável, quando o que se quer é que a informação certa já esteja ali
— e que o modelo não **invente** o que faltar.

A trava que importa continua inteira, e é a segunda metade da frase: **não inventar**. Essa não
mudou.

Hoje o prompt diz *"informação do gabinete — use-a como fonte e não invente o que não estiver
aqui"*, e a tela abre com *"serve para DIMINUIR a necessidade de a IA buscar contexto, não para
proibi-la de buscar"*. Corrigi também a frase equivalente na entrada de ontem.

**Arquivos:** `src/lib/ia.js` (as duas montagens de prompt), `src/panel/panel.js` (o texto da
Config), `registro.md`, `manifest.json` (1.5.0 → **1.6.0**). 31 módulos sem erro, onze suítes
passando.

**Nota de processo:** o commit anterior (`d525b0a`) subiu sem esta entrada porque o script que a
escreveria quebrou e eu não conferi antes de empurrar. Commit sem registro é conserto que ninguém
consegue explicar depois — é a regra que este arquivo existe para sustentar.

---

## 2026-09-01 — "Deu a cidade e não pegou": eu reconhecia uma das três formas de pedir

**Relato dele**, testando a versão IA: *"deu a cidade e não pegou primeiro, a tela de confirmação
não apareceu"*.

### A causa é minha, de 31/08

Quando implementei *"a pergunta que você fez também é contexto"* (`respostaAoPedido`), decidi se a
nossa última mensagem era o formulário assim:

```js
const corpo = achatarTexto(modelo?.text || '');       // SÓ o texto base do pedir-dados
return achatarTexto(nossaUltima).includes(corpo.slice(40, 100));
```

Naquele dia havia **um** texto. Hoje há três formas de pedir os dados, e todas falhavam nessa
comparação menos a primeira:

| texto | linha do formato |
|---|---|
| `pedir-dados` | `Nome completo / Cidade` |
| `pedir-dados-evento-sim` / `-nao` (0.62.0) | `*Nome / Cidade*` |
| **variantes** de qualquer um | reescritas do mesmo texto |

Bastava a mensagem ter saído como variante — e ela sai, porque o revezamento é automático — para
o painel achar que não tinha perguntado nada. Aí *"maria cachoeirinha"* deixa de ser resposta,
a cidade não é reconhecida e o popup de confirmação não aparece.

### O conserto

`pediuNomeECidade` casa pela **linha do formato** (`nome( completo)? / cidade`), que é:

- o que todos os textos têm em comum, hoje e nas variantes;
- o que o parser realmente depende;
- o que os testes **já protegiam** texto a texto desde 10/08.

Provado contra os textos reais do `store`: **11 pegam** (base, duas variantes de cada, os dois de
evento e os dois de interesse) e os que não pedem dados continuam fora — agradecimento, sem
interesse, link do grupo. Se fossem confundidos, qualquer conversa viraria "resposta ao
formulário" e o parser leria cidade onde não há.

### A lição, que virou armadilha no `CLAUDE.md`

**"Nossa mensagem foi X?" nunca se responde comparando com UM texto.** Case pelo invariante. Eu já
tinha usado a mesma técnica frágil em outros dois lugares (`modeloJaNaConversa`,
`jaPediramDados`) — lá o alvo é um modelo específico e a comparação por trecho se sustenta, mas
vale reler quando aparecerem variantes de modelo.

**Arquivos:** `src/panel/panel.js` (`pediuNomeECidade`), `tests/vars.test.mjs` (+14, cobrindo
variantes e os textos de evento), `CLAUDE.md`, `manifest.json` (0.62.0 → **0.63.0**).
29 módulos sem erro, dez suítes passando.

**Vale para os dois branches:** feito aqui, a levar para `claude/whatsfill-ia` por merge.

## 2026-09-01 — Quem é quem: a chapa entra no prompt cacheado (e duas funções voltam do merge)

**Pedido dele:** *"a extensão deve ter salva informações dos cadidatos relacionados ao gabinete do
capitão martim e sua chapa para a ia não pesquisar toda vez"*.

### O que foi feito

Campo novo em Config, **"Quem é quem (chapa, números, pautas)"**, guardado em `store.ia.gabinete`.
O texto entra no prompt de **sistema** — a parte com `cache_control` —, dentro do bloco
`Quem é quem neste mandato (informação do gabinete, não pesquise nem invente):`, tanto na decisão
(`montarSistema`) quanto no rascunho (`montarSistemaRascunho`).

Três consequências que valem registro:

1. **Diminui a necessidade de a IA buscar contexto — não a proíbe de buscar** (correção dele,
   01/09). Sem este campo ela decide sobre nomes que
   não conhece: alguém escreve "vou votar no Marcel para senador" e ela não tem como saber se é
   aliado, adversário ou outro cargo. Antes disso o desconhecido virava `incerto`; agora vira
   decisão informada — e continua virando `incerto` quando o campo está vazio.
2. **Detalhe aqui é barato.** Está na parte cacheada: custa uma vez e 10% do preço nas chamadas
   seguintes. O aviso na tela diz isso, porque a reação natural é economizar palavra justamente
   onde não precisa.
3. **A regra do rascunho mudou de redação.** Ela dizia "não invente nenhum dado"; virou *"você pode
   usar o que está na conversa e o que está no bloco Quem é quem acima — e NADA além"*. Sem isso a
   própria regra proibiria usar o bloco que acabamos de dar a ela.

O `tokensAproximados` do estimador de cache passou a incluir o gabinete: ele engorda o prompt e
pode ser o que empurra o Haiku para cima do mínimo de 4.096 tokens de cache.

**O campo nasce VAZIO de propósito** e continua vazio: os dados são dele. Inventar número de urna
ou cargo de candidato é o tipo de erro que sai daqui e chega no eleitor.

### Causa raiz de um bug MEU que estava no ar desde ontem

Ao ligar o gabinete no `panel.js` descobri que **`avaliarComIA` era chamada nas linhas 3407 e 6913 e
não existia mais**. Junto com ela `tentarRascunhoAutomatico`. As duas foram apagadas pelo merge
`c7a6d59` (31/08) — e no relato daquele merge eu escrevi que conferi que nada de produção tinha se
perdido. Conferi um lado só. **Merge tem dois.**

Por que nada acusou:

- o arquivo continuou **sintaticamente válido** (chamada para função inexistente é erro de
  execução, não de sintaxe), então `node --check` não vê;
- `checar-modulos.mjs` só olha `SyntaxError`;
- **nenhuma suíte importa o `panel.js`** — ele precisa de `window`.

O erro apareceria como `avaliarComIA is not defined`, no meio de uma rodada, matando o laço em
silêncio. As duas funções voltaram do commit `a4d03bd`, agora passando `gabinete`.

### `tools/checar-referencias.mjs` — a ferramenta que faltava

Nova, para esta classe de bug: toda função chamada dentro de um arquivo existe nele? Ela coleta os
nomes declarados (funções, arrow, classes, métodos, parâmetros, importados) e reclama do que é
chamado sem estar em nenhum. Não resolve escopo e ignora tudo com ponto antes — é detector de
função-que-sumiu, não analisador.

**A prova de que serve:** removendo `avaliarComIA` de propósito, `checar-modulos.mjs` diz
*"31 arquivos, 0 com erro de sintaxe"* e o conferidor novo aponta a linha 3407. Sem a prova, era só
mais um script que ninguém sabe se funciona.

O caminho até calar os falsos positivos, porque ferramenta que grita ninguém roda duas vezes:

| falsos | causa |
|---|---|
| 503 | palavra dentro de **comentário em português** seguida de parêntese ("a rodada (que já fechou)") |
| 57 | **parâmetros** chamados dentro da própria função (`fn`, `onResize`, `resolve`) |
| 30 | **regex literal** (`/(sempre|junto) com/` tem parêntese), métodos de objeto, globais de buffer |
| 1 | `import()` dinâmico do `content.js` — legítimo, entrou nas globais |

Hoje: 31 arquivos, zero. Onde a dúvida aparece, ela **cala** de propósito (a coleta de parâmetros é
grosseira): o alvo é função que sumiu, e função que sumiu não aparece em declaração nenhuma.

**Arquivos:** `src/lib/ia.js`, `src/lib/ia-cliente.js`, `src/lib/store.js`, `src/panel/panel.js`,
`tools/checar-referencias.mjs` (novo), `CLAUDE.md`, `manifest.json` (1.3.0 → 1.4.0).

**Pendência dele:** preencher o campo. Sem texto lá, a IA continua decidindo sem saber quem é quem.
---

## 2026-09-01 — Convite de evento: a tecla 4 escolhe entre três textos

**Pedido dele:** um anúncio novo pergunta se a pessoa vai ao evento, e ele responde de dois jeitos —
consolo para quem não pode, comemoração para quem vai. Passou os dois textos, palavra por palavra.

### O que a leitura dos textos dele mostrou

Os dois **terminam pedindo nome e cidade**. São o `pedir-dados` com um prefixo — e é isso que faz o
desenho ficar simples: **nenhuma tecla nova**. A tecla 4 escolhe entre três textos conforme
`cortesia.confirmaPresenca`, e o rótulo dela passa a dizer qual vai sair
("Não vai ao evento + pedir dados e concluir").

Sem resposta clara sobre presença, sai o `pedir-dados` de sempre — aqui a dúvida não custa nada, o
texto seco continua servindo, só é mais frio.

### `respostaAfirmativa` não servia, e testar mostrou

Ele existe e lê sim/não, mas foi escrito para *"quer receber conteúdo?"*, onde "gostaria" é um sim.
Contra as respostas de presença erra os dois lados:

| resposta | `respostaAfirmativa` | verdade |
|---|---|---|
| *"Gostaria de estar mas sem condições 22 certamente"* | **sim** | não vai |
| *"vou sim"* | **não** | vai |
| *"estarei lá"* | **não** | vai |

Duas diferenças de desenho no `confirmaPresenca`:

- **A negativa vence, e olha a mensagem INTEIRA.** A frase real da print tem "gostaria" E
  "certamente" — duas marcas positivas — e é uma recusa. Quem não pode ir quase sempre começa dizendo
  que queria: a intenção está na ressalva. Por isso aqui não há "primeiras quatro palavras" como no
  `respostaAfirmativa`.
- **"sim" solto não conta.** Pode ser resposta a outra pergunta, e o texto de comemoração mandado a
  quem não falou de evento nenhum lê como confusão.

19 casos conferidos, incluindo a frase exata da print.

### O que não podia mudar nos textos

Os dois terminam com o formato `Nome / Cidade` e o exemplo `(exemplo: Maria Silva / Santo Ângelo)`.
**É dele que sai a precisão do parser** (`respostaAoPedido`), e mudar o formato quebraria a leitura do
nome e da cidade sem avisar ninguém. Há teste nos dois textos.

**Descoberto de passagem:** o `pedir-dados` de FÁBRICA está desatualizado em relação ao que ele usa —
o de fábrica diz "Nome completo / Cidade" e ainda pede o link de grupo. O dele, salvo no storage, é a
versão curta das prints. Não é problema hoje (o salvo vence), mas quem instalar do zero recebe o
texto antigo.

**Arquivos:** `src/lib/cortesia.js` (`confirmaPresenca`), `src/lib/store.js` (os dois textos),
`src/lib/templates.js` (migração), `src/panel/panel.js` (a tecla 4 e a linha da caixa),
`tests/cortesia.test.mjs` (+21), `tests/templates.test.mjs` (+11), `CLAUDE.md`,
`manifest.json` (0.61.0 → **0.62.0**). 29 módulos sem erro, dez suítes passando.

**Vale para os dois branches:** feito aqui, a levar para a IA por merge.

---

## 2026-09-01 — O diálogo "tem certeza que deseja concluir?" parava a rodada inteira

**Relato dele**, print do diálogo da plataforma: *"essa mensagem está quebrando a automação, é para
concluir e continuar mas está parando tudo"*.

O diálogo:

> **Atenção!** Uma mensagem está aguardando resposta do contato. Se você prosseguir com a conclusão
> do atendimento, essas mensagens serão canceladas. Tem certeza de que deseja concluir o atendimento?
> — **Cancelar** · **Concluir**

### A causa

`clickConcluir` tinha esta linha, e o comentário explicava a intenção:

```js
// Diálogo de motivo de conclusão: quem decide é o humano, então devolve para o painel.
if (dom.hasOpenDialog()) return { ok: true, dialogOpen: true };
```

Escrita para o diálogo de **motivo de conclusão** — que pede um dado que só ele tem. Mas ela pega
**qualquer** diálogo, e o da print é outra coisa: uma confirmação do que a rodada acabou de pedir.

**Confirmar ali não decide nada novo.** A conclusão foi pedida por ele dois cliques antes.

### A distinção, e a trava que a torna segura

`dom.getConfirmacaoDeConclusao` separa os dois:

- **confirmação** → a rodada clica e segue;
- **formulário** → devolve para o painel, como sempre.

**O teste de campo vem PRIMEIRO, e é ele que segura a mão:** qualquer `input`, `select`,
`mat-select`, `textarea` ou `mat-radio-group` dentro do diálogo faz a função devolver `null` — mesmo
havendo um botão "Concluir" ao lado. Errar para o lado de não clicar custa uma rodada parada; errar
para o outro grava decisão que ninguém tomou.

Também exige que o texto fale de concluir/encerrar (diálogo de "Excluir contato" ou de transferência
não entra), recusa botão desabilitado, e limita a **duas** confirmações por conclusão — o encadeado
"tem certeza?" → "confirma?" cabe, e a teimosia de bater na mesma porta 40 vezes até o prazo não.

### O que ele precisa saber, e o log conta

Este diálogo avisa que **mensagens pendentes serão canceladas**. Aceitar isso em silêncio seria
decidir por ele sem contar — então o texto do que foi confirmado vai para o log da rodada, **uma vez
por rodada**: é o mesmo em todo contato, e repetido cem vezes afogaria o resto do log.

### Provado no navegador, com o diálogo da print

`tools/checar-dom.mjs` precisa de Playwright, que não está instalado. Montei os casos com o `dom.js`
real: **17 verificações, zero falhas.** As sete que mais importam são as que garantem que ele **não**
clica — diálogo de motivo (nas quatro formas de campo), "Excluir contato", transferência, botão
desabilitado.

**Arquivos:** `src/lib/dom.js` (`getConfirmacaoDeConclusao`), `src/lib/page.js` (o laço do
`clickConcluir`), `src/panel/panel.js` (o aviso no log), `CLAUDE.md`,
`manifest.json` (0.60.0 → **0.61.0**). 29 módulos sem erro, dez suítes passando.

**Vale para os dois branches:** feito aqui e a levar para `claude/whatsfill-ia` por merge.
## 2026-09-01 — Produção entra na IA outra vez: 24 commits de um dia inteiro

**Pedido dele:** *"sim atualize a ia"* — ele vai comprar US$ 5 de crédito e testar, e testar num
painel sem nada de hoje não diria nada.

### O merge

Base comum: `5136ea1`. Produção havia andado **24 commits**; este branch tinha 8 próprios.
`store.js` e `panel.js` — os dois maiores — fizeram **auto-merge**, e só três arquivos conflitaram:
`manifest.json`, `CLAUDE.md` e `registro.md`, todos de texto.

**Zero linhas de produção perdidas**, conferido arquivo por arquivo contra o branch dela:
`panel.js`, `cortesia.js`, `sugestao.js`, `hsm.js`, `tags.js`, `api.js`, `templates.js` e
`panel.css` deram 0. As duas do `store.js` são a própria mudança da IA (a lista de mescla ganha
`'ia'`).

E as peças da IA seguem no lugar: `ia.js`, `ia-cliente.js`, a suíte, `podeGastar`,
`CACHE_MINIMO_TOKENS`, a trava de gasto no service worker, o teto na Config.

### O que este branch ganhou de hoje

Tudo o que saiu das prints dele: a tecla **9** (pedido sem detalhe vira pergunta), a **8**
(agradecer o apoio), o **modelo por TEXTO** do anúncio, a caixa que **fica na tela** com o painel
escondido, o pulo que **não escreve** no CRM, a rajada que para no buraco de tempo, vídeo saindo da
fila de resposta à mão, e a fronteira de palavra que aceita pontuação.

### Resolução dos três conflitos

| arquivo | decisão |
|---|---|
| `manifest.json` | `WhatsFill+IA`, versão **1.1.0** — série 1.x é o que diz qual das duas está carregada |
| `CLAUDE.md` | **os dois lados** nas listas de armadilha; a seção "Avaliação por IA" é exclusiva daqui |
| `registro.md` | **os dois** históricos, produção em cima por ser o mais recente |

**Estado:** 31 módulos sem erro de sintaxe, **onze suítes** passando (as dez de produção mais a da
IA).

**Pendência que continua:** a IA nunca fez uma chamada real. Com o crédito comprado e a chave colada,
o primeiro teste é o botão "Avaliar o contato aberto" no "Thiago Tim" — uma chamada, fora de rodada.

---

## 2026-09-01 — O modelo do anúncio sai do TEXTO, sem etiqueta por anúncio

**Decisão dele:** *"não será feito etiqueta a etiqueta para os anúncios, agora é só ads; o padrão para
casar o modelo deve ser o texto (Olá! Eu apoio as Escolas Cívico-Militares = modelo)"*.

Está certo, e é mais simples do que o que eu tinha proposto na resposta anterior: o caminho
texto → etiqueta → modelo exigiria uma **etiqueta nova no CRM por anúncio** — rótulo permanente na
base de eleitores para transportar uma informação que já está escrita na mensagem.

### A tabela

`store.modeloPorTexto`: `{ "trecho do texto": "Nome do modelo" }`, editável na aba Config, uma linha
por par. **Nasce vazia** de propósito: o nome tem de ser o exato da plataforma, e chutar aqui manda o
modelo errado para eleitor real.

Ela **decide antes** da tabela por etiqueta. Casando, a etiqueta nem é consultada; nada casando, o
caminho antigo segue idêntico — é o que atende quem já tem "Conteúdo Zucco"/"Conteúdo Flávio".

### Quatro decisões que o teste trava

- **Casa por trecho CONTIDO.** A mensagem real chega com emoji e com o que a pessoa acrescentou
  depois (*"…Escolas Cívico-Militares 🤙 olá Capitão Martins…"*). Igualdade não casaria nunca.
- **Compara com `semAcento`**, que o `hsm.js` já reservava para valor digitado à mão: "Civico"
  digitado casa com "Cívico" da mensagem.
- **O trecho MAIS LONGO ganha.** Sem isso, "eu apoio" cadastrado para o modelo genérico venceria "eu
  apoio as escolas" pela ordem de digitação — e ordem de digitação não é uma decisão.
- **Nome que a plataforma não tem vira ERRO, nunca `null`.** `null` faria a rodada cair no caminho da
  etiqueta como se nada tivesse acontecido, e o erro de configuração dele desapareceria em silêncio.

Na tela, o botão de salvar confere os nomes contra os modelos aprovados **antes** de gravar: nome
errado não dá erro ao salvar, dá ao enviar, no meio de uma rodada com o contato aberto.

E a caixa passa a mostrar `Conteúdo pedido: texto: "<trecho>"` — sem isso ela diria "Sem modelo"
enquanto oferece a tecla 1, que é pior do que não explicar.

### Um buraco antigo que apareceu no caminho

`modeloPorTexto`, `padroesDeAnuncio` e `conteudoPreferido` não estavam na lista `allowed` do
`importJson`. O `exportJson` varre `DEFAULTS`, então o backup **exportava** as três — e a restauração
**descartava**. `conteudoPreferido` estava assim desde antes de hoje.

**Arquivos:** `src/lib/hsm.js` (`modeloPorTexto`, `parseModeloPorTexto`, `formatModeloPorTexto`),
`src/lib/store.js` (a tabela e a `allowed`), `src/panel/panel.js` (a decisão e o campo na Config),
`tests/hsm.test.mjs` (+15), `CLAUDE.md`, `manifest.json` (0.59.0 → **0.60.0**).
29 módulos sem erro, dez suítes passando.

**Para usar:** aba Config → "Modelo por TEXTO da mensagem", uma linha:
`Olá! Eu apoio as Escolas Cívico-Militares = <nome exato do modelo>`. O botão avisa na hora se o nome
não existir na plataforma.

---

## 2026-09-01 — A mensagem do anúncio se reconhece pelo TEXTO, não pela posição

**Pergunta e pedido dele**, print da Erenita: *"qual foi a mudança feita pro caso da print? preciso
que identifique o modelo pelo texto (Olá! Eu apoio as Escolas Cívico-Militares)"*.

### Respondendo o "qual foi a mudança"

A caixa sugeria a tecla 8 (agradecer o apoio) por causa da regra `so-expressa-apoio`, que subiu acima
do modelo em 31/08. **E estava errada ali** — pelo meu critério, não pela regra.

Eu havia implementado "a PRIMEIRA mensagem é o texto do anúncio, e sai da conta". A Erenita mandou
uma **figura antes**: o texto do anúncio virou a segunda mensagem, entrou na conta como se fosse dela,
e *"Eu apoio as Escolas Cívico-Militares"* foi lido como apoio escrito por ela.

**Ele apontou o critério certo: texto, não posição.** Basta um "bom dia" antes para qualquer critério
posicional cair.

### O conserto

`store.padroesDeAnuncio` (fábrica: `^ol[áa]!?\s+eu\s+apoio`) e `cortesia.ehMensagemDeAnuncio`.
Configurável porque o texto do anúncio muda quando a campanha muda, e isso não deveria exigir um
commit. Padrão inválido é ignorado **um por um**: expressão mal digitada na Config não pode derrubar
a leitura da conversa.

Conferido nos quatro casos reais do dia:

| | resultado |
|---|---|
| Erenita — figura antes, depois o texto do anúncio | **não** é apoio dela ✔ |
| Izaak — anúncio + *"Tamojuntos"* | é apoio dela ✔ |
| Ciro — anúncio + o *"texto de baixo"* | é apoio dele ✔ |
| só o clique no anúncio | não é apoio ✔ |

### Um bug no TESTE, que é a lição maior

Escrevi o padrão à mão no arquivo de teste e saiu `'\s'` com **uma** barra — em string JS isso é a
letra `s`, não a classe de espaço. O padrão virou `^ol[áa]!?s+eu s+apoio`, que não casa com nada, e
**três asserções passaram a "passar" testando nada**.

O teste agora lê `store.get('padroesDeAnuncio')`: prova o valor que a extensão usa, não uma cópia.
Duplicar valor de configuração em teste é o tipo de coisa que mente exatamente quando importa.

### Sobre "identificar o MODELO pelo texto" — isso já funciona, e é configuração

O mecanismo existe e não precisa de código:

1. **`tagRules`** casa texto → etiqueta (hoje: `zucco` → `Conteúdo Zucco`, `fl[áa]vio` → `Conteúdo
   Flávio`);
2. **`contentTemplates`** mapeia etiqueta → modelo aprovado;
3. desde 0.56.0, a etiqueta específica **vence o ADS**, que virou último recurso.

Para as Escolas Cívico-Militares: criar a etiqueta no CRM, somar `escolas c[íi]vico` → `Conteúdo
Escolas` nas regras, e mapear `Conteúdo Escolas = <modelo>` na tabela.

**Arquivos:** `src/lib/store.js` (`padroesDeAnuncio`), `src/lib/cortesia.js`
(`ehMensagemDeAnuncio`, `soExpressaApoio`), `src/panel/panel.js`, `tests/cortesia.test.mjs`,
`CLAUDE.md`, `manifest.json` (0.58.0 → **0.59.0**). 29 módulos sem erro, dez suítes passando.

---

## 2026-09-01 — A caixa da rodada fica na tela com o painel escondido

**Pedido dele:** *"ao eu mandar o whatsfill ocultar ele oculta o popup da automatização, faça com que
fique o popup mesmo ocultando, preciso de espaço na area de trabalho"*.

### A causa

Esconder o painel é `transform: translateX(100%)` no `.wf-root` (classe `wf-collapsed`). **Transform
arrasta os filhos** — e a caixa era filha do `root`, então deslizava para fora da tela junto.

A caixa passou a ser **irmã** do painel, dentro do mesmo shadow: `destinoDaCaixa()` devolve
`root.parentNode`, e os quatro pontos que criavam caixa passaram a usá-la.

### Três coisas que a caixa herdava e precisou receber

Sair do `root` custa mais do que parece, e cada uma destas apareceu na verificação:

1. **z-index 998** — herdava do painel; sem ele, a caixa ficaria atrás de qualquer coisa da página.
2. **As variáveis de cor** — definidas em `.wf-root`. O seletor virou compartilhado, mas **só para as
   variáveis**: o mesmo bloco tinha `background: var(--wf-bg)`, e herdar isso cobriria a tela inteira
   de branco, matando a transparência que mantém a conversa legível (armadilha já registrada).
3. **O tema escuro** — `.wf-root.wf-dark` não alcança irmão. Resolvido com
   `.wf-root.wf-dark ~ .wf-pergunta-fundo`; sem isso, a plataforma no escuro deixaria a caixa branca.

### Medido, não presumido

`tools/checar-pergunta.mjs` precisa de Playwright, que não está instalado aqui. Montei a prova no
Browser pane com o `panel.css` real:

| | painel aberto | painel escondido |
|---|---|---|
| **painel** | `805..1185` | `1185..1565` (saiu inteiro da área útil) |
| **caixa** | `346..840` | `346..840` — **deslocou 0** |

E as quatro que importam sobre o CSS: camada com `pointer-events: none`, `background` transparente
(`rgba(0,0,0,0)`), `z-index: 998` próprio, tema escuro chegando (`rgb(17,24,39)`). O clique no meio da
tela continua chegando na conversa com o painel aberto **e** escondido.

**Uma armadilha do próprio projeto apareceu na verificação:** o primeiro teste deu timeout porque usei
`requestAnimationFrame`, e o Browser pane estava escondido — aba escondida é aba congelada, o mesmo
que está registrado para as rodadas. Refeito com leitura síncrona, que força o cálculo sem esperar
frame.

**Arquivos:** `src/panel/panel.js` (`destinoDaCaixa`), `src/panel/panel.css`, `CLAUDE.md`,
`manifest.json` (0.57.0 → **0.58.0**). 29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — "O atendimento foi perguntar os dados": pergunta não é entrega

**Relato dele**, print da Ivone: a caixa dizia *"5: já foi atendida antes (o modelo provavelmente já
saiu) — mande a mensagem do momento"*. Não tinha saído nada. A nossa única mensagem foi o **pedido de
dados**, e ela respondeu *"Ivone trentim Borges passo fundo"* dois minutos depois.

> *"o atendimento foi perguntar os dados"*

**Defeito da regra que eu fiz uma hora antes.**

### A causa

`jaRespondemosAntes` era `state.nossas.length > 0` — **qualquer** mensagem nossa. E o pedido de dados
é uma mensagem nossa.

O erro conceitual: **"já respondemos" não é "já entregamos".** Pergunta não é entrega, e quem só foi
perguntado é exatamente quem está esperando o material — o oposto de quem já recebeu.

Pior: a Ivone tinha **respondido** o formulário (nome e cidade), então o momento de mandar o modelo
era justo aquele.

### O conserto

`jaRespondemosAntes` passou a ignorar as nossas mensagens que são PERGUNTA: `pedir-dados`,
`interesse-conteudo` e `perguntar-como-ajudar`.

A comparação usa o maior pedaço literal de cada texto **e de cada variante** — as respostas prontas
revezam três textos, e comparar só o base deixaria duas de fora. Conferido nas três variantes do
pedido de dados.

### Prova nos dois lados

| nossas mensagens | já entregamos? |
|---|---|
| só o pedido de dados (base) | não |
| só o pedido de dados (variante 1 e 2) | não |
| só a pergunta de interesse | não |
| um modelo de verdade | **sim** |
| pedido de dados **e depois** um modelo | **sim** |

**Regra que fica:** resposta pronta nova que seja pergunta tem de entrar nessa lista, senão volta a
contar como entrega.

**Arquivos:** `src/panel/panel.js`, `CLAUDE.md`, `manifest.json` (0.56.0 → **0.57.0**).
29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — ADS é origem, não conteúdo: o tema do anúncio passa a vencer

**Relato dele**, print da Seura: ela clicou no anúncio das Escolas Cívico-Militares e escreveu *"Olá!
Eu apoio as Escolas Cívico-Militares 🤙 olá Capitão Martins será a segunda vez que você vota em ti sou
de viamão"*. A caixa sugeria o modelo genérico.

> *"nesse caso eu tenho um modelo pra escolas civico militares mas a etiqueta ads não faz distinção"*

### A causa, e ela era maior que o caso

**ADS diz que a pessoa veio de anúncio, não de QUAL anúncio.** É origem — e origem só serve de
conteúdo enquanto nada melhor aparecer. Mas ela entrava como `origem: 'conteúdo'` em pé de igualdade
com os temas, e o desempate era pelo **preferido** da Config, onde está `ads`.

Ou seja: **ADS já vencia "CONTEÚDO FLÁV" e "CONTEÚDO ZUC"**, que são temas de verdade e já existem na
base dele. O caso das Escolas só tornou isso visível.

### O conserto

A etiqueta de anúncio passou a sair de `tags.suggest` com `fallback: true`, e `escolherConteudo`
ignora os `fallback` quando existe conteúdo específico — **sem passar pelo preferido**.

Efeito colateral bom: antes, dois conteúdos sem preferido configurado eram **erro** e a rodada ficava
sem modelo. Agora, se um deles é o ADS, o específico ganha sozinho.

O desempate por preferido continua existindo, mas só **entre iguais**: dois temas de verdade sem
preferido seguem dando erro com o motivo na tela — que é a regra do projeto (na dúvida, recusar).

### O que ele precisa fazer para o modelo das Escolas sair

Nada disso cria a etiqueta do tema. Para o modelo específico ir:

1. criar a etiqueta no CRM (ex.: `Conteúdo Escolas`);
2. na aba Config, uma **regra de conteúdo** casando o texto que a pessoa manda —
   `escolas cívico-militares` → `Conteúdo Escolas`;
3. na tabela **Modelo por conteúdo**, mapear `Conteúdo Escolas = <o modelo dele>`.

A partir daí o ADS volta a ser o que é: a resposta de quem veio do anúncio e não disse mais nada.

**Arquivos:** `src/lib/tags.js`, `src/lib/hsm.js`, `tests/hsm.test.mjs` (+8), `CLAUDE.md`,
`manifest.json` (0.55.0 → **0.56.0**). 29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — `(^|\s)` não casa depois de pontuação: 26 padrões estavam cegos

**Relato dele**, print da Gessi na 0.54.0: *"vou agradecer apoio e concluir"*. A mensagem dela era
*"Boa noite. Gessi cremontti de medeiros. Itaqui Rs...sempre com vocês capitão. Com sIos zuccos 🙏"*,
e a caixa sugeria a tecla 5.

### Duas causas, e a segunda é grande

**1. O dicionário.** *"sempre com vocês"* não casava: o padrão exigia um verbo antes do "com"
(`estou`/`tamo`/`to`). Acrescentado `(sempre|junto|juntos|aqui) com (vocês|vc|o senhor|a gente)`.
**"com vocês" sozinho ficou de fora de propósito** — *"preciso falar com vocês"* é pedido, não apoio;
o que qualifica é o advérbio de permanência.

**2. A fronteira de palavra, e esta valia para o arquivo inteiro.** O texto é *"Itaqui Rs**...**sempre
com vocês"*: o "sempre" vem depois de três pontos, **sem espaço**. `(^|\s)` exige espaço ou início de
string, então nenhum padrão pegava.

**É a segunda armadilha em cima da mesma linha de código, com um dia de diferença:**

| | problema | conserto |
|---|---|---|
| 30/08 | `\b` é fronteira de `\w`, e `é` não é `\w` → `/\bé nós/` nunca casava | virou `(^|\s)` |
| 31/08 | `(^|\s)` não casa depois de pontuação → *"Rs...sempre"* invisível | virou `(^|[^\p{L}])` |

Trocado em **26 padrões** do `cortesia.js`, com a flag `u` onde faltava. `[^\p{L}]` é "qualquer coisa
que não seja letra": espaço, ponto, vírgula, emoji, quebra de linha.

### O que o teste tranca dos dois lados

Não é só que agora casa depois de pontuação — é que **continua não casando dentro de palavra**, que é
o propósito de haver uma fronteira. `desempre`, `imprecisao` e o `pq` explicativo no meio da frase
seguem fora, e há asserção para cada um. Sem isso, o "conserto" mais rápido (tirar a exigência) teria
transformado todos os dicionários em busca de substring.

**Arquivos:** `src/lib/cortesia.js` (o dicionário e os 26 padrões), `tests/cortesia.test.mjs` (+12),
`CLAUDE.md`, `manifest.json` (0.54.0 → **0.55.0**). 29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — O modelo é a entrega INICIAL; quem volta recebe a mensagem do momento

**Relato dele**, print do Cris: *"histórico de conversa grande provavelmente já recebeu modelo de
mensagem, vou mandar mensagem do momento"*. A caixa sugeria mandar o modelo.

### Uma causa que eu achei no caminho

`modeloJaNaConversa` comparava os **caracteres 40 a 100** do texto do modelo com as nossas
mensagens. Modelo aprovado tem variáveis (`{{1}}`, nome, cidade) — variável caindo nessa fatia faz a
comparação **nunca casar**, porque o que saiu tem o VALOR no lugar do marcador.

Agora ela quebra o modelo nos marcadores e compara o **maior pedaço literal** (mínimo 30
caracteres): pouco para dar falso positivo, curto o bastante para sobrar mesmo em modelo cheio de
variável.

### A regra que ele escolheu

`ja-respondemos-antes`: se já mandamos qualquer mensagem para o contato, o modelo perde para a
mensagem do momento. **O modelo é a entrega inicial** — quem já foi atendido e volta dizendo que
apoia não está pedindo o material de novo, está aparecendo. Modelo repetido parece que ninguém olhou
o histórico.

O sinal é `state.nossas.length > 0`, que enxerga o que saiu à mão e o que a automação da plataforma
mandou — mais que o registro de envios do painel.

### O desenho, e o contra-teste que o sustenta

**Na primeira vez o modelo vai** — é a entrega que a pessoa pediu ao clicar no anúncio. Tem teste.

Fica **abaixo de `so-expressa-apoio`, `pergunta-aberta` e `pediu-algo-sem-dizer-o-que`**: tudo que
fala do que ela acabou de dizer vem antes da mensagem da semana.

E vira **concluir** em três casos, pelo mesmo desenho da regra da reação: já respondemos hoje, a
mensagem do momento já saiu, ou não há uma configurada. Mais uma mensagem nossa em cima do que ela
ainda não comentou é empilhar.

**Alcance a observar:** quase todo contato antigo já recebeu algo nosso, então esta regra vai casar
com frequência. É o que ele pediu; se na prática o modelo deixar de sair para quem devia receber,
o ajuste é uma linha.

**Arquivos:** `src/panel/panel.js`, `src/lib/sugestao.js`, `tests/sugestao.test.mjs` (+10),
`manifest.json` (0.53.0 → **0.54.0**). 29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — "Preciso da força do senhor": a rodada mandava material de campanha

**Relato dele**, print da Mari: *"provável pedido financeiro ou trabalho, vou perguntar em que posso
ajudar? para ter certeza"*. A caixa sugeria **1: mandar o modelo "Campanha Martim2"**.

**É o pior caso do projeto, e passou o dia inteiro em aberto.** Pedido de dinheiro ou de emprego não
pode receber resposta automática (Lei 9.504/97, art. 41-A e 73 §10) — e material de campanha em cima
de quem está pedindo ajuda é pior do que não responder. A triagem que pegava isso foi removida hoje
de manhã, a pedido dele, e nada tinha ficado no lugar.

### Por que perguntar, e não responder

A frase **não diz o que ela quer**: pode ser dinheiro, emprego, ou força política na luta dela.

- **Responder** com material é o defeito da print.
- **Negar** (as respostas `pedido-ajuda`/`pedido-emprego`) ofende quem só queria apoio político — e a
  recusa só cabe depois de ela dizer o que quer.
- **Perguntar** não promete nem nega, e transforma a frase ambígua em decisão informada dele.

### O que entrou

`cortesia.pedeAlgoIndefinido` reconhece "preciso de/da", "conto com o senhor", "pode me ajudar",
"me ajuda", "estou passando por", "estou desempregado".

**A oferta desarma a mensagem inteira, ANTES de qualquer teste de pedido** — é a armadilha já
registrada: *"ajuda" é a mesma palavra dos dois lados da campanha*. "Quero ajudar" é apoiador se
oferecendo, o público principal; confundir os dois põe metade da base na fila de revisão dele. Quatro
asserções cobrem esse lado.

**Tecla 9** e a resposta `perguntar-como-ajudar` (com migração, senão não chega em quem já usa —
lição de meia hora antes). O texto **não promete nada**: nem ajuda, nem encaminhamento, nem "vou ver
o que posso fazer". Há teste que falha se ele escorregar para isso.

### Duas decisões de desenho

**A regra fica no ALTO** — posição 3 de 13. Só passam na frente a etiqueta que dispensa da fila
(decisão explícita dele) e o áudio, que precisa ser ouvido antes de qualquer decisão. **Vence a
despedida de propósito**: *"preciso da sua força, abraço"* concluído é fechar a porta na cara de um
pedido.

**A tecla 9 não conclui**, ao contrário de todas as outras que enviam texto. O caso só se resolve com
a resposta dela, e concluir tiraria o contato da fila exatamente antes disso.

**Arquivos:** `src/lib/cortesia.js`, `src/lib/sugestao.js`, `src/lib/store.js`,
`src/lib/templates.js`, `src/panel/panel.js`, `tests/cortesia.test.mjs` (+16),
`tests/sugestao.test.mjs` (+10), `tests/templates.test.mjs` (+7), `CLAUDE.md`,
`CONTEXTO.md` (a lista de ordem foi reescrita a partir do código — estava com numeração furada),
`manifest.json` (0.52.0 → **0.53.0**). 29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — "Tamojuntos" é apoio, e o critério do apoio deixa de ser tamanho

**Relato dele**, print do Izaak: última mensagem *"Tamojuntos"*, e a caixa sugeriu **concluir**.
*"nesse caso vou usar a mensagem 8, a última mensagem foi tamojuntos, seria estamos juntos"*.

E sobre o limite de 100 caracteres que eu tinha calibrado com ele minutos antes:

> *"se basear em caracteres vai dar só erro é um valor totalmente aleatório e será trocado toda hora"*

Ele está certo, e a crítica é melhor que a minha implementação.

### Duas causas

**1. Conflito de vocabulário.** `"tamo junto"`, `"tmj"` e `"estamos juntos"` estavam **nas duas
listas** — `DESPEDIDA` e `EXPRESSOES_DE_APOIO`. Como despedida é a regra 3 e apoio a 8, o apoio
nunca era alcançado. Saíram da despedida. A linha que ficou: **fecho é fecho; solidariedade é
apoio** — "valeu, abraço" encerra a conversa, "tamo junto" afirma que a pessoa está com ele.

`sucesso`, `boa sorte` e a bênção **ficaram na despedida**: ele não pediu para mexer nelas, e "Que
Deus abençoe" sozinho é fecho. Mexer no que não foi apontado é como se perde o que já estava certo.

**2. `"Tamojuntos"` vem colado**, e o padrão exigia `\s+`. Agora é `\s*`, com `tamo`/`tamos`/`segue`
somados às formas que já havia.

### O critério novo, estrutural

Fora o tamanho. **Vale quando ela escreveu mais de uma vez.**

As duas prints mostram a mesma coisa: a **primeira** mensagem é o texto pronto do anúncio (*"Olá! Eu
apoio as Escolas Cívico-Militares"*, *"Olá! Eu apoio o Flávio, Zucco e Capitão Martim"*) — ela não
escolheu as palavras, clicou num botão. Qualquer mensagem depois é ela escrevendo: o "texto de
baixo" do Ciro, o "Tamojuntos" do Izaak.

É literalmente o que ele descreveu: *"se não tivesse o texto de baixo eu mandaria o modelo,
agradeceria a atenção e encerraria"*.

### Um furo que só o teste pegou

Com a rajada colada, *"Olá! Eu apoio as Escolas"* + *"bom dia"* casava — o "apoio" estava no texto do
**anúncio**. A regra passaria a valer para qualquer um que clicasse no anúncio e escrevesse qualquer
coisa depois, que é o oposto do critério. **A primeira mensagem saiu da conta**: o apoio tem de estar
no que ela escreveu.

### Testes

Cinco asserções antigas **trocadas e não apagadas**, com o motivo: três de despedida (`tamo junto`,
`estamos juntos`, `tmj`) e duas do apoio por tamanho. Lidas sozinhas, todas soavam corretas.

**Arquivos:** `src/lib/cortesia.js`, `tests/cortesia.test.mjs`, `manifest.json`
(0.51.0 → **0.52.0**). 29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — São dois agradecimentos, e o do apoio é exceção que vence o modelo

**Dele, em duas mensagens:** *"a prioridade é responder o que foi falado depois mandar modelo"* e
*"são dois tipos de agradecimento, aqui está agradecendo o apoio é um adicional uma exceção a regra,
se não tivesse o texto de baixo eu mandaria o modelo agradeceria a atenção e encerraria"*.

### A distinção que eu não tinha entendido

Existem **dois** agradecimentos, e eu tratei como um:

| | quando | como |
|---|---|---|
| **pela ATENÇÃO** | caso normal | já sai junto com o modelo — a tecla 1 é *"modelo + agradecimento e concluir"* |
| **pelo APOIO** | exceção | tecla 8, e só quando a pessoa escreveu mensagem própria |

### Duas mudanças, e a segunda é o que torna a primeira segura

**1. A regra subiu acima de `conteudo-pedido`** — reversão do que eu fiz hoje de manhã, quando a pus
abaixo argumentando que *"agradecer antes de entregar responderia o carinho e engoliria o pedido"*.
Ele desfez, e está certo por uma razão de atendimento: quem escreveu uma mensagem própria espera
resposta àquilo. O material vai na rodada seguinte, quando não houver mais nada a responder.

**2. `soExpressaApoio` passou a exigir 100+ caracteres** (`APOIO_ELABORADO`). É isto, e não a ordem,
que impede o apoio de engolir o pedido.

Medido nas duas mensagens do Ciro: a primeira (*"Olá! Eu apoio o Flávio, Zucco e Capitão Martim"*)
tem **49** caracteres; o "texto de baixo", em que ele conta que é bolsonarista de sempre e em quem
vai votar para senador, tem **144**. Os apoios genéricos ficam todos abaixo de 50 — "apoio!" tem 6,
"conte comigo" tem 12. **100 cai no vazio entre os dois grupos**, com margem dos dois lados.

Conferido nos dois cenários: com o texto de baixo → tecla 8; sem ele → tecla 1.

### Os contra-testes

O que garante que a subida não estragou nada: **apoio longo + pergunta é pergunta**, e **apoio longo
+ pedido de material é pedido**. Responder a metade fácil e engolir a que importa é o defeito mais
caro que uma resposta automática pode ter. Áudio, despedida, pedir dados e a etiqueta que dispensa
continuam vencendo.

**Arquivos:** `src/lib/cortesia.js` (`APOIO_ELABORADO`), `src/lib/sugestao.js` (ordem e o comentário
da reversão), `tests/cortesia.test.mjs` e `tests/sugestao.test.mjs` (grupos reescritos),
`CLAUDE.md`, `CONTEXTO.md`, `manifest.json` (0.50.0 → **0.51.0**).
29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — A tecla 8 não apareceu: o texto é que nunca chegou

**Relato dele**, print da 0.48.0: *"a mensagem de agradecimento pelo apoio não foi adicionada as
opções"*, e depois *"deve ser um novo e com a tecla de acordo agradecer apoio + concluir"*.

### A causa

A tecla 8 só aparece se o texto dela existir e resolver as variáveis:

```js
if (!apoioTrava) opcoes.push({ tecla: '8', valor: 'apoio', ... });
```

Eu acrescentei `agradecer-apoio` a `DEFAULT_TEMPLATES` e paramei aí. Mas
`store.get('templates')` devolve o **array salvo inteiro** — array não se mescla por espalhamento
como `settings`. Ele já tem a lista salva (mexeu nas variações hoje), então o texto novo nunca
chegou, e a tecla desapareceu sem erro nenhum.

**A tecla não estava faltando. O texto é que nunca tinha chegado.**

### O caminho errado que eu tentei primeiro

Comecei mesclando dentro do `store.get`, por id. Funcionava — e **quebrou dois testes das
migrações que já existem**. Foi assim que descobri que o projeto já tinha resolvido isto:
`templates.garantirRespostas([ids], 'flag')`, chamada em `list()`, que *"só acrescenta o que falta,
nunca altera nem apaga o que existe"* e roda uma vez só.

Revertida a mescla; feita a migração. Uma solução por problema é melhor que duas concorrendo, e a
que estava lá tem uma propriedade que a minha não tinha: **grava**, então ele pode editar o texto
novo como qualquer outro.

### `migrarRespostaAgradecerApoio`

Flag própria (`respostaAgradecerApoio`), pelo motivo que os comentários das outras já explicavam:
reaproveitar flag antiga faria voltar resposta que ele apagou de propósito.

Nove asserções, incluindo as três que importam: não duplica quem já tem, não sobrescreve o texto
dele, e não repete na segunda chamada.

**Arquivos:** `src/lib/templates.js`, `tests/templates.test.mjs`, `CLAUDE.md`,
`manifest.json` (0.49.0 → **0.50.0**). 29 módulos sem erro, dez suítes passando.

**Ao recarregar:** a migração roda no primeiro `list()`, então a tecla 8 aparece já na primeira
abertura do painel — sem ele precisar mexer em nada.

---

## 2026-08-31 — Pular deixa de escrever no CRM

**Pedido dele:** *"ao pular tem gravado dados no crm o que faz eu perder tempo com esses contatos
que eram pra ser pulados rapidamente"*.

### O que o pulo custava

`saveClassification({ withCompletionDate: true })` em cada pulo, ou seja, por contato:

- `confirmarCidadeSePendente` — que pode **abrir a pergunta de cidade**, a espera mais longa que
  existe no meio de uma gravação;
- uma requisição por campo alterado (`writeValues`);
- mais uma de etiquetas (`applyTags`).

Numa fila de centenas, com respiro entre requisições, isso é a diferença entre passar por um
contato e parar nele.

### E o que ele gravava estava errado

`withCompletionDate: true` grava a **"Data de conclusão do contato"** — num atendimento que o
próprio motivo dizia ficar *"aberto"*. Marcava como tratado justamente quem foi deixado para
depois. Isso não apareceu como defeito porque ninguém filtra por esse campo hoje; apareceu como
lentidão.

### O que mudou

Os dois caminhos de pular (a tecla 2 da rodada e a da caixa de canal fora do ar) saem sem tocar no
CRM. O pulo automático por etiqueta já não gravava.

**Nada se perde:** o que era gravado ali era palpite do parser que ninguém tinha confirmado, e o
parser refaz tudo na próxima vez que o contato abrir. O que se perde é só a rede gasta com quem foi
pulado.

A caixa do canal fora do ar também parou de gravar **antes** de perguntar: as duas saídas dela são
pular (que não grava) e parar, então a gravação pagava o custo em 100% dos casos para servir a
nenhum. As mensagens que diziam *"classificação gravada"* foram corrigidas — texto de tela que
mente é pior que texto de tela que falta.

**Regra que fica:** saída que não trata o contato não paga escrita.

**Arquivos:** `src/panel/panel.js`, `CLAUDE.md`, `manifest.json` (0.48.0 → **0.49.0**).
29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — Rajada de links não pede formulário

**Relato dele**, print do Odone na 0.47.0 (agora sugerindo *"4: veio do anúncio e o formulário nunca
saiu para ele"*): *"eu vejo que está confuso quando é rajada de links, links em geral devem ser
ignorados, não lembro de exceções"*.

### A distinção que faltava: para quem o gesto aponta

`ultima-e-so-reacao` já tratava link como reação, mas `nunca-pediram-dados` está acima dela (subiu
hoje, com a print da Marta) e vencia. E as duas situações são opostas:

- **Emoji** é dirigido **a ele**. A Marta respondeu o anúncio com 🙏 — ali pedir os dados é o certo,
  e foi ele quem pediu isso hoje de manhã.
- **Link** é conteúdo de **outra pessoa**, passando adiante. Não diz nada sobre este contato, e
  responder a ele com um formulário é responder a coisa errada.

`cortesia.ehRepasse` separa os dois: link sozinho e vídeo são repasse; emoji, texto e áudio não.
Link **com** texto junto também não é — ela escreveu algo.

`nunca-pediram-dados` passou a exigir `!rajadaEhSoRepasse`. O Odone cai de volta na tecla 5
(mensagem do momento), e a Marta continua na 4 — há teste para os dois.

### O outro problema, que a mesma print mostra e o código não resolve

O Odone tem **Cidade: Santa Catarina**, e o painel já avisa: *"não casa com nenhum dos 497
municípios do RS"*. Como as etiquetas de cidade só existem para municípios do RS,
`temEtiquetaDeCidade` é **falso para sempre** nele — e seria assim em todo contato de fora do
estado.

Sem o conserto acima, ele apareceria pedindo formulário em **toda** rodada, para sempre.

**Isso ele resolve sem código:** o contato já carrega a etiqueta **FORA DO RS**, e a aba
Automatizado tem *"Etiquetas que a rodada pode pular"* (hoje com "engajado"). Somar `fora do rs` ali
tira esses contatos da fila de uma vez. Não fiz por conta própria porque é decisão de negócio —
pode haver razão para continuar falando com quem mora fora e vota aqui.

**Arquivos:** `src/lib/cortesia.js` (`ehRepasse`, `rajadaEhSoRepasse`), `src/lib/sugestao.js`,
`src/panel/panel.js`, `tests/cortesia.test.mjs` (+10), `tests/sugestao.test.mjs` (+3),
`manifest.json` (0.47.0 → **0.48.0**). 29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — "76 mensagens somando 3254 caracteres": a rajada somava o arquivo morto

**Relato dele**, print do Odone na 0.46.0: *"não fez sentido nenhum a sugestão, explique"*. A caixa
dizia *"6: escreveu 76 mensagens somando 3254 caracteres — é conversa, não é caso de modelo"*.

**Defeito meu, do mesmo dia**, na regra da rajada.

### A explicação

`rajadaFinal` parava numa coisa só: a nossa última mensagem. E tinha esta linha:

```js
if (!nossaUltimaAt) return lista;   // nunca respondemos → a rajada é TUDO
```

O Odone compartilha vídeo o dia todo e nunca foi respondido. Então a "rajada" dele era o histórico
inteiro — **76 mensagens acumuladas ao longo de semanas**, somando 3.254 caracteres. Passou dos 400
e virou "conversa".

**A conta que denuncia: 3254 ÷ 76 = 43 caracteres por mensagem.** São links e repasses, não
parágrafos. Uma conversa de verdade tem 150+ por mensagem — o caso que criou a regra tinha três
mensagens de 250, 55 e 145 caracteres em dois minutos.

**O erro foi de definição, não de número.** Eu tratei *"tudo que não respondemos"* como se fosse
*"tudo que ela escreveu de uma vez"*. São coisas diferentes, e o que as separa é o relógio.

### O conserto

A rajada agora para em **duas** coisas: a nossa última mensagem **e** um buraco de mais de 30
minutos entre duas mensagens dela. Meia hora é folga larga para quem escreve devagar, e ainda
separa isso de quem manda uma coisa hoje e outra amanhã.

No caso do Odone a rajada passou de 76 para **1**, e a sugestão saiu da tecla 6.

Mensagem sem `at` não quebra a corrente: sem horário não dá para afirmar que houve buraco, e o lado
seguro é manter na rajada.

### Duas asserções antigas trocadas, não apagadas

*"sem nossa mensagem, a rajada é tudo"* passou a `=== 2`, com o motivo no comentário. É o que
impede alguém de "consertar" a definição de volta em um mês — e hoje mesmo isso aconteceria, porque
a frase antiga soa correta lida sozinha.

**Arquivos:** `src/lib/cortesia.js` (`INTERVALO_DA_RAJADA_MS`, `rajadaFinal`),
`tests/cortesia.test.mjs` (+9, 1 trocada), `CLAUDE.md`, `manifest.json` (0.46.0 → **0.47.0**).
29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — Vídeo compartilhado sai da fila de "responder à mão"

**Relato dele**, print do Odone: reel do Instagram e vídeo do Facebook de 631 mil visualizações. A
caixa sugeria *"6: mandou um vídeo — só dá para responder depois de abrir. Responda à mão"*.

> *"são centenas de mensagens e crescendo, não existe essa de parar pra ver vídeos e responder, é
> ignorar dando bom dia ou enrolar com outro assunto"*

### A distinção que faltava

`VIDEO` estava em `TIPOS_QUE_PEDEM_VOCE`, junto do áudio. Mas **a diferença é quem está falando**:

- **Áudio** é a pessoa gravando *para ele*. O caso que criou essa regra foi 1min13 sobre a família e
  a igreja — mandar modelo aprovado ali parece deboche.
- **Vídeo** é conteúdo de terceiro chegando pela décima vez no dia. Abrir cada um não escala, e não
  abrir não ofende ninguém.

`VIDEO` foi para `TIPOS_COMPARTILHADOS` (antes `TIPOS_DE_IMAGEM`), junto de figura e figurinha — ou
seja, passa a ser tratado como **reação**: mensagem do momento, ou concluir se já respondemos hoje.
Que é exatamente o "dar bom dia ou enrolar com outro assunto" da frase dele.

Ficaram em `TIPOS_QUE_PEDEM_VOCE` o que a pessoa produziu ou endereçou a ele: **áudio, arquivo,
contato e localização**.

### Um defeito de tela que apareceu junto

O rótulo era `tipo === 'AUDIO' ? 'um áudio' : tipo === 'VIDEO' ? 'um vídeo' : 'um arquivo'` — então
contato e localização apareciam como *"mandou um arquivo"*. Virou um mapa `NOME_DO_TIPO`, e agora
cada um se chama pelo nome.

### A trava que mantém isto seguro

**Vídeo COM texto longo junto continua pedindo resposta à mão** — o texto é que manda, e o teste
trava isso. Quem grava um vídeo e escreve três parágrafos junto não está repassando meme.

A asserção antiga (*"vídeo também"* pede) foi **trocada e não apagada**, com o motivo no comentário:
é o que impede alguém de "consertar" isto de volta daqui a um mês.

**Arquivos:** `src/lib/cortesia.js`, `tests/cortesia.test.mjs` (+11 e 1 revertida), `CLAUDE.md`,
`manifest.json` (0.45.0 → **0.46.0**). 29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — Tecla 8: agradecer o apoio. E o "pq" que eu tinha quebrado

**Relato dele**, print do Ciro: *"esse é um caso comum até onde a pessoa só expressa o apoio, ja tem
as etiquetas, então é só uma questão de agradecer o apoio e carinho, teria que ter mais um botão pra
isso"*.

### Primeiro, o bug que a print revelou

A faixa da caixa dizia *"fez uma pergunta que nenhuma resposta pronta responde"* — e não havia
pergunta nenhuma. O casamento foi no **"pq"** de *"ficou muito grato pq sou Bolsonaro desde
sempre"*: conjunção explicativa, um dos usos mais comuns do português de WhatsApp.

**Regressão minha, de uma hora antes.** A regra `pergunta-aberta` estava tirando da automação
justamente quem só agradecia — o oposto do que ela existe para fazer.

O conserto: a avaliação passou a ser **mensagem por mensagem** (colado, o começo de uma virava o
meio de uma frase gigante), e o padrão só conta como pergunta se a mensagem **tem interrogação** ou
se ele está no **começo** dela. Quem pergunta abre com a pergunta ou marca com "?"; quem explica põe
o "pq" no meio do que está contando. Sete asserções travam os dois lados.

### O botão

Template de fábrica novo, `agradecer-apoio` ("Agradecer o apoio e encerrar"), com duas variações
como os outros. **Separado do `agradecer-info`** de propósito: aquele agradece *informações*
("recebemos tudo por aqui"), e usá-lo em quem escreveu "sou Bolsonaro desde sempre" responde outra
conversa.

Ele **não pede nada e não promete nada** — nem grupo, nem material, nem dados. Quem só quis dizer
que está com você não pediu tarefa; mandar uma vira cobrança em cima de um agrado.

### A regra, e a asserção que é a regra inteira

`cortesia.soExpressaApoio` reconhece "apoio", "conte comigo", "vou votar", "sou seu eleitor",
"parabéns/sucesso/força", bênção, "torcendo".

**Quem decide é o que NÃO está na mensagem.** Apoio junto com pergunta é pergunta; junto com pedido
de material é pedido. Reusa `conversaTemPerguntaAberta` e `PEDIDO_DE_MATERIAL` em vez de repetir as
listas — duas listas para a mesma pergunta divergem na primeira vez que uma é ajustada sozinha.

**A regra fica ABAIXO de `conteudo-pedido`, e isso é o desenho todo:** quem clicou no anúncio e
ainda não recebeu o material recebe o material. Só depois de entregue (ou não havendo modelo) é que
"obrigado pelo apoio" é o desfecho — e `conteudo-pedido` já testa `enviadoHoje` e
`modeloJaNaConversa` sozinho. **Agradecer antes de entregar responderia o carinho e engoliria o
pedido.**

**Arquivos:** `src/lib/cortesia.js` (conserto do `pq` + `soExpressaApoio`), `src/lib/sugestao.js`,
`src/lib/store.js` (o template), `src/panel/panel.js` (tecla e envio),
`tests/cortesia.test.mjs` (+18), `tests/sugestao.test.mjs` (+9), `CONTEXTO.md`,
`manifest.json` (0.44.0 → **0.45.0**). 29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — A lista dos casos sem regra, que é a lista das regras a escrever

**Dele:** *"refinar até sobrar pouca indecisão"*.

O contador do commit anterior diz **quanto** sobrou. Para escrever a regra seguinte ele precisa
saber **o quê** — e vinte linhas espalhadas no meio de cem passam batidas.

### O que a rodada mostra agora, no fim

```
? — a refinar —  7 caso(s) que nenhuma regra reconheceu. Vários iguais = uma regra nova:
? Marta Ferreira  última mensagem: "🙏🙏"
? Clair           última mensagem: "Porque?"
? José            última mensagem: "(AUDIO)"
```

Lidos **juntos**, o padrão aparece: seis casos iguais são uma regra, não seis decisões. Foi assim
que as três regras de hoje nasceram, só que a partir de prints que ele mandou uma por uma.

`state.auto.semRegra` virou um `Map` guardando `{nome, texto, tipo}` — a última mensagem **com
texto** do contato, cortada em 120 caracteres. Continua sendo escrito num ponto só, logo depois de
`sugerirAcao`.

### Dois detalhes que evitam armadilha

- **`refinar` é resultado próprio, não `'pulado'`.** Estas linhas entram DEPOIS de o resumo estar
  montado; reusar um resultado que o resumo conta deixaria uma bomba armada para quem mover a ordem
  dessas duas coisas um dia. Ele também não está em `SAI_DA_FILA` nem no limite da rodada.
- **`aviso` ganhou sinal (`⚠`) junto.** Já era usado em outro lugar e caía no `·` genérico do
  fallback desde então.

**Arquivos:** `src/panel/panel.js`, `manifest.json` (0.43.0 → **0.44.0**).
29 módulos sem erro, dez suítes passando.

**Como usar:** rode uma rodada, leia a lista do fim. Situação que aparece três vezes é regra nova em
`sugestao.js`; situação que aparece uma vez e é única mesmo é caso da IA. Essa separação é o que
decide onde vale gastar o próximo esforço — e é ela que diz quando "sobrou pouca indecisão".

---

## 2026-08-31 — "Reconhecer pela falta de opções": o sinal já existia e a tela o escondia

**Pedido dele:** *"não sera criado etiqueta pra isso terá que reconhecer isso pela falta de
opções"* — recusando a tecla 8 com etiqueta que eu tinha feito meia hora antes, e que foi
**revertida**.

Ele está certo, e por uma razão que eu tinha na frente: `sugerirAcao` já devolve `null` quando
nenhuma regra casa, e o próprio comentário da função chama isso de *"resposta legítima e comum"*.
O sinal existia. Criar etiqueta seria pôr um rótulo permanente na base de eleitores para registrar
o que o painel **já sabe** no instante em que desenha a caixa.

### O que mudou

**A caixa deixa de ficar calada.** Sem recomendação, ela agora mostra *"Nenhuma regra reconheceu
este caso — a decisão é sua."*, numa faixa **cinza** e não na azul do destaque: azul quer dizer
"aperte esta tecla", e usar a mesma cor para "não sei" ensinaria a ignorar as duas.

Antes disto, "a rodada não sugeriu nada" era visualmente idêntico a "a rodada não olhou".

**O resumo da rodada passa a contar**: *"…, 7 que nenhuma regra reconheceu"*. É a medida de
cobertura, de graça e sem tocar no CRM — cada um desses é um contato que o determinístico não
resolveu. A conta encolhendo, rodada após rodada, é o refinamento funcionando, e é ela que diz
quando vale ligar a IA, que custa por contato avaliado.

### A decisão de implementação que importa

A marca é escrita num **ponto só**, logo depois de `sugerirAcao`, em `state.auto.semRegra`. Minha
primeira versão propagava um campo `semRegra` pelo `return` — e cobria **um** caminho de saída
entre os vinte que o tratamento de um contato tem. Ficaria errada no dia em que alguém
acrescentasse o vigésimo primeiro, e errada em silêncio.

É um `Set` por id de atendimento, não um contador: a fila devolve o concluído ao topo (está no
`CLAUDE.md`), o mesmo contato pode passar duas vezes, e contar duas vezes inflaria a medida
justamente no caso que já dá trabalho.

### É aqui que a IA entra

No branch `claude/whatsfill-ia`, `sugestao === null` é o gatilho da avaliação, e **o lugar dela na
tela é exatamente esta faixa cinza** — a IA substitui "nenhuma regra reconheceu" por uma
recomendação de verdade. Que é o plano dele: refinar o determinístico até sobrar pouco, e só o que
sobrar custar token.

**Arquivos:** `src/panel/panel.js`, `src/panel/panel.css`, `manifest.json` (0.42.0 → **0.43.0**).
29 módulos sem erro, dez suítes passando. A tecla 8 e `etiquetaParaIA` não existem mais.

---

## 2026-08-31 — Pergunta específica: a rodada parava de mandar modelo em cima dela

**Relato dele**, print da Clair: *"pergunta especifica, caso para IA"*. Ela respondeu o formulário
("Clair portella, Santa Maria") e depois escreveu *"Quero dar uma opinião, tem muita propaganda
aqui em santa Maria, mas não do capitão Martins."* seguido de *"Porque?"*.

Simulei antes de mexer: a rodada sugeria **tecla 1, mandar o modelo "Campanha Martim2"** — material
de campanha como resposta a uma pergunta sobre a falta de material de campanha.

### Por que nenhuma regra pegava

- rajada de **126 caracteres**, longe dos 400 da regra de texto longo
- não é reação, não é despedida
- já pediram dados, já tem cidade
- há conteúdo mapeado (ADS) → `conteudo-pedido` venceu

### A regra, e por que ela é curta

`cortesia.conversaTemPerguntaAberta` casa **só razão e posição**: "por que"/"pq"/"por quê", "qual a
posição/opinião", "o que ele acha/pensa/vai fazer", "me explica", "não entendi". São as que
dependem do que ele pensa, e para as quais não existe texto pronto.

**Toda entrada nessa lista tira um contato da automação**, e a meta dele é 90% resolvido sem IA —
por isso ela é curta, e por isso *pedido de material sai antes de tudo*: "pode me mandar o
material?" também é pergunta, e o modelo a responde bem.

Os testes que importam são os sete falsos positivos, não o caso da print: "tudo bem?", "quero
ajudar", "me manda o link", "quero receber", "bom dia". Todos continuam indo para onde iam.

`pergunta-aberta` entra na **posição 7**, logo acima de `conteudo-pedido` e não mais alto de
propósito: é o mínimo para resolver o caso. Etiqueta que dispensa, áudio, despedida e pedido de
dados continuam vencendo — todas já estavam certas.

### Onde isto acaba e a IA começa

Igual ao caso do alerta político mais cedo: **a rodada acerta a TECLA** (6, à mão) e para de mandar
a mensagem errada. Reconhecer que a pergunta é sobre distribuição de material em Santa Maria, e
propor o que responder, continua sendo da IA. Ele está certo em chamar de "caso para IA" — o que o
determinístico faz aqui é impedir o dano, não resolver.

### Um bug do meu regex, pego pelo teste

`o que vocês **vão** fazer` não casava: eu tinha "vai" e esqueci "vão". Corrigido junto com
"pretendem", "acham", "pensam", "farão".

**Arquivos:** `src/lib/cortesia.js` (`conversaTemPerguntaAberta`, `PERGUNTAS_QUE_PEDEM_VOCE`,
`PEDIDO_DE_MATERIAL`), `src/lib/sugestao.js` (a regra), `src/panel/panel.js`,
`tests/cortesia.test.mjs` (16 asserções), `tests/sugestao.test.mjs` (7),
`CONTEXTO.md`, `manifest.json` (0.41.0 → **0.42.0**).
29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — Emoji como única mensagem de quem veio do anúncio: pedir dados vence

**Relato dele**, print da Marta: contato do anúncio, etiqueta ADS, **cidade vazia**, uma única
mensagem — 🙏, às 18:24. A caixa sugeria *"5: a última mensagem foi só uma figura, emoji ou link"*.
*"nesse caso a pessoa respondeu o anuncio com um emoji, eu tenho que pedir os dados"*.

### Causa

`ultima-e-so-reacao` estava na posição 5 e `nunca-pediram-dados` na 6. A primeira que casa vence,
e o emoji casou antes.

A ordem antiga tinha razão escrita no comentário: *"responder um 👍 com 'me manda seu nome e
cidade' lê como robô que não olhou a tela"*. **Continua verdade — para quem já tem conversa.**

### O conserto, e por que trocar a ordem é seguro

As duas trocaram de lugar. O que impede isso de estragar o caso que criou a regra da reação é a
**condição** da regra que subiu:

```js
!c.jaPediramDados && !c.temEtiquetaDeCidade && c.podePedirDados && !c.pedidoHoje
```

Quem já recebeu o formulário, ou já tem cidade, ou já foi perguntado hoje **não casa nela** e
continua caindo na reação, exatamente como antes. O que muda é só o caso da print: alguém que
acabou de chegar do anúncio, sem cidade, que nunca foi perguntado. Ali não há conversa para o robô
estragar — perguntar é o primeiro passo, e a tela não tem mais nada a olhar.

### Os quatro contra-testes

O teste que importa não é o da print, é o que trava a inversão de ir longe demais. Todos passando:

| situação | antes | agora |
|---|---|---|
| emoji, do anúncio, sem cidade, **nunca** pediram | 5 | **4** |
| emoji, **já** pediram dados | 5 | 5 |
| emoji, **já tem** cidade | 5 | 5 |
| emoji, pedido **hoje** | 5 | 5 |
| áudio no meio | 6 | 6 |

**Arquivos:** `src/lib/sugestao.js` (ordem e os dois comentários),
`tests/sugestao.test.mjs` (6 asserções), `CONTEXTO.md` (a lista de ordem estava desatualizada),
`manifest.json` (0.40.0 → **0.41.0**). 29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — Nome errado no CRM: separar para ele arrumar, sem trocar nada

**Relato dele**, print do "viver a vida": o cadastro tinha nome de perfil, a pessoa respondeu
*"Daniel Ribeiro/Canoas"* logo depois de o atendimento ser concluído. *"tem duas opções ou trocar o
nome pela extensão ou separar esse contato deixando para o final e eu mesmo arrumar"*.

**Ele escolheu separar.** O nome nativo do contato não é tocado em lugar nenhum.

### O que a investigação mudou na pergunta

Antes de propor, três coisas apareceram e nenhuma era óbvia:

1. **São dois campos "nome" diferentes.** O que aparece no topo do CRM é `contact.name`, nativo,
   vindo do WhatsApp. Separado dele existe um campo personalizado **"Nome"**, que é o que a
   extensão grava e usa em variáveis e etiquetas.
2. **Corrigir o nativo exige rota que a extensão nunca executou** — não há escrita de contato em
   `api.js`, só de etiqueta. Seria descobrir no bundle do Angular, com as duas armadilhas já
   registradas sobre isso.
3. **O parser já resolve a leitura.** `extract(['Daniel Ribeiro/Canoas'], {respostaAoPedido:true})`
   devolve cidade Canoas (exata) e nome Daniel Ribeiro. Nada a fazer ali.

### A regra

`vars.nomeDivergeDoInformado(cadastro, informado)`, pura e testada. **Divergir não é ser
diferente** — três casos que não contam, e cada um encheria a fila de revisão de contato certo:

- **um contém o outro** — "Daniel" x "Daniel Ribeiro" é a mesma pessoa dando o nome completo;
- **acento e caixa** — "JOSE" x "José" resolvem para a mesma pessoa;
- **cadastro de anúncio ou vazio** (`looksLikePlaceholder`) — é buraco, não contradição, e buraco o
  parser preenche sozinho como sempre fez.

`nomeSemSentido` **não serve aqui**, e é o detalhe que muda o desenho: "viver a vida" tem vogais e
não é placeholder, então passa nele. É a DIVERGÊNCIA que denuncia, não a forma do cadastro.

### Onde ela se liga

Sai por `tags.suggest` como as outras, com **`origem: 'revisão'`** e não `'conteúdo'`: conteúdo
alimenta a tabela "Modelo por conteúdo" e viraria modelo a enviar — mandar a campanha para quem
está na fila de conserto de cadastro é o tipo de coisa que ninguém percebe até acontecer.

A comparação usa **o palpite do parser** (`state.nomeInformado`), não o rascunho. O rascunho não
serve: quando o campo "Nome" está vazio ele é semeado com o próprio `contact.name`, então comparar
os dois daria "igual" justamente no caso que interessa. `state.nomeInformado` é limpo na troca de
contato — sem isso a etiqueta cairia na pessoa errada, que é a armadilha já registrada da pergunta
de cidade.

Etiqueta configurável na aba Automatizado, **vazia por padrão**: precisa existir no CRM, e a
extensão não cria etiqueta sozinha.

### Um bug meu, achado pelo teste que eu quase não escrevi

`achatarNome` saiu do meu script com as barras invertidas comidas: `\s` virou a letra **s**
literal, e `.replace(/s+/g, ' ')` apagava todo "s" dos nomes. "Maria Souza" virava "maria ouza".
Nove das dez asserções passavam assim — só o caso de pontuação ("Daniel R. Ribeiro" x "Daniel R
Ribeiro") acusou. Sem ele, isto teria ido para produção comparando nomes mutilados.

### Arquivos

`src/lib/vars.js` (`nomeDivergeDoInformado`, `achatarNome`), `src/lib/tags.js` (a sugestão),
`src/lib/store.js` (`etiquetaNomeDivergente`), `src/panel/panel.js` (detecção, estado e Config),
`tests/vars.test.mjs` (10 asserções), `manifest.json` (0.39.0 → **0.40.0**).
29 módulos sem erro, dez suítes passando.

**Para funcionar, ele precisa criar a etiqueta no CRM e escrever o nome dela na aba Automatizado.**
Vazio, a extensão não marca ninguém.

---

## 2026-08-31 — "A sugestão está totalmente errada aqui": três mensagens curtas são uma conversa

**Relato dele**, print do Ipê: a caixa sugeria *"1: pediu 'ADS' e há modelo mapeado — mande"* para
um apoiador que tinha acabado de escrever, em três mensagens, um alerta político — que gente paga
poderia estar se passando por apoiador do candidato, e que tomassem cuidado.

*"isso seria um exemplo onde a ia teria que assumir pra responder"*.

### O que eu quase consertei errado

Meu primeiro palpite foi que a etiqueta **ADS** estava mal classificada: ela é origem de anúncio, e
`tags.js` a emite como `origem: 'conteúdo'`. Fui ler o comentário antes de mexer, e ele diz que é
**pedido dele de 31/08** (*"adicionar a etiqueta ADS resolve tudo"*), de propósito, para alimentar a
tabela "Modelo por conteúdo". Não era bug — e "consertar" ali teria quebrado o que ele pediu de
manhã.

### A causa raiz

A regra que **deveria** ter vencido existe e está acima: `ultima-pede-resposta-pessoal` (tecla 6),
que pega áudio, vídeo e texto de 400+ caracteres. Ela não casou porque olhava
`lista[lista.length - 1]` — **só a última mensagem**.

O contato escreveu três, em dois minutos: ~250 + ~55 + ~145 caracteres. Cada uma abaixo de 400, o
conjunto em ~450. A rodada desceu a lista e caiu em `conteudo-pedido`.

**Que os parágrafos venham numa mensagem ou em três é jeito de digitar, não intenção** — e era só
isso que separava este caso do áudio de 1min13 que a mesma regra já pegava.

### O conserto

`cortesia.conversaPedeRespostaPessoal(entrantes, nossaUltimaAt)` soma a **rajada**: as entrantes que
chegaram depois da nossa última mensagem. Para isso, `api.js` passou a devolver `at` em cada
entrante — sem horário, `entrantes` era uma lista sem antes e depois.

Decisões dentro dele:

- **Tipo vence tamanho, em qualquer posição da rajada.** Áudio no meio pede você mesmo que o resto
  seja curto.
- **Sem `nossaUltimaAt`, a rajada é tudo.** Nunca respondemos, nada foi respondido: está certo.
- **Mensagem sem `at` entra na rajada.** Pôr de fora baixaria a soma e traria o modelo de volta —
  que é o defeito que isto conserta.
- O motivo na tela diz quantas mensagens foram, porque *"escreveu 3 mensagens somando 450
  caracteres"* explica a recomendação de um jeito que *"escreveu 145 caracteres"* não explicaria.

`ultimaPedeRespostaPessoal` fica: é pura, testada, e a nova a usa por dentro para o teste de tipo.

### Onde ele está certo sobre a IA

O determinístico acerta a **tecla** — para de sugerir o modelo e manda responder à mão. O que ele
não faz é entender que aquilo é um alerta e não uma reclamação, nem propor o que responder. Essa
metade é da IA, e é o caso de uso dela: não é escolher entre respostas prontas, é reconhecer que
nenhuma serve. A tecla 6 já era o destino certo; a IA vai mudar o que acontece **depois** dela.

### Arquivos

`src/lib/cortesia.js` (`rajadaFinal`, `conversaPedeRespostaPessoal`), `src/lib/api.js` (`at` em cada
entrante), `src/panel/panel.js`, `tests/cortesia.test.mjs` (10 asserções novas, com o caso da print
como regressão), `CLAUDE.md`, `CONTEXTO.md`, `manifest.json` (0.38.1 → **0.39.0**).

**Convenção de versão corrigida no mesmo commit.** Eu havia documentado "versão sempre maior no
branch da IA" e a quebrei em seguida: subi produção para 0.39.0, que é onde a IA já estava. Regra
que exige alguém lembrar não é regra. Agora a **série** separa os dois — produção **0.x**, IA
**1.x** — e não há nada a lembrar.
29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — Os dois branches passam a estar escritos, e a armadilha da pasta única

**Pedido dele:** *"resolva"*. A outra metade do trabalho — o merge está registrado no
`registro.md` do branch `claude/whatsfill-ia`.

### O que estava errado

O `CONTEXTO.md` afirmava: *"branch `claude/extensao-claude-analise-i9spxw` (é o único deste
repo)"*. Não é — existe `claude/whatsfill-ia`, com a avaliação por IA. E o `CLAUDE.md` não
mencionava branch nenhum.

**Por que isso paga o próprio custo:** o `CONTEXTO.md` existe justamente para abrir uma aba nova
sem redescobrir nada. Uma sessão que lesse "é o único" e recebesse um pedido de IA faria uma de
duas coisas ruins — refazer do zero o que já existe, ou **implementar a IA neste branch**, que é
exatamente o que ele não quer (a regra "Sem IA na extração" é deste branch).

### A armadilha que veio junto

As duas extensões carregam da **mesma pasta** (`OneDrive/Documents/GitHub/WhatsFill`, confirmado
no `Secure Preferences` do Chrome). Dar checkout no branch da IA troca a extensão de produção pela
da IA sem avisar ninguém. Em 29/08 isso aconteceu e pareceu que a IA tinha vazado para produção;
o diagnóstico correto levou uma varredura nos dois branches para descobrir que **nenhum estava
errado — a pasta tinha duas árvores misturadas**.

Os dois sinais que dizem qual está no ar, e por isso são mantidos de propósito:

- o **nome**: `WhatsFill` aqui, `WhatsFill+IA` lá
- a **versão**: sempre maior no branch da IA (hoje 0.39.0 contra 0.38.0 daqui)

O sintoma da árvore misturada é `git status` acusando arquivo que ninguém editou (foram 17). E o
conserto **não** é apagar o arquivo órfão à mão: ele volta no próximo checkout, e um commit
descuidado apaga o trabalho do outro branch. É `git restore .` + checkout do branch certo.

**Arquivos:** `CLAUDE.md` (cabeçalho dos branches + a armadilha), `CONTEXTO.md` (a afirmação
corrigida), `manifest.json` (0.38.0 → **0.38.1**).

Onze suítes não se aplicam aqui — este branch tem dez, e as dez passam. 29 módulos sem erro.

---

## 2026-08-31 — A pergunta que ELE fez também é contexto
## 2026-08-31 — Este branch passa para a série 1.x

A versão daqui tinha subido para 0.39.0 no merge, e no mesmo dia produção chegou a 0.39.0 também —
as duas colidiram. A convenção era *"versão sempre maior no branch da IA"*, e ela durou algumas
horas: **regra que exige alguém lembrar não é regra**.

Agora a **série** separa os dois, e não há nada a lembrar:

| branch | nome | versão |
|---|---|---|
| `claude/extensao-claude-analise-i9spxw` | `WhatsFill` | **0.x** |
| `claude/whatsfill-ia` | `WhatsFill+IA` | **1.x** |

Isto importa porque as duas extensões carregam da **mesma pasta**: dar checkout aqui troca a
extensão de produção sem avisar ninguém, e o nome mais a série são os únicos sinais no cabeçalho do
painel que dizem qual está no ar.

`manifest.json` 0.39.0 → **1.0.0**. Nada de código mudou.

---

## 2026-08-31 — Produção entra no branch da IA: 31 commits de atraso, zerados

**Pedido dele:** *"resolva"* — as duas coisas que eu tinha levantado: o branch da IA estava
congelado em 29/08 e nenhum dos dois arquivos de contexto dizia que ele existe.

### O merge

Base comum: `0ca18fd`. O branch da IA tinha 6 commits próprios; produção havia andado **31**.
Merge de `claude/extensao-claude-analise-i9spxw` para cá, e o resultado foi melhor do que o
tamanho sugeria: `store.js` e `background.js` fizeram **auto-merge**, e só 4 arquivos conflitaram.

**Zero linhas de produção se perderam** — conferido arquivo por arquivo (`git diff` contra o
branch de produção, contando as linhas `-`): `panel.js`, `background.js`, `tags.js`, `extract.js`
e `cities.js` deram 0. As duas únicas remoções em `store.js` são a minha própria mudança na mescla
de defaults, que substituiu a linha antiga.

### Os quatro conflitos, e a decisão em cada um

| arquivo | decisão |
|---|---|
| `panel.js` (imports) | tudo de produção + os dois imports da IA; o de `triagem.js` **saiu** |
| `panel.js` (bloco da triagem) | lado de produção — a triagem foi removida a pedido dele em 29/08 |
| `manifest.json` | nome `WhatsFill+IA`, versão **0.39.0** (acima da 0.38.0 de produção) |
| `CLAUDE.md` | lado de produção, que traz o aviso do `node --check`; somei `ia.test.mjs` |
| `registro.md` | **os dois** históricos, em ordem cronológica |

**A versão é 0.39.0 de propósito.** As duas extensões carregam da mesma pasta, então o número no
cabeçalho do painel é o que diz qual das duas está no ar. Número menor aqui do que em produção
faria a conferência mentir justamente quando ele trocasse de branch.

### O que a remoção da triagem custou aqui, e está documentado no código

A IA, ao **escalar**, aplicava a etiqueta de triagem — era ela que deixava o contato achável no
filtro do CRM depois. Sem a triagem, escalar deixa rastro só no log da rodada, que some quando o
painel fecha. Está comentado no ponto exato (`panel.js`, caminho do `escalar`), dizendo que é
consequência da remoção e não esquecimento, e onde a etiqueta entra se ele voltar a querer.

### A outra metade: os branches agora estão escritos

O `CONTEXTO.md` de produção afirmava que o repositório tem **um branch só**. Uma sessão futura
leria isso e refaria a IA do zero — ou pior, a implementaria de novo em produção, que é
exatamente o que ele não quer. O `CLAUDE.md` daqui já trazia o cabeçalho certo e sobreviveu ao
merge; a correção do lado de produção vai em commit separado, no branch dele.

**Estado:** 31 módulos sem erro de sintaxe, **onze suítes** passando (as dez de produção mais a
da IA), `triagem.js` ausente nos dois branches.

**Pendência que continua de pé:** a IA nunca fez uma chamada real. Sem chave salva, `iaChave`
não existe no storage e o contador está em `{chamadas: 0}`. O teto de US$ 20/mês e o `effort`
seguem sem prova ao vivo.

---

## 2026-08-31 — A pergunta que ELE fez também é contexto
## 2026-08-29 — Haiku como padrão, e o alarme falso de cache que vinha junto

**Pedido:** *"vou testar com o haiku somente os outros tem custo alto"*.

Trocado o padrão para `claude-haiku-4-5` em três lugares (`MODELO_PADRAO`, `store.ia.modelo`, o
fallback do seletor). Padrão importa mais do que parece: quem liga a IA sem abrir o seletor roda
no padrão, e deixar o Opus 5 ali custaria ~4× o que ele escolheu.

### O que a medição derrubou

Ao conferir se o Haiku aguentava o que a extensão manda, medi o prompt de sistema de verdade
(função pura, dá para medir offline): **~1.300 tokens** com as 11 respostas de fábrica. O
`CLAUDE.md` afirmava **~3.700**, e foi esse número que me fez estimar o custo 3× alto na entrega
anterior. Corrigido nos dois lugares.

### O alarme falso que isso ia criar

O mínimo de prefixo para o `cache_control` valer **não cresce com a geração**: 512 no Opus 5,
1.024 no Sonnet 5, **4.096 no Haiku 4.5**. Com ~1.300 tokens, o Haiku fica a um terço do mínimo —
o cache **não pega, e não pega em silêncio**: `cacheLido: 0`, sem erro nenhum.

O problema não é o custo (com prompt pequeno, perder o cache dói pouco). O problema é que o painel
**ensina que "SEM CACHE" em chamadas seguidas é sinal de problema**, e no Haiku isso apareceria em
100% das chamadas estando tudo certo. Ele veria o alarme na primeira rodada e concluiria que a IA
está quebrada — ou, pior, aprenderia a ignorar o alarme, que aí não toca no dia em que é de
verdade. `CACHE_MINIMO_TOKENS` + `vaiCachear` existem para a tela dizer a verdade: no Haiku o log
mostra `sem cache (esperado)` e o aviso do seletor explica por quê, com o número.

### Custo remedido, por mil contatos AVALIADOS

Não por contato da base: a regex roda antes e a IA só vê o que sobrou.

| Modelo | Cacheia? | Custo/mil | Teto de US$ 20 compra |
|---|---|---|---|
| Haiku 4.5 | não (mín. 4.096) | ~US$ 2,50 | ~8.000 |
| Sonnet 5 | sim | ~US$ 4,50 | ~4.400 |
| Opus 5 | sim | ~US$ 11 | ~1.800 |

O Haiku segue sendo o mais barato com folga **mesmo sem cache** — justamente porque o prompt é
pequeno. Se um dia o catálogo dele passar de 4.096 tokens, o cache do Haiku liga sozinho e a conta
cai para ~US$ 1,20/mil; não vale forçar isso agora.

Confirmado também que o Haiku 4.5 **suporta structured outputs** (`output_config.format`), que é o
que garante o JSON da decisão. Sem isso, toda decisão viraria `incerto` e o teste seria inútil.

### Testes acoplados ao padrão

Dois testes de `effort` montavam a requisição **sem** nomear o modelo, herdando o padrão. Com o
padrão virando Haiku (que não recebe `effort`) eles quebraram — e teriam parado de testar o que
dizem testar se eu tivesse só ajustado a asserção. Agora nomeiam `claude-opus-5` explicitamente.
Lição: teste que herda o padrão testa o padrão, não o comportamento.

**Arquivos:** `src/lib/ia.js`, `src/lib/store.js`, `src/panel/panel.js`, `tests/ia.test.mjs`,
`CLAUDE.md`, `manifest.json` (0.15.0 → **0.16.0**).

**Pendências:** segue sem nenhuma chamada real. O primeiro teste no "Thiago Tim" confirma três
coisas de uma vez: JSON inteiro de volta, contador subindo, e o log dizendo
`sem cache (esperado)` em vez de `SEM CACHE`.

---

## 2026-08-29 — Teto de gasto da API, e o mal-entendido que o motivou

**Pedido:** *"a ligação de api eu usaria meu plano aqui então teria que ver a questão de gasto,
não deve passar dos valores já acertados do plano"*.

### A correção que vem antes do código

**A assinatura Claude Pro/Max não cobre a API.** São duas cobranças diferentes: a assinatura é do
claude.ai e do Claude Code; a chave `sk-ant-…` é pré-paga por token, com fatura própria no
`console.anthropic.com`. Não existe "usar meu plano" na extensão — cada avaliação gera despesa
**nova em cima** do que ele já paga. O pedido era, na prática, "não me dê uma fatura que eu não
esperava", e é isso que o teto atende.

A frase está agora no topo do bloco de gasto na Config, antes do campo — quem lê de cima para
baixo encontra o fato antes do interruptor.

### O teto

`ia.tetoUsd` (padrão **US$ 20/mês**, `0` = sem teto) e `ia.gasto` (`{mes, usd, chamadas, tokens}`).

- **A trava mora no `background.js`**, não no painel: é o único ponto por onde o dinheiro sai, o
  mesmo lugar onde a chave é usada. Trava no painel é trava que um caminho novo esquece de chamar.
- Atingido, toda chamada vira `incerto` — o painel se comporta como antes da IA existir, que é a
  mesma disciplina de canal caído e falha de rede.
- **Vira o mês zerando sozinho**, sem agendador nenhum: o mês muda no primeiro uso do mês seguinte.
  Agendador de virada de mês é mais uma coisa para falhar em silêncio.
- **Não há botão de zerar o contador, de propósito.** Zerar é o único controle que torna o teto
  decorativo. Precisando de mais, ele levanta o teto — decisão visível e que fica salva.
- O log da rodada passou a mostrar **dólares por chamada e o acumulado do mês** ao lado dos tokens.
  Token é diagnóstico (o cache está pegando?); dólar é a pergunta que ele faz.

`custoEmDolares`, `acumularGasto`, `podeGastar` e `mesDe` são puros e testados. Modelo fora da
tabela de preços é cobrado pelo **mais caro** — preço desconhecido não pode virar gasto invisível,
e superestimar só faz o teto chegar mais cedo, que é o lado seguro de errar.

### Causa raiz de dois defeitos achados no caminho — nenhum dos dois tinha rodado ainda

**1. `max_tokens: 512` truncava a decisão no Opus 5.** O Opus 5 **pensa por padrão** (adaptativo,
ao contrário do 4.8/4.7), o pensamento é cobrado como saída (US$ 25/MTok) e cabe **dentro** do
`max_tokens`. Com 512 o raciocínio consumia a cota e o JSON saía cortado: chamada paga que vira
`incerto`, sem nada na tela dizendo por quê. Hoje: `max_tokens` 2048 (decisão) / 4096 (rascunho),
e quem segura o custo é `output_config.effort` — `low` na decisão (escolher entre respostas prontas
é classificação) e `medium` no rascunho (único caminho em que uma frase gerada chega a um eleitor
sem ninguém ler; economizar esforço ali é economizar no lugar errado).

**2. `effort` quebraria o Haiku 4.5, que está no seletor.** Ele recusa o parâmetro com 400 — ou
seja, a opção mais barata do menu, justamente a que se escolhe quando o gasto preocupa, ia parar
de funcionar. `MODELOS_COM_ESFORCO` é **lista de permissão e não de bloqueio**: a lista inversa
faria todo modelo futuro nascer quebrado até alguém notar. Tem teste de regressão.

**3. `store.get('ia')` não mesclava defaults.** Só `settings`/`dicts`/`temaByNumber`/`tagAliases`/
`auto` mesclavam. Quem já tinha a IA configurada leria `tetoUsd: undefined` e ficaria **sem teto** —
um limite que nasce desligado justamente em quem mais usa. `'ia'` entrou na lista.

### Estimativas do seletor corrigidas

Os valores antigos (`~US$ 7 por mil` no Opus 5) foram calculados sem o pensamento. Hoje: Opus 5
~US$ 12/mil, Sonnet 5 ~US$ 5/mil, Haiku 4.5 ~US$ 1,60/mil. São estimativa para escolher; quem vale
é o contador, que soma o que a API devolveu.

**Arquivos:** `src/lib/ia.js`, `src/lib/ia-cliente.js`, `src/background.js`, `src/lib/store.js`,
`src/panel/panel.js`, `tests/ia.test.mjs`, `manifest.json` (0.14.0 → **0.15.0**).

**Pendências:** o teto e o `effort` **nunca rodaram contra a API real** — a primeira avaliação de
verdade (no "Thiago Tim") é o que confirma que a decisão volta em JSON inteiro e que o contador
sobe. Se o contador ficar em zero com chamadas acontecendo, `usage` mudou de forma.

---

## 2026-08-20 — A IA passa a poder ENVIAR o rascunho sozinha

**Pedido:** *"a intenção é enviar quando necessário, mas em geral utilizar as mensagens prontas e
suas variações"*. Perguntei quem aperta o gatilho, oferecendo três caminhos e marcando o terceiro
como o único em que uma frase inventada chega ao eleitor sem revisão. **Ele escolheu esse**, ciente
do risco, e escolheu também que o rascunho só entra **quando a IA não achar resposta pronta boa**.

Isto reverte a fronteira que o `CLAUDE.md` registrava como deliberada ("o rascunho nunca envia").
A decisão é dele; o que eu podia fazer era tornar esse envio o mais estreito possível.

### As quatro travas, e por que nessa ordem

`ia.podeEnviarSozinho` é pura e testada, e responde **não** por padrão. Para sair sozinho, tudo
junto:

1. **`ia.enviarRascunhoAuto` ligado** — nasce desligado, e instalação nova nunca envia sozinha.
2. **Zero avisos de `revisarRascunho`** — marcador esquecido, promessa de entrega, menção a
   cesta/remédio/dinheiro/emprego (Lei 9.504/97), texto longo. Antes eram avisos ao lado do texto;
   aqui viram **veto**. É a trava mais valiosa: **não depende de a IA ser honesta sobre si mesma**.
3. **A IA não ter pedido revisão** — `precisaDeRevisao` novo no esquema, e **ausente conta como
   SIM**: campo faltando nunca vira permissão.
4. **Confiança ≥ 0,9** (`CONFIANCA_RASCUNHO_AUTO`), separada e maior que o 0,7 da decisão. É a
   mais fraca das quatro — autoavaliação de modelo não é medida confiável — e por isso a última,
   nunca a única.

Falha de rede, formato ilegível, janela de 24h vencida, contato que não escreveu nada: tudo cai
em "não envia", e o contato segue para a triagem **exatamente como seguia antes**. O caminho de
falha é o comportamento antigo, não um caminho novo.

### O que mudou em volta

- **O rascunho passou a vir com esquema** (`esquemaDoRascunho`): sem um número devolvido pela IA
  não há como aplicar limiar nenhum. `validarRascunho` lê isso e junta com a revisão heurística;
  resposta **sem** esquema ainda vira rascunho para ele ler, só nunca automático (confiança zero).
- **O texto enviado vai INTEIRO para o log da rodada.** É a única forma de auditar depois o que a
  IA falou em nome do mandato — registro parcial daria impressão de auditoria sem permitir auditar.
- **O motivo de NÃO ter saído sozinho também vai para o log.** Sem isso, "o automático não usou"
  vira pergunta sem resposta e a trava que atuou fica invisível.
- **A descrição na Config foi corrigida**: ela dizia "a IA nunca escreve texto para o eleitor", o
  que passaria a ser mentira. O aviso novo vem **antes** do interruptor, para quem lê de cima para
  baixo encontrar o risco antes do controle.

**Arquivos:** [src/lib/ia.js](src/lib/ia.js) (`CONFIANCA_RASCUNHO_AUTO`, `esquemaDoRascunho`,
`validarRascunho`, `podeEnviarSozinho`), [src/lib/ia-cliente.js](src/lib/ia-cliente.js),
[src/lib/store.js](src/lib/store.js) (`ia.enviarRascunhoAuto`),
[src/panel/panel.js](src/panel/panel.js) (`tentarRascunhoAutomatico`, gatilho na escalada,
controle na Config), [tests/ia.test.mjs](tests/ia.test.mjs) (7 grupos novos, um por jeito de uma
frase inventada escapar). Dez suítes passando.

**Ainda não rodou contra a API de verdade.** O primeiro teste tem que ser no contato "Thiago Tim",
com o automático ligado, olhando o log — é lá que aparece o texto exato que a IA mandou.

---

## ONDE PAROU — 20/08/2026, fim do dia

> Esta seção fica **no topo** de propósito. A antiga "Estado atual — leia primeiro" foi empurrada
> para a linha ~1500 pelas entradas novas, então "leia primeiro" e "está primeiro" tinham
> divergido. Atualize **esta** ao fechar o dia.

**Árvore limpa, manifesto 0.13.0, dez suítes passando.** A extensão irmã
[WebWhatsFill](../WebWhatsFill) está em 0.3.0, também limpa e com quatro suítes passando (tinha
~700 linhas fora do git; foram commitadas hoje).

### O que foi feito hoje, em uma linha cada

- **Aba Cidades** (nova): etiqueta de município para a base inteira, com ritmo adaptativo, lotes
  disparados por você, e as travas de sempre (só município da planilha oficial, id nunca inventado,
  idempotente, soma em vez de substituir).
- **Rotas descobertas lendo o bundle do app**, não chutadas — e dois chutes meus caíram no caminho
  (`isToIncludeCustomFieldValues`, e criar etiqueta é `PUT`).
- **Etiqueta de cidade no fluxo normal**, não só na varredura, com a antiga saindo quando a cidade
  muda.
- **Aviso de grafia** da cidade no cabeçalho, com botão de corrigir.
- Aceitar a cidade no popup passou a **liberar as etiquetas** (`confirmada: true`).

### O que está EM ABERTO, em ordem de risco

1. **A etiqueta de cidade não está entrando no CRM** — é o fio solto de *"não estou achando os que
   foram feitos"*. O conserto de hoje garantiu que isso **não trave mais o envio de modelos**
   (etiqueta saiu dos bloqueantes), mas a causa da escrita falhar continua desconhecida.
   **Como descobrir:** aba Cidades → lote de 20, **com a aba visível** → o log diz `Sonda ok` ou
   `SONDA FALHOU: …`. Essa linha é a resposta.
2. **Etiquetas de rótulo REPETIDO no CRM** (apareceu "Serra" duas vezes). Um contato pode "ter
   SERRA" e não aparecer no filtro de SERRA, porque são duas etiquetas distintas. A aba Cidades
   lista quais estão repetidas — limpar é no CRM, a extensão não apaga etiqueta.
3. **1293 contatos com COREDE de outra região.** Gravar soma o certo e deixa o errado, e o contato
   passa a aparecer em dois filtros. A tela avisa e **não remove** — pode ser a cidade que está
   errada, e a decisão é sua.
4. **`createTag` e `listContacts` nunca foram executadas de verdade** — foram lidas do bundle. A
   sonda da criação de etiqueta é o que prova.
5. **"Se eu não filtrar ele não faz"** — não reproduzido. Se voltar, o log agora diz quando a
   primeira página volta vazia.

### Duas coisas que valem lembrar antes de mexer

- **Deixe a aba VISÍVEL** durante qualquer passada longa. O Chrome congela aba em segundo plano; a
  aba Cidades nasceu sem `keepalive` e uma gravação de 2000 contatos parou no meio, em silêncio.
- **Confira a versão no cabeçalho do painel** contra o `manifest.json` antes de qualquer
  diagnóstico. "O fix não funcionou" já foi "o fix não chegou" uma vez, e custou uma tarde.

---

## 2026-08-20 — Rascunho: o único lugar onde a IA escreve, e ela não envia

**Relato dele:** *"tem casos que irá ter que responder, como textos enormes de transcrição etc.
Normalmente eu copio e colo para uma IA, ela responde e eu edito para parecer mais humano."*

É o caso que a escolha entre respostas prontas não cobre, e é o que mais consome o tempo dele.
Isto é o laço que ele já faz — sem o copiar e colar, e **sem mudar a última parte**.

**A fronteira, escrita no código e não só na intenção:** o rascunho vai para o campo de mensagem
com `setComposerText`, **nunca** `sendText`. A diferença entre isto e "IA respondendo eleitor" é
uma só, e é toda ela: ele lê, edita e aperta enviar. O texto continua passando pelos olhos dele.

**O que faz soar como ele:** as respostas prontas entram no prompt como **exemplos de estilo**,
não como opções. Foram escritas por ele, são a amostra mais fiel da voz dele que existe, e saem de
graça — já estão no prompt cacheado. "Editar para parecer mais humano" é trabalho que o modelo
adianta se souber com que voz escrever.

**As proibições são de lei, não de gosto.** O prompt proíbe prometer dinheiro, cesta, remédio,
passagem, emprego ou qualquer bem (Lei 9.504/97), prometer resolver ou garantir resultado, marcar
compromisso em nome do parlamentar, e inventar dado, agenda ou posição. Quando a pessoa pediu
ajuda material, o rascunho **encaminha** para o CRAS e a assistência social — é o mesmo caminho da
resposta pronta `pedido-ajuda`, que ele já escreveu.

**`revisarRascunho` levanta a mão, mas nunca esconde o texto.** Marcador esquecido (`{{…}}`),
frase que parece prometer entregar alguma coisa, menção a bem ou benefício, texto longo demais
para WhatsApp — tudo vira aviso ao lado do rascunho, não em barra de status que a próxima ação
apaga. E o texto aparece de qualquer jeito: esconder tiraria dele a decisão, que é justamente o
que este desenho existe para preservar.

**Onde fica:** topo da aba Respostas, que é onde ele está quando o caso aparece — contato aberto,
conversa longa na tela, nenhuma resposta pronta servindo. Só aparece com a IA ligada.

A conversa entra **inteira** no prompt do rascunho (até 4.000 caracteres por mensagem), diferente
do prompt de decisão, que corta em 400: aqui o texto longo É o caso de uso, e cortar o começo é
como se perde o que a pessoa realmente perguntou.

**Arquivos:** [src/lib/ia.js](src/lib/ia.js) (`montarSistemaRascunho`, `montarContatoRascunho`,
`montarRequisicaoRascunho`, `revisarRascunho`),
[src/lib/ia-cliente.js](src/lib/ia-cliente.js) (`rascunhar`, e o mesmo canal servindo os dois
modos), [src/panel/panel.js](src/panel/panel.js) (`renderRascunho`),
[tests/ia.test.mjs](tests/ia.test.mjs) (18 asserções novas), [CLAUDE.md](CLAUDE.md).
Dez suítes passando.

---

## 2026-08-20 — WhatsFill+IA nasce em branch separado

**Pedido dele:** *"a IA precisa avaliar ainda, muito arriscado só pelo determinístico, tem que
avaliar o contexto e utilizar a mensagem pronta"* e, em seguida, *"antes de tudo crie um
whatsfill+IA, deixe essa versão separada"*.

Ele está certo sobre o risco: a regex pega o previsível, não o pedido de ajuda escrito de um
jeito que ninguém antecipou. As duas camadas se somam.

**A separação:** branch `claude/whatsfill-ia`, escolhido por ele entre três opções. Duplicar a
pasta foi descartado — `panel.js` tem 5.000+ linhas e carrega meses de correções; duas cópias
divergem em uma semana e todo conserto vira trabalho dobrado. O manifesto muda **nome**
(`WhatsFill+IA`), não versão: é o nome que separa as duas em `chrome://extensions` e no painel.
Conserto que vale para os dois se faz no branch normal e vem para cá por merge.

### O desenho, e o que ele exclui

**A IA escolhe, não escreve.** Devolve o id de uma resposta pronta, ou "escalar". O que sai
continua sendo, byte a byte, um texto que ele escreveu e revisou. Essa fronteira é o que torna o
erro recuperável: o pior caso é a resposta pronta errada, não uma frase inventada num mandato.

**A ordem: regex primeiro, IA no resto.** É a mais barata E a mais segura ao mesmo tempo — o caso
conhecido é pego de graça e **não depende** de a IA estar no ar, com crédito ou de bom humor.

**As travas moram em `validarDecisao`, não no prompt.** Prompt é pedido; validação é regra:

- id que não existe → `incerto`;
- confiança abaixo de 0,7 → `incerto`;
- escolheu `pedido-ajuda` ou `pedido-emprego` → **vira escalada**, com a sugestão junto, nunca
  envio. São os de risco jurídico (Lei 9.504/97), e a IA escolher um deles é ela dizendo "isto é
  sensível", não "mande isto";
- resposta ilegível, sem rede, sem chave, sem crédito → `incerto`.

`incerto` significa **o painel se comportando exatamente como antes da IA existir**. Não há
caminho daqui que envie sem ele ver: a recomendação vira a **tecla 0** da caixa da rodada, com o
motivo e o percentual de certeza na tela.

**Tecla 0, e não uma tecla existente:** trocar o significado de tecla que ele já tem no dedo é
como o "2" digitado na conversa acabou concluindo atendimento.

### A chave da API não entra na página

`page-hook.js` roda no mundo MAIN — o mesmo contexto JS do Angular do mobiliza. **O que está na
página, a plataforma lê.** Por isso a chamada sai do `background.js` (service worker), que lê
`store.iaChave` e devolve só a decisão; o painel nunca vê a credencial. Ela também fica fora do
`exportJson`, pelo mesmo motivo do `sentLog`: backup é arquivo que circula. Na tela, campo de
senha e só o fato de existir — chave visível é chave que aparece em print.

`anthropic-dangerous-direct-browser-access` é necessário porque a origem é a da extensão. O nome
é um aviso legítimo e vale só porque isto é interno, carregado descompactado; não valeria para
nada distribuído.

### Custo, medido e visível

`cache_control` no prompt de sistema: o catálogo de respostas + regras são ~3.700 tokens
idênticos em toda chamada, e a partir da segunda custam 10%. Sem isso a conta é **3,5× maior**.
Com cache: ~US$ 6,80 por mil contatos no Opus 5, ~US$ 1,35 no Haiku 4.5. O log da rodada mostra o
custo de cada chamada — **"SEM CACHE" em chamadas seguidas** é o único sinal de que algo no
prompt passou a variar, e nada mais acusaria isso.

### O que ficou de fora, de propósito

Envio automático sem confirmação. A caixa pergunta em todo contato, como sempre. Isso vira uma
chave quando ele confiar no acerto — e o dado para decidir vai estar no log.

**Arquivos:** [src/lib/ia.js](src/lib/ia.js) e [src/lib/ia-cliente.js](src/lib/ia-cliente.js)
(novos), [tests/ia.test.mjs](tests/ia.test.mjs) (nova, 10ª suíte),
[src/background.js](src/background.js) (o transporte),
[src/lib/store.js](src/lib/store.js) (`iaChave`, `ia`), [manifest.json](manifest.json) (nome +
`api.anthropic.com`), [src/panel/panel.js](src/panel/panel.js) (`avaliarComIA`,
`renderConfigIA`, tecla 0), [CLAUDE.md](CLAUDE.md). Dez suítes passando.

---

## 2026-08-20 — Pedido de ajuda e dinheiro sai da rodada e espera por ele
**Relato dele:** *"caiu porque lhe falei para utilizar meu contexto também. Se eu perguntei qual
sua cidade e ela respondeu (maria cachoeirinha), terá que identificar esse tipo de resposta"*.

Ele está certo e eu tinha implementado metade: na rodada anterior fiz as pistas da PESSOA ("moro
em", "sou de") e a barra do formulário, mas deixei de fora o contexto mais forte que existe —
**nós termos acabado de perguntar**.

Quem responde uma pergunta não escreve "moro em" nem põe separador. Escreve *"maria
cachoeirinha"*.

### Como funciona

O painel olha a **última mensagem NOSSA**: se ela é o pedido de dados, passa
`respostaAoPedido: true`. Aí o parser casa o município sem pista e sem limite de tamanho, e o que
sobra do texto vira o nome.

```
maria cachoeirinha           → nome Maria,          cidade Cachoeirinha
Maria da Silva Cachoeirinha  → nome Maria da Silva, cidade Cachoeirinha
cachoeirinha                 → cidade Cachoeirinha, sem nome (não inventa)
```

### A trava, e ela apareceu no primeiro teste

Sem ela, *"Vamos juntos mudar o Rio Grande"* respondido ao formulário virava cidade **Rio Grande**
e nome **"Vamos Juntos Mudar O"** — o pior dos dois mundos, e num campo que vai para o CRM.

A regra que resolve é a própria pergunta: você pediu **nome e cidade**. Se veio um município e o
resto **não é nome de gente**, aquilo não era uma resposta. Vocabulário de slogan (vamos, juntos,
mudar, apoio, escolho, voto, luta, firme, lado) entrou no `NAO_E_NOME`.

### Também

`CONTEXTO.md` reescrito do zero, a pedido dele, para abrir outra aba com o estado de hoje: a
tabela de regras e sua ordem, as armadilhas do dia, as decisões de negócio que não devem ser
reinventadas, e o viés que eu repeti três vezes — trava contra falso positivo derrubando o caso
verdadeiro.

### Arquivos

`src/lib/extract.js` (`respostaAoPedido`, `sobraDaResposta`, `NAO_E_NOME`),
`src/panel/panel.js` (detecta a nossa última mensagem), `tests/parser.test.mjs` (9 asserções
novas), `CONTEXTO.md`, `CLAUDE.md`, `manifest.json` (0.37.0 → 0.38.0).
Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — A cidade passa a exigir contexto: "Rio Grande" de slogan não é município

**Relato dele**, print do Dirceu com o popup *"Encontrei 'Rio Grande' como cidade"*:

> *"a cidade deve sair de um contexto, resposta a minha pergunta, ou a pessoa falar (eu moro em
> (cidade), eu sou de (cidade)) — resumindo, veja outros contextos também que se aplicam a
> cidade; na print está se referindo ao Rio Grande do Sul"*

A mensagem era *"Olá! Vamos juntos mudar o **Rio Grande**"*, do anúncio. A guarda que existia
(`NOME_DO_ESTADO`) só apaga **"Rio Grande do Sul" por extenso** — a forma curta passava, e
"Rio Grande" é município do RS.

### A regra nova

Sem resposta ao formulário, a cidade agora precisa de **pista de moradia**: "moro em", "morando
em", "resido em", "sou de", "venho de", "aqui em", "minha cidade é", "estou em", "fica em",
"região de", "em", e a barra do formulário. O município é casado **só no trecho depois da pista**
— é isso que separa "moro em Rio Grande" de "vamos mudar o Rio Grande".

Continuam valendo sem pista: a resposta estruturada e a **mensagem curta** que é a própria cidade
(o "PORTO ALEGRE" sozinho, e o "Sao lourenso" com erro de digitação).

### O que a primeira versão quebrou, e por que isso importa

Exigi pista para tudo e **três testes caíram** — "Maria / Sao Lourenço", "Sao lourenso" e
"material impresso em Pelotas". Os três eram casos verdadeiros que a suíte já protegia: a barra do
formulário, o texto curto e a preposição "em". Sem eles, a mudança teria trocado um falso positivo
por três falsos negativos.

**A suíte pagou o próprio custo aqui.** Foi ela que mostrou que "contexto" era mais largo do que
as duas frases do exemplo dele.

### O limite que fica

*"meu genro mora em Santiago"* continua propondo Santiago — tem pista, e a pista está certa; quem
mora lá é outra pessoa. É a razão de a cidade **nunca** ser gravada sem clique, e já estava no
`CLAUDE.md` antes disto.

### Arquivos

`src/lib/cities.js` (`PISTAS_DE_CIDADE`, `matchCityComContexto`), `src/lib/extract.js`,
`tests/parser.test.mjs` (11 asserções novas), `CLAUDE.md`, `manifest.json` (0.36.0 → 0.37.0).
Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — "Voltou diversas vezes por anúncios": a regra existia e duas condições minhas a impediam

**Relato dele**, print do Telmo: *"voltou diversas vezes por anúncios, já mandei mensagem do
momento = concluir"*.

Na tela: cidade **Viamão**, modelo enviado às **10:28**, e às **18:24** ele voltou por outro
anúncio ("ANÚNCIO | FACEBOOK" + *"Olá! Eu escolho o lado da Liberdade"*). A caixa sugeria **mandar
o modelo de novo**.

### A regra já existia. Eu é que a tinha amarrado errado

`voltou-por-outro-anuncio` foi escrita hoje de manhã, e não pegou o Telmo por **duas condições
que eu pus e ele nunca pediu**:

1. **`!temEtiquetaDeCidade`** — eu tinha usado a falta de cidade como trava contra falso
   positivo, porque a frase do aceite ("Olá!") é curta e genérica. Só que voltar por anúncio é
   sobre **o que a pessoa acabou de fazer**; ter cidade não muda isso. O Telmo tem Viamão.
2. **`pedidoDeHoje`** — o sinal de "voltou" era o formulário ter saído. Mas quem recebeu o
   MODELO também já foi atendido, e voltar depois disso é o mesmo caso.

O sinal certo é mais simples e mais amplo: **já existe mensagem NOSSA na conversa**. É isso que
separa "voltou" de "chegou agora", e vale para quem recebeu formulário e para quem recebeu modelo.

### E "já mandei" não é "hoje"

A regra olhava `momentoHoje`. Ele disse *"já mandei mensagem do momento"* — sem recorte de dia. A
conta passou a ser sobre a mensagem do momento **atual**, o que a chave de envio já permitia (ela
inclui um resumo do texto, então trocar de campanha zera a conta sozinho).

### O padrão, de novo

É a terceira vez hoje que uma trava minha contra falso positivo derruba o caso verdadeiro:
o `` antes de "É nós", a lista de etiquetas da caixa em vez das do contato, e agora estas duas
condições. Todas nasceram de "melhor não errar para o lado de fazer demais" — e o custo real foi
não fazer nada no caso que importava.

### Arquivos

`src/lib/sugestao.js` (a regra), `src/panel/panel.js` (`voltouPorOutroAnuncio`,
`momentoJaEnviado`), `tests/sugestao.test.mjs`, `manifest.json` (0.35.0 → 0.36.0).
Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — A origem do anúncio é dado, não texto

**Relato dele**, com a print do bloco "ANÚNCIO | FACEBOOK" e o link `fb.me`: *"se reconhecer o
que está na print e adicionar a etiqueta ADS resolve tudo"*.

### Fui olhar antes de escrever regra, e ainda bem

O bloco não é uma mensagem: é a sessão. Conferido ao vivo:

```
utm.source      = "FACEBOOK"
utm.campaign    = "CLICK AQUI 👉"
utm.referralUrl = "https://fb.me/lwwIb9Lo2"
utm.sourceId    = "120248742363290543"
```

Dava para resolver com uma regra de texto — e teria sido pior: dependeria de ele escrever a regex
certa, e casaria por acidente com qualquer mensagem que citasse "facebook". **O campo é a fonte, e
ler campo não erra.**

### Duas coisas, e a segunda explica um mistério

1. **Etiqueta de anúncio automática.** Campo novo na Config, padrão `ADS`, vazio desliga. Entra
   como **conteúdo** de propósito: é isso que a liga à tabela "Modelo por conteúdo" e faz virar o
   modelo a enviar — o "resolve tudo" da frase dele.

2. **O painel só passava `utm.campaign` para as regras.** `source` e `referralUrl` ficavam de
   fora, então uma regra com "facebook" ou com o link do anúncio **nunca poderia casar**. Isso é
   metade da resposta à pergunta dele de mais cedo, *"está com dificuldade pra pegar se for por
   alguma palavra chave"*: parte do texto que ele esperava que estivesse lá não estava.

### Arquivos

`src/lib/store.js` (`etiquetaAnuncio`), `src/lib/tags.js` (`veioDeAnuncio`),
`src/panel/panel.js` (campo na Config + os quatro campos de utm),
`tests/tags.test.mjs` (5 asserções novas), `CLAUDE.md`, `manifest.json` (0.34.0 → 0.35.0).
Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — "Vieram do anúncio sem pedir dados": faltava separar ignorou de nunca-recebeu

**Relato dele**, minutos depois da mudança anterior: *"bastante contatos que vieram de anúncio sem
pedir dados ao iniciar"*, com a print da Sônia.

### A tensão entre os dois pedidos dele, e como ela se resolve

Poucas horas antes ele tinha dito duas coisas que pareciam brigar:

- *"ela ignorou totalmente o pedido da cidade, eu mando o modelo mesmo assim"* → não insista;
- *"está pedindo dados pra quem já tem etiquetas"* → não peça a quem já está classificado.

Eu tinha resolvido as duas trocando o critério para o NOME. A Sônia mostra o que ficou de fora:
nome de verdade (a regra do nome não pega), conteúdo pedido (a regra do modelo pega e manda), sem
cidade — e **o formulário nunca tinha saído para ela**.

**A distinção que faltava é entre "ignorou o formulário" e "nunca recebeu o formulário".** Não
insistir vale para quem já teve a chance. Quem nunca foi perguntado não ignorou nada, e perguntar
uma vez é o trabalho que a rodada existe para fazer.

### A regra

`nunca-pediram-dados`, **acima** de "conteúdo pedido": veio do anúncio, sem cidade, formulário
nunca enviado → peça esta vez. A do nome continua abaixo. O laço fica: pede-se **uma** vez;
ignorado, manda-se o conteúdo e não se insiste.

### "Nunca enviado" tem duas fontes, e já era esperado

`wasSent` só enxerga o que o painel mandou — a lição que apareceu três vezes hoje. Então
`jaPediramDados` também procura o texto do formulário dentro das nossas mensagens, pelo mesmo
método usado no modelo: um trecho do meio, que sobrevive a variável interpolada.

### Ordem hoje

engajado → resposta pessoal → despedida → voltou por anúncio → reação → **nunca pediram dados** →
conteúdo pedido → nome sem sentido → nunca perguntaram interesse → já pedi hoje.

### Arquivos

`src/lib/sugestao.js` (regra), `src/panel/panel.js` (`jaPediramDados`),
`tests/sugestao.test.mjs` (7 asserções novas), `manifest.json` (0.33.0 → 0.34.0).
Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — "Dificuldade pra pegar por palavra chave": eram três coisas, consertei uma

**Pergunta dele:** *"a extensão está com dificuldade pra pegar se for por alguma palavra chave, se
eu botar anunciou não pega pra etiquetar?"*

Fui olhar como a regra de conteúdo casa, e são **três limitações diferentes**. Registro as três
porque só uma tem conserto óbvio.

### 1. Acento — consertado

A regra vira `new RegExp(padrao, 'i')` e é testada no texto cru. `/anuncio/i` **não** casa com
"anúncio", e `/anúncio/i` **não** casa com "anuncio". Quem escreve no WhatsApp acentua quando dá;
quem escreve a regra na Config acentua quando lembra. Exigir que os dois combinem é garantir que
parte das mensagens escape.

Agora são três tentativas (`tags.casa`): a regra no texto cru, a regra no texto sem acento, e a
regra sem acento no texto sem acento. **Testar nas duas versões em vez de trocar** — regra que já
funcionava com acento continua funcionando, e nenhuma regex com classe de caractere ou `` é
reescrita por mim. A terceira tentativa vem por último e dentro de `try`, porque
`semAcentoNemCaixa` apaga metacaractere.

### 2. A palavra é literal, não é raiz — NÃO consertado

`anunciou` casa só com "anunciou". Não pega "anúncio", "anunciar", "anunciaram". Para pegar a
família inteira a regra precisa ser `anunci` (que é o que eu recomendaria) ou `anunci(o|ou|ar|aram)`.

Não mexi nisso porque **é regex de propósito**: cortar palavra sozinho transformaria "sim" em
"assim" e etiquetaria meio mundo. A tela da Config é que devia dizer isso, e hoje não diz.

### 3. Áudio não entra na conta — decisão pendente dele

A regra olha `state.incoming`, que é **só o que foi digitado**. A transcrição do áudio ficou de
fora quando a liguei ao parser (30/08), e ali eu a rebaixei a palpite justamente por ser fala
ouvida por máquina.

Aqui o caso é diferente e mais delicado: **etiqueta de conteúdo é gravada automaticamente** neste
projeto. Ligar a transcrição significaria escrever etiqueta em eleitor real a partir de palavra
que ninguém digitou. Não fiz por conta própria; está na mesa para ele decidir, e a saída provável
é a mesma de antes — sugerir sem gravar sozinho.

### Arquivos

`src/lib/tags.js` (`casa`), `tests/tags.test.mjs` (5 asserções novas),
`manifest.json` (0.32.0 → 0.33.0). Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — "Pedir dados" passa a ser sobre o NOME, não sobre a cidade

**Relato dele:** *"ao abrir conversas está pedindo dados pra quem já tem etiquetas, uma exceção
pra pedir é somente quando o nome da pessoa estiver totalmente sem sentido ou em falta"*.

É a **segunda correção dele nesta mesma regra em dois dias**, e as três versões contam a história:

1. **30/08** — *"quando a pessoa não tiver etiqueta de cidade, sempre pedir dados"*. Eu pus a
   regra acima de tudo.
2. **31/08, manhã** — *"ela ignorou totalmente o pedido da cidade, eu mando o modelo mesmo
   assim"*. Desceu para abaixo de "conteúdo pedido".
3. **31/08, tarde** — o critério inteiro estava errado.

### Por que ele está certo

O argumento é sobre o que cada falta CUSTA.

**Cidade faltando é comum e não impede trabalhar o contato:** ele tem etiqueta, tem conteúdo,
aparece nos filtros que importam, e a cidade ainda pode vir em qualquer conversa. Pedir o
formulário a quem já está classificado é exatamente o incômodo que ele descreveu.

**Nome vazio ou impronunciável é o que quebra:** bloqueia o vocativo, deixa o cadastro inútil no
CRM, e **nenhuma outra conversa conserta sozinha** — ninguém manda o nome espontaneamente.

### `vars.nomeSemSentido`

Função nova, e separada do `looksLikePlaceholder` de propósito: aquele decide se o **vocativo**
pode sair numa mensagem, e alargá-lo mudaria o bloqueio de envio em todo o painel.

Ela soma o "em falta" (vazio, "[NOVO] …", telefone no lugar do nome) ao "sem sentido" que faltava:
cadastro **sem vogal nenhuma** — "srn", "kkk", iniciais soltas.

**Uma herança que aceitei e registrei no teste:** "Zé" conta como falta, porque
`looksLikePlaceholder` trata menos de 3 letras como telefone. É pedir o nome completo a quem está
cadastrado com dois caracteres — conservador, e do lado certo.

### Ordem hoje

engajado → resposta pessoal → despedida → voltou por anúncio → reação → conteúdo pedido →
**nome sem sentido** → nunca perguntaram interesse → já pedi hoje.

### Arquivos

`src/lib/vars.js` (`nomeSemSentido`), `src/lib/sugestao.js` (a regra e o porquê da mudança),
`src/panel/panel.js` (contexto), `tests/vars.test.mjs` (10 asserções novas),
`tests/sugestao.test.mjs` (ajustadas ao critério novo), `manifest.json` (0.31.0 → 0.32.0).
Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — "Zucco" como cidade, e a caixa de pular engajado sozinho

### 1. O anúncio propunha o nome do candidato como cidade

Print dele: popup *"Encontrei 'Zucco' como cidade. De onde saiu: Zucco. Não casou exato com a
lista do IBGE — é palpite."*

Reproduzi offline. A causa **não** é casamento de município: `matchCity('Zucco')` devolve nada. É
a mensagem do anúncio:

> Olá! Eu apoio o Flávio, **Zucco**, Hiago e Capitão Martim

As vírgulas fazem o parser achar que está lendo "Nome / Cidade", e o que cai na posição da cidade
vira **candidato não reconhecido** — que é justamente o caminho que oferece popup com sugestões.
A trava do "Capitão Martim" não pegava: ela apaga expressões antes de casar município, e aqui
nunca houve casamento de município.

Agora `cities.naoPodeSerCidade` decide antes de oferecer, juntando duas fontes: o vocabulário da
campanha (Zucco, Bolsonaro, Hiago, Capitão Martim…) e **a lista que ele edita na Config**
("Municípios que NÃO são cidade aqui"), que passou a valer também para candidato não reconhecido
— antes ela só tirava município da lista oficial, então "Zucco", que não é município, escapava.

**Detalhe que virou teste:** as expressões são regex **globais**, e regex global guarda
`lastIndex` entre chamadas — `test` alternaria entre verdadeiro e falso. Há `lastIndex = 0` antes
de cada teste e uma asserção que chama duas vezes seguidas. É o mesmo defeito que peguei ontem no
detector de emoji.

### 2. Caixa: pular engajado sozinho

Pedido dele. Nasce **desmarcada**, e marcada é a única coisa desta rodada que tira contato da fila
sem perguntar.

O que torna isso aceitável, e está escrito no código: **é ele quem marca**, o critério é uma
etiqueta que ele mesmo escolheu, e o pulo vai para o Andamento **com o nome da etiqueta que
causou**. Regra que tira contato da fila sem dizer por quê é exatamente o *"alguns concluem e
outros não"* que este projeto já pagou caro.

Pular não envia nada e não conclui: o atendimento fica aberto, onde estava.

### Arquivos

`src/lib/cities.js` (`naoPodeSerCidade`), `src/lib/extract.js` (guarda no candidato),
`src/lib/store.js` (`pularEtiquetasSozinho`), `src/panel/panel.js` (caixa + pulo),
`tests/parser.test.mjs` (8 asserções novas), `manifest.json` (0.30.0 → 0.31.0).
Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — Duas prints, e as duas apontam para o mesmo tipo de cegueira

### 1. "Amém mestre" não era despedida

Print do Carlos Pedroso: última mensagem **"Amém mestre"**, e a caixa sugerindo *"Sugiro a 7:
pergunta de interesse"*.

A regra de despedida pegava o "Amém" e então checava o que sobrava — e sobrava **"mestre"**. O
vocativo derrubava a regra inteira.

O vocabulário de vocativo daqui entrou na lista que é limpa antes da conferência: *mestre, chefe,
guerreiro, campeão, parceiro, irmão, meu, minha, nobre, querido*. E a trava continua: *"Amém, mas
preciso de ajuda"* e *"mestre, me manda o material"* continuam **não** sendo despedida — tem
teste para os dois.

### 2. Sugeriu mandar o modelo que já estava na conversa

Print da Jana: o modelo "Campanha Martim2" está na tela, com imagem e texto completo, e a caixa
sugere *"Sugiro a 1: pediu ADS e há modelo mapeado — mande."*

**A causa é a mesma de ontem, com outra roupa:** `templatesLib.wasSent` só enxerga o que saiu
**pelo painel**. Aquele modelo foi disparado pela automação do anúncio, então para o registro de
envios ele nunca existiu.

Agora `getConversation` devolve `nossas` — o que **nós** mandamos, com texto — e a rodada compara
um trecho do MEIO do modelo (o começo é saudação igual em todos, e o meio sobrevive a variável
interpolada) com o que já saiu. Casou, a regra do conteúdo não sugere mais.

### O padrão que já apareceu três vezes hoje

Em todas, o painel decidia com base no que **ele mesmo** tinha feito, e não no que está na
conversa:

- `nossaUltimaAt` — para saber que o contato já foi respondido (resposta à mão não deixa rastro);
- `nossas` — para saber que o modelo já foi enviado (automação não deixa rastro);
- as etiquetas reais do contato, e não a lista da caixa.

Virou armadilha no `CLAUDE.md`: **o registro de envios é anti-duplicata do painel, não a verdade
sobre a conversa.**

### Arquivos

`src/lib/cortesia.js` (vocativos), `src/lib/api.js` (`nossas`), `src/lib/sugestao.js`
(`modeloJaNaConversa`), `src/panel/panel.js` (comparação), `tests/cortesia.test.mjs` (7),
`tests/sugestao.test.mjs` (3), `CLAUDE.md`, `manifest.json` (0.29.0 → 0.30.0).
Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — "Não pulou o engajado": a regra nunca viu a etiqueta

Duas coisas no mesmo relato dele, e a primeira é um defeito meu.

### O defeito: a caixa mostra uma lista de etiquetas que NÃO é a do contato

Print do Deoclecio: o cabeçalho da plataforma mostra **ADS, CACHOEIRINHA, CONTATO-ASSES,
CONTEÚDO FLÁV, ENGAJADO/BIZA**. A caixa da rodada mostra **CACHOEIRINHA, Metropolitano Delta do
Jacuí, ADS**. Três de cinco — e `ENGAJADO/BIZA` era uma das que faltavam.

A lista da caixa vem de `tagSuggestions`, que só carrega o que a rodada **sugere ou reconhece**.
Eu liguei a regra nova nessa lista, então ela nunca via a etiqueta que deveria dispensar o
contato. A regra estava certa e cega.

Agora `etiquetaQueDispensaDaFila` lê `state.contact.tagsId` cruzado com `tagsLib.allTags()` —
as etiquetas de verdade, do CRM. Virou armadilha no `CLAUDE.md`: **regra que decide por etiqueta
não pode ler a lista da tela.**

### A decisão: engajado passa na frente até do áudio

Com a etiqueta finalmente visível, o Deoclecio ainda cairia em "responder à mão", porque ele
mandou um vídeo e essa regra estava acima.

Ele quer pular. Eu tinha argumentado o contrário em 30/08 — *"engajado que mandou áudio é quem
mais merece resposta"* — e o trabalho dele desmente: **o que o engajado manda, na prática, é vídeo
e link de política o dia inteiro.** Responder a cada um não é atenção, é não conseguir sair da
fila. A tecla 6 continua a um toque para quando o vídeo merecer.

`etiqueta-dispensa-da-fila` foi para o topo da lista.

### E o caso do Paulo Quevedo, do relato anterior

*"a pessoa já foi respondida e mandou link — concluo e próximo"*. Resposta longa dele às 09:29,
link do TikTok dela às 14:43, e a caixa sugerindo a mensagem do momento — ou seja, empilhar uma
segunda mensagem nossa em cima da que ela ainda nem comentou.

A regra da reação passou a olhar se **já respondemos hoje**: se sim, conclui; se não, mensagem do
momento como antes. Para isso a conversa passou a devolver `nossaUltimaAt`, a hora da nossa
última mensagem — `ultima` não servia (quando a pessoa escreve depois de nós, a nossa some da
conta) e `wasSent` também não, porque só enxerga o que saiu por template: **resposta escrita à
mão, que é a maioria das respostas de verdade, não deixa rastro ali.**

### Ordem hoje

1. etiqueta que dispensa da fila (engajado) ← subiu ao topo
2. pede resposta pessoal (áudio, vídeo, texto longo)
3. despedida ("é nós", "abraço")
4. voltou por outro anúncio
5. última é só reação — agora **conclui** se já respondemos hoje
6. conteúdo pedido
7. sem etiqueta de cidade
8. nunca perguntaram interesse
9. já pedi hoje e não veio nada

### Arquivos

`src/lib/api.js` (`nossaUltimaAt`), `src/lib/sugestao.js` (ordem, regra da reação),
`src/panel/panel.js` (etiquetas reais, `respondidoHoje`), `tests/sugestao.test.mjs`,
`CLAUDE.md`, `manifest.json` (0.28.0 → 0.29.0). Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — "É nós": quem só se despede recebe concluir, não modelo

**Relato dele**, com a print do Jesus Ceneri: ele já tinha mandado o conteúdo às 10:46, a pessoa
escreveu **"É nós."** às 14:30, e a caixa sugeriu *"Sugiro a 1: pediu ADS e há modelo mapeado —
mande."*

> *"a pessoa só fechou a conversa com (é nós, abraço, tamo junto, estamos juntos, entre outros
> termos) eu concluo a conversa"*

Mandar o modelo ali é **responder a uma despedida com propaganda** — e o modelo já tinha ido
quatro horas antes.

### O vocabulário é o do lugar

"é nós", "é nóis", "tamo junto", "estamos juntos", "tmj", "abraço", "forte abraço", "valeu",
"vlw", "obrigado/obrigada", "amém", "que Deus abençoe", "boa sorte", "sucesso".

**Exige que não sobre nada além da despedida.** *"Valeu, me manda o material"* tem pedido dentro,
e concluir ali seria fechar a porta na cara de quem pediu algo. Mesma disciplina do resto do
arquivo: sobrando substância, a regra não casa. Tem teste para os dois lados.

### A armadilha que quase deixou a print dele passar

A primeira versão **não pegava "É nós."** — justamente o caso que ele mandou.

`` é fronteira de `w`, e `é` não é `w`. Então `/é nós/` **nunca** casa no começo da
string. Só apareceu porque testei a frase dele literalmente antes de commitar; um teste com
"e nos" sem acento teria passado e escondido o defeito. Virou armadilha no `CLAUDE.md`, porque o
vocabulário deste projeto é cheio de acento no começo: "é nós", "ótimo", "amém".

### Prioridade

Segunda, logo abaixo de "pede resposta pessoal". Um "valeu" dito dentro de um áudio de um minuto
continua pedindo resposta à mão — o áudio pode ter outra coisa junto.

Concluir e não pular: a conversa acabou de verdade, e o contato volta sozinho para "Meus" se
escrever de novo. Pular deixaria a fila cheia de conversa encerrada.

### Arquivos

`src/lib/cortesia.js` (`ehDespedida`, `ultimaEhDespedida`), `src/lib/sugestao.js` (regra),
`src/panel/panel.js` (contexto), `tests/cortesia.test.mjs` (22 asserções novas),
`tests/sugestao.test.mjs` (4), `CLAUDE.md`, `manifest.json` (0.27.0 → 0.28.0).
Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — Conteúdo pedido passa a vencer "sem cidade" (ele mudou de ideia, e está certo)

**Relato dele**, com a print da Janete — sem cidade, etiqueta ADS, modelo "Campanha Martim2"
mapeado, e a caixa sugerindo *"Sugiro a 4: peça os dados"*:

> *"ela ignorou totalmente o pedido da cidade, eu mando o modelo mesmo assim, talvez em outra
> hora ela forneça"*

### É uma reversão da regra que ele mesmo pediu, e o argumento dele é melhor

Em 30/08 ele tinha pedido: *"quando a pessoa não tiver etiqueta de cidade, sempre pedir dados"*, e
eu pus a regra acima até do conteúdo pedido.

O caso da Janete mostra o furo: ela **já ignorou** o pedido da cidade uma vez. Mandar o formulário
de novo não a aproxima de fornecer — mandar o que ela pediu, sim, porque a conversa continua viva
e a cidade pode vir depois. Pedir dados é a saída de quem não tem **nada** a receber, não a de
quem está esperando conteúdo.

### O que mudou

As duas regras trocaram de lugar. Nada mais: nenhuma condição foi reescrita, nenhum código do
painel foi tocado. **Era exatamente para isso que a tabela existe** — em 30/08 esse mesmo pedido
teria sido uma expressão booleana no meio do montador da pergunta, e mudar de ideia custaria uma
releitura do fluxo inteiro.

Ordem hoje:

1. pede resposta pessoal (áudio, vídeo, texto longo)
2. etiqueta que dispensa da fila (engajado)
3. voltou por outro anúncio
4. última é só reação (figura, emoji, link)
5. **conteúdo pedido** ← subiu
6. **sem etiqueta de cidade** ← desceu
7. nunca perguntaram interesse
8. já pedi hoje e não veio nada

O comentário da regra de cidade agora registra a reversão e o motivo dela, com as palavras dele —
senão daqui a um mês alguém "conserta" a ordem de volta.

### Arquivos

`src/lib/sugestao.js` (ordem + comentário), `tests/sugestao.test.mjs` (a asserção que fixava a
prioridade antiga passou a fixar a nova, e ganhou o caso de "sem nada a enviar"),
`manifest.json` (0.26.0 → 0.27.0). Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — Voltou por outro anúncio sem responder o formulário

**Relato dele:** *"uma situação frequente é a pessoa ignorar o pedido de dados e retornar por
outro anúncio; quando isso acontece ou eu concluo e vou pra próxima ou mando mensagem do
momento"*.

### O que a regra impede

**Pedir os dados de novo** — que é exatamente o que a rodada sugeria, porque a regra "sem
etiqueta de cidade" casava. A pessoa já viu o formulário e escolheu não responder; repetir vira a
terceira mensagem igual. Por isso esta regra fica ACIMA daquela.

### Dois desfechos, escolhidos pelo que já saiu hoje

Ele descreveu duas saídas, e a regra escolhe entre elas em vez de fixar uma:

- mensagem do momento ainda não foi hoje → **tecla 5** (a pessoa recebe alguma coisa);
- já foi, ou não há mensagem do momento configurada → **tecla 3**, só concluir.

Mandar duas mensagens do momento no mesmo dia é o que faz a conta parecer robô — a mesma razão
que já tirava o destaque do "pedir dados" repetido.

Para isso a tabela passou a aceitar **`tecla` como função**, além de string. É a primeira
situação que precisa disso, e é uma linha em `sugerirAcao`.

### A trava do falso positivo

O sinal é a última mensagem casar com a frase do aceite do anúncio — que na configuração dele é
**"Olá!"**. Sozinha, ela casaria com meio mundo.

Por isso a regra exige **duas** coisas juntas: o formulário já ter saído alguma vez, **e** o
contato continuar SEM etiqueta de cidade. É isso que separa "ignorou o formulário" de "respondeu
começando com Olá" — quem respondeu tem cidade, e a regra não casa. Tem teste para os dois lados.

E áudio continua vencendo: quem voltou por anúncio mas mandou um áudio junto recebe "responder à
mão", não "concluir".

### Arquivos

`src/lib/sugestao.js` (regra + tecla dinâmica), `src/panel/panel.js` (`voltouPorOutroAnuncio`,
`momentoHoje`), `tests/sugestao.test.mjs` (7 asserções novas),
`manifest.json` (0.25.0 → 0.26.0). Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — Etiqueta que dispensa da fila: "engajado" vem com Pular sugerido

**Pedido dele:** *"etiqueta engajado, quando estiver no automatizado pode ser pulado"*.

Faz sentido pelo próprio objetivo da rodada: o trabalho dela é transformar desconhecido em
engajado. Quem já chegou lá não precisa de formulário nem de pergunta de interesse.

### Configurável, e não fixo no código

Campo novo na aba Automatizado — **"Etiquetas que a rodada pode pular"**, padrão `engajado`,
separadas por vírgula. Casa por **pedaço do rótulo, sem acento e sem caixa**: `engajado` pega
"ENGAJADO/BIZA" (a da print dele) e "Apoiador Muito engajado". Vazio não pula ninguém.

Fixar "engajado" no código obrigaria ele a me pedir toda vez que quisesse acrescentar uma —
e ele avisou desde o começo que ia acrescentar situações conforme aparecem.

A comparação é por **rótulo normalizado, nunca por id**: o CRM tem rótulos repetidos com ids
diferentes, armadilha que já produziu 1293 contatos errados neste projeto.

### A prioridade que importa, e ela veio da própria print dele

A regra fica **abaixo** de "pede resposta pessoal". O contato da print é os dois ao mesmo tempo:
tem `ENGAJADO/BIZA` **e** acabou de mandar um áudio de 24s sobre perseguição religiosa.

Pular ali calaria justamente o apoiador mais próximo — o que mais merece resposta. Então a
sugestão que aparece continua sendo a **6, responder à mão**, e há teste fixando exatamente isso.

### Sugere PULAR, não CONCLUIR

Pular deixa o atendimento aberto. Fechar quem está engajado sem dizer nada é decisão maior do que
uma sugestão deve tomar — e continua a um toque de distância, na tecla 3, se ele quiser.

### Arquivos

`src/lib/store.js` (`etiquetasQuePulam`), `src/lib/sugestao.js` (regra),
`src/panel/panel.js` (`etiquetaQueDispensaDaFila` + campo na Config),
`tests/sugestao.test.mjs` (6 asserções novas), `manifest.json` (0.24.0 → 0.25.0).
Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — O parser passa a ouvir o áudio, com a trava que torna isso aceitável

**Pedido dele:** *"sim aplique falta adicionar quando for assim"* — em resposta à decisão que eu
tinha deixado em aberto: alimentar o parser com transcrição de áudio.

### O ganho, e o risco que vem junto

Nesta base muita gente responde **falando**. O painel dizia "Cidade: (vazia)" para quem tinha dito
a cidade em voz alta — a informação estava lá e ninguém lia.

O risco é que **ninguém digitou aquilo**: é fala passada por reconhecimento automático, com os
erros disso, e o que sai daqui vai para o CRM de eleitor real, onde etiqueta fica para sempre.

### A trava, e por que são DUAS marcas

`extract.rebaixarParaPalpite` rebaixa tudo que vem de transcrição:

- **`confidence: 'aproximada'`** — mantém o valor fora da gravação automática, porque só `crm` e
  `exata` são gravados sozinhos;
- **`informada: false`** — impede substituir o que já está no CRM, porque a regra de "a pessoa
  informou outra cidade" exige texto ESCRITO, e áudio ouvido por máquina não é isso.

Cada uma fecha um caminho diferente, e nenhuma cobre a outra: sem a primeira, a cidade entra
sozinha; sem a segunda, ela sobrescreve a que já estava lá.

A origem sai na tela dizendo **"— ouvido no áudio"**, para dar para conferir antes de aceitar.

### A ordem também é trava

A passada da transcrição roda **depois** da normal, e `applyGuesses` não sobrescreve o que já
está no rascunho. Então **o que a pessoa escreveu sempre ganha do que ela falou**.

### Onde mora, e por quê

Em `src/lib/extract.js` (puro, testado), não solto no `panel.js`. É a regra do projeto: lógica que
decide o que vai para dado real tem teste. São 8 asserções, e o comentário delas diz o que
acontece se caírem — transcrição voltaria a poder ser gravada sozinha.

### Arquivos

`src/lib/extract.js` (`rebaixarParaPalpite`), `src/panel/panel.js` (segunda passada no `load`),
`tests/parser.test.mjs` (8 asserções novas), `CLAUDE.md`, `manifest.json` (0.23.0 → 0.24.0).
Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — "O copiar falhou": copiava cinco [audio] e nada mais

**Relato dele**, com print do que ele colou na IA:

```
responda -- Mensagens de Janete da Silva:
Olá! Eu apoio o Flávio, Zucco, Hiago e Capitão Martim
[audio]
[audio]
[audio]
[audio]
[audio]
```

O botão **funcionou** — copiou. O que estava errado era o conteúdo: cinco marcações e nenhuma
palavra do que ela disse. Inútil justamente no caso que o botão existe para servir.

### A transcrição estava na mensagem o tempo todo

`details.transcription.text`. Conferido ao vivo: de 12 mídias olhadas, **9 tinham transcrição**,
uma delas com 2838 caracteres. É exatamente o texto que a plataforma mostra na tela sob
"Transcrição" — e que ele já usava lendo com os olhos.

A extensão nunca leu esse campo. `entrantes` pegava só `m.text`, que em áudio vem vazio.

### Agora

`getConversation` devolve o texto da transcrição em `entrantes[].texto`, com a marca
`transcrito: true`. O copiar sai assim:

```
[audio transcrito] Obrigada, eu já estou falando de você para meus filhos…
```

**A marca não é enfeite.** Quem for ler — a IA ou ele — precisa saber que aquilo é fala passada
por reconhecimento automático, com os erros disso, e não o que a pessoa escreveu. Mídia que
realmente não tem transcrição passou a dizer `[audio, sem transcrição]`, que é diferente de "não
consegui ler".

### O que NÃO mudou, e é decisão a tomar

`incoming` — a base do parser — continua sem transcrição. Alimentar o parser com fala
reconhecida por máquina faria **nome e cidade saírem de texto que ninguém escreveu**, e este
projeto grava isso no CRM de eleitor real. É ganho grande (a Janete disse a cidade no áudio) e
risco novo na mesma medida; fica para ele decidir, não para eu decidir sozinho.

### Arquivos

`src/lib/api.js` (`entrantes` com transcrição), `src/panel/panel.js` (o copiar),
`CLAUDE.md`, `manifest.json` (0.22.1 → 0.23.0). Dez suítes passando, 29 módulos parseando.

---

## 2026-08-30 — A extensão parou de carregar: uma quebra de linha dentro de uma string

**Relato dele:** *"a extensão não está carregando"* — e depois o print do `src/content.js`, o
carregador, apontando para o `console.error('[WhatsFill] falha ao carregar o painel:', err)`.

### O erro, e a minha conclusão errada no meio do caminho

Eu tinha olhado o console pela ferramenta de navegador, achado zero erros e concluído que **não
era o meu código** — que era estado do Chrome (extensão desligada ou painel escondido). Estava
errado: a ferramenta não capturava o console do content script, que roda em mundo isolado. O
print dele apontou para o lugar certo.

**A causa:** no botão "Copiar a conversa" de ontem, um `.join('

')` virou

```js
.join('

');
```

— uma string com quebra de linha **crua**, que é erro de sintaxe. Acidente de escape ao gerar o
patch por script: o `
` foi interpretado antes de chegar ao arquivo. O mesmo acidente comeu as
barras do `s` e do `p{...}` numa regex mais cedo, e ali eu peguei porque o teste falhou.

### Por que passou por mim

Eu conferia com `node --check`, que analisa `.js` como **CommonJS** — modo solto. O Chrome carrega
como **ES module**, que é sempre strict. O `--check` disse "SINTAXE OK" e o navegador disse
"Invalid or unexpected token".

E o defeito era **invisível na aba**: o content script morre antes de desenhar qualquer coisa,
então não há painel, não há erro na tela, não há nada. O único rastro é o `console.error` do
carregador — que é justamente o que ele fotografou.

### O que impede a repetição

`tools/checar-modulos.mjs` (novo): importa todo arquivo de `src/` como ES module e reclama **só de
`SyntaxError`** — erro de execução fora do navegador (`window is not defined`) é esperado e
ignorado. Roda em 29 arquivos e teria pego este em um segundo. Entrou no `CLAUDE.md` como passo
obrigatório antes de dar tarefa por concluída.

### Arquivos

`src/panel/panel.js` (o `join` e o template consertados), `tools/checar-modulos.mjs` (novo),
`CLAUDE.md`, `manifest.json` (0.22.0 → 0.22.1). Dez suítes passando, 29 módulos parseando.

---

## 2026-08-30 — Áudio e texto longo pedem você, não modelo — e o copiar que ele fazia à mão

**Relato dele**, com print: *"já com etiquetas, nesse caso ela mandou um audio que resultou em um
texto gigante que vou mandar pra uma IA ler e fazer a resposta para eu copiar e mandar"*.

### O caso mostra um limite do desenho anterior

Contato **já classificado** — etiquetas FORMIGUEIRO, Central, ADS; cidade Formigueiro; conteúdo
pedido ADS; modelo mapeado. A caixa sugeria, corretamente pelas regras de ontem, *"Sugiro a 1:
pediu ADS e há modelo mapeado — mande."*

E estava errado. Ela tinha mandado um **áudio de 1min13** contando dos três filhos, da igreja, do
convite para almoçar na casa dela. Mandar modelo aprovado para quem acabou de dizer isso parece
deboche.

**A lição, que vale além desta regra:** ter etiqueta não quer dizer que a conversa acabou. O que a
pessoa acabou de dizer manda mais do que o que ela pediu semana passada.

### A regra

Áudio, vídeo, documento, ou texto com **400+ caracteres** → *responder à mão* (tecla 6). Vai em
**primeiro**, acima de todas as outras.

400 e não 200: mensagem de apoiador animado passa fácil de 200 e ainda é caso normal da rodada. A
transcrição de um áudio de um minuto passa de 600 — é essa a fronteira que interessa. Mídia entra
pelo TIPO, então funciona mesmo quando a plataforma não devolve transcrição no texto.

### E o passo manual virou um clique

Botão **"Copiar a conversa"** dentro da caixa da rodada. Copia só as mensagens DO CONTATO (é o que
a IA precisa ler; as nossas já são respostas prontas dele), com a mídia sem texto marcada como
`[audio]` para a IA saber que houve algo ali.

Não fecha a pergunta, não para a rodada e **não manda nada para lugar nenhum** — o texto vai para
a área de transferência da máquina dele, e quem escolhe onde colar é ele. Se o navegador recusar a
área de transferência, ele diz isso em vez de fingir que copiou.

### Arquivos

`src/lib/cortesia.js` (`pedeRespostaPessoal`, `ultimaPedeRespostaPessoal`),
`src/lib/sugestao.js` (regra em primeiro), `src/panel/panel.js` (`montarCopiarConversa` +
contexto), `tests/cortesia.test.mjs` e `tests/sugestao.test.mjs`,
`manifest.json` (0.21.0 → 0.22.0). Dez suítes passando.

---

## 2026-08-30 — Regra nova: última mensagem é figura, emoji ou link → mensagem do momento

**Pedido dele:** *"ultima mensagem é imagem, sticker, emoticon, link, mandar mensagem do momento,
adicione essa sugestão"*. Primeira situação acrescentada depois que a tabela de regras existiu — e
o custo foi o previsto: uma entrada na lista, uma função pura e os testes.

### O caso, e por que ele é diferente da cortesia

`soCortesia` olha a janela de 3 mensagens e exige que TODAS sejam cumprimento/link/figura — é a
regra da rodada dos Novos. `ehSoReacao` olha UMA mensagem, a última, e **"bom dia" escrito não
conta**: o caso aqui é a pessoa que manda um 👍, uma figurinha ou um link e fica esperando. Não há
o que responder ao conteúdo, e ignorar também não serve.

Emoji com **tom de pele** e seletor de variação entram na conta (👍🏽 é um emoji só). E só
pontuação NÃO conta: "..." ou "!!!" sozinho não merece a mensagem do momento.

### Ela vem em PRIMEIRO, acima da regra de cidade

Decisão que vale registrar porque contraria o "sempre" da regra anterior: responder um 👍 com "me
manda seu nome e cidade" lê como robô que não olhou a tela. O sinal mais recente é o que a pessoa
acabou de fazer. **Se ele preferir o contrário, é trocar as duas de lugar na lista** — e é só isso
mesmo, que era o objetivo do desenho de ontem.

### Um bug que os testes pegaram antes de ir para o ar

A regex de emoji tinha a flag `g`, e `RegExp` com `g` guarda o `lastIndex` entre chamadas:
`test()` na mesma instância devolvia resultado diferente na SEGUNDA vez com o mesmo texto. Só
apareceria no segundo contato da rodada, como "às vezes sugere e às vezes não" — o tipo de defeito
que este projeto já pagou caro. São duas instâncias agora: uma com `g` para apagar, uma sem para
testar. Há teste chamando três vezes seguidas.

### Também

O painel passou a guardar `state.entrantes` (mensagens com o tipo junto), nos dois pontos em que
carrega a conversa. Sem isso a figura continuava invisível para a decisão.

### Arquivos

`src/lib/cortesia.js` (`ehSoReacao`, `ultimaEhSoReacao`), `src/lib/sugestao.js` (regra nova em
primeiro), `src/panel/panel.js` (`state.entrantes` + contexto), `tests/cortesia.test.mjs` e
`tests/sugestao.test.mjs`, `manifest.json` (0.20.0 → 0.21.0). Dez suítes passando.

---

## 2026-08-30 — A recomendação sai de dentro do código e vira tabela de regras

**Pedido dele:** *"vamos trabalhar nas sugestões de mensagem… deixe destacado em cima das
mensagens, quando a pessoa não tiver etiqueta de cidade, sempre pedir dados, vou adicionando
situações e sugestões conforme aparecer"*.

A última frase é a que definiu o desenho: se ele vai acrescentar situações, o custo de
acrescentar uma tem que ser uma linha.

### Como era, e por que não dava para crescer

O destaque nascia de **três expressões `primaria:` independentes**, no meio do montador da
pergunta:

```
primaria: !enviadoHoje
primaria: !podeEnviar && !podePerguntarInteresse && !pedidoHoje
primaria: !podeEnviar && !interessePerguntado
```

Três problemas: acrescentar uma situação exigia mexer em condição booleana no meio do código;
não dava para dizer, olhando, qual tinha vencido; e **duas podiam acender ao mesmo tempo** num
contato que casasse com as duas condições.

### Agora

`src/lib/sugestao.js`, puro e testado: uma **lista ordenada** onde a primeira regra que casa
vence. Acrescentar uma situação é acrescentar uma entrada com `quando` e `motivo`, na posição da
prioridade dela. O painel lê a lista inteira e um lugar só decide o destaque.

### A regra que ele pediu vem em PRIMEIRO

*Sem etiqueta de cidade → pedir dados*, acima até de mandar o conteúdo pedido. A razão é o
trabalho todo: a API só filtra por etiqueta, então contato sem etiqueta de cidade **não entra em
lista nenhuma** — mandar o conteúdo resolve hoje e perde a pessoa amanhã.

**A exceção que mantive:** já pedido hoje não é recomendado de novo. Pedir duas vezes no mesmo
dia soa a robô, e a própria caixa já avisava isso. A opção continua na tela; ela só deixa de ser
a sugerida.

### O que torna uma regra agressiva segura

**Ela só recomenda, nunca decide.** Todas as opções continuam na tela e todas as teclas continuam
valendo. O pior caso de uma regra errada é um destaque no lugar errado — não uma mensagem enviada
errada. Foi isso que me deixou implementar "sempre" sem hesitar.

### Em cima das mensagens

A recomendação virou uma faixa no topo da caixa, antes dos dados do contato e das opções, com o
**motivo escrito**. O destaque na tecla dizia QUAL era a sugerida e nunca POR QUÊ — e o porquê é
o que permite discordar dela.

### Arquivos

`src/lib/sugestao.js` (novo), `tests/sugestao.test.mjs` (novo, 19 asserções),
`src/panel/panel.js`, `src/panel/panel.css`, `CLAUDE.md`, `manifest.json` (0.19.0 → 0.20.0).
Dez suítes passando.

---

## 2026-08-30 — 118 mensagens invisíveis: por que o conteúdo "do dia anterior" nunca era reconhecido

**Relato dele:** *"bote a etiqueta também, a extensão não reconhece o conteúdo quando é do dia
anterior e ter que abrir o restante da conversa"*.

A segunda metade da frase é o achado do dia, e vale muito mais que a primeira.

### A medição

Peguei um atendimento qualquer da fila dele e olhei a paginação:

- sessão criada em **20/07/2026**, ainda aberta em **30/08** — **41 dias**;
- **168 mensagens**, em **4 páginas** de 50;
- a página 1 cobria de **10/08 a 30/08**.

`getMessages` lia só a página 1. **118 mensagens eram invisíveis para a extensão** — e é nelas
que mora o pedido de conteúdo de "outro dia". O parser não estava errando: ele nunca tinha visto
a mensagem.

Isso também derruba a hipótese que eu teria seguido por conta própria (sessão nova a cada dia).
Sessão aqui dura semanas.

### O conserto, e por que ele é barato

200 por página, e uma segunda página quando `isLastPage` vier `false` (teto de 2 páginas / 400
mensagens).

**Subir o `pageSize` não custa requisição nenhuma**: é a MESMA chamada, com resposta maior. Nesta
API o que derruba a plataforma é **número de requisições**, não tamanho de resposta — foi o que
tornou a decisão fácil. O teto de 2 páginas existe para a cauda longa não virar 4 requisições por
contato numa rodada.

### O que isso muda além do conteúdo

Tudo que lê `incoming` passa a enxergar semanas em vez de dias: parser de nome e cidade,
etiquetas de conteúdo e **`precisaDeVoce`**. O último merece atenção — um "preciso de ajuda"
escrito há três semanas agora separa o contato para revisão dele. É o comportamento certo (o
pedido foi real e continua sem resposta), mas é mudança de volume, e é onde olhar se a fila de
revisão crescer de repente.

### A etiqueta no fecho sem reconhecimento

Ele mandou botar, e o argumento dele resolve a objeção que eu tinha levantado: o conteúdo
**foi** pedido, só que numa mensagem que a extensão não lia. A etiqueta não está sendo inventada
— está sendo posta por quem leu a conversa inteira na tela. Fica com o motivo *"posta por você no
fecho (o parser não reconheceu)"*, para depois dar para distinguir do que veio do parser.

Etiqueta que não existe no CRM **não é criada**, e a falha não cancela o envio: o aviso vai no
status final, junto do "Enviado e classificado".

### Arquivos

`src/lib/api.js` (`getMessages` paginado), `src/panel/panel.js` (`runFecharComConteudo`),
`CLAUDE.md`, `manifest.json` (0.18.0 → 0.19.0). Nove suítes passando.

---

## 2026-08-30 — "Libere o botão mesmo sem reconhecer": vai o conteúdo preferido

**Pedido dele**, com print do cartão "Atender o pedido e encerrar" travado e a tarja *"Nenhum
conteúdo reconhecido nas mensagens deste contato"*: *"libere o botão mesmo sem reconhecer"*.

### O que eu não podia fazer, e o que fiz no lugar

Liberar o botão sem mais nada deixaria uma pergunta sem resposta: **qual modelo ele enviaria?** O
fluxo pega o modelo pelo NOME do conteúdo reconhecido; sem conteúdo não há nome, e escolher um
entre os 19 aprovados seria o painel chutando — o erro mais caro deste fluxo.

A saída já existia no projeto: **o "conteúdo preferido" da Config** (`conteudoPreferido`, hoje
"Conteúdo Flávio"). Ele nasceu para desempatar quando o contato casa com dois conteúdos; agora
serve também de padrão quando não casa com nenhum. Continua sendo um modelo que **ele** escolheu,
não um chute.

Se o preferido estiver vazio, o botão dispara e explica que não há modelo — em vez de mandar
qualquer coisa.

### O que deliberadamente NÃO acontece

**A etiqueta de conteúdo não é aplicada** nesse caminho. Mandar o modelo é decisão dele, agora,
olhando a conversa. Gravar no CRM que a pessoa PEDIU aquele conteúdo seria inventar uma
classificação que ninguém leu na mensagem — e ela ficaria lá para sempre, mudando as próximas
rodadas deste contato. Enviar é reversível pela conversa; etiqueta errada em produção não é.

### Mais de um conteúdo continua travado

Ali o caso é outro: o painel sabe que existem DOIS caminhos certos, e escolher entre modelos que a
pessoa realmente pediu é diferente de ter um padrão para quando ela não pediu nada. A tarja
continua mandando escolher à mão.

### Na tela

A tarja vermelha de bloqueio virou dica: *"Nenhum conteúdo reconhecido — vai o preferido da
Config. Confira a conversa antes: o modelo sai como se ele tivesse pedido esse conteúdo."*

### Arquivos

`src/panel/panel.js` (cartão "Atender o pedido e encerrar" e `runFecharComConteudo`),
`manifest.json` (0.17.0 → 0.18.0). Nove suítes passando.

---

## 2026-08-30 — "Continua sem diminuir": o número não estava travado, era o número errado

**Relato dele:** *"continua sem diminuir o número o gatilho deve ser quando manda concluir e
atualizar"*.

### Fiz o gatilho que ele pediu — e antes disso descobri que ele não bastaria

Toda conclusão feita pelo painel agora reconta (`concluirPeloPainel`, nas 9 chamadas de
`clickConcluir`), e só quando a conclusão dá certo: recontar depois de um Concluir que falhou
traria o mesmo número e faria parecer que o contador é que está quebrado.

**Mas o gatilho não era a causa.** Antes de mexer, medi o total duas vezes com alguns minutos de
diferença: **353 → 359**. Ele estava SUBINDO. Chega gente nova mais rápido do que ele conclui,
então "abertos" nunca ia diminuir — e ele estava certo ao dizer que não diminuía, só que o defeito
não era atualização, era **a escolha do número**.

Um contador de progresso feito de "o que sobrou" mostra o número crescendo justamente num dia de
trabalho bom.

### O número certo

`statuses=COMPLETED` + `userId` + `timestampFilter` na meia-noite local = **quantos você
concluiu hoje**. Só sobe, e sobe por causa do trabalho dele. Medido: 82 hoje, contra 4159 na vida
inteira sem o filtro.

Os status válidos foram descobertos sondando a API, não adivinhados: `IN_PROGRESS`, `COMPLETED`
e `PENDING` respondem; RESOLVED, DONE, CLOSED, FINISHED, ARCHIVED, ENDED, NEW, WAITING e OPEN
devolvem **400**. E `timestampFilter` sem `timestampField` filtra pela atualização (a conclusão);
com `createdat` daria 38 em vez de 82 — conferidos lado a lado.

### A janelinha agora

- **Destaque: "82 concluídos hoje"** — o que ele fez.
- Abaixo: "356 ainda abertos em Meus" — o que falta.
- Barra: a fatia do dia que já saiu da mão dele (concluídos sobre tudo que passou por ela hoje),
  com teto e piso porque o denominador oscila e um dia recém-começado divide por zero.

### Arquivos

`src/lib/api.js` (`contarConcluidosHoje`, `contarMeuDia`, `STATUS_CONCLUIDO`),
`src/panel/panel.js` (`concluirPeloPainel` e o novo destaque), `CLAUDE.md`,
`manifest.json` (0.16.0 → 0.17.0). Nove suítes passando.

---

## 2026-08-30 — "Atendi e não atualizou": o contador passa a reagir ao trabalho, não ao relógio

**Relato dele:** *"atendi e não atualizou, deve atualizar sozinho, faça uma barra de progresso e
um pouco menor a caixa"*.

### O erro: eu tinha ligado o contador no relógio, não no trabalho

A janelinha atualizava a cada 60s e nada mais. Concluir um atendimento é o instante EXATO em que
o número muda, e era justamente o momento em que ela não fazia nada — ele olhava logo depois de
atender, via o número velho, e concluía que estava quebrada. Estava: um contador de progresso que
não se mexe quando você progride não conta nada.

### Agora são três gatilhos, e os dois primeiros são o trabalho

1. **Trocou de atendimento** (`sessionChanged`) — concluiu e foi para o próximo.
2. **Concluiu e ficou na mesma conversa** — o campo de mensagem some quando o atendimento fecha,
   e é esse o sinal (`anterior.hasComposer && !next.hasComposer`).
3. **Relógio de 45s**, agora só como rede de segurança.

**`conversaMudou` foi descartado como gatilho de propósito:** ele dispara a cada mensagem que
chega, e viraria uma requisição a cada poucos segundos numa conversa movimentada.

### As duas travas que impedem isso de virar rajada

- **Junta os pedidos colados** (`CONTADOR_ESPERA_MS`, 2,5s): passar a fila rápido dispara uma
  troca por clique, e sem juntar seria uma requisição por clique numa API que já derrubou a
  plataforma. O atraso ainda ajuda por outro motivo: a plataforma leva um instante para registrar
  a conclusão, e contar na hora traria o número velho de qualquer jeito.
- **O agente ficou em cache** (`api.getAgente`): quem está logado não muda no meio da sessão.
  Sem isso, cada atualização custaria DUAS requisições em vez de uma.

### Barra e tamanho

Barra de progresso enchendo conforme os atendimentos saem, com teto e piso: sem eles ela ficaria
**negativa** quando chega mais gente do que saiu, e passaria de 100% se o total caísse abaixo de
zero — nos dois casos mentiria. O denominador é quanto havia quando ele abriu: é o dia de trabalho
dele que ela mede, não a fila inteira do CRM.

A caixa encolheu (230px, menos padding, título e número menores). Razão registrada no CSS: ela
fica **aberta o tempo todo** por cima da conversa, enquanto a pergunta da rodada aparece, é
respondida e some — o que é permanente na tela tem que ocupar menos.

### Arquivos

`src/panel/panel.js` (`agendarContagem` e os dois gatilhos), `src/lib/api.js` (cache do agente),
`src/panel/panel.css` (`.wf-contador*`), `manifest.json` (0.15.0 → 0.16.0).
Nove suítes passando.

---

## 2026-08-30 — O contador vira janelinha arrastável, para acompanhar sem trocar de aba

**Relato dele:** *"eu quero uma contagem para eu acompanhar pode ficar em um popup arrastavel, da
maneira que está não posso ver meu progresso"*.

Ele está certo e o defeito é de desenho meu: pus o número **dentro da aba Automatizado**, e o
trabalho acontece na conversa. Número que exige trocar de aba para consultar não acompanha nada.

### O que mudou

Janelinha flutuante, aberta pelo botão do cartão. Ela segue as regras da caixa da rodada — e não
por estética: a camada é `pointer-events: none` e sem fundo, então **a conversa continua legível
e clicável por baixo**; arrasta pelo título; a posição fica no `settings`.

**Chave de posição própria (`contadorPos`).** Reaproveitar `perguntaPos` faria a janelinha e a
pergunta da rodada disputarem o mesmo canto da tela — arrastar uma moveria a outra. `tornarArrastavel`
passou a receber qual posição lembrar, com `perguntaPos` como padrão, então as três caixas que já
existiam não mudaram de comportamento.

### O progresso é a DIFERENÇA, não o total

Guardo quanto havia quando você abriu e mostro quantos saíram desde então. O total sozinho **sobe**
quando chega gente nova, e você teria a impressão de estar andando para trás justamente num dia de
muito movimento. A linha diz as duas coisas: quantos saíram e quantos eram.

Erro de rede **não fecha a janelinha nem apaga o último número bom** — some com o dado justamente
quando a rede está ruim, que é quando mais se quer saber onde se estava. O motivo vai no rodapé.

### 60 segundos, e não menos

Nesta API rajada de requisição já derrubou a plataforma. Um contador não vale um pedido por
segundo; o botão atualiza na hora quando ele quiser.

### Não conferido aqui

`tools/checar-pergunta.mjs` (que prova que a caixa não bloqueia a conversa) precisa de Playwright,
que não está instalado nesta máquina. A janelinha reusa as MESMAS classes da caixa da rodada e o
CSS da camada não foi tocado — a regra nova é só o tamanho do número.

### Arquivos

`src/panel/panel.js` (`abrirContadorFlutuante`, `tornarArrastavel` com chave de posição),
`src/panel/panel.css` (`.wf-contador-numero`), `src/lib/store.js` (`contadorPos`),
`manifest.json` (0.14.0 → 0.15.0). Nove suítes passando.

---

## 2026-08-30 — O número de "Meus" que a plataforma não mostra: 76 na tela, 353 de verdade

**Pedido dele:** *"faça a extensão pegar o número de atendimentos abertos nos meus - todos, quero
visualizar, a plataforma não exibe corretamente"*.

### Ele estava certo, e a causa é explícita

Ao abrir "Meus", o app chama:

```
GET /chat/v6/session?skipCount=true&page=1&pageSize=50&includeDetails=All
    &statuses=IN_PROGRESS&userId=<meu>&sessionType=INDIVIDUAL&orderBy=createdat
```

**`skipCount=true` manda a API não calcular o total.** A resposta volta com `totalItems: 0` — o
número do badge é outra coisa. Medido lado a lado, na mesma tela e no mesmo minuto: badge **76**,
total real **353**.

Não foi deduzido do bundle: a requisição foi **observada na rede** ao clicar na aba. O bundle deu
os nomes dos parâmetros, a rede deu os valores que a plataforma realmente usa.

### Como a extensão descobre quem é você

`GET /core/v1/agent/me` → o campo `userId` é exatamente o que a fila manda em `?userId=`.
Isso importa mais do que parece: o `userId` também está dentro do Bearer, mas o token vive fechado
no transporte e **nunca chega ao painel no modo janela**. Perguntar à API funciona nos dois
contextos; decodificar o token só funcionaria num.

`pageSize=1` de propósito — só o `totalItems` interessa, e trazer 50 sessões para contar uma
seria gastar rede numa API que já caiu por rajada.

### Na tela

Cartão novo no topo da aba Automatizado, com botão **Contar**. A contagem nasce do **clique**:
`renderAll()` roda o tempo todo, e rede disparada de dentro de um `render*` vira uma requisição
por redesenho. Falha vira o motivo na tela e o botão de novo, nunca nova tentativa automática.

### Arquivos

`src/lib/api.js` (`getAgente`, `contarMeusAbertos`), `src/panel/panel.js`
(`renderCartaoMeusAbertos`), `CLAUDE.md`, `manifest.json` (0.13.0 → 0.14.0).
Nove suítes passando.

---

## 2026-08-30 — "Abre a conversa e não manda nada": quem cumprimentou passa a ser respondido

**Relato dele:** *"está falhando em pedir dados ao iniciar atendimento"*, e o sintoma exato,
perguntado antes de mexer: **"somente abre a conversa e não manda nada"**. Junto, o pedido: quem
deu bom dia / boa tarde / boa noite, ou mandou link ou imagem nas últimas 3 mensagens, deve
receber **a mensagem do momento** ao iniciar.

### O sintoma não era defeito, era o desenho — e ele tem razão de reclamar

"Abre e não manda nada" é exatamente o que `assumirParaTriagem` faz: assume o atendimento para
tirar da fila, e não envia. Quem não trazia a frase do aceite do anúncio caía ali. Funcionava
como projetado e mesmo assim está errado: **a pessoa falou com o gabinete e não teve resposta.**

### E havia um caso pior, que ninguém tinha visto

`api.getIncomingText` filtra `m.text`. Quem manda **só uma figura** — o "bom dia" ilustrado, que
nesta base é comum — chegava à rodada como *"não escreveu nada"*: a conversa parecia vazia porque
a única mensagem não tinha texto. Agora `getConversation` devolve também `entrantes`, com
`{texto, tipo}` e **sem** filtrar. `incoming` fica como estava, porque é a base do parser e
parser não lê figura.

Os valores de `type` foram conferidos no bundle do app, não chutados: `TEXT`, `IMAGE`,
`STICKER`, `AUDIO`, `VIDEO`, `DOCUMENT`, e direção `TO_HUB`/`FROM_HUB`.

### A regra (`cortesia.soCortesia`), e por que é conservadora

Cumprimento, link ou figura nas últimas 3 mensagens → mensagem do momento, e conclui.

**Exige que TODAS as mensagens da janela sejam cortesia.** Aqui o erro caro é o falso positivo:
*"Bom dia, preciso falar com o deputado"* tem substância, e responder "Feliz Dia dos Pais" a isso
é responder ao lado. Sobrando qualquer substância, o contato segue o caminho de antes. Errar para
o silêncio custa um contato na pilha dele; errar para o outro lado é resposta fora de contexto
saindo de um mandato.

**Áudio ficou de fora de propósito:** foi figura que ele pediu, e áudio pede outra resposta.

### Módulo próprio, e não dentro do `triagem.js`

`triagem.js` está neste branch **sem uso** — o "Responder pessoalmente" foi revertido (`5a43b77`,
`bd12e46`) e o `panel.js` nem o importa. Pendurar a cortesia nele ressuscitaria código tirado de
propósito, e faria o envio depender de arquivo não commitado. Daí `src/lib/cortesia.js`, que é
puro, sem dependência e igual nos dois branches.

**Consequência a registrar:** neste branch não há `precisaDeVoce` rodando antes, então a única
proteção contra "bom dia, preciso de remédio" é a regra ser conservadora — e ela é: essa frase
tem substância e não casa. No branch +IA a triagem roda antes, como segunda camada.

### O envio passa pelas mesmas travas do formulário

Variável faltando, canal fora do ar, anti-duplicata, `contatosTratados`, variantes e registro de
envio. Envio é envio. Sem "Mensagem do momento" configurada, volta ao comportamento antigo —
**dizendo que foi por isso**, senão vira "às vezes manda, às vezes não".

### Arquivos

`src/lib/cortesia.js` (novo), `src/lib/api.js` (`entrantes`), `src/panel/panel.js`
(`processarNovo`, `responderComMomento`), `tests/cortesia.test.mjs` (novo, 23 asserções),
`CLAUDE.md`, `manifest.json` (0.12.4 → 0.13.0). Onze suítes passando.

---

## 2026-08-20 — A aba Cidades só gasta rede quando ele clica nela

**Pedido dele:** *"faça com que a aba cidades não abra junto, somente quando eu realmente clicar
nela"*.

**Primeiro, o que já era verdade:** a aba nunca se abre sozinha. O painel nasce em "Respostas"
(`state.tab: 'respostas'`), a aba escolhida não é guardada entre sessões, e `renderAll` desenha só
o ramo da aba ativa. Conferido antes de mexer, para não "consertar" o que não estava quebrado.

**O que realmente rodava sem ele pedir:** `renderCidades()` disparava
`tagsLib.allTags()` + `tagsLib.regionTagIds()` **no desenho**. E desenho não é escolha —
`renderAll()` roda o tempo todo: troca de atendimento, mensagem nova, cada `setStatus`. Enquanto a
aba estivesse aberta, cada redesenho refazia a tentativa. A guarda era
`if (!c.etiquetasDisponiveis.length)`, que só segura depois do **sucesso**: com a listagem
falhando — e ela falha justamente quando o servidor está limitando —, virava uma tentativa de
listar até 500 etiquetas por redesenho, exatamente no momento em que o certo era parar.

**O conserto:** o carregamento nasce do **clique na aba** (`prepararCidades`, chamado do handler
do botão de navegação), não do desenho. `renderCidades()` ficou sem efeito colateral nenhum — só
DOM e duas funções puras do `categorizar.js`. `cidadesPreparando` segura as duas pontas: não
dispara duas vezes se ele clicar rápido, e **não tenta de novo sozinho** se falhar.

**Falha agora aparece.** Antes o erro ia só para o console e o seletor ficava eternamente em
"Carregando a lista de etiquetas…" — sem jeito de saber que tinha falhado. Agora `erroEtiquetas`
vai para a tela, com um botão "Carregar a lista de etiquetas" para tentar de novo. Repetir é
decisão dele: listagem que falha costuma ser limite de requisições, e insistir sozinho piora.

Continua valendo o de sempre: **ler a base e gravar lotes só saem no botão.** Isso nunca foi
automático.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`prepararCidades`, `cidadesPreparando`,
`cidades.erroEtiquetas`, handler da navegação, `renderCidades` sem efeito colateral).
Manifesto 0.12.3 → **0.12.4**. Oito suítes passando.

---

## 2026-08-20 — "Erro de carregamento ao iniciar o atendimento": era a extensão disputando a rede

**Relato dele:** *"veja se a extensão está dando problema para a plataforma, quando estou iniciando
o atendimento tem dado erro de carregamento"*.

### O que foi DESCARTADO, com medição

- **O gancho do `fetch`/`XHR` (`page-hook.js`).** Lido inteiro: só observa. Todo intercepto está
  em `try/catch`, delega ao original e **não toca no corpo da resposta** — o modo clássico de uma
  extensão quebrar um app (consumir o stream) não acontece aqui.
- **O laço de 500 ms (`watchPageState` → `pageStateLocal`).** Era o meu principal suspeito, porque
  `isConcluded()` varre `button, [role=button], mat-chip, span, div` dentro da conversa lendo
  `textContent` de cada um. **Medido** com Playwright, fila de 50 itens + conversa crescendo:

  | mensagens | elementos na página | `pageStateLocal()` |
  | --- | --- | --- |
  | 20 | 481 | 0,20 ms |
  | 100 | 961 | 0,50 ms |
  | 300 | 2161 | 0,90 ms |
  | 800 | 5161 | 2,90 ms |

  2,9 ms a cada 500 ms é 0,6% da thread principal no pior caso. **Não é o problema** — e sem medir
  eu teria "consertado" isso e o erro dele continuaria.

### O que É o problema: volume de requisições no pior instante

O `CLAUDE.md` já registra o mecanismo — *"rajada de requisições derruba a API e a plataforma
junto; `Failed to fetch` é o preflight recusado pelo limitador de taxa"*. O que faltava era ver
**quantas** a extensão gasta, e **quando**. Três amplificadores, todos no momento em que ele abre
ou inicia um atendimento — exatamente quando a plataforma também está carregando:

1. **`load()` disparava no instante da troca de URL**, sem espera nenhuma: sessão, contato e
   conversa saindo junto com a rajada da própria plataforma para o mesmo atendimento. Passar a
   fila clicando de contato em contato multiplicava isso por item, e nenhuma dessas leituras era
   aproveitada.
2. **`reexaminarMensagens` refazia a leitura a cada mudança do sinal de conversa** — e o sinal é
   `quantidade:último texto`, que muda VÁRIAS vezes enquanto a plataforma renderiza a lista. Cada
   mudança valia uma leitura da conversa e, se houvesse o que aplicar, uma **gravação com
   releitura** junto.
3. **`hsm.list` guardava UM canal** (`cache` + `cacheKey`). A conta tem várias instâncias e a fila
   se alterna entre elas, então cada contato de canal diferente do anterior rebuscava **100
   modelos aprovados**. Ir e voltar entre duas instâncias = essa busca em todo contato aberto.

**Conta por contato aberto** (canal alternado, conversa renderizando em três passos, com algo a
gravar): ~10 a 14 requisições nossas, amontoadas no mesmo segundo da carga dela. Depois: ~4, e
**fora** do momento crítico.

### O conserto

- `ESPERA_LOAD_MS = 400` — `agendarLoad` sai da frente do carregamento da plataforma e junta os
  cliques rápidos num só: passar a fila inteira custa **um** carregamento, o do contato onde ele
  parou. A tela reage na hora ("Carregando contato…"), só a rede espera.
- `ESPERA_REEXAME_MS = 1200` — `agendarReexame` espera a conversa parar de mudar. Não há pressa:
  é resposta do contato chegando, e um segundo não muda nada para quem está lendo.
- `hsm.js` passa a ter um **cache por canal** (`Map`), não uma vaga só.

Os dois timers são cancelados quando a rodada começa (`state.auto.rodando`): ali quem troca de
atendimento é ela, e um `load()` por fora carregaria o contato duas vezes e gravaria no meio de um
envio. `agendarLoad` também cancela a caixa de cidade aberta, pela mesma razão de sempre.

**Ainda pesado, e é dele a decisão:** a aba Cidades varre a base inteira. Rodá-la enquanto atende
soma o tráfego dos dois. Melhor deixar para quando não estiver na fila.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`agendarLoad`, `agendarReexame`,
`ESPERA_LOAD_MS`, `ESPERA_REEXAME_MS`), [src/lib/hsm.js](src/lib/hsm.js) (`cachePorCanal`),
[CLAUDE.md](CLAUDE.md). Manifesto 0.12.2 → **0.12.3**. Oito suítes e o `checar-dom` passando.

---

## 2026-08-20 — Tecla 4 vira "Pedir dados e concluir"

**Pedido dele:** *"troque o botão 4 por pedir dados e concluir e faça mais duas variações dele —
só tem um modelo de mensagem no momento"*.

A tecla 4 da rodada 3 era "Agradecer informações e concluir". Virou o pedido de dados, que é o
que falta na maioria dessa fila: sem nome e sem cidade não há o que classificar, e o contato fica
dando voltas. O agradecimento **não sumiu** — continua nas respostas rápidas da própria caixa, a
um clique, só sem ocupar uma tecla.

**As "mais duas variações" já existiam.** `pedir-dados` carrega três textos (`text` + duas
`variantes`) desde a rotação de variantes, e elas se revezam a cada envio. Uma tecla, três
redações — que é exatamente o ponto, já que repetir o mesmo texto em sequência é o que se suspeita
ter derrubado o número. Não criei variação nova: teria virado um segundo sistema paralelo ao que
já funciona, e a suíte `templates.test.mjs` já garante que toda variante preserva
`Nome completo / Cidade` (o formato que `extract.findStructured` casa por texto).

**Detalhe que evita trava na hora do envio:** a conferência de variável é feita na variante **que
vai sair** (`varianteAtual`), não no texto-base. Se a corrente travar por variável faltando, a
tecla some com o motivo na tela, em vez de a rodada descobrir isso no meio do envio.

**Aviso próprio, não uma linha na lista dos "já recebeu hoje":** o pedido de dados é a opção
destacada e a que mais tenta ser repetida, então ele ganha a hora na cara e o rótulo vira "Pedir
dados DE NOVO", perdendo o destaque. A linha diz que o texto muda mas o pedido não — é o pedido
repetido que incomoda, não a redação.

**Nota de processo:** este trabalho foi feito duas vezes. A primeira versão criava duas respostas
prontas novas (`pedir-dados-curto`, `pedir-dados-reforco`) nas teclas 8 e 9 — foi escrita sem ver
que outra sessão já tinha empurrado a rotação de variantes, e foi descartada antes de subir. A
regra do CLAUDE.md (`git fetch` antes de começar) existe justamente para isso.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`pedirDados`, `textoPedirDados`,
`pedirTrava`, `pedidoHoje`, tecla 4 e a saída `pedirdados`). Manifesto 0.12.1 → **0.12.2**.
Oito suítes passando.

---

## 2026-08-20 (noite) — O envio de modelos parou: etiqueta bloqueando mensagem

**Relato:** *"o envio de modelos está parando, veja qual o problema"*.

### A cadeia, e a regressão é minha

1. hoje `tags.suggest` passou a devolver a etiqueta de **cidade** — nova para quase todo contato;
2. ela é marcada por `autoTags` e entra em `etiquetas` na gravação;
3. `confirmarNoCrm` relê o contato e, se ela não entrou, registra
   `etiquetas (CAXIAS DO SUL): a API aceitou mas não gravou`;
4. **`'etiquetas'` estava na lista de bloqueantes** → `saveClassification` devolve `false`;
5. na rodada: `if (!(await saveClassification(...))) return { erro: 'a classificação não gravou;
   não enviei nada' }` → **o modelo aprovado não sai.**

O bloqueio já existia; o que mudou foi a superfície. Antes as etiquetas eram COREDE (que o contato
já tinha, então `applyTags` devolvia `skipped`) e conteúdo. A de cidade é nova em quase todo
contato — então é a que falha, e passou a travar o envio.

### O conserto: a prioridade estava invertida

**Etiqueta é organização interna; a mensagem é o que o contato recebe.** Etiqueta que não entrou
saiu dos bloqueantes: continua aparecendo no status e agora **também no log da rodada**, e dá para
reprocessar pela aba Cidades a qualquer momento — mas não impede mais alguém de ser atendido.

**Cidade e data de conclusão continuam bloqueando**, e isso é de propósito: são campos do próprio
contato, e seguir com eles errados é classificar errado.

O registro no log da rodada não é enfeite: o status é sobrescrito pela linha seguinte da rodada,
então sem ele o conserto trocaria um envio travado por uma **falha silenciosa** — que é o modo de
falhar que este projeto mais combate. Entra como `'aviso'`, não `'pulado'`: o contato foi atendido,
e `'pulado'` inflaria a contagem do resumo, fazendo a rodada parecer que deixou gente sem atender.

### O que este conserto NÃO resolve

**Por que a etiqueta de cidade não está entrando** continua aberto — é o mesmo fio do relato
*"não estou achando os que foram feitos"*. O conserto de hoje garante que isso não impeça mais o
atendimento; a causa da escrita falhar precisa da sonda da aba Cidades para ser vista.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`essenciais` sem `'etiquetas'`, registro
no log da rodada). Manifesto 0.12.0 → **0.12.1**. Oito suítes passando.

---

## 2026-08-20 (noite) — Confirmar a cidade libera as etiquetas, e aviso de grafia errada

**Dois pedidos na mesma mensagem:** *"quando eu aceito na confirmação de cidade eu tenho certeza
que a cidade está correta"* e *"o que você pode arrumar é se está escrita corretamente e me falar
se está errada também quando eu iniciar o atendimento, tem casos de cidade escritas erradas"*.

### O aceite passou a valer como certeza

Havia um furo que contradizia o combinado: aceitar no popup gravava a cidade e **não** aplicava as
etiquetas. `etiquetaConfiavel` exige `from === 'crm'` ou `confidence === 'exata'`, e o palpite
aproximado continuava aproximado depois do aceite — então a cidade entrava no CRM sem a etiqueta
dela. Agora o aceite marca `confirmada: true`, e isso libera cidade e COREDE: confirmação dele vale
tanto quanto valor do CRM, porque foi ele que olhou a conversa e decidiu.

**Junto, um furo de corrida na mesma função:** quando duas gravações concorriam (`load()` e
`reexaminarMensagens()` podem estar no ar juntos), a segunda esperava a resposta da pergunta mas
**não** o `refreshTagSuggestions` de quem abriu — e seguia com as etiquetas da cidade ANTIGA.
`applyTags` faz união, então aplicaria a etiqueta de uma cidade recém-trocada, e ela ficaria no
contato para sempre. Agora a segunda também espera o refresh.

### Aviso de grafia: `cities.conferirGrafia`

**A regra que evita virar ruído: acento e caixa NÃO são erro.** "porto alegre" e "Porto Alegre"
resolvem para o mesmo município e geram a mesma etiqueta; avisar disso treinaria a ignorar o
aviso. O que é apontado:

| No campo | Veredito |
|---|---|
| `Porto Alegre`, `porto alegre`, `Santo Angelo` | ok — só acento/caixa |
| `Sto Angelo`, `POA` | abreviação → sugere `Santo Ângelo` / `Porto Alegre` |
| `Caxias do Sull`, `Erechin` | erro de digitação → sugere o nome oficial |
| `não sei`, `Curitiba` | não é município do RS — não há grafia a sugerir |

Isso exigiu **`cities.semAcentoNemCaixa`**, separada de `normalize`: a `normalize` aplica os
ALIASES ("sto" → "santo", "poa" → "porto alegre"), que é o que faz o casamento tolerante
funcionar — e é exatamente o que apagaria o que se quer ver. Com os aliases, "Sto Angelo" e
"Santo Ângelo" ficam idênticos e o campo abreviado passaria por correto.

**Onde aparece:** no **cabeçalho**, não na aba Dados. O cabeçalho está em todas as abas, e aviso
escondido atrás de um clique não é aviso. Com botão **"Corrigir para «Santo Ângelo»"**, que marca
`manual` + `confirmada` — foi ele que mandou corrigir, então não precisa de outro popup para
liberar as etiquetas.

**A conferência mora em `refreshTagSuggestions`**, não no desenho: é assíncrona (piscaria a cada
redesenho) e aquela função já roda em todos os pontos em que a cidade muda — carregar o contato,
responder o popup, digitar na aba Dados. O aviso acompanha sozinho.

**Arquivos:** [src/lib/cities.js](src/lib/cities.js) (`semAcentoNemCaixa`, `conferirGrafia`),
[src/panel/panel.js](src/panel/panel.js) (`confirmada` no aceite, `etiquetaConfiavel`, refresh na
corrida, aviso no cabeçalho, `state.grafiaDaCidade`),
[tests/parser.test.mjs](tests/parser.test.mjs) (2 grupos novos). Manifesto 0.11.0 → **0.12.0**.
Oito suítes passando.

---

## 2026-08-20 (noite) — Etiqueta de cidade também no fluxo normal, não só na varredura

**Pedido:** *"a extensão agora também tem que adicionar a etiqueta de cidade em contatos novos"*.

Até aqui a etiqueta de cidade só entrava pela aba Cidades (varredura em massa). Todo contato novo
nascia sem ela — então a base voltava a ficar desalinhada no dia seguinte à passada, e a varredura
teria que ser refeita para sempre.

**`tags.suggest` passou a devolver a etiqueta de cidade** ao lado da de região, com `origem:
'cidade'`. Só quando o COREDE existe, ou seja, quando a cidade casou com a planilha oficial — a
mesma trava da varredura, pelo mesmo motivo (campo é texto livre, "não sei" viraria etiqueta
permanente).

**O nome vem de `categorizar.nomeDaEtiqueta`, importado.** Duas fontes para o nome da mesma
etiqueta seria a receita para o fluxo normal criar uma coisa e a varredura criar outra — duas
etiquetas para a mesma cidade, e o filtro dele partido em duas. `categorizar` não importa `tags`,
então não há ciclo.

### As duas travas que tiveram que acompanhar

1. **`etiquetaConfiavel` agora cobre 'cidade' junto com 'região'.** As duas SAEM da cidade, então
   herdam a dúvida dela: palpite aproximado não grava sozinho. Sem isso, a etiqueta — que é o que
   ele usa para FILTRAR — seria gravada a partir de um chute.
2. **A etiqueta de cidade ANTIGA sai quando a cidade muda.** `etiquetasDeRegiaoASair` tratava só
   COREDE; agora trata as duas famílias, com `tags.cityTagIds()` novo (etiquetas cujo rótulo é nome
   de município, casado contra a planilha). Sem isso o defeito é pior que o do COREDE duplicado:
   trocar de cidade deixaria o contato com "CAXIAS DO SUL" **e** "PELOTAS", nos dois filtros. A
   trava do "só sai se a nova ficar" vale para as duas — tirar a antiga sem pôr a nova deixaria o
   contato sem etiqueta de lugar nenhuma.

### Etiqueta de cidade que não existe: criar, não apelidar

Para COREDE, "escolha a etiqueta correspondente" faz sentido (o nome da planilha pode divergir do
rótulo do CRM, e o apelido resolve). Para cidade **não existe correspondente**: se "PELOTAS" não
está lá, é porque nenhum contato de Pelotas foi etiquetado ainda. Oferecer o seletor de apelido
convidaria a apontar Pelotas para outra etiqueta qualquer — o erro que a etiqueta de cidade existe
para evitar. Então a sugestão de cidade sem etiqueta mostra um botão **"Criar «PELOTAS»"**, que
cria e invalida o cache (sem invalidar, a releitura devolve a lista velha e a etiqueta recém-criada
continua "não encontrada").

**Arquivos:** [src/lib/tags.js](src/lib/tags.js) (`suggest` com `origem: 'cidade'`, `cityTagIds`,
import de `categorizar`), [src/panel/panel.js](src/panel/panel.js) (`etiquetaConfiavel`,
`etiquetasDeRegiaoASair` com duas famílias, botão de criar etiqueta),
[tests/tags.test.mjs](tests/tags.test.mjs). Manifesto 0.10.5 → **0.11.0**. Oito suítes passando.

---

## 2026-08-20 (noite) — A aba Cidades rodava sem keepalive, e congelava em segundo plano

**Relato:** *"eu quero saber se os 2000 foram etiquetados mas pelo visto não foram, eu não abri a
página para ele trabalhar deixando rodando sozinho, se eu não filtrar ele não faz"*.

### Causa raiz: armadilha já documentada, e eu não a apliquei no código novo

O `CLAUDE.md` registra, medido: **"aba escondida é aba CONGELADA, não lenta"** —
`setInterval(120ms)` deu **zero** disparos em mais de um minuto. As rodadas do Automatizado ligam
`keepalive` desde sempre por causa disso. **A aba Cidades nasceu sem ele.**

Então ele deixou a gravação rodando, tirou a aba da frente, e o Chrome congelou o laço. Sem erro,
sem log, sem nada na tela — a passada simplesmente parou onde estava. É por isso que os 2000 não
foram etiquetados.

Consertado: `acordarParaCidades()` liga o áudio nas **quatro** passadas (leitura, criação de
etiqueta, renomeação, gravação) e relata quando não consegue — áudio exige gesto do usuário, e
aqui sempre há um, porque toda passada começa por um clique. No `finally`, se o áudio **não estava
mais ativo**, o log avisa: é o dado que distingue "acabou" de "congelou no meio", e sem ele a
próxima investigação começaria do zero.

E um aviso no topo da aba, em destaque, porque nenhum conserto de código impede minimizar a janela
ou o computador suspender.

### "Se eu não filtrar ele não faz"

Não reproduzi, mas havia um jeito de isso passar em silêncio: primeira página vazia caía no mesmo
`break` de "acabou", e a tela mostrava **"Leitura completa: 0 contatos"** como se estivesse tudo
certo. Agora, quando a PRIMEIRA página volta vazia, o log diz isso explicitamente e manda avisar —
consulta que não devolve nada é diferente de base sem contatos.

Continua **em aberto** se `listContacts` (sem filtro) tem outro problema. Se acontecer de novo, a
linha nova no log é o que vai dizer.

### Como saber se os 2000 foram etiquetados

Ler de novo com o mesmo filtro e olhar **"já completos"** — é a resposta, e vem do CRM, não da
nossa contagem. Junto com a sonda da entrada anterior (que relê o primeiro gravado de cada lote),
é o que fecha o ciclo: agora dá para confiar no número.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`acordarParaCidades`, `keepalive` nas
quatro passadas, aviso de aba visível, log de página vazia). Manifesto 0.10.4 → **0.10.5**. Oito
suítes passando.

---

## 2026-08-20 (tarde) — "Não estou achando os que foram feitos": faltava conferir a escrita

**Relato, com print:** *"não estou achando os que foram feitos somente corede da serra aparece como
feito"* — e no card de divergência, a linha `Caxias do Sul → Serra (tem: Serra)`, repetida, em
**1293 contatos**.

### Defeito 1: falso positivo por comparar ID em vez de nome

`Caxias do Sul → Serra (tem: Serra)` é absurdo na cara: o COREDE certo é Serra e o contato tem
Serra. A causa: **o CRM tem etiquetas de rótulo repetido** (ele mesmo tem "1 Sem Retorno" e
"2 Sem Retorno", e apareceu "Serra" duas vezes). `etiquetasPorNome` guarda uma delas; o contato
carrega a outra. Comparando `id`, viram etiquetas diferentes — comparando **nome**, são a mesma
coisa, e é o nome que o filtro por região usa.

Consertado: a divergência compara rótulo normalizado, com `rotuloPorId` novo. Id sem rótulo
conhecido **não acusa** — na dúvida, não acusa. Dois testes de regressão.

E como rótulo repetido é sujeira que atrapalha o filtro **dele** também (um contato pode "ter
SERRA" e não aparecer no filtro de SERRA, porque são duas SERRAs), a aba passou a avisar:
`etiquetasComRotuloRepetido`. Só avisa — a extensão não apaga etiqueta.

### Defeito 2, o que explica o relato: a aba nunca conferiu se gravou

A regra mais antiga deste projeto é *"a API responde 200 e IGNORA o valor quando o formato não
serve — nunca confie no 2xx"*, e é por isso que `saveClassification` relê o contato desde sempre
(`confirmarNoCrm`). **A aba Cidades não conferia nada:** mandava o `POST`, recebia 200, e contava
como gravado. Podia relatar 5 mil gravados sem uma única etiqueta ter entrado — e o erro só
apareceria quando alguém fosse procurar os contatos no CRM e não achasse. Foi o que aconteceu.

Agora há **sonda por lote**: o primeiro contato gravado é relido e conferido. Se as etiquetas não
entraram, o lote **para na hora**, com o motivo na tela ("o contato de Caxias do Sul continua sem
CAXIAS DO SUL depois da gravação"). Uma leitura por lote, não por contato: pegar formato errado
exige um exemplo, não uma auditoria — auditar 5 mil dobraria as requisições da passada.

Falha ao **conferir** (rede) não trava o lote: não conseguir reler é diferente de ter falhado a
gravação.

**Ainda não sei qual dos dois defeitos produziu o relato dele** — a sonda é o que vai dizer, na
próxima gravação. Se ela falhar, o problema é a escrita (formato/contrato); se passar, as
etiquetas estavam entrando e o que enganava era o card de divergência.

**Arquivos:** [src/lib/categorizar.js](src/lib/categorizar.js) (divergência por nome,
`rotuloPorId`, `etiquetasComRotuloRepetido`), [src/panel/panel.js](src/panel/panel.js)
(`conferirEtiquetasGravadas` + sonda no lote, card de rótulo repetido, `rotuloPorId`),
[tests/categorizar.test.mjs](tests/categorizar.test.mjs) (4 grupos novos, dois de regressão).
Manifesto 0.10.3 → **0.10.4**. Oito suítes passando.

---

## 2026-08-20 (tarde) — A tela não mostrava o total elegível

**Pergunta dele:** *"são 7474 contatos com corede correto? então todos deviam receber a etiqueta de
cidade"*. Estava certo, e a tela escondia isso.

O resumo listava os baldes sem mostrar o **total elegível**, então "1358 prontos para gravar"
parecia ser o universo inteiro em vez de a fatia que dá para fazer agora. A conta que ele queria
ver — lidos menos as exclusões — não estava em lugar nenhum.

Agora o resumo é uma conta de cima para baixo: **lidos** → menos sem cidade, menos a revisar, menos
sem etiqueta → **DEVEM receber etiqueta de cidade** → e esse total se abre em três, indentados:
já completos, prontos agora, e **travados por falta de criar a etiqueta**.

E o aviso que faltava: os travados **não estão de fora**, só esperam as etiquetas do passo 2. Sem
essa frase, "travados: 6002" lê como perda, quando é fila com desbloqueio conhecido.

**Nota para a próxima sessão:** o `esperandoCriacao: 0` do print dele **não** informava nada. Com o
código antigo, ele só contava quando NEM cidade NEM COREDE existiam — e como o filtro era "todos os
COREDEs", `alvos` nunca era vazio, então aquele contador era zero por construção. Só depois do
conserto da entrada anterior a tela passa a distinguir "já completo" de "travado", e é ela que vai
dizer se os 6002 eram bug de rótulo ou contatos legitimamente prontos de antes.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (resumo em forma de conta, aviso dos
travados). Manifesto 0.10.2 → **0.10.3**. Oito suítes passando.

---

## 2026-08-20 (tarde) — "Por que os números não batem?" — o rótulo estava mentindo

**Pergunta dele, com print:** `Contatos lidos: 7474 · Já com cidade e COREDE: 6002 · Prontos para
gravar: 1358 (1366 etiquetas) · Esperando etiqueta: 0 · Sem cidade: 49 · A revisar: 65`.

**A soma fechava** (6002+1358+49+65 = 7474). O que não batia era o **significado** de uma linha —
e ele viu na hora, porque tinha gravado só **20** contatos e a tela dizia 6002 prontos.

### Causa raiz

`analisar` perguntava só "falta aplicar algo?" e, quando não faltava, olhava `alvos.length` para
escolher entre pronto e esperando. Contato de Caxias do Sul que **tem** o COREDE (Serra, aplicado
pelo fluxo normal) mas cuja etiqueta de **cidade ainda não existe no CRM** caía assim:

- a etiqueta de cidade não existe → `anotarFalta`, e ela **não entra** em `alvos`;
- o COREDE existe e ele já tem → entra em `alvos`, mas não em `faltando`;
- `faltando` vazio + `alvos.length > 0` → **contado como "já com cidade e COREDE"**.

Ou seja: ~5980 contatos esperando criação de etiqueta, escondidos no número de prontos.
`esperandoCriacao` só pegava o caso em que **nada** existia — daí o `0` na tela.

**Conserto:** cada contato cai em exatamente um balde, e a ordem é por urgência — o que dá para
fazer agora (`paraGravar`), o que depende de criar etiqueta (`esperandoCriacao`), e só então o que
está completo (`jaOk`). A flag `precisaCriar` é o que separa os dois últimos. Tem teste de
regressão com o cenário exato.

### O segundo achado, nos mesmos números

**1358 contatos → 1366 etiquetas.** Como o filtro era "todos os COREDEs", todo contato lido já tem
um COREDE — então os 8 que recebem DUAS etiquetas têm um COREDE **diferente** do da cidade deles.
Gravar somaria o certo e deixaria o errado: o contato passaria a aparecer no filtro de duas
regiões. É o defeito que o `CLAUDE.md` já registra por outro caminho ("COREDE errado sobra quando a
cidade preenche BURACO").

`coredeDivergente` detecta e a tela avisa, com exemplos. **Não remove nada**, de propósito: pode
ser a cidade que está errada e não a etiqueta, e remover é destrutivo. A decisão é dele.

**Arquivos:** [src/lib/categorizar.js](src/lib/categorizar.js) (`precisaCriar`, ordem dos baldes,
`coredeDivergente`, `idsDeCorede`), [src/panel/panel.js](src/panel/panel.js) (passa
`regionTagIds`, card de aviso), [tests/categorizar.test.mjs](tests/categorizar.test.mjs) (3 grupos
novos, um deles de regressão). Manifesto 0.10.1 → **0.10.2**. Oito suítes passando.

---

## 2026-08-20 (tarde) — Seletor com "todos os COREDEs", e agrupado

**Pedido, com print do seletor aberto:** *"eu queria aqui, ele me da a opção somente todos contatos
ou um por um, quero a opção todos os coredes"*.

**Sai barato porque o filtro aceita lista.** `POST /core/v1/contact/filter` usa
`tagsOperator: 'OR'`, então mandar os 28 ids de COREDE de uma vez significa "quem tem qualquer
etiqueta de região" — **uma** consulta, não 28. Os ids vêm de `tags.regionTagIds()`, que já
existia e já resolve apelido (então "Vale do Paranhana" entra mesmo a planilha dizendo "Paranhana
Encosta da Serra").

É a fatia que interessa para esta aba: quem tem COREDE já passou pela classificação, então é quem
tem cidade preenchida com mais frequência — e sai muito menor que os 57 mil.

**O seletor também estava difícil de usar.** No print dele, os COREDEs apareciam misturados entre
"Procura emprego ou dinheiro" e "Amigos do Capitão Martim & Covatti Filho", em ordem alfabética
sobre uma lista longa. Agora vai em `optgroup`: **COREDEs (região)** e **Outras etiquetas**, com a
opção "todos os COREDEs (N)" no topo.

A sentinela é `__todos_os_coredes__` — começa com `__` para nunca colidir com id real do CRM, que
são uuid. `idsDoFiltroDeEtiqueta()` a expande na hora da consulta e `rotuloDoFiltroDeEtiqueta()`
dá o nome para a tela e para o log. O log agora registra **qual consulta** produziu o retrato:
sem isso, dois retratos com números diferentes parecem contradição em vez de filtros diferentes.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`TODOS_OS_COREDES`,
`idsDoFiltroDeEtiqueta`, `rotuloDoFiltroDeEtiqueta`, seletor com `optgroup`, log do filtro).
Manifesto 0.10.0 → **0.10.1**. Oito suítes passando.

---

## 2026-08-20 (tarde) — Cidade E COREDE na mesma escrita

**Pedido:** *"preciso que extensão marque todas as etiquetas que tenham corede vou mandar etiquetar
todas agora"*.

**Por que sai de graça:** o COREDE é **derivado** da cidade (planilha oficial da SPGG-RS, nunca
chute), e `applyTags` aplica um array de etiquetas numa requisição só. Então mandar cidade +
COREDE junto **não custa escrita a mais** — mandar separado dobraria o custo da passada inteira
sem ganhar nada. E como o fluxo normal já aplica COREDE, a maioria dos contatos cai no "já tem" e
não gera requisição nenhuma.

**A armadilha do apelido, e por que ela precisava de tratamento.** O nome do COREDE na planilha
não é sempre o nome da etiqueta no CRM: "Paranhana Encosta da Serra" está lá como "Vale do
Paranhana", "Centro-Sul" como "Centro Sul". `tags.resolveTag` já resolve isso, mas é assíncrona e
por nome — aqui o mapa é consultado dezenas de milhares de vezes. Então os apelidos
(`store.tagAliases`) são **achatados uma vez** como chaves extras do mapa de etiquetas. Sem isso,
COREDE existente entraria como "falta criar" e viraria etiqueta duplicada com outro nome.

**Contagem que mudou de significado, e a tela junto.** Um contato agora pode contribuir para DUAS
faltas (a cidade e o COREDE), então `faltamCriar` conta **ocorrências de etiqueta**, não contatos.
A contagem de contatos passou a ser `esperandoCriacao` — que também separa dois casos que antes
se confundiam: "já tem tudo" (`jaOk`) e "não há o que gravar porque a etiqueta ainda não existe".
Contar o segundo como pronto esconderia o trabalho de criação pendente. A conferência de soma na
tela foi ajustada para usar a contagem certa; é a mesma confusão de unidades que gerou o
*"os 586 tem cidade porque 43 etiquetas?"* mais cedo hoje.

O resumo agora mostra "N contato(s) · M etiqueta(s)" no que vai ser gravado, e o card de criação
separa quantas são de cidade e quantas de COREDE.

**Arquivos:** [src/lib/categorizar.js](src/lib/categorizar.js) (`analisar` com
`coredePorMunicipio`, `etiquetas[]` por contato, `esperandoCriacao`),
[src/panel/panel.js](src/panel/panel.js) (`analisarParaCidades` achatando apelidos, gravação com
array, resumo), [tests/categorizar.test.mjs](tests/categorizar.test.mjs) (5 grupos novos).
Manifesto 0.9.5 → **0.10.0**. Oito suítes passando.

---

## 2026-08-20 (tarde) — A leitura recomeçava do zero a cada clique

**Relato:** *"está parando e esperando eu mandar a próxima página faça isso sozinho"*.

**Eram dois defeitos, e o segundo era o grave.** O teto de leitura (500, para a primeira passada
ser curta) interrompia — isso era por projeto. Mas clicar em "Ler a base" de novo **recomeçava da
página 1**: `pagina` nascia em `1` e a lista de contatos era zerada em toda chamada. Então o teto
interrompia e o botão refazia o mesmo trabalho — a base **nunca terminaria** de ser lida, por mais
que ele clicasse. O relato descreve o sintoma; a causa era não existir continuação nenhuma.

**Consertado:**

- **O teto padrão virou `0`** (base inteira). O campo fica para quando ele quiser uma amostra de
  propósito, mas o normal é ir até o fim sozinho, página por página, com respiro entre elas.
- **A leitura continua de onde parou.** `proximaPagina` e `acumulados` vivem no estado; o ponteiro
  avança **depois** de consumir a página, então uma parada no meio não relê nem perde nada. O botão
  vira "Continuar da página N (X lidos)", e um "Recomeçar do zero" fica ao lado para quando ele
  quiser mesmo refazer.
- **Trocar o filtro zera a continuação.** Retomar a página 7 depois de mudar a etiqueta juntaria
  contatos de duas consultas diferentes.
- **Terminou de verdade → zera sozinho**, senão a leitura seguinte partiria de uma página que já
  não existe e voltaria vazia.
- O status agora diz "página N de M" e, quando pausa, quantos faltam.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`lerBaseParaCidades({continuar})`,
`reiniciarLeituraDeCidades`, botão e estado). Manifesto 0.9.4 → **0.9.5**. Oito suítes passando.

---

## 2026-08-20 (tarde) — Etiqueta de cidade sem prefixo, e o conserto dos 20 já gravados

**Pedido:** *"marcou como cidade: caxias do sul, deixe somente caxias do sul, arrume os que ja
foram mandei 20"*. A primeira versão criava a etiqueta como `CIDADE: CAXIAS DO SUL`; ele viu na
tela e pediu só o nome do município. E 20 contatos já tinham recebido a errada.

**O prefixo saiu** (`PREFIXO_PADRAO = ''`). Ele está certo: a etiqueta aparece no cartão do
contato e na coluna da tela de Contatos, onde `CIDADE: ` repetido em toda linha só rouba espaço —
e as etiquetas dele já são assim (`SERRA`, `SEM INTERESSE`).

**Conferido antes de tirar:** nenhum dos 497 municípios do RS tem o mesmo nome de um dos 28
COREDEs, então cidade e região não colidem sem o prefixo e o filtro continua sem ambiguidade. Tem
teste travando isso — se um dia colidir, a suíte acusa antes de a etiqueta ambígua nascer.

**O conserto dos 20: renomear, não remexer.** `POST /core/v1/tag/{id}` (achado no bundle: `POST`
atualiza, `PUT` cria) muda o rótulo da etiqueta — e todo contato que a tem passa a mostrar o nome
novo. Uma requisição por etiqueta, contra duas por contato no caminho óbvio (remover a antiga,
aplicar a nova), e **sem a janela** em que o contato ficaria sem etiqueta nenhuma no meio.

`etiquetasComPrefixoAntigo` acha o que renomear e **recusa quando o nome novo já existe** — as
duas versões no CRM viraria rótulo duplicado, e essa decisão é dele. O card só aparece quando há
o que consertar, e aparece **antes** da varredura: quem gravou errado precisa disto antes de
gravar mais.

`tags.loadTags` passou a guardar `bgColor`/`textColor`, porque a rota de renomear exige as cores
de volta — omitir resetaria a cor da etiqueta como efeito colateral.

**Arquivos:** [src/lib/categorizar.js](src/lib/categorizar.js) (`PREFIXO_PADRAO`,
`PREFIXO_ANTIGO`, `etiquetasComPrefixoAntigo`), [src/lib/api.js](src/lib/api.js) (`updateTag`),
[src/lib/tags.js](src/lib/tags.js) (cores no cache),
[src/panel/panel.js](src/panel/panel.js) (`corrigirPrefixoDasEtiquetas` + card),
[tests/categorizar.test.mjs](tests/categorizar.test.mjs). Manifesto 0.9.3 → **0.9.4**. Oito
suítes passando.

---

## 2026-08-20 — Aba Cidades: etiqueta de município para a base inteira

**Pedido:** *"no crm em contatos vamos ter que criar uma aba que vai categorizar eles, todos que
tiverem etiqueta e cidade terão que ter uma etiqueta de cidade adicionada para ser usado nos
filtros depois, o api só filtra por etiquetas e eu preciso da cidade não só região, automatize pra
categorizar tudo o mais rapido possivel"*. Base com **57.855 contatos** (visto no print).

### O conflito no "mais rápido possível", e como foi resolvido

A leitura é barata (~580 requisições em pageSize 100). A escrita é o custo: um `PUT` por contato.
Com pausa fixa, ou se desperdiçam horas ou se derruba a API — **e a plataforma junto**, que é onde
ele atende (armadilha já registrada). Então o ritmo não é escolhido, é medido:
`categorizar.Ritmo` acelera 20% depois de 12 sucessos seguidos e **dobra** a pausa em cada recusa,
com piso de 150 ms e teto de 8 s. Errar para o lado lento custa minutos; para o lado rápido custa
a plataforma fora do ar no meio do atendimento — daí a assimetria.

O sinal de limite é `Failed to fetch`, **não** status HTTP: um limitador recusa o preflight CORS e
o navegador entrega isso como falha de rede. `ehLimiteDeTaxa` distingue isso de 400/404, onde
esperar mais não conserta nada.

**Escolhas dele, perguntadas antes de escrever código:** ir pela API (em vez de testar
exportar/importar CSV, que eu levantei como possivelmente mais rápido e sem risco) e **em lotes
pequenos, disparados por ele** — nada de rodada longa automática.

### As quatro travas que protegem a base

1. **Cidade tem que casar com os 497 municípios da planilha oficial.** O campo é texto livre e a
   base tem coisa digitada à mão: sem isto, "não sei", "aaa" e cidade de outro estado virariam
   etiqueta **permanente** no CRM, e apagar 300 etiquetas de lixo é trabalho que ninguém faz. O que
   não casa vai para a lista de revisão na tela. Usa as chaves de `tags.loadCoredes` — a mesma
   fonte da etiqueta de região, então cidade e COREDE nunca discordam sobre o que é município.
2. **Nome de etiqueta nunca é inventado.** O id sai da lista real do CRM; cidade sem etiqueta
   correspondente entra em `faltamCriar` e nada é gravado no escuro.
3. **Idempotente.** Quem já tem a etiqueta é contado como pronto e não gera requisição. Rodar de
   novo não reescreve, e retomar em lotes é o caso normal.
4. **Soma, nunca substitui.** Quem grava é o `tags.applyTags` que já existia, que faz a união com
   as etiquetas atuais. A varredura carrega o `tagsId` de cada contato justamente para isso.

### As rotas: chutadas primeiro, depois lidas do bundle do app

A primeira versão desta aba chutou os parâmetros da listagem, porque `mobiliza.app` e
`api.mobiliza.app` estão bloqueados pela política de navegação — e chute foi o que a regra do
projeto proíbe. Ele pediu *"tente ver pela extensão claude no chrome"*; a extensão também recusou
(`example.com` inclusive, então é allowlist geral, não bloqueio do mobiliza).

O caminho que funcionou: o **Browser pane** abre `mobiliza.app`, e o `main.11167927f02cae35.js` é
a fonte da verdade — as rotas, os métodos e os parâmetros estão como texto no código Angular, a um
`fetch` de distância. Sem login, sem sessão nova, sem tocar em dado de eleitor.

**Dois chutes caíram, e os dois eram do tipo que falha em silêncio:**

1. **O parâmetro é `isToIncludeCustomFieldValues`, não `isToIncludeCustomFields`.** O nome parecido
   é do `GET /core/v1/contact/{id}`, que usa o outro. Com o nome errado a API responde **200 e
   ignora** — o mesmo modo de falhar que já custou dias aqui com a data de conclusão. A
   categorização teria lido a base inteira e concluído "nenhum contato tem cidade", sem erro
   nenhum na tela.
2. **Criar etiqueta é `PUT /core/v1/tag`, não `POST`**, com body `{message, textColor, bgColor}` —
   não só `message`. Método errado e body incompleto.

Também confirmado: `status=ACTIVE` e `orderBy=name` fazem parte do que o app manda (sem `status`
não se sabe se vem arquivado e bloqueado junto, e etiquetar arquivado é trabalho jogado fora); o
envelope é `{items, page, countPages, totalItems, pageSize}`; `/core/v1/contact/filter` **só**
filtra por telefone e e-mail, então não serve para "me dê só quem tem cidade" — daí ler a base
inteira; e `tagsId` é campo próprio do contato, que a tela de Contatos usa direto, então a
listagem já deve trazê-lo (`isToIncludeTags` vai como reforço, não como aposta).

Com isso a descoberta por tentativa saiu: a rota é fixa e verificada. O que **não** foi verificado
é a execução — ler o código não é o mesmo que receber um 2xx —, e por isso a criação de etiqueta
manda **uma** como sonda antes das outras.

`tools/descobrir-listagem.js` (só leitura, para colar no console) fica no repositório: ele confirma
as rotas contra a API de verdade, que é o passo que falta.

### Ler 57 mil para testar a leitura era caro demais

**Relato, na mesma sessão:** *"estou filtrando para não pegar todos os contatos mas ele quer ler os
57.000"*. A aba chamava a API direto e ignorava o filtro aplicado na tela.

Investigado no bundle: a tela de Contatos filtra por **`POST /core/v1/contact/filter`**
(`filterList`), e os campos que ele aceita são `textSearch`, `statuses`, `tagsIdBySearchText` e
`isToIncludeCustomFieldValues`. **Não existe filtro por etiqueta escolhida** — `tagsIdBySearchText`
é resultado de procurar TEXTO entre as etiquetas, não "só quem tem a etiqueta X". Então peneirar
"quem tem etiqueta e cidade" continua sendo trabalho nosso, depois de ler; o servidor não faz.

O que deu para resolver: **teto de leitura** (padrão 500, `0` = base inteira) e o campo de busca
por texto. Varrer 57 mil são ~580 requisições e vários minutos — caro para descobrir só se a
cidade está vindo. Com o teto, a primeira passada é curta e prova a leitura antes de gastar a
varredura toda. `api.filterContacts` entrou para isso.

### O filtro por etiqueta existia — eu tinha procurado no lugar errado

**Pergunta dele, com print:** *"os 586 tem cidade porque 43 etiquetas?"* — a tela filtrada em
`Etiquetas: SERRA` (586 contatos) e o painel dizendo "Contatos lidos: 600 / Cidades sem etiqueta no
CRM: 43 / Sem etiqueta nenhuma: 398".

**Dois defeitos no mesmo print.**

1. **A lista misturava unidades.** `43` era contagem de CIDADES distintas, no meio de contagens de
   CONTATOS, sem dizer qual era qual — daí a pergunta. A conta real era 600 − 398 − 95 − 5 = 102
   contatos espalhados por 43 cidades. Agora cada linha diz a unidade ("102 contato(s), em 43
   cidade(s)") e existe uma conferência: se a soma não fechar com os lidos, a tela acusa bug de
   contagem em vez de deixar o número estranho passar.
2. **A leitura ignorava o filtro da tela.** Ele filtrou SERRA; a aba leu 600 contatos gerais da
   base, e os 398 "sem etiqueta" eram justamente contatos que o filtro dele teria excluído.

**A correção de fundo é uma conclusão minha que estava errada.** Eu tinha registrado, no commit
anterior, que *"não existe filtro por etiqueta no servidor"* — procurei no `main.js`, achei só
`textSearch` e `tagsIdBySearchText`, e concluí. `tagsIdBySearchText` é de **sessões de chat** e
significa outra coisa (procurar texto entre as etiquetas); e a tela de Contatos é **rota lazy**, com
o filtro dela num chunk próprio. Pegando a lista de chunks no `runtime.*.js` e varrendo os 86
(estáticos, custo zero), o componente `contacts-filter` apareceu no `2647.*.js` com o body inteiro:
`tagsId` + `tagsOperator`, **`exceptTagsId`**, `origins`, `importedAt`, `portfolioIds`,
`customFieldValuesFilters`.

Então agora a aba tem **"Só quem tem a etiqueta"**, populado com as etiquetas do CRM: escolher
SERRA lê 586 em vez de 57 mil. `exceptTagsId` fica anotado como o próximo ganho (pedir ao servidor
quem ainda não tem a etiqueta de cidade), e `customFieldValuesFilters` não foi decifrado — o
formato vem de outro componente —, então "quem tem cidade preenchida" continua sendo peneirado do
nosso lado.

**Lição que vale mais que o conserto:** ausência de evidência no `main.js` não é evidência de
ausência. Rota de tela lazy mora em chunk próprio, e a lista deles está no `runtime.*.js`.

### O fluxo na tela

Três passos explícitos, nessa ordem: **1. Ler a base** (só leitura, com respiro entre páginas — a
armadilha da rajada não distingue leitura de escrita) → **2. Criar as etiquetas que faltam** (com
a sonda) → **3. Gravar N agora**, com o tamanho do lote editável. O botão **Parar** age no
contato atual, e a espera é fatiada para não ter que aguardar o intervalo inteiro. Contato que
falha por erro próprio sai da fila e vai para o log; contato recusado por limite **fica** e é
tentado de novo.

O retrato da varredura mora em memória, não no storage: 57 mil contatos não caberiam bem lá e o
dado envelhece rápido (etiqueta aplicada à mão, cidade corrigida). Varrer de novo é barato.

### Também

`tags.invalidateTags()` — sem ela, criar etiquetas deixava o cache velho e o painel oferecia
criar as mesmas de novo, com nome duplicado no CRM. E a varredura carrega o schema sozinha se
estiver vazio, em vez de mandar abrir um atendimento à toa.

**Arquivos:** [src/lib/categorizar.js](src/lib/categorizar.js) (novo, puro),
[src/lib/api.js](src/lib/api.js) (`descobrirRotaDeListagem`, `listContacts`, `createTag`),
[src/lib/tags.js](src/lib/tags.js) (`invalidateTags`), [src/panel/panel.js](src/panel/panel.js)
(aba Cidades), [tests/categorizar.test.mjs](tests/categorizar.test.mjs) (novo),
[tools/descobrir-listagem.js](tools/descobrir-listagem.js) (novo). Manifesto 0.8.7 → **0.9.0**.
Oito suítes passando.

**Pendências:** as rotas foram lidas do código do app, não executadas — a criação de etiqueta é a
primeira a provar (a sonda serve para isso); o prefixo da etiqueta é `CIDADE: ` (constante
`PREFIXO_PADRAO`, ainda não exposto na tela); e nada disto rodou contra a base de verdade — o
primeiro lote tem que ser pequeno, com ele olhando o resultado no CRM.

---

## 2026-08-15 — Aba "Sem retorno" escondida: risco de derrubar o número

**Pedido:** *"a parte sem retorno pode ser escondida não será utilizado devido ao risco grande de
cair o número"* — decisão que fecha o diagnóstico de mais cedo no mesmo dia (Z-API é API não
oficial, reabrir contato frio em sequência é o padrão que mais se parece com disparo em massa).

**O que saiu da tela:** os dois cartões da aba Automatizado sobre contato **concluído sem
retorno** — "Sem retorno: reabrir e perguntar" (fluxo antigo, um contato só) e "Reabrir em lote" +
a segunda metade dela, trabalhar em "Meus" (fluxo novo, dividido em duas rodadas). Ritmo, Novos,
Mensagem do momento e Conferir/responder a fila continuam — são sobre conversa VIVA, não sobre
reabrir quem parou de responder.

**Escondido, não apagado.** `renderCartaoReabrir`, `renderCartaoSemRetorno` e tudo que elas
chamam (`processarReabrir`, `processarSemRetornoEmMeus`, `processarSemRetorno`, `runLoteReabrir`,
`runLoteEmMeus`, `runLote`) continuam no arquivo — só as duas linhas que colocavam os cartões na
tela saíram, comentadas com o motivo. Reverter é só devolvê-las.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`renderAutomatizado`). Manifesto 0.8.6 →
**0.8.7**. Sete suítes passando.

---

## 2026-08-15 — "Modelo por conteúdo" virou padrão de fábrica

**Pedido, com print da tela:** *"deixe os da print como padrão já para que eu não tenha que bota
toda vez que atualizo a extensão"*. O print mostrava a caixa "Modelo por conteúdo" (aba Config)
com duas linhas: `Conteúdo Zucco = Zucco, Capitão` e `Conteúdo Flávio = Flávio2`. Confirmado com
ele o texto exato antes de gravar — isto decide para qual modelo aprovado a mensagem sai
**sozinha**, então acento e vírgula errados aqui mandam o modelo errado para gente real.

**Por que "atualizar a extensão" zerava isto:** não é o código puxado do git que apaga
`chrome.storage` — é a descoberta da conversa anterior (pasta duplicada, `Downloads` ×
`OneDrive\Documents\GitHub`). Carregar a extensão de uma pasta NOVA no Chrome é instalação nova,
com storage vazio: o mapeamento sempre teria que ser digitado de novo nessa troca.

**Fix:** `store.DEFAULTS.contentTemplates` deixou de ser `{}` e ganhou as duas entradas, já na
chave normalizada que `hsm.achatar` produz (minúsculo, acento mantido). Só vale para quem NUNCA
gravou nada — `contentTemplates` não entra na lista de merge de default do `store.get`, e a
leitura devolve o valor salvo assim que ele existe. Quem já tem o mapeamento configurado (a
maioria, hoje) não muda em nada.

**Arquivos:** [src/lib/store.js](src/lib/store.js) (`contentTemplates`). Manifesto 0.8.5 →
**0.8.6**. Sete suítes passando.

---

## 2026-08-15 — Mesma rotação de variações para a mensagem do momento

**Pedido:** *"faça a mesma coisa para saudação do momento"* — a mensagem da ocasião (tecla 5,
`auto.mensagemMomento`) não vive na lista de respostas prontas (muda toda semana), então não
ganhou variantes quando as respostas ganharam.

**Reaproveitado, não duplicado:** `sendTemplate` já reveza sozinho qualquer objeto com
`{id, text, variantes}` — a mensagem do momento entra nesse molde numa linha só, dando
`variantes: state.auto.cfg.mensagemMomentoVariantes` ao template de mentira que a rodada monta
(`momento = {id: ..., text: textoMomento, variantes: ...}`). Nada mudou em `templates.js` nem em
`varianteAtual`/`avancarVariante` — já tratavam lista de tamanho variável.

A lógica de lista dinâmica de variações (adicionar/remover) foi tirada de dentro de
`abrirEditorDeResposta` e virou `montarListaDeVariantes(container, iniciais)`, compartilhada
pelos dois popups — sem isso a próxima variação (e a próxima) duplicaria o mesmo código de novo.

**Armazenamento:** `auto.mensagemMomentoVariantes` (novo), `[]` por padrão — `auto` já está na
lista de chaves com merge de default no `store.get`, então quem já tinha configuração salva
ganha o campo novo sem migração nenhuma.

**Arquivos:** [src/lib/store.js](src/lib/store.js) (`auto.mensagemMomentoVariantes`),
[src/panel/panel.js](src/panel/panel.js) (`montarListaDeVariantes` extraída,
`abrirEditorDeVariantesDoMomento`, botão no `renderCartaoMomento`, `variantes` no `momento`).
Manifesto 0.8.4 → **0.8.5**. Sete suítes passando.

---

## 2026-08-15 — Lista enxuta: só o resumo, edição (texto e variações) no popup

**Relato (print):** o popup anterior separava "editar texto" (na lista, sempre aberto) de
"editar variações" (só no popup) — dois lugares para a mesma resposta, e a lista continuava
grande com um textarea inteiro por card. Pedido: *"na lista só bote sobre o que é a mensagem e
um botão para abrir e configurar as variações e também a opção de adicionar mais variações"*.

**Lista:** cada resposta virou uma linha compacta — nome, começo do texto (uma linha, truncado)
e quantas variações tem, se houver. Editar (nome, texto E variações) saiu inteiro da lista e foi
para dentro de um só popup, aberto pelo botão "Editar".

**Variações deixaram de ter número fixo.** Eram exatamente duas (variação 2 e 3); virou lista —
"+ Adicionar variação" cria uma caixa vazia, "×" remove qualquer uma. Continua não gravando
variação vazia (`Salvar` filtra strings vazias) e continua revezando com `varianteAtual`/
`avancarVariante`, que já tratavam a lista como tamanho variável, sem mudança nenhuma lá.

**"+ Nova resposta" abre o popup direto** depois de criar o rascunho — sem isso você criaria a
linha vazia e precisaria de mais um clique em "Editar" para escrever o texto pela primeira vez.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`renderTemplateEditor` virou a linha
compacta; `abrirEditorDeResposta` substitui `abrirEditorDeVariantes`, agora edita nome + texto +
variações juntos, com lista dinâmica). Manifesto 0.8.3 → **0.8.4**. Sete suítes passando.

---

## 2026-08-15 — Popup para editar as variações 2 e 3 de cada resposta

**Pedido:** as variações de texto (ver 12/08) só existiam em `store.DEFAULT_TEMPLATES` — sem
jeito de ver ou mudar pela interface. Perguntado, ele confirmou querer isso: um popup para ver e
editar as variações.

**`abrirEditorDeVariantes(template)`:** reusa a mesma caixa não-bloqueante e arrastável da
pergunta da rodada (`wf-pergunta`/`wf-pergunta-fundo`), mas com dois `textarea` (variação 2 e 3)
em vez de botões de decisão. O texto PRINCIPAL continua editado só na aba Respostas — aqui é
só o que faltava. Botão "Variações" novo no card de cada resposta, com a contagem
(`Variações (3)`) quando já existem.

**Campo vazio = aquela posição da rotação some.** `Salvar` filtra strings vazias antes de gravar
— nunca grava variação em branco, porque mandar mensagem vazia para um contato é pior que não
ter variação nenhuma. Zerar os dois campos volta a resposta a mandar sempre o texto principal
(`varianteAtual` já trata `variantes: []` como "sem rotação").

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`abrirEditorDeVariantes`, botão
"Variações" em `renderTemplateEditor`). Manifesto 0.8.2 → **0.8.3**. Sete suítes passando.

---

## 2026-08-13 — Número fora do ar: a rodada só pode pular

**Relato (Thiago, print):** tarja no topo da plataforma — *"O WhatsApp (51) 99511-0122 foi
**desconectado da Z-API**. Solicite ao administrador da conta que realize a reconexão."* — e o
atendimento aberto era justamente dessa instância. Pedido: *"o número está fora do ar para alguns
contatos, até voltar esse número só tem a opção de pular"*.

**Por que isso é obrigatório e não capricho:** com o canal fora, a plataforma **aceita** o envio.
O balão aparece na conversa e fica lá sem entregar. A rodada contaria como enviado, marcaria no
anti-duplicata (que depois recusaria mandar de novo) e concluiria o atendimento — o contato sairia
do trabalho sem nunca ter recebido nada. É a pior falha possível aqui: silenciosa, e com a tela
dizendo que deu certo.

**A leitura é por TEXTO, não por classe** (`dom.canalDesconectado`): a tarja é do tema da
plataforma, e o texto é o que ela promete ao usuário. O negrito parte a frase em vários nós, então
o nó que casa com "desconectado" não traz o telefone — sobe até três níveis até achar o número.

**A conta tem VÁRIAS instâncias e cai uma por vez.** Por isso a trava não é "tem tarja, não envia":
compara o número da tarja com o do cabeçalho da conversa (`dom.numeroDaConversa`, o telefone ao
lado de "Instância f68546"). Trabalho em número bom continua andando.

**Falso positivo que o fixture pegou antes de virar defeito:** um contato escrevendo *"fiquei
desconectado uns dias, desculpa a demora"* casava com o padrão, e o bloco três níveis acima trazia
o telefone do cabeçalho — a rodada recusaria enviar para quem não tinha nada a ver com isso. A
tarja promete duas coisas que a conversa não tem (o provedor e o que fazer a respeito); agora é
exigida uma delas: `z-api|reconex|solicite ao administrador`. Quatro casos novos em
`tools/checar-dom.mjs`, 22 no total, todos passando.

**Onde a trava age:**

- **rodadas que perguntam** (3 e 6): some TODA saída que envia; sobram "Pular" e "Parar a rodada",
  com o motivo em destaque. Na rodada 6 a etiqueta **não** sai e o atendimento **não** fecha — o
  contato tem que continuar na fila para quando o número voltar;
- **rodadas que não perguntam** (Novos e a antiga de sem retorno): pula o contato e segue, porque
  a fila pode misturar instâncias e parar tudo tiraria do trabalho quem está num número bom;
- **reabrir em lote (rodada 5): não é afetada.** Reiniciar não manda mensagem, então ela funciona
  normalmente com o canal caído — dá para adiantar todo o reabrir enquanto o número não volta.

Falha para o lado seguro: erro ao ler a tela devolve "não está fora". Tarja não lida custa um
envio que talvez não saia; falso positivo trava a rodada inteira à toa.

**Arquivos:** [src/lib/dom.js](src/lib/dom.js) (`canalDesconectado`, `numeroDaConversa`,
`textosDaPagina`), [src/lib/page.js](src/lib/page.js) (`canalForaDoAr`, fora da `pageStateLocal`
de propósito — aquilo é lido a cada 400 ms), [src/lib/rpc-host.js](src/lib/rpc-host.js),
[src/panel/panel.js](src/panel/panel.js) (`canalDesteContatoFora`, `linhaCanalFora`, as quatro
rodadas), [tools/checar-dom.mjs](tools/checar-dom.mjs). Manifesto 0.8.0 → **0.8.1**.

---

## 2026-08-12 — Número caindo: diagnóstico, e variação de texto para não parecer disparo repetido

**Relato:** o número derrubou depois de reabrir poucos (~10) atendimentos "sem retorno" e
responder à mão — suspeita de ter sido pego por spam.

**Diagnóstico (não é volume):** `mobiliza.app` conecta por **Z-API**, que é API NÃO oficial
(WhatsApp Web via QR Code, simula uso humano) — não é a Cloud API homologada da Meta. Com só
~10 mensagens, a teoria de "penalização por volume" (que pesa em milhares numa janela) não bate.
Suspeito mais provável: o PADRÃO da automação (reabrir concluído → mandar → concluir de novo,
em sequência, com o mesmo texto repetido) parece disparo em massa aos olhos do WhatsApp,
independente da quantidade. Também confirmado nesta conversa, no momento do diagnóstico: **a
trava de canal desconectado que o CLAUDE.md descrevia como resolvida ainda não existia no
código** (`grep` por `canalDesconectado`/`numeroDaConversa` não achava nada em `src/`) — foi
implementada em paralelo, nove commits à frente deste, e chegou aqui pelo merge: ver a entrada
de 2026-08-13 logo acima.

**Ideia descartada:** adicionar os ~7.500 contatos sem retorno a grupos, em vez de mandar
mensagem direta. Não reduz o risco (adicionar sem consentimento é padrão de abuso monitorado
com mais peso, e falha sozinho para quem tem "quem pode me adicionar" ≠ Qualquer um) e cria um
problema NOVO de LGPD (expõe telefone/nome/foto a todo o grupo sem consentimento). Mandar o
LINK do grupo por DM foi cogitado como alternativa e **descartado pelo próprio Thiago**: é o
mesmo mecanismo de risco (reabrir 1:1 e mandar mensagem em sequência para gente fria) — só muda
o conteúdo, não o padrão que aparentemente pesa.

**Implementado — variação de texto por rotação.** Pedido: 3 variações de cada resposta pronta,
alternando a cada envio, para não repetir a mesma frase exata. `store.DEFAULT_TEMPLATES` ganhou
`variantes: [texto2, texto3]` em 9 das 11 respostas (as 2 de risco jurídico, `pedido-ajuda` e
`pedido-emprego`, ficam de fora de propósito — variedade não vale reescrever texto que se apoia
em lei, e são resposta a pedido individual, não disparo em massa). Cada variante muda só a
superfície (abertura/conectivo/fechamento); o que o parser exige **fica idêntico** nas três —
"Nome completo / Cidade" e "Sim / Nome completo / Cidade" são casadas literalmente por
`extract.findStructured`, mexer aí quebraria a resposta de quem caiu na variante 2 ou 3.

`templates.varianteAtual(template)` lê o ponteiro de rotação (`store.varianteIndex`, novo) sem
avançar — preview e o começo de um envio veem a MESMA coisa. `templates.avancarVariante` só
roda depois que a mensagem **sai de verdade** (`page.sendText` bem-sucedido), nunca em preview
nem em "Só inserir": queimar a rotação sem nada ter saído faria a próxima pular sozinha. Havia
DOIS pontos de envio de texto, não um: `sendTemplate` (manual + respostas rápidas da rodada) e
`processarNovo` (rodada 1, "Novos: pedir dados" — reimplementa o envio por fora do
`sendTemplate`) — os dois foram ligados à rotação.

`templates.migrarVariantesDeTexto` acrescenta `variantes` a quem já tem a resposta salva no
navegador, e só quando o texto-base bate **exatamente** com o padrão — resposta que o Thiago já
reescreveu fica de fora (em silêncio, sem variante nenhuma) para não misturar a variante do
texto original com a base editada dele.

**Arquivos:** [src/lib/store.js](src/lib/store.js) (`variantes` nos templates, `varianteIndex`
nos defaults), [src/lib/templates.js](src/lib/templates.js) (`varianteAtual`, `avancarVariante`,
`migrarVariantesDeTexto`), [src/panel/panel.js](src/panel/panel.js) (`sendTemplate`,
`renderTemplateCard`, `processarNovo`, aviso no editor da aba Respostas). Suíte nova:
[tests/templates.test.mjs](tests/templates.test.mjs) — sete suítes agora, `CLAUDE.md` atualizado.
Manifesto 0.8.1 → **0.8.2** (não tinha subido no commit original — comportamento visível novo).

**Pendente, ainda sem decisão do Thiago:** reduzir limite/pausa específicos da rodada "Sem
retorno"; variação do **modelo aprovado (HSM)** da rodada 4 — hoje é um só
(`auto.cfg.templateId`, seletor único); rotação aí só é possível se houver mais de um modelo
aprovado registrado na plataforma com conteúdo parecido, o que não foi confirmado. (A trava de
canal desconectado, também pendente neste ponto do diagnóstico, foi implementada em paralelo —
ver a entrada de 2026-08-13 acima.)

---

## 2026-08-12 — Rodada 6: os reabertos, trabalhados em "Meus"

**Escolha dele**, à pergunta de quem manda a mensagem depois do reabrir em lote: *"uma rodada em
Meus"*, com pergunta a cada contato. É a segunda metade do fluxo que a rodada 5 abriu.

**`processarSemRetornoEmMeus`.** O atendimento já está aberto (foi a rodada 5 que reabriu), então
não há Reiniciar: abre, pergunta, manda, tira a etiqueta e conclui. Cinco saídas — modelo
aprovado, a resposta "Sem retorno: ainda tem interesse?" (**só com a janela de 24h aberta**),
pular, concluir sem enviar, responder à mão.

**A trava que decide quem entra:** "Meus" não é uma fila só — tem quem veio dos Novos, quem
respondeu, e quem foi reaberto aqui. A rodada confere se o contato tem a etiqueta configurada e
pula com o motivo na tela quando não tem. O contato já está carregado, então a conferência é de
graça, e sem ela a pergunta de sem retorno iria para quem está no meio de outra conversa.

**Ordem de propósito: grava e tira a etiqueta ANTES de enviar.** Se o envio falhar, o contato
continua na lista e volta amanhã. O inverso — etiqueta fora, mensagem não enviada — o tiraria do
trabalho em silêncio, que é o modo de falhar que este projeto já teve várias vezes.

**Pular mantém a etiqueta**, e isso é dito no rótulo da tecla ("Pular (mantém a etiqueta)" ×
"Concluir sem enviar (tira a etiqueta)"): a diferença entre as duas saídas é justamente essa, e
esconder isso faria contato sumir da lista sem ter sido atendido.

**Anti-duplicata vira LINHA da pergunta, não pulo.** `wasSent` e `decidirReenvio` continuam
consultados, mas o resultado aparece com "⚠" e tira o destaque da opção de enviar, em vez de
pular sozinho. Pulo silencioso já foi defeito duas vezes aqui.

**Sem `confirm()` de abertura**, diferente das outras rodadas: esta pergunta contato a contato, e
uma confirmação em massa no começo seria só mais uma porta para atravessar sem decidir nada.

Os dois passos ficam **no mesmo cartão** — são um movimento só, feito em dois momentos; separá-los
em cartões distantes é o que faz esquecer o segundo.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`processarSemRetornoEmMeus`,
`fecharSemRetorno`, `runLoteEmMeus`, segunda metade do `renderCartaoReabrir`,
`NO_REPLY_TEMPLATE_ID`). Manifesto 0.7.0 → **0.8.0**. Seis suítes passando.

---

## 2026-08-12 — Rodada dos concluídos desmontada em duas: reabrir em lote, trabalhar depois

**Pedido dele:** *"em vez de reiniciar ir para os meus e mandar mensagem, irá somente reiniciar as
conversas, após reiniciar determinado número de conversas irei trabalhar diretamente na aba meus
onde irei mandar a mensagem para ver interesse e retirar a etiqueta de sem retorno para quando
concluir ela não voltar pro topo dos concluídos"*.

**Por que o desenho novo é melhor, e não só diferente:** o fluxo antigo fazia tudo num contato só
— reabrir, mandar, concluir — e o Concluir devolvia a pessoa ao **topo** dos concluídos. Foi daí
que saíram, uma a uma, `contatosTratados`, `decidirReenvio`, `continuaNaFila` e o avanço de
posição: trava sobre trava para não tratar a mesma pessoa duas vezes numa lista que se reordena
embaixo da rodada. Reabrir **tira o atendimento da lista de concluídos de vez**. Some o problema
inteiro, não o sintoma.

**Rodada 5, `processarReabrir`:** percorre a lista filtrada e só clica em Reiniciar, até o limite.
Nada é enviado — então não tem modelo para escolher, janela de 24h para respeitar, anti-duplicata
para consultar nem dano possível a contato nenhum. Confere `hasComposer` depois do clique em vez
de acreditar nele: sem campo de mensagem o atendimento não reabriu, e contar como reaberto
deixaria a pessoa fora do trabalho em "Meus" sem ninguém saber.

**Duas mudanças no laço que a rodada nova exigiu:**

- `CONTA_NO_LIMITE` (`enviado` + `reiniciado`). O limite contava só envios, então uma rodada que
  não envia nada rodaria até a fila acabar — o número que ele digita nunca seria atingido.
- A pausa passou a depender do que aconteceu: **longa só quando saiu mensagem**. A longa protege
  o número no WhatsApp; reabrir não manda nada e precisa só da curta, que protege o servidor.
  Na prática é a diferença entre reabrir 50 em 1 minuto e em 7.

`reiniciado` entra em `SAI_DA_FILA` (o item deixa os concluídos, então a posição não avança).

**A etiqueta:** `auto.etiquetaSemRetorno` (padrão `1 SEM RETORNO`), e ela sai do contato quando o
atendimento é concluído **pelo painel** — `tirarSemRetorno`, passado só pelos fluxos que concluem,
nunca pelo Salvar solto: um Salvar no meio do trabalho tirando a etiqueta faria o contato sumir da
lista filtrada ainda faltando ser atendido. Como em "Meus" quem conclui é ele, pela plataforma, a
aba Dados ganhou o botão **Tirar "1 SEM RETORNO"** — o Concluir é da plataforma, não temos gancho
nele. O botão relê o contato depois de gravar (a API responde 200 ignorando o valor) e separa as
duas falhas possíveis: contato sem a etiqueta × etiqueta que não existe com aquele nome.

**O cartão antigo continua lá.** "Sem retorno: reabrir e perguntar" não foi apagado — o fluxo novo
é o de cima, e o antigo fica para quando ele quiser tudo num contato só.

**Perguntado e respondido:** o envio em "Meus" **vira rodada** — ver a entrada acima.

**Aviso que vale repetir:** reabrir **não** reabre a janela de 24h do WhatsApp. Em "Meus", texto
livre continua não chegando em quem está sem retorno há dias — só modelo aprovado chega.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`processarReabrir`, `runLoteReabrir`,
`renderCartaoReabrir`, `CONTA_NO_LIMITE`, pausa por tipo de resultado, `tirarSemRetorno`,
`etiquetaSemRetornoDoContato`, `tirarSemRetornoDoContato`),
[src/lib/store.js](src/lib/store.js) (`auto.etiquetaSemRetorno`). Manifesto 0.6.2 → **0.7.0**.
Seis suítes passando.

---

## 2026-08-12 — A caixa da cidade sobrevivia à troca de contato (gravaria na pessoa errada)

**Relato (Thiago):** *"saí e voltei e deu duas sugestões de cidade sem chat novo"* — e o print
mostrou muito mais que duplicata.

**O que o print mostra:** painel com **"Abra um atendimento na plataforma para começar"** (nenhum
contato carregado), conversa aberta a do **Odir**, e uma caixa por cima perguntando por **"Estrela
Velha"** — cidade que não aparece em lugar nenhum daquela conversa. A caixa era restolho de um
contato anterior.

**Causa raiz:** `perguntarNaRodada` pendura a caixa no `root` do painel, e `renderAll` só troca
os filhos de `header` e `body`. Trocar de atendimento nunca a tirava da tela. E como a caixa é
**não-bloqueante de propósito** (para ele poder ler a conversa e trocar de atendimento enquanto
decide), o intervalo entre a pergunta e a resposta é justamente quando o contato muda.

**Por que isso é grave, e não cosmético:** quem responde a caixa mexe em `state.draft` e a
gravação vai para `state.contact.id` — os dois já apontando para a pessoa NOVA. Um "1 Aceitar"
naquele print gravaria "Estrela Velha" em quem estivesse aberto. Escrita em produção, base de
eleitor real. Ninguém veria: o painel diria "Aplicado sozinho: Cidade" e estaria falando a
verdade sobre o contato errado.

**Fix, duas travas independentes:**

1. `load()` chama `cancelarPerguntaDeCidade()` logo na primeira linha. A promessa da pergunta
   passou a expor `.cancelar(valor)`, e a resposta `CANCELADA` **não é resposta**: não aceita,
   não recusa, não vira memória de recusa — só desfaz.
2. `saveClassification` guarda o id do contato **antes** da pergunta e desiste da gravação
   inteira se ele mudou, dizendo "você trocou de atendimento no meio — não gravei nada". Essa
   segunda trava pega qualquer variante da corrida, inclusive as que eu não enxergo daqui.

Na dúvida, não grava: a próxima abertura do contato certo refaz tudo do zero, sem custo nenhum.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`perguntarNaRodada` com `.cancelar`,
`cancelarPerguntaDeCidade`, `CANCELADA`, guarda de contato em `saveClassification`),
[CLAUDE.md](CLAUDE.md). Manifesto 0.6.1 → **0.6.2**. Seis suítes passando.

---

## 2026-08-12 — Duas caixas de cidade na tela, e a recusa que não durava

**Relato (Thiago, print com a v0.6.0 rodando):** *"duplicado, e faça disparar novamente só se
tiver chat novo com provável cidade, estou botando sem cidade e pede novamente"*. Duas caixas
"Cidade a gravar" abertas ao mesmo tempo, as duas perguntando a mesma coisa ("Quaraí").

**Causa raiz da duplicata:** `load()` **não roda dentro de `withBusy`**, então `state.busy`
continua falso enquanto ele carrega. Chegou mensagem nova (a figura das 18:56) → `applyPageState`
viu `conversaMudou` → `reexaminarMensagens` → segunda `aplicarAutomatico`, com a primeira ainda
parada esperando a resposta da caixa. Cada uma abriu a sua. Responder uma deixava a outra na tela
perguntando o mesmo — é daí que veio o "pede novamente".

**Fix:** `perguntaDeCidade` guarda a promessa da pergunta em curso. Quem chega depois **espera a
mesma pergunta** em vez de abrir outra; quando ela responde, o rascunho já está decidido e a
segunda gravação segue com a decisão tomada. Não é debounce nem lock com timeout: é a mesma
resposta servindo os dois caminhos.

**Causa raiz da recusa que não durava:** `state.cidadeRecusada` era um `Set` em memória, zerado
no começo de todo `load()`. Fechar e reabrir o contato — ou a rodada passar por ele de novo — e a
mesma pergunta voltava.

**Fix:** a recusa vai para o `chrome.storage.local`, por contato e **por cidade**
(`store.cidadeRecusada`, com `lembrarCidadeRecusada`/`cidadesRecusadas`). Guardar a cidade, e não
um "não perguntar mais" no contato, é o que atende a outra metade do pedido — *"disparar
novamente só se tiver chat novo com provável cidade"*: mensagem nova que traga cidade
**diferente** volta a perguntar (é informação nova, e é justamente o caso de quem escreve a
cidade depois); a mesma cidade já recusada, nunca mais. A leitura entra no `load()` **antes** do
`extract`, senão `applyGuesses` repõe a cidade recusada no rascunho e a caixa aparece antes de
alguém consultar a memória.

**Poda:** `MAX_CONTATOS_RECUSA = 2000`, descartando o mais **parado** (`at` é renovado a cada
recusa, então contato ativo não é esquecido por ser antigo). A base é de milhares de contatos e o
storage não é infinito — estourar a gravação no meio de uma rodada custa mais que uma pergunta
repetida daqui a meses. Fora do `exportJson`: é referência a contato real.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`perguntaDeCidade`, `recusarCidade`,
semeadura no `load`, guarda em `corrigirNomeComCidade`), [src/lib/store.js](src/lib/store.js)
(`cidadeRecusada`, `lembrarCidadeRecusada`, `cidadesRecusadas`, `MAX_CONTATOS_RECUSA`),
[tests/parser.test.mjs](tests/parser.test.mjs) (10 asserções novas). Manifesto 0.6.0 → **0.6.1**.

---

## 2026-08-12 — "Tem extensão dentro da extensão": os fixes nunca chegaram ao Chrome

**Relato (Thiago):** *"o erro está na pasta, tem extensão dentro da extensão"*.

Isso fecha a tarde inteira. A cidade continuava sendo gravada sozinha depois de dois commits que
justamente impediam isso — e a explicação não era o código: **a pasta que o Chrome carrega não é
a que o GitHub Desktop atualiza.** Uma cópia da extensão dentro da pasta da extensão (zip
descompactado, ou `dist/`, que é *gitignorado* e por isso nunca é tocado pelo Desktop) fica
congelada para sempre. Toda correção ia para a pasta certa e o Chrome lia a errada.

Conferido: o repositório está limpo — **um** `manifest.json`, na raiz, nenhuma cópia versionada.
A cópia é local, na máquina dele.

**O que ficou no código, para isso não custar outra tarde:** a versão do manifesto passa a
aparecer no cabeçalho do painel, ao lado de "encaixado na aba" (`versaoCarregada`). Sem número na
tela não há como distinguir *"o fix não funcionou"* de *"o fix não chegou"* — e as duas hipóteses
levam a caminhos opostos. Eu passei a tarde na primeira; era a segunda. Manifesto subiu para
**0.6.0**, para o número da tela ser diferente do que estava rodando.

**Regra nova no CLAUDE.md:** mudou comportamento visível, sobe a `version` do manifesto no mesmo
commit — é o que torna a conferência possível.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`versaoCarregada`, cabeçalho),
[manifest.json](manifest.json) (0.5.0 → 0.6.0), [CLAUDE.md](CLAUDE.md).

---

## 2026-08-12 — O rótulo da opção prometia gravar a cidade sozinho

**Pergunta dele:** *"se eu remover a cidade e as etiquetas vai automaticamente pegar sem minha
permissão?"* — perguntada sobre o teste que eu propus (apagar o campo e reabrir).

Com a versão que estava na máquina dele, **sim**: é o defeito. Com o código novo, não — mas o
rótulo da opção na aba Config ainda dizia *"Gravar sozinho, ao abrir o contato, o que bate exato
(cidade do IBGE, COREDE, etiquetas de conteúdo)"*. Prometia exatamente o que tinha deixado de
fazer. Rótulo mentindo é pior que rótulo faltando: ele foi conferir na tela e a tela confirmou o
medo dele. Corrigido, junto com o comentário de `aplicarAutomatico`, que dizia o mesmo.

**O que entra sozinho, hoje, campo a campo** (para não ter que reler o código da próxima vez):

- **Cidade** — nunca. `confirmarCidadeSePendente` pergunta antes, inclusive na gravação automática.
- **COREDE** — só junto com a resposta da cidade. Recusada a cidade, `refreshTagSuggestions` roda
  de novo e a sugestão de região some antes da gravação.
- **Etiqueta de conteúdo** — sim, sozinha. É regex que ele escreveu na Config casada contra o
  texto: ou a palavra está na mensagem ou não está, não tem palpite no meio.
- **Data de conclusão** — sim, e só quando o campo está vazio.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (rótulo do `checkbox` de `autoApply`,
cabeçalho de `aplicarAutomatico`).

---

## 2026-08-12 — "Pegou novamente sem eu confirmar": não pegou, e o print prova

**Relato (Thiago, print do contato "Nice Gomes"):** *"pegou novamente sem eu confirmar não rodei
nada só abri o contato"*. Cidade "Caçapava do Sul" no CRM e no cabeçalho do painel.

**O que o print mostra, medido:** a linha de status da própria extensão diz **"Gravado: nada —
PROBLEMA: Data de conclusão do contato: Falta aprender o contrato de DATE"**. `aplicarAutomatico`
rodou (a data está vazia) e não gravou campo nenhum. Se a cidade fosse palpite novo, ela estaria
em `changes` e o status seria "Aplicado sozinho: Cidade". Ela não estava — a entrada era
`from: 'crm'`, ou seja **a cidade já estava no CRM antes de ele abrir**.

Quando foi escrita: o atendimento foi assumido às 15:00 e o print é das 21:14 ("há 6 horas"). Foi
gravada às 15:00, pelo código antigo, antes do popup existir. Reproduzido offline: `extract` sobre
as duas mensagens reais devolve `{cidade: 'Caçapava do Sul', confidence: 'exata', informada:
false}` — exatamente o palpite que a versão antiga gravava sozinha.

**Conclusão:** o fix da entrada anterior não estava no navegador dele (Desktop não tinha puxado /
extensão não recarregada). Nada a corrigir no popup. Para conferir de verdade: apagar a Cidade de
um contato de teste e abrir — a caixa tem que aparecer antes de qualquer escrita.

### Achado de verdade no mesmo print: dois COREDEs no mesmo contato

O contato está com as etiquetas **CAMPANHA** e **MÉDIO ALTO URUGUAI**. Caçapava do Sul é COREDE
**Campanha** (conferido em `coredes-rs.json`) — então "Médio Alto Uruguai" é COREDE errado
pendurado no contato.

**Causa raiz:** `etiquetasDeRegiaoASair` só devolvia algo quando a cidade tinha sido
**substituída** (`entrada.substituiu`). Aqui a cidade **preencheu um buraco** (o campo estava
vazio), então `substituiu` era nulo e o COREDE antigo nunca saía. Dois COREDEs num contato é o
mesmo dado errado que a função existe para evitar, só que por outra porta.

Segunda armadilha, que quase fez o fix não funcionar: a etiqueta CERTA já estava aplicada, e
`marcada` é falso justamente para não reaplicar o que já está lá — então procurar a região nova
na lista das que vão ser aplicadas devolvia nada. Agora a região é buscada em `tagSuggestions`
inteira, e a antiga só sai se a certa **fica** (vai ser aplicada agora ou o contato já a tem):
tirar a antiga sem pôr a nova deixa o contato sem COREDE nenhum, que é pior que os dois.
`etiquetaConfiavel` continua sendo a trava — cidade de palpite não-exato não manda tirar nada.

Contatos já sujos se consertam sozinhos na próxima gravação (abrir com data de conclusão vazia
já dispara), não precisa de mutirão.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`etiquetasDeRegiaoASair`,
`saveClassification` passando as sugestões aplicáveis). Seis suítes passando.

---

## 2026-08-12 — O popup da cidade cobria só metade (e a outra metade era a que ele via)

**Relato (Thiago):** *"eu pedi para me mostrar um popup antes de registrar a cidade mas continua
registrando automaticamente"*.

**Causa raiz:** a entrada de baixo (mesmo dia) resolveu a cidade tirada do FORMATO do cadastro
("Cidade - Nome"), e só ela. A cidade tirada das MENSAGENS entra por outro caminho —
`applyGuesses`, com `confidence: 'exata'` quando casa com a lista do IBGE — e `aplicarAutomatico`
grava todo palpite `exata` no instante em que o contato é aberto, sem clique nenhum. Essa é a
comum: o caminho do cadastro é raro, o das mensagens acontece em todo contato que escreve o nome
de um município. O popup existia, ele nunca o via, e o CRM continuava sendo escrito sozinho.

**Fix:** a confirmação virou regra do CAMPO, não da origem. `applyGuesses` marca toda entrada de
Cidade com `pendente: true`, e `saveClassification` — único lugar que escreve no CRM — chama
`confirmarCidadeSePendente` antes de montar `changes`, **inclusive na gravação automática**, que
era justamente a que passava batido. A caixa é a mesma da rodada (`perguntarNaRodada`: sem fundo
escuro, arrastável, não trava a conversa) e diz de onde a cidade saiu, se é palpite não-exato e
se vai substituir a que está no CRM. Três saídas: **1 Aceitar** grava; **2 Corrigir** descarta;
**3 Sem cidade** grava vazio. Esc = descarta (na dúvida não grava), e a dica da caixa passou a
dizer isso em vez de "Esc para parar a rodada" — esta caixa decide um campo, não o atendimento.

**Decisão consciente:** isto abre exceção à regra *"automático só grava o determinístico"* do
CLAUDE.md. Casar exato com o IBGE prova que o texto é o nome de um município, **não** que seja a
cidade dele — *"meu genro mora em Santiago"* casa igualzinho. Instrução dele vence a regra.

**Trava junto:** recusar não adiantava sozinho. `applyGuesses` só preenche buraco, recusar
esvazia o campo, e a releitura da conversa (que roda sozinha quando o contato responde) devolvia
o mesmo palpite e perguntava de novo — popup em laço dentro da rodada. Agora `state.cidadeRecusada`
guarda o que foi recusado enquanto o contato estiver aberto. A etiqueta de COREDE sai junto:
recusada a cidade, `refreshTagSuggestions` roda de novo, senão o contato ficava com o COREDE de
uma cidade que ele acabou de recusar.

### Junto: o anti-repetição por conversa tinha sido removido

O commit `0e4cc6a` ("atualizado") apagou `hsm.decidirReenvio`, o teste dele, o
`auto.horasSemRepetir` do `store.js` e o campo dele na aba Automatizado — trocados pelo
`contatosTratados`, um `Set` de contatos já tratados dentro da rodada.

**Não é a mesma trava.** `contatosTratados` nasce vazio a cada rodada e cobre o item que volta ao
TOPO da lista dentro da MESMA rodada. O caso relatado ao vivo (*"falhou e mandou mensagem
novamente"*) foram DUAS rodadas: resposta pronta às 14:05, modelo aprovado às 14:37 — `Set` novo,
chaves diferentes no registro, duas mensagens em 32 minutos. Restaurado, e as duas travas
convivem: `contatosTratados` dentro da rodada, `decidirReenvio` (que pergunta à CONVERSA, então
conta também o que foi mandado à mão) entre rodadas.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`confirmarCidadeSePendente`,
`applyGuesses`, `state.cidadeRecusada`, `perguntarNaRodada` com `dica`, `processarSemRetorno`,
cartão da rodada), [src/lib/hsm.js](src/lib/hsm.js) (`decidirReenvio`),
[src/lib/store.js](src/lib/store.js) (`auto.horasSemRepetir`),
[tests/hsm.test.mjs](tests/hsm.test.mjs). Seis suítes passando.

---

## 2026-08-12 — Cidade gravada sem a pessoa ter dito nada ("Lourdes" → "Cerrito")

**Relato (Thiago, print):** contato "Lourdes" ficou com Cidade "Cerrito" na conversa inteira sem
ninguém ter mencionado nenhuma cidade — só a mensagem do anúncio e um desabafo sobre política.

**Causa raiz:** não é `matchCity` (conferido: nem a mensagem do anúncio nem o desabafo casam com
"Cerrito", distância de Levenshtein bem acima da tolerância). É `corrigirNomeComCidade` em
[panel.js](src/panel/panel.js:320): quando o Nome no CRM está no formato "Cidade - Nome"
("Cerrito - Lourdes"), `splitCidadeNome` separa os dois, e a cidade entrava como palpite
`confidence: 'exata'`. `aplicarAutomatico` grava sozinho qualquer palpite `exata` — então essa
cidade era escrita no CRM sem clique nenhum, só por causa do FORMATO do cadastro, não porque a
pessoa disse. O parsing é determinístico; o dado por trás (por que o cadastro foi digitado
assim) não é.

**Fix, primeira volta:** mudei para `confidence: 'aproximada'` — tirou do `aplicarAutomatico`
(silencioso), mas o Thiago apontou o furo que sobrou: o Salvar/Concluir manual grava QUALQUER
palpite não vazio, sem perguntar nada. Confiança marcada como "aproximada" não é confirmação,
é só deixar de esconder — continuava indo pro CRM no primeiro clique em Concluir.

**Fix de verdade:** popup de verdade, perguntando antes de gravar. `corrigirNomeComCidade` marca
a entrada com `pendente: true`; `saveClassification` (o ÚNICO lugar que escreve no CRM, manual ou
da rodada) chama `confirmarCidadeDoCadastroSePendente` ANTES de montar `changes` — pergunta com a
mesma caixa não-bloqueante da rodada (`perguntarNaRodada`: sem fundo escuro, arrastável, não
trava a conversa) "está correta?", com três saídas: **1 Aceitar** grava; **2 Corrigir** descarta
e some do rascunho para você preencher na aba Dados; **3 Sem cidade** marca o campo como `manual`
vazio — não grava nada E não deixa `corrigirNomeComCidade` voltar a sugerir a mesma cidade
enquanto o contato estiver aberto (a checagem é `!state.draft[cidadeField.id]`, e uma entrada
vazia ainda é uma entrada). Só roda em gravação disparada por você — a automática
(`automatico: true`) já nem inclui este palpite no `changes` (não é `exata`), perguntar ali seria
popup surgindo sem clique nenhum que o justifique.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js:320) (`corrigirNomeComCidade`,
`confirmarCidadeDoCadastroSePendente`, chamada em `saveClassification`). Seis suítes de teste
passando — panel.js não é coberto por elas (arquivo grande, sem teste próprio), então não havia
asserção prévia travando esse comportamento.

---

## Estado atual (histórico — ver "ONDE PAROU" no topo)

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
   Thiago. A candidata que estava aqui, **pedido de emprego**, foi escrita em 12/08 — falta usar
   uma vez e ver se o texto segura a conversa.

**Risco permanente:** toda escrita é em produção, com dados reais de eleitores. O contrato de
escrita mora no `chrome.storage.local` e já sumiu uma vez sem causa identificada — exportar
backup pela aba Config evita refazer o aprendizado.

---

## 2026-08-12 — Resposta nova: pedido de emprego (a lei cita "emprego" com todas as letras)

**Pedido:** "continue do projeto". A fila de trabalho estava com os itens 0 a 3 dependendo da
sessão ao vivo dele (rever os "Capitão", preencher a tabela Modelo por conteúdo, rodar "Meus",
confirmar em uso) e o 4 bloqueado por não existir HSM com parâmetro para aprender. O item 5
nomeava a próxima resposta a escrever, e é código: **pedido de emprego**.

### Por que ela é irmã da `pedido-ajuda`, e não uma resposta qualquer

O risco jurídico é o mesmo — na verdade um pouco maior. A Lei 9.504/97, art. 41-A, define
captação ilícita de sufrágio como oferecer ou prometer ao eleitor vantagem de qualquer natureza,
**"inclusive emprego ou função pública"**: é o único caso em que a coisa pedida está escrita na
lei. O art. 73, V ainda proíbe nomear, contratar ou admitir servidor nos três meses anteriores ao
pleito. Então a recusa se apoia na lei, como a do pedido de ajuda: é verdade e tira o peso pessoal
do não.

### A decisão que importa no texto

Ela **não oferece encaminhar currículo** nem "passar adiante" para empresa nenhuma, e isso é de
propósito: intermediar contratação é exatamente o que a regra proíbe, e promessa de repassar
currículo é promessa que ninguém cumpre — vira a mesma frustração, só que mais tarde. O teste
tranca isso: qualquer reescrita que fale em currículo derruba a suíte.

O caminho indicado é o do trabalho, não o da assistência: no RS as agências do **SINE são
operadas pela FGTAS**, e as mesmas vagas estão no **Emprega Brasil** (gov.br). O CRAS entra
depois, para qualificação e para o que sustenta a pessoa enquanto o trabalho não vem. O fecho é o
mesmo da `pedido-ajuda` — "procurou e não foi atendido? aí sim é trabalho nosso" —, que é a parte
que o mandato pode fazer de verdade.

Sem vocativo, como todas as outras (regra do projeto).

### Chega a quem já usa o painel

`DEFAULT_TEMPLATES` só vale para quem nunca gravou nada, e a lista dele está no
`chrome.storage`. Migração própria (`migrarRespostaPedidoEmprego`, flag `respostaPedidoEmprego`),
com as travas de sempre: só acrescenta, nunca reescreve, roda uma vez só — apagar a resposta de
propósito não a faz voltar.

### Arquivos alterados

`src/lib/store.js`, `src/lib/templates.js`, `tests/vars.test.mjs`.

**Nota desta sessão:** a pasta em que trabalhei **não é repositório git** (não existe `.git`), então
não houve commit nem push. Ao levar estes arquivos para o clone de verdade, o commit é
`feat(templates): resposta pronta para pedido de emprego`.

---

## 2026-08-12 — "Pegou Santiago em vez de Porto Alegre" — o parser estava certo, a regra é que não

**Relato dele:** print do contato "Luci - Porto Alegre" com `Cidade: Santiago` no CRM e a
etiqueta **Vale do Jaguari** (COREDE de Santiago) aplicada. "É um erro antigo."

### Reproduzi antes de mexer — e o parser não era o culpado

Rodei as mensagens dele pelo parser atual: `Olá! Eu aceito receber conteúdos…` + `Meus parentes`
+ `PORTO ALEGRE` devolve **Porto Alegre, exata**. Nunca Santiago. Ele estava certo ao dizer que
é erro **antigo**: o "Santiago" é dado velho gravado no CRM em alguma passada anterior.

O defeito de hoje é outro, e é o que interessa: **a extensão via o certo e mantinha o errado.**

### Causa raiz 1 — só resposta com separador contava como "informada"

A regra de substituição exigia resposta estruturada ("Nome / Cidade"). O contato mandou uma
mensagem inteira escrita `PORTO ALEGRE` — que é a pessoa dizendo a cidade dela de forma **mais**
clara, não menos —, e isso não contava. Resultado: "nunca sobrescrever o CRM" preservava o
Santiago errado, e o COREDE errado junto.

Agora **mensagem que é, sozinha, o nome completo de um município** conta como informada. As
travas são as mesmas: casamento exato e **nome completo, nunca prefixo** — "Vitória", "Esperança"
e "Rosário" começam município do RS e são nome de gente. Vale a mensagem mais recente: quem
mandou "Canoas" e corrigiu para "Porto Alegre" tem a correção respeitada.

### Causa raiz 2 — o cadastro é "Nome - Cidade", e a extensão só lia "Cidade - Nome"

`splitCidadeNome` nasceu para "Canoas - Marines". O cadastro dele é **"Luci - Porto Alegre"** —
a cidade vem depois. Metade da base foi digitada assim, e a cidade escrita no próprio cadastro
era invisível para o painel.

Os dois sentidos agora funcionam, com uma trava nova nos dois: o encurtamento de **uma palavra
só** deixa de separar. "Ana - Vitória" não pode virar Vitória das Missões — aqui o erro não
deixa a cidade errada, deixa o **eleitor com o nome errado**.

### Efeito prático na tela dele

Ao reabrir a Luci: a cidade vira Porto Alegre por substituição, a etiqueta **Vale do Jaguari sai**
e a **Metropolitano Delta do Jacuí entra** (a troca de COREDE já existia desde 10/08), e a
pergunta da rodada mostra `Cidade: Porto Alegre (a pessoa informou; estava "Santiago")`.

### Arquivos alterados

`src/lib/extract.js`, `src/lib/cities.js`, `tests/parser.test.mjs`.

---

## 2026-08-12 — "O contato voltou para o topo, vai pegar o mesmo de novo?" — simulado, não achado

**Pergunta dele:** "após a mensagem o contato voltou para o topo da lista, verifique se vai pegar
novamente o mesmo."

Pergunta certa, e a resposta não estava óbvia no código: a posição anda por conta própria e a
lista muda embaixo dela. Responder de memória seria chute sobre envio para gente real, então
simulei o laço (`tools/simular-fila.mjs`, novo).

### A resposta: não repete — e o caso dele é o que funciona melhor

Quando o contato tratado volta ao **topo**, os itens que estavam acima dele descem uma casa e os
de baixo **não se mexem**. O `posicao++` cai exatamente no próximo não visitado. Simulado com 6
contatos: `A → B → C → D → E → F`, nenhum repetido, nenhum pulado, **6 aberturas para 6
contatos** — nem uma sobrando.

São três camadas, e bastaria a primeira:

1. a posição anda a cada contato tratado (`continuaNaFila`);
2. `visitados` guarda o id da sessão: se a mesma abrir de novo, pula e anda;
3. o anti-duplicata por contato+modelo devolve "já recebeu" antes de qualquer envio.

### O que a simulação achou de errado — e não era o que ele perguntou

No pior caso (lista reordenando de um jeito imprevisto), ninguém é repetido, mas **alguém fica
para trás** — e a rodada terminava dizendo "a fila acabou", como se tivesse percorrido tudo. É o
mesmo tipo de mentira do log de ontem, e o contato sumia do trabalho sem ninguém saber.

Agora o veredito conta: `percorri 12 de 15 da lista — 3 não chegaram a ser abertos. Rode de novo
para pegar o resto`, com o status em vermelho. Não é o caso normal; é o caso que precisava de voz.

### Arquivos alterados

`src/panel/panel.js`, `tools/simular-fila.mjs` (novo).

---

## 2026-08-12 — A rodada volta a mandar o modelo escolhido, e só ele

**Relato dele:** "outro erro é que não utilizou o modelo escolhido e mandou texto".

### Erro de desenho meu, e ele está certo

Ontem eu tinha feito a rodada escolher **por contato**: janela de 24h vencida → modelo aprovado;
janela aberta → resposta de texto, mais barata e editável. Tecnicamente a dedução estava certa —
o Vicente da print tinha escrito 1h16 antes, a janela estava mesmo aberta, e o texto chegou.

E ainda assim é defeito: **ele escolheu um modelo no seletor e saiu outra coisa.** Substituir
escolha explícita por dedução é exatamente o que este projeto não faz em nenhum outro lugar —
é a mesma regra que faz o painel recusar em vez de chutar modelo, etiqueta ou cidade. Ser esperto
não compra o direito de contrariar o que está escrito na tela.

Voltou a ser: **vai o modelo escolhido, sempre.**

### O que sobrou da ideia

A resposta pronta `sem-retorno-interesse` continua na aba Respostas — ele manda à mão, ou pelas
respostas rápidas dentro da pergunta da rodada. Não virou lixo, virou opção dele.

E o Andamento continua marcando quem estava com a **janela aberta**: `… e concluí — a janela dele
estava ABERTA, dava para responder à mão`. A informação que motivou a ideia continua na tela;
o que saiu foi a decisão automática em cima dela.

### Arquivos alterados

`src/panel/panel.js`.

---

## 2026-08-12 — A volta para os concluídos (e o log que mentia sobre o motivo)

**Relato dele:** "faltou retornar para os concluídos e seguir pro próximo contato", com a print
do Andamento.

### O que a print entregou

A rodada **funcionou**: reabriu o Vicente, mandou a resposta livre (janela aberta, então texto —
a escolha por contato fez o que devia) e concluiu. Ela parou na volta, dizendo:

> `Rodada encerrada: 1 enviado(s), 0 pulado(s). A fila carregada acabou (1 item(ns)).`

E a fila da esquerda, na print, está em **"Meus"** — com exatamente 1 item. Ou seja: a rodada
contou a lista errada. O Reiniciar joga o atendimento para "Meus" e a plataforma troca de aba
junto; a volta para os concluídos não aconteceu.

### Causa raiz: a barra que eu media era só a das abas

`barraDaFila()` subia até o **primeiro** ancestral que continha as três abas de texto. Na tela
dele esse ancestral é o invólucro **só das abas** — os ícones (pessoas, caixa, "⋮") ficam num
irmão. Resultado: lista de candidatos **vazia**, nada para experimentar, e a troca falhando.

Agora ela continua subindo enquanto não houver nenhum ícone junto das três abas, e para antes de
chegar na lista de atendimentos.

### O segundo defeito, que é pior: o log mentia

Com a troca de aba falhando, `openQueueSession` **seguia em frente e olhava a lista mesmo
assim** — e reportava "a fila carregada acabou", que é uma afirmação sobre a fila errada. O
motivo verdadeiro (não consegui voltar para os concluídos) ficava guardado num campo que só era
lido quando dava certo.

Agora falha de aba **para na hora, com o nome certo**. Erro de aba é erro de aba: dizer "a fila
acabou" mandou o diagnóstico para o lado oposto, e é o tipo de mentira que custa uma hora.
Junto: "Ver mais" não é mais tentado quando a falha foi de aba — seria paginar a fila errada.

### Duas travas novas na tentativa

Experimentar cliques na barra dele exige cuidado: "Grupos", "Todas" e "Apenas não lidas" trocam
o filtro que ele montou.

- **Só ícone puro entra na lista de candidatos.** A caixa de arquivo é ícone; os filtros que
  estragariam a fila têm rótulo escrito. Ícone com texto ao lado está fora.
- **Candidato não aprendido só é aceito se a lista vier com algo.** Um ícone que abre uma visão
  vazia também deixa as três abas apagadas, e sem isso a rodada daria a fila errada por boa. Do
  já aprendido não se exige, porque no fim da rodada a lista de concluídos legitimamente esvazia.

E o Escape passou a ser dado entre tentativas: o "⋮" abre menu, e menu do Material é modal —
deixá-lo aberto travaria o clique seguinte.

### Arquivos alterados

`src/lib/dom.js`, `src/panel/panel.js`, `tools/checar-dom.mjs`.

---

## 2026-08-12 — Uma rodada de sem retorno, não duas; e a lista de concluídos por tentativa

**Relato dele:** a rodada dos concluídos parou no começo ("Não achei a lista de concluídos") e,
junto, o apontamento que resolveu o desenho: *"tem um erro lógico também, os sem retorno sempre
estão nos concluídos, só preciso de um e não dois."*

### O erro lógico — e ele estava certo

Eu tinha deixado **dois cartões**: "Sem retorno: enviar modelo aprovado" (fila aberta) e
"Concluídos sem retorno: reabrir e perguntar". Mas o fluxo dele conclui todo atendimento, então
**a fila aberta de sem retorno nunca tem ninguém**. O primeiro cartão era um seletor de modelo a
mais para errar, e nada além disso — na print os dois estavam com o mesmo modelo escolhido.

Sobrou uma rodada. A que ficou é a que reabre, e ela cobre os dois casos de graça:
`processarSemRetorno` só clica em Reiniciar **quando o atendimento está fechado**, então um sem
retorno que por acaso esteja aberto passa direto para o envio. Uma rodada, um modelo, os dois
casos. `processarContato` e o cartão duplicado saíram do código.

### A lista de concluídos: parar de adivinhar e passar a experimentar

O gancho daquele ícone não tem `data-cy` conhecido. Eu tinha escrito cinco `data-cy` plausíveis,
cinco nomes de ícone e um casamento por rótulo — **e nenhum acertou na máquina dele**. Mais
chutes só adiariam o problema.

A ordem agora é outra: a rodada **clica e confere**. Pega os candidatos da barra da fila (tudo
que é clicável e não é uma das três abas de texto nem campo de busca), clica um, e confirma pelo
sinal que já era confiável — estar nos concluídos significa que **nenhuma** das três abas está
com `bg-gray-300`. Acertou, guarda o elemento e as próximas voltas são diretas. Errou, **desfaz**
(volta para a aba de antes) e tenta o próximo.

Desfazer não é detalhe: sem isso, um clique em "Grupos" deixaria a rodada percorrendo outra fila
inteira sem ninguém perceber.

O botão "Achar a lista de concluídos" continua, agora como caminho para o conserto definitivo —
com o `data-cy` na mão, ele entra em `CY_CONCLUIDOS` e a tentativa nem chega a rodar.

`tools/checar-dom.mjs` ganhou os dois casos que protegem a lista de candidatos: ela não pode
incluir as próprias abas de texto (clicar nelas troca de fila em silêncio) nem o campo de busca.

### Arquivos alterados

`src/lib/dom.js`, `src/lib/store.js`, `src/panel/panel.js`, `tools/checar-dom.mjs`.

---

## 2026-08-11 — Texto livre na rodada dos concluídos, decidido por contato

**Pedido (Thiago):** "ok então mandar mensagem de texto em vez de modelo pronto não teria
problema, se não tiver problemas faça uma mensagem pronta para enviar para todos."

### A premissa estava errada, e a correção importa

"Para todos" não dá: texto livre **só chega dentro da janela de 24h**, e na fila dos sem retorno
a janela está vencida em praticamente todo mundo — é o que define aquela fila. Mandar texto para
todos ali seria mandar mensagem que não chega para dezenas de pessoas, **sem nada acusar**: a
plataforma aceita, o painel diz "enviado", e o contato nunca vê.

O que ele leu como "então texto serve" era, na entrada anterior, "texto serve **quando a janela
está aberta**".

### O que foi feito

Resposta pronta nova (`sem-retorno-interesse`), editável na Config, e a rodada 4 escolhendo
**por contato**:

- janela **vencida** → modelo aprovado (o único que chega);
- janela **aberta** → a resposta pronta, que fala como gente, não gasta modelo e ele edita.

O Andamento diz qual foi em cada um. Variável sem valor derruba para o modelo, em vez de mandar
texto pela metade.

### Detalhe de implementação que não é detalhe

O envio do texto usa `page.sendText` direto, **não** `sendTemplate`. Esta rodada não chama
`load()` — como as outras rodadas em lote, ela busca sessão e contato direto da API para ficar
leve. Só que `sendTemplate` lê `state.contact`, que nesse momento é o contato de **outro**
atendimento: o registro anti-duplicata cairia na pessoa errada. É a mesma armadilha que já
gerou o aviso "já enviei esta resposta" em quem nunca recebeu.

### O texto

Sem nome (regra do projeto), pede no formato `Sim / Nome completo / Cidade` — o mesmo que o
parser entende — e **oferece a saída de sair da lista**. Isso é de propósito: quem responde
"não" custa muito menos que quem bloqueia o número, e número bloqueado derruba a entrega de
toda a campanha.

Teste novo confere que as três respostas que pedem dados carregam a linha do formato. Se alguém
reescrever uma delas e tirar essa linha, o parser perde o acerto sem nada quebrar.

### Arquivos alterados

`src/lib/store.js`, `src/lib/templates.js`, `src/panel/panel.js`, `tests/vars.test.mjs`.

---

## 2026-08-11 — "Reiniciada só aceita modelo?" — o que é regra do WhatsApp e o que era escolha minha

**Pergunta dele:** "para as conversas reiniciadas só libera modelos prontos, não tem como mandar
mensagem normalmente?"

### Duas coisas diferentes estavam misturadas

**1. A janela de 24h é regra do WhatsApp, e não tem como contornar.** Ela abre quando o
**contato** escreve, e reabrir o atendimento na plataforma não encosta nesse relógio. Fora da
janela, texto livre sai do painel, a plataforma aceita e a mensagem **não chega** — silêncio, o
pior dos resultados. Modelo aprovado é o único que atravessa. Quando a pessoa responde ao
modelo, a janela reabre por 24h e tudo volta ao normal: é exatamente para isso que ele serve.

**2. "Reiniciada = só modelo" era escolha minha, e estava errada como regra geral.** O painel
inteiro já decide isso **por contato**, pelo `expired` que a própria plataforma calcula: com a
janela aberta, texto livre é enviado normalmente — inclusive em conversa reiniciada. Quem
bloqueia não é o Reiniciar, é a janela vencida.

Onde eu fixei "sempre modelo" foi na rodada 4, porque aquela fila é, por definição, quem não
responde. Mas nem todo item dela está com a janela vencida.

### O que mudou

A rodada 4 agora **diz no Andamento** qual era o estado da janela em cada contato:
`… concluído (janela de 24h vencida)` ou `… — ATENÇÃO: a janela estava aberta, dava para
responder à mão`. Depois de uma rodada ele sabe a proporção real, em vez de supor — e se a
segunda linha aparecer muito, vale trocar o desenho.

O texto do card passou a explicar que a trava não é da extensão.

### Arquivos alterados

`src/panel/panel.js`.

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
