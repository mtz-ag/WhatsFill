## 2026-10-16 - v3.171.0 - ESTADO DE AGORA - Dados e Cidades viraram sub-abas da Config

**Pedido dele:** *"a aba de dados e cidades podem ficar dentro das configuracoes pois sao pouca
utilizadas"* — primeira metade do pedido da aba de comentarios do Facebook, que vem a seguir.

A barra passou de **seis** para **quatro** abas (Respostas · Automatizado · Disparo · Config), e a
Config ganhou uma linha de sub-abas: **Ajustes · Dados · Cidades**. Sub-aba e nao cartao empilhado
porque a Config ja e a aba mais longa do painel, e a queixa de 08/09 foi justamente poluicao.

### Tres coisas que liam `state.tab` e teriam quebrado calado

- **`resumir`**, que decide se o texto pode ser encurtado. O comentario dele diz, desde 10/09, que
  em **Dados** o texto e CONTEUDO — o campo do contato — e nao pode ser resumido. Lendo
  `state.tab === 'config'`, o campo do eleitor passaria a ser cortado no meio.
- **A memoria de rolagem**, que e por aba: as tres sub-abas dividiriam a mesma posicao.
- **O redesenho da Cidades quando a lista de etiquetas chega** (`if (state.tab === 'cidades')`), que
  nunca mais seria verdadeiro — a tela ficaria em *"Carregando..."* para sempre.

As tres passaram a ler `abaAtual()`, **uma funcao so**.

**O carregamento da Cidades continua nascendo do CLIQUE** na sub-aba, nunca do desenho: e a
armadilha de 31/08 (rede dentro de um `render*` vira uma requisicao por redesenho, e a guarda "so se
ainda nao carregou" so segura depois do SUCESSO).

- 21 suites e os dois verificadores verdes. Nada de comportamento mudou: as duas telas sao as mesmas.

### A aba do Facebook: falta UMA decisao dele

Pedido dele: *"preciso que responda os comentarios nas postagens do facebook, crie uma nova aba para
isso"*. **Nao comecei, e o motivo e que os dois caminhos possiveis sao trabalhos diferentes:**

**(a) Graph API** (`graph.facebook.com`) — le os comentarios e responde sem depender de aba aberta,
e encaixa na arquitetura que ja existe: o token vai para o service worker, como a chave da IA (nunca
na pagina, fora do `exportJson`), mais `host_permissions`. **Precisa de um token de PAGINA**, que sai
de um app do Facebook com `pages_read_engagement` + `pages_manage_engagement`.

**(b) Ler a tela do facebook.com** — sem token, mas exige content script no facebook.com, seletores
que quebram a cada mudanca de layout e ele trabalhando noutra aba. E o oposto do que `dom.js` faz
hoje, com uma plataforma que muda muito mais.

**A pergunta: ele tem (ou pode criar) uma pagina do Facebook com token?** Sendo sim, e o caminho (a).
