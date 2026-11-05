## 2026-11-05 - v3.266.0 - ESTADO DE AGORA - a fila de "Novos" voltava vazia com gente esperando

> **Esta e a entrada de passagem de contexto.** Se a versao do `manifest.json` for maior que
> **3.266.0**, ela envelheceu: confira antes de confiar e **reescreva-a**, nao acrescente uma
> segunda.

### O QUE VOCE PRECISA FAZER

1. `chrome://extensions` -> **recarregar** a extensao
2. **F5** na aba do mobiliza.me
3. Confira **3.266.0** na linha pequena do topo do painel
4. Aperte **"Comecar pelos Novos"**: a fila tem de trazer o mesmo numero que o botao **Novos** da
   plataforma escreve ao lado

### O QUE ESTAVA ERRADO, MEDIDO NA SUA BASE ANTES DE MEXER

A rodada encerrava com *"a fila de Novos veio VAZIA"* **com a sua tela escrevendo Novos 27**.

```
status=aberto ...... 360   ->  @g.us 145 | @lid 206 | @s.whatsapp.net 8 | @newsletter 1
das 49 primeiras linhas (a janela que a rodada le): 48 eram GRUPO, sobrava 1
```

**A guarda do grupo estava certa; errada era a ORDEM.** Ela roda depois de ler, e a consulta vem
ordenada pela ultima mensagem — grupo e a conversa mais barulhenta que existe. Com 145 deles, a
folga de 40 linhas nao alcanca ninguem. Aumentar a folga so adiaria.

**E consertar so a ordem teria sido pior que o defeito.** O `@lid` e o endereco NOVO do WhatsApp:
pelo endereco e pessoa, entao a guarda o deixa passar e a fila passaria a ter **206 conversas que
voce nunca viu na tela** — e a regra de "a ultima mensagem ja era minha" as concluiria em silencio,
uma a uma. Medido no que elas sao: ultima direcao de SAIDA ou nenhuma, sem prazo de atendimento e
**205 de 206 sem cadastro**.

### O QUE MUDOU

| | antes | agora |
|---|---|---|
| quem peneira o grupo | o painel, depois de ler 49 linhas | a **consulta**, no servidor |
| o que entra na fila | tudo o que nao e grupo | **pessoa com cadastro**, como na sua tela |
| a fila de "Novos" hoje | 1 (ou 0) | **9** — o mesmo numero da plataforma |

**A regra nao foi deduzida: e a que a plataforma usa.** O modulo da fila dela faz junta INTERNA com
o cadastro (`contato_id`) mais as duas negacoes de endereco, e a contagem bateu campo a campo com a
dela — aberto **9 = 9**, em atendimento **268 = 268**, minhas **50 = 50**.

**A guarda antiga nao saiu**: ela virou a segunda linha. Protecao que o servidor passou a fazer nao
se apaga do cliente, porque a consulta e texto numa URL.

### O PRECO, E ELE E REAL

**Conversa sem cadastro sai da fila da rodada.** Ela tambem nao aparece na sua tela — a plataforma
a descarta pela mesma regra —, entao a rodada percorre o que voce ve, que e o que se quer. Mas no
dia em que a plataforma criar a conversa ANTES do cadastro, essa pessoa fica de fora **sem nada
avisar**. Se voce vir alguem na tela que a rodada nao abre, e aqui que se olha.

### O QUE ACHEI E NAO FIZ (e decisao sua)

- **As 206 conversas `@lid`**, que ninguem ve. Elas ficaram de fora da fila. Se um dia a plataforma
  passar a mostra-las, elas voltam a ser assunto — e ai a pergunta e se concluir em silencio uma
  conversa em que so nos falamos e o certo.
- **Grupos**: continuam fora, como sempre. Sao 145 abertos.

### PENDENCIAS QUE CONTINUAM ABERTAS

Da v3.265.0: o item 8 (o campo de mensagem so existe depois de Assumir, medido em 28/10 e nao e
defeito da extensao); o desastre nao ser reconhecido como desabafo; `semInteresse` ser chamado sem
a hora da nossa ultima mensagem; briga de familia sem o nome no vocativo. De antes: o painel
esvaziar 3 a 4 segundos a cada troca de conversa; o falso positivo antigo do `desvio` (rota x
verba); otimizacao do dossie por secao; rascunho manual descartado quando a IA se abstem; consulta
exata de etiquetas; `seus`/`seu` fora de `DIRIGIDA_A_NOS`.

### O QUE FOI CONFERIDO

**43 suites**, `checar-modulos` e `checar-referencias` limpos. **A prova de cada peca e o defeito
reintroduzido:** tirando `...SO_PESSOAS` da fila cai 1 assercao; devolvendo o filtro de valor unico
ao montador de consulta, caem 2.
**A medicao foi SO LEITURA, numa aba separada da sua**: nenhuma rodada foi iniciada, nenhuma
mensagem saiu, nada foi escrito no banco, nenhuma chamada paga de IA foi feita e **nenhum nome ou
telefone de eleitor entrou em arquivo do repositorio** — o que saiu da medicao foram contagens e
nomes de coluna.

## 2026-11-05 - v3.265.0 - Estado anterior - o que a simulacao de 10 conversas encontrou

### O QUE VOCE PRECISA FAZER

1. `chrome://extensions` -> **recarregar** a extensao
2. **F5** na aba do mobiliza.me
3. Confira **3.265.0** na linha pequena do topo do painel
4. Reabra as conversas da sua lista e peca a previsao / o rascunho: o 😢 nao pode mais receber
   formulario, o elogio nao pode mais receber a mensagem do dia, e a saudacao tem de ser a do
   horario

### O QUE ESTAVA ERRADO, MEDIDO ANTES DE MEXER

**Duas familias, e os oito itens da sua lista caem nelas.**

**(1) A abstencao da IA virava a mensagem do dia.** A Clarice (*"Muito obrigada por zelar pela
nossa seguranca!"*), o Glenio (🙏) e a Maria Luiza (*"Parabens Capitao Martim!"*) tinham o painel
decidindo certo — tecla 3 ou 6 — e a IA respondendo *"nao ha o que responder"*, o que pela sua
regra de 24/09 manda a tecla 5.

```
dos doze detectores, so falouAlgoProprio casava no agradecimento e no elogio
soExpressaApoio -> null  (e NAO foi alargado: "parabens" e voto de boa vontade, medido em 06/09)
```

**(2) O tom.** O 😢 da Rosicler recebendo formulario, *"Bom dia!"* as 14:17, *"nao tenho como
confirmar"* em cima do desastre da Noeli, *"obrigado pelo apoio"* a quem nao declarou apoio, e a
briga de casal no celular do Adriano lida como hostilidade contra o mandato.

### O QUE MUDOU

| o caso | antes | agora |
|---|---|---|
| agradecimento, elogio | tecla 5 (mensagem do dia) | o fluxo decide; a IA escreve um obrigado curto |
| 😢 depois da nossa | tecla 4 (pede nome e cidade) | tecla 6 — acolhimento |
| cidade no texto | pede nome **e** cidade | pede **so o nome** |
| saudacao as 14:17 | *"Bom dia!"* sobrevivia em dois casos | trocada sempre |
| *"nao posso confirmar"* | saia sozinho | barra o envio e voce le |
| *"obrigado pelo apoio"* sem apoio | saia sozinho | barra o envio e voce le |
| xingamento ao titular | tecla `s`, etiqueta permanente | nao e hostilidade contra nos |

### AS TRES COISAS QUE A MEDICAO DESMENTIU, E ELAS MUDAM O DIAGNOSTICO

**(a) A troca de saudacao JA FUNCIONAVA.** O conserto de 04/09 esta de pe — eu ia refaze-lo. O que
havia eram dois caminhos em que ele nao e alcancado: a abertura ser tudo o que ha no texto (*"Bom
dia!"*) com voce ja tendo falado hoje, e a saudacao vir depois de *"Ola!"*.

**(b) O PARSER ACERTOU a cidade do sergio** — Cacequi, confianca exata. O popup *"Cidade a gravar"*
tambem esta certo e **nao foi mexido**: cidade de palpite espera o seu clique desde 31/08. O que
estava errado era pedir na mensagem o que estava escrito na tela.

**(c) O CONSERTO DE ONTEM (v3.263) NAO ALCANCAVA O CASO DO ADRIANO.** Ele ensinou o PROMPT a
distinguir quem fala de quem e o titular — e `semInteresse` e a PRIMEIRA regra da tabela e **nunca
chega a consultar a IA**. A guarda nova e um dado e nao uma lista: o nome do proprio contato no
vocativo (*"Adriano voce e um babaca"*) diz que o "voce" e ele.

### O QUE NAO AFROUXOU

A hostilidade de verdade continua sendo reconhecida (*"voces sao uns vagabundos"* marca, com nome
no cadastro ou sem), o fecho por cortesia continua concluindo o 👍, o formulario continua saindo
para quem nao deu cidade nenhuma, e *"vou verificar isso"* continua passando limpo.

### O QUE ACHEI E NAO FIZ (e decisao sua)

- **Item 8, o Assumir.** A plataforma **so cria o campo de mensagem depois de assumir** — isso esta
  medido desde 28/10 e nao e defeito da extensao. A previsao do fluxo (03/11) ja le sem assumir; o
  rascunho nao, porque o texto nao teria onde ser inserido. Mudar isso e desenho novo.
- **O desastre nao e reconhecido como desabafo.** Medido: `desabafoPessoal` devolve **null** para o
  texto da Noeli, e o que a levou para a IA foi `falouAlgoProprio`. Reconhecer "desastre" exige uma
  lista de texto, e este arquivo registra seis vezes que lista de texto nao fecha. **A trava do tom
  juridico cobre o estrago sem depender disso**; o acolhimento em si continua sendo a IA e voce.
- **`semInteresse` e chamado sem a hora da nossa ultima mensagem** no painel
  (`semInteresse(state.entrantes)`), entao ele le a conversa inteira em vez da rajada. Nao mexi:
  muda o alcance da regra mais destrutiva do projeto e isso e decisao sua.
- **Briga de familia sem o nome no vocativo** continua indo para a tecla `s`. Fazer
  `desabafoPessoal` vencer `semInteresse` seria uma porta de saida larga (bastaria citar a esposa
  numa mensagem hostil), e preferi a guarda estreita que resolve a print.

### PENDENCIAS QUE CONTINUAM ABERTAS

O painel esvaziar 3 a 4 segundos a cada troca de conversa (medido em 03/11, nao consertado); o
falso positivo antigo do `desvio` (rota x verba, de 23/09); otimizacao do dossie por secao;
rascunho manual descartado quando a IA se abstem; consulta exata de etiquetas; `seus`/`seu` fora de
`DIRIGIDA_A_NOS`.

### O QUE FOI CONFERIDO

**43 suites** (a nova e `tests/acolhimento.test.mjs`), `checar-modulos` e `checar-referencias`
limpos. **A prova de cada peca e o defeito reintroduzido:** sem `reacaoDeTristeza` caem 2
assercoes; sem `soAgradeceOuElogia`, 4; sem `abstencaoNaoCabe`, 1; sem a guarda do vocativo, 2; sem
a trava do tom juridico, 4; sem a do apoio, 1; sem a cidade do texto, 2; com o `else if` da
saudacao de volta, 1; sem a interjeicao, 1.
**Nenhuma rodada foi iniciada, nenhuma mensagem saiu, nenhuma chamada paga de IA foi feita, e
nenhum nome ou telefone de eleitor entrou em arquivo do repositorio** — os testes usam nomes
ficticios.

## 2026-11-04 - v3.264.0 - Estado anterior - finalidade do pedido de dados

Pedido de cidade e formulario completo agora explicam: salvar o contato e melhorar o atendimento.
A selecao dos dados faltantes permanece. O reconhecimento do pedido parcial aceita a redacao
nova e a anterior para preservar o historico. Recarregar extensao e aba para ver 3.264.0.

## 2026-11-04 - v3.263.0 - Estado anterior - publicacao das correcoes locais

As correcoes de apresentacao, identidade do falante e conflito familiar abaixo agora integram
esta versao. Antes, o manifest permanecia em 3.262.0, mesmo com os arquivos locais alterados.
Recarregue a extensao em chrome://extensions e depois de F5 no Mobiliza. Confira 3.263.0.
O botao Recarregar do painel nao substitui a recarga da extensao pelo navegador.

Limites: o resumo externo do audio ainda nao foi corrigido; a resposta da IA nao foi validada
com chamada real. Apresentacao reconhecida pelo novo detector exige frase curta e nome composto
com iniciais maiusculas. As correcoes foram testadas localmente, sem enviar mensagens.

## 2026-11-04 - Correcao local: formulario apos apresentacao

O prompt e o piso do painel usavam sempre Nome, Cidade. Apresentacao explicita no historico
agora seleciona pedido so de cidade; com Cidade conhecida, nao acrescenta formulario.
O bloco literal ja gerado tambem e substituido; pedido parcial e reconhecido no historico.
Detector conservador: nome composto com iniciais maiusculas, sem inferir nome de cargo ou
cidade. Nomes em minusculas, apresentacoes em frase longa e parafrases do formulario ainda
exigem ampliacao/validacao. Testes com nomes ficticios. Sem envio ou chamada paga.

## 2026-11-04 - Correcao local em validacao: falante e conflito familiar

Prompt do rascunho distingue titular, interlocutor e alvo de insultos; historico de telefone
emprestado produz aviso explicito de identidade incerta. Conflito familiar inclui casal e
empresa familiar. Xingamento com contexto familiar reconhecido como desabafo.
Testes usam somente nomes ficticios. Resumo do audio do CRM ainda nao corrigido: o adaptador
le transcricao externa. Sem chamada paga, envio ou teste em contato real. Esta mudanca nao
comprova ainda que o modelo produz a resposta aprovada; precisa de validacao do rascunho.

## 2026-11-04 - v3.262.0 - Estado anterior - o preterito, os dois alvos, e a tecla que contradizia

> **Esta e a entrada de passagem de contexto.** Se a versao do `manifest.json` for maior que
> **3.262.0**, ela envelheceu: confira antes de confiar e **reescreva-a**, nao acrescente uma
> segunda.

### O QUE VOCE PRECISA FAZER

1. `chrome://extensions` -> **recarregar** a extensao
2. **F5** na aba do mobiliza.me
3. Confira **3.262.0** na linha pequena do topo do painel
4. Reabra a conversa da print de ontem (a do textao sobre o Lula): o rascunho nao pode sair com
   *"agradeco as informacoes / estamos atentos"*, e tem de responder a pergunta dela

### O QUE ACONTECEU

Na v3.261.0 eu medi quatro buracos no detector de denuncia e os deixei parados, porque tapa-los
manda MAIS gente para a desconversa — direcao oposta a daquele conserto. Voce respondeu
**"Sim, alargue"**, e e isso.

**O que faltava nas listas:**

```
"o prefeito daqui desviou a verba da creche"   -> null   (a lista nao tinha "desviou")
"o prefeito daqui roubou a verba"              -> null   (nem "roubou")
"esses comunistas ladroes acabaram com o pais" -> null   (ALVO_PUBLICO nao tinha "comunista")
"a esquerda so sabe fazer corrupcao"           -> null   (nem "esquerda")
```

A lista de acusacao era toda de **presente, gerundio e participio**; o preterito, que e como se
conta o que ja aconteceu, nao estava la. E os dois alvos que esta base mais nomeia tambem nao.

### O QUE MUDOU, E O QUE ISSO CUSTA

**Medido: 10 casos novos passaram a casar, e SEIS deles vao para o ramo do DESABAFO** — o ramo
caloroso da v3.261.0, nao o da desconversa:

```
denuncia (desconversa)   o prefeito desviou a verba da creche
denuncia (desconversa)   o prefeito roubou a verba
denuncia (desconversa)   o vereador roubou na licitacao da escola
denuncia (desconversa)   o secretario desviou o convenio do hospital
DESABAFO (acolhe)        esses comunistas ladroes acabaram com o pais
DESABAFO (acolhe)        a esquerda so sabe fazer corrupcao
DESABAFO (acolhe)        o Lula desviou dinheiro do povo
DESABAFO (acolhe)        o PT roubou o pais inteiro
DESABAFO (acolhe)        a esquerda e uma quadrilha
DESABAFO (acolhe)        esses comunistas sao ladroes
```

Entao `comunista`/`esquerda` quase nao aumentam a desconversa — as duas ja estavam em
`ADVERSARIO`, e e o `contraOAdversario` que responde por elas. **Quem aumenta a desconversa e o
preterito com alvo local** (prefeitura, vereador, secretaria, obra, verba), que e onde ha de
verdade para onde o caso ir.

### AS DUAS GUARDAS QUE O ALARGAMENTO OBRIGOU

Nao sao zelo: sem elas o alargamento transformaria em acusacao de corrupcao duas coisas que chegam
aqui todo dia.

- **DESVIAR DE e desvio de rota, nunca de verba.** *"desviou do buraco da rua e quase bati, a
  prefeitura nao arruma"* viraria denuncia, com a prefeitura servindo de alvo. A guarda e
  morfologica e nao uma lista de objetos: na acusacao o verbo leva objeto DIRETO (*"desviou a
  verba"*); com preposicao e desvio de rota.
- **Crime contra ELA no preterito.** *"roubou a minha moto na frente da prefeitura"* viraria
  denuncia politica. A guarda que protegia as outras formas nao conhecia o preterito — nem o
  artigo no meio (*"roubou o meu celular"* escapava por causa do "o").

**E `roubou` nao e `rouba` + `ou`: e `roub` + `ou`.** Escrevi a alternancia errada e as duas
assercoes do preterito cairam na hora — o mesmo escorregao que a lista original tinha.

### A CONTRADICAO QUE O ALARGAMENTO ACENDEU

Com o detector vendo mais casos, apareceu uma coisa que ja estava la: a **tecla `c`** oferecia
*"Agradeco as informacoes. Estamos atentos e acompanhando o assunto."* — **byte a byte o texto que
a v3.261.0 existe para impedir**, agora na frente de bem mais gente.

Era a terceira vez neste projeto em que uma decisao escrita num lugar nao alcanca o lugar onde ela
decide: ontem o conserto entrou na colada do prompt e **nada mais lia o `contraOAdversario`**.
Hoje a tecla `c` nao e oferecida no desabafo, e o motivo que trava a tecla 1 diz a verdade de cada
caso — o antigo mandava procurar um texto encaminhado que, num desabafo, nao existe.

A tecla 1 continua travada nos dois casos: material de campanha em cima de uma acusacao responde ao
lado venha ela de onde vier.

### O QUE CONTINUA PROIBIDO

O merito da acusacao, nos dois ramos: nada de dizer se e grave, o que precisa ser apurado, nem
prometer levar adiante. E o sinal continua **verdadeiro** nos dois — e ele que cala o formulario no
rascunho.

### O QUE ACHEI E NAO CONSERTEI (e decisao sua)

**Um falso positivo ANTIGO, que nao e deste alargamento:** *"tive que fazer um desvio por causa da
obra da prefeitura"* e lido como denuncia. A causa e a palavra `desvio` sozinha, que significa as
duas coisas — e esta na lista desde 23/09. **Nao mexi de proposito:** consertar isso ESTREITA o
detector no mesmo commit em que voce mandou alargar, e as duas guardas obvias (exigir o objeto, ou
olhar o artigo antes) quebram *"o desvio de verba na prefeitura"*, que e o caso para o qual a regra
existe.

### PENDENCIAS QUE CONTINUAM ABERTAS

O painel esvaziar 3 a 4 segundos a cada troca de conversa (medido em 03/11, nao consertado);
otimizacao do dossie por secao; rascunho manual descartado quando a IA se abstem; medicao de cache;
consulta exata de etiquetas; cadastro sem mensagem do momento; detector de convite pessoal;
`seus`/`seu` fora de `DIRIGIDA_A_NOS`.

### O QUE FOI CONFERIDO

42 suites, `checar-modulos` e `checar-referencias` limpos. **A prova de cada peca e o defeito
reintroduzido:** sem o preterito caem 3 assercoes; sem `comunista`/`esquerda`, 3; sem a guarda do
DESVIAR DE, 1; sem o preterito em `CRIME_CONTRA_ELA`, 2; com a tecla `c` de volta no desabafo, 1.
Bateria de 26 frases medida antes e depois: 10 casos novos, **nenhum falso positivo novo**.
**Nenhuma rodada foi iniciada e nenhum dado de eleitor entrou em arquivo do repositorio.**

## 2026-11-03 - v3.260.0 - Estado anterior - o "sem interesse" marcaria um apoiador, e as duas guardas

> **Esta e a entrada de passagem de contexto.** Se a versao do `manifest.json` for maior que
> **3.260.0**, ela envelheceu: confira antes de confiar e **reescreva-a**, nao acrescente uma
> segunda.

### O QUE VOCE PRECISA FAZER

1. `chrome://extensions` -> **recarregar** a extensao
2. **F5** na aba do mobiliza.me
3. Confira **3.260.0** na linha pequena do topo do painel
4. Abra a conversa do **Caxias do Sul - Eraldo**: a linha "O fluxo faria" nao deve mais dizer
   *"marca sem interesse"* — deve mandar responder a mao ou concluir

### DE ONDE ISTO VEIO

Voce pediu para eu simular as respostas de 10 conversas. Abri as 10 na sua aba e li a linha
**"O fluxo faria"** de cada uma — **sem rodada**: nada enviado, nada concluido, nada gravado, a IA
nao foi chamada em nenhuma e o console nao teve erro.

**Das 10: seis concluiriam em silencio (tecla 3), tres iriam para voce (tecla 6), e UMA mandaria
marcar sem interesse.** Nenhuma enviaria mensagem.

A unica fora do padrao era a do **Eraldo**, que manda video de direita todo dia. A ultima mensagem
dele e *"Os vagabundos, que usaram o PL, para se eleger, ja comecaram a trair."* — ele esta
**defendendo** o PL — e o fluxo marcaria a etiqueta **permanente** de sem interesse e concluiria
**sem responder**.

### AS DUAS CAUSAS, ISOLADAS UMA A UMA

**(1) O insulto era o SUJEITO de quem usou o partido.**
```
"os vagabundos usaram o PL"                              -> falou mal do nosso partido
"os vagabundos que ja usaram todo mundo ... o PL" (>30)  -> null
```
A janela de 30 caracteres mede **distancia** ate a sigla e mais nada: nao sabia que o objeto do
xingamento e *quem usou* o PL. Com a oracao relativa no meio (`que` + verbo de agir SOBRE alguem),
o insulto e o sujeito e o partido e a vitima da frase.

**(2) O que disparava o "veio hostilizar" era a palavra "voces".**
```
"parabens ... voces da direita ... derrubar esses vagabundos bandidos"  -> veio hostilizar
a MESMA frase sem a palavra "voces"                                     -> null
```
Ele estava falando com os aliados dele, e o `voces` foi lido como segunda pessoa dirigida a nos.
**A guarda nao e a palavra: e o OBJETO do xingamento.** *"esses vagabundos"* aponta para longe;
*"voces sao uns vagabundos"* prediga o xingamento em nos. Entao a neutralizacao exige o
demonstrativo **colado** no insulto, e so plural e coletivo — *"esse cara"* pode ser o candidato.

**E ha a excecao da excecao:** xingamento predicado em nos vence o demonstrativo. Sem ela bastaria
escrever "esses" numa frase para a hostilidade deixar de ser reconhecida.

### O QUE ISSO NAO AFROUXOU

Bateria de 25 casos, todos passando: xingar o partido continua marcando, na ordem direta e na
inversa; o nome do aliado continua valendo (o Sergio Nunes, 08/09); o adversario no meio continua
desfazendo; segunda pessoa direta e imperativo nao mudaram. **Prova do defeito reintroduzido:**
tirando a guarda do "esses" cai 1 assercao, tirando a do "que usaram o PL" caem 2.

### O QUE ACHEI E NAO CONSERTEI

- **O painel fica 3 a 4 segundos dizendo "Abra um atendimento na plataforma" a cada troca de
  conversa.** Medi os dois sinais a cada segundo: o painel da direita ja aponta para a conversa
  nova enquanto **a linha da fila ainda esta marcada na anterior**; discordando, o estado vira
  `sessionId: null` e o contato carregado some da tela. A espera de 4s da v3.222 existe so em
  `openQueueSession`; o laco de 500ms do painel nao a tem, e **joga fora o `ganchoRespondeu` /
  `so-um-sinal`** que `page-mob` devolve justamente para distinguir "nao sei ainda" de "nao ha
  conversa". Clicando rapido chega a 16s. Conserto provavel: por a espera no `watchPageState`, ou
  fazer `applyPageState` calar quando o gancho nao respondeu.
- **O cabecalho termina alguns segundos depois da barra de status** — ela ja diz "Contato
  carregado" e o topo ainda diz "Carregando...".
- **`seus`/`seu` sozinhos nao estao em `DIRIGIDA_A_NOS`** (so `teu`, `tua`, `seu candidato`), entao
  *"seus vagabundos, nao fazem nada"* nunca foi reconhecido. **Lacuna antiga, nao regressao** — e
  nao alarguei por conta propria: alargar faz a regra mais destrutiva do projeto disparar MAIS, e
  essa direcao e sua.

### O QUE FOI CONSERTADO DE QUEBRA

O ponto duplo da linha da previsao (*"conclua e siga.."*): varios motivos ja terminam em ponto e a
linha acrescentava o dela.

### PENDENCIAS QUE CONTINUAM ABERTAS

Otimizacao do dossie por secao; rascunho manual descartado quando a IA se abstem; medicao de cache;
consulta exata de etiquetas; cadastro sem mensagem do momento; detector de convite pessoal.

### O QUE FOI CONFERIDO

42 suites, `checar-modulos` e `checar-referencias` limpos. A simulacao rodou na sua aba com dados
reais, **so leitura**; nenhum nome ou telefone de eleitor entrou em arquivo do repositorio (a
bateria usa frases, nao contatos).

## 2026-11-03 - v3.259.0 - Estado anterior - os grupos por cidade sairam, e a promessa que eles faziam

> **Esta e a entrada de passagem de contexto.** Se a versao do `manifest.json` for maior que
> **3.259.0**, ela envelheceu: confira antes de confiar e **reescreva-a**, nao acrescente uma
> segunda.

### O QUE VOCE PRECISA FAZER

1. `chrome://extensions` -> **recarregar** a extensao
2. **F5** na aba do mobiliza.me
3. Confira **3.259.0** na linha pequena do topo do painel
4. Na **Config**, o cartao agora se chama **"Grupo do WhatsApp"** e tem **um campo so**: o link.
   Confira que o seu link continua la (a chave e a mesma, nao foi apagada)
5. Na **aba Respostas**, a resposta **"Enviar link do grupo"** foi reescrita. Se voce a tinha
   editado a mao, ela **nao** foi tocada — veja o aviso no fim desta entrada

### O QUE MUDOU

Voce mandou remover o cartao: *"funcao nunca foi utilizada, pode ser removida"*. A tabela por
cidade saiu, e com ela a funcao de editar, a leitura e a chave do perfil. **Ficou o campo do
link**, agora chamado "Link do grupo" em vez de "Link padrao" — ele deixou de ser o segundo lugar
depois da tabela e passou a ser o unico, que e o que ele sempre foi na pratica.

**E ela nao era so inutil: era o que fazia a resposta do grupo mentir.** Medi antes de remover,
com o estado que a sua print mostra (tabela VAZIA, link preenchido):

```
cityLinks {} + link preenchido + cidade "Caxias do Sul"
  -> missing: []
  -> "Prontinho! Este e o grupo de Caxias do Sul:  <link geral>"
```

Ou seja: o eleitor de Caxias recebia o link do grupo **geral** com o nome da cidade dele em cima,
e **nada bloqueava**. A guarda que o projeto citava para isso era `{{cidade}}`, e ela so barra a
cidade **vazia**. Com a tabela vazia desde sempre, isso esta no ar desde 07/09, quando a migracao
preencheu o link — **a remocao nao criou o defeito, revelou**.

E o caminho esta a um clique: o botao **"Enviar grupo + salvar + concluir"** da aba Respostas manda
exatamente esse texto, grava a classificacao e **conclui** o atendimento. A descricao dele dizia
*"so funciona com os grupos cadastrados na aba Config"*, o que era falso pelo mesmo motivo.

**Com um link so, a promessa por cidade e impossivel de cumprir** — entao o conserto e o texto, e
nao uma trava: a resposta passou a dizer *"este e o nosso grupo no WhatsApp"*. `{{cidade}}` saiu
dela, e com isso ela passa a servir tambem na **chegada**, que e quando alguem pede o grupo.

**O que mais mudou de tela:** o motivo do bloqueio deixou de mandar cadastrar o grupo de uma cidade
(nao ha mais onde) e passou a apontar o campo que existe; a linha do grupo na aba Dados deixou de
dizer "(padrao)", que com uma fonte so nao informava nada; e o rotulo de `{{link_grupo}}` deixou de
falar de "tabela em Config".

### O QUE ISSO CUSTA, E E SEU

- **Se voce tinha reescrito a resposta "Enviar link do grupo" a mao, ela nao foi tocada** — essa e a
  disciplina de todas as migracoes de texto aqui (quem editou fica com o dele). Nesse caso o
  `{{cidade}}` continua no seu texto, e a mensagem continua dizendo "o grupo de <cidade>" sobre o
  link geral. Se for o caso, me diga e eu reescrevo.
- **Grupo por cidade deixou de existir como conceito.** Querendo um grupo diferente por regiao,
  nao ha mais onde cadastrar — e a volta e a tabela inteira, nao um campo.
- **O seu dado nao foi apagado:** a chave antiga continua no armazenamento, so nao e mais lida.

### DOIS BOTOES QUE MANDAM O MESMO LINK, e e decisao sua

Com um link so, **"Enviar link do grupo"** e **"Agenda: entrar no grupo"** mandam o mesmo link, com
molduras diferentes (uma e "aqui esta o grupo", a outra e "a agenda sai no grupo"). Pela regra de
28/10, mesmo ato em momentos diferentes nao e redundancia — entao mantive as duas. Achando ruido,
uma sai.

### O QUE FOI CONFERIDO

42 suites passaram, `checar-modulos` e `checar-referencias` limpos. A medicao do defeito foi feita
com dado ficticio, fora do repositorio; **nenhuma rodada foi iniciada e nenhum contato real foi
tocado**. A tela depois de recarregar ainda nao foi conferida ao vivo.

Testes novos: a migracao do texto (reescreve as tres variantes, nao mexe duas vezes, nao toca em
texto reescrito por voce) e o cartao do painel (nao le a tabela, nao tem o editor dela, o titulo e
a descricao do caminho antigo nao falam mais dela). E a assercao que gravava o defeito foi
**invertida**, com o motivo escrito: ela dizia que `{{cidade}}` protegia a resposta, e nao
protegia.

### PENDENCIAS QUE CONTINUAM ABERTAS

Otimizacao do dossie por secao; rascunho manual descartado quando a IA se abstem; medicao de cache;
consulta exata de etiquetas (o catalogo aqui e amostra de 0,9%); cadastro sem mensagem do momento;
detector de convite pessoal. Nenhuma foi mexida nesta entrega.

Sobraram sem destino, da revisao do Cursor: `lista-erros-cursor.md`,
`whatsfill-ia-proposal-v11.diff` e `whatsfill-ia-v11-para-v12.diff` — o conteudo deles ja esta
aplicado desde a 3.244. Posso apagar quando voce mandar.

## 2026-11-03 - v3.258.0 - Estado anterior - parar pela pergunta conserva o reinicio

Causa: fechar(valor) devolvia parar, mas nao marcava state.auto.parar. O finally fechava
entao o controle flutuante. Botao e Esc da pergunta agora marcam a parada, como o quadrado.
Pular e concluir nao mudam essa bandeira. Teste executa o fechamento real nas tres escolhas.
Nenhuma rodada em producao foi iniciada. Validacao visual ao vivo ainda pendente.
Recarregue a extensao e a aba do Mobiliza. Demais pendencias permanecem na entrada anterior.

## 2026-11-03 - v3.257.0 - Estado anterior - aviso de etiquetas respeita amostra

loadTags descartava completa e lidos ao transformar a lista da API. Agora preserva os dois.
O aviso de etiquetas a remover informa quando o catalogo e parcial; nao afirma inexistencia
no CRM a partir da amostra. Catalogo antigo sem esse campo mantem a compatibilidade.
Teste cobre os textos para amostra e lista completa. Nenhuma remocao foi executada para testar.
A consulta exata por nome continua pendente; esta entrega corrige a informacao exibida.
As outras pendencias da v3.256.0 continuam abertas. Recarregue a extensao e a aba do Mobiliza.

## 2026-11-03 - v3.256.0 - Estado anterior - avisos visiveis e confirmacao manual

Recarregue a extensao e a aba do Mobiliza para ver a versao 3.256.0.

- 39 declaracoes de avisos receberam data-fica. Teste exige a marca nas declaracoes wf-block
  do painel, inclusive classes condicionais. Avisos nao perdem o restante do texto nos detalhes.
- Mandar junto ligado sem arquivo nem link HTTPS mostra aviso; a escolha nao e desligada.
- Pedido confirmado nesta conversa: Automatizar desmarcado deve perguntar antes de concluir.
  O ramo antecipado de contato respondido agora confirma antes de gravar e concluir. Pular ou
  parar preserva o atendimento aberto. A previsao informa que pedira confirmacao.
- Fechamento por cortesia ja depende de rodadaAutomatica para executar a escolha sozinho;
  acrescentada verificacao de regressao. Parada solicitada ja conserva a janelinha no finally;
  o desaparecimento relatado ainda nao foi reproduzido ao vivo.

Escopo pendente: otimizacao do dossie, rascunho manual, medicao de cache, consulta exata de
etiquetas, cadastro sem momento e convite pessoal. Nao foram implementados nesta rodada.
As mudancas de geracao/selecao de mensagens politicas personalizadas nao foram realizadas.
Validacao: 42 suites passaram, sintaxe do painel e diff conferidos.
Validacao visual na extensao carregada continua pendente. Nenhum contato real foi usado.

## 2026-11-03 - v3.255.0 - Estado anterior - "o fluxo faria", sem a rodada agir

> **Esta e a entrada de passagem de contexto.** Se a versao do `manifest.json` for maior que
> **3.255.0**, ela envelheceu: confira antes de confiar e **reescreva-a**, nao acrescente uma
> segunda.

### O QUE VOCE PRECISA FAZER

1. `chrome://extensions` -> **recarregar** a extensao
2. **F5** na aba do mobiliza.me
3. Confira **3.255.0** na linha pequena do topo do painel
4. Abra uma conversa: no cabecalho, logo abaixo de "Primeiro contato", aparece
   **"O fluxo faria: ..."**. E a decisao que a rodada tomaria para aquele contato — **sem a
   rodada rodar, sem gravar, sem enviar e sem chamar a IA**

### Revisao da continuacao (Codex)

A previsao agora inclui o fechamento por cortesia antes de devolver a decisao, mostra o motivo
legivel da regra e informa os pulos antecipados. Canal removido respeita tambem o modo automatico.
Falhas na simulacao nao fecham dialogos da plataforma. A linha nao promete IA quando desligada e
avisa que a remocao configurada de etiquetas pode mudar a decisao (a previa usa as atuais).
Teste executavel reproduz a troca de mensagem do momento por conclusao por cortesia, sem log.
Validacao: 42 suites passaram e sintaxe do painel conferida. A suite page-mob agora normaliza
CRLF ao ler o painel: nove falhas eram ancoras de texto dependentes de LF no Windows.
Validacao local; a exibicao na extensao carregada ainda precisa ser conferida apos recarregar.

### O QUE MUDOU

Voce escolheu a linha do fluxo. O buraco que ela fecha e o que me pegou ontem: **a unica forma de
ler o que o fluxo decidiria era iniciar uma rodada de verdade, e a rodada age** — ela concluiu
cinco atendimentos enquanto eu media um caso. E todo diagnostico aqui comeca igual, medindo o
sinal e a ordem, entao esse primeiro passo custava uma rodada em producao.

**A previsao e a MESMA funcao que decide, parada antes de agir.** Nao e uma funcao nova: medi, e
**28 valores atravessam** a fronteira entre o que `processarRespondido` calcula e a decisao, ao
longo de 900 linhas. Remonta-los noutro lugar seria a armadilha de 14/10 — a copia divergiria da
rodada na primeira regra nova, **em silencio**, e a linha passaria a mentir justamente quando voce
fosse confiar nela.

**O que `simular` desliga sao sete pontos, e medi que so eles agem** antes da decisao: a remocao
de etiquetas, as duas conclusoes, as duas caixas de pergunta, as duas marcas de etiqueta e as
linhas do Andamento. Mais o `load()`, porque o contato ja esta carregado — quem simula e a tela
que voce esta vendo.

**A linha para depois do ajuste do anuncio e antes da IA.** O anuncio ainda pode TROCAR o
desfecho, entao parar antes mostraria a primeira decisao e nao a que sairia; e dali para baixo a
funcao pode chamar a IA, que e dinheiro por clique. A linha diz *que* o caso iria para a IA —
quem decide pagar continua sendo voce, no botao.

**E um efeito colateral quase passou:** `sugerirAcaoComFluxo` **conta vitorias e grava**. A
previsao roda em todo contato que voce abre, entao contando ela **dobraria** essa medicao contra
as rodadas de verdade e escreveria no armazenamento a cada conversa aberta.

### O QUE NAO MUDOU

**Sem `simular`, o comportamento de `processarRespondido` foi preservado** — a rodada de verdade nao mudou
em nada. Nenhuma trava afrouxou. Regua 0,9. Modo Normal. Conferencia do canal desligada. Modo "Eu
mando" ligado. Fecho por cortesia ligado. O quadro nao foi tocado.

### O QUE CONTINUA ABERTO

Da lista que eu te dei, ficaram as outras duas que eu recomendei — **o dossie por secao** (ele e
um terco do prompt: 8.671 tokens de 25.255) e **o teste do `data-fica`** (33 dos 68 avisos do
painel podem sumir atras do "detalhes"). E as de antes: o aviso de etiqueta que **nega existencia
a partir de uma amostra** (`⛔ 2 Sem Retorno` existe no CRM, eu li), o rascunho descartado quando a
IA se abstem no botao manual, a janelinha da rodada que some ao parar, a tecla 4 em vez do
silencio sem momento, e o convite pessoal sem detector.

Prova: tirando a guarda da remocao, a do log do anuncio e o `contar`, caem 3 assercoes em
`tests/previsao-do-fluxo.test.mjs` (suite nova, a 42a). O teste conta os sete nomes que agem antes
da decisao — escrita nova ali quebra a contagem.

## 2026-11-03 - v3.254.0 - o Esc nao parava a rodada onde ele mais serve

### O QUE VOCE PRECISA FAZER

1. **Troque o texto da mensagem do momento.** O salvo continua sendo o de **domingo, 01/11**, e
   enquanto ele estiver ai a **tecla 5 nao sai para ninguem**. Cartao "Mensagem do momento
   (tecla 5)", aba **Automatizado**
2. `chrome://extensions` -> **recarregar** a extensao
3. **F5** na aba do mobiliza.me
4. Confira **3.254.0** na linha pequena do topo do painel
5. **Decida sobre a imagem junto da mensagem do momento.** As duas caixas "mandar junto" estao
   LIGADAS e aqui a arte **nao sai** — agora o cartao diz isso onde voce liga a caixa. Para o
   Andamento parar de escrever "a imagem nao saiu" a cada envio, desmarque "mandar junto". Eu nao
   desmarquei: ligar e desligar o que sai para eleitor e sua decisao

### O QUE MUDOU

**O Esc nao parava a rodada com o foco no campo da conversa** — a sua medicao de ontem
(*"o Parar e o Esc nao encerram a espera de 'responda a mao'"*). O ■ exige ponteiro de verdade e
funcionava; o Esc, nao.

A causa era uma guarda minha, copiada de onde ela faz sentido para onde ela nao faz.
`ehCampoDeTexto` existe para nao roubar tecla de quem esta **digitando** — e ela que impede o "2"
digitado na conversa de virar a tecla Pular —, e os **dois** escutadores de Esc a consultavam antes
de olhar a tecla. **O Escape nao digita nada**, entao ali ela nao protegia de nada.

E o preco era o atalho morrer exatamente onde ele serve: nas duas esperas longas o painel sai da
frente e **o foco vive no campo da conversa**, que e onde voce le e responde; a caixa da pergunta
ja fechou, entao nao ha outro Esc escutando. O que sobrava era achar e clicar o ■.

O recorte ja estava decidido neste projeto, no painel do Facebook (21/10): *"passam so as setas e o
Escape; os DIGITOS continuam barrados"*. **Nada afrouxou** — `defaultPrevented`, `isTrusted` (a
propria extensao dispara Esc em toda passada que envia) e "so enquanto a rodada anda" continuam. E
parar sem querer custa um ▶: a janelinha fica dizendo PARADA, o log diz "pelo Esc" e quem ja foi
tratado nao recebe duas vezes.

**E o cartao da imagem ficava calado justo onde voce liga a caixa.** O aviso perguntava se falta
contrato aprendido — e o contrato **esta** la, aprendido no mobiliza.app em 20/09 —, entao ele se
calava, enquanto `page-mob.enviarImagem` recusa e a rodada escreve "a imagem nao saiu" a cada
envio. **Contrato aprendido nao e contrato que serve aqui**, e a pergunta certa e a da plataforma,
pelo mesmo mecanismo do aviso de modelo aprovado. Junto, a linha do "envio aprendido" parou de
pedir *"me avise para eu ligar o envio automatico"*, que esta ligado desde 20/09.

### O QUE EU MEDI E NAO MEXI

**Por que o prompt triplicou: foi o DOSSIE.** Voce mediu 26.175 tokens de entrada; a conta fecha.
```
arquivo gabinete.md ............. 41.702 chars   (eram 13.184 em 07/09)
o que de fato vai no prompt ..... 31.217 chars  ~8.671 tok
sistema do rascunho SEM dossie .. 48.894 chars ~13.582 tok
sistema do rascunho COM dossie .. 90.918 chars ~25.255 tok
maior secao: "O que o mandato FEZ" 12.506 chars ~3.474 tok
```
Ou seja: **o dossie e um terco do prompt**, e ele so entra nas conversas que o puxam
(`precisaDoDossie`). **Nao cortei nada**: e pesquisa sua, marcada linha a linha, e o que sair de la
a IA deixa de saber. Se quiser cortar, a maior peca unica e a secao das emendas e projetos.

**O "SEM CACHE" de uma chamada so NAO prova defeito**, e e honesto dizer isso: na OpenAI o cache e
automatico e **o primeiro pedido de um prefixo novo nunca tem cache para ler**. O que provaria e
duas chamadas seguidas, as duas com cache zero. O que eu achei de errado foi a **prosa**: tres
comentarios do projeto ainda diziam que o prompt tem ~1.300 tokens (29/08) e que o Haiku nunca
cacheia — com 13.582 sem dossie, ele passa dos 4.096 e "SEM CACHE em chamadas seguidas" voltou a
ser alarme de verdade. Os numeros foram remedidos em `ia.js` e `gabinete.js`.

### O QUE NAO MUDOU

Nenhuma trava afrouxou. Regua 0,9. Modo Normal. Conferencia do canal desligada. Modo "Eu mando"
ligado. Fecho por cortesia ligado. O quadro nao foi tocado. Nenhuma mensagem foi enviada e nenhum
atendimento concluido ou assumido.

### O QUE CONTINUA ABERTO, E E SUA DECISAO

- **as duas melhorias de fluxo/IA medidas e nao implementadas**, as mesmas de ontem: sem momento
  disponivel, quem nao tem cadastro ir para a **tecla 4** em vez do silencio (medido: 6 de 6
  cairam em "concluir sem enviar", inclusive gente sem cidade que escreveu no dia); e **convite
  pessoal** ("tomar um cafe") nao tem detector nem resposta — a IA ignorou um;
- `1 TESTE DISPARO` e `2 Sem Retorno` nao foram achadas no CRM na lista "Etiquetas que a rodada
  REMOVE" — pode ser grafia, pode ser a amostra de 0,9% do catalogo;
- cortar o dossie, com os numeros acima na mesa.

Prova: reintroduzindo as duas guardas do Esc caem 2 assercoes em `tests/parar-rodada.test.mjs`
(suite nova, a 41a); `imagemRecusadaAqui = false` ou a frase velha do envio aprendido derrubam 2
em `tests/page-mob.test.mjs`.

## 2026-11-03 - v3.253.0 - no modo "Eu mando" o rodizio nunca andava

### O QUE VOCE PRECISA FAZER

1. **Troque o texto da mensagem do momento** (o salvo e de domingo, 01/11). Enquanto ele
   estiver ai a tecla 5 nao sai para ninguem. Cartao "Mensagem do momento (tecla 5)", aba
   Automatizado
2. `chrome://extensions` -> **recarregar** a extensao
3. **F5** na aba do mobiliza.me
4. Confira **3.253.0** na linha pequena do topo do painel

### O QUE MUDOU

Relato dele: *"a mensagem do momento nao esta variando"*. **Estava certo, e era maior que a
variacao.**

`avancarVariante` e `markSent` moram depois do `page.sendText`, e o ramo do modo **"Eu mando"**
devolve `true` antes de chegar la. E o buraco de 02/10 (*"colar nao e enviar, e marca que mora
depois do `page.sendText` nao acontece em metade dos envios"*) **na metade em que o envio
ACONTECEU**: quem apertou Enter foi ele, a mensagem foi para o eleitor, e o painel nao anotou
nada.

Duas consequencias, desde 28/10, no modo que ele usa:

1. **o rodizio nunca andava** — toda resposta pronta com variacoes saiu sempre com o MESMO
   texto, contato apos contato. O comentario que monta o momento na rodada dizia *"mesmo
   mecanismo das respostas prontas: `sendTemplate` reveza sozinho"*, verdade ate 28/10. E
   variar nao e cosmetica: em 26/09 ele derrubou um numero mandando a mesma mensagem em
   sequencia para menos de dez pessoas;
2. **`momentoJaEnviado` nunca ficava verdadeiro**, porque ele e `wasSent(contato, momento.id)`.
   A guarda que impede a mesma pessoa de receber a mensagem do momento duas vezes — o caso da
   Carmem Souza, 03/09 — estava desligada.

O ramo de **so inserir** continua sem anotar nada, de proposito: la o texto so foi para o
campo. Aqui ele saiu, e quem prova e o ato dele que `esperarVoceEnviar` esperou.

As ETIQUETAS continuam de fora, como a decisao de 02/10 deixou.

### O QUE NAO MUDOU

Regua 0,9. Modo Normal. Conferencia do canal desligada. Modo "Eu mando" ligado. Fecho por
cortesia ligado. O quadro nao foi tocado.

### O QUE FICOU NO CLAUDE.md (para a proxima sessao)

As TRES armadilhas de hoje entraram na secao "Armadilhas do proprio painel", no topo: o rodizio
que nunca andou no modo "Eu mando" (com a guarda do momento desligada junto), o veredito contando
linha de servico como contato pulado, e o aviso de estado sem `data-fica` sumindo atras do
"ⓘ detalhes". O comando de testes de la foi corrigido: eram 30 nomes com 39 suites no diretorio, e
hoje sao as 40.

**O que NAO esta no CLAUDE.md e continua aberto, por decisao sua:**

- a imagem junto da mensagem do momento esta LIGADA e nao pode sair aqui (envio aprendido e da
  plataforma antiga; `page-mob.enviarImagem` recusa — cai para texto e registra "a imagem NAO saiu");
- `1 TESTE DISPARO` e `2 Sem Retorno` nao foram achadas no CRM na lista "Etiquetas que a rodada
  REMOVE" — pode ser grafia, pode ser a amostra de 0,9% do catalogo;
- as duas melhorias de fluxo/IA medidas e NAO implementadas: sem momento disponivel, quem nao tem
  cadastro devia ir para a tecla 4 em vez do silencio; e convite pessoal ("tomar um cafe") nao tem
  detector nem resposta — a IA ignorou um.

Prova: tirar as duas linhas do ramo derruba 2 assercoes em `tests/templates.test.mjs`.

## 2026-11-03 - v3.252.0 - o veredito contava a IA como contato pulado

### O QUE VOCE PRECISA FAZER

1. **Troque o texto da mensagem do momento.** O salvo e de **domingo, 01/11**. Enquanto ele
   estiver ai a **tecla 5 nao sai para ninguem**. Medido numa rodada real das Minhas: **6 de 6
   contatos** cairam em "concluir sem enviar", incluindo gente **sem cidade e sem etiqueta que
   escreveu hoje**. O campo esta na aba **Automatizado**, cartao "Mensagem do momento (tecla 5)"
2. `chrome://extensions` -> **recarregar** a extensao
3. **F5** na aba do mobiliza.me
4. Confira **3.252.0** na linha pequena do topo do painel (`encaixado na aba`)
5. **Decida sobre a imagem junto da mensagem do momento.** As duas caixas estao ligadas e o
   envio aprendido e da plataforma ANTIGA (`api.mobiliza.app`, 20/09): aqui
   `page-mob.enviarImagem` recusa. Nao quebra a rodada (cai para texto), mas registra
   "a imagem NAO saiu" a cada envio

### O QUE MUDOU

**O veredito da rodada contava linha de SERVICO como contato pulado.** Medido: *"0 enviado(s),
**14** pulado(s)"* numa rodada com **cinco** contatos pulados no Andamento — e antes disso
*"2 pulado(s)"* numa rodada de um contato so. Sempre o dobro.

A causa e que `resultado: 'pulado'` virou o rotulo generico de linha informativa: o custo de
cada chamada da IA, o aviso do keepalive, o status do canal, o "carreguei mais da fila" e o
proprio botao Parar entram no log com ele, e `conta('pulado')` contava tudo como gente. Os
cinco contatos mais nove linhas de servico davam exatamente 14.

Isso importa porque o veredito e justamente a linha que deveria distinguir *"a rodada
trabalhou"* de *"a rodada nao conseguiu fazer nada"* (25/09) — inflado, ele deixa de
distinguir, e dobra sozinho em toda rodada que usa a IA.

Agora ha `NOMES_DE_SERVICO` e o veredito conta so contato. **O teste e que impede a lista de
envelhecer:** ele varre os nomes fixos de `registrarNaRodada` no proprio `panel.js` e exige
que cada um esteja na lista — e ja achou tres que eu tinha perdido (`aba`, `rede`, `sonda`),
dois deles contando como pulado.

**E o comando de testes do CLAUDE.md listava 30 suites com 39 no diretorio.** As nove de fora
(`corrente`, `desabafo`, `fechamento-cortesia`, `memoria`, `modos`, `momento-desatualizado`,
`momento-no-gesto`, `orgaos`, `rascunho-vazio`) nunca rodavam por aquele comando. Agora sao as
40, com o laco do Git Bash do lado para nao depender da lista.

### O QUE EU MEDI NA SUA TELA (nao mexi em nada disso)

- **O fluxo esta sendo decidido pelo momento vencido.** 6 de 6 na tecla 3. Quando
  `podeMandarMomento` e falso, `contexto-de-outro-dia` e `ultima-e-so-reacao` caem em
  "concluir sem enviar" — inclusive para quem nunca foi perguntado o nome. **Decisao sua:**
  nesse caso o desfecho mais util seria a tecla 4 (pedir dados) para quem nao tem cadastro,
  em vez do silencio
- **O rascunho da IA num apoiador:** ela mandou uma mensagem longa e calorosa com sugestoes
  sobre jovens e trabalho, e **convidou o Capitao para um cafe**. O rascunho (a) abriu
  qualificando a ideia dela com ressalva legal ("qualquer medida precisa respeitar a idade
  minima legal, as regras de protecao ao trabalho") — que e dar licao de moral em apoiador, o
  caso de 25/09 por outra porta — e (b) **ignorou o convite**, que era a coisa mais humana da
  mensagem. Nao ha regra cobrindo convite pessoal
- **O rascunho custou US$ 0,0064 com entrada de 26.175 tokens e SEM CACHE.** O prompt era de
  ~8.400 tokens em 25/09: triplicou. "SEM CACHE" numa chamada dessas e dinheiro recorrente
- **O Parar e o Esc nao encerram a espera de "responda a mao"** quando a caixa ja fechou. O ■
  exige clique de verdade (`isTrusted` + `detail !== 0`, guarda de 29/10) e funciona; o Esc do
  controle flutuante nao pegou

### O QUE NAO MUDOU

Nenhuma trava afrouxou. Regua 0,9. Modo Normal. Conferencia do canal desligada. Modo "Eu
mando" ligado. Fecho por cortesia ligado. O quadro nao foi tocado. Nenhuma mensagem foi
enviada, nenhum atendimento concluido ou assumido no teste.

Prova: tirar o filtro do `conta` derruba 1 assercao; tirar "IA" da lista derruba 2.

## 2026-11-03 - v3.251.0 - o aviso da mensagem do momento estava escondido

### O QUE VOCE PRECISA FAZER

1. **Troque o texto da mensagem do momento.** O que esta salvo e de **domingo, 01/11**
   ("Que este domingo seja abencoado... Hoje comeca novembro"). Enquanto ele estiver ai, a
   **tecla 5 nao sai para ninguem** e os casos caem em "concluir sem enviar". O campo esta na
   aba **Automatizado**, cartao "Mensagem do momento (tecla 5)"
2. `chrome://extensions` -> **recarregar** a extensao
3. **F5** na aba do mobiliza.me
4. Confira **3.251.0** na linha pequena do topo do painel (`encaixado na aba`)
5. Confira a lista do cartao "Etiquetas que a rodada REMOVE": `1 TESTE DISPARO` e
   `2 Sem Retorno` nao foram achadas no CRM. **Pode ser grafia, pode ser a amostra** (aqui o
   catalogo de etiquetas e 1.000 contatos de ~108.000, entao ele nao prova que a etiqueta nao
   existe). Nao mexi nisso
6. O canal estava **desconectado** na plataforma no dia do teste

### O QUE MUDOU

Rodei a extensao na plataforma, sem mandar mensagem, e os erros que apareceram foram de TELA,
nao de codigo: nenhum erro de JavaScript no console.

**O aviso de que a mensagem do momento venceu estava escondido atras do "ⓘ detalhes".** Ele
nasce como `.wf-hint`, e `encolherExplicacoes` recolhe toda explicacao de mais de uma linha
que nao esteja marcada com `data-fica`. Medido nos dois sentidos: com o cartao fechado o texto
nao aparece; clicando os detalhes, aparece. A regra de 10/09 ja dizia que DADO ou AVISO de
estado marca `data-fica` — este nao marcava, e e o aviso mais caro do cartao, porque enquanto
ele esta escondido a tecla 5 nao sai e a unica pista mora no Andamento, que so aparece depois
de comecar uma rodada.

**E ele mandava para a aba errada.** O texto dizia "atualize em Config", e `renderCartaoMomento`
so e chamado por `renderAutomatizado`: a Config nao tem nem o campo nem o aviso. Agora ele
nomeia o cartao, que existe num lugar so.

**As travas citavam um controle que nao existe mais com aquele nome.** Na aba Respostas o botao
da tecla 4 desabilitava dizendo *"Precisa do 'Enviar automatico' ligado (aba Config)"* — o
controle hoje e o box **"Quem manda a mensagem"**, com "Eu mando" e "A extensao manda sozinha",
e vive no topo do Automatizado e na Config. Sao sete textos de tela mais tres comentarios. A
licao de 28/10 (ao trocar o nome de uma coisa na tela, grep pelo nome ANTIGO) vale tambem para
as travas.

### O QUE NAO MUDOU

**Nenhuma trava afrouxou.** A da tecla 4 continua certa fora da rodada: ali `esperarVoceEnviar`
nao espera (ele clicou em Inserir, o texto esta la), entao concluir fecharia sem a pergunta ter
saido. O que mudou foi o NOME e o ENDERECO.

Regua 0,9. Modo Normal. Conferencia do canal desligada. Modo "Eu mando" ligado. Fecho por
cortesia ligado. Boas-vindas em tom neutro. A ordem dos cartoes nao mudou. O quadro nao foi
tocado.

### O QUE FICOU EM ABERTO

- **A imagem junto da mensagem do momento esta LIGADA e nao pode funcionar aqui.** O envio
  aprendido e de `api.mobiliza.app` (20/09) e `page-mob.enviarImagem` recusa. Nao quebra a
  rodada (cai para texto), mas registra "a imagem NAO saiu" a cada envio. Lido no codigo, nao
  medido ao vivo — medir exigiria mandar imagem para alguem
- **O veredito nao bate com o log:** "0 enviado(s), 2 pulado(s)" com uma linha de contato so.
  Nao diagnosticado
- **As rodadas dos Novos, Outros, Reabrir e do Disparo abrem `confirm()` nativo**, e por isso
  nao da para roda-las daqui. A das Minhas nao tem confirm e foi a que rodou

Prova: tirar o `data-fica` derruba 1 assercao; voltar "atualize em Config" derruba 3; voltar
o nome velho da trava derruba 2.

## 2026-10-31 - v3.250.0 - o clique da aba Novos nao achava o botao

### O QUE VOCE PRECISA FAZER

1. `chrome://extensions` -> **recarregar** a extensao
2. **F5** na aba do mobiliza.me (o gancho da pagina so troca no F5)
3. Confira **3.250.0** na linha pequena do topo do painel (`encaixado na aba`)
4. Comecar pelos Novos deve deixar a aba **Novos** verde. Se nao achar o botao, a rodada
   para e diz, em vez de seguir em Todas

### O QUE MUDOU

A 3.249 pedia a aba Novos, e o clique nao achava o botao. O texto medido na tela e
`Novos78`, o numero colado no nome, e o codigo so aceitava `Novos 78` com espaco. O clique
voltava que a aba nao existia, e a rodada abria quem ja estava desenhado em Todas. Agora o
espaco e opcional. Se a aba nao for achada, a rodada para.

### O QUE NAO MUDOU

A consulta continua sendo as conversas abertas. Minhas continua sendo a fila que ele ja
assumiu. Regua 0,9. Modo Normal. Conferencia do canal desligada. Envio automatico
desligado. Boas-vindas em tom neutro.

Prova: exigir o espaco de novo derruba 2 assercoes, uma no dom-mob e uma na copia do gancho.

## 2026-10-31 - v3.249.0 - a rodada dos novos abre a aba Novos

### O QUE VOCE PRECISA FAZER

1. `chrome://extensions` -> **recarregar** a extensao
2. **F5** na aba do mobiliza.me
3. Confira **3.249.0** na linha pequena do topo do painel (`encaixado na aba`)
4. Na aba Automatizado o botao agora e **Comecar pelos Novos**. A rodada clica a aba Novos
   da plataforma antes do primeiro contato. Nao aperte Comecar por ele
5. Se o campo deste atendimento ainda tiver o "Seja bem-vindo" antigo, apague. Nao de Enter

### O QUE MUDOU

A tela da plataforma voltou a ter a aba Novos (ao lado de Minhas e Todas). O botao do painel
ainda dizia "nao atendidas" e a rodada abria Todas, porque o mapa de 28/10 mandava a fila
aberta para la. Agora o botao diz Novos e o primeiro da fila troca a lista para essa aba
antes de abrir. A consulta continua sendo as conversas abertas que ninguem assumiu.

### O QUE NAO MUDOU

Regua 0,9. Modo Normal. Conferencia do canal desligada. Importacao continua nao
contando como retorno. Envio automatico continua desligado. Fecho por cortesia
continua ligado. Boas-vindas continuam em tom neutro. Minhas continua sendo a fila
que ele ja assumiu. A ordem dos cartoes nao mudou.

Prova: o mapa `Novos: 'Todas'` de volta derruba 1 assercao (`pediu a aba Novos ao gancho (Todas)`).

## 2026-10-31 - v3.248.0 - boas-vindas em tom neutro

### O QUE VOCE PRECISA FAZER

1. `chrome://extensions` -> **recarregar** a extensao
2. **F5** na aba do mobiliza.me
3. Confira **3.248.0** na linha pequena do topo do painel (`encaixado na aba`)
4. Apague o texto que ja esta no campo deste atendimento. E o "Seja bem-vindo" antigo.
   Nao de Enter por cima dele

### O QUE MUDOU

As boas-vindas saiam "Seja bem-vindo" e "atende-lo" quando o nome nao decidia o genero.
Agora a saudacao e "Que bom ter voce aqui!" e o pedido e "para eu atender melhor".
"Boa noite" continua na frente. O formulario Nome, Cidade continua para quem ainda nao
tem cadastro. O texto que ja estava gravado no navegador e reescrito na hora de enviar.

### O QUE NAO MUDOU

Regua 0,9. Modo Normal. Conferencia do canal desligada. Importacao continua nao
contando como retorno. Envio automatico continua desligado. Fecho por cortesia
continua ligado. Mensagem do momento de outro dia continua travada. "todo mundo e
bem-vindo" em outras respostas nao muda.

Prova: `saudacaoNeutra` devolvendo o texto intacto derruba 6 assercoes.

## 2026-10-31 - v3.247.0 - momento de outro dia e desilusao

> **Esta e a entrada de passagem de contexto.** Se a versao do `manifest.json` for maior que
> **3.247.0**, ela envelheceu: confira antes de confiar e **reescreva-a**, nao acrescente uma
> segunda.

### O QUE VOCE PRECISA FAZER

1. `chrome://extensions` -> **recarregar** a extensao
2. **F5** na aba do mobiliza.me
3. Confira **3.247.0** na linha pequena do topo do painel (`encaixado na aba`)
4. Abra a aba Automatizado. Se a mensagem do momento ainda fala de quinta-feira ou de 29 de
   outubro, o cartao avisa em vermelho. Atualize o texto. Enquanto estiver vencido, a rodada
   nao manda a tecla 5
5. Apague o texto que ja estiver no campo deste atendimento. Nao de Enter por cima dele

### O QUE MUDOU

Num sabado a rodada colocou no campo o texto salvo de quinta-feira, 29 de outubro. A tecla 5
so olhava variavel faltando. Agora um dia da semana em tom de saudacao, ou uma data que ja
passou, trava a tecla, avisa na Config e no comeco da rodada. Convite futuro ("2 de novembro",
"domingo tem encontro") continua valendo.

Quem escreveu que nao acredita mais no Brasil caia como denuncia: "estamos atentos", ou a IA
se abstinha e o fallback mandava a mensagem do momento — a segunda do dia, depois de um texto
nosso das 14:04. Agora e desabafo: tecla 6, resposta calorosa, sem formulario e sem abstencao.
Se ja falamos hoje e ela respondeu com conteudo, a mensagem do momento nao sai de novo.

### O QUE NAO MUDOU

Regua 0,9. Modo Normal. Concordancia do tratamento. Conferencia do canal desligada.
Importacao continua nao contando como retorno. Envio automatico continua desligado.
Fecho por cortesia continua ligado. Emoji na primeira visita continua na mensagem do
momento, se o texto dela for de hoje. "Boa tarde" na primeira visita continua nas
boas-vindas. A rodada continua sendo uma passada.

Prova: `datasForaDeHoje` devolvendo null derruba 10 assercoes. Desligar o ramo politico
derruba 13.

## 2026-10-31 - v3.246.0 - quem so agradeceu depois da nossa e concluido

> **Esta e a entrada de passagem de contexto.** Se a versao do `manifest.json` for maior que
> **3.246.0**, ela envelheceu: confira antes de confiar e **reescreva-a**, nao acrescente uma
> segunda.

### O QUE VOCE PRECISA FAZER

1. `chrome://extensions` -> **recarregar** a extensao
2. **F5** na aba do mobiliza.me
3. Confira **3.246.0** na linha pequena do topo do painel (`encaixado na aba`)
4. Na aba Automatizado, a caixa nova nasce marcada: "Concluir sozinho quem so agradeceu ou
   retribuiu depois da nossa resposta (sem mandar nada)"
5. Na proxima rodada, "Gratidao", "Boa tarde obrigado igualmente", "valeu, tmj" e um emoji
   de volta, depois da nossa e dentro do limite de horas, sao assumidos e resolvidos sem
   mensagem. "Boa tarde" sozinho, no dia seguinte e ainda dentro dessa janela, tambem.
   Na primeira visita, "Boa tarde" continua nas boas-vindas

### O QUE MUDOU

Quem so retribuiu depois da mensagem do momento ficava aberto. No mesmo dia a rodada as
vezes concluia por acaso. No dia seguinte, com mensagem do momento nova, mandava de novo.
A guarda troca essa decisao pela tecla 3, antes de chamar a IA. Pergunta, pedido, desabafo,
audio e link nao fecham. A caixa desmarcada desliga.

A falha ao resolver deixou de sair como "mas undefined".

### O QUE NAO MUDOU

Regua 0,9. Modo Normal. Concordancia do tratamento. Conferencia do canal desligada.
Importacao continua nao contando como retorno. Envio automatico continua desligado.
Emoji na primeira visita continua na mensagem do momento. Desabafo continua na tecla 6.
A rodada continua sendo uma passada: quem responde depois dela fica para a proxima.

Prova: `cortesiaDeFechamento` devolvendo null derruba 18 assercoes.

## 2026-10-31 - v3.245.0 - desabafo e emoji na mensagem do momento

> **Esta e a entrada de passagem de contexto.** Se a versao do `manifest.json` for maior que
> **3.245.0**, ela envelheceu: confira antes de confiar e **reescreva-a**, nao acrescente uma
> segunda.

### O QUE VOCE PRECISA FAZER

1. `chrome://extensions` -> **recarregar** a extensao
2. **F5** na aba do mobiliza.me
3. Confira **3.245.0** na linha pequena do topo do painel (`encaixado na aba`)
4. Apague o texto que ja estiver no campo deste atendimento. Nao de Enter por cima dele
5. Primeira visita so com emoji, figura ou sticker, e com a mensagem do momento preenchida:
   sai essa mensagem, nao as boas-vindas. "Boa tarde" continua recebendo as boas-vindas, agora
   em primeira pessoa ("Em que posso ajudar?", sem "equipe")
6. Briga na familia, sofrimento, raiva ou agressao vai para a tecla 6. Sem formulario, sem
   pergunta, e sem aula de 2027 quando a pergunta foi so o cargo. O 190 so entra se houve
   agressao, e no fim

### O QUE MUDOU

Dois casos da lista que a 3.244.0 nao cobria.

- O desabafo pessoal caia na IA como problema ou denuncia. "governador ou deputado" puxava o
  dossie e a resposta saia com secretaria, janeiro de 2027, a historia recontada e uma pergunta.
  Agora a tecla 6 recebe a linha do desabafo: calor, primeira pessoa, cargo em uma frase se ela
  perguntou, e o formulario fica de fora
- So emoji na chegada casava as boas-vindas, porque essa caixa fica acima da reacao. O quadro
  gravado nao recebe condicao nova sozinho, entao a mesma troca mora no codigo. Sem mensagem do
  momento configurada, as boas-vindas continuam. O texto gravado que ainda diz "equipe" e
  reescrito na migracao e de novo na hora de enviar

### O QUE NAO MUDOU

Regua 0,9. Modo Normal. Concordancia do tratamento. Conferencia do canal desligada.
Importacao continua nao contando como retorno. Envio automatico continua desligado.
`interesse-conteudo` continua na voz da equipe. Os tres achados que ficaram de fora na 3.244
continuam de fora.

Prova: `momentoNoGesto` devolvendo null derruba 3 assercoes, as do quadro gravado.

## 2026-10-31 - v3.244.0 - corrente, rascunho vazio e a chave do modelo

> **Esta e a entrada de passagem de contexto.** Se a versao do `manifest.json` for maior que
> **3.244.0**, ela envelheceu: confira antes de confiar e **reescreva-a**, nao acrescente uma
> segunda.

### O QUE VOCE PRECISA FAZER

1. `chrome://extensions` -> **recarregar** a extensao
2. **F5** na aba do mobiliza.me
3. Confira **3.244.0** na linha pequena do topo do painel (`encaixado na aba`)
4. Com so a chave da OpenAI e o rascunho no gpt-5.6-luna, "Chamar a IA" tem de estar ligado.
   O aviso, se a chave faltar, diz qual casa e qual modelo
5. Corrente ou denuncia repassada: a tecla 1 some. A tecla `c` agradece uma vez, sem pedir
   dados e sem concluir. A rodada nao aperta a `c` sozinha
6. Depois de "Chamar a IA", o texto fica na caixa do cartao. "Por no campo de novo" usa essa copia

### O QUE MUDOU

Cinco falhas da 3.243.0, a lista da v9:

- Corrente ja agradecida e um "E ai?" de novo: o modelo devolvia texto vazio com
  "nao ha o que responder", e a tela dizia so "a IA nao devolveu rascunho". A abstencao
  agora chega, e a regra pede uma frase neutra em vez de deixar o campo vazio
- Recusa do modelo aparece com o texto da recusa, nao com a frase generica
- "Chamar a IA", a tecla 8 e o rascunho usam a chave do modelo do rascunho. Cidade e
  etiquetas continuam na chave das conferencias
- A copia do rascunho no painel sobrevive ao redesenho
- Sem a IA, a corrente nao cai na tecla 1 (agradecimento com nome, modelo de conteudo e
  concluir). O formulario do rascunho tambem nao fecha corrente nem denuncia

### O QUE NAO MUDOU

Regua 0,9. Modo Normal. Concordancia do tratamento. Conferencia do canal desligada.
Importacao continua nao contando como retorno. Boas-vindas com cidade na ficha continua
sem pedir o cadastro. Nao religuei envio automatico.

Tres achados da lista ficaram de fora, de proposito: horario igual da rajada e da nossa
resposta, o botao manual jogar fora o texto quando a IA se abstem sem pergunta pendente,
e o botao manual nunca pedir o cadastro fora da rodada.

## 2026-10-31 - v3.243.0 - boas-vindas pedindo o que o cadastro ja tem

> **Esta e a entrada de passagem de contexto.** Se a versao do `manifest.json` for maior que
> **3.243.0**, ela envelheceu: confira antes de confiar e **reescreva-a**, nao acrescente uma
> segunda.

### O QUE VOCE PRECISA FAZER

1. `chrome://extensions` -> **recarregar** a extensao
2. **F5** na aba do mobiliza.me
3. Confira **3.243.0** na linha pequena do topo do painel (`encaixado na aba`)
4. Apague o texto que ficou no campo deste atendimento e siga a rodada. No proximo contato
   com cidade de municipio na ficha, as boas-vindas saem sem pedir nome e cidade

### O QUE MUDOU

A troca para o texto "ja temos o cadastro" escolhia outro modelo. O que esta salvo no
navegador e a redacao sua: se ela ainda pede nome e cidade, trocar o modelo nao muda a frase.
Na rodada, com a cidade da ficha sendo um municipio, essa frase sai antes de o texto ir para
o campo. A saudacao e o "em que podemos ajudar" ficam. Fora da rodada, o clique no cartao
continua mandando o texto que voce escolheu. Importacao continua nao contando como retorno:
a apresentacao sai, o pedido de dados e que nao.

### O QUE NAO MUDOU

Modo Normal, regua 0,9, concordancia do tratamento, conferencia do canal desligada.

## 2026-10-31 - v3.242.0 - modo Campanha ou Normal, e o dossie de orgaos

> **Esta e a entrada de passagem de contexto.** Se a versao do `manifest.json` for maior que
> **3.242.0**, ela envelheceu: confira antes de confiar e **reescreva-a**, nao acrescente uma
> segunda.

### O QUE VOCE PRECISA FAZER

1. `chrome://extensions` -> **recarregar** a extensao
2. **F5** na aba do mobiliza.me
3. Confira **3.242.0** na linha pequena do topo do painel (`encaixado na aba`)
4. Na aba Config, o primeiro cartao depois do candidato e **Modo: Campanha / Normal**.
   O padrao e Normal. Campanha volta o texto e o fluxo de anuncio de antes de 25/10

### O QUE MUDOU

Voce pediu o modo campanha e o modo normal, e o caminho certo quando o assunto e de outro
orgao. Em Normal a rodada nao trata clique de anuncio como chegada de campanha, "Dia 25" sai
da tira do Facebook, e "quer trabalhar na campanha" some da lista (o texto guardado continua
no editor). Pedido de telefone do governador, do prefeito ou de secretario vai para a IA, com
o contato oficial do orgao quando a conversa pede — so o que foi conferido na pagina do orgao.
O Gabinete do Governador de hoje e o do Eduardo Leite; Zucco assume em 06/01/2027.

A frase de repasse, quando o assunto e nosso, e "passo para o responsavel pela agenda" com o
nome do perfil. "nossa equipe" e trocada por essa frase. Prometer que chega ao deputado, falar
de urgencia, ou misturar o contato do orgao com um repasse para o nosso lado, barra o envio
sozinho. No modo Eu mando o texto continua no campo para voce ler.

O resultado da Presidencia nao foi escrito em lugar nenhum. A IA nao afirma.

### O QUE NAO MUDOU

A regua continua em 0,9. O nome do cadastro continua concordando o tratamento, sem ser escrito.
Helena nao conta como prova de retorno. A conferencia do canal continua desligada.

## 2026-10-30 - v3.241.0 - o nome concorda o tratamento

> **Esta e a entrada de passagem de contexto.** Se a versao do `manifest.json` for maior que
> **3.241.0**, ela envelheceu: confira antes de confiar e **reescreva-a**, nao acrescente uma
> segunda.

### O QUE VOCE PRECISA FAZER

1. `chrome://extensions` -> **recarregar** a extensao
2. **F5** na aba do mobiliza.me
3. Confira **3.241.0** na linha pequena do topo do painel (`encaixado na aba`)
4. Abra de novo um contato cujo primeiro nome e de mulher. A boas-vindas tem de sair
   "bem-vinda" e "atende-la". O nome dela nao entra na mensagem

### O NOME DECIDE O GENERO, E NAO E ESCRITO

Voce: *"a plataforma tem o nome da pessoa e a resposta veio como bem-vindo, genero errado"*.

A regra de 06/09 mandava a IA ignorar o nome do cadastro para o genero. Ela obedeceu, e o
texto de fabrica das boas-vindas e masculino. Agora o primeiro nome, quando da para saber,
troca "bem-vindo" e "atende-lo" na hora em que o texto e montado — na resposta pronta e no
rascunho da IA. Sem certeza, o texto fica como esta. "todo mundo e bem-vindo" nao muda.

**A prova:** tirando a troca de dentro do `render`, caem 2 assercoes.

### HISTORICO DESTA DATA — v3.240.0, a eleicao acabou e o rascunho tem corte

1. As teclas 1, 2, 3 da conferencia continuam no ar. **1** e a mensagem do momento
2. A cidade ja grava. O cartao da plataforma so mostra o valor depois de fechar e abrir o contato

### O QUE MUDOU

A regra 19 ainda dizia que o 2o turno de 25/10 estava acontecendo. Ele ja foi. O rascunho nao
pede mais voto, nao trata oferta de evento como "o dia 25" e nao e barrado por dizer que a
eleicao acabou. A trava antiga continua valendo so para uma data anterior a 26/10, que e o que
os testes da print de 15/10 ainda exercitam.

O esquema do rascunho ja prometia "abaixo de 0,9 alguem le antes" e ninguem cobrava. Agora
cobra, no envio sozinho. O numero e 0,9, o mesmo da frase do esquema. Confianca que nao veio
tambem fica para leitura. No modo **Eu mando** isso nao muda a espera: o texto continua no
campo ate o Enter. Trava dura (promessa, marcador, afirmar que ja fizemos) continua barrando
os dois modos.

Quem ja recebeu mensagem nossa volta a ser tratado como conhecido mesmo se a conversa se
perder de novo. A chave e o telefone, daqui para a frente — nao recupera o historico de antes
da migracao. Etiqueta **Sem Retorno** e **Sem Interesse** tambem contam. Helena nao conta
(513 de 600, nao medido como atendimento). Importante nao conta. Importacao nunca conta.

### HISTORICO DESTA DATA — v3.239.0, a cidade voltou a gravar

Voce confirmou: a cidade estava gravada; o cartao da plataforma so atualizou depois de fechar
e abrir o contato. Nao use esse cartao para verificar.

### A CIDADE ERA RECONHECIDA E NAO ERA GRAVADA

Voce pediu: *"preciso que a funcao de identificar cidade e preencher volte a funcionar"*.

O reconhecimento nao tinha parado. Quem parou foi a **porta da gravacao**: o preenchimento
automatico, o botao Salvar e a propria escrita exigiam o contrato aprendido na plataforma
velha. Aqui nao ha contrato para aprender — a cidade e a coluna `cidade`, e a escrita ja
desviava para ela. Com a porta fechada, o palpite nascia e nada era perguntado nem gravado.

Agora as tres portas leem a mesma funcao. Na plataforma nova a gravacao esta liberada. Na
velha, o contrato continua obrigatorio. A regra de sempre fica: cidade de palpite **nao grava
sem a caixa** (ou sem a IA, quando ela esta ligada para isso).

**A prova:** tirando o desvio da plataforma nova, cai 1 assercao.

Voce confirmou no mesmo dia: a cidade gravou, e o cartao da plataforma so mostrou depois de
fechar e abrir o contato.

### AS TECLAS TROCAM O TEXTO E ENVIAM — e o resto nao mexe na rodada

Voce pediu: *"no modo automatizado onde ele para para eu conferir o texto crie uma popup que
tenha o numero 1, 2, 3 e a opcao de adicionar mais"*, e *"a opcao 1 deve ser a mensagem do
momento"*. No mesmo pedido: remover etiqueta e corrigir o contato **nao termina a rodada nem
faz acao nenhuma** ate o clique em enviar ou o Enter.

A tecla 1 le a mensagem do momento na hora (com a variacao que sairia na tecla 5). As outras
ficam em `atalhosDaConferencia`. Numero apertado **dentro de um campo do cadastro** e so um
numero. No campo de mensagem, o numero troca o rascunho e envia.

O clique deixou de ser "qualquer botao perto do campo". Etiqueta e salvar contato moram no
mesmo bloco da conversa, e a conta antiga de seis ancestrais tratava o X da etiqueta como o
aviao. Agora so conta botao na **altura do campo e a direita do texto**. Clique que nao
esvazia o campo nao pula nem conclui. O Enter continua sendo o outro gatilho.

**A prova:** reintroduzindo o clique por ancestral, cai a assercao da etiqueta. Reintroduzindo
o pulo quando o clique nao esvazia o campo, cai a outra. Uma cada.

### QUEM E CONTATO NOVO — ainda esperando a sua conferencia (v3.237.0)

### "NAO ESTA RECONHECENDO QUEM E CONTATO NOVO" — eram tres pernas, e duas estavam cegas

Voce escreveu: *"o fluxo nao esta reconhecendo quem e contato novo e quem nao e, veja o que esta
classificando como contato novo para ajustarmos"*.

Quem responde isso e **um sinal so** (`jaRespondemosAntes`), e e ele que escolhe o ramo da
**chegada** no quadro — a apresentacao e o recibo do anuncio. **Medido, perna por perna:**

```
temConversaAnterior   botao da tela velha      MORTA: o adaptador devolve false fixo — e esta certo
cidadeJaNoCrm         etiqueta pelo catalogo   CEGA: o catalogo aqui e 1.000 de 107.988 (0,93%)
state.nossas          mensagens nossas         deixou de provar: o historico se perdeu na migracao
```

**A perna da etiqueta era a armadilha do ASSESSOR na pior posicao possivel.** As duas metades dela
passam pelo catalogo, e aqui o catalogo e uma **amostra de 0,93%**: a etiqueta de cidade que nao
caiu nessa fatia nao entra, e o sinal fica falso **em silencio**. A pessoa se apresenta de novo —
e a print da Rosa (05/09) voltando por outra porta. O teste que trava aquela armadilha nao pegava
esta, porque ele procura a FORMA do defeito dentro do `panel.js`, e esta mora no `tags.js`.

### AS SUAS DUAS CORRECOES MUDARAM A CONTA

*"Nao existe conversa anterior mais porque e plataforma nova e historico de conversas se perdeu,
mas cidades ainda existem na descricao do contato."*

A primeira metade **mata a terceira perna como prova**: a conversa aqui comeca na troca de
plataforma, entao quem voce atendeu por meses no mobiliza.app chega com a conversa vazia e passa
por contato novo. A segunda metade diz o que sobreviveu: **o cadastro**.

**Agora sao duas pernas novas:**

- **a ETIQUETA de cidade lida do CONTATO**, nao do catalogo — e **aditiva**, as duas antigas
  ficaram, entao o mobiliza.app nao muda em nada
- **o CAMPO Cidade do cadastro**, que e a sua decisao. Exige confianca **exata** (o mesmo corte do
  formulario, de ontem): o campo e livre, e esta extensao ja gravou `vt.tiktok.com` nele

### A GUARDA DA IMPORTACAO, E POR QUE ELA NAO ERA OPCIONAL

Ontem eu medi e escrevi no CLAUDE.md que **cidade de importacao nao responde "ela ja veio
antes?"**: sao **132 contatos** que entraram em lote com o campo preenchido e com quem ninguem
falou. Sem guarda, eles passariam por gente ja atendida e **perderiam a apresentacao**, que e
justamente o que eles precisam.

Entao `origem` passou a atravessar o adaptador (medido na base: `helena 513 | mocao 188 |
importacao 132 | evento 48 | manual 10 | app_mobile 7 | formulario 2`, em 600 contatos), e a
perna do campo **nao conta para `importacao`**. **Vazio e desconhecido, nunca "importado".**

**O custo e o de 05/09 e e real:** contato com cidade no cadastro, conversando pela primeira vez,
recebe a mensagem do momento em vez das boas-vindas.

**O que eu NAO medi:** quantos contatos da sua base viram de lado. Isso exige consultar a base na
sua aba — se deixar a plataforma aberta, eu meco.

**A prova:** reintroduzindo os tres defeitos (a perna da etiqueta, a guarda da importacao e o
`origem` no adaptador), **caem 6 assercoes**.

### O ANUNCIO DE HOJE DO ZUCCO ENTROU NO DOSSIE

Pedido seu: *"atualize o dossie com o anuncio de hoje do zucco"*.

**O que eu achei e confirmei:** Zucco anunciou em **29/10/2026** o **Capitao Martim para a
Secretaria de Protecao e Defesa Civil**, e o governo toma posse em **06/01/2027**. Isso esta
`[CONFIRMADO]` porque veio de **cinco veiculos independentes** — Jornal do Comercio, Brasil de
Fato, SBNews RS, AgoraRS e Grupo A Hora. No mesmo dia sairam General Rogerio Siqueira (Obras),
Rafael Orozco (PGE) e Luis Carlos Heinze (projetos estrategicos); os cinco primeiros nomes foram
em 27/10.

**O que ficou `[CONFERIR]`, porque apareceu em UMA fonte so:** a prioridade que voce declarou
(ampliar a estrutura da defesa civil), a permanencia do **Cel. Boeira** na coordenacao e **a sua
vaga na Assembleia ir para a primeira suplente, Eliana Bayer**. Nesta ultima o que falta nao e a
fonte: e a **mecanica** — licenciar-se do mandato e renunciar sao coisas diferentes, com
consequencias diferentes para quem assume. A IA nao afirma nenhuma das tres.

### A COISA QUE MAIS IMPORTA: HOJE VOCE E DEPUTADO

O cargo foi **ANUNCIADO** e comeca em **janeiro**. Entao a IA diz *"foi anunciado"*, *"foi
indicado"* ou *"vai assumir em janeiro"* — e **nunca** *"ele e secretario"* nem *"ele esta na
Defesa Civil"*. E a familia do *"ja encaminhei seu pedido"* (06/09): afirmar como feito o que
ainda nao aconteceu, **num fato que o eleitor confere no jornal**. A secao do dossie se chama
ANUNCIADO de proposito, e ha teste travando isso.

**E a pasta cria uma classe de pedido NOVA.** A partir de hoje vai chegar gente pedindo emprego na
Defesa Civil, obra, vistoria, prioridade e socorro em enchente. O dossie escreveu as regras:

- **nenhuma promessa** de vaga, contratacao, estagio, indicacao, obra, verba, vistoria ou
  atendimento — a regra 12 e a Lei 9.504/97 nao mudaram, e o governo nem tomou posse
- **quem esta em emergencia AGORA** vai para a **Defesa Civil do municipio** e para **193** e
  **199**: a defesa civil estadual ainda e do governo atual, nao sua
- **quem parabeniza recebe agradecimento, e nada mais** — nao e gancho para falar de plano nem de
  estrutura, que nao estao decididos
- pergunta sobre o que voce vai fazer na pasta: **vou verificar**, sem inventar

### O GATILHO ERA OBRIGATORIO — TRES PERGUNTAS NAO PUXAVAM O DOSSIE

Fato novo no dossie sem gatilho e fato que a IA nunca le (a licao de 10/09). **Medido antes de
escrever**, de oito perguntas que este anuncio gera:

```
nao puxava:  "ele vai assumir a Defesa Civil?"
nao puxava:  "parabens pela secretaria!"
nao puxava:  "vi no jornal que ele foi nomeado, procede?"
```

Sem o arquivo no prompt a IA escreveria de cabeca sobre um cargo que voce ainda nao ocupa — o erro
do Van Hattem (08/09) num assunto novo. Depois do gatilho: **8 de 8 puxam**, e o ruido desta base
(*"Deus abencoe"*, *"quero o material"*, *"preciso de remedio"*) **continua nao puxando**.

**A prova:** tirando o gatilho, **caem 3 assercoes** — exatamente as tres perguntas acima.

### "SEMPRE QUE APERTO BACKSPACE A RODADA PARA" — o campo era o gatilho, e cada tecla sua o mudava

Voce escreveu: *"o gatilho continua errado, sempre que aperto a tecla de backspace a rodada para;
o gatilho e eu clicar em enviar ou apertar enter"*.

**Voce estava certo, e o numero e feio.** A espera testava se *"o texto continua no campo"* com
`includes` dos **vinte primeiros caracteres**. Medido com o texto de uma resposta pronta, de SETE
edicoes comuns **CINCO** derrubavam o teste:

```
true   intacto                        true   backspace no FIM
false  backspace no MEIO dos 20       false  backspace no COMECO
false  apagou uma palavra do comeco   false  trocou "Bom dia" por "Boa tarde"
false  selecionou tudo e apagou
```

E com o texto ja visto no campo, isso caia direto no ramo do *"voce apagou"*: **corrigir o
rascunho encerrava a espera**. Corrigir e exatamente o que este modo existe para voce fazer.

**Agora a espera olha SO O ATO** — o Enter no campo de mensagem ou o clique no botao ao lado,
os dois exigindo teclado/mouse de verdade. O texto pode ser apagado inteiro e digitado de novo:
**nada disso decide nada.** Quem encerra sem ato e o **Parar**, o **Esc** ou o teto de dez
minutos, e a barra agora diz isso: *"Se nao for enviar, aperte Parar."*

**O campo vazio nao saiu — virou CONFIRMACAO, depois do ato.** O ato diz que voce mandou; o campo
esvaziar diz que a plataforma aceitou (com 8s de folga, porque ela nao limpa a caixa no mesmo
instante). Dando Enter com o campo ainda cheio, **nao concluo** e digo por que — e o caso do
canal fora do ar, em que o Enter sai e a mensagem nao.

**A licao que ficou escrita:** campo de texto que VOCE edita nao serve como gatilho de nada — cada
tecla sua muda aquele valor, entao qualquer regra que compare o conteudo decide no meio da sua
digitacao. O que serve e o ATO, que acontece uma vez.

**A prova:** pondo de volta um caminho que olha o campo antes do ato, **cai 1 assercao**.


### SOBROU UMA PASTA SO — e a frase do CLAUDE.md sobre o OneDrive morreu

Voce escreveu: *"exclui as copias ficou so o atualizado"*.

Medido depois de voce apagar:

```
Documents\GitHub\WhatsFill+IA ......... manifest WhatsFill+IA 3.234.0, .git, .cursor/  <- a unica
Documents\GitHub\WhatsFill ............ nao existe mais
OneDrive\Documents\GitHub\WhatsFill ... so um .git, nada dentro (git ali recusa: "not a git repository")
```

**O risco das tres pastas acabou** — era a armadilha do *"o fix nao funcionou pode ser o fix nao
chegou"*. E o CLAUDE.md dizia *"o Chrome carrega de OneDrive/Documents/GitHub/WhatsFill"*: aquela
pasta esta vazia, entao a frase deixou de ser verdade e foi corrigida la. **Quem responde de onde
o Chrome carrega hoje e o "Carregado de" do `chrome://extensions`, e so voce le isso.**

As regras do Cursor (`.cursor/rules/`) estao na pasta certa: as duas de `alwaysApply: true` entram
em toda conversa sozinhas; `@medir`, `@consertar`, `@provar` e `@fechar` voce chama digitando.

### "ENCERRADA PREMATURAMENTE NOVAMENTE" — um contato virou erro da fila

Voce escreveu: *"rodada foi encerrada prematuramente novamente"*.

**Medido na barra, com a extensao ja na 3.233.0:** `1 enviado, 5 pulados, percorri 2 de 7.
Parei em <contato>: "Boas-vindas (ja temos o cadastro)" (ramo do fluxo) nao saiu`.

`sendTemplate` devolveu `false` (a mensagem daquele contato nao saiu) e o ramo do fluxo
transformou isso em `erro`. **`erro` encerra a rodada inteira** — os outros cinco nem abriram.
O rascunho da IA, no mesmo caso, ja pulava e seguia. Este caminho nao.

Agora os cinco retornos de "nao saiu" da rodada pulam o contato, escrevem o motivo de verdade
(variavel faltando, texto que nao apareceu, voce apagou) e abrem o proximo. So o botao Parar
encerra. Campo vazio **antes** de o texto ter aparecido nao conta mais como "voce apagou".

### "EU MANDEI A MENSAGEM E ENCERROU" — a leitura do ato estourava

Voce escreveu: *"rodada encerrando sem eu pedir, eu mandei a mensagem e encerrou era para
continuar pro proximo contato"*.

**Medido na barra, com a mensagem ja na conversa as 10:38 e o atendimento ainda aberto:**
`Parei em <contato>: page.ultimoAtoDeEnvio(...).catch is not a function`.
0 enviados, 2 pulados, 1 de 4 abertos. O prefixo "Parei em" so nasce quando o contato volta
`erro` — por isso a rodada parou em vez de seguir.

**A causa:** no modo "Eu mando", quando o campo esvazia, o painel pergunta se houve Enter ou
clique. Na aba encaixada essa funcao devolve o objeto na hora (`{em, como}`). O codigo chamava
`.catch` nesse objeto. Objeto nao tem `.catch`: TypeError, que sobe como erro e **encerra a
rodada inteira** — com o texto ja no WhatsApp. No modo janela a mesma funcao devolve promessa;
`await` dentro de `try` cobre os dois, e uma leitura que falha vira "sem ato" em vez de parar
a fila.

Aquele atendimento ficou **em atendimento**: a rodada quebrou antes de concluir. Conclua esse
na mao, ou deixe a proxima rodada pegar de novo.

### APAGAR NAO E ENVIAR — o gatilho agora e o SEU ato

Voce escreveu: *"o texto foi pro box de conversa, eu olhei e vi que estava errado, apaguei, e a
automacao pulou ou concluiu; o gatilho continua errado, eu nao dei enter ou clickei pra enviar"*.

**Voce pagou um risco que estava escrito na tela — e isso e a prova de que avisar nao bastava.**
O modo "Eu mando" dava a mensagem por enviada quando o campo **esvaziava**, porque a plataforma
limpa a caixa ao enviar. So que isso vale numa direcao so: **enviar esvazia, e apagar esvazia
igual.**

Agora o painel observa **os dois atos que voce nomeou**: o **Enter no campo** e o **clique no
botao de enviar**. E exige **as duas coisas juntas** — o seu ato *e* o campo ficar vazio. O ato
diz que voce mandou; o campo vazio diz que a plataforma aceitou.

**Apagando o texto, ele diz isso e NAO conclui:** *"o texto saiu do campo e voce nao deu Enter nem
clicou em enviar — entendi que voce apagou, entao NAO conclui este atendimento"*, e segue para o
proximo contato.

**Um limite declarado:** o botao de enviar da tela nova nao tem gancho nenhum (nao ha `data-cy`
nesta plataforma), entao o clique e reconhecido por estar **perto do campo**. Se um dia ele deixar
de ser reconhecido, o custo e a rodada esperar os dez minutos e **pular** — nunca concluir errado.
Pelo Enter nao ha essa duvida.

### O QUADRADO VERMELHO SAIU DE CIMA DA CONVERSA — e ele estava desligado no codigo

Voce escreveu: *"eu deletei a mensagem errada e no mesmo momento deu erro"*.

A janelinha da rodada (⏹ / ▶) nascia **no centro da tela**, em cima das mensagens. O clique para
apagar a mensagem errada caia nela — e o log *"voce parou a rodada."*, com ponto final, **so esse
quadrado escreve**. Agora, sem posicao gravada, ela nasce no **canto de cima**, ao lado do painel;
arrastada uma vez, a sua posicao continua valendo. E o ⏹ passou a exigir clique de mouse de
verdade: Enter ou Delete com o botao em foco nao param mais a rodada.

**O conserto estava escrito e DESLIGADO:** a linha era `if (false && !state.settings.controlePos)`,
ou seja, codigo morto com um comentario em cima explicando por que ele precisava existir. **Quem
pegou foi o teste** — a assercao exigia a forma viva e acusou. Reintroduzindo o `false &&`, cai de
novo (medido: 2 assercoes caem, com o numero da largura junto).

### O CURSOR PASSOU A TRABALHAR DO MESMO JEITO

Pedido seu. `.cursor/rules/` tem seis arquivos: dois que valem sempre (o **metodo** e as
**armadilhas do ambiente**) e quatro que voce chama no chat — **`@medir`**, **`@consertar`**,
**`@provar`**, **`@fechar`** —, um por etapa.

**Comando de arquivo (`/nome`) eu NAO consegui confirmar nos docs oficiais** (a pagina devolve
404), entao nao inventei: os quatro passos sao regras manuais, chamadas com `@`. Isso esta
confirmado na documentacao.

**Os FATOS nao foram copiados para la**, de proposito — eles continuam so no `CLAUDE.md`, porque
duas copias da mesma armadilha divergem na primeira semana. As regras do Cursor carregam o
**metodo** e mandam abrir os arquivos.

Para outra IA ou outra ferramenta, ha `.cursor/PROMPT-AVULSO.md`: um bloco para colar como
primeira mensagem.

### "A ETIQUETA DE ASSESSOR PAROU DE FUNCIONAR" — e levou mais tres listas junto

Voce estava certo, e a causa nao era a regra: era **o rotulo da etiqueta nao resolver**.

O painel guarda as etiquetas do contato como **ids**, e ia buscar o nome delas num catalogo. Na
plataforma velha esse catalogo era a tabela de etiquetas inteira. **Aqui nao existe tabela de
etiquetas** — elas sao texto solto dentro do contato —, entao o catalogo so pode ser *"o que ja
apareceu numa fatia da base"*: **1.000 contatos de 107.988**. ASSESSOR e de uso interno e
praticamente nunca cai nessa fatia.

Resultado: o painel nao achava o nome, a lista nao casava, e **a regra morria em silencio** — sem
erro, sem linha no Andamento, com o contato indo para a IA como se nao tivesse etiqueta nenhuma.

**O mesmo buraco matava outras tres listas**: a que dispensa da fila, as que pulam o disparo e a
de endereco (o caso de material). E o sinal de *"ja veio por anuncio alguma vez"*.

O conserto e olhar o que o contato **ja traz**: aqui a etiqueta vem do banco com o nome dentro, e
o catalogo era um desvio que so podia perder informacao.

### "O GATILHO ESTA ERRADO" — voce estava certo, e o buraco era de ALCANCE

Voce pediu que o gatilho fosse **voce enviar**, e o que aconteceu na print foi a extensao encher a
caixa e parar ali.

**A espera pelo seu Enter existia desde a v3.224 e morava dentro do caminho da RESPOSTA PRONTA.**
O rascunho da IA nao passa por la: ele e texto livre e sai por outro caminho, o segundo ponto de
saida do painel. Entao o modo que voce acabou de pedir funcionava na tecla e era **ignorado pela
IA**, que seguia tentando mandar sozinha — e, nao conseguindo, encerrava a rodada.

Agora, com **"Eu mando"** marcado, a IA faz o que a resposta pronta ja fazia: escreve no campo,
**espera voce dar Enter**, e so entao conclui e abre o proximo. Com **"A extensao manda"** nada
muda — la quem envia e o painel, e nao ha Enter para esperar.

**O que o Andamento passa a dizer:** *"IA escreveu e voce mandou"*. Escrever *"a IA mandou"* num
envio que foi seu esconde o unico ato humano daquela passada.

**O sinal deixou de ser o campo esvaziar na v3.232** — apagar esvazia igual. O que conta e o
Enter ou o clique no botao, e o campo vazio junto. O paragrafo antigo desta entrada dizia o
contrario e envelheceu; a secao do topo desta versao e a que vale.

### E a rodada parava onde devia so pular

A outra metade da print: *"Parei em contato"*. A recusa por **um sinal so** (a protecao que impede
mandar a mensagem de uma pessoa para outra) estava escrita para **pular e seguir** — e so no
caminho dos **Novos**. O motor que atende as **tres** filas continuava chamando aquilo de erro, e
erro para a rodada inteira. Agora a decisao mora num lugar so e vale em todos os caminhos.

### A UNICA PENDENCIA: a gravacao no contato

A escrita de etiqueta e de campo entrou na **v3.229** e **nao foi confirmada**. Eu tentei medir e
fui **barrado** — era uma escrita no seu banco de producao, sem voce ter mandado, e barrar foi o
certo.

Entao o que esta no ar **nao e um palpite silencioso: e um palpite que se denuncia.** A gravacao
pede a linha de volta e compara; nao batendo, **estoura com o nome do campo** em vez de dizer
"Gravado".

| o que a barra disser | o que significa |
|---|---|
| *"Gravado: ..."* com os campos | funcionou |
| *"a plataforma aceitou e NAO gravou X"* | **errei o nome da coluna** — a mensagem diz qual |
| *"respondeu OK e NAO devolveu a linha"* | o filtro nao alcancou ninguem (tenant ou permissao) |

### O ARCO DE HOJE, em uma tabela

Dez relatos seus, e vale registrar porque **tres deles eram o mesmo defeito** e **quatro eram
coisa que eu mesmo tinha acabado de quebrar**:

| versao | o que voce viu | o que era |
|---|---|---|
| 3.209 | sobrepos em vez de empurrar | `fixed` nao obedece padding: o app e que precisava ser preso |
| 3.210 | erro ao inserir texto | era uma recusa escrita — e achei um defeito maior junto |
| 3.211 | exigindo modelo aprovado | duas travas de uma plataforma que nao tem modelo aprovado |
| 3.212 | travou e ficou parado | o "ver mais" mentia `ok: true` e o laco girava 20 vezes |
| 3.213 | abre e fecha sozinho | **a causa**: converter a linha duas vezes esvaziava a fila |
| 3.214/.215 | so pulando de contato | a barreira do candidato, certa e sem saida |
| 3.216 a .221 | varios | Dulce, modelo aprovado, folga na fila, o campo, a aba, o botao Assumir |
| 3.222 | erro nas nao atendidas | a **pressa**: assumia no mesmo quadro do clique |
| 3.223 | "a aba trocou de atendimento" | a MESMA pressa, num ponto acima do conserto anterior |
| 3.224/.225 | so escrever nao funcionava | a opcao existia; as rodadas e que recusavam rodar sem envio |
| 3.226/.227 | box pela metade, modo bloqueado | eu destravei as funcoes e esqueci as travas da TELA |
| 3.228 | botoes redundantes | dois iguais lado a lado, e um Parar que duplicava o flutuante |
| 3.229 | "Gravado: nada" | **nenhuma** escrita no contato tinha caminho |
| 3.230 | pediu cidade de quem ja tem | o formulario olhava a ETIQUETA, nunca o CAMPO |
| 3.231 | o rascunho da IA parado no campo | o modo "Eu mando" valia so para a resposta pronta |
| 3.232 | apaguei o texto e ele concluiu | o gatilho era o campo esvaziar, e apagar esvazia igual |
| 3.233 | mandei e a rodada encerrou | `.catch` no objeto do ato de envio estourava e virava erro |
| 3.234 | encerrou de novo, "nao saiu" | `false` do envio virava `erro`, e erro para a fila inteira |
| 3.234 | deletei a mensagem e deu erro | o quadrado vermelho nascia em cima da conversa — e estava desligado |
| 3.235 | backspace parava a rodada | o CAMPO era o gatilho, e cada tecla dele mudava o campo |
| 3.236 | — | o dossie ganhou o cargo na Defesa Civil, com o gatilho que faltava |
| 3.237 | nao reconhece contato novo | 2 das 3 pernas cegas: catalogo de 0,93% e historico perdido |
| 3.232 | a etiqueta de assessor parou | o rotulo saia de um catalogo que aqui e uma amostra de 0,9% |

**As tres licoes que eu escrevi para nao repetir:**

1. **Consertar o sintoma onde ele aparece nao conserta quem le a tela antes.** Eu pus a espera em
   `conversaDaTela`, e quem lia a tela primeiro era `processarNovo` — por isso voce reportou duas
   vezes a mesma coisa com nomes diferentes.
2. **Trava que nao deixa APERTAR e mais forte que a que recusa depois do clique** — e e a que
   escapa quando se procura pelo texto do erro, porque nunca chega a produzir erro.
3. **Ao criar um MODO que muda o que um botao faz, olhe os botoes VIZINHOS.** Dois deles podem ter
   virado o mesmo.

### O QUE ESTA NO AR

Painel no mobiliza.me, logado como Capitao Martim. Fila **Todas** (Pessoas). Modelo aprovado
desligado nesta plataforma. Conferencia do numero do candidato desligada (`auto.conferirCanal`).
Repasse de link nao pede o formulario; se ainda nao respondemos hoje, sai a mensagem do momento.
Modo de envio no box **"Quem manda a mensagem"**, na aba Automatizado.

**A tabela peca a peca mora no `CLAUDE.md`**, na secao da plataforma nova — uma so, porque duas
tabelas da mesma coisa divergem na primeira semana.

**NAO FACA, e cada uma destas custou uma print:**

- **nao afrouxe os dois sinais** da conversa aberta: assumir com um sinal so mexe no atendimento
  de outra pessoa;
- **nao religue `conferirCanal`** — ele desligou, e com uma instancia so na conta ela nao tem o
  que separar;
- **nao apare a grafia de etiqueta** com `.trim()`: `"SERRA "` tem 504 contatos e `"SERRA"` tem
  zero;
- **nao invente disparo para quem nunca escreveu**: aqui a conversa nasce da mensagem da pessoa;
- **nao aperte Enter no campo pela extensao** no modo "Eu mando" — o Enter e dele, e e ele que
  prova que a mensagem saiu;
- **nao rode uma rodada de centenas na conta dele so para diagnosticar**;
- **nao escreva no banco dele sem ele mandar** — a sonda de escrita foi barrada, e estava certo.

### O QUE NAO FUNCIONA AQUI, E POR QUE

- **Modelo aprovado nao existe nesta plataforma.** O canal e Z-API ("WhatsApp nao oficial"): sem
  janela de 24h e sem modelo da Meta. A lista vem vazia porque **a resposta certa e vazia** — e
  isso nao impede a rodada, que decide em 100% dos casos sem modelo nenhum.
- **Disparo para quem NUNCA escreveu: nao da.** Na plataforma velha a extensao criava a sessao;
  aqui a conversa so existe depois que a pessoa manda mensagem, e a funcao de envio exige o id da
  conversa. Eu **recuso** em vez de percorrer a lista sem mandar nada e contar como enviado.
- **Audio ENCAMINHADO deixou de ser reconhecido.** A deteccao dependia do relogio do WhatsApp e do
  tamanho do arquivo, e o banco novo nao tem nem um nem outro.
- **De qual anuncio a pessoa veio nao existe nas tabelas que a rodada le.** Sobra o TEXTO
  pre-preenchido, que ja e reconhecido — mas anuncio sem texto (o CONVERSE CONOSCO) deixa de ser
  reconhecivel. **Hoje isso quase nao morde:** em 1.500 mensagens de 12 horas, UMA tinha a forma
  de texto de anuncio. **Decisao sua; nao religo nada disso por conta propria.**
- **A conferencia de "de quem e o numero" esta DESLIGADA aqui**, a seu pedido. A caixa esta na aba
  Automatizado, junto dos botoes de comecar. Com uma instancia so na conta ela nao tem o que
  separar; havendo um segundo numero um dia, remarque — senao o texto de um candidato pode sair
  pelo numero do outro sem aviso.

### SE VOCE ABRIR UMA SESSAO NOVA

Leia, nesta ordem: `REGRAS.md`, esta entrada, o `CLAUDE.md` (a secao **"A PLATAFORMA MUDOU:
mobiliza.app -> mobiliza.me"**, que tem a tabela de em que pe esta a migracao) e o `README.md`.

**Tudo o que esta no CLAUDE.md ANTES daquela secao descreve a plataforma ANTIGA.** Continua
valendo enquanto ela estiver no ar, e **nada daquilo se aplica ao mobiliza.me** — a plataforma nao
foi atualizada, foi reescrita.

## 2026-10-26 - v3.200.0 - a plataforma mudou, e a migracao comecou pelo chao

> **Esta entrada ERA a de passagem de contexto e hoje e historia** (rotulo retirado em 28/10/2026).
> A de agora e a do topo. Duas entradas dizendo "ESTADO DE AGORA" fazem uma sessao nova ler a
> errada — e a errada aqui descreve uma migracao que ainda nao tinha nada no ar.

**A coisa mais importante deste registro:** o **mobiliza.app acabou**. A plataforma nova e o
**mobiliza.me**, e ela nao foi atualizada — foi **reescrita**. Medi a dele por dentro em 26/10 e a
secao 0 conta o que se sabe. **Nada do painel atual funciona la ainda**, e a extensao que esta no
ar continua sendo a do mobiliza.app, intacta.

O que foi ao ar hoje e **o chao da migracao**: o modulo que fala com a plataforma nova
(`src/lib/mob.js`), so de LEITURA, com teste e com a leitura provada ao vivo na base dele. **Ele
ainda nao tem gatilho nenhum** — nenhum botao do painel o chama, de proposito: o que vem depois
depende de uma escolha sua, e ela esta no fim da secao 0.

Abaixo da secao 0, as dezesseis secoes do **painel do Facebook**, que continua sendo a parte viva
da extensao e nao depende do mobiliza em nada.

---

## 0. A plataforma nova: o que foi medido, o que ja esta pronto e a escolha que falta (v3.198.0)

**Pedido dele:** *"atualize para utilizar na nova plataforma,
https://mobiliza.me/admin/interacoes/conversas, entre pela extensao claude se necessario"*.

### O tamanho da coisa, em uma tabela

| | mobiliza.app | mobiliza.me |
|---|---|---|
| frente | Angular + Material | **React + Vite** |
| dados | `api.mobiliza.app` | **Supabase / PostgREST**, direto do navegador |
| login | Bearer interceptado no mundo MAIN | **`localStorage`** (`sb-<ref>-auth-token`) |
| ganchos de tela | `data-cy` em tudo | **nenhum** |
| contato | campos com contrato APRENDIDO | `base_dados`, colunas de verdade |
| etiquetas | ids, rotulo repetido | coluna de texto |
| clientes | um | **varios (multi-tenant)** |
| canal | Z-API | Z-API (nao mudou) |

### A boa noticia, e ela e grande

**A cabeca da extensao sobrevive inteira.** O quadro, a tabela de regras, os detectores, o parser,
as cidades e COREDEs, os anuncios, os perfis, a IA e as suas respostas **decidem O QUE sai para o
eleitor, nao COMO** — mudaram as maos, nao a cabeca. Dois meses de decisoes suas continuam valendo.

**E metade das armadilhas mais caras do projeto some:** o contrato de escrita aprendido, o
*"a API responde 200 e ignora"*, as keys desalinhadas, o rotulo repetido das etiquetas, o
`Origin not allowed` e a interceptacao do token. Na base nova, cidade e uma coluna e etiqueta e
texto.

### O erro que a medicao impediu antes de existir

Escrevi a guarda obvia de "isto e grupo?" como `!!linha.grupo_id`. Medido na sua base:

```
conversas com external_chat_id terminando em @g.us ....... 109
dessas, com grupo_id preenchido ...........................   0
conversas com grupo_id preenchido na base inteira .........   0
```

**A coluna e nula sempre.** As 109 teriam entrado na fila como contato comum, e a rodada publicaria
resposta de atendimento dentro de grupos de dezenas de pessoas. Quem responde e o endereco do chat
(`@g.us`), que e o que a propria plataforma filtra. **Na duvida, e grupo.**

### O que esta no ar hoje

`src/lib/mob.js` — o unico arquivo que sabe como a plataforma nova e montada por dentro:

- le a sessao do `localStorage` e sabe dizer quando ela venceu;
- monta consulta com o **`tenant_id` obrigatorio** (sem ele a consulta e recusada aqui, antes de
  sair — consulta sem tenant le a base de outra campanha);
- traduz a linha do banco para a forma que a rodada, os detectores e a IA **ja leem**;
- le a fila, a conversa, o contato, os numeros e as respostas rapidas da plataforma.

**Provado ao vivo na sua base** (so leitura): a fila voltou 200 com 100 conversas, e as mensagens
de uma conversa vieram com os dois lados separados. **27 suites verdes**, e a guarda do grupo cai
em 8 assercoes se alguem reintroduzir o `grupo_id`.

### O que NAO esta, e por que

**Nada escreve.** Assumir, responder, resolver e gravar cidade passam por
`enviar-mensagem-atendimento` e pelas funcoes `assumir_conversa` / `resolver_conversa`, que foram
**lidas no pacote e nunca executadas** — e a regra deste projeto e sonda no contato de teste antes
da fila. **E o painel ainda nao monta no mobiliza.me**: um painel que abre e falha em silencio e
pior que um painel que nao abre.

### Duas perdas conhecidas, para voce decidir se doem

1. **Audio ENCAMINHADO deixa de ser reconhecido.** O banco novo nao tem o relogio do WhatsApp
   separado do da plataforma nem o tamanho do arquivo — os dois campos de que a conta da Irene
   (07/09) vive. Nao ha contorno sem um campo que o banco nao tem.
2. **A plataforma ja tem IA propria** (`sugerir-resposta-whatsapp`, `transcrever-audio-whatsapp`,
   `gerar-templates-whatsapp-ia`). Vale olhar o que ela faz antes de reconstruir o mesmo caminho —
   pode ser que parte do que pagamos ja venha incluso.

### As duas escolhas que voce fez, e o que elas mudam

**"Ja migrei de vez".** O painel passa a ser so do mobiliza.me. `dom.js`, `api.js`, `contract.js` e
`recorder.js` deixam de ser destino de conserto — **nao apaguei nada**: enquanto a plataforma nova
nao envia uma mensagem sequer, jogar fora o que funcionou seria trocar certeza por aposta.

**"Mostrar ANTES, com a tela junto".** Voce nao escolheu entre as opcoes: deu a condicao —
*"na antiga eu ainda tinha que ver o que estava acontecendo, pois 90% das vezes o fluxo e a IA
respondiam correto, mas faltava os 10% que eu tinha que apagar e responder novamente manualmente"*.

Fui medir, e **a plataforma nova nao apaga mensagem**: nos 33 pacotes dela (~2,9 MB) as funcoes sao
`enviar-mensagem-atendimento`, `transcrever-audio-whatsapp`, `sugerir-resposta-whatsapp`,
`classificar-conversa-whatsapp`, `enviar-reacao-whatsapp`, `gerar-audio-tts` — **nenhuma apaga**.
Apagar continua existindo no seu celular, nao na tela. **Entao o seu laco inverteu:** era *deixa
sair, eu leio, e apago os 10%*; passa a ser **ver antes**. Com esse custo na mesa voce escolheu
parar a rodada, e e assim que ela vai ser construida.

### 0.1 Abrir a conversa CERTA na tela (v3.199.0)

A linha da fila e um `<button>` com **so `class`** — sem id, sem `data-*`. Casar por nome seria
adivinhacao, e aqui adivinhar e voce conferir a mensagem de uma pessoa e apertar a tecla que
responde a outra.

**O React guarda a linha do banco no proprio no**, e e dali que sai a identidade:

```
no -> __reactFiber$<hash> -> ate 8 niveis de .return -> memoizedProps.conversa -> { id, ... }
```

Medido ao vivo na sua fila, com o codigo que foi ao ar:

```
clicaveis na tela ......... 104
reconhecidos como linha ...  78
ids distintos .............  78
achar o alvo pelo id ...... achou, por identidade, mesmo registro, no clicavel
```

Tres coisas que ficam escritas: **so funciona no mundo MAIN** (as chaves do React sao expando, e
expando nao atravessa mundo isolado no Chrome); **"nao esta na tela" e o caso comum e nao e erro**
(78 linhas no DOM para uma fila de centenas — ai a conversa se le dentro do painel); e **o nome e so
reserva, que avisa**, com empate devolvendo nada.

**Abrir clica e para ai** — nao marca lida, nao assume, nao digita. A mesma fronteira do `Ocultar`
no painel do Facebook.

### O que vem agora

A rodada: decidir pelo quadro, **parar para voce** e so entao enviar. O envio tem sonda no
**Thiago Tim** antes de qualquer fila — `enviar-mensagem-atendimento` foi lida no pacote e nunca
executada.

---

## 0.2 Eu comecei errado, voce corrigiu, e a correcao esta no codigo (v3.200.0)

**Voce disse:** *"voce misturou tudo, a aba facebook era pra plataforma do facebook, todo o resto
era mobiliza e era isso pra ser trazido e deixar intocada a aba do facebook"*.

**Esta certo.** Eu tinha comecado um painel NOVO para o mobiliza.me (`mob-main.js`), citando o
painel do Facebook como molde. O molde nao vale: **o painel do Facebook e pequeno porque o trabalho
dele e pequeno** — listar comentario e responder. O trabalho do mobiliza e a operacao inteira, e ela
ja existe, com dois meses de decisoes suas dentro. **O painel novo foi apagado antes de ser
commitado.**

### O desenho certo

```
panel.js  (a rodada, o quadro, a Config, as respostas, a IA)   <- intocado
   |
page.js ->  mobiliza.app (DOM + REST antiga)  |  mobiliza.me (mob.js: Supabase)
```

Um painel so, com um **adaptador por plataforma** — que e exatamente o que o cabecalho do `page.js`
ja descreve desde sempre ("dois modos, mesma interface"). **A aba do Facebook nao e tocada.**

### A costura, medida

| | quantos | o que acontece com eles |
|---|---|---|
| `page.*` | 24 | parte vira consulta, parte **morre** (os cliques do Angular, o gravador) |
| `api.*` | 22 | parte vira Supabase, parte **morre** (`getCustomFields`, `createTag`, `updateTag`) |

**Boa parte simplesmente deixa de existir**, porque na base nova cidade e uma coluna e etiqueta e
texto — o contrato de escrita aprendido nao tem mais o que aprender.

### O que ficou pronto nesta versao

**Qual conversa esta aberta na SUA tela** — a peca de que o `getState` depende, e que eu tinha
deixado devolvendo `null` por nao ter medido. Agora esta medido, e sao **dois sinais**:

```
(1) a LINHA da fila com props.ativa === true          0,19 ms
(2) o PAINEL da direita, pela ASSINATURA das props    0,75 ms
    (conversa + onStatusChange + onClose)

na sua tela, com uma conversa aberta: os dois apontaram para o mesmo id -> "os-dois"
```

Juntos custam **menos de 1 ms**, entao uso os dois. **Discordando, nao afirmo nada** — afirmar a
conversa aberta errada e o painel classificar uma pessoa e responder outra. Duas linhas marcadas
ativas ao mesmo tempo tambem devolvem nada.

O painel da direita e reconhecido pela **assinatura das props**, nunca por classe: as classes sao
Tailwind geradas e mudam com o tema e com cada publicacao da plataforma.

### O que NAO foi ao ar

**O painel ainda nao monta no mobiliza.me**, e o manifesto nao o registra la. Montar agora seria um
painel que sobe e trava: o boot espera o Bearer do `page-hook`, que naquela plataforma nao existe.
Ele monta quando o adaptador fechar a costura — e o envio, quando a sonda sair no **Thiago Tim**.

---

## 1. O botao IA do comentario nunca funcionou (v3.180.0)

**Print dele:** o painel no ar, os comentarios lidos certos, e embaixo **"a IA nao devolveu um
rascunho legivel"**.

**Medido antes de mexer:** `validarComentario` devolvia `null` para a forma que a API entrega.

```
validarComentario(string) -> null
validarComentario(objeto) -> { texto: "Obrigado pelo apoio!", ... }
```

`PROVEDORES[*].texto()` entrega `message.content` (OpenAI) ou o bloco `text` (Anthropic): **o JSON
do modelo como STRING**. Os **sete** validadores vizinhos fazem o `JSON.parse`; este nasceu sem ele.
**Entao o botao falhava em 100% das chamadas, e cada uma saiu paga.**

**Por que o teste de ontem ficou verde:** o simulado do worker devolvia `decisao` como **objeto ja
pronto** — a forma que eu supus, nao a que o worker entrega. Corrigido o simulado e reintroduzido o
defeito, **11 assercoes caem**.

**O que impede a nona vez:** `tests/ia-validadores.test.mjs` varre os oito e trava a propriedade que
nao depende de conhecer os campos — **ler a string da o mesmo resultado que ler o objeto**.

A varredura achou que `validarRascunho` **aceita prosa solta**, e isso e deliberado (texto puro com
`confianca: 0`, nunca sai sozinho). **No comentario a escolha e a oposta e tambem de proposito:** o
canal e publico, e prosa e recusada com o motivo na tela.

---

## 2. Respostas rapidas, sem IA (v3.181.0)

**Pedido dele:** *"preciso de respostas rapidas para o facebook, a ia nao e necessaria para tudo"*.
Escolhas dele: **eu proponho os textos e ele corrige**, e **tudo se gerencia no painel do Facebook**.

### A lista e PROPRIA, e isso e regra e nao preferencia

**Medido contra as 21 respostas prontas do WhatsApp: 3 serviriam.**

| problema | quantas |
|---|---|
| **pedem o cadastro** (`Nome , Cidade`) | 5 |
| tem `{{saudacao}}` / `{{cidade}}` / `{{link_grupo}}` | 16 |
| passam de 260 caracteres | 6 |

Pedir nome e cidade e **proibicao escrita do canal publico** — reusa-las mandaria o formulario para
a pagina onde todo mundo ve. E no Facebook **nao ha contato carregado**: a variavel nao resolve,
sairia `{{saudacao}}` cru para o eleitor.

### Como funciona

- A **tira de botoes** fica junto do campo, no rodape. **Uma so, nunca uma por comentario** — a
  lista tem N comentarios, e seis botoes em cada um enterrariam o que ele veio ler.
- **Clicar enche o CAMPO, nunca insere na pagina.** Mesma fronteira da IA: ele le, depois clica em
  "Abrir e inserir" no comentario que quiser.
- **"Guardar como rapida"** pega o que esta no campo. O rotulo sai do proprio texto, entao guardar
  nao exige digitar nome nenhum.
- **O ⚙ abre o modo de organizar**, e so nele aparecem o ✎ (editar) e o ✕ (apagar). **Duas razoes,
  e a primeira foi medida na conta de altura:** seis pares de `[rotulo][✎][✕]` empilham seis linhas
  no rodape e enterram a lista de comentarios — a poluicao de que ele ja reclamou em 10/09. A
  segunda e que o apagar deixa de ficar a um dedo de quem so queria usar a resposta.
- **✕ apaga — e devolve o texto ao campo.** E o desfazer barato: um clique em guardar traz de
  volta, sem pilha de desfazer.
- **"Reler a pagina" atualiza as duas coisas:** os comentarios e a tira. E por ali que a tira do
  candidato certo chega depois de ele trocar de candidato no mobiliza.

### Os seis botoes de fabrica — **a primeira variacao de cada um**

**As outras 25 estao na secao 4**, e todas sao suas para corrigir.

| botao | primeira variacao |
|---|---|
| Apoio | Muito obrigado pelo apoio! Seguimos juntos. 🙏 |
| **Dia 25 — 2o turno** | Dia 25 é 22! Leva a família e os amigos para votar. 💪 |
| Pro privado | Me chama na mensagem da página que a gente vê isso com calma por lá. |
| Obrigado pela info | Obrigado por trazer, vamos acompanhar. 🙏 |
| Está junto | É isso aí! Obrigado por estar junto nessa. 💪 |
| Seguir a página | Obrigado! Segue a página para não perder nada. 👊 |

Cada um sai de uma regra que ja existe: **pedido pessoal vai para o privado** (nao se nega em
publico), **denuncia se agradece e nao se discute** (23/09), e **quem xinga o adversario esta do
nosso lado — agradece, nunca modera** (regra 17, 25/09).

**Os seis passam pela propria `revisarRascunho`**, com teste: nenhum promete entrega, nenhum afirma
que ja fizemos, nenhum afirma que temos, nenhum pede cadastro, nenhum tem variavel, e nenhum passa
de 140 caracteres.

### Duas coisas para ele saber

- **"Dia 25 — 2o turno" EXPIRA.** Texto com data dentro envelhece sozinho (19/10), e por isso a
  data esta no NOME do botao: passado **25/10** ele tem de sair ou ser reescrito.
- **A tira e POR CANDIDATO**, como tudo o que sai para o eleitor. O candidato novo **nao comeca
  vazio**: as de fabrica servem de ponto de partida, porque **nenhuma cita candidato pelo nome** —
  ha teste exigindo isso.

---

## 3. O teclado do mobiliza, no painel do Facebook (v3.182.0)

**Pedido dele:** *"faca o mesmo esquema de teclado que existe no mobiliza"*. O mapa e **a escolha
dele**, perguntada antes de escrever linha — tecla e musculo, e este projeto ja registrou que
trocar o significado de uma tecla que ele tem no dedo e defeito.

| tecla | faz |
|---|---|
| **1..9** | a enesima resposta rapida: poe no campo **e insere** no comentario da vez |
| **⏎** | inserir no comentario da vez |
| **↑ ↓** | trocar o comentario da vez |
| **I** | pedir o rascunho a IA |
| **R** | reler a pagina |
| **G** | guardar o campo como resposta rapida |
| **Esc** | sair do modo de organizar |

**A tecla EXECUTA, como no mobiliza** (escolha dele: *"escolhe e ja insere"*). **Continua sem
enviar nada** — quem aperta Enter no Facebook e ele.

### As tres guardas sao COPIADAS do `panel.js`, e cada uma custou caro

1. **`composedPath()[0]`, nunca `ev.target`.** Dentro de shadow DOM o `target` e o HOST, entao a
   checagem de campo de texto olharia a div de fora: o "2" digitado no campo do painel inseriria a
   segunda resposta.
2. **Campo de texto sai da frente — e aqui isso e MAIOR que no mobiliza.** A caixa de resposta do
   Facebook e `contenteditable`, e ele digita nela o tempo todo. Sem `isContentEditable`, **cada
   "2" que ele escrevesse disparava uma insercao.**
3. **`isTrusted` no Escape**, porque a extensao dispara `Escape` no document para fechar overlay
   (07/09) — atalho sem isso e atalho que ela aperta sozinha.

### Tres decisoes que o teclado obrigou

- **O comentario da vez e guardado por ID, nunca por indice.** O painel rele a cada 2s e a lista
  encurta quando um comentario e respondido: com indice, o foco pularia para outra pessoa sem
  ninguem mexer. Ele fica **realcado** — inserir escreve na pagina, entao o que esta aceso tem de
  dizer onde a tecla bate. Clicar num comentario tambem o torna o da vez.
- **A tecla so aparece onde e verdade:** `⏎ Abrir e inserir` e `I IA` so no comentario da vez.
  Escrever a tecla nos seis botoes prometeria que o Enter atinge qualquer um deles.
- **UMA insercao por vez, com a trava dentro de `inserir`.** `fb.inserirNaCaixa` **ACRESCENTA** —
  apagar na caixa do Facebook nao funciona (medido em 19/10) —, entao duas chamadas deixam o texto
  **duplicado numa caixa publica**. O botao se protegia desabilitando; **a tecla nao tem como**, e
  apertar "1" duas vezes e o gesto mais natural quando a primeira parece nao ter respondido.

### O custo, e ele e seu para decidir

**Com o painel aberto e o foco fora de campo de texto, as setas deixam de rolar a pagina.** Foi o
preco de ↑↓ trocarem o comentario. Trocar por `j`/`k` ou Alt+setas e **uma linha** — e so dizer.

---

## 4. Cada botao virou uma CATEGORIA com variacoes que revezam (v3.183.0)

**Pedido dele:** *"numero 1 = apoio e dentro dele quero 10 variacoes e a opcao de editar elas que
ao apertar o numero 1 ira seguir na sequencia das variacoes para cada resposta e nao se repetir
ate ter ido as 10"*.

**Nao foi mecanismo novo:** e o rodizio que a mensagem do momento ja usa desde 02/09
(`templates.varianteAtual` / `avancarVariante`), com as duas disciplinas de la.

- **O ponteiro mora em `varianteIndex`** — a mesma chave compartilhada, com id prefixado `fb:`.
  Ela **sai do backup** por ser *"ponteiro de rotacao, nao configuracao"*, e reusa-la mantem isso
  verdadeiro de graca.
- **Ele so anda depois que o texto ENTROU na caixa.** `inserir` passou a devolver booleano so por
  isso: avancar numa falha faria a volta de dez virar uma volta de nove, em silencio.
- **A volta e CIRCULAR** (0,1,…,9,0), e e ela que cumpre o *"nao repetir ate ter ido as 10"* sem
  sortear nada — sorteio repetiria antes de fechar a volta. Medido: dez usos, dez textos
  distintos, e so o decimo primeiro volta ao comeco.
- **Ponteiro maior que a lista e modulado:** ele usa a oitava variacao e depois edita deixando
  tres — sem isso, quebraria.

### Por que variar importa MAIS aqui que no WhatsApp

Os comentarios ficam na **mesma pagina**, um embaixo do outro. Seis *"Muito obrigado pelo apoio!"*
identicos em sequencia e o que denuncia robo — a mesma razao do rodizio da mensagem do momento.

### Quantas variacoes cada botao tem — e por que nao sao dez em todos

| botao | variacoes | por que |
|---|---|---|
| **Apoio** | **10** | e o que mais chega, e onde a repeticao aparece |
| Esta junto | 6 | tambem sai muito |
| Dia 25 — 2o turno | 5 | **expira em 25/10** |
| Obrigado pela info | 4 | |
| Pro privado | 3 | sai pouco; dez formas da mesma frase viram texto ruim |
| Seguir a pagina | 3 | |

**O teto e dez e o editor esta no painel** — completar e seu. **Os 31 textos passam pela propria
`revisarRascunho`**, com teste.

### O editor

O **⚙** abre o modo de organizar; o **✎** abre o editor, que **toma o corpo do painel** — dez
variacoes nao cabem numa tira de 380px, e dialogo num content script e feio e a pagina pode
bloquear.

- **Uma variacao POR LINHA**, o mesmo formato das tabelas da Config. O editor conta enquanto voce
  digita: *"7 variacao(oes) — a volta fecha em 7 uso(s)"*.
- **Esvaziar o editor APAGA a resposta** — e o gesto natural de quem quer tirar um botao, e a tela
  avisa antes.
- **O que voce digita mora no ESTADO, como o campo principal.** O painel redesenha sozinho a cada
  2s, e a guarda de foco so segura enquanto o cursor esta no campo: bastava clicar fora para o
  redesenho restaurar o valor GRAVADO e comer as variacoes recem-digitadas.
- O **✕** apaga a resposta inteira e **pergunta** quando ha mais de uma variacao; a primeira volta
  para o campo, entao "Guardar como rapida" ainda desfaz em parte.

### Onde voce ve em que variacao esta

**No `title` do botao** (passando o mouse) e **na linha de status depois de usar**:
*"Texto posto na caixa de Fulana (Apoio, variacao 3 de 10)"*. **Nao vai escrito no botao** de
proposito: "3/10" em seis botoes e ruido numa tira de 380px, e o numero so interessa no instante
da duvida.

### O que voce ja tinha guardado nao se perde

`sanitizar` **aceita a forma antiga** (`texto` solto) e a converte em primeira variacao. As
respostas que voce guardou de manha continuam la.

---

## 5. O alarme da ordenacao saiu (v3.184.0)

**Decisao dele**, vendo o painel no ar: *"nao tem problema estar nos relevantes pois quero
responder eles e nao todos"*.

O aviso amarelo tomava **um quarto da tela** mandando trocar a ordenacao para "Todos os
comentarios" — ou seja, **mandando fazer o contrario do que ele quer**. E a regra que este arquivo
ja tinha (*alarme que toca sempre e alarme que se aprende a ignorar*) aplicada a uma
**preferencia**: a ordenacao e escolha dele, nao defeito.

| antes | agora |
|---|---|
| amarelo: "o post diz ter 42… troque para Todos os comentarios" | **linha cinza**: "Mostrando os mais relevantes. Role dentro do post e releia para carregar mais." |
| amarelo: nome da pagina nao lido | **continua amarelo** — este ele nao escolheu |

**`ordenacaoEsconde` nao virou funcao morta:** ela passou a decidir **se o total e citado**. Com
"Mais relevantes" ligado, dizer *"o post tem 42"* compara a lista com um conjunto que ele nao quer
percorrer — soa como se faltassem quarenta. **O total so e meta quando a ordenacao nao esconde
ninguem**, e ai a frase volta a ser "O post tem 42. Role… para carregar o resto."

### E o realce ganhou uma barra azul de 4px

Na print **nao dava para distinguir qual comentario estava aceso** — o fundo azul claro com borda
de 1px some numa tela cheia. Para a marca que diz **onde o Enter e as teclas 1..9 escrevem na
pagina**, "nao da para distinguir" ja e defeito.

---

## 6. Os respondidos ficam na lista, em amarelo (v3.185.0)

**Pedido dele:** *"troque a cor dos que receberam resposta na lista para amarelo"*.

Ate entao eles eram **descartados**, entao nao havia o que colorir: o comentario **sumia da lista
dois segundos depois de ele responder**. Bom como fila, desorientador como tela — ele perdia a
referencia de onde estava no post.

**Devolver a marca nao custou leitura nenhuma:** `comentariosSemResposta` ja calculava
`respondidos` para poder filtrar. Hoje:

- **`comentariosDoPost`** devolve todos, cada um com `respondido`;
- **`comentariosSemResposta`** e ele peneirado — **uma fonte de verdade**, senao a tela mostraria
  como pendente quem o painel considera respondido.

### Tres decisoes que o amarelo obrigou

- **O comentario DA VEZ pula os respondidos.** Com eles na lista, cair no primeiro cru poria o
  teclado em cima de quem ja foi atendido — e a tecla 1 **escreve na pagina**. Clicando ou com as
  setas ele ainda alcanca um respondido; o que nao pode e isso por padrao.
- **Sem o nome da pagina, NADA fica amarelo.** Nao da para saber quem respondeu, e marcar por
  chute **esconderia da fila quem nunca foi atendido**. Erra mostrando demais, que e o lado
  barato — e esse caso continua com aviso amarelo proprio.
- **A conta entrou na linha cinza:** *"2 esperando, 3 em amarelo ja respondido"*. Sem o numero ele
  teria de contar os cartoes.

### E um defeito meu que quase foi para a sua tela

Escrevi um comentario CSS citando **`.davez` entre crases**, dentro do template literal do CSS. **O
`checar-modulos` passou** — e o painel **nao teria aparecido**.

**Duas crases nao se cancelam:** a primeira fecha a string, o meio vira acesso a propriedade e a
segunda abre um **tagged template**. E sintaticamente valido, entao nenhum checador de sintaxe
acusa; estoura em **runtime**, no instante em que o painel desenha. Medido:
`TypeError: "...".davez is not a function`.

**Com UMA crase** (o caso de 19/10) da `SyntaxError` e o checador pega. **Com duas, nao pegava.**
Agora pega: toda funcao que devolve um template literal so pode ter as duas crases, a que abre e a
que fecha. **A varredura e estreita de proposito** — a primeira versao olhava todo comentario de
bloco e acusou **1277** ocorrencias, porque os comentarios daqui citam nomes entre crase o tempo
todo.

---

## 7. "Ler tudo": o amarelo nao funcionava pela MESMA razao de ele rolar a mao (v3.186.0)

**Print dele:** *"nao alterou a cor e preciso que faca uma leitura do post pegando todos os
comentarios, estou tendo que fazer isso manualmente; a leitura ira servir pra ver quais foram
respondidos tambem"*.

### A causa estava na propria print

```
Rita Jesus
Essa matematica na fecha · Dito isso bora de 22
1h · Curtir · Responder · Enviar mensagem · Ocultar
    Capitao Martim respondeu · 1 resposta        44 min
```

**A nossa resposta esta COLAPSADA.** O Facebook so cria o `[role="article"]` dela depois que
alguem clica em "1 resposta" — entao o painel nao via resposta nossa nenhuma e `respondido` era
falso para todo mundo. **Era a mesma razao de ele estar rolando a mao:** o que nao foi expandido
nao existe na arvore. **Os dois pedidos tinham uma solucao so.**

### O botao "L Ler tudo"

Expande as respostas, rola o post e **acumula** o que achar, em voltas. Clicar de novo para.

- **A PROVA E O EFEITO, nunca o rotulo do botao.** Cada volta clica no que parece revelar, rola, e
  conta **quem entrou na lista acumulada** (na v3.186 ela contava os articles DA TELA, e a secao 8
  mostra por que isso nao mede nada sob virtualizacao). Acertar o texto exato de cada botao do
  Facebook e adivinhacao que envelhece na primeira traducao; contar o que surgiu, nao.
- **Para com DUAS voltas secas**, porque uma so erraria no instante em que o Facebook esta
  carregando o lote seguinte.
- **Nada ali envia, responde nem curte.** Os unicos cliques sao em botoes que REVELAM, por lista
  de permissao com **teto de caracteres e uma linha so** (nasceu em 40 e virou 80 na secao 8) —
  sem o teto, um comentario que por acaso seja um `role="button"` entraria na lista e o painel
  clicaria no que o eleitor escreveu.

### A lista passou a ACUMULAR, e isso nao era opcional

O DOM e virtualizado: rolando para carregar os de baixo, **os de cima saem da arvore**. Com a
lista sendo a foto de agora, "ler o post inteiro" nao produziria lista nenhuma — ela so trocaria
de conteudo. **Era exatamente por isso que ele estava anotando a mao.**

**O preco e o `no` obsoleto**, tratado nos dois lugares que o usam: **"Abrir e inserir" e "Ver na
pagina" reacham o article pelo id** antes de desistir. O `comment_id` e estavel; o elemento nao.
Sem isso, "Ver na pagina" rolaria para um elemento solto **em silencio**.

### E o amarelo funciona ANTES de ler tudo

`respostaNossaColapsada` le o resumo *"<pagina> respondeu"*. **A guarda e a POSICAO:** so conta
depois do primeiro marcador de tempo/botao — no meio do texto, *"o Capitao Martim respondeu meu
pedido"* e o eleitor falando de nos.

**Tecla nova: L.** E o rodape ficou com `L Ler tudo · R Reler · G Guardar`, encurtados porque tres
botoes nao cabiam numa linha de 380px.

---

## 8. A leitura terminava em "0 ja respondido" com tres resumos a vista (v3.187.0)

**Print dele**, logo depois da secao 7:

```
Leitura terminada: 19 comentario(s), 0 ja respondido(s) — o post declara 51.
```

E na pagina, abaixo de tres comentarios diferentes, ainda colapsado:
**"Capitao Martim respondeu · 1 resposta"**.

### Medido primeiro, porque as causas dao a MESMA print

```
"Capitao Martim respondeu · 1 resposta" -> botoesDeExpandir NAO pega
respostaNossaColapsada (linha no innerText)  -> true   (logo: na pagina dele a linha esta FORA)
mesmoNome('Capitao Martim ', 'Capitao Martim') -> true (descartado como causa)
```

**Eram tres defeitos independentes.** Consertar um so teria devolvido a mesma print.

### (1) A lista de permissao exigia que o texto FOSSE "1 resposta"

O botao real diz *"<pagina> respondeu · 1 resposta"* — resumo e contagem no **mesmo clicavel** —, e
com 15 caracteres de nome ele ja passa do teto de 40. Hoje o padrao **TERMINA** em "N resposta(s)",
o teto subiu para **80** e entrou **"uma linha so"**: o teto existe para o painel nunca clicar no
que o eleitor escreveu, e uma linha faz esse trabalho melhor que um numero de caracteres.

Entrou junto `ver … coment` largo, porque *"Ver 30 comentarios anteriores"* nao casava com nenhuma
das tres formas que eu havia escrito a mao.

### (2) O resumo nao esta DENTRO do article

O caminho pelo `innerText` funciona num layout de teste e deu **0 de 19** na pagina dele. Hoje ha o
**caminho 2**: sobe no maximo **quatro ancestrais** procurando um `[role="button"]` cujo texto seja
*"<pagina> respondeu…"* — mais preciso que varrer o texto do ancestral, que traz o comentario
inteiro junto.

**A guarda e parar no ancestral que ja mistura DOIS comentarios.** Dali para cima o "respondeu"
encontrado pode ser do vizinho, e **pintar de amarelo quem nunca foi atendido o esconde da fila**.
O teste prova os tres estados:

```
resumo como IRMAO do article                      : true
sem resumo nenhum                                 : false
resumo so no pai, onde ha 2 comentarios (nao pode): false
```

### (3) A rolagem saltava para o fim, e a "volta seca" contava a tela

`scrollTop = scrollHeight` pula o miolo: sob virtualizacao o meio do post **nunca entra na arvore**,
e a lista acumulada ficaria com o comeco e o fim. Hoje o passo e **80% da altura visivel** (garante
sobreposicao entre as fotos) e a funcao **devolve se andou**.

E a volta "seca" comparava `articles(raiz).length` antes e depois — numero que **nao cresce** sob
virtualizacao, porque os de cima saem quando os de baixo entram. Hoje ela so e seca com **nenhum
botao aberto, nenhuma rolagem e nenhum nome novo no ACUMULADO**.

> **A regra que fica:** leitura que percorre DOM virtualizado mede o progresso no que ela GUARDOU,
> nunca no que esta na tela.

### O que continua em aberto

Os padroes de `REVELAM` vieram da **print**, nao de medir o DOM dele. Se "Ler tudo" ainda parar
antes do fim, o que resolve e o **texto exato** do botao que sobrou — quantos ele trouxe e o que o
botao diz.

---

## 9. O modo de responder: barra embaixo, setas, Enter, e o proximo sozinho (v3.188.0)

**Pedido dele:** *"criei um botao de comecar a responder onde vai esconder a extensao e ter as
opcoes de resposta, subir e descer comentarios nas setas e enter para mandar a mensagem; crie o
botao de parar tambem e ao apertar enter vai pro proximo comentario sozinho"*.

**"Comecar a responder"** fica no rodape do painel, em azul. Ao clicar: o painel **solta o
empurrao** (a pagina volta ao tamanho inteiro) e sobra uma **barra fina embaixo** com a quem ele
esta respondendo, as respostas rapidas, a IA, o "Ver na pagina", o **Parar** e a linha de status.

### O Enter e o do FACEBOOK, e essa e a decisao que sustenta o resto

Com o foco dentro da caixa de resposta o Enter dele e **nativo** — e assim que ele envia hoje, sem
extensao nenhuma. **O painel nao intercepta.** Interceptar trocaria um envio que funciona por um
despacho sintetico que **nunca foi medido**, e o preco de errar e ele achar que respondeu sem ter
respondido.

Depois de apertar `1`, o foco **ja esta na caixa** (`inserirNaCaixa` o poe la). Entao o gesto e:

```
1   -> a resposta entra na caixa, com a mencao
⏎   -> o Facebook envia
        o painel ve a resposta aparecer -> proximo comentario, na vista
```

`fb.enviarDaCaixa` existe so para o outro caso: ele clicou num botao da barra e o foco saiu da
caixa. Ela **devolve "despachei", nunca "enviou"**, e leva os quatro campos juntos (`key`, `code`,
`keyCode`, `which`) porque editor olha campos diferentes e faltar um e a forma silenciosa de nao
enviar nada.

### O avanco so acontece COM PROVA

Quem prova o envio e **a resposta aparecer no post** — o mesmo sinal que o amarelo da lista ja usa.
Nunca a tecla. Com isso os **tres** jeitos de enviar andam pelo mesmo mecanismo (o Enter dele, o
nosso despacho e o botao do proprio Facebook), e **nao existe avanco sem prova**: pular sem
resposta esconderia da fila quem nunca foi atendido.

A vigia pergunta de **700ms em 700ms** (o laco normal do painel e de 2s, e esperar 2s depois de
cada envio faz o "sozinho" parecer travado) e so avanca na **transicao** para respondido — armar em
cima de quem ja esta respondido faria o painel sair de cima dele no primeiro tique, sem nada ter
sido enviado.

**O proximo e o proximo que ESPERA**, olhando para a frente e depois voltando ao comeco (quem
comeca no meio do post nao deixa ninguem para tras), e **no fim ele FICA no lugar** em vez de dar a
volta. As **setas circulam** — ali ele esta navegando a mao.

### As duas guardas do teclado brigavam com o modo

A guarda de campo de texto e medida e continua valendo: a caixa do Facebook e `contenteditable`, e
sem ela cada "2" que ele digitasse inseriria a segunda resposta. **Mas no modo o foco VIVE na
caixa**, e manter a guarda inteira mataria justamente as setas que ele pediu.

- **Passam so as setas e o Escape.** Os **digitos continuam barrados**: "22" e o numero do
  candidato, e ele digita isso na resposta.
- **`soltarOFoco()`** e o que mantem o teclado vivo: sem soltar a caixa depois de cada avanco, ele
  nao conseguiria apertar 1..9 de novo; e trocar de comentario com a caixa do ANTERIOR em foco faria
  um Enter mandar a resposta **para a pessoa errada**, com a barra dizendo um nome e o Facebook
  enviando para outro.
- **`isTrusted` passou a valer para TODA tecla** (era so o Escape): o despacho do Enter borbulha ate
  o document, onde o escutador esta em captura — sem a guarda ele atenderia o proprio despacho.

### A barra nao tem campo de texto, e a IA escreve na caixa

A caixa do Facebook esta na tela e mostra exatamente o que vai sair, com a mencao: **ela e o
campo**. Um segundo campo criaria a pergunta "qual dos dois vai?".

Por isso a **IA no modo escreve direto na caixa** — manter o rascunho num campo invisivel seria
texto pago que ninguem ve. **A leitura antes de publicar nao se perde; muda de lugar**, e o Enter
continua sendo o segundo ato deliberado. Os avisos da revisao sao repetidos depois da insercao,
porque `inserir` escreve a propria linha de status e apagaria *"ATENCAO: promessa de entrega"* justo
no texto que vai para a pagina.

**Escape tambem para o modo**, e o Parar volta o painel. A tira da barra nao tem o engrenagem: o ✕
a um dedo de quem responde em sequencia e o gesto destrutivo escondido no inofensivo.

### O que fica em aberto, e e medicao que so o uso dele da

- **Que a resposta apareca no post logo depois do envio e o que o avanco pressupoe** — e isso nao
  foi medido ao vivo. Se ele enviar e o painel nao andar, o ↓ anda a mao e **a medicao e me dizer
  se o comentario ficou amarelo** depois de alguns segundos.
- **Sem o nome da pagina nada fica respondido**, entao o modo nao avanca nunca. A barra escreve a
  consequencia e a saida, em vez de parecer travada.
- **Trocar a resposta escolhida continua sem conserto:** apagar na caixa do Facebook nao funciona
  (medido em 19/10), entao o texto errado se arruma na pagina, a mao.

---

## 10. Quem escreve DUAS vezes sumia da fila (v3.189.0)

**Print dele**, com a barra no ar sobre o segundo comentario da mesma eleitora: *"a marta ja foi
respondida, ela tem duas mensagens, mostre quando for o caso"*.

Na pagina estavam, em ordem:

```
Marta Fictinha — "Estou em oracao..."        Capitao Martim respondeu · 1 resposta   <- atendida
James Machado  — "..."
Marta Fictinha — "Estou com o Flavio 22"     (nada embaixo)                          <- esperando
```

### A causa, e ela e maior que a print

**O painel escolheu certo** (ele estava no comentario que ainda esperava). O que faltava era ele
saber que ja havia respondido a mesma pessoa noutro lugar.

**Mas medindo, apareceu o defeito de verdade:** o `aria-label` da resposta so diz o **nome** do pai
— *"Resposta de X ao comentario de Marta"* —, e era por nome que `comentariosDoPost` marcava. Entao
responder UM comentario dela marcava **os dois**, e o que nunca foi respondido ficava amarelo e
**saia da fila em silencio**.

**Por que a print ainda mostrava a lista certa:** com as respostas COLAPSADAS quem decide e
`respostaNossaColapsada`, que le o resumo na POSICAO de cada comentario e acerta. O defeito nasce
depois do **"Ler tudo"**, que expande as respostas e traz os rotulos — ou seja, estava a um clique
de distancia.

### O id do pai estava a um parametro de distancia

O permalink da resposta leva os **dois** ids:

```
/post?comment_id=<O PAI>&reply_comment_id=<A RESPOSTA>
```

`idDoComentario` ja lia os dois campos desde 19/10; faltava usar o primeiro. Hoje
`paiDoComentario` devolve o id do pai e o casamento e por **id**.

**A reserva por nome fica**, e nao e indecisao: a forma do permalink foi lida do CODIGO, nao medida
na pagina dele. Sem reserva, um formato diferente deixaria **tudo** como pendente e ele responderia
a base inteira duas vezes. Por id quando o id veio; por nome so nas respostas que nao trouxeram id.
**Errar mostrando demais e barato; esconder quem nunca foi respondido nao e.**

### E a barra passou a dizer quando a pessoa escreveu mais de uma vez

Em ambar, ao lado do nome:

```
Marta Fictinha   2º de 2 desta pessoa · 1 ja respondido   Estou com o Flavio 22
```

Numa barra que mostra **uma pessoa por vez**, sem isso ele repete a mesma frase para a mesma pessoa
— e repeticao e o maior sinal de maquina respondendo (12/09). O da vez nao entra na propria conta,
e quem escreveu uma vez so **nao ganha marca**: alarme que toca sempre se aprende a ignorar.

**A prova de regressao e o defeito reintroduzido:** voltando a casar por nome, a assercao *"o OUTRO
continua esperando"* cai sozinha. Medido.

---

## 11. Os digitos 2, 3 e 4 viraram acoes (v3.190.0)

**Pedido dele:** *"troque a funcao do botao dois para curtir a mensagem, botao 3 para ocultar a
mensagem, botao 4 responder a mao"*.

A tira ficou assim, no painel e na barra:

```
1 Apoio   [2 Curtir] [3 Ocultar] [4 Responder a mao]   5 Dia 25   6 Pro privado   7 ...
```

As respostas rapidas ficam com o **1** e seguem do **5** em diante — nenhuma se perdeu.

### Um mapa so, senao o botao promete uma coisa e a tecla faz outra

`ACOES_DA_TIRA` + `doDigito` sao a fonte unica: o rotulo do botao e o que a tecla executa saem do
MESMO lugar. Duas listas divergiriam na primeira correcao, e aqui a divergencia seria o botao
dizendo *"3 Ocultar"* e a tecla 3 mandando uma resposta pronta na pagina dele.

### Clicar e agir na pagina dele, entao o casamento e justo

`botaoDoComentario` procura por **texto exato** e **dentro do article**. A fileira medida em 19/10
e `Curtir | Responder | Enviar mensagem | Ocultar`:

- **"contem"** faria "Ocultar" casar com *"Ocultar todos os comentarios desta pessoa"*;
- **buscar no `document`** pegaria a fileira do comentario VIZINHO — curtir ou ocultar a pessoa
  errada.

### Curtir nunca DESCURTE

O botao do Facebook e o mesmo nos dois sentidos. `jaCurtido` tem **tres** estados — `true`, `false`
e **`null` para "nao da para saber"** —, e e a licao do `donoDoCanal` (25/09): colapsar "nao sei"
em "nao curtido" faria o painel desfazer o que ele fez.

- Ja curtido: **nao clica**, e a linha diz *"JA estava curtido — nao mexi"*.
- Na duvida: **clica**, porque a assimetria que importa e nao desfazer.
- Depois do clique **relê o botao**: so diz *"Curtido"* com a pagina confirmando; sem confirmacao,
  *"cliquei — confira na pagina"*. **O estado "curtido" do comentario nunca foi medido na pagina
  dele**, e a tela nao afirma o que nao leu.

### Ocultar clica e para ai

Abrindo dialogo ou menu, **quem confirma e ele**: clicar em botao de dialogo que ninguem mediu e
onde o estrago de verdade acontece — aqui, moderar a pagina dele por conta propria.

### Curtido e ocultado NAO viram amarelo — e so o ocultado sai da fila

Amarelo significa *"ja tem resposta nossa"*, e curtir nao e responder. Eles ganham marca propria,
em cinza (`· curtido`, `· ocultado`).

**Correcao dele, no mesmo dia:** *"ao curtir nao precisa pular a mensagem, somente ao responder"*.
Entao:

- **Curtir FICA no comentario.** E um complemento, e a resposta pode vir logo depois para a mesma
  pessoa — o realce nao se move e ele continua na fila.
- **Ocultar PULA.** Nao ha o que responder num comentario oculto: deixar o cursor nele seria beco
  sem saida.

Sao **duas perguntas, e por isso dois campos**: `marca` (o que ele fez — a tela) e `foraDaFila` (se
ainda espera — a fila). `proximoPendente` so le o segundo; quem decide o porque e o painel.

**So memoria, nunca armazenamento:** gravar faria o painel esconder gente numa sessao futura por
causa de um clique que ninguem lembra. No F5 eles voltam, e quem decide e a pagina.

### Medido

- 26 suites verdes, com teste novo para os tres botoes (17 assercoes, metade sobre o que **nao**
  pode ser clicado).
- O smoke do painel num DOM falso prova que **o clique cai no comentario DA VEZ e nao no vizinho**,
  que a tira numera `1, 2, 3, 4, 5...` na ordem certa, que a linha de status conta o que fez e que
  **depois de curtir o realce NAO se move**.

**O que fica em aberto:** o rotulo do botao de curtir ja curtido (*"Descurtir"*?) e o que acontece
ao clicar em **Ocultar** (dialogo? menu?) **nao foram vistos na pagina dele** — as duas coisas
aparecem no primeiro uso, e a tela diz "confira na pagina" em vez de afirmar.

---

## 12. O amarelo na volta do comentario selecionado, NA PAGINA (v3.192.0)

**Pedido dele:** *"faca uma marcacao amarela na volta do comentario selecionado"*.

No modo de responder o painel esta guardado e ele le a **pagina**. A barra diz o NOME de quem esta
na vez — e nada mostrava ONDE. E o mesmo contrato do realce da lista (**o que esta aceso diz onde a
tecla bate**), so que aqui a tecla escreve num comentario publico.

### `outline`, nunca `border`

Borda muda o tamanho do elemento e **empurra o layout do Facebook**; outline desenha por cima, sem
ocupar espaco. E o **offset e negativo** (`-1px`): com offset positivo o traco some quando o
container do comentario corta o que transborda.

### O defeito desta funcao e o RASTRO

Sem limpar o anterior, andar pela fila com as setas deixa **meia pagina amarela** — e o realce para
de dizer onde a tecla bate, que e a unica coisa que ele existe para dizer. Por isso
`realcarComentario(no, antigo)` recebe os dois e `estado.realcado` e quem lembra.

**E o valor que estava la volta.** O comentario e elemento da pagina DELE: limpar para vazio
apagaria um inline-style do Facebook se um dia existir.

### Reposto a cada tique, e nao so no desenho

O DOM e virtualizado: rolando, o Facebook **troca** o article do comentario, e o amarelo iria
embora com o no antigo — justo enquanto ele rola para ler o que vai responder. O realce e reposto
na vigia (700ms) e no laco de 2s, reachando o article **pelo id**.

**Painel escondido tira o realce:** amarelo na pagina sem nada na tela explicando o que significa e
sujeira no Facebook dele.

### Medido

- 11 assercoes novas, e metade e sobre o rastro e sobre devolver o que estava la.
- O smoke do painel prova, num DOM falso, que **o da vez fica amarelo e o ja respondido nao**, que
  **a seta leva o amarelo junto sem deixar rastro**, e que **esconder o painel limpa a pagina**.

---

## 13. O Enter nao pulava para o proximo (v3.193.0)

**Relato dele:** *"ao mandar o enter nao esta pulando para o proximo comentario"*.

### A causa: a prova do envio era UMA so, e ela depende de um rotulo

O avanco acontece quando a **resposta aparece no post** — o mesmo sinal do amarelo. Ler isso exige
o `aria-label` da resposta, e `lerRotulo` **so aceita rotulo com o marcador de tempo**:

```
RE_RESPOSTA = ^resposta de (.+?) ao comentario de (.+?)\s+h[aá]\s
```

A resposta **recem-criada pode nao ter o "ha ..." ainda** — item fresco no Facebook aparece como
*"Agora"*. Sem rotulo lido, a resposta existe na tela e **o painel nao a ve**: nada fica
respondido, e o avanco nunca acontece. Um minuto depois ela viraria *"ha 1 minuto"* e passaria a
ser lida — tarde demais para quem esta percorrendo a fila.

**Nao afrouxei o `lerRotulo`.** Qual e o rotulo de uma resposta recem-enviada **nao foi medido**, e
relaxar a guarda por hipotese marcaria como respondido quem nunca foi — o erro caro deste painel.
**O conserto nao depende de rotulo nenhum.**

### A segunda prova e o TEXTO, com duas condicoes

O painel guarda o trecho que `inserirNaCaixa` **confirmou** ter entrado (os mesmos 20 caracteres
que ela usa para conferir, e so quando a insercao devolveu `true`). Dai:

```
saiu da caixa   E   continua na pagina   ->  foi enviado, segue para o proximo
saiu da caixa   e   sumiu da pagina      ->  ele so FECHOU a caixa: nao anda
continua na caixa                        ->  nada aconteceu ainda
```

**As duas metades importam.** So a primeira acusaria envio quando ele fecha a caixa sem mandar — e
**avancar sem envio esconde da fila quem nunca foi atendido**. A caixa *sumir* tambem conta: quem
decide e o texto estar na pagina.

### A linha de status diz por qual prova andou

```
Resposta a Marta apareceu no post.                      <- prova forte
O texto saiu da caixa de Marta — segui sem ver a        <- prova fraca
resposta no post. (rotulo que nao entendi: "...")
```

**O rotulo citado e a medicao que falta.** Vendo essa segunda linha, e so me dizer o que esta entre
aspas: e ele que diz por que a prova forte falhou, e com ele a prova forte volta a funcionar sem
hipotese nenhuma.

### A print dele confirmou a causa, e nao por deducao

Depois da v3.193 ele mandou a tela com a resposta **ja enviada** e o painel parado:

```
Capitao Martim
Leandro Reus Seguimos juntos, Flavio 22!
Postando...                                 <- no lugar do carimbo de tempo

[Responder a Leandro Reus]                  <- uma caixa NOVA, vazia
```

**"Postando..." e exatamente o que faltava:** `lerRotulo` exige o `ha ...`, e enquanto o Facebook
nao confirma a resposta esta na tela e o painel nao a ve. **A prova forte so volta quando o carimbo
chega** — a fraca e quem cobre essa janela.

**E a caixa nao some: o Facebook abre uma nova, vazia, com o mesmo rotulo.** A prova fraca funciona
nos dois desenhos porque pergunta se o TEXTO saiu da caixa, nao se a caixa existe.

### A versao foi para a BARRA

```
6 de 23 · 17 esperando · v3.194.0
```

No modo o painel esta guardado, e e no modo que ele relata defeito. **Sem a versao na tela, "o fix
nao funcionou" e "o fix nao chegou" produzem a MESMA print** — e este projeto ja perdeu uma tarde
consertando codigo que nunca tinha rodado.

### Medido

- O smoke do painel, num DOM falso, prova as tres situacoes: **inserir sozinho nao pula**, **caixa
  limpa sem o texto na pagina nao pula** (ele so fechou a caixa) e **caixa limpa com o texto
  publicado PULA**, com a linha dizendo por qual prova.
- 26 suites verdes, `checar-modulos` e `checar-referencias` limpos.

---

## 14. Marcacao: o painel estava no caminho dela (v3.195.0)

**Pedido dele:** *"preciso que ao comentar tambem consiga fazer marcacao"*.

### A causa: as setas do modo sao as teclas do menu de marcacao

**Marcacao no Facebook nao e texto: e uma ESCOLHA.** Digitar `@` abre um menu, e a marcacao so
existe depois de escolher um nome ali — com **↑ ↓ e Enter**.

E no modo de responder, desde 21/10, a guarda de campo de texto tem **uma excecao justamente para
as setas** (foi o que permitiu andar na fila com o foco dentro da caixa). Entao:

```
ele digita "@Mar"   -> o menu do Facebook abre
ele aperta ↓        -> o PAINEL troca de comentario
                       soltarOFoco() fecha o menu
                       o nome meio digitado vai junto
```

**A marcacao nunca podia ser concluida**, e nada na tela dizia por que. Medido no codigo
(`facebook-main.js`, a excecao `passamNoCampo`), nao na pagina.

### O conserto: a seta volta a ser do Facebook no instante exato

Sem `preventDefault` — e isso que a deixa chegar ao menu — e **com a linha de status dizendo para
onde ela foi**, senao uma seta que nao faz nada e um defeito novo aos olhos dele.

Quem responde "o menu esta aberto?" tem **duas portas**:

| porta | le | medido? |
|---|---|---|
| `menuDeMarcacaoAberto` | ARIA da caixa (`aria-activedescendant`, `aria-expanded`, `aria-controls`) | **nao** — o menu nunca foi aberto com o CDP ligado |
| `mencaoInacabada` | so o TEXTO da caixa: termina em `@...` sem espaco | sim, no proprio texto |

A segunda existe porque a primeira e hipotese. E ela **so e consultada quando o painel comecou a
marcacao** (a tecla M): a caixa de resposta **ja nasce com a mencao dentro**, e vindo sem espaco no
fim essa leitura travaria as setas no instante em que a caixa abre — a navegacao inteira do modo.

**O espaco no fim e o que diz que a marcacao acabou.** Escolhido o nome, quem continua escrevendo
digita um espaco antes da frase.

### A tecla M escreve "@Nome" e PARA AI

```
M  ->  abre a caixa, escreve "@Marta Fictinha", letra por letra
       e nao clica em nada
```

**Quem escolhe no menu e ele.** Clicar numa opcao que ninguem conferiu **marcaria um estranho num
comentario publico**, com o nome dele em cima — a mesma fronteira do "Ocultar", que clica e para.

Tres decisoes que vao junto:

- **Letra por letra**, porque o menu reage a cada `input` e **se ele abre com uma insercao unica de
  quinze caracteres nao foi medido**. Teclar e o caminho provado; a funcao o imita.
- **Duas palavras, sem emoji** (`nomeParaMarcar`): o nome que o Facebook mostra carrega emoji
  (`"Marta Fictinha 🇧🇷"`), e digitado inteiro devolveria lista vazia — a marcacao falharia sem
  ninguem entender por que.
- **NAO solta o foco**, ao contrario de todo o resto do modo: o menu morre com o blur. O preco esta
  na status — enquanto a marcacao esta aberta os digitos 1..9 estao barrados, e voltam quando ele
  escolhe o nome e digita um espaco.

**O Esc ganhou camada:** com a marcacao aberta ele fecha o MENU; sem ela, para o modo.

### O que a medicao pegou e eu nao previ

A primeira versao de `mencaoInacabada` exigia **uma palavra so** (`@[^\s@]+$`) — e **nao
reconhecia `"@Marta Fictinha"`**, que e exatamente o que a tecla M escreve. O smoke acusou a seta
sendo roubada no meio da marcacao. Hoje o teto e **tres palavras**, com o custo escrito: uma
palavra depois do nome e a seta continua indo para a pagina.

### Medido

- `tests/dom-facebook.test.mjs`: 39 assercoes novas nos quatro pontos (o nome, os tres sinais de
  ARIA, o texto, e o `comecarMencao` que **nao clica em opcao nenhuma**).
- O smoke do painel, num DOM falso: o **M acrescenta** `@Nome` na caixa, a seta com a marcacao
  aberta **nao e impedida e nao troca de comentario**, e depois do espaco ela volta a andar na fila.
- 26 suites verdes, `checar-modulos` e `checar-referencias` limpos.

---

## 15. A barra do modo cobria o post; hoje ela empurra (v3.196.0)

**Print dele:** o painel no ar, a barra ocupando a faixa de baixo do post — *"bote pro lado, em
baixo esta atrapalhando a visualizacao"*.

### A causa era um argumento meu, e ele estava escrito no CSS

```
/* O MODO DE RESPONDER: barra fina embaixo, e a tela inteira e do post.
   Ela NAO empurra a pagina (o dock e soltado) de proposito -- esconder a
   extensao foi metade do pedido dele. */
```

**O que flutua cobre.** A barra nao tirava largura do post, entao ficava POR CIMA — e justamente
sobre o fim da lista de comentarios, que e onde esta quem ainda nao foi respondido. Na print, o
comentario da Sueli esta metade atras dela.

### O conserto ja estava medido, de 19/10

O painel **empurra** a pagina (`dock.js`), e o **modal do post se recentra na area encolhida**.
Entao coluna na lateral **nao cobre nada**:

```
antes:  [ ---------- post ---------- ]      barra flutuando por cima do rodape
agora:  [ ------ post ------ ][ coluna ]    o modal se recentra sozinho
```

A coluna reusa **a largura e o `applyDock` do painel**. Largura propria ou empurrao proprio
divergiriam do painel na primeira semana — a mesma razao pela qual o painel do Facebook reusa o
`dock.js` em vez de ter o seu.

**"Esconder a extensao" continua valendo onde ele pediu:** o painel de LISTA sai da tela; o que
fica e a tira de teclas, agora ao lado.

**O texto do comentario ganhou tres linhas** na coluna: numa faixa de 380px uma linha so mostraria
duas palavras.

### Medido

- O smoke confere o **EMPURRAO**, nao o CSS: no modo, o `<html>` continua com a classe do dock.
  **Reintroduzindo a condicao antiga, a assercao cai** — conferido nos dois sentidos.
- `checar-modulos` acusou uma crase que eu pus num comentario DENTRO do `css()` (a terceira vez
  neste arquivo). Corrigida antes de qualquer teste rodar.
- 26 suites verdes, `checar-modulos` e `checar-referencias` limpos.

---

## 16. So emoji: a pessoa sumia da fila (v3.197.0)

**Print dele:** tres comentarios no post, dois deles so com emoji (as palmas, a bandeira, o 22) —
e o painel so enxergava o do meio, o unico com texto escrito.

### Medido antes de mexer, nos dois formatos em que o emoji chega

```
emoji como TEXTO no innerText -> limparTextoDoComentario devolve os emoji inteiros
emoji como <img>              -> innerText nao traz linha de corpo -> texto ""
```

Era o segundo. E `comentariosDoPost` tinha, no filtro, um **`c.texto &&`** escrito no dia em que o
painel nasceu (19/10) e **nunca medido**: sem corpo legivel, a pessoa era **descartada em
silencio** — e a tecla so alcanca quem esta na lista.

### Duas metades, e a regressao mostra qual cobre o que

| metade | o que resolve |
|---|---|
| ler o `alt` das imagens (`emojiDasImagens`) | o **corpo** da linha: a lista mostra os emoji |
| tirar o `c.texto &&` | a **fila**: quem nao tem corpo legivel nenhum volta a ser atendido |

Reintroduzindo **so o filtro**, cai o teste do *so figura*; reintroduzindo **as duas**, caem
tambem os do emoji — conferido nos dois sentidos. **O filtro e a metade que nao depende de como o
emoji chega na pagina dele.**

### A peneira do `alt` e lista de permissao, por FORMA

Alt com **letra** nao entra: *"Foto de perfil de Maria"* e *"Pode ser uma imagem de duas pessoas"*
sao legenda da plataforma, nao fala da pessoa — e entrariam no prompt da IA como se fossem. Exige
tambem um caractere fora do ASCII, senao um icone com `alt="-"` passaria por emoji.

**Comentario so com FIGURA ou GIF continua com `texto` vazio, de proposito.** Quem escreve
*"(sem texto — emoji, figura ou GIF)"* e a **tela**, em cinza e italico. Rotulo nosso dentro do
dado iria para o prompt da IA e para a caixa de resposta como fala dela.

### E a IA nao e chamada sem texto

A chamada **nem sai**, com o motivo na barra: pagar para o modelo inventar o que um aplauso quis
dizer e a familia do `naoHaOQueResponder` (24/09). Um emoji pede uma resposta rapida (1, 5..9) ou
o **Curtir** (2).

### Medido

- `tests/dom-facebook.test.mjs`: os dois formatos de emoji, a peneira do `alt` item a item, e a
  lista trazendo o so-emoji **e** o so-figura.
- O smoke do painel ganhou um comentario so com emoji: ele **aparece na lista** e a linha mostra os
  emoji. Com o codigo antigo, as duas assercoes caem.
- 26 suites verdes, `checar-modulos` e `checar-referencias` limpos.

---

## Para usar

**Recarregue a extensao** (`chrome://extensions` -> recarregar) e abra um post. O cabecalho tem de
dizer **v3.197.0** — e assim que se sabe que chegou. **No modo de responder a versao fica na
coluna**, ao lado da contagem.

## O que falta, e e decisao dele

- **Comentario de uma palavra** (**"22"**, boa parte desta pagina): agora ha o botao rapido, que era
  o que faltava. `facebook.pedeRascunho` continua existindo e sabendo quando nao vale pagar;
  **ligar isso para a IA nem ser oferecida nesses casos e escolha dele.**
- ~~Trocar a ordenacao para "Todos os comentarios"~~ — **decidido em 20/10: nao.** Ele trabalha
  nos relevantes de proposito, e o alarme saiu (secao 5).
- **805 KB em toda aba do Facebook.** Da para cortar para ~38 KB movendo a IA para `import()` sob
  demanda. Agora que ha caminho sem IA, o corte vale ainda mais — mas so depois de ele confirmar
  que o botao IA funciona de verdade.
- **A aba Facebook da Graph API (v3.172) continua no ar** e sai quando ele confirmar que este
  caminho substitui.
- **"Ler tudo" trouxe 19 de 51 na ultima medicao DELE**, com a v3.186. Os tres consertos da secao
  8 miram exatamente isso, e **a conferencia e ele rodar de novo**: quantos vem agora, e, parando
  antes do fim, qual o texto do botao que sobrou.
- **O texto rapido "Dia 25 — 2o turno" EXPIRA em 25/10.** Passada a data ele sai do painel ou e
  reescrito — texto com data dentro envelhece sozinho.
- **Os tres sinais de ARIA do menu de marcacao nao foram medidos na pagina dele.** Se o `M
  Marcar` escrever o `@Nome` e a seta **continuar** trocando de comentario, a porta que faltou e
  a do ARIA — e a reserva (`estado.marcando` + o texto) e que esta decidindo. **Nao abrindo o menu
  nenhuma vez**, o que resolve e medir com o CDP: abrir a caixa, digitar `@` a mao e ler os
  atributos da caixa.
- **O custo por rascunho nao foi medido ao vivo.** Calculado: **572 tokens de sistema + ~37 do
  comentario**, o que da ~**US$ 0,0014 por rascunho** no gpt-5, a frio. O numero real aparece no
  painel depois do uso.
