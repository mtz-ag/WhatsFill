/**
 * tags.js — etiquetas: quais aplicar e como.
 *
 * Duas famílias hoje, e a estrutura aceita mais sem mexer em código:
 *
 * 1. REGIÃO — a etiqueta é o COREDE da cidade do contato. O mapa município → COREDE vem da
 *    planilha oficial da Secretaria de Planejamento do RS (src/data/coredes-rs.json, 497
 *    municípios), não de chute.
 * 2. CONTEÚDO — depende do que o contato aceitou receber. Regras de texto editáveis:
 *    "zucco = Conteúdo Zucco", "fl[áa]vio = Conteúdo Flávio".
 *
 * O NOME da etiqueta nunca é inventado: ele é resolvido contra a lista real de etiquetas do
 * CRM (GET /core/v1/tag, onde o rótulo fica no campo `message`). Não resolveu? O painel diz e
 * oferece escolher da lista — e a escolha fica salva como apelido.
 */

import * as api from './api.js';
import * as store from './store.js';
import { normalize, semAcentoNemCaixa } from './cities.js';
import { buildRequest } from './contract.js';
/**
 * O nome da etiqueta de cidade vem de `categorizar.js`, e de lá só.
 *
 * Duas fontes para o mesmo nome seria a receita para o fluxo normal criar "CAXIAS DO SUL" e a
 * varredura criar outra coisa — duas etiquetas para a mesma cidade, e o filtro dele partido em
 * duas. `categorizar` não importa `tags`, então não há ciclo.
 */
import { nomeDaEtiqueta as nomeDaEtiquetaDeCidade } from './categorizar.js';

const COREDES_PATH = 'src/data/coredes-rs.json';

let tagsCache = null;
let coredesCache = null;

// ---------------------------------------------------------------------------
// Carregamento
// ---------------------------------------------------------------------------

export async function loadTags({ force = false } = {}) {
  if (tagsCache && !force) return tagsCache;
  const raw = await api.getTags();
  const arr = Array.isArray(raw) ? raw : raw?.items || [];
  // As cores entram porque renomear (`api.updateTag`) exige mandá-las de volta: sem elas, o
  // conserto de um rótulo resetaria a cor da etiqueta como efeito colateral.
  tagsCache = arr
    .filter((t) => t.active !== false && t.message)
    .map((t) => ({
      id: t.id,
      label: String(t.message).trim(),
      bgColor: t.bgColor || undefined,
      textColor: t.textColor || undefined,
    }));
  return tagsCache;
}

let coredeLoader = async () => {
  const res = await fetch(chrome.runtime.getURL(COREDES_PATH));
  return res.json();
};

/** Ponto de injeção para teste fora do navegador. */
export function setCoredeLoader(fn) {
  coredeLoader = fn;
  coredesCache = null;
}

export async function loadCoredes() {
  if (coredesCache) return coredesCache;
  const data = await coredeLoader();
  coredesCache = {};
  for (const [municipio, corede] of Object.entries(data.municipios || {})) {
    coredesCache[normalize(municipio)] = corede;
  }
  return coredesCache;
}

/** COREDE de uma cidade, ou null se não for município do RS. */
export async function coredeFor(city) {
  if (!city) return null;
  const mapa = await loadCoredes();
  return mapa[normalize(city)] || null;
}

// ---------------------------------------------------------------------------
// Resolução de nome → etiqueta do CRM
// ---------------------------------------------------------------------------

/**
 * Acha a etiqueta real do CRM pelo nome. Casa sem acento e sem pontuação, o que já resolve
 * divergências como "Centro-Sul" (planilha) x "Centro Sul" (CRM). O resto vem da tabela de
 * apelidos, editável na aba Config.
 */
export async function resolveTag(name) {
  if (!name) return null;
  const [tags, aliases] = await Promise.all([loadTags(), store.get('tagAliases')]);
  const alvo = aliases[normalize(name)] || name;
  return tags.find((t) => normalize(t.label) === normalize(alvo)) || null;
}

/** Registra que um COREDE (ou qualquer nome) corresponde a uma etiqueta do CRM. */
export async function saveAlias(name, tagLabel) {
  const aliases = await store.get('tagAliases');
  aliases[normalize(name)] = tagLabel;
  await store.set('tagAliases', aliases);
}

// ---------------------------------------------------------------------------
// Sugestão
// ---------------------------------------------------------------------------

/**
 * "Sim" à pergunta de interesse, medido só na ÚLTIMA mensagem do contato.
 *
 * Olhar a conversa inteira acharia "sim" em qualquer lugar e aplicaria etiqueta a quem nunca
 * foi perguntado — por isso quem chama também exige que a pergunta tenha SAÍDO para o contato.
 *
 * **A decisão sai da CABEÇA da mensagem, não da mensagem inteira.** Desde que a pergunta passou
 * a pedir nome e cidade junto (10/08), a resposta esperada é "Sim / Maria Silva / Palmares do
 * Sul" — longa, e frequentemente com um "não" legítimo mais à frente ("não faço parte de nenhum
 * grupo político", que é resposta à outra pergunta do formulário). A regra anterior — limite de
 * seis palavras e negação em qualquer lugar — transformava esses dois casos em recusa.
 *
 * Puro e exportado para ter teste: é ele que decide gravar etiqueta em eleitor real.
 */
const AFIRMATIVAS =
  /^(s|sim+|claro|quero|aceito|pode|manda|mande|positivo|afirmativo|isso|ok|okay|blz|beleza|certeza|gostaria|bora|adoraria)\b/;

const NEGATIVAS = /\bnao\b|\bnunca\b|\bdispenso\b/;

/** As primeiras palavras — onde mora a resposta a uma pergunta fechada. */
const PALAVRAS_DA_CABECA = 4;

export function respostaAfirmativa(texts = []) {
  const ultima = [...texts].reverse().find((t) => String(t || '').trim());
  if (!ultima) return false;

  const norm = normalize(ultima).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!norm) return false;

  const cabeca = norm.split(' ').slice(0, PALAVRAS_DA_CABECA).join(' ');
  // "sim, mas não quero" continua sendo recusa: a negação está na própria resposta.
  if (NEGATIVAS.test(cabeca)) return false;
  return AFIRMATIVAS.test(cabeca);
}

/**
 * A regra de conteúdo casou, com ou sem acento?
 *
 * Três tentativas, e cada uma cobre um jeito de o acento atrapalhar:
 *  1. a regra como ele escreveu, no texto como a pessoa escreveu (o comportamento de sempre);
 *  2. a mesma regra no texto sem acento — pega a regra `anuncio` contra "anúncio";
 *  3. a regra sem acento no texto sem acento — pega a regra `anúncio` contra "anuncio".
 *
 * A terceira passa o padrão por `semAcentoNemCaixa`, que também apaga metacaractere. Por isso é a
 * ÚLTIMA e vem dentro de `try`: para regra que é palavra simples ela é o que resolve, e para
 * regex de verdade as duas primeiras já responderam.
 */
function casa(re, padrao, haystack, haystackSemAcento) {
  if (re.test(haystack)) return true;
  if (re.test(haystackSemAcento)) return true;
  try {
    const simples = semAcentoNemCaixa(padrao);
    return !!simples && new RegExp(simples, 'i').test(haystackSemAcento);
  } catch (_) {
    return false;
  }
}

/**
 * Etiquetas sugeridas para o contato.
 *
 * @param {object} ctx
 * @param {string} ctx.city    cidade já classificada
 * @param {string[]} ctx.texts mensagens recebidas do contato
 * @param {string} [ctx.extra] texto adicional para casar as regras (ex.: campanha do anúncio)
 * @param {string[]} [ctx.etiquetasDoAnuncio] etiquetas do anúncio reconhecido (`store.anuncios`).
 *   Entram com origem `anúncio`, fora da disputa de conteúdo: servem para ele filtrar por campanha.
 * @param {object} [ctx.interesse] `{ perguntado:boolean, etiquetas:string[] }` — o aceite à
 *   pergunta de interesse no conteúdo. Só vira etiqueta quando a pergunta SAIU para este
 *   contato: sem isso, qualquer "sim" solto da conversa viraria aceite.
 * @returns {Promise<Array<{origem:string, nome:string, tag:object|null, motivo:string}>>}
 */
export async function suggest({ city, texts = [], extra = '', interesse = null, veioDeAnuncio = false, nomeDivergente = false, etiquetasDoAnuncio = [] }) {
  const out = [];

  /**
   * **As etiquetas do anúncio reconhecido.**
   *
   * Pedido dele (02/09/2026): os anúncios do momento ganharam um campo de etiquetas, porque a
   * etiqueta ADS diz que a pessoa veio de anúncio e **não de qual** — sem isto não há como filtrar
   * depois quem chegou por qual campanha.
   *
   * Origem `anúncio`, e **não** `conteúdo`: conteúdo é o que decide qual modelo enviar, e uma
   * etiqueta de campanha entrando ali disputaria essa escolha com "Conteúdo Zucco"/"Conteúdo
   * Flávio" — o mesmo problema que fez a etiqueta ADS precisar do `fallback`. Aqui a etiqueta é
   * para o filtro dele, não para a decisão da rodada. Quem manda o modelo é a ação do anúncio.
   */
  for (const nome of Array.isArray(etiquetasDoAnuncio) ? etiquetasDoAnuncio : []) {
    const limpo = String(nome || '').trim();
    if (!limpo) continue;
    out.push({
      origem: 'anúncio',
      nome: limpo,
      tag: await resolveTag(limpo),
      motivo: 'o texto do anúncio reconhecido pede esta etiqueta',
    });
  }

  /**
   * Chegou por anúncio → etiqueta de anúncio, direto do dado da plataforma.
   *
   * Pedido dele (31/08): *"se reconhecer o que está na print e adicionar a etiqueta ADS resolve
   * tudo"*, com a print do bloco "ANÚNCIO | FACEBOOK". A sessão traz `utm.source` e
   * `utm.referralUrl` — é dado estruturado, não texto a adivinhar.
   *
   * **Origem `anúncio`, NUNCA `conteúdo`** — decisão dele em 02/09/2026: *"o conteúdo a ser
   * mandado não deve ser decidido pelo ads, e sim pelo texto do ads"*.
   *
   * Ela entrava como conteúdo, com `fallback: true` para perder de qualquer tema de verdade. Era
   * meia medida: quem chegava por anúncio e não dizia mais nada continuava com a ADS decidindo o
   * modelo, e a ADS **diz que veio de anúncio, não de QUAL**. Print da Vera (02/09): anúncio das
   * Escolas Cívico-Militares, e a caixa oferecendo "Campanha Martim" porque a Config mapeia
   * `ADS → Campanha Martim`. O modelo saiu da ORIGEM, não do anúncio.
   *
   * Agora ela é só etiqueta: entra no CRM, serve ao filtro dele, e fica fora da escolha do modelo.
   * Quem escolhe é `anuncios.modeloDoAnuncio` — o modelo do anúncio reconhecido pelo texto (ou
   * pela campanha), ou o modelo padrão quando nada foi reconhecido.
   */
  const etiquetaAnuncio = String(await store.get('etiquetaAnuncio') || '').trim();
  if (veioDeAnuncio && etiquetaAnuncio) {
    out.push({
      origem: 'anúncio',
      nome: etiquetaAnuncio,
      tag: await resolveTag(etiquetaAnuncio),
      motivo: 'a conversa começou por um anúncio (a plataforma informa a origem)',
    });
  }

  /**
   * O cadastro diz um nome e a pessoa disse outro → etiqueta para ELE arrumar depois.
   *
   * Escolha dele (31/08) entre trocar o nome sozinho e separar: separar. O nome nativo do
   * contato não é tocado em lugar nenhum — esta etiqueta é o meio de achar a pilha no filtro do
   * CRM e resolver tudo de uma vez.
   *
   * Vai como **`origem: 'revisão'`** e não como conteúdo: conteúdo alimenta a tabela "Modelo
   * por conteúdo" e viraria modelo a enviar — mandar a campanha para quem está na fila de
   * conserto de cadastro é o tipo de coisa que ninguém percebe até acontecer.
   */
  const etiquetaNome = String(await store.get('etiquetaNomeDivergente') || '').trim();
  if (nomeDivergente && etiquetaNome) {
    out.push({
      origem: 'revisão',
      nome: etiquetaNome,
      tag: await resolveTag(etiquetaNome),
      motivo: 'o nome do cadastro não bate com o que a pessoa informou — confira à mão',
    });
  }

  const corede = await coredeFor(city);
  if (corede) {
    /**
     * A etiqueta da CIDADE, ao lado da de região.
     *
     * Pedido dele em 20/08/2026: *"a extensão agora também tem que adicionar a etiqueta de cidade
     * em contatos novos"*. Até aqui a etiqueta de cidade só entrava pela varredura em massa (aba
     * Cidades), então todo contato novo nascia sem ela e a base voltava a ficar desalinhada no dia
     * seguinte à passada.
     *
     * Só entra quando o COREDE existe — ou seja, quando a cidade casou com a planilha oficial. O
     * nome vem de `categorizar.nomeDaEtiqueta`, o mesmo que a aba Cidades usa: duas fontes para o
     * nome da mesma etiqueta seria a receita para criar duas etiquetas parecidas.
     */
    const nomeCidade = nomeDaEtiquetaDeCidade(city);
    out.push({
      origem: 'cidade',
      nome: nomeCidade,
      tag: await resolveTag(nomeCidade),
      motivo: `a cidade do contato é ${city}`,
    });

    out.push({
      origem: 'região',
      nome: corede,
      tag: await resolveTag(corede),
      motivo: `${city} pertence ao COREDE ${corede}`,
    });
  } else if (city) {
    out.push({
      origem: 'região',
      nome: null,
      tag: null,
      motivo: `"${city}" não está na tabela oficial de municípios do RS — confira a grafia.`,
    });
  }

  const haystack = [...texts, extra].filter(Boolean).join('\n');

  /**
   * A mesma pilha de texto **sem acento**, para a regra dele não depender de til.
   *
   * Relato dele (31/08): *"a extensão está com dificuldade pra pegar se for por alguma palavra
   * chave"*. Aqui estava metade do motivo: a regra é testada como regex, e `/anuncio/i` não casa
   * com "anúncio" — nem `/anúncio/i` com "anuncio". Quem escreve no WhatsApp acentua quando dá,
   * e quem escreve a regra na Config acentua quando lembra; exigir que os dois combinem é
   * garantir que uma parte das mensagens escape.
   *
   * Testar nas DUAS versões, em vez de trocar: regra que já funciona com acento continua
   * funcionando, e nenhuma regex com classe de caractere ou `\b` é reescrita por mim.
   */
  const haystackSemAcento = semAcentoNemCaixa(haystack);

  for (const regra of await store.get('tagRules')) {
    if (!regra.padrao || !regra.etiqueta) continue;
    let re;
    try {
      re = new RegExp(regra.padrao, 'i');
    } catch (_) {
      continue; // regex inválida na configuração: ignora em vez de explodir
    }
    if (!casa(re, regra.padrao, haystack, haystackSemAcento)) continue;
    out.push({
      origem: 'conteúdo',
      nome: regra.etiqueta,
      tag: await resolveTag(regra.etiqueta),
      motivo: `a mensagem casou com "${regra.padrao}"`,
    });
  }

  // Aceite à pergunta de interesse: a pessoa não descreveu conteúdo nenhum, só respondeu "sim",
  // então nenhuma regra de texto casaria. Quem autoriza a etiqueta é o par pergunta-enviada +
  // resposta afirmativa.
  if (interesse?.perguntado && respostaAfirmativa(texts)) {
    for (const nome of interesse.etiquetas || []) {
      if (!nome) continue;
      out.push({
        origem: 'conteúdo',
        nome,
        tag: await resolveTag(nome),
        motivo: 'respondeu que sim à pergunta de interesse no conteúdo',
      });
    }
  }

  // Uma etiqueta só, mesmo que duas regras apontem para ela.
  const vistas = new Set();
  return out.filter((s) => {
    const chave = `${s.origem}|${s.nome}`;
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
}

/**
 * Etiquetas de conteúdo que o contato **já tem no CRM**, mesmo que nenhuma regra de texto case.
 *
 * Sem isto, a etiqueta que ele aplicou à mão era invisível para o painel: `suggest()` só olha o
 * que as regras acham nas mensagens. O sintoma foi "etiqueta de conteúdo do Flávio marcada e a
 * mensagem rápida não reconhece e trava o botão" — o botão de fechar com conteúdo exigia
 * exatamente um conteúdo identificado, e contava zero.
 *
 * Também acontece sem ninguém marcar nada: a regra casa contra a campanha do anúncio, o
 * contato é etiquetado na primeira passada, e na reabertura as mensagens dele sozinhas não
 * casam mais com nada.
 *
 * Só entram etiquetas **reconhecidas como conteúdo**: as que aparecem nas regras ou na tabela
 * "Modelo por conteúdo". Etiqueta de região e de fluxo continuam de fora.
 *
 * @param {object} contact contato do CRM (usa `tagsId`)
 * @param {object} [mapaModelos] tabela "Modelo por conteúdo" (chaves já achatadas)
 */
/**
 * Os nomes de etiqueta que são ORIGEM, e por isso nunca são conteúdo.
 *
 * Decisão dele (02/09/2026): *"o conteúdo a ser mandado não deve ser decidido pelo ads, e sim pelo
 * texto do ads"*. São duas fontes: a etiqueta geral de quem chega por anúncio (`etiquetaAnuncio`) e
 * as etiquetas que cada anúncio da Config aplica — as duas dizem de ONDE a pessoa veio, e nenhuma
 * diz o que ela quer.
 *
 * Uma função só porque o vazamento foi exatamente isto: a ADS saiu de `suggest` e voltou por
 * `conteudosJaAplicados`. Duas listas separadas divergem na primeira vez que alguém acrescenta uma
 * fonte nova.
 */
export async function etiquetasDeOrigem() {
  const [geral, anuncios] = await Promise.all([store.get('etiquetaAnuncio'), store.get('anuncios')]);
  const nomes = [String(geral || '')];
  for (const a of Array.isArray(anuncios) ? anuncios : []) {
    for (const e of Array.isArray(a?.etiquetas) ? a.etiquetas : []) nomes.push(String(e || ''));
  }
  return new Set(nomes.map((n) => n.trim()).filter(Boolean).map((n) => normalize(n)));
}

export async function conteudosJaAplicados(contact, mapaModelos = {}) {
  const ids = new Set(contact?.tagsId || []);
  if (!ids.size) return [];

  const [todas, regras, deOrigem] = await Promise.all([loadTags(), store.get('tagRules'), etiquetasDeOrigem()]);
  const conhecidos = new Set(
    [
      ...(regras || []).map((r) => r.etiqueta),
      ...Object.keys(mapaModelos || {}),
    ]
      .filter(Boolean)
      .map((nome) => normalize(nome))
      /**
       * **A etiqueta de anúncio não volta como conteúdo por esta porta.**
       *
       * Print da Liana (02/09/2026): anúncio cadastrado, texto casando, e a caixa ainda oferecendo
       * "Campanha Martim" com `Conteúdo pedido: ADS`. A ADS tinha saído dos conteúdos em
       * `suggest` — mas **esta função a reconstruía**, porque `mapaModelos` é a tabela "Modelo por
       * conteúdo" e ele tem `ADS = Campanha Martim` lá. A etiqueta já está no CRM, o nome está na
       * tabela, e ela voltava como conteúdo por um caminho que a primeira correção não fechou.
       *
       * Fechar aqui por IDENTIDADE, e não confiando na deduplicação de quem chama: quem monta a
       * lista lá em cima já filtra por nome repetido, e foi justamente por isso que o vazamento
       * passou despercebido — bastava o rótulo no CRM diferir de uma vírgula para escapar.
       */
      .filter((nome) => !deOrigem.has(nome))
  );

  return todas
    .filter((t) => ids.has(t.id) && conhecidos.has(normalize(t.label)))
    .map((t) => ({
      origem: 'conteúdo',
      nome: t.label,
      tag: t,
      motivo: 'etiqueta de conteúdo já aplicada no contato',
    }));
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

export const NO_TAG_CONTRACT =
  'Para gravar etiquetas, primeiro use "Aprender etiquetas" na aba Config.';

/**
 * Ids das etiquetas do CRM que correspondem a um COREDE.
 *
 * Serve para trocar a etiqueta de região quando a cidade muda: só uma região pode estar certa,
 * e a antiga tem que sair. A lista sai da planilha oficial, então nunca inclui etiqueta de
 * conteúdo nem etiqueta de fluxo ("1 SEM RETORNO") por engano.
 */
/**
 * Os ids das etiquetas que são **nome de município do RS**.
 *
 * Serve para a mesma coisa que `regionTagIds` serve ao COREDE: quando a cidade do contato muda, a
 * etiqueta da cidade ANTIGA tem que sair, senão ele fica com duas cidades e aparece nos dois
 * filtros. É o mesmo defeito que já aconteceu com COREDE duplicado.
 *
 * O casamento é contra a planilha oficial (as chaves de `loadCoredes` já são municípios
 * normalizados), então etiqueta que não é nome de município nunca entra — e portanto nunca é
 * candidata a ser removida por este caminho.
 */
export async function cityTagIds() {
  const municipios = await loadCoredes();
  const ids = new Set();
  for (const tag of await loadTags()) {
    if (municipios[normalize(tag.label)]) ids.add(tag.id);
  }
  return ids;
}

export async function regionTagIds() {
  const mapa = await loadCoredes();
  const nomes = [...new Set(Object.values(mapa))];
  const ids = new Set();
  for (const nome of nomes) {
    const tag = await resolveTag(nome);
    if (tag) ids.add(tag.id);
  }
  return ids;
}

/**
 * Aplica etiquetas ao contato SOMANDO às que ele já tem.
 *
 * A união é essencial: a plataforma grava a lista inteira de etiquetas do contato, então
 * mandar só as novas apagaria as antigas.
 *
 * `remover` é a exceção, e existe por um motivo só: quando a pessoa informa a cidade e ela
 * muda, o COREDE antigo passa a ser informação errada sobre o contato. Quem chama decide o
 * que sai — aqui nada é removido por conta própria.
 */
export async function applyTags(contact, tagIds, { remover = [] } = {}) {
  const novas = tagIds.filter(Boolean);
  const saem = new Set((remover || []).filter(Boolean));
  if (!novas.length && !saem.size) return { ok: true, applied: [], skipped: true };

  const contract = await store.get('writeContract');
  const entry = contract?.entries?.find((e) => e.type === 'TAGS');
  if (!entry) return { ok: false, error: NO_TAG_CONTRACT };

  const atuais = Array.isArray(contact.tagsId) ? contact.tagsId : [];
  const mantidas = atuais.filter((id) => !saem.has(id) || novas.includes(id));
  const uniao = [...new Set([...mantidas, ...novas])];
  if (uniao.length === atuais.length && atuais.every((id) => uniao.includes(id))) {
    return { ok: true, applied: [], skipped: true };
  }

  const { url, body } = buildRequest(entry, { contactId: contact.id, value: uniao });
  try {
    await api.apiFetch(url, { method: entry.method, body });
    return { ok: true, applied: novas };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Só para o painel poder listar as etiquetas na hora de escolher à mão. */
export async function allTags() {
  return loadTags();
}

/**
 * Descarta o cache da lista de etiquetas.
 *
 * Existe para a aba Cidades: ela CRIA etiquetas, e sem invalidar o cache a leitura seguinte
 * continuaria com a lista de antes — o painel diria que as etiquetas ainda faltam criar e
 * ofereceria criar as mesmas de novo, com nome duplicado no CRM.
 */
export function invalidateTags() {
  tagsCache = null;
}
