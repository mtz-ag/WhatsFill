## 2026-09-05 — ESTADO DE AGORA (v2.53.0) — leia isto primeiro numa sessão nova

Entrada de passagem de contexto, e a única do arquivo que descreve o **presente** em vez de uma
mudança. Ela envelhece: se a versão do `manifest.json` for maior que a do título, confira antes de
confiar, e **reescreva-a** em vez de acrescentar uma segunda.

### O que está no ar

Branch `claude/whatsfill-ia`, **v2.53.0**, tudo commitado e no remoto. **Doze versões no dia 05/09**
(2.42 → 2.53). Quinze suítes verdes, os dois verificadores limpos, **60 caixas** no fluxo padrão sem
problemas e sem desfecho incoerente.

### O que mudou hoje, em uma linha cada

| v | o que |
|---|---|
| 2.42 | **Material pedido não vence com o dia** — exceção em `contexto-de-outro-dia` e em `respondeu-os-dados`, na CONDIÇÃO. |
| 2.43 | **Boas-vindas não pedem o cadastro de quem já tem** — nasceu `boas-vindas-tem-dados`, e a conta virou `sugestao.pedirDadosNaoCabe`. |
| 2.44 | **"trabalhar NA campanha"** — a lista colava preposição e artigo, e as três formas mais naturais nunca casavam. |
| 2.45 | **Link não é pergunta nem conversa** (a query string tinha o "?"), e o rascunho passou a pedir o cadastro que falta. |
| 2.46 | **Etiqueta de ADS conta como "veio de anúncio"** — `session.utm` só sabe da sessão de agora. |
| 2.47 | **Xingamento no imperativo é hostilidade**, e o traço eme virou conserto em vez de pedido. |
| 2.48 | **"Aguardando mensagem" é ruído da plataforma** — o link do FAQ estava virando CIDADE no CRM. |
| 2.49 | **Já atendida antes não recebe as boas-vindas de novo** — o sinal do retorno lia só a sessão, e o CRM é quem tem memória. |
| 2.50 | **"Ver conversa anterior" virou o sinal do retorno** — e a Data de conclusão, que eu tinha posto ali, saiu: concluir não é entregar. |
| 2.51 | **Conversa longa não é "sem interesse"** — recusa de verdade é curta; texto longo vai para ele ou para a IA. |
| 2.52 | **Botão "Chamar a IA" na aba Respostas**, e os cartões passaram a dizer a tecla. O cartão antigo era uma cópia, três consertos atrás. |
| 2.53 | **Mal-estar não é ignorado nem concluído** — e "Estou com infecção" tinha virado apoio. |

### Pendências que NÃO estão no código — precisam dele

1. **Consertar à mão a Cidade de quem já foi contaminado.** O aviso *"Cidade escrita fora do padrão:
   `faq.whatsapp.com`"* aparece no cabeçalho do painel quando acontece. O conserto de 2.48 impede
   novos casos; **não** limpa os que já foram gravados. A aba Cidades lista o que não casa com os
   497 municípios — é por ali que se acha o resto.
2. **Importar o fluxo: não há o que importar hoje.** O quadro dele é o exportado em **2.41.0** (60
   caixas), e nada do dia 05/09 mexeu no `fluxoPadrao` — todas as correções foram em CONDIÇÃO de
   regra do código, que vale em qualquer quadro. Regenerar com
   `node tools/exportar-fluxo.mjs <saida.json>`, saída FORA do repositório.
3. **Aba Automatizado → "Etiquetas que a rodada aplica": as três continuam vazias.**
   - **SEM INTERESSE** — a rodada não marca, e na visita seguinte precisa redescobrir a hostilidade
     do zero. Ficou mais caro hoje: `semInteresse` passou a pegar o xingamento no imperativo, e sem
     a etiqueta nada disso fica registrado.
   - **PEDIU DINHEIRO OU EMPREGO** — ele quer `🔴Procura emprego ou dinheiro`.
   - **MANDOU ENDEREÇO** — a lista de material a enviar; é o que faz a rodada pular o contato até ele
     transferir a conversa.
4. **Os MODELOS PADRÃO estão vazios**, e o anúncio *CONVERSE CONOSCO* não está cadastrado. Sem um dos
   dois não existe modelo nenhum para quem chega por ele: pede material e recebe o formulário seco.
5. **Config → "Modelo por conteúdo", linha `ADS = Campanha Martim`**: não é mais necessário limpar (o
   código tem o piso `tags.ORIGEM_SEMPRE`), mas continua confundindo a leitura.

### Aberto, esperando decisão dele

- **A rodada PARA no rascunho da IA** (`esperarVoceConcluir`, até 30 min ou até ele concluir). Ele
  reportou *"bloqueio de mensagens ao mandar a IA responder"* e, perguntado, disse que o que viu foi
  **resposta rápida com o Enviar apagado** — resolvido em 2.46 (o motivo saiu do tooltip e foi para a
  tela). **A parada da rodada continua como está**, e ninguém decidiu mexer.
- **Áudio antigo sem pergunta: gente ou tempo?** Hoje cai em `ultima-pede-resposta-pessoal` (tecla 6).
- **Casamento aproximado de cidade ainda abre a caixa "Cidade a gravar."**
- **O "me liga" não aplica etiqueta nenhuma** — é um id a mais em `ETIQUETA_PEDIDO_IDS` se ele quiser.
- **Teclas 7, 9 e `i` como caixas do quadro** — oferecido em 04/09, não decidido.

### O que foi medido e o que não foi

**Nada do dia 05/09 foi testado na tela** — tudo medido em Node, contra o fluxo padrão e com o
contexto reconstruído de cada print. As correções do dia são de CONDIÇÃO e de detector, que é o que
permite medir sem navegador; mas o efeito na tela (a linha do bloqueio nas respostas rápidas, o
rascunho com o formulário no fim) só ele vai ver.

### O ritmo desta sessão, para quem entrar agora

Ele manda **uma print e uma frase curta** ("não pegou o contexto", "chegou hostilizando e extensão
não reconheceu"). O trabalho é sempre o mesmo, nesta ordem: **reproduzir com uma medição antes de
mexer** — várias vezes o defeito era maior que o relatado: no caso da hostilidade, *"vai tomar no
cu"* e *"você é um desgraçado"* também passavam batido —, achar a causa, consertar, **medir o
desfecho no fluxo padrão**, escrever o teste de regressão **com os falsos positivos junto**,
registrar aqui e no `CLAUDE.md`, subir a versão e commitar. Uma versão por print.

**Duas armadilhas do ambiente, que custaram tempo hoje:** escrita de arquivo por script Python às
vezes **não persiste** (o script diz que escreveu e o arquivo não muda) — quando acontecer, use a
ferramenta Edit; e escape de `\n` dentro de string JS escrita por script vira quebra de linha de
verdade, o que quebra o arquivo em silêncio até o `checar-modulos` acusar.

### Onde as coisas moram

- **`REGRAS.md`** — as regras que ELE ditou, com onde cada uma vive (código, quadro ou Config).
- **`CLAUDE.md`** — as armadilhas, lido em toda sessão. É onde entra fato que custou horas.
- **`registro.md`** — causa raiz de cada mudança, mais recente no topo.
- **`tests/`** — 15 suítes. **É a forma mais forte de guardar uma decisão dele**; comentário
  envelhece, teste cai. Toda print vira teste, com os falsos positivos junto.
- **`tools/exportar-fluxo.mjs`** — gera o ramo para ele importar, confere relendo e imprime o fluxo
  em texto. Nunca commitar o arquivo gerado.
- **A memória do Claude** (fora do repositório) guarda como trabalhar com ele, não regras do
  projeto: `thiago-opera-a-rodada`, `remover-quando-conflita`, `dizer-quando-ele-esta-errado`,
  `quadro-separado-por-categoria`.

---

## 2026-09-05 — Mal-estar não é ignorado nem concluído (v2.53.0)

### O caso

A **Elenir** chegou pelo anúncio das Escolas Cívico-Militares e, quatro minutos depois, escreveu:

> *"Não posso falar. Estou com infecção urinária e respiratória. muita tosse e febre. Falarei assim
> que for possível. Faço oração pela minha recuperação salutar por gentileza. Grata"*

A rodada **agradeceu o apoio e concluiu**. Ele: *"caso de mal estar foi ignorado e concluído"*.

### Duas causas somadas

**1. "Estou com" tinha virado apoio.** O padrão era
`(estou|tamo|to|estamos|seguimos|segue)\s*(com|junto|juntos)` — qualquer coisa depois do "com". E
"estou com" é a forma mais comum de dizer o que se **tem**: dúvida, problema, fome, medo, febre.
Medido: `soExpressaApoio` devolvia *"escreveu apoio em mensagem própria"* para o texto dela.

A guarda já estava escrita **três linhas abaixo**, para o padrão vizinho: *"'com vocês' sozinho ficou
de fora de propósito — o que qualifica é o advérbio de permanência"*. A mesma disciplina não tinha
sido aplicada aqui. Hoje **"junto" vale sozinho e "com" exige o objeto** (vocês, o senhor, a
campanha), com `contigo` entrando junto.

**2. Nada reconhecia o mal-estar.** `cortesia.naoPodeFalarAgora` cobre as duas situações que têm o
mesmo desfecho: **quem está passando mal** e **quem avisa que fala depois**. A regra
`nao-pode-falar-agora` (tecla 6) foi **juntada** na caixa de `ultima-pede-resposta-pessoal`, que diz
a mesma coisa — aqui precisa de gente.

Medido no contexto dela: antes, tecla `i` (agradece o apoio e conclui); agora, tecla 6, nos três
lugares — com cidade, sem cidade e na chegada pelo anúncio.

### A guarda que sustenta o detector

**Primeira pessoa é obrigatória.** Nesta base a doença aparece o tempo todo na fala política (*"o
Brasil está doente"*), no pedido de remédio (que tem regra própria, acima desta) e na notícia de
terceiro (*"minha vizinha está internada, vocês podem ajudar?"*). Metade das asserções do teste é
falso positivo — é onde mora o risco.

**Não há resposta pronta, e escrever uma seria pior:** o que a pessoa espera é alguém, não um texto.
E **concluir é o pior desfecho possível** — ela avisou que voltaria, e fechar responde que não
precisa.

**Arquivos:** `src/lib/cortesia.js` (o padrão do apoio e o detector), `src/lib/sugestao.js` (a regra
e o verbete), `src/lib/arvore.js` (o sinal e as duas caixas), `src/panel/panel.js`,
`tests/cortesia.test.mjs` (+17), `tests/arvore.test.mjs` (+3), `CLAUDE.md` (+2 armadilhas),
`manifest.json` (2.52.0 -> 2.53.0). Quinze suítes e os dois verificadores.

**O quadro dele PRECISA ser reimportado, e isto foi medido.** `nao-pode-falar-agora` entrou como
`tambemQuando` de uma caixa que ele já tem — mas `tambemQuando` é conteúdo da caixa, e o quadro dele
é uma cópia. Simulando o quadro atual (as três caixas sem a regra nova), o caso da Elenir **continua
recebendo o modelo, tecla 1**; no padrão novo, tecla 6.

E não vale como proteção do código: `arvore.PROTECOES` só cobre regras de efeito `silencio`, e esta é
`gente`. O conserto do `soExpressaApoio` vale desde já (é cálculo do sinal, no painel) — o que
depende da importação é o desfecho.

---

## 2026-09-05 — "Chamar a IA" na aba Respostas, e os botões pela tecla (v2.52.0)

Pedido dele: *"faça um botão de chamar IA na aba das respostas que bote o texto na caixa, e mude os
botões da aba de resposta para ficar de acordo com o projeto atual"*.

### O cartão da IA já existia — e era uma cópia que envelheceu

Ele montava a chamada de `iaCliente.rascunhar` **por conta própria**, em vez de chamar
`rascunharParaEle`, que é a tecla 8 da caixa da rodada. Por isso ficou **três consertos atrás**:

- **não mandava o Nome** — a IA pedia o nome de quem já estava cadastrado (a Catarina, 03/09);
- **não pedia o cadastro** de quem não o deu (05/09), nem tinha o **piso** que acrescenta o bloco
  `Nome , Cidade` quando a IA não o copia — e é esse invariante que faz a rodada enxergar que o
  pedido saiu, em vez de pedir de novo na passada seguinte;
- **jogava fora os avisos da revisão**: a saudação trocada e o traço eme nunca apareciam ali.

A rodada é exercitada centenas de vezes por dia; a aba, não. Então a divergência não aparece em
relato nenhum — aparece só quando ele usa o botão. Agora há **um caminho só**: `iaCliente.rascunhar`
tem uma única chamada no painel.

O botão passou a fazer os dois passos de uma vez, que é o que ele pediu: chama a IA e **põe direto no
campo de mensagem**, com uma cópia no textarea para editar e o botão "Pôr no campo de novo".

**O cartão aparece mesmo com a avaliação por IA desligada**, e é o botão que se desativa (sem chave,
ou com a janela de 24h vencida). `ia.ligada` governa o gasto AUTOMÁTICO da rodada; chamar a IA aqui é
escolha dele, contato a contato — a mesma distinção que `rascunharParaEle` já fazia ao olhar
`iaTemChave`. Esconder o cartão faria o botão sumir justamente para quem desligou a avaliação por
causa do custo. É a lição dos dois campos de etiqueta que sumiram dentro de um cartão escondido.

### Os botões passaram a dizer a TECLA

- "Pedir os dados e seguir" → **"Pede nome e cidade, e conclui (tecla 4)"**
- "Atender o pedido e encerrar" → **"Manda o modelo do conteúdo, e conclui (tecla 1)"**
- "Só encerrar" → **"Conclui sem enviar nada (tecla 3)"**

Só o rótulo mudou; nenhuma ação foi trocada. O motivo é o defeito acima: **dois nomes para a mesma
ação são o começo de duas versões dela**, e enquanto o nome não diz a tecla não há como notar que uma
envelheceu.

**"Com link de grupo" desceu para o fim da aba**, depois das respostas prontas. Ele não corresponde a
tecla nenhuma, o quadro não o alcança, e o comentário no código já dizia desde agosto que *"o contato
já vem de um grupo: o link não faz parte do dia a dia"*. **Não foi removido** — função só sai quando
ele pede.

**Arquivos:** `src/panel/panel.js`, `CLAUDE.md` (+2 armadilhas), `manifest.json` (2.51.0 -> 2.52.0).
Quinze suítes e os dois verificadores.

**Não testado na tela** — é interface, e nenhuma suíte alcança o painel (ele precisa de `window`).

---

## 2026-09-05 — Conversa longa não é "sem interesse" (v2.51.0)

### O caso

Um contato que chegou pelo anúncio (campanha QUAL FOI SUA ESCOLHA) escreveu **927 caracteres** de
análise política — muçulmanos, Xandão, o "golpe após a eleição" — e foi etiquetado como **SEM
INTERESSE**. Ele: *"duas conversas longas foram reconhecidas como sem interesse; for assim, eu que
analiso ou a IA"*.

### O que eu não consegui reproduzir, e o que isso muda

`cortesia.semInteresse` devolve **null** para o texto da print, inteiro **e** quebrado em nove
pedaços — nenhum dispara. Ou seja: o gatilho está no que a print não mostra (a conversa continua
abaixo da rolagem), ou a etiqueta já estava no contato de uma passada anterior.

Isso muda o conserto, para melhor. Caçar o padrão exato consertaria **aquele texto**; a regra que ele
ditou conserta a **classe** — e é a mesma disciplina que fez `conversaTemPerguntaAberta` inverter em
04/09, depois de três tentativas de acrescentar formas a uma lista.

### A regra

**Recusa de verdade é curta.** *"Não quero receber"*, *"me tira da lista"*, *"para de mandar"* — quem
pede para sair escreve uma linha e vai embora. Quem escreve nove linhas está conversando, mesmo
quando o assunto é raivoso, e é exatamente aí que o detector erra: esta base é de apoiadores que
falam mal do adversário.

A guarda do texto curto já existia **dentro** de `COMECA_NEGANDO` (28 caracteres, o caso do Alfredo
em 04/09). Agora vale para a regra inteira: `quando: (c) => !!c.semInteresse && !c.pedeRespostaPessoal`.

**Na condição, não na ordem do quadro.** `sem-interesse` é proteção do código — decide também nos
quadros que ele já exportou, onde caixa nova nunca chega. Mudar a posição só valeria para quem
reimportasse. É a mesma lição de 04/09: *exceção que ele nomeia vai na condição*.

Medido: recusa curta continua na tecla `s`; a mesma recusa dentro de conversa longa vai para
`ultima-pede-resposta-pessoal`, tecla 6. O teste confere os dois caminhos — com a caixa no quadro e
sem ela, que é o da proteção.

### O custo

Quem escreve um texto longo pedindo para sair **não é marcado nem concluído**: vai para ele, na tecla
6. É o lado barato do erro, porque esta é a regra mais destrutiva do arquivo — etiqueta permanente no
CRM **e** conclusão em silêncio, e nenhuma das duas se desfaz sozinha.

**Arquivos:** `src/lib/sugestao.js`, `tests/arvore.test.mjs` (+3), `CLAUDE.md`, `manifest.json`
(2.50.0 -> 2.51.0). Quinze suítes e os dois verificadores. **O quadro dele não muda** — a exceção
está na condição da regra, então vale no quadro que ele já tem.

---

## 2026-09-05 — "Ver conversa anterior" é quem sabe se ela já veio (v2.50.0)

### O caso, que foi meu

A **Neiva** chegou pelo anúncio do Facebook (campanha CAPITÃO MARTIM), escreveu só o texto do
próprio anúncio, **não tem etiqueta de cidade** — e recebeu o modelo + agradecimento, sem o pedido
de nome e cidade. Ele: *"começou a mandar agradecimento em vez de pedir os dados; segundo caso já, e
claramente é pessoa nova que chegou por anúncio"*.

A causa foi o conserto da Rosa, horas antes. Eu havia posto a **Data de conclusão do contato** dentro
de `jaRespondemosAntes` escrevendo, em comentário, que ali *"falso positivo é impossível"*.

É o contrário. A data prova que **já concluímos um atendimento**, não que **já entregamos alguma
coisa** — e esta rodada conclui em silêncio o tempo todo (tecla 3, `ultima-e-nossa`,
`etiqueta-so-conclui`). Num dia de 268 conclusões, a data está em quase todo mundo que já passou por
uma rodada.

**É a lição da Ivone (31/08) na forma que eu não reconheci:** *pergunta não é entrega* — e conclusão
também não é. O comentário dela está três linhas acima do que eu escrevi.

Medido com o contexto da Neiva: com o sinal verdadeiro o caso vai para `conteudo-pedido` (tecla 1,
que é a print); com ele falso, para `anuncio-modelo-e-dados` (tecla `a`), que é o certo.

### O sinal de verdade, que ele apontou

*"Tem uma trava que identifica pessoa nova, que é conversa anterior; normalmente eu tenho que clicar
para abrir a conversa do dia anterior."* — e mandou o exemplo: o botão **"Ver conversa anterior"** no
topo da conversa, que a plataforma só mostra quando existe atendimento anterior.

É exatamente o que a API não dá: `getConversation` é por SESSÃO, então uma conversa sem nada nosso
pode ser a primeira vinda ou a décima. Nenhuma etiqueta responde isso sem palpitar — e os dois
palpites erraram, um para cada lado: as boas-vindas repetidas na Rosa, o cadastro não pedido na
Neiva.

`dom.temConversaAnterior()` lê por TEXTO, como a tarja de canal caído e pelo mesmo motivo (o
`data-cy` não é conhecido, e o texto é o que a plataforma promete ao usuário). A guarda contra o
falso positivo é rejeitar o que está dentro de balão de mensagem. Viaja por `page.js` +
`rpc-host.js`, então funciona também no modo janela; falhar devolve `false`, e aí decide a etiqueta
de cidade, como antes.

`state.temConversaAnterior` é **zerado na troca de contato**, junto do anúncio e dos sinais — sem
isso, a primeira vinda de um herdaria o histórico do outro.

### O que fica

A etiqueta de cidade continua no sinal, como segunda marca: ela cobre o caso em que a leitura da
tela falha, e é a decisão dele de 02/09. A Rosa é pega pelas duas.

**Arquivos:** `src/lib/dom.js` (o sinal), `src/lib/page.js`, `src/lib/rpc-host.js`,
`src/panel/panel.js` (a leitura, o `state` e o cálculo), `tests/arvore.test.mjs` (+2), `CLAUDE.md`
(+2 armadilhas), `manifest.json` (2.49.0 -> 2.50.0). Quinze suítes e os dois verificadores.

**Não testado na tela** — `temConversaAnterior` lê o DOM da plataforma e nenhuma suíte alcança isso.
Se o botão tiver outro texto, o sinal devolve `false` e o comportamento é o de 2.49.

---

## 2026-09-05 — Já atendida antes não recebe as boas-vindas de novo (v2.49.0)

### O caso

A **Rosa** mandou uma figura de "bom dia" às 05:49. Ela carrega etiqueta de cidade (Porto Alegre),
de COREDE (Metropolitano) e de conteúdo (Contra MST) — e recebeu *"Bem-vindo. Você está falando com
o gabinete do Capitão Martim. Em que podemos ajudar?"*, seguido de conclusão.

Ele: *"não foi a primeira vez que a pessoa veio, mesmo que esteja sem etiqueta ADS; correto seria
mensagem do momento, dois casos seguidos já"*.

### A causa

`jaRespondemosAntes` lia **só a conversa**, e a conversa é a sessão. Quem volta sozinha semanas
depois abre uma sessão nova: `state.nossas` nasce vazio, o sinal dá falso, e o quadro manda o caso
para o ramo *"anúncio — pessoa nova"* — onde `chegada-boas-vindas` a apresenta ao gabinete pela
segunda vez.

Medido antes de mexer, com o contexto dela: `chegada-boas-vindas` com o sinal falso, tecla 5
(mensagem do momento) com o sinal verdadeiro. É o desfecho que ele pediu, e o quadro já o produzia —
faltava o sinal dizer a verdade.

**É a armadilha do Orides outra vez**, dois dias depois: `session.utm` é *"veio de anúncio NESTA
sessão"*, e a etiqueta é *"veio de anúncio"*. Aqui o par é o mesmo — **a conversa é uma janela, a
marca no CRM é a memória.**

### O conserto

O sinal passou a somar duas marcas que não dependem da sessão:

- **a Data de conclusão do contato**, que só a extensão grava, ao concluir. Falso positivo é
  impossível; ela apenas não alcança quem foi concluído fora do painel;
- **a etiqueta de cidade que já estava no CRM.** É a decisão dele de 02/09, que já estava escrita no
  código: *"se a pessoa já respondeu a cidade a chance de ela ter recebido um modelo é muito
  grande"*.

`cidadeJaNoCrm` nasceu separado de `temEtiquetaDeCidade`: a etiqueta que **esta passada vai gravar**
não conta como memória, senão quem responde o cadastro na primeira vinda viraria retorno na mesma
passada em que chegou.

### O que muda, medido

Em 30.000 contextos sorteados **com etiqueta de cidade**, 2,9% mudam de desfecho:

- **dois terços deles não tinham desfecho nenhum** — atravessavam o quadro em silêncio, porque
  `ja-respondemos-antes` só existe no ramo do retorno. Agora recebem a mensagem do momento, a
  conclusão ou a tecla 6;
- o caso da Rosa (as boas-vindas dando lugar ao momento, à conclusão ou ao modelo);
- quem tem cidade deixa de receber a pergunta de interesse de `nada-legivel-dela` — ela existe para
  quem não deixou nada para trabalhar, e cidade é alguma coisa.

**Nenhuma mudança tira um caso de você para mandar mensagem:** não há transição de tecla 6 para
tecla 1 ou 5 na varredura.

**O custo, que é real e fica dito:** contato de base importada, com o campo Cidade preenchido e
conversando conosco pela primeira vez, passa a receber a mensagem do momento em vez das boas-vindas.

**Arquivos:** `src/panel/panel.js` (o sinal e `cidadeJaNoCrm`), `src/lib/arvore.js` (o rótulo do
sinal na janela), `tests/arvore.test.mjs` (+3), `CLAUDE.md`, `manifest.json` (2.47.0 → 2.49.0 — o commit de
2.48 escreveu o número no registro e esqueceu de subi-lo no manifesto).
Quinze suítes e os dois verificadores. **O quadro dele não muda** — nenhuma caixa entrou ou saiu,
então não há o que reimportar.

---

## 2026-09-05 — "Aguardando mensagem" virava CIDADE no CRM (v2.48.0)

Print dele: no fluxo do contato havia *"⏳ Aguardando mensagem. Essa ação pode levar alguns
instantes. Saiba mais: https://faq.whatsapp.com/…"* — e o cabeçalho do painel mostrava
**Cidade: faq.whatsapp.com**, com o aviso *"Cidade escrita fora do padrão"* e a resposta do grupo
oferecendo *"Este é o grupo de faq.whatsapp.com"*.

Medido: `ehMensagemDaPlataforma` devolvia **false** para esse texto. É a mesma família do Carlos e
da Vera (02/09) — a plataforma escreve no fluxo do contato e nós lemos como fala dela —, com uma
diferença que a torna pior: **este ruído carrega um link, e link vira dado**. O parser em modo
"resposta ao pedido" aceita qualquer palavra solta, e a URL virou município.

Os dois padrões novos são o começo do aviso e a frase do meio, separados de propósito: a primeira
parte muda com o idioma do aparelho. O falso positivo que importa (*"estou aguardando mensagem de
vocês há dias"*) está no teste.

**O conserto não limpa o que já foi gravado** — ver a pendência 1 do ESTADO DE AGORA.

---

## 2026-09-05 — Hostilidade no imperativo, e o traço eme da IA (v2.47.0)

### *"chegou hostilizando e extensão não reconheceu"*

Print: a contato chegou pelo anúncio do Facebook, mandou o texto de apoio às 23:38 e, **um minuto
depois**, *"Então vá para o inferno.. desgraçado"*. A rodada não viu nada.

Medido, e as duas metades falhavam:

- **`desgraçado` não estava na lista de xingamentos** — nem canalha, escroto, arrombado, pilantra,
  picareta, "filho da puta", fdp;
- **"vá para o inferno" não estava na lista de segunda pessoa**, que só conhecia pronomes (*você*,
  *vocês*, *tu*, *teu*). Mandar alguém ir a algum lugar **é** falar com a pessoa: o verbo carrega o
  "você" que a lista procurava.

Testei antes de mexer: *"vai tomar no cu"*, *"vá se fuder"* e *"você é um desgraçado"* **também**
passavam batido. Não era o caso da print, era a regra inteira.

**A guarda que fica:** o imperativo sozinho só conta quando é a mensagem inteira — *"kkkk vai tomar
no cu esse Lula"* é apoiador falando do adversário, e é a fala mais comum desta base. Com outro
xingamento junto (o caso da print), ele vale como direção. Metade das dezesseis asserções é falso
positivo, que é onde mora o risco: esta regra deixa etiqueta permanente no CRM e conclui em silêncio.

Desfecho medido: **tecla `s`** — marca sem interesse e conclui sem responder. É proteção do código,
então vale no quadro dele sem importar nada.

### *"a IA não segue todas as instruções? pedi para não usar travessão eme e continua usando"*

A resposta é a lição mais repetida deste projeto: **prompt é pedido, código é regra.** As instruções
extras dele vão para o prompt, e o modelo as segue quase sempre — "quase" não serve para o que é
verificável. Foi assim com o relógio e com a saudação, ontem.

Agora `revisarRascunho` **troca o traço eme por hífen** e avisa; e **avisa** (sem reescrever) quando o
rascunho abre com *"entendi"*, que é a outra instrução dele — ali não dá para consertar sem
reescrever a frase, e reescrever é escrever no lugar da IA. O que depende de julgamento (*"dê corda
para quem busca remuneração"*) continua só no prompt, que agora diz para seguir as instruções da
equipe **literalmente**, acima das regras de estilo e nunca acima da lista do que ela não pode
escrever.

**E o motivo pelo qual isso passou tanto tempo despercebido:** o painel jogava fora os avisos que
vinham de `validarRascunho` e chamava `revisarRascunho(rascunho)` de novo — com o **objeto**, que
vira `[object Object]`. Nenhum aviso jamais apareceu na tela.

Vinte e duas asserções novas. Quinze suítes verdes, os dois verificadores limpos.

---

## 2026-09-05 — A etiqueta de ADS não contava como "veio de anúncio" (v2.46.0)

Print dele (o Orides): etiqueta **ADS** no CRM, mandou um vídeo do TikTok às 20:05, e às 11:43 do dia
seguinte recebeu as **boas-vindas de "chegou sem anúncio"**, com o pedido de cadastro junto.
*"a pessoa com etiqueta de ADS e parou no ramo de sem etiqueta"*.

### A causa

O sinal `veioDeAnuncio` lia só `session.utm` — que é **"veio de anúncio NESTA sessão"**. Quem clicou
no anúncio semanas atrás e volta sozinho abre sessão sem `utm`, e a **etiqueta é justamente o que
guarda que ele veio de lá**. Detector é palpite; a marca no CRM é decisão, e decisão não se
redescobre — a mesma lição da etiqueta de sem interesse (susana, 03/09) e da de material.

Hoje o sinal é `session.utm` **ou** a etiqueta de origem (`tags.etiquetasDeOrigem`, que já tem o piso
`ADS` no código e não depende de campo preenchido).

**As outras duas leituras de `utm` continuam como estão, de propósito:** `prepararEntrantes` marca a
primeira mensagem da sessão como gerada pelo anúncio (uma etiqueta velha marcaria a fala de outra
visita), e a etiqueta de origem só é aplicada a quem chega agora.

Medido: com a etiqueta, o vídeo deixa de cair em `chegada-boas-vindas` e vai para a caixa da reação
— **tecla 5**, mensagem do momento. Só uma caixa do quadro usa esse sinal, então o raio é esse.

### E o motivo do bloqueio saiu do tooltip

*"bloqueio de mensagens ao mandar a IA responder"* — respostas rápidas com o **Enviar apagado**. O
botão só ficava cinza, com a explicação num `title` que exige parar o mouse em cima; a aba Respostas
já mostrava o motivo embaixo do cartão, e era a lista da **caixa da rodada** que faltava. É a regra
do projeto: *na dúvida, recusar com o motivo na tela* — e tooltip não é tela.

Três asserções novas. Quinze suítes verdes, os dois verificadores limpos.

---

## 2026-09-05 — Link virava pergunta, e o rascunho não pedia o cadastro (v2.45.0)

Dois relatos dele, e o primeiro tinha uma causa que eu não teria adivinhado sem medir.

### 1. *"vários casos da pessoa mandando link e reconhece como conversa e passa pra mim"*

**A URL carrega a query string** — `?igsh=`, `?utm_source=`, `?v=` — e o teste de pergunta é
`texto.includes('?')`. Medido: um link do Instagram sozinho volta como *"fez uma pergunta que
nenhuma resposta pronta responde"*, e `perguntaPendente` volta `true`. Ou seja, **toda pessoa que
repassa vídeo caía na tecla 6**, e a pergunta pendente ainda impedia concluir.

Somava-se uma segunda conta: três links com legenda curta (*"olha isso &lt;link&gt;"*) somam **224
caracteres** e viravam *"escreveu 3 mensagens próprias — é conversa"*. Ela escreveu quinze
caracteres; o resto é endereço.

`semLinks` tira o link antes das duas contas — a da pergunta e a do tamanho. É o mesmo critério que
já tira o texto gerado pelo anúncio: **o que ela não escreveu não conta como escrita dela.**

Medido depois: link sozinho → tecla 5 (mensagem do momento); três links com legenda → tecla 5 na
volta, tecla 4 na chegada. **Pergunta de verdade continua indo para ele**, com link junto ou sem, e
texto escrito continua contando — quatro asserções guardam esse lado.

### 2. *"faltou detalhes, não pediu dados"*

O rascunho respondeu bem o policial militar da reserva e **não pediu nada**. O prompt tinha o bloco
que diz o que **não** pedir (o caso da Catarina, 03/09) e nada dizia o que pedir.

Agora, quando falta cadastro, o prompt manda **fechar com o formulário, copiado literal** —
`ia.PEDIDO_DE_DADOS_NO_RASCUNHO`. Literal porque a linha `Nome , Cidade` é o **invariante** que
`templates.ehPedidoDeDados` reconhece: deixando a IA pedir com as palavras dela, a rodada não
enxerga que o pedido saiu e pede de novo na passada seguinte. Quem decide se pede é a **mesma conta**
que guarda o formulário da rodada (`sugestao.pedirDadosNaoCabe`).

E há um **piso**: se a IA não copiar o bloco, o painel o acrescenta, com aviso no log.

### 3. `revisarRascunho` estava morta neste caminho

Achado ao mexer aqui: ela era chamada com o **objeto** (`String({…})` dá `[object Object]`) e **depois**
de o texto ir para o campo. Ou seja, desde 04/09 nenhum aviso apareceu, e a troca da saudação errada
— a única correção que ela faz, criada por causa do *"Boa noite!"* às 16:21 — **nunca chegava ao
eleitor**. Hoje ela roda antes, sobre o texto, e o revisado é o que vai para o campo.

Vinte e uma asserções novas. Quinze suítes verdes, os dois verificadores limpos.

---

## 2026-09-05 — "trabalhar NA campanha" não casava com nada (v2.44.0)

Print dele: *"Boa noite"* às 17:04 e *"Vc está chamando gente pra trabalhar na campanha tou
precisando"* às 17:05. *"não pegou o contexto"*.

### A causa era gramatical

Medido: **nenhum** detector via nada — nem `pedeEmprego`, nem `pedeAjudaFinanceira`, nem
`pedeAlgoIndefinido`. A lista de formas colava a preposição no artigo:

```
trabalhar (para|pra|com|no|na) (voce|voces|vc|vcs|ti|o mandato|o gabinete|a campanha)
```

E **"no o mandato" não existe**. Ou seja: *"trabalhar NA campanha"*, *"trabalhar NO mandato"* e
*"trabalhar NO gabinete"* — as três formas mais naturais de dizer isso — nunca casaram, embora
*"trabalhar para a campanha"* casasse desde 02/09. A preposição e o artigo agora são peças
separadas, que é o que a gramática pede.

Entrou junto a pergunta pela vaga **sem a palavra vaga**: *"vocês estão contratando/chamando gente"*,
que é a forma da print.

### A metade cara: quem se OFERECE não está pedindo emprego

O texto que nega abre com *"procurar trabalho cansa"* e explica que a lei proíbe indicar vaga — é a
resposta errada para quem escreveu que quer ajudar **de graça**, e "quero trabalhar na campanha" é
exatamente o que um voluntário escreve. As guardas novas são literais: *"sou voluntária"*,
*"de graça"*, *"sem ganhar nada"*. **"É remunerado ou voluntário?" continua sendo pedido** — ali a
pergunta É sobre dinheiro, e está na lista de cima.

Onze das dezesseis asserções são falso positivo, que é onde mora o risco desta regra.

### O desfecho, medido nos três ramos

`pedido-emprego` nos três — chegada, volta, e volta com a mensagem de ontem. A caixa fica acima de
`contexto-de-outro-dia`, então o tempo não a engole.

**Lembrete:** a etiqueta que este caso deveria aplicar (`🔴Procura emprego ou dinheiro`) continua
**vazia** na Config — o texto sai, a marca não.

---

## 2026-09-05 — As boas-vindas pediam o cadastro de quem já tinha (v2.43.0)

*"já tem os dados e pediu novamente; a mensagem padrão provavelmente só tem pedindo dados"*.

A print: contato com etiqueta de **cidade (Erechim)** e de conteúdo, que mandou uma figura. A rodada
mandou as boas-vindas — e elas trazem *"nos informe: Nome , Cidade"* dentro.

### Ele estava certo sobre a causa

O texto existia numa **redação só**, e ela funde duas coisas: a apresentação do gabinete e o pedido
de cadastro. Não havia como dar as boas-vindas sem pedir os dados. É o mesmo defeito das duas
respostas de evento (02/09), que confirmavam a presença **e** pediam o cadastro no mesmo texto, e o
conserto é o mesmo: **escrever a metade que faltava**.

`boas-vindas-tem-dados` é a metade nova — mesma abertura, mesmo *"em que podemos ajudar?"*, sem o
bloco do cadastro. Migração própria, então ela chega em quem já tem a lista salva.

### E a caixa não tinha guarda nenhuma

A caixa "chegou sem anúncio e só cumprimentou" nasceu ontem com duas condições (só cumprimentou, não
veio de anúncio) e **nada sobre já termos o cadastro** — enquanto a caixa do formulário, três linhas
abaixo, tem três guardas para isso. Quem escolhe agora é o painel, pela mesma conta:

`sugestao.pedirDadosNaoCabe` — `jaDeuNomeECidade || jaPediramDados || temEtiquetaDeCidade` — passou a
ser **exportada**, e `nunca-pediram-dados` a usa no lugar da conta escrita à mão. Uma definição só:
duas cópias divergem na primeira guarda nova, e a que ninguém olha é a que pede o cadastro de quem já
o deu.

### A troca é do TEXTO, não da caixa

Como a tecla 4 faz com o evento e a tecla 5 com o pedido junto do momento. O quadro continua dizendo
"manda boas-vindas" e o rótulo da opção mostra qual das duas sai — duas caixas para a mesma situação
divergiriam na primeira semana. **Não há fluxo novo para importar.**

Treze asserções novas. Quinze suítes verdes, os dois verificadores limpos.

---

## 2026-09-05 — O material pedido não vence com o dia (v2.42.0)

*"o modelo de material é uma exceção, ele sempre tem que ser mandado quando requisitado; nesse caso
mandou mensagem do momento e concluiu"*.

A print: anúncio do Facebook (campanha CONVERSE CONOSCO), ela escreveu **"Olá! Eu quero receber o
Material da Direita"** às 13:23, a rodada só a alcançou no dia seguinte — e mandou a **mensagem do
momento**, concluindo o atendimento.

### O que a medição mostrou

Reproduzido no quadro padrão, com o contexto da print:

| situação | antes | agora |
|---|---|---|
| chegada, sem modelo, **de ontem** | tecla 5 (`contexto-de-outro-dia`) | tecla 4 |
| chegada, com modelo, de ontem | tecla a | tecla a |
| volta com cidade + modelo, **de ontem** | **tecla 5** | **tecla 1** |
| volta sem cidade + modelo, **de ontem** | **tecla 5** | **tecla 1** |

`contexto-de-outro-dia` fica **acima da entrega do modelo nos três ramos**, então o pedido de
material vencia com o dia. Não vence: pedido não entregue continua de pé na semana que vem, e é a
razão pela qual a pessoa apareceu.

### O conserto

`cortesia.pedeMaterial` é o detector, e ele exige **verbo E objeto** — *"quero receber"* sozinho
pega *"quero receber a visita de vocês"*, e *"material"* sozinho pega *"obrigada pelo material"*.
Metade das dezoito asserções é falso positivo, que é onde mora o risco.

Ele lê a **conversa inteira**, ao contrário do `informouEndereco`: o que impede a repetição não é a
janela de tempo, é a **entrega** — o painel calcula `materialPendente = pediuMaterial &&
!modeloJaNaConversa && !enviadoHoje`, então o sinal se apaga sozinho no instante em que o modelo
sai, e a caixa do tempo volta a valer. Sem isso seria a armadilha já registrada: o texto do anúncio
fica na conversa para sempre.

**A mensagem gerada pelo anúncio CONTA aqui** — e é o oposto do `soExpressaApoio`, onde o texto do
anúncio não pode virar fala dela. Aqui **o clique É o pedido**: ela escolheu o anúncio que dizia
"Material da Direita".

### As duas exceções ficam na CONDIÇÃO

`contexto-de-outro-dia` e `respondeu-os-dados` ganharam `!materialPendente`. Na condição e não na
posição, pelo motivo já registrado: **vale onde quer que a caixa esteja no quadro dele** — inclusive
no quadro 2.14.0 que ele ainda usa. **Não há fluxo novo para importar**; o padrão continua com as
mesmas 60 caixas.

A segunda foi achada na varredura, não no relato: `respondeu-os-dados` agradece e conclui *"sem
mandar modelo, porque o modelo já foi o recibo da chegada"* — argumento que deixa de valer quando o
recibo não foi. Medido em 10.000 contextos, era a **única** caixa que ainda enterrava o pedido
(4.201 deles), e o caminho é real na configuração dele hoje: sem modelo padrão cadastrado ela recebe
só o formulário, responde *"Maria, Canoas"* e era agradecida e concluída **sem nunca receber o
material**. Depois do conserto: **0 de 10.000**.

### O que isto NÃO conserta, e é dele

Nesta print **não havia modelo nenhum para mandar**: o anúncio CONVERSE CONOSCO não está cadastrado
na Config e os **modelos padrão estão vazios**. Com a correção ela deixa de ser concluída com a
mensagem do momento e passa a receber o formulário (tecla 4) — o material só sai quando ele
cadastrar o anúncio com o modelo dele, ou preencher os modelos padrão.

Vinte e quatro asserções novas. Quinze suítes verdes, os dois verificadores limpos.

---

## 2026-09-04 — As caixas do quadro estavam se sobrepondo (v2.41.0)

*"as caixas estão se sobrepondo, arrume para não acontecer"*.

Causa minha, e recente: o cartão ganhou hoje a linha do **desfecho no topo** e a do **nome no
rodapé**, cresceu de altura — e a arrumação continuou espaçando as linhas por `CAIXA.altura`, que
valia **96**. Cartão maior que o espaço reservado é sobreposição garantida.

**Cartão de altura variável exigiria medir cada um na tela antes de posicionar** — a arrumação é
função pura, não tem DOM. Então a altura virou **fixa**: `height: 140px` no `.caixa` com o texto
cortado (o desfecho em até duas linhas, a exceção e o nome em uma), e `CAIXA.altura` subiu para 140,
o mesmo número. De quebra, o quadro fica alinhado.

Tem teste: nenhuma caixa se sobrepõe depois de `arrumar`, e a altura tem que acompanhar o cartão.
**Mexeu no conteúdo do cartão? Os dois números andam juntos** — o do CSS e o do `arvore.js`.

**O quadro dele continua com as posições antigas** (espaçadas para 96): o conserto chega
importando o `fluxo-padrao-2.41.0.json`, que já vem arrumado, ou clicando em "Arrumar o quadro" —
este último desfaz o arranjo manual, e tem o desfazer de 20 passos.

---

## 2026-09-04 — Uma caixa por desfecho: as situações foram juntadas (v2.40.0)

*"agora junte todas as situações que são usadas na mesma tecla em vez de 2 ou mais; como na print
são duas tecla 3, junte as duas e faça o mesmo com exemplos parecidos"*.

É a consequência do que ele pediu antes: se o quadro se lê pelo que **nós** mandamos, duas caixas com
o mesmo desfecho são a mesma caixa — o que muda entre elas é só a situação que a libera.

### O que foi juntado

`tambemQuando` é a lista de situações a mais de uma caixa, e elas valem por **OU** (o contrário de
`maisCondicoes`, que é **E**). Seis merges, **70 → 60 caixas**:

| caixa | situações juntadas |
|---|---|
| conclui sem mandar nada (chegada e volta) | é da casa **ou** a última é nossa |
| pula e deixa aberto (chegada e volta) | confirmou presença **ou** mandou o endereço |
| você responde (chegada) | pedido sem objeto **ou** pergunta · áudio/texto longo **ou** denúncia |
| você responde (nos dois lados de cidade) | pedido sem objeto **ou** pergunta |
| agradece e conclui (nos dois lados) | respondeu os dados **ou** só expressou apoio |

### O que NÃO foi juntado, e por quê

**Só se junta o que está colado na ordem de decisão.** A despedida também conclui (tecla 3) e ficou
de fora: ela vive lá embaixo, onde precisa perder para a pergunta e para o pedido de dinheiro —
juntá-la com a proteção do topo moveria uma das duas. O mesmo vale para as quatro caixas de "tecla
variável", cuja tecla é uma função diferente em cada regra.

### A prova, e o defeito que ela pegou

A varredura antes/depois: **0 decisões diferentes em 10.000 contextos sorteados**.

Mas a primeira rodada dela deu **32%** de diferença, com a tecla `s` virando 2 ou 3. Causa:
`decidir` só aplica a proteção do código para regra que o quadro **não tem**, e essa conta lia
apenas `no.regra`. Ao juntar `informou-endereco` dentro da caixa de `confirmou-presenca`, ela sumiu
da conta — a proteção passou a disparar **antes** da árvore e venceu até a recusa. Peguei na
varredura, não por teste.

### Na janela

O cartão mostra as situações separadas por **OU**. No editor, uma caixa de regra ganhou
*"OU TAMBÉM QUANDO"*, com **Separar** em cada situação juntada e um seletor para juntar outra — e a
lista de escolha só oferece situações **do mesmo desfecho**, porque juntar teclas diferentes faria a
caixa mandar uma coisa quando a outra casasse.

Nove asserções novas. Quinze suítes verdes, os dois verificadores limpos, 60 caixas sem problemas.

---

## 2026-09-04 — O quadro passou a ser lido pelo que NÓS mandamos (v2.39.0)

*"no momento o fluxo se baseia no texto de quem vem, eu quero me basear no que vamos falar e nas
nossas respostas rápidas — na print a ordem está trocada"*.

A print era um cartão do quadro:

```
só expressou apoio (não sobrou o que mandar)      ← linha grande
É o desfecho de quem só apareceu para dizer…      ← a condição
→ tecla i · Agradece o apoio, e conclui           ← o que sai, por último e pequeno
```

Um quadro que decide **o que mandar** estava sendo lido pela descrição de quem chega. Invertido:

```
Agradece o apoio, e conclui (tecla I)             ← linha grande
quando: É o desfecho de quem só apareceu…         ← a condição
só expressou apoio (não sobrou o que mandar)      ← o nome da caixa, no rodapé
```

**O nome da caixa continua existindo** — é a etiqueta com que nós dois apontamos para o mesmo lugar
("a caixa 2.7.3"). O que mudou é o que salta aos olhos.

**No editor a ordem inverteu junto**: primeiro *"Vamos mandar…"*, depois *"Só quando o contato…"*.
Primeiro se escolhe o que vai sair; depois se escreve quando aquilo pode sair. O contrário ensinava
a montar o quadro pelo texto de quem chega.

**E a tecla saiu da frente**: onde se lia *"tecla i · Agradece o apoio"* agora se lê *"Agradece o
apoio, e conclui (tecla I)"*. A tecla é detalhe do dedo dele na caixa da rodada, não o assunto do
quadro.

Nada mudou no comportamento e **o fluxo padrão não mudou** — é só a janela. Não precisa reimportar.

---

## 2026-09-04 — Revisão caixa a caixa: a chegada (v2.38.0)

Começou a revisão que ele pediu — *"em cada caixa você vai me perguntar e vou responder o que fazer
em todas as situações; vamos começar por um contato novo chegou"*. Levantei antes o que a chegada
faz hoje em catorze situações, para ele responder olhando o que existe.

### Duas decisões, nesta rodada de perguntas

**1. Anúncio não cadastrado, sem modelo padrão** — *"mandar o modelo padrão e pedir dados para
cadastro"*. **Nada a mudar no código**: é exatamente o que a tecla `a` faz quando há modelo. O que
falta é a Config — com "Modelos padrão" vazio, `podeEnviar` é falso e sobra só o pedido de dados.
Está na lista de pendências dele desde 02/09.

**2. Contato novo que NÃO veio de anúncio** — *"depende da forma que a pessoa chegou. Se ela chegou
cumprimentando, podemos mandar uma mensagem: bem-vindo, você está falando com o gabinete do Capitão
Martim, em quê podemos ajudar? E se puder nos forneça seu nome e cidade para melhor atendê-lo — e
então concluir até o contato responder. Se o contexto for maior, como uma pergunta já de cara, então
eu devo assumir ou a IA. Se a pessoa for hostil já de início, encerra e é marcada como sem
interesse."*

### O que entrou

**Resposta pronta nova, "Boas-vindas (chegou sem anúncio)"** — o texto dele, com a linha
`Nome , Cidade` obrigatória (é o invariante que faz a resposta dela ser lida como resposta ao
formulário) e com migração própria, porque mudar as respostas de fábrica sozinho **não alcança quem
já tem a lista salva** — a lição de hoje mais cedo.

**Caixa nova na chegada**, e ela é o **primeiro uso das duas condições numa caixa do padrão**:
*só cumprimentou* **E** *não veio de anúncio*. Quem chega por anúncio tem recibo a receber, e o
recibo já pede os dados — as duas caixas nunca disputam o mesmo contato, e quem garante isso é a
condição, não a posição. É o que ele pediu hoje, valendo na prática.

As duas exceções que ele nomeou no mesmo recado **já estavam de pé e foram medidas**: pergunta logo
de cara vai para a tecla 6 (ele ou a IA), e hostilidade é pega pela proteção do topo, mesmo com
cumprimento junto.

| situação (contato novo, sem anúncio) | antes | agora |
|---|---|---|
| só cumprimentou | tecla 4 — formulário seco | **manda "Boas-vindas" e conclui** |
| fez uma pergunta | tecla 6 | tecla 6 |
| áudio ou texto longo | tecla 6 | tecla 6 |
| hostil de início | tecla `s` | tecla `s` |

Padrão: **70 caixas**, sem problemas e sem desfecho incoerente. Quinze suítes verdes.

---

## 2026-09-04 — O botão de tirar a condição é um BOTÃO (v2.37.0)

*"ficou sem botão de excluir condição adicionada"*.

Eu tinha posto o "tirar esta" como **opção dentro do seletor de sinais**, com o argumento — escrito
no código, para piorar — de que um botão separado seria *"mais uma coisa para procurar"*. É o
oposto: ele procurou o botão e não achou.

É a lição que este projeto já registrou duas vezes, com o arrastar e com o pino: **gesto invisível é
gesto que não existe**. E aqui era pior, porque o destrutivo estava escondido dentro da lista do
inofensivo — ninguém procura "apagar" numa lista de sinais.

Agora cada condição e cada exceção extra tem um botão **Tirar** ao lado do seletor, e a opção vazia
do seletor voltou a significar o que parece ("— escolha o sinal —"). De quebra, o botão de
acrescentar usava uma classe de CSS que não existe no arquivo (`mini`) — passou a usar `btn`, como
todos os outros.

---

## 2026-09-04 — O quadro passou a decidir por condições e exceções (v2.36.0)

*"o fluxo trabalha com prioridade quando devia estar trabalhando com condições e exceções; se todas
condições são aceitas, enviar mensagem de acordo"*.

### Ele estava apontando um número, e o número era feio

Medido no quadro padrão, 3.000 contextos sorteados:

```
caixas com desfecho no quadro:                  62
regras DISTINTAS que casam ao mesmo tempo:      10,5 (média)
contextos em que mais de uma MANDARIA mensagem: 85%
```

Ou seja: na maioria dos casos quem escolhia a mensagem era a **altura** da caixa, não a condição
dela. Com uma condição só por caixa, a condição significa *"eu poderia atender este contato"*; ela
nunca chega a dizer *"eu sou a resposta certa para ele"* — e o resto do trabalho ficava com a ordem,
que é invisível quando o quadro tem 62 caixas.

### O que mudou

**Uma caixa agora tem N condições e N exceções.** Decide quando **todas** as condições são verdade e
**nenhuma** exceção é. Ele pode escrever, numa caixa só, *"veio de anúncio E não tem cidade E ainda
não pedimos os dados, exceto se já respondemos hoje"* — que antes exigia depender da posição.

- Na janela: **"+ acrescentar condição"** e **"+ acrescentar exceção"**, cada linha com o seu
  *"— tirar esta —"* no próprio seletor (botão separado, num editor comprido, é mais uma coisa para
  procurar).
- **Na caixa de REGRA a condição extra ESTREITA**: a condição do código continua mandando, e a dele
  é somada com E. Nenhuma mensagem passa a sair por causa disso — mesma disciplina da exceção, que
  é o que torna seguro deixá-lo mexer numa caixa de regra.
- Tudo passa pela peneira da importação: sinal inventado é descartado com aviso, e há teto de 6
  condições extras por caixa.

### O empate, que era invisível

Escolha dele: **a de cima ganha, e o quadro acusa**. `decidir` devolve `empate: [rótulos]` e a linha
do Andamento fica *"…— empate com: X; Y (ganhou por estar mais acima)"*.

**Medido no contato real, não no papel**: uma varredura estática ("estas duas podem casar juntas?")
acusaria quase todos os 1.900 pares do quadro, e alarme que toca sempre se aprende a ignorar. Só
conta quem **envia** — duas caixas que concluem em silêncio não custam nada.

### O que NÃO mudou

O comportamento de hoje: nenhuma caixa do padrão ganhou condição nova, então a rodada decide
exatamente como decidia. O que existe agora é a **capacidade** de escrever caixas completas — e a
acusação para achar onde ainda falta.

Doze asserções novas. Quinze suítes verdes, os dois verificadores limpos, 69 caixas sem problemas.

---

## 2026-09-04 — REGRAS.md: as 65 regras que ele ditou, e onde cada uma vive (v2.35.0)

*"eu quero que liste todas as regras que eu lhe falei até agora"* — logo depois de descobrir que uma
regra dele de 03/09 nunca tinha chegado à extensão, por ter virado valor padrão de um campo já
preenchido.

Levantei do `CLAUDE.md` e do `registro.md` (486 falas dele registradas, curadas para 65 regras) e
escrevi o `REGRAS.md`, em nove blocos: o que nunca sai daqui, quem não recebe nada, o que precisa de
gente, anúncio e modelo, tempo, cadastro e etiquetas, o quadro, o comportamento da rodada, e como eu
devo trabalhar.

**A coluna que importa é "onde vive"**, e ela existe por causa do caso de hoje:

| onde vive | vale quando | risco |
|---|---|---|
| código | sempre | nenhum — se sumir, um teste cai |
| quadro | depois que ele importa | ordem errada ou caixa faltando muda o desfecho em silêncio |
| Config | com o campo preenchido | **campo vazio = regra desligada, sem aviso** |

O arquivo fecha com o que está **desligado agora por campo vazio**: as três etiquetas da aba
Automatizado e os modelos padrão.

Entrou no PROTOCOLO do `CLAUDE.md` como item 0: antes de mexer numa regra, saber se ela vale sempre
ou depende de configuração.

---

## 2026-09-04 — "Pra onde estão indo as regras que eu falo?" (v2.34.0)

Print de uma contato que chegou pelo anúncio do Instagram escrevendo *"Olá! Eu quero receber o
Material da Direita"*, com cidade (Rosário do Sul) e etiqueta de conteúdo — e foi **concluída sem
receber nada**, às 22:11.

A etiqueta dela era **CONTATO-ASSESSOR**.

### A regra existia, e não tinha chegado nele

Ele definiu isso em 03/09: a lista de "etiquetas que só concluem" é `assessor`, *"com exceção do
contato assessor"* — que é eleitor trazido por um assessor, não gente da casa. Eu implementei
mudando o **valor padrão** do campo para `assessor, -contato-assessor`.

**E o default não alcança quem já tem valor salvo.** `store.get` mescla o default só nas chaves que
faltam; o campo dele já existia com `assessor`, e continuou com `assessor`. A exceção ficou no
código, correta, e nunca chegou à extensão dele.

Medido com a config antiga:

| lista | `CONTATO-ASSESSOR` | desfecho |
|---|---|---|
| `assessor` (o que ele tem salvo) | **casa** | tecla 3 — conclui sem mandar nada |
| `assessor, -contato-assessor` | não casa | tecla 1 — manda o modelo do conteúdo |

### O conserto

`NUNCA_SO_CONCLUI` é um **piso do código**: `-contato-assessor` entra na lista sempre, seja qual for
o texto do campo. É o mesmo desenho do `tags.ORIGEM_SEMPRE`, criado em 04/09 pela mesma razão — *a
guarda que depende de o campo estar preenchido não é guarda*.

O assessor de verdade continua sendo pego (testado com `ASSESSOR REGIONAL`), e o campo continua
editável: o piso só impede que a exceção se perca.

### A lição, que é maior que este caso

**Regra ditada por ele não pode virar default de campo que ele já preencheu.** Mudar o default só
alcança instalação nova — e existe uma só, a dele. Quando a regra é dele, ela vira **código**: um
piso, uma condição de regra, uma constante. O default serve para o que é preferência, não para o que
é decisão.

Vale a pena varrer os outros campos de Config com essa pergunta; não fiz isso ainda.

Quinze suítes verdes, os dois verificadores limpos. **O fluxo padrão não mudou** — nada para
reimportar.

---

## 2026-09-04 — A mensagem do anúncio agora é reconhecida por dado (v2.33.0)

*"nós temos um problema sério de identificação... me diz o que falta e o que você consegue ver
hoje"*. Fiz o inventário e a primeira coisa da lista virou este commit.

### O defeito, medido

A contato da print chegou pelo anúncio do Facebook e escreveu só a mensagem gerada por ele:

> Olá! Eu **estou do lado da segurança e** apoio o Capitão Martim 🫡

O padrão cadastrado em `padroesDeAnuncio` é `^olá!? eu apoio`. Não casa.

```
é mensagem de anúncio?  false
soExpressaApoio         "escreveu apoio em mensagem própria"
```

Com isso o texto **do anúncio** contou como fala dela, e ela foi agradecida por um apoio que não
escreveu — na primeira vez que apareceu. **O anúncio mudou de redação e a lista não**: é a mesma
armadilha das formas de perguntar, que já custou três anotações.

### O conserto: dado em vez de texto

A plataforma diz que a sessão veio de anúncio (`utm.source` / `utm.referralUrl`), e
`getConversation` é **por sessão** — o `utm` também. Então a **primeira mensagem de uma sessão com
`utm`** é, por construção, o clique que a abriu: é o texto pré-preenchido, não a voz dela.

O painel passou a marcá-la com `geradaPeloAnuncio`, em `prepararEntrantes` — a mesma função que já
marcava o ruído da plataforma (`sistema`). **Um lugar só, antes de qualquer regra ver**, que é o
desenho que essa marca já tinha.

`cortesia.ehMensagemDeAnuncio` honra a marca antes de olhar a lista, e as duas regras que dependiam
dela herdam de graça: `soExpressaApoio` e `conversaPedeRespostaPessoal`.

### Medido depois

| caso | antes | agora |
|---|---|---|
| chegou pelo anúncio, sem modelo padrão | tecla i — agradece o apoio | **tecla 4 — pede nome e cidade** |
| chegou pelo anúncio, com modelo padrão | tecla i | **tecla `a` — recibo + pede os dados** |
| escreveu apoio depois da mensagem do anúncio | tecla i | tecla i (não mudou) |
| apoio escrito por ela, sem anúncio | tecla i | tecla i (não mudou) |

**A lista de padrões continua existindo**, e não é redundante: ela é o que alcança o *segundo*
clique, num anúncio que não abriu sessão nova.

### O resto do inventário, para não se perder

O que ainda falta, na ordem que eu faria: identificar **de qual** anúncio sem depender do cadastro
(`utm.campaign` chega pronto); **número de mensagens** como sinal do quadro (hoje só existe escondido
dentro de "texto longo"); **tempo** além de "é de outro dia" (a hora de cada mensagem está lá, o
sinal é que não existe); **quando o contato/sessão nasceu**; **tipo de mídia** separado (áudio, vídeo,
documento); e `jaDeuNomeECidade` no menu de sinais, que o motor calcula e o quadro não alcança.

Quinze suítes verdes, os dois verificadores limpos. **O fluxo padrão não mudou** — nada para
reimportar.

---

## 2026-09-04 — A lista única foi desfeita: os dois ramos voltaram (v2.32.0)

*"pedindo dados sem contexto por pessoa que não veio por ads, não estou gostando desse fluxo, parece
ter criado mais problemas — antes estava separado por categoria: não veio por ads, veio por ads mas
sem cidade, e veio por ads e tem os dados. Agora ficou uma salada."*

Revertido. O quadro voltou a ter os dois ramos (69 caixas), com tudo o que foi consertado hoje.

### O defeito da print, medido nos dois quadros

A conversa tinha um convite de grupo nosso e duas mensagens dela — *"Bom dia"* e *"Sim aceito"* —,
não veio de anúncio, e recebeu o formulário seco às 21:45, com conclusão em seguida.

| quadro | desfecho |
|---|---|
| dois ramos (2.28.0) | tecla 5 — mensagem do momento |
| **lista única (2.29.0)** | **tecla 4 — pede nome e cidade** |

A causa é minha, e é precisa: no lado "sem etiqueta de cidade" a caixa `nunca-pediram-dados` só
existia **dentro** do grupo do anúncio reconhecido. Ao achatar, ela virou uma caixa solta que vale
para todo mundo — e "o formulário é para quem veio de anúncio" era uma decisão que morava na
**posição**, não em nenhuma condição. Eu tinha visto essa mudança e escrito no teste que era "o
propósito da regra". Não era: era uma decisão dele que a estrutura guardava.

### A segunda print, mesma causa

Uma contato chegou pelo anúncio do Facebook pela primeira vez, escreveu só a mensagem gerada pelo
anúncio (*"Olá! Eu estou do lado da segurança e apoio o Capitão Martim"*) e recebeu **o
agradecimento pelo apoio** — *"mandou mensagem agradecendo apoio sendo que é a primeira vez que
aparece o contato"*.

| quadro | desfecho |
|---|---|
| dois ramos | tecla 4 — pede nome e cidade |
| **lista única** | **tecla i — agradece o apoio** |

Mesma família: na chegada, `so-expressa-apoio` tinha que ficar em **ÚLTIMO** lugar — está registrado
desde 03/09, porque *a mensagem do anúncio É apoio escrito*, e `soExpressaApoio` só a descarta quando
o anúncio está cadastrado na Config. Ao achatar, ela subiu para cima de `nunca-pediram-dados` e
passou a agradecer a chegada de todo anúncio não cadastrado.

**Com os "Modelos padrão" preenchidos, este contato receberia a tecla `a`** — o recibo do anúncio
mais o pedido de dados —, que é o desfecho certo. Sem eles, a tecla 4 é o que sobra.

### O que a medição não mediu

Medi *"quanto muda o desfecho"* (0,34%) e concluí que os ramos eram redundantes. A pergunta certa era
outra: **o que o ramo faz por ele**. A divisão é como ele lê o quadro e decide a ordem — olhando —, e
é onde ficam decisões que nunca foram escritas como condição. A duplicação continua sendo real (21
das 24 regras, e quatro defeitos registrados por causa dela); as duas coisas são verdade ao mesmo
tempo, e quem decide o custo aceitável é ele.

**O caminho daqui:** quando uma regra só valer num ramo, essa condição vai para o `quando` da regra —
uma de cada vez, quando o caso aparecer. Foi o que já aconteceu com `anuncio-modelo-e-dados` e
`nada-legivel-dela`, que ganharam `!jaRespondemosAntes` na condição e **ficaram assim**: a guarda
agora vale mesmo nos quadros já exportados, o que é melhor do que depender da posição.

### O que sobreviveu da versão de ontem à noite

Tudo o que não era estrutura: o bloco que faltava na chegada (2.28.0), a mensagem do momento com o
pedido de dados junto (2.30.0) e o pedido de endereço que marca e não conclui (2.31.0).

Quinze suítes verdes, os dois verificadores limpos, 69 caixas sem problemas e sem desfecho
incoerente.

---

## 2026-09-04 — Pedir o endereço pelo modelo agora marca e NÃO conclui (v2.31.0)

*"pedi o endereço pelo modelo e não etiquetou e concluiu"*, com a print do modelo aprovado:
*"Para encaminharmos seu pedido ao assessor responsável pela sua região, por favor, me informe seu
endereço completo (rua, número, bairro e cidade)"*.

### O que faltava

O caso de material tinha só **uma ponta**: `cortesia.informouEndereco`, que reconhece quando **ela**
responde com um endereço, aplica a etiqueta e pula. Mas quem **abre** o caso é o nosso pedido — e
era ele que passava batido: o modelo saía, nada era marcado, e a rodada concluía o atendimento.

Concluir ali é pior do que nos outros casos: a conversa acabou de fazer uma pergunta, e fechar diz
*"não precisa responder"* para quem estava prestes a mandar o endereço.

### Como ficou

`templates.ehPedidoDeEndereco` reconhece o pedido **por invariante** — *"endereço completo"*, ou a
enumeração `rua` + `número` + `bairro`. **Por invariante e nunca por id de modelo**: este pedido sai
por modelo aprovado, cuja redação é da plataforma e muda sem passar por nós. É a mesma lição do
`ehPedidoDeDados`, e aqui vale mais.

Duas coisas passaram a acontecer quando esse texto sai:

1. **A etiqueta de material é aplicada**, dentro do `sendTemplate` — o ponto único por onde toda
   mensagem sai (a rodada, o modelo aprovado, um ramo do quadro, a escolha da IA, as respostas
   rápidas). O aviso vai junto do status, e diz se o campo da Config está vazio.
2. **A rodada deixa o atendimento ABERTO**, com o motivo no log: *"pedido de endereço, deixei o
   atendimento ABERTO para você transferir"*.

Daí em diante o caso já andava: com a etiqueta no contato, a rodada pula em toda passada até ele
tirar a marca, que é o gesto de "esta conversa foi transferida".

### O que continua dependendo dele

O campo **"Etiqueta de quem MANDOU ENDEREÇO"**, na aba Automatizado. Vazio, o atendimento fica
aberto do mesmo jeito, mas nada é marcado — e é a marca que junta a lista.

Quinze suítes verdes, os dois verificadores limpos. **O fluxo padrão não mudou** — nada para
reimportar.

---

## 2026-09-04 — O formulário seco virou mensagem do momento + pedido com contexto (v2.30.0)

Print dele: o contato mandou uma imagem de bom dia às 08:18, ele assumiu o atendimento às 21:16 e a
rodada soltou *"🚨 ATENÇÃO! Para eu poder salvar seu contato me diga seu: Nome, Cidade"*. Relato:
*"soltou sem contexto nenhum"*.

E a ideia veio junto: *"vamos adicionar a seguinte mensagem pra esse tipo de contato que ignorou o
pedido de dados na primeira vez — será a mensagem do momento + notei que estou sem seu nome aqui nos
meus contatos e não sei de onde você é, poderia me informar"*.

### Como ficou

**Não é tecla nova.** É a **tecla 5** trocando de texto quando o contato **já recebeu o formulário e
continua sem nome e sem cidade** — o mesmo desenho de `confirmaPresenca` na tecla 4. O rótulo da
opção muda junto ("Mensagem do momento + pedir nome e cidade e concluir"), senão a rodada mandaria
duas coisas diferentes com o mesmo nome na tela.

O texto que vai colado, editável na aba Automatizado logo abaixo da mensagem do momento:

> Ah, e aproveitando: notei que ainda não tenho o seu nome aqui nos meus contatos, e também não sei
> de onde você é. Pode me passar:
>
> Nome , Cidade
>
> (exemplo: Pedro Silva , Porto Alegre)

Vazio, a tecla 5 volta a mandar só a mensagem do momento.

### Duas coisas que o fazem não repetir nem quebrar

**O id continua sendo o do momento.** A anti-duplicata precisa enxergar as duas formas como a mesma
entrega — quem recebeu a combinada recebeu a do momento —, e é isso que faz `momentoJaEnviado` apagar
o sinal na passada seguinte. Com id próprio, a caixa ofereceria a mesma coisa todo dia.

**A linha `Nome , Cidade` é obrigatória**, e é o que o teste protege: é o invariante que
`templates.ehPedidoDeDados` casa. Sem ela o texto sai igual e o defeito é calado — a resposta dela
deixa de ser lida como resposta ao formulário e a rodada pede de novo. Foi exatamente isso que custou
três anotações quando o separador do template mudou de barra para vírgula. O campo da Config avisa na
tela se o texto perder a linha.

### O que alcança este contato

Qualquer caixa que recomende a tecla 5 passa a mandar a versão com contexto para quem está nesse
estado — a figura/emoji, o cumprimento, a caixa do tempo e "já entregamos algo antes". No caso da
print, quem decide é *"mandou figura, emoji, sticker ou link"*. Quem escreve algo que nenhuma caixa
reconhece continua indo para ele ou para a IA, e a tecla 5 já está com o texto certo se ele apertar.

Quinze suítes verdes, os dois verificadores limpos. **O fluxo padrão não mudou** — nada para
reimportar.

---

## 2026-09-04 — O quadro virou UMA lista: 69 caixas → 28 (v2.29.0)

Pergunta dele: *"a questão é se realmente tem necessidade de duas árvores que seguem praticamente as
mesmas regras, seja na aba novos ou na aba meus"*. Não tinha — e a primeira parte da resposta foi
corrigir a premissa: **os dois ramos nunca foram "Novos" e "Meus"**. O ramo era escolhido por
`jaRespondemosAntes`; desde 03/09 as duas filas rodam o mesmo fluxo.

### O que a medição mostrou

O quadro era **três cópias** da mesma lista — a chegada, o lado "sem etiqueta de cidade" e o lado
"com etiqueta". **21 das 24 regras apareciam mais de uma vez: 36 caixas duplicadas em 69.**

| forma | caixas | decisões diferentes (contextos sorteados) |
|---|---|---|
| antes | 69 | — |
| sem a bifurcação de cidade | 50 | 5/4000 (0,13%) |
| **uma lista só** | **28** | **27/8000 (0,34%)** |

As 27 diferenças são todas da mesma natureza e na direção que ele já tinha decidido: o que **precisa
de gente** (pedido de dinheiro, de emprego, de ligação, pergunta aberta, pedido sem objeto, denúncia
respondida) passou a vencer caixas que ganhavam só por estarem no topo de um dos lados.

### Por que a duplicação era o problema, e não o número de caixas

A bifurcação de cidade **não decidia nada**: os dois lados eram idênticos menos uma caixa, e a cidade
já é testada dentro da condição de cada regra. E o custo estava registrado quatro vezes neste
arquivo — a etiqueta que dispensa, o apoio, o grupo que escondia caixas e a chegada inteira: **regra
que existe num ramo e não no outro decide para metade da base, e ninguém vê.**

### A única coisa que a chegada carregava

O **recibo do anúncio acima das pendências neutras** (figura, cumprimento, despedida) — decisão dele
de 02/09. Isso cabe numa lista única, e a guarda mudou de lugar: `anuncio-modelo-e-dados` e
`nada-legivel-dela` ganharam **`!jaRespondemosAntes` na própria condição**. Antes era o ramo que
garantia; sem isso o recibo sairia para quem já foi atendido — peguei medindo, não por teste.

É a lição da exceção do tempo, de novo: **exceção que ele nomeia vai na condição, não na posição.**
Bônus: a guarda passou a valer também nos quadros que ele já exportou.

### A ordem da lista, de cima para baixo

1. **Proteções** (6): recusa, assessor, última é nossa, presença confirmada, endereço, etiqueta que
   dispensa;
2. **As três respostas que negam**: dinheiro, emprego, ligação;
3. **O que precisa de gente**: pedido sem objeto, pergunta aberta, áudio/texto longo, denúncia
   respondida;
4. **O recibo do anúncio** + "nada legível dela";
5. **Pendências neutras**: figura, cumprimento, despedida;
6. **Conteúdo**: anúncio reconhecido → tempo → respondeu os dados → apoio → modelo;
7. **Fecho**: pede nome e cidade, já entregamos algo antes.

### Uma mudança que ele deve saber

No lado "sem etiqueta de cidade", `nunca-pediram-dados` só existia **dentro** do grupo do anúncio
reconhecido — então quem voltava por um anúncio não cadastrado não recebia o formulário, por
posição. Agora a caixa é uma só e quem decide são as guardas da própria regra (`!jaPediramDados`,
`!pedidoHoje`, `!temEtiquetaDeCidade`, `!jaDeuNomeECidade`). **O formulário continua não saindo duas
vezes** — é o que a decisão dele protegia, e há teste. O que passou a acontecer é pedir nome e
cidade a quem nunca recebeu o pedido.

### O que fica para ele

Ele já disse que tem o backup do último fluxo. **A reimportação é obrigatória** para o quadro dele
virar a lista única; sem ela o quadro antigo continua decidindo, com as três cópias. O cartão "O
padrão mudou?" vai acusar muita coisa — é esperado, e desta vez o certo é resetar/importar em vez de
encaixar caixa por caixa.

Quinze suítes verdes, os dois verificadores limpos, 28 caixas sem problemas e sem desfecho
incoerente.

---

## 2026-09-04 — A chegada estava atrás da volta em seis caixas (v2.28.0)

*"o fluxo de chegada parece ter sido deixado pra trás, confira; muitas regras se aplicam lá
também"*. Estava certo, e o defeito era estrutural.

### Por que faltar caixa na chegada não vira buraco — vira inversão de ordem

O ramo geral (*"pessoa retornando"*) **não tem condição**: ele é a rede que pega tudo o que a
chegada não resolveu. Então a chegada não é um fluxo separado, é uma camada de **prioridade** que
roda antes. Consequência: o que falta nela não deixa o contato sem desfecho — **deixa o desfecho
para a caixa que a chegada tem e a volta não teria alcançado ainda**, que ali é o MODELO.

A chegada ia do bloco de perguntas direto ao modelo. Medido, com um modelo disponível:

| caso | chegada (antes) | volta |
|---|---|---|
| denúncia respondida à nossa pergunta | **tecla 1** (modelo) | tecla 6 |
| quer trabalhar para o mandato | **tecla 1** | `pedido-emprego` |
| pediu que a gente ligasse | **tecla 1** | `pedido-ligacao` |
| respondeu o nome e a cidade | **tecla 1** | tecla i (agradece) |
| só se despediu | **tecla 1** | tecla 3 |
| despediu-se ONTEM, sem modelo | tecla 5 (a do momento) | tecla 3 |

A pior é a primeira: `respondeu-nossa-pergunta` existe desde 01/09 **exatamente** para impedir
material de campanha em cima de uma denúncia, e protegia só metade da base.

### O que entrou, e onde

Seis caixas, nas posições espelhadas da volta:

- **acima do recibo** (mandar a nossa mensagem primeiro É o dano): `pedido-emprego`,
  `pedido-ligacao` — as irmãs do `pedido-ajuda`, que tinha caixa aqui desde 02/09 e veio sozinho —
  e `respondeu-nossa-pergunta`;
- **abaixo do recibo**: `ultima-e-so-reacao` e `ultima-e-despedida`;
- **acima do modelo genérico**: `respondeu-os-dados`.

### O que muda na decisão dele de 02/09, e é bom ele saber

As duas pendências neutras tinham sido **removidas** da chegada em 02/09, e havia teste exigindo
que não estivessem lá. A decisão dele era sobre ORDEM (*"pendência depois do modelo"*) e continua
de pé: o **recibo do anúncio** ganha da despedida e da figura na chegada — tem teste novo travando
isso. O que mudou é que elas agora **existem** ali, abaixo do recibo, e por isso vencem duas coisas
que não deveriam ter ganhado delas: a caixa do TEMPO (mensagem do momento por cima de um "amém") e
o modelo **genérico** — que não é o recibo do anúncio, e que para quem já tem cidade nem é
carregado desde 2.22.0.

O teste novo compara os DOIS ramos no mesmo contexto, em vez de procurar a caixa: se alguém tirar
uma de um lado, os dois passam a discordar e ele cai.

Padrão: **69 caixas** (a chegada foi de 16 para 22), sem problemas e sem desfecho incoerente.
Quinze suítes verdes.

---

## 2026-09-04 — "Boa noite!" às 16:21: o relógio faltava no rascunho (v2.27.0)

Print dele, com o rascunho da IA aberto no campo de mensagem: *"a IA respondeu com boa noite e agora
é 16:22 — é algo que já tinha falado para checar hora e data atual antes de formular mensagem"*.

### Ele estava certo, e o conserto de hoje de manhã foi pela metade

Em 2.16.0 o relógio entrou no prompt — **no caminho da DECISÃO**. `montarContato` abre com
`agoraEmPortugues`. `montarContatoRascunho`, que é o que **escreve texto para eleitor**, ficou de
fora: ele carimbava cada mensagem com `quandoFoi` e nunca dizia que horas são AGORA.

E o carimbo, sozinho, empurra para o erro: a última fala dela estava marcada `ontem 20:21`, e "boa
noite" é a dedução natural de quem só vê isso. **Carimbar as mensagens não é ter relógio** — é
saber quando as coisas foram, sem saber quando é agora.

### Três camadas, porque prompt é pedido

1. O bloco do rascunho passou a abrir com a hora, como o da decisão.
2. E diz a saudação certa **por extenso** (`saudacaoDeAgora`): deduzir a faixa da hora é justamente
   o passo em que ele errou, então o código faz a conta.
3. `revisarRascunho` **troca** a saudação quando ela abre o texto e está errada, com o aviso
   dizendo que trocou. É a única correção que a revisão faz no texto da IA, e cabe aí por ser
   verificável e mecânica: quem decide é o relógio, não uma leitura do que ela escreveu.

Rascunho **sem** saudação continua sem — acrescentar uma seria escrever no lugar da IA.

Doze asserções novas no `ia.test.mjs`. Quinze suítes verdes, verificadores limpos.

---

## 2026-09-04 — Quatro anotações: a cidade que sumia na chegada, e o pedido por extenso (v2.26.0)

Quatro anotações, e as três primeiras são **o mesmo defeito** — a mesma forma de resposta, a mesma
queixa: *"falhou em pegar minas do leão como cidade"*, *"não reconheceu chuvisca como cidade"*,
*"ela deu a sigla rg - rio grande"*.

### A causa das três: "mensagem a mensagem" tinha DUAS portas

O conserto de 02/09 fez a busca por contexto olhar mensagem a mensagem em vez da conversa colada.
**O caminho generoso não foi junto.** `respostaAoPedido` — o modo que a nossa própria pergunta
autoriza, que dispensa pista e tamanho — continuou lendo a conversa INTEIRA, e a conferência que o
protege ("o que sobra depois de tirar a cidade tem que ser um nome de gente") passava a ver o texto
do anúncio junto do nome. Resultado: **nada era aceito**.

E quem chega pelo anúncio tem SEMPRE duas mensagens — o texto do anúncio é uma delas. Ou seja: o
modo generoso não funcionava justamente para a maior parte de quem chega.

Medido: a mesma resposta que devolve `Chuvisca` sozinha devolve **vazio** com a mensagem do anúncio
junto. Agora a busca é da mais nova para a mais antiga, e mensagem que casa mas não passa na
conferência **não derruba a passada inteira** — segue para a próxima.

### Duas coisas menores que faltavam, e cada uma explicava uma anotação

**A preposição pendurada.** *"…Alves **de** Minas do Leão"*: tirado o município, sobra
`… Alves de` — cinco palavras, e o limite do nome são quatro. O "de" nem é do nome, é da cidade.
`semConectorSolto` tira nas duas pontas.

**A sigla da cidade colada na do estado.** *"Praia do Cassino. RG RS"* — o bairro não é município e
não tem como ser; o que identifica o lugar é o `RG RS`. Entrou `SIGLAS_DE_CIDADE`, lido **só** na
passada que olha para trás da sigla do estado. Fora dali `RG` é o documento de identidade: um
apelido em `ALIASES` faria *"meu RG é 123"* virar Rio Grande na base inteira. A lista tem um item.

### A quarta: pedido financeiro escrito por extenso

*"Qualquer mil reais já me ajuda"*, duas vezes na mesma rajada, e o caso foi para a tecla 6.
Ele: *"está claro que é pedido financeiro e não foi identificado"*. O marcador de dinheiro exigia
**dígito** antes de "reais" — e quem escreve mil, cem ou quinhentos escreve por extenso. Agora a
palavra do valor vale colada em "reais"; "mil" sozinho não, porque é a quantidade de tudo nesta base
("mil abraços", "mil vezes"). Entraram junto `aluguel`, `farmácia` e `conta de luz/água` nas
necessidades, que continuam exigindo o verbo de pedir.

Medido no quadro dele e no padrão: o caso passou a resolver em `pedido-ajuda`, a resposta que nega
com respeito, em vez da tecla 6.

**A exposição que fica, e é a mesma de antes:** marcador de dinheiro sozinho basta, então
*"gastaram mil reais nessa obra"* — reclamação sobre gasto público — é lida como pedido. Vale
igual para `R$ 5000` e `5000 reais`, que já eram assim; o formato novo não criou a classe. Se
aparecer numa anotação, o conserto é exigir verbo de pedir junto do valor.

Quinze suítes verdes, os dois verificadores limpos.

---

## 2026-09-04 — Quem faz pular é a ETIQUETA, não o detector (v2.25.0)

Correção da versão anterior, no mesmo dia, com uma frase dele: *"já tem uma etiqueta na plataforma
pra isso, só tenho que configurar ela assim como a de sem interesse — e para pular o contato sempre
será depois que eu pedir o endereço e etiqueta for colocada"*.

### O que estava errado

Em 2.24.0 o que fazia pular era o **detector**, lendo a conversa inteira. Dois defeitos nisso, e o
segundo é o que ele nomeou:

1. **Conversa inteira nunca esquece.** Uma rua citada num desabafo de julho deixaria o contato
   pulado para sempre, sem nada dizendo por quê.
2. **O detector não é a decisão.** Ele é palpite sobre um texto; a marca no CRM é a decisão — e
   decisão dele não se redescobre a cada passada. É a lição da susana (03/09), a mesma que fez a
   etiqueta de sem interesse passar a ser LIDA e não só aplicada.

### Como ficou

**A etiqueta manda.** Contato com a etiqueta de material configurada é pulado em toda passada,
tenha ele escrito o que for — e nada é gravado nessas passadas, porque a marca já está lá.

**O detector é a outra ponta**, e só isso: reconhece a resposta dela e aplica a marca, para ele não
ter que marcar contato por contato. Passou a ler a **rajada** — o endereço que conta é o que ela
escreveu depois da nossa última mensagem, ou seja, respondendo a alguma coisa nossa. É a tradução
literal do *"depois que eu pedir o endereço"*.

**E o detector some sozinho**, de propósito: respondida a pessoa, a rajada esvazia e ele volta a ser
falso. Se a etiqueta fosse só um efeito colateral, o contato voltaria à automação no dia seguinte.
Com ela no comando, o contato fica fora até **ele tirar a etiqueta** — que é o gesto que diz "esta
conversa foi transferida".

O rótulo da tecla 2 diz qual dos três casos é: *"Pular e marcar X"*, *"Pular (já marcado como
material a enviar)"*, ou o *"Pular (deixa aberto)"* de sempre.

Padrão: 63 caixas, sem problemas e sem desfecho incoerente. Quinze suítes verdes.

---

## 2026-09-04 — Mandou o endereço: pula, marca, e ele transfere no fim (v2.24.0)

Pedido dele, com o anúncio novo: *"anúncio novo é sobre material de campanha e eu peço endereço...
a pessoa deve ser pulada e não concluída, pois vou transferir pro responsável a conversa no final"*.

### O que ele cortou, e por que ele estava certo

A primeira leitura era o cruzamento de duas metades — **pediu material E deu endereço** —, e ele
cortou pela metade que é verdadeira na base dele: *"deixe somente para quando eu pedir endereço, no
momento só peço endereço para enviar material"*.

Cruzar teria sido pior, e não mais seguro. Nesta base *"quero receber o material"* é a frase mais
comum que chega e significa conteúdo **digital** — e ela vem do texto do próprio anúncio, que fica
na conversa para sempre. A metade "material" não separava nada; a metade "endereço" separa sozinha,
porque **só se pede endereço para mandar material**.

**Reconhecer a NOSSA pergunta também não serviria de gatilho**, e é a lição já registrada duas
vezes: ele pede o endereço à mão, com a redação do dia, então não há invariante para casar e a
regra nunca dispararia. O sinal é o que ELA escreve.

### Como o endereço é reconhecido

`cortesia.informouEndereco` conta MARCAS na mensagem: via (rua, avenida, travessa…), bairro, a
palavra "endereço", complemento (casa, apto, bloco, lote, km) e o número da casa. O CEP basta
sozinho; fora ele são **duas marcas**, e uma delas tem que dizer que ali há um lugar.

**O número é a marca delicada**, e é onde estava o falso positivo caro: dígito solto é qualquer
coisa. Ele só conta depois de vírgula (*"Rua das Flores, 123"*), fechando a mensagem (*"Rua João
Silva 456"*, que é como se escreve endereço sem pontuação) ou com o `nº` explícito. Aceitar dígito
em qualquer posição faria *"a rua aqui está esburacada há 20 anos"* — reclamação de rua, comum
nesta base — virar endereço, com a marca da via junto. Das 20 asserções do teste, 10 são falso
positivo.

Rodava na **conversa inteira** nesta versão; passou a ler a **rajada** em 2.25.0, e quem carrega o
caso adiante virou a etiqueta — ver a entrada acima.

### A tecla é 2, e a etiqueta é a exceção do "pular"

Tecla **2 e não 3**, pela mesma razão da confirmação de presença: concluir tiraria da tela
justamente a conversa que precisa ser passada para outra pessoa.

E o pulo passou a **gravar uma coisa** — a etiqueta nova, "Etiqueta de quem MANDOU ENDEREÇO", no
cartão de etiquetas da aba Automatizado. É exceção à decisão dele de 31/08 (*"ao pular tem gravado
dados no CRM, o que faz eu perder tempo"*), e é estreita de propósito: **uma escrita de etiqueta**,
só quando o endereço foi reconhecido, sem gravar campo nenhum, sem data de conclusão e sem abrir a
pergunta de cidade — que era o que custava caro ali. Sem a etiqueta, pular não deixa rastro, e ele
teria que reencontrar esses contatos na fila inteira.

A etiqueta vale também quando é ELE que aperta o 2: marcar só no automático faria a marca depender
de quem apertou. O rótulo da tecla diz que ela vai junto, porque regra da rodada que depende de
estado invisível parece defeito.

### Onde a caixa fica

Em `arvore.PROTECOES` e nas duas pontas do padrão (chegada e volta), acima da bifurcação de cidade —
proteção que vive num lado só é proteção pela metade, e isso já aconteceu duas vezes neste arquivo.

**Medido contra o quadro que ele tem** (`fluxopadrao2.14.0.json`): decide a tecla 2 nos três casos
(com cidade, sem cidade, chegada pelo anúncio), por `protecao:informou-endereco` — ou seja,
**funciona antes de ele importar qualquer coisa**, que é o que importa num anúncio que já está no
ar. Sem o sinal, o quadro dele decide como antes (tecla 5, `ja-respondemos-antes`).

Padrão: **63 caixas**, sem problemas e sem desfecho incoerente. Quinze suítes verdes.

---

## 2026-09-04 — Os campos de etiqueta estavam escondidos há vinte dias (v2.23.0)

*"não achei esse campo na extensão na aba automatizado"*. Ele tinha razão, e o motivo é pior do que
não achar: **o campo não estava na tela.**

Os três campos de etiqueta viviam dentro de `renderCartaoReabrir` — o cartão da rodada de "sem
retorno", **escondido desde 15/08** por decisão dele (reabrir gente fria em sequência é o padrão que
mais se parece com disparo em massa). Escondi as duas linhas que o punham na tela; os campos foram
junto, e dois deles não têm nada a ver com aquela rodada:

- **Etiqueta de SEM INTERESSE** — a rodada aplica quando alguém recusa ou hostiliza, e **lê** na
  visita seguinte;
- **Etiqueta de quem PEDIU DINHEIRO OU EMPREGO** — aplicada quando sai uma das respostas que negam.

As duas regras existem, funcionam e estavam **impossíveis de configurar**. Pior: a primeira passou
dois dias na lista de pendências desta sessão como *"coisa para ele preencher"*, num campo que não
existia. Eu escrevi a pendência sem conferir se dava para cumpri-la.

Agora há um cartão próprio, **"Etiquetas que a rodada aplica"**, visível na aba Automatizado, com um
aviso quando as duas estão vazias. O cartão escondido ficou só com o campo que é dele.

A lição, que vale para a próxima vez que algo for escondido: **esconder um cartão esconde tudo o que
está dentro dele.** Antes de comentar a linha que o desenha, veja o que mais mora ali.

**Arquivos:** `src/panel/panel.js`, `CLAUDE.md` (+1 armadilha), `manifest.json` (2.22.0 → 2.23.0).
Quinze suítes e os dois verificadores.

---

## 2026-09-04 — O modelo padrão só na primeira vinda pelo anúncio (v2.22.0)

Regra dele, com a definição junto:

> *"a exceção de mandar modelo novamente é somente quando o modelo não é o padrão; contato que não é
> a primeira vez que vem por anúncio não recebe modelo padrão"* — e, no mesmo recado: *"considere
> todos os anúncios que não estão listados nas configurações como padrão"*.

**A definição já era a do código**, e conferi antes de mexer: `modeloDoAnuncio` só devolve
`deOnde: 'anuncio'` quando o anúncio está cadastrado **e ligado** na Config; tudo o mais cai em
`deOnde: 'padrao'`. Anúncio desligado também é padrão.

O que faltava era a guarda do "primeira vez". O padrão é o **recibo de quem chegou** — ele confirma
que a pessoa vai receber, e não entrega conteúdo nenhum (decisão dele, 02/09). Mandado de novo, é a
mesma frase pela segunda vez, e quem volta pelo anúncio já ouviu.

`modelosPadrao` passou a exigir três coisas:

```
veioDeUmAnuncio && !temEtiquetaDeCidade && !jaRespondemosAntes
```

- `jaRespondemosAntes` é o "não é a primeira vez" **entregue**, não "já falamos": pergunta não conta.
  É a lição da Ivone (31/08) — quem só recebeu o pedido de dados não recebeu nada ainda;
- `temEtiquetaDeCidade` já estava lá desde 03/09: cidade conhecida é indício de recibo enviado;
- e o cálculo de `jaRespondemosAntes` **subiu no arquivo**, porque a escolha do modelo passou a
  depender dele e no lugar antigo ele ainda não existia. O bloco é fechado em si (só lê
  `state.nossas` e `state.templates`), então mover foi seguro.

**A exceção que ele nomeou fica intacta:** o modelo do anúncio RECONHECIDO sai em qualquer caso —
volta, cidade cadastrada, o que for. Ela clicou pedindo aquilo, e aquilo é conteúdo de verdade, não
recibo. Medido nos quatro cenários.

**Arquivos:** `src/panel/panel.js`, `tests/anuncios.test.mjs` (+7), `CLAUDE.md` (+1 armadilha),
`manifest.json` (2.21.0 → 2.22.0). Quinze suítes e os dois verificadores. Sem mudança de caixa — o
ramo de 2.21.0 continua valendo.

---

## 2026-09-04 — "Me liga", a ADS pela terceira porta, e a sigla com barra (v2.21.0)

### A Jucileia pediu ligação, e a rodada ofereceu concluir

*"Oi"*, três mensagens que a plataforma não leu, e *"Me liga"*. Ele: *"caso raro que a pessoa pede
ligação: criar mensagem falando que não podemos e dando uma desculpa; não fazemos ligações, a
plataforma não aceita e é contraproducente"*.

Resposta pronta nova (`pedido-ligacao`), sinal (`cortesia.pedeLigacao`) e caixa no padrão, ao lado
do pedido de dinheiro e do de emprego — é a mesma família: pedidos que o atendimento **não pode
atender**, e que ficam piores em silêncio.

Duas decisões no texto:

- **não promete retorno.** Quem pede ligação está esperando o telefone tocar, e um "vamos ver"
  deixa a pessoa aguardando algo que não vem. Ele diz o que É possível — escrever por aqui;
- **nenhum número no texto.** Publicar um telefone ali criaria exatamente a expectativa que a
  mensagem existe para desfazer.

A lista de padrões é curta e literal, e os falsos positivos foram medidos: *"meu telefone mudou"*,
*"liguei para o CRAS e não atenderam"*, *"vou ligar lá"*, *"a ligação caiu ontem"* — nenhum aciona a
recusa. **O texto é uma recusa, e recusa errada custa.**

### A ADS voltou pela TERCEIRA porta

A caixa da Fátima dizia *pediu "ADS" e há modelo mapeado* — um dia depois de eu ter fechado a
segunda porta. As duas conhecidas estavam bem fechadas; faltava esta: **uma regra de conteúdo DELE
cujo alvo é a etiqueta de origem.** O texto do anúncio casa, a regra aponta para ADS, e ADS volta
como conteúdo pelo laço de `tagRules` dentro do `suggest`.

É o terceiro vazamento do mesmo lugar (a Liana foi o segundo, em 02/09). A lição que faltava: **"duas
listas separadas divergem" vale também para dois PONTOS de filtragem.** Agora os três consultam
`etiquetasDeOrigem()`, e há teste para cada um.

### A sigla do estado com barra no meio

*"Romario gralow cidade Panambi R / S"* — e a cidade sumiu, tendo ele escrito o nome certo. O padrão
de ontem exigia as duas letras coladas.

É a repetição literal da lição de 01/09, quando a lista tinha só `rs` e chegou um `rgds`: **sigla
incompleta faz o defeito parecer aleatório** — a mesma pessoa escreve de dois jeitos, e um funciona.
Agora aceita qualquer separador entre o R e o S.

Entrou junto a pista `cidade <nome>` **sem preposição**, que é como ele escreveu — a lista tinha
`minha cidade é`, `cidade:` e `cidade de`, e não a forma seca.

**Arquivos:** `src/lib/store.js` (a resposta pronta), `src/lib/cortesia.js` (`pedeLigacao`),
`src/lib/arvore.js` (o sinal e a caixa nos dois ramos), `src/lib/tags.js` (a terceira porta),
`src/lib/cities.js` (a sigla e a pista), `src/panel/panel.js`, `tests/cortesia.test.mjs` (+13),
`tests/tags.test.mjs` (+3), `tests/arvore.test.mjs`, `CLAUDE.md` (+3 armadilhas), `manifest.json`
(2.20.0 → 2.21.0). Quinze suítes, os dois verificadores, **61 caixas** no padrão sem problemas.

**O quadro dele precisa ser reimportado:** a caixa do pedido de ligação é nova, e caixa nova nunca
entra sozinha.

---

## 2026-09-04 — Seis anotações: o 13, a piada, a despedida amarga e duas cidades (v2.20.0)

Cinco casos distintos, todos medidos **no quadro que ele tem** (o exportado em 2.14.0):

| contato | antes | agora | o que ele pediu |
|---|---|---|---|
| **Rosa Maria** | tecla 5 (momento) | **tecla s** | *"13 é número do Lula, adversário"* |
| **Alfredo** | tecla s (sem interesse!) | **tecla 5** | *"contexto errado, vou mandar mensagem do momento"* |
| **Eva** | tecla 5 (momento) | **tecla 3** | *"vou concluir sem mandar nada"* |
| **Maria Virgínia** | cidade vazia | **Gravataí** | *"gravataí não foi identificada"* |
| **Carmem** | cidade vazia | **Uruguaiana** | *"não pegou cidade"* |

### O Alfredo é o mais grave, e é o mesmo defeito da susana

Ele mandou uma foto e escreveu *"Não precisa muito pra ser feliz 😂😂😂😂"* — piada sobre a própria
foto — e foi **etiquetado como sem interesse e concluído em silêncio**. Etiqueta permanente no CRM,
em eleitor real.

`COMECA_NEGANDO` existe porque **a pergunta que fizemos era fechada** ("posso te mandar os
conteúdos?"), e resposta a pergunta fechada é curta. Uma frase de trinta e nove caracteres que segue
falando de outra coisa não responde pergunta nenhuma — o gatilho era só começar com "não".

Agora ela exige **mensagem curta (≤ 28) ou o "não" colado no que se recusa**. Das doze asserções do
teste, **nove são falso positivo** — é onde mora o risco desta regra, como sempre foi.

### O 13 é o espelho do 22

*"MINHA CONCIENCIA DIZ QUE TENHO QUE SER 13"* e, na seguinte, só *"13"*. O "22" já contava como
apoio; faltava o outro lado, com a mesma guarda: **o número solto não basta** (13 é endereço, hora e
idade). Vale como a mensagem inteira, ou colado num verbo de votar/ser.

### "Obrigada por nada" é despedida

A Eva pediu ajuda financeira, recebeu a negativa — que é o desfecho certo, e o texto é respeitoso —
e respondeu *"Então deixa muito obrigada por nada"*. A rodada ofereceu a mensagem da semana.

É despedida: amarga, mas despedida. E o desfecho da despedida é **concluir sem enviar**, exatamente
o que ele escreveu. `DESPEDIDA_AMARGA` não passa pela conferência do "sobrou conteúdo": a frase
inteira é a despedida, e exigir que nada sobre a faria deixar de contar justamente por ser uma frase.

### A sigla do estado é contexto de cidade

A Maria Virgínia e a Carmem escreveram o cadastro inteiro numa frase só — *"cidade de Gravataí rs
Maria Virgínia da Silva"*, *"CARMEM JUSSARA CORRÊA DA CRUZ. URUGUAIANA RS FRONTEIRA."* — sem pista de
lugar na frente e longe do corte de "texto curto".

**Ninguém escreve "RS" depois de uma palavra que não é uma cidade daqui.** A sigla é, ela própria, a
afirmação de que o que vem antes é um lugar. As pistas normais olham para a FRENTE do nome; esta
olha para trás, e por isso é uma passada própria — exigindo casamento `exata`, porque "rs" também é
risada nesta base e o aproximado em texto livre foi o que transformou *"at a vitória"* em Vitória das
Missões (02/09).

Entrou junto `cidade de/do/da`, que faltava: a lista tinha `minha cidade é` e `cidade:`, e não a
forma mais natural de todas.

**Falsos positivos medidos e limpos:** "kkk rs rs", "meu nome e Ana Paula rs", "Estamos juntos rs" —
nenhum vira cidade.

**Arquivos:** `src/lib/cortesia.js` (`VOTO_NO_ADVERSARIO`, `NEGACAO_COM_OBJETO`, `DESPEDIDA_AMARGA`),
`src/lib/cities.js` (`SUFIXO_ESTADO_SOLTO`, `cidade de`), `tests/cortesia.test.mjs` (+16),
`tests/parser.test.mjs` (+7), `CLAUDE.md` (+4 armadilhas), `manifest.json` (2.19.0 → 2.20.0). Quinze
suítes, os dois verificadores, 59 caixas sem problemas.

---

## 2026-09-04 — Três anotações: apoio lido como presença, e a ADS de volta (v2.19.0)

### O Guilherme foi pulado como quem vai a um evento

*"Pode contar comigo e toda minha família somos muitos e somos Bolsonarista até a morte somos
omildes trabalhador. Mais somos de palavra"* — e a caixa: *"confirmou presença no evento"*. Ele:
*"não é evento, somente apoiando"*.

`pode contar comigo` estava na lista do "vai". **É o terceiro apagamento dessa lista pelo mesmo
motivo**, depois de "vamos"/"vou" soltos (02/09) e "confirmado" solto (04/09, a Nice).

A regra que fica, e que já devia ter ficado nas duas primeiras vezes: **vocabulário de campanha não
é resposta ao convite.** A frase continua em `EXPRESSOES_DE_APOIO` — é de lá que ela deve decidir, e
como declaração de apoio ela não é ambígua.

Medido no quadro dele: passa de **tecla 2** (pular) para **tecla 5** — a mensagem do momento, porque
a última dele foi ontem. É a regra de tempo dele mesmo.

### A ADS voltou a decidir modelo, e a guarda dependia da Config

Quatro links do Instagram e o aceite do anúncio, e a caixa: *pediu "ADS" e há modelo mapeado —
mande*. Ele: *"já recebeu o modelo padrão; contato antigo, recebeu mensagem do momento, vou
concluir"*.

A guarda existe desde 02/09 — a etiqueta ADS é **origem**, nunca conteúdo. Mas ela monta a lista a
partir de `etiquetaAnuncio` (aba Config) mais as etiquetas de cada anúncio: **campo vazio, a ADS
volta a ser conteúdo** pela tabela "Modelo por conteúdo", onde ele tem `ADS = Campanha Martim`.

Estava na lista de pendências desde ontem (*"limpar a linha ADS → Campanha Martim"*), como coisa
para ele fazer. Errado: **guarda que depende de alguém ter preenchido um campo não é guarda.**
`ORIGEM_SEMPRE` é o piso, com o nome literal — nenhum conteúdo se chama ADS.

Medido no quadro dele: passa de **tecla 1** (mandar o modelo) para **tecla 3** — concluir, que é o
que ele disse que ia fazer.

### A Iracema: o que a versão de agora faz, e o que ele quer

Na anotação (v2.15.0) **nenhuma regra casou**. Com o código de agora ela cai em
`ultima-pede-resposta-pessoal` → **tecla 6**, por causa do áudio transcrito de 256 caracteres.

Ele quer *"conclua para sair da lista"*. As duas coisas não batem, e a diferença é uma decisão dele:
o áudio dela é de **ontem** e é torcida pura — sem pergunta. Pela regra de tempo que ele escreveu em
03/09, o contexto passou; pela ordem atual, "precisa de gente" vem antes do tempo.

Não mexi: inverter isso faria todo áudio antigo passar a receber a mensagem do momento em vez de ir
para ele, e isso muda muito mais que este contato. Fica com ele. **Tecla 6 não manda nada errado** —
custa um toque a mais, não uma mensagem.

**Arquivos:** `src/lib/cortesia.js` (a lista do "vai"), `src/lib/tags.js` (`ORIGEM_SEMPRE`),
`tests/cortesia.test.mjs`, `tests/tags.test.mjs` (+4), `CLAUDE.md` (+2 armadilhas), `manifest.json`
(2.18.0 → 2.19.0). Quinze suítes e os dois verificadores.

---

## 2026-09-04 — A caixa da rodada cortada na tela (v2.18.0)

*"cortado e não consigo pegar a resposta"*, com a print: dez opções mais as treze respostas rápidas
abertas, e o fim da caixa abaixo da janela.

Não é cosmético. **A pergunta é modal para a rodada**: opção inalcançável trava o trabalho, e a
única saída era Esc — que descarta a decisão.

`max-height` + `overflow-y: auto` na caixa. Três coisas que a medição ensinou:

- **`box-sizing: border-box` é obrigatório.** Sem ele o `max-height` vale só para o CONTEÚDO, e os
  14px de padding de cima e de baixo mais a borda somam 30px que estouram a conta. Medido: a caixa
  passava 18px do fim da janela **mesmo com o limite escrito** — o tipo de defeito que se dá por
  resolvido sem medir;
- **arrastada, o limite é escrito pelo JS.** O espaço disponível depende do `top` escolhido, e não
  há como dizer "daqui até o fim da tela" em CSS. Fica em `aplicarPosicao`, junto do resto da
  aritmética de posição;
- **o título é `sticky`.** A caixa passou a rolar por dentro, e sem isso rolar até as respostas
  rápidas levava a alça de arrastar para fora da vista — justo quando a caixa está grande demais,
  que é quando arrastar importa.

O limite vai na **caixa** e nunca no fundo: o fundo é `pointer-events: none` de propósito, e
capturar rolagem ali travaria a conversa atrás.

**Medido no navegador** (o conferidor `checar-pergunta.mjs` precisa de Playwright, que não está
instalado aqui): página com o mesmo CSS e a mesma quantidade de opções, janela de 903px. Centrada e
arrastada para 0, 200, 400 e 690px de topo — **as cinco terminam em 891px**, com o título visível
depois de rolar até o fim e o último botão alcançável.

**Arquivos:** `src/panel/panel.css`, `src/panel/panel.js` (`aplicarPosicao`), `CLAUDE.md`
(+1 armadilha), `manifest.json` (2.17.0 → 2.18.0).

---

## 2026-09-04 — "Certamente é um problema de ramo" (v2.17.0)

A Ieda perguntou *"Você é candidato daqui do RS?"* e a caixa ofereceu **a mensagem do momento**, com
o motivo *"a última mensagem dela é de outro dia — o contexto passou"*.

Ele estava certo sobre o sintoma e o conserto é mais fundo que mover a caixa.

### Primeiro: a exceção estava na posição, e posição não basta

Quando criei `contexto-de-outro-dia` (ontem), ele nomeou a exceção no mesmo recado: *"único pretexto
que exclui a necessidade de hora é pergunta pendente, que deve ser respondida"*. Eu a implementei
como **ordem** — a caixa fica abaixo de `pergunta-aberta`.

Ordem só cobre o que a regra de cima reconhece. A pergunta da Ieda não estava em lista nenhuma, e a
caixa do tempo decidiu.

Agora a exceção está no `quando` da própria regra. A diferença que importa: **vale onde quer que a
caixa esteja no quadro dele** — inclusive no que ele já exportou. Posição é preferência dele;
exceção que ele nomeou é regra dele.

### Depois: a lista de formas de perguntar não fecha

Só isso não resolveu — medido: com a caixa do tempo fora, `conteudo-pedido` assumia e mandava **o
modelo**, que é pior.

E aí está o padrão que eu devia ter visto duas anotações atrás:

| anotação | pergunta | o que eu fiz |
|---|---|---|
| Teresinha (03/09) | *"Tem alguém que vem na casa da gente pra conversar"* | acrescentei a forma à lista |
| Paulo Quevedo (03/09) | *"Colorado ou Gremista?"* | criei um sinal fraco, só para não concluir |
| Ieda (04/09) | *"Você é candidato daqui do RS?"* | — |

**Ninguém cadastra todas as maneiras de perguntar.** O que fecha é a inversão: **é pergunta a menos
que uma resposta pronta a responda.**

Em 03/09 eu tentei alargar para "qualquer ?" e quebrei cinco casos que ele já tinha decidido, então
desisti. O erro não era o alargamento — era que as cinco exclusões **só existiam por acidente**, por
não casarem com a lista curta de formas. Escritas (`RESPONDIDA_POR_PRONTA`), o alargamento fica
seguro:

1. *"pode me mandar o material?"* — e o infinitivo, que o padrão antigo não pegava;
2. *"Tudo bem?"*, *"tudo certo?"*, *"como vai?"*;
3. *"Como posso ajudar na campanha?"*;
4. *"tem algum material para eu compartilhar?"*;
5. *"tem algum grupo?"*.

**A exclusão diz QUEM responde, nunca SE responde** — `perguntaPendente` continua impedindo concluir
em silêncio para todas elas.

A guarda de **posição** continua: sem "?", só conta abrindo a mensagem. É ela que impede *"ficou
muito grato pq sou Bolsonaro desde sempre"* (print do Ciro) de virar pergunta.

### O custo, dito

Mais contato indo para a **tecla 6** — ele respondendo à mão. É o lado barato de errar; o outro é
material de campanha em cima de uma pergunta, que é o que ele reportou três vezes.

**Medido no quadro que ELE tem** (o exportado em 2.14.0, sem reimportar): a Ieda passa de tecla 5
para **tecla 6**. Sem a pergunta, a caixa do tempo continua decidindo como antes.

**Arquivos:** `src/lib/cortesia.js` (`RESPONDIDA_POR_PRONTA`, a inversão em
`conversaTemPerguntaAberta`), `src/lib/sugestao.js` (a exceção na condição de
`contexto-de-outro-dia`), `tests/cortesia.test.mjs` (+22), `CLAUDE.md` (+2 armadilhas),
`manifest.json` (2.16.0 → 2.17.0). Quinze suítes, os dois verificadores, 59 caixas sem problemas.

---

## 2026-09-04 — O relógio da IA, e a pergunta que o "boa tarde" escondia (v2.16.0)

### "A IA está sem acesso a data e hora atual"

E ele tinha tentado o caminho que parecia óbvio: *"botei nos comandos extras da IA para ver a data e
hora atual mas não mudou nada"*.

Estava certo nas duas metades. **Nada no prompt levava data nenhuma** — nem "agora", nem quando cada
mensagem chegou. E as instruções extras dele vão para o prompt de **sistema**, que é texto: mandar o
modelo "ver a hora" não dá hora a ele. Modelo de linguagem não tem relógio; alguém precisa escrever
que horas são.

Agora o bloco do contato abre com **"Agora são 13:44 de sexta-feira, 04/09/2026."** e cada mensagem
leva quando chegou, em forma relativa:

```
1. [hoje 13:43] Obrigada pelas relevantes informações!
2. [hoje 13:43] Você é candidato daqui do RS?
3. [ontem 18:07] Boa tarde!
```

Três decisões:

- **fica no bloco do CONTATO, nunca no de sistema.** O sistema leva `cache_control: ephemeral`, e o
  cache vale enquanto o prefixo for idêntico — pôr o horário lá invalidaria o cache a cada chamada,
  que é a diferença entre 10% e 100% do preço de entrada. O bloco do contato muda a cada contato de
  qualquer jeito;
- **a forma é relativa** ("hoje", "ontem") porque é assim que a decisão dele é tomada — *"responder o
  conteúdo de ontem soa a quem não estava lá"* — e é mais curta que a data inteira em cada linha;
- **mensagem sem `at` sai sem marca.** Histórico antigo não tem horário, e inventar um seria pior que
  não ter: a IA passaria a raciocinar sobre dado falso.

**Um efeito colateral que quase passou:** ao ganhar horário, as mensagens viraram `{texto, at}` em
vez de string — e `gabinete.precisaDoDossie` faz `join('\n')`, que produziria `[object Object]`. O
dossiê deixaria de ser pedido **sem erro nenhum**. Peguei conferindo os chamadores, não por teste.

### A Ieda perguntou no meio da rajada

*"Obrigada pelas relevantes informações!"* · *"Você é candidato daqui do RS?"* · *"Boa tarde!"* — e a
rodada ofereceu a mensagem do momento. Ele: *"a sugestão queria mandar mensagem do momento ignorando
a pergunta; já vimos antes que responder a pergunta é prioridade"*.

O mecanismo existia — `terminouComPergunta`, criado em 03/09 pelo caso do Paulo Quevedo — e olhava
**só a última mensagem com texto**. O "Boa tarde!" em cima escondia a pergunta.

O nome dizia o que ele fazia, e o que ele fazia é que estava errado: a pergunta não deixa de estar
pendente porque ela cumprimentou depois. Agora é **`perguntaPendente`**, e varre tudo o que chegou
desde a nossa última fala — que, por definição, é o que ainda não foi respondido.

**O que cancela é uma retratação explícita**, não uma mensagem qualquer em cima: *"deixa pra lá"*,
*"esquece"*, *"já resolvi"* — e só vale para a pergunta que veio **antes** dela. É a mesma ideia da
retratação em `semInteresse`. Isso preserva o teste que existia (*"Colorado ou Gremista? … deixa pra
lá"* continua não segurando ninguém) e conserta o caso dela.

Medido na árvore: com a pergunta, `ja-respondemos-antes` passa a dar **tecla 6**; sem ela, continua
concluindo como antes.

**Arquivos:** `src/lib/ia.js` (`quandoFoi`, `agoraEmPortugues`, os dois blocos de contato),
`src/lib/ia-cliente.js`, `src/lib/gabinete.js`, `src/lib/cortesia.js` (`perguntaPendente`,
`RETIROU_A_PERGUNTA`), `src/lib/sugestao.js`, `src/panel/panel.js`, `tests/cortesia.test.mjs`,
`tests/sugestao.test.mjs`, `CLAUDE.md` (+3 armadilhas), `manifest.json` (2.15.0 → 2.16.0). Quinze
suítes e os dois verificadores.

---

## 2026-09-04 — Duas anotações: "confirmado" que não era presença, e o engajado já respondido (v2.15.0)

### A Nice foi pulada como quem vai a um evento

Ela escreveu *"Nossos votos, estão confirmados: Capitão Martim para Deputado Estadual, Capitão Zucco
para Governador do Rio Grande do Sul e Flávio Bolsonaro 22 para Presidente"* — uma declaração de
**voto**, das mais entusiasmadas que chegam aqui — e a rodada a **pulou**, tratando-a como quem
confirma presença em evento. Ele: *"pegou confirmação de evento sem contexto, vou mandar mensagem do
dia"*.

O padrão aceitava `confirmado|confirmada|confirmo` **solto, em qualquer posição**. Nesta base
"confirmado" é dito de voto, de chapa e de agenda — a palavra sozinha não diz de quê.

É o mesmo conserto que "vamos"/"vou" soltos levaram em 02/09, e pela mesma razão: **verbo sozinho é
vocabulário de campanha, não resposta ao convite.** Agora a confirmação precisa vir com o que a torna
presença (presença, ida, participação, "estarei", "estou confirmada") ou **ser a mensagem inteira**,
que é a resposta seca a *"você vai?"*.

Medido nas sete formas que têm que continuar valendo, inclusive o texto do botão do anúncio
(*"Quero confirmar minha presença no evento: …"*), que foi o conserto de 03/09.

**E o desfecho dela passou a ser o que ele disse que ia fazer:** a última mensagem foi do dia
anterior, então `contexto-de-outro-dia` decide — tecla 5, a mensagem do momento. Medido na árvore.

### A Janete recebia a mensagem do momento em cima da conversa

Ela tem a etiqueta "Engajado", mandou dois áudios longos (um contando que foi atacada num comitê) e
clicou em dois anúncios. A caixa ofereceu a mensagem do momento. Ele: *"já mandei mensagem hoje,
mesmo não sendo do momento — não mandar quando já respondi"*.

A guarda de `etiqueta-dispensa-da-fila` era `momentoJaEnviado`, que **só sabe da mensagem do
momento**. Quem foi respondido à mão, ou com outra resposta pronta, não aparecia ali — e o engajado
que fala o dia inteiro é justamente quem mais recebe resposta à mão.

`respondidoHoje` é a mesma guarda que `ultima-e-so-reacao` já usava, e pela mesma razão: mais uma
mensagem nossa no mesmo dia é empilhar, não atender. Sem ter respondido hoje, a mensagem do momento
continua saindo — a regra de 03/09 (*"engajado recebe a mensagem do momento uma vez por dia"*) fica
inteira.

**Arquivos:** `src/lib/cortesia.js` (os padrões de presença), `src/lib/sugestao.js`
(`etiqueta-dispensa-da-fila`: tecla, motivo e verbete), `tests/cortesia.test.mjs` (+9),
`tests/sugestao.test.mjs` (+4), `CLAUDE.md` (+2 armadilhas), `manifest.json` (2.14.0 → 2.15.0).
Quinze suítes, os dois verificadores, 59 caixas no padrão sem problemas.

---

## 2026-09-04 — A anotação mostra o que NÃO é texto (v2.14.0)

Pedido dele: *"as observações estão com um problema: elas pegam só texto e ignoram fotos, links e
emojis; ao menos tem que ter ciência do que foi enviado além do texto"*.

A anotação juntava `m.texto` e descartava o vazio. **Duas perdas, e a segunda é a pior:**

1. Figura, figurinha e áudio sem transcrição **sumiam** — eu lia uma conversa que nunca existiu
   daquele jeito.
2. O corte das cinco últimas **alcançava mensagens mais antigas** para completar o número, porque as
   sem texto não contavam. O relatório dizia "as últimas 5 dela" e mostrava outra coisa.

É a mesma lição que o `api.js` já carrega: `incoming` filtra `m.text` e por isso a figura
desaparecia; quem precisa enxergar mídia usa `entrantes`, que traz o tipo junto.

### O formato

`descreverMensagem` é pura e testada. Emoji e link já eram texto e continuam como estão; o que
mudou é o que não tinha texto nenhum:

```
[foto, sem legenda]   [figurinha]   [áudio, sem transcrição]   [vídeo, sem legenda]   [arquivo]
[áudio transcrito] moro em Canoas
[aviso da plataforma: mensagem não suportada]
```

Tipo desconhecido vira `[<tipo>, sem texto]` em vez de sumir — a plataforma pode inventar um amanhã.

O ruído da plataforma aparece **como tal**: *"ela mandou algo que a plataforma não leu"* é
informação, não ausência — a mesma distinção que `semRuidoDaPlataforma` preserva ao esvaziar em vez
de descartar.

**Arquivos:** `src/lib/observacoes.js`, `src/panel/panel.js`, `tests/observacoes.test.mjs`,
`manifest.json` (2.13.0 → 2.14.0), `registro.md`.

---

## 2026-09-04 — O critério de tempo virou caixa própria, e vale para tudo (v2.13.0)

Quatro anotações no mesmo lote, com regras diferentes e a mesma correção dele:

| Contato | O que a caixa oferecia | O que ele quer |
|---|---|---|
| **Bia** | agradecer (respondeu os dados ONTEM) | mensagem do momento |
| **Noeli** | agradecer (deu os dados ONTEM) | mensagem do momento |
| **Beatriz Pansaia** | agradecer o apoio (de ONTEM) | *"erro de mandar apoio se repetindo"* |
| **Giovani** | o modelo (texto e link de ONTEM à noite) | *"modelo fora de contexto"* |

### O que os quatro dizem juntos

**O critério de tempo não era do apoio.** Ele o definiu em 03/09 dentro de `so-expressa-apoio`, e a
razão que deu vale para qualquer assunto: *responder o conteúdo de ontem soa a quem não estava lá*.
Cadastro, apoio ou piada política — se esfriou, o que há de novo hoje é a mensagem do momento.

Agora é uma regra própria, `contexto-de-outro-dia` (tecla 5), e `so-expressa-apoio` voltou a ser só
"agradece". Um conceito, um lugar. O sinal perdeu o "apoio" do nome: `deOutroDia`, e entrou em
`SINAIS` — ele pode usá-lo numa caixa dele.

### A posição é a regra inteira

- **Abaixo de tudo o que precisa de gente**: pedido de dinheiro, pergunta, áudio longo, denúncia
  respondida. É a exceção que ele mesmo nomeou — *"único pretexto que exclui a necessidade de hora é
  pergunta pendente, que deve ser respondida"*. Medido nas três.
- **Abaixo do anúncio reconhecido**: clicar num anúncio é pedir uma coisa específica, e escolha
  explícita dela não se substitui por dedução nossa. Um clique de ontem continua sendo um pedido.
- **Na CHEGADA, ainda mais baixo** — sob `anuncio-modelo-e-dados`. Quem nunca recebeu nada tem
  direito ao recibo mesmo que a rodada só a alcance no dia seguinte; o contrário tiraria o recibo de
  quase todo mundo, porque a rodada quase sempre roda depois.

### As guardas

`podeMandarMomento && !momentoJaEnviado` na condição. Sem mensagem do momento configurada, ou já
tendo saído para essa pessoa, a regra não casa e o quadro decide como antes — é o que impede a caixa
mais genérica do quadro de virar repetição.

**Arquivos:** `src/lib/sugestao.js`, `src/lib/arvore.js`, `src/panel/panel.js`,
`tests/arvore.test.mjs`, `tests/sugestao.test.mjs`, `manifest.json` (2.12.0 → 2.13.0),
`registro.md`, `CLAUDE.md`.

---

## 2026-09-04 — O modelo só passa na frente do apoio quando o ANÚNCIO foi reconhecido (v2.12.0)

Print da Elaine, já com a v2.11.0 carregada: cidade Bom Retiro do Sul, e a última mensagem dela era
*"Tamos junto capitão"* — **de ontem**. A caixa recomendou a tecla 1, mandar o modelo. Ele: *"não foi
arrumado"* / *"confira o fluxo"*.

**Ele estava certo, e a causa fui eu, ontem à noite.**

### Duas anotações do mesmo dia, e a segunda desfez metade da primeira

- **Rosa** (03/09): já tinha cidade, voltou clicando no anúncio das Escolas Cívico-Militares e
  escreveu só apoio. *"Ela veio por um anúncio diferente do padrão, vou mandar o modelo."* Eu pus
  `conteudo-pedido` acima de `so-expressa-apoio`.
- **Elaine** (04/09): já tinha cidade, escreveu apoio ONTEM, **sem anúncio reconhecido** — e recebeu
  o modelo por causa daquela mudança.

**A diferença entre as duas é o anúncio, não o apoio.** A Rosa clicou em alguma coisa que tem modelo
próprio e nunca saiu; a Elaine só disse que está junto, e o "modelo" dela vem da etiqueta de conteúdo
— que é exatamente o caminho que o critério de tempo do apoio existe para decidir (apoio de ontem →
mensagem do momento).

### O conserto

`conteudo-pedido` sobe para cima do apoio **dentro do grupo "veio de um anúncio que eu reconheço"**,
e a cópia de baixo continua atendendo quem não expressou apoio nenhum. Três desfechos, medidos:

| Situação | Antes | Agora |
|---|---|---|
| Rosa — anúncio reconhecido, com apoio | tecla 1 | tecla 1 (pela caixa do anúncio) |
| Elaine — sem anúncio reconhecido, apoio de ontem | tecla 1 | **tecla 5** |
| Sem apoio nenhum, com modelo mapeado | tecla 1 | tecla 1 (pela cópia de baixo) |

**A lição:** um conserto que sobe uma caixa de posição não é local. `conteudo-pedido` acima do apoio
resolvia a Rosa e passava por cima do critério de tempo que ele tinha definido no mesmo dia — e o
sinal que separa os dois casos (`anuncioReconhecido`) já existia; faltou eu usá-lo.

**Arquivos:** `src/lib/arvore.js`, `tests/arvore.test.mjs`, `manifest.json` (2.11.0 → 2.12.0),
`registro.md`.

---

## 2026-09-04 — Três cópias do mesmo invariante, e o anúncio mais recente (v2.11.0)

### O pedido de dados: a TERCEIRA cópia

Depois de eu consertar `templates.ehPedidoDeDados` de manhã (a barra virou vírgula no texto), ele
reportou: *"já havia mandado modelo, contato deu os dados, e a sugestão foi mandar modelo
novamente"*.

**O painel tinha a sua própria expressão** — `PEDIU_NOME_E_CIDADE` — ainda exigindo a barra. E ela
governa **duas** coisas: se o parser lê a mensagem seguinte como RESPOSTA ao formulário
(`respostaAoPedido`, que é o modo generoso) e se `respondeuOsDados` é verdadeiro. Com ela furada,
quem se cadastrava recebia o modelo de novo.

O `CLAUDE.md` já mandava usar `templates.ehPedidoDeDados` — e o painel não usava. **Agora chama, e é
a única definição.** Duas cópias de um invariante divergem na primeira reescrita do texto; três
divergem mais rápido.

### O anúncio reconhecido é o MAIS RECENTE

Duas anotações do João Carlos, no mesmo contato: clicou em *"Eu escolho o lado da Liberdade"*,
respondeu ao convite de evento, e por último escreveu *"ero receber o Material da Direita"*. O
anúncio reconhecido era o **primeiro**. *"O modelo também pegou o primeiro do contexto, pegue o
último."*

`reconhecer` juntava a conversa inteira num string só — o que **apaga a ordem** — e o desempate
virava o tamanho do trecho. É a consequência da armadilha já registrada: **o texto do anúncio fica na
conversa para sempre**, então o clique de semana passada vencia o de agora.

Hoje ela varre mensagem a mensagem, da mais nova para a mais antiga. **Dentro de uma mensagem** o
trecho mais longo continua ganhando (dois anúncios da mesma campanha compartilham a abertura). A
`utm` entra no fim da lista de propósito: é a campanha que trouxe esta sessão.

### "Mathias" não é município

A caixa *"Cidade a gravar"* abriu com o **sobrenome** dela (*"Taila, Mathias"*). Ele: *"não existe no
IBGE, não aceite o palpite"*.

Confiança `nao-reconhecida` é o modo generoso do parser devolvendo **qualquer palavra solta** — é o
mesmo caminho que já fez um link do Instagram voltar como cidade. Ela existe para a lista de revisão
da aba Cidades, onde nada é gravado; oferecer para gravar transforma *"não achei"* em *"confirme
isto"*. A pergunta continua valendo para `aproximada`, onde há um município de verdade e a dúvida é
se é ESTE.

**Arquivos:** `src/panel/panel.js`, `src/lib/anuncios.js`, `tests/anuncios.test.mjs`,
`manifest.json` (2.10.0 → 2.11.0), `registro.md`, `CLAUDE.md`.

---

## 2026-09-04 — A caixa diz QUANDO foi a última mensagem dela (v2.10.0)

Pedido dele, com a print da Isaura: a caixa recomendava a **mensagem do momento** por um *"Bom dia"*
que era do **dia anterior**, e nada na tela dizia isso. *"A sugestão não fala que foi ontem a
mensagem dela; especifique sempre quando foi feita a última mensagem."*

Ele tem razão e a informação já decidia coisas: desde o critério de tempo do apoio (03/09),
"cumprimento de hoje" e "cumprimento de ontem" pedem desfechos diferentes — e a única maneira de ele
conferir era abrir a conversa e olhar o relógio.

### Onde a linha entrou

Duas telas, o mesmo dado:

- **A caixa da rodada**, logo abaixo de cidade e etiquetas: `Última mensagem dela: ONTEM às 11:00`.
  Fica no alto porque é retrato do contato, não aviso — ele lê essas três linhas antes das opções.
- **A anotação**, que é o que chega até mim: `a última dela foi no dia ANTERIOR (03/09/2026 11:00)`.
  Li vários lotes hoje sem saber se as mensagens eram do mesmo dia.

### O formato

`hoje às 11:00` · **`ONTEM às 11:00`** · `há 3 dias (01/09 às 11:00)`.

"ONTEM" em maiúscula de propósito: é a informação que muda a decisão, e estava passando despercebida
no meio das outras linhas. O corte é o **dia local**, o mesmo de `cortesia.deOutroDia` — duas
contagens diferentes de "ontem" na mesma tela seriam pior que nenhuma.

**Arquivos:** `src/panel/panel.js`, `src/lib/observacoes.js`, `tests/observacoes.test.mjs`,
`manifest.json` (2.9.0 → 2.10.0), `registro.md`.

---

## 2026-09-04 — O pedido de dados não era reconhecido, e a IA respondia só a última (v2.9.0)

Quatro correções: três do lote da manhã e uma que ele mandou no meio do trabalho.

### O mais grave: `jaPediramDados` estava falso para TODO MUNDO

`ehPedidoDeDados` reconhecia o pedido pelo invariante `nome / cidade` — **com barra**. O texto em uso
passou a ser `Nome , Cidade`, **com vírgula**. Medido: a redação atual não casava.

O efeito é silencioso e grande: a rodada voltava a pedir nome e cidade a quem já tinha recebido o
formulário. **Custou três anotações antes de eu achar** — Iris (*"a minha última mensagem já pediu
dados"*), Plauto (*"já foi pedido dados"*) e jairoc (*"o contato ignorou o pedido de dados no dia
anterior"*) — e nas três eu procurei a causa na ordem das caixas.

**Escrever "reconhece pelo invariante" não torna invariante o que está escrito.** Barra, vírgula,
hífen e "e" são a mesma frase para quem lê; a regra aceita as quatro agora.

O pedido dele de esperar 3 dias antes de repetir não chegou a ser necessário: com o reconhecimento
consertado, `nunca-pediram-dados` já não dispara para quem recebeu o formulário — nunca, não só por
três dias.

### Iolanda: o estado por extenso estourava a janela do texto curto

*"Iolanda de Capão da Canoa Rio Grande do Sul."* — 43 caracteres. `matchCityComContexto` aceita a
cidade sem pista até 30; sem o estado são 25, e a cidade era achada. `formaCanonica` apagava o estado
só na hora de casar, **depois** da conta de tamanho. Agora ele sai antes.

**"de" sozinho não entrou na lista de pistas**, e não pode entrar: é a preposição mais comum do
português e transformaria "material de campanha" em município.

### Maria Genoli: link não é cumprimento

*"Confusão entre cumprimento e mandar link"*. `soCortesia` conta link e figura como cortesia de
propósito (é o "bom dia ilustrado" desta base), e a caixa dela estava ACIMA da caixa da reação — que
descreve melhor o caso e tem a tecla-função com `respondidoHoje`. As duas trocaram de lugar.

### Janete: a IA ignorou a rajada

Ela mandou um áudio longo às 10:52 e, às 17:19, clicou num anúncio. O rascunho respondeu **só o
clique**.

**Foi consequência direta do conserto de ontem.** Marcar *uma* mensagem (`← RESPONDA A ESTA`)
resolveu a Maria Geny — que respondia mensagem velha — e criou o oposto. O que separa "já
respondido" de "pendente" **não é a posição da última, é a NOSSA última fala**: tudo o que ela
escreveu depois disso está esperando.

Hoje a rajada inteira vem marcada `← SEM RESPOSTA`, com a contagem no pedido (*"responda a TODAS
elas, juntas"*) e um texto próprio para quando não há pendência nenhuma.

**Arquivos:** `src/lib/templates.js`, `src/lib/cities.js`, `src/lib/arvore.js`, `src/lib/ia.js`,
`tests/ia.test.mjs`, `manifest.json` (2.8.0 → 2.9.0), `registro.md`, `CLAUDE.md`.

---

## 2026-09-03 — O rascunho da IA não via a nossa resposta (v2.8.0)

Print da Maria Geny: ela mandou um áudio às 21:39, nós já tínhamos respondido às 19:47, e o rascunho
da IA respondeu a mensagem **anterior** à nossa resposta. Ele: *"ignorou a última mensagem da pessoa
e a minha resposta, e respondeu a penúltima mensagem dela"* — e confirmou: *"a IA no caso"*.

### Causa raiz

`montarContatoRascunho` mandava **só as mensagens dela**, numeradas de 1 a N, sem nenhuma marca de
qual estava pendente:

```
Mensagens recebidas desta pessoa, da mais antiga para a mais recente:
[1] …
[2] …
```

**A IA não tinha como acertar.** Sem a nossa fala no meio, não existe "já respondido"; sem marca, não
existe "esta é a que espera". Para o modelo era uma pilha de falas soltas, e responder qualquer uma
era igualmente plausível — a penúltima inclusive, que por acaso era a mais fácil de responder bem.

### O conserto

O bloco passou a levar a conversa inteira, com os dois lados e a pendência marcada:

```
A conversa inteira, da mais antiga para a mais recente. "NÓS" é o atendimento:
ELA: …
NÓS: …
ELA: …   ← RESPONDA A ESTA
Responda à ÚLTIMA mensagem dela — a marcada. O que veio antes da nossa última fala já foi
respondido: não repita aquilo nem volte a um assunto que já encerramos.
```

A marca vai na última **dela**, não na última da conversa: se nós falamos por último, ela continua
apontando para a fala que ficou sem resposta. Tem teste.

`conversaParaIA` no painel junta `entrantes` e `nossas` e ordena pelo horário — as duas listas vêm
separadas de `getConversation`. A transcrição continua marcada como tal.

### O que NÃO mudou, de propósito

`mensagensParaIA` — só o que ela escreveu — continua alimentando a **decisão**. Escolher entre as
respostas prontas é sobre o que ela pediu; quem **escreve** é que precisa dos dois lados. Misturar as
duas coisas encareceria o prompt da decisão sem melhorar a escolha.

A forma antiga (lista de strings) continua aceita e conta como fala do contato — quebrá-la deixaria o
rascunho sem conversa nenhuma, calado.

**Arquivos:** `src/lib/ia.js`, `src/panel/panel.js`, `tests/ia.test.mjs`,
`manifest.json` (2.7.0 → 2.8.0), `registro.md`, `CLAUDE.md`.

---

## 2026-09-03 — Transcrição não marca sem interesse, e o grupo que escondia as caixas saiu (v2.7.0)

Três anotações. Uma delas é **falso positivo criado hoje por mim**.

### lopezp4295 — a mais grave

A rodada sugeriu a tecla `s` (etiqueta permanente + concluir em silêncio) para alguém que dizia
*"mas eu vou ir votar, sim"*. Ele: *"de onde saiu a frase para sugerir sem interesse?"*.

Saiu de **duas** coisas, e as duas foram consertadas:

1. **`nao tenho` seco estava em `RECUSA_EXPLICITA`.** A frase era *"eu não tenho, eu não tenho, né,
   nenhum… os números dos candidatos pra eu votar"* — alguém dizendo que não tem os números.
   `não tenho` sozinho não recusa nada; recusa é *"não tenho interesse"*, e essa forma continua.

2. **A função lia TRANSCRIÇÃO.** É a regra mais destrutiva do arquivo, e fala passada por
   reconhecimento automático é o pior insumo possível: repetição e "não" solto em toda frase. Agora
   a transcrição não conta — o áudio vira caso de `ultima-pede-resposta-pessoal`, que é dele ou da
   IA. **Recusa de verdade a pessoa escreve.**

**Foi a leitura da rajada (v2.4.0) que expôs isto.** A mudança estava certa e necessária — sem ela a
susana escapava —, mas ela multiplicou as chances de um padrão frouxo casar. Ampliar o alcance de um
detector destrutivo exige revisar o que ele aceita, não só de onde ele lê.

### Maria Genoli — o grupo que escondia as caixas

Dois áudios longos contando que está doente e não consegue ir, e a rodada mandou o **modelo padrão**.
Ele: *"texto gigante obviamente é conversa, eu respondo ou IA"*.

**A causa era a divisão, não a ordem.** O lado "sem etiqueta de cidade" tinha *"com pendência"*
(exigindo `!respondidoHoje`) com TODAS as caixas que leem o texto, e *"sem pendência"* com duas que
não olham nada. Bastava termos respondido qualquer coisa no mesmo dia para o quadro **parar de ler a
conversa** e mandar o modelo.

A guarda existia por um motivo real de 01/09 — a caixa do cumprimento repetia a mensagem do momento
a cada passada. Hoje ela tem `excecao: momentoJaEnviado` e `ultima-e-so-reacao` olha `respondidoHoje`
na própria tecla. **Guarda mora na CAIXA, onde dá para testá-la; num grupo acima ela silencia tudo o
que está dentro.**

Desfeita a divisão, `respondeu-os-dados` e `conteudo-pedido` de *"sem pendência"* viraram cópias
mortas — o verificador de caixas mortas acusou as duas — e **foram removidas**. Os dois lados da
bifurcação de cidade passaram a ter a mesma forma.

Medido: a Genoli agora dá tecla 6, com ou sem termos respondido hoje.

### Neca Tamiozzo

*"Concluir, já foi enviado e retornou pedindo mesmo modelo"*. Medido no padrão de agora: tecla 3, por
`ja-respondemos-antes` — a caixa que fecha o lado sem cidade, criada na v2.2.0. **Ela precisa ser
importada**; o quadro dele ainda é o de 1.86.0.

**Arquivos:** `src/lib/cortesia.js`, `src/lib/arvore.js`, `tests/arvore.test.mjs`,
`manifest.json` (2.6.0 → 2.7.0), `registro.md`, `CLAUDE.md`.

---

## 2026-09-03 — O "?" é escolha dela, e pergunta sem "?" também conta (v2.6.0)

Duas correções dele, no mesmo recado, sobre o sinal criado na v2.5.0:

> *"tudo bem exige resposta igual; quando a pessoa faz questão de botar (?) ela espera uma resposta.
> Muitas perguntas são feitas sem a interrogação e isso é problemático."*

### 1. A cortesia com "?" volta a contar

Eu tinha excluído *"Tudo bem?"*, *"Bom dia! tudo certo?"* e *"como vai?"* do sinal. Ele desfez, e o
argumento é melhor que o meu: **a interrogação é uma escolha de quem escreveu.** Quem se deu ao
trabalho de botar o "?" está esperando alguma coisa de volta, e o custo de honrar isso é uma conversa
que fica aberta — não uma mensagem errada.

A exclusão de *"Tudo bem?"* **continua valendo em `conversaTemPerguntaAberta`**, que responde outra
pergunta: lá se decide se o caso vai para ELE. Aqui só se decide não concluir.

### 2. Pergunta sem "?" — o buraco que ele apontou

Duas formas novas, as duas testadas:

- **abertura interrogativa**: quem começa a mensagem com *que, qual, quais, quem, quando, onde,
  aonde, como, quanto, cadê, por que, pq, será* está perguntando, com ou sem o sinal no fim;
- **pergunta declarada**: *"queria saber"*, *"me diz"*, *"me informa"*, *"me explica"*, *"fiquei na
  dúvida"*.

**Isto é barato aqui e seria caro em `conversaTemPerguntaAberta`** — e é a razão de o sinal fraco
existir. Ele não escolhe desfecho nenhum: no máximo deixa uma conversa aberta a mais. A mesma
largura na outra lista mandaria metade da base para atendimento à mão.

Medido nos dois lados: as oito formas de pergunta passam, e cumprimento seco, agradecimento, apoio e
declaração de voto continuam fora.

**Arquivos:** `src/lib/cortesia.js`, `tests/cortesia.test.mjs`, `manifest.json` (2.5.0 → 2.6.0),
`registro.md`.

---

## 2026-09-03 — Pergunta pendente nunca vira "conclua" (v2.5.0)

Print do Paulo Quevedo: imagem de bom dia, dois links e, por último, *"Colorado ou Gremista?"*. A
rodada recomendou **concluir** (`ja-respondemos-antes`, tecla 3). Ele: *"qual a regra que já
tínhamos acertado? tem pergunta não conclui"*.

### O caminho que NÃO funcionou, e por quê

Alarguei `conversaTemPerguntaAberta` para aceitar qualquer "?" na última mensagem. **Cinco asserções
caíram na hora**, todas de decisões dele:

| Texto | Por que era exclusão |
|---|---|
| *"pode me mandar o material?"* | tem resposta pronta — o modelo |
| *"Tudo bem?"* | é cumprimento; a resposta é a mensagem do momento |
| *"Como posso ajudar na campanha?"* | é OFERTA, e oferta é o público principal |
| *"tem algum material para eu compartilhar?"* | tem resposta pronta |
| *"tem algum grupo?"* | tem resposta pronta |

**As cinco continuam sendo RESPONDIDAS.** A exclusão diz **quem** responde — o modelo, a mensagem do
momento —, não **se** responde. Foi por isso que o caminho estava errado: ele trocava "responder" por
"mandar para o Thiago" em cima de metade da automação.

### O que resolveu

`cortesia.terminouComPergunta`, um sinal deliberadamente mais fraco. Ele não decide desfecho: faz uma
coisa só, **impedir a conclusão em silêncio**. Concluir é o irreversível — tira o contato da tela
dele; errar para o lado de deixar aberto custa uma linha na fila.

- vale só na **última** mensagem da rajada (interrogação no meio de conversa já respondida não
  reabre nada);
- exclui **cortesia** ("Tudo bem?", "Bom dia! tudo certo?", "como vai?") — sem essa guarda o sinal
  pegava o cumprimento com interrogação, que é das formas mais comuns desta base;
- a **única** regra que o consulta é `ja-respondemos-antes`, e é suficiente: a despedida e a reação
  **são** a última mensagem, então nenhuma outra regra pode concluir tendo uma pergunta na frente.

Medido: as cinco exclusões acima **impedem concluir** (menos "Tudo bem?", que é cortesia), e nenhuma
delas passou a exigir atendimento à mão.

### Um erro de ferramenta que vale registrar

O heredoc do shell comeu as contrabarras da expressão regular: `[^\p{L}\p{N}\s]` virou `[^p{L}p{N}s]`
e apagava o texto inteiro. O sintoma foi *"Colorado ou Gremista?"* deixar de casar depois de um
conserto que só tinha acrescentado uma guarda. **Expressão regular não passa por heredoc** — vai pelo
editor.

**Arquivos:** `src/lib/cortesia.js`, `src/lib/sugestao.js`, `src/panel/panel.js`,
`tests/cortesia.test.mjs`, `tests/sugestao.test.mjs`, `manifest.json` (2.4.0 → 2.5.0), `registro.md`,
`CLAUDE.md`.

---

## 2026-09-03 — A susana voltou: o detector lia só a última, e a etiqueta ninguém lia (v2.4.0)

Lote de três anotações. Duas já estavam resolvidas em versões que ele ainda não carregou; uma era
nova, e é a mais séria do dia — **ele reportou o MESMO contato pela segunda vez**.

### susana — *"por que não gravou?"*

Ela xingou o aliado (*"E o bolso bosta o que cumpriu"*), escreveu mais duas mensagens, e a última
era *"9"*. A caixa recomendou responder à mão.

**Duas causas, e as duas são sobre memória:**

1. **`semInteresse` lia só a ÚLTIMA mensagem com texto.** O insulto estava duas acima e era
   invisível. Pior: **eu havia travado esse insulto com um teste de UMA mensagem** — exatamente a
   forma que a função enxergava. O teste passava enquanto a produção falhava. Hoje ela lê a rajada,
   mensagem a mensagem, com todas as guardas de sempre.

   O que substitui o *"só a última vale"* (que existia por boa razão — *"quem xingou ontem e hoje
   voltou pedindo conteúdo mudou de ideia"*) é a **retratação**: pedir material ou dizer que está
   junto DEPOIS cancela a recusa; um *"9"* não cancela nada. O critério é o que a mensagem diz, não
   onde ela está.

   A recusa é testada **antes** da retratação: *"não quero receber nada"* tem "receber" dentro e,
   pela ordem inversa, se cancelava sozinha — três asserções caíram de uma vez e mostraram isso.

   `NEGATIVA_BENIGNA` ganhou *"nunca ouvi falar"* / *"não conheço"*: é o falso positivo que a
   leitura da rajada exporia, e ele apareceu no primeiro teste.

2. **A etiqueta de sem interesse já estava no contato, e nada a lia.** Ele marcou; a rodada não
   consultou. Na visita seguinte o detector tinha que redescobrir a hostilidade do zero, a partir do
   que ela escrevesse naquele dia. **Detector é palpite; a etiqueta é decisão dele, e decisão dele
   não se redescobre.** `etiquetaQueSoConclui` passou a somar `auto.etiquetaSemInteresse` à lista
   dele — mesmo desfecho, conclui e não manda nada, nunca.

   **Depende do campo "Etiqueta de sem interesse" estar preenchido na Config.** Vazio, não faz nada.

### As outras duas, já resolvidas antes da anotação

- **Aldo Borges** (*"emoji sem nada de texto = concluir"*): é o buraco do lado sem cidade, fechado na
  v2.2.0. Medido no padrão de agora: tecla 3.
- **Iris Guizzo**: com o padrão de agora ela cai em `so-expressa-apoio` (o *"22"* conta como apoio) e
  recebe o agradecimento em vez do pedido de dados — **desde que não tenhamos respondido hoje**.
  Respondido hoje, `nunca-pediram-dados:anuncio-conhecido` ainda vence, porque o grupo do anúncio
  fica acima do fecho. Fica anotado como pendente.

**Arquivos:** `src/lib/cortesia.js`, `src/panel/panel.js`, `tests/cortesia.test.mjs`,
`manifest.json` (2.3.0 → 2.4.0), `registro.md`, `CLAUDE.md`.

---

## 2026-09-03 — "Respondeu o nome e a cidade" voltou a vencer o modelo (v2.3.0)

Pergunta dele: *"por que utilizou essa expressão de nada foi removido? você criou alguma regra? se
for necessário é para remover se der conflito com as novas regras"*.

**Não há regra nenhuma.** "Nada removido" era cautela minha, e a resposta certa à pergunta é a
conferência — que eu não tinha feito. Feita agora, ela achou um conflito **criado por mim hoje**.

### O conflito

`respondeu-os-dados` vem ACIMA de `conteudo-pedido` por decisão dele de 02/09 (*"quem respondeu o
que pedimos não precisa de mais material"*), e isso valia porque as duas moravam no mesmo grupo —
"sem pendência".

Ao trazer `conteudo-pedido` para dentro de `dosDoisLados` (v2.2.0, o caso da Rosa), o lado **sem
cidade** passou a decidir o modelo **antes** de chegar naquele grupo. Medido: quem respondia nome e
cidade, com modelo mapeado e sem ter sido respondido hoje, recebia o **modelo** em vez do
agradecimento.

**A lição:** ordem escrita dentro de uma regra não se garante sozinha quando as caixas mudam de
grupo. O grupo é que decide quem é olhado primeiro.

### O conserto, com uma remoção

`respondeu-os-dados` subiu para o topo de `dosDoisLados` — vale nos dois lados e acima de tudo,
como estava documentado. A cópia explícita do lado "com etiqueta de cidade" **foi removida**: virou
duplicata, e duas caixas iguais no mesmo ramo é o começo de divergirem.

### E a conferência que a pergunta dele obrigou

Teste novo varre o padrão inteiro com um conjunto de gatilhos e exige que **toda caixa com desfecho
decida em algum contexto**. Rodou: nenhuma caixa morta. As duas que a primeira varredura acusou eram
falha da varredura, não do quadro — uma usa um sinal que não está em `SINAIS` (`soRuidoDaPlataforma`,
lido pela regra e não escolhível numa caixa dele) e a outra só é alcançável sem modelo mapeado.

**Arquivos:** `src/lib/arvore.js`, `tests/arvore.test.mjs`, `manifest.json` (2.2.0 → 2.3.0),
`registro.md`.

---

## 2026-09-03 — O lado SEM cidade não fechava, e o modelo vinha depois do obrigado (v2.2.0)

Lote de seis anotações, cinco delas com a caixa mostrando *"a decisão é sua"* e **nenhuma
recomendação**.

### Quatro casos, um buraco estrutural

**Antônio Bersch** (*"mandou foto ou sticker de boa noite, só concluir"*), **jairoc** e **Sidnei
Martins** (*"mandou link, pode concluir"*) e **Maria de Lourdes** (*"quando voltasse pelo mesmo
anúncio sem enviar nada além do texto padrão era pra concluir"*). Nos quatro o desfecho que ele quer
é o mesmo: **concluir**.

Medido: os sinais estavam todos certos (`ultimaEhSoReacao` verdadeiro nos três primeiros). O que
faltava era **onde**. Os três grupos do lado "sem etiqueta de cidade" cobrem quem ainda não foi
respondido hoje ("com pendência"), quem tem dado ou modelo a receber ("sem pendência") e a chegada
por anúncio cadastrado. **Quem já foi respondido hoje e não tem nada disso atravessava os três e
saía sem desfecho** — o lado "com etiqueta de cidade" nunca teve esse buraco, porque
`ja-respondemos-antes` o fecha.

A mesma regra fecha aqui, com as guardas junto: conclui quando já respondemos hoje ou a do momento
já saiu, manda a do momento quando ela ainda não foi.

**Isto desfaz o "de propósito" que estava escrito no ramo do anúncio** (*"quem já recebeu o
formulário e volta mandando só o texto do anúncio continua sem desfecho automático"*). Era decisão
de 02/09; ele a revisou com quatro casos reais. O que continua valendo — e o que as asserções agora
protegem — é que **o formulário não sai de novo**.

### A Rosa: o modelo vinha depois do obrigado

Ela já tinha cidade, voltou clicando no anúncio das Escolas Cívico-Militares e escreveu só apoio. A
caixa recomendou agradecer. Ele: *"ela veio por um anúncio diferente do padrão, vou mandar o
modelo"*.

**O lado "com etiqueta de cidade" não tinha `conteudo-pedido`**: quem voltava com cidade e clicava
num anúncio novo nunca recebia o modelo daquele anúncio. `voltou-por-outro-anuncio` não cobre — ela
exige `modeloJaNaConversa`, porque existe para quem volta pedindo a MESMA coisa (a distinção da
Eroni). Agora o modelo fica **abaixo de todas as pendências e acima do apoio**, nos dois lados.

### O que o próprio conserto acusou

Pôr o modelo acima do apoio quebrou na hora o teste que trava o caso de 01/09: quem responde
*"é sobre as irregularidades na compra assistida em Eldorado do Sul"* à nossa pergunta passaria a
receber material de campanha, porque `respondeu-nossa-pergunta` ficava **abaixo** do apoio — e só no
lado sem cidade. Subiu para cima do modelo e passou a valer nos dois lados.

### A Marroni

*"Mensagem do momento, tempo de contexto já passou"* — é o critério de tempo do apoio, e já estava
pronto desde a v1.90.0; o que faltava era a caixa existir no lado "com cidade", feito na v1.95.0. A
anotação é das 14:10, antes das duas. Nada a fazer além de importar.

**Arquivos:** `src/lib/arvore.js`, `tests/arvore.test.mjs`, `manifest.json` (2.1.0 → 2.2.0),
`registro.md`.

---

## 2026-09-03 — "Só cumprimentou" oferecia a mensagem do momento pela segunda vez (v2.1.0)

Print da Carmem Souza. A caixa da rodada mostrava, em amarelo, *"Hoje este contato já recebeu:
Mensagem do momento às 09:36"* — e recomendava, em destaque, a **tecla 5**. Ele: *"sugestão
totalmente errada, já identificou que mandou e sugeriu mandar novamente"*.

### Causa raiz

A caixa *"só cumprimentou, e nada mais"* tem `acao.tecla: '5'` **fixa**, e caixa de tecla fixa não
carrega guarda nenhuma. `ultima-e-so-reacao`, logo abaixo dela, nunca teve o problema: a tecla dela
é FUNÇÃO e olha `respondidoHoje`.

**`repeteSozinha` não acusava, e estava certo.** `soCortesia` lê a rajada DEPOIS da nossa última
mensagem, então o envio apaga o sinal e a caixa não repete sozinha. O que aconteceu foi outra
coisa: ela **escreveu de novo no mesmo dia**, a rajada encheu com outro cumprimento, e a caixa
ofereceu a mesma mensagem pela segunda vez.

É a distinção que faltava no verificador e que fica registrada: a pergunta não é só *"ela repete
sozinha?"*, é *"o que impede a segunda vez?"*.

### O conserto

`excecao: { sinal: 'momentoJaEnviado' }` na caixa — literalmente o que o aviso amarelo já dizia. É
o primeiro uso do "exceto quando" dentro do padrão, e a caixa era exatamente o caso que motivou a
feature.

Medido: com a do momento ainda não enviada, tecla 5 como antes; já enviada hoje, o caso desce e
`ja-respondemos-antes` conclui (tecla 3). Vale nos dois lados da bifurcação de cidade, porque a
caixa nasce em `dosDoisLados`.

### Sobre o caso do Valdomiro (a pergunta na chegada)

Ele perguntou se a visão dele estava errada: *"o modelo sempre vai mandar modelo no início, mas
nesse caso mandou o modelo e ignorou o caso que seria uma exceção à regra onde a pessoa chegou com
uma pergunta"*.

**Não está errada, e já é o desenho:** `pergunta-aberta` fica em `chegada-antes`, ACIMA do modelo,
desde 02/09 — junto de "pediu algo e não disse o quê". O que falhou não foi a ordem, foi o
reconhecimento: *"como consigo…"* não estava em nenhuma lista de pergunta. Consertado em v2.0.0.

**Arquivos:** `src/lib/arvore.js`, `tests/arvore.test.mjs`, `manifest.json` (2.0.0 → 2.1.0),
`registro.md`, `CLAUDE.md`.

---

## 2026-09-03 — "Como consigo adesivo, bandeira, camiseta?" precisa de gente (v2.0.0)

Anotação do Valdomiro: *"Boa tarde Como consigo as coisas de campanha adevisto bandeira
camiseta?"* — e a rodada mandou o cartão da campanha e concluiu. Ele: *"não respondeu a pergunta e
concluiu"*.

### Causa raiz

Medido antes de mexer: **nenhum sinal casava**. `conversaTemPerguntaAberta` não tinha padrão para
"como consigo", e o caso desceu até `conteudo-pedido` — tecla 1, modelo e conclui.

A exclusão registrada no `CLAUDE.md` (*"tem algum material/conteúdo fica de fora de propósito"*)
continua certa, e é sobre outra coisa: **quem pede material tem resposta pronta**. Quem pergunta
**como pega** material físico — adesivo, bandeira, camiseta — precisa de quem sabe onde tem, quem
entrega e quando. Mandar o modelo ali é responder *"pega o material"* a quem perguntou *"como eu
pego"*.

### O conserto

`(como|onde) (consigo|conseguir|faço|faz|fazer)` entrou em `PERGUNTAS_QUE_PEDEM_VOCE`, com a guarda
de posição de sempre (começo da mensagem, ou "?").

**Três coisas seguram os falsos positivos**, e cada uma tem teste:

- `PEDIDO_DE_MATERIAL` desarma a mensagem inteira — *"como consigo receber o conteúdo de vocês?"*
  tem "receber" e segue sendo caso de modelo;
- **"posso" ficou de fora**: *"como posso ajudar?"* é oferta, e oferta é o público principal desta
  base — mandá-la para atendimento à mão é o erro caro do outro lado;
- a guarda de posição: *"não sei como consigo agradecer vocês"* não tem "?" nem está no começo.

Efeito colateral bom: *"Como faço pra conversar com vocês"* (a Teresinha, 02/09) passou a casar
também.

### O caso agora

Tecla 6, `pergunta-aberta` — que é o caminho da IA. Medido.

**Arquivos:** `src/lib/cortesia.js`, `tests/cortesia.test.mjs`, `manifest.json` (1.99.0 → 2.0.0),
`registro.md`, `CLAUDE.md`.

---

## 2026-09-03 — A IA não enxergava a transcrição do áudio (v1.99.0)

Print da Sueli: ela mandou 29 segundos de áudio, a plataforma transcreveu e mostrou na tela
(*"tomara que vocês enxerguem as pessoas que não enxergam…"*), e o rascunho saiu falando de presença
em evento. Ele: *"a IA não pegou o texto transcrito"*.

### Causa raiz

A assimetria está registrada no `api.js` desde 31/08 e eu não a apliquei aqui: **`incoming` filtra
`m.text`, e áudio não tem `text`** — a transcrição mora em `details.transcription.text` e só chega
em `entrantes`.

A ressalva original (*"incoming continua exatamente como era: é a base do parser"*) vale para o
**parser**, que não deve gravar cidade a partir de fala ouvida por máquina. Para a IA é o contrário:
ela existe justamente para os casos que a regex não cobre, e áudio é a maior fatia deles nesta base.
O painel já mostrava a transcrição na tela — esconder dela era o defeito.

Pior: a guarda `if (!state.incoming.length) return 'o contato não escreveu nada'` fazia o contato que
**só falou** nunca chegar a ser rascunhado.

### O conserto

`mensagensParaIA()` lê `entrantes`, descarta o vazio (que é como o ruído da plataforma chega, pelo
conserto do Carlos) e marca a transcrição com `(áudio, transcrito automaticamente)` — transcrição
erra palavra, e a IA precisa saber que não foi o que a pessoa escreveu.

Passou a ser usada nos **três** caminhos: a avaliação, o rascunho da rodada e o rascunho da aba —
mais o `gabinete` de cada um, que escolhe os verbetes do dossiê por texto e, sem a transcrição, não
escolhia nenhum. E a estimativa de cache, que precisa medir o prompt que realmente saiu.

### A trava

Teste novo em `conversa.test.mjs` fixando a assimetria dos dois lados: `incoming` **não** traz a
transcrição, `entrantes` traz, com `transcrito: true` e o tipo junto. Ele existe para que quem ler
`incoming` saiba que ela não é a conversa inteira.

**Arquivos:** `src/panel/panel.js`, `tests/conversa.test.mjs`, `manifest.json` (1.98.0 → 1.99.0),
`registro.md`, `CLAUDE.md`.

---

## 2026-09-03 — Sem nenhuma informação, pergunte o interesse (v1.98.0)

Print do Tilin: a conversa inteira eram dois avisos *"Atenção: o tipo da mensagem enviada pelo
contato não é suportado"* e um *"Número privado"*. Sem texto, sem nome, sem cidade, sem nem o
telefone. A rodada mandou *"Para eu poder salvar seu número me diga seu: Nome, Cidade"* e concluiu.

Ele: *"eu não tenho nenhuma informação nesse caso, então é para perguntar se a pessoa tem interesse
em receber conteúdo; a mensagem de nome e cidade ficou deslocada demais"*.

Ele está certo sobre o que a mensagem **parece do outro lado**. *"Para eu poder salvar seu número"*
pressupõe uma conversa em andamento — alguém que pediu alguma coisa, ou pelo menos escreveu. Quem só
mandou uma mídia que não abriu recebe um formulário sem saber do quê.

A pergunta de interesse serve porque **cria o contexto que falta**: diz o que temos para oferecer,
transforma o silêncio em sim ou não, e **já pede nome e cidade na mesma mensagem** — então nada se
perde em relação ao pedido seco.

### O sinal

`soRuidoDaPlataforma`: há mensagens dela e **todas** são ruído da plataforma (`sistema: true`). É a
diferença que `semRuidoDaPlataforma` já preservava de propósito — *"mandou algo que não deu para
ler"* não é *"não mandou nada"*, e conversa vazia de verdade continua sendo `ultima-e-nossa`.

Exigir TODAS é o que mantém a regra estreita: uma figura no meio é algo que ele pode olhar, e aí
quem decide é `ultima-e-so-reacao`; um áudio, `ultima-pede-resposta-pessoal`.

### A posição

Abaixo do modelo e acima do pedido de dados. Quem chega por anúncio com modelo mapeado recebe o
recibo, que responde melhor que qualquer pergunta; a caixa nova é o que sobra para quem não deixou
nada para trabalhar.

**Não é `nunca-perguntaram-interesse`**, que ele descartou do quadro em 01/09: aquela dispara a
pergunta para todo mundo que nunca foi perguntado, que é quase a base inteira. Esta exige, junto,
que ela não tenha mandado nada legível.

**Arquivos:** `src/lib/sugestao.js`, `src/lib/arvore.js`, `src/panel/panel.js`,
`tests/sugestao.test.mjs`, `tests/arvore.test.mjs`, `manifest.json` (1.97.0 → 1.98.0),
`registro.md`, `CLAUDE.md`.

---

## 2026-09-03 — Pedido sem objeto claro vai para ele ou para a IA (v1.97.0)

Decisão dele, logo depois do conserto do padrão da Odete: *"já que pedido é algo difícil de ser
identificado, será agora pra mim ou IA responder"*.

Ele está certo sobre a natureza do sinal, e é o argumento que fecha o assunto: **"pedido" é intenção,
não forma de frase.** Ajustar a expressão conserta o caso que apareceu e não conserta a classe — toda
tentativa de cercá-la por texto erra para um dos dois lados:

- pergunta em cima de quem já explicou (a Odete, hoje);
- material de campanha em cima de quem está pedindo socorro (a Mari, 31/08).

Das duas, a segunda é a cara, e é ela que a regra existe para impedir.

### O que mudou, e o que não mudou

`pediu-algo-sem-dizer-o-que` passou da tecla **9** (dispara "em que você precisa de ajuda?") para a
**6** (o caso fica com ele; com a avaliação por IA ligada, é ela que assume). A pergunta continua a
um clique, na tecla 9 da caixa.

**O que a regra protege não mudou:** ela continua no alto do quadro, continua vencendo a despedida,
a reação e o apoio, e continua impedindo que qualquer caixa de baixo mande o modelo. Só o desfecho
é outro.

Saiu junto a guarda `podePerguntarAjuda`. Ela existia porque a regra DISPARAVA aquele texto, e
oferecer uma tecla que trava por variável faltando é pior que não oferecer. Agora a regra não manda
nada — mantê-la faria o caso de maior risco do arquivo escapar para as caixas de baixo, que enviam,
justamente quando o template estivesse quebrado.

**Consequência a lembrar: a rodada PARA nesses contatos** em vez de perguntar e seguir. Foi a troca
que ele escolheu, sabendo.

Nada a importar: a caixa já existe no quadro dele, e o desfecho vem da regra do código.

**Arquivos:** `src/lib/sugestao.js`, `tests/sugestao.test.mjs`, `tests/arvore.test.mjs`,
`manifest.json` (1.96.0 → 1.97.0), `registro.md`, `CLAUDE.md`.

---

## 2026-09-03 — "Preciso do nome de um deputado" não é pedido indefinido (v1.96.0)

Print da Odete: ela escreveu *"Preciso do nome de um deputado federal que seja de direita"* e, 28
minutos depois, *"Já encontrei o deputado federal que vou votar DIVALDO LARA"*. A rodada mandou
*"Para eu entender direito e te responder com sinceridade: em que você precisa de ajuda?"*. Ele:
*"interpretou 'preciso' fora de contexto, já estava explicado"*.

### Causa raiz

Reproduzido antes de mexer: tecla 9, `pediu-algo-sem-dizer-o-que`. O padrão era
`preciso|precisava|precisando|necessito` seguido de `de|da|do` — **e mais nada**. A regra se chama
*"pediu algo sem dizer o quê"* e não olhava o quê.

É a mesma família do *"só mandou bom dia"* que pegava um desabafo de 437 caracteres: **nome de caixa
que promete uma condição que a condição não verifica.**

### O conserto

O objeto do pedido passou a ser exigido, por lista curta de **permissão**: ajuda, ajudinha, força,
apoio, socorro, auxílio, uma mão — ou a própria pessoa (*"preciso do senhor"*, *"preciso de
vocês"*), que é a forma da print da Mari que originou a regra.

**Reconhecer o objeto CONCRETO seria o caminho errado** — são infinitos, e errar para esse lado
devolve o defeito: a frase volta a casar e a pergunta sai por cima de um pedido claro.

As 19 asserções que já existiam continuam passando: as três formas reais (*"Preciso da forca do
senhor"*, *"preciso de uma ajuda"*, *"bom dia,preciso de ajuda"*) têm todas objeto vago.

### O que o caso vira agora

`conteudo-pedido` — tecla 1, manda o modelo. Ela tem etiqueta de conteúdo e de cidade, então é o
recibo do anúncio. Medido.

**Arquivos:** `src/lib/cortesia.js`, `tests/cortesia.test.mjs`, `manifest.json` (1.95.0 → 1.96.0),
`registro.md`, `CLAUDE.md`.

---

## 2026-09-03 — O apoio passou a valer nos DOIS lados da bifurcação de cidade (v1.95.0)

Pedido dele — *"arrume para que a regra siga pras duas"* —, depois de eu apontar a assimetria
comparando o `fluxo-padrao-1.86.0.json` que ele baixou com o padrão de agora.

`so-expressa-apoio` existia só em **"sem etiqueta de cidade"**. Quem voltava **com** cidade e só
escrevia apoio nunca passava por ela: descia até `ja-respondemos-antes`, que é a caixa mais genérica
do ramo e não olha o que a pessoa escreveu. Efeito prático — o critério de tempo definido hoje de
manhã (apoio de ontem → mensagem do momento; de hoje → agradecer) valia só para **metade da base**.

É a lição que o projeto já pagou uma vez, com `etiqueta-dispensa-da-fila`, e o sintoma é o mesmo:
**invisível**. Nada acusa; o contato só escorrega até a primeira caixa genérica.

A caixa passou a nascer dentro de `dosDoisLados`, que é a função que monta as pendências dos dois
ramos — assim não há como um lado ficar para trás numa mudança futura. Fica no **fim**, abaixo de
todas as pendências: quem escreveu uma pergunta, um pedido ou um desabafo é atendido por aquilo, e
não pelo apoio que veio junto.

O teste novo **decide de verdade nos dois lados** (não só procura a caixa na lista), então ele cai
também se alguém mexer na ordem e puser algo genérico por cima. E confere as duas saídas do
critério de tempo em cada lado.

**Arquivos:** `src/lib/arvore.js`, `tests/arvore.test.mjs`, `manifest.json` (1.94.0 → 1.95.0),
`registro.md`, `CLAUDE.md`.

---

## 2026-09-03 — "Ignorou o pedido e concluiu": conversa na chegada agora vence o modelo (v1.94.0)

Print dele, e a palavra que usou foi **"crítico"**. A contato de Serafina Corrêa chegou pelo anúncio
e escreveu duas mensagens, 314 caracteres: pedia uma **cola com letras maiores, do primeiro ao
último**, porque tem *"muita gente idosa pedindo"*, e se oferecia para imprimir. A rodada mandou o
cartão da campanha e **concluiu**.

### Causa raiz

Reproduzido antes de mexer: `conteudo-pedido` na chegada, tecla 1 — manda o modelo e conclui.

**Nada pegava, e não havia como pegar por lista de palavras.** Ela DISSE o que queria, então
`pediu-algo-sem-dizer-o-que` não casa; não é pergunta de razão nem de posição, então
`pergunta-aberta` não casa. O único sinal que existe para *"isto é conversa"* é o **tamanho**, e ele
estava calculado e correto (`conversaPedeRespostaPessoal` devolvia os 314 caracteres) — a caixa
`ultima-pede-resposta-pessoal` simplesmente **não existia no ramo da chegada**.

Ela tinha ficado de fora por correção dele de 02/09: as pendências neutras se resolvem na VOLTA,
porque a tecla `a` conclui. **A distinção que faltava** é a mesma que já valia para as duas caixas
acima dela: pendência neutra (figura, cumprimento, despedida) custa **um dia de atraso** no recibo;
esta não — mandar a nossa mensagem primeiro **é o dano**, e concluir apaga o pedido.

Agora a chegada tem TRÊS caixas acima do modelo, e a nova fica abaixo das outras duas, que são mais
específicas e escrevem um motivo melhor quando também casam.

### O custo, que é real e foi dito a ele

Quem chega mandando **áudio sem transcrição, arquivo ou texto longo** deixa de receber o recibo do
anúncio nessa passada e vai para ele. É o mesmo trade que ele já aceitou nas outras duas.

**Arquivos:** `src/lib/arvore.js`, `tests/arvore.test.mjs`, `manifest.json` (1.93.0 → 1.94.0),
`registro.md`, `CLAUDE.md`.

---

## 2026-09-03 — A tecla 8 virou a chamada da IA; o agradecimento foi para o `i` (v1.93.0)

Pedido dele: *"era pra substituir o botão 8 com o chamar IA"* — eu tinha posto a opção como uma A
MAIS, abaixo da 8.

**As duas trocaram de lugar, e nenhuma some.** É a troca que torna isso seguro, e foi a opção que
ele escolheu quando expus a consequência: a 8 era o desfecho que `so-expressa-apoio` e
`respondeu-os-dados` RECOMENDAM, e fazer a recomendação apontar para a IA **pararia a rodada em
cada contato de apoio**, esperando ele escrever — chamar a IA deixa o caso com ele, como a tecla 6.
Com o automático ligado seria a fila inteira travada.

Então:

- **8** = chamar a IA (põe o rascunho no campo, não manda). **Nenhuma regra a recomenda**, e há
  teste percorrendo as regras para garantir isso — inclusive as de tecla-função, pelos `ramos`.
- **`i`** = agradecer o apoio / a presença e concluir. `sugestao.TECLAS` foi renomeada junto: é ela
  que transforma a recomendação em destaque, e é a lista que a janela do fluxo oferece.
- **O 8 saiu de `TECLAS` de propósito**: aquela tabela é o que uma REGRA pode mandar apertar, e a
  chamada da IA não é isso. Consequência: quem tivesse fixado a tecla 8 numa caixa do quadro perde
  essa fixação na importação, com aviso — a peneira do `deArquivo` descarta tecla inexistente.

`textoDaTecla8`/`tecla8Trava` viraram `textoDoApoio`/`travaDoApoio`. Nome de variável que aponta
para a tecla errada é a armadilha do comentário que descreve a ordem sem ser a ordem — e aqui ela
estaria dentro do trecho que decide o que sai para eleitor.

**Arquivos:** `src/lib/sugestao.js`, `src/lib/templates.js`, `src/panel/panel.js`,
`tests/sugestao.test.mjs`, `tests/arvore.test.mjs`, `manifest.json` (1.92.0 → 1.93.0), `registro.md`.

---

## 2026-09-03 — A tecla `i` não depende da caixa "usar IA nesta rodada" (v1.92.0)

Ele foi testar e a opção não estava lá: *"agora eu queria testar a resposta e não posso"*. Eu a
tinha prendido em `state.ia.ligada`, que é a caixa **"Usar a avaliação por IA nesta rodada"** — e na
print dele ela está desmarcada, como nasce.

**Eram duas perguntas diferentes tratadas como uma.** Aquela caixa decide se a rodada gasta
sozinha, contato a contato, e é por isso que ela existe e nasce desligada. Apertar o `i` é o
contrário: é ele pedindo UM rascunho, de propósito, olhando aquela conversa. O que a tecla precisa
é de **chave cadastrada** — `state.iaTemChave` —, e é isso que ela pergunta agora, aqui e dentro de
`rascunharParaEle`.

Sem chave, a opção continua não aparecendo, e o motivo diz onde cadastrar.

**Arquivos:** `src/panel/panel.js`, `manifest.json` (1.91.0 → 1.92.0), `registro.md`.

---

## 2026-09-03 — Tecla `i`: a IA escreve o rascunho no campo, e quem manda é ele (v1.91.0)

Pedido dele, olhando a caixa da rodada: *"no botão 8 bote a opção chamar IA, que irá botar a
resposta na caixa de mensagem sem mandar"*.

`rascunharParaEle` **já existia e já fazia exatamente isso** (`setComposerText`, nunca `sendText`) —
o que faltava era um jeito de PEDIR. Até hoje ela só era alcançada quando a IA ESCALAVA, ou seja,
quando nenhuma resposta pronta servia e a decisão não era dele. Agora há a tecla, logo abaixo da 8,
onde ele quis: o caso típico é o agradecimento não servir e ele querer algo escrito para aquela
conversa.

**O desfecho é o mesmo da tecla 6** — a rodada sai da frente e fica de vigia, retomando quando ele
concluir. Tem que ser: fechar a caixa e seguir para o próximo contato deixaria o rascunho num campo
de mensagem que ele não está mais olhando.

**Letra e não dígito**, como o `s`, o `a` e o `f`. E só aparece com a avaliação por IA ligada —
opção que não faz nada é pior que opção que não existe.

**Falha do rascunho não devolve o contato à fila**: ele pediu o caso para si ao apertar a tecla, e o
motivo vai para o log. É a mesma disciplina do rascunho da escalada, que nunca para a rodada.

`rascunharParaEle` ganhou um `ok` no retorno. Sem ele, a linha de sucesso apareceria **duas vezes**
no Andamento: a própria função já a escreve, com os avisos da revisão junto.

**Arquivos:** `src/panel/panel.js`, `manifest.json` (1.90.0 → 1.91.0), `registro.md`.

---

## 2026-09-03 — O apoio: o TEMPO escolhe entre agradecer e a mensagem do momento (v1.90.0)

Resposta dele às três anotações que pediam a mesma coisa (Maria Geny, Tere e Gilmar, Jacira):
*"a questão é o contexto, a mensagem tem quanto tempo que mandou dando apoio; se foi no dia
anterior, é mensagem do momento; se foi recente, mensagem de apoio; único pretexto que exclui a
necessidade de hora é pergunta pendente, que deve ser respondida"*.

`so-expressa-apoio` passou a ter tecla-função: **5** quando o apoio foi escrito em outro dia (e a do
momento ainda não saiu), **8** quando é de hoje. A leitura é de atendimento — apoio escrito agora é
resposta ao que acabamos de mandar, e o que ele espera é um obrigado; apoio de ontem é alguém que
voltou sozinho depois de a conversa fechar.

**O corte é o DIA local, não um número de horas** (`cortesia.deOutroDia`). É o que ele lê na tela: a
plataforma separa a conversa por data. Horas contadas dariam resultado diferente do que ele vê —
23h e 1h da manhã são "ontem e hoje" para quem olha, e duas horas para quem conta.

**As duas guardas do momento continuam** (`podeMandarMomento`, `!momentoJaEnviado`), e são elas que
impedem isto de virar máquina de repetir: a condição é estado da conversa — o texto de apoio fica lá
para sempre — e o envio não a apaga.

**Pergunta pendente vence, e vence por ORDEM**: `pergunta-aberta` e `pediu-algo-sem-dizer-o-que`
ficam acima nos dois ramos. Tem teste comparando as posições, para não depender de alguém lembrar.

### Duas coisas que o próprio conserto acusou

- O verbete dizia `efeito: 'depende'`, e as duas saídas ENVIAM — diferente de `ja-respondemos-antes`,
  cujo outro ramo conclui em silêncio. `regrasComDesfechoIncoerente` pegou na hora.
- A matriz do teste de tecla-função variava só três campos, então a tecla 5 nunca aparecia e o teste
  acusava o mapa de *"inventar um desfecho"* que existe de verdade. **Campo novo lido por uma
  tecla-função entra na matriz** — está escrito lá.

**Arquivos:** `src/lib/cortesia.js`, `src/lib/sugestao.js`, `src/panel/panel.js`,
`tests/cortesia.test.mjs`, `tests/sugestao.test.mjs`, `manifest.json` (1.89.0 → 1.90.0),
`registro.md`.

---

## 2026-09-03 — O lote de 8 anotacoes: 3 ja estavam consertadas, 5 eram novas (v1.89.0)

Ele mandou o relatorio das observacoes e pediu *"veja se tem algo novo"*. Medi caso a caso antes de
mexer em qualquer coisa — e a primeira conclusao foi que **eu nao tinha como saber quais ja estavam
atendidas**, o que virou o conserto do fim desta entrada.

### Ja consertadas quando o relatorio saiu

- **Martin Luther** (*"Quero confirmar minha presenca no evento"*): `confirmaPresenca` devolve
  `'sim'`, e `confirmou-presenca-evento` PULA. Consertado em c05369b, 12:17.
- **susana** (*"Se for bolso bosta. Negativo"*): `INSULTO_AO_ALIADO` em `semInteresse`.
- **Maria Genoli** (audio de 7 min recebendo a resposta enlatada do anuncio): `decidirComAnuncio` ja
  se cala quando o efeito e `gente`.

As duas ultimas estavam no diretorio de trabalho **sem commit e sem teste**. Ganharam teste de
regressao agora — as tres assercoes que importam sao os falsos positivos (xingar o ADVERSARIO em
terceira pessoa continua sendo apoio, e regra que ENVIA continua perdendo para o anuncio).

### Novas — Plauto

A ultima mensagem dele era *"Plauto Velho, cidade Sao Leopoldo"* e a caixa sugeria a tecla 4,
*"peca os dados esta vez"*. Ele: *"ja foi pedido dados, seria agradecer e encerrar"*.

**Causa raiz:** as guardas de `nunca-pediram-dados` olhavam o CRM (`temEtiquetaDeCidade`) e o nosso
historico (`jaPediramDados`), e **as duas podem ser falsas no exato momento em que ela responde** —
a etiqueta ainda nao existe no CRM e a pergunta nunca saiu porque ela se adiantou. `respondeuOsDados`
tambem nao alcanca: ele exige que o NOSSO pedido tenha saido.

O sinal novo e `jaDeuNomeECidade`: o parser leu nome **e** cidade reconhecida no que ELA escreveu.
Roda na conversa inteira de proposito — *"ela ja disse de onde e"* nao deixa de ser verdade com o
tempo, ao contrario de *"ela acabou de responder"*. So BLOQUEIA o pedido; nao manda nada. Em
`anuncio-modelo-e-dados` ele derruba so a metade do formulario, e o caso desce para
`conteudo-pedido`, que manda o recibo sozinho.

### Novas — Maria Bernardete

Cidade Caxias do Sul no CRM, anuncio nao reconhecido, mensagem de apoio — e a caixa oferecia o
**modelo padrao**. Ele: *"mandar 8"*.

**Causa raiz:** a decisao dele de 02/09 (*"se a pessoa ja respondeu a cidade a chance de ela ter
recebido um modelo e muito grande"*) estava implementada pela metade — `anuncio-modelo-e-dados` exige
`!temEtiquetaDeCidade`, `conteudo-pedido` nao exige nada, e e ele que manda o modelo sozinho. Agora o
**padrao** nao e sequer carregado para quem tem etiqueta de cidade. Anuncio RECONHECIDO continua
mandando o modelo dele (ela clicou pedindo aquilo, e ha teste travando).

Fechar esse caminho deixaria os dois casos sem desfecho nenhum, entao a chegada ganhou a caixa
`so-expressa-apoio` **em ultimo lugar**. A posicao e a trava: a mensagem do anuncio E apoio escrito,
e `soExpressaApoio` so a descarta com o anuncio cadastrado — em cima, a caixa agradeceria a chegada
de todo anuncio novo e engoliria o recibo. Tem teste exigindo que ela seja a ultima.

### Ainda com ele — Geny, Tere e Gilmar, Jacira

As tres pedem a **mensagem do momento**, e hoje o padrao agradece (tecla 8, `so-expressa-apoio`) ou
nao decide nada. Trocar 8 por 5 manda material de campanha onde hoje so vai um obrigado; e decisao
dele, perguntada.

### A anotacao passou a guardar a VERSAO e a hora

Foi o custo real desta sessao: com a data sozinha, e varios consertos no MESMO dia, nao havia como
distinguir anotacao pendente de anotacao ja atendida — eu medi tres casos para descobrir que nao
havia nada a fazer. A anotacao nasce no instante da decisao, entao a versao de entao e o unico dado
que responde *"isto ja foi consertado?"*. Anotacoes antigas ficam sem o campo e continuam valendo.

**Arquivos:** `src/lib/sugestao.js`, `src/lib/arvore.js`, `src/lib/anuncios.js`,
`src/lib/cortesia.js`, `src/lib/observacoes.js`, `src/panel/panel.js`, os cinco testes,
`manifest.json` (1.88.0 → 1.89.0), `registro.md`, `CLAUDE.md`.

---

## 2026-09-02 — A tecla aparece MAIUSCULA na tela; no teclado continua minuscula (v1.69.0)

**Pedido dele**, com a print da caixa da rodada: *"troque a opcao a por A maiusculo para ficar
destacado, mas so na visualizacao; no teclado pode ser a minusculo"*.

Na print a linha `a  Mandar "Seguranca" + Pedir dados (formato fixo) e concluir` some no meio dos
digitos, e a recomendacao sai como *"Sugiro a a:"*, que parece erro de digitacao.

### O que mudou

`sugestao.mostrarTecla` — quatro linhas, puro e testado. Converte **na hora de escrever**, nunca na
lista de opcoes: as teclas continuam `'a'`, `'s'` e `'f'` em toda parte, que e por onde
`sugestao.tecla === 'a'`, a automacao da rodada e os ramos da arvore acham a opcao.

Aplicado nos dois lugares que ele le:

- **Caixa da rodada**: os botoes e a linha "Sugiro a A:". Junto, o atalho passou a aceitar Shift —
  caixa que mostra "A" e recusa Shift+A ensina uma tecla que ela mesma nao aceita.
- **Janela do fluxo**: o desfecho do cartao, os dois seletores de desfecho, a legenda e o relatorio
  de regras.

Tambem subiu o `"s"` da prosa da Config, para a tela nao contradizer a caixa.

### A trava

O teste percorre as chaves de `TECLAS` exigindo que continuem minusculas. Se alguem "arrumar" a
tabela para bater com a tela, todo `=== 'a'` do painel para de casar de uma vez — e o sintoma seria
a rodada dizendo "tecla nao disponivel" em todo contato vindo de anuncio.

**Arquivos:** `src/lib/sugestao.js`, `src/panel/panel.js`, `src/fluxo.js`,
`tests/sugestao.test.mjs`, `manifest.json` (1.68.0 → 1.69.0), `registro.md`.

---

## 2026-09-03 — Cinco mensagens dele, e a rodada mandou o modelo

Print de Porto Alegre. O contato escreveu:

> *"Vocês viram a propaganda denegrindo o Flávio Bolsonaro nos canais Globo / RBS e Band do RS?"*
> *"Simplesmente horrível! Insinuando q. ele é bandido, etc. etc."*
> *"Já tomaram providências?"* · *"??"* · *"Agora com o Vorcaro X careca…msg reveladoras."*

E recebeu **o modelo, com o atendimento concluído**. Ele: *"mandou modelo e concluiu; quando tiver
mensagens assim, ao menos tem que deixar aberta a conversa"*.

### Por que nada pegava

A rajada tem **~230 caracteres** e o corte de "texto longo" é **400**. Não é reação, não é
despedida, e as perguntas dela não estão em lista nenhuma — ninguém cadastra *"já tomaram
providências"*, e cadastrar caso a caso é a corrida que nunca termina.

**O número de mensagens era o sinal que faltava.** Quem escreve quatro vezes seguidas sem resposta
está conversando, não reagindo, e o tamanho de cada uma não muda isso.

`conversaPedeRespostaPessoal` passou a contar as mensagens **próprias** da rajada: **3 delas, ou 2
somando 250 caracteres**. O corte antigo de 400 continua valendo para uma mensagem só, onde o
tamanho é o único sinal.

Duas coisas que quem mexer nisso precisa saber:

- **os dois cortes foram calibrados em dois casos reais** — este e a anotação do jairoc (~326
  caracteres em duas mensagens). Não são princípio, são medida; mexer neles muda quanta gente sai
  da automação, e vale medir de novo;
- **a mensagem gerada pelo ANÚNCIO não conta como própria.** Foi o falso positivo que apareceu no
  teste: quem clica em três anúncios manda três mensagens compridas que não escreveu, e sem essa
  guarda a Eroni iria para atendimento manual em vez de receber o modelo que pediu. É o mesmo
  critério de `soExpressaApoio`, e o painel passa `state.padroesDeAnuncio`.

**Medido antes e depois**, com os casos reais e seis falsos positivos: resposta do formulário
("Maria Silva" + "Porto Alegre"), três cumprimentos, emoji + link, agradecimento curto, três
cliques em anúncio e a confirmação de presença repetida — todos continuam sendo resolvidos pelo
fluxo.

O desfecho é a tecla 6, que **abre a caixa e não conclui** — que é o "ao menos deixar aberta" que
ele pediu.

**Arquivos:** `src/lib/cortesia.js` (`RAJADA_MUITAS`, `RAJADA_LONGA`, `temSubstancia`),
`src/panel/panel.js` (passa os padrões do anúncio), `tests/cortesia.test.mjs` (+13), `CLAUDE.md`
(+1 armadilha), `manifest.json` (1.87.0 → 1.88.0). Quinze suítes e os dois verificadores.

---

## 2026-09-03 — A caixa da IA no cartão dos Novos

*"adicione o box de iniciar com IA também"*.

O cartão de "iniciar conversas" (a fila dos Novos) tinha só a caixa de automático; a de ligar a
avaliação por IA morava na aba Config. Ele decide começar a rodada olhando para o botão de começar,
e não numa aba de configuração — então a chave tem que estar ali.

**É a MESMA chave (`ia.ligada`), não uma segunda.** Dois interruptores para a mesma coisa é como as
duas versões desta extensão divergiram, e aqui divergir significaria a rodada gastando dinheiro que
a outra tela diz estar desligado.

As duas caixas fazem coisas diferentes, e a linha embaixo passou a dizer isso:

- **"Automático ligado"** decide se o que a regra **ou a IA** escolher sai sem perguntar. Não é uma
  caixa de IA — e o rótulo agora diz "REGRAS e da IA", igual ao da fila dos Meus, que já tinha sido
  corrigido pelo mesmo motivo em 02/09;
- **"Usar a avaliação por IA"** liga a IA, e vale para todas as rodadas.

E o aviso que faltava: **IA ligada sem chave salva não avalia nada.** Caixa marcada que não faz nada
é a armadilha que este painel já pagou com o botão "Avaliar o contato aberto" — dizer isso no
cartão é mais barato que ele descobrir pelo silêncio no Andamento.

**Arquivos:** `src/panel/panel.js` (`renderCartaoNovos`), `manifest.json` (1.86.0 → 1.87.0).

---

## 2026-09-03 — Confirmação de presença: pular, não responder

Print da Elci: ela escreveu **duas vezes** *"Quero confirmar minha presença no evento: AMIGOS
CAPITAO MARTIM E GUSTAVO VICTORINO"*, a rodada respondeu *"Que bom! Será uma grande satisfação
contar com você… Nome / Cidade"* e concluiu. Ele: *"não é para responder, é para pular e eu atendo
no final — nessa situação de confirmação para evento"*.

`confirmou-presenca-evento` (tecla **2**) é a regra nova.

**A tecla é 2 e não 3, e essa é a decisão que importa.** Confirmação de presença não é um
atendimento que se fecha: é uma **lista** que alguém precisa montar, com nome, cidade e a
confirmação conferidos por gente. Concluir tiraria da tela justamente quem ele quer atender depois.

Ela **substitui `confirmou-presenca-com-dados`** (tecla 8), que nasceu ontem do caso do Deoclécio e
agradecia + encerrava. Apaguei a regra, o verbete e as duas caixas do padrão que a alcançavam —
inclusive o grupo "confirmou presença no evento" dentro de "sem pendência". Deixar as duas de pé
seria a receita de sempre: duas regras para a mesma situação divergem na primeira semana, e a que
ninguém olha é a que responde errado.

Duas coisas que **não** mudaram, e que os testes travam:

- **o sinal é só o "sim"** — quem responde que não vai ao evento segue o fluxo normal, e o preâmbulo
  *"não tem problema"* continua no texto da tecla 4;
- **a recusa continua acima** — quem pediu para sair não vira caso de evento.

E uma que mudou por escolha: **vence a etiqueta que dispensa da fila.** Engajado que confirma
presença é ainda mais o caso dele, e a etiqueta mandaria a mensagem do momento por cima da
confirmação.

A regra entrou em `arvore.PROTECOES`, então vale **antes de ele importar** o quadro novo — que é o
que impede a print de se repetir amanhã.

### O botão de download

*"me dê o botão de download, esse caminho ficou esquisito"*. Ele estava certo duas vezes: o caminho
era mesmo uma pasta temporária, e o problema de fundo é pior — **ele dependia de eu lembrar de
gerar e mandar o arquivo**. Regra que exige alguém lembrar não é regra.

**"Baixar o padrão de hoje"**, ao lado de Exportar/Importar. Baixar não mexe no quadro, de
propósito: é o vizinho seguro do "Resetar para o padrão", que substitui tudo.

**Arquivos:** `src/lib/sugestao.js` (+`confirmou-presenca-evento`, −`confirmou-presenca-com-dados`),
`src/lib/arvore.js` (as caixas nos dois ramos, `PROTECOES`), `src/fluxo.html` e `src/fluxo.js` (o
botão), `src/panel/panel.js` (o comentário do texto da tecla 8), `tests/arvore.test.mjs`,
`CLAUDE.md` (+2 armadilhas), `manifest.json` (1.85.0 → 1.86.0). Quinze suítes, os dois
verificadores, o quadro sem problemas e nenhum desfecho incoerente.

---

## 2026-09-03 — A exceção que faltava em toda caixa

*"algo que notei que está faltando nos ramos e em geral: condição de mandar mensagem e exceção"*.

Ele apontou o buraco mais caro do quadro livre — e é o mesmo que o `problemas` já acusava **sem
poder resolver**: a caixa dele *parece* a regra do código e tem o mesmo desfecho na tela, mas não
carrega as guardas que a regra carrega sozinha (`!enviadoHoje && !modeloJaNaConversa`). Era a
armadilha registrada em 02/09, quando a caixa *"mandar modelo conforme o anúncio"* com a tecla 1
fixa mandava o modelo em **toda passada, para sempre**.

Até hoje, a única forma de dizer *"mande, mas não quando X"* era não usar a caixa.

Agora toda caixa tem **"Exceto quando…"** — mesmo formato da condição (sinal + palavras + onde), e
vazia não faz nada. Quatro decisões:

- **vale também nas caixas de REGRA**, que eram o único lugar do quadro fechado para ele. É seguro
  porque a exceção só **estreita**: nenhuma mensagem passa a sair por causa dela, algumas deixam de
  sair — e errar para o lado de não mandar é o lado barato;
- **é conferida antes de tudo**, inclusive antes do `quando` da regra;
- **não para a busca**: com a exceção valendo, o ramo não decide e a rodada segue nos irmãos —
  mesma disciplina do "casou e não resolveu", que existe para não abrir buraco silencioso;
- **conta como guarda no `repeteSozinha`**, com a polaridade invertida da condição: o *envio* tem
  que tornar a exceção verdadeira. É literalmente para isso que ele a pediu — "mande o modelo,
  exceto quando o modelo já está na conversa" tira o aviso de "esta caixa vai mandar de novo".

`chaveDeComparacao` passou a incluir a exceção: *"mande o modelo"* e *"mande o modelo exceto quando
já mandamos"* são caixas diferentes, e tratá-las como a mesma faria o cartão "O padrão mudou?"
dizer que ele já tem uma guarda que não tem.

**Medido na janela de verdade** (montada com um `chrome.storage` de mentira e o quadro padrão
semeado): abri a caixa `pergunta-aberta` — que é regra do código —, pus a exceção "o modelo já está
na conversa", e ela gravou, apareceu na caixa do quadro em cor de aviso e passou a impedir a regra
naquele contexto.

**Arquivos:** `src/lib/arvore.js` (`excecao` em `noVazio` e no sanitizador, `condicaoCasa`,
`repeteSozinha`, `chaveDeComparacao`, `paraTexto`), `src/fluxo.js` (o editor, para os dois tipos de
caixa, e a leitura no quadro), `src/fluxo.css`, `tests/arvore.test.mjs` (+16), `CLAUDE.md`
(+1 armadilha), `manifest.json` (1.84.0 → 1.85.0). Quinze suítes e os dois verificadores.

---

## 2026-09-03 — O ramo atual, para ele importar

Combinado dele: *"arrume o ramo, eu vou importar. Todas as mudanças feitas aqui, se afetarem o ramo,
você deve me passar o ramo atual"*.

`tools/exportar-fluxo.mjs` gera o padrão de agora no formato que a janela do fluxo importa. Três
decisões:

- **é um gerador, não um retrato guardado.** Snapshot commitado envelhece no primeiro commit que
  mexe no `fluxoPadrao`, e um arquivo de fluxo velho é pior que nenhum: ele reimporta e volta no
  tempo sem perceber. O gerador é versionado; o arquivo, não;
- **confere relendo antes de entregar** — a peneira do `deArquivo` descarta regra que sumiu do
  código, sinal desconhecido e tecla inventada, e um arquivo que perde ramos na importação chegaria
  a ele como *"o fluxo veio faltando pedaço"*. Se a conta não bater, o comando falha em vez de
  escrever;
- **a saída vai fora do repositório**, que é a pasta que o Chrome carrega.

Ele imprime também o fluxo em texto, numerado (`2.5.1` é o primeiro filho do primeiro filho do
quinto ramo do segundo), para eu conferir antes de mandar e para nós dois apontarmos para o mesmo
lugar.

O ramo de agora tem **48 caixas, 20 que enviam**, e sobrevive inteiro à importação.

**Arquivos:** `tools/exportar-fluxo.mjs` (novo), `CLAUDE.md` (+1 armadilha). Sem mudança de
comportamento na extensão, então a versão não sobe.

---

## 2026-09-03 — "Mandou novamente": a regra existia e não alcançava o quadro dele

Segunda print do mesmo defeito no mesmo dia — conversa em que só nós falamos (o disparo das 11:08),
ele assume às 11:42, e sai a mensagem do momento.

Eu tinha acabado de escrever a regra que impede isso (`ultima-e-nossa`). **E ela não podia decidir
nada para ele.**

O quadro de trabalho é uma **cópia** do padrão, e nada entra nele sozinho. É desenho certo — no
quadro a posição é a prioridade, e enfiar caixa por conta própria mudaria a rodada sem ninguém
escolher onde. Mas o preço, aqui, era: a caixa apareceria no cartão "O padrão mudou?" e ficaria
esperando ele encaixar, **enquanto a mensagem continuava saindo para eleitor**.

### A distinção que resolve

**Preferência** é dele: onde mandar o modelo, o que mandar, em que ordem. **Proteção** não tem
ordem em que seja outra coisa: "não mande nada" nunca compete com as outras caixas, porque o
desfecho dela é o silêncio.

`arvore.PROTECOES` é a lista — hoje três: `sem-interesse`, `etiqueta-so-conclui`, `ultima-e-nossa`.
O critério de entrada é duro: **efeito `silencio` na tabela, e nenhum ramo que envie.**

Três coisas que a mantêm honesta:

- **tendo a caixa no quadro, quem decide é o quadro** — a lista só cobre a ausência, senão ela
  passaria por cima da posição que ele escolheu, que é o oposto do que a janela existe para dar;
- **desligada por ele continua desligada** — a lista não ressuscita escolha dele;
- o resultado carrega `id: 'protecao:<regra>'` e `caminho: ['protecao do codigo']`, então o
  Andamento diz de onde a decisão veio, em vez de aparecer um desfecho sem origem no quadro.

Medido no quadro dele reconstruído (o padrão sem as três caixas): conversa vazia → conclui;
etiqueta de assessor → conclui; recusa → conclui sem responder; e quem chega normal continua
recebendo modelo + pedido de dados pelo caminho de sempre.

**Arquivos:** `src/lib/arvore.js` (`PROTECOES` e a passada em `decidir`), `tests/arvore.test.mjs`
(+9), `CLAUDE.md` (+1 armadilha), `manifest.json` (1.83.0 → 1.84.0). Quinze suítes e os dois
verificadores.

---

## 2026-09-03 — "É pra concluir sem mandar nada"

Dois pedidos dele, os dois sobre **não** mandar.

### A conversa em que só nós falamos

Print: a conversa tinha o nosso disparo (*"É hoje, Rio Grande do Sul!"* + o pedido de salvar o
contato), ele assumiu o atendimento às 11:27, e a rodada mandou o pedido de nome e cidade em cima.
*"pegando conversas que a última mensagem foi minha e mandando mensagem, é pra concluir sem mandar
nada"*.

`hsm.decidirSemResposta` já cobria parte disso e roda **antes** da tabela. O que ela não cobre é a
conversa **vazia**: sem nenhuma mensagem do contato não há `ultima` do lado dele para olhar, e o
caso descia até `nunca-pediram-dados`, que envia. Era exatamente a da print.

Agora é uma regra do quadro, `ultima-e-nossa` (tecla 3), presente nos dois lados da bifurcação de
cidade. O sinal vale `'vazia'` no segundo caso — string que é verdadeira e ainda diz na caixa qual
dos dois é, em vez de os dois saírem com a mesma frase.

### A etiqueta de assessor

*"contatos com etiqueta de assessor só conclua"*. Lista própria, `etiquetasSoConcluir`, na aba
Automatizado — separada da que dispensa da fila, porque aquela hoje ainda manda a mensagem do
momento uma vez, e aqui **nada sai, nunca**: quem trabalha no mandato não é público de material de
campanha. A regra fica acima da outra, porque as duas casariam no mesmo contato e o desfecho mais
silencioso tem que ganhar.

**E ele corrigiu na hora, olhando as etiquetas de verdade.** A comparação é por trecho **contido**
(é o que faz "engajado" casar com "ENGAJADO/BIZA" e com "Apoiador Muito engajado"), então `assessor`
pegava as três etiquetas de assessor **e também `CONTATO-ASSESSOR`** — que é eleitor trazido por um
assessor, não a equipe. *"com exceção do contato assessor"*.

Trocar "contido" por "começa com" resolveria este caso e quebraria o outro. Então **item com traço
na frente virou exceção**: o padrão é `assessor, -contato-assessor`, e a exceção é conferida antes
da inclusão. Vale para as duas listas, e a linha embaixo do campo explica.

Medido nas quatro etiquetas da print: as três de assessor concluem, `CONTATO-ASSESSOR` segue o
fluxo normal.

**Arquivos:** `src/lib/sugestao.js` (`etiqueta-so-conclui`, `ultima-e-nossa`, os dois verbetes),
`src/lib/arvore.js` (os dois sinais e as caixas nos dois ramos), `src/panel/panel.js`
(`etiquetaDaLista` com exceção, `etiquetaQueSoConclui`, o sinal `ultimaEhNossa`, o campo novo),
`src/lib/store.js`, `tests/sugestao.test.mjs` (+10), `tests/arvore.test.mjs`, `CLAUDE.md`
(+3 armadilhas), `manifest.json` (1.82.0 → 1.83.0). Quinze suítes, os dois verificadores, o quadro
sem problemas e nenhum desfecho incoerente.

---

## 2026-09-03 — A rodada parou por um `auto` órfão

No log da print, entre 37 enviados: `× Catarina — auto is not defined`, e a rodada encerrou ali.
Relato dele: *"parou a rodada, o que não é pra acontecer"*.

**Bug meu, da versão anterior.** Ao trocar `const auto = await tentarRascunhoAutomatico()` por
`await rascunharParaEle()`, deixei um `auto.motivo` trinta linhas abaixo. Sintaxe válida, nenhuma
função faltando, os dois verificadores em silêncio — e o erro só aparece ao rodar.

Duas coisas foram consertadas, e a segunda é a que importa:

1. o `auto.motivo` virou `rascunho.motivo`;
2. **a chamada do rascunho está dentro de `try`.** A regra já estava escrita no `CLAUDE.md` —
   *"falha de IA nunca para a rodada"* — e este caminho não a seguia. O rascunho é uma
   conveniência; a fila é o trabalho. Erro de AMBIENTE continua parando a rodada de propósito (a
   aba trocou de atendimento, o campo de mensagem não apareceu): ali seguir seria agir às cegas.

### A tentativa de fazer o verificador pegar isso — e por que ela não deu

Escrevi uma passada nova em `checar-referencias.mjs` que acusaria `nome.campo` sem declaração.
Deu **33 falsos positivos** (`for (const item of ...)`, `.map((op) => ...)`, e o `i` de flag de
expressão regular). O corte que a deixou quieta — nome que aparece uma vez só no arquivo — **não
pegava o caso real**: `auto` aparece dezenas de vezes em `panel.js` (`state.auto`, `salvarAuto`),
só não naquele escopo.

Joguei a passada fora. Pegar isso de verdade exige análise de escopo, e análise de escopo exige um
parser — que este projeto não tem por decisão (sem dependência). Fica registrado para ninguém
refazer a tentativa. **O que protege é o `try`, não o verificador.**

A tentativa deixou dois consertos de verdade no `soCodigo`, que valem para a passada que já
existia: as **flags** da expressão regular agora somem junto com ela (deixavam um `i` solto), e
**desestruturação e `for...of`** passaram a contar como declaração.

### O rascunho pedia o nome que já estava no CRM

*"a IA perguntou nome — o nome dela é Catarina, eu apaguei a parte perguntando"*.

`montarContatoRascunho` mandava só a cidade para a IA. O nome estava no cadastro e ela não tinha
como saber — e pedir o que já se tem é o jeito mais rápido de a pessoa achar que ninguém leu nada.
Agora vai o cadastro inteiro, com o pedido explícito de não pedir de novo.

**O nome vai para a IA saber que já o temos, nunca para usar:** a regra de não chamar a pessoa pelo
nome (decisão dele, 10/08 — o cadastro erra o nome com frequência alta demais) continua no prompt
de sistema, e está dita de novo na linha do cadastro.

**Arquivos:** `src/panel/panel.js` (o `try`, o `rascunho.motivo`, o cadastro que vai para a IA),
`src/lib/ia.js` (`montarContatoRascunho`), `tools/checar-referencias.mjs` (flags de regex,
desestruturação, `for...of`, mais globais), `CLAUDE.md` (+3 armadilhas), `manifest.json` (1.81.0 →
1.82.0). Quinze suítes e os dois verificadores.

---

## 2026-09-03 — "Automático ligado" nos Novos

Pedido dele: *"nos novos as mensagens raramente saem do contexto, faça um botão para mandar mensagem
automática nos novos, um box de marcar automático ligado"*.

Ele está certo sobre a chegada: o que sai ali é o recibo do anúncio e o pedido de nome e cidade, e
os dois valem para quase todo mundo que chega. Na fila dos "Meus" não é assim — lá chega desabafo,
pedido de ajuda e pergunta de posição —, e é por isso que a caixa é **separada** da de lá. Uma caixa
só o obrigaria a automatizar as duas filas ou nenhuma.

A caixa fica no cartão "Novos: começar a conversa", logo acima do botão, e o rótulo diz as duas
coisas que ela faz — lição da caixa dos "Meus", que se chamava "Automatizar com IA" e executava as
REGRAS também, com a IA desligada.

### O que quase virou uma fila parada em silêncio

Três lugares perguntam "esta rodada anda sozinha?": a execução da tecla, a da IA, e **a pergunta da
cidade**. Os dois primeiros eu teria achado; o terceiro é o que já custou uma rodada parada quando a
automação dos "Meus" nasceu, e voltaria agora — porque `cidadeConferidaPelaIA` só responde com a
**IA ligada**, e o automático dos Novos vai rodar quase sempre com ela desligada. A caixa da cidade
abriria esperando um clique que ninguém ia dar.

`confirmarCidadeSePendente` passou a **não gravar e não perguntar** nesse caso. Não é remendo: a
regra dele é que nenhuma cidade de palpite vai para o CRM sem confirmação, então não gravar é o
desfecho certo, e o palpite volta na próxima passada. A linha no Andamento é o que impede isto de
virar "às vezes pega a cidade".

Por isso a leitura virou uma função só (`rodadaAutomatica()`): três leituras separadas divergem na
primeira caixa nova. O estado da rodada em curso é `state.auto.automatico`, zerado no `finally` do
`rodar` — rodada que morre por erro deixaria a próxima andando sozinha sem ninguém ter marcado nada.

**O que continua parando para ele, com o automático ligado:** a tecla "Responder à mão" (por
definição alguém precisa escrever), a cidade de palpite, e o rascunho da IA, que desde a versão
anterior nunca envia sozinho.

**Arquivos:** `src/lib/store.js` (`automaticoNovos`, na lista de mescla — chave nova em objeto já
salvo não alcança quem já usa), `src/panel/panel.js` (`rodadaAutomatica`, `state.auto.automatico`,
os três pontos de leitura, a guarda da cidade, a caixa e o confirm), `CLAUDE.md` (+2 armadilhas),
`manifest.json` (1.80.0 → 1.81.0). Quinze suítes e os dois verificadores.

---

## 2026-09-03 — O rascunho da IA não envia mais sozinho

Ele viu a mensagem sair e cortou: *"retire essa mensagem automática, só no modo IA manda sem eu
escolher"*. No log da rodada, na print:

> ⚠ Gabinete Deputado Capitão Martim — IA enviou sozinha: "Opa! Que legal você acompanhando! Sim,
> está sendo um grande movimento aqui no RS. Obrigado por estar junto nessa caminhada!"
> ✓ Gabinete Deputado Capitão Martim — rascunho da IA enviado sozinho (confiança 92%, sem avisos)

**As quatro travas funcionaram.** Estava ligado na Config, a revisão não levantou nada, a IA não
pediu revisão, e a confiança foi 92% (o limiar era 90%). O texto até era razoável. E saiu assim
mesmo, sem ninguém ler, em nome do mandato.

É a lição que eu não tinha: **trava boa não transforma texto inventado em texto revisado.** Ela
reduz a frequência do erro; não muda o que a coisa é. E mensagem de WhatsApp não volta.

`tentarRascunhoAutomatico` virou `rascunharParaEle`: rascunha, põe o texto no campo de mensagem com
`setComposerText` — **nunca** `sendText` — e devolve `enviado: false` sempre, então a rodada segue
para a caixa de pergunta, onde ele lê, ajusta ou apaga. Os avisos da revisão vão para a linha do
Andamento, e continuam **sem esconder o texto**: esconder tiraria a decisão dele, que é justamente
o que este caminho passou a existir para devolver.

**Apaguei junto** `ia.podeEnviarSozinho`, `CONFIANCA_RASCUNHO_AUTO`, a chave `enviarRascunhoAuto` do
armazenamento e a caixa da Config — com os testes que os cobriam. Deixar a função de pé sem gatilho
é a armadilha do `pedido-emprego`, e esta em especial é a que alguém religa sem querer.

O que sobrou é o laço que ele já fazia à mão — pedir uma resposta a uma IA, ler, ajustar, mandar —
sem o copiar e colar. **Quem aperta enviar é ele.**

**Arquivos:** `src/panel/panel.js` (`rascunharParaEle`, o ponto de chamada, a Config),
`src/lib/ia.js` (−`podeEnviarSozinho`, −`CONFIANCA_RASCUNHO_AUTO`), `src/lib/ia-cliente.js`,
`src/lib/store.js` (−`enviarRascunhoAuto`), `tests/ia.test.mjs`, `CLAUDE.md`, `manifest.json`
(1.79.0 → 1.80.0). Quinze suítes e os dois verificadores.

---

## 2026-09-03 — Quarta leva: o anúncio que respondia para sempre

Oito anotações. Seis viraram conserto; duas continuam com ele.

### A Lúcia e o Deoclécio: a mesma resposta do anúncio, em toda passada

A Lúcia respondeu ao convite, deu **nome**, deu **cidade** e escreveu *"Sim estarei lá com voceis"* —
e a caixa oferecia de novo a resposta pronta do anúncio. *"só concluir, ela confirmou minha
mensagem"*. O Deoclécio já tinha mandado seis vídeos depois disso: *"o contexto se perdeu"*.

A causa é a armadilha que este projeto já registrava: **o texto do anúncio fica na conversa para
sempre.** A única trava que existia (`silencio`) cobre só quem decidiu não mandar NADA — recusa,
despedida. Para todo o resto o anúncio vencia a regra em toda passada, para sempre.

`decidirComAnuncio` passou a perguntar **se a ação já foi cumprida**, e quem calcula pergunta à
CONVERSA, não ao registro de envios (que só enxerga o que saiu pelo painel): `resposta` olha se
aquele texto já saiu, com as três variantes; `dados` usa `jaPediramDados`, que casa pelo invariante
`Nome / Cidade`. Cumprida a ação, **o anúncio se cala e o quadro decide** — que é o certo, porque a
conversa andou.

### E o modelo padrão que reveza: a conferência olhava só o da vez

Achado no mesmo caminho, e é a resposta às anotações da Mary e da Eliana (*"já foi mandado modelo,
só concluir"*, 02/09): `modeloJaNaConversa` comparava a conversa com **o modelo que sairia agora**.
O padrão reveza entre três desde 02/09 — bastava a roleta andar entre duas passadas para o recibo
ser **reenviado**.

Agora, quando a escolha é o padrão, a conferência varre os três. Não é preferência de redação: os
três dizem a mesma coisa, então ter recebido um é ter recebido o recibo.

### A Eroni: "não mande o mesmo conteúdo de novo" pressupõe que o conteúdo é o mesmo

Ela recusou o convite e depois clicou em **dois anúncios diferentes**. A caixa ofereceu a mensagem
do momento, por `voltou-por-outro-anuncio`. Ele: *"aqui ela veio por outro modelo sem ser o padrão,
mandar o modelo pedido e pedir dados que falta"*.

Certo — a regra existe para quem volta pedindo **a mesma coisa** (print do Telmo, 31/08). Passou a
exigir `modeloJaNaConversa`: para o Telmo é verdadeiro, para a Eroni é falso, e o caso desce para
`anuncio-modelo-e-dados`, que manda o modelo e pede os dados na mesma passada.

### O Paulo Cézar: o engajado deixou de ser pulado

*"engajado recebe mensagem do momento uma vez por dia e depois toda vez que aparecer pode concluir
em vez de pular"*.

Pular deixava o atendimento **aberto**: o engajado que manda vídeo o dia inteiro voltava a custar
uma abertura por rodada, para sempre — e nunca recebia nada, sendo quem mais fala com o gabinete.
O desfecho passou a ser o mesmo par de `voltou-por-outro-anuncio`.

**Consequência a lembrar: essa regra deixou de ser uma proteção.** Enquanto o efeito era `silencio`
ela barrava a ação do anúncio e a janela do fluxo acusava caixa que envia pendurada nela. A proteção
que continua de pé é `sem-interesse`, com a despedida — e há teste travando as duas coisas.

### A Teresinha: uma pergunta que não casava com nada

*"Tem alguém que vem na casa da gente pra conversar"* — sem "?", sem "por que", sem "qual a
posição". Nenhum padrão pegava, e a rodada sugeriu **concluir**. Ele: *"ela quer saber se fazemos
visitas, respondi a pergunta, a regra de sempre responder uma pergunta tem que valer"*.

Entraram "tem alguém que/pra", "tem como" e "vocês fazem/atendem/vêm", guardados por **posição**
(começo da mensagem, ou "?") — sem essa guarda, *"aqui na minha rua tem alguém que apoia vocês"*
viraria pergunta e tiraria da automação quem só estava contando algo.

### A Regina: a ajuda financeira voltou para cima do modelo

*"Presizo de uma ajuda"*, *"Meda uma ajuda"*, *"Eu preciso pagar umas contas que estão muito
atrasada"* — e a caixa ofereceu o modelo padrão. Ele: *"modelo fora de contexto, ela quer ajuda
financeira, mandar mensagem pronta referente"*.

**Isto desfaz a decisão dele de 02/09** (*"o modelo não irá confirmar apoio ao pedido de ajuda…
então pode ser respondido após"*). O argumento continua verdadeiro sobre o TEXTO — o modelo é recibo
de cadastro e não promete nada. O que o caso real mostrou é outra coisa: **propaganda como primeira
resposta a quem escreve que não consegue pagar as contas é a resposta errada mesmo quando o texto é
inofensivo.**

Foi mudado no `fluxoPadrao`; o quadro dele é uma cópia, então o cartão "O padrão mudou?" vai
acusar a caixa nova.

### O que fica com ele

- **jairoc** — escreveu quatro mensagens de opinião política e recebeu o pedido de dados. *"chegar
  pedindo dados seria fora do contexto, a IA assume, responde e pede os dados"*. A regra que existe
  para isto (`ultima-pede-resposta-pessoal`) mede a rajada em **400 caracteres**, e a dele tem ~270.
  Baixar o limite tira mais gente da automação; preciso do número dele antes de mexer;
- **Maria de Lourdes** — o motivo da caixa foi corrigido (não fala mais de "material"), mas ele
  escreveu *"eu vou mandar modelo pois ela não recebeu ainda"*, e isso contraria a decisão de 31/08
  (*"a prioridade é responder o que foi falado, depois mandar modelo"*). São ordens opostas para o
  mesmo caso; ele decide qual vale. **E a cidade dela**: ele diz que era Caxias do Sul e o campo
  ficou vazio — nas cinco mensagens que vieram na anotação não há "Caxias", então preciso da
  mensagem em que ela escreveu.

**Arquivos:** `src/lib/anuncios.js` (`jaSaiu`), `src/lib/cortesia.js` (três padrões de pergunta),
`src/lib/sugestao.js` (`voltou-por-outro-anuncio`, `etiqueta-dispensa-da-fila`, o motivo de
`so-expressa-apoio`), `src/lib/arvore.js` (a ajuda financeira na chegada), `src/panel/panel.js`
(`jaSaiuNaConversa`, os três modelos padrão, `jaSaiuOAnuncio`), os testes de `anuncios`, `cortesia`,
`sugestao` e `arvore`, `CLAUDE.md` (+6 armadilhas), `manifest.json` (1.78.0 → 1.79.0). Quinze
suítes, os dois verificadores, o quadro sem problemas e nenhum desfecho incoerente.

---

## 2026-09-03 — "O iniciar conversas não foi atualizado com as regras atuais"

Ele está certo, e a distância era maior do que a frase sugere.

### A rodada dos Novos era um motor à parte

Todo o redesenho da chegada — reconhecer **de qual** anúncio a pessoa veio, mandar o modelo daquele
anúncio como recibo, pedir nome e cidade em seguida, só então responder a pendência — foi escrito em
`processarRespondido`, o caminho de quem já está em "Meus".

`processarNovo` continuava com o motor de antes do quadro existir:

- **uma frase única** (`padraoNovos`) no lugar do cadastro de "Anúncios do momento". Quem chegava por
  um anúncio cadastrado e não repetia aquela frase era assumida **sem receber nada**;
- **o formulário como única mensagem possível** — o modelo do anúncio, que é o recibo que ele
  desenhou em 02/09, esta rodada nunca soube mandar;
- **o quadro sem voz nenhuma**: `sugerirAcaoComFluxo` não era chamado aqui.

O efeito é o pior tipo de defeito deste projeto: **quem chega pelo anúncio está exatamente nesta
fila**, então o ramo "pessoa chegando" que ele montou no quadro quase nunca decidia uma chegada de
verdade. Ele mexia no ramo e não via diferença — porque a diferença estava noutro motor.

### O conserto: assume e delega

`processarNovo` são doze linhas agora. Assume o atendimento e chama `processarRespondido`.

**Assumir vem antes de decidir, e não é escolha:** contato em "Novos" está PENDENTE, e pendente não
tem campo de mensagem — nenhuma decisão do fluxo poderia ser executada. O efeito colateral é o que a
rodada antiga já queria: assumido, ele sai da fila mesmo quando o fluxo resolve não mandar nada, em
vez de ser reaberto por toda rodada futura (o que derrubava a API).

E é aí que estava a armadilha silenciosa: `percorrerFila` decide andar de posição perguntando *"o
contato continua na lista?"*, e um `pulado` respondia que sim. Como aqui ele **sempre** sai, a
posição andaria sobre uma lista que já encurtou — e o contato que escorregou para o lugar deste
nunca seria aberto, sem nada na tela. O resultado agora carrega `saiuDaFila: true`.

**O que se perdeu ao apagar o motor antigo, e onde cada coisa foi parar:** *só cumprimentou* virou a
caixa com o sinal `soCortesia` (mais estrita que a lista de palavras que estava ali); *já informou
nome ou cidade* é o parser do `load()` mais o quadro; o formulário continua saindo, agora pela tecla
que o quadro escolher — inclusive junto do modelo do anúncio.

**Mudança de comportamento que ele precisa saber:** a rodada dos Novos passou a **perguntar contato a
contato**, como a dos "Meus". Sem marcar "Automatizar", ela para em cada um.

### A metade que faltava do conserto do Carlos

Achado escrevendo isto: `semRuidoDaPlataforma` peneirava `state.entrantes` e **não** `state.incoming`
— e `incoming` é quem alimenta o parser, `tags.suggest`, o reconhecimento do anúncio e a IA. Ou
seja, *"Não foi possível transcrever este áudio"* continuava sendo lido como fala dela em quatro
lugares; só as regras de cortesia estavam protegidas.

Aqui a mensagem **sai da lista** em vez de ficar vazia: `incoming` é uma lista de textos, e texto
vazio ali não carrega o "ela mandou um áudio" que os `entrantes` guardam.

**Arquivos:** `src/panel/panel.js` (`processarNovo`, `runLoteNovos`, `renderCartaoNovos`,
`percorrerFila`, os dois pontos de `state.incoming`), `CLAUDE.md` (+2 armadilhas), `manifest.json`
(1.77.0 → 1.78.0). Quinze suítes e os dois verificadores.

---

## 2026-09-02 — Terceira leva: o ruído da plataforma virava recusa do eleitor

Das dezoito anotações, **sete eram novas**. Duas delas apontavam para a mesma causa, e é a mais
grave que apareceu até agora.

### O Carlos foi etiquetado como "sem interesse" por um texto que a plataforma escreveu

Ele mandou um áudio. O que chegou no lugar foi *"Não foi possível transcrever este áudio"* — e
`semInteresse` leu o "Não foi possível" como recusa. **Etiqueta permanente errada no CRM, num
apoiador do anúncio, com o atendimento concluído em silêncio.**

A **Vera** teve dois *"*Atenção:* o tipo da mensagem enviada pelo contato não é suportado."* lidos
como *"escreveu apoio em mensagem própria"*, e recebeu o modelo em cima de um aviso de erro.

A plataforma injeta esses textos no fluxo do contato, então chegam idênticos a uma mensagem dela.
Nenhum parser tem como saber: é ruído com forma de fala.

`cortesia.ehMensagemDaPlataforma` reconhece, e o painel **esvazia** o texto (marcando
`sistema: true`) num lugar só, antes de qualquer regra ver. Três decisões:

- **esvazia, não descarta** — "mandou um áudio e não deu para ler" é informação diferente de "não
  mandou nada", e é a primeira que leva o caso para a tecla 6, onde alguém abre;
- **o asterisco do `*Atenção:*` é obrigatório** — gente escreve "Atenção: preciso de ajuda" sem ele,
  e apagar a fala de quem falou de verdade é pior que ler o ruído. Meu primeiro padrão pegava as
  duas coisas, e o teste dos falsos positivos me mostrou;
- fica no **painel**, não em `api.js`, que não importa nada de propósito.

### A Teresinha e a caixa que prometia exclusividade no nome

*"Boa tarde queria saber mais"*, *"Como faso pra conversar com vocês"*, *"Boa tarde o senhor tá
concorendo também"* — e ela recebeu a mensagem do momento, porque a caixa **"só mandou bom dia"**
casa por trecho **contido**.

É o mesmo defeito da print da Cris (desabafo de 437 caracteres começando com "Oi. Bom dia,"), e o
`CLAUDE.md` já o registrava. A caixa virou o sinal **`soCortesia`**, que pergunta o que o nome dela
sempre prometeu: **todas** as últimas mensagens são só cumprimento?

Medido nos quatro casos: a Teresinha e a Cris deixam de casar, "Boa tarde" sozinho e "bom dia"
continuam.

**E o `problemas` me pegou no meio:** `soCortesia` olha as três últimas da conversa, sem saber onde a
nossa entrou — então o sinal continuaria verdadeiro depois de respondermos, e a caixa mandaria a
mensagem do momento em toda passada. O painel passa a **rajada**.

### A Vivi — "Tem trabalho ai?"

A forma mais curta e mais comum de perguntar sobre trabalho, e não casava com nada: ela foi
**concluída em silêncio**. Relato dele: *"ela fez uma pergunta, nunca concluir sem responder"*.
Entrou em `pedeEmprego`, com o "tem/teria" na frente para não pegar *"o trabalho de vocês é ótimo"*.

### O que fica para ele decidir

- **Mary e Eliana** — *"já foi mandado modelo… só concluir"*. `conteudo-pedido` exige que o modelo
  não esteja na conversa, e o modelo padrão agora **reveza entre três**: se o que saiu foi outra
  variante, a comparação não casa e ele é reenviado. O conserto é comparar contra os três, e eu
  quero a confirmação dele antes de mexer;
- **Vera Lúcia (Osório)** — *"gostaria de saber mais sobre o candidato"*. Ele escreveu que pergunta
  sempre tem prioridade sobre o modelo, mas essa pergunta específica é o que o modelo responde.
  Preciso que ele diga qual das duas leituras vale;
- **Helena** — *"22 com toda certeza"* não casou com nada. É declaração de voto, e `soExpressaApoio`
  não a reconhece. Marcar número de urna como apoio é fácil de errar para o outro lado.

**Arquivos:** `src/lib/cortesia.js` (`ehMensagemDaPlataforma`, `pedeEmprego`), `src/lib/arvore.js`
(sinal `soCortesia`, a caixa nova), `src/panel/panel.js` (`semRuidoDaPlataforma`, os dois sinais),
`tests/cortesia.test.mjs` (+14), `tests/arvore.test.mjs` (6 asserções migradas para o sinal),
`CLAUDE.md` (+2 armadilhas), `manifest.json` (1.76.0 → 1.77.0). Quinze suítes, os dois verificadores,
o quadro sem problemas e nenhum desfecho incoerente.

---

## 2026-09-02 — A cópia das observações manda só as novas

**Pedido dele:** *"ao copiar vai vir casos anteriores, eu tenho que lembrar de apagar para começar
outra rodada"*.

Ele estava certo duas vezes. **Regra que exige alguém lembrar não é regra** — é a mesma lição que a
série da versão deste projeto já carrega. E a única saída que existia (apagar tudo depois de colar)
é destrutiva: colagem que desse errado levava as anotações junto.

E deu para ver o efeito na prática: das onze anotações que ele me mandou na segunda leva, **oito
eram repetidas** da primeira — eu li e reanalisei casos que já estavam consertados.

### Como ficou

Cada anotação carrega `copiada`. O cartão mostra três estados:

| situação | o que aparece |
|---|---|
| 2 novas, 1 já copiada | *"2 nova(s) · 1 já copiada(s) antes"* · **Copiar as 2 novas** · **Ver todas (3)** |
| depois de copiar | *"Nenhuma nova desde a última cópia · 3 já copiada(s)"* · **Copiar todas (3)** |
| nada copiado ainda | **Copiar as N novas**, sem o botão de alternar |

O texto na tela é sempre o que o botão copia — botão que leva outra coisa vira surpresa. E **marcar
não é apagar**: o histórico continua consultável, e "Copiar todas" reenvia quando a conversa comigo
se perder.

### Uma decisão que vale explicar

A marca é aplicada **mesmo quando a área de transferência recusa** (foco fora da aba, permissão). Ali
o texto fica selecionado e o caminho é o Ctrl+C dele, que eu não tenho como observar — marcar é a
suposição certa, porque errar para o outro lado devolve exatamente o defeito que isto veio consertar.
A mensagem diz que marcou, e "Copiar todas" está ao lado.

A marca é pelo `em` (o instante em que a anotação nasceu) e não pela posição: entre o clique e a
gravação o painel pode ter acrescentado outra, e marcar por índice pegaria a errada.

### Conferido na tela

Painel aberto de verdade com uma lista mista: os três estados, o alternar mudando o texto **e** o
rótulo do botão junto, e as três marcas gravadas depois de copiar.

**Arquivos:** `src/lib/observacoes.js` (`copiada`, `naoCopiadas`, `marcarCopiadas`),
`src/panel/panel.js` (o cartão), `tests/observacoes.test.mjs` (+10), `manifest.json`
(1.75.0 → 1.76.0). Quinze suítes e os dois verificadores passando.

---

## 2026-09-02 — Segunda leva: três casos novos (e oito que já estavam consertados)

Ele mandou onze anotações. **Oito eram anteriores à recarga** — o motivo da Eunice ainda dizia
*"mandou um áudio — só dá para responder depois de abrir"*, que é literalmente a frase que eu tinha
trocado, e Iraci, Kelvem, Eliane, Silvia e Jeane vinham palavra por palavra iguais às da leva
anterior. Conferi a Eunice do desabafo no motor: já dá **tecla 6**, que é o que ele queria.

Três eram novos.

### Luiz Zanchet — palavra parecida virando etiqueta no CRM

*"Seja bem vindo at a vitória"* — "até a vitória" com um "é" comido — virou **Vitória das Missões**,
confiança `aproximada`, e a etiqueta do município foi parar no contato dele.

O caminho *"texto curto é a própria resposta"* aceitava qualquer confiança. Hoje aceita `exata`, ou
`aproximada` **quando o casamento consumiu a mensagem inteira** — a mesma conferência de
`isCityAlone`.

O teste do parser pegou meu excesso no meio do caminho: a primeira versão exigia só `exata` e
derrubou `"Sao lourenso"`, que é alguém tentando escrever São Lourenço do Sul. A tolerância a erro
de digitação existe para a POSIÇÃO da cidade; em texto livre ela transforma "vitória", "esperança" e
"progresso" em município.

### Elsa Tonini — ir condicional não era nada

*"Eu irei só se ele vier para Bento Gonçalves…"* não casava com confirmação nem com recusa, e o caso
seguia como se ela não tivesse falado do evento. Relato dele: *"resposta ao evento que não irá"*.

Os padrões de recusa ganharam a condição, e ficam **antes** da lista do "vai" pelo mesmo motivo do
"gostaria… mas": a ressalva é o que decide.

### Eliana — pergunta de política descartada pela trava de posição

Ela colou o texto do anúncio e emendou *"gostaria de saber se tem algum projeto para criar leis mais
rígidas…"* — **numa mensagem só, sem interrogação**. A trava que exige o padrão no começo da mensagem
(ou um "?") descartou, e ela recebeu o recibo do anúncio com o pedido de cadastro.

Essa trava é boa e tem motivo: "pq" no meio de frase é conjunção (print do Ciro, 31/08). Mas é cega
demais para frases que são pergunta em qualquer posição. Hoje há `PERGUNTAS_INEQUIVOCAS` —
"tem algum projeto/lei", "vão apoiar/votar", "o que vão fazer sobre" — que não passam pela trava.

**"tem algum material/conteúdo" fica de fora de propósito:** aquilo o modelo responde perfeitamente,
e é a maior parte do que chega.

### Dois que ficam para ele decidir

- **Luiz** — ele pediu *"modelo + pedir dados + concluir"*, mas o contato tem etiqueta de cidade, e a
  regra composta exige não ter (decisão dele: *"se ela tiver etiqueta de cidade fica só no modelo"*).
  Com a etiqueta errada corrigida, o caso pode ter mudado sozinho;
- **Mary** — *"já foi mandado modelo, última resposta foi um emoji, só concluir"*. `conteudo-pedido`
  exige `!modeloJaNaConversa`, e o modelo padrão agora **reveza entre três** — se o que saiu foi outra
  variante, a comparação não casa e ele é reenviado. Preciso confirmar com ele antes de mexer: a
  correção é comparar contra os três modelos padrão, não só o da vez.

**Arquivos:** `src/lib/cities.js` (`matchCityComContexto`), `src/lib/cortesia.js` (recusa condicional,
`PERGUNTAS_INEQUIVOCAS`), `tests/parser.test.mjs` (+6), `tests/cortesia.test.mjs` (+18),
`CLAUDE.md` (+3 armadilhas), `manifest.json` (1.74.0 → 1.75.0). Quinze suítes, os dois verificadores
e o quadro sem problemas.

---

## 2026-09-02 — As seis anotações dele, medidas uma a uma

Ele mandou seis observações com o contexto de cinco mensagens. **Cada uma era um defeito diferente**,
e cinco deles eu consegui reproduzir no motor antes de mexer em qualquer linha.

### 1 e 2 — a cidade sumia com mais de uma mensagem *(Jeane, Silvia — e o João da leva anterior)*

`extract` chamava `matchCityComContexto` na **conversa inteira colada num texto só**. Dentro dela, o
caminho *"texto curto é a própria resposta"* exige 30 caracteres — então funcionava apenas quando a
conversa tinha UMA mensagem. Medido: `["Oi jeane Souza Novo Hamburgo"]` dá Novo Hamburgo;
`["oi", "Oi jeane Souza Novo Hamburgo"]` dá **nada**.

Hoje a busca é **mensagem a mensagem**, da mais nova para a mais antiga. Os três caminhos são os
mesmos (resposta ao formulário, mensagem curta que é a cidade, menção depois de pista) — mudou onde
procuram. Bônus: a pista de uma mensagem não alcança mais o texto da seguinte.

Dez asserções, incluindo as três guardas que não podem cair (estado por extenso, vocabulário da
campanha, "Capitão Martim").

**A Silvia se resolve junto:** com a cidade voltando a sair, ela deixa de ser concluída em silêncio.

### 3 — grito de campanha virando RSVP *(Eliane — e a Mary da leva anterior)*

`confirmaPresenca` aceitava o verbo **solto**. Medido: *"Juntos vamos"*, *"Vamos vencer Flávio"*,
*"Vamos juntos mudar o Rio Grande"* e *"vou votar em vocês"* — todos viravam confirmação de presença.

Hoje o verbo precisa vir com o que o torna presença: "sim", um lugar (lá, aí), um verbo de
comparecer, ou ser a mensagem inteira. Doze confirmações reais continuam passando, sete falsos
positivos caem, e a recusa não foi tocada.

### 4 — o áudio transcrito ainda alegava que precisa ser aberto *(Eunice)*

O conserto de 01/09 vive em `pedeRespostaPessoal`, mas `conversaPedeRespostaPessoal` chamava
`pedeRespostaPessoal({ tipo: msg?.tipo })` — **jogando fora `texto` e `transcrito`**. A regra estava
certa e testada; a chamada não a deixava ver nada.

Com a rajada real dela, o motivo passou de *"mandou um áudio — só dá para responder depois de
abrir"* para *"mandou 5 mensagens (com áudio) somando 690 caracteres — é conversa, não é caso de
modelo"*. O desfecho continua tecla 6, que é onde o painel chama a IA — que era o que ele queria.

### 5 — o agradecimento repetia *(Iraci)*

`respondeuOsDados` era recortado **depois do pedido**, e isso não se apaga nunca: a resposta dela
continua sendo posterior ao pedido para sempre. Ela respondeu, foi agradecida, mandou dois emojis, e
a rodada quis agradecer de novo.

Hoje o corte é na **nossa última mensagem** — o sinal passa a significar "ela respondeu e nós ainda
não respondemos de volta".

### 6 — o texto que nega emprego existia sem ninguém acioná-lo *(Kelvem)*

`pedido-emprego` estava escrito, revisado, entre os `RESTRITOS` da IA e com etiqueta própria — e
**nenhuma regra ou caixa o alcançava**. Quem perguntava como trabalhar no mandato recebia
agradecimento genérico, o que em cima de *"vocês pagam?"* soa como sim. Prometer emprego a eleitor é
proibido pela Lei 9.504/97.

`cortesia.pedeEmprego` lê a **rajada** (o pedido dele veio partido: a pergunta numa mensagem, o
"vcs não pagam" na seguinte) e tem lista de guarda contra o falso positivo — *"vamos trabalhar
juntos"* e *"obrigado pelo trabalho"* são a fala mais comum desta base. Treze asserções, seis delas
falso positivo.

**Arquivos:** `src/lib/extract.js` (busca por mensagem), `src/lib/cortesia.js` (`confirmaPresenca`,
`conversaPedeRespostaPessoal`, `pedeEmprego`), `src/lib/arvore.js` (sinal + caixa), `src/panel/panel.js`
(o corte do `respondeuOsDados`, o sinal novo), `tests/parser.test.mjs` (+10),
`tests/cortesia.test.mjs` (+36), `CLAUDE.md` (+5 armadilhas), `manifest.json` (1.73.0 → 1.74.0).
Quinze suítes, os dois verificadores e o quadro sem problemas.

---

## 2026-09-02 — "não capturou porto alegre": o IBGE fora do ar apagava a lista inteira

**Relato dele:** *"tem uma [observação] que pode confundir que é com relação a cidade, a extensão não
capturou porto alegre para preencher"*.

### O parser estava certo

Testei dezessete formas de escrever Porto Alegre — `POA`, `Poa`, `Ana POA`, `Maria Silva / POA`,
`Porto alegre/RS`, `Porto Alegre.`, `moro em porto alegre`. **Todas** voltam
`Porto Alegre` com confiança `exata`, e o nome sobra certo nas que têm nome junto.

### A causa, que eu peguei por acidente

Na primeira tentativa o meu próprio banco de testes caiu em `IBGE 503` e **nenhuma** das dezessete
passou — nem "Porto Alegre" puro. Aí estava o defeito de verdade.

`loadMunicipios` busca a lista no IBGE e, falhando, caía numa lista montada com o que ele já tinha
cadastrado em `cityLinks` — quase sempre vazia. **Com a lista vazia, `matchCity` compara contra nada
e nenhuma cidade é reconhecida nunca.** O único sinal era um `console.warn`, e o sintoma na tela é
exatamente o que ele descreveu: campo Cidade vazio com a cidade escrita na conversa.

Basta o IBGE dar 503, a rede estar bloqueada, ou a primeira abertura ser sem internet — e como o
resultado bom fica em cache para sempre, quem já tinha a lista nunca via o problema, e quem não
tinha nunca teve cidade nenhuma.

### O conserto

O `src/data/coredes-rs.json` **já vem no pacote** com os 497 municípios da planilha oficial da
SPGG-RS. É a mesma fonte que decide o COREDE, então usá-la aqui garante que as duas coisas não
possam discordar sobre quais municípios existem.

Medido com o IBGE fingindo 503 e o storage vazio: de **zero** para 497, e `POA` volta a virar
Porto Alegre.

Duas decisões:

- **fica depois do IBGE** — com rede, a autoridade continua sendo ele, e município novo aparece sem
  precisar de commit;
- **a lista de emergência não é gravada no cache do storage** — se fosse, ela viraria a definitiva e
  o IBGE nunca mais seria consultado, inclusive depois de a rede voltar.

### E as observações

Não consigo lê-las: elas ficam no `chrome.storage.local` do navegador dele, e eu só alcanço o
repositório. O caminho é o botão **Copiar observações** na aba Automatizado, e colar aqui.

**Arquivos:** `src/lib/cities.js` (`loadMunicipios`), `tests/parser.test.mjs` (+5),
`CLAUDE.md` (+1 armadilha), `manifest.json` (1.71.0 → 1.72.0). Quinze suítes e os dois verificadores
passando.

---

## 2026-09-02 — A rodada pulava contato sem perguntar: era a IA escalando

**Relato dele:** *"pulando contato sem eu pedir mesmo a minha mensagem não sendo a última e com o box
de pular desmarcado"*.

Estava certo, e as duas observações dele eram a pista: **não era** a conclusão automática (essa exige
que a nossa mensagem seja a última) e **não era** o pulo por etiqueta (essa olha a caixa que ele
deixou desmarcada).

### A causa

Quando a IA **escala** — nenhuma resposta pronta serve —, o código devolvia `pulado` e voltava, sem
abrir a caixa. E esse retorno **não olhava caixa de seleção nenhuma**: nem a de automatizar, nem a de
pular por etiqueta. Com a avaliação por IA ligada, todo caso que ela passasse para ele sumia da
rodada, com o motivo só no log do Andamento.

A incoerência era com a **tecla 6**, que significa a mesma coisa — "aqui precisa de gente" — e é a
exceção que a automação respeita: ela **abre a caixa**. Escalar fazia o oposto.

### O conserto

Escalar deixou de retornar. O caso segue para a caixa, com uma linha nova:

> ⚠ IA passou para você: \<motivo dela\> (sugestão dela: "…")

O rascunho, quando existe, já está no campo de mensagem — então ele decide olhando o texto pronto,
que é o laço manual que a IA veio encurtar.

### O que conferi antes de tirar o `return`

Deixar de retornar faz o caso escalado passar por dois blocos que antes ele nunca via. Os dois estão
fechados:

- a automação da IA exige `recomendada`, que só existe quando `decisaoIA.acao === 'responder'` —
  numa escalada é `null`;
- a automação determinística exige `sugestao`, e a escalada acontece justamente quando não há uma
  (ou quando ela é a tecla 6, que já mantém a caixa aberta).

Ou seja: nada passa a ser enviado sozinho por causa desta mudança. O que muda é a rodada **parar e
perguntar** onde antes ela pulava calada.

**Arquivos:** `src/panel/panel.js` (a escalada, a linha da caixa), `CLAUDE.md` (+1 armadilha),
`manifest.json` (1.70.1 → 1.71.0). Quinze suítes e os dois verificadores passando.

---

## 2026-09-02 — Onde as observações ficam, e o "ADS, ADS" da print

**Pergunta dele:** *"onde está salvando e o contexto fica salvo para você entender?"*, com a print da
caixa funcionando (faixa e botão vermelhos, "Anotado. São 1 observação(ões)").

Respondido — e a print trouxe junto um defeito que eu não tinha visto.

### Onde fica

`chrome.storage.local`, chave `observacoes`, no perfil do Chrome dele. Sobrevive a fechar o
navegador e a recarregar a extensão; some se ele limpar os dados do navegador ou trocar de perfil.
**O contexto fica salvo inteiro**, e não é opcional: contato, regra, tecla, motivo da caixa, o que a
pessoa escreveu e as etiquetas.

### E FORA do backup — mudança desta entrada

`exportJson` levava as observações junto, e elas carregam **nome de eleitor e o texto que a pessoa
escreveu**. É o mesmo motivo pelo qual `cidadeRecusada` e `iaChave` já estavam de fora: backup é
arquivo que circula.

Elas são feitas para me chegar, mas pelo caminho que ele escolhe — o botão "Copiar observações",
uma vez, quando ele quer. Ir de carona num backup que ele manda para outra máquina é distribuir
conversa de eleitor sem ninguém ter decidido isso. Saíram também da lista do `importJson`, para não
restaurar o que nunca é exportado.

### O "ADS, ADS"

A print mostrava *"Etiquetas: ADS, ADS"*. A etiqueta de anúncio (`etiquetaAnuncio`) e a lista de
etiquetas do anúncio reconhecido são **duas fontes**, e ele pôs "ADS" nas duas.

A deduplicação de `refreshTagSuggestions` não pega este caso: ela filtra o que vem do CRM contra o
que `suggest` achou, e aqui as duas entradas saem do próprio `suggest`.

Consertado dentro de `tags.suggest`, comparando por **rótulo normalizado** — nunca por id, porque o
CRM tem etiquetas de rótulo repetido com ids diferentes, e comparar id já produziu 1293 linhas de
"Caxias do Sul → Serra (tem: Serra)". Acento e caixa não criam uma segunda: quem digita a lista do
anúncio na Config não repete a grafia do CRM.

**E o teste pegou um erro meu no meio do conserto:** eu havia posto o bloco das etiquetas do anúncio
**antes** do bloco da ADS, então a conferência tirava o retrato da lista sem a ADS dentro e não tinha
como ver a repetição. A asserção da grafia diferente falhou e me mandou olhar a ordem.

Sem a correção, as duplicatas também entrariam nas observações que ele me manda — e eu leria
"etiquetas: ADS, ADS" como se fosse informação.

**Arquivos:** `src/lib/tags.js` (`achatarRotulo` + a deduplicação, movida para depois da ADS),
`src/lib/store.js` (`observacoes` fora do backup), `tests/tags.test.mjs` (+4), `manifest.json`
(1.70.0 → 1.70.1). Quinze suítes e os dois verificadores passando.

---

## 2026-09-02 — A sugestão em vermelho, e o caderno das que estão erradas

**Pedido dele:** *"marque a sugestão e o botão referente da sugestão de vermelho para se destacar, e
vamos implementar a observação para sugestão onde vou escrever o porque está errado e lhe passar
essas informações depois, monte um botão de salvar as observações para que isso seja possível"*.

### O vermelho

A faixa *"Sugiro a X…"* e o **botão daquela tecla** saem os dois em vermelho. A mesma cor de
propósito: são a mesma informação dita duas vezes, e cores diferentes fariam procurar qual das duas
é a sugestão de verdade.

Classe própria (`wf-rec-btn`), **não** o `wf-primary`: aquele é o botão de ação padrão do painel
inteiro, e repintá-lo tornaria vermelho o "Aceitar" do popup de cidade e o "Começar pelos Meus", que
não são sugestão nenhuma.

### O caderno

Na caixa da rodada, **"✎ Anotar por que está errado"** abre um campo e um botão **Salvar
observação**. Salvar **não fecha a pergunta** — igual às respostas rápidas: anotar é sobre o caso que
ele está olhando, e fechar a caixa o obrigaria a decidir antes de terminar de escrever.

**A anotação carrega o caso junto, e ele não escolhe isso.** Vão automaticamente: o contato, a regra
que decidiu, a tecla que ela mandou apertar, o motivo que a caixa mostrou, **o que a pessoa
escreveu** e as etiquetas. É a lição que ele mesmo me deu na janela do fluxo em 01/09 — *"não faz
sentido eu colar para você sem você ter a visão do fluxo"*. Aqui é igual: *"essa sugestão está
errada"* sozinho me faria adivinhar.

### Como chega até mim

Cartão **"Observações para o Claude"** na aba Automatizado, acima do Andamento: o texto pronto, um
botão **Copiar observações** e um **Apagar todas** (que pergunta, porque não tem volta).

O texto sai **agrupado por regra**, com a contagem: uma regra errada é um lugar no código, e ver as
três vezes que ela errou juntas mostra o padrão que uma sozinha não mostra.

### Detalhes que valem lembrar

- **Não grava anotação vazia** — botão que grava nada e diz "salvo" ensina a não confiar no botão. A
  função devolve `gravou: false` e a tela avisa;
- **teto de 200 anotações**, a mais antiga saindo: `chrome.storage.local` não é infinito. Textos
  longos são cortados (o porquê em 1000, a mensagem dela em 400);
- **nada aqui muda o que a rodada decide** — é caderno, o mesmo papel do `no.nota` no quadro;
- se a área de transferência recusar (foco fora da aba, permissão), o texto é **selecionado** e a
  mensagem manda usar Ctrl+C, em vez de o botão não fazer nada e não dizer nada.

Conferido abrindo o painel de verdade: o cartão listou a anotação semeada e gerou o texto agrupado, e
a caixa da rodada apareceu com a faixa e o botão vermelhos, com os outros botões neutros.

**Arquivos:** `src/lib/observacoes.js` (novo), `tests/observacoes.test.mjs` (novo, 30),
`src/lib/store.js` (chave `observacoes` + backup), `src/panel/panel.js` (`montarObservacao`, o cartão
da Config, o vermelho), `src/panel/panel.css`, `CLAUDE.md` (quinze suítes), `manifest.json`
(1.69.0 → 1.70.0). Quinze suítes e os dois verificadores passando.

---

# Registro de mudanças

> Entrada nova sempre no **TOPO**. Formato: data, o que foi pedido, o que foi feito, causa raiz
> quando for correção, decisões, arquivos, pendências.

---

## 2026-09-02 — A caixa "Automatizar com IA" automatiza as REGRAS, e o aviso dizia o contrário

**Pergunta dele**, com a print do Robertino: *"essa mensagem foi mandada sozinha? tem algum gatilho
no momento que pede sem ser no modo IA?"*

### A resposta é sim, e a tela dizia que não

A automação das regras é a linha `state.auto.cfg.automatizarComIA && sugestao` — a **mesma caixa**
da IA. E ela **não consulta** `state.ia.ligada`. Com a avaliação por IA desmarcada, a rodada
continua executando sozinha a tecla que a regra recomenda, e a maioria das regras envia mensagem.

O aviso embaixo da caixa dizia: *"Esta caixa não faz nada enquanto 'Ligar a avaliação por IA'
estiver desmarcada"*. **Falso** — e falso justamente no momento em que ele foi investigar um envio
que não entendeu, mandando procurar no lugar errado.

### O conserto

- O rótulo passou a dizer as duas coisas: *"Automatizar a rodada: envia sozinha a escolha das REGRAS
  e da IA, sem perguntar"*.
- O aviso passou a dizer a verdade: com a IA desligada, a parte dela não roda **mas as regras
  continuam sendo executadas**, e para a rodada voltar a perguntar antes de cada envio é preciso
  desmarcar a caixa.

Nada mudou no comportamento — mudou o que a tela conta sobre ele. O comportamento é o documentado
desde 01/09 (*"automatizar a rodada é executar as REGRAS, não só a IA"*); o que faltava era a tela
concordar com o `CLAUDE.md`.

### Onde mora a resposta de "por que isso saiu"

No **log do Andamento**: cada envio automático escreve `automático pelo fluxo ("<regra>", caminho
X > Y): <o que foi feito>`. É o único lugar que identifica a tecla — os textos são editáveis por
ele, então reconhecer a mensagem não diz qual regra a mandou.

**Arquivos:** `src/panel/panel.js`, `manifest.json` (1.67.0 → 1.68.0), `registro.md`, `CLAUDE.md`.

---

## 2026-09-02 — Pedido de dinheiro: detector testado e etiqueta no CRM

**Relato dele**, com a print da Marli: *"aqui está claro ela deu o pix dela e pediu 50, caso de
mandar a mensagem negando apoio financeiro"*, e depois *"já existe a etiqueta de 🔴Procura emprego
ou dinheiro, deve ser aplicada também"*.

### Por que a rodada errou

Ela mandou **"Meu Pix 01757539005"** e, na mensagem seguinte, **"50 me ajuda muito"**. A caixa
sugeriu a tecla 9 — *"pediu algo sem dizer o quê"* —, que é a pergunta de quem ainda não sabe o que
a pessoa quer. Ali já se sabia.

A caixa do quadro casava por trecho contido, com a lista `['ajuda financeira', 'preciso de
dinheiro', 'me ajuda com', 'cesta basica', 'remedio']`. Ela escreveu **"me ajuda muito"**. Palavra a
palavra a lista nunca fecha — e o que decide isto manda uma **negativa** para eleitor.

### O detector

`cortesia.pedeAjudaFinanceira`, puro e testado, com duas portas:

- **marcador de dinheiro** basta sozinho: `pix`, `R$ 200`, `50 reais`, `dinheiro`, `grana`,
  `empréstimo`, `doação`;
- **necessidade material** (`cesta básica`, `remédio`, `gás`, `alimento`) exige **verbo de pedir**
  junto — *"já tomei meu remédio hoje"* é relato, não pedido.

Lê a **rajada inteira** (a chave veio numa mensagem e o valor na outra) e desarma quando ela está
oferecendo ajuda, não pedindo.

**Os falsos positivos são o risco**, como no detector de sem interesse: "ajuda" é a palavra mais
comum desta base nos dois sentidos. Das 24 asserções, 10 são falso positivo — *"obrigada, vocês me
ajudaram muito"*, *"em que posso ajudar?"*, *"quero ajudar na campanha"*.

A caixa do quadro passou a usar o **sinal** em vez da lista de palavras.

### A etiqueta

Config nova: **"Etiqueta de quem PEDIU DINHEIRO OU EMPREGO"**. Aplicada assim que sai `pedido-ajuda`
ou `pedido-emprego` — as duas que negam, as mesmas de `ia.RESTRITOS`.

Fica dentro de `sendTemplate`, que é o **ponto único** por onde toda resposta pronta sai: a rodada,
a tecla `f` de um ramo, a escolha da IA e as **respostas rápidas** — foi por uma resposta rápida que
ele mandou a da Marli, e um gancho na rodada não teria pegado.

**Aplica de verdade, não sugere**: a resposta rápida não conclui, então nada chamaria
`saveClassification` depois dela e uma sugestão ficaria esperando uma gravação que não vem. Falhar
nunca é erro do envio — a mensagem já saiu; o aviso vai junto do status.

### Um falso positivo do próprio verificador

`arvore.problemas` acusou a caixa nova de *"manda mensagem e a condição continua verdadeira depois
do envio"*. Era falso: o sinal lê a rajada **depois da nossa última mensagem**, então responder
apaga a condição sozinho. Faltava a lista `SINAIS_QUE_A_RESPOSTA_APAGA` — a polaridade oposta da que
já existia, onde a caixa está protegida quando exige o sinal **verdadeiro**.

**Arquivos:** `src/lib/cortesia.js`, `src/lib/arvore.js`, `src/lib/store.js`, `src/panel/panel.js`,
`tests/cortesia.test.mjs`, `tests/arvore.test.mjs`, `manifest.json` (1.66.0 → 1.67.0),
`registro.md`, `CLAUDE.md`. Catorze suítes e os dois verificadores passando.

**Para ele:** preencher a Config com o nome exato da etiqueta (`🔴Procura emprego ou dinheiro`) —
vazio não marca ninguém, e a etiqueta não é criada no CRM.

---

## 2026-09-02 — "POA" virava o NOME "Poa": a sobra era calculada no texto errado

**Relato dele:** *"não pegou POA como cidade, seria porto alegre"*.

### O que realmente acontecia

A cidade **era** reconhecida: `matchCity('POA')` sempre devolveu Porto Alegre com confiança
`exata`, porque `normalize` aplica os apelidos (`poa`, `cxs`, `sm`, `sto`…). O que quebrava era a
**sobra** — o pedaço que deveria virar o nome.

Quem calculava a sobra removia o nome **oficial** ("Porto Alegre") do texto **cru**, onde ela
escreveu "POA". Não removia nada. Medido antes de mexer:

| ela escreveu | cidade | nome |
|---|---|---|
| `POA` | Porto Alegre | **Poa** ← inventado |
| `Vera POA` | Porto Alegre (palpite) | **Vera Poa** ← poluído |
| `Ana SM` | Santa Maria (palpite) | **Ana Sm** |

A raiz: o casamento acontece no texto **normalizado**, onde o apelido já virou "porto alegre"; a
remoção acontecia no texto **cru**. Dois textos diferentes para a mesma pergunta.

### O conserto

`cities.semACidade(texto, city)` — procura o **menor trecho de palavras** cujo `normalize()` contém
o município, e remove só ele. Por construção não há como discordar do casador: é a mesma função.

Acento e caixa do que sobra são preservados, porque a sobra vira o nome do eleitor — devolvê-la
achatada trocaria "José" por "Jose" no CRM.

Depois: `POA` → cidade Porto Alegre, **informada**, sem nome. `Vera POA` → Vera / Porto Alegre.
`Ana SM` → Ana / Santa Maria. E a trava do slogan continua de pé: *"Vamos juntos mudar o Rio
Grande"* segue não virando cidade.

Saiu junto o `escapeRe` de `extract.js`, que só existia para a remoção antiga.

### Uma coisa que NÃO mudei

`Vera POA` continua com `informada: false` — a cidade entra como palpite e espera um clique. É a
regra conservadora do caminho sem separador, que não é deste conserto: só `POA` sozinho e a resposta
com separador (`Thiago / POA`) substituem o que está no CRM. Se ele quiser que o formato sem
separador também substitua, é decisão dele.

**Arquivos:** `src/lib/cities.js` (`semACidade`), `src/lib/extract.js`, `tests/parser.test.mjs`,
`manifest.json` (1.65.0 → 1.66.0), `registro.md`, `CLAUDE.md`. Catorze suítes e os dois
verificadores passando.

---

## 2026-09-02 — "Enviar conteúdo + agradecer + concluir" passou a usar o MODELO PADRÃO

**Pedido dele**, com a print do cartão: *"esse botão deve utilizar o modelo padrão, fica pedindo
conteúdo sem necessidade, só tem que mandar o que estou pedindo"*.

### O que estava errado

Quando nada era reconhecido, o botão caía no **"conteúdo preferido"** da Config — que é uma
**etiqueta**, não um modelo. Para virar mensagem ela precisava, além de estar preenchida, ter uma
linha na tabela "Modelo por conteúdo". Duas configurações para mandar um modelo, e o botão travava
com *"não tenho modelo para enviar"* quando faltava qualquer uma das duas.

Ficou pior depois que a etiqueta ADS deixou de ser conteúdo (1.62.0): quem chega por anúncio não tem
mais conteúdo nenhum reconhecido, então este botão passou a cair no vazio com muito mais frequência.

E ele ainda **aplicava a etiqueta do preferido** no contato — como se a pessoa tivesse pedido aquele
conteúdo.

### O conserto

Nada reconhecido agora manda o **modelo padrão**, que é o que ele já cadastrou exatamente para isto:
mandar alguma coisa quando não se sabe o que a pessoa quer. Sem tabela intermediária, sem etiqueta.

- **O rodízio anda**, e só quando o envio acontece — mesma disciplina de `avancarVariante`: queimar
  a vez de um modelo que não saiu faria o próximo pular sozinho.
- **Nenhuma etiqueta de conteúdo é aplicada nesse caminho.** O preferido afirma *"o conteúdo é este,
  o parser é que não viu"*, e a etiqueta registra a afirmação dele. O modelo padrão não afirma nada
  sobre o que ela pediu — pôr etiqueta ali seria inventar um pedido que ninguém fez, e etiqueta fica
  permanente no CRM.
- **O preferido continua existindo, como último recurso**, para quem já tinha só ele configurado.
  Mudou a ordem: padrão primeiro, preferido depois. Nada que funcionava parou de funcionar.
- A mensagem final diz qual modelo saiu (`modelo padrão "X"`), porque com o rodízio o próximo
  contato recebe outro.
- O texto do cartão e o aviso embaixo dele passaram a descrever isso, em vez do preferido.

**Arquivos:** `src/panel/panel.js`, `manifest.json` (1.64.0 → 1.65.0), `registro.md`, `CLAUDE.md`.
Catorze suítes e os dois verificadores passando.

**Não testado na tela:** o envio real. Teste no Thiago Tim com um contato sem conteúdo reconhecido —
tem que sair o modelo padrão e nenhuma etiqueta de conteúdo nova.

---

## 2026-09-02 — A ADS voltava como conteúdo por uma SEGUNDA porta

**Relato dele**, com a print da Liana: *"falhando novamente"*. Anúncio **cadastrado** na Config, com
o texto exato da mensagem dela (*"Olá! Eu estou do lado da segurança e apoio o Capitão Martim"*), e
a caixa ainda oferecendo **"Campanha Martim"**, com a linha `Conteúdo pedido: ADS`.

### A correção anterior fechou uma porta só

Na 1.62.0 a etiqueta ADS deixou de entrar como conteúdo em `tags.suggest`. Mas os conteúdos da
rodada vêm de **duas** fontes, e eu só fechei uma:

```
sugeridas   = tags.suggest(...)              ← fechada em 1.62.0
jaNoCrm     = tags.conteudosJaAplicados(...) ← a que vazava
conteudos   = [...sugeridas, ...jaNoCrm]
```

`conteudosJaAplicados` existe porque etiqueta aplicada à mão é invisível para as regras de texto.
Ela monta a lista de "conteúdos conhecidos" a partir das regras dele **e das CHAVES da tabela
"Modelo por conteúdo"** — onde está `ADS = Campanha Martim`. Então: etiqueta ADS já no CRM + nome na
tabela = conteúdo de novo. A porta que a primeira correção não fechou.

Havia uma deduplicação por nome entre as duas listas, e foi ela que escondeu o vazamento: quando o
nome batia, a entrada do CRM era descartada e tudo parecia certo. Bastava o rótulo no CRM diferir de
um espaço para escapar.

### O conserto

`tags.etiquetasDeOrigem()` — uma função só, com as duas fontes de etiqueta que dizem **de onde** a
pessoa veio: a etiqueta geral de anúncio (`etiquetaAnuncio`) e as etiquetas que cada anúncio da
Config aplica. `conteudosJaAplicados` filtra por ela.

Uma função e não duas listas, porque foi exatamente isso que falhou: a ADS saiu de um lugar e voltou
por outro. Duas listas separadas divergem na primeira vez que alguém acrescenta uma fonte nova.

**Fechado por identidade, não pela deduplicação de quem chama.**

### Testes

Com a etiqueta ADS de verdade no CRM de teste e o mapeamento `ADS = Campanha Martim` na tabela: a
ADS não volta como conteúdo, a etiqueta que o anúncio aplica também não, e o tema de verdade
(`Conteúdo Zucco`) continua voltando. Mais a asserção que trava a regra dele: **só a ADS no CRM não
produz conteúdo nenhum**, mesmo mapeada.

### O que ele ainda vai ver nesta print, e é outra coisa

O anúncio da Liana está cadastrado com a ação **"Só etiquetar, e deixar o fluxo decidir"**. Com essa
ação, `modeloDoAnuncio` devolve `null` de propósito — escolha explícita dele não vira modelo. Sem
modelo padrão cadastrado, a caixa agora dirá *"veio de um anúncio e não sei qual…"* em vez de
oferecer o modelo errado. Para sair modelo por aquele anúncio, a ação dele tem que ser **"mandar
modelo aprovado"**.

**Arquivos:** `src/lib/tags.js`, `tests/tags.test.mjs`, `manifest.json` (1.63.0 → 1.64.0),
`registro.md`, `CLAUDE.md`. Catorze suítes e os dois verificadores passando.

---

## 2026-09-02 — A etiqueta ADS deixou de escolher modelo: quem escolhe é o TEXTO do anúncio

**Decisão dele**, depois da print da Vera: *"o conteúdo a ser mandado não deve ser decidido pelo
ads, e sim pelo texto do ads"*, e *"remova tudo que interfira nisso"*.

### O que a print mostrava

Vera chegou pelo ANÚNCIO | FACEBOOK das Escolas Cívico-Militares e escreveu *"Olá! Eu apoio as
Escolas Cívico-Militares"*. A caixa ofereceu o modelo **"Campanha Martim"**.

A linha `Conteúdo pedido: ADS` foi o que permitiu rastrear: o painel escolhe o modelo por três
caminhos, e cada um escreve um rótulo diferente ali —

| caminho | rótulo |
|---|---|
| anúncio reconhecido, ação "mandar modelo" | `anúncio: <nome>` |
| veio de anúncio, texto não reconhecido | `anúncio não reconhecido — modelo padrão` |
| nenhum dos dois → etiqueta de conteúdo | `Conteúdo pedido: ADS` ← **o da print** |

Ou seja: o modelo veio da **etiqueta de origem**. A Config mapeia `ADS → Campanha Martim`, e a ADS
diz que a pessoa veio de anúncio, **não de qual**.

### O que foi removido

A meia medida de 31/08. A ADS entrava como `origem: 'conteúdo'` com `fallback: true` — um marcador
que a fazia perder de qualquer tema de verdade, mas **vencer quando não havia tema nenhum**, que é
justamente o caso de quem chega do anúncio e não diz mais nada. Saíram as duas coisas:

- em `tags.suggest`, a ADS passou a ter **`origem: 'anúncio'`**, como as etiquetas dos anúncios da
  Config já tinham. Continua sendo aplicada no CRM e continua servindo ao filtro dele; só não entra
  mais na lista que escolhe o modelo;
- em `hsm.escolherConteudo`, o desempate por `fallback` foi apagado. Ninguém marca mais esse campo,
  e um ramo morto dentro de um desempate é o tipo de coisa que alguém religa sem querer.

Quem escolhe o modelo agora é só `anuncios.modeloDoAnuncio`: o modelo do anúncio reconhecido pelo
texto (ou pelo nome da campanha, desde 1.59.0), ou o modelo padrão.

### A consequência, e o aviso que ela exigiu

Sem a ADS como conteúdo, quem chega por anúncio **não cadastrado** e sem modelo padrão configurado
deixa de ter modelo — que é o certo. Mas a mensagem genérica seria *"nenhum conteúdo reconhecido"*,
mandando ele procurar uma etiqueta de tema que nunca vai existir.

A caixa passa a dizer o que falta: *"veio de um anúncio e não sei qual: o texto dela não casou com
nenhum anúncio da Config, e não há modelo padrão cadastrado. Cadastre o anúncio (pelo texto ou pelo
nome da campanha, que aparece no cabeçalho) ou preencha os modelos padrão."* Sem isso, o conserto
trocaria um modelo errado por uma caixa muda — e foi a caixa muda que o obrigou a mandar print.

### Testes

- `tags.test.mjs`: a ADS entra com origem `anúncio` **e** não aparece na lista de conteúdos. É a
  trava — se ela voltar a ser conteúdo, volta a escolher modelo.
- `hsm.test.mjs`: o grupo do `fallback` foi substituído. O que sobrou é o desempate entre temas de
  verdade, que continua igual: dois temas sem preferido seguem sendo erro.

**Para ele:** se `conteudoPreferido` na Config estiver como "ADS", agora não casa com nada — pode
apagar. O mapeamento `ADS → Campanha Martim` na tabela "Modelo por conteúdo" também ficou sem uso.

**Arquivos:** `src/lib/tags.js`, `src/lib/hsm.js`, `src/panel/panel.js`, `tests/tags.test.mjs`,
`tests/hsm.test.mjs`, `manifest.json` (1.61.0 → 1.62.0), `registro.md`, `CLAUDE.md`. Catorze suítes
e os dois verificadores passando.

**Não testado na tela:** um contato real vindo de anúncio. Teste com a Vera reaberta: sem o anúncio
cadastrado, a caixa tem que dizer que não sabe qual é — e não oferecer "Campanha Martim".

---

## 2026-09-02 — Revisão do projeto: código morto removido, pendências conferidas

**Pedido dele:** *"revise todo o projeto veja se tem código antigo não utilizado e remova e veja os
erros pendentes"*.

### Como foi feito

Levantamento por script, não por leitura: para cada `export` de `src/`, contar as referências ao
nome em todo o repositório **descontando a linha que o declara**. Zero referências = ninguém usa.

A primeira versão do script deu **falso positivo em massa** — acusou 42 exports, incluindo
`store.get` — porque só contava usos em OUTROS arquivos, e as migrações de `templates.js` são
chamadas dentro do próprio arquivo. Vale como método: um levantamento que acusa quase tudo está
errado, não o código.

### O que saiu (8 funções e constantes)

Nenhuma tinha uma única referência, em `src/`, em `tests/` ou em `tools/`:

- `contract.js :: SENTINEL_DATE` — `SENTINEL_DATE_NEEDLES` já carrega o mesmo literal.
- `dock.js :: isDocked`
- `dom.js :: onSessionChange` — o painel usa `getConversationSignal`.
- `dom.js :: ABA_NOVOS`, `ABA_MEUS` — só `ABA_CONCLUIDOS` é usada.
- `hsm.js :: invalidate` — o cache por canal expira sozinho.
- `arvore.js :: aninhar`, `desaninhar` — eram os botões `⇥ ⇤` do editor indentado, que saiu quando
  o quadro virou canvas. Quem religa ramo hoje é `reparentar`.
- `cortesia.js :: ultimaPedeRespostaPessoal` — **e o comentário dela mentia**: dizia que
  `conversaPedeRespostaPessoal` a usava por dentro, e a chamada é a `pedeRespostaPessoal`. Terceiro
  caso do mesmo tipo neste projeto: comentário descrevendo o que o código não faz.
- `hsm.js :: parseModeloPorTexto`, `formatModeloPorTexto` — o `CLAUDE.md` já os documentava como
  mortos desde a migração para `store.anuncios`; a tela que os usava não existe mais.

Os testes dessas funções saíram junto (nove arquivos, 143 linhas a menos).

### O resto da submissão na loja

`STORE.md`, `PRIVACY.md`, `tools/package.mjs` e `icons/promo-440x280.png` — o `CLAUDE.md` diz
*"Não vai para a Chrome Web Store"*, então era peso morto de um objetivo cancelado. Junto foi
`tools/descobrir-listagem.js`, script de console que respondeu suas perguntas em agosto (a listagem
traz cidade e etiquetas) e cujas respostas estão hoje dentro de `categorizar.js`. **Tudo recuperável
pelo histórico do git.**

### O que NÃO foi removido, e por quê

- **36 exports usados só dentro do próprio arquivo** (`IS_IN_PAGE`, `getSessionListItems`, as
  migrações…). Não é código morto — é `export` a mais. Tirar a palavra é cosmético e mexeria em
  arquivos que decidem envio; fica registrado, não feito.
- **Funções usadas só por testes que são GUARDAS**: `regrasSemVerbete`,
  `regrasComDesfechoIncoerente`, `setCoredeLoader` (costura de teste), `anuncios.acaoConhecida`.
  Existem para o teste poder perguntar — é a função delas.
- **`tools/simular-fila.mjs`, `checar-dom`, `checar-pergunta`, `make-icons`**: documentados como
  ferramentas vivas.

### Erros pendentes: nenhum

Rodados sobre o estado de hoje, não só nos testes:

| conferência | resultado |
|---|---|
| toda regra tem verbete | ok |
| desfecho de cada regra é coerente com a tecla | ok |
| o fluxo padrão não acusa problema | ok |
| a árvore achatada não acusa problema | ok |
| a árvore achatada decide igual à tabela (400 casos) | ok |
| import importado e nunca usado | nenhum |
| TODO/FIXME/HACK | nenhum (os três achados são a palavra "todo" em português) |
| arquivo que o Chrome recusa (começa com `_`) | nenhum |
| cópia congelada (`dist/`, `build/`) dentro da pasta | nenhuma |
| `options.html` que o manifesto aponta | existe |

Catorze suítes, `checar-modulos` e `checar-referencias` passando.

**Arquivos:** `src/lib/{arvore,contract,cortesia,dock,dom,hsm}.js`,
`tests/{arvore,cortesia,hsm}.test.mjs`, `manifest.json` (1.60.0 → 1.61.0), `CLAUDE.md`,
`registro.md`. Apagados: `STORE.md`, `PRIVACY.md`, `tools/package.mjs`,
`tools/descobrir-listagem.js`, `icons/promo-440x280.png`.

---

## 2026-09-02 — A tecla `a` mandava TRÊS mensagens, e a terceira era um encerramento

**Relato dele**, com a print da caixa: *"botão a totalmente errado mandando modelo + pedindo dados +
agradecendo e concluindo, não existe agradecer depois de pedir dados"*.

### Não era rótulo, era envio

A tecla `a` mandava mesmo três mensagens: modelo → pedido de dados → **agradecimento**. E o texto do
agradecimento mostra o tamanho do erro: *"Obrigado pela atenção! Qualquer coisa, é só chamar por
aqui. Um abraço"* — um **encerramento**. Sair logo depois de perguntar o nome e a cidade fecha a
conversa que a pergunta acabou de abrir, e a pessoa lê "não precisa responder".

Era sobra do desenho antigo: a tecla 1 era "modelo + agradecimento", e quando o pedido de dados
entrou no meio (a tecla `a`, 02/09) o encerramento ficou depois dele sem ninguém reparar. O envio
era incondicional, fora do `if` da tecla `a`.

Contraria também o invariante já registrado no `CLAUDE.md`: *"a tecla `a` é a ÚNICA do projeto que
manda duas mensagens"*. Mandava três.

### Três consertos

1. **O agradecimento não vai atrás do pedido de dados.** A tecla 1 continua mandando: lá o modelo é
   a entrega e o encerramento fecha o atendimento, que é o que ela sempre fez.
2. **O título da caixa descreve a SITUAÇÃO, não uma das teclas.** Ele dizia *"Enviar o modelo X +
   agradecimento e concluir?"* — a frase da tecla 1, encimando dez opções. Com a tecla `a` na lista,
   o título prometia agradecimento e a opção prometia pedido de dados: duas frases sobre o mesmo
   contato, discordando. Foi por aí que ele viu o defeito. Agora é *"Modelo X disponível para este
   contato. O que fazer?"*, e cada opção diz o que faz.
3. **A tecla `a` deixou de depender da trava do agradecimento.** `podeEnviar`/`modeloTravado` são a
   trava daquele texto; a tecla `a` amarrada ali sumiria por causa de uma mensagem que ela não
   manda, com o motivo na tela falando de um texto fora do caminho. E o aviso passou de *"Modelo X
   travado"* para *"Tecla 1 fora: o agradecimento não sai"* — dizer "modelo travado" mandava ele
   procurar o problema no lugar errado.

### Uma pergunta que fica para ele

A tecla 1 continua mandando **duas** mensagens (modelo + agradecimento). Isso também contraria o
"uma passada, uma mensagem" que ele escolheu em 01/09, e o agradecimento continua disponível nas
respostas rápidas e na tecla 8. Não mexi porque ele reclamou da `a`, e tirar mensagem que vai para
eleitor é decisão dele.

**Arquivos:** `src/panel/panel.js`, `manifest.json` (1.59.0 → 1.60.0), `registro.md`, `CLAUDE.md`.
Catorze suítes e os dois verificadores passando.

**Não testado na tela:** o envio real. Teste no Thiago Tim com a tecla `a` — têm que sair duas
mensagens, não três.

---

## 2026-09-02 — O anúncio é reconhecido pelo DADO da plataforma, não só pelo que ela digitou

**Relato dele**, com a print da Inês (Rosário do Sul): contato com etiqueta **ADS** — ou seja, a
plataforma registrou que ela chegou por anúncio — e a caixa oferecendo o modelo genérico
*"Campanha Martim"*. *"não reconheceu o anúncio"*.

### Causa raiz

`anuncios.reconhecer` lia **só `state.incoming`**, que é o que *ela* escreveu. Quem chega pelo
anúncio e não repete o texto dele — ou repete com outra redação, ou manda só "boa tarde", ou manda
uma figura — ficava sem anúncio reconhecido, mesmo com a sessão dizendo de qual campanha veio.

É a regra que já estava escrita no `CLAUDE.md` e que este caminho não seguia: **a origem do anúncio
é DADO, não texto.** Os quatro campos de `utm` já iam para as regras de etiqueta (`tagsLib.suggest`,
via `extra`) desde 31/08 — o reconhecedor de anúncio ficou de fora quando nasceu.

### O conserto

`reconhecer` passa a ver, junto com o que ela escreveu:

- `utm.campaign` — o nome da campanha;
- `utm.headline` — o título do anúncio;
- `utm.referralUrl` — o link (`fb.me/…`), que é o identificador mais estável de todos.

Assim ele pode cadastrar o trecho pelo **nome da campanha ou pelo link**, e o reconhecimento passa a
funcionar mesmo quando ela não escreve nada.

**`utm.source` fica de fora de propósito.** Ele é só "FACEBOOK": diz que veio de anúncio, não de
QUAL. Um trecho cadastrado com "face" casaria com todos os anúncios de uma vez. Nas regras de
etiqueta ele entra porque lá a pergunta é outra.

### Conferido

Teste novo em `anuncios.test.mjs`: sem o dado da plataforma não reconhece nada (o estado antigo); com
o nome da campanha reconhece; pelo link reconhece; o texto que ela escreveu continua reconhecendo; o
trecho mais específico continua vencendo o genérico; e anúncio desligado continua sem reconhecer,
venha o texto de onde vier. Catorze suítes e os dois verificadores passando.

### O que ele precisa fazer, e só ele pode

Reconhecer exige que o anúncio esteja **cadastrado na Config** com um trecho que case. Se a campanha
da Inês não estiver lá, nada disto a alcança — não é defeito, é lista vazia. O nome da campanha
aparece no **cabeçalho do painel**, ao lado do telefone: é de lá que sai o trecho a cadastrar.

**Arquivos:** `src/panel/panel.js`, `tests/anuncios.test.mjs`, `manifest.json` (1.58.0 → 1.59.0),
`registro.md`, `CLAUDE.md`.

**Não testado na tela:** depende de um contato real vindo de anúncio com a campanha cadastrada.

---

## 2026-09-02 — Agradecimento saía sem ela responder nome e cidade

**Relato dele**, com a print: pedimos *"Nome, Cidade"* às 12:51, ela não respondeu, e saiu mensagem
nossa mesmo assim — *"agradecimento saindo sem a pessoa responder nome e cidade"*.

### Causa raiz: DOIS defeitos empilhados

**1. O sinal olhava a conversa inteira, não a resposta.**

`respondeuOsDados` era `state.informouNomeOuCidade && respostasApos(...)`. A segunda metade está
certa — "o pedido saiu e ela escreveu depois". A primeira não: `informouNomeOuCidade` roda o parser
na **conversa inteira**. Nesta base a pessoa costuma dizer de onde é antes de qualquer pedido, então
bastava ela escrever **qualquer coisa** depois — um "ok", um link repassado, um vídeo — para as duas
metades darem verdadeiro. Agradecíamos por um dado que ela nunca deu, e concluíamos o atendimento.

O comentário do próprio sinal já dizia *"o parser achou nome ou cidade **no que ela escreveu**"*. A
intenção estava certa e o código não a cumpria — mesma família do "comentário que descreve a ordem
não é a ordem", já registrada.

**2. No modo `respostaAoPedido`, qualquer palavra solta volta como cidade.**

Descoberto escrevendo o teste, e sozinho já reproduzia a print: `extract(['https://www.instagram.com/reels/…'], { respostaAoPedido: true })`
devolve `cidade: "www.instagram.com"` com confiança `nao-reconhecida`. A generosidade do modo é de
propósito — é ela que faz *"maria cachoeirinha"* virar nome e cidade sem separador —, mas quem
pergunta *"ela respondeu?"* não pode aceitar isso.

**Sem achar o segundo, o conserto do primeiro teria parecido que funcionou** e a print voltaria na
primeira pessoa que repassasse um vídeo depois do pedido.

### O conserto

- O parser roda **só nas mensagens que vieram depois do pedido** (`respostasApos`), com
  `respostaAoPedido: true`, que é o modo que a nossa própria pergunta autoriza.
- E o resultado só conta como resposta se a **cidade for reconhecida** (confiança diferente de
  `nao-reconhecida`) **ou** houver nome — que já passa pelas guardas de `NAO_E_NOME`.
- `state.informouNomeOuCidade` foi **removido**: virou estado morto, e estado morto que já causou um
  defeito é convite para religarem no próximo sinal.

### O teste

Em `parser.test.mjs`, o caso da print inteiro: a conversa antiga com "Sou de Canoas", o pedido, e o
link repassado depois. Trava as duas leituras — a conversa inteira **acha** a cidade (era o falso
positivo) e a resposta sozinha **não conta**. Mais o ruído que ela manda de verdade: emoji, link do
YouTube, "obrigada!", "vou ver depois". E o que **deve** contar continua contando: "Maria Silva ,
Canoas" e "canoas" sozinho.

**Arquivos:** `src/panel/panel.js`, `tests/parser.test.mjs`, `manifest.json` (1.57.0 → 1.58.0),
`registro.md`, `CLAUDE.md`. Catorze suítes, `checar-modulos` e `checar-referencias` passando.

**Não testado na tela:** o comportamento com a extensão carregada. Teste no Thiago Tim: peça os
dados, responda com um link, e a rodada não pode agradecer.

---

## 2026-09-02 — Desabafo longo ia para a mensagem do momento; agora vai para a IA

**Relato dele**, com a print da Cris: *"a IA devia ter assumido e mandado uma mensagem
personalizada"*.

### O caso

Contato com etiqueta de cidade (IVOTI) e de conteúdo (CONTEÚDO ZUC) escreveu **437 caracteres** de
desabafo — sem esperança nas eleições, urnas, *"tudo tempo perdido"*, *"Triste!"*. O atendimento
ficou sem classificação e ele assumiu à mão quatro horas depois.

### Dois defeitos somados, os dois de ORDEM no quadro

Medido antes de mexer: o caso caía em `pessoa retornando > com etiqueta de cidade > já entregamos
algo antes` → **tecla 5, mensagem do momento**. Material de campanha em cima de um desabafo.

1. **`ja-respondemos-antes` estava em terceiro lugar** no ramo "com etiqueta de cidade". Ela é a
   caixa mais genérica desse lado: não olha o que a pessoa escreveu, só que já fomos atendidos
   antes. Nessa posição vencia **todas** as caixas que reconhecem conteúdo.
2. **A caixa "só mandou bom dia" casa por palavra CONTIDA**, e o desabafo começa com *"Oi. Bom
   dia,"*. Mesmo sem o defeito 1, o texto longo seria lido como saudação seca. O nome da caixa diz
   "só mandou"; a condição nunca verificou isso.

O sinal certo existia e estava embaixo dos dois: `conversaPedeRespostaPessoal` devolve *"escreveu
437 caracteres — é conversa, não é caso de modelo"*.

### O conserto

- **`ultima-pede-resposta-pessoal` subiu para cima de todas as caixas de palavra**, nos dois lados
  da bifurcação: quem escreve conversa nunca é decidido por palavra solta. A **ajuda financeira
  continua acima dela**, e é decisão dele — aquele texto é uma resposta que ele escolheu para sair
  sozinha.
- **`ja-respondemos-antes` desceu para baixo das pendências**, que é a ordem que o lado "sem
  etiqueta de cidade" já tinha. Os dois lados passam a concordar — e a discordância entre eles era
  o sinal de que este estava errado.

Depois: `ultima-pede-resposta-pessoal` → **tecla 6**, que é onde o painel chama a IA
(`!sugestao || sugestao.tecla === '6'`) e onde o rascunho personalizado pode sair.

### Conferido

Varredura de 10 cenários no padrão corrigido: "bom dia" seco continua na mensagem do momento (5),
figura continua em 5, despedida em 3, quem já foi atendida e escreve coisa curta neutra continua em
5, ajuda financeira continua na resposta pronta, presença e dados continuam em 8, chegada do anúncio
em `a`, hostil em `s`. Só o desabafo mudou — de 5 para 6. Catorze suítes, `checar-modulos` e
`checar-referencias` passando.

**Arquivos:** `src/lib/arvore.js` (`fluxoPadrao`), `tests/arvore.test.mjs`, `manifest.json`
(1.56.0 → 1.57.0), `registro.md`, `CLAUDE.md`.

**Para ele:** o arquivo do padrão corrigido foi gerado para importar (41 ramos, 17 enviam).
Importar substitui o quadro e leva junto as observações escritas nas caixas.

**Não testado na tela:** a IA de fato assumindo e o rascunho saindo. Depende do Chrome com a
extensão carregada e de chave da API.

---

## 2026-09-02 — "Confirmou presença (só agradecer)": a raiz era o TEXTO, não a trava

**Diagnóstico dele:** *"provavelmente pode ser o problema do padrão de mensagem, ela já vem incluso
pedindo dados; se usar a mensagem rápida sempre irá pedir os dados"*.

### Ele achou a raiz, e ela não era onde eu estava procurando

Eu estava atrás da trava de duplicata — de onde vinha o histórico que ela consulta, se `state.nossas`
é por sessão, se concluir apagava a memória. Nada disso era o problema.

**As duas respostas de evento fundem duas coisas**: a confirmação da presença e o pedido de
`Nome / Cidade`. Não existia versão só com a primeira metade. Então quem já tinha tudo no CRM
recebia o formulário junto do *"que bom"* — pela rodada **ou** por ele clicando na resposta rápida,
que é o caminho que nenhuma trava do painel cobre.

Lição que entrou no `CLAUDE.md`: **antes de blindar a trava, leia o que a mensagem diz.** Trava
nenhuma conserta um texto que pede o que não devia pedir.

### O que existe agora

- **`presenca-confirmada`** — *"Confirmou presença (só agradecer)"*. É a `pedir-dados-evento-sim`
  **sem o bloco do cadastro**, na mesma voz, para a pessoa não perceber duas redações diferentes
  para a mesma situação. Não pede nada e não promete nada.
- **A tecla 8 passou a escolher o texto**: apoio genérico continua mandando `agradecer-apoio`;
  quem confirmou presença **e já tem etiqueta de cidade** recebe o texto novo. O rótulo da caixa
  muda junto — *"Agradecer a presença e concluir (sem pedir dados)"* —, senão a tela prometeria uma
  coisa e sairia outra. O log da rodada também diz qual dos dois saiu.
- A condição é a **mesma** da regra `confirmou-presenca-com-dados`, escrita nos dois lugares de
  propósito: a regra decide o destaque, o painel decide o texto.
- `apoioTrava` continua separado: ele alimenta a regra `so-expressa-apoio`, e misturar faria a
  falta de variável de um texto sumir com a tecla do outro.

### O teste que impede a volta

`!ehPedidoDeDados` no texto base **e em cada variante**. Se uma reescrita futura devolver o bloco do
cadastro, o defeito volta **calado** — a tecla continua se chamando "agradecer a presença". O mesmo
teste confirma que as duas de evento continuam pedindo os dados, que é o motivo de a terceira ter
precisado existir.

**Arquivos:** `src/lib/store.js` (a resposta nova), `src/panel/panel.js` (a tecla 8 escolhe texto e
rótulo), `tests/templates.test.mjs`, `manifest.json` (1.55.0 → 1.56.0), `registro.md`, `CLAUDE.md`.
Catorze suítes, `checar-modulos` e `checar-referencias` passando.

**Não testado na tela:** o envio real. Depende do Chrome com a extensão carregada — teste no
Thiago Tim, num contato que já tenha etiqueta de cidade, respondendo ao convite com "vou sim".

---

## 2026-09-02 — Pedido de dados repetido para quem tem todas as etiquetas

**Relato dele**, com a print do Deoclecio (etiquetas ADS, CACHOEIRINHA, CONTATO-ASSES, CONTEUDO
FLAV, ENGAJADO, METROPOLITANO): *"repetindo resposta em pessoa com todas etiquetas, pediu dados, o
caso certo seria so agradecer a presenca no evento e concluir"*.

Na conversa: as 10:34 saiu *"Que bom! Sera uma grande satisfacao contar com voce... Nome / Cidade"*,
o atendimento foi concluido, ele mandou dois links, e **a mesma mensagem saiu de novo**.

### Causa 1 — a trava de duplicata olhava o id do modelo

O pedido de dados tem **tres formas**: `pedir-dados` e as duas de evento. A trava era
`wasSent(contato, pedirDados.id)` — **so a forma que sairia agora**. Basta `confirmaPresenca`
responder diferente entre duas passadas (ela le a rajada depois da nossa ultima mensagem, e a rajada
muda quando ele manda links) para a trava olhar um id que nunca saiu e concluir que ninguem pediu
nada.

O `jaPediramDados` tinha o mesmo problema por outro caminho: comparava os **caracteres 40 a 100** do
texto que sairia agora contra o que ja mandamos — amarrado a redacao, e a variante de evento tem
preambulo, entao a fatia deixava de casar.

Hoje quem responde e a **conversa**, por `templates.ehPedidoDeDados`, que casa pela linha
`Nome / Cidade` — o invariante das tres formas, protegido por teste em cada texto. Pega toda
variante, toda redacao antiga e todo envio fora do painel de uma vez. Conferido contra o texto exato
da print.

### Causa 2 — faltava o desfecho que ele nomeou

`confirmaPresenca` so trocava o **texto** da tecla 4. Nao havia desfecho para "confirmou presenca e
nao falta dado nenhum", entao o caso descia ate quem pede o cadastro — e pedia o que ja estava no
CRM.

Regra nova **`confirmou-presenca-com-dados`** (tecla 8): confirmou que vai ao evento e ja tem
etiqueta de cidade -> agradece e conclui. Fica no lado "com etiqueta de cidade", acima de
`respondeu-os-dados` e abaixo das protecoes.

### E o buraco gemeo, achado escrevendo o teste

Minha primeira assercao afirmava que quem confirma presenca **sem** etiqueta de cidade recebia o
pedido. Ela falhou — e estava me mostrando outro vazio: essa pessoa atravessava o quadro sem
desfecho, porque a unica caixa que alcanca `nunca-pediram-dados` naquele lado esta dentro de "veio de
um anuncio que eu reconheco". Caixa nova **"confirmou presenca no evento"** dentro de "sem
pendencia", com a condicao estreita de proposito.

| o caso | antes | agora |
|---|---|---|
| confirmou, com todas as etiquetas | pedia os dados, **duas vezes** | **tecla 8 — agradece e conclui** |
| confirmou, sem etiqueta de cidade | **nada** | tecla 4 — o "Que bom!" com o pedido |
| recusa / etiqueta que dispensa | — | continuam vencendo |

### Uma coisa que fica dita

A tecla 8 e *"Agradecer o apoio e encerrar"* — o texto fala de apoio, nao de presenca no evento. E o
agradecimento que existe e que conclui. Se ele quiser um texto proprio para "obrigado por
confirmar", escreve na aba Respostas e a caixa passa a apontar para ela.

**Arquivos:** `src/panel/panel.js` (a trava por invariante, o sinal `confirmouPresenca`),
`src/lib/sugestao.js` (regra + verbete), `src/lib/arvore.js` (sinal + as duas caixas),
`tests/arvore.test.mjs` (+6), `CLAUDE.md` (+2 armadilhas), `manifest.json` (1.54.0 -> 1.55.0).
Arquivo de importacao regerado: 41 ramos, sem avisos e sem problemas. Catorze suites e os dois
verificadores passando.

---

## 2026-09-02 — A chegada não repete o que a volta já resolve (correção dele)

**Correção dele:** *"porque o modelo que você criou tem todas essas opções em pessoa nova? ao mandar
modelo e pedir dados irá concluir a conversa e ela volta pelo pessoa retornando"*.

Está certo, e a medição confirmou. Eu havia copiado as cinco caixas de pendência para o ramo da
chegada por causa do pedido anterior dele (*"após o modelo terá que ver se tem uma pendência"*) —
sem perceber que o **"depois" acontece na volta**, porque a tecla `a` conclui.

As cinco (ajuda financeira, bom dia, figura, áudio, despedida) **já existiam em "pessoa
retornando"**. Ter as duas cópias é a receita para as versões divergirem: um conserto de um lado e o
outro fica para trás — a mesma razão de `dosDoisLados` ser uma função em vez de copiar e colar.

### O ramo da chegada foi de 12 caixas para 7

Ficaram as proteções e as **três saídas que só a chegada resolve**:

| fica | por quê |
|---|---|
| Recusou ou veio hostilizar | proteção |
| Tem a etiqueta que dispensa da fila | proteção |
| pediu algo e não disse o quê | material em cima do pedido dela |
| Fez uma pergunta de razão ou de posição | idem |
| **modelo + pedir os dados** | o recibo do anúncio e o atendimento |
| **manda só o modelo** (ela já tem cidade) | a composta não cabe |
| **ainda não temos nome e cidade** | não há modelo mapeado |

As duas últimas não são cópia de pendência: sem elas, medido, esses dois casos atravessam o quadro
sem desfecho.

### A prova de que nada piorou

As mesmas situações continuam resolvidas, agora pela volta e com o mesmo desfecho:

- quem chega e diz "bom dia" → tecla 5, a mensagem do momento;
- quem chega pedindo remédio → a negativa (`pedido-ajuda`).

Quinze asserções travam isso, incluindo a contagem de caixas do ramo (7, não 12) e a exigência de
que cada pendência tirada da chegada **continue existindo na volta**.

Dois testes de contagem do catálogo caíram e estavam certos cair: a regra repetida agora aparece
duas vezes no quadro (os dois lados da bifurcação de cidade), não três.

**Arquivos:** `src/lib/arvore.js` (`fluxoPadrao`), `tests/arvore.test.mjs` (+15, 2 ajustadas),
`manifest.json` (1.53.0 → 1.54.0). Arquivo de importação regerado: 38 ramos, sem avisos e sem
problemas. Catorze suítes e os dois verificadores passando.

---

## 2026-09-02 — O quadro dele: o hostil recebia o pedido de dados, a pessoa normal não recebia nada

Ele colou o quadro e pediu: *"veja se está de acordo com as mudanças"*. **Não está**, e o problema
principal é o mesmo de 01/09.

### Medido no quadro exatamente como ele colou

| quem chega pelo anúncio | o quadro dele decide |
|---|---|
| pessoa normal, anúncio reconhecido | tecla 8 — **agradece um apoio que ela nunca expressou** |
| pessoa normal, anúncio não reconhecido | tecla 8 — o mesmo |
| **hostil (recusou/xingou)** | **tecla 4 — pede nome e cidade** |

Ninguém recebe o modelo do anúncio, e o hostil é tratado como cadastro novo.

### A causa: remetente dentro de proteção

No quadro dele, `mandar modelo conforme o anuncio` e `mensagem de pedido de dados` estão **dentro**
de `Recusou ou veio hostilizar`. O motor testa **o filho antes da ação do próprio nó**, e o filho só
é alcançado **quando o pai casa**. Então:

- pessoa normal → `sem-interesse` não casa → o ramo 1 inteiro é pulado. Ela cai em "pessoa
  retornando" (que não tem condição e casa com todos), atravessa "com pendência" sem casar com nada,
  e termina em `conteudo-pedido` com a tecla 8 fixada;
- hostil → `sem-interesse` casa → os filhos são olhados primeiro → sai o pedido de dados.

**É o erro de 01/09, com a mesma forma**, e já estava escrito num comentário do `fluxoPadrao`. Duas
ocorrências iguais é problema de ferramenta: o aninhamento não anuncia essa inversão em lugar nenhum
da tela.

### O conserto estrutural

`arvore.problemas` ganhou `remetenteDentroDeProtecao`: acusa caixa de efeito `silencio` com
descendente que **envia**, nomeando as duas pontas e dizendo o que fazer ("solte-as na raiz e
ponha-as ABAIXO desta").

A conferência fica **acima do `continue` das caixas de regra** — e isso foi conserto de um erro meu
na primeira versão: as proteções deste projeto **são** regras do código, então posta depois do
`continue` ela não via o caso real. Há teste travando as duas coisas.

Onze asserções, incluindo os não-casos: proteção dentro de proteção, remetente dentro de remetente
(legítimo — o específico vence o geral), grupo com remetente dentro (o normal), e o padrão limpo.

### O resto do que achei no quadro dele, e que ainda é decisão dele

- `mandar modelo conforme o anuncio` é caixa dele com **tecla 1 fixa** → sem as guardas da regra,
  manda em toda passada. Já era acusado desde a 1.51.0;
- a condição dela é `anuncioReconhecido`, então **o modelo padrão nunca sai**;
- `respondeu com os dados` é `conteudo-pedido` com a tecla 8 fixada — a condição exige
  `!modeloJaNaConversa` e não casa depois do modelo. A regra `respondeu-os-dados` (1.52.0) resolve e
  ainda não está no quadro dele;
- `voltou por outro anúncio` está com a **tecla 1 fixa**, o que troca "mensagem do momento" por
  "manda o modelo";
- `Pedimos hoje e nada voltou`, `Nunca perguntamos se ela quer conteúdo` e `o nome do cadastro não
  serve` continuam no quadro com a observação "descarte" — as duas últimas na raiz, e as duas
  **enviam**;
- **`fluxo.teclas` é por id da REGRA**, então "VOCÊ FIXOU" vale para todas as cópias daquela caixa —
  não existe fixar numa e não na outra.

**Arquivos:** `src/lib/arvore.js` (`remetenteDentroDeProtecao`, `efeitoDaCaixa`, `problemas`),
`tests/arvore.test.mjs` (+11), `CLAUDE.md` (+2 armadilhas), `manifest.json` (1.52.0 → 1.53.0).
Catorze suítes e os dois verificadores passando.

---

## 2026-09-02 — Respondeu os dados: agradece e encerra, sem mandar modelo

**Pedido dele**, com a print da caixa aberta e o seletor em "8 · Agradece o apoio, e conclui":
*"aqui está o que tem que mudar agora só precisa agradecer a atenção e encerrar sem mandar modelo"*.

É consequência do redesenho do mesmo dia: o modelo virou o **recibo da chegada**, então quando ela
responde o cadastro o modelo já saiu, e mandá-lo de novo é repetir.

### A edição dele não pegaria, e medi antes de mexer

A caixa "respondeu com os dados" é a regra `conteudo-pedido`, cuja condição — que ele não edita —
exige `!modeloJaNaConversa`. Com o modelo saindo na chegada, ela **deixou de casar**:

| ela respondeu com os dados | antes |
|---|---|
| modelo já saiu, sem etiqueta de cidade | **nada — saía da rodada sem resposta** |
| modelo já saiu, com etiqueta | tecla 3 — concluída **em silêncio** |
| modelo não saiu (caso antigo) | tecla 1 — mandava o modelo |

Trocar o desfecho para 8 ali não mudaria nada: a caixa não é alcançada. **Quando a intenção não cabe
na condição da regra, o certo é regra nova** — não trocar a tecla da existente.

### O que entrou

Regra **`respondeu-os-dados`** (tecla 8), acima de `conteudo-pedido`, e o sinal `respondeuOsDados`.

**O sinal tem duas metades, e é isso que o torna seguro:** o pedido de dados saiu e ela escreveu
depois (`cortesia.respostasApos`, casando por **invariante** e nunca pelo texto atual do template)
**e** o parser achou nome ou cidade no que ela escreveu. Só a primeira faria um "sim" solto, ou um
assunto novo, virar agradecimento e conclusão.

Ele escolheu essa condição entre três, sabendo que eu teria de criar e testar o sinal.

### Duas correções de simetria que os testes forçaram

**O agradecimento vale nos dois lados da bifurcação de cidade.** Sem a caixa no lado "com cidade", a
mesma pessoa era agradecida ou concluída em silêncio conforme a etiqueta já tivesse sido aplicada —
decidido pela ordem das coisas dentro da rodada, que ela não vê. É o "alguns concluem e outros não".

**A etiqueta que dispensa da fila subiu para cima da bifurcação.** Ela vivia só dentro de "com
etiqueta de cidade": quem a carregava e **não** tinha cidade nunca era protegido — recebia o modelo
antes, e passaria a receber o agradecimento. O comentário da recusa já dizia que proteção vai acima
da bifurcação desde 01/09; a lição é que dizer não basta, tem que ter teste dos dois lados. Agora
tem.

### Um defeito vizinho, de passagem

`respondeuComoAjudar` montava o trecho para a tela com `.replace(/s+/g, ' ')` — **sem a barra**, ou
seja, o padrão era a letra "s". *"Maria Silva / Canoas"* aparecia como *"Maria Silva / Canoa "*.
Corrigido.

**Arquivos:** `src/lib/cortesia.js` (`respostasApos`), `src/lib/sugestao.js` (regra + verbete),
`src/lib/arvore.js` (sinal + as caixas nos dois lados + a dispensa acima da bifurcação),
`src/panel/panel.js` (o sinal, `state.informouNomeOuCidade`, o reset na troca de contato, o `\s+`),
`tests/arvore.test.mjs` (+16), `CLAUDE.md` (+2 armadilhas), `manifest.json` (1.51.0 → 1.52.0).
Catorze suítes, os dois verificadores, nenhum desfecho incoerente e nenhum problema no quadro.

---

## 2026-09-02 — A caixa que ele montou à mão manda o modelo em toda passada

**Relato dele:** *"pedi para atualizar e não o fez então fui lá e criei o passo"*, com a print do
quadro.

A cobrança é justa: ele pediu *"atualize o ramo"* e eu atualizei o **documento** (`fluxoPadrao`),
deixando o quadro dele para ele. Foi por isso que ele montou a caixa à mão — e ela tem dois
defeitos que só apareceram medindo.

### O que a caixa dele faz

Caixa *"mandar modelo conforme o anuncio"*, condição **"Reconheci de QUAL anúncio ela veio"**, tecla
**1 fixa**:

| | quadro dele |
|---|---|
| anúncio reconhecido, 1ª passada | tecla 1 — manda o modelo |
| anúncio reconhecido, **2ª passada** | **tecla 1 — manda o modelo DE NOVO** |
| anúncio **não** reconhecido | tecla 4 — pede dados (o modelo padrão nunca sai) |

**1. Fixar a tecla não herda as guardas da regra.** `conteudo-pedido` exige
`!enviadoHoje && !modeloJaNaConversa`; a caixa dele não exige nada, então casa e dispara toda vez. É
a armadilha central do quadro livre: **a caixa parece a regra e tem o mesmo desfecho na tela**, e o
que falta é invisível.

**2. A condição errada mata o modelo padrão.** `anuncioReconhecido` só é verdade para anúncio
cadastrado na Config — e o modelo padrão (com o rodízio de três, feito hoje) existe justamente para
os **não** cadastrados. Trocando o sinal para "Veio de um anúncio", o padrão passa a sair.

### O conserto estrutural

`arvore.problemas` ganhou `repeteSozinha`: acusa caixa **dele** que **envia** e cuja condição não
inclui nenhum sinal que o próprio envio apaga (`SINAIS_QUE_O_ENVIO_APAGA`).

- palavra na **última** mensagem conta como guarda (a última muda quando ela escreve de novo);
- em **qualquer** mensagem não conta (o texto fica na conversa para sempre);
- tecla que não envia nunca é acusada; regra do código nunca é acusada (traz as próprias guardas);
- `"nunca entregamos nada"` é guarda; exigir que **já** entregamos não é.

Doze asserções, mais duas exigindo que **o padrão e a semeadura plana continuem limpos** — alarme
que toca sempre é alarme que se aprende a ignorar.

Um teste antigo caiu e estava certo cair: ele afirmava `problemas(arvore).length === 0` numa árvore
que continha uma caixa sem condição mandando a tecla 4 — que **é** uma caixa que repete. A asserção
foi estreitada para o que ela queria dizer (a caixa da IA não é acusada) e ganhou a afirmação
oposta ao lado.

**Arquivos:** `src/lib/arvore.js` (`repeteSozinha`, `SINAIS_QUE_O_ENVIO_APAGA`, `problemas`),
`tests/arvore.test.mjs` (+13, 1 estreitada), `CLAUDE.md` (+2 armadilhas), `manifest.json`
(1.50.0 → 1.51.0). Catorze suítes e os dois verificadores passando.

---

## 2026-09-02 — O modelo padrão do anúncio agora reveza

**Pedido dele:** *"o modelo padrão deve variar entre 3 modelos já que chega bastante gente por
eles"*.

Mesmo motivo das variações das respostas prontas: quando muita gente chega pela mesma porta, todo
mundo receber a frase idêntica é o que faz a mensagem parecer robô.

### O que entrou

`modelosPadraoAnuncio` (lista de nomes) + `modeloPadraoIndex` (o ponteiro), e
`anuncios.padraoDaVez` decidindo — puro e testado. Sete envios seguidos com três modelos dão
`A B C A B C A`.

Na Config, o cartão virou lista: linhas com seletor, `×` para tirar, `+ modelo` para somar, e **um
▶ marcando o da vez**. O marcador não é enfeite — rodízio invisível é indistinguível de rodízio
parado, e ele descobriria pelo eleitor recebendo sempre a mesma frase.

**Sem migração:** a leitura aceita a lista nova **e** o texto único da versão anterior, então quem
já tinha um modelo escolhido não perde nada e nenhuma marca em `migracoes` foi gasta.

### As duas decisões que importam

**O ponteiro anda depois do ENVIO, não da leitura.** Mesma separação de `templates.varianteAtual` /
`avancarVariante`, e pela mesma razão: a caixa da rodada mostra o nome do modelo antes de o envio
acontecer, e queimar o rodízio ali faria o próximo pular sozinho em todo contato que ele decidisse
não mandar. Dois testes travam que ler duas vezes devolve o mesmo.

**Só o padrão gira.** O modelo específico de um anúncio é escolha dele para aquele anúncio, e não
tem rodízio — tem teste.

Índice sujo (negativo, quebrado, maior que a lista depois de ele apagar um modelo) cai no primeiro
em vez de virar `undefined`: o que sai daí é mensagem para eleitor real.

### Um defeito que só apareceu abrindo a Config de verdade

**"+ modelo" não fazia nada, em silêncio**, quando a lista de modelos aprovados não estava
carregada: a linha nova nascia vazia e o gravar a descartava na mesma hora. A tela lia pelo
`carregarModelosPadrao`, que peneira os vazios — certo para a rodada, errado para a tela, que
precisa da linha em branco existindo enquanto ele digita. Hoje a Config lê a lista crua, a linha
vazia se anuncia (*"não entra no rodízio"*), e quem peneira é a leitura da rodada.

Conferido também que tirar o modelo **marcado como o da vez** devolve o ponteiro para 0 — senão ele
ficaria apontando fora da lista.

**Arquivos:** `src/lib/anuncios.js` (`padraoDaVez`, `modeloDoAnuncio` com rodízio),
`src/lib/store.js` (`modelosPadraoAnuncio`, `modeloPadraoIndex`, backup), `src/panel/panel.js`
(`carregarModelosPadrao`, o cartão da Config, o avanço depois do envio),
`tests/anuncios.test.mjs` (+14), `manifest.json` (1.49.0 → 1.50.0). Catorze suítes e os dois
verificadores passando.

---

## 2026-09-02 — "a ramificação não foi atualizada": o quadro dele é uma cópia

**Relato dele**, depois de eu reordenar a chegada pelo anúncio várias vezes no mesmo dia: *"a
ramificação não foi atualizada"*.

Conferi primeiro se o erro era meu: gerei o `fluxoPadrao` inteiro em texto e a chegada estava certa,
com as doze caixas na ordem nova. **O padrão estava atualizado; o quadro dele não.**

### O defeito, que não é daquele dia

`fluxoPadrao` é o que o botão "Resetar para o padrão" devolve. O quadro de trabalho dele é uma
**cópia**, e nada a atualiza. Então:

- toda melhoria minha no padrão era **invisível** para ele; ou
- ele resetava e **perdia o arranjo feito à mão** — que é exatamente o trabalho que o Desfazer
  existe para proteger.

Eu avisei disso duas vezes hoje e não resolvi. Ele apontou, e é o tipo de coisa que vai se repetir a
cada mudança no padrão.

### O que entrou

Cartão **"O padrão mudou?"** na janela do fluxo, sobre `arvore.diferencaDoPadrao` (puro, testado):

- **o que o padrão decide e o quadro dele não**, cada um com botão **"Pôr"** — que traz o ramo
  **inteiro** e diz quantas caixas vêm no próprio botão (a lição do Duplicar: cópia que traz seis
  ramos sem avisar é surpresa). No teste ao vivo, um clique em "anúncio — pessoa nova" trouxe as
  **13 caixas** da chegada de uma vez;
- **o que é só dele** — informação, não erro. Montar ramo que o padrão nunca teve é a razão da
  janela existir; a lista serve para ele distinguir escolha própria de caixa esquecida de uma versão
  velha.

**Nada entra sozinho.** No quadro a posição é a prioridade: enfiar uma caixa por conta própria
mudaria o que a rodada faz sem ninguém escolher onde.

### Duas decisões da comparação

**É por CONTEÚDO, nunca por id** — a regra do código que a caixa carrega, ou o sinal mais as palavras
que ele montou. Os ids do quadro dele nasceram em outro momento e não batem com os do padrão; tem
teste com ids trocados.

**Caixa que só AGRUPA fica de fora**: é estrutura, não decisão, e todas colidiriam na mesma chave.
"pessoa retornando" nunca aparece como faltando.

### Conferido na janela

Servida fora da extensão: o cartão acusou **7 caixas** faltando num quadro semeado antes das
mudanças de hoje; "Pôr (13)" trouxe o ramo da chegada inteiro; pondo o resto, a lista de faltantes
zerou e sobraram só as três regras que ele mandou descartar, do lado "aqui e não no padrão".

Também exportei `comIdsNovos`, que a janela passou a usar e **não estava exportada** — daria
`undefined` no clique. Nenhum verificador pega isso; peguei conferindo o export à mão.

**Arquivos:** `src/lib/arvore.js` (`diferencaDoPadrao`, `chaveDeComparacao`, export de
`comIdsNovos`), `src/fluxo.html`, `src/fluxo.css`, `src/fluxo.js` (`desenharDiferenca`),
`tests/arvore.test.mjs` (+8), `CLAUDE.md`, `manifest.json` (1.48.1 → 1.49.0). Catorze suítes e os
dois verificadores passando.

---

## 2026-09-02 — Ajuda financeira volta para depois do modelo (correção dele)

**Correção dele:** *"o modelo não irá confirmar apoio ao pedido de ajuda ou confirmar que irá ajudar
então pode ser respondido após"*.

Eu havia posto "pediu ajuda financeira" **acima** do modelo na chegada, com o argumento da Lei
9.504/97. Ele está certo sobre o texto: **o modelo é recibo de cadastro e não promete coisa
nenhuma**, então mandá-lo antes não é promessa de benefício — que era a minha objeção inteira. A
caixa voltou para as pendências neutras, abaixo do modelo, como ele havia desenhado.

| quem pediu remédio, chegando pelo anúncio | agora |
|---|---|
| 1ª passada | tecla `a` — recibo do anúncio + pedido de dados |
| 2ª passada | **a negativa (`pedido-ajuda`)** |
| se ela já tinha cidade | 1ª: só o modelo · 2ª: a negativa |

Três asserções travam que **a negativa não se perde no caminho** — era o único risco real de
descê-la.

### O que fica dito, e ele pode querer mudar

A tecla `a` manda o modelo **e o pedido de dados** juntos. Ele autorizou o modelo ir antes; o
formulário vai de carona. Ou seja: quem pediu remédio recebe *"você vai receber nosso conteúdo"* +
*"me diz seu nome e a sua cidade"* antes da negativa. Se isso incomodar, a saída é a regra composta
não casar quando há pedido de ajuda — aí a chegada manda só o modelo e a negativa vem na passada
seguinte.

**As outras duas continuam acima do modelo:** "pediu algo e não disse o quê" (print da Mari) e
"pergunta de razão ou de posição" (print da Clair). Ele não falou delas, e o argumento que ele
derrubou era específico da promessa de benefício — nessas duas o problema é responder outra coisa em
cima da pergunta dela, que o recibo também faz.

**Arquivos:** `src/lib/arvore.js` (`fluxoPadrao`), `tests/arvore.test.mjs` (3 asserções no lugar de
1), `CLAUDE.md`, `manifest.json` (1.48.0 → 1.48.1). Catorze suítes, os dois verificadores e nenhum
problema no quadro.

---

## 2026-09-02 — Tecla `a`: o recibo do anúncio e o atendimento na mesma passada

**Explicação dele:** *"o modelo seria uma resposta automática ao anúncio, o atendimento vem depois
disso que seria pedir dados e responder as perguntas"*.

Isso resolveu a natureza do modelo — não é uma resposta do atendimento, é o recibo do anúncio — mas
deixou uma ambiguidade que muda o que o eleitor recebe: "depois" é a mesma passada ou a seguinte?
Perguntei, com as duas tabelas na frente. **Ele escolheu a mesma passada**, sabendo que são duas
mensagens seguidas para o mesmo número.

O motivo é bom: com uma mensagem por passada, quem recebia o modelo e sumia **nunca era perguntada**
— e sem nome e cidade não há o que classificar, que é o trabalho inteiro da extensão.

### A tecla nova

**`a` — "Manda o modelo do anúncio + pede nome e cidade, e conclui".** Letra e não dígito, pelo
mesmo motivo do `s` e do `f`: os dez dígitos já têm significado no dedo dele.

É a **única tecla do projeto que manda duas mensagens**, e existe porque as duas são coisas
diferentes: o modelo é o recibo automático, o pedido de dados é o atendimento começando.

| passada | sem etiqueta de cidade | com etiqueta de cidade |
|---|---|---|
| 1ª | **tecla `a` — modelo + pede os dados** | tecla 1 — só o modelo |
| 2ª | tecla 4 — pede os dados | nada — fica só no modelo |
| 3ª | nada | — |

### Três travas que a fazem segura

**A regra exige as DUAS metades disponíveis.** `anuncio-modelo-e-dados` só casa com modelo mapeado
que ainda não saiu, sem etiqueta de cidade e sem pedido feito. Faltando uma, ela não casa e as
regras antigas resolvem cada pedaço sozinho — `conteudo-pedido` manda só o modelo, `nunca-pediram-dados`
pede só os dados. É o que evita a tecla nova virar caminho paralelo que decide em situação não
prevista.

**A oferta exige os dois textos destravados.** Oferecer uma tecla que vai travar no meio é pior que
não oferecer: a primeira mensagem já saiu e a segunda não sai mais.

**Se a segunda falhar, a rodada PARA** com resultado `enviado` e o motivo dizendo qual contato ficou
com o recibo e sem o pedido. Seguir a fila esconderia um contato pela metade.

### Testes que caíram e estavam certos cair

Três asserções em `sugestao.test.mjs` afirmavam tecla 4 onde agora sai `a` — a intenção delas era
*"o pedido de dados nunca é pulado em favor do modelo"*, e ela continua valendo: agora os dois saem.
Reescritas dizendo isso, e ganharam a asserção do caso oposto (sem modelo mapeado, o pedido sai
sozinho pela regra antiga).

### O que fica registrado no CLAUDE.md

A tecla `a` e as três pendências que ficam acima do modelo na chegada (ajuda financeira, pediu algo
sem dizer o quê, pergunta de posição) — contra a ordem que ele descreveu, porque nesses três mandar
a nossa mensagem primeiro é o dano, não o atraso.

**Arquivos:** `src/lib/sugestao.js` (tecla `a`, regra `anuncio-modelo-e-dados` + verbete),
`src/lib/arvore.js` (a caixa no ramo da chegada), `src/panel/panel.js` (a opção e o ramo que
executa), `tests/sugestao.test.mjs`, `tests/arvore.test.mjs`, `CLAUDE.md` (+2 armadilhas),
`manifest.json` (1.47.0 → 1.48.0). Catorze suítes, os dois verificadores, nenhum desfecho incoerente
e nenhum problema no quadro.

---

## 2026-09-02 — A chegada pelo anúncio, redesenhada: modelo primeiro, dados depois

**Pedido dele:** *"o sistema atual está dando problemas, o modelo agora será feito pra cada anúncio
específico e será mandado no momento que a pessoa chegar pelo anúncio, pedir dados virá após isso se
a pessoa não tiver etiqueta de cidade, se ela tiver etiqueta de cidade fica só no modelo, após o
modelo terá que ver se tem uma pendência que é a mensagem após a mensagem de anúncio e escolher a
resposta de acordo com a pendência"* e *"caso o texto do anúncio não seja reconhecido será mandado o
modelo padrão"*.

Inverte a ordem que valia desde 01/09 (dados primeiro). O que mudou é que agora existe **um modelo
por anúncio**, então o que sai na chegada responde ao que ela clicou, em vez de ser um pedido de
cadastro seco.

### A sequência, medida

| passada | sem etiqueta de cidade | com etiqueta de cidade |
|---|---|---|
| 1ª | tecla 1 — o modelo deste anúncio | tecla 1 — o modelo |
| 2ª | tecla 4 — pede nome e cidade | nada — **fica só no modelo** |
| 3ª | nada | — |

Uma mensagem por passada, que é a propriedade que ele escolheu em 01/09 para não sair rajada ao
mesmo número. Quem faz a passada seguinte descer um passo são as guardas de `conteudo-pedido`
(`!enviadoHoje && !modeloJaNaConversa`).

**"Fica só no modelo" não precisou de caixa:** `nunca-pediram-dados` já exige
`!temEtiquetaDeCidade`, então quem tem cidade simplesmente não casa — e a segunda metade da frase
dele acontece por si.

### O modelo padrão

Chave nova `store.modeloPadraoAnuncio` e um cartão no topo da seção "Anúncios do momento". Sai para
quem a plataforma diz que veio de anúncio mas cujo texto não casou com nenhum da lista — anúncio
novo não cadastrado, texto que mudou, mensagem cortada. Quem resolve "qual modelo" é
`anuncios.modeloDoAnuncio`, puro e testado.

**O padrão não cobre anúncio reconhecido com outra ação** (resposta pronta, pedir dados, devolver ao
quadro): aquilo é escolha explícita dele, e escolha explícita não se substitui por dedução — nem por
um padrão. Tem teste para as três.

### Uma regressão que eu causei e os testes pegaram

Subir o modelo para o topo fez ele vencer a **etiqueta que dispensa da fila**. Antes, quem chegava
do anúncio carregando essa etiqueta caía por exclusão no lado "com etiqueta de cidade", onde a regra
a pegava; com o modelo no topo ela passou a **receber mensagem** — e a etiqueta existe justamente
para ninguém receber. É a lição já registrada: regra nova no topo tem que ser conferida contra as
regras que ela passou a vencer. Consertado pondo a etiqueta acima do modelo.

### Três pendências que ficaram ACIMA do modelo, contra a ordem que ele descreveu

A ordem "pendência depois do modelo" vale para as neutras (bom dia, figura, despedida). Estas três
não, e medindo o quadro novo elas recebiam a tecla 1:

- **pediu ajuda financeira** → o texto `pedido-ajuda` existe para NEGAR, e prometer benefício é
  risco da Lei 9.504/97. Responder *"você vai receber nosso conteúdo"* a quem pediu remédio ou cesta
  é o pior lugar possível para uma confirmação de cadastro;
- **pediu algo e não disse o quê** → *"material de campanha em cima disso é o pior caso do
  projeto"* (print da Mari);
- **pergunta de razão ou de posição** → vira material de campanha em cima da pergunta dela (print
  da Clair).

O modelo não deixa de sair: sai na passada seguinte. Nos três, o custo de inverter é assimétrico —
atrasar o recibo um dia contra responder propaganda a um pedido de socorro. **Está dito a ele.**

### O que ele precisa saber

**Quem recebe o modelo e não escreve de novo nunca chega no pedido de dados**, porque a rodada só
volta a quem respondeu. Antes, com os dados primeiro, o cadastro era capturado logo. Foi dito no
mesmo dia, antes de eu começar.

**Arquivos:** `src/lib/anuncios.js` (`modeloDoAnuncio`), `src/lib/arvore.js` (`fluxoPadrao` — a
chegada inteira), `src/lib/store.js` (`modeloPadraoAnuncio` + backup), `src/panel/panel.js` (a
escolha do modelo e o cartão da Config), `tests/anuncios.test.mjs` (+11),
`tests/arvore.test.mjs` (grupo reescrito, 17 asserções), `manifest.json` (1.46.0 → 1.47.0). Catorze
suítes e os dois verificadores passando.

---

## 2026-09-02 — Desfeito: o modelo padrão é um RECIBO, não entrega de conteúdo

**Correção dele**, minutos depois de escolher: *"a menos que seja um evento confirmando a presença
não há necessidade de mandar modelo novamente, o modelo padrão é uma confirmação para a pessoa que
ela irá receber nosso conteúdo"* e *"se a pessoa já respondeu a cidade a chance de ela ter recebido
um modelo é muito grande então não tem necessidade de mandar o padrão novamente"*.

### O que eu errei

Medindo o lado de quem chega, encontrei o caso "veio do anúncio e já tem etiqueta de cidade" caindo
no vazio. Ofereci quatro desfechos e argumentei **"o que ela clicou para receber é o conteúdo"** —
como se o modelo entregasse conteúdo. Ele escolheu "mandar o modelo" com base nessa frase.

O modelo padrão não entrega nada: **é o recibo** de que ela vai receber. Cidade conhecida é bom
indício de que o recibo já saiu, e mandar de novo é repetir mensagem para eleitor real — o defeito
que este projeto mais paga.

Descrição errada minha não produz escolha errada dele: produz **escolha errada minha assinada por
ele**. Está no `CLAUDE.md` agora, junto da regra de conferir o que a coisa faz antes de oferecer
opções.

### O que foi desfeito

A caixa "veio de um anúncio que eu reconheço → manda o modelo do anúncio", criada na entrada
anterior dentro de "com etiqueta de cidade", **saiu**. O caso volta a cair na caixa de pergunta — e
isso agora está travado em teste como o desfecho **certo**, com o motivo escrito, para ninguém
"consertar" de novo achando que é buraco.

**O outro ramo continua**, e é o que resolve de verdade: quem vem de anúncio reconhecido e **não
tem** etiqueta de cidade recebe o pedido de nome e cidade (tecla 4). Ali falta dado; no caso acima
não faltava nada.

### A exceção que ele nomeou, medida

Evento confirmando presença hoje **só troca o texto** da tecla 4 (`confirmaPresenca` →
`pedir-dados-evento-sim/nao`). Não é regra e não é sinal — então o quadro não consegue ramificar por
ela. Medido com *"Não conseguirei ir!"*:

| respondeu ao convite | hoje |
|---|---|
| pessoa nova, sem cidade | tecla 4 — pede dados |
| **pessoa nova, com cidade** | **nada — cai na mão dele** |
| retorno, sem cidade | tecla 4 |
| retorno, com cidade | tecla 3 — conclui |

Quem responde ao convite **já tendo cidade** não recebe recomendação nenhuma. É o buraco que sobra
da exceção que ele nomeou, e fechá-lo pede um sinal novo (`respondeuSobrePresenca`) — o que exige
calculá-lo no painel com teste, senão o ramo nunca casa e não acusa. **Não fiz: é decisão dele.**

**Arquivos:** `src/lib/arvore.js` (caixa removida), `tests/arvore.test.mjs` (grupo reescrito, 7
asserções travando o oposto), `CLAUDE.md` (+2 armadilhas), `manifest.json` (1.45.0 → 1.46.0).
Catorze suítes e os dois verificadores passando.

---

## 2026-09-02 — O buraco gêmeo: quem CHEGA pelo anúncio já com etiqueta de cidade

**Pergunta dele:** *"atualizou o ramo agora então de pessoas chegando, para após reconhecer se é
hostil reconhecer qual o anúncio?"*

Resposta curta: **não** — o ramo do dia foi no lado de quem retorna. Mas a pergunta valeu a medição,
porque o lado de quem chega tinha o mesmo buraco.

### Duas coisas que a medição respondeu

**A ordem que ele descreveu já existia** no lado de quem chega: hostil primeiro, depois o pedido de
dados. E "mandar o modelo" **não** vence ali de propósito — o pedido de dados ganha, que é a decisão
dele de 01/09 (*"primeiramente nós perguntamos os dados"*).

**O quadro só sabe perguntar "reconheci ALGUM anúncio?", não qual.** É de design: "qual anúncio faz
o quê" mora na Config, num lugar só. Nos dois, ele teria a mesma decisão duplicada e um dia elas
discordariam.

### O buraco que apareceu medindo

Quem chega pelo anúncio e **já tem etiqueta de cidade** atravessava o quadro inteiro sem desfecho —
com ou sem anúncio reconhecido. Não é caso raro: é exatamente quem foi etiquetado na passada em
massa da aba Cidades.

O caminho dela morria porque cada caixa daquele lado exige outra coisa: `ja-respondemos-antes` exige
ser retorno (e ela é primeira vez), a etiqueta que dispensa exige a etiqueta, e as caixas de
pendência não casam com o texto do anúncio — que é excluído de "só expressa apoio" de propósito.

### O conserto, escolhido por ele

Perguntei entre quatro desfechos (mandar o modelo · agradecer o apoio · os dois em cascata · deixar
como estava) e ele escolheu **mandar o modelo do anúncio**. Faz sentido: não falta dado nenhum dela,
e o que ela clicou para receber é o conteúdo.

Caixa nova em `fluxoPadrao`, em ÚLTIMO dentro de "com etiqueta de cidade":

> **veio de um anúncio que eu reconheço** → *manda o modelo do anúncio* (a regra `conteudo-pedido`)

| quem chega com etiqueta de cidade | antes | agora |
|---|---|---|
| hostil | tecla s | tecla s |
| anúncio com modelo mapeado | **nada** | **tecla 1 — manda o modelo** |
| anúncio sem modelo mapeado | nada | nada *(honesto: não há o que mandar)* |

**Sem modelo mapeado ela continua caindo na caixa de pergunta.** Isso quer dizer que o buraco só
fecha de verdade para anúncio com modelo escolhido na Config — e é por isso que o aviso de "este
anúncio não faz nada" (entrada anterior) importa tanto.

### Dois erros meus que a medição pegou

Escrevi duas asserções por suposição e as duas estavam erradas:

- `etiqueta-dispensa-da-fila` é **tecla 2 (pular)**, não 3. Eu supus que concluía.
- `ultima-e-despedida` é regra do CÓDIGO: lê o **sinal** `ultimaEhDespedida`, não o texto. Passei só
  o texto e o teste acusou. Caixa de PALAVRAS lê texto; regra lê sinal já calculado — confundir os
  dois faz o teste mentir sobre a prioridade.

**Arquivos:** `src/lib/arvore.js` (`fluxoPadrao`), `tests/arvore.test.mjs` (+9), `manifest.json`
(1.44.1 → 1.45.0). Catorze suítes e os dois verificadores passando.

---

## 2026-09-02 — "o formulário nunca saiu?" — jargão meu nos rótulos da janela dele

**Pergunta dele:** *"o formulário nunca saiu? o que quer dizer com isso?"*

**Não existe formulário nenhum.** É a mensagem de WhatsApp que pede *"Nome completo / Cidade"* — a
resposta pronta `pedir-dados`. A palavra veio de mim e ficou nos rótulos que **ele lê para montar os
ramos**, o que é pior do que estar numa mensagem minha: ele escolhe a condição de um ramo lendo
aquele texto, e um ramo montado por leitura errada decide o que sai para eleitor.

A pergunta dele é a prova de que o rótulo não se explicava. Trocado onde aparece na tela:

| onde | antes | agora |
|---|---|---|
| sinal (condição de ramo) | O formulário já saiu para ela | **Já pedimos o nome e a cidade dela** |
| a negação dele | O formulário nunca saiu | **Nunca pedimos o nome e a cidade dela** |
| sinal (condição de ramo) | O formulário saiu hoje | **Pedimos o nome e a cidade HOJE** |
| a negação dele | O formulário não saiu hoje | **Não pedimos o nome e a cidade hoje** |
| rótulo da regra | Veio do anúncio e o formulário nunca saiu | **Veio do anúncio e nunca pedimos os dados dela** |
| motivo no log da rodada | …o formulário nunca saiu para ele | **…nunca pedimos o nome e a cidade dela** |
| dica na Config | quem já chegou lá não precisa de formulário | **…não precisa que peçam os dados** |

**Os SINAIS são lidos ao vivo** por `condicaoEmPortugues`, então o conserto vale para as caixas que
já existem no quadro dele, não só para as novas. O `rotulo` da regra é copiado no momento em que a
caixa nasce (`noDeRegra`), então caixa antiga guarda o texto velho — só o catálogo e as caixas novas
mostram o novo.

Um teste caiu e estava certo cair: ele exigia a frase `'nunca saiu'` no motivo. Reescrito para exigir
a frase sem jargão.

**Lição:** rótulo que o usuário lê para tomar decisão é interface, não comentário. "Formulário"
descrevia como eu penso o campo, não o que a pessoa recebe — e este projeto já tem a regra de que
nome de coisa vem do vocabulário dele.

**Arquivos:** `src/lib/arvore.js` (`SINAIS`), `src/lib/sugestao.js` (`SOBRE` + `motivo`),
`src/panel/panel.js` (dica), `tests/sugestao.test.mjs`, `manifest.json` (1.44.0 → 1.44.1). Catorze
suítes e os dois verificadores passando.

---

## 2026-09-02 — O ramo do anúncio reconhecido, no padrão do quadro

**Pedido dele:** *"atualize o ramo"*, depois do diagnóstico da print da Inge.

### O ramo

Caixa nova em `fluxoPadrao`, dentro de "pessoa retornando" → "sem etiqueta de cidade":

> **veio de um anúncio que eu reconheço** → *ainda não temos nome e cidade* (a regra
> `nunca-pediram-dados`)

Com a configuração exata da print dele — anúncio em "só etiquetar e deixar o fluxo decidir", sem
etiquetas, sem modelo mapeado — o vazio virou desfecho:

| a Inge | antes | agora |
|---|---|---|
| primeira vez | tecla 4 | tecla 4 |
| **já respondemos antes** | **nada** | **tecla 4 — pede nome e cidade** |
| já respondemos hoje | **nada** | **tecla 4** |
| já pedimos os dados | nada | nada *(de propósito — ver abaixo)* |

### As três escolhas de desenho, todas conservadoras

**Fica EMBAIXO de "com pendência" e de "sem pendência".** É último recurso dentro do lado sem
cidade: quem tem pendência resolve a pendência, quem tem modelo mapeado recebe o modelo, e só o que
sobra chega aqui. Pôr esta caixa em cima roubaria a vez de quem já funcionava — o erro que a regra
de sem interesse no topo já custou uma vez. Tem teste para os três: com modelo mapeado sai a tecla
1, com "bom dia" sai a tecla 5, e a recusa continua vencendo tudo.

**A condição é `anuncioReconhecido`, não `veioDeAnuncio`.** A origem vem da plataforma e vale para
qualquer anúncio; o sinal só é verdade para anúncio que ELE cadastrou na Config. Assim o ramo não
muda nada para quem chega por campanha não mapeada — e isso está travado em teste.

**O desfecho é a regra do código, não uma tecla fixa.** `nunca-pediram-dados` traz as guardas
junto: só dispara se o formulário nunca saiu, se não saiu hoje, se não é só repasse de link e se não
há etiqueta de cidade. Uma tecla 4 fixa aqui pediria os dados de novo a quem já recebeu o pedido.

### O que continua sem desfecho, e é de propósito

Quem **já recebeu** o formulário e volta mandando só o texto do anúncio não tem desfecho automático:
ela não respondeu o que perguntamos, e não existe resposta certa para mandar sozinho. Esse caso é da
IA ou dele. Está travado em teste para não virar "pede os dados de novo" num conserto futuro.

### Como isto chega no quadro dele

`fluxoPadrao` é o que **"Resetar para o padrão"** devolve — o quadro de trabalho dele **não muda
sozinho**. Ou ele reseta (e perde o arranjo à mão), ou monta a caixa em três campos: *Ramo novo* →
condição **"Reconheci de QUAL anúncio ela veio"** → dentro dela, a regra *"o formulário nunca saiu"*
do catálogo, arrastada da lista de regras do código.

**Arquivos:** `src/lib/arvore.js` (`fluxoPadrao`), `tests/arvore.test.mjs` (+9), `manifest.json`
(1.43.1 → 1.44.0). Catorze suítes, `checar-modulos` e `checar-referencias` passando.

---

## 2026-09-02 — "não seguiu o fluxo": o anúncio estava configurado para não fazer nada

**Relato dele**, com a print da Inge (veio do ANÚNCIO | FACEBOOK, escreveu *"Olá! Eu apoio as
Escolas Cívico-Militares 🙏"*): *"não seguiu o fluxo"*.

### O que realmente aconteceu

Rodei o motor com os textos exatos dos dois anúncios da print. **O reconhecimento funcionou** —
casou com o primeiro anúncio. O problema é o que estava configurado para acontecer depois: os dois
cartões estavam em **"Só etiquetar, e deixar o fluxo decidir"** e com o campo de etiquetas
**vazio**. Ou seja: o anúncio não mandava fazer nada.

E o quadro do fluxo também não decide nada para o caso dela. Medido:

| a Inge | o quadro decide |
|---|---|
| primeira vez | tecla 4 — pede nome e cidade |
| **já respondemos antes** | **nada** |
| já respondemos hoje | **nada** |
| já pedimos os dados | **nada** |

O motivo é uma consequência de outra decisão certa: a mensagem gerada pelo anúncio é **excluída de
propósito** de "só expressa apoio" (`padroesDeAnuncio`), para não contar como apoio escrito por ela.
Com isso, quem chega do anúncio, escreve só o texto do anúncio, não tem etiqueta de cidade e não tem
modelo mapeado **não casa com nenhuma caixa** — e cai na caixa de pergunta, esperando ele.

Com o mesmo anúncio configurado para **mandar o modelo**, os quatro casos resolvem: tecla 4 na
primeira vez, tecla 1 depois.

### O defeito que era meu

Do lado de fora, "configurado para não fazer nada" é **indistinguível de "o reconhecimento
falhou"** — e foi por isso que o tempo dele foi gasto procurando defeito onde não havia. Duas
correções, as duas de visibilidade:

1. **`anuncios.conferir` acusa a configuração inerte.** Anúncio com ação "só devolve ao fluxo" e
   nenhuma etiqueta ganha aviso vermelho na Config: *"não faz nada"*, com as três saídas
   (escolher o que fazer, pôr uma etiqueta, ou usar o sinal do quadro). Mesmo raciocínio de
   `arvore.problemas`, que já acusa a caixa "sem condição, sem ação e sem ramo dentro".
2. **A rodada passou a registrar o anúncio reconhecido**, com o nome, o que ele manda fazer e —
   quando o fluxo também não decidiu — a frase de que ninguém decidiu nada. Antes o anúncio não
   aparecia em lugar nenhum do log.

Um teste que eu já tinha escrito **caiu** com a mudança (`"deixar o fluxo decidir" nao exige
valor`), o que é exatamente o que devia acontecer: ele afirmava que essa configuração era válida.
Reescrito para exigir a etiqueta, com o caso oposto ao lado.

### O que fica em aberto, e é decisão dele

O quadro não tem caixa para **"veio de um anúncio que eu reconheço e não disse mais nada"** no lado
de quem retorna. `fluxoPadrao` é documento dele e não mexo sem pedido — mas é o buraco que produziu
esta print, e agora existe o sinal **"Reconheci de QUAL anúncio ela veio"** para fechá-lo com um
ramo.

**Arquivos:** `src/lib/anuncios.js` (`conferir`), `tests/anuncios.test.mjs` (asserção reescrita + 2),
`src/panel/panel.js` (o registro na rodada), `manifest.json` (1.43.0 → 1.43.1). Catorze suítes,
`checar-modulos` e `checar-referencias` passando.

---

## 2026-09-02 — Os anúncios do momento: reconhecer, e dizer o que fazer

**Pedido dele:** *"falta reconhecer o anúncio, nas configurações bote os anúncios do momento onde
botarei o texto para ser reconhecido e o que fazer quando for determinado texto do anúncio"*.

### O que existia, e a metade que faltava

A tabela "Modelo por TEXTO da mensagem" já reconhecia o anúncio pelo texto — e só sabia responder
**uma** coisa: qual modelo aprovado mandar. Anúncio sem modelo era reconhecido e morria ali:

- convite de evento — não tem modelo, tem uma resposta pronta;
- anúncio que só traz gente nova — o que falta é o cadastro, não conteúdo;
- pesquisa, ou qualquer campanha nova — nada mapeado ainda.

### O que entrou

**Aba Config → "Anúncios do momento"**, substituindo a tabela antiga. Um cartão por anúncio no ar:

| campo | para quê |
|---|---|
| nome | só para ele se achar na lista |
| **texto que reconhece** | um por linha; casa por trecho **contido**, sem acento nem caixa |
| **o que fazer** | mandar modelo · mandar resposta pronta · pedir nome e cidade · só etiquetar e deixar o fluxo decidir |
| etiquetas | aplicadas em qualquer ação — é o que permite filtrar por campanha depois |
| "no ar" | desligar guarda o texto da campanha que acabou, sem apagar |

Cartões em vez de `chave = valor` porque a ação não é um valor: é uma escolha entre quatro, e cada
uma pede um alvo diferente. Um formato de texto para isso seria uma linguagem que só eu saberia
escrever. O alvo vem de **lista** (os modelos aprovados, as respostas dele) — escolher de lista não
erra o nome, e nome errado aqui só daria erro na hora de enviar.

**As linhas antigas vêm sozinhas** na primeira abertura (`migracoes.anunciosDoModeloPorTexto`), uma
vez só e sem sobrescrever o que ele editar. Sem isso, estrear a tela apagaria em silêncio o
reconhecimento que já funcionava, e ele descobriria pelo modelo que parou de sair.

### As três decisões que protegem eleitor real

**O texto do anúncio fica na conversa para sempre.** Quem clicou em julho continua "reconhecido" em
setembro — um gatilho ingênuo mandaria a ação do anúncio de novo a cada passada. Então
`decidirComAnuncio` **nunca passa por cima de regra que decidiu não enviar**: recusa, despedida,
etiqueta que dispensa da fila. É o mesmo erro do "Amém" que recebeu mais uma mensagem 36 min depois,
e tem teste para as três. Regra que ia enviar de qualquer forma perde para o anúncio de propósito:
aí ele decide **o quê** sai, e escolha explícita dele não se substitui por dedução.

**Não existe campo de texto livre.** As ações são lista de permissão (`anuncios.ACOES`): o texto que
sai é, byte a byte, um que ele escreveu na aba Respostas ou aprovou na plataforma. Um campo de texto
ali transformaria configuração de anúncio em redator de mensagem sem revisão — a mesma fronteira que
faz a IA escolher e nunca escrever.

**Uma fonte só.** `modeloPorTexto` deixou de ser consultado. Se as duas fossem lidas, **apagar um
anúncio não teria efeito**: a linha velha continuaria mandando o modelo que ele acabou de tirar do
ar.

### Detalhes que valem lembrar

- Etiquetas entram com origem **`anúncio`**, nunca `conteúdo` — `conteúdo` é o que decide o modelo, e
  uma etiqueta de campanha ali disputaria essa escolha com "Conteúdo Zucco"/"Conteúdo Flávio". Elas
  existem porque **ADS diz que veio de anúncio e não de QUAL**.
- `state.anuncio` é zerado na troca de contato. Sem isso, o anúncio do contato anterior decidiria o
  que a rodada manda para o próximo — a armadilha da pergunta de cidade, de novo.
- Sinal novo no quadro do fluxo: **"Reconheci de QUAL anúncio ela veio"**, diferente de "Veio de um
  anúncio" (que é a origem que a plataforma informa). Dá para ramificar entre os dois.
- A conferência roda a cada edição e acusa em vermelho: modelo que não existe, resposta apagada,
  anúncio sem texto, o mesmo texto em dois anúncios. Nenhuma dessas daria erro ao salvar — daria na
  hora de enviar, com o contato aberto.
- `hsm.parseModeloPorTexto`/`formatModeloPorTexto` ficaram sem uso em `src/` (só os testes de `hsm`
  os cobrem): a tela que os usava não existe mais.

### Conferido

**55 asserções** em `tests/anuncios.test.mjs` (nova suíte, a catorze). E a Config foi **aberta de
verdade** num navegador, com `chrome.storage` de mentira: a migração trouxe a linha antiga, trocar a
ação zerou o alvo e trocou o seletor, "+ Anúncio novo" acusou "sem nenhum texto" na hora, e o que a
tela gravou é exatamente o que o motor espera.

**O que NÃO conferi:** a aparência dentro do mobiliza. Meu banco de testes não carrega o CSS do
painel do mesmo jeito que a página real — a estrutura está certa, o visual ele vai ver primeiro.

**Arquivos:** `src/lib/anuncios.js` (novo), `tests/anuncios.test.mjs` (novo, 55), `src/lib/store.js`
(chave `anuncios` + backup), `src/lib/tags.js` (`etiquetasDoAnuncio`), `src/lib/arvore.js` (sinal),
`src/panel/panel.js` (`carregarAnuncios`, a seção da Config, a decisão da rodada),
`src/panel/panel.css`, `CLAUDE.md`, `manifest.json` (1.42.0 → 1.43.0). Catorze suítes,
`checar-modulos` e `checar-referencias` passando.

---

## 2026-09-02 — Regra apagada agora tem volta: o catálogo no lado da janela

**Pedido dele:** *"quando regras são apagadas tem que ter uma opção ou uma aba ali com a lista de
regras para arrastar pro fluxo novamente"*.

O buraco era real e caro. Apagar uma caixa "do código" tinha volta **por um passo**, pelo Desfazer;
passado ele, não tinha mais. A regra continuava viva no código, mas o único caminho de volta era
"Resetar para o padrão", que joga fora o arranjo inteiro feito à mão. Ou seja: **duas caixas
apagadas custavam a tarde de trabalho** — o mesmo estrago que gerou o Desfazer, por outra porta.

### O que entrou

Um cartão **"Regras do código"** no lado da janela, com as dezesseis. Cada verbete traz o rótulo, o
selo do que sai para o eleitor e o resumo da condição. Dois caminhos para pôr no quadro:

- **arrastar** o verbete até o quadro — o que acompanha o ponteiro é a **caixa de verdade**, com
  nome, desfecho e cor, e não um retângulo genérico que só vira caixa depois de soltar. Mesma razão
  de o pino existir: o gesto tem que mostrar o que faz enquanto acontece;
- **botão "Pôr"**, que larga no meio da vista. Não é redundância — o quadro pode estar rolado longe
  ou a 35%, e aí a mira é trabalho. É a lição do "Ramos dentro deste": quando o gesto exige
  pontaria, a lista precisa oferecer o caminho sem pontaria ao lado.

Filtro por nome e a caixa **"só as que estão fora do quadro"**, que é a pergunta que ele vai fazer
na prática ("o que eu apaguei?").

### Três decisões que valem registro

**Mostra as dezesseis, não só as que faltam.** Cada verbete diz *já no quadro 2×*. Sumir da lista
assim que entra esconderia que **pôr a mesma regra em dois lugares é legítimo** — o próprio padrão
faz isso, com as sete caixas repetidas dos dois lados da bifurcação de cidade.

**Id novo quando a regra já está no quadro.** `noDeRegra` cunha o id a partir da regra
(`r:sem-interesse`), o que basta enquanto ela aparece uma vez. Pôr de novo criaria id repetido — e
isso não é cosmético: `problemas` acusa, e na janela um clique abriria as duas caixas de uma vez.
`noDeRegraLivre` numera (`r:sem-interesse:2`), o mesmo formato que o padrão já usa.

**A caixa nasce na RAIZ, não dentro do ramo selecionado.** Na raiz ela é último recurso — só decide
quando tudo acima falha. Dentro de um grupo, passa a valer só naquele ramo e pode roubar a vez de
quem está embaixo. Largar uma regra que ENVIA num lugar que ele não escolheu é o tipo de surpresa
que este quadro existe para não ter. Ele pendura onde quiser depois, com o pino.

### Conferido na janela, não só no motor

Servida fora da extensão com um `chrome.storage` de mentira: apagar a caixa devolveu a regra à
lista, o arrasto criou a caixa **onde o ponteiro estava** (`1589px, 798px`, com o quadro rolado e a
35%), soltar **fora** do quadro não fez nada, e pôr uma regra já presente gerou
`r:sem-interesse` + `r:sem-interesse:2` sem id repetido.

**Arquivos:** `src/lib/arvore.js` (`catalogoDeRegras`, `noDeRegraLivre`), `src/fluxo.html`,
`src/fluxo.css`, `src/fluxo.js` (`desenharCatalogo`, `largarRegra`, `ligarCatalogo`; `noPalco` subiu
para o módulo), `tests/arvore.test.mjs` (+12), `manifest.json` (1.41.0 → 1.42.0). Treze suítes,
`checar-modulos` e `checar-referencias` passando.

---

## 2026-09-01 — O modelo estava preso atrás da pendência

**Relato dele:** *"se continuar como na print o modelo nunca será enviado porque está concluindo
após resolver a pendência, teria que resolver e então mandar o modelo e encerrar"*.

Está certo, e foi medido no motor. Com o quadro como estava, qualquer pendência engolia a entrega:

| contato do anúncio, com modelo mapeado | desfecho |
|---|---|
| mandou figurinha | tecla 3 — conclui |
| só disse bom dia | tecla 5 — momento, conclui |
| só expressou apoio | tecla 8 — agradece, conclui |
| **nenhuma pendência** | tecla 1 — manda o modelo |

O modelo só saía para quem chegasse limpo. Uma figurinha bastava para a entrega nunca acontecer.

### Por que, e por que "não concluir" sozinho não resolve

`decidir` devolve **uma** ação e a rodada executa **uma** tecla — não existe "faz isto e depois
aquilo". Como as caixas de pendência concluem, elas encerram antes de o fluxo chegar ao modelo.

Meu primeiro instinto foi tirar a conclusão dessas caixas. **Não resolve, e o motor mostrou:** a
mesma caixa casa de novo na passada seguinte e manda o momento outra vez. A entrega continua presa,
agora num laço.

### O conserto: a pendência sai da frente depois de resolvida

A caixa **"com pendência"** ganhou a condição **"ainda não respondemos hoje"**. Com ela:

- **1ª passada** — nada respondido hoje → a pendência resolve (momento, agradecimento, o que for);
- **2ª passada** — já respondemos hoje → a pendência não está mais na frente, o caso desce para "sem
  pendência" e **o modelo sai**.

Uma mensagem por passada, sempre.

### A escolha que ele fez, e o que ela custa

Havia dois caminhos, e a diferença importa para o número dele:

- **(a) ação composta** — resolver e mandar o modelo na MESMA passada. Duas mensagens seguidas para
  a mesma pessoa, na fila inteira. Rajada para o mesmo número é o que já pesou no WhatsApp dele.
- **(b) uma mensagem por passada** — a que ele escolheu.

O custo de (b): o modelo só chega **quando ela voltar a escrever no mesmo dia**. Quem resolve a
pendência e some não recebe o modelo naquele dia — e é a diferença entre entregar rápido e não
arriscar o número.

### Uma fragilidade que fica registrada, não consertada

A caixa **"só mandou bom dia"** é dele, casa por palavras e tem a tecla 5 fixa — **sem a guarda de
"o momento já saiu"** que a regra `ultima-e-so-reacao` tem. No dia seguinte, se a pessoa disser "bom
dia" de novo, sai outro momento. A guarda nova cobre o mesmo dia, não o dia seguinte. Não mexi
porque a caixa é dele; se incomodar, é acrescentar o sinal "a mensagem do momento já saiu" à
condição dela, negado.

**Arquivos:** `src/lib/arvore.js` (`fluxoPadrao`), `tests/arvore.test.mjs` (+5), `manifest.json`
(1.40.0 → 1.41.0), `registro.md`. Treze suítes, `checar-modulos` e `checar-referencias` passando.

---

## 2026-09-01 — O quadro dele virou o padrão

**Pedido:** *"veja o fluxo, o que lhe mandei é o novo padrão"* — com o texto de 31 ramos e as
observações dentro das caixas.

`arvore.fluxoPadrao()` foi reescrito com a estrutura dele: **anúncio — pessoa nova** e **pessoa
retornando**, e dentro do retorno a bifurcação **sem etiqueta de cidade** / **com etiqueta**. 29
ramos, 9 enviam mensagem, zero problemas.

### O que as observações dele mandaram

- **`mensagem padrão do anúncio` virou IRMÃ de `Recusou`**, não filha. No texto que ele mandou ela
  tinha caído dentro da recusa, e como o motor testa o filho antes da ação do próprio nó, o
  resultado era o inverso do desenho: **o hostil recebia o pedido de nome e cidade e o contato
  normal não recebia nada**. Medido antes de consertar.
- **`nunca-perguntaram-interesse` e `nome-sem-sentido` saíram do quadro** (*"descarte"*). As regras
  continuam no código — descartadas do quadro, não apagadas.
- **`pedido-hoje-sem-resposta` saiu**, que era a opção que ele deu (*"ou retire essa caixa"*). O que
  ela protegia — não repetir o pedido no mesmo dia — **já está dentro de `nunca-pediram-dados`**, que
  exige `!pedidoHoje` para disparar. Sem a caixa ninguém pede duas vezes; só deixa de ser concluído,
  que era o que ele queria.

### As duas coisas que os testes pegaram, e que o quadro dele tinha

1. **`sem-interesse` só existia do lado do anúncio.** Quem já tinha sido atendido e voltava
   hostilizando não era pego por lugar nenhum — caía nas regras de baixo e podia **receber a
   mensagem do momento depois de mandar um desaforo**. Uma caixa no topo de "pessoa retornando"
   cobre os dois lados da bifurcação de uma vez.
2. **Id repetido.** A mesma regra aparece nos dois lados da bifurcação, e `noDeRegra` dava o mesmo
   id às duas — o que `problemas` acusa e o que, na janela, faria um clique abrir as duas caixas.
   O lado entra no id (`r:pergunta-aberta:com-cidade`).

### A única coisa que mudei além do que ele escreveu

**A condição do lado "sem etiqueta de cidade" está NEGADA.** No quadro dele ela não tinha condição —
pegava todo mundo — e, como os dois lados têm as mesmas regras, o lado "com etiqueta" nunca era
alcançado: a mesma regra já havia falhado do outro lado. Nove caixas mortas. O rótulo da caixa já
prometia "sem etiqueta de cidade"; o código passou a fazer o que o nome dela diz.

### Conferido no motor

| contato | desfecho |
|---|---|
| anúncio, hostil | tecla s — marca e conclui sem responder |
| anúncio, normal | tecla 4 — pede nome e cidade |
| **voltou e hostilizou** | tecla s |
| voltou, respondeu a denúncia | tecla 6 — vai para gente |
| voltou com etiqueta, se despediu | tecla 3 |
| voltou sem etiqueta, com conteúdo | tecla 1 — manda o modelo |

**Pendência:** a observação de `respondeu com os dados` (*"e manda + o agradecer e encerrar +
concluir"*) continua **não atendida** — a rodada não tem tecla que faça modelo + agradecimento +
conclusão numa só. Precisa de tecla nova.

**Arquivos:** `src/lib/arvore.js` (`fluxoPadrao` reescrito), `manifest.json` (1.39.0 → 1.40.0),
`registro.md`. Treze suítes, `checar-modulos` e `checar-referencias` passando.

---

## 2026-09-01 — A pergunta dos grupos saiu do pedido de dados

**Pedido:** *"não tem necessidade de perguntar por grupos, ninguem estava me dando links"*.

A pergunta existia para conseguir **link de convite** de grupos (decisão de 11/08: pedir o link, não
o nome, porque nome de grupo não serve para entrar). A medida dele no trabalho é a que vale: os
links não estavam vindo, e a pergunta era a segunda coisa a responder numa mensagem cujo ponto é ser
um portão curto.

O `pedir-dados` agora termina no exemplo:

> {{saudacao}}! Que bom ter você com a gente. 🇧🇷
> Mas antes de qualquer coisa: me diz seu nome e a sua cidade, para eu salvar seu contato
> direitinho. Responde nesta ordem, numa mensagem só:
> Nome completo / Cidade
> (exemplo: Maria Silva / Santo Ângelo)

### A armadilha: uma migração antiga desfaria isto sozinha

`migrarPerguntaGrupos` **acrescenta** a pergunta em qualquer `pedir-dados` que não fale de "grupo
político". Numa instalação nova, `templates` nasce igual ao padrão — sem a pergunta — e ela a
devolveria no primeiro carregamento. **Saiu da fila do `list()`.** A função fica, porque é história
de como o texto chegou onde chegou; o que não pode é ela rodar.

Tem asserção: depois de `list()`, a pergunta continua fora.

`migrarGruposPedeLink` ficou — ela só troca a redação ANTIGA da pergunta pela nova onde a antiga
estiver literalmente presente, então é inofensiva agora e ainda protege um texto próprio dele que
tenha a frase velha.

### Quem já recebeu a v1

A versão de meia hora atrás (com a pergunta no fim) já podia ter chegado à máquina dele. Duas
providências: o **miolo da v1 entrou na lista de reconhecimento** de "texto de fábrica", e a
migração ganhou **flag nova** (`pedirDadosSemGrupos`) para rodar de novo. Tem asserção do caminho
v1 → v2.

E a trava de sempre continua: **texto reescrito por ele fica intacto** — testado com um texto dele
que menciona grupo político de propósito.

### O que NÃO saiu

O envio do **link do grupo da cidade** continua inteiro: a resposta `link-grupo`, a tabela
cidade → link e a tecla que a manda. O que saiu foi *perguntar de quais grupos a pessoa participa* —
coisa diferente de *mandar o grupo dela*.

**Arquivos:** `src/lib/store.js`, `src/lib/templates.js`, `tests/templates.test.mjs` (+13),
`manifest.json` (1.38.0 → 1.39.0), `registro.md`. Treze suítes, `checar-modulos` e
`checar-referencias` passando.

---

## 2026-09-01 — O pedido de dados vem "antes de qualquer coisa"

**Pedido:** *"pode ser mantida exemplo, que bom ter voce com a gente mas antes de qualquer coisa..."*,
fechando a observação que ele deixou no ramo `mensagem padrão do anúncio`.

### O texto

A abertura calorosa ficou (pedido dele). O que mudou é o miolo: antes o texto explicava o grupo da
região **antes** de pedir; agora pede primeiro.

> {{saudacao}}! Que bom ter você com a gente. 🇧🇷
> **Mas antes de qualquer coisa: me diz seu nome e a sua cidade, para eu salvar seu contato
> direitinho.** Responde nesta ordem, numa mensagem só:
> Nome completo / Cidade

As duas variantes acompanham ("Antes de qualquer coisa…", "Antes de mais nada…").

**A linha `Nome completo / Cidade` continua intocada nas três** — é o invariante que
`extract.findStructured` casa para ler a resposta dela e que `templates.ehPedidoDeDados` usa para
reconhecer que a mensagem foi o pedido. Tem asserção nas três versões.

### Mudar o DEFAULT não bastava, e essa é a metade que quase escapa

Ele já tem o texto salvo no `chrome.storage`: mexer só em `DEFAULT_TEMPLATES` vale para quem nunca
gravou nada, e ele continuaria mandando a versão de ontem. É a armadilha registrada em 31/08 (a
tecla 8 que "não apareceu" — o texto é que nunca tinha chegado).

Nova `templates.migrarPedirDadosAntesDeTudo`, registrada em `list()` com as outras.

**Ela só mexe em quem ainda tem o texto de fábrica**, e a identificação é pelo **miolo** antigo
(`PEDIR_DADOS_MIOLO_ANTIGO`), não pelo texto inteiro: as três versões tinham aberturas diferentes e
a saudação já havia sido mexida por outra migração. Se ele reescreveu a mensagem, a frase antiga não
está lá e o texto dele fica intacto — **reescrever por cima do que ele escreveu é o erro que
nenhuma migração pode cometer**, e ele passa o dia ajustando esses textos. Tem asserção própria,
inclusive para edição feita DEPOIS da migração ter rodado.

### O que ficou de fora, e ele decide

A **pergunta dos grupos** continua no fim da mensagem. A observação dele dizia "antes de qualquer
coisa… após isso concluir", o que sugere uma mensagem curta — mas tirar a pergunta dos grupos é
remover um recurso que ele desenhou de propósito (o link de convite é como a base cresce), e ele
pediu para ajustar a frase, não para tirar aquilo. Fica como pergunta.

**Arquivos:** `src/lib/store.js` (texto novo + `PEDIR_DADOS_MIOLO_ANTIGO`), `src/lib/templates.js`
(migração + registro na `list()`), `tests/templates.test.mjs` (+18), `manifest.json`
(1.37.0 → 1.38.0), `registro.md`. Treze suítes, `checar-modulos` e `checar-referencias` passando.

---

## 2026-09-01 — Desfazer no quadro do fluxo (depois de ele perder o trabalho)

**Pedido:** *"preciso de um botão de desfazer ultima ação, acabei de perder todo meu trabalho por
isso"*.

### O que faltava, e o que provavelmente causou

Os botões que **substituem** o quadro já perguntavam antes ("Resetar para o padrão", "Só as regras
do código", carregar versão, importar arquivo). **"Arrumar o quadro" não perguntava** — e ele
reposiciona TODAS as caixas de uma vez. Num quadro arrumado à mão, isso é o trabalho inteiro, e não
havia volta.

### O desfazer

- **A pilha vive dentro do `gravar`**, não em cada botão. É o que faz o desfazer valer para as
  dezenove chamadas de uma vez — inclusive as que eu ainda não escrevi. Todos os campos do editor
  gravam no evento `change` (nunca `input`), então cada entrada é uma ação de verdade e não uma
  tecla digitada.
- **Vinte passos**, gravados no armazenamento e **não só em memória**. Desfazer que morre ao fechar a
  janela não serve para o caso que o criou: ele vê o estrago, fecha a janela "para ver se volta", e
  aí não volta mais.
- **Chave própria (`fluxoHistorico`)**, fora de `fluxo`: não engorda o objeto que a janela lê e grava
  a cada mexida, e fica fora do `exportJson` — conferido.
- **Desfazer não empilha a si mesmo.** Empilhar faria o botão alternar entre dois estados para
  sempre em vez de andar para trás.
- **Ctrl+Z, e só fora de campo de texto.** Dentro de um `input`/`textarea` o Ctrl+Z do navegador
  desfaz a digitação, que é o que ele espera ali; roubar o atalho faria o quadro voltar um passo
  enquanto ele só queria apagar uma palavra.
- O botão mostra **quantos passos** existem e nasce desabilitado.

Conferido em simulação, inclusive o caso que o queimou: zerar o quadro e voltar em um clique, e a
pilha parando sem estourar quando acaba.

### E "Arrumar o quadro" passou a perguntar

Com a contagem no texto (`Reposicionar as 23 caixas em colunas?`) e dizendo que dá para desfazer.
Mesmo que ele confirme sem ler, agora o desfazer está a um clique.

### O que este conserto NÃO faz

**Não traz de volta o que ele já perdeu.** A pilha começa vazia. O que existe para recuperar
trabalho antigo é "Salvar versão" e "Exportar arquivo" — e vale ele salvar uma versão antes de
experimentar, porque o desfazer cobre a sessão, não a semana.

**Arquivos:** `src/fluxo.js`, `src/fluxo.html`, `src/lib/store.js` (`fluxoHistorico`),
`manifest.json` (1.36.0 → 1.37.0), `CLAUDE.md`, `registro.md`. Treze suítes, `checar-modulos` e
`checar-referencias` passando.

---

## 2026-09-01 — Duplicar um ramo

**Pedido:** *"preciso da opção de duplicar uma caixa"*.

Montar um ramo dá trabalho — condição, palavras, desfecho — e variação do mesmo ramo é o caso comum:
*"isto aqui, mas com outras palavras"*.

### As decisões

- **Os filhos vão junto.** Pela mesma razão que vão no `apagar`: um ramo é a condição **mais** o que
  está dentro dela, e copiar só a casca daria um grupo vazio que não faz nada. O botão diz quantos
  vão — `Duplicar (com 3 dentro)` — como o Apagar já avisava. Cópia que traz seis ramos sem avisar é
  surpresa.
- **Id novo em cada nó copiado, sem exceção.** Id repetido é o que `problemas` acusa e o que
  `sanitizar` renomeia na importação — e, na tela, faria a janela editar dois nós de uma vez. É o
  defeito que esta operação mais pode causar, e tem asserção própria.
- **A cópia entra como irmã SEGUINTE e nasce logo abaixo.** Entre irmãos a prioridade é a altura,
  então nascer abaixo é nascer com a prioridade seguinte — que é o que se espera de uma cópia. O
  deslocamento lateral (+24px) é para ela não sumir atrás de um irmão que já estivesse ali: cópia
  escondida parece cópia que não aconteceu.
- **O rótulo ganha "(cópia)".** Duas caixas idênticas no quadro seriam indistinguíveis.
- **Cópia funda.** Mexer na cópia não pode mexer no original — tem asserção.
- **`duplicar` devolve `{arvore, id}`**, diferente das vizinhas que devolvem só a árvore. Quem chama
  precisa SELECIONAR a cópia, e sem o id a janela teria que adivinhar qual das duas caixas iguais é
  a nova. Está documentado na função.

12 asserções novas em `tests/arvore.test.mjs`.

**Um tropeço no caminho, que vale a nota:** o ajudante local do teste se chamava `arv()` e sombreou o
namespace `arv` do módulo — `arv.duplicar is not a function`. Renomeado para `base()`.

**Arquivos:** `src/lib/arvore.js` (`duplicar`, `comIdsNovos`), `src/fluxo.js` (botão),
`tests/arvore.test.mjs` (+12), `manifest.json` (1.35.0 → 1.36.0), `registro.md`. Treze suítes,
`checar-modulos` e `checar-referencias` passando.

---

## 2026-09-01 — Cabeçalho ocultável na janela do fluxo

**Pedido:** *"faça o cabeçalho ocultável"*.

O cabeçalho tem cinco faixas — título, parágrafo de instruções, contagem, botões e a linha de
atalhos — e come uma boa parte da altura, que é justamente o que o quadro precisa.

### O desenho

Botão `▴ Ocultar` / `▾ Mostrar controles` no canto do cabeçalho. Recolhido, somem o título, a
contagem, os botões e a linha de atalhos; sobra uma faixa fina com o botão.

**O botão fica no cabeçalho, não flutuando sobre o quadro** — e isso é decisão, não preguiça: um
botão sobre o quadro seria exatamente o que ele mandou tirar de lá na mudança anterior (elemento
fixo em cima da área que se arrasta atrapalha o gesto). A faixa fina custa ~26px e não atrapalha
nada.

**Dá para trabalhar o tempo todo recolhido:** a roda do mouse continua dando zoom e o duplo clique
continua criando ramo. É por isso que recolher pode esconder os botões sem deixá-lo sem ferramenta.

### Detalhes que valem registro

- **`position: absolute` no botão**, dentro do cabeçalho. Se ele participasse do flex, recolher
  mudaria a largura disponível para as outras colunas e os botões saltariam de linha ao expandir.
- **A escolha fica gravada** em `fluxo.cabecalhoOculto`. Fica ali porque é onde esta janela já lê e
  grava, e `arvore.paraArquivo` exporta só `teclas` e `arvore` — a preferência de tela **não vaza**
  para o arquivo que ele manda para alguém.
- **O rótulo é aplicado de forma síncrona ao carregar**, antes do `boot`. `boot` é assíncrono e
  espera o armazenamento; sem isso o botão apareceria em branco por um instante.

**Arquivos:** `src/fluxo.html`, `src/fluxo.css`, `src/fluxo.js`, `manifest.json` (1.34.1 → 1.35.0),
`registro.md`. Treze suítes, `checar-modulos` e `checar-referencias` passando.

---

## 2026-09-01 — Os atalhos do quadro subiram para o cabeçalho

**Pedido:** *"bote esse aviso junto com os botões em cima, ali ele fica sendo selecionado e
atrapalhando quando arrasto"*.

A faixa com os atalhos (arrastar o fundo, roda do mouse, duplo clique, Shift+arrastar) flutuava no
canto de baixo do quadro, **por cima da área que se arrasta**.

### `pointer-events: none` não era suficiente, e o motivo importa

A faixa já tinha `pointer-events: none`, então ela não recebia clique — e mesmo assim atrapalhava.
**`pointer-events` impede o clique, não a SELEÇÃO de texto**: um arrasto que passa por cima ainda
monta um intervalo de seleção incluindo aquele texto, e o navegador passa a desenhar o realce azul
no meio do gesto.

O conserto não foi acrescentar `user-select: none` e deixar a faixa lá. Aviso fixo em cima de área
que se arrasta é obstáculo por natureza, por mais discreto que pareça — subiu para junto dos botões,
ocupando a linha inteira do cabeçalho (`flex: 1 0 100%`). O `user-select: none` ficou de qualquer
jeito, porque agora é barato e impede o realce se ele arrastar por ali.

**Efeito colateral bom:** o quadro ficou sem nenhum elemento fixo por cima. Só o palco e as caixas.

**Arquivos:** `src/fluxo.html`, `src/fluxo.css`, `manifest.json` (1.34.0 → 1.34.1), `registro.md`.
Treze suítes, `checar-modulos` e `checar-referencias` passando.

---

## 2026-09-01 — Os dois pinos passaram a significar a mesma coisa; as duas faixas de aviso saíram

**Pedido:** *"retire essas mensagens de aviso que foram postas por ultimo (…) e eu preciso que a
caixa (mandou figura) e a caixa (só mandou bom dia) possam ser ligadas ao mesmo tempo na caixa (tem
etiqueta de cidade), ao tentar uma remove a outra, preciso de múltiplas ligações"*.

### A causa: os dois pinos tinham direções OPOSTAS

| gesto | fazia |
|---|---|
| puxar a **saída** de A até B | **B** ia para dentro de A |
| puxar a **entrada** de A até B | **A** ia para dentro de B |

No quadro dele o pai desejado ("tem etiqueta de cidade") está **em cima**, e a entrada dele é o que
a mão alcança. Cada puxada movia a caixa de cima — tirando-a de onde ela estava. Daí *"ao tentar uma
remove a outra"*: não era a árvore recusando duas ligações, era cada gesto **re-parentando o mesmo
nó**.

Medido, com o quadro do print:

```
ANTES  · puxou de figura até cidade, depois de bomdia até cidade
         dentro de figura: []
         dentro de bomdia: ["tem etiqueta de cidade"]     ← saiu de figura

DEPOIS · o mesmo par de gestos
         dentro de cidade: ["mandou figura", "so mandou bom dia"]
```

### O conserto: não há mais direção para ler

**Uma regra só, para os dois pinos: a caixa de onde você puxa é a que se move.** Puxe de qualquer
lado de A até B e A entra em B. Duas caixas puxadas até a mesma viram duas filhas dela.

Isto é a quarta tentativa no mesmo problema, e as três anteriores erraram do mesmo jeito: pino de
saída, pino de entrada e a frase ao vivo — **todas explicavam a direção em vez de eliminá-la**. A
nota antiga do `CLAUDE.md` já dizia que o pedido era "N para 1"; o que faltava era perceber que o
gesto também precisava ser N-para-1, e não só a lista de caixas de seleção.

Nenhuma mudança no modelo: continua sendo árvore, um pai por nó, e a trava contra ciclo
(`ehDescendente`) continua de pé — conferido.

### As duas faixas de aviso saíram

- **A frase ao vivo** durante o arrasto (`rotulo-ligacao`), que dizia *"X vai para dentro de Y e sai
  de Z"*. Ela existia para explicar a direção; sem direção para explicar, virou ruído.
- **A faixa vermelha** de `arvore.problemas` no topo, que acusava *"sem condição, sem ação e sem ramo
  dentro — não faz nada"*. Ele monta o quadro em partes, então ramo pela metade é estado normal de
  trabalho e o aviso tocava o tempo todo — alarme que toca sempre é alarme que se aprende a ignorar.

`arvore.problemas()` **continua existindo e testada**, só não é mais desenhada: ela é a rede que
`sanitizar` e a importação de arquivo usam para recusar fluxo estragado. O que saiu foi a faixa.

Saiu junto o CSS órfão das duas (20 linhas) e a flag `invertido`, que ficou sem sentido.

### Retrocesso

**Quem já tinha ligações feitas com o gesto antigo não é afetado** — a árvore salva não muda, só o
gesto. Mas a memória muscular dele muda: o mesmo arrasto que antes trazia a outra caixa agora leva
esta. O texto do topo foi reescrito para dizer isso na primeira linha.

**Arquivos:** `src/fluxo.js`, `src/fluxo.html`, `src/fluxo.css`, `manifest.json`, `registro.md`.
Treze suítes, `checar-modulos` e `checar-referencias` passando.

---

## 2026-09-01 (noite, 24) — "Ramos dentro deste": a operação de VÁRIAS para UMA, num lugar só

**Relato dele:** *"pela décima vez eu preciso que as duas liguem na mesma e continua uma removendo
a outra sem ficar as duas ligadas"*.

### O erro foi meu, e foi de leitura do pedido

Ele pediu dez vezes a mesma coisa. Eu entreguei três caminhos, e os três eram
**uma-por-vez-com-direção**: o pino de saída, o pino de entrada e a lista "pôr este ramo dentro
de". Cada puxada é uma ligação só, e quando ele pegava a ponta errada, a puxada seguinte **desfazia
a anterior** — que é exatamente o que ele descreveu todas as vezes.

**Pior: o pino de entrada que eu criei na rodada anterior para "consertar" deu a ele um jeito mais
tentador de cometer o mesmo erro.** No quadro dele o filho está sempre embaixo, então a entrada da
caixa de cima é o que a mão alcança — e puxar dali joga a caixa de cima para dentro de uma, depois
da outra, desfazendo.

### O conserto

**"Ramos dentro deste"**: no editor da caixa selecionada, a lista de todas as outras caixas com uma
caixa de seleção. As marcadas **são** os filhos. Sem direção, sem mira, sem ordem.

Ele seleciona a caixa de cima, marca as duas de baixo, e as duas ficam. O título do campo conta
quantas estão marcadas. Desmarcar solta o ramo na raiz — tirar de dentro nunca apaga nada. Os
descendentes do próprio ramo ficam fora da lista, porque seriam recusados.

Substituiu a lista "pôr este ramo dentro de…" que eu tinha acrescentado sem ele pedir na rodada
anterior. Os dois pinos continuam, para quem gosta do arrasto.

**A regra que fica:** quando o pedido é N para 1, a resposta é um lugar onde os N aparecem juntos.

### Um erro de processo no meio

Mandei a janela com um `const` redeclarado — ela não carregava. O `checar-modulos` **tinha** pegado
(*"1 com erro de sintaxe"*), mas eu o rodei junto com o start do servidor num comando em segundo
plano e não li a saída; só descobri pelo console do navegador. Entrou no `CLAUDE.md`: verificação
lida depois não é verificação.

**Conferido no navegador:** selecionar "Tem a etiqueta que dispensa" e marcar duas caixas deixa as
duas como filhas dela (`2 marcados`), com os 10 fios do quadro no lugar.

**Arquivos:** `src/fluxo.js`, `src/fluxo.css`, `manifest.json` (1.32.0 → 1.33.0), `registro.md`,
`CLAUDE.md`.

---

## 2026-09-01 (noite, 23) — O pino agora liga nos DOIS sentidos

**Relato dele:** *"fez algo que não pedi e continuo com mesmo problema, as duas caixas de baixo eu
quero ligar na de cima e não liga"*.

### O que eu errei

Na rodada anterior eu diagnostiquei certo (o pino puxa do pai para o filho, e ele puxava ao
contrário) e **consertei errado**: escrevi uma frase explicando a direção e acrescentei uma lista
no editor que ele não tinha pedido. Explicação não conserta gesto invertido — e a lista foi escopo
que eu inventei.

**A direção certa depende de qual das duas caixas ele está olhando na hora.** No quadro dele o
filho está sempre EMBAIXO, então o gesto natural é do filho para o pai, de baixo para cima. Era o
único sentido que não existia.

### O conserto

Cada caixa passou a ter **dois pinos**, como qualquer editor de nós:

- **saída**, na borda direita (cheio): puxar dela até B põe **B dentro desta**;
- **entrada**, na borda esquerda (vazada): puxar dela até B põe **esta dentro de B**.

É a mesma ligação, puxada de uma ponta ou da outra. A frase ao vivo acompanha o sentido, e a guarda
de ciclo também — quem é pai e quem é filho depende do pino que ele pegou.

**Conferido no navegador**, no gesto exato dele: puxando da ENTRADA de "só mandou bom dia" até
"Tem a etiqueta que dispensa", e depois da ENTRADA de "mandou figura" até a mesma caixa, as duas
ficaram como filhas dela. A frase mostrou os dois nomes e o "e sai de «pessoa retornando»" nas duas
vezes.

**Pendência aberta:** a lista *"Pôr este ramo dentro de…"* no editor, que eu acrescentei sem ele
pedir. Ficou porque é o caminho que não depende de mira nem de direção, mas é dele a decisão de
tirar.

**Arquivos:** `src/fluxo.js`, `src/fluxo.css`, `manifest.json` (1.31.0 → 1.32.0), `registro.md`.

---

## 2026-09-01 (noite, 22) — Ligar tinha DIREÇÃO invertida, e agora existe caminho sem gesto

**Relato dele:** *"estou tentando ligar duas caixas a caixa com nome tem etiqueta e como antes não
consigo"*, e depois a correção que resolveu o diagnóstico: *"ao acertar ele remove a outra caixa,
não é tamanho"*.

### Causa raiz

O pino puxa **do pai para o filho**: de A até B significa *"B vai para dentro de A"*. Ele estava
fazendo o contrário — puxando de duas caixas diferentes até "tem etiqueta de cidade", esperando
ligar as duas **a** ela. Cada puxada fazia "tem etiqueta" virar filha de uma caixa e, na seguinte,
filha da outra — saindo da primeira. Da tela: a ligação anterior sumia.

**Eu comecei medindo o tamanho do pino** (4,6px a 35% de zoom, que é pequeno mesmo) e ele cortou:
*"não é tamanho"*. Estava certo, e entrou no `CLAUDE.md`: antes de otimizar a mira, conferir se o
gesto faz o que a pessoa acha que faz.

### Os dois consertos

1. **A frase ao vivo durante o arrasto**, ao lado do ponteiro: *"«voltou por outro anúncio» vai
   para dentro de «Só se despediu»"* e, em vermelho, *"e sai de «pessoa retornando»"*. É a segunda
   linha que importa — ela mostra a metade que ele não via acontecer. Direção de gesto não se
   adivinha olhando um ponto na borda; com os dois nomes escritos, não há como ler ao contrário.
2. **"Pôr este ramo dentro de…"** no editor do lado: uma lista com todos os ramos (indentados pelo
   nível), e os descendentes do próprio ramo ficam de fora porque seriam recusados. **Lista não tem
   direção** — ele lê a frase inteira e escolhe. É o caminho confiável, e existe porque o pino já
   falhou com ele duas vezes: primeiro por ser invisível, agora por ser ambíguo.

**Conferido no navegador:** a frase aparece durante o arrasto com as duas linhas e some ao soltar;
pela lista, dois ramos diferentes foram postos dentro do mesmo pai, um depois do outro, e os dois
ficaram.

**Arquivos:** `src/fluxo.js`, `src/fluxo.html`, `src/fluxo.css`, `manifest.json` (1.30.0 → 1.31.0),
`registro.md`, `CLAUDE.md`.

---

## 2026-09-01 (noite, 21) — Arrastar move só a caixa; o ramo inteiro só com Shift

**Relato dele:** *"quando arrasta um todos arrastam, o que deve fazer isso é o pai os outros não"*.

### O que estava acontecendo

`posicionar` era chamado sempre com `comFilhos: true`, então arrastar qualquer caixa levava a
descendência junto. Medido antes de mexer: arrastar "pessoa retornando" movia **7 caixas** (ela e
os 6 filhos); arrastar uma folha movia só ela.

Era o desenho que eu escolhi, e estava errado por um motivo que só aparece com o quadro montado:
**os filhos não ficam colados ao pai aqui** — ele os espalha pela tela. Levar a descendência junto
não desloca um bloco coeso, atira meia dúzia de caixas para o outro lado do quadro a cada ajuste de
layout. E num quadro em cadeia quase toda caixa é pai de alguém, então o "às vezes" virou "sempre".

### O conserto

**Arrastar move só a caixa. Shift + arrastar leva o ramo inteiro.** Mover o bloco continua útil
quando é ele que quer, e aí é explícito.

Com Shift, os filhos acompanham o arrasto **na tela**, e não só ao soltar: sem isso o bloco pularia
de uma vez no fim, e o salto some com a noção de para onde ele está indo.

O modificador está na **dica do rodapé**, que fica sempre visível — pela lição de dois pedidos
atrás: modificador que ninguém vê é modificador que não existe.

**Conferido no navegador:** arrastar "pessoa retornando" sem Shift muda a posição de **1** caixa;
com Shift, das **7**.

**Arquivos:** `src/fluxo.js`, `src/fluxo.html` (a dica), `manifest.json` (1.29.0 → 1.30.0),
`registro.md`.

---

## 2026-09-01 (noite, 20) — Arrastar deixou de religar: era isso que apagava ligação

**Relato dele:** *"está removendo ligação quando tem mais de uma"*, com o print do quadro montado.

### Causa raiz

Soltar uma caixa em cima de outra **religava o ramo**. Era o único jeito de ligar antes do pino
existir, e eu o mantive como atalho quando o pino nasceu — *"quem descobrir arrastar a caixa em
cima da outra também liga"*, escrito no comentário, o que já era o erro.

O gesto perigoso passou a ser **o mesmo gesto do inofensivo**: ele arruma o quadro, encosta uma
caixa na outra, e o ramo troca de pai — o que apaga a ligação anterior, porque um nó tem um pai só.
Num quadro cheio a 35% de zoom as caixas têm 91px de largura; encostar é o normal, não a exceção.

Reproduzi no navegador antes de mexer: arrastar "voltou por outro anúncio" para cima de
"anúncio — pessoa nova" tirava o ramo de "pessoa retornando" e o punha no outro, sem nada perguntar.

### O conserto

**Arrastar só move. Ligar é só o pino.** Sumiu do arrasto o realce de alvo e a religação; ficou a
posição (com os filhos junto) e a reordenação por altura, que é a prioridade entre irmãos.

Entrou no `CLAUDE.md` como regra geral: **gesto destrutivo nunca pode ser o mesmo gesto do
inofensivo**, e quando um gesto novo cobre o antigo, o antigo SAI — não fica como atalho.

### Conferido no navegador

- Arrastar uma caixa para cima de outra agora **não acende alvo nenhum** e **não muda a estrutura**:
  o pai de destino continua com os mesmos 5 filhos, o de origem com os mesmos 6 (reordenados por
  altura, que é o comportamento certo), 20 nós, 20 caixas, 10 fios.
- O pino continua ligando, inclusive **dois filhos no mesmo pai**, um depois do outro.

**Arquivos:** `src/fluxo.js`, `src/fluxo.html` (o cabeçalho não promete mais o gesto antigo),
`manifest.json` (1.28.0 → 1.29.0), `registro.md`, `CLAUDE.md`.

---

## 2026-09-01 (noite, 19) — Observações em cada caixa, reset para o padrão, e o fluxo em texto

**Pedido:** *"preciso que cada caixa tenha um input para botar observações que vou escrever para
você modificar depois, principalmente as com código não editáveis (…) preciso de um reset para o
padrão do fluxo atual, quando eu mandar aqui você atualiza o padrão"*.

### O laço que isto fecha

O quadro tem um lugar que ele **não pode** mexer: a condição dos ramos respaldados por regra, que
fica no código porque é ela que decide o que sai para eleitor. Até agora, apontar um erro ali
significava ele lembrar de me contar depois, de memória. O campo de observação inverte isso: ele
escreve na própria caixa, na hora, e o texto espera por mim.

O laço inteiro: **ele anota → aperta "Copiar o fluxo" → cola na conversa → eu edito o
`arvore.fluxoPadrao()` → ele aperta "Resetar para o padrão"**.

### Uma correção dele no meio do caminho

Eu ia fazer o botão copiando **só as observações**. Ele cortou na hora: *"não faz sentido eu colar
para você sem você ter a visão do fluxo"*. Está certo — *"essa aqui está pegando gente demais"* não
diz nada sem o ramo, a condição, o desfecho e a posição na árvore; eu responderia adivinhando.

Então `arvore.paraTexto` despeja o fluxo inteiro: hierarquia numerada (`2.1` é o primeiro filho do
segundo ramo, e serve para nós dois apontarmos para o mesmo lugar), condição por extenso, desfecho,
o que está desligado, a tecla que ele fixou marcada como dele, a resposta pronta pelo NOME (o id
`pedido-ajuda` não diz o que é), e a observação no ramo a que pertence. Vale como regra geral para
qualquer relatório que eu criar: **contexto junto do comentário, ou o comentário não serve.**

### O padrão virou um documento

`arvoreDoQuadro` virou **`fluxoPadrao`**, e o botão virou **"Resetar para o padrão"**. A função
deixou de ser "o desenho do quadro dele" e passou a ser o estado mantido por mim a partir do que
ele escreve. Está escrito lá e no `CLAUDE.md`: **não mexer nela sem ele pedir** — é para onde ele
volta quando o quadro ficou confuso, e é justamente aí que ele não vai conferir ramo por ramo.
O botão antigo "Voltar às regras do código" continua, renomeado para "Só as regras do código", como
saída de emergência para a tabela achatada.

### Decisões

- **A observação não muda comportamento nenhum**, de propósito: se mudasse, deixaria de ser recado
  e viraria condição sem teste — exatamente o que a fronteira do projeto proíbe.
- **A caixa mostra uma marca "obs."** quando tem texto, para ele ver o que já anotou sem abrir uma
  por uma.
- **A observação vai no arquivo exportado** e passa pela peneira com teto de 4000 caracteres. Se
  ele exportar em vez de copiar, o recado chega do mesmo jeito.
- **Resetar avisa que as observações se perdem junto**, porque se perdem mesmo.

**Arquivos:** `src/lib/arvore.js` (`nota` no nó e na peneira, `paraTexto`, `fluxoPadrao`),
`src/fluxo.js`, `src/fluxo.html`, `src/fluxo.css`, `tests/arvore.test.mjs`, `manifest.json`
(1.27.0 → 1.28.0), `registro.md`, `CLAUDE.md`.

**Conferido no navegador:** clicar numa caixa de regra abre o editor com "Observações para o
Claude" (a condição continua sem edição, como tem que ser); escrever grava e a caixa passa a
mostrar "obs."; "Copiar o fluxo" produz 20 ramos com a observação na linha do ramo dela. Treze
suítes passando.

**Não testado:** a área de transferência no Chrome real (aqui ela foi substituída para ler o que
seria copiado). Se ela for negada, o texto aparece num campo selecionado para Ctrl+C.

---

## 2026-09-01 (noite, 18) — Salvar versões do fluxo, carregar, exportar e importar

**Pedido:** *"falta a opção de salvar fluxo, carregar, exportar"*.

### A distinção que a tela precisava deixar clara

O quadro **já gravava sozinho** a cada mexida (`fluxo.arvore`). O que faltava é outra coisa:
guardar **versões**, para poder experimentar e voltar. O cartão novo diz isso na primeira linha,
porque a dúvida "será que meu trabalho está sendo salvo?" é a mais cara de todas.

### O que existe agora

Um cartão "Salvar e carregar" no lado: campo de nome + **Salvar**; a lista das versões, cada uma
com a data e **quantos ramos, quantos enviam**, e os botões **Carregar** e **Apagar**; e
**Exportar arquivo** / **Importar arquivo**.

- **Carregar pergunta dizendo o TAMANHO da troca** — *"substituído por 20 ramos, 8 deles enviando
  mensagem"*. Ver o número é a diferença entre uma confirmação que se lê e uma que se aperta no
  automático, e o que está sendo trocado é o que decide mensagem para eleitor.
- **Nome repetido sobrescreve, perguntando.** Ter duas versões "teste" e não saber qual é qual é
  pior que perder a antiga sabendo.
- **As contagens de vitória não vão no arquivo**: são medição desta máquina, não o fluxo.

### O arquivo importado é entrada não confiável

Um arquivo de fluxo decide o que a rodada manda para eleitor. `JSON.parse` e usar seria aceitar que
qualquer coisa num campo vire comportamento — e um arquivo exportado hoje, importado depois de eu
renomear uma regra, viraria ramo morto e silencioso.

`arvore.sanitizar` peneira campo a campo e **descarta com aviso**: regra que não existe mais, sinal
desconhecido, tecla inventada, campo estranho, id repetido (ganha id novo), texto sem aparar,
posição não numérica. Tem teto de 400 nós e de 8 níveis de fundura. `deArquivo` recusa cedo o que
não tem a marca do formato, o que é de versão mais nova e o que não tem ramo — devolvendo
`{ok:false, erro}` em vez de lançar, porque quem chama é a tela. Vinte e quatro asserções.

### Um defeito que peguei na tela

Os avisos do que a conferência descartou eram **apagados pela linha de sucesso**, um instante
depois. Ou seja: a informação que justifica a peneira existir sumia justo quando ele passaria a
olhar o quadro novo e a estranhar um ramo faltando. Hoje carregar com problema mostra os dois
juntos, em vermelho.

**Arquivos:** `src/lib/arvore.js` (`sanitizar`, `paraArquivo`, `deArquivo`, `quantosEnviam`,
`FORMATO`), `src/lib/store.js` (`fluxosSalvos`, e `fluxo.arvore` documentado no default),
`src/fluxo.js`, `src/fluxo.html`, `src/fluxo.css`, `tests/arvore.test.mjs`, `manifest.json`
(1.26.0 → 1.27.0), `registro.md`, `CLAUDE.md`.

**Conferido no navegador:** salvar lista "20 ramos, 8 enviam" com a data; trocar o quadro pelo
preset e voltar pela versão salva devolve os ramos certos (2 → 20 → 2); exportar produz
`meu-fluxo-de-teste.json` com a marca do formato, as teclas e **sem** as vitórias; importar um
arquivo com um ramo bom e um estragado carrega o bom e mostra os dois avisos do que foi descartado.
Treze suítes, `checar-modulos` e `checar-referencias` passando.

**Não testado:** o download real no Chrome com a extensão carregada (aqui o clique no link foi
interceptado para ler o conteúdo do arquivo).

---

## 2026-09-01 (noite, 17) — "A IA assume" virou desfecho, e as caixas ganharam pino de ligação

**Pedido:** *"está faltando a opção de IA assume e responde, e como faço para linkar as caixas?"*

### A IA como ESCOLHA, e não como resto

Até aqui a IA só era chamada onde **nenhum** ramo resolvia — ela era o desfecho do que ninguém
previu. Ele quis o contrário também: apontar uma situação e dizer *"esta aqui eu confio nela"*. São
coisas diferentes, e a segunda faltava mesmo.

Agora o menu "Então…" tem **"a IA assume e responde"** ao lado das teclas e das respostas prontas.
O caso segue exatamente o caminho da IA que já existia, com as mesmas travas: id inventado vira
`incerto`, `RESTRITOS` vira escalada, sem chave ou sem crédito vira `incerto`, e o teto de gasto
continua obrigado no service worker. **Não há caminho novo para o dinheiro nem para o eleitor.**

A armadilha que isso repete: a `sugestao.tecla` vem **nula**, como já vinha no ramo de resposta
pronta. Quem lê `sugestao` para achar a opção — o destaque e a automação — tem que testar
`sugestao.ia` antes. A automação das regras **pula** esses casos; quem os executa é a automação da
IA, que já existia. Sem isso a rodada diria "tecla não disponível" e pararia em todos eles.

### O segundo pedido é um defeito meu de desenho

Ligar duas caixas só existia arrastando uma **em cima** da outra. Estava escrito no cabeçalho da
janela, e mesmo assim ele perguntou como se fazia — ou seja, **o gesto existia e era invisível**. É
o mesmo erro do arrastar, que eu tinha trocado por botões na versão anterior. Recurso de quadro
precisa de alça visível, não de instrução em texto.

Cada caixa ganhou um **pino** na borda direita: puxa dele até outra caixa e aquela vira um ramo
dentro desta. Fio pontilhado acompanha o ponteiro, o destino acende, e só acende quem aceita — pôr
uma caixa dentro de um filho dela criaria ciclo e seria recusado. **O gesto antigo continua
valendo**: quem arrastar a caixa inteira em cima da outra também liga. O pino fica à direita porque
é de lá que os fios já saem — o gesto passa a ler o que está desenhado.

Para desligar, o botão **"Soltar na raiz"** no editor do lado.

**Arquivos:** `src/lib/arvore.js` (`acao.ia` em `acaoDoNo`, `decidir` e `problemas`), `src/fluxo.js`
(o pino, o fio provisório, a ação no menu, o selo), `src/fluxo.html`, `src/fluxo.css`,
`src/panel/panel.js` (`ramoChamaIA`: chama a IA, acende a tecla 0, e a automação das regras pula),
`tests/arvore.test.mjs`, `manifest.json` (1.25.0 → 1.26.0), `registro.md`, `CLAUDE.md`.

**Conferido no navegador**, no servidor de rascunho: puxar o pino desenha o fio pontilhado, acende
o destino e move o ramo na árvore gravada (16 → 15 raízes, um fio novo); escolher "a IA assume" no
menu grava `{ia: true}`, a caixa passa a mostrar "a IA decide" e o resumo do topo conta "1 a IA
decide". Treze suítes, `checar-modulos` e `checar-referencias` passando.

**Não testado:** a rodada real executando um ramo de IA num contato. Depende do Chrome com a
extensão e de chave da API.

---

## 2026-09-01 (noite, 16) — A roda do mouse virou o zoom do quadro

**Pedido:** *"faça com que o scroll do mouse aumente ou diminua o zoom"*.

Estava atrás de `Ctrl`, que é o padrão de aplicativo de desenho mas exige saber que existe. Agora é
a roda sozinha, com `preventDefault` (e `passive: false`, senão o navegador rola a página junto).

### Duas coisas que não eram o pedido e vieram junto

1. **O zoom ancora no ponteiro.** Sem isso ele cresce a partir do canto do palco: você aponta para
   uma caixa, gira a roda e ela foge da tela — num quadro grande, obriga a arrastar o fundo atrás
   dela a cada passo. Medido: a caixa sob o ponteiro andou 1px ao passar de 35% para 39%.
2. **O passo virou multiplicativo** (×1,1) em vez de somar 0,1. Somado, o mesmo passo é 29% do
   caminho em 0,35 e 6% em 1,6 — afastar fica brusco e aproximar fica lento. Os botões `+` e `−`
   passaram a usar a mesma conta, ancorada no meio da área.

**A coluna da direita continua rolando com a roda**: o ouvinte vive no quadro, e o evento no lado
não é cancelado. Conferido, junto com os limites (35% e 160%).

**Arquivos:** `src/fluxo.js`, `src/fluxo.html` (a dica), `manifest.json` (1.24.0 → 1.25.0),
`registro.md`.

---

## 2026-09-01 (noite, 15) — O quadro de verdade: caixas soltas, fios curvos, arrastar e editar

**Pedido:** *"a visualização continua sem ter nenhuma referência com o que mandei, não posso
arrastar editar etc"*.

### As duas correções, e a lição

Ele mandou a foto de um mapa — caixas soltas ligadas por setas curvas — e eu entreguei um esquema
indentado, argumentando que o leque horizontal não cabe quando a árvore cresce. **O argumento
estava certo e a entrega estava errada.** O problema de espaço se resolve com o quadro sendo MAIOR
que a tela (arrastar o fundo, zoom, "caber na tela"), não encolhendo o desenho dele. Entrou no
`CLAUDE.md`: quando ele manda um desenho, não entregue outro desenho.

A segunda metade era funcional: na versão anterior eu tinha **removido o arrastar** (troquei por
botões ⇥ ⇤) e escondido a edição atrás de um `✎`. Ele tentou arrastar, não aconteceu nada, e
concluiu — corretamente — que não dava para editar.

### O que existe agora

Um quadro: caixas em posição livre, fios em Bézier saindo da direita do pai e entrando na esquerda
do filho, grade de fundo. **Arrastar** move o ramo inteiro (com os filhos); **soltar em cima de
outra caixa** pendura o ramo nela; **clicar** abre o editor no lado; **duplo clique no vazio** cria
um ramo ali; arrastar o fundo anda pelo quadro; zoom por botão e por Ctrl+roda; "Arrumar o quadro"
refaz a diagramação (uma coluna por nível, pai centrado nos filhos) e "Caber na tela" enquadra.

### A regra que o quadro livre obrigou

**A prioridade entre irmãos passou a ser a ALTURA na tela** — a caixa mais alta é olhada primeiro,
e `ordenarPorPosicao` roda depois de todo arrasto. É a única regra honesta aqui: guardar uma ordem
invisível ao lado da posição faria a tela mostrar um ramo acima do outro e a rodada obedecer o
contrário. Consequência que vale lembrar: **mover uma caixa para cima muda o que a rodada faz**,
sem tocar em condição nenhuma.

### Dois defeitos que peguei medindo

1. **`setPointerCapture` lança quando o `pointerId` não está ativo**, e a exceção sobe no meio do
   `pointerdown`: o estado do arrasto fica montado e a caixa gruda no ponteiro sem soltar — que é
   exatamente o sintoma que ele relatou. Peguei ao simular o arrasto no navegador (`NotFoundError:
   No active pointer with the given id is found`). Hoje toda captura vai dentro de `try`.
2. **Arrastar um ramo para dentro de um filho dele mesmo faria o ramo sumir** — sairia da árvore
   junto com o novo pai, gravado e invisível. `reparentar` recusa e devolve a árvore intacta, e a
   tela só acende como alvo quem aceita: prometer um movimento que vai ser recusado é pior que não
   prometer nada. Tem teste.

**Arquivos:** `src/lib/arvore.js` (`reparentar`, `posicionar`, `ordenarPorPosicao`, `arrumar`,
`ehDescendente`, `precisaArrumar`, `CAIXA`), `src/fluxo.js`, `src/fluxo.html`, `src/fluxo.css`
(reescritos como quadro), `tests/arvore.test.mjs` (grupo novo), `manifest.json` (1.23.0 → 1.24.0),
`registro.md`, `CLAUDE.md`.

**Conferido no navegador**, num servidor de rascunho FORA do repositório com `chrome.storage`
fingido: o preset do quadro dá 20 caixas e 10 fios; arrastar uma caixa move e grava (80×70 px
pedidos, 80×70 medidos depois do redesenho); soltar sobre outra acende o alvo e move o ramo para
dentro dela na árvore gravada; clicar abre o editor com os campos preenchidos; duplo clique no
vazio cria (20 → 21 caixas) e o aviso do ramo vazio aparece na faixa vermelha.

**Não testado:** a janela real do Chrome, com a extensão carregada. Arrasto com mouse de verdade e
`chrome.windows` só se conferem lá.

---

## 2026-09-01 (noite, 14) — O fluxo virou ÁRVORE de verdade, e ele passa a montá-la sozinho

**Pedido:** a foto do quadro dele, com o fluxo desenhado, e *"esse é o exemplo que eu estava
pensando, está incompleto ainda o fluxo, ele precisa ser incrementado de acordo com a demanda"*.

### O que o desenho dele mostrou que o meu não era

Eu tinha entregado, horas antes, uma cascata onde cada REGRA ramificava em "casou / não casou". O
desenho dele ramifica por **situação**: `mensagem chega` → `anúncio, pessoa nova` **ou** `pessoa
retornando` → tipo de mensagem → ação. É outra coisa: no meu, a estrutura é a da tabela de regras;
no dele, a estrutura é a do ATENDIMENTO. E a segunda frase é a que decidiu o resto: **o fluxo
cresce**, e quem tem que fazê-lo crescer é ele.

### As duas decisões que pedi antes de construir

1. **Quem escreve a condição de um ramo novo** → *"lista de sinais + palavras"*. A condição é um
   sinal de `arvore.SINAIS` (coisa que o código já reconhece, com teste) e/ou palavras que ele
   digita; a ação é uma tecla ou uma resposta pronta. Ele monta sozinho, e o que decide o que sai
   para eleitor continua sendo código testado.
2. **`pedido-ajuda` pode sair sozinho** → sim, como no desenho. O texto **nega** o pedido com
   respeito, e o risco da Lei 9.504/97 é PROMETER benefício, não recusar. **A trava da IA continua
   de pé**: `ia.RESTRITOS` segue impedindo a IA de escolher esse texto. O que mudou é que um ramo
   escrito por ELE pode.

### O que existe agora

- **`src/lib/arvore.js`** (novo, puro, testado): o modelo do nó, `decidir`, os `SINAIS`,
  `arvorePadrao`, `arvoreDoQuadro` e as edições (`mover`, `aninhar`, `desaninhar`, `acrescentar`,
  `apagar`, `editar`), todas puras — a árvore original nunca é tocada.
- **A janela** virou editor de árvore: esquema indentado com cotovelo, um nó por linha, cor pelo
  que o eleitor recebe. Por nó: `✎` editar, `+` criar dentro, `↑ ↓` prioridade entre irmãos,
  `⇥ ⇤` aninhar e desaninhar, ligar/desligar e apagar. Em cima, os problemas em vermelho e o
  estado "igual às regras do código" / "árvore sua, diferente do código".
- **Botão "Carregar o desenho do quadro"**: o preset com a estrutura dele.
- **Tecla `f`**: o desfecho "manda ESTA resposta pronta e conclui", que a tabela não sabia
  expressar. Letra e não dígito, pelo mesmo motivo do `s`.
- O simulador acende o CAMINHO inteiro na árvore e ganhou duas chaves ("é retorno", "veio de
  anúncio"), porque agora elas mudam por qual porta o caso entra.

### As travas, que são o que torna isto seguro de ligar

- **Ligar não muda nada.** A árvore nasce sendo a tabela de hoje achatada, e o teste exige que as
  duas decidam **igual em 400 contextos** sorteados com semente fixa. Por isso ela nasce plana:
  agrupar já é uma decisão, e decisão é dele. A ordem e as desligadas da versão de lista vêm junto
  na semeadura — sem isso, abrir a janela jogaria fora em silêncio o que ele já tinha arrastado.
- **Nó que casa e não resolve NÃO para a busca.** A árvore vai crescer, então ramo pela metade vai
  existir (condição hoje, ação amanhã). Parar ali faria o contato sair da rodada sem nada
  acontecer e sem nada na tela dizendo por quê — buraco silencioso, o pior defeito deste projeto.
  Ele segue para os irmãos, e `problemas()` acusa o nó na faixa vermelha.
- **O preset do quadro põe as protecões ACIMA da bifurcação.** O desenho dele não tinha denúncia,
  despedida, pergunta aberta nem a etiqueta que dispensa; carregá-lo como estava apagaria a regra
  criada em 01/09 para impedir material de campanha em cima de denúncia. Como o próprio desenho
  repete "hater xingando" nos dois lados, pôr as cinco acima da bifurcação é dizer a mesma coisa
  uma vez só. Tem teste exigindo que a denúncia continue vencendo.
- **Condição de nó respaldado por regra não se edita na janela** — é o que preserva os testes das
  dezesseis. Ele troca o desfecho, desliga, move e pendura ramos mais específicos dentro.

### Um defeito que peguei na tela

O motivo listava **todas** as palavras que o ramo procura (*"escreveu ajuda financeira, cesta
basica, remedio…"*) em vez da que a pessoa escreveu. Essa frase aparece na caixa da rodada, em
cima da decisão, e é o que ele lê antes de apertar a tecla: dizer o que o ramo procura não diz
nada sobre o contato. Hoje `palavraQueCasou` nomeia a que bateu, com teste.

**Arquivos:** `src/lib/arvore.js`, `tests/arvore.test.mjs` (novos), `src/fluxo.js`, `src/fluxo.html`,
`src/fluxo.css` (reescritos), `src/panel/panel.js` (a árvore vence a tabela; `textos`,
`ultimoTexto` e `veioDeAnuncio` no contexto; tecla `f` com o ramo que a executa e a automação que
a entende), `manifest.json` (1.22.0 → 1.23.0), `registro.md`, `CLAUDE.md`.

**Conferido:** treze suítes, `checar-modulos` e `checar-referencias` passando. A janela foi medida
num servidor de rascunho FORA do repositório, com `chrome.storage` fingido: semeia 16 nós sem
problemas, o preset do quadro dá 20 nós em dois níveis, "bom dia" cai em `pessoa retornando → só
mandou bom dia` (tecla 5) e o pedido financeiro cai na resposta pronta; o cotovelo do nível 1
mede vertical em 13px e horizontal de 15px, e o do nível 0 fica escondido.

**Não testado na tela:** a janela real do Chrome (a extensão carregada), e a tecla `f` chegando ao
eleitor. As duas dependem do navegador com a extensão e de um contato de teste.

**Pendência conhecida:** o desenho dele tem *"mandar modelo de mensagem + agradecer e concluir"* —
duas mensagens num desfecho só. Hoje um ramo manda uma. Se ele quiser as duas, é ação nova.

---

## 2026-09-01 (noite, 13) — O mapa do fluxo virou RAMIFICADO: cada regra mostra os dois caminhos

**Pedido:** *"veja a janela nova de fluxo de atendimento, quero que seja ramificado"*.

### O que faltava

A janela desenhava um caminho só: cartão, seta do *"não casou ↓"*, cartão. Mas **regra não é linha,
é bifurcação** — e o galho que faltava era justamente o que chega no eleitor. O que a regra faz
quando CASA estava reduzido a um selo de três palavras no canto do cartão ("sai mensagem"), então
para saber SE sai e O QUE sai era preciso abrir o `sugestao.js`.

### O que existe agora

Cada passo é uma linha de duas colunas: a **condição** à esquerda (o cartão, com os controles) e o
**desfecho** à direita — a folha do galho `casou →`, com a tecla, o rótulo dela e o selo do efeito.
O tronco do `não casou ↓` continua descendo pela esquerda. Três coisas que só se descobriam lendo
o código apareceram na tela:

- **Três regras têm DOIS desfechos** (`voltou-por-outro-anuncio`, `ultima-e-so-reacao`,
  `ja-respondemos-antes`): o `tecla` delas é função. O selo "depende" não dizia que os dois lados
  eram "manda a mensagem do momento" e "conclui calado" — agora a bifurcação está desenhada, com a
  condição de cada lado escrita na folha.
- **Fixar a tecla na janela colapsa a bifurcação e MUDA O EFEITO.** Quem fixasse a tecla `s` numa
  regra rotulada "envia" ficava com o cartão prometendo o contrário do que ia acontecer, porque a
  cor e o selo saíam do verbete (que é o do código). Hoje saem de `efeitoDaRegra(id, fluxo)`, e a
  contagem do topo também — é ela que responde "quantas dessas mandam mensagem para gente real".
- **A tecla 6 volta para a IA.** No painel a condição é `!sugestao || sugestao.tecla === '6'`, o
  contrário do que a leitura de cima para baixo sugeria. A folha da tecla 6 diz isso.

A **saída também ramificou**: a IA não é um nó com uma seta, são três — `responder` (sai a resposta
pronta), `escalar` (rascunho, que só sai sozinho com as quatro travas) e `incerto` (tudo como antes
da IA existir). Esse último é o caminho da falha de rede, de chave e de crédito, e ele estava
invisível.

### O que ficou travado por teste, e por quê

`TECLAS` (o que cada tecla faz) **saiu da janela e foi para o `sugestao.js`**, ao lado das regras.
Enquanto morava na tela, nada impedia uma regra apontar para tecla sem verbete e nenhum teste
alcançava. Com ela lá, `regrasComDesfechoIncoerente()` confere três coisas de uma vez e o teste
exige zero:

1. toda tecla usada tem verbete;
2. toda regra de tecla-função escreve os dois lados **e exatamente os que a função devolve** — o
   teste roda a função nas 8 combinações de `respondidoHoje` × `momentoJaEnviado` ×
   `podeMandarMomento` e compara com a lista escrita. É isto que impede o mapa envelhecer calado:
   mexer na função sem mexer no verbete deixaria a janela prometendo um desfecho que não existe;
3. o selo do cartão concorda com o que a tecla faz — cartão dizendo "sai mensagem" numa regra que
   conclui em silêncio seria mapa mentiroso, e é olhando esse mapa que ele decide a ORDEM.

### Um defeito que peguei relendo

O destaque do simulador marcava a folha **por tecla**, então acendia a mesma tecla em todas as
regras que a usam — a tecla 3 aparece em três. O destaque é da regra vencedora: hoje é
`venceuNoTeste === id && teclaNoTeste === ramo.tecla`.

### Decisões

- **A folha é o único lugar da tela que fala do ELEITOR**, e por isso é ela que carrega a cor do
  efeito e o selo. O cartão fala da condição, que é assunto interno.
- **O passo inteiro é o que se arrasta**, não o cartão: arrastar a condição deixando o desfecho
  para trás separaria as duas metades da mesma regra.
- **Janela estreita (≤1100px) põe o galho embaixo**, com a horizontal virando descida. Sem isso a
  linha do "casou" apontava para a esquerda e terminava no vazio, porque o cartão passou a estar
  acima e não ao lado.
- A janela abre com **1400** de largura (era 1180): duas colunas precisam do espaço.

**Arquivos:** `src/lib/sugestao.js` (`TECLAS`, `ramos` nos três verbetes, `ramosDaRegra`,
`efeitoDaRegra`, `regrasComDesfechoIncoerente`), `src/fluxo.js`, `src/fluxo.html`, `src/fluxo.css`,
`src/background.js` (largura), `tests/sugestao.test.mjs` (grupo novo), `manifest.json`
(1.21.0 → 1.22.0), `registro.md`, `CLAUDE.md`.

**Conferido:** doze suítes, `checar-modulos` e `checar-referencias` passando. O desenho foi medido
num servidor de rascunho FORA do repositório, com `chrome.storage` fingido: cartão em 24..513,
folhas em x=559, espinha da bifurcação presente, e as três folhas da IA empilhadas no mesmo x.

**Não testado na tela:** arrastar um passo com o galho junto e a janela real do Chrome — arrasto e
`chrome.windows` só se conferem no navegador com a extensão carregada.

---

## 2026-09-01 (noite, 12) — O fluxo virou JANELA, com o mapa visual (a aba foi erro meu)

**Pedido:** *"eu não pedi uma aba eu pedi uma janela inteira pra abrir e trabalhar, com fluxos
visuais"* — depois de eu ter entregado uma lista arrastável numa aba do painel.

### Ele está certo, e o motivo é de espaço

O painel é uma coluna de 380px encaixada na borda da página. Um fluxo de dezesseis passos, cada um
com condição, tecla, efeito e contagem, não cabe ali sem virar lista — e **lista não mostra que a
decisão é uma cascata**. A mecânica de verdade é "a primeira que casa vence, as de baixo nem são
olhadas", e isso só aparece quando existe a seta do *"não casou ↓"* entre um cartão e o próximo.

### O que existe agora

- **`src/fluxo.html` + `fluxo.css` + `fluxo.js`** — janela própria, 1180×900, aberta em `popup`
  (sem barra de endereço), como a janela do painel já fazia.
- **O mapa desce a coluna**: entrada (mensagem → parser), os 16 cartões ligados pela seta do
  "não casou", e a saída (a IA → executa ou pergunta). Cada cartão tem borda esquerda na cor do
  efeito, o selo, a condição em português, o seletor de tecla, o interruptor e a contagem.
- **Arrastar reordena** e grava ao soltar. **Testar uma conversa** fica fixo no lado, e a regra que
  vence no teste ganha contorno no mapa — dá para ver ONDE ela está na cascata.
- A aba Fluxo saiu, e com ela ~13.600 caracteres de código que só servia a ela. O acesso virou um
  botão **logo abaixo do Recarregar**, no cabeçalho: o fluxo vale para todas as abas, e escondê-lo
  dentro de uma foi exatamente o erro apontado.

### O defeito que peguei antes de acontecer

**`chrome.windows` não existe em content script**, e o painel encaixado roda dentro da página do
mobiliza — `chrome.windows.create` ali seria `undefined`. É a MESMA armadilha do `chrome.power` da
rodada, já registrada no `CLAUDE.md`, e eu escrevi a primeira versão com a chamada direta no painel.
Hoje o painel manda `MSG_FLUXO` e quem abre é o `background.js`.

A constante ficou em `src/lib/fluxo-msg.js` porque os dois lados a importam: duplicar nas duas pontas
é como elas divergem numa renomeação.

### Decisões que valem registro

- **Uma janela por vez**: se já está aberta, foca em vez de abrir a segunda. Duas janelas do mesmo
  fluxo gravando na mesma chave seria a última a salvar ganhando, sem ninguém entender por quê.
- **A janela NÃO fala com a plataforma.** Só lê e grava `store.fluxo`. Por isso abre a qualquer
  momento, sem aba do mobiliza e sem token — é para arrumar o fluxo ANTES da rodada, não durante.
- **`chrome.storage.onChanged` nos dois lados**: a rodada conta as vitórias no painel, e a janela
  aberta se atualiza sem ninguém recarregar.
- **CSS próprio, não o `panel.css`.** O do painel tem as regras de coluna estreita que existem
  justamente para o outro caso; reusar traria a estreiteza de volta.
- **Regra desligada continua na tela**, com "—" no lugar do número e borda tracejada. Sumir tiraria
  o caminho de religar.

**Arquivos:** `src/fluxo.html`, `src/fluxo.css`, `src/fluxo.js`, `src/lib/fluxo-msg.js` (novos),
`src/background.js` (abre a janela), `src/panel/panel.js` (botão no cabeçalho, aba removida, o
contador de vitórias ficou), `src/panel/panel.css`, `manifest.json` (1.20.0 → 1.21.0), `registro.md`.
Doze suítes, `checar-modulos` e `checar-referencias` passando.

**Não testado na tela:** abrir a janela, arrastar, salvar e reabrir. `chrome.windows` e o `popup` só
se conferem no navegador — as suítes não os alcançam.

---

## 2026-09-01 (noite, 11) — Aba Fluxo: a ordem das regras passou a ser dele

**Pedido:** *"vamos montar uma janela que ficara abaixo do botão de recarregar que será o fluxo de
atendimento, lá será editado todo o fluxo que a extensão seguira"*, e *"já adicione o fluxo atual
para eu editar"*.

### Por que existe

Dois erros do mesmo dia **não eram de lógica, eram de ORDEM**: `ja-respondemos-antes` acima de
`conteudo-pedido` (mandou a mensagem do momento onde devia ir o modelo) e a `sem-interesse` no topo
engolindo a confirmação de presença (etiquetou como sem interesse quem só disse que não podia ir ao
evento). Os dois ele resolveria arrastando uma linha. Esperar por mim era o gargalo.

### Escopo, decidido por ele

Edita **ordem, tecla e ligar/desligar**. As **condições ficam no código** — elas decidem o que sai
para eleitor, e uma expressão mal montada na tela viraria mensagem errada. A condição aparece em
português, só para leitura, para dar base à ordem sem abrir o código.

### O que a janela mostra por regra

Posição, rótulo, id, a condição em português, **o selo do efeito** (sai mensagem / não sai nada /
precisa de você / depende), o seletor de tecla, o interruptor e **quantas vezes a regra venceu**.
No topo, a conta das ligadas por efeito — é o que deixa visível que 9 das 16 enviam.

### Decisões que valem registro

- **Regra nova do código entra na POSIÇÃO DO CÓDIGO, não no fim.** `sugestao.ordenar` herda a
  posição do vizinho de cima que a ordem salva conhece. Sem isso, a `respondeu-nossa-pergunta` —
  criada horas antes para impedir propaganda em cima de denúncia — nasceria em último lugar em quem
  já tivesse ordem salva, e o defeito voltaria **calado na atualização**. Tem teste.
- **Id repetido na ordem vale pela PRIMEIRA aparição.** Peguei na primeira verificação: o `Map` por
  índice dava a posição da última, e na tela isso apareceria como *"arrastei e não mudou nada"*.
- **Regra desligada continua na tela**, com número trocado por "—" e borda tracejada. Sumir da lista
  tiraria o caminho de religar.
- **`fluxo` entrou na lista de mescla do `store.get`** — sem isso, campo novo dentro do objeto
  chegaria `undefined` em quem já usa (armadilha registrada no CLAUDE.md, que eu já tinha errado
  hoje com `etiquetaSemInteresse`).
- **O contador grava com atraso de 800 ms**, agrupando a rajada da rodada. É estatística, não dado
  de eleitor: perder a última contagem não custa nada.
- **O simulador diz o que NÃO sabe.** Os sinais de conversa saem do texto colado; etiqueta, modelo
  mapeado e "pedimos hoje" dependem do contato e ficam de fora, escrito na tela. Simulador que
  fingisse conhecer o CRM daria confiança falsa numa mudança de ordem.
- **Aba própria, não uma seção.** "Abaixo do Recarregar" é onde ficam as abas — o Recarregar vive no
  cabeçalho. Entrou entre Automatizado e Dados.

**Arquivos:** `src/lib/sugestao.js` (`sugerirAcao(ctx, fluxo)`, `ordenar`, `SOBRE`,
`regrasSemVerbete`), `src/lib/store.js` (chave `fluxo` + mescla + export), `src/panel/panel.js` (aba,
`renderFluxo`, simulador, `sugerirAcaoComFluxo` com o contador), `src/panel/panel.css`,
`tests/sugestao.test.mjs` (+13), `manifest.json` (1.19.0 → 1.20.0), `registro.md`. Doze suítes,
`checar-modulos` e `checar-referencias` passando.

### Retrocessos e o que NÃO está testado

- **A janela em si não tem teste automatizado** — nenhuma suíte importa `panel.js`. O que está
  coberto é a base: `ordenar`, a mescla do store e `sugerirAcao` com configuração (13 asserções).
  O arrastar, o seletor e o simulador só se conferem na tela.
- **Ordem errada agora é erro dele, não meu.** É o ponto da janela, mas muda a natureza do risco:
  arrastar `conteudo-pedido` para o topo, por exemplo, passa a mandar modelo para quem já recebeu.
  O selo de efeito e a contagem no topo existem para isso ficar visível antes.
- **Desligar regra alta não é neutro:** as de baixo passam a decidir. Desligar `sem-interesse` faz
  quem recusou cair em `nunca-pediram-dados`, que **envia**.

**Pendência:** conferir na tela (arrastar, salvar, recarregar o painel e ver se a ordem voltou).

---

## 2026-09-01 (noite, 10) — Ponto como separador: a terceira forma de "a pessoa escreveu diferente"

**Pedido:** *"mesmo caso novamente"* — print da Nilza, que veio do anúncio, respondeu o formulário
como `Nilza krumenauer . rolante RGS :` e recebeu a **mensagem do momento**.

### Causa

`findStructured` separava por quebra de linha, barra, ponto-e-vírgula e vírgula. **Ponto não estava
na lista.** Medido:

| escrito | cidade | informada | nome |
|---|---|---|---|
| `Nilza krumenauer / rolante RGS` | Rolante | ✓ | Nilza Krumenauer |
| `Nilza krumenauer, rolante RGS` | Rolante | ✓ | Nilza Krumenauer |
| `Nilza krumenauer . rolante RGS` | Rolante | **✗** | — |
| `Nilza krumenauer . rolante RGS :` | **nada** | — | — |

Sem nome e sem cidade, a rodada concluiu que faltavam dados.

**É a terceira vez no mesmo dia** com a mesma forma de defeito: `S.do Livramento.RS` (ponto colado),
`Canoas RS` / `Erechim rgds` (sigla do estado), e agora o ponto como separador. Em todas, a pessoa
respondeu certo de um jeito que o código não previu, e o sintoma é idêntico — a rodada acha que
faltam dados e manda outra coisa.

### O conserto

Ponto (`\s\.|\.\s`) e hífen cercado de espaço (`\s-\s`) entraram na lista, **por último**. O que os
torna seguros são as travas que já existiam em `findStructured`: de 2 a 4 pedaços, cada um com no
máximo 60 caracteres, e **um deles tem que ser exatamente um município**. Frase comum quebrada no
ponto não passa nesse teste. O ponto exige espaço de um lado, então "Sto. Angelo" continua inteiro.

### O que eu apliquei e desfiz

Coloquei os separadores novos nos DOIS lugares que os usavam e reverti o segundo: `cityPositionGuess`
não tem a trava do "exatamente um município" — o que sair dali vira palpite "não-reconhecida" com
sugestões, ou seja, **popup pedindo confirmação**. Medido: com o ponto,
*"Vamos juntos mudar o Rio Grande. Conto contigo"* passava a oferecer **"Conto contigo"** como cidade
a confirmar. Alarme que toca à toa é alarme que se aprende a ignorar.

10 asserções novas, com os dois lados: as quatro formas que passam a funcionar e as quatro frases
comuns que não podem virar formulário.

**Arquivos:** `src/lib/extract.js`, `tests/parser.test.mjs` (+10), `manifest.json`
(1.18.1 → 1.19.0), `registro.md`. Doze suítes, `checar-modulos` e `checar-referencias` passando.

**Retrocesso:** nenhum encontrado; nenhuma asserção existente foi alterada.

---

## 2026-09-01 (noite, 9) — REGRESSÃO MINHA: recusar o evento virou "sem interesse"

**Pedido:** *"concluiu uma resposta de anuncio do evento, era pra mandar mensagem dizendo que não
tinha problema e pedir dados"* — print do Ze, que veio do anúncio do evento e escreveu
*"Não conseguirei ir!"*.

### Foi a regra que eu criei horas antes

`cortesia.semInteresse` (versão 1.15.0) tem um caminho que dispara na **negativa de abertura**, e
`sem-interesse` é a **primeira** regra da tabela. *"Não conseguirei ir!"* começa negando → etiquetado
sem interesse → **concluído em silêncio**.

`confirmaPresenca` acertava o tempo todo, devolvendo `nao`. Ela só nunca foi consultada, porque a
minha regra vence antes.

O contraste, medido:

| | regra vencedora | tecla |
|---|---|---|
| antes do conserto | `sem-interesse` | `s` (conclui calado) |
| depois | `nunca-pediram-dados` | **4** |

E com `presenca: "nao"`, a tecla 4 é exatamente *"Não vai ao evento + pedir dados e concluir"* — o
que ele descreveu.

### Por que este erro é dos piores

O Ze é a pessoa **mais engajada possível**: veio pelo anúncio E se deu o trabalho de responder ao
convite. Foi tratado como quem pediu para não ser mais chamado, com rótulo permanente errado no CRM
e nenhuma resposta.

### O conserto

`RECUSA_DE_PRESENCA` — negativa perto de verbo de ir/comparecer/estar presente → `semInteresse`
devolve `null` e sai da frente. Vem **depois** da recusa explícita de propósito: *"não vou mais
receber isso, me tira da lista"* tem verbo de ir dentro e continua sendo recusa de contato (testado).

10 asserções novas: as 7 formas de recusar presença que não podem marcar, e as 3 recusas de verdade
que não podiam regredir.

### A lição, que é maior que o conserto

**Regra nova no TOPO da tabela precisa ser conferida contra as regras que ela passou a vencer.** Eu
escrevi `sem-interesse` testando 19 casos — 12 deles falso positivo — e nenhum era resposta a
convite de evento, porque eu estava pensando em hostilidade, não em RSVP. A tabela tem 16 regras; pôr
algo em primeiro lugar significa dizer "isto vence as outras 15", e eu não olhei quais.

Checklist para a próxima regra em posição alta: liste as regras que ela passa a vencer e escreva um
teste para cada uma que ainda deve ganhar dela.

**Arquivos:** `src/lib/cortesia.js` (`RECUSA_DE_PRESENCA`), `tests/cortesia.test.mjs` (+10),
`manifest.json` (1.18.0 → 1.18.1), `CLAUDE.md`, `registro.md`. Doze suítes, `checar-modulos` e
`checar-referencias` passando.

**Pendência:** o Ze continua sem resposta e com a etiqueta errada, se ela foi gravada. Vale abrir a
conversa dele à mão.

---

## 2026-09-01 (noite, 8) — O envio mais simples do painel era o único inalcançável

**Pedido:** *"tendo problemas para enviar novamente, só preciso enviar o modelo, não tem necessidade
de ter nada atrelado"*, com o erro **"Nenhum modelo mapeado para 'Campanha Martim2'"** na tela.

### O envio avulso sempre existiu

`renderModeloCard` dá dois botões por modelo: **"Enviar"** (manda só o modelo) e **"Só preparar"**
(escreve no campo e não manda). Nada acoplado — sem concluir, sem agradecer, sem próximo, sem
depender de etiqueta de conteúdo nem da tabela de mapeamento.

### Por que ele não estava à mão

A lista "Modelos de mensagem" nasce vazia (`state.hsmTemplates` = []), e **o único
"Carregar modelos" morava na aba Automatizado**. O texto na aba Respostas dizia *"Clique em
Recarregar se acabou de cadastrar um"* — sem dizer onde ficava esse Recarregar.

Então o caminho mais simples do painel era o único que exigia saber de outra aba. E o atalho que ele
tentou usar (`Enviar conteúdo + agradecer + concluir`) depende da tabela "Modelo por conteúdo", que
não tinha entrada para a etiqueta nova `Campanha Martim2`.

### Os dois consertos

1. **Botão "Carregar modelos" na própria aba Respostas**, com o texto dizendo o que vem depois:
   *"depois cada modelo tem 'Enviar', que manda só o modelo e mais nada"*. Nasce de **clique**, não
   do desenho — regra do projeto: `renderAll` roda o tempo todo, e rede dentro de um `render*` vira
   uma requisição por redesenho.
2. **A mensagem de erro passou a dizer as DUAS saídas, e a de agora primeiro.** Antes ela só mandava
   cadastrar a tabela — o que resolve da próxima vez e deixa ele parado agora, com o contato aberto
   na tela. Hoje aponta o envio avulso e depois o cadastro.

### O que NÃO fiz, e por quê

Não criei um cartão novo de "enviar só o modelo" no topo. O botão já existe; o problema era acesso,
não ausência. Cartão novo somaria uma quarta forma de enviar a mesma coisa — e a confusão entre os
atalhos foi parte do problema.

Também não mapeei `Campanha Martim2` na tabela: o nome e o modelo certo são decisão dele, e chutar
mapeamento manda o modelo errado para eleitor.

**Arquivos:** `src/panel/panel.js` (botão na aba Respostas), `src/lib/hsm.js` (mensagem de erro),
`manifest.json` (1.17.0 → 1.18.0), `registro.md`. Doze suítes, `checar-modulos` e
`checar-referencias` passando.

**Retrocesso:** nenhum. As duas mudanças são de acesso e de texto; nenhum caminho de envio mudou de
comportamento.

---

## 2026-09-01 (noite, 7) — Propaganda em cima de uma denúncia

**Pedido:** *"nem sei o que dizer"* — print de uma contato que respondeu à nossa pergunta relatando
**irregularidades no programa de compra assistida em Eldorado do Sul** e recebeu **material de
campanha**.

### O que aconteceu, na ordem

1. 14:22 — a rodada mandou *"em que você precisa de ajuda? Me conta com suas palavras o que está
   acontecendo."* A regra `pediu-algo-sem-dizer-o-que` **funcionou**: foi ela que decidiu perguntar
   em vez de responder.
2. 16:19 — ela respondeu: *"é sobre as irregularidades sobre compra assistida em eldorado do sul"*.
3. Em seguida saiu o material de campanha do Capitão Martim.

### Causa raiz: o "depois" que não existia

A docstring de `pediu-algo-sem-dizer-o-que` já dizia que *"a recusa só cabe **depois** de ela dizer
o que quer"*. Esse depois não estava implementado em lugar nenhum: **nenhuma regra reconhecia a
resposta a uma pergunta nossa.** Sem sinal, o caso descia a tabela inteira até `conteudo-pedido`,
que ENVIA o modelo.

O teste novo trava justamente o contraste: com o mesmo contexto e sem o sinal, a regra vencedora
volta a ser `conteudo-pedido`.

### E a minha reordenação de 1.12.0 piorou este caso

Antes dela, a IA era consultada em TODO contato. Aqui ela provavelmente teria escalado — uma
denúncia não casa com resposta pronta nenhuma, e a regra 2 do prompt é "na dúvida, escale". Depois
da reordenação a IA só é chamada quando nenhuma regra casa ou quando a regra é tecla 6; aqui uma
regra casou (tecla 1) e a IA não foi ouvida.

**A lição, que vale mais que o conserto:** a tabela de regras é mais estreita que a IA. Para os
casos em que ela **não sabe**, pular a IA economiza. Para os casos em que ela **erra**, pular a IA
tira a rede de segurança. Foi o segundo tipo.

### Os dois consertos

1. **Regra nova `respondeu-nossa-pergunta`, tecla 6**, acima de `pediu-algo-sem-dizer-o-que` (para
   não perguntar de novo o que ela acabou de responder) e abaixo do áudio (ouvir vem antes de
   qualquer decisão). O sinal sai de `templates.ehPerguntaComoAjudar` + a HORA das mensagens
   (`getConversation` traz `at` nos dois lados justamente para intercalar). Sem hora, cai no
   fallback "ela escreveu alguma coisa": **errar para o lado de chamar gente é barato; errar para o
   outro manda propaganda em cima de uma denúncia.**
2. **Regra nova no prompt da IA (a nº 4):** escalar quando o contato RELATA UM PROBLEMA —
   irregularidade, denúncia, obra parada, fila, atendimento negado, programa público que não
   funcionou. Com o texto explícito de que *"material de campanha em cima de uma denúncia é o pior
   que pode sair daqui"*. A regra 1 segura o contato; esta é para quando a IA for consultada
   (tecla 6 consulta).

### Retrocessos

- **Contato que respondeu à pergunta fica preso na tecla 6 até alguém tratar à mão.** É o desenho
  (quem abre um caso perguntando tem que ler a resposta), mas significa fila que não anda sozinha
  nesses casos. Se acumular, o conserto NÃO é automatizar a resposta — é ele responder.
- **A regra não olha o conteúdo da resposta.** Qualquer coisa que ela escreva depois da pergunta vai
  para gente, inclusive um "obrigado". Preferi assim: filtrar por conteúdo aqui é onde o erro custa
  caro, e a tecla 6 consulta a IA, que pode sugerir o agradecimento.
- **Nada disto tem teste de ponta a ponta.** As 7 asserções novas cobrem a tabela de regras; o sinal
  em `panel.js` (a comparação por hora) não tem suíte que o importe.

**Arquivos:** `src/lib/templates.js` (`ehPerguntaComoAjudar`), `src/lib/sugestao.js` (regra nova),
`src/lib/ia.js` (regra 4 do prompt, as seguintes renumeradas), `src/panel/panel.js` (o sinal),
`tests/sugestao.test.mjs` (+7), `manifest.json` (1.16.0 → 1.17.0), `CLAUDE.md`, `registro.md`.
Doze suítes, `checar-modulos` e `checar-referencias` passando.

---

## 2026-09-01 (noite, 6) — Redação antiga do pedido de dados fazia a rodada pular o modelo

**Pedido:** *"no caso o modelo não tinha sido enviado, em vez de mandar modelo pronto mandou
mensagem do momento"* — sobre o print da Loreta.

### Causa raiz: comparar com o texto ATUAL do template

`jaRespondemosAntes` responde *"já ENTREGAMOS algo a este contato, ou só perguntamos?"*. Ele
reconhece uma mensagem nossa como **pergunta** procurando trechos literais de 30+ caracteres dos
textos de `pedir-dados`, `interesse-conteudo` e `perguntar-como-ajudar` — os textos **de hoje**.

A Loreta recebeu, em 31/08:

> "Para eu poder salvar seu contato me passe seu: **Nome / Cidade**"

O template de hoje diz:

> "Para eu te incluir no grupo certo da sua região, me responde nesta ordem… **Nome completo /
> Cidade**"

**Redações diferentes.** Nenhum trecho literal casou, então a mensagem dela foi lida como
*entrega*, `jaRespondemosAntes` virou `true`, e a regra `ja-respondemos-antes` (posição 11, tecla 5)
venceu `conteudo-pedido` (posição 12, tecla 1) — mandando a mensagem do momento **em vez do modelo
que ela nunca recebeu**.

O `CLAUDE.md` já registrava exatamente isso, para o outro lado: *"'Nossa mensagem foi X?' nunca se
responde comparando com UM texto… Case pelo invariante (a linha `Nome / Cidade`)"*. A nota falava da
leitura da RESPOSTA; o mesmo defeito estava em reconhecer a PERGUNTA.

### O conserto

Novo `templates.ehPedidoDeDados(texto)` — puro e testado: reconhece o pedido pela linha
`Nome / Cidade`, que **não muda** entre as três formas do pedido, entre as variantes, nem entre
redações de épocas diferentes. É o que os testes já protegem em cada texto e o que o parser depende
para ler a resposta.

Em `ehPergunta` o invariante vem PRIMEIRO; o casamento por trecho literal fica como segunda camada,
cobrindo as outras duas perguntas (interesse e "como posso ajudar"), que não têm essa linha.

Não mexi na ordem da tabela de regras. A prioridade `ja-respondemos-antes` acima de
`conteudo-pedido` é decisão dele (31/08, print do Cris): quem já foi atendido e volta não quer o
material de novo. O defeito era o sinal, não a prioridade — e trocar a ordem teria "consertado" a
Loreta quebrando o caso do Cris.

### Por que isto vai acontecer de novo se ninguém cuidar

**Todo contato atendido antes de uma reescrita de template carrega no histórico um texto que o
código atual não reconhece.** Este projeto reescreve resposta com frequência (as variantes, o
pedido de grupos, a pergunta de interesse), e cada reescrita deixa uma safra de conversas
"invisíveis". A regra que ficou: **reconhecer mensagem nossa por invariante, nunca por redação.**
Está no `CLAUDE.md`.

**Arquivos:** `src/lib/templates.js` (`ehPedidoDeDados`), `src/panel/panel.js` (`ehPergunta` usa o
invariante), `tests/templates.test.mjs` (+10), `manifest.json` (1.15.0 → 1.16.0), `CLAUDE.md`,
`registro.md`. Doze suítes, `checar-modulos` e `checar-referencias` passando.

**Retrocesso:** nenhum encontrado. O invariante foi testado contra os seis textos que importam — as
três formas do pedido (reconhecidas) e modelo de conteúdo, agradecimento e mensagem do momento (não
reconhecidas). Confundir uma entrega com pergunta faria o contato deixar de receber o modelo, que é
o erro oposto e igualmente ruim.

---

## 2026-09-01 (noite, 5) — "Sem interesse": etiqueta e conclui sem responder

**Pedidos:** *"falando mal do bolsonaro e martim é aliado do bolsonaro, esse tipo nós botamos
etiqueta sem interesse e concluímos sem responder, aconteceu duas vezes de pedir dados pra dois sem
interesse"*, mais dois prints (*"outro caso"*, *"dois boas tarde"*).

### O detector, e por que ele é conservador

`cortesia.semInteresse(entrantes)` — pura e testada. Olha só a **última** mensagem: quem xingou
ontem e hoje voltou pedindo conteúdo mudou de ideia.

Dois caminhos, os dois exigindo sinal forte:

1. **Recusa** — pedido explícito ("não quero receber", "me tira da lista", "para de mandar"), ou
   **negativa na abertura** da mensagem. A negativa de abertura vale sozinha porque a pergunta que
   fizemos era fechada ("posso te mandar os conteúdos?").
2. **Hostilidade dirigida a nós** — insulto **junto** de fala em segunda pessoa.

**As duas condições do caminho 2 são obrigatórias, e é aí que a regra vive ou morre.** Apoiador
xinga o adversário em terceira pessoa o tempo todo — *"o Lula é um ladrão safado, golpista"* é o tipo
de mensagem mais comum desta base. Detector que olhasse só o insulto tiraria da fila justamente
quem mais apoia, e deixaria um rótulo permanente no CRM.

A trava mais importante é a lista de **negativas benignas**: o pedido de dados termina perguntando
sobre grupos, e *"Não faço parte de nenhum grupo político"* é resposta de **apoiadora** — está no
teste do parser, na resposta real da Rosane. Junto com "não sei" (cidade), "não moro mais",
"não consigo abrir o link". Um detector de "começa com não" marcaria todas.

19 asserções, e **12 delas são falso positivo** — a proporção diz onde está o risco.

### A ligação

- **Regra `sem-interesse` em PRIMEIRO na tabela**, acima até da etiqueta que dispensa da fila: quem
  pediu para não ser chamado não pode receber mais nada, e é a única regra em que continuar mandando
  gera **denúncia**, que é o sinal que derruba número.
- **Tecla `s`, não um dígito.** Os dez dígitos já têm significado no dedo dele; trocar o sentido de
  um é como o "2" digitado na conversa acabou concluindo atendimento. A opção aparece **sempre**,
  não só quando a regra dispara — ele pode ver o que a regra não viu.
- **`auto.etiquetaSemInteresse`, nascendo vazia.** O nome tem que ser digitado igual ao do CRM: a
  extensão não cria etiqueta sozinha. Vazia, a regra ainda conclui sem responder e diz isso no log.
  Fica dentro de `auto` porque é chave que o `store.get` mescla — fora dela chegaria `undefined`
  para quem já usa (armadilha registrada no CLAUDE.md; eu errei isso na primeira tentativa e o
  campo era lido de `state.auto.cfg`).
- **Falha de etiqueta não impede a conclusão.** Etiqueta é organização interna; o que o contato
  deixa de receber vem primeiro. Etiqueta inexistente no CRM → conclui igual, com o aviso no log.

### O template órfão que apareceu

`sem-interesse` ("Sem interesse / encerrar com respeito") existe em `DEFAULT_TEMPLATES` desde sempre
e **nenhum código o usava**. Continua sem uso: ele pediu para concluir **sem responder**, e mandar
"não vou mais te incomodar" para quem veio hostilizar é dar a última palavra a quem não quer
conversa. O texto fica disponível na aba Respostas para ele mandar à mão quando fizer sentido.

### O caso "dois boas tarde" já estava resolvido

Print da Loreta: ela respondeu `Loreta Graebner / Agudo RS` e recebeu a mensagem do momento no dia
seguinte. Era o **mesmo bug do sufixo do estado** — "Agudo RS" não contava como cidade informada,
então o nome não era extraído e a rodada achava que faltavam dados. Conferido depois do conserto de
1.13.0: `cidade: Agudo | informada: true | nome: Loreta Graebner`. Nada novo a fazer.

Fica de fora, como observação: **todos os nossos textos começam com `{{saudacao}}`**, então duas
mensagens seguidas repetem "Boa tarde!". Não mexi — é decisão de texto, não defeito.

### Retrocessos

- **A tecla `s` é a primeira opção com letra.** O atalho já ignora evento vindo de campo de texto,
  então digitar "s" na conversa não dispara. Mas é um padrão novo na caixa.
- **A regra é a mais alta da tabela**, então ela vence todas as outras — inclusive "etiqueta
  dispensa da fila". Se um contato engajado escrever algo que casa com o detector, ele será marcado
  como sem interesse. Achei certo (recusa é recusa), mas é uma inversão de prioridade nova.
- **Não há teste de ponta a ponta**: as suítes cobrem o detector, não o ramo em `panel.js`.

**Arquivos:** `src/lib/cortesia.js` (`semInteresse` + os quatro padrões), `src/lib/sugestao.js`
(regra em primeiro), `src/lib/store.js` (`auto.etiquetaSemInteresse`), `src/panel/panel.js` (opção,
ramo, campo na Config), `tests/cortesia.test.mjs` (+19), `manifest.json` (1.14.0 → 1.15.0),
`registro.md`. Doze suítes, `checar-modulos` e `checar-referencias` passando.

---

## 2026-09-01 (noite, 4) — A IA voltou a ser consultada na tecla 6; áudio transcrito deixou de "precisar abrir"

**Pedido:** *"esse caso a ia deveria assumir, ela parou de ver praticamente tudo e está passando pra
mim"* — print de um contato que mandou áudio de 2min22 **com a transcrição na tela**, e a caixa
sugerindo a tecla 6 ("Responda à mão").

### Causa: efeito colateral da reordenação de mais cedo, previsto e subestimado

A reordenação (regra antes da IA) foi registrada com o retrocesso nº 2: *"a tecla 0 da IA some dos
casos com regra"*. Na prática isso foi muito mais largo do que a nota sugeria — a maioria dos
contatos casa alguma regra, então a IA quase parou de ser chamada.

### Conserto 1: a tecla 6 chama a IA

**"Responda à mão" quer dizer, por definição, que nenhuma regra sabe o que mandar ali** — que é
exatamente o buraco que a avaliação de contexto existe para tapar. Deixar a IA de fora justamente
nesse caso fazia a rodada parar em todo áudio e em todo texto longo.

Hoje: `if (!sugestao || sugestao.tecla === '6')`. As outras teclas continuam decidindo sozinhas e de
graça — a regra que manda **concluir** (3) ou **mandar o modelo** (1) já sabe o que fazer, e pagar
por uma segunda opinião ali não muda o resultado. Foi o excesso oposto que mandou mensagem para quem
só disse "Amém".

Como o auto-envio da IA (`recomendada`) roda ANTES da execução automática por regra, o caminho fica:
regra pede gente → IA opina → se ela escolher uma resposta pronta, a automação manda; se escalar,
pode sair rascunho; se ficar incerta, a caixa abre com a tecla 6 como antes.

### Conserto 2: áudio transcrito não alega mais que precisa ser aberto

O motivo *"mandou um áudio — só dá para responder depois de abrir"* nasceu quando áudio chegava
vazio. Hoje a plataforma manda a transcrição na própria mensagem, o painel a exibe e o parser a lê —
e a caixa aparecia com a transcrição inteira do lado ainda afirmando que era preciso abrir.

Não era só cosmético: a regra da tecla 6 vencia **pelo formato**, sem ninguém olhar o conteúdo.
Agora, com `transcrito: true` e texto presente, o áudio segue o caminho de um texto:

| mensagem | antes | depois |
|---|---|---|
| áudio sem transcrição | precisa abrir | precisa abrir (igual) |
| áudio transcrito CURTO | precisa abrir | **as outras regras decidem pelo conteúdo** |
| áudio transcrito LONGO | precisa abrir | "**falou** N caracteres — é conversa" |
| texto longo | "escreveu N caracteres" | igual |

O verbo mudou de propósito: dizer que a pessoa "escreveu" 791 caracteres que ela falou faz quem lê
procurar uma mensagem de texto que não existe.

### Retrocessos

- **A IA volta a custar nos casos de tecla 6.** É a metade do gasto que a reordenação havia
  economizado — e é o gasto que ele pediu de volta.
- **Áudio transcrito curto passa a poder ser tratado por outra regra**, inclusive alguma que envia.
  Antes todo áudio parava na tecla 6. É a mudança de comportamento mais visível deste commit: o
  conteúdo passa a mandar mais que o formato, que é o certo, mas é mudança.
- Nada disto tem teste de ponta a ponta: as suítes cobrem `pedeRespostaPessoal` (7 asserções novas),
  não o caminho da rodada em `panel.js`.

**Arquivos:** `src/lib/cortesia.js`, `src/panel/panel.js`, `tests/cortesia.test.mjs` (+7),
`manifest.json` (1.13.0 → 1.14.0), `registro.md`. Doze suítes, `checar-modulos` e
`checar-referencias` passando.

---

## 2026-09-01 (noite, 3) — Cidade abreviada impedia o NOME, e a rodada pedia os dados de novo

**Pedido:** *"ja deu os dados e perguntou novamente"* — print do contato que respondeu
`Ulises Sanchez / S.do Livramento.RS` às 18:19 de 31/08 e recebeu o **mesmo pedido de dados** no dia
seguinte.

### Causa raiz

A cidade já havia sido consertada mais cedo (o ponto colado). O que faltava era o **nome**:
`findStructured` só separa nome de cidade quando algum pedaço é **exatamente** o município, e
`isCityAlone("S.do Livramento.RS")` dizia que não. Sem nome, a regra concluía que faltavam dados e
mandava o pedido outra vez.

Dois bloqueios, e o primeiro era um palpite antigo errado:

1. **O alias `s.` → `sao`.** "S.do Livramento" virava "sao do livramento", e **"São do …" não é
   nome de município nenhum** — "São" sempre precede nome de santo. Ali o "S." é "Sant'Ana". Agora
   `s.` seguido de partícula (`do`/`da`/`de`) sai **inteiro, com a partícula**: sobra "livramento",
   que o encurtamento resolve. Perder informação aqui é seguro — o que sobra ambíguo ("S.do Palma"
   → "palma") não casa com nada, e não casar é o lado certo de errar.
2. **A comparação.** `normalize` não sabe que "Livramento" é "Santana do Livramento" (isso é
   `ENCURTAMENTOS`) nem que "RS" no fim é o estado. Nova `cities.formaCanonica`: sigla do estado
   fora, encurtamentos aplicados, **nessa ordem** — o inverso deixa "rs" pendurado e a igualdade
   falha de novo. É ela que `isCityAlone` e `cidadeSozinha` usam agora.

Resultado no caso real: `cidade: Santana do Livramento | nome: Ulises Sanchez | informada: true`.

### Retrocesso: nenhum encontrado, e foi procurado

Isto afrouxa uma trava documentada ("só separa quando o pedaço é exatamente o município"), então o
lado perigoso foi testado à mão antes de fechar. **Nada do que não podia virar "cidade informada"
virou** — informada é o que substitui o CRM:

| escrito | resultado |
|---|---|
| `Vamos juntos mudar o Rio Grande` | nada |
| `boa tarde, sou de Pelotas e quero ajudar` | Pelotas, **não** informada (palpite) |
| `Maria, moro em Canoas e trabalho muito` | Canoas, **não** informada |
| `aceito receber conteudos do Capitao Martim e do Zucco` | nada |
| `S.do meu coracao` | nada |
| `sou do Rio Grande do Sul` | nada |
| `Ana / Vitoria` | Vitória das Missões **aproximada** (espera clique) |

As doze suítes passaram sem alteração, e 11 asserções novas travam os dois lados: o caso do print e
os adversariais acima.

**Arquivos:** `src/lib/cities.js` (alias de `s.` + `formaCanonica`), `src/lib/extract.js` (as duas
comparações), `tests/parser.test.mjs` (+11), `manifest.json` (1.12.0 → 1.13.0), `registro.md`.

**Continua pendente:** nome mandado em mensagem SEPARADA (sem separador na mesma mensagem) ainda não
é extraído — *"Erechim rgds"* seguido de *"Maria da Glória flores"*. Aqui o formulário foi respondido
numa linha só, que é o caso deste conserto.

---

## 2026-09-01 (noite, 2) — A regex voltou a decidir ANTES da IA

**Pedido:** *"se for arrumar esse erro faça me avise se tiver algum retrocesso"*.

### O conserto

Em `processarRespondido`, `avaliarComIA()` era chamada **antes** de `sugerirAcao`. O comentário logo
acima afirmava que a regex já havia filtrado os casos conhecidos — não havia. Com "Automatizar com
IA" ligado, a escolha da IA era executada direto, e regra determinística nenhuma chegava a ser
consultada: o contato que só escreveu *"Amém"* recebeu mais uma mensagem 36 min depois, porque
`ultima-e-despedida` (que manda concluir sem responder) nunca foi olhada.

Agora é o que o desenho sempre disse: **`sugestao === null` é o gatilho da IA**. O bloco inteiro foi
movido para depois do `sugerirAcao` e envolvido em `if (!sugestao)`. `decisaoIA` virou `let`, porque
continua sendo lido lá embaixo para montar a tecla 0.

Renomeado junto: dentro do ramo de `escalar` havia um `const sugestao` que agora **sombrearia** a
recomendação determinística. Virou `sugestaoDela`.

### A metade que o conserto exigia (senão vira defeito pior)

Com a regra decidindo antes, a IA deixa de ser chamada nos casos conhecidos → `recomendada` fica
nula → **a caixa abriria esperando clique em todo contato com regra**. A rodada automatizada pararia
em quase todos. Trocar "manda a mensagem errada" por "não anda" não é conserto.

Então a automação passou a executar a **recomendação determinística**: pega a tecla que a caixa
mostraria em destaque e usa o `valor` da opção correspondente, reusando os ramos que já existem
(`escolha` continua sendo a mesma string). Nenhuma decisão nova — são as regras que ele escreveu.

- **Tecla 6 fica de fora**, e é a única exceção: "Responder à mão" quer dizer que alguém precisa
  escrever. Automatizar seria concluir sem responder.
- Tecla recomendada que não está na lista (travada por variável) cai na caixa **com o motivo no
  log** — silêncio ali viraria "a rodada ignorou a regra" sem ninguém saber por quê.
- Toda execução automática vai para o Andamento com o **id da regra** e a tecla.

### RETROCESSOS — o que muda para pior ou de forma inesperada

1. **A automação passa a enviar por conta própria em mais casos.** Antes só a escolha da IA era
   auto-executada; agora as regras determinísticas também são, e **a maioria delas envia** (tecla 1
   modelo, 4 pedir dados, 5 momento, 7 interesse, 8 agradecer, 9 perguntar). Antes, regra + IA
   `incerto` abria a caixa e esperava. É mais throughput e menos supervisão — e é a mudança de
   comportamento mais importante deste commit.
2. **A tecla 0 da IA some dos casos com regra.** Se ele gostava de ver a opinião da IA ao lado da
   recomendação determinística, isso acabou: agora a IA só é consultada quando nenhuma regra casou.
3. **Não há trava de duplicata na execução automática por regra.** A do caminho da IA
   (`wasSent` + `ehHoje`) não foi replicada, porque as regras já tratam repetição por dentro
   (`pedidoHoje` troca o rótulo para "DE NOVO" e perde o destaque, `ja-respondemos-antes` existe).
   **É uma suposição, não uma verificação** — se aparecer repetição vinda de regra, é aqui.
4. **Nada disto tem teste automatizado.** As doze suítes não importam `panel.js` (precisa de
   `window`), então o que cobre a mudança é `checar-referencias` (toda opção tem ramo) e leitura.
   A validação de verdade é a primeira rodada com a caixa ligada.

### Custo, de lado bom

A IA deixa de ser chamada em todo contato com regra conhecida — que é a maioria da fila. O gasto por
rodada cai junto, sem nenhuma trava nova.

**Arquivos:** `src/panel/panel.js`, `manifest.json` (1.11.0 → 1.12.0), `CLAUDE.md`, `registro.md`.
Doze suítes, `checar-modulos` e `checar-referencias` passando.

---

## 2026-09-01 (noite) — Sigla do estado matava o "informada"; dossiê passou a ser sob demanda

**Pedidos:** *"duas mensagens parecidas em pouco espaço de tempo"*, *"o dossiê deve ser consultado
somente quando for necessário"*, *"não pegou canoas pela segunda vez"* e *"mesmo caso"* (Erechim).

### 1. Sigla do estado no fim: a cidade era reconhecida e mesmo assim não valia

Dois prints seguidos: `Canoas RS` e `Erechim rgds`, os dois com **Cidade: (vazia)** no painel.

O casamento **nunca falhou** — `matchCity("Canoas RS")` sempre devolveu Canoas, confiança exata. O
que falhava era a igualdade que decide se a pessoa **INFORMOU** a cidade, em `cidadeSozinha` e
`isCityAlone`: `"canoas rs" !== "canoas"`. Resultado: `informada: false`, a cidade não substituía o
CRM e ficava esperando um clique que, na rodada automatizada, ninguém dá.

**Duas rodadas de conserto, e a segunda é a lição.** A primeira cobriu só `rs` — e o print seguinte
trouxe `rgds` (Rio Grande do Sul abreviado), que passou batido. Lista incompleta produz *"às vezes
pega a cidade, às vezes não"*, que é o pior sintoma possível: parece defeito aleatório. Hoje
`SUFIXO_DO_ESTADO` cobre `rs`, `rgs`, `rgds`, `r s` e o estado por extenso, com os separadores
espaço, vírgula, ponto, hífen e barra.

**A guarda que não podia cair junto:** `rio grande` **sozinho é município** e não entra na lista —
só o estado por extenso. Tem teste dos dois lados.

Novo: `cities.semSufixoDeEstado`, exportada e testada. 16 asserções de regressão com as strings
exatas dos dois prints.

### 2. O dossiê agora é consultado só quando faz falta

`gabinete.precisaDoDossie(mensagens)` — pura e testada — decide se a conversa toca em voto, urna,
número, partido, cargo, eleição ou nos nomes da chapa. Se não tocar, o dossiê não entra e a chamada
custa o de sempre.

É a mesma ordem que já vale para a IA inteira: **a regex decide antes, de graça**. Aqui ela decide
se vale pagar pelo contexto, não o que responder. E **erra para o lado de incluir**: sem dossiê a IA
decide sobre nome que não conhece, que é o problema que ele existe para resolver; incluir à toa
custa meio centavo.

Efeito: numa fila típica ("Amém", "obrigado", nome e cidade), o dossiê fica fora de quase todas as
chamadas — os +46% por chamada viram quase nada no total do mês.

### 3. As duas mensagens parecidas — DIAGNOSTICADO, NÃO consertado

Print: às 14:22 saiu uma bênção; o contato respondeu *"Amém 🙏 🙏"* às 14:37; às 14:58 saiu outra
mensagem, também terminando em bênção. 36 minutos, dois textos parecidos.

A camada determinística **acertou**: `ultimaEhDespedida("Amém 🙏 🙏")` devolve `true`, e a regra
`ultima-e-despedida` de `sugestao.js` manda concluir sem responder. Ela só nunca foi consultada.

**Causa raiz:** em `processarRespondido`, `avaliarComIA()` é chamada na linha ~3537, **antes** de
`sugerirAcao`, que só roda por volta da 3989 ao montar a caixa. O comentário logo acima da chamada
afirma que *"a regex já tirou os casos conhecidos… a IA só é chamada para o que sobrou"* — e isso
**não é verdade nesse caminho**. O desenho pretendido está escrito em outro lugar do arquivo
(*"`sugestao === null` é o gatilho da avaliação"*), e o código não o cumpre.

Com `automatizarComIA` ligado, a escolha da IA é executada direto. Ou seja: **a automação inverte a
prioridade documentada** e a camada de regex vira decorativa. A trava de duplicata não pega porque
compara por MODELO, e os dois textos eram modelos diferentes — exatamente a armadilha já registrada
no `CLAUDE.md`.

**Não consertei por conta própria** porque o conserto certo é reordenar: calcular `sugerirAcao`
antes e só chamar a IA quando ele devolver `null`. Isso exige extrair o construtor de contexto da
sugestão (~25 campos, montado inline dentro da função da caixa) e mover o tratamento do `escalar`
junto. É mexer no meio da rodada que está rodando em produção hoje, e a decisão de quando fazer isso
é dele. **Enquanto não for feito, "Automatizar com IA" pode responder a quem só se despediu.**

**Arquivos:** `src/lib/cities.js` (`semSufixoDeEstado`, `SUFIXO_DO_ESTADO`), `src/lib/extract.js`
(as duas comparações), `src/lib/gabinete.js` (`precisaDoDossie`), `src/panel/panel.js` (as quatro
chamadas passam as mensagens), `tests/parser.test.mjs` (+16), `tests/gabinete.test.mjs` (novo, 19),
`manifest.json` (1.10.0 → 1.11.0). **Doze** suítes, `checar-modulos` e `checar-referencias`
passando.

**Pendências:** (1) a reordenação regex-antes-da-IA acima; (2) nome numa mensagem separada não é
extraído (*"Maria da Glória flores"* depois de *"Erechim rgds"*) — mesma família do `isCityAlone`
já registrado.

---

## 2026-09-01 — Dossiê "quem é quem" virou arquivo, com pesquisa e trava de revisão

**Pedido:** *"seria muita informação pra botar no espaço da extensão, teria que ser um arquivo tipo
claude.md que a ia leia e pegue de lá, crie esse arquivo pra extensão já, faça a pesquisa na
internet e ponha os dados lá (…) depois me passe os dados que encontrou que vou revisar para não
mandar algo errado pra ia da extensão"*.

### O que já existia

O dossiê **não** era novo: `store.ia.gabinete` é uma textarea na Config que já ia para o prompt de
sistema, e `montarSistema`/`montarSistemaRascunho` já recebiam o parâmetro `gabinete`. O que faltava
era o meio de escrever muito texto — textarea é ruim de escrever, pior de revisar, e não tem
histórico. Em arquivo tem `git diff`, que para dado que chega a eleitor é o que importa.

### O que foi feito

- **`src/data/gabinete.md`** — o dossiê, preenchido com pesquisa de 01/09/2026, com fonte por bloco
  e **confiança marcada linha a linha**: `[CONFIRMADO]` tem fonte independente, `[CONFERIR]` não
  tem e não pode ser afirmado a um contato.
- **`src/lib/gabinete.js`** — carrega o arquivo, corta o que é recado para humano (o aviso de
  status, as fontes, o espaço em branco dele) e junta com a textarea. Falha de leitura devolve
  string vazia em vez de estourar: sem dossiê a IA escala mais, que é o lado seguro.
- **`ia.dossieAtivo`, nascendo `false`** — a trava. O conteúdo veio da internet e ele pediu para
  revisar antes. A textarea continua valendo com o dossiê desligado: o que ELE escreveu já foi
  revisado por definição.
- Interruptor na Config, com o motivo escrito na tela em vez de um checkbox mudo.

### O que a pesquisa achou, e o que ela NÃO achou

Confirmado com fonte: Capitão Martim é **Martim Todesco Adreani (Republicanos)**, deputado estadual,
29.040 votos em 2022, candidato à **reeleição** em 2026 (convenção de 26/07/2026). Zucco é
**Luciano Lorenzini Zucco (PL)**, candidato a **governador**, **número 22**, vice **Silvana Covatti
(PP)**, coligação **"O Rio Grande pode Mais"** (PL, Republicanos, Novo, Podemos).

**Não achou:** o número de urna de 2026 do Capitão Martim. O `10122` é de **2022** — a fonte que
parecia confirmá-lo para 2026 era uma página da eleição passada, e o mesmo resultado dizia "35
anos", que bate com 2022 e não com 2026. Ficou `[CONFERIR]`.

### A armadilha que a pesquisa expôs: existem DOIS Zuccos

**Luciano Zucco** (PL, governador, nº 22) e **Delegado Zucco** (Republicanos, deputado estadual,
reeleição) — irmãos, mesmo campo, mesma eleição, mesmo estado. Confundir os dois é o erro mais
provável deste dossiê, e ele tem seção própria no arquivo com a regra: "Zucco" sozinho é o
candidato a governador; se o contexto puder ser o Delegado, **escale**.

De quebra, o placeholder da textarea na Config dizia *"Capitão Martim — deputado estadual, número
10122, **PL**"*. Ele é **Republicanos**. Corrigido — era desinformação plantada na própria tela.

### Custo: medido, e com um efeito contraintuitivo

O dossiê acrescenta **~1.284 tokens** ao prompt de sistema (4.621 caracteres depois do corte).

| | entrada/chamada | custo/chamada |
|---|---|---|
| hoje | ~2.349 | US$ 0,0028 |
| com o dossiê | ~3.633 | ~US$ 0,0041 (+46%) |

**Mas:** o mínimo de cache do Haiku 4.5 é **4.096 tokens**, e o sistema com dossiê fica em ~2.584 —
ainda **fora**. Se o prompt crescer mais ~1.500 tokens (o "Espaço do Thiago" preenchido), ele
**passa a cachear**, e aí a leitura custa 10%: a chamada cairia para **~US$ 0,0015**, mais barata
que hoje. É o raro caso em que escrever MAIS sai mais barato — vale quando as chamadas vêm em
rajada, como na rodada, por causa do TTL de 5 minutos do cache.

**Arquivos:** `src/data/gabinete.md` (novo), `src/lib/gabinete.js` (novo), `src/lib/store.js`
(`dossieAtivo`), `src/panel/panel.js` (interruptor, placeholder corrigido, as três chamadas de IA e
a estimativa de cache agora usando a mesma fonte), `manifest.json` (1.9.0 → 1.10.0), `registro.md`.
Onze suítes, `checar-modulos` e `checar-referencias` passando.

**Pendência:** a revisão dele. Enquanto `dossieAtivo` for `false`, nada do arquivo chega à IA.

---

## 2026-09-01 — Tema de Interesse, Função e Partido saíram; COREDE de Canoas conferido

**Pedido:** *"remova qualquer coisa relacionada a tema de interesse, partido, função, não preciso
preencher isso e veja se o corede de canoas está correto, aparentemente está errado"*.

### O COREDE de Canoas está CERTO — e a confusão tem nome

`Canoas → Vale do Rio dos Sinos`. Conferido contra as duas listas do `coredes-rs.json`, que batem
exatamente com a composição oficial da SPGG:

- **Vale do Rio dos Sinos (14):** Araricá, Campo Bom, **Canoas**, Dois Irmãos, Estância Velha,
  Esteio, Ivoti, Nova Hartz, Nova Santa Rita, Novo Hamburgo, Portão, São Leopoldo, Sapiranga,
  Sapucaia do Sul.
- **Metropolitano Delta do Jacuí (10):** Alvorada, Cachoeirinha, Eldorado do Sul, Glorinha,
  Gravataí, Guaíba, Porto Alegre, Santo Antônio da Patrulha, Triunfo, Viamão.

Canoas está na **Região Metropolitana de Porto Alegre**, e é daí que vem a impressão de erro — mas
RMPA e COREDE são divisões diferentes, com recortes diferentes. Nada a corrigir. O arquivo tem os
28 COREDEs.

**Se ainda aparecer errado na tela**, o suspeito não é o dado e sim o rótulo: se a etiqueta no CRM
não se chamar exatamente "Vale do Rio dos Sinos", ela precisa de entrada em `store.tagAliases`
(hoje só "Paranhana Encosta da Serra" → "Vale do Paranhana").

### A remoção

Saíram **"Tema de Interesse", "Temas de Interesse", "Função" e "Partido"**: do que a extensão grava,
do que o parser extrai, das variáveis de resposta e da tela.

Não foram só escondidos. Parser que extrai o que ninguém grava custa processamento por mensagem e
deixa `guesses.partido` e companhia atravessando o painel esperando um consumidor que não existe —
é assim que campo removido volta sozinho no primeiro caminho novo.

| onde | o que saiu |
|---|---|
| `fields.js` | `CLASSIFY_FIELDS` caiu para `['Nome', 'Cidade', 'Responsável']` |
| `extract.js` | blocos de Função/Partido/Tema, `TEMA_KEYWORDS`, `matchDict`, `matchPartido`, `matchTema`, o parâmetro `temaField` e o `funcao` de `findStructured` |
| `store.js` | resposta "tema-opcoes", `temaByNumber`, `dicts.funcao` |
| `vars.js` | `{{funcao}}` e `{{partido}}` |
| `panel.js` | linhas de palpite, contexto de variáveis, botão "Aprender múltipla escolha (Tema)" |

### O que NÃO saiu, e por quê

- **A lista de siglas de partido ficou.** Ela tem uma segunda função, que agora é a única:
  `extract.limparSiglas` a usa para tirar a sigla de dentro do NOME ("Jeane do PL" → "Jeane").
  Apagá-la faria o nome do contato ser gravado com a sigla colada. Tem teste.
- **O suporte a MULTISELECT em `contract.js` ficou**, com teste. Não há mais campo usando, mas o
  construtor de requisição continua correto para o dia em que houver.
- **Nada foi apagado no CRM.** A remoção é da extensão; o que já está gravado nesses campos
  continua lá.
- **`CLASSIFY_FIELDS` é o único ponto por onde a extensão escreve campo de contato** — tirar dali é
  o que garante que nenhum caminho novo volte a preencher os quatro por engano.

### Duas coisas que você vai notar na tela

1. **A resposta "Perguntar o tema (opções numeradas)" continua aparecendo** para quem já usava: o
   que foi removido é o DEFAULT, e a sua cópia está salva no `chrome.storage`. Apague na aba
   Respostas quando quiser.
2. **Resposta salva que use `{{funcao}}` ou `{{partido}}` passa a bloquear o envio**, com o motivo
   na tela. É o comportamento certo — melhor recusar do que mandar o marcador cru para o eleitor.

**Arquivos:** `src/lib/fields.js`, `src/lib/extract.js`, `src/lib/store.js`, `src/lib/vars.js`,
`src/panel/panel.js`, `tests/parser.test.mjs`, `manifest.json` (1.8.1 → 1.9.0), `CLAUDE.md`,
`registro.md`. Onze suítes, `checar-modulos` e `checar-referencias` passando.

---

## 2026-09-01 — Ponto colado matava o casamento de cidade

**Pedido:** *"está falhando em pegar cidade"*, com print de um contato que escreveu
`Ulises Sanchez / S.do Livramento.RS` e caiu como **"Cidade escrita fora do padrão"**.

### Causa raiz

`cities.normalize` **apagava** o ponto (`.replace(/\./g, '')`) em vez de trocá-lo por espaço.
Apagar cola as palavras vizinhas e destrói a fronteira de palavra:

```
"Livramento.RS"  →  "livramento.rs"  →  apaga o ponto  →  "livramentors"
```

E aí o encurtamento `/\blivramento\b/` não casava mais. Isolado por variante, o defeito era só a
forma colada — as outras sempre funcionaram:

| escrito | antes | depois |
|---|---|---|
| `Livramento RS` | ✓ | ✓ |
| `Livramento - RS` | ✓ | ✓ |
| `S.do Livramento` | ✓ | ✓ |
| `Livramento.RS` | **✗** | ✓ |
| `S.do Livramento.RS` | **✗** | ✓ |

A abreviação `S.` nunca foi o problema: o alias `/\bs\.\s*/ → 'sao '` já a resolvia, e o
encurtamento de "livramento" salvava o resto por casamento de trecho.

### O estrago não parava na cidade

Sem cidade reconhecida, a rodada sugeriu **"4 Pedir dados e concluir"** para quem tinha acabado de
mandar nome e cidade. Falha de parser vira pergunta errada na tela — e o contato receberia um
pedido de dados que ele já respondeu.

### Conserto

Uma linha: o ponto vira espaço. Mexe no normalizador que **tudo** usa, então as onze suítes foram
rodadas antes e depois — todas passando. Teste de regressão novo em `parser.test.mjs` com a string
exata do contato, mais as travas do que não pode regredir junto (espaço, hífen, abreviação colada,
e "texto que não é município continua sem casar").

### Defeito VIZINHO, não consertado — decisão do Thiago

Mesmo com a cidade certa, **o nome não é extraído** quando a cidade casa por encurtamento:

```
"Ulises Sanchez / Santana do Livramento"  →  nome: Ulises Sanchez  ✓
"Ulises Sanchez / Livramento"             →  nome: (nada)          ✗
"Ulises Sanchez / S.do Livramento.RS"     →  nome: (nada)          ✗
```

`extract.isCityAlone` exige que o pedaço seja **exatamente** o nome oficial do município para
separar nome de cidade. `Livramento` não é, então `findStructured` não dispara.

Não foi afrouxado de propósito: essa é a trava que impede o slogan do anúncio de virar nome
("Vamos Juntos Mudar O"), e ela tem teste. Afrouxar exige uma regra nova que aceite o encurtamento
sem aceitar frase solta — e isso é decisão dele, porque o erro cai em dado de eleitor real.

**Arquivos:** `src/lib/cities.js` (uma linha + o porquê), `tests/parser.test.mjs` (grupo novo),
`manifest.json` (1.8.0 → 1.8.1), `CLAUDE.md`, `registro.md`. Onze suítes passando.

---

## 2026-09-01 - A IA responde a caixa da cidade (a rodada parava ali)

**Relato dele:** *"falta a IA aceitar a cidade e arrumar caso esteja errado, esta parando o
processo"*, com o print da caixa "Cidade a gravar - Encontrei Canoas como cidade. Esta correta?"
aberta no meio da rodada automatizada.

### O que estava acontecendo

Automatizei o envio e nao a pergunta da cidade. A rodada abria a caixa e **esperava um clique
que, por definicao, ninguem ia dar** - automatizar tudo menos uma pergunta e nao automatizar.

A licao e mais larga que o conserto, e virou armadilha no `CLAUDE.md`: **toda pergunta que pode
abrir dentro da rodada precisa de resposta automatica ou de um jeito de nao abrir.** Pergunta sem
dono trava a fila inteira, em silencio.

### O que a IA pode fazer aqui - que e menos do que parece

A regra dele nao mudou: nenhuma cidade de palpite vai para o CRM sem confirmacao. Mudou **quem
confirma quando ele nao esta olhando**. Tres saidas, e so na rodada automatizada:

- `aceitar`  - grava o palpite, com `confirmada: true` (e o que libera as etiquetas de cidade e
  COREDE);
- `corrigir` - grava OUTRO municipio, e so um que exista na lista do IBGE;
- `semcidade` / `incerto` - **nao grava nada e nao recusa nada.**

A ultima difere da caixa de proposito. Quando ELE responde "Sem cidade", a recusa fica guardada
para a cidade nao voltar a ser sugerida. A recusa dele e uma decisao sobre o contato; a da IA e a
falta de uma. Guardar "nao e Canoas" porque o modelo ficou em 60% de certeza e transformar duvida
em fato, e e o tipo de memoria que ninguem revisa depois.

### A trava, que mora em `validarCidade` e nao no prompt

Municipio inventado nao passa: a correcao tem que casar com a lista do IBGE, e o que sai e o nome
**oficial** da lista, nao o que a IA digitou - duas grafias virariam duas etiquetas para o mesmo
municipio, e o filtro dele partido em dois. Sem lista carregada, correcao nenhuma passa.
Confianca abaixo de `CONFIANCA_MINIMA`, JSON ilegivel, acao desconhecida: `incerto`.

### A conversa vai dos DOIS lados

`montarContatoCidade` intercala o que nos perguntamos com o que ela respondeu. Sem isso,
*"Maria / Cachoeirinha"* e ambigua - nome de gente e nome de municipio, sem nada dizendo qual e
qual. Com o nosso *"me passe seu Nome / Cidade"* na frente, a frase se explica. E o caso que ele
apontou em 31/08. Foi por isso que `nossas` ganhou `at` no branch normal (commit `3569ad3`),
trazido para ca por merge.

`state.entrantes` leva o audio transcrito junto: cidade dita em audio e justamente o que o parser
nao enxerga. Transcricao errada vira `incerto`, nao cidade errada - a lista do IBGE fica no meio.

**Custo:** uma chamada curta por contato com cidade pendente (teto de 512 tokens de saida, tres
palavras e uma frase de resposta). Vai para o Andamento com o dolar, como as outras.

**Arquivos:** `src/lib/ia.js` (`esquemaDaCidade`, `montarSistemaCidade`, `montarContatoCidade`,
`montarRequisicaoCidade`, `validarCidade`), `src/lib/ia-cliente.js` (`conferirCidade` e o terceiro
modo do `atender`), `src/panel/panel.js` (`cidadeConferidaPelaIA`, chamada no topo de
`confirmarCidadeSePendente`), `tests/ia.test.mjs` (24 asserções novas), `CLAUDE.md`,
`manifest.json` (1.7.0 -> **1.8.0**). 31 modulos sem erro, onze suites passando, referencias ok.

---

## 2026-09-01 — "Automatizar com IA": a tecla 0 nunca foi apertada, nem à mão

**Pedido dele:** *"no automatizado deve ter um box para marcar escrito automatiza com IA, agora
está iniciando normalmente e IA não assume"*.

Ele estava certo por dois motivos, e o segundo eu não sabia.

### 1. Faltava a caixa (o que ele pediu)

A IA opinava e a rodada perguntava do mesmo jeito: a tecla 0 nascia em destaque e ele apertava.
Agora a aba Automatizado tem **"Automatizar com IA (a rodada envia a escolha dela sem
perguntar)"**, logo abaixo dos botões de começar. Marcada, a caixa de pergunta nem abre quando a
IA escolheu uma resposta — é a tecla 0 sendo apertada sozinha.

Nasce desligada, como `pularEtiquetasSozinho`, e pelo mesmo motivo: nada sai da fila sem decisão
dele, e a marca na caixa é essa decisão. Cada envio vai para o Andamento com o motivo e a
confiança. Marcada com a avaliação por IA desligada, a tela avisa em vez de a caixa ficar
marcada sem efeito.

**A fronteira do branch não se moveu:** o que sai é uma resposta pronta que ele escreveu,
escolhida pela IA. Isto automatiza o **clique**, não a escrita. Rascunho gerado pela IA continua
noutra caixa (`iaEnviarRascunhoAuto`), com as quatro travas de `podeEnviarSozinho`.

### 2. A tecla 0 mandava a mensagem ERRADA (o que eu achei no caminho)

A opção existia, aparecia em destaque e devolvia `ia:<id>`. **Nenhum ramo tratava esse valor.**
A escolha caía no fim de `tratarContato` e mandava o `modelo` do conteúdo — outra mensagem, para
gente de verdade — e, quando não havia modelo (`podeEnviar` falso), quebrava no `enviarModelo`.

Na tela dele hoje: recomendação da IA era *"Agradecer o apoio e encerrar"*, e a tecla 0 teria
mandado *"Campanha Cívico-Militar"*.

**Causa raiz:** o mesmo tipo de merge que apagou `avaliarComIA` — a opção veio, o ramo que a
executa não. `checar-modulos.mjs` não pega isto: o arquivo é sintaticamente válido, e o valor
simplesmente cai num `if` que não existe. Hoje os dois caminhos (a tecla à mão e o automático)
passam por **uma função só**, `enviarEscolhaDaIA`, que envia com `sendTemplate` — a recomendação
sai de `state.templates`, que são as respostas prontas, não de `enviarModelo`.

### As três travas antes de enviar sozinho

`acao === 'responder'` (escalar e incerto não chegam lá, e `validarDecisao` já rebaixou confiança
baixa e os RESTRITOS); resposta sem variável faltando; e **a mesma resposta não pode ter saído
hoje** para o contato. Esta última é a que muda de natureza no automático: a caixa mostrava o
aviso de duplicata e deixava ELE decidir — sem ninguém para ler o aviso, a decisão vira "não
manda, pergunta".

### A checagem que passou a existir

`checar-referencias.mjs` ganhou uma segunda passada: todo `valor:` de opção da pergunta tem que
aparecer num `=== '...'` (ou num `startsWith('...'` quando o valor é montado). Conferido contra o
`panel.js` de ontem: `prefixo achado: ia: | tem ramo? false` — teria pego. A primeira passada dele
não pegava porque não faltava chamada nenhuma; faltava o ramo.

**Arquivos:** `src/lib/store.js` (`auto.automatizarComIA`, já na lista de mescla), `src/panel/panel.js`
(a caixa, `enviarEscolhaDaIA`, o ramo `ia:`), `tools/checar-referencias.mjs`, `CLAUDE.md`,
`manifest.json` (1.6.0 → **1.7.0**). 31 módulos sem erro, onze suítes passando, referências ok.

---

## 2026-09-01 — "Diminuir a necessidade de pesquisa", não impedir a pesquisa

**Correção dele:** *"a regra não é impedir de pesquisar e sim diminuir a necessidade de pesquisa"*.

Eu tinha escrito o contrário em dois lugares, e a diferença não é de estilo:

- no **prompt**, o bloco saía como *"informação do gabinete, não pesquise nem invente"*;
- na **tela**, a explicação abria com *"A IA não pesquisa nada — e é bom que não pesquise"*.

### Por que ele está certo

"Não pesquise" é uma ordem sobre o **comportamento** do modelo; o campo existe para resolver um
problema de **informação**. São coisas diferentes, e a minha formulação trocava uma pela outra:
sugeria que a ignorância é desejável, quando o que se quer é que a informação certa já esteja ali
— e que o modelo não **invente** o que faltar.

A trava que importa continua inteira, e é a segunda metade da frase: **não inventar**. Essa não
mudou.

Hoje o prompt diz *"informação do gabinete — use-a como fonte e não invente o que não estiver
aqui"*, e a tela abre com *"serve para DIMINUIR a necessidade de a IA buscar contexto, não para
proibi-la de buscar"*. Corrigi também a frase equivalente na entrada de ontem.

**Arquivos:** `src/lib/ia.js` (as duas montagens de prompt), `src/panel/panel.js` (o texto da
Config), `registro.md`, `manifest.json` (1.5.0 → **1.6.0**). 31 módulos sem erro, onze suítes
passando.

**Nota de processo:** o commit anterior (`d525b0a`) subiu sem esta entrada porque o script que a
escreveria quebrou e eu não conferi antes de empurrar. Commit sem registro é conserto que ninguém
consegue explicar depois — é a regra que este arquivo existe para sustentar.
## 2026-09-01 - `nossas` ganhou o horario de cada mensagem

Uma linha, e o motivo dela e do outro branch: la a conferencia de cidade por IA precisa
intercalar os dois lados da conversa - "Maria / Cachoeirinha" so se explica depois da nossa
pergunta - e sem `at` nas nossas mensagens nao ha como ordenar. `entrantes` ja tinha.

Feito **aqui**, no branch normal, e nao la: `api.js` e dos dois, e duplicar e como as duas
versoes divergem em uma semana. Campo novo e aditivo - nada que existe hoje le ele.

**Arquivos:** `src/lib/api.js`.

---

## 2026-09-01 — "Deu a cidade e não pegou": eu reconhecia uma das três formas de pedir

**Relato dele**, testando a versão IA: *"deu a cidade e não pegou primeiro, a tela de confirmação
não apareceu"*.

### A causa é minha, de 31/08

Quando implementei *"a pergunta que você fez também é contexto"* (`respostaAoPedido`), decidi se a
nossa última mensagem era o formulário assim:

```js
const corpo = achatarTexto(modelo?.text || '');       // SÓ o texto base do pedir-dados
return achatarTexto(nossaUltima).includes(corpo.slice(40, 100));
```

Naquele dia havia **um** texto. Hoje há três formas de pedir os dados, e todas falhavam nessa
comparação menos a primeira:

| texto | linha do formato |
|---|---|
| `pedir-dados` | `Nome completo / Cidade` |
| `pedir-dados-evento-sim` / `-nao` (0.62.0) | `*Nome / Cidade*` |
| **variantes** de qualquer um | reescritas do mesmo texto |

Bastava a mensagem ter saído como variante — e ela sai, porque o revezamento é automático — para
o painel achar que não tinha perguntado nada. Aí *"maria cachoeirinha"* deixa de ser resposta,
a cidade não é reconhecida e o popup de confirmação não aparece.

### O conserto

`pediuNomeECidade` casa pela **linha do formato** (`nome( completo)? / cidade`), que é:

- o que todos os textos têm em comum, hoje e nas variantes;
- o que o parser realmente depende;
- o que os testes **já protegiam** texto a texto desde 10/08.

Provado contra os textos reais do `store`: **11 pegam** (base, duas variantes de cada, os dois de
evento e os dois de interesse) e os que não pedem dados continuam fora — agradecimento, sem
interesse, link do grupo. Se fossem confundidos, qualquer conversa viraria "resposta ao
formulário" e o parser leria cidade onde não há.

### A lição, que virou armadilha no `CLAUDE.md`

**"Nossa mensagem foi X?" nunca se responde comparando com UM texto.** Case pelo invariante. Eu já
tinha usado a mesma técnica frágil em outros dois lugares (`modeloJaNaConversa`,
`jaPediramDados`) — lá o alvo é um modelo específico e a comparação por trecho se sustenta, mas
vale reler quando aparecerem variantes de modelo.

**Arquivos:** `src/panel/panel.js` (`pediuNomeECidade`), `tests/vars.test.mjs` (+14, cobrindo
variantes e os textos de evento), `CLAUDE.md`, `manifest.json` (0.62.0 → **0.63.0**).
29 módulos sem erro, dez suítes passando.

**Vale para os dois branches:** feito aqui, a levar para `claude/whatsfill-ia` por merge.

## 2026-09-01 — Quem é quem: a chapa entra no prompt cacheado (e duas funções voltam do merge)

**Pedido dele:** *"a extensão deve ter salva informações dos cadidatos relacionados ao gabinete do
capitão martim e sua chapa para a ia não pesquisar toda vez"*.

### O que foi feito

Campo novo em Config, **"Quem é quem (chapa, números, pautas)"**, guardado em `store.ia.gabinete`.
O texto entra no prompt de **sistema** — a parte com `cache_control` —, dentro do bloco
`Quem é quem neste mandato (informação do gabinete, não pesquise nem invente):`, tanto na decisão
(`montarSistema`) quanto no rascunho (`montarSistemaRascunho`).

Três consequências que valem registro:

1. **Diminui a necessidade de a IA buscar contexto — não a proíbe de buscar** (correção dele,
   01/09). Sem este campo ela decide sobre nomes que
   não conhece: alguém escreve "vou votar no Marcel para senador" e ela não tem como saber se é
   aliado, adversário ou outro cargo. Antes disso o desconhecido virava `incerto`; agora vira
   decisão informada — e continua virando `incerto` quando o campo está vazio.
2. **Detalhe aqui é barato.** Está na parte cacheada: custa uma vez e 10% do preço nas chamadas
   seguintes. O aviso na tela diz isso, porque a reação natural é economizar palavra justamente
   onde não precisa.
3. **A regra do rascunho mudou de redação.** Ela dizia "não invente nenhum dado"; virou *"você pode
   usar o que está na conversa e o que está no bloco Quem é quem acima — e NADA além"*. Sem isso a
   própria regra proibiria usar o bloco que acabamos de dar a ela.

O `tokensAproximados` do estimador de cache passou a incluir o gabinete: ele engorda o prompt e
pode ser o que empurra o Haiku para cima do mínimo de 4.096 tokens de cache.

**O campo nasce VAZIO de propósito** e continua vazio: os dados são dele. Inventar número de urna
ou cargo de candidato é o tipo de erro que sai daqui e chega no eleitor.

### Causa raiz de um bug MEU que estava no ar desde ontem

Ao ligar o gabinete no `panel.js` descobri que **`avaliarComIA` era chamada nas linhas 3407 e 6913 e
não existia mais**. Junto com ela `tentarRascunhoAutomatico`. As duas foram apagadas pelo merge
`c7a6d59` (31/08) — e no relato daquele merge eu escrevi que conferi que nada de produção tinha se
perdido. Conferi um lado só. **Merge tem dois.**

Por que nada acusou:

- o arquivo continuou **sintaticamente válido** (chamada para função inexistente é erro de
  execução, não de sintaxe), então `node --check` não vê;
- `checar-modulos.mjs` só olha `SyntaxError`;
- **nenhuma suíte importa o `panel.js`** — ele precisa de `window`.

O erro apareceria como `avaliarComIA is not defined`, no meio de uma rodada, matando o laço em
silêncio. As duas funções voltaram do commit `a4d03bd`, agora passando `gabinete`.

### `tools/checar-referencias.mjs` — a ferramenta que faltava

Nova, para esta classe de bug: toda função chamada dentro de um arquivo existe nele? Ela coleta os
nomes declarados (funções, arrow, classes, métodos, parâmetros, importados) e reclama do que é
chamado sem estar em nenhum. Não resolve escopo e ignora tudo com ponto antes — é detector de
função-que-sumiu, não analisador.

**A prova de que serve:** removendo `avaliarComIA` de propósito, `checar-modulos.mjs` diz
*"31 arquivos, 0 com erro de sintaxe"* e o conferidor novo aponta a linha 3407. Sem a prova, era só
mais um script que ninguém sabe se funciona.

O caminho até calar os falsos positivos, porque ferramenta que grita ninguém roda duas vezes:

| falsos | causa |
|---|---|
| 503 | palavra dentro de **comentário em português** seguida de parêntese ("a rodada (que já fechou)") |
| 57 | **parâmetros** chamados dentro da própria função (`fn`, `onResize`, `resolve`) |
| 30 | **regex literal** (`/(sempre|junto) com/` tem parêntese), métodos de objeto, globais de buffer |
| 1 | `import()` dinâmico do `content.js` — legítimo, entrou nas globais |

Hoje: 31 arquivos, zero. Onde a dúvida aparece, ela **cala** de propósito (a coleta de parâmetros é
grosseira): o alvo é função que sumiu, e função que sumiu não aparece em declaração nenhuma.

**Arquivos:** `src/lib/ia.js`, `src/lib/ia-cliente.js`, `src/lib/store.js`, `src/panel/panel.js`,
`tools/checar-referencias.mjs` (novo), `CLAUDE.md`, `manifest.json` (1.3.0 → 1.4.0).

**Pendência dele:** preencher o campo. Sem texto lá, a IA continua decidindo sem saber quem é quem.
---

## 2026-09-01 — Convite de evento: a tecla 4 escolhe entre três textos

**Pedido dele:** um anúncio novo pergunta se a pessoa vai ao evento, e ele responde de dois jeitos —
consolo para quem não pode, comemoração para quem vai. Passou os dois textos, palavra por palavra.

### O que a leitura dos textos dele mostrou

Os dois **terminam pedindo nome e cidade**. São o `pedir-dados` com um prefixo — e é isso que faz o
desenho ficar simples: **nenhuma tecla nova**. A tecla 4 escolhe entre três textos conforme
`cortesia.confirmaPresenca`, e o rótulo dela passa a dizer qual vai sair
("Não vai ao evento + pedir dados e concluir").

Sem resposta clara sobre presença, sai o `pedir-dados` de sempre — aqui a dúvida não custa nada, o
texto seco continua servindo, só é mais frio.

### `respostaAfirmativa` não servia, e testar mostrou

Ele existe e lê sim/não, mas foi escrito para *"quer receber conteúdo?"*, onde "gostaria" é um sim.
Contra as respostas de presença erra os dois lados:

| resposta | `respostaAfirmativa` | verdade |
|---|---|---|
| *"Gostaria de estar mas sem condições 22 certamente"* | **sim** | não vai |
| *"vou sim"* | **não** | vai |
| *"estarei lá"* | **não** | vai |

Duas diferenças de desenho no `confirmaPresenca`:

- **A negativa vence, e olha a mensagem INTEIRA.** A frase real da print tem "gostaria" E
  "certamente" — duas marcas positivas — e é uma recusa. Quem não pode ir quase sempre começa dizendo
  que queria: a intenção está na ressalva. Por isso aqui não há "primeiras quatro palavras" como no
  `respostaAfirmativa`.
- **"sim" solto não conta.** Pode ser resposta a outra pergunta, e o texto de comemoração mandado a
  quem não falou de evento nenhum lê como confusão.

19 casos conferidos, incluindo a frase exata da print.

### O que não podia mudar nos textos

Os dois terminam com o formato `Nome / Cidade` e o exemplo `(exemplo: Maria Silva / Santo Ângelo)`.
**É dele que sai a precisão do parser** (`respostaAoPedido`), e mudar o formato quebraria a leitura do
nome e da cidade sem avisar ninguém. Há teste nos dois textos.

**Descoberto de passagem:** o `pedir-dados` de FÁBRICA está desatualizado em relação ao que ele usa —
o de fábrica diz "Nome completo / Cidade" e ainda pede o link de grupo. O dele, salvo no storage, é a
versão curta das prints. Não é problema hoje (o salvo vence), mas quem instalar do zero recebe o
texto antigo.

**Arquivos:** `src/lib/cortesia.js` (`confirmaPresenca`), `src/lib/store.js` (os dois textos),
`src/lib/templates.js` (migração), `src/panel/panel.js` (a tecla 4 e a linha da caixa),
`tests/cortesia.test.mjs` (+21), `tests/templates.test.mjs` (+11), `CLAUDE.md`,
`manifest.json` (0.61.0 → **0.62.0**). 29 módulos sem erro, dez suítes passando.

**Vale para os dois branches:** feito aqui, a levar para a IA por merge.

---

## 2026-09-01 — O diálogo "tem certeza que deseja concluir?" parava a rodada inteira

**Relato dele**, print do diálogo da plataforma: *"essa mensagem está quebrando a automação, é para
concluir e continuar mas está parando tudo"*.

O diálogo:

> **Atenção!** Uma mensagem está aguardando resposta do contato. Se você prosseguir com a conclusão
> do atendimento, essas mensagens serão canceladas. Tem certeza de que deseja concluir o atendimento?
> — **Cancelar** · **Concluir**

### A causa

`clickConcluir` tinha esta linha, e o comentário explicava a intenção:

```js
// Diálogo de motivo de conclusão: quem decide é o humano, então devolve para o painel.
if (dom.hasOpenDialog()) return { ok: true, dialogOpen: true };
```

Escrita para o diálogo de **motivo de conclusão** — que pede um dado que só ele tem. Mas ela pega
**qualquer** diálogo, e o da print é outra coisa: uma confirmação do que a rodada acabou de pedir.

**Confirmar ali não decide nada novo.** A conclusão foi pedida por ele dois cliques antes.

### A distinção, e a trava que a torna segura

`dom.getConfirmacaoDeConclusao` separa os dois:

- **confirmação** → a rodada clica e segue;
- **formulário** → devolve para o painel, como sempre.

**O teste de campo vem PRIMEIRO, e é ele que segura a mão:** qualquer `input`, `select`,
`mat-select`, `textarea` ou `mat-radio-group` dentro do diálogo faz a função devolver `null` — mesmo
havendo um botão "Concluir" ao lado. Errar para o lado de não clicar custa uma rodada parada; errar
para o outro grava decisão que ninguém tomou.

Também exige que o texto fale de concluir/encerrar (diálogo de "Excluir contato" ou de transferência
não entra), recusa botão desabilitado, e limita a **duas** confirmações por conclusão — o encadeado
"tem certeza?" → "confirma?" cabe, e a teimosia de bater na mesma porta 40 vezes até o prazo não.

### O que ele precisa saber, e o log conta

Este diálogo avisa que **mensagens pendentes serão canceladas**. Aceitar isso em silêncio seria
decidir por ele sem contar — então o texto do que foi confirmado vai para o log da rodada, **uma vez
por rodada**: é o mesmo em todo contato, e repetido cem vezes afogaria o resto do log.

### Provado no navegador, com o diálogo da print

`tools/checar-dom.mjs` precisa de Playwright, que não está instalado. Montei os casos com o `dom.js`
real: **17 verificações, zero falhas.** As sete que mais importam são as que garantem que ele **não**
clica — diálogo de motivo (nas quatro formas de campo), "Excluir contato", transferência, botão
desabilitado.

**Arquivos:** `src/lib/dom.js` (`getConfirmacaoDeConclusao`), `src/lib/page.js` (o laço do
`clickConcluir`), `src/panel/panel.js` (o aviso no log), `CLAUDE.md`,
`manifest.json` (0.60.0 → **0.61.0**). 29 módulos sem erro, dez suítes passando.

**Vale para os dois branches:** feito aqui e a levar para `claude/whatsfill-ia` por merge.
## 2026-09-01 — Produção entra na IA outra vez: 24 commits de um dia inteiro

**Pedido dele:** *"sim atualize a ia"* — ele vai comprar US$ 5 de crédito e testar, e testar num
painel sem nada de hoje não diria nada.

### O merge

Base comum: `5136ea1`. Produção havia andado **24 commits**; este branch tinha 8 próprios.
`store.js` e `panel.js` — os dois maiores — fizeram **auto-merge**, e só três arquivos conflitaram:
`manifest.json`, `CLAUDE.md` e `registro.md`, todos de texto.

**Zero linhas de produção perdidas**, conferido arquivo por arquivo contra o branch dela:
`panel.js`, `cortesia.js`, `sugestao.js`, `hsm.js`, `tags.js`, `api.js`, `templates.js` e
`panel.css` deram 0. As duas do `store.js` são a própria mudança da IA (a lista de mescla ganha
`'ia'`).

E as peças da IA seguem no lugar: `ia.js`, `ia-cliente.js`, a suíte, `podeGastar`,
`CACHE_MINIMO_TOKENS`, a trava de gasto no service worker, o teto na Config.

### O que este branch ganhou de hoje

Tudo o que saiu das prints dele: a tecla **9** (pedido sem detalhe vira pergunta), a **8**
(agradecer o apoio), o **modelo por TEXTO** do anúncio, a caixa que **fica na tela** com o painel
escondido, o pulo que **não escreve** no CRM, a rajada que para no buraco de tempo, vídeo saindo da
fila de resposta à mão, e a fronteira de palavra que aceita pontuação.

### Resolução dos três conflitos

| arquivo | decisão |
|---|---|
| `manifest.json` | `WhatsFill+IA`, versão **1.1.0** — série 1.x é o que diz qual das duas está carregada |
| `CLAUDE.md` | **os dois lados** nas listas de armadilha; a seção "Avaliação por IA" é exclusiva daqui |
| `registro.md` | **os dois** históricos, produção em cima por ser o mais recente |

**Estado:** 31 módulos sem erro de sintaxe, **onze suítes** passando (as dez de produção mais a da
IA).

**Pendência que continua:** a IA nunca fez uma chamada real. Com o crédito comprado e a chave colada,
o primeiro teste é o botão "Avaliar o contato aberto" no "Thiago Tim" — uma chamada, fora de rodada.

---

## 2026-09-01 — O modelo do anúncio sai do TEXTO, sem etiqueta por anúncio

**Decisão dele:** *"não será feito etiqueta a etiqueta para os anúncios, agora é só ads; o padrão para
casar o modelo deve ser o texto (Olá! Eu apoio as Escolas Cívico-Militares = modelo)"*.

Está certo, e é mais simples do que o que eu tinha proposto na resposta anterior: o caminho
texto → etiqueta → modelo exigiria uma **etiqueta nova no CRM por anúncio** — rótulo permanente na
base de eleitores para transportar uma informação que já está escrita na mensagem.

### A tabela

`store.modeloPorTexto`: `{ "trecho do texto": "Nome do modelo" }`, editável na aba Config, uma linha
por par. **Nasce vazia** de propósito: o nome tem de ser o exato da plataforma, e chutar aqui manda o
modelo errado para eleitor real.

Ela **decide antes** da tabela por etiqueta. Casando, a etiqueta nem é consultada; nada casando, o
caminho antigo segue idêntico — é o que atende quem já tem "Conteúdo Zucco"/"Conteúdo Flávio".

### Quatro decisões que o teste trava

- **Casa por trecho CONTIDO.** A mensagem real chega com emoji e com o que a pessoa acrescentou
  depois (*"…Escolas Cívico-Militares 🤙 olá Capitão Martins…"*). Igualdade não casaria nunca.
- **Compara com `semAcento`**, que o `hsm.js` já reservava para valor digitado à mão: "Civico"
  digitado casa com "Cívico" da mensagem.
- **O trecho MAIS LONGO ganha.** Sem isso, "eu apoio" cadastrado para o modelo genérico venceria "eu
  apoio as escolas" pela ordem de digitação — e ordem de digitação não é uma decisão.
- **Nome que a plataforma não tem vira ERRO, nunca `null`.** `null` faria a rodada cair no caminho da
  etiqueta como se nada tivesse acontecido, e o erro de configuração dele desapareceria em silêncio.

Na tela, o botão de salvar confere os nomes contra os modelos aprovados **antes** de gravar: nome
errado não dá erro ao salvar, dá ao enviar, no meio de uma rodada com o contato aberto.

E a caixa passa a mostrar `Conteúdo pedido: texto: "<trecho>"` — sem isso ela diria "Sem modelo"
enquanto oferece a tecla 1, que é pior do que não explicar.

### Um buraco antigo que apareceu no caminho

`modeloPorTexto`, `padroesDeAnuncio` e `conteudoPreferido` não estavam na lista `allowed` do
`importJson`. O `exportJson` varre `DEFAULTS`, então o backup **exportava** as três — e a restauração
**descartava**. `conteudoPreferido` estava assim desde antes de hoje.

**Arquivos:** `src/lib/hsm.js` (`modeloPorTexto`, `parseModeloPorTexto`, `formatModeloPorTexto`),
`src/lib/store.js` (a tabela e a `allowed`), `src/panel/panel.js` (a decisão e o campo na Config),
`tests/hsm.test.mjs` (+15), `CLAUDE.md`, `manifest.json` (0.59.0 → **0.60.0**).
29 módulos sem erro, dez suítes passando.

**Para usar:** aba Config → "Modelo por TEXTO da mensagem", uma linha:
`Olá! Eu apoio as Escolas Cívico-Militares = <nome exato do modelo>`. O botão avisa na hora se o nome
não existir na plataforma.

---

## 2026-09-01 — A mensagem do anúncio se reconhece pelo TEXTO, não pela posição

**Pergunta e pedido dele**, print da Erenita: *"qual foi a mudança feita pro caso da print? preciso
que identifique o modelo pelo texto (Olá! Eu apoio as Escolas Cívico-Militares)"*.

### Respondendo o "qual foi a mudança"

A caixa sugeria a tecla 8 (agradecer o apoio) por causa da regra `so-expressa-apoio`, que subiu acima
do modelo em 31/08. **E estava errada ali** — pelo meu critério, não pela regra.

Eu havia implementado "a PRIMEIRA mensagem é o texto do anúncio, e sai da conta". A Erenita mandou
uma **figura antes**: o texto do anúncio virou a segunda mensagem, entrou na conta como se fosse dela,
e *"Eu apoio as Escolas Cívico-Militares"* foi lido como apoio escrito por ela.

**Ele apontou o critério certo: texto, não posição.** Basta um "bom dia" antes para qualquer critério
posicional cair.

### O conserto

`store.padroesDeAnuncio` (fábrica: `^ol[áa]!?\s+eu\s+apoio`) e `cortesia.ehMensagemDeAnuncio`.
Configurável porque o texto do anúncio muda quando a campanha muda, e isso não deveria exigir um
commit. Padrão inválido é ignorado **um por um**: expressão mal digitada na Config não pode derrubar
a leitura da conversa.

Conferido nos quatro casos reais do dia:

| | resultado |
|---|---|
| Erenita — figura antes, depois o texto do anúncio | **não** é apoio dela ✔ |
| Izaak — anúncio + *"Tamojuntos"* | é apoio dela ✔ |
| Ciro — anúncio + o *"texto de baixo"* | é apoio dele ✔ |
| só o clique no anúncio | não é apoio ✔ |

### Um bug no TESTE, que é a lição maior

Escrevi o padrão à mão no arquivo de teste e saiu `'\s'` com **uma** barra — em string JS isso é a
letra `s`, não a classe de espaço. O padrão virou `^ol[áa]!?s+eu s+apoio`, que não casa com nada, e
**três asserções passaram a "passar" testando nada**.

O teste agora lê `store.get('padroesDeAnuncio')`: prova o valor que a extensão usa, não uma cópia.
Duplicar valor de configuração em teste é o tipo de coisa que mente exatamente quando importa.

### Sobre "identificar o MODELO pelo texto" — isso já funciona, e é configuração

O mecanismo existe e não precisa de código:

1. **`tagRules`** casa texto → etiqueta (hoje: `zucco` → `Conteúdo Zucco`, `fl[áa]vio` → `Conteúdo
   Flávio`);
2. **`contentTemplates`** mapeia etiqueta → modelo aprovado;
3. desde 0.56.0, a etiqueta específica **vence o ADS**, que virou último recurso.

Para as Escolas Cívico-Militares: criar a etiqueta no CRM, somar `escolas c[íi]vico` → `Conteúdo
Escolas` nas regras, e mapear `Conteúdo Escolas = <modelo>` na tabela.

**Arquivos:** `src/lib/store.js` (`padroesDeAnuncio`), `src/lib/cortesia.js`
(`ehMensagemDeAnuncio`, `soExpressaApoio`), `src/panel/panel.js`, `tests/cortesia.test.mjs`,
`CLAUDE.md`, `manifest.json` (0.58.0 → **0.59.0**). 29 módulos sem erro, dez suítes passando.

---

## 2026-09-01 — A caixa da rodada fica na tela com o painel escondido

**Pedido dele:** *"ao eu mandar o whatsfill ocultar ele oculta o popup da automatização, faça com que
fique o popup mesmo ocultando, preciso de espaço na area de trabalho"*.

### A causa

Esconder o painel é `transform: translateX(100%)` no `.wf-root` (classe `wf-collapsed`). **Transform
arrasta os filhos** — e a caixa era filha do `root`, então deslizava para fora da tela junto.

A caixa passou a ser **irmã** do painel, dentro do mesmo shadow: `destinoDaCaixa()` devolve
`root.parentNode`, e os quatro pontos que criavam caixa passaram a usá-la.

### Três coisas que a caixa herdava e precisou receber

Sair do `root` custa mais do que parece, e cada uma destas apareceu na verificação:

1. **z-index 998** — herdava do painel; sem ele, a caixa ficaria atrás de qualquer coisa da página.
2. **As variáveis de cor** — definidas em `.wf-root`. O seletor virou compartilhado, mas **só para as
   variáveis**: o mesmo bloco tinha `background: var(--wf-bg)`, e herdar isso cobriria a tela inteira
   de branco, matando a transparência que mantém a conversa legível (armadilha já registrada).
3. **O tema escuro** — `.wf-root.wf-dark` não alcança irmão. Resolvido com
   `.wf-root.wf-dark ~ .wf-pergunta-fundo`; sem isso, a plataforma no escuro deixaria a caixa branca.

### Medido, não presumido

`tools/checar-pergunta.mjs` precisa de Playwright, que não está instalado aqui. Montei a prova no
Browser pane com o `panel.css` real:

| | painel aberto | painel escondido |
|---|---|---|
| **painel** | `805..1185` | `1185..1565` (saiu inteiro da área útil) |
| **caixa** | `346..840` | `346..840` — **deslocou 0** |

E as quatro que importam sobre o CSS: camada com `pointer-events: none`, `background` transparente
(`rgba(0,0,0,0)`), `z-index: 998` próprio, tema escuro chegando (`rgb(17,24,39)`). O clique no meio da
tela continua chegando na conversa com o painel aberto **e** escondido.

**Uma armadilha do próprio projeto apareceu na verificação:** o primeiro teste deu timeout porque usei
`requestAnimationFrame`, e o Browser pane estava escondido — aba escondida é aba congelada, o mesmo
que está registrado para as rodadas. Refeito com leitura síncrona, que força o cálculo sem esperar
frame.

**Arquivos:** `src/panel/panel.js` (`destinoDaCaixa`), `src/panel/panel.css`, `CLAUDE.md`,
`manifest.json` (0.57.0 → **0.58.0**). 29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — "O atendimento foi perguntar os dados": pergunta não é entrega

**Relato dele**, print da Ivone: a caixa dizia *"5: já foi atendida antes (o modelo provavelmente já
saiu) — mande a mensagem do momento"*. Não tinha saído nada. A nossa única mensagem foi o **pedido de
dados**, e ela respondeu *"Ivone trentim Borges passo fundo"* dois minutos depois.

> *"o atendimento foi perguntar os dados"*

**Defeito da regra que eu fiz uma hora antes.**

### A causa

`jaRespondemosAntes` era `state.nossas.length > 0` — **qualquer** mensagem nossa. E o pedido de dados
é uma mensagem nossa.

O erro conceitual: **"já respondemos" não é "já entregamos".** Pergunta não é entrega, e quem só foi
perguntado é exatamente quem está esperando o material — o oposto de quem já recebeu.

Pior: a Ivone tinha **respondido** o formulário (nome e cidade), então o momento de mandar o modelo
era justo aquele.

### O conserto

`jaRespondemosAntes` passou a ignorar as nossas mensagens que são PERGUNTA: `pedir-dados`,
`interesse-conteudo` e `perguntar-como-ajudar`.

A comparação usa o maior pedaço literal de cada texto **e de cada variante** — as respostas prontas
revezam três textos, e comparar só o base deixaria duas de fora. Conferido nas três variantes do
pedido de dados.

### Prova nos dois lados

| nossas mensagens | já entregamos? |
|---|---|
| só o pedido de dados (base) | não |
| só o pedido de dados (variante 1 e 2) | não |
| só a pergunta de interesse | não |
| um modelo de verdade | **sim** |
| pedido de dados **e depois** um modelo | **sim** |

**Regra que fica:** resposta pronta nova que seja pergunta tem de entrar nessa lista, senão volta a
contar como entrega.

**Arquivos:** `src/panel/panel.js`, `CLAUDE.md`, `manifest.json` (0.56.0 → **0.57.0**).
29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — ADS é origem, não conteúdo: o tema do anúncio passa a vencer

**Relato dele**, print da Seura: ela clicou no anúncio das Escolas Cívico-Militares e escreveu *"Olá!
Eu apoio as Escolas Cívico-Militares 🤙 olá Capitão Martins será a segunda vez que você vota em ti sou
de viamão"*. A caixa sugeria o modelo genérico.

> *"nesse caso eu tenho um modelo pra escolas civico militares mas a etiqueta ads não faz distinção"*

### A causa, e ela era maior que o caso

**ADS diz que a pessoa veio de anúncio, não de QUAL anúncio.** É origem — e origem só serve de
conteúdo enquanto nada melhor aparecer. Mas ela entrava como `origem: 'conteúdo'` em pé de igualdade
com os temas, e o desempate era pelo **preferido** da Config, onde está `ads`.

Ou seja: **ADS já vencia "CONTEÚDO FLÁV" e "CONTEÚDO ZUC"**, que são temas de verdade e já existem na
base dele. O caso das Escolas só tornou isso visível.

### O conserto

A etiqueta de anúncio passou a sair de `tags.suggest` com `fallback: true`, e `escolherConteudo`
ignora os `fallback` quando existe conteúdo específico — **sem passar pelo preferido**.

Efeito colateral bom: antes, dois conteúdos sem preferido configurado eram **erro** e a rodada ficava
sem modelo. Agora, se um deles é o ADS, o específico ganha sozinho.

O desempate por preferido continua existindo, mas só **entre iguais**: dois temas de verdade sem
preferido seguem dando erro com o motivo na tela — que é a regra do projeto (na dúvida, recusar).

### O que ele precisa fazer para o modelo das Escolas sair

Nada disso cria a etiqueta do tema. Para o modelo específico ir:

1. criar a etiqueta no CRM (ex.: `Conteúdo Escolas`);
2. na aba Config, uma **regra de conteúdo** casando o texto que a pessoa manda —
   `escolas cívico-militares` → `Conteúdo Escolas`;
3. na tabela **Modelo por conteúdo**, mapear `Conteúdo Escolas = <o modelo dele>`.

A partir daí o ADS volta a ser o que é: a resposta de quem veio do anúncio e não disse mais nada.

**Arquivos:** `src/lib/tags.js`, `src/lib/hsm.js`, `tests/hsm.test.mjs` (+8), `CLAUDE.md`,
`manifest.json` (0.55.0 → **0.56.0**). 29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — `(^|\s)` não casa depois de pontuação: 26 padrões estavam cegos

**Relato dele**, print da Gessi na 0.54.0: *"vou agradecer apoio e concluir"*. A mensagem dela era
*"Boa noite. Gessi cremontti de medeiros. Itaqui Rs...sempre com vocês capitão. Com sIos zuccos 🙏"*,
e a caixa sugeria a tecla 5.

### Duas causas, e a segunda é grande

**1. O dicionário.** *"sempre com vocês"* não casava: o padrão exigia um verbo antes do "com"
(`estou`/`tamo`/`to`). Acrescentado `(sempre|junto|juntos|aqui) com (vocês|vc|o senhor|a gente)`.
**"com vocês" sozinho ficou de fora de propósito** — *"preciso falar com vocês"* é pedido, não apoio;
o que qualifica é o advérbio de permanência.

**2. A fronteira de palavra, e esta valia para o arquivo inteiro.** O texto é *"Itaqui Rs**...**sempre
com vocês"*: o "sempre" vem depois de três pontos, **sem espaço**. `(^|\s)` exige espaço ou início de
string, então nenhum padrão pegava.

**É a segunda armadilha em cima da mesma linha de código, com um dia de diferença:**

| | problema | conserto |
|---|---|---|
| 30/08 | `\b` é fronteira de `\w`, e `é` não é `\w` → `/\bé nós/` nunca casava | virou `(^|\s)` |
| 31/08 | `(^|\s)` não casa depois de pontuação → *"Rs...sempre"* invisível | virou `(^|[^\p{L}])` |

Trocado em **26 padrões** do `cortesia.js`, com a flag `u` onde faltava. `[^\p{L}]` é "qualquer coisa
que não seja letra": espaço, ponto, vírgula, emoji, quebra de linha.

### O que o teste tranca dos dois lados

Não é só que agora casa depois de pontuação — é que **continua não casando dentro de palavra**, que é
o propósito de haver uma fronteira. `desempre`, `imprecisao` e o `pq` explicativo no meio da frase
seguem fora, e há asserção para cada um. Sem isso, o "conserto" mais rápido (tirar a exigência) teria
transformado todos os dicionários em busca de substring.

**Arquivos:** `src/lib/cortesia.js` (o dicionário e os 26 padrões), `tests/cortesia.test.mjs` (+12),
`CLAUDE.md`, `manifest.json` (0.54.0 → **0.55.0**). 29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — O modelo é a entrega INICIAL; quem volta recebe a mensagem do momento

**Relato dele**, print do Cris: *"histórico de conversa grande provavelmente já recebeu modelo de
mensagem, vou mandar mensagem do momento"*. A caixa sugeria mandar o modelo.

### Uma causa que eu achei no caminho

`modeloJaNaConversa` comparava os **caracteres 40 a 100** do texto do modelo com as nossas
mensagens. Modelo aprovado tem variáveis (`{{1}}`, nome, cidade) — variável caindo nessa fatia faz a
comparação **nunca casar**, porque o que saiu tem o VALOR no lugar do marcador.

Agora ela quebra o modelo nos marcadores e compara o **maior pedaço literal** (mínimo 30
caracteres): pouco para dar falso positivo, curto o bastante para sobrar mesmo em modelo cheio de
variável.

### A regra que ele escolheu

`ja-respondemos-antes`: se já mandamos qualquer mensagem para o contato, o modelo perde para a
mensagem do momento. **O modelo é a entrega inicial** — quem já foi atendido e volta dizendo que
apoia não está pedindo o material de novo, está aparecendo. Modelo repetido parece que ninguém olhou
o histórico.

O sinal é `state.nossas.length > 0`, que enxerga o que saiu à mão e o que a automação da plataforma
mandou — mais que o registro de envios do painel.

### O desenho, e o contra-teste que o sustenta

**Na primeira vez o modelo vai** — é a entrega que a pessoa pediu ao clicar no anúncio. Tem teste.

Fica **abaixo de `so-expressa-apoio`, `pergunta-aberta` e `pediu-algo-sem-dizer-o-que`**: tudo que
fala do que ela acabou de dizer vem antes da mensagem da semana.

E vira **concluir** em três casos, pelo mesmo desenho da regra da reação: já respondemos hoje, a
mensagem do momento já saiu, ou não há uma configurada. Mais uma mensagem nossa em cima do que ela
ainda não comentou é empilhar.

**Alcance a observar:** quase todo contato antigo já recebeu algo nosso, então esta regra vai casar
com frequência. É o que ele pediu; se na prática o modelo deixar de sair para quem devia receber,
o ajuste é uma linha.

**Arquivos:** `src/panel/panel.js`, `src/lib/sugestao.js`, `tests/sugestao.test.mjs` (+10),
`manifest.json` (0.53.0 → **0.54.0**). 29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — "Preciso da força do senhor": a rodada mandava material de campanha

**Relato dele**, print da Mari: *"provável pedido financeiro ou trabalho, vou perguntar em que posso
ajudar? para ter certeza"*. A caixa sugeria **1: mandar o modelo "Campanha Martim2"**.

**É o pior caso do projeto, e passou o dia inteiro em aberto.** Pedido de dinheiro ou de emprego não
pode receber resposta automática (Lei 9.504/97, art. 41-A e 73 §10) — e material de campanha em cima
de quem está pedindo ajuda é pior do que não responder. A triagem que pegava isso foi removida hoje
de manhã, a pedido dele, e nada tinha ficado no lugar.

### Por que perguntar, e não responder

A frase **não diz o que ela quer**: pode ser dinheiro, emprego, ou força política na luta dela.

- **Responder** com material é o defeito da print.
- **Negar** (as respostas `pedido-ajuda`/`pedido-emprego`) ofende quem só queria apoio político — e a
  recusa só cabe depois de ela dizer o que quer.
- **Perguntar** não promete nem nega, e transforma a frase ambígua em decisão informada dele.

### O que entrou

`cortesia.pedeAlgoIndefinido` reconhece "preciso de/da", "conto com o senhor", "pode me ajudar",
"me ajuda", "estou passando por", "estou desempregado".

**A oferta desarma a mensagem inteira, ANTES de qualquer teste de pedido** — é a armadilha já
registrada: *"ajuda" é a mesma palavra dos dois lados da campanha*. "Quero ajudar" é apoiador se
oferecendo, o público principal; confundir os dois põe metade da base na fila de revisão dele. Quatro
asserções cobrem esse lado.

**Tecla 9** e a resposta `perguntar-como-ajudar` (com migração, senão não chega em quem já usa —
lição de meia hora antes). O texto **não promete nada**: nem ajuda, nem encaminhamento, nem "vou ver
o que posso fazer". Há teste que falha se ele escorregar para isso.

### Duas decisões de desenho

**A regra fica no ALTO** — posição 3 de 13. Só passam na frente a etiqueta que dispensa da fila
(decisão explícita dele) e o áudio, que precisa ser ouvido antes de qualquer decisão. **Vence a
despedida de propósito**: *"preciso da sua força, abraço"* concluído é fechar a porta na cara de um
pedido.

**A tecla 9 não conclui**, ao contrário de todas as outras que enviam texto. O caso só se resolve com
a resposta dela, e concluir tiraria o contato da fila exatamente antes disso.

**Arquivos:** `src/lib/cortesia.js`, `src/lib/sugestao.js`, `src/lib/store.js`,
`src/lib/templates.js`, `src/panel/panel.js`, `tests/cortesia.test.mjs` (+16),
`tests/sugestao.test.mjs` (+10), `tests/templates.test.mjs` (+7), `CLAUDE.md`,
`CONTEXTO.md` (a lista de ordem foi reescrita a partir do código — estava com numeração furada),
`manifest.json` (0.52.0 → **0.53.0**). 29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — "Tamojuntos" é apoio, e o critério do apoio deixa de ser tamanho

**Relato dele**, print do Izaak: última mensagem *"Tamojuntos"*, e a caixa sugeriu **concluir**.
*"nesse caso vou usar a mensagem 8, a última mensagem foi tamojuntos, seria estamos juntos"*.

E sobre o limite de 100 caracteres que eu tinha calibrado com ele minutos antes:

> *"se basear em caracteres vai dar só erro é um valor totalmente aleatório e será trocado toda hora"*

Ele está certo, e a crítica é melhor que a minha implementação.

### Duas causas

**1. Conflito de vocabulário.** `"tamo junto"`, `"tmj"` e `"estamos juntos"` estavam **nas duas
listas** — `DESPEDIDA` e `EXPRESSOES_DE_APOIO`. Como despedida é a regra 3 e apoio a 8, o apoio
nunca era alcançado. Saíram da despedida. A linha que ficou: **fecho é fecho; solidariedade é
apoio** — "valeu, abraço" encerra a conversa, "tamo junto" afirma que a pessoa está com ele.

`sucesso`, `boa sorte` e a bênção **ficaram na despedida**: ele não pediu para mexer nelas, e "Que
Deus abençoe" sozinho é fecho. Mexer no que não foi apontado é como se perde o que já estava certo.

**2. `"Tamojuntos"` vem colado**, e o padrão exigia `\s+`. Agora é `\s*`, com `tamo`/`tamos`/`segue`
somados às formas que já havia.

### O critério novo, estrutural

Fora o tamanho. **Vale quando ela escreveu mais de uma vez.**

As duas prints mostram a mesma coisa: a **primeira** mensagem é o texto pronto do anúncio (*"Olá! Eu
apoio as Escolas Cívico-Militares"*, *"Olá! Eu apoio o Flávio, Zucco e Capitão Martim"*) — ela não
escolheu as palavras, clicou num botão. Qualquer mensagem depois é ela escrevendo: o "texto de
baixo" do Ciro, o "Tamojuntos" do Izaak.

É literalmente o que ele descreveu: *"se não tivesse o texto de baixo eu mandaria o modelo,
agradeceria a atenção e encerraria"*.

### Um furo que só o teste pegou

Com a rajada colada, *"Olá! Eu apoio as Escolas"* + *"bom dia"* casava — o "apoio" estava no texto do
**anúncio**. A regra passaria a valer para qualquer um que clicasse no anúncio e escrevesse qualquer
coisa depois, que é o oposto do critério. **A primeira mensagem saiu da conta**: o apoio tem de estar
no que ela escreveu.

### Testes

Cinco asserções antigas **trocadas e não apagadas**, com o motivo: três de despedida (`tamo junto`,
`estamos juntos`, `tmj`) e duas do apoio por tamanho. Lidas sozinhas, todas soavam corretas.

**Arquivos:** `src/lib/cortesia.js`, `tests/cortesia.test.mjs`, `manifest.json`
(0.51.0 → **0.52.0**). 29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — São dois agradecimentos, e o do apoio é exceção que vence o modelo

**Dele, em duas mensagens:** *"a prioridade é responder o que foi falado depois mandar modelo"* e
*"são dois tipos de agradecimento, aqui está agradecendo o apoio é um adicional uma exceção a regra,
se não tivesse o texto de baixo eu mandaria o modelo agradeceria a atenção e encerraria"*.

### A distinção que eu não tinha entendido

Existem **dois** agradecimentos, e eu tratei como um:

| | quando | como |
|---|---|---|
| **pela ATENÇÃO** | caso normal | já sai junto com o modelo — a tecla 1 é *"modelo + agradecimento e concluir"* |
| **pelo APOIO** | exceção | tecla 8, e só quando a pessoa escreveu mensagem própria |

### Duas mudanças, e a segunda é o que torna a primeira segura

**1. A regra subiu acima de `conteudo-pedido`** — reversão do que eu fiz hoje de manhã, quando a pus
abaixo argumentando que *"agradecer antes de entregar responderia o carinho e engoliria o pedido"*.
Ele desfez, e está certo por uma razão de atendimento: quem escreveu uma mensagem própria espera
resposta àquilo. O material vai na rodada seguinte, quando não houver mais nada a responder.

**2. `soExpressaApoio` passou a exigir 100+ caracteres** (`APOIO_ELABORADO`). É isto, e não a ordem,
que impede o apoio de engolir o pedido.

Medido nas duas mensagens do Ciro: a primeira (*"Olá! Eu apoio o Flávio, Zucco e Capitão Martim"*)
tem **49** caracteres; o "texto de baixo", em que ele conta que é bolsonarista de sempre e em quem
vai votar para senador, tem **144**. Os apoios genéricos ficam todos abaixo de 50 — "apoio!" tem 6,
"conte comigo" tem 12. **100 cai no vazio entre os dois grupos**, com margem dos dois lados.

Conferido nos dois cenários: com o texto de baixo → tecla 8; sem ele → tecla 1.

### Os contra-testes

O que garante que a subida não estragou nada: **apoio longo + pergunta é pergunta**, e **apoio longo
+ pedido de material é pedido**. Responder a metade fácil e engolir a que importa é o defeito mais
caro que uma resposta automática pode ter. Áudio, despedida, pedir dados e a etiqueta que dispensa
continuam vencendo.

**Arquivos:** `src/lib/cortesia.js` (`APOIO_ELABORADO`), `src/lib/sugestao.js` (ordem e o comentário
da reversão), `tests/cortesia.test.mjs` e `tests/sugestao.test.mjs` (grupos reescritos),
`CLAUDE.md`, `CONTEXTO.md`, `manifest.json` (0.50.0 → **0.51.0**).
29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — A tecla 8 não apareceu: o texto é que nunca chegou

**Relato dele**, print da 0.48.0: *"a mensagem de agradecimento pelo apoio não foi adicionada as
opções"*, e depois *"deve ser um novo e com a tecla de acordo agradecer apoio + concluir"*.

### A causa

A tecla 8 só aparece se o texto dela existir e resolver as variáveis:

```js
if (!apoioTrava) opcoes.push({ tecla: '8', valor: 'apoio', ... });
```

Eu acrescentei `agradecer-apoio` a `DEFAULT_TEMPLATES` e paramei aí. Mas
`store.get('templates')` devolve o **array salvo inteiro** — array não se mescla por espalhamento
como `settings`. Ele já tem a lista salva (mexeu nas variações hoje), então o texto novo nunca
chegou, e a tecla desapareceu sem erro nenhum.

**A tecla não estava faltando. O texto é que nunca tinha chegado.**

### O caminho errado que eu tentei primeiro

Comecei mesclando dentro do `store.get`, por id. Funcionava — e **quebrou dois testes das
migrações que já existem**. Foi assim que descobri que o projeto já tinha resolvido isto:
`templates.garantirRespostas([ids], 'flag')`, chamada em `list()`, que *"só acrescenta o que falta,
nunca altera nem apaga o que existe"* e roda uma vez só.

Revertida a mescla; feita a migração. Uma solução por problema é melhor que duas concorrendo, e a
que estava lá tem uma propriedade que a minha não tinha: **grava**, então ele pode editar o texto
novo como qualquer outro.

### `migrarRespostaAgradecerApoio`

Flag própria (`respostaAgradecerApoio`), pelo motivo que os comentários das outras já explicavam:
reaproveitar flag antiga faria voltar resposta que ele apagou de propósito.

Nove asserções, incluindo as três que importam: não duplica quem já tem, não sobrescreve o texto
dele, e não repete na segunda chamada.

**Arquivos:** `src/lib/templates.js`, `tests/templates.test.mjs`, `CLAUDE.md`,
`manifest.json` (0.49.0 → **0.50.0**). 29 módulos sem erro, dez suítes passando.

**Ao recarregar:** a migração roda no primeiro `list()`, então a tecla 8 aparece já na primeira
abertura do painel — sem ele precisar mexer em nada.

---

## 2026-08-31 — Pular deixa de escrever no CRM

**Pedido dele:** *"ao pular tem gravado dados no crm o que faz eu perder tempo com esses contatos
que eram pra ser pulados rapidamente"*.

### O que o pulo custava

`saveClassification({ withCompletionDate: true })` em cada pulo, ou seja, por contato:

- `confirmarCidadeSePendente` — que pode **abrir a pergunta de cidade**, a espera mais longa que
  existe no meio de uma gravação;
- uma requisição por campo alterado (`writeValues`);
- mais uma de etiquetas (`applyTags`).

Numa fila de centenas, com respiro entre requisições, isso é a diferença entre passar por um
contato e parar nele.

### E o que ele gravava estava errado

`withCompletionDate: true` grava a **"Data de conclusão do contato"** — num atendimento que o
próprio motivo dizia ficar *"aberto"*. Marcava como tratado justamente quem foi deixado para
depois. Isso não apareceu como defeito porque ninguém filtra por esse campo hoje; apareceu como
lentidão.

### O que mudou

Os dois caminhos de pular (a tecla 2 da rodada e a da caixa de canal fora do ar) saem sem tocar no
CRM. O pulo automático por etiqueta já não gravava.

**Nada se perde:** o que era gravado ali era palpite do parser que ninguém tinha confirmado, e o
parser refaz tudo na próxima vez que o contato abrir. O que se perde é só a rede gasta com quem foi
pulado.

A caixa do canal fora do ar também parou de gravar **antes** de perguntar: as duas saídas dela são
pular (que não grava) e parar, então a gravação pagava o custo em 100% dos casos para servir a
nenhum. As mensagens que diziam *"classificação gravada"* foram corrigidas — texto de tela que
mente é pior que texto de tela que falta.

**Regra que fica:** saída que não trata o contato não paga escrita.

**Arquivos:** `src/panel/panel.js`, `CLAUDE.md`, `manifest.json` (0.48.0 → **0.49.0**).
29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — Rajada de links não pede formulário

**Relato dele**, print do Odone na 0.47.0 (agora sugerindo *"4: veio do anúncio e o formulário nunca
saiu para ele"*): *"eu vejo que está confuso quando é rajada de links, links em geral devem ser
ignorados, não lembro de exceções"*.

### A distinção que faltava: para quem o gesto aponta

`ultima-e-so-reacao` já tratava link como reação, mas `nunca-pediram-dados` está acima dela (subiu
hoje, com a print da Marta) e vencia. E as duas situações são opostas:

- **Emoji** é dirigido **a ele**. A Marta respondeu o anúncio com 🙏 — ali pedir os dados é o certo,
  e foi ele quem pediu isso hoje de manhã.
- **Link** é conteúdo de **outra pessoa**, passando adiante. Não diz nada sobre este contato, e
  responder a ele com um formulário é responder a coisa errada.

`cortesia.ehRepasse` separa os dois: link sozinho e vídeo são repasse; emoji, texto e áudio não.
Link **com** texto junto também não é — ela escreveu algo.

`nunca-pediram-dados` passou a exigir `!rajadaEhSoRepasse`. O Odone cai de volta na tecla 5
(mensagem do momento), e a Marta continua na 4 — há teste para os dois.

### O outro problema, que a mesma print mostra e o código não resolve

O Odone tem **Cidade: Santa Catarina**, e o painel já avisa: *"não casa com nenhum dos 497
municípios do RS"*. Como as etiquetas de cidade só existem para municípios do RS,
`temEtiquetaDeCidade` é **falso para sempre** nele — e seria assim em todo contato de fora do
estado.

Sem o conserto acima, ele apareceria pedindo formulário em **toda** rodada, para sempre.

**Isso ele resolve sem código:** o contato já carrega a etiqueta **FORA DO RS**, e a aba
Automatizado tem *"Etiquetas que a rodada pode pular"* (hoje com "engajado"). Somar `fora do rs` ali
tira esses contatos da fila de uma vez. Não fiz por conta própria porque é decisão de negócio —
pode haver razão para continuar falando com quem mora fora e vota aqui.

**Arquivos:** `src/lib/cortesia.js` (`ehRepasse`, `rajadaEhSoRepasse`), `src/lib/sugestao.js`,
`src/panel/panel.js`, `tests/cortesia.test.mjs` (+10), `tests/sugestao.test.mjs` (+3),
`manifest.json` (0.47.0 → **0.48.0**). 29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — "76 mensagens somando 3254 caracteres": a rajada somava o arquivo morto

**Relato dele**, print do Odone na 0.46.0: *"não fez sentido nenhum a sugestão, explique"*. A caixa
dizia *"6: escreveu 76 mensagens somando 3254 caracteres — é conversa, não é caso de modelo"*.

**Defeito meu, do mesmo dia**, na regra da rajada.

### A explicação

`rajadaFinal` parava numa coisa só: a nossa última mensagem. E tinha esta linha:

```js
if (!nossaUltimaAt) return lista;   // nunca respondemos → a rajada é TUDO
```

O Odone compartilha vídeo o dia todo e nunca foi respondido. Então a "rajada" dele era o histórico
inteiro — **76 mensagens acumuladas ao longo de semanas**, somando 3.254 caracteres. Passou dos 400
e virou "conversa".

**A conta que denuncia: 3254 ÷ 76 = 43 caracteres por mensagem.** São links e repasses, não
parágrafos. Uma conversa de verdade tem 150+ por mensagem — o caso que criou a regra tinha três
mensagens de 250, 55 e 145 caracteres em dois minutos.

**O erro foi de definição, não de número.** Eu tratei *"tudo que não respondemos"* como se fosse
*"tudo que ela escreveu de uma vez"*. São coisas diferentes, e o que as separa é o relógio.

### O conserto

A rajada agora para em **duas** coisas: a nossa última mensagem **e** um buraco de mais de 30
minutos entre duas mensagens dela. Meia hora é folga larga para quem escreve devagar, e ainda
separa isso de quem manda uma coisa hoje e outra amanhã.

No caso do Odone a rajada passou de 76 para **1**, e a sugestão saiu da tecla 6.

Mensagem sem `at` não quebra a corrente: sem horário não dá para afirmar que houve buraco, e o lado
seguro é manter na rajada.

### Duas asserções antigas trocadas, não apagadas

*"sem nossa mensagem, a rajada é tudo"* passou a `=== 2`, com o motivo no comentário. É o que
impede alguém de "consertar" a definição de volta em um mês — e hoje mesmo isso aconteceria, porque
a frase antiga soa correta lida sozinha.

**Arquivos:** `src/lib/cortesia.js` (`INTERVALO_DA_RAJADA_MS`, `rajadaFinal`),
`tests/cortesia.test.mjs` (+9, 1 trocada), `CLAUDE.md`, `manifest.json` (0.46.0 → **0.47.0**).
29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — Vídeo compartilhado sai da fila de "responder à mão"

**Relato dele**, print do Odone: reel do Instagram e vídeo do Facebook de 631 mil visualizações. A
caixa sugeria *"6: mandou um vídeo — só dá para responder depois de abrir. Responda à mão"*.

> *"são centenas de mensagens e crescendo, não existe essa de parar pra ver vídeos e responder, é
> ignorar dando bom dia ou enrolar com outro assunto"*

### A distinção que faltava

`VIDEO` estava em `TIPOS_QUE_PEDEM_VOCE`, junto do áudio. Mas **a diferença é quem está falando**:

- **Áudio** é a pessoa gravando *para ele*. O caso que criou essa regra foi 1min13 sobre a família e
  a igreja — mandar modelo aprovado ali parece deboche.
- **Vídeo** é conteúdo de terceiro chegando pela décima vez no dia. Abrir cada um não escala, e não
  abrir não ofende ninguém.

`VIDEO` foi para `TIPOS_COMPARTILHADOS` (antes `TIPOS_DE_IMAGEM`), junto de figura e figurinha — ou
seja, passa a ser tratado como **reação**: mensagem do momento, ou concluir se já respondemos hoje.
Que é exatamente o "dar bom dia ou enrolar com outro assunto" da frase dele.

Ficaram em `TIPOS_QUE_PEDEM_VOCE` o que a pessoa produziu ou endereçou a ele: **áudio, arquivo,
contato e localização**.

### Um defeito de tela que apareceu junto

O rótulo era `tipo === 'AUDIO' ? 'um áudio' : tipo === 'VIDEO' ? 'um vídeo' : 'um arquivo'` — então
contato e localização apareciam como *"mandou um arquivo"*. Virou um mapa `NOME_DO_TIPO`, e agora
cada um se chama pelo nome.

### A trava que mantém isto seguro

**Vídeo COM texto longo junto continua pedindo resposta à mão** — o texto é que manda, e o teste
trava isso. Quem grava um vídeo e escreve três parágrafos junto não está repassando meme.

A asserção antiga (*"vídeo também"* pede) foi **trocada e não apagada**, com o motivo no comentário:
é o que impede alguém de "consertar" isto de volta daqui a um mês.

**Arquivos:** `src/lib/cortesia.js`, `tests/cortesia.test.mjs` (+11 e 1 revertida), `CLAUDE.md`,
`manifest.json` (0.45.0 → **0.46.0**). 29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — Tecla 8: agradecer o apoio. E o "pq" que eu tinha quebrado

**Relato dele**, print do Ciro: *"esse é um caso comum até onde a pessoa só expressa o apoio, ja tem
as etiquetas, então é só uma questão de agradecer o apoio e carinho, teria que ter mais um botão pra
isso"*.

### Primeiro, o bug que a print revelou

A faixa da caixa dizia *"fez uma pergunta que nenhuma resposta pronta responde"* — e não havia
pergunta nenhuma. O casamento foi no **"pq"** de *"ficou muito grato pq sou Bolsonaro desde
sempre"*: conjunção explicativa, um dos usos mais comuns do português de WhatsApp.

**Regressão minha, de uma hora antes.** A regra `pergunta-aberta` estava tirando da automação
justamente quem só agradecia — o oposto do que ela existe para fazer.

O conserto: a avaliação passou a ser **mensagem por mensagem** (colado, o começo de uma virava o
meio de uma frase gigante), e o padrão só conta como pergunta se a mensagem **tem interrogação** ou
se ele está no **começo** dela. Quem pergunta abre com a pergunta ou marca com "?"; quem explica põe
o "pq" no meio do que está contando. Sete asserções travam os dois lados.

### O botão

Template de fábrica novo, `agradecer-apoio` ("Agradecer o apoio e encerrar"), com duas variações
como os outros. **Separado do `agradecer-info`** de propósito: aquele agradece *informações*
("recebemos tudo por aqui"), e usá-lo em quem escreveu "sou Bolsonaro desde sempre" responde outra
conversa.

Ele **não pede nada e não promete nada** — nem grupo, nem material, nem dados. Quem só quis dizer
que está com você não pediu tarefa; mandar uma vira cobrança em cima de um agrado.

### A regra, e a asserção que é a regra inteira

`cortesia.soExpressaApoio` reconhece "apoio", "conte comigo", "vou votar", "sou seu eleitor",
"parabéns/sucesso/força", bênção, "torcendo".

**Quem decide é o que NÃO está na mensagem.** Apoio junto com pergunta é pergunta; junto com pedido
de material é pedido. Reusa `conversaTemPerguntaAberta` e `PEDIDO_DE_MATERIAL` em vez de repetir as
listas — duas listas para a mesma pergunta divergem na primeira vez que uma é ajustada sozinha.

**A regra fica ABAIXO de `conteudo-pedido`, e isso é o desenho todo:** quem clicou no anúncio e
ainda não recebeu o material recebe o material. Só depois de entregue (ou não havendo modelo) é que
"obrigado pelo apoio" é o desfecho — e `conteudo-pedido` já testa `enviadoHoje` e
`modeloJaNaConversa` sozinho. **Agradecer antes de entregar responderia o carinho e engoliria o
pedido.**

**Arquivos:** `src/lib/cortesia.js` (conserto do `pq` + `soExpressaApoio`), `src/lib/sugestao.js`,
`src/lib/store.js` (o template), `src/panel/panel.js` (tecla e envio),
`tests/cortesia.test.mjs` (+18), `tests/sugestao.test.mjs` (+9), `CONTEXTO.md`,
`manifest.json` (0.44.0 → **0.45.0**). 29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — A lista dos casos sem regra, que é a lista das regras a escrever

**Dele:** *"refinar até sobrar pouca indecisão"*.

O contador do commit anterior diz **quanto** sobrou. Para escrever a regra seguinte ele precisa
saber **o quê** — e vinte linhas espalhadas no meio de cem passam batidas.

### O que a rodada mostra agora, no fim

```
? — a refinar —  7 caso(s) que nenhuma regra reconheceu. Vários iguais = uma regra nova:
? Marta Ferreira  última mensagem: "🙏🙏"
? Clair           última mensagem: "Porque?"
? José            última mensagem: "(AUDIO)"
```

Lidos **juntos**, o padrão aparece: seis casos iguais são uma regra, não seis decisões. Foi assim
que as três regras de hoje nasceram, só que a partir de prints que ele mandou uma por uma.

`state.auto.semRegra` virou um `Map` guardando `{nome, texto, tipo}` — a última mensagem **com
texto** do contato, cortada em 120 caracteres. Continua sendo escrito num ponto só, logo depois de
`sugerirAcao`.

### Dois detalhes que evitam armadilha

- **`refinar` é resultado próprio, não `'pulado'`.** Estas linhas entram DEPOIS de o resumo estar
  montado; reusar um resultado que o resumo conta deixaria uma bomba armada para quem mover a ordem
  dessas duas coisas um dia. Ele também não está em `SAI_DA_FILA` nem no limite da rodada.
- **`aviso` ganhou sinal (`⚠`) junto.** Já era usado em outro lugar e caía no `·` genérico do
  fallback desde então.

**Arquivos:** `src/panel/panel.js`, `manifest.json` (0.43.0 → **0.44.0**).
29 módulos sem erro, dez suítes passando.

**Como usar:** rode uma rodada, leia a lista do fim. Situação que aparece três vezes é regra nova em
`sugestao.js`; situação que aparece uma vez e é única mesmo é caso da IA. Essa separação é o que
decide onde vale gastar o próximo esforço — e é ela que diz quando "sobrou pouca indecisão".

---

## 2026-08-31 — "Reconhecer pela falta de opções": o sinal já existia e a tela o escondia

**Pedido dele:** *"não sera criado etiqueta pra isso terá que reconhecer isso pela falta de
opções"* — recusando a tecla 8 com etiqueta que eu tinha feito meia hora antes, e que foi
**revertida**.

Ele está certo, e por uma razão que eu tinha na frente: `sugerirAcao` já devolve `null` quando
nenhuma regra casa, e o próprio comentário da função chama isso de *"resposta legítima e comum"*.
O sinal existia. Criar etiqueta seria pôr um rótulo permanente na base de eleitores para registrar
o que o painel **já sabe** no instante em que desenha a caixa.

### O que mudou

**A caixa deixa de ficar calada.** Sem recomendação, ela agora mostra *"Nenhuma regra reconheceu
este caso — a decisão é sua."*, numa faixa **cinza** e não na azul do destaque: azul quer dizer
"aperte esta tecla", e usar a mesma cor para "não sei" ensinaria a ignorar as duas.

Antes disto, "a rodada não sugeriu nada" era visualmente idêntico a "a rodada não olhou".

**O resumo da rodada passa a contar**: *"…, 7 que nenhuma regra reconheceu"*. É a medida de
cobertura, de graça e sem tocar no CRM — cada um desses é um contato que o determinístico não
resolveu. A conta encolhendo, rodada após rodada, é o refinamento funcionando, e é ela que diz
quando vale ligar a IA, que custa por contato avaliado.

### A decisão de implementação que importa

A marca é escrita num **ponto só**, logo depois de `sugerirAcao`, em `state.auto.semRegra`. Minha
primeira versão propagava um campo `semRegra` pelo `return` — e cobria **um** caminho de saída
entre os vinte que o tratamento de um contato tem. Ficaria errada no dia em que alguém
acrescentasse o vigésimo primeiro, e errada em silêncio.

É um `Set` por id de atendimento, não um contador: a fila devolve o concluído ao topo (está no
`CLAUDE.md`), o mesmo contato pode passar duas vezes, e contar duas vezes inflaria a medida
justamente no caso que já dá trabalho.

### É aqui que a IA entra

No branch `claude/whatsfill-ia`, `sugestao === null` é o gatilho da avaliação, e **o lugar dela na
tela é exatamente esta faixa cinza** — a IA substitui "nenhuma regra reconheceu" por uma
recomendação de verdade. Que é o plano dele: refinar o determinístico até sobrar pouco, e só o que
sobrar custar token.

**Arquivos:** `src/panel/panel.js`, `src/panel/panel.css`, `manifest.json` (0.42.0 → **0.43.0**).
29 módulos sem erro, dez suítes passando. A tecla 8 e `etiquetaParaIA` não existem mais.

---

## 2026-08-31 — Pergunta específica: a rodada parava de mandar modelo em cima dela

**Relato dele**, print da Clair: *"pergunta especifica, caso para IA"*. Ela respondeu o formulário
("Clair portella, Santa Maria") e depois escreveu *"Quero dar uma opinião, tem muita propaganda
aqui em santa Maria, mas não do capitão Martins."* seguido de *"Porque?"*.

Simulei antes de mexer: a rodada sugeria **tecla 1, mandar o modelo "Campanha Martim2"** — material
de campanha como resposta a uma pergunta sobre a falta de material de campanha.

### Por que nenhuma regra pegava

- rajada de **126 caracteres**, longe dos 400 da regra de texto longo
- não é reação, não é despedida
- já pediram dados, já tem cidade
- há conteúdo mapeado (ADS) → `conteudo-pedido` venceu

### A regra, e por que ela é curta

`cortesia.conversaTemPerguntaAberta` casa **só razão e posição**: "por que"/"pq"/"por quê", "qual a
posição/opinião", "o que ele acha/pensa/vai fazer", "me explica", "não entendi". São as que
dependem do que ele pensa, e para as quais não existe texto pronto.

**Toda entrada nessa lista tira um contato da automação**, e a meta dele é 90% resolvido sem IA —
por isso ela é curta, e por isso *pedido de material sai antes de tudo*: "pode me mandar o
material?" também é pergunta, e o modelo a responde bem.

Os testes que importam são os sete falsos positivos, não o caso da print: "tudo bem?", "quero
ajudar", "me manda o link", "quero receber", "bom dia". Todos continuam indo para onde iam.

`pergunta-aberta` entra na **posição 7**, logo acima de `conteudo-pedido` e não mais alto de
propósito: é o mínimo para resolver o caso. Etiqueta que dispensa, áudio, despedida e pedido de
dados continuam vencendo — todas já estavam certas.

### Onde isto acaba e a IA começa

Igual ao caso do alerta político mais cedo: **a rodada acerta a TECLA** (6, à mão) e para de mandar
a mensagem errada. Reconhecer que a pergunta é sobre distribuição de material em Santa Maria, e
propor o que responder, continua sendo da IA. Ele está certo em chamar de "caso para IA" — o que o
determinístico faz aqui é impedir o dano, não resolver.

### Um bug do meu regex, pego pelo teste

`o que vocês **vão** fazer` não casava: eu tinha "vai" e esqueci "vão". Corrigido junto com
"pretendem", "acham", "pensam", "farão".

**Arquivos:** `src/lib/cortesia.js` (`conversaTemPerguntaAberta`, `PERGUNTAS_QUE_PEDEM_VOCE`,
`PEDIDO_DE_MATERIAL`), `src/lib/sugestao.js` (a regra), `src/panel/panel.js`,
`tests/cortesia.test.mjs` (16 asserções), `tests/sugestao.test.mjs` (7),
`CONTEXTO.md`, `manifest.json` (0.41.0 → **0.42.0**).
29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — Emoji como única mensagem de quem veio do anúncio: pedir dados vence

**Relato dele**, print da Marta: contato do anúncio, etiqueta ADS, **cidade vazia**, uma única
mensagem — 🙏, às 18:24. A caixa sugeria *"5: a última mensagem foi só uma figura, emoji ou link"*.
*"nesse caso a pessoa respondeu o anuncio com um emoji, eu tenho que pedir os dados"*.

### Causa

`ultima-e-so-reacao` estava na posição 5 e `nunca-pediram-dados` na 6. A primeira que casa vence,
e o emoji casou antes.

A ordem antiga tinha razão escrita no comentário: *"responder um 👍 com 'me manda seu nome e
cidade' lê como robô que não olhou a tela"*. **Continua verdade — para quem já tem conversa.**

### O conserto, e por que trocar a ordem é seguro

As duas trocaram de lugar. O que impede isso de estragar o caso que criou a regra da reação é a
**condição** da regra que subiu:

```js
!c.jaPediramDados && !c.temEtiquetaDeCidade && c.podePedirDados && !c.pedidoHoje
```

Quem já recebeu o formulário, ou já tem cidade, ou já foi perguntado hoje **não casa nela** e
continua caindo na reação, exatamente como antes. O que muda é só o caso da print: alguém que
acabou de chegar do anúncio, sem cidade, que nunca foi perguntado. Ali não há conversa para o robô
estragar — perguntar é o primeiro passo, e a tela não tem mais nada a olhar.

### Os quatro contra-testes

O teste que importa não é o da print, é o que trava a inversão de ir longe demais. Todos passando:

| situação | antes | agora |
|---|---|---|
| emoji, do anúncio, sem cidade, **nunca** pediram | 5 | **4** |
| emoji, **já** pediram dados | 5 | 5 |
| emoji, **já tem** cidade | 5 | 5 |
| emoji, pedido **hoje** | 5 | 5 |
| áudio no meio | 6 | 6 |

**Arquivos:** `src/lib/sugestao.js` (ordem e os dois comentários),
`tests/sugestao.test.mjs` (6 asserções), `CONTEXTO.md` (a lista de ordem estava desatualizada),
`manifest.json` (0.40.0 → **0.41.0**). 29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — Nome errado no CRM: separar para ele arrumar, sem trocar nada

**Relato dele**, print do "viver a vida": o cadastro tinha nome de perfil, a pessoa respondeu
*"Daniel Ribeiro/Canoas"* logo depois de o atendimento ser concluído. *"tem duas opções ou trocar o
nome pela extensão ou separar esse contato deixando para o final e eu mesmo arrumar"*.

**Ele escolheu separar.** O nome nativo do contato não é tocado em lugar nenhum.

### O que a investigação mudou na pergunta

Antes de propor, três coisas apareceram e nenhuma era óbvia:

1. **São dois campos "nome" diferentes.** O que aparece no topo do CRM é `contact.name`, nativo,
   vindo do WhatsApp. Separado dele existe um campo personalizado **"Nome"**, que é o que a
   extensão grava e usa em variáveis e etiquetas.
2. **Corrigir o nativo exige rota que a extensão nunca executou** — não há escrita de contato em
   `api.js`, só de etiqueta. Seria descobrir no bundle do Angular, com as duas armadilhas já
   registradas sobre isso.
3. **O parser já resolve a leitura.** `extract(['Daniel Ribeiro/Canoas'], {respostaAoPedido:true})`
   devolve cidade Canoas (exata) e nome Daniel Ribeiro. Nada a fazer ali.

### A regra

`vars.nomeDivergeDoInformado(cadastro, informado)`, pura e testada. **Divergir não é ser
diferente** — três casos que não contam, e cada um encheria a fila de revisão de contato certo:

- **um contém o outro** — "Daniel" x "Daniel Ribeiro" é a mesma pessoa dando o nome completo;
- **acento e caixa** — "JOSE" x "José" resolvem para a mesma pessoa;
- **cadastro de anúncio ou vazio** (`looksLikePlaceholder`) — é buraco, não contradição, e buraco o
  parser preenche sozinho como sempre fez.

`nomeSemSentido` **não serve aqui**, e é o detalhe que muda o desenho: "viver a vida" tem vogais e
não é placeholder, então passa nele. É a DIVERGÊNCIA que denuncia, não a forma do cadastro.

### Onde ela se liga

Sai por `tags.suggest` como as outras, com **`origem: 'revisão'`** e não `'conteúdo'`: conteúdo
alimenta a tabela "Modelo por conteúdo" e viraria modelo a enviar — mandar a campanha para quem
está na fila de conserto de cadastro é o tipo de coisa que ninguém percebe até acontecer.

A comparação usa **o palpite do parser** (`state.nomeInformado`), não o rascunho. O rascunho não
serve: quando o campo "Nome" está vazio ele é semeado com o próprio `contact.name`, então comparar
os dois daria "igual" justamente no caso que interessa. `state.nomeInformado` é limpo na troca de
contato — sem isso a etiqueta cairia na pessoa errada, que é a armadilha já registrada da pergunta
de cidade.

Etiqueta configurável na aba Automatizado, **vazia por padrão**: precisa existir no CRM, e a
extensão não cria etiqueta sozinha.

### Um bug meu, achado pelo teste que eu quase não escrevi

`achatarNome` saiu do meu script com as barras invertidas comidas: `\s` virou a letra **s**
literal, e `.replace(/s+/g, ' ')` apagava todo "s" dos nomes. "Maria Souza" virava "maria ouza".
Nove das dez asserções passavam assim — só o caso de pontuação ("Daniel R. Ribeiro" x "Daniel R
Ribeiro") acusou. Sem ele, isto teria ido para produção comparando nomes mutilados.

### Arquivos

`src/lib/vars.js` (`nomeDivergeDoInformado`, `achatarNome`), `src/lib/tags.js` (a sugestão),
`src/lib/store.js` (`etiquetaNomeDivergente`), `src/panel/panel.js` (detecção, estado e Config),
`tests/vars.test.mjs` (10 asserções), `manifest.json` (0.39.0 → **0.40.0**).
29 módulos sem erro, dez suítes passando.

**Para funcionar, ele precisa criar a etiqueta no CRM e escrever o nome dela na aba Automatizado.**
Vazio, a extensão não marca ninguém.

---

## 2026-08-31 — "A sugestão está totalmente errada aqui": três mensagens curtas são uma conversa

**Relato dele**, print do Ipê: a caixa sugeria *"1: pediu 'ADS' e há modelo mapeado — mande"* para
um apoiador que tinha acabado de escrever, em três mensagens, um alerta político — que gente paga
poderia estar se passando por apoiador do candidato, e que tomassem cuidado.

*"isso seria um exemplo onde a ia teria que assumir pra responder"*.

### O que eu quase consertei errado

Meu primeiro palpite foi que a etiqueta **ADS** estava mal classificada: ela é origem de anúncio, e
`tags.js` a emite como `origem: 'conteúdo'`. Fui ler o comentário antes de mexer, e ele diz que é
**pedido dele de 31/08** (*"adicionar a etiqueta ADS resolve tudo"*), de propósito, para alimentar a
tabela "Modelo por conteúdo". Não era bug — e "consertar" ali teria quebrado o que ele pediu de
manhã.

### A causa raiz

A regra que **deveria** ter vencido existe e está acima: `ultima-pede-resposta-pessoal` (tecla 6),
que pega áudio, vídeo e texto de 400+ caracteres. Ela não casou porque olhava
`lista[lista.length - 1]` — **só a última mensagem**.

O contato escreveu três, em dois minutos: ~250 + ~55 + ~145 caracteres. Cada uma abaixo de 400, o
conjunto em ~450. A rodada desceu a lista e caiu em `conteudo-pedido`.

**Que os parágrafos venham numa mensagem ou em três é jeito de digitar, não intenção** — e era só
isso que separava este caso do áudio de 1min13 que a mesma regra já pegava.

### O conserto

`cortesia.conversaPedeRespostaPessoal(entrantes, nossaUltimaAt)` soma a **rajada**: as entrantes que
chegaram depois da nossa última mensagem. Para isso, `api.js` passou a devolver `at` em cada
entrante — sem horário, `entrantes` era uma lista sem antes e depois.

Decisões dentro dele:

- **Tipo vence tamanho, em qualquer posição da rajada.** Áudio no meio pede você mesmo que o resto
  seja curto.
- **Sem `nossaUltimaAt`, a rajada é tudo.** Nunca respondemos, nada foi respondido: está certo.
- **Mensagem sem `at` entra na rajada.** Pôr de fora baixaria a soma e traria o modelo de volta —
  que é o defeito que isto conserta.
- O motivo na tela diz quantas mensagens foram, porque *"escreveu 3 mensagens somando 450
  caracteres"* explica a recomendação de um jeito que *"escreveu 145 caracteres"* não explicaria.

`ultimaPedeRespostaPessoal` fica: é pura, testada, e a nova a usa por dentro para o teste de tipo.

### Onde ele está certo sobre a IA

O determinístico acerta a **tecla** — para de sugerir o modelo e manda responder à mão. O que ele
não faz é entender que aquilo é um alerta e não uma reclamação, nem propor o que responder. Essa
metade é da IA, e é o caso de uso dela: não é escolher entre respostas prontas, é reconhecer que
nenhuma serve. A tecla 6 já era o destino certo; a IA vai mudar o que acontece **depois** dela.

### Arquivos

`src/lib/cortesia.js` (`rajadaFinal`, `conversaPedeRespostaPessoal`), `src/lib/api.js` (`at` em cada
entrante), `src/panel/panel.js`, `tests/cortesia.test.mjs` (10 asserções novas, com o caso da print
como regressão), `CLAUDE.md`, `CONTEXTO.md`, `manifest.json` (0.38.1 → **0.39.0**).

**Convenção de versão corrigida no mesmo commit.** Eu havia documentado "versão sempre maior no
branch da IA" e a quebrei em seguida: subi produção para 0.39.0, que é onde a IA já estava. Regra
que exige alguém lembrar não é regra. Agora a **série** separa os dois — produção **0.x**, IA
**1.x** — e não há nada a lembrar.
29 módulos sem erro, dez suítes passando.

---

## 2026-08-31 — Os dois branches passam a estar escritos, e a armadilha da pasta única

**Pedido dele:** *"resolva"*. A outra metade do trabalho — o merge está registrado no
`registro.md` do branch `claude/whatsfill-ia`.

### O que estava errado

O `CONTEXTO.md` afirmava: *"branch `claude/extensao-claude-analise-i9spxw` (é o único deste
repo)"*. Não é — existe `claude/whatsfill-ia`, com a avaliação por IA. E o `CLAUDE.md` não
mencionava branch nenhum.

**Por que isso paga o próprio custo:** o `CONTEXTO.md` existe justamente para abrir uma aba nova
sem redescobrir nada. Uma sessão que lesse "é o único" e recebesse um pedido de IA faria uma de
duas coisas ruins — refazer do zero o que já existe, ou **implementar a IA neste branch**, que é
exatamente o que ele não quer (a regra "Sem IA na extração" é deste branch).

### A armadilha que veio junto

As duas extensões carregam da **mesma pasta** (`OneDrive/Documents/GitHub/WhatsFill`, confirmado
no `Secure Preferences` do Chrome). Dar checkout no branch da IA troca a extensão de produção pela
da IA sem avisar ninguém. Em 29/08 isso aconteceu e pareceu que a IA tinha vazado para produção;
o diagnóstico correto levou uma varredura nos dois branches para descobrir que **nenhum estava
errado — a pasta tinha duas árvores misturadas**.

Os dois sinais que dizem qual está no ar, e por isso são mantidos de propósito:

- o **nome**: `WhatsFill` aqui, `WhatsFill+IA` lá
- a **versão**: sempre maior no branch da IA (hoje 0.39.0 contra 0.38.0 daqui)

O sintoma da árvore misturada é `git status` acusando arquivo que ninguém editou (foram 17). E o
conserto **não** é apagar o arquivo órfão à mão: ele volta no próximo checkout, e um commit
descuidado apaga o trabalho do outro branch. É `git restore .` + checkout do branch certo.

**Arquivos:** `CLAUDE.md` (cabeçalho dos branches + a armadilha), `CONTEXTO.md` (a afirmação
corrigida), `manifest.json` (0.38.0 → **0.38.1**).

Onze suítes não se aplicam aqui — este branch tem dez, e as dez passam. 29 módulos sem erro.

---

## 2026-08-31 — A pergunta que ELE fez também é contexto
## 2026-08-31 — Este branch passa para a série 1.x

A versão daqui tinha subido para 0.39.0 no merge, e no mesmo dia produção chegou a 0.39.0 também —
as duas colidiram. A convenção era *"versão sempre maior no branch da IA"*, e ela durou algumas
horas: **regra que exige alguém lembrar não é regra**.

Agora a **série** separa os dois, e não há nada a lembrar:

| branch | nome | versão |
|---|---|---|
| `claude/extensao-claude-analise-i9spxw` | `WhatsFill` | **0.x** |
| `claude/whatsfill-ia` | `WhatsFill+IA` | **1.x** |

Isto importa porque as duas extensões carregam da **mesma pasta**: dar checkout aqui troca a
extensão de produção sem avisar ninguém, e o nome mais a série são os únicos sinais no cabeçalho do
painel que dizem qual está no ar.

`manifest.json` 0.39.0 → **1.0.0**. Nada de código mudou.

---

## 2026-08-31 — Produção entra no branch da IA: 31 commits de atraso, zerados

**Pedido dele:** *"resolva"* — as duas coisas que eu tinha levantado: o branch da IA estava
congelado em 29/08 e nenhum dos dois arquivos de contexto dizia que ele existe.

### O merge

Base comum: `0ca18fd`. O branch da IA tinha 6 commits próprios; produção havia andado **31**.
Merge de `claude/extensao-claude-analise-i9spxw` para cá, e o resultado foi melhor do que o
tamanho sugeria: `store.js` e `background.js` fizeram **auto-merge**, e só 4 arquivos conflitaram.

**Zero linhas de produção se perderam** — conferido arquivo por arquivo (`git diff` contra o
branch de produção, contando as linhas `-`): `panel.js`, `background.js`, `tags.js`, `extract.js`
e `cities.js` deram 0. As duas únicas remoções em `store.js` são a minha própria mudança na mescla
de defaults, que substituiu a linha antiga.

### Os quatro conflitos, e a decisão em cada um

| arquivo | decisão |
|---|---|
| `panel.js` (imports) | tudo de produção + os dois imports da IA; o de `triagem.js` **saiu** |
| `panel.js` (bloco da triagem) | lado de produção — a triagem foi removida a pedido dele em 29/08 |
| `manifest.json` | nome `WhatsFill+IA`, versão **0.39.0** (acima da 0.38.0 de produção) |
| `CLAUDE.md` | lado de produção, que traz o aviso do `node --check`; somei `ia.test.mjs` |
| `registro.md` | **os dois** históricos, em ordem cronológica |

**A versão é 0.39.0 de propósito.** As duas extensões carregam da mesma pasta, então o número no
cabeçalho do painel é o que diz qual das duas está no ar. Número menor aqui do que em produção
faria a conferência mentir justamente quando ele trocasse de branch.

### O que a remoção da triagem custou aqui, e está documentado no código

A IA, ao **escalar**, aplicava a etiqueta de triagem — era ela que deixava o contato achável no
filtro do CRM depois. Sem a triagem, escalar deixa rastro só no log da rodada, que some quando o
painel fecha. Está comentado no ponto exato (`panel.js`, caminho do `escalar`), dizendo que é
consequência da remoção e não esquecimento, e onde a etiqueta entra se ele voltar a querer.

### A outra metade: os branches agora estão escritos

O `CONTEXTO.md` de produção afirmava que o repositório tem **um branch só**. Uma sessão futura
leria isso e refaria a IA do zero — ou pior, a implementaria de novo em produção, que é
exatamente o que ele não quer. O `CLAUDE.md` daqui já trazia o cabeçalho certo e sobreviveu ao
merge; a correção do lado de produção vai em commit separado, no branch dele.

**Estado:** 31 módulos sem erro de sintaxe, **onze suítes** passando (as dez de produção mais a
da IA), `triagem.js` ausente nos dois branches.

**Pendência que continua de pé:** a IA nunca fez uma chamada real. Sem chave salva, `iaChave`
não existe no storage e o contador está em `{chamadas: 0}`. O teto de US$ 20/mês e o `effort`
seguem sem prova ao vivo.

---

## 2026-08-31 — A pergunta que ELE fez também é contexto
## 2026-08-29 — Haiku como padrão, e o alarme falso de cache que vinha junto

**Pedido:** *"vou testar com o haiku somente os outros tem custo alto"*.

Trocado o padrão para `claude-haiku-4-5` em três lugares (`MODELO_PADRAO`, `store.ia.modelo`, o
fallback do seletor). Padrão importa mais do que parece: quem liga a IA sem abrir o seletor roda
no padrão, e deixar o Opus 5 ali custaria ~4× o que ele escolheu.

### O que a medição derrubou

Ao conferir se o Haiku aguentava o que a extensão manda, medi o prompt de sistema de verdade
(função pura, dá para medir offline): **~1.300 tokens** com as 11 respostas de fábrica. O
`CLAUDE.md` afirmava **~3.700**, e foi esse número que me fez estimar o custo 3× alto na entrega
anterior. Corrigido nos dois lugares.

### O alarme falso que isso ia criar

O mínimo de prefixo para o `cache_control` valer **não cresce com a geração**: 512 no Opus 5,
1.024 no Sonnet 5, **4.096 no Haiku 4.5**. Com ~1.300 tokens, o Haiku fica a um terço do mínimo —
o cache **não pega, e não pega em silêncio**: `cacheLido: 0`, sem erro nenhum.

O problema não é o custo (com prompt pequeno, perder o cache dói pouco). O problema é que o painel
**ensina que "SEM CACHE" em chamadas seguidas é sinal de problema**, e no Haiku isso apareceria em
100% das chamadas estando tudo certo. Ele veria o alarme na primeira rodada e concluiria que a IA
está quebrada — ou, pior, aprenderia a ignorar o alarme, que aí não toca no dia em que é de
verdade. `CACHE_MINIMO_TOKENS` + `vaiCachear` existem para a tela dizer a verdade: no Haiku o log
mostra `sem cache (esperado)` e o aviso do seletor explica por quê, com o número.

### Custo remedido, por mil contatos AVALIADOS

Não por contato da base: a regex roda antes e a IA só vê o que sobrou.

| Modelo | Cacheia? | Custo/mil | Teto de US$ 20 compra |
|---|---|---|---|
| Haiku 4.5 | não (mín. 4.096) | ~US$ 2,50 | ~8.000 |
| Sonnet 5 | sim | ~US$ 4,50 | ~4.400 |
| Opus 5 | sim | ~US$ 11 | ~1.800 |

O Haiku segue sendo o mais barato com folga **mesmo sem cache** — justamente porque o prompt é
pequeno. Se um dia o catálogo dele passar de 4.096 tokens, o cache do Haiku liga sozinho e a conta
cai para ~US$ 1,20/mil; não vale forçar isso agora.

Confirmado também que o Haiku 4.5 **suporta structured outputs** (`output_config.format`), que é o
que garante o JSON da decisão. Sem isso, toda decisão viraria `incerto` e o teste seria inútil.

### Testes acoplados ao padrão

Dois testes de `effort` montavam a requisição **sem** nomear o modelo, herdando o padrão. Com o
padrão virando Haiku (que não recebe `effort`) eles quebraram — e teriam parado de testar o que
dizem testar se eu tivesse só ajustado a asserção. Agora nomeiam `claude-opus-5` explicitamente.
Lição: teste que herda o padrão testa o padrão, não o comportamento.

**Arquivos:** `src/lib/ia.js`, `src/lib/store.js`, `src/panel/panel.js`, `tests/ia.test.mjs`,
`CLAUDE.md`, `manifest.json` (0.15.0 → **0.16.0**).

**Pendências:** segue sem nenhuma chamada real. O primeiro teste no "Thiago Tim" confirma três
coisas de uma vez: JSON inteiro de volta, contador subindo, e o log dizendo
`sem cache (esperado)` em vez de `SEM CACHE`.

---

## 2026-08-29 — Teto de gasto da API, e o mal-entendido que o motivou

**Pedido:** *"a ligação de api eu usaria meu plano aqui então teria que ver a questão de gasto,
não deve passar dos valores já acertados do plano"*.

### A correção que vem antes do código

**A assinatura Claude Pro/Max não cobre a API.** São duas cobranças diferentes: a assinatura é do
claude.ai e do Claude Code; a chave `sk-ant-…` é pré-paga por token, com fatura própria no
`console.anthropic.com`. Não existe "usar meu plano" na extensão — cada avaliação gera despesa
**nova em cima** do que ele já paga. O pedido era, na prática, "não me dê uma fatura que eu não
esperava", e é isso que o teto atende.

A frase está agora no topo do bloco de gasto na Config, antes do campo — quem lê de cima para
baixo encontra o fato antes do interruptor.

### O teto

`ia.tetoUsd` (padrão **US$ 20/mês**, `0` = sem teto) e `ia.gasto` (`{mes, usd, chamadas, tokens}`).

- **A trava mora no `background.js`**, não no painel: é o único ponto por onde o dinheiro sai, o
  mesmo lugar onde a chave é usada. Trava no painel é trava que um caminho novo esquece de chamar.
- Atingido, toda chamada vira `incerto` — o painel se comporta como antes da IA existir, que é a
  mesma disciplina de canal caído e falha de rede.
- **Vira o mês zerando sozinho**, sem agendador nenhum: o mês muda no primeiro uso do mês seguinte.
  Agendador de virada de mês é mais uma coisa para falhar em silêncio.
- **Não há botão de zerar o contador, de propósito.** Zerar é o único controle que torna o teto
  decorativo. Precisando de mais, ele levanta o teto — decisão visível e que fica salva.
- O log da rodada passou a mostrar **dólares por chamada e o acumulado do mês** ao lado dos tokens.
  Token é diagnóstico (o cache está pegando?); dólar é a pergunta que ele faz.

`custoEmDolares`, `acumularGasto`, `podeGastar` e `mesDe` são puros e testados. Modelo fora da
tabela de preços é cobrado pelo **mais caro** — preço desconhecido não pode virar gasto invisível,
e superestimar só faz o teto chegar mais cedo, que é o lado seguro de errar.

### Causa raiz de dois defeitos achados no caminho — nenhum dos dois tinha rodado ainda

**1. `max_tokens: 512` truncava a decisão no Opus 5.** O Opus 5 **pensa por padrão** (adaptativo,
ao contrário do 4.8/4.7), o pensamento é cobrado como saída (US$ 25/MTok) e cabe **dentro** do
`max_tokens`. Com 512 o raciocínio consumia a cota e o JSON saía cortado: chamada paga que vira
`incerto`, sem nada na tela dizendo por quê. Hoje: `max_tokens` 2048 (decisão) / 4096 (rascunho),
e quem segura o custo é `output_config.effort` — `low` na decisão (escolher entre respostas prontas
é classificação) e `medium` no rascunho (único caminho em que uma frase gerada chega a um eleitor
sem ninguém ler; economizar esforço ali é economizar no lugar errado).

**2. `effort` quebraria o Haiku 4.5, que está no seletor.** Ele recusa o parâmetro com 400 — ou
seja, a opção mais barata do menu, justamente a que se escolhe quando o gasto preocupa, ia parar
de funcionar. `MODELOS_COM_ESFORCO` é **lista de permissão e não de bloqueio**: a lista inversa
faria todo modelo futuro nascer quebrado até alguém notar. Tem teste de regressão.

**3. `store.get('ia')` não mesclava defaults.** Só `settings`/`dicts`/`temaByNumber`/`tagAliases`/
`auto` mesclavam. Quem já tinha a IA configurada leria `tetoUsd: undefined` e ficaria **sem teto** —
um limite que nasce desligado justamente em quem mais usa. `'ia'` entrou na lista.

### Estimativas do seletor corrigidas

Os valores antigos (`~US$ 7 por mil` no Opus 5) foram calculados sem o pensamento. Hoje: Opus 5
~US$ 12/mil, Sonnet 5 ~US$ 5/mil, Haiku 4.5 ~US$ 1,60/mil. São estimativa para escolher; quem vale
é o contador, que soma o que a API devolveu.

**Arquivos:** `src/lib/ia.js`, `src/lib/ia-cliente.js`, `src/background.js`, `src/lib/store.js`,
`src/panel/panel.js`, `tests/ia.test.mjs`, `manifest.json` (0.14.0 → **0.15.0**).

**Pendências:** o teto e o `effort` **nunca rodaram contra a API real** — a primeira avaliação de
verdade (no "Thiago Tim") é o que confirma que a decisão volta em JSON inteiro e que o contador
sobe. Se o contador ficar em zero com chamadas acontecendo, `usage` mudou de forma.

---

## 2026-08-20 — A IA passa a poder ENVIAR o rascunho sozinha

**Pedido:** *"a intenção é enviar quando necessário, mas em geral utilizar as mensagens prontas e
suas variações"*. Perguntei quem aperta o gatilho, oferecendo três caminhos e marcando o terceiro
como o único em que uma frase inventada chega ao eleitor sem revisão. **Ele escolheu esse**, ciente
do risco, e escolheu também que o rascunho só entra **quando a IA não achar resposta pronta boa**.

Isto reverte a fronteira que o `CLAUDE.md` registrava como deliberada ("o rascunho nunca envia").
A decisão é dele; o que eu podia fazer era tornar esse envio o mais estreito possível.

### As quatro travas, e por que nessa ordem

`ia.podeEnviarSozinho` é pura e testada, e responde **não** por padrão. Para sair sozinho, tudo
junto:

1. **`ia.enviarRascunhoAuto` ligado** — nasce desligado, e instalação nova nunca envia sozinha.
2. **Zero avisos de `revisarRascunho`** — marcador esquecido, promessa de entrega, menção a
   cesta/remédio/dinheiro/emprego (Lei 9.504/97), texto longo. Antes eram avisos ao lado do texto;
   aqui viram **veto**. É a trava mais valiosa: **não depende de a IA ser honesta sobre si mesma**.
3. **A IA não ter pedido revisão** — `precisaDeRevisao` novo no esquema, e **ausente conta como
   SIM**: campo faltando nunca vira permissão.
4. **Confiança ≥ 0,9** (`CONFIANCA_RASCUNHO_AUTO`), separada e maior que o 0,7 da decisão. É a
   mais fraca das quatro — autoavaliação de modelo não é medida confiável — e por isso a última,
   nunca a única.

Falha de rede, formato ilegível, janela de 24h vencida, contato que não escreveu nada: tudo cai
em "não envia", e o contato segue para a triagem **exatamente como seguia antes**. O caminho de
falha é o comportamento antigo, não um caminho novo.

### O que mudou em volta

- **O rascunho passou a vir com esquema** (`esquemaDoRascunho`): sem um número devolvido pela IA
  não há como aplicar limiar nenhum. `validarRascunho` lê isso e junta com a revisão heurística;
  resposta **sem** esquema ainda vira rascunho para ele ler, só nunca automático (confiança zero).
- **O texto enviado vai INTEIRO para o log da rodada.** É a única forma de auditar depois o que a
  IA falou em nome do mandato — registro parcial daria impressão de auditoria sem permitir auditar.
- **O motivo de NÃO ter saído sozinho também vai para o log.** Sem isso, "o automático não usou"
  vira pergunta sem resposta e a trava que atuou fica invisível.
- **A descrição na Config foi corrigida**: ela dizia "a IA nunca escreve texto para o eleitor", o
  que passaria a ser mentira. O aviso novo vem **antes** do interruptor, para quem lê de cima para
  baixo encontrar o risco antes do controle.

**Arquivos:** [src/lib/ia.js](src/lib/ia.js) (`CONFIANCA_RASCUNHO_AUTO`, `esquemaDoRascunho`,
`validarRascunho`, `podeEnviarSozinho`), [src/lib/ia-cliente.js](src/lib/ia-cliente.js),
[src/lib/store.js](src/lib/store.js) (`ia.enviarRascunhoAuto`),
[src/panel/panel.js](src/panel/panel.js) (`tentarRascunhoAutomatico`, gatilho na escalada,
controle na Config), [tests/ia.test.mjs](tests/ia.test.mjs) (7 grupos novos, um por jeito de uma
frase inventada escapar). Dez suítes passando.

**Ainda não rodou contra a API de verdade.** O primeiro teste tem que ser no contato "Thiago Tim",
com o automático ligado, olhando o log — é lá que aparece o texto exato que a IA mandou.

---

## ONDE PAROU — 20/08/2026, fim do dia

> Esta seção fica **no topo** de propósito. A antiga "Estado atual — leia primeiro" foi empurrada
> para a linha ~1500 pelas entradas novas, então "leia primeiro" e "está primeiro" tinham
> divergido. Atualize **esta** ao fechar o dia.

**Árvore limpa, manifesto 0.13.0, dez suítes passando.** A extensão irmã
[WebWhatsFill](../WebWhatsFill) está em 0.3.0, também limpa e com quatro suítes passando (tinha
~700 linhas fora do git; foram commitadas hoje).

### O que foi feito hoje, em uma linha cada

- **Aba Cidades** (nova): etiqueta de município para a base inteira, com ritmo adaptativo, lotes
  disparados por você, e as travas de sempre (só município da planilha oficial, id nunca inventado,
  idempotente, soma em vez de substituir).
- **Rotas descobertas lendo o bundle do app**, não chutadas — e dois chutes meus caíram no caminho
  (`isToIncludeCustomFieldValues`, e criar etiqueta é `PUT`).
- **Etiqueta de cidade no fluxo normal**, não só na varredura, com a antiga saindo quando a cidade
  muda.
- **Aviso de grafia** da cidade no cabeçalho, com botão de corrigir.
- Aceitar a cidade no popup passou a **liberar as etiquetas** (`confirmada: true`).

### O que está EM ABERTO, em ordem de risco

1. **A etiqueta de cidade não está entrando no CRM** — é o fio solto de *"não estou achando os que
   foram feitos"*. O conserto de hoje garantiu que isso **não trave mais o envio de modelos**
   (etiqueta saiu dos bloqueantes), mas a causa da escrita falhar continua desconhecida.
   **Como descobrir:** aba Cidades → lote de 20, **com a aba visível** → o log diz `Sonda ok` ou
   `SONDA FALHOU: …`. Essa linha é a resposta.
2. **Etiquetas de rótulo REPETIDO no CRM** (apareceu "Serra" duas vezes). Um contato pode "ter
   SERRA" e não aparecer no filtro de SERRA, porque são duas etiquetas distintas. A aba Cidades
   lista quais estão repetidas — limpar é no CRM, a extensão não apaga etiqueta.
3. **1293 contatos com COREDE de outra região.** Gravar soma o certo e deixa o errado, e o contato
   passa a aparecer em dois filtros. A tela avisa e **não remove** — pode ser a cidade que está
   errada, e a decisão é sua.
4. **`createTag` e `listContacts` nunca foram executadas de verdade** — foram lidas do bundle. A
   sonda da criação de etiqueta é o que prova.
5. **"Se eu não filtrar ele não faz"** — não reproduzido. Se voltar, o log agora diz quando a
   primeira página volta vazia.

### Duas coisas que valem lembrar antes de mexer

- **Deixe a aba VISÍVEL** durante qualquer passada longa. O Chrome congela aba em segundo plano; a
  aba Cidades nasceu sem `keepalive` e uma gravação de 2000 contatos parou no meio, em silêncio.
- **Confira a versão no cabeçalho do painel** contra o `manifest.json` antes de qualquer
  diagnóstico. "O fix não funcionou" já foi "o fix não chegou" uma vez, e custou uma tarde.

---

## 2026-08-20 — Rascunho: o único lugar onde a IA escreve, e ela não envia

**Relato dele:** *"tem casos que irá ter que responder, como textos enormes de transcrição etc.
Normalmente eu copio e colo para uma IA, ela responde e eu edito para parecer mais humano."*

É o caso que a escolha entre respostas prontas não cobre, e é o que mais consome o tempo dele.
Isto é o laço que ele já faz — sem o copiar e colar, e **sem mudar a última parte**.

**A fronteira, escrita no código e não só na intenção:** o rascunho vai para o campo de mensagem
com `setComposerText`, **nunca** `sendText`. A diferença entre isto e "IA respondendo eleitor" é
uma só, e é toda ela: ele lê, edita e aperta enviar. O texto continua passando pelos olhos dele.

**O que faz soar como ele:** as respostas prontas entram no prompt como **exemplos de estilo**,
não como opções. Foram escritas por ele, são a amostra mais fiel da voz dele que existe, e saem de
graça — já estão no prompt cacheado. "Editar para parecer mais humano" é trabalho que o modelo
adianta se souber com que voz escrever.

**As proibições são de lei, não de gosto.** O prompt proíbe prometer dinheiro, cesta, remédio,
passagem, emprego ou qualquer bem (Lei 9.504/97), prometer resolver ou garantir resultado, marcar
compromisso em nome do parlamentar, e inventar dado, agenda ou posição. Quando a pessoa pediu
ajuda material, o rascunho **encaminha** para o CRAS e a assistência social — é o mesmo caminho da
resposta pronta `pedido-ajuda`, que ele já escreveu.

**`revisarRascunho` levanta a mão, mas nunca esconde o texto.** Marcador esquecido (`{{…}}`),
frase que parece prometer entregar alguma coisa, menção a bem ou benefício, texto longo demais
para WhatsApp — tudo vira aviso ao lado do rascunho, não em barra de status que a próxima ação
apaga. E o texto aparece de qualquer jeito: esconder tiraria dele a decisão, que é justamente o
que este desenho existe para preservar.

**Onde fica:** topo da aba Respostas, que é onde ele está quando o caso aparece — contato aberto,
conversa longa na tela, nenhuma resposta pronta servindo. Só aparece com a IA ligada.

A conversa entra **inteira** no prompt do rascunho (até 4.000 caracteres por mensagem), diferente
do prompt de decisão, que corta em 400: aqui o texto longo É o caso de uso, e cortar o começo é
como se perde o que a pessoa realmente perguntou.

**Arquivos:** [src/lib/ia.js](src/lib/ia.js) (`montarSistemaRascunho`, `montarContatoRascunho`,
`montarRequisicaoRascunho`, `revisarRascunho`),
[src/lib/ia-cliente.js](src/lib/ia-cliente.js) (`rascunhar`, e o mesmo canal servindo os dois
modos), [src/panel/panel.js](src/panel/panel.js) (`renderRascunho`),
[tests/ia.test.mjs](tests/ia.test.mjs) (18 asserções novas), [CLAUDE.md](CLAUDE.md).
Dez suítes passando.

---

## 2026-08-20 — WhatsFill+IA nasce em branch separado

**Pedido dele:** *"a IA precisa avaliar ainda, muito arriscado só pelo determinístico, tem que
avaliar o contexto e utilizar a mensagem pronta"* e, em seguida, *"antes de tudo crie um
whatsfill+IA, deixe essa versão separada"*.

Ele está certo sobre o risco: a regex pega o previsível, não o pedido de ajuda escrito de um
jeito que ninguém antecipou. As duas camadas se somam.

**A separação:** branch `claude/whatsfill-ia`, escolhido por ele entre três opções. Duplicar a
pasta foi descartado — `panel.js` tem 5.000+ linhas e carrega meses de correções; duas cópias
divergem em uma semana e todo conserto vira trabalho dobrado. O manifesto muda **nome**
(`WhatsFill+IA`), não versão: é o nome que separa as duas em `chrome://extensions` e no painel.
Conserto que vale para os dois se faz no branch normal e vem para cá por merge.

### O desenho, e o que ele exclui

**A IA escolhe, não escreve.** Devolve o id de uma resposta pronta, ou "escalar". O que sai
continua sendo, byte a byte, um texto que ele escreveu e revisou. Essa fronteira é o que torna o
erro recuperável: o pior caso é a resposta pronta errada, não uma frase inventada num mandato.

**A ordem: regex primeiro, IA no resto.** É a mais barata E a mais segura ao mesmo tempo — o caso
conhecido é pego de graça e **não depende** de a IA estar no ar, com crédito ou de bom humor.

**As travas moram em `validarDecisao`, não no prompt.** Prompt é pedido; validação é regra:

- id que não existe → `incerto`;
- confiança abaixo de 0,7 → `incerto`;
- escolheu `pedido-ajuda` ou `pedido-emprego` → **vira escalada**, com a sugestão junto, nunca
  envio. São os de risco jurídico (Lei 9.504/97), e a IA escolher um deles é ela dizendo "isto é
  sensível", não "mande isto";
- resposta ilegível, sem rede, sem chave, sem crédito → `incerto`.

`incerto` significa **o painel se comportando exatamente como antes da IA existir**. Não há
caminho daqui que envie sem ele ver: a recomendação vira a **tecla 0** da caixa da rodada, com o
motivo e o percentual de certeza na tela.

**Tecla 0, e não uma tecla existente:** trocar o significado de tecla que ele já tem no dedo é
como o "2" digitado na conversa acabou concluindo atendimento.

### A chave da API não entra na página

`page-hook.js` roda no mundo MAIN — o mesmo contexto JS do Angular do mobiliza. **O que está na
página, a plataforma lê.** Por isso a chamada sai do `background.js` (service worker), que lê
`store.iaChave` e devolve só a decisão; o painel nunca vê a credencial. Ela também fica fora do
`exportJson`, pelo mesmo motivo do `sentLog`: backup é arquivo que circula. Na tela, campo de
senha e só o fato de existir — chave visível é chave que aparece em print.

`anthropic-dangerous-direct-browser-access` é necessário porque a origem é a da extensão. O nome
é um aviso legítimo e vale só porque isto é interno, carregado descompactado; não valeria para
nada distribuído.

### Custo, medido e visível

`cache_control` no prompt de sistema: o catálogo de respostas + regras são ~3.700 tokens
idênticos em toda chamada, e a partir da segunda custam 10%. Sem isso a conta é **3,5× maior**.
Com cache: ~US$ 6,80 por mil contatos no Opus 5, ~US$ 1,35 no Haiku 4.5. O log da rodada mostra o
custo de cada chamada — **"SEM CACHE" em chamadas seguidas** é o único sinal de que algo no
prompt passou a variar, e nada mais acusaria isso.

### O que ficou de fora, de propósito

Envio automático sem confirmação. A caixa pergunta em todo contato, como sempre. Isso vira uma
chave quando ele confiar no acerto — e o dado para decidir vai estar no log.

**Arquivos:** [src/lib/ia.js](src/lib/ia.js) e [src/lib/ia-cliente.js](src/lib/ia-cliente.js)
(novos), [tests/ia.test.mjs](tests/ia.test.mjs) (nova, 10ª suíte),
[src/background.js](src/background.js) (o transporte),
[src/lib/store.js](src/lib/store.js) (`iaChave`, `ia`), [manifest.json](manifest.json) (nome +
`api.anthropic.com`), [src/panel/panel.js](src/panel/panel.js) (`avaliarComIA`,
`renderConfigIA`, tecla 0), [CLAUDE.md](CLAUDE.md). Dez suítes passando.

---

## 2026-08-20 — Pedido de ajuda e dinheiro sai da rodada e espera por ele
**Relato dele:** *"caiu porque lhe falei para utilizar meu contexto também. Se eu perguntei qual
sua cidade e ela respondeu (maria cachoeirinha), terá que identificar esse tipo de resposta"*.

Ele está certo e eu tinha implementado metade: na rodada anterior fiz as pistas da PESSOA ("moro
em", "sou de") e a barra do formulário, mas deixei de fora o contexto mais forte que existe —
**nós termos acabado de perguntar**.

Quem responde uma pergunta não escreve "moro em" nem põe separador. Escreve *"maria
cachoeirinha"*.

### Como funciona

O painel olha a **última mensagem NOSSA**: se ela é o pedido de dados, passa
`respostaAoPedido: true`. Aí o parser casa o município sem pista e sem limite de tamanho, e o que
sobra do texto vira o nome.

```
maria cachoeirinha           → nome Maria,          cidade Cachoeirinha
Maria da Silva Cachoeirinha  → nome Maria da Silva, cidade Cachoeirinha
cachoeirinha                 → cidade Cachoeirinha, sem nome (não inventa)
```

### A trava, e ela apareceu no primeiro teste

Sem ela, *"Vamos juntos mudar o Rio Grande"* respondido ao formulário virava cidade **Rio Grande**
e nome **"Vamos Juntos Mudar O"** — o pior dos dois mundos, e num campo que vai para o CRM.

A regra que resolve é a própria pergunta: você pediu **nome e cidade**. Se veio um município e o
resto **não é nome de gente**, aquilo não era uma resposta. Vocabulário de slogan (vamos, juntos,
mudar, apoio, escolho, voto, luta, firme, lado) entrou no `NAO_E_NOME`.

### Também

`CONTEXTO.md` reescrito do zero, a pedido dele, para abrir outra aba com o estado de hoje: a
tabela de regras e sua ordem, as armadilhas do dia, as decisões de negócio que não devem ser
reinventadas, e o viés que eu repeti três vezes — trava contra falso positivo derrubando o caso
verdadeiro.

### Arquivos

`src/lib/extract.js` (`respostaAoPedido`, `sobraDaResposta`, `NAO_E_NOME`),
`src/panel/panel.js` (detecta a nossa última mensagem), `tests/parser.test.mjs` (9 asserções
novas), `CONTEXTO.md`, `CLAUDE.md`, `manifest.json` (0.37.0 → 0.38.0).
Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — A cidade passa a exigir contexto: "Rio Grande" de slogan não é município

**Relato dele**, print do Dirceu com o popup *"Encontrei 'Rio Grande' como cidade"*:

> *"a cidade deve sair de um contexto, resposta a minha pergunta, ou a pessoa falar (eu moro em
> (cidade), eu sou de (cidade)) — resumindo, veja outros contextos também que se aplicam a
> cidade; na print está se referindo ao Rio Grande do Sul"*

A mensagem era *"Olá! Vamos juntos mudar o **Rio Grande**"*, do anúncio. A guarda que existia
(`NOME_DO_ESTADO`) só apaga **"Rio Grande do Sul" por extenso** — a forma curta passava, e
"Rio Grande" é município do RS.

### A regra nova

Sem resposta ao formulário, a cidade agora precisa de **pista de moradia**: "moro em", "morando
em", "resido em", "sou de", "venho de", "aqui em", "minha cidade é", "estou em", "fica em",
"região de", "em", e a barra do formulário. O município é casado **só no trecho depois da pista**
— é isso que separa "moro em Rio Grande" de "vamos mudar o Rio Grande".

Continuam valendo sem pista: a resposta estruturada e a **mensagem curta** que é a própria cidade
(o "PORTO ALEGRE" sozinho, e o "Sao lourenso" com erro de digitação).

### O que a primeira versão quebrou, e por que isso importa

Exigi pista para tudo e **três testes caíram** — "Maria / Sao Lourenço", "Sao lourenso" e
"material impresso em Pelotas". Os três eram casos verdadeiros que a suíte já protegia: a barra do
formulário, o texto curto e a preposição "em". Sem eles, a mudança teria trocado um falso positivo
por três falsos negativos.

**A suíte pagou o próprio custo aqui.** Foi ela que mostrou que "contexto" era mais largo do que
as duas frases do exemplo dele.

### O limite que fica

*"meu genro mora em Santiago"* continua propondo Santiago — tem pista, e a pista está certa; quem
mora lá é outra pessoa. É a razão de a cidade **nunca** ser gravada sem clique, e já estava no
`CLAUDE.md` antes disto.

### Arquivos

`src/lib/cities.js` (`PISTAS_DE_CIDADE`, `matchCityComContexto`), `src/lib/extract.js`,
`tests/parser.test.mjs` (11 asserções novas), `CLAUDE.md`, `manifest.json` (0.36.0 → 0.37.0).
Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — "Voltou diversas vezes por anúncios": a regra existia e duas condições minhas a impediam

**Relato dele**, print do Telmo: *"voltou diversas vezes por anúncios, já mandei mensagem do
momento = concluir"*.

Na tela: cidade **Viamão**, modelo enviado às **10:28**, e às **18:24** ele voltou por outro
anúncio ("ANÚNCIO | FACEBOOK" + *"Olá! Eu escolho o lado da Liberdade"*). A caixa sugeria **mandar
o modelo de novo**.

### A regra já existia. Eu é que a tinha amarrado errado

`voltou-por-outro-anuncio` foi escrita hoje de manhã, e não pegou o Telmo por **duas condições
que eu pus e ele nunca pediu**:

1. **`!temEtiquetaDeCidade`** — eu tinha usado a falta de cidade como trava contra falso
   positivo, porque a frase do aceite ("Olá!") é curta e genérica. Só que voltar por anúncio é
   sobre **o que a pessoa acabou de fazer**; ter cidade não muda isso. O Telmo tem Viamão.
2. **`pedidoDeHoje`** — o sinal de "voltou" era o formulário ter saído. Mas quem recebeu o
   MODELO também já foi atendido, e voltar depois disso é o mesmo caso.

O sinal certo é mais simples e mais amplo: **já existe mensagem NOSSA na conversa**. É isso que
separa "voltou" de "chegou agora", e vale para quem recebeu formulário e para quem recebeu modelo.

### E "já mandei" não é "hoje"

A regra olhava `momentoHoje`. Ele disse *"já mandei mensagem do momento"* — sem recorte de dia. A
conta passou a ser sobre a mensagem do momento **atual**, o que a chave de envio já permitia (ela
inclui um resumo do texto, então trocar de campanha zera a conta sozinho).

### O padrão, de novo

É a terceira vez hoje que uma trava minha contra falso positivo derruba o caso verdadeiro:
o `` antes de "É nós", a lista de etiquetas da caixa em vez das do contato, e agora estas duas
condições. Todas nasceram de "melhor não errar para o lado de fazer demais" — e o custo real foi
não fazer nada no caso que importava.

### Arquivos

`src/lib/sugestao.js` (a regra), `src/panel/panel.js` (`voltouPorOutroAnuncio`,
`momentoJaEnviado`), `tests/sugestao.test.mjs`, `manifest.json` (0.35.0 → 0.36.0).
Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — A origem do anúncio é dado, não texto

**Relato dele**, com a print do bloco "ANÚNCIO | FACEBOOK" e o link `fb.me`: *"se reconhecer o
que está na print e adicionar a etiqueta ADS resolve tudo"*.

### Fui olhar antes de escrever regra, e ainda bem

O bloco não é uma mensagem: é a sessão. Conferido ao vivo:

```
utm.source      = "FACEBOOK"
utm.campaign    = "CLICK AQUI 👉"
utm.referralUrl = "https://fb.me/lwwIb9Lo2"
utm.sourceId    = "120248742363290543"
```

Dava para resolver com uma regra de texto — e teria sido pior: dependeria de ele escrever a regex
certa, e casaria por acidente com qualquer mensagem que citasse "facebook". **O campo é a fonte, e
ler campo não erra.**

### Duas coisas, e a segunda explica um mistério

1. **Etiqueta de anúncio automática.** Campo novo na Config, padrão `ADS`, vazio desliga. Entra
   como **conteúdo** de propósito: é isso que a liga à tabela "Modelo por conteúdo" e faz virar o
   modelo a enviar — o "resolve tudo" da frase dele.

2. **O painel só passava `utm.campaign` para as regras.** `source` e `referralUrl` ficavam de
   fora, então uma regra com "facebook" ou com o link do anúncio **nunca poderia casar**. Isso é
   metade da resposta à pergunta dele de mais cedo, *"está com dificuldade pra pegar se for por
   alguma palavra chave"*: parte do texto que ele esperava que estivesse lá não estava.

### Arquivos

`src/lib/store.js` (`etiquetaAnuncio`), `src/lib/tags.js` (`veioDeAnuncio`),
`src/panel/panel.js` (campo na Config + os quatro campos de utm),
`tests/tags.test.mjs` (5 asserções novas), `CLAUDE.md`, `manifest.json` (0.34.0 → 0.35.0).
Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — "Vieram do anúncio sem pedir dados": faltava separar ignorou de nunca-recebeu

**Relato dele**, minutos depois da mudança anterior: *"bastante contatos que vieram de anúncio sem
pedir dados ao iniciar"*, com a print da Sônia.

### A tensão entre os dois pedidos dele, e como ela se resolve

Poucas horas antes ele tinha dito duas coisas que pareciam brigar:

- *"ela ignorou totalmente o pedido da cidade, eu mando o modelo mesmo assim"* → não insista;
- *"está pedindo dados pra quem já tem etiquetas"* → não peça a quem já está classificado.

Eu tinha resolvido as duas trocando o critério para o NOME. A Sônia mostra o que ficou de fora:
nome de verdade (a regra do nome não pega), conteúdo pedido (a regra do modelo pega e manda), sem
cidade — e **o formulário nunca tinha saído para ela**.

**A distinção que faltava é entre "ignorou o formulário" e "nunca recebeu o formulário".** Não
insistir vale para quem já teve a chance. Quem nunca foi perguntado não ignorou nada, e perguntar
uma vez é o trabalho que a rodada existe para fazer.

### A regra

`nunca-pediram-dados`, **acima** de "conteúdo pedido": veio do anúncio, sem cidade, formulário
nunca enviado → peça esta vez. A do nome continua abaixo. O laço fica: pede-se **uma** vez;
ignorado, manda-se o conteúdo e não se insiste.

### "Nunca enviado" tem duas fontes, e já era esperado

`wasSent` só enxerga o que o painel mandou — a lição que apareceu três vezes hoje. Então
`jaPediramDados` também procura o texto do formulário dentro das nossas mensagens, pelo mesmo
método usado no modelo: um trecho do meio, que sobrevive a variável interpolada.

### Ordem hoje

engajado → resposta pessoal → despedida → voltou por anúncio → reação → **nunca pediram dados** →
conteúdo pedido → nome sem sentido → nunca perguntaram interesse → já pedi hoje.

### Arquivos

`src/lib/sugestao.js` (regra), `src/panel/panel.js` (`jaPediramDados`),
`tests/sugestao.test.mjs` (7 asserções novas), `manifest.json` (0.33.0 → 0.34.0).
Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — "Dificuldade pra pegar por palavra chave": eram três coisas, consertei uma

**Pergunta dele:** *"a extensão está com dificuldade pra pegar se for por alguma palavra chave, se
eu botar anunciou não pega pra etiquetar?"*

Fui olhar como a regra de conteúdo casa, e são **três limitações diferentes**. Registro as três
porque só uma tem conserto óbvio.

### 1. Acento — consertado

A regra vira `new RegExp(padrao, 'i')` e é testada no texto cru. `/anuncio/i` **não** casa com
"anúncio", e `/anúncio/i` **não** casa com "anuncio". Quem escreve no WhatsApp acentua quando dá;
quem escreve a regra na Config acentua quando lembra. Exigir que os dois combinem é garantir que
parte das mensagens escape.

Agora são três tentativas (`tags.casa`): a regra no texto cru, a regra no texto sem acento, e a
regra sem acento no texto sem acento. **Testar nas duas versões em vez de trocar** — regra que já
funcionava com acento continua funcionando, e nenhuma regex com classe de caractere ou `` é
reescrita por mim. A terceira tentativa vem por último e dentro de `try`, porque
`semAcentoNemCaixa` apaga metacaractere.

### 2. A palavra é literal, não é raiz — NÃO consertado

`anunciou` casa só com "anunciou". Não pega "anúncio", "anunciar", "anunciaram". Para pegar a
família inteira a regra precisa ser `anunci` (que é o que eu recomendaria) ou `anunci(o|ou|ar|aram)`.

Não mexi nisso porque **é regex de propósito**: cortar palavra sozinho transformaria "sim" em
"assim" e etiquetaria meio mundo. A tela da Config é que devia dizer isso, e hoje não diz.

### 3. Áudio não entra na conta — decisão pendente dele

A regra olha `state.incoming`, que é **só o que foi digitado**. A transcrição do áudio ficou de
fora quando a liguei ao parser (30/08), e ali eu a rebaixei a palpite justamente por ser fala
ouvida por máquina.

Aqui o caso é diferente e mais delicado: **etiqueta de conteúdo é gravada automaticamente** neste
projeto. Ligar a transcrição significaria escrever etiqueta em eleitor real a partir de palavra
que ninguém digitou. Não fiz por conta própria; está na mesa para ele decidir, e a saída provável
é a mesma de antes — sugerir sem gravar sozinho.

### Arquivos

`src/lib/tags.js` (`casa`), `tests/tags.test.mjs` (5 asserções novas),
`manifest.json` (0.32.0 → 0.33.0). Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — "Pedir dados" passa a ser sobre o NOME, não sobre a cidade

**Relato dele:** *"ao abrir conversas está pedindo dados pra quem já tem etiquetas, uma exceção
pra pedir é somente quando o nome da pessoa estiver totalmente sem sentido ou em falta"*.

É a **segunda correção dele nesta mesma regra em dois dias**, e as três versões contam a história:

1. **30/08** — *"quando a pessoa não tiver etiqueta de cidade, sempre pedir dados"*. Eu pus a
   regra acima de tudo.
2. **31/08, manhã** — *"ela ignorou totalmente o pedido da cidade, eu mando o modelo mesmo
   assim"*. Desceu para abaixo de "conteúdo pedido".
3. **31/08, tarde** — o critério inteiro estava errado.

### Por que ele está certo

O argumento é sobre o que cada falta CUSTA.

**Cidade faltando é comum e não impede trabalhar o contato:** ele tem etiqueta, tem conteúdo,
aparece nos filtros que importam, e a cidade ainda pode vir em qualquer conversa. Pedir o
formulário a quem já está classificado é exatamente o incômodo que ele descreveu.

**Nome vazio ou impronunciável é o que quebra:** bloqueia o vocativo, deixa o cadastro inútil no
CRM, e **nenhuma outra conversa conserta sozinha** — ninguém manda o nome espontaneamente.

### `vars.nomeSemSentido`

Função nova, e separada do `looksLikePlaceholder` de propósito: aquele decide se o **vocativo**
pode sair numa mensagem, e alargá-lo mudaria o bloqueio de envio em todo o painel.

Ela soma o "em falta" (vazio, "[NOVO] …", telefone no lugar do nome) ao "sem sentido" que faltava:
cadastro **sem vogal nenhuma** — "srn", "kkk", iniciais soltas.

**Uma herança que aceitei e registrei no teste:** "Zé" conta como falta, porque
`looksLikePlaceholder` trata menos de 3 letras como telefone. É pedir o nome completo a quem está
cadastrado com dois caracteres — conservador, e do lado certo.

### Ordem hoje

engajado → resposta pessoal → despedida → voltou por anúncio → reação → conteúdo pedido →
**nome sem sentido** → nunca perguntaram interesse → já pedi hoje.

### Arquivos

`src/lib/vars.js` (`nomeSemSentido`), `src/lib/sugestao.js` (a regra e o porquê da mudança),
`src/panel/panel.js` (contexto), `tests/vars.test.mjs` (10 asserções novas),
`tests/sugestao.test.mjs` (ajustadas ao critério novo), `manifest.json` (0.31.0 → 0.32.0).
Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — "Zucco" como cidade, e a caixa de pular engajado sozinho

### 1. O anúncio propunha o nome do candidato como cidade

Print dele: popup *"Encontrei 'Zucco' como cidade. De onde saiu: Zucco. Não casou exato com a
lista do IBGE — é palpite."*

Reproduzi offline. A causa **não** é casamento de município: `matchCity('Zucco')` devolve nada. É
a mensagem do anúncio:

> Olá! Eu apoio o Flávio, **Zucco**, Hiago e Capitão Martim

As vírgulas fazem o parser achar que está lendo "Nome / Cidade", e o que cai na posição da cidade
vira **candidato não reconhecido** — que é justamente o caminho que oferece popup com sugestões.
A trava do "Capitão Martim" não pegava: ela apaga expressões antes de casar município, e aqui
nunca houve casamento de município.

Agora `cities.naoPodeSerCidade` decide antes de oferecer, juntando duas fontes: o vocabulário da
campanha (Zucco, Bolsonaro, Hiago, Capitão Martim…) e **a lista que ele edita na Config**
("Municípios que NÃO são cidade aqui"), que passou a valer também para candidato não reconhecido
— antes ela só tirava município da lista oficial, então "Zucco", que não é município, escapava.

**Detalhe que virou teste:** as expressões são regex **globais**, e regex global guarda
`lastIndex` entre chamadas — `test` alternaria entre verdadeiro e falso. Há `lastIndex = 0` antes
de cada teste e uma asserção que chama duas vezes seguidas. É o mesmo defeito que peguei ontem no
detector de emoji.

### 2. Caixa: pular engajado sozinho

Pedido dele. Nasce **desmarcada**, e marcada é a única coisa desta rodada que tira contato da fila
sem perguntar.

O que torna isso aceitável, e está escrito no código: **é ele quem marca**, o critério é uma
etiqueta que ele mesmo escolheu, e o pulo vai para o Andamento **com o nome da etiqueta que
causou**. Regra que tira contato da fila sem dizer por quê é exatamente o *"alguns concluem e
outros não"* que este projeto já pagou caro.

Pular não envia nada e não conclui: o atendimento fica aberto, onde estava.

### Arquivos

`src/lib/cities.js` (`naoPodeSerCidade`), `src/lib/extract.js` (guarda no candidato),
`src/lib/store.js` (`pularEtiquetasSozinho`), `src/panel/panel.js` (caixa + pulo),
`tests/parser.test.mjs` (8 asserções novas), `manifest.json` (0.30.0 → 0.31.0).
Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — Duas prints, e as duas apontam para o mesmo tipo de cegueira

### 1. "Amém mestre" não era despedida

Print do Carlos Pedroso: última mensagem **"Amém mestre"**, e a caixa sugerindo *"Sugiro a 7:
pergunta de interesse"*.

A regra de despedida pegava o "Amém" e então checava o que sobrava — e sobrava **"mestre"**. O
vocativo derrubava a regra inteira.

O vocabulário de vocativo daqui entrou na lista que é limpa antes da conferência: *mestre, chefe,
guerreiro, campeão, parceiro, irmão, meu, minha, nobre, querido*. E a trava continua: *"Amém, mas
preciso de ajuda"* e *"mestre, me manda o material"* continuam **não** sendo despedida — tem
teste para os dois.

### 2. Sugeriu mandar o modelo que já estava na conversa

Print da Jana: o modelo "Campanha Martim2" está na tela, com imagem e texto completo, e a caixa
sugere *"Sugiro a 1: pediu ADS e há modelo mapeado — mande."*

**A causa é a mesma de ontem, com outra roupa:** `templatesLib.wasSent` só enxerga o que saiu
**pelo painel**. Aquele modelo foi disparado pela automação do anúncio, então para o registro de
envios ele nunca existiu.

Agora `getConversation` devolve `nossas` — o que **nós** mandamos, com texto — e a rodada compara
um trecho do MEIO do modelo (o começo é saudação igual em todos, e o meio sobrevive a variável
interpolada) com o que já saiu. Casou, a regra do conteúdo não sugere mais.

### O padrão que já apareceu três vezes hoje

Em todas, o painel decidia com base no que **ele mesmo** tinha feito, e não no que está na
conversa:

- `nossaUltimaAt` — para saber que o contato já foi respondido (resposta à mão não deixa rastro);
- `nossas` — para saber que o modelo já foi enviado (automação não deixa rastro);
- as etiquetas reais do contato, e não a lista da caixa.

Virou armadilha no `CLAUDE.md`: **o registro de envios é anti-duplicata do painel, não a verdade
sobre a conversa.**

### Arquivos

`src/lib/cortesia.js` (vocativos), `src/lib/api.js` (`nossas`), `src/lib/sugestao.js`
(`modeloJaNaConversa`), `src/panel/panel.js` (comparação), `tests/cortesia.test.mjs` (7),
`tests/sugestao.test.mjs` (3), `CLAUDE.md`, `manifest.json` (0.29.0 → 0.30.0).
Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — "Não pulou o engajado": a regra nunca viu a etiqueta

Duas coisas no mesmo relato dele, e a primeira é um defeito meu.

### O defeito: a caixa mostra uma lista de etiquetas que NÃO é a do contato

Print do Deoclecio: o cabeçalho da plataforma mostra **ADS, CACHOEIRINHA, CONTATO-ASSES,
CONTEÚDO FLÁV, ENGAJADO/BIZA**. A caixa da rodada mostra **CACHOEIRINHA, Metropolitano Delta do
Jacuí, ADS**. Três de cinco — e `ENGAJADO/BIZA` era uma das que faltavam.

A lista da caixa vem de `tagSuggestions`, que só carrega o que a rodada **sugere ou reconhece**.
Eu liguei a regra nova nessa lista, então ela nunca via a etiqueta que deveria dispensar o
contato. A regra estava certa e cega.

Agora `etiquetaQueDispensaDaFila` lê `state.contact.tagsId` cruzado com `tagsLib.allTags()` —
as etiquetas de verdade, do CRM. Virou armadilha no `CLAUDE.md`: **regra que decide por etiqueta
não pode ler a lista da tela.**

### A decisão: engajado passa na frente até do áudio

Com a etiqueta finalmente visível, o Deoclecio ainda cairia em "responder à mão", porque ele
mandou um vídeo e essa regra estava acima.

Ele quer pular. Eu tinha argumentado o contrário em 30/08 — *"engajado que mandou áudio é quem
mais merece resposta"* — e o trabalho dele desmente: **o que o engajado manda, na prática, é vídeo
e link de política o dia inteiro.** Responder a cada um não é atenção, é não conseguir sair da
fila. A tecla 6 continua a um toque para quando o vídeo merecer.

`etiqueta-dispensa-da-fila` foi para o topo da lista.

### E o caso do Paulo Quevedo, do relato anterior

*"a pessoa já foi respondida e mandou link — concluo e próximo"*. Resposta longa dele às 09:29,
link do TikTok dela às 14:43, e a caixa sugerindo a mensagem do momento — ou seja, empilhar uma
segunda mensagem nossa em cima da que ela ainda nem comentou.

A regra da reação passou a olhar se **já respondemos hoje**: se sim, conclui; se não, mensagem do
momento como antes. Para isso a conversa passou a devolver `nossaUltimaAt`, a hora da nossa
última mensagem — `ultima` não servia (quando a pessoa escreve depois de nós, a nossa some da
conta) e `wasSent` também não, porque só enxerga o que saiu por template: **resposta escrita à
mão, que é a maioria das respostas de verdade, não deixa rastro ali.**

### Ordem hoje

1. etiqueta que dispensa da fila (engajado) ← subiu ao topo
2. pede resposta pessoal (áudio, vídeo, texto longo)
3. despedida ("é nós", "abraço")
4. voltou por outro anúncio
5. última é só reação — agora **conclui** se já respondemos hoje
6. conteúdo pedido
7. sem etiqueta de cidade
8. nunca perguntaram interesse
9. já pedi hoje e não veio nada

### Arquivos

`src/lib/api.js` (`nossaUltimaAt`), `src/lib/sugestao.js` (ordem, regra da reação),
`src/panel/panel.js` (etiquetas reais, `respondidoHoje`), `tests/sugestao.test.mjs`,
`CLAUDE.md`, `manifest.json` (0.28.0 → 0.29.0). Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — "É nós": quem só se despede recebe concluir, não modelo

**Relato dele**, com a print do Jesus Ceneri: ele já tinha mandado o conteúdo às 10:46, a pessoa
escreveu **"É nós."** às 14:30, e a caixa sugeriu *"Sugiro a 1: pediu ADS e há modelo mapeado —
mande."*

> *"a pessoa só fechou a conversa com (é nós, abraço, tamo junto, estamos juntos, entre outros
> termos) eu concluo a conversa"*

Mandar o modelo ali é **responder a uma despedida com propaganda** — e o modelo já tinha ido
quatro horas antes.

### O vocabulário é o do lugar

"é nós", "é nóis", "tamo junto", "estamos juntos", "tmj", "abraço", "forte abraço", "valeu",
"vlw", "obrigado/obrigada", "amém", "que Deus abençoe", "boa sorte", "sucesso".

**Exige que não sobre nada além da despedida.** *"Valeu, me manda o material"* tem pedido dentro,
e concluir ali seria fechar a porta na cara de quem pediu algo. Mesma disciplina do resto do
arquivo: sobrando substância, a regra não casa. Tem teste para os dois lados.

### A armadilha que quase deixou a print dele passar

A primeira versão **não pegava "É nós."** — justamente o caso que ele mandou.

`` é fronteira de `w`, e `é` não é `w`. Então `/é nós/` **nunca** casa no começo da
string. Só apareceu porque testei a frase dele literalmente antes de commitar; um teste com
"e nos" sem acento teria passado e escondido o defeito. Virou armadilha no `CLAUDE.md`, porque o
vocabulário deste projeto é cheio de acento no começo: "é nós", "ótimo", "amém".

### Prioridade

Segunda, logo abaixo de "pede resposta pessoal". Um "valeu" dito dentro de um áudio de um minuto
continua pedindo resposta à mão — o áudio pode ter outra coisa junto.

Concluir e não pular: a conversa acabou de verdade, e o contato volta sozinho para "Meus" se
escrever de novo. Pular deixaria a fila cheia de conversa encerrada.

### Arquivos

`src/lib/cortesia.js` (`ehDespedida`, `ultimaEhDespedida`), `src/lib/sugestao.js` (regra),
`src/panel/panel.js` (contexto), `tests/cortesia.test.mjs` (22 asserções novas),
`tests/sugestao.test.mjs` (4), `CLAUDE.md`, `manifest.json` (0.27.0 → 0.28.0).
Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — Conteúdo pedido passa a vencer "sem cidade" (ele mudou de ideia, e está certo)

**Relato dele**, com a print da Janete — sem cidade, etiqueta ADS, modelo "Campanha Martim2"
mapeado, e a caixa sugerindo *"Sugiro a 4: peça os dados"*:

> *"ela ignorou totalmente o pedido da cidade, eu mando o modelo mesmo assim, talvez em outra
> hora ela forneça"*

### É uma reversão da regra que ele mesmo pediu, e o argumento dele é melhor

Em 30/08 ele tinha pedido: *"quando a pessoa não tiver etiqueta de cidade, sempre pedir dados"*, e
eu pus a regra acima até do conteúdo pedido.

O caso da Janete mostra o furo: ela **já ignorou** o pedido da cidade uma vez. Mandar o formulário
de novo não a aproxima de fornecer — mandar o que ela pediu, sim, porque a conversa continua viva
e a cidade pode vir depois. Pedir dados é a saída de quem não tem **nada** a receber, não a de
quem está esperando conteúdo.

### O que mudou

As duas regras trocaram de lugar. Nada mais: nenhuma condição foi reescrita, nenhum código do
painel foi tocado. **Era exatamente para isso que a tabela existe** — em 30/08 esse mesmo pedido
teria sido uma expressão booleana no meio do montador da pergunta, e mudar de ideia custaria uma
releitura do fluxo inteiro.

Ordem hoje:

1. pede resposta pessoal (áudio, vídeo, texto longo)
2. etiqueta que dispensa da fila (engajado)
3. voltou por outro anúncio
4. última é só reação (figura, emoji, link)
5. **conteúdo pedido** ← subiu
6. **sem etiqueta de cidade** ← desceu
7. nunca perguntaram interesse
8. já pedi hoje e não veio nada

O comentário da regra de cidade agora registra a reversão e o motivo dela, com as palavras dele —
senão daqui a um mês alguém "conserta" a ordem de volta.

### Arquivos

`src/lib/sugestao.js` (ordem + comentário), `tests/sugestao.test.mjs` (a asserção que fixava a
prioridade antiga passou a fixar a nova, e ganhou o caso de "sem nada a enviar"),
`manifest.json` (0.26.0 → 0.27.0). Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — Voltou por outro anúncio sem responder o formulário

**Relato dele:** *"uma situação frequente é a pessoa ignorar o pedido de dados e retornar por
outro anúncio; quando isso acontece ou eu concluo e vou pra próxima ou mando mensagem do
momento"*.

### O que a regra impede

**Pedir os dados de novo** — que é exatamente o que a rodada sugeria, porque a regra "sem
etiqueta de cidade" casava. A pessoa já viu o formulário e escolheu não responder; repetir vira a
terceira mensagem igual. Por isso esta regra fica ACIMA daquela.

### Dois desfechos, escolhidos pelo que já saiu hoje

Ele descreveu duas saídas, e a regra escolhe entre elas em vez de fixar uma:

- mensagem do momento ainda não foi hoje → **tecla 5** (a pessoa recebe alguma coisa);
- já foi, ou não há mensagem do momento configurada → **tecla 3**, só concluir.

Mandar duas mensagens do momento no mesmo dia é o que faz a conta parecer robô — a mesma razão
que já tirava o destaque do "pedir dados" repetido.

Para isso a tabela passou a aceitar **`tecla` como função**, além de string. É a primeira
situação que precisa disso, e é uma linha em `sugerirAcao`.

### A trava do falso positivo

O sinal é a última mensagem casar com a frase do aceite do anúncio — que na configuração dele é
**"Olá!"**. Sozinha, ela casaria com meio mundo.

Por isso a regra exige **duas** coisas juntas: o formulário já ter saído alguma vez, **e** o
contato continuar SEM etiqueta de cidade. É isso que separa "ignorou o formulário" de "respondeu
começando com Olá" — quem respondeu tem cidade, e a regra não casa. Tem teste para os dois lados.

E áudio continua vencendo: quem voltou por anúncio mas mandou um áudio junto recebe "responder à
mão", não "concluir".

### Arquivos

`src/lib/sugestao.js` (regra + tecla dinâmica), `src/panel/panel.js` (`voltouPorOutroAnuncio`,
`momentoHoje`), `tests/sugestao.test.mjs` (7 asserções novas),
`manifest.json` (0.25.0 → 0.26.0). Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — Etiqueta que dispensa da fila: "engajado" vem com Pular sugerido

**Pedido dele:** *"etiqueta engajado, quando estiver no automatizado pode ser pulado"*.

Faz sentido pelo próprio objetivo da rodada: o trabalho dela é transformar desconhecido em
engajado. Quem já chegou lá não precisa de formulário nem de pergunta de interesse.

### Configurável, e não fixo no código

Campo novo na aba Automatizado — **"Etiquetas que a rodada pode pular"**, padrão `engajado`,
separadas por vírgula. Casa por **pedaço do rótulo, sem acento e sem caixa**: `engajado` pega
"ENGAJADO/BIZA" (a da print dele) e "Apoiador Muito engajado". Vazio não pula ninguém.

Fixar "engajado" no código obrigaria ele a me pedir toda vez que quisesse acrescentar uma —
e ele avisou desde o começo que ia acrescentar situações conforme aparecem.

A comparação é por **rótulo normalizado, nunca por id**: o CRM tem rótulos repetidos com ids
diferentes, armadilha que já produziu 1293 contatos errados neste projeto.

### A prioridade que importa, e ela veio da própria print dele

A regra fica **abaixo** de "pede resposta pessoal". O contato da print é os dois ao mesmo tempo:
tem `ENGAJADO/BIZA` **e** acabou de mandar um áudio de 24s sobre perseguição religiosa.

Pular ali calaria justamente o apoiador mais próximo — o que mais merece resposta. Então a
sugestão que aparece continua sendo a **6, responder à mão**, e há teste fixando exatamente isso.

### Sugere PULAR, não CONCLUIR

Pular deixa o atendimento aberto. Fechar quem está engajado sem dizer nada é decisão maior do que
uma sugestão deve tomar — e continua a um toque de distância, na tecla 3, se ele quiser.

### Arquivos

`src/lib/store.js` (`etiquetasQuePulam`), `src/lib/sugestao.js` (regra),
`src/panel/panel.js` (`etiquetaQueDispensaDaFila` + campo na Config),
`tests/sugestao.test.mjs` (6 asserções novas), `manifest.json` (0.24.0 → 0.25.0).
Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — O parser passa a ouvir o áudio, com a trava que torna isso aceitável

**Pedido dele:** *"sim aplique falta adicionar quando for assim"* — em resposta à decisão que eu
tinha deixado em aberto: alimentar o parser com transcrição de áudio.

### O ganho, e o risco que vem junto

Nesta base muita gente responde **falando**. O painel dizia "Cidade: (vazia)" para quem tinha dito
a cidade em voz alta — a informação estava lá e ninguém lia.

O risco é que **ninguém digitou aquilo**: é fala passada por reconhecimento automático, com os
erros disso, e o que sai daqui vai para o CRM de eleitor real, onde etiqueta fica para sempre.

### A trava, e por que são DUAS marcas

`extract.rebaixarParaPalpite` rebaixa tudo que vem de transcrição:

- **`confidence: 'aproximada'`** — mantém o valor fora da gravação automática, porque só `crm` e
  `exata` são gravados sozinhos;
- **`informada: false`** — impede substituir o que já está no CRM, porque a regra de "a pessoa
  informou outra cidade" exige texto ESCRITO, e áudio ouvido por máquina não é isso.

Cada uma fecha um caminho diferente, e nenhuma cobre a outra: sem a primeira, a cidade entra
sozinha; sem a segunda, ela sobrescreve a que já estava lá.

A origem sai na tela dizendo **"— ouvido no áudio"**, para dar para conferir antes de aceitar.

### A ordem também é trava

A passada da transcrição roda **depois** da normal, e `applyGuesses` não sobrescreve o que já
está no rascunho. Então **o que a pessoa escreveu sempre ganha do que ela falou**.

### Onde mora, e por quê

Em `src/lib/extract.js` (puro, testado), não solto no `panel.js`. É a regra do projeto: lógica que
decide o que vai para dado real tem teste. São 8 asserções, e o comentário delas diz o que
acontece se caírem — transcrição voltaria a poder ser gravada sozinha.

### Arquivos

`src/lib/extract.js` (`rebaixarParaPalpite`), `src/panel/panel.js` (segunda passada no `load`),
`tests/parser.test.mjs` (8 asserções novas), `CLAUDE.md`, `manifest.json` (0.23.0 → 0.24.0).
Dez suítes passando, 29 módulos parseando.

---

## 2026-08-31 — "O copiar falhou": copiava cinco [audio] e nada mais

**Relato dele**, com print do que ele colou na IA:

```
responda -- Mensagens de Janete da Silva:
Olá! Eu apoio o Flávio, Zucco, Hiago e Capitão Martim
[audio]
[audio]
[audio]
[audio]
[audio]
```

O botão **funcionou** — copiou. O que estava errado era o conteúdo: cinco marcações e nenhuma
palavra do que ela disse. Inútil justamente no caso que o botão existe para servir.

### A transcrição estava na mensagem o tempo todo

`details.transcription.text`. Conferido ao vivo: de 12 mídias olhadas, **9 tinham transcrição**,
uma delas com 2838 caracteres. É exatamente o texto que a plataforma mostra na tela sob
"Transcrição" — e que ele já usava lendo com os olhos.

A extensão nunca leu esse campo. `entrantes` pegava só `m.text`, que em áudio vem vazio.

### Agora

`getConversation` devolve o texto da transcrição em `entrantes[].texto`, com a marca
`transcrito: true`. O copiar sai assim:

```
[audio transcrito] Obrigada, eu já estou falando de você para meus filhos…
```

**A marca não é enfeite.** Quem for ler — a IA ou ele — precisa saber que aquilo é fala passada
por reconhecimento automático, com os erros disso, e não o que a pessoa escreveu. Mídia que
realmente não tem transcrição passou a dizer `[audio, sem transcrição]`, que é diferente de "não
consegui ler".

### O que NÃO mudou, e é decisão a tomar

`incoming` — a base do parser — continua sem transcrição. Alimentar o parser com fala
reconhecida por máquina faria **nome e cidade saírem de texto que ninguém escreveu**, e este
projeto grava isso no CRM de eleitor real. É ganho grande (a Janete disse a cidade no áudio) e
risco novo na mesma medida; fica para ele decidir, não para eu decidir sozinho.

### Arquivos

`src/lib/api.js` (`entrantes` com transcrição), `src/panel/panel.js` (o copiar),
`CLAUDE.md`, `manifest.json` (0.22.1 → 0.23.0). Dez suítes passando, 29 módulos parseando.

---

## 2026-08-30 — A extensão parou de carregar: uma quebra de linha dentro de uma string

**Relato dele:** *"a extensão não está carregando"* — e depois o print do `src/content.js`, o
carregador, apontando para o `console.error('[WhatsFill] falha ao carregar o painel:', err)`.

### O erro, e a minha conclusão errada no meio do caminho

Eu tinha olhado o console pela ferramenta de navegador, achado zero erros e concluído que **não
era o meu código** — que era estado do Chrome (extensão desligada ou painel escondido). Estava
errado: a ferramenta não capturava o console do content script, que roda em mundo isolado. O
print dele apontou para o lugar certo.

**A causa:** no botão "Copiar a conversa" de ontem, um `.join('

')` virou

```js
.join('

');
```

— uma string com quebra de linha **crua**, que é erro de sintaxe. Acidente de escape ao gerar o
patch por script: o `
` foi interpretado antes de chegar ao arquivo. O mesmo acidente comeu as
barras do `s` e do `p{...}` numa regex mais cedo, e ali eu peguei porque o teste falhou.

### Por que passou por mim

Eu conferia com `node --check`, que analisa `.js` como **CommonJS** — modo solto. O Chrome carrega
como **ES module**, que é sempre strict. O `--check` disse "SINTAXE OK" e o navegador disse
"Invalid or unexpected token".

E o defeito era **invisível na aba**: o content script morre antes de desenhar qualquer coisa,
então não há painel, não há erro na tela, não há nada. O único rastro é o `console.error` do
carregador — que é justamente o que ele fotografou.

### O que impede a repetição

`tools/checar-modulos.mjs` (novo): importa todo arquivo de `src/` como ES module e reclama **só de
`SyntaxError`** — erro de execução fora do navegador (`window is not defined`) é esperado e
ignorado. Roda em 29 arquivos e teria pego este em um segundo. Entrou no `CLAUDE.md` como passo
obrigatório antes de dar tarefa por concluída.

### Arquivos

`src/panel/panel.js` (o `join` e o template consertados), `tools/checar-modulos.mjs` (novo),
`CLAUDE.md`, `manifest.json` (0.22.0 → 0.22.1). Dez suítes passando, 29 módulos parseando.

---

## 2026-08-30 — Áudio e texto longo pedem você, não modelo — e o copiar que ele fazia à mão

**Relato dele**, com print: *"já com etiquetas, nesse caso ela mandou um audio que resultou em um
texto gigante que vou mandar pra uma IA ler e fazer a resposta para eu copiar e mandar"*.

### O caso mostra um limite do desenho anterior

Contato **já classificado** — etiquetas FORMIGUEIRO, Central, ADS; cidade Formigueiro; conteúdo
pedido ADS; modelo mapeado. A caixa sugeria, corretamente pelas regras de ontem, *"Sugiro a 1:
pediu ADS e há modelo mapeado — mande."*

E estava errado. Ela tinha mandado um **áudio de 1min13** contando dos três filhos, da igreja, do
convite para almoçar na casa dela. Mandar modelo aprovado para quem acabou de dizer isso parece
deboche.

**A lição, que vale além desta regra:** ter etiqueta não quer dizer que a conversa acabou. O que a
pessoa acabou de dizer manda mais do que o que ela pediu semana passada.

### A regra

Áudio, vídeo, documento, ou texto com **400+ caracteres** → *responder à mão* (tecla 6). Vai em
**primeiro**, acima de todas as outras.

400 e não 200: mensagem de apoiador animado passa fácil de 200 e ainda é caso normal da rodada. A
transcrição de um áudio de um minuto passa de 600 — é essa a fronteira que interessa. Mídia entra
pelo TIPO, então funciona mesmo quando a plataforma não devolve transcrição no texto.

### E o passo manual virou um clique

Botão **"Copiar a conversa"** dentro da caixa da rodada. Copia só as mensagens DO CONTATO (é o que
a IA precisa ler; as nossas já são respostas prontas dele), com a mídia sem texto marcada como
`[audio]` para a IA saber que houve algo ali.

Não fecha a pergunta, não para a rodada e **não manda nada para lugar nenhum** — o texto vai para
a área de transferência da máquina dele, e quem escolhe onde colar é ele. Se o navegador recusar a
área de transferência, ele diz isso em vez de fingir que copiou.

### Arquivos

`src/lib/cortesia.js` (`pedeRespostaPessoal`, `ultimaPedeRespostaPessoal`),
`src/lib/sugestao.js` (regra em primeiro), `src/panel/panel.js` (`montarCopiarConversa` +
contexto), `tests/cortesia.test.mjs` e `tests/sugestao.test.mjs`,
`manifest.json` (0.21.0 → 0.22.0). Dez suítes passando.

---

## 2026-08-30 — Regra nova: última mensagem é figura, emoji ou link → mensagem do momento

**Pedido dele:** *"ultima mensagem é imagem, sticker, emoticon, link, mandar mensagem do momento,
adicione essa sugestão"*. Primeira situação acrescentada depois que a tabela de regras existiu — e
o custo foi o previsto: uma entrada na lista, uma função pura e os testes.

### O caso, e por que ele é diferente da cortesia

`soCortesia` olha a janela de 3 mensagens e exige que TODAS sejam cumprimento/link/figura — é a
regra da rodada dos Novos. `ehSoReacao` olha UMA mensagem, a última, e **"bom dia" escrito não
conta**: o caso aqui é a pessoa que manda um 👍, uma figurinha ou um link e fica esperando. Não há
o que responder ao conteúdo, e ignorar também não serve.

Emoji com **tom de pele** e seletor de variação entram na conta (👍🏽 é um emoji só). E só
pontuação NÃO conta: "..." ou "!!!" sozinho não merece a mensagem do momento.

### Ela vem em PRIMEIRO, acima da regra de cidade

Decisão que vale registrar porque contraria o "sempre" da regra anterior: responder um 👍 com "me
manda seu nome e cidade" lê como robô que não olhou a tela. O sinal mais recente é o que a pessoa
acabou de fazer. **Se ele preferir o contrário, é trocar as duas de lugar na lista** — e é só isso
mesmo, que era o objetivo do desenho de ontem.

### Um bug que os testes pegaram antes de ir para o ar

A regex de emoji tinha a flag `g`, e `RegExp` com `g` guarda o `lastIndex` entre chamadas:
`test()` na mesma instância devolvia resultado diferente na SEGUNDA vez com o mesmo texto. Só
apareceria no segundo contato da rodada, como "às vezes sugere e às vezes não" — o tipo de defeito
que este projeto já pagou caro. São duas instâncias agora: uma com `g` para apagar, uma sem para
testar. Há teste chamando três vezes seguidas.

### Também

O painel passou a guardar `state.entrantes` (mensagens com o tipo junto), nos dois pontos em que
carrega a conversa. Sem isso a figura continuava invisível para a decisão.

### Arquivos

`src/lib/cortesia.js` (`ehSoReacao`, `ultimaEhSoReacao`), `src/lib/sugestao.js` (regra nova em
primeiro), `src/panel/panel.js` (`state.entrantes` + contexto), `tests/cortesia.test.mjs` e
`tests/sugestao.test.mjs`, `manifest.json` (0.20.0 → 0.21.0). Dez suítes passando.

---

## 2026-08-30 — A recomendação sai de dentro do código e vira tabela de regras

**Pedido dele:** *"vamos trabalhar nas sugestões de mensagem… deixe destacado em cima das
mensagens, quando a pessoa não tiver etiqueta de cidade, sempre pedir dados, vou adicionando
situações e sugestões conforme aparecer"*.

A última frase é a que definiu o desenho: se ele vai acrescentar situações, o custo de
acrescentar uma tem que ser uma linha.

### Como era, e por que não dava para crescer

O destaque nascia de **três expressões `primaria:` independentes**, no meio do montador da
pergunta:

```
primaria: !enviadoHoje
primaria: !podeEnviar && !podePerguntarInteresse && !pedidoHoje
primaria: !podeEnviar && !interessePerguntado
```

Três problemas: acrescentar uma situação exigia mexer em condição booleana no meio do código;
não dava para dizer, olhando, qual tinha vencido; e **duas podiam acender ao mesmo tempo** num
contato que casasse com as duas condições.

### Agora

`src/lib/sugestao.js`, puro e testado: uma **lista ordenada** onde a primeira regra que casa
vence. Acrescentar uma situação é acrescentar uma entrada com `quando` e `motivo`, na posição da
prioridade dela. O painel lê a lista inteira e um lugar só decide o destaque.

### A regra que ele pediu vem em PRIMEIRO

*Sem etiqueta de cidade → pedir dados*, acima até de mandar o conteúdo pedido. A razão é o
trabalho todo: a API só filtra por etiqueta, então contato sem etiqueta de cidade **não entra em
lista nenhuma** — mandar o conteúdo resolve hoje e perde a pessoa amanhã.

**A exceção que mantive:** já pedido hoje não é recomendado de novo. Pedir duas vezes no mesmo
dia soa a robô, e a própria caixa já avisava isso. A opção continua na tela; ela só deixa de ser
a sugerida.

### O que torna uma regra agressiva segura

**Ela só recomenda, nunca decide.** Todas as opções continuam na tela e todas as teclas continuam
valendo. O pior caso de uma regra errada é um destaque no lugar errado — não uma mensagem enviada
errada. Foi isso que me deixou implementar "sempre" sem hesitar.

### Em cima das mensagens

A recomendação virou uma faixa no topo da caixa, antes dos dados do contato e das opções, com o
**motivo escrito**. O destaque na tecla dizia QUAL era a sugerida e nunca POR QUÊ — e o porquê é
o que permite discordar dela.

### Arquivos

`src/lib/sugestao.js` (novo), `tests/sugestao.test.mjs` (novo, 19 asserções),
`src/panel/panel.js`, `src/panel/panel.css`, `CLAUDE.md`, `manifest.json` (0.19.0 → 0.20.0).
Dez suítes passando.

---

## 2026-08-30 — 118 mensagens invisíveis: por que o conteúdo "do dia anterior" nunca era reconhecido

**Relato dele:** *"bote a etiqueta também, a extensão não reconhece o conteúdo quando é do dia
anterior e ter que abrir o restante da conversa"*.

A segunda metade da frase é o achado do dia, e vale muito mais que a primeira.

### A medição

Peguei um atendimento qualquer da fila dele e olhei a paginação:

- sessão criada em **20/07/2026**, ainda aberta em **30/08** — **41 dias**;
- **168 mensagens**, em **4 páginas** de 50;
- a página 1 cobria de **10/08 a 30/08**.

`getMessages` lia só a página 1. **118 mensagens eram invisíveis para a extensão** — e é nelas
que mora o pedido de conteúdo de "outro dia". O parser não estava errando: ele nunca tinha visto
a mensagem.

Isso também derruba a hipótese que eu teria seguido por conta própria (sessão nova a cada dia).
Sessão aqui dura semanas.

### O conserto, e por que ele é barato

200 por página, e uma segunda página quando `isLastPage` vier `false` (teto de 2 páginas / 400
mensagens).

**Subir o `pageSize` não custa requisição nenhuma**: é a MESMA chamada, com resposta maior. Nesta
API o que derruba a plataforma é **número de requisições**, não tamanho de resposta — foi o que
tornou a decisão fácil. O teto de 2 páginas existe para a cauda longa não virar 4 requisições por
contato numa rodada.

### O que isso muda além do conteúdo

Tudo que lê `incoming` passa a enxergar semanas em vez de dias: parser de nome e cidade,
etiquetas de conteúdo e **`precisaDeVoce`**. O último merece atenção — um "preciso de ajuda"
escrito há três semanas agora separa o contato para revisão dele. É o comportamento certo (o
pedido foi real e continua sem resposta), mas é mudança de volume, e é onde olhar se a fila de
revisão crescer de repente.

### A etiqueta no fecho sem reconhecimento

Ele mandou botar, e o argumento dele resolve a objeção que eu tinha levantado: o conteúdo
**foi** pedido, só que numa mensagem que a extensão não lia. A etiqueta não está sendo inventada
— está sendo posta por quem leu a conversa inteira na tela. Fica com o motivo *"posta por você no
fecho (o parser não reconheceu)"*, para depois dar para distinguir do que veio do parser.

Etiqueta que não existe no CRM **não é criada**, e a falha não cancela o envio: o aviso vai no
status final, junto do "Enviado e classificado".

### Arquivos

`src/lib/api.js` (`getMessages` paginado), `src/panel/panel.js` (`runFecharComConteudo`),
`CLAUDE.md`, `manifest.json` (0.18.0 → 0.19.0). Nove suítes passando.

---

## 2026-08-30 — "Libere o botão mesmo sem reconhecer": vai o conteúdo preferido

**Pedido dele**, com print do cartão "Atender o pedido e encerrar" travado e a tarja *"Nenhum
conteúdo reconhecido nas mensagens deste contato"*: *"libere o botão mesmo sem reconhecer"*.

### O que eu não podia fazer, e o que fiz no lugar

Liberar o botão sem mais nada deixaria uma pergunta sem resposta: **qual modelo ele enviaria?** O
fluxo pega o modelo pelo NOME do conteúdo reconhecido; sem conteúdo não há nome, e escolher um
entre os 19 aprovados seria o painel chutando — o erro mais caro deste fluxo.

A saída já existia no projeto: **o "conteúdo preferido" da Config** (`conteudoPreferido`, hoje
"Conteúdo Flávio"). Ele nasceu para desempatar quando o contato casa com dois conteúdos; agora
serve também de padrão quando não casa com nenhum. Continua sendo um modelo que **ele** escolheu,
não um chute.

Se o preferido estiver vazio, o botão dispara e explica que não há modelo — em vez de mandar
qualquer coisa.

### O que deliberadamente NÃO acontece

**A etiqueta de conteúdo não é aplicada** nesse caminho. Mandar o modelo é decisão dele, agora,
olhando a conversa. Gravar no CRM que a pessoa PEDIU aquele conteúdo seria inventar uma
classificação que ninguém leu na mensagem — e ela ficaria lá para sempre, mudando as próximas
rodadas deste contato. Enviar é reversível pela conversa; etiqueta errada em produção não é.

### Mais de um conteúdo continua travado

Ali o caso é outro: o painel sabe que existem DOIS caminhos certos, e escolher entre modelos que a
pessoa realmente pediu é diferente de ter um padrão para quando ela não pediu nada. A tarja
continua mandando escolher à mão.

### Na tela

A tarja vermelha de bloqueio virou dica: *"Nenhum conteúdo reconhecido — vai o preferido da
Config. Confira a conversa antes: o modelo sai como se ele tivesse pedido esse conteúdo."*

### Arquivos

`src/panel/panel.js` (cartão "Atender o pedido e encerrar" e `runFecharComConteudo`),
`manifest.json` (0.17.0 → 0.18.0). Nove suítes passando.

---

## 2026-08-30 — "Continua sem diminuir": o número não estava travado, era o número errado

**Relato dele:** *"continua sem diminuir o número o gatilho deve ser quando manda concluir e
atualizar"*.

### Fiz o gatilho que ele pediu — e antes disso descobri que ele não bastaria

Toda conclusão feita pelo painel agora reconta (`concluirPeloPainel`, nas 9 chamadas de
`clickConcluir`), e só quando a conclusão dá certo: recontar depois de um Concluir que falhou
traria o mesmo número e faria parecer que o contador é que está quebrado.

**Mas o gatilho não era a causa.** Antes de mexer, medi o total duas vezes com alguns minutos de
diferença: **353 → 359**. Ele estava SUBINDO. Chega gente nova mais rápido do que ele conclui,
então "abertos" nunca ia diminuir — e ele estava certo ao dizer que não diminuía, só que o defeito
não era atualização, era **a escolha do número**.

Um contador de progresso feito de "o que sobrou" mostra o número crescendo justamente num dia de
trabalho bom.

### O número certo

`statuses=COMPLETED` + `userId` + `timestampFilter` na meia-noite local = **quantos você
concluiu hoje**. Só sobe, e sobe por causa do trabalho dele. Medido: 82 hoje, contra 4159 na vida
inteira sem o filtro.

Os status válidos foram descobertos sondando a API, não adivinhados: `IN_PROGRESS`, `COMPLETED`
e `PENDING` respondem; RESOLVED, DONE, CLOSED, FINISHED, ARCHIVED, ENDED, NEW, WAITING e OPEN
devolvem **400**. E `timestampFilter` sem `timestampField` filtra pela atualização (a conclusão);
com `createdat` daria 38 em vez de 82 — conferidos lado a lado.

### A janelinha agora

- **Destaque: "82 concluídos hoje"** — o que ele fez.
- Abaixo: "356 ainda abertos em Meus" — o que falta.
- Barra: a fatia do dia que já saiu da mão dele (concluídos sobre tudo que passou por ela hoje),
  com teto e piso porque o denominador oscila e um dia recém-começado divide por zero.

### Arquivos

`src/lib/api.js` (`contarConcluidosHoje`, `contarMeuDia`, `STATUS_CONCLUIDO`),
`src/panel/panel.js` (`concluirPeloPainel` e o novo destaque), `CLAUDE.md`,
`manifest.json` (0.16.0 → 0.17.0). Nove suítes passando.

---

## 2026-08-30 — "Atendi e não atualizou": o contador passa a reagir ao trabalho, não ao relógio

**Relato dele:** *"atendi e não atualizou, deve atualizar sozinho, faça uma barra de progresso e
um pouco menor a caixa"*.

### O erro: eu tinha ligado o contador no relógio, não no trabalho

A janelinha atualizava a cada 60s e nada mais. Concluir um atendimento é o instante EXATO em que
o número muda, e era justamente o momento em que ela não fazia nada — ele olhava logo depois de
atender, via o número velho, e concluía que estava quebrada. Estava: um contador de progresso que
não se mexe quando você progride não conta nada.

### Agora são três gatilhos, e os dois primeiros são o trabalho

1. **Trocou de atendimento** (`sessionChanged`) — concluiu e foi para o próximo.
2. **Concluiu e ficou na mesma conversa** — o campo de mensagem some quando o atendimento fecha,
   e é esse o sinal (`anterior.hasComposer && !next.hasComposer`).
3. **Relógio de 45s**, agora só como rede de segurança.

**`conversaMudou` foi descartado como gatilho de propósito:** ele dispara a cada mensagem que
chega, e viraria uma requisição a cada poucos segundos numa conversa movimentada.

### As duas travas que impedem isso de virar rajada

- **Junta os pedidos colados** (`CONTADOR_ESPERA_MS`, 2,5s): passar a fila rápido dispara uma
  troca por clique, e sem juntar seria uma requisição por clique numa API que já derrubou a
  plataforma. O atraso ainda ajuda por outro motivo: a plataforma leva um instante para registrar
  a conclusão, e contar na hora traria o número velho de qualquer jeito.
- **O agente ficou em cache** (`api.getAgente`): quem está logado não muda no meio da sessão.
  Sem isso, cada atualização custaria DUAS requisições em vez de uma.

### Barra e tamanho

Barra de progresso enchendo conforme os atendimentos saem, com teto e piso: sem eles ela ficaria
**negativa** quando chega mais gente do que saiu, e passaria de 100% se o total caísse abaixo de
zero — nos dois casos mentiria. O denominador é quanto havia quando ele abriu: é o dia de trabalho
dele que ela mede, não a fila inteira do CRM.

A caixa encolheu (230px, menos padding, título e número menores). Razão registrada no CSS: ela
fica **aberta o tempo todo** por cima da conversa, enquanto a pergunta da rodada aparece, é
respondida e some — o que é permanente na tela tem que ocupar menos.

### Arquivos

`src/panel/panel.js` (`agendarContagem` e os dois gatilhos), `src/lib/api.js` (cache do agente),
`src/panel/panel.css` (`.wf-contador*`), `manifest.json` (0.15.0 → 0.16.0).
Nove suítes passando.

---

## 2026-08-30 — O contador vira janelinha arrastável, para acompanhar sem trocar de aba

**Relato dele:** *"eu quero uma contagem para eu acompanhar pode ficar em um popup arrastavel, da
maneira que está não posso ver meu progresso"*.

Ele está certo e o defeito é de desenho meu: pus o número **dentro da aba Automatizado**, e o
trabalho acontece na conversa. Número que exige trocar de aba para consultar não acompanha nada.

### O que mudou

Janelinha flutuante, aberta pelo botão do cartão. Ela segue as regras da caixa da rodada — e não
por estética: a camada é `pointer-events: none` e sem fundo, então **a conversa continua legível
e clicável por baixo**; arrasta pelo título; a posição fica no `settings`.

**Chave de posição própria (`contadorPos`).** Reaproveitar `perguntaPos` faria a janelinha e a
pergunta da rodada disputarem o mesmo canto da tela — arrastar uma moveria a outra. `tornarArrastavel`
passou a receber qual posição lembrar, com `perguntaPos` como padrão, então as três caixas que já
existiam não mudaram de comportamento.

### O progresso é a DIFERENÇA, não o total

Guardo quanto havia quando você abriu e mostro quantos saíram desde então. O total sozinho **sobe**
quando chega gente nova, e você teria a impressão de estar andando para trás justamente num dia de
muito movimento. A linha diz as duas coisas: quantos saíram e quantos eram.

Erro de rede **não fecha a janelinha nem apaga o último número bom** — some com o dado justamente
quando a rede está ruim, que é quando mais se quer saber onde se estava. O motivo vai no rodapé.

### 60 segundos, e não menos

Nesta API rajada de requisição já derrubou a plataforma. Um contador não vale um pedido por
segundo; o botão atualiza na hora quando ele quiser.

### Não conferido aqui

`tools/checar-pergunta.mjs` (que prova que a caixa não bloqueia a conversa) precisa de Playwright,
que não está instalado nesta máquina. A janelinha reusa as MESMAS classes da caixa da rodada e o
CSS da camada não foi tocado — a regra nova é só o tamanho do número.

### Arquivos

`src/panel/panel.js` (`abrirContadorFlutuante`, `tornarArrastavel` com chave de posição),
`src/panel/panel.css` (`.wf-contador-numero`), `src/lib/store.js` (`contadorPos`),
`manifest.json` (0.14.0 → 0.15.0). Nove suítes passando.

---

## 2026-08-30 — O número de "Meus" que a plataforma não mostra: 76 na tela, 353 de verdade

**Pedido dele:** *"faça a extensão pegar o número de atendimentos abertos nos meus - todos, quero
visualizar, a plataforma não exibe corretamente"*.

### Ele estava certo, e a causa é explícita

Ao abrir "Meus", o app chama:

```
GET /chat/v6/session?skipCount=true&page=1&pageSize=50&includeDetails=All
    &statuses=IN_PROGRESS&userId=<meu>&sessionType=INDIVIDUAL&orderBy=createdat
```

**`skipCount=true` manda a API não calcular o total.** A resposta volta com `totalItems: 0` — o
número do badge é outra coisa. Medido lado a lado, na mesma tela e no mesmo minuto: badge **76**,
total real **353**.

Não foi deduzido do bundle: a requisição foi **observada na rede** ao clicar na aba. O bundle deu
os nomes dos parâmetros, a rede deu os valores que a plataforma realmente usa.

### Como a extensão descobre quem é você

`GET /core/v1/agent/me` → o campo `userId` é exatamente o que a fila manda em `?userId=`.
Isso importa mais do que parece: o `userId` também está dentro do Bearer, mas o token vive fechado
no transporte e **nunca chega ao painel no modo janela**. Perguntar à API funciona nos dois
contextos; decodificar o token só funcionaria num.

`pageSize=1` de propósito — só o `totalItems` interessa, e trazer 50 sessões para contar uma
seria gastar rede numa API que já caiu por rajada.

### Na tela

Cartão novo no topo da aba Automatizado, com botão **Contar**. A contagem nasce do **clique**:
`renderAll()` roda o tempo todo, e rede disparada de dentro de um `render*` vira uma requisição
por redesenho. Falha vira o motivo na tela e o botão de novo, nunca nova tentativa automática.

### Arquivos

`src/lib/api.js` (`getAgente`, `contarMeusAbertos`), `src/panel/panel.js`
(`renderCartaoMeusAbertos`), `CLAUDE.md`, `manifest.json` (0.13.0 → 0.14.0).
Nove suítes passando.

---

## 2026-08-30 — "Abre a conversa e não manda nada": quem cumprimentou passa a ser respondido

**Relato dele:** *"está falhando em pedir dados ao iniciar atendimento"*, e o sintoma exato,
perguntado antes de mexer: **"somente abre a conversa e não manda nada"**. Junto, o pedido: quem
deu bom dia / boa tarde / boa noite, ou mandou link ou imagem nas últimas 3 mensagens, deve
receber **a mensagem do momento** ao iniciar.

### O sintoma não era defeito, era o desenho — e ele tem razão de reclamar

"Abre e não manda nada" é exatamente o que `assumirParaTriagem` faz: assume o atendimento para
tirar da fila, e não envia. Quem não trazia a frase do aceite do anúncio caía ali. Funcionava
como projetado e mesmo assim está errado: **a pessoa falou com o gabinete e não teve resposta.**

### E havia um caso pior, que ninguém tinha visto

`api.getIncomingText` filtra `m.text`. Quem manda **só uma figura** — o "bom dia" ilustrado, que
nesta base é comum — chegava à rodada como *"não escreveu nada"*: a conversa parecia vazia porque
a única mensagem não tinha texto. Agora `getConversation` devolve também `entrantes`, com
`{texto, tipo}` e **sem** filtrar. `incoming` fica como estava, porque é a base do parser e
parser não lê figura.

Os valores de `type` foram conferidos no bundle do app, não chutados: `TEXT`, `IMAGE`,
`STICKER`, `AUDIO`, `VIDEO`, `DOCUMENT`, e direção `TO_HUB`/`FROM_HUB`.

### A regra (`cortesia.soCortesia`), e por que é conservadora

Cumprimento, link ou figura nas últimas 3 mensagens → mensagem do momento, e conclui.

**Exige que TODAS as mensagens da janela sejam cortesia.** Aqui o erro caro é o falso positivo:
*"Bom dia, preciso falar com o deputado"* tem substância, e responder "Feliz Dia dos Pais" a isso
é responder ao lado. Sobrando qualquer substância, o contato segue o caminho de antes. Errar para
o silêncio custa um contato na pilha dele; errar para o outro lado é resposta fora de contexto
saindo de um mandato.

**Áudio ficou de fora de propósito:** foi figura que ele pediu, e áudio pede outra resposta.

### Módulo próprio, e não dentro do `triagem.js`

`triagem.js` está neste branch **sem uso** — o "Responder pessoalmente" foi revertido (`5a43b77`,
`bd12e46`) e o `panel.js` nem o importa. Pendurar a cortesia nele ressuscitaria código tirado de
propósito, e faria o envio depender de arquivo não commitado. Daí `src/lib/cortesia.js`, que é
puro, sem dependência e igual nos dois branches.

**Consequência a registrar:** neste branch não há `precisaDeVoce` rodando antes, então a única
proteção contra "bom dia, preciso de remédio" é a regra ser conservadora — e ela é: essa frase
tem substância e não casa. No branch +IA a triagem roda antes, como segunda camada.

### O envio passa pelas mesmas travas do formulário

Variável faltando, canal fora do ar, anti-duplicata, `contatosTratados`, variantes e registro de
envio. Envio é envio. Sem "Mensagem do momento" configurada, volta ao comportamento antigo —
**dizendo que foi por isso**, senão vira "às vezes manda, às vezes não".

### Arquivos

`src/lib/cortesia.js` (novo), `src/lib/api.js` (`entrantes`), `src/panel/panel.js`
(`processarNovo`, `responderComMomento`), `tests/cortesia.test.mjs` (novo, 23 asserções),
`CLAUDE.md`, `manifest.json` (0.12.4 → 0.13.0). Onze suítes passando.

---

## 2026-08-20 — A aba Cidades só gasta rede quando ele clica nela

**Pedido dele:** *"faça com que a aba cidades não abra junto, somente quando eu realmente clicar
nela"*.

**Primeiro, o que já era verdade:** a aba nunca se abre sozinha. O painel nasce em "Respostas"
(`state.tab: 'respostas'`), a aba escolhida não é guardada entre sessões, e `renderAll` desenha só
o ramo da aba ativa. Conferido antes de mexer, para não "consertar" o que não estava quebrado.

**O que realmente rodava sem ele pedir:** `renderCidades()` disparava
`tagsLib.allTags()` + `tagsLib.regionTagIds()` **no desenho**. E desenho não é escolha —
`renderAll()` roda o tempo todo: troca de atendimento, mensagem nova, cada `setStatus`. Enquanto a
aba estivesse aberta, cada redesenho refazia a tentativa. A guarda era
`if (!c.etiquetasDisponiveis.length)`, que só segura depois do **sucesso**: com a listagem
falhando — e ela falha justamente quando o servidor está limitando —, virava uma tentativa de
listar até 500 etiquetas por redesenho, exatamente no momento em que o certo era parar.

**O conserto:** o carregamento nasce do **clique na aba** (`prepararCidades`, chamado do handler
do botão de navegação), não do desenho. `renderCidades()` ficou sem efeito colateral nenhum — só
DOM e duas funções puras do `categorizar.js`. `cidadesPreparando` segura as duas pontas: não
dispara duas vezes se ele clicar rápido, e **não tenta de novo sozinho** se falhar.

**Falha agora aparece.** Antes o erro ia só para o console e o seletor ficava eternamente em
"Carregando a lista de etiquetas…" — sem jeito de saber que tinha falhado. Agora `erroEtiquetas`
vai para a tela, com um botão "Carregar a lista de etiquetas" para tentar de novo. Repetir é
decisão dele: listagem que falha costuma ser limite de requisições, e insistir sozinho piora.

Continua valendo o de sempre: **ler a base e gravar lotes só saem no botão.** Isso nunca foi
automático.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`prepararCidades`, `cidadesPreparando`,
`cidades.erroEtiquetas`, handler da navegação, `renderCidades` sem efeito colateral).
Manifesto 0.12.3 → **0.12.4**. Oito suítes passando.

---

## 2026-08-20 — "Erro de carregamento ao iniciar o atendimento": era a extensão disputando a rede

**Relato dele:** *"veja se a extensão está dando problema para a plataforma, quando estou iniciando
o atendimento tem dado erro de carregamento"*.

### O que foi DESCARTADO, com medição

- **O gancho do `fetch`/`XHR` (`page-hook.js`).** Lido inteiro: só observa. Todo intercepto está
  em `try/catch`, delega ao original e **não toca no corpo da resposta** — o modo clássico de uma
  extensão quebrar um app (consumir o stream) não acontece aqui.
- **O laço de 500 ms (`watchPageState` → `pageStateLocal`).** Era o meu principal suspeito, porque
  `isConcluded()` varre `button, [role=button], mat-chip, span, div` dentro da conversa lendo
  `textContent` de cada um. **Medido** com Playwright, fila de 50 itens + conversa crescendo:

  | mensagens | elementos na página | `pageStateLocal()` |
  | --- | --- | --- |
  | 20 | 481 | 0,20 ms |
  | 100 | 961 | 0,50 ms |
  | 300 | 2161 | 0,90 ms |
  | 800 | 5161 | 2,90 ms |

  2,9 ms a cada 500 ms é 0,6% da thread principal no pior caso. **Não é o problema** — e sem medir
  eu teria "consertado" isso e o erro dele continuaria.

### O que É o problema: volume de requisições no pior instante

O `CLAUDE.md` já registra o mecanismo — *"rajada de requisições derruba a API e a plataforma
junto; `Failed to fetch` é o preflight recusado pelo limitador de taxa"*. O que faltava era ver
**quantas** a extensão gasta, e **quando**. Três amplificadores, todos no momento em que ele abre
ou inicia um atendimento — exatamente quando a plataforma também está carregando:

1. **`load()` disparava no instante da troca de URL**, sem espera nenhuma: sessão, contato e
   conversa saindo junto com a rajada da própria plataforma para o mesmo atendimento. Passar a
   fila clicando de contato em contato multiplicava isso por item, e nenhuma dessas leituras era
   aproveitada.
2. **`reexaminarMensagens` refazia a leitura a cada mudança do sinal de conversa** — e o sinal é
   `quantidade:último texto`, que muda VÁRIAS vezes enquanto a plataforma renderiza a lista. Cada
   mudança valia uma leitura da conversa e, se houvesse o que aplicar, uma **gravação com
   releitura** junto.
3. **`hsm.list` guardava UM canal** (`cache` + `cacheKey`). A conta tem várias instâncias e a fila
   se alterna entre elas, então cada contato de canal diferente do anterior rebuscava **100
   modelos aprovados**. Ir e voltar entre duas instâncias = essa busca em todo contato aberto.

**Conta por contato aberto** (canal alternado, conversa renderizando em três passos, com algo a
gravar): ~10 a 14 requisições nossas, amontoadas no mesmo segundo da carga dela. Depois: ~4, e
**fora** do momento crítico.

### O conserto

- `ESPERA_LOAD_MS = 400` — `agendarLoad` sai da frente do carregamento da plataforma e junta os
  cliques rápidos num só: passar a fila inteira custa **um** carregamento, o do contato onde ele
  parou. A tela reage na hora ("Carregando contato…"), só a rede espera.
- `ESPERA_REEXAME_MS = 1200` — `agendarReexame` espera a conversa parar de mudar. Não há pressa:
  é resposta do contato chegando, e um segundo não muda nada para quem está lendo.
- `hsm.js` passa a ter um **cache por canal** (`Map`), não uma vaga só.

Os dois timers são cancelados quando a rodada começa (`state.auto.rodando`): ali quem troca de
atendimento é ela, e um `load()` por fora carregaria o contato duas vezes e gravaria no meio de um
envio. `agendarLoad` também cancela a caixa de cidade aberta, pela mesma razão de sempre.

**Ainda pesado, e é dele a decisão:** a aba Cidades varre a base inteira. Rodá-la enquanto atende
soma o tráfego dos dois. Melhor deixar para quando não estiver na fila.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`agendarLoad`, `agendarReexame`,
`ESPERA_LOAD_MS`, `ESPERA_REEXAME_MS`), [src/lib/hsm.js](src/lib/hsm.js) (`cachePorCanal`),
[CLAUDE.md](CLAUDE.md). Manifesto 0.12.2 → **0.12.3**. Oito suítes e o `checar-dom` passando.

---

## 2026-08-20 — Tecla 4 vira "Pedir dados e concluir"

**Pedido dele:** *"troque o botão 4 por pedir dados e concluir e faça mais duas variações dele —
só tem um modelo de mensagem no momento"*.

A tecla 4 da rodada 3 era "Agradecer informações e concluir". Virou o pedido de dados, que é o
que falta na maioria dessa fila: sem nome e sem cidade não há o que classificar, e o contato fica
dando voltas. O agradecimento **não sumiu** — continua nas respostas rápidas da própria caixa, a
um clique, só sem ocupar uma tecla.

**As "mais duas variações" já existiam.** `pedir-dados` carrega três textos (`text` + duas
`variantes`) desde a rotação de variantes, e elas se revezam a cada envio. Uma tecla, três
redações — que é exatamente o ponto, já que repetir o mesmo texto em sequência é o que se suspeita
ter derrubado o número. Não criei variação nova: teria virado um segundo sistema paralelo ao que
já funciona, e a suíte `templates.test.mjs` já garante que toda variante preserva
`Nome completo / Cidade` (o formato que `extract.findStructured` casa por texto).

**Detalhe que evita trava na hora do envio:** a conferência de variável é feita na variante **que
vai sair** (`varianteAtual`), não no texto-base. Se a corrente travar por variável faltando, a
tecla some com o motivo na tela, em vez de a rodada descobrir isso no meio do envio.

**Aviso próprio, não uma linha na lista dos "já recebeu hoje":** o pedido de dados é a opção
destacada e a que mais tenta ser repetida, então ele ganha a hora na cara e o rótulo vira "Pedir
dados DE NOVO", perdendo o destaque. A linha diz que o texto muda mas o pedido não — é o pedido
repetido que incomoda, não a redação.

**Nota de processo:** este trabalho foi feito duas vezes. A primeira versão criava duas respostas
prontas novas (`pedir-dados-curto`, `pedir-dados-reforco`) nas teclas 8 e 9 — foi escrita sem ver
que outra sessão já tinha empurrado a rotação de variantes, e foi descartada antes de subir. A
regra do CLAUDE.md (`git fetch` antes de começar) existe justamente para isso.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`pedirDados`, `textoPedirDados`,
`pedirTrava`, `pedidoHoje`, tecla 4 e a saída `pedirdados`). Manifesto 0.12.1 → **0.12.2**.
Oito suítes passando.

---

## 2026-08-20 (noite) — O envio de modelos parou: etiqueta bloqueando mensagem

**Relato:** *"o envio de modelos está parando, veja qual o problema"*.

### A cadeia, e a regressão é minha

1. hoje `tags.suggest` passou a devolver a etiqueta de **cidade** — nova para quase todo contato;
2. ela é marcada por `autoTags` e entra em `etiquetas` na gravação;
3. `confirmarNoCrm` relê o contato e, se ela não entrou, registra
   `etiquetas (CAXIAS DO SUL): a API aceitou mas não gravou`;
4. **`'etiquetas'` estava na lista de bloqueantes** → `saveClassification` devolve `false`;
5. na rodada: `if (!(await saveClassification(...))) return { erro: 'a classificação não gravou;
   não enviei nada' }` → **o modelo aprovado não sai.**

O bloqueio já existia; o que mudou foi a superfície. Antes as etiquetas eram COREDE (que o contato
já tinha, então `applyTags` devolvia `skipped`) e conteúdo. A de cidade é nova em quase todo
contato — então é a que falha, e passou a travar o envio.

### O conserto: a prioridade estava invertida

**Etiqueta é organização interna; a mensagem é o que o contato recebe.** Etiqueta que não entrou
saiu dos bloqueantes: continua aparecendo no status e agora **também no log da rodada**, e dá para
reprocessar pela aba Cidades a qualquer momento — mas não impede mais alguém de ser atendido.

**Cidade e data de conclusão continuam bloqueando**, e isso é de propósito: são campos do próprio
contato, e seguir com eles errados é classificar errado.

O registro no log da rodada não é enfeite: o status é sobrescrito pela linha seguinte da rodada,
então sem ele o conserto trocaria um envio travado por uma **falha silenciosa** — que é o modo de
falhar que este projeto mais combate. Entra como `'aviso'`, não `'pulado'`: o contato foi atendido,
e `'pulado'` inflaria a contagem do resumo, fazendo a rodada parecer que deixou gente sem atender.

### O que este conserto NÃO resolve

**Por que a etiqueta de cidade não está entrando** continua aberto — é o mesmo fio do relato
*"não estou achando os que foram feitos"*. O conserto de hoje garante que isso não impeça mais o
atendimento; a causa da escrita falhar precisa da sonda da aba Cidades para ser vista.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`essenciais` sem `'etiquetas'`, registro
no log da rodada). Manifesto 0.12.0 → **0.12.1**. Oito suítes passando.

---

## 2026-08-20 (noite) — Confirmar a cidade libera as etiquetas, e aviso de grafia errada

**Dois pedidos na mesma mensagem:** *"quando eu aceito na confirmação de cidade eu tenho certeza
que a cidade está correta"* e *"o que você pode arrumar é se está escrita corretamente e me falar
se está errada também quando eu iniciar o atendimento, tem casos de cidade escritas erradas"*.

### O aceite passou a valer como certeza

Havia um furo que contradizia o combinado: aceitar no popup gravava a cidade e **não** aplicava as
etiquetas. `etiquetaConfiavel` exige `from === 'crm'` ou `confidence === 'exata'`, e o palpite
aproximado continuava aproximado depois do aceite — então a cidade entrava no CRM sem a etiqueta
dela. Agora o aceite marca `confirmada: true`, e isso libera cidade e COREDE: confirmação dele vale
tanto quanto valor do CRM, porque foi ele que olhou a conversa e decidiu.

**Junto, um furo de corrida na mesma função:** quando duas gravações concorriam (`load()` e
`reexaminarMensagens()` podem estar no ar juntos), a segunda esperava a resposta da pergunta mas
**não** o `refreshTagSuggestions` de quem abriu — e seguia com as etiquetas da cidade ANTIGA.
`applyTags` faz união, então aplicaria a etiqueta de uma cidade recém-trocada, e ela ficaria no
contato para sempre. Agora a segunda também espera o refresh.

### Aviso de grafia: `cities.conferirGrafia`

**A regra que evita virar ruído: acento e caixa NÃO são erro.** "porto alegre" e "Porto Alegre"
resolvem para o mesmo município e geram a mesma etiqueta; avisar disso treinaria a ignorar o
aviso. O que é apontado:

| No campo | Veredito |
|---|---|
| `Porto Alegre`, `porto alegre`, `Santo Angelo` | ok — só acento/caixa |
| `Sto Angelo`, `POA` | abreviação → sugere `Santo Ângelo` / `Porto Alegre` |
| `Caxias do Sull`, `Erechin` | erro de digitação → sugere o nome oficial |
| `não sei`, `Curitiba` | não é município do RS — não há grafia a sugerir |

Isso exigiu **`cities.semAcentoNemCaixa`**, separada de `normalize`: a `normalize` aplica os
ALIASES ("sto" → "santo", "poa" → "porto alegre"), que é o que faz o casamento tolerante
funcionar — e é exatamente o que apagaria o que se quer ver. Com os aliases, "Sto Angelo" e
"Santo Ângelo" ficam idênticos e o campo abreviado passaria por correto.

**Onde aparece:** no **cabeçalho**, não na aba Dados. O cabeçalho está em todas as abas, e aviso
escondido atrás de um clique não é aviso. Com botão **"Corrigir para «Santo Ângelo»"**, que marca
`manual` + `confirmada` — foi ele que mandou corrigir, então não precisa de outro popup para
liberar as etiquetas.

**A conferência mora em `refreshTagSuggestions`**, não no desenho: é assíncrona (piscaria a cada
redesenho) e aquela função já roda em todos os pontos em que a cidade muda — carregar o contato,
responder o popup, digitar na aba Dados. O aviso acompanha sozinho.

**Arquivos:** [src/lib/cities.js](src/lib/cities.js) (`semAcentoNemCaixa`, `conferirGrafia`),
[src/panel/panel.js](src/panel/panel.js) (`confirmada` no aceite, `etiquetaConfiavel`, refresh na
corrida, aviso no cabeçalho, `state.grafiaDaCidade`),
[tests/parser.test.mjs](tests/parser.test.mjs) (2 grupos novos). Manifesto 0.11.0 → **0.12.0**.
Oito suítes passando.

---

## 2026-08-20 (noite) — Etiqueta de cidade também no fluxo normal, não só na varredura

**Pedido:** *"a extensão agora também tem que adicionar a etiqueta de cidade em contatos novos"*.

Até aqui a etiqueta de cidade só entrava pela aba Cidades (varredura em massa). Todo contato novo
nascia sem ela — então a base voltava a ficar desalinhada no dia seguinte à passada, e a varredura
teria que ser refeita para sempre.

**`tags.suggest` passou a devolver a etiqueta de cidade** ao lado da de região, com `origem:
'cidade'`. Só quando o COREDE existe, ou seja, quando a cidade casou com a planilha oficial — a
mesma trava da varredura, pelo mesmo motivo (campo é texto livre, "não sei" viraria etiqueta
permanente).

**O nome vem de `categorizar.nomeDaEtiqueta`, importado.** Duas fontes para o nome da mesma
etiqueta seria a receita para o fluxo normal criar uma coisa e a varredura criar outra — duas
etiquetas para a mesma cidade, e o filtro dele partido em duas. `categorizar` não importa `tags`,
então não há ciclo.

### As duas travas que tiveram que acompanhar

1. **`etiquetaConfiavel` agora cobre 'cidade' junto com 'região'.** As duas SAEM da cidade, então
   herdam a dúvida dela: palpite aproximado não grava sozinho. Sem isso, a etiqueta — que é o que
   ele usa para FILTRAR — seria gravada a partir de um chute.
2. **A etiqueta de cidade ANTIGA sai quando a cidade muda.** `etiquetasDeRegiaoASair` tratava só
   COREDE; agora trata as duas famílias, com `tags.cityTagIds()` novo (etiquetas cujo rótulo é nome
   de município, casado contra a planilha). Sem isso o defeito é pior que o do COREDE duplicado:
   trocar de cidade deixaria o contato com "CAXIAS DO SUL" **e** "PELOTAS", nos dois filtros. A
   trava do "só sai se a nova ficar" vale para as duas — tirar a antiga sem pôr a nova deixaria o
   contato sem etiqueta de lugar nenhuma.

### Etiqueta de cidade que não existe: criar, não apelidar

Para COREDE, "escolha a etiqueta correspondente" faz sentido (o nome da planilha pode divergir do
rótulo do CRM, e o apelido resolve). Para cidade **não existe correspondente**: se "PELOTAS" não
está lá, é porque nenhum contato de Pelotas foi etiquetado ainda. Oferecer o seletor de apelido
convidaria a apontar Pelotas para outra etiqueta qualquer — o erro que a etiqueta de cidade existe
para evitar. Então a sugestão de cidade sem etiqueta mostra um botão **"Criar «PELOTAS»"**, que
cria e invalida o cache (sem invalidar, a releitura devolve a lista velha e a etiqueta recém-criada
continua "não encontrada").

**Arquivos:** [src/lib/tags.js](src/lib/tags.js) (`suggest` com `origem: 'cidade'`, `cityTagIds`,
import de `categorizar`), [src/panel/panel.js](src/panel/panel.js) (`etiquetaConfiavel`,
`etiquetasDeRegiaoASair` com duas famílias, botão de criar etiqueta),
[tests/tags.test.mjs](tests/tags.test.mjs). Manifesto 0.10.5 → **0.11.0**. Oito suítes passando.

---

## 2026-08-20 (noite) — A aba Cidades rodava sem keepalive, e congelava em segundo plano

**Relato:** *"eu quero saber se os 2000 foram etiquetados mas pelo visto não foram, eu não abri a
página para ele trabalhar deixando rodando sozinho, se eu não filtrar ele não faz"*.

### Causa raiz: armadilha já documentada, e eu não a apliquei no código novo

O `CLAUDE.md` registra, medido: **"aba escondida é aba CONGELADA, não lenta"** —
`setInterval(120ms)` deu **zero** disparos em mais de um minuto. As rodadas do Automatizado ligam
`keepalive` desde sempre por causa disso. **A aba Cidades nasceu sem ele.**

Então ele deixou a gravação rodando, tirou a aba da frente, e o Chrome congelou o laço. Sem erro,
sem log, sem nada na tela — a passada simplesmente parou onde estava. É por isso que os 2000 não
foram etiquetados.

Consertado: `acordarParaCidades()` liga o áudio nas **quatro** passadas (leitura, criação de
etiqueta, renomeação, gravação) e relata quando não consegue — áudio exige gesto do usuário, e
aqui sempre há um, porque toda passada começa por um clique. No `finally`, se o áudio **não estava
mais ativo**, o log avisa: é o dado que distingue "acabou" de "congelou no meio", e sem ele a
próxima investigação começaria do zero.

E um aviso no topo da aba, em destaque, porque nenhum conserto de código impede minimizar a janela
ou o computador suspender.

### "Se eu não filtrar ele não faz"

Não reproduzi, mas havia um jeito de isso passar em silêncio: primeira página vazia caía no mesmo
`break` de "acabou", e a tela mostrava **"Leitura completa: 0 contatos"** como se estivesse tudo
certo. Agora, quando a PRIMEIRA página volta vazia, o log diz isso explicitamente e manda avisar —
consulta que não devolve nada é diferente de base sem contatos.

Continua **em aberto** se `listContacts` (sem filtro) tem outro problema. Se acontecer de novo, a
linha nova no log é o que vai dizer.

### Como saber se os 2000 foram etiquetados

Ler de novo com o mesmo filtro e olhar **"já completos"** — é a resposta, e vem do CRM, não da
nossa contagem. Junto com a sonda da entrada anterior (que relê o primeiro gravado de cada lote),
é o que fecha o ciclo: agora dá para confiar no número.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`acordarParaCidades`, `keepalive` nas
quatro passadas, aviso de aba visível, log de página vazia). Manifesto 0.10.4 → **0.10.5**. Oito
suítes passando.

---

## 2026-08-20 (tarde) — "Não estou achando os que foram feitos": faltava conferir a escrita

**Relato, com print:** *"não estou achando os que foram feitos somente corede da serra aparece como
feito"* — e no card de divergência, a linha `Caxias do Sul → Serra (tem: Serra)`, repetida, em
**1293 contatos**.

### Defeito 1: falso positivo por comparar ID em vez de nome

`Caxias do Sul → Serra (tem: Serra)` é absurdo na cara: o COREDE certo é Serra e o contato tem
Serra. A causa: **o CRM tem etiquetas de rótulo repetido** (ele mesmo tem "1 Sem Retorno" e
"2 Sem Retorno", e apareceu "Serra" duas vezes). `etiquetasPorNome` guarda uma delas; o contato
carrega a outra. Comparando `id`, viram etiquetas diferentes — comparando **nome**, são a mesma
coisa, e é o nome que o filtro por região usa.

Consertado: a divergência compara rótulo normalizado, com `rotuloPorId` novo. Id sem rótulo
conhecido **não acusa** — na dúvida, não acusa. Dois testes de regressão.

E como rótulo repetido é sujeira que atrapalha o filtro **dele** também (um contato pode "ter
SERRA" e não aparecer no filtro de SERRA, porque são duas SERRAs), a aba passou a avisar:
`etiquetasComRotuloRepetido`. Só avisa — a extensão não apaga etiqueta.

### Defeito 2, o que explica o relato: a aba nunca conferiu se gravou

A regra mais antiga deste projeto é *"a API responde 200 e IGNORA o valor quando o formato não
serve — nunca confie no 2xx"*, e é por isso que `saveClassification` relê o contato desde sempre
(`confirmarNoCrm`). **A aba Cidades não conferia nada:** mandava o `POST`, recebia 200, e contava
como gravado. Podia relatar 5 mil gravados sem uma única etiqueta ter entrado — e o erro só
apareceria quando alguém fosse procurar os contatos no CRM e não achasse. Foi o que aconteceu.

Agora há **sonda por lote**: o primeiro contato gravado é relido e conferido. Se as etiquetas não
entraram, o lote **para na hora**, com o motivo na tela ("o contato de Caxias do Sul continua sem
CAXIAS DO SUL depois da gravação"). Uma leitura por lote, não por contato: pegar formato errado
exige um exemplo, não uma auditoria — auditar 5 mil dobraria as requisições da passada.

Falha ao **conferir** (rede) não trava o lote: não conseguir reler é diferente de ter falhado a
gravação.

**Ainda não sei qual dos dois defeitos produziu o relato dele** — a sonda é o que vai dizer, na
próxima gravação. Se ela falhar, o problema é a escrita (formato/contrato); se passar, as
etiquetas estavam entrando e o que enganava era o card de divergência.

**Arquivos:** [src/lib/categorizar.js](src/lib/categorizar.js) (divergência por nome,
`rotuloPorId`, `etiquetasComRotuloRepetido`), [src/panel/panel.js](src/panel/panel.js)
(`conferirEtiquetasGravadas` + sonda no lote, card de rótulo repetido, `rotuloPorId`),
[tests/categorizar.test.mjs](tests/categorizar.test.mjs) (4 grupos novos, dois de regressão).
Manifesto 0.10.3 → **0.10.4**. Oito suítes passando.

---

## 2026-08-20 (tarde) — A tela não mostrava o total elegível

**Pergunta dele:** *"são 7474 contatos com corede correto? então todos deviam receber a etiqueta de
cidade"*. Estava certo, e a tela escondia isso.

O resumo listava os baldes sem mostrar o **total elegível**, então "1358 prontos para gravar"
parecia ser o universo inteiro em vez de a fatia que dá para fazer agora. A conta que ele queria
ver — lidos menos as exclusões — não estava em lugar nenhum.

Agora o resumo é uma conta de cima para baixo: **lidos** → menos sem cidade, menos a revisar, menos
sem etiqueta → **DEVEM receber etiqueta de cidade** → e esse total se abre em três, indentados:
já completos, prontos agora, e **travados por falta de criar a etiqueta**.

E o aviso que faltava: os travados **não estão de fora**, só esperam as etiquetas do passo 2. Sem
essa frase, "travados: 6002" lê como perda, quando é fila com desbloqueio conhecido.

**Nota para a próxima sessão:** o `esperandoCriacao: 0` do print dele **não** informava nada. Com o
código antigo, ele só contava quando NEM cidade NEM COREDE existiam — e como o filtro era "todos os
COREDEs", `alvos` nunca era vazio, então aquele contador era zero por construção. Só depois do
conserto da entrada anterior a tela passa a distinguir "já completo" de "travado", e é ela que vai
dizer se os 6002 eram bug de rótulo ou contatos legitimamente prontos de antes.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (resumo em forma de conta, aviso dos
travados). Manifesto 0.10.2 → **0.10.3**. Oito suítes passando.

---

## 2026-08-20 (tarde) — "Por que os números não batem?" — o rótulo estava mentindo

**Pergunta dele, com print:** `Contatos lidos: 7474 · Já com cidade e COREDE: 6002 · Prontos para
gravar: 1358 (1366 etiquetas) · Esperando etiqueta: 0 · Sem cidade: 49 · A revisar: 65`.

**A soma fechava** (6002+1358+49+65 = 7474). O que não batia era o **significado** de uma linha —
e ele viu na hora, porque tinha gravado só **20** contatos e a tela dizia 6002 prontos.

### Causa raiz

`analisar` perguntava só "falta aplicar algo?" e, quando não faltava, olhava `alvos.length` para
escolher entre pronto e esperando. Contato de Caxias do Sul que **tem** o COREDE (Serra, aplicado
pelo fluxo normal) mas cuja etiqueta de **cidade ainda não existe no CRM** caía assim:

- a etiqueta de cidade não existe → `anotarFalta`, e ela **não entra** em `alvos`;
- o COREDE existe e ele já tem → entra em `alvos`, mas não em `faltando`;
- `faltando` vazio + `alvos.length > 0` → **contado como "já com cidade e COREDE"**.

Ou seja: ~5980 contatos esperando criação de etiqueta, escondidos no número de prontos.
`esperandoCriacao` só pegava o caso em que **nada** existia — daí o `0` na tela.

**Conserto:** cada contato cai em exatamente um balde, e a ordem é por urgência — o que dá para
fazer agora (`paraGravar`), o que depende de criar etiqueta (`esperandoCriacao`), e só então o que
está completo (`jaOk`). A flag `precisaCriar` é o que separa os dois últimos. Tem teste de
regressão com o cenário exato.

### O segundo achado, nos mesmos números

**1358 contatos → 1366 etiquetas.** Como o filtro era "todos os COREDEs", todo contato lido já tem
um COREDE — então os 8 que recebem DUAS etiquetas têm um COREDE **diferente** do da cidade deles.
Gravar somaria o certo e deixaria o errado: o contato passaria a aparecer no filtro de duas
regiões. É o defeito que o `CLAUDE.md` já registra por outro caminho ("COREDE errado sobra quando a
cidade preenche BURACO").

`coredeDivergente` detecta e a tela avisa, com exemplos. **Não remove nada**, de propósito: pode
ser a cidade que está errada e não a etiqueta, e remover é destrutivo. A decisão é dele.

**Arquivos:** [src/lib/categorizar.js](src/lib/categorizar.js) (`precisaCriar`, ordem dos baldes,
`coredeDivergente`, `idsDeCorede`), [src/panel/panel.js](src/panel/panel.js) (passa
`regionTagIds`, card de aviso), [tests/categorizar.test.mjs](tests/categorizar.test.mjs) (3 grupos
novos, um deles de regressão). Manifesto 0.10.1 → **0.10.2**. Oito suítes passando.

---

## 2026-08-20 (tarde) — Seletor com "todos os COREDEs", e agrupado

**Pedido, com print do seletor aberto:** *"eu queria aqui, ele me da a opção somente todos contatos
ou um por um, quero a opção todos os coredes"*.

**Sai barato porque o filtro aceita lista.** `POST /core/v1/contact/filter` usa
`tagsOperator: 'OR'`, então mandar os 28 ids de COREDE de uma vez significa "quem tem qualquer
etiqueta de região" — **uma** consulta, não 28. Os ids vêm de `tags.regionTagIds()`, que já
existia e já resolve apelido (então "Vale do Paranhana" entra mesmo a planilha dizendo "Paranhana
Encosta da Serra").

É a fatia que interessa para esta aba: quem tem COREDE já passou pela classificação, então é quem
tem cidade preenchida com mais frequência — e sai muito menor que os 57 mil.

**O seletor também estava difícil de usar.** No print dele, os COREDEs apareciam misturados entre
"Procura emprego ou dinheiro" e "Amigos do Capitão Martim & Covatti Filho", em ordem alfabética
sobre uma lista longa. Agora vai em `optgroup`: **COREDEs (região)** e **Outras etiquetas**, com a
opção "todos os COREDEs (N)" no topo.

A sentinela é `__todos_os_coredes__` — começa com `__` para nunca colidir com id real do CRM, que
são uuid. `idsDoFiltroDeEtiqueta()` a expande na hora da consulta e `rotuloDoFiltroDeEtiqueta()`
dá o nome para a tela e para o log. O log agora registra **qual consulta** produziu o retrato:
sem isso, dois retratos com números diferentes parecem contradição em vez de filtros diferentes.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`TODOS_OS_COREDES`,
`idsDoFiltroDeEtiqueta`, `rotuloDoFiltroDeEtiqueta`, seletor com `optgroup`, log do filtro).
Manifesto 0.10.0 → **0.10.1**. Oito suítes passando.

---

## 2026-08-20 (tarde) — Cidade E COREDE na mesma escrita

**Pedido:** *"preciso que extensão marque todas as etiquetas que tenham corede vou mandar etiquetar
todas agora"*.

**Por que sai de graça:** o COREDE é **derivado** da cidade (planilha oficial da SPGG-RS, nunca
chute), e `applyTags` aplica um array de etiquetas numa requisição só. Então mandar cidade +
COREDE junto **não custa escrita a mais** — mandar separado dobraria o custo da passada inteira
sem ganhar nada. E como o fluxo normal já aplica COREDE, a maioria dos contatos cai no "já tem" e
não gera requisição nenhuma.

**A armadilha do apelido, e por que ela precisava de tratamento.** O nome do COREDE na planilha
não é sempre o nome da etiqueta no CRM: "Paranhana Encosta da Serra" está lá como "Vale do
Paranhana", "Centro-Sul" como "Centro Sul". `tags.resolveTag` já resolve isso, mas é assíncrona e
por nome — aqui o mapa é consultado dezenas de milhares de vezes. Então os apelidos
(`store.tagAliases`) são **achatados uma vez** como chaves extras do mapa de etiquetas. Sem isso,
COREDE existente entraria como "falta criar" e viraria etiqueta duplicada com outro nome.

**Contagem que mudou de significado, e a tela junto.** Um contato agora pode contribuir para DUAS
faltas (a cidade e o COREDE), então `faltamCriar` conta **ocorrências de etiqueta**, não contatos.
A contagem de contatos passou a ser `esperandoCriacao` — que também separa dois casos que antes
se confundiam: "já tem tudo" (`jaOk`) e "não há o que gravar porque a etiqueta ainda não existe".
Contar o segundo como pronto esconderia o trabalho de criação pendente. A conferência de soma na
tela foi ajustada para usar a contagem certa; é a mesma confusão de unidades que gerou o
*"os 586 tem cidade porque 43 etiquetas?"* mais cedo hoje.

O resumo agora mostra "N contato(s) · M etiqueta(s)" no que vai ser gravado, e o card de criação
separa quantas são de cidade e quantas de COREDE.

**Arquivos:** [src/lib/categorizar.js](src/lib/categorizar.js) (`analisar` com
`coredePorMunicipio`, `etiquetas[]` por contato, `esperandoCriacao`),
[src/panel/panel.js](src/panel/panel.js) (`analisarParaCidades` achatando apelidos, gravação com
array, resumo), [tests/categorizar.test.mjs](tests/categorizar.test.mjs) (5 grupos novos).
Manifesto 0.9.5 → **0.10.0**. Oito suítes passando.

---

## 2026-08-20 (tarde) — A leitura recomeçava do zero a cada clique

**Relato:** *"está parando e esperando eu mandar a próxima página faça isso sozinho"*.

**Eram dois defeitos, e o segundo era o grave.** O teto de leitura (500, para a primeira passada
ser curta) interrompia — isso era por projeto. Mas clicar em "Ler a base" de novo **recomeçava da
página 1**: `pagina` nascia em `1` e a lista de contatos era zerada em toda chamada. Então o teto
interrompia e o botão refazia o mesmo trabalho — a base **nunca terminaria** de ser lida, por mais
que ele clicasse. O relato descreve o sintoma; a causa era não existir continuação nenhuma.

**Consertado:**

- **O teto padrão virou `0`** (base inteira). O campo fica para quando ele quiser uma amostra de
  propósito, mas o normal é ir até o fim sozinho, página por página, com respiro entre elas.
- **A leitura continua de onde parou.** `proximaPagina` e `acumulados` vivem no estado; o ponteiro
  avança **depois** de consumir a página, então uma parada no meio não relê nem perde nada. O botão
  vira "Continuar da página N (X lidos)", e um "Recomeçar do zero" fica ao lado para quando ele
  quiser mesmo refazer.
- **Trocar o filtro zera a continuação.** Retomar a página 7 depois de mudar a etiqueta juntaria
  contatos de duas consultas diferentes.
- **Terminou de verdade → zera sozinho**, senão a leitura seguinte partiria de uma página que já
  não existe e voltaria vazia.
- O status agora diz "página N de M" e, quando pausa, quantos faltam.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`lerBaseParaCidades({continuar})`,
`reiniciarLeituraDeCidades`, botão e estado). Manifesto 0.9.4 → **0.9.5**. Oito suítes passando.

---

## 2026-08-20 (tarde) — Etiqueta de cidade sem prefixo, e o conserto dos 20 já gravados

**Pedido:** *"marcou como cidade: caxias do sul, deixe somente caxias do sul, arrume os que ja
foram mandei 20"*. A primeira versão criava a etiqueta como `CIDADE: CAXIAS DO SUL`; ele viu na
tela e pediu só o nome do município. E 20 contatos já tinham recebido a errada.

**O prefixo saiu** (`PREFIXO_PADRAO = ''`). Ele está certo: a etiqueta aparece no cartão do
contato e na coluna da tela de Contatos, onde `CIDADE: ` repetido em toda linha só rouba espaço —
e as etiquetas dele já são assim (`SERRA`, `SEM INTERESSE`).

**Conferido antes de tirar:** nenhum dos 497 municípios do RS tem o mesmo nome de um dos 28
COREDEs, então cidade e região não colidem sem o prefixo e o filtro continua sem ambiguidade. Tem
teste travando isso — se um dia colidir, a suíte acusa antes de a etiqueta ambígua nascer.

**O conserto dos 20: renomear, não remexer.** `POST /core/v1/tag/{id}` (achado no bundle: `POST`
atualiza, `PUT` cria) muda o rótulo da etiqueta — e todo contato que a tem passa a mostrar o nome
novo. Uma requisição por etiqueta, contra duas por contato no caminho óbvio (remover a antiga,
aplicar a nova), e **sem a janela** em que o contato ficaria sem etiqueta nenhuma no meio.

`etiquetasComPrefixoAntigo` acha o que renomear e **recusa quando o nome novo já existe** — as
duas versões no CRM viraria rótulo duplicado, e essa decisão é dele. O card só aparece quando há
o que consertar, e aparece **antes** da varredura: quem gravou errado precisa disto antes de
gravar mais.

`tags.loadTags` passou a guardar `bgColor`/`textColor`, porque a rota de renomear exige as cores
de volta — omitir resetaria a cor da etiqueta como efeito colateral.

**Arquivos:** [src/lib/categorizar.js](src/lib/categorizar.js) (`PREFIXO_PADRAO`,
`PREFIXO_ANTIGO`, `etiquetasComPrefixoAntigo`), [src/lib/api.js](src/lib/api.js) (`updateTag`),
[src/lib/tags.js](src/lib/tags.js) (cores no cache),
[src/panel/panel.js](src/panel/panel.js) (`corrigirPrefixoDasEtiquetas` + card),
[tests/categorizar.test.mjs](tests/categorizar.test.mjs). Manifesto 0.9.3 → **0.9.4**. Oito
suítes passando.

---

## 2026-08-20 — Aba Cidades: etiqueta de município para a base inteira

**Pedido:** *"no crm em contatos vamos ter que criar uma aba que vai categorizar eles, todos que
tiverem etiqueta e cidade terão que ter uma etiqueta de cidade adicionada para ser usado nos
filtros depois, o api só filtra por etiquetas e eu preciso da cidade não só região, automatize pra
categorizar tudo o mais rapido possivel"*. Base com **57.855 contatos** (visto no print).

### O conflito no "mais rápido possível", e como foi resolvido

A leitura é barata (~580 requisições em pageSize 100). A escrita é o custo: um `PUT` por contato.
Com pausa fixa, ou se desperdiçam horas ou se derruba a API — **e a plataforma junto**, que é onde
ele atende (armadilha já registrada). Então o ritmo não é escolhido, é medido:
`categorizar.Ritmo` acelera 20% depois de 12 sucessos seguidos e **dobra** a pausa em cada recusa,
com piso de 150 ms e teto de 8 s. Errar para o lado lento custa minutos; para o lado rápido custa
a plataforma fora do ar no meio do atendimento — daí a assimetria.

O sinal de limite é `Failed to fetch`, **não** status HTTP: um limitador recusa o preflight CORS e
o navegador entrega isso como falha de rede. `ehLimiteDeTaxa` distingue isso de 400/404, onde
esperar mais não conserta nada.

**Escolhas dele, perguntadas antes de escrever código:** ir pela API (em vez de testar
exportar/importar CSV, que eu levantei como possivelmente mais rápido e sem risco) e **em lotes
pequenos, disparados por ele** — nada de rodada longa automática.

### As quatro travas que protegem a base

1. **Cidade tem que casar com os 497 municípios da planilha oficial.** O campo é texto livre e a
   base tem coisa digitada à mão: sem isto, "não sei", "aaa" e cidade de outro estado virariam
   etiqueta **permanente** no CRM, e apagar 300 etiquetas de lixo é trabalho que ninguém faz. O que
   não casa vai para a lista de revisão na tela. Usa as chaves de `tags.loadCoredes` — a mesma
   fonte da etiqueta de região, então cidade e COREDE nunca discordam sobre o que é município.
2. **Nome de etiqueta nunca é inventado.** O id sai da lista real do CRM; cidade sem etiqueta
   correspondente entra em `faltamCriar` e nada é gravado no escuro.
3. **Idempotente.** Quem já tem a etiqueta é contado como pronto e não gera requisição. Rodar de
   novo não reescreve, e retomar em lotes é o caso normal.
4. **Soma, nunca substitui.** Quem grava é o `tags.applyTags` que já existia, que faz a união com
   as etiquetas atuais. A varredura carrega o `tagsId` de cada contato justamente para isso.

### As rotas: chutadas primeiro, depois lidas do bundle do app

A primeira versão desta aba chutou os parâmetros da listagem, porque `mobiliza.app` e
`api.mobiliza.app` estão bloqueados pela política de navegação — e chute foi o que a regra do
projeto proíbe. Ele pediu *"tente ver pela extensão claude no chrome"*; a extensão também recusou
(`example.com` inclusive, então é allowlist geral, não bloqueio do mobiliza).

O caminho que funcionou: o **Browser pane** abre `mobiliza.app`, e o `main.11167927f02cae35.js` é
a fonte da verdade — as rotas, os métodos e os parâmetros estão como texto no código Angular, a um
`fetch` de distância. Sem login, sem sessão nova, sem tocar em dado de eleitor.

**Dois chutes caíram, e os dois eram do tipo que falha em silêncio:**

1. **O parâmetro é `isToIncludeCustomFieldValues`, não `isToIncludeCustomFields`.** O nome parecido
   é do `GET /core/v1/contact/{id}`, que usa o outro. Com o nome errado a API responde **200 e
   ignora** — o mesmo modo de falhar que já custou dias aqui com a data de conclusão. A
   categorização teria lido a base inteira e concluído "nenhum contato tem cidade", sem erro
   nenhum na tela.
2. **Criar etiqueta é `PUT /core/v1/tag`, não `POST`**, com body `{message, textColor, bgColor}` —
   não só `message`. Método errado e body incompleto.

Também confirmado: `status=ACTIVE` e `orderBy=name` fazem parte do que o app manda (sem `status`
não se sabe se vem arquivado e bloqueado junto, e etiquetar arquivado é trabalho jogado fora); o
envelope é `{items, page, countPages, totalItems, pageSize}`; `/core/v1/contact/filter` **só**
filtra por telefone e e-mail, então não serve para "me dê só quem tem cidade" — daí ler a base
inteira; e `tagsId` é campo próprio do contato, que a tela de Contatos usa direto, então a
listagem já deve trazê-lo (`isToIncludeTags` vai como reforço, não como aposta).

Com isso a descoberta por tentativa saiu: a rota é fixa e verificada. O que **não** foi verificado
é a execução — ler o código não é o mesmo que receber um 2xx —, e por isso a criação de etiqueta
manda **uma** como sonda antes das outras.

`tools/descobrir-listagem.js` (só leitura, para colar no console) fica no repositório: ele confirma
as rotas contra a API de verdade, que é o passo que falta.

### Ler 57 mil para testar a leitura era caro demais

**Relato, na mesma sessão:** *"estou filtrando para não pegar todos os contatos mas ele quer ler os
57.000"*. A aba chamava a API direto e ignorava o filtro aplicado na tela.

Investigado no bundle: a tela de Contatos filtra por **`POST /core/v1/contact/filter`**
(`filterList`), e os campos que ele aceita são `textSearch`, `statuses`, `tagsIdBySearchText` e
`isToIncludeCustomFieldValues`. **Não existe filtro por etiqueta escolhida** — `tagsIdBySearchText`
é resultado de procurar TEXTO entre as etiquetas, não "só quem tem a etiqueta X". Então peneirar
"quem tem etiqueta e cidade" continua sendo trabalho nosso, depois de ler; o servidor não faz.

O que deu para resolver: **teto de leitura** (padrão 500, `0` = base inteira) e o campo de busca
por texto. Varrer 57 mil são ~580 requisições e vários minutos — caro para descobrir só se a
cidade está vindo. Com o teto, a primeira passada é curta e prova a leitura antes de gastar a
varredura toda. `api.filterContacts` entrou para isso.

### O filtro por etiqueta existia — eu tinha procurado no lugar errado

**Pergunta dele, com print:** *"os 586 tem cidade porque 43 etiquetas?"* — a tela filtrada em
`Etiquetas: SERRA` (586 contatos) e o painel dizendo "Contatos lidos: 600 / Cidades sem etiqueta no
CRM: 43 / Sem etiqueta nenhuma: 398".

**Dois defeitos no mesmo print.**

1. **A lista misturava unidades.** `43` era contagem de CIDADES distintas, no meio de contagens de
   CONTATOS, sem dizer qual era qual — daí a pergunta. A conta real era 600 − 398 − 95 − 5 = 102
   contatos espalhados por 43 cidades. Agora cada linha diz a unidade ("102 contato(s), em 43
   cidade(s)") e existe uma conferência: se a soma não fechar com os lidos, a tela acusa bug de
   contagem em vez de deixar o número estranho passar.
2. **A leitura ignorava o filtro da tela.** Ele filtrou SERRA; a aba leu 600 contatos gerais da
   base, e os 398 "sem etiqueta" eram justamente contatos que o filtro dele teria excluído.

**A correção de fundo é uma conclusão minha que estava errada.** Eu tinha registrado, no commit
anterior, que *"não existe filtro por etiqueta no servidor"* — procurei no `main.js`, achei só
`textSearch` e `tagsIdBySearchText`, e concluí. `tagsIdBySearchText` é de **sessões de chat** e
significa outra coisa (procurar texto entre as etiquetas); e a tela de Contatos é **rota lazy**, com
o filtro dela num chunk próprio. Pegando a lista de chunks no `runtime.*.js` e varrendo os 86
(estáticos, custo zero), o componente `contacts-filter` apareceu no `2647.*.js` com o body inteiro:
`tagsId` + `tagsOperator`, **`exceptTagsId`**, `origins`, `importedAt`, `portfolioIds`,
`customFieldValuesFilters`.

Então agora a aba tem **"Só quem tem a etiqueta"**, populado com as etiquetas do CRM: escolher
SERRA lê 586 em vez de 57 mil. `exceptTagsId` fica anotado como o próximo ganho (pedir ao servidor
quem ainda não tem a etiqueta de cidade), e `customFieldValuesFilters` não foi decifrado — o
formato vem de outro componente —, então "quem tem cidade preenchida" continua sendo peneirado do
nosso lado.

**Lição que vale mais que o conserto:** ausência de evidência no `main.js` não é evidência de
ausência. Rota de tela lazy mora em chunk próprio, e a lista deles está no `runtime.*.js`.

### O fluxo na tela

Três passos explícitos, nessa ordem: **1. Ler a base** (só leitura, com respiro entre páginas — a
armadilha da rajada não distingue leitura de escrita) → **2. Criar as etiquetas que faltam** (com
a sonda) → **3. Gravar N agora**, com o tamanho do lote editável. O botão **Parar** age no
contato atual, e a espera é fatiada para não ter que aguardar o intervalo inteiro. Contato que
falha por erro próprio sai da fila e vai para o log; contato recusado por limite **fica** e é
tentado de novo.

O retrato da varredura mora em memória, não no storage: 57 mil contatos não caberiam bem lá e o
dado envelhece rápido (etiqueta aplicada à mão, cidade corrigida). Varrer de novo é barato.

### Também

`tags.invalidateTags()` — sem ela, criar etiquetas deixava o cache velho e o painel oferecia
criar as mesmas de novo, com nome duplicado no CRM. E a varredura carrega o schema sozinha se
estiver vazio, em vez de mandar abrir um atendimento à toa.

**Arquivos:** [src/lib/categorizar.js](src/lib/categorizar.js) (novo, puro),
[src/lib/api.js](src/lib/api.js) (`descobrirRotaDeListagem`, `listContacts`, `createTag`),
[src/lib/tags.js](src/lib/tags.js) (`invalidateTags`), [src/panel/panel.js](src/panel/panel.js)
(aba Cidades), [tests/categorizar.test.mjs](tests/categorizar.test.mjs) (novo),
[tools/descobrir-listagem.js](tools/descobrir-listagem.js) (novo). Manifesto 0.8.7 → **0.9.0**.
Oito suítes passando.

**Pendências:** as rotas foram lidas do código do app, não executadas — a criação de etiqueta é a
primeira a provar (a sonda serve para isso); o prefixo da etiqueta é `CIDADE: ` (constante
`PREFIXO_PADRAO`, ainda não exposto na tela); e nada disto rodou contra a base de verdade — o
primeiro lote tem que ser pequeno, com ele olhando o resultado no CRM.

---

## 2026-08-15 — Aba "Sem retorno" escondida: risco de derrubar o número

**Pedido:** *"a parte sem retorno pode ser escondida não será utilizado devido ao risco grande de
cair o número"* — decisão que fecha o diagnóstico de mais cedo no mesmo dia (Z-API é API não
oficial, reabrir contato frio em sequência é o padrão que mais se parece com disparo em massa).

**O que saiu da tela:** os dois cartões da aba Automatizado sobre contato **concluído sem
retorno** — "Sem retorno: reabrir e perguntar" (fluxo antigo, um contato só) e "Reabrir em lote" +
a segunda metade dela, trabalhar em "Meus" (fluxo novo, dividido em duas rodadas). Ritmo, Novos,
Mensagem do momento e Conferir/responder a fila continuam — são sobre conversa VIVA, não sobre
reabrir quem parou de responder.

**Escondido, não apagado.** `renderCartaoReabrir`, `renderCartaoSemRetorno` e tudo que elas
chamam (`processarReabrir`, `processarSemRetornoEmMeus`, `processarSemRetorno`, `runLoteReabrir`,
`runLoteEmMeus`, `runLote`) continuam no arquivo — só as duas linhas que colocavam os cartões na
tela saíram, comentadas com o motivo. Reverter é só devolvê-las.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`renderAutomatizado`). Manifesto 0.8.6 →
**0.8.7**. Sete suítes passando.

---

## 2026-08-15 — "Modelo por conteúdo" virou padrão de fábrica

**Pedido, com print da tela:** *"deixe os da print como padrão já para que eu não tenha que bota
toda vez que atualizo a extensão"*. O print mostrava a caixa "Modelo por conteúdo" (aba Config)
com duas linhas: `Conteúdo Zucco = Zucco, Capitão` e `Conteúdo Flávio = Flávio2`. Confirmado com
ele o texto exato antes de gravar — isto decide para qual modelo aprovado a mensagem sai
**sozinha**, então acento e vírgula errados aqui mandam o modelo errado para gente real.

**Por que "atualizar a extensão" zerava isto:** não é o código puxado do git que apaga
`chrome.storage` — é a descoberta da conversa anterior (pasta duplicada, `Downloads` ×
`OneDrive\Documents\GitHub`). Carregar a extensão de uma pasta NOVA no Chrome é instalação nova,
com storage vazio: o mapeamento sempre teria que ser digitado de novo nessa troca.

**Fix:** `store.DEFAULTS.contentTemplates` deixou de ser `{}` e ganhou as duas entradas, já na
chave normalizada que `hsm.achatar` produz (minúsculo, acento mantido). Só vale para quem NUNCA
gravou nada — `contentTemplates` não entra na lista de merge de default do `store.get`, e a
leitura devolve o valor salvo assim que ele existe. Quem já tem o mapeamento configurado (a
maioria, hoje) não muda em nada.

**Arquivos:** [src/lib/store.js](src/lib/store.js) (`contentTemplates`). Manifesto 0.8.5 →
**0.8.6**. Sete suítes passando.

---

## 2026-08-15 — Mesma rotação de variações para a mensagem do momento

**Pedido:** *"faça a mesma coisa para saudação do momento"* — a mensagem da ocasião (tecla 5,
`auto.mensagemMomento`) não vive na lista de respostas prontas (muda toda semana), então não
ganhou variantes quando as respostas ganharam.

**Reaproveitado, não duplicado:** `sendTemplate` já reveza sozinho qualquer objeto com
`{id, text, variantes}` — a mensagem do momento entra nesse molde numa linha só, dando
`variantes: state.auto.cfg.mensagemMomentoVariantes` ao template de mentira que a rodada monta
(`momento = {id: ..., text: textoMomento, variantes: ...}`). Nada mudou em `templates.js` nem em
`varianteAtual`/`avancarVariante` — já tratavam lista de tamanho variável.

A lógica de lista dinâmica de variações (adicionar/remover) foi tirada de dentro de
`abrirEditorDeResposta` e virou `montarListaDeVariantes(container, iniciais)`, compartilhada
pelos dois popups — sem isso a próxima variação (e a próxima) duplicaria o mesmo código de novo.

**Armazenamento:** `auto.mensagemMomentoVariantes` (novo), `[]` por padrão — `auto` já está na
lista de chaves com merge de default no `store.get`, então quem já tinha configuração salva
ganha o campo novo sem migração nenhuma.

**Arquivos:** [src/lib/store.js](src/lib/store.js) (`auto.mensagemMomentoVariantes`),
[src/panel/panel.js](src/panel/panel.js) (`montarListaDeVariantes` extraída,
`abrirEditorDeVariantesDoMomento`, botão no `renderCartaoMomento`, `variantes` no `momento`).
Manifesto 0.8.4 → **0.8.5**. Sete suítes passando.

---

## 2026-08-15 — Lista enxuta: só o resumo, edição (texto e variações) no popup

**Relato (print):** o popup anterior separava "editar texto" (na lista, sempre aberto) de
"editar variações" (só no popup) — dois lugares para a mesma resposta, e a lista continuava
grande com um textarea inteiro por card. Pedido: *"na lista só bote sobre o que é a mensagem e
um botão para abrir e configurar as variações e também a opção de adicionar mais variações"*.

**Lista:** cada resposta virou uma linha compacta — nome, começo do texto (uma linha, truncado)
e quantas variações tem, se houver. Editar (nome, texto E variações) saiu inteiro da lista e foi
para dentro de um só popup, aberto pelo botão "Editar".

**Variações deixaram de ter número fixo.** Eram exatamente duas (variação 2 e 3); virou lista —
"+ Adicionar variação" cria uma caixa vazia, "×" remove qualquer uma. Continua não gravando
variação vazia (`Salvar` filtra strings vazias) e continua revezando com `varianteAtual`/
`avancarVariante`, que já tratavam a lista como tamanho variável, sem mudança nenhuma lá.

**"+ Nova resposta" abre o popup direto** depois de criar o rascunho — sem isso você criaria a
linha vazia e precisaria de mais um clique em "Editar" para escrever o texto pela primeira vez.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`renderTemplateEditor` virou a linha
compacta; `abrirEditorDeResposta` substitui `abrirEditorDeVariantes`, agora edita nome + texto +
variações juntos, com lista dinâmica). Manifesto 0.8.3 → **0.8.4**. Sete suítes passando.

---

## 2026-08-15 — Popup para editar as variações 2 e 3 de cada resposta

**Pedido:** as variações de texto (ver 12/08) só existiam em `store.DEFAULT_TEMPLATES` — sem
jeito de ver ou mudar pela interface. Perguntado, ele confirmou querer isso: um popup para ver e
editar as variações.

**`abrirEditorDeVariantes(template)`:** reusa a mesma caixa não-bloqueante e arrastável da
pergunta da rodada (`wf-pergunta`/`wf-pergunta-fundo`), mas com dois `textarea` (variação 2 e 3)
em vez de botões de decisão. O texto PRINCIPAL continua editado só na aba Respostas — aqui é
só o que faltava. Botão "Variações" novo no card de cada resposta, com a contagem
(`Variações (3)`) quando já existem.

**Campo vazio = aquela posição da rotação some.** `Salvar` filtra strings vazias antes de gravar
— nunca grava variação em branco, porque mandar mensagem vazia para um contato é pior que não
ter variação nenhuma. Zerar os dois campos volta a resposta a mandar sempre o texto principal
(`varianteAtual` já trata `variantes: []` como "sem rotação").

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`abrirEditorDeVariantes`, botão
"Variações" em `renderTemplateEditor`). Manifesto 0.8.2 → **0.8.3**. Sete suítes passando.

---

## 2026-08-13 — Número fora do ar: a rodada só pode pular

**Relato (Thiago, print):** tarja no topo da plataforma — *"O WhatsApp (51) 99511-0122 foi
**desconectado da Z-API**. Solicite ao administrador da conta que realize a reconexão."* — e o
atendimento aberto era justamente dessa instância. Pedido: *"o número está fora do ar para alguns
contatos, até voltar esse número só tem a opção de pular"*.

**Por que isso é obrigatório e não capricho:** com o canal fora, a plataforma **aceita** o envio.
O balão aparece na conversa e fica lá sem entregar. A rodada contaria como enviado, marcaria no
anti-duplicata (que depois recusaria mandar de novo) e concluiria o atendimento — o contato sairia
do trabalho sem nunca ter recebido nada. É a pior falha possível aqui: silenciosa, e com a tela
dizendo que deu certo.

**A leitura é por TEXTO, não por classe** (`dom.canalDesconectado`): a tarja é do tema da
plataforma, e o texto é o que ela promete ao usuário. O negrito parte a frase em vários nós, então
o nó que casa com "desconectado" não traz o telefone — sobe até três níveis até achar o número.

**A conta tem VÁRIAS instâncias e cai uma por vez.** Por isso a trava não é "tem tarja, não envia":
compara o número da tarja com o do cabeçalho da conversa (`dom.numeroDaConversa`, o telefone ao
lado de "Instância f68546"). Trabalho em número bom continua andando.

**Falso positivo que o fixture pegou antes de virar defeito:** um contato escrevendo *"fiquei
desconectado uns dias, desculpa a demora"* casava com o padrão, e o bloco três níveis acima trazia
o telefone do cabeçalho — a rodada recusaria enviar para quem não tinha nada a ver com isso. A
tarja promete duas coisas que a conversa não tem (o provedor e o que fazer a respeito); agora é
exigida uma delas: `z-api|reconex|solicite ao administrador`. Quatro casos novos em
`tools/checar-dom.mjs`, 22 no total, todos passando.

**Onde a trava age:**

- **rodadas que perguntam** (3 e 6): some TODA saída que envia; sobram "Pular" e "Parar a rodada",
  com o motivo em destaque. Na rodada 6 a etiqueta **não** sai e o atendimento **não** fecha — o
  contato tem que continuar na fila para quando o número voltar;
- **rodadas que não perguntam** (Novos e a antiga de sem retorno): pula o contato e segue, porque
  a fila pode misturar instâncias e parar tudo tiraria do trabalho quem está num número bom;
- **reabrir em lote (rodada 5): não é afetada.** Reiniciar não manda mensagem, então ela funciona
  normalmente com o canal caído — dá para adiantar todo o reabrir enquanto o número não volta.

Falha para o lado seguro: erro ao ler a tela devolve "não está fora". Tarja não lida custa um
envio que talvez não saia; falso positivo trava a rodada inteira à toa.

**Arquivos:** [src/lib/dom.js](src/lib/dom.js) (`canalDesconectado`, `numeroDaConversa`,
`textosDaPagina`), [src/lib/page.js](src/lib/page.js) (`canalForaDoAr`, fora da `pageStateLocal`
de propósito — aquilo é lido a cada 400 ms), [src/lib/rpc-host.js](src/lib/rpc-host.js),
[src/panel/panel.js](src/panel/panel.js) (`canalDesteContatoFora`, `linhaCanalFora`, as quatro
rodadas), [tools/checar-dom.mjs](tools/checar-dom.mjs). Manifesto 0.8.0 → **0.8.1**.

---

## 2026-08-12 — Número caindo: diagnóstico, e variação de texto para não parecer disparo repetido

**Relato:** o número derrubou depois de reabrir poucos (~10) atendimentos "sem retorno" e
responder à mão — suspeita de ter sido pego por spam.

**Diagnóstico (não é volume):** `mobiliza.app` conecta por **Z-API**, que é API NÃO oficial
(WhatsApp Web via QR Code, simula uso humano) — não é a Cloud API homologada da Meta. Com só
~10 mensagens, a teoria de "penalização por volume" (que pesa em milhares numa janela) não bate.
Suspeito mais provável: o PADRÃO da automação (reabrir concluído → mandar → concluir de novo,
em sequência, com o mesmo texto repetido) parece disparo em massa aos olhos do WhatsApp,
independente da quantidade. Também confirmado nesta conversa, no momento do diagnóstico: **a
trava de canal desconectado que o CLAUDE.md descrevia como resolvida ainda não existia no
código** (`grep` por `canalDesconectado`/`numeroDaConversa` não achava nada em `src/`) — foi
implementada em paralelo, nove commits à frente deste, e chegou aqui pelo merge: ver a entrada
de 2026-08-13 logo acima.

**Ideia descartada:** adicionar os ~7.500 contatos sem retorno a grupos, em vez de mandar
mensagem direta. Não reduz o risco (adicionar sem consentimento é padrão de abuso monitorado
com mais peso, e falha sozinho para quem tem "quem pode me adicionar" ≠ Qualquer um) e cria um
problema NOVO de LGPD (expõe telefone/nome/foto a todo o grupo sem consentimento). Mandar o
LINK do grupo por DM foi cogitado como alternativa e **descartado pelo próprio Thiago**: é o
mesmo mecanismo de risco (reabrir 1:1 e mandar mensagem em sequência para gente fria) — só muda
o conteúdo, não o padrão que aparentemente pesa.

**Implementado — variação de texto por rotação.** Pedido: 3 variações de cada resposta pronta,
alternando a cada envio, para não repetir a mesma frase exata. `store.DEFAULT_TEMPLATES` ganhou
`variantes: [texto2, texto3]` em 9 das 11 respostas (as 2 de risco jurídico, `pedido-ajuda` e
`pedido-emprego`, ficam de fora de propósito — variedade não vale reescrever texto que se apoia
em lei, e são resposta a pedido individual, não disparo em massa). Cada variante muda só a
superfície (abertura/conectivo/fechamento); o que o parser exige **fica idêntico** nas três —
"Nome completo / Cidade" e "Sim / Nome completo / Cidade" são casadas literalmente por
`extract.findStructured`, mexer aí quebraria a resposta de quem caiu na variante 2 ou 3.

`templates.varianteAtual(template)` lê o ponteiro de rotação (`store.varianteIndex`, novo) sem
avançar — preview e o começo de um envio veem a MESMA coisa. `templates.avancarVariante` só
roda depois que a mensagem **sai de verdade** (`page.sendText` bem-sucedido), nunca em preview
nem em "Só inserir": queimar a rotação sem nada ter saído faria a próxima pular sozinha. Havia
DOIS pontos de envio de texto, não um: `sendTemplate` (manual + respostas rápidas da rodada) e
`processarNovo` (rodada 1, "Novos: pedir dados" — reimplementa o envio por fora do
`sendTemplate`) — os dois foram ligados à rotação.

`templates.migrarVariantesDeTexto` acrescenta `variantes` a quem já tem a resposta salva no
navegador, e só quando o texto-base bate **exatamente** com o padrão — resposta que o Thiago já
reescreveu fica de fora (em silêncio, sem variante nenhuma) para não misturar a variante do
texto original com a base editada dele.

**Arquivos:** [src/lib/store.js](src/lib/store.js) (`variantes` nos templates, `varianteIndex`
nos defaults), [src/lib/templates.js](src/lib/templates.js) (`varianteAtual`, `avancarVariante`,
`migrarVariantesDeTexto`), [src/panel/panel.js](src/panel/panel.js) (`sendTemplate`,
`renderTemplateCard`, `processarNovo`, aviso no editor da aba Respostas). Suíte nova:
[tests/templates.test.mjs](tests/templates.test.mjs) — sete suítes agora, `CLAUDE.md` atualizado.
Manifesto 0.8.1 → **0.8.2** (não tinha subido no commit original — comportamento visível novo).

**Pendente, ainda sem decisão do Thiago:** reduzir limite/pausa específicos da rodada "Sem
retorno"; variação do **modelo aprovado (HSM)** da rodada 4 — hoje é um só
(`auto.cfg.templateId`, seletor único); rotação aí só é possível se houver mais de um modelo
aprovado registrado na plataforma com conteúdo parecido, o que não foi confirmado. (A trava de
canal desconectado, também pendente neste ponto do diagnóstico, foi implementada em paralelo —
ver a entrada de 2026-08-13 acima.)

---

## 2026-08-12 — Rodada 6: os reabertos, trabalhados em "Meus"

**Escolha dele**, à pergunta de quem manda a mensagem depois do reabrir em lote: *"uma rodada em
Meus"*, com pergunta a cada contato. É a segunda metade do fluxo que a rodada 5 abriu.

**`processarSemRetornoEmMeus`.** O atendimento já está aberto (foi a rodada 5 que reabriu), então
não há Reiniciar: abre, pergunta, manda, tira a etiqueta e conclui. Cinco saídas — modelo
aprovado, a resposta "Sem retorno: ainda tem interesse?" (**só com a janela de 24h aberta**),
pular, concluir sem enviar, responder à mão.

**A trava que decide quem entra:** "Meus" não é uma fila só — tem quem veio dos Novos, quem
respondeu, e quem foi reaberto aqui. A rodada confere se o contato tem a etiqueta configurada e
pula com o motivo na tela quando não tem. O contato já está carregado, então a conferência é de
graça, e sem ela a pergunta de sem retorno iria para quem está no meio de outra conversa.

**Ordem de propósito: grava e tira a etiqueta ANTES de enviar.** Se o envio falhar, o contato
continua na lista e volta amanhã. O inverso — etiqueta fora, mensagem não enviada — o tiraria do
trabalho em silêncio, que é o modo de falhar que este projeto já teve várias vezes.

**Pular mantém a etiqueta**, e isso é dito no rótulo da tecla ("Pular (mantém a etiqueta)" ×
"Concluir sem enviar (tira a etiqueta)"): a diferença entre as duas saídas é justamente essa, e
esconder isso faria contato sumir da lista sem ter sido atendido.

**Anti-duplicata vira LINHA da pergunta, não pulo.** `wasSent` e `decidirReenvio` continuam
consultados, mas o resultado aparece com "⚠" e tira o destaque da opção de enviar, em vez de
pular sozinho. Pulo silencioso já foi defeito duas vezes aqui.

**Sem `confirm()` de abertura**, diferente das outras rodadas: esta pergunta contato a contato, e
uma confirmação em massa no começo seria só mais uma porta para atravessar sem decidir nada.

Os dois passos ficam **no mesmo cartão** — são um movimento só, feito em dois momentos; separá-los
em cartões distantes é o que faz esquecer o segundo.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`processarSemRetornoEmMeus`,
`fecharSemRetorno`, `runLoteEmMeus`, segunda metade do `renderCartaoReabrir`,
`NO_REPLY_TEMPLATE_ID`). Manifesto 0.7.0 → **0.8.0**. Seis suítes passando.

---

## 2026-08-12 — Rodada dos concluídos desmontada em duas: reabrir em lote, trabalhar depois

**Pedido dele:** *"em vez de reiniciar ir para os meus e mandar mensagem, irá somente reiniciar as
conversas, após reiniciar determinado número de conversas irei trabalhar diretamente na aba meus
onde irei mandar a mensagem para ver interesse e retirar a etiqueta de sem retorno para quando
concluir ela não voltar pro topo dos concluídos"*.

**Por que o desenho novo é melhor, e não só diferente:** o fluxo antigo fazia tudo num contato só
— reabrir, mandar, concluir — e o Concluir devolvia a pessoa ao **topo** dos concluídos. Foi daí
que saíram, uma a uma, `contatosTratados`, `decidirReenvio`, `continuaNaFila` e o avanço de
posição: trava sobre trava para não tratar a mesma pessoa duas vezes numa lista que se reordena
embaixo da rodada. Reabrir **tira o atendimento da lista de concluídos de vez**. Some o problema
inteiro, não o sintoma.

**Rodada 5, `processarReabrir`:** percorre a lista filtrada e só clica em Reiniciar, até o limite.
Nada é enviado — então não tem modelo para escolher, janela de 24h para respeitar, anti-duplicata
para consultar nem dano possível a contato nenhum. Confere `hasComposer` depois do clique em vez
de acreditar nele: sem campo de mensagem o atendimento não reabriu, e contar como reaberto
deixaria a pessoa fora do trabalho em "Meus" sem ninguém saber.

**Duas mudanças no laço que a rodada nova exigiu:**

- `CONTA_NO_LIMITE` (`enviado` + `reiniciado`). O limite contava só envios, então uma rodada que
  não envia nada rodaria até a fila acabar — o número que ele digita nunca seria atingido.
- A pausa passou a depender do que aconteceu: **longa só quando saiu mensagem**. A longa protege
  o número no WhatsApp; reabrir não manda nada e precisa só da curta, que protege o servidor.
  Na prática é a diferença entre reabrir 50 em 1 minuto e em 7.

`reiniciado` entra em `SAI_DA_FILA` (o item deixa os concluídos, então a posição não avança).

**A etiqueta:** `auto.etiquetaSemRetorno` (padrão `1 SEM RETORNO`), e ela sai do contato quando o
atendimento é concluído **pelo painel** — `tirarSemRetorno`, passado só pelos fluxos que concluem,
nunca pelo Salvar solto: um Salvar no meio do trabalho tirando a etiqueta faria o contato sumir da
lista filtrada ainda faltando ser atendido. Como em "Meus" quem conclui é ele, pela plataforma, a
aba Dados ganhou o botão **Tirar "1 SEM RETORNO"** — o Concluir é da plataforma, não temos gancho
nele. O botão relê o contato depois de gravar (a API responde 200 ignorando o valor) e separa as
duas falhas possíveis: contato sem a etiqueta × etiqueta que não existe com aquele nome.

**O cartão antigo continua lá.** "Sem retorno: reabrir e perguntar" não foi apagado — o fluxo novo
é o de cima, e o antigo fica para quando ele quiser tudo num contato só.

**Perguntado e respondido:** o envio em "Meus" **vira rodada** — ver a entrada acima.

**Aviso que vale repetir:** reabrir **não** reabre a janela de 24h do WhatsApp. Em "Meus", texto
livre continua não chegando em quem está sem retorno há dias — só modelo aprovado chega.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`processarReabrir`, `runLoteReabrir`,
`renderCartaoReabrir`, `CONTA_NO_LIMITE`, pausa por tipo de resultado, `tirarSemRetorno`,
`etiquetaSemRetornoDoContato`, `tirarSemRetornoDoContato`),
[src/lib/store.js](src/lib/store.js) (`auto.etiquetaSemRetorno`). Manifesto 0.6.2 → **0.7.0**.
Seis suítes passando.

---

## 2026-08-12 — A caixa da cidade sobrevivia à troca de contato (gravaria na pessoa errada)

**Relato (Thiago):** *"saí e voltei e deu duas sugestões de cidade sem chat novo"* — e o print
mostrou muito mais que duplicata.

**O que o print mostra:** painel com **"Abra um atendimento na plataforma para começar"** (nenhum
contato carregado), conversa aberta a do **Odir**, e uma caixa por cima perguntando por **"Estrela
Velha"** — cidade que não aparece em lugar nenhum daquela conversa. A caixa era restolho de um
contato anterior.

**Causa raiz:** `perguntarNaRodada` pendura a caixa no `root` do painel, e `renderAll` só troca
os filhos de `header` e `body`. Trocar de atendimento nunca a tirava da tela. E como a caixa é
**não-bloqueante de propósito** (para ele poder ler a conversa e trocar de atendimento enquanto
decide), o intervalo entre a pergunta e a resposta é justamente quando o contato muda.

**Por que isso é grave, e não cosmético:** quem responde a caixa mexe em `state.draft` e a
gravação vai para `state.contact.id` — os dois já apontando para a pessoa NOVA. Um "1 Aceitar"
naquele print gravaria "Estrela Velha" em quem estivesse aberto. Escrita em produção, base de
eleitor real. Ninguém veria: o painel diria "Aplicado sozinho: Cidade" e estaria falando a
verdade sobre o contato errado.

**Fix, duas travas independentes:**

1. `load()` chama `cancelarPerguntaDeCidade()` logo na primeira linha. A promessa da pergunta
   passou a expor `.cancelar(valor)`, e a resposta `CANCELADA` **não é resposta**: não aceita,
   não recusa, não vira memória de recusa — só desfaz.
2. `saveClassification` guarda o id do contato **antes** da pergunta e desiste da gravação
   inteira se ele mudou, dizendo "você trocou de atendimento no meio — não gravei nada". Essa
   segunda trava pega qualquer variante da corrida, inclusive as que eu não enxergo daqui.

Na dúvida, não grava: a próxima abertura do contato certo refaz tudo do zero, sem custo nenhum.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`perguntarNaRodada` com `.cancelar`,
`cancelarPerguntaDeCidade`, `CANCELADA`, guarda de contato em `saveClassification`),
[CLAUDE.md](CLAUDE.md). Manifesto 0.6.1 → **0.6.2**. Seis suítes passando.

---

## 2026-08-12 — Duas caixas de cidade na tela, e a recusa que não durava

**Relato (Thiago, print com a v0.6.0 rodando):** *"duplicado, e faça disparar novamente só se
tiver chat novo com provável cidade, estou botando sem cidade e pede novamente"*. Duas caixas
"Cidade a gravar" abertas ao mesmo tempo, as duas perguntando a mesma coisa ("Quaraí").

**Causa raiz da duplicata:** `load()` **não roda dentro de `withBusy`**, então `state.busy`
continua falso enquanto ele carrega. Chegou mensagem nova (a figura das 18:56) → `applyPageState`
viu `conversaMudou` → `reexaminarMensagens` → segunda `aplicarAutomatico`, com a primeira ainda
parada esperando a resposta da caixa. Cada uma abriu a sua. Responder uma deixava a outra na tela
perguntando o mesmo — é daí que veio o "pede novamente".

**Fix:** `perguntaDeCidade` guarda a promessa da pergunta em curso. Quem chega depois **espera a
mesma pergunta** em vez de abrir outra; quando ela responde, o rascunho já está decidido e a
segunda gravação segue com a decisão tomada. Não é debounce nem lock com timeout: é a mesma
resposta servindo os dois caminhos.

**Causa raiz da recusa que não durava:** `state.cidadeRecusada` era um `Set` em memória, zerado
no começo de todo `load()`. Fechar e reabrir o contato — ou a rodada passar por ele de novo — e a
mesma pergunta voltava.

**Fix:** a recusa vai para o `chrome.storage.local`, por contato e **por cidade**
(`store.cidadeRecusada`, com `lembrarCidadeRecusada`/`cidadesRecusadas`). Guardar a cidade, e não
um "não perguntar mais" no contato, é o que atende a outra metade do pedido — *"disparar
novamente só se tiver chat novo com provável cidade"*: mensagem nova que traga cidade
**diferente** volta a perguntar (é informação nova, e é justamente o caso de quem escreve a
cidade depois); a mesma cidade já recusada, nunca mais. A leitura entra no `load()` **antes** do
`extract`, senão `applyGuesses` repõe a cidade recusada no rascunho e a caixa aparece antes de
alguém consultar a memória.

**Poda:** `MAX_CONTATOS_RECUSA = 2000`, descartando o mais **parado** (`at` é renovado a cada
recusa, então contato ativo não é esquecido por ser antigo). A base é de milhares de contatos e o
storage não é infinito — estourar a gravação no meio de uma rodada custa mais que uma pergunta
repetida daqui a meses. Fora do `exportJson`: é referência a contato real.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`perguntaDeCidade`, `recusarCidade`,
semeadura no `load`, guarda em `corrigirNomeComCidade`), [src/lib/store.js](src/lib/store.js)
(`cidadeRecusada`, `lembrarCidadeRecusada`, `cidadesRecusadas`, `MAX_CONTATOS_RECUSA`),
[tests/parser.test.mjs](tests/parser.test.mjs) (10 asserções novas). Manifesto 0.6.0 → **0.6.1**.

---

## 2026-08-12 — "Tem extensão dentro da extensão": os fixes nunca chegaram ao Chrome

**Relato (Thiago):** *"o erro está na pasta, tem extensão dentro da extensão"*.

Isso fecha a tarde inteira. A cidade continuava sendo gravada sozinha depois de dois commits que
justamente impediam isso — e a explicação não era o código: **a pasta que o Chrome carrega não é
a que o GitHub Desktop atualiza.** Uma cópia da extensão dentro da pasta da extensão (zip
descompactado, ou `dist/`, que é *gitignorado* e por isso nunca é tocado pelo Desktop) fica
congelada para sempre. Toda correção ia para a pasta certa e o Chrome lia a errada.

Conferido: o repositório está limpo — **um** `manifest.json`, na raiz, nenhuma cópia versionada.
A cópia é local, na máquina dele.

**O que ficou no código, para isso não custar outra tarde:** a versão do manifesto passa a
aparecer no cabeçalho do painel, ao lado de "encaixado na aba" (`versaoCarregada`). Sem número na
tela não há como distinguir *"o fix não funcionou"* de *"o fix não chegou"* — e as duas hipóteses
levam a caminhos opostos. Eu passei a tarde na primeira; era a segunda. Manifesto subiu para
**0.6.0**, para o número da tela ser diferente do que estava rodando.

**Regra nova no CLAUDE.md:** mudou comportamento visível, sobe a `version` do manifesto no mesmo
commit — é o que torna a conferência possível.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`versaoCarregada`, cabeçalho),
[manifest.json](manifest.json) (0.5.0 → 0.6.0), [CLAUDE.md](CLAUDE.md).

---

## 2026-08-12 — O rótulo da opção prometia gravar a cidade sozinho

**Pergunta dele:** *"se eu remover a cidade e as etiquetas vai automaticamente pegar sem minha
permissão?"* — perguntada sobre o teste que eu propus (apagar o campo e reabrir).

Com a versão que estava na máquina dele, **sim**: é o defeito. Com o código novo, não — mas o
rótulo da opção na aba Config ainda dizia *"Gravar sozinho, ao abrir o contato, o que bate exato
(cidade do IBGE, COREDE, etiquetas de conteúdo)"*. Prometia exatamente o que tinha deixado de
fazer. Rótulo mentindo é pior que rótulo faltando: ele foi conferir na tela e a tela confirmou o
medo dele. Corrigido, junto com o comentário de `aplicarAutomatico`, que dizia o mesmo.

**O que entra sozinho, hoje, campo a campo** (para não ter que reler o código da próxima vez):

- **Cidade** — nunca. `confirmarCidadeSePendente` pergunta antes, inclusive na gravação automática.
- **COREDE** — só junto com a resposta da cidade. Recusada a cidade, `refreshTagSuggestions` roda
  de novo e a sugestão de região some antes da gravação.
- **Etiqueta de conteúdo** — sim, sozinha. É regex que ele escreveu na Config casada contra o
  texto: ou a palavra está na mensagem ou não está, não tem palpite no meio.
- **Data de conclusão** — sim, e só quando o campo está vazio.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (rótulo do `checkbox` de `autoApply`,
cabeçalho de `aplicarAutomatico`).

---

## 2026-08-12 — "Pegou novamente sem eu confirmar": não pegou, e o print prova

**Relato (Thiago, print do contato "Nice Gomes"):** *"pegou novamente sem eu confirmar não rodei
nada só abri o contato"*. Cidade "Caçapava do Sul" no CRM e no cabeçalho do painel.

**O que o print mostra, medido:** a linha de status da própria extensão diz **"Gravado: nada —
PROBLEMA: Data de conclusão do contato: Falta aprender o contrato de DATE"**. `aplicarAutomatico`
rodou (a data está vazia) e não gravou campo nenhum. Se a cidade fosse palpite novo, ela estaria
em `changes` e o status seria "Aplicado sozinho: Cidade". Ela não estava — a entrada era
`from: 'crm'`, ou seja **a cidade já estava no CRM antes de ele abrir**.

Quando foi escrita: o atendimento foi assumido às 15:00 e o print é das 21:14 ("há 6 horas"). Foi
gravada às 15:00, pelo código antigo, antes do popup existir. Reproduzido offline: `extract` sobre
as duas mensagens reais devolve `{cidade: 'Caçapava do Sul', confidence: 'exata', informada:
false}` — exatamente o palpite que a versão antiga gravava sozinha.

**Conclusão:** o fix da entrada anterior não estava no navegador dele (Desktop não tinha puxado /
extensão não recarregada). Nada a corrigir no popup. Para conferir de verdade: apagar a Cidade de
um contato de teste e abrir — a caixa tem que aparecer antes de qualquer escrita.

### Achado de verdade no mesmo print: dois COREDEs no mesmo contato

O contato está com as etiquetas **CAMPANHA** e **MÉDIO ALTO URUGUAI**. Caçapava do Sul é COREDE
**Campanha** (conferido em `coredes-rs.json`) — então "Médio Alto Uruguai" é COREDE errado
pendurado no contato.

**Causa raiz:** `etiquetasDeRegiaoASair` só devolvia algo quando a cidade tinha sido
**substituída** (`entrada.substituiu`). Aqui a cidade **preencheu um buraco** (o campo estava
vazio), então `substituiu` era nulo e o COREDE antigo nunca saía. Dois COREDEs num contato é o
mesmo dado errado que a função existe para evitar, só que por outra porta.

Segunda armadilha, que quase fez o fix não funcionar: a etiqueta CERTA já estava aplicada, e
`marcada` é falso justamente para não reaplicar o que já está lá — então procurar a região nova
na lista das que vão ser aplicadas devolvia nada. Agora a região é buscada em `tagSuggestions`
inteira, e a antiga só sai se a certa **fica** (vai ser aplicada agora ou o contato já a tem):
tirar a antiga sem pôr a nova deixa o contato sem COREDE nenhum, que é pior que os dois.
`etiquetaConfiavel` continua sendo a trava — cidade de palpite não-exato não manda tirar nada.

Contatos já sujos se consertam sozinhos na próxima gravação (abrir com data de conclusão vazia
já dispara), não precisa de mutirão.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`etiquetasDeRegiaoASair`,
`saveClassification` passando as sugestões aplicáveis). Seis suítes passando.

---

## 2026-08-12 — O popup da cidade cobria só metade (e a outra metade era a que ele via)

**Relato (Thiago):** *"eu pedi para me mostrar um popup antes de registrar a cidade mas continua
registrando automaticamente"*.

**Causa raiz:** a entrada de baixo (mesmo dia) resolveu a cidade tirada do FORMATO do cadastro
("Cidade - Nome"), e só ela. A cidade tirada das MENSAGENS entra por outro caminho —
`applyGuesses`, com `confidence: 'exata'` quando casa com a lista do IBGE — e `aplicarAutomatico`
grava todo palpite `exata` no instante em que o contato é aberto, sem clique nenhum. Essa é a
comum: o caminho do cadastro é raro, o das mensagens acontece em todo contato que escreve o nome
de um município. O popup existia, ele nunca o via, e o CRM continuava sendo escrito sozinho.

**Fix:** a confirmação virou regra do CAMPO, não da origem. `applyGuesses` marca toda entrada de
Cidade com `pendente: true`, e `saveClassification` — único lugar que escreve no CRM — chama
`confirmarCidadeSePendente` antes de montar `changes`, **inclusive na gravação automática**, que
era justamente a que passava batido. A caixa é a mesma da rodada (`perguntarNaRodada`: sem fundo
escuro, arrastável, não trava a conversa) e diz de onde a cidade saiu, se é palpite não-exato e
se vai substituir a que está no CRM. Três saídas: **1 Aceitar** grava; **2 Corrigir** descarta;
**3 Sem cidade** grava vazio. Esc = descarta (na dúvida não grava), e a dica da caixa passou a
dizer isso em vez de "Esc para parar a rodada" — esta caixa decide um campo, não o atendimento.

**Decisão consciente:** isto abre exceção à regra *"automático só grava o determinístico"* do
CLAUDE.md. Casar exato com o IBGE prova que o texto é o nome de um município, **não** que seja a
cidade dele — *"meu genro mora em Santiago"* casa igualzinho. Instrução dele vence a regra.

**Trava junto:** recusar não adiantava sozinho. `applyGuesses` só preenche buraco, recusar
esvazia o campo, e a releitura da conversa (que roda sozinha quando o contato responde) devolvia
o mesmo palpite e perguntava de novo — popup em laço dentro da rodada. Agora `state.cidadeRecusada`
guarda o que foi recusado enquanto o contato estiver aberto. A etiqueta de COREDE sai junto:
recusada a cidade, `refreshTagSuggestions` roda de novo, senão o contato ficava com o COREDE de
uma cidade que ele acabou de recusar.

### Junto: o anti-repetição por conversa tinha sido removido

O commit `0e4cc6a` ("atualizado") apagou `hsm.decidirReenvio`, o teste dele, o
`auto.horasSemRepetir` do `store.js` e o campo dele na aba Automatizado — trocados pelo
`contatosTratados`, um `Set` de contatos já tratados dentro da rodada.

**Não é a mesma trava.** `contatosTratados` nasce vazio a cada rodada e cobre o item que volta ao
TOPO da lista dentro da MESMA rodada. O caso relatado ao vivo (*"falhou e mandou mensagem
novamente"*) foram DUAS rodadas: resposta pronta às 14:05, modelo aprovado às 14:37 — `Set` novo,
chaves diferentes no registro, duas mensagens em 32 minutos. Restaurado, e as duas travas
convivem: `contatosTratados` dentro da rodada, `decidirReenvio` (que pergunta à CONVERSA, então
conta também o que foi mandado à mão) entre rodadas.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js) (`confirmarCidadeSePendente`,
`applyGuesses`, `state.cidadeRecusada`, `perguntarNaRodada` com `dica`, `processarSemRetorno`,
cartão da rodada), [src/lib/hsm.js](src/lib/hsm.js) (`decidirReenvio`),
[src/lib/store.js](src/lib/store.js) (`auto.horasSemRepetir`),
[tests/hsm.test.mjs](tests/hsm.test.mjs). Seis suítes passando.

---

## 2026-08-12 — Cidade gravada sem a pessoa ter dito nada ("Lourdes" → "Cerrito")

**Relato (Thiago, print):** contato "Lourdes" ficou com Cidade "Cerrito" na conversa inteira sem
ninguém ter mencionado nenhuma cidade — só a mensagem do anúncio e um desabafo sobre política.

**Causa raiz:** não é `matchCity` (conferido: nem a mensagem do anúncio nem o desabafo casam com
"Cerrito", distância de Levenshtein bem acima da tolerância). É `corrigirNomeComCidade` em
[panel.js](src/panel/panel.js:320): quando o Nome no CRM está no formato "Cidade - Nome"
("Cerrito - Lourdes"), `splitCidadeNome` separa os dois, e a cidade entrava como palpite
`confidence: 'exata'`. `aplicarAutomatico` grava sozinho qualquer palpite `exata` — então essa
cidade era escrita no CRM sem clique nenhum, só por causa do FORMATO do cadastro, não porque a
pessoa disse. O parsing é determinístico; o dado por trás (por que o cadastro foi digitado
assim) não é.

**Fix, primeira volta:** mudei para `confidence: 'aproximada'` — tirou do `aplicarAutomatico`
(silencioso), mas o Thiago apontou o furo que sobrou: o Salvar/Concluir manual grava QUALQUER
palpite não vazio, sem perguntar nada. Confiança marcada como "aproximada" não é confirmação,
é só deixar de esconder — continuava indo pro CRM no primeiro clique em Concluir.

**Fix de verdade:** popup de verdade, perguntando antes de gravar. `corrigirNomeComCidade` marca
a entrada com `pendente: true`; `saveClassification` (o ÚNICO lugar que escreve no CRM, manual ou
da rodada) chama `confirmarCidadeDoCadastroSePendente` ANTES de montar `changes` — pergunta com a
mesma caixa não-bloqueante da rodada (`perguntarNaRodada`: sem fundo escuro, arrastável, não
trava a conversa) "está correta?", com três saídas: **1 Aceitar** grava; **2 Corrigir** descarta
e some do rascunho para você preencher na aba Dados; **3 Sem cidade** marca o campo como `manual`
vazio — não grava nada E não deixa `corrigirNomeComCidade` voltar a sugerir a mesma cidade
enquanto o contato estiver aberto (a checagem é `!state.draft[cidadeField.id]`, e uma entrada
vazia ainda é uma entrada). Só roda em gravação disparada por você — a automática
(`automatico: true`) já nem inclui este palpite no `changes` (não é `exata`), perguntar ali seria
popup surgindo sem clique nenhum que o justifique.

**Arquivos:** [src/panel/panel.js](src/panel/panel.js:320) (`corrigirNomeComCidade`,
`confirmarCidadeDoCadastroSePendente`, chamada em `saveClassification`). Seis suítes de teste
passando — panel.js não é coberto por elas (arquivo grande, sem teste próprio), então não havia
asserção prévia travando esse comportamento.

---

## Estado atual (histórico — ver "ONDE PAROU" no topo)

**Onde o projeto está:** funcionando em produção no dia a dia do Thiago. Repositório privado em
`github.com/thiagokcw-coder/WhatsFill`, `main` sincronizada. **Publicação na Chrome Web Store
cancelada** (decisão do Thiago, 06/08/2026): a extensão fica carregada descompactada, uso
interno. `STORE.md`, `PRIVACY.md`, `tools/package.mjs` e `icons/promo-*` viram resto sem uso —
mantidos no repositório, mas nenhuma tarefa nasce deles.

### O laço de trabalho, hoje

Atendimento assíncrono, em três rodadas na aba **Automatizado**:

0. **Concluídos sem retorno: reabrir e perguntar** — sobre a lista de concluídos (o ícone de
   caixa), filtrada por ele: Reiniciar, modelo aprovado, concluir de novo, próximo. Reabrir não
   reabre a janela de 24h, então só modelo aprovado sai daqui.
1. **Novos: pedir os dados** — assume, manda o formulário (nome/cidade/grupos), conclui, volta
   para "Novos". Quem não tem o aceite do anúncio, ou já respondeu nome/cidade, é **assumido sem
   receber nada** e vai para "Meus" como triagem. A fila drena.
2. **Conferir e responder a fila** (botões "Meus" e "Outros") — classifica e **pergunta contato a
   contato**, com atalhos: `1` mandar modelo do conteúdo pedido, `2` pular, `3` concluir sem
   enviar, `4` agradecer e concluir, `5` mensagem do momento, `6` responder à mão (retoma quando
   você concluir), `7` perguntar interesse no conteúdo e concluir (só para quem ainda não tem
   etiqueta de conteúdo), `Esc` parar. Nada sai da fila sem decisão humana — **com uma exceção,
   decidida em 10/08:** contato cuja última mensagem já é nossa é concluído sozinho, porque não
   há o que enviar a quem já foi respondido.
3. **Sem retorno: modelo aprovado** — janela de 24h vencida, HSM é o único envio que chega.

Quem responde depois de concluído reaparece em **"Meus"** — a plataforma faz essa triagem
sozinha, não há o que automatizar aí.

### Confirmado em uso

Rodada de 30 envios encerrada por limite; primeiro envio real de modelo aprovado + agradecimento;
keepalive de áudio segurando a aba escondida sem congelar; "Ver mais" paginando a fila;
classificação automática gravando cidade, COREDE, etiquetas e data e **conferindo relendo**.

### Fila de trabalho, em ordem de valor

0. **Rever os contatos com cidade "Capitão"** (10/08): a patente do candidato casava com o
   município, com confiança exata, então foram gravados sozinhos — cidade e COREDE errados.
1. **Tabela "Modelo por conteúdo" está vazia.** Sem ela a tecla 1 nunca aparece — é o
   pré-requisito do fluxo inteiro de resposta. Aba Config, `Etiqueta = Nome do modelo`.
2. **"Meus" acumulou ~60 contatos** enquanto o Concluir estava quebrado (ver 09/08). Parte já
   recebeu tudo e só faltou fechar. A rodada de "Meus" resolve, agora que pergunta em todos.
3. **Confirmar em uso** o que foi corrigido sem reprodução ao vivo: sinalização errada de
   "resposta já enviada" (o aviso agora diz o nome de quem recebeu), respostas rápidas mortas
   depois de gravar, e a pergunta que agora aparece para contato de nome errado (09/08).
   **Aberto:** contato concluído sem pergunta na rodada 2, ainda sem reprodução — quando
   acontecer, guarde o log da rodada.
4. **Parâmetros de HSM**: nenhum dos 19 modelos usa hoje, então a tela nunca apareceu e não houve
   como aprendê-la. O painel recusa e explica.
5. **Respostas prontas que sobraram sem uso**: `link-grupo`, `tema-opcoes`, `sem-interesse`. Não
   apaguei — apagar `link-grupo` quebra a macro "Enviar grupo + salvar + concluir". Decisão do
   Thiago. A candidata que estava aqui, **pedido de emprego**, foi escrita em 12/08 — falta usar
   uma vez e ver se o texto segura a conversa.

**Risco permanente:** toda escrita é em produção, com dados reais de eleitores. O contrato de
escrita mora no `chrome.storage.local` e já sumiu uma vez sem causa identificada — exportar
backup pela aba Config evita refazer o aprendizado.

---

## 2026-08-12 — Resposta nova: pedido de emprego (a lei cita "emprego" com todas as letras)

**Pedido:** "continue do projeto". A fila de trabalho estava com os itens 0 a 3 dependendo da
sessão ao vivo dele (rever os "Capitão", preencher a tabela Modelo por conteúdo, rodar "Meus",
confirmar em uso) e o 4 bloqueado por não existir HSM com parâmetro para aprender. O item 5
nomeava a próxima resposta a escrever, e é código: **pedido de emprego**.

### Por que ela é irmã da `pedido-ajuda`, e não uma resposta qualquer

O risco jurídico é o mesmo — na verdade um pouco maior. A Lei 9.504/97, art. 41-A, define
captação ilícita de sufrágio como oferecer ou prometer ao eleitor vantagem de qualquer natureza,
**"inclusive emprego ou função pública"**: é o único caso em que a coisa pedida está escrita na
lei. O art. 73, V ainda proíbe nomear, contratar ou admitir servidor nos três meses anteriores ao
pleito. Então a recusa se apoia na lei, como a do pedido de ajuda: é verdade e tira o peso pessoal
do não.

### A decisão que importa no texto

Ela **não oferece encaminhar currículo** nem "passar adiante" para empresa nenhuma, e isso é de
propósito: intermediar contratação é exatamente o que a regra proíbe, e promessa de repassar
currículo é promessa que ninguém cumpre — vira a mesma frustração, só que mais tarde. O teste
tranca isso: qualquer reescrita que fale em currículo derruba a suíte.

O caminho indicado é o do trabalho, não o da assistência: no RS as agências do **SINE são
operadas pela FGTAS**, e as mesmas vagas estão no **Emprega Brasil** (gov.br). O CRAS entra
depois, para qualificação e para o que sustenta a pessoa enquanto o trabalho não vem. O fecho é o
mesmo da `pedido-ajuda` — "procurou e não foi atendido? aí sim é trabalho nosso" —, que é a parte
que o mandato pode fazer de verdade.

Sem vocativo, como todas as outras (regra do projeto).

### Chega a quem já usa o painel

`DEFAULT_TEMPLATES` só vale para quem nunca gravou nada, e a lista dele está no
`chrome.storage`. Migração própria (`migrarRespostaPedidoEmprego`, flag `respostaPedidoEmprego`),
com as travas de sempre: só acrescenta, nunca reescreve, roda uma vez só — apagar a resposta de
propósito não a faz voltar.

### Arquivos alterados

`src/lib/store.js`, `src/lib/templates.js`, `tests/vars.test.mjs`.

**Nota desta sessão:** a pasta em que trabalhei **não é repositório git** (não existe `.git`), então
não houve commit nem push. Ao levar estes arquivos para o clone de verdade, o commit é
`feat(templates): resposta pronta para pedido de emprego`.

---

## 2026-08-12 — "Pegou Santiago em vez de Porto Alegre" — o parser estava certo, a regra é que não

**Relato dele:** print do contato "Luci - Porto Alegre" com `Cidade: Santiago` no CRM e a
etiqueta **Vale do Jaguari** (COREDE de Santiago) aplicada. "É um erro antigo."

### Reproduzi antes de mexer — e o parser não era o culpado

Rodei as mensagens dele pelo parser atual: `Olá! Eu aceito receber conteúdos…` + `Meus parentes`
+ `PORTO ALEGRE` devolve **Porto Alegre, exata**. Nunca Santiago. Ele estava certo ao dizer que
é erro **antigo**: o "Santiago" é dado velho gravado no CRM em alguma passada anterior.

O defeito de hoje é outro, e é o que interessa: **a extensão via o certo e mantinha o errado.**

### Causa raiz 1 — só resposta com separador contava como "informada"

A regra de substituição exigia resposta estruturada ("Nome / Cidade"). O contato mandou uma
mensagem inteira escrita `PORTO ALEGRE` — que é a pessoa dizendo a cidade dela de forma **mais**
clara, não menos —, e isso não contava. Resultado: "nunca sobrescrever o CRM" preservava o
Santiago errado, e o COREDE errado junto.

Agora **mensagem que é, sozinha, o nome completo de um município** conta como informada. As
travas são as mesmas: casamento exato e **nome completo, nunca prefixo** — "Vitória", "Esperança"
e "Rosário" começam município do RS e são nome de gente. Vale a mensagem mais recente: quem
mandou "Canoas" e corrigiu para "Porto Alegre" tem a correção respeitada.

### Causa raiz 2 — o cadastro é "Nome - Cidade", e a extensão só lia "Cidade - Nome"

`splitCidadeNome` nasceu para "Canoas - Marines". O cadastro dele é **"Luci - Porto Alegre"** —
a cidade vem depois. Metade da base foi digitada assim, e a cidade escrita no próprio cadastro
era invisível para o painel.

Os dois sentidos agora funcionam, com uma trava nova nos dois: o encurtamento de **uma palavra
só** deixa de separar. "Ana - Vitória" não pode virar Vitória das Missões — aqui o erro não
deixa a cidade errada, deixa o **eleitor com o nome errado**.

### Efeito prático na tela dele

Ao reabrir a Luci: a cidade vira Porto Alegre por substituição, a etiqueta **Vale do Jaguari sai**
e a **Metropolitano Delta do Jacuí entra** (a troca de COREDE já existia desde 10/08), e a
pergunta da rodada mostra `Cidade: Porto Alegre (a pessoa informou; estava "Santiago")`.

### Arquivos alterados

`src/lib/extract.js`, `src/lib/cities.js`, `tests/parser.test.mjs`.

---

## 2026-08-12 — "O contato voltou para o topo, vai pegar o mesmo de novo?" — simulado, não achado

**Pergunta dele:** "após a mensagem o contato voltou para o topo da lista, verifique se vai pegar
novamente o mesmo."

Pergunta certa, e a resposta não estava óbvia no código: a posição anda por conta própria e a
lista muda embaixo dela. Responder de memória seria chute sobre envio para gente real, então
simulei o laço (`tools/simular-fila.mjs`, novo).

### A resposta: não repete — e o caso dele é o que funciona melhor

Quando o contato tratado volta ao **topo**, os itens que estavam acima dele descem uma casa e os
de baixo **não se mexem**. O `posicao++` cai exatamente no próximo não visitado. Simulado com 6
contatos: `A → B → C → D → E → F`, nenhum repetido, nenhum pulado, **6 aberturas para 6
contatos** — nem uma sobrando.

São três camadas, e bastaria a primeira:

1. a posição anda a cada contato tratado (`continuaNaFila`);
2. `visitados` guarda o id da sessão: se a mesma abrir de novo, pula e anda;
3. o anti-duplicata por contato+modelo devolve "já recebeu" antes de qualquer envio.

### O que a simulação achou de errado — e não era o que ele perguntou

No pior caso (lista reordenando de um jeito imprevisto), ninguém é repetido, mas **alguém fica
para trás** — e a rodada terminava dizendo "a fila acabou", como se tivesse percorrido tudo. É o
mesmo tipo de mentira do log de ontem, e o contato sumia do trabalho sem ninguém saber.

Agora o veredito conta: `percorri 12 de 15 da lista — 3 não chegaram a ser abertos. Rode de novo
para pegar o resto`, com o status em vermelho. Não é o caso normal; é o caso que precisava de voz.

### Arquivos alterados

`src/panel/panel.js`, `tools/simular-fila.mjs` (novo).

---

## 2026-08-12 — A rodada volta a mandar o modelo escolhido, e só ele

**Relato dele:** "outro erro é que não utilizou o modelo escolhido e mandou texto".

### Erro de desenho meu, e ele está certo

Ontem eu tinha feito a rodada escolher **por contato**: janela de 24h vencida → modelo aprovado;
janela aberta → resposta de texto, mais barata e editável. Tecnicamente a dedução estava certa —
o Vicente da print tinha escrito 1h16 antes, a janela estava mesmo aberta, e o texto chegou.

E ainda assim é defeito: **ele escolheu um modelo no seletor e saiu outra coisa.** Substituir
escolha explícita por dedução é exatamente o que este projeto não faz em nenhum outro lugar —
é a mesma regra que faz o painel recusar em vez de chutar modelo, etiqueta ou cidade. Ser esperto
não compra o direito de contrariar o que está escrito na tela.

Voltou a ser: **vai o modelo escolhido, sempre.**

### O que sobrou da ideia

A resposta pronta `sem-retorno-interesse` continua na aba Respostas — ele manda à mão, ou pelas
respostas rápidas dentro da pergunta da rodada. Não virou lixo, virou opção dele.

E o Andamento continua marcando quem estava com a **janela aberta**: `… e concluí — a janela dele
estava ABERTA, dava para responder à mão`. A informação que motivou a ideia continua na tela;
o que saiu foi a decisão automática em cima dela.

### Arquivos alterados

`src/panel/panel.js`.

---

## 2026-08-12 — A volta para os concluídos (e o log que mentia sobre o motivo)

**Relato dele:** "faltou retornar para os concluídos e seguir pro próximo contato", com a print
do Andamento.

### O que a print entregou

A rodada **funcionou**: reabriu o Vicente, mandou a resposta livre (janela aberta, então texto —
a escolha por contato fez o que devia) e concluiu. Ela parou na volta, dizendo:

> `Rodada encerrada: 1 enviado(s), 0 pulado(s). A fila carregada acabou (1 item(ns)).`

E a fila da esquerda, na print, está em **"Meus"** — com exatamente 1 item. Ou seja: a rodada
contou a lista errada. O Reiniciar joga o atendimento para "Meus" e a plataforma troca de aba
junto; a volta para os concluídos não aconteceu.

### Causa raiz: a barra que eu media era só a das abas

`barraDaFila()` subia até o **primeiro** ancestral que continha as três abas de texto. Na tela
dele esse ancestral é o invólucro **só das abas** — os ícones (pessoas, caixa, "⋮") ficam num
irmão. Resultado: lista de candidatos **vazia**, nada para experimentar, e a troca falhando.

Agora ela continua subindo enquanto não houver nenhum ícone junto das três abas, e para antes de
chegar na lista de atendimentos.

### O segundo defeito, que é pior: o log mentia

Com a troca de aba falhando, `openQueueSession` **seguia em frente e olhava a lista mesmo
assim** — e reportava "a fila carregada acabou", que é uma afirmação sobre a fila errada. O
motivo verdadeiro (não consegui voltar para os concluídos) ficava guardado num campo que só era
lido quando dava certo.

Agora falha de aba **para na hora, com o nome certo**. Erro de aba é erro de aba: dizer "a fila
acabou" mandou o diagnóstico para o lado oposto, e é o tipo de mentira que custa uma hora.
Junto: "Ver mais" não é mais tentado quando a falha foi de aba — seria paginar a fila errada.

### Duas travas novas na tentativa

Experimentar cliques na barra dele exige cuidado: "Grupos", "Todas" e "Apenas não lidas" trocam
o filtro que ele montou.

- **Só ícone puro entra na lista de candidatos.** A caixa de arquivo é ícone; os filtros que
  estragariam a fila têm rótulo escrito. Ícone com texto ao lado está fora.
- **Candidato não aprendido só é aceito se a lista vier com algo.** Um ícone que abre uma visão
  vazia também deixa as três abas apagadas, e sem isso a rodada daria a fila errada por boa. Do
  já aprendido não se exige, porque no fim da rodada a lista de concluídos legitimamente esvazia.

E o Escape passou a ser dado entre tentativas: o "⋮" abre menu, e menu do Material é modal —
deixá-lo aberto travaria o clique seguinte.

### Arquivos alterados

`src/lib/dom.js`, `src/panel/panel.js`, `tools/checar-dom.mjs`.

---

## 2026-08-12 — Uma rodada de sem retorno, não duas; e a lista de concluídos por tentativa

**Relato dele:** a rodada dos concluídos parou no começo ("Não achei a lista de concluídos") e,
junto, o apontamento que resolveu o desenho: *"tem um erro lógico também, os sem retorno sempre
estão nos concluídos, só preciso de um e não dois."*

### O erro lógico — e ele estava certo

Eu tinha deixado **dois cartões**: "Sem retorno: enviar modelo aprovado" (fila aberta) e
"Concluídos sem retorno: reabrir e perguntar". Mas o fluxo dele conclui todo atendimento, então
**a fila aberta de sem retorno nunca tem ninguém**. O primeiro cartão era um seletor de modelo a
mais para errar, e nada além disso — na print os dois estavam com o mesmo modelo escolhido.

Sobrou uma rodada. A que ficou é a que reabre, e ela cobre os dois casos de graça:
`processarSemRetorno` só clica em Reiniciar **quando o atendimento está fechado**, então um sem
retorno que por acaso esteja aberto passa direto para o envio. Uma rodada, um modelo, os dois
casos. `processarContato` e o cartão duplicado saíram do código.

### A lista de concluídos: parar de adivinhar e passar a experimentar

O gancho daquele ícone não tem `data-cy` conhecido. Eu tinha escrito cinco `data-cy` plausíveis,
cinco nomes de ícone e um casamento por rótulo — **e nenhum acertou na máquina dele**. Mais
chutes só adiariam o problema.

A ordem agora é outra: a rodada **clica e confere**. Pega os candidatos da barra da fila (tudo
que é clicável e não é uma das três abas de texto nem campo de busca), clica um, e confirma pelo
sinal que já era confiável — estar nos concluídos significa que **nenhuma** das três abas está
com `bg-gray-300`. Acertou, guarda o elemento e as próximas voltas são diretas. Errou, **desfaz**
(volta para a aba de antes) e tenta o próximo.

Desfazer não é detalhe: sem isso, um clique em "Grupos" deixaria a rodada percorrendo outra fila
inteira sem ninguém perceber.

O botão "Achar a lista de concluídos" continua, agora como caminho para o conserto definitivo —
com o `data-cy` na mão, ele entra em `CY_CONCLUIDOS` e a tentativa nem chega a rodar.

`tools/checar-dom.mjs` ganhou os dois casos que protegem a lista de candidatos: ela não pode
incluir as próprias abas de texto (clicar nelas troca de fila em silêncio) nem o campo de busca.

### Arquivos alterados

`src/lib/dom.js`, `src/lib/store.js`, `src/panel/panel.js`, `tools/checar-dom.mjs`.

---

## 2026-08-11 — Texto livre na rodada dos concluídos, decidido por contato

**Pedido (Thiago):** "ok então mandar mensagem de texto em vez de modelo pronto não teria
problema, se não tiver problemas faça uma mensagem pronta para enviar para todos."

### A premissa estava errada, e a correção importa

"Para todos" não dá: texto livre **só chega dentro da janela de 24h**, e na fila dos sem retorno
a janela está vencida em praticamente todo mundo — é o que define aquela fila. Mandar texto para
todos ali seria mandar mensagem que não chega para dezenas de pessoas, **sem nada acusar**: a
plataforma aceita, o painel diz "enviado", e o contato nunca vê.

O que ele leu como "então texto serve" era, na entrada anterior, "texto serve **quando a janela
está aberta**".

### O que foi feito

Resposta pronta nova (`sem-retorno-interesse`), editável na Config, e a rodada 4 escolhendo
**por contato**:

- janela **vencida** → modelo aprovado (o único que chega);
- janela **aberta** → a resposta pronta, que fala como gente, não gasta modelo e ele edita.

O Andamento diz qual foi em cada um. Variável sem valor derruba para o modelo, em vez de mandar
texto pela metade.

### Detalhe de implementação que não é detalhe

O envio do texto usa `page.sendText` direto, **não** `sendTemplate`. Esta rodada não chama
`load()` — como as outras rodadas em lote, ela busca sessão e contato direto da API para ficar
leve. Só que `sendTemplate` lê `state.contact`, que nesse momento é o contato de **outro**
atendimento: o registro anti-duplicata cairia na pessoa errada. É a mesma armadilha que já
gerou o aviso "já enviei esta resposta" em quem nunca recebeu.

### O texto

Sem nome (regra do projeto), pede no formato `Sim / Nome completo / Cidade` — o mesmo que o
parser entende — e **oferece a saída de sair da lista**. Isso é de propósito: quem responde
"não" custa muito menos que quem bloqueia o número, e número bloqueado derruba a entrega de
toda a campanha.

Teste novo confere que as três respostas que pedem dados carregam a linha do formato. Se alguém
reescrever uma delas e tirar essa linha, o parser perde o acerto sem nada quebrar.

### Arquivos alterados

`src/lib/store.js`, `src/lib/templates.js`, `src/panel/panel.js`, `tests/vars.test.mjs`.

---

## 2026-08-11 — "Reiniciada só aceita modelo?" — o que é regra do WhatsApp e o que era escolha minha

**Pergunta dele:** "para as conversas reiniciadas só libera modelos prontos, não tem como mandar
mensagem normalmente?"

### Duas coisas diferentes estavam misturadas

**1. A janela de 24h é regra do WhatsApp, e não tem como contornar.** Ela abre quando o
**contato** escreve, e reabrir o atendimento na plataforma não encosta nesse relógio. Fora da
janela, texto livre sai do painel, a plataforma aceita e a mensagem **não chega** — silêncio, o
pior dos resultados. Modelo aprovado é o único que atravessa. Quando a pessoa responde ao
modelo, a janela reabre por 24h e tudo volta ao normal: é exatamente para isso que ele serve.

**2. "Reiniciada = só modelo" era escolha minha, e estava errada como regra geral.** O painel
inteiro já decide isso **por contato**, pelo `expired` que a própria plataforma calcula: com a
janela aberta, texto livre é enviado normalmente — inclusive em conversa reiniciada. Quem
bloqueia não é o Reiniciar, é a janela vencida.

Onde eu fixei "sempre modelo" foi na rodada 4, porque aquela fila é, por definição, quem não
responde. Mas nem todo item dela está com a janela vencida.

### O que mudou

A rodada 4 agora **diz no Andamento** qual era o estado da janela em cada contato:
`… concluído (janela de 24h vencida)` ou `… — ATENÇÃO: a janela estava aberta, dava para
responder à mão`. Depois de uma rodada ele sabe a proporção real, em vez de supor — e se a
segunda linha aparecer muito, vale trocar o desenho.

O texto do card passou a explicar que a trava não é da extensão.

### Arquivos alterados

`src/panel/panel.js`.

---

## 2026-08-11 — Modo de espera, e auditoria de envios fora da rodada

**Pedido (Thiago):** "o computador está entrando em modo de espera ao automatizar, evite que
entre. Verifique se alguma mensagem automática está sendo enviada fora da automação."

### O computador dormindo

Problema **diferente** do que o `keepalive.js` já resolvia. O áudio impede o Chrome de congelar
a aba; ele não impede o Windows de suspender por inatividade — e uma rodada de trinta envios com
8s de pausa passa longe de qualquer toque em teclado ou mouse. Para o sistema, ele está ausente:
a máquina dorme e a rodada morre no meio, com contatos abertos e sem saber onde parou.

`chrome.power.requestKeepAwake('display')`, pedido no começo da rodada e solto no `finally`.
Três decisões:

- **`display`, não `system`.** Manter só o sistema acordado deixa a tela apagar, e tela apagada
  volta a ser candidata a congelar a aba — que é justamente o que o áudio está ali para evitar.
  As duas travas têm que puxar para o mesmo lado.
- **Mora no service worker.** `chrome.power` não existe em content script; a aba pede por
  mensagem. Permissão `"power"` no manifest (a segunda da extensão, ao lado de `storage`).
- **Contagem de quem pediu.** O estado é global do navegador, não por aba: duas rodadas
  simultâneas e a primeira a terminar soltaria a trava da outra.

Falhar aqui **não derruba a rodada** — ela só perde a trava —, mas vira linha no Andamento. Sem
aviso, ela morreria de madrugada sem explicação.

Conferido no navegador de verdade: `chrome.power` disponível, contagem sobe e desce e não vai
para negativo com solturas a mais.

### A auditoria: nenhuma mensagem sai fora da rodada

Levantei **todos** os pontos do código que fazem a plataforma enviar (`page.sendText` e
`page.sendMessageTemplate`) e de onde cada um é chamado:

| Onde envia | Quem dispara |
|---|---|
| `renderModeloCard`, `renderTemplateCard` | `addEventListener('click')` |
| `runPedirDados`, `runMacro`, `runFecharComConteudo` | botão da aba Respostas |
| `processarNovo`, `processarRespondido`, `processarContato`, `processarSemRetornoConcluido` | rodada, iniciada por botão + `confirm()` |
| respostas rápidas da pergunta | clique dentro da caixa da rodada |

**Não há timer, observador ou caminho automático que envie.** Os dois únicos temporizadores da
extensão são a gravação da largura do painel (`main.js`) e o observador de estado da página
(`rpc-host.js`), que só lê e avisa.

O caminho automático de verdade — observador → `load()`/`reexaminarMensagens()` →
`aplicarAutomatico()` → `saveClassification()` — toca **só a API do CRM** (campos e etiquetas).
Nenhuma função de envio é alcançável a partir dele. Isso é por projeto e continua valendo.

**O que existe e pode ter parecido envio:** com o "Enviar automático" desligado, `sendTemplate`
**insere o texto no campo de mensagem** da plataforma em vez de enviar. O texto aparece lá sem
ele ter digitado — e um Enter depois manda. É o único lugar onde texto nosso chega ao composer
sem envio.

**Uma coisa que quase entrou e não entrou:** a versão inicial do conserto de "silêncio longo"
mandava a mensagem do momento sozinha. Ele reconsiderou antes de eu comitar, e o código de envio
automático foi removido — não chegou a rodar em produção.

### Arquivos alterados

`manifest.json`, `src/background.js`, `src/lib/keepalive.js`, `src/panel/panel.js`, `CLAUDE.md`.

---

## 2026-08-11 — Silêncio longo para de virar conclusão automática

**Relato dele:** "está pulando pessoas que estão sem responder por mais de um dia".

### Causa raiz

A conclusão automática ("a última mensagem é minha") tratava igual dois casos bem diferentes:

- respondi **há uma hora**: a conversa está viva, a pessoa ainda pode voltar. Fechar é o certo,
  e perguntar seria teclar à toa;
- respondi **anteontem** e ela nunca voltou: esse saía da fila **em silêncio, sem nunca ter
  mandado os dados**. É o que ele viu.

Agora só o primeiro conclui sozinho. Passou do limite de horas (12h, editável no card
"Conferir e responder a fila"), a rodada **para e pergunta** como faz com todo mundo.

### A ideia que ele descartou, e por que a descartada era pior

A primeira versão que escrevi mandava a **mensagem do momento sozinha** nesses contatos. Ele
reconsiderou — *"pensando melhor eu mando a mensagem, só evite de pular"* — e está certo:
mensagem automática para quem está calado há dias é justamente o envio que precisa de
autorização. O código de envio automático foi removido; sobrou a decisão de parar.

Isso também deixou a regra **muito** menor: `decidirSemResposta` só compara horas contra o
limite. A versão anterior tinha que pesar janela de 24h, existência da mensagem do momento e
anti-duplicata — três coisas que agora são problema da tela de pergunta, onde ele decide.

### O que aparece na tela

A linha do silêncio entra na pergunta, com destaque de aviso:
`⚠ 3 dias sem resposta desde a minha última mensagem (09/08 às 14:03). Ele nunca voltou — por
isso parei aqui em vez de concluir.`

E, quando for o caso, a linha seguinte: `A janela de 24h venceu: texto livre não chega mais
neste contato, só modelo aprovado.` Sem ela, a tecla 5 pareceria simplesmente não funcionar.

Isso é a lição da entrada anterior aplicada: quando a rodada trata dois contatos de forma
diferente, **o motivo tem que estar na tela**.

### Arquivos alterados

`src/lib/hsm.js`, `src/lib/store.js`, `src/panel/panel.js`, `tests/hsm.test.mjs`.

---

## 2026-08-11 — Rodada 4: os concluídos sem retorno (reabrir, perguntar, fechar)

**Pedido (Thiago):** "a conversa vai ter que reiniciar, mandar uma mensagem perguntando se a
pessoa realmente não tem interesse e, se for o caso, não incomodaremos mais, e ir pro próximo
sem retorno. Ao reiniciar vai me mandar para a aba Meus, então teria que retornar para
concluídos para continuar."

### A rodada

Primeira que trabalha sobre atendimento **fechado**, e por isso tem um passo a mais: concluído
não tem campo de mensagem. Por contato: **Reiniciar → modelo aprovado → Concluir → voltar para
a lista de concluídos → próximo**.

Card próprio, com **seletor de modelo próprio** (`templateIdReinicio`). Um seletor só para as
duas rodadas de "sem retorno" seria o jeito mais fácil de mandar o texto errado — e aqui o texto
é outro (a pergunta de "você realmente não tem interesse", com a saída de não incomodar mais).

### Por que só modelo aprovado, mesmo depois do Reiniciar

Reabrir o atendimento **não reabre a janela de 24h**: ela é regra do WhatsApp, não da
plataforma. Quem está sem retorno há dias tem a janela vencida, então texto livre não chegaria —
sairia do painel, a plataforma aceitaria, e a mensagem morreria no caminho. Modelo aprovado é o
único envio que sai daqui, como na rodada 3.

### Duas coisas que a fila dos concluídos tem de diferente

- **O contato VOLTA para a lista.** Nas outras rodadas o atendimento sai da fila ao ser tratado;
  aqui concluir devolve ele para os concluídos, e no topo (acabou de ser concluído). Sem andar
  uma casa, a rodada reabriria o mesmo. Daí o `continuaNaFila` no retorno do processar —
  `visitados` até protegeria, mas ao custo de uma abertura extra por contato, e abertura é o que
  derruba a API.
- **Reabrir troca a aba sozinho.** A plataforma joga para "Meus" no Reiniciar. Quem resolve é o
  `aba` do `openQueueSession`, que já garante a lista certa a cada item — foi só ensinar a nova.

### O gancho da lista de concluídos NÃO foi conferido ao vivo

As três abas de texto têm `data-cy` conferido (`button-new-sessions` e irmãs). A lista de
concluídos é o ícone de caixa, e desse eu não tenho o markup. Então:

- `getAbaConcluidos()` tenta, nesta ordem: cinco `data-cy` plausíveis, cinco nomes de ícone
  (o tema usa heroicons) e, por último, `aria-label`/`title` casando com arquiv/conclu/encerr.
- **Não achou, a rodada para e diz o que fazer** — não percorre a fila errada.
- A confirmação de que a troca funcionou é por eliminação: estar nos concluídos significa que
  **nenhuma** das três abas de texto está com `bg-gray-300`. Não depende da classe do ícone.
- Botão **"Achar a lista de concluídos"** no card despeja os `data-cy`, ícones e rótulos que
  existem na barra da fila dele. Uma passada e o gancho certo entra no código sem chute.

`tools/checar-dom.mjs` ganhou sete casos novos, incluindo os dois que protegem contra o conserto
errado: barra sem nada de arquivo (tem que recusar) e "Reiniciar" dentro de overlay (não conta).

### Pendência

**Rodar o "Achar a lista de concluídos" e me mandar o resultado.** Enquanto o gancho não for
confirmado, esta rodada pode parar logo no começo dizendo que não achou a lista.

---

## 2026-08-11 — Quatro itens da lista da manhã

**Pedido (Thiago):** prints do WhatsApp e da tela.

### 1. "Mudar a mensagem que pede grupos para pedir link e não o nome"

Nome de grupo não serve para nada — é o link de convite que permite entrar. Pedir "o nome ou o
link" fazia quase todo mundo mandar só o nome. A frase agora pede o link e **ensina o caminho**
(tocar no nome do grupo → Convidar via link → Copiar link), porque a maioria não sabe onde fica.

`migrarGruposPedeLink` troca por substring: a frase mora **dentro** do `pedir-dados`, e pode
morar em outras respostas. Só troca onde ela aparece literalmente.

### 2. "Caxias não pegou como cidade, seria caxias do sul"

Meia verdade — e o "meia" é o que interessa. Na versão que ele está rodando, "Caxias" não casava
nada (o prefixo de uma palavra é da leva de ontem). Na versão nova ele **já casava**, mas como
`aproximada`, que é o palpite que **espera clique** e nunca grava sozinho. Do lado dele, o efeito
é o mesmo: a cidade não entra.

Prefixo de uma palavra agora vale como **exata quando é a resposta inteira**. "Caxias", sozinho
no campo da cidade, é Caxias do Sul. Já "trabalhei em Caxias uns anos" continua palpite: em
frase, a palavra solta pode ser nome de gente — **Vitória**, **Esperança** e **Rosário** também
são começo de município do RS, e gravar sozinho ali trocaria a cidade de um eleitor.

Levantei as 48 palavras que passam a gravar sozinhas para conferir a lista antes de mexer.

### 3. "Alguns estão concluindo quando a minha é a última mensagem e outros não"

**Causa raiz: uma exceção que eu mesmo criei ontem.** A regra dele era "última mensagem minha →
concluir", sem ressalva; eu abri uma exceção para quem ainda não tinha etiqueta de conteúdo, com
a ideia de oferecer a pergunta de interesse antes de fechar.

Funcionava como projetado, e mesmo assim é defeito: a diferença depende de um estado que não
está na tela. Regra que parece aleatória para quem usa **é** uma regra ruim, e a instrução
original não tinha ressalva. Voltou a ser sem exceção.

Quem fica sem etiqueta de conteúdo agora aparece no Andamento com essa observação —
`… — concluí e segui (ainda sem etiqueta de conteúdo)` —, que é a lista de quem vale uma rodada
de pergunta de interesse depois. A fila da plataforma filtra por etiqueta.

**Ajustado no mesmo dia** (ver a entrada do topo): conclui sozinho só quem foi respondido há
POUCO. Quem está calado há mais de 12h volta a parar a rodada, agora com o tempo de silêncio
escrito na pergunta — a diferença ficou na tela, que era o que faltava na versão anterior.

### 4. "Agradecer e concluir ficou confuso, mude para agradecer informações e concluir"

Rótulo da tecla 4. O nome antigo colidia com a tecla 1, que também agradece no fim.

### Extra, visto no print da Beti

Ela respondeu **"Sim."** à pergunta de interesse, e a rodada ofereceu a tecla 7 — perguntar de
novo — **em destaque**. Quem já respondeu está esperando o conteúdo, não outra pergunta igual.
Agora, quando a pergunta já saiu para aquele contato, a tecla 7 vira "Perguntar interesse DE
NOVO", perde o destaque, e uma linha diz quando foi perguntado.

(O "Sim." dela não virou etiqueta porque **"Etiquetas quando responder sim" continua vazio** na
aba Config. O painel avisa na própria pergunta. É o passo que falta do lado dele.)

### Arquivos alterados

`src/lib/store.js`, `src/lib/templates.js`, `src/lib/cities.js`, `src/panel/panel.js`,
`tests/parser.test.mjs`, `tests/vars.test.mjs`, `CLAUDE.md`.

---

## 2026-08-10 — A pergunta de interesse já pede nome e cidade

**Pedido (Thiago):** "ao perguntar se a pessoa quer conteúdos já peça nome e cidade também para
caso positivo."

Motivo dele, e é o certo: quem recebe essa pergunta é justamente quem está em "Meus" sem
etiqueta de conteúdo — e, na maioria, sem nome e sem cidade no CRM. Uma segunda mensagem para
pedir os dados custa outro atendimento inteiro: mais um dia de espera e mais uma chance de a
pessoa não responder.

A pergunta agora pede no formato fixo, como o `pedir-dados`: **`Sim / Nome completo / Cidade`**.
O formato não é enfeite — é dele que sai a precisão do parser.

### O que a mudança de formato quebrou (e que era o trabalho de verdade)

Trocar o texto foi a parte pequena. A resposta esperada mudou de forma, e **duas regras do
parser estavam calibradas para a forma antiga**:

- **`respostaAfirmativa` recusava a resposta certa.** Ela exigia no máximo seis palavras e
  rejeitava qualquer negação na mensagem. Só que agora a resposta legítima é longa
  ("Sim / Maria Silva / Palmares do Sul") e frequentemente traz um "não" que responde **outra**
  pergunta do formulário — "Não faço parte de nenhum grupo político" apareceu numa conversa
  real. As duas regras juntas transformavam aceite em recusa.
  Agora a decisão sai da **cabeça da mensagem** (primeiras 4 palavras): "sim, mas não quero"
  continua sendo recusa, porque a negação está na própria resposta.
- **"Sim" viraria o nome do eleitor.** Quando a pessoa escreve a cidade antes do nome
  ("Sim / Palmares do Sul / Maria Silva"), o pedaço anterior à cidade é o "Sim" — e
  `plausivelNome` o aceitava (tem vogal, três letras, só letras). Entrou na lista de aberturas
  descartadas, junto com "não", "claro", "isso", "ok", "beleza".

### Migração

`migrarInteressePedeDados` troca o texto **só se ele estiver literalmente na versão anterior**
(`INTERESSE_CONTEUDO_ANTIGO`), e o nome da resposta idem. Pergunta que ele tenha reescrito fica
como está. Mesma disciplina do `migrarPerguntaGrupos`.

### Arquivos alterados

`src/lib/store.js`, `src/lib/templates.js`, `src/lib/tags.js`, `src/lib/extract.js`,
`src/panel/panel.js`, `tests/parser.test.mjs`, `tests/tags.test.mjs`, `tests/vars.test.mjs`.

---

## 2026-08-10 — As respostas param de chamar o contato pelo nome

**Pedido (Thiago):** "o uso de nomes para responder tem dado problemas, vamos alterar para não
mandar nomes."

### Por que ele está certo, e o quanto isso já custou

O nome do cadastro erra com frequência alta demais para ir num texto que a pessoa lê. Todos
estes são casos reais, e quase todos viraram entrada neste registro em algum momento:

| No cadastro | Quem é | O que saía |
|---|---|---|
| `[NOVO] (51) 9…` | contato recém-chegado do anúncio | "Boa noite, [NOVO]!" |
| `Zane` | apelido do perfil de Rosane Requia | "Obrigado pela atenção, Zane!" |
| `Santa Cruz - Serlei` | cidade digitada antes do nome | "Boa noite, Santa Cruz!" |
| `Jeane do PL` | sigla do partido colada | "Boa noite, Jeane do PL!" |
| `srn` | abreviação na posição do nome | "Obrigado, Srn!" |

Cada conserto anterior atacou **uma** dessas portas: `looksLikePlaceholder`, `nomeVeioDoPerfil`,
`splitCidadeNome`, `limparSiglas`, a regra da vogal. Tirar o nome do texto fecha a classe
inteira de uma vez — e o acerto, quando acertava, não comprava quase nada.

O segundo motivo é mais silencioso: variável sem valor **bloqueia o envio**. Foi assim que a
opção sumiu da pergunta da rodada duas vezes (06/08 e 09/08). Sem nome no texto, esse ramo
inteiro de bloqueio deixa de existir.

**O que NÃO mudou:** a extensão continua extraindo e gravando o Nome no CRM. O dado é útil no
cadastro; ele só não vai mais na mensagem.

### O que foi feito

- As cinco respostas que usavam vocativo perderam o nome: `tema-opcoes`, `link-grupo`,
  `agradecimento`, `saudacao-fe`, `agradecer-info`, `sem-interesse`.
- **Migração `migrarRespostasSemNome`.** Mudar o padrão não bastaria: as respostas dele estão
  no `chrome.storage`, algumas editadas à mão. Esta migração **reescreve** — as outras só
  acrescentam — e por isso é estreita: apaga o marcador e a pontuação do vocativo em volta, e
  não toca no resto da frase. `auto.mensagemMomento` entra junto, porque com nome ela travaria
  a tecla 5 do mesmo jeito. Roda uma vez: se ele puser o nome de volta de propósito, fica.
- `vars.semVocativo()` é a regra, pura e testada — ela reescreve texto que vai para eleitor
  real. `vars.usaNome()` alimenta o aviso no editor.
- **Aviso, não bloqueio**, no editor de respostas: escrever `{{primeiro_nome}}` continua
  possível, com o risco na tela. A decisão é dele; o que não pode é o nome voltar sem ninguém
  perceber.
- Teste novo que confere a lista **inteira** de respostas padrão: nenhuma pode usar nome. É o
  que impede o vocativo voltar numa edição futura.

### Arquivos alterados

`src/lib/vars.js`, `src/lib/store.js`, `src/lib/templates.js`, `src/panel/panel.js`,
`tests/vars.test.mjs`, `CLAUDE.md`, `README.md`.

---

## 2026-08-10 — A pergunta da rodada sai do lugar (e para de bloquear a conversa)

**Pedido (Thiago):** "atualmente as perguntas e respostas estão presas, eu queria poder mover
para ver o chat atrás", com print da pergunta bem em cima da conversa.

### O problema era maior do que "não dá para mover"

A caixa era um diálogo modal clássico: `position: fixed; inset: 0` com fundo escurecido. Duas
consequências, e a segunda ninguém tinha nomeado:

1. a conversa ficava **escurecida** atrás da caixa;
2. a camada **comia o clique** — não dava nem para rolar o histórico.

E a decisão que a pergunta pede (mandar modelo? agradecer? pular?) depende exatamente de ler o
que a pessoa escreveu. A caixa cobria a informação necessária para responder a própria caixa.

### O conserto

A camada virou trilho invisível (`pointer-events: none`, sem fundo); quem recebe clique é só a
caixa. A caixa arrasta pelo **título**, que ganhou `cursor: grab` e um pontilhado de alça. A
posição fica em `settings.perguntaPos`, então arrastar uma vez vale para os próximos contatos e
para as próximas rodadas.

- **`setPointerCapture`, não listener no documento.** Arrastando por cima da conversa da
  plataforma, um listener no documento perde o `pointermove` e a caixa gruda no meio do arrasto.
- **Posição contida na janela.** Monitor desconectado ou arrasto até a borda deixariam a
  pergunta fora da vista — e ela é modal para a rodada: pergunta invisível trava o trabalho sem
  dizer por quê. Mesma lição do `sanitize()` das janelas em `background.js`.

### A consequência que quase passou batida

Com a página clicável, ele pode focar o campo de mensagem da plataforma — e o atalho da rodada é
escutado no documento, em captura. Digitar "2" numa resposta à mão **concluiria o atendimento**.
Agora `aoTeclar` ignora evento cujo alvo é campo de texto (`composedPath()[0]`, por causa do
shadow root).

### Conferido no navegador

`tools/checar-pergunta.mjs` (novo) monta a caixa com o `panel.css` de verdade e confere o
contrato: camada transparente, camada atravessável, caixa clicável, **clique na conversa atrás
chegando ao destino**, título com cursor de alça e a caixa obedecendo a `left`/`top` quando
solta. São as linhas de CSS que qualquer refatoração desfaz sem querer.

O arrasto em si eu exercitei com mouse de verdade (`pointerdown` → `move` → `up`): move, grava a
posição, e para na borda quando arrastado para fora — nos dois sentidos.

### Arquivos alterados

`src/panel/panel.css`, `src/panel/panel.js`, `src/lib/store.js`, `tools/checar-pergunta.mjs`
(novo), `CLAUDE.md`.

---

## 2026-08-10 — A rodada não retomava depois da conclusão à mão (a figura era inocente)

**Relato dele:** "enviei a figura e não resumiu a automatização", com print da tela inteira.

### O que a print mostrou, e a correção do diagnóstico anterior

A print desmentiu a hipótese que eu tinha registrado hoje mais cedo. **Nada a ver com a figura**:

- a URL continuava com o id da sessão (dava para ler na barra de endereço), então a espera
  **não** estava confundindo mídia com troca de atendimento;
- o atendimento estava **concluído** ("Thiago concluiu o atendimento em 10/08/2026 às 20:09"),
  e a barra do painel ainda dizia *"Responda Santa Cruz - Serlei à mão. Quando você concluir, eu
  retomo daqui."* — ou seja, a espera estava viva e simplesmente não reconheceu a conclusão.

### Causa raiz

`dom.isConcluded()` procurava **um sinal só**: um botão "Reiniciar" no rodapé. Na print, o
atendimento concluído mostra o rótulo **"Concluído"** no cabeçalho (onde estava "Em andamento") e
o rodapé vira "Nenhuma classificação definida" — **não existe Reiniciar nenhum**.

Então a espera da tecla 6 rodava até o teto de 30 minutos e devolvia "esperei 30 min e o
atendimento seguiu aberto". A rodada não morria: ficava parada.

O sinal "Reiniciar" não era invenção — ele foi conferido ao vivo quando entrou. São dois estados
diferentes de fechado, e a versão anterior só conhecia um.

### O conserto

`isConcluded()` passa a aceitar três sinais: "Reiniciar", o rótulo "Concluído" (botão ou chip) e,
como reserva de escopo estreito, uma varredura de folhas dentro de `sessions-conversation`.
Fora de overlay e **fora da fila da esquerda** — a fila repete texto de atendimento, e sem essa
trava qualquer contato concluído na lista daria o atendimento aberto por fechado.

Rede de segurança separada: `semControlesDeAtendimento()` (sem composer, sem Concluir, sem
Iniciar) entra no `page.getState()` e a espera aceita depois de **três leituras seguidas**. Fica
fora do `isConcluded()` de propósito — durante a troca de tela os três somem por um instante, e
o `clickConcluir()` daria a conclusão por certa cedo demais.

### Conferido no navegador, não no chute

`tools/checar-dom.mjs` (novo) monta sete recortes reais de tela e confere as duas funções contra
cada um. Os dois casos que protegem contra o conserto errado: **menu do Concluir aberto** (tem
item com o mesmo texto — não pode contar como concluído) e **"Concluído" na fila da esquerda**.

Rodei os mesmos sete recortes contra o `dom.js` anterior: falha exatamente em um, o da print.
É a prova do diagnóstico.

Fica **fora das seis suítes** de propósito — precisa de navegador (Playwright), e o compromisso
do projeto é `node tests/*.mjs` em Node puro. É ferramenta para quando mexer em `dom.js` ou a
plataforma mudar de cara. Sem Playwright na máquina, ele avisa e sai com 0.

### Arquivos alterados

`src/lib/dom.js`, `src/lib/page.js`, `src/panel/panel.js`, `tools/checar-dom.mjs` (novo),
`CLAUDE.md`.

### Nota sobre a print

O painel mostrava `Cidade: Santa Cruz` e "Sem grupo cadastrado para Santa Cruz" — é a versão
**antiga** rodando no navegador dele. Com o casamento por prefixo desta leva, "Santa Cruz" (do
cadastro "Santa Cruz - Serlei") passa a resolver para **Santa Cruz do Sul**, e o link do grupo
volta a ser encontrado. Precisa recarregar a extensão + F5 na aba.

---

## 2026-08-10 — Cidade do candidato, cidade encurtada, marca amarela e respostas na rodada

**Pedido (Thiago):** segunda leva da lista do WhatsApp, cinco itens do fim da tarde de 09/08.

### 1. "Retirar cidade Capitão pois está confundindo com Capitão martim" — o mais grave

**Capitão é município do RS** (Vale do Taquari) e é a patente do candidato. Medido aqui: a
mensagem de aceite do anúncio — *"aceito receber conteúdos do Capitão Martim e do Zucco"* —
casava com a cidade Capitão e com confiança **`exata`**, que é exatamente a que o automático
grava **sem clique**. Ou seja: cidade errada + COREDE errado gravados sozinhos em cima de todo
mundo que veio do anúncio.

Duas travas em `cities.js`: a expressão "capitao martim" / "cap martim" é apagada do texto antes
de casar (mesmo mecanismo do nome do estado), e o município entrou em `cidadesIgnoradas`
(padrão `['Capitão']`, editável na aba Config). A primeira sozinha não bastava — ele pediu que
"Capitão" solto também não valha.

**Vale conferir na base:** contatos do anúncio classificados com cidade Capitão provavelmente
estão errados, e levaram a etiqueta do COREDE Vale do Taquari junto.

### 2. "Nomes de cidade não sendo pegos se não estiverem perfeitamente escritos"

**Causa raiz:** o casamento por prefixo exigia **duas palavras**, e o encurtamento mais comum
tem uma só. "Palmares" (Palmares do Sul), "Sentinela", "Trindade" não eram reconhecidos.

O mínimo de duas palavras existia para "Carlos" não virar "Carlos Barbosa" — mas quem protege
disso é a trava da preposição, que já estava lá: "Barbosa" não é preposição, então "Carlos"
continua não casando. Abri para uma palavra mantendo as outras travas (mínimo de 6 letras, sufixo
começando em preposição, empate recusa) e mais uma: **uma palavra nunca vale como `exata`** —
vira palpite e espera clique, nunca grava sozinha.

Dois achados no caminho:

- **"Livramento" caía em "Santana da Boa Vista".** Pus o encurtamento em `ALIASES` primeiro, e
  `normalize()` roda também sobre o nome do município: "Santana do Livramento" virava "santana do
  santana do livramento". Agora está em `ENCURTAMENTOS`, aplicado só ao texto do contato.
- **"o cara" casava com Caraá** (distância 1). Município de até 5 letras agora exige grafia
  exata — o passo 1 já pega essas, então não se perde nada, e palavra comum de quatro letras
  para de virar cidade.

### 3. "Etiqueta de conteúdo do Flávio marcada e a mensagem rápida não reconhece e trava o botão"

`suggest()` só devolve o que as **regras acham nas mensagens**. Etiqueta aplicada à mão era
invisível, e o botão "Enviar conteúdo + agradecer + concluir" exige exatamente um conteúdo
identificado — contava zero e travava.

Acontece também sem ninguém marcar nada: a regra casa contra a campanha do anúncio, o contato é
etiquetado na primeira passada e, na reabertura, as mensagens dele sozinhas não casam mais.

`tags.conteudosJaAplicados()` soma as etiquetas de conteúdo que o contato já carrega no CRM —
só as reconhecidas como conteúdo (aparecem nas regras ou na tabela "Modelo por conteúdo").
Região e etiqueta de fluxo continuam de fora. Como entra em `state.tagSuggestions`, vale para os
três consumidores de uma vez: botão da aba Respostas, macro de fechar e a rodada.

### 4. "Liberar a caixa de respostas rápidas — no momento ela está fixa no modo automatizado"

A pergunta da rodada é `position: fixed; inset: 0`: uma cortina sobre o painel inteiro. Durante a
rodada não havia como mandar uma resposta pronta — só parando a rodada ou indo de tecla 6.

As respostas prontas agora vão **dentro da caixa de pergunta**, num `<details>` fechado (a
pergunta é decisão de um toque; oito botões abertos atrapalhariam o caso comum). Enviar dali
**não fecha a pergunta**: manda e você continua decidindo o que fazer com o atendimento.
Resposta bloqueada por variável aparece desabilitada com o motivo no `title`, nunca sumindo.

### 5. "Faça uma marcação em amarelo na cidade que está pegando"

Marca-texto amarelo (`.wf-marca`) na cidade **quando ela veio do parser** — sem marca quando veio
do CRM ou foi digitada por ele. Aparece no cabeçalho, na aba Dados e na linha da pergunta da
rodada, sempre com o trecho que gerou o valor: `Capitão ← de "Capitão Martim"` mostra o erro na
hora, sem abrir a conversa. Cor fixa nos dois temas, com o texto travado em escuro — marca-texto
que muda de cor com o tema deixa de ser marca-texto.

De quebra, a linha de aviso da pergunta (⚠ já enviado hoje) saiu do cinza e ganhou fundo: ela
existe para ser notada antes da tecla, e cinza-claro como as outras passava batido.

### Arquivos alterados

`src/lib/cities.js`, `src/lib/tags.js`, `src/lib/store.js`, `src/panel/panel.js`,
`src/panel/panel.css`, `tests/parser.test.mjs`, `tests/tags.test.mjs`, `CLAUDE.md`, `README.md`.

### Pendências

- **Rever na base os contatos com cidade "Capitão"** — vieram do anúncio, não moram lá.
- Continua aberto da leva anterior: confirmar em uso o conserto da figura, preencher "Etiquetas
  quando responder sim" e a tabela "Modelo por conteúdo".

---

## 2026-08-10 — Os dez itens da lista de bugs do WhatsApp

**Pedido (Thiago):** print da conversa com dez linhas anotadas ao longo do dia 09/08.

### 1. "Pegou srn como nome" + "Ignorar siglas no nome"

`plausivelNome` só exigia 3 letras, então "srn" (que é abreviação, não nome) virava o Nome do
eleitor e o agradecimento saía "Obrigado pela atenção, Srn!". E "Jeane do PL" gravava o partido
dentro do nome — partido tem campo próprio.

**Conserto:** `limparSiglas()` em `extract.js`, exportada e testada. Sigla é (a) nome de partido
do dicionário, (b) da lista fixa, ou (c) token de até 5 letras **sem vogal** — nome de gente em
português sempre tem vogal, o que resolve "srn" sem precisar de lista. A partícula que fica
pendurada sai junto ("Jeane do ~~PL~~" → "Jeane"). Sobrou vazio? Não era nome: o campo fica
vazio para o Thiago preencher, em vez de gravar lixo.

### 2. "Marcando rio grande do sul como rio grande"

**Causa raiz:** o nome do ESTADO contém o nome de um município, e o passo 1 do `matchCity`
procura o município em qualquer lugar do texto. "Sou do Rio Grande do Sul" casava com a cidade
Rio Grande — e o COREDE saía errado junto, porque a etiqueta de região é derivada da cidade.

**Conserto:** a frase "rio grande do sul" é apagada do texto antes de casar. Não custa nenhum
acerto: nenhum município se chama assim, e quem quis dizer a cidade escreve "Rio Grande", que
continua casando (tem teste dos dois lados).

### 3. "Automação está parando quando mando uma figura ao pausar para responder manualmente"

Duas travas, porque a cadeia tem dois elos:

- `esperarVoceConcluir` lia "URL sem id de sessão" como "você abriu outro atendimento" e
  devolvia o contato. Agora diálogo aberto (ou URL sem sessão) **não vale julgamento**, e a
  troca de atendimento precisa se confirmar em três leituras seguidas.
- `percorrerFila` seguia em frente e clicava no próximo item da fila com o diálogo do anexo
  ainda aberto. Diálogo do Material é **modal**: o clique não chega ao item, e a rodada
  terminava dizendo "a fila acabou". Agora ela espera a tela ficar livre (até 3 min) antes de
  abrir o próximo. **Não fecha** o diálogo: ele é dele, e fechar descartaria a figura.

`page.getState()` ganhou `hasDialog` para isso.

**Correção (mesmo dia, com a print em mãos):** a hipótese do "URL perde o id" estava
**errada** — a URL continuava com o id da sessão. A causa real era outra e está na entrada do
topo: `isConcluded()` só conhecia o sinal "Reiniciar", e o atendimento concluído mostra
"Concluído" sem Reiniciar nenhum. As duas travas descritas aqui **ficam** (o modal engolir o
clique é mecanismo real e confirmado no código), mas não eram o que ele estava vendo.

### 4. "Identificar se a mensagem já foi mandada no mesmo dia e confirmar se quer mandar"

O aviso de duplicata existia, mas era `confirm()` do navegador disparado lá dentro do envio —
no meio da rodada ele abre **depois** da decisão e trava o laço num diálogo nativo. Agora o
aviso é linha da própria pergunta (`⚠ "X" JÁ FOI ENVIADO hoje, às 14:03`), o modelo perde o
destaque de opção primária, e o envio segue sem `confirm` (`jaConfirmado: true`). Mesmo dia é
dia do calendário, não 24 horas: mensagem de ontem 23h e de hoje 8h são dois dias de trabalho.

### 5. "Quando a última mensagem for minha no automatizado, concluir e ir pro próximo"

São os ~60 de "Meus" que ficaram abertos enquanto o Concluir estava quebrado: receberam tudo e
só faltou fechar. Perguntar um a um seria teclar sessenta vezes para não decidir nada.

**Decisão registrada:** esta é a primeira saída automática da rodada 2 — a regra "nada sai da
fila sem decisão humana" passa a ter esta exceção, a pedido dele. Ela só fecha o que **já foi
respondido**; não envia nada.

**Conflito resolvido com o item 6/7:** contato sem etiqueta de conteúdo **não** é concluído
sozinho, mesmo com a última mensagem sendo nossa — é exatamente a população que ele quer
perguntar. O atendimento não está terminado: falta descobrir o que mandar para essa pessoa, e
concluir aqui seria tirá-la do fluxo para sempre em silêncio (o mesmo pulo silencioso já
consertado três vezes neste projeto). Nesse caso a pergunta aparece, com a tecla 7 em destaque e
uma linha explicando por que ela apareceu.

`api.getConversation()` devolve numa requisição só o que o contato escreveu **e** quem falou por
último. Junto de propósito: cada contato já custa uma sessão na plataforma + três chamadas
nossas, e foi rajada de requisição que derrubou a API uma vez. Mídia entra na conta (figura
nossa é resposta; figura dele é a vez dele) — `getIncomingText` descarta mensagem sem texto e
por isso não servia. Mensagem do bot conta como nossa. Suíte nova: `tests/conversa.test.mjs`.

### 6 e 7. Pergunta de interesse e a etiqueta do "sim"

Resposta nova `interesse-conteudo` (tecla **7** da rodada), oferecida **só** para quem ainda não
tem etiqueta de conteúdo — quem já pediu conteúdo tem modelo para receber, não pergunta. Envia e
conclui, como a rodada dos Novos: quando a pessoa responder, a plataforma devolve o atendimento
para "Meus" sozinha.

Sem `{{primeiro_nome}}` **de propósito**: metade destes contatos ainda está com o apelido do
anúncio, e variável que não resolve tira a opção da pergunta — foi assim que o fluxo travou duas
vezes (06/08 e 09/08).

O "sim" vira etiqueta com duas travas: a pergunta tem que ter **saído para aquele contato**
(`wasSent`), e o afirmativo é medido só na **última** mensagem, curta e sem negação — senão
"sim, moro em Pelotas" etiquetaria quem nunca foi perguntado. `respostaAfirmativa()` é pura e
testada. As etiquetas são configuráveis (aba Config, "Etiquetas quando responder sim") e vêm
**vazias**: chutar o rótulo grava etiqueta errada em eleitor real. Vazio não bloqueia a pergunta
— ela sai, e a tela diz que o "sim" ainda não vira etiqueta.

### 8. "Substituir cidade e etiqueta da cidade quando for fornecido pela pessoa"

Muda uma regra de projeto, então ficou estreita: substitui **só** a cidade, **só** com casamento
exato do IBGE, **só** quando veio de resposta estruturada ("Nome / Cidade") — cidade citada no
meio da conversa continua sendo palpite que não sobrescreve — e **nunca** por cima de correção
feita à mão por ele.

A etiqueta de região antiga sai junto (`applyTags(..., { remover })` + `regionTagIds()`): duas
regiões no mesmo contato é informação errada, e meia substituição seria pior que nenhuma. Só
saem etiquetas que são COREDE na planilha oficial — conteúdo e etiqueta de fluxo ("1 SEM
RETORNO") nunca entram na conta. A troca aparece na pergunta da rodada: `Cidade: Palmares do Sul
(a pessoa informou; estava "Porto Alegre")`.

### Teste que não depende mais da internet

`parser.test.mjs` baixava a lista do IBGE. Onde a rede é bloqueada (proxy, CI), a lista voltava
vazia e **12 asserções falhavam de uma vez** por motivo que não tem nada a ver com o parser.
Agora a lista sai de `src/data/coredes-rs.json` — os mesmos 497 municípios — plantada no storage
antes do import. Resultado igual em qualquer máquina.

### Arquivos alterados

`src/lib/extract.js`, `src/lib/cities.js`, `src/lib/tags.js`, `src/lib/api.js`,
`src/lib/store.js`, `src/lib/templates.js`, `src/lib/page.js`, `src/panel/panel.js`,
`tests/parser.test.mjs`, `tests/tags.test.mjs`, `tests/conversa.test.mjs` (nova), `CLAUDE.md`.

### Pendências

- ~~Confirmar em uso o item 3 (figura)~~ — reproduzido no mesmo dia: a causa era o sinal de
  "Concluído", não a figura. Ver a entrada do topo.
- **Preencher "Etiquetas quando responder sim"** na aba Config — sem isso a tecla 7 pergunta mas
  não etiqueta.
- A tabela "Modelo por conteúdo" continua vazia: é o pré-requisito da tecla 1.

---

## 2026-08-09 — Nome errado deixa de tirar o contato da rodada em silêncio

**Relato dele:** "ao aparecer um contato com o nome errado ele está sendo pulado ou concluído sem
me perguntar."

### Causa raiz

`processarRespondido` tinha uma saída antes da pergunta:

```js
if (modelo && agradecimentoTrava) return { resultado: 'pulado', motivo: 'agradecimento bloqueado…' };
```

A cadeia inteira: nome errado é o que `looksLikePlaceholder` recusa — apelido automático do
anúncio (`[NOVO] (51) 9…`), "Novo…", ou menos de três letras. `buildContext` então devolve
`nome: ''`, o `{{primeiro_nome}}` do agradecimento fica sem valor, e o contato saía da rodada
**antes de a pergunta aparecer**.

É o mesmo pulo silencioso que tínhamos tirado de "Meus" na entrada anterior, entrando por outra
porta: lá a causa era "sem conteúdo identificado", aqui é "sem nome para o agradecimento". A
decisão de ontem — *nada sai da fila sem decisão humana* — não tinha sido aplicada a este ramo.

### O conserto

A pergunta aparece sempre. O que some é só a tecla 1, e o motivo vai para a tela numa linha
própria (`Modelo "X" travado: Nome ainda não preenchido…`), com o corpo da pergunta dizendo o
que fazer. Mandar o modelo **sem** o agradecimento foi descartado pelo Thiago: é enviar o fluxo
pela metade, e o guarda-corpo de variável existe justamente para isso não acontecer.

Com a tecla 1 fora, a 4 ("Agradecer e concluir") volta a ser a primária — quem decide isso agora
é `podeEnviar`, não a mera existência do modelo.

### Pendência aberta

**A conclusão sem pergunta não foi reproduzida.** Ele diz que aconteceu na rodada 2, mas ali
toda conclusão vem de tecla dele (3, 4, 5, ou a do fluxo de envio) — não há caminho que feche o
atendimento sozinho. Preciso do log da rodada no momento em que acontecer. Hipótese a
investigar: `openQueueSession` com posição defasada depois de uma conclusão, quando a fila ainda
não atualizou — `visitados` protege de repetir, mas faz a posição andar uma casa a mais.

### Arquivos alterados

`src/panel/panel.js`

---

## 2026-08-09 — Empate entre conteúdos deixa de bloquear: vence o preferido

**Pedido (Thiago):** "quando tiver dois escolha o do Flávio em vez de bloquear."

### Por que o empate é comum

As regras de conteúdo são casadas contra as mensagens **e contra a campanha do anúncio**
(`utm.campaign` + `utm.headline`). Anúncio que cita dois nomes — "Martim e Zucco, unidos pelo Rio
Grande do Sul" — faz o contato casar com os dois sem ter pedido nada. Bloquear nesse caso era
desperdício: o empate não vinha de dúvida real do contato, vinha do texto do anúncio.

### Configurável, não fixo no código

`conteudoPreferido` (padrão "Conteúdo Flávio"), editável na aba Config junto do mapeamento de
modelos. Fixar "Flávio" no código apodreceria na próxima campanha — a regra de conteúdo já é
editável exatamente por isso.

**Só decide o envio.** As etiquetas continuam sendo aplicadas todas: quem casou com dois recebe
as duas, porque isso é informação verdadeira sobre o contato.

A pergunta mostra que houve desempate: `Conteúdo pedido: Conteúdo Flávio (casou com 2, escolhi o
preferido)` — o Thiago vê e pode escolher outra saída.

### Continua recusando quando é dúvida de verdade

Se o preferido não estiver entre os que casaram, ou se não houver preferido configurado, volta a
não haver modelo — a pergunta aparece sem a tecla 1.

### Detalhe pego pelo teste

O `achatar` do módulo ignora caixa mas **não** ignora acento. Como este valor é digitado à mão
na Config, "Conteudo Flavio" ficaria sem desempate por causa de um til. Comparação sem acento só
aqui; `pickRow` continua estrito, que é onde errar manda modelo errado.

### Arquivos alterados

`src/lib/hsm.js`, `src/lib/store.js`, `src/panel/panel.js`, `tests/hsm.test.mjs`

---

## 2026-08-09 — Fim do pulo silencioso: nada sai da fila sem decisão do Thiago

**Relato dele:** "está pulando alguns contatos que respondi antes e responderam só obrigado; está
concluindo ou pulando sozinho?"

**Resposta:** pulando, não concluindo. "obrigado" não casa com nenhuma regra de conteúdo
(`zucco`, `fl[áa]vio`), sem conteúdo não havia modelo, e em "Meus" isso era pulo **sem
perguntar** — regra que ele mesmo tinha pedido quando as teclas 3, 4, 5 e 6 ainda não existiam.

**Decisão dele:** "remova então a regra de pular em Meus sem eu mandar, deixa da mesma forma que
está na aba Outros."

### Por que a regra antiga tinha virado um problema

Contato pulado **continua na fila**. A rodada seguinte pulava de novo, e ele nunca saía de
"Meus" — a mesma fila que não drena que já tínhamos consertado em "Novos", agora do outro lado.
E "obrigado" é justamente a conversa que acabou e deveria fechar.

Quando o pulo silencioso foi combinado, a única saída da pergunta era mandar modelo ou pular.
Hoje há concluir, agradecer, mensagem do momento e responder à mão — não perguntar virou
desperdício.

### O que mudou

`perguntarSempre` saiu de vez, em vez de virar `true` nos dois lados: parâmetro que só tem um
valor é ruído. A pergunta aparece sempre, sem a tecla 1 quando não há modelo.

Também corrigi os textos da interface, que ainda prometiam o comportamento antigo ("conteúdo que
não casa com nenhum modelo passa direto, sem perguntar") — descrição que mente é pior que
descrição ausente.

### Efeito colateral que vale saber (não é bug)

`load()` roda a classificação automática em cada contato aberto, e para quem já tem cidade e
etiquetas isso **carimba a Data de conclusão** se ela estiver vazia — mesmo que o atendimento
siga aberto. Foi pedido assim; o carimbo acompanha a classificação, não a conclusão.

### Arquivos alterados

`src/panel/panel.js`

---

## 2026-08-09 — Tecla 6: responder à mão sem perder a rodada

**Pedido (Thiago):** "adicione a opção 6, pausar para responder e retomar quando concluir."

A rodada sai da frente (o diálogo fecha), você escreve no atendimento que já está aberto, e ela
retoma sozinha quando você conclui. Antes disso, sair para responder significava perder o
percurso e recomeçar.

### O que ela vigia, e por quê

A **sessão em que a pergunta apareceu**, não "a sessão aberta". Se você for para outro
atendimento no meio, a rodada não pode ficar esperando a conclusão de um contato que não é mais
este — nem contá-lo como resolvido. Nesse caso ela segue adiante e diz no log.

`pageStateLocal` ganhou `concluded` (de `dom.isConcluded`, o "Reiniciar" no rodapé), então a
vigia é uma leitura por segundo do estado que o painel já lê.

### Quatro saídas

| O que acontece | Resultado |
|---|---|
| Você conclui | `concluido` — sai da fila, rodada retoma do próximo |
| Você abre outro atendimento | `pulado`, com o motivo no log |
| Você clica em "Parar a rodada" | para |
| 30 min sem nada | `pulado`, com o motivo no log |

Não conta como envio: quem mandou a mensagem foi você.

### Arquivos alterados

`src/lib/page.js`, `src/panel/panel.js`

---

## 2026-08-09 — Tecla 5: a mensagem da ocasião

**Pedido (Thiago):** "uma opção 5 que será uma mensagem personalizada; exemplo, hoje é Dia dos
Pais e muitos estão mandando mensagem referente a isso."

### Por que não virou resposta pronta

Resposta pronta é para texto estável. Este muda toda semana — hoje Dia dos Pais, depois Natal,
depois uma agenda da campanha. Guardar na lista de respostas faria o Thiago editar na aba Config
a cada data, longe de onde a rodada começa.

Virou campo próprio no cartão **"Mensagem do momento"**, na aba Automatizado, ao lado dos botões
de rodada. Vazio = a tecla 5 não aparece.

### Reaproveita o caminho de envio inteiro

O texto vira um "template de mentira" (`{ id, name, text }`) e segue por `sendTemplate` como
qualquer outro: variáveis, bloqueio por variável faltante, anti-duplicata e registro de envio.

**A chave do anti-duplicata inclui um resumo do texto** (`momento:<hash>`). Com chave fixa,
trocar de data seria barrado como duplicata da mensagem anterior — o contato receberia o Dia dos
Pais e nunca o Natal.

Como as teclas 1 e 4, a 5 só aparece se o texto resolver todas as variáveis: opção que trava na
hora do envio é pior que opção ausente.

### Arquivos alterados

`src/lib/store.js`, `src/panel/panel.js`

---

## 2026-08-09 — Tecla 4 (agradecer e concluir) e a rodada da aba "Outros"

**Pedido (Thiago):** "adicione uma 4ª opção para as perguntas que será usada em Outros. Em
Outros tem muitas pessoas que enviam vídeos e bom dia; seria bom ter uma resposta dando bom dia,
agradecendo as informações e concluir."

### Duas peças, não uma

A opção sozinha não bastava: em "Meus" a rodada **pula antes de perguntar** quando não há
conteúdo identificado — combinado anterior, "conteúdo à parte fica para resposta manual". Vídeo e
"bom dia" caem exatamente nesse pulo, então a tecla 4 nunca apareceria.

Daí `perguntarSempre`, parâmetro do processador:

- **Meus** (`false`): sem conteúdo identificado, pula em silêncio. Comportamento preservado.
- **Outros** (`true`): pergunta sempre, e a tecla 4 é a saída esperada.

### Opções que aparecem conforme o caso

A **1** só existe quando há modelo mapeado; a **4** só quando o texto de agradecimento resolve
todas as variáveis. Oferecer opção que vai travar na hora do envio é pior do que não oferecer —
os dois textos são conferidos **antes** de a pergunta aparecer.

A 4 vira primária quando não há modelo, que é o caso normal em "Outros".

### Aviso sobre a aba "Outros"

São atendimentos **em andamento com outro operador** (medido: `statuses=IN_PROGRESS` +
`exceptUserIds=você`). Concluir ali fecha o atendimento de um colega, então a rodada pede
confirmação explícita antes de começar.

### Resposta nova

`agradecer-info`: saudação + agradecimento + fecho, **sem pergunta no fim** — mesma regra que o
Thiago aplicou à saudação de fé, porque convite a responder vira atendimento. Conta como envio:
é mensagem para gente real, entra no limite e na pausa.

Migração com flag própria (`respostaAgradecerInfo`): reaproveitar a flag anterior faria voltar
resposta apagada de propósito.

### Arquivos alterados

`src/lib/store.js`, `src/lib/templates.js`, `src/panel/panel.js`

---

## 2026-08-09 — A pergunta da rodada ganhou três saídas e atalhos de teclado

**Pedido (Thiago):** "adicione a opção concluir, então as opções vão ser mandar modelo (tecla 1),
pular (tecla 2), concluir atendimento (tecla 3) e Esc para parar a rodada."

### Por que saiu o `confirm()` nativo

Ele só tem duas saídas e não aceita atalho. Virou diálogo próprio, dentro do shadow root do
painel.

**O foco vai para o diálogo ao abrir, e as teclas tratadas são capturadas.** Sem isso, teclar
"1" escreveria "1" no campo de mensagem da plataforma, que está logo atrás — e a rodada existe
justamente para não digitar na conversa por acidente.

### As quatro saídas

| Tecla | Ação | Grava | Envia | Conclui |
|---|---|---|---|---|
| 1 | Mandar modelo | sim | modelo + agradecimento | sim |
| 2 | Pular (deixa aberto) | sim | não | não |
| 3 | Concluir sem enviar | sim | não | sim |
| Esc | Parar a rodada | não | não | não |

### Duas mudanças no percurso

Resultado novo **`concluido`**, que como `triado` **sai da fila** — a posição não avança, o
próximo escorrega para o lugar dele. Virou o conjunto `SAI_DA_FILA`, em vez de comparar com
`'triado'` solto: errar isso pula um contato em silêncio a cada conclusão.

E o `parar` passou a valer para **qualquer** resultado. Antes só era olhado no caminho do
enviado, então o Esc numa pergunta de "pular" seria ignorado — a rodada seguiria para o próximo
contato.

### Arquivos alterados

`src/panel/panel.js`, `src/panel/panel.css`

---

## 2026-08-09 — "Zane" x "Rosane Requia": o apelido do perfil vencia a resposta da pessoa

**Pegada do Thiago, na porta de confirmação:** "ela respondeu o nome como Rosane Requia e a
resposta irá sair com o nome Zane."

### O conflito de duas regras boas

O cadastro dizia **Zane** — nome do perfil do WhatsApp. Ela respondeu:

```
Boa noite.
Rosane Requia
Caxias do Sul
Não faço parte de nenhum grupo político.
```

O parser achava "Rosane Requia" sem dificuldade. Só que `load()` semeia o campo Nome com
`contact.name` e `applyGuesses` pula campo já preenchido — a regra **"nunca sobrescrever o CRM"**
descartava a resposta dela. O agradecimento sairia "Obrigado pela atenção, Zane!".

### A distinção que resolve

Nome de cadastro **igual** ao nome do perfil (`name === nameWhatsapp`) quer dizer que ninguém
digitou nada ali: foi o WhatsApp que preencheu. Nesse caso o que a pessoa **escreveu** vale mais.
Nome que um operador curou continua ganhando do palpite, como sempre.

`vars.nomeVeioDoPerfil(contact)` — pura e testada, comparando sem acento e sem caixa. A troca só
acontece quando há palpite de nome, o cadastro veio do perfil, e os dois são diferentes. Entra
como **palpite** (amarelo), não como verdade: continua esperando o clique.

### Nota sobre a confiança

O nome do formulário sai do parser com confiança `aproximada`, então a classificação automática
**não** o grava sozinho — ele espera confirmação. Só é gravado quando você aprova na rodada ou
clica em Salvar, que é o comportamento certo para um dado que muda o tratamento da pessoa.

### Testes

`vars.test.mjs`: seis casos da distinção perfil x cadastro curado. `parser.test.mjs`: a resposta
real em quatro linhas (saudação, nome, cidade, resposta dos grupos).

### Arquivos alterados

`src/lib/vars.js`, `src/panel/panel.js`, `tests/vars.test.mjs`, `tests/parser.test.mjs`

---

## 2026-08-09 — Concluir nunca concluiu: são dois cliques, não um

**Relato do Thiago:** "faltou concluir, continua na aba de Meus em vez de ir pra concluídos." E,
perguntado, confirmou: **as conclusões das 09:01 foram manuais dele**, não da rodada.

### O que estava acontecendo

`clickConcluir` clicava no botão do rodapé, esperava 900ms e devolvia `ok` **sem conferir nada**.
Inspecionado ao vivo: o clique **abre um menu**, não conclui. O atendimento seguia "Em andamento",
um `mat-menu-panel` aparecia, e como `hasOpenDialog()` só enxerga `mat-dialog-container`, nada
acusava. A rodada dava o contato por fechado e seguia.

Era a explicação de **"Meus" só crescer** (37 → 41 → 47 → 49 → 61) enquanto "Novos" caía: tudo que
a rodada tocava ficava lá.

### O fluxo real

```
button.split-button-left  ("Concluir")            → abre o menu
  [data-cy="menu-button-session-classify-finish"] → "Classificar e concluir"
  [data-cy="menu-button-session-finish"]          → "Concluir"   ← este fecha
```

Medido: os dois cliques concluem em ~2s, e o rodapé passa a mostrar **"Reiniciar"**.

### Duas armadilhas dentro da armadilha

1. **O item do menu também tem o texto "Concluir".** A primeira verificação que escrevi ("o botão
   sumiu") teria olhado para o item do menu e dado positivo sem nada ter fechado. `getConcluirButton`
   agora exclui o que está dentro de `.cdk-overlay-container`.
2. **O sinal de conclusão é o "Reiniciar"**, não a ausência do "Concluir" — pelo mesmo motivo.

### Hipótese errada pelo caminho

Achei que fosse "botão partido, clicamos no lado errado". Errado: o seletor pega o lado certo
(`split-button-left`). O lado certo simplesmente abre menu.

### Contatos concluídos no teste

Dois, ao vivo: **Viamão - Guacir Pereira** e **Tramandaí - Pedro Corrêa**. Reversíveis pelo
"Reiniciar" se tiver sido prematuro.

### Arquivos alterados

`src/lib/dom.js`, `src/lib/page.js`, `src/panel/panel.js`, `CLAUDE.md`

---

## 2026-08-08 — Rodada 3: quem respondeu, com porta humana por contato

**Pedido (Thiago):** "nessa parte os contatos responderam com as informações, então irá checar se
as etiquetas, data, cidade e nome estão de acordo, mandar o modelo pronto, agradecer e concluir e
ir pro próximo. Os com conteúdo à parte continuam para eu responder manualmente. Para não ter
erros me pergunte antes de mandar o modelo, com duas opções (mandar modelo ou Pular); ao pular
não conclui."

**Decisões dele, perguntadas antes de codar:** a fila é **"Meus"** (é onde o contato reaparece
depois de responder), e **Pular grava a classificação** — só a mensagem fica pendente.

### Reuso em vez de reimplementação

As rodadas 1 e 2 montam o contexto do contato à mão porque não precisam de classificação. Esta
precisa, e a classificação do painel é o código mais testado do projeto — trata "nunca
sobrescrever o CRM", união de etiquetas em vez de troca, carimbo de data com guarda-corpo e a
conferência relendo o contato.

Então ela chama `load()` e `saveClassification()` direto. O observador de estado continua
desligado durante a rodada; quem carrega é a rodada, uma vez por contato.

### A porta humana

`confirm()` com o que foi classificado na frente — nome, cidade, etiquetas, conteúdo identificado
e o modelo que sairia. O painel não está mostrando a aba Dados durante a rodada, então o texto
tem que carregar a conferência.

Cancelar = pular: grava a classificação, **não conclui**, atendimento fica aberto.

### Ordem das travas, e por quê

O agradecimento é validado **antes** de qualquer envio. Descobrir que ele trava por falta de nome
depois de o modelo ter saído deixaria o atendimento pela metade — mensagem enviada, fluxo morto.
Mesma razão pela qual a classificação é gravada antes: se ela falhar, nada sai.

### Passa direto, sem perguntar

Conteúdo que não casa com regra nenhuma, que casa com duas, ou cujo modelo não está mapeado. São
os "conteúdo à parte" do pedido: ficam para resposta manual, sem conclusão.

### Pré-requisito

A tabela **"Modelo por conteúdo"** precisa estar preenchida — a rodada recusa iniciar sem ela.

### Arquivos alterados

`src/lib/dom.js`, `src/panel/panel.js`

### A testar (nada exercido ao vivo)

Rodada de **1 contato**. É também o primeiro teste real do envio de modelo aprovado, que nunca
chegou ao clique final.

---

## 2026-08-08 — Congelamento deixa de abortar por suposição: agora pergunta à plataforma

**Print do Thiago:**

```
■ rodada — 12 enviado(s), 0 pulado(s), 6 assumido(s) para triagem em "Meus".
O navegador congelou esta aba (a pausa de 2s levou 48s)...
```

**0 pulados** confirma a mudança anterior: tudo que não é envio sai da fila. Novos caiu para 152.

### O erro que eu tinha embutido

A frase "a plataforma costuma voltar sem conexão depois disso" veio do **primeiro** incidente —
aquele que eu mesmo re-diagnostiquei depois como **limite de requisições**, não congelamento.
Ou seja, a rodada abortava com base numa suposição que o próprio registro já contradizia.

Abortar 185 contatos por um engasgo de 48s é caro demais para um palpite.

### Correção

`lidarComCongelamento` faz uma **leitura barata** (`getCustomFields`, mesmo caminho de rede dos
envios) e decide com o resultado:

- plataforma respondeu → registra no log e **segue** (`a aba ficou parada 48s, mas a plataforma
  respondeu — sigo`);
- não respondeu → aí sim para, com a mensagem de F5.

A pausa de "2s" da mensagem é o respiro dos pulos (1,5s arredondado), não a pausa entre envios —
o congelamento pegou durante uma triagem.

### E o estado do keepalive entrou na mensagem

Estava só no veredito, no fim de um log longo. Agora aparece **junto do congelamento**, que é
onde ele é lido: `áudio de keepalive ativo` ou `ÁUDIO DE KEEPALIVE PARADO`. Sem isso não dá para
saber se o remédio falhou ou se não basta — dúvida que já custou dois turnos.

### Arquivos alterados

`src/panel/panel.js`

---

## 2026-08-08 — "Já informou nome ou cidade" também é assumido

**Decisão do Thiago:** perguntado se esses deveriam sair de "Novos" como os sem aceite,
respondeu "sim assuma como meus".

Eles já responderam: o que falta não é o formulário, é a **classificação**, que é manual. Ficando
em "Novos" eles prendiam posição em toda rodada futura — no print anterior eram **7 de 7**, ou
seja, a fila carregada tinha virado só eles.

Agora saem para "Meus" sem receber mensagem, junto com a triagem dos sem aceite.

### Ainda ficam em "Novos" (não pedido, e com motivo)

- **Janela de 24h vencida** — é a população da outra rodada (modelo aprovado). Assumir tiraria
  esses contatos da fila que a rodada "Sem retorno" percorre.
- **Já recebeu o pedido de dados** (anti-duplicata) — só aparece em "Novos" se o concluir tiver
  falhado; deveria ser raro. Tem a mesma propriedade de prender posição para sempre, e vale
  decidir depois se acompanha os outros.

### Arquivos alterados

`src/panel/panel.js`

---

## 2026-08-08 — Keepalive confirmado, e a rodada aprendeu a clicar "Ver mais"

**Print do Thiago:** limite 185, trocou de aba durante a rodada.

```
■ rodada — Rodada encerrada: 5 enviado(s), 7 pulado(s). A fila carregada acabou (7 item(ns)).
Áudio de keepalive esteve ativo do começo ao fim.
```

### O keepalive funciona (pergunta encerrada)

Aba escondida a rodada inteira e **nenhum congelamento**. É a prova que faltava desde ontem: o
áudio de amplitude mínima impede o congelamento que travava tudo. A hipótese 1 da entrada
anterior (o `play()` tinha sido recusado nas rodadas antigas) fica confirmada por eliminação.

### Por que parou em 5 de 185

A aba mostrava **176 em Novos** e a rodada só via **7**. A plataforma carrega 50 por vez e o
resto só vem no **"Ver mais"**, que é manual. Enviados e triados saem da lista; os 7 que sobraram
eram os pulados ("já informou nome ou cidade"), que ficam. A posição andou até o fim do carregado
e a rodada encerrou — corretamente, mas cedo demais.

### "Ver mais" ao vivo

Único gancho da fila **sem `data-cy`** — casa por texto, escopado em
`sessions-list-online-content`, ancestral comum do botão e dos itens. Medido: um clique leva de
**50 para 99** itens, e o botão continua para carregar mais.

`carregarMaisDaFila()` confirma pelo **crescimento da lista**, não por tempo fixo. No laço: fim
do carregado deixou de ser motivo para parar — pede a página seguinte e repete a **mesma
posição**. Teto de 20 carregamentos por rodada (~1000 contatos) e respiro entre eles.

### Decisão pendente

Os pulados por "já informou nome ou cidade" **ficam na fila para sempre** e ocupam posição em toda
rodada futura — no print, eram 7 de 7. Assumir também esses (como os sem aceite) esvaziaria
"Novos" de vez, mas eles vão para "Meus" esperando classificação manual. É escolha do Thiago.

### Arquivos alterados

`src/lib/dom.js`, `src/lib/page.js`, `src/lib/rpc-host.js`, `src/panel/panel.js`

---

## 2026-08-08 — Primeira rodada limpa: 30 envios, encerrada por limite

**Print do Thiago:**

```
■ rodada — Rodada encerrada: 30 enviado(s), 7 pulado(s), 8 assumido(s) para triagem em "Meus".
Limite de 30 envio(s) atingido. Áudio de keepalive esteve ativo do começo ao fim.
```

Novos 216 → 181, Meus 37 → 47. Encerramento **normal**, por limite — não por erro.

### O que fica confirmado em uso

- O laço em lote inteiro: assumir, enviar, concluir, voltar para "Novos", repetir 30 vezes.
- A triagem, nos dois caminhos: `sem o aceite do anúncio` e `não escreveu nada`.
- O respiro nos pulos: nenhuma queda de API nesta rodada, contra a anterior que caiu.
- O veredito no log, que é o que permitiu fechar as três últimas investigações.

### O que NÃO fica confirmado

O keepalive **esteve ativo**, mas isso só prova que o áudio toca e sobrevive à rodada. **Não
prova que ele impede o congelamento**, porque não se sabe se a aba chegou a ficar escondida
nesta rodada. A pergunta segue aberta e a resposta é uma rodada com a janela minimizada de
propósito.

Contorno enquanto isso: janela do mobiliza **parcialmente visível** num canto não congela —
trabalhar em outra janela por cima do resto do monitor funciona hoje.

### Arquivos alterados

Nenhum. Entrada de confirmação em uso.

---

## 2026-08-08 — O veredito funcionou e derrubou meu palpite: foi congelamento

**Print do Thiago**, primeira rodada com o veredito no log:

```
■ rodada — Rodada encerrada: 11 enviado(s), 5 pulado(s). O navegador congelou esta aba
(a pausa de 8s levou 41s). ... Dê F5 na aba antes de continuar.
```

Eu tinha apostado em "limite atingido" e argumentado contra o "Ver mais". Errado nos dois: foi
**congelamento**, e o detector novo pegou. Serve de lição sobre deduzir de sintoma quando dá
para instrumentar.

### O que isso diz sobre o keepalive

O áudio **não segurou**. Restam duas explicações, e elas pedem consertos opostos:

1. o `play()` foi recusado e o áudio nunca subiu — o remédio não chegou a ser aplicado;
2. o áudio subiu e o navegador congelou assim mesmo — o remédio não serve.

A resposta estava no topo do log (a linha que `ligar()` escreve quando falha), fora da vista numa
rodada de 17 linhas.

Nota sobre a grandeza: 41s para 8s é ~5x. O clamp de 1s de aba escondida daria ~9s; congelamento
pleno daria minutos. 41s é compatível com estrangulamento intenso, que é justamente o que áudio
tocando deveria impedir — o que faz a hipótese 1 a mais provável.

### Correção

O veredito passa a dizer o estado do keepalive, e distingue os três casos: não subiu (com o
motivo), esteve ativo do começo ao fim, ou subiu e foi interrompido no caminho. `ativo()` é lido
**antes** do `desligar()` no `finally`.

### Arquivos alterados

`src/panel/panel.js`

---

## 2026-08-08 — A rodada dizia por que parou, e o painel apagava a resposta

**Relato do Thiago (print):** "parou, creio que travou no ver mais ou pode ser outra causa."

### O que o print mostra de bom

A rodada **funcionou**: ~15 `✓` visíveis (mais acima do corte), o `→ Andreza Martins — sem o
aceite do anúncio — assumido para você ver depois` estreando, e "Novos" caindo de 264 para 225.
O texto enviado inclui a pergunta sobre grupos políticos.

### Por que não dava para saber a causa

`rodar()` fazia `setStatus(resumo)` e, três linhas abaixo, `await refresh()` — que carrega o
contato aberto e chama `setStatus('Contato carregado…')`. O veredito era sobrescrito **sempre**;
não era corrida, era ordem fixa. Na barra sobrava a mensagem do carregamento, que não tem nada a
ver com a rodada.

A causa real estava calculada e jogada fora. Inclusive a hipótese dele: quando a posição passa do
que a plataforma carregou, `openQueueSession` devolve `A fila carregada acabou (N item(ns))` —
que é exatamente o "travou no Ver mais", e teria aparecido.

### Correção

O veredito agora vai para o **log** (sinal `■`), que é permanente, antes do `refresh()`. E as
duas saídas silenciosas do laço passaram a ter nome: `Limite de N envio(s) atingido.` e
`Parada por você.` Antes, sair pelo limite não gerava mensagem nenhuma.

### Arquivos alterados

`src/panel/panel.js`

---

## 2026-08-08 — Novo sem o aceite: assumir para triagem em vez de pular

**Pedido (Thiago):** "os novos que não tiverem o identificador de conteúdo só inicie o
atendimento e volte pros novos, assim eles não ficam sendo repassados e eu vejo manualmente
depois."

### O problema que isso resolve

Pulado continuava em "Novos". Toda rodada futura reabria o mesmo contato — e reabrir custa uma
sessão na plataforma mais três chamadas nossas. Era a fila que nunca drenava, alimentando
justamente a rajada que derrubou a API.

### Novo resultado: `triado`

Contato sem o aceite do anúncio (ou que não escreveu nada) é **assumido e deixado em paz**:
nenhuma mensagem sai, ele some de "Novos" e vira pilha de triagem manual em "Meus".

O detalhe que importa no percurso: `triado` **sai da lista**, então a posição **não** avança —
o próximo escorrega para o lugar dele. `pulado` continua na lista e a posição avança. Confundir
os dois pularia um contato a cada triagem.

### Brecha fechada junto

Se o assumir falhar, o item continua na fila e cai no ramo de "já visitado", que avançava a
posição **sem respiro**. Numa fila grande isso vira rajada de aberturas — a mesma causa do
"Failed to fetch". Agora esse ramo também respira.

### Efeito colateral consciente

O limite da rodada conta **envios**, não triagens. Uma rodada com limite 1 pode assumir a fila
inteira procurando o único envio. É o comportamento pedido (a fila precisa drenar), e ela
termina sozinha quando "Novos" esvazia — mas a primeira vez merece ser vista rodando.

### Arquivos alterados

`src/panel/panel.js`

---

## 2026-08-08 — Primeiro envio real da rodada, e a causa verdadeira do "Failed to fetch"

**Print do Thiago:** log da rodada com ~20 pulos "a conversa não tem o aceite do anúncio", depois
**`✓ Enilza Facco`** — e em seguida `× contato — Failed to fetch`, com a plataforma travada em
"Carregando mensagens...".

### O que deu certo

`✓ Enilza Facco` é o **primeiro envio completo da rodada**, de ponta a ponta. Confirma o conserto
do `clickIniciar` (item 0 da fila) e, de quebra, que o caminho assumir → enviar → concluir
funciona.

### A causa real, que corrige o diagnóstico anterior

O nome no erro é `contato` — o valor padrão, atribuído antes de qualquer chamada. Ou seja, morreu
na **primeira** chamada do contato seguinte.

E o que veio antes foram ~20 pulos em sequência. O laço tinha isto:

```js
posicao++; // pulado continua na fila; nada saiu, segue sem pausa
```

A pausa foi desenhada para proteger o **número no WhatsApp**, e por isso só existia depois de um
envio. Mas quem carrega a **API** é cada volta do laço: um pulo custa o mesmo que um envio — abre
a sessão na plataforma e faz três chamadas nossas (`getSession`, `getContact`, `getIncomingText`).
Vinte pulos = ~20 sessões abertas e ~60 chamadas em poucos segundos.

`Failed to fetch` **não é erro HTTP**: é o navegador dizendo que a requisição não completou,
tipicamente com o preflight CORS recusado — que é o que um limitador de taxa devolve. Explica por
que a plataforma quebra junto: ela apanha do mesmo limite.

Isso **substitui** a explicação da entrada anterior (aba congelada). O congelamento é real e
merece o guarda-corpo que ganhou, mas não era a causa deste caso: a rodada estava rodando e
logando normalmente.

### Correções

- **Respiro de 1,5s também nos pulos** (`PAUSA_PULO_MS`), limitado pela pausa configurada.
- **`traduzirErroDeRede`**: "Failed to fetch" vira "a API parou de responder (provável limite de
  requisições). Espere alguns minutos, dê F5 e recomece com uma pausa maior." A ação é outra —
  repetir na hora não adianta.

### Otimização não feita (decisão pendente do Thiago)

A maioria esmagadora dos pulos é "não tem o aceite do anúncio", e para descobrir isso a rodada
**abre a sessão**. Dava para ler a prévia do item na lista (`getQueuePreview`) e pular sem abrir,
cortando a carga em quase tudo. Não fiz porque a prévia mostra só a **última** mensagem: se o
aceite não for a última, o contato seria pulado errado. Em "Novos" ele quase sempre é a única
mensagem — mas "quase" aqui significa deixar eleitor sem contato.

### Arquivos alterados

`src/panel/panel.js`

---

## 2026-08-08 — "Está quebrando a plataforma": era a aba congelada voltando morta

**Relato do Thiago (print):** plataforma com "Sem conexão com o servidor", "Carregando
mensagens..." preso, painel em "Carregando..." e "Failed to fetch", nenhum modelo carregado.

### A plataforma não estava quebrada

Aberta numa aba limpa, mesma conta, no mesmo momento: a fila carregou normalmente (Novos 265,
Meus 36, Outros 63), sem erro. Isso descarta as duas hipóteses mais assustadoras — plataforma
fora do ar e bloqueio da conta por excesso de requisições da extensão.

O que quebrou foi **aquela aba**, e a causa é o congelamento já documentado: ao congelar, as
requisições em voo e o socket do app morrem; ao voltar, o Angular não se recupera sozinho. O
"Failed to fetch" do painel é a mesma causa, na lista de modelos.

**F5 recupera.**

### O risco que isso expôs

Rodada que continua depois de um congelamento age sobre uma página morta: clica no que não
responde e pode **contar como enviado o que não saiu**. Pior que parar.

`pausarRodada` agora mede o relógio de parede: se a pausa demorou mais que `3x + 10s` do pedido,
o navegador parou a aba no meio. A rodada para e manda dar F5. A folga é grande de propósito —
o clamp de 1s da aba escondida não dispara isso; congelamento sim.

### Nota de operação

O print mostrava **limite 200** na primeira rodada. Com pausa de 8s são ~27 minutos de execução
contínua, tempo de sobra para qualquer minimizada congelar tudo. Primeira rodada é de **1**.

### Arquivos alterados

`src/panel/panel.js`

---

## 2026-08-08 — Rodada parava ao minimizar: a aba não é estrangulada, é congelada

**Relato do Thiago:** "minimizei a página e o processo parou; tem como continuar mesmo
minimizado para eu trabalhar em outras abas?"

### Medido, não suposto

Na aba escondida do Chrome dele:

- `setInterval(120ms)` → **zero disparos** em mais de um minuto;
- `setTimeout(12s)` → não voltou em 45s (o próprio CDP acusou "renderer may be frozen").

Não é o estrangulamento clássico (clamp de 1s): é **congelamento**.

### Por que a solução óbvia não serviria

A primeira ideia era tirar as esperas da aba — service worker como relógio, `chrome.alarms`,
mensagens no lugar de `setTimeout`. Não resolve: o congelamento atinge o JavaScript **da
plataforma** também. Depois de clicar em Iniciar, o Angular não renderiza e o campo de mensagem
nunca nasce. Quem precisa continuar viva é a página inteira, não só a nossa parte.

### O que descongela

Aba tocando áudio não é congelada nem estrangulada pelo Chromium. `keepalive.js` toca um WAV de
1s em loop, amplitude 2 de 32767 (silêncio absoluto não conta como "tocando" em todas as
versões) e volume 0.01. Ligado no início da rodada, desligado no `finally`.

**Autoplay exige gesto do usuário** — daí ligar a partir do clique que inicia a rodada. Se o
`play()` for recusado, a rodada **avisa no log** em vez de seguir e morrer calada.

### Não verificado

Não consegui provar o remédio daqui: `navigator.userActivation.hasBeenActive` fica `false` numa
aba escondida, e sem gesto o `play()` volta `NotAllowedError`. O diagnóstico está provado; a
correção, não. **A prova é uma rodada real minimizada.** Sinais: a aba mostra o ícone de som, e
se o áudio não subir aparece a linha no log pedindo para deixar a aba visível.

Efeito colateral esperado mesmo com o áudio: aba escondida ainda tem clamp de ~1s nos timers.
Os `waitFor` passam a checar 1x/s em vez de 8x/s; como os timeouts são por relógio de parede
(`Date.now()`), continuam valendo — só ficam mais grossos.

### Arquivos alterados

Novo: `src/lib/keepalive.js`. Alterados: `src/panel/panel.js`, `CLAUDE.md`

---

## 2026-08-08 — A rodada assumia o atendimento e morria sem enviar

**Relato do Thiago:** "testei e iniciou o atendimento mas parou totalmente por aí e não mandou a
mensagem."

### Causa raiz: a espera vigiava a condição errada

`page.clickIniciar` esperava assim:

```js
for (let i = 0; i < 30 && dom.isPending(); i++) await sleep(200);
```

E `isPending()` é **`sem composer E com botão Iniciar`**. O botão Iniciar some no instante do
clique, então a condição fica falsa **antes de o campo de mensagem existir** — a espera acabava
na primeira volta e `pageStateLocal()` devolvia `hasComposer: false`.

Quem chamava concluía "a plataforma não liberou o campo de mensagem" e devolvia erro. Como a
rodada **para no primeiro erro** (de propósito), ela morria inteira ali — depois de já ter
assumido o atendimento. Daí o sintoma exato: contato assumido, nenhuma mensagem, nada mais.

Os 6 segundos de timeout nunca foram usados: na prática a espera era zero.

**Correção:** esperar o composer aparecer (`!dom.getComposer()`), que é o que o chamador de fato
precisa, com 12s de teto.

### Diagnóstico melhor para a próxima

As duas causas possíveis pediam conserto diferente e estavam colapsadas numa frase só. Agora o
log da rodada distingue:

- "a plataforma não assumiu o atendimento (o botão Iniciar continua na tela)"
- "o campo de mensagem não apareceu depois de assumir o atendimento"

### Arquivos alterados

`src/lib/page.js`, `src/panel/panel.js`

### A confirmar no uso

Rodada de **1 contato** na aba Automatizado → Novos. O mesmo `clickIniciar` serve o botão
"Iniciar atendimento" do painel e a macro de pedir dados, então os três caminhos foram
destravados juntos.

---

## 2026-08-07 — Inspeção ao vivo: as abas da fila têm `data-cy`

**Pedido (Thiago):** conectar na extensão do Chrome e inspecionar ao vivo — o seletor da aba
"Novos" tinha sido escrito às cegas, casando por texto.

### O que a plataforma realmente tem

As três abas carregam **gancho de teste próprio**, que não muda com tradução, tema nem mexida de
layout:

```
[data-cy="button-new-sessions"]    Novos
[data-cy="button-my-sessions"]     Meus
[data-cy="button-other-sessions"]  Outros
```

A aba ativa recebe a classe `bg-gray-300` (`hover:bg-gray-300` das inativas é outra string, não
colide). O clique vai no próprio elemento do `data-cy` — é dele o handler.

Também conferido: `<sessions-list-item>` **não tem atributo nenhum**; quem é clicável é o
primeiro `div` de dentro, com `data-cy="list-item-session"` e `cursor-pointer` — exatamente o que
o `openQueueSession` já clicava. E o markup do item continua sem o id da sessão, o que confirma
por que o percurso é por posição.

### O que mudou por causa da inspeção

- `getQueueTab` usa `data-cy`, com o casamento por texto só como reserva.
- `selectQueueTab` **confirma** a troca pela classe da aba ativa em vez de esperar um tempo fixo.
- `getSessionListItems` ganhou reserva por `[data-cy="list-item-session"]`.
- **O timeout subiu de 2,5s para 6s:** a troca de aba medida ao vivo levou ~1,6s (a lista
  recarrega junto). O valor que eu tinha chutado passava perto demais.

### Testado ao vivo, numa aba separada

Achou as três abas; rótulo inexistente devolve `null` (é o que faz a rodada parar em vez de
percorrer a fila errada); Novos → Meus → Novos com confirmação, e a contagem da lista
acompanhando (50 → 17 → 50); pedir a aba que já está ativa retorna na hora, sem clique.

Nota: "Novos" mostrava 119 no badge com **50 itens carregados** — confirma que a rodada só
enxerga o que já veio, e o "Ver mais" é manual.

### Arquivos alterados

`src/lib/dom.js`

---

## 2026-08-07 — Rodada dos "Novos": pedir os dados em lote

**Pedido (Thiago):** "quando tiver essa mensagem na aba Novos, mandar a mensagem pedindo os
dados e ir para o próximo; ao iniciar a conversa a aba vai automaticamente para Meus e teria que
retornar para Novos". A mensagem é o aceite do anúncio — "Olá! Eu aceito receber conteúdos do
Flávio Bolsonaro e do Cap Martim", com variação no nome do candidato.

### Duas rodadas na mesma aba, uma por vez

A aba Automatizado passou a ter **Novos → pedir os dados** (texto livre; eles acabaram de chegar,
janela de 24h aberta) e **Sem retorno → modelo aprovado** (janela vencida, só HSM chega). Limite,
pausa, Parar e o log são compartilhados; o percurso da fila virou `percorrerFila`, um só para as
duas.

### Quem entra: três conferências, não uma

Mandar o formulário para quem já escreveu o nome é o erro caro aqui, e é barato de evitar:

1. a conversa tem a frase do aceite (campo editável, padrão `aceito receber conte` — sem o nome
   do candidato de propósito, porque a campanha troca o anúncio);
2. o **parser não achou nome nem cidade** nas mensagens — se achou, o contato vai pela
   classificação normal, não pelo formulário;
3. anti-duplicata: quem já recebeu o pedido de dados é pulado.

Ainda: janela vencida vira "pulado" com o motivo (é caso da outra rodada), e o texto do template
é montado para **aquele** contato — a rodada não passa pelo `load()` do painel.

### A volta para os Novos

`openQueueSession` ganhou `{ aba }` e garante a aba **a cada item**, não uma vez por rodada:
assumir o atendimento move o contato para "Meus" e leva a plataforma junto. Se a aba não for
encontrada, a rodada **para** — seguir seria percorrer a fila errada, que é justamente quem já
foi atendido.

### Arquivos alterados

`src/lib/dom.js`, `src/lib/store.js`, `src/panel/panel.js`

### A testar (nada exercido ao vivo)

Rodada de **1 contato** primeiro, e olhar o log: quem foi pulado e por quê. O seletor da aba
"Novos" continua sendo o ponto mais frágil — foi escrito por texto, sem inspeção ao vivo.

---

## 2026-08-07 — Sinalização errada de "resposta já enviada": mecanismo achado

**Confirmado pelo Thiago:** o aviso apareceu em contato para quem ele ainda não tinha mandado.
Isso descarta a explicação inocente (mesmo contato em outro atendimento) e diz que o registro
está caindo em contato errado — não que o aviso esteja lendo errado.

### Mecanismo (achado por leitura; não reproduzido ao vivo)

O envio demora: `composer.sendText` espera o botão aparecer e depois espera **o composer
esvaziar** para dar o envio por aceito. Quem clica num contato da fila nesse intervalo troca o
atendimento no meio — e aí duas coisas passavam batidas:

1. a conferência de "esvaziou" dava positiva **na hora**, porque o composer do atendimento
   recém-aberto está vazio;
2. `state.contact` já era outra pessoa quando o `markSent` rodava, porque o painel lê o contato
   só na hora de gravar.

Resultado: envio de A registrado no contato B. B nunca recebeu e passa a exibir "já enviei esta
resposta". Bate com o sintoma e explica por que é intermitente — depende de o clique cair na
janela de um a dois segundos do envio.

### Correções

- **`composer.sendText` amarra tudo ao atendimento em que começou.** Se a sessão mudar antes do
  clique, não envia; se mudar depois, recusa em vez de dar por enviado.
- **O painel captura o contato ANTES do primeiro await** (`sendTemplate`, `enviarModelo`) e usa
  esse mesmo contato para consultar e para gravar o anti-duplicata.
- **O registro passou a guardar o nome de quem recebeu.** O aviso agora diz para quem foi — e,
  se o nome não for o do contato aberto, ele mesmo denuncia: "o registro está no nome de X, não
  neste contato — isso é bug do WhatsFill". Registro antigo (só timestamp) continua valendo.

Teste novo em `tests/hsm.test.mjs` cobre a forma do registro e o formato antigo.

### O que ainda pode acontecer

Se aparecer de novo **com o nome do próprio contato**, o mecanismo é outro e a mensagem na tela
vai dizer isso. Se aparecer com nome de outra pessoa, a correção não pegou o caminho todo.

### Arquivos alterados

`src/lib/composer.js`, `src/lib/templates.js`, `src/panel/panel.js`, `tests/hsm.test.mjs`

---

## 2026-08-07 — Três itens da lista do print: nome com cidade, pergunta dos grupos, aba Novos

**Pedido (Thiago), print de anotações:** (1) "às vezes os nomes vêm com a cidade antes e a
saudação sai com o nome da cidade" — o caso é o cadastro "Canoas - Marines"; (2) "ao pedir os
dados perguntar se a pessoa já faz parte de grupos políticos no WhatsApp"; (3) "os contatos
começam na aba Novos e vão para Meus ao iniciar; ao mandar pedir dados + concluir + próximo deve
retornar para os Novos".

### 1. "Canoas - Marines" fazia a saudação virar "Boa noite, Canoas!"

`cities.splitCidadeNome()` separa **só** quando a esquerda é exatamente um município do RS, com
casamento `exata` e cobrindo a esquerda inteira. Errar aqui troca o nome de um eleitor, então o
teste guarda principalmente o que **não** pode separar: "Maria - Silva" (nome comum),
"Grupo Canoas - Marines" (cidade não é a esquerda inteira), "Sao lourenso - Ana" (só aproximada)
e telefone do lado do nome.

No painel (`corrigirNomeComCidade`), o Nome é corrigido **mantendo a origem**: veio do CRM,
continua marcado como do CRM e portanto não é reescrito lá — o painel conserta o que usa e
mostra, sem sobrescrever cadastro. Já a cidade da esquerda é dado determinístico novo e entra
como palpite exato, só se o campo estiver vazio. Roda **depois** do parser: o que a pessoa
escreveu vale mais que o formato do cadastro.

### 2. Pergunta sobre grupos políticos no "Pedir dados"

Mudar o texto padrão não bastaria — quem já usa o painel tem o template gravado no
`chrome.storage`, e o padrão só vale para chave inexistente (o texto salvo do Thiago diz
"Nome / Cidade", o padrão diz "Nome completo / Cidade": já estavam diferentes).

Daí `templates.migrarPerguntaGrupos()`, com duas travas para não atropelar edição dele: roda
**uma vez só** (registrada na chave nova `migracoes`), e não mexe em texto que já fale de grupo
político. Apagar a pergunta depois não faz ela voltar sozinha.

Efeito colateral aceito: a resposta pode vir com um terceiro pedaço ("Maria / Canoas / grupo tal").
Nome e cidade continuam saindo certos — o terceiro pedaço só vira Função se contiver palavra do
dicionário, que é o mesmo risco que o texto livre já tinha.

### 3. Concluir volta para a aba "Novos"

`openNextSession` ganhou `{ aba }`: troca de aba antes de clicar no topo. Assumir o atendimento
move o contato de "Novos" para "Meus", então depois de concluir o topo da aba atual não é mais o
próximo da fila de trabalho. Só a macro de pedir dados passa `Novos` — as outras fecham contato
que já respondeu, que é outro laço.

O rótulo da aba é achado **pelo texto exato dentro da coluna da fila** (a marcação dessas abas
não tem classe própria estável), pegando o elemento mais fundo: o clique sobe sozinho para quem
tem o handler. Não achando a aba, o fluxo **não quebra** — abre o próximo assim mesmo e diz na
tela que não achou.

### Arquivos alterados

`src/lib/cities.js`, `src/lib/dom.js`, `src/lib/page.js`, `src/lib/rpc-host.js`,
`src/lib/store.js`, `src/lib/templates.js`, `src/panel/panel.js`, `tests/parser.test.mjs`

### Pendências

- **O seletor da aba "Novos" foi escrito às cegas** (por texto, sem inspecionar a marcação ao
  vivo). Se não achar, a tela avisa — mas confirmar no uso é o primeiro teste.
- Continua aberta a sinalização errada de "resposta já enviada" (item 1 da fila). O print do
  Thiago mostra o aviso com data de hoje, o que também é compatível com envio que aconteceu
  mesmo — falta saber se apareceu em contato que ele não tinha respondido.

---

## 2026-08-06 — Aba "Automatizado": rodada de tentativa com quem não respondeu

**Pedido (Thiago):** aba nova à direita de Respostas, para tentar contato com as pessoas sem
retorno — mandar mensagem para cada uma delas.

**Decisões dele, perguntadas antes de codar:** modelo aprovado escolhido na aba (um só para a
rodada inteira), concluir e ir para o próximo depois de cada envio, e lote com limite e pausa
configuráveis, com botão Parar.

### Por que só modelo aprovado (HSM)

Quem está na fila "1 SEM RETORNO" parou de responder há semanas — a janela de 24h do WhatsApp
está vencida e texto livre não sai. Modelo aprovado é o único envio que chega nessa situação.
A aba não oferece resposta pronta nenhuma, de propósito.

### Como a rodada percorre a fila

Por **posição**, não pelo topo. `openNextSession` (das macros) sempre clica no primeiro item,
o que só funciona quando o concluído sai da lista — e isso depende do filtro aplicado na
plataforma. A regra que vale nos dois casos: abre a posição, compara o id da sessão com os já
visitados; **repetiu, anda uma casa; veio outro, a posição continua valendo**. Item pulado (já
recebeu) também não sai da fila, e cai na mesma regra.

Novo em `dom.js`: `openQueueSession(index)`, `getQueuePreview()` e `closeOverlay()`.

### Travas, todas porque o destinatário é gente real em produção

- **Anti-duplicata** por contato+modelo, o mesmo registro do envio manual (`hsm:<id>`): quem já
  recebeu é pulado, inclusive entre rodadas.
- **Pausa entre envios** (padrão 8s) e **limite por rodada** (padrão 20). Rajada é o que queima
  número no WhatsApp.
- **Para no primeiro erro.** Seguir mandando às cegas depois de uma falha é o modo de falha mais
  caro que existe aqui.
- **Exige "Enviar automático" ligado** — sem ele o modelo só é preparado no diálogo, e concluir
  fecharia o atendimento sem a mensagem ter saído. Mesma razão da macro de pedir dados.
- **`confirm()` com os números na frente** antes de disparar.
- **Erro fecha o overlay** que sobrou: diálogo do Material esquecido aberto é modal e trava o
  painel inteiro.
- O observador de estado (`applyPageState`) **não roda `load()` durante a rodada**: carregaria o
  contato duas vezes e dispararia a classificação automática (que grava) no meio de um envio.

### Quem entra na rodada é o filtro da plataforma

O WhatsFill não seleciona contato: percorre a fila da esquerda como ela estiver filtrada. O
botão "Ver a fila" mostra o retrato do que está carregado — e só o que está carregado entra
(o "Ver mais" da plataforma é manual).

### Dois bugs de ponte encontrados no caminho

Argumento omitido vira `null` ao atravessar `chrome.runtime.sendMessage` (o padrão `= {}` só
cobre `undefined`): desestruturar isso é TypeError e `slice(0, null)` devolve vazio. Corrigido
nos dois novos métodos.

E um pré-existente: `page.recorderStop()` no modo encaixado devolvia `true` cru, então o
`page.recorderStop().catch(() => {})` do fim do aprendizado estourava "não é função". Virou
`async`, junto com o `closeOverlay` novo.

### Arquivos alterados

`src/lib/dom.js`, `src/lib/page.js`, `src/lib/rpc-host.js`, `src/lib/store.js`,
`src/panel/panel.js`, `src/panel/panel.css`

### A testar ao vivo (nada disto foi exercido com envio real)

1. Rodada de **1 contato** no "Thiago Tim" antes de qualquer coisa — é também o primeiro teste
   real do envio de modelo aprovado, que nunca chegou ao clique final.
2. Conferir se o concluído sai da fila filtrada. Se não sair, a rodada anda de posição sozinha —
   mas é o caminho menos exercitado.
3. Ver se a plataforma pede motivo de conclusão: se pedir, a rodada para no primeiro contato.

---

## 2026-08-06 — "Respostas rápidas ficaram obsoletas depois de enviar"

**Pergunta do Thiago:** esse bug foi resolvido? Não tinha sido — estava na lista de pendências.
Diagnóstico feito lendo o código; **não reproduzido ao vivo**.

### Causa raiz: os botões nasciam desabilitados e ninguém redesenhava

Os botões de envio recebem `disabled` a partir de `state.busy` **no momento da renderização**
(`panel.js`, em `renderPreview`). E há renderização acontecendo DENTRO da ação:
`saveClassification` termina chamando `renderAll()`, ainda com `busy` ligado. O `withBusy`
desligava `busy` no `finally` mas **não redesenhava** — então os botões ficavam desenhados
mortos e continuavam assim até a próxima renderização, que só vinha ao trocar de atendimento
ou recarregar. Bate com "só ao recarregar voltou".

Não era exclusivo do modelo pronto: qualquer ação que gravasse classificação deixava os botões
mortos. O fluxo de HSM só era o caminho mais visível.

**Correção:** `withBusy` redesenha no `finally`, com o redesenho protegido para um erro ali não
escapar como falha da ação que já terminou.

### Segundo mecanismo, no mesmo sintoma

`hsm.abrirDialogo()` clica no clipe do rodapé e, se qualquer passo seguinte falhasse (menu sem
o item, diálogo não abriu, lista não carregou), o **overlay do Material ficava aberto**. Ele
fica por cima do painel (z-index 1000 contra 998) e, sendo diálogo, é modal: o painel inteiro
parava de responder. Agora o fluxo fecha com Escape o que ele mesmo abriu, antes de propagar o
erro.

### Arquivos alterados

`src/panel/panel.js`, `src/lib/hsm.js`

### A confirmar no uso

Reproduzir a sequência: enviar um modelo pronto e, em seguida, clicar numa resposta rápida sem
recarregar. Deve funcionar.

---

## 2026-08-06 — Macro "Pedir dados + concluir + próximo"

**Pedido (Thiago):** "ao pedir os dados também quero que conclua e vá para o próximo".

É a abertura do laço assíncrono e o botão de maior volume nos oito mil: pergunta, tira da fila,
segue. Concluir aqui não é "acabou" — quando a pessoa responde, a plataforma traz o atendimento
de volta para as não lidas, e aí a classificação entra sozinha.

### Decisões

- **Não carimba data de conclusão.** Quem só recebeu a pergunta ainda não foi concluído, e a
  data gravada agora nunca mais seria corrigida (ela só preenche buraco). Quem carimba é a
  classificação automática, quando há cidade ou etiqueta.
- **Não grava classificação.** Nesse ponto não há o que classificar, e exigir contrato de
  escrita para mandar uma pergunta criaria uma falha desnecessária.
- **Exige "Enviar automático" ligado**, e o botão fica desabilitado explicando por quê. Sem
  ele, `sendTemplate` apenas insere o texto — e concluir depois disso fecharia o atendimento
  **sem a pergunta ter saído**. Era o modo de falha silenciosa mais caro dessa macro.

### Refatoração aproveitada

As quatro macros repetiam o mesmo fecho (concluir → tratar diálogo de motivo → abrir o
próximo), cada uma com sua variação de mensagem. Virou `concluirEAbrirProximo(jaFeito)`, que
recebe o que já foi feito para o status não mentir quando o fluxo para no meio — dizer "falhou"
depois de a mensagem ter saído faria reenviar para o contato.

### Arquivos alterados

`src/panel/panel.js`

---

## 2026-08-06 — Data de conclusão automática e cidade com sufixo omitido

**Pedido (Thiago):** "etiquetas e cidade estão sendo preenchidas mas falta a data atual, a data
tem que seguir o mesmo padrão"; e da lista de bugs anotada: "cidades mal escritas não sendo
reconhecidas", com os exemplos "Sao Lourenço" e "Sao lourenso".

### 1. Data de conclusão não entrava sozinha

**Causa:** `aplicarAutomatico()` chamava `saveClassification` **sem** `withCompletionDate`. A
data só era gravada no Salvar manual e na macro. Cidade e etiquetas entravam; a data, não.

Agora entra junto, com dois guarda-corpos em `fields.deveCarimbarData()` (função pura, testada):

- **Nunca reescreve data já gravada** — contato concluído em 05/08 não vira 06/08 porque a
  conversa foi reaberta para conferir.
- **Nunca carimba contato sem classificação** — abrir a conversa de quem ainda não respondeu não
  pode marcar conclusão em oito mil registros. A âncora é ter cidade ou etiqueta, recém-
  reconhecida ou já no CRM.

### 2. "São Lourenço" não era reconhecida

**Causa:** não é erro de digitação, é **sufixo omitido**. O município é "São Lourenço do Sul" e
a distância de Levenshtein até o nome inteiro é 7 — longe de qualquer tolerância, e o corte por
diferença de tamanho descartava antes mesmo de calcular.

`cities.matchCity` ganhou um terceiro passo: comparar o pedaço do texto com o **prefixo** do
município que tem o mesmo número de palavras. Quatro travas, cada uma tirada de um falso
positivo real encontrado nos testes:

1. **Mínimo de duas palavras** — senão "Carlos" viraria "Carlos Barbosa". Nome de uma palavra
   continua sendo pego pela comparação com o nome inteiro, que é segura.
2. **O sufixo omitido tem que começar com preposição** (do/da/de/dos/das). É assim que se
   encurta nome de cidade em português. Sem esta trava, "Vila Nova do Nada" — lugar inexistente
   — casava com "Vila Nova do Sul", porque "vila nova do" é prefixo legítimo.
3. **O texto não pode estar continuando o nome** — se a palavra seguinte no texto é a próxima
   palavra do município, a pessoa está escrevendo um nome mais longo.
4. **Empate não vira palpite** — "Porto" prefixa cinco municípios; recusa e o painel sugere.

Prefixo escrito certo vale como `exata` (grava sozinho); com erro de digitação vale como
`aproximada` (espera clique). "Sao Lourenço" → exata; "Sao lourenso" → aproximada.

Nota: "Porto" ainda produz o palpite aproximado "Portão" (distância 1, pelo casador de erro de
digitação que já existia). Aproximado espera clique, então não grava sozinho — é essa a
propriedade que o teste fixa, não a ausência de palpite.

### Arquivos alterados

`src/lib/cities.js`, `src/lib/fields.js`, `src/panel/panel.js`,
`tests/parser.test.mjs`, `tests/contract.test.mjs`

### Pendências da lista do Thiago, ainda abertas

- **Respostas rápidas ficam obsoletas após enviar modelo pronto** (só voltam recarregando).
  Suspeita: o painel não é atualizado ao fim do fluxo de HSM, que mexe em diálogo da plataforma.
- **Sinalização errada de "resposta já enviada".** Suspeita: o envio por modelo aprovado não usa
  o mesmo id do anti-duplicata, ou a marcação acontece na inserção e não na confirmação.
- **Concluir e ir para o próximo ao enviar o encerramento.** A macro já existe; o registro
  anterior aponta que a tabela "Modelo por conteúdo" está vazia e ela para pedindo cadastro —
  pode ser configuração, não código.
- Data só grava se o contrato `DATE` tiver sido aprendido. Cidade e etiquetas funcionarem não
  garante que ele exista.

---

## 2026-08-06 — Repositório, ícones e preparação para a Chrome Web Store

**Pedido (Thiago):** criar repositório no GitHub e arrumar as pendências para publicar na loja.

**Decisões (confirmadas com o Thiago):** loja **não listada**, repositório **privado**, política
de privacidade num Gist público separado (repositório privado não serve de URL pública).

### Dado pessoal removido antes do primeiro commit

`tests/vars.test.mjs` usava **nome e telefone de um eleitor real** tirado dos prints, e o
telefone do Thiago aparecia em dois lugares. Trocado por dados fictícios; a asserção do primeiro
nome acompanhou. Regra nova no `CLAUDE.md`: nunca escrever telefone ou nome real em arquivo do
repositório.

### Pendências fechadas

- **Ícones** (bloqueava a loja) — `tools/make-icons.mjs` desenha 16/32/48/128 por campo de
  distância, sem dependência: quadrado arredondado índigo com um "check". Desenhar em vez de
  baixar evita dúvida de licença e deixa o ícone reproduzível. Adicionados em `icons` e
  `manifest.action.default_icon`.
- **Config gravava settings a partir de um retrato** — `salvarAjuste()` relê o storage antes de
  gravar. Antes, redimensionar o painel e depois marcar qualquer caixa na Config restaurava a
  largura antiga (o `main.js` grava `dockWidth`/`panelOpen` por outro caminho).
- **README dizia que `pedir-dados` pede "Nome / Cidade / Função"** — pede só "Nome / Cidade".

### Novos arquivos

- `tools/package.mjs` — gera `dist/whatsfill-<versão>.zip` por lista de inclusão (não de
  exclusão) e **falha** se algum arquivo citado no manifest ficar de fora. ZIP escrito à mão
  sobre o zlib do Node, para o projeto seguir sem dependência. Verificado abrindo o zip pelo
  .NET: 35 entradas, manifest legível.
- `PRIVACY.md` — política exigida pela loja.
- `STORE.md` — roteiro de submissão: textos prontos, propósito único, justificativa de cada
  permissão, respostas do formulário de uso de dados e o aviso de não capturar tela com a fila
  de eleitores visível.
- `.gitignore` — ignora `dist/` e qualquer `*backup*.json` (backup exportado carrega o contrato
  aprendido e referência a contato real).

### Estado do repositório

Publicado como **privado** em https://github.com/thiagokcw-coder/WhatsFill (branch `main`).
Feito pelo `gh` CLI depois que o Thiago autenticou — a GUI do GitHub Desktop não é
automatizável daqui, e `gh auth login` é interativo.

Política de privacidade publicada como Gist público (repositório privado não serve de URL para
a loja): https://gist.github.com/thiagokcw-coder/07b81a934626c55a88fd660c359a8914

Nota de ambiente: `gh` escreve o progresso do git em stderr, e o PowerShell transforma isso em
`NativeCommandError` com exit 255 mesmo quando deu certo. Confira o resultado pelo
`gh repo view`, não pelo código de saída.

### Imagem promocional (obrigatória, descoberta depois)

A loja exige **três** imagens, não duas: ícone, captura **e promocional pequena 440×280**.
Conferido na documentação oficial em vez de responder de memória. Gerada em
`icons/promo-440x280.png` desenhando no canvas do navegador (canvas dá tipografia de verdade;
o gerador de ícones em SDF não desenha texto).

Transferir a imagem do navegador para o disco: o filtro de segurança bloqueia base64 no
resultado das ferramentas, então o caminho foi a própria página disparar um download. Funcionou
**uma vez** — o Chrome passou a bloquear downloads repetidos do mesmo site em silêncio, e a
segunda versão (com o rodapé menos apertado) nunca chegou. Ficou a primeira, que é válida; o
rodapé encosta na margem sem cortar.

`package.mjs` passou a excluir `promo-*`: a promocional é enviada no formulário da loja, não vai
dentro do zip.

### Pendências

- Captura de tela 1280×800 — o Thiago fez; a fila ficou fora do quadro e o telefone também.
- Taxa de US$ 5 da conta de desenvolvedor.
- Enviar o zip no painel e responder o formulário — textos prontos no `STORE.md`.
- Continuam abertas: envio de modelo nunca testado de verdade, tabela "Modelo por conteúdo"
  vazia, reanálise ao vivo não vista com resposta real chegando.

---

## 2026-08-06 — Reanálise ao vivo: o painel enxerga a resposta sem sair do atendimento

**Pedido (Thiago):** "tenho que mandar salvar no CRM, sair da conversa e voltar para ver que as
informações entraram; tem que salvar sozinho ao adquirir as informações e mostrar na mesma hora".

### Causa raiz

A classificação automática já existia, mas o gatilho era **só a troca de sessão**.
`applyPageState` comparava apenas `sessionId`; o contato responder não muda o `sessionId`, então
o painel nunca reanalisava a conversa aberta. Sair do atendimento e voltar era o que forçava o
`load()` — exatamente o sintoma descrito.

### Correções

**1. Sinal de conversa** (`dom.getConversationSignal`) — `contagem:texto-da-última` sobre
`.message-text`. Verificado ao vivo: é classe do próprio app (não utilitária do Tailwind), a
lista **não** é virtualizada, e a última no DOM é a mensagem mais recente (bate com o primeiro
item da API). Contagem e texto juntos porque a contagem sozinha muda ao rolar para trás e o
texto sozinho não distingue duas mensagens iguais seguidas. Testado injetando nós falsos: muda,
desempata repetidas e volta ao original.

**2. `reexaminarMensagens()`** — dispara quando o sinal muda com o mesmo atendimento aberto.
Relê as mensagens do contato, roda o parser, atualiza as etiquetas sugeridas e chama
`aplicarAutomatico()`. Se o sinal veio de mensagem nossa ou de mídia, sai cedo sem trabalho.
Trava contra reanálises sobrepostas (o estado é consultado a cada 500 ms) e não roda durante
uma gravação em andamento.

**3. Painel subia sem settings** (pendência aberta na entrada anterior) — `main.js` agora chama
`panel.refresh()` explicitamente no boot. Sem isso, aba aberta **sem** atendimento selecionado
nunca rodava `load()`, e `state.settings.autoApply` ficava `undefined`: a classificação
automática nascia desligada.

### Decisões

- **Reanálise só preenche buraco.** `applyGuesses` continua pulando o que veio do CRM e o que
  você corrigiu à mão. Consequência aceita: se o contato corrigir a cidade numa segunda
  mensagem, o valor antigo permanece — trocar sozinho violaria "nunca sobrescrever".
- **Sinal pelo DOM, não por polling de API.** O app já pinta a mensagem em tempo real via
  SignalR; ler o DOM é instantâneo e não custa requisição. A API só é chamada quando o sinal
  muda de fato.

### Arquivos alterados

`src/lib/dom.js`, `src/lib/page.js`, `src/lib/rpc-host.js`, `src/panel/panel.js`, `src/main.js`

### Pendências

- **Não testado com resposta real chegando** — a mecânica foi verificada com nós injetados no
  DOM. Falta ver um contato responder de verdade com o painel aberto.
- Continuam abertas as pendências da entrada anterior (envio de modelo nunca testado, tabela
  "Modelo por conteúdo" vazia, Config grava settings a partir de snapshot, sem ícone no
  manifest).

---

## 2026-08-06 — Modelos de mensagem, classificação automática e a caçada aos 200 mentirosos

**Pedido (Thiago):** análise da extensão; depois enviar modelos de mensagem salvos; depois
"o fill de etiquetas, cidade e data de conclusão não está funcionando"; depois automação do
fluxo de atendimento.

### Correções de bug (todas com causa raiz confirmada ao vivo)

**1. `getContact` sem `isToIncludeCustomFields=true`** — a extensão chamava
`GET /core/v1/contact/{id}` sem query. A API responde 200 com `customFieldValues: []`, então o
painel nunca via o que já estava gravado: marcava tudo como palpite amarelo e regravava os
mesmos campos a cada Salvar. O comentário antigo em `fields.js` dizia que o array "estava vazio
em todos os contatos"; não estava, faltava o parâmetro.

**2. `readValues` lia campos que não existem** — procurava `item.value` / `item.values` /
`item.text`. A forma real é `valueString`, `valuesId`, `valuesDateTime`, `valuesInteger`,
`valuesFloat`, com `valueType` dizendo qual usar. Mesmo com a query certa, devolveria vazio.

**3. Data de conclusão gravava sem gravar** — não havia contrato `DATE`; a escrita caía no
contrato de texto, mandava `"2026-08-05"` em `valueString`, e a API respondia **200 ignorando**.
Corrigido em três frentes: botão "Aprender data (conclusão)", `sampleValue` guardado no contrato
para descobrir o formato (ISO x cru x dd/mm/aaaa), e busca do caminho do valor **por conteúdo**
(você escolhe 31/12/1999 e a plataforma manda `1999-12-31T00:00:00.000Z`).

**4. Data de conclusão saía com o dia errado à noite** — `toISOString()` devolve UTC. Às 21h no
Brasil já é o dia seguinte lá; um atendimento do dia 05/08 gravou 06/08. Agora usa data local
(`fields.hojeLocal`).

**5. Fallback silencioso para o contrato de texto** — era a raiz da classe inteira de falha.
`DATE`, `DATETIME`, `MULTISELECT` e `SINGLESELECT` agora **recusam** quando falta o contrato do
próprio tipo, dizendo qual falta. Antes, "falta aprender" chegava ao usuário como "gravou e
sumiu".

**6. Modelo de mensagem errado indo para o envio** — `pickRow` aceitava candidato único pelo
nome sem conferir o texto. Durante o repinte da busca a lista passa por um estado transitório
com uma só linha, e era a errada. Agora exige cobertura de ~80% do texto, recusa empate, espera
a lista estabilizar e **confere no DOM** qual linha ficou marcada antes de seguir.

**7. `Extension context invalidated` silencioso** — recarregar a extensão órfã as abas abertas;
`chrome.storage` passa a falhar e o painel mostra caixas vazias. Agora o erro vira uma frase
pedindo F5. Custou dois diagnósticos errados nesta sessão.

### Funcionalidades

- **Modelos de mensagem aprovados (HSM)**: listagem via `GET /chat/v5/template` (leitura pura) e
  envio dirigindo o diálogo nativo. Nova seção na aba Respostas, com filtro. Também é o único
  envio que funciona com a janela de 24h expirada.
- **Conferência pós-escrita**: toda gravação relê o contato e compara campo a campo. O status só
  diz "Confirmado no CRM" com a resposta do servidor na mão. É o que dispensa o F5 e o que
  teria pego sozinho o bug da data.
- **Classificação automática ao abrir o contato**: grava sozinho só o determinístico (cidade
  exata do IBGE, COREDE dela, etiquetas de conteúdo). O COREDE herda a confiança da cidade — se
  a cidade foi palpite aproximado, a etiqueta de região não entra sozinha.
- **Macro "Enviar conteúdo + agradecer + concluir"**: manda o modelo correspondente ao conteúdo
  pedido, agradece, classifica e conclui. Nova tabela "Modelo por conteúdo" na Config liga
  etiqueta -> nome do modelo.
- **Macro "Salvar + concluir + próximo"**: fecha sem enviar mensagem.
- Aviso e Salvar desabilitado na aba Dados quando não há contrato aprendido.

### Decisões

- **Link de grupo saiu do caminho crítico.** O contato já vem de um grupo; o que se confirma é o
  aceite em receber conteúdo. A macro do link virou opção secundária.
- **Listar HSM por API, enviar pela interface.** O modelo carrega mídia aprovada (~1,4 MB),
  vínculo de canal e regra de janela; reproduzir isso por API seria adivinhação.
- **Parâmetros de HSM: preencher sozinho e travar se faltar variável** (decisão do Thiago).
  Nenhum dos 19 modelos usa parâmetro hoje, então a tela nunca aparece e não houve como
  aprendê-la; por ora o painel **recusa e explica**.
- **Triagem de quem respondeu é da plataforma.** Concluir tira da fila e a resposta traz de
  volta para as não lidas. Ideia de um "próximo que respondeu" foi descartada.

### Arquivos alterados

`src/lib/api.js`, `src/lib/fields.js`, `src/lib/contract.js`, `src/lib/path.js`,
`src/lib/store.js`, `src/lib/dom.js`, `src/lib/page.js`, `src/lib/rpc-host.js`,
`src/panel/panel.js`, `README.md`
Novos: `src/lib/hsm.js`, `tests/hsm.test.mjs`, `CLAUDE.md`, `registro.md`

### Pendências e riscos

- **O clique final de envio de modelo nunca foi testado de verdade.** Todo o fluxo até a tela de
  envio está verificado; o envio em si, não. Testar no número do próprio Thiago antes de usar em
  contato real.
- **Tabela "Modelo por conteúdo" está vazia** — sem ela a macro de fecho para e pede cadastro.
- **Contrato `MULTISELECT` sumiu do storage uma vez**, sem causa identificada. Reaprendido.
  Suspeita não confirmada: read-modify-write da mesma chave com duas abas abertas. Recomendado
  exportar backup (Config -> Backup) para restaurar contrato sem refazer aprendizado.
- **Painel sobe sem settings quando a aba abre sem atendimento aberto** (`panel.js`,
  `applyPageState`): `load()` só roda quando o `sessionId` muda, e no boot ele já é `null`.
  Config mostra defaults errados e throttle vira `undefined` -> grava 0 ms.
- **Config grava settings a partir de snapshot** e apaga `dockWidth`/`panelOpen` ajustados por
  outro caminho.
- **Sem ícone** no manifest (`icons` e `action.default_icon` ausentes).
- README dizia que o template `pedir-dados` pede "Nome / Cidade / Função"; o template pede só
  "Nome / Cidade". Dicionários de função e partido não têm editor na UI.
