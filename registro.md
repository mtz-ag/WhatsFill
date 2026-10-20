## 2026-10-20 - v3.184.0 - ESTADO DE AGORA - o painel do Facebook: IA consertada, respostas com variacoes, teclado e menos alarme

Cinco coisas foram ao ar hoje, nesta ordem — cada uma depende da anterior.

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

## Para usar

**Recarregue a extensao** (`chrome://extensions` -> recarregar) e abra um post. O cabecalho tem de
dizer **v3.184.0** — e assim que se sabe que chegou.

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
- **O custo por rascunho nao foi medido ao vivo.** Calculado: **572 tokens de sistema + ~37 do
  comentario**, o que da ~**US$ 0,0014 por rascunho** no gpt-5, a frio. O numero real aparece no
  painel depois do uso.
