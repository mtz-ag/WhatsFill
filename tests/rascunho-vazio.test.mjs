/**
 * "Não saiu rascunho: gpt-5.6-luna: a IA não devolveu rascunho" (31/10/2026) e os consertos da v9.
 *
 * O caso, reproduzido contra a API (5 chamadas, 4 com texto vazio): corrente política encaminhada,
 * "E aí?", nossa resposta "Agradeço as informações e estamos atentos...", e "E aí?" de novo. A linha
 * JÁ AGRADECEMOS (v8) proíbe agradecer, repetir e pedir detalhes e manda marcar naoHaOQueResponder;
 * sem o formulário para escrever (rascunho pedido fora da rodada, `state.sinais` nulo), o modelo
 * devolveu `{"texto":"","naoHaOQueResponder":true}`. `validarRascunho` descartava a opção vazia e
 * devolvia o `vazio` de fábrica — com `naoHaOQueResponder: false` — e a tela dizia só "não devolveu".
 *
 * Rode: node tests/rascunho-vazio.test.mjs
 */
import { readFileSync } from 'node:fs';
import { check, grupo, fim, lib } from './_harness.mjs';

const ia = await lib('ia.js');
const cliente = await lib('ia-cliente.js');
const sugestao = await lib('sugestao.js');
const cortesia = await lib('cortesia.js');

const raiz = new URL('../', import.meta.url);
const ler = (p) => readFileSync(new URL(p, raiz), 'utf8');
const painel = ler('src/panel/panel.js');
const agora = new Date('2026-10-31T14:05:00-03:00');

/** A resposta CRUA da API na reprodução (id e fingerprint tirados). */
const CRU_LUNA = {
  object: 'chat.completion',
  model: 'gpt-5.6-luna',
  choices: [{
    index: 0,
    message: {
      role: 'assistant',
      content: '{"opcoes":[{"texto":"","confianca":0.99,"precisaDeRevisao":false,"motivo":"Nada novo na conversa","naoCabePedirOCadastro":true,"naoHaOQueResponder":true}]}',
      refusal: null,
    },
    finish_reason: 'stop',
  }],
  usage: { prompt_tokens: 14249, completion_tokens: 164, prompt_tokens_details: { cached_tokens: 13310 }, completion_tokens_details: { reasoning_tokens: 98 } },
};

function comFetch(resposta, fn) {
  const antes = globalThis.fetch;
  let corpo = null;
  globalThis.fetch = async (_url, init) => {
    corpo = JSON.parse(init.body);
    return { ok: true, status: 200, async json() { return resposta; }, async text() { return JSON.stringify(resposta); } };
  };
  return fn().then((r) => ({ r, corpo })).finally(() => { globalThis.fetch = antes; });
}

grupo('o pedido do gpt-5.6-luna NAO e a causa: forma certa, e a resposta veio inteira');
{
  const corpo = ia.montarRequisicaoRascunho({ sistema: 's', contato: 'c', modelo: 'gpt-5.6-luna' });
  check(corpo.max_completion_tokens >= 2048 && !('max_tokens' in corpo), 'max_completion_tokens, nunca max_tokens');
  check(corpo.reasoning_effort === 'medium', 'reasoning_effort medium (o raciocinio usou ~100 tokens de 8192)');
  check(!('temperature' in corpo), 'sem temperature');
  check(corpo.response_format?.type === 'json_schema' && corpo.response_format.json_schema.strict === true, 'json_schema strict');
  const { r } = await comFetch(CRU_LUNA, () => cliente.atender({ type: cliente.MSG_IA, modo: 'rascunho', sistema: 's', contato: 'c', modelo: 'gpt-5.6-luna' }, 'sk-teste'));
  check(r.ok === true && typeof r.decisao === 'string', 'finish_reason stop, sem recusa: atender devolve ok com o JSON');
}

grupo('a causa: texto vazio + naoHaOQueResponder virava "a IA nao devolveu rascunho"');
{
  const v = ia.validarRascunho(CRU_LUNA.choices[0].message.content, agora, { jaAgradecemosADenuncia: true });
  check(v.texto === '', 'continua sem texto (nada inventado no lugar da IA)');
  check(v.naoHaOQueResponder === true, 'a abstencao SOBREVIVE (antes: false, e o painel nem a via)');
  check(!v.avisos.includes('a IA não devolveu rascunho'), 'o aviso nao e mais o generico');
  check(v.avisos[0].startsWith(ia.AVISO_ABSTENCAO_SEM_TEXTO), 'diz que a IA marcou "nao ha o que responder"');
  check(/JÁ AGRADECEMOS/.test(v.avisos[0]), 'e diz QUAL regra a calou');
  check(v.motivo === 'Nada novo na conversa', 'o motivo da IA chega a tela');

  const semAbst = ia.validarRascunho('{"opcoes":[{"texto":"  ","confianca":0.5,"precisaDeRevisao":true,"motivo":"","naoCabePedirOCadastro":false,"naoHaOQueResponder":false}]}', agora, {});
  check(semAbst.avisos[0] === ia.AVISO_TEXTO_EM_BRANCO && semAbst.naoHaOQueResponder === false, 'texto em branco sem abstencao: aviso proprio');
  check(/sem conteúdo nenhum/.test(ia.validarRascunho(null, agora).avisos[0]), 'content nulo: "a API respondeu sem conteudo"');
  const ok = ia.validarRascunho('{"opcoes":[{"texto":"Seguimos por aqui.","confianca":0.9,"precisaDeRevisao":false,"motivo":"x","naoCabePedirOCadastro":true,"naoHaOQueResponder":true}]}', agora, {});
  check(ok.texto === 'Seguimos por aqui.' && ok.naoHaOQueResponder === true, 'com texto, nada muda');

  check(/const porque = \(rascunho\?\.avisos/.test(painel) && /motivo: `\$\{casa\}: \$\{porque/.test(painel),
    'o painel poe esse aviso no "Nao saiu rascunho: <modelo>: ..."');
  check(/não escreveu texto, mas há PERGUNTA PENDENTE/.test(painel), 'abstencao sem texto com pergunta pendente: o Andamento nao diz "mantive o rascunho"');
}

grupo('o conserto do prompt: JA AGRADECEMOS nunca deixa o texto vazio, e a frase sugerida passa nas travas');
{
  const at = (h) => new Date(`2026-10-31T${h}:00-03:00`).toISOString();
  const CORRENTE = '*1ª FASE*\nAparelhamento do STF - *Concluído*\n\n*2ª FASE*\nControle da imprensa - *Em andamento*\n\n' +
    'Perseguição de igrejas - *Em andamento*\n\nMoeda Digital - *Em andamento*\n\nE você, vai ajudar a *Organização Criminosa do Partido dos Trabalhadores* a concretizar isso?\n\nÉ Importante repassar para o máximo possível...' +
    '\n\nCriação de Centros de Militância - *Em andamento*\n\nCriação de cotas alimentares - *Em andamento*';
  const NOSSA = 'Boa tarde! Desculpe a demora.\n\nAgradeço as informações e estamos atentos e acompanhando o assunto.';
  const conversa = [
    { de: 'contato', texto: CORRENTE, at: at('13:55') },
    { de: 'contato', texto: 'E aí?', at: at('13:59') },
    { de: 'nos', texto: NOSSA, at: at('14:02') },
    { de: 'contato', texto: 'E aí?', at: at('14:02') },
  ];
  check(ia.jaAgradecemosADenuncia(conversa), 'o caso da print: ja agradecemos');
  const bloco = ia.montarContatoRascunho({ mensagens: conversa, agora }).replace(/\s+/g, ' ');
  check(/JÁ AGRADECEMOS/.test(bloco) && /marque o campo naoHaOQueResponder/.test(bloco), 'a linha v8 continua');
  check(/o campo texto NUNCA fica vazio/.test(bloco), 'e agora exige texto mesmo marcando');
  const sugerida = 'Seguimos por aqui. Se precisar de alguma coisa, é só escrever.';
  check(!ia.AGRADECEU_A_DENUNCIA.test(sugerida), 'a frase sugerida nao e o agradecimento repetido');
  const rev = ia.revisarRascunho(sugerida, agora, { jaAgradecemosADenuncia: true, nossaUltima: NOSSA, jaFalamosHoje: true, jaFalamos: true });
  check(rev.texto === sugerida && ia.rascunhoPodeSairSozinho(rev.avisos), `nenhuma trava a barra (${rev.avisos.join('; ') || 'sem avisos'})`);
}

grupo('a recusa do modelo tem nome (antes: content nulo -> "nao devolveu rascunho")');
{
  const recusa = { choices: [{ message: { role: 'assistant', content: null, refusal: 'I can’t help with that.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5 } };
  const { r } = await comFetch(recusa, () => cliente.atender({ type: cliente.MSG_IA, modo: 'rascunho', sistema: 's', contato: 'c', modelo: 'gpt-5.6-luna' }, 'sk-teste'));
  check(r.ok === false && /se recusou a responder: I can/.test(r.motivo), `motivo: ${r.motivo}`);
  check(!!r.custo, 'e a chamada paga entra na conta');
}

grupo('B1: "Chamar a IA" usa a chave do modelo do RASCUNHO, nao a das conferencias');
{
  check(ia.provedorDoModelo('gpt-5.6-luna') === 'openai' && ia.provedorDoModelo('claude-opus-5') === 'anthropic', 'os provedores');
  check(/state\.iaTemChaveRascunho = !!state\.iaChaves\[iaLib\.provedorDoModelo\(modeloDoRascunho\(\)\)\];/.test(painel), 'lerChavesDaIA calcula a do rascunho por modeloDoRascunho()');
  check(/state\.iaTemChave = !!state\.iaChaves\[iaLib\.provedorDoModelo\(state\.ia\?\.modelo/.test(painel), 'a das conferencias continua por ia.modelo');
  const rascunhar = painel.slice(painel.indexOf('async function rascunharParaEle()'), painel.indexOf('async function rascunharParaEle()') + 900);
  check(/if \(!state\.iaTemChaveRascunho\)/.test(rascunhar) && !/!state\.iaTemChave\)/.test(rascunhar), 'rascunharParaEle olha a do rascunho');
  const cartao = painel.slice(painel.indexOf('function renderRascunho()'), painel.indexOf('function renderRespostas()'));
  check(/if \(!state\.iaTemChaveRascunho\) \{\s+botao\.disabled = true;/.test(cartao), 'o botao do cartao tambem');
  check(!/Sem chave da API cadastrada \(aba Config\)/.test(cartao) && /o modelo do rascunho é/.test(cartao), 'e o aviso diz QUAL chave falta');
  check(/if \(state\.iaTemChaveRascunho\) \{\s+opcoes\.push\(\{\s+tecla: '8'/.test(painel), 'a tecla 8 da caixa tambem');
  check(/salvarIA\(\{ modeloRascunho: selRascunho\.value \}\);[\s\S]{0,200}await lerChavesDaIA\(\);/.test(painel), 'trocar o modelo do rascunho reler as chaves');
  check(/O rascunho não depende desta chave/.test(painel), 'sem a chave das conferencias: aviso de que elas seguem sem a IA');
  // As conferencias continuam fechadas na chave delas: sem ela, voltam incerto/'' sem chamar nada.
  for (const [nome, re] of [
    ['cidade', /if \(!pode \|\| !state\.iaTemChave\) return false;/],
    ['etiqueta', /async function conferirEtiquetaComIA[\s\S]{0,120}if \(!\(state\.ia\?\.ligada && state\.iaTemChave\)\) return '';/],
    ['encerramento', /async function encerrouAConversa[\s\S]{0,200}if \(!\(state\.ia\?\.ligada && state\.iaTemChave\)\) return false;/],
  ]) check(re.test(painel), `conferencia de ${nome} degrada sem a chave dela`);
  const semChave = await cliente.atender({ modo: 'cidade', sistema: 's', contato: 'c', modelo: 'claude-opus-5' }, undefined);
  check(semChave.ok === false && /Anthropic/.test(semChave.motivo), 'e o worker diz qual chave falta, sem lancar');
}

grupo('B2: o texto da IA aparece no cartao, e sobrevive ao renderAll do withBusy');
{
  const g = { contatoId: 'c1', texto: 'Seguimos por aqui.', avisos: ['x'] };
  check(ia.rascunhoDoCartaoAtual(g, 'c1')?.texto === 'Seguimos por aqui.', 'o mesmo contato ve o texto');
  check(ia.rascunhoDoCartaoAtual(g, 'c2') === null, 'outro contato nao ve');
  check(ia.rascunhoDoCartaoAtual(null, 'c1') === null && ia.rascunhoDoCartaoAtual(g, undefined) === null, 'sem guardado ou sem contato: nada');
  const cartao = painel.slice(painel.indexOf('function renderRascunho()'), painel.indexOf('function renderRespostas()'));
  check(/state\.rascunhoDoCartao = \{ contatoId: state\.contact\?\.id, texto: saida\.value/.test(cartao), 'o clique guarda no state');
  check(/const guardado = iaLib\.rascunhoDoCartaoAtual\(state\.rascunhoDoCartao, state\.contact\?\.id\);\s+if \(guardado\) \{\s+saida\.value = guardado\.texto;/.test(cartao), 'o cartao remontado le do state');
  check(/state\.rascunhoDoCartao = null;/.test(painel), 'zerado na troca de contato');
  check(/finally \{\s+state\.busy = false;[\s\S]{0,200}renderAll\(\);/.test(painel), '(a causa: withBusy redesenha no finally)');
}

grupo('B3: corrente sem a IA nao cai na tecla 1; agradece uma vez, sem formulario, sem concluir');
{
  const c = { podeEnviar: true, conteudoPedido: 'Seguranca', denunciaOuCorrente: { motivo: 'corrente' } };
  check(!['conteudo-pedido', 'anuncio-modelo-e-dados'].includes(sugestao.sugerirAcao(c)?.id), `corrente: o quadro nao manda o modelo (${sugestao.sugerirAcao(c)?.id})`);
  check(sugestao.sugerirAcao({ podeEnviar: true, conteudoPedido: 'Seguranca' })?.id === 'conteudo-pedido', 'sem corrente, o modelo continua (nada mais mudou)');
  check(!!sugestao.modeloNaoCabe(c) && !sugestao.modeloNaoCabe({}), 'modeloNaoCabe so com corrente/denuncia');
  check(sugestao.cabeAgradecerCorrente(c, false) && !sugestao.cabeAgradecerCorrente(c, true) && !sugestao.cabeAgradecerCorrente({}, false),
    'a tecla c so aparece uma vez (antes de agradecermos)');
  const t = sugestao.TEXTO_AGRADECER_CORRENTE;
  check(!/\{\{/.test(t) && !/nome|cidade/i.test(t), 'o texto nao chama pelo nome nem pede cadastro');
  check(ia.travasDoEscopo(t, {}).length === 0, 'sem urgencia/prioridade, sem prometer chegar ao deputado');
  check(ia.AGRADECEU_A_DENUNCIA.test(t), 'e casa o "ja agradecemos" (a segunda vez e barrada)');
  check(/modeloTravado = sugestaoLib\.modeloNaoCabe\(\{ denunciaOuCorrente: correnteNaRajada \}\)/.test(painel), 'a tecla 1 some com o motivo');
  const ramo = painel.slice(painel.indexOf("if (escolha === 'agradecercorrente') {"), painel.indexOf("if (escolha === 'perguntarajuda') {"));
  check(ramo.length > 0 && /sendTemplate\(agradecer/.test(ramo), 'a tecla c tem ramo (a licao da tecla 0)');
  check(!/concluirPeloPainel|withCompletionDate: true/.test(ramo), 'e nao conclui nem carimba data de conclusao');
  check(/tecla: 'c', valor: 'agradecercorrente'/.test(painel), 'a opcao existe');
  const ent = [{ texto: 'x'.repeat(10) }];
  check(!cortesia.denunciaOuCorrente(ent, null), '(controle: texto comum nao e corrente)');
}

fim();
