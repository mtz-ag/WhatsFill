## 2026-10-20 - v3.180.0 - ESTADO DE AGORA - o botao IA do comentario nunca funcionou, e agora funciona

**Print dele:** o painel de comentarios no ar, tres comentarios lidos certos, e embaixo
**"a IA nao devolveu um rascunho legivel"**.

### A causa: a API devolve TEXTO, e o validador exigia objeto

**Medido antes de mexer:** `validarComentario` devolvia `null` para a forma que a API entrega de
verdade — e `null` ali vira exatamente aquela frase.

```
validarComentario(string) -> null
validarComentario(objeto) -> { texto: "Obrigado pelo apoio!", ... }
```

`PROVEDORES[*].texto()` entrega `message.content` (OpenAI) ou o bloco `text` (Anthropic): **o JSON
do modelo como STRING**, nas tres casas. Os **sete** validadores vizinhos fazem o `JSON.parse`;
este, escrito ontem, nasceu sem ele.

**Entao o botao IA nunca funcionou — 100% das chamadas**, e cada uma saiu **paga**. A tela mostrava
o sintoma, como ja aconteceu antes neste projeto.

### Por que o teste de ontem ficou verde: ele provava a minha suposicao

O simulado do worker devolvia `decisao` como **objeto ja pronto** — a forma que eu supus, nao a que
o worker entrega. Corrigido o simulado para a forma real e reintroduzido o defeito, **11 assercoes
caem**: o teste teria pego de cara.

E a mesma licao de 14/10 (*reconstrucao de contexto copia a composicao do painel, nunca a funcao de
nome parecido*), agora na ponte com o worker: **simulado copia a FORMA REAL do que se troca.**

### O que impede a nona vez

O bloco de `JSON.parse` estava **copiado em sete lugares**, e foi a repeticao que deixou o oitavo
escapar. **Nao centralizei:** mexer nos sete tocaria caminhos que atendem eleitor hoje.

Quem segura e **`tests/ia-validadores.test.mjs`** (suite **25**), que varre os oito e trava a
propriedade que nao depende de conhecer os campos de cada esquema:

> **ler a string tem de dar o mesmo resultado que ler o objeto.**

Ele exige tambem que o exemplo plausivel de cada um seja **aceito** — senao duas recusas iguais
passariam e o teste nao provaria nada.

### Uma diferenca achada pela varredura, e ela e deliberada dos dois lados

`validarRascunho` **aceita prosa solta**: vira texto puro com `confianca: 0`, que e a forma anterior
ao esquema. Assim um modelo que ignore o esquema ainda produz rascunho, e **sem confianca ele nunca
passa do limiar do envio automatico** — o texto so chega ao campo, para ele ler.

**No comentario a escolha e a oposta:** o canal e **publico**, nao ha forma antiga a acomodar, e
prosa e recusada com o motivo na tela. As duas estao escritas no teste com o porque.

### Para usar

**Recarregue a extensao** (`chrome://extensions` -> recarregar) e abra um post. O cabecalho do
painel tem de dizer **v3.180.0** — e assim que se sabe que o conserto chegou.

### O que esta medido e o que nao esta

- **Medido:** o validador, a cadeia painel -> cliente -> worker, as travas (promessa, afirmar que ja
  fizemos, chapa trocada, eleicao encerrada) e a leitura do post. 25 suites verdes.
- **CALCULADO, nao medido ao vivo:** o prompt do comentario e **572 tokens de sistema + ~37 do
  comentario**, contra os ~10 mil do WhatsApp. Com ~60 tokens de saida da **~US$ 0,0014 por
  rascunho no gpt-5** e ~US$ 0,0009 no Haiku, a frio. **O numero de verdade aparece no painel
  depois do uso** — este e o tamanho do prompt, nao a fatura.

### O que falta, e e decisao dele

- **Comentario de uma palavra** (**"22"**, boa parte desta pagina): hoje o botao chama a IA de
  qualquer jeito, porque quem pediu foi ele, naquele comentario. `facebook.pedeRascunho` ja sabe
  quando nao vale gastar; **ligar isso a uma resposta pronta em vez da IA e escolha dele.**
- **A ordenacao "Mais relevantes" esconde comentarios** — o aviso amarelo do painel diz isso, e o
  post da print declara 17. Trocar para "Todos os comentarios" e rolar dentro do post.
- **805 KB em toda aba do Facebook.** Da para cortar para ~38 KB movendo a IA para `import()` sob
  demanda. Segurei ate ele confirmar que o caminho funciona — agora da para fazer.
- **A aba Facebook da Graph API (v3.172) continua no ar** e sai quando ele confirmar que este
  caminho substitui.
- **Nao ha rodada automatica**, de proposito: um comentario por vez, pelo botao.
