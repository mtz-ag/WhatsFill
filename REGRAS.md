# As regras que você ditou

Levantamento pedido por você em 04/09/2026: *"eu quero que liste todas as regras que eu lhe falei
até agora"*.

Sai do `CLAUDE.md` e do `registro.md`, que é onde cada uma foi registrada com a data e o caso que a
originou. Aqui elas estão juntas, e cada uma diz **onde ela vive** — que é o que decide se ela
está valendo de verdade:

| onde vive | vale quando | risco |
|---|---|---|
| **código** | sempre | nenhum: só some se alguém apagar, e aí um teste cai |
| **quadro** | depois que você importa o fluxo | ordem errada ou caixa faltando muda o desfecho, em silêncio |
| **Config** | com o campo preenchido | **campo vazio = regra desligada**, sem aviso |

> A coluna importa: em 04/09 uma contato foi concluída sem receber nada porque uma regra sua de
> 03/09 tinha virado *valor padrão de um campo que você já tinha preenchido* — e default não
> alcança quem já tem valor salvo. Hoje aquela exceção é piso do código.

---

## 1. O que nunca sai daqui

| regra | onde vive |
|---|---|
| **A resposta nunca chama o contato pelo nome** (10/08). O nome do CRM erra demais — apelido do perfil, cidade no campo do nome, `[NOVO] …` — e sem valor o envio é bloqueado. | código |
| **A IA escolhe, não escreve.** Ela devolve o id de uma resposta pronta ou "escalar"; o texto que sai é, byte a byte, um que você escreveu. | código |
| **O rascunho da IA nunca envia sozinho** (03/09): *"retire essa mensagem automática, só no modo IA manda sem eu escolher"*. O caminho automático foi apagado, não desligado. | código |
| **Nada promete bem ou benefício** (Lei 9.504/97). Pedido de dinheiro e de emprego têm resposta que nega, e a IA não pode escolhê-las. | código |
| **Sem IA na extração.** Parser determinístico: regex, dicionário, IBGE, e confirmação sua em um clique. | código |

## 2. Quem não recebe nada

| regra | onde vive |
|---|---|
| **Recusou ou hostilizou** → etiqueta de sem interesse + conclui sem responder (01/09). E a etiqueta é **lida** na visita seguinte (03/09, o caso da susana): decisão sua não se redescobre. | código + **Config** (nome da etiqueta) |
| **Etiqueta de assessor → só conclui, nunca manda nada** (03/09) — *"contatos com etiqueta de assessor só conclua"*. **Com exceção do contato-assessor**, que é eleitor trazido por um assessor. | código (a exceção virou piso em 04/09) + Config |
| **Conversa que termina em mensagem nossa, ou em que ela nunca escreveu** → conclui sem mandar nada (03/09). | código |
| **Confirmou presença no evento → PULA, e você atende no fim** (03/09) — *"não é para responder, é para pular e eu atendo no final"*. Tecla 2 e não 3: é uma lista para montar, não um atendimento para fechar. | código |
| **Mandou o endereço, ou já tem a etiqueta de material → PULA** (04/09), para você transferir ao responsável. Quem manda é a **etiqueta**, não o detector. | código + **Config** (nome da etiqueta) |
| **Engajado**: mensagem do momento uma vez por dia e, depois, **conclui em vez de pular** (03/09). E não manda nada se você já respondeu hoje (04/09). | código + Config (lista de etiquetas) |

## 3. O que precisa de gente — e vence o material

| regra | onde vive |
|---|---|
| **Pergunta pendente tem prioridade máxima, e nunca se conclui com pergunta em aberto** (03/09, repetido em 04/09). É pergunta *a menos que* uma resposta pronta responda. | código + quadro (posição) |
| **Pedido de dinheiro, cesta ou remédio → a resposta que nega, ACIMA do modelo** (03/09, a Regina): *"modelo fora de contexto, ela quer ajuda financeira"*. Propaganda como primeira resposta a um pedido de socorro é errado mesmo com o texto inofensivo. | código + quadro |
| **Quer trabalhar no mandato → resposta própria** (02/09), porque trabalhamos com voluntários. | código + quadro |
| **Pediu que a gente ligasse → resposta própria** (04/09), que **não promete retorno**: não fazemos ligações. | código + quadro |
| **Pedido sem dizer o quê → fica com você ou com a IA** (03/09): *"já que pedido é algo difícil de ser identificado, será agora pra mim ou IA responder"*. A rodada PARA nesses contatos. | código |
| **Denúncia respondida à nossa própria pergunta → gente** (01/09). Material de campanha em cima de uma denúncia é o pior que pode sair daqui. | código + quadro |
| **Áudio sem transcrição, arquivo ou texto longo → gente.** Áudio **transcrito** não cai mais aqui: decide o conteúdo, não o formato. | código |
| **Transcrição de áudio NÃO decide "sem interesse"** (03/09, o lopezp4295): recusa de verdade a pessoa escreve. | código |
| **Quem escreve várias mensagens está conversando** (03/09): 3 mensagens próprias, ou 2 somando 250 caracteres, e o caso é seu. | código |

## 4. Anúncio, modelo e conteúdo

| regra | onde vive |
|---|---|
| **O modelo padrão CONFIRMA que a pessoa vai receber, não entrega conteúdo** (02/09). | código |
| **Cidade conhecida = recibo provavelmente já enviado** → o padrão não sai de novo (02/09). | código |
| **O modelo padrão só sai na PRIMEIRA vinda pelo anúncio** (04/09). "Padrão" é todo anúncio que não está cadastrado na Config. | código |
| **O modelo do anúncio RECONHECIDO sai mesmo com cidade** — ela clicou pedindo aquilo. | código |
| **Tecla `a`: modelo + pedido de dados na mesma passada** (02/09), sua escolha explícita. É a única tecla que manda duas mensagens. | código |
| **A etiqueta ADS é ORIGEM e nunca decide o modelo** (02/09): *"o conteúdo a ser mandado não deve ser decidido pelo ads, e sim pelo texto do ads"*. | código (piso `ORIGEM_SEMPRE`) |
| **Na chegada, pendência neutra vem DEPOIS do modelo** (02/09) — figura, cumprimento, despedida. Pedido, pergunta e áudio vêm **antes**: ali mandar a nossa mensagem primeiro É o dano. | quadro |
| **A ação do anúncio é do momento da chegada**: cumprida, o anúncio se cala e o quadro decide. | código |
| **A ação do anúncio nunca é texto livre** — são quatro ações permitidas. | código |

## 5. Tempo

| regra | onde vive |
|---|---|
| **A última mensagem dela é de outro dia → mensagem do momento** (03/09, generalizado em 04/09): *"responder o conteúdo de ontem soa a quem não estava lá"*. O corte é o **dia local**, não um número de horas. | código + quadro |
| **A única exceção ao tempo é pergunta pendente** (03/09) — e ela vive na **condição** da regra, não na posição, então vale em qualquer quadro. | código |
| **Não mandar quando já respondi hoje** (04/09, a Janete), mesmo que não tenha sido a mensagem do momento. | código |
| **A caixa da rodada diz sempre QUANDO foi a última mensagem dela** (04/09). | código |

## 6. Cadastro, cidade e etiquetas

| regra | onde vive |
|---|---|
| **Etiqueta de cidade é o nome do município e nada mais** (20/08): *"deixe somente caxias do sul"*. | código |
| **Cidade está FORA do automático**: todo palpite espera um clique seu. | código |
| **Nunca sobrescrever o que já está no CRM** — só preencher buraco. Exceção: a cidade que a própria pessoa informou. | código |
| **A cidade só sai de CONTEXTO, nunca de menção solta** (31/08): resposta ao formulário, mensagem curta que é a cidade, ou menção com pista. | código |
| **Palpite de cidade não-reconhecida não vira a pergunta "Cidade a gravar"** (04/09): *"não existe no IBGE, não aceite o palpite"*. | código |
| **A etiqueta que a rodada aplica também precisa ser LIDA na volta** (03/09). | código + Config |

## 7. O quadro do fluxo

| regra | onde vive |
|---|---|
| **A ordem é sua: no quadro, a posição é a prioridade** (01/09). Mover uma caixa para cima muda o que a rodada faz. | quadro |
| **Nada entra sozinho no quadro** — regra nova aparece no cartão "O padrão mudou?" e quem encaixa é você. | código |
| **O quadro é separado por categoria** (04/09): *"antes estava separado por categoria... agora ficou uma salada"*. A lista única foi desfeita no mesmo dia. | quadro |
| **Condição de ramo é sinal da lista + palavras, nunca texto livre** (01/09). | código |
| **Toda caixa tem exceção, inclusive as de regra** (03/09). A exceção só ESTREITA: nenhuma mensagem passa a sair por causa dela. | código |
| **Mexeu no padrão? Me mande o arquivo do fluxo no mesmo turno** (03/09). | processo |
| **O que sai da janela para mim é o fluxo inteiro, nunca só as observações** (01/09). | código |
| **Ação que mexe em tudo precisa de volta** (01/09): *"acabei de perder todo meu trabalho"*. Desfazer de 20 passos, gravado. | código |

## 8. Como a rodada se comporta

| regra | onde vive |
|---|---|
| **Falha de IA nunca para a rodada** (sem chave, sem rede, sem crédito: tudo vira "incerto"). | código |
| **Erro de ambiente PARA a rodada de propósito** (aba trocou, campo de mensagem sumiu); conveniência que quebra, não. | código |
| **Escalar abre a caixa, não pula** (02/09): *"pulando contato sem eu pedir"*. | código |
| **Pular não grava nada no CRM** (31/08): *"ao pular tem gravado dados no CRM, o que faz eu perder tempo"*. **Uma exceção, de 04/09**: a etiqueta de quem mandou o endereço. | código |
| **Automatizar a rodada executa as REGRAS também**, não só a IA — e a maioria das regras envia. | código |
| **Diálogo de confirmação a rodada resolve; de formulário ela devolve** (01/09): *"é para concluir e continuar mas está parando tudo"*. | código |
| **A caixa da rodada não escurece nem bloqueia a conversa**, e tem que caber na tela (04/09). | código |
| **Nos "Novos" a rodada também pergunta contato a contato**, a menos que "Automatizar" esteja marcado (03/09). | código |

## 9. Como eu devo trabalhar

| regra | onde vive |
|---|---|
| **Regra que você dita vira CÓDIGO, não default de campo** (04/09). Default só alcança instalação nova — e existe uma só, a sua. | processo |
| **Se conflita, remove** (04/09): *"se for necessário é para remover se der conflito com as novas regras"*. "Nada foi removido" não é garantia de nada. | processo |
| **Medir antes de mudar**, e dizer quando você está errado — você pede verificação, não concordância. | processo |
| **Toda anotação da rodada vira teste de regressão.** Bug encontrado ao vivo não volta em silêncio. | processo |
| **Nunca escrever telefone ou nome real de eleitor em arquivo do repositório.** | processo |
| **Testar sempre no contato "Thiago Tim"** — toda escrita é em produção. | processo |
| **Commit e push sem perguntar**, em português sem acentos, com o `registro.md` junto. | processo |

---

## O que está DESLIGADO agora por campo vazio

Três campos da aba Automatizado, todos em branco:

1. **Etiqueta de sem interesse** — a rodada marca e lê; vazia, ela redescobre a hostilidade do zero
   a cada visita.
2. **Etiqueta de quem pediu dinheiro ou emprego** — você quer `🔴Procura emprego ou dinheiro`.
3. **Etiqueta de quem mandou endereço** — a lista de material a enviar.

E os **modelos padrão**, que quando vazios fazem quem chega por anúncio não cadastrado receber só o
pedido de dados, em vez do recibo + pedido.
