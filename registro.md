## 2026-10-15 - v3.160.0 - a regra anti-repeticao mandava escrever a repeticao

**Print dele:** as **10:59** saiu *"Agradeco por compartilhar essa informacao. Estamos atentos e
acompanhando situacoes como essa."*; ela reforcou as **11:00**; as **11:51** saiu *"Agradeco por
reforcar essa preocupacao. Estamos atentos e acompanhando as informacoes com responsabilidade."* —
e ele apagou. **"repeticao ocorrendo"**.

### O modelo OBEDECEU, e a ordem era minha

O fim da regra anti-repeticao dizia, palavra por palavra: *"se nao houver nada novo, escreva uma
linha curta que reconheca o que ela disse, sem repetir o conteudo"*.

**A primeira mensagem ja era um reconhecimento.** Entao a unica forma de cumprir aquilo era
reconhecer outra vez com outras palavras — que e exatamente o que saiu. **A regra que existe para
impedir a repeticao e que a produziu.**

E a licao de 17/09 (*toda regra que obriga um CONTEUDO e uma hipotese de repeticao*) aplicada desta
vez a propria regra anti-repeticao.

### A guarda mecanica nao pega, e NAO e para baixar a regua

`semRepetirONosso` devolveu **null**. Medido nas duas frases reais: *"Estamos atentos e acompanhando
situacoes como essa"* contra *"...as informacoes com responsabilidade"* compartilham **60%** das
palavras de conteudo, e os dois agradecimentos **50%** — contra os 80% da regua.

**Isto e PARAFRASE, nao a mesma frase com outra roupa**, que e o que aquela funcao mede. Descer a
50% a faria apagar frase legitima, porque duas frases sobre o mesmo assunto compartilham metade das
palavras. A decisao de 23/09 ja dizia isso e foi medida outra vez; ha assercao nova travando, para
ninguem "consertar" a repeticao por ali.

**E a guarda estava bem alimentada:** `nossaUltima` chega certo de `ia-cliente`. Conferi antes de
mexer na regua — e a familia do *"funcao pura testada nao garante nada se quem chama filtrar os
campos"* ja mordeu aqui varias vezes.

### O desfecho novo nao e mecanismo novo

Nao havendo nada novo, a regra manda **marcar `naoHaOQueResponder`** — a abstencao de 24/09, que
**ja existe, ja abstem, ja manda a mensagem do dia no lugar e ja tem a guarda da pergunta
pendente**. Medido na conversa dela: `perguntaPendente` falso, entao a guarda nao barra.

A **regra 16** foi alargada junto, senao a regra colada no pedido mandaria marcar um campo que o
sistema define so para *"nao entendi"* — **duas descricoes discordando e como o modelo escolhe a
que preferir**. Hoje ela cobre os dois lados: nao entendi, e **entendi bem demais e nao ha nada
novo**.

**A guarda que mantem a regra util:** havendo algo NOVO na fala dela, continua sendo para responder
— senao *"nada novo"* vira a saida facil para toda insistencia, que e o defeito que a regra 14
nasceu para consertar.

### Medido

- 21 suites e os dois verificadores verdes.
- `trouxeDenuncia` devolve **null** para a fala dela: o registro de 23/09 (*denuncia nao se
  discute*) nao foi acionado por detector nenhum aqui — o tom de "agradecemos e desconversamos"
  veio do que ja estava na conversa, acima do que a print mostra.
