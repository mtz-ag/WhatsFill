/**
 * **A PLATAFORMA NOVA (mobiliza.me)** — o que foi medido na pagina dele em 26/10/2026 virando
 * invariante.
 *
 * Tres coisas sao provadas, e a segunda e a mais cara se cair:
 *
 *  1. **a sessao**: o que e sessao utilizavel e o que nao e — sessao pela metade nao vira sessao;
 *  2. **o `tenant_id`**: consulta sem ele e RECUSADA. A plataforma e multi-tenant (dois tenants
 *     apareceram na sessao dele), e consulta sem tenant le a base de outra campanha;
 *  3. **a traducao da linha do banco** para a forma que a rodada, os detectores e a IA ja leem —
 *     `entrantes`/`nossas`/`ultima`. Duas formas para a mesma coisa divergem na primeira correcao.
 *
 * Rode: node tests/mob.test.mjs
 */
import { check, grupo, fim } from './_harness.mjs';
import {
  TABELAS,
  REST,
  lerSessao,
  sessaoExpirada,
  url,
  mensagemDoBanco,
  conversaDoBanco,
  ehGrupo,
} from '../src/lib/mob.js';

grupo('a sessao do Supabase: so o que da para trabalhar');
{
  const boa = JSON.stringify({
    access_token: 'jwt.de.mentira',
    refresh_token: 'r',
    expires_at: 2000000000,
    user: { id: 'u-1', email: 'nao-importa@exemplo.com' },
  });

  const s = lerSessao(boa);
  check(s?.token === 'jwt.de.mentira', 'le o access_token');
  check(s?.usuarioId === 'u-1', 'le o id do usuario');
  check(s?.expiraEm === 2000000000, 'le o vencimento');

  /**
   * **So o id do usuario sai daqui.** Nome e e-mail dele vem na sessao e nao fazem falta a nada —
   * campo que ninguem usa e campo que vaza no primeiro log.
   */
  check(!('email' in (s || {})) && !('refresh' in (s || {})), 'e nada mais: sem e-mail, sem refresh_token');

  check(lerSessao('') === null, 'texto vazio nao e sessao');
  check(lerSessao(null) === null, 'nulo nao e sessao');
  check(lerSessao('{nao e json') === null, 'JSON quebrado nao e sessao');
  check(lerSessao('"so uma string"') === null, 'string solta nao e sessao');
  check(lerSessao(JSON.stringify({ user: { id: 'u' } })) === null, 'sessao SEM access_token nao vira sessao pela metade');
  check(lerSessao(JSON.stringify({ access_token: '   ' })) === null, 'token em branco tambem nao');
}

grupo('vencimento: nao saber quando vence NAO e estar vencida');
{
  const agora = 1_700_000_000_000; // ms
  const emSegundos = (ms) => Math.floor(ms / 1000);

  check(sessaoExpirada({ token: 't', expiraEm: emSegundos(agora) - 10 }, agora) === true, 'vencida ha 10s: vencida');
  check(sessaoExpirada({ token: 't', expiraEm: emSegundos(agora) + 600 }, agora) === false, 'faltando 10 min: vale');

  /** A folga existe porque a sessao pode vencer ENTRE a conferencia e a resposta da chamada. */
  check(sessaoExpirada({ token: 't', expiraEm: emSegundos(agora) + 30 }, agora) === true, 'faltando 30s: ja conta como vencida (a folga e de 60s)');

  /**
   * **Ausencia nao e evidencia** — a mesma licao do `undefined !== 'CONNECTED'` (01/10) e do
   * `donoDoCanal` (25/09). Tratar `expires_at` ausente como vencimento desligaria a extensao
   * inteira no dia em que o Supabase trocar o nome do campo; quem responde de verdade e o 401.
   */
  check(sessaoExpirada({ token: 't', expiraEm: 0 }, agora) === false, 'sem vencimento declarado, NAO se declara vencida');
  check(sessaoExpirada(null, agora) === false, 'sem sessao nao ha vencimento a declarar');
}

grupo('a consulta: o tenant e obrigatorio, e a tabela e lista de permissao');
{
  const tenantId = 'b804ca0b-0000-0000-0000-000000000000';

  const u = url('conversas', { tenantId, limite: 100, ordem: 'ultima_mensagem_em.desc' });
  check(u.startsWith(REST + TABELAS.conversas + '?'), 'aponta para a tabela certa');
  check(u.includes(`tenant_id=eq.${tenantId}`), 'o tenant vai SEMPRE na consulta');
  check(u.includes('limit=100') && u.includes('order='), 'ordem e limite entram');

  /**
   * **A guarda que separa a base dele da base de outro cliente.** Sem tenant a consulta e recusada
   * AQUI, antes de sair: falta de dado nao pode virar "pega tudo".
   */
  let recusou = false;
  try { url('conversas', { tenantId: '' }); } catch (e) { recusou = /tenant/i.test(e.message); }
  check(recusou, 'consulta SEM tenant e recusada, com o motivo escrito');

  let recusouTabela = false;
  try { url('tabela_que_ninguem_mediu', { tenantId }); } catch (e) { recusouTabela = /desconhecida/i.test(e.message); }
  check(recusouTabela, 'tabela fora da lista de permissao e recusada');

  check(url(TABELAS.mensagens, { tenantId }).includes(TABELAS.mensagens), 'o nome real da tabela tambem serve de chave');

  /**
   * **Filtro e texto dentro da query string.** Nesta base o que entra em filtro e nome de eleitor e
   * telefone; um `&` ou um `#` no meio reescreveria a consulta inteira.
   */
  const comNome = url('contatos', { tenantId, filtros: { nome: 'eq.Maria & Cia #1' } });
  check(!comNome.includes('Maria & Cia'), 'o valor do filtro vai escapado');
  check(comNome.includes(encodeURIComponent('eq.Maria & Cia #1')), 'e escapado inteiro');

  check(!url('conversas', { tenantId, filtros: { instance_id: '' } }).includes('instance_id'),
    'filtro vazio nao entra na consulta: sem canal escolhido e a fila inteira, nao a fila de canal nenhum');
}

grupo('a mensagem do banco vira o que os detectores ja leem');
{
  const texto = mensagemDoBanco({
    id: 'm1', conteudo: 'Boa tarde, sou de Canoas', tipo: 'TEXT',
    is_outgoing: false, created_at: '2026-10-26T12:00:00Z',
  });
  check(texto.texto === 'Boa tarde, sou de Canoas' && texto.doContato === true, 'texto do contato');
  check(texto.transcrito === false, 'texto digitado nao e transcricao');

  /**
   * **A transcricao virou COLUNA** (`transcricao`), e e o unico texto que um audio tem. A marca
   * `transcrito` continua existindo porque quem le depois precisa saber: transcricao e fala passada
   * por reconhecimento automatico, e este projeto proibe que ela decida "sem interesse" (03/09) e a
   * grava sempre rebaixada no parser (31/08).
   */
  const audio = mensagemDoBanco({
    conteudo: '', transcricao: 'entao eu queria saber do material', tipo: 'AUDIO',
    is_outgoing: false, created_at: '2026-10-26T12:01:00Z',
  });
  check(audio.texto === 'entao eu queria saber do material', 'audio traz a transcricao como texto');
  check(audio.transcrito === true, 'e marcado como transcrito');

  const nossa = mensagemDoBanco({ conteudo: 'Obrigado!', is_outgoing: true, created_at: '2026-10-26T12:02:00Z' });
  check(nossa.doContato === false, 'o que NOS mandamos nao e do contato');

  /** O ruido da plataforma vem MARCADO agora, em vez de reconhecido por texto (02/09). */
  check(mensagemDoBanco({ conteudo: 'Aguardando mensagem.', is_sistema: true }).sistema === true,
    'mensagem de sistema chega marcada pelo proprio banco');

  /**
   * **A PERDA MEDIDA, e esta dita a ele:** nao ha relogio do WhatsApp separado do da plataforma,
   * nem tamanho de arquivo. Sao os dois campos de que `marcarLoteEncaminhado` vive (a Irene,
   * 07/09), entao o audio ENCAMINHADO deixa de ser reconhecido aqui. `ts` cai no `created_at` — ele
   * nao mente sobre o que e; so faz a conta sempre dizer "cabe na janela".
   */
  check(audio.ts === audio.at, 'sem relogio do WhatsApp, o ts e o da plataforma');
  check(audio.bytes === 0, 'e o tamanho do arquivo nao existe neste banco');

  const vazia = mensagemDoBanco(null);
  check(vazia.texto === '' && vazia.tipo === 'TEXT', 'linha vazia nao estoura');
}

grupo('a conversa da fila');
{
  const c = conversaDoBanco({
    id: 'c1', contato_id: 'ct1', instance_id: 'in1', nome: 'Marta Fictinha', numero: '5551999990000',
    external_chat_id: '5551999990000@s.whatsapp.net',
    status: 'aberto', nao_lidas: 3, ultima_direcao: 'entrada', tags: ['APOIADOR', 'SERRA'],
  });
  check(c.nome === 'Marta Fictinha' && c.naoLidas === 3, 'nome e nao lidas');
  check(c.grupo === false, 'conversa de pessoa nao e grupo');

  /**
   * **As etiquetas viraram uma COLUNA de texto.** Some com isso a armadilha mais cara da base
   * antiga: etiquetas de ROTULO REPETIDO com ids diferentes, que produziram
   * `Caxias do Sul → Serra (tem: Serra)` em 1293 contatos. Aqui o rotulo E a identidade.
   */
  check(c.tags.length === 2 && c.tags.includes('SERRA'), 'as etiquetas vem como texto');
  check(conversaDoBanco({ tags: null }).tags.length === 0, 'sem etiqueta nenhuma, lista vazia');

  check(conversaDoBanco(null).id === null, 'linha vazia nao estoura');
}

grupo('GRUPO ou pessoa: a coluna que parece responder nao responde');
{
  /**
   * **Medido na base dele em 26/10/2026, antes de ir ao ar:** 109 conversas tem
   * `external_chat_id` terminando em `@g.us`, e **nenhuma delas tem `grupo_id`** — a coluna e nula
   * na base inteira. A guarda obvia (`!!grupo_id`) teria deixado 109 grupos entrarem na fila como
   * se fossem contatos, e a rodada publicaria resposta de atendimento para dezenas de pessoas.
   *
   * Quem responde e o endereco do chat no WhatsApp, que e o que a propria plataforma filtra.
   */
  check(ehGrupo({ external_chat_id: '120363000000000000@g.us' }) === true, 'chat @g.us e grupo');
  check(ehGrupo({ external_chat_id: '120363000000000000@g.us', grupo_id: null }) === true,
    'e continua sendo grupo com grupo_id NULO — o caso real das 109');
  check(ehGrupo({ external_chat_id: '0@newsletter' }) === true, 'canal de transmissao tambem fica de fora');
  check(ehGrupo({ external_chat_id: 'status@broadcast' }) === true, 'lista de transmissao tambem');

  check(ehGrupo({ external_chat_id: '5551999990000@s.whatsapp.net' }) === false, 'pessoa nao e grupo');
  check(ehGrupo({ external_chat_id: '5551999990000@c.us' }) === false, 'a outra forma de pessoa tambem nao');

  /**
   * **Na duvida, e grupo.** Deixar de atender alguem custa uma passada; mandar para um grupo nao
   * tem volta — e a mesma assimetria do `jaCurtido` (nao desfazer vence mostrar demais).
   */
  check(ehGrupo({ external_chat_id: '' }) === true, 'sem endereco legivel, fica de fora da fila');
  check(ehGrupo({}) === true, 'linha sem o campo, idem');
  check(ehGrupo(null) === true, 'linha nenhuma, idem');

  check(conversaDoBanco({ external_chat_id: '120363@g.us' }).grupo === true, 'e a conversa da fila herda a guarda');
}

fim();
