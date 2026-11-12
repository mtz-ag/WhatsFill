/**
 * Três ajustes de 12/11/2026, casos reais de 11 e 12/11:
 *  1. a despedida "Abração" virava a cidade Barracão (aproximada) — o Tenente Fraga, de Imbé;
 *  2. o arquivo anexado travava o rascunho mesmo com texto próprio que bastava;
 *  3. UM link com texto que puxa a nossa opinião recebe "Obrigado por compartilhar, darei uma olhada".
 *
 * Rode: node tests/despedida-anexo-link.test.mjs
 */
import { readFileSync } from 'node:fs';
import { check, grupo, fim, lib, mem } from './_harness.mjs';

const coredes = JSON.parse(readFileSync(new URL('../src/data/coredes-rs.json', import.meta.url), 'utf8'));
mem.municipios = Object.keys(coredes.municipios).sort((a, b) => a.localeCompare(b, 'pt-BR'));

const cities = await lib('cities.js');
const { extract } = await lib('extract.js');
const c = await lib('cortesia.js');
const s = await lib('sugestao.js');
const a = await lib('arvore.js');
const store = await lib('store.js');
const templates = await lib('templates.js');
const vars = await lib('vars.js');
const { rascunhar } = await lib('ia-cliente.js');
await cities.loadMunicipios();

const agora = new Date(); agora.setHours(11, 0, 0, 0);
const ontem = new Date(agora); ontem.setDate(ontem.getDate() - 1);
const m = (texto, tipo = 'TEXT') => ({ texto, tipo, at: agora.toISOString() });

/** Os sinais do jeito que o painel os compõe (os mesmos do teste da v3.305). */
function sinais(e, extra = {}) {
  return {
    jaRespondemosAntes: true, temEtiquetaDeCidade: true, podeMandarMomento: true, podeEnviar: true,
    textos: e.map((x) => x.texto), ultimoTexto: e.at(-1)?.texto,
    linkComOpiniao: c.linkComOpiniao(e, ontem),
    cortesiaParaRascunho: c.cortesiaParaRascunho(e, ontem),
    pedeRespostaPessoal: c.conversaPedeRespostaPessoal(e, ontem) || c.falouAlgoProprio(e, ontem),
    perguntaAberta: c.conversaTemPerguntaAberta(e, ontem),
    perguntaPendente: c.perguntaPendente(e, ontem),
    reclamaSemResposta: c.reclamaSemResposta(e, ontem),
    naoPodeFalarAgora: c.naoPodeFalarAgora(e, ontem),
    desabafoPessoal: c.desabafoPessoal(e, ontem),
    denunciaOuCorrente: c.denunciaOuCorrente(e, ontem),
    pedeAlgoIndefinido: c.pedeAlgoIndefinido(e, ontem),
    soCortesia: c.soCortesia(e),
    cortesiaDeFechamento: c.cortesiaDeFechamento(e, ontem),
    ...extra,
  };
}
const motores = (ctx) => [s.sugerirAcao(ctx), a.decidir(ctx, a.fluxoPadrao(), {}), a.decidir(ctx, a.arvorePadrao(), {})];

const GILMAR = [
  m('Boa noite'), m('Sucesso estamos juntos'), m('Apresentação FT.ppt', 'DOCUMENT'),
  m('Sou o Tenente Fraga do Litoral Norte'),
  m('Fui o primeiro coordenador regional de defesa civil do Litoral Norte'),
  m('Pertenço ao Republicanos de Imbé'), m('Junto com Evandro Gai'), m('Abração'),
];

grupo('1. despedida não é cidade (o Tenente Fraga, 12/11)');
{
  for (const t of ['Abração', 'abraços', 'Abs', 'beijão', 'bjs', 'fé', 'Amém', 'Obrigada', 'grato', 'Gratidão', 'Sucesso', 'parabéns', 'valeu']) {
    check((await cities.matchCity(t)) === null && (await cities.matchCityComContexto(t)) === null, `"${t}" não vira cidade`);
    check(!(await extract([t])).cidade, `extract("${t}") sem cidade`);
  }
  const textos = GILMAR.filter((x) => x.tipo === 'TEXT').map((x) => x.texto);
  const g = (await extract(textos)).cidade;
  check(g?.value === 'Imbé' && g.confidence === 'exata', `caso Gilmar -> Imbé exata (veio ${JSON.stringify(g)})`);
  const r = await extract(textos, { respostaAoPedido: true });
  check(r.cidade?.value === 'Imbé' && !r.nome, 'como resposta ao formulário: Imbé, e "Pertenço ao" não vira nome');
  check((await cities.matchCityComContexto('Pertenço ao Republicanos de Imbé'))?.city === 'Imbé', '"Republicanos de X" é pista de cidade');
  check((await cities.matchCityComContexto('o PL do aborto é um absurdo')) === null, '"PL do" sem município não vira palpite');
  check(!(await extract(['casada'])).cidade, '"casada" continua sem cidade');
  check((await extract(['Sao lourenso'])).cidade?.value === 'São Lourenço do Sul', '"Sao lourenso" continua São Lourenço do Sul');
  for (const t of ['Santa Fé', 'Maria da Fé', 'Bom Sucesso']) {
    check(!!(await cities.matchCityComContexto(t)), `"${t}" continua sendo cidade (a guarda de contexto)`);
  }
  /** O exato de uma mensagem vence o aproximado de outra, mesmo mais nova. */
  const v = (await extract(['sou de Canoas', 'Sao lourenso'])).cidade;
  check(v?.value === 'Canoas' && v.confidence === 'exata', 'exato com pista vence aproximado mais novo');
}

grupo('2. arquivo com texto próprio vai para o rascunho da IA');
{
  const ctx = sinais(GILMAR);
  check(ctx.cortesiaParaRascunho?.anexo && !ctx.pedeRespostaPessoal, 'anexo + apresentação/apoio: sinal do anexo, sem "responda à mão"');
  for (const d of motores(ctx)) check(d?.ia && d.tecla !== '6', 'decide rascunho da IA: ' + JSON.stringify(d?.id));

  const so = sinais([m('', 'DOCUMENT')]);
  for (const d of motores(so)) check(d?.tecla === '6', 'só anexo continua tecla 6');
  for (const texto of ['O que acha desse projeto?', 'Veja o documento com atenção, por favor', 'Boa noite, me diga se pode ajudar']) {
    const e = sinais([m('', 'DOCUMENT'), m(texto)]);
    check(!e.cortesiaParaRascunho, `pedido sobre o anexo não vira rascunho: "${texto}"`);
    check(s.sugerirAcao(e)?.tecla === '6' && a.decidir(e, a.fluxoPadrao(), {})?.tecla === '6', `e continua tecla 6: "${texto}"`);
  }
  const audio = sinais([...GILMAR, m('', 'AUDIO')]);
  check(!audio.cortesiaParaRascunho, 'áudio sem transcrição junto continua pedindo você');

  // A IA: o tom do anexo substitui o da cortesia, e "li o arquivo" é reescrito.
  const ruim = 'Boa noite! Li sua apresentação, ficou excelente. Seguimos juntos!';
  const boa = 'Bom dia! Muito obrigado pelo apoio e por enviar o material. É uma alegria ter ao nosso lado quem conhece de perto esse trabalho. Seguimos juntos, um grande abraço!';
  const pedidos = []; const respostas = [ruim, boa];
  chrome.runtime.sendMessage = async (p) => { pedidos.push(p); return { ok: true, decisao: { texto: respostas.shift(), confianca: 0.95, precisaDeRevisao: false } }; };
  const conversa = [{ de: 'nos', texto: 'Boa tarde, obrigado!', at: ontem.toISOString() },
    ...GILMAR.map((x) => ({ ...x, de: 'contato', ...(x.tipo === 'DOCUMENT' ? { texto: '(ela mandou um DOCUMENTO — o conteúdo não aparece aqui)', semConteudo: true, midia: true } : {}) }))];
  const r = await rascunhar({ mensagens: conversa, agora, templates: [], campos: {}, modelo: 'gpt-5.6-luna' });
  check(pedidos.length === 2 && r.texto === boa, 'diz que leu -> reescreve e entrega a resposta aprovada');
  check(/ANEXO: ela mandou um ARQUIVO/.test(pedidos[0].contato) && !/CORTESIA AFETUOSA/.test(pedidos[0].contato),
    'o prompt leva o tom do anexo, não o da cortesia (que exige "carinho")');
  check(/REESCREVA:.*não diga que leu/.test(pedidos[1].contato), 'a reescrita diz o motivo');
}

grupo('3. link com texto que puxa opinião');
{
  const L = 'https://www.instagram.com/reel/abc123/?igsh=xyz';
  const deveResponder = {
    'viu isso? absurdo': [m(L + ' viu isso? absurdo')],
    'o que acha': [m(L), m('O que o senhor acha?')],
    'olha o que fizeram': [m(L), m('Olha o que fizeram, que vergonha')],
    'comentário político': [m(L), m('Esse governo do Lula acabando com o país')],
  };
  for (const [nome, e] of Object.entries(deveResponder)) {
    const ctx = sinais(e);
    check(!!ctx.linkComOpiniao, `detecta: ${nome}`);
    for (const d of motores(ctx)) check(d?.resposta === 'link-compartilhado' && !d.ia && d.tecla !== '6', `responde com o link-compartilhado: ${nome}`);
  }
  const comMomento = motores(sinais(deveResponder['viu isso? absurdo'], { momentoJaEnviado: true }));
  check(comMomento.every((d) => d?.resposta === 'link-compartilhado-sem-saudacao'), 'mensagem do momento já saiu hoje: sem saudação');

  const naoE = {
    'dois links + vejam isso': [m(L), m('https://facebook.com/x'), m('vejam isso')],
    'link sem texto': [m(L)],
    'link + bom dia, Deus abençoe': [m(L), m('Bom dia, Deus abençoe')],
    'pergunta de conteúdo': [m(L), m('Isso é verdade?')],
    'pedido': [m(L), m('Quero receber o material, viu isso?')],
  };
  for (const [nome, e] of Object.entries(naoE)) {
    const ctx = sinais(e);
    check(!ctx.linkComOpiniao, `não detecta: ${nome}`);
    // Sem o sinal, o desfecho é EXATAMENTE o de antes: nenhum motor muda.
    // (O id das caixas do `fluxoPadrao()` nasce novo a cada chamada; o que se compara é o desfecho.)
    const antes = sinais(e, { linkComOpiniao: null });
    const forma = (d) => JSON.stringify([d?.tecla, d?.resposta || null, !!d?.ia, d?.motivo]);
    check(motores(ctx).every((d, i) => forma(d) === forma(motores(antes)[i])), `desfecho de hoje mantido: ${nome}`);
  }
  check(!c.linkComOpiniao([{ texto: L + ' viu isso?', tipo: 'TEXT', at: ontem.toISOString() }], agora.toISOString()),
    'respondido depois do link: nada pendente, a regra se cala');

  // Proteções continuam vencendo.
  const ctx = sinais(deveResponder['viu isso? absurdo']);
  for (const id of ['sem-interesse', 'etiqueta-so-conclui', 'ultima-e-nossa', 'r:etiqueta-dispensa-da-fila:x', 'contexto-de-outro-dia']) {
    check(s.respostaLinkComOpiniao(ctx, { id, tecla: '3' }) === null, `não passa por cima de ${id}`);
  }
  check(s.respostaLinkComOpiniao(ctx, { id: 'x', tecla: null, resposta: 'pedido-ligacao' }) === null, 'nem de uma resposta pronta de pedido');
  check(s.respostaLinkComOpiniao({ ...ctx, pedeAjudaFinanceira: true }, null) === null, 'nem de pedido de dinheiro');

  // O texto: saudação pela hora, sem nome, sem "equipe", sem pergunta, sem beijo.
  const com = store.DEFAULT_TEMPLATES.find((t) => t.id === 'link-compartilhado');
  const sem = store.DEFAULT_TEMPLATES.find((t) => t.id === 'link-compartilhado-sem-saudacao');
  const as = (h) => { const d = new Date(agora); d.setHours(h); return com.text.replace('{{saudacao}}', vars.saudacao(d)); };
  check(as(11) === 'Bom dia! Obrigado por compartilhar, darei uma olhada. Um grande abraço!', 'às 11h: Bom dia');
  check(as(15) === 'Boa tarde! Obrigado por compartilhar, darei uma olhada. Um grande abraço!', 'às 15h: Boa tarde');
  check(sem.text === 'Obrigado por compartilhar, darei uma olhada. Um grande abraço!', 'a forma sem saudação');
  check(![com.text, sem.text].some((t) => /\?|beij|bjs|equipe|\{\{(?:primeiro_)?nome\}\}/i.test(t)), 'sem pergunta, beijo, equipe ou nome');

  // A migração leva as duas respostas a quem já tem a lista gravada.
  mem.templates = [{ id: 'pedir-dados', name: 'x', text: 'y' }];
  mem.migracoes = {};
  await templates.migrarRespostaLinkCompartilhado();
  check(['link-compartilhado', 'link-compartilhado-sem-saudacao'].every((id) => mem.templates.some((t) => t.id === id)),
    'migração acrescenta as duas respostas à lista gravada');
}

const painel = readFileSync(new URL('../src/panel/panel.js', import.meta.url), 'utf8');
check(painel.includes('linkComOpiniao: linkComOpiniao(state.entrantes, state.nossaUltimaAt)'), 'o painel monta o sinal do link');

fim();
