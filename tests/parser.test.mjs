/**
 * Testa o parser determinístico (extract.js) e o casamento de cidades (cities.js).
 *
 * A lista de municípios sai de `src/data/coredes-rs.json` (planilha oficial da SPGG-RS, os
 * mesmos 497 municípios do IBGE) e é plantada no storage de mentira ANTES de importar o
 * `cities.js` — `loadMunicipios` lê o cache primeiro e nem chega a buscar na rede.
 *
 * Era um download do IBGE a cada máquina nova. Quando a rede não deixa (proxy, CI, firewall
 * corporativo), a lista voltava vazia e **doze asserções falhavam de uma vez** por um motivo
 * que não tem nada a ver com o parser — meia hora procurando bug onde não havia. Fixture local
 * também torna o resultado igual em qualquer máquina: lista do IBGE muda, teste não pode mudar
 * junto sem alguém mandar.
 *
 * Rode: node tests/parser.test.mjs
 */

import { readFileSync } from 'node:fs';
import { check, grupo, fim, lib, mem } from './_harness.mjs';

const coredes = JSON.parse(
  readFileSync(new URL('../src/data/coredes-rs.json', import.meta.url), 'utf8')
);
mem.municipios = Object.keys(coredes.municipios).sort((a, b) => a.localeCompare(b, 'pt-BR'));

const cities = await lib('cities.js');
const { extract, findStructured, limparSiglas } = await lib('extract.js');

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

grupo('o estado não é a cidade');
{
  // Bug ao vivo: "sou do Rio Grande do Sul" gravava a cidade Rio Grande — e o COREDE dela
  // junto, porque a etiqueta de região sai da cidade. O nome do estado contém o nome do
  // município, e o passo 1 procura o município em qualquer lugar do texto.
  check((await cities.matchCity('sou do Rio Grande do Sul')) === null, 'o estado inteiro não casa com Rio Grande');
  check((await cities.matchCity('moro no rio grande do sul')) === null, 'minúsculo e sem acento também não');
  check(
    (await cities.matchCity('Rio Grande do Sul, cidade de Pelotas'))?.city === 'Pelotas',
    'a cidade de verdade continua sendo achada com o estado na frente'
  );

  // A cidade Rio Grande existe e não pode ter sido levada junto.
  check((await cities.matchCity('moro em Rio Grande'))?.city === 'Rio Grande', 'a cidade Rio Grande continua casando');
  check((await cities.matchCity('Rio Grande - RS'))?.city === 'Rio Grande', '"Rio Grande - RS" é a cidade');
}

grupo('"Capitão Martim" não é a cidade Capitão');
{
  // O pior dos bugs desta leva: Capitão É município do RS e é a patente do candidato. Toda
  // mensagem de aceite do anúncio casava com a cidade, e com confiança EXATA — que é a que
  // grava sozinha, sem clique. Cidade errada + COREDE errado em cima de quem só repetiu o nome.
  const aceite = 'Olá! Eu aceito receber conteúdos do Capitão Martim e do Zucco.';
  check((await cities.matchCity(aceite)) === null, 'a mensagem do anúncio não casa com cidade nenhuma');
  check((await cities.matchCity('Capitão Martim é o cara')) === null, 'nem com o nome no meio da frase');
  check((await cities.matchCity('sou fã do cap martim')) === null, '"cap martim" também não');

  // A segunda trava: "Capitão" solto está na lista de ignorados (aba Config).
  check((await cities.matchCity('Maria / Capitão')) === null, '"Capitão" sozinho também não vira cidade');

  // E a lista de ignorados é só isso — não pode ter levado vizinho junto.
  check((await cities.matchCity('Capão da Canoa'))?.city === 'Capão da Canoa', 'Capão da Canoa continua valendo');
  check((await cities.matchCity('Capela de Santana'))?.city === 'Capela de Santana', 'Capela de Santana também');
}

grupo('nome de cidade encurtado (não precisa estar perfeito)');
{
  // "Nomes de cidade não sendo pegos se não estiverem perfeitamente escritos": o casamento por
  // prefixo exigia duas palavras, então o encurtamento mais comum de todos não era reconhecido.
  const hit = async (t) => cities.matchCity(t);

  check((await hit('palmares'))?.city === 'Palmares do Sul', 'Palmares → Palmares do Sul');
  check((await hit('sentinela'))?.city === 'Sentinela do Sul', 'Sentinela → Sentinela do Sul');
  check((await hit('trindade'))?.city === 'Trindade do Sul', 'Trindade → Trindade do Sul');
  check((await hit('livramento'))?.city === 'Santana do Livramento', 'Livramento → Santana do Livramento');

  // Uma palavra NUNCA é exata: espera clique, nunca é gravada sozinha em contato real.
  check((await hit('palmares'))?.confidence === 'aproximada', 'uma palavra só é sempre aproximada');
  check((await hit('Palmares do Sul'))?.confidence === 'exata', 'o nome inteiro continua exato');

  // O que a abertura NÃO pode ter deixado passar.
  check((await hit('Carlos')) === null, 'primeiro nome não vira "Carlos Barbosa"');
  check((await hit('Bento')) === null, 'nem "Bento" vira "Bento Gonçalves"');
  check((await hit('Salvador')) === null, 'prefixo de dois municípios continua ambíguo');
  check((await hit('Fernanda')) === null, 'nome de pessoa não vira cidade');
  check((await hit('Cristiano')) === null, 'nem nome mais longo');
  check((await hit('Passo')) === null, 'pedaço com menos de 6 letras não conta');

  // Palavra comum de 4 letras não pode casar com município curto por tolerância de digitação.
  check((await hit('o cara')) === null, '"cara" não vira Caraá');
}

grupo('sigla não é nome de gente');
{
  // Dois relatos do mesmo dia: "Pegou srn como nome" e "ignorar siglas no nome".
  check(limparSiglas('srn') === '', '"srn" (sem vogal) não é nome');
  check(limparSiglas('PL') === '', 'sigla de partido sozinha não é nome');
  check(limparSiglas('Jeane do PL') === 'Jeane', 'a sigla sai e a partícula pendurada vai junto');
  check(limparSiglas('Maria Silva - PT') === 'Maria Silva', 'sigla no fim do nome sai');
  check(limparSiglas('Luís Antônio dos Santos') === 'Luís Antônio dos Santos', 'nome de verdade fica intacto');
  check(limparSiglas('Ana') === 'Ana', 'nome curto com vogal continua valendo');
  check(limparSiglas('Ivo de Souza') === 'Ivo de Souza', 'partícula no meio do nome não é mexida');

  // E o caminho inteiro: a resposta ao formulário com o partido colado no nome.
  const g = await extract(['Jeane do PL / Palmares do Sul'], { temaField });
  check(g.nome?.value === 'Jeane', `nome = ${g.nome?.value} [esperado Jeane]`);
  check(g.cidade?.value === 'Palmares do Sul', `cidade = ${g.cidade?.value}`);

  const semNome = await extract(['srn / Pelotas'], { temaField });
  check(!semNome.nome, 'sigla na posição do nome não vira nome (fica vazio para você preencher)');
  check(semNome.cidade?.value === 'Pelotas', 'e a cidade da mesma linha continua sendo lida');
}

grupo('resposta à pergunta de interesse: "Sim / Nome / Cidade"');
{
  // A pergunta de interesse passou a pedir os dados junto, então esta é a forma mais comum de
  // resposta do fluxo. O "Sim" na frente não pode virar o nome do eleitor.
  const g = await extract(['Sim / Maria Silva / Palmares do Sul'], { temaField });
  check(g.nome?.value === 'Maria Silva', `nome = ${g.nome?.value ?? '(nada)'} [esperado Maria Silva]`);
  check(g.cidade?.value === 'Palmares do Sul', `cidade = ${g.cidade?.value}`);

  const virgula = await extract(['Sim, Maria Silva, Palmares do Sul'], { temaField });
  check(virgula.nome?.value === 'Maria Silva', `com vírgula, nome = ${virgula.nome?.value ?? '(nada)'}`);

  // Cidade antes do nome: é aqui que o "Sim" viraria nome se ele não estivesse na lista de
  // aberturas descartadas.
  const invertido = await extract(['Sim / Palmares do Sul / Maria Silva'], { temaField });
  check(invertido.nome?.value !== 'Sim', `"Sim" não vira nome = ${invertido.nome?.value ?? '(nada)'}`);
  check(invertido.cidade?.value === 'Palmares do Sul', 'e a cidade continua sendo lida');

  const recusa = await extract(['Não, obrigado'], { temaField });
  check(!recusa.nome, '"Não" também não vira nome');
}

grupo('cidade informada pela pessoa pode substituir a do CRM');
{
  // A marca `informada` é o que autoriza a substituição no painel: só resposta estruturada
  // ("Nome / Cidade") a recebe. Cidade citada no meio da conversa continua sendo só palpite.
  const formulario = await extract(['Luís Antônio dos Santos / Palmares do Sul'], { temaField });
  check(formulario.cidade?.informada === true, 'resposta ao formulário marca a cidade como informada');
  check(formulario.cidade?.confidence === 'exata', 'e ela é exata');

  const conversa = await extract(['oi, tudo bem? sou de Pelotas e quero ajudar'], { temaField });
  check(!conversa.cidade?.informada, 'cidade citada na conversa NÃO é informada — não substitui nada');
}

grupo('cidade → link do grupo');
mem.cityLinks = { 'santo angelo': { label: 'Santo Ângelo', link: 'https://chat.whatsapp.com/AAA' } };
mem.defaultGroupLink = '';
check((await cities.linkFor('Sto Angelo')).link === 'https://chat.whatsapp.com/AAA', 'abreviação encontra o grupo certo');
check((await cities.linkFor('Pelotas')).link === null, 'cidade sem grupo e sem padrão devolve null');
mem.defaultGroupLink = 'https://chat.whatsapp.com/PADRAO';
check((await cities.linkFor('Pelotas')).source === 'padrão', 'cai para o link padrão quando existe');

fim();
