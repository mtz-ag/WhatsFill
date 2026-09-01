/**
 * Testa o guarda-corpo principal do envio: nunca mandar template com variável não
 * resolvida (em especial {{link_grupo}}).
 *
 * Rode: node tests/vars.test.mjs
 */

import { check, grupo, fim, lib, mem } from './_harness.mjs';

const vars = await lib('vars.js');

// Dados fictícios de propósito: teste nenhum carrega contato real de eleitor.
const contact = { name: 'Ana Paula Ribeiro', phonenumberFormatted: '(51) 90000-0001' };
const TEMPLATE = 'Prontinho, {{primeiro_nome}}! Grupo de {{cidade}}:\n{{link_grupo}}';

grupo('sem cidade classificada → bloqueia');
{
  const r = vars.render(TEMPLATE, await vars.buildContext({ contact, cidade: '' }));
  check(r.missing.includes('cidade') && r.missing.includes('link_grupo'), `faltando = ${JSON.stringify(r.missing)}`);
  check(r.text.includes('{{link_grupo}}'), 'marcador continua visível no preview');
  check(/Cidade ainda não classificada/.test(vars.explainMissing(r.missing, r.reasons)), 'motivo explica o bloqueio');
}

grupo('cidade sem grupo e sem link padrão → bloqueia');
{
  mem.cityLinks = {};
  mem.defaultGroupLink = '';
  const r = vars.render(TEMPLATE, await vars.buildContext({ contact, cidade: 'Pelotas' }));
  check(r.missing.includes('link_grupo') && !r.missing.includes('cidade'), `faltando = ${JSON.stringify(r.missing)}`);
  check(/Sem grupo cadastrado para "Pelotas"/.test(vars.explainMissing(r.missing, r.reasons)), 'motivo nomeia a cidade');
}

grupo('cidade com grupo → libera e interpola');
{
  mem.cityLinks = { 'santo angelo': { label: 'Santo Ângelo', link: 'https://chat.whatsapp.com/AAA' } };
  const r = vars.render(TEMPLATE, await vars.buildContext({ contact, cidade: 'Santo Ângelo' }));
  check(r.missing.length === 0, 'nada faltando');
  check(r.text.startsWith('Prontinho, Ana!'), `primeiro nome = ${r.text.split('\n')[0]}`);
  check(r.text.includes('https://chat.whatsapp.com/AAA'), 'link entrou');
  check(!/\{\{/.test(r.text), 'nenhum marcador sobrou');
}

grupo('variável desconhecida');
{
  const r = vars.render('Oi {{nao_existe}}', await vars.buildContext({ contact, cidade: 'Santo Ângelo' }));
  check(r.missing.includes('nao_existe'), 'entra na lista de faltantes');
}

grupo('nome de cadastro do anúncio nunca vira saudação');
{
  // Contato que chega do anúncio: o CRM cadastra assim.
  const novo = { name: '[NOVO] (11) 95213-4567', phonenumberFormatted: '(11) 95213-4567' };
  check(vars.looksLikePlaceholder('[NOVO] (11) 95213-4567'), 'reconhece "[NOVO] ..."');
  check(vars.looksLikePlaceholder('NOVO'), 'reconhece "NOVO"');
  check(vars.looksLikePlaceholder('(51) 99999-9999'), 'reconhece nome que é só telefone');
  check(vars.looksLikePlaceholder(''), 'reconhece vazio');
  check(!vars.looksLikePlaceholder('Thiago Tim'), 'nome de verdade não é apelido automático');

  const r = vars.render('{{saudacao}}, {{primeiro_nome}}!', await vars.buildContext({ contact: novo }));
  check(!r.text.includes('NOVO'), `não escreveu "NOVO" na mensagem: ${JSON.stringify(r.text)}`);
  check(r.missing.includes('primeiro_nome'), 'bloqueia o envio em vez de mandar errado');
  check(
    /apelido automático/.test(vars.explainMissing(r.missing, r.reasons)),
    `motivo = ${vars.explainMissing(r.missing, r.reasons)}`
  );
}

grupo('nome informado pelo contato tem prioridade sobre o cadastro');
{
  const novo = { name: '[NOVO] (51) 90000-0002' };
  const ctx = await vars.buildContext({ contact: novo, nome: 'Thiago Kellermann' });
  const r = vars.render('{{saudacao}}, {{primeiro_nome}}!', ctx);
  check(r.missing.length === 0, 'liberado');
  check(/, Thiago!$/.test(r.text), `usou o nome informado = ${JSON.stringify(r.text)}`);
}

grupo('motivo repetido não aparece duas vezes');
{
  const r = vars.render('{{nome}} {{primeiro_nome}}', await vars.buildContext({ contact: { name: '[NOVO] x' } }));
  const motivo = vars.explainMissing(r.missing, r.reasons);
  check((motivo.match(/apelido automático/g) || []).length === 1, `mensagem enxuta = ${motivo}`);
}

grupo('nome do perfil do WhatsApp não vence o nome que a pessoa escreveu');
{
  const { nomeVeioDoPerfil } = await lib('vars.js');

  // Caso real: cadastro "Zane" (nome do perfil) e a pessoa respondeu "Rosane Requia". O
  // agradecimento sairia "Obrigado pela atenção, Zane!".
  check(nomeVeioDoPerfil({ name: 'Zane', nameWhatsapp: 'Zane' }), 'cadastro igual ao perfil = veio do perfil');
  check(nomeVeioDoPerfil({ name: 'zane', nameWhatsapp: 'Zane' }), 'diferença de caixa não engana');
  check(nomeVeioDoPerfil({ name: 'José', nameWhatsapp: 'Jose' }), 'diferença de acento não engana');

  // Nome que um operador digitou tem que continuar ganhando do palpite.
  check(!nomeVeioDoPerfil({ name: 'Rosane Requia', nameWhatsapp: 'Zane' }), 'cadastro curado não é do perfil');
  check(!nomeVeioDoPerfil({ name: 'Zane', nameWhatsapp: '' }), 'sem nome de perfil não dá para afirmar');
  check(!nomeVeioDoPerfil({}), 'contato sem nome nenhum não quebra');
}

grupo('tirar o nome das respostas (semVocativo)');
{
  const sem = vars.semVocativo;

  // Os vocativos que existiam de verdade nas respostas prontas.
  check(sem('Obrigado pela atenção, {{primeiro_nome}}!') === 'Obrigado pela atenção!', 'vírgula + exclamação');
  check(sem('{{saudacao}}, {{primeiro_nome}}! Que Deus abençoe') === '{{saudacao}}! Que Deus abençoe', 'depois da saudação');
  check(sem('Só mais uma, {{primeiro_nome}}: responda') === 'Só mais uma: responda', 'vocativo antes de dois-pontos');
  check(sem('Prontinho, {{primeiro_nome}}! Este é o grupo') === 'Prontinho! Este é o grupo', 'no meio da abertura');
  check(sem('Sem problema, {{primeiro_nome}}! Agradeço') === 'Sem problema! Agradeço', 'sem problema');

  // Outras formas de escrever o vocativo.
  check(sem('Olá {{primeiro_nome}}, tudo bem?') === 'Olá, tudo bem?', 'nome antes da vírgula da frase');
  check(sem('{{primeiro_nome}}, agradeço o retorno.') === 'agradeço o retorno.', 'nome abrindo a frase');
  check(sem('Recebi sua mensagem {{primeiro_nome}}') === 'Recebi sua mensagem', 'nome solto no fim');
  check(sem('Obrigado, {{nome}}!') === 'Obrigado!', '{{nome}} completo também sai');

  // O que NÃO pode ser tocado: as outras variáveis e o texto do Thiago.
  const grupo1 = 'Prontinho! Este é o grupo de {{cidade}}:\n\n{{link_grupo}}\n\nTe espero! 🇧🇷';
  check(sem(grupo1) === grupo1, 'texto sem nome fica idêntico');
  check(sem('Grupo de {{cidade}}, {{primeiro_nome}}!') === 'Grupo de {{cidade}}!', '{{cidade}} sobrevive ao lado');
  check(sem('') === '' && sem(null) === '', 'vazio e nulo não quebram');

  // E o resultado tem que passar pelo render sem sobrar variável — é o ponto de tudo isto.
  const ctx = { values: { saudacao: 'Boa noite' }, reasons: {} };
  const r = vars.render(sem('{{saudacao}}, {{primeiro_nome}}! Obrigado pela mensagem.'), ctx);
  check(r.missing.length === 0, `nada bloqueia mais o envio = ${JSON.stringify(r.missing)}`);
  check(r.text === 'Boa noite! Obrigado pela mensagem.', `texto final = ${JSON.stringify(r.text)}`);
}

grupo('usaNome');
{
  check(vars.usaNome('Oi {{primeiro_nome}}'), 'acha {{primeiro_nome}}');
  check(vars.usaNome('Oi {{ nome }}'), 'acha {{nome}} com espaço');
  check(!vars.usaNome('Grupo de {{cidade}}'), 'não confunde com outra variável');
  check(!vars.usaNome(''), 'texto vazio não usa nome');
}

grupo('nenhuma resposta padrão chama o contato pelo nome');
{
  // A regra do projeto, conferida na lista inteira: é o que impede o vocativo voltar sem
  // ninguém notar numa edição futura.
  const store = await lib('store.js');
  const comNome = store.DEFAULT_TEMPLATES.filter((t) => vars.usaNome(t.text)).map((t) => t.id);
  check(comNome.length === 0, `respostas com nome = ${JSON.stringify(comNome)}`);
}

grupo('a migração tira o nome do que já está salvo no navegador');
{
  // Mora nesta suíte, e não numa nova, porque é a mesma mudança: `semVocativo` é a regra e a
  // migração é o único lugar que a aplica. Ela REESCREVE resposta salva — inclusive as que o
  // Thiago editou à mão —, então precisa de teste.
  const templates = await lib('templates.js');

  mem.migracoes = {};
  mem.templates = [
    { id: 'agradecimento', name: 'Agradecer e encerrar', text: 'Obrigado pela atenção, {{primeiro_nome}}! Um abraço.' },
    { id: 'meu-texto', name: 'Texto do Thiago', text: '{{saudacao}}, {{primeiro_nome}}! Anotei aqui e te retorno.' },
    { id: 'link-grupo', name: 'Enviar link do grupo', text: 'Prontinho! Grupo de {{cidade}}: {{link_grupo}}' },
  ];
  mem.auto = { mensagemMomento: 'Feliz Dia dos Pais, {{primeiro_nome}}! 🇧🇷' };

  const mexidos = await templates.migrarRespostasSemNome();

  check(mem.templates[0].text === 'Obrigado pela atenção! Um abraço.', `padrão = ${JSON.stringify(mem.templates[0].text)}`);
  check(
    mem.templates[1].text === '{{saudacao}}! Anotei aqui e te retorno.',
    `texto editado por ele preserva o resto = ${JSON.stringify(mem.templates[1].text)}`
  );
  check(mem.templates[2].text === 'Prontinho! Grupo de {{cidade}}: {{link_grupo}}', 'resposta sem nome não é tocada');
  check(mem.auto.mensagemMomento === 'Feliz Dia dos Pais! 🇧🇷', `mensagem do momento = ${JSON.stringify(mem.auto.mensagemMomento)}`);
  check(mexidos.length === 3, `relatou o que mexeu = ${JSON.stringify(mexidos)}`);

  // Roda uma vez só: se ele puser o nome de volta de propósito, a migração não desfaz.
  mem.templates[0].text = 'Obrigado, {{primeiro_nome}}!';
  const segunda = await templates.migrarRespostasSemNome();
  check(segunda === false, 'segunda execução não faz nada');
  check(mem.templates[0].text === 'Obrigado, {{primeiro_nome}}!', 'e não desfaz a escolha dele');
}

grupo('a pergunta de interesse passa a pedir nome e cidade');
{
  const templates = await lib('templates.js');
  const store = await lib('store.js');

  mem.migracoes = {};
  mem.templates = [
    { id: 'interesse-conteudo', name: 'Perguntar interesse no conteúdo', text: store.INTERESSE_CONTEUDO_ANTIGO },
  ];
  check((await templates.migrarInteressePedeDados()) === true, 'atualizou o texto anterior');
  check(/Nome completo \/ Cidade/.test(mem.templates[0].text), 'a nova versão pede os dados');
  check(/\(e pedir os dados\)/.test(mem.templates[0].name), `o nome acompanhou = ${mem.templates[0].name}`);

  // Texto que ele reescreveu não pode ser atropelado.
  mem.migracoes = {};
  mem.templates = [{ id: 'interesse-conteudo', name: 'Minha pergunta', text: 'Oi! Quer receber nossos conteúdos?' }];
  check((await templates.migrarInteressePedeDados()) === false, 'pergunta editada por ele fica intacta');
  check(mem.templates[0].text === 'Oi! Quer receber nossos conteúdos?', 'o texto dele continua lá');

  // Uma vez só.
  mem.migracoes = { interessePedeDados: true };
  mem.templates = [{ id: 'interesse-conteudo', name: 'x', text: store.INTERESSE_CONTEUDO_ANTIGO }];
  check((await templates.migrarInteressePedeDados()) === false, 'não roda de novo');
}

grupo('a pergunta dos grupos passa a pedir o link');
{
  const templates = await lib('templates.js');
  const store = await lib('store.js');

  // A frase vive DENTRO de outra resposta (o pedir-dados), então a troca é por substring.
  mem.migracoes = {};
  mem.templates = [
    { id: 'pedir-dados', name: 'Pedir dados', text: 'Nome completo / Cidade\n\n' + store.PERGUNTA_GRUPOS_ANTIGA },
    { id: 'agradecimento', name: 'Agradecer', text: 'Obrigado pela atenção!' },
  ];
  const mexidos = await templates.migrarGruposPedeLink();

  check(mexidos.length === 1 && mexidos[0] === 'Pedir dados', `mexeu só no que tinha a frase = ${JSON.stringify(mexidos)}`);
  check(/link de convite/.test(mem.templates[0].text), 'a nova versão pede o link');
  check(!/o nome ou o link/.test(mem.templates[0].text), 'e a antiga saiu');
  check(mem.templates[0].text.startsWith('Nome completo / Cidade'), 'o resto da resposta ficou intacto');
  check(mem.templates[1].text === 'Obrigado pela atenção!', 'resposta sem a frase não é tocada');

  // Frase reescrita por ele não é atropelada.
  mem.migracoes = {};
  mem.templates = [{ id: 'pedir-dados', name: 'Pedir dados', text: 'Você está em algum grupo? Manda aí.' }];
  check((await templates.migrarGruposPedeLink()).length === 0, 'texto dele fica como está');
}

grupo('a recusa de pedido de emprego chega a quem já tem a lista salva');
{
  const templates = await lib('templates.js');
  const store = await lib('store.js');

  const padrao = store.DEFAULT_TEMPLATES.find((t) => t.id === 'pedido-emprego');
  check(!!padrao, 'a resposta "pedido-emprego" existe no padrão');
  check(/não pode arrumar emprego/.test(padrao.text), 'diz que o mandato não pode — é o ponto dela');
  check(/SINE/.test(padrao.text), 'e aponta o caminho que existe (SINE/FGTAS)');
  // Intermediar contratação é justamente o que a lei proíbe: nada de prometer levar currículo.
  check(!/curr[ií]culo/i.test(padrao.text), 'não promete encaminhar currículo a empresa nenhuma');

  mem.migracoes = {};
  mem.templates = [{ id: 'agradecimento', name: 'Agradecer', text: 'Obrigado pela atenção!' }];
  check((await templates.migrarRespostaPedidoEmprego()) === true, 'acrescentou a quem não tinha');
  check(mem.templates.some((t) => t.id === 'pedido-emprego'), 'a resposta entrou na lista salva');
  check(mem.templates[0].text === 'Obrigado pela atenção!', 'e não mexeu no que já estava lá');

  // Roda uma vez só: apagar de propósito não pode fazer a resposta voltar sozinha.
  mem.templates = mem.templates.filter((t) => t.id !== 'pedido-emprego');
  check((await templates.migrarRespostaPedidoEmprego()) === false, 'não roda de novo');
  check(!mem.templates.some((t) => t.id === 'pedido-emprego'), 'resposta apagada por ele não volta');

  // Quem já tem a resposta não ganha uma cópia.
  mem.migracoes = {};
  mem.templates = [{ id: 'pedido-emprego', name: 'A minha versão', text: 'Texto do Thiago.' }];
  check((await templates.migrarRespostaPedidoEmprego()) === false, 'não duplica o que já existe');
  check(mem.templates.length === 1 && mem.templates[0].text === 'Texto do Thiago.', 'a versão dele fica intacta');
}

grupo('as perguntas pedem os dados no formato que o parser entende');
{
  // O parser acerta porque a PERGUNTA impõe o formato. Se alguém reescrever uma dessas
  // respostas e tirar a linha do formato, o acerto cai sem nada quebrar — daí este teste.
  const store = await lib('store.js');
  const pedem = ['pedir-dados', 'interesse-conteudo', 'sem-retorno-interesse'];

  for (const id of pedem) {
    const t = store.DEFAULT_TEMPLATES.find((x) => x.id === id);
    check(!!t, `a resposta "${id}" existe`);
    check(/Nome completo \/ Cidade/.test(t?.text || ''), `"${id}" pede no formato "Nome completo / Cidade"`);
  }

  // As duas que perguntam interesse pedem o "Sim" na frente — é o que o parser usa para saber
  // que a pessoa aceitou, e o que `NAO_E_NOME` impede de virar nome.
  for (const id of ['interesse-conteudo', 'sem-retorno-interesse']) {
    const t = store.DEFAULT_TEMPLATES.find((x) => x.id === id);
    check(/Sim \/ Nome completo \/ Cidade/.test(t.text), `"${id}" pede "Sim / Nome / Cidade"`);
  }

  /**
   * TODO texto que pede dados — inclusive VARIANTES e os dois de evento — carrega a linha do
   * formato, na forma que o painel reconhece.
   *
   * É o contrato que faz a resposta do contato ser lida como resposta: o painel decide
   * `respostaAoPedido` por esta linha, e é assim que "maria cachoeirinha" vira nome e cidade.
   *
   * **Relato dele (01/09): *"deu a cidade e não pegou"*.** A versão anterior do painel comparava
   * um trecho do texto BASE do `pedir-dados`, então variante e texto de evento não eram
   * reconhecidos e a resposta passava batido. Se alguém reescrever um destes textos e tirar a
   * linha, o acerto cai de novo — em silêncio.
   */
  const PEDIU_NOME_E_CIDADE = /nome(\s+completo)?\s*\/\s*cidade/i;
  const achatar = (t) =>
    String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  const pedemDados = ['pedir-dados', 'pedir-dados-evento-sim', 'pedir-dados-evento-nao', 'interesse-conteudo', 'sem-retorno-interesse'];
  for (const id of pedemDados) {
    const t = store.DEFAULT_TEMPLATES.find((x) => x.id === id);
    check(!!t, `"${id}" existe`);
    check(PEDIU_NOME_E_CIDADE.test(achatar(t?.text)), `"${id}" é reconhecido como pedido de dados`);
    for (const [i, v] of (t?.variantes || []).entries()) {
      check(PEDIU_NOME_E_CIDADE.test(achatar(v)), `variante ${i + 1} de "${id}" também é reconhecida`);
    }
  }

  // E o que NÃO pede dados não pode ser confundido com pedido — senão qualquer conversa viraria
  // "resposta ao formulário" e o parser leria cidade onde não há.
  for (const id of ['agradecimento', 'sem-interesse', 'link-grupo']) {
    const t = store.DEFAULT_TEMPLATES.find((x) => x.id === id);
    if (!t) continue;
    check(!PEDIU_NOME_E_CIDADE.test(achatar(t.text)), `"${id}" não é pedido de dados`);
  }
}

grupo('saudação por horário');
check(vars.saudacao(new Date(2026, 7, 5, 9)) === 'Bom dia', 'manhã');
check(vars.saudacao(new Date(2026, 7, 5, 15)) === 'Boa tarde', 'tarde');
check(vars.saudacao(new Date(2026, 7, 5, 21)) === 'Boa noite', 'noite');


grupo('nome sem sentido: o unico caso que ainda pede os dados');
{
  // Pedido dele (31/08): "uma excecao pra pedir e somente quando o nome da pessoa estiver
  // totalmente sem sentido ou em falta". Antes a rodada pedia dados a quem so estava sem cidade.
  check(vars.nomeSemSentido(''), 'vazio');
  check(vars.nomeSemSentido('[NOVO] (51) 99999-9999'), 'apelido automatico do anuncio');
  check(vars.nomeSemSentido('NOVO'), 'NOVO');
  check(vars.nomeSemSentido('(51) 98765-4321'), 'telefone no lugar do nome');
  check(vars.nomeSemSentido('srn'), 'sem vogal nenhuma');
  check(vars.nomeSemSentido('kkk'), 'kkk');

  check(!vars.nomeSemSentido('Maria Mattos'), 'nome de verdade');
  check(!vars.nomeSemSentido('Thiago Tim'), 'o contato de teste');
  check(!vars.nomeSemSentido('Ana'), 'nome curto com vogal');

  // Herdado do looksLikePlaceholder: menos de 3 letras conta como falta. "Ze" cai aqui, e fica
  // assim de proposito -- alargar o looksLikePlaceholder mudaria o bloqueio de vocativo em todo
  // o painel, que e outra decisao.
  check(vars.nomeSemSentido('Zé'), 'duas letras contam como falta (herdado, e aceito)');
}


grupo('nomeDivergeDoInformado: separa para ele conferir, sem trocar nada');
{
  const { nomeDivergeDoInformado } = await lib('vars.js');

  /**
   * O caso REAL da print de 31/08: cadastro com nome de perfil, pessoa respondendo o nome dela.
   * A extensao NAO troca o nome — marca, e ele corrige a mao. Escolha dele entre as duas opcoes.
   */
  check(nomeDivergeDoInformado('viver a vida', 'Daniel Ribeiro'), 'cadastro de perfil x nome informado');

  // Os tres falsos positivos que fariam a fila de revisao encher de contato certo:
  check(!nomeDivergeDoInformado('Daniel', 'Daniel Ribeiro'), 'nome completo sobre o curto nao diverge');
  check(!nomeDivergeDoInformado('Daniel Ribeiro', 'Daniel'), 'e o contrario tambem nao');
  check(!nomeDivergeDoInformado('JOSE DA SILVA', 'José da Silva'), 'acento e caixa nao contam');
  check(!nomeDivergeDoInformado('[NOVO] (51) 99999-9999', 'Daniel'), 'cadastro de anuncio e buraco, nao contradicao');

  // Sem um dos dois lados nao ha o que comparar.
  check(!nomeDivergeDoInformado('', 'Daniel'), 'cadastro vazio nao diverge');
  check(!nomeDivergeDoInformado('Daniel', ''), 'sem nome informado nao diverge');
  check(!nomeDivergeDoInformado(null, null), 'nulo nao quebra');

  // Pontuacao no meio nao inventa divergencia.
  check(!nomeDivergeDoInformado('Daniel R. Ribeiro', 'Daniel R Ribeiro'), 'ponto nao conta');

  // E o caso que TEM que marcar: dois nomes de gente, diferentes.
  check(nomeDivergeDoInformado('Maria Souza', 'Joana Prado'), 'nomes diferentes divergem');
}

fim();
