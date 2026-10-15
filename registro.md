## 2026-10-15 - v3.165.0 - a IA assume o encerramento

**Decisao dele:** *"deterministico para encerrar tem dado errado demais, a IA tera que assumir o
encerramento"*.

### O que falhava era o GATILHO, nao o desfecho

Todas as falhas medidas foram **falso NEGATIVO**: *"Amem firme dia 25 e 22"*, *"Tudo certo
obrigado"*, e **29 de 41** formas comuns de encerrar. Entao trocar a tecla da caixa nao resolveria
nada — **a caixa nunca casava**. O que precisava mudar era quem responde a pergunta.

E a pergunta *"ela esta encerrando?"* e **julgamento**, nao vocabulario: e a sexta vez que este
projeto aprende que lista de forma nao fecha. A saida e a mesma de `naoHaOQueResponder` (24/09) e
de `naoCabePedirOCadastro` (24/09).

### Onde mora: no SINAL, nao numa caixa nova

`ultimaEhDespedida` deixou de ser so a expressao regular. Quem decide continua sendo a caixa **"So
se despediu"**, na posicao em que ela ja esta — **vale no quadro dele sem importar nada**, que e a
razao de a trava morar no sinal (a da negativa, 06/09; a do agradecimento, 15/10).

### A porta e estrutural, e nao outra lista

So se pergunta a IA quando **NOS ja respondemos** (ha conversa para encerrar) **e ela escreveu
alguma coisa depois** — ou seja, exatamente nos casos em que hoje sairia mensagem.

**O vocabulario ficou como SIM BARATO.** Ele erra para o lado de nao ver (medido: 11 de 11 falsos
positivos barrados), entao quando ele reconhece nao ha o que conferir e a chamada nao acontece.
**Querendo que a IA decida sempre, e apagar uma linha** — custaria uma chamada em todo contato sem
mudar desfecho nenhum.

### Tres guardas mecanicas, cada uma com dono

- **pergunta pendente nunca e encerramento** — a guarda do `naoHaOQueResponder` e a regra dele de
  03/09 (*"tem pergunta nao conclui"*);
- **IA desligada ou sem chave decide como antes** — ele pediu que a IA assuma, nao que o
  encerramento deixe de existir sem ela;
- **falha, JSON ilegivel e certeza baixa viram "nao"**, que e o comportamento de hoje: manda.
  Concluir em silencio por erro de rede seria o lado caro.

**O corte e 0,8, acima do 0,7 da etiqueta, e de proposito:** etiqueta errada e organizacao interna
e ele desfaz; encerramento errado e uma pessoa que perguntou e nao recebeu nada, e disso nao fica
rastro na tela. **E este caminho nunca ACRESCENTA mensagem: so silencia.**

### A segunda metade, sem a qual nada chegava ao desfecho no quadro dele

*"Bom dia, tudo certo obrigado"* liga `ultimaEhDespedida` **e** `soCortesia`, e no quadro a caixa
**"so cumprimentou" (tecla 5, ENVIA) esta acima de "So se despediu" (tecla 3)** nos dois ramos do
retorno — medido: tabela da 3, quadro da 5. Reordenar o quadro dele e o que este projeto nao faz,
entao **o sinal e calado**: quem encerrou nao "so cumprimentou". E condicao, e condicao vale hoje.

### Medido, copiando a composicao do painel

| o que ela escreveu | hoje (so vocabulario) | com a IA |
|---|---|---|
| "Tudo certo obrigado" | 3 / 3 | 3 / 3 |
| "Bom dia, tudo certo obrigado" | 3 / 3 | 3 / 3 |
| **"Tchau"** | **5 / 5 (envia)** | **3 / 3 (conclui)** |
| **"Ate logo"** | **5 / 5 (envia)** | **3 / 3 (conclui)** |

*(tabela / quadro; 3 = conclui sem enviar nada.)* E *"Tudo certo, quando e o evento?"* continua
sendo respondida — ha teste exigindo isso.

**Custo, medido:** ~741 tokens de entrada, teto de 512 na saida, esforco baixo. Por conferencia:
**US$ 0,0013** no Haiku, **US$ 0,0021** no gpt-5, **US$ 0,0004** no gpt-5-mini e no Qwen. **So
acontece onde hoje sairia mensagem**, e cada chamada escreve uma linha no Andamento com o veredito,
o motivo e o custo.

**O que NAO foi medido, e esta dito:** quantas vezes por rodada isso acontece de verdade. O
amostrador sintetico dos testes nao serve — com 39 sinais a 35% as protecoes do topo vencem quase
sempre, e o numero que sai dali nao diz nada sobre a fila dele. **O numero real aparece no
Andamento, a partir da primeira rodada.**

- 21 suites e os dois verificadores verdes.

### O que fica para ele

- **A lista de vocabulario continua sendo dele**, e continua curta (onze formas + cinco amargas).
  Agora ela importa menos — e o atalho barato, nao mais a decisao. Querendo que a IA decida
  **sempre**, e uma linha.
- **No quadro, "so cumprimentou" continua acima de "So se despediu"**, e a tabela continua fazendo o
  contrario. Hoje isso nao morde mais (o sinal e calado), mas as duas ordens discordando e a
  assinatura de problema de posicao — e posicao e dele.
