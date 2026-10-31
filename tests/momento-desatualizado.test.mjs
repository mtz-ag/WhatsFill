/**
 * Mensagem do momento de OUTRO dia, segunda mensagem do momento no mesmo dia e desilusão com a
 * política (31/10/2026, sábado).
 *
 * O caso: às 14:04 saiu um texto nosso de sábado; às 17:09 ela escreveu "Eu não acredito mais no
 * Brasil…". A rodada automática (Novos) assumiu às 17:15, a IA se absteve (`naoHaOQueResponder`)
 * e o fallback pôs no campo a mensagem do momento SALVA — "Que esta quinta-feira seja
 * abençoada… Hoje, 29 de outubro…".
 *
 * Rode: node tests/momento-desatualizado.test.mjs
 */
import { readFileSync } from 'node:fs';
import { check, grupo, fim, lib } from './_harness.mjs';

const datas = await lib('data-do-texto.js');
const ia = await lib('ia.js');
const cortesia = await lib('cortesia.js');
const sugestao = await lib('sugestao.js');
const arvore = await lib('arvore.js');

const raiz = new URL('../', import.meta.url);
const painel = readFileSync(new URL('src/panel/panel.js', raiz), 'utf8');
const at = (h) => new Date(`2026-10-31T${h}:00-03:00`).toISOString();
const sabado = new Date('2026-10-31T17:15:00-03:00');
const quinta = new Date('2026-10-29T10:00:00-03:00');

const MOMENTO_29 =
  'Boa tarde! Que esta quinta-feira seja abençoada. Hoje, 29 de outubro, é o Dia Nacional do Livro — ' +
  'um convite para valorizarmos a leitura e a educação.';
const MOMENTO_SABADO =
  'Boa tarde! Por aqui o trabalho não para. Seguimos firmes no compromisso de cuidar da nossa gente. ' +
  'Um grande abraço e um ótimo sábado!\n\nVeja nossa última publicação: https://www.instagram.com/p/x/';
const DELA_1109 = 'A oposição, os políticos da direita são todos uns covardes uns frouxos. Deixaram o ladrão roubar mais uma vez?';
const DELA_1709 =
  'Eu não acredito mais no Brasil. Não adianta trabalhar e votar nas pessoas certas se elas mesmo , ' +
  'entregam o poder para a oposição. Entregaram para a máfia do PT.';
const entrantes = [
  { texto: DELA_1109, tipo: 'TEXT', at: at('11:14') },
  { texto: DELA_1709, tipo: 'TEXT', at: at('17:09') },
];
const nossaUltimaAt = at('14:04');

{
  grupo('datasForaDeHoje: o texto de quinta-feira/29 de outubro num sábado');
  const r = datas.datasForaDeHoje(MOMENTO_29, sabado);
  check(!!r, 'o texto salvo de 29/10 é barrado no sábado 31/10');
  check(r?.motivo === 'fala de quinta-feira/29 de outubro', `motivo exato (${r?.motivo})`);
  check(datas.avisoMomentoDesatualizado(r) === 'Mensagem do momento desatualizada (fala de quinta-feira/29 de outubro) — atualize em Config', 'aviso da tela no texto pedido');
  check(datas.datasForaDeHoje(MOMENTO_29, quinta) === null, 'no próprio dia 29 (quinta) o mesmo texto passa');
  check(datas.datasForaDeHoje(MOMENTO_SABADO, sabado) === null, 'o texto de sábado passa no sábado');
  check(!!datas.datasForaDeHoje(MOMENTO_SABADO, quinta), 'o texto de sábado é barrado numa quinta');
}

{
  grupo('datasForaDeHoje: convite e data histórica NÃO são barrados');
  check(datas.datasForaDeHoje('Domingo tem encontro em Gravataí, às 10h!', sabado) === null, '"Domingo tem encontro" é convite');
  check(datas.datasForaDeHoje('Te espero no dia 2 de novembro, às 18h.', sabado) === null, 'data futura é convite');
  check(datas.datasForaDeHoje('Evento 02/11 às 10h', sabado) === null, 'dd/mm futura é convite');
  check(datas.datasForaDeHoje('Em 15 de novembro de 1889 proclamou-se a República.', sabado) === null, 'data histórica com ano');
  check(datas.datasForaDeHoje('{{saudacao}}! Tenha uma ótima semana!', sabado) === null, 'sem dia nenhum');
  check(datas.datasForaDeHoje('Hoje, 31 de outubro, seguimos firmes!', sabado) === null, '"Hoje, 31 de outubro" no dia 31');
  check(datas.datasForaDeHoje('', sabado) === null, 'texto vazio');
}

{
  grupo('datasForaDeHoje: outras formas de falar de outro dia');
  check(!!datas.datasForaDeHoje('Feliz sexta!', sabado), '"Feliz sexta" no sábado');
  check(!!datas.datasForaDeHoje('Bom domingo a todos', sabado), '"Bom domingo" no sábado');
  check(!!datas.datasForaDeHoje('Hoje, 30/10, estive em Canoas', sabado), '"Hoje, 30/10" no dia 31');
  check(!!datas.datasForaDeHoje('Que esta segunda-feira seja de muita luz', sabado), '"que esta segunda-feira seja"');
  check(!!datas.datasForaDeHoje('Que este sabado seja abencoado', quinta), 'sem acento também');
}

{
  grupo('momentoDesatualizado: as variações contam');
  check(datas.momentoDesatualizado({ text: MOMENTO_SABADO, variantes: [] }, sabado) === null, 'texto de hoje sem variações passa');
  const v = datas.momentoDesatualizado({ text: MOMENTO_SABADO, variantes: ['Feliz quinta-feira!'] }, sabado);
  check(!!v && /quinta-feira/.test(v.motivo), 'variação de quinta-feira trava o momento inteiro');
  check(datas.momentoDesatualizado(null, sabado) === null, 'sem momento: nada');
}

{
  grupo('momentoDeNovoNaoCabe: já falamos hoje e ela respondeu com conteúdo');
  const base = { respondidoHoje: true, momentoHoje: false, ultimaEhNossa: false };
  check(!!sugestao.momentoDeNovoNaoCabe({ ...base, pedeRespostaPessoal: { motivo: 'x' } }), 'falou algo próprio depois da nossa de hoje: barra');
  check(!!sugestao.momentoDeNovoNaoCabe({ ...base, desabafoPessoal: { motivo: 'x' } }), 'desabafo: barra');
  check(!!sugestao.momentoDeNovoNaoCabe({ ...base, respondidoHoje: false, momentoHoje: true, perguntaAberta: { motivo: 'x' } }), 'momento atual já saiu hoje + pergunta: barra');
  check(sugestao.momentoDeNovoNaoCabe({ ...base, respondidoHoje: false, pedeRespostaPessoal: { motivo: 'x' } }) === null, 'nossa última foi ONTEM: o momento de hoje cabe');
  check(sugestao.momentoDeNovoNaoCabe({ ...base }) === null, 'só reação/obrigado depois da nossa: não barra (o fecho conclui)');
  check(sugestao.momentoDeNovoNaoCabe({ ...base, ultimaEhNossa: true, pedeRespostaPessoal: { motivo: 'x' } }) === null, 'a última é nossa: nada a decidir');
}

{
  grupo('desilusão com a política vira desabafo (a fala das 17:09)');
  const d = cortesia.desabafoPessoal(entrantes, nossaUltimaAt);
  check(!!d && d.politico === true, 'a fala dela é desabafo político');
  check(/desilusão com a política/.test(d?.motivo || ''), `motivo (${d?.motivo})`);
  check(!!cortesia.conversaPedeRespostaPessoal(entrantes, nossaUltimaAt), 'pede resposta pessoal (acolhimento)');
  const sim = ['Perdi a esperança nesse país, a política só decepciona', 'Cansei de votar e nada muda', 'Estou desanimada com a política', 'O Brasil acabou, não tem mais jeito'];
  for (const t of sim) check(!!cortesia.desabafoPessoal([{ texto: t, at: at('17:09') }], null)?.politico, `casa: "${t}"`);
  const nao = ['Fora PT! Lula ladrão!', 'Não adianta falar com meus pais', 'Desisti do curso', 'Bom dia deputado, conte com meu voto', 'Qual o horário do evento?'];
  for (const t of nao) check(!cortesia.desabafoPessoal([{ texto: t, at: at('17:09') }], null)?.politico, `não casa: "${t}"`);
  const fam = cortesia.desabafoPessoal([{ texto: 'Briguei feio com minha irmã por causa de política, estou muito triste', at: at('17:09') }], null);
  check(!!fam && fam.politico === false, 'briga de família continua no ramo pessoal');
}

{
  grupo('o rascunho: linha da desilusão, sem formulário, sem abstenção');
  const mensagens = [
    { de: 'contato', texto: DELA_1109, at: at('11:14') },
    { de: 'nos', texto: MOMENTO_SABADO, at: at('14:04') },
    { de: 'contato', texto: DELA_1709, at: at('17:09') },
  ];
  const bloco = ia.montarContatoRascunho({ mensagens, agora: sabado, pedirDados: true });
  check(/DESABAFO DE DESILUSÃO COM A POLÍTICA/.test(bloco), 'linha da desilusão no pedido');
  check(bloco.includes(ia.TOM_DA_DESILUSAO), 'tom aprovado colado');
  check(/NÃO marque naoHaOQueResponder/.test(bloco), 'proíbe a abstenção');
  check(!/Marque o campo naoHaOQueResponder e o atendimento manda a mensagem do dia/.test(bloco), 'a regra "marque e a mensagem do dia vai no lugar" sai no desabafo');
  check(!/NÃO ENTRE NO MÉRITO: nós não temos como verificar/.test(bloco), 'sem a linha da denúncia ("agradeça as informações")');
  check(!/Nome:\s*\n?\s*Cidade:/.test(bloco) || !/PEDIDO DE DADOS/.test(bloco), 'sem formulário');
  check(/Capitão Martim/.test(ia.linhaDaDesilusao()), 'primeira pessoa como o Capitão Martim');
  check(/QUALQUER pergunta/.test(ia.linhaDaDesilusao()) && /prometer resultado/.test(ia.linhaDaDesilusao()), 'sem pergunta e sem promessa');
  check(/2027/.test(ia.linhaDaDesilusao()) && /chamar pelo nome/.test(ia.linhaDaDesilusao()), 'sem 2027 e sem nome');
  check(!/[?]/.test(ia.TOM_DA_DESILUSAO) && !/equipe/i.test(ia.TOM_DA_DESILUSAO), 'tom sem pergunta e sem "equipe"');
}

{
  grupo('travas: abstenção, frieza e ataque no desabafo político');
  const abst = ia.validarRascunho(JSON.stringify({ texto: 'Seguimos por aqui. Se precisar de alguma coisa, é só escrever.', confianca: 0.9, motivo: '', precisaDeRevisao: false, naoHaOQueResponder: true, naoCabePedirOCadastro: true }), sabado, { desabafo: true, desabafoPolitico: true });
  check(abst.naoHaOQueResponder === false, 'abstenção num desabafo não chega ao painel (nada de mensagem do momento)');
  check(abst.avisos.includes(ia.AVISOS_QUE_IMPEDEM_ENVIO.absteveNoDesabafo), 'aviso que impede o envio');
  const vazio = ia.validarRascunho(JSON.stringify({ texto: '', confianca: 0, motivo: '', precisaDeRevisao: false, naoHaOQueResponder: true, naoCabePedirOCadastro: true }), sabado, { desabafo: true });
  check(vazio.naoHaOQueResponder === false && vazio.avisos.includes(ia.AVISOS_QUE_IMPEDEM_ENVIO.absteveNoDesabafo), 'abstenção sem texto também');
  const fora = ia.validarRascunho(JSON.stringify({ texto: 'Seguimos por aqui.', confianca: 0.9, motivo: '', precisaDeRevisao: false, naoHaOQueResponder: true, naoCabePedirOCadastro: true }), sabado, {});
  check(fora.naoHaOQueResponder === true, 'fora de desabafo a abstenção segue valendo (regra de 24/09)');
  const frio = ia.travasDoEscopo('Agradeço as informações. Estamos atentos e acompanhando o assunto.', { desabafo: true, desabafoPolitico: true });
  check(frio.includes(ia.AVISOS_QUE_IMPEDEM_ENVIO.frioNaDesilusao), 'resposta de denúncia barrada');
  const ataque = ia.travasDoEscopo('Essa máfia não vai vencer. Não desista!', { desabafo: true, desabafoPolitico: true });
  check(ataque.includes(ia.AVISOS_QUE_IMPEDEM_ENVIO.atacouNaDesilusao), 'repetir "máfia" barrado');
  const bom = ia.travasDoEscopo(ia.TOM_DA_DESILUSAO.replace(/ \/ /g, '\n\n'), { desabafo: true, desabafoPolitico: true });
  check(bom.length === 0, `o tom aprovado passa nas travas (${bom.join('; ')})`);
  for (const k of ['absteveNoDesabafo', 'frioNaDesilusao', 'atacouNaDesilusao']) {
    check(typeof ia.AVISOS_QUE_IMPEDEM_ENVIO[k] === 'string', `${k} impede o envio`);
  }
}

{
  grupo('o quadro manda para a IA (tecla 6), não para a 5');
  const c = {
    jaRespondemosAntes: true, respondidoHoje: true, momentoHoje: false, momentoJaEnviado: false, ultimaEhNossa: false,
    podeMandarMomento: false, podePedirDados: true, temEtiquetaDeCidade: true, cidadeNoCadastro: true,
    pedeRespostaPessoal: cortesia.conversaPedeRespostaPessoal(entrantes, nossaUltimaAt),
    desabafoPessoal: cortesia.desabafoPessoal(entrantes, nossaUltimaAt),
    denunciaOuCorrente: cortesia.denunciaOuCorrente(entrantes, nossaUltimaAt),
    textos: entrantes.map((e) => e.texto), ultimoTexto: DELA_1709,
  };
  const d = arvore.decidir(c, arvore.fluxoPadrao(), {});
  check(d?.tecla === '6', `tecla 6 (${d?.id})`);
  check(!!sugestao.momentoDeNovoNaoCabe(c), 'e a mensagem do momento não cabe de novo hoje');
  check(sugestao.rascunhoSemCadastro(c), 'rascunho sem formulário');
}

{
  grupo('painel: a trava em todos os caminhos do momento');
  check(/import \{ momentoDesatualizado, avisoMomentoDesatualizado \} from '\.\.\/lib\/data-do-texto\.js'/.test(painel), 'import');
  check(/const momentoVencido = momento \? momentoDesatualizado\(momento\) : null;\s*\n\s*if \(momentoVencido\) momentoTrava = true;/.test(painel), 'momentoTrava (tecla 5 some; podeMandarMomento falso)');
  check(/missing\.length > 0 \|\| !!momentoVencido;/.test(painel), 'vale também depois do pedido junto');
  check(/startsWith\('momento:'\)[\s\S]{0,200}momentoDesatualizado\(template\)/.test(painel), 'última porta: sendTemplate');
  check(/const vencido = momentoDesatualizado\(templateMomento\);\s*\n\s*if \(vencido\) return \{ ok: false/.test(painel), 'tecla 1 do "Eu mando"');
  check(/const vencidoNaConfig = momentoDesatualizado/.test(painel), 'aviso no cartão da Config');
  check(/a rodada não vai mandar a mensagem do momento/.test(painel), 'aviso no começo da rodada');
  check(/const momentoNaoCabe = sugestaoLib\.momentoDeNovoNaoCabe\(sinaisDoContato\);/.test(painel), 'segunda mensagem do momento barrada');
  check(/if \(escolhaAutomatica === 'momento' && momentoNaoCabe\)/.test(painel), '...na escolha automática do fluxo');
  check(/semOQueResponder && escolhaAutomatica == null && rodadaAutomatica\(\) && momentoNaoCabe/.test(painel), '...e no fallback da IA que se absteve');
  const iFallback = painel.indexOf('const momentoNaoCabe = sugestaoLib.momentoDeNovoNaoCabe');
  const iPergunta = painel.indexOf('const escolha = escolhaAutomatica ?? await perguntarNaRodada');
  check(iFallback > 0 && iFallback < iPergunta, 'antes da pergunta da rodada');
}

fim();
