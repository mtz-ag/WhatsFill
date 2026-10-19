## 2026-10-19 - v3.174.0 - ESTADO DE AGORA - nao distribuimos material

**Regra dele:** *"nao estamos distribuindo material, a distribuicao e feita pelo pl dos materiais do
flavio, corrija isso onde for necessario"*. Perguntado o que a mensagem diz e o que fazer com a
etiqueta, ele escolheu: *"diga para entrar em contato com a equipe do zucco que e do PL e devem ter
o material"* e **a etiqueta sai — volta a ser atendido normal**.

### O caminho inteiro do material virou do avesso

| ate ontem | agora |
|---|---|
| *"o que temos sao folhetos, adesivos e bandeiras"* | **nao distribuimos nada** |
| pede o **endereco completo** | **nao pede endereco** |
| promete o repasse **a equipe dos materiais** | **nenhuma promessa**: a distribuicao e do PL |
| etiqueta de material **PULA o contato para sempre** | **o pulo acabou**; quem tinha volta a fila |
| — | orienta a procurar a **equipe do Capitao Zucco, que e do PL** |

**A COLINHA e a unica excecao, e pelo motivo certo:** ela vai DIGITADA na propria mensagem (decisao
dele, 09/09), nao tem entrega, e por isso nunca foi material.

### Os quatro lugares, porque o estoque sempre viveu em mais de um

- **A secao 25 do padrao DELE** (`atendimento.js`) — reescrita, porque ele pediu.
- **A regra 12 do prompt** — a lista do que temos saiu; entrou a orientacao do PL, a proibicao de
  pedir endereco e a de afirmar estoque.
- **A trava `afirmouTer`** — `ITEM_FISICO` ganhou **folheto, santinho, panfleto, adesivo e
  bandeira**. Medido: *"o que temos sao folhetos, adesivos e bandeiras"*, que em 25/09 era a frase
  CERTA e a trava deixava passar, **hoje e barrada**. A negativa continua passando.
- **A resposta pronta do voluntariado** — o fecho pedia o endereco e prometia o repasse. Saiu.

**A colinha ficou de fora de `ITEM_FISICO` de proposito:** dizer que a temos e verdade.

### O pulo, que era o mais caro

`enderecoParaMaterial` devolve `null`. Ela existia por um motivo so, escrito em 04/09 — a etiqueta
carregava o caso ate ele transferir a conversa a quem fazia o envio no fim do dia. **Sem envio nao
ha lista**, e o pulo e permanente: continuaria escondendo gente da fila para sempre sem nada em
troca.

**Medido, no contato que tinha a etiqueta:** era **tecla 2** (pula, deixa aberto) e passou a ser
**tecla 5** — o fluxo normal. Quem pede material hoje, sem modelo, vai para a **tecla 6**, e a IA
escreve com a regra nova.

**A etiqueta continua sendo aplicada**, so nao pula mais: virou rotulo de organizacao no CRM. Para
parar de marcar tambem, e esvaziar o campo *"Etiqueta de quem MANDOU ENDERECO"* na aba Automatizado
— apagar as seis chamadas por conta propria seria remover funcao que ele nao pediu para remover.

### A migracao, que e o que faz o conserto chegar nele

`migrarVoluntarioSemEndereco` troca a resposta do voluntariado **so se o texto gravado ainda PEDIR o
endereco** (`ehPedidoDeEndereco`). Texto que ele reescreveu passa intacto — comparar byte a byte
seria fragil, porque ele edita as respostas. Sem ela o conserto valeria para instalacao nova e para
mais ninguem (a armadilha do `-contato-assessor`, 04/09).

### Dez assercoes dos testes foram INVERTIDAS, com a data e o motivo

Elas travavam a doutrina de 22/09 e 25/09 (*"inclua bandeiras na lista que de material que temos"*).
Travam agora a ausencia dela — e a prova de que os tres lugares concordam continua sendo a mesma:
**o prompt manda dizer X e a trava tem de aceitar X**. Hoje os tres dizem que nao ha estoque.

- 22 suites e os dois verificadores verdes.

### O furo que fica, e so ele resolve

**O MODELO APROVADO de material e dele, na plataforma** — a redacao e da Meta/mobiliza e **nenhum
codigo meu alcanca**. Enquanto ele continuar sendo disparado, vai pedir o endereco e prometer a
entrega, e a etiqueta vai continuar sendo aplicada por ele. **Aposentar ou reescrever esse modelo e
o passo dele.**

### O resto, para ele decidir

- **A regra 12 (quem pede VAGA) continua mandando NAO oferecer voluntariado**, e isso nao conflita
  com a resposta pronta: la e quem pede emprego PAGO (nao se oferece voluntariado como consolo),
  aqui e quem se oferece para ajudar. Querendo recrutar voluntario para o 2o turno, e decisao dele.
- **O texto do voluntariado e dele** — reescrevi o fecho porque o antigo prometia entrega; a redacao
  pode ser outra.
- **Com prazo:** passado 25/10, a regra 19 e o item 5 do dossie tem de ser reescritos.
