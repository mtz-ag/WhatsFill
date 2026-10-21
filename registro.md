## 2026-10-21 - v3.187.0 - ESTADO DE AGORA - o painel do Facebook le o post inteiro, e o amarelo passou a funcionar

Oito coisas foram ao ar, nesta ordem — cada uma depende da anterior. As sete primeiras em
20/10; a oitava (secao 8) e o conserto do que a secao 7 nao alcancou.

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

## Para usar

**Recarregue a extensao** (`chrome://extensions` -> recarregar) e abra um post. O cabecalho tem de
dizer **v3.187.0** — e assim que se sabe que chegou.

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
- **O custo por rascunho nao foi medido ao vivo.** Calculado: **572 tokens de sistema + ~37 do
  comentario**, o que da ~**US$ 0,0014 por rascunho** no gpt-5, a frio. O numero real aparece no
  painel depois do uso.
