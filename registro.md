## 2026-10-14 — v3.150.0 — concluir o atendimento cujo NÚMERO foi removido da conta

**Pedido dele:** *"adicione a opção de concluir no automatizado quando o canal estiver removido"*.

### "Removido" e "fora do ar" são estados diferentes, com desfechos opostos

Era isto que faltava, e é a razão de a opção não existir até hoje. A rodada já tratava **canal fora
do ar** desde 01/10, e o desfecho dela é **pular e esperar** — o número volta e a mensagem sai, e
concluir ali apagaria da fila alguém que nunca recebeu nada.

**Removido é o oposto: não volta.** O número saiu da conta, não há por onde mandar nada, e pular
deixa o atendimento aberto na fila **para sempre**. Aí concluir é a única saída que limpa.

### E a conferência tinha de ser pela API, não pela tela

A trava que já existia lê a **tarja do cabeçalho** (*"foi desconectado da Z-API"*). Ela não serve
aqui por dois motivos: a tarja fala de desconexão, que é o outro caso, e **número removido pode não
gerar tarja nenhuma** — a rodada seguiria em frente e tentaria enviar por um canal que não existe.

Quem responde é `GET /chat/v4/channel/my` contra o `channelId` da sessão. Por isso o bloco novo vem
**ANTES** do da tarja.

### Três estados, nunca dois — e é aqui que mora o risco

`lote.canalSumiuDaConta` devolve `removido`, `esta-la` ou **`nao-da-para-saber`**. É a lição do
`donoDoCanal` (25/09, que devolvia `null` para duas situações opostas) e a do
`undefined !== 'CONNECTED'` (01/10): **ausência de informação não é evidência.**

O limitador recusa requisição com frequência, e este veredito manda **CONCLUIR** — escrita no CRM
que tira a pessoa da fila. Colapsar *"não consegui ler"* em *"removido"* concluiria contato por
causa de um erro de rede, em silêncio. Então **não dá para saber** se comporta exatamente como
antes: cai no caminho da tarja, como se o bloco novo não existisse.

**Lista VAZIA também não é "todos removidos".** Conta sem canal nenhum é possível; resposta vazia
por erro é muito mais provável, e o preço de errar é concluir a fila inteira. **Metade das doze
asserções é sobre o que NÃO pode virar "removido".**

### Uma requisição por RODADA, nunca por contato

`canaisFrescos()` guarda a lista com a hora da leitura e a reusa por 5 minutos — e, relendo, atualiza
`state.canais`, então a tela ganha o estado novo de graça. Uma leitura por contato seria uma
requisição a mais em cada um, e é número de requisição que derruba esta API.

**Lista velha não decide conclusão:** decidir com uma leitura de uma hora atrás faria um canal
criado nesse meio-tempo parecer removido.

### O que ele vê

Na caixa da rodada, três opções em vez de duas: **Concluir sem enviar nada** (em destaque), **Pular
(deixa aberto)** e **Parar a rodada**.

E uma caixa nova na aba Automatizado — **"Concluir sozinho quando o NÚMERO do atendimento foi
REMOVIDO da conta (na rodada automática)"**, `auto.concluirCanalRemovido`, **nascendo desligada**:
concluir escreve no CRM e tira a pessoa da fila, e nada sai da fila sem decisão dele. Ela fica ao
lado de "Automatizar" porque **depende dela** — desmarcada a de cima, a rodada pergunta contato a
contato de qualquer jeito, e o texto diz "na rodada automática" em vez de prometer um efeito que ela
sozinha não tem.

**`primaria` é só realce de tecla**, e isso foi conferido antes de pôr "Concluir" em destaque:
`perguntarNaRodada` só desenha a caixa e espera — quem decide sem perguntar é o chamador, antes.
Então o destaque não conclui nada sem a caixa marcada.

### Onde entrou, e onde não entrou

Só em **`processarRespondido`**, que é o automatizado — as três filas (Meus, Novos e Outros) usam
esse mesmo motor, então a opção chega nas três de graça. As duas rodadas de *"sem retorno"*
(`processarSemRetornoEmMeus` e `processarSemRetorno`) ficaram como estavam: estão escondidas desde
15/08, e mexer nelas seria mudar o que ele não pediu.

A chave nova mora em `auto`, que **está na lista de mescla do `store.get`** — conferido, porque
chave nova dentro de objeto já salvo que não esteja nessa lista nunca chega a quem já usa (a
armadilha de 04/09). E ela fica **fora de `CHAVES_DO_PERFIL_EM_AUTO`**: é configuração do operador,
não conteúdo do candidato, e separar aquilo faria o interruptor mudar de estado ao trocar de login.

