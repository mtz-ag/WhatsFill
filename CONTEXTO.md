# Contexto para outra sessão — WhatsFill

Cole isto (ou aponte para este arquivo) numa aba nova do Claude. Ele existe para a próxima sessão
não redescobrir o que já foi decidido, nem "consertar" o que já está consertado.

Atualizado em **31/08/2026**, ao fim de um dia longo de trabalho ao vivo com o Thiago.

---

## 1. Antes de qualquer coisa: você está olhando o código certo?

- repositório **`github.com/mtz-ag/WhatsFill`**
- branch **`claude/extensao-claude-analise-i9spxw`** — é ONDE VOCÊ TRABALHA, e é o de produção
- **existe um segundo branch: `claude/whatsfill-ia`.** É o WhatsFill+IA: mesma extensão mais uma
  avaliação de contexto que ESCOLHE entre as respostas prontas (nunca escreve para o eleitor),
  com chave da Anthropic e teto de gasto mensal. Ele não vai para produção. **Conserto que vale
  para os dois se faz AQUI e vai para lá por merge** — duplicar `panel.js` (6.000+ linhas) é como
  as duas versões divergem em uma semana. Nunca implemente a IA neste branch.
- clone local dele: **`C:\Users\thiag\OneDrive\Documents\GitHub\WhatsFill`**

**Confira a versão antes de diagnosticar qualquer coisa.** O cabeçalho do painel mostra a versão
carregada; ela tem que bater com o `manifest.json`. Hoje isso já enganou duas vezes: numa, o Chrome
estava com uma extensão de nome diferente (`WhatsFill` x `WhatsFill+IA`); noutra, a pasta que eu
editava era uma cópia solta em `Downloads`, sem `.git`.

```bash
node tools/checar-modulos.mjs   # 29 módulos, 0 erros de sintaxe
grep '"version"' manifest.json
```

---

## 2. O que é a extensão, em cinco linhas

Extensão Chrome (MV3, JavaScript puro, **sem build step**) que acelera o atendimento político no
**mobiliza.app**: lê o que o contato escreveu, classifica (nome, cidade, COREDE, etiquetas), grava
no CRM e envia respostas prontas ou modelos aprovados. Painel encaixado na borda direita.

**Leia, nesta ordem, antes de implementar:** `registro.md` (log de decisões, o mais recente no
topo), `CLAUDE.md` (regras e armadilhas — é curto de propósito) e `README.md`.

---

## 3. A peça central de hoje: `src/lib/sugestao.js`

A caixa da rodada agora **recomenda uma tecla e escreve o porquê em cima**. As regras são uma
**lista ordenada** — a primeira que casa vence — e acrescentar uma situação é acrescentar uma
entrada. **Ele vai pedir situações novas; é lá que elas entram.**

Ordem em 31/08 (de cima para baixo):

1. `etiqueta-dispensa-da-fila` — tem "engajado" → **2, pular**
2. `ultima-pede-resposta-pessoal` — áudio, vídeo, texto 400+ → **6, à mão**
3. `ultima-e-despedida` — "é nós", "abraço", "amém mestre" → **3, concluir**
4. `voltou-por-outro-anuncio` → **5** ou **3** (se já recebeu a mensagem do momento)
5. `ultima-e-so-reacao` — figura, emoji, link → **5**, ou **3** se já respondemos hoje
6. `nunca-pediram-dados` — veio do anúncio, sem cidade, formulário nunca saiu → **4**
7. `conteudo-pedido` → **1, mandar o modelo**
8. `nome-sem-sentido` → **4, pedir dados**
9. `nunca-perguntaram-interesse` → **7**
10. `pedido-hoje-sem-resposta` → **3**

**A regra só recomenda, nunca decide.** Todas as opções continuam na tela. É essa fronteira que
permite uma regra agressiva sem risco — o pior caso é um destaque no lugar errado.

**A única exceção** é a caixa "Pular sozinho, sem perguntar" (aba Automatizado, desmarcada por
padrão), e mesmo ela registra no Andamento o nome da etiqueta que causou o pulo.

---

## 4. As armadilhas que custaram tempo HOJE

Todas estão no `CLAUDE.md`; estas são as que mais provavelmente vão morder de novo.

- **`node --check` NÃO basta.** Ele analisa `.js` como CommonJS (modo solto); o Chrome carrega como
  ES module (strict). Um `.join('\n')` virou string com quebra de linha crua, o `--check` disse OK
  e **a extensão parou de carregar** — sem erro visível na aba, porque o content script morre antes
  de desenhar. Rode `node tools/checar-modulos.mjs`.
- **O registro de envios (`templatesLib.wasSent`) só enxerga o que o PAINEL mandou.** Modelo
  disparado pela automação, ou resposta escrita à mão, não deixam rastro. Quem precisa saber o que
  já foi usa `getConversation().nossas` / `.nossaUltimaAt`.
- **A lista de etiquetas da caixa da rodada não é a do contato** — vem de `tagSuggestions`. Regra
  que decide por etiqueta lê `state.contact.tagsId` cruzado com `tagsLib.allTags()`.
- **`\b` não funciona antes de palavra acentuada.** `/\bé nós/` nunca casa no começo da string.
  Use `(^|\s)`.
- **Regex com flag `g` guarda `lastIndex` entre chamadas.** `test()` alterna resultado. Já mordeu
  duas vezes hoje (emoji e vocabulário da campanha).
- **A sessão dura semanas e a conversa é paginada.** 50 mensagens por página deixava 118
  invisíveis. Hoje são 200, com segunda página.
- **Áudio traz transcrição** em `details.transcription.text`.
- **A origem do anúncio é dado, não texto:** `utm.source`, `utm.campaign`, `utm.referralUrl`.

### O viés que eu repeti três vezes hoje

Trava minha contra falso positivo derrubando o caso verdadeiro: o `\b` do "É nós", a lista de
etiquetas errada, e duas condições que eu inventei na regra do retorno por anúncio. Todas nasceram
de "melhor não errar fazendo demais", e o custo real foi **não fazer nada no caso que importava**.
Quando criar uma trava, teste o caso dele literalmente.

---

## 5. Regras de negócio que ele decidiu (não as reinvente)

- **Cidade só sai de contexto**: resposta ao formulário, mensagem curta que é a cidade, menção com
  pista ("moro em", "sou de", "aqui em", "em"), ou **resposta a uma pergunta nossa** — neste último
  caso "maria cachoeirinha" vira nome Maria + cidade Cachoeirinha, sem separador.
- **Cidade nunca é gravada sem clique.** "meu genro mora em Santiago" tem pista e está errado.
- **Transcrição de áudio alimenta o parser, mas sempre rebaixada** (`rebaixarParaPalpite`):
  `aproximada` + `informada: false`. Nunca grava sozinha, nunca substitui o CRM.
- **Pedir dados** é para quem tem nome sem sentido, ou para quem veio do anúncio e **nunca**
  recebeu o formulário. Quem ignorou o formulário recebe o conteúdo — *"talvez em outra hora ela
  forneça"*.
- **Nenhuma resposta chama o contato pelo nome** (o cadastro erra demais).
- **Vocabulário da campanha nunca vira cidade** (Zucco, Bolsonaro, Capitão Martim…).

---

## 6. Pendências dele (nenhuma é código)

1. **Tabela "Modelo por conteúdo"**: ele havia posto `ADS = Campanha Martim` no campo errado
   ("Conteúdo preferido no empate"). O mapeamento vai na tabela; o preferido leva só o nome da
   etiqueta.
2. **`data-cy` da lista de concluídos** — resolvido em 30/08 (`icon-chat-sessions-archive`), mas o
   botão "Achar a lista de concluídos" continua na aba Automatizado.
3. **Diálogo de "motivo de conclusão"** da plataforma trava a rodada no primeiro contato. Ou ele
   desliga na plataforma, ou decide um motivo padrão.
4. **Transcrição alimentar as REGRAS de etiqueta** (hoje só alimenta o parser). Etiqueta de
   conteúdo é gravada automaticamente, então isso escreveria no CRM a partir de fala ouvida por
   máquina. Decisão dele, ainda não tomada.

---

## 7. Como saber que não quebrou nada

```bash
node tools/checar-modulos.mjs && \
node tests/parser.test.mjs && node tests/contract.test.mjs && node tests/vars.test.mjs && \
node tests/tags.test.mjs && node tests/hsm.test.mjs && node tests/conversa.test.mjs && \
node tests/templates.test.mjs && node tests/categorizar.test.mjs && \
node tests/cortesia.test.mjs && node tests/sugestao.test.mjs
```

Dez suítes, Node puro, sem dependência, **offline**. Fora delas (precisam de navegador):
`tools/checar-dom.mjs`, `tools/checar-pergunta.mjs`, `tools/simular-fila.mjs`.

**A suíte pagou o próprio custo hoje:** ao endurecer a regra da cidade, três testes caíram e
mostraram que "contexto" era mais largo do que os dois exemplos que ele tinha dado. Sem eles, eu
teria trocado um falso positivo por três falsos negativos.

---

## 8. As regras que não se negociam

- **Dados reais de eleitores; toda escrita é em produção.** Contato de teste: "Thiago Tim".
- **Sem IA na extração.** Parser determinístico. Na dúvida, **recusar com o motivo na tela**.
- **Nunca sobrescrever o CRM**, com uma exceção: a cidade que a própria pessoa ESCREVEU.
- **Escolha explícita dele não se substitui por dedução.**
- **Nunca escrever telefone ou nome real de eleitor** em arquivo do repositório.
- Commits em português sem acentos, `tipo(escopo): resumo`, e **todo commit leva o `registro.md`
  junto**. Suba a `version` do manifesto quando o comportamento visível mudar.

---

## 9. Como ele trabalha, e o que isso pede de você

Ele manda **print da tela com uma frase curta**. A frase costuma ser o pedido, e a print costuma
conter a causa — leia as duas. Várias vezes hoje a print mostrou algo que a frase não dizia (a
etiqueta que faltava na caixa, o modelo que já estava na conversa, o horário da mensagem anterior).

Ele **muda de ideia com bons argumentos** — a regra de "pedir dados" trocou de critério duas vezes
em dois dias, e nas duas ele estava certo. Quando isso acontecer, registre a reversão **com as
palavras dele** no comentário da regra: sem isso, alguém "conserta" a ordem de volta em um mês.
