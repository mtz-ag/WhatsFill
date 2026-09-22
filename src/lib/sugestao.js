/**
 * sugestao.js — o que a rodada RECOMENDA fazer com este contato.
 *
 * **Só recomenda. Nunca decide.** Todas as opções continuam na tela e todas as teclas continuam
 * valendo; isto escolhe qual sai destacada e escreve o porquê em cima. É essa fronteira que
 * permite uma regra ser agressiva ("sempre pedir dados") sem risco: o pior caso é um destaque
 * no lugar errado, não uma mensagem enviada errada.
 *
 * **Por que virou tabela.** O destaque nasceu espalhado em três expressões `primaria:` dentro do
 * montador da pergunta. Cada situação nova exigia mexer numa condição booleana no meio do
 * código, e ninguém conseguia dizer, olhando, qual regra tinha vencido. Aqui a ordem É a
 * prioridade: a primeira que casa ganha, e o motivo dela vai para a tela.
 *
 * **Como acrescentar uma situação** (o Thiago vai acrescentando conforme aparecem):
 * ponha uma entrada em `REGRAS`, na posição da prioridade dela, com `quando` e `motivo`. Nada
 * mais precisa mudar — o painel já lê a lista inteira.
 *
 * Puro e sem dependência, como tudo que decide sobre gente real neste projeto.
 */

/**
 * As regras, EM ORDEM DE PRIORIDADE. A primeira que casa vence.
 *
 * `tecla` é a mesma tecla que a caixa da rodada já usa, para o destaque cair na opção certa.
 * Pode ser uma FUNÇÃO quando a mesma situação pede teclas diferentes conforme o contexto — é o
 * caso de quem volta por outro anúncio, que ora merece a mensagem do momento, ora só concluir.
 * `quando(ctx)` recebe o retrato do contato; `motivo(ctx)` escreve a frase que aparece em cima.
 */
/**
 * **Não há o que pedir**: ou já sabemos o nome e a cidade, ou o formulário já saiu.
 *
 * Exportado porque o PAINEL precisa da mesma conta — print dele de 05/09/2026: o contato tinha
 * etiqueta de cidade (Erechim) e recebeu as boas-vindas com o *"nos informe Nome , Cidade"* dentro.
 * *"já tem os dados e pediu novamente"*. Uma definição só: duas cópias divergem na primeira
 * guarda nova, e a que ninguém olha é a que pede o cadastro de quem já o deu.
 *
 * `jaPediramDados` entra junto de propósito — pedir duas vezes soa a robô, mesmo sem resposta.
 */
/**
 * **O contato deve ganhar a etiqueta de quem PEDIU DINHEIRO OU EMPREGO?** — pedido dele (10/09/2026):
 * *"como a IA atende pedido de ajuda e dinheiro, a etiqueta não está sendo colocada"*.
 *
 * A etiqueta era aplicada só quando saía uma das duas respostas prontas que negam
 * (`pedido-ajuda`, `pedido-emprego`). Desde a 3.10 (08/09) quem responde esses casos é a IA, que
 * escreve texto livre — nenhuma resposta pronta sai, e a marca nunca era posta. **Agora quem decide é o
 * SINAL, não a resposta**: reconhecido o pedido, marca, seja quem for que responda.
 *
 * **Quem quer TRABALHAR NA CAMPANHA fica de fora** (`pedeEmprego` com `tipo: 'campanha'`): é militância
 * voluntária, não procura de emprego, e a etiqueta é permanente no CRM.
 *
 * @returns {string|null} o motivo, para o Andamento, ou `null`
 */
export function motivoDaEtiquetaDePedido(c) {
  if (c?.pedeAjudaFinanceira) return 'pediu dinheiro ou ajuda financeira';
  if (c?.pedeEmprego && c.pedeEmprego.tipo !== 'campanha') return 'procura emprego';
  return null;
}

export const pedirDadosNaoCabe = (c) =>
  !!(c?.jaDeuNomeECidade || c?.jaPediramDados || c?.temEtiquetaDeCidade);

/**
 * **Este caso é uma NEGATIVA?** — o que impede o rascunho de fechar pedindo o cadastro.
 *
 * Print de 12/09/2026: alguém se ofereceu como pintor e pediu um Pix, e o rascunho negou o dinheiro,
 * negou a contratação e **terminou pedindo `Nome , Cidade`**. Ele: *"resposta da IA pedindo dados
 * fora de contexto; esse é um caso onde a pessoa 90% das vezes não tem interesse, é praticamente
 * venda de votos"*.
 *
 * **O formulário não é errado em si — é errado no fim de um "não".** Ele existe para classificar
 * quem vai receber conteúdo; grudado numa negativa vira formulário em cima de uma recusa, e quem lê
 * entende que ninguém leu o que escreveu. É a mesma família das frases prontas com premissa
 * (a Dileta, 09/09): o que sai afirma algo sobre a conversa que não aconteceu.
 *
 * **É separada de `pedirDadosNaoCabe` de propósito, e não uma condição nova dentro dela.** Aquela
 * responde *"nós já temos o cadastro?"* e guarda também o formulário da RODADA — quem pede dinheiro
 * continua recebendo o pedido de nome e cidade quando ele sai sozinho, sem negativa colada. Esta
 * responde *"o que vamos dizer agora é um não?"*, e vale só no rascunho da IA.
 *
 * @param {object} c os sinais do contato
 * @returns {boolean}
 */
// SEM INTERESSE também (22/09/2026, a Cleusa): *"casos de sem interesse e de pessoas procurando emprego
// ou dinheiro não faz sentido perguntar os dados, a pessoa não vai dar"*.
export const casoDeNegativa = (c) => !!(c?.pedeAjudaFinanceira || c?.pedeEmprego || c?.semInteresse);

export const REGRAS = [
  {
    id: 'sem-interesse',
    tecla: 's',
    /**
     * Recusou ou veio hostilizar → etiqueta e conclui, **sem responder**.
     *
     * Pedido dele (01/09/2026): *"falando mal do bolsonaro e martim é aliado do bolsonaro, esse
     * tipo nós botamos etiqueta sem interesse e concluímos sem responder"*, depois de a rodada
     * pedir os dados a dois contatos sem interesse — um deles respondendo *"Não porque vocês
     * pensam que os gaúchos são burros…"*.
     *
     * **Fica em PRIMEIRO, acima até da etiqueta que dispensa da fila.** Quem pediu para não ser
     * chamado não pode receber mais nada, e é a única regra aqui em que continuar mandando
     * mensagem gera denúncia — o sinal que derruba número. Nenhuma outra decisão faz sentido
     * depois desta.
     *
     * **Tecla `s`, não um dígito.** As dez teclas numéricas já têm significado no dedo dele, e
     * trocar o sentido de uma é como o "2" digitado na conversa acabou concluindo atendimento.
     *
     * Quem detecta é `cortesia.semInteresse`, e ela exige sinal forte: recusa explícita, negativa
     * na abertura que não seja uma das benignas ("não faço parte de nenhum grupo" é resposta de
     * apoiador), ou insulto **junto** de fala em segunda pessoa. Insulto ao adversário em terceira
     * pessoa é o que mais aparece nesta base e não conta — tratar isso como recusa tiraria da fila
     * justamente quem mais apoia.
     */
    /**
     * **Conversa longa NÃO é decidida por esta regra** — decisão dele (05/09/2026), com a print de
     * um contato que chegou pelo anúncio, escreveu **927 caracteres** de análise política e foi
     * etiquetado como sem interesse: *"duas conversas longas foram reconhecidas como sem interesse;
     * for assim, eu que analiso ou a IA"*.
     *
     * **Recusa de verdade é curta.** *"Não quero receber"*, *"me tira da lista"*, *"para de mandar"*
     * — quem pede para sair escreve uma linha e vai embora. Quem escreve nove linhas está
     * conversando, mesmo quando o assunto é raivoso: a base é de apoiadores que falam mal do
     * adversário, e é justamente aí que o detector erra. A guarda do texto curto já existia dentro
     * de `COMECA_NEGANDO` (28 caracteres, o caso do Alfredo); aqui ela vale para a regra inteira.
     *
     * A exceção mora na CONDIÇÃO e não na ordem do quadro, de propósito: `sem-interesse` é
     * proteção do código e decide **mesmo nos quadros que ele já exportou**, onde uma caixa nova
     * nunca chega. Ordem só valeria para quem reimportasse.
     *
     * **O custo:** quem escreve um texto longo pedindo para sair não é marcado nem concluído — vai
     * para ele, com a tecla 6. É o lado barato: esta é a regra mais destrutiva do arquivo (etiqueta
     * permanente no CRM **e** conclusão em silêncio), e o erro dela não se desfaz sozinho.
     */
    quando: (c) => !!c.semInteresse && !c.pedeRespostaPessoal,
    motivo: (c) => `${c.semInteresse.motivo} — marque "sem interesse" e conclua sem responder.`,
  },
  {
    id: 'etiqueta-so-conclui',
    tecla: '3',
    /**
     * **Etiqueta que só conclui — assessor, equipe, quem não é eleitor a atender.**
     *
     * Pedido dele (03/09/2026): *"contatos com etiqueta de assessor só conclua"*. É diferente da
     * etiqueta que dispensa da fila, que hoje manda a mensagem do momento uma vez: aqui **nada
     * sai, nunca**. Mandar material de campanha para quem trabalha no mandato não é inofensivo —
     * é ruído para quem já está do lado de dentro.
     *
     * **Fica acima da que dispensa** justamente porque as duas casariam no mesmo contato se ele
     * pusesse a mesma palavra nas duas listas, e o desfecho mais silencioso tem que ganhar.
     *
     * A lista é dele, na aba Automatizado, e nasce com "assessor". Como a de baixo, ela lê as
     * etiquetas REAIS do contato (`state.contact.tagsId` cruzado com o CRM) e não a lista da
     * caixa — que só mostra o que a rodada sugere.
     */
    quando: (c) => !!c.etiquetaSoConclui,
    motivo: (c) => `tem a etiqueta "${c.etiquetaSoConclui}" — é da casa: conclua sem mandar nada.`,
  },
  {
    id: 'ultima-e-nossa',
    tecla: '3',
    /**
     * **A última mensagem da conversa é NOSSA — não há o que responder.**
     *
     * Print dele (03/09/2026): a conversa tinha só o nosso disparo (*"É hoje, Rio Grande do Sul!"*
     * + o pedido de salvar o contato), ele assumiu o atendimento às 11:27 e a rodada mandou o
     * pedido de nome e cidade em cima. Relato: *"pegando conversas que a última mensagem foi minha
     * e mandando mensagem, é pra concluir sem mandar nada"*.
     *
     * Vale também para quem **não escreveu nada** — a conversa em que só nós falamos é o mesmo
     * caso, e era a que escapava: sem mensagem dela, `hsm.decidirSemResposta` não tem `ultima`
     * para olhar e o caso descia até `nunca-pediram-dados`, que envia.
     *
     * **Fica logo abaixo das etiquetas e acima de tudo o que envia.** Não é sobre o que a pessoa
     * escreveu; é sobre não haver nada a responder — e nesse caso qualquer regra abaixo estaria
     * respondendo a nós mesmos.
     *
     * `hsm.decidirSemResposta` continua existindo e roda ANTES da tabela: ela conclui na hora,
     * sem passar por aqui, quando a nossa mensagem é recente. Esta regra é a rede para o resto —
     * inclusive a conversa vazia, que aquela não enxerga.
     */
    quando: (c) => !!c.ultimaEhNossa,
    motivo: (c) =>
      c.ultimaEhNossa === 'vazia'
        ? 'o contato não escreveu nada nesta conversa — conclua sem mandar nada.'
        : 'a última mensagem da conversa é nossa — conclua sem mandar nada.',
  },
  {
    id: 'confirmou-presenca-evento',
    tecla: '2',
    /**
     * **Confirmou presença no evento → PULA, e ele atende no fim.**
     *
     * Pedido dele (03/09/2026), com a print da Elci: ela escreveu duas vezes *"Quero confirmar
     * minha presença no evento: AMIGOS CAPITAO MARTIM E GUSTAVO VICTORINO"*, a rodada respondeu
     * *"Que bom! Será uma grande satisfação contar com você… Nome / Cidade"* e concluiu. Ele:
     * *"não é para responder, é para pular e eu atendo no final — nessa situação de confirmação
     * para evento"*.
     *
     * **É diferente de tudo o mais nesta tabela, e por isso a tecla é 2 e não 3.** Confirmação de
     * presença não é um atendimento que se fecha: é uma lista que alguém precisa montar, com
     * nome, cidade e a confirmação conferidos por gente. Pular deixa o atendimento ABERTO, onde
     * ele estava — concluir tiraria da tela justamente quem ele quer atender depois.
     *
     * **Isto substitui `confirmou-presenca-com-dados`**, que agradecia e encerrava, e o preâmbulo
     * de evento da tecla 4 continua existindo para quem responde que **não** vai: o sinal aqui é
     * só o "sim".
     *
     * Fica acima da etiqueta que dispensa da fila de propósito: engajado que confirma presença é
     * ainda mais o caso dele — a etiqueta mandaria a mensagem do momento por cima da confirmação.
     */
    quando: (c) => !!c.confirmouPresenca,
    motivo: () => 'confirmou presença no evento — pulei para você atender no fim, com a lista na mão.',
  },
  {
    id: 'informou-endereco',
    tecla: '2',
    /**
     * **Mandou o endereço → PULA, e a conversa é transferida no fim.**
     *
     * Pedido dele (04/09/2026), com o anúncio novo de material de campanha: *"eu peço endereço...
     * a pessoa deve ser pulada e não concluída, pois vou transferir pro responsável a conversa no
     * final"*.
     *
     * **A tecla é 2 e não 3 pela mesma razão da confirmação de presença**, e o motivo aqui é ainda
     * mais literal: concluir tiraria da tela justamente a conversa que precisa ser passada para
     * outra pessoa. Pular deixa o atendimento aberto, onde ele estava.
     *
     * Fica junto das proteções, acima de tudo o que envia. Quem mandou o endereço já está no fim
     * do próprio atendimento: qualquer mensagem nossa aqui — o modelo, o agradecimento, a do
     * momento — chega por cima de um pedido que já foi entendido e está esperando o material.
     *
     * **Quem manda é a ETIQUETA**, e isso é regra dele no mesmo dia: *"para pular o contato sempre
     * será depois que eu pedir o endereço e etiqueta for colocada"*. O campo é "Etiqueta de quem
     * MANDOU ENDEREÇO", na aba Automatizado. O detector de endereço é a outra ponta: reconhece a
     * resposta e aplica a marca, para ele não ter que marcar contato por contato.
     *
     * **O detector sozinho não sustenta o caso, de propósito.** Ele lê a rajada, então some assim
     * que respondemos; é a etiqueta que carrega o estado adiante — e é ela que ele tira quando a
     * conversa for transferida, devolvendo o contato ao fluxo normal. Detector é palpite; a marca
     * é decisão, e decisão não se redescobre (mesma lição da etiqueta de sem interesse).
     */
    quando: (c) => !!c.informouEndereco,
    motivo: () => 'é caso de material a enviar — pulei para você transferir no fim.',
  },
  {
    id: 'etiqueta-dispensa-da-fila',
    /**
     * **Já respondemos hoje? Então nada sai** — anotação da Janete (04/09/2026).
     *
     * Ela tem a etiqueta "Engajado", mandou dois áudios e clicou em dois anúncios, e a caixa
     * ofereceu a mensagem do momento. Ele: *"já mandei mensagem hoje, mesmo não sendo do momento —
     * não mandar quando já respondi"*.
     *
     * A guarda que existia era `momentoJaEnviado`, que só sabe da mensagem do momento. Quem
     * respondeu à mão, ou com outra resposta pronta, não aparecia ali — e o engajado que fala o dia
     * inteiro recebia a mensagem do momento por cima da conversa que ele acabara de ter.
     *
     * `respondidoHoje` é a mesma guarda que `ultima-e-so-reacao` já usava, e pela mesma razão:
     * mais uma mensagem nossa no mesmo dia é empilhar, não atender.
     */
    tecla: (c) => (c.respondidoHoje || c.momentoJaEnviado || !c.podeMandarMomento ? '3' : '5'),
    /**
     * Etiqueta que dispensa o contato da rodada (configurável na aba Automatizado).
     *
     * Pedido dele: quem tem "engajado" pode ser pulado. Faz sentido — o trabalho da rodada é
     * transformar desconhecido em engajado; quem já chegou lá não precisa de formulário nem de
     * pergunta de interesse.
     *
     * **Fica em PRIMEIRO — e isto é uma reversão minha, decidida por ele** (31/08, print do
     * Deoclecio): *"veja isso também que não pulou o engajado"*, num contato engajado que tinha
     * mandado um vídeo.
     *
     * Eu tinha posto esta regra abaixo de "pede resposta pessoal" argumentando que engajado com
     * áudio é quem mais merece resposta. O argumento é bonito e o trabalho dele desmente: o que
     * o engajado manda, na prática, é vídeo e link de política o dia inteiro. Responder a cada um
     * não é atenção, é não conseguir sair da fila.
     *
     * Continua sendo só sugestão: a tecla 6 está lá, a um toque, para quando o vídeo merecer.
     *
     * **Deixou de PULAR, por pedido dele** (03/09/2026, anotação do Paulo Cézar): *"engajado
     * recebe mensagem do momento uma vez por dia e depois toda vez que aparecer pode concluir em
     * vez de pular"*.
     *
     * Pular deixava o atendimento aberto para sempre — o engajado que manda vídeo o dia inteiro
     * ficava na fila em toda rodada, custando uma abertura por passada, que é o que derruba a API.
     * E ele nunca recebia nada, mesmo sendo quem mais fala com o gabinete.
     *
     * O desfecho passou a ser o mesmo par de `voltou-por-outro-anuncio`, pela mesma razão: alguma
     * coisa a pessoa recebe, uma vez; depois disso o certo é fechar e seguir.
     *
     * **Consequência a lembrar: esta regra deixou de ser uma PROTEÇÃO.** Enquanto o efeito era
     * `silencio`, ela barrava a ação do anúncio (ver `anuncios.decidirComAnuncio`) e a janela do
     * fluxo acusava caixa que envia pendurada nela. Agora ela envia — a proteção que continua de
     * pé é `sem-interesse`.
     */
    quando: (c) => !!c.etiquetaQueDispensa,
    motivo: (c) =>
      c.respondidoHoje
        ? `tem a etiqueta "${c.etiquetaQueDispensa}" e você já respondeu hoje — conclua e siga.`
        : c.momentoJaEnviado || !c.podeMandarMomento
          ? `tem a etiqueta "${c.etiquetaQueDispensa}" e já recebeu a mensagem do momento — conclua e siga.`
          : `tem a etiqueta "${c.etiquetaQueDispensa}" — já está engajado: mande a mensagem do momento e conclua.`,
  },
  {
    id: 'nao-pode-falar-agora',
    tecla: '6',
    /**
     * **Ela está passando mal, ou avisou que fala depois → você ou a IA.**
     *
     * Print da Elenir (05/09/2026): chegou pelo anúncio das Escolas Cívico-Militares e, quatro
     * minutos depois, escreveu *"Não posso falar. Estou com infecção urinária e respiratória. muita
     * tosse e febre. Falarei assim que for possível. Faço oração pela minha recuperação salutar por
     * gentileza. Grata"*. A rodada **ignorou e concluiu** — *"caso de mal estar foi ignorado e
     * concluído"*.
     *
     * **Fica ao lado de `ultima-pede-resposta-pessoal`, e na mesma caixa**: as duas dizem a mesma
     * coisa — aqui precisa de gente. Concluir é o pior dos dois desfechos possíveis, porque ela
     * avisou que voltaria e fechar responde que não precisa.
     *
     * O detector exige **primeira pessoa**, e é o que sustenta a regra: nesta base a doença aparece
     * na fala política (*"o Brasil está doente"*), no pedido de remédio (que tem regra própria,
     * acima desta) e na notícia de terceiro. Metade das asserções do teste é falso positivo.
     */
    quando: (c) => !!c.naoPodeFalarAgora,
    motivo: (c) => c.naoPodeFalarAgora.motivo,
  },
  {
    id: 'reclama-sem-resposta',
    tecla: '6',
    /**
     * **Ela reclama de não ter sido atendida → você ou a IA.** Decisão dele (09/09/2026), sobre o
     * print do Maicon: *"Ninguém quis entrar em contato comigo"*, escrito quatro minutos depois de
     * ele chegar pelo anúncio. Perguntado se aquilo devia virar tecla 6: *"virar tecla 6"*.
     *
     * **Não existe resposta pronta para isto, e escrever uma seria pior.** O que a pessoa está
     * dizendo é que nós falhamos com ela; texto automático em cima disso **confirma a queixa**, e
     * concluir em silêncio confirma duas vezes. É a mesma família de `nao-pode-falar-agora`: aqui
     * precisa de gente, e por isso as duas dividem a caixa de `ultima-pede-resposta-pessoal`.
     *
     * **A guarda é o ALVO ser NÓS**, e é ela que sustenta a regra: nesta base *"ninguém me
     * respondeu"* é dito o tempo todo sobre a prefeitura, o CRAS, o INSS e o banco — e aí é o
     * OPOSTO, é o caso que o mandato existe para encaminhar. 12 das 22 asserções são falso positivo.
     */
    quando: (c) => !!c.reclamaSemResposta,
    motivo: (c) => c.reclamaSemResposta.motivo,
  },
  {
    id: 'ultima-pede-resposta-pessoal',
    tecla: '6',
    /**
     * Áudio, vídeo, documento ou texto longo → responder à mão.
     *
     * **Vence tudo menos a etiqueta que dispensa da fila.** Foi o caso que ele trouxe: contato
     * JÁ classificado, com etiqueta e conteúdo pedido, que mandou um áudio de 1min13 contando da
     * família, da igreja e do convite para almoçar. A caixa sugeria mandar o modelo aprovado — e
     * mandar modelo para quem acabou de falar isso parece deboche.
     *
     * Só o "engajado" passa na frente, e por decisão dele: engajado manda vídeo e link o dia
     * inteiro, e responder a cada um é não sair da fila.
     *
     * Ter etiqueta não quer dizer que a conversa acabou. O que a pessoa acabou de dizer manda
     * mais do que o que ela pediu semana passada.
     */
    quando: (c) => !!c.pedeRespostaPessoal,
    motivo: (c) => `${c.pedeRespostaPessoal.motivo}. Responda à mão.`,
  },
  {
    id: 'respondeu-nossa-pergunta',
    tecla: '6',
    /**
     * **Nós perguntamos, ela respondeu. Isso precisa de gente.**
     *
     * Print de 01/09/2026, e o pior caso que este projeto já produziu: a rodada perguntou às 14:22
     * *"em que você precisa de ajuda?"*, a contato respondeu às 16:19 *"é sobre as irregularidades
     * sobre compra assistida em eldorado do sul"* — denúncia sobre programa público, que é
     * literalmente o trabalho de um mandato — e recebeu **material de campanha**.
     *
     * A regra `pediu-algo-sem-dizer-o-que` funcionou: ela é que mandou a pergunta. O que faltava
     * era o passo seguinte. A própria docstring dela dizia que *"a recusa só cabe depois de ela
     * dizer o que quer"* — e esse "depois" não existia em lugar nenhum, então a resposta caía até
     * `conteudo-pedido`, que ENVIA propaganda.
     *
     * **Fica acima de `pediu-algo-sem-dizer-o-que`** para não perguntar de novo o que ela acabou
     * de responder.
     *
     * Não tem desfecho automático de propósito: quem abriu um caso perguntando tem que ler a
     * resposta. Tecla 6 segura o contato até alguém tratar — e como a tecla 6 consulta a IA, ela
     * ainda pode sugerir uma resposta pronta, mas nenhuma regra decide isso sozinha.
     */
    quando: (c) => !!c.respondeuComoAjudar,
    motivo: (c) => `você perguntou em que podia ajudar e ela respondeu: "${c.respondeuComoAjudar.trecho}". Leia e responda.`,
  },
  {
    id: 'pediu-algo-sem-dizer-o-que',
    /**
     * **A tecla virou 6 em 03/09/2026: o caso vai para ele ou para a IA, e nada sai sozinho.**
     *
     * Decisão dele, depois da print da Odete (*"Preciso do nome de um deputado federal que seja de
     * direita"* recebendo *"em que você precisa de ajuda?"*): *"já que pedido é algo difícil de ser
     * identificado, será agora pra mim ou IA responder"*.
     *
     * Ele está certo sobre a natureza do sinal. Ajustar o padrão conserta o caso que apareceu e não
     * conserta a classe: **"pedido" não é uma forma de frase, é uma intenção**, e toda tentativa de
     * cercá-la por texto erra para um dos dois lados — ou pergunta em cima de quem já explicou (a
     * Odete), ou manda material de campanha em cima de quem está pedindo socorro (a Mari). Das duas,
     * a segunda é a cara, e é ela que a regra existe para impedir.
     *
     * **O que NÃO mudou é o que a regra protege.** Ela continua no alto, continua vencendo a
     * despedida, e continua impedindo que qualquer caixa de baixo mande o modelo. O que mudou é só
     * o desfecho: em vez de disparar a pergunta pronta, o caso para com ele — e com a avaliação por
     * IA ligada, é a tecla 6 que a chama. A pergunta continua a um clique, na tecla 9.
     *
     * Consequência a lembrar: **a rodada PARA nesses contatos** em vez de perguntar e seguir. Foi a
     * troca que ele escolheu, sabendo.
     */
    tecla: '6',
    /**
     * Ela pediu algo e não disse o quê → **perguntar**, nunca responder.
     *
     * Print da Mari (31/08): *"Preciso da forca do senhor"*, e a caixa sugeria **mandar o modelo
     * da campanha**. Ele: *"provável pedido financeiro ou trabalho, vou perguntar em que posso
     * ajudar? para ter certeza"*.
     *
     * **É a regra de maior risco do arquivo, e por isso fica no alto.** Pedido de dinheiro ou de
     * emprego não pode receber resposta automática (Lei 9.504/97), e material de campanha em cima
     * de quem está pedindo ajuda é pior do que não responder. Só perdem para ela a etiqueta que
     * dispensa da fila e o áudio — que precisa ser ouvido antes de qualquer decisão.
     *
     * **Vence a despedida de propósito.** "Preciso da sua força, abraço" tem despedida dentro, e
     * concluir ali é fechar a porta na cara de um pedido.
     *
     * Perguntar não promete e não nega: a recusa (`pedido-ajuda`, `pedido-emprego`) só cabe
     * depois de ela dizer o que quer, e negar antes disso ofende quem só queria apoio político.
     */
    /**
     * **Sem `podePerguntarAjuda`**: essa guarda existia porque a regra DISPARAVA aquele texto, e
     * oferecer uma tecla que trava por variável faltando é pior que não oferecer. Agora a regra não
     * manda nada — condicionar o desfecho à saúde de um template que não vai sair deixaria o caso
     * de maior risco do arquivo escapar para as caixas de baixo, que enviam.
     */
    quando: (c) => !!c.pedeAlgoIndefinido,
    motivo: (c) =>
      `"${c.pedeAlgoIndefinido.trecho}" — pediu algo, e o quê não está claro. Responda você (ou a IA).`,
  },
  {
    id: 'ultima-e-despedida',
    tecla: '3',
    /**
     * A pessoa só fechou a conversa: "É nós", "tamo junto", "abraço", "valeu".
     *
     * Pedido dele, com a print de quem escreveu apenas *"É nós."* e recebeu "mande o modelo":
     * *"a pessoa só fechou a conversa… eu concluo a conversa"*.
     *
     * **Fica acima de "conteúdo pedido", e é esse o ponto.** Ela já tinha recebido o conteúdo às
     * 10:46 e escreveu "É nós" às 14:30 — a mensagem era o agradecimento, não um novo pedido.
     * Mandar o modelo de novo ali é responder a uma despedida com propaganda.
     *
     * Concluir e não pular: a conversa acabou de verdade, e o contato volta sozinho para "Meus"
     * se escrever de novo. Pular deixaria a fila cheia de conversas encerradas.
     */
    quando: (c) => !!c.ultimaEhDespedida,
    motivo: () => 'ela só se despediu ("é nós", "abraço") — a conversa acabou. Conclua.',
  },
  {
    id: 'voltou-por-outro-anuncio',
    /**
     * Ignorou o pedido de dados e voltou clicando em OUTRO anúncio.
     *
     * Relato dele: *"uma situação frequente é a pessoa ignorar o pedido de dados e retornar por
     * outro anúncio; quando isso acontece ou eu concluo e vou pra próxima ou mando mensagem do
     * momento"*.
     *
     * **Pedir os dados de novo é o que NÃO serve aqui** — e é justamente o que a regra de "sem
     * etiqueta de cidade" sugeriria, por isso esta vem antes dela. A pessoa já viu o formulário e
     * escolheu não responder; repetir vira a terceira mensagem igual.
     *
     * A tecla é os dois desfechos que ele descreveu, escolhidos pelo que já saiu: se a mensagem
     * do momento ainda não foi, ela vai (alguma coisa a pessoa recebe); se já foi, só concluir.
     *
     * **Sem a condição de "não tem cidade", que era minha e estava errada** (31/08, print do
     * Telmo): cidade Viamão, modelo enviado às 10:28, e às 18:24 ele voltou por outro anúncio. A
     * rodada sugeria mandar o modelo de novo. Ele: *"voltou diversas vezes por anúncios, já
     * mandei mensagem do momento = concluir"*. Voltar por anúncio é sobre o que a pessoa acabou
     * de fazer; ter cidade não muda isso.
     *
     * E "já mandei" não é "hoje": a chave do envio inclui um resumo do texto, então a conta é
     * sobre a mensagem do momento ATUAL.
     */
    /**
     * **"Não mande o mesmo conteúdo de novo" pressupõe que o conteúdo é o mesmo.**
     *
     * Anotação da Eroni (03/09/2026): ela recusou o convite do evento e depois clicou em DOIS
     * anúncios diferentes — *"Eu escolho o lado da Liberdade"* e *"Eu apoio as Escolas
     * Cívico-Militares"*. A caixa ofereceu a mensagem do momento. Relato dele: *"aqui ela veio por
     * outro modelo sem ser o padrão, mandar o modelo pedido e pedir dados que falta"*.
     *
     * Ele está certo e o defeito é meu: esta regra existe para quem volta pedindo **a mesma
     * coisa** (print do Telmo, 31/08 — modelo enviado às 10:28, volta às 18:24). Quando o anúncio
     * novo pede um modelo que **nunca saiu**, o conteúdo é outro, e negá-lo é deixar de entregar o
     * que ela acabou de pedir.
     *
     * `modeloJaNaConversa` é a pergunta certa porque ele olha o modelo que sairia AGORA: para o
     * Telmo é verdadeiro (é o mesmo), para a Eroni é falso. Não casando aqui, o caso desce para
     * `anuncio-modelo-e-dados`, que manda o modelo e pede os dados na mesma passada — exatamente o
     * que ele descreveu.
     */
    tecla: (c) => (c.momentoJaEnviado || !c.podeMandarMomento ? '3' : '5'),
    quando: (c) => c.voltouPorOutroAnuncio && c.modeloJaNaConversa,
    motivo: (c) =>
      c.momentoJaEnviado || !c.podeMandarMomento
        ? 'voltou por outro anúncio e já recebeu a mensagem do momento — conclua e siga.'
        : 'voltou por outro anúncio — não mande o mesmo conteúdo de novo; a mensagem do momento serve.',
  },
  {
    id: 'rajada-de-anuncios',
    /**
     * **Ela só clicou em anúncios, vários seguidos → mensagem do momento e conclui.**
     *
     * Print da Irene (05/09/2026): três cliques em anúncios diferentes do Instagram, nada mais
     * escrito, e a caixa ofereceu o modelo de um deles (*"Campanha Segurança"*). Ele: *"rajada de
     * entrada em anúncio, mensagem do momento e concluir"*.
     *
     * Quem clica em três anúncios está navegando, não pedindo uma coisa: o modelo de um deles
     * responde a um terço do que ela fez, escolhido pela ordem em que a rodada varre a conversa.
     * Mandar os três seria rajada para o mesmo número. A mensagem do momento serve para todos.
     *
     * **Fica ACIMA do modelo do anúncio nos dois ramos**, que é quem ela precisa vencer — e abaixo
     * de tudo o que precisa de você, que já está mais em cima.
     *
     * **Não colide com a Eroni** (03/09), onde a decisão dele foi mandar o modelo novo: lá ela
     * **escreveu** (recusou o convite do evento) além de clicar, e `rajadaDeAnuncios` exige que a
     * rajada seja SÓ cliques. Tem teste com os dois casos lado a lado.
     */
    tecla: (c) => (c.momentoJaEnviado || !c.podeMandarMomento ? '3' : '5'),
    quando: (c) => !!c.rajadaDeAnuncios,
    motivo: (c) =>
      c.momentoJaEnviado || !c.podeMandarMomento
        ? `${c.rajadaDeAnuncios.motivo} — e a do momento já saiu: conclua.`
        : c.rajadaDeAnuncios.motivo + '.',
  },
  {
    id: 'anuncio-modelo-e-dados',
    tecla: 'a',
    /**
     * **O recibo do anúncio e o começo do atendimento, na mesma passada.**
     *
     * Escolha dele (02/09/2026): *"o modelo seria uma resposta automática ao anúncio, o atendimento
     * vem depois disso que seria pedir dados e responder as perguntas"* — e, perguntado se "depois"
     * era a mesma passada ou a seguinte, **a mesma**, sabendo que são duas mensagens seguidas.
     *
     * A versão anterior mandava só o modelo na chegada e pedia os dados na passada seguinte. O
     * custo era real: a rodada só volta a quem escreveu de novo, então **quem recebia o modelo e
     * sumia nunca era perguntada** — e sem nome e cidade não há o que classificar, que é o trabalho
     * inteiro desta extensão.
     *
     * A condição exige **as duas metades disponíveis**. Faltando uma, esta regra não casa e as
     * antigas seguem valendo sozinhas: `conteudo-pedido` manda só o modelo (quem já tem cidade),
     * `nunca-pediram-dados` pede só os dados (quando não há modelo mapeado). É o que evita esta
     * regra virar um caminho paralelo que decide sozinho em situação que ninguém previu.
     */
    quando: (c) =>
      c.podeEnviar &&
      !c.enviadoHoje &&
      !c.modeloJaNaConversa &&
      !c.temEtiquetaDeCidade &&
      c.podePedirDados &&
      !c.jaDeuNomeECidade &&
      !c.jaPediramDados &&
      !c.pedidoHoje &&
      // **"É a CHEGADA" saiu da posição e virou condição** (04/09/2026), quando o quadro deixou de
      // ter dois ramos. Era o ramo `!jaRespondemosAntes` que garantia isso; numa lista única a
      // guarda tem que morar aqui, senão o recibo do anúncio sai para quem já foi atendido.
      // É a mesma lição da exceção do tempo: exceção que ele nomeia vai na CONDIÇÃO.
      !c.jaRespondemosAntes,
    motivo: () =>
      'chegou pelo anúncio: sai o modelo como recibo e, em seguida, o pedido de nome e cidade.',
  },
  {
    id: 'nada-legivel-dela',
    tecla: '7',
    /**
     * **Ela mandou só coisa que a plataforma não conseguiu ler → pergunte o interesse.**
     *
     * Print do Tilin (03/09/2026): a conversa inteira eram dois avisos *"Atenção: o tipo da mensagem
     * enviada pelo contato não é suportado"* e um *"Número privado"* — sem texto, sem nome, sem
     * cidade e sem nem o telefone. A rodada mandou *"Para eu poder salvar seu número me diga seu:
     * Nome, Cidade"* e concluiu. Ele: *"eu não tenho nenhuma informação nesse caso, então é para
     * perguntar se a pessoa tem interesse em receber conteúdo; a mensagem de nome e cidade ficou
     * deslocada demais"*.
     *
     * Ele está certo sobre o que a mensagem PARECE do outro lado. *"Para eu poder salvar seu
     * número"* pressupõe uma conversa em andamento — alguém que pediu alguma coisa, ou pelo menos
     * escreveu. Quem só mandou uma mídia que não abriu recebe um formulário sem saber do quê.
     *
     * A pergunta de interesse serve porque **ela cria o contexto que falta**: diz o que temos para
     * oferecer, transforma o silêncio em sim ou não, e já pede nome e cidade na mesma mensagem —
     * então nada se perde em relação ao pedido seco.
     *
     * **Fica logo acima do pedido de dados e ABAIXO do modelo**, de propósito: quem chega por
     * anúncio com modelo mapeado recebe o recibo, que é resposta melhor que qualquer pergunta. Esta
     * regra só alcança quem não deixou nada para trabalhar.
     *
     * **`nunca-perguntaram-interesse` continua fora do quadro dele** (descarte de 01/09) — aquela
     * dispara a pergunta para todo mundo que nunca foi perguntado, que é quase a base inteira. Esta
     * exige, junto, que ela não tenha mandado nada legível.
     */
    quando: (c) =>
      !!c.soRuidoDaPlataforma && c.podePerguntarInteresse && !c.interessePerguntado && !c.jaRespondemosAntes,
    motivo: () =>
      'ela só mandou mídia que a plataforma não conseguiu ler — não há o que responder: ' +
      'pergunte se ela quer receber conteúdo.',
  },
  {
    id: 'nunca-pediram-dados',
    tecla: '4',
    /**
     * Veio do anúncio, não tem cidade, e **o formulário nunca saiu para ele**.
     *
     * Relato dele (31/08, print da Sônia): *"bastante contatos que vieram de anúncio sem pedir
     * dados ao iniciar"*. Ela tem nome de verdade, então a regra do nome não pegava; tem
     * conteúdo pedido, então a regra do modelo pegava e mandava.
     *
     * **A distinção que faltava é entre "ignorou o formulário" e "nunca recebeu o formulário".**
     * Ele decidiu de manhã que quem ignora o pedido recebe o conteúdo mesmo assim — *"talvez em
     * outra hora ela forneça"*. Isso vale para quem já teve a chance. Quem nunca foi perguntado
     * não ignorou nada: perguntar uma vez é o trabalho que a rodada existe para fazer.
     *
     * Por isso fica ACIMA de "conteúdo pedido", e a do nome continua abaixo: pede-se uma vez;
     * ignorado, manda-se o conteúdo e não se insiste.
     *
     * **Subiu também acima de "só uma reação" em 31/08**, com a print da Marta: ela veio do
     * anúncio, mandou 🙏 como ÚNICA mensagem, sem cidade e sem nunca ter recebido o formulário —
     * e a caixa sugeria a mensagem do momento. *"nesse caso a pessoa respondeu o anuncio com um
     * emoji, eu tenho que pedir os dados"*.
     *
     * Isso não contradiz o "parece robô" da regra de baixo, e é a condição desta que garante
     * isso: quem já recebeu o formulário, ou já tem cidade, não casa aqui e continua caindo lá.
     * Responder emoji com pedido de dados só é robô com quem já tem conversa — para quem acabou
     * de chegar do anúncio, perguntar é o primeiro passo, e a tela não tem mais nada a olhar.
     */
    /**
     * **Repasse não conta como chegada.** Acrescentado em 31/08 com a print do Odone: 76 links
     * de vídeo em semanas, sem cidade e sem formulário enviado — a rodada oferecia o formulário
     * a cada rodada, e ele nunca ia responder. *"links em geral devem ser ignorados"*.
     *
     * A reação continua contando (o 🙏 da Marta pede o formulário): um emoji é dirigido a ele,
     * um link do Facebook é conteúdo de outra pessoa passando adiante.
     */
    /**
     * **Nunca peça o que ela acabou de escrever.**
     *
     * Anotação do Plauto (03/09/2026): a última mensagem dele era *"Plauto Velho, cidade São
     * Leopoldo"* — nome e cidade, sem separador nenhum, sem ninguém ter pedido — e esta regra
     * casou, sugerindo *"peça os dados esta vez"*. Ele: *"já foi pedido dados, seria agradecer e
     * encerrar"*.
     *
     * As condições que existiam olhavam o CRM (`temEtiquetaDeCidade`) e o nosso histórico
     * (`jaPediramDados`), e as duas podem ser falsas no exato momento em que ela está respondendo:
     * a etiqueta ainda não existe no CRM, e a pergunta nunca saiu porque ela se adiantou.
     *
     * `jaDeuNomeECidade` é a metade que faltava, e é a que não depende de nada ter sido gravado:
     * o parser leu as duas coisas no que ELA escreveu. Vale igual em `anuncio-modelo-e-dados`, que
     * carrega o mesmo pedido junto do recibo — lá ele derruba só a metade do formulário, e o caso
     * desce para `conteudo-pedido`, que manda o recibo sozinho.
     */
    quando: (c) => !c.rajadaEhSoRepasse && !pedirDadosNaoCabe(c) && c.podePedirDados && !c.pedidoHoje,
    motivo: () => 'veio do anúncio e nunca pedimos o nome e a cidade dela — peça os dados esta vez.',
  },
  {
    id: 'ultima-e-so-reacao',
    /**
     * Última mensagem é imagem, figurinha, emoticon ou link.
     *
     * É sobre o que a pessoa **acabou de fazer**, que é o sinal mais recente que existe:
     * responder um 👍 com "me manda seu nome e cidade" lê como robô que não olhou a tela.
     *
     * **Mas só a partir de quem já tem conversa.** Em 31/08 esta regra passou para BAIXO de
     * "nunca pediram dados": quem chegou pelo anúncio, mandou só um emoji e nunca recebeu o
     * formulário não tem conversa para o robô estragar — ali perguntar é o primeiro passo.
     * Quem já recebeu o formulário ou já tem cidade não casa lá em cima e continua chegando
     * aqui, que era o caso que motivou esta regra.
     *
     * **Se você já respondeu hoje, o desfecho é CONCLUIR e não a mensagem do momento** — pedido
     * dele, com a print do Paulo Quevedo: ele tinha escrito uma resposta longa às 09:29 e a
     * pessoa mandou um link do TikTok às 14:43. Mandar a mensagem do momento ali é empilhar uma
     * segunda mensagem nossa em cima da que ela ainda nem comentou.
     */
    tecla: (c) => (c.respondidoHoje || !c.podeMandarMomento ? '3' : '5'),
    /**
     * **Uma figura ou um link no fim NÃO apaga a pergunta que ficou para trás** — print da Maria
     * Antonia (06/09/2026).
     *
     * Ela perguntou *"o senhor é candidato a qual partido"* no dia 05, no dia 06 mandou um link do
     * TikTok, e a rodada mandou a mensagem do momento. Ele: *"ignorou por causa do link no final"*.
     *
     * Esta caixa fica ACIMA de `pergunta-aberta` de propósito — responder um 👍 com texto é o que
     * ela existe para impedir. Mas ela olha só a ÚLTIMA mensagem, e a pergunta pendente é da
     * RAJADA (lição da Ieda, 04/09): quem perguntou e depois repassou um vídeo continua esperando
     * resposta, e o link não é uma retratação.
     *
     * **A guarda é `perguntaAberta` e não `perguntaPendente`, de propósito.** O sinal amplo conta
     * *"tudo bem?"*, que é metade das respostas ao formulário — com ele aqui, quem cumprimenta e
     * manda uma figura iria para a tecla 6. O estreito é exatamente "nenhuma resposta pronta
     * responde isto", que é o caso em que a figura não pode decidir nada.
     *
     * **Na CONDIÇÃO e não na ordem**, porque vale no quadro dele sem depender de importar.
     */
    quando: (c) => c.ultimaEhSoReacao && !c.perguntaAberta,
    motivo: (c) =>
      c.respondidoHoje
        ? 'você já respondeu hoje e ela mandou só uma figura, emoji ou link — pode concluir.'
        : !c.podeMandarMomento
          ? 'a última mensagem foi só uma figura, emoji ou link, e não há mensagem do momento — conclua.'
          : 'a última mensagem foi só uma figura, emoji ou link — a mensagem do momento responde ao gesto.',
  },
  {
    id: 'pergunta-aberta',
    tecla: '6',
    /**
     * Ela fez uma pergunta de razão ou de posição → responder à mão.
     *
     * Print da Clair (31/08): respondeu o formulário e depois escreveu *"tem muita propaganda aqui
     * em santa Maria, mas não do capitão Martins."* e *"Porque?"*. A caixa sugeria **mandar o
     * modelo da campanha** — material de campanha como resposta a uma pergunta sobre a falta de
     * material de campanha. *"pergunta especifica, caso para IA"*.
     *
     * Nenhuma regra pegava: a rajada tinha 126 caracteres (longe dos 400 da regra de texto longo),
     * não era reação, não era despedida, e havia conteúdo mapeado — então `conteudo-pedido` venceu.
     *
     * **Fica logo ACIMA de `conteudo-pedido` e não mais alto, de propósito.** É o mínimo para
     * resolver o caso: quem pede dados, quem se despede, quem manda áudio continua sendo tratado
     * pelas regras de cima, que já estavam certas. Subir mais tiraria contato da automação sem
     * necessidade, e o objetivo dele é 90% resolvido sem IA.
     *
     * A lista de padrões (`cortesia.conversaTemPerguntaAberta`) é curta pela mesma razão, e
     * pergunta que pede material está fora dela: o modelo responde bem a "pode me mandar?".
     */
    quando: (c) => !!c.perguntaAberta,
    motivo: () => 'fez uma pergunta que nenhuma resposta pronta responde — escreva você.',
  },
  {
    id: 'contexto-de-outro-dia',
    /**
     * **A tecla virou FUNÇÃO em 06/09/2026, e isso conserta o buraco que a print da Noeli mostrou.**
     *
     * Ela escreveu *"Eu já estou com vocês.....bom dia"* no dia 05, e no dia 06 recebeu **o modelo
     * da campanha**. Ele: *"ignorou a regra da perda de contexto e mandou modelo"*.
     *
     * A regra não foi ignorada: ela **não casou**. As duas guardas do momento moravam na
     * `quando` (*"só casa se houver mensagem do momento e ela ainda não tiver saído"*), e o
     * comentário antigo dizia, com todas as letras, que sem elas *"o quadro decide como antes"*.
     * **Decidir como antes, aqui, é mandar o modelo** — exatamente o que esta caixa existe para
     * impedir. Medido: com o momento já enviado OU sem momento configurado, o caso caía em
     * `conteudo-pedido`, tecla 1.
     *
     * O desenho certo já estava em `ultima-e-so-reacao` e em `ja-respondemos-antes`: **a guarda
     * decide o DESFECHO, não se a caixa casa.** Sem momento para mandar, o certo é concluir sem
     * enviar nada — nunca cair para quem envia.
     */
    tecla: (c) => (c.podeMandarMomento && !c.momentoJaEnviado ? '5' : '3'),
    /**
     * **A última coisa que ela escreveu é de outro dia: o contexto passou.**
     *
     * Quatro anotações do mesmo lote (04/09/2026), todas com desfechos diferentes e a mesma
     * correção dele:
     *
     *  - **Bia** e **Noeli** responderam nome e cidade ONTEM, e a caixa oferecia o agradecimento —
     *    *"como foi ontem, mandar mensagem do momento; se fosse no dia, mandava agradecer e
     *    encerrar"*;
     *  - **Giovani** mandou um texto político e um link ontem à noite, e a caixa oferecia o modelo —
     *    *"modelo fora de contexto, aqui vou mandar mensagem do momento"*;
     *  - **Beatriz Pansaia**, o mesmo, com o agradecimento — *"erro de mandar apoio se repetindo"*.
     *
     * **O critério de tempo não era do apoio, era geral.** Ele o definiu em 03/09 dentro de
     * `so-expressa-apoio` (*"se foi no dia anterior, é mensagem do momento; se foi recente,
     * mensagem de apoio"*) e o que os quatro casos mostram é que a razão não tinha nada a ver com
     * apoio: **responder o conteúdo de ontem soa a quem não estava lá.** A mensagem do momento é o
     * que há de novo hoje, e é a resposta certa para qualquer assunto que esfriou.
     *
     * Por isso esta regra substituiu a bifurcação de tempo que vivia lá dentro: um conceito, um
     * lugar. `so-expressa-apoio` voltou a ser só "agradece".
     *
     * **As guardas do momento decidem o DESFECHO e não se a caixa casa** (06/09/2026, acima): sem
     * mensagem do momento configurada, ou já tendo saído para essa pessoa, a regra continua
     * vencendo e conclui — o que ela nunca pode fazer é deixar o caso escorregar para quem envia.
     *
     * **A exceção da pergunta está na CONDIÇÃO, e não só na posição** — print da Ieda (04/09/2026).
     * Ele nomeou a exceção no dia em que criou a regra: *"único pretexto que exclui a necessidade
     * de hora é pergunta pendente, que deve ser respondida"*. Eu a implementei como ORDEM (esta
     * regra fica abaixo de `pergunta-aberta`), e ordem só cobre as perguntas da lista curta. A Ieda
     * perguntou *"Você é candidato daqui do RS?"* — que não está em lista nenhuma — e a rodada
     * ofereceu a mensagem do momento. Ele: *"certamente é um problema de ramo"*.
     *
     * Estava certo sobre o sintoma, e o conserto é mais fundo que mover a caixa: com a exceção na
     * condição, ela vale **onde quer que a caixa esteja no quadro dele** — inclusive nos quadros já
     * exportados. Posição é preferência dele; esta exceção é regra dele.
     *
     * **A segunda exceção é o MATERIAL PEDIDO**, e ele nomeou-a em 05/09/2026: *"o modelo de
     * material é uma exceção, ele sempre tem que ser mandado quando requisitado"*. A print: ela
     * chegou pelo anúncio escrevendo *"Olá! Eu quero receber o Material da Direita"* às 13:23, a
     * rodada só a alcançou no dia seguinte, e mandou a mensagem do momento — concluindo. Medido no
     * quadro padrão, esta caixa fica acima da entrega do modelo nos três ramos, então **o pedido de
     * material vencia o dia**. Não vence: pedido não entregue continua de pé na semana que vem, e é
     * a razão pela qual a pessoa apareceu.
     *
     * O sinal já vem com a guarda de repetição — quem calcula soma "e o modelo ainda não saiu" —,
     * então ele se apaga sozinho no instante da entrega e a caixa volta a valer.
     *
     * Ela também continua **abaixo de tudo o que precisa de gente** — pedido de ajuda, pergunta,
     * áudio, denúncia respondida.
     *
     * E abaixo do anúncio reconhecido: clicar num anúncio é pedir uma coisa específica, e escolha
     * explícita dela não se substitui por dedução nossa.
     */
    quando: (c) => !!c.deOutroDia && !c.perguntaPendente && !c.materialPendente,
    motivo: (c) =>
      c.podeMandarMomento && !c.momentoJaEnviado
        ? 'a última mensagem dela é de outro dia — o contexto passou; a mensagem do momento é o que há de novo.'
        : 'a última mensagem dela é de outro dia e não há mensagem do momento para mandar — conclua sem responder o de ontem.',
  },
  {
    id: 'so-expressa-apoio',
    /**
     * **O TEMPO decide entre agradecer e mandar a mensagem do momento** — critério dele
     * (03/09/2026), sobre três anotações que pediam a mesma coisa (Maria Geny, Tere e Gilmar,
     * Jacira): *"a questão é o contexto, a mensagem tem quanto tempo que mandou dando apoio; se foi
     * no dia anterior, é mensagem do momento; se foi recente, mensagem de apoio"*.
     *
     * A leitura é de atendimento: apoio escrito agora é resposta ao que acabamos de mandar, e o que
     * ele espera é um obrigado. Apoio de ontem é alguém que voltou sozinho depois de a conversa ter
     * fechado — aí a mensagem do momento é o que há de novo para dar.
     *
     * **As duas guardas do momento continuam**: só sai se houver uma configurada e se ela ainda não
     * tiver ido para essa pessoa. Sem isso a regra viraria máquina de repetir — a condição é estado
     * da conversa (o texto de apoio fica lá para sempre) e o envio não a apaga.
     *
     * **A única coisa que passa por cima do tempo é pergunta pendente**, e ele disse isso na mesma
     * frase: *"único pretexto que exclui a necessidade de hora é pergunta pendente, que deve ser
     * respondida"*. Isso já vale por ORDEM — `pergunta-aberta` e `pediu-algo-sem-dizer-o-que` ficam
     * acima desta regra nos dois ramos do quadro. Tem teste.
     */
    tecla: 'i',
    /**
     * A pessoa só disse que está com você, e já está classificada → agradecer e encerrar.
     *
     * Pedido dele (31/08, print do Ciro): *"esse é um caso comum até onde a pessoa só expressa o
     * apoio, ja tem as etiquetas, então é só uma questão de agradecer o apoio e carinho"*.
     *
     * **Fica ACIMA de `conteudo-pedido` — e isto é uma reversão, de propósito.**
     *
     * Eu a tinha posto abaixo hoje de manhã, argumentando que "agradecer antes de entregar
     * responderia o carinho e engoliria o pedido". Ele desfez: *"a prioridade é responder o que
     * foi falado, depois mandar modelo"*.
     *
     * Ele está certo, e a razão é de atendimento e não de código: quem escreveu uma mensagem
     * própria espera resposta àquilo. O material continua indo — na rodada seguinte, quando não
     * houver mais nada a responder.
     *
     * O que impede isto de engolir o pedido é o **tamanho** (`APOIO_ELABORADO`), não a ordem:
     * apoio curto ("apoio!", "conte comigo") não casa aqui e continua recebendo modelo mais
     * agradecimento pela atenção, que é o desfecho normal.
     */
    quando: (c) => !!c.soExpressaApoio,
    /**
     * **O motivo não pode falar de "material" como se houvesse um esperando.**
     *
     * Anotação da Maria de Lourdes (03/09/2026): *"a sugestão está falando de material sem ter
     * material na conversa"*. Ela estava certa sobre a frase — *"o material fica para depois"*
     * descreve o que a regra faz com o modelo quando ele existe, e é lido como promessa de algo
     * que está na fila. Quem lê a caixa precisa saber o que ela vai FAZER, não o que ela adiou.
     */
    motivo: () => 'escreveu apoio em mensagem própria — agradeça a ela; a resposta é o agradecimento.',
  },
  {
    id: 'ja-respondemos-antes',
    /**
     * Já mandamos algo para este contato antes → o modelo não é a entrega desta vez.
     *
     * Escolha dele (31/08), print do Cris: *"histórico de conversa grande provavelmente já recebeu
     * modelo de mensagem, vou mandar mensagem do momento"*.
     *
     * **O modelo é a entrega INICIAL.** Quem já foi atendido e volta dizendo que apoia não está
     * pedindo o material de novo — está aparecendo. A mensagem da ocasião responde a isso; o
     * modelo repetido parece que ninguém olhou o histórico.
     *
     * Fica **abaixo de `so-expressa-apoio`**: quem escreveu mensagem própria merece resposta
     * àquilo, não a mensagem da semana.
     *
     * O desfecho segue o mesmo desenho da regra da reação: sem mensagem do momento configurada,
     * ou já tendo respondido hoje, ou já tendo mandado a do momento, o certo é **concluir** — mais
     * uma mensagem nossa em cima da que ela ainda não comentou é empilhar.
     */
    /**
     * **Pergunta pendente nunca vira "conclua"** — print do Paulo Quevedo (03/09/2026): imagem de
     * bom dia, dois links e, por último, *"Colorado ou Gremista?"*. Esta regra recomendou concluir.
     * Ele: *"qual a regra que já tínhamos acertado? tem pergunta não conclui"*.
     *
     * Ela é a caixa mais genérica do quadro — não olha o que a pessoa escreveu, só que já fomos
     * atendidos antes — e é a única que pode CONCLUIR tendo uma interrogação sem resposta na frente
     * (a despedida e a reação são, elas próprias, a última mensagem).
     *
     * O sinal é `perguntaPendente`, deliberadamente mais fraco que `perguntaAberta`: aquele
     * decide que o caso precisa de você e por isso é uma lista curta de formas conhecidas; este só
     * impede o desfecho irreversível. Alargar o outro para "qualquer ?" quebrou cinco exclusões que
     * ele já tinha decidido — medido antes de escolher este caminho.
     *
     * **Ele olha a RAJADA inteira desde 04/09/2026**, e não só a última mensagem — print da Ieda,
     * que perguntou *"Você é candidato daqui do RS?"* e disse *"Boa tarde!"* depois: a pergunta não
     * deixou de estar pendente por causa do cumprimento.
     */
    /**
     * **O MATERIAL pedido entrou aqui em 09/09/2026** — print da Sadra: *"Quero umas. Camisetas"* e
     * *"Dos meus candidatos"*, e o atendimento foi **concluído sem nada sair**. Ele: *"não
     * identificou que ela queria algo"*.
     *
     * **Medido, e o detector estava certo:** `pedeMaterial` casou (o ponto no meio de *"Quero umas.
     * Camisetas"* não atrapalha). O caso morreu aqui: já tínhamos respondido hoje, e esta caixa
     * conclui.
     *
     * **`conteudo-pedido` não salva porque ela exige `podeEnviar`** — um modelo aprovado para
     * mandar —, e camiseta não tem modelo: o que existe para material FÍSICO é o caminho da Jonice
     * (08/09), que é pedir o endereço e repassar à equipe. Nenhuma caixa levava a ele.
     *
     * **A guarda decide o DESFECHO e não se a caixa casa** — é a lição da Noeli (06/09), e é o que
     * `perguntaPendente` já fazia na linha de cima. Tecla 6: ele ou a IA, que então aplica a regra 5.
     */
    /**
     * **`materialPendente`, e não `pedeMaterial`** — print da Rita (18/09/2026): *"pediu material e
     * não foi respondido, saiu a resposta do momento... e a pessoa nos bloqueou"*. O painel preenche
     * `materialPendente` (o pedido ainda não entregue); `pedeMaterial` NUNCA chegou ao contexto, então
     * esta guarda e a exceção de `conteudo-pedido` estavam mortas desde que nasceram. Os testes passavam
     * porque montavam o contexto à mão com o nome errado — o teste de `sugestao.test.mjs` que cruza as
     * chaves lidas aqui com as que o painel escreve existe para isto não voltar.
     */
    tecla: (c) => {
      if (c.perguntaPendente || c.materialPendente) return '6';
      return c.respondidoHoje || c.momentoJaEnviado || !c.podeMandarMomento ? '3' : '5';
    },
    /**
     * **`respondidoHoje` entrou na condição em 06/09/2026**, junto com a guarda nova de
     * `conteudo-pedido` — e é o que impede um buraco silencioso.
     *
     * Esta caixa é o fecho: ela não olha o que a pessoa escreveu, só que já fomos atendidos antes.
     * Barrando o modelo de quem já foi respondido hoje, **os casos em que nada mais casa passariam
     * a atravessar o quadro sem desfecho** — medido, 14 em 30.000, todos no ramo da CHEGADA, que
     * não tinha fecho nenhum.
     *
     * Semanticamente é a mesma coisa: "já respondemos antes" e "já respondemos hoje" são os dois
     * lados de *já falamos com esta pessoa*. Os ramos do RETORNO não mudam — quem chega neles já
     * tem `jaRespondemosAntes` verdadeiro —, e o desfecho continua sendo o mesmo da função `tecla`,
     * que sempre soube tratar `respondidoHoje`.
     */
    quando: (c) => !!c.jaRespondemosAntes || !!c.respondidoHoje,
    motivo: (c) =>
      c.respondidoHoje
        ? 'já respondemos hoje e ela voltou — pode concluir.'
        : c.momentoJaEnviado
          ? 'já foi atendida antes e a mensagem do momento já saiu — pode concluir.'
          : !c.podeMandarMomento
            ? 'já foi atendida antes, e não há mensagem do momento configurada — conclua.'
            : 'já foi atendida antes (o modelo provavelmente já saiu) — mande a mensagem do momento.',
  },
  {
    id: 'respondeu-os-dados',
    tecla: 'i',
    /**
     * **Ela respondeu o nome ou a cidade que pedimos: agradece e encerra.**
     *
     * Pedido dele (02/09/2026): *"agora só precisa agradecer a atenção e encerrar sem mandar
     * modelo"*. É consequência do redesenho do mesmo dia — o modelo virou o **recibo da chegada**,
     * então quando ela responde o cadastro o modelo já saiu, e mandá-lo de novo é repetir.
     *
     * Vem ACIMA de `conteudo-pedido` de propósito: quem respondeu o que pedimos não precisa de mais
     * material, precisa de reconhecimento e do atendimento fechado.
     *
     * O sinal é calculado no painel juntando duas coisas — o pedido de dados saiu (reconhecido por
     * INVARIANTE, nunca pelo texto atual) e o parser achou nome ou cidade no que ela escreveu
     * depois. Sem as duas metades, "sim" solto ou assunto novo viraria agradecimento e conclusão.
     */
    /**
     * **A exceção é o material que nunca saiu** — regra dele (05/09/2026): *"o modelo de material
     * é uma exceção, ele sempre tem que ser mandado quando requisitado"*.
     *
     * O argumento desta caixa é *"o modelo já foi o recibo da chegada"* — e ele deixa de valer
     * quando o modelo não foi. Medido em 10.000 contextos: com o material pedido e não entregue,
     * esta era a ÚNICA caixa que ainda enterrava o pedido (4.201 deles), e o caminho é real na
     * configuração dele hoje — ela chega pelo anúncio pedindo material, recebe só o formulário
     * (sem modelo padrão cadastrado não há recibo), responde *"Maria, Canoas"* e era **agradecida
     * e concluída sem nunca receber o material**.
     *
     * O agradecimento não se perde: sai o modelo agora, e na passada seguinte — com o modelo já
     * na conversa — esta caixa volta a ganhar.
     */
    /**
     * **Não conclui com pergunta em aberto** — print da Mari (06/09/2026). Ela respondeu ao
     * formulário por áudio: *"Boa tarde, tudo bem com você? Sou de Caxias do Sul."*, e recebeu
     * *"Obrigado de coração pelo apoio e pela confiança"* — com a conversa fechada em cima do
     * *"tudo bem com você?"*. Ele: *"mensagem fora de contexto, IA deveria ter assumido aqui"*.
     *
     * A regra que faltava aqui é dele e é de 03/09: **nunca concluir com pergunta em aberto.**
     * `ja-respondemos-antes` ganhou essa guarda naquele dia; esta caixa nasceu em 02/09 e ficou
     * sem, e ninguém viu porque o sintoma é invisível — a resposta sai, educada, e a pergunta dela
     * morre junto com o atendimento.
     *
     * Medido no caso da print: com a guarda, o caso desce para `ja-respondemos-antes`, cujo ramo
     * de pergunta dá **tecla 6** — que é a IA escrevendo, exatamente o que ele pediu.
     *
     * **O custo, dito a ele:** `perguntaPendente` conta *"tudo bem?"*, que é metade das respostas
     * ao formulário nesta base. Quem responde o cadastro cumprimentando passa a ir para a IA em
     * vez de receber o agradecimento pronto.
     */
    quando: (c) => !!c.respondeuOsDados && !c.materialPendente && !c.perguntaPendente,
    motivo: () => 'respondeu o nome e a cidade que pedimos — agradeça e encerre.',
  },
  {
    id: 'conteudo-pedido',
    tecla: '1',
    /**
     * Ele pediu um conteúdo e há modelo mapeado: mandar é o que fecha o atendimento.
     *
     * `modeloJaNaConversa` cobre o que o registro de envios não vê — modelo disparado pela
     * automação da plataforma ou à mão por outra pessoa. Sem isso a rodada sugeria mandar de novo
     * o que estava na tela algumas mensagens acima (print dele, 31/08).
     */
    /**
     * **Já falamos hoje? Então o modelo só sai se houver um clique de anúncio esperando resposta.**
     * Regra dele (06/09/2026), com quatro prints da Sirlene em ordem: *"o modelo só sai novamente no
     * contexto do anúncio; se tiver resposta minha após o anúncio, não mandar"*.
     *
     * Ela clicou no anúncio em 04/09, recebeu a mensagem do momento em 05/09 e de novo na manhã de
     * 06/09. Às 12:31 escreveu *"10.122 já está anotado 🌸💕"* — uma confirmação, que não pede nada
     * — e às 13:23 recebeu o **modelo institucional** com agradecimento e conclusão em cima. *"O
     * modelo tem sido mandado fora de contexto, achei que tinha sido arrumado mas continua."*
     *
     * **As duas guardas de tempo que existiam são sobre o MODELO** — `enviadoHoje` e
     * `modeloJaNaConversa` — e nenhuma sabe que **já respondemos alguma coisa hoje**, que é o que
     * quase sempre acontece: a do momento sai de manhã, a pessoa agradece, e a regra lê a etiqueta
     * de conteúdo dela como se fosse um pedido de agora. **A etiqueta é permanente; o pedido é da
     * rajada.** É a distinção que já apareceu na `momentoJaEnviado` da Janete (04/09).
     *
     * **As duas exceções são as duas coisas que a pessoa acabou de PEDIR**, e nas duas o pedido
     * ainda não foi entregue:
     *  - `anuncioReconhecido`, que desde hoje significa *"há um clique de anúncio depois da nossa
     *    última fala"* — respondido, o anúncio se cala (ver `anuncioSemResposta` no painel);
     *  - `pedeMaterial`, decisão dele de 05/09: *"o modelo de material é uma exceção, ele sempre tem
     *    que ser mandado quando requisitado"*.
     *
     * **Isto refina a decisão de 01/09** (*"se continuar como na print o modelo nunca será enviado
     * porque está concluindo após resolver a pendência"*), e o invariante daquele dia continua de
     * pé: o modelo não fica preso atrás da pendência para sempre — ele sai na primeira passada de um
     * dia em que ainda não falamos, em vez de na segunda passada do mesmo dia. O que tornava aquilo
     * um risco real era a caixa do cumprimento repetir a mensagem do momento a cada passada, e ela
     * ganhou `excecao: momentoJaEnviado` em 03/09.
     */
    quando: (c) =>
      c.podeEnviar &&
      !c.enviadoHoje &&
      !c.modeloJaNaConversa &&
      (!c.respondidoHoje || !!c.anuncioReconhecido || !!c.materialPendente),
    motivo: (c) => `pediu "${c.conteudoPedido || 'conteúdo'}" e há modelo mapeado — mande.`,
  },
  {
    id: 'nome-sem-sentido',
    tecla: '4',
    /**
     * **O critério é o NOME, não a cidade** — e esta é a segunda correção dele nesta regra.
     *
     * Ela nasceu em 30/08 como *"quando a pessoa não tiver etiqueta de cidade, sempre pedir
     * dados"*. Em 31/08 ele a pôs abaixo de "conteúdo pedido" (*"ela ignorou totalmente o pedido
     * da cidade, eu mando o modelo mesmo assim"*), e no mesmo dia apontou o que ainda sobrava:
     *
     * > *"ao abrir conversas está pedindo dados pra quem já tem etiquetas; uma exceção pra pedir
     * > é somente quando o nome da pessoa estiver totalmente sem sentido ou em falta"*
     *
     * Ele está certo, e o argumento é sobre o que cada falta CUSTA. Cidade faltando é comum e
     * não impede trabalhar o contato: ele tem etiqueta, tem conteúdo, aparece nos filtros que
     * importam, e a cidade ainda pode vir numa conversa qualquer. **Nome vazio ou impronunciável
     * é o que quebra** — bloqueia o vocativo, deixa o cadastro inútil no CRM, e nenhuma outra
     * conversa conserta sozinha.
     *
     * **A exceção que fica:** já pedido hoje não é recomendado de novo. Pedir duas vezes no
     * mesmo dia soa a robô. A opção continua na tela; ela só deixa de ser a sugerida.
     */
    quando: (c) => c.nomeSemSentido && c.podePedirDados && !c.pedidoHoje,
    motivo: () =>
      'o nome do cadastro está vazio ou sem sentido — é o que nenhuma outra conversa conserta. Peça os dados.',
  },
  {
    id: 'nunca-perguntaram-interesse',
    tecla: '7',
    // Sem conteúdo nenhum e sem nunca ter sido perguntado: a pergunta transforma silêncio em sim
    // ou não, e ainda pede nome e cidade na mesma mensagem.
    quando: (c) => c.podePerguntarInteresse && !c.interessePerguntado,
    motivo: () => 'nunca disse o que quer receber — a pergunta de interesse já pede nome e cidade.',
  },
  {
    id: 'pedido-hoje-sem-resposta',
    tecla: '3',
    /**
     * Já pediu hoje e a pessoa não respondeu nada de útil: não há o que mandar sem repetir. O
     * atendimento pode fechar — ela volta para "Meus" sozinha quando responder.
     *
     * Fica por último de propósito: recomendar concluir é a recomendação mais fácil de arrepender.
     */
    quando: (c) => c.pedidoHoje && !c.podeEnviar && !c.temEtiquetaDeCidade,
    motivo: () => 'já pedi os dados hoje e não veio resposta útil — concluir; ela volta ao responder.',
  },
];

/**
 * A recomendação para este contato, ou `null` quando nenhuma regra casa.
 *
 * `null` é resposta legítima e comum: sem regra, a caixa aparece sem destaque nenhum e a decisão
 * é inteiramente dele. Melhor nenhum destaque do que um destaque que não se sustenta.
 *
 * @param {object} ctx retrato do contato — ver `REGRAS`
 * @returns {{id:string, tecla:string, motivo:string}|null}
 */
export function sugerirAcao(ctx, fluxo) {
  const c = ctx || {};
  for (const regra of ordenar(fluxo)) {
    let casa = false;
    try {
      casa = !!regra.quando(c);
    } catch (_) {
      // Regra quebrada não pode derrubar a rodada: ela simplesmente não sugere nada.
      casa = false;
    }
    if (!casa) continue;

    // A tecla que ELE escolheu na janela do fluxo vence a do código. Se ele não escolheu nenhuma,
    // vale a do código — que pode ser função (a mesma situação pedindo teclas diferentes).
    const daConfig = fluxo?.teclas?.[regra.id];
    const tecla = daConfig || (typeof regra.tecla === 'function' ? regra.tecla(c) : regra.tecla);
    if (!tecla) continue; // a regra casou mas não há tecla para ela agora
    return { id: regra.id, tecla, motivo: regra.motivo(c) };
  }
  return null;
}

/**
 * As regras na ordem que ELE definiu, sem as que ele desligou.
 *
 * **Regra nova do código entra na posição do código, não no fim.** Se a `ordem` salva não menciona
 * um id, ele não é ignorado nem jogado para o fundo: é inserido onde o código o colocou, relativo
 * às regras vizinhas que ele conhece. Sem isso, a regra `respondeu-nossa-pergunta` — criada em
 * 01/09 para impedir propaganda em cima de denúncia — nasceria em último lugar em quem já tinha
 * ordem salva, e o defeito voltaria calado na atualização.
 *
 * Configuração ausente ou vazia devolve o código puro, então a janela nascer em branco não muda
 * comportamento nenhum.
 */
export function ordenar(fluxo) {
  const desligadas = new Set(fluxo?.desligadas || []);
  const ativas = REGRAS.filter((r) => !desligadas.has(r.id));

  /**
   * Só ids que existem, **sem repetição, valendo a PRIMEIRA aparição**.
   *
   * O `Map` abaixo é construído por índice, e sem a deduplicação um id repetido ficava com a
   * posição da ÚLTIMA ocorrência — ou seja, arrastar uma regra para o topo não a movia se ela
   * também aparecesse embaixo. Peguei isso na primeira verificação; é o tipo de defeito que na
   * tela pareceria "arrastei e não mudou nada".
   */
  const vistos = new Set();
  const salva = (fluxo?.ordem || []).filter(
    (id) => REGRAS.some((r) => r.id === id) && !vistos.has(id) && vistos.add(id)
  );
  if (!salva.length) return ativas;

  const pos = new Map(salva.map((id, i) => [id, i]));

  // Para id que a ordem salva não conhece, herda a posição do vizinho de CIMA que ela conhece —
  // é o que mantém a regra nova onde o código a pôs.
  let herdada = -1;
  const chave = new Map();
  REGRAS.forEach((r, iCodigo) => {
    if (pos.has(r.id)) herdada = pos.get(r.id);
    // `+0.001 * iCodigo` desempata as novas entre si, preservando a ordem do código.
    chave.set(r.id, pos.has(r.id) ? pos.get(r.id) : herdada + 0.001 * (iCodigo + 1));
  });

  return ativas.slice().sort((a, b) => chave.get(a.id) - chave.get(b.id));
}

/**
 * O que a janela do Fluxo mostra de cada regra.
 *
 * Fica AQUI e não no painel de propósito: rótulo e descrição ao lado da regra que descrevem é o
 * que mantém os dois em sincronia. Descrição que mora em outro arquivo envelhece na primeira
 * mudança de condição — e a janela passaria a explicar uma regra que já mudou.
 *
 * `efeito` é o que o eleitor recebe, e é a informação mais importante da tela:
 *  - `envia`    — sai mensagem para ele;
 *  - `silencio` — não sai nada (conclui ou pula);
 *  - `gente`    — precisa de uma pessoa escrever;
 *  - `depende`  — a tecla varia com o contexto (manda a do momento, ou só conclui).
 */
/**
 * O que cada tecla da caixa da rodada FAZ, e o que o eleitor recebe por ela.
 *
 * Mora aqui, junto das regras, porque e o que fecha a ramificacao: a regra e a CONDICAO, a
 * tecla e o DESFECHO, e a janela do fluxo desenha a seta entre as duas. Enquanto a lista viveu
 * so dentro da janela, nada impedia uma regra apontar para tecla sem verbete, e nenhum teste
 * alcancava isso.
 *
 * `efeito` e o mesmo vocabulario de `SOBRE`, e e por isso que o teste consegue exigir que os
 * dois concordem: regra de tecla fixa rotulada "envia" cuja tecla nao manda nada e cartao
 * mentindo na tela.
 */
export const TECLAS = {
  '1': { rotulo: 'Manda o modelo aprovado do conteúdo', efeito: 'envia' },
  '2': { rotulo: 'Pula, deixa o atendimento aberto', efeito: 'silencio' },
  '3': { rotulo: 'Conclui sem enviar nada', efeito: 'silencio' },
  '4': { rotulo: 'Pede nome e cidade, e conclui', efeito: 'envia' },
  '5': { rotulo: 'Mensagem do momento, e conclui', efeito: 'envia' },
  '6': { rotulo: 'Você responde à mão', efeito: 'gente' },
  '7': { rotulo: 'Pergunta interesse + pede dados', efeito: 'envia' },
  /**
   * **O agradecimento trocou de tecla com a chamada da IA em 03/09/2026**, a pedido dele: *"era
   * pra substituir o botão 8 com o chamar IA"*.
   *
   * A troca é o que a mantém segura. Este era o desfecho que `so-expressa-apoio` e a
   * confirmação de presença RECOMENDAM; fazer a recomendação apontar para a IA pararia a rodada
   * em cada contato de apoio, esperando ele escrever. Assim as regras continuam recomendando o
   * agradecimento — só que no `i` — e **a chamada da IA não é recomendada por regra nenhuma**,
   * que é o certo: chamar a IA é escolha dele, contato a contato.
   *
   * Por isso o 8 **não está nesta tabela**: ela é a lista do que uma REGRA pode mandar apertar.
   */
  i: { rotulo: 'Agradece o apoio, e conclui', efeito: 'envia' },
  '9': { rotulo: 'Pergunta em que pode ajudar (deixa aberto)', efeito: 'envia' },
  s: { rotulo: 'Marca sem interesse, conclui sem responder', efeito: 'silencio' },
  /**
   * **Tecla `a` — o modelo do anúncio E o pedido de dados, na mesma passada.**
   *
   * Escolha dele em 02/09/2026, depois de explicar a natureza do modelo: *"o modelo seria uma
   * resposta automática ao anúncio, o atendimento vem depois disso que seria pedir dados e
   * responder as perguntas"*. Perguntado se "depois" era a mesma passada ou a seguinte, escolheu
   * **a mesma**, sabendo que são DUAS mensagens seguidas para o mesmo número.
   *
   * É a única tecla do projeto que manda duas mensagens, e existe porque as duas são coisas
   * diferentes: o modelo é o recibo automático do anúncio, o pedido de dados é o atendimento
   * começando. Uma passada só captura o cadastro na chegada, em vez de esperar ela escrever de novo
   * — que era o custo da versão anterior, e o que ele quis resolver.
   *
   * **Letra e não dígito**, pelo mesmo motivo do `s` e do `f`.
   */
  a: { rotulo: 'Manda o modelo do anúncio + pede nome e cidade, e conclui', efeito: 'envia' },
};

/**
 * Como a tecla APARECE na tela: letra em maiúscula, dígito como está.
 *
 * Pedido dele (02/09/2026): *"troque a opção a por A maiúsculo para ficar destacado, mas só na
 * visualização; no teclado pode ser a minúsculo"*. No print da caixa da rodada a linha
 * `a  Mandar "Segurança" + Pedir dados` desaparece no meio dos dígitos, e a recomendação sai como
 * *"Sugiro a a:"*, que parece erro de digitação.
 *
 * **É só desenho.** As teclas continuam sendo `'a'`, `'s'` e `'f'` em toda parte — é por elas que
 * `sugestao.tecla === 'a'`, a automação da rodada e os ramos da árvore acham a opção. Converter na
 * hora de ESCREVER, e não na lista, é o que impede a maiúscula de vazar para a comparação.
 */
export function mostrarTecla(tecla) {
  return String(tecla ?? '').toUpperCase();
}

export const SOBRE = {
  'sem-interesse': {
    rotulo: 'Recusou ou veio hostilizar',
    efeito: 'silencio',
    quando:
      'Pediu para não receber mais, respondeu "não" seco, ou xingou em segunda pessoa. Marca a ' +
      'etiqueta de sem interesse e conclui sem responder. Xingar o adversário em terceira pessoa ' +
      'NÃO conta — isso é apoiador.',
  },
  'etiqueta-so-conclui': {
    rotulo: 'Tem a etiqueta que só conclui (assessor)',
    efeito: 'silencio',
    quando:
      'É da casa — assessor, equipe. Conclui sem mandar nada, nunca. Diferente da etiqueta que ' +
      'dispensa da fila, que ainda manda a mensagem do momento uma vez.',
  },
  'ultima-e-nossa': {
    rotulo: 'A última mensagem é nossa (ou ela não escreveu nada)',
    efeito: 'silencio',
    quando:
      'Não há o que responder: a conversa termina numa mensagem nossa, ou o contato nunca ' +
      'escreveu. Conclui sem mandar nada.',
  },
  'confirmou-presenca-evento': {
    rotulo: 'Confirmou presença no evento',
    efeito: 'silencio',
    quando:
      'Disse que VAI ao evento. Pula e deixa o atendimento aberto — confirmação de presença é uma ' +
      'lista para você montar no fim, não um atendimento para fechar. Quem responde que NÃO vai ' +
      'continua caindo no pedido de nome e cidade, com o "não tem problema" junto.',
  },
  'informou-endereco': {
    rotulo: 'Mandou o endereço, ou já tem a etiqueta de material',
    efeito: 'silencio',
    quando:
      'Duas portas para a mesma situação: ela respondeu com um endereço — rua com número, bairro ' +
      'ou CEP —, ou o contato já carrega a etiqueta de material que você configurou. Pula e deixa ' +
      'o atendimento aberto, para você transferir a conversa ao responsável pelo envio. Quem ' +
      'manda é a ETIQUETA: reconhecido o endereço, ela é aplicada, e daí em diante é ela que ' +
      'segura o contato fora da automação — até você tirá-la.',
  },
  'etiqueta-dispensa-da-fila': {
    rotulo: 'Tem a etiqueta que dispensa da fila',
    efeito: 'depende',
    quando: 'Já está engajado: manda a mensagem do momento uma vez e conclui; depois, só conclui.',
    ramos: [
      { tecla: '5', se: 'a mensagem do momento ainda não saiu para ele' },
      { tecla: '3', se: 'você já respondeu hoje, ele já recebeu a do momento, ou não há uma configurada' },
    ],
  },
  'nao-pode-falar-agora': {
    rotulo: 'Está passando mal, ou avisou que fala depois',
    efeito: 'gente',
    quando:
      'Ela falou de si — que está doente, internada, em recuperação — ou avisou que não pode falar ' +
      'agora e volta depois. Material de campanha em cima disso é a resposta errada, e concluir é ' +
      'pior: ela disse que voltaria.',
  },
  'reclama-sem-resposta': {
    rotulo: 'Reclama de não ter sido atendida',
    efeito: 'gente',
    quando:
      'Ela diz que ninguém respondeu, que está esperando há dias ou que foi ignorada — e a queixa é ' +
      'com NÓS. Mensagem automática em cima disso confirma o que ela está dizendo, e concluir em ' +
      'silêncio confirma duas vezes. Queixa sobre a prefeitura, o CRAS ou o INSS não conta: aquilo ' +
      'é o que o mandato encaminha.',
  },
  'ultima-pede-resposta-pessoal': {
    rotulo: 'Áudio sem transcrição, arquivo, ou texto longo',
    efeito: 'gente',
    quando:
      'Só dá para responder depois de abrir. Áudio TRANSCRITO curto não cai mais aqui: o conteúdo ' +
      'passa a decidir, não o formato.',
  },
  'respondeu-nossa-pergunta': {
    rotulo: 'Você perguntou em que podia ajudar e ela respondeu',
    efeito: 'gente',
    quando:
      'Quem abre um caso perguntando tem que ler a resposta. Segura o contato até alguém tratar — ' +
      'foi criada porque uma denúncia sobre programa público recebeu material de campanha.',
  },
  'pediu-algo-sem-dizer-o-que': {
    rotulo: 'Pediu algo e não disse o quê',
    efeito: 'gente',
    quando:
      '"Preciso da sua força." O caso fica com você — e com a avaliação por IA ligada, é ela que ' +
      'assume. Decisão sua (03/09): pedido é intenção, não forma de frase, e nenhum padrão de ' +
      'texto acerta os dois lados. Nada sai sozinho aqui; a pergunta "em que posso ajudar" ' +
      'continua a um clique, na tecla 9. Negar ou responder antes de saber ofende quem só queria ' +
      'apoio político (Lei 9.504/97).',
  },
  'ultima-e-despedida': {
    rotulo: 'Só se despediu',
    efeito: 'silencio',
    quando: '"Amém", "é nós", "abraço". A conversa acabou: conclui sem mandar mais nada.',
  },
  'rajada-de-anuncios': {
    rotulo: 'Só clicou em vários anúncios seguidos',
    efeito: 'depende',
    quando:
      'Dois ou mais cliques em anúncio na mesma rajada, sem ela ter escrito nada. Não é pedido de ' +
      'um conteúdo: é navegação. A mensagem do momento serve para todos os anúncios; o modelo de ' +
      'um deles responderia a um terço do que ela fez.',
    ramos: [
      { tecla: '5', se: 'a mensagem do momento ainda não saiu para ela' },
      { tecla: '3', se: 'ela já recebeu a do momento, ou não há uma configurada' },
    ],
  },
  'voltou-por-outro-anuncio': {
    rotulo: 'Ignorou o pedido e voltou por outro anúncio',
    efeito: 'depende',
    quando: 'Manda a mensagem do momento; se ela já saiu, só conclui.',
    ramos: [
      { tecla: '5', se: 'a mensagem do momento ainda não saiu para ela' },
      { tecla: '3', se: 'ela já recebeu a do momento, ou não há uma configurada' },
    ],
  },
  'anuncio-modelo-e-dados': {
    rotulo: 'Chegou pelo anúncio: modelo + pedir os dados',
    efeito: 'envia',
    quando:
      'Manda o modelo deste anúncio (ou o padrão, quando o texto não foi reconhecido) e, na mesma ' +
      'passada, o pedido de nome e cidade — depois conclui. São DUAS mensagens, e é a única tecla ' +
      'do projeto que faz isso. Só casa quando as duas metades cabem: há modelo mapeado que ainda ' +
      'não saiu, ela não tem etiqueta de cidade e o pedido nunca foi feito.',
  },

  'respondeu-os-dados': {
    rotulo: 'Respondeu o nome e a cidade que pedimos',
    efeito: 'envia',
    quando:
      'O pedido de dados saiu e ela respondeu com nome ou cidade. Agradece e conclui, SEM mandar ' +
      'modelo — o modelo já foi o recibo da chegada, e repeti-lo é mandar duas vezes a mesma coisa.',
  },
  'nada-legivel-dela': {
    rotulo: 'Ela não mandou nada legível',
    efeito: 'envia',
    quando:
      'Tudo o que ela mandou foi mídia que a plataforma não conseguiu ler — sem texto, sem nome, ' +
      'sem cidade. O pedido de nome e cidade fica deslocado aí (decisão sua, 03/09: "a mensagem de ' +
      'nome e cidade ficou deslocada demais"), porque ele pressupõe uma conversa em andamento. A ' +
      'pergunta de interesse cria o contexto que falta e já pede nome e cidade na mesma mensagem.',
  },
  'nunca-pediram-dados': {
    rotulo: 'Veio do anúncio e nunca pedimos os dados dela',
    efeito: 'envia',
    quando:
      'Pede nome e cidade e conclui. Quem respondeu que não vai ao evento cai aqui: sai "não tem ' +
      'problema" junto com o pedido.',
  },
  'ultima-e-so-reacao': {
    rotulo: 'Só figura, emoji ou link',
    efeito: 'depende',
    ramos: [
      { tecla: '5', se: 'você ainda não respondeu hoje' },
      { tecla: '3', se: 'você já respondeu hoje, ou não há mensagem do momento' },
    ],
    quando:
      'Não há conteúdo para responder, e ignorar também não serve. Mensagem do momento, ou conclui ' +
      'se já respondemos hoje.',
  },
  'pergunta-aberta': {
    rotulo: 'Fez uma pergunta de razão ou de posição',
    efeito: 'gente',
    quando:
      'Nenhuma resposta pronta responde, e o modelo em cima da pergunta dela vira material de ' +
      'campanha.',
  },
  'contexto-de-outro-dia': {
    rotulo: 'A última dela é de outro dia',
    efeito: 'depende',
    ramos: [
      { tecla: '5', se: 'há mensagem do momento e ela ainda não saiu para essa pessoa' },
      { tecla: '3', se: 'não há mensagem do momento, ou ela já saiu' },
    ],
    quando:
      'O contexto passou: responder o conteúdo de ontem soa a quem não estava lá. Manda a mensagem ' +
      'do momento, que é o que há de novo hoje, e conclui. Decisão sua (03/09, generalizada em ' +
      '04/09 com quatro casos). Duas exceções, e as duas estão na CONDIÇÃO: pergunta pendente e ' +
      'material pedido que ainda não saiu — pedido não vence com o dia (05/09). Só casa se houver ' +
      'mensagem do momento configurada e ela ainda não tiver saído para essa pessoa — e fica ' +
      'ABAIXO de tudo o que precisa de você (pedido, pergunta, áudio) e do anúncio reconhecido, ' +
      'que é escolha explícita dela.',
  },
  'so-expressa-apoio': {
    rotulo: 'Só apoio, sem pergunta e sem pedido',
    efeito: 'envia',
    quando:
      'É o desfecho de quem só apareceu para dizer que está com vocês: agradece e conclui. O TEMPO ' +
      'saiu daqui em 04/09 — quem escreveu em outro dia é atendido pela caixa "A última dela é de ' +
      'outro dia", que fica acima. Um conceito, um lugar.',
  },
  'ja-respondemos-antes': {
    rotulo: 'Já entregamos algo antes',
    efeito: 'depende',
    ramos: [
      { tecla: '6', se: 'ela deixou uma pergunta, ou pediu material que ainda não saiu' },
      { tecla: '5', se: 'nada saiu hoje e a do momento ainda não foi' },
      { tecla: '3', se: 'já respondemos hoje, ou a do momento já saiu' },
    ],
    quando:
      'O modelo é a entrega inicial; quem já foi atendido e volta está aparecendo, não pedindo de ' +
      'novo. Pedido de dados NÃO conta como entrega. Esta regra está acima de "conteúdo pedido" ' +
      'por decisão sua (31/08) — se ela mandar a do momento onde devia mandar o modelo, é a ordem ' +
      'que vale rediscutir.',
  },
  'conteudo-pedido': {
    rotulo: 'Conteúdo reconhecido, com modelo mapeado',
    efeito: 'envia',
    quando:
      'Manda o modelo aprovado do conteúdo que ela pediu. Sem mapeamento em Config → "Modelo por ' +
      'conteúdo", esta regra não dispara.',
  },
  'nome-sem-sentido': {
    rotulo: 'O nome do cadastro não serve',
    efeito: 'envia',
    quando:
      'Apelido automático do anúncio, sigla colada, cidade no campo do nome. Pede os dados e conclui.',
  },
  'nunca-perguntaram-interesse': {
    rotulo: 'Nunca perguntamos se ela quer conteúdo',
    efeito: 'envia',
    quando: 'Pergunta o interesse e pede nome e cidade na mesma mensagem, e conclui.',
  },
  'pedido-hoje-sem-resposta': {
    rotulo: 'Pedimos hoje e nada voltou',
    efeito: 'silencio',
    quando: 'Repetir o pedido no mesmo dia é insistir. Conclui e espera.',
  },
};

/**
 * Os DESFECHOS de uma regra que casou — o galho do "casou" no mapa da janela.
 *
 * Uma regra não é uma linha, é uma bifurcação: **casou** leva ao desfecho (a tecla, e o que o
 * eleitor recebe por ela) e **não casou** leva à regra de baixo. Enquanto o mapa desenhava só a
 * segunda, o que sai para a pessoa ficava resumido a um selo de três palavras.
 *
 * Devolve mais de um ramo quando a MESMA situação pede teclas diferentes conforme o contexto —
 * é a `tecla` que é função, em três regras. Tecla fixada por ele na janela colapsa a bifurcação:
 * a escolha dele vence a do código em `sugerirAcao`, e o mapa tem que mostrar isso, senão a tela
 * promete dois caminhos onde só existe um.
 *
 * @returns {Array<{tecla:string, se:string, rotulo?:string, efeito?:string, fixada?:boolean}>}
 */
export function ramosDaRegra(id, fluxo) {
  const regra = REGRAS.find((r) => r.id === id);
  if (!regra) return [];
  const fixada = fluxo?.teclas?.[id];
  if (fixada) return [{ tecla: fixada, se: '', fixada: true, ...(TECLAS[fixada] || {}) }];
  if (typeof regra.tecla === 'function') {
    return (SOBRE[id]?.ramos || []).map((r) => ({ ...r, ...(TECLAS[r.tecla] || {}) }));
  }
  return [{ tecla: regra.tecla, se: '', ...(TECLAS[regra.tecla] || {}) }];
}

/**
 * O que o eleitor recebe por esta regra, JÁ CONTANDO a tecla que ele fixou.
 *
 * O `efeito` do verbete é o do código. Fixar a tecla 's' numa regra rotulada "envia" deixava o
 * cartão com a borda de "sai mensagem" prometendo o contrário do que ia acontecer.
 */
export function efeitoDaRegra(id, fluxo) {
  const ramos = ramosDaRegra(id, fluxo);
  if (!ramos.length) return SOBRE[id]?.efeito || 'depende';
  const efeitos = new Set(ramos.map((r) => r.efeito).filter(Boolean));
  return efeitos.size === 1 ? [...efeitos][0] : 'depende';
}

/**
 * Regra cujo desfecho não fecha — o que o mapa desenharia errado.
 *
 * Três coisas de uma vez: tecla sem verbete em `TECLAS` (galho apontando para lugar nenhum),
 * regra de tecla-função sem `ramos` (bifurcação sem os dois lados escritos) e selo que discorda
 * da tecla (cartão dizendo "sai mensagem" numa regra que conclui em silêncio).
 */
export function regrasComDesfechoIncoerente() {
  const problemas = [];
  for (const r of REGRAS) {
    const ramos = ramosDaRegra(r.id, null);
    if (!ramos.length) {
      problemas.push(r.id + ': a tecla e funcao e falta a lista "ramos" no verbete');
      continue;
    }
    for (const ramo of ramos) {
      if (!TECLAS[ramo.tecla]) problemas.push(r.id + ': tecla "' + ramo.tecla + '" sem verbete em TECLAS');
    }
    const declarado = SOBRE[r.id]?.efeito;
    const real = efeitoDaRegra(r.id, null);
    if (declarado && declarado !== real) {
      problemas.push(r.id + ': verbete diz "' + declarado + '" e a tecla faz "' + real + '"');
    }
  }
  return problemas;
}

/** Toda regra do código tem verbete? A janela mostraria linha muda se faltasse. */
export function regrasSemVerbete() {
  return REGRAS.filter((r) => !SOBRE[r.id]).map((r) => r.id);
}
