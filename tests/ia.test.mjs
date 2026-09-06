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
import { PADRAO_DE_ATENDIMENTO } from '../src/lib/atendimento.js';
import {
  montarSistemaRascunho,
  montarContatoRascunho,
  PEDIDO_DE_DADOS_NO_RASCUNHO,
  saudacaoDeAgora,
  montarRequisicaoRascunho,
  revisarRascunho,
  rascunhoPodeSairSozinho,
  AVISOS_QUE_IMPEDEM_ENVIO,
  validarRascunho,
  vaiCachear,
  tokensAproximados,
  CACHE_MINIMO_TOKENS,
  custoEmDolares,
  acumularGasto,
  podeGastar,
  mesDe,
  PRECOS_USD_POR_MTOK,
  montarSistema,
  montarContato,
  montarRequisicao,
  validarDecisao,
  esquemaDaDecisao,
  RESTRITOS,
  CONFIANCA_MINIMA,
  MODELO_PADRAO,
  validarCidade,
  montarContatoCidade,
  montarSistemaCidade,
  montarRequisicaoCidade,
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
  /**
   * **Duas assercoes cairam em 06/09/2026, e as duas estavam certas em cair:**
   *
   *  - *"nunca envia"* deixou de ser verdade na 2.60 (com "Automatizar" marcada o rascunho SAI
   *    sozinho), e o prompt nao pode afirmar o contrario;
   *  - *"diz para onde encaminhar (CRAS)"* virou o oposto do que ele mandou: no padrao dele,
   *    *"Procure o CRAS"* esta na lista do que NAO dizer, porque soa a minimizacao. O texto pronto
   *    `pedido-ajuda`, que lista SINE e CRAS com detalhe, nao foi tocado -- ele e dele.
   */
  check(/9\.504/.test(sistema), 'cita a lei eleitoral');
  check(/cesta|rem[ée]dio|emprego/i.test(sistema), 'proíbe prometer bem ou benefício');
  check(/N[ÃA]O chame a pessoa pelo nome/i.test(sistema), 'mantém a regra do projeto de não usar nome');

  /**
   * **Genero: na duvida, neutro** — regra dele (06/09/2026), com a print da Marli: a IA escreveu
   * *"Voce esta COBERTO de razao em cobrar"* para uma contato chamada Marli.
   *
   * Fica no PROMPT e nao em `revisarRascunho` porque concordancia nao e mecanica: consertar
   * exigiria saber o genero e analisar a frase, e AVISAR seria pior — sem saber o genero, o aviso
   * tocaria tambem nos rascunhos certos, e alarme que toca sempre se aprende a ignorar.
   *
   * O teste guarda as duas metades: a regra do neutro e o EXEMPLO concreto. Mandar "escreva no
   * neutro" sem mostrar como deixa o modelo no masculino, que e o padrao dele em portugues.
   */
  check(/na d[úu]vida, escreva no NEUTRO/i.test(sistema), 'manda escrever no neutro quando nao souber o genero');
  check(/coberto de raz[ãa]o/i.test(sistema), 'e mostra COMO, com o exemplo da print da Marli');
  check(/o nome do cadastro N[ÃA]O serve/i.test(sistema),
    'e proibe deduzir o genero pelo nome do cadastro, que e o mesmo que a regra 1 manda nao usar');
  check(/Obrigado pela atenção/.test(sistema), 'as respostas DELE entram como exemplo de estilo');
  check(/agenda de terça/.test(sistema), 'as instruções dele entram');
  check(/n[ãa]o invente/i.test(sistema), 'proíbe inventar informação');

  /**
   * **O PADRAO DE ATENDIMENTO dele está no prompt** (06/09/2026: *"a IA deve seguir esse padrao
   * para responder"*). Cinco regras que só existem no documento dele -- se alguem trocar o prompt
   * por um resumo, estas caem antes de a IA começar a escrever diferente em producao.
   */
  check(sistema.includes(PADRAO_DE_ATENDIMENTO), 'o padrao dele vai INTEIRO, e nao resumido');
  check(/OUVIR .* ENTENDER .* ACOLHER/i.test(sistema), 'a ordem que ele definiu esta la');
  check(/sentimento antes do assunto/i.test(sistema), 'identificar o sentimento antes do assunto');
  check(/n[ãa]o discuta com o cidad[ãa]o/i.test(sistema), 'nao discutir com o cidadao');
  check(/Procure o CRAS/.test(sistema), 'e "Procure o CRAS" aparece na lista do que NAO dizer');
  check(/RESPONDA AO QUE A PESSOA EST[ÁA] VIVENDO/i.test(sistema), 'o principio final dele fecha o documento');
}

grupo('rascunho: a conversa longa entra inteira — é o caso de uso');
{
  const longa = 'a'.repeat(3000);
  const bloco = montarContatoRascunho({ mensagens: [longa], campos: { Cidade: 'Pelotas' } });
  check(bloco.length > 2500, `transcrição não é cortada cedo = ${bloco.length} caracteres`);
  check(/Pelotas/.test(bloco), 'a cidade vai junto');

  const req = montarRequisicaoRascunho({ sistema: 'S', contato: 'C', modelo: 'claude-opus-5' });
  check(req.system[0].cache_control?.type === 'ephemeral', 'o sistema do rascunho também é cacheado');
  // O esquema traz a confianca e o `precisaDeRevisao`, que hoje viram AVISO na tela dele -- o
  // envio automatico saiu em 03/09, mas os dois numeros continuam servindo para ele decidir.
  check(!!req.output_config, 'rascunho vem com esquema, para ter confiança');
  check(req.max_tokens >= 2048, 'folga para o pensamento do Opus 5 caber antes do texto');
  // O rascunho e o que ele vai ler e mandar: nao se economiza esforco aqui.
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
// O que a revisao do rascunho levanta
//
// **O envio automatico foi RETIRADO em 03/09/2026**, a pedido dele: *"retire essa mensagem
// automatica, so no modo IA manda sem eu escolher"*. Era o unico ponto do projeto em que texto
// gerado por IA chegava a um eleitor sem ninguem ler; as quatro travas funcionavam e a mensagem
// saia mesmo assim.
//
// O que estas asercoes protegem agora e o AVISO: o rascunho cai no campo de mensagem e a revisao
// diz o que ele precisa olhar antes de apertar enviar. Nenhuma delas envia coisa nenhuma.
// ---------------------------------------------------------------------------

grupo('validarRascunho: a IA pedindo revisao vira aviso');
{
  const r = validarRascunho({ texto: 'Boa tarde! Recebemos sua mensagem.', confianca: 0.95, precisaDeRevisao: true });
  check(r.avisos.some((a) => /revisão humana/.test(a)), 'entra em avisos');
  check(r.texto.length > 0, 'e o texto continua indo para o campo de mensagem, com o aviso junto');
}

grupo('validarRascunho: precisaDeRevisao ausente = SIM, por seguranca');
{
  const r = validarRascunho({ texto: 'Oi', confianca: 1 });
  check(r.precisaDeRevisao === true, 'campo ausente nao vira permissao');
}

grupo('validarRascunho: promessa proibida bloqueia mesmo com confianca 1');
{
  // O caso que mais importa: a IA convencida de que pode prometer uma cesta.
  const r = validarRascunho({
    texto: 'Boa tarde! Vou mandar uma cesta básica para você essa semana.',
    confianca: 1,
    precisaDeRevisao: false,
  });
  check(r.avisos.length > 0, 'a revisao pegou -- e o aviso aparece na linha do Andamento');
}

grupo('validarRascunho: resposta ilegivel nunca vira envio automatico');
{
  const r = validarRascunho('isto nao e json');
  check(r.confianca === 0, 'sem esquema, confianca zero');
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

// ---------------------------------------------------------------------------
// Cidade — a IA confere o palpite, e nao pode inventar municipio
// ---------------------------------------------------------------------------

const MUNICIPIOS = ['Canoas', 'Cachoeirinha', 'Santo Angelo', 'Porto Alegre', 'Rio Grande'];
const conferir = (d) => validarCidade(d, { municipios: MUNICIPIOS });

grupo('cidade: a conferencia boa passa');
{
  const ok = conferir({ acao: 'aceitar', motivo: 'ela respondeu o formulario', confianca: 0.95 });
  check(ok.acao === 'aceitar', 'aceitar com confianca alta passa');
  check(ok.cidade === '', 'aceitar nao mexe no nome: quem grava usa o palpite que ja estava la');

  const corr = conferir({ acao: 'corrigir', cidade: 'Cachoeirinha', motivo: 'ela disse', confianca: 0.9 });
  check(corr.acao === 'corrigir' && corr.cidade === 'Cachoeirinha', 'corrigir para municipio que existe passa');
}

grupo('cidade: o nome que sai e o OFICIAL, nao o que a IA digitou');
{
  // A etiqueta de cidade nasce daqui. Duas grafias virariam duas etiquetas para o mesmo
  // municipio, e o filtro dele partido em dois -- e o CRM ja tem rotulo repetido demais.
  const r = conferir({ acao: 'corrigir', cidade: 'santo angelo', motivo: 'x', confianca: 0.9 });
  check(r.cidade === 'Santo Angelo', 'sem acento e sem caixa casa, e volta a grafia da lista');
}

grupo('cidade: municipio inventado NAO passa');
{
  // A trava principal. Prompt e pedido; isto e regra.
  const r = conferir({ acao: 'corrigir', cidade: 'Curitiba', motivo: 'x', confianca: 0.99 });
  check(r.acao === 'incerto', 'cidade fora da lista vira incerto, mesmo com 99% de certeza');
  check(/nao e municipio do RS/.test(r.aviso.normalize('NFD').replace(/[̀-ͯ]/g, '')),
    'e o aviso diz por que');

  const vazia = conferir({ acao: 'corrigir', motivo: 'x', confianca: 0.9 });
  check(vazia.acao === 'incerto', 'mandar corrigir sem dizer para qual cidade vira incerto');

  // Sem a lista, correcao nenhuma passa: conferencia sem trava e pior que nao ter.
  const semLista = validarCidade({ acao: 'corrigir', cidade: 'Canoas', motivo: 'x', confianca: 0.9 }, {});
  check(semLista.acao === 'incerto', 'sem lista de municipios, corrigir nao passa');
}

grupo('cidade: confianca baixa nao grava');
{
  const r = conferir({ acao: 'aceitar', motivo: 'acho que sim', confianca: 0.5 });
  check(r.acao === 'incerto', 'aceitar abaixo do limiar vira incerto');
  check(conferir({ acao: 'corrigir', cidade: 'Canoas', motivo: 'x', confianca: 0.69 }).acao === 'incerto',
    'corrigir abaixo do limiar tambem');
  check(conferir({ acao: 'aceitar', motivo: 'x', confianca: CONFIANCA_MINIMA }).acao === 'aceitar',
    'exatamente no limiar passa');
}

grupo('cidade: "nao tem cidade aqui" e resposta, nao duvida');
{
  // Nao precisa de confianca alta porque nao grava nada. Exigi-la faria a saida mais segura
  // ser a mais dificil de dar -- e a saida segura tem que ser a facil.
  const r = conferir({ acao: 'semcidade', motivo: 'ela so mandou bom dia', confianca: 0.4 });
  check(r.acao === 'semcidade', 'semcidade passa mesmo com confianca baixa');
  check(r.cidade === '', 'e nao traz cidade nenhuma junto');
}

grupo('cidade: lixo vira incerto, como todo o resto');
{
  check(conferir('isto nao e json').acao === 'incerto', 'texto solto vira incerto');
  check(conferir(null).acao === 'incerto', 'nulo vira incerto');
  check(conferir({ acao: 'apagar', motivo: 'x', confianca: 1 }).acao === 'incerto', 'acao desconhecida vira incerto');
  check(conferir({ acao: 'aceitar', motivo: 'x' }).acao === 'incerto', 'sem confianca vira incerto');
  check(conferir('{"acao":"aceitar","motivo":"x","confianca":0.9}').acao === 'aceitar', 'JSON em texto e lido');
}

grupo('cidade: a conversa vai dos DOIS lados');
{
  // "Maria / Cachoeirinha" sozinha e ambigua: nome de gente e nome de municipio, sem nada
  // dizendo qual e qual. Com a nossa pergunta na frente, a frase se explica.
  const bloco = montarContatoCidade({
    mensagens: [
      { de: 'nos', texto: 'Para eu salvar seu contato me passe seu Nome / Cidade' },
      { de: 'contato', texto: 'Maria / Cachoeirinha' },
    ],
    candidato: 'Cachoeirinha',
    origem: 'mensagem do contato',
  });
  check(/Atendimento: Para eu salvar/.test(bloco), 'a nossa pergunta entra marcada como Atendimento');
  check(/Contato: Maria \/ Cachoeirinha/.test(bloco), 'e a resposta dela como Contato');

  // String solta continua sendo do contato: e o formato antigo, e quebrar chamador silencioso
  // e o tipo de coisa que so aparece em producao.
  check(/Contato: oi/.test(montarContatoCidade({ mensagens: ['oi'] })), 'string solta e do contato');

  const vazio = montarContatoCidade({ candidato: 'Canoas' });
  check(/nao escreveu nada/.test(vazio.normalize('NFD').replace(/[̀-ͯ]/g, '')),
    'conversa vazia é dita, nao omitida');

  // Substituir e mais grave que preencher: o que esta no CRM alguem ja pos la.
  const troca = montarContatoCidade({ candidato: 'Canoas', substituiria: 'Gravatai' });
  check(/SUBSTITUIR/.test(troca), 'substituicao e avisada no bloco');
}

grupo('cidade: a requisicao e barata e cacheavel');
{
  const req = montarRequisicaoCidade({ sistema: montarSistemaCidade({}), contato: 'x' });
  check(req.max_tokens <= 512, 'teto de saida baixo: a resposta sao tres palavras e uma frase');
  check(req.system[0].cache_control?.type === 'ephemeral', 'o sistema vai marcado para cache');
  check(req.output_config.format.schema.properties.acao.enum.length === 3, 'tres acoes, nao mais');
}

grupo('montarContatoRascunho: os DOIS lados, e a pendencia marcada (03/09/2026)');
{
  /**
   * Print da Maria Geny: ela mandou um audio as 21:39, nos ja tinhamos respondido as 19:47, e o
   * rascunho respondeu a mensagem ANTERIOR a nossa resposta. Ele: *"ignorou a ultima mensagem da
   * pessoa e a minha resposta, e respondeu a penultima mensagem dela"*.
   *
   * **A IA nao tinha como acertar:** o bloco mandava so as mensagens DELA, numeradas, sem o que nos
   * haviamos dito e sem dizer qual estava esperando resposta. Para o modelo era uma pilha de falas
   * soltas -- responder qualquer uma era igualmente plausivel.
   */
  const conversa = [
    { de: 'contato', texto: 'eu e minha familia apoiamos voces' },
    { de: 'nos', texto: 'obrigado por contar com a gente' },
    { de: 'contato', texto: 'espero que ele nao pegue o que nao e dele' },
  ];
  const t = montarContatoRascunho({ mensagens: conversa });

  check(t.includes('NÓS: obrigado por contar com a gente'), 'a NOSSA fala entra na conversa');
  check(/ELA: espero que ele nao pegue[^\n]*SEM RESPOSTA/.test(t), 'a que veio depois da nossa fala vem marcada');
  check(!/apoiamos voces[^\n]*SEM RESPOSTA/.test(t), 'e a que veio ANTES nao vem marcada como pendente');

  /**
   * **O que JA foi respondido leva marca PROPRIA** -- relato dele (05/09/2026): *"a IA pegou o
   * contexto de umas 3 mensagens e ignorou a minha resposta e respondeu todas"*.
   *
   * Ate aqui a distincao era a AUSENCIA de "SEM RESPOSTA", e ausencia nao e sinal: o modelo via uma
   * pilha de falas dela com uma nossa no meio e tratava tudo como pendente.
   */
  check(/apoiamos voces[^\n]*já respondida/.test(t), 'a que veio ANTES vem marcada como ja respondida');
  check(t.includes('JÁ RESPONDEMOS'), 'e o prompt diz, com todas as letras, que aquilo nao se responde de novo');

  /**
   * **A VOZ: a mesma pessoa que ja falou** -- *"ela tem que ser uma sequencia das minhas mensagens;
   * no momento esta agindo como uma terceira pessoa na conversa"*.
   */
  check(t.includes('MESMA pessoa'), 'havendo fala nossa, o prompt manda escrever como quem ja falou');
  const primeiraVez = montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'oi, quero material' }] });
  check(!primeiraVez.includes('MESMA pessoa'), 'sem fala nossa, nao ha de onde emendar');
  check(primeiraVez.includes('primeira coisa que o atendimento diz'), 'e o prompt diz que e o primeiro contato');

  const nosPorUltimo = montarContatoRascunho({
    mensagens: [...conversa, { de: 'nos', texto: 'ja te respondo' }],
  });
  /**
   * **Nos por ultimo: nao ha pendencia.** O que separa "ja respondido" de "esperando" e a NOSSA
   * ultima fala -- se ela e a mais recente, nada dela ficou sem resposta.
   */
  const marcadas = (texto) => texto.split('\n').filter((l) => l.startsWith('ELA:') && l.includes('SEM RESPOSTA'));
  check(marcadas(nosPorUltimo).length === 0, 'nos por ultimo: nenhuma fala dela fica marcada');
  check(nosPorUltimo.includes('não deixou nada sem resposta'), 'e o prompt diz isso, em vez de mandar responder o nada');

  /**
   * **A RAJADA inteira vem marcada, nao so a ultima** -- print da Janete (04/09/2026): *"IA ignorou
   * rajada de mensagens"*. Ela mandou um audio longo e, horas depois, clicou num anuncio; o
   * rascunho respondeu so o clique.
   *
   * Foi consequencia direta do conserto anterior: marcar UMA mensagem resolveu quem respondia a
   * mensagem velha e criou o oposto. O que separa pendente de respondido e a nossa ultima fala.
   */
  const rajada = montarContatoRascunho({
    mensagens: [
      { de: 'nos', texto: 'ola' },
      { de: 'contato', texto: 'desabafo longo sobre a politica da cidade' },
      { de: 'contato', texto: 'Ola! Eu escolho a seguranca' },
    ],
  });
  check(/desabafo longo[^\n]*SEM RESPOSTA/.test(rajada), 'o desabafo vem marcado');
  check(/seguranca[^\n]*SEM RESPOSTA/.test(rajada), 'e o clique no anuncio tambem');

  /**
   * **O EIXO e a ULTIMA, e as outras entram reconhecidas** -- ajuste de 05/09/2026: *"eu queria que
   * ela ficasse ciente do contexto e respondesse a ultima mensagem do contato"*.
   *
   * Isto NAO desfaz o conserto da Janete: o que estava errado la era IGNORAR o desabafo, e ele
   * continua marcado e continua tendo que ser levado em conta. O que mudou e a forma -- a resposta
   * tem um eixo, em vez de virar um relatorio que responde item por item.
   */
  check(rajada.includes('EIXO'), 'o prompt diz qual e o eixo da resposta');
  check(rajada.includes('leva em conta'), 'e manda levar as outras em conta -- o desabafo nao pode ser ignorado');
  check(rajada.includes('nunca responda uma a uma'), 'sem responder uma a uma, que era o que soava a terceira pessoa');

  /**
   * **A forma antiga continua valendo** -- string solta e do contato. Quebrar isto deixaria o
   * rascunho sem conversa nenhuma, calado.
   */
  const soStrings = montarContatoRascunho({ mensagens: ["oi", "tudo bem?"] });
  check(soStrings.includes('ELA: oi'), 'string solta conta como do contato');
  check(/ELA: tudo bem\?[^\n]*SEM RESPOSTA/.test(soStrings), 'e todas elas vem marcadas, sem fala nossa no meio');

  check(montarContatoRascunho({}).includes("(nada)"), "sem mensagem nao explode");
}

grupo('o rascunho nao pode se apresentar de novo (05/09/2026)');
{
  /**
   * *"Ela tem que ser uma sequencia das minhas mensagens; no momento esta agindo como uma terceira
   * pessoa na conversa."*
   *
   * O prompt e quem pede a voz certa. Isto e a rede que mostra quando ele nao foi obedecido -- e e
   * so AVISO: consertar exigiria reescrever a frase, e a disciplina desta funcao e corrigir apenas
   * o mecanico (a saudacao errada, o traco eme).
   */
  const meioDia = new Date('2026-09-05T12:00:00');
  const abertura = 'Boa tarde! Bem-vindo. Voce esta falando com o gabinete do Capitao Martim. Em que podemos ajudar?';

  const comHistorico = revisarRascunho(abertura, meioDia, { jaFalamos: true });
  check(comHistorico.avisos.some((a) => /se apresenta/.test(a)), 'ja tendo conversado, a apresentacao repetida vira aviso');
  check(comHistorico.texto.includes('gabinete'), 'mas o texto NAO e mexido -- quem decide e ele');

  const primeiraVez = revisarRascunho(abertura, meioDia, { jaFalamos: false });
  check(!primeiraVez.avisos.some((a) => /se apresenta/.test(a)), 'no primeiro contato a apresentacao e o certo, e nao avisa');

  const semContexto = revisarRascunho(abertura, meioDia);
  check(!semContexto.avisos.some((a) => /se apresenta/.test(a)), 'sem contexto nenhum, nao inventa aviso');

  const emenda = revisarRascunho('Boa tarde! Entendo a sua preocupacao com a seguranca.', meioDia, { jaFalamos: true });
  check(!emenda.avisos.some((a) => /se apresenta/.test(a)), 'texto que emenda na conversa passa sem aviso');
}

{
  grupo('o relogio faltava no RASCUNHO (04/09/2026)');

  /**
   * Print dele: o rascunho abriu com *"Boa noite!"* as **16:21**. Ele: *"ja tinha falado para
   * checar hora e data atual antes de formular mensagem"*.
   *
   * O horario entrou em `montarContato` (a decisao) em 04/09 e este bloco -- o que ESCREVE texto
   * para eleitor -- ficou de fora: carimbava cada mensagem com o "quando", e nunca dizia que horas
   * sao AGORA. Com a ultima fala dela marcada `ontem 20:21`, "boa noite" era a deducao natural.
   */
  const tarde = new Date('2026-09-04T16:21:00');
  const bloco = montarContatoRascunho({
    mensagens: [{ de: 'contato', texto: 'DC - Democracia Crista - e isto mesmo?', at: '2026-09-03T20:21:00' }],
    agora: tarde,
  });
  check(bloco.includes('Agora sao 16:21'.replace('sao', 'são')), 'o bloco do rascunho abre dizendo que horas sao');
  check(bloco.includes('"Boa tarde"'), 'e diz qual saudacao esta certa, por extenso');
  check(bloco.includes('ontem 20:21'), 'a mensagem dela continua carimbada com o quando');

  check(saudacaoDeAgora(new Date('2026-09-04T08:00:00')) === 'Bom dia', 'de manha, bom dia');
  check(saudacaoDeAgora(tarde) === 'Boa tarde', 'as 16h, boa tarde');
  check(saudacaoDeAgora(new Date('2026-09-04T19:30:00')) === 'Boa noite', 'as 19h30, boa noite');

  /**
   * **E a saudacao errada e CONSERTADA, nao avisada** -- e a unica coisa que a revisao troca no
   * texto, porque e verificavel e mecanica: quem decide e o relogio.
   */
  const r = revisarRascunho('Boa noite! Sobre a propaganda que voce viu: sim, usar a imagem...', tarde);
  check(r.texto.startsWith('Boa tarde!'), 'a saudacao errada e trocada pela certa');
  check(r.avisos.some((a) => a.includes('troquei')), 'e o aviso diz que foi trocada');

  const certa = revisarRascunho('Boa tarde! Tudo bem?', tarde);
  check(certa.texto === 'Boa tarde! Tudo bem?', 'a saudacao certa nao e mexida');
  check(!certa.avisos.length, 'e nao gera aviso');

  const semSaudacao = revisarRascunho('Sobre a propaganda que voce viu: sim.', tarde);
  check(semSaudacao.texto === 'Sobre a propaganda que voce viu: sim.', 'rascunho sem saudacao continua sem');
}

{
  grupo('o rascunho pede o cadastro que falta (05/09/2026)');

  /**
   * Print dele: o rascunho respondeu bem o policial militar da reserva e **nao pediu nada** --
   * *"faltou detalhes, nao pediu dados"*. O prompt dizia o que NAO pedir (o bloco do cadastro,
   * criado no caso da Catarina) e nada dizia o que pedir.
   *
   * **O texto vai literal**: a linha `Nome , Cidade` e o INVARIANTE que `templates.ehPedidoDeDados`
   * reconhece. Deixando a IA pedir com as palavras dela, a rodada nao enxerga que o pedido saiu e
   * pede de novo na passada seguinte.
   */
  const agora = new Date('2026-09-05T11:27:00');
  const conversa = [{ de: 'contato', texto: 'Sou policial militar da reserva' }];

  const pedindo = montarContatoRascunho({ mensagens: conversa, campos: { Nome: 'Vacenton Salinas' }, agora, pedirDados: true });
  check(pedindo.includes(PEDIDO_DE_DADOS_NO_RASCUNHO), 'o prompt manda copiar o formulario, literal');
  check(/copie-o inteiro mesmo/.test(pedindo.replace(/\s+/g, ' ')),
    'e diz para copiar mesmo com o nome conhecido -- senao os dois blocos se contradizem');

  const semPedir = montarContatoRascunho({ mensagens: conversa, campos: { Nome: 'X', Cidade: 'Canoas' }, agora });
  check(!semPedir.includes(PEDIDO_DE_DADOS_NO_RASCUNHO), 'com o cadastro completo, nao manda pedir nada');
  check(/NAO peca nada que ja esteja nesta linha/.test(semPedir.normalize('NFD').replace(/[̀-ͯ]/g, '')),
    'e o bloco que impede pedir o que ja se tem continua la (o caso da Catarina)');
}

{
  grupo('as instrucoes dele que sao mecanicas viram conserto (05/09/2026)');

  /**
   * Print dele: nas Instrucoes extras da IA estava escrito *"nao use traco eme nas conversas"*, e o
   * rascunho veio com *"Salto do Yucuma -- tudo isso merece visibilidade"* (com travessao). Ele:
   * *"a IA nao segue todas as instrucoes?"*.
   *
   * A resposta e a licao mais repetida do projeto: **prompt e pedido, codigo e regra.** O que e
   * mecanico e verificavel vira conserto aqui; o que depende de julgamento (*"de corda para quem
   * busca remuneracao"*) continua so no prompt, porque conferí-lo exigiria julgar a frase.
   */
  const agora = new Date('2026-09-05T15:00:00');

  const comTravessao = revisarRascunho('Boa tarde! As Missoes, Salto do Yucuma — tudo isso merece visibilidade.', agora);
  check(!/[—–]/.test(comTravessao.texto), 'o traco eme sai do texto');
  check(comTravessao.texto.includes('Yucuma - tudo'), 'e vira hifen, sem mudar o resto da frase');
  check(comTravessao.avisos.some((a) => /traço eme/.test(a)), 'e o aviso diz que foi trocado');

  const repetindo = revisarRascunho('Entendi sua sugestao sobre o turismo.', agora);
  check(repetindo.avisos.some((a) => /começar assim/.test(a)), 'abrir com "entendi" levanta a mao');
  check(repetindo.texto === 'Entendi sua sugestao sobre o turismo.',
    'mas NAO reescreve -- reescrever seria escrever no lugar da IA');

  const limpo = revisarRascunho('Boa tarde! Obrigado pela mensagem.', agora);
  check(limpo.avisos.length === 0, 'texto sem nada disso passa sem aviso');
}

{
  grupo('o rascunho so sai sozinho sem os dois avisos graves (06/09/2026)');

  /**
   * Decisao dele: *"o box de IA esta ligado, entao aqui deveria chamar a IA para escrever e
   * enviar"*. Com "Automatizar a rodada" marcada, o rascunho passa a SAIR sozinho -- e isso
   * atravessa a fronteira que o projeto manteve desde o comeco (o que saia era, byte a byte, um
   * texto que ele escreveu).
   *
   * As duas travas que ficam sao as que uma pessoa PRECISA ler: marcador esquecido iria literal
   * para a tela do WhatsApp, e promessa de entregar e o risco da Lei 9.504/97. As outras revisoes
   * sao cosmeticas ou ja corrigidas -- barrar por elas pararia a rodada por um traco eme.
   */
  const agora = new Date('2026-09-06T10:00:00');

  const promessa = revisarRascunho('Bom dia! Vou mandar o material para voce hoje mesmo.', agora);
  check(!rascunhoPodeSairSozinho(promessa.avisos), 'promessa de entregar NAO sai sozinha');

  const marcador = revisarRascunho('Bom dia {{primeiro_nome}}! Obrigado pela mensagem.', agora);
  check(!rascunhoPodeSairSozinho(marcador.avisos), 'marcador esquecido NAO sai sozinho');

  const cosmetico = revisarRascunho('Boa noite! Obrigado pela mensagem — seguimos juntos.', agora);
  check(cosmetico.avisos.length >= 1, 'a saudacao errada e o traco eme geram aviso');
  check(rascunhoPodeSairSozinho(cosmetico.avisos), 'mas aviso cosmetico NAO impede o envio');

  check(rascunhoPodeSairSozinho([]), 'sem aviso nenhum, sai');

  /**
   * **As frases sao CONSTANTES, e nao texto reescrito nos dois lugares.** Se alguem mudar a
   * redacao do aviso e a trava comparar por string antiga, ela deixa de casar em silencio -- e o
   * silencio aqui e uma mensagem inventada saindo sozinha para eleitor.
   */
  check(promessa.avisos.includes(AVISOS_QUE_IMPEDEM_ENVIO.promessa), 'o aviso vem da constante');
  check(marcador.avisos.includes(AVISOS_QUE_IMPEDEM_ENVIO.marcador), 'o do marcador tambem');
}

fim();
