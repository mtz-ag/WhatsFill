/**
 * Testa o parser determinístico (extract.js) e o casamento de cidades (cities.js).
 * A lista de municípios vem do IBGE de verdade — precisa de internet na primeira execução.
 *
 * Rode: node tests/parser.test.mjs
 */

import { check, grupo, fim, lib, mem } from './_harness.mjs';

const cities = await lib('cities.js');
const { extract, findStructured } = await lib('extract.js');

const municipios = await cities.loadMunicipios();
console.log(`municípios carregados: ${municipios.length}`);

/** Campo "Tema de Interesse" como está no schema real do cliente. */
const temaField = {
  name: 'Tema de Interesse',
  type: 'MULTISELECT',
  isSelect: true,
  options: [
    { id: 'opt-impresso', name: 'Aceitou receber material impresso' },
    { id: 'opt-muito', name: 'Apoiador Muito engajado' },
    { id: 'opt-eng', name: 'Apoiador Engajado' },
    { id: 'opt-nao', name: 'Apoiador não engajado' },
    { id: 'opt-resolv', name: 'Resolvemos problema' },
    { id: 'opt-naoresolv', name: 'Não resolvemos o problema' },
  ],
};

const casos = [
  {
    titulo: 'resposta no formato pedido',
    msgs: ['Olá! Eu aceito receber conteúdos do Zucco e do Cap Martim.', 'Maria Silva / Santo Ângelo / voluntária'],
    esperado: { cidade: 'Santo Ângelo', funcao: /Volunt/i, nome: 'Maria Silva' },
  },
  {
    // Caso real: a pessoa respondeu com vírgula e só dois campos, minúsculo.
    titulo: 'resposta com vírgula e sem função',
    msgs: ['Thiago kellermann, porto alegre'],
    esperado: { cidade: 'Porto Alegre', nome: 'Thiago Kellermann' },
  },
  {
    titulo: 'vírgula em frase de conversa não vira nome',
    msgs: ['boa tarde, sou de Pelotas e quero ajudar'],
    esperado: { cidade: 'Pelotas', semNome: true },
  },
  {
    titulo: 'saudação na posição do nome é descartada',
    msgs: ['Boa noite, Erechim'],
    esperado: { cidade: 'Erechim', semNome: true },
  },
  {
    titulo: 'formato pedido, com abreviação e partido',
    msgs: ['João Pedro / Sto Angelo / vereador pelo PP'],
    esperado: { cidade: 'Santo Ângelo', partido: 'PP' },
  },
  {
    titulo: 'texto solto, cidade no meio da frase',
    msgs: ['boa tarde, sou de cachoeira do sul e quero ajudar bastante'],
    esperado: { cidade: 'Cachoeira do Sul' },
  },
  {
    titulo: 'erro de digitação sem formato',
    msgs: ['moro em Caxias do Sull, sou caminhoneiro'],
    esperado: { cidade: 'Caxias do Sul' },
  },
  { titulo: 'apelido POA', msgs: ['sou de POA mesmo'], esperado: { cidade: 'Porto Alegre' } },
  {
    // Caso relatado: o município é "São Lourenço do Sul" e a pessoa escreve só o começo.
    // Não é erro de digitação — a distância até o nome inteiro é 7, longe de qualquer
    // tolerância. Casa pelo prefixo.
    titulo: 'sufixo do município omitido',
    msgs: ['Maria / Sao Lourenço'],
    esperado: { cidade: 'São Lourenço do Sul' },
  },
  {
    titulo: 'sufixo omitido e ainda com erro de digitação',
    msgs: ['Sao lourenso'],
    esperado: { cidade: 'São Lourenço do Sul' },
  },
  {
    titulo: 'sufixo omitido no meio de uma frase',
    msgs: ['boa tarde, sou de sao lourenco e quero ajudar'],
    esperado: { cidade: 'São Lourenço do Sul' },
  },
  {
    titulo: 'resposta numerada para o tema',
    msgs: ['Ana / Bagé / apoiadora', '2'],
    esperado: { cidade: 'Bagé', tema: ['Apoiador Muito engajado'] },
  },
  {
    titulo: 'material impresso por palavra-chave',
    msgs: ['quero receber material impresso em Pelotas'],
    esperado: { cidade: 'Pelotas', tema: ['Aceitou receber material impresso'] },
  },
  {
    titulo: 'cidade inexistente vira sugestão, não invenção',
    msgs: ['Carlos / Vila Nova do Nada / apoiador'],
    esperado: { cidadeNaoReconhecida: true },
  },
  {
    titulo: 'sigla de partido não casa dentro de palavra',
    msgs: ['Sou de Erechim e trabalho no transporte'],
    esperado: { cidade: 'Erechim', semPartido: true },
  },
  {
    titulo: 'três linhas em vez de barras',
    msgs: ['Fernanda Santos\nSanta Maria\nprofessora'],
    esperado: { cidade: 'Santa Maria', funcao: /Professor/i },
  },
  {
    // Resposta real, com saudação antes e a pergunta dos grupos depois: quatro pedaços.
    // O cadastro dela dizia "Zane" (nome do perfil do WhatsApp) — se o parser não achar
    // "Rosane Requia" aqui, o agradecimento sai com o nome errado.
    titulo: 'saudação, nome, cidade e resposta dos grupos em quatro linhas',
    msgs: ['Boa noite.\nRosane Requia\nCaxias do Sul\nNão faço parte de nenhum grupo político.'],
    esperado: { cidade: 'Caxias do Sul', nome: 'Rosane Requia' },
  },
  {
    titulo: 'só o aceite do anúncio: não inventa nada',
    msgs: ['Olá! Eu aceito receber conteúdos do Zucco e do Cap Martim.'],
    esperado: { vazio: true },
  },
];

for (const caso of casos) {
  const g = await extract(caso.msgs, { temaField });
  grupo(caso.titulo);
  const e = caso.esperado;

  if (e.cidade) {
    check(g.cidade?.value === e.cidade, `cidade = ${g.cidade?.value ?? '(nada)'} [esperado ${e.cidade}] (${g.cidade?.confidence ?? '-'})`);
  }
  if (e.cidadeNaoReconhecida) {
    check(
      g.cidade?.confidence === 'nao-reconhecida' && (g.cidade.suggestions || []).length > 0,
      `não reconhecida, com sugestões = ${JSON.stringify(g.cidade?.suggestions ?? null)}`
    );
  }
  if (e.nome) check(g.nome?.value === e.nome, `nome = ${g.nome?.value ?? '(nada)'} [esperado ${e.nome}]`);
  if (e.semNome) check(!g.nome, `nenhum nome extraído = ${g.nome?.value ?? '(nada)'}`);
  if (e.funcao) check(e.funcao.test(g.funcao?.value || ''), `função = ${g.funcao?.value ?? '(nada)'}`);
  if (e.partido) check(g.partido?.value === e.partido, `partido = ${g.partido?.value ?? '(nada)'}`);
  if (e.semPartido) check(!g.partido, `nenhum partido = ${g.partido?.value ?? '(nada)'}`);
  if (e.tema) {
    const labels = g.tema?.labels || [];
    check(e.tema.every((t) => labels.includes(t)), `tema = ${JSON.stringify(labels)}`);
  }
  if (e.vazio) check(!g.cidade && !g.funcao && !g.partido, `nada extraído = ${JSON.stringify(Object.keys(g))}`);
}

grupo('findStructured');
{
  const isCity = async (p) => {
    const hit = await cities.matchCity(p);
    return hit && cities.normalize(p) === cities.normalize(hit.city) ? hit.city : null;
  };
  const ok = await findStructured(['Maria / Santo Ângelo / voluntária'], isCity);
  check(ok?.cidade === 'Santo Ângelo' && ok.nome === 'Maria' && ok.funcao === 'voluntária', `casou = ${JSON.stringify(ok)}`);
  check((await findStructured(['e/ou isso aqui não é formulário'], isCity)) === null, 'não casa frase solta com barra');
  check((await findStructured(['achei ótimo, obrigado'], isCity)) === null, 'não casa frase sem cidade');
}

grupo('casamento por prefixo: o que ele NÃO pode aceitar');
{
  // O casamento por prefixo é o que reconhece "São Lourenço". Estes são os jeitos de ele
  // passar do ponto e gravar cidade errada sozinho em contato real.
  const nome = async (t) => (await cities.matchCity(t))?.city ?? null;

  check((await nome('Carlos')) === null, 'primeiro nome não vira "Carlos Barbosa"');
  check((await nome('Bento')) === null, 'nem "Bento" vira "Bento Gonçalves"');
  // "Porto" prefixa cinco municípios, então o prefixo recusa. Ainda sai um palpite APROXIMADO
  // ("Portão", distância 1 pelo casador de erro de digitação) — e palpite aproximado espera
  // clique, nunca é gravado sozinho. É essa a propriedade que protege o dado real.
  check((await cities.matchCity('Porto'))?.confidence !== 'exata', 'prefixo ambíguo nunca vira valor exato');
  check((await nome('Vila Nova do Nada')) === null, 'lugar inexistente não vira "Vila Nova do Sul"');

  // Nome completo sempre ganha do prefixo de um município maior.
  check((await nome('Santa Maria')) === 'Santa Maria', '"Santa Maria" não vira "Santa Maria do Herval"');

  // E o que ele DEVE aceitar continua aceitando.
  check((await nome('Santa Cruz')) === 'Santa Cruz do Sul', '"Santa Cruz" → Santa Cruz do Sul');
  check((await cities.matchCity('Sao Lourenço'))?.confidence === 'exata', 'prefixo escrito certo é exato');
  check(
    (await cities.matchCity('Sao lourenso'))?.confidence === 'aproximada',
    'prefixo com erro de digitação espera confirmação'
  );
}

grupo('cadastro no formato "Cidade - Nome"');
{
  // Parte da base foi digitada como "Canoas - Marines". Sem separar, o primeiro nome vira a
  // cidade e a saudação sai "Boa noite, Canoas!". Separar errado troca o nome de um eleitor,
  // então o teste guarda principalmente o que NÃO pode ser separado.
  const split = (t) => cities.splitCidadeNome(t);

  const canoas = await split('Canoas - Marines');
  check(canoas?.cidade === 'Canoas' && canoas?.nome === 'Marines', `separou = ${JSON.stringify(canoas)}`);
  check((await split('Porto Alegre – Ana Paula'))?.nome === 'Ana Paula', 'travessão também separa');
  check((await split('Canoas / Marines'))?.nome === 'Marines', 'barra também separa');

  check((await split('Maria - Silva')) === null, 'nome comum não é cidade: não separa');
  check((await split('Grupo Canoas - Marines')) === null, 'a cidade tem que ser a esquerda inteira');
  check((await split('Marines')) === null, 'sem separador não há o que separar');
  check((await split('Canoas - 51999999999')) === null, 'telefone do outro lado não é nome');
  check((await split('Sao lourenso - Ana')) === null, 'cidade só aproximada não separa');
}

grupo('cidade → link do grupo');
mem.cityLinks = { 'santo angelo': { label: 'Santo Ângelo', link: 'https://chat.whatsapp.com/AAA' } };
mem.defaultGroupLink = '';
check((await cities.linkFor('Sto Angelo')).link === 'https://chat.whatsapp.com/AAA', 'abreviação encontra o grupo certo');
check((await cities.linkFor('Pelotas')).link === null, 'cidade sem grupo e sem padrão devolve null');
mem.defaultGroupLink = 'https://chat.whatsapp.com/PADRAO';
check((await cities.linkFor('Pelotas')).source === 'padrão', 'cai para o link padrão quando existe');

fim();
