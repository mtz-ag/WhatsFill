## 2026-10-14 - v3.152.0 - 48 horas: passado o limite, so a mensagem do momento

**Pedido dele:** *"estou respondendo mensagens de 12 dias atras, preciso que mande so mensagem do
momento; bote um limite de 48 horas para seguir o fluxo normalmente, senao mandar mensagem do
momento"*.

### Mudar so a regua nao resolveria nada

A regra do tempo **ja existia** (`contexto-de-outro-dia`, de 04/09) e ja mandava a mensagem do
momento. O que ela nao fazia era **vencer**: era a **20a** da lista, e tudo acima dela decidia antes
-- por isso uma mensagem de doze dias ainda caia em `nunca-pediram-dados` (pede o cadastro),
`anuncio-modelo-e-dados` (manda o recibo), `pergunta-aberta` e `ultima-pede-resposta-pessoal`
(tecla 6, a IA escreve).

**O sinal estava certo e quem decidia era outra coisa.** E a licao que este arquivo pagou ontem, de
novo: **medir o sinal nao basta, tem de medir a ORDEM.**

### O que mudou

**A regua virou HORAS.** `cortesia.contextoPerdido` mede horas desde a ultima mensagem dela;
`deOutroDia` (dia local) continua existindo porque e **sinal do QUADRO** dele -- tirar sinal do
codigo descarta a caixa de quadro ja exportado, e o ramo sumiria sem ninguem pedir.

**O limite e DELE e vive na Config** (`auto.horasContextoPerdido`, nasce em **48**, `0` desliga).
Campo e nao constante pela licao do teto de 45 por numero (02/10): numero que ele ditou num dia volta
como trava que ele nao alcanca.

**A caixa subiu da 20a para a 7a posicao** -- logo abaixo das seis protecoes que significam "nao
mande nada" (sem interesse, assessor, ultima e nossa, presenca confirmada, endereco informado,
etiqueta que dispensa) e **acima de todo o resto**. Acima dela so esta o que nao envia.

### Tres excecoes vencem o limite, e uma delas e minha

As duas primeiras sao DELE e ja viviam na CONDICAO, entao valem onde quer que a caixa esteja no
quadro: **pergunta pendente** (04/09) e **material pedido** (05/09). Fechei tambem `perguntaAberta`,
que e chave diferente de `perguntaPendente` e ficaria de fora agora que a caixa subiu acima de
`pergunta-aberta` -- a excecao dele teria passado a valer pela metade.

**A terceira e minha e esta dita para ele poder cortar:** quem so se **DESPEDIU** nao recebe a
mensagem do momento. Sem ela, subindo a caixa acima de `ultima-e-despedida`, um *"obrigado, era so
isso"* de doze dias atras receberia propaganda.

### E uma inversao que e escolha dele

**"Pediu algo sem dizer o que" passou a PERDER para o tempo.** Ate hoje ia para a tecla 6 (gente
olha); passadas 48h, passa a receber a mensagem do momento. E o que a frase dele pede, e e o caso
mais sensivel da mudanca -- esta escrito no teste, com o motivo, para poder ser revertido.

### Armadilha pega ao escrever

Escrevi a guarda da despedida como `!c.ehDespedida` e **a chave do painel e `ultimaEhDespedida`**.
Regra que le chave que o painel nao escreve esta **morta** e o teste nao ve (18/09, a Rita) -- peguei
conferindo a regra vizinha, nao por teste. E o verificador de **caixa morta** do quadro acusou as
tres caixas do padrao assim que o sinal mudou de nome: o amostrador de contextos tambem precisava
conhecer `contextoPerdido`.

`tools/fluxo-padrao.json` regerado junto, como manda a regra de 03/09.

