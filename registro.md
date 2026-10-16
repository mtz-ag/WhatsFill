## 2026-10-16 - v3.166.0 - ESTADO DE AGORA - a eleicao nao acabou: o 2o turno e nosso

**Relato dele**, com a print do rascunho que dizia *"Como a eleicao ja passou, nao vou conseguir
combinar um evento de campanha agora. Um abraco!"*: *"ele deve estar se referindo ao segundo turno
do flavio bolsonaro que estamos apoiando"*.

### Medido antes de mexer, e o dossie estava CERTO

`precisaDoDossie` = **true** (a palavra "eleicao" aciona), e as linhas do dossie sobre o **2o turno
de 25/10** e sobre o **Flavio** estavam **presentes no prompt**, escritas certas. O modelo nao
ignorou o dossie: ele copiou os **TITULOS EM MAIUSCULAS**, que eram os dois mais curtos e os mais
afirmativos — o item 5 (*"A ELEICAO DE 04/10/2026 JA ACONTECEU"*) e a regra 12 (*"A CAMPANHA ACABOU
EM 04/10/2026"*), **esta ultima escrita por mim na vespera**, para o caso da vaga de emprego.

**Terceira vez em dois dias que um fato meu e cumprido onde ele nao devia ir** — e a pior das tres,
porque **fato nao parece regra: parece informacao inofensiva**. A licao de 08/09 (*regra sem escopo
e cumprida ate onde nao devia*) vale para numero, data e placar do mesmo jeito.

### Os tres lugares, porque a metade de um fato e lida como o fato inteiro

- **regra 12** (a vaga): o titulo contundente saiu. O motivo continua escrito, agora como **motivo
  INTERNO que nao se diz ao contato**, apontando para a regra 19.
- **regra 19, nova:** *a eleicao nao acabou, e a campanha em curso e NOSSA.* Em 04/10 ficaram
  decididos deputado, senador e governador; a Presidencia vai a **2o turno em 25/10/2026** e o nosso
  candidato e o **Flavio Bolsonaro, o 22**. As frases proibidas estao **escritas** (*"a eleicao ja
  passou"*, *"a campanha acabou"*, *"o periodo eleitoral terminou"*) — proibicao que nao nomeia a
  frase nao diz ao modelo qual evitar. E o que de fato acabou **tem NOME**: so se diz com o cargo
  escrito, e so para nao pedir voto em quem ja foi eleito.
- **dossie, item 5:** o titulo passou a carregar as DUAS metades — o 1o turno acabou **e** a
  campanha do 2o esta em curso —, sem desfazer o que o item existe para fazer.

**O NOME de quem ganhou NAO entra na regra 19**, e isto foi pego pelo teste: o prompt de sistema e
dos dois candidatos, e `perfis.test.mjs` exige que nada de um sobre no do outro. **Quem foi eleito e
fato do DOSSIE**, que ja e por candidato; a regra 19 fala da eleicao, nao de quem ganhou.

### A trava, porque prompt e pedido

`AVISOS_QUE_IMPEDEM_ENVIO.eleicaoEncerrada` barra o envio automatico quando o rascunho diz que a
eleicao, a campanha ou o periodo eleitoral acabou. **E mecanica de verdade** — e uma afirmacao sobre
uma data, nao julgamento.

**As duas guardas que a mantem util:** a frase que **NOMEIA o cargo** passa (*"a eleicao de deputado
estadual ja acabou"* e verdade e e o que impede pedir voto em eleito), e a frase que fala do **2o
turno, do dia 25 ou do Flavio** passa — quem diz isso nao esta dizendo que acabou tudo.

**Medido na funcao exportada:** o rascunho da print vem barrado e `rascunhoPodeSairSozinho` da
**false**; **7 de 7** formas de dizer que acabou barradas, **14 de 14** frases legitimas passando.

### Varredura das minhas proprias asercoes

Tres asercoes minhas gravavam a redacao que vazou, e a de 15/10 exigia literalmente
`/CAMPANHA ACABOU EM/`. **Trave a AFIRMACAO, nao a frase** — as tres foram reapontadas, com a data e
o motivo da inversao escritos no teste.

- 21 suites e os dois verificadores verdes.

### O que fica para ele

- **Passado 25/10 nao ha mais eleicao nenhuma**, e a regra 19 diz isso. Nesse dia ela e o item 5 do
  dossie precisam ser reescritos — e o unico pedaco deste conserto com prazo.
- **A regra da colinha continua pedindo voto nos seis cargos**, e cinco estao decididos: e decisao
  dele de 09/09 e nao foi tocada.
- **O disparo da colinha continua configurado pedindo voto**, e o `pedir-dados` dele continua com o
  Instagram e o grupo da campanha encerrada.
