/**
 * page-mob.js — **O ADAPTADOR**: faz o mobiliza.me parecer com o que o `panel.js` ja sabe ler.
 *
 * Este arquivo existe por causa de uma correcao dele, em 26/10/2026, e e a decisao mais
 * importante desta migracao:
 *
 *   *"voce misturou tudo, a aba facebook era pra plataforma do facebook, todo o resto era
 *   mobiliza e era isso pra ser trazido e deixar intocada a aba do facebook"*
 *
 * Eu tinha comecado um painel NOVO para a plataforma nova, citando o `facebook-main.js` como
 * molde. **O molde nao vale:** o painel do Facebook e pequeno porque o TRABALHO dele e pequeno
 * (listar comentario e responder). O trabalho do mobiliza e a operacao inteira — a rodada, o
 * quadro, a Config, as respostas, a IA — e ela **ja existe**, com dois meses de decisoes dele
 * dentro. Entao:
 *
 * ```
 * panel.js  (a rodada, o quadro, a Config, a IA)   <- intocado
 *    |
 * page.js ->  mobiliza.app (dom.js + api.js)  |  mobiliza.me (ESTE arquivo + mob.js)
 * ```
 *
 * `mob.js` sabe o que a base TEM. Este arquivo sabe o que o PAINEL ESPERA, e faz a traducao.
 *
 * ---------------------------------------------------------------------------
 * MEDIDO NA BASE DELE EM 27/10/2026 — e cada numero aqui mudou uma decisao
 * ---------------------------------------------------------------------------
 *
 * **1. `status` tem exatamente TRES valores, e e ele quem responde "concluido?"**
 *
 * ```
 * aberto ............ 586      em_atendimento ..... 3      resolvido ..... 11
 * ```
 *
 * **E `resolvido_em` NAO serve para isso**: das 11 resolvidas, **1** tinha `resolvido_em`
 * preenchido. E a mesma armadilha do `grupo_id` por outra porta — a coluna que PARECE responder
 * nao responde, e quem a usasse veria dez atendimentos fechados como se estivessem abertos. Em
 * toda decisao de "ja acabou?", quem manda e o `status`.
 *
 * **2. As colunas em ingles e em portugues sao ESPELHO PERFEITO — menos duas.**
 *
 * `base_dados` carrega os dois vocabularios, resto de migracao. Medido em 600 contatos:
 *
 * ```
 * name = nome ......... 600/600 iguais       phone = telefone ... 600/600
 * city = cidade ....... 600/600              state = estado ..... 600/600
 * notes (0 cheios) != observacoes (30 cheios)      address/endereco: os dois VAZIOS
 * ```
 *
 * Para LER tanto faz, e este arquivo le as portuguesas (o vocabulario do proprio app). **Para
 * ESCREVER nao foi medido** — se forem coluna gerada ou gatilho, escrever em qualquer uma serve;
 * se forem duas colunas de verdade, escrever na errada e *"a API responde 200 e ignora"* de
 * volta, com outro nome. **`notes` e `observacoes` ja DIVERGEM**, entao a hipotese do espelho
 * nao vale para o par inteiro. A sonda decide, no Thiago Tim, antes de qualquer fila.
 *
 * **3. `tags` e um ARRAY DE TEXTO, e a armadilha do rotulo repetido VOLTOU com outra cara.**
 *
 * Eu havia escrito no `mob.js` que *"some com elas a armadilha do rotulo repetido"*. **Medido:
 * falso.** Sao 87 rotulos distintos em 439 contatos, e entre eles:
 *
 * ```
 * "⛔ 1 SEM RETORNO"             e  "⛔ 1 Sem Retorno"
 * "METROPOLITANO DELTA DO JACUI" e  "Metropolitano Delta do Jacui"
 * "PRODUCAO"                     e  "Producao"
 * "SERRA "                       <- com espaco no fim
 * ```
 *
 * Na plataforma velha eram dois ids com o mesmo rotulo; aqui e o mesmo conceito escrito de
 * jeitos diferentes num campo livre. **O conserto e o mesmo de la, e ja estava escrito no
 * projeto: comparar ROTULO NORMALIZADO.** Por isso a identidade da etiqueta aqui e o rotulo
 * normalizado, e o `name` guarda a grafia que esta no banco — comparar pelo texto cru faria a
 * rodada aplicar "SERRA " de novo em quem ja tem "SERRA".
 *
 * **4. `nao_perturbe` existe, e e protecao que a plataforma velha nao tinha.**
 *
 * Coluna booleana em `base_dados` (5 contatos marcados na amostra de 600), com
 * `nao_perturbe_em` e `nao_perturbe_motivo` do lado. **Quem esta marcado nao recebe nada** — e
 * isso vem antes do quadro, como a etiqueta de sem interesse. E decisao que alguem ja tomou
 * sobre aquela pessoa, e decisao tomada nao se redescobre.
 *
 * **5. `estado` ja responde "e de fora do RS?" — sem parser.**
 *
 * 556 RS, 41 de outros doze estados, 3 vazios. Na plataforma velha isso exigiu `cities.js`
 * inteiro e uma lista de 4.828 municipios; aqui e uma coluna.
 *
 * **6. Metade das conversas NAO tem contato no CRM** (320 de 600 com `contato_id`). Entao
 * `getContact` devolvendo nada e o caso NORMAL, nao erro — e o painel tem de continuar andando.
 *
 * **7. O PostgREST faz a juncao numa requisicao so** (`select=...,base_dados(...)`, medido 200).
 * Na plataforma velha abrir um contato custava a sessao + 3 chamadas nossas, e rajada derrubava
 * a API. Aqui a conversa e o contato vem juntos.
 */

import * as mob from './mob.js';

// ---------------------------------------------------------------------------
// Etiquetas: a identidade e o rotulo NORMALIZADO
// ---------------------------------------------------------------------------

/**
 * A chave com que duas etiquetas sao a MESMA etiqueta.
 *
 * Sem acento, sem caixa, sem espaco sobrando e sem o emoji/numeracao que ele usa como enfeite de
 * ordenacao (`⛔ 1 SEM RETORNO`, `🔴PROCURA EMPREGO`, `1. PROCURA EMPREGO`). Os tres apareceram
 * na mesma base apontando para o mesmo conceito.
 */
export function chaveDaEtiqueta(rotulo) {
  return String(rotulo ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/^\s*\d+\s*/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * As etiquetas de um contato, no formato que o painel ja le: `{id, name}`.
 *
 * O `id` e a chave normalizada — e e isso que faz `⛔ 1 SEM RETORNO` e `⛔ 1 Sem Retorno`
 * contarem como UMA. O `name` e a grafia que esta no banco, porque e ela que tem de voltar numa
 * escrita futura: o campo e texto livre, e gravar a forma normalizada criaria um 88o rotulo.
 */
export function etiquetasDoContato(linha) {
  const cruas = Array.isArray(linha?.tags) ? linha.tags : [];
  const vistas = new Map();
  for (const t of cruas) {
    const name = String(t ?? '').trim();
    if (!name) continue;
    const id = chaveDaEtiqueta(name);
    if (!id || vistas.has(id)) continue;
    vistas.set(id, { id, name });
  }
  return [...vistas.values()];
}

// ---------------------------------------------------------------------------
// O contato, na forma que o painel espera
// ---------------------------------------------------------------------------

/**
 * Os campos que o painel trata como "campos personalizados" e que aqui sao COLUNAS.
 *
 * Na plataforma velha isto custava o `contract.js` inteiro — um contrato de escrita APRENDIDO
 * observando a plataforma gravar, porque a API respondia 200 e ignorava o valor no formato
 * errado. Aqui sao colunas de verdade, e o mapa e uma tabela de nomes.
 *
 * O `name` da esquerda e o rotulo que o `fields.CLASSIFY_FIELDS` usa; a direita e a coluna.
 */
export const COLUNA_DO_CAMPO = Object.freeze({
  Cidade: 'cidade',
  Estado: 'estado',
  Bairro: 'bairro',
  Profissao: 'profissao',
  'Como ajudar': 'como_ajudar',
  Observacoes: 'observacoes',
});

/**
 * Traduz a linha de `base_dados` para o contato que o `panel.js` le.
 *
 * O painel usa `contact.id`, `contact.name`, `contact.tagsId`, `contact.phonenumber` e
 * `fields.readValues(contact)` — entao a linha vira exatamente isso, com `customFieldValues` no
 * formato que `readValues` sabe ler (`{customFieldId, valueString}`), **indexado pelo nome da
 * coluna**: aqui nao ha id de campo, porque nao ha campo personalizado nenhum.
 */
export function contatoDoBanco(linha) {
  if (!linha) return null;
  const etiquetas = etiquetasDoContato(linha);
  const nome = String(linha.nome ?? linha.name ?? '').trim();

  return {
    id: linha.id || null,
    // `name` e `nome` sao espelho (600/600 medidos); o painel le `name`.
    name: nome,
    nome,
    nameWhatsapp: nome,
    phonenumber: String(linha.telefone ?? linha.phone ?? '').trim(),
    phonenumberFormatted: String(linha.telefone ?? linha.phone ?? '').trim(),
    createdAt: linha.created_at || null,
    createdat: linha.created_at || null,

    tags: etiquetas,
    tagsId: etiquetas.map((t) => t.id),

    customFieldValues: Object.entries(COLUNA_DO_CAMPO)
      .map(([campo, coluna]) => ({ customFieldId: campo, valueString: valorDeTexto(linha[coluna]) }))
      .filter((v) => v.valueString !== ''),

    /**
     * **A protecao nova.** Quem esta marcado nao recebe nada, e isso e decisao que alguem ja
     * tomou sobre aquela pessoa — a rodada le, nunca redescobre.
     */
    naoPerturbe: linha.nao_perturbe === true,
    naoPerturbeMotivo: String(linha.nao_perturbe_motivo ?? '').trim() || null,

    /** Ja vem da coluna: na plataforma velha isto exigia casar contra 4.828 municipios. */
    foraDoRS: ehForaDoRS(linha.estado ?? linha.state),
  };
}

function valorDeTexto(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(String).join(', ');
  return String(v).trim();
}

/** Vazio nao e "de fora": e desconhecido, e desconhecido nunca vira afirmacao. */
export function ehForaDoRS(estado) {
  const uf = String(estado ?? '').trim().toUpperCase();
  if (!uf) return false;
  return uf !== 'RS' && uf !== 'RIO GRANDE DO SUL';
}

// ---------------------------------------------------------------------------
// O estado da tela
// ---------------------------------------------------------------------------

/**
 * **Os tres estados da conversa, e o que cada um significa para a rodada.**
 *
 * Medido: `aberto` (586), `em_atendimento` (3), `resolvido` (11). `atendente_id` acompanha
 * `em_atendimento` — as 4 linhas com atendente eram as 3 em atendimento mais a unica resolvida
 * com registro completo.
 */
export const ABERTO = 'aberto';
export const EM_ATENDIMENTO = 'em_atendimento';
export const RESOLVIDO = 'resolvido';

/**
 * O `pageState` da plataforma nova, montado **so com o que o gancho ja leu do React** — zero
 * requisicao.
 *
 * Isto nao e detalhe: `pageStateLocal` roda a cada 500ms. Uma consulta por tique seria uma
 * rajada contra o PostgREST o dia inteiro, e rajada ja derrubou a plataforma velha uma vez. Os
 * campos todos saem das props que o `mob-hook` ja tem na mao.
 *
 * `semControles` fica **falso** de proposito: na plataforma velha ele era a rede de seguranca
 * para "a tela mudou de nome" (ler o rotulo do botao). Aqui quem responde e o `status`, que e
 * dado e nao rotulo — e afirmar "sem controles" sem ter medido seria inventar um terceiro estado.
 */
export function estadoDaConversa(aberta, { dark = false, hasDialog = false, hasComposer = null } = {}) {
  const c = aberta?.conversa || null;
  if (!c) {
    return {
      sessionId: null,
      isPending: false,
      hasComposer: false,
      dark,
      conversation: '',
      concluded: false,
      hasDialog,
      semControles: false,
      porQuantosSinais: aberta?.por || 'nenhum',
    };
  }

  const status = String(c.status || '').toLowerCase();
  return {
    sessionId: c.id || null,
    isPending: status === ABERTO,
    /**
     * Quem responde e a TELA, nao o status: se da para digitar sem assumir **nao foi medido**, e
     * o gancho ve o campo de mensagem de graca. Sem leitura, cai no status.
     */
    hasComposer: hasComposer === null ? status === EM_ATENDIMENTO : !!hasComposer,
    dark,
    /** Muda quando chega mensagem nova — e o que faz o painel reanalisar na hora. */
    conversation: `${c.total_mensagens ?? ''}|${c.ultima_mensagem_em ?? ''}`,
    concluded: status === RESOLVIDO,
    hasDialog,
    semControles: false,
    porQuantosSinais: aberta?.por || 'nenhum',
  };
}

// ---------------------------------------------------------------------------
// As consultas
// ---------------------------------------------------------------------------

/**
 * A conversa e o contato dela **numa requisicao so**.
 *
 * O `select` embutido (`base_dados(...)`) foi medido devolvendo 200 com a linha do contato
 * dentro. Na plataforma velha isto eram tres chamadas, e o que derrubava a API era o NUMERO de
 * requisicoes por contato aberto.
 */
export async function conversaComContato(conversaId) {
  if (!conversaId) return null;
  const tenantId = mob.tenantAtivo();
  const alvo = mob.url('conversas', {
    tenantId,
    select: '*,base_dados(*)',
    filtros: { id: 'eq.' + conversaId },
    limite: 1,
  });
  const linhas = await mob.anon().then((chave) => pedir(alvo, chave));
  const linha = linhas?.[0];
  if (!linha) return null;

  return {
    conversa: mob.conversaDoBanco(linha),
    contato: contatoDoBanco(linha.base_dados || null),
  };
}

/**
 * **Quem esta no ar, e nada alem disso.**
 *
 * `provider` continua **zapi** (medido), entao toda a doutrina de canal nao oficial do CLAUDE.md
 * continua valendo: nao ha janela de 24h nem modelo aprovado, e o que pune e o RITMO e a
 * REPETICAO. O campo da conexao aqui e `status_conexao` — e **campo que a plataforma nao mandou
 * nao vira texto na tela**, a licao do `undefined !== 'CONNECTED'` (01/10).
 */
export async function canaisDaConta() {
  const linhas = await mob.canais();
  return (linhas || []).map((c) => ({
    id: c.id,
    nome: String(c.nome ?? c.name ?? '').trim(),
    numero: String(c.numero_whatsapp ?? c.phone_number ?? '').trim(),
    provedor: String(c.provedor ?? c.provider ?? '').toLowerCase(),
    conexao: c.status_conexao == null ? null : String(c.status_conexao).toLowerCase(),
    ativo: c.is_active === true,
  }));
}

/** Leitura crua, sem escrever nada: e o unico caminho deste arquivo ate a rede. */
async function pedir(alvo, chave) {
  const sessao = mob.sessaoDaPagina();
  if (!sessao || mob.sessaoExpirada(sessao)) return null;
  const r = await fetch(alvo, {
    headers: { apikey: chave, Authorization: `Bearer ${sessao.access_token}` },
  });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

// ---------------------------------------------------------------------------
// A ponte ate o gancho do mundo MAIN
// ---------------------------------------------------------------------------

/**
 * **Por que existe ponte:** `__reactFiber$<hash>` e um expando, e expando **nao atravessa mundo
 * isolado no Chrome**. Um content script comum ve o mesmo `<button>` da fila e nao ve a chave —
 * entao quem le o estado do React e o `mob-hook.js`, que roda no mundo da pagina, e o que volta
 * por aqui e so o RESULTADO.
 *
 * **Toda pergunta tem relogio.** A licao do timeout da IA (08/09) vale igual entre mundos: o
 * gancho pode nao ter subido (a pagina e React, e o painel monta antes dela terminar), e sem
 * prazo o painel esperaria para sempre por uma resposta que nunca vem — que e o pior dos dois
 * casos, porque *"nao abriu" se mostra na tela; silencio, nao*.
 */
const ORIGEM = 'https://' + mob.HOST;
export const PRAZO_DA_PONTE_MS = 4000;

let contador = 0;

export function perguntarAoGancho(
  type,
  payload = {},
  { prazoMs = PRAZO_DA_PONTE_MS, janela = typeof window === 'undefined' ? null : window } = {},
) {
  if (!janela) return Promise.resolve(null);
  const pedido = `p-${++contador}-${Date.now()}`;

  return new Promise((resolve) => {
    let vivo = true;
    const fim = (r) => {
      if (!vivo) return;
      vivo = false;
      clearTimeout(relogio);
      janela.removeEventListener('message', ouvir);
      resolve(r);
    };
    const relogio = setTimeout(() => fim(null), prazoMs);

    function ouvir(ev) {
      // As tres guardas da ponte, iguais as do gancho: quem mandou, de onde, e o que.
      if (ev.source !== janela || ev.origin !== ORIGEM) return;
      const d = ev.data;
      if (!d || d.__whatsfill !== 'mob-page') return;
      // Resposta de outra pergunta nao serve: duas perguntas no ar ao mesmo tempo sao o normal
      // (o laco de 500ms e um clique dele), e casar a errada responderia sobre outra conversa.
      if (d.payload && d.payload.pedido && d.payload.pedido !== pedido) return;
      fim(d);
    }

    janela.addEventListener('message', ouvir);
    janela.postMessage({ __whatsfill: 'mob-cs', type, payload: { ...payload, pedido } }, ORIGEM);
  });
}

// ---------------------------------------------------------------------------
// A superficie que o `panel.js` chama: os mesmos nomes do `page.js`
// ---------------------------------------------------------------------------

/**
 * **O que AINDA nao foi medido RECUSA com o motivo na tela, e nunca finge que fez.**
 *
 * `enviar-mensagem-atendimento`, `assumir_conversa`, `resolver_conversa` e `reabrir_conversa`
 * foram **lidas no pacote da plataforma e nunca executadas** — e a disciplina deste projeto para
 * isso tem nome: *uma sonda antes das outras*, no contato de teste, antes de qualquer fila.
 *
 * Um no-op silencioso aqui seria pior que o erro: a rodada marcaria como enviado o que nao saiu,
 * e concluiria atendimento que ninguem respondeu. E a armadilha mais antiga do projeto — *"a API
 * responde 200 e IGNORA"* — na forma em que nos mesmos a criariamos.
 */
export const AINDA_NAO_MEDIDO =
  'ainda nao foi medido na plataforma nova: a funcao foi LIDA no pacote e nunca executada. ' +
  'A sonda sai no contato de teste, uma mensagem, antes de qualquer fila.';

function recusar(oque) {
  return Promise.reject(new Error(`${oque} ${AINDA_NAO_MEDIDO}`));
}

/** O estado da tela, por dois sinais que tem de concordar — e sem tocar na rede. */
export async function getState(opcoes = {}) {
  const r = await perguntarAoGancho('aberta', {}, opcoes);
  if (!r) {
    /**
     * **Gancho mudo e DIFERENTE de "nenhuma conversa aberta"**, e o painel precisa distinguir:
     * "nenhuma" o faz pedir que ele abra uma; "nao sei" tem de faze-lo calar. Quem nao sabe nao
     * afirma — a mesma regra do `nao-da-para-saber` do canal removido (14/10).
     */
    return { ...estadoDaConversa(null), ganchoRespondeu: false };
  }
  const p = r.payload || {};
  return {
    ...estadoDaConversa(
      { conversa: p.conversa, por: p.por },
      { dark: !!p.dark, hasDialog: !!p.hasDialog, hasComposer: p.hasComposer },
    ),
    ganchoRespondeu: true,
  };
}

/** Abre a conversa na tela DELE, pelo id. Clica e para ai: nao marca lida, nao assume. */
export async function abrirNaTela(id, nome = '', opcoes = {}) {
  const r = await perguntarAoGancho('abrir', { id, nome }, opcoes);
  if (!r) return { ok: false, motivo: 'gancho-mudo' };
  return r.payload || { ok: false, motivo: 'sem-resposta' };
}

/**
 * A fila agora e uma TABELA — nao se rola a tela nem se clica em "Ver mais".
 *
 * Na plataforma velha a fila carregava 50 por vez e o resto so vinha num botao sem `data-cy`:
 * sem clicar nele, a rodada enxergava uma fatia e achava que tinha acabado. Aqui o limite e
 * argumento da consulta.
 *
 * **Grupo fica de fora, e e `mob.ehGrupo` quem decide** — nunca o `grupo_id`, que e nulo na base
 * inteira. Publicar resposta de atendimento dentro de um grupo de dezenas de pessoas, com o nome
 * dele em cima, nao tem volta.
 */
export async function queuePreview(max = 50) {
  const linhas = await mob.fila({ limite: Math.max(1, Number(max) || 50) });
  return (linhas || []).map(mob.conversaDoBanco).filter((c) => !c.grupo);
}

/**
 * Abre o item da fila naquela posicao — e e aqui que a escolha dele de 26/10 vive:
 * *"Mostrar ANTES, com a tela junto"*. A rodada decide, abre a conversa pelo id e **para**.
 */
export async function openQueueSession(index = 0) {
  const n = Math.max(0, Number(index) || 0);
  const fila = await queuePreview(n + 1);
  const alvo = fila[n];
  if (!alvo) return { ok: false, motivo: 'fila-acabou' };
  return abrirNaTela(alvo.id, alvo.nome);
}

export async function openNextSession() {
  return openQueueSession(0);
}

/** Nao existe "carregar mais": a consulta ja pede o limite que se quer. */
export async function carregarMaisDaFila() {
  return { ok: true, jaVemTudo: true };
}

/** So o que impede a mensagem de CHEGAR conta como caido (a disciplina de 01/10). */
export const CONEXAO_CAIDA = new Set(['disconnected', 'desconectado', 'critical', 'banned', 'banido']);

/**
 * **O numero caiu?** — pela API, nunca pela tarja.
 *
 * Na plataforma velha isto era lido do TEXTO de um aviso no cabecalho, e a tarja mora justamente
 * na tela que ele esconde durante a rodada (25/09). Aqui e coluna: `status_conexao`.
 *
 * **Campo que a plataforma nao mandou nao vira afirmacao** (a licao do `undefined !==
 * 'CONNECTED'`, 01/10): sem leitura nenhuma devolve `null`, que nao e "caiu" nem "esta no ar" —
 * e quem chama tem de tratar os TRES estados.
 */
export async function canalForaDoAr(canalId = '', { canais: dados = null } = {}) {
  const canais = dados || (await canaisDaConta());
  const alvo = canalId ? canais.find((c) => c.id === canalId) : null;
  const olhar = alvo ? [alvo] : canais;
  if (!olhar.length) return null;
  const caidos = olhar.filter((c) => c.conexao && CONEXAO_CAIDA.has(c.conexao));
  if (caidos.length) return { caiu: true, numero: caidos[0].numero, conexao: caidos[0].conexao };
  return olhar.some((c) => c.conexao) ? false : null;
}

export async function numeroDoCanal(opcoes = {}) {
  const r = await perguntarAoGancho('aberta', {}, opcoes);
  return String(r?.payload?.conversa?.numero || '') || null;
}

/**
 * **Nao existe "conversa anterior" aqui, e isso nao e perda: e o conceito que sumiu.**
 *
 * No mobiliza.app a conversa era partida em SESSOES, e quem voltava depois de concluido abria
 * uma nova — dai o botao "Ver conversa anterior", a rota `/previous` e toda a armadilha da Rosa
 * (05/09), em que sessao nova parecia pessoa nova e ela se apresentava duas vezes. Aqui a
 * conversa e UMA linha com o historico inteiro, e a pergunta deixa de existir.
 */
export async function temConversaAnterior() {
  return false;
}

// --- o que MORRE na plataforma nova -----------------------------------------

/**
 * **O contrato de escrita aprendido e o gravador nao tem mais o que fazer**: campo personalizado
 * virou COLUNA.
 *
 * Eles respondem "desnecessario" e **nao erro**, de proposito: falhar faria a tela pedir que ele
 * aprenda um contrato que nao existe mais — o pre-requisito que envelhece junto com o desenho
 * que o criou (26/09), que ja barrou a fila inteira uma vez.
 */
export async function learnStart() {
  return { ok: true, desnecessario: true, motivo: 'Campo personalizado virou coluna: nao ha contrato a aprender.' };
}
export async function learnStatus() {
  return { estado: 'desnecessario', motivo: 'Campo personalizado virou coluna.' };
}
export async function recorderBuffer() {
  return [];
}
export async function recorderStop() {
  return { ok: true, desnecessario: true };
}
/** Nao ha overlay do Material para fechar: a plataforma nova nao e Angular Material. */
export async function closeOverlay() {
  return true;
}
export async function diagnosticarAbas() {
  return { plataforma: mob.HOST, naPagina: mob.naPagina() };
}

// --- o que ainda PRECISA de sonda -------------------------------------------

export function sendText() {
  return recusar('Enviar mensagem');
}
export function setComposerText() {
  return recusar('Escrever no campo de mensagem da plataforma');
}
export function clickIniciar() {
  return recusar('Assumir o atendimento');
}
export function clickConcluir() {
  return recusar('Resolver o atendimento');
}
export function clickReiniciar() {
  return recusar('Reabrir o atendimento');
}
export function sendMessageTemplate() {
  return recusar('Enviar modelo aprovado');
}
export function enviarImagem() {
  return recusar('Enviar imagem');
}
export function aprenderImagemStart() {
  return recusar('Aprender o envio de imagem');
}
export async function aprenderImagemStatus() {
  return { estado: 'nao-medido', motivo: AINDA_NAO_MEDIDO };
}
