/**
 * Quem só agradeceu ou retribuiu depois da nossa resposta (31/10/2026).
 *
 * Rodada "Começar pelas não atendidas", Automático ligado, modo Normal. Ontem mandamos a
 * mensagem do momento (15:31) e a pessoa respondeu "Gratidão" (17:11); hoje mandamos a do
 * momento de novo (14:59) e ela respondeu "Boa tarde obrigado igualmente" (16:29). Ficou em
 * "Aguardando atendente". Pedido dele: resolver quem já foi respondido, ou quando o fluxo
 * decide que a conversa pode ser concluída — sem mandar mais nada.
 *
 * Rode: node tests/fechamento-cortesia.test.mjs
 */
import { readFileSync } from 'node:fs';
import { check, grupo, fim, lib } from './_harness.mjs';

const cortesia = await lib('cortesia.js');
const sugestao = await lib('sugestao.js');
const arv = await lib('arvore.js');
const store = await lib('store.js');

const raiz = new URL('../', import.meta.url);
const painel = readFileSync(new URL('src/panel/panel.js', raiz), 'utf8');
const at = (h, d = 31) => new Date(`2026-10-${d}T${h}:00-03:00`).toISOString();

const NOSSA_HOJE = at('14:59');
const CASO = [
  { texto: 'Gratidão', tipo: 'TEXT', at: at('17:11', 30) },
  { texto: 'Boa tarde  obrigado igualmente', tipo: 'TEXT', at: at('16:29') },
];
const so = (texto, h = '16:29', tipo = 'TEXT') => [{ texto, tipo, at: at(h) }];

/** Os sinais como o painel monta, só com o que importa aqui. */
function sinais(entrantes, nossaUltimaAt, extra = {}) {
  return {
    jaRespondemosAntes: true,
    ultimaEhNossa: false,
    ultimaEhDespedida: cortesia.ultimaEhDespedida(entrantes),
    soCortesia: cortesia.soCortesia(cortesia.rajadaFinal(entrantes, nossaUltimaAt)),
    ultimaEhSoReacao: cortesia.ultimaEhSoReacao(entrantes),
    perguntaAberta: cortesia.conversaTemPerguntaAberta(entrantes, nossaUltimaAt, []),
    perguntaPendente: cortesia.perguntaPendente(entrantes, nossaUltimaAt, []),
    pedeRespostaPessoal: cortesia.conversaPedeRespostaPessoal(entrantes, nossaUltimaAt, []) || cortesia.falouAlgoProprio(entrantes, nossaUltimaAt, []),
    soExpressaApoio: cortesia.soExpressaApoio(entrantes, nossaUltimaAt, []),
    desabafoPessoal: cortesia.desabafoPessoal(entrantes, nossaUltimaAt),
    denunciaOuCorrente: cortesia.denunciaOuCorrente(entrantes, nossaUltimaAt),
    pedeAlgoIndefinido: cortesia.pedeAlgoIndefinido(entrantes, nossaUltimaAt),
    cortesiaDeFechamento: cortesia.cortesiaDeFechamento(entrantes, nossaUltimaAt, { janelaHoras: 12 }),
    podeMandarMomento: true,
    podePedirDados: true,
    temEtiquetaDeCidade: true,
    cidadeNoCadastro: true,
    textos: entrantes.map((m) => m.texto),
    ultimoTexto: entrantes.at(-1)?.texto || '',
    ...extra,
  };
}
const decidir = (c) => arv.decidir(c, arv.fluxoPadrao(), {});

{
  grupo('cortesiaDeFechamento: só agradeceu/retribuiu depois da nossa');
  check(!!cortesia.cortesiaDeFechamento(CASO, NOSSA_HOJE), '"Boa tarde obrigado igualmente" depois da nossa de 14:59');
  check(!!cortesia.cortesiaDeFechamento(CASO.slice(0, 1), at('15:31', 30)), 'o "Gratidão" de ontem, depois da nossa de 15:31');
  for (const t of ['Amém 🙏', '🙏', 'Obrigado, igualmente!', 'Valeu capitão, tmj', 'Bom dia! Deus abençoe', 'Pra você também!',
    'Obrigada, um ótimo sábado pra você também', '👍👍', 'Muito obrigado deputado, Deus abençoe sua família']) {
    check(!!cortesia.cortesiaDeFechamento(so(t), NOSSA_HOJE), `fecha: "${t}"`);
  }
  check(!!cortesia.cortesiaDeFechamento(so('', '16:29', 'STICKER'), NOSSA_HOJE), 'fecha: figurinha sem legenda');
  for (const t of ['Obrigado. Quando vai ter reunião?', 'obrigado, me manda o material', 'Obrigada capitão, minha mãe está doente',
    'www.instagram.com/x', 'Boa tarde capitão, preciso de ajuda', 'Obrigado! Vou votar no senhor', 'Parabéns pelo trabalho!',
    'Obrigada. Briguei com minha família por causa de política e estou muito triste', 'Pode me ligar?']) {
    check(!cortesia.cortesiaDeFechamento(so(t), NOSSA_HOJE), `NÃO fecha: "${t}"`);
  }
  check(!cortesia.cortesiaDeFechamento(so('', '16:29', 'AUDIO'), NOSSA_HOJE), 'NÃO fecha: áudio');
  check(!cortesia.cortesiaDeFechamento(so('obrigado'), null), 'NÃO fecha: sem mensagem nossa antes (chegada)');
  check(!cortesia.cortesiaDeFechamento(so('😍'), null), 'NÃO fecha: emoji na chegada continua com a mensagem do momento');
  check(!cortesia.cortesiaDeFechamento(so('obrigado'), at('10:00', 28), { janelaHoras: 12 }), 'NÃO fecha: a nossa foi há dias (passou da janela)');
  check(!cortesia.cortesiaDeFechamento([{ texto: 'obrigado', at: at('16:29') }, { texto: 'e o material?', at: at('16:30') }], NOSSA_HOJE), 'NÃO fecha: uma das mensagens tem pedido');
  check(!cortesia.cortesiaDeFechamento([{ texto: 'obrigado', at: at('14:00') }], NOSSA_HOJE), 'NÃO fecha: a dela é de ANTES da nossa (nada depois)');
}

{
  grupo('a rodada conclui sem enviar, em qualquer dia');
  const hoje = sinais(CASO, NOSSA_HOJE, { respondidoHoje: true, momentoJaEnviado: true });
  const dHoje = decidir(hoje);
  const fHoje = sugestao.fecharPorCortesia(hoje, dHoje);
  check(fHoje?.tecla === '3' && !fHoje.resposta, `hoje: tecla 3 (${fHoje?.id}: ${fHoje?.motivo})`);
  check(/agradeceu ou retribuiu/.test(fHoje?.motivo || ''), 'o motivo diz que só retribuiu');

  const amanha = sinais(CASO, NOSSA_HOJE, { respondidoHoje: false, momentoJaEnviado: false });
  const dAmanha = decidir(amanha);
  check(dAmanha?.tecla === '5', `sem o conserto, no dia seguinte com mensagem do momento nova, o fluxo MANDAVA a tecla 5 (${dAmanha?.id})`);
  const fAmanha = sugestao.fecharPorCortesia(amanha, dAmanha);
  check(fAmanha?.tecla === '3' && fAmanha.id === 'fechou-por-cortesia', `com o conserto: conclui sem enviar (${fAmanha?.id})`);
  check(/tecla 5/.test(fAmanha?.motivo || ''), 'e o motivo conta o que o fluxo ia fazer');

  const tmj = sinais(so('Valeu capitão, tmj'), NOSSA_HOJE, { respondidoHoje: true });
  const dTmj = decidir(tmj);
  check(dTmj?.tecla === 'i', `"valeu, tmj": o fluxo mandava o agradecimento (tecla ${dTmj?.tecla})`);
  check(sugestao.fecharPorCortesia(tmj, dTmj)?.tecla === '3', 'com o conserto: conclui sem mandar o agradecimento');

  const emoji = sinais(so('🙏'), NOSSA_HOJE, { respondidoHoje: false });
  const dEmoji = decidir(emoji);
  check(sugestao.fecharPorCortesia(emoji, dEmoji)?.tecla === '3', `🙏 depois da nossa: conclui (o fluxo ia: tecla ${dEmoji?.tecla})`);
}

{
  grupo('nunca conclui com pendência, e nunca troca decisão de outra natureza');
  const base = sinais(CASO, NOSSA_HOJE, { respondidoHoje: false });
  const cinco = { id: 'x', tecla: '5' };
  for (const k of ['perguntaAberta', 'perguntaPendente', 'pedeRespostaPessoal', 'desabafoPessoal', 'denunciaOuCorrente',
    'pedeAjudaFinanceira', 'pedeEmprego', 'pedeLigacao', 'pedeFalarComDeputado', 'materialPendente', 'reclamaSemResposta',
    'naoPodeFalarAgora', 'semInteresse', 'respondeuOsDados', 'confirmouPresenca', 'informouEndereco', 'conteudoPedido']) {
    check(sugestao.fecharPorCortesia({ ...base, [k]: k === 'conteudoPedido' ? 'colinha' : { motivo: 'x' } }, cinco) === null, `pendência "${k}": não conclui`);
  }
  check(sugestao.fecharPorCortesia(base, { id: 'x', tecla: '6' }) === null, 'tecla 6 (gente) não se troca');
  check(sugestao.fecharPorCortesia(base, { id: 'x', tecla: null, ia: true }) === null, 'ramo da IA não se troca');
  check(sugestao.fecharPorCortesia(base, { id: 'x', tecla: '2' }) === null, 'pular (presença/endereço) não se troca');
  check(sugestao.fecharPorCortesia(base, { id: 'x', tecla: 's' }) === null, 'sem interesse não se troca');
  check(sugestao.fecharPorCortesia(base, cinco, { ligado: false }) === null, 'caixa da Config desligada: não age');
  check(sugestao.fecharPorCortesia({ ...base, ultimaEhNossa: true }, cinco) === null, 'a última é nossa: não age (outro caminho)');
  check(sugestao.fecharPorCortesia({ ...base, cortesiaDeFechamento: null }, cinco) === null, 'sem o sinal: não age');

  const desabafo = [{ texto: 'Obrigada. Minha irmã me bateu ontem e estou muito triste', tipo: 'TEXT', at: at('16:29') }];
  const sd = sinais(desabafo, NOSSA_HOJE);
  check(!sd.cortesiaDeFechamento && sugestao.fecharPorCortesia(sd, decidir(sd)) === null, 'desabafo depois da nossa: não conclui');
  const pergunta = sinais(so('Obrigado! E quando vai ter o próximo encontro?'), NOSSA_HOJE);
  check(sugestao.fecharPorCortesia(pergunta, decidir(pergunta)) === null, 'agradeceu e perguntou: não conclui');
}

{
  grupo('o painel: sinal, guarda antes da IA, caixa da Config, motivo no log');
  check(/cortesiaDeFechamento: cortesiaDeFechamento\(state\.entrantes, state\.nossaUltimaAt/.test(painel), 'sinaisDoContato calcula cortesiaDeFechamento');
  const guarda = painel.indexOf('sugestaoLib.fecharPorCortesia(sinaisDoContato, sugestao');
  const ia = painel.indexOf("const regraPedeGente = sugestao?.tecla === '6';");
  check(guarda > 0 && guarda < ia, 'a guarda roda ANTES de decidir se a IA entra (tecla 3 não chama a IA)');
  check(/concluirCortesiaSozinho !== false/.test(painel), 'vale com a caixa ligada (e nasce ligada)');
  check(store.DEFAULTS?.auto ? store.DEFAULTS.auto.concluirCortesiaSozinho === true : /concluirCortesiaSozinho: true/.test(readFileSync(new URL('src/lib/store.js', raiz), 'utf8')), 'padrão de fábrica: LIGADA');
  check(/Concluir sozinho quem só agradeceu ou retribuiu/.test(painel), 'a caixa existe na aba Automatizado');
  check(/concluído sem enviar pelo fluxo \("\$\{sugestao\?\.id/.test(painel), 'o Andamento diz que foi o fluxo e por quê');
  check(/não consegui confirmar que resolveu/.test(painel), 'falha ao resolver tem motivo (não "undefined")');
  const novo = painel.slice(painel.indexOf('async function processarNovo('), painel.indexOf('async function processarRespondido('));
  check(/estado\.isPending[\s\S]*clickIniciar\(\)[\s\S]*processarRespondido\(alvo, ctx\)/.test(novo), 'processarNovo assume (se aguardando atendente) e depois decide');
}

fim();
