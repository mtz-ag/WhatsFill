/**
 * Os anuncios do momento: o texto que reconhece e o que fazer com ele.
 *
 * O que este arquivo protege e a metade que MANDA MENSAGEM. Um anuncio mal peneirado nao da erro
 * ao salvar — da na hora de enviar, no meio de uma rodada, com o contato aberto. E como a lista e
 * editada a mao numa tela de configuracao, tudo aqui e entrada nao confiavel.
 *
 * Rode: node tests/anuncios.test.mjs
 */
import { check, grupo, fim } from './_harness.mjs';
import * as anuncios from '../src/lib/anuncios.js';

const a = (extra) => ({ id: 'x', nome: 'teste', trechos: [], acao: 'fluxo', valor: '', etiquetas: [], ligado: true, ...extra });

grupo('reconhecer pelo texto');
{
  const lista = [
    a({ id: 'ecm', nome: 'Escolas CM', trechos: ['Eu apoio as Escolas Cívico-Militares'], acao: 'modelo', valor: 'Escolas CM' }),
    a({ id: 'evt', nome: 'Evento', trechos: ['quero participar do evento'], acao: 'dados' }),
  ];

  const r = anuncios.reconhecer(['Olá! Eu apoio as Escolas Cívico-Militares 🇧🇷'], lista);
  check(r?.anuncio.id === 'ecm', 'casa o trecho contido na mensagem');

  /**
   * Emoji, reticencias e cortes vem no texto do anuncio, e copiar a mensagem inteira nunca
   * bateria. Casar por trecho CONTIDO e o que torna a tela usavel.
   */
  check(anuncios.reconhecer(['eu apoio as escolas civico-militares'], lista)?.anuncio.id === 'ecm', 'acento e caixa nao importam');
  check(anuncios.reconhecer(['bom dia'], lista) === null, 'texto que nao casa devolve nada');
  check(anuncios.reconhecer([], lista) === null, 'conversa vazia devolve nada');
  check(anuncios.reconhecer(['oi'], []) === null, 'lista vazia devolve nada');

  // A mensagem do anuncio pode nao ser a primeira: a print da Erenita (01/09) tinha uma figura
  // antes. Por isso a busca e na conversa inteira, e nao na ultima mensagem.
  check(anuncios.reconhecer(['oi', 'tudo bem?', 'quero participar do evento'], lista)?.anuncio.id === 'evt', 'olha a conversa inteira, nao so a ultima');
}

grupo('o mais especifico ganha');
{
  /**
   * Dois anuncios da mesma campanha compartilham a abertura. Sem o desempate por tamanho quem
   * ganharia e a ordem da lista — invisivel na tela, e mudando quando ele reordena.
   */
  const lista = [
    a({ id: 'geral', trechos: ['eu apoio'], acao: 'dados' }),
    a({ id: 'escolas', trechos: ['eu apoio as escolas'], acao: 'modelo', valor: 'Escolas CM' }),
  ];
  check(anuncios.reconhecer(['Olá! Eu apoio as Escolas Cívico-Militares'], lista)?.anuncio.id === 'escolas', 'o trecho maior vence, na ordem escrita');
  check(anuncios.reconhecer(['Olá! Eu apoio as Escolas'], [...lista].reverse())?.anuncio.id === 'escolas', 'e vence na ordem invertida tambem');
}

grupo('anuncio desligado sai da disputa');
{
  const lista = [a({ id: 'velho', trechos: ['eu apoio'], acao: 'modelo', valor: 'M', ligado: false })];
  check(anuncios.reconhecer(['eu apoio'], lista) === null, 'campanha que acabou nao casa mais');
  // Desligar guarda o texto: e o que permite voltar a campanha sem digitar de novo.
  check(anuncios.normalizar(lista)[0].trechos.length === 1, 'e o texto continua guardado');
}

grupo('a peneira do que veio do armazenamento');
{
  check(anuncios.normalizar(null).length === 0, 'lista ausente vira lista vazia');
  check(anuncios.normalizar('nada').length === 0, 'lista que nao e lista vira lista vazia');
  check(anuncios.normalizar([null, 3, 'x']).length === 0, 'item que nao e objeto e descartado');

  /**
   * Acao desconhecida CAI PARA `fluxo` em vez de descartar o anuncio: perder o registro apagaria
   * os trechos que ele digitou, e `fluxo` e o desfecho mais conservador que existe aqui — reconhece
   * e devolve a decisao ao quadro.
   */
  const caiu = anuncios.normalizar([{ nome: 'x', trechos: ['a'], acao: 'mandar-pix' }]);
  check(caiu[0].acao === 'fluxo', 'acao inventada cai para "deixar o fluxo decidir"');
  check(caiu[0].trechos[0] === 'a', 'e os trechos sobrevivem');

  const limpo = anuncios.normalizar([{ trechos: ['  ', 'ok  ', null], etiquetas: ['ADS', '', null] }]);
  check(limpo[0].trechos.length === 1 && limpo[0].trechos[0] === 'ok', 'trecho vazio ou branco e descartado');
  check(limpo[0].etiquetas.length === 1, 'etiqueta vazia e descartada');
  check(!!limpo[0].id, 'item sem id ganha um');
  check(limpo[0].ligado === true, 'sem a marca, o anuncio nasce ligado');

  const repetido = anuncios.normalizar([{ id: 'k', trechos: ['a'] }, { id: 'k', trechos: ['b'] }]);
  check(repetido[0].id !== repetido[1].id, 'id repetido ganha id novo');

  const extra = anuncios.normalizar([{ id: 'k', trechos: ['a'], sair: true, enviarPix: 1 }]);
  check(!('sair' in extra[0]) && !('enviarPix' in extra[0]), 'campo desconhecido nao passa');
}

grupo('conferir avisa antes de a rodada precisar');
{
  const modelos = [{ name: 'Escolas CM' }, { name: 'Zucco, Capitão' }];
  const respostas = [{ id: 'pedir-dados' }, { id: 'agradecimento' }];

  check(anuncios.conferir([a({ nome: 'Sem texto', acao: 'dados' })], {}).some((m) => m.includes('sem nenhum texto')), 'anuncio sem texto e acusado');

  const semValor = anuncios.conferir([a({ trechos: ['x'], acao: 'modelo', valor: '' })], { modelos });
  check(semValor.some((m) => m.includes('nenhum modelo foi escolhido')), 'acao "modelo" sem modelo e acusada');

  const errado = anuncios.conferir([a({ trechos: ['x'], acao: 'modelo', valor: 'Nao Existe' })], { modelos });
  check(errado.some((m) => m.includes('nao esta entre os aprovados') || m.includes('não está entre os aprovados')), 'modelo fora dos aprovados e acusado');

  const certo = anuncios.conferir([a({ trechos: ['x'], acao: 'modelo', valor: 'escolas cm' })], { modelos });
  check(certo.length === 0, 'nome certo, com outra caixa, passa');

  /**
   * Sem a lista de modelos carregada o nome NAO e conferido: acusar o que nao se pode verificar
   * treina a ignorar o aviso, e o painel abre a Config antes de abrir atendimento.
   */
  check(anuncios.conferir([a({ trechos: ['x'], acao: 'modelo', valor: 'Nao Existe' })], {}).length === 0, 'sem a lista da plataforma, nao acusa nome de modelo');

  const doisIguais = anuncios.conferir([a({ trechos: ['x'], acao: 'modelo', valor: 'Serra' })], { modelos: [{ name: 'Serra' }, { name: 'Serra' }] });
  check(doisIguais.some((m) => m.includes('2 modelos')), 'dois modelos com o mesmo nome sao acusados');

  const respSumiu = anuncios.conferir([a({ trechos: ['x'], acao: 'resposta', valor: 'apagada' })], { respostas });
  check(respSumiu.some((m) => m.includes('nao existe mais') || m.includes('não existe mais')), 'resposta pronta que foi apagada e acusada');
  check(anuncios.conferir([a({ trechos: ['x'], acao: 'resposta', valor: 'pedir-dados' })], { respostas }).length === 0, 'resposta que existe passa');

  // Empate exato nao tem desempate: quem ganharia e a ordem da lista, invisivel para ele.
  const ambiguo = anuncios.conferir([
    a({ id: '1', nome: 'A', trechos: ['eu apoio'], acao: 'dados' }),
    a({ id: '2', nome: 'B', trechos: ['Eu Apoio'], acao: 'dados' }),
  ], {});
  check(ambiguo.some((m) => m.includes('só um dos dois vai valer') || m.includes('so um dos dois')), 'o mesmo texto em dois anuncios e acusado');

  /**
   * **A que faltava, e que custou um diagnostico dele.** Em 02/09/2026 ele cadastrou dois anuncios
   * com "so etiquetar e deixar o fluxo decidir" e SEM etiqueta nenhuma; o texto foi reconhecido
   * certo e o relato foi *"nao seguiu o fluxo"*. Estava tudo funcionando como configurado — e a
   * configuracao nao pedia nada. Configuracao que nao faz nada tem que dizer isso na cara.
   */
  const inerte = anuncios.conferir([a({ nome: 'ECM', trechos: ['x'], acao: 'fluxo', etiquetas: [] })], { modelos, respostas });
  check(inerte.some((m) => m.includes('nao faz nada') || m.includes('não faz nada')), 'anuncio que so devolve ao fluxo e nao etiqueta e acusado');

  // Com etiqueta ele FAZ algo: a etiqueta e o trabalho, e e como ele filtra por campanha depois.
  const comEtiqueta = anuncios.conferir([a({ trechos: ['x'], acao: 'fluxo', etiquetas: ['ADS Escolas'] })], { modelos, respostas });
  check(comEtiqueta.length === 0, 'com etiqueta, "deixar o fluxo decidir" e configuracao valida');

  check(anuncios.conferir([a({ trechos: ['x'], acao: 'dados' })], { modelos, respostas }).length === 0, 'acao que envia nao exige etiqueta nem valor');
}

grupo('a tabela antiga vem para ca sem perder nada');
{
  /**
   * Estrear esta tela sem a mudanca apagaria em silencio o reconhecimento que ja funcionava, e ele
   * descobriria pelo modelo que parou de sair.
   */
  const vindos = anuncios.deModeloPorTexto({ 'Olá! Eu apoio as Escolas Cívico-Militares': 'Escolas CM', 'quero o material': 'Zucco, Capitão' });
  check(vindos.length === 2, 'cada linha da tabela antiga vira um anuncio');
  check(vindos.every((v) => v.acao === 'modelo' && v.valor), 'todas com a acao "mandar modelo" e o modelo dela');
  check(vindos[0].trechos[0] === 'Olá! Eu apoio as Escolas Cívico-Militares', 'o trecho vira o texto que reconhece');

  // E o reconhecimento tem que continuar dando o mesmo resultado depois da mudanca.
  const r = anuncios.reconhecer(['Olá! Eu apoio as Escolas Cívico-Militares'], vindos);
  check(r?.anuncio.valor === 'Escolas CM', 'e reconhece igual ao que a tabela antiga reconhecia');

  check(anuncios.deModeloPorTexto({ '': 'M', 'x': '' }).length === 0, 'linha pela metade nao vira anuncio');
  check(anuncios.deModeloPorTexto(null).length === 0, 'tabela ausente nao quebra');
}

grupo('o catalogo de acoes e lista de PERMISSAO');
{
  check(anuncios.ACOES.every((x) => x.id && x.rotulo && 'efeito' in x), 'toda acao tem id, rotulo e efeito');
  check(!anuncios.acaoConhecida('texto-livre'), 'nao existe acao de escrever a mensagem aqui');
  check(anuncios.ACOES.every((x) => ['envia', 'depende', 'silencio', 'gente'].includes(x.efeito)), 'o efeito usa os mesmos nomes da janela do fluxo');

  // A tela le o desfecho por aqui, e ele tem que dizer quando falta escolher o alvo.
  check(anuncios.desfechoEmPortugues(a({ acao: 'modelo', valor: '' })).includes('falta escolher'), 'o resumo avisa quando falta o alvo');
  check(anuncios.desfechoEmPortugues(a({ acao: 'modelo', valor: 'M' })).includes('"M"'), 'e mostra o alvo quando tem');
}


grupo('o anuncio decide o que fazer -- e onde ele NAO decide');
{
  const resp = a({ id: 'ev', nome: 'Evento', trechos: ['x'], acao: 'resposta', valor: 'pedir-dados' });
  const dados = a({ id: 'novo', nome: 'Gente nova', trechos: ['x'], acao: 'dados' });
  const regra = { id: 'conteudo-pedido', tecla: '1' };

  const d1 = anuncios.decidirComAnuncio(resp, regra, 'envia');
  check(d1?.resposta === 'pedir-dados' && d1.tecla === null, 'acao "resposta" devolve a resposta pronta, sem tecla');
  check(d1.id === 'anuncio:ev', 'o id diz de qual anuncio veio (vai para o log e para o contador)');

  const d2 = anuncios.decidirComAnuncio(dados, regra, 'envia');
  check(d2?.tecla === '4', 'acao "dados" devolve a tecla que pede nome e cidade');

  check(anuncios.decidirComAnuncio(a({ trechos: ['x'], acao: 'fluxo' }), regra, 'envia') === null, '"deixar o fluxo decidir" nao muda nada');
  check(anuncios.decidirComAnuncio(a({ trechos: ['x'], acao: 'modelo', valor: 'M' }), regra, 'envia') === null, 'acao "modelo" nao passa por aqui -- sai pela tecla 1');
  check(anuncios.decidirComAnuncio(null, regra, 'envia') === null, 'sem anuncio, nada muda');
  check(anuncios.decidirComAnuncio({ ...resp, ligado: false }, regra, 'envia') === null, 'anuncio desligado nao decide');
  check(anuncios.decidirComAnuncio({ ...resp, valor: '' }, regra, 'envia') === null, 'acao "resposta" sem resposta escolhida nao decide');

  /**
   * A TRAVA, e o motivo dela: quem escreveu o texto do anuncio uma vez carrega esse texto na
   * conversa PARA SEMPRE. Sem isto, quem depois pediu para parar, se despediu ("amem") ou ganhou a
   * etiqueta que dispensa da fila voltaria a receber mensagem por causa de um texto de dias atras.
   * Foi exatamente o caso do "Amem" que recebeu mais uma mensagem 36 min depois.
   */
  check(anuncios.decidirComAnuncio(resp, { id: 'sem-interesse', tecla: 's' }, 'silencio') === null, 'quem recusou nao recebe a resposta do anuncio');
  check(anuncios.decidirComAnuncio(dados, { id: 'ultima-e-despedida', tecla: '3' }, 'silencio') === null, 'quem se despediu nao recebe o pedido de dados');
  check(anuncios.decidirComAnuncio(dados, { id: 'etiqueta-dispensa-da-fila', tecla: '3' }, 'silencio') === null, 'quem tem a etiqueta que dispensa fica de fora');

  // Regra que IA enviar de qualquer forma: ai o anuncio decide o QUE, que e a escolha dele.
  check(anuncios.decidirComAnuncio(resp, { id: 'conteudo-pedido', tecla: '1' }, 'envia')?.resposta === 'pedir-dados', 'sobre regra que ia enviar, o anuncio escolhe o que sai');

  // Nenhuma regra casou: o anuncio e quem tem resposta, e e para isso que ele existe.
  check(anuncios.decidirComAnuncio(dados, null, null)?.tecla === '4', 'sem regra nenhuma, o anuncio decide');
}


grupo('qual modelo sai na chegada: o do anuncio, ou o padrao');
{
  /**
   * *"o modelo agora sera feito pra cada anuncio especifico e sera mandado no momento que a pessoa
   * chegar pelo anuncio"* + *"caso o texto do anuncio nao seja reconhecido sera mandado o modelo
   * padrao"* (02/09/2026).
   */
  const comModelo = { anuncio: a({ id: 'ecm', acao: 'modelo', valor: 'Escolas CM' }), trecho: 'x' };

  check(anuncios.modeloDoAnuncio(comModelo, 'Padrao')?.nome === 'Escolas CM', 'anuncio reconhecido manda O DELE');
  check(anuncios.modeloDoAnuncio(comModelo, 'Padrao')?.deOnde === 'anuncio', 'e a tela consegue dizer de onde veio');

  check(anuncios.modeloDoAnuncio(null, 'Padrao')?.nome === 'Padrao', 'nao reconhecido manda o PADRAO');
  check(anuncios.modeloDoAnuncio(null, 'Padrao')?.deOnde === 'padrao', 'marcado como padrao, para a tela explicar');
  check(anuncios.modeloDoAnuncio(null, '') === null, 'sem padrao configurado, nao manda nada');
  check(anuncios.modeloDoAnuncio(null, null) === null, 'padrao ausente nao quebra');

  /**
   * **O padrao NAO cobre anuncio reconhecido com outra acao.** Ele configurou aquele anuncio para
   * mandar resposta pronta / pedir dados / devolver ao quadro, e escolha explicita dele nao se
   * substitui por deducao — nem por um padrao.
   */
  for (const acao of ['resposta', 'dados', 'fluxo']) {
    const outro = { anuncio: a({ id: 'z', acao, valor: acao === 'resposta' ? 'pedir-dados' : '' }), trecho: 'x' };
    check(anuncios.modeloDoAnuncio(outro, 'Padrao') === null, `acao "${acao}" nao vira modelo padrao`);
  }

  // Anuncio marcado para mandar modelo e sem modelo escolhido: nao cai no padrao caladinho -- e a
  // conferencia da Config que acusa isso, com o nome do anuncio.
  const semAlvo = { anuncio: a({ id: 'y', acao: 'modelo', valor: '' }), trecho: 'x' };
  check(anuncios.modeloDoAnuncio(semAlvo, 'Padrao') === null, 'anuncio de modelo sem modelo escolhido nao cai no padrao');

  // Aceita tanto o `{anuncio, trecho}` do `reconhecer` quanto o anuncio cru.
  check(anuncios.modeloDoAnuncio(a({ acao: 'modelo', valor: 'M' }), '')?.nome === 'M', 'aceita o anuncio cru tambem');
}


grupo('o rodizio do modelo padrao (02/09/2026)');
{
  /**
   * Pedido dele: *"o modelo padrao deve variar entre 3 modelos ja que chega bastante gente por
   * eles"*. Mesmo motivo das variacoes das respostas prontas -- quando muita gente chega pela mesma
   * porta, todo mundo receber a frase identica e o que faz a mensagem parecer robo.
   */
  const tres = ['A', 'B', 'C'];

  // Sete envios seguidos: A B C A B C A. O ponteiro e quem chama que grava, depois do envio.
  let i = 0;
  const saiu = [];
  for (let n = 0; n < 7; n++) { const d = anuncios.padraoDaVez(tres, i); saiu.push(d.nome); i = d.proximo; }
  check(saiu.join('') === 'ABCABCA', 'reveza na ordem e volta ao comeco: ' + saiu.join(' '));

  /**
   * **Nao avanca nada por conta propria.** A caixa da rodada mostra o nome ANTES de o envio
   * acontecer; se ler ja queimasse o rodizio, o proximo pularia sozinho em todo contato que ele
   * decidisse nao mandar. Mesma separacao de `templates.varianteAtual` / `avancarVariante`.
   */
  check(anuncios.padraoDaVez(tres, 1).nome === 'B', 'ler duas vezes devolve o mesmo');
  check(anuncios.padraoDaVez(tres, 1).nome === 'B', 'e de novo o mesmo');

  // Indice sujo nao pode virar `undefined`: o que sai daqui e mensagem para eleitor real.
  check(anuncios.padraoDaVez(tres, -3).nome === 'A', 'indice negativo cai no primeiro');
  check(anuncios.padraoDaVez(tres, 99).nome === 'A', 'indice fora da lista da a volta');
  check(anuncios.padraoDaVez(tres, null).nome === 'A', 'indice ausente cai no primeiro');
  check(anuncios.padraoDaVez(tres, 1.5).nome === 'A', 'indice quebrado cai no primeiro');

  // Um modelo so: o rodizio existe e sempre devolve ele -- sem caso especial em quem chama.
  const um = anuncios.padraoDaVez(['So Esse'], 0);
  check(um.nome === 'So Esse' && um.proximo === 0, 'com um modelo, o proximo continua sendo ele');

  check(anuncios.padraoDaVez([], 0) === null, 'lista vazia devolve nada');
  check(anuncios.padraoDaVez(['', '  '], 0) === null, 'lista so com vazios devolve nada');
  check(anuncios.padraoDaVez(['A', '', 'B'], 1).nome === 'B', 'vazio no meio nao entra no rodizio');

  // A versao anterior guardava um TEXTO unico. Aceitar os dois formatos e o que evita migracao.
  check(anuncios.padraoDaVez('Antigo', 0).nome === 'Antigo', 'aceita o texto unico da versao antiga');

  // E o rodizio chega inteiro em `modeloDoAnuncio`, que e quem o painel chama.
  const d = anuncios.modeloDoAnuncio(null, tres, 2);
  check(d.nome === 'C' && d.deOnde === 'padrao' && d.proximo === 0, 'modeloDoAnuncio devolve o da vez e o proximo');

  // O modelo especifico de um anuncio NAO tem rodizio: e escolha dele para aquele anuncio.
  const especifico = anuncios.modeloDoAnuncio({ anuncio: a({ acao: 'modelo', valor: 'ECM' }) }, tres, 2);
  check(especifico.nome === 'ECM' && especifico.proximo === undefined, 'modelo de anuncio nao reveza');
}

grupo('o anuncio e reconhecido pelo DADO da plataforma, nao so pelo que ela digitou (02/09/2026)');
{
  /**
   * Print da Ines (02/09): contato com etiqueta ADS -- chegou por anuncio -- e a caixa oferecendo o
   * modelo generico. *"nao reconheceu o anuncio"*.
   *
   * `reconhecer` lia so o que ELA escreveu. Quem chega pelo anuncio e nao repete o texto dele, ou
   * repete com outra redacao, ficava sem anuncio reconhecido -- mesmo com a plataforma dizendo de
   * qual campanha veio. E a regra ja escrita no projeto: a origem do anuncio e DADO, nao texto.
   */
  const doMomento = [
    {
      id: 'a1',
      nome: 'Escolas Civico-Militares',
      ligado: true,
      trechos: ['Campanha Escolas Civico Militares', 'Eu apoio as Escolas Civico-Militares'],
      acao: 'modelo',
      etiquetas: ['ADS ECM'],
    },
  ];

  // Como era: ela nao repete o texto do anuncio, so cumprimenta.
  const soOQueElaEscreveu = anuncios.reconhecer(['Oi, boa tarde'], doMomento);
  check(soOQueElaEscreveu === null, 'sem o dado da plataforma, nao reconhece nada');

  /**
   * Como e agora: o nome da campanha vem junto. E o identificador que existe mesmo quando ela nao
   * escreve nada -- e o unico que continua valendo quando ela responde com uma figura.
   */
  const comACampanha = anuncios.reconhecer(['Oi, boa tarde', 'Campanha Escolas Civico Militares'], doMomento);
  check(comACampanha?.anuncio?.id === 'a1', `com o nome da campanha, reconhece (${comACampanha?.anuncio?.nome})`);

  // O link do anuncio tambem serve como trecho, e e o mais estavel de todos.
  const porLink = anuncios.reconhecer(
    ['Oi', 'https://fb.me/ecm-rs-2026'],
    [{ ...doMomento[0], trechos: ['fb.me/ecm-rs-2026'] }]
  );
  check(porLink?.anuncio?.id === 'a1', 'o link da campanha tambem reconhece');

  // E o que ela digita continua valendo, porque nem todo anuncio traz campanha preenchida.
  const peloTexto = anuncios.reconhecer(['Eu apoio as Escolas Civico-Militares'], doMomento);
  check(peloTexto?.anuncio?.id === 'a1', 'o texto que ela escreveu continua reconhecendo');

  /**
   * **A generica nao pode vencer a especifica.** Com campanha E texto, ganha o trecho mais longo --
   * que ja era a regra de `reconhecer`, e continua sendo com o dado no meio.
   */
  const dois = [
    { id: 'curto', nome: 'curto', ligado: true, trechos: ['Escolas'], acao: 'modelo', etiquetas: [] },
    { id: 'longo', nome: 'longo', ligado: true, trechos: ['Campanha Escolas Civico Militares'], acao: 'modelo', etiquetas: [] },
  ];
  check(anuncios.reconhecer(['Campanha Escolas Civico Militares'], dois)?.anuncio?.id === 'longo', 'o trecho mais especifico vence');

  // Anuncio desligado continua sem reconhecer, venha o texto de onde vier.
  const desligado = [{ ...doMomento[0], ligado: false }];
  check(anuncios.reconhecer(['Campanha Escolas Civico Militares'], desligado) === null, 'anuncio desligado nao reconhece nem pelo dado');
}

grupo('a acao do anuncio nao vale para sempre (03/09/2026)');
{
  /**
   * Duas anotacoes, a mesma regra:
   *
   *  - **Lucia** respondeu ao convite, deu nome e cidade e confirmou presenca -- e a caixa mandava
   *    de novo a resposta pronta do anuncio: *"so concluir, ela confirmou minha mensagem"*;
   *  - **Deoclecio** ja tinha mandado meia duzia de videos depois disso, e a mesma resposta
   *    continuava sendo oferecida: *"o contexto se perdeu"*.
   *
   * A causa e a que o CLAUDE.md registra: o TEXTO do anuncio fica na conversa para sempre. A trava
   * que existia (`silencio`) cobre so quem decidiu nao mandar NADA.
   */
  const resposta = { id: 'a1', nome: 'Convite', ligado: true, trechos: ['estarei presente'], acao: 'resposta', valor: 'confirmar', etiquetas: [] };

  check(anuncios.decidirComAnuncio(resposta, null, null)?.resposta === 'confirmar', 'sem ter saido, o anuncio decide');
  check(anuncios.decidirComAnuncio(resposta, null, null, { jaSaiu: true }) === null, 'ja tendo saido, o anuncio se cala');
  check(anuncios.decidirComAnuncio(resposta, null, null, {}) !== null, 'objeto vazio nao conta como ja saiu');

  // A mesma coisa para a acao de pedir os dados.
  const dados = { ...resposta, acao: 'dados', valor: '' };
  check(anuncios.decidirComAnuncio(dados, null, null)?.tecla === '4', 'sem ter saido, pede os dados');
  check(anuncios.decidirComAnuncio(dados, null, null, { jaSaiu: true }) === null, 'ja tendo pedido, se cala');

  // E a protecao continua vencendo, cumprida ou nao: sao travas independentes.
  check(anuncios.decidirComAnuncio(resposta, { id: 'x' }, 'silencio') === null, 'a protecao continua vencendo');
}

fim();
