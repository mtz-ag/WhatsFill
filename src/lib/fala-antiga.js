/**
 * **Virou o dia e hoje ela só mandou gesto ou repasse** (21/11/2026, a Bernadette Breton).
 *
 * Na noite de 19/11 ela contou uma história do supermercado; em 20/11 e hoje só repassou um
 * abaixo-assinado, um link e um texto "Liberdade para Bolsonaro". A rodada levou o caso à IA, que
 * respondeu à história de dois dias atrás. Regra dele: *"se a nossa última é de outro dia e hoje ela
 * só mandou repasse, link ou emoji, vai a mensagem do momento — exceto se a fala antiga tinha
 * pergunta ou pedido"* (a exceção é o Rogerio Senna, "E aí capitão... Até quando ????", que ele
 * atende). A exceção mora em `sugestao.momentoSobreFalaAntiga`; aqui só se mede o que chegou.
 */
import { desdeNossaUltima, ehSoReacao, ehRepasse } from './cortesia.js';
import { repasseParaIA } from './repasse-ia.js';
import { ehPostEncaminhado } from './post-encaminhado.js';

/** Post repassado que não tem as duas marcas de `ehPostEncaminhado`: longo e com hashtag. */
const HASHTAG = /(^|\s)#\p{L}{3,}/u;

/** Material de outra pessoa: o texto (ou a transcrição) dele não é fala dela. */
function ehMaterialRepassado(m) {
  if (!m) return false;
  const texto = String(m.texto || '');
  if (ehRepasse(m) || repasseParaIA(m) || ehPostEncaminhado(m)) return true;
  return texto.trim().length >= 200 && HASHTAG.test(texto);
}

function ehGestoOuRepasse(m) {
  if (!m) return true;
  const texto = String(m.texto || '');
  if (ehSoReacao(m) || ehMaterialRepassado(m)) return true;
  // Sem nenhuma letra (só símbolo, emoji ou caractere quebrado): não há fala dela ali.
  return !/\p{L}/u.test(texto) && String(m.tipo || 'TEXT').toUpperCase() === 'TEXT';
}

/**
 * **Link com "boa semana na paz de Jesus" é gesto, não fala** (o João Sergio, 23/11/2026): a fala
 * dele era de outro dia, e hoje veio só um link com o cumprimento da semana. Ele escolheu a mensagem
 * do momento. Conta como gesto o texto que, tirando links, cumprimentos, bênçãos e palavras de
 * ligação, não deixa letra nenhuma — "Bom dia, isso não pode terminar em pizza" continua sendo fala.
 */
const SAUDACAO_OU_BENCAO = /\b(?:bom\s+(?:dia|domingo|sabado|fim\s+de\s+semana)|boa\s+(?:tarde|noite|semana|sexta|segunda)|otima\s+(?:semana|segunda|sexta)|feliz\s+(?:domingo|segunda|semana)|(?:semana|dia|noite|tarde)\s+abencoad[ao]|na\s+paz\s+de\s+(?:jesus|deus|cristo)|deus\s+(?:te\s+|vos\s+|nos\s+)?abencoe\w*|fi(?:que|ca)\s+com\s+deus|amem|gratidao|abencoad[ao]s?)\b/g;
const PALAVRAS_DE_LIGACAO = /\b(?:e|a|o|as|os|um|uma|na|no|de|da|do|com|para|pra|voce|vc|voces|todos|todas|muito|muita|que|tambem|sempre)\b/g;

function soSaudacaoOuBencao(texto) {
  const t = String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/https?:\/\/\S+|www\.\S+/g, ' ');
  if (!SAUDACAO_OU_BENCAO.test(t)) return false;
  SAUDACAO_OU_BENCAO.lastIndex = 0;
  const resto = t.replace(SAUDACAO_OU_BENCAO, ' ').replace(PALAVRAS_DE_LIGACAO, ' ');
  return !/\p{L}/u.test(resto);
}

export function hojeSoGestoSobreFalaAntiga(entrantes, nossaUltimaAt, agora = new Date()) {
  if (!nossaUltimaAt) return false;
  const hoje = new Date(agora).toDateString();
  const nossa = new Date(nossaUltimaAt);
  if (Number.isNaN(nossa.getTime()) || nossa.toDateString() === hoje) return false;
  const pendentes = desdeNossaUltima(entrantes, nossaUltimaAt).filter(m => !m?.sistema && !m?.geradaPeloAnuncio);
  const ehDeHoje = (m) => m?.at && new Date(m.at).toDateString() === hoje;
  const deHoje = pendentes.filter(ehDeHoje);
  const antigasProprias = pendentes.filter(m => !ehDeHoje(m) && !ehGestoOuRepasse(m));
  if (!deHoje.length || !antigasProprias.length) return false;
  // A pergunta tem de ser DELA: a transcrição de um vídeo repassado com "?" dentro (o Vilmar,
  // 23/11) segurava o caso com a IA. "????" sozinho continua contando (o Rogerio, 21/11).
  if (antigaPedeResposta(pendentes.filter(m => !ehDeHoje(m) && !ehMaterialRepassado(m)))) return false;
  // Hoje, cumprimento ou bênção (com link ou sem) também é gesto; nas falas antigas não, para não
  // tirar da conta o que ela disse (ver `soSaudacaoOuBencao`).
  return deHoje.every(m => ehGestoOuRepasse(m) || soSaudacaoOuBencao(m?.texto));
}

/**
 * **A fala antiga perguntou, cobrou ou pediu?** (21/11/2026, o Rogerio Senna: "E aí capitão",
 * "Até quando", "????" em mensagens SEPARADAS — `perguntaPendente` não viu pergunta, e ele recebeu
 * a mensagem do momento por cima de um pedido de socorro). Aqui a conta é sobre todas as falas
 * antigas juntas: uma interrogação em qualquer uma delas (fora de links, cuja query string tem "?"),
 * uma cobrança ou um pedido de ajuda mantém o caso com a IA e com ele — a exceção que ele escolheu.
 */
const COBRANCA_OU_PEDIDO = /\b(at[eé]\s+quando|e\s+a[ií]\s*,?\s*(capit|deputad|martim)|cad[eê]\s+(voc|o\s+capit|o\s+deputad)|preciso\s+de|me\s+ajud|ajuda\s+(pra|para|com)|socorro|n[aã]o\s+aguento)/i;
const LINK_SOLTO = /https?:\/\/\S+|www\.\S+/gi;

function antigaPedeResposta(antigas) {
  const texto = antigas.map(m => String(m?.texto || '').replace(LINK_SOLTO, ' ')).join('\n');
  return texto.includes('?') || COBRANCA_OU_PEDIDO.test(texto);
}
