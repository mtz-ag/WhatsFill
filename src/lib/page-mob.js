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
import { mandarTexto, assumirConversa, resolverConversa, reabrirConversa } from './api-mob.js';
import { escreverNoCampo, campoDeMensagem, camposEditaveis } from './dom-mob.js';

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
      plataforma: mob.HOST,
    };
  }

  const status = String(c.status || '').toLowerCase();
  return {
    sessionId: c.id || null,
    isPending: status === ABERTO,
    /**
     * **A TELA vence o status, e agora ela sabe do que esta falando.** Medido em 27/10/2026: numa
     * conversa `aberto` **nao ha campo de mensagem** — a plataforma so o cria depois de ASSUMIR, e
     * os unicos `textarea` da tela sao os dois de ANOTACAO. A primeira versao do gancho pegava o
     * primeiro visivel e **afirmava campo em toda conversa aberta**, e como esta linha deixa a
     * leitura de tela SUBSTITUIR o status, o palpite errado ganhava.
     *
     * Hoje o gancho responde em tres estados, e `null` (ha editavel e nenhum e o campo) cai no
     * status — que e o que faz isto envelhecer sem afirmar bobagem.
     */
    hasComposer: hasComposer === null ? status === EM_ATENDIMENTO : !!hasComposer,
    dark,
    /** Muda quando chega mensagem nova — e o que faz o painel reanalisar na hora. */
    conversation: `${c.total_mensagens ?? ''}|${c.ultima_mensagem_em ?? ''}`,
    concluded: status === RESOLVIDO,
    hasDialog,
    semControles: false,
    porQuantosSinais: aberta?.por || 'nenhum',
    /**
     * **Qual plataforma esta atendendo**, para a tela nao dar conselho que nao funciona aqui (o
     * *"clique em Recarregar"* do modelo aprovado, que no mobiliza.me nunca carregaria nada).
     *
     * Vai no ESTADO porque ele ja atravessa a ponte e ja e lido a cada tique: no modo janela
     * `location.hostname` e o da extensao e nao diz nada sobre onde a conversa esta. Custa zero.
     */
    plataforma: mob.HOST,
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
  const linhas = await mob.buscar('conversas', {
    select: '*,base_dados(*)',
    filtros: { id: 'eq.' + conversaId },
    limite: 1,
  });
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

/**
 * **TODA leitura deste arquivo passa pelo `mob.buscar`, e isso nao e preguica: e a unica forma
 * de o nome do campo da sessao viver num lugar so.**
 *
 * A primeira versao tinha um `fetch` proprio aqui montando `Bearer ${sessao.access_token}` — e
 * `mob.lerSessao` **normaliza para `token`**, de proposito, descartando o que nao faz falta. O
 * cabecalho sairia `Bearer undefined` e **toda** chamada voltaria 401, com a tela dizendo que a
 * sessao venceu quando ela estava boa. Duas copias do mesmo cabecalho divergem na primeira
 * mudanca; uma nao tem como divergir.
 */

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
/**
 * **A FILA — e o `.map(conversaDoBanco)` A MAIS que a esvaziava INTEIRA** (28/10/2026, relato
 * dele: *"comecar pelos meus na aba automatizado abre e fecha sozinho sem executar nenhuma
 * acao"*).
 *
 * `mob.fila` **ja devolve as linhas convertidas e sem grupo**. Esta funcao convertia **de novo**,
 * e a segunda passada e destrutiva: `conversaDoBanco` le `external_chat_id` da linha CRUA, que o
 * objeto convertido nao tem mais. Sem o endereco do chat, `ehGrupo` responde **`true`** — de
 * proposito, porque *"na duvida, e grupo"* (deixar de atender alguem custa uma passada; mandar
 * resposta de atendimento para dentro de um grupo nao tem volta).
 *
 * Resultado medido:
 * ```
 * uma passada   -> grupo: false     <- a conversa de uma pessoa
 * duas passadas -> grupo: true      <- a MESMA conversa, agora "grupo"
 * depois do .filter(c => !c.grupo): 0 de 1
 * ```
 *
 * **Entao a fila vinha VAZIA em toda rodada, sempre** — e os dois relatos dele sao o mesmo
 * defeito visto por portas diferentes: antes a rodada girava vinte vezes (porque
 * `carregarMaisDaFila` mentia `ok: true`); consertado aquilo, ela passou a terminar na hora.
 * *"Abre e fecha sozinho"* e a janelinha da rodada aparecendo e sumindo.
 *
 * **A licao: guarda defensiva que erra para o lado seguro vira apagador silencioso quando recebe
 * o dado errado.** `ehGrupo({})` devolvendo `true` esta certo; o que estava errado era chama-lo
 * com um objeto que nunca teve `external_chat_id`.
 *
 * `fila` e argumento para o teste poder exercitar ESTE caminho com linhas de mentira, em vez de
 * conferir o texto do codigo.
 */
export async function queuePreview(max = 50, { aba = '', fila = mob.fila } = {}) {
  const pedido = Math.max(1, Number(max) || 50);
  /**
   * **Pedir SÓ as linhas que a rodada vai usar esvazia a fila** (28/10/2026, "Começar pelas
   * não atendidas" confirmava e terminava sem abrir ninguém).
   *
   * A posição 0 pede UMA linha. `mob.fila` joga grupo fora DEPOIS da leitura. Se essa única
   * linha é um grupo — e grupo recebe mensagem o tempo todo, então é comum ser a mais nova —
   * o que volta é lista vazia, e a rodada encerra como se não houvesse ninguém esperando.
   * A folga é lida e descartada aqui; quem chama continua recebendo no máximo `pedido`.
   */
  const linhas = await fila({ limite: Math.min(200, pedido + 40), aba });
  return (linhas || []).slice(0, pedido);
}

/**
 * **Abre o item da fila naquela posicao, e devolve o CONTRATO que `percorrerFila` le.**
 *
 * E aqui que a escolha dele de 26/10 vive — *"mostrar ANTES, com a tela junto"*: a rodada decide,
 * abre a conversa pelo id e para.
 *
 * **A primeira versao travava a rodada, e de tres jeitos somados** (28/10/2026, relato dele:
 * *"travou e ficou parado sem fazer nenhuma acao"*):
 *
 *  1. **ignorava a `aba`** — *"Comecar pelos Meus"* percorria a fila inteira (1.091) em vez dos
 *     seis atendimentos dele;
 *  2. **devolvia `motivo` onde quem chama le `reason`** — entao a rodada parava com
 *     `interrompida = undefined` e o veredito nao dizia nada;
 *  3. e `carregarMaisDaFila` **respondia `ok: true`**, o que fazia o laco tentar a MESMA posicao
 *     vinte vezes, com pausa entre cada uma, sem abrir nada. **Era isso que ele via como "parado
 *     sem fazer nenhuma acao".**
 *
 * **"Nao esta na tela" e o caso COMUM e nao erro** (medido: 78 linhas no DOM para uma fila de
 * centenas), entao ele vira uma razao em palavras que diz o que fazer — nunca um codigo seco.
 */
export async function openQueueSession(index = 0, opcoes = {}) {
  // `fila` sai do `resto`: ele vai para `abrirNaTela`, que nao tem nada a ver com a consulta.
  const { aba = '', fila: deOnde = null, ...resto } = opcoes || {};
  const n = Math.max(0, Number(index) || 0);

  let fila;
  try {
    // Uma janela, nao so a posicao pedida: a linha exata pode nao estar desenhada, e a
    // seguinte que ja esta na tela abre no lugar. Parar na primeira que falta era a rodada
    // inteira terminando sem abrir ninguem.
    // Um a mais do que a janela: se ele voltar, a lista e maior que estas linhas e o
    // `total` NAO pode ser o tamanho da janela. Dizer "1 de 8" com 731 na fila era
    // a janela de busca vestida de fila inteira (28/10).
    const lidas = await queuePreview(n + 9, deOnde ? { aba, fila: deOnde } : { aba });
    fila = lidas.slice(0, n + 8);
    fila.temMais = lidas.length > n + 8;
  } catch (err) {
    // Aba que esta plataforma nao conhece para a rodada com o nome dela na frente — seguir seria
    // percorrer a fila errada, que e o que o `avisoAba` da plataforma velha impede.
    const texto = String(err?.message || err);
    return { ok: false, avisoAba: texto, reason: texto, total: 0 };
  }

  // Janela cheia nao e a fila inteira. Sem `total`, o veredito nao inventa "7 nao chegaram a ser abertos".
  const comTotal = (obj) => (fila.temMais ? obj : { ...obj, total: fila.length });

  if (!fila[n]) {
    return comTotal({
      ok: false,
      reason: fila.length
        ? `A fila${aba ? ` de "${aba}"` : ''} acabou (${fila.length} item(ns)).`
        : `A fila${aba ? ` de "${aba}"` : ''} veio VAZIA — confira o filtro da fila na plataforma.`,
    });
  }

  const porqueDe = (r) => ({
    'nao-esta-na-tela': 'Esta conversa nao esta renderizada na lista da plataforma — role a fila ate ela aparecer e recomece.',
    'gancho-mudo': 'O gancho da pagina nao respondeu — recarregue a aba do mobiliza.me.',
    erro: `A pagina estourou ao abrir a conversa${r.detalhe ? ` (${r.detalhe})` : ''}.`,
  }[r.motivo] || `Nao consegui abrir a conversa (${r.motivo || 'sem motivo'}).`);

  /**
   * **O rotulo da TELA, nao o nome interno da rodada.** Novos e `status=aberto`, e essa gente
   * esta em **Todas**. Com **Minhas** selecionada a lista so desenha quem ja foi assumido
   * (28/10/2026: a rodada parou em "nao esta renderizada" com Minhas 1 na tela e 728 em Todas).
   * Rolar a Minhas nao as faz aparecer: o filtro as tirou.
   */
  const ABA_NA_TELA = { Novos: 'Todas', Meus: 'Minhas', Outros: 'Todas' };

  const abrirAlguma = async () => {
    let ultima = null;
    const fim = Math.min(fila.length, n + 8);
    for (let i = n; i < fim; i++) {
      const alvo = fila[i];
      const r = await abrirNaTela(alvo.id, alvo.nome, resto);
      if (r.ok) {
        /**
         * **ESPERA A TELA MOSTRAR QUEM ACABAMOS DE CLICAR** (28/10/2026, print dele: *"Parei em
         * contato: a aba trocou de atendimento no meio do caminho"*).
         *
         * O clique volta na hora; o React desenha depois. Quem chama le a tela logo em seguida —
         * `processarNovo` compara `getState().sessionId` com o id que a rodada abriu — e nesse
         * instante a tela ainda mostra a conversa ANTERIOR. O painel concluia que **a aba trocou
         * de atendimento**, que e `erro`, e `erro` para a rodada inteira.
         *
         * **E a mesma causa do `so-um-sinal` da v3.222 num ponto mais acima**, e por isso o
         * conserto de la nao bastou: aquele guarda e o de `conversaDaTela`, que roda DEPOIS desta
         * checagem. **Consertar o sintoma onde ele aparece nao conserta quem le a tela antes.**
         *
         * Esperar aqui serve todo mundo a jusante de uma vez, porque este e o unico lugar que
         * sabe **qual** conversa deveria estar na tela.
         */
        const firme = await esperarOsDoisSinais({ id: alvo.id, ...resto });
        return comTotal({
          ok: true,
          sessionId: alvo.id,
          por: firme.porQuantosSinais || r.por,
          /** A tela confirmou? Quem chama usa para dizer o motivo certo, em vez de adivinhar. */
          firmou: firme.sessionId === alvo.id && firme.porQuantosSinais === 'os-dois',
          naTela: firme.sessionId || '',
        });
      }
      ultima = r;
      if (r.motivo !== 'nao-esta-na-tela') {
        return comTotal({ ok: false, reason: porqueDe(r) });
      }
    }
    return comTotal({ ok: false, foraDaTela: true, reason: porqueDe(ultima || { motivo: 'nao-esta-na-tela' }) });
  };

  let aberto = await abrirAlguma();
  const rotulo = ABA_NA_TELA[aba];
  if (!aberto.ok && aberto.foraDaTela && rotulo) {
    const troca = await perguntarAoGancho('aba', { rotulo }, resto);
    if (troca?.payload?.ok) {
      // O React so desenha a lista nova no quadro seguinte. Sem a espera a segunda
      // procura acontece na lista velha e a rodada desiste do mesmo jeito.
      await new Promise((r) => setTimeout(r, 400));
      await perguntarAoGancho('topo', {}, resto);
      await new Promise((r) => setTimeout(r, 250));
      const segunda = await abrirAlguma();
      aberto = segunda.ok || !segunda.foraDaTela
        ? segunda
        : { ...segunda, reason: `Troquei a lista da plataforma para ${rotulo} e a conversa continua sem estar desenhada. ${segunda.reason}` };
    }
  }
  return aberto;
}

export async function openNextSession(opcoes = {}) {
  return openQueueSession(0, opcoes);
}

/**
 * **Nao existe "carregar mais" aqui, e responder `ok: true` TRAVAVA A RODADA.**
 *
 * `percorrerFila` chama isto quando nao conseguiu abrir o item, e um `ok: true` significa *"pedi
 * mais fila, tente a mesma posicao de novo"* — com nada tendo mudado, o laco repetia a mesma
 * falha **vinte vezes com pausa entre elas**, e na tela isso e uma rodada parada sem fazer nada.
 *
 * A consulta ja pede o limite que se quer, entao o certo e dizer que nao ha mais o que carregar.
 */
export async function carregarMaisDaFila() {
  return { ok: false, jaVemTudo: true, reason: 'A fila aqui ja vem inteira da consulta — nao ha "ver mais" para clicar.' };
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

/**
 * **O NUMERO DA INSTANCIA QUE ATENDE ESTA CONVERSA — e nao o numero do CONTATO** (achado em
 * 28/10/2026, olhando a barreira do candidato acusar em todo atendimento).
 *
 * A primeira versao devolvia `conversa.numero`, que e **o telefone da pessoa do outro lado**. Na
 * plataforma velha a funcao irma (`dom.numeroDaConversa`) lia *"o numero da instancia que atende a
 * conversa aberta"* do cabecalho — coisa completamente diferente.
 *
 * **Quem consome isso e `perfis.situacaoDoCanal`**, a barreira que impede a rodada de responder
 * com o nome do candidato errado (25/09). Com o numero do CONTATO no lugar do numero do CANAL ela
 * comparava a coisa errada nos dois sentidos: nunca reconhecia o canal dele (e pulava todo
 * contato), e **podia dizer `meu` por acidente** se o telefone de um eleitor coincidisse com um
 * numero cadastrado — que e a direcao perigosa, porque ai a mensagem sai.
 *
 * O canal e o `instance_id` da conversa (um uuid), e o telefone dele mora em `whatsapp_instances`.
 * **O cache existe porque isto roda a cada contato aberto** — uma requisicao por `load()` e
 * exatamente o que derruba esta API (e a licao de `contarMeuDia`, 24/09). Cinco minutos e o mesmo
 * frescor que a rodada ja usa para a saude do canal.
 *
 * **Falhar devolve `null` e nunca um palpite:** sem numero a barreira cai no uuid do canal, que e
 * identidade de verdade; com numero errado ela afirmaria.
 */
const FRESCOR_DOS_CANAIS_MS = 5 * 60 * 1000;
let canaisEmCache = { quando: 0, lista: null };

export async function canaisFrescos({ agora = Date.now(), canais = null } = {}) {
  // Lista ja conhecida (a rodada le a saude do canal uma vez por rodada) nao vira requisicao nova.
  if (canais) return canais;
  if (canaisEmCache.lista && agora - canaisEmCache.quando < FRESCOR_DOS_CANAIS_MS) return canaisEmCache.lista;
  const lista = await canaisDaConta();
  canaisEmCache = { quando: agora, lista };
  return lista;
}

export async function numeroDoCanal(opcoes = {}) {
  const r = await perguntarAoGancho('aberta', {}, opcoes);
  const canalId = String(r?.payload?.conversa?.instance_id || '').trim();
  if (!canalId) return null;
  try {
    const canal = (await canaisFrescos(opcoes)).find((c) => c.id === canalId);
    return canal?.numero || null;
  } catch (_) {
    // Leitura que nao voltou nao e "o canal nao tem numero": a barreira decide pelo uuid.
    return null;
  }
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

/**
 * **MANDA A MENSAGEM NA CONVERSA QUE ESTA ABERTA NA TELA DELE.**
 *
 * O `page.sendText` do mobiliza.app digitava no campo e apertava enviar; aqui quem manda e a
 * funcao de borda, e o que amarra as duas metades e **qual conversa esta aberta** — por dois
 * sinais que tem de concordar.
 *
 * **Discordando, nao manda.** Afirmar a conversa errada aqui nao e mostrar a pessoa errada na
 * tela: e **mandar a mensagem de uma pessoa para outra**, e isso nao tem volta. Por isso o
 * `so-um-sinal` tambem nao serve para enviar — ele basta para o painel LER, nunca para escrever.
 */
export async function sendText(texto, { exigirDoisSinais = true, ...opcoes } = {}) {
  const st = await getState(opcoes);
  if (!st.ganchoRespondeu) throw new Error('Nao consegui ler qual conversa esta aberta (o gancho da pagina nao respondeu) — recuso mandar as cegas.');
  if (!st.sessionId) throw new Error('Nenhuma conversa aberta na tela — abra a conversa antes de enviar.');
  if (exigirDoisSinais && st.porQuantosSinais !== 'os-dois') {
    throw new Error(`Sei qual conversa esta aberta por UM sinal so (${st.porQuantosSinais}) — recuso enviar, porque errar aqui e mandar a mensagem de uma pessoa para outra.`);
  }
  return mandarTexto({ conversaId: st.sessionId, texto });
}
/**
 * **PÕE O TEXTO NO CAMPO DA CONVERSA ABERTA — e NÃO envia.**
 *
 * É a metade do desenho que ele escolheu em 26/10 (*"mostrar ANTES, com a tela junto"*): a rodada
 * decide, o texto aparece no campo dele, e quem aperta enviar é ele. Por isso ela **não exige os
 * dois sinais** da conversa aberta, ao contrário de `sendText`: aqui o texto não sai de lugar
 * nenhum, e o que estiver escrito está na tela dele, na conversa que ele está vendo.
 *
 * **A mecânica é a receita MEDIDA do `composer.js`** (o campo do mobiliza.app) aplicada ao React:
 * setter nativo do protótipo + evento `input`. A razão é a mesma dos dois lados — o framework
 * guarda o último valor que conhece e, atribuindo `campo.value` direto, ele trata o evento como
 * ruído e não atualiza o estado.
 *
 * **E a CONFERÊNCIA é o que torna isto honesto:** campo controlado por React que não reconheceu a
 * escrita devolve o valor antigo no próximo desenho — o texto aparece e some. `escreverNoCampo`
 * relê depois de dois quadros; não ficando, isto ESTOURA com o motivo, em vez de o painel dizer
 * "escrevi" sobre um campo vazio. É a mesma disciplina de `imagem.legendaEntrou`: 200 não prova
 * entrega, e `campo.value = x` não prova que o app viu.
 *
 * **Sem campo na tela a mensagem diz o que fazer**, porque a causa é conhecida e tem conserto de
 * um clique: medido em 27/10, a plataforma só cria o campo de mensagem **depois de assumir** a
 * conversa — numa conversa `aberto` os únicos `textarea` da tela são os dois de ANOTAÇÃO.
 */
export async function setComposerText(texto, opcoes = {}) {
  const r = await escreverNoCampo(texto, opcoes);
  if (r.ok) return true;

  if (r.motivo === 'sem-campo') {
    const editaveis = camposEditaveis(opcoes.raiz || document).length;
    throw new Error(
      editaveis === 0
        ? 'Campo de mensagem nao encontrado. Abra uma conversa antes.'
        : 'Esta conversa ainda nao tem campo de mensagem — a plataforma so o cria depois de ASSUMIR. Aperte Iniciar primeiro.'
    );
  }
  if (r.motivo === 'apagou') {
    throw new Error('Escrevi no campo e a plataforma apagou o texto — ela nao reconheceu a escrita. Me avise: isto e defeito do adaptador, nao seu.');
  }
  if (r.motivo === 'ficou-diferente') {
    throw new Error('Escrevi no campo e o que ficou la nao e o que eu mandei — nao confie no que esta escrito, confira antes de enviar.');
  }
  throw new Error(`Nao consegui escrever no campo de mensagem (${r.motivo}).`);
}

/** O campo de mensagem da tela, para quem precisa do elemento (foco, cursor). */
export function getComposer(opcoes = {}) {
  return campoDeMensagem(opcoes);
}
/**
 * **As tres teclas que mexem no atendimento ABERTO NA TELA DELE.**
 *
 * No mobiliza.app elas eram CLIQUES — e cada uma carregava uma armadilha de tela: o "Concluir"
 * eram dois cliques (menu mais item, e o sumico do botao nao servia de confirmacao), o
 * "Iniciar" exigia esperar o CAMPO aparecer e nao o botao sumir, e "Concluido" tinha dois
 * retratos diferentes. **Aqui as tres sao uma funcao do banco, com releitura.**
 *
 * O que NAO mudou e de qual conversa elas falam: a que esta aberta na tela, por dois sinais.
 * Para LER um sinal basta; para MEXER no atendimento, nao — assumir ou resolver a conversa
 * errada mexe no atendimento de outra pessoa.
 */
/**
 * **A RECUSA POR UM SINAL SO NAO E ERRO DE AMBIENTE — e era isso que parava a rodada inteira**
 * (28/10/2026, relato dele: *"comecar pelas nao atendidas tem dado erro"*).
 *
 * O painel traduz toda excecao de `clickIniciar` em `resultado: 'erro'`, e `erro` PARA a rodada
 * de proposito (aba trocou, campo de mensagem sumiu — coisas que nao adianta tentar no proximo).
 * **Esta nao e uma delas:** ela diz *"a tela ainda nao se decidiu sobre ESTE contato"*, e o
 * proximo pode estar perfeitamente legivel.
 *
 * O marcador e o TEXTO porque e so o texto que atravessa a ponte: no modo janela a excecao
 * viaja por `rpc` e vira mensagem, perdendo qualquer propriedade que se pendure nela.
 */
export const MARCA_SINAL_FRACO = 'UM sinal so';

export function ehRecusaPorSinalFraco(mensagem) {
  return String(mensagem || '').includes(MARCA_SINAL_FRACO);
}

/**
 * **ESPERA os dois sinais concordarem — a recusa estava certa e a PRESSA e que estava errada.**
 *
 * `openQueueSession` devolve assim que o clique na linha volta, e nesse instante so um dos dois
 * sinais costuma ter redesenhado: a linha da fila ja esta `ativa`, o painel da direita ainda nao
 * (ou o contrario). `conversaDaTela` lia UMA vez, via `so-um-sinal` e recusava — a rodada parava
 * no segundo contato.
 *
 * **Nao afrouxa a guarda, e isso e o ponto:** `os-dois` continua obrigatorio para assumir,
 * resolver, reabrir e enviar. Assumir com um sinal so mexe no atendimento de outra pessoa. O que
 * muda e **dar tempo** de os dois concordarem, em vez de decidir no primeiro quadro.
 *
 * Custa quase nada: `getState` pergunta ao gancho e **nao toca na rede** (medido: os dois sinais
 * juntos custam menos de 1 ms). A espera so acontece quando a tela ainda nao se decidiu.
 */
const PRAZO_DOS_SINAIS_MS = 4000;
const INTERVALO_DOS_SINAIS_MS = 150;

export async function esperarOsDoisSinais({ id = '', prazoMs = PRAZO_DOS_SINAIS_MS, intervaloMs = INTERVALO_DOS_SINAIS_MS, agora = () => Date.now(), espera = null, ...opcoes } = {}) {
  const dormir = espera || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const alvo = String(id || '');
  const ate = agora() + prazoMs;

  const pronto = (s) => s.ganchoRespondeu && s.porQuantosSinais === 'os-dois' && (!alvo || s.sessionId === alvo);
  /**
   * **Quando parar de esperar por falta de esperanca.** Gancho mudo nunca vira resposta.
   * *"Nenhuma conversa aberta"* e resposta FINAL quando nao se espera ninguem em particular — mas
   * e o estado NORMAL logo depois de um clique, enquanto o React ainda nao desenhou. Por isso ela
   * so conta como final sem `id`.
   */
  const semEsperanca = (s) => !s.ganchoRespondeu || (!alvo && !s.sessionId);

  let st = await getState(opcoes);
  while (!pronto(st) && !semEsperanca(st) && agora() < ate) {
    await dormir(intervaloMs);
    st = await getState(opcoes);
  }
  return st;
}

async function conversaDaTela(oque, opcoes = {}) {
  const st = await esperarOsDoisSinais(opcoes);
  if (!st.ganchoRespondeu) throw new Error(`${oque}: nao consegui ler qual conversa esta aberta — recuso mexer as cegas.`);
  if (!st.sessionId) throw new Error(`${oque}: Nenhuma conversa aberta na tela — abra a conversa antes.`);
  if (st.porQuantosSinais !== 'os-dois') {
    throw new Error(`${oque}: sei qual conversa esta aberta por ${MARCA_SINAL_FRACO} (${st.porQuantosSinais}) — recuso, porque errar aqui mexe no atendimento de outra pessoa.`);
  }
  return st.sessionId;
}

export async function clickIniciar(opcoes = {}) {
  const id = await conversaDaTela('Assumir', opcoes);
  /**
   * **Primeiro o botao da TELA.** A funcao do banco muda o status e o React nao fica sabendo
   * (28/10/2026, Marileide: "Aguardando atendente" e o botao Assumir continuavam na tela, e a
   * rodada parava com "a plataforma nao assumiu"). O clique e o que a propria plataforma faz,
   * e e ele que cria o campo de mensagem.
   *
   * Sem o botao na tela, cai na funcao do banco — a conversa pode ja ter sido assumida por uma
   * rodada anterior que nao atualizou a tela.
   */
  const clique = await perguntarAoGancho('assumir', {}, opcoes);
  if (!clique?.payload?.ok) {
    const prova = await assumirConversa(id);
    if (prova.ok === false) {
      throw new Error('Assumir: a plataforma nao mudou esta conversa para em atendimento.');
    }
  }
  let estado = await getState(opcoes);
  for (let i = 0; i < 40 && estado.sessionId === id && (estado.isPending || !estado.hasComposer); i++) {
    await new Promise((r) => setTimeout(r, 200));
    estado = await getState(opcoes);
  }
  return estado;
}

export async function clickConcluir(opcoes = {}) {
  return resolverConversa(await conversaDaTela('Resolver', opcoes));
}

export async function clickReiniciar(opcoes = {}) {
  return reabrirConversa(await conversaDaTela('Reabrir', opcoes));
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
