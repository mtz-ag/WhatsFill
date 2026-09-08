/**
 * cortesia.js — quem só cumprimentou, mandou um link ou mandou uma figura.
 *
 * **O problema que isto resolve:** na rodada dos Novos, quem não trazia a frase do aceite do
 * anúncio era assumido e não recebia nada — a rodada abria a conversa e não mandava coisa
 * nenhuma. Essas pessoas falaram com o gabinete; o silêncio é a pior resposta possível, e o
 * formulário de nome/cidade não é resposta a "bom dia". A mensagem do momento é.
 *
 * **E havia um caso pior:** `api.getIncomingText` só devolve mensagem COM texto. Quem mandava só
 * uma figura — o "bom dia" ilustrado, comum nesta base — chegava à rodada como *"não escreveu
 * nada"*. Por isso a decisão aqui recebe `{texto, tipo}`, e não só o texto.
 *
 * **Por que a regra é conservadora:** aqui o erro caro é o FALSO POSITIVO. Mandar "Feliz Dia dos
 * Pais" para quem perguntou outra coisa é responder ao lado. Por isso **todas** as mensagens da
 * janela precisam ser cortesia: sobrando qualquer substância, isto devolve `null` e o contato
 * segue o caminho de antes. Errar para o silêncio custa um contato na pilha dele; errar para o
 * outro lado é uma resposta fora de contexto saindo de um mandato.
 *
 * Puro e sem dependência, como o resto do que decide sobre mensagem de gente real.
 */

/** Tipos que a plataforma usa para figura. Conferidos no bundle do app (29/08/2026). */
/**
 * Mídia que a pessoa **repassa**, e não produz: figura, figurinha e vídeo.
 *
 * O vídeo entrou aqui em 31/08, a pedido dele, com a print do Odone — que mandou um reel do
 * Instagram e um vídeo do Facebook de 631 mil visualizações. A caixa sugeria *"mandou um vídeo
 * — só dá para responder depois de abrir. Responda à mão"*, e a resposta dele foi:
 * *"são centenas de mensagens e crescendo, não existe essa de parar pra ver vídeos e responder,
 * é ignorar dando bom dia ou enrolar com outro assunto"*.
 *
 * **O áudio continua fora desta lista, e a diferença é quem está falando.** Áudio é a pessoa
 * gravando para ele — o caso que criou a regra foi 1min13 sobre a família e a igreja, e mandar
 * modelo ali parece deboche. Vídeo compartilhado é conteúdo de terceiro chegando pela décima
 * vez no dia; abrir cada um não escala, e não abrir não ofende ninguém.
 */
const TIPOS_COMPARTILHADOS = new Set(['IMAGE', 'STICKER', 'VIDEO']);

/** "bom dia", "boa tarde", "boa noite", "boa madrugada" — com ou sem acento, com ou sem espaço. */
const SAUDACAO = /\b(bom\s*dia|boa\s*(tarde|noite|madrugada))\b/i;

/** Endereço na mensagem. Pega o "www." e o domínio solto, não só o que começa com http. */
const LINK = /(https?:\/\/\S+|www\.\S+|\b[a-z0-9-]+\.(com|br|net|org|me|tv|app|io)(\/\S*)?\b)/i;

/**
 * **O ENDEREÇO não é escrita dela** — relato dele (05/09/2026): *"vários casos da pessoa mandando
 * link e reconhece como conversa e passa pra mim"*.
 *
 * Medido: três mensagens do tipo *"olha isso aqui <link do Instagram>"* somam **224 caracteres** e
 * caem em `conversaPedeRespostaPessoal` como *"escreveu 3 mensagens próprias"* — tecla 6. Mas ela
 * escreveu quinze caracteres; o resto é URL. O tamanho existe para medir **quanto ela falou**, e
 * URL colada não é fala — é o mesmo critério que já tira o texto gerado pelo anúncio da conta.
 *
 * Vale para as duas pontas: o corte de "mensagem própria" e a soma da rajada.
 */
/**
 * **A LEGENDA de um repasse nao e pergunta para nos** — regra dele (06/09/2026), com a print do
 * Eraldo.
 *
 * Ele encaminhou um video com a legenda *"Voce e Patriota? Entao coloque este Video nos grupos !"*,
 * a interrogacao fez a caixa cair em `pergunta-aberta` (tecla 6), e a IA escreveu uma resposta
 * longa explicando que nao pode fazer campanha com recursos de terceiros. Ele apagou. *"a pessoa
 * esta encaminhando links e legendas, a resposta ficou fora de contexto; seria uma excecao a regra
 * da pergunta: pergunta com link usa a regra de mandar mensagem do momento ou agradecer as
 * informacoes e encerrar"*.
 *
 * **A "pergunta" da legenda e retorica, e nem e dirigida a nos** — ela veio escrita no proprio
 * material que circula em grupo. Responde-la e responder ao autor do video, nao a pessoa.
 *
 * **Isto NAO e o conserto de 05/09** (`semLinks`), que tirava o "?" da query string da URL. Aqui a
 * interrogacao esta no texto de verdade; o que a desqualifica e o que ela acompanha.
 *
 * O custo conhecido: pergunta de verdade colada num link (*"olha isso, voces vao apoiar?"*) deixa
 * de ir para a tecla 6 e recebe a mensagem do momento. Foi a troca que ele escolheu, e o erro e
 * recuperavel — ele ve a linha na rodada.
 */
function ehLegendaDeRepasse(msg) {
  /**
   * **VÍDEO ou LINK — e FIGURA não**, que é o mesmo corte que `ehRepasse` já fazia.
   *
   * `TIPOS_COMPARTILHADOS` tem IMAGE dentro por causa do "bom dia ilustrado", mas figura nesta base
   * também é a foto do exame, da rua esburacada, do documento — coisa DELA, não conteúdo de
   * terceiro. Uma pergunta colada numa figura *("olha meu exame, vocês ajudam?")* continua sendo
   * pergunta; colada num vídeo encaminhado, não.
   */
  if (String(msg?.tipo || 'TEXT').toUpperCase() === 'VIDEO') return true;
  /**
   * **A pergunta que está DENTRO de um áudio encaminhado também não é para nós** — print da Irene
   * (07/09/2026). O último áudio do lote dela é uma pessoa perguntando a outra *"não deu pra ouvir
   * nada que você botou ali, tá mudo?"*, e a rodada tratou aquilo como pergunta pendente.
   *
   * É a regra dele de 06/09 (o Eraldo) aplicada onde ela ainda não chegava: ali o repasse se
   * reconhecia pelo TIPO da mensagem; aqui, pela aritmética de `marcarLoteEncaminhado`.
   */
  if (msg?.encaminhado) return true;
  return LINK.test(String(msg?.texto || ''));
}

function semLinks(texto) {
  return String(texto || '')
    .replace(LINK, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Só emoji (e o modificador de tom de pele / seletor de variação que costuma vir junto).
 *
 * São DUAS: a com `g` serve para apagar, a sem `g` para testar. `RegExp` com `g` guarda o
 * `lastIndex` entre chamadas, então `test()` na mesma instância global devolve resultado
 * diferente na segunda vez com o mesmo texto — bug que só aparece no segundo contato da rodada.
 */
const EMOJI_TODOS = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}]/gu;
const TEM_EMOJI = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;

/**
 * O que sobra depois de tirar saudação, link, pontuação, emoji e o vocabulário de cortesia.
 * Não sobrou nada? Então a mensagem era só cortesia.
 */
function restoDaMensagem(texto) {
  return String(texto || '')
    .replace(LINK, ' ')
    .replace(SAUDACAO, ' ')
    .replace(
      /\b(a|as|o|os|que|para|pra|pro|todos|todas|voce|vocês|voces|amigos?|amigas?|amado|amada|deputado|mestre|chefe|guerreir[oa]|campe(ã|a)o|parceir[oa]|irm(ã|ao|a|as|aos)|meu|minha|nobre|querid[oa]|obrigad[oa]|abraç?o|abracos?|abraços?|tudo|bem|tenha[m]?|um|uma|otim[oa]|ótim[oa]|excelente|feliz|semana|final|fds|deus|abenç?oe|abencoe)\b/gi,
      ' '
    )
    .replace(/[\p{P}\p{S}\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Uma mensagem sozinha é cortesia? */
function mensagemDeCortesia(msg) {
  const tipo = String(msg?.tipo || 'TEXT').toUpperCase();
  const texto = String(msg?.texto || '');

  // Figura sem legenda é o caso que sumia da conta.
  if (TIPOS_COMPARTILHADOS.has(tipo) && !texto.trim()) return true;
  if (TIPOS_COMPARTILHADOS.has(tipo)) return !restoDaMensagem(texto);

  if (!texto.trim()) return false;
  if (!SAUDACAO.test(texto) && !LINK.test(texto)) return false;

  // "bom dia, preciso falar com o deputado" tem substância: não é cortesia.
  return !restoDaMensagem(texto);
}

/**
 * A mensagem é só uma REAÇÃO — figura, figurinha, emoji solto ou link?
 *
 * Diferente de `soCortesia`, que olha a janela inteira e exige cumprimento/link/figura em todas:
 * aqui a pergunta é sobre UMA mensagem, e "bom dia" **escrito** não conta. O caso é a pessoa que
 * manda um 👍, uma figurinha ou um link e fica esperando — não há o que responder ao conteúdo,
 * mas ignorar também não serve.
 *
 * @param {{texto?:string, tipo?:string}} msg
 * @returns {boolean}
 */
export function ehSoReacao(msg) {
  const tipo = String(msg?.tipo || 'TEXT').toUpperCase();
  const texto = String(msg?.texto || '');

  if (TIPOS_COMPARTILHADOS.has(tipo)) return !texto.trim() || !restoDaMensagem(texto);
  if (!texto.trim()) return false;

  // Link e nada mais.
  if (LINK.test(texto) && !texto.replace(LINK, ' ').replace(/\s+/g, ' ').trim()) return true;

  // Emoji, pontuação e espaço — e nada além disso: o "👍" e o "🙏🙏🙏".
  const semEmoji = texto
    .replace(EMOJI_TODOS, '')
    .replace(/[\p{P}\p{S}\s]/gu, '')
    .trim();

  // Só conta se REALMENTE havia emoji: "..." ou "!!!" sozinho é outra coisa, e não merece a
  // mensagem do momento.
  return !semEmoji && TEM_EMOJI.test(texto);
}

/**
 * Como a pessoa fecha a conversa por aqui.
 *
 * Vocabulário do lugar, não de manual: *"é nós"*, *"abraço"*, *"valeu"*, *"amém"*. É despedida de
 * apoiador, e a resposta certa a ela é fechar o atendimento — não mandar mais uma mensagem.
 *
 * **Só "tamo junto", "tmj" e "estamos juntos" saíram daqui em 31/08** — estavam também em
 * `EXPRESSOES_DE_APOIO`, e como esta regra vem antes, o apoio nunca era alcançado. Print do
 * Izaak: última mensagem *"Tamojuntos"*, e a caixa sugeriu concluir. *"nesse caso vou usar a
 * mensagem 8, a última mensagem foi tamojuntos, seria estamos juntos"*.
 *
 * A linha: **fecho é fecho; solidariedade é apoio.** "Valeu, abraço" encerra a conversa;
 * "tamo junto" afirma que a pessoa está com ele, e isso pede reconhecimento.
 *
 * `sucesso`, `boa sorte` e a bênção **ficaram aqui**: ele não pediu para mexer nelas, e
 * "Que Deus abençoe" sozinho é fecho. Mexer no que não foi apontado é como se perde o que já
 * estava certo.
 */
/**
 * `(^|[^\p{L}])` em vez de `\b`, e em vez de `(^|\s)`.
 *
 * **Duas armadilhas, uma em cima da outra:**
 *
 * 1. `\b` é fronteira de `\w`, e `é` não é `\w`: `/\bé nós/` **nunca** casa no começo da
 *    string. Foi assim que "É nós." — a frase exata da print dele — passou batido.
 * 2. `(^|\s)`, que foi o conserto da primeira, **não casa depois de pontuação**. Print da
 *    Gessi (31/08): *"Itaqui Rs...sempre com vocês capitão"* — o "sempre" vem depois de três
 *    pontos, sem espaço, e nenhum padrão pegava. No WhatsApp se escreve assim o tempo todo.
 *
 * `[^\p{L}]` é "qualquer coisa que não seja letra": espaço, ponto, vírgula, emoji, quebra de
 * linha. Exige a flag `u`. Não casa dentro de palavra ("desempre" continua fora), que é o
 * ponto de ter uma fronteira.
 */
const DESPEDIDA =
  /(^|[^\p{L}])(e|é)\s*n(ó|o)(s|is)\b|\b(forte\s*)?abra(ç|c)o(s)?\b|\bvaleu\b|\bvlw\b|\bobrigad[oa]\b|\bbrigad[oa]\b|(^|[^\p{L}])am(é|e)m\b|\bboa\s*sorte\b|\bdeus\s*(te\s*)?aben(ç|c)oe\b|\bfica\s*com\s*deus\b|\bsucesso\b/iu;

/**
 * A mensagem é SÓ uma despedida?
 *
 * Pedido dele (31/08), com a print de quem escreveu apenas *"É nós."* e recebeu a sugestão de
 * mandar o modelo: *"a pessoa só fechou a conversa… eu concluo a conversa"*.
 *
 * **Exige que não sobre nada além da despedida.** *"Valeu, me manda o material"* tem pedido
 * dentro, e concluir ali seria fechar a porta na cara de quem pediu algo. É a mesma disciplina
 * do resto deste arquivo: sobrando substância, a resposta é `false`.
 *
 * @param {{texto?:string, tipo?:string}} msg
 * @returns {boolean}
 */
export function ehDespedida(msg) {
  const texto = String(msg?.texto || '');
  if (!texto.trim()) return false;

  /**
   * A despedida AMARGA fecha a conversa igual — ver `DESPEDIDA_AMARGA`. Vale sem a conferência do
   * "sobrou conteúdo": *"Então deixa muito obrigada por nada"* tem o "então deixa" antes, e exigir
   * que nada sobre faria a frase inteira deixar de contar justamente por ser uma frase.
   */
  if (DESPEDIDA_AMARGA.test(texto)) return true;

  if (!DESPEDIDA.test(texto)) return false;

  // Tira a despedida (todas as ocorrências) e vê o que sobrou de conteúdo.
  const resto = restoDaMensagem(texto.replace(new RegExp(DESPEDIDA.source, 'gi'), ' '));
  return !resto;
}

/** A última mensagem do contato é só uma despedida? */
export function ultimaEhDespedida(entrantes) {
  const lista = Array.isArray(entrantes) ? entrantes : [];
  if (!lista.length) return false;
  return ehDespedida(lista[lista.length - 1]);
}

/**
 * Tipos que sempre pedem você em pessoa: não dá para responder sem abrir.
 *
 * **`VIDEO` saiu daqui em 31/08** e foi para `TIPOS_COMPARTILHADOS` — ver o comentário de lá.
 * O que sobrou é o que a pessoa produziu ou endereçou a ele: a voz dela, um arquivo que ela
 * anexou, um contato que ela passou, o lugar onde ela está.
 */
const TIPOS_QUE_PEDEM_VOCE = new Set(['AUDIO', 'DOCUMENT', 'CONTACT', 'LOCATION']);

/** Como cada um desses tipos se chama na frase que aparece na caixa. */
const NOME_DO_TIPO = {
  AUDIO: 'um áudio',
  DOCUMENT: 'um arquivo',
  CONTACT: 'um contato',
  LOCATION: 'uma localização',
};

/**
 * A partir de quantos caracteres uma mensagem deixa de caber numa resposta pronta.
 *
 * 400 e não 200: mensagem de apoiador animado passa fácil de 200 e ainda é o caso normal da
 * rodada. A transcrição de um áudio de 1 minuto passa de 600 — é essa a fronteira que interessa.
 */
const TEXTO_LONGO = 400;

/**
 * **A RAJADA pede gente por outro caminho: várias mensagens próprias, sem ninguém responder.**
 *
 * Print dele (03/09/2026, Porto Alegre): o contato escreveu *"Vocês viram a propaganda denegrindo
 * o Flávio Bolsonaro nos canais Globo / RBS e Band do RS?"*, *"Simplesmente horrível! Insinuando
 * q. ele é bandido"*, *"Já tomaram providências?"*, *"??"* e *"Agora com o Vorcaro X careca…msg
 * reveladoras."* — e recebeu **o modelo, com o atendimento concluído**. Ele: *"mandou modelo e
 * concluiu; quando tiver mensagens assim, ao menos tem que deixar aberta a conversa"*.
 *
 * Pelo caminho antigo nada pegava: a rajada tem ~230 caracteres (longe dos 400), não é reação, não
 * é despedida, e as perguntas dela não estão nas listas de `conversaTemPerguntaAberta` — ninguém
 * cadastra "já tomaram providências". Mesma coisa na anotação do jairoc (~255).
 *
 * **O número de mensagens é o sinal que faltava.** Quem escreve quatro vezes seguidas sem
 * resposta está conversando, não reagindo — e o tamanho de cada uma não muda isso. Os dois cortes
 * abaixo são calibrados nesses dois casos reais, e é bom saber que são: mexer neles muda quanta
 * gente sai da automação.
 */
const RAJADA_LONGA = 250;

/**
 * **Áudio transcrito é conversa mais cedo que texto escrito.**
 *
 * Anotação da Maria Genoli (03/09/2026): ela mandou um áudio de sete minutos explicando por que
 * não consegue ir ao evento — doente, com falta de ar, pedindo desculpas — e a rodada ofereceu a
 * **resposta pronta do anúncio**. Ele: *"mandou 7min de áudio que foi transcrito; a IA assume e
 * responde, ou eu"*.
 *
 * A transcrição tem ~300 caracteres, e o corte de texto longo é 400. Mas quem grava sete minutos
 * está conversando de um jeito que nenhuma resposta pronta cobre — e a transcrição é um resumo do
 * que foi dito, não a fala inteira. Por isso o corte é mais baixo quando veio de áudio.
 */
const TEXTO_FALADO = 150;
const RAJADA_MUITAS = 3;

/**
 * Mensagem com substância PRÓPRIA — nem cortesia, nem reação, nem "??" solto.
 *
 * **O texto do ANÚNCIO não conta**, e essa é a metade que evita o falso positivo mais caro: quem
 * clica em três anúncios manda três mensagens compridas que ela não escreveu (*"Olá! Eu apoio as
 * Escolas Cívico-Militares 🤝"*), e sem isto a rodada mandaria a Eroni para atendimento manual em
 * vez de entregar o modelo que ela pediu. É o mesmo critério de `soExpressaApoio`, e pela mesma
 * razão — medido nos dois casos.
 */
function temSubstancia(msg, padroesDeAnuncio) {
  if (mensagemDeCortesia(msg) || ehSoReacao(msg)) return false;
  if (ehMensagemDeAnuncio(msg, padroesDeAnuncio)) return false;
  return semLinks(msg?.texto).length >= 20;
}

/**
 * Esta mensagem pede uma resposta ESCRITA POR VOCÊ?
 *
 * Áudio, vídeo e documento entram sempre: não dá para responder sem abrir. Texto entra por
 * tamanho — quem escreveu (ou falou) três parágrafos contando da família e da igreja não recebe
 * modelo aprovado sem que isso pareça deboche.
 *
 * A transcrição do áudio, quando a plataforma a devolve no texto da mensagem, cai no mesmo laço
 * pelo tamanho. Quando não devolve, o tipo já resolve.
 *
 * @param {{texto?:string, tipo?:string}} msg
 * @returns {{motivo:string}|null}
 */
export function pedeRespostaPessoal(msg) {
  const tipo = String(msg?.tipo || 'TEXT').toUpperCase();
  const texto = String(msg?.texto || '');

  /**
   * **Áudio TRANSCRITO já é legível, e dizer o contrário é mentir na tela.**
   *
   * O motivo "só dá para responder depois de abrir" nasceu quando áudio chegava vazio. Hoje a
   * plataforma manda a transcrição na própria mensagem (`transcrito: true`), o painel a exibe, e
   * o parser a lê — então a caixa aparecia com a transcrição inteira do lado e ainda afirmando
   * que era preciso abrir para saber o conteúdo (print de 01/09/2026).
   *
   * Transcrição existindo, o áudio segue pelo mesmo caminho de um texto: se for longo, é conversa
   * e continua pedindo você; se for curto, as outras regras decidem. O que muda é que a decisão
   * passa a considerar o CONTEÚDO em vez de parar no formato.
   */
  const temTranscricao = !!msg?.transcrito && !!texto.trim();

  /**
   * **Não há o que abrir quando foi a PLATAFORMA que avisou que não deu.**
   *
   * Anotação do Clovis (07/09/2026, v2.93): a conversa inteira era
   * *"*Atenção:* o tipo da mensagem enviada pelo contato não é suportado."*, e a caixa recomendou a
   * tecla 6 dizendo *"mandou um áudio — só dá para responder depois de abrir"*. Ele: *"mandar
   * mensagem do momento"*.
   *
   * O ruído da plataforma **já era** reconhecido — `prepararEntrantes` esvazia o texto e marca
   * `sistema: true` (o conserto do Carlos e da Vera, 02/09). O que faltava era esta metade: a
   * mensagem continua carregando o `tipo`, e o teste de formato disparava por ele.
   *
   * **E o motivo alegado era falso na tela**, que é a mesma razão do conserto do áudio transcrito
   * três parágrafos acima: não existe áudio para abrir — a plataforma disse que **não conseguiu
   * entregar** a mensagem. Medido no fluxo padrão: com este sinal falso, o caso desce para
   * `contexto-de-outro-dia` e recebe a **tecla 5**, que é o que ele pediu.
   *
   * `sistema` não some do resto: a mensagem continua na lista com o tipo dela, e quem quiser
   * saber que houve algo ali continua vendo — o que ela não é é um arquivo esperando alguém abrir.
   */
  if (msg?.sistema) return null;

  if (TIPOS_QUE_PEDEM_VOCE.has(tipo) && !temTranscricao) {
    const comoChama = NOME_DO_TIPO[tipo] || 'um arquivo';
    return { motivo: `mandou ${comoChama} — só dá para responder depois de abrir` };
  }
  // O corte é mais baixo para o que foi FALADO — ver `TEXTO_FALADO`.
  if (texto.trim().length >= (temTranscricao ? TEXTO_FALADO : TEXTO_LONGO)) {
    // "Falou" quando veio de áudio: o motivo aparece na tela, e dizer que a pessoa "escreveu"
    // 700 caracteres que ela falou faz quem lê procurar uma mensagem de texto que não existe.
    const verbo = temTranscricao ? 'falou' : 'escreveu';
    return { motivo: `${verbo} ${texto.trim().length} caracteres — é conversa, não é caso de modelo` };
  }
  return null;
}

/**
 * Quanto tempo entre duas mensagens ainda é a MESMA rajada.
 *
 * Rajada é a pessoa digitando de uma vez — o caso que criou isto foram três mensagens em dois
 * minutos. Meia hora é folga larga para quem escreve devagar, e ainda separa isso de quem manda
 * uma coisa hoje e outra amanhã.
 */
const INTERVALO_DA_RAJADA_MS = 30 * 60 * 1000;

/**
 * A última rajada do contato: mensagens seguidas, próximas no tempo, sem resposta nossa depois.
 *
 * **Duas paradas, e a segunda foi aprendida caro** (31/08, print do Odone):
 *
 *  1. **a nossa última mensagem** — o que veio antes dela já foi respondido;
 *  2. **um buraco de mais de 30 minutos** entre duas mensagens dela.
 *
 * Sem a segunda, quem nunca foi respondido tinha como "rajada" o histórico INTEIRO. O Odone
 * compartilha vídeo o dia todo: 76 mensagens ao longo de semanas, 3.254 caracteres somados — e
 * a caixa anunciou *"escreveu 76 mensagens somando 3254 caracteres — é conversa"*. Não era
 * conversa: era **43 caracteres por mensagem**, links e repasses, acumulados porque ninguém
 * respondeu.
 *
 * O erro foi de definição, não de número: eu tratei "tudo que não respondemos" como se fosse
 * "tudo que ela escreveu de uma vez". São coisas diferentes, e a diferença é o relógio.
 *
 * Mensagem sem `at` não quebra a corrente: sem horário não dá para afirmar que houve buraco, e
 * o lado seguro de errar aqui é manter na rajada (ver `conversaPedeRespostaPessoal`).
 */
/**
 * **A última coisa que ela escreveu é de um dia anterior?**
 *
 * Critério dele (03/09/2026), decidindo o que fazer com quem volta só dizendo que apoia: *"a
 * questão é o contexto, a mensagem tem quanto tempo que mandou dando apoio; se foi no dia
 * anterior, é mensagem do momento; se foi recente, mensagem de apoio"*.
 *
 * O corte é o **dia local**, e não um número de horas, porque foi assim que ele descreveu (*"já é
 * outro dia"*, anotação do Tere e Gilmar) e porque é o que ele enxerga na tela da conversa: a
 * plataforma separa as mensagens por data. Horas contadas dariam resultados diferentes dos que ele
 * lê ali — 23h e 1h da manhã são "ontem e hoje" para quem olha, e três horas para quem conta.
 *
 * Mensagem sem `at` não decide nada: devolve `false`, que é o lado que **não** manda material.
 */
export function deOutroDia(entrantes, agora = new Date()) {
  const lista = Array.isArray(entrantes) ? entrantes : [];
  for (let i = lista.length - 1; i >= 0; i -= 1) {
    const t = lista[i]?.at ? new Date(lista[i].at) : null;
    if (t && !Number.isNaN(t.getTime())) return t.toDateString() !== new Date(agora).toDateString();
  }
  return false;
}

export function rajadaFinal(entrantes, nossaUltimaAt) {
  const lista = Array.isArray(entrantes) ? entrantes : [];
  if (!lista.length) return [];

  const corte = nossaUltimaAt ? new Date(nossaUltimaAt).getTime() : NaN;
  const temCorte = Number.isFinite(corte);

  const quando = (m) => {
    const t = m?.at ? new Date(m.at).getTime() : NaN;
    return Number.isFinite(t) ? t : null;
  };

  const depois = [];
  let seguinte = null; // horário da mensagem à direita desta, para medir o buraco

  for (let i = lista.length - 1; i >= 0; i--) {
    const at = quando(lista[i]);

    // Já foi respondida: daqui para trás não interessa.
    if (temCorte && at !== null && at <= corte) break;

    // Buraco grande até a mensagem seguinte: a rajada começa depois dele.
    if (at !== null && seguinte !== null && seguinte - at > INTERVALO_DA_RAJADA_MS) break;

    depois.unshift(lista[i]);
    if (at !== null) seguinte = at;
  }
  return depois;
}

/**
 * A conversa pendente deste contato pede resposta escrita por você?
 *
 * **Olha a RAJADA, não só a última mensagem** — e essa é a correção de 31/08. Um apoiador
 * escreveu três mensagens em dois minutos (~450 caracteres somados) alertando que gente paga
 * podia estar se passando por apoiador. Cada mensagem sozinha ficava abaixo do limite, o
 * conjunto passava, e a rodada caiu na regra de baixo e sugeriu **mandar o modelo da campanha**
 * para quem tinha acabado de dizer aquilo.
 *
 * Quem escreve três vezes seguidas está conversando, não pedindo conteúdo. Que os parágrafos
 * venham numa mensagem ou em três é jeito de digitar, não intenção — e era só isso que
 * separava este caso do áudio de 1min13 que a regra já pegava.
 *
 * Tipo (áudio, vídeo, arquivo) continua valendo por mensagem: um áudio no meio da rajada pede
 * você mesmo que o resto seja curto.
 *
 * @param {Array<{texto?:string, tipo?:string, at?:string}>} entrantes
 * @param {string|null} nossaUltimaAt quando saiu a nossa última mensagem
 * @returns {{motivo:string}|null}
 */
export function conversaPedeRespostaPessoal(entrantes, nossaUltimaAt, padroesDeAnuncio = []) {
  const rajada = rajadaFinal(entrantes, nossaUltimaAt);
  if (!rajada.length) return null;

  /**
   * Tipo vence tamanho: não dá para responder um áudio sem abrir, venha ele sozinho ou não.
   *
   * **A mensagem INTEIRA, e não só o tipo.** Este laço passava `{ tipo: msg?.tipo }`, jogando fora
   * o `texto` e o `transcrito` — e com isso anulava, aqui dentro, o conserto de 01/09/2026 que fez
   * áudio transcrito deixar de alegar que precisa ser aberto. Resultado: a caixa aparecia com a
   * transcrição inteira do lado e o motivo dizendo *"mandou um áudio — só dá para responder depois
   * de abrir"* (anotação da Eunice Peixoto, 02/09).
   *
   * A regra de 01/09 estava certa e testada; o defeito era esta chamada não deixá-la ver nada.
   */
  for (const msg of rajada) {
    const porTipo = pedeRespostaPessoal(msg);
    if (porTipo) return porTipo;
  }

  const total = rajada.reduce((n, m) => n + semLinks(m?.texto).length, 0);
  const proprias = rajada.filter((m) => temSubstancia(m, padroesDeAnuncio));

  /**
   * **Várias mensagens próprias sem resposta = conversa**, mesmo que curtas — ver `RAJADA_MUITAS`.
   *
   * O corte de 400 caracteres continua valendo para UMA mensagem só: lá o tamanho é o único sinal.
   * Aqui, com duas ou mais, o tamanho que basta é menor, porque o fato de ela ter voltado a
   * escrever já diz que está esperando.
   */
  if (proprias.length >= RAJADA_MUITAS || (proprias.length >= 2 && total >= RAJADA_LONGA)) {
    const comAudio = rajada.some((m) => m?.transcrito);
    return {
      motivo:
        `escreveu ${proprias.length} mensagens próprias${comAudio ? ' (com áudio)' : ''} ` +
        `somando ${total} caracteres, sem resposta — é conversa, não é caso de modelo`,
    };
  }

  if (total >= TEXTO_LONGO) {
    // "escreveu" o que ela FALOU manda quem lê procurar uma mensagem de texto que não existe — a
    // mesma razão do `verbo` na função de uma mensagem só.
    const comAudio = rajada.some((m) => m?.transcrito);
    const verbo = comAudio ? 'mandou' : 'escreveu';
    const marca = comAudio ? ' (com áudio)' : '';
    return rajada.length > 1
      ? { motivo: `${verbo} ${rajada.length} mensagens${marca} somando ${total} caracteres — é conversa, não é caso de modelo` }
      : { motivo: `${verbo} ${total} caracteres${marca} — é conversa, não é caso de modelo` };
  }
  return null;
}

/**
 * Perguntas que NENHUMA resposta pronta responde.
 *
 * A lista é curta de propósito. Toda entrada aqui tira um contato da automação, e o objetivo dele
 * é o contrário — chegar a 90% resolvido sem IA. Então só entra o que é claramente pergunta de
 * **razão** ou de **posição**: essas dependem do que ele pensa, e não existe texto pronto para
 * elas. "Pode me mandar o material?" também é pergunta, e o modelo responde perfeitamente.
 *
 * `(^|\s)` e não `\b` porque `\b` não funciona antes de palavra acentuada — armadilha já
 * registrada no `CLAUDE.md` ("é nós" nunca casava no começo da string).
 */
/**
 * **Perguntas que não dependem de onde estão na frase.**
 *
 * A lista de baixo (`PERGUNTAS_QUE_PEDEM_VOCE`) só vale no COMEÇO da mensagem ou com "?", e a razão
 * é boa: "pq" no meio de uma frase é conjunção, não pergunta — foi assim que *"ficou muito grato pq
 * sou Bolsonaro desde sempre"* virava resposta à mão (print do Ciro, 31/08).
 *
 * Mas essa trava é cega demais para o que entra AQUI. Anotação da Eliana (02/09/2026): ela colou o
 * texto do anúncio e emendou *"olá eu gostaria de saber se tem algum projeto para criar leis mais
 * rígidas…"* — tudo numa mensagem só, sem interrogação. A pergunta ficava no meio, a trava a
 * descartava, e ela recebeu o recibo do anúncio com o pedido de cadastro.
 *
 * Ninguém usa "tem algum projeto para criar leis" como explicação. Estas frases são pergunta em
 * qualquer posição, e é isso que as separa do "pq".
 *
 * **"tem algum material/conteúdo" fica de fora de propósito** — aquilo o modelo responde
 * perfeitamente, e é a maior parte do que chega.
 */
const PERGUNTAS_INEQUIVOCAS = [
  /(^|[^\p{L}])(tem|existe|ha|teria)\s+(algum|alguma|algo)\s+.{0,20}?(projeto|lei|proposta|pl\b|emenda|medida)/iu,
  /(^|[^\p{L}])(vao|v[aã]o|vai|pretende[m]?|pensa[m]?)\s+(apoiar|votar|aprovar|derrubar|apresentar)/iu,
  /(^|[^\p{L}])(o\s+que|oq)\s+.{0,25}?(fazer|far[aã]o?)\s+(sobre|quanto|a\s+respeito|com)/iu,
  /**
   * **"QUAL" mais o substantivo é interrogativo em qualquer posição** — print da Maria Antonia
   * (06/09/2026).
   *
   * Ela escreveu *"Boa noite capitão o senhor é candidato a qual partido desculpa a minha
   * ignorância não prestei atenção"* e, no dia seguinte, mandou um link do TikTok. A pergunta foi
   * ignorada. Medido: `conversaTemPerguntaAberta` devolvia **false** — sem "?", a guarda de
   * posição só aceita o padrão ABRINDO a mensagem, e ela abriu com *"Boa noite capitão"*.
   *
   * É a lição da Ieda (04/09) uma casa adentro: lá o cumprimento estava em outra MENSAGEM e
   * escondia a pergunta; aqui está na mesma mensagem, três palavras antes dela.
   *
   * **A guarda de posição existe pelo "pq"** (*"fiquei grato pq sou Bolsonaro desde sempre"*, print
   * do Ciro), e é uma conjunção que se disfarça de pergunta. **"qual" não tem esse problema**:
   * seguido de um destes substantivos, ele nunca é explicação. Por isso a linha do "qual a
   * posição/opinião/proposta" **saiu da lista de baixo e entrou aqui**, com partido, número e
   * cargo junto — a identificação política é a mesma classe: depende de nós responder, e nenhuma
   * resposta pronta a cobre.
   *
   * O falso positivo conhecido é *"já sei qual o seu partido"*, e o custo dele é a tecla 6 — o
   * lado barato, o mesmo que a inversão de 04/09 já aceitou.
   */
  /(^|[^\p{L}])qual\s+(e\s+)?(o\s+|a\s+)?(seu\s+|sua\s+)?(posi[çc][aã]o|opini[aã]o|proposta|ideia|partido|n[uú]mero|numero|cargo|chapa)/iu,
];

const PERGUNTAS_QUE_PEDEM_VOCE = [
  // Razão: "por que não tem propaganda aqui?"
  /(^|[^\p{L}])(por\s?qu[eê]|pq|pk)(\s|\?|$)/iu,
  // Posição e opinião: dependem do que ELE pensa
  // "qual a posição/opinião/proposta" subiu para `PERGUNTAS_INEQUIVOCAS` em 06/09/2026, junto de
  // partido, número e cargo: "qual" seguido de substantivo nunca é conjunção, então a guarda de
  // posição (que existe pelo "pq") só o estava escondendo. Print da Maria Antonia.
  /(^|[^\p{L}])o\s+que\s+(ele|voc[eê]s?|o\s+candidato|o\s+deputado)\s+(acha|acham|pensa|pensam|vai|v[aã]o|pretende|pretendem|faria|fariam|far[aá]|far[aã]o)/iu,
  /(^|[^\p{L}])como\s+(ele|voc[eê]s?)\s+(vai|v[aã]o|pretende|pretendem|pensa|pensam)/iu,
  /**
   * **Pergunta sobre PROJETO, LEI ou POSIÇÃO em pauta** — anotação da Eliana (02/09/2026).
   *
   * Ela escreveu *"gostaria de saber se tem algum projeto para criar leis mais rígidas para punir
   * bandidos…"* e recebeu o recibo do anúncio com o pedido de cadastro. Relato dele: *"aqui teria
   * que responder a pergunta (por mim ou IA) + mandar modelo + pedir dados"*.
   *
   * É exatamente a classe que esta lista existe para pegar: depende do que o mandato pensa e do que
   * ele já apresentou, e **não existe texto pronto** para responder. Faltava porque as entradas
   * antigas cobrem "qual a posição/proposta" e "o que ele acha", e ninguém pergunta assim — a
   * pergunta real vem como *"tem algum projeto para…"*, *"vocês vão apoiar…"*.
   *
   * **"tem algum material/conteúdo" fica de fora de propósito**: aquilo o modelo responde
   * perfeitamente, e é a maior parte do que chega. O que entra aqui é lei, projeto e votação.
   */
  /**
   * **Pergunta se o mandato FAZ alguma coisa** — anotação da Teresinha (03/09/2026).
   *
   * Ela escreveu *"Tem alguém que vem na casa da gente pra conversar"*: sem "?", sem "por que",
   * sem "qual a posição". Nenhum padrão pegava, e a rodada sugeriu **concluir** (`ja-respondemos-antes`,
   * tecla 3) sobre uma pergunta sem resposta. Relato dele: *"ela quer saber se fazemos visitas,
   * respondi a pergunta, a regra de sempre responder uma pergunta tem que valer"*.
   *
   * Não existe resposta pronta para isto: depende da agenda do mandato. É a mesma classe de
   * "tem algum projeto" — muda só o objeto da pergunta.
   *
   * **A guarda de POSIÇÃO é o que os mantém seguros** (começo da mensagem, ou "?"): *"tem alguém
   * aqui que apoia vocês"* no meio de um relato é afirmação, não pergunta. Errar para o lado de
   * chamar gente custa um contato fora da automação; errar para o outro conclui em cima de quem
   * perguntou.
   */
  /(^|[^\p{L}])tem\s+algu[eé]m\s+(que|pra|para|no|na|em|de|do|da|a[ií]|aqui)(\s|$)/iu,
  /(^|[^\p{L}])tem\s+como\s+/iu,
  /**
   * **"Como consigo…", "onde consigo…", "como faço para…"** — anotação do Valdomiro (03/09/2026).
   *
   * Ele escreveu *"Boa tarde Como consigo as coisas de campanha adevisto bandeira camiseta?"* e
   * recebeu o cartão da campanha, com a conversa concluída em seguida. Relato dele: *"não respondeu
   * a pergunta e concluiu"*.
   *
   * **É pergunta de LOGÍSTICA, e é aí que ela se separa do "tem material?".** Adesivo, bandeira e
   * camiseta são coisa física: quem responde é quem sabe onde tem, quem entrega e quando. Nenhum
   * modelo aprovado responde isso — mandá-lo é responder "pega o material" a quem perguntou
   * "**como** eu pego".
   *
   * **O `PEDIDO_DE_MATERIAL` continua desarmando a mensagem inteira**, e é o que mantém a exclusão
   * de propósito registrada acima: *"como consigo receber o conteúdo de vocês?"* tem "receber",
   * desarma, e segue sendo caso de modelo. O que sobra aqui é o que o modelo não resolve.
   *
   * **"posso" ficou de fora**: *"como posso ajudar?"* é oferta, e oferta é o público principal
   * desta base — mandá-la para atendimento à mão é o erro caro do outro lado.
   *
   * A guarda de POSIÇÃO segura o resto: *"não sei como consigo agradecer vocês"* não tem "?" nem
   * está no começo, então não conta.
   */
  /(^|[^\p{L}])(como|onde)\s+(eu\s+)?(consigo|conseguir|fa[çc]o|faz|fazer)(\s|$)/iu,
  /(^|[^\p{L}])(voc[eê]s|vcs)\s+(fazem|atendem|v[eê]m|visitam)(\s|$|\?)/iu,
  // Pedido explícito de explicação
  /(^|[^\p{L}])(me\s+)?explica(r|\s|$)/iu,
  /(^|[^\p{L}])n[aã]o\s+entendi(\s|$|\.)/iu,
];

/**
 * **A última coisa que ela escreveu foi uma pergunta?**
 *
 * Print do Paulo Quevedo (03/09/2026): imagem de bom dia, dois links e, por último, *"Colorado ou
 * Gremista?"*. A rodada recomendou **concluir**. Ele: *"qual a regra que já tínhamos acertado? tem
 * pergunta não conclui"*.
 *
 * **Isto NÃO é `conversaTemPerguntaAberta`, e a diferença é o que o torna seguro.** Aquela decide
 * que o caso precisa de você (tecla 6) e por isso é uma lista curta de FORMAS conhecidas — alargá-la
 * para "qualquer ?" quebrou cinco exclusões que ele já tinha decidido ("Tudo bem?", "tem algum
 * grupo?", "posso ajudar?"). Medido antes de desistir do caminho.
 *
 * Esta aqui responde uma pergunta mais fraca e faz uma coisa só: **impedir que a rodada CONCLUA em
 * silêncio** por cima de uma pergunta sem resposta. Concluir é o desfecho irreversível — tira o
 * contato da tela dele. Errar para o lado de deixar aberto custa uma linha na fila.
 *
 * **O "?" vale sozinho, inclusive em "Tudo bem?"** — decisão dele em 03/09/2026: *"tudo bem exige
 * resposta igual; quando a pessoa faz questão de botar (?) ela espera uma resposta"*. Eu tinha
 * excluído a cortesia e ele desfez. O argumento é dele e é bom: a interrogação é uma ESCOLHA de
 * quem escreveu, e o custo de honrá-la é uma conversa que fica aberta.
 *
 * **E muita pergunta vem sem "?"** — *"isso é problemático"*, no mesmo recado. Por isso a abertura
 * interrogativa conta também: quem começa a mensagem com "quem", "quando", "cadê", "qual" está
 * perguntando, com ou sem o sinal no fim. Aqui isso é barato porque o sinal não decide desfecho
 * nenhum: no máximo deixa uma conversa aberta a mais.
 */
const ABRE_PERGUNTANDO =
  /^\s*(o\s+)?(que|qual|quais|quem|quando|onde|aonde|como|quanto|quanta|quantos|quantas|cade|porque|por\s?que|pq|sera)\b/i;

/**
 * "queria saber", "me diz", "me informa" — pergunta declarada, sem interrogação.
 *
 * **O advérbio e a preposição entram no meio, e a forma mais comum de todas não casava.** Print da
 * Maria Antonia (06/09/2026): ela escreveu *"Gostaria muito saber se o senhor não se importa"*, e o
 * padrão exigia o verbo COLADO em "saber". Medido na hora: **"gostaria DE saber" também não
 * casava** — a forma que mais aparece nesta base, e a mesma que a anotação da Eliana (02/09) já
 * tinha trazido escrita.
 *
 * É a lição registrada em 05/09 sobre "trabalhar NA campanha": **em lista de formas, a preposição
 * e o advérbio são peças separadas** — e o defeito parece "a regra não existe".
 */
const PERGUNTA_DECLARADA =
  /(^|[^\p{L}])((queria|gostaria|quero)(\s+(de|muito|mesmo|bastante|tanto|bem))*\s+saber|me\s+(diz|diga|informa|informe|explica|explique)|fiquei\s+na\s+duvida|tenho\s+uma\s+duvida)/iu;

/**
 * **A pergunta foi retirada depois?** *"deixa pra lá"*, *"esquece"*, *"já resolvi"*.
 *
 * Existe porque a pergunta passou a valer em qualquer mensagem da rajada (ver abaixo), e sem isto
 * um *"Colorado ou Gremista? … deixa pra lá"* continuaria segurando o atendimento aberto para
 * sempre. É a mesma ideia da retratação em `semInteresse`.
 */
const RETIROU_A_PERGUNTA =
  /(^|[^\p{L}])(deixa\s+(pra|para)\s+la|deixa\s+quieto|esquec(e|a)|ja\s+(resolvi|consegui|descobri|achei|vi)|nao\s+precisa\s+(mais|responder)|nem\s+precisa)/iu;

/**
 * Há uma **pergunta pendente** — em qualquer mensagem que ela escreveu depois da nossa última?
 *
 * **Olhava só a ÚLTIMA mensagem, e isso escondia a pergunta do meio.** Print da Ieda (04/09/2026):
 * *"Obrigada pelas relevantes informações!"*, *"Você é candidato daqui do RS?"*, *"Boa tarde!"* — e
 * a rodada ofereceu a mensagem do momento. Ele: *"a sugestão queria mandar mensagem do momento
 * ignorando a pergunta; já vimos antes que responder a pergunta é prioridade"*.
 *
 * A pergunta não deixa de estar pendente porque ela disse "boa tarde" depois. O recorte certo é a
 * RAJADA inteira — o que chegou desde que falamos —, que por definição é o que ainda não foi
 * respondido. O que cancela é uma **retratação** explícita, não uma mensagem qualquer em cima.
 *
 * **Este sinal NÃO é `conversaTemPerguntaAberta`.** Aquele decide que o caso precisa dele (tecla 6)
 * e por isso é uma lista curta de formas conhecidas — alargá-lo para "qualquer ?" quebrou cinco
 * exclusões que ele já tinha decidido, medido antes de desistir do caminho. Este faz uma coisa só:
 * **impedir o desfecho irreversível.**
 */
export function perguntaPendente(entrantes, nossaUltimaAt) {
  const rajada = rajadaFinal(entrantes, nossaUltimaAt).filter((m) => String(m?.texto || '').trim());
  if (!rajada.length) return false;

  // O link sai antes de tudo: a query string (`?igsh=`, `?v=`) fazia todo vídeo repassado virar
  // pergunta pendente, e pergunta pendente e o que impede concluir. Ver `semLinks`.
  const plano = (m) =>
    semLinks(m?.texto)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  for (let i = 0; i < rajada.length; i++) {
    // Legenda de repasse nao conta como pergunta pendente — ver `ehLegendaDeRepasse`.
    if (ehLegendaDeRepasse(rajada[i])) continue;
    const texto = semLinks(rajada[i].texto);
    const semAcento = plano(rajada[i]);
    if (!semAcento) continue;

    const ehPergunta = texto.includes('?') || ABRE_PERGUNTANDO.test(semAcento) || PERGUNTA_DECLARADA.test(semAcento);
    if (!ehPergunta) continue;

    // Retirada por uma mensagem POSTERIOR dela, na mesma rajada.
    const retirou = rajada.slice(i + 1).some((m) => RETIROU_A_PERGUNTA.test(plano(m)));
    if (!retirou) return true;
  }
  return false;
}

/** Pede material/conteúdo — aí a pergunta TEM resposta pronta e não é caso de resposta à mão. */
const PEDIDO_DE_MATERIAL = /(^|[^\p{L}])(manda|mande|envia|envie|me\s+passa|quero\s+receber|receber)(\s|$)/iu;

/**
 * Jeitos de dizer "estou com você". Lista de reconhecimento, não de julgamento: o que ela
 * decide é se cabe um agradecimento, e agradecer errado custa pouco.
 */
/**
 * **"Obrigada por nada" encerra a conversa** — anotação da Eva (04/09/2026).
 *
 * Ela pediu ajuda financeira, recebeu a negativa (que é o desfecho certo, e o texto é respeitoso) e
 * respondeu *"Então deixa muito obrigada por nada"*. A rodada ofereceu a mensagem do momento; ele:
 * *"vou concluir sem mandar nada"*.
 *
 * É despedida — amarga, mas despedida: ela está dizendo que a conversa acabou. Mandar a mensagem da
 * semana em cima disso é não ter lido. O desfecho da despedida (concluir sem enviar) é exatamente o
 * que ele descreveu.
 */
const DESPEDIDA_AMARGA =
  /(^|[^\p{L}])(obrigad[oa]\s+por\s+nada|valeu\s+por\s+nada|deixa\s+(pra|para)\s+la|deixa\s+quieto|esquece\s+entao)/iu;

const EXPRESSOES_DE_APOIO = [
  /(^|[^\p{L}])(eu\s+)?apoio(\s|$|,|!|\.)/iu
,
  /**
   * **"junto" vale sozinho; "com" precisa do OBJETO** — print da Elenir (05/09/2026).
   *
   * Ela escreveu *"Não posso falar. **Estou com** infecção urinária e respiratória. muita tosse e
   * febre..."* e a regra leu **apoio**. O padrão aceitava `estou com` seguido de qualquer coisa —
   * e "estou com" é a forma mais comum de dizer o que se TEM: dúvida, problema, fome, medo, febre.
   *
   * A guarda já estava escrita três linhas abaixo, para outro padrão: *"'com vocês' sozinho ficou
   * de fora de propósito — o que qualifica é o advérbio de permanência"*. A mesma disciplina não
   * tinha sido aplicada aqui. **O que qualifica é o objeto ser NÓS.**
   *
   * `\s*` e não `\s+`: "Tamojuntos" vem colado, e foi assim que ele apareceu na print.
   */
  /(^|[^\p{L}])(tamo|tamos|t[oô]|estou|estamos|seguimos|segue)\s*(junto|juntos)\b/iu,
  /(^|[^\p{L}])(tamo|tamos|t[oô]|estou|estamos|seguimos|segue)\s*com\s+(voc[eê]s?|vcs?|o\s+senhor|a\s+senhora|a\s+gente|n[óo]is|n[óo]s|o\s+capit[ãa]o|o\s+martim|a\s+campanha|o\s+mandato)\b/iu,
  /(^|[^\p{L}])(tamo|tamos|t[oô]|estou|estamos)\s*contigo\b/iu,
  /(^|[^\p{L}])tmj\b/iu,
  /**
   * "sempre com vocês", "junto com o senhor" — apoio sem o verbo na frente.
   *
   * Print da Gessi (31/08): *"Itaqui Rs...sempre com vocês capitão"*, e a regra não pegou porque
   * exigia "estou"/"tamo" antes do "com". *"vou agradecer apoio e concluir"*.
   *
   * **"com vocês" sozinho ficou de fora de propósito**: "preciso falar com vocês" é pedido, não
   * apoio. O que qualifica é o advérbio de permanência ("sempre", "junto", "aqui"), e é ele que
   * separa quem está declarando lealdade de quem está pedindo contato.
   */
  /(^|[^\p{L}])(sempre|junto|juntos|aqui)\s+com\s+(voc[eê]s?|vcs?|o\s+senhor|a\s+senhora|a\s+gente|nois|n[óo]s)/iu,
  /(^|[^\p{L}])conte?\s+comigo(\s|$|!|\.)/iu,
  /**
   * **"pode contar conosco"** — anotação do Tere e Gilmar (03/09/2026): *"Tá bom, tô acompanhando
   * vocês, se Deus quiser nós vamos ter a Vitória, pode contar conosco"*, e nenhuma regra casou.
   *
   * A lista tinha só "conte comigo", no singular. Quem responde em nome da casa fala no plural — e
   * é a forma mais comprometida das duas.
   */
  /(^|[^\p{L}])(pode|podem)?\s*cont(e|ar|em|amos)\s+(comigo|conosco|com\s+n[oó]s|com\s+a\s+gente)/iu,
  /(^|[^\p{L}])(estou|to|t[oô])\s+acompanhando\s+(voc[eê]s?|vcs?|o\s+senhor|a\s+campanha)/iu,
  /**
   * **"vamos vencer" precisa do objeto POLÍTICO, ou de ser a mensagem inteira.**
   *
   * Solto, ele pega *"vamos vencer essa doença"* e *"vamos ganhar coragem"* — que é o oposto de
   * apoio: é alguém contando um problema. Mesma disciplina do "confirmado" e do "13".
   */
  /(^|[^\p{L}])(n[oó]s\s+)?vamos\s+(vencer|ganhar)(\s+(essa|esta|a)\s+(elei[çc][ãa]o|disputa|campanha|batalha))?(\s*[!.,]*\s*$)/iu,
  /(^|[^\p{L}])(n[oó]s\s+)?vamos\s+(vencer|ganhar)\s+(essa|esta|a)\s+(elei[çc][ãa]o|disputa|campanha)/iu,
  /(^|[^\p{L}])(vou|vamos)\s+votar(\s|$)/iu,
  /**
   * **"eleitor" e "fã" precisam do SEU — "sou eleitor de Caxias do Sul" é endereço, não apoio.**
   *
   * Achado medindo os falsos positivos em 06/09/2026. `bolsonarista` continua valendo sozinho: nesta
   * base é declaração de campo político, e não há "bolsonarista de" nenhum lugar.
   */
  /(^|[^\p{L}])sou\s+(seu|sua)\s+(eleitor|eleitora|f[aã])(\s|$|!|,|\.)/iu,
  /(^|[^\p{L}])sou\s+(eleitor|eleitora|f[aã])\s*(seu|de\s+voc[eê]s?|do\s+senhor|do\s+capit[ãa]o|do\s+martim)?\s*[!.,]*\s*$/iu,
  /(^|[^\p{L}])sou\s+bolsonarist[ao]\b/iu,

  /**
   * **Declaração de VOTO é declaração de apoio** — três anotações antes de eu ver o padrão.
   *
   *  - **Maria bernardete** (03/09): *"Olá capitão estou falando com todas as minhas amigas para
   *    votarem no Senhor, estou contando com elas."* → recebeu o MODELO. *"mensagem de apoio,
   *    mandar 8"*;
   *  - **Helena** (03/09): *"22 com toda certeza"* → nenhuma regra casou;
   *  - **Maria Geny** (03/09): *"Eu e minhas família também votamos para eles"*.
   *
   * A lista já tinha "vou votar", que é o jeito de UMA pessoa dizer. O que faltava é o resto do
   * português real: votar **em quem** (no senhor, nele, no 22), quem mais vota (minha família, as
   * amigas), e o número de urna sozinho.
   *
   * **O número exige posição ou companhia** — "22" solto é endereço, idade e hora. Vale começando
   * a mensagem ("22 com toda certeza") ou colado num verbo de votar.
   */
  // `vot\w*` cobre "votarem", "votassem", "votando" — a conjugação real não cabe numa lista.
  /(^|[^\p{L}])vot\w*\s+(no|na|em|pro|pra|neste|nesse|nele|nela|neles|nelas|voc[eê]s?)(\s|$)/iu,
  /(^|[^\p{L}])(meu|nosso|meus|nossos)\s+votos?(\s|$|!|,|\.)/iu,
  /(^|[^\p{L}])(vot(o|a|ar|am|em|amos)|somos|sou|[eé])\s*(no\s+)?22(\s|$|!|,|\.)/iu,
  /^\s*22(\s|$|!|,|\.)/u,
];

/**
 * Ela disse que VAI ou que NÃO VAI ao evento?
 *
 * Anúncio novo (01/09): o convite pergunta se a pessoa vai, e ele responde de dois jeitos — consolo
 * para quem não pode, comemoração para quem vai. Os dois textos terminam pedindo nome e cidade, então
 * são o "pedir dados" com prefixos diferentes: a tecla 4 escolhe qual sai.
 *
 * **`tags.respostaAfirmativa` NÃO serve aqui, e testar mostrou por quê.** Ele foi escrito para
 * *"quer receber conteúdo?"*, onde "gostaria" é um sim. Contra as respostas de presença ele erra os
 * dois lados:
 *
 * | resposta | `respostaAfirmativa` | verdade |
 * |---|---|---|
 * | *"Gostaria de estar mas sem condições"* | sim | **não vai** |
 * | *"vou sim"* | não | **vai** |
 * | *"estarei lá"* | não | **vai** |
 *
 * Pergunta diferente pede vocabulário diferente — é a armadilha do `CLAUDE.md` sobre mexer no texto
 * de uma pergunta sem mexer no parser dela, vista do outro lado.
 *
 * **A negativa vence, e olha a mensagem INTEIRA.** *"Gostaria de estar mas sem condições 22
 * certamente"* tem "gostaria" e "certamente" — duas marcas positivas — e é uma recusa. Quem não pode
 * ir quase sempre começa dizendo que queria: a intenção está na ressalva, não na abertura. Por isso
 * aqui não há "primeiras quatro palavras" como no `respostaAfirmativa`.
 *
 * @param {Array<{texto?:string}>} entrantes
 * @param {string|null} nossaUltimaAt
 * @returns {'sim'|'nao'|null}
 */
export function confirmaPresenca(entrantes, nossaUltimaAt) {
  const rajada = rajadaFinal(entrantes, nossaUltimaAt);
  if (!rajada.length) return null;

  const texto = rajada
    .map((m) => String(m?.texto || ''))
    .join(' ')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!texto) return null;

  /**
   * NÃO vai. Vem primeiro de propósito: a recusa quase sempre chega embalada em intenção boa
   * ("gostaria", "queria", "adoraria") e é a ressalva que decide.
   */
  const NAO_VAI = [
    /(^|[^\p{L}])(nao|nem)\s+(vou|irei|posso|consigo|da|vai\s+dar|tenho\s+como|conseguirei|poderei)/u,
    /(^|[^\p{L}])sem\s+(condicoes|condicao|como|tempo|possibilidade)/u,
    /(^|[^\p{L}])(gostaria|queria|adoraria|amaria)\s+.{0,40}?\bmas\b/u,
    /(^|[^\p{L}])infelizmente/u,
    /(^|[^\p{L}])(estarei|vou\s+estar|to)\s+(fora|viajando|trabalhando)/u,
    /(^|[^\p{L}])(outro|ja\s+tenho)\s+compromisso/u,
    /(^|[^\p{L}])fica\s+(para|pra)\s+(a\s+)?(proxima|outra)/u,

    /**
     * **A ida CONDICIONAL é uma recusa, na prática.**
     *
     * Anotação da Elsa Tonini (02/09/2026): *"Eu irei só se ele vier para Bento Gonçalves…"*. Ela
     * não vai ao evento que existe — vai a um que talvez nem aconteça. Relato dele: *"resposta ao
     * evento que não irá"*.
     *
     * Ficar em silêncio aqui é pior que responder: quem escreveu uma condição está esperando a
     * resposta dela, e o texto do "não tem problema" reconhece a intenção sem prometer nada.
     *
     * Vem junto das outras negativas, ANTES da lista do "vai", porque a condição é a ressalva —
     * e a ressalva é sempre o que decide, como o "gostaria… mas" logo acima.
     */
    /(^|[^\p{L}])(vou|irei|vamos|iria)\s+(so\s+)?(se|caso|quando)(\s|$)/u,
    /(^|[^\p{L}])so\s+(vou|irei|se\s+for|se\s+fosse)(\s|$)/u,
    /(^|[^\p{L}])(vou|irei)\s+(se|caso)\s+der(\s|$|\.)/u,
    /(^|[^\p{L}])se\s+(ele|voces?|vcs?)\s+vier/u,
    /(^|[^\p{L}])(esse|este|dessa|nessa)\s+(dia|data)\s+.{0,20}?nao/u,
  ];
  for (const padrao of NAO_VAI) if (padrao.test(texto)) return 'nao';

  /**
   * VAI. Só formas que afirmam presença — "sim" solto não basta, pode ser resposta a outra coisa.
   *
   * **"vamos" e "vou" soltos SAÍRAM daqui** (02/09/2026), e é a correção mais importante desta
   * função. O padrão anterior aceitava o verbo sozinho, e nesta base isso é grito de campanha:
   *
   *  - *"Juntos vamos"* (Eliane) → virava confirmação de presença, e ela recebeu o agradecimento
   *    de um evento que já tinha passado;
   *  - *"Vamos vencer Flávio"* (Mary) → a mesma coisa, e como ela não tinha cidade ainda recebeu o
   *    pedido de cadastro com preâmbulo de evento;
   *  - *"vou votar em vocês"* casava igual — é intenção de voto, não presença.
   *
   * Hoje o verbo precisa vir com o que o torna presença: **"sim"**, um lugar (**lá**, **aí**), ou um
   * verbo de comparecer. Ou ser a mensagem inteira, que é a resposta seca a "você vai?".
   *
   * Não dá para resolver isso pelo contexto ("só olhe se o convite saiu") porque o convite é um
   * modelo aprovado da plataforma e o painel não tem como reconhecê-lo pelo id — a mesma razão que
   * fez o pedido de dados ser reconhecido por invariante.
   */
  const VAI = [
    // A mensagem INTEIRA é o verbo: a resposta seca a "você vai?".
    /^\s*(vou|irei|vamos)\s*[!.]*\s*$/u,
    /(^|[^\p{L}])(vou|irei|vamos)\s+sim(\s|$|!|,|\.)/u,
    /(^|[^\p{L}])(vou|irei|vamos)\s+(estar|comparecer|participar|ao\s+evento|na\s+agenda)/u,
    /(^|[^\p{L}])(vou|irei|vamos)\s+(la|ai)(\s|$|!|,|\.)/u,
    /**
     * **"Estaremos" SOZINHO saiu daqui, e é a QUARTA vez que esta lista aprende a mesma coisa.**
     *
     * Anotação da Geci (06/09/2026): *"Tamo junto estaremos de mãos dadas e venceremos amém"* — e
     * a rodada a PULOU como quem confirma presença em evento. Ele: *"não é evento, olhar os termos,
     * provavelmente estão muito vagos e sendo aplicados em contextos demais"*.
     *
     * O padrão tinha o qualificador em grupo OPCIONAL (`(\s+(la|ai|presente|junto|com voces))?`),
     * então o verbo sozinho bastava — e nesta base *"estaremos juntos"*, *"estaremos firmes"* e
     * *"estaremos de mãos dadas"* são grito de campanha, não resposta ao convite.
     *
     * Antes dela saíram **"vamos"/"vou"** (02/09, a Eliane e a Mary), **"confirmado"** (04/09, a
     * Nice) e **"pode contar comigo"** (04/09, o Guilherme). A regra que fica, e que já está escrita
     * três vezes acima: **vocabulário de campanha não é resposta ao convite.**
     *
     * **`junto` saiu junto dos qualificadores**, de propósito: *"estarei junto"* é a mesma frase que
     * `EXPRESSOES_DE_APOIO` reconhece como apoio, e foi por isso que o "pode contar comigo" foi
     * removido daqui. O que fica é o que só cabe num evento — um lugar, ou a presença dita.
     */
    /^\s*(estarei|estaremos)\s*[!.]*\s*$/u,
    /(^|[^\p{L}])(estarei|estaremos)\s+(la|ai|presente|presentes|com\s+voces|no\s+evento|na\s+agenda)(\s|$|!|,|\.)/u,
    /**
     * **"Confirmado" sozinho NÃO é confirmação de presença** — anotação da Nice (04/09/2026).
     *
     * Ela escreveu *"Nossos votos, estão confirmados: Capitão Martim para Deputado Estadual,
     * Capitão Zucco para Governador…"* — uma declaração de VOTO — e a rodada a pulou como quem
     * confirma presença em evento. Ele: *"pegou confirmação de evento sem contexto"*.
     *
     * O padrão anterior aceitava a palavra solta em qualquer posição, e nesta base "confirmado" é
     * dito de voto, de chapa e de agenda. Agora ela precisa vir **com o que a torna presença**
     * (presença, ida, participação, estar lá) ou **ser a mensagem inteira**, que é a resposta seca
     * a "você vai?".
     *
     * É o mesmo conserto que "vamos"/"vou" soltos levaram em 02/09, e pela mesma razão: o verbo
     * sozinho é vocabulário de campanha, não resposta ao convite.
     */
    /^\s*confirmad[oa]s?\s*[!.]*\s*$/u,
    /(^|[^\p{L}])(confirmo|confirmada|confirmado|confirmar)\s+(a\s+)?(minha\s+)?(presenca|ida|participacao)/u,
    /(^|[^\p{L}])presenca\s+(esta\s+)?confirmada/u,
    /(^|[^\p{L}])(estou|to)\s+confirmad[oa](\s|$|!|,|\.)/u,
    /**
     * **"Quero confirmar minha presença no evento: …"** — o texto do BOTÃO do anúncio de evento.
     *
     * Anotações da Elci e do Martin (03/09/2026), e é o caso mais embaraçoso possível: a regra que
     * manda pular quem confirma presença foi escrita hoje de manhã por causa da Elci, e **não
     * funcionava para ela** — `confirmaPresenca` não reconhecia a frase. Nenhum padrão daqui pega
     * "confirmar": eles esperam "confirmo", "confirmado", "presença confirmada".
     *
     * É a frase que o próprio anúncio gera, então é a forma mais comum que existe nesta base — e
     * era justamente a que faltava.
     */
    /(^|[^\p{L}])(quero|vou|gostaria\s+de|venho|pretendo)\s+confirmar\s+(a\s+)?(minha\s+)?presenca/u,
    /(^|[^\p{L}])confirmar\s+(a\s+)?(minha\s+)?presenca\s+(no|na|ao)\s+evento/u,
    /**
     * **"Pode contar comigo" SAIU daqui** — anotacao do Guilherme (04/09/2026).
     *
     * Ele escreveu *"Pode contar comigo e toda minha família somos muitos e somos Bolsonarista até
     * a morte"* e a rodada o PULOU como quem confirma presença em evento. Ele: *"não é evento,
     * somente apoiando"*.
     *
     * A frase está — corretamente — em `EXPRESSOES_DE_APOIO`, e é dali que ela deve decidir. Como
     * resposta ao convite ela é ambígua; como declaração de apoio, não é. É o terceiro apagamento
     * desta lista pelo mesmo motivo, depois de "vamos"/"vou" (02/09) e "confirmado" (04/09):
     * **vocabulário de campanha não é resposta ao convite.**
     */
    /(^|[^\p{L}])(com\s+certeza|certamente)\s+(vou|irei|estarei|estarei\s+la)/u,
    /(^|[^\p{L}])(vou|pretendo)\s+participar/u,
    /(^|[^\p{L}])(la|ai)\s+estarei/u,
  ];
  for (const padrao of VAI) if (padrao.test(texto)) return 'sim';

  return null;
}

/**
 * Alguém pedindo algo, sem dizer o quê.
 *
 * Print da Mari (31/08): *"Preciso da forca do senhor"* — e a caixa sugeria **mandar o modelo da
 * campanha**. Ele leu como *"provável pedido financeiro ou trabalho, vou perguntar em que posso
 * ajudar? para ter certeza"*.
 *
 * **É o caso de maior risco do projeto inteiro.** Pedido de dinheiro ou de emprego não pode
 * receber resposta automática (Lei 9.504/97, art. 41-A e 73), e material de campanha em cima de
 * quem está pedindo ajuda é pior do que não responder. Só que a frase não diz o que ela quer —
 * pode ser dinheiro, emprego, ou força política na luta dela.
 *
 * Como não se sabe, **não se responde: pergunta-se.** Perguntar não promete nada, não nega nada,
 * e é o que transforma uma frase ambígua em decisão informada dele.
 */
/**
 * **O que torna o pedido INDEFINIDO é o objeto dele.**
 *
 * Print da Odete (03/09/2026): *"Preciso do nome de um deputado federal que seja de direita"* — e a
 * rodada perguntou *"em que você precisa de ajuda?"*. Ele: *"interpretou 'preciso' fora de
 * contexto, já estava explicado"*. Ela disse exatamente o que queria, e na mensagem seguinte disse
 * que já tinha resolvido sozinha.
 *
 * O padrão era `preciso de|da|do` e mais nada — a regra se chama *"pediu algo sem dizer o quê"* e
 * não olhava o quê. É a mesma família do *"só mandou bom dia"* que pegava um desabafo de 437
 * caracteres: **nome de caixa que promete uma condição que a condição não verifica.**
 *
 * A lista de objetos é curta e é de PERMISSÃO — palavras que, sozinhas, não dizem o que a pessoa
 * quer: ajuda, força, apoio, socorro, uma mão. Entra também o objeto que é a própria pessoa
 * ("preciso do senhor", "preciso de vocês"), que é a forma da print da Mari.
 *
 * **Tentar reconhecer o objeto CONCRETO seria o caminho errado**: são infinitos, e errar para esse
 * lado devolve o problema — a frase volta a casar e a pergunta sai por cima de um pedido claro.
 */
const OBJETO_VAGO =
  '((uma?|a|o|sua|seu|tua|teu|nossa|vossa)\\s+)?(ajuda|ajudinha|for[çc]a|apoio|socorro|aux[íi]lio|m[ãa]o|senhor|senhora|voc[eê]s?|vcs?|ti)';

const PRECISA_DE_ALGO = [
  // "preciso da sua força", "preciso da forca do senhor", "preciso de uma ajuda"
  new RegExp(
    '(^|[^\\p{L}])(preciso|precisava|precisando|necessito)\\s+(de|da|do|duma|dum|das|dos)\\s+' +
      OBJETO_VAGO +
      '(\\P{L}|$)',
    'iu'
  ),
  // "conto com o senhor", "conto com sua ajuda"
  /(^|[^\p{L}])cont(o|ando)\s+com\s+(o\s+senhor|a\s+senhora|voc[eê]|sua|seu)/iu,
  // "o senhor pode me ajudar?", "vocês podem me ajudar"
  /(^|[^\p{L}])(pode|podem|poderia|poderiam|consegue|conseguem)\s+(me\s+)?ajudar/iu,
  // "me ajuda", "me ajude", "queria uma ajuda"
  /(^|[^\p{L}])me\s+ajud(a|e|ar)/iu,
  /(^|[^\p{L}])(queria|quero|gostaria\s+de)\s+(uma\s+|um\s+)?ajuda/iu,
  // "estou passando por", "estou numa situação", "estou desempregado"
  /(^|[^\p{L}])(t[oô]|estou|estamos)\s+(passando|numa|em\s+uma|desempregad)/iu,
];

/**
 * **A oferta desarma a mensagem inteira, e vem ANTES de qualquer teste de pedido.**
 *
 * Armadilha já registrada no `CLAUDE.md`: *"ajuda" é a mesma palavra dos dois lados da campanha*.
 * *"Quero ajudar"* é apoiador se oferecendo — o público principal. Um padrão que confunda os dois
 * põe metade da base na fila de revisão dele e o trabalho para.
 */
const OFERECE_AJUDA =
  /(^|[^\p{L}])(quero|queria|posso|gostaria\s+de|vou|estou\s+aqui\s+para|to\s+aqui\s+para)\s+(te\s+|lhe\s+|)?(ajudar|colaborar|contribuir|apoiar)/iu;

/**
 * A conversa pendente traz pedido de algo que ela não nomeou?
 *
 * @returns {{motivo:string, trecho:string}|null}
 */
export function pedeAlgoIndefinido(entrantes, nossaUltimaAt) {
  const rajada = rajadaFinal(entrantes, nossaUltimaAt);
  if (!rajada.length) return null;

  for (const msg of rajada) {
    const texto = String(msg?.texto || '').trim();
    if (!texto) continue;

    // A oferta desarma a mensagem inteira, antes de qualquer teste de pedido.
    if (OFERECE_AJUDA.test(texto)) continue;

    for (const padrao of PRECISA_DE_ALGO) {
      if (padrao.test(texto)) {
        return {
          motivo: 'pediu algo sem dizer o quê — pergunte antes de responder',
          trecho: texto.slice(0, 120),
        };
      }
    }
  }
  return null;
}

/**
 * Marcadores de DINHEIRO. Não é "ajuda": é dinheiro, e é isso que separa o pedido do agradecimento.
 *
 * A palavra "ajuda" sozinha é a mais comum desta base nos dois sentidos — *"em que posso ajudar"*,
 * *"vocês me ajudaram muito"*, *"obrigada pela ajuda"*. Uma regra que olhasse só ela mandaria a
 * negativa para quem estava agradecendo. Aqui o gatilho é o dinheiro estar na mensagem.
 */
const MARCADORES_DE_DINHEIRO = [
  // A chave PIX é a mais decisiva: ninguém manda a própria chave para o canal de um mandato a não
  // ser para receber. Print da Marli (02/09/2026): "Meu Pix 01757539005" e "50 me ajuda muito".
  /\bpix\b/i,
  // O valor inteiro, e não só o primeiro dígito: o motivo vai para a tela e "R$ 2" leria errado.
  /\br\$\s*\d[\d.,]*/i,
  /\b\d{1,4}\s*(?:reais|real|conto|pila)\b/i,
  /**
   * **O valor por EXTENSO** — anotação da Maira (04/09/2026): *"Qualquer mil reais já me ajuda"*,
   * duas vezes na mesma rajada, e a rodada mandou o caso para a tecla 6. Ele: *"está claro que é
   * pedido financeiro e não foi identificado"*.
   *
   * O padrão de cima exige DÍGITO antes de "reais", e quem escreve mil, cem ou quinhentos escreve
   * por extenso. A palavra do valor precisa vir colada em "reais" — "mil" sozinho é a quantidade
   * de tudo nesta base ("mil vezes", "mil abraços").
   */
  /\b(?:mil|cem|cento|duzentos|trezentos|quatrocentos|quinhentos|seiscentos|setecentos|oitocentos|novecentos)\s+(?:reais|real|conto|pila)\b/i,
];

/**
 * **Palavras de dinheiro que NÃO decidem sozinhas** — print da Elenir Minozzo (06/09/2026).
 *
 * Ela escreveu 858 caracteres de crítica política: *"MENOS DEPENDENTE DAS CESTAS BÁSICAS E SEM
 * SUBSÍDIOS DO GOVERNO FEDERAL"*, *"Tem que acabar com essas benesses e auxílios pecuniários"*,
 * *"TEMOS QUE DESMAMAR ESSES BEZERROS CRIADOS PELO PT"*, *"BASTA! Dinheiro ACABA."* — e recebeu **a
 * negativa de ajuda financeira**, o texto que explica que o mandato não pode doar dinheiro. Ele
 * apagou a mensagem.
 *
 * Medido: casou por **`\bdinheiro\b`**, na última frase. Ela estava dizendo o contrário de pedir.
 *
 * **`dinheiro`, `grana`, `empréstimo` e `doação` são o vocabulário de qualquer conversa sobre gasto
 * público nesta base** — que é metade do que chega. Ficam na mesma condição das NECESSIDADES: só
 * valem junto de um verbo de pedir.
 *
 * **O que continua decidindo sozinho é só o que ninguém escreve sem estar pedindo:** a chave PIX e
 * um valor concreto ("R$ 200", "200 reais", "mil reais"). É a mesma disciplina que separou o voto de
 * boa vontade da declaração de apoio, algumas horas antes.
 */
const DINHEIRO_QUE_PRECISA_DO_VERBO = [
  /\bdinheiro\b/i,
  /\bgrana\b/i,
  /\bempr[ée]stimo\b/i,
  /\bdoa[çc][ãa]o\b/i,
];

/**
 * Coisas que se pede quando falta o básico. Sozinhas não bastam — "tomei meu remédio" não é pedido.
 * Só valem junto de um verbo de pedir, que é o que separa relatar de pedir.
 */
const NECESSIDADES = [
  /\bcesta\s*b[áa]sica\b/i,
  /\brem[ée]dio?s?\b/i,
  /\bmedicamento?s?\b/i,
  /\bg[áa]s\b/i,
  /\balimento?s?\b/i,
  /**
   * **O aluguel e a farmácia** — anotação da Maira (04/09/2026): *"só o aluguel e 500"*, *"eu tenho
   * que comer paga farmácia"*, junto de *"me consegue eu pago"*. São a mesma família da cesta
   * básica: o que se paga quando o dinheiro acabou. Continuam exigindo o verbo de pedir, senão
   * *"pago meu aluguel em dia"* viraria pedido.
   */
  /\baluguel\b/i,
  /\bfarm[áa]cia\b/i,
  /\bconta\s+de\s+(?:luz|[áa]gua|energia)\b/i,
];

/**
 * **`me ajuda` nunca casou aqui, e o `\b` final era a causa** — achado em 06/09/2026, medindo o
 * conserto da Elenir.
 *
 * O padrao era `\b(...|me\s+ajud|...)\b`: o `\b` de fechamento exige uma fronteira depois de
 * "ajud", e em "me ajuda" vem um "a". *"Me ajuda com um dinheiro"* passava batido, e o caso da
 * Marli (02/09) so era pego porque ela mandou o PIX junto.
 *
 * E a mesma armadilha da fronteira de palavra que este arquivo ja registrou duas vezes -- aqui pela
 * terceira, agora num RADICAL truncado de proposito. **Radical nao leva `\b` no fim.**
 */
const VERBO_DE_PEDIR =
  /(^|[^\p{L}])(precis(?:o|ava|ando|amos)|necessito|me\s+ajud|ajuda\s*r?\s*me|pode(?:ria|m)?\s+(?:me\s+)?ajudar|consegue|tem\s+como|manda|envia|faz\s+um)/iu;

/**
 * A conversa pendente traz pedido de DINHEIRO ou do que se compra com ele?
 *
 * Relato dele (02/09/2026), com a print da Marli: *"aqui está claro ela deu o pix dela e pediu 50,
 * caso de mandar a mensagem negando apoio financeiro"*. A rodada sugeria a tecla 9 — *"pediu algo
 * sem dizer o quê"* —, que é a pergunta de quem ainda não sabe o que a pessoa quer. Ali já se
 * sabia.
 *
 * **Por que não bastou acrescentar palavras na caixa do quadro:** ela casava por trecho contido
 * ("me ajuda com"), e a Marli escreveu "me ajuda muito". Palavra a palavra, a lista nunca fecha —
 * e o que decide aqui manda uma NEGATIVA para eleitor, então precisa de teste, não de sorte.
 *
 * A regra tem duas portas: marcador de dinheiro sozinho basta; necessidade material precisa de
 * verbo de pedir junto.
 *
 * @returns {{motivo:string, trecho:string}|null}
 */
export function pedeAjudaFinanceira(entrantes, nossaUltimaAt) {
  const rajada = rajadaFinal(entrantes, nossaUltimaAt);
  if (!rajada.length) return null;

  const textos = rajada.map((m) => String(m?.texto || '').trim()).filter(Boolean);
  if (!textos.length) return null;

  // A rajada inteira, porque o pedido vem partido: a chave numa mensagem e o valor na seguinte.
  const conversa = textos.join(' \n ');

  // Quem oferece ajuda não está pedindo — mesma guarda do `pedeAlgoIndefinido`.
  if (OFERECE_AJUDA.test(conversa)) return null;

  for (const padrao of MARCADORES_DE_DINHEIRO) {
    const m = padrao.exec(conversa);
    if (m) {
      return {
        motivo: `pediu ajuda financeira (escreveu "${m[0].trim()}") — vale a resposta que nega com respeito`,
        trecho: conversa.slice(0, 160),
      };
    }
  }

  if (VERBO_DE_PEDIR.test(conversa)) {
    // As duas listas que precisam do verbo: o que se compra, e as palavras genéricas de dinheiro.
    for (const padrao of [...NECESSIDADES, ...DINHEIRO_QUE_PRECISA_DO_VERBO]) {
      const m = padrao.exec(conversa);
      if (m) {
        return {
          motivo: `pediu ${m[0].trim()} — vale a resposta que nega com respeito`,
          trecho: conversa.slice(0, 160),
        };
      }
    }
  }

  return null;
}

/**
 * **Ela quer TRABALHAR para o mandato** — e o texto que nega isso já existia sem ninguém acioná-lo.
 *
 * Anotação do Kelvem Marinho (02/09/2026): *"Queria saber como faz para trabalhar para vc aqui em
 * são gabriel"* e, na mensagem seguinte, *"No caso vcs não pagam"*. A rodada agradeceu e concluiu.
 * Relato dele: *"a pessoa está perguntando como trabalhar pra nós e nós estamos trabalhando somente
 * com voluntários sem dinheiro envolvido"*.
 *
 * `pedido-emprego` existe desde sempre, está entre os `RESTRITOS` que a IA não pode escolher e tem
 * etiqueta própria — **mas nada no quadro o alcançava.** Era resposta escrita, revisada e parada.
 *
 * Por que isto pesa mais que uma sugestão errada comum: prometer emprego a eleitor é proibido pela
 * Lei 9.504/97, e um agradecimento genérico em cima de *"vocês pagam?"* soa como sim.
 *
 * **Lê a rajada inteira**, pelo mesmo motivo de `pedeAjudaFinanceira`: o pedido vem partido — a
 * pergunta numa mensagem e o "vocês pagam" na seguinte, que foi exatamente o caso dele.
 */
const QUER_TRABALHAR = [
  /(^|[^\p{L}])(como|onde)\s+(faz|faco|fazer|posso|consigo)\s+.{0,20}?trabalhar/u,
  /**
   * **O ARTIGO estava colado no substantivo, e isso apagava as tres formas mais naturais.**
   *
   * A lista dizia `(no|na) + (o mandato|a campanha)` -- e "no o mandato" nao existe. Ou seja:
   * *"trabalhar NA campanha"*, *"trabalhar NO mandato"* e *"trabalhar NO gabinete"* nunca casaram,
   * embora *"trabalhar para a campanha"* casasse. Print dele (05/09/2026): *"Vc esta chamando
   * gente pra trabalhar na campanha tou precisando"* -- *"nao pegou o contexto"*.
   *
   * Hoje a preposicao e o artigo sao pecas separadas, que e o que a gramatica pede.
   */
  /(^|[^\p{L}])trabalhar\s+(para|pra|com|no|na|em|de)\s+(o\s+|a\s+|um\s+|uma\s+)?(voce|voces|vc|vcs|ti|mandato|gabinete|campanha|deputado|candidato)/u,
  /**
   * **"Voces estao contratando?"** -- a pergunta pela vaga sem a palavra vaga. E a forma da print
   * de 05/09/2026, e o que a torna pedido e ela perguntar se a campanha esta CHAMANDO gente.
   */
  /(^|[^\p{L}])(esta|estao|estas|ta|tao|voces|vcs|vc)\s+.{0,12}?(chamando|contratando|selecionando|recrutando|precisando\s+de)\s+(gente|pessoa|pessoas|pessoal|alguem|funcionari|volunta)/u,
  /(^|[^\p{L}])(preciso|procuro|procurando|quero|queria|busco)\s+.{0,15}?(emprego|trabalho|vaga)/u,
  /(^|[^\p{L}])(arrumar|conseguir|indicar|arruma|consegue|indica)\s+.{0,15}?(emprego|vaga|trabalho)/u,
  /(^|[^\p{L}])(alguma|tem|teria|tem\s+alguma)\s+vaga/u,
  /**
   * *"Tem trabalho ai?"* (Vivi Gutierrez, 02/09/2026) -- e a forma mais curta e mais comum de
   * perguntar, e nao casava com nada: ela foi CONCLUIDA EM SILENCIO. Relato dele: *"ela fez uma
   * pergunta, nunca concluir sem responder"*.
   *
   * Exige o "tem/teria/tera" na frente para nao pegar "o trabalho de voces e otimo", que a lista de
   * guarda ja cobre por outro lado.
   */
  /(^|[^\p{L}])(tem|teria|tera)\s+(algum\s+|alguma\s+)?(trabalho|emprego|servico)(\s|$|\?|\.)/u,
  /(^|[^\p{L}])(meu|o)\s+curriculo/u,
  /(^|[^\p{L}])(voces|vcs)\s+(pagam|remuneram)/u,
  /(^|[^\p{L}])(e|eh)\s+(remunerado|voluntario\s+ou)/u,
  /(^|[^\p{L}])tem\s+(salario|remuneracao)/u,
];

/**
 * O que NÃO é pedido de trabalho, por mais que a palavra apareça.
 *
 * "vamos trabalhar juntos" e "obrigado pelo seu trabalho" são a fala mais comum desta base — a
 * mesma razão da lista de negativas benignas em `semInteresse`. Sem esta guarda, o texto que NEGA
 * emprego sairia para quem estava elogiando.
 */
const NAO_E_PEDIDO_DE_TRABALHO = [
  /(^|[^\p{L}])(vamos|bora|precisamos)\s+trabalhar\s+(juntos|unidos)/u,
  /(^|[^\p{L}])(obrigad|parabens|admiro|gosto|agradeco).{0,30}?trabalho/u,
  /(^|[^\p{L}])(pelo|do|seu|teu)\s+(belo\s+)?trabalho/u,
  /(^|[^\p{L}])(bom|otimo|excelente)\s+trabalho/u,
  /**
   * **Quem se OFERECE nao esta pedindo emprego** -- e o texto que nega comeca com *"procurar
   * trabalho cansa"*, que seria a resposta errada para quem escreveu que quer ajudar de graca.
   *
   * A guarda e literal de proposito: *"e remunerado ou voluntario?"* continua sendo pedido, e esta
   * na lista de cima. O que sai daqui e a AFIRMACAO de que ela nao quer nada em troca.
   */
  /(^|[^\p{L}])(sou|como|quero\s+ser|posso\s+ser)\s+voluntari/u,
  /(^|[^\p{L}])(de\s+graca|sem\s+ganhar\s+nada|sem\s+receber\s+nada|nao\s+quero\s+nada\s+em\s+troca)/u,
];

export function pedeEmprego(entrantes, nossaUltimaAt) {
  const rajada = rajadaFinal(entrantes, nossaUltimaAt);
  if (!rajada.length) return null;

  const conversa = rajada
    .map((m) => String(m?.texto || '').trim())
    .filter(Boolean)
    .join(' \n ')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  if (!conversa) return null;

  for (const guarda of NAO_E_PEDIDO_DE_TRABALHO) if (guarda.test(conversa)) return null;

  for (const padrao of QUER_TRABALHAR) {
    const m = padrao.exec(conversa);
    if (m) {
      return {
        motivo: `perguntou sobre trabalhar no mandato ("${m[0].trim()}") — vale a resposta que explica e nega`,
        trecho: conversa.slice(0, 160),
      };
    }
  }
  return null;
}

/**
 * **Texto escrito pela PLATAFORMA e entregue como se fosse a pessoa.**
 *
 * Duas anotações de 02/09/2026, e a primeira é a mais grave que apareceu até agora:
 *
 *  - **Carlos** — a mensagem dele era um áudio, e o que chegou no lugar foi *"Não foi possível
 *    transcrever este áudio"*. `semInteresse` leu o "Não foi possível" como recusa: ele foi
 *    **etiquetado como sem interesse e concluído em silêncio**, sendo apoiador do anúncio. Etiqueta
 *    permanente errada, no CRM, num eleitor real;
 *  - **Vera** — duas mensagens *"*Atenção:* o tipo da mensagem enviada pelo contato não é
 *    suportado."* viraram "escreveu apoio em mensagem própria", e ela recebeu o modelo em cima de
 *    um aviso de erro.
 *
 * A plataforma injeta esses textos no fluxo do contato, então para nós eles chegam idênticos a uma
 * mensagem dela. **Nenhum parser tem como saber**: é ruído com forma de fala.
 *
 * Quem chama esvazia o `texto` e marca `sistema: true` em vez de descartar a mensagem — descartar
 * apagaria o fato de que ela mandou ALGUMA coisa (um áudio, uma figura), e "não escreveu nada" é
 * informação diferente de "não mandou nada".
 */
const MENSAGENS_DA_PLATAFORMA = [
  /nao\s+foi\s+possivel\s+transcrever/,
  /o\s+tipo\s+da\s+mensagem\s+enviada\s+pelo\s+contato\s+nao\s+e\s+suportado/,
  /mensagem\s+(nao\s+suportada|apagada|removida)/,
  /esta\s+mensagem\s+foi\s+apagada/,
  /**
   * O asterisco e OBRIGATORIO: a plataforma escreve em negrito (`*Atencao:*`), e gente escreve
   * "Atencao para o que eu vou dizer" sem ele. Sem exigir a marca, a frase mais comum de quem vai
   * desabafar virava ruido de sistema e o texto dela era apagado.
   */
  /^\*atencao/,
  /**
   * **"Aguardando mensagem. Essa ação pode levar alguns instantes."** — print dele (05/09/2026), e
   * o estrago desta foi o pior tipo: o aviso traz o link do `faq.whatsapp.com`, o parser leu a URL
   * como resposta ao formulário e **"faq.whatsapp.com" foi gravado no campo Cidade** de uma
   * eleitora real. A tela ainda oferecia *"Este é o grupo de faq.whatsapp.com"*.
   *
   * É a mesma família do Carlos e da Vera (02/09): a plataforma escreve no fluxo do contato e nós
   * lemos como fala dela. A diferença aqui é que o ruído carrega um LINK, e link vira dado.
   *
   * O `saiba mais` fica junto na alternativa porque a primeira parte muda de redação com o idioma
   * do aparelho; as duas juntas não aparecem em fala de gente.
   */
  /^\s*(⏳\s*)?aguardando\s+mensagem/,
  /essa\s+acao\s+pode\s+levar\s+alguns\s+instantes/,
];

export function ehMensagemDaPlataforma(texto) {
  const plano = String(texto || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!plano) return false;
  return MENSAGENS_DA_PLATAFORMA.some((p) => p.test(plano));
}

/**
 * **Um teto para a densidade do áudio, e ele é de propósito alto.**
 *
 * Medido na conversa da Irene: um áudio de 23 segundos ocupava 189.932 bytes — cerca de 8.200
 * bytes por segundo, que é o mp3 de voz que a plataforma guarda. Aqui vai o **dobro**, e o dobro
 * é o que torna a conta segura: com 16.000, a duração estimada sai pela METADE da real, então a
 * regra sempre erra para o lado de NÃO acusar encaminhamento.
 */
const BYTES_POR_SEGUNDO_DE_AUDIO = 16000;

/** Dois áudios seguidos pertencem ao mesmo lote enquanto a distância entre eles for pequena. */
const LOTE_MS = 60_000;

/**
 * Folga da conta, em milissegundos. Cobre a imprecisão da estimativa por tamanho e o tempo que a
 * pessoa leva entre gravar e apertar enviar. Quinze segundos é muito para um erro de arredondamento
 * e pouco para os quase três minutos de fala que chegaram em dois segundos no caso real.
 */
const FOLGA_DE_GRAVACAO_MS = 15_000;

/**
 * **Marca os áudios que NÃO PODEM ter sido gravados ali: eles foram encaminhados.**
 *
 * Print da Irene (07/09/2026). Ela mandou cinco áudios que somam quase três minutos de fala, e os
 * cinco chegaram **em dois segundos**; o conteúdo era conversa de outras pessoas, e a IA respondeu
 * uma pergunta que estava dentro de um deles. Foi ele quem nomeou o critério, e ele é aritmética:
 * *"realmente não é possível áudios com aquele tempo naquele espaço de tempo"*.
 *
 * **A conta:** o PRIMEIRO áudio do lote pode ter sido gravado antes da janela começar — os
 * outros, não. Então o tempo mínimo que o lote levaria para nascer ali é a soma das durações
 * **menos a do primeiro**. Se a janela de chegada for menor que isso, alguém encaminhou.
 *
 * **O relógio é o do WhatsApp (`ts`), não o da plataforma.** É a diferença que separa o
 * encaminhamento do único falso positivo real: aparelho sem rede entrega tudo junto ao reconectar,
 * e aí o `createdAt` é o mesmo para todos, mas os `ts` continuam espalhados como as gravações
 * foram. Sem `ts`, cai no `at`.
 *
 * **Só ÁUDIO.** Vídeo já é repasse por `ehRepasse`, e a densidade de bytes por segundo dele é
 * outra ordem de grandeza — a mesma conta ali acusaria dois vídeos quaisquer.
 *
 * Áudio sem tamanho não é julgado: sem os bytes não há duração, e o padrão é não acusar.
 *
 * Devolve uma lista nova; não mexe na que recebeu.
 */
export function marcarLoteEncaminhado(entrantes) {
  const lista = (entrantes || []).map((m) => ({ ...m }));
  const quando = (m) => new Date(m?.ts || m?.at || 0).getTime() || 0;

  let i = 0;
  while (i < lista.length) {
    const ehAudio = (m) => String(m?.tipo || '').toUpperCase() === 'AUDIO' && Number(m?.bytes) > 0 && quando(m) > 0;
    if (!ehAudio(lista[i])) {
      i++;
      continue;
    }

    // O lote: áudios seguidos, cada um perto do anterior.
    let fim = i;
    while (fim + 1 < lista.length && ehAudio(lista[fim + 1]) && quando(lista[fim + 1]) - quando(lista[fim]) <= LOTE_MS) {
      fim++;
    }

    const lote = lista.slice(i, fim + 1);
    if (lote.length >= 2) {
      const duracaoMs = (m) => (Number(m.bytes) / BYTES_POR_SEGUNDO_DE_AUDIO) * 1000;
      const soma = lote.reduce((t, m) => t + duracaoMs(m), 0);
      const necessario = soma - duracaoMs(lote[0]);
      const janela = quando(lote[lote.length - 1]) - quando(lote[0]);
      if (janela + FOLGA_DE_GRAVACAO_MS < necessario) {
        for (let k = i; k <= fim; k++) lista[k].encaminhado = true;
      }
    }

    i = fim + 1;
  }

  return lista;
}

/**
 * **Quer falar com o DEPUTADO em pessoa, ou quer o contato dele.**
 *
 * Pedido dele (08/09/2026), com o print do pastor que escreveu *"Gostaria de falar com deputado sou
 * pastor Cesar de santa Maria"* e a resposta que ele digitou à mão: em período eleitoral o encontro
 * é nos eventos da agenda, e o WhatsApp pessoal não é repassado por segurança.
 *
 * **O que qualifica é o OBJETO ser ELE**, e não a vontade de falar. *"Quero falar com você"* é a
 * conversa que já está acontecendo; *"vou falar com o prefeito"* é ela falando com outra pessoa;
 * *"falei com o deputado ontem"* é passado. O que casa é pedir para falar **com ele**, ou pedir o
 * número/contato **dele**.
 *
 * A ordem interna importa: o pedido de CONTATO é testado junto do de encontro, porque *"me passa o
 * whats dele"* não tem verbo de falar nenhum e é o mesmo pedido.
 */
const ELE_MESMO = '(ele|dele|deputado|capitao|martim|vereador|senador|candidato)';

const QUER_FALAR_COM_ELE = [
  // "gostaria de falar com o deputado", "queria conversar com ele", "quero encontrar o capitão"
  new RegExp(
    // `(muito\s+)?(de\s+)?` nesta ordem: "gostaria MUITO DE encontrar" tem as duas no meio, e foi
    // o único caso que a primeira versão deixou passar.
    `(^|[^\\p{L}])(quero|queria|gostaria|preciso|precisava|pretendo|posso)\\s+` +
      `(muito\\s+)?(de\\s+)?(falar|conversar|encontrar|encontrar-me|me\\s+encontrar|ver)\\s+` +
      `(com\\s+)?(o\\s+|a\\s+)?${ELE_MESMO}`,
    'iu'
  ),
  // "como faço para falar com ele", "tem como conversar com o deputado", "da pra falar com ele"
  new RegExp(
    `(^|[^\\p{L}])(como\\s+(faco|fazer|posso|consigo)|tem\\s+como|da\\s+pra|ha\\s+como|qual\\s+a\\s+forma\\s+de)\\s+` +
      `[^.!?]{0,20}?(falar|conversar|encontrar|ver)\\s+(com\\s+)?(o\\s+|a\\s+)?${ELE_MESMO}`,
    'iu'
  ),
  // O pedido de CONTATO: "me passa o whats dele", "tem o número do capitão?"
  new RegExp(
    `(^|[^\\p{L}])(me\\s+passa|me\\s+manda|passa|manda|voces?\\s+tem|tem|qual\\s+e?|qual\\s+o)\\s+` +
      `[^.!?]{0,15}?(whats|whatsapp|numero|telefone|contato|zap)\\s+` +
      `(pessoal\\s+)?(do|dele|da|de)\\s*(o\\s+)?${ELE_MESMO}?`,
    'iu'
  ),
];

/**
 * **A guarda: falar com NÓS não é falar com ELE.** *"Gostaria de falar com vocês"*, *"quero falar
 * com a equipe"* e *"posso falar com alguém aí?"* são a conversa que já está em curso — responder
 * com a negativa do WhatsApp pessoal seria negar o que ninguém pediu.
 */
const FALAR_CONOSCO = /(^|[^\p{L}])(falar|conversar)\s+(com\s+)?(voces?|vcs?|contigo|com\s+a\s+(equipe|assessoria)|com\s+alguem)/iu;

/** Ela contando que falou, ou que vai falar com um terceiro — não é pedido para nós. */
const NAO_E_PEDIDO = [
  /(^|[^\p{L}])(falei|conversei|encontrei|vi)\s+(com\s+)?(o\s+)?(ele|deputado|capitao|martim)/iu,
  /(^|[^\p{L}])(vou|irei|vamos)\s+falar\s+com\s+(o\s+)?(prefeito|vereador\s+da|secretario|delegado)/iu,
];

export function pedeFalarComDeputado(entrantes, nossaUltimaAt) {
  const rajada = rajadaFinal(entrantes, nossaUltimaAt);
  if (!rajada.length) return null;

  for (const msg of rajada) {
    if (msg?.sistema || ehMensagemDeAnuncio(msg)) continue;
    const texto = semLinks(msg?.texto);
    if (!texto.trim()) continue;
    if (NAO_E_PEDIDO.some((re) => re.test(texto))) continue;
    if (FALAR_CONOSCO.test(texto)) continue;
    if (QUER_FALAR_COM_ELE.some((re) => re.test(texto))) {
      return { motivo: 'quer falar com o deputado em pessoa — o encontro é na agenda, e o número pessoal não é repassado' };
    }
  }
  return null;
}

/**
 * Esta mensagem é **repasse** — conteúdo de terceiro que a pessoa encaminhou?
 *
 * Link sozinho e vídeo. É o que ele chamou de ruído em 31/08: *"está confuso quando é rajada de
 * links, links em geral devem ser ignorados, não lembro de exceções"*.
 *
 * **Repasse não é o mesmo que reação, e a diferença é para quem o gesto aponta.** Um 🙏 é
 * dirigido a ele — a Marta respondeu o anúncio assim, e ali pedir os dados é o certo. Um link do
 * Facebook é conteúdo de outra pessoa passando adiante; não diz nada sobre este contato, e
 * responder a ele com um formulário é responder a coisa errada.
 */
export function ehRepasse(msg) {
  const tipo = String(msg?.tipo || 'TEXT').toUpperCase();
  if (tipo === 'VIDEO') return true;

  /**
   * **Áudio de lote encaminhado é repasse pela mesma razão do vídeo** — ver
   * `marcarLoteEncaminhado`. A marca vem do painel, num lugar só, antes de qualquer regra ver;
   * aqui só se lê.
   */
  if (msg?.encaminhado) return true;

  const texto = String(msg?.texto || '');
  if (!texto.trim()) return false;

  // Link e nada mais: tirando os links, não sobra nada escrito por ela.
  return LINK.test(texto) && !texto.replace(LINK, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * A rajada inteira é repasse — links e vídeos, e nada que a pessoa tenha escrito?
 *
 * Serve para as regras **não reagirem ao ruído**. O Odone é o retrato: 76 mensagens em semanas,
 * todas link de vídeo, e a rodada oferecendo o formulário porque ele "veio do anúncio e nunca
 * recebeu os dados". Nunca vai receber — ele não está conversando, está repassando.
 *
 * Rajada vazia devolve `false`: sem mensagem não há ruído a ignorar, e é a regra de baixo que
 * decide.
 */
export function rajadaEhSoRepasse(entrantes, nossaUltimaAt) {
  const rajada = rajadaFinal(entrantes, nossaUltimaAt);
  if (!rajada.length) return false;
  return rajada.every((m) => ehRepasse(m));
}


/**
 * Esta mensagem foi **gerada pelo anúncio**, e não escrita pela pessoa?
 *
 * O Instagram manda um texto pronto quando alguém clica no botão: *"Olá! Eu apoio as Escolas
 * Cívico-Militares"*. Ela não escolheu as palavras — clicou.
 *
 * Os padrões vêm de `store.padroesDeAnuncio`, e quem chama passa: este módulo é puro e sem
 * dependência, que é o que permite testar tudo offline.
 *
 * Padrão inválido é ignorado em silêncio, um por um: expressão mal digitada na Config não pode
 * derrubar a leitura da conversa inteira.
 */
export function ehMensagemDeAnuncio(msg, padroes = []) {
  const texto = String(msg?.texto || '').trim();
  if (!texto) return false;

  /**
   * **A MARCA vem antes da lista, e é ela que fecha a classe** — pedido dele (04/09/2026), depois
   * da print da contato que chegou pelo anúncio do Facebook e recebeu o agradecimento pelo apoio.
   *
   * O padrão cadastrado era `^olá!? eu apoio` e a mensagem gerada pelo anúncio novo dizia
   * *"Olá! Eu **estou do lado da segurança e** apoio o Capitão Martim"*. Não casou — então o texto
   * DO ANÚNCIO passou a contar como fala dela, `soExpressaApoio` deu verdadeiro, e ela foi
   * agradecida por um apoio que ela não escreveu. **O anúncio mudou de redação e a lista não.**
   *
   * Lista de texto não fecha — é a mesma lição das formas de perguntar. O que fecha é o DADO: a
   * plataforma diz que a sessão veio de anúncio (`utm`), e a primeira mensagem de uma sessão
   * dessas é o texto pré-preenchido, não a voz dela. Quem marca é o painel, num lugar só
   * (`prepararEntrantes`), antes de qualquer regra ver — igual ao ruído da plataforma.
   *
   * A lista continua valendo **como reforço**: ela é o que alcança o segundo clique, num anúncio
   * que não abriu sessão nova.
   */
  if (msg?.geradaPeloAnuncio) return true;

  for (const bruto of padroes) {
    try {
      if (new RegExp(String(bruto), 'i').test(texto)) return true;
    } catch (_) {
      // expressão inválida: ignora só ela
    }
  }
  return false;
}

/**
 * A conversa pendente é SÓ expressão de apoio, sem nada a resolver?
 *
 * Pedido dele (31/08, print do Ciro): *"esse é um caso comum até onde a pessoa só expressa o
 * apoio, ja tem as etiquetas, então é só uma questão de agradecer o apoio e carinho"*.
 *
 * **Quem decide é o que NÃO está na mensagem.** Expressão de apoio junto com pergunta é
 * pergunta; junto com pedido de material é pedido. O agradecimento só cabe quando o apoio é a
 * mensagem inteira — senão ele responde a metade fácil e ignora a que importa, que é o defeito
 * mais caro que uma resposta automática pode ter.
 *
 * `conversaTemPerguntaAberta` e `PEDIDO_DE_MATERIAL` são reusados aqui de propósito: duas
 * listas para a mesma pergunta divergiriam na primeira vez que uma fosse ajustada sozinha.
 *
 * @returns {{motivo:string}|null}
 */
/**
 * **Votos de BOA VONTADE — só contam quando são a mensagem inteira.**
 *
 * Relato dele (06/09/2026), depois de eu listar as condições do apoio: *"muito vago esses termos e
 * podem pegar em mais contextos, o que mais pode ser feito?"*. Estava certo, e o número era feio —
 * **15 de 19** frases plausíveis desta base davam apoio sem ser apoio:
 *
 *  - *"estou sem força nenhuma, muito cansada"*;
 *  - *"faça força com o prefeito por nós"* — que é um PEDIDO;
 *  - *"tentei falar com a prefeitura sem sucesso"*;
 *  - *"Deus te abençoe, preciso muito de uma cesta básica"*;
 *  - *"estou torcendo para conseguir a cirurgia"*;
 *  - *"parabéns pelo aniversário do seu pai"*.
 *
 * **A diferença entre estes e o resto da lista é a natureza.** *"Eu apoio"*, *"conte comigo"*,
 * *"vou votar"*, *"sou seu eleitor"* declaram lealdade e são dirigidos a NÓS — valem onde
 * estiverem. *"Força"*, *"parabéns"*, *"sucesso"*, *"Deus te abençoe"*, *"torcendo"* são votos de
 * boa vontade: sozinhos são carinho, e no meio de uma frase **quem decide é o resto da frase**.
 *
 * Por isso eles só contam quando a mensagem é **só isso** — que é o que o nome da regra sempre
 * prometeu ("SÓ expressa apoio"). É a terceira vez que este projeto aprende a mesma coisa: a caixa
 * do "só mandou bom dia" pegando o desabafo da Cris, e o "boa tarde queria saber mais" da Teresinha.
 */
const BOA_VONTADE = [
  /(^|[^\p{L}])(parab[eé]ns|sucesso|for[çc]a|felicidades)(\s|$|!|,|\.)/iu,
  /(^|[^\p{L}])(deus|jesus)\s+(te|o|a|lhe)\s+(aben[çc]oe|guarde|proteja)/iu,
  /(^|[^\p{L}])torcendo(\s|$)/iu,
];

/**
 * O que sobra da mensagem quando se tira o voto de boa vontade, a cortesia e a pontuação.
 *
 * Vazio (ou quase) = a mensagem É o voto. Qualquer coisa a mais e quem manda é essa coisa a mais.
 */
const RECHEIO_DE_BOA_VONTADE =
  /\b(muita|muito|toda|todo|mais|bastante|meu|minha|meus|minhas|nosso|nossa|pra|para|pro|a[ií]|voc[eê]s?|vcs?|senhor|senhora|capit[ãa]o|martim|zucco|amigo|amiga|querido|querida|obrigad[ao]|abra[çc]o|abra[çc]os|bom|boa|dia|tarde|noite|e|de|do|da|no|na|com|que|deus|jesus|sempre|hoje)\b/giu;

function soVotoDeBoaVontade(texto) {
  const bruto = String(texto || '');
  if (!BOA_VONTADE.some((re) => re.test(bruto))) return false;

  let sobra = bruto;
  for (const re of BOA_VONTADE) sobra = sobra.replace(new RegExp(re.source, 'giu'), ' ');
  sobra = sobra
    .replace(RECHEIO_DE_BOA_VONTADE, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

  // Uma palavra solta que sobrou ainda é carinho ("beijos", "amém"); duas já é outra frase.
  return sobra.split(/\s+/).filter(Boolean).length <= 1;
}

export function soExpressaApoio(entrantes, nossaUltimaAt, padroesDeAnuncio = []) {
  const rajada = rajadaFinal(entrantes, nossaUltimaAt);
  if (!rajada.length) return null;

  /**
   * Ela precisa ter escrito algo que **não** seja o texto do anúncio.
   *
   * É o critério que ele descreveu: *"se não tivesse o texto de baixo eu mandaria o modelo,
   * agradeceria a atenção e encerraria"*. Só o clique no anúncio não é exceção — é o caso normal,
   * e o caso normal já tem resposta (modelo + agradecimento pela atenção).
   */
  const todas = Array.isArray(entrantes) ? entrantes : [];
  const escreveuAlgoDela = todas.some(
    (m) => String(m?.texto || '').trim() && !ehMensagemDeAnuncio(m, padroesDeAnuncio)
  );
  if (!escreveuAlgoDela) return null;

  // Tipo que pede ele em pessoa (áudio, vídeo, arquivo) nunca é "só apoio".
  for (const msg of rajada) {
    if (pedeRespostaPessoal({ tipo: msg?.tipo })) return null;
  }

  if (conversaTemPerguntaAberta(entrantes, nossaUltimaAt)) return null;

  const texto = rajada.map((m) => String(m?.texto || '')).join(' ').trim();
  if (!texto) return null;
  if (PEDIDO_DE_MATERIAL.test(texto)) return null;

  /**
   * O apoio tem de estar no que ELA escreveu — **as mensagens do ANÚNCIO saem da conta.**
   *
   * A primeira versão excluía a primeira mensagem da conversa, presumindo que ela era a do
   * anúncio. Print da Erenita (01/09) derrubou: ela mandou uma **figura antes**, o texto do anúncio
   * virou a segunda mensagem, e a regra passou a ler *"Eu apoio as Escolas Cívico-Militares"* como
   * apoio escrito por ela. *"preciso que identifique o modelo pelo texto"*.
   *
   * Posição é frágil (basta ela mandar um "bom dia" antes); texto não é.
   */
  const dela = rajada
    .filter((m) => !ehMensagemDeAnuncio(m, padroesDeAnuncio))
    .map((m) => String(m?.texto || ''))
    .join(' ')
    .trim();
  if (!dela) return null;
  if (PEDIDO_DE_MATERIAL.test(dela)) return null;

  for (const padrao of EXPRESSOES_DE_APOIO) {
    if (padrao.test(dela)) {
      return { motivo: 'escreveu apoio em mensagem própria — responda a ela antes do material' };
    }
  }

  // Os votos de boa vontade só contam quando são a mensagem inteira — ver `soVotoDeBoaVontade`.
  if (soVotoDeBoaVontade(dela)) {
    return { motivo: 'mandou um voto de boa vontade e nada mais — agradeça' };
  }
  return null;
}

/**
 * A conversa pendente traz uma pergunta que só ELE pode responder?
 *
 * Nasceu da print da Clair (31/08): ela respondeu o formulário, e depois escreveu *"tem muita
 * propaganda aqui em santa Maria, mas não do capitão Martins."* seguido de *"Porque?"*. A rodada
 * sugeria **mandar o modelo da campanha** — material de campanha como resposta a uma pergunta
 * sobre a falta de material de campanha. *"pergunta especifica, caso para IA"*.
 *
 * Nenhuma regra pegava: a rajada tinha 126 caracteres (longe dos 400), não era reação, não era
 * despedida, e havia conteúdo mapeado. Então `conteudo-pedido` venceu.
 *
 * **Por que a lista é curta.** O objetivo dele é resolver 90% sem IA; cada entrada aqui tira um
 * contato da automação. O que ganha lugar é só pergunta de razão ou de posição — as que dependem
 * do que ele pensa. Pergunta que pede material continua indo para o modelo, que a responde bem.
 *
 * **Onde isto acaba e a IA começa:** aqui a rodada só acerta a TECLA (6, à mão). Reconhecer que a
 * pergunta é sobre distribuição de material em Santa Maria, e propor o que responder, é da IA.
 *
 * @param {Array<{texto?:string, tipo?:string, at?:string}>} entrantes
 * @param {string|null} nossaUltimaAt
 * @returns {{motivo:string}|null}
 */
/**
 * **Perguntas que uma resposta PRONTA já responde** — as exclusões dele, agora explícitas.
 *
 * Em 03/09/2026 eu tentei alargar `conversaTemPerguntaAberta` para "qualquer ?" e quebrei cinco
 * casos que ele já tinha decidido: *"pode me mandar o material?"*, *"Tudo bem?"*, *"Como posso
 * ajudar na campanha?"*, *"tem algum material para eu compartilhar?"* e *"tem algum grupo?"*. Na
 * ocasião desisti do caminho — as exclusões só existiam por acidente, por não estarem na lista
 * curta de formas.
 *
 * Escritas, elas deixam de ser acidente, e o alargamento passa a ser seguro. **A exclusão diz QUEM
 * responde (o modelo, a mensagem do momento), nunca SE responde** — nenhuma delas conclui em
 * silêncio, porque `perguntaPendente` continua valendo por cima.
 */
const RESPONDIDA_POR_PRONTA = [
  // "quero receber o conteúdo", "me manda o material"
  PEDIDO_DE_MATERIAL,
  /**
   * O INFINITIVO, que o `PEDIDO_DE_MATERIAL` não pega: *"pode me mandar o material?"* é a forma
   * mais comum de pedir, e a exclusão dele nunca precisou funcionar até a pergunta passar a valer
   * por "?" — antes ela morria por não casar com nenhuma forma da lista curta.
   */
  /(^|[^\p{L}])(mandar|enviar|passar|repassar|disponibilizar)\s+(o\s+|a\s+|um\s+|uma\s+|uns\s+|algum\s+)?(material|conteudo|conte[uú]do|adesivo|santinho|panfleto|folder|arte|card|v[ií]deo|foto|link|informa)/iu,
  /(^|[^\p{L}])(tem|teria|tenho\s+como|onde\s+tem)\s+(algum|alguma)\s+(material|conteudo|adesivo|santinho|panfleto|folder|arte|card|video|foto)/iu,
  /(^|[^\p{L}])(tem|teria)\s+(algum|alguma)\s+(grupo|lista|whats|whatsapp)/iu,
  // cortesia com interrogação: "tudo bem?", "como vai?", "tudo certo?"
  /(^|[^\p{L}])(tudo\s+(bem|certo|joia|bom)|como\s+(vai|esta|voce\s+esta)|como\s+vao\s+voces)(\s|\?|!|$)/iu,
  // oferta: "como posso ajudar na campanha?" — é ela querendo ajudar, e há resposta pronta
  /(^|[^\p{L}])(como|em\s+que|no\s+que)\s+(eu\s+)?posso\s+(ajudar|contribuir|colaborar)/iu,
];

export function conversaTemPerguntaAberta(entrantes, nossaUltimaAt) {
  const rajada = rajadaFinal(entrantes, nossaUltimaAt);
  if (!rajada.length) return null;

  /**
   * Uma mensagem por vez, e **não** o texto colado da rajada.
   *
   * Colado, o começo de uma mensagem virava o meio de uma frase gigante, e aí o teste de
   * posição abaixo não valia nada.
   */
  for (const msg of rajada) {
    /**
     * **O LINK sai antes de qualquer coisa, e ele era a causa de *"passa pra mim"* nos links.**
     *
     * Relato dele (05/09/2026): *"vários casos da pessoa mandando link e reconhece como conversa e
     * passa pra mim"*. Medido: um link do Instagram é lido como PERGUNTA — e a causa é boba e
     * grande, porque a URL carrega a **query string**: `?igsh=`, `?utm_source=`, `?v=`. O teste da
     * interrogação via aquele "?" e a intersão do link virava *"fez uma pergunta que nenhuma
     * resposta pronta responde"* — tecla 6, em toda pessoa que repassa vídeo.
     *
     * Tirar o link antes também arruma a guarda de POSIÇÃO: com a URL na frente, o padrão de
     * pergunta nunca estava "no começo da mensagem".
     */
    /**
     * **E a LEGENDA de um repasse não conta como pergunta** — regra dele (06/09/2026), print do
     * Eraldo. Ver `ehLegendaDeRepasse`: a interrogação está no texto de verdade, não na URL, mas
     * ela veio escrita no material que circula em grupo — responder é responder ao autor do vídeo.
     */
    if (ehLegendaDeRepasse(msg)) continue;

    const texto = semLinks(msg?.texto);
    if (!texto) continue;
    if (PEDIDO_DE_MATERIAL.test(texto)) continue;

    /**
     * A trava que faltava: **"pq"/"porque" no MEIO de uma frase é conjunção, não pergunta.**
     *
     * Print do Ciro (31/08): *"ficou muito grato pq sou Bolsonaro desde sempre"* virava
     * "fez uma pergunta" e ia para resposta à mão. "pq" explicativo é dos usos mais comuns do
     * português de WhatsApp — a regra estava tirando da automação justamente quem só agradecia.
     *
     * Vale como pergunta quando a mensagem **tem interrogação** ("Porque?") ou quando o padrão
     * está no **começo** dela ("pq nao tem material aqui"). Quem pergunta abre a mensagem com a
     * pergunta ou a marca com "?"; quem explica põe o "pq" no meio do que está contando.
     */
    const temInterrogacao = texto.includes('?');

    // As inequívocas valem em qualquer posição — ver `PERGUNTAS_INEQUIVOCAS`.
    for (const padrao of PERGUNTAS_INEQUIVOCAS) {
      if (padrao.test(texto)) {
        return { motivo: 'perguntou sobre projeto, lei ou posição em pauta — nenhuma resposta pronta responde' };
      }
    }

    for (const padrao of PERGUNTAS_QUE_PEDEM_VOCE) {
      const achou = texto.match(padrao);
      if (!achou) continue;

      // `index` do casamento: 0 (ou 1, quando o padrão consome o espaço à esquerda) = começo.
      const noComeco = achou.index <= 1;
      if (temInterrogacao || noComeco) {
        return { motivo: 'fez uma pergunta que nenhuma resposta pronta responde' };
      }
    }

    /**
     * **Qualquer pergunta que uma resposta pronta não cubra** — print da Ieda (04/09/2026).
     *
     * Ela perguntou *"Você é candidato daqui do RS?"* e recebeu a mensagem do momento. Antes disso,
     * a Teresinha (*"Tem alguém que vem na casa da gente pra conversar"*) e o Paulo Quevedo
     * (*"Colorado ou Gremista?"*): **três vezes a mesma classe**, e as três resolvidas
     * acrescentando uma forma à lista. Lista de formas não fecha — ninguém cadastra todas as
     * maneiras de perguntar.
     *
     * O que fecha é a inversão: **é pergunta a menos que uma resposta pronta a responda**, e essas
     * estão escritas em `RESPONDIDA_POR_PRONTA`. Ele repetiu a regra três vezes com as mesmas
     * palavras — *"a regra de sempre responder uma pergunta tem que valer"*, *"tem pergunta não
     * conclui"*, *"responder a pergunta é prioridade"*.
     *
     * **A guarda de POSIÇÃO continua**: sem "?", só conta abrindo a mensagem. É ela que impede
     * *"ficou muito grato pq sou Bolsonaro desde sempre"* (print do Ciro) de virar pergunta.
     *
     * O custo é conhecido e é o lado barato: mais contato indo para a tecla 6, que é ele
     * respondendo. O outro lado é material de campanha em cima de uma pergunta.
     */
    if (RESPONDIDA_POR_PRONTA.some((re) => re.test(texto))) continue;
    if (temInterrogacao || ABRE_PERGUNTANDO.test(semAcentos(texto)) || PERGUNTA_DECLARADA.test(semAcentos(texto))) {
      return { motivo: 'fez uma pergunta que nenhuma resposta pronta responde' };
    }
  }
  return null;
}

/** Sem acento e com o espaço normalizado — os padrões de pergunta são escritos assim. */
function semAcentos(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A última mensagem do contato é só uma reação? */
export function ultimaEhSoReacao(entrantes) {
  const lista = Array.isArray(entrantes) ? entrantes : [];
  if (!lista.length) return false;
  return ehSoReacao(lista[lista.length - 1]);
}

/**
 * O contato só cumprimentou, mandou um link ou uma figura nas últimas mensagens?
 *
 * A janela é de 3 por pedido dele. Mensagem com substância DENTRO dela derruba; fora dela, não —
 * quem escreveu algo há semanas e hoje só manda "bom dia" está cumprimentando.
 *
 * @param {Array<{texto?:string, tipo?:string}>} entrantes mensagens do contato, da mais antiga
 *   para a mais nova
 * @param {number} [quantas] quantas mensagens do fim olhar
 * @returns {{motivo:string}|null}
 */
export function soCortesia(entrantes, quantas = 3) {
  const lista = (Array.isArray(entrantes) ? entrantes : []).slice(-quantas);
  if (!lista.length) return null;
  if (!lista.every(mensagemDeCortesia)) return null;

  const temImagem = lista.some((m) => TIPOS_COMPARTILHADOS.has(String(m?.tipo || '').toUpperCase()));
  const temLink = lista.some((m) => LINK.test(String(m?.texto || '')));
  const temSaudacao = lista.some((m) => SAUDACAO.test(String(m?.texto || '')));

  const partes = [];
  if (temSaudacao) partes.push('cumprimentou');
  if (temLink) partes.push('mandou um link');
  if (temImagem) partes.push('mandou uma figura');

  return { motivo: partes.join(' e ') || 'só cortesia' };
}

// ---------------------------------------------------------------------------
// Sem interesse: quem recusou ou quem veio hostilizar
// ---------------------------------------------------------------------------

/**
 * Recusas EXPLÍCITAS, em qualquer lugar da mensagem.
 *
 * Estas não dependem de contexto nenhum: quem escreve isso está pedindo para não ser mais
 * chamado, e continuar mandando mensagem depois é o que gera denúncia — o sinal que derruba
 * número.
 */
/**
 * **"não tenho" saiu daqui** — anotação do lopezp4295 (03/09/2026), e ele perguntou o essencial:
 * *"de onde saiu a frase para sugerir sem interesse?"*.
 *
 * Saiu de *"Eu não tenho, eu não tenho, né, nenhum, uma, como é que se diz, um, os números, né,
 * dos candidatos pra eu votar"* — alguém dizendo que **não tem os números dos candidatos**, e que
 * na mesma mensagem diz *"mas eu vou ir votar, sim"*. O padrão aceitava `nao tenho` seco.
 *
 * `nao tenho` sozinho não é recusa de nada: não tenho o número, não tenho WhatsApp, não tenho
 * carro. O que é recusa é `não tenho interesse` — e essa forma continua aqui, escrita por extenso.
 * As outras (`não quero`, `não desejo`, `não preciso`) já trazem o sentido no próprio verbo.
 */
const RECUSA_EXPLICITA =
  /\bnao (quero|desejo|preciso|me interess)/i.source +
  '|' +
  /\bnao tenho (interesse|mais interesse)\b/i.source +
  '|' +
  /\b(sem|nenhum) interesse\b|\bme (tira|tire|retira|retire|remove|remova)\b|\b(tirar|sair|me tirem?) da lista\b|\bdescadastr|\bpara de (mandar|enviar|me chamar)\b|\bnao me (mande|manda|envie|chame|perturbe|encha)\b|\bnao insista\b/i
    .source;

const RECUSA = new RegExp(RECUSA_EXPLICITA, 'i');

/**
 * Negativas que **não** são recusa — são resposta a OUTRA pergunta.
 *
 * Esta lista é a trava mais importante da regra inteira. O pedido de dados termina perguntando
 * sobre grupos, e *"Não faço parte de nenhum grupo político"* é resposta de **apoiador** — está
 * até no teste do parser, na resposta real da Rosane. Um detector ingênuo de "começa com não"
 * etiquetaria essa pessoa como sem interesse e a tiraria da fila.
 *
 * Mesma coisa com *"não sei"* na posição da cidade e *"não moro mais lá"*.
 */
const NEGATIVA_BENIGNA =
  /\bnao (sei|lembro|faco parte|participo|estou em|tenho grupo|tenho whats|moro|sou de|consigo|entendi)\b|\bnenhum grupo\b|\bnao tenho nenhum\b|\b(nunca|nao) (ouvi|conheco|conhecia|vi) \b/i;

/**
 * Negativa sobre IR ao evento — resposta ao convite, nunca recusa de contato.
 *
 * Quem responde ao anúncio do evento para dizer que não pode ir é apoiador: veio pelo anúncio e
 * ainda gastou tempo respondendo. `confirmaPresenca` já trata isso, e a tecla 4 já manda "não tem
 * problema" + pede os dados. O que faltava era esta regra sair da frente.
 */
const RECUSA_DE_PRESENCA =
  /\bnao\b[^.!?]{0,40}\b(ir|vou|voy|comparecer|participar|estar (la|presente)|conseguirei|poderei|consigo|posso|da pra mim|vai dar)\b/i;

/** Começa negando? É onde mora a resposta a uma pergunta fechada. */
const COMECA_NEGANDO = /^\s*(nao|nunca|jamais|nada|negativo|dispenso)\b/i;

/**
 * **A negativa de abertura só vale se a mensagem FOR a negativa** — anotação do Alfredo (04/09/2026).
 *
 * Ele mandou uma foto e escreveu *"Não precisa muito pra ser feliz 😂😂😂😂"* — uma piada sobre a
 * própria foto — e foi **etiquetado como sem interesse e concluído em silêncio**. Ele: *"contexto
 * errado, vou mandar mensagem do momento"*. É a regra mais destrutiva do arquivo (etiqueta
 * permanente no CRM, em eleitor real), e o gatilho era só a mensagem começar com "não".
 *
 * `COMECA_NEGANDO` existe porque **a pergunta que fizemos era fechada** ("posso te mandar os
 * conteúdos?"), e resposta a pergunta fechada é curta. Uma frase de trinta e nove caracteres que
 * segue falando de outra coisa não é resposta a pergunta nenhuma.
 *
 * Duas formas de valer, e nenhuma delas pega a piada: a mensagem é **curta** (a resposta seca), ou
 * o "não" vem colado no que se está recusando.
 */
const NEGATIVA_CURTA = 28;
const NEGACAO_COM_OBJETO =
  /^\s*(nao|nunca|jamais)\s+(quero|queria|desejo|aceito|autorizo|permito|gosto|preciso\s+disso|tenho\s+interesse|me\s+interessa|vou\s+receber|recebo|estou\s+interessad)/i;

/**
 * Palavras que ninguém usa para falar COM quem apoia.
 *
 * Não entram sozinhas: insulto solto é ambíguo de direção. Apoiador chama o adversário de ladrão
 * e de golpista o dia inteiro, e isso não é hostilidade **contra nós**.
 */
// O `s?` no fim é obrigatório: sem ele "vocês são uns idiotas mentirosos" passava batido, porque
// `\b` depois de "idiota" não casa com "idiotas". Xingamento vem no plural com frequência.
const AGRESSAO =
  /\b(mentiros[oa]|idiota|imbecil|burr[oa]|lesma|otari[oa]|vagabund[oa]|corrupt[oa]|ladr(ao|a|oes)|safad[oa]|nojent[oa]|palhac[oa]|lixo|verme|fascista|golpista|presidiari[oa]|genocida|cretin[oa]|babaca|desgracad[oa]|canalha|escrot[oa]|arrombad[oa]|cuzao|pilantra|picareta|energumen[oa]|sem[- ]vergonha|filho\s+d[ae]\s+puta|fdp)s?\b/i;

/**
 * Fala dirigida a NÓS. É o que separa "vocês são mentirosos" de "o adversário é mentiroso".
 *
 * A direção é tudo aqui. Sem ela, a mensagem de um apoiador xingando o adversário — que é o tipo
 * mais comum de mensagem nesta base — seria etiquetada como sem interesse e sairia da fila.
 */
const DIRIGIDA_A_NOS = /\b(voces|voce|vocês|tu|es igual|teu|tua|seu candidato|sua campanha|de voces)\b/i;

/**
 * **O xingamento no IMPERATIVO já é segunda pessoa** — print dele (05/09/2026): a contato chegou
 * pelo anúncio, mandou o texto de apoio às 23:38 e, um minuto depois, *"Então vá para o inferno..
 * desgraçado"*. *"chegou hostilizando e extensão não reconheceu"*.
 *
 * Medido: **nada** casava. `desgracado` não estava na lista de xingamentos, e *"vá para o inferno"*
 * não estava na de segunda pessoa — que só conhecia pronomes. Mandar alguém ir a algum lugar é
 * falar COM a pessoa: o verbo carrega o "você" que a lista procurava.
 *
 * **Sozinho ele só conta quando é a mensagem inteira**, e essa guarda é a mesma do "confirmado" e
 * do "13": *"kkkk vai tomar no cu esse Lula"* é apoiador falando do adversário, e etiquetar isso
 * como sem interesse deixa rótulo permanente no CRM de quem mais apoia. Com outro xingamento junto
 * — o caso da print — ele vale como direção, e aí a regra de sempre decide.
 */
const XINGAMENTO_IMPERATIVO =
  /(^|[^\p{L}])(v[aá]|vai|vaite|vao)\s+(se\s+)?(pa?ra\s+(o\s+)?(inferno|pqp)|toma[r]?\s+n[oa]\s+(cu|c\*+)|fude[rn]|fode[rn]|ferrar|catar|lascar|plantar\s+batata)/iu;

/**
 * **Apelido pejorativo para quem está do NOSSO lado** — conta sozinho, sem precisar de segunda
 * pessoa.
 *
 * Anotação da susana (03/09/2026): *"IOla! Só prometeram e não cumpriram"* e *"Se for bolso
 * bosta.Negativo"*, e a rodada mandou o modelo do anúncio **mais** o pedido de nome e cidade. Ele:
 * *"bolso bosta está hostilizando; ela está se referindo ao Bolsonaro, nosso aliado, usando um
 * termo pejorativo"*.
 *
 * É exatamente o pedido dele de 01/09 (*"falando mal do Bolsonaro, e Martim é aliado do
 * Bolsonaro"*) — o que faltava era a lista.
 *
 * **Por que dispensa a fala em segunda pessoa**, ao contrário de `AGRESSAO`: aquela lista é de
 * xingamentos genéricos, que o apoiador usa contra o adversário o dia inteiro. Estes apelidos não
 * são ambíguos de direção — ninguém que apoia o mandato chama o aliado assim. É a própria palavra
 * que carrega o lado.
 *
 * Lista curta e literal de propósito: apelido ambíguo (um "mito" irônico) fica de fora, porque o
 * custo de errar aqui é etiquetar um apoiador como sem interesse, para sempre, no CRM.
 */
/**
 * **Ela só clicou em anúncios — vários, em rajada.**
 *
 * Print da Irene (05/09/2026): três cliques seguidos em anúncios diferentes do Instagram (*"Eu
 * escolho o Lado de Quem Produz"*, *"Eu apoio o Flávio, Zucco, Hiago e Capitão Martim"*, *"Eu estou
 * do lado da segurança"*), nada mais escrito, e a caixa ofereceu o modelo de um deles. Ele:
 * *"rajada de entrada em anúncio, mensagem do momento e concluir"*.
 *
 * **Por que não o modelo.** Quem clica em três anúncios está navegando, não pedindo uma coisa. O
 * modelo de um deles responde a um terço do que ela fez, escolhido pela ordem; mandar os três seria
 * rajada para o mesmo número. A mensagem do momento serve para qualquer um dos três.
 *
 * **A rajada tem de ser SÓ cliques, e é isso que separa este caso da Eroni** (03/09): ela recusou o
 * convite do evento **e** clicou em dois anúncios, e a decisão dele ali foi mandar o modelo novo.
 * Quem escreveu alguma coisa está falando; quem só clicou, não.
 *
 * @param {Array<{texto?:string, tipo?:string, at?:string, geradaPeloAnuncio?:boolean}>} entrantes
 * @param {string|null} nossaUltimaAt
 * @param {string[]} padroesDeAnuncio
 * @returns {{motivo:string, quantos:number}|null}
 */
export function rajadaDeAnuncios(entrantes, nossaUltimaAt, padroesDeAnuncio = []) {
  const rajada = rajadaFinal(entrantes, nossaUltimaAt).filter((m) => String(m?.texto || '').trim());
  if (rajada.length < 2) return null;
  if (!rajada.every((m) => ehMensagemDeAnuncio(m, padroesDeAnuncio))) return null;
  return {
    quantos: rajada.length,
    motivo: `clicou em ${rajada.length} anúncios seguidos e não escreveu nada — a mensagem do momento serve para todos`,
  };
}

/**
 * **Ela avisou que está doente, ou que não pode falar agora.**
 *
 * Print da Elenir (05/09/2026): chegou pelo anúncio das Escolas Cívico-Militares e, quatro minutos
 * depois, escreveu *"Não posso falar. Estou com infecção urinária e respiratória. muita tosse e
 * febre. Falarei assim que for possível. Faço oração pela minha recuperação salutar por gentileza.
 * Grata"*. A rodada **ignorou e concluiu**.
 *
 * São duas situações com o mesmo desfecho, e por isso um detector só: **quem está passando mal** e
 * **quem avisa que fala depois**. Nas duas, material de campanha é a resposta errada, e concluir em
 * silêncio é pior — a pessoa disse que voltaria, e fechar diz que não precisa.
 *
 * **Primeira pessoa é obrigatória**, e é a guarda que sustenta a regra. Nesta base a doença aparece
 * o tempo todo na fala política (*"o Brasil está doente"*), no pedido de remédio (que tem regra
 * própria, acima desta) e na notícia de terceiro (*"minha vizinha está internada"*). O que importa
 * aqui é ela falando de si.
 *
 * O desfecho é a **tecla 6**: quem responde é ele ou a IA. Não há resposta pronta para isto — e
 * escrever uma seria pior, porque o que a pessoa espera é alguém, não um texto.
 */
const MAL_ESTAR = [
  // "estou com febre", "to com covid" — o objeto tem que ser sintoma ou doença, senão "estou com"
  // pega tudo (foi assim que ela virou apoio).
  /(^|[^\p{L}])(estou|est[oô]|t[oô]|fiquei|acordei)\s+(com\s+)?(muita\s+|muito\s+|forte\s+)?(febre|tosse|gripe|covid|dengue|infec[çc][ãa]o|dor(es)?\b|enxaqueca|press[ãa]o\s+alta|virose|pneumonia|c[âa]ncer|depress[ãa]o)/iu,
  /(^|[^\p{L}])(estou|est[oô]|t[oô]|fiquei|ando)\s+(muito\s+|meio\s+)?(doente|adoentad[ao]|mal\s+de\s+sa[úu]de|hospitalizad[ao]|internad[ao]|acamad[ao]|de\s+cama|debilitad[ao])/iu,
  /(^|[^\p{L}])(estou|est[oô]|t[oô])\s+(no|em)\s+(hospital|uti|pronto\s*socorro)/iu,
  /(^|[^\p{L}])(fiz|farei|vou\s+fazer)\s+(uma\s+)?cirurgia/iu,
  /(^|[^\p{L}])minha\s+(sa[úu]de|recupera[çc][ãa]o|cirurgia|interna[çc][ãa]o)/iu,
  /(^|[^\p{L}])(me\s+)?recuperando\s+(de|da|do)\b/iu,
];

const NAO_POSSO_FALAR = [
  /(^|[^\p{L}])n[ãa]o\s+(posso|consigo|d[áa]\s+pra|da\s+pra|tenho\s+como)\s+(falar|conversar|responder|atender)/iu,
  /(^|[^\p{L}])falarei\s+(assim\s+que|quando|depois|mais\s+tarde)/iu,
  /(^|[^\p{L}])(falo|respondo|converso|retorno|volto)\s+(com\s+voc[eê]s?\s+)?(depois|mais\s+tarde|amanh[ãa]|assim\s+que|quando\s+(eu\s+)?puder|logo\s+mais)/iu,
  /(^|[^\p{L}])(assim\s+que\s+(eu\s+)?(puder|melhorar)|quando\s+(eu\s+)?melhorar)/iu,
];

/**
 * A pessoa está passando mal, ou avisou que fala depois — na RAJADA, porque o aviso vem depois do
 * cumprimento ou do clique no anúncio.
 *
 * @param {Array<{texto?:string, tipo?:string, at?:string}>} entrantes
 * @param {string|null} nossaUltimaAt
 * @returns {{motivo:string}|null}
 */
export function naoPodeFalarAgora(entrantes, nossaUltimaAt) {
  for (const msg of rajadaFinal(entrantes, nossaUltimaAt)) {
    const texto = semAcentos(msg?.texto);
    if (!texto) continue;
    if (MAL_ESTAR.some((re) => re.test(texto))) {
      return { motivo: 'contou que está passando mal — isso não se responde com material de campanha' };
    }
    if (NAO_POSSO_FALAR.some((re) => re.test(texto))) {
      return { motivo: 'avisou que não pode falar agora e que volta depois — não conclua por ela' };
    }
  }
  return null;
}

/**
 * **Pediu para a gente LIGAR** — pedido dele (04/09/2026, anotação da Jucileia).
 *
 * Ela escreveu *"Oi"*, três mensagens que a plataforma não leu, e *"Me liga"*. A rodada ofereceu
 * concluir. Ele: *"caso raro que a pessoa pede ligação: criar mensagem falando que não podemos e
 * dando uma desculpa; não fazemos ligações, a plataforma não aceita e é contraproducente"*.
 *
 * A lista é curta e literal: **o pedido de ligação é dito de poucas maneiras**, e alargar aqui
 * mandaria a recusa para quem só falou de telefone ("meu telefone mudou", "liguei para o CRAS").
 * Por isso o verbo precisa ser dirigido a NÓS — "me liga", "pode me ligar", "quero falar por
 * telefone" — e não a terceiro.
 */
const PEDIDO_DE_LIGACAO = [
  /(^|[^\p{L}])(me|nos)\s+lig(a|ue|uem|em)(\s|$|!|,|\.|\?)/iu,
  /(^|[^\p{L}])(pode|podem|poderia|poderiam|da\s+pra|consegue)\s+(me\s+|nos\s+)?lig(ar|arem)/iu,
  /(^|[^\p{L}])(liga|ligue|liguem)\s+(pra|para)\s+(mim|nos|eu)/iu,
  /(^|[^\p{L}])(quero|queria|gostaria\s+de|preciso)\s+.{0,20}?(falar|conversar)\s+(por|no)\s+(telefone|fone|ligacao)/iu,
  /(^|[^\p{L}])(aguardo|espero)\s+(a\s+)?(sua\s+)?ligacao/iu,
];

/**
 * A pessoa pediu que ligássemos para ela — na rajada, porque o pedido costuma vir depois de um
 * "oi" e de uma mídia que a plataforma não leu.
 */
export function pedeLigacao(entrantes, nossaUltimaAt) {
  const rajada = rajadaFinal(entrantes, nossaUltimaAt);
  for (const msg of rajada) {
    const texto = String(msg?.texto || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!texto) continue;
    if (PEDIDO_DE_LIGACAO.some((re) => re.test(texto))) {
      return { motivo: 'pediu que a gente ligasse — aqui o atendimento é só por mensagem' };
    }
  }
  return null;
}

/**
 * **Ela informou um ENDEREÇO** — pedido dele (04/09/2026), com o anúncio novo de material.
 *
 * *"anúncio novo é sobre material de campanha e eu peço endereço... a pessoa deve ser pulada e não
 * concluída, pois vou transferir pro responsável a conversa no final"*.
 *
 * **O endereço sozinho basta, e é decisão dele:** *"deixe somente para quando eu pedir endereço, no
 * momento só peço endereço para enviar material"*. Era para ser o cruzamento de duas metades (pediu
 * material E deu endereço), e ele cortou pela metade que é verdadeira na base dele — só se pede
 * endereço para mandar material, então quem escreve um é quem pediu o outro. Cruzar com a palavra
 * "material" seria pior, e não melhor: nesta base *"quero receber o material"* é conteúdo DIGITAL,
 * a frase mais comum que chega, e ela viria do texto do próprio anúncio — que fica na conversa para
 * sempre.
 *
 * **Reconhecer NOSSO pedido não serve como gatilho aqui**, e é a lição já registrada duas vezes: ele
 * pede o endereço à mão, com a redação do dia, então não há invariante para casar — a regra nunca
 * dispararia. O que ELA escreve é o sinal.
 *
 * **Roda na RAJADA, e isso é o que a torna uma resposta.** Regra dele, no mesmo dia: *"para pular o
 * contato sempre será depois que eu pedir o endereço e etiqueta for colocada"*. O endereço que
 * conta é o que ela escreveu **depois da nossa última mensagem** — ou seja, respondendo a alguma
 * coisa que nós dissemos. Ler a conversa inteira (como esta função fazia por uma versão) puxaria
 * também a rua citada num desabafo de julho, e o contato ficaria pulado para sempre.
 *
 * **Quem carrega o estado adiante é a ETIQUETA, não este detector.** Assim que respondemos, a
 * rajada esvazia e ele volta a ser falso — e é a etiqueta no CRM que continua dizendo "este é caso
 * de material". Detector é palpite; a marca é decisão, e decisão não se redescobre. Mesma lição da
 * etiqueta de sem interesse.
 */
const CEP = /(^|[^\p{L}\p{N}])\d{5}-?\d{3}([^\p{L}\p{N}]|$)/u;

/** O tipo da via: é o que diz "isto é um lugar", e sem ele nada aqui vira endereço. */
const TIPO_DE_VIA = /(^|[^\p{L}])(rua|r\.|avenida|av\.?|travessa|trav\.?|estrada|rodovia|rod\.?|beco|alameda|al\.|linha|servidao|passagem|praca|loteamento|vila|condominio|residencial)(\s|\.|,|$)/iu;

const BAIRRO = /(^|[^\p{L}])bairro(\s|:|$)/iu;

const DIZ_ENDERECO = /(^|[^\p{L}])(endereco|end\.)(\s|:|$)/iu;

const COMPLEMENTO = /(^|[^\p{L}])(apto|apartamento|ap\.|bloco|casa|lote|quadra|qd\.?|km|fundos|complemento|s\/n)(\s|\.|,|:|$)/iu;

/**
 * O NÚMERO da casa — e ele é a marca mais delicada da lista, porque dígito solto é qualquer coisa.
 *
 * Só conta em duas formas: **depois de vírgula** (*"Rua das Flores, 123"*) ou **fechando a
 * mensagem** (*"Rua João Silva 456"*, que é como se escreve endereço sem pontuação), além do
 * `nº` explícito. Aceitar dígito em qualquer posição faria *"a rua aqui está esburacada há 20
 * anos"* — reclamação, não endereço, e comum nesta base — virar endereço com a marca da via junto.
 */
const NUMERO_DA_CASA = [
  /,\s*\d{1,5}(\D|$)/,
  /(^|[^\p{L}])n[º°o]?\.?\s*\d{1,5}(\D|$)/iu,
  /\d{1,5}\s*$/,
];

/**
 * Ela escreveu um endereço? Devolve o motivo, ou `null`.
 *
 * **A regra das duas marcas**: o CEP basta sozinho (nada mais tem aquele formato); fora ele, são
 * necessárias DUAS marcas, e uma delas tem que dizer que ali há um lugar (via, bairro, ou a palavra
 * "endereço"). Endereço é uma LISTA de campos, e reclamação de rua é uma frase — a contagem é o que
 * separa as duas sem precisar entender português.
 *
 * Mensagem da plataforma não conta (é ruído, não fala dela). Transcrição de áudio entra: o número
 * quase sempre volta por extenso e não casa, então incluí-la custa quase nada e pega o raro caso em
 * que a pessoa ditou o endereço já formatado.
 */
export function informouEndereco(entrantes, nossaUltimaAt) {
  for (const msg of rajadaFinal(entrantes, nossaUltimaAt)) {
    if (msg?.sistema) continue;
    const texto = semAcentos(msg?.texto);
    if (!texto) continue;

    if (CEP.test(texto)) return { motivo: 'ela mandou um CEP — é endereço para enviar material' };

    const temLugar = TIPO_DE_VIA.test(texto) || BAIRRO.test(texto) || DIZ_ENDERECO.test(texto);
    if (!temLugar) continue;

    const marcas =
      (TIPO_DE_VIA.test(texto) ? 1 : 0) +
      (BAIRRO.test(texto) ? 1 : 0) +
      (DIZ_ENDERECO.test(texto) ? 1 : 0) +
      (COMPLEMENTO.test(texto) ? 1 : 0) +
      (NUMERO_DA_CASA.some((re) => re.test(texto)) ? 1 : 0);

    if (marcas >= 2) return { motivo: 'ela mandou o endereço — é o material para enviar' };
  }
  return null;
}

/**
 * **Ela pediu o MATERIAL** — regra dele (05/09/2026): *"o modelo de material é uma exceção, ele
 * sempre tem que ser mandado quando requisitado"*.
 *
 * O caso: anúncio do Facebook, ela escreveu *"Olá! Eu quero receber o Material da Direita"* às
 * 13:23, a rodada só a alcançou no dia seguinte — e mandou a **mensagem do momento**, concluindo.
 * Medido no quadro padrão: `contexto-de-outro-dia` fica acima da entrega do modelo nos três ramos,
 * então **o pedido de material vencia o dia e virava "o contexto passou"**. Não passou: material
 * pedido e não entregue continua pendente na semana que vem.
 *
 * **Roda na conversa INTEIRA, e não na rajada** — ao contrário de `informouEndereco`. O que a torna
 * segura não é a janela de tempo, é a ENTREGA: quem chama soma `!modeloJaNaConversa &&
 * !enviadoHoje`, e o sinal se apaga sozinho no instante em que o modelo sai. Fosse pela rajada, o
 * pedido sumiria assim que respondêssemos qualquer coisa — que é justamente quando ele ainda está
 * de pé.
 *
 * **A mensagem gerada pelo ANÚNCIO conta**, e aqui isso é o oposto de `soExpressaApoio`: lá o texto
 * do anúncio não pode virar fala dela; aqui **o clique É o pedido** — ela escolheu o anúncio que
 * dizia "Material da Direita", e escolha explícita dela não se substitui por dedução nossa.
 *
 * **Verbo E objeto, com o objeto numa lista curta de PERMISSÃO.** *"Quero receber"* sozinho pega
 * *"quero receber a visita de vocês"*; o objeto sozinho pega *"obrigada pelo material"*. Os dois
 * juntos, com até duas palavras no meio, são o que esta base escreve. A lista só cresce com caso
 * trazido por ele — mesma disciplina das siglas de cidade.
 */
const NEGA_O_PEDIDO = /(^|[^\p{L}])nao\s+(quero|queria|preciso|desejo|me\s+(manda|mande|envie))/iu;

const VERBO_DE_PEDIR_MATERIAL = [
  /(?:quero|queria|gostaria\s+de|desejo|preciso\s+d[eo]s?|como\s+fa[cç]o\s+p(?:ara|ra)|onde\s+consigo)\s+(?:receber|ter|pegar|adquirir|conseguir)/,
  /(?:pode|poderia|podem|poderiam|tem\s+como|teria\s+como)\s+(?:me\s+)?(?:mandar|enviar|passar|repassar|disponibilizar)/,
  /(?:me\s+)?(?:manda|mande|mandem|envia|envie|enviem|passa|passe|repassa|repasse)/,
  /(?:quero|queria|gostaria\s+de)/,
];

/** O que se pede. Literal de propósito: é o vocabulário desta campanha, e não uma categoria. */
const OBJETO_DE_MATERIAL =
  /(?:materia(?:l|is)|conteudos?|adesivos?|santinhos?|panfletos?|folders?|artes?|cards?|informativos?|cartilhas?|bandeiras?|camisetas?|bones?)/;

/**
 * Verbo, até duas palavras no meio, e o objeto. As peças ficam separadas acima porque é assim que
 * elas crescem: uma forma nova de pedir não é uma coisa nova a pedir.
 */
const PEDIDO_DE_MATERIAL_COMPLETO = VERBO_DE_PEDIR_MATERIAL.map(
  (verbo) =>
    new RegExp(
      String.raw`(^|[^\p{L}])(?:${verbo.source})(?:\s+\S+){0,2}\s+(?:${OBJETO_DE_MATERIAL.source})(?![\p{L}])`,
      'iu'
    )
);

/**
 * Ela pediu material em alguma mensagem? Devolve o motivo, ou `null`.
 *
 * @param {Array<{texto?:string, sistema?:boolean}>} entrantes
 */
export function pedeMaterial(entrantes) {
  for (const msg of entrantes || []) {
    if (msg?.sistema) continue;
    const texto = semAcentos(msg?.texto);
    if (!texto) continue;
    if (NEGA_O_PEDIDO.test(texto)) continue;
    if (PEDIDO_DE_MATERIAL_COMPLETO.some((re) => re.test(texto))) {
      return { motivo: 'ela pediu o material — o modelo tem que sair, e o pedido não vence com o dia' };
    }
  }
  return null;
}

/**
 * **Declarar voto no ADVERSÁRIO** — anotação da Rosa Maria (04/09/2026).
 *
 * Ela escreveu *"SOU APOSENTADA RURAL. MINHA CONCIENCIA DIZ QUE TENHO QUE SER 13"* e, na mensagem
 * seguinte, só *"13"*. A rodada ofereceu a mensagem do momento. Ele: *"13 é número do Lula,
 * adversário; é comum repetirem 13 para mostrar hostilidade"*.
 *
 * É o espelho exato do "22" que já conta como apoio, e a guarda é a mesma: **o número sozinho não
 * basta** — 13 é endereço, hora e idade. Vale como a mensagem inteira (a resposta seca de quem quer
 * marcar posição) ou colado num verbo de votar/ser.
 *
 * Vale por si, sem precisar de segunda pessoa: quem declara voto no adversário não é público de
 * material de campanha nossa, e é disso que esta regra trata.
 */
const VOTO_NO_ADVERSARIO = [
  /^\s*13\s*[!.\s]*$/u,
  /(^|[^\d\p{L}])(vou\s+de|voto|votar|vota|votamos|sou|ser|somos|serei)\s+(no\s+|na\s+)?13(\s|$|!|,|\.)/iu,
  /(^|[^\d\p{L}])13\s+(neles|sempre|ate\s+a\s+morte|com\s+orgulho|na\s+veia)/iu,
];

const INSULTO_AO_ALIADO =
  /\b(bolso\s*bosta|bolsobosta|bostanaro|bolsonazi|bolsolixo|bolsomerda|bozo|capitao\s+cloroquina|milician[oa])\b/i;

/**
 * **Falar mal do PL ou do Republicanos é hostilidade CONTRA NÓS** — regra dele (08/09/2026):
 * *"falar mal do pl ou republicanos é hostilidade contra nós, falar mal de pt está do nosso lado"*.
 *
 * É a mesma natureza do `INSULTO_AO_ALIADO` e vale pelo mesmo motivo: **não é ambíguo de direção.**
 * A lista `AGRESSAO` sozinha é, e por isso ela exige segunda pessoa — apoiador xinga o adversário o
 * dia inteiro, e é a mensagem mais comum desta base. Aqui o alvo está escrito.
 *
 * **A segunda metade da regra dele é a guarda desta:** xingar o PT continua sendo apoio, e o
 * caminho normal já cuidava disso (insulto em terceira pessoa, sem segunda pessoa, devolve null).
 * O que este bloco não pode fazer é quebrar isso — e quebra fácil, porque as duas siglas aparecem na
 * MESMA frase o tempo todo (*"o PL é bem melhor que o PT, que é um bando de ladrões"*). Daí o
 * `SEM_ADVERSARIO_NO_MEIO`: entre a nossa sigla e o xingamento não pode haver o nome do outro lado.
 *
 * A janela é curta (30 caracteres) porque o que qualifica é o insulto estar **colado** na sigla, e
 * não apenas conviver com ela na mesma mensagem.
 *
 * `\bpl\b` é a peça arriscada — *"sou PL desde que foi criado"* é fala comum aqui —, e o que a
 * segura é a exigência do xingamento ao lado. Custo de errar: etiqueta permanente no CRM de um
 * apoiador, que é o preço mais alto deste arquivo.
 */
const NOSSO_PARTIDO = '(pl|partido\\s+liberal|republicanos|republicano)';
const ADVERSARIO = /\b(pt|petista|lula|psol|pc\s*do\s*b|pdt|pcb|comunist[ao]s?|esquerd)/i;

const INSULTO_AO_NOSSO_PARTIDO = [
  new RegExp(`\\b${NOSSO_PARTIDO}\\b(?<meio>[^.!?]{0,30}?)${AGRESSAO.source.replace(/\\b/g, '')}`, 'i'),
  /**
   * A ordem inversa (*"esse bando de safados do PL"*) precisa olhar **antes** do xingamento, e não
   * só entre ele e a sigla: *"comunista é ladrão, PL nunca"* casava — o adversário está na frente do
   * insulto, e o meio (", ") estava limpo. Foi o único falso positivo da medição.
   */
  new RegExp(
    `(?<antes>[^.!?]{0,25})${AGRESSAO.source.replace(/\\b/g, '')}(?<meio>[^.!?]{0,30}?)\\b${NOSSO_PARTIDO}\\b`,
    'i'
  ),
];

function insultouNossoPartido(norm) {
  for (const re of INSULTO_AO_NOSSO_PARTIDO) {
    const m = re.exec(norm);
    // Sem esta limpeza, "o PL é melhor que o PT, um bando de ladrões" viraria hostilidade — e é
    // exatamente o oposto do que ele disse.
    if (m && !ADVERSARIO.test(m.groups?.meio || '') && !ADVERSARIO.test(m.groups?.antes || '')) return true;
  }
  return false;
}

/**
 * O contato não tem interesse — ou recusou, ou veio hostilizar.
 *
 * Pedido dele (01/09/2026): *"falando mal do bolsonaro e martim é aliado do bolsonaro, esse tipo
 * nós botamos etiqueta sem interesse e concluímos sem responder"*, depois de a rodada pedir dados
 * a dois contatos sem interesse.
 *
 * **Dois caminhos, e os dois exigem sinal forte:**
 *
 * 1. **Recusa** — pedido explícito de não ser mais chamado, ou negativa na abertura da mensagem
 *    que não seja uma das benignas. A negativa de abertura só vale sozinha porque a pergunta que
 *    fizemos era fechada ("posso te mandar os conteúdos?").
 * 2. **Hostilidade dirigida a nós** — insulto **junto** de fala em segunda pessoa. As duas
 *    condições são obrigatórias: apoiador insulta o adversário em terceira pessoa toda hora, e
 *    tratar isso como recusa tiraria da fila justamente quem mais apoia.
 *
 * Olha só a ÚLTIMA mensagem: quem recusou depois de conversar recusou agora, e quem xingou ontem
 * e voltou hoje pedindo conteúdo mudou de ideia.
 *
 * @param {Array<{texto?:string, tipo?:string}>} entrantes
 * @returns {{motivo:string}|null}
 */
export function semInteresse(entrantes, nossaUltimaAt) {
  /**
   * **A RAJADA, e não só a última mensagem** — anotação da susana (03/09/2026), a segunda vez que
   * ela apareceu: *"segunda vez que ela vem e eu já tinha especificado que era hostil, por que não
   * gravou?"*.
   *
   * Ela escreveu *"E o bolso bosta o que cumpriu"*, *"Nunca ouvi falar do sr"* e, por último,
   * *"9"*. Lendo só a última mensagem com texto, o insulto duas mensagens acima era invisível — e
   * a caixa recomendou responder à mão.
   *
   * **Foi um teste meu que passou enquanto a produção falhava:** eu havia travado "bolso bosta"
   * com uma mensagem só, que é exatamente a forma que a função enxergava. O caso real vem em
   * rajada, e é assim que todos os outros detectores deste arquivo já leem.
   *
   * Cada mensagem é testada INTEIRA e sozinha, com todas as guardas: a recusa de presença, a
   * negativa benigna e a exigência de segunda pessoa continuam valendo mensagem a mensagem. O que
   * mudou é quantas ela olha.
   */
  const rajada = rajadaFinal(entrantes, nossaUltimaAt);
  const lista = rajada.length ? rajada : (Array.isArray(entrantes) ? entrantes : []);
  /**
   * **Transcrição de áudio NÃO decide "sem interesse"** — anotação do lopezp4295 (03/09/2026):
   * *"transcrição para ser respondida por mim ou IA"*.
   *
   * Esta é a regra mais destrutiva do arquivo: aplica etiqueta **permanente** no CRM e conclui **em
   * silêncio**. Fala passada por reconhecimento automático é o pior insumo possível para isso — vem
   * cheia de repetição e de "não" solto (*"eu não tenho, eu não tenho, né, nenhum…"*), e a pessoa
   * da anotação dizia, na MESMA mensagem, *"mas eu vou ir votar, sim"*.
   *
   * É a disciplina que o parser já segue desde 31/08: transcrição entra rebaixada e nunca grava
   * sozinha. Aqui o rebaixamento é total — ela não conta, e o áudio vira caso de
   * `ultima-pede-resposta-pessoal`, que é dele ou da IA. **Recusa de verdade a pessoa escreve.**
   */
  const comTexto = lista.filter((m) => String(m?.texto || '').trim() && !m?.transcrito);
  if (!comTexto.length) return null;

  /**
   * **Da mais recente para a mais antiga, e uma retratação MAIS NOVA cancela.**
   *
   * A assercão que existia — *"quem xingou ontem e hoje voltou pedindo conteúdo mudou de ideia"* —
   * continua valendo, e é ela que impede a leitura da rajada de virar rancor. O que a substitui não
   * é a POSIÇÃO da mensagem, é o que ela diz: pedir material ou dizer que está junto é retratação;
   * um *"9"* solto não é.
   *
   * Por isso o laço para na primeira coisa que encontra, seja ela retratação ou recusa: a fala mais
   * recente é que vale, e as duas são falas.
   */
  for (let i = comTexto.length - 1; i >= 0; i -= 1) {
    const texto = String(comTexto[i]?.texto || '');
    // A recusa é testada ANTES da retratação: "não quero receber nada" tem "receber" dentro, e
    // pela ordem inversa a própria recusa se cancelava. Medido — três asserções caíram de uma vez.
    const achado = umaMensagemRecusa(comTexto[i]);
    if (achado) return achado;
    if (PEDIDO_DE_MATERIAL.test(texto) || EXPRESSOES_DE_APOIO.some((padrao) => padrao.test(texto))) return null;
  }
  return null;
}

/** Uma mensagem só, com todas as guardas — é aqui que mora a regra. */
function umaMensagemRecusa(msg) {
  const texto = String(msg?.texto || '');
  const norm = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!norm) return null;

  if (RECUSA.test(norm) && !NEGATIVA_BENIGNA.test(norm)) {
    return { motivo: 'pediu para não receber mais' };
  }

  /**
   * **Recusar o EVENTO não é recusar o contato** — e confundir os dois foi regressão minha,
   * no mesmo dia (01/09/2026).
   *
   * Print do Ze: veio do anúncio do evento e respondeu *"Não conseguirei ir!"*. Como esta regra é
   * a primeira da tabela, ela venceu `confirmaPresenca` (que acertava, devolvendo `nao`), etiquetou
   * como sem interesse e concluiu **em silêncio**. Era a pessoa mais engajada possível — veio do
   * anúncio E se deu o trabalho de responder — e o certo era dizer que não tem problema e pedir os
   * dados (tecla 4, que já existe para isso).
   *
   * Vem DEPOIS da recusa explícita de propósito: *"não vou mais receber isso, me tira da lista"*
   * tem verbo de ir dentro e continua sendo recusa de contato.
   */
  if (RECUSA_DE_PRESENCA.test(norm)) return null;

  /**
   * O apelido pejorativo do ALIADO vale sozinho — ver `INSULTO_AO_ALIADO`. Fica DEPOIS da recusa
   * de presença: quem diz que não pode ir ao evento e xinga na mesma mensagem é caso raro, e o
   * lado seguro é o que ele já decidiu para o evento.
   */
  if (INSULTO_AO_ALIADO.test(norm)) return { motivo: 'chamou nosso aliado por apelido pejorativo — não é público do mandato' };

  /**
   * Xingou o PL ou o Republicanos — ver `INSULTO_AO_NOSSO_PARTIDO`. Vale sozinho, como o apelido do
   * aliado: o alvo está escrito, então não há ambiguidade de direção para resolver.
   */
  if (insultouNossoPartido(norm)) {
    return { motivo: 'falou mal do nosso partido — não é público do mandato' };
  }

  // O número do adversário, declarado — ver `VOTO_NO_ADVERSARIO`.
  if (VOTO_NO_ADVERSARIO.some((re) => re.test(norm))) {
    return { motivo: 'declarou voto no adversário — não é público do mandato' };
  }

  /**
   * O imperativo conta como segunda pessoa — ver `XINGAMENTO_IMPERATIVO`. Sozinho, só quando é a
   * mensagem inteira: o que sobra depois dele tem que caber numa pontuação.
   */
  const mandouEmbora = XINGAMENTO_IMPERATIVO.test(norm);
  const soOImperativo =
    mandouEmbora && norm.replace(XINGAMENTO_IMPERATIVO, ' ').replace(/[^\p{L}\p{N}]+/gu, '').length === 0;

  const agride = AGRESSAO.test(norm) && (DIRIGIDA_A_NOS.test(norm) || mandouEmbora);
  if (agride || soOImperativo) return { motivo: 'veio hostilizar, não é público do mandato' };

  const negativaVale = norm.trim().length <= NEGATIVA_CURTA || NEGACAO_COM_OBJETO.test(norm);
  if (COMECA_NEGANDO.test(norm) && negativaVale && !NEGATIVA_BENIGNA.test(norm)) {
    // A negativa de abertura vale porque a pergunta era fechada. Se ela vier junto de agressão, o
    // motivo é o mais forte dos dois — é o que aparece na tela e no log.
    return { motivo: AGRESSAO.test(norm) ? 'respondeu que não e veio hostilizar' : 'respondeu que não tem interesse' };
  }

  return null;
}

/**
 * **As mensagens dela que vieram DEPOIS de uma mensagem nossa específica.**
 *
 * Devolve o array (nunca vazio) ou `null`. `reconhecer` é quem diz qual mensagem nossa interessa —
 * uma função, para este módulo continuar sem depender de `templates.js`.
 *
 * **Casa por INVARIANTE, não pelo texto atual**, porque quem chama passa `templates.ehPedidoDeDados`
 * ou `ehPerguntaComoAjudar`: comparar com o texto de hoje só enxergaria as conversas que saíram com
 * a redação de hoje, e este projeto reescreve resposta com frequência — cada reescrita deixaria uma
 * safra de conversas invisíveis. Foi assim que a Loreta recebeu a mensagem errada em 31/08.
 *
 * Sem hora na nossa mensagem, considera todas as dela: é o caso do histórico antigo, e supor que
 * nada veio depois seria pior — ela teria respondido e ninguém veria.
 */
export function respostasApos(entrantes, nossas, reconhecer) {
  const nossa = [...(nossas || [])].reverse().find((m) => reconhecer(String(m?.texto || '')));
  if (!nossa) return null;

  const comTexto = (entrantes || []).filter((m) => String(m?.texto || '').trim());
  if (!comTexto.length) return null;

  if (!nossa.at) return comTexto;

  const depois = comTexto.filter((m) => m.at && new Date(m.at) > new Date(nossa.at));
  return depois.length ? depois : null;
}
