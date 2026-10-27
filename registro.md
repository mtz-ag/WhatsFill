## 2026-10-27 - v3.201.0 - ESTADO DE AGORA - o adaptador comecou, e a medicao desmentiu duas coisas que eu tinha escrito

### O que esta no ar

| | |
|---|---|
| `mob.js` | os dados do mobiliza.me (fila, conversa, contato, numeros, respostas), **so leitura** |
| `dom-mob.js` + `mob-hook.js` | abrir **a conversa certa** pelo id, e dizer **qual esta aberta** |
| `page-mob.js` | **o adaptador** — faz a plataforma nova parecer com o que o `panel.js` ja le |

**O painel ainda NAO monta no mobiliza.me**, e o manifesto nao o registra la. Montar agora seria
um painel que sobe e trava: o boot espera o Bearer do `page-hook`, que naquela plataforma nao
existe. Ele monta quando a costura fechar.

### O que eu medi hoje na sua base — e o que cada numero mudou

Tudo **so leitura**, pela sua aba, e nenhum dado de eleitor saiu de la: o que eu trouxe foram
nomes de coluna, contagens e valores de enum.

**1. `status` tem tres valores, e a coluna que PARECE dizer "acabou" nao diz.**

```
aberto .......... 586        em_atendimento ..... 3        resolvido ..... 11
das 11 resolvidas, com `resolvido_em` preenchido ...........  1
```

Quem lesse `resolvido_em` veria **dez atendimentos fechados como se estivessem abertos**, e a
rodada voltaria a mexer neles. E a armadilha do `grupo_id` outra vez, com outro nome.

**2. A armadilha do rotulo repetido VOLTOU — e eu tinha escrito que ela tinha sumido.**

Quando vi que etiqueta deixou de ser id numa tabela a parte, escrevi no codigo que *"some com
elas a armadilha do rotulo repetido"*. Medi: **falso**. Sao 87 rotulos distintos em 439 contatos,
e entre eles o mesmo conceito escrito de jeitos diferentes:

```
"⛔ 1 SEM RETORNO"  e  "⛔ 1 Sem Retorno"          "PRODUCAO"  e  "Producao"
"SERRA " (com espaco no fim)                        "🔴PROCURA EMPREGO"  e  "1. PROCURA EMPREGO"
```

Antes eram dois ids com o mesmo rotulo; agora e campo livre, que nao tem lista para conferir.
O conserto e o que o projeto ja usava: **comparar rotulo normalizado**.

**3. `nao_perturbe` existe, e e protecao que a plataforma velha nao tinha.**

Coluna booleana no contato (5 marcados na amostra de 600), com data e motivo do lado. **Quem
esta marcado nao recebe nada** — isso vem antes do quadro, como a etiqueta de sem interesse: e
decisao que alguem ja tomou sobre aquela pessoa.

**4. As colunas sao duas de cada, em ingles e em portugues — e um par ja diverge.**

```
name = nome ... 600/600 iguais     city = cidade ... 600/600     state = estado ... 600/600
phone = telefone ... 600/600       notes (0 cheios) != observacoes (30 cheios)
```

Para LER tanto faz. **Para ESCREVER nao foi medido**, e o par `notes`/`observacoes` ja mostra que
nem todos sao espelho: gravar na errada e *"a API aceita e ignora"* voltando com outro nome. A
sonda no **Thiago Tim** decide.

**5. `estado` ja responde "e de fora do RS?"** — 556 RS, 41 de outros doze estados, 3 vazios. Na
plataforma velha isso custou um arquivo inteiro e uma lista de 4.828 municipios.

**6. Metade das conversas nao tem contato no CRM** (320 de 600). Contato vazio e o caso NORMAL,
nao erro.

**7. O banco faz a juncao numa requisicao so** — conversa e contato juntos. Na plataforma velha
eram tres chamadas por contato aberto, e era isso que derrubava a API.

### Duas coisas minhas que a medicao pegou

**Perdi uma medicao inteira** montando a URL com o que eu achei que fosse o identificador do
banco: a chave da sessao carrega o **endereco** e nao o identificador, entao eu pedi para um
endereco que nao existe. As quatro consultas voltaram **vazias, sem erro nenhum** — parecendo
"a base nao tem essas tabelas". O codigo ja estava certo; quem errou foi a sonda.

**E o seu token nao chega ate mim:** ao listar as chaves, a do banco volta tapada. Entao a
medicao e feita **dentro da pagina** e so a forma atravessa. E o desenho funcionando.

### O que falta, na ordem

1. **Fechar a costura** — 24 metodos de `page.*` e 22 de `api.*`. Boa parte **morre**: campo
   personalizado virou coluna, etiqueta virou texto, e o contrato de escrita aprendido nao tem
   mais o que aprender.
2. **Medir o envio** — `enviar-mensagem-atendimento` e `resolver_conversa` foram **lidas no
   pacote, nunca executadas**. A sonda sai no **Thiago Tim**, uma mensagem, antes de qualquer
   fila. Eu paro e aviso antes.
3. **Montar o painel** no mobiliza.me, quando a costura fechar.

---

## 2026-10-26 - v3.200.0 - ESTADO DE AGORA - a plataforma mudou, e a migracao comecou pelo chao

**A coisa mais importante deste registro:** o **mobiliza.app acabou**. A plataforma nova e o
**mobiliza.me**, e ela nao foi atualizada — foi **reescrita**. Medi a dele por dentro em 26/10 e a
secao 0 conta o que se sabe. **Nada do painel atual funciona la ainda**, e a extensao que esta no
ar continua sendo a do mobiliza.app, intacta.

O que foi ao ar hoje e **o chao da migracao**: o modulo que fala com a plataforma nova
(`src/lib/mob.js`), so de LEITURA, com teste e com a leitura provada ao vivo na base dele. **Ele
ainda nao tem gatilho nenhum** — nenhum botao do painel o chama, de proposito: o que vem depois
depende de uma escolha sua, e ela esta no fim da secao 0.

Abaixo da secao 0, as dezesseis secoes do **painel do Facebook**, que continua sendo a parte viva
da extensao e nao depende do mobiliza em nada.

---

## 0. A plataforma nova: o que foi medido, o que ja esta pronto e a escolha que falta (v3.198.0)

**Pedido dele:** *"atualize para utilizar na nova plataforma,
https://mobiliza.me/admin/interacoes/conversas, entre pela extensao claude se necessario"*.

### O tamanho da coisa, em uma tabela

| | mobiliza.app | mobiliza.me |
|---|---|---|
| frente | Angular + Material | **React + Vite** |
| dados | `api.mobiliza.app` | **Supabase / PostgREST**, direto do navegador |
| login | Bearer interceptado no mundo MAIN | **`localStorage`** (`sb-<ref>-auth-token`) |
| ganchos de tela | `data-cy` em tudo | **nenhum** |
| contato | campos com contrato APRENDIDO | `base_dados`, colunas de verdade |
| etiquetas | ids, rotulo repetido | coluna de texto |
| clientes | um | **varios (multi-tenant)** |
| canal | Z-API | Z-API (nao mudou) |

### A boa noticia, e ela e grande

**A cabeca da extensao sobrevive inteira.** O quadro, a tabela de regras, os detectores, o parser,
as cidades e COREDEs, os anuncios, os perfis, a IA e as suas respostas **decidem O QUE sai para o
eleitor, nao COMO** — mudaram as maos, nao a cabeca. Dois meses de decisoes suas continuam valendo.

**E metade das armadilhas mais caras do projeto some:** o contrato de escrita aprendido, o
*"a API responde 200 e ignora"*, as keys desalinhadas, o rotulo repetido das etiquetas, o
`Origin not allowed` e a interceptacao do token. Na base nova, cidade e uma coluna e etiqueta e
texto.

### O erro que a medicao impediu antes de existir

Escrevi a guarda obvia de "isto e grupo?" como `!!linha.grupo_id`. Medido na sua base:

```
conversas com external_chat_id terminando em @g.us ....... 109
dessas, com grupo_id preenchido ...........................   0
conversas com grupo_id preenchido na base inteira .........   0
```

**A coluna e nula sempre.** As 109 teriam entrado na fila como contato comum, e a rodada publicaria
resposta de atendimento dentro de grupos de dezenas de pessoas. Quem responde e o endereco do chat
(`@g.us`), que e o que a propria plataforma filtra. **Na duvida, e grupo.**

### O que esta no ar hoje

`src/lib/mob.js` — o unico arquivo que sabe como a plataforma nova e montada por dentro:

- le a sessao do `localStorage` e sabe dizer quando ela venceu;
- monta consulta com o **`tenant_id` obrigatorio** (sem ele a consulta e recusada aqui, antes de
  sair — consulta sem tenant le a base de outra campanha);
- traduz a linha do banco para a forma que a rodada, os detectores e a IA **ja leem**;
- le a fila, a conversa, o contato, os numeros e as respostas rapidas da plataforma.

**Provado ao vivo na sua base** (so leitura): a fila voltou 200 com 100 conversas, e as mensagens
de uma conversa vieram com os dois lados separados. **27 suites verdes**, e a guarda do grupo cai
em 8 assercoes se alguem reintroduzir o `grupo_id`.

### O que NAO esta, e por que

**Nada escreve.** Assumir, responder, resolver e gravar cidade passam por
`enviar-mensagem-atendimento` e pelas funcoes `assumir_conversa` / `resolver_conversa`, que foram
**lidas no pacote e nunca executadas** — e a regra deste projeto e sonda no contato de teste antes
da fila. **E o painel ainda nao monta no mobiliza.me**: um painel que abre e falha em silencio e
pior que um painel que nao abre.

### Duas perdas conhecidas, para voce decidir se doem

1. **Audio ENCAMINHADO deixa de ser reconhecido.** O banco novo nao tem o relogio do WhatsApp
   separado do da plataforma nem o tamanho do arquivo — os dois campos de que a conta da Irene
   (07/09) vive. Nao ha contorno sem um campo que o banco nao tem.
2. **A plataforma ja tem IA propria** (`sugerir-resposta-whatsapp`, `transcrever-audio-whatsapp`,
   `gerar-templates-whatsapp-ia`). Vale olhar o que ela faz antes de reconstruir o mesmo caminho —
   pode ser que parte do que pagamos ja venha incluso.

### As duas escolhas que voce fez, e o que elas mudam

**"Ja migrei de vez".** O painel passa a ser so do mobiliza.me. `dom.js`, `api.js`, `contract.js` e
`recorder.js` deixam de ser destino de conserto — **nao apaguei nada**: enquanto a plataforma nova
nao envia uma mensagem sequer, jogar fora o que funcionou seria trocar certeza por aposta.

**"Mostrar ANTES, com a tela junto".** Voce nao escolheu entre as opcoes: deu a condicao —
*"na antiga eu ainda tinha que ver o que estava acontecendo, pois 90% das vezes o fluxo e a IA
respondiam correto, mas faltava os 10% que eu tinha que apagar e responder novamente manualmente"*.

Fui medir, e **a plataforma nova nao apaga mensagem**: nos 33 pacotes dela (~2,9 MB) as funcoes sao
`enviar-mensagem-atendimento`, `transcrever-audio-whatsapp`, `sugerir-resposta-whatsapp`,
`classificar-conversa-whatsapp`, `enviar-reacao-whatsapp`, `gerar-audio-tts` — **nenhuma apaga**.
Apagar continua existindo no seu celular, nao na tela. **Entao o seu laco inverteu:** era *deixa
sair, eu leio, e apago os 10%*; passa a ser **ver antes**. Com esse custo na mesa voce escolheu
parar a rodada, e e assim que ela vai ser construida.

### 0.1 Abrir a conversa CERTA na tela (v3.199.0)

A linha da fila e um `<button>` com **so `class`** — sem id, sem `data-*`. Casar por nome seria
adivinhacao, e aqui adivinhar e voce conferir a mensagem de uma pessoa e apertar a tecla que
responde a outra.

**O React guarda a linha do banco no proprio no**, e e dali que sai a identidade:

```
no -> __reactFiber$<hash> -> ate 8 niveis de .return -> memoizedProps.conversa -> { id, ... }
```

Medido ao vivo na sua fila, com o codigo que foi ao ar:

```
clicaveis na tela ......... 104
reconhecidos como linha ...  78
ids distintos .............  78
achar o alvo pelo id ...... achou, por identidade, mesmo registro, no clicavel
```

Tres coisas que ficam escritas: **so funciona no mundo MAIN** (as chaves do React sao expando, e
expando nao atravessa mundo isolado no Chrome); **"nao esta na tela" e o caso comum e nao e erro**
(78 linhas no DOM para uma fila de centenas — ai a conversa se le dentro do painel); e **o nome e so
reserva, que avisa**, com empate devolvendo nada.

**Abrir clica e para ai** — nao marca lida, nao assume, nao digita. A mesma fronteira do `Ocultar`
no painel do Facebook.

### O que vem agora

A rodada: decidir pelo quadro, **parar para voce** e so entao enviar. O envio tem sonda no
**Thiago Tim** antes de qualquer fila — `enviar-mensagem-atendimento` foi lida no pacote e nunca
executada.

---

## 0.2 Eu comecei errado, voce corrigiu, e a correcao esta no codigo (v3.200.0)

**Voce disse:** *"voce misturou tudo, a aba facebook era pra plataforma do facebook, todo o resto
era mobiliza e era isso pra ser trazido e deixar intocada a aba do facebook"*.

**Esta certo.** Eu tinha comecado um painel NOVO para o mobiliza.me (`mob-main.js`), citando o
painel do Facebook como molde. O molde nao vale: **o painel do Facebook e pequeno porque o trabalho
dele e pequeno** — listar comentario e responder. O trabalho do mobiliza e a operacao inteira, e ela
ja existe, com dois meses de decisoes suas dentro. **O painel novo foi apagado antes de ser
commitado.**

### O desenho certo

```
panel.js  (a rodada, o quadro, a Config, as respostas, a IA)   <- intocado
   |
page.js ->  mobiliza.app (DOM + REST antiga)  |  mobiliza.me (mob.js: Supabase)
```

Um painel so, com um **adaptador por plataforma** — que e exatamente o que o cabecalho do `page.js`
ja descreve desde sempre ("dois modos, mesma interface"). **A aba do Facebook nao e tocada.**

### A costura, medida

| | quantos | o que acontece com eles |
|---|---|---|
| `page.*` | 24 | parte vira consulta, parte **morre** (os cliques do Angular, o gravador) |
| `api.*` | 22 | parte vira Supabase, parte **morre** (`getCustomFields`, `createTag`, `updateTag`) |

**Boa parte simplesmente deixa de existir**, porque na base nova cidade e uma coluna e etiqueta e
texto — o contrato de escrita aprendido nao tem mais o que aprender.

### O que ficou pronto nesta versao

**Qual conversa esta aberta na SUA tela** — a peca de que o `getState` depende, e que eu tinha
deixado devolvendo `null` por nao ter medido. Agora esta medido, e sao **dois sinais**:

```
(1) a LINHA da fila com props.ativa === true          0,19 ms
(2) o PAINEL da direita, pela ASSINATURA das props    0,75 ms
    (conversa + onStatusChange + onClose)

na sua tela, com uma conversa aberta: os dois apontaram para o mesmo id -> "os-dois"
```

Juntos custam **menos de 1 ms**, entao uso os dois. **Discordando, nao afirmo nada** — afirmar a
conversa aberta errada e o painel classificar uma pessoa e responder outra. Duas linhas marcadas
ativas ao mesmo tempo tambem devolvem nada.

O painel da direita e reconhecido pela **assinatura das props**, nunca por classe: as classes sao
Tailwind geradas e mudam com o tema e com cada publicacao da plataforma.

### O que NAO foi ao ar

**O painel ainda nao monta no mobiliza.me**, e o manifesto nao o registra la. Montar agora seria um
painel que sobe e trava: o boot espera o Bearer do `page-hook`, que naquela plataforma nao existe.
Ele monta quando o adaptador fechar a costura — e o envio, quando a sonda sair no **Thiago Tim**.

---

## 1. O botao IA do comentario nunca funcionou (v3.180.0)

**Print dele:** o painel no ar, os comentarios lidos certos, e embaixo **"a IA nao devolveu um
rascunho legivel"**.

**Medido antes de mexer:** `validarComentario` devolvia `null` para a forma que a API entrega.

```
validarComentario(string) -> null
validarComentario(objeto) -> { texto: "Obrigado pelo apoio!", ... }
```

`PROVEDORES[*].texto()` entrega `message.content` (OpenAI) ou o bloco `text` (Anthropic): **o JSON
do modelo como STRING**. Os **sete** validadores vizinhos fazem o `JSON.parse`; este nasceu sem ele.
**Entao o botao falhava em 100% das chamadas, e cada uma saiu paga.**

**Por que o teste de ontem ficou verde:** o simulado do worker devolvia `decisao` como **objeto ja
pronto** — a forma que eu supus, nao a que o worker entrega. Corrigido o simulado e reintroduzido o
defeito, **11 assercoes caem**.

**O que impede a nona vez:** `tests/ia-validadores.test.mjs` varre os oito e trava a propriedade que
nao depende de conhecer os campos — **ler a string da o mesmo resultado que ler o objeto**.

A varredura achou que `validarRascunho` **aceita prosa solta**, e isso e deliberado (texto puro com
`confianca: 0`, nunca sai sozinho). **No comentario a escolha e a oposta e tambem de proposito:** o
canal e publico, e prosa e recusada com o motivo na tela.

---

## 2. Respostas rapidas, sem IA (v3.181.0)

**Pedido dele:** *"preciso de respostas rapidas para o facebook, a ia nao e necessaria para tudo"*.
Escolhas dele: **eu proponho os textos e ele corrige**, e **tudo se gerencia no painel do Facebook**.

### A lista e PROPRIA, e isso e regra e nao preferencia

**Medido contra as 21 respostas prontas do WhatsApp: 3 serviriam.**

| problema | quantas |
|---|---|
| **pedem o cadastro** (`Nome , Cidade`) | 5 |
| tem `{{saudacao}}` / `{{cidade}}` / `{{link_grupo}}` | 16 |
| passam de 260 caracteres | 6 |

Pedir nome e cidade e **proibicao escrita do canal publico** — reusa-las mandaria o formulario para
a pagina onde todo mundo ve. E no Facebook **nao ha contato carregado**: a variavel nao resolve,
sairia `{{saudacao}}` cru para o eleitor.

### Como funciona

- A **tira de botoes** fica junto do campo, no rodape. **Uma so, nunca uma por comentario** — a
  lista tem N comentarios, e seis botoes em cada um enterrariam o que ele veio ler.
- **Clicar enche o CAMPO, nunca insere na pagina.** Mesma fronteira da IA: ele le, depois clica em
  "Abrir e inserir" no comentario que quiser.
- **"Guardar como rapida"** pega o que esta no campo. O rotulo sai do proprio texto, entao guardar
  nao exige digitar nome nenhum.
- **O ⚙ abre o modo de organizar**, e so nele aparecem o ✎ (editar) e o ✕ (apagar). **Duas razoes,
  e a primeira foi medida na conta de altura:** seis pares de `[rotulo][✎][✕]` empilham seis linhas
  no rodape e enterram a lista de comentarios — a poluicao de que ele ja reclamou em 10/09. A
  segunda e que o apagar deixa de ficar a um dedo de quem so queria usar a resposta.
- **✕ apaga — e devolve o texto ao campo.** E o desfazer barato: um clique em guardar traz de
  volta, sem pilha de desfazer.
- **"Reler a pagina" atualiza as duas coisas:** os comentarios e a tira. E por ali que a tira do
  candidato certo chega depois de ele trocar de candidato no mobiliza.

### Os seis botoes de fabrica — **a primeira variacao de cada um**

**As outras 25 estao na secao 4**, e todas sao suas para corrigir.

| botao | primeira variacao |
|---|---|
| Apoio | Muito obrigado pelo apoio! Seguimos juntos. 🙏 |
| **Dia 25 — 2o turno** | Dia 25 é 22! Leva a família e os amigos para votar. 💪 |
| Pro privado | Me chama na mensagem da página que a gente vê isso com calma por lá. |
| Obrigado pela info | Obrigado por trazer, vamos acompanhar. 🙏 |
| Está junto | É isso aí! Obrigado por estar junto nessa. 💪 |
| Seguir a página | Obrigado! Segue a página para não perder nada. 👊 |

Cada um sai de uma regra que ja existe: **pedido pessoal vai para o privado** (nao se nega em
publico), **denuncia se agradece e nao se discute** (23/09), e **quem xinga o adversario esta do
nosso lado — agradece, nunca modera** (regra 17, 25/09).

**Os seis passam pela propria `revisarRascunho`**, com teste: nenhum promete entrega, nenhum afirma
que ja fizemos, nenhum afirma que temos, nenhum pede cadastro, nenhum tem variavel, e nenhum passa
de 140 caracteres.

### Duas coisas para ele saber

- **"Dia 25 — 2o turno" EXPIRA.** Texto com data dentro envelhece sozinho (19/10), e por isso a
  data esta no NOME do botao: passado **25/10** ele tem de sair ou ser reescrito.
- **A tira e POR CANDIDATO**, como tudo o que sai para o eleitor. O candidato novo **nao comeca
  vazio**: as de fabrica servem de ponto de partida, porque **nenhuma cita candidato pelo nome** —
  ha teste exigindo isso.

---

## 3. O teclado do mobiliza, no painel do Facebook (v3.182.0)

**Pedido dele:** *"faca o mesmo esquema de teclado que existe no mobiliza"*. O mapa e **a escolha
dele**, perguntada antes de escrever linha — tecla e musculo, e este projeto ja registrou que
trocar o significado de uma tecla que ele tem no dedo e defeito.

| tecla | faz |
|---|---|
| **1..9** | a enesima resposta rapida: poe no campo **e insere** no comentario da vez |
| **⏎** | inserir no comentario da vez |
| **↑ ↓** | trocar o comentario da vez |
| **I** | pedir o rascunho a IA |
| **R** | reler a pagina |
| **G** | guardar o campo como resposta rapida |
| **Esc** | sair do modo de organizar |

**A tecla EXECUTA, como no mobiliza** (escolha dele: *"escolhe e ja insere"*). **Continua sem
enviar nada** — quem aperta Enter no Facebook e ele.

### As tres guardas sao COPIADAS do `panel.js`, e cada uma custou caro

1. **`composedPath()[0]`, nunca `ev.target`.** Dentro de shadow DOM o `target` e o HOST, entao a
   checagem de campo de texto olharia a div de fora: o "2" digitado no campo do painel inseriria a
   segunda resposta.
2. **Campo de texto sai da frente — e aqui isso e MAIOR que no mobiliza.** A caixa de resposta do
   Facebook e `contenteditable`, e ele digita nela o tempo todo. Sem `isContentEditable`, **cada
   "2" que ele escrevesse disparava uma insercao.**
3. **`isTrusted` no Escape**, porque a extensao dispara `Escape` no document para fechar overlay
   (07/09) — atalho sem isso e atalho que ela aperta sozinha.

### Tres decisoes que o teclado obrigou

- **O comentario da vez e guardado por ID, nunca por indice.** O painel rele a cada 2s e a lista
  encurta quando um comentario e respondido: com indice, o foco pularia para outra pessoa sem
  ninguem mexer. Ele fica **realcado** — inserir escreve na pagina, entao o que esta aceso tem de
  dizer onde a tecla bate. Clicar num comentario tambem o torna o da vez.
- **A tecla so aparece onde e verdade:** `⏎ Abrir e inserir` e `I IA` so no comentario da vez.
  Escrever a tecla nos seis botoes prometeria que o Enter atinge qualquer um deles.
- **UMA insercao por vez, com a trava dentro de `inserir`.** `fb.inserirNaCaixa` **ACRESCENTA** —
  apagar na caixa do Facebook nao funciona (medido em 19/10) —, entao duas chamadas deixam o texto
  **duplicado numa caixa publica**. O botao se protegia desabilitando; **a tecla nao tem como**, e
  apertar "1" duas vezes e o gesto mais natural quando a primeira parece nao ter respondido.

### O custo, e ele e seu para decidir

**Com o painel aberto e o foco fora de campo de texto, as setas deixam de rolar a pagina.** Foi o
preco de ↑↓ trocarem o comentario. Trocar por `j`/`k` ou Alt+setas e **uma linha** — e so dizer.

---

## 4. Cada botao virou uma CATEGORIA com variacoes que revezam (v3.183.0)

**Pedido dele:** *"numero 1 = apoio e dentro dele quero 10 variacoes e a opcao de editar elas que
ao apertar o numero 1 ira seguir na sequencia das variacoes para cada resposta e nao se repetir
ate ter ido as 10"*.

**Nao foi mecanismo novo:** e o rodizio que a mensagem do momento ja usa desde 02/09
(`templates.varianteAtual` / `avancarVariante`), com as duas disciplinas de la.

- **O ponteiro mora em `varianteIndex`** — a mesma chave compartilhada, com id prefixado `fb:`.
  Ela **sai do backup** por ser *"ponteiro de rotacao, nao configuracao"*, e reusa-la mantem isso
  verdadeiro de graca.
- **Ele so anda depois que o texto ENTROU na caixa.** `inserir` passou a devolver booleano so por
  isso: avancar numa falha faria a volta de dez virar uma volta de nove, em silencio.
- **A volta e CIRCULAR** (0,1,…,9,0), e e ela que cumpre o *"nao repetir ate ter ido as 10"* sem
  sortear nada — sorteio repetiria antes de fechar a volta. Medido: dez usos, dez textos
  distintos, e so o decimo primeiro volta ao comeco.
- **Ponteiro maior que a lista e modulado:** ele usa a oitava variacao e depois edita deixando
  tres — sem isso, quebraria.

### Por que variar importa MAIS aqui que no WhatsApp

Os comentarios ficam na **mesma pagina**, um embaixo do outro. Seis *"Muito obrigado pelo apoio!"*
identicos em sequencia e o que denuncia robo — a mesma razao do rodizio da mensagem do momento.

### Quantas variacoes cada botao tem — e por que nao sao dez em todos

| botao | variacoes | por que |
|---|---|---|
| **Apoio** | **10** | e o que mais chega, e onde a repeticao aparece |
| Esta junto | 6 | tambem sai muito |
| Dia 25 — 2o turno | 5 | **expira em 25/10** |
| Obrigado pela info | 4 | |
| Pro privado | 3 | sai pouco; dez formas da mesma frase viram texto ruim |
| Seguir a pagina | 3 | |

**O teto e dez e o editor esta no painel** — completar e seu. **Os 31 textos passam pela propria
`revisarRascunho`**, com teste.

### O editor

O **⚙** abre o modo de organizar; o **✎** abre o editor, que **toma o corpo do painel** — dez
variacoes nao cabem numa tira de 380px, e dialogo num content script e feio e a pagina pode
bloquear.

- **Uma variacao POR LINHA**, o mesmo formato das tabelas da Config. O editor conta enquanto voce
  digita: *"7 variacao(oes) — a volta fecha em 7 uso(s)"*.
- **Esvaziar o editor APAGA a resposta** — e o gesto natural de quem quer tirar um botao, e a tela
  avisa antes.
- **O que voce digita mora no ESTADO, como o campo principal.** O painel redesenha sozinho a cada
  2s, e a guarda de foco so segura enquanto o cursor esta no campo: bastava clicar fora para o
  redesenho restaurar o valor GRAVADO e comer as variacoes recem-digitadas.
- O **✕** apaga a resposta inteira e **pergunta** quando ha mais de uma variacao; a primeira volta
  para o campo, entao "Guardar como rapida" ainda desfaz em parte.

### Onde voce ve em que variacao esta

**No `title` do botao** (passando o mouse) e **na linha de status depois de usar**:
*"Texto posto na caixa de Fulana (Apoio, variacao 3 de 10)"*. **Nao vai escrito no botao** de
proposito: "3/10" em seis botoes e ruido numa tira de 380px, e o numero so interessa no instante
da duvida.

### O que voce ja tinha guardado nao se perde

`sanitizar` **aceita a forma antiga** (`texto` solto) e a converte em primeira variacao. As
respostas que voce guardou de manha continuam la.

---

## 5. O alarme da ordenacao saiu (v3.184.0)

**Decisao dele**, vendo o painel no ar: *"nao tem problema estar nos relevantes pois quero
responder eles e nao todos"*.

O aviso amarelo tomava **um quarto da tela** mandando trocar a ordenacao para "Todos os
comentarios" — ou seja, **mandando fazer o contrario do que ele quer**. E a regra que este arquivo
ja tinha (*alarme que toca sempre e alarme que se aprende a ignorar*) aplicada a uma
**preferencia**: a ordenacao e escolha dele, nao defeito.

| antes | agora |
|---|---|
| amarelo: "o post diz ter 42… troque para Todos os comentarios" | **linha cinza**: "Mostrando os mais relevantes. Role dentro do post e releia para carregar mais." |
| amarelo: nome da pagina nao lido | **continua amarelo** — este ele nao escolheu |

**`ordenacaoEsconde` nao virou funcao morta:** ela passou a decidir **se o total e citado**. Com
"Mais relevantes" ligado, dizer *"o post tem 42"* compara a lista com um conjunto que ele nao quer
percorrer — soa como se faltassem quarenta. **O total so e meta quando a ordenacao nao esconde
ninguem**, e ai a frase volta a ser "O post tem 42. Role… para carregar o resto."

### E o realce ganhou uma barra azul de 4px

Na print **nao dava para distinguir qual comentario estava aceso** — o fundo azul claro com borda
de 1px some numa tela cheia. Para a marca que diz **onde o Enter e as teclas 1..9 escrevem na
pagina**, "nao da para distinguir" ja e defeito.

---

## 6. Os respondidos ficam na lista, em amarelo (v3.185.0)

**Pedido dele:** *"troque a cor dos que receberam resposta na lista para amarelo"*.

Ate entao eles eram **descartados**, entao nao havia o que colorir: o comentario **sumia da lista
dois segundos depois de ele responder**. Bom como fila, desorientador como tela — ele perdia a
referencia de onde estava no post.

**Devolver a marca nao custou leitura nenhuma:** `comentariosSemResposta` ja calculava
`respondidos` para poder filtrar. Hoje:

- **`comentariosDoPost`** devolve todos, cada um com `respondido`;
- **`comentariosSemResposta`** e ele peneirado — **uma fonte de verdade**, senao a tela mostraria
  como pendente quem o painel considera respondido.

### Tres decisoes que o amarelo obrigou

- **O comentario DA VEZ pula os respondidos.** Com eles na lista, cair no primeiro cru poria o
  teclado em cima de quem ja foi atendido — e a tecla 1 **escreve na pagina**. Clicando ou com as
  setas ele ainda alcanca um respondido; o que nao pode e isso por padrao.
- **Sem o nome da pagina, NADA fica amarelo.** Nao da para saber quem respondeu, e marcar por
  chute **esconderia da fila quem nunca foi atendido**. Erra mostrando demais, que e o lado
  barato — e esse caso continua com aviso amarelo proprio.
- **A conta entrou na linha cinza:** *"2 esperando, 3 em amarelo ja respondido"*. Sem o numero ele
  teria de contar os cartoes.

### E um defeito meu que quase foi para a sua tela

Escrevi um comentario CSS citando **`.davez` entre crases**, dentro do template literal do CSS. **O
`checar-modulos` passou** — e o painel **nao teria aparecido**.

**Duas crases nao se cancelam:** a primeira fecha a string, o meio vira acesso a propriedade e a
segunda abre um **tagged template**. E sintaticamente valido, entao nenhum checador de sintaxe
acusa; estoura em **runtime**, no instante em que o painel desenha. Medido:
`TypeError: "...".davez is not a function`.

**Com UMA crase** (o caso de 19/10) da `SyntaxError` e o checador pega. **Com duas, nao pegava.**
Agora pega: toda funcao que devolve um template literal so pode ter as duas crases, a que abre e a
que fecha. **A varredura e estreita de proposito** — a primeira versao olhava todo comentario de
bloco e acusou **1277** ocorrencias, porque os comentarios daqui citam nomes entre crase o tempo
todo.

---

## 7. "Ler tudo": o amarelo nao funcionava pela MESMA razao de ele rolar a mao (v3.186.0)

**Print dele:** *"nao alterou a cor e preciso que faca uma leitura do post pegando todos os
comentarios, estou tendo que fazer isso manualmente; a leitura ira servir pra ver quais foram
respondidos tambem"*.

### A causa estava na propria print

```
Rita Jesus
Essa matematica na fecha · Dito isso bora de 22
1h · Curtir · Responder · Enviar mensagem · Ocultar
    Capitao Martim respondeu · 1 resposta        44 min
```

**A nossa resposta esta COLAPSADA.** O Facebook so cria o `[role="article"]` dela depois que
alguem clica em "1 resposta" — entao o painel nao via resposta nossa nenhuma e `respondido` era
falso para todo mundo. **Era a mesma razao de ele estar rolando a mao:** o que nao foi expandido
nao existe na arvore. **Os dois pedidos tinham uma solucao so.**

### O botao "L Ler tudo"

Expande as respostas, rola o post e **acumula** o que achar, em voltas. Clicar de novo para.

- **A PROVA E O EFEITO, nunca o rotulo do botao.** Cada volta clica no que parece revelar, rola, e
  conta **quem entrou na lista acumulada** (na v3.186 ela contava os articles DA TELA, e a secao 8
  mostra por que isso nao mede nada sob virtualizacao). Acertar o texto exato de cada botao do
  Facebook e adivinhacao que envelhece na primeira traducao; contar o que surgiu, nao.
- **Para com DUAS voltas secas**, porque uma so erraria no instante em que o Facebook esta
  carregando o lote seguinte.
- **Nada ali envia, responde nem curte.** Os unicos cliques sao em botoes que REVELAM, por lista
  de permissao com **teto de caracteres e uma linha so** (nasceu em 40 e virou 80 na secao 8) —
  sem o teto, um comentario que por acaso seja um `role="button"` entraria na lista e o painel
  clicaria no que o eleitor escreveu.

### A lista passou a ACUMULAR, e isso nao era opcional

O DOM e virtualizado: rolando para carregar os de baixo, **os de cima saem da arvore**. Com a
lista sendo a foto de agora, "ler o post inteiro" nao produziria lista nenhuma — ela so trocaria
de conteudo. **Era exatamente por isso que ele estava anotando a mao.**

**O preco e o `no` obsoleto**, tratado nos dois lugares que o usam: **"Abrir e inserir" e "Ver na
pagina" reacham o article pelo id** antes de desistir. O `comment_id` e estavel; o elemento nao.
Sem isso, "Ver na pagina" rolaria para um elemento solto **em silencio**.

### E o amarelo funciona ANTES de ler tudo

`respostaNossaColapsada` le o resumo *"<pagina> respondeu"*. **A guarda e a POSICAO:** so conta
depois do primeiro marcador de tempo/botao — no meio do texto, *"o Capitao Martim respondeu meu
pedido"* e o eleitor falando de nos.

**Tecla nova: L.** E o rodape ficou com `L Ler tudo · R Reler · G Guardar`, encurtados porque tres
botoes nao cabiam numa linha de 380px.

---

## 8. A leitura terminava em "0 ja respondido" com tres resumos a vista (v3.187.0)

**Print dele**, logo depois da secao 7:

```
Leitura terminada: 19 comentario(s), 0 ja respondido(s) — o post declara 51.
```

E na pagina, abaixo de tres comentarios diferentes, ainda colapsado:
**"Capitao Martim respondeu · 1 resposta"**.

### Medido primeiro, porque as causas dao a MESMA print

```
"Capitao Martim respondeu · 1 resposta" -> botoesDeExpandir NAO pega
respostaNossaColapsada (linha no innerText)  -> true   (logo: na pagina dele a linha esta FORA)
mesmoNome('Capitao Martim ', 'Capitao Martim') -> true (descartado como causa)
```

**Eram tres defeitos independentes.** Consertar um so teria devolvido a mesma print.

### (1) A lista de permissao exigia que o texto FOSSE "1 resposta"

O botao real diz *"<pagina> respondeu · 1 resposta"* — resumo e contagem no **mesmo clicavel** —, e
com 15 caracteres de nome ele ja passa do teto de 40. Hoje o padrao **TERMINA** em "N resposta(s)",
o teto subiu para **80** e entrou **"uma linha so"**: o teto existe para o painel nunca clicar no
que o eleitor escreveu, e uma linha faz esse trabalho melhor que um numero de caracteres.

Entrou junto `ver … coment` largo, porque *"Ver 30 comentarios anteriores"* nao casava com nenhuma
das tres formas que eu havia escrito a mao.

### (2) O resumo nao esta DENTRO do article

O caminho pelo `innerText` funciona num layout de teste e deu **0 de 19** na pagina dele. Hoje ha o
**caminho 2**: sobe no maximo **quatro ancestrais** procurando um `[role="button"]` cujo texto seja
*"<pagina> respondeu…"* — mais preciso que varrer o texto do ancestral, que traz o comentario
inteiro junto.

**A guarda e parar no ancestral que ja mistura DOIS comentarios.** Dali para cima o "respondeu"
encontrado pode ser do vizinho, e **pintar de amarelo quem nunca foi atendido o esconde da fila**.
O teste prova os tres estados:

```
resumo como IRMAO do article                      : true
sem resumo nenhum                                 : false
resumo so no pai, onde ha 2 comentarios (nao pode): false
```

### (3) A rolagem saltava para o fim, e a "volta seca" contava a tela

`scrollTop = scrollHeight` pula o miolo: sob virtualizacao o meio do post **nunca entra na arvore**,
e a lista acumulada ficaria com o comeco e o fim. Hoje o passo e **80% da altura visivel** (garante
sobreposicao entre as fotos) e a funcao **devolve se andou**.

E a volta "seca" comparava `articles(raiz).length` antes e depois — numero que **nao cresce** sob
virtualizacao, porque os de cima saem quando os de baixo entram. Hoje ela so e seca com **nenhum
botao aberto, nenhuma rolagem e nenhum nome novo no ACUMULADO**.

> **A regra que fica:** leitura que percorre DOM virtualizado mede o progresso no que ela GUARDOU,
> nunca no que esta na tela.

### O que continua em aberto

Os padroes de `REVELAM` vieram da **print**, nao de medir o DOM dele. Se "Ler tudo" ainda parar
antes do fim, o que resolve e o **texto exato** do botao que sobrou — quantos ele trouxe e o que o
botao diz.

---

## 9. O modo de responder: barra embaixo, setas, Enter, e o proximo sozinho (v3.188.0)

**Pedido dele:** *"criei um botao de comecar a responder onde vai esconder a extensao e ter as
opcoes de resposta, subir e descer comentarios nas setas e enter para mandar a mensagem; crie o
botao de parar tambem e ao apertar enter vai pro proximo comentario sozinho"*.

**"Comecar a responder"** fica no rodape do painel, em azul. Ao clicar: o painel **solta o
empurrao** (a pagina volta ao tamanho inteiro) e sobra uma **barra fina embaixo** com a quem ele
esta respondendo, as respostas rapidas, a IA, o "Ver na pagina", o **Parar** e a linha de status.

### O Enter e o do FACEBOOK, e essa e a decisao que sustenta o resto

Com o foco dentro da caixa de resposta o Enter dele e **nativo** — e assim que ele envia hoje, sem
extensao nenhuma. **O painel nao intercepta.** Interceptar trocaria um envio que funciona por um
despacho sintetico que **nunca foi medido**, e o preco de errar e ele achar que respondeu sem ter
respondido.

Depois de apertar `1`, o foco **ja esta na caixa** (`inserirNaCaixa` o poe la). Entao o gesto e:

```
1   -> a resposta entra na caixa, com a mencao
⏎   -> o Facebook envia
        o painel ve a resposta aparecer -> proximo comentario, na vista
```

`fb.enviarDaCaixa` existe so para o outro caso: ele clicou num botao da barra e o foco saiu da
caixa. Ela **devolve "despachei", nunca "enviou"**, e leva os quatro campos juntos (`key`, `code`,
`keyCode`, `which`) porque editor olha campos diferentes e faltar um e a forma silenciosa de nao
enviar nada.

### O avanco so acontece COM PROVA

Quem prova o envio e **a resposta aparecer no post** — o mesmo sinal que o amarelo da lista ja usa.
Nunca a tecla. Com isso os **tres** jeitos de enviar andam pelo mesmo mecanismo (o Enter dele, o
nosso despacho e o botao do proprio Facebook), e **nao existe avanco sem prova**: pular sem
resposta esconderia da fila quem nunca foi atendido.

A vigia pergunta de **700ms em 700ms** (o laco normal do painel e de 2s, e esperar 2s depois de
cada envio faz o "sozinho" parecer travado) e so avanca na **transicao** para respondido — armar em
cima de quem ja esta respondido faria o painel sair de cima dele no primeiro tique, sem nada ter
sido enviado.

**O proximo e o proximo que ESPERA**, olhando para a frente e depois voltando ao comeco (quem
comeca no meio do post nao deixa ninguem para tras), e **no fim ele FICA no lugar** em vez de dar a
volta. As **setas circulam** — ali ele esta navegando a mao.

### As duas guardas do teclado brigavam com o modo

A guarda de campo de texto e medida e continua valendo: a caixa do Facebook e `contenteditable`, e
sem ela cada "2" que ele digitasse inseriria a segunda resposta. **Mas no modo o foco VIVE na
caixa**, e manter a guarda inteira mataria justamente as setas que ele pediu.

- **Passam so as setas e o Escape.** Os **digitos continuam barrados**: "22" e o numero do
  candidato, e ele digita isso na resposta.
- **`soltarOFoco()`** e o que mantem o teclado vivo: sem soltar a caixa depois de cada avanco, ele
  nao conseguiria apertar 1..9 de novo; e trocar de comentario com a caixa do ANTERIOR em foco faria
  um Enter mandar a resposta **para a pessoa errada**, com a barra dizendo um nome e o Facebook
  enviando para outro.
- **`isTrusted` passou a valer para TODA tecla** (era so o Escape): o despacho do Enter borbulha ate
  o document, onde o escutador esta em captura — sem a guarda ele atenderia o proprio despacho.

### A barra nao tem campo de texto, e a IA escreve na caixa

A caixa do Facebook esta na tela e mostra exatamente o que vai sair, com a mencao: **ela e o
campo**. Um segundo campo criaria a pergunta "qual dos dois vai?".

Por isso a **IA no modo escreve direto na caixa** — manter o rascunho num campo invisivel seria
texto pago que ninguem ve. **A leitura antes de publicar nao se perde; muda de lugar**, e o Enter
continua sendo o segundo ato deliberado. Os avisos da revisao sao repetidos depois da insercao,
porque `inserir` escreve a propria linha de status e apagaria *"ATENCAO: promessa de entrega"* justo
no texto que vai para a pagina.

**Escape tambem para o modo**, e o Parar volta o painel. A tira da barra nao tem o engrenagem: o ✕
a um dedo de quem responde em sequencia e o gesto destrutivo escondido no inofensivo.

### O que fica em aberto, e e medicao que so o uso dele da

- **Que a resposta apareca no post logo depois do envio e o que o avanco pressupoe** — e isso nao
  foi medido ao vivo. Se ele enviar e o painel nao andar, o ↓ anda a mao e **a medicao e me dizer
  se o comentario ficou amarelo** depois de alguns segundos.
- **Sem o nome da pagina nada fica respondido**, entao o modo nao avanca nunca. A barra escreve a
  consequencia e a saida, em vez de parecer travada.
- **Trocar a resposta escolhida continua sem conserto:** apagar na caixa do Facebook nao funciona
  (medido em 19/10), entao o texto errado se arruma na pagina, a mao.

---

## 10. Quem escreve DUAS vezes sumia da fila (v3.189.0)

**Print dele**, com a barra no ar sobre o segundo comentario da mesma eleitora: *"a marta ja foi
respondida, ela tem duas mensagens, mostre quando for o caso"*.

Na pagina estavam, em ordem:

```
Marta Fictinha — "Estou em oracao..."        Capitao Martim respondeu · 1 resposta   <- atendida
James Machado  — "..."
Marta Fictinha — "Estou com o Flavio 22"     (nada embaixo)                          <- esperando
```

### A causa, e ela e maior que a print

**O painel escolheu certo** (ele estava no comentario que ainda esperava). O que faltava era ele
saber que ja havia respondido a mesma pessoa noutro lugar.

**Mas medindo, apareceu o defeito de verdade:** o `aria-label` da resposta so diz o **nome** do pai
— *"Resposta de X ao comentario de Marta"* —, e era por nome que `comentariosDoPost` marcava. Entao
responder UM comentario dela marcava **os dois**, e o que nunca foi respondido ficava amarelo e
**saia da fila em silencio**.

**Por que a print ainda mostrava a lista certa:** com as respostas COLAPSADAS quem decide e
`respostaNossaColapsada`, que le o resumo na POSICAO de cada comentario e acerta. O defeito nasce
depois do **"Ler tudo"**, que expande as respostas e traz os rotulos — ou seja, estava a um clique
de distancia.

### O id do pai estava a um parametro de distancia

O permalink da resposta leva os **dois** ids:

```
/post?comment_id=<O PAI>&reply_comment_id=<A RESPOSTA>
```

`idDoComentario` ja lia os dois campos desde 19/10; faltava usar o primeiro. Hoje
`paiDoComentario` devolve o id do pai e o casamento e por **id**.

**A reserva por nome fica**, e nao e indecisao: a forma do permalink foi lida do CODIGO, nao medida
na pagina dele. Sem reserva, um formato diferente deixaria **tudo** como pendente e ele responderia
a base inteira duas vezes. Por id quando o id veio; por nome so nas respostas que nao trouxeram id.
**Errar mostrando demais e barato; esconder quem nunca foi respondido nao e.**

### E a barra passou a dizer quando a pessoa escreveu mais de uma vez

Em ambar, ao lado do nome:

```
Marta Fictinha   2º de 2 desta pessoa · 1 ja respondido   Estou com o Flavio 22
```

Numa barra que mostra **uma pessoa por vez**, sem isso ele repete a mesma frase para a mesma pessoa
— e repeticao e o maior sinal de maquina respondendo (12/09). O da vez nao entra na propria conta,
e quem escreveu uma vez so **nao ganha marca**: alarme que toca sempre se aprende a ignorar.

**A prova de regressao e o defeito reintroduzido:** voltando a casar por nome, a assercao *"o OUTRO
continua esperando"* cai sozinha. Medido.

---

## 11. Os digitos 2, 3 e 4 viraram acoes (v3.190.0)

**Pedido dele:** *"troque a funcao do botao dois para curtir a mensagem, botao 3 para ocultar a
mensagem, botao 4 responder a mao"*.

A tira ficou assim, no painel e na barra:

```
1 Apoio   [2 Curtir] [3 Ocultar] [4 Responder a mao]   5 Dia 25   6 Pro privado   7 ...
```

As respostas rapidas ficam com o **1** e seguem do **5** em diante — nenhuma se perdeu.

### Um mapa so, senao o botao promete uma coisa e a tecla faz outra

`ACOES_DA_TIRA` + `doDigito` sao a fonte unica: o rotulo do botao e o que a tecla executa saem do
MESMO lugar. Duas listas divergiriam na primeira correcao, e aqui a divergencia seria o botao
dizendo *"3 Ocultar"* e a tecla 3 mandando uma resposta pronta na pagina dele.

### Clicar e agir na pagina dele, entao o casamento e justo

`botaoDoComentario` procura por **texto exato** e **dentro do article**. A fileira medida em 19/10
e `Curtir | Responder | Enviar mensagem | Ocultar`:

- **"contem"** faria "Ocultar" casar com *"Ocultar todos os comentarios desta pessoa"*;
- **buscar no `document`** pegaria a fileira do comentario VIZINHO — curtir ou ocultar a pessoa
  errada.

### Curtir nunca DESCURTE

O botao do Facebook e o mesmo nos dois sentidos. `jaCurtido` tem **tres** estados — `true`, `false`
e **`null` para "nao da para saber"** —, e e a licao do `donoDoCanal` (25/09): colapsar "nao sei"
em "nao curtido" faria o painel desfazer o que ele fez.

- Ja curtido: **nao clica**, e a linha diz *"JA estava curtido — nao mexi"*.
- Na duvida: **clica**, porque a assimetria que importa e nao desfazer.
- Depois do clique **relê o botao**: so diz *"Curtido"* com a pagina confirmando; sem confirmacao,
  *"cliquei — confira na pagina"*. **O estado "curtido" do comentario nunca foi medido na pagina
  dele**, e a tela nao afirma o que nao leu.

### Ocultar clica e para ai

Abrindo dialogo ou menu, **quem confirma e ele**: clicar em botao de dialogo que ninguem mediu e
onde o estrago de verdade acontece — aqui, moderar a pagina dele por conta propria.

### Curtido e ocultado NAO viram amarelo — e so o ocultado sai da fila

Amarelo significa *"ja tem resposta nossa"*, e curtir nao e responder. Eles ganham marca propria,
em cinza (`· curtido`, `· ocultado`).

**Correcao dele, no mesmo dia:** *"ao curtir nao precisa pular a mensagem, somente ao responder"*.
Entao:

- **Curtir FICA no comentario.** E um complemento, e a resposta pode vir logo depois para a mesma
  pessoa — o realce nao se move e ele continua na fila.
- **Ocultar PULA.** Nao ha o que responder num comentario oculto: deixar o cursor nele seria beco
  sem saida.

Sao **duas perguntas, e por isso dois campos**: `marca` (o que ele fez — a tela) e `foraDaFila` (se
ainda espera — a fila). `proximoPendente` so le o segundo; quem decide o porque e o painel.

**So memoria, nunca armazenamento:** gravar faria o painel esconder gente numa sessao futura por
causa de um clique que ninguem lembra. No F5 eles voltam, e quem decide e a pagina.

### Medido

- 26 suites verdes, com teste novo para os tres botoes (17 assercoes, metade sobre o que **nao**
  pode ser clicado).
- O smoke do painel num DOM falso prova que **o clique cai no comentario DA VEZ e nao no vizinho**,
  que a tira numera `1, 2, 3, 4, 5...` na ordem certa, que a linha de status conta o que fez e que
  **depois de curtir o realce NAO se move**.

**O que fica em aberto:** o rotulo do botao de curtir ja curtido (*"Descurtir"*?) e o que acontece
ao clicar em **Ocultar** (dialogo? menu?) **nao foram vistos na pagina dele** — as duas coisas
aparecem no primeiro uso, e a tela diz "confira na pagina" em vez de afirmar.

---

## 12. O amarelo na volta do comentario selecionado, NA PAGINA (v3.192.0)

**Pedido dele:** *"faca uma marcacao amarela na volta do comentario selecionado"*.

No modo de responder o painel esta guardado e ele le a **pagina**. A barra diz o NOME de quem esta
na vez — e nada mostrava ONDE. E o mesmo contrato do realce da lista (**o que esta aceso diz onde a
tecla bate**), so que aqui a tecla escreve num comentario publico.

### `outline`, nunca `border`

Borda muda o tamanho do elemento e **empurra o layout do Facebook**; outline desenha por cima, sem
ocupar espaco. E o **offset e negativo** (`-1px`): com offset positivo o traco some quando o
container do comentario corta o que transborda.

### O defeito desta funcao e o RASTRO

Sem limpar o anterior, andar pela fila com as setas deixa **meia pagina amarela** — e o realce para
de dizer onde a tecla bate, que e a unica coisa que ele existe para dizer. Por isso
`realcarComentario(no, antigo)` recebe os dois e `estado.realcado` e quem lembra.

**E o valor que estava la volta.** O comentario e elemento da pagina DELE: limpar para vazio
apagaria um inline-style do Facebook se um dia existir.

### Reposto a cada tique, e nao so no desenho

O DOM e virtualizado: rolando, o Facebook **troca** o article do comentario, e o amarelo iria
embora com o no antigo — justo enquanto ele rola para ler o que vai responder. O realce e reposto
na vigia (700ms) e no laco de 2s, reachando o article **pelo id**.

**Painel escondido tira o realce:** amarelo na pagina sem nada na tela explicando o que significa e
sujeira no Facebook dele.

### Medido

- 11 assercoes novas, e metade e sobre o rastro e sobre devolver o que estava la.
- O smoke do painel prova, num DOM falso, que **o da vez fica amarelo e o ja respondido nao**, que
  **a seta leva o amarelo junto sem deixar rastro**, e que **esconder o painel limpa a pagina**.

---

## 13. O Enter nao pulava para o proximo (v3.193.0)

**Relato dele:** *"ao mandar o enter nao esta pulando para o proximo comentario"*.

### A causa: a prova do envio era UMA so, e ela depende de um rotulo

O avanco acontece quando a **resposta aparece no post** — o mesmo sinal do amarelo. Ler isso exige
o `aria-label` da resposta, e `lerRotulo` **so aceita rotulo com o marcador de tempo**:

```
RE_RESPOSTA = ^resposta de (.+?) ao comentario de (.+?)\s+h[aá]\s
```

A resposta **recem-criada pode nao ter o "ha ..." ainda** — item fresco no Facebook aparece como
*"Agora"*. Sem rotulo lido, a resposta existe na tela e **o painel nao a ve**: nada fica
respondido, e o avanco nunca acontece. Um minuto depois ela viraria *"ha 1 minuto"* e passaria a
ser lida — tarde demais para quem esta percorrendo a fila.

**Nao afrouxei o `lerRotulo`.** Qual e o rotulo de uma resposta recem-enviada **nao foi medido**, e
relaxar a guarda por hipotese marcaria como respondido quem nunca foi — o erro caro deste painel.
**O conserto nao depende de rotulo nenhum.**

### A segunda prova e o TEXTO, com duas condicoes

O painel guarda o trecho que `inserirNaCaixa` **confirmou** ter entrado (os mesmos 20 caracteres
que ela usa para conferir, e so quando a insercao devolveu `true`). Dai:

```
saiu da caixa   E   continua na pagina   ->  foi enviado, segue para o proximo
saiu da caixa   e   sumiu da pagina      ->  ele so FECHOU a caixa: nao anda
continua na caixa                        ->  nada aconteceu ainda
```

**As duas metades importam.** So a primeira acusaria envio quando ele fecha a caixa sem mandar — e
**avancar sem envio esconde da fila quem nunca foi atendido**. A caixa *sumir* tambem conta: quem
decide e o texto estar na pagina.

### A linha de status diz por qual prova andou

```
Resposta a Marta apareceu no post.                      <- prova forte
O texto saiu da caixa de Marta — segui sem ver a        <- prova fraca
resposta no post. (rotulo que nao entendi: "...")
```

**O rotulo citado e a medicao que falta.** Vendo essa segunda linha, e so me dizer o que esta entre
aspas: e ele que diz por que a prova forte falhou, e com ele a prova forte volta a funcionar sem
hipotese nenhuma.

### A print dele confirmou a causa, e nao por deducao

Depois da v3.193 ele mandou a tela com a resposta **ja enviada** e o painel parado:

```
Capitao Martim
Leandro Reus Seguimos juntos, Flavio 22!
Postando...                                 <- no lugar do carimbo de tempo

[Responder a Leandro Reus]                  <- uma caixa NOVA, vazia
```

**"Postando..." e exatamente o que faltava:** `lerRotulo` exige o `ha ...`, e enquanto o Facebook
nao confirma a resposta esta na tela e o painel nao a ve. **A prova forte so volta quando o carimbo
chega** — a fraca e quem cobre essa janela.

**E a caixa nao some: o Facebook abre uma nova, vazia, com o mesmo rotulo.** A prova fraca funciona
nos dois desenhos porque pergunta se o TEXTO saiu da caixa, nao se a caixa existe.

### A versao foi para a BARRA

```
6 de 23 · 17 esperando · v3.194.0
```

No modo o painel esta guardado, e e no modo que ele relata defeito. **Sem a versao na tela, "o fix
nao funcionou" e "o fix nao chegou" produzem a MESMA print** — e este projeto ja perdeu uma tarde
consertando codigo que nunca tinha rodado.

### Medido

- O smoke do painel, num DOM falso, prova as tres situacoes: **inserir sozinho nao pula**, **caixa
  limpa sem o texto na pagina nao pula** (ele so fechou a caixa) e **caixa limpa com o texto
  publicado PULA**, com a linha dizendo por qual prova.
- 26 suites verdes, `checar-modulos` e `checar-referencias` limpos.

---

## 14. Marcacao: o painel estava no caminho dela (v3.195.0)

**Pedido dele:** *"preciso que ao comentar tambem consiga fazer marcacao"*.

### A causa: as setas do modo sao as teclas do menu de marcacao

**Marcacao no Facebook nao e texto: e uma ESCOLHA.** Digitar `@` abre um menu, e a marcacao so
existe depois de escolher um nome ali — com **↑ ↓ e Enter**.

E no modo de responder, desde 21/10, a guarda de campo de texto tem **uma excecao justamente para
as setas** (foi o que permitiu andar na fila com o foco dentro da caixa). Entao:

```
ele digita "@Mar"   -> o menu do Facebook abre
ele aperta ↓        -> o PAINEL troca de comentario
                       soltarOFoco() fecha o menu
                       o nome meio digitado vai junto
```

**A marcacao nunca podia ser concluida**, e nada na tela dizia por que. Medido no codigo
(`facebook-main.js`, a excecao `passamNoCampo`), nao na pagina.

### O conserto: a seta volta a ser do Facebook no instante exato

Sem `preventDefault` — e isso que a deixa chegar ao menu — e **com a linha de status dizendo para
onde ela foi**, senao uma seta que nao faz nada e um defeito novo aos olhos dele.

Quem responde "o menu esta aberto?" tem **duas portas**:

| porta | le | medido? |
|---|---|---|
| `menuDeMarcacaoAberto` | ARIA da caixa (`aria-activedescendant`, `aria-expanded`, `aria-controls`) | **nao** — o menu nunca foi aberto com o CDP ligado |
| `mencaoInacabada` | so o TEXTO da caixa: termina em `@...` sem espaco | sim, no proprio texto |

A segunda existe porque a primeira e hipotese. E ela **so e consultada quando o painel comecou a
marcacao** (a tecla M): a caixa de resposta **ja nasce com a mencao dentro**, e vindo sem espaco no
fim essa leitura travaria as setas no instante em que a caixa abre — a navegacao inteira do modo.

**O espaco no fim e o que diz que a marcacao acabou.** Escolhido o nome, quem continua escrevendo
digita um espaco antes da frase.

### A tecla M escreve "@Nome" e PARA AI

```
M  ->  abre a caixa, escreve "@Marta Fictinha", letra por letra
       e nao clica em nada
```

**Quem escolhe no menu e ele.** Clicar numa opcao que ninguem conferiu **marcaria um estranho num
comentario publico**, com o nome dele em cima — a mesma fronteira do "Ocultar", que clica e para.

Tres decisoes que vao junto:

- **Letra por letra**, porque o menu reage a cada `input` e **se ele abre com uma insercao unica de
  quinze caracteres nao foi medido**. Teclar e o caminho provado; a funcao o imita.
- **Duas palavras, sem emoji** (`nomeParaMarcar`): o nome que o Facebook mostra carrega emoji
  (`"Marta Fictinha 🇧🇷"`), e digitado inteiro devolveria lista vazia — a marcacao falharia sem
  ninguem entender por que.
- **NAO solta o foco**, ao contrario de todo o resto do modo: o menu morre com o blur. O preco esta
  na status — enquanto a marcacao esta aberta os digitos 1..9 estao barrados, e voltam quando ele
  escolhe o nome e digita um espaco.

**O Esc ganhou camada:** com a marcacao aberta ele fecha o MENU; sem ela, para o modo.

### O que a medicao pegou e eu nao previ

A primeira versao de `mencaoInacabada` exigia **uma palavra so** (`@[^\s@]+$`) — e **nao
reconhecia `"@Marta Fictinha"`**, que e exatamente o que a tecla M escreve. O smoke acusou a seta
sendo roubada no meio da marcacao. Hoje o teto e **tres palavras**, com o custo escrito: uma
palavra depois do nome e a seta continua indo para a pagina.

### Medido

- `tests/dom-facebook.test.mjs`: 39 assercoes novas nos quatro pontos (o nome, os tres sinais de
  ARIA, o texto, e o `comecarMencao` que **nao clica em opcao nenhuma**).
- O smoke do painel, num DOM falso: o **M acrescenta** `@Nome` na caixa, a seta com a marcacao
  aberta **nao e impedida e nao troca de comentario**, e depois do espaco ela volta a andar na fila.
- 26 suites verdes, `checar-modulos` e `checar-referencias` limpos.

---

## 15. A barra do modo cobria o post; hoje ela empurra (v3.196.0)

**Print dele:** o painel no ar, a barra ocupando a faixa de baixo do post — *"bote pro lado, em
baixo esta atrapalhando a visualizacao"*.

### A causa era um argumento meu, e ele estava escrito no CSS

```
/* O MODO DE RESPONDER: barra fina embaixo, e a tela inteira e do post.
   Ela NAO empurra a pagina (o dock e soltado) de proposito -- esconder a
   extensao foi metade do pedido dele. */
```

**O que flutua cobre.** A barra nao tirava largura do post, entao ficava POR CIMA — e justamente
sobre o fim da lista de comentarios, que e onde esta quem ainda nao foi respondido. Na print, o
comentario da Sueli esta metade atras dela.

### O conserto ja estava medido, de 19/10

O painel **empurra** a pagina (`dock.js`), e o **modal do post se recentra na area encolhida**.
Entao coluna na lateral **nao cobre nada**:

```
antes:  [ ---------- post ---------- ]      barra flutuando por cima do rodape
agora:  [ ------ post ------ ][ coluna ]    o modal se recentra sozinho
```

A coluna reusa **a largura e o `applyDock` do painel**. Largura propria ou empurrao proprio
divergiriam do painel na primeira semana — a mesma razao pela qual o painel do Facebook reusa o
`dock.js` em vez de ter o seu.

**"Esconder a extensao" continua valendo onde ele pediu:** o painel de LISTA sai da tela; o que
fica e a tira de teclas, agora ao lado.

**O texto do comentario ganhou tres linhas** na coluna: numa faixa de 380px uma linha so mostraria
duas palavras.

### Medido

- O smoke confere o **EMPURRAO**, nao o CSS: no modo, o `<html>` continua com a classe do dock.
  **Reintroduzindo a condicao antiga, a assercao cai** — conferido nos dois sentidos.
- `checar-modulos` acusou uma crase que eu pus num comentario DENTRO do `css()` (a terceira vez
  neste arquivo). Corrigida antes de qualquer teste rodar.
- 26 suites verdes, `checar-modulos` e `checar-referencias` limpos.

---

## 16. So emoji: a pessoa sumia da fila (v3.197.0)

**Print dele:** tres comentarios no post, dois deles so com emoji (as palmas, a bandeira, o 22) —
e o painel so enxergava o do meio, o unico com texto escrito.

### Medido antes de mexer, nos dois formatos em que o emoji chega

```
emoji como TEXTO no innerText -> limparTextoDoComentario devolve os emoji inteiros
emoji como <img>              -> innerText nao traz linha de corpo -> texto ""
```

Era o segundo. E `comentariosDoPost` tinha, no filtro, um **`c.texto &&`** escrito no dia em que o
painel nasceu (19/10) e **nunca medido**: sem corpo legivel, a pessoa era **descartada em
silencio** — e a tecla so alcanca quem esta na lista.

### Duas metades, e a regressao mostra qual cobre o que

| metade | o que resolve |
|---|---|
| ler o `alt` das imagens (`emojiDasImagens`) | o **corpo** da linha: a lista mostra os emoji |
| tirar o `c.texto &&` | a **fila**: quem nao tem corpo legivel nenhum volta a ser atendido |

Reintroduzindo **so o filtro**, cai o teste do *so figura*; reintroduzindo **as duas**, caem
tambem os do emoji — conferido nos dois sentidos. **O filtro e a metade que nao depende de como o
emoji chega na pagina dele.**

### A peneira do `alt` e lista de permissao, por FORMA

Alt com **letra** nao entra: *"Foto de perfil de Maria"* e *"Pode ser uma imagem de duas pessoas"*
sao legenda da plataforma, nao fala da pessoa — e entrariam no prompt da IA como se fossem. Exige
tambem um caractere fora do ASCII, senao um icone com `alt="-"` passaria por emoji.

**Comentario so com FIGURA ou GIF continua com `texto` vazio, de proposito.** Quem escreve
*"(sem texto — emoji, figura ou GIF)"* e a **tela**, em cinza e italico. Rotulo nosso dentro do
dado iria para o prompt da IA e para a caixa de resposta como fala dela.

### E a IA nao e chamada sem texto

A chamada **nem sai**, com o motivo na barra: pagar para o modelo inventar o que um aplauso quis
dizer e a familia do `naoHaOQueResponder` (24/09). Um emoji pede uma resposta rapida (1, 5..9) ou
o **Curtir** (2).

### Medido

- `tests/dom-facebook.test.mjs`: os dois formatos de emoji, a peneira do `alt` item a item, e a
  lista trazendo o so-emoji **e** o so-figura.
- O smoke do painel ganhou um comentario so com emoji: ele **aparece na lista** e a linha mostra os
  emoji. Com o codigo antigo, as duas assercoes caem.
- 26 suites verdes, `checar-modulos` e `checar-referencias` limpos.

---

## Para usar

**Recarregue a extensao** (`chrome://extensions` -> recarregar) e abra um post. O cabecalho tem de
dizer **v3.197.0** — e assim que se sabe que chegou. **No modo de responder a versao fica na
coluna**, ao lado da contagem.

## O que falta, e e decisao dele

- **Comentario de uma palavra** (**"22"**, boa parte desta pagina): agora ha o botao rapido, que era
  o que faltava. `facebook.pedeRascunho` continua existindo e sabendo quando nao vale pagar;
  **ligar isso para a IA nem ser oferecida nesses casos e escolha dele.**
- ~~Trocar a ordenacao para "Todos os comentarios"~~ — **decidido em 20/10: nao.** Ele trabalha
  nos relevantes de proposito, e o alarme saiu (secao 5).
- **805 KB em toda aba do Facebook.** Da para cortar para ~38 KB movendo a IA para `import()` sob
  demanda. Agora que ha caminho sem IA, o corte vale ainda mais — mas so depois de ele confirmar
  que o botao IA funciona de verdade.
- **A aba Facebook da Graph API (v3.172) continua no ar** e sai quando ele confirmar que este
  caminho substitui.
- **"Ler tudo" trouxe 19 de 51 na ultima medicao DELE**, com a v3.186. Os tres consertos da secao
  8 miram exatamente isso, e **a conferencia e ele rodar de novo**: quantos vem agora, e, parando
  antes do fim, qual o texto do botao que sobrou.
- **O texto rapido "Dia 25 — 2o turno" EXPIRA em 25/10.** Passada a data ele sai do painel ou e
  reescrito — texto com data dentro envelhece sozinho.
- **Os tres sinais de ARIA do menu de marcacao nao foram medidos na pagina dele.** Se o `M
  Marcar` escrever o `@Nome` e a seta **continuar** trocando de comentario, a porta que faltou e
  a do ARIA — e a reserva (`estado.marcando` + o texto) e que esta decidindo. **Nao abrindo o menu
  nenhuma vez**, o que resolve e medir com o CDP: abrir a caixa, digitar `@` a mao e ler os
  atributos da caixa.
- **O custo por rascunho nao foi medido ao vivo.** Calculado: **572 tokens de sistema + ~37 do
  comentario**, o que da ~**US$ 0,0014 por rascunho** no gpt-5, a frio. O numero real aparece no
  painel depois do uso.
