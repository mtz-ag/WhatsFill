## 2026-10-16 - v3.167.0 - ESTADO DE AGORA - por que o formulario seco continua saindo

**Pergunta dele**, com a print do Vanderlei: *"veja porque essa mensagem continua sendo mandada e me
mostre o motivo"*. Ele escreveu **"Flavio bolsonaro 22"**, so isso, e recebeu o `pedir-dados` seco
(ATENCAO! Nome , Cidade + o Instagram e o grupo). Ele apagou a mensagem.

### O motivo, medido, e tem DOIS andares

**1. Nenhum detector enxergou nada.** Rodei os doze sobre o texto dele: **todos nulos**, inclusive
`soExpressaApoio` — uma declaracao de voto no nosso candidato do 2o turno chegou ao quadro como
**silencio**.

**Por que:** os padroes de apoio **com nome** exigem um VERBO (*"vou votar no Flavio"*, *"eu apoio
o Flavio"*), e os **com numero** exigem posicao ou companhia (*"22"* abrindo a mensagem, ou colado
num verbo). **Nome e numero juntos, sem verbo, nao eram nada.**

Medido, e o resultado e o avesso do esperado:

| o que ela escreve | antes | agora |
|---|---|---|
| `22` | **apoio** | apoio |
| `E 22!` | **apoio** | apoio |
| **`Flavio bolsonaro 22`** | **nada** | **apoio** |
| **`Capitao Martim 10122`** | **nada** | **apoio** |

**Por o nome ao lado do numero APAGAVA o apoio** — e essa e a forma que a propria colinha imprime
(`Capitao Martim - 10122`) e a mais curta de declarar o voto. E a licao do *"queria uma reuniao"*
(09/09): **a lista era toda de verbos, e ele escreveu a coisa.**

**2. E mesmo reconhecido, o desfecho da print NAO muda.** Medido nos dois motores, com a composicao
do painel: **tabela 4 e quadro 4**, `nunca-pediram-dados`, nas duas versoes. Os dois motores
concordando no desfecho e problema de CONDICAO, nao de posicao — e a condicao e esta: **a guarda de
14/10 (*"sem recibo para mandar, o formulario seco vira a mensagem do dia"*) so vale para quem veio
de ANUNCIO.** O Vanderlei escreveu sozinho, entao a guarda nao o alcanca.

**Medir o sinal nao basta: tem de medir a ORDEM** — quinta vez.

### O que entrou

`NOME_DA_COLINHA` + `NUMERO_DA_COLINHA` colados valem como apoio, nas duas ordens e com o traco da
colinha. **A guarda e o proprio par:** o numero sozinho e endereco, hora e idade — ao lado do nome
de um dos nossos, nao e mais nada disso.

Fora de proposito: **numero com unidade** (*"tem 22 anos"*, *"as 22 horas"*), **ordinal**
(*"ficou em 222o"*), **numero que nao e da chapa** e — o que a medicao pegou e eu nao tinha previsto
— **nome de RUA com numero** (*"rua Martim 22, bairro centro"*), que e o que mais chega depois que
pedimos o endereco para o material: marcar apoio ali faria a rodada agradecer em vez de etiquetar.

**9 de 9** formas reconhecidas, **11 de 11** falsos positivos barrados. Metade das assercoes do
teste novo e falso positivo.

**O efeito pratico:** quem **ja tem etiqueta de cidade** e escreve so o nome e o numero passa a ser
**agradecido** (tecla `i`) em vez de receber a mensagem do momento. Quem **nao tem cidade** continua
recebendo o formulario — e e o segundo andar, abaixo.

- 21 suites e os dois verificadores verdes.

### A decisao que e dele, e e UMA linha

O formulario seco continuar saindo para quem **nunca foi perguntado e nao veio de anuncio** e o
escopo que EU escolhi em 14/10, a partir das duas prints daquele dia, que eram as duas de anuncio.
Tirando `veioDeAnuncio` da conta, **todo contato novo sem cadastro passa a receber a mensagem do dia
primeiro**, e o formulario vem na passada seguinte (`momentoJaEnviado` garante que nao repete).

**O preco:** o cadastro atrasa uma passada para a base inteira, e e por ele que a cidade e o COREDE
entram no CRM. **Nao mexi: diga e eu troco.**

### O que continua para ele

- **O TEXTO do `pedir-dados` ainda e o da campanha encerrada** — o Instagram e o link do grupo que
  aparecem na print sao dele e nenhum conserto meu os alcanca.
- **"tenho 22 anos e apoio quem trabalha"** ja contava como apoio ANTES desta versao (medido contra
  o commit anterior): vem do padrao do verbo *"apoio"*, nao do que entrou agora.
- **Passado 25/10 a regra 19 e o item 5 do dossie tem de ser reescritos** (v3.166).
