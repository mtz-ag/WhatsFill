/**
 * As travas da avaliação por IA.
 *
 * O prompt é pedido; isto aqui é regra. Todo teste deste arquivo responde a mesma pergunta: se o
 * modelo devolver algo esquisito, o painel manda mensagem errada para eleitor real?
 *
 * A resposta tem que ser não em todos os casos — inclusive nos que ninguém previu, porque o
 * padrão de segurança é `incerto`, que significa "o painel se comporta como antes da IA existir".
 */
import { check, grupo, fim } from './_harness.mjs';
import {
  montarSistemaRascunho,
  montarContatoRascunho,
  montarRequisicaoRascunho,
  revisarRascunho,
  validarRascunho,
  podeEnviarSozinho,
  CONFIANCA_RASCUNHO_AUTO,
  montarSistema,
  montarContato,
  montarRequisicao,
  validarDecisao,
  esquemaDaDecisao,
  RESTRITOS,
  CONFIANCA_MINIMA,
  MODELO_PADRAO,
} from '../src/lib/ia.js';

const IDS = ['pedir-dados', 'link-grupo', 'agradecimento', 'pedido-ajuda', 'pedido-emprego'];
const decidir = (d) => validarDecisao(d, IDS);

grupo('a decisão boa passa');
{
  const r = decidir({ acao: 'responder', templateId: 'pedir-dados', motivo: 'só mandou oi', confianca: 0.9 });
  check(r.acao === 'responder' && r.templateId === 'pedir-dados', `passou = ${JSON.stringify(r)}`);
  check(r.motivo === 'só mandou oi', 'o motivo chega à tela');
}

grupo('id inventado NÃO vira envio');
{
  const r = decidir({ acao: 'responder', templateId: 'resposta-que-eu-inventei', motivo: 'x', confianca: 0.99 });
  check(r.acao === 'incerto', `id inexistente vira incerto = ${r.acao}`);
  check(/não existe/.test(r.aviso), `e diz o porquê = ${r.aviso}`);

  check(decidir({ acao: 'responder', motivo: 'x', confianca: 1 }).acao === 'incerto', 'sem templateId também');
}

grupo('pedido de ajuda e de emprego NUNCA saem sozinhos');
{
  // A IA escolher "negar ajuda financeira" não é responder — é dizer que o caso é sensível.
  for (const id of RESTRITOS) {
    const r = decidir({ acao: 'responder', templateId: id, motivo: 'pediu cesta', confianca: 1 });
    check(r.acao === 'escalar', `${id} com confiança máxima ainda escala = ${r.acao}`);
    check(r.templateId === id, 'a sugestão vai junto, para ele mandar se quiser');
  }
}

grupo('confiança baixa vira incerto');
{
  const baixa = decidir({ acao: 'responder', templateId: 'link-grupo', motivo: 'acho', confianca: 0.4 });
  check(baixa.acao === 'incerto', `40% não recomenda = ${baixa.acao}`);
  check(/40%/.test(baixa.aviso), `o aviso diz quanto foi = ${baixa.aviso}`);

  const limite = decidir({ acao: 'responder', templateId: 'link-grupo', motivo: 'ok', confianca: CONFIANCA_MINIMA });
  check(limite.acao === 'responder', 'no limite exato, recomenda');

  // Escalar não tem mínimo: exigir certeza para escalar seria exigir certeza para ter dúvida.
  const dúvida = decidir({ acao: 'escalar', motivo: 'não entendi a conversa', confianca: 0.1 });
  check(dúvida.acao === 'escalar', 'escalada com confiança baixa continua escalada');
}

grupo('resposta quebrada nunca vira ação');
{
  check(decidir('isto não é json').acao === 'incerto', 'texto solto');
  check(/formato/.test(decidir('isto não é json').aviso), 'e explica');
  check(decidir(null).acao === 'incerto', 'nulo');
  check(decidir(undefined).acao === 'incerto', 'ausente');
  check(decidir({}).acao === 'incerto', 'objeto vazio');
  check(decidir({ acao: 'apagar tudo', templateId: 'pedir-dados', confianca: 1 }).acao === 'incerto', 'ação inventada');
  check(decidir({ acao: 'responder', templateId: 'pedir-dados', confianca: 'muita' }).acao === 'incerto', 'confiança não numérica');
  check(decidir('{"acao":"responder","templateId":"pedir-dados","confianca":0.9}').acao === 'responder', 'JSON em texto é aceito');
}

grupo('o prompt de sistema leva o catálogo e as regras que não podem faltar');
{
  const sistema = montarSistema({
    templates: [{ id: 'pedir-dados', name: 'Pedir dados', text: 'Nome completo / Cidade' }],
    regras: 'Nunca chame o contato pelo nome.',
  });
  check(/pedir-dados/.test(sistema), 'o id vai no catálogo');
  check(/Nome completo \/ Cidade/.test(sistema), 'o texto da resposta vai junto');
  check(/Nunca chame o contato pelo nome/.test(sistema), 'as regras dele entram');
  check(/NUNCA redige/.test(sistema), 'a regra de não escrever texto está no prompt');
  check(/dinheiro|cesta/.test(sistema), 'a regra de escalar pedido de ajuda está no prompt');
  check(/quero ajudar/i.test(sistema), 'e o aviso de que "quero ajudar" é apoiador');
}

grupo('o bloco do contato não vaza nem estoura');
{
  const contato = montarContato({
    mensagens: ['Oi', 'Maria Silva / Santo Ângelo'],
    campos: { Nome: 'Maria', Cidade: '', 'Tema de Interesse': 'Engajado' },
    etiquetas: ['CAMPANHA'],
  });
  check(/1\. Oi/.test(contato) && /2\. Maria Silva/.test(contato), 'numera as mensagens em ordem');
  check(/Nome: Maria/.test(contato), 'leva o cadastro');
  check(!/Cidade:/.test(contato), 'campo vazio não vira linha (é ruído e custa token)');
  check(/CAMPANHA/.test(contato), 'leva as etiquetas');

  const longa = montarContato({ mensagens: ['a'.repeat(5000)] });
  check(longa.length < 1200, `mensagem gigante é cortada = ${longa.length} caracteres`);
}

grupo('a requisição pede cache e formato — é o que segura o custo e a forma');
{
  const req = montarRequisicao({ sistema: 'S', contato: 'C', ids: IDS });
  check(req.model === MODELO_PADRAO, `modelo padrão = ${req.model}`);
  check(req.system[0].cache_control?.type === 'ephemeral', 'o sistema é cacheado (10% do preço a partir da 2ª)');
  check(req.output_config?.format?.type === 'json_schema', 'formato garantido por esquema');
  check(req.max_tokens <= 512, 'saída curta: é decisão, não texto');
  check(req.output_config.format.schema.properties.templateId.enum.length === IDS.length,
    'o esquema só admite ids que existem');

  const outro = montarRequisicao({ sistema: 'S', contato: 'C', ids: IDS, modelo: 'claude-haiku-4-5' });
  check(outro.model === 'claude-haiku-4-5', 'o modelo é escolha dele');
}

grupo('o esquema fecha a porta para campo extra');
{
  const e = esquemaDaDecisao(IDS);
  check(e.additionalProperties === false, 'nada além do previsto');
  check(e.required.includes('acao') && e.required.includes('confianca'), 'ação e confiança são obrigatórias');
}

grupo('rascunho: o prompt proíbe o que a lei proíbe, e ensina o tom pelos textos dele');
{
  const sistema = montarSistemaRascunho({
    templates: [{ id: 'agradecimento', name: 'Agradecer', text: 'Obrigado pela atenção! Um abraço.' }],
    regras: 'Cite a agenda de terça quando fizer sentido.',
  });
  check(/nunca envia/i.test(sistema), 'deixa claro que ela não envia');
  check(/9\.504/.test(sistema), 'cita a lei eleitoral');
  check(/cesta|rem[ée]dio|emprego/i.test(sistema), 'proíbe prometer bem ou benefício');
  check(/CRAS|assist[êe]ncia social/i.test(sistema), 'e diz para onde encaminhar em vez de prometer');
  check(/N[ÃA]O chame a pessoa pelo nome/i.test(sistema), 'mantém a regra do projeto de não usar nome');
  check(/Obrigado pela atenção/.test(sistema), 'as respostas DELE entram como exemplo de estilo');
  check(/agenda de terça/.test(sistema), 'as instruções dele entram');
  check(/inventar dado/i.test(sistema), 'proíbe inventar dado');
}

grupo('rascunho: a conversa longa entra inteira — é o caso de uso');
{
  const longa = 'a'.repeat(3000);
  const bloco = montarContatoRascunho({ mensagens: [longa], campos: { Cidade: 'Pelotas' } });
  check(bloco.length > 2500, `transcrição não é cortada cedo = ${bloco.length} caracteres`);
  check(/Pelotas/.test(bloco), 'a cidade vai junto');

  const req = montarRequisicaoRascunho({ sistema: 'S', contato: 'C' });
  check(req.system[0].cache_control?.type === 'ephemeral', 'o sistema do rascunho também é cacheado');
  // Passou a ter esquema em 20/08/2026: sem um numero devolvido pela IA nao ha como aplicar
  // limiar, e sem limiar nao ha envio automatico. Ver podeEnviarSozinho.
  check(!!req.output_config, 'rascunho agora vem com esquema, para ter confiança');
  check(req.max_tokens <= 1024, 'teto baixo: resposta de WhatsApp, não redação');
}

grupo('rascunho: a revisão levanta a mão, mas nunca esconde o texto');
{
  const limpo = revisarRascunho('Recebi seu áudio e entendi o ponto. Vou levar ao gabinete.');
  check(limpo.texto.length > 0 && limpo.avisos.length === 0, 'texto normal passa sem aviso');

  const marcador = revisarRascunho('Olá {{primeiro_nome}}, tudo bem?');
  check(marcador.avisos.some((a) => /marcador/.test(a)), 'marcador esquecido é avisado');
  check(marcador.texto.length > 0, 'e o texto continua disponível — quem decide é ele');

  const promessa = revisarRascunho('Vou conseguir a cesta para você esta semana.');
  check(promessa.avisos.length >= 2, `promessa levanta a mão duas vezes = ${JSON.stringify(promessa.avisos)}`);
  check(promessa.texto.length > 0, 'mesmo assim o texto aparece — esconder tiraria a decisão dele');

  check(revisarRascunho('').avisos.length === 1, 'vazio vira aviso');
  check(revisarRascunho(null).texto === '', 'nulo não explode');
  check(revisarRascunho('x'.repeat(2000)).avisos.some((a) => /longo/.test(a)), 'texto longo demais é avisado');
}



// ---------------------------------------------------------------------------
// A trava do envio automatico de rascunho
//
// Este e o unico ponto do projeto em que texto GERADO por IA chega a um eleitor sem revisao
// humana. Decisao do Thiago (20/08/2026), tomada depois de eu apontar o risco. Cada assercao aqui
// e uma trava contra um jeito especifico de uma frase inventada sair em nome do mandato.
// ---------------------------------------------------------------------------

grupo('podeEnviarSozinho: desligado por padrao');
{
  const bom = { texto: 'Obrigado pela mensagem!', confianca: 1, avisos: [] };
  check(!podeEnviarSozinho({ rascunho: bom }).pode, 'sem `ligado`, nao envia');
  check(!podeEnviarSozinho({ rascunho: bom, ligado: false }).pode, 'ligado:false idem');
  check(podeEnviarSozinho({ rascunho: bom, ligado: true }).pode, 'com tudo ok e ligado, envia');
}

grupo('podeEnviarSozinho: QUALQUER aviso veta');
{
  // A trava mais valiosa: nao depende de a IA ser honesta sobre si mesma.
  const base = { texto: 'Oi', confianca: 1 };
  for (const aviso of [
    'sobrou marcador no texto — troque antes de mandar',
    'parece prometer entregar alguma coisa — confira antes de mandar',
    'cita bem ou benefício (cesta, remédio, dinheiro, emprego) — a lei eleitoral proíbe prometer',
    'a própria IA pediu revisão humana',
  ]) {
    const r = podeEnviarSozinho({ rascunho: { ...base, avisos: [aviso] }, ligado: true });
    check(!r.pode, `vetado por: ${aviso.slice(0, 40)}…`);
  }
}

grupo('podeEnviarSozinho: confianca abaixo do limiar veta');
{
  const r = (c) => podeEnviarSozinho({ rascunho: { texto: 'Oi', confianca: c, avisos: [] }, ligado: true });
  check(!r(0.5).pode, '50% nao passa');
  check(!r(0.89).pode, '89% nao passa (limiar e 0,9)');
  check(r(0.9).pode, '90% passa');
  check(CONFIANCA_RASCUNHO_AUTO > 0.7, 'o limiar do envio automatico e MAIOR que o da decisao');
}

grupo('podeEnviarSozinho: texto vazio nunca sai');
{
  check(!podeEnviarSozinho({ rascunho: { texto: '', confianca: 1, avisos: [] }, ligado: true }).pode, 'vazio');
  check(!podeEnviarSozinho({ rascunho: { texto: '   ', confianca: 1, avisos: [] }, ligado: true }).pode, 'so espaco');
  check(!podeEnviarSozinho({ ligado: true }).pode, 'sem rascunho nenhum');
}

grupo('validarRascunho: a IA pedindo revisao vira aviso');
{
  const r = validarRascunho({ texto: 'Boa tarde! Recebemos sua mensagem.', confianca: 0.95, precisaDeRevisao: true });
  check(r.avisos.some((a) => /revisão humana/.test(a)), 'entra em avisos');
  check(!podeEnviarSozinho({ rascunho: r, ligado: true }).pode, 'e por isso nao envia sozinho');
}

grupo('validarRascunho: precisaDeRevisao ausente = SIM, por seguranca');
{
  const r = validarRascunho({ texto: 'Oi', confianca: 1 });
  check(r.precisaDeRevisao === true, 'campo ausente nao vira permissao');
  check(!podeEnviarSozinho({ rascunho: r, ligado: true }).pode, 'nao envia');
}

grupo('validarRascunho: promessa proibida bloqueia mesmo com confianca 1');
{
  // O caso que mais importa: a IA convencida de que pode prometer uma cesta.
  const r = validarRascunho({
    texto: 'Boa tarde! Vou mandar uma cesta básica para você essa semana.',
    confianca: 1,
    precisaDeRevisao: false,
  });
  check(r.avisos.length > 0, 'a revisao pegou');
  check(!podeEnviarSozinho({ rascunho: r, ligado: true }).pode, 'e o envio automatico foi vetado');
}

grupo('validarRascunho: resposta ilegivel nunca vira envio automatico');
{
  const r = validarRascunho('isto nao e json');
  check(r.confianca === 0, 'sem esquema, confianca zero');
  check(!podeEnviarSozinho({ rascunho: r, ligado: true }).pode, 'entao nao sai sozinho');
  check(r.texto === 'isto nao e json', 'mas o texto continua servindo de rascunho para ele ler');
}

fim();
