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

fim();
