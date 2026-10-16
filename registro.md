## 2026-10-16 - v3.172.0 - ESTADO DE AGORA - aba do Facebook: comentarios das postagens

**Pedido dele:** *"preciso que responda os comentarios nas postagens do facebook, crie uma nova aba
para isso"*. Perguntado por onde a extensao chega la, escolheu a **Graph API com token de pagina**;
perguntado o que a aba faz, escolheu **listar e ele responder, com o rascunho da IA**.

**Esta versao entrega a aba, a leitura e a resposta.** O rascunho da IA fica para a proxima: ele
precisa de prompt proprio (comentario e PUBLICO — nao se pede cadastro, nao se chama pela cidade, e
o texto e curto), e **modo novo de pedido precisa de ramo em `atender` no mesmo commit** — a licao
da tecla 0, de 31/08.

### Onde o token mora, e por que nao e no painel

**A regra da chave da IA vale aqui e vai um passo alem.** O painel roda dentro da pagina do
mobiliza: token ali e token publicado. Mas o token de PAGINA nasce dentro da resposta de
`/me/accounts` — entao **quem le aquela resposta tem de ser o service worker**. Ele guarda os
tokens e devolve ao painel so **id, nome e se a pagina aceita moderar**. Devolver a lista crua seria
publicar o token pelo caminho mais discreto que existe: dentro de um JSON que ninguem olha.

Os dois (`fbToken`, `fbPageTokens`) saem do `exportJson`. **E a credencial mais perigosa desta
extensao**, porque o estrago dela e publico e com o nome dele em cima.

### As rotas foram LIDAS, nao executadas

E a situacao de `listContacts` e `createTag` em 20/08, com a mesma disciplina: **a primeira chamada
e uma SONDA** (`/me/accounts`), e falhando ela nenhuma outra e tentada. Toda leitura confere o
formato em vez de confiar nele, e **o `POST` da resposta so conta como enviada quando devolve o
`id`** — 200 sem id e a armadilha mais antiga deste projeto, agora numa API nova.

### Quatro decisoes que a leitura do formato obrigou

- **`filter=toplevel`**: sem ele a NOSSA resposta volta na lista como um comentario a responder, e a
  aba pede para ele responder a si mesmo, todo dia.
- **`respondido` sai de `from.id === pageId`**, e **sem o id da pagina nada e marcado** — erra para
  MOSTRAR demais, que e o lado barato: o oposto esconderia quem esta esperando.
- **`tasks` ausente NAO e "nao pode responder"** (a licao do `undefined !== 'CONNECTED'`, 01/10). E
  a pagina que o token so le e avisada ANTES de ele escrever o texto, nao na hora de enviar.
- **O `from` pode vir VAZIO sem ser defeito**: desde 2018 o Facebook nao entrega a identidade de
  quem comenta de um perfil pessoal sem autorizacao do app. A tela escreve *"sem nome"*.

**A versao vai EXPLICITA na URL** (`v23.0`): caminho sem versao cai na mais ANTIGA disponivel, que e
a primeira a ser desligada — a aba pararia num dia qualquer sem ninguem ter mexido em nada.

### O que a aba faz

Token → **Carregar as paginas** (a sonda) → escolher a pagina → **Carregar as postagens** (com a
contagem de comentarios de cada uma) → clicar numa → **os comentarios sem resposta**, cada um com
uma caixa de texto e o botao Responder.

**Nada sai sozinho**, e aqui isso e mais forte que no WhatsApp: comentario e PUBLICO, o erro fica a
vista de todo mundo e apagar deixa rastro. **A rede nasce do CLIQUE**, nunca do desenho (armadilha
de 31/08), e falha vira botao de tentar de novo.

- 22 suites (a nova tem **70 asercoes**) e os dois verificadores verdes.

### O que ele precisa fazer uma vez

1. Um app no Facebook para Desenvolvedores, com as permissoes **pages_show_list**,
   **pages_read_engagement** e **pages_manage_engagement**.
2. Gerar um token de USUARIO com essas permissoes e colar no campo da aba.
3. Clicar em **Carregar as paginas** — e e so.

**Sobre o prazo do token:** o de usuario curto vence em ~1h; trocando-o por um de longa duracao
(60 dias), os tokens de pagina derivados dele **nao expiram**. Se a aba comecar a dizer que o token
expirou, e esse o caminho.

### Junto, o que ele pediu na mesma frase

**Dados e Cidades viraram sub-abas da Config** (v3.171). A barra agora e **Respostas · Automatizado
· Disparo · Facebook · Config**, e dentro da Config: **Ajustes · Dados · Cidades**.
