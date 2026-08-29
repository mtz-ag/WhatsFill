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
  vaiCachear,
  tokensAproximados,
  CACHE_MINIMO_TOKENS,
  custoEmDolares,
  acumularGasto,
  podeGastar,
  mesDe,
  PRECOS_USD_POR_MTOK,
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
  // O modelo vai EXPLÍCITO: o padrão é o Haiku, que não recebe `effort`, e um teste que herda
  // o padrão para de testar o que diz testar no dia em que o padrão muda.
  const req = montarRequisicao({ sistema: 'S', contato: 'C', ids: IDS, modelo: 'claude-opus-5' });
  check(req.model === 'claude-opus-5', `o modelo pedido é o que vai no corpo (${req.model})`);
  check(req.system[0].cache_control?.type === 'ephemeral', 'o sistema é cacheado (10% do preço a partir da 2ª)');
  check(req.output_config?.format?.type === 'json_schema', 'formato garantido por esquema');
  // O teto era 512 e virou 2048 quando o Opus 5 entrou: ele PENSA por padrão, e o pensamento
  // cabe dentro do `max_tokens`. Com 512 o raciocínio consumia a cota e o JSON saía truncado —
  // chamada paga que vira "incerto". Quem segura o custo aqui é o `effort`, não o teto.
  check(req.output_config.effort === 'low', 'decisão é classificação: esforço baixo');

  // Regressão: o Haiku 4.5 RECUSA `effort` com 400. Ele está no seletor de modelo da Config,
  // então mandar o parâmetro para todo mundo quebraria a opção mais barata — justamente a que
  // alguém escolhe quando está preocupado com gasto.
  const haiku = montarRequisicao({ sistema: 's', contato: 'c', ids: ['a'], modelo: 'claude-haiku-4-5' });
  check(haiku.output_config.effort === undefined, 'Haiku não recebe effort');
  check(!!haiku.output_config.format, 'mas continua com esquema de saída');
  check(req.max_tokens >= 1024, 'com folga para o pensamento caber antes do JSON');
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

  const req = montarRequisicaoRascunho({ sistema: 'S', contato: 'C', modelo: 'claude-opus-5' });
  check(req.system[0].cache_control?.type === 'ephemeral', 'o sistema do rascunho também é cacheado');
  // Passou a ter esquema em 20/08/2026: sem um numero devolvido pela IA nao ha como aplicar
  // limiar, e sem limiar nao ha envio automatico. Ver podeEnviarSozinho.
  check(!!req.output_config, 'rascunho agora vem com esquema, para ter confiança');
  check(req.max_tokens >= 2048, 'folga para o pensamento do Opus 5 caber antes do texto');
  // Único caminho em que uma frase gerada chega a um eleitor sem ninguém ler: aqui não se
  // economiza esforço. O texto continua curto pelo prompt, não pelo teto.
  check(req.output_config.effort === 'medium', 'rascunho não usa o esforço mais barato');
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


grupo('custo: o que a chamada custou em dolares');
{
  // 1 milhao de tokens de entrada no Opus 5 = US$ 5, por definicao da tabela.
  const so = custoEmDolares({ entrada: 1e6, cacheEscrito: 0, cacheLido: 0, saida: 0 }, 'claude-opus-5');
  check(Math.abs(so - 5) < 1e-9, 'entrada pura bate com a tabela');

  const saida = custoEmDolares({ saida: 1e6 }, 'claude-opus-5');
  check(Math.abs(saida - 25) < 1e-9, 'saida custa 5x a entrada');

  // O numero que justifica o cache_control: ler do cache custa 10% do preco da entrada.
  const lido = custoEmDolares({ cacheLido: 1e6 }, 'claude-opus-5');
  check(Math.abs(lido - 0.5) < 1e-9, 'leitura de cache custa 10% da entrada');
  const escrito = custoEmDolares({ cacheEscrito: 1e6 }, 'claude-opus-5');
  check(Math.abs(escrito - 6.25) < 1e-9, 'escrita de cache custa 1,25x');
  check(lido < so && escrito > so, 'ler e mais barato que a entrada crua, escrever e mais caro');

  check(custoEmDolares(null) === 0, 'sem uso, custo zero');
}

grupo('custo: modelo desconhecido cobra pelo mais caro');
{
  // Preco que a extensao nao conhece nao pode virar gasto invisivel: superestimar so faz o
  // teto chegar mais cedo, que e o lado seguro de errar.
  const caro = Math.max(...Object.values(PRECOS_USD_POR_MTOK).map((p) => p.saida));
  const r = custoEmDolares({ saida: 1e6 }, 'modelo-que-nao-existe');
  check(Math.abs(r - caro) < 1e-9, 'cobra pelo mais caro da tabela');
}

grupo('gasto: acumula e vira o mes sozinho');
{
  const jan = new Date(2026, 0, 15).getTime();
  const fev = new Date(2026, 1, 2).getTime();

  let g = acumularGasto(null, 1.5, jan, 1000);
  check(g.mes === mesDe(jan) && g.usd === 1.5 && g.chamadas === 1, 'primeira chamada abre o mes');

  g = acumularGasto(g, 2.5, jan, 500);
  check(g.usd === 4 && g.chamadas === 2 && g.tokens === 1500, 'segunda chamada soma');

  // A virada de mes nao depende de nenhum agendador: o mes muda no primeiro uso do mes novo.
  g = acumularGasto(g, 1, fev, 10);
  check(g.mes === mesDe(fev) && g.usd === 1 && g.chamadas === 1, 'mes novo comeca do zero');
}

grupo('teto: para de gastar quando estoura, e nao antes');
{
  const agora = new Date(2026, 5, 10).getTime();
  const mes = mesDe(agora);

  check(podeGastar({ gasto: { mes, usd: 19.99 }, tetoUsd: 20, ts: agora }).pode, 'abaixo do teto passa');

  const barrado = podeGastar({ gasto: { mes, usd: 20 }, tetoUsd: 20, ts: agora });
  check(!barrado.pode, 'no teto, barra');
  check(/Config/.test(barrado.motivo), 'e o motivo diz onde mudar');

  // Teto zero e escolha explicita dele na Config, nao ausencia de configuracao.
  check(podeGastar({ gasto: { mes, usd: 9999 }, tetoUsd: 0, ts: agora }).pode, 'teto 0 = sem teto');

  // Regressao: gasto do mes PASSADO nao pode barrar o mes novo.
  const passado = podeGastar({ gasto: { mes: '2026-05', usd: 500 }, tetoUsd: 20, ts: agora });
  check(passado.pode && passado.usado === 0, 'gasto do mes passado nao conta no mes novo');
}

grupo('teto: config antiga sem tetoUsd nao pode virar gasto sem limite');
{
  // Quem ja tinha a IA configurada antes do teto existir le `tetoUsd: undefined`. O `store.get`
  // mescla os defaults justamente por isso; aqui travamos o outro lado: se a mescla falhar, o
  // que passa e `undefined`, e `podeGastar` NAO pode tratar isso como "pode gastar a vontade"
  // sem que alguem tenha escolhido. O comportamento e documentado, entao fica travado por teste.
  const r = podeGastar({ gasto: { mes: mesDe(), usd: 100 }, tetoUsd: undefined });
  check(r.pode && r.teto === 0, 'sem teto definido, nao barra — por isso o default precisa mesclar');
}


grupo('cache: o minimo nao cresce com a geracao, entao e tabela e nao regra');
{
  // Medido em 29/08: ~1.300 tokens com as 11 respostas de fabrica. O CLAUDE.md dizia 3.700.
  const real = 1300;

  check(vaiCachear('claude-opus-5', real), 'Opus 5 (min 512) cacheia');
  check(vaiCachear('claude-sonnet-5', real), 'Sonnet 5 (min 1024) cacheia');
  check(!vaiCachear('claude-haiku-4-5', real), 'Haiku 4.5 (min 4096) NAO cacheia');

  // Regressao do alarme falso: o painel ensina que "SEM CACHE" e sinal de problema. Se este
  // teste passar a falhar porque o prompt cresceu, o alarme do Haiku volta a fazer sentido —
  // e o texto da tela precisa mudar junto.
  check(CACHE_MINIMO_TOKENS['claude-haiku-4-5'] > CACHE_MINIMO_TOKENS['claude-opus-5'],
    'o modelo mais novo tem o MENOR minimo: nao da para deduzir pela geracao');

  // Modelo fora da tabela assume que cacheia: alarme por desconhecimento treina a ignorar.
  check(vaiCachear('modelo-futuro', 10), 'modelo desconhecido nao dispara alarme');
}

grupo('padrao: o modelo que roda em quem nunca abriu o seletor');
{
  // Escolha dele em 29/08. Padrao caro e o que transforma "vou testar" em fatura.
  check(MODELO_PADRAO === 'claude-haiku-4-5', 'padrao e o Haiku, o mais barato');

  // E o padrao precisa ser um modelo que a extensao sabe precificar, senao o teto conta errado.
  check(!!PRECOS_USD_POR_MTOK[MODELO_PADRAO], 'o padrao esta na tabela de precos');

  check(tokensAproximados('a'.repeat(3500)) === 1000, 'estimativa de token: ~3,5 chars por token');
  check(tokensAproximados('') === 0, 'texto vazio, zero tokens');
}

fim();
