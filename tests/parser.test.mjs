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
const { extract, findStructured, limparSiglas, rebaixarParaPalpite } = await lib('extract.js');

const municipios = await cities.loadMunicipios();
console.log(`municípios carregados: ${municipios.length}`);

const casos = [
  {
    titulo: 'resposta no formato pedido',
    msgs: ['Olá! Eu aceito receber conteúdos do Zucco e do Cap Martim.', 'Maria Silva / Santo Ângelo / voluntária'],
    esperado: { cidade: 'Santo Ângelo', nome: 'Maria Silva' },
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
    // O "PP" e o "vereador" já não viram campo (removidos em 01/09/2026). O que este caso ainda
    // trava é o que importa: abreviação de município casa, e o terceiro pedaço não atrapalha.
    titulo: 'formato pedido com abreviação, e o terceiro pedaço ignorado',
    msgs: ['João Pedro / Sto Angelo / vereador pelo PP'],
    esperado: { cidade: 'Santo Ângelo', nome: 'João Pedro' },
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
    // Era "resposta numerada para o tema". O campo saiu; o que sobra de valor é que uma mensagem
    // solta com um número NÃO estraga a cidade lida na mensagem anterior.
    titulo: 'número solto depois não apaga a cidade',
    msgs: ['Ana / Bagé / apoiadora', '2'],
    esperado: { cidade: 'Bagé', nome: 'Ana' },
  },
  {
    titulo: 'cidade inexistente vira sugestão, não invenção',
    msgs: ['Carlos / Vila Nova do Nada / apoiador'],
    esperado: { cidadeNaoReconhecida: true },
  },
  {
    titulo: 'sigla dentro de palavra não estraga a leitura',
    msgs: ['Sou de Erechim e trabalho no transporte'],
    esperado: { cidade: 'Erechim' },
  },
  {
    titulo: 'três linhas em vez de barras',
    msgs: ['Fernanda Santos\nSanta Maria\nprofessora'],
    esperado: { cidade: 'Santa Maria', nome: 'Fernanda Santos' },
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
  const g = await extract(caso.msgs);
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
  if (e.vazio) check(!g.cidade && !g.nome, `nada extraído = ${JSON.stringify(Object.keys(g))}`);
}

grupo('findStructured');
{
  const isCity = async (p) => {
    const hit = await cities.matchCity(p);
    return hit && cities.normalize(p) === cities.normalize(hit.city) ? hit.city : null;
  };
  const ok = await findStructured(['Maria / Santo Ângelo / voluntária'], isCity);
  // O terceiro pedaço ("voluntária") continua sendo TOLERADO — a resposta em três partes ainda
  // casa a cidade. Ele só não vira mais campo: "Função" saiu em 01/09/2026.
  check(ok?.cidade === 'Santo Ângelo' && ok.nome === 'Maria', `casou = ${JSON.stringify(ok)}`);
  check(ok?.funcao === undefined, 'e não devolve mais função');
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

grupo('cidade abreviada NÃO pode impedir o NOME de ser extraído (01/09/2026)');
{
  // Print dele: o contato respondeu "Ulises Sanchez / S.do Livramento.RS" às 18:19 e recebeu o
  // MESMO pedido de dados no dia seguinte. A cidade já tinha sido consertada; o que faltava era o
  // nome — `findStructured` desiste quando nenhum pedaço é "exatamente" o município, e
  // "S.do Livramento.RS" não era, então não havia como separar nome de cidade. Sem nome, a regra
  // pedia os dados de novo.
  //
  // Dois consertos, e o primeiro é um palpite antigo que estava errado: o alias `s.` → "sao"
  // transformava "S.do Livramento" em "São do Livramento", e **"São do ..." não é município
  // nenhum** — "São" sempre precede nome de santo.
  const r = async (...m) => await extract(m);

  const caso = await r('Ulises Sanchez / S.do Livramento.RS');
  check(caso.cidade?.value === 'Santana do Livramento', `cidade = ${caso.cidade?.value ?? '(nada)'}`);
  check(caso.nome?.value === 'Ulises Sanchez', `nome = ${caso.nome?.value ?? '(nada)'} — é o que impede pedir os dados de novo`);
  check(caso.cidade?.informada === true, 'e conta como informada pela pessoa');

  check(cities.formaCanonica('S.do Livramento.RS') === 'santana do livramento', 'formaCanonica resolve abreviação + encurtamento + sigla');
  check(cities.formaCanonica('Livramento') === 'santana do livramento', 'e o encurtamento sozinho');
  check(cities.formaCanonica('Canoas RS') === 'canoas', 'e a sigla sozinha');

  // O lado perigoso do afrouxamento: frase não pode virar cidade INFORMADA, porque informada
  // substitui o que está no CRM.
  const naoInformada = async (m) => (await extract([m])).cidade?.informada !== true;
  check(await naoInformada('Vamos juntos mudar o Rio Grande'), 'o slogan não vira cidade informada');
  check(await naoInformada('boa tarde, sou de Pelotas e quero ajudar'), 'frase com pista não é informada (só palpite)');
  check(await naoInformada('Maria, moro em Canoas e trabalho muito'), 'frase com nome e pista também não');
  check(await naoInformada('S.do meu coracao'), 'abreviação em frase qualquer não casa nada');
  check(await naoInformada('Ana / Vitoria'), '"Vitoria" solto continua esperando clique');
}

grupo('sigla do estado no fim não pode impedir a cidade de contar como INFORMADA (01/09/2026)');
{
  // Print dele: o contato mandou o nome numa mensagem e "Canoas RS" na seguinte, e a cidade não
  // foi assumida. O casamento nunca falhou — "Canoas RS" sempre achou Canoas. O que falhava era a
  // igualdade que decide se a pessoa INFORMOU a cidade: `"canoas rs" !== "canoas"`.
  //
  // O efeito era silencioso e grave: cidade reconhecida, mas `informada: false` — não substituía o
  // CRM e ficava esperando um clique que, na rodada automatizada, ninguém dá.
  const informada = async (...msgs) => (await extract(msgs)).cidade?.informada === true;
  const valor = async (...msgs) => (await extract(msgs))?.cidade?.value ?? null;

  check(await informada('Canoas RS'), '"Canoas RS" conta como informada pela pessoa');
  check((await valor('Canoas RS')) === 'Canoas', 'e o valor é o nome oficial, sem a sigla');
  check(await informada('Inês Dedea Cardoso', 'Canoas RS'), 'nome numa mensagem e "Canoas RS" na outra: informada');
  check(await informada('Canoas - RS'), 'com hífen também');
  check(await informada('Canoas/RS'), 'com barra também');
  check(await informada('Porto Alegre RS'), 'município de duas palavras também');
  check(await informada('Canoas'), 'sem sufixo continua valendo (não regrediu)');

  // Segundo print do mesmo dia, com a sigla ABREVIADA: "Erechim rgds". A primeira versão do
  // conserto só cobria "rs" e este passou batido — "às vezes pega a cidade, às vezes não" é o pior
  // sintoma possível, porque parece defeito aleatório em vez de lista incompleta.
  check(await informada('Erechim rgds'), '"Erechim rgds" (RGDS = Rio Grande do Sul) conta como informada');
  check(await informada('Erechim rgs'), '"rgs" também');
  check((await valor('Erechim rgds')) === 'Erechim', 'e o valor é o município, sem a sigla');

  // A guarda que não pode cair junto: "Rio Grande" é MUNICÍPIO, o estado por extenso não é cidade.
  check((await valor('Rio Grande')) === 'Rio Grande', 'o município Rio Grande continua sendo cidade');
  check((await valor('Rio Grande RS')) === 'Rio Grande', 'e com a sigla junto também');
  check((await valor('sou do Rio Grande do Sul')) === null, 'o estado por extenso continua não sendo cidade');

  // O sufixo só sai do FIM. "RS" no meio pode ser outra coisa, e nenhum município do RS termina
  // em " RS" — por isso tirar do fim é seguro e tirar do meio não seria.
  check(cities.semSufixoDeEstado('Canoas RS') === 'canoas', 'semSufixoDeEstado tira do fim');
  check(cities.semSufixoDeEstado('Canoas') === 'canoas', 'sem sufixo não muda nada');
  check(cities.semSufixoDeEstado('Rio Grande') === 'rio grande', 'o município Rio Grande não é confundido com o estado');
}

grupo('ponto colado não pode colar as palavras (bug de 01/09/2026)');
{
  // Contato real escreveu "Ulises Sanchez / S.do Livramento.RS" e a cidade caiu como
  // não-reconhecida. `normalize` APAGAVA o ponto em vez de trocar por espaço, então
  // "Livramento.RS" virava "livramentors" e o encurtamento /\blivramento\b/ não casava mais —
  // a fronteira de palavra tinha sumido junto com o ponto. Com espaço ou hífen sempre funcionou;
  // era só a forma colada que ficava de fora.
  //
  // O estrago não parava na cidade: sem cidade reconhecida a rodada sugeriu "peça os dados" a
  // quem já tinha mandado nome e cidade.
  const hit = async (t) => cities.matchCity(t);

  check((await hit('Livramento.RS'))?.city === 'Santana do Livramento', '"Livramento.RS" casa');
  check((await hit('S.do Livramento.RS'))?.city === 'Santana do Livramento', 'a forma exata do contato casa');
  check((await hit('Canoas.RS'))?.city === 'Canoas', 'sufixo colado não atrapalha município de uma palavra');
  check((await hit('P.Alegre'))?.city === 'Porto Alegre', 'abreviação colada continua valendo');

  // O ponto vira espaço, e espaço já era o caso que funcionava — estes travam o que não pode
  // regredir junto.
  check((await hit('Livramento RS'))?.city === 'Santana do Livramento', 'com espaço continua casando');
  check((await hit('Livramento - RS'))?.city === 'Santana do Livramento', 'com hífen continua casando');

  // Trocar ponto por espaço não pode transformar texto que NÃO é cidade em cidade.
  check((await hit('não sei.RS')) === null, 'texto que não é município continua sem casar');
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

  // Uma palavra vale como EXATA quando é a resposta inteira — "Caxias", sozinho no campo da
  // cidade, é Caxias do Sul e não havia por que esperar clique (relato dele, 11/08).
  check((await hit('Caxias'))?.city === 'Caxias do Sul', 'Caxias → Caxias do Sul');
  check((await hit('Caxias'))?.confidence === 'exata', 'resposta de uma palavra só é exata');
  check((await hit('Palmares do Sul'))?.confidence === 'exata', 'o nome inteiro continua exato');

  // Mas menção no meio de uma frase continua esperando clique: a palavra solta pode ser nome de
  // gente ("Vitória", "Esperança" e "Rosário" também são começo de município), e aí gravar
  // sozinho trocaria a cidade de um eleitor.
  check((await hit('trabalhei em Caxias uns anos'))?.confidence === 'aproximada', 'menção no meio da frase espera clique');
  check((await hit('moro em Vitória'))?.confidence === 'aproximada', 'nome de gente no meio da frase também');

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
  const g = await extract(['Jeane do PL / Palmares do Sul']);
  check(g.nome?.value === 'Jeane', `nome = ${g.nome?.value} [esperado Jeane]`);
  check(g.cidade?.value === 'Palmares do Sul', `cidade = ${g.cidade?.value}`);

  const semNome = await extract(['srn / Pelotas']);
  check(!semNome.nome, 'sigla na posição do nome não vira nome (fica vazio para você preencher)');
  check(semNome.cidade?.value === 'Pelotas', 'e a cidade da mesma linha continua sendo lida');
}

grupo('resposta à pergunta de interesse: "Sim / Nome / Cidade"');
{
  // A pergunta de interesse passou a pedir os dados junto, então esta é a forma mais comum de
  // resposta do fluxo. O "Sim" na frente não pode virar o nome do eleitor.
  const g = await extract(['Sim / Maria Silva / Palmares do Sul']);
  check(g.nome?.value === 'Maria Silva', `nome = ${g.nome?.value ?? '(nada)'} [esperado Maria Silva]`);
  check(g.cidade?.value === 'Palmares do Sul', `cidade = ${g.cidade?.value}`);

  const virgula = await extract(['Sim, Maria Silva, Palmares do Sul']);
  check(virgula.nome?.value === 'Maria Silva', `com vírgula, nome = ${virgula.nome?.value ?? '(nada)'}`);

  // Cidade antes do nome: é aqui que o "Sim" viraria nome se ele não estivesse na lista de
  // aberturas descartadas.
  const invertido = await extract(['Sim / Palmares do Sul / Maria Silva']);
  check(invertido.nome?.value !== 'Sim', `"Sim" não vira nome = ${invertido.nome?.value ?? '(nada)'}`);
  check(invertido.cidade?.value === 'Palmares do Sul', 'e a cidade continua sendo lida');

  const recusa = await extract(['Não, obrigado']);
  check(!recusa.nome, '"Não" também não vira nome');
}

grupo('cidade informada pela pessoa pode substituir a do CRM');
{
  // A marca `informada` é o que autoriza a substituição no painel: só resposta estruturada
  // ("Nome / Cidade") a recebe. Cidade citada no meio da conversa continua sendo só palpite.
  const formulario = await extract(['Luís Antônio dos Santos / Palmares do Sul']);
  check(formulario.cidade?.informada === true, 'resposta ao formulário marca a cidade como informada');
  check(formulario.cidade?.confidence === 'exata', 'e ela é exata');

  const conversa = await extract(['oi, tudo bem? sou de Pelotas e quero ajudar']);
  check(!conversa.cidade?.informada, 'cidade citada na conversa NÃO é informada — não substitui nada');
}

grupo('mensagem que é SÓ a cidade conta como informada pela pessoa');
{
  // Caso da print (12/08): o cadastro estava com "Santiago" — dado velho e errado — e o contato
  // mandou uma única mensagem, "PORTO ALEGRE". Como só resposta com separador contava como
  // informada, a cidade errada ficava no lugar, levando o COREDE errado junto.
  const g = await extract(
    ['Olá! Eu aceito receber conteúdos do Flávio Bolsonaro e do Cap Martim.', 'Meus parentes', 'PORTO ALEGRE']
  );
  check(g.cidade?.value === 'Porto Alegre', `cidade = ${g.cidade?.value ?? '(nada)'}`);
  check(g.cidade?.informada === true, 'marcada como informada — é o que substitui a cidade do CRM');

  // Correção vale mais que a primeira resposta.
  const corrigiu = await extract(['Canoas', 'Porto Alegre']);
  check(corrigiu.cidade?.value === 'Porto Alegre', `a última cidade mandada é que vale = ${corrigiu.cidade?.value}`);

  // Cidade no meio de uma frase continua sendo palpite: não substitui nada.
  const naFrase = await extract(['boa tarde, sou de Pelotas e quero ajudar']);
  check(naFrase.cidade?.value === 'Pelotas' && !naFrase.cidade.informada, 'no meio da frase NÃO é informada');

  // Encurtamento de uma palavra não autoriza troca: pode ser nome de gente.
  const curta = await extract(['Vitória']);
  check(!curta.cidade?.informada, '"Vitória" sozinho não substitui a cidade do CRM');
}

grupo('cadastro "Nome - Cidade" (a cidade vem depois)');
{
  // "Luci - Porto Alegre": metade da base foi digitada assim. Sem este ramo, a cidade escrita no
  // próprio cadastro ficava invisível.
  const split = (t) => cities.splitCidadeNome(t);

  const luci = await split('Luci - Porto Alegre');
  check(luci?.cidade === 'Porto Alegre' && luci?.nome === 'Luci', `separou = ${JSON.stringify(luci)}`);
  check((await split('Maria - Santa Cruz'))?.cidade === 'Santa Cruz do Sul', 'encurtamento de duas palavras vale');

  // O sentido antigo continua valendo.
  check((await split('Canoas - Marines'))?.nome === 'Marines', '"Cidade - Nome" não quebrou');

  // A trava: nome de gente que também começa município não pode virar cidade dos dois lados.
  check((await split('Ana - Vitória')) === null, '"Ana - Vitória" não vira Vitória das Missões');
  check((await split('Vitória - Ana')) === null, 'nem no sentido inverso');
  check((await split('Maria - Silva')) === null, 'dois nomes de gente continuam sem separação');
  check((await split('Luci - 51999999999')) === null, 'telefone do outro lado não é cidade nem nome');
}

grupo('conferirGrafia: avisa cidade escrita errada, sem reclamar de acento');
{
  /**
   * Pedido dele (20/08/2026): "me falar se está errada também quando eu iniciar o atendimento,
   * tem casos de cidade escritas erradas". A base tem cidade digitada à mão há anos.
   *
   * A regra que evita virar ruído: acento e caixa NÃO são erro — resolvem para o mesmo município
   * e geram a mesma etiqueta. Avisar disso treinaria a ignorar o aviso.
   */
  const ok = async (v) => (await cities.conferirGrafia(v)).ok;

  check(await ok('Porto Alegre'), 'nome oficial passa');
  check(await ok('porto alegre'), 'só caixa não é erro');
  check(await ok('PORTO ALEGRE'), 'maiúsculas não é erro');
  check(await ok('Santo Angelo'), 'só acento faltando não é erro');
  check(await ok(''), 'vazio não é erro de grafia');

  const abrev = await cities.conferirGrafia('Sto Angelo');
  check(!abrev.ok && abrev.oficial === 'Santo Ângelo', `abreviação é apontada = ${abrev.oficial}`);

  const poa = await cities.conferirGrafia('POA');
  check(!poa.ok && poa.oficial === 'Porto Alegre', 'apelido também é apontado');

  const digito = await cities.conferirGrafia('Caxias do Sull');
  check(!digito.ok && digito.oficial === 'Caxias do Sul', `erro de digitação é apontado = ${digito.oficial}`);
  check(/nome oficial/.test(digito.motivo), 'o motivo diz qual é o certo');

  const fora = await cities.conferirGrafia('não sei');
  check(!fora.ok && fora.oficial === null, 'texto que não é cidade não tem grafia a sugerir');
  const outroEstado = await cities.conferirGrafia('Curitiba');
  check(!outroEstado.ok && outroEstado.oficial === null, 'município de outro estado idem');
}

grupo('semAcentoNemCaixa NAO expande abreviacao');
{
  // É o que separa conferir GRAFIA de casar CIDADE: com os aliases, "Sto Angelo" e "Santo Ângelo"
  // ficariam idênticos e o campo abreviado passaria por correto.
  check(cities.semAcentoNemCaixa('Sto Angelo') === 'sto angelo', 'mantém a abreviação');
  check(cities.normalize('Sto Angelo') === 'santo angelo', 'já normalize expande, e é por isso que ela não serve aqui');
  check(cities.semAcentoNemCaixa('Santo Ângelo') === 'santo angelo', 'tira acento e caixa');
}

grupo('cidade → link do grupo');
mem.cityLinks = { 'santo angelo': { label: 'Santo Ângelo', link: 'https://chat.whatsapp.com/AAA' } };
mem.defaultGroupLink = '';
check((await cities.linkFor('Sto Angelo')).link === 'https://chat.whatsapp.com/AAA', 'abreviação encontra o grupo certo');
check((await cities.linkFor('Pelotas')).link === null, 'cidade sem grupo e sem padrão devolve null');
mem.defaultGroupLink = 'https://chat.whatsapp.com/PADRAO';
check((await cities.linkFor('Pelotas')).source === 'padrão', 'cai para o link padrão quando existe');

grupo('memória das cidades recusadas no popup');
{
  // O relato: "estou botando sem cidade e pede novamente". A recusa vivia num Set que nascia
  // vazio a cada load(), então fechar e reabrir o contato trazia a mesma pergunta de volta.
  const store = await lib('store.js');
  mem.cidadeRecusada = {};

  check((await store.cidadesRecusadas('c-1')).length === 0, 'contato sem recusa devolve lista vazia');
  check((await store.cidadesRecusadas(null)).length === 0, 'sem contato não explode');

  await store.lembrarCidadeRecusada('c-1', 'quarai');
  check((await store.cidadesRecusadas('c-1')).includes('quarai'), 'guardou a recusa');
  check((await store.cidadesRecusadas('c-2')).length === 0, 'outro contato não herda a recusa');

  // Recusar duas vezes a mesma não pode duplicar; recusar outra cidade soma.
  await store.lembrarCidadeRecusada('c-1', 'quarai');
  await store.lembrarCidadeRecusada('c-1', 'santiago');
  const c1 = await store.cidadesRecusadas('c-1');
  check(c1.length === 2 && c1.includes('santiago'), `sem duplicata e somando = ${JSON.stringify(c1)}`);

  await store.lembrarCidadeRecusada('c-3', '');
  check((await store.cidadesRecusadas('c-3')).length === 0, 'cidade vazia não vira recusa');

  // A base é de milhares de contatos e o storage não é infinito: poda o mais PARADO, e `at` é
  // renovado a cada recusa, então contato ativo não some por ser antigo.
  mem.cidadeRecusada = {};
  for (let i = 0; i < store.MAX_CONTATOS_RECUSA + 5; i++) {
    await store.lembrarCidadeRecusada(`c-${i}`, 'quarai');
  }
  const guardados = Object.keys(mem.cidadeRecusada).length;
  check(guardados === store.MAX_CONTATOS_RECUSA, `podou no limite = ${guardados}`);
  check((await store.cidadesRecusadas('c-0')).length === 0, 'o mais antigo saiu');
  check((await store.cidadesRecusadas(`c-${store.MAX_CONTATOS_RECUSA + 4}`)).includes('quarai'), 'o mais novo ficou');

  // Backup não leva referência a contato real.
  mem.cidadeRecusada = { 'c-1': { cidades: ['quarai'], at: 1 } };
  check(!JSON.parse(await store.exportJson()).cidadeRecusada, 'exportJson não leva as recusas');
}


grupo('transcricao de audio entra como palpite, nunca como gravacao automatica');
{
  // Esta e a trava que permitiu ler audio: ninguem DIGITOU aquilo, e o valor vai para o CRM de
  // eleitor real. Se estas asseroes cairem, transcricao volta a poder ser gravada sozinha.
  const cru = {
    cidade: { value: 'Pelotas', confidence: 'exata', source: 'PELOTAS', informada: true },
    nome: { value: 'Maria Silva', confidence: 'exata', source: 'Maria Silva' },
  };
  const r = rebaixarParaPalpite(cru);

  check(r.cidade.confidence === 'aproximada', 'cidade exata vira aproximada (fica fora do automatico)');
  check(r.nome.confidence === 'aproximada', 'nome tambem');
  check(r.cidade.informada === false, 'informada vira falso: nao substitui o que ja esta no CRM');
  check(r.cidade.value === 'Pelotas', 'o valor em si nao e mexido');
  check(/ouvido no/.test(r.cidade.source), 'a origem diz que veio do audio = ' + r.cidade.source);

  check(JSON.stringify(rebaixarParaPalpite({})) === '{}', 'vazio devolve vazio');
  check(JSON.stringify(rebaixarParaPalpite(null)) === '{}', 'nulo nao explode');
  check(rebaixarParaPalpite({ cidade: null }).cidade === null, 'palpite nulo passa intacto');
}


grupo('vocabulario da campanha nunca vira cidade');
{
  // Print dele (31/08): popup "Encontrei 'Zucco' como cidade". A mensagem do anuncio lista os
  // nomes separados por virgula, e virgula e o que faz o parser achar que le "Nome / Cidade".
  const anuncio = await extract(['Olá! Eu apoio o Flávio, Zucco, Hiago e Capitão Martim'], {});
  check(!anuncio.cidade, 'a mensagem do anuncio nao propoe cidade nenhuma = ' + JSON.stringify(anuncio.cidade));

  check(!(await extract(['Maria Mattos / Zucco'], {})).cidade, 'Zucco na posicao da cidade tambem nao');
  check(await cities.naoPodeSerCidade('Zucco'), 'Zucco e vocabulario da campanha');
  check(await cities.naoPodeSerCidade('Bolsonaro'), 'Bolsonaro tambem');
  check(await cities.naoPodeSerCidade('capitao martim'), 'e o que ja existia continua');

  // Chamar duas vezes tem que dar o mesmo: as expressoes sao regex globais, e regex global guarda
  // lastIndex entre chamadas.
  check(await cities.naoPodeSerCidade('Zucco'), 'de novo, o mesmo resultado (regex global nao pode guardar estado)');

  // E o que E cidade continua passando.
  check(!(await cities.naoPodeSerCidade('Porto Alegre')), 'Porto Alegre pode ser cidade');
  check(!(await cities.naoPodeSerCidade('Santo Ângelo')), 'Santo Ângelo tambem');
}


grupo('cidade precisa de CONTEXTO, nao basta o nome aparecer');
{
  const cidadeDe = async (t) => (await extract([t], {})).cidade?.value || null;

  // O caso da print (31/08, Dirceu): "Rio Grande" na mensagem do anuncio e o ESTADO. A guarda
  // NOME_DO_ESTADO so apagava "Rio Grande do Sul" por inteiro, entao a forma curta virava popup.
  check((await cidadeDe('Olá! Vamos juntos mudar o Rio Grande')) === null, 'slogan com "Rio Grande" nao vira cidade');
  check((await cidadeDe('Pelo Rio Grande. E pelo Brasil!')) === null, 'headline do anuncio tambem nao');
  check((await cidadeDe('quero mudar o Rio Grande do Sul')) === null, 'o estado por extenso continua fora');

  // As pistas que ele citou, e as vizinhas.
  check((await cidadeDe('eu moro em Rio Grande')) === 'Rio Grande', 'moro em');
  check((await cidadeDe('sou de Pelotas')) === 'Pelotas', 'sou de');
  check((await cidadeDe('aqui em Caxias do Sul o pessoal apoia')) === 'Caxias do Sul', 'aqui em');
  check((await cidadeDe('minha cidade é Bagé')) === 'Bagé', 'minha cidade e');
  check((await cidadeDe('resido em Santa Maria')) === 'Santa Maria', 'resido em');
  check((await cidadeDe('estou em Erechim hoje')) === 'Erechim', 'estou em');

  // A resposta ao formulario e a mensagem curta continuam valendo sem pista nenhuma.
  check((await cidadeDe('Maria Silva / Santo Ângelo')) === 'Santo Ângelo', 'resposta ao formulario');
  check((await cidadeDe('PORTO ALEGRE')) === 'Porto Alegre', 'mensagem que e so a cidade');
}


grupo('resposta a UMA PERGUNTA NOSSA: nome e cidade sem separador');
{
  // Pedido dele (31/08): "se eu perguntei qual sua cidade e ela respondeu (maria cachoeirinha),
  // tera que identificar esse tipo de resposta". Quem responde uma pergunta nao escreve "moro em"
  // nem poe barra -- escreve o nome e a cidade, colados.
  const resp = async (t) => await extract([t], { respostaAoPedido: true });

  const maria = await resp('maria cachoeirinha');
  check(maria.cidade?.value === 'Cachoeirinha', 'a cidade sai da resposta = ' + maria.cidade?.value);
  check(maria.nome?.value === 'Maria', 'e o que sobra vira o nome = ' + maria.nome?.value);

  const completo = await resp('Maria da Silva Cachoeirinha');
  check(completo.nome?.value === 'Maria da Silva', 'nome completo = ' + completo.nome?.value);

  const soCidade = await resp('cachoeirinha');
  check(soCidade.cidade?.value === 'Cachoeirinha', 'so a cidade continua valendo');
  check(!soCidade.nome, 'sem nome, nao inventa nome');

  // A trava: se o que sobra NAO e nome, aquilo nao era uma resposta.
  const slogan = await resp('Vamos juntos mudar o Rio Grande');
  check(!slogan.cidade, 'slogan respondido a pergunta nao vira cidade');
  check(!slogan.nome, 'nem vira nome');

  const anuncio = await resp('Olá! Eu apoio o Flávio, Zucco, Hiago e Capitão Martim');
  check(!anuncio.cidade, 'a mensagem do anuncio tambem nao');

  // Sem a pergunta feita, a menção solta continua exigindo contexto.
  const semPergunta = await extract(['Vamos juntos mudar o Rio Grande'], {});
  check(!semPergunta.cidade, 'sem pergunta, o slogan segue fora');
}

grupo('separador que a pessoa escolheu: ponto e hifen (print da Nilza, 01/09/2026)');
{
  /**
   * Ela respondeu o formulario como "Nilza krumenauer . rolante RGS :" e NADA foi extraido --
   * ponto nao separava. Com barra ou virgula a mesma frase sempre funcionou, o que faz o defeito
   * parecer aleatorio. Sem nome e sem cidade, a rodada concluiu que faltavam dados e mandou a
   * mensagem do momento.
   */
  const g = async (m) => await extract([m]);

  const nilza = await g('Nilza krumenauer . rolante RGS :');
  check(nilza.cidade?.value === 'Rolante', `cidade = ${nilza.cidade?.value ?? '(nada)'}`);
  check(nilza.nome?.value === 'Nilza Krumenauer', `nome = ${nilza.nome?.value ?? '(nada)'}`);
  check(nilza.cidade?.informada === true, 'conta como informada pela pessoa');

  const hifen = await g('Maria Silva - Canoas');
  check(hifen.cidade?.value === 'Canoas' && hifen.nome?.value === 'Maria Silva', 'hifen cercado de espaco tambem separa');

  const semEspaco = await g('Maria Silva. Canoas');
  check(semEspaco.cidade?.value === 'Canoas', 'ponto com espaco de um lado so');

  // Abreviacao NAO pode ser partida pelo ponto.
  const abrev = await g('Sto. Angelo');
  check(abrev.cidade?.value === 'Santo Ângelo', `"Sto. Angelo" fica inteiro: ${abrev.cidade?.value ?? '(nada)'}`);

  /**
   * O lado perigoso: frase comum quebrada no ponto nao pode virar formulario. A trava e a de
   * sempre -- um pedaco tem que ser EXATAMENTE um municipio.
   */
  const naoInformada = async (m) => (await extract([m])).cidade?.informada !== true;
  check(await naoInformada('Boa tarde. Sou de Pelotas e quero ajudar'), 'frase com ponto nao vira formulario');
  check(await naoInformada('moro em Canoas - trabalho de motorista'), 'frase com hifen tambem nao');
  check(await naoInformada('Vamos juntos mudar o Rio Grande. Conto contigo'), 'o slogan com ponto continua fora');
  check(await naoInformada('Ola! Eu apoio o Flavio, Zucco e Capitao Martim'), 'o aceite do anuncio continua sem cidade');
}

grupo('agradecimento so quando ela responde o pedido, nao a conversa inteira (02/09/2026)');
{
  /**
   * Print dele: pedimos "Nome, Cidade" as 12:51, ela nao respondeu, e saiu o agradecimento --
   * *"agradecimento saindo sem a pessoa responder nome e cidade"*.
   *
   * A causa: o sinal `respondeuOsDados` somava "ela escreveu depois do pedido" com um parser que
   * rodava na CONVERSA INTEIRA. Nesta base a pessoa costuma dizer de onde e antes de qualquer
   * pedido, entao bastava ela escrever qualquer coisa depois -- um "ok", um link repassado -- para
   * as duas metades darem verdadeiro. Agradeciamos por um dado que ela nunca deu, e concluiamos.
   *
   * Este teste trava a diferenca entre as duas leituras. O painel agora roda o parser SO nas
   * mensagens de depois do pedido; se alguem voltar a usar a conversa inteira, a primeira assercao
   * cai.
   */
  const antesDoPedido = 'Oi, tudo bem? Sou de Canoas e acompanho o trabalho de voces.';
  const depoisDoPedido = 'https://www.instagram.com/reels/DcyPfNjxsZF/';

  // Como era: a conversa inteira. O parser acha Canoas -- da mensagem ANTIGA.
  const naConversaInteira = await extract([antesDoPedido, depoisDoPedido], { respostaAoPedido: true });
  check(!!naConversaInteira.cidade, 'na conversa inteira o parser acha a cidade (era o que dava o falso positivo)');

  // Como e agora: so o que veio DEPOIS do pedido. Um link repassado nao e nome nem cidade.
  /**
   * **A regra que o painel aplica**: cidade com confianca `nao-reconhecida` NAO conta.
   *
   * No modo `respostaAoPedido` o parser e generoso de proposito -- e ele que faz
   * "maria cachoeirinha" virar nome e cidade sem separador. O preco e que qualquer palavra solta
   * volta como cidade nao-reconhecida: um link do Instagram devolve cidade "www.instagram.com".
   * So isso ja reproduziria a print inteira.
   */
  const respondeuDeVerdade = (p) => (!!p.cidade && p.cidade.confidence !== 'nao-reconhecida') || !!p.nome;

  const soNaResposta = await extract([depoisDoPedido], { respostaAoPedido: true });
  check(soNaResposta.cidade?.confidence === 'nao-reconhecida', `o link volta como cidade nao-reconhecida (${soNaResposta.cidade?.value})`);
  check(!respondeuDeVerdade(soNaResposta), 'e por isso NAO conta como resposta ao pedido');

  // E quem RESPONDE de verdade continua sendo reconhecida -- senao o conserto viraria outro buraco.
  const respondeu = await extract(['Maria Silva , Canoas'], { respostaAoPedido: true });
  check(respondeuDeVerdade(respondeu), 'quem responde nome e cidade continua sendo reconhecida');

  const soCidade = await extract(['canoas'], { respostaAoPedido: true });
  check(respondeuDeVerdade(soCidade), 'so a cidade tambem conta como resposta');

  // "ok" solto nao pode virar agradecimento.
  const ok = await extract(['ok'], { respostaAoPedido: true });
  check(!respondeuDeVerdade(ok), '"ok" solto nao e resposta ao pedido');

  // Outras coisas que ela manda depois do pedido e nao sao resposta.
  for (const ruido of ['👍', 'https://youtu.be/abc123', 'obrigada!', 'vou ver depois']) {
    const p = await extract([ruido], { respostaAoPedido: true });
    check(!respondeuDeVerdade(p), `"${ruido}" nao e resposta ao pedido`);
  }
}

grupo('apelido de cidade: POA e as outras abreviacoes (02/09/2026)');
{
  /**
   * Relato dele: *"nao pegou POA como cidade, seria porto alegre"*.
   *
   * A cidade era reconhecida -- `matchCity('POA')` sempre devolveu Porto Alegre, porque `normalize`
   * aplica os apelidos. O que quebrava era a SOBRA: quem a calculava removia o nome OFICIAL
   * ("Porto Alegre") de um texto onde ela escreveu "POA", e nao removia nada. Resultado: "POA"
   * sozinho virava o NOME "Poa", e "Vera POA" virava o nome "Vera Poa" com a cidade rebaixada a
   * palpite.
   *
   * A raiz: o casamento acontece no texto NORMALIZADO (onde o apelido ja virou "porto alegre") e a
   * remocao acontecia no texto CRU. `cities.semACidade` passa os dois pelo mesmo `normalize`.
   */
  check(cities.semACidade('Vera POA', 'Porto Alegre') === 'Vera', 'tira o apelido e deixa o nome');
  check(cities.semACidade('POA', 'Porto Alegre') === '', 'so o apelido nao deixa sobra nenhuma');
  check(cities.semACidade('maria cachoeirinha', 'Cachoeirinha') === 'maria', 'o caso que ja funcionava continua');
  check(cities.semACidade('Sto Angelo', 'Santo Ângelo') === '', 'apelido de duas palavras tambem sai inteiro');
  check(cities.semACidade('Ana SM', 'Santa Maria') === 'Ana', 'SM vira Santa Maria e sai');

  /**
   * **Acento e caixa do que SOBRA sao preservados.** A sobra vira o nome do eleitor; devolve-la
   * achatada trocaria "José" por "Jose" no CRM.
   */
  check(cities.semACidade('José Porto Alegre', 'Porto Alegre') === 'José', 'o acento do nome sobrevive');

  // O MENOR trecho que basta: sem isso "Vera POA" perderia a frase toda.
  check(cities.semACidade('Vera Cruz POA', 'Porto Alegre') === 'Vera Cruz', 'tira so o pedaco da cidade');
  check(cities.semACidade('sem cidade aqui', 'Porto Alegre') === 'sem cidade aqui', 'nao achou: nao remove nada');
  check(cities.semACidade('', 'Porto Alegre') === '', 'vazio nao explode');
}

grupo('POA como resposta ao pedido de dados');
{
  const comoResposta = async (t) => extract([t], { respostaAoPedido: true });

  const so = await comoResposta('POA');
  check(so.cidade?.value === 'Porto Alegre', `POA sozinho e a cidade (${so.cidade?.value})`);
  check(so.cidade?.informada === true, 'e conta como informada, entao substitui o CRM');
  check(!so.nome, `e NAO inventa o nome "Poa" (${so.nome?.value})`);

  const comNome = await comoResposta('Vera POA');
  check(comNome.cidade?.value === 'Porto Alegre', 'nome + apelido: a cidade sai');
  check(comNome.nome?.value === 'Vera', `e o nome e so o nome (${comNome.nome?.value})`);

  const sigla = await comoResposta('Ana SM');
  check(sigla.cidade?.value === 'Santa Maria' && sigla.nome?.value === 'Ana', 'SM tambem: Ana / Santa Maria');

  // A trava do slogan continua de pe: municipio + sobra que nao e nome nao vira resposta.
  const slogan = await comoResposta('Vamos juntos mudar o Rio Grande');
  check(!slogan.cidade, 'o slogan do anuncio continua nao virando cidade');
}

fim();
