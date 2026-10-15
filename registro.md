## 2026-10-15 - v3.159.0 - desligar o anuncio fazia o texto dele virar fala dela

**Print dele:** ela chegou com *"Ola! Eu apoio o Flavio, Zucco e Capitao Martim"* as 19:09 e no dia
seguinte, as 11:37, recebeu o **formulario** (*"IMPORTANTE! Para eu poder salvar seu numero me diga
seu Nome , Cidade"* + o post do Instagram + o link do grupo), que ele apagou. *"essa pra ser a
mensagem de um anuncio antigo, ja e pra estar desativado e desativei na extensao tambem a resposta,
no caso era pra mandar mensagem do dia"*.

### O que a medicao diz, e ela contraria a hipotese natural

**O anuncio desligado FUNCIONOU.** Medido no contexto dela: `anuncioReconhecido` falso, nenhum
modelo, nenhuma acao de anuncio. O que decidiu foi o FLUXO, e os dois motores concordam —
`nunca-pediram-dados` -> **tecla 4**, o pedido de cadastro de quem chega sem nome e sem cidade.

**E o texto que saiu nao e do anuncio: e o `pedir-dados` DELE.** O de fabrica nao tem Instagram nem
grupo — esse bloco *"Ja aproveitando..."* foi ele que escreveu. Entao **desligar o anuncio nunca
poderia ter parado aquela mensagem**: ela sai por outra porta, com outro texto.

### O defeito que a medicao achou de verdade

`ehOTextoDoAnuncio` chamava `reconhecer`, que **filtra os ligados**. Medido com o anuncio do apoio:
ligado, `ehOTextoDoAnuncio` = true e os detectores se calam; **desligado, false** — e
`soExpressaApoio` passava a dizer *"escreveu apoio em mensagem propria"* em cima de uma frase que a
CAMPANHA escreveu.

**Sao duas perguntas diferentes, e so uma depende do desligado:**

- *"O que mandar?"* — a acao, o modelo, o sinal `anuncioReconhecido`: **respeita** a campanha
  encerrada, e e isso que faz desligar significar alguma coisa.
- *"De quem e esta frase?"* — **nao depende**: o texto pre-preenchido continua tendo sido escrito
  pela campanha, e **fica na conversa para sempre** (a armadilha mais antiga dos anuncios).

Sem isso, no dia em que ele desliga um anuncio **toda a frase dele vira fala dela**, e
`soExpressaApoio`, `falouAlgoProprio` e `pedeMaterialEscrito` passam a disparar em cima de palavras
que ela nunca escreveu. **Nesta print nao mordeu por acidente**: o texto abre com *"Ola! Eu..."* e a
heuristica `pareceTextoProntoDeAnuncio` o marcou assim mesmo. Anuncio cujo texto nao tenha essa
forma — o CONVERSE CONOSCO, por exemplo — morderia.

Hoje `reconhecer` tem a porta `incluirDesligados`, e **so `ehOTextoDoAnuncio` a usa**.

### Uma assercao INVERTIDA, e ela gravava o defeito

`tests/anuncios.test.mjs` dizia *"anuncio desligado nao reconhece"* com o comentario *"a mesma regra
do `reconhecer`"* — escrito por mim. **As duas regras nunca foram a mesma**, e o comentario e que
tornava o defeito invisivel. Invertida, com o motivo e a data dentro dela.

### O que fica para ele, e e decisao dele

A mensagem que ele apagou saiu da **tecla 4**, com o texto `pedir-dados` da aba Respostas. Duas
saidas, as duas na mao dele:

- **tirar o bloco antigo do texto** (*"Ja aproveitando... post novo no Instagram... entre no nosso
  grupo"*) — ele sai em TODO pedido de cadastro, venha de anuncio ou nao;
- **ou mover a caixa no quadro**, se ele quiser que quem chega por anuncio desligado receba a
  mensagem do dia em vez do cadastro. Isso e posicao, e posicao e dele — eu nao reordeno o quadro.

### Medido

- 21 suites e os dois verificadores verdes. Sete assercoes novas, metade sobre a outra metade da
  regra: o anuncio desligado continua **nao** decidindo o que mandar, e texto que nao e de anuncio
  nenhum continua sendo fala dela.
