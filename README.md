# WhatsFill

Extensão do Chrome que acelera o atendimento no **mobiliza.app**: respostas prontas com
variáveis, link do grupo escolhido pela cidade do contato, e classificação pré-preenchida a
partir do que o contato escreveu — sem IA, sem custo por contato.

O painel fica **encaixado na borda direita da própria página** e **empurra** o mobiliza para o
lado em vez de cobrir a conversa: tudo continua caber na tela. Arraste a borda esquerda do
painel para mudar a largura — a página se reajusta junto.

## Instalar

1. Abra `chrome://extensions`
2. Ligue o **Modo do desenvolvedor** (canto superior direito)
3. **Carregar sem compactação** → escolha a pasta `C:\Users\T-GAMER\Desktop\APPS\WhatsFill`
4. Abra `https://mobiliza.app`
5. Clique no **ícone da extensão** → o painel encaixa na direita

A aba "WhatsFill" na borda esquerda do painel mostra/esconde (o ícone da extensão faz o mesmo).
Largura e estado (aberto/fechado) ficam salvos.

**Duas formas de ver o painel:**

| Onde você clica no ícone | O que acontece |
|---|---|
| Numa aba do mobiliza | mostra/esconde o painel **encaixado** — é o modo do dia a dia |
| Em qualquer outra aba | abre o painel em **janela separada**, útil em dois monitores |

A janela separada lembra posição e tamanho. Se o ícone mostrar o aviso **F5**, é porque a aba
tem um content script antigo (você recarregou a extensão): recarregue a aba.

## Primeiro uso, na ordem

### 1. Cadastre os grupos por cidade — aba **Config**

Uma linha por cidade:

```
Santo Ângelo = https://chat.whatsapp.com/XXXX
Cachoeira do Sul = https://chat.whatsapp.com/YYYY
```

Acento e maiúscula não importam no casamento: "sto angelo", "Sto Ângelo" e "SANTO ANGELO"
acham o mesmo grupo. Opcionalmente preencha o **link padrão**, usado quando a cidade não tem
grupo próprio — sem ele, o envio fica bloqueado até você cadastrar a cidade (de propósito:
melhor travar do que mandar link errado).

### 2. Ensine a extensão a gravar campos — aba **Config** → "Gravar campos no CRM"

A extensão **não adivinha** o formato que a plataforma usa para gravar um campo: ela observa
você fazendo isso uma vez. Faça com um contato **de teste**, não com um contato real:

> **O valor de teste vai no painel da PLATAFORMA, não no do WhatsFill.** O gravador funciona
> observando as requisições que o mobiliza faz quando *ele* salva um campo. Se você digitar
> `WHATSFILL-TESTE` no campo Cidade do painel do WhatsFill, nenhuma requisição sai e o
> aprendizado espera para sempre. É no **"Dados do contato"** do mobiliza, no link **Alterar**
> ao lado do campo.

1. Abra um contato de teste
2. Clique em **Aprender campo de texto (Cidade)**
3. Abra o **"Dados do contato"** da plataforma, clique em **Alterar** ao lado de **Cidade**,
   ponha exatamente `WHATSFILL-TESTE` e salve
4. O painel confirma o que aprendeu — então apague o valor de teste
5. Repita com **Aprender múltipla escolha (Tema)**, marcando qualquer opção pelo **Alterar** da
   plataforma e depois desmarcando
6. Repita com **Aprender etiquetas**, abrindo as Etiquetas do contato de teste no painel da
   plataforma, marcando qualquer uma e depois desmarcando
7. Repita com **Aprender data (conclusão)**, pondo `31/12/1999` na **Data de conclusão do
   contato** pelo **Alterar** da plataforma

Data e múltipla escolha **não aceitam substituto**: se o contrato do tipo não estiver
aprendido, o painel recusa e diz qual falta, em vez de tentar com o contrato de texto. Esse
fallback existia e era justamente o que produzia o "gravou e sumiu" — o valor ia em
`valueString` num campo que guarda em `valuesId`/`valuesDateTime`, e a API respondia 200.

São **quatro** contratos, e o da data não é opcional. Sem ele a escrita cai no contrato de
texto, a API responde **200 e ignora o valor**: o painel diz "Gravado" e o campo continua vazio
na plataforma. Como o `GET` do contato não devolve os campos personalizados, a extensão não tem
como conferir sozinha — por isso o formato da data é **aprendido**, não chutado.

No fim, a caixa em Config deve dizer algo como
`Contrato aprendido para: STRING (PUT), TAGS (PUT), DATE (PUT), MULTISELECT (PUT)`.

Sem esse passo, a aba **Dados** abre com um aviso no topo e o botão **Salvar no CRM**
desabilitado — cidade, data de conclusão e etiquetas não são gravadas, de propósito. Se algum
dia parecer que "o preenchimento parou de funcionar", é o primeiro lugar para olhar.

### 3. Teste o envio no seu próprio número

O envio automático vem **desligado**. Deixe assim no começo: clicar em "Enviar" só insere o
texto no campo de mensagem, e você confere antes de mandar. Quando confiar, ligue
**Enviar automático** na aba Config.

## Uso no dia a dia

- O painel **acompanha a aba** do mobiliza: você troca de atendimento na plataforma e ele
  recarrega o contato sozinho. Trocou para outra aba do mobiliza? Ele segue a nova.
- Atendimento novo chega como **Pendente** e não tem campo de mensagem: o painel oferece
  **Iniciar atendimento** (é a mesma coisa que o botão Iniciar da plataforma).
- Aba **Respostas**: cada resposta mostra o texto já com as variáveis resolvidas. Se algo não
  resolveu (`{{link_grupo}}` sem cidade cadastrada, por exemplo), o botão Enviar fica
  desabilitado e o painel diz o motivo.
- No fim da aba Respostas ficam os **modelos de mensagem** aprovados da plataforma — ver
  seção própria abaixo.
### Classificação sozinha ao abrir o contato

O atendimento é assíncrono: você pede nome e cidade, passa para o próximo e volta quando a
pessoa respondeu. É na **reabertura** que a classificação precisa já estar feita — clicar
Salvar oito mil vezes é o trabalho que a extensão existe para eliminar.

Então, ao abrir um contato, o painel **grava sozinho o que é determinístico**:

| Grava sem clique | Continua esperando você |
|---|---|
| Cidade que casou **exato** com a lista do IBGE | Cidade aproximada ou não reconhecida |
| O **COREDE** dessa cidade | COREDE de cidade que foi só palpite |
| Etiquetas de **conteúdo** (as regex que você escreveu) | Nome, função, partido, tema |

Duas garantias sustentam isso: valor que já está no CRM **nunca** é sobrescrito (o automático
só preenche buraco), e toda gravação é **conferida relendo o contato** — o status só diz
"Aplicado sozinho: …" depois que o servidor confirmou.

**A única exceção ao "nunca sobrescrever" é a cidade que a pessoa informou.** Se ela responde o
formulário com uma cidade diferente da que está no CRM, a nova entra no lugar — e a etiqueta de
COREDE antiga sai junto, porque duas regiões no mesmo contato é informação errada. As travas:
casamento **exato** com o IBGE, só em resposta estruturada ("Nome / Cidade"), e nunca por cima
de uma correção que você fez à mão. Cidade citada solta no meio da conversa continua sendo
palpite que não sobrescreve nada.

Palpite aproximado nunca entra sozinho. Errar aqui grava dado errado em contato real, e a
extensão não sabe desfazer. Desligável na aba Config.

- Aba **Dados**: os campos já vêm pré-preenchidos. Campo em **amarelo** é palpite do parser,
  com o trecho da mensagem que o originou logo abaixo. Confira e clique em **Salvar no CRM**.
  Embaixo dos campos ficam as **etiquetas sugeridas**, já marcadas — o Salvar aplica tudo junto.
- **Pedir dados + concluir + próximo**: a abertura do laço, e o botão de maior volume. Envia o
  pedido de nome e cidade, conclui e abre o próximo. Concluir aqui é tirar da fila: quando a
  pessoa responde, a plataforma traz o atendimento de volta para as não lidas. Não carimba data
  de conclusão (quem só recebeu a pergunta ainda não foi concluído) e exige o "Enviar
  automático" ligado — sem ele o texto só seria inserido, e o atendimento fecharia sem a
  pergunta ter saído.
- **Enviar conteúdo + agradecer + concluir**: o fecho do dia a dia. Manda o **modelo aprovado
  correspondente ao conteúdo que a pessoa pediu**, manda o agradecimento, grava a classificação
  e conclui. Depende da tabela "Modelo por conteúdo" (abaixo).
- **Salvar + concluir + próximo**: só encerra — grava a classificação, marca a data de
  conclusão, conclui e abre o próximo, sem enviar mensagem.
- **Enviar grupo + salvar + concluir**: o mesmo, enviando antes o link do grupo da cidade. Só
  serve com os grupos cadastrados na aba Config. Se a plataforma pedir motivo de conclusão, o
  painel para e deixa o diálogo para você.

### Modelos de mensagem (templates aprovados)

São os modelos salvos na própria plataforma — os do clipe → **Modelo de mensagem**. O painel
lista todos no fim da aba Respostas, com filtro, e envia sem você navegar pelo diálogo.

Por que vale a pena além da comodidade: **com a janela de 24h expirada, modelo aprovado é o
único envio que o WhatsApp aceita**. Antes o painel só sabia recusar nessa situação.

- **Listar** vem da API (`GET /chat/v5/template`), leitura pura.
- **Enviar** dirige o diálogo nativo, pelo mesmo motivo que o `composer.js` não faz POST
  direto: o modelo carrega mídia aprovada (a maioria aqui tem imagem de ~1,4 MB), vínculo com
  o canal e regra de janela. Reproduzir isso contra uma API não documentada é exatamente o que
  o `recorder.js` existe para evitar.
- **Só preparar** deixa o diálogo aberto na tela final com o modelo já selecionado, para você
  conferir e clicar. É o equivalente do "Só inserir" das respostas prontas, e é o que acontece
  quando o **Enviar automático** está desligado.

**Como ele acerta o modelo certo.** A lista do diálogo é virtualizada: só ~6 linhas existem no
DOM de uma vez, de 19 modelos. Então a escolha passa pelo campo de busca, não por rolagem. E
como a conta tem modelos de **nome repetido** ("A" e "A", "Flávio" e "Flávio"), nome nunca
basta: quem decide é o texto, e a linha escolhida precisa acompanhar o texto do modelo por
quase toda a extensão. Empate ou dúvida = recusa, com o motivo na tela.

Isso não é teórico: na primeira versão, um estado transitório da lista durante o repinte da
busca fez o painel selecionar o "Flávio" errado. Por isso, depois de clicar, a extensão
**confere no DOM** qual linha ficou marcada antes de seguir — e aborta se não bater.

**Modelo com parâmetro ainda não é enviado.** Nenhum dos 19 modelos cadastrados hoje usa
parâmetro, então a tela de preenchimento nunca aparece e não houve como aprendê-la. Quando o
primeiro aparecer, o painel **recusa e explica**, em vez de enviar com parâmetro vazio — e aí
é preciso uma passada de captura para ensinar o preenchimento.

### Variáveis dos templates

`{{saudacao}}` `{{nome}}` `{{primeiro_nome}}` `{{cidade}}` `{{link_grupo}}` `{{telefone}}`
`{{funcao}}` `{{partido}}`

### Etiquetas

Duas famílias hoje, e a estrutura aceita mais sem mexer em código.

As duas essenciais para o fluxo são **Cidade** e **Data de conclusão do contato** (preenchida
com a data de hoje ao salvar); se alguma delas falhar, o fluxo completo não segue para o envio.
Falha em campo secundário (como o Nome no cadastro) vira aviso e o resto é gravado.

**Região = o COREDE da cidade.** Porto Alegre → `Metropolitano Delta do Jacuí`. O mapa
município → COREDE vem da planilha oficial da Secretaria de Planejamento do RS (497
municípios, 28 COREDEs), em [src/data/coredes-rs.json](src/data/coredes-rs.json). Cidade fora
da tabela não recebe etiqueta chutada: o painel avisa para você conferir a grafia.

**Conteúdo = o que o contato aceitou receber.** Regras editáveis na aba Config, uma por linha:

```
zucco = Conteúdo Zucco
fl[áa]vio = Conteúdo Flávio
```

O lado esquerdo é um padrão (regex, ignora maiúscula) casado contra as mensagens do contato e a
campanha do anúncio. Padrão inválido é ignorado com aviso, sem derrubar as outras regras.

**Do conteúdo pedido ao modelo enviado.** A regra acima diz *o que* a pessoa pediu; a tabela
**Modelo por conteúdo**, na aba Config, diz *qual modelo aprovado* responde:

```
Conteúdo Zucco = Zucco, Capitão
Conteúdo Flávio = Flávio 3
```

O lado direito tem que ser o nome exato de um modelo da plataforma — a Config lista os
disponíveis logo acima do campo. Sem mapeamento, com nome que não existe, ou com dois modelos
de mesmo nome, o painel **para e explica** em vez de enviar algo parecido. Também para quando o
contato casou com mais de um conteúdo: escolher entre dois é decisão sua.

**O nome da etiqueta nunca é inventado**: é resolvido contra a lista real do CRM
(`GET /core/v1/tag`, onde o rótulo fica no campo `message`). O casamento ignora acento e
pontuação, o que já resolve "Centro-Sul" (planilha) x "Centro Sul" (CRM). Quando não resolve —
caso de `Paranhana Encosta da Serra` x `Vale do Paranhana` — vale a tabela de apelidos, e o
painel oferece escolher da lista do CRM, gravando a escolha como apelido para não repetir.

Ao gravar, as etiquetas são **somadas** às que o contato já tem. Isso é proposital e testado: a
plataforma grava a lista inteira, então mandar só as novas apagaria as antigas.

### Nome do contato

O contato que chega do anúncio é cadastrado como `[NOVO] (51) 99999-9999`. A extensão reconhece
esses apelidos automáticos e trata como **sem nome**: `{{primeiro_nome}}` fica pendente e o
envio é bloqueado, em vez de sair "Boa noite, [NOVO]!". Quando o contato informa o nome, o
parser preenche o campo **Nome** na aba Dados, o Salvar grava no cadastro, e as mensagens
seguintes passam a usar o nome de verdade.

Por isso o template `pedir-dados` **não** usa `{{primeiro_nome}}` — é justamente a mensagem que
você manda antes de saber o nome.

### Como o parser acerta

A precisão vem do **formato da pergunta**, não de adivinhação. O template `pedir-dados` pede
`Nome completo / Cidade`, e o template de tema pede um número. Sobre isso rodam:

- **Cidade** — casa contra os 497 municípios do RS (lista oficial, já embutida no repositório),
  sem acento, com abreviação comum (`Sto`, `POA`, `Cxs`), tolerância a erro de digitação e
  encurtamento (`Palmares` → Palmares do Sul, `Livramento` → Santana do Livramento). Não achou?
  Oferece as 3 mais próximas como botão, em vez de inventar.

  Duas coisas **não** são cidade, por mais que contenham nome de município: o nome do estado
  ("sou do Rio Grande do Sul" não é a cidade Rio Grande) e o vocabulário da campanha — **Capitão
  é município do RS e é a patente do candidato**, então toda mensagem de aceite do anúncio virava
  cidade Capitão, com a confiança que grava sem clique. A lista de municípios ignorados fica na
  aba Config.

  **A cidade extraída aparece em marca-texto amarelo** no cabeçalho, na aba Dados e na pergunta
  da rodada, com o trecho que a gerou (`Capitão ← de "Capitão Martim"`). Sem marca = veio do CRM
  ou você digitou. É o que deixa conferir de relance se o que ele pegou está certo.
- **Nome** — na prática o contato responde do jeito dele: `Maria / Santo Ângelo / voluntária`,
  ou em três linhas, ou simplesmente `Thiago kellermann, porto alegre`. Aceitar vírgula sem
  critério transformaria "boa tarde, sou de Pelotas" em nome "Boa Tarde", então o que valida a
  resposta é: **um dos pedaços tem que ser só o nome de um município do RS**. Isso separa quem
  está respondendo o formulário de quem está conversando. Há também uma lista de aberturas e
  verbos que descartam o pedaço como nome.
- **Função e Partido** — dicionários editáveis; sigla de partido só casa como palavra isolada.
- **Tema de Interesse** — número da resposta, ou palavra-chave.

## Testes

Node 18+, sem dependência nenhuma:

```bash
node tests/parser.test.mjs
```

```bash
node tests/contract.test.mjs
```

```bash
node tests/vars.test.mjs
```

```bash
node tests/tags.test.mjs
```

```bash
node tests/hsm.test.mjs
```

```bash
node tests/conversa.test.mjs
```

Todas rodam **offline**: a lista de municípios do `parser.test.mjs` sai de
`src/data/coredes-rs.json` (os mesmos 497), plantada no storage antes do import — buscar no IBGE
deixava doze asserções falhando juntas onde a rede é bloqueada, por um motivo que não tinha nada
a ver com o parser. `conversa.test.mjs` cobre a leitura que autoriza a rodada a concluir sozinha
quem já foi respondido — inclusive figura, que não tem texto e sumia da conta.
`contract.test.mjs` cobre o caminho que escreve em dados reais, incluindo o guarda-corpo que
**recusa** aprender um formato de escrita que sobrescreveria o contato inteiro.
`tags.test.mjs` cobre o COREDE, as regras de conteúdo, os apelidos e a união ao aplicar
etiquetas. `vars.test.mjs` cobre o bloqueio por variável faltante e o nome `[NOVO]`.
`hsm.test.mjs` cobre a escolha do modelo de mensagem entre nomes repetidos — inclusive a
regressão real em que um candidato único pelo nome era o modelo errado.

## Como está montado

### Como o painel empurra a página

Padding à direita no `<html>`, e nada mais. Funciona porque o layout do mobiliza colabora
(medido ao vivo): `html` já é `box-sizing: border-box`, nenhum elemento usa `100vw`, e o painel
nativo "Dados do contato" é `position: fixed` sem `left`/`right` explícitos — usa a posição do
fluxo, então acompanha o encolhimento.

Com 380px encaixados: body 1920→1540, conversa 1501→1121, lista 1862→1482, painel de contato
1862→1482, sem barra de rolagem horizontal.

A única coisa que fica por baixo do painel é a **gaveta de chat interno da equipe** quando
aberta: ela é um overlay fixo de 400px do próprio app. Deixei de propósito — sobrescrever
classes utilitárias de outra aplicação é o tipo de coisa que quebra em silêncio na próxima
atualização deles.

### Quem fica por cima de quem (z-index)

Medido na plataforma:

| Camada | z-index | Fica acima do painel? |
|---|---|---|
| `fuse-splash-screen` (tela de carregamento) | 999999 | sim, e é o correto |
| `.cdk-overlay-container` — **todo** menu, diálogo, select, autocomplete, tooltip e toast do Material | 1000 | **sim** |
| `fuse-loading-bar` (barra de 6px no topo) | 999 | sim (linha fininha, sem prejuízo) |
| **painel do WhatsFill** | **998** | — |
| conteúdo da página (cabeçalho, listas, gaveta de chat interno) | ≤ 50 | não |

O painel fica **de propósito** abaixo de 1000: um z-index máximo engoliria o dropdown de
Etiquetas, o menu do Concluir, o de anexo, o de cartões, os diálogos de conclusão e edição, os
autocompletes e os tooltips — todos moram no mesmo `.cdk-overlay-container`. Uma escolha de
z-index resolve a família inteira.

Detalhe para quem for medir isso: a plataforma aplica **zoom 0.9** no documento, então compare
posições por `getBoundingClientRect()` e não pelos valores escritos no CSS.

### Os três contextos

São **três contextos** que conversam por mensagem:

**1. A página do mobiliza** (mundo MAIN, `src/page-hook.js`) — só intercepta XHR para pegar o
Bearer do app (que vive na memória do Angular, não no localStorage) e, durante o aprendizado,
gravar as requisições. Nada de interface.

**2. O content script** (`src/content.js` → `src/main.js`) — não desenha nada: atende o que o
painel pede sobre a página (escrever no campo, clicar em Iniciar/Concluir, abrir o próximo) e
avisa quando o atendimento aberto muda.

**3. O painel** (`src/panel/`) — a interface, o parser e o storage. No modo encaixado ele roda
dentro do content script (item 2) e chama tudo direto. Em janela separada
(`src/window.html`), tudo que depende da página vira mensagem.

### Por que a API só pode ser chamada de dentro da aba

A API do mobiliza valida o header `Origin`. Uma requisição saindo da janela do painel (origem
`chrome-extension://…`) volta com **`500 Origin not allowed`**, e algumas nem completam o
preflight (`Failed to fetch`). Por isso `api.js` tem transporte plugável: dentro da aba é fetch
de verdade; na janela separada, a chamada é despachada para a aba executar. Efeito colateral
bom: o token de acesso nunca sai da aba. É também mais um motivo para o modo encaixado ser o
padrão — nele esse problema simplesmente não existe.

```
CLAUDE.md               regras e armadilhas para quem (ou o que) for mexer no código
registro.md             log de mudanças e decisões — ler antes de trabalhar
manifest.json           MV3
src/background.js       clique no ícone: encaixa na aba ou abre a janela separada
src/window.html/.js     o painel em janela separada
src/page-hook.js        mundo MAIN: captura o Bearer e grava requisições
src/content.js          carregador (content script clássico → import dinâmico)
src/main.js             monta o painel encaixado na aba e a ponte de mensagens
src/lib/dock.js         empurra a página para o painel caber (padding no html)
src/lib/rpc.js          contrato de mensagens painel ↔ aba
src/lib/rpc-host.js     lado da aba: executa o que a janela separada pede
src/lib/page.js         interface única: chamada direta na aba, mensagem na janela
src/lib/bus.js          ponte MAIN ↔ ISOLATED (o token só vive em memória, na aba)
src/lib/api.js          rotas da API, transporte plugável, retry em 401
                        (getContact PRECISA de isToIncludeCustomFields=true)
src/lib/dom.js          ÚNICO arquivo com seletores da página
src/lib/composer.js     escreve no campo nativo e clica no enviar
src/lib/hsm.js          modelos de mensagem: lista pela API, envia dirigindo o diálogo
src/lib/contract.js     derivação/reprodução do contrato de escrita (puro, testado)
src/lib/recorder.js     captura das requisições para o aprendizado
src/lib/fields.js       schema, leitura e escrita dos campos personalizados
src/lib/extract.js      parser determinístico
src/lib/tags.js         etiquetas: COREDE da cidade, regras de conteúdo, aplicação somando
src/lib/cities.js       municípios, normalização e cidade → link
src/data/coredes-rs.json  município → COREDE (planilha oficial da SPGG-RS)
src/lib/vars.js         interpolação e bloqueio por variável faltante
src/lib/templates.js    respostas prontas e registro anti-duplicata
src/lib/store.js        chrome.storage.local com defaults
src/panel/              a interface do painel
options.html            backup (exportar/importar)
```

Sem build step: são ES modules puros. Editou um arquivo? Clique em recarregar na
`chrome://extensions` e atualize a aba do mobiliza (F5).

**O F5 não é opcional.** Recarregar a extensão deixa as abas já abertas com o content script
órfão: todo acesso ao `chrome.storage` passa a dar "Extension context invalidated", e o painel
falha em silêncio — caixas vazias, botões que não fazem nada, e a Config parecendo dizer que o
contrato não foi aprendido. O painel agora traduz esse erro para uma frase pedindo o F5, mas o
sintoma é traiçoeiro: se algo "parou de funcionar" logo depois de mexer no código, é isto.

**Se a plataforma mudar de layout**, o conserto é em `src/lib/dom.js` (seletores) e
`src/lib/dock.js` (o empurrão) — em nenhum outro lugar.

### "Confirmado no CRM" quer dizer conferido, não "a API respondeu 200"

Depois de gravar, o painel **relê o contato** e compara campo a campo. Só então escreve
**"Confirmado no CRM: …"**. Se algo não bateu, ele diz **"a API aceitou mas não gravou"** e
nomeia o campo.

Isso não é zelo excessivo — é a única defesa contra o modo de falha real desta API: **responder
200 e ignorar o valor** quando o formato não serve. Foi assim que a Data de conclusão passou a
"gravar" sem gravar. Sem a releitura, o painel repetiria a mentira.

O outro motivo é prático: o **"Dados do contato" da plataforma não se atualiza sozinho** — ele
guarda o contato em memória e só relê no F5 (fechar e reabrir não dispara requisição nenhuma,
verificado). Dar F5 a cada contato para saber se salvou é inviável em oito mil. Com a
conferência, a linha de status do painel já é a resposta do servidor.

Efeito colateral bom: os campos confirmados perdem o amarelo de palpite na hora, porque o
painel passa a mostrar o valor que o CRM devolveu.

## Notas de segurança

- O token de acesso **não** é gravado em disco: fica só em memória e é recapturado quando a
  aba recarrega.
- A extensão só fala com `mobiliza.app`, `api.mobiliza.app` e (uma vez) a API de municípios do
  IBGE.
- O envio automático tem quatro travas: bloqueio por variável não resolvida, preview
  obrigatório, aviso de duplicata por contato+template e intervalo mínimo entre envios.
