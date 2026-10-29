/**
 * Testa a regra que decide QUANDO o dossiê "quem é quem" vale o custo.
 *
 * Pedido dele (01/09/2026): *"o dossiê deve ser consultado somente quando for necessário"*. O
 * dossiê custa ~1.284 tokens em toda chamada, e quase toda conversa é "Amém", "obrigado", nome e
 * cidade — nenhuma delas precisa saber quem é vice de quem.
 *
 * A regra erra para o lado de INCLUIR: sem dossiê a IA decide sobre nome que não conhece, que é o
 * problema que ele existe para resolver; incluir à toa custa meio centavo.
 */

import { check, grupo, fim, lib } from './_harness.mjs';

const { precisaDoDossie } = await lib('gabinete.js');

grupo('NÃO precisa: a conversa comum, que é a maioria');
{
  check(!precisaDoDossie(['Amém 🙏 🙏']), 'amém');
  check(!precisaDoDossie(['Obrigado pela atenção']), 'agradecimento');
  check(!precisaDoDossie(['Maria Silva / Canoas']), 'resposta ao formulário');
  check(!precisaDoDossie(['Erechim rgds']), 'só a cidade');
  check(!precisaDoDossie(['Bom dia!']), 'saudação');
  check(!precisaDoDossie(['Preciso de ajuda com uma cesta básica']), 'pedido de ajuda (escala por outra regra, não precisa do dossiê)');
  check(!precisaDoDossie([]), 'sem mensagem');
  check(!precisaDoDossie(['']), 'mensagem vazia');
}

grupo('PRECISA: quando a decisão depende de saber quem é quem');
{
  check(precisaDoDossie(['Qual é o número dele para eu votar?']), 'pergunta o número');
  check(precisaDoDossie(['vou votar no Zucco']), 'cita nome da chapa');
  check(precisaDoDossie(['O Capitão Martim é candidato a quê?']), 'pergunta o cargo');
  check(precisaDoDossie(['ele é de qual partido?']), 'pergunta o partido');
  check(precisaDoDossie(['quem é o vice do Zucco?']), 'pergunta quem é quem');
  check(precisaDoDossie(['Digito 22 na urna?']), 'fala em urna');
  check(precisaDoDossie(['esse deputado apoia quem para governador?']), 'cargo e apoio');
  check(precisaDoDossie(['sou do Republicanos']), 'cita o partido pelo nome');
}

grupo('acento não pode furar o gatilho');
{
  // O texto é normalizado antes: "eleição" e "eleicao" têm que dar o mesmo resultado. É a
  // armadilha do `\b` antes de palavra acentuada, registrada no CLAUDE.md.
  check(precisaDoDossie(['quando é a eleição?']), 'com acento');
  check(precisaDoDossie(['quando e a eleicao?']), 'sem acento');
  check(precisaDoDossie(['CAPITÃO MARTIM']), 'caixa alta com acento');
}

/**
 * **A pergunta de FÉ puxa o dossiê** — print de 08/09/2026.
 *
 * A contato escreveu *"ESTÁ BEM! OBRIGADA É CRISTÃO OU COMUNISTA?"* e, na mensagem seguinte, falou
 * de partido. Foi o "partido" que puxou o dossie; a pergunta da fe sozinha nao puxaria nada — e ela
 * e das mais diretas que chegam nesta base.
 */
{
  grupo('fe: a pergunta puxa o dossie (08/09)');

  for (const t of [
    'É CRISTÃO OU COMUNISTA?',
    'ele é católico?',
    'voces sao evangelicos?',
    'qual a religião dele',
    'ele frequenta alguma igreja?',
    'sou pastor e queria saber',
  ]) {
    check(precisaDoDossie([t]), `puxa: "${t}"`);
  }

  /**
   * **"Deus" e "fé" ficaram de FORA de proposito.** Sao o fecho de boa parte das mensagens desta
   * base — com elas na lista o dossie entraria em quase toda chamada, e ele existe para entrar so
   * quando a conversa pede (pedido dele, 01/09). Estas asercoes travam essa decisao.
   */
  for (const t of [
    'Deus abençoe você e sua família',
    'tenha fé, vai dar tudo certo',
    'amém, que Deus te proteja',
    'Bom dia, tudo bem?',
  ]) {
    check(!precisaDoDossie([t]), `NAO puxa (e nao pode puxar): "${t}"`);
  }
}

/**
 * **O que ele FOI puxa o dossie** — print do Fernando Britto (10/09/2026): perguntaram se ele foi
 * bombeiro e comandante dos salva-vidas, e o rascunho respondeu *"vou verificar e volto"*. A carreira
 * (Marinha, 2005-2020) esta no dossie desde 01/09 — e a pergunta sem o nome dele nao o puxava.
 */
{
  grupo('carreira: o que ele foi puxa o dossie (o Fernando, 10/09)');

  for (const t of [
    'ele era dos bombeiros, foi cmt dos salva vidas no Imbe?',
    'ele foi bombeiro?',
    'era da Marinha ou do Exército?',
    'ele é militar?',
    'qual a profissão dele antes de ser deputado?',
    'o que ele fazia antes?',
    'foi comandante de onde?',
  ]) {
    check(precisaDoDossie([t]), `puxa: "${t}"`);
  }

  /**
   * **O anuncio das Escolas Civico-Militares chega em quase toda conversa** — `militar` depois de
   * hifen nao pode puxar, senao o dossie entra em toda chegada. Estas asercoes travam isso.
   */
  for (const t of [
    'Olá! Eu apoio as Escolas Cívico-Militares 🤝',
    'sou a favor da escola cívico-militar',
    'obrigado pelo trabalho, bom dia',
  ]) {
    check(!precisaDoDossie([t]), `NAO puxa (e nao pode puxar): "${t}"`);
  }

  /** **E a regra de o que responder esta na parte do arquivo que chega a IA** (linhas `> ` saem). */
  const { readFileSync } = await import('node:fs');
  const md = readFileSync(new URL('../src/data/gabinete.md', import.meta.url), 'utf8')
    .split('\n').filter((l) => !l.startsWith('> ')).join('\n').split('## Espaço do Thiago')[0];
  check(/Marinha do Brasil \(2005–2020\)/.test(md), 'a carreira dele esta no que vai para o prompt');
  check(/o que o Capitão Martim FOI ou FEZ/.test(md), 'e a regra de responder com ela, tambem');
  check(/não diga que vai verificar e voltar/.test(md), 'sem "vou verificar e volto"');
}

/**
 * **Emendas, leis e projetos do material do mandato** (10/09/2026). O conteudo tem que chegar ao
 * prompt, e a pergunta sobre ele tem que PUXAR o dossie.
 */
{
  grupo('emendas, leis e projetos: o material do mandato (10/09)');

  for (const t of [
    'tem alguma emenda pra minha cidade?',
    'quais projetos ele tem?',
    'ele fez alguma lei?',
    'o que o deputado fez por Caxias?',
    'o que vocês fizeram pela segurança',
  ]) {
    check(precisaDoDossie([t]), `puxa: "${t}"`);
  }
  for (const t of ['Amém, Deus abençoe', 'bom dia, tudo bem?', 'obrigado pelo material']) {
    check(!precisaDoDossie([t]), `NAO puxa: "${t}"`);
  }

  const { readFileSync } = await import('node:fs');
  const md = readFileSync(new URL('../src/data/gabinete.md', import.meta.url), 'utf8')
    .split('\n').filter((l) => !l.startsWith('> ')).join('\n').split('## Espaço do Thiago')[0];
  check(/R\$ 6,95 milhões em 39 municípios/.test(md), 'o total das emendas chega ao prompt');
  check(/\*\*Caxias do Sul\*\* — R\$ 500 mil/.test(md), 'e a emenda de cada cidade');
  check((md.match(/^- \*\*[^*]+\*\* — R\$ /gm) || []).length === 39, 'as 39 cidades, nem uma a mais');
  check(/Lei 16\.487\/2026/.test(md), 'as leis aprovadas');
  check(/nunca\s+\*"aprovou"\*/.test(md), 'e a regra: projeto apresentado nao e lei aprovada');
  check(/Nunca prometa emenda/.test(md) && /nem ligue emenda a\s+voto/.test(md), 'emenda nunca e prometida nem ligada a voto');
  check(/16\.515\/2026\*\* a esta lei e à de baixo/.test(md), 'o numero repetido esta marcado para conferir');
  check(!/PL 424\/2023\*\* \| \*\*Programa Defesa Civil/.test(md), 'a tabela antiga, toda [CONFERIR], saiu');
}

/**
 * A TABELA DA CHAPA É LIDA POR CÓDIGO, e quebrá-la não faz barulho nenhum.
 *
 * `gabinete.chapaDoDossie` pega `cargo`, `nome` e `número` **por posição**, e o resultado alimenta
 * `ia.conferirChapa` — a trava que impede o rascunho de colar o número de um no nome de outro.
 * Mexer na tabela e desarmar a trava é a MESMA edição: em 14/10/2026 o partido foi parar dentro da
 * célula do nome (*"Flávio Bolsonaro (PL)"*) e a trava, que procura o nome literal no texto,
 * deixaria de achar a pessoa — **parando de barrar em silêncio**, sem teste nenhum caindo.
 */
grupo('a tabela da chapa continua legível pelo código');
{
  const { chapaDoDossie } = await lib('gabinete.js');
  const { readFileSync } = await import('node:fs');
  const md = readFileSync(new URL('../src/data/gabinete.md', import.meta.url), 'utf8');
  const chapa = chapaDoDossie(md);

  check(chapa.length === 6, `a chapa tem as 6 linhas (veio ${chapa.length})`);

  // Nome LIMPO: é ele que `conferirChapa` procura no rascunho, literal.
  for (const p of chapa) {
    check(!/[()]/.test(p.nome), `"${p.nome}" sem parenteses no nome`);
    check(/^\d+$/.test(p.numero), `"${p.nome}" com numero so de digitos ("${p.numero}")`);
  }

  const porCargo = Object.fromEntries(chapa.map((p) => [p.nome, `${p.cargo}|${p.numero}`]));
  check(porCargo['Capitão Martim'] === 'Deputado Estadual|10122', 'Capitao Martim: estadual, 10122');
  check(porCargo['Felipe Pedri'] === 'Deputado Federal|2228', 'Felipe Pedri: federal, 2228');
  check(porCargo['Marcel Van Hattem'] === 'Senador|300', 'Van Hattem: senador, 300');
  check(porCargo['Sanderson'] === 'Senador|222', 'Sanderson: senador, 222');
  check(porCargo['Zucco'] === 'Governador|22', 'Zucco: governador, 22');
  check(porCargo['Flávio Bolsonaro'] === 'Presidente|22', 'Flavio Bolsonaro: presidente, 22');
}

/**
 * A ELEIÇÃO DE 04/10/2026 JÁ ACONTECEU, e o arquivo tem de dizer isso antes de qualquer número.
 * Sem estas linhas o dossiê volta a pedir voto em eleição decidida — o defeito que a pesquisa de
 * 14/10 veio consertar.
 */
grupo('o dossie sabe que a eleicao acabou');
{
  const { readFileSync } = await import('node:fs');
  const md = readFileSync(new URL('../src/data/gabinete.md', import.meta.url), 'utf8');

  check(/A ELEIÇÃO JÁ ACONTECEU/.test(md), 'o aviso esta no topo, antes dos numeros');
  check(/NÃO PEÇA VOTO para deputado, senador ou governador/.test(md), 'a proibicao de pedir voto');
  check(/25\/10\/2026/.test(md), 'a data do segundo turno');
  check(/REELEITO/.test(md) && /37\.589/.test(md), 'o resultado dele');
  check(/NÃO ELEITO/.test(md) && /12\.810/.test(md), 'o resultado do Pedri');
  check(
    !/\*\*Candidato à reeleição como deputado estadual\*\*/.test(md),
    'a frase no futuro ("candidato a reeleicao") saiu'
  );
}

/**
 * **O CARGO NA DEFESA CIVIL — anúncio de 29/10/2026** (pedido dele: *"atualize o dossiê com o
 * anúncio de hoje do zucco"*). Zucco indicou o Capitão Martim para a Secretaria de Proteção e
 * Defesa Civil, e o governo toma posse em 06/01/2027.
 *
 * **O risco que estas asserções travam é de TEMPO VERBAL:** hoje ele é deputado, e o cargo começa
 * em janeiro. A IA dizendo *"ele é secretário"* é a família do *"já encaminhei seu pedido"*
 * (06/09) — afirmar como feito o que ainda não aconteceu, num fato que o eleitor confere no
 * jornal.
 */
grupo('o dossie sabe do cargo na Defesa Civil, e sabe que ele ainda nao o ocupa');
{
  const { readFileSync } = await import('node:fs');
  const md = readFileSync(new URL('../src/data/gabinete.md', import.meta.url), 'utf8');

  check(/Defesa Civil/.test(md) && /29\/10\/2026/.test(md), 'o anuncio e a data estao no dossie');
  check(/ANUNCIADO em 29\/10\/2026/.test(md), 'o titulo da secao diz ANUNCIADO, nao "e secretario"');
  check(/06\/01\/2027/.test(md), 'e a posse do governo esta escrita');
  check(/Que ele JÁ É secretário/.test(md),
    'esta na lista do que a IA NUNCA afirma — hoje ele e deputado');
  check(/Eliana Bayer\*\* `\[CONFERIR\]`/.test(md),
    'a vaga da suplente ficou CONFERIR: uma fonte so, e licenciar nao e renunciar');
  check(/Boeira[\s\S]{0,120}`\[CONFERIR\]`/.test(md), 'a permanencia do Cel. Boeira tambem');
  check(/nunca prometer vaga, contratação, estágio nem indicação/.test(md),
    'a pasta nao e balcao: nenhuma promessa de vaga');
  check(/193/.test(md) && /199/.test(md),
    'quem esta em emergencia AGORA vai para os canais de emergencia, nao para o mandato');

  /**
   * **Conteúdo novo no dossiê precisa de GATILHO** (a lição de 10/09). Medido antes de escrever:
   * de oito perguntas que este anúncio gera, TRÊS não puxavam o dossiê.
   */
  check(precisaDoDossie(['ele vai assumir a Defesa Civil?']), 'a pergunta sem o nome dele puxa');
  check(precisaDoDossie(['parabéns pela secretaria!']), 'o parabens puxa');
  check(precisaDoDossie(['vi no jornal que ele foi nomeado, procede?']), 'o "foi nomeado" puxa');
  check(precisaDoDossie(['quem é o suplente dele?']), 'e a pergunta da vaga tambem');

  /** E o ruído desta base continua NÃO puxando — o dossiê existe para entrar quando a conversa pede. */
  check(!precisaDoDossie(['Bom dia, Deus abençoe']), 'saudacao com fe nao puxa');
  check(!precisaDoDossie(['preciso de ajuda com remédio']), 'pedido de ajuda nao puxa');
}

fim();
