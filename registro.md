## 2026-10-19 - v3.176.0 - ESTADO DE AGORA - o painel de comentarios na aba do Facebook

**Print dele:** o painel em janela separada dizendo *"aba sem resposta — de F5 nela"* e
*"Nao consegui falar com a aba do mobiliza.app"*, com a aba Facebook pedindo o token.

**O aviso nao era defeito novo:** e a armadilha ja registrada — **recarregar a extensao orfa as
abas abertas**, e o `rpc.js` tenta falar com um content script que nao existe mais. F5 na aba do
mobiliza resolve, e o painel ja dizia isso certo.

**O que a print mostrou de verdade** foi a aba da Graph API pedindo token. Essa e a que sai. Pelo
DOM **nao ha token nenhum**: ele abre o post e a extensao le a pagina.

### O que entrou agora

- **`manifest.json`** — content script e recursos em `www.facebook.com` e `web.facebook.com`. **E
  isto que exige a permissao nova do Chrome.**
- **`src/facebook-content.js`** — o carregador, gemeo do `content.js` (content script classico nao
  aceita `import`).
- **`src/facebook-main.js`** — o painel de comentarios, flutuante, na aba do Facebook.
- **`src/lib/dom-facebook.js`** ganhou `limparTextoDoComentario`, `lerComentario` e
  `comentariosSemResposta`; o teste foi a **45 assercoes**.

### Como funciona, e e o fluxo que ele pediu em 16/10

Ele abre o post. O painel lista **quem ainda nao foi respondido por nos**, ele escreve o texto
embaixo e clica em **"Abrir e inserir"**: a extensao clica no "Responder" daquele comentario, espera
a caixa nascer e **ACRESCENTA** o texto depois da mencao.

**E para ai.** Nada aperta Enter nem clica em "Comentar" — **quem envia e ele**, que e a fronteira
do projeto inteiro.

### Por que e um painel OUTRO, e nao o de sempre

O painel de sempre vive na aba do mobiliza e depende da API de la: o Bearer capturado, a ponte RPC,
o contrato de escrita. **Nada disso existe no Facebook.** E ele **flutua em vez de encaixar**: o
`dock.js` empurra a pagina com padding no `html`, o que no mobiliza e seguro porque o layout e
conhecido, e no Facebook e pedir para quebrar a tela dele.

**Shadow DOM resolve duas coisas de uma vez:** o CSS do Facebook nao entra, e `document
.querySelectorAll` nao atravessa shadow — entao **o painel nunca se le como se fosse um
comentario**. Medido com ele montado: continuou 5.

### O defeito que eu ia entregar, e o conserto

O painel monta em `document_idle`, que e **antes de os comentarios existirem**: a lista nasceria
vazia e pareceria defeito. E como o DOM e virtualizado, ela muda enquanto ele **rola**, sem clique
nenhum. Hoje o painel **rele sozinho a cada 2s**, com duas guardas que sao sobre nao atrapalhar:
so redesenha quando a lista de ids **mudou**, e **nunca com o campo de texto em foco** — senao a
resposta que ele esta digitando perde o cursor no meio da frase.

### Medido na pagina de verdade, nao so no teste

Rodei as funcoes contra o reel aberto: **5 comentarios achados, todos com id**, o nome da pagina
lido do composer (*"Capitao Martim"*), e o texto limpo saiu inteiro nos cinco — inclusive
**"22 com certeza"**, que COMECA com o que parece tempo, e um comentario de **duas linhas**. O
layout: 322x483, dentro da tela, com o corpo rolando.

**O corte e da LINHA INTEIRA e nunca do trecho** — *"1 h de fila no posto"* e *"Curtir muito o
trabalho"* comecam com o que parece tempo e botao, e cortar por prefixo comeria a fala do eleitor.

### A lista NUNCA e afirmada como completa

O DOM e virtualizado e **"Mais relevantes" esconde gente** (medido: a contagem dizia 5 e a arvore
tinha 4). Entao a tela mostra **a contagem do post** ao lado do que achou, avisa quando a ordenacao
esta filtrando e manda trocar para "Todos os comentarios", e tem o botao de reler.

### O que ELE precisa fazer, e e a unica coisa

1. **Recarregar a extensao** em `chrome://extensions`.
2. **Aceitar a permissao do `facebook.com`** que o Chrome vai pedir — ela e nova.
3. **F5 na aba do mobiliza**, pelo motivo do topo desta entrada.

Depois: abrir um post da pagina e o painel aparece na direita.

### O que falta

- **O rascunho da IA.** Hoje o texto e dele. Falta o prompt proprio de comentario (o de hoje e todo
  de conversa de WhatsApp), o ramo em `atender` do worker — **modo novo de pedido precisa de ramo
  la, no mesmo commit** — e o botao. `facebook.pedeRascunho` ja existe e decide quando vale gastar:
  comentario de uma palavra (*"22"*, *"amem"*) nao vai a IA.
- **A aba Facebook da Graph API (v3.172) continua no ar** e sai quando este caminho estiver pronto.
  Enquanto as duas existirem, a de cima e a que ele escolheu.
- **Rolar sozinho ate o fim dos comentarios** nao foi feito de proposito: quem rola e ele, e o
  painel acompanha. Rolar a pagina por conta propria mexeria na tela enquanto ele le.
