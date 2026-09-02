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
    quando: (c) => !!c.semInteresse,
    motivo: (c) => `${c.semInteresse.motivo} — marque "sem interesse" e conclua sem responder.`,
  },
  {
    id: 'etiqueta-dispensa-da-fila',
    tecla: '2',
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
     * Sugere PULAR e não CONCLUIR: pular deixa o atendimento aberto, e fechar quem está engajado
     * sem dizer nada é decisão maior do que uma sugestão deve tomar.
     */
    quando: (c) => !!c.etiquetaQueDispensa,
    motivo: (c) => `tem a etiqueta "${c.etiquetaQueDispensa}" — já está engajado, a rodada não precisa dele.`,
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
    tecla: '9',
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
    quando: (c) => !!c.pedeAlgoIndefinido && c.podePerguntarAjuda,
    motivo: (c) =>
      `"${c.pedeAlgoIndefinido.trecho}" — pediu algo sem dizer o quê. Pergunte antes de responder.`,
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
    tecla: (c) => (c.momentoJaEnviado || !c.podeMandarMomento ? '3' : '5'),
    quando: (c) => c.voltouPorOutroAnuncio,
    motivo: (c) =>
      c.momentoJaEnviado || !c.podeMandarMomento
        ? 'voltou por outro anúncio e já recebeu a mensagem do momento — conclua e siga.'
        : 'voltou por outro anúncio — não mande o mesmo conteúdo de novo; a mensagem do momento serve.',
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
      !c.jaPediramDados &&
      !c.pedidoHoje,
    motivo: () =>
      'chegou pelo anúncio: sai o modelo como recibo e, em seguida, o pedido de nome e cidade.',
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
    quando: (c) =>
      !c.rajadaEhSoRepasse &&
      !c.jaPediramDados &&
      !c.temEtiquetaDeCidade &&
      c.podePedirDados &&
      !c.pedidoHoje,
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
    quando: (c) => c.ultimaEhSoReacao,
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
    id: 'so-expressa-apoio',
    tecla: '8',
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
    motivo: () => 'escreveu apoio em mensagem própria — responda a ela; o material fica para depois.',
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
    tecla: (c) => (c.respondidoHoje || c.momentoJaEnviado || !c.podeMandarMomento ? '3' : '5'),
    quando: (c) => !!c.jaRespondemosAntes,
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
    id: 'confirmou-presenca-com-dados',
    tecla: '8',
    /**
     * **Ela confirmou que vai ao evento e nós já temos os dados dela: agradece e encerra.**
     *
     * Print do Deoclecio (02/09/2026): contato com TODAS as etiquetas — cidade, conteúdo, engajado
     * — recebeu *"Que bom! Será uma grande satisfação contar com você… Nome / Cidade"* **duas
     * vezes**. Relato dele: *"repetindo resposta em pessoa com todas etiquetas, pediu dados, o caso
     * certo seria só agradecer a presença no evento e concluir"*.
     *
     * Faltava esta regra. Até aqui `confirmaPresenca` só trocava o TEXTO da tecla 4 — o pedido de
     * dados ganhava um preâmbulo de evento. Não havia desfecho para "confirmou e não falta dado
     * nenhum", então o caso descia até quem pede o cadastro, e pedia o que já estava no CRM.
     *
     * Fica ACIMA de `respondeu-os-dados`: quem confirmou presença falou de outra coisa, e o
     * agradecimento pela presença é o desfecho mais específico.
     */
    quando: (c) => c.confirmouPresenca && c.temEtiquetaDeCidade,
    motivo: () => 'confirmou que vai ao evento e já temos os dados dela — agradeça a presença e encerre.',
  },
  {
    id: 'respondeu-os-dados',
    tecla: '8',
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
    quando: (c) => !!c.respondeuOsDados,
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
    quando: (c) => c.podeEnviar && !c.enviadoHoje && !c.modeloJaNaConversa,
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
  '8': { rotulo: 'Agradece o apoio, e conclui', efeito: 'envia' },
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
  'etiqueta-dispensa-da-fila': {
    rotulo: 'Tem a etiqueta que dispensa da fila',
    efeito: 'silencio',
    quando: 'Já está engajado. Pula e deixa o atendimento aberto onde estava.',
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
    efeito: 'envia',
    quando:
      '"Preciso da sua força." Pergunta em que pode ajudar e deixa aberto. Negar ou responder ' +
      'antes de saber ofende quem só queria apoio político (Lei 9.504/97).',
  },
  'ultima-e-despedida': {
    rotulo: 'Só se despediu',
    efeito: 'silencio',
    quando: '"Amém", "é nós", "abraço". A conversa acabou: conclui sem mandar mais nada.',
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
  'confirmou-presenca-com-dados': {
    rotulo: 'Confirmou presença no evento e já temos os dados',
    efeito: 'envia',
    quando:
      'Ela disse que vai ao evento e já tem etiqueta de cidade — não falta dado nenhum. Agradece e ' +
      'conclui, SEM pedir nome e cidade de novo. Sem esta regra o caso descia até o pedido de ' +
      'cadastro e pedia o que já está no CRM.',
  },
  'respondeu-os-dados': {
    rotulo: 'Respondeu o nome e a cidade que pedimos',
    efeito: 'envia',
    quando:
      'O pedido de dados saiu e ela respondeu com nome ou cidade. Agradece e conclui, SEM mandar ' +
      'modelo — o modelo já foi o recibo da chegada, e repeti-lo é mandar duas vezes a mesma coisa.',
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
  'so-expressa-apoio': {
    rotulo: 'Só apoio, sem pergunta e sem pedido',
    efeito: 'envia',
    quando: 'Agradece o apoio e conclui. É o desfecho de quem só apareceu para dizer que está com vocês.',
  },
  'ja-respondemos-antes': {
    rotulo: 'Já entregamos algo antes',
    efeito: 'depende',
    ramos: [
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
