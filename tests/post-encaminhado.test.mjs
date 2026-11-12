/**
 * Post encaminhado (12/11/2026, a Suely): ela repassou 1.952 caracteres de um senador — título em
 * negrito, a assinatura dele, o link do Instagram e "Faça parte do meu canal do WhatsApp" — e a caixa
 * mandou responder à mão ("escreveu 1952 caracteres"). O tamanho era do senador.
 *
 *  - post político encaminhado -> rascunho da IA que se posiciona, não tecla 6;
 *  - propaganda comercial encaminhada (Black Friday de curso) -> conclui sem enviar;
 *  - texto longo ESCRITO por ela, com pedido -> continua tecla 6;
 *  - cortesia longa (a da v3.305) -> continua no rascunho de cortesia.
 *
 * Os textos são FICTÍCIOS, no formato do real. Rode: node tests/post-encaminhado.test.mjs
 */
import { check, grupo, fim, lib } from './_harness.mjs';

const c = await lib('cortesia.js');
const s = await lib('sugestao.js');
const a = await lib('arvore.js');
const p = await lib('post-encaminhado.js');
const ia = await lib('ia.js');
const { rascunhar } = await lib('ia-cliente.js');

const agora = new Date(); agora.setHours(15, 0, 0, 0);
const ontem = new Date(agora); ontem.setDate(ontem.getDate() - 1);
const m = (texto, tipo = 'TEXT') => ({ texto, tipo, at: agora.toISOString() });

const SUELY = `*MIL DIAS DE INJUSTIÇA!*

Hoje completam mil dias que um cidadão brasileiro está preso sem julgamento, sem acesso aos autos e sem direito de defesa. Isso não acontece em uma democracia de verdade. A Constituição vale para todos ou não vale para ninguém.

Seguiremos denunciando no Senado cada abuso e cada perseguição política. *Justiça para o Fulano Exemplo!*

Senador Exemplo da Silva

https://www.instagram.com/p/AbC123exemplo/

Faça parte do meu canal do WhatsApp: https://whatsapp.com/channel/0029VaExemplo`;

const CURSO = `*BLACK FRIDAY* 🔥 Curso Completo de Manicure com 70% de desconto! Matrículas abertas só até sexta. Parcele em 12x sem juros. Vagas limitadas! Chame no WhatsApp (51) 99999-0000 ou acesse https://www.instagram.com/cursoexemplo/ Compartilhe com quem precisa!`;

const PESSOAL = `Boa tarde, preciso de ajuda com a minha aposentadoria, estou há oito meses esperando o INSS e ninguém me dá resposta, já fui no posto três vezes e mandaram eu esperar mais, já levei todos os documentos que pediram e mesmo assim continua parado no sistema, não sei mais o que fazer, vocês podem me ajudar a ver isso?`;

const CORTESIA = 'Vamos madrugar com os galos ? Rsrsrs tenha tu e os teus mais um dia baita abençoado e essa guria ti deseja tudo de bom e boas soluções para os problemas climáticos do nosso estado bjs';

/** Os sinais do jeito que o painel os compõe. */
function sinais(e, extra = {}) {
  return {
    jaRespondemosAntes: true, temEtiquetaDeCidade: true, podeMandarMomento: true, podeEnviar: true,
    textos: e.map((x) => x.texto), ultimoTexto: e.at(-1)?.texto,
    postEncaminhado: c.postEncaminhado(e, ontem, 'Maria Exemplo'),
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
    pedeAjudaFinanceira: c.pedeAjudaFinanceira(e, ontem),
    semInteresse: c.semInteresse(e, ontem),
    soCortesia: c.soCortesia(e),
    cortesiaDeFechamento: c.cortesiaDeFechamento(e, ontem),
    ...extra,
  };
}
const motores = (ctx) => [s.sugerirAcao(ctx), a.decidir(ctx, a.fluxoPadrao(), {}), a.decidir(ctx, a.arvorePadrao(), {})];

grupo('1. a Suely: post político encaminhado vira rascunho, não tecla 6');
{
  const ctx = sinais([m(SUELY)]);
  check(ctx.postEncaminhado?.tipo === 'politico', `detecta o post político: ${JSON.stringify(ctx.postEncaminhado)}`);
  check(!!ctx.pedeRespostaPessoal, '(a medida antiga continua dizendo "texto longo" — é o ajuste que decide)');
  for (const d of motores(ctx)) {
    check(d?.ia === true && d.tecla !== '6' && d.id === 'post-encaminhado', `rascunho da IA nos três motores: ${JSON.stringify(d && { id: d.id, tecla: d.tecla, ia: d.ia })}`);
  }
  check(s.rascunhoSemCadastro(ctx), 'o rascunho não fecha pedindo nome e cidade');
  // Com um "olha isso" e o link solto junto, continua sendo o post.
  check(c.postEncaminhado([m('olha isso'), m(SUELY), m('https://www.instagram.com/p/xyz/')], ontem)?.tipo === 'politico',
    'recado curto e link solto junto não desfazem o post');
  // A assinatura que é o nome DELA não conta como de outra pessoa.
  check(p.assinaturaDoPost(SUELY) === 'Senador Exemplo da Silva', 'lê a assinatura de quem publicou');
}

grupo('2. propaganda comercial encaminhada: conclui sem enviar');
{
  const ctx = sinais([m(CURSO)]);
  check(ctx.postEncaminhado?.tipo === 'comercial', `detecta o comercial: ${JSON.stringify(ctx.postEncaminhado)}`);
  for (const d of motores(ctx)) {
    check(d?.tecla === '3' && !d.ia && !d.resposta && d.id === 'post-comercial', `tecla 3 nos três motores: ${JSON.stringify(d && { id: d.id, tecla: d.tecla })}`);
  }
}

grupo('3. texto longo ESCRITO por ela, com pedido: continua tecla 6');
{
  const ctx = sinais([m(PESSOAL)]);
  check(!ctx.postEncaminhado, 'não é post');
  for (const d of motores(ctx)) check(d?.tecla === '6' && d.id !== 'post-encaminhado', `tecla 6: ${JSON.stringify(d && { id: d.id, tecla: d.tecla })}`);
  // Com pedido de dinheiro junto, decide a caixa do dinheiro (IA, desde 08/09) — nunca o post.
  const comDinheiro = sinais([m(PESSOAL.replace('continua parado', 'preciso de dinheiro para pagar o aluguel'))]);
  for (const d of motores(comDinheiro)) check(d?.id !== 'post-encaminhado' && d?.id !== 'post-comercial', 'pedido de dinheiro não vira post');
  // Um post com a fala dela pedindo algo JUNTO: o pedido é dela, e quem responde é você.
  check(!c.postEncaminhado([m(SUELY), m('Vocês podem me ajudar com isso?')], ontem), 'post + pergunta dela: não é só post');
  check(!c.postEncaminhado([m(SUELY), m('áudio', 'AUDIO')], ontem), 'post + áudio sem transcrição: não é só post');
  // Uma marca só não basta: negrito num texto próprio é comum.
  const umaMarca = '*Bom dia!* ' + 'Ontem fui na reunião do bairro e falamos muito sobre o governo, a segurança e a política da cidade, que anda difícil para todo mundo que trabalha e paga imposto em dia. '.repeat(2);
  check(!c.postEncaminhado([m(umaMarca)], ontem), 'texto próprio com uma marca de post não vira post');
}

grupo('4. cortesia longa continua no rascunho de cortesia');
{
  const ctx = sinais([m(CORTESIA), m('Gratidão')]);
  check(!ctx.postEncaminhado, 'não é post');
  for (const d of motores(ctx)) check(d?.id === 'cortesia-rascunho' && d.ia, `cortesia-rascunho: ${JSON.stringify(d && { id: d.id, tecla: d.tecla })}`);
}

grupo('5. as proteções continuam vencendo');
{
  const nossa = motores(sinais([m(SUELY)], { ultimaEhNossa: true }));
  check(nossa.every((d) => d?.id !== 'post-encaminhado'), 'a conversa que termina em nós');
  check(!s.decisaoDoPostEncaminhado(sinais([m(SUELY)]), { id: 'x', tecla: '2' }), 'o pulo (2)');
  check(!s.decisaoDoPostEncaminhado(sinais([m(SUELY)]), { id: 'contexto-de-outro-dia', tecla: '5' }), 'o limite de horas');
  check(!s.decisaoDoPostEncaminhado(sinais([m(SUELY)]), { id: 'r', tecla: null, resposta: 'pedido-ajuda' }), 'resposta pronta de pedido');
}

grupo('6. o tom do rascunho político');
{
  const ctx = p.contextoPostEncaminhado([{ de: 'contato', texto: SUELY }]);
  const certo = 'Boa tarde! A justiça precisa prevalecer e a Constituição tem que valer para todos. Sigo firme na defesa da liberdade. Obrigado por compartilhar, um grande abraço!';
  check(p.falhasTomPost(certo, ctx).length === 0, `o exemplo dele passa: ${p.falhasTomPost(certo, ctx)}`);
  const falhas = p.falhasTomPost('Boa tarde! O texto do Senador Silva é forte. Nossa equipe concorda. O que você acha?', ctx);
  for (const f of ['não faça pergunta', 'não fale em "equipe"', 'feche com "um grande abraço"', 'não resuma nem comente o texto encaminhado', 'não cite quem assinou o post']) {
    check(falhas.includes(f), `barra: ${f}`);
  }

  // O prompt: o tom do post entra, e a regra da denúncia ("agradeça as informações… PARE") sai.
  const conversa = [{ de: 'nos', texto: 'Bom dia!', at: ontem.toISOString() }, { de: 'contato', texto: SUELY, at: agora.toISOString() }];
  const contato = ia.montarContatoRascunho({ mensagens: conversa, agora });
  check(!/N[ÃA]O ENTRE NO M[ÉE]RITO/.test(contato) && !/COMPARTILHAMENTO POL[ÍI]TICO PR[ÓO]PRIO/.test(contato),
    'sem a linha da denúncia e sem a do "compartilhamento político próprio"');
  const ruim = 'Boa tarde! Concordo com o Senador Silva. O que você acha?';
  const pedidos = []; const respostas = [ruim, certo];
  chrome.runtime.sendMessage = async (pd) => { pedidos.push(pd); return { ok: true, decisao: { texto: respostas.shift(), confianca: 0.95, precisaDeRevisao: false } }; };
  const r = await rascunhar({ mensagens: conversa, agora, templates: [], campos: {}, modelo: 'gpt-5.6-luna' });
  check(/POST POLÍTICO ENCAMINHADO/.test(pedidos[0]?.contato || ''), 'o prompt leva o tom do post');
  check(pedidos.length === 2 && r.texto === certo, `rascunho ruim é reescrito: ${r.texto}`);
}

fim();
