# Disparo pelo celular

> Branch `claude/disparo-celular`, criada em 03/10/2026 a partir da `claude/whatsfill-ia` para nao
> misturar os projetos. Ela carrega a extensao inteira porque nasceu de uma copia dela — **a
> extensao continua carregando e funcionando igual (3.147.0)**, e a pasta `celular/` o Chrome
> ignora. O que **nao** acontece e commit daqui aparecer na extensao, que era o pedido.

**O pedido dele (03/10/2026):** *"eu quero fazer o disparo em massa pelo celular, creio que um app
tera que ser feito, vou exportar os contatos do mobiliza e o app devera adicionar ao whatsapp os
contatos; apos adicionar vou mandar as mensagens offline e religar quando atingir o numero que eu
quero; como serao varias mensagens elas tem que ser automatizadas e variando, sera so texto"*.

---

## O que foi medido antes de escrever app

### 1. A metade dos contatos NAO precisa de app — e um formato de arquivo

O Android (e o iPhone, e o Google Contatos) importa **vCard** desde sempre:
*Contatos -> Configuracoes -> Importar -> arquivo .vcf*. Escrever um app para inserir contatos
seria pedir permissao de acesso a agenda dele para repetir, pior, o que o sistema ja faz.

`contatos-para-vcf.mjs` resolve essa metade inteira, e ja esta pronto e testado (69 asercoes).

### 2. O "offline" DELE funciona — e e o contrario do teste que falhou hoje

Hoje de manha o teste de desligar a internet do celular **nao segurou nada**, e a razao esta
registrada: o canal da plataforma e Z-API, um **aparelho pareado** a conta, com conexao propria ao
servidor do WhatsApp. O celular dele nao estava no caminho.

**Mandando do proprio WhatsApp do celular a historia e outra:** mensagem escrita sem rede fica com o
reloginho e sai na reconexao. E o cliente dele mandando, nao um aparelho pareado. **O plano dele e
coerente** — e ele acertou tambem na ordem: **e por isso que os contatos tem de ser adicionados
antes**, porque sem o numero salvo nao da para abrir a conversa com um desconhecido sem rede.

### 3. A sequencia que o plano exige (errar a ordem derruba tudo)

1. Gerar o `.vcf` e importar nos Contatos.
2. **Internet LIGADA**, abrir o WhatsApp e deixar ele sincronizar a agenda. E a sincronizacao que
   descobre quais daqueles numeros tem WhatsApp — e ela precisa de rede. Pulando este passo, os
   contatos existem no celular e **nao existem** para o WhatsApp.
3. Modo aviao.
4. Preparar as mensagens uma a uma.
5. Religar a internet ao chegar no numero que ele escolheu.

### 4. O que continua sendo hipotese, e nao vou afirmar

- **Abrir a conversa com o texto pronto, em modo aviao, funciona?** Continua em aberto — mas uma
  metade ja foi medida e **foi um erro meu**: em 03/10/2026 eu mandei ele DIGITAR
  `whatsapp://send?...` na barra de endereco do Chrome, e deu o **dinossauro**. Digitado, o Chrome
  trata o texto como endereco de site; esquema de aplicativo so e entregue ao Android quando se
  **toca num link**. O que foi medido e *"digitar nao funciona"*, nao *"o link nao funciona"*.
  Hoje a sonda testa **tres mecanismos** por toque, porque qual deles vale depende da versao do
  Chrome e de a pagina vir de `file://`: `whatsapp://`, `intent://` com `scheme=whatsapp`, e
  `intent://` com `scheme=smsto` (a porta de "mandar mensagem para este numero", que o WhatsApp
  tambem atende). **Nenhum funcionando, a pagina cai no modo COPIA** e continua servindo — mais
  lento, e com o texto certo para a pessoa certa.
  O teste honesto e com **um contato que ele acabou de importar e nunca conversou**, nao com um
  numero que ja tem conversa aberta: a conversa que ja existe pode abrir por estar em cache e
  dizer que funcionou.
- **Importar milhares de contatos e deixar o WhatsApp sincronizar e, por si, um sinal?** E o tipo de
  coisa que se comenta e que eu nao tenho medicao. Fica escrito como suspeita.
- **Quantas mensagens cabem na fila offline, e com que ritmo elas saem na reconexao?** Desconhecido.

---

## As tres formas de fazer a segunda metade, com o preco de cada uma

### (a) Toque por contato — pronto, nesta branch, sem app

`disparador.html`: uma pagina que ele abre no celular, escolhe o `plano.csv`, e para cada contato
mostra o texto da vez com um botao que **abre a conversa com o texto ja escrito**. Ele aperta
enviar, volta, aperta "proximo".

- **Nao viola nada**, usa o endereco publico do proprio WhatsApp.
- **Zero rede** — nenhum script de fora, nada de CDN: tem de funcionar em modo aviao.
- O texto **varia sozinho**, revezando as variacoes; o alvo e o "parar em N" sao dele.
- Lembra onde parou, e no fim diz **o numero do contato em que parou**, para a rodada seguinte.
- **O custo honesto: dois toques por contato.** Duzentos contatos sao ~400 toques.

### (b) App que aperta enviar sozinho — **nao vou construir**

Para um programa apertar o botao de enviar do WhatsApp o caminho e o **servico de acessibilidade**
do Android dirigindo a tela do aplicativo. E o que os "WhatsApp bulk sender" fazem, e e o que eu
nao faco: viola os termos do WhatsApp (envio automatizado e em massa), e barrado na politica do
Google Play para a API de acessibilidade, e **e o padrao que queima numero mais rapido de todos** —
exatamente o que a medicao de hoje mostrou custando um numero com 30 conversas.

Se mesmo assim for o caminho que ele quiser, a conversa e com ele; mas eu nao escrevo essa parte, e
o motivo nao e burocratico — e que ela entrega menos do que o caminho (a), mais rapido.

### (c) Campanha da plataforma — o unico que guarda e solta de verdade

`chat/v1/campaign`, que **roda no servidor**, nao depende de aba nem de celular, tem `submit`,
`pause`, `resume`, `cancel`, publico por lista de telefones ou por filtro e teto de 50.000. Os dois
blocos sao conhecidos: exige **modelo aprovado pela Meta** e pode nao existir em canal nao oficial
(`typeDetails.canSendCampaign`). A extensao ja diz na tela se o canal dele aceita — cartao "Por qual
numero", na aba Disparo.

---

## O risco que o plano offline NAO reduz

Guardar as mensagens e soltar todas na reconexao **nao esconde nada do WhatsApp**: ele ve as
conversas novas quando elas chegam ao servidor, e elas chegam todas juntas. Ou seja, o plano offline
entrega a versao mais concentrada do padrao que queimou um numero dele com 30 conversas hoje.

**Isso nao e argumento para nao fazer** — ele ja decidiu usar um numero secundario sabendo do preco.
E para a conta nao ser feita errada: a fila offline nao e uma forma de passar despercebido, e sim de
mandar mais rapido. E, pela medicao de hoje, **numero secundario e o que menos aguenta**, porque o
que o WhatsApp olha e reciprocidade: numero que so manda e nunca recebe cai antes.

---

## Como usar

**1. Exportar do mobiliza** e salvar como **CSV UTF-8** (no Excel: *Salvar como -> CSV UTF-8*).

**2. Gerar o .vcf e o plano** (fora do repositorio — a ferramenta recusa escrever aqui dentro):

```bash
node celular/contatos-para-vcf.mjs "C:/Users/thiag/Downloads/planilha-contatos.xlsx" --saida="C:/Users/thiag/Downloads/disparo" --pular-etiqueta=COLINHA --mensagens="C:/Users/thiag/Downloads/mensagens.txt"
```

O `.xlsx` e lido direto — nao precisa converter para CSV. Para ver o que ha no arquivo antes:
`--listar-etiquetas`.

O arquivo de mensagens e texto puro, com as variacoes separadas por **uma linha com `===`**:

```
Primeira versao do texto.
===
Segunda versao, dizendo a mesma coisa de outro jeito.
===
Terceira versao.
```

**O separador era `---` e mudou em 03/10/2026, antes da primeira rodada.** A colinha dele tem uma
regua de tracos separando a abertura dos numeros — medido, o leitor partia a mensagem ali: a
introducao viraria uma "variacao" e os numeros, outra, **e cada metade sairia para uma pessoa
diferente**. Traco e pontuacao comum dentro de mensagem; linha de iguais nao e. Arquivo que ainda
use `---` e **recusado** com o motivo escrito, em vez de virar uma mensagem so com tudo emendado.

Opcoes: `--prefixo=` (o que vai na frente do nome, padrao `ZDISPARO`), `--por-arquivo=`
(quantos cartoes por .vcf, padrao 500), `--incluir-fixo`, `--coluna-telefone=`, `--coluna-nome=`.

**3. Levar para o celular** o(s) `.vcf`, o `-plano.csv` e o `disparador.html`.

**4. Importar os contatos**, deixar o WhatsApp sincronizar **com internet**, e so depois o modo aviao.

**5. Abrir o `disparador.html`** no Chrome do celular e fazer o teste do primeiro cartao.

### Nenhuma variavel e substituida no texto, de proposito

O plano sai com o texto literal: `{{nome}}` escrito no arquivo chega assim no WhatsApp. E a decisao
antiga do projeto — mensagem nao chama a pessoa pelo nome, porque o nome do CRM erra demais (apelido
do perfil, cidade no campo do nome, `[NOVO] ...`), e errar o nome num disparo e pior que nao ter
nome nenhum.

### O prefixo no nome e o que permite APAGAR depois

Importar alguns milhares de contatos e facil; tirar e que e o problema. Com `ZDISPARO` na frente,
ele busca no app de Contatos, seleciona tudo e exclui. Importando pelo **Google Contatos** ha uma
segunda saida: a importacao cria sozinha um grupo *"Importados em <data>"*, que da para excluir
inteiro.

---

## O que a exportacao de verdade mostrou (03/10/2026, 9.457 linhas)

Medido na planilha dele. **Nenhum dado de eleitor foi escrito em lugar nenhum** — o que segue e a
FORMA do arquivo e nomes de etiqueta, que sao organizacao interna.

- **Colunas:** ID, Data de cadastro, **Nome**, **Telefone**, Email, Instagram, **Etiquetas**, Notas
  Internas, Data de conclusao do contato, Cidade, Tema de Interesse, Funcao, Responsavel, Partido,
  Temas de Interesse. As tres que interessam sao reconhecidas pelo cabecalho, sem configurar nada.
- **A etiqueta `COLINHA` NAO existe neste arquivo**, nem nada parecido — as 530 etiquetas distintas
  foram varridas. As mais proximas sao `Material de campanha` (215) e `MATERIAL_IMPRESSO` (2), que
  sao outra coisa. **A exportacao e de 02/10 as 16:10**, entao qualquer coisa etiquetada depois
  disso nao esta aqui.
- **NAO existe etiqueta de recusa** (sem interesse, nao perturbe, bloqueado, descadastrado). O
  campo "Etiqueta de SEM INTERESSE" da Config e o que a alimentaria, e ele esta em aberto desde
  04/09. **Isso importa mais que a colinha:** sem essa marca, quem ja pediu para sair nao tem como
  ficar de fora de uma lista montada a partir deste arquivo.
- **Existem etiquetas de assessor:** `CONTATO-ASSESSOR` (24), `Assessor Cap` (8), `ASSESSOR` (6).
  Pela regra ja registrada, `CONTATO-ASSESSOR` e eleitor TRAZIDO por um assessor, nao equipe.
- **15 grupos de etiqueta que so diferem por caixa/acento** (`SERRA` e `Serra`, `Vale do Rio dos
  Sinos` e `VALE DO RIO DOS SINOS'`) — e a armadilha do rotulo repetido ja registrada, e e por isso
  que o casamento do `--pular-etiqueta` e normalizado.
- **O separador das etiquetas e a VIRGULA** (17.769 delas); os 27 ponto e virgula eram `&amp;`
  dentro do nome da etiqueta.
- **Resultado:** 9.436 contatos aproveitados. Fora: 9 sem telefone, **8 com DDD 59, que nao
  existe**, 3 com digitos demais, 1 fixo. **Zero repetidos.** Por DDD: 51=4.708, 55=2.055,
  54=1.749, 53=580 — e **344 de fora do RS**.

### Variar a abertura rende MENOS do que parece (medido)

Com as seis aberturas que ele aprovou e a colinha identica nas seis, as mensagens ficam **81,1%
parecidas entre si** em media (pior par: 86,2%). A razao e aritmetica: **a colinha e ~60% do texto
e vai byte a byte igual de proposito** — seis numeros redigitados seis vezes seriam trinta e seis
chances de mandar um eleitor votar na pessoa errada, e isso nao se troca por variacao.

Medido tambem o que o passo seguinte renderia: **revezando tres FORMATOS da colinha** (rotulo e
marcador mudam; numero e nome, nunca), a semelhanca media cai para **59,0%**. Isso so e seguro se
os formatos forem gerados a partir de **uma tabela unica da chapa**, e nao reescritos a mao — ai o
numero nao tem como divergir entre as versoes. **Ainda nao foi feito**, e e a proxima alavanca.

### Nao importe mais contatos do que voce vai mandar

Os 9.436 saem em 19 arquivos de 500. **Importe so o primeiro.** Importar nove mil contatos para
mandar cinquenta mensagens e custo sem beneficio: polui a agenda dele, e a sincronizacao de nove
mil numeros de uma vez e justamente a suspeita registrada aqui como nao medida. O proximo arquivo
entra quando o anterior acabar.

## Armadilhas desta parte (custaram medicao — nao redescubra)

- **O `55` do pais colide com o DDD 55** (Santa Rosa, Santo Angelo). `55999999999` com 11 digitos e
  um celular do DDD 55, nao um numero sem DDD — por isso o `55` da frente so sai quando o que resta
  tem tamanho de numero com DDD.
- **O nono digito.** Cadastro antigo guarda celular com 8 digitos e ele **nao entrega**. O `9` entra
  quando o numero local tem 8 digitos e comeca em 6-9; comecando em 2-5 e fixo, e fixo fica fora
  (`--incluir-fixo` se ele quiser).
- **Numero sem DDD e recusado, nao chutado.** Nove digitos soltos nao viram `51`: chutar o DDD manda
  a mensagem para um desconhecido de outra cidade.
- **Exportacao de planilha vem em UTF-8 ou em Windows-1252, e ler errado nao da erro** — da
  "JoÃ£o", que vira contato torto no celular dele. A leitura tenta UTF-8 em modo severo e cai para
  1252 quando ele reclama.
- **O cabecalho da exportacao do mobiliza NAO foi observado.** Nao reconhecendo a coluna do
  telefone, a ferramenta **imprime o cabecalho e para**, em vez de escolher a primeira coluna com
  cara de numero e montar um .vcf errado em silencio.
- **Dobrar linha de vCard conta BYTES e corta em CARACTERE.** Acento ocupa 2 bytes e emoji 4: cortar
  por posicao de string parte o caractere no meio e alguns importadores engolem o cartao inteiro —
  a mesma classe do corte que partiu emoji no prompt da IA (22/09).
- **O armazenamento do navegador pode estourar em `file://`.** Pagina aberta de arquivo tem origem
  opaca; em janela privada ou com dados bloqueados a leitura **lanca** em vez de voltar vazia. Toda
  leitura vai dentro de `try`, e a pagina funciona sem ela — o numero de onde parou esta na tela.
- **O WhatsApp comum e o Business sao DOIS aplicativos para o Android**, e so o mecanismo
  `whatsapp://` nao sabe escolher entre eles: ele e atendido pelos dois e quem decide e o
  sistema. Os que nomeiam o pacote (`intent://`) escolhem. **O erro que isto evita e mandar
  quinhentas mensagens pelo numero pessoal sem perceber**, e por isso o nome do aplicativo
  fica escrito no botao que ele toca, a cada contato, e nao num canto da tela.
- **"Pular" nao conta no alvo.** O alvo e "quantas eu mandei", nao "quantas eu olhei": sem isso uma
  lista com muito numero errado faria a rodada "chegar em 30" tendo mandado dez.
- **Etiqueta pedida que nao existe no arquivo RECUSA a conversao.** O defeito dela e silencioso e
  caro: o nome errado nao casa com ninguem, nada aparece na tela, e **quem ele mandou pular
  recebe**. A saida explicita e `--mesmo-sem-a-etiqueta`, e a recusa ja lista as parecidas.
- **Lista de EXCLUSAO casa por nome EXATO, nunca por trecho contido.** `col` tiraria `COLINHA`,
  `Noroeste Colonial` e `COLORADO` de uma vez, sem nada dizendo quem sumiu. Caixa e acento nao
  contam, porque a base tem `SERRA` e `Serra` como etiquetas diferentes.
- **No XML da planilha o `&` chega escrito `&amp;`.** Sem desfazer, o nome entraria no celular com
  `&amp;` no meio e a etiqueta a pular nunca casaria.
- **Celula vazia SOME do XML do Excel**, entao a posicao da coluna sai da letra (`r="C2"`) e nunca
  da ordem de aparicao — contando na ordem, a planilha escorrega uma coluna a partir do primeiro
  branco. E a **celula que se fecha sozinha** (`<c r="A1"/>`) tem de ser reconhecida antes da que
  tem corpo, senao a leitura emenda a abertura de uma com o fechamento da outra e **rouba o valor
  da vizinha**.
- **No ZIP, o cabecalho local tem tamanhos de nome e de extra PROPRIOS**, diferentes dos do indice
  central. Usar os do indice comeca a ler alguns bytes adiante e o `inflate` estoura com
  "incorrect header check" — que parece arquivo corrompido e e conta errada.

---

## Log de decisoes

- **03/10/2026** — O WhatsApp comum e o Business sao pacotes diferentes
  (`com.whatsapp` e `com.whatsapp.w4b`), e com os dois instalados quem nao nomeia o pacote
  cai no que o Android escolher — medido: abriu o comum. A pagina passou a escolher o
  aplicativo, com **Business por padrao**, e o nome dele vai escrito no proprio botao.
- **03/10/2026** — **MEDIDO E RESOLVIDO: o mecanismo 3 (`intent://` com `scheme=smsto`)
  abre a conversa em modo aviao**, com contato importado e sincronizado, a partir de uma
  pagina aberta de arquivo local. A hipotese central do projeto esta de pe. Falta saber se
  o texto vai junto: a pagina copia antes de abrir, entao os dois casos funcionam.
- **03/10/2026** — Medido com ele: os tres mecanismos falharam, e o terceiro ofereceu
  *convidar por SMS* — o WhatsApp recebeu o pedido e nao reconheceu o numero como usuario.
  O teste usou o numero DELE, que nao esta salvo como contato: em modo aviao o WhatsApp nao
  tem como verificar e assume que nao tem conta. Entrou o mecanismo 4 (lista de contatos do
  WhatsApp, sem mandar numero), que nao depende dessa verificacao.
- **03/10/2026** — A sonda passou a testar TRES mecanismos por toque, com modo COPIA
  quando nenhum abre. Medido: digitar `whatsapp://` na barra de endereco nunca funciona
  — esquema de aplicativo so vale tocando num link.
- **03/10/2026** — Separador das variacoes passou de `---` para `===`: a regua de tracos da
  colinha dele partia a mensagem no meio. Seis aberturas aprovadas por ele; medida a
  semelhanca real entre elas (81,1%) e o que variar o formato da colinha renderia (59,0%).
  114 asercoes.
- **03/10/2026** — Le `.xlsx` direto e tira quem tem as etiquetas que ele mandar
  (`--pular-etiqueta`, nome exato, acento e caixa nao contam). Medido na exportacao dele: a
  etiqueta COLINHA nao existe nela, e nao ha etiqueta de recusa nenhuma. 105 asercoes.
- **03/10/2026** — Branch criada. Medido que a metade dos contatos nao precisa de app (vCard), e
  entregues `contatos-para-vcf.mjs` (com 69 asercoes) e `disparador.html` (toque por contato, zero
  rede). O app que aperta enviar sozinho **nao foi feito**, e o motivo esta na secao (b).

## Testes

```bash
node celular/contatos-vcf.test.mjs
```
