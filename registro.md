## 2026-10-14 - v3.154.0 - a rodada REMOVE as etiquetas que ele listar

**Pedido dele:** *"crie um espaco no automatizado para remover etiquetas, as etiquetas que eu listar
nesse espaco devem ser removidas"*. Perguntado de QUEM elas saem, ele escolheu **"de quem a rodada
atender"** - e nao uma varredura da base. Cartao novo na aba Automatizado, **"Etiquetas que a rodada
REMOVE"**, logo abaixo do que ela aplica: as duas listas se leem juntas, e e olhando as duas que ele
ve a etiqueta que esta nos dois lados.

### O caminho ja existia, e isso decidiu o custo

`tags.applyTags(contato, [], { remover: ids })` existe desde o COREDE divergente e o botao de tirar a
etiqueta de fluxo o usa em producao - nao e rota nova nem contrato novo. E ele **devolve `skipped`
sem requisicao nenhuma quando nada muda**, entao `lote.etiquetasQueSaem` pergunta ANTES de chamar:
**contato que nao carrega nenhuma das listadas custa ZERO**, e a linha do Andamento so aparece quando
houve remocao de verdade.

### A POSICAO e a coisa mais importante daqui

A remocao entra **logo depois do `load()`, antes de TODA saida antecipada** de `processarRespondido`
(sao quatro: canal removido, barreira do candidato, contato ja tratado, erro de ambiente). O motivo:
**a etiqueta mais provavel de ele listar e justo uma das que fazem a rodada PULAR** - a de material
pula para sempre. Posta depois da decisao, a lista nao funcionaria exatamente nos casos para os quais
ele a criou. **E o defeito de ontem com outro nome**, e a licao pela quinta vez: **meca a ORDEM, nao
so o sinal.**

### Nada volta na mesma passada, senao o log mentiria

`saveClassification` grava no fim o que estiver marcado em `state.tagSuggestions`, e cidade, COREDE e
conteudo nascem lá marcadas: sem desmarcar o que acabou de sair, a mesma passada removeria e
regravaria a mesma etiqueta - duas escritas, nada mudado e **o Andamento dizendo que removeu**. Na
passada SEGUINTE elas voltam de verdade, porque sao derivadas do cadastro, e e isso que o cartao diz:
listar etiqueta de cidade e guerra perdida; o que resolve ali e corrigir o campo Cidade.

### A sonda: uma releitura por RODADA, tres estados

*A API responde 200 e IGNORA o valor* e a armadilha mais antiga daqui, e numa remocao em laco o preco
de acreditar no 2xx e a rodada inteira escrevendo no vazio. **O primeiro contato de cada rodada em
que algo sai e RELIDO** - uma requisicao por rodada, nao por contato (a disciplina da aba Cidades:
pegar formato errado exige UM exemplo, nao auditoria). `lote.etiquetaSaiuMesmo` devolve `removido`
(segue), `ainda-la` (**PARA no primeiro contato**: e defeito, nao engasgo) e `nao-da-para-saber`
(segue com aviso - **"nao consegui reler" NAO e "nao removeu"**). Lista vazia depois e `removido`:
contato cuja unica etiqueta era a removida fica legitimamente sem nenhuma.

**O veredito e DEVOLVIDO, nunca escrito em `state.auto.parar`** - aquela bandeira e a do botao
"Parar a rodada" dele, e mexer nela faria a linha culpar a remocao quando ele mesmo apertasse.

### Nome errado AVISA e segue - ao contrario da lista de pular

A lista de PULAR recusa a rodada; esta nao. A diferenca e o que o erro causa: la o nome errado sai do
`exceptTagsId` em silencio e **alguem RECEBE** um disparo, ato para fora e sem volta; aqui ele so
deixa a etiqueta onde estava - nada enviado, nada apagado. Travar a fila por isso seria parar o
atendimento por causa de uma faxina. Uma vez por rodada, senao vira alarme em todo contato.

### O preco, e esta na tela

A etiqueta sai **antes de a rodada decidir**: listando a de SEM INTERESSE ou a de assessor, **ela
deixa de proteger nessa mesma passada** e o contato passa a receber o que ela impedia; listando a do
DISPARO, a pessoa volta a entrar nos lotes. **O disparo por etiqueta NAO remove**, de proposito: la o
contato nao e carregado e e a etiqueta do proprio disparo que impede o reenvio - tira-la seria apagar
a memoria que torna o lote repetivel.

`lote.colisaoDeRemocao` acusa na tela a etiqueta que esta nesta lista E num dos cinco campos que a
rodada aplica: ela **sai e volta em toda passada**, uma escrita por contato sem nada mudar - a
familia do `repeteSozinha`. Avisa e nao recusa: apagar o campo que aplica e listar a etiqueta aqui,
para limpar o que ja foi marcado, e caso legitimo.

### Medido

- 21 suites e os dois verificadores verdes. 40 assercoes novas, **metade sobre o que NAO pode ser
  removido**: contato que nao tem a etiqueta, `tagsId` ausente (nao e "tem todas"), etiqueta sem id,
  e o **rotulo REPETIDO** - o CRM tem duas "Serra" com ids diferentes, e comparar rotulo removeria a
  homonima errada. A comparacao e por `id` contra `state.contact.tagsId`.
- `nomesPulados` virou `lote.nomesDaLista` e a antiga chama a nova: duas copias divergiriam no
  primeiro separador novo, e a mesma linha valeria num campo e nao no outro.
- `auto.etiquetasParaRemover` **nasce VAZIA**, e tem de nascer: e a unica configuracao do painel que
  APAGA dado que ja esta no CRM de eleitor real. Nao e por candidato (etiqueta e organizacao interna,
  o critario de 25/09).

### O que fica para ele

- **A varredura da base nao existe:** limpar etiqueta de quem ele nao vai atender ainda pede o filtro
  de Contatos na mao. O filtro do servidor aceita `tagsId`, entao e um botao - e um botao sem volta.
- **A lista nao e lista negra:** etiqueta listada que a rodada aplica continua sendo aplicada.
