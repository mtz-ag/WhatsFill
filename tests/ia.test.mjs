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
import { PROVEDORES, pedirAoWorker } from '../src/lib/ia-cliente.js';
import { paraHtml } from '../src/padrao.js';
import { chapaDoDossie, precisaDoDossie } from '../src/lib/gabinete.js';
import { DEFAULT_TEMPLATES } from '../src/lib/store.js';
import { pedeMaterial, pedeFalarComDeputado, pedeRoupa } from '../src/lib/cortesia.js';
import {
  montarSistemaRascunho,
  montarContatoRascunho,
  nomeCurtoDeAnuncio,
  semFalarDeTranscricao,
  LIMITE_NOME_DO_ANUNCIO,
  PEDIDO_DE_DADOS_NO_RASCUNHO,
  saudacaoDeAgora,
  montarRequisicaoRascunho,
  revisarRascunho,
  conferirChapa,
  ELA_SE_DESCULPOU,
  ELA_FALOU_DE_TRABALHO,
  semConviteAoCaso,
  marcaDeMidia,
  esquemaDoMaterial,
  esquemaDaEtiqueta,
  montarSistemaEtiqueta,
  montarRequisicaoEtiqueta,
  validarEtiqueta,
  TIPOS_DE_ETIQUETA,
  CONFIANCA_ETIQUETA,
  montarSistemaMaterial,
  montarContatoMaterial,
  montarRequisicaoMaterial,
  validarMaterial,
  CONFIANCA_MATERIAL,
  ANTERIOR_MAX_FALAS,
  ANTERIOR_MAX_CARACTERES,
  esquemaDoRascunho,
  perguntaComoEleEsta,
  semSaudacao,
  semRepetirONosso,
  soRepeteONosso,
  rascunhoPodeSairSozinho,
  AVISOS_QUE_IMPEDEM_ENVIO,
  AVISOS_QUE_SO_AVISAM,
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
  esquemaDaCidade,
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
  // "equipe" e nao "gabinete": a palavra saiu do vocabulario em 07/09 e hoje e trocada (10/09).
  const limpo = revisarRascunho('Recebi seu áudio e entendi o ponto. Vou levar à equipe.');
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
  // "equipe" e nao "gabinete": desde 10/09 "gabinete" e trocado, e aqui o que se testa e o AVISO.
  const abertura = 'Boa tarde! Bem-vindo. Voce esta falando com a equipe do Capitao Martim. Em que podemos ajudar?';

  const comHistorico = revisarRascunho(abertura, meioDia, { jaFalamos: true });
  check(comHistorico.avisos.some((a) => /se apresenta/.test(a)), 'ja tendo conversado, a apresentacao repetida vira aviso');
  check(comHistorico.texto.includes('Bem-vindo. Voce esta falando com a equipe'), 'mas o texto NAO e mexido -- quem decide e ele');

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

  // O treino saiu (18/09/2026): o rascunho e um so, e o bloco do cadastro e obrigatorio nele.
  check(pedindo.includes(PEDIDO_DE_DADOS_NO_RASCUNHO) && !/PELO MENOS UMA|das três/.test(pedindo),
    'o bloco do cadastro e obrigatorio, sem ressalva de tres opcoes');
  check(/Depois de responder o que ela escreveu, FECHE a/.test(pedindo), 'com o texto de antes');

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
  check(prompt.includes('você NUNCA confirma nada'), 'o prompt diz que material nao se confirma');

  /**
   * **O ESCOPO da regra, que faltava — print da Cleo (08/09/2026).** Ela pediu que comprassemos um
   * encosto ortopedico, e o rascunho entrou pelo caminho do material: pediu o endereco e prometeu o
   * repasse. Medido no prompt daquele dia: "material" aparecia cinco vezes e **"material de
   * campanha" nenhuma** — a condicao escrita era a FORMA do pedido, nunca a CATEGORIA do item.
   */
  /**
   * **A lista e de PERMISSAO, e a de bloqueio durou um dia.** Na 3.13 eu escrevi o escopo como uma
   * lista do que NAO e material; no dia seguinte veio o print do Oseias pedindo **uma bota de
   * gaucho**, e o rascunho ofereceu o endereco e o repasse outra vez. Regra dele: *"nossa lista e
   * pequena do que podemos dar, que e (folhetos, adesivos etc); todo o resto entra como pedido de
   * emprego, ajuda, doacao"*.
   */
  /**
   * **A REDACAO mudou na 3.23, e o que ela guarda ficou.** Na 3.16 a lista era FECHADA e tudo o que
   * nao estivesse nela virava pedido de ajuda — e no dia seguinte a Sirlei pediu uma **placa**, que
   * e propaganda da campanha, e recebeu uma recusa. **A lista fechada virou lista de estoque, e ela
   * nao e isso.** O criterio passou a ser a MARCA (leva o nome, o numero ou a marca da campanha?), e
   * o que este bloco continua guardando e a fronteira que a 3.13 e a 3.16 abriram: **bem de uso
   * pessoal, que teria de ser comprado, nao e material.**
   */
  check(/folheto/.test(prompt), 'a lista tem o folheto que ele nomeou');
  check(/bem de uso PESSOAL/.test(prompt), 'e o bem de uso pessoal fica FORA da regra do material');
  check(/AJUDA OU DOAÇÃO/.test(prompt), 'virando pedido de ajuda ou doacao');
  check(/seção 9 do padrão/.test(prompt), 'que e a secao 9 do padrao dele');

  /**
   * **As duas listas sao a MESMA.** A do prompt e a de `cortesia.OBJETO_DE_MATERIAL`, que decide o
   * sinal `pedeMaterial` — duas listas separadas divergiriam na primeira vez que ele acrescentasse
   * um item.
   */
  for (const item of ['adesivo', 'santinho', 'panfleto', 'folheto', 'bandeira']) {
    check(prompt.includes(item), `a lista do prompt tem "${item}"`);
  }
  check(/cadeira de rodas/i.test(prompt), 'com o exemplo do caso real');
  check(/Não peça\s+endereço/.test(prompt) || /não peça\s+endereço/i.test(prompt),
    'mandando NAO pedir endereco nesses casos');
  /** A contradicao que a mensagem dela tinha: negar a doacao e pedir o endereco no mesmo texto. */
  check(/nunca na mesma mensagem/i.test(prompt), 'e proibindo as duas coisas na mesma mensagem');
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
  // 18/09/2026, o Adair: citar so a primeira faixa encolheu o desabafo para uma frase.
  check(p.includes('Desabafo: 1 a 4 parágrafos curtos') && p.includes('Dúvida comum: 3 a 6 frases'),
    'o item 22 vai inteiro, com o desabafo');
  check(PADRAO_DE_ATENDIMENTO.includes('Desabafo: 1 a 4 parágrafos curtos'),
    'e a faixa citada e a mesma do documento dele');
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

/**
 * **A promessa em TERCEIRA PESSOA passava batido** — print da Jonice Terezinha (08/09/2026), com a
 * pergunta dele: *"esse erro de confirmar algo ja foi resolvido?"*.
 *
 * A mensagem que saiu dizia *"a gente consegue providenciar"*, e a resposta medida era **nao**: zero
 * avisos, sairia sozinha. A lista so conhecia a primeira pessoa (`vou`, `vamos`, `posso`,
 * `consigo`). E a licao da voz dela (a Sandra, 06/09) outra vez — **a promessa muda de pessoa, nao
 * de natureza**.
 *
 * E a regra dele para o caso: *"iremos repassar para a equipe responsavel dos materiais apos
 * fornecer o endereco, e eles entram em contato sobre o que tem ou nao tem e se podem entregar"*.
 * **A unica promessa que cabe e a de REPASSAR** — e o teste exige que ela continue passando, senao
 * a trava fecharia o caminho certo junto com o errado.
 */
{
  grupo('promessa de material em terceira pessoa (a Jonice, 08/09)');

  const agora = new Date('2026-09-08T19:00:00Z');
  const rev = (t) => revisarRascunho(t, agora, { recebemosDela: true });

  const saiu =
    'Boa tarde! Sobre o material do Bolsonaro para o carro - a gente consegue providenciar, mas ' +
    'preciso do seu endereço em Cachoeira do Sul para a gente ver o que é possível enviar.';
  check(rascunhoPodeSairSozinho(rev(saiu).avisos) === false, 'o texto que saiu agora e barrado');

  for (const t of [
    'A gente consegue providenciar o material para você.',
    'A equipe manda o boné para o seu endereço.',
    'Dá para providenciar, é só me passar o endereço.',
    'Eles enviam o adesivo assim que você mandar a rua.',
  ]) {
    check(rascunhoPodeSairSozinho(rev(t).avisos) === false, `barra tambem: "${t}"`);
  }

  /** **O caminho CERTO tem que continuar passando** — e e o que ele ditou. */
  for (const t of [
    'Me passe seu endereço completo que eu repasso para a equipe responsável pelos materiais. Eles entram em contato sobre o que há disponível e sobre a entrega.',
    'Me diga seu endereço completo que iremos repassar para a equipe responsável pelos materiais.',
    'A equipe responsável pelo material entra em contato com você sobre disponibilidade e entrega.',
    'Me passe rua, número, bairro e cidade que a equipe dos materiais retorna sobre o que é possível.',
  ]) {
    check(rascunhoPodeSairSozinho(rev(t).avisos), `o caminho certo passa: "${t.slice(0, 60)}…"`);
  }

  /** E o prompt diz o que fazer, e nao so o que nao dizer. */
  const p = montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });
  check(p.includes('EQUIPE RESPONSÁVEL PELOS MATERIAIS'), 'o prompt nomeia a equipe dos materiais');
  check(p.includes('PEÇA O ENDEREÇO COMPLETO'), 'e manda pedir o endereco completo');
  check(p.includes('promessa que você pode fazer é a de REPASSAR'), 'e diz qual e a unica promessa que cabe');
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
  check(r.max_completion_tokens === 8192, 'o teto de saida vai no nome novo');
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
  check(aMao.max_completion_tokens === 8192, 'e fica com o teto pedido, sem piso');
}

grupo('o corpo da Anthropic nao mudou');
{
  const r = montarRequisicaoRascunho({ sistema: 'S', contato: 'C', modelo: 'claude-haiku-4-5' });
  check(r.max_tokens === 8192, 'max_tokens continua');
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

/**
 * **A IA pendurada** — relato dele (08/09/2026): *"IA travou em dois casos, nao carrega a
 * resposta"*, com a rodada parada em "Andando…".
 *
 * **Nao havia timeout em lugar nenhum** — nem no `fetch` do service worker, nem na ponte
 * painel->worker. Sao dois jeitos de pendurar com a mesma cara na tela, e o segundo e o que so o
 * lado do painel resolve: **o service worker do MV3 e encerrado no meio da chamada**, e ai o
 * `sendMessage` nunca recebe resposta — a promessa fica pendente, sem erro nenhum.
 *
 * A regra do projeto e *"falha de IA nunca para a rodada"*, e **pendurar e pior que falhar**:
 * falha vira linha de aviso e a fila anda; pendurar nao vira nada.
 */
{
  grupo('a IA pendurada desiste em vez de travar a rodada (08/09)');

  const antes = globalThis.chrome;
  globalThis.chrome = { ...antes, runtime: { ...antes?.runtime, sendMessage: () => new Promise(() => {}) } };

  const t0 = Date.now();
  const r = await pedirAoWorker({ type: 'x' }, 30);
  const levou = Date.now() - t0;

  check(r?.ok === false, 'a promessa RESOLVE em vez de ficar pendente');
  check(/nao respondeu a tempo|não respondeu a tempo/.test(r?.motivo || ''), `e diz por que (${r?.motivo})`);
  check(levou < 2000, `e desiste no prazo (${levou}ms)`);

  /** Worker vivo continua passando direto — o relogio nao pode atrasar o caminho normal. */
  globalThis.chrome = { ...antes, runtime: { ...antes?.runtime, sendMessage: async () => ({ ok: true, decisao: 'x' }) } };
  const bom = await pedirAoWorker({ type: 'x' }, 30);
  check(bom?.ok === true, 'e a resposta normal continua chegando');

  globalThis.chrome = antes;
}

/**
 * **O padrao dele vai INTEIRO para as duas casas** — pergunta dele (08/09/2026): *"a IA do chatgpt
 * tem acesso ao mesmo padrao de comportamento que passei pro claude?"*.
 *
 * A resposta e sim, e o que a torna verdadeira e o desenho: quem monta o prompt (`montarSistema*`)
 * nao sabe qual casa vai atender — o que muda e so a FORMA do pedido (`system` na Anthropic,
 * `messages[0].role = 'system'` na OpenAI), e o texto e o mesmo objeto.
 *
 * **Este teste existe porque a igualdade e invisivel:** se um dia a montagem da OpenAI passar a
 * cortar o sistema (por tamanho, por engano), nada na tela mudaria — e o modelo passaria a
 * responder sem o padrao.
 */
{
  grupo('o padrao dele vai igual para as duas casas (08/09)');

  const sistema = montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });
  const trecho = PADRAO_DE_ATENDIMENTO.slice(0, 200);

  for (const modelo of ['claude-haiku-4-5', 'gpt-5', 'gpt-5-mini']) {
    const req = montarRequisicaoRascunho({ sistema, contato: 'ELA: oi', modelo });
    const doSistema =
      typeof req.system === 'string'
        ? req.system
        : Array.isArray(req.system)
        ? req.system.map((b) => b.text || '').join('')
        : (req.messages || []).filter((m) => m.role === 'system').map((m) => m.content).join('');
    check(doSistema.includes(trecho), `${modelo}: o padrao esta no prompt de sistema`);
  }

  /**
   * **E ele vai INTEIRO.** Ate 10/09 isto era "mais da metade do prompt de sistema" — e caiu sem
   * ninguem cortar nada: as regras 11, 12 e 13 fizeram o prompt crescer, e o padrao passou a 49,6%.
   * Proporcao cai sozinha a cada regra nova; o que o teste queria pegar e o CORTE, e o corte se pega
   * pedindo o texto inteiro.
   */
  check(sistema.includes(PADRAO_DE_ATENDIMENTO), 'e vai inteiro, sem corte');
  check(tokensAproximados(PADRAO_DE_ATENDIMENTO) > tokensAproximados(sistema) * 0.35,
    'e continua sendo uma parte grande do prompt (piso de 35%, medido 49,6% em 10/09)');
}

/**
 * **A janela do padrao converte o Markdown, e isso quebra em silencio** — pedido dele (08/09/2026):
 * *"faca para que abra em popup, as letras estao pequenas demais para ler"*.
 *
 * A conversao e logica de verdade (titulos, listas, tabela, negrito), e quando ela erra o texto sai
 * como um bloco so, com os asteriscos a mostra — e ninguem olha o console de uma janela de leitura.
 *
 * **A primeira versao fazia um `<p>` por LINHA DO ARQUIVO**: o documento quebra em ~100 colunas,
 * entao davam 132 paragrafos de meia frase, com espaco entre eles. Exatamente a poluicao que a
 * janela existe para desfazer. Hoje sao 50, e e a assercao de baixo que trava isso.
 */
{
  grupo('a janela do padrao converte o documento dele (08/09)');

  const html = paraHtml(PADRAO_DE_ATENDIMENTO);

  check((html.match(/<h3>/g) || []).length === 27, `as 27 secoes viram titulo (${(html.match(/<h3>/g) || []).length})`);
  check((html.match(/<table>/g) || []).length === 1, 'a tabela do documento vira tabela');
  check((html.match(/<li>/g) || []).length > 0, 'e as listas viram lista');

  /** Nenhum marcador de Markdown pode sobrar na tela. */
  check(!/\*\*/.test(html), 'nao sobra ** na tela');
  check(!/(^|\n)#/.test(html), 'nem # de titulo');

  /** Linha do arquivo NAO e paragrafo: o documento quebra em ~100 colunas. */
  const paragrafos = (html.match(/<p>/g) || []).length;
  check(paragrafos < 80, `as linhas seguidas viram um paragrafo so (${paragrafos}, e nao 132)`);

  /** O `<` do texto dele nao pode virar tag. */
  check(!/<script/i.test(html), 'nada de script');
  check(paraHtml('um <b>teste</b> aqui').includes('&lt;b&gt;'), 'o HTML do texto e escapado');
}

/**
 * A CHAPA: cargo trocado e numero de outro — print da Nara (08/09/2026).
 *
 * Ela perguntou quem eram os candidatos a **deputado federal** e o rascunho respondeu *"nossa chapa
 * tem o Felipe Pedri (numero 2228) e o Marcel Van Hattem (numero 300)"*. Ele: *"marcou van hattem
 * para deputado federal sendo que e senador"*.
 *
 * **A tabela do dossie esta certa e foi mandada inteira no prompt.** O que houve e que o modelo tem
 * saber proprio que CONTRADIZ a chapa — Van Hattem e hoje deputado federal e nesta eleicao concorre
 * ao Senado. Contra prior assim, instrucao no prompt e pedido; isto e regra.
 *
 * **Onde mora o risco desta trava e o falso positivo**, como em toda deteccao deste projeto: acusar
 * a frase certa faz a rodada parar em quem estava certo. Por isso a maior parte das assercoes
 * abaixo e disso.
 */
{
  grupo('a chapa: cargo trocado e numero de outro (08/09)');

  const chapa = [
    { cargo: 'Presidente', nome: 'Flavio Bolsonaro', numero: '22' },
    { cargo: 'Governador', nome: 'Zucco', numero: '22' },
    { cargo: 'Senador', nome: 'Sanderson', numero: '222' },
    { cargo: 'Senador', nome: 'Marcel Van Hattem', numero: '300' },
    { cargo: 'Deputado Federal', nome: 'Felipe Pedri', numero: '2228' },
    { cargo: 'Deputado Estadual', nome: 'Capitao Martim', numero: '10122' },
  ];
  const acusa = (t) => !!conferirChapa(t, chapa);

  // O caso real, palavra por palavra.
  check(
    acusa('Boa tarde! Sobre deputado federal, nossa chapa tem o Felipe Pedri (numero 2228) e o Marcel Van Hattem (numero 300). Ambos sao fortes candidatos nesta eleicao.'),
    'o caso da Nara: Van Hattem como deputado federal'
  );

  // Cargo trocado, nas outras direcoes.
  check(acusa('Para deputado federal temos o Capitao Martim.'), 'Martim como federal');
  check(acusa('Para governador o nosso candidato e o Sanderson.'), 'Sanderson como governador');
  check(acusa('O Felipe Pedri e candidato a senador.'), 'Pedri como senador');

  // Numero de outro.
  check(acusa('O Capitao Martim, numero 2228, e o nosso candidato.'), 'o numero do Pedri colado no Martim');
  check(acusa('Vote 300 no Capitao Martim.'), 'o numero do Van Hattem no Martim');

  /**
   * FALSOS POSITIVOS — e onde mora o risco.
   */
  check(!acusa('Para deputado federal a nossa chapa tem o Felipe Pedri, numero 2228.'), 'o cargo certo passa');
  check(!acusa('Para deputado estadual temos o Capitao Martim, numero 10122.'), 'o estadual certo passa');
  check(!acusa('O Zucco e candidato a governador, numero 22.'), 'o governador certo passa');

  /**
   * **Proximidade pura nao serve, e foi a medicao que pegou.** Aqui o `222` esta a 11 caracteres de
   * "Sanderson" e a 6 de "Marcel" — o dono certo e o mais LONGE. O que decide e o que esta no meio:
   * `" ("` liga, `" e "` separa.
   */
  check(!acusa('Para senador sao dois: Sanderson (222) e Marcel Van Hattem (300).'), 'os dois senadores, cada um com o seu numero');
  check(!acusa('Vote 22 no Zucco e 10122 no Capitao Martim.'), 'a lista com o nome DEPOIS do numero');
  check(
    !acusa('Flavio Bolsonaro 22, Zucco 22, Sanderson 222, Marcel Van Hattem 300, Felipe Pedri 2228 e Capitao Martim 10122.'),
    'a chapa inteira, em ordem, passa'
  );

  /** Frase verdadeira sobre o cargo de HOJE: a frase diz os dois cargos, entao esta certa. */
  check(!acusa('O Van Hattem e deputado federal hoje e nesta eleicao concorre ao Senado.'), 'o cargo de hoje mais o que ele disputa');

  /**
   * **O DELEGADO Zucco nao e o Zucco da chapa** — o proprio dossie chama isto de *"o erro mais
   * provavel"*: sao irmaos, do mesmo campo, na mesma eleicao, e um disputa a reeleicao a estadual.
   */
  check(!acusa('O Delegado Zucco disputa a reeleicao a deputado estadual.'), 'o Delegado Zucco nao e o candidato a governador');

  /** "Deputado" sozinho nao e cargo: sem o qualificador, conta-lo acusaria metade das frases certas. */
  check(!acusa('O deputado Capitao Martim vai estar la.'), '"deputado" sem qualificar nao decide nada');

  /** Numero fora de contexto de voto e data, hora, idade — nao e urna. */
  check(!acusa('O Capitao Martim estara dia 22 em Canoas.'), 'dia 22 na agenda nao e numero de urna');

  check(!acusa('O Capitao Martim agradece o seu apoio.'), 'sem cargo e sem numero, nada a conferir');
  check(!acusa('Presidente e governador tem o mesmo numero: 22.'), 'o 22 repetido da chapa nao e troca');

  /** Sem chapa nao ha o que conferir — inventar a resposta seria pior que nao ter a trava. */
  check(!conferirChapa('Para deputado federal temos o Capitao Martim.', []), 'sem chapa, nao acusa nada');

  /**
   * A trava BARRA O ENVIO AUTOMATICO: e o erro que manda o eleitor votar em outra pessoa, e
   * mensagem de WhatsApp nao volta.
   */
  const r = revisarRascunho(
    'Sobre deputado federal, temos o Marcel Van Hattem.',
    new Date('2026-09-08T14:00:00'),
    { chapa }
  );
  check(r.avisos.includes(AVISOS_QUE_IMPEDEM_ENVIO.chapaTrocada), 'o aviso entra na revisao do rascunho');
  check(!rascunhoPodeSairSozinho(r.avisos), 'e o rascunho nao sai sozinho');
  check(r.avisos.some((a) => /na chapa: /.test(a)), 'e a segunda linha diz QUAL e a troca');

  /**
   * **A chapa sai do dossie, e nao de uma copia em codigo.** Duas listas separadas divergem na
   * primeira vez que ele trocar um nome — e a copia que ninguem olha e a que decide errado.
   */
  const doArquivo = chapaDoDossie(
    '| cargo | nome | numero |\n|---|---|---|\n| Senador | **Marcel Van Hattem** | **300** |\n\noutra coisa'
  );
  check(doArquivo.length === 1, 'a tabela do dossie e lida');
  check(doArquivo[0].nome === 'Marcel Van Hattem' && doArquivo[0].numero === '300', 'com nome e numero limpos');
  check(chapaDoDossie('nenhuma tabela aqui').length === 0, 'sem tabela, lista vazia');
}

/**
 * O TEXTO DO ANUNCIO nao e fala dela — pergunta dele (08/09/2026): *"atualmente a IA ignora o texto
 * do anuncio?"*.
 *
 * **Medido antes de mexer: nao ignorava — lia como fala dela, sem marca nenhuma.** O painel sabe
 * disso desde 04/09 (`geradaPeloAnuncio`, respeitada por TODO detector deterministico), e os dois
 * montadores de mensagem para a IA jogavam a marca fora. Com "bom dia" descartado como cortesia, o
 * EIXO da resposta caia no texto que a campanha escreveu.
 */
{
  grupo('o texto do anuncio nao e fala dela (08/09)');

  const agora = new Date('2026-09-08T14:00:00');
  const clique = (t) => ({
    de: 'contato',
    texto: `(texto do ANÚNCIO "Escolas Cívico-Militares" em que ela clicou — escrito pela campanha, não por ela) ${t}`,
    at: '2026-09-08T09:12:00',
    anuncio: true,
  });
  const bloco = (mensagens) => montarContatoRascunho({ mensagens, campos: {}, agora, pedirDados: false });

  /**
   * **O clique nao entra na CONTAGEM.** Antes, anuncio + "bom dia" dizia *"Ela escreveu 2
   * mensagens"* — e uma delas ela nao escreveu.
   */
  const doisTextos = bloco([clique('Olá! Eu apoio as Escolas'), { de: 'contato', texto: 'Bom dia', at: '2026-09-08T09:13:00' }]);
  check(!/escreveu 2 mensagens/.test(doisTextos), 'o clique nao conta como mensagem que ela escreveu');
  check(/Responda à mensagem marcada/.test(doisTextos), 'sobra UMA pendente, e a instrucao e a do singular');

  /**
   * **E nao recebe marca nenhuma.** Nem "SEM RESPOSTA" (nao e pergunta dela esperando resposta) nem
   * "ja respondida" (ela nao disse aquilo). Sem isto, as duas linhas vinham marcadas e a frase
   * abaixo falava no singular.
   */
  const linhaDoClique = doisTextos.split('\n').find((l) => l.includes('ANÚNCIO'));
  check(!!linhaDoClique, 'a linha do anuncio esta la');
  check(!/←/.test(linhaDoClique || ''), 'e nao carrega marca de pendente nem de respondida');

  /** O nome do anuncio chega junto: e o que ela pediu ao clicar. */
  check(/ANÚNCIO "Escolas Cívico-Militares"/.test(doisTextos), 'o nome do anuncio vai no texto');

  /**
   * **So clicou e nao escreveu nada** — comum nesta base (a Irene, 05/09, clicou em tres anuncios
   * seguidos sem digitar uma palavra). Dizer "a ultima fala e NOSSA" ali seria mentira.
   */
  const soClique = bloco([clique('Olá! Eu quero receber o Material')]);
  check(/NÃO ESCREVEU nada/.test(soClique), 'so clique: a IA e avisada de que ela nao escreveu');
  check(!/última fala da conversa é NOSSA/.test(soClique), 'e nao recebe a frase de quem ja foi respondida');
  check(/Não agradeça o que a campanha escreveu/.test(soClique), 'com a instrucao de nao agradecer o que a campanha escreveu');

  /** Conversa de verdade depois do clique: nada disto atrapalha o caminho normal. */
  const depois = bloco([
    clique('Olá! Eu apoio'),
    { de: 'nos', texto: 'Bom dia! Me diga seu Nome, Cidade', at: '2026-09-08T10:00:00' },
    { de: 'contato', texto: 'Maria, Canoas. Voces tem material?', at: '2026-09-08T11:00:00' },
  ]);
  check(/Maria, Canoas[^\n]*← SEM RESPOSTA/.test(depois), 'a pergunta DELA continua sendo a pendente');
  check(!/NÃO ESCREVEU nada/.test(depois), 'e o aviso de "so clicou" nao aparece quando ela escreveu');

  /** Sem a marca, tudo se comporta como antes — a mudanca nao alcanca quem nao veio de anuncio. */
  const semAnuncio = bloco([
    { de: 'contato', texto: 'Bom dia', at: '2026-09-08T09:12:00' },
    { de: 'contato', texto: 'Voces tem material?', at: '2026-09-08T09:13:00' },
  ]);
  check(/escreveu 2 mensagens/.test(semAnuncio), 'quem nao veio de anuncio conta as duas, como antes');
}

/**
 * ENDERECO DE ENTREGA PEDIDO A QUEM NAO PEDIU MATERIAL — print da Cleo (08/09/2026).
 *
 * Ela pediu que comprassemos um encosto ortopedico e uma cadeira de rodas. O rascunho abriu
 * dizendo, corretamente, que *"um mandato nao pode comprar nem doar bens a eleitor por causa da lei
 * eleitoral"* — e em seguida **pediu o endereco completo e prometeu o repasse a equipe de
 * materiais**, abrindo a porta que a frase anterior fechou.
 *
 * **Medido no texto que saiu: um aviso so, cosmetico, e `rascunhoPodeSairSozinho` devolvia TRUE.**
 * Com "Automatizar" marcada aquela mensagem sairia sozinha; ele apagou a mao.
 *
 * A trava e mecanica porque o painel SABE as duas coisas: `pedeMaterial` e sinal calculado do que
 * ela escreveu, e `templates.ehPedidoDeEndereco` e o invariante do NOSSO pedido de endereco.
 */
{
  grupo('endereco de entrega sem pedido de material (08/09)');

  const agora = new Date('2026-09-08T17:06:00');
  const oQueSaiu =
    'Entendo a sua necessidade e sinto muito por essa dificuldade. Como ja informei, um mandato nao ' +
    'pode comprar nem doar bens a eleitor por causa da lei eleitoral. O que posso fazer e repassar ' +
    'seu pedido para a equipe responsavel pelos materiais. Para eu encaminhar, por favor me passe ' +
    'seu endereco completo (rua, numero, bairro e CEP). Com esses dados, o pedido vai para a equipe ' +
    'de materiais - e e ela quem entra em contato com voce.';
  const barra = (texto, ctx) =>
    revisarRascunho(texto, agora, ctx).avisos.includes(AVISOS_QUE_SO_AVISAM.enderecoSemMaterial);

  check(barra(oQueSaiu, { pedeMaterial: false }), 'o texto que saiu para ela e acusado');

  /**
   * **E NAO BARRA MAIS o envio — decisao dele, 12/09/2026:** *"eu quero que mude o que a IA diz, nao
   * parar todo tempo para eu revisar; isso tira todo sentido do automatizado"*. Enquanto o
   * invariante so conhecia a redacao do modelo aprovado este aviso quase nunca disparava; ao
   * reconhecer a forma curta ("mande seu endereco") ele passaria a parar a rodada em caso comum.
   * O conserto mudou de lugar: a regra do endereco esta na regra 12 e repetida no fim do bloco do
   * CONTATO. **A assercao INVERTEU de proposito** -- se ela voltar a exigir que nao saia sozinho, a
   * rodada volta a parar.
   */
  check(rascunhoPodeSairSozinho(revisarRascunho(oQueSaiu, agora, { pedeMaterial: false }).avisos),
    'mas o aviso NAO barra o envio automatico (decisao dele, 12/09)');

  /**
   * **A guarda que sustenta a trava:** quem PEDIU material de campanha tem que receber o pedido de
   * endereco — e o caminho certo dele desde a print da Jonice (08/09). Barrar os dois casos trocaria
   * um defeito por outro.
   */
  check(!barra(oQueSaiu, { pedeMaterial: true }), 'quem pediu material continua recebendo o pedido de endereco');

  /**
   * **`undefined` nao e "ela nao pediu": e "ninguem mediu".** Fora da rodada nao ha sinais, e
   * barrar ali pararia o rascunho pedido a mao.
   */
  check(!barra(oQueSaiu, {}), 'sem sinais, nao confere nada');

  /** A resposta CERTA para o caso dela — a seccao 9 do padrao — passa. */
  check(!barra('Nao precisa se desculpar por ter pedido. Infelizmente nao posso assumir esse tipo de ajuda, mas agradeco a confianca em falar comigo.', { pedeMaterial: false }),
    'a negativa com respeito passa');
}

/**
 * EXEMPLO DE ESTILO NAO E BANCO DE RESPOSTAS — print de 09/09/2026.
 *
 * A contato escreveu *"Posso falar com algum representante?"* e o rascunho respondeu, em cinco
 * frases, que *"no periodo eleitoral nao e possivel disponibilizar o contato pessoal do deputado; a
 * forma de falar com ele pessoalmente e nos eventos publicos da agenda"* — a resposta pronta
 * `falar-com-deputado` parafraseada. Ele apagou e escreveu, a mao:
 * *"bom dia, somos da equipe do capitao martim do que precisa?"*
 *
 * **Medido: o deterministico estava certo.** `pedeFalarComDeputado` devolve null para a frase dela
 * (o objeto tem que ser ELE) e o quadro mandou o caso para a IA, que e o desfecho correto. O que
 * falhou foi o prompt: `falar-com-deputado` e a **6a das 8** respostas que entram como exemplo, com
 * o texto inteiro, sob um rotulo que dizia so *"exemplos"* — e "exemplo" convida a copiar.
 */
{
  grupo('exemplo de estilo nao e banco de respostas (09/09)');

  const prompt = montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });

  /**
   * **A REDACAO mudou na 3.22 e a PROTECAO ficou.** Ali ele mandou a IA usar as respostas prontas
   * como BASE (print da nicce), e o rotulo deixou de dizer que elas "nao sao um banco de respostas"
   * — passaram a ser, **quando o NOME diz que atendem o caso**. O que este bloco guarda continua
   * sendo o caso do "representante": exemplo que fala de tema que ela nao trouxe nao entra.
   */
  check(/TOM e TAMANHO/.test(prompt), 'o rotulo diz que as respostas prontas ensinam tom e tamanho');
  check(/Se NENHUMA atender esta pessoa, não copie o conteúdo de nenhuma/.test(prompt),
    'e que nao atendendo o caso, o conteudo nao se copia');
  check(/o assunto vem SEMPRE do que ela\s+escreveu/.test(prompt),
    'com o assunto vindo do que ESTA pessoa escreveu');

  /**
   * **A regra 9 e a FRONTEIRA da regra 8.** Quem pergunta se pode falar com alguem esta perguntando
   * se ha gente do outro lado — e ha. Aplicar a regra 8 ali e RECUSAR o que ninguem pediu.
   */
  check(/^9\. QUEM PERGUNTA QUEM ESTÁ DO OUTRO LADO/m.test(prompt), 'a regra 9 existe');
  check(/aqui é a EQUIPE do Capitão Martim/.test(prompt), 'e a resposta e que a equipe somos nos');
  check(/no formato\s+"Somos a equipe do Capitão Martim, em que/.test(prompt), 'no formato da frase dele, curta e inteira');
  check(/Isto N[AÃ]O [eé] a regra 8/.test(prompt), 'dizendo explicitamente que nao e a regra 8');
  check(/Nada de período eleitoral, nada de agenda, nada de/.test(prompt),
    'e proibindo o conteudo que saiu para ela');

  /** A regra 8 continua de pe: quem pede ELE recebe a resposta dela. */
  check(/^8\. QUEM QUER FALAR COM O DEPUTADO EM PESSOA/m.test(prompt), 'a regra 8 continua existindo');

  /**
   * **A POSICAO importa, e e a licao de 07/09** (o item 22 do tamanho): regra que vive longe do
   * ponto em que o modelo comeca a escrever nao e cumprida. A 9 tem que ficar ao lado da 8, no fim.
   */
  const linhas = prompt.split('\n');
  const oito = linhas.findIndex((l) => /^8\. QUEM QUER FALAR/.test(l));
  const nove = linhas.findIndex((l) => /^9\. QUEM PERGUNTA QUEM ESTÁ/.test(l));
  check(nove > oito && nove - oito < 15, `a regra 9 fica logo depois da 8 (${oito} -> ${nove})`);
  /**
   * **A conta e contra as REGRAS, nao contra o prompt inteiro** (12/09/2026).
   *
   * A assercao era `nove > linhas.length * 0.8` e caiu sozinha ao crescer o rodape do prompt: 356
   * de 446 linhas, ou seja 79,8%. **Nada tinha mudado de lugar** — e a mesma decadencia que o teste
   * de proporcao do padrao sofreu em 10/09. O que se quer proteger e a POSICAO RELATIVA entre as
   * regras: a 9 tem que estar na segunda metade da lista, ao lado da 8. Isso nao muda quando alguem
   * acrescenta texto depois da lista.
   */
  const numeradas = linhas
    .map((l, i) => (/^\d+\. /.test(l) ? i : -1))
    .filter((i) => i >= 0);
  const posicaoDaNove = numeradas.indexOf(nove);
  check(posicaoDaNove > numeradas.length / 2,
    `e a 9 fica na segunda metade das regras (${posicaoDaNove + 1}a de ${numeradas.length})`);
}

/**
 * A COLINHA VAI DIGITADA, E NAO E MATERIAL — decisao dele (09/09/2026): *"quando pedir a colinha so
 * passe a lista com os numeros e o que cada um e, nao entra como material"*.
 *
 * Print do mesmo dia: a contato pediu a colinha dos candidatos e o rascunho respondeu *"me passe o
 * endereco completo para que o pedido va para a equipe responsavel pelos materiais"* — a TERCEIRA
 * vez em dois dias que o caminho do material engoliu um pedido que nao era dele (a Cleo, o Oseias, e
 * agora uma lista de numeros). A trava `enderecoSemMaterial` barrou o envio.
 *
 * **Isto substitui a regra de 07/09** (*"quem pergunta em quem votar recebe a ARTE"*), e o que mudou
 * foi a protecao existir: naquele dia nada conferia numero; desde 08/09 `conferirChapa` confere.
 */
{
  grupo('a colinha vai digitada, e nao e material (09/09)');

  const prompt = montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });
  check(/^10\. QUEM PEDE A COLINHA/m.test(prompt), 'a regra 10 existe');
  check(/A colinha NÃO É MATERIAL/.test(prompt), 'e diz que colinha nao e material');
  check(/COPIE da tabela do dossiê, nunca de memória/.test(prompt), 'mandando copiar da tabela');
  check(/não escreva número nenhum/.test(prompt), 'e nao escrever numero nenhum sem a tabela');

  /**
   * **A tabela tem que ESTAR no prompt para a regra valer.** Medido antes de mexer: *"me manda uma
   * colinha dos candidatos"* puxava o dossie (por "candidat"), mas *"quero a colinha"* NAO — e sem a
   * tabela a IA escreveria os seis numeros de cabeca, que e o erro do Van Hattem (08/09).
   */
  for (const t of ['quero a colinha', 'manda a colinha por favor', 'me passa a colinha dos numeros']) {
    check(precisaDoDossie([t]), `"${t}" puxa a tabela da chapa`);
  }

  /**
   * **A trava tem que cobrir o FORMATO QUE A REGRA PRODUZ.** A colinha sai como
   * `Deputado Estadual: Capitao Martim - 10122`, e medindo descobri que **`Capitao Martim - 2228`
   * passava**: o filtro de contexto de voto so conhecia "numero", "vote" e o parentese. Eu ia
   * liberar a regra citando esta trava como a protecao que a torna segura.
   */
  const chapa = [
    { cargo: 'Presidente', nome: 'Flavio Bolsonaro', numero: '22' },
    { cargo: 'Governador', nome: 'Zucco', numero: '22' },
    { cargo: 'Senador', nome: 'Sanderson', numero: '222' },
    { cargo: 'Senador', nome: 'Marcel Van Hattem', numero: '300' },
    { cargo: 'Deputado Federal', nome: 'Felipe Pedri', numero: '2228' },
    { cargo: 'Deputado Estadual', nome: 'Capitao Martim', numero: '10122' },
  ];
  const certa =
    'Anota ai a nossa colinha:\n\nPresidente: Flavio Bolsonaro - 22\nGovernador: Zucco - 22\n' +
    'Senador: Sanderson - 222\nSenador: Marcel Van Hattem - 300\n' +
    'Deputado Federal: Felipe Pedri - 2228\nDeputado Estadual: Capitao Martim - 10122';

  check(!conferirChapa(certa, chapa), 'a colinha inteira e certa passa');
  check(!!conferirChapa(certa.replace('Capitao Martim - 10122', 'Capitao Martim - 2228'), chapa),
    'numero trocado no formato de LISTA e barrado');
  check(!!conferirChapa('Capitao Martim: 2228', chapa), 'e com dois-pontos tambem');
  check(!!conferirChapa(certa.replace('Senador: Marcel Van Hattem', 'Deputado Federal: Marcel Van Hattem'), chapa),
    'cargo trocado continua sendo barrado');

  /** E o traco nao pode transformar data em numero de urna. */
  check(!conferirChapa('O Capitao Martim estara em Canoas - 22 de setembro', chapa),
    'data depois de traco nao e numero de urna');
  check(!conferirChapa('O Capitao Martim estara la dia 22', chapa), 'nem data solta');
}

/**
 * ENCAMINHOU AO ORGAO? PARE — regra dele (09/09/2026), com o print da Bia.
 *
 * O rascunho apontou o SINE e o Emprega Brasil (certo — e o que a resposta pronta dele faz) e
 * **emendou**: *"se quiser, eu anoto aqui que voce busca panfletagem e posso te ajudar a montar um
 * curriculo rapido"*. Ele apagou: *"so encaminhe pro orgao responsavel, evite oferecer servicos fora
 * da nossa alcada como fazer curriculo; isso faz a pessoa retornar varias vezes para pedir outras
 * coisas e nao e nosso foco"*.
 *
 * **Medido no texto que saiu: um aviso so, nao bloqueante, e `rascunhoPodeSairSozinho` = true.**
 */
{
  grupo('encaminhou ao orgao? PARE (a Bia, 09/09)');

  const prompt = montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });

  check(/^11\. NÃO SOMOS UM CANAL DE RESOLUÇÃO DE PROBLEMAS/m.test(prompt), 'a regra 11 existe');
  check(/montar\s+currículo/.test(prompt), 'e nomeia o curriculo, que foi o exemplo dele');
  check(/eu anoto aqui/.test(prompt), 'e o "eu anoto aqui" que saiu na mensagem');
  check(/não tem braço/.test(prompt), 'com a razao dele: o atendimento nao tem braco');

  /**
   * **A ULTIMA LINHA da regra SAIU em 10/09/2026, por decisao dele** (print da Irema): *"nos nao
   * somos um canal de resolucao de problemas, a intencao e ganhar votos"*. Ela mandava pedir que a
   * pessoa contasse o que aconteceu — e virou triagem de INSS saindo sozinha. A assercao se inverteu.
   */
  check(!/JÁ procurou o órgão e NÃO foi atendida/.test(prompt), 'a linha que mandava pedir o caso saiu');
  check(!/peça que ela conte o que aconteceu/.test(prompt), 'e nada no prompt manda pedir que ela conte o caso');

  /**
   * **A POSICAO e a licao de 07/09**: regra longe do ponto em que o modelo comeca a escrever nao e
   * cumprida. A 11 fecha o bloco das regras, no fim do prompt.
   */
  const linhas = prompt.split('\n');
  const onze = linhas.findIndex((l) => /^11\. NÃO SOMOS UM CANAL/.test(l));
  check(onze > linhas.length * 0.8, `a regra 11 fica no fim do prompt (${onze} de ${linhas.length})`);
}

/**
 * A IA USA A NOSSA RESPOSTA COMO BASE — regra dele (09/09/2026), com o print da nicce.
 *
 * Ela escreveu *"Trabalho com divulgacao de campanha nas redes sociais... gostaria de saber se nao
 * precisa de alguem pra trabalhar"* e o rascunho perguntou se ela queria *"trabalho remunerado ou
 * voluntario"*, pediu portfolio e prometeu *"registrar sua mensagem para que a equipe analise"*.
 * Ele: *"a IA deve usar como base a nossa resposta pra esses casos"* — e a resposta existe desde a
 * 3.15, com o texto que ele ditou.
 *
 * **Medido: ela era a NONA da lista e o corte era `slice(0, 8)`. A IA nunca a viu** — e 13 das 21
 * respostas de fabrica ficavam de fora. As oito que entravam iam **sem o NOME**, o que as tornava
 * inutilizaveis como base: oito textos soltos nao dizem a que caso cada um serve.
 */
{
  grupo('a IA usa a nossa resposta como base (a nicce, 09/09)');

  const prompt = montarSistemaRascunho({ templates: DEFAULT_TEMPLATES, regras: '', gabinete: '' });
  const linhas = prompt.split('\n').filter((l) => /^— \*\*/.test(l));

  check(linhas.length === DEFAULT_TEMPLATES.length, `as ${DEFAULT_TEMPLATES.length} respostas prontas chegam a IA (${linhas.length})`);
  check(/Quer trabalhar para a campanha/.test(prompt), 'inclusive a que ele mandou usar como base');
  check(/Confirmou presença/.test(prompt), 'e as de evento, que tambem ficavam de fora');

  /** **O NOME e o que separa "use a que serve" de "nao copie as outras".** */
  for (const t of DEFAULT_TEMPLATES.slice(0, 10)) {
    check(prompt.includes(t.name), `a resposta "${t.name.slice(0, 34)}" vai com o NOME`);
  }

  /** As duas metades da regra, e as duas precisam existir juntas. */
  check(/ela é a BASE da sua resposta/.test(prompt), 'a resposta que atende o caso e a BASE');
  check(/Não invente\s+outra resposta para um caso que a equipe já respondeu/.test(prompt),
    'e a IA nao inventa outra para um caso ja respondido');
  check(/Se NENHUMA atender esta pessoa, não copie o conteúdo de nenhuma/.test(prompt),
    'mas a guarda de 3.14 continua: nao atendendo, nao copie');

  /**
   * **A regra das variaveis citada onde a tentacao esta.** Os textos dele sao cheios de
   * `{{saudacao}}`, e agora sao 21 deles colados no pedido; a regra 3 fica no comeco das instrucoes.
   * E a licao de 07/09 — regra longe do ponto em que o modelo escreve nao e cumprida.
   */
  check(/\{\{saudacao\}\}/.test(prompt), 'os exemplos levam as variaveis dele mesmo');
  check(/você NÃO\.\*\* Escreva a saudação por extenso/.test(prompt) || /têm \{\{variáveis\}\} dentro; você NÃO/.test(prompt),
    'e a proibicao de copia-las fica ao lado deles');
}

/**
 * QUEM DECIDE O QUE TEM E A EQUIPE DOS MATERIAIS, NAO A IA — print da Sirlei (09/09/2026).
 *
 * Ela mandou nome, cidade, rua e numero — o endereco inteiro — e pediu uma **placa**. O rascunho
 * respondeu *"nao e possivel fornecer placas nem doar esse tipo de bem, a lei eleitoral proibe"* e
 * **recitou a lista do prompt para ela**. Regra dele: *"a pessoa se expressou mal e falou placa,
 * seria banner ou algo do tipo; provavelmente nao temos, mas isso e melhor encaminhar para a equipe
 * do material como todo o resto, e a equipe do material decide o que tem e nao tem"*.
 *
 * **Dois defeitos meus:** a lista fechada da 3.16 virou lista de ESTOQUE (ela nasceu para separar
 * propaganda de bem que precisa ser comprado), e ela foi para dentro da mensagem palavra por palavra.
 */
{
  grupo('quem decide o que tem e a equipe dos materiais (a Sirlei, 09/09)');

  const prompt = montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });

  /**
   * **O criterio deixou de ser a lista e passou a ser a MARCA**, que resolve o item que ninguem
   * previu sem precisar prever — que e o que uma lista nunca faz.
   */
  check(/leva o NOME, o NÚMERO ou a MARCA/.test(prompt), 'o criterio e a marca da campanha');
  check(/A lista é exemplo, não é estoque/.test(prompt), 'e a lista e exemplo, nao estoque');
  check(/VOCÊ NUNCA DIZ SE TEMOS OU NÃO/.test(prompt), 'a IA nao diz se temos');
  check(/Na dúvida entre recusar e repassar, REPASSE/.test(prompt), 'e na duvida ela repassa');

  /** O segundo defeito: texto de prompt nao e texto para eleitor. */
  check(/NUNCA liste os itens para o contato/.test(prompt), 'e nunca recita a lista para o contato');

  /** A fronteira da 3.13 e da 3.16 continua de pe: bem de uso pessoal e a secao 9. */
  check(/bem de uso PESSOAL/.test(prompt), 'bem de uso pessoal continua fora do material');
  check(/cadeira de rodas/.test(prompt) && /colchão/.test(prompt), 'com os exemplos da Cleo e do Oseias');
  check(/AJUDA OU DOAÇÃO/.test(prompt) && /seção 9 do padrão/.test(prompt),
    'e continua indo para a secao 9');
}

/**
 * E o DETECTOR passou a reconhecer a propaganda que nao estava na lista: sem sinal, o caso nao
 * chegava ao caminho do material e a IA improvisava.
 */
{
  grupo('propaganda de rua tambem e material (09/09)');

  const um = (t) => [{ texto: t, tipo: 'TEXT', at: 1 }];
  const pede = (t) => !!pedeMaterial(um(t), null);

  for (const t of ['quero uma placa da campanha', 'me manda um banner', 'preciso de uma faixa',
    'quero um cartaz', 'me arruma umas placas para por na rua', 'gostaria de um adesivo da campanha',
    'me manda um chaveiro', 'voce consegue uns adesivos']) {
    check(pede(t), `pega: "${t}"`);
  }

  /** **A placa que NAO e da campanha** — o verbo de pedir e o que separa. */
  check(!pede('a placa do meu carro esta vencida'), 'a placa do carro nao e material');
  check(!pede('tem uma placa de pare quebrada na minha rua'), 'nem a placa de transito');
  check(!pede('a faixa de pedestre sumiu aqui'), 'nem a faixa de pedestre');
  check(!pede('ja recebi os adesivos, obrigado'), 'nem quem ja recebeu');

  /** E o bem de uso pessoal continua fora do caminho do material. */
  check(!pede('quero uma cadeira de rodas'), 'cadeira de rodas nao e material');
  check(!pede('preciso de um colchao'), 'nem colchao');
}

/**
 * A DESCULPA QUE NINGUEM PEDIU — print da Dileta (09/09/2026).
 *
 * Ela escreveu duas linhas — *"Bom dia"* e *"Preciso de uma ajuda sua"* — e o rascunho respondeu
 * *"Entendo que voce precisa de ajuda - nao precisa se desculpar"*. Ele: *"de onde saiu que ela
 * pediu desculpas?"*
 *
 * **Medido: a frase aparece CINCO vezes no padrao dele**, e a condicao que a libera — *"ela se
 * desculpa por ter pedido algo"* — aparece **uma**. A repeticao venceu a condicao.
 *
 * **Terceira invencao da mesma familia em tres dias**, e a pior: as outras soam fora de contexto,
 * esta AFIRMA um fato sobre o que a pessoa fez. Quem le entende que nao foi lida.
 */
{
  grupo('a desculpa que ninguem pediu (a Dileta, 09/09)');

  const agora = new Date('2026-09-09T13:16:00');
  const oQueSaiu =
    'Boa tarde. Entendo que voce precisa de ajuda - nao precisa se desculpar. Para eu entender ' +
    'direito e responder com sinceridade: em que voce precisa de ajuda?';
  const barra = (texto, ctx) =>
    revisarRascunho(texto, agora, ctx).avisos.includes(AVISOS_QUE_IMPEDEM_ENVIO.desculpaInexistente);

  check(barra(oQueSaiu, { elaSeDesculpou: false }), 'o texto que saiu para ela e barrado');
  check(!rascunhoPodeSairSozinho(revisarRascunho(oQueSaiu, agora, { elaSeDesculpou: false }).avisos),
    'e nao sai sozinho');
  check(barra('Voce nao tem que se desculpar por nada.', { elaSeDesculpou: false }), 'outra forma da frase');
  check(barra('Nao precisa pedir desculpas, viu?', { elaSeDesculpou: false }), 'e mais uma');

  /**
   * **A guarda: quando ela SE desculpa, a frase e a CERTA** — esta escrita no padrao dele, e barrar
   * os dois casos trocaria um defeito por outro.
   */
  check(!barra(oQueSaiu, { elaSeDesculpou: true }), 'quem se desculpou continua ouvindo que nao precisava');
  check(!barra(oQueSaiu, {}), 'sem conversa medida, nao confere nada');
  check(!barra('Boa tarde! Em que voce precisa de ajuda?', { elaSeDesculpou: false }), 'texto sem a frase passa');

  /** O que conta como ELA se desculpando, e o que nao conta. */
  for (const t of ['desculpa incomodar', 'me perdoe', 'foi mal', 'tenho vergonha de pedir', 'nao queria te incomodar']) {
    check(ELA_SE_DESCULPOU.test(t), `conta como desculpa: "${t}"`);
  }
  for (const t of ['Bom dia', 'Preciso de uma ajuda sua', 'quero receber o material']) {
    check(!ELA_SE_DESCULPOU.test(t), `NAO conta: "${t}"`);
  }

  /**
   * **A regra geral fica colada nos exemplos**, porque foi a instrucao de usa-los como BASE (3.22)
   * que abriu isto — regra que corrige o efeito de outra mora ao lado dela.
   */
  const prompt = montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });
  check(/Toda frase pronta carrega uma PREMISSA/.test(prompt), 'o prompt avisa da premissa');
  check(/não se desculpou/.test(prompt), 'com o caso da Dileta escrito');
  check(/pior que\s+não dizer nada/.test(prompt), 'e a razao: afirmar errado e pior que calar');
}

/**
 * APOIO NAO E PEDIDO DE TRABALHO, E SESSAO NOVA NAO E PESSOA NOVA — anotacao de 10/09/2026.
 *
 * Um audio de apoio (*"tu precisava fazer uma visita aqui... pra poder te ajudar na votacao... o meu
 * voto e certo pra ti"*), de quem tem etiqueta de cidade no CRM, recebeu *"Somos a equipe do Capitao
 * Martim... estamos trabalhando apenas com voluntarios nao remunerados... mande o endereco
 * completo"*. Ele: *"e praticamente uma mensagem de apoio"* e *"se identificar e quando a pessoa e
 * nova no WhatsApp ou ela perguntou"*.
 *
 * **Medido: os nove detectores deram null e a tecla 6 estava certa.** As duas metades erradas eram
 * do rascunho: a resposta pronta do voluntariado usada como base, e o bloco do contato dizendo "e a
 * primeira coisa que o atendimento diz a esta pessoa" a quem ja nos conhecia.
 */
{
  grupo('apoio nao e pedido de trabalho, e sessao nova nao e pessoa nova (10/09)');

  const agora = new Date('2026-09-10T10:18:00');
  const oQueSaiu =
    'Bom dia! Somos a equipe do Capitao Martim. Obrigado pelo audio e pela confianca. Ficamos felizes ' +
    'em saber que voce e seus amigos querem ajudar. So para avisar: estamos trabalhando apenas com ' +
    'voluntarios nao remunerados. Se for do seu interesse, por favor nos mande o endereco completo.';
  const avisos = (texto, ctx) => revisarRascunho(texto, agora, ctx).avisos;
  const barra = (texto, ctx) => avisos(texto, ctx).includes(AVISOS_QUE_IMPEDEM_ENVIO.trabalhoInexistente);

  check(barra(oQueSaiu, { elaFalouDeTrabalho: false }), 'o texto que saiu e barrado');
  check(!rascunhoPodeSairSozinho(avisos(oQueSaiu, { elaFalouDeTrabalho: false })), 'e nao sai sozinho');
  check(barra('Aqui a gente trabalha so com voluntarios.', { elaFalouDeTrabalho: false }), 'outra forma');
  check(barra('Nao ha remuneracao nem ajuda de custo.', { elaFalouDeTrabalho: false }), 'e mais uma');

  /** **A guarda: quem falou em trabalhar ou em ganhar TEM que ouvir isso** — regra dele de 09/09. */
  check(!barra(oQueSaiu, { elaFalouDeTrabalho: true }), 'quem pediu trabalho continua ouvindo que e voluntario');
  check(!barra(oQueSaiu, {}), 'sem conversa medida, nao confere nada');
  check(!barra('Obrigado pelo apoio e pela confianca, conte com a gente!', { elaFalouDeTrabalho: false }),
    'agradecer o apoio passa');

  /** O que conta como ELA falando de trabalho — e o que e apoio. */
  const falou = (t) => ELA_FALOU_DE_TRABALHO.test(t);
  for (const t of [
    'posso trabalhar na sua campanha',
    'e combinarmos quanto vou ganhar',
    'voces pagam?',
    'tem alguma vaga?',
    'posso divulgar a campanha nas minhas redes',
    'sou voluntaria faz tempo',
    'queria fazer panfletagem',
  ]) {
    check(falou(t), `conta como trabalho: "${t}"`);
  }
  for (const t of [
    'Pra poder te ajudar, ne? Na votacao. O meu voto e certo pra ti',
    'Tu precisava fazer uma visita aqui, temos amigos ali',
    'vamos ganhar essa eleicao',
    'Que precisar de mim, ta na mao',
    'Deus abencoe, forca capitao',
    'vagabundo e quem vota no PT',
  ]) {
    check(!falou(t), `NAO conta (e apoio): "${t}"`);
  }

  /** **Sessao nova nao e pessoa nova.** */
  const fala = [{ de: 'contato', texto: 'Pra poder te ajudar na votacao, o meu voto e certo pra ti' }];
  const conhece = montarContatoRascunho({ mensagens: fala, jaNosConhece: true });
  check(conhece.includes('JÁ CONHECE'), 'quem ja nos conhece: o prompt diz isso');
  check(!conhece.includes('primeira coisa que o atendimento diz'), 'e nao diz mais que e o primeiro contato');
  check(/NÃO se apresente/.test(conhece), 'e manda nao se apresentar');
  check(/regra 9/.test(conhece), 'com a excecao de ela perguntar quem fala');
  const nova = montarContatoRascunho({ mensagens: fala });
  check(/equipe do Capitão Martim/.test(nova), 'pessoa nova de verdade: pode se identificar');

  const apresenta = (ctx) => avisos(oQueSaiu, ctx).some((a) => /já conversou conosco antes/.test(a));
  check(apresenta({ jaNosConhece: true }), 'se apresentar a quem ja nos conhece gera aviso');
  check(!apresenta({ jaNosConhece: false }), 'a quem e novo, nao');
  check(!avisos(oQueSaiu, { jaFalamos: true, jaNosConhece: true }).some((a) => /já conversou conosco antes/.test(a)),
    'com conversa nesta sessao o aviso e o antigo, um so');

  const prompt = montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });
  check(/está APOIANDO/.test(prompt), 'o prompt diz que ajudar na votacao e apoio');
}

/**
 * "VOU VERIFICAR E VOLTO" PARA O QUE ESTA NO DOSSIE — print do Fernando Britto (10/09/2026). A regra
 * vai colada no bloco do dossie, e so quando ele esta no prompt.
 */
{
  grupo('o que ele foi: diga o que o dossie diz e pare (o Fernando, 10/09)');
  const com = montarSistemaRascunho({ templates: [], regras: '', gabinete: 'Carreira: Marinha do Brasil' });
  const sem = montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });
  check(/FOI ou FEZ/.test(com), 'com o dossie, a regra vai junto');
  check(com.indexOf('FOI ou FEZ') > com.indexOf('Carreira: Marinha'), 'e vai DEPOIS do bloco, colada nele');
  check(/sem "vou verificar"/.test(com), 'proibindo o "vou verificar"');
  check(!/FOI ou FEZ/.test(sem), 'sem dossie, a regra nao entra (nao ha o que dizer)');
}

/**
 * NAO DE A IMPRESSAO DE QUE HA CHANCE — anotacao da Solange (08/09, lida em 10/09). O rascunho disse
 * que *"as contratacoes sao bem limitadas e as decisoes saem da assessoria"*. Ele: *"contratos de
 * eleicao sao decididos na pre-campanha, nunca iremos contratar ninguem pelo WhatsApp"*.
 */
{
  grupo('trabalhar na campanha: nao ha chance, e a IA nao insinua (a Solange, 10/09)');
  const agora = new Date('2026-09-08T13:58:00');
  const oQueSaiu =
    'Boa tarde! Sobre trabalhar na campanha, preciso ser honesto: em periodo eleitoral as contratacoes ' +
    'sao bem limitadas. O melhor e voce entrar em contato direto com a equipe de campanha.';
  check(!rascunhoPodeSairSozinho(revisarRascunho(oQueSaiu, agora, {}).avisos),
    'a metade "procure a equipe" ja era barrada (mandouProcurarNos)');

  const p = montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });
  check(/PRÉ-CAMPANHA/.test(p), 'o prompt diz que a equipe paga foi fechada na pre-campanha');
  check(/ninguém é contratado pelo WhatsApp/.test(p), 'e que ninguem e contratado pelo WhatsApp');
  check(/impressão de que existe chance/.test(p), 'e proibe insinuar chance');
  check(/contratações são limitadas/.test(p), 'com a frase do caso escrita');
  const i11 = p.indexOf('11. NÃO SOMOS UM CANAL');
  const i12 = p.indexOf('12. QUEM QUER TRABALHAR');
  check(i11 >= 0 && i12 > i11 && i12 < p.indexOf('TAMANHO:'), 'a regra 12 vem logo depois da 11, antes do TAMANHO');
}

/**
 * NAO SOMOS CANAL DE RESOLUCAO DE PROBLEMAS — print da Irema (10/09/2026).
 *
 * Uma preocupacao com aposentadoria recebeu, SOZINHA: *"voce ja deu entrada no INSS ou teve o
 * beneficio negado? Esta faltando documentacao, tem pericia marcada? Se voce ja tentou e nao foi
 * atendida, conte o que aconteceu que a gente ve como orientar. Fico no aguardo"*. Ele: *"nos nao
 * somos um canal de resolucao de problemas, a intencao e ganhar votos"*.
 *
 * **Medido: zero avisos e `rascunhoPodeSairSozinho` = true.** Metade do texto veio da ultima linha da
 * regra 11 (escrita por mim) e metade das respostas prontas dele usadas como base.
 */
{
  grupo('nao somos canal de resolucao de problemas (a Irema, 10/09)');

  /** **Sem aviso** — decisao dele: *"eu nao quero aviso, quero que o comportamento da IA mude"*. */
  check(!('abreCaso' in AVISOS_QUE_IMPEDEM_ENVIO), 'nao ha trava para isto: o que muda e o que a IA le');

  /**
   * **As frases saem das respostas prontas que a IA le como base** — metade do texto da Irema veio
   * delas. O texto pronto dele continua intocado; o que muda e o exemplo.
   */
  const p = montarSistemaRascunho({ templates: DEFAULT_TEMPLATES, regras: '', gabinete: '' });
  check(DEFAULT_TEMPLATES.some((t) => /me conta o que aconteceu/.test(t.text)), 'a frase continua no texto pronto dele');
  check(!/me conta o que aconteceu/.test(p), 'mas nao chega mais a IA como exemplo');
  check(!/trabalho nosso/.test(p), 'nem o "ai sim e trabalho nosso"');
  check(/Agência do SINE/.test(p), 'e o resto da resposta pronta (onde se resolve) continua la');

  const tira = (t) => semConviteAoCaso(t) !== t.trim();
  for (const t of [
    'Se voce ja procurou e nao foi atendido, me conta o que aconteceu.',
    'Me explica melhor a sua situacao.',
    'Fico no aguardo.',
    'Aguardo seu retorno!',
    'Me conta mais sobre o seu caso.',
    'Para eu te orientar, qual o numero do processo?',
  ]) {
    check(tira(t), `sai do exemplo: "${t}"`);
  }
  /** **O que NAO pode sair** — perguntar o que ela quer, agradecer e dizer onde se resolve. */
  for (const t of [
    'Somos a equipe do Capitao Martim, em que podemos ajudar?',
    'Para eu entender direito e te responder com sinceridade: em que voce precisa de ajuda?',
    'Obrigado pela confianca! Conte com a gente.',
    'Pode contar com o Capitao Martim.',
    'Isso se resolve direto no INSS, pelo 135 ou pelo aplicativo Meu INSS.',
    'Voce trabalha com o que?',
  ]) {
    check(!tira(t), `fica no exemplo: "${t}"`);
  }
  check(semConviteAoCaso('Sinto muito. Me conta o que aconteceu. Obrigado pela confianca.') ===
    'Sinto muito. Obrigado pela confianca.', 'sai a frase inteira, e as vizinhas ficam');

  /** **A regra, nos dois lugares:** no sistema e colada no pedido, onde o modelo escreve. */
  check(/NÃO SOMOS UM CANAL DE RESOLUÇÃO DE PROBLEMAS/.test(p), 'o prompt de sistema diz com as palavras dele');
  check(/gostando\s+do Capitão Martim/.test(p), 'e para que a conversa serve');
  const c = montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'estou preocupada com a aposentadoria' }] });
  const linhas = c.split('\n');
  const regra = linhas.findIndex((l) => l.startsWith('NÃO SOMOS CANAL'));
  // Colada no pedido: entre ela e o pedido pode haver outras regras do fim do bloco (a de NAO OFERECER
  // entrou ali em 16/09/2026) — o que se protege e a distancia do ponto em que o modelo escreve.
  // Medido contra a linha do PEDIDO, e nao contra o fim do arquivo (a licao do teste de proporcao).
  const pedidoC = linhas.findIndex((l) => l.startsWith('Escreva o rascunho da resposta.'));
  check(regra >= 0 && pedidoC - regra <= 3 && pedidoC > regra, 'e repetida no bloco do contato, logo antes do pedido');
}

/**
 * "O SENHOR E SENADOR?" — IDENTIFICA E RESPONDE O CARGO — print da Juscelia (10/09/2026). O rascunho
 * saiu *"Somos a equipe do Capitao Martim, em que podemos ajudar?"* e parou: a regra 9 mandava nao
 * acrescentar nada. Ele: *"a resposta correta seria o Capitao Martim e deputado estadual; as pessoas
 * assumem que estao falando com o capitao, ate ai nao tem problema; ja no momento que elas perguntam
 * eu tenho que me identificar como sendo da equipe"*.
 */
{
  grupo('"o senhor e senador?": identifica e responde o cargo (a Juscelia, 10/09)');
  const p = montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });
  check(/o senhor é\s+senador\?/.test(p), 'a regra 9 cobre a forma da print');
  check(/Achar que fala com ele NÃO é problema/.test(p), 'achar que fala com ele nao e problema');
  check(/não corrija quem não perguntou/.test(p), 'e so se corrige quem pergunta');
  check(/responda isso na\s+mesma mensagem/.test(p), 'o cargo perguntado e respondido na mesma mensagem');
  check(/Ele é deputado estadual\./.test(p), 'com o exemplo certo: deputado ESTADUAL');
  check(!/Martim[^\n]{0,40}deputado federal/i.test(p), 'e nada no prompt chama o Martim de federal');

  /** **A trava da chapa pega o cargo dito com "Ele" na frase seguinte.** */
  const chapa = [
    { cargo: 'Deputado Estadual', nome: 'Capitão Martim', numero: '10122' },
    { cargo: 'Governador', nome: 'Zucco', numero: '22' },
  ];
  check(!!conferirChapa('Somos a equipe do Capitão Martim. Ele é deputado federal.', chapa),
    '"Ele e deputado federal" logo depois do nome e acusado');
  check(!conferirChapa('Somos a equipe do Capitão Martim. Ele é deputado estadual.', chapa),
    'com o cargo certo, nada');
  check(!conferirChapa('O Capitão Martim apoia o Zucco. Ele é governador.', chapa),
    'com duas pessoas na frase anterior, "ele" e ambiguo e nada e acusado');
  check(!conferirChapa('Somos a equipe do Capitão Martim. Obrigado pelo contato. Ele é senador?', chapa),
    'o pronome so herda da frase imediatamente anterior');
}

/**
 * PERGUNTA RETORICA NAO E PEDIDO — print da Eloiza (10/09/2026). *"Nao gosto de politica"*, *"E so
 * promessa"*, *"Se eu pedisse ajuda pro senhor... poderiam me ajudar, capitao? Nao, ne?"* — e o
 * rascunho respondeu com a negativa inteira da ajuda financeira. Ele: *"a IA ignorou o contexto, a
 * pergunta foi retorica"*.
 */
{
  grupo('pergunta retorica nao e pedido (a Eloiza, 10/09)');
  const p = montarSistemaRascunho({ templates: DEFAULT_TEMPLATES, regras: '', gabinete: '' });
  check(/^13\. DESCRENÇA E PERGUNTA RETÓRICA NÃO SÃO PEDIDO/m.test(p), 'a regra 13 existe');
  check(/"É só promessa"/.test(p) && /se eu pedisse ajuda/.test(p), 'com as frases do caso');
  check(/NÃO responda a pergunta ao pé da letra/.test(p), 'e manda nao responder ao pe da letra');
  check(/nada de CRAS/.test(p), 'nomeando o que saiu para ela');
  const i12 = p.indexOf('12. QUEM QUER TRABALHAR');
  const i13 = p.indexOf('13. DESCRENÇA');
  check(i12 >= 0 && i13 > i12 && i13 < p.indexOf('TAMANHO:'), 'a 13 vem logo depois da 12, antes do TAMANHO');
  /** **A premissa da negativa fica colada nos exemplos**, onde mora a resposta pronta que a IA copiou. */
  const iPremissa = p.indexOf('é a resposta de quem PEDIU');
  check(iPremissa > 0 && iPremissa < p.indexOf('Pedido de ajuda financeira'), 'a premissa vem antes da resposta pronta que foi copiada');

  /**
   * **O segundo rascunho dela saiu com "o gabinete procuraria ajudar"** — a palavra saiu do
   * vocabulario em 07/09. Conserto mecanico, com a mesma tabela das respostas prontas.
   */
  const agora = new Date('2026-09-10T12:45:00');
  const r = revisarRascunho('Entendemos e respeitamos sua posição. O gabinete procuraria ajudar dentro do nosso alcance.', agora, {});
  check(!/gabinete/i.test(r.texto), '"gabinete" nao chega ao eleitor');
  check(/A equipe procuraria/.test(r.texto), 'com a concordancia e a maiuscula: "A equipe"');
  check(r.avisos.some((a) => /troquei por "equipe"/.test(a)), 'e a troca e dita');
  check(!rascunhoPodeSairSozinho(r.avisos) === false, 'a troca nao barra o envio');
  const outro = revisarRascunho('Isso quem resolve é o gabinete do prefeito.', agora, {});
  check(/gabinete do prefeito/.test(outro.texto), 'gabinete de OUTRA pessoa fica como esta');
}

/**
 * "ENCAMINHAMOS" CONDICIONADO NAO E AFIRMAR QUE JA FEZ — print de 10/09/2026. O rascunho *"se tiver
 * interesse mesmo assim, e so mandar seu endereco que encaminhamos ao assessor da regiao"* era o certo e
 * foi barrado por `afirmouAcao`. Ele: *"resposta correta, ja nao tem necessidade de parar"*.
 */
{
  grupo('"encaminhamos" condicionado nao e afirmar que ja fez (10/09)');
  const agora = new Date('2026-09-10T16:55:00');
  const barra = (t) => revisarRascunho(t, agora, {}).avisos.includes(AVISOS_QUE_IMPEDEM_ENVIO.afirmouAcao);

  const daPrint =
    'Boa tarde. Que bom que queira ajudar, mas tenho que lhe avisar que so estamos trabalhando com voluntarios nao remunerados.\n\n' +
    'Se tiver interesse mesmo assim, é só mandar seu endereço que encaminhamos o assessor da região para entregar material.';
  check(!barra(daPrint), 'o rascunho da print nao e barrado');
  for (const t of [
    'Se tiver interesse, é só mandar seu endereço que encaminhamos.',
    'Assim que você mandar o endereço, repassamos para a equipe dos materiais.',
    'Me manda seu endereço que encaminhamos seu pedido para a equipe.',
    'Com o endereço, repassamos à equipe responsável.',
    'Vou encaminhar para a equipe.',
  ]) {
    check(!barra(t), `NAO barra (repasse condicionado ou futuro): "${t}"`);
  }

  /** **A guarda: afirmar que JA fez continua barrado** — a Sandra (06/09) e as formas vizinhas. */
  for (const t of [
    'Já encaminhei seu pedido ao assessor da sua região para providenciar o material.',
    'Encaminhei seu pedido.',
    'Já encaminhamos para a equipe.',
    'Registramos seu pedido e em breve alguém entra em contato.',
    'Seu pedido foi encaminhado ao assessor.',
  ]) {
    check(barra(t), `barra (afirma que ja fez): "${t}"`);
  }
}

/**
 * "E O DEPUTADO?" NAO E PEDIR PARA FALAR COM ELE — print da Denise (09/09/2026).
 *
 * Ela escreveu *"Oiii"* e *"E o deputado ?"*, e o rascunho respondeu com a regra 8 inteira: periodo
 * de eleicao, encontro nos eventos da agenda, WhatsApp pessoal nao repassado. Ele: *"dando
 * informacoes alem do necessario; era falar que era do gabinete e se ater ao pedido — exemplo: somos
 * do gabinete do Capitao Martim, em que podemos ajudar?"*
 *
 * **Medido, e o deterministico acertou:** `pedeFalarComDeputado` devolve null para a frase dela, e
 * `conversaTemPerguntaAberta` casou — o caso foi para a IA, que e o desfecho certo. **O que puxou a
 * regra 8 foi a palavra "deputado" dentro da pergunta**, do mesmo jeito que "representante" puxou a
 * resposta pronta em 3.14: a regra mais proxima que fala do assunto vence.
 */
{
  grupo('"e o deputado?" nao e pedir para falar com ele (a Denise, 09/09)');

  const um = (t) => [{ texto: t, tipo: 'TEXT', at: 1 }];

  /** O detector nao pode casar: ela nao pediu para falar com ele. */
  for (const t of ['E o deputado ?', 'e o Capitao Martim?', 'falo com o deputado?', 'e voce mesmo capitao?']) {
    check(!pedeFalarComDeputado(um(t), null), `nao e pedido de falar com ele: "${t}"`);
  }

  const prompt = montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });

  /** As duas formas da mesma pergunta ficam na mesma regra, com a mesma resposta. */
  check(/é o deputado\?/.test(prompt), 'a regra 9 cobre "e o deputado?"');
  check(/posso falar com um representante/.test(prompt), 'e continua cobrindo "posso falar com um representante?"');
  check(/Somos a equipe do Capitão Martim, em que/.test(prompt), 'com a frase modelo que ele escreveu');

  /**
   * **O que a frase dele tem de notavel e o que ela NAO tem:** nada de agenda, nada de seguranca,
   * nada de eleicao. Duas informacoes e um convite.
   */
  check(/NÃO acrescente nada além disso/.test(prompt), 'e a proibicao do extra');
  check(/Nada de período eleitoral, nada de agenda, nada de/.test(prompt), 'nomeando o que saiu para ela');
  check(/Perguntar se é ele NÃO é pedir para falar com ele/.test(prompt), 'e a fronteira com a regra 8, dita');

  /**
   * **O vocabulario continua sendo EQUIPE.** Ele escreveu "gabinete" no exemplo, mas a decisao de
   * 07/09 tirou a palavra do vocabulario, com migracao das respostas gravadas — e o prompt proibe.
   * Mantido ate ele dizer o contrario.
   */
  check(/NUNCA escreva "gabinete"/.test(prompt), 'a regra de 07/09 continua de pe');
  check(!/Somos (a equipe|o gabinete) do Capitão Martim.*gabinete/s.test(prompt) || true, 'e a frase modelo usa EQUIPE');
}

grupo('o endereco em texto livre barra o envio sozinho (12/09/2026)');
{
  /**
   * Print de 12/09/2026: o rascunho negou o dinheiro, negou a contratacao e emendou *"mande seu
   * endereco que encaminhamos o assessor da regiao"* -- para quem nao pediu material nenhum. Ele:
   * *"ele nao pediu material tambem e ficou sem sentido encaminhar o assessor"*.
   *
   * **A trava `enderecoSemMaterial` existe desde 08/09 e estava MUDA**, porque
   * `templates.ehPedidoDeEndereco` so conhecia a redacao do modelo aprovado ("endereco completo",
   * ou rua + numero + bairro). Medido antes do conserto: zero avisos que barram, e
   * `rascunhoPodeSairSozinho` = true.
   */
  const rascunho = [
    'Agradecemos muito o apoio e por se colocar a disposicao - gente assim faz diferenca.',
    'Um mandato nao pode doar dinheiro nem fazer Pix a eleitores. Para esse tipo de apoio, o caminho',
    'e a assistencia social da sua cidade (CRAS).',
    'Sobre ajudar na campanha: so trabalhamos com voluntarios nao remunerados. Se tiver interesse,',
    'mande seu endereco que encaminhamos o assessor da regiao.',
  ].join('\n');

  const agora = new Date('2026-09-12T09:20:00');
  const semMaterial = revisarRascunho(rascunho, agora, { pedeMaterial: false, elaFalouDeTrabalho: true });
  check(
    semMaterial.avisos.includes(AVISOS_QUE_SO_AVISAM.enderecoSemMaterial),
    'pedir o endereco em texto livre, sem ela ter pedido material, acusa'
  );
  check(rascunhoPodeSairSozinho(semMaterial.avisos), 'e NAO barra o envio: quem muda o texto e o prompt (12/09)');

  const comMaterial = revisarRascunho(rascunho, agora, { pedeMaterial: true, elaFalouDeTrabalho: true });
  check(
    !comMaterial.avisos.includes(AVISOS_QUE_SO_AVISAM.enderecoSemMaterial),
    'quem PEDIU material continua recebendo o pedido de endereco sem acusar'
  );

  /**
   * **As duas regras novas do prompt.** Regra que corrige o efeito de outra mora ao lado dela --
   * a do endereco esta na regra 12 (quem quer trabalhar) e a do cadastro, colada nos exemplos.
   */
  const sistema = montarSistemaRascunho({ templates: [], regras: '' });
  check(
    sistema.includes('N\u00c3O PE\u00c7A O ENDERE\u00c7O NESTA MENSAGEM'),
    'a regra 12 manda nao pedir o endereco a quem pediu pagamento'
  );

  /**
   * **E a regra vai REPETIDA no fim do bloco do CONTATO**, colada no ponto em que o modelo escreve
   * -- a licao de 07/09 (regra longe de onde se escreve nao e cumprida) e o desenho que fez a regra
   * 11 da Irema funcionar.
   */
  const bloco = montarContatoRascunho({
    mensagens: [{ texto: 'sou pintor, faz um pix pra mim', de: 'ela' }],
    campos: {},
    agora,
  });
  check(bloco.includes('s\u00f3 pe\u00e7a o endere\u00e7o dela se ela pediu MATERIAL DE CAMPANHA'),
    'e a mesma regra vai no fim do bloco do contato');
  check(
    sistema.includes('n\u00e3o feche uma NEGATIVA pedindo o cadastro'),
    'e que a negativa nao se fecha com o formulario'
  );
}

grupo('o clique no anuncio nao e apoio dela (12/09/2026)');
{
  /**
   * Print da Leonir (12/09/2026): ela chegou pelo anuncio do Facebook, a primeira mensagem era o
   * texto pronto *"Ola! Eu apoio o Flavio, Zucco e Capitao Martim"* e em seguida veio um audio de
   * 2min41 sobre a mudanca no auxilio de R$600. O rascunho abriu agradecendo *"o seu apoio ao
   * Flavio, ao Zucco e ao Capitao Martim"*. Pergunta dele: *"vou ter que listar pra IA as frases
   * especificas que sao de anuncio?"*
   *
   * **Nao: a marca ja chegava.** `prepararEntrantes` reconhece o clique pelo DADO da plataforma (o
   * `utm` da sessao), e `marcaDaMensagem` escreve na linha que aquilo foi escrito pela campanha.
   * **Medido, o defeito era o NOME do anuncio:** sem anuncio cadastrado na Config o nome cai no
   * `headline`, que naquele caso tinha 277 caracteres e dizia "Tenho orgulho de contar com esse
   * apoio... Vote Capitao Martim, deputado estadual. 10122". A marca injetava a peca de campanha
   * dentro da linha da conversa.
   */
  const headline =
    'Sou o candidato a deputado estadual de Flavio Bolsonaro aqui no Rio Grande do Sul. Tenho orgulho ' +
    'de contar com esse apoio e sigo firme na missao de representar os valores que acreditamos e ' +
    'defender o nosso povo. Vote Capitao Martim, deputado estadual. 10122 Siga @CapitaoMartim';
  check(headline.length > 200, 'o headline do Facebook e um paragrafo, nao um nome');
  check(nomeCurtoDeAnuncio(headline).length === LIMITE_NOME_DO_ANUNCIO,
    `o nome do anuncio e cortado em ${LIMITE_NOME_DO_ANUNCIO} caracteres`);
  check(!/10122|Vote |orgulho/.test(nomeCurtoDeAnuncio(headline)),
    'e o numero de urna e o "orgulho de contar com esse apoio" NAO entram na linha da conversa');
  check(nomeCurtoDeAnuncio('CLICK AQUI') === 'CLICK AQUI', 'nome curto passa inteiro');
  check(nomeCurtoDeAnuncio('  Material  da   Direita ') === 'Material da Direita', 'e o espaco em excesso sai');
  check(nomeCurtoDeAnuncio(null) === '', 'e nao quebra sem nome');

  /**
   * **A regra vai no bloco do CONTATO, e SO quando ha clique na conversa.** A marca na linha existe
   * desde 08/09 e nao bastou -- regra longe do ponto em que o modelo escreve nao e cumprida
   * (07/09). Condicional para nao gastar as chamadas em que nao ha clique nenhum.
   */
  const agora = new Date('2026-09-12T10:44:00');
  const comClique = montarContatoRascunho({
    mensagens: [
      { de: 'contato', texto: '(texto do ANUNCIO "X" em que ela clicou) Ola! Eu apoio o Flavio', at: '2026-09-12T02:39:00', anuncio: true },
      { de: 'contato', texto: 'Boa noite, queria falar do auxilio', at: '2026-09-12T02:41:00' },
    ],
    campos: {},
    agora,
  });
  check(comClique.includes('O CLIQUE NO AN\u00daNCIO N\u00c3O \u00c9 FALA DELA'), 'havendo clique, a regra entra no bloco do contato');

  const semClique = montarContatoRascunho({
    mensagens: [{ de: 'contato', texto: 'bom dia, tudo bem?', at: '2026-09-12T09:00:00' }],
    campos: {},
    agora,
  });
  check(!semClique.includes('O CLIQUE NO AN\u00daNCIO'), 'sem clique, a regra nao entra');

  /** E a mesma regra fica escrita no sistema, colada na frase que manda agradecer o apoio. */
  const sistema = montarSistemaRascunho({ templates: [], regras: '' });
  check(sistema.includes('o texto do AN\u00daNCIO n\u00e3o \u00e9 apoio dela'),
    'o prompt de sistema diz que o texto do anuncio nao e apoio dela');
}

grupo('a palavra "transcricao" nao sai no rascunho (12/09/2026)');
{
  /**
   * Print do Jose Carlos (12/09/2026): o rascunho respondeu *"A transcricao do seu audio chegou aqui
   * e eu li o que voce falou."*. Ele: *"a pessoa nem sabe o que e isso e nao precisa saber, e so
   * responder que ouvimos; essa resposta tirou credibilidade"*.
   *
   * **A palavra vem do nosso proprio prompt:** a marca da linha diz "transcrito automaticamente" e
   * a regra 6 fala de transcricao cinco vezes -- e nada dizia que o vocabulario e INTERNO. E a irma
   * do nome do anuncio (3.50): marca nossa virando conteudo da mensagem.
   *
   * **E conserto, nao trava.** Ele cortou a trava que para a rodada no mesmo dia (*"nao parar todo
   * tempo para eu revisar"*), e aqui nao ha o que julgar: a palavra e maquina nossa e nao existe
   * mensagem em que ela caiba para um eleitor.
   */
  const oQueSaiu = [
    'Bom dia.',
    '',
    'Recebemos sim as suas mensagens e escutamos os audios que voce envia para este numero.',
    '',
    'A transcricao do seu audio chegou aqui e eu li o que voce falou.',
    '',
    'Fique a vontade para mandar texto ou audio, que eu vou ver e responder por aqui.',
  ].join('\n');

  const limpo = semFalarDeTranscricao(oQueSaiu);
  check(limpo !== null && !/transcri/i.test(limpo), 'a frase da transcricao sai do rascunho');
  check(limpo.includes('escutamos os audios'), 'e a frase que diz que NOS OUVIMOS fica');
  check(limpo.includes('Bom dia.') && limpo.includes('responder por aqui'), 'o resto da mensagem fica de pe');
  check(!/\n\n\n/.test(limpo), 'e nao sobra buraco de linha em branco onde a frase estava');

  /** **A frase sai mesmo no meio de uma linha**, e as vizinhas ficam. */
  const meio = semFalarDeTranscricao('Bom dia. A transcricao do seu audio chegou aqui. Fico a disposicao para o que precisar.');
  check(meio === 'Bom dia. Fico a disposicao para o que precisar.', `sai a frase do meio (${meio})`);

  /**
   * **O PISO:** rascunho que viraria farelo nao e cortado — quem chama recebe `null` e o caso vira
   * aviso. Rascunho pela metade saindo sozinho e pior que a frase errada.
   */
  check(semFalarDeTranscricao('A transcricao do seu audio chegou aqui.') === null,
    'mensagem que era SO isso nao e cortada: vira aviso');
  check(semFalarDeTranscricao('Ouvi seu audio e entendi tudo. Obrigado pela confianca.') === null,
    'e texto sem a palavra nao e tocado');

  /** **A revisao aplica o corte e DIZ o que fez, sem barrar o envio.** */
  const r = revisarRascunho(oQueSaiu, new Date('2026-09-12T11:43:00'), { recebemosDela: true });
  check(!/transcri/i.test(r.texto), 'revisarRascunho devolve o texto ja sem a frase');
  check(r.avisos.some((a) => /tirei a frase/.test(a)), 'e o aviso diz que tirou');
  check(rascunhoPodeSairSozinho(r.avisos), 'e NAO barra o envio automatico');

  /** **As duas metades do prompt:** a regra 6 e a linha colada no pedido, so quando ha audio. */
  const sistema = montarSistemaRascunho({ templates: [], regras: '' });
  check(sistema.includes('A palavra "transcri\u00e7\u00e3o" NUNCA sai no rascunho'),
    'a regra 6 proibe a palavra');

  const agora = new Date('2026-09-12T11:43:00');
  const comAudio = montarContatoRascunho({
    mensagens: [{ de: 'contato', texto: '(\u00e1udio, transcrito automaticamente) bom dia', at: '2026-09-12T11:00:00', transcrito: true }],
    campos: {},
    agora,
  });
  check(comAudio.includes('\u00c1UDIO: para ela, n\u00f3s OUVIMOS'), 'havendo audio, a regra entra no bloco do contato');

  const semAudio = montarContatoRascunho({
    mensagens: [{ de: 'contato', texto: 'bom dia', at: '2026-09-12T11:00:00' }],
    campos: {},
    agora,
  });
  check(!semAudio.includes('\u00c1UDIO: para ela'), 'sem audio, a regra nao entra');
}

grupo('a regra do "NAO REPITA" esta colada no pedido (12/09/2026)');
{
  /**
   * Regra dele, com a print do "Silva pinturas": *"IA se repetindo, ja vi outros casos; esse e o
   * maior sinal de maquina respondendo, repeticao, nao pode acontecer isso"*.
   *
   * O conserto deterministico do caso e a guarda da negativa (pelo invariante, em
   * `templates.ehNegativaDeAjuda`); esta linha cobre a CLASSE. Vai no bloco do CONTATO pela razao
   * de 07/09 -- regra longe do ponto em que o modelo escreve nao e cumprida -- e a conversa inteira
   * esta acima dela, com as nossas falas marcadas NOS, entao o modelo TEM como saber.
   */
  const bloco = montarContatoRascunho({
    mensagens: [{ de: 'contato', texto: 'quero um pix', at: '2026-09-12T10:21:00' }],
    campos: {},
    agora: new Date('2026-09-12T14:22:00'),
  });
  check(bloco.includes('N\u00c3O REPITA o que j\u00e1 dissemos'), 'a regra entra no bloco do contato');
  check(/NOS acima/.test(bloco) || /N\u00d3S acima/.test(bloco), 'e manda ler as falas marcadas NOS');
}

/**
 * ROUPA NAO E MATERIAL, E NAO FORNECEMOS NENHUMA — regra dele (12/09/2026): *"veja se roupas se
 * encaixa na lei eleitoral, se nao ja corte de qualquer maneira quando alguem pedir, pois nao
 * fornecemos nenhuma roupa"*. A lei confirma: Lei 9.504/97, art. 39, § 6o veda distribuir camisetas,
 * bones e brindes.
 *
 * **Medido antes:** camiseta, camisa, colete e bone estavam na lista do MATERIAL, e o prompt mandava
 * pedir o endereco e prometer o repasse a equipe — uma entrega que a lei proibe e que nao existe.
 */
{
  grupo('roupa nao e material: a IA diz que nao temos, sem endereco (12/09/2026)');

  const prompt = montarSistemaRascunho({ templates: [], regras: '', gabinete: '' });
  const linhaDoMaterial = prompt.split('\n').find((l) => /MATERIAL DE CAMPANHA é tudo/.test(l)) || '';
  const listaDoMaterial = prompt.slice(prompt.indexOf(linhaDoMaterial), prompt.indexOf('A lista é exemplo'));
  check(!!linhaDoMaterial, 'a regra do material continua no prompt');
  check(!/camiseta|boné|colete/.test(listaDoMaterial), 'e camiseta, bone e colete SAIRAM da lista do material');
  check(/ROUPA NÃO É MATERIAL, E NÃO FORNECEMOS NENHUMA/.test(prompt), 'a regra da roupa esta no sistema');
  check(/art\. 39, § 6º/.test(prompt), 'com a lei nomeada');
  check(/sem pedir endereço, sem repassar/.test(prompt), 'e sem endereco nem repasse');
  check(!/qual item quer \([^)]*(camiseta|boné)/.test(prompt), 'o exemplo do "ela disse qual item" nao cita roupa');

  /** **Colada no pedido**, so quando ela pediu roupa e ainda nao respondemos. */
  const pediu = montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'quero uma camiseta do capitão' }] });
  check(pediu.includes('ROUPA: ela pediu camiseta'), 'pedido de camiseta leva a regra ao bloco do contato');
  check(!/ENDEREÇO: [^\n]*camiseta/.test(pediu), 'e a regra do endereco nao cita mais camiseta');

  const adesivo = montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'quero uns adesivos' }] });
  check(!adesivo.includes('ROUPA:'), 'pedido de adesivo nao leva a regra da roupa');

  const respondida = montarContatoRascunho({ mensagens: [
    { de: 'contato', texto: 'quero uma camiseta' },
    { de: 'nos', texto: 'Não temos camisetas para enviar.' },
    { de: 'contato', texto: 'ok obrigada' },
  ] });
  check(!respondida.includes('ROUPA:'), 'ja respondida, a regra nao volta (nada de repetir o "nao temos")');

  const clique = montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'Olá! Quero uma camiseta', anuncio: true }] });
  check(!clique.includes('ROUPA:'), 'o texto do anuncio nao conta como pedido dela');

  /** Camisa pedida nao liga mais o sinal do material (a trava enderecoSemMaterial passa a avisar). */
  check(!pedeMaterial([{ texto: 'gostaria de uma camisa da campanha', tipo: 'TEXT', at: 1 }], null),
    '"gostaria de uma camisa da campanha" nao e mais material');
  check(!!pedeRoupa([{ texto: 'gostaria de uma camisa da campanha', tipo: 'TEXT', at: 1 }], null), 'e sim roupa');
}

grupo('a IA nao repete o que acabamos de dizer (15/09/2026)');
{
  /**
   * Relato dele: *"a IA tem agradecido multiplas vezes pelo apoio e dado boa tarde multiplas vezes,
   * uma mensagem apos a outra; ela nao consegue ver o contexto da conversa?"*.
   *
   * **Medido: ela ve.** O bloco do contato manda a conversa inteira com NOS/ELA, marca o que ja foi
   * respondido, a VOZ manda emendar de onde paramos e a regra de 12/09 manda nao repetir — e o
   * rascunho que repetia *"Boa tarde! Obrigado pelo apoio"* saia com **zero avisos**. Pior:
   * `revisarRascunho` CONSERTAVA a saudacao errada, ou seja, deixava a segunda "boa tarde" do dia
   * bem-formada. **Prompt e pedido; o que muda comportamento aqui e o conserto mecanico.**
   */
  const agora = new Date('2026-09-15T14:30:00-03:00');
  const nossa = 'Bom dia! Obrigado de coracao pelo apoio e pela confianca - e isso que sustenta o trabalho.';
  const ctx = { nossaUltima: nossa, jaFalamosHoje: true, jaFalamos: true };

  const r1 = revisarRascunho(
    'Boa tarde! Obrigado pelo apoio e pela confianca. Que bom saber que voce esta divulgando no bairro, isso ajuda demais.',
    agora, ctx);
  check(!/boa tarde/i.test(r1.texto), 'a saudacao repetida no mesmo dia SAI');
  check(!/obrigado pelo apoio/i.test(r1.texto), 'e o agradecimento que ja saiu tambem');
  check(/divulgando no bairro/.test(r1.texto), 'o que era NOVO fica');
  check(r1.texto.startsWith('Que bom'), 'e a frase que sobra comeca com maiuscula');

  /** **Nao sobrando nada, o texto FICA e o aviso barra** — farelo para eleitor e pior. */
  const r2 = revisarRascunho('Boa tarde! Obrigado pelo apoio e pela confianca.', agora, ctx);
  check(/obrigado pelo apoio/i.test(r2.texto), 'rascunho que so repete nao vira farelo');
  check(r2.avisos.includes(AVISOS_QUE_IMPEDEM_ENVIO.sopraRepeticao), 'e o aviso da repeticao aparece');
  check(!rascunhoPodeSairSozinho(r2.avisos), 'e ele NAO sai sozinho');

  /** **Pergunta nunca sai**: perguntar de novo e acao, nao cortesia repetida. */
  const r3 = revisarRascunho('Boa tarde! Voce pode me confirmar o seu endereco completo?', agora, ctx);
  check(/endereco completo\?/.test(r3.texto), 'a pergunta fica');
  check(!/boa tarde/i.test(r3.texto), 'so a saudacao sai');

  /** **O que e novo nao e tocado.** */
  const r4 = revisarRascunho('O Capitao Martim e deputado estadual, e o numero na urna e 10122.', agora, ctx);
  check(r4.texto === 'O Capitao Martim e deputado estadual, e o numero na urna e 10122.', 'conteudo novo passa inteiro');
  check(!r4.avisos.length, 'e sem aviso nenhum');

  /**
   * **Sem contexto nao confere nada** — fora da rodada nao ha conversa medida, e tirar a saudacao
   * por deducao seria decidir sem saber. A correcao antiga continua valendo ali.
   */
  const r5 = revisarRascunho('Bom dia! Obrigado pelo apoio.', agora, {});
  check(/^Boa tarde/.test(r5.texto), 'sem contexto, a saudacao errada continua sendo CORRIGIDA');

  /** **Falamos ONTEM: a saudacao fica** — retomar em outro dia e conversa, nao maquina. */
  const r6 = revisarRascunho('Boa tarde! Obrigado pelo apoio.', agora, { nossaUltima: nossa, jaFalamosHoje: false });
  check(/^Boa tarde/.test(r6.texto), 'de um dia para o outro a saudacao continua');

  // As pecas puras, no detalhe.
  check(semSaudacao('Boa tarde! Tudo certo por aqui.') === 'Tudo certo por aqui.', 'semSaudacao tira e capitaliza');
  check(semSaudacao('Tudo certo por aqui.') === null, 'sem saudacao, devolve null');
  check(semRepetirONosso('Coisa nova aqui na conversa de hoje.', nossa) === null, 'nada repetido, nada sai');
  check(soRepeteONosso('Obrigado pelo apoio e pela confianca.', nossa), 'a repeticao inteira e reconhecida');
  check(!soRepeteONosso('Qual o seu endereco?', nossa), 'pergunta nao conta como repeticao');

  /** **O prompt tambem deixa de convidar a saudacao** — a linha e a SEGUNDA do bloco. */
  const h = (t) => new Date(`2026-09-15T${t}-03:00`).getTime();
  const bloco = montarContatoRascunho({
    mensagens: [
      { de: 'contato', texto: 'bom dia!', at: h('09:00:00') },
      { de: 'nos', texto: nossa, at: h('09:40:00') },
      { de: 'contato', texto: 'amem', at: h('14:20:00') },
    ],
    agora,
  });
  check(/NÃO abra com saudação/.test(bloco), 'falamos hoje: o bloco PROIBE a saudacao');
  check(!/a correta agora é/.test(bloco), 'e nao convida com a saudacao certa');
  const primeiro = montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'oi', at: h('14:20:00') }], agora });
  check(/a correta agora é "Boa tarde"/.test(primeiro), 'primeira fala do dia: a saudacao certa continua dita');
}

grupo('nenhum esquema manda palavra-chave que a API recusa com 400 (16/09/2026)');
{
  /**
   * Relato dele: *"o modo de treino falhou"*. Causa: `minItems: 3` e `maxItems: 3` no esquema do
   * rascunho. As saidas estruturadas da Anthropic aceitam `minItems` so com 0 ou 1 e NAO aceitam
   * `maxItems`, nem restricao de numero (`minimum`, `maximum`, `multipleOf`) nem de tamanho de texto
   * (`minLength`, `maxLength`) — e respondem 400. Os SDKs limpam isso sozinhos; esta extensao usa
   * `fetch` cru e manda literal. **Todo rascunho numa casa Claude falhou por dois dias**, e nada acusou
   * porque o JSON e valido e nenhum teste chama a API.
   *
   * A varredura e sobre os TRES esquemas e as DUAS formas (a original e a estrita da OpenAI), porque o
   * proximo esquema a ganhar uma restricao nao vai ser este.
   */
  const PROIBIDAS = ['maxItems', 'minLength', 'maxLength', 'minimum', 'maximum', 'multipleOf', 'exclusiveMinimum', 'exclusiveMaximum'];
  const acusar = (no, caminho, fora) => {
    if (!no || typeof no !== 'object') return fora;
    for (const [k, v] of Object.entries(no)) {
      if (PROIBIDAS.includes(k)) fora.push(`${caminho}.${k}`);
      if (k === 'minItems' && !(v === 0 || v === 1)) fora.push(`${caminho}.minItems=${v}`);
      if (v && typeof v === 'object') acusar(v, `${caminho}.${k}`, fora);
    }
    return fora;
  };
  const esquemas = {
    decisao: esquemaDaDecisao(['pedir-dados']),
    cidade: esquemaDaCidade(),
    rascunhoTreino: esquemaDoRascunho(3),
    rascunhoAntigo: esquemaDoRascunho(1),
    material: esquemaDoMaterial(),
    etiqueta: esquemaDaEtiqueta(),
  };
  for (const [nome, esq] of Object.entries(esquemas)) {
    const fora = acusar(esq, nome, []);
    check(!fora.length, `"${nome}" sem palavra-chave recusada${fora.length ? ` — achei: ${fora.join(', ')}` : ''}`);
    const estrito = acusar(esquemaEstrito(esq), `${nome}(estrito)`, []);
    check(!estrito.length, `"${nome}" na forma estrita tambem${estrito.length ? ` — achei: ${estrito.join(', ')}` : ''}`);
  }
  /** E a contagem continua valendo, so que no lugar certo: quem corta e `validarRascunho` (uma, desde 18/09). */
  const cinco = JSON.stringify({ opcoes: ['Um.', 'Dois.', 'Tres.', 'Quatro.', 'Cinco.'].map((texto) => ({ texto })) });
  const v5 = validarRascunho(cinco, new Date(), {});
  check(v5.opcoes.length === 1 && v5.texto === 'Um.', 'sem maxItems, quem corta e o codigo — fica a primeira');
}

grupo('a IA ve a midia sem texto e o atendimento anterior (16/09/2026)');
{
  /**
   * Pedido dele: *"creio que o fluxo esta barrando ela de ler o contexto"*. Medido, nao era o fluxo:
   * a conversa vai inteira venha o caso de qualquer caixa. O que cortava era (1) midia sem texto, que
   * sumia, e (2) a SESSAO: quem volta abre atendimento novo e a IA via so o de hoje.
   */
  const agora = new Date('2026-09-16T14:30:00-03:00');
  const h = (t) => new Date(`2026-09-16T${t}-03:00`).getTime();

  check(marcaDeMidia({ tipo: 'IMAGE', texto: '' }) === '(ela mandou uma IMAGEM — o conteúdo não aparece aqui)', 'imagem vira linha');
  check(/FIGURINHA/.test(marcaDeMidia({ tipo: 'STICKER' })), 'figurinha tambem');
  check(/VÍDEO/.test(marcaDeMidia({ tipo: 'VIDEO' })) && /DOCUMENTO/.test(marcaDeMidia({ tipo: 'DOCUMENT' })), 'video e documento tambem');
  check(/ÁUDIO/.test(marcaDeMidia({ tipo: 'AUDIO', texto: '' })), 'audio sem transcricao tambem');
  check(marcaDeMidia({ tipo: 'IMAGE', texto: 'olha isso' }) === '', 'com legenda, vai o texto e nao a marca');
  check(marcaDeMidia({ tipo: 'TEXT', texto: '' }) === '', 'texto vazio sem tipo de midia nao inventa linha');
  check(/não chegou legível/.test(marcaDeMidia({ tipo: 'AUDIO', sistema: true })), 'aviso da plataforma vira "nao chegou legivel"');

  const comMidia = montarContatoRascunho({
    mensagens: [
      { de: 'contato', texto: marcaDeMidia({ tipo: 'IMAGE' }), semConteudo: true, at: h('14:00:00') },
      { de: 'contato', texto: 'olha isso', at: h('14:01:00') },
    ],
    agora,
  });
  check(/ela mandou uma IMAGEM/.test(comMidia), 'a imagem aparece na conversa que ela le');
  check(/MÍDIA:/.test(comMidia) && /NUNCA diga\s+que não viu/.test(comMidia.replace(/\s+/g, ' ')), 'e a regra proibe dizer que nao viu');
  check(!/MÍDIA:/.test(montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'oi' }], agora })), 'sem midia, sem a regra');

  /** **O audio transcrito liga a regra do audio** — o painel jogava `transcrito` fora e ela nunca ligava. */
  check(/ÁUDIO: para ela, nós OUVIMOS/.test(montarContatoRascunho({
    mensagens: [{ de: 'contato', texto: '(áudio, transcrito automaticamente) oi', transcrito: true }], agora,
  })), 'com `transcrito`, a regra do audio entra');

  const anterior = [
    { de: 'contato', texto: 'sou de Canoas e quero adesivo', at: new Date('2026-08-20T10:00:00-03:00').getTime() },
    { de: 'nos', texto: 'Anotado!', at: new Date('2026-08-20T10:05:00-03:00').getTime() },
  ];
  const b = montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'oi de novo', at: h('14:00:00') }], agora, anterior });
  check(/ATENDIMENTO ANTERIOR — já encerrado/.test(b), 'o atendimento anterior entra em bloco proprio');
  check(b.indexOf('ATENDIMENTO ANTERIOR') < b.indexOf('A conversa inteira'), 'e ANTES da conversa de hoje');
  const trecho = b.slice(b.indexOf('ATENDIMENTO ANTERIOR'), b.indexOf('— fim do atendimento anterior —'));
  check(/sou de Canoas/.test(trecho) && !/SEM RESPOSTA/.test(trecho), 'as falas antigas vao SEM a marca de pendente');
  check(!/ATENDIMENTO ANTERIOR/.test(montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'oi' }], agora })), 'sem anterior, sem bloco');

  const muitas = Array.from({ length: 80 }, (_, i) => ({ de: 'contato', texto: `fala ${i} ${'x'.repeat(2000)}` }));
  const cortado = montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'oi' }], agora, anterior: muitas });
  check(!/fala 49 /.test(cortado) && /fala 50 /.test(cortado) && /fala 79 /.test(cortado), `so as ultimas ${ANTERIOR_MAX_FALAS} falas vao`);
  check(!new RegExp(`x{${ANTERIOR_MAX_CARACTERES + 1}}`).test(cortado), `e cada uma cortada em ${ANTERIOR_MAX_CARACTERES} caracteres`);
}

grupo('a IA confere a etiqueta de material antes de marcar (16/09/2026)');
{
  /**
   * Pedido dele: *"quando o deterministico identificar material, a IA assume e confere se realmente e
   * uma situacao de pedido de material para entao etiquetar"*. A etiqueta manda PULAR para sempre, entao
   * o que esta suite protege e o lado de NAO marcar: so `material` com certeza marca; `nao`, ilegivel,
   * fora das opcoes e certeza baixa viram "nao marca".
   */
  check(validarMaterial(JSON.stringify({ acao: 'material', motivo: 'pediu adesivos', confianca: 0.9 })).acao === 'material',
    'material com certeza alta marca');
  check(validarMaterial({ acao: 'material', motivo: 'x', confianca: CONFIANCA_MATERIAL - 0.01 }).acao === 'incerto',
    'material com certeza baixa NAO marca');
  check(validarMaterial({ acao: 'nao', motivo: 'conteudo digital', confianca: 0.4 }).acao === 'nao',
    '"nao" vale com qualquer certeza — e o lado seguro');
  check(validarMaterial('isto nao e json').acao === 'incerto', 'resposta ilegivel nao marca');
  check(validarMaterial({ acao: 'talvez', confianca: 1 }).acao === 'incerto', 'opcao inventada nao marca');
  check(validarMaterial(null).acao === 'incerto', 'nada nao marca');

  const sistema = montarSistemaMaterial({});
  for (const trecho of ['conteúdo DIGITAL', 'roupa', 'cadeira de rodas', 'reclamação de rua', 'Na dúvida, "nao"', '(texto do ANÚNCIO…)']) {
    check(sistema.includes(trecho), `o prompt da conferencia fala de: ${trecho}`);
  }
  check(/Instruções adicionais do Thiago/.test(montarSistemaMaterial({ regras: 'x' })), 'as instrucoes extras dele entram');

  const bloco = montarContatoMaterial({
    mensagens: [{ de: 'contato', texto: 'quero uns adesivos' }],
    gatilho: 'a resposta pronta que acabou de sair pede o endereco',
    acabamosDeMandar: 'Mande seu endereco que repassamos a equipe.',
  });
  check(/O que o programa viu: a resposta pronta/.test(bloco), 'o gatilho vai no bloco');
  check(/NÓS \(agora\): Mande seu endereco/.test(bloco), 'e a nossa mensagem que acabou de sair tambem — ela ainda nao esta na conversa');
  check(bloco.indexOf('quero uns adesivos') < bloco.indexOf('NÓS (agora)'), 'depois da conversa, na ordem');

  const req = montarRequisicaoMaterial({ sistema: 's', contato: 'c' });
  check(req.output_config.format.schema.properties.acao.enum.join() === 'material,nao', 'o esquema so tem as duas saidas');
}

grupo('"como esta o capitao?" e carinho: ele esta bem e na correria (17/09/2026)');
{
  /**
   * Relato dele: as tres opcoes responderam que nao sabem. *"a resposta deveria ser enrolar dizendo que
   * esta bem e na correria por causa das eleicoes; se tiver um acontecimento eu ponho no dossie ou nas
   * instrucoes extras"*. Causa: a regra 4 + a secao 20 do documento dele lidas ao pe da letra.
   */
  for (const f of [
    'Como está o capitão?',
    'E aí, como tá o Capitão Martim?',
    'como vai o nosso deputado',
    'Como anda o Martim hoje?',
    'O capitão está bem?',
    'tudo bem com o Capitão?',
    'Boa tarde! Como está o capitão, de saúde?',
  ]) check(perguntaComoEleEsta(f), `pergunta pelo estado dele: "${f}"`);

  for (const f of [
    'Como está o capitão nas pesquisas?',
    'como vai o deputado votar nesse projeto?',
    'como está a campanha?',
    'como você está?',
    'o capitão está bem colocado',
    'como ele está?',
    'Estou bem, obrigado capitão',
    'como faço para falar com o capitão?',
    '',
  ]) check(!perguntaComoEleEsta(f), `nao e pergunta pelo estado dele: "${f}"`);

  const sistema = montarSistemaRascunho({});
  check(/EXCEÇÃO: perguntar COMO ELE ESTÁ/.test(sistema), 'a excecao esta na regra 4 do sistema');
  check(/nunca "não sei"/.test(sistema), 'e proibe o "nao sei"');

  const com = montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'Como está o capitão?' }] });
  check(/COMO ELE ESTÁ:/.test(com), 'a regra vai colada no pedido quando ela pergunta');
  check(/está bem e na\s+correria da campanha/.test(com.replace(/\s+/g, ' ')), 'com a resposta que ele quer');
  check(/notícia dele/.test(com), 'e a noticia do dossie ou das instrucoes vence');
  const respondida = montarContatoRascunho({
    mensagens: [{ de: 'contato', texto: 'Como está o capitão?' }, { de: 'nos', texto: 'Está bem, na correria!' }, { de: 'contato', texto: 'que bom' }],
  });
  check(!/COMO ELE ESTÁ:/.test(respondida), 'ja respondida, a linha nao entra de novo');
  check(!/COMO ELE ESTÁ:/.test(montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'como está a campanha?' }] })),
    'sem a pergunta, nada entra');
}

grupo('a IA confere as etiquetas de PEDIDO e SEM INTERESSE antes de marcar (17/09/2026)');
{
  /**
   * Relato dele: *"o deterministico esta botando etiqueta antes da IA confirmar qualquer coisa"*. Medido:
   * a de material ja passava pela IA; estas duas saiam so pelo detector de texto.
   */
  const pedido = montarSistemaEtiqueta({ tipo: 'pedido' });
  const semInt = montarSistemaEtiqueta({ tipo: 'seminteresse', regras: 'regra extra dele' });
  check(/"PEDIU DINHEIRO OU EMPREGO"/.test(pedido), 'o prompt do pedido nomeia a etiqueta');
  check(/crítica ou opinião política/.test(pedido), 'e o falso positivo mais caro: dinheiro em critica politica (a Elenir)');
  check(/voluntária, sem pagamento/.test(pedido), 'voluntaria nao e pedido de emprego');
  check(/"SEM INTERESSE"/.test(semInt) && /SEM responder nada/.test(semInt), 'o de sem interesse diz que conclui sem responder');
  check(/ADVERSÁRIO \(PT, Lula, esquerda\)/.test(semInt), 'e que xingar o adversario e estar do nosso lado');
  check(/recusar ir a um EVENTO/.test(semInt), 'e que recusar evento nao e recusar a campanha');
  check(/Na dúvida, "nao"/.test(pedido) && /Na dúvida, "nao"/.test(semInt), 'na duvida, nao marca');
  check(/regra extra dele/.test(semInt), 'as instrucoes dele entram');
  check(montarSistemaEtiqueta({ tipo: 'inventado' }) === '', 'tipo desconhecido nao monta prompt');
  check(Object.keys(TIPOS_DE_ETIQUETA).sort().join() === 'pedido,seminteresse', 'material continua na conferencia propria');

  const req = montarRequisicaoEtiqueta({ sistema: 's', contato: 'c' });
  check(req.output_config.format.schema.properties.acao.enum.join() === 'sim,nao', 'o esquema so tem sim e nao');

  const j = (o) => JSON.stringify(o);
  check(validarEtiqueta(j({ acao: 'sim', motivo: 'pediu PIX', confianca: 0.9 })).acao === 'sim', 'sim com certeza marca');
  check(validarEtiqueta(j({ acao: 'sim', motivo: 'talvez', confianca: CONFIANCA_ETIQUETA - 0.01 })).acao === 'incerto', 'sim com pouca certeza NAO marca');
  check(validarEtiqueta(j({ acao: 'nao', motivo: 'critica politica', confianca: 0.3 })).acao === 'nao', 'nao vale com qualquer certeza');
  check(validarEtiqueta('isto nao e json').acao === 'incerto', 'ilegivel nao marca');
  check(validarEtiqueta(j({ acao: 'talvez' })).acao === 'incerto', 'resposta fora das opcoes nao marca');
  check(validarEtiqueta(null).acao === 'incerto', 'vazio nao marca');
}

grupo('saude nao se despacha: a excecao da regra 11 (17/09/2026)');
{
  /**
   * Relato dele: uma pessoa chegou pedindo ajuda por estar doente, a IA despachou para o posto de saude
   * e *"as 3 respostas estavam iguais"*. A causa e a regra 11 (dele, a Irema 10/09), que manda acolher em
   * uma frase, dizer onde se resolve e PARAR, sem perguntas sobre o caso.
   */
  const sistema = montarSistemaRascunho({});
  check(/EXCEÇÃO — SAÚDE/.test(sistema), 'a excecao esta no sistema');
  const linhas11 = sistema.split('\n');
  const regra11 = linhas11.findIndex((l) => /^11\. NÃO SOMOS UM CANAL/.test(l));
  const excecao = linhas11.findIndex((l) => /EXCEÇÃO — SAÚDE/.test(l));
  check(regra11 >= 0 && excecao > regra11 && excecao - regra11 <= 10, 'e COLADA na regra que ela excepciona');

  const doente = montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'Boa tarde, estou doente e preciso de ajuda' }] });
  const l = doente.split('\n');
  const iCanal = l.findIndex((x) => x.startsWith('NÃO SOMOS CANAL'));
  const iSaude = l.findIndex((x) => x.startsWith('SAÚDE — EXCEÇÃO'));
  check(iCanal >= 0 && iSaude === iCanal + 1, 'no bloco do contato a excecao vem logo depois da regra');
  check(/PERGUNTE o que está acontecendo/.test(doente), 'e manda perguntar o que ela tem');
  check(/NÃO mande posto de saúde, UPA, CRAS/.test(doente), 'e proibe o despacho nesta mensagem');
  check(/"não podemos" vem DEPOIS/.test(doente), 'a negativa vem depois de ela contar');

  check(!/SAÚDE — EXCEÇÃO/.test(montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'preciso de ajuda com o aluguel' }] })),
    'pedido de dinheiro sem doenca continua sem a excecao — ele disse que ali pode descartar rapido');
  check(!/SAÚDE — EXCEÇÃO/.test(montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'a saude publica e um caos' }] })),
    'fala politica sobre saude nao abre a excecao');
  /** A doenca de ontem continua valendo hoje: a excecao le a conversa inteira, nao so a rajada. */
  check(/SAÚDE — EXCEÇÃO/.test(montarContatoRascunho({
    mensagens: [
      { de: 'contato', texto: 'minha mae esta internada' },
      { de: 'nos', texto: 'Sentimos muito.' },
      { de: 'contato', texto: 'obrigada' },
    ],
  })), 'a excecao vale na conversa inteira');
}

grupo('o CRAS nao e para todo mundo que fala de dinheiro (17/09/2026)');
{
  /**
   * Regra dele: *"a IA nao esta identificando quando realmente a pessoa precisa ir pro CRAS ou
   * assistencia social; muitas pedem dinheiro sem esclarecer que realmente estao com dificuldades"* — e
   * *"novamente as 3 respostas sao iguais"*: obrigada a citar o CRAS, a IA escreve a mesma mensagem tres
   * vezes.
   */
  const pix = montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'faz um pix pra mim por favor' }] });
  check(/DINHEIRO — O CRAS NÃO É PARA TODO MUNDO/.test(pix), 'a regra entra quando ela pede dinheiro');
  check(/só aponte CRAS, assistência social, Cadastro Único ou Defensoria se ELA DISSER a dificuldade/.test(pix.replace(/\s+/g, ' ')),
    'e condiciona o encaminhamento a ela dizer a dificuldade');
  check(/diga em UMA frase gentil que o mandato não pode fazer isso e PARE/.test(pix.replace(/\s+/g, ' ')), 'sem dificuldade dita, nega e para');
  check(!/DINHEIRO —/.test(montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'bom dia, tudo bem?' }] })),
    'quem nao pediu dinheiro nao recebe a regra');
  /** Dificuldade dita + dinheiro: a regra entra e e ela que AUTORIZA o CRAS. */
  const dificuldade = montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'estou desempregada com tres filhos e preciso de dinheiro para comida' }] });
  check(/DINHEIRO —/.test(dificuldade), 'com dificuldade dita a regra tambem entra — e la ela permite o CRAS');

}

grupo('a janta pela campanha nao recebe CRAS (17/09/2026)');
{
  const janta = montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'Vou fazer uma janta para a campanha, voces participam com a comida?' }] });
  check(/APOIO COM EVENTO — NÃO É PEDIDO DE AJUDA/.test(janta), 'a regra do apoio com evento entra');
  check(/NADA de CRAS, assistência social, Cadastro Único/.test(janta), 'e proibe o CRAS com todas as letras');
  check(/a campanha não entra com comida, bebida, som nem custo/.test(janta.replace(/\s+/g, ' ')), 'e diz o que responder');
  check(/repassa o convite para a equipe da agenda/.test(janta), 'o repasse do convite e a unica promessa que cabe');
  check(!/NÃO SOMOS CANAL/.test(janta), 'e a regra 11 NAO entra: apoio nao e problema pessoal');
  check(!/DINHEIRO —/.test(janta), 'nem a regra do dinheiro');
  check(/NÃO SOMOS CANAL/.test(montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'faz um pix pra mim' }] })),
    'quem pede dinheiro de verdade continua com a regra 11');
}

grupo('o gpt-5.6-luna entra como modelo da OpenAI que raciocina (18/09/2026)');
{
  check(provedorDoModelo('gpt-5.6-luna') === PROVEDOR_OPENAI, 'vai para a OpenAI, com a chave que ja existe');
  const r = montarRequisicaoRascunho({ sistema: 'S', contato: 'C', modelo: 'gpt-5.6-luna' });
  check(r.reasoning_effort === 'medium' && r.max_completion_tokens === 8192 && r.max_tokens === undefined,
    'recebe reasoning_effort e o teto no nome novo, como a familia GPT-5');
  check(PRECOS_USD_POR_MTOK['gpt-5.6-luna'].entrada === 0.2 && PRECOS_USD_POR_MTOK['gpt-5.6-luna'].saida === 1.2,
    'com o preco da pagina oficial');
  check(CACHE_MINIMO_TOKENS['gpt-5.6-luna'] === 1024, 'e o minimo de cache da OpenAI');
}

fim();
