## 2026-10-20 - v3.181.0 - ESTADO DE AGORA - respostas rapidas no painel do Facebook (e o conserto da IA)

Duas coisas foram ao ar hoje. A segunda depende da primeira ter sido consertada.

---

## 1. O botao IA do comentario nunca funcionou (v3.180.0)

**Print dele:** o painel no ar, os comentarios lidos certos, e embaixo **"a IA nao devolveu um
rascunho legivel"**.

**Medido antes de mexer:** `validarComentario` devolvia `null` para a forma que a API entrega.

```
validarComentario(string) -> null
validarComentario(objeto) -> { texto: "Obrigado pelo apoio!", ... }
```

`PROVEDORES[*].texto()` entrega `message.content` (OpenAI) ou o bloco `text` (Anthropic): **o JSON
do modelo como STRING**. Os **sete** validadores vizinhos fazem o `JSON.parse`; este nasceu sem ele.
**Entao o botao falhava em 100% das chamadas, e cada uma saiu paga.**

**Por que o teste de ontem ficou verde:** o simulado do worker devolvia `decisao` como **objeto ja
pronto** — a forma que eu supus, nao a que o worker entrega. Corrigido o simulado e reintroduzido o
defeito, **11 assercoes caem**.

**O que impede a nona vez:** `tests/ia-validadores.test.mjs` varre os oito e trava a propriedade que
nao depende de conhecer os campos — **ler a string da o mesmo resultado que ler o objeto**.

A varredura achou que `validarRascunho` **aceita prosa solta**, e isso e deliberado (texto puro com
`confianca: 0`, nunca sai sozinho). **No comentario a escolha e a oposta e tambem de proposito:** o
canal e publico, e prosa e recusada com o motivo na tela.

---

## 2. Respostas rapidas, sem IA (v3.181.0)

**Pedido dele:** *"preciso de respostas rapidas para o facebook, a ia nao e necessaria para tudo"*.
Escolhas dele: **eu proponho os textos e ele corrige**, e **tudo se gerencia no painel do Facebook**.

### A lista e PROPRIA, e isso e regra e nao preferencia

**Medido contra as 21 respostas prontas do WhatsApp: 3 serviriam.**

| problema | quantas |
|---|---|
| **pedem o cadastro** (`Nome , Cidade`) | 5 |
| tem `{{saudacao}}` / `{{cidade}}` / `{{link_grupo}}` | 16 |
| passam de 260 caracteres | 6 |

Pedir nome e cidade e **proibicao escrita do canal publico** — reusa-las mandaria o formulario para
a pagina onde todo mundo ve. E no Facebook **nao ha contato carregado**: a variavel nao resolve,
sairia `{{saudacao}}` cru para o eleitor.

### Como funciona

- A **tira de botoes** fica junto do campo, no rodape. **Uma so, nunca uma por comentario** — a
  lista tem N comentarios, e seis botoes em cada um enterrariam o que ele veio ler.
- **Clicar enche o CAMPO, nunca insere na pagina.** Mesma fronteira da IA: ele le, depois clica em
  "Abrir e inserir" no comentario que quiser.
- **"Guardar como rapida"** pega o que esta no campo. O rotulo sai do proprio texto, entao guardar
  nao exige digitar nome nenhum.
- **O ⚙ abre o modo de organizar**, e so nele aparecem o ✎ (renomear) e o ✕ (apagar). **Duas razoes,
  e a primeira foi medida na conta de altura:** seis pares de `[rotulo][✎][✕]` empilham seis linhas
  no rodape e enterram a lista de comentarios — a poluicao de que ele ja reclamou em 10/09. A
  segunda e que o apagar deixa de ficar a um dedo de quem so queria usar a resposta.
- **✕ apaga — e devolve o texto ao campo.** E o desfazer barato: um clique em guardar traz de
  volta, sem pilha de desfazer.
- **"Reler a pagina" atualiza as duas coisas:** os comentarios e a tira. E por ali que a tira do
  candidato certo chega depois de ele trocar de candidato no mobiliza.

### Os seis textos de fabrica — **confira e corrija o que nao gostar**

| botao | texto |
|---|---|
| Agradecer o apoio | Muito obrigado pelo apoio! Seguimos juntos. 🙏 |
| **Dia 25 — 2o turno** | Dia 25 é 22! Leva a família e os amigos para votar. 💪 |
| Pro privado | Me chama na mensagem da página que a gente vê isso com calma por lá. |
| Obrigado pela info | Obrigado por trazer, vamos acompanhar. 🙏 |
| Está junto | É isso aí! Obrigado por estar junto nessa. 💪 |
| Seguir a página | Obrigado! Segue a página para não perder nada. 👊 |

Cada um sai de uma regra que ja existe: **pedido pessoal vai para o privado** (nao se nega em
publico), **denuncia se agradece e nao se discute** (23/09), e **quem xinga o adversario esta do
nosso lado — agradece, nunca modera** (regra 17, 25/09).

**Os seis passam pela propria `revisarRascunho`**, com teste: nenhum promete entrega, nenhum afirma
que ja fizemos, nenhum afirma que temos, nenhum pede cadastro, nenhum tem variavel, e nenhum passa
de 140 caracteres.

### Duas coisas para ele saber

- **"Dia 25 — 2o turno" EXPIRA.** Texto com data dentro envelhece sozinho (19/10), e por isso a
  data esta no NOME do botao: passado **25/10** ele tem de sair ou ser reescrito.
- **A tira e POR CANDIDATO**, como tudo o que sai para o eleitor. O candidato novo **nao comeca
  vazio**: as de fabrica servem de ponto de partida, porque **nenhuma cita candidato pelo nome** —
  ha teste exigindo isso.

---

## Para usar

**Recarregue a extensao** (`chrome://extensions` -> recarregar) e abra um post. O cabecalho tem de
dizer **v3.181.0** — e assim que se sabe que chegou.

## O que falta, e e decisao dele

- **Comentario de uma palavra** (**"22"**, boa parte desta pagina): agora ha o botao rapido, que era
  o que faltava. `facebook.pedeRascunho` continua existindo e sabendo quando nao vale pagar;
  **ligar isso para a IA nem ser oferecida nesses casos e escolha dele.**
- **A ordenacao "Mais relevantes" esconde comentarios** — o aviso amarelo diz isso, e o post da
  print declara 17. Trocar para "Todos os comentarios" e rolar dentro do post.
- **805 KB em toda aba do Facebook.** Da para cortar para ~38 KB movendo a IA para `import()` sob
  demanda. Agora que ha caminho sem IA, o corte vale ainda mais — mas so depois de ele confirmar
  que o botao IA funciona de verdade.
- **A aba Facebook da Graph API (v3.172) continua no ar** e sai quando ele confirmar que este
  caminho substitui.
- **O custo por rascunho nao foi medido ao vivo.** Calculado: **572 tokens de sistema + ~37 do
  comentario**, o que da ~**US$ 0,0014 por rascunho** no gpt-5, a frio. O numero real aparece no
  painel depois do uso.
