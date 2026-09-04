/**
 * Testa as etiquetas: região pelo COREDE, conteúdo pelas regras de texto, apelidos e — o mais
 * importante — a união ao aplicar, que é o que impede apagar etiquetas que o contato já tinha.
 *
 * Rode: node tests/tags.test.mjs
 */

import { readFileSync } from 'node:fs';
import { check, grupo, fim, lib, mem } from './_harness.mjs';

const tags = await lib('tags.js');
const api = await lib('api.js');

/** Etiquetas reais do CRM (rótulo vem em `message`), reduzidas ao que interessa aqui. */
const TAGS_CRM = [
  { id: 't-zucco', message: 'Conteúdo Zucco', active: true },
  { id: 't-flavio', message: 'Conteúdo Flávio', active: true },
  { id: 't-metro', message: 'Metropolitano Delta do Jacuí', active: true },
  { id: 't-missoes', message: 'Missões', active: true },
  { id: 't-centrosul', message: 'Centro Sul', active: true },
  { id: 't-paranhana', message: 'Vale do Paranhana', active: true },
  { id: 't-inativa', message: 'Etiqueta desativada', active: false },
  { id: 't-outra', message: 'Interesse em Apoiar', active: true },
];

const chamadas = [];

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  chamadas.push({ url: u, method: init.method || 'GET', body: init.body });
  if (u.includes('/core/v1/tag')) {
    return { ok: true, status: 200, text: async () => JSON.stringify(TAGS_CRM) };
  }
  return { ok: true, status: 200, text: async () => '{}' };
};

// O transporte real (fetch) é o que roda dentro da aba do mobiliza; aqui o fetch está stubado
// acima, então testamos exatamente o caminho que a aba executa.
api.setTransport(api.createFetchTransport(() => 'Bearer fake'));

const dados = JSON.parse(
  readFileSync(new URL('../src/data/coredes-rs.json', import.meta.url), 'utf8')
);
tags.setCoredeLoader(async () => dados);

grupo('dados oficiais de COREDE');
check(dados._municipios === 497, `municípios na tabela = ${dados._municipios}`);
check((await tags.coredeFor('Porto Alegre')) === 'Metropolitano Delta do Jacuí', 'Porto Alegre → Metropolitano Delta do Jacuí');
check((await tags.coredeFor('Santo Ângelo')) === 'Missões', 'Santo Ângelo → Missões');
check((await tags.coredeFor('sto angelo')) === 'Missões', 'abreviação e falta de acento também acham o COREDE');
check((await tags.coredeFor('Curitiba')) === null, 'município de fora do RS não inventa COREDE');

grupo('resolução do nome contra as etiquetas reais do CRM');
check((await tags.resolveTag('Metropolitano Delta do Jacuí'))?.id === 't-metro', 'nome exato');
check((await tags.resolveTag('Centro-Sul'))?.id === 't-centrosul', 'planilha diz "Centro-Sul", CRM diz "Centro Sul"');
check((await tags.resolveTag('Paranhana Encosta da Serra'))?.id === 't-paranhana', 'apelido padrão resolve Paranhana');
check((await tags.resolveTag('Etiqueta desativada')) === null, 'etiqueta inativa é ignorada');
check((await tags.resolveTag('Região Inexistente')) === null, 'nome sem etiqueta devolve null, não chuta');

grupo('sugestão para o caso do print');
{
  const sug = await tags.suggest({
    city: 'Porto Alegre',
    texts: ['Olá! Eu aceito receber conteúdos do Zucco e do Cap Martim.'],
  });
  const regiao = sug.find((s) => s.origem === 'região');
  const conteudo = sug.find((s) => s.origem === 'conteúdo');
  const cidadeSug = sug.find((s) => s.origem === 'cidade');
  check(regiao?.tag?.id === 't-metro', `região = ${regiao?.nome} (${regiao?.tag?.label})`);
  check(conteudo?.tag?.id === 't-zucco', `conteúdo = ${conteudo?.nome}`);
  // A etiqueta de CIDADE entrou em 20/08/2026: até então só a varredura em massa a aplicava, e
  // todo contato novo nascia sem ela.
  check(!!cidadeSug, 'a etiqueta de cidade também é sugerida');
  check(cidadeSug?.nome === 'PORTO ALEGRE', `nome da etiqueta de cidade = ${cidadeSug?.nome}`);
  check(sug.length === 3, `três sugestões: cidade, região e conteúdo = ${sug.length}`);
}

grupo('sugestão para conteúdo do Flávio');
{
  const sug = await tags.suggest({
    city: 'Santo Ângelo',
    texts: ['Aceito receber conteúdo do Flávio Bolsonaro'],
  });
  check(sug.find((s) => s.origem === 'conteúdo')?.tag?.id === 't-flavio', 'etiqueta Conteúdo Flávio');
  check(sug.find((s) => s.origem === 'região')?.tag?.id === 't-missoes', 'etiqueta Missões');
}

grupo('cidade nao reconhecida NAO gera etiqueta de cidade');
{
  // A trava aqui é a mesma da varredura: cidade que não casa com a planilha não vira etiqueta,
  // porque o campo é texto livre e "não sei" viraria etiqueta permanente no CRM.
  const sug = await tags.suggest({ city: 'Cidade Que Não Existe', texts: [] });
  check(!sug.some((s) => s.origem === 'cidade'), 'nenhuma sugestão de cidade');
}

grupo('cityTagIds: so etiqueta que e nome de municipio');
{
  const ids = await tags.cityTagIds();
  // O CRM de teste tem etiquetas de COREDE e de conteúdo, nenhuma com nome de município.
  check(ids.size === 0, `nenhuma etiqueta de cidade no CRM de teste = ${ids.size}`);
  check(!ids.has('t-metro'), 'COREDE não é confundido com cidade');
  check(!ids.has('t-zucco'), 'etiqueta de conteúdo também não');
}

grupo('cidade fora da tabela avisa em vez de etiquetar errado');
{
  const sug = await tags.suggest({ city: 'Cidade Que Não Existe', texts: ['zucco'] });
  const regiao = sug.find((s) => s.origem === 'região');
  check(regiao && regiao.tag === null && /não está na tabela oficial/.test(regiao.motivo), `motivo = ${regiao?.motivo}`);
}

grupo('regra com regex inválida não derruba a sugestão');
{
  mem.tagRules = [{ padrao: '[', etiqueta: 'Qualquer' }, { padrao: 'zucco', etiqueta: 'Conteúdo Zucco' }];
  const sug = await tags.suggest({ city: '', texts: ['zucco'] });
  check(sug.length === 1 && sug[0].tag?.id === 't-zucco', 'ignorou a regra inválida e manteve a boa');
  delete mem.tagRules;
}

grupo('applyTags SOMA às etiquetas existentes');
{
  mem.writeContract = {
    entries: [
      {
        type: 'TAGS',
        method: 'PUT',
        url: 'https://api.mobiliza.app/core/v1/contact/{{contactId}}/tag',
        bodyShape: { tagsId: ['t-outra'] },
        paths: { value: 'tagsId[0]', valueIsArrayItem: true, contactId: null, fieldId: null },
        learnedFieldId: 'campo-etiquetas',
      },
    ],
  };

  chamadas.length = 0;
  const contato = { id: 'c-1', tagsId: ['t-outra'] };
  const r = await tags.applyTags(contato, ['t-metro', 't-zucco']);
  const enviada = chamadas.find((c) => c.method === 'PUT');
  const corpo = JSON.parse(enviada.body);

  check(r.ok, 'gravou');
  check(enviada.url.includes('c-1'), `contato certo na URL = ${enviada.url}`);
  check(corpo.tagsId.includes('t-outra'), 'etiqueta que o contato já tinha foi preservada');
  check(corpo.tagsId.includes('t-metro') && corpo.tagsId.includes('t-zucco'), 'novas etiquetas entraram');
  check(corpo.tagsId.length === 3, `sem duplicar = ${JSON.stringify(corpo.tagsId)}`);
}

grupo('conteúdo que já está no contato conta como identificado');
{
  // Relato: "Etiqueta de conteúdo do Flávio marcada e a mensagem rápida não reconhece e trava o
  // botão". `suggest()` só enxerga o que as REGRAS acham nas mensagens — etiqueta aplicada à
  // mão (ou aplicada por nós numa passada anterior, quando a campanha do anúncio ainda casava)
  // era invisível, e o botão de fechar com conteúdo contava zero.
  mem.tagRules = [{ padrao: 'zucco', etiqueta: 'Conteúdo Zucco' }, { padrao: 'fl[áa]vio', etiqueta: 'Conteúdo Flávio' }];

  const comFlavio = await tags.conteudosJaAplicados({ id: 'c-1', tagsId: ['t-flavio', 't-metro', 't-outra'] });
  check(comFlavio.length === 1, `achou um conteúdo = ${JSON.stringify(comFlavio.map((c) => c.nome))}`);
  check(comFlavio[0].nome === 'Conteúdo Flávio' && comFlavio[0].tag.id === 't-flavio', 'e é o do Flávio');
  check(comFlavio[0].origem === 'conteúdo', 'entra como conteúdo');

  // O que NÃO pode entrar: região e etiqueta de fluxo não são conteúdo.
  check(
    !comFlavio.some((c) => ['Metropolitano Delta do Jacuí', 'Interesse em Apoiar'].includes(c.nome)),
    'região e etiqueta solta ficam de fora'
  );

  // A tabela "Modelo por conteúdo" também identifica conteúdo, mesmo sem regra de texto.
  mem.tagRules = [];
  const porMapa = await tags.conteudosJaAplicados({ id: 'c-1', tagsId: ['t-zucco'] }, { 'conteúdo zucco': 'Modelo Zucco' });
  check(porMapa.length === 1 && porMapa[0].nome === 'Conteúdo Zucco', `pelo mapeamento = ${porMapa[0]?.nome}`);

  check((await tags.conteudosJaAplicados({ id: 'c-1', tagsId: [] })).length === 0, 'contato sem etiqueta devolve vazio');
  check((await tags.conteudosJaAplicados(null)).length === 0, 'sem contato não estoura');
}

grupo('troca de região: a etiqueta do COREDE antigo SAI');
{
  // A pessoa informou outra cidade. Duas etiquetas de região no mesmo contato é informação
  // errada — só uma pode estar certa. Só saem etiquetas que são COREDE de verdade.
  chamadas.length = 0;
  const contato = { id: 'c-1', tagsId: ['t-missoes', 't-zucco', 't-outra'] };
  const r = await tags.applyTags(contato, ['t-metro'], { remover: ['t-missoes'] });
  const corpo = JSON.parse(chamadas.find((c) => c.method === 'PUT').body);

  check(r.ok, 'gravou');
  check(!corpo.tagsId.includes('t-missoes'), 'o COREDE antigo saiu');
  check(corpo.tagsId.includes('t-metro'), 'o COREDE novo entrou');
  check(corpo.tagsId.includes('t-zucco') && corpo.tagsId.includes('t-outra'), 'conteúdo e o resto ficaram');

  // A trava que impede a remoção de engolir a etiqueta que também está entrando.
  chamadas.length = 0;
  const igual = await tags.applyTags(
    { id: 'c-2', tagsId: ['t-metro', 't-zucco'] },
    ['t-metro'],
    { remover: ['t-metro', 't-missoes'] }
  );
  check(igual.ok && igual.skipped, 'remover e aplicar a MESMA etiqueta não mexe em nada');
}

grupo('regionTagIds só devolve COREDE');
{
  const ids = await tags.regionTagIds();
  check(ids.has('t-missoes') && ids.has('t-metro'), 'os COREDEs estão lá');
  check(ids.has('t-paranhana'), 'COREDE que só casa pelo apelido também entra');
  check(!ids.has('t-zucco') && !ids.has('t-outra'), 'etiqueta de conteúdo e de fluxo ficam de fora');
}

grupo('"sim" à pergunta de interesse');
{
  const sim = (t) => tags.respostaAfirmativa([t]);

  check(sim('sim'), '"sim"');
  check(sim('Sim!'), 'com pontuação e maiúscula');
  check(sim('quero sim'), '"quero sim"');
  check(sim('pode mandar'), '"pode mandar"');
  check(sim('Claro'), '"claro"');

  check(!sim('não'), '"não" não é sim');
  check(!sim('nao quero'), '"nao quero" também não');
  check(!sim('sim, mas não quero receber nada'), 'negação na própria resposta vence o "sim"');
  check(!sim('bom dia, tudo bem com vocês?'), 'saudação não é resposta');

  // Desde que a pergunta pede nome e cidade junto, a resposta esperada é LONGA — e muitas
  // vezes traz um "não" legítimo mais à frente, respondendo a outra parte do formulário.
  // A decisão sai da cabeça da mensagem, por isso estes dois são aceite.
  check(sim('Sim / Maria Silva / Palmares do Sul'), 'sim com nome e cidade no formato pedido');
  check(sim('Sim, Maria Silva, Palmares do Sul'), 'o mesmo com vírgula');
  check(
    sim('Sim\nMaria Silva\nPalmares do Sul\nNão faço parte de nenhum grupo político'),
    'o "não" de outra pergunta não derruba o aceite'
  );
  check(sim('sim eu moro em Pelotas e trabalho na prefeitura desde 2019'), 'resposta comprida ainda é sim');
  check(!sim('não, obrigado. já recebo pelo grupo da minha cidade'), 'e a recusa comprida continua recusa');

  // Só a ÚLTIMA mensagem conta: "sim" dito lá atrás não autoriza etiqueta nenhuma.
  check(tags.respostaAfirmativa(['sim', 'na verdade não, obrigado']) === false, 'a última mensagem é que vale');
  check(tags.respostaAfirmativa(['bom dia', 'sim']) === true, 'e ela pode ser a resposta');
  check(!tags.respostaAfirmativa([]), 'sem mensagem não há sim');
}

grupo('a etiqueta do "sim" só sai se a pergunta tiver sido feita');
{
  mem.tagRules = [];
  const etiquetas = ['Conteúdo Zucco'];

  const semPergunta = await tags.suggest({
    texts: ['sim'],
    interesse: { perguntado: false, etiquetas },
  });
  check(!semPergunta.length, 'sem a pergunta enviada, "sim" não etiqueta ninguém');

  const comPergunta = await tags.suggest({
    texts: ['sim'],
    interesse: { perguntado: true, etiquetas },
  });
  check(comPergunta.length === 1 && comPergunta[0].tag?.id === 't-zucco', `etiquetou = ${comPergunta[0]?.nome}`);
  check(comPergunta[0].origem === 'conteúdo', 'entra como conteúdo, então vira modelo na próxima passada');

  const recusou = await tags.suggest({
    texts: ['não, obrigado'],
    interesse: { perguntado: true, etiquetas },
  });
  check(!recusou.length, 'quem disse não não é etiquetado');
}

grupo('applyTags não faz requisição quando não há o que somar');
{
  chamadas.length = 0;
  const r = await tags.applyTags({ id: 'c-1', tagsId: ['t-metro'] }, ['t-metro']);
  check(r.ok && r.skipped, 'marcou como skipped');
  check(!chamadas.some((c) => c.method === 'PUT'), 'nenhuma escrita disparada');
}

grupo('sem contrato aprendido, recusa em vez de tentar');
{
  delete mem.writeContract;
  const r = await tags.applyTags({ id: 'c-1', tagsId: [] }, ['t-metro']);
  check(!r.ok && /Aprender etiquetas/.test(r.error), `erro = ${r.error}`);
}


grupo('regra de conteudo casa com e sem acento');
{
  // Relato dele (31/08): "a extensao esta com dificuldade pra pegar se for por alguma palavra
  // chave". Metade do motivo era o acento: /anuncio/i nao casa com "anuncio" acentuado, e
  // /anúncio/i nao casa com o sem acento. Quem escreve no WhatsApp acentua quando da.
  mem.tagRules = [{ padrao: 'anuncio', etiqueta: 'Conteúdo Zucco' }];
  const semAcentoNaRegra = await tags.suggest({ texts: ['vi o anúncio de voces'] });
  check(semAcentoNaRegra.some((s) => s.origem === 'conteúdo'), 'regra sem acento pega texto COM acento');

  mem.tagRules = [{ padrao: 'anúncio', etiqueta: 'Conteúdo Zucco' }];
  const comAcentoNaRegra = await tags.suggest({ texts: ['vi o anuncio de voces'] });
  check(comAcentoNaRegra.some((s) => s.origem === 'conteúdo'), 'regra COM acento pega texto sem acento');

  // Maiuscula ja funcionava e continua.
  mem.tagRules = [{ padrao: 'anuncio', etiqueta: 'Conteúdo Zucco' }];
  const caixa = await tags.suggest({ texts: ['VI O ANÚNCIO'] });
  check(caixa.some((s) => s.origem === 'conteúdo'), 'caixa alta tambem');

  // E o que NAO tem a palavra continua de fora.
  const nada = await tags.suggest({ texts: ['bom dia, tudo bem?'] });
  check(!nada.some((s) => s.origem === 'conteúdo'), 'texto sem a palavra nao etiqueta');

  // Regex de verdade continua funcionando como regex.
  mem.tagRules = [{ padrao: 'fl[áa]vio', etiqueta: 'Conteúdo Flávio' }];
  const regex = await tags.suggest({ texts: ['quero o conteudo do Flavio'] });
  check(regex.some((s) => s.origem === 'conteúdo'), 'regex com classe de caractere continua valendo');

  mem.tagRules = [];
}


grupo('quem chega por anuncio ganha a etiqueta de anuncio');
{
  // Pedido dele (31/08), com a print do bloco "ANUNCIO | FACEBOOK": "se reconhecer o que esta na
  // print e adicionar a etiqueta ADS resolve tudo". A plataforma diz isso em dado estruturado --
  // utm.source e utm.referralUrl na sessao -- entao nao ha texto a adivinhar.
  mem.etiquetaAnuncio = 'ADS';
  mem.tagRules = [];

  const doAnuncio = await tags.suggest({ texts: ['Olá!'], veioDeAnuncio: true });
  const ads = doAnuncio.find((x) => x.nome === 'ADS');
  check(!!ads, 'sugeriu a etiqueta do anuncio');
  /**
   * **A ADS e ORIGEM, nunca conteudo** — decisao dele (02/09/2026): *"o conteudo a ser mandado
   * nao deve ser decidido pelo ads, e sim pelo texto do ads"*.
   *
   * Ela entrava como conteudo, marcada para perder de qualquer tema de verdade. Era
   * meia medida: quem chegava por anuncio e nao dizia mais nada continuava com a ADS decidindo
   * o modelo, e ADS diz que veio de anuncio e nao de QUAL. Print da Vera: anuncio das Escolas
   * Civico-Militares, e a caixa oferecendo "Campanha Martim" porque a Config mapeia ADS para
   * ele -- o modelo saiu da ORIGEM.
   *
   * Esta assercao e a trava: se a ADS voltar a ser conteudo, ela volta a escolher modelo.
   */
  check(ads?.origem === 'anúncio', 'entra como ORIGEM, nao como conteudo (origem = ' + ads?.origem + ')');

  // O que decide o modelo e a lista de conteudos; a ADS nao pode estar nela.
  const comoConteudo = doAnuncio.filter((x) => x.origem === 'conteúdo');
  check(!comoConteudo.some((x) => x.nome === 'ADS'), 'e nao entra na lista que escolhe o modelo');
  check(/an[úu]ncio/.test(ads?.motivo || ''), 'o motivo diz de onde veio = ' + ads?.motivo);

  const semAnuncio = await tags.suggest({ texts: ['Olá!'], veioDeAnuncio: false });
  check(!semAnuncio.some((x) => x.nome === 'ADS'), 'quem nao veio de anuncio nao recebe');

  // Vazio na Config = nao etiqueta ninguem por essa via.
  mem.etiquetaAnuncio = '';
  const desligado = await tags.suggest({ texts: ['Olá!'], veioDeAnuncio: true });
  check(!desligado.some((x) => x.origem === 'conteúdo'), 'campo vazio nao etiqueta');

  mem.etiquetaAnuncio = 'ADS';
}

grupo('a etiqueta de anuncio NAO volta como conteudo pelo CRM (02/09/2026)');
{
  /**
   * Print da Liana: anuncio cadastrado, texto casando, e a caixa ainda oferecia "Campanha Martim"
   * com `Conteudo pedido: ADS`.
   *
   * A ADS ja tinha saido dos conteudos em `suggest` -- mas `conteudosJaAplicados` a reconstruia,
   * porque ela monta a lista de conteudos conhecidos a partir das CHAVES da tabela "Modelo por
   * conteudo", e ele tem `ADS = Campanha Martim` la. Etiqueta ja no CRM + nome na tabela =
   * conteudo de novo, por uma porta que a primeira correcao nao fechou.
   */
  TAGS_CRM.push(
    { id: 't-ads', message: 'ADS', active: true },
    { id: 't-ads-seg', message: 'ADS SEGURANCA', active: true }
  );
  tags.invalidateTags();

  mem.etiquetaAnuncio = 'ADS';
  mem.anuncios = [
    { id: 'a1', nome: 'Seguranca', ligado: true, trechos: ['apoio o Capitao'], acao: 'fluxo', etiquetas: ['ADS SEGURANCA'] },
  ];
  mem.tagRules = [{ padrao: 'zucco', etiqueta: 'Conteúdo Zucco' }];

  const noCrm = { id: 'c-9', tagsId: ['t-ads', 't-ads-seg', 't-zucco'] };
  const mapa = { ADS: 'Campanha Martim', 'Conteúdo Zucco': 'Modelo Zucco' };
  const jaNoCrm = await tags.conteudosJaAplicados(noCrm, mapa);
  const nomes = jaNoCrm.map((c) => c.nome);

  check(!nomes.includes('ADS'), `a etiqueta geral de anuncio nao volta como conteudo (${JSON.stringify(nomes)})`);
  check(!nomes.includes('ADS SEGURANCA'), 'nem a etiqueta que o anuncio aplica');
  check(nomes.includes('Conteúdo Zucco'), `e o tema de verdade continua voltando (${JSON.stringify(nomes)})`);

  /**
   * **Mesmo mapeada na tabela, a ADS nao vira conteudo.** E a assercao que trava a regra dele: o
   * mapeamento `ADS = Campanha Martim` pode continuar na Config sem efeito nenhum.
   */
  const soADS = await tags.conteudosJaAplicados({ id: 'c-9', tagsId: ['t-ads'] }, { ADS: 'Campanha Martim' });
  check(soADS.length === 0, `so a ADS no CRM nao produz conteudo nenhum (${JSON.stringify(soADS)})`);

  // A lista de origens junta as duas fontes, e e ela que os dois lados consultam.
  const origens = await tags.etiquetasDeOrigem();
  check(origens.size === 2, `duas origens conhecidas (${origens.size})`);

  delete mem.anuncios;
  delete mem.etiquetaAnuncio;
}


grupo('as etiquetas do anuncio nao repetem a ADS (02/09/2026)');
{
  /**
   * Print dele: a caixa da rodada mostrava *"Etiquetas: ADS, ADS"*. A etiqueta de anuncio
   * (`etiquetaAnuncio`) e a lista de etiquetas do anuncio reconhecido sao duas fontes, e ele pos
   * "ADS" nas duas. A deduplicacao de `refreshTagSuggestions` nao pega: ela filtra o que vem do CRM
   * contra o que `suggest` achou, e aqui as duas entradas saem do proprio `suggest`.
   */
  mem.etiquetaAnuncio = 'ADS';
  mem.tagRules = [];

  const comRepetida = await tags.suggest({ texts: [], veioDeAnuncio: true, etiquetasDoAnuncio: ['ADS'] });
  const ads = comRepetida.filter((s) => s.nome === 'ADS');
  check(ads.length === 1, 'a ADS aparece UMA vez, nao duas');

  // Acento e caixa nao criam uma segunda: quem digita a lista do anuncio nao repete a grafia do CRM.
  const comCaixa = await tags.suggest({ texts: [], veioDeAnuncio: true, etiquetasDoAnuncio: ['ads', 'Ads'] });
  check(comCaixa.filter((s) => /^ads$/i.test(s.nome)).length === 1, 'grafia diferente nao vira etiqueta a mais');

  // E a etiqueta do anuncio que NAO repete continua entrando.
  const outra = await tags.suggest({ texts: [], veioDeAnuncio: true, etiquetasDoAnuncio: ['ADS', 'ADS Escolas'] });
  check(outra.some((s) => s.nome === 'ADS Escolas'), 'etiqueta propria do anuncio entra normalmente');
  check(outra.filter((s) => s.nome === 'ADS').length === 1, 'e a ADS continua sem repetir');
}

grupo('a ADS nunca e conteudo, mesmo com a Config vazia (04/09/2026)');
{
  /**
   * Anotacao do Geminiano: quatro links do Instagram e o aceite do anuncio, e a caixa dizia
   * *pediu "ADS" e ha modelo mapeado -- mande*. Ele: *"ja recebeu o modelo padrao; contato antigo,
   * recebeu mensagem do momento, vou concluir"*.
   *
   * A guarda existia desde 02/09 e **dependia inteiramente da Config**: a lista de origem e
   * montada de `etiquetaAnuncio` mais as etiquetas de cada anuncio. Campo vazio, a ADS volta a ser
   * conteudo pela tabela "Modelo por conteudo", onde ele tem `ADS = Campanha Martim`.
   *
   * Guarda que depende de alguem ter preenchido um campo nao e guarda.
   */
  mem.etiquetaAnuncio = '';
  mem.anuncios = [];
  const vazia = await tags.etiquetasDeOrigem();
  check(vazia.has('ads'), 'com a Config vazia, a ADS continua sendo origem');

  mem.etiquetaAnuncio = 'ADS';
  const cheia = await tags.etiquetasDeOrigem();
  check(cheia.has('ads'), 'e com a Config preenchida tambem');

  // O que ele cadastra continua entrando, que e o motivo de a lista existir.
  mem.etiquetaAnuncio = 'Veio de anuncio';
  mem.anuncios = [{ id: 'a1', nome: 'x', ligado: true, trechos: ['oi'], acao: 'modelo', etiquetas: ['Campanha Escolas'] }];
  const dele = await tags.etiquetasDeOrigem();
  check(dele.has('veio de anuncio') && dele.has('campanha escolas'), 'as etiquetas dele continuam entrando');
  check(dele.has('ads'), 'e o piso continua valendo junto');
}

fim();
