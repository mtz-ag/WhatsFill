/**
 * api-mob.js — a outra metade do adaptador: a superficie do **`api.js`** na plataforma nova.
 *
 * O projeto sempre teve o par `dom.js` (a tela) + `api.js` (os dados). Aqui o par e
 * `page-mob.js` (a tela, pelo gancho do React) + **este arquivo** (os dados, pelo Supabase).
 * `mob.js` continua embaixo dos dois, sabendo so como a base e montada.
 *
 * ```
 * mobiliza.app:   dom.js      +  api.js       -> page.js
 * mobiliza.me:    page-mob.js +  api-mob.js   -> page.js  (mesma interface)
 * ```
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTE ARQUIVO APAGA DO PROJETO
 * ---------------------------------------------------------------------------
 *
 * Boa parte dos 22 nomes do `api.js` **nao tem o que fazer aqui**, e isso e o maior ganho da
 * migracao — nao e codigo novo, e codigo que deixa de ser necessario:
 *
 *  - **`getCustomFields` + todo o `contract.js`**: campo personalizado virou COLUNA. Acabou o
 *    contrato de escrita APRENDIDO (observar a plataforma gravar uma vez e copiar), o
 *    `isToIncludeCustomFields`, o *"a API responde 200 e IGNORA o valor"* e as keys desalinhadas.
 *  - **`createTag` / `updateTag`**: etiqueta virou texto num array. Nao ha o que criar.
 *  - **`getPreviousSessionId` / `getConversaAnterior`**: nao existe SESSAO. A conversa e uma
 *    linha com o historico inteiro, e com ela some a armadilha da Rosa (05/09), em que sessao
 *    nova parecia pessoa nova.
 *  - **`contarMeusAbertos`**: na plataforma velha o contador da tela MENTIA (`skipCount=true`
 *    devolvia `totalItems: 0`, badge 76 contra 353 reais), e saber o numero de verdade custava a
 *    consulta mais cara do painel. Aqui a contagem e um cabecalho.
 *
 * ---------------------------------------------------------------------------
 * E O QUE CONTINUA EM ABERTO — dito, nao escondido
 * ---------------------------------------------------------------------------
 *
 * **De qual ANUNCIO a pessoa veio ainda nao foi medido.** No mobiliza.app isso era `session.utm`
 * (`source`, `campaign`, `headline`, `referralUrl`), e dele saem `veioDeAnuncio`,
 * `anuncioReconhecido` e o recibo da chegada. Aqui ha as colunas `origem` e `origem_detalhe` em
 * `base_dados` — **os NOMES foram medidos, os VALORES nao**.
 *
 * Por isso `getSession` devolve `origem` cru e **nao inventa um `utm`**. Devolver `utm: null`
 * seria pior que nao devolver nada: `veioDeAnuncio` ficaria falso para todo mundo, e a chegada
 * pelo anuncio — que e por onde a maior parte desta base entra — passaria a ser decidida como se
 * ninguem tivesse clicado em nada, **em silencio**. E a proxima medicao.
 */

import * as mob from './mob.js';
import { contatoDoBanco, chaveDaEtiqueta, COLUNA_DO_CAMPO, canaisDaConta } from './page-mob.js';

export { canaisDaConta };

/**
 * **O que ainda precisa de sonda.** As funcoes de borda e as RPCs foram LIDAS no pacote da
 * plataforma e **nunca executadas** — a disciplina e *uma sonda antes das outras*, no contato de
 * teste, antes de qualquer fila.
 */
const AINDA_NAO_MEDIDO =
  'ainda nao foi medido na plataforma nova: a funcao foi LIDA no pacote e nunca executada. ' +
  'A sonda sai no contato de teste, uma mensagem, antes de qualquer fila.';

function recusar(oque) {
  return Promise.reject(new Error(`${oque} ${AINDA_NAO_MEDIDO}`));
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

/**
 * A "sessao" aqui e a propria conversa — nao ha o conceito de sessao.
 *
 * O painel le `session.channelId` (para escolher o modelo aprovado do canal) e
 * `session.expired` (a janela de 24h). **`expired` vai FALSO de proposito e nao por descuido:**
 * o canal e `zapi`, que o proprio app classifica como *nao oficial*, e para esses
 * `sessionDurationInMinutes` e `-1` — **sem janela** (27/09). Texto livre sai a qualquer hora, e
 * o que pune e o RITMO e a REPETICAO, nao o relogio.
 */
export async function getSession(conversaId) {
  const linhas = await mob.buscar('conversas', { filtros: { id: 'eq.' + conversaId }, limite: 1 });
  const linha = linhas?.[0];
  if (!linha) return null;
  const c = mob.conversaDoBanco(linha);
  return {
    id: c.id,
    contactId: c.contatoId,
    channelId: c.canalId,
    status: c.status,
    userId: c.atendenteId,
    expired: false,
    grupo: c.grupo,
  };
}

/** O contato, vestido com o formato que `fields.readValues` sabe ler. */
export async function getContact(contatoId) {
  const linha = await mob.contato(contatoId);
  return contatoDoBanco(linha);
}

/** A conversa inteira — sem paginar por sessao, porque nao ha sessao. */
export async function getConversation(conversaId, limite = 200) {
  return mob.conversa(conversaId, { limite });
}

/**
 * **O "schema" aqui e uma tabela de nomes**, e e isso que apaga o `contract.js`.
 *
 * `fields.loadSchema` espera `{id, name, key, type, isSelect, readonly, options}`. Como nao ha
 * campo personalizado, o `id` E o nome do campo — e `page-mob.contatoDoBanco` monta
 * `customFieldValues` com o mesmo `customFieldId`, entao os dois lados se encontram sem que nada
 * precise ser aprendido.
 *
 * **Tudo `STRING` de proposito.** Na plataforma velha `DATE` e `MULTISELECT` exigiam contrato
 * proprio, e cair no de texto fazia a API responder 200 **sem gravar**. Aqui a coluna e texto, e
 * anunciar um tipo que a coluna nao tem seria recriar aquela armadilha do nada.
 */
export async function getCustomFields() {
  return Object.keys(COLUNA_DO_CAMPO).map((nome) => ({
    id: nome,
    name: nome,
    key: COLUNA_DO_CAMPO[nome],
    type: 'STRING',
    isSelectField: false,
    isReadonly: false,
    options: [],
  }));
}

/**
 * **As etiquetas que EXISTEM na base — e aqui nao ha tabela de etiquetas para listar.**
 *
 * Na plataforma velha era `GET /core/v1/tag`. Aqui etiqueta e texto dentro de um array, entao a
 * lista so existe como o conjunto do que ja foi usado: leio uma fatia da base e junto.
 *
 * **E a juncao e por ROTULO NORMALIZADO**, porque a armadilha do rotulo repetido voltou com
 * outra cara (medido: `⛔ 1 SEM RETORNO` e `⛔ 1 Sem Retorno`, `SERRA ` com espaco no fim). Cada
 * entrada carrega `grafias` — as formas que existem no banco —, que e o que permite a tela
 * avisar, como `categorizar.etiquetasComRotuloRepetido` ja fazia.
 *
 * **Uma fatia NAO e a base inteira, e a resposta diz isso** (`completa`): afirmar que uma
 * etiqueta "nao existe" olhando 1.000 de 9.457 contatos faria o painel propor criar o que ja
 * existe — e aqui "criar" nem e uma operacao.
 */
export async function getTags({ limite = 1000 } = {}) {
  const linhas = await mob.buscar('contatos', { select: 'tags', limite });
  const por = new Map();
  for (const l of linhas || []) {
    for (const t of Array.isArray(l?.tags) ? l.tags : []) {
      const name = String(t ?? '').trim();
      if (!name) continue;
      const id = chaveDaEtiqueta(name);
      if (!id) continue;
      if (!por.has(id)) por.set(id, { id, name, grafias: [] });
      const e = por.get(id);
      if (!e.grafias.includes(name)) e.grafias.push(name);
    }
  }
  const lista = [...por.values()];
  /**
   * **`completa` quase sempre sera falso, e e importante que seja.** Medido: a base tem
   * **107.988 contatos**, entao mil linhas sao 0,9% dela. Afirmar que uma etiqueta "nao existe"
   * olhando essa fatia faria o painel propor criar o que ja existe — e aqui criar nem e uma
   * operacao. A fatia serve para RECONHECER grafia, nunca para negar existencia.
   */
  lista.completa = (linhas || []).length < limite;
  lista.lidos = (linhas || []).length;
  return lista;
}

/** Quem esta logado — sai da propria sessao do Supabase, sem requisicao nenhuma. */
/**
 * Quem esta logado — sai da propria sessao, sem requisicao nenhuma.
 *
 * **So o id, e e isso que ha para dar:** `mob.lerSessao` descarta nome e e-mail de proposito
 * (*"nao fazem falta a nada aqui"*), e o painel so usa o `userId` mesmo — era com ele que a fila
 * da plataforma velha dizia o que era "Meus". Inventar um nome aqui seria por dado dele num
 * lugar que nao precisa dele.
 */
export async function getAgente() {
  const s = mob.sessaoDaPagina();
  if (!s?.usuarioId) return null;
  return { userId: s.usuarioId };
}

/**
 * **A contagem virou um cabecalho, e isso conserta um defeito antigo da plataforma velha.**
 *
 * La o badge "Meus" MENTIA — o app pedia `skipCount=true` e a resposta vinha com
 * `totalItems: 0`; medido lado a lado em 30/08, badge **76** contra **353** reais. Saber o numero
 * de verdade custava a consulta mais cara do painel, e foi ela que estourou o limitador numa
 * rodada de 222 conclusoes (24/09). Aqui o PostgREST devolve o total no `Content-Range` com
 * `Prefer: count=exact`, sem trazer linha nenhuma.
 */
export async function contarConversas({ filtros = {} } = {}) {
  const tenantId = mob.tenantAtivo();
  const alvo = mob.url('conversas', { tenantId, select: 'id', filtros, limite: 1 });
  const sessao = mob.sessaoDaPagina();
  if (!sessao || mob.sessaoExpirada(sessao)) return null;
  const chave = await mob.anon();
  const r = await fetch(alvo, {
    headers: {
      apikey: chave,
      Authorization: `Bearer ${sessao.token}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });
  if (!r.ok) return null;
  // `Content-Range: 0-0/353` — o que interessa e o que vem depois da barra.
  const faixa = String(r.headers.get('content-range') || '');
  const total = Number(faixa.split('/')[1]);
  return Number.isFinite(total) ? total : null;
}

export async function contarMeusAbertos() {
  const eu = await getAgente();
  if (!eu?.userId) return null;
  return contarConversas({ filtros: { atendente_id: 'eq.' + eu.userId, status: 'eq.em_atendimento' } });
}

/**
 * Quantas eu resolvi hoje — o "progresso do dia".
 *
 * Na plataforma velha isto era `COMPLETED` + `timestampFilter`, e a licao de 30/08 continua
 * valendo: **"abertos" nao e medida de progresso**, porque o total sobe quando chega gente nova
 * (medido ao vivo: foi de 353 a 359 enquanto se conversava, num dia de trabalho bom). O que
 * conta e o que FOI RESOLVIDO, da meia-noite LOCAL para ca.
 */
export async function contarMeuDia() {
  const meiaNoite = new Date();
  meiaNoite.setHours(0, 0, 0, 0);
  const resolvidasHoje = await contarConversas({
    filtros: { status: 'eq.resolvido', updated_at: 'gte.' + meiaNoite.toISOString() },
  });
  return { concluidos: resolvidasHoje, abertos: await contarMeusAbertos() };
}

/** Quantas foram resolvidas hoje — a metade do "progresso do dia" que conta de verdade. */
export async function contarConcluidosHoje() {
  const d = await contarMeuDia();
  return d.concluidos;
}

/**
 * **So o que o contato ESCREVEU** — e a base do parser.
 *
 * A assimetria e deliberada e vem de 31/08: `incoming` nao traz transcricao de audio, porque
 * alimentar o parser com fala passada por reconhecimento automatico faria nome e cidade de
 * eleitor sairem de texto que a maquina ouviu. Quem precisa ver midia usa `entrantes`.
 */
export async function getIncomingText(conversaId, limite = 200) {
  const c = await getConversation(conversaId, limite);
  return c?.incoming || [];
}

/**
 * **NAO EXISTE MODELO APROVADO NESTA PLATAFORMA — e isso e coerente, nao e falta.**
 *
 * Medido: `whatsapp_templates` tem `name`, `content`, `atalho`, `categoria`, `ordem`,
 * `uso_count` — e **nao tem `instance_id`**. Ou seja, ela e a tabela das **respostas rapidas
 * dele**, nao a dos modelos aprovados pela Meta ligados a um canal.
 *
 * E faz sentido: o canal e **zapi**, que o proprio app classifica como *"WhatsApp (nao
 * oficial)"*, e para esses `sessionDurationInMinutes` e `-1` — **sem janela de 24h e sem modelo
 * aprovado** (27/09). Texto livre sai a qualquer hora; o que pune e o RITMO e a REPETICAO.
 *
 * Devolver lista vazia e a resposta CERTA, e nao um buraco: quem pergunta "qual modelo aprovado
 * mandar?" tem de ouvir "nenhum, mande o texto". A primeira versao disto filtrava por
 * `instance_id` — uma coluna que nao existe —, o que daria **400 no primeiro contato aberto**.
 */
export async function getMessageTemplates() {
  return [];
}

/** As respostas rapidas DELE, que agora moram na plataforma (`name`, `content`, `atalho`). */
export async function respostasDaPlataforma() {
  return mob.buscar('respostas', { ordem: 'ordem.asc', limite: 200 });
}

/**
 * **As GRAFIAS de uma etiqueta — e esta e a medicao mais cara que esta migracao produziu.**
 *
 * Medido na base dele em 27/10/2026, com a contagem exata do servidor:
 *
 * ```
 * tags cs {"SERRA"}  ->      0          <- a grafia OBVIA, a que ele digitaria
 * tags cs {"SERRA "} ->    504          <- com espaco no fim
 * tags cs {"Serra"}  ->    423
 * PRODUCAO 213  +  Producao 151
 * ```
 *
 * **Um disparo filtrado por "SERRA" alcancaria NINGUEM**, enquanto 927 pessoas estao ali sob
 * duas outras grafias — e a tela diria "0 contatos", que se le como *"ninguem tem essa
 * etiqueta"* e nao como *"voce escreveu de um jeito que o banco nao tem"*.
 *
 * Na plataforma velha a armadilha do rotulo repetido produzia contagem ERRADA (dois ids com o
 * mesmo nome, 1293 contatos marcados errado). **Aqui ela produz ZERO, em silencio**, que e pior:
 * numero errado alguem estranha; zero parece resposta.
 *
 * Por isso nenhuma consulta por etiqueta usa a grafia que ele digitou SOZINHA. O rotulo e
 * normalizado, as grafias que existem no banco sao recuperadas do catalogo, e a consulta vai
 * com todas num `or=` — **medido: 504, igual a soma das duas**.
 */
export function grafiasDaEtiqueta(rotulo, catalogo = []) {
  const chave = chaveDaEtiqueta(rotulo);
  if (!chave) return [];
  const achado = (catalogo || []).find((t) => t.id === chave);
  const doBanco = achado?.grafias?.length ? achado.grafias : [];
  const digitada = String(rotulo ?? '').trim();
  // A digitada entra junto quando o catalogo nao a conhece: catalogo e AMOSTRA, nao a base.
  return doBanco.includes(digitada) || !digitada ? doBanco : [...doBanco, digitada];
}

/** O filtro do PostgREST para um conjunto de grafias. Uma so vai direto; varias vao por `or`. */
export function filtroDeEtiqueta(grafias) {
  /**
   * **DESCARTA o que e so espaco, mas NAO apara o que sobrou** — e a diferenca e a consulta
   * inteira.
   *
   * A primeira versao fazia `.trim()` em cada grafia, e isso destroi justamente o que faz o
   * filtro casar: a grafia que existe no banco e `"SERRA "`, COM o espaco no fim (504 contatos).
   * Aparada, ela vira `"SERRA"` — que o servidor mediu como **0**. O conserto teria recriado o
   * defeito que ele existe para evitar.
   *
   * O que precisa sair e a grafia que e SO espaco, porque `'  '` e verdadeiro e viraria uma
   * consulta que nao casa com nada e parece ter casado com nada.
   */
  const limpas = (grafias || [])
    .map((g) => String(g).replace(/"/g, ''))
    .filter((g) => g.trim() !== '');
  if (!limpas.length) return null;
  if (limpas.length === 1) return { tags: `cs.{"${limpas[0]}"}` };
  return { or: `(${limpas.map((g) => `tags.cs.{"${g}"}`).join(',')})` };
}

/**
 * Contatos por etiqueta — o `contact/filter` da plataforma velha.
 *
 * **Recusa a etiqueta que o catalogo nao conhece**, em vez de devolver lista vazia: vazio aqui
 * se le como "ninguem tem", e e assim que um disparo sai para zero pessoa achando que a lista
 * acabou. E a mesma disciplina de 01/10 — *nome fora do CRM RECUSA a rodada*.
 */
export async function filterContacts({ etiqueta = '', limite = 200, catalogo = null } = {}) {
  if (!etiqueta) {
    const linhas = await mob.buscar('contatos', { limite });
    return (linhas || []).map(contatoDoBanco);
  }

  const cat = catalogo || (await getTags());
  const grafias = grafiasDaEtiqueta(etiqueta, cat);
  const filtros = filtroDeEtiqueta(grafias);
  if (!filtros) throw new Error(`Etiqueta "${etiqueta}" nao existe no catalogo lido — recuso, para nao devolver lista vazia como se ninguem a tivesse.`);

  const linhas = await mob.buscar('contatos', { filtros, limite });
  const contatos = (linhas || []).map(contatoDoBanco);
  contatos.grafiasUsadas = grafias;
  return contatos;
}

export async function listContacts({ limite = 200 } = {}) {
  const linhas = await mob.buscar('contatos', { limite });
  return (linhas || []).map(contatoDoBanco);
}

/**
 * **`ehErroDeRede` NAO e reexportado daqui de proposito.** Ela e pura e nao depende de
 * plataforma — separar engasgo de rede de defeito vale igual nas duas —, e reexporta-la criaria
 * um ciclo `api.js -> api-mob.js -> api.js`. Quem precisa dela continua importando do `api.js`.
 */

// ---------------------------------------------------------------------------
// O que MORRE
// ---------------------------------------------------------------------------

/**
 * **Etiqueta e texto: nao ha o que criar.**
 *
 * Devolve a propria etiqueta em vez de falhar — na plataforma velha `createTag` existia porque a
 * etiqueta precisava de um id antes de ser aplicada, e a aba Cidades criava **uma como sonda**
 * antes das outras. Aqui aplicar e acrescentar texto ao array, entao "criar" ja aconteceu.
 */
export async function createTag(nome) {
  const name = String(nome ?? '').trim();
  return { id: chaveDaEtiqueta(name), name, criada: false, desnecessario: true };
}

/**
 * **Renomear tambem morre, e aqui ela era PERIGOSA de um jeito que nao e mais.**
 *
 * La `POST /core/v1/tag/{id}` trocava o rotulo e todos os contatos passavam a mostrar o nome
 * novo — uma requisicao em vez de duas por contato. Aqui o rotulo esta escrito dentro de cada
 * contato, entao renomear seria reescrever a base inteira: **nao e uma operacao barata disfarcada
 * de barata, e por isso recusa** em vez de tentar.
 */
export async function updateTag() {
  return recusar('Renomear etiqueta');
}

export async function getPreviousSessionId() {
  return null;
}
export async function getConversaAnterior() {
  return null;
}

// ---------------------------------------------------------------------------
// O que ainda precisa de SONDA
// ---------------------------------------------------------------------------

export function abrirAtendimento() {
  return recusar('Abrir atendimento (assumir_conversa)');
}
export function concluirAtendimento() {
  return recusar('Resolver atendimento (resolver_conversa)');
}
export function listarEquipes() {
  return recusar('Listar equipes');
}

/**
 * **Nao existe `senderId` aqui.** Era um uuid de correlacao do cliente do mobiliza.app, exigido
 * pelo corpo do envio de imagem. A funcao de borda da plataforma nova tem protocolo proprio, e
 * **qual e nao foi medido** — devolver um uuid inventado seria fingir que o formato e o mesmo.
 */
export function novoSenderId() {
  return null;
}

// ---------------------------------------------------------------------------
// ESCRITA — e o unico caminho deste projeto que manda mensagem para eleitor
// ---------------------------------------------------------------------------

/**
 * **A FUNCAO QUE ENVIA — medida ao vivo em 27/10/2026, no contato de teste dele.**
 *
 * Ate hoje ela estava escrita neste projeto como *"lida no pacote, nunca executada"*, e a regra
 * era recusar. **Nao foi adivinhada: foi OBSERVADA.** O formato do corpo e de propriedades
 * abreviadas e minificadas no pacote da plataforma, entao ler nao dava os nomes — o que deu foi
 * gravar a propria plataforma enviando uma vez e copiar, que e o que o `recorder.js` sempre fez
 * no mobiliza.app.
 *
 * ```
 * POST /functions/v1/enviar-mensagem-atendimento
 *   corpo:    { instance_id, numero, conversa_id, tipo, conteudo }
 *   resposta: { ok, conversa_id, mensagem_id, provider }   -> 200, provider "zapi"
 * ```
 *
 * **`provider: "zapi"` confirma a doutrina do canal:** nao ha janela de 24h nem modelo aprovado,
 * e o que pune e o RITMO e a REPETICAO (27/09). Texto livre sai a qualquer hora.
 */
/**
 * **A decisao de mandar ou nao, separada da rede — porque e ela que precisa de teste.**
 *
 * Enterrada no meio do `fetch`, a guarda do grupo so seria exercitada mandando mensagem de
 * verdade. Aqui ela e pura: as 134 conversas de grupo da base dele passam por este `if` num
 * teste, de graca.
 */
export function podeMandar(conversa, texto) {
  const c = conversa || {};
  if (!c.id) return { ok: false, motivo: 'conversa nao encontrada' };
  if (!c.instance_id) return { ok: false, motivo: 'conversa sem canal (instance_id) — a funcao de borda exige' };
  if (!String(c.numero || '').trim()) return { ok: false, motivo: 'conversa sem numero' };
  if (!String(texto ?? '').trim()) return { ok: false, motivo: 'sem texto — mensagem vazia chega como mensagem' };

  /**
   * **A guarda do GRUPO vem aqui TAMBEM, e nao so em quem monta a fila.**
   *
   * Sao 134 conversas de grupo na base dele, e `grupo_id` e NULO em todas — quem responde e o
   * `external_chat_id`. Deixar de atender alguem custa uma passada; publicar resposta de
   * atendimento dentro de um grupo de dezenas de pessoas, com o nome dele em cima, **nao tem
   * volta**. Por isso a ultima conferencia fica no ponto de ENVIO: uma lista montada certo que
   * passe por um caminho novo continua barrada aqui.
   */
  if (mob.ehGrupo(c)) return { ok: false, motivo: 'isto e um GRUPO' };

  return { ok: true };
}

export async function mandarTexto({ conversaId, texto, tipo = 'text' } = {}) {
  const conteudo = String(texto ?? '').trim();
  if (!conversaId) throw new Error('mandarTexto: sem conversa');
  if (!conteudo) throw new Error('mandarTexto: sem texto — recuso, mensagem vazia chega como mensagem');

  const linhas = await mob.buscar('conversas', {
    select: 'id,numero,instance_id,external_chat_id,grupo_id',
    filtros: { id: 'eq.' + conversaId },
    limite: 1,
  });
  const c = linhas?.[0];
  if (!c) throw new Error('mandarTexto: conversa nao encontrada');

  const veredito = podeMandar(c, conteudo);
  if (!veredito.ok) throw new Error('mandarTexto: ' + veredito.motivo);

  const sessao = mob.sessaoDaPagina();
  if (!sessao || mob.sessaoExpirada(sessao)) throw new Error('mandarTexto: sessao da plataforma vencida — recarregue a aba');
  const chave = await mob.anon();

  const r = await fetch(mob.FUNCOES + mob.FUNCAO_ENVIAR, {
    method: 'POST',
    headers: { apikey: chave, Authorization: `Bearer ${sessao.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instance_id: c.instance_id,
      numero: c.numero,
      conversa_id: c.id,
      tipo,
      conteudo,
    }),
  });

  const resposta = await r.json().catch(() => null);
  if (!r.ok || resposta?.ok !== true) {
    throw new Error(`mandarTexto: a plataforma recusou (${r.status}${resposta?.error ? ' — ' + resposta.error : ''})`);
  }

  return {
    ok: true,
    mensagemId: resposta.mensagem_id || null,
    provider: resposta.provider || null,
    conferir: () => entregou(resposta.mensagem_id),
  };
}

/**
 * **A SONDA QUE RELE — "200 e ignora" e a armadilha mais antiga deste projeto.**
 *
 * Medido nas duas mensagens de teste: `envio_status` virou **`enviado`** e
 * `external_message_id` veio preenchido. Mas **mensagem antiga tem `envio_status` NULO** (a
 * coluna so passou a ser preenchida depois), entao:
 *
 * - `enviado`               -> saiu
 * - `envio_erro` preenchido -> nao saiu, e o motivo esta ali
 * - qualquer outra coisa    -> **nao da para saber**
 *
 * Tres estados, nunca dois: colapsar "nao sei" em "saiu" faria a rodada marcar como entregue o
 * que ficou pelo caminho, e em "falhou" faria mandar duas vezes. E a licao do `donoDoCanal`
 * (25/09) e do `undefined !== 'CONNECTED'` (01/10).
 */
export async function entregou(mensagemId) {
  if (!mensagemId) return 'nao-da-para-saber';
  const linhas = await mob.buscar('mensagens', {
    select: 'id,envio_status,envio_erro,external_message_id',
    filtros: { id: 'eq.' + mensagemId },
    limite: 1,
  });
  const m = linhas?.[0];
  if (!m) return 'nao-da-para-saber';
  if (m.envio_erro) return 'erro';
  if (String(m.envio_status || '').toLowerCase() === 'enviado') return 'enviado';
  return 'nao-da-para-saber';
}
