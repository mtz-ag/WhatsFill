## 2026-10-15 - v3.164.0 - "Tudo certo obrigado" nao fechava a conversa, e a mensagem saia

**Print dele:** ela mandou um audio (*"Fala, meu lindo, tudo bem?"*) as 10:55, nos respondemos as
11:46 e o atendimento foi concluido. As **16:03** ela escreveu *"Tudo certo obrigado"* e as **16:16**
saiu `agradecer-info` (*"Obrigado pela mensagem e pelas informacoes! Seguimos juntos. Que Deus
abencoe voce e sua familia"*) — ele apagou. *"terceira vez seguida que manda a mensagem rapida, me
de a lista de frases que entram como finalizacao de conversa"*.

### A lista que ele pediu

**Vocabulario de despedida** (`cortesia.DESPEDIDA`), onze formas:

> e nos / e nois · abraco, abracos, forte abraco · valeu · vlw · obrigado, obrigada · brigado,
> brigada · amem · boa sorte · Deus (te) abencoe · fica com Deus · sucesso

**Despedida amarga** (`DESPEDIDA_AMARGA`), cinco, e estas fecham sem mais conferencia:

> obrigado por nada · valeu por nada · deixa pra la · deixa quieto · esquece entao

**E ha uma SEGUNDA metade na regra, que e metade dos casos que falham:** tirada a despedida, nao
pode sobrar nada. *"Valeu, me manda o material"* nao fecha, de proposito.

### Medido: 29 das 41 formas mais comuns de encerrar NAO eram reconhecidas

E a da print falhava **na segunda metade, nao no vocabulario**: `ehDespedida` VIA o *"obrigado"*; o
que sobrava era *"tudo certo"*, e `certo` contava como conteudo. **"Tudo bem obrigado" fechava e
"Tudo certo obrigado" nao — a diferenca era uma palavra.**

### E essa palavra ja estava registrada como vazia no mesmo arquivo

Sao **duas listas de palavra-sem-conteudo** em `cortesia.js`: a de `restoDaMensagem` (que
`ehDespedida` usa) e `PALAVRAS_SEM_CONTEUDO` (a de `falouAlgoProprio`, tres mil linhas abaixo). A
segunda ja conhecia `certo`, `ok`, `beleza`, `blz`, `sim`, `claro`, `ta`, `bom`, `boa`, `grato` e
`grata`; a primeira nao. **Duas listas respondendo a mesma pergunta e discordando** — o defeito
registrado quatro vezes neste projeto. As que faltavam entraram.

**Nao foram fundidas numa so de proposito:** uma roda no texto CRU (com acento) e a outra no texto
ja sem acento, palavra a palavra; fundir mexe em `soCortesia` e `ehSoReacao`, que sao outras duas
decisoes. O que fica e a regra: **ao por palavra numa, procure a outra.**

### Medido depois

- **13 de 14** formas de encerrar fecham (*"Tudo certo obrigado"*, *"Ok obrigado"*, *"Ta bom
  obrigado"*, *"Blz valeu"*, *"Sim, obrigado"*, *"Valeu, beleza"*);
- **11 de 11** falsos positivos continuam barrados: *"Obrigado, mas preciso do material"*, *"Valeu,
  me manda o link"*, *"Tudo certo, quando e o evento?"*, *"Obrigado, me liga por favor"*;
- **o desfecho vira silencio, nos DOIS motores.** Em sessao nova (ela reabriu depois de concluido) o
  caso ia para `ja-respondemos-antes` -> **tecla 5, que ENVIA**; com a despedida reconhecida vai
  para `ultima-e-despedida` -> **tecla 3, conclui sem enviar nada**. A guarda nao empurra o caso
  para nenhuma caixa que envie (a licao da Noeli, 06/09);
- 21 suites e os dois verificadores verdes.

### O que fica para ele decidir

**1. O vocabulario que FALTA, e e so dele.** Nao estao na lista, e nenhuma delas e reconhecida hoje:

> tchau · ate mais · ate logo · ate breve · falou · grato · grata · agradecido · beleza (sozinho) ·
> ok (sozinho) · combinado · tranquilo · perfeito · entao ta

Nao acrescentei: e lista de vocabulario, e ela decide se um eleitor recebe mensagem ou silencio.
Dito pela sexta vez que esse tipo de lista nao fecha — mas **"tchau" nao ser despedida e o tipo de
buraco que so aparece quando ele aponta**. Ele diz quais entram e eu ponho.

**2. No QUADRO, "so cumprimentou" esta ACIMA de "so se despediu" — e a tabela faz o contrario.**
Medido: com os dois sinais verdadeiros (e *"Bom dia, obrigado"* liga os dois), a tabela da
`ultima-e-despedida` -> tecla 3 e **o quadro da a caixa do cumprimento -> tecla 5, que ENVIA**. Os
dois motores discordando e a assinatura de problema de POSICAO (14/10), e posicao no quadro e dele:
nao movi. Mover a caixa *"So se despediu"* para cima de *"so cumprimentou"* nos dois ramos do
retorno resolve, e ele precisa IMPORTAR o quadro depois.
