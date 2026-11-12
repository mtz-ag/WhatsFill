/**
 * post-encaminhado.js — o POST que ela encaminhou não é texto dela (12/11/2026, a Suely).
 *
 * Ela repassou 1.952 caracteres de um senador: título em negrito, o texto, a assinatura dele, o
 * link do Instagram e *"Faça parte do meu canal do WhatsApp"*. A caixa mandou responder à mão —
 * *"escreveu 1952 caracteres — é conversa"* —, porque `conversaPedeRespostaPessoal` mede TAMANHO, e
 * tamanho de post copiado não é quanto ELA falou.
 *
 * **Regra dele, por tipo:**
 *  - **político** → rascunho da IA, na primeira pessoa do candidato, que se posiciona sobre o tema
 *    sem resumir o texto e sem citar o autor (`TOM_POST_POLITICO`);
 *  - **comercial** (curso de Black Friday com telefone) → conclui sem enviar nada.
 *
 * **O que fica FORA, e é a guarda que mais importa:** texto longo ESCRITO por ela, com pedido ou
 * pergunta (*"preciso de ajuda com a minha aposentadoria..."*), continua sendo "Responda à mão". A
 * diferença não está no tamanho: está nas marcas de post (assinatura de outra pessoa, chamada de
 * canal, link de rede social, negrito de publicação). Uma marca só não basta — negrito e um link
 * aparecem em mensagem própria; **são duas, no mínimo**.
 *
 * Puro e sem dependência, como os `tom-*.js`: quem decide é `cortesia.postEncaminhado` (a rodada)
 * e `ia-cliente` (o tom do rascunho).
 */

const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Post é texto longo. Abaixo disto é recado, e recado tem os caminhos de sempre. */
export const TAMANHO_MINIMO_DE_POST = 200;

/** Negrito do WhatsApp: título de publicação (`*MIL DIAS DE INJUSTIÇA!*`). */
const NEGRITO = /\*[^*\n]{3,}\*/;

/** Chamada de canal, de perfil ou de corrente — quem escreve isso é quem PUBLICA, não quem lê. */
const CHAMADA_DE_CANAL =
  /\b(?:faca parte d[oa] (?:meu|nosso|minha|nossa) (?:canal|grupo|comunidade)|(?:entre|entrem|participe|participem) (?:n[oa]|d[oa]|para o) (?:meu|nosso) (?:canal|grupo)|me sigam?|sigam?(?: (?:o|a))? (?:meu|minha|nosso|nossa) (?:canal|perfil|pagina|instagram)|siga(?:m)? (?:no|nas) (?:instagram|redes)|compartilh(?:e|em) (?:com|esta|essa|este|esse|para|nos|ao maximo)|curtam?,? comente|curta e compartilhe|inscreva-se|ative o sininho|link na bio|repasse (?:para|a) todos|encaminhe (?:para|a) todos)\b/;

/** Link de rede social ou de canal: endereço de publicação, não de conversa. */
const LINK_DE_REDE =
  /(?:instagram\.com|whatsapp\.com\/channel|chat\.whatsapp\.com|threads\.(?:net|com)|(?:^|[^a-z0-9.])x\.com\/|twitter\.com|facebook\.com|fb\.watch|fb\.me|youtube\.com|youtu\.be|(?:^|[^a-z0-9.])t\.me\/|tiktok\.com|kwai)/;

/** Título de quem assina: a linha curta que diz QUEM publicou. */
const TITULO_DE_QUEM_ASSINA =
  /^(?:[-—–]\s*)?(?:senador[a]?|deputad[oa](?: federal| estadual)?|vereador[a]?|prefeit[oa]|governador[a]?|ministr[oa]|pastor[a]?|padre|bispo|dr\.?|dra\.?|jornalista|professor[a]?|coronel|general|delegad[oa]|presidente)\b/i;

/** Pedido DELA, dirigido a nós. Com ele o texto é conversa, por mais que pareça post. */
const PEDIDO_DELA =
  /\b(?:preciso de (?:ajuda|voces|um favor|uma ajuda)|me ajud\w*|(?:voces|o senhor|vc|vcs|voce) (?:pode|podem|poderia|poderiam|consegue|conseguem)|gostaria de (?:saber|pedir)|queria (?:saber|pedir)|estou precisando|to precisando)\b/;

/** Marcas de propaganda comercial. Distintas: "desconto" duas vezes conta uma. */
const COMERCIAL = [
  /\bblack ?friday\b/, /\bpromoc\w*/, /\bdesconto\w*/, /\d+\s*%\s*(?:off|de desconto)?/, /\bcursos?\b/,
  /\bmatricul\w*/, /\bvagas? limitad\w*/, /\bultimas vagas\b/, /\bparcel\w*/, /\bsem juros\b/,
  /\bfrete\b/, /\boferta\w*/, /\bgaranta\b/, /\baproveite\b/, /\bcompre\b/, /\bloja\b/,
  /r\$\s*\d/, /\(?\b\d{2}\)?\s*9?\d{4}[-\s]?\d{4}\b/, /\bcertificado\b/, /\bpreco\b/,
];

/** Marcas de conteúdo político. Distintas, como as comerciais. */
const POLITICO = [
  /\binjustic\w*/, /\bjustica\b/, /\bliberdade\b/, /\bconstituic\w*/, /\bdemocraci\w*/, /\bditadur\w*/,
  /\bcensura\b/, /\banistia\b/, /\bpres[oa]s? politic\w*/, /\bpersegui\w*/, /\bstf\b/, /\bmoraes\b/,
  /\bsenad\w*/, /\bdeputad\w*/, /\bcongresso\b/, /\bgoverno\b/, /\blula\b/, /\bpt\b/, /\bpetist\w*/,
  /\bbolsonar\w*/, /\besquerd\w*/, /\bdireita\b/, /\bcomunis\w*/, /\bpatriot\w*/, /\belei[cç]\w*/,
  /\bcorrup\w*/, /\bimpost\w*/, /\bpresidente\b/, /\bministr\w*/, /\bpolitic\w*/, /\bnacao\b/,
];

const contar = (lista, t) => lista.filter((re) => re.test(t)).length;

/** A linha da assinatura, se houver — o nome de quem publicou, para a IA não o citar. */
export function assinaturaDoPost(texto) {
  for (const linha of String(texto || '').split('\n')) {
    const l = linha.replace(/\*/g, '').trim();
    if (!l || l.length > 70) continue;
    const palavras = l.split(/\s+/).length;
    if (palavras < 2 || palavras > 8) continue;
    if (TITULO_DE_QUEM_ASSINA.test(l) && /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(l.replace(TITULO_DE_QUEM_ASSINA, '').trim().slice(0, 1))) {
      return l.replace(/^[-—–]\s*/, '');
    }
  }
  return '';
}

/**
 * Esta mensagem é um POST encaminhado? Devolve as marcas e o tipo, ou `null`.
 *
 * `nomeDoContato` tira a assinatura que é o PRÓPRIO nome dela (quem assina o que escreve não está
 * encaminhando nada).
 */
export function ehPostEncaminhado(msg, nomeDoContato = '') {
  if (!msg || msg.de === 'nos' || msg.sistema || msg.anuncio || msg.geradaPeloAnuncio) return null;
  const bruto = String(msg.texto || '');
  if (bruto.trim().length < TAMANHO_MINIMO_DE_POST) return null;
  const t = normalizar(bruto);
  if (PEDIDO_DELA.test(t)) return null;

  let assinatura = assinaturaDoPost(bruto);
  const primeiro = normalizar(nomeDoContato).split(/\s+/)[0] || '';
  if (assinatura && primeiro.length >= 3 && normalizar(assinatura).includes(primeiro)) assinatura = '';

  const marcas = [];
  if (msg.encaminhado || msg.repassado) marcas.push('encaminhada', 'encaminhada');
  if (assinatura) marcas.push('assinatura de outra pessoa');
  if (CHAMADA_DE_CANAL.test(t)) marcas.push('chamada de canal');
  if (LINK_DE_REDE.test(t)) marcas.push('link de rede social');
  if (NEGRITO.test(bruto)) marcas.push('negrito de publicação');
  if (marcas.length < 2) return null;

  const comercial = contar(COMERCIAL, t);
  const politico = contar(POLITICO, t);
  let tipo = '';
  if (comercial >= 2 && comercial > politico) tipo = 'comercial';
  else if (politico >= 2) tipo = 'politico';
  if (!tipo) return null;
  return { tipo, marcas: [...new Set(marcas)], assinatura };
}

/**
 * O que veio depois da NOSSA última fala é um post encaminhado, e nada além dele pede resposta?
 *
 * Recebe a conversa como a IA a recebe (`{de, texto, tipo}`) ou as mensagens dela do painel. Junto
 * do post só passam repasse (link, vídeo, figura) e recado curto sem pergunta nem pedido (*"olha
 * isso"*, *"bom dia"*). Áudio sem transcrição, arquivo ou fala dela com pedido devolvem `ativo:
 * false`: ali há o que responder, e quem responde continua sendo você.
 */
export function contextoPostEncaminhado(mensagens = [], nomeDoContato = '') {
  const lista = (mensagens || []).map((m) => (typeof m === 'string' ? { de: 'contato', texto: m } : m)).filter(Boolean);
  let inicio = 0;
  lista.forEach((m, i) => { if (m?.de === 'nos') inicio = i + 1; });
  const pendentes = lista.slice(inicio).filter((m) => m.de !== 'nos' && !m.sistema && !m.anuncio && !m.geradaPeloAnuncio);
  const vazio = { ativo: false, tipo: '', assinatura: '', marcas: [] };
  if (!pendentes.length) return vazio;

  const posts = [];
  for (const m of pendentes) {
    const tipoMidia = String(m.tipo || 'TEXT').toUpperCase();
    const texto = String(m.texto || '').trim();
    const post = ehPostEncaminhado(m, nomeDoContato);
    if (post) { posts.push(post); continue; }
    if (['IMAGE', 'STICKER', 'VIDEO'].includes(tipoMidia)) continue;
    if (['AUDIO', 'DOCUMENT', 'CONTACT', 'LOCATION'].includes(tipoMidia) && !(m.transcrito && texto)) return vazio;
    if (!texto) continue;
    const t = normalizar(texto);
    const soLink = !t.replace(/https?:\/\/\S+|\bwww\.\S+/g, ' ').trim();
    if (soLink) continue;
    if (texto.length > 80 || t.includes('?') || PEDIDO_DELA.test(t)) return vazio;
  }
  if (!posts.length) return vazio;
  // Um post comercial no meio de político, ou o contrário: decide o político (ela repassou política).
  const tipo = posts.some((p) => p.tipo === 'politico') ? 'politico' : 'comercial';
  const doTipo = posts.filter((p) => p.tipo === tipo);
  return {
    ativo: true,
    tipo,
    assinatura: doTipo.map((p) => p.assinatura).find(Boolean) || '',
    marcas: [...new Set(doTipo.flatMap((p) => p.marcas))],
  };
}

export const TOM_POST_POLITICO =
  'POST POLÍTICO ENCAMINHADO: o texto longo acima é uma publicação de OUTRA pessoa que ela repassou ' +
  '(assinatura, chamada de canal, link de rede social) — não é fala dela, e ela não está pedindo nada. ' +
  'Responda como quem leu e se posiciona: UMA ou DUAS frases na primeira pessoa do candidato, com a ' +
  'indignação ou o apoio que o tema pede ("A justiça precisa prevalecer e a Constituição tem que valer ' +
  'para todos. Sigo firme na defesa da liberdade."). NÃO resuma o texto, NÃO repita números, nomes ou ' +
  'fatos dele, NÃO cite quem assinou e NÃO use o nome dela. Sem pergunta, sem "equipe", sem beijo, sem ' +
  'pedir nome ou cidade. Abra com a saudação do horário — ou sem saudação, se já falamos com ela hoje — ' +
  'e feche agradecendo por compartilhar, com "um grande abraço". Exemplo do jeito: "Boa tarde! A justiça ' +
  'precisa prevalecer e a Constituição tem que valer para todos. Sigo firme na defesa da liberdade. ' +
  'Obrigado por compartilhar, um grande abraço!" No máximo 4 frases.';

/** O rascunho cumpriu o POST POLÍTICO? Devolve o que falhou, para a reescrita que já existe. */
export function falhasTomPost(texto, contexto) {
  if (!contexto?.ativo || contexto.tipo !== 'politico') return [];
  const t = normalizar(texto);
  const falhas = [];
  if (t.includes('?')) falhas.push('não faça pergunta');
  if (/\bequipe\b/.test(t)) falhas.push('não fale em "equipe"');
  if (/\b(?:beij\w*|bjs?|bjos?)\b/.test(t)) falhas.push('sem beijo');
  if (!/\babraco\b/.test(t)) falhas.push('feche com "um grande abraço"');
  if (!/\b(?:obrigad[oa]|agradec\w*)\b/.test(t)) falhas.push('agradeça por compartilhar');
  if (!/\b(?:sigo|seguimos|seguirei|defendo|acredito|concordo|estou|continuo|luto|lutarei|vou seguir|me posiciono|nao aceito)\b/.test(t)) {
    falhas.push('falta posição na primeira pessoa do candidato');
  }
  if (/\b(?:o texto|o post|a publicacao|a postagem|segundo (?:o|a)|como (?:disse|diz|escreveu) (?:o|a))\b/.test(t)) {
    falhas.push('não resuma nem comente o texto encaminhado');
  }
  const assinatura = normalizar(contexto.assinatura).replace(TITULO_DE_QUEM_ASSINA, '').trim();
  const sobrenome = assinatura.split(/\s+/).filter((p) => p.length >= 4).pop() || '';
  if (sobrenome && new RegExp(`\\b${sobrenome}\\b`).test(t)) falhas.push('não cite quem assinou o post');
  if ((String(texto).match(/[^.!?]+(?:[.!?]+|$)/g) || []).filter((v) => v.trim()).length > 4) falhas.push('máximo de 4 frases');
  return falhas;
}
