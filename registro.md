## 2026-10-15 - v3.162.0 - o agradecimento pelo apoio saia duas vezes, em variantes diferentes

**Print dele:** as **13:11** saiu *"Que bom ler isso, obrigado pelo apoio e pelo carinho de sempre.
Seguimos lado a lado. Que Deus abencoe voce e sua familia!"*; ela respondeu *"Amem firme dia 25 e
22"*; as **13:48** saiu *"Muito obrigado pelo apoio e pelo carinho — palavra como a sua da forca
para seguir. Seguimos juntos nessa caminhada. Que Deus abencoe voce e sua familia!"* — e ele apagou.
*"novamente repeticao, a pessoa finalizou a conversa, o certo seria mandar algo finalizando tambem
(uma mensagem curta, tipo abraco e encerrar) ou nem mandar"*.

### NAO foi a IA, e a medicao disse isso antes de eu mexer em qualquer coisa

Os dois textos sao `agradecer-apoio` **byte a byte**: o de 13:11 e a **variante 2** e o de 13:48 e o
**texto base**. **O revezamento entre as tres formas fez a mesma resposta parecer outra.**

**A prova de que o caminho nao era a IA:** `semRepetirONosso` TIRARIA a frase identica (*"Que Deus
abencoe voce e sua familia"*) — medi, ela devolve o texto sem ela. A frase saiu inteira, entao o
texto nunca passou pela revisao: resposta pronta nao passa por la. Eu ia consertar o prompt pela
terceira vez e teria consertado o lugar errado.

### E a armadilha de 02/09 numa porta nova

*"Conferencia de duplicata tem que cobrir todo o conjunto que pode sair, nao o item sorteado."*
Naquele dia a licao foi aplicada ao **modelo padrao** com rodizio; **as respostas prontas com
variantes ficaram de fora**, e `agradecer-apoio` tem tres formas.

### A trava mora no SINAL, como a da negativa

`templates.ehAgradecimentoDeApoio` reconhece o agradecimento pelo INVARIANTE (agradecer + apoio ou
carinho), nunca por id de template nem por fatia de texto — as duas licoes que ja custaram caro. O
painel cala `soExpressaApoio` quando ele ja saiu nesta conversa.

**No SINAL e nao numa excecao da caixa**, pela mesma razao da trava da Cleonice (06/09): excecao so
chegaria depois de ele importar o quadro, e esta precisa valer hoje. **Medido: vale no quadro dele
sem importar nada.**

**E o ajudante nao foi duplicado:** `negativaJaSaiu` virou `respostaJaSaiu` e o mapa virou
`INVARIANTE_DA_RESPOSTA` — ele ja respondia exatamente *"esta resposta pronta ja saiu nesta
conversa?"*, por id E por invariante. Duas copias da mesma pergunta divergiriam na primeira
correcao.

### O desfecho e uma das duas saidas que ele pediu

**Medido:** calado o sinal, quem decide e `ja-respondemos-antes` -> **tecla 3**, que **conclui sem
enviar nada** — o *"ou nem mandar"* dele. E e um desfecho SILENCIOSO, entao a guarda nao empurra o
caso para nenhuma caixa que envie (a licao da Noeli, 06/09).

**A outra saida que ele ofereceu — *"uma mensagem curta, tipo abraco e encerrar"* — nao foi feita**,
e esta dita a ele: e um texto novo, e texto que sai para eleitor e dele.

### A COBERTURA e o que torna o invariante seguro

Ele CALA o agradecimento, entao casar numa resposta vizinha deixaria a rodada muda onde ela deve
falar. Medido contra **todas** as respostas de fabrica, uma a uma: **3/3 das formas de
`agradecer-apoio` e ZERO falsos positivos**. As duas guardas sairam dessa medicao:

- **a confianca sozinha nao conta** — `perguntar-como-ajudar` diz *"obrigado pela mensagem e pela
  confianca"*, que agradece a MENSAGEM;
- **mensagem que tambem PEDE O CADASTRO nao e o agradecimento** — `pedir-dados-evento-nao` abre
  agradecendo o apoio e existe para outra coisa.

### O que fica em aberto, e e dele

**"Amem firme dia 25 e 22" nao e reconhecido como despedida** (`ehDespedida` = false, medido). Hoje
o caso se resolve pela trava do agradecimento; se ele quiser que encerramento assim seja reconhecido
como tal, e lista de vocabulario — e este projeto ja aprendeu cinco vezes que essa lista nao fecha.

### Medido

- 21 suites e os dois verificadores verdes.
- A trava e **uma vez por CONVERSA**, como as negativas. Conversa longa (a sessao pode durar
  semanas) so recebe o agradecimento uma vez — dito a ele, e afrouxar e uma linha.
