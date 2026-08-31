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
const TIPOS_DE_IMAGEM = new Set(['IMAGE', 'STICKER']);

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
  if (TIPOS_DE_IMAGEM.has(tipo) && !texto.trim()) return true;
  if (TIPOS_DE_IMAGEM.has(tipo)) return !restoDaMensagem(texto);

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

  if (TIPOS_DE_IMAGEM.has(tipo)) return !texto.trim() || !restoDaMensagem(texto);
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
 * Vocabulário do lugar, não de manual: *"é nós"*, *"tamo junto"*, *"estamos juntos"*, *"abraço"*,
 * *"valeu"*, *"tmj"*. É despedida de apoiador, e a resposta certa a ela é fechar o atendimento —
 * não mandar mais uma mensagem.
 */
/**
 * `(^|\s)` em vez de `\b` antes de palavra acentuada.
 *
 * `\b` é fronteira de `\w`, e `é` não é `\w`: `/\bé nós/` **nunca** casa no começo da string.
 * Foi assim que "É nós." — a frase exata da print dele — passou batido na primeira versão.
 */
const DESPEDIDA =
  /(^|\s)(e|é)\s*n(ó|o)(s|is)\b|\b(tamo|tamos|estamos|seguimos|segue|to|tô|estou)\s*(junto|juntos)\b|\btmj\b|\b(forte\s*)?abra(ç|c)o(s)?\b|\bvaleu\b|\bvlw\b|\bobrigad[oa]\b|\bbrigad[oa]\b|(^|\s)am(é|e)m\b|\bboa\s*sorte\b|\bdeus\s*(te\s*)?aben(ç|c)oe\b|\bfica\s*com\s*deus\b|\bsucesso\b/i;

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

/** Tipos que sempre pedem você em pessoa: não dá para responder sem ouvir. */
const TIPOS_QUE_PEDEM_VOCE = new Set(['AUDIO', 'VIDEO', 'DOCUMENT', 'CONTACT', 'LOCATION']);

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

  if (TIPOS_QUE_PEDEM_VOCE.has(tipo)) {
    const comoChama = tipo === 'AUDIO' ? 'um áudio' : tipo === 'VIDEO' ? 'um vídeo' : 'um arquivo';
    return { motivo: `mandou ${comoChama} — só dá para responder depois de abrir` };
  }
  if (texto.trim().length >= TEXTO_LONGO) {
    return { motivo: `escreveu ${texto.trim().length} caracteres — é conversa, não é caso de modelo` };
  }
  return null;
}

/**
 * As mensagens que chegaram DEPOIS da nossa última — a conversa que está pendente.
 *
 * Sem `nossaUltimaAt` (nunca respondemos este contato), a rajada é tudo o que ele escreveu:
 * está certo, porque nada foi respondido ainda.
 *
 * Mensagem sem `at` entra na rajada. É o lado seguro de errar aqui — pôr de fora faria a soma
 * baixar e o modelo voltar a ser sugerido, que é exatamente o defeito que isto conserta.
 */
export function rajadaFinal(entrantes, nossaUltimaAt) {
  const lista = Array.isArray(entrantes) ? entrantes : [];
  if (!nossaUltimaAt) return lista;
  const corte = new Date(nossaUltimaAt).getTime();
  if (!Number.isFinite(corte)) return lista;

  const depois = [];
  for (let i = lista.length - 1; i >= 0; i--) {
    const at = lista[i]?.at ? new Date(lista[i].at).getTime() : NaN;
    if (Number.isFinite(at) && at <= corte) break;
    depois.unshift(lista[i]);
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

  // Tipo vence tamanho: não dá para responder um áudio sem abrir, venha ele sozinho ou não.
  for (const msg of rajada) {
    const porTipo = pedeRespostaPessoal({ tipo: msg?.tipo });
    if (porTipo) return porTipo;
  }

  const total = rajada.reduce((n, m) => n + String(m?.texto || '').trim().length, 0);
  if (total >= TEXTO_LONGO) {
    return rajada.length > 1
      ? { motivo: `escreveu ${rajada.length} mensagens somando ${total} caracteres — é conversa, não é caso de modelo` }
      : { motivo: `escreveu ${total} caracteres — é conversa, não é caso de modelo` };
  }
  return null;
}

/**
 * A última mensagem do contato pede resposta escrita por você?
 *
 * Mantida porque é pura e testada, e porque `conversaPedeRespostaPessoal` a usa por dentro para
 * o teste de TIPO. Para decidir a rodada, use a outra: esta não vê a rajada.
 */
export function ultimaPedeRespostaPessoal(entrantes) {
  const lista = Array.isArray(entrantes) ? entrantes : [];
  if (!lista.length) return null;
  return pedeRespostaPessoal(lista[lista.length - 1]);
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

  const temImagem = lista.some((m) => TIPOS_DE_IMAGEM.has(String(m?.tipo || '').toUpperCase()));
  const temLink = lista.some((m) => LINK.test(String(m?.texto || '')));
  const temSaudacao = lista.some((m) => SAUDACAO.test(String(m?.texto || '')));

  const partes = [];
  if (temSaudacao) partes.push('cumprimentou');
  if (temLink) partes.push('mandou um link');
  if (temImagem) partes.push('mandou uma figura');

  return { motivo: partes.join(' e ') || 'só cortesia' };
}
