## 2026-10-15 - v3.161.0 - anuncio desligado e sem recibo: sai a mensagem do dia, nao o formulario seco

**Pedido dele, dito duas vezes.** 14/10: *"ja e pra estar desativado e desativei na extensao tambem
a resposta, no caso era pra mandar mensagem do dia"*. 15/10, com outra print igual: **"mesmo caso
novamente"**. Na primeira eu medi, expliquei e **devolvi a decisao a ele**; ele repetiu, e repetir e
a decisao. Feito.

### O que a medicao mostrou, e ela e estreita

Nas duas prints ela chega pelo anuncio, escreve so o texto pre-preenchido e recebe o **formulario
sozinho** — que no texto DELE carrega o bloco de uma campanha encerrada (*"Ja aproveitando... post
novo no Instagram... entre no nosso grupo"*).

Medido nos tres cenarios da chegada:

- anuncio **nao reconhecido, SEM modelo** -> `nunca-pediram-dados`, tecla **4** (o formulario seco);
- anuncio **nao reconhecido, COM modelo** -> `anuncio-modelo-e-dados`, tecla **a** (recibo + dados);
- anuncio **reconhecido, COM modelo** -> a mesma tecla `a`.

Ou seja: **o formulario sozinho so aparece quando nao ha recibo nenhum para mandar**, que e o caso
do anuncio que ele desligou ou nunca cadastrou. E e exatamente ai que a frase dele se aplica.

### A mudanca mora no DESFECHO, e nao na posicao

`nunca-pediram-dados` ganhou tecla-FUNCAO: chegando por anuncio **nao reconhecido**, havendo
mensagem do momento **ainda nao enviada**, o desfecho e a **tecla 5**; no resto, continua sendo a 4.

Duas razoes, e as duas sao regra escrita deste projeto:

- **a guarda decide o DESFECHO, nao se a caixa casa** (a Noeli, 06/09) — barrar a condicao deixaria
  o caso escorregar para outra caixa que envia;
- **posicao e preferencia dele; excecao que ele nomeia vai na CONDICAO/desfecho** (04/09) — e e isso
  que faz valer **no quadro dele sem importar nada**. Medido: o arquivo 3.151.0 que ele importou da
  **tecla 5** com a mudanca, sem uma linha de alteracao no quadro.

### O cadastro nao se perde: atrasa uma passada

Saida a mensagem do momento, `momentoJaEnviado` passa a valer e a caixa **volta a pedir nome e
cidade** na passada seguinte — a mesma mecanica de `contexto-de-outro-dia`. Sem mensagem do momento
configurada, o formulario continua sendo o desfecho: nada fica mudo.

### O escopo e estreito, e tem assercao provando cada borda

- **havendo modelo**, quem decide continua sendo o recibo (`anuncio-modelo-e-dados`, acima desta);
- **anuncio RECONHECIDO** sem modelo continua pedindo o cadastro — ela clicou pedindo aquilo;
- **quem nao veio de anuncio** nenhum continua pedindo o cadastro.

### O verbete entrou no mesmo commit, e o teste corrigiu o selo

A janela promete o desfecho, e desfecho que envelhece vira mapa mentiroso — os `ramos` foram
escritos junto. **O selo continua `envia` e nao `depende`:** as duas saidas MANDAM mensagem, e o
checador acusou na hora que eu troquei (a regra esta escrita desde 03/09).

**E a matriz do teste ganhou os dois campos novos** (`veioDeAnuncio`, `anuncioReconhecido`): sem
eles a tecla 5 nunca apareceria e o teste acusaria o verbete de inventar um desfecho que existe de
verdade — o que ja aconteceu com o tempo em 03/09.

### Medido

- 21 suites e os dois verificadores verdes. O `fluxoPadrao` **nao mudou** (a mudanca e de desfecho,
  nao de arvore), entao `tools/fluxo-padrao.json` continua em dia e **ele nao precisa importar nada**.
