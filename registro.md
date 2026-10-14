## 2026-10-14 - v3.156.0 - o limite de 48h nunca rodou: eu movi a regra na TABELA e nao na ARVORE

**Duas prints dele**, as duas com onze dias entre a fala dela e a nossa, as duas respondidas pela IA
e apagadas: o clique no anuncio de 03/10 e *"Nao, so fiquei com pe atras com essa filmagem"* de
03/10, as duas respondidas em 14/10. E a terceira print: o rodape da janela do fluxo dizendo
**"Quadro: de um arquivo 3.151.0 · extensao 3.155.0 · em dia com o padrao"**.

### Eu estava errado ontem, e o rodape dele estava certo

Ontem eu disse que o quadro dele estava atrasado na posicao. **Nao estava.** A arvore do padrao de
hoje e o arquivo 3.151.0 sao IDENTICOS - `contexto-de-outro-dia` em 17o lugar nos dois.

O defeito e meu e e outro: na **v3.152 eu movi a regra de 20o para 7o na LISTA (`sugestao.js`) e nao
movi a caixa na ARVORE (`fluxoPadrao`)**. A lista so decide quando nao existe quadro; **a arvore e o
motor sempre que existe**, e ele tem quadro. Entao a regra que ele pediu nunca rodou uma vez.

**E a minha medicao de ontem confirmou o erro em vez de pega-lo:** eu montei o contexto a mao com
`pedeRespostaPessoal: null`, quando o painel compoe esse sinal como
`conversaPedeRespostaPessoal || pedeRoupa || pedeMaterialEscrito || falouAlgoProprio` - e e o
`falouAlgoProprio` que casa nas duas prints. Medi a minha suposicao, nao o caso. **Reconstrucao de
contexto copia a composicao do painel, nunca uma funcao parecida com o nome certo.**

Com a composicao certa: **TABELA -> `contexto-de-outro-dia`, tecla 5. ARVORE ->
`ultima-pede-resposta-pessoal`, tecla 6 (a IA).** Dois motores discordando e problema de POSICAO, e
a posicao errada era a da arvore.

### A caixa subiu nos tres lugares

Chegada, retorno sem cidade e retorno com cidade. Ela fica agora logo abaixo dos quatro pedidos que
o mandato **nao pode atender** (dinheiro, trabalho, ligacao, falar com o deputado), que continuam em
cima **de proposito**: mandar a mensagem do momento em cima de um pedido de socorro de onze dias
atras e propaganda sobre um pedido de ajuda - o dano de 03/09, que nao fica menor com o tempo.

**Passaram a perder para o tempo:** o audio e o texto longo (tecla 6), o pedido sem objeto, a
despedida, a rajada de anuncios, o modelo por etiqueta de conteudo - e, **na CHEGADA, o recibo do
anuncio**.

**A despedida continua protegida pela CONDICAO e nao pela posicao** (`!c.ultimaEhDespedida`), que e
o que a faz valer tambem no quadro que ele ja exportou.

### O recibo na chegada: eu desfiz isto de manha e refiz a tarde

De manha movi a caixa acima do recibo e **desfiz**, com o argumento de que a posicao e do quadro
dele (04/09). O argumento vale para mudanca por conta propria - e esta deixou de ser: ele pediu
*"passado o limite, o fluxo nao decide mais nada"*, a lista ja punha o tempo acima do recibo desde a
v3.152, e **deixar a lista e o quadro discordando e o defeito que este projeto mais paga**.

**Consequencia, dita a ele:** quem clicou no anuncio ha onze dias e nunca recebeu nada passa a
receber a mensagem do momento, nao o recibo - que e material de campanha de uma eleicao encerrada em
04/10. Quatro assercoes invertidas, com o motivo e a data escritos nelas.

### "Em dia com o padrao" era uma afirmacao FALSA

`diferencaDoPadrao` so comparava PRESENCA (`faltando` / `sobrando`). O quadro dele tinha exatamente
as caixas do padrao, em outra ordem - e **no quadro a ordem E a prioridade**. Entao mudanca que e so
de ordem (a v3.152 inteira) era invisivel, **com a tela afirmando que estava tudo em dia**. Mapa que
mente no momento em que ele olha e pior que mapa nenhum.

Agora ela devolve `foraDeOrdem`, e o rodape diz *"mesmas caixas do padrao, N em outra ordem: ..."*.
**E o conjunto MINIMO** (o que sobra da maior subsequencia comum), nao todo par invertido: num
quadro de sessenta caixas, listar pares acusaria dezenas de posicoes que ele escolheu a dedo, e
alarme que toca sempre se aprende a ignorar. **Nao e erro** - ordem diferente do padrao e o normal;
o que mudou e a tela parar de afirmar o contrario.

**Medido contra o quadro de verdade dele** (o arquivo 3.151.0): `faltando` 0, `sobrando` 0,
**`foraDeOrdem` 1 - "passou do limite de horas desde a ultima dela"**. Exatamente a caixa do caso.

### O que ele precisa fazer, e sem isto nada muda

**Importar `tools/fluxo-padrao.json`** (regerado, carimbo 3.156.0). Mexer no padrao **nao mexe no
quadro dele**, e o cartao "O padrao mudou?" nao acusa caixa que so mudou de lugar - o rodape passou
a acusar, mas quem move a caixa e ele ou a importacao.

### Medido

- 21 suites e os dois verificadores verdes. As duas prints, com a composicao real do painel, agora
  dao tecla 5 nos DOIS motores.
- Cinco assercoes mexidas: quatro invertidas pela posicao nova (com a razao escrita) e a do arquivo
  exportado, que o teste exige em dia.
