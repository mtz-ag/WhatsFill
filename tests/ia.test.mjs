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
import { PROVEDORES } from '../src/lib/ia-cliente.js';
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
  provedorDoModelo,
  esquemaEstrito,
  CHAVE_DO_PROVEDOR,
  PROVEDOR_OPENAI,
  PROVEDOR_ANTHROPIC,
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

grupo('a trava por CASO foi retirada (06/09/2026)');
{
  /**
   * A lista de casos sensiveis viveu uma hora. Ela nasceu do meu diagnostico de que a mensagem da
   * print da Dima Souza tinha vindo da IA -- e ele corrigiu: *"foi o deterministico novamente
   * mandando mensagem, no outro caso foi tambem; volte a mensagem automatica da IA"*.
   *
   * Era `pedeAjudaFinanceira`, largo demais. Barrar a IA por causa dele foi tratar o sintoma no
   * lugar errado, e o preco era a rodada automatica parar justamente nos casos que ela resolve.
   *
   * **As travas que ficam sao todas sobre o TEXTO que voltou** -- o que a IA escreveu, nao o caso
   * em que ela escreveu.
   */
  check(rascunhoPodeSairSozinho([], {}), 'caso comum com texto limpo sai sozinho');
  check(rascunhoPodeSairSozinho([], { pedeAjudaFinanceira: { motivo: 'x' } }),
    'e o CASO nao barra mais nada -- foi retirado a pedido dele');
  check(rascunhoPodeSairSozinho([], { pedeRespostaPessoal: { motivo: 'x' }, semInteresse: { motivo: 'x' } }),
    'nem os outros sinais');

  check(!rascunhoPodeSairSozinho(['sobrou marcador no texto — troque antes de mandar']),
    'marcador esquecido continua barrando');
}

grupo('a IA nao pode afirmar acao nem prometer entrega (06/09/2026)');
{
  /**
   * Print da SANDRA GRANDINI. Ela escreveu so *"E a respeito do material?"*, e o rascunho respondeu:
   *
   * > *"Ja encaminhei seu pedido ao assessor da sua regiao para providenciar o material. Voce deve
   * > receber em breve."*
   *
   * Ele apagou a mensagem: *"a IA alucinou ou ignorou contexto; ela nunca nos forneceu endereco,
   * entao nao tem como fazer entrega"*.
   *
   * **Nao e um texto fora de tom: e uma afirmacao FALSA sobre o mundo**, dita a um eleitor em nome
   * do mandato -- nao ha assessor designado, ninguem encaminhou nada, e ela nunca deu endereco. E
   * cria a expectativa que a Lei 9.504/97 trata.
   *
   * Medido antes de mexer: `revisarRascunho` devolvia **zero avisos**, e o texto saia sozinho.
   */
  const agora = new Date('2026-09-06T14:31:00');
  const av = (t) => revisarRascunho(t, agora, {}).avisos;
  const barra = (t) => !rascunhoPodeSairSozinho(av(t), {});

  const daPrint = 'Ja encaminhei seu pedido ao assessor da sua regiao para providenciar o material. Voce deve receber em breve.';
  check(barra(daPrint), 'o texto da print NAO sai mais sozinho');
  check(av(daPrint).some((a) => /providenciou/.test(a)), 'e o aviso diz que ninguem fez aquilo');
  check(av(daPrint).some((a) => /prometer entregar/.test(a)), 'a promessa tambem e apontada');

  for (const t of ['Voce vai receber o material nos proximos dias.', 'Ja repassei ao assessor.',
    'Seu pedido foi encaminhado ao responsavel.', 'Ja anotei aqui e ja solicitei.',
    'Esta a caminho!', 'Estamos providenciando.', 'Vou mandar o material para voce.']) {
    check(barra(t), `barrado: ${t}`);
  }

  /**
   * **O que a IA PODE dizer** -- e onde mora o risco desta trava: barrar demais faz a rodada parar
   * em texto correto, e o custo disso e ele apertar enviar a mais.
   */
  for (const t of ['Sua mensagem chegou aqui e vou verificar isso.',
    'Me diga o endereco completo para eu ver o que e possivel.',
    'Obrigado por escrever, li tudo com atencao.',
    'Ja falei sobre isso com voce ontem.',
    'O Capitao Martim defende a expansao das escolas civico-militares.']) {
    check(!barra(t), `continua saindo: ${t}`);
  }

  // A regra 5 do prompt e a outra metade do conserto.
  const sistema = montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });
  check(/NUNCA afirme que alguem ja fez/.test(sistema.normalize('NFD').replace(/[̀-ͯ]/g, '')),
    'e o prompt proibe afirmar acao, com todas as letras');
}

{
  grupo('a IA nao afirma que TEMOS material (07/09/2026)');

  /**
   * Print do Lucas Mendes: ele perguntou *"Como faco para conseguir um bone ou acessorio do CAP
   * MARTIM"* e o rascunho abriu com *"Temos adesivos e camisetas da campanha disponiveis. Para te
   * enviar, preciso saber sua cidade."* Ele apagou: *"a IA confirmou algo sem saber"*.
   *
   * E a irma do caso da Sandra (06/09) com o verbo no PRESENTE: la a invencao era sobre o passado
   * ("ja encaminhei"), aqui e sobre o estoque. Nada no prompt fala de material fisico.
   */
  const agora = new Date('2026-09-07T11:00:00');
  const aviso = AVISOS_QUE_IMPEDEM_ENVIO.afirmouTer;
  const avisa = (t) => revisarRascunho(t, agora).avisos.includes(aviso);

  const doLucas = 'Bom dia! Temos adesivos e camisetas da campanha disponiveis. Para te enviar, preciso saber sua cidade.';
  check(avisa(doLucas), 'a frase da print e barrada');
  check(!rascunhoPodeSairSozinho(revisarRascunho(doLucas, agora).avisos),
    'e ela NAO sai sozinha no automatico');
  check(avisa('O bone esta disponivel no comite'), 'item + "disponivel" tambem conta');

  /**
   * **Os falsos positivos sao a metade cara, e o primeiro e o mais importante:** a NEGATIVA e
   * exatamente o texto certo para quem pergunta por material fisico. Barra-la seria impedir a
   * resposta honesta.
   */
  check(!avisa('Nao temos adesivos para enviar no momento'), 'a NEGATIVA passa — e o texto certo');
  check(!avisa('Voce gostaria de receber adesivos?'), 'perguntar sobre o item nao e afirmar que temos');
  check(!avisa('Temos um grupo no WhatsApp, quer entrar?'), '"temos" com objeto que nao e material fisico passa');
  check(!avisa('Quero te mandar o material do Capitao'),
    '"material" ficou de fora: nesta base e conteudo DIGITAL, o pedido mais comum que chega');

  check(
    montarSistemaRascunho({ templates: [], regras: '', gabinete: '' }).includes('NUNCA diga que TEMOS'),
    'e o prompt proibe afirmar que temos, com todas as letras'
  );

  /**
   * **A regra dele para material, ditada no mesmo dia:** *"quando for relacionado a material nunca
   * confirmar nada; nesse caso era especifico como adesivos, se nao for especifico perguntar que
   * tipo de material a pessoa precisa"*. Sao duas metades, e a segunda e o que dizer no lugar —
   * fechar um caminho sem escrever a saida troca o defeito por uma resposta muda.
   */
  const prompt = montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });
  check(prompt.includes('MATERIAL é o assunto em que você NUNCA confirma nada'),
    'o prompt diz que material nao se confirma');
  check(prompt.includes('PERGUNTE que tipo de material ela precisa'),
    'e manda PERGUNTAR o tipo quando ela nao disse qual');
  check(prompt.includes('não pergunte de'),
    'e manda NAO perguntar de novo quando ela ja nomeou o item (o caso do Lucas)');
}

/**
 * **A print da Irene (07/09/2026): "falhou em pegar o texto da transcricao".**
 *
 * Ela encaminhou cinco audios de uma vez as 08:28 e a rodada respondeu, sozinha, *"Boa tarde!
 * Desculpa, deve ter dado ruim no audio. Pode enviar de novo?"*. Ele apagou a mensagem.
 *
 * **A leitura estava invertida, e foi medido na API antes de mexer:** os cinco chegaram COM
 * transcricao (1.909 caracteres somados, `processing: false`, `error` vazio) e a transcricao
 * chegou inteira a IA. O que ela fez foi responder o conteudo de DENTRO de um audio encaminhado —
 * o ultimo do lote e uma pessoa dizendo a outra *"nao deu pra ouvir nada que voce botou ali, ta
 * mudo?"*.
 *
 * A trava e mecanica porque a afirmacao e sobre o NOSSO lado: o painel sabe se chegou texto
 * legivel dela. Metade das assercoes daqui e falso positivo — e onde mora o risco, porque barrar
 * demais tiraria da automacao o caso em que pedir para reenviar e a resposta certa.
 */
{
  grupo('rascunho que diz que o audio falhou (a Irene, 07/09)');

  const agora = new Date('2026-09-07T18:18:00Z');
  const saiu = 'Boa tarde! Desculpa, deve ter dado ruim no áudio. Pode enviar de novo?';

  const comTexto = revisarRascunho(saiu, agora, { recebemosDela: true });
  check(comTexto.avisos.includes(AVISOS_QUE_IMPEDEM_ENVIO.pediuReenvio),
    'a mensagem que saiu para ela agora levanta a mao');
  check(rascunhoPodeSairSozinho(comTexto.avisos) === false,
    'e nao sai mais sozinha: o caso volta para ele');

  /**
   * **A metade que sustenta a trava: audio SEM transcricao existe.** Quando nada legivel chegou,
   * pedir para reenviar e o texto CERTO, e barra-lo seria impedir a resposta certa — a mesma
   * disciplina da negativa em `afirmouTer`.
   */
  const semTexto = revisarRascunho(saiu, agora, { recebemosDela: false });
  check(semTexto.avisos.includes(AVISOS_QUE_IMPEDEM_ENVIO.pediuReenvio) === false,
    'sem nada legivel dela, pedir para reenviar continua passando');

  const casa = [
    'não consegui ouvir o áudio, pode mandar de novo?',
    'O áudio não chegou aqui.',
    'Seu áudio veio mudo.',
    'Deu problema no vídeo, consegue enviar novamente?',
    'Não recebi sua mensagem.',
    'Manda de novo, por favor.',
  ];
  for (const t of casa) {
    check(revisarRascunho(t, agora, { recebemosDela: true }).avisos.includes(AVISOS_QUE_IMPEDEM_ENVIO.pediuReenvio),
      `pega tambem: "${t}"`);
  }

  /** Os falsos positivos: frases normais de atendimento que NAO podem barrar o envio. */
  const naoCasa = [
    'Sua mensagem chegou aqui. Vou verificar isso com a equipe.',
    'Obrigado pelo áudio, vou ouvir com calma.',
    'Recebi seu áudio, muito obrigado pelo carinho.',
    'Pode contar comigo de novo quando precisar.',
    'Se precisar de mais alguma coisa, é só chamar novamente.',
    'Vamos conversar de novo em breve.',
    'Me diga sua cidade para eu registrar.',
    'O material que você mandou é ótimo, obrigado por compartilhar.',
  ];
  for (const t of naoCasa) {
    check(revisarRascunho(t, agora, { recebemosDela: true }).avisos.includes(AVISOS_QUE_IMPEDEM_ENVIO.pediuReenvio) === false,
      `nao pega: "${t}"`);
  }

  /**
   * A outra metade do conserto: a regra 6 do prompt. A trava barra o ENVIO; a regra e o que
   * impede o rascunho de nascer respondendo o que esta dentro de um audio de outra conversa.
   */
  const p = montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });
  check(p.includes('Áudio é GRAVAÇÃO'), 'o prompt explica que audio circula, e pode ser de outra conversa');
  check(p.includes('NUNCA diga que o áudio falhou'), 'e proibe dizer que o audio falhou');
}

/**
 * **O tamanho estava no documento dele e o modelo nao o cumpria** — print do contato que ofereceu
 * patrocinio (07/09/2026), comparada com o que o ChatGPT escreveu para a mesma conversa.
 *
 * O item 22 do padrao diz *"mensagem simples: 1 a 3 frases"*, e fica a 3.804 tokens do ponto em
 * que o modelo comeca a escrever. A regra e citada de novo ao lado do pedido — o mesmo motivo
 * pelo qual a saudacao e o relogio ficam no fim do bloco do contato.
 */
{
  grupo('o tamanho do rascunho e citado onde o modelo le');

  const p = montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });
  check(p.includes('TAMANHO: siga o item 22 do padrão'), 'a regra de tamanho aparece perto do pedido');
  check(p.includes('1 a 3 frases'), 'com o numero, e nao so a referencia');
  check(p.includes('Não dê aula sobre regra nem sobre lei'), 'e proibe a aula sobre a lei, que foi o que saiu');

  /**
   * **O item 22 continua sendo dele, e nao foi reescrito.** Se o documento sumir daqui, esta
   * repeticao vira uma referencia para um item que nao existe.
   */
  check(PADRAO_DE_ATENDIMENTO.includes('## 22. Tamanho e linguagem'),
    'e o item 22 do documento dele continua no prompt (a repeticao aponta para ele)');

  /** O prompt cresceu; o cache do Haiku so pega acima de 4.096. */
  check(vaiCachear(tokensAproximados(p), 'claude-haiku-4-5'),
    'o prompt continua acima do minimo de cache do Haiku');
}

/**
 * **PROPOSTA COMERCIAL: a regra dele, 07/09/2026.**
 *
 * Um contato ofereceu patrocinio (*"tenho espaco p/ mais Apoiadores com patrocinio"*) e o rascunho
 * respondeu explicando a lei eleitoral e mandando *"conversar direto com a coordenacao"*. Ele
 * apagou e ditou a regra: *"o GPT seguiu o caminho certo porque nada sera aceito agora em periodo
 * eleitoral, os contratos que deviam ser feitos ja foram feitos"*.
 *
 * **Nao e "explique melhor": e nao abrir porta.** Nao ha coordenacao para conversar sobre isso, e
 * mandar procurar alguem promete uma conversa que nao vai acontecer — a familia da promessa de
 * entrega da regra 5.
 *
 * O defeito e maior que este caso, e e isso que o torna mecanico: **quem escreve para o WhatsApp
 * do mandato JA ESTA falando com a equipe.** Dez das quatorze assercoes sao falso positivo —
 * encaminhar para FORA (prefeitura, Secretaria, CRAS) continua livre, e a primeira pessoa
 * (*"vou verificar com a equipe"*) e a frase que a propria regra 5 da como exemplo do que se pode
 * dizer com verdade.
 */
{
  grupo('proposta comercial: nao mandar procurar a coordenacao (07/09)');

  const agora = new Date('2026-09-07T19:07:00Z');
  const saiu =
    'Boa tarde! Fico muito feliz em saber que você está apoiando essa caminhada conosco. ' +
    'Se você tem interesse em contribuir, a melhor forma é conversar direto com a coordenação. ' +
    'Você pode entrar em contato com a equipe de campanha.';
  const r = revisarRascunho(saiu, agora, {});
  check(r.avisos.includes(AVISOS_QUE_IMPEDEM_ENVIO.mandouProcurarNos),
    'o texto que saiu para ele agora levanta a mao');
  check(rascunhoPodeSairSozinho(r.avisos) === false, 'e nao sai mais sozinho');

  const pega = (t) => revisarRascunho(t, agora, {}).avisos.includes(AVISOS_QUE_IMPEDEM_ENVIO.mandouProcurarNos);

  for (const t of [
    'A melhor forma é conversar direto com a coordenação.',
    'Você pode entrar em contato com a equipe de campanha.',
    'Procure a coordenação da campanha.',
    'Fale com a assessoria do deputado.',
  ]) {
    check(pega(t), `pega tambem: "${t}"`);
  }

  /** Encaminhar para FORA continua livre — a lista e so do que somos NOS. */
  for (const t of [
    'Vou verificar isso com a equipe e te retorno por aqui.',
    'Sua mensagem chegou aqui na equipe.',
    'Procure a Secretaria de Saúde do seu município.',
    'Se precisar, procure o CRAS mais perto de você.',
    'Você pode comparecer nos eventos que a campanha divulga.',
    'Fale comigo por aqui quando precisar.',
    'Conte sempre com a gente.',
    'Estou falando com a equipe sobre isso.',
    'A equipe agradece muito o seu apoio.',
    'Vou verificar com a equipe. Se precisar de remédio, procure a farmácia popular.',
  ]) {
    check(!pega(t), `nao pega: "${t}"`);
  }

  /** A outra metade: a regra 7 do prompt, que e o que impede o rascunho de nascer assim. */
  const p = montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });
  check(p.includes('PROPOSTA COMERCIAL'), 'o prompt trata proposta comercial');
  check(p.includes('NÃO mande procurar a coordenação'), 'e proibe mandar procurar a coordenacao');
  check(p.includes('agradeça o apoio'), 'e diz o que fazer no lugar: agradecer o apoio');
}

grupo('as duas casas: o provedor sai do NOME DO MODELO');
{
  check(provedorDoModelo('gpt-5') === PROVEDOR_OPENAI, 'gpt-5 e da OpenAI');
  check(provedorDoModelo('gpt-5-mini') === PROVEDOR_OPENAI, 'gpt-5-mini tambem');
  check(provedorDoModelo('o3') === PROVEDOR_OPENAI, 'a familia o-N e da OpenAI, e nao comeca com gpt');
  check(provedorDoModelo('claude-haiku-4-5') === PROVEDOR_ANTHROPIC, 'claude e da Anthropic');

  /**
   * **Modelo desconhecido cai em Anthropic**, que e onde a chave dele ja esta.
   *
   * Nao ha desfecho neutro: um deles tem que ser o padrao. Errar para o lado da casa que ja tem
   * chave da 404 "modelo nao existe" (que o painel traduz); errar para o outro daria 401 "chave
   * recusada", mandando conferir uma chave que esta certa.
   */
  check(provedorDoModelo('modelo-estranho') === PROVEDOR_ANTHROPIC, 'nome desconhecido: Anthropic');
  check(provedorDoModelo('') === PROVEDOR_ANTHROPIC, 'vazio: Anthropic');
  check(provedorDoModelo(undefined) === PROVEDOR_ANTHROPIC, 'ausente nao quebra');

  // A chave da Anthropic continua em `iaChave`: renomear apagaria a que ele ja tem salva.
  check(CHAVE_DO_PROVEDOR[PROVEDOR_ANTHROPIC] === 'iaChave', 'a chave da Anthropic nao mudou de lugar');
  check(CHAVE_DO_PROVEDOR[PROVEDOR_OPENAI] === 'iaChaveOpenai', 'a da OpenAI tem lugar proprio');
}

grupo('esquemaEstrito: o que o strict mode da OpenAI exige');
{
  const base = esquemaDaDecisao(['a', 'b']);
  const e = esquemaEstrito(base);

  /**
   * **Toda propriedade em `required`** — sem isto o strict mode recusa o esquema INTEIRO com 400,
   * e os tres esquemas daqui deixam campos opcionais de proposito.
   */
  check(
    e.required.length === Object.keys(e.properties).length,
    `required cobre todas as propriedades (${e.required.length} de ${Object.keys(e.properties).length})`
  );
  check(e.required.includes('templateId'), 'templateId, que era opcional, entrou');
  check(e.additionalProperties === false, 'additionalProperties: false');

  // Nao muta: o esquema original continua servindo a Anthropic na MESMA chamada.
  check(base.required.length === 3 && !base.required.includes('templateId'), 'o original fica intacto');

  // `enum: []` nao casa com valor nenhum: o modelo nao teria o que responder e a chamada seria
  // paga para nada. Sem ids permitidos, o enum sai.
  const vazio = esquemaEstrito(esquemaDaDecisao([]));
  check(vazio.properties.templateId.enum === undefined, 'enum vazio e removido');
  check(esquemaEstrito(esquemaDaDecisao(['x'])).properties.templateId.enum.length === 1, 'enum com item fica');

  // Objeto aninhado tambem.
  const aninhado = esquemaEstrito({
    type: 'object',
    properties: { dentro: { type: 'object', properties: { x: { type: 'string' } } } },
  });
  check(aninhado.properties.dentro.additionalProperties === false, 'o objeto de dentro tambem fecha');
  check(aninhado.properties.dentro.required[0] === 'x', 'e exige o campo de dentro');
}

grupo('o corpo da requisicao para a OpenAI');
{
  const r = montarRequisicaoRascunho({ sistema: 'S', contato: 'C', modelo: 'gpt-5' });

  /**
   * **`max_completion_tokens`, nunca `max_tokens`**: a familia GPT-5 recusa o nome antigo com 400.
   * A mesma classe de armadilha do `effort` no Haiku, e ela nao aparece em teste de tela nenhum.
   */
  check(r.max_completion_tokens === 4096, 'o teto de saida vai no nome novo');
  check(r.max_tokens === undefined, 'e o nome antigo NAO vai');

  check(r.messages[0].role === 'system' && r.messages[0].content === 'S', 'o sistema vai como messages[0]');
  check(r.messages[1].role === 'user' && r.messages[1].content === 'C', 'e o contato como user');
  check(r.system === undefined, 'nada do campo `system` da Anthropic');
  check(r.output_config === undefined, 'nem do `output_config`');

  check(r.response_format?.type === 'json_schema', 'o formato da resposta e json_schema');
  check(r.response_format.json_schema.strict === true, 'em strict mode');
  check(!!r.response_format.json_schema.name, 'com nome, que o strict mode exige');
  const props = r.response_format.json_schema.schema.properties;
  check(
    r.response_format.json_schema.schema.required.length === Object.keys(props).length,
    'e com o esquema estrito'
  );

  // Nada de `cache_control`: na OpenAI o cache e automatico, e mandar o campo daria 400.
  check(!JSON.stringify(r).includes('cache_control'), 'nenhum cache_control no corpo');

  check(r.reasoning_effort === 'medium', 'o esforco vai no nome da casa');

  /**
   * **O piso de 2.048 na conferencia de cidade** — o raciocinio e cobrado como SAIDA e cabe DENTRO
   * do teto: com os 512 originais, ele consome a cota e o JSON sai truncado. Chamada paga que
   * devolve nada, que e a armadilha do Opus 5 na casa da OpenAI.
   */
  const cidade = montarRequisicaoCidade({ sistema: 'S', contato: 'C', modelo: 'gpt-5' });
  check(cidade.max_completion_tokens === 2048, 'a conferencia de cidade ganha piso de saida');
  check(
    montarRequisicaoCidade({ sistema: 'S', contato: 'C', modelo: 'claude-haiku-4-5' }).max_tokens === 512,
    'e na Anthropic o teto baixo continua, que e economia real'
  );

  // Modelo fora da lista de permissao roda SEM o parametro, e nao quebrado.
  const aMao = montarRequisicaoRascunho({ sistema: 'S', contato: 'C', modelo: 'gpt-6-turbo' });
  check(aMao.reasoning_effort === undefined, 'modelo desconhecido da OpenAI nao recebe reasoning_effort');
  check(aMao.max_completion_tokens === 4096, 'e fica com o teto pedido, sem piso');
}

grupo('o corpo da Anthropic nao mudou');
{
  const r = montarRequisicaoRascunho({ sistema: 'S', contato: 'C', modelo: 'claude-haiku-4-5' });
  check(r.max_tokens === 4096, 'max_tokens continua');
  check(r.system?.[0]?.cache_control?.type === 'ephemeral', 'o cache_control continua no sistema');
  check(r.system[0].text === 'S', 'o sistema continua em campo proprio');
  check(r.output_config?.format?.type === 'json_schema', 'e o esquema no output_config');
  check(r.response_format === undefined, 'sem response_format');
  check(r.max_completion_tokens === undefined, 'sem max_completion_tokens');

  const opus = montarRequisicao({ sistema: 'S', contato: 'C', ids: ['x'], modelo: 'claude-opus-5' });
  check(opus.output_config.effort === 'low', 'o effort do Opus continua onde estava');
  check(
    montarRequisicao({ sistema: 'S', contato: 'C', ids: ['x'], modelo: 'claude-haiku-4-5' }).output_config.effort === undefined,
    'e o Haiku continua sem ele, que e o 400 conhecido'
  );
}

grupo('a conta dos dois provedores');
{
  // Escrever no cache e de graca na OpenAI, e 1,25x na Anthropic. Cobrar 1,25x nos dois inflaria
  // o teto de gasto — a unica trava de dinheiro do projeto — sem nenhum erro aparecer.
  const uso = { entrada: 1000, cacheEscrito: 5000, cacheLido: 0, saida: 300 };
  const openai = custoEmDolares(uso, 'gpt-5');
  const semEscrita = (1000 * 1.25 + 0 + 300 * 10) / 1e6;
  check(Math.abs(openai - semEscrita) < 1e-9, `escrita de cache nao custa na OpenAI (US$ ${openai.toFixed(5)})`);

  const anthropic = custoEmDolares(uso, 'claude-haiku-4-5');
  check(anthropic > custoEmDolares({ ...uso, cacheEscrito: 0 }, 'claude-haiku-4-5'), 'na Anthropic custa');

  // Leitura continua sendo 10% nas duas.
  const lido = custoEmDolares({ entrada: 0, cacheEscrito: 0, cacheLido: 10000, saida: 0 }, 'gpt-5');
  check(Math.abs(lido - (10000 * 1.25 * 0.1) / 1e6) < 1e-9, 'ler do cache custa 10% nas duas');

  // Modelo desconhecido cobra pelo mais CARO da tabela: preco que a extensao nao conhece nao pode
  // virar gasto invisivel, e superestimar so faz o teto chegar mais cedo.
  const caro = Math.max(...Object.values(PRECOS_USD_POR_MTOK).map((x) => x.saida));
  check(caro === 25, 'o mais caro da tabela continua sendo o Opus, e nao um preco da OpenAI');

  // O prompt de hoje cacheia nos tres da OpenAI: o minimo la e 1.024 para todos.
  check(vaiCachear('gpt-5', 5000), 'com 5.000 tokens o cache pega no gpt-5');
  check(!vaiCachear('gpt-5', 900), 'com 900 nao, e o painel tem que poder dizer isso');
  check(CACHE_MINIMO_TOKENS['gpt-5-nano'] === 1024, 'o minimo da OpenAI e 1.024, e nao cresce com o modelo');
}

grupo('a leitura do usage: prompt_tokens INCLUI o cacheado');
{
  /**
   * **A diferenca mais facil de errar entre as duas contas.**
   *
   * `input_tokens` da Anthropic EXCLUI o que veio do cache; `prompt_tokens` da OpenAI INCLUI.
   * Somar os dois campos na OpenAI cobraria o prompt inteiro duas vezes — com ~5.300 tokens de
   * sistema, cada chamada cacheada apareceria quase 10x mais caro do que e, e o teto de gasto
   * fecharia sozinho no meio de uma rodada.
   */
  const oa = PROVEDORES.openai.uso({
    prompt_tokens: 5500,
    prompt_tokens_details: { cached_tokens: 5000 },
    completion_tokens: 300,
  });
  check(oa.entrada === 500, `entrada = prompt_tokens - cacheado (${oa.entrada})`);
  check(oa.cacheLido === 5000, 'o cacheado vai para o campo do cache');
  check(oa.cacheEscrito === 0, 'e escrita de cache nao existe na OpenAI');
  check(oa.saida === 300, 'a saida ja inclui o raciocinio, que e como a OpenAI cobra');

  // Sem detalhes de cache (chamada fria), tudo e entrada.
  const fria = PROVEDORES.openai.uso({ prompt_tokens: 5500, completion_tokens: 300 });
  check(fria.entrada === 5500 && fria.cacheLido === 0, 'chamada fria: tudo entrada');

  // Do lado da Anthropic os campos sao somados, porque nao se sobrepoem.
  const an = PROVEDORES.anthropic.uso({
    input_tokens: 500,
    cache_read_input_tokens: 5000,
    cache_creation_input_tokens: 0,
    output_tokens: 300,
  });
  check(an.entrada === 500 && an.cacheLido === 5000, 'na Anthropic os dois campos convivem');

  // Truncada e chamada paga que devolve nada, e os dois provedores dizem isso de formas diferentes.
  check(PROVEDORES.openai.truncou({ choices: [{ finish_reason: 'length' }] }), 'OpenAI: finish_reason length');
  check(!PROVEDORES.openai.truncou({ choices: [{ finish_reason: 'stop' }] }), 'e stop nao e truncada');
  check(PROVEDORES.anthropic.truncou({ stop_reason: 'max_tokens' }), 'Anthropic: stop_reason max_tokens');

  // `refusal` e canal proprio do strict mode: ler so o `content` faria recusa parecer vazio.
  check(PROVEDORES.openai.texto({ choices: [{ message: { refusal: 'nao' } }] }) === null, 'recusa vira null');
  check(PROVEDORES.openai.texto({ choices: [{ message: { content: '{}' } }] }) === '{}', 'e o texto normal passa');
}

fim();
