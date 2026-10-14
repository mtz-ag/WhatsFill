## 2026-10-14 - v3.155.0 - o limite nao foi aplicado: o quadro dele, e o verbete que o mandou para la

**Print dele:** o contato clicou no anuncio em **03/10 as 17:14** (*"Ola! Eu quero receber o Material
da Direita"*) e em **14/10 as 15:15** - onze dias depois - recebeu *"Qual material da Direita voce
gostaria de receber? E, se puder, me diga seu: Nome , Cidade"*, que ele apagou. Pergunta dele:
*"nao foi aplicada o limite de 48 horas, e o fluxo que faltou atualizar?"*. **Estava certo**, e a
medicao mostrou que metade da culpa e minha.

### Medido antes de mexer, porque as duas causas dao a mesma print

A licao de 06/09 (*meca o SINAL antes de mexer na ORDEM*) aplicada aos dois motores:

- **O sinal esta certo:** `contextoPerdido` = `true` (11 dias contra o limite de 48h).
- **O campo chega nele:** `auto` esta na mescla do `store.get`, `horasContextoPerdido` esta nos
  DEFAULTS e nao e por candidato, entao `lerAuto` o devolve. Nao e a armadilha da chave que nao
  alcanca quem ja usava.
- **Os dois motores do CODIGO concordam:** a tabela da `contexto-de-outro-dia` -> tecla 5, e o
  quadro PADRAO da a mesma coisa. **Motores concordando no desfecho certo = o codigo decide bem.**
- **O texto que saiu e da IA:** *"E, se puder, me diga seu: / Nome , Cidade / (exemplo: Pedro Silva ,
  Porto Alegre)"* e **byte a byte** `ia.PEDIDO_DE_DADOS_NO_RASCUNHO`. Com o sinal verdadeiro, o
  codigo de hoje nunca deixaria o caso chegar na IA - a caixa do tempo vence em 7o lugar.

Sobra uma explicacao: **o QUADRO dele decidiu**, com a caixa na posicao antiga (20a). Quadro e
COPIA, e a v3.152 mudou justamente a POSICAO - que e a prioridade.

### O defeito que e meu: o verbete envelheceu duas vezes no mesmo dia

`SOBRE['contexto-de-outro-dia']` ainda dizia que as duas excecoes dele *"estao na CONDICAO"* (sairam
na v3.153) e que a caixa *"fica ABAIXO de tudo o que precisa de voce e do anuncio reconhecido"* - a
posicao de ANTES da v3.152. O rotulo ainda falava em "outro dia", e a regua virou HORAS.

**E o pior lugar possivel para texto velho:** e este texto que ele le na janela do fluxo para decidir
onde por a caixa no quadro dele. Prosa errada aqui vira ordem errada la. A regra ja estava escrita
neste projeto (*"a janela do fluxo desenha o DESFECHO, e desfecho que envelhece vira mapa
mentiroso"*); o que faltava era ela valer para o `quando`, e nao so para os `ramos`.

### O teste que trava isso corrigiu a minha descricao

Travar a frase seria teste de string. O que se trava e a AFIRMACAO de posicao: percorre as regras
acima da caixa do tempo e exige que nenhuma tecla alcancavel ali ENVIE CONTEUDO.

E ele **falhou na primeira vez, com razao**: eu escrevi *"acima dela so esta o que nao manda nada"* e
`etiqueta-dispensa-da-fila` e `depende` - o engajado recebe a mensagem do momento uma vez por dia
(decisao dele, 03/09). A frase certa e mais forte: as teclas acima sao `s`, `2`, `3`, `6` (nao mandam
nada) ou `5` (a propria mensagem do momento). **Nunca a `1`, a `4` ou a `a`**, que sao as que
respondem o que esfriou. O verbete foi corrigido para dizer isso.

### O buraco que esta print expoe, e ele e dele para decidir

**O cartao "O padrao mudou?" NAO acusa caixa que so MUDOU DE LUGAR.** `arvore.diferencaDoPadrao`
compara presenca (`faltando` / `sobrando`) por chave de conteudo: uma caixa que existe nos dois, em
posicoes diferentes, e invisivel para ele. E neste projeto **a posicao E a prioridade**, entao a
v3.152 - cuja mudanca inteira foi a ordem - nao tinha como ser vista.

Nao mexi nisso: ordem no quadro e preferencia DELE, e listar toda inversao entre o padrao e o quadro
seria o alarme que toca sempre (ele arrumou aquele quadro a mao). Esta dito a ele como decisao.

### O que fica para ele

- **Mover a caixa "A ultima dela passou do limite de horas"** no quadro para logo abaixo das seis do
  topo. O verbete agora diz exatamente isso.
- **Ou importar `tools/fluxo-padrao.json`**, que ja esta com a ordem nova (regerado na v3.152) - mas
  isso substitui o quadro inteiro, e ele perde o arranjo feito a mao.
