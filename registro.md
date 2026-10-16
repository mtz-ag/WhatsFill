## 2026-10-16 - v3.169.0 - ESTADO DE AGORA - a boas-vindas voltou a ser usada (PRECISA IMPORTAR)

**Pedido dele:** *"ja temos uma mensagem de boas vindas pra quem nao veio de anuncio onde deve pedir
os dados, e se nao tem nenhum anuncio ativo nas configuracoes deveria ser utilizada mas nao esta
sendo"*.

### O que a bloqueava era `soCortesia`

A caixa `chegada-boas-vindas` nasceu em 04/09 com **duas** condicoes: *nao veio de anuncio* **E**
`soCortesia` — *"ela SO cumprimentou"*. Quem chegava escrevendo qualquer outra coisa passava por ela
e caia em `anuncio-modelo-e-dados`, que e a caixa do RECIBO e **nao confere anuncio nenhum**
(medido ontem). **Medido, primeira vinda sem anuncio:**

| o que ela escreveu | antes | agora |
|---|---|---|
| so cumprimentou | boas-vindas | boas-vindas |
| declarou voto ("Flavio bolsonaro 22") | **tecla `a`** (modelo + formulario) | **boas-vindas** |
| figura, emoji ou link | **tecla `a`** | **boas-vindas** |
| so se despediu | **tecla `a`** | **boas-vindas** |
| texto comum | **tecla `a`** | **boas-vindas** |
| qualquer coisa, **sem modelo** | **tecla 4** (formulario seco) | **boas-vindas** |

**Quem escolhe o TEXTO continua sendo o painel:** `boas-vindas` com o cadastro dentro,
`boas-vindas-tem-dados` sem ele, pela conta `pedirDadosNaoCabe` (05/09).

**Quem vem de anuncio nao mudou nada:** continua no recibo. A separacao e a CONDICAO, nao a posicao.

### A guarda contra repetir, que o proprio verificador cobrou

`!veioDeAnuncio` e estado do contato: continua verdadeiro depois do envio. Sozinha, a caixa mandaria
as boas-vindas **em toda passada, para sempre** — a armadilha de 02/09 (*fixar a tecla nao herda as
guardas da regra*), e foi `arvore.problemas` que acusou antes de isto ir ao ar. A guarda e
**`!jaPediramDados`**, que o proprio envio liga (o texto carrega o bloco `Nome , Cidade`). Medido: 2a
passada cai em `conteudo-pedido`, nao repete.

### Dois defeitos de FERRAMENTA achados no caminho

**1. `repeteSozinha` nao enxergava `maisCondicoes` nem `maisExcecoes`.** Ela nasceu em 02/09, quando
a caixa tinha UMA condicao e UMA excecao; as listas chegaram em 04/09 e ninguem voltou la. **Guarda
posta na segunda condicao protegia de verdade e o verificador continuava acusando** — alarme falso na
faixa vermelha da janela, que e onde ele olha. Agora basta UMA das condicoes (ou excecoes) apagar
sozinha depois do envio.

**2. O amostrador do teste de caixa morta nao tinha `veioDeAnuncio`.** E a licao de 14/10 pela
segunda vez: **sinal que decide QUEM vence tem de estar no amostrador**, senao as caixas que so ele
aciona aparecem como mortas — aqui, o recibo e o formulario. O laco tambem estava preso em 16
combinacoes com a lista de bits ao lado; virou `1 << bits.length`.

- 21 suites e os dois verificadores verdes. `tools/fluxo-padrao.json` regerado.

### ELE PRECISA IMPORTAR

`chegada-boas-vindas` e **caixa dele**, sem regra do codigo por tras: ela so existe no `fluxoPadrao`,
entao **nada disso vale no quadro dele ate ele importar** `tools/fluxo-padrao.json`. O cartao **"O
padrao mudou?"** vai acusar, porque a comparacao e por conteudo e a condicao mudou.

### O que ele precisa saber antes de importar

**Na chegada SEM anuncio, a boas-vindas passa a responder TUDO.** As caixas abaixo dela — despedida,
apoio, figura, modelo, formulario — continuam decidindo **so para quem veio de anuncio**. O bloco que
precisa de gente continua ACIMA: pergunta, audio, texto longo, denuncia, pedido de dinheiro, mal
estar e hostilidade seguem indo para ele ou para a IA.

**O rotulo da caixa mudou** de *"chegou sem anuncio e so cumprimentou"* para *"chegou sem anuncio:
boas-vindas"* — o nome antigo passaria a mentir, e e pelo nome que ele decide a ordem.

**Tentei guardar a despedida com uma excecao e a medicao derrubou:** *"So se despediu"* esta ABAIXO
do recibo na chegada, entao a excecao nao devolvia o silencio — devolvia a tecla `a`. Boas-vindas
para quem chega se despedindo e melhor que modelo mais formulario.
