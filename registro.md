## 2026-10-19 - v3.178.0 - ESTADO DE AGORA - o painel ENCAIXA, empurrando a pagina

**Pedido dele:** *"preciso que empurre pro lado pra que caiba a extensao da mesma forma do
mobiliza"*.

Feito, e **quem empurra e o proprio `dock.js`** — o mesmo do mobiliza, sem copia. A primeira versao
flutuava por cima com o argumento de que empurrar o Facebook quebraria a tela dele; **medido, o
argumento nao se sustentou.**

### O que a medicao mostrou, com 380px encaixados

| | antes | depois |
|---|---|---|
| `body` e cabecalho | 1351 | **971** |
| `[role="main"]` | 991 | **611** |
| barra de rolagem horizontal | — | **nenhuma** |
| elementos `fixed` vazando | — | **nenhum** |

O cabecalho do Facebook e `position: static`, entao ele acompanha sozinho.

**E o que mais importava: o modal do post se recentra na area encolhida** — ficou em 136..836, com
o painel comecando em 971. **O post aberto nao fica escondido atras do painel.** A camada que
escurece o fundo continua cobrindo a tela inteira, e isso e so cosmetico: o painel e opaco e fica
por cima dela.

### Detalhes do encaixe

O painel agora e a faixa inteira da direita (altura cheia, colado na borda, sem cantos
arredondados), como no mobiliza. **Escondido, ele solta o empurrao** e a pagina volta ao tamanho
dela — vira so a pestana na borda. O `applyDock`/`removeDock` fica num lugar so, dentro do
`desenhar`, porque sao tres caminhos que mudam o estado e tres chamadas separadas divergiriam.

### O que ele precisa fazer

**Recarregar a extensao** (`chrome://extensions`) e reabrir o post.

### O que falta

- **O rascunho da IA.** Hoje o texto e dele. Falta o prompt proprio de comentario (o de hoje e todo
  de conversa de WhatsApp), o ramo em `atender` do worker — **modo novo de pedido precisa de ramo
  la, no mesmo commit** — e o botao. `facebook.pedeRascunho` ja decide quando vale gastar:
  comentario de uma palavra (**"22"**, que e metade desta base) nao vai a IA, e para esses o certo
  e uma resposta pronta — decisao dele.
- **A aba Facebook da Graph API (v3.172) continua no ar** e sai quando este caminho estiver pronto.
- **Rolar sozinho dentro do post** nao foi feito: quem rola e ele e o painel acompanha a cada 2s.
  A lista nunca e afirmada como completa — a contagem do post aparece do lado, e o aviso de
  "Mais relevantes" manda trocar para "Todos os comentarios".
