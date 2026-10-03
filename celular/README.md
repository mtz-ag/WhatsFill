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

- **`whatsapp://send?phone=...&text=...` abre a conversa em modo aviao?** O endereco e do proprio
  aplicativo (nao e `wa.me`, que passa por um servidor), entao deveria ser resolvido no aparelho.
  **Nunca foi observado neste projeto.** E o primeiro cartao do `disparador.html`, e o teste honesto
  e com **um contato que ele acabou de importar e nunca conversou**, nao com um numero que ja tem
  conversa aberta — a conversa que ja existe pode abrir por estar em cache e dizer que funcionou.
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
node celular/contatos-para-vcf.mjs "C:/Users/thiag/Desktop/contatos.csv" --saida="C:/Users/thiag/Desktop/disparo" --mensagens="C:/Users/thiag/Desktop/mensagens.txt"
```

O arquivo de mensagens e texto puro, com as variacoes separadas por uma linha com `---`:

```
Primeira versao do texto.
---
Segunda versao, dizendo a mesma coisa de outro jeito.
---
Terceira versao.
```

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
- **"Pular" nao conta no alvo.** O alvo e "quantas eu mandei", nao "quantas eu olhei": sem isso uma
  lista com muito numero errado faria a rodada "chegar em 30" tendo mandado dez.

---

## Log de decisoes

- **03/10/2026** — Branch criada. Medido que a metade dos contatos nao precisa de app (vCard), e
  entregues `contatos-para-vcf.mjs` (com 69 asercoes) e `disparador.html` (toque por contato, zero
  rede). O app que aperta enviar sozinho **nao foi feito**, e o motivo esta na secao (b).

## Testes

```bash
node celular/contatos-vcf.test.mjs
```
