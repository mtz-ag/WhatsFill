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

  if (TIPOS_QUE_PEDEM_VOCE.has(tipo) && !temTranscricao) {
    const comoChama = NOME_DO_TIPO[tipo] || 'um arquivo';
    return { motivo: `mandou ${comoChama} — só dá para responder depois de abrir` };
  }
  if (texto.trim().length >= TEXTO_LONGO) {
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
export function conversaPedeRespostaPessoal(entrantes, nossaUltimaAt) {
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

  const total = rajada.reduce((n, m) => n + String(m?.texto || '').trim().length, 0);
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
const PERGUNTAS_QUE_PEDEM_VOCE = [
  // Razão: "por que não tem propaganda aqui?"
  /(^|[^\p{L}])(por\s?qu[eê]|pq|pk)(\s|\?|$)/iu,
  // Posição e opinião: dependem do que ELE pensa
  /(^|[^\p{L}])qual\s+(a\s+)?(posi[çc][aã]o|opini[aã]o|proposta|ideia)/iu,
  /(^|[^\p{L}])o\s+que\s+(ele|voc[eê]s?|o\s+candidato|o\s+deputado)\s+(acha|acham|pensa|pensam|vai|v[aã]o|pretende|pretendem|faria|fariam|far[aá]|far[aã]o)/iu,
  /(^|[^\p{L}])como\s+(ele|voc[eê]s?)\s+(vai|v[aã]o|pretende|pretendem|pensa|pensam)/iu,
  // Pedido explícito de explicação
  /(^|[^\p{L}])(me\s+)?explica(r|\s|$)/iu,
  /(^|[^\p{L}])n[aã]o\s+entendi(\s|$|\.)/iu,
];

/** Pede material/conteúdo — aí a pergunta TEM resposta pronta e não é caso de resposta à mão. */
const PEDIDO_DE_MATERIAL = /(^|[^\p{L}])(manda|mande|envia|envie|me\s+passa|quero\s+receber|receber)(\s|$)/iu;

/**
 * Jeitos de dizer "estou com você". Lista de reconhecimento, não de julgamento: o que ela
 * decide é se cabe um agradecimento, e agradecer errado custa pouco.
 */
const EXPRESSOES_DE_APOIO = [
  /(^|[^\p{L}])(eu\s+)?apoio(\s|$|,|!|\.)/iu
,
  // `\s*` e não `\s+`: "Tamojuntos" vem colado, e foi assim que ele apareceu na print.
  /(^|[^\p{L}])(tamo|tamos|t[oô]|estou|estamos|seguimos|segue)\s*(com|junto|juntos)\b/iu,
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
  /(^|[^\p{L}])(vou|vamos)\s+votar(\s|$)/iu,
  /(^|[^\p{L}])sou\s+(seu\s+)?(eleitor|eleitora|f[aã]|bolsonarist[ao]|bolsonaro)(\s|$)/iu,
  /(^|[^\p{L}])(parab[eé]ns|sucesso|for[çc]a|felicidades)(\s|$|!|,|\.)/iu,
  /(^|[^\p{L}])(deus|jesus)\s+(te|o|a|lhe)\s+(aben[çc]oe|guarde|proteja)/iu,
  /(^|[^\p{L}])torcendo(\s|$)/iu,
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
    /(^|[^\p{L}])(estarei|estaremos)(\s+(la|ai|presente|junto|com\s+voces))?(\s|$|!|,|\.)/u,
    /(^|[^\p{L}])(confirmado|confirmada|confirmo|presenca\s+confirmada)/u,
    /(^|[^\p{L}])(pode|podem)\s+contar\s+comigo/u,
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
const PRECISA_DE_ALGO = [
  // "preciso da sua força", "preciso da forca do senhor", "preciso de uma ajuda"
  /(^|[^\p{L}])(preciso|precisava|precisando|necessito)\s+(de\s+|da\s+|do\s+|duma\s+|dum\s+)/iu,
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
  /\bdinheiro\b/i,
  /\bgrana\b/i,
  /\bempr[ée]stimo\b/i,
  /\bdoa[çc][ãa]o\b/i,
];

/**
 * Coisas que se pede quando falta o básico. Sozinhas não bastam — "tomei meu remédio" não é pedido.
 * Só valem junto de um verbo de pedir, que é o que separa relatar de pedir.
 */
const NECESSIDADES = [/\bcesta\s*b[áa]sica\b/i, /\brem[ée]dio?s?\b/i, /\bmedicamento?s?\b/i, /\bg[áa]s\b/i, /\balimento?s?\b/i];

const VERBO_DE_PEDIR = /\b(preciso|precisava|necessito|me\s+ajud|ajuda\s*r?\s*me|pode(?:ria|m)?\s+(?:me\s+)?ajudar|consegue|tem\s+como|manda|envia|faz\s+um)\b/i;

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
    for (const padrao of NECESSIDADES) {
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
  /(^|[^\p{L}])trabalhar\s+(para|pra|com|no|na)\s+(voce|voces|vc|vcs|ti|o\s+mandato|o\s+gabinete|a\s+campanha)/u,
  /(^|[^\p{L}])(preciso|procuro|procurando|quero|queria|busco)\s+.{0,15}?(emprego|trabalho|vaga)/u,
  /(^|[^\p{L}])(arrumar|conseguir|indicar|arruma|consegue|indica)\s+.{0,15}?(emprego|vaga|trabalho)/u,
  /(^|[^\p{L}])(alguma|tem|teria|tem\s+alguma)\s+vaga/u,
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
    const texto = String(msg?.texto || '').trim();
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

    for (const padrao of PERGUNTAS_QUE_PEDEM_VOCE) {
      const achou = texto.match(padrao);
      if (!achou) continue;

      // `index` do casamento: 0 (ou 1, quando o padrão consome o espaço à esquerda) = começo.
      const noComeco = achou.index <= 1;
      if (temInterrogacao || noComeco) {
        return { motivo: 'fez uma pergunta que nenhuma resposta pronta responde' };
      }
    }
  }
  return null;
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
const RECUSA_EXPLICITA =
  /\bnao (quero|tenho|desejo|preciso|me interess)/i.source +
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
  /\bnao (sei|lembro|faco parte|participo|estou em|tenho grupo|tenho whats|moro|sou de|consigo|entendi)\b|\bnenhum grupo\b|\bnao tenho nenhum\b/i;

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
 * Palavras que ninguém usa para falar COM quem apoia.
 *
 * Não entram sozinhas: insulto solto é ambíguo de direção. Apoiador chama o adversário de ladrão
 * e de golpista o dia inteiro, e isso não é hostilidade **contra nós**.
 */
// O `s?` no fim é obrigatório: sem ele "vocês são uns idiotas mentirosos" passava batido, porque
// `\b` depois de "idiota" não casa com "idiotas". Xingamento vem no plural com frequência.
const AGRESSAO =
  /\b(mentiros[oa]|idiota|imbecil|burr[oa]|lesma|otari[oa]|vagabund[oa]|corrupt[oa]|ladr(ao|a|oes)|safad[oa]|nojent[oa]|palhac[oa]|lixo|verme|fascista|golpista|presidiari[oa]|genocida|cretin[oa]|babaca)s?\b/i;

/**
 * Fala dirigida a NÓS. É o que separa "vocês são mentirosos" de "o adversário é mentiroso".
 *
 * A direção é tudo aqui. Sem ela, a mensagem de um apoiador xingando o adversário — que é o tipo
 * mais comum de mensagem nesta base — seria etiquetada como sem interesse e sairia da fila.
 */
const DIRIGIDA_A_NOS = /\b(voces|voce|vocês|tu|es igual|teu|tua|seu candidato|sua campanha|de voces)\b/i;

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
export function semInteresse(entrantes) {
  const lista = Array.isArray(entrantes) ? entrantes : [];
  const ultima = [...lista].reverse().find((m) => String(m?.texto || '').trim());
  if (!ultima) return null;

  const texto = String(ultima.texto || '');
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

  const agride = AGRESSAO.test(norm) && DIRIGIDA_A_NOS.test(norm);
  if (agride) return { motivo: 'veio hostilizar, não é público do mandato' };

  if (COMECA_NEGANDO.test(norm) && !NEGATIVA_BENIGNA.test(norm)) {
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
