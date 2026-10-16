## 2026-10-16 - v3.170.0 - ESTADO DE AGORA - so repasse conclui, e nao gasta token

**Relato dele**, com o Andamento aberto: *"o fluxo era pra finalizar essas pessoas que mandam links
em sequencia, estou gastando tokens"*.

### Duas coisas aconteciam, e as duas estao medidas

**1. A conferencia de encerramento era paga em TODA passada**, e a resposta era sempre a mesma — o
proprio log dele mostra: *"IA — encerramento · nao · US$ 0.0006 · Ela continuou vendo
links/compartilhamentos — nao e despedida nem agradecimento final"*. A porta de 15/10 tem tres
guardas mecanicas e nenhuma delas e sobre repasse.

**Agora sao quatro, e a nova e a mais barata:** link e video de outra pessoa **nao carregam
despedida nenhuma**, entao nao ha julgamento a pedir. Mensagem que tem link **e** texto dela
continua passando — `ehRepasse` so vale quando, tirando o link, nao sobra nada escrito.

**2. E o desfecho era MANDAR.** `ultima-e-so-reacao` dava tecla **5** (mensagem do momento) sempre
que nao tinhamos respondido no dia. O argumento dela e *"a mensagem do momento responde ao gesto"* —
e vale para o GESTO: um emoji de maos e dirigido a nos. **Repasse nao e gesto**, e o proprio
`ehRepasse` ja diz por que: link e video de outra pessoa *"nao dizem nada sobre este contato"*. Quem
repassa nao esta conversando, e a rajada se renova sozinha — entao a mensagem do momento saia **todo
dia**.

A guarda foi para o DESFECHO e nao para a condicao (licao da Noeli, 06/09): a caixa continua
casando, e agora conclui.

### Medido, nos dois motores

| o que chegou | antes | agora | pergunta a IA? |
|---|---|---|---|
| 3 links em sequencia | **tecla 5** (envia) | **tecla 3** (conclui) | **nao** |
| 1 link sozinho | **tecla 5** | **tecla 3** | **nao** |
| emoji de maos | tecla 5 | tecla 5 | sim |
| link **com texto dela** | tecla 5 | tecla 5 | sim |
| link e depois "obrigada" | tecla 5 | tecla 5 | sim |

**Emoji e figura continuam recebendo a mensagem do momento** — o caso da Marta (31/08), que
respondeu o anuncio com um emoji, nao mudou.

**O sinal ja existia** (`rajadaEhSoRepasse`, o caso do Odone: 76 mensagens em semanas, todas link de
video) e servia a UMA regra so, como guarda do formulario. Agora decide tambem o desfecho da reacao.

- 21 suites e os dois verificadores verdes. **Vale hoje, sem importar nada:** a mudanca e na funcao
  `tecla` do codigo e na porta da IA, nao no quadro.

### Armadilha nova, e quase custou caro

**Escrever arquivo por Python com `\uD83D\uDE4F` (par de surrogates de emoji) TRUNCA o arquivo no
meio da escrita.** O `write` falha com `UnicodeEncodeError` **depois** de ja ter gravado parte, e o
`sugestao.js` ficou **1717 linhas mais curto** — e ainda assim `import()` dizia *"importa ok"*,
porque o que sobrou era sintaticamente valido. Foi `git diff --stat` que acusou. Restaurado com
`git checkout --` e refeito com a ferramenta de edicao.

### O que fica para ele

- **A etiqueta que dispensa da fila continua mandando a mensagem do momento uma vez por dia**,
  inclusive para quem so repassa (e a linha "Santa Cruz" do print). E decisao dele de 03/09 — *"engajado
  recebe mensagem do momento uma vez por dia"* — e nao foi tocada. Querendo que o repasse cale essa
  caixa tambem, e uma linha.
- **O emoji sozinho continua custando uma conferencia** por conjunto de mensagens novas: um emoji de
  maos depois de um agradecimento PODE ser despedida, entao ali o julgamento ainda vale o preco.
- **Importar o padrao da v3.169 continua pendente** (a boas-vindas da chegada).
