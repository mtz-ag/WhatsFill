## 2026-10-19 - v3.179.0 - ESTADO DE AGORA - a IA responde o comentario do Facebook

**Pedido dele:** *"inseriu corretamente, agora falta a ia identificar conteudo e responder de
acordo"*.

Cada comentario da lista ganhou o botao **IA**: ele pede o rascunho, poe **no campo de texto**, e
ele le antes de clicar em "Abrir e inserir". **A IA nunca escreve direto na caixa do Facebook** --
pular o campo transformaria um texto nao lido em algo a um Enter de ser publicado, e aqui e
publico.

### Canal NOVO, e nao o rascunho do WhatsApp com outro nome

O prompt e proprio (`ia.regrasDoComentario`, ~550 tokens contra os ~10 mil do WhatsApp), e **o
padrao de atendimento dele NAO entra**: sao 37 secoes escritas para conversa de um para um, e boa
parte delas diz o oposto do que vale num comentario. Cada diferenca do canal virou regra:

- **E PUBLICO.** O erro do WhatsApp chega a uma pessoa; o daqui vira print e fica na pagina.
- **NUNCA pedir nome e cidade.** O formulario e a marca do WhatsApp; aqui e pedir dado de eleitor
  onde todo mundo ve. Esta escrito como PROIBICAO e repetido COLADO no pedido, porque o resto do
  projeto manda o contrario em varios lugares e **a regra perto do pedido vence** (licao do item
  22, 07/09).
- **PEDIDO PESSOAL vai para o privado.** Quem pede dinheiro, emprego ou remedio num comentario nao
  pode ser negado na frente de todo mundo. A negativa existe e e no WhatsApp.
- **Quem xinga o adversario esta do nosso lado:** agradece ou nao responde, **nunca modera** -- a
  regra 17 do WhatsApp (25/09) vale igual aqui.
- **UMA ou DUAS frases**, porque comentario longo nao e lido e parece robo.

### As travas sao as MESMAS, de proposito

`rascunharComentario` chama a **propria `revisarRascunho`**: promessa, afirmar que ja fizemos,
afirmar que temos e dizer que a eleicao acabou sao os mesmos riscos. Duplicar faria as duas listas
divergirem na primeira correcao. O que e do WhatsApp (saudacao repetida, apresentacao, formulario)
**simplesmente nao e passado no contexto**, entao nao dispara.

**A chapa e conferida sempre**, mesmo sem o dossie no prompt: o modelo escreve os nomes de cabeca,
que foi a licao de 08/09 (ele disse que o Van Hattem era deputado federal porque hoje ele e).

### `naoResponder`: a IA pode se abster

Irmao do `naoHaOQueResponder` do WhatsApp (24/09). Comentario que so marca um amigo, so emoji ou
spam nao recebe resposta inventada -- e quem decide se concorda e ele, que continua podendo
escrever a sua.

### Dois consertos durante o trabalho

- **Faltava `src/data/*` nos recursos do Facebook**, entao o dossie nao seria lido ali.
- **`redesenhar()` destruia o elemento de status** e a mensagem iria para um no orfao: a tela
  ficaria muda **justo depois da chamada paga**. Hoje o status mora no estado e e procurado no
  shadow a cada escrita.

### O que ele precisa fazer

**Recarregar a extensao** e abrir um post. A IA precisa estar **ligada** no painel do mobiliza
(aba Automatizado) -- desligada, o botao diz isso em vez de falhar calado.

### A cadeia foi PROVADA por teste, sem gastar uma chamada

`tests/facebook-ia.test.mjs` (a suite **24**) troca o worker por um que devolve o
que o teste mandar e exercita `rascunharComentario` ponta a ponta. E o que
nenhum teste puro ve: o que acontece ENTRE as pecas.

**O que ele trava:**

- **o pedido sai com `modo: 'comentario'`** — sem isso ele cairia no esquema da
  DECISAO, a chamada sairia PAGA e voltaria num formato que o validador nao le,
  virando *"a IA nao respondeu"* em silencio;
- o prompt do canal vai junto e **o padrao do WhatsApp fica fora**;
- `naoResponder` chega ao painel **e o texto e descartado** — nao se publica o
  que ela mandou ignorar;
- falha do worker **leva o motivo inteiro** (o teto de gasto chega legivel a
  tela, que e a licao de 07/09), e o *"o que a IA leu"* volta **tambem na
  falha**;
- **as travas do WhatsApp valem aqui**: afirmar que ja fizemos, prometer
  entregar e dizer que a eleicao acabou sao barrados, e o travessao eme e
  trocado. Se alguem trocar `revisarRascunho` por uma copia, estas assercoes
  caem — que e o ponto delas;
- **a chapa e conferida sem o dossie no prompt**, porque o modelo escreve os
  nomes de cabeca (08/09).

**Uma falha apareceu e era do TESTE:** o aviso e escrito *"legivel"* com acento e
eu procurei sem. A mesma familia do limite de palavra antes de letra acentuada.

### Dois riscos conferidos antes de ele testar

- **A arvore de imports do painel do Facebook sao 13 modulos, todos em
  `src/lib/*`** (exposto no manifesto) e **nenhum depende do mobiliza** — sem
  `api.js`, `page.js` nem `dom.js`. E **nenhum faz trabalho no carregamento**:
  todos sao inertes ate alguem chamar.
- **`src/data/*` esta nos recursos do Facebook**, entao `gabinete.lerArquivo` le
  o dossie ali.

### O peso: 805 KB em TODA aba do Facebook

Medido. `ia.js` (259 KB) e `cortesia.js` (229 KB) entram pela carona, e
`atendimento.js` **nao e usado** no comentario — o padrao dele fica de fora do
prompt de proposito.

**Da para cortar para ~38 KB** movendo a IA para `import()` sob demanda, dentro
do clique do botao. **Nao foi feito de proposito:** e exatamente o caminho que
ele vai testar, e se o import dinamico falhar ali ele conclui que *"a IA nao
funciona"*. Fica para depois do teste dele.

### O que falta, e e decisao dele

- **Comentario de uma palavra** (**"22"**, que e boa parte desta pagina): hoje o botao chama a IA
  de qualquer jeito, porque quem pediu foi ele, naquele comentario. `facebook.pedeRascunho` existe
  e diz quando nao vale gastar; **ligar isso a uma resposta pronta em vez da IA e escolha dele.**
- **Nao ha rodada automatica**, de proposito: um comentario por vez, pelo botao.
- **A aba Facebook da Graph API (v3.172) continua no ar** e sai quando este caminho estiver pronto.
- **O custo por rascunho nao foi medido ao vivo** -- o prompt e ~10x menor que o do WhatsApp, entao
  deve ficar bem abaixo dos US$ 0,0029 de la, mas o numero real so aparece no painel depois do uso.
