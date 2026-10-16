## 2026-10-16 - v3.168.0 - ESTADO DE AGORA - voce esta certo: a caixa do anuncio nao confere anuncio

**Pergunta dele:** *"o fluxo do anuncio esta sobrepondo o fluxo dos sem anuncio, no momento todos os
anuncios estao desativados, ou estou errado?"*

**Ele esta certo**, e o mecanismo e mais simples (e pior) do que "sobrepor": **na chegada nao existe
um fluxo dos sem anuncio.**

### O que foi medido

**1. O ramo de cima do quadro se chama "anuncio — pessoa nova" e a condicao dele e
`!jaRespondemosAntes`.** Nao ha anuncio nenhum na conta: **todo contato com quem nunca falamos desce
por esse ramo**, tendo clicado num anuncio ou nao.

**2. A caixa "modelo + pedir os dados" (`anuncio-modelo-e-dados`) tambem nao confere anuncio.** A
condicao e: **ha modelo, e primeira vinda, sem etiqueta de cidade, cadastro nunca pedido**. Medido,
primeira vinda com modelo disponivel:

| quem e | desfecho |
|---|---|
| veio de anuncio LIGADO | tecla `a` |
| veio de anuncio DESLIGADO | tecla `a` |
| **nunca veio de anuncio** | **tecla `a`** |

E o `motivo` impresso na caixa e no Andamento dizia, nos tres casos, *"chegou pelo anuncio"*.

**Como quem nao veio de anuncio tem modelo:** o modelo PADRAO e guardado por `veioDeUmAnuncio` (a
regra dele de 04/09); a tabela **"Modelo por conteudo"** nao e — basta uma etiqueta de conteudo no
CRM, ou o texto dela casar com uma regra de conteudo.

**3. Desligar os anuncios NAO apaga `veioDeAnuncio`.** Sao dois sinais diferentes (armadilha de
02/09): `anuncioReconhecido` le a Config e fica **falso para todo mundo** com tudo desligado;
`veioDeAnuncio` le o **`utm` da plataforma** e a **etiqueta de origem no CRM**, e a Config nao o
alcanca.

**O que desligar tudo de fato mudou:** as tres caixas *"veio de um anuncio que eu reconheco"* do
ramo do retorno **nunca mais casam** — viraram caixas mortas, e quem caia nelas passou a cair nas de
baixo. Medido: o desfecho e o MESMO (tecla 1), so muda a caixa que decide. **No quadro inteiro so
UMA caixa le `!veioDeAnuncio`:** *"chegou sem anuncio e so cumprimentou"*.

### O que entrou nesta versao: so a VERDADE na tela

**Nenhuma mudanca de comportamento.** O `motivo` passou a dizer o que de fato casou (*"e a primeira
vez que falamos com ela e ha modelo para mandar"*), guardando *"chegou pelo anuncio"* para quando o
anuncio foi mesmo reconhecido; e o verbete da janela do fluxo abre dizendo **"NAO confere anuncio"**.

**E a linha do motivo que ele le para saber por que a mensagem saiu** — afirmar ali uma condicao que
ninguem conferiu manda procurar no lugar errado, a familia do log que dizia *"nao gravada"* e
gravava (07/09).

- 21 suites e os dois verificadores verdes.

### A decisao e dele, e sao DUAS linhas que andam juntas

**(a) Exigir `veioDeAnuncio` em `anuncio-modelo-e-dados`.** Medido, quem nao veio de anuncio cai em
`nunca-pediram-dados` -> **tecla 4, o formulario seco** — que e exatamente a mensagem do print do
Vanderlei. Sozinha, esta linha PIORA o caso de ontem.

**(b) Tirar `veioDeAnuncio` da conta de `nunca-pediram-dados`** (a linha que ja estava oferecida na
v3.167): sem recibo para mandar, sai a mensagem do dia e o cadastro vem na passada seguinte.

**Juntas:** quem vem de anuncio recebe modelo + cadastro; quem escreve sozinho recebe a mensagem do
dia e o cadastro depois. **O preco de (b) continua o mesmo:** o cadastro atrasa uma passada para a
base inteira, e e por ele que cidade e COREDE entram no CRM.

**O rotulo da caixa no quadro ("anuncio — pessoa nova") e dele e nao foi tocado** — renomear caixa do
`fluxoPadrao` por conta propria e o que este projeto nao faz, e ele teria de reimportar.
