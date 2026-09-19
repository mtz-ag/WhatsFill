/**
 * Testa o caminho que escreve em dados reais: derivação do contrato aprendido pelo
 * gravador (contract.js) e a reconstrução da requisição.
 *
 * Rode: node tests/contract.test.mjs
 */

import { check, grupo, fim, lib, mem } from './_harness.mjs';

const { deriveContract, buildRequest } = await lib('contract.js');
const { findPaths, getByPath, setByPath } = await lib('path.js');

const SENTINEL = 'WHATSFILL-TESTE';
const TESTE = 'aaaaaaaa-1111-2222-3333-444444444444';
const REAL = 'bbbbbbbb-9999-8888-7777-666666666666';

grupo('campo STRING com body simples');
{
  const field = { id: 'field-cidade', name: 'Cidade', type: 'STRING' };
  const entry = deriveContract(
    {
      method: 'POST',
      url: 'https://api.mobiliza.app/core/v1/custom-field/value',
      body: JSON.stringify({ entityId: TESTE, customFieldId: field.id, value: SENTINEL }),
    },
    { contactId: TESTE, field, needles: [SENTINEL] }
  );

  check(entry.paths.value === 'value', `caminho do valor = ${entry.paths.value}`);
  check(entry.paths.contactId === 'entityId', `caminho do contato = ${entry.paths.contactId}`);
  check(entry.paths.fieldId === 'customFieldId', `caminho do campo = ${entry.paths.fieldId}`);

  const built = buildRequest(entry, { contactId: REAL, fieldId: 'field-cidade', value: 'Santo Ângelo' });
  const json = JSON.stringify(built.body);
  check(built.body.entityId === REAL, 'contato substituído');
  check(built.body.value === 'Santo Ângelo', 'valor substituído');
  check(!json.includes(SENTINEL), 'sentinela não vaza para a requisição final');
  check(!json.includes(TESTE), 'contato de teste não vaza');
}

grupo('campo MULTISELECT (valor dentro de array)');
{
  const field = {
    id: 'field-tema',
    name: 'Tema de Interesse',
    type: 'MULTISELECT',
    options: [{ id: 'opt-a' }, { id: 'opt-b' }, { id: 'opt-c' }],
  };
  const entry = deriveContract(
    {
      method: 'PUT',
      url: 'https://api.mobiliza.app/core/v1/custom-field/value',
      body: JSON.stringify({ entityId: TESTE, customFieldId: field.id, value: ['opt-a'] }),
    },
    { contactId: TESTE, field, needles: field.options.map((o) => o.id) }
  );

  check(entry.paths.valueIsArrayItem === true, `detectou item de array (${entry.paths.value})`);

  const built = buildRequest(entry, { contactId: REAL, fieldId: 'field-tema', value: ['opt-b', 'opt-c'] });
  check(
    Array.isArray(built.body.value) && built.body.value.join(',') === 'opt-b,opt-c',
    `array inteiro substituído = ${JSON.stringify(built.body.value)}`
  );
  check(!JSON.stringify(built.body).includes('opt-a'), 'opção usada no aprendizado não sobra');
}

grupo('ids na URL em vez do body');
{
  const field = { id: 'field-cidade', name: 'Cidade', type: 'STRING' };
  const entry = deriveContract(
    {
      method: 'PUT',
      url: `https://api.mobiliza.app/core/v1/contact/${TESTE}/custom-field/field-cidade`,
      body: JSON.stringify({ value: SENTINEL }),
    },
    { contactId: TESTE, field, needles: [SENTINEL] }
  );
  check(entry.url.includes('{{contactId}}') && entry.url.includes('{{fieldId}}'), 'URL virou template');

  const built = buildRequest(entry, { contactId: REAL, fieldId: 'field-cidade', value: 'Pelotas' });
  check(built.url.includes(REAL) && !built.url.includes(TESTE), 'URL final aponta para o contato certo');
}

grupo('guarda-corpo: escrita do contato inteiro tem que ser recusada');
{
  const field = { id: 'field-cidade', name: 'Cidade', type: 'STRING' };
  const contatoInteiro = {
    id: TESTE,
    name: 'Contato de Teste',
    nameWhatsapp: 'Teste',
    phonenumber: '5551999999999',
    email: 'teste@example.com',
    annotation: 'nota antiga',
    tagsId: ['t1'],
    portfolioIds: ['p1'],
    status: 'ACTIVE',
    origin: 'INSTAGRAM',
    customFieldValues: [{ customFieldId: field.id, value: SENTINEL }],
  };

  let recusou = false;
  try {
    deriveContract(
      { method: 'PUT', url: 'https://api.mobiliza.app/core/v1/contact', body: JSON.stringify(contatoInteiro) },
      { contactId: TESTE, field, needles: [SENTINEL] }
    );
  } catch (_) {
    recusou = true;
  }
  check(recusou, 'recusou aprender formato que sobrescreveria o contato');
}

grupo('body que não é JSON também é recusado');
{
  let recusou = false;
  try {
    deriveContract(
      { method: 'POST', url: 'https://api.mobiliza.app/x', body: 'value=' + SENTINEL },
      { contactId: TESTE, field: { id: 'f1', name: 'Cidade', type: 'STRING' }, needles: [SENTINEL] }
    );
  } catch (_) {
    recusou = true;
  }
  check(recusou, 'recusou body de formulário');
}

grupo('data: formato aprendido em vez de chutado');
{
  const { formatosDeData } = await lib('fields.js');

  // Bug real: sem contrato DATE, a escrita usava o contrato de TEXTO e mandava "2026-08-05".
  // A API respondia 200 e ignorava — o painel dizia "Gravado" e o campo ficava vazio.
  const semContrato = formatosDeData('2026-08-05', { type: 'STRING' });
  check(semContrato[0] === '2026-08-05', 'sem contrato DATE, tenta a data crua primeiro');
  check(semContrato.includes('2026-08-05T00:00:00.000Z'), 'e o ISO completo como segunda tentativa');

  const isoAprendido = formatosDeData('2026-08-05', { type: 'DATE', sampleValue: '1999-12-31T00:00:00.000Z' });
  check(isoAprendido[0] === '2026-08-05T00:00:00.000Z', 'exemplo em ISO → manda ISO primeiro');

  const cruAprendido = formatosDeData('2026-08-05', { type: 'DATE', sampleValue: '1999-12-31' });
  check(cruAprendido[0] === '2026-08-05', 'exemplo cru → manda cru');

  const brAprendido = formatosDeData('2026-08-05', { type: 'DATE', sampleValue: '31/12/1999' });
  check(brAprendido[0] === '05/08/2026', 'exemplo brasileiro → converte para dd/mm/aaaa');

  check(formatosDeData('', { type: 'DATE' })[0] === '', 'valor vazio passa direto, sem inventar data');
}

grupo('data de conclusão na gravação automática');
{
  const { deveCarimbarData } = await lib('fields.js');

  // Bug relatado: etiqueta e cidade entravam sozinhas ao abrir o contato, a data não — ela só
  // era gravada no Salvar manual, porque aplicarAutomatico não pedia withCompletionDate.
  check(
    deveCarimbarData({ dataVazia: true, temExato: true, temEtiqueta: false, temCidade: true }),
    'cidade reconhecida agora → carimba'
  );
  check(
    deveCarimbarData({ dataVazia: true, temExato: false, temEtiqueta: true, temCidade: false }),
    'só etiqueta de conteúdo → carimba'
  );
  check(
    deveCarimbarData({ dataVazia: true, temExato: false, temEtiqueta: false, temCidade: true }),
    'reabertura de contato já classificado, data em branco → carimba'
  );

  // Os dois guarda-corpos.
  check(
    !deveCarimbarData({ dataVazia: false, temExato: true, temEtiqueta: true, temCidade: true }),
    'data já gravada nunca é reescrita'
  );
  check(
    !deveCarimbarData({ dataVazia: true, temExato: false, temEtiqueta: false, temCidade: false }),
    'contato sem classificação não recebe data de conclusão'
  );
}

grupo('palpite PENDENTE nunca vai para o CRM');
{
  const { deveGravarEntrada } = await lib('fields.js');

  /**
   * Print dele (07/09/2026): contato NOVO, aberto e concluído no mesmo dia, com o campo Cidade
   * valendo `"mais Apoiadores com patrocínio"` — um trecho da própria mensagem dele.
   *
   * `cityPositionGuess` devolve o segundo pedaço depois da vírgula como palpite
   * `nao-reconhecida`; `confirmarCidadeSePendente` desiste de perguntar por ele desde 04/09 e
   * volta **sem apagar o rascunho**; e a gravação não olhava `pendente`.
   */
  const palpiteRuim = {
    value: 'mais Apoiadores com patrocínio',
    from: 'palpite',
    confidence: 'nao-reconhecida',
    pendente: true,
  };
  check(!deveGravarEntrada(palpiteRuim), 'palpite que não é município não é gravado');
  check(
    !deveGravarEntrada(palpiteRuim, { somenteExatos: true }),
    'nem na gravação automática'
  );

  // A outra saída que voltava sem mexer no rascunho: rodada automática sem IA para conferir.
  // Ela escreve "não gravada" no Andamento desde 03/09 — e agora isso é verdade.
  check(
    !deveGravarEntrada({ value: 'Canoas', from: 'palpite', confidence: 'exata', pendente: true }),
    'cidade que casa EXATO com o IBGE também espera confirmação'
  );

  // O que a confirmação faz é zerar a marca — as três respostas que gravam passam por aqui.
  check(
    deveGravarEntrada({ value: 'Canoas', from: 'palpite', confidence: 'exata', pendente: false, confirmada: true }),
    'confirmada por ele ou pela IA: grava'
  );

  // O resto da regra, que já existia solta dentro de saveClassification.
  check(!deveGravarEntrada(undefined), 'campo sem rascunho');
  check(!deveGravarEntrada({ value: 'Canoas', from: 'crm' }), 'valor do CRM nunca é reescrito');
  check(!deveGravarEntrada({ value: '', from: 'manual' }), 'vazio não é gravação');
  check(!deveGravarEntrada({ value: [], from: 'manual' }), 'multiselect vazio não é gravação');
  check(deveGravarEntrada({ value: 'Canoas', from: 'manual' }), 'digitado por ele: grava');
  check(
    !deveGravarEntrada({ value: 'Canoas', from: 'manual' }, { somenteExatos: true }),
    'a gravação automática leva só palpite exato'
  );
  check(
    !deveGravarEntrada({ value: 'Caxias', from: 'palpite', confidence: 'aproximada' }, { somenteExatos: true }),
    'palpite aproximado fica de fora do automático'
  );
}

grupo('a LIMPEZA e a unica escrita de valor vazio (07/09/2026)');
{
  const { deveGravarEntrada } = await lib('fields.js');
  const cities = await lib('cities.js');

  /**
   * Print do Jose: o campo Cidade dele valia `www.threads.com`, a rodada passou e concluiu —
   * *"passou por ele, nao removeu a cidade errada"*.
   *
   * A extensao nunca apagou nada: preenche buraco e, desde a 2.69, substitui lixo quando a pessoa
   * menciona uma cidade de verdade. Quem nunca mais menciona ficava com o lixo para sempre — e o
   * lixo foi escrito pela propria extensao, no vazamento que a 2.88 fechou.
   */
  const limpar = { value: '', from: 'limpar', limpar: true, limpando: 'www.threads.com' };
  check(deveGravarEntrada(limpar), 'a limpeza grava, mesmo com valor vazio');
  check(
    !deveGravarEntrada(limpar, { somenteExatos: true }),
    'mas NAO na gravacao automatica: apagar e destrutivo e pede ato deliberado'
  );

  // Vazio que nao e limpeza continua sendo "nada para gravar".
  check(!deveGravarEntrada({ value: '', from: 'manual' }), 'campo vazio sem a marca nao grava');

  /**
   * **O criterio e a FORMA, e e isso que torna apagar seguro.** Nenhum dos 497 municipios e URL,
   * dominio, e-mail ou sequencia de digitos — entao apagar nao pode apagar dado bom.
   */
  for (const lixo of ['www.threads.com', 'faq.whatsapp.com', 'vt.tiktok.com', 'https://x.com/a', '51999649102']) {
    check(await cities.ehEnderecoDeMaquina(lixo), `apaga: ${lixo}`);
  }

  /**
   * **E o que NAO pode ser apagado** — metade do teste, porque e onde mora o risco.
   *
   * Frase comum que nao casa com municipio (a print de 07/09 de manha) fica: pode ser cidade de
   * outro estado, abreviacao, ou nome que o parser nao conhece. Apagar ali seria destruir o que
   * alguem preencheu, e o lugar disso e a aba Cidades — com ele olhando.
   */
  for (const bom of [
    'mais Apoiadores com patrocínio',
    'Curitiba',
    'S.do Livramento',
    'Santo Antônio da Patrulha',
    'Porto Alegre',
    'nao sei',
  ]) {
    check(!(await cities.ehEnderecoDeMaquina(bom)), `NAO apaga: ${bom}`);
  }
}

grupo('sem contrato próprio, tipo delicado recusa em vez de cair no de texto');
{
  const { contractFor } = await lib('fields.js');
  mem.writeContract = {
    entries: [
      { type: 'STRING', method: 'PUT', url: 'x', bodyShape: {}, paths: { value: 'valueString' } },
      { type: 'TAGS', method: 'PUT', url: 'y', bodyShape: {}, paths: { value: 'tagsId[0]' } },
    ],
  };

  // O fallback para STRING é o que fez a data "gravar" sem gravar: o valor ia em valueString,
  // a API respondia 200 e ignorava. Múltipla escolha tem o mesmo destino (mora em valuesId).
  check((await contractFor('DATE')) === null, 'DATE sem contrato próprio devolve null');
  check((await contractFor('MULTISELECT')) === null, 'MULTISELECT sem contrato próprio devolve null');
  check((await contractFor('SINGLESELECT')) === null, 'SINGLESELECT idem');

  // Texto livre continua podendo reaproveitar o contrato de texto.
  check((await contractFor('TEXT'))?.type === 'STRING', 'TEXT ainda cai no contrato de texto');
  check((await contractFor('STRING'))?.type === 'STRING', 'STRING casa exato');

  mem.writeContract = {
    entries: [{ type: 'MULTISELECT', method: 'PUT', url: 'z', bodyShape: {}, paths: { value: 'valuesId' } }],
  };
  check((await contractFor('MULTISELECT'))?.type === 'MULTISELECT', 'com contrato próprio, usa o dele');
  delete mem.writeContract;
}

grupo('conferência pós-escrita: o que conta como "mesmo valor"');
{
  // A conferência relê o contato e compara. Precisa tolerar as diferenças de forma que a API
  // introduz, senão acusaria falha em gravação boa — e acusar falso é tão ruim quanto o bug
  // original de dizer "Gravado" sem gravar.
  const mesmo = (crm, esperado) => {
    if (crm == null) return false;
    if (Array.isArray(esperado) || Array.isArray(crm)) {
      const a = [...(Array.isArray(crm) ? crm : [crm])].sort();
      const b = [...(Array.isArray(esperado) ? esperado : [esperado])].sort();
      return a.length === b.length && a.every((v, i) => String(v) === String(b[i]));
    }
    const x = String(crm).trim(), y = String(esperado).trim();
    if (x === y) return true;
    return /^\d{4}-\d{2}-\d{2}/.test(x) && /^\d{4}-\d{2}-\d{2}/.test(y) && x.slice(0, 10) === y.slice(0, 10);
  };

  check(mesmo('Porto Alegre', 'Porto Alegre'), 'texto igual confirma');
  check(!mesmo(null, 'Porto Alegre'), 'campo vazio no CRM = não gravou (o bug da data)');
  check(mesmo('2026-08-05T00:00:00', '2026-08-05'), 'data com hora ainda é a mesma data');
  check(!mesmo('2026-08-06', '2026-08-05'), 'data de outro dia não passa (pegaria o bug de fuso)');
  check(mesmo(['b', 'a'], ['a', 'b']), 'múltipla escolha fora de ordem é a mesma coisa');
  check(!mesmo(['a'], ['a', 'b']), 'faltando uma opção não confirma');
}

grupo('readValues entende a forma real de customFieldValues');
{
  const { readValues } = await lib('fields.js');

  // Forma capturada ao vivo. A versão antiga procurava item.value/values/text — nenhum existe,
  // então o painel achava que o contato estava vazio e regravava tudo a cada Salvar.
  const contato = {
    customFieldValues: [
      {
        customFieldId: 'f-cidade', customFieldKey: 'cidade', valueType: 'STRING',
        valueString: 'Porto Alegre', valueBoolean: null,
        valuesId: [], valuesDateTime: [], valuesInteger: [], valuesFloat: [],
      },
      {
        customFieldId: 'f-data', valueType: 'DATETIME', valueString: null,
        valuesDateTime: ['2026-08-05T00:00:00.000Z'], valuesId: [],
      },
      {
        customFieldId: 'f-tema', valueType: 'ID', valueString: null,
        valuesId: ['opt-a', 'opt-b'], valuesDateTime: [],
      },
      { customFieldId: 'f-vazio', valueString: null, valuesId: [], valuesDateTime: [] },
    ],
  };

  const v = readValues(contato);
  check(v['f-cidade'] === 'Porto Alegre', `leu texto = ${v['f-cidade']}`);
  check(v['f-data'] === '2026-08-05', `data virou aaaa-mm-dd = ${v['f-data']}`);
  check(Array.isArray(v['f-tema']) && v['f-tema'].length === 2, 'múltipla escolha virou lista de ids');
  check(!('f-vazio' in v), 'campo sem valor não entra (senão vira palpite descartado à toa)');
  check(Object.keys(readValues({})).length === 0, 'contato sem customFieldValues não quebra');
}

grupo('data de conclusão é a de hoje no fuso de quem atende, não em UTC');
{
  const { hojeLocal } = await lib('fields.js');

  // Bug observado: atendimento do dia 05/08 às 21h gravou 06/08, porque toISOString() usa UTC
  // e no Brasil (UTC-3) às 21h já é o dia seguinte lá.
  const noiteNoBrasil = new Date(2026, 7, 5, 21, 30); // 5 de agosto, 21h30 local
  check(hojeLocal(noiteNoBrasil) === '2026-08-05', `à noite continua o mesmo dia = ${hojeLocal(noiteNoBrasil)}`);

  const madrugada = new Date(2026, 0, 1, 0, 5); // 1º de janeiro, 00h05 local
  check(hojeLocal(madrugada) === '2026-01-01', 'virada de ano na madrugada não volta para dezembro');

  const diaUnico = new Date(2026, 8, 9, 14, 0);
  check(hojeLocal(diaUnico) === '2026-09-09', 'mês e dia com um dígito ganham zero à esquerda');
}

grupo('contrato de data: o valor vem embrulhado em ISO no body');
{
  const { deriveContract, SENTINEL_DATE_NEEDLES } = await lib('contract.js');

  // Você escolhe 31/12/1999 na interface, a plataforma manda ISO completo. Igualdade exata não
  // acharia o caminho do valor — e sem caminho não há contrato.
  const req = {
    method: 'PUT',
    url: 'https://api.mobiliza.app/core/v1/custom-field/f-1/value/c-1',
    body: JSON.stringify({ value: '1999-12-31T00:00:00.000Z' }),
  };
  const entry = deriveContract(req, {
    contactId: 'c-1',
    field: { id: 'f-1', name: 'Data de conclusão do contato', type: 'DATE' },
    needles: SENTINEL_DATE_NEEDLES,
  });

  check(entry.paths.value === 'value', 'achou o caminho do valor por conteúdo');
  check(entry.sampleValue === '1999-12-31T00:00:00.000Z', 'guardou o exemplo para descobrir o formato');
  check(entry.type === 'DATE', 'contrato registrado como DATE');
}

grupo('path.js');
{
  const obj = { a: { b: [{ c: 'x' }, { c: 'y' }] } };
  check(getByPath(obj, 'a.b[1].c') === 'y', 'getByPath com índice');
  setByPath(obj, 'a.b[0].c', 'z');
  check(obj.a.b[0].c === 'z', 'setByPath com índice');
  check(JSON.stringify(findPaths(obj, 'y')) === '["a.b[1].c"]', 'findPaths acha o caminho');
  const novo = {};
  setByPath(novo, 'x.y[0]', 'v');
  check(Array.isArray(novo.x.y) && novo.x.y[0] === 'v', 'setByPath cria array quando precisa');
}

grupo('palpite confirmado entra na gravacao automatica (IA pega a cidade sozinha, 19/09/2026)');
{
  const { deveGravarEntrada } = await lib('fields.js');
  const aproximada = { value: 'Tres Passos', from: 'palpite', confidence: 'aproximada' };
  check(!deveGravarEntrada(aproximada, { somenteExatos: true }), 'aproximado sem confirmacao continua fora');
  check(deveGravarEntrada({ ...aproximada, confirmada: true }, { somenteExatos: true }), 'confirmado pela IA ou por ele entra');
  check(!deveGravarEntrada({ ...aproximada, confirmada: true, pendente: true }, { somenteExatos: true }),
    'pendente continua fora mesmo com a marca');
}

fim();
