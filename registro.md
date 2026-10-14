## 2026-10-14 — v3.149.0 — a eleição já aconteceu, e o dossiê estava escrito no futuro

**Pedido dele:** *"pesquise e atualize o dossiê"*.

A pesquisa achou uma coisa que muda o arquivo inteiro antes de qualquer linha de detalhe: **o
primeiro turno foi em 04/10/2026, dez dias atrás**, e o dossiê estava todo no futuro — *"candidato à
reeleição"*, *"concorre ao Senado"*, uma colinha pedindo voto em seis cargos.

### O que foi apurado (pesquisa de 14/10/2026)

| cargo | nome | resultado |
|---|---|---|
| Presidente | Flávio Bolsonaro (22) | **2º TURNO em 25/10** — 47,03% × 45,16% do Lula |
| Governador | Zucco (22) | **ELEITO** no 1º turno, 58,05% |
| Senador | Sanderson (222) | **ELEITO** — 3.453.316 votos |
| Senador | Marcel Van Hattem (300) | **ELEITO** — 3.449.053 votos |
| Deputado Federal | Felipe Pedri (2228) | **NÃO ELEITO** — 12.810 votos, 65º |
| Deputado Estadual | **Capitão Martim (10122)** | **REELEITO** — 37.589 votos, 41º de 55 |

**Ele cresceu 29%**: 29.040 em 2022 para 37.589 agora.

**Cinco dos seis cargos estão decididos.** O único que ainda pede voto é a Presidência, e só até
**25/10**.

### A consequência, que é maior que o dossiê

**Pedir voto para deputado, senador ou governador hoje é pedir voto numa eleição que acabou** — e
quem recebe isso entende, corretamente, que do outro lado não há ninguém acompanhando. Isso entrou
em **três lugares que CHEGAM ao prompt**, e não num só: a regra 5 do *"como a IA deve usar este
arquivo"*, o primeiro item do *"o que a IA NUNCA deve afirmar"*, e um parágrafo colado na própria
**regra da colinha** — porque regra longe do pedido não é cumprida, que é lição registrada deste
projeto desde 07/09.

**A regra da colinha NÃO foi mudada por mim.** Ela é decisão dele de 09/09 e a lista completa
continua escrita como ele a definiu; o que entrou foi o fato de o mundo ter mudado, para ninguém
mandar a lista de ontem sem ter escolhido mandá-la.

### Duas armadilhas pegas ao escrever, e as duas eram silenciosas

**1. A tabela da chapa é LIDA POR CÓDIGO, por POSIÇÃO.** `gabinete.chapaDoDossie` pega `cargo`,
`nome` e `número` das três primeiras colunas, e isso alimenta `ia.conferirChapa` — a trava que
impede o rascunho de colar o número de um no nome de outro. Eu pus o partido **dentro da célula do
nome** (*"Flávio Bolsonaro (PL)"*), e `conferirChapa` procura o **nome literal** no rascunho: ela
deixaria de achar a pessoa e **pararia de barrar em silêncio**, sem teste nenhum caindo. O partido
virou coluna própria, depois do número, e **há teste novo** exigindo as 6 linhas, nome sem
parênteses e número só de dígitos.

**2. Linha `> ` NÃO chega à IA.** `semBlocoDeRevisao` corta as linhas de citação — está registrado
desde 07/09 e eu caí nela assim mesmo: escrevi os dois avisos mais importantes do dia dentro de
blocos `>`, e a medição mostrou **CORTADO** nos dois. Pior que não escrever: a regra da colinha
chegava à IA **sem** o aviso de que tinha envelhecido. Hoje o que o modelo precisa ler é prosa
normal, e o que é para humano continua em `>`.

### Um falso alarme meu, registrado porque quase virou conserto

Medi `chapaDoDossie()` e veio **0 entradas** — eu já ia consertar o leitor. A função recebe o TEXTO
por argumento e eu a chamei vazia; e `chapa()`, que lê o arquivo, usa `fetch`, que **no Node puro
não abre `file://`** (armadilha registrada). Passando o texto do disco, ela devolve as 6 certas. **A
medição que parecia defeito era a minha chamada.**

### O que ficou em aberto, e é decisão dele

- **O disparo da colinha continua configurado** (`mensagens.txt` da branch `claude/disparo-celular`,
  com os seis números e *"deixa salva para consultar na hora de votar"*). Como está, ele pede voto
  em cinco eleições decididas.
- **Felipe Pedri tem perfil próprio na extensão** (o login de candidato, de 24/09) e não foi eleito.
  O dossiê registra o fato e **proíbe a IA de anunciar a derrota de alguém** — o que fazer com o
  perfil é dele.
- **A posse da 57ª legislatura** ficou `[CONFERIR]`: fevereiro de 2027 não foi conferido em fonte
  oficial.

### Fontes e disciplina

O **portal do TSE recusou leitura automática (HTTP 403)**, então a apuração veio de veículos que a
publicaram, com mais de um onde deu. A **data do 2º turno foi conferida à parte** porque duas fontes
discordaram (uma dizia 30/10): é **25/10**. Está escrito no arquivo que, divergindo do TSE, **o TSE
vence**.

**Custo medido:** o trecho do dossiê que entra no prompt foi de 22.211 para 25.497 caracteres
(~6.346 → ~7.285 tokens), **+14,8%**, e só quando a conversa puxa o dossiê.

