# Publicação na Chrome Web Store — WhatsFill

Modo de publicação escolhido: **Não listada** (link direto instala; não aparece em busca nem em
categoria). É o canal correto para ferramenta interna: instala em um clique e **atualiza
sozinha**, sem depender de carregar pasta a cada perfil novo.

---

## Antes de submeter (uma vez só)

1. **Conta de desenvolvedor** — https://chrome.google.com/webstore/devconsole
   Taxa única de **US$ 5**, por conta (não por extensão).
2. **Política de privacidade num endereço público.** ✅ Já publicada como Gist público (o
   repositório é privado e não serviria de URL):

   ```
   https://gist.github.com/thiagokcw-coder/07b81a934626c55a88fd660c359a8914
   ```

   É esse link que vai no campo "Política de privacidade" do painel. Se editar
   [PRIVACY.md](PRIVACY.md), atualize o Gist:
   `gh gist edit 07b81a934626c55a88fd660c359a8914 PRIVACY.md`
3. **Uma captura de tela 1280×800** (ou 640×400). Ver o aviso sobre dados reais abaixo.

## Imagens da listagem

A documentação da loja é explícita: *"apenas o ícone da extensão, uma imagem promocional pequena
e uma captura de tela são obrigatórios"*.

| Imagem | Tamanho | Situação |
|---|---|---|
| Ícone | 128×128 | ✅ vai dentro do zip (`icons/icon128.png`) |
| **Promocional pequena** | **440×280** | ✅ `icons/promo-440x280.png` — **obrigatória** |
| Captura de tela | 1280×800 | ⬜ você fornece (mín. 1, até 5) |
| Marquee | 1400×560 | opcional — só serve para destaque, irrelevante em não listada |

A promocional pequena e a captura **não** entram no zip: são enviadas no formulário. O
`package.mjs` exclui `promo-*` de propósito.

Sem a promocional, a loja ordena a extensão atrás das que têm — o que não muda nada numa
listagem não listada, mas o campo é exigido no formulário.

A promocional foi desenhada no canvas do navegador (fundo claro, a marca do ícone, o nome e a
frase de valor). Para refazer, é mais simples redesenhar do que editar o PNG.

---

## Gerar o pacote

```bash
node tools/package.mjs
```

Sai em `dist/whatsfill-<versão>.zip`, contendo só o que a extensão precisa. Testes,
documentação, ferramentas e o `.git` ficam de fora — o script lista o que empacotou.

---

## Campos do formulário

**Nome:** `WhatsFill`

**Descrição curta** (limite 132 caracteres — esta tem 92):

```
Respostas prontas, variáveis e classificação em 1 clique para o atendimento no mobiliza.app.
```

**Descrição detalhada** (cole como texto puro — a loja **não** renderiza markdown, então
`**negrito**` apareceria com os asteriscos):

```
WhatsFill é uma ferramenta interna que acelera o atendimento na plataforma mobiliza.app.

O painel encaixa na borda direita da página e empurra o layout em vez de cobrir a conversa.

O que ele faz:

• Respostas prontas com variáveis ({{primeiro_nome}}, {{cidade}}, {{link_grupo}}), editáveis
  por você. Se alguma variável não resolver, o envio é bloqueado com o motivo na tela — nunca
  sai um marcador cru para o contato.
• Classificação preenchida a partir do que o contato escreveu, por regra determinística: lista
  de municípios do IBGE, dicionários e expressões que você mesmo cadastra. Sem IA, sem custo
  por contato.
• Etiqueta de região pelo COREDE do município, a partir da tabela oficial da Secretaria de
  Planejamento do RS (497 municípios).
• Conferência pós-escrita: toda gravação relê o contato e compara, porque a API responde 200
  ignorando o valor quando o formato não serve.
• Modelos de mensagem aprovados, listados da própria plataforma.

Nada é enviado para fora do navegador. Sem servidor, sem analytics, sem telemetria.
```

**Categoria:** Fluxo de trabalho e planejamento (Workflow & Planning)
**Idioma:** Português (Brasil)

---

## Propósito único

> Auxiliar o atendimento humano na plataforma mobiliza.app, dentro das abas dessa plataforma:
> inserir respostas prontas no campo de mensagem e preencher os campos de classificação do
> contato aberto.

Tudo na extensão serve a esse propósito, e ela não funciona fora de `mobiliza.app`.

---

## Justificativa de cada permissão

Copie no campo correspondente do painel.

**`storage`**

```
Guarda localmente as respostas prontas cadastradas pelo usuário, a tabela de grupos por
cidade, as regras de etiqueta e as preferências do painel. Nada é sincronizado nem enviado
para fora do navegador.
```

**Permissão de host** — atenção: o painel tem **um campo só** para todas as permissões de host,
não um por host. Explique os dois, senão a justificativa fica incompleta justamente no host que
lê e grava dado pessoal:

```
A extensão funciona exclusivamente no mobiliza.app, o CRM de atendimento por WhatsApp usado
pela nossa equipe. São dois hosts, ambos da mesma plataforma:

mobiliza.app — a extensão monta seu painel dentro da página e lê qual atendimento está aberto,
para saber de qual contato se trata.

api.mobiliza.app — lê os dados do contato aberto (nome, telefone, campos personalizados,
etiquetas) e grava de volta a classificação, usando a sessão que o próprio usuário já tem na
plataforma. É a mesma API que o site usa. Este host é indispensável porque a API valida o
header Origin e recusa requisições que não venham da aba do mobiliza.app.

Nenhum dado sai do navegador: não existe servidor nosso. Não pedimos acesso a nenhum outro site.
```

> O painel avisa que permissão de host leva a **revisão detalhada**. É esperado: atrasa a
> publicação, não reprova. Como o revisor não consegue executar a extensão (exige conta na
> plataforma), o que decide é ele entender o código — daí a importância das Instruções de teste.

**Código remoto:** não. Todo o JavaScript executado está empacotado na extensão. A única
requisição a terceiro é uma leitura única da lista pública de municípios do IBGE
(`servicodados.ibge.gov.br`), que é dado, não código.

---

## Instruções de teste (aba "Acesso")

Preencha. O revisor **não consegue** usar a extensão — ela só funciona logado no mobiliza.app, e
dar credenciais exporia dados pessoais de eleitores. Campo vazio aqui costuma virar reprovação
por "não foi possível verificar a funcionalidade".

```
Ferramenta interna, de uso restrito, que funciona exclusivamente dentro da plataforma
mobiliza.app — um CRM de atendimento por WhatsApp usado pela nossa equipe. Fora desse domínio a
extensão não tem funcionalidade: sem uma sessão autenticada, o painel apenas informa que não há
atendimento aberto. Por isso está publicada como NÃO LISTADA.

Não é possível fornecer credenciais de teste: a conta dá acesso a dados pessoais de terceiros
(contatos reais de eleitores), e compartilhá-la violaria nossa obrigação de proteção de dados
sob a LGPD.

O comportamento pode ser verificado no código-fonte do pacote, que não é minificado nem
ofuscado:

- src/main.js e src/panel/ — injetam o painel na página do mobiliza.app;
- src/lib/api.js — lê e grava os dados do contato na API da própria plataforma, usando a
  sessão que o usuário já tem;
- src/lib/extract.js e src/lib/tags.js — processam o texto das mensagens LOCALMENTE (regex e
  listas de referência) para sugerir cidade e etiquetas. Não há chamada a serviço de IA;
- src/lib/store.js — guarda preferências em chrome.storage.local.

Não há servidor: nenhum dado é enviado ao desenvolvedor ou a terceiros. A única requisição a
domínio de terceiro é uma leitura única da lista pública de municípios do IBGE
(servicodados.ibge.gov.br), que é dado aberto, não código.
```

---

## Divulgação de uso de dados

No formulário "Práticas de privacidade", marque:

| Pergunta | Resposta |
|---|---|
| Coleta informação de identificação pessoal? | **Sim** — nome e telefone do contato atendido |
| Coleta informação de saúde, financeira, autenticação, comunicações pessoais, localização, atividade de navegação? | **Comunicações pessoais: sim** (as mensagens do atendimento são lidas para extrair cidade e nome) |
| Vende ou transfere dados a terceiros? | **Não** |
| Usa dados para propósito não relacionado à função principal? | **Não** |
| Usa dados para avaliar crédito ou empréstimo? | **Não** |

Nas três declarações finais, marque que você **cumpre** a política de uso de dados.

Justificativa para o campo de texto livre, se houver:

```
Os dados de contato e as mensagens são lidos apenas dentro da aba do mobiliza.app, processados
localmente no navegador e gravados de volta na mesma plataforma de origem. Nenhum dado é
transmitido ao desenvolvedor ou a terceiros: a extensão não possui servidor.
```

---

## Captura de tela — cuidado com dado real

**Não** use uma captura com a fila de atendimentos visível: ela mostra nomes e telefones de
eleitores reais. Duas saídas:

1. Abrir o contato de teste ("Thiago Tim") e **recolher a coluna da esquerda** antes de
   capturar; ou
2. Capturar e borrar a lista antes de subir.

A imagem precisa ter exatamente 1280×800 ou 640×400.

---

## "Enviar para análise" está cinza

O botão só libera com **todas** as seções obrigatórias completas. O link **"Por que não consigo
enviar?"**, no topo do painel, lista o que falta. Na ordem em que costumam ficar esquecidas:

| Seção (menu lateral) | O que preencher |
|---|---|
| **Privacidade** | propósito único, justificativa de cada permissão, declaração de código remoto ("não uso"), URL da política e as declarações de conformidade |
| **Distribuição** | visibilidade **Não listada** e regiões |
| **Acesso → Instruções de teste** | o texto acima |
| Página "Detalhes do app" | ícone, ao menos 1 print e o bloco promocional pequeno |

---

## Depois de submeter

- Revisão de extensão não listada costuma sair em poucos dias.
- Para atualizar: suba a versão em `manifest.json`, rode `node tools/package.mjs` de novo e
  envie o novo zip. Quem já instalou atualiza sozinho.
- Guarde o link da loja: é por ele que se instala.
