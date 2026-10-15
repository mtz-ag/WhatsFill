## 2026-10-15 - v3.158.0 - comemorar tambem e apoio, e apoio nao se corrige

**Print dele:** ela escreveu *"Gracas tudo dando certo! Todos meus candidatos se Elegerao so Flavio
Mas vai ser Presidente com certeza"* e recebeu *"A Presidencia ainda sera decidida no segundo turno,
em 25 de outubro"*. Ele apagou: **"cortou o apoio da pessoa em vez de torcer junto"**.

### O defeito e meu, e e da vespera

**Medido:** `precisaDoDossie` = **true** — o dossie foi puxado, e dentro dele chegam a IA **nove
linhas sobre o 2o turno** que eu acrescentei em 14/10 para impedir pedido de voto em eleicao
encerrada, inclusive a linha da tabela com o placar (47,03% x 45,16%).

**O fato existia para NAO pedir voto, e virou correcao em cima de quem veio comemorar.** E a licao
de 08/09 — *regra sem escopo e cumprida ate onde ela nao devia ir* —, agora com o agravante de que a
regra sem escopo era um FATO, e fato nao parece regra: parece informacao inofensiva.

### E a regra que deveria pegar isso cobria so o xingamento

A **regra 17** (25/09) se chama *"XINGAR O ADVERSARIO E APOIO, E APOIO NAO SE CORRIGE"* e diz
*"NUNCA modere, nunca eduque"* — mas escopada ao insulto. **Comemorar nao estava la**, e e a mesma
coisa: alguem que veio somar recebendo reparo.

Hoje a regra cobre as duas, com a frase do caso real escrita como o que NAO dizer. **A guarda que a
mantem util:** quem PERGUNTA de verdade (*"quando e o segundo turno?"*) continua recebendo a
resposta, e o dia 25 continua podendo entrar — **como CONVITE** (*"agora e levar todo mundo no dia
25"*), que e o que serve a campanha, nunca como reparo.

### O escopo foi escrito COLADO no fato, e em prosa

No item 5 do dossie, ao lado dos numeros: eles servem para duas coisas — nao pedir voto em eleicao
encerrada e responder quem perguntar — e **nunca** para corrigir o que ela disse sobre o resultado.
**Em prosa e nao em linha `> `**, que `semBlocoDeRevisao` corta antes de chegar ao modelo: foi
exatamente nessa armadilha que eu cai em 14/10, escrevendo os dois avisos mais importantes do dia
dentro de blocos de citacao. O teste aplica a peneira antes de procurar a frase.

### Nenhum detector novo, de proposito

`soExpressaApoio` devolve **null** para a comemoracao dela — e eu NAO a alarguei. **Forma de
expressar apoio nao fecha em lista, e esta e a sexta vez que este projeto registra isso**; alargar
conserta esta print e nao conserta a classe. **O conserto e o que a IA le** (a correcao dele de
12/09: *"eu quero que mude o que a IA diz, nao parar todo tempo para eu revisar"*).

### De brinde, a quarta mensagem da plataforma lida como fala dela

*"O contato respondeu a uma mensagem que nao foi encontrada na base de dados, solicite mais
informacoes ao contato."* estava na conversa e **nao era reconhecida** — `ehMensagemDaPlataforma`
devolvia false. E a familia do Carlos e da Vera (02/09) e do FAQ do WhatsApp (05/09), com uma
diferenca que a torna a pior de todas: **ela da uma ORDEM** (*"solicite mais informacoes ao
contato"*) sentada no fluxo de quem escreve. Texto que manda fazer alguma coisa, chegando pelo lado
dela, e o que menos pode virar insumo de resposta.

O recorte e a frase do meio (*"nao foi encontrada na base de dados"*), que ninguem escreve
conversando; a abertura e o fecho mudam de redacao.

### Medido

- 21 suites e os dois verificadores verdes.
- Tres assercoes novas de FALSO POSITIVO no aviso da plataforma (*"minha cidade nao foi encontrada
  na lista de voces"*, *"o meu nome nao foi encontrado no cadastro do CRAS"*): apagar a fala de quem
  falou de verdade e pior que ler o ruido, e o contato fica mudo para todas as regras.
- O teste do dossie normaliza o espaco antes de procurar a frase — o arquivo e quebrado em 100
  colunas, e procurar frase inteira contra o texto cru cai quando alguem so reflui o paragrafo.
