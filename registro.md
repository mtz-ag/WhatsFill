## 2026-10-19 - v3.177.0 - ESTADO DE AGORA - o painel le DENTRO do post, e nao a pagina atras dele

**Relato dele:** *"ele inseriu na pagina na timeline, eu queria dentro do post, ao entrar nos
comentarios da postagem"*, com a print do post aberto num **modal** e o painel listando gente que
nao estava ali.

**Ele estava certo, e o defeito explicava as duas metades da print de uma vez.**

### A causa, medida

Clicando na contagem de comentarios, o Facebook abre o post num **modal** — e **a linha do tempo
continua viva atras dele**. O painel lia o `document` inteiro.

- **9 comentarios no documento, 7 dentro do modal.** Os dois extras eram de outros posts da
  timeline — e eram **exatamente as duas** que apareciam na lista dele sem estarem naquele post.
- **4 caixas de resposta no documento, 2 fora do post.** Por isso o texto dele foi parar numa caixa
  de tras: `caixaDeResposta` sem raiz pegava a primeira que achasse.

### O conserto: `raizDoPost()`

Sao **DOIS `[role="dialog"]` aninhados** (medidos 1351x633 e 700x569), os dois com os mesmos
comentarios dentro. A raiz e o **mais interno**, que e o mais especifico. Sem modal vale o
documento, mas **so quando a URL e de um post**; na linha do tempo a raiz e `null` de proposito —
ali nao ha post aberto, e e justamente onde ler tudo misturaria.

**Toda leitura do painel passa pela raiz agora**, e a insercao **rele a raiz na hora do clique** e
exige que o comentario ainda esteja dentro dela: entre listar e clicar ele pode ter fechado o post.

### Medido depois do conserto, na pagina de verdade

| | lendo o documento | lendo o post |
|---|---|---|
| comentarios na lista | **8** | **6** |
| quem sumiu | — | as duas comentaristas de outros posts da timeline |

E a outra metade: a caixa de resposta encontrada ficou **dentro da raiz**, com a mencao dentro,
enquanto **2 das 4 caixas do documento ficam fora do post**.

### O segundo defeito da mesma print: o `1` no texto

Na lista dele, um comentario aparecia com o texto certo e um **`1` solto embaixo**. E a **contagem
de reacoes**, que o `innerText` poe **depois** da fileira de botoes, junto com "Ver traducao" e
"Editado".

A primeira versao peneirava linha a linha, entao o numero escapava. Hoje
`limparTextoDoComentario` **PARA no primeiro marcador**: o texto sempre mora ENTRE o nome e o
tempo, e o que vem dali para baixo nao e do comentario.

**O corte continua sendo da LINHA INTEIRA**, e isso importa nesta base: medido na pagina, um
comentario que e so **"22"** com **"22 min"** embaixo sai certo, e *"1 h de fila no posto"* nao e
tempo.

### O que ele precisa fazer

**Recarregar a extensao** (`chrome://extensions`) e reabrir o post. A permissao do `facebook.com`
ja foi aceita na v3.176 — nao pede de novo.

### O que falta

- **O rascunho da IA.** Hoje o texto e dele. Falta o prompt proprio de comentario (o de hoje e todo
  de conversa de WhatsApp), o ramo em `atender` do worker — **modo novo de pedido precisa de ramo
  la, no mesmo commit** — e o botao. `facebook.pedeRascunho` ja decide quando vale gastar:
  comentario de uma palavra (**"22"**, que e metade desta base) nao vai a IA.
- **A aba Facebook da Graph API (v3.172) continua no ar** e sai quando este caminho estiver pronto.
- **Rolar sozinho dentro do post** nao foi feito: quem rola e ele e o painel acompanha a cada 2s.
  A lista nunca e afirmada como completa — a contagem do post aparece do lado, e o aviso de
  "Mais relevantes" manda trocar para "Todos os comentarios".
