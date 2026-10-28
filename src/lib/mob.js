/**
 * mob.js — UNICO arquivo que sabe como a plataforma NOVA (mobiliza.me) e montada por dentro.
 *
 * E o irmao de `api.js` (que fala com o mobiliza.app antigo) e de `dom.js` (que le a tela dele).
 * Mudou tudo o que esta embaixo; **nada do que decide o que sai para o eleitor mudou** — o quadro,
 * a tabela de regras, os detectores, a IA e as respostas prontas continuam onde estao.
 *
 * ---------------------------------------------------------------------------
 * O QUE FOI MEDIDO NA PAGINA DELE EM 26/10/2026 (e nao chutado)
 * ---------------------------------------------------------------------------
 *
 * **A plataforma foi REESCRITA, nao atualizada.** O mobiliza.app era Angular + Material falando
 * com `api.mobiliza.app`; o mobiliza.me e **React + Vite** (um pacote so, `/assets/index-*.js`)
 * falando **direto com o Supabase** por PostgREST. Consequencias que valem mais que o codigo:
 *
 *  1. **NAO HA `data-cy` NENHUM.** Varri os atributos `data-*` da tela inteira: o unico que existe
 *     e `data-state`, do Radix. Entao `dom.js` — o arquivo que lia a fila, o campo de mensagem e o
 *     botao de concluir — **nao tem nada para ler aqui**. A regra do projeto (*"prefira `data-cy` a
 *     texto"*) deixou de ter onde se aplicar.
 *  2. **E nao precisa ter.** Tudo o que o painel fazia pela TELA vira consulta: a fila e uma
 *     tabela, a conversa e uma tabela, concluir e uma funcao. E o caminho que a rodada de DISPARO
 *     (`percorrerContatos`) ja usava desde 01/10 — ela nunca abriu conversa nenhuma.
 *  3. **A conversa aberta NAO esta na URL** (`/admin/interacoes/conversas`, sem `/:id` — conferido
 *     nas 424 rotas do pacote). Ou seja: nao da para saber pela barra de endereco quem ele esta
 *     olhando. Isso **nao e obstaculo**, e a confirmacao de que a rodada aqui anda pela API.
 *  4. **O `Origin` deixou de ser o carcereiro.** A API velha respondia `500 Origin not allowed`
 *     fora da aba, e era por isso que TUDO tinha de sair de dentro dela. O PostgREST autentica por
 *     header. **Mesmo assim as chamadas continuam saindo da aba nesta versao**, por uma razao que
 *     nao mudou: *o token vive no localStorage da pagina*. Que o Supabase aceite a origem da
 *     extensao e HIPOTESE — nao foi medido, e hipotese aqui e rodada que para no primeiro contato.
 *
 * ---------------------------------------------------------------------------
 * O TOKEN, E POR QUE ELE CONTINUA SEM SAIR DA ABA
 * ---------------------------------------------------------------------------
 *
 * A sessao do Supabase fica em `localStorage`, na chave `sb-<ref>-auth-token`, com os campos
 * `access_token`, `refresh_token`, `expires_at` e `user` (medido: 2.076 caracteres).
 *
 * **Isto e mais simples e mais perigoso que o Bearer antigo.** Mais simples porque acabou a
 * interceptacao do `page-hook` — e so ler a chave. Mais perigoso porque o `refresh_token` do
 * Supabase renova a sessao sozinho: quem o tiver entra na conta dele quando quiser.
 *
 * **Por isso vale aqui a mesma regra da chave da IA e do token do Facebook:** o que atravessa a
 * ponte e o RESULTADO da consulta, nunca a credencial. `lerSessao` existe para o lado da aba; o
 * painel em janela separada pede a consulta pronta (ver `page.js`).
 *
 * ---------------------------------------------------------------------------
 * MULTI-TENANT: A COISA NOVA MAIS FACIL DE ERRAR
 * ---------------------------------------------------------------------------
 *
 * A plataforma velha era de um cliente so. **Esta nao.** Na sessao dele apareceram DOIS tenants
 * (`b804ca0b…`, o ativo, e `f5ed4010…`), e toda consulta do app carrega `tenant_id=eq.<id>`.
 *
 * **Consulta sem `tenant_id` le a base de outra campanha** — e, pior, escrita sem `tenant_id` a
 * contamina. E o irmao exato da separacao por CANDIDATO que o `perfis.js` faz desde 25/09, com a
 * diferenca de que ali o estrago era texto errado e aqui e dado de eleitor de outro cliente.
 *
 * Por isso `tenantAtivo()` e obrigatorio em todo lugar e **nao tem valor padrao**: sem ele a
 * consulta e RECUSADA aqui, antes de sair. Falta de dado nao vira "pega tudo".
 */

/** O host da plataforma nova. O antigo (`mobiliza.app`) continua em `page.js`. */
export const HOST = 'mobiliza.me';

/** O projeto Supabase da plataforma. Lido das proprias requisicoes dela. */
export const SUPABASE = 'https://hmwplthwqbscprkjxrbe.supabase.co';
export const REST = SUPABASE + '/rest/v1/';
export const FUNCOES = SUPABASE + '/functions/v1/';

/** Onde a sessao e o tenant ativo moram no `localStorage` da pagina. */
export const CHAVE_SESSAO = 'sb-hmwplthwqbscprkjxrbe.supabase.co-auth-token';
export const CHAVE_TENANT = 'mobiliza_active_tenant_id';

/**
 * As tabelas e funcoes que esta extensao conhece — **lista de PERMISSAO**, como os formatos de
 * imagem e os modelos que aceitam `effort`.
 *
 * O motivo e o mesmo de sempre: a lista inversa faz tabela nova nascer acessivel ate alguem notar,
 * e o "notar" aqui seria uma escrita em dado de eleitor numa tabela que ninguem mediu.
 *
 * Nomes conferidos no pacote da plataforma (`useWhatsAppAtendimento`, `Atendimento`,
 * `useCRMContatos`, `useExistingTags`) e nas requisicoes que ela faz.
 */
export const TABELAS = Object.freeze({
  conversas: 'whatsapp_conversas',
  mensagens: 'whatsapp_mensagens',
  contatos: 'base_dados',
  canais: 'whatsapp_instances',
  respostas: 'whatsapp_templates',
});

/**
 * As funcoes do banco que a plataforma chama para MEXER numa conversa.
 *
 * Elas estao aqui porque sao o vocabulario da rodada nova — `assumir`, `resolver`, `reabrir` sao,
 * byte a byte, o "assumir atendimento", "concluir" e "reiniciar" do painel de hoje. **Nenhuma e
 * chamada nesta versao:** nada aqui escreve ainda (ver o cabecalho de `buscar`).
 */
export const RPCS = Object.freeze({
  marcarLida: 'fn_marcar_conversa_lida',
  assumir: 'assumir_conversa',
  liberar: 'liberar_conversa',
  transferir: 'transferir_conversa',
  resolver: 'resolver_conversa',
  reabrir: 'reabrir_conversa',
  contagens: 'whatsapp_inbox_contagens',
  operadores: 'listar_operadores_tenant',
});

/** A funcao de borda que ENVIA. Lida no pacote; **nunca executada por esta extensao ainda**. */
export const FUNCAO_ENVIAR = 'enviar-mensagem-atendimento';

/* ------------------------------------------------------------------ *
 * Sessao — puro, para ter teste                                       *
 * ------------------------------------------------------------------ */

/**
 * Le a sessao do Supabase a partir do TEXTO que esta no `localStorage`.
 *
 * **Puro de proposito:** quem decide se a extensao pode trabalhar e esta funcao, e ela precisa de
 * teste. O lado que toca o `localStorage` e `sessaoDaPagina`, embaixo.
 *
 * Devolve `null` em tudo o que nao for sessao utilizavel — texto vazio, JSON quebrado, objeto sem
 * `access_token`. **Sessao pela metade nao vira sessao:** o painel prefere dizer "entre de novo na
 * plataforma" a montar uma requisicao que volta 401 no meio de uma rodada.
 */
export function lerSessao(texto) {
  let bruto = null;
  try {
    bruto = JSON.parse(String(texto || ''));
  } catch (e) {
    return null;
  }
  if (!bruto || typeof bruto !== 'object') return null;

  const token = String(bruto.access_token || '').trim();
  if (!token) return null;

  return {
    token,
    /** Segundos desde a época, como o Supabase grava. Pode faltar: ver `sessaoExpirada`. */
    expiraEm: Number(bruto.expires_at) || 0,
    /** So o id. Nome e e-mail dele nao fazem falta a nada aqui. */
    usuarioId: String(bruto.user?.id || '') || null,
  };
}

/**
 * A sessao ja venceu?
 *
 * **`expires_at` ausente devolve `false`, e isso e deliberado:** nao saber quando vence nao e o
 * mesmo que estar vencida. Tratar ausencia como vencimento desligaria a extensao inteira no dia em
 * que o Supabase mudar o nome do campo — e quem responde de verdade e o 401 da chamada.
 *
 * A folga de 60s existe porque a sessao pode vencer ENTRE a conferencia e a resposta.
 */
export function sessaoExpirada(sessao, agora = Date.now(), folgaSeg = 60) {
  if (!sessao || !sessao.expiraEm) return false;
  return sessao.expiraEm * 1000 <= agora + folgaSeg * 1000;
}

/* ------------------------------------------------------------------ *
 * Montagem de consulta — puro, para ter teste                         *
 * ------------------------------------------------------------------ */

/**
 * Monta a URL de uma consulta PostgREST.
 *
 * **Tres guardas, e nenhuma e enfeite:**
 *
 *  1. **Tabela fora de `TABELAS` e recusada** — a lista de permissao do cabecalho.
 *  2. **`tenant_id` e obrigatorio** e vem por argumento proprio, nunca escondido no meio dos
 *     filtros: e a unica coisa que separa a base dele da base de outro cliente.
 *  3. **O valor vai por `encodeURIComponent`**, porque filtro de PostgREST e texto dentro da query
 *     string: um nome com `&` ou `#` dentro reescreveria a consulta. Nesta base o que entra em
 *     filtro e nome de eleitor e telefone.
 */
export function url(tabela, { tenantId, select = '*', filtros = {}, ordem = '', limite = 0 } = {}) {
  const nome = TABELAS[tabela] || (Object.values(TABELAS).includes(tabela) ? tabela : '');
  if (!nome) throw new Error(`mob: tabela desconhecida (${tabela})`);
  if (!tenantId) throw new Error('mob: consulta sem tenant — recuso, para nao ler a base de outra campanha');

  const partes = [`select=${encodeURIComponent(select)}`, `tenant_id=eq.${encodeURIComponent(tenantId)}`];
  for (const [campo, valor] of Object.entries(filtros)) {
    if (valor == null || valor === '') continue;
    partes.push(`${encodeURIComponent(campo)}=${encodeURIComponent(valor)}`);
  }
  if (ordem) partes.push(`order=${encodeURIComponent(ordem)}`);
  if (limite > 0) partes.push(`limit=${Math.floor(limite)}`);

  return REST + nome + '?' + partes.join('&');
}

/* ------------------------------------------------------------------ *
 * As linhas do banco viram o que o painel ja sabe ler — puro          *
 * ------------------------------------------------------------------ */

/**
 * Uma mensagem do banco no formato que `prepararEntrantes` ja consome.
 *
 * **O ganho:** a transcricao do audio virou COLUNA (`transcricao`), com `transcricao_status` do
 * lado. Antes ela morava em `details.transcription.text` e a extensao precisou de uma entrada
 * inteira no CLAUDE.md para lembrar que `incoming` a filtrava fora.
 *
 * **A PERDA, e ela e real — esta dita a ele:** nao ha `timestamp` do WhatsApp separado do
 * `created_at` da plataforma, nem o TAMANHO do arquivo. Sao exatamente os dois campos de que
 * `cortesia.marcarLoteEncaminhado` vive (o caso da Irene, 07/09: cinco audios de minutos entregues
 * em dois segundos). **Entao o reconhecimento de audio ENCAMINHADO para de funcionar aqui**, e nao
 * ha como contornar sem um campo que o banco nao tem. `ts` continua sendo devolvido com o
 * `created_at` — ele nao mente sobre o que e, so deixa a conta sempre dar "cabe na janela".
 *
 * `is_sistema` e a outra novidade: o ruido da plataforma (*"nao foi possivel transcrever"*) vem
 * MARCADO, em vez de ser reconhecido por texto como `cortesia.ehMensagemDaPlataforma` faz. A marca
 * e repassada; quem decide o que fazer com ela continua sendo o painel.
 */
export function mensagemDoBanco(linha) {
  const m = linha || {};
  const transcricao = String(m.transcricao || '').trim();
  const conteudo = String(m.conteudo || '').trim();
  return {
    id: m.id || null,
    texto: conteudo || transcricao,
    tipo: String(m.tipo || 'TEXT').toUpperCase(),
    transcrito: !conteudo && !!transcricao,
    doContato: !m.is_outgoing,
    sistema: !!m.is_sistema,
    at: m.created_at || null,
    // Sem relogio do WhatsApp neste banco: o unico horario e o da plataforma. Ver o comentario.
    ts: m.created_at || null,
    bytes: 0,
  };
}

/**
 * Uma conversa da fila, com os campos que a rodada usa para decidir se abre.
 *
 * `nao_lidas`, `aguardando_desde` e `sla_status` sao do banco novo e nao tinham equivalente: o
 * antigo exigia abrir o atendimento para saber se havia algo esperando.
 */
export function conversaDoBanco(linha) {
  const c = linha || {};
  return {
    id: c.id || null,
    contatoId: c.contato_id || null,
    canalId: c.instance_id || null,
    nome: String(c.nome || '').trim(),
    numero: String(c.numero || '').trim(),
    status: String(c.status || '').toLowerCase(),
    atendenteId: c.atendente_id || null,
    naoLidas: Number(c.nao_lidas) || 0,
    ultimaEm: c.ultima_mensagem_em || null,
    ultimaDirecao: String(c.ultima_direcao || '').toLowerCase(),
    aguardandoDesde: c.aguardando_desde || null,
    // As etiquetas agora sao um ARRAY DE TEXTO, e nao mais ids numa tabela a parte: some a
    // criacao de etiqueta. **A armadilha do rotulo repetido NAO some — ela troca de cara**, e eu
    // tinha escrito aqui que sumia. Medido em 27/10/2026, 87 rotulos distintos em 439 contatos:
    // "⛔ 1 SEM RETORNO" e "⛔ 1 Sem Retorno", "PRODUCAO" e "Producao", "SERRA " com espaco no
    // fim. La eram dois ids com o mesmo rotulo; aqui e o mesmo conceito escrito de jeitos
    // diferentes num campo livre. Quem compara etiqueta usa `page-mob.chaveDaEtiqueta`.
    // **E na CONVERSA a coluna existe e esta vazia** (medido: 0 de 300 com itens) — as etiquetas
    // vivem no contato.
    tags: Array.isArray(c.tags) ? c.tags.map((t) => String(t)) : [],
    grupo: ehGrupo(c),
  };
}

/**
 * **ISTO E GRUPO OU PESSOA? — e a coluna que PARECE responder nao responde** (medido em
 * 26/10/2026, antes de qualquer linha ir ao ar).
 *
 * Eu havia escrito a guarda como `!!linha.grupo_id`, que e o nome obvio. Medido na base dele:
 *
 * ```
 * conversas com external_chat_id terminando em @g.us ....... 109
 * dessas, com grupo_id preenchido ...........................   0
 * conversas com grupo_id preenchido em toda a base ..........   0
 * ```
 *
 * **`grupo_id` e sempre nulo.** A guarda teria devolvido `false` para as 109 e a rodada trataria um
 * grupo de WhatsApp como contato comum — resposta de atendimento publicada para dezenas de pessoas,
 * com o nome dele em cima. E o erro que nao se desfaz.
 *
 * Quem responde de verdade e o **`external_chat_id`**, que e o endereco do chat no WhatsApp:
 * `<numero>@g.us` e grupo e `@newsletter` e canal de transmissao. E exatamente o que a propria
 * plataforma filtra nas requisicoes dela — a resposta estava na tela o tempo todo.
 *
 * **Na duvida, e grupo.** Sem `external_chat_id` legivel a conversa fica de fora da fila: deixar de
 * atender alguem custa uma passada; mandar para um grupo nao tem volta.
 */
export function ehGrupo(linha) {
  const chat = String(linha?.external_chat_id || '').toLowerCase();
  if (!chat) return true;
  return chat.endsWith('@g.us') || chat.endsWith('@newsletter') || chat.includes('@broadcast');
}

/* ------------------------------------------------------------------ *
 * A partir daqui e PAGINA: roda dentro da aba do mobiliza.me          *
 * ------------------------------------------------------------------ */

/** Estamos dentro da aba da plataforma nova? */
export function naPagina() {
  return typeof location !== 'undefined' && location.hostname === HOST;
}

/** A sessao que esta no `localStorage` da pagina, ou `null`. */
export function sessaoDaPagina() {
  try {
    return lerSessao(localStorage.getItem(CHAVE_SESSAO));
  } catch (e) {
    return null; // aba sem storage (modo restrito): o painel trata como "sem sessao"
  }
}

/** O tenant ATIVO — o que ele escolheu no seletor da plataforma. Sem valor padrao, de proposito. */
export function tenantAtivo() {
  try {
    return String(localStorage.getItem(CHAVE_TENANT) || '').trim() || null;
  } catch (e) {
    return null;
  }
}

/**
 * A chave publica (`anon`) do projeto Supabase, que o PostgREST exige no header `apikey`.
 *
 * **Ela e publica por desenho** — vai em toda requisicao do navegador e nao da acesso a nada
 * sozinha; quem autoriza e o `Authorization` com o token DELE, somado as politicas de linha do
 * banco. Mesmo assim ela nao esta escrita aqui: e lida do pacote da propria plataforma e guardada
 * em memoria, porque **valor copiado para ca envelhece calado** no dia em que o projeto mudar, e o
 * sintoma seria a extensao parar inteira sem ninguem ter mexido nela.
 *
 * O nome do arquivo do pacote carrega um hash que muda a cada publicacao, entao ele e descoberto
 * pela tag `<script>` da pagina — nunca escrito a mao.
 */
let chaveAnon = null;

export async function anon() {
  if (chaveAnon) return chaveAnon;

  const script = [...document.querySelectorAll('script[src]')]
    .map((s) => s.getAttribute('src') || '')
    .find((src) => /\/assets\/index-.*\.js$/.test(src));
  if (!script) throw new Error('mob: nao achei o pacote da plataforma para ler a chave publica');

  const texto = await fetch(script).then((r) => r.text());
  const achou = texto.match(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/);
  if (!achou) throw new Error('mob: o pacote da plataforma nao trouxe a chave publica');

  chaveAnon = achou[0];
  return chaveAnon;
}

/**
 * Uma consulta de LEITURA ao banco da plataforma.
 *
 * **Nesta versao a extensao so LE.** Escrever (assumir, responder, resolver, gravar cidade) exige
 * medir o corpo de cada funcao com uma sonda no contato de teste, e e a disciplina que este projeto
 * segue desde o contrato de escrita: *a API responde 200 e ignora* ja custou caro uma vez.
 *
 * O erro carrega a TABELA no texto, pela mesma razao que `api.js` poe a rota no `Failed to fetch`:
 * sem isso, "a plataforma parou de responder" nao diz se foi a fila, a conversa ou o contato.
 */
export async function buscar(tabela, opcoes = {}) {
  const sessao = sessaoDaPagina();
  if (!sessao) throw new Error('mob: sem sessao na plataforma — entre no mobiliza.me e recarregue');
  if (sessaoExpirada(sessao)) throw new Error('mob: a sessao da plataforma venceu — recarregue a aba');

  const endereco = url(tabela, { tenantId: opcoes.tenantId || tenantAtivo(), ...opcoes });
  const chave = await anon();

  let res;
  try {
    res = await fetch(endereco, {
      headers: { apikey: chave, Authorization: 'Bearer ' + sessao.token, Accept: 'application/json' },
    });
  } catch (err) {
    throw new Error(`${tabela} → ${err?.message || 'Failed to fetch'}`);
  }
  if (!res.ok) throw new Error(`${tabela} → ${res.status}`);
  return res.json();
}

/* ------------------------------------------------------------------ *
 * As leituras que a rodada precisa                                    *
 * ------------------------------------------------------------------ */

/**
 * A FILA: as conversas abertas ou em atendimento, da mais recente para a mais antiga.
 *
 * **Grupo e newsletter ficam de fora** (ver `ehGrupo`, e a medicao que la esta: sao 109 conversas
 * de grupo na base dele). Mandar resposta de atendimento num grupo e o erro que nao se desfaz.
 *
 * O filtro e feito AQUI, depois de ler, e nao na consulta: `not.like` precisa de sintaxe propria do
 * PostgREST que `url()` nao monta, e peneirar uma lista de 100 nao custa nada. **O preco esta
 * dito:** pedindo 100 e descartando os grupos, a fila util vem menor que o limite — quem chama
 * conta o que sobrou, nunca o que pediu.
 */
/**
 * **AS ABAS DA FILA, MEDIDAS NA TELA DELE (28/10/2026)** — relato: *"mandei comecar os meus que
 * agora mudou o nome, tem que trocar para o atual (todas, minhas etc) e travou e ficou parado sem
 * fazer nenhuma acao"*.
 *
 * A plataforma nova mostra **Todas / Minhas / Nao lidas**, com **Pessoas / Grupos** embaixo — nada
 * a ver com os `Novos / Meus / Outros` da velha. E a fila daqui **ignorava a aba por inteiro**:
 * `status in (aberto, em_atendimento)` para todo mundo, entao *"Comecar pelos Meus"* percorria a
 * fila INTEIRA, e nao os seis atendimentos dele.
 *
 * **O mapeamento saiu de contagem, nao de deducao.** Medido contra o numero que a propria tela
 * escreve no botao:
 * ```
 * tela "Minhas 6"  ==  status=em_atendimento & atendente_id=<eu>  ->  6    <- bate exato
 * status=aberto ......... 1080     em_atendimento ..... 11     resolvido ..... 47
 * ```
 *
 * **ABA DESCONHECIDA RECUSA, e isso nao e preciosismo:** cair no "todas" faria a rodada percorrer
 * a fila errada **em silencio**, que e exatamente o que o `avisoAba` da plataforma velha existe
 * para impedir (*"falhou a troca, a lista na tela e OUTRA"*). O mesmo vale sem saber quem e ele:
 * `Meus` e `Outros` sao a MESMA consulta com o sinal trocado, e errar o sinal entrega a fila de
 * outro operador.
 */
export const FILTRO_DA_ABA = {
  Novos: () => ({ status: 'eq.aberto' }),
  Meus: (uid) => ({ status: 'eq.em_atendimento', atendente_id: 'eq.' + uid }),
  Outros: (uid) => ({ status: 'eq.em_atendimento', atendente_id: 'neq.' + uid }),
  'Concluídos': () => ({ status: 'eq.resolvido' }),
  // Sem aba pedida, a fila e a da tela: tudo o que ainda nao foi resolvido.
  '': () => ({ status: 'in.(aberto,em_atendimento)' }),
};

/** Quem esta logado na plataforma — so o id, que e o que a fila de "Meus" precisa. */
export function meuUsuarioId() {
  return sessaoDaPagina()?.usuarioId || null;
}

export function filtroDaAba(aba, usuarioId) {
  const nome = String(aba || '');
  const monta = FILTRO_DA_ABA[nome];
  if (!monta) return { erro: `Nao sei qual fila e "${nome}" nesta plataforma (as abas sao Todas, Minhas e Nao lidas).` };
  if ((nome === 'Meus' || nome === 'Outros') && !usuarioId) {
    return { erro: `Para percorrer "${nome}" eu preciso saber quem esta logado na plataforma, e nao consegui ler isso da sessao.` };
  }
  return { filtros: monta(usuarioId) };
}

export async function fila({ canalId = '', limite = 100, aba = '', usuarioId = undefined } = {}) {
  const quem = usuarioId === undefined ? meuUsuarioId() : usuarioId;
  const daAba = filtroDaAba(aba, quem);
  if (daAba.erro) throw new Error(daAba.erro);

  const linhas = await buscar('conversas', {
    filtros: { ...daAba.filtros, instance_id: canalId ? 'eq.' + canalId : '' },
    ordem: 'ultima_mensagem_em.desc.nullslast',
    limite,
  });
  return linhas.map(conversaDoBanco).filter((c) => !c.grupo);
}

/**
 * A conversa inteira, no formato que o painel ja le (`entrantes`, `nossas`, `ultima`…).
 *
 * **A forma e a mesma de `api.getConversation` de proposito:** e ela que a rodada, os detectores e
 * a IA consomem, e duas formas para a mesma coisa divergem na primeira correcao.
 */
export async function conversa(conversaId, { limite = 200 } = {}) {
  if (!conversaId) throw new Error('mob: conversa sem id');
  const linhas = await buscar('mensagens', {
    filtros: { conversa_id: 'eq.' + conversaId },
    ordem: 'created_at.desc',
    limite,
  });

  const ordenadas = linhas.map(mensagemDoBanco).sort((a, b) => new Date(a.at) - new Date(b.at));
  const ultima = ordenadas[ordenadas.length - 1] || null;
  const nossas = ordenadas.filter((m) => !m.doContato);

  return {
    incoming: ordenadas.filter((m) => m.doContato && m.texto && !m.transcrito).map((m) => m.texto),
    entrantes: ordenadas.filter((m) => m.doContato),
    nossas: nossas.map((m) => ({ texto: m.texto, tipo: m.tipo, at: m.at })),
    ultima: ultima ? { doContato: ultima.doContato, at: ultima.at, texto: ultima.texto } : null,
    nossaUltimaAt: nossas.length ? nossas[nossas.length - 1].at : null,
  };
}

/** O cadastro do contato — a linha de `base_dados`. Campos de verdade, nao mais campo aprendido. */
export async function contato(contatoId) {
  if (!contatoId) return null;
  const linhas = await buscar('contatos', { filtros: { id: 'eq.' + contatoId }, limite: 1 });
  return linhas[0] || null;
}

/**
 * Os numeros da conta, com a saude de cada um.
 *
 * `provider` continua sendo **zapi** (medido) — entao tudo o que o CLAUDE.md diz sobre canal nao
 * oficial continua valendo: nao ha janela de 24h nem modelo aprovado, e o que pune e o RITMO e a
 * REPETICAO. O campo da conexao aqui e `status_conexao`.
 */
export async function canais() {
  return buscar('canais', { filtros: { is_active: 'eq.true' }, ordem: 'criado_em.desc', limite: 50 });
}

/** As respostas rapidas DELE, que agora moram na plataforma (`name`, `content`, `atalho`). */
export async function respostasDaPlataforma() {
  return buscar('respostas', { ordem: 'ordem.asc', limite: 200 });
}
