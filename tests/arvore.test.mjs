/**
 * A ÁRVORE do fluxo — o motor novo, que passa a decidir o que sai para eleitor.
 *
 * O que este arquivo protege, em ordem de importância:
 *
 * 1. **Ligar a árvore não muda nada.** `arvorePadrao()` é a tabela de hoje achatada, e ela tem que
 *    decidir IGUAL a `sugerirAcao` numa bateria de contextos. Se esta asserção cair, abrir a
 *    janela do fluxo muda o comportamento da rodada sem ninguém ter pedido.
 * 2. **Ramo pela metade não engole contato.** A árvore vai crescer "de acordo com a demanda", ou
 *    seja, vai ter nó sem ação no meio do caminho. Ele não pode parar a busca.
 * 3. **As protecões continuam acima da bifurcação** no preset do quadro dele — senão volta o erro
 *    de 01/09, que mandou material de campanha em cima de uma denúncia.
 *
 * Rode: node tests/arvore.test.mjs
 */
import { check, grupo, fim } from './_harness.mjs';
import * as arv from '../src/lib/arvore.js';
import * as cortesia from '../src/lib/cortesia.js';
import { sugerirAcao, REGRAS } from '../src/lib/sugestao.js';
import * as sugestaoLib from '../src/lib/sugestao.js';

/** As bandeiras que as dezesseis regras leem. A bateria liga e desliga estas. */
const BANDEIRAS = [
  'semInteresse',
  'etiquetaQueDispensa',
  'pedeRespostaPessoal',
  'respondeuComoAjudar',
  'pedeAlgoIndefinido',
  'podePerguntarAjuda',
  'ultimaEhDespedida',
  'voltouPorOutroAnuncio',
  'momentoJaEnviado',
  'podeMandarMomento',
  'rajadaEhSoRepasse',
  'jaPediramDados',
  'temEtiquetaDeCidade',
  'podePedirDados',
  'pedidoHoje',
  'ultimaEhSoReacao',
  'respondidoHoje',
  'perguntaAberta',
  'soExpressaApoio',
  'jaRespondemosAntes',
  'podeEnviar',
  'enviadoHoje',
  'modeloJaNaConversa',
  'nomeSemSentido',
  'podePerguntarInteresse',
  'interessePerguntado',
];

/** Gerador com semente: falha tem que ser reproduzível, senão o teste vira loteria. */
function semente(n) {
  let x = n >>> 0;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

grupo('ligar a arvore NAO muda nada: o padrao decide igual a tabela');
{
  const rnd = semente(20260901);
  const padrao = arv.arvorePadrao();
  let diferentes = 0;
  let primeiraDiferenca = null;

  for (let i = 0; i < 400; i++) {
    const ctx = {};
    for (const b of BANDEIRAS) ctx[b] = rnd() < 0.35;
    const daTabela = sugerirAcao(ctx);
    const daArvore = arv.decidir(ctx, padrao);

    const idTabela = daTabela?.id || null;
    const idArvore = daArvore ? String(daArvore.id).replace(/^r:/, '') : null;
    const igual = idTabela === idArvore && (daTabela?.tecla || null) === (daArvore?.tecla || null);
    if (!igual) {
      diferentes++;
      if (!primeiraDiferenca) primeiraDiferenca = { ctx, idTabela, idArvore, t1: daTabela?.tecla, t2: daArvore?.tecla };
    }
  }
  check(diferentes === 0, `400 contextos, mesma decisao (diferentes: ${diferentes}; ${JSON.stringify(primeiraDiferenca)})`);

  // E a tecla fixada por ele continua vencendo a do codigo, como vencia na tabela.
  const fluxo = { teclas: { 'ultima-e-despedida': '2' } };
  const t = arv.decidir({ ultimaEhDespedida: true }, padrao, fluxo);
  check(t?.tecla === '2', `tecla fixada vence tambem na arvore (${t?.tecla})`);

  // Desligar um no e o mesmo que desligar a regra: as de baixo passam a decidir.
  const semDespedida = arv.editar(padrao, 'r:ultima-e-despedida', { desligado: true });
  check(arv.decidir({ ultimaEhDespedida: true }, semDespedida) === null, 'no desligado nao decide');

  /**
   * A ordem que ele ja tinha na versao de LISTA vem junto ao semear a arvore. A assercao compara
   * com `ordenar`, e nao com uma ordem escrita a mao, porque a regra de heranca ("id que a ordem
   * salva nao conhece herda a posicao do vizinho de cima") e sutil: escrever a expectativa a mao
   * so testa se eu entendi a regra hoje. Comparar com a fonte trava as duas juntas para sempre.
   */
  const guardado = { ordem: ['conteudo-pedido', 'ultima-e-despedida'], desligadas: ['sem-interesse'] };
  const comOrdem = arv.arvorePadrao(guardado);
  const daLista = sugestaoLib.ordenar({ ordem: guardado.ordem }).map((r) => r.id);
  check(comOrdem.map((n) => n.regra).join() === daLista.join(), `a arvore nasce na ordem da lista (${comOrdem.slice(0, 3).map((n) => n.regra).join()})`);
  check(comOrdem.find((n) => n.regra === 'sem-interesse')?.desligado === true, 'e as desligadas continuam desligadas');
  check(comOrdem.length === REGRAS.length, 'nenhuma regra some na semeadura — nem as desligadas');
}

grupo('a arvore RAMIFICA: o filho vence, e o pai e a porta');
{
  const arvore = [
    {
      id: 'pai',
      rotulo: 'pessoa retornando',
      condicao: { sinal: 'jaRespondemosAntes' },
      acao: { tecla: '3' },
      filhos: [
        { id: 'f1', rotulo: 'bom dia', condicao: { palavras: ['bom dia'] }, acao: { tecla: '5' }, filhos: [] },
      ],
    },
    { id: 'irmao', rotulo: 'qualquer um', condicao: {}, acao: { tecla: '9' }, filhos: [] },
  ];

  const comFilho = arv.decidir({ jaRespondemosAntes: true, ultimoTexto: 'Bom dia!' }, arvore);
  check(comFilho?.id === 'f1' && comFilho.tecla === '5', `o filho especifico vence o pai (${comFilho?.id})`);
  check(comFilho?.caminho.join('>') === 'pai>f1', `o caminho volta inteiro (${comFilho?.caminho.join('>')})`);

  const soPai = arv.decidir({ jaRespondemosAntes: true, ultimoTexto: 'obrigado' }, arvore);
  check(soPai?.id === 'pai' && soPai.tecla === '3', 'nenhum filho casou: o pai decide');

  /**
   * **O pai e a PORTA.** Quem nao e retorno nao pode cair no "bom dia" de dentro dele, mesmo
   * escrevendo exatamente isso. E o que a arvore faz que a lista nao fazia.
   */
  const foraDaPorta = arv.decidir({ jaRespondemosAntes: false, ultimoTexto: 'Bom dia!' }, arvore);
  check(foraDaPorta?.id === 'irmao', `condicao do pai fecha a porta dos filhos (${foraDaPorta?.id})`);
}

grupo('ramo pela metade NAO engole o contato');
{
  /**
   * O caso que vai acontecer de verdade: ele cria "pediu ajuda financeira", sai para o almoco e
   * volta amanha para escolher a acao. Enquanto isso o no casa e nao resolve. Se a busca parasse
   * ali, o contato sairia da rodada sem nada acontecer e sem nada na tela dizendo por que.
   */
  const arvore = [
    { id: 'meio', rotulo: 'pediu ajuda', condicao: { palavras: ['ajuda'] }, acao: null, filhos: [] },
    { id: 'fim', rotulo: 'todo mundo', condicao: {}, acao: { tecla: '4' }, filhos: [] },
  ];
  const r = arv.decidir({ ultimoTexto: 'preciso de ajuda' }, arvore);
  check(r?.id === 'fim', `no sem acao deixa o fluxo seguir (${r?.id})`);

  // E a janela avisa que ele esta pela metade, com o nome dele na frase.
  const avisos = arv.problemas(arvore);
  check(avisos.some((a) => a.includes('pediu ajuda') && a.includes('nao faz nada'.replace('nao', 'não'))), `a janela avisa (${JSON.stringify(avisos)})`);
}

grupo('palavras: acento, caixa e onde procurar');
{
  const um = (palavras, onde) => [{ id: 'x', rotulo: 'x', condicao: { palavras, onde }, acao: { tecla: '5' }, filhos: [] }];

  check(arv.decidir({ ultimoTexto: 'Bom Dia!' }, um(['bom dia']))?.tecla === '5', 'caixa alta casa');
  check(arv.decidir({ ultimoTexto: 'BOA TARDE, tudo bem?' }, um(['boa tarde']))?.tecla === '5', 'no meio da frase casa');
  check(arv.decidir({ ultimoTexto: 'preciso de remédio' }, um(['remedio']))?.tecla === '5', 'acento nao atrapalha');
  check(arv.decidir({ ultimoTexto: 'oi' }, um(['bom dia'])) === null, 'o que nao casa, nao casa');

  // `ultima` e o padrao: o fluxo e sobre o que ela ACABOU de fazer.
  const conversa = { textos: ['bom dia', 'na verdade era outra coisa'], ultimoTexto: 'na verdade era outra coisa' };
  check(arv.decidir(conversa, um(['bom dia'])) === null, 'por padrao olha so a ultima mensagem');
  check(arv.decidir(conversa, um(['bom dia'], 'qualquer'))?.tecla === '5', 'com "qualquer" varre a conversa toda');

  // Sinal e palavras juntos sao E, nao OU.
  const eee = [{ id: 'x', rotulo: 'x', condicao: { sinal: 'jaRespondemosAntes', palavras: ['bom dia'] }, acao: { tecla: '5' }, filhos: [] }];
  check(arv.decidir({ jaRespondemosAntes: true, ultimoTexto: 'bom dia' }, eee)?.tecla === '5', 'sinal E palavra casam juntos');
  check(arv.decidir({ jaRespondemosAntes: false, ultimoTexto: 'bom dia' }, eee) === null, 'faltando o sinal, nao casa');
  check(arv.decidir({ jaRespondemosAntes: true, ultimoTexto: 'oi' }, eee) === null, 'faltando a palavra, nao casa');

  // Negar e condicao legitima: "ainda NAO recebeu o formulario".
  const negado = [{ id: 'x', rotulo: 'x', condicao: { sinal: 'jaPediramDados', negar: true }, acao: { tecla: '4' }, filhos: [] }];
  check(arv.decidir({ jaPediramDados: false }, negado)?.tecla === '4', 'sinal negado casa quando o sinal e falso');
  check(arv.decidir({ jaPediramDados: true }, negado) === null, 'e nao casa quando ele e verdadeiro');
}

grupo('a acao pode ser uma RESPOSTA PRONTA, e nao so uma tecla');
{
  /**
   * Decisao dele (01/09), com o diagrama: "pediu ajuda financeira -> mensagem pronta + concluir".
   * O texto NEGA o pedido com respeito; o risco da Lei 9.504/97 e PROMETER beneficio, entao negar
   * nao infringe. A trava da IA (`RESTRITOS`) continua de pe: a IA segue sem poder escolher esse
   * texto sozinha. O que mudou e que um ramo ESCRITO POR ELE pode.
   */
  const arvore = [
    { id: 'ajuda', rotulo: 'pediu ajuda financeira', condicao: { palavras: ['ajuda financeira'] }, acao: { resposta: 'pedido-ajuda' }, filhos: [] },
  ];
  const r = arv.decidir({ ultimoTexto: 'preciso de ajuda financeira' }, arvore);
  check(r?.resposta === 'pedido-ajuda', `a decisao carrega a resposta pronta (${r?.resposta})`);
  check(r?.tecla === null, 'e nao carrega tecla nenhuma');
  check(!!r?.motivo, `e escreve um motivo para a tela (${r?.motivo})`);
}

grupo('edicao da arvore: pura, e sem perder ninguem pelo caminho');
{
  const base = [
    { id: 'a', rotulo: 'a', condicao: {}, acao: { tecla: '1' }, filhos: [] },
    { id: 'b', rotulo: 'b', condicao: {}, acao: { tecla: '2' }, filhos: [] },
    { id: 'c', rotulo: 'c', condicao: {}, acao: { tecla: '3' }, filhos: [] },
  ];
  const antes = JSON.stringify(base);

  check(arv.mover(base, 'c', -1).map((n) => n.id).join('') === 'acb', 'mover sobe entre os irmaos');
  check(arv.mover(base, 'a', -1).map((n) => n.id).join('') === 'abc', 'mover no topo nao faz nada');
  check(JSON.stringify(base) === antes, 'e a arvore original nao e tocada');


  const comFilho = arv.acrescentar(base, 'a', { ...arv.noVazio('novo'), id: 'z' });
  check(comFilho[0].filhos[0].id === 'z', 'acrescentar poe como filho');
  check(arv.acrescentar(base, null, { ...arv.noVazio('raiz'), id: 'w' }).length === 4, 'sem pai, acrescenta na raiz');

  // Apagar leva os filhos junto -- de proposito, ver o cabecalho do arvore.js.
  const paiComFilho = arv.acrescentar(base, 'a', { ...arv.noVazio('dentro'), id: 'dentro' });
  const semA = arv.apagar(paiComFilho, 'a');
  check(semA.length === 2 && !arv.localizar(semA, 'dentro'), 'apagar leva os filhos junto');

  check(arv.todosOsNos(paiComFilho).length === 4, 'todosOsNos conta os de dentro');
  check(arv.localizar(paiComFilho, 'dentro')?.pai?.id === 'a', 'localizar diz quem e o pai');
  check(arv.localizar(paiComFilho, 'nao-existe') === null, 'id inexistente nao explode');
}

grupo('problemas: o que a janela precisa mostrar em vermelho');
{
  const ruim = [
    { id: 'x', rotulo: 'sinal inventado', condicao: { sinal: 'naoExiste' }, acao: { tecla: '1' }, filhos: [] },
    { id: 'y', rotulo: 'tecla inventada', condicao: { palavras: ['oi'] }, acao: { tecla: 'z' }, filhos: [] },
    { id: 'w', rotulo: 'regra sumida', regra: 'regra-que-nao-existe', filhos: [] },
    { id: 'v', rotulo: 'nada', condicao: {}, acao: null, filhos: [] },
  ];
  const p = arv.problemas(ruim);
  check(p.some((a) => a.includes('naoExiste')), 'acusa sinal inexistente');
  check(p.some((a) => a.includes('tecla "z"')), 'acusa tecla inexistente');
  check(p.some((a) => a.includes('regra-que-nao-existe')), 'acusa regra que sumiu do codigo');
  check(p.some((a) => a.includes('"nada"')), 'acusa no que nao faz nada');
  check(arv.problemas(arv.arvorePadrao()).length === 0, 'e a arvore padrao nao tem problema nenhum');

  // Id repetido quebra a edicao na janela (os dois responderiam ao mesmo clique).
  const repetido = [
    { id: 'k', rotulo: 'um', condicao: {}, acao: { tecla: '1' }, filhos: [] },
    { id: 'k', rotulo: 'dois', condicao: {}, acao: { tecla: '2' }, filhos: [] },
  ];
  check(arv.problemas(repetido).some((a) => a.includes('id repetido')), 'acusa id repetido');

  // Ids novos nao colidem, nem criados no mesmo milissegundo.
  const ids = new Set(Array.from({ length: 50 }, () => arv.novoId()));
  check(ids.size === 50, `novoId nao repete (${ids.size}/50)`);
}

grupo('o desenho do QUADRO dele: as protecoes ficam acima da bifurcacao');
{
  const quadro = arv.fluxoPadrao();
  check(arv.problemas(quadro).length === 0, `o preset nasce sem problema (${JSON.stringify(arv.problemas(quadro))})`);

  /**
   * **A asserção que impede o erro de 01/09 de voltar.** O desenho dele nao tinha a regra da
   * denuncia; se o preset a deixasse de fora, quem responde "e sobre as irregularidades em
   * Eldorado do Sul" receberia material de campanha de novo. Aqui ela tem que vencer mesmo com
   * conteudo reconhecido e modelo mapeado.
   */
  const denuncia = arv.decidir({ respondeuComoAjudar: true, podeEnviar: true, jaRespondemosAntes: true }, quadro);
  check(denuncia?.tecla === '6', `denuncia respondida continua indo para gente (${denuncia?.tecla})`);

  // Hater vence tudo, dos dois lados da bifurcacao -- que e o que o desenho repetia duas vezes.
  const hater = arv.decidir({ semInteresse: true, jaRespondemosAntes: true, podeEnviar: true }, quadro);
  check(hater?.tecla === 's', `hater etiqueta e conclui (${hater?.tecla})`);

  // Os dois ramos que o desenho tinha e o codigo nao tinha.
  // Desde 02/09/2026 a caixa le o SINAL `soCortesia` (a mensagem e SO cumprimento?) e nao a
  // palavra "bom dia" contida -- ver a caixa "so cumprimentou, e nada mais".
  const bomDia = arv.decidir({ jaRespondemosAntes: true, soCortesia: { motivo: 'cumprimentou' } }, quadro);
  check(bomDia?.tecla === '5', `saudacao escrita manda a mensagem do momento (${bomDia?.tecla})`);

  const financeiro = arv.decidir({ jaRespondemosAntes: true, pedeAjudaFinanceira: { motivo: 'pix' } }, quadro);
  check(financeiro?.resposta === 'pedido-ajuda', `pedido financeiro tem resposta pronta (${financeiro?.resposta})`);

  /**
   * **Quem chega agora nao entra no ramo de quem esta voltando.** "anúncio — pessoa nova" tem a
   * condicao `jaRespondemosAntes` negada, entao o "bom dia" de dentro do outro ramo nao o alcanca.
   */
  const novaComBomDia = arv.decidir({ jaRespondemosAntes: false, jaPediramDados: false, podePedirDados: true, ultimoTexto: 'Bom dia!' }, quadro);
  check(novaComBomDia?.tecla === '4', `pessoa nova com "bom dia" recebe o formulario (${novaComBomDia?.tecla})`);
}

grupo('o motivo nomeia a palavra que a pessoa ESCREVEU');
{
  /**
   * O motivo aparece na caixa da rodada, em cima da decisao, e e o que ele le antes de apertar a
   * tecla. Listar as cinco palavras que o ramo procura nao diz nada sobre a pessoa; a que serve e
   * a que bateu. Peguei isto na tela, com o ramo de ajuda financeira.
   */
  const arvore = [
    {
      id: 'a',
      rotulo: 'pediu ajuda financeira',
      condicao: { palavras: ['ajuda financeira', 'cesta basica', 'remedio'] },
      acao: { resposta: 'pedido-ajuda' },
      filhos: [],
    },
  ];
  const r = arv.decidir({ ultimoTexto: 'minha filha precisa de remédio' }, arvore);
  check(r?.motivo.includes('remedio'), `nomeia a palavra que casou (${r?.motivo})`);
  check(!r?.motivo.includes('cesta basica'), 'e nao lista as que nao casaram');
  check(arv.palavraQueCasou(['bom dia'], { ultimoTexto: 'BOM DIA!' }) === 'bom dia', 'devolve a palavra como ele a escreveu');
  check(arv.palavraQueCasou(['oi'], { ultimoTexto: 'tchau' }) === null, 'e null quando nenhuma casa');
}
grupo('o QUADRO: arrastar para mover e para religar');
{
  const base = [
    { id: 'p', rotulo: 'pai', condicao: {}, acao: null, filhos: [{ id: 'f', rotulo: 'filho', condicao: {}, acao: { tecla: '5' }, filhos: [] }] },
    { id: 'o', rotulo: 'outro', condicao: {}, acao: { tecla: '3' }, filhos: [] },
  ];

  // Religar: arrastar "outro" para dentro de "pai".
  const dentro = arv.reparentar(base, 'o', 'p');
  check(dentro.length === 1 && dentro[0].filhos.map((n) => n.id).join() === 'f,o', `religou (${dentro[0].filhos.map((n) => n.id).join()})`);

  // E soltar na raiz devolve ao topo.
  const naRaiz = arv.reparentar(dentro, 'f', null);
  check(naRaiz.map((n) => n.id).join() === 'p,f', `soltar na raiz volta ao topo (${naRaiz.map((n) => n.id).join()})`);

  /**
   * **A guarda que impede o ramo de sumir.** Arrastar um pai para dentro do proprio filho
   * arrancaria o pedaco da arvore junto com o novo pai: some da tela e continua gravado. Na tela
   * "sumiu" e "esta no lugar errado" sao a mesma coisa, entao recusar sem mexer e o certo.
   */
  check(arv.reparentar(base, 'p', 'f') === base, 'nao deixa o pai virar filho do proprio filho');
  check(arv.reparentar(base, 'p', 'p') === base, 'nem filho de si mesmo');
  check(arv.ehDescendente(base, 'p', 'f') === true, 'ehDescendente enxerga o filho');
  check(arv.ehDescendente(base, 'f', 'p') === false, 'e nao enxerga o contrario');

  // Mover a caixa: com filhos, o ramo inteiro anda junto.
  const posto = arv.posicionar(arv.arrumar(base), 'p', 500, 300, true);
  const p = arv.localizar(posto, 'p').no;
  const filho = arv.localizar(posto, 'f').no;
  check(p.x === 500 && p.y === 300, `a caixa foi para onde ele soltou (${p.x},${p.y})`);
  check(filho.x > 500, `e o filho andou junto (${filho.x})`);

  const soEla = arv.posicionar(arv.arrumar(base), 'p', 500, 300, false);
  check(arv.localizar(soEla, 'f').no.x === arv.CAIXA.largura + arv.CAIXA.colunaVaga, 'sem "com filhos", so a caixa anda');

  /**
   * **A altura na tela E a prioridade.** Guardar uma ordem invisivel ao lado da posicao faria a
   * tela mostrar um ramo acima do outro e a rodada obedecer o contrario -- e ele decide a
   * prioridade OLHANDO o quadro.
   */
  const trocado = arv.ordenarPorPosicao([
    { id: 'baixo', rotulo: 'b', y: 400, condicao: {}, acao: { tecla: '3' }, filhos: [] },
    { id: 'cima', rotulo: 'c', y: 100, condicao: {}, acao: { tecla: '5' }, filhos: [] },
  ]);
  check(trocado.map((n) => n.id).join() === 'cima,baixo', `o mais alto vem primeiro (${trocado.map((n) => n.id).join()})`);
  check(arv.decidir({}, trocado)?.tecla === '5', 'e e ele que decide');

  // Arrumar: uma coluna por nivel, e o pai centrado nos filhos.
  const arrumada = arv.arrumar([
    { id: 'a', rotulo: 'a', condicao: {}, acao: null, filhos: [
      { id: 'a1', rotulo: 'a1', condicao: {}, acao: { tecla: '3' }, filhos: [] },
      { id: 'a2', rotulo: 'a2', condicao: {}, acao: { tecla: '3' }, filhos: [] },
    ] },
  ]);
  const raiz = arv.localizar(arrumada, 'a').no;
  const um = arv.localizar(arrumada, 'a1').no;
  const dois = arv.localizar(arrumada, 'a2').no;
  check(raiz.x === 0 && um.x === dois.x && um.x > 0, `filhos numa coluna a direita (${um.x})`);
  check(raiz.y === Math.round((um.y + dois.y) / 2), `o pai fica centrado nos filhos (${raiz.y} entre ${um.y} e ${dois.y})`);
  check(um.y !== dois.y, 'e os irmaos nao se empilham no mesmo ponto');

  check(arv.precisaArrumar(base) === true, 'arvore sem posicao pede arrumacao');
  check(arv.precisaArrumar(arrumada) === false, 'e arrumada nao pede mais');
  check(arv.precisaArrumar(arv.arrumar(arv.fluxoPadrao())) === false, 'o preset do quadro arruma inteiro');
}

grupo('o desfecho "a IA assume e responde"');
{
  /**
   * Pedido dele (01/09). Ate aqui a IA so entrava onde NENHUM ramo resolvia -- era o desfecho do
   * que ninguem previu. Agora ele pode apontar uma situacao e entregar aquela para ela, que e
   * outra coisa: uma escolha, nao um resto.
   */
  const arvore = [
    { id: 'd', rotulo: 'falou de denuncia', condicao: { palavras: ['irregularidade'] }, acao: { ia: true }, filhos: [] },
    { id: 'z', rotulo: 'o resto', condicao: {}, acao: { tecla: '4' }, filhos: [] },
  ];
  const r = arv.decidir({ ultimoTexto: 'quero falar de uma irregularidade' }, arvore);
  check(r?.ia === true, 'a decisao vem marcada para a IA');
  check(r?.tecla === null && r?.resposta === null, 'e sem tecla e sem resposta pronta: quem escolhe e ela');
  check(r?.id === 'd', 'e o ramo certo venceu');

  // Quem nao casa segue para o irmao, como qualquer outro desfecho.
  check(arv.decidir({ ultimoTexto: 'oi' }, arvore)?.tecla === '4', 'o irmao de baixo continua decidindo o resto');

  // E o ramo NAO e acusado de "nao faz nada" -- entregar para a IA e fazer algo.
  const acusados = arv.problemas(arvore);
  check(!acusados.some((m) => m.includes('falou de denuncia')), `entregar para a IA conta como acao (${JSON.stringify(acusados)})`);

  /**
   * Mas "o resto" E acusado, e com razao: manda a tecla 4 e nao tem condicao nenhuma, ou seja casa
   * de novo em TODA passada. E o detector que nasceu da caixa dele de 02/09 -- ver `repeteSozinha`.
   */
  check(acusados.some((m) => m.includes('"o resto"') && m.includes('mandar de novo')), 'caixa sem guarda que envia e acusada de repetir');

  const semNada = [{ id: 'x', rotulo: 'vazio', condicao: { palavras: ['oi'] }, acao: {}, filhos: [] }];
  check(arv.problemas(semNada).some((p) => p.includes('vazio')), 'e acao vazia continua sendo acusada');
}

grupo('salvar, carregar e levar para fora');
{
  const fluxo = { teclas: { 'ultima-e-despedida': '2', 'nao-existe': '9' }, arvore: arv.arrumar(arv.fluxoPadrao()), vitorias: { x: 5 } };
  const arquivo = arv.paraArquivo(fluxo, 'semana do evento');

  check(arquivo.formato === arv.FORMATO && arquivo.versao === arv.FORMATO_VERSAO, 'o arquivo leva a marca do formato');
  check(arquivo.nome === 'semana do evento', 'e o nome que ele deu');
  check(!('vitorias' in arquivo), 'as contagens NAO vao junto: sao medicao desta maquina, nao o fluxo');

  const volta = arv.deArquivo(JSON.stringify(arquivo));
  check(volta.ok === true, `o que sai volta (${volta.erro || ''})`);
  check(arv.todosOsNos(volta.arvore).length === arv.todosOsNos(fluxo.arvore).length, 'com todos os ramos');
  check(volta.teclas['ultima-e-despedida'] === '2', 'e com as teclas fixadas');
  check(!('nao-existe' in volta.teclas), 'tecla de regra inexistente e descartada, nao vira lixo invisivel');

  // O que sai e o que volta decidem IGUAL -- e a unica prova que importa.
  const ctx = { jaRespondemosAntes: true, ultimoTexto: 'Bom dia!' };
  const antes = arv.decidir(ctx, fluxo.arvore, fluxo);
  const depois = arv.decidir(ctx, volta.arvore, { teclas: volta.teclas });
  check(antes?.tecla === depois?.tecla, `a decisao sobrevive a ida e volta (${antes?.tecla} = ${depois?.tecla})`);
}

grupo('arquivo de fora e entrada NAO confiavel');
{
  /**
   * Um arquivo de fluxo decide o que a rodada manda para eleitor real. JSON.parse e usar seria
   * aceitar que qualquer coisa num campo vire comportamento -- e arquivo velho, depois de eu
   * renomear uma regra, viraria ramo morto e silencioso.
   */
  check(arv.deArquivo('{{{').ok === false, 'JSON quebrado e recusado');
  check(arv.deArquivo('{}').ok === false, 'objeto sem a marca do formato e recusado');
  check(arv.deArquivo(JSON.stringify({ formato: arv.FORMATO, versao: 1, arvore: [] })).ok === false, 'arquivo sem ramo e recusado');
  const doFuturo = arv.deArquivo(JSON.stringify({ formato: arv.FORMATO, versao: 99, arvore: [{ id: 'a' }] }));
  check(doFuturo.ok === false && /vers/i.test(doFuturo.erro), `versao mais nova e recusada com o motivo (${doFuturo.erro})`);

  const sujo = {
    id: 'a',
    rotulo: '   nome com espaco   ',
    regra: 'regra-que-sumiu',
    condicao: { sinal: 'sinalInventado', negar: 'sim', palavras: ['  oi  ', '', 42], onde: 'seila' },
    acao: { tecla: 'Z' },
    desligado: 'talvez',
    x: 'muito',
    y: 10,
    naoDeveriaExistir: 'apaga isso',
    filhos: [{ id: 'a', rotulo: 'id repetido', acao: { ia: true } }],
  };
  const { arvore, avisos } = arv.sanitizar([sujo]);
  const no = arvore[0];
  check(no.rotulo === 'nome com espaco', 'o texto vem aparado');
  check(no.regra === null && avisos.some((a) => a.includes('regra-que-sumiu')), 'regra que sumiu do codigo e descartada COM aviso');
  check(no.condicao.sinal === '' && avisos.some((a) => a.includes('sinalInventado')), 'sinal inventado e descartado COM aviso');
  check(no.acao === null && avisos.some((a) => a.includes('"Z"')), 'tecla inventada e descartada COM aviso');
  check(no.condicao.palavras.length === 1 && no.condicao.palavras[0] === 'oi', 'palavras vazias e nao-texto saem');
  check(no.condicao.onde === 'ultima', 'onde invalido cai no padrao');
  check(no.condicao.negar === false && no.desligado === false, 'booleano so e verdadeiro quando E true');
  check(no.x === 0 && no.y === 10, 'posicao nao numerica vira zero');
  check(!('naoDeveriaExistir' in no), 'campo desconhecido nao passa');
  check(no.filhos[0].id !== 'a' && avisos.some((a) => a.includes('id repetido')), 'id repetido ganha id novo COM aviso');
  check(no.filhos[0].acao.ia === true, 'e o desfecho da IA sobrevive');

  // Aninhamento absurdo tem teto -- arquivo nao pode gerar arvore que a tela nao desenha.
  let fundo = { id: 'f0', rotulo: 'f0', acao: { tecla: '3' }, filhos: [] };
  for (let i = 1; i < 20; i++) fundo = { id: `f${i}`, rotulo: `f${i}`, filhos: [fundo] };
  const limitado = arv.sanitizar([fundo]);
  const profundidade = Math.max(...arv.todosOsNos(limitado.arvore).map((n) => n.nivel));
  check(profundidade <= 8, `o aninhamento tem teto (${profundidade})`);
  check(limitado.avisos.some((a) => a.includes('nivel'.replace('ni', 'ní'))), 'e avisa que cortou');

  check(arv.sanitizar(null).arvore.length === 0, 'entrada que nao e lista devolve vazio, sem explodir');
  check(arv.sanitizar([null, 'texto', 42]).arvore.length === 0, 'e lixo dentro da lista tambem');
}

grupo('quantosEnviam: o numero que ele ve antes de trocar o fluxo');
{
  const arvore = [
    { id: 'a', rotulo: 'a', condicao: {}, acao: { tecla: '4' }, filhos: [] },
    { id: 'b', rotulo: 'b', condicao: {}, acao: { tecla: '3' }, filhos: [] },
    { id: 'c', rotulo: 'c', condicao: {}, acao: { resposta: 'pedido-ajuda' }, filhos: [] },
    { id: 'd', rotulo: 'd', condicao: {}, acao: { tecla: '4' }, desligado: true, filhos: [] },
    { id: 'e', rotulo: 'e', condicao: {}, acao: { ia: true }, filhos: [] },
  ];
  check(arv.quantosEnviam(arvore) === 2, `conta so o que ENVIA e esta ligado (${arv.quantosEnviam(arvore)})`);
  check(arv.quantosEnviam(arv.arvorePadrao()) > 0, 'e a arvore padrao tem ramos que enviam');
}

grupo('observacoes: o recado dele para mim, e o fluxo em texto');
{
  /**
   * Pedido dele (01/09): campo de observacao em cada caixa, "principalmente as com codigo nao
   * editaveis". E, quando eu ia fazer um botao que copiava so as observacoes, ele cortou: "nao faz
   * sentido eu colar para voce sem voce ter a visao do fluxo". Entao o texto leva TUDO.
   */
  check(arv.noVazio().nota === '', 'ramo novo nasce com observacao vazia');
  check(arv.arvorePadrao()[0].nota === '', 'ramo de regra tambem tem o campo');

  let t = [
    { id: 'a', rotulo: 'hater', regra: 'sem-interesse', nota: 'esta pegando quem so xingou o adversario', filhos: [] },
    { id: 'b', rotulo: 'retornando', condicao: {}, acao: null, filhos: [
      { id: 'b1', rotulo: 'bom dia', condicao: { palavras: ['bom dia'] }, acao: { tecla: '5' }, nota: 'linha 1\nlinha 2', filhos: [] },
    ] },
  ];
  const texto = arv.paraTexto(t, { teclas: {}, respostas: [] });

  check(texto.includes('1. hater'), 'numera os ramos da raiz');
  check(texto.includes('2.1. bom dia'), `numera os de dentro com o caminho (2.1) para nos dois apontarmos para o mesmo lugar`);
  check(texto.includes('[regra do código: sem-interesse]'), 'diz quando a condicao vem do codigo');
  check(texto.includes('OBSERVAÇÃO: esta pegando quem so xingou'), 'a observacao aparece no ramo dela');
  check((texto.match(/OBSERVAÇÃO/g) || []).length === 3, 'observacao de varias linhas sai linha a linha, sem se perder');
  check(texto.includes('escreveu "bom dia"'), 'a condicao dele aparece por extenso');
  check(texto.includes('tecla 5'), 'e o desfecho tambem');
  check(texto.includes('só agrupa'), 'ramo que so agrupa e dito como tal');

  // Ramo desligado tem que gritar: ele pode estar perguntando por que algo nao acontece.
  const desligado = arv.paraTexto([{ id: 'x', rotulo: 'apagado', condicao: {}, acao: { tecla: '3' }, desligado: true, filhos: [] }], {});
  check(desligado.includes('DESLIGADO'), 'ramo desligado e marcado no texto');

  // Tecla fixada por ele nao pode passar por escolha do codigo.
  const fixada = arv.paraTexto(arv.arvorePadrao(), { teclas: { 'ultima-e-despedida': '2' } });
  check(/VOCÊ FIXOU/.test(fixada), 'tecla fixada por ele e marcada como dele');

  // A resposta pronta sai pelo NOME: "pedido-ajuda" nao diz o que e para quem le de fora.
  const comNome = arv.paraTexto([{ id: 'r', rotulo: 'ajuda', condicao: {}, acao: { resposta: 'pedido-ajuda' }, filhos: [] }], {
    respostas: [{ id: 'pedido-ajuda', name: 'Pedido de ajuda financeira (negar com respeito)' }],
  });
  check(comNome.includes('Pedido de ajuda financeira'), 'a resposta pronta sai pelo nome');

  // A observacao sobrevive ao arquivo -- e o unico caminho dela ate mim se ele exportar.
  const volta = arv.deArquivo(JSON.stringify(arv.paraArquivo({ arvore: t, teclas: {} }, 'x')));
  check(volta.arvore[0].nota.includes('xingou'), 'a observacao vai e volta no arquivo');
  const longa = arv.sanitizar([{ id: 'z', rotulo: 'z', nota: 'x'.repeat(9000) }]);
  check(longa.arvore[0].nota.length === 4000, `observacao gigante e cortada no teto (${longa.arvore[0].nota.length})`);
  check(arv.sanitizar([{ id: 'z', rotulo: 'z', nota: { nao: 'e texto' } }]).arvore[0].nota === '', 'observacao que nao e texto vira vazia');
}

grupo('duplicar: o ramo inteiro, com ids novos (01/09/2026)');
{
  const base = () => [
    {
      id: 'pai',
      rotulo: 'tem etiqueta de cidade',
      x: 10,
      y: 20,
      filhos: [
        { id: 'f1', rotulo: 'bom dia', x: 300, y: 20, condicao: { palavras: ['bom dia'] }, acao: { tecla: '5' }, filhos: [] },
        { id: 'f2', rotulo: 'figura', x: 300, y: 140, filhos: [] },
      ],
    },
    { id: 'outro', rotulo: 'outro ramo', x: 10, y: 400, filhos: [] },
  ];

  const r = arv.duplicar(base(), 'pai');
  const nos = arv.todosOsNos(r.arvore);
  check(nos.length === 7, `os 3 nos do ramo foram junto: ${nos.length} (era 4)`);

  /**
   * **Id repetido e o defeito que esta operacao mais pode causar.** E o que `problemas` acusa e o
   * que `sanitizar` renomeia na importacao -- e, na tela, faria a janela editar dois nos de uma vez.
   */
  const ids = nos.map((n) => n.no.id);
  check(ids.length === new Set(ids).size, 'nenhum id repetido depois de duplicar');

  const copia = arv.localizar(r.arvore, r.id).no;
  check(/\(copia\)|\(cópia\)/.test(copia.rotulo), `o rotulo diz que e copia: ${copia.rotulo}`);
  check(copia.filhos.length === 2, 'os filhos vieram junto');
  check(copia.filhos.every((f) => f.id !== 'f1' && f.id !== 'f2'), 'e os filhos tambem ganharam id novo');
  check(copia.filhos[0].condicao?.palavras?.[0] === 'bom dia', 'a condicao veio junto');
  check(copia.filhos[0].acao?.tecla === '5', 'o desfecho veio junto');

  // A copia entra como IRMAO SEGUINTE: entre irmaos a prioridade e a altura, e a copia nasce logo
  // abaixo, ou seja, com a prioridade seguinte.
  check(r.arvore[1].id === r.id, 'a copia entra logo depois do original');
  check(r.arvore[2].id === 'outro', 'e o irmao que ja existia continua depois dela');
  check(copia.y > 20, 'e nasce mais embaixo na tela');

  // Copia FUNDA: mexer numa nao pode mexer na outra.
  copia.filhos[0].rotulo = 'MUDOU';
  check(arv.localizar(r.arvore, 'f1').no.rotulo === 'bom dia', 'mexer na copia nao mexe no original');

  const original = base();
  const nada = arv.duplicar(original, 'nao-existe');
  check(nada.arvore === original && nada.id === null, 'id que nao existe devolve a arvore intacta');
}

grupo('o modelo nao pode ficar preso atras da pendencia (01/09/2026)');
{
  const q = arv.arrumar(arv.fluxoPadrao());
  const base = {
    jaRespondemosAntes: true, temEtiquetaDeCidade: false, podeEnviar: true,
    enviadoHoje: false, modeloJaNaConversa: false, podePedirDados: true,
    textos: ['bom dia'], ultimoTexto: 'bom dia',
  };
  const tecla = (c) => arv.decidir(c, q)?.tecla ?? null;

  /**
   * Relato dele: *"se continuar como na print o modelo nunca será enviado porque está concluindo
   * apos resolver a pendencia"*. Sem a guarda de "ja respondemos hoje", a MESMA caixa de pendencia
   * casava de novo na passada seguinte e o modelo ficava preso atras dela para sempre.
   */
  check(tecla({ ...base, respondidoHoje: false, soCortesia: { motivo: 'cumprimentou' } }) === '5', 'primeira passada resolve a pendencia');
  check(tecla({ ...base, respondidoHoje: true, momentoJaEnviado: true }) === '1', 'segunda passada MANDA O MODELO');

  check(tecla({ ...base, respondidoHoje: false, textos: [], ultimoTexto: '' }) === '1', 'quem chega sem pendencia recebe o modelo direto');

  // A recusa continua acima de tudo, nas duas passadas.
  check(tecla({ ...base, respondidoHoje: false, semInteresse: true }) === 's', 'hostil vence na primeira passada');
  check(tecla({ ...base, respondidoHoje: true, semInteresse: true }) === 's', 'e tambem depois de ja termos respondido');
}


grupo('o catalogo devolve as regras apagadas para o quadro (01/09/2026)');
{
  /**
   * Pedido dele: *"quando regras sao apagadas tem que ter uma opcao ou uma aba ali com a lista de
   * regras para arrastar pro fluxo novamente"*. Antes disto, apagar uma caixa "do codigo" so tinha
   * volta pelo Desfazer; passado ele, o unico caminho era resetar o quadro e perder o arranjo.
   */
  const q = arv.arrumar(arv.fluxoPadrao());
  const cat = arv.catalogoDeRegras(q);

  check(cat.length === REGRAS.length, 'o catalogo oferece TODAS as regras do codigo');
  check(cat.every((r) => r.rotulo && typeof r.quantasNoQuadro === 'number'), 'cada verbete tem rotulo e a contagem');

  // Repetir e legitimo: o proprio padrao poe as mesmas regras dos dois lados da bifurcacao de
  // cidade. A marca informa quantas vezes, e nao esconde a regra da lista.
  const repetida = cat.find((r) => r.id === 'ultima-e-despedida');
  check(repetida.quantasNoQuadro === 3, 'regra repetida conta as 3 vezes (chegada + os dois lados de cidade)');

  const descartada = cat.find((r) => r.id === 'nome-sem-sentido');
  check(descartada && descartada.quantasNoQuadro === 0, 'regra fora do quadro aparece na lista, zerada');

  // Apagar uma caixa devolve a regra a lista — e e isto que torna o apagar reversivel.
  const semDespedida = arv.apagar(q, 'r:ultima-e-despedida:sem-cidade');
  const depois = arv.catalogoDeRegras(semDespedida).find((r) => r.id === 'ultima-e-despedida');
  check(depois.quantasNoQuadro === 2, 'apagar uma caixa desconta a regra do catalogo');
}

grupo('por a regra de volta nunca repete id');
{
  const q = arv.arrumar(arv.fluxoPadrao());
  const idsAntes = new Set(arv.todosOsNos(q).map(({ no }) => no.id));

  // A que foi descartada do padrao: id livre, entao fica com o nome simples.
  const novo = arv.noDeRegraLivre(q, 'nome-sem-sentido', { x: 10, y: 20 });
  check(novo.id === 'r:nome-sem-sentido', 'id livre vira o nome simples da regra');
  check(novo.regra === 'nome-sem-sentido' && novo.x === 10 && novo.y === 20, 'leva a regra e a posicao pedida');

  /**
   * Id repetido nao e cosmetico: `problemas` acusa, e na janela um clique abriria as duas caixas de
   * uma vez. Por isso por uma regra que JA esta no quadro tem que cunhar id novo.
   */
  const outra = arv.noDeRegraLivre(q, 'sem-interesse');
  check(!idsAntes.has(outra.id), 'regra ja presente ganha id que ninguem usa');

}

grupo('a regra posta de volta decide de verdade');
{
  let q = arv.arrumar(arv.fluxoPadrao());
  const antes = arv.problemas(q).length;

  // Duas de uma vez, sendo uma delas ja presente no quadro — o pior caso para o id.
  for (const id of ['nome-sem-sentido', 'sem-interesse']) {
    q = arv.ordenarPorPosicao(arv.acrescentar(q, null, arv.noDeRegraLivre(q, id, { x: 900, y: 900 })));
  }
  check(arv.problemas(q).length === antes, 'nenhum problema novo — nem id repetido, nem ramo morto');

  /**
   * A prova de que voltou viva: o contexto abaixo nao casa com nada do padrao, e a regra reposta e
   * quem decide. Se `noDeRegraLivre` devolvesse uma caixa sem a marca `regra`, isto daria nada.
   */
  const ctx = {
    jaRespondemosAntes: false, temEtiquetaDeCidade: true, nomeSemSentido: true,
    podePedirDados: true, podeEnviar: false, textos: ['oi'], ultimoTexto: 'oi',
  };
  check(arv.decidir(ctx, arv.arrumar(arv.fluxoPadrao())) === null, 'no padrao este caso sai da rodada sem nada');
  const d = arv.decidir(ctx, q);
  check(d && d.tecla === '4', 'com a regra reposta, ela decide (tecla 4)');
}


grupo('quem vem de anuncio reconhecido nao atravessa o quadro em silencio (02/09/2026)');
{
  /**
   * A print da Inge: veio do ANUNCIO | FACEBOOK e escreveu SO o texto do anuncio
   * ("Ola! Eu apoio as Escolas Civico-Militares"). Sem etiqueta de cidade, sem modelo mapeado, e
   * nenhuma caixa casava — ela atravessava o quadro inteiro e caia na caixa de pergunta. Relato
   * dele: *"nao seguiu o fluxo"*.
   *
   * O vazio era efeito colateral de uma decisao certa: a mensagem gerada pelo anuncio e excluida
   * de "so expressa apoio" de proposito, para nao contar como apoio escrito por ela.
   */
  const q = arv.arrumar(arv.fluxoPadrao());
  const texto = 'Olá! Eu apoio as Escolas Cívico-Militares 🙏';
  const inge = {
    veioDeAnuncio: true, anuncioReconhecido: true, temEtiquetaDeCidade: false,
    jaPediramDados: false, podePedirDados: true, pedidoHoje: false,
    podeEnviar: false, enviadoHoje: false, modeloJaNaConversa: false,
    textos: [texto], ultimoTexto: texto,
  };
  const tecla = (c) => arv.decidir(c, q)?.tecla ?? null;

  check(tecla({ ...inge, jaRespondemosAntes: false }) === '4', 'primeira vez: pede nome e cidade');
  check(tecla({ ...inge, jaRespondemosAntes: true, respondidoHoje: false }) === '4', 'RETORNANDO: pede nome e cidade (era o vazio)');
  check(tecla({ ...inge, jaRespondemosAntes: true, respondidoHoje: true }) === '4', 'e tambem depois de ja termos respondido hoje');

  /**
   * Quem JA recebeu o formulario e volta mandando so o texto do anuncio continua sem desfecho
   * automatico, de proposito: ela nao respondeu o que perguntamos, e nao existe resposta certa
   * para mandar sozinho. O ramo usa a regra do codigo justamente para herdar essa guarda — uma
   * tecla 4 fixa pediria os dados de novo a quem ja recebeu o pedido.
   */
  /**
   * **Quem JA recebeu o formulario nao recebe de novo** -- e a guarda que o ramo herda da regra do
   * codigo. Uma tecla 4 fixa aqui pediria os dados a quem ja recebeu o pedido.
   *
   * **O desfecho VAZIO deixou de existir em 03/09**, por decisao dele: quatro anotacoes no mesmo
   * lote (Antonio, jairoc, Sidnei, Maria de Lourdes) pedindo *"so concluir"* para quem volta
   * mandando figura, link ou o texto do anuncio. `ja-respondemos-antes` fecha o lado sem cidade e
   * conclui; o que continua valendo, e e o que estas assercoes protegem, e que **o formulario nao
   * sai de novo**.
   */
  check(tecla({ ...inge, jaRespondemosAntes: true, jaPediramDados: true }) !== '4', 'quem JA recebeu o formulario nao recebe de novo');
  check(tecla({ ...inge, jaRespondemosAntes: true, pedidoHoje: true }) !== '4', 'nem quem recebeu o formulario hoje');

  // O ramo e ULTIMO RECURSO: nao rouba a vez de quem ja funcionava.
  check(tecla({ ...inge, jaRespondemosAntes: true, podeEnviar: true }) === '1', 'havendo modelo mapeado, o modelo vence o ramo novo');
  check(tecla({ ...inge, jaRespondemosAntes: true, soCortesia: { motivo: 'cumprimentou' } }) === '5', 'pendencia na frente: "bom dia" ainda resolve primeiro');
  check(arv.decidir({ ...inge, jaRespondemosAntes: true, semInteresse: true }, q)?.tecla === 's', 'e a recusa continua vencendo tudo');

  /**
   * A condicao e `anuncioReconhecido`, nao `veioDeAnuncio`: a origem vem da plataforma e vale para
   * qualquer anuncio, e o sinal so e verdade para anuncio que ELE cadastrou. Assim o ramo nao muda
   * nada para quem chega por campanha nao mapeada.
   */
  const naoReconhecido = arv.decidir({ ...inge, jaRespondemosAntes: true, anuncioReconhecido: false }, q);
  check(!String(naoReconhecido?.id || '').includes('anuncio-conhecido'), 'anuncio NAO reconhecido nao entra neste ramo');
  check(naoReconhecido?.tecla !== '4', 'e nao recebe o formulario por outra porta');
}


grupo('a CHEGADA pelo anuncio: modelo, dados, pendencia (02/09/2026)');
{
  /**
   * Redesenho dele, na ordem que ele escreveu:
   *
   *   *"o sistema atual esta dando problemas, o modelo agora sera feito pra cada anuncio
   *   especifico e sera mandado no momento que a pessoa chegar pelo anuncio, pedir dados vira apos
   *   isso se a pessoa nao tiver etiqueta de cidade, se ela tiver etiqueta de cidade fica so no
   *   modelo, apos o modelo tera que ver se tem uma pendencia que e a mensagem apos a mensagem de
   *   anuncio e escolher a resposta de acordo com a pendencia"*
   *
   * Inverteu a ordem que valia antes (dados primeiro, decisao dele de 01/09). O que mudou e que
   * agora existe UM MODELO POR ANUNCIO, entao o que sai na chegada responde ao que ela clicou.
   *
   * **Uma passada, uma mensagem** — a propriedade que ele escolheu em 01/09 para nao sair rajada ao
   * mesmo numero. Quem faz a passada seguinte descer um passo sao as guardas de `conteudo-pedido`
   * (`!enviadoHoje && !modeloJaNaConversa`).
   */
  const q = arv.arrumar(arv.fluxoPadrao());
  const ad = 'Olá! Eu apoio as Escolas Cívico-Militares 🙏';
  const chega = {
    veioDeAnuncio: true, anuncioReconhecido: true, jaRespondemosAntes: false,
    temEtiquetaDeCidade: false, jaPediramDados: false, podePedirDados: true, pedidoHoje: false,
    podeEnviar: true, enviadoHoje: false, modeloJaNaConversa: false, podePerguntarAjuda: true,
    textos: [ad], ultimoTexto: ad,
  };
  const tecla = (c) => arv.decidir(c, q)?.tecla ?? null;

  // A sequencia, sem etiqueta de cidade.
  check(tecla(chega) === 'a', '1a passada: modelo + pedido de dados na MESMA passada');
  check(tecla({ ...chega, modeloJaNaConversa: true }) === '4', '2a passada: pede nome e cidade');
  check(tecla({ ...chega, modeloJaNaConversa: true, jaPediramDados: true }) === null, '3a passada: nada mais a fazer sozinho');

  // "se ela tiver etiqueta de cidade fica so no modelo".
  check(tecla({ ...chega, temEtiquetaDeCidade: true }) === '1', 'com cidade: o modelo sai igual');
  check(tecla({ ...chega, temEtiquetaDeCidade: true, modeloJaNaConversa: true }) === null, 'com cidade: fica SO no modelo, nao pede dados');

  // O modelo padrao entra pelo mesmo caminho: quem resolve "qual modelo" e `anuncios.modeloDoAnuncio`,
  // fora do quadro. Aqui so se ve que sem modelo nenhum o passo e pulado.
  check(tecla({ ...chega, podeEnviar: false }) === '4', 'sem modelo mapeado, cai direto no pedido de dados');
  check(tecla({ ...chega, podeEnviar: false, temEtiquetaDeCidade: true }) === null, 'sem modelo e com cidade, nao ha o que mandar');

  /**
   * **As protecoes que ficam ACIMA do modelo.** A ordem dele diz "pendencia depois do modelo", e
   * vale para as neutras. Estas nao: mandar a nossa mensagem primeiro E o dano, nao o atraso.
   */
  check(tecla({ ...chega, semInteresse: true }) === 's', 'recusa: nada sai');
  // A etiqueta que dispensa deixou de PULAR em 03/09 (anotacao do Paulo Cezar): manda a mensagem
  // do momento uma vez e conclui. Continua vencendo o modelo, que era a regressao original.
  check(tecla({ ...chega, etiquetaQueDispensa: 'Sem Retorno', podeMandarMomento: true }) === '5',
    'etiqueta que dispensa: momento, e vence o modelo');
  check(tecla({ ...chega, etiquetaQueDispensa: 'Sem Retorno', podeMandarMomento: true, momentoJaEnviado: true }) === '3',
    'ja recebeu o momento: conclui');
  /**
   * **A ajuda financeira VOLTOU para cima do modelo, por decisao dele** (03/09/2026).
   *
   * Anotacao da Regina -- *"Presizo de uma ajuda"*, *"Eu preciso pagar umas contas que estao muito
   * atrasada"* -- e a caixa ofereceu o modelo padrao: *"modelo fora de contexto, ela quer ajuda
   * financeira, mandar mensagem pronta referente"*.
   *
   * Isto desfaz a decisao dele de 02/09 (*"pode ser respondido apos"*). O argumento continua
   * verdadeiro sobre o TEXTO -- o modelo nao promete nada --, mas o caso real mostrou outra coisa:
   * propaganda como PRIMEIRA resposta a quem diz que nao consegue pagar as contas e a resposta
   * errada mesmo quando o texto e inofensivo.
   */
  const remedio = { pedeAjudaFinanceira: { motivo: 'remedio' }, textos: [ad, 'preciso de remedio'], ultimoTexto: 'preciso de remedio' };
  check(arv.decidir({ ...chega, ...remedio }, q)?.resposta === 'pedido-ajuda',
    'quem pediu ajuda recebe a NEGATIVA antes do recibo');
  check(tecla({ ...chega, ...remedio }) !== 'a', 'e nao o modelo + pedido de dados');
  check(arv.decidir({ ...chega, ...remedio, modeloJaNaConversa: true, temEtiquetaDeCidade: true }, q)?.resposta === 'pedido-ajuda',
    'quem ja tinha cidade tambem recebe a negativa');
  check(tecla({ ...chega, perguntaAberta: true }) === '6', 'pergunta de posicao: gente, nao modelo (print da Clair)');
  // Desde 03/09 a tecla e 6 (decisao dele: "pedido e algo dificil de ser identificado, sera pra mim
  // ou IA responder"). O que a caixa protege nao mudou: ela continua acima do recibo.
  check(tecla({ ...chega, pedeAlgoIndefinido: true }) === '6', 'pediu algo sem dizer o que: fica com ele ou com a IA');

  /**
   * **As pendencias NEUTRAS, depois do modelo** — a ordem que ele pediu. Na 1a passada o modelo
   * ganha; resolvido ele, a pendencia decide.
   */
  const jaFoi = { modeloJaNaConversa: true, jaPediramDados: true };
  check(tecla({ ...chega, soCortesia: { motivo: 'cumprimentou' } }) === 'a', 'na 1a passada o modelo + dados vence "bom dia"');
  check(tecla({ ...chega, ...jaFoi, soCortesia: { motivo: 'cumprimentou' } }) === '5', 'resolvido o modelo, "bom dia" recebe a mensagem do momento');
  check(tecla({ ...chega, ...jaFoi, ultimaEhSoReacao: true }) === '3', 'figura depois do modelo: conclui');
  check(tecla({ ...chega, ...jaFoi, ultimaEhDespedida: true }) === '3', 'despedida depois do modelo: conclui');
  check(tecla({ ...chega, ...jaFoi, pedeRespostaPessoal: true }) === '6', 'audio ou texto longo: gente');
}


grupo('a comparacao com o padrao (02/09/2026)');
{
  /**
   * Relato dele depois de eu reordenar a chegada varias vezes num dia: *"a ramificacao nao foi
   * atualizada"*. Estava certo, e o defeito e de desenho: o quadro dele e uma COPIA, e melhoria no
   * padrao nunca chegava nele. O unico caminho de volta ("Resetar para o padrao") joga fora o
   * arranjo feito a mao.
   */
  const padrao = arv.arrumar(arv.fluxoPadrao());
  check(arv.diferencaDoPadrao(padrao).faltando.length === 0, 'o proprio padrao nao tem nada faltando');
  check(arv.diferencaDoPadrao(padrao).sobrando.length === 0, 'nem nada sobrando');

  // O quadro de quem semeou antes da regra nova: ela tem que aparecer como faltando.
  const antigo = arv.arvorePadrao({}).filter((n) => n.regra !== 'anuncio-modelo-e-dados');
  const d = arv.diferencaDoPadrao(antigo);
  check(d.faltando.some((n) => n.regra === 'anuncio-modelo-e-dados'), 'regra nova do codigo aparece como faltando');
  check(d.faltando.some((n) => n.condicao?.sinal === 'anuncioReconhecido'), 'grupo com condicao nova tambem aparece');

  /**
   * Caixa que so AGRUPA fica fora da comparacao: e estrutura, nao decisao, e todas colidiriam na
   * mesma chave. "pessoa retornando" nao tem condicao, entao nunca aparece como faltando.
   */
  check(!d.faltando.some((n) => n.rotulo === 'pessoa retornando'), 'caixa que so agrupa nao entra na conta');

  // O que e so dele e INFORMACAO, nao erro: montar ramo proprio e a razao da janela existir.
  check(d.sobrando.some((n) => n.regra === 'nome-sem-sentido'), 'regra que ele tem e o padrao descartou aparece como sua');

  // A comparacao e por CONTEUDO, nao por id: os ids do quadro dele nasceram em outro momento.
  const outrosIds = arv.arrumar(arv.fluxoPadrao()).map((n) => ({ ...n, id: 'x' + Math.random() }));
  check(arv.diferencaDoPadrao(outrosIds).faltando.length === 0, 'id diferente nao conta como caixa faltando');

  // Cada chave aparece UMA vez, mesmo que o padrao repita a regra nos tres ramos.
  const vazio = arv.diferencaDoPadrao([]);
  const chaves = vazio.faltando.filter((n) => n.regra === 'ultima-e-despedida');
  check(chaves.length === 1, 'regra repetida no padrao aparece uma vez so na lista');
}


grupo('a caixa que manda mensagem e casa de novo (02/09/2026)');
{
  /**
   * **Caso real dele.** Ele montou a mao uma caixa *"mandar modelo conforme o anuncio"* com a
   * condicao "Reconheci de QUAL anuncio ela veio" e a **tecla 1 FIXA**. Medido no motor: o modelo
   * saia em TODA passada, para sempre. Dois motivos somados:
   *
   *  - a condicao e estado do contato -- continua verdadeira depois de mandarmos;
   *  - **fixar a tecla nao herda as guardas da regra do codigo.** `conteudo-pedido` exige
   *    `!enviadoHoje && !modeloJaNaConversa`; a caixa dele nao exigia nada.
   *
   * E a armadilha central do quadro livre: a caixa PARECE a regra, tem o mesmo desfecho na tela, e
   * nao tem a metade que impede repetir. Maquina de repetir mensagem para eleitor real e o defeito
   * que este projeto mais pagou.
   */
  const caixa = (cond, acao, rotulo) => ({ id: 'x', rotulo: rotulo || 'x', regra: null, condicao: cond, acao, nota: '', desligado: false, filhos: [] });
  const c = (sinal, negar, palavras, onde) => ({ sinal: sinal || '', negar: !!negar, palavras: palavras || [], onde: onde || 'ultima' });
  const acusa = (no) => arv.problemas([no]).some((m) => m.includes('mandar de novo'));

  check(acusa(caixa(c('anuncioReconhecido'), { tecla: '1' })), 'a caixa dele e acusada');
  check(!acusa(caixa(c('modeloJaNaConversa', true), { tecla: '1' })), 'com a guarda do modelo, nao e acusada');
  check(!acusa(caixa(c('jaRespondemosAntes', true), { tecla: '1' })), '"nunca entregamos nada" tambem e guarda');
  check(acusa(caixa(c('jaRespondemosAntes', false), { tecla: '1' })), 'mas exigir que JA entregamos nao protege nada');

  // Palavra na ULTIMA mensagem e guarda: a ultima muda quando a pessoa escreve de novo.
  check(!acusa(caixa(c('', false, ['bom dia']), { tecla: '5' })), 'palavra na ultima mensagem nao repete');
  // Em QUALQUER mensagem, nao: o texto fica na conversa para sempre.
  check(acusa(caixa(c('', false, ['bom dia'], 'qualquer'), { tecla: '5' })), 'palavra em qualquer mensagem repete');

  // Tecla que nao manda nada nao tem como repetir mensagem.
  check(!acusa(caixa(c('anuncioReconhecido'), { tecla: '3' })), 'concluir sem enviar nao e acusado');
  check(!acusa(caixa(c('anuncioReconhecido'), { tecla: '2' })), 'pular nao e acusado');

  // Resposta pronta conta como envio, igual.
  check(acusa(caixa(c('anuncioReconhecido'), { tecla: null, resposta: 'pedido-ajuda' })), 'resposta pronta sem guarda tambem e acusada');

  // Regra do CODIGO nunca e acusada: ela carrega as proprias guardas.
  const doCodigo = { id: 'r:conteudo-pedido', rotulo: 'x', regra: 'conteudo-pedido', condicao: null, acao: null, nota: '', desligado: false, filhos: [] };
  check(!acusa(doCodigo), 'regra do codigo nao e acusada');

  // E o padrao inteiro continua limpo -- senao o aviso tocaria sempre e ele aprenderia a ignorar.
  check(arv.problemas(arv.arrumar(arv.fluxoPadrao())).length === 0, 'o padrao nao acusa nada');
  check(arv.problemas(arv.arvorePadrao({})).length === 0, 'nem a semeadura plana');
}


grupo('respondeu os dados: agradece e encerra, SEM modelo (02/09/2026)');
{
  /**
   * Pedido dele, com a print da caixa aberta: *"aqui esta o que tem que mudar agora so precisa
   * agradecer a atencao e encerrar sem mandar modelo"*. E consequencia do redesenho do mesmo dia --
   * o modelo virou o RECIBO DA CHEGADA, entao quando ela responde o cadastro o modelo ja saiu, e
   * manda-lo de novo e repetir.
   *
   * **Ele tentou fazer isso fixando a tecla 8 na caixa `conteudo-pedido`, e nao funcionaria:** a
   * condicao daquela regra exige `!modeloJaNaConversa`, ou seja, ela deixa de casar justamente
   * depois de o modelo ter saido. Medido antes de mexer: quem respondia com os dados nao recebia
   * NADA, ou era concluida em silencio por `ja-respondemos-antes`.
   */
  const q = arv.arrumar(arv.fluxoPadrao());
  const base = {
    jaRespondemosAntes: true, veioDeAnuncio: true, jaPediramDados: true, podePedirDados: true,
    podeEnviar: true, enviadoHoje: false, modeloJaNaConversa: true, respondeuOsDados: true,
    textos: ['Olá! Eu apoio', 'Maria Silva / Canoas'], ultimoTexto: 'Maria Silva / Canoas',
  };
  const tecla = (c) => arv.decidir(c, q)?.tecla ?? null;

  check(tecla({ ...base, temEtiquetaDeCidade: false }) === 'i', 'sem cidade: agradece e conclui');

  /**
   * **Os dois lados da bifurcacao dao o mesmo.** Sem a caixa no lado "com cidade", a mesma pessoa
   * era agradecida ou concluida em silencio dependendo de a etiqueta ja ter sido aplicada -- e isso
   * e decidido pela ORDEM das coisas dentro da rodada, que ela nao ve. Regra que trata dois
   * contatos iguais de forma diferente por estado invisivel e o "alguns concluem e outros nao".
   */
  check(tecla({ ...base, temEtiquetaDeCidade: true }) === 'i', 'com cidade: o mesmo agradecimento');

  // Quem NAO respondeu segue como antes -- a condicao e estreita de proposito.
  check(tecla({ ...base, temEtiquetaDeCidade: true, respondeuOsDados: false }) === '3', 'quem nao respondeu continua como era');

  // E o modelo nao sai junto: era o pedido dele.
  check(tecla({ ...base, temEtiquetaDeCidade: false }) !== '1', 'nao manda o modelo');
  check(tecla({ ...base, temEtiquetaDeCidade: false }) !== 'a', 'nem o modelo + dados');

  /**
   * **As protecoes continuam ganhando**, nos DOIS lados. A etiqueta que dispensa vivia so dentro de
   * "com etiqueta de cidade": quem a carregava e nao tinha cidade nunca era protegido. Subiu para
   * cima da bifurcacao, junto da recusa, e estas duas asercoes travam isso.
   */
  for (const comCidade of [true, false]) {
    const onde = comCidade ? 'com cidade' : 'sem cidade';
    check(tecla({ ...base, temEtiquetaDeCidade: comCidade, semInteresse: true }) === 's', `a recusa vence (${onde})`);
    check(tecla({ ...base, temEtiquetaDeCidade: comCidade, etiquetaQueDispensa: 'Sem Retorno', podeMandarMomento: true }) === '5',
      `a etiqueta que dispensa vence (${onde})`);
  }
}

grupo('respostasApos: a resposta a UMA mensagem nossa');
{
  const nossas = [
    { texto: 'oi', at: '2026-09-01T10:00:00Z' },
    { texto: 'me diz seu nome e a sua cidade', at: '2026-09-01T12:00:00Z' },
  ];
  const ehPedido = (t) => /nome e a sua cidade/.test(t);

  const depois = cortesia.respostasApos(
    [{ texto: 'bom dia', at: '2026-09-01T11:00:00Z' }, { texto: 'Maria / Canoas', at: '2026-09-01T13:00:00Z' }],
    nossas, ehPedido
  );
  check(depois?.length === 1 && depois[0].texto === 'Maria / Canoas', 'so o que veio DEPOIS do pedido');

  check(cortesia.respostasApos([{ texto: 'bom dia', at: '2026-09-01T11:00:00Z' }], nossas, ehPedido) === null,
    'nada depois do pedido devolve nada');
  check(cortesia.respostasApos([{ texto: 'oi', at: '2026-09-01T13:00:00Z' }], [{ texto: 'oi' }], ehPedido) === null,
    'sem pedido nenhum devolve nada');
  check(cortesia.respostasApos([], nossas, ehPedido) === null, 'sem mensagem dela devolve nada');
  check(cortesia.respostasApos([{ texto: '   ' }], nossas, ehPedido) === null, 'mensagem em branco nao conta');

  /**
   * Sem hora na nossa mensagem (historico antigo), considera todas as dela: supor que nada veio
   * depois seria pior -- ela teria respondido e ninguem veria.
   */
  const semHora = cortesia.respostasApos([{ texto: 'Maria / Canoas' }], [{ texto: 'me diz seu nome e a sua cidade' }], ehPedido);
  check(semHora?.length === 1, 'sem hora, considera tudo que ela escreveu');

  // Pega a ULTIMA vez que pedimos, nao a primeira: pedido repetido reinicia a conta.
  const doisPedidos = [
    { texto: 'me diz seu nome e a sua cidade', at: '2026-09-01T10:00:00Z' },
    { texto: 'me diz seu nome e a sua cidade', at: '2026-09-01T14:00:00Z' },
  ];
  check(cortesia.respostasApos([{ texto: 'oi', at: '2026-09-01T11:00:00Z' }], doisPedidos, ehPedido) === null,
    'conta a partir do ULTIMO pedido');
}


grupo('remetente dentro de protecao -- o erro que aconteceu DUAS vezes');
{
  /**
   * 01/09/2026: "mensagem padrao" caiu dentro de "Recusou ou veio hostilizar".
   * 02/09/2026: "mandar modelo conforme o anuncio" caiu no MESMO lugar.
   *
   * Medido no quadro que ele colou: o hostil recebia o pedido de nome e cidade, e a pessoa normal
   * nao recebia o modelo -- escapava para "pessoa retornando" e terminava agradecida por um apoio
   * que nunca expressou.
   *
   * O motivo e o desenho do motor: o filho e testado ANTES da acao do proprio no, e so e alcancado
   * quando o PAI casa. Por o remetente dentro de uma protecao significa "quando eu reconhecer que
   * nao devo mandar nada, mande isto". Duas vezes o mesmo erro e problema de ferramenta.
   */
  const acusa = (arvore) => arv.problemas(arvore).filter((m) => m.includes('MANDAM dentro'));
  const R = (id, filhos) => ({ id: 'r:' + id, rotulo: id, regra: id, condicao: null, acao: null, nota: '', desligado: false, filhos: filhos || [] });
  const meu = (rot, acao, filhos) => ({ id: 'n:' + rot, rotulo: rot, regra: null, condicao: { sinal: 'anuncioReconhecido', negar: false, palavras: [], onde: 'ultima' }, acao, nota: '', desligado: false, filhos: filhos || [] });

  // O caso real dele.
  const dele = [R('sem-interesse', [meu('mandar modelo', { tecla: '1' }, [R('nunca-pediram-dados')])])];
  const m = acusa(dele);
  check(m.length === 1, 'acusa uma vez, na caixa da protecao');
  check(m[0].includes('Recusou') || m[0].includes('sem-interesse'), 'nomeia a caixa que protege');
  check(m[0].includes('mandar modelo') && m[0].includes('nunca-pediram-dados'), 'e nomeia as DUAS que mandam, inclusive a de dentro da de dentro');

  /**
   * **`etiqueta-dispensa-da-fila` deixou de ser protecao em 03/09** (anotacao do Paulo Cezar): ela
   * manda a mensagem do momento uma vez e conclui, em vez de pular. Como o efeito dela nao e mais
   * `silencio`, ela nao entra mais nesta conferencia -- e nao pode entrar, senao a janela acusaria
   * uma caixa que ENVIA pendurada numa caixa que ENVIA, que e legitimo.
   *
   * A protecao que continua de pe e `sem-interesse`, acima, e a despedida.
   */
  check(acusa([R('etiqueta-dispensa-da-fila', [meu('manda', { tecla: '1' })])]).length === 0,
    'a etiqueta que dispensa nao e mais protecao: nao acusa');
  check(acusa([R('ultima-e-despedida', [meu('manda', { tecla: '1' })])]).length === 1,
    'a despedida continua sendo protecao, e acusa');

  // Sem remetente dentro, nao acusa.
  check(acusa([R('sem-interesse', [R('ultima-e-despedida')])]).length === 0, 'protecao com protecao dentro nao e problema');
  check(acusa([R('sem-interesse')]).length === 0, 'protecao sem filho nenhum nao e problema');

  // Remetente dentro de remetente e legitimo: o mais especifico vence o mais geral.
  check(acusa([R('conteudo-pedido', [meu('caso especifico', { tecla: '4' })])]).length === 0, 'remetente dentro de remetente nao e acusado');

  // Grupo (so agrupa) nao e protecao: ele nao tem desfecho para contradizer.
  const grupoVazio = { id: 'g', rotulo: 'grupo', regra: null, condicao: { sinal: '', negar: false, palavras: [], onde: 'ultima' }, acao: null, nota: '', desligado: false, filhos: [meu('manda', { tecla: '1' })] };
  check(acusa([grupoVazio]).length === 0, 'grupo com remetente dentro e o normal, nao e acusado');

  // Resposta pronta conta como envio.
  check(acusa([R('sem-interesse', [meu('resposta', { tecla: null, resposta: 'pedido-ajuda' })])]).length === 1, 'resposta pronta dentro da protecao tambem e acusada');

  /**
   * A conferencia fica ACIMA do `continue` das caixas de regra: as protecoes deste projeto SAO
   * regras do codigo, e posta depois ela nunca veria o caso real -- foi o que aconteceu na primeira
   * versao dela, e este teste e o que impede a regressao.
   */
  check(acusa([R('sem-interesse', [meu('manda', { tecla: '1' })])]).length === 1, 'protecao que e REGRA do codigo tambem e conferida');

  // E o padrao continua limpo -- alarme que toca sempre se aprende a ignorar.
  check(acusa(arv.arrumar(arv.fluxoPadrao())).length === 0, 'o padrao nao acusa nada');
}


grupo('a chegada nao repete o que a volta ja resolve (02/09/2026)');
{
  /**
   * Correcao dele: *"porque o modelo que voce criou tem todas essas opcoes em pessoa nova? ao mandar
   * modelo e pedir dados ira concluir a conversa e ela volta pelo pessoa retornando"*.
   *
   * Eu havia copiado as cinco caixas de pendencia para a chegada, por causa do pedido anterior dele
   * (*"apos o modelo tera que ver se tem uma pendencia"*) -- sem perceber que o "depois" acontece
   * na VOLTA, porque a tecla `a` conclui. Deixa-las nos dois lugares e a receita para as duas
   * versoes divergirem: um conserto de um lado e o outro fica para tras.
   */
  const q = arv.arrumar(arv.fluxoPadrao());
  const chegada = q.find((n) => n.rotulo === 'anúncio — pessoa nova');
  const volta = q.find((n) => n.rotulo === 'pessoa retornando');

  // As situacoes JUNTADAS contam: desde 04/09 uma caixa pode carregar mais de uma regra do codigo
  // (pedido dele -- "junte todas as situacoes que sao usadas na mesma tecla").
  const naChegada = chegada.filhos.flatMap((n) => [n.regra || n.rotulo, ...(n.tambemQuando || [])]);
  /**
   * "pediu dinheiro" SAIU desta lista em 03/09: ele decidiu que ela volta para cima do modelo
   * (anotacao da Regina). As outras continuam sendo resolvidas so na volta.
   */
  /**
   * **Elas VOLTARAM para a chegada em 04/09, abaixo do recibo** -- relato dele: *"o fluxo de
   * chegada parece ter sido deixado para tras; muitas regras se aplicam la tambem"*.
   *
   * A decisao de 02/09 continua de pe e e sobre ORDEM: o recibo do anuncio vem primeiro, e
   * pendencia neutra custa um dia de atraso. O que estava errado era elas nao existirem AQUI --
   * medido, quem chegava e so se despedia caia na caixa do TEMPO e recebia a mensagem do momento
   * por cima de um "amem", ou o modelo generico quando havia um.
   */
  const PENDENCIAS = ['ultima-e-so-reacao', 'ultima-e-despedida'];
  for (const p of PENDENCIAS) {
    check(naChegada.includes(p), `"${p}" existe na chegada`);
    check(naChegada.indexOf('anuncio-modelo-e-dados') < naChegada.indexOf(p),
      `e o recibo do anuncio decide ANTES de "${p}"`);
    check(naChegada.indexOf(p) < naChegada.indexOf('contexto-de-outro-dia'),
      `mas "${p}" vence a caixa do tempo`);
  }

  /**
   * **`ultima-pede-resposta-pessoal` SAIU desta lista em 03/09**, com a print que ele chamou de
   * *"critico"*: a contato chegou pelo anuncio, escreveu 314 caracteres pedindo uma cola com letras
   * maiores para os idosos da cidade dela, e a rodada mandou o cartao da campanha e CONCLUIU.
   *
   * Ela disse o que queria (`pediu-algo-sem-dizer-o-que` nao casa) e nao e pergunta de razao
   * (`pergunta-aberta` nao casa). O unico sinal de "isto e conversa" e o TAMANHO -- estava certo e
   * so nao era consultado neste ramo. Como as duas caixas acima, aqui mandar a nossa mensagem
   * primeiro E o dano, nao o atraso.
   */
  check(naChegada.includes('ultima-pede-resposta-pessoal'), 'quem escreveu conversa fica ACIMA do modelo na chegada');
  for (const depois of ['anuncio-modelo-e-dados', 'conteudo-pedido', 'nunca-pediram-dados']) {
    check(naChegada.indexOf('ultima-pede-resposta-pessoal') < naChegada.indexOf(depois),
      `e decide antes de "${depois}"`);
  }
  check(!naChegada.some((x) => String(x).startsWith('só mandou bom dia')), '"so mandou bom dia" nao esta mais na chegada');

  // E continuam existindo na volta -- e por isso que remover da chegada nao perde nada.
  const naVolta = new Set(arv.todosOsNos(volta.filhos).flatMap(({ no }) => [no.regra || no.rotulo, ...(no.tambemQuando || [])]));
  for (const p of PENDENCIAS) check(naVolta.has(p), `"${p}" continua na volta`);
  check(naVolta.has('pediu dinheiro, cesta basica ou remedio'), 'a ajuda financeira existe nos DOIS lados');

  /**
   * O que a chegada resolve e que a volta NAO resolve: as tres saidas do recibo. Sem as duas
   * ultimas, medido, o contato atravessa o quadro sem desfecho.
   */
  check(naChegada.includes('anuncio-modelo-e-dados'), 'o recibo + pedido de dados fica na chegada');
  check(naChegada.includes('conteudo-pedido'), 'o recibo sozinho (ela ja tem cidade) fica na chegada');
  check(naChegada.includes('nunca-pediram-dados'), 'o pedido de dados sozinho (sem modelo) fica na chegada');
  check(naChegada.includes('pediu dinheiro, cesta basica ou remedio'), 'e a ajuda financeira VOLTOU para a chegada (03/09)');
  // 16 desde 04/09, com a caixa do endereco (material a enviar). O numero e proposital: ele
  // acusa caixa que entrou na chegada sem ninguem decidir que ela pertence ali.
  // 22 desde 04/09: entraram as duas respostas que negam (emprego, ligacao), a denuncia
  // respondida, as duas pendencias neutras e "respondeu os dados" -- o bloco que so existia na
  // volta. O numero e proposital: ele acusa caixa que entrou sem ninguem decidir que pertence ali.
  // 23 desde 04/09, com "chegou sem anuncio e so cumprimentou" (boas-vindas do gabinete).
  // 21 desde 04/09, quando as situacoes que levam ao mesmo desfecho foram JUNTADAS numa caixa so
  // (pedido dele: "junte todas as situacoes que sao usadas na mesma tecla").
  // 20 desde 05/09, com "so clicou em varios anuncios" (print da Irene).
  check(chegada.filhos.length === 20, 'e a chegada tem 20 caixas, nao 21');

  /**
   * **"Nada legivel dela" entrou em 03/09** (print do Tilin: dois avisos de tipo nao suportado,
   * numero privado, e a rodada pedindo nome e cidade). Fica ABAIXO do modelo e ACIMA do pedido de
   * dados -- quem chega com modelo mapeado recebe o recibo, que responde melhor que uma pergunta.
   */
  check(naChegada.includes('nada-legivel-dela'), 'a caixa de "nada legivel" esta na chegada');
  check(naChegada.indexOf('conteudo-pedido') < naChegada.indexOf('nada-legivel-dela'),
    'o modelo decide antes dela');
  check(naChegada.indexOf('nada-legivel-dela') < naChegada.indexOf('nunca-pediram-dados'),
    'e ela decide antes do pedido de nome e cidade');

  /**
   * **O apoio entrou na chegada em 03/09, e entrou em ULTIMO lugar.**
   *
   * Anotacoes da Maria Bernardete (*"mandar 8"*) e do Plauto (*"agradecer e encerrar"*): as duas
   * chegaram pelo anuncio e sairam sem desfecho nenhum. A posicao e a trava, nao um detalhe de
   * arrumacao: a mensagem do anuncio E apoio escrito, e `soExpressaApoio` so a descarta quando o
   * anuncio esta cadastrado. Em cima, esta caixa agradeceria a chegada de todo anuncio novo e
   * engoliria o recibo. Se alguem a subir, este teste cai.
   */
  const ultima = chegada.filhos[chegada.filhos.length - 1];
  check(ultima.regra === 'so-expressa-apoio', 'o apoio e a ULTIMA caixa da chegada');
  const posApoio = naChegada.indexOf('so-expressa-apoio');
  for (const antes of ['anuncio-modelo-e-dados', 'conteudo-pedido', 'nunca-pediram-dados']) {
    check(naChegada.indexOf(antes) < posApoio, `"${antes}" decide antes do apoio`);
  }

  /**
   * As duas caixas de "conclua e nao mande nada" (03/09) ficam nos DOIS lados: sao sobre NAO
   * mandar, e isso nao depende de o contato ter cidade. Protecao que vive so num lado da
   * bifurcacao e protecao pela metade -- ja aconteceu com a etiqueta que dispensa.
   */
  for (const regra of ['etiqueta-so-conclui', 'ultima-e-nossa']) {
    check(naChegada.includes(regra), `"${regra}" esta na chegada`);
    check(naVolta.has(regra), `"${regra}" esta na volta`);
  }

  /**
   * **O apoio nos DOIS lados da bifurcacao de cidade** (pedido dele, 03/09: *"arrume para que a
   * regra siga pras duas"*). Ela vivia so em "sem etiqueta de cidade": quem voltava COM cidade e
   * so escrevia apoio caia em `ja-respondemos-antes`, a caixa mais generica do ramo, e o criterio
   * de tempo do mesmo dia valia so para metade da base.
   *
   * O teste decide de verdade, nos dois lados, em vez de so procurar a caixa: assim ele cai
   * tambem se alguem mexer na ORDEM e puser algo generico por cima.
   */
  const apoiando = {
    soExpressaApoio: { motivo: 'escreveu apoio' }, podeMandarMomento: true, momentoJaEnviado: false,
    jaPediramDados: true, podePedirDados: true,
  };
  for (const [lado, temCidade] of [['sem cidade', false], ['com cidade', true]]) {
    const hoje = arv.decidir({ ...apoiando, temEtiquetaDeCidade: temCidade }, q);
    check(hoje?.id?.includes('so-expressa-apoio'), `${lado}: o apoio decide (${hoje?.id})`);
    check(hoje?.tecla === 'i', `${lado}: apoio de hoje agradece`);
    /**
     * **O TEMPO saiu do apoio em 04/09** e virou caixa propria, uma acima: quatro anotacoes no
     * mesmo lote mostraram que a razao nunca teve a ver com apoio. O desfecho e o mesmo.
     */
    const ontem = arv.decidir({ ...apoiando, temEtiquetaDeCidade: temCidade, deOutroDia: true }, q);
    check(ontem?.tecla === '5', `${lado}: de outro dia manda a do momento`);
    check(ontem?.id?.includes('contexto-de-outro-dia'), `${lado}: e quem decide e a caixa do tempo`);
  }

  // E continua ABAIXO das pendencias: quem escreveu uma pergunta e atendido por ela, nao pelo apoio.
  const comPergunta = arv.decidir({ ...apoiando, temEtiquetaDeCidade: true, perguntaAberta: { termo: 'por que' } }, q);
  check(comPergunta?.tecla === '6', 'a pergunta vence o apoio, nos dois lados');

  /**
   * A prova de que nada piorou: as pendencias de quem CHEGA continuam sendo resolvidas -- pela
   * volta, com o mesmo desfecho de antes.
   */
  const ad = 'Olá! Eu apoio as Escolas';
  const b = {
    veioDeAnuncio: true, anuncioReconhecido: true, jaRespondemosAntes: false,
    jaPediramDados: false, podePedirDados: true, pedidoHoje: false, enviadoHoje: false,
    modeloJaNaConversa: false, podeEnviar: false, temEtiquetaDeCidade: true, podeMandarMomento: true,
  };
  const bomDia = arv.decidir({ ...b, soCortesia: { motivo: 'cumprimentou' } }, q);
  check(bomDia?.tecla === '5', 'quem chega e diz "bom dia" ainda recebe a mensagem do momento');
  const remedio = arv.decidir({ ...b, pedeAjudaFinanceira: { motivo: 'remedio' }, textos: [ad, 'preciso de remedio'], ultimoTexto: 'preciso de remedio' }, q);
  check(remedio?.resposta === 'pedido-ajuda', 'e quem pede remedio ainda recebe a negativa');
}


grupo('confirmou presenca no evento: PULA e ele atende no fim (03/09/2026)');
{
  /**
   * **A confirmacao de presenca deixou de ser respondida, por pedido dele.**
   *
   * Print da Elci (03/09): ela escreveu duas vezes *"Quero confirmar minha presenca no evento:
   * AMIGOS CAPITAO MARTIM E GUSTAVO VICTORINO"*, a rodada respondeu *"Que bom! Sera uma grande
   * satisfacao contar com voce... Nome / Cidade"* e concluiu. Ele: *"nao e para responder, e para
   * pular e eu atendo no final -- nessa situacao de confirmacao para evento"*.
   *
   * A tecla e 2 e nao 3 de proposito: confirmacao de presenca nao e atendimento que se fecha, e
   * uma lista que alguem monta. Concluir tiraria da tela justamente quem ele quer atender depois.
   *
   * Antes disto era a `confirmou-presenca-com-dados` (tecla 8), do caso do Deoclecio (02/09) --
   * ela agradecia e encerrava, e foi apagada junto: duas regras para a mesma situacao divergem.
   */
  const q = arv.arrumar(arv.fluxoPadrao());
  const deoclecio = {
    jaRespondemosAntes: true, temEtiquetaDeCidade: true, confirmouPresenca: true,
    jaPediramDados: true, pedidoHoje: true, podePedirDados: true,
    podeEnviar: true, enviadoHoje: false, modeloJaNaConversa: true,
    textos: ['Que bom!', 'link'], ultimoTexto: 'https://facebook.com/x',
  };
  const tecla = (c) => arv.decidir(c, q)?.tecla ?? null;

  check(tecla(deoclecio) === '2', 'pula, deixando o atendimento aberto');
  check(tecla(deoclecio) !== '4', 'e NAO pede nome e cidade');
  check(tecla(deoclecio) !== 'i', 'nem agradece, que era o desfecho anterior');
  check(tecla(deoclecio) !== '3', 'e nao CONCLUI: concluir tiraria da tela quem ele quer atender');

  // Sem cidade da no mesmo: quem confirma presenca e sempre caso dele, com ou sem cadastro.
  check(tecla({ ...deoclecio, temEtiquetaDeCidade: false, jaPediramDados: false, pedidoHoje: false }) === '2',
    'sem etiqueta de cidade, tambem pula');

  // A recusa continua acima -- quem pediu para sair nao vira caso de evento.
  check(tecla({ ...deoclecio, semInteresse: true }) === 's', 'a recusa vence');

  /**
   * **Vence a etiqueta que dispensa da fila**, e isto e escolha: engajado que confirma presenca e
   * ainda mais o caso dele, e a etiqueta mandaria a mensagem do momento por cima da confirmacao.
   */
  check(tecla({ ...deoclecio, etiquetaQueDispensa: 'Sem Retorno', podeMandarMomento: true }) === '2',
    'e vence a etiqueta que dispensa da fila');

  // Quem NAO confirmou segue o fluxo normal.
  check(tecla({ ...deoclecio, confirmouPresenca: false }) !== '2', 'sem confirmacao, o fluxo segue como antes');

  /**
   * **O sinal e so o "sim".** Quem responde que NAO vai ao evento nao e pulado -- `confirmouPresenca`
   * e falso para ela, e o caso segue o fluxo normal. O preambulo de evento continua existindo no
   * TEXTO da tecla 4 (`pedir-dados-evento-nao`), para quando ele apertar o 4.
   */
  const naoVai = { ...deoclecio, confirmouPresenca: false, temEtiquetaDeCidade: false, jaPediramDados: false, pedidoHoje: false };
  check(tecla(naoVai) !== '2', 'quem disse que NAO vai nao e pulada por esta regra');
}

grupo('a chegada decide como a volta no que nao e recibo (04/09/2026)');
{
  /**
   * Relato dele: *"o fluxo de chegada parece ter sido deixado pra tras, confira; muitas regras se
   * aplicam la tambem"*. Estava certo, e o defeito era estrutural: a chegada e um ramo de
   * PRIORIDADE que roda antes do ramo geral, entao tudo o que ela resolve primeiro vence -- e ela
   * ia direto do bloco de perguntas para o MODELO, sem as caixas que a volta tem no meio.
   *
   * Medido antes do conserto, com um modelo disponivel: denuncia respondida, quem quer trabalhar
   * no mandato, quem pediu ligacao, quem respondeu nome e cidade e quem so se despediu recebiam
   * todos a **tecla 1** na chegada, contra 6 / pedido-emprego / pedido-ligacao / i / 3 na volta.
   *
   * Este teste compara os DOIS ramos no mesmo contexto: se alguem tirar uma caixa de um lado, os
   * dois passam a discordar e isto cai.
   */
  const q = arv.arrumar(arv.fluxoPadrao());
  const base = {
    veioDeAnuncio: true, anuncioReconhecido: false, temEtiquetaDeCidade: false,
    jaPediramDados: true, pedidoHoje: false, podePedirDados: true, podeEnviar: true,
    podeMandarMomento: true, textos: ['x'], ultimoTexto: 'x',
  };
  const desfecho = (c) => {
    const d = arv.decidir(c, q);
    return d ? `${d.tecla ?? d.resposta ?? '?'}` : 'nada';
  };

  const casos = [
    ['denuncia respondida a nossa pergunta', { respondeuComoAjudar: true }],
    ['quer trabalhar para o mandato', { pedeEmprego: { motivo: 'x' } }],
    ['pediu que a gente ligasse', { pedeLigacao: { motivo: 'x' } }],
    ['respondeu o nome e a cidade', { respondeuOsDados: true }],
    ['so se despediu', { ultimaEhDespedida: true }],
    ['so figura, sem modelo', { ultimaEhSoReacao: true, podeEnviar: false }],
    ['despediu-se ONTEM, sem modelo', { ultimaEhDespedida: true, deOutroDia: true, podeEnviar: false }],
  ];
  for (const [rotulo, extra] of casos) {
    const naChegada = desfecho({ ...base, jaRespondemosAntes: false, ...extra });
    const naVolta = desfecho({ ...base, jaRespondemosAntes: true, ...extra });
    check(naChegada === naVolta, `"${rotulo}": chegada e volta decidem igual (${naChegada} / ${naVolta})`);
    check(naChegada !== '1', `e "${rotulo}" NAO recebe o modelo na chegada`);
  }

  /**
   * **O que continua diferente, e e decisao dele (02/09): o RECIBO do anuncio vem primeiro.**
   * Quem chega por anuncio reconhecido e so diz "amem" recebe o modelo + o pedido de dados; na
   * volta, a despedida venceria. Pendencia neutra custa um dia de atraso; o recibo e o que ela
   * clicou para receber.
   */
  const comRecibo = { ...base, jaRespondemosAntes: false, anuncioReconhecido: true, jaPediramDados: false };
  check(desfecho({ ...comRecibo, ultimaEhDespedida: true }) === 'a', 'o recibo do anuncio vence a despedida na chegada');
  check(desfecho({ ...comRecibo, ultimaEhSoReacao: true }) === 'a', 'e vence a figura tambem');
}

grupo('chegou sem anuncio e so cumprimentou: boas-vindas (04/09/2026)');
{
  /**
   * Decisao dele na revisao caixa a caixa da chegada: *"se ela chegou cumprimentando, podemos
   * mandar uma mensagem: bem-vindo, voce esta falando com o gabinete do Capitao Martim, em que
   * podemos ajudar? E se puder nos forneca seu nome e cidade para melhor atende-lo -- e entao
   * concluir ate o contato responder"*.
   *
   * **Primeiro uso das duas condicoes numa caixa do padrao**: so cumprimentou E nao veio de
   * anuncio. Quem chega por anuncio tem recibo a receber, e o recibo ja pede os dados -- as duas
   * caixas nunca disputam o mesmo contato, e quem garante isso e a CONDICAO, nao a posicao.
   */
  const q = arv.arrumar(arv.fluxoPadrao());
  const base = {
    jaRespondemosAntes: false, jaPediramDados: false, temEtiquetaDeCidade: false, pedidoHoje: false,
    podePedirDados: true, podeMandarMomento: true, podeEnviar: false,
    textos: ['bom dia'], ultimoTexto: 'bom dia',
  };
  const d = (c) => arv.decidir({ ...base, ...c }, q);

  check(d({ soCortesia: { motivo: 'x' } })?.resposta === 'boas-vindas', 'sem anuncio e so cumprimento: manda as boas-vindas');
  check(d({ veioDeAnuncio: true, podeEnviar: true, soCortesia: { motivo: 'x' } })?.tecla === 'a',
    'com anuncio, o recibo continua vencendo -- as duas condicoes se excluem');

  /**
   * **As duas excecoes que ele nomeou no mesmo recado**: *"se o contexto for maior, como uma
   * pergunta ja de cara, entao eu devo assumir ou a IA"*, e *"se a pessoa for hostil ja de inicio,
   * encerra toda a conversa e e marcada como sem interesse"*.
   */
  check(d({ perguntaAberta: { termo: 'x' } })?.tecla === '6', 'pergunta logo de cara continua sendo dele ou da IA');
  check(d({ pedeRespostaPessoal: { motivo: 'x' } })?.tecla === '6', 'e texto longo ou audio tambem');
  check(d({ semInteresse: { motivo: 'x' }, soCortesia: { motivo: 'x' } })?.tecla === 's',
    'hostil de inicio: marca e conclui, mesmo cumprimentando');

  // E quem JA foi atendido nao recebe boas-vindas de novo.
  check(d({ jaRespondemosAntes: true, soCortesia: { motivo: 'x' } })?.resposta !== 'boas-vindas',
    'quem ja foi atendido nao recebe boas-vindas');
}

grupo('o quadro arrumado nao tem caixa sobreposta (04/09/2026)');
{
  /**
   * Relato dele: *"as caixas estao se sobrepondo, arrume para nao acontecer"*. A causa foi minha:
   * o cartao ganhou a linha do desfecho no topo e a do nome no rodape, cresceu, e a arrumacao
   * continuou espacando por `CAIXA.altura`, que valia 96.
   *
   * **A altura do cartao e fixa no CSS e o numero aqui tem que ser o mesmo** -- cartao que cresce
   * com o texto exigiria medir cada um na tela antes de posicionar.
   */
  const q = arv.arrumar(arv.fluxoPadrao());
  const nos = arv.todosOsNos(q).map(({ no }) => no);
  const cruzam = [];
  for (let i = 0; i < nos.length; i++) {
    for (let j = i + 1; j < nos.length; j++) {
      const A = nos[i], B = nos[j];
      const perto = Math.abs((A.x || 0) - (B.x || 0)) < arv.CAIXA.largura
        && Math.abs((A.y || 0) - (B.y || 0)) < arv.CAIXA.altura;
      if (perto) cruzam.push(`${A.rotulo} x ${B.rotulo}`);
    }
  }
  check(cruzam.length === 0, `nenhuma caixa se sobrepoe depois de arrumar (${cruzam.slice(0, 2).join(' / ') || 'ok'})`);
  check(arv.CAIXA.altura >= 140, 'a altura da caixa acompanha o conteudo do cartao');
}

grupo('situacoes juntadas na mesma caixa (04/09/2026)');
{
  /**
   * Pedido dele, com a print de duas caixas identicas: *"junte todas as situacoes que sao usadas na
   * mesma tecla; na print sao duas tecla 3, junte as duas e faca o mesmo com exemplos parecidos"*.
   *
   * E a consequencia do que ele pediu antes: se o quadro se le pelo que NOS mandamos, duas caixas
   * com o mesmo desfecho sao a mesma caixa -- o que muda entre elas e so a situacao que a libera.
   * `tambemQuando` e a lista dessas situacoes, e elas valem por OU.
   */
  const q = arv.arrumar(arv.fluxoPadrao());
  const base = { textos: ['x'], ultimoTexto: 'x' };
  const tecla = (c) => arv.decidir({ ...base, ...c }, q)?.tecla ?? null;

  // A caixa da print: assessor OU a ultima e nossa -- as duas concluem sem mandar nada.
  check(tecla({ etiquetaSoConclui: 'assessor' }) === '3', 'a caixa juntada decide pela primeira situacao');
  check(tecla({ ultimaEhNossa: 'nossa' }) === '3', 'e tambem pela segunda');

  // A de pular: confirmou presenca OU mandou o endereco.
  check(tecla({ confirmouPresenca: true }) === '2', 'confirmou presenca: pula');
  check(tecla({ informouEndereco: true }) === '2', 'mandou o endereco: pula igual');

  /**
   * **O MOTIVO tem que ser o da situacao que casou**, e nao o da primeira da lista: e a frase que
   * aparece na caixa da rodada, e ela precisa dizer POR QUE aquele contato caiu ali.
   */
  const porEndereco = arv.decidir({ ...base, informouEndereco: true }, q);
  check(/material/i.test(porEndereco?.motivo || '') && !/presen/i.test(porEndereco?.motivo || ''),
    `o motivo e o da situacao que casou, nao o da primeira da lista (${porEndereco?.motivo})`);

  /**
   * **A regra juntada continua contando como "esta no quadro"** -- se sumir desta conta, a protecao
   * do codigo dispara ANTES da arvore e vence ate a recusa. Peguei isso numa varredura: 32% das
   * decisoes mudaram, com a tecla `s` virando 2 ou 3.
   */
  check(tecla({ semInteresse: { motivo: 'x' }, informouEndereco: true }) === 's',
    'a recusa continua vencendo quem mandou o endereco');
  check(tecla({ semInteresse: { motivo: 'x' }, ultimaEhNossa: 'nossa' }) === 's',
    'e continua vencendo a conversa que termina em mensagem nossa');

  // E a peneira da importacao: situacao que nao existe mais no codigo e descartada com aviso.
  const sujo = JSON.stringify({
    formato: 'whatsfill-fluxo', versao: 1, nome: 'x', teclas: {},
    arvore: [{ id: 'a', rotulo: 'x', regra: 'ultima-e-nossa', tambemQuando: ['naoExisteEssaRegra', 'etiqueta-so-conclui'] }],
  });
  const lido = arv.deArquivo(sujo);
  check(lido.arvore?.[0]?.tambemQuando?.length === 1, 'situacao inventada e descartada na importacao');
  check(lido.avisos.some((a) => a.includes('não existe mais')), 'e o aviso sobrevive para ele ver');
}

grupo('condicoes e excecoes: a caixa decide por ela mesma (04/09/2026)');
{
  /**
   * Pedido dele: *"o fluxo trabalha com prioridade quando devia estar trabalhando com condicoes e
   * excecoes; se todas condicoes sao aceitas, enviar mensagem de acordo"*.
   *
   * Ele estava apontando um numero. Medido em 3.000 contextos sorteados no quadro padrao: **10,5
   * regras distintas casavam ao mesmo tempo**, e em **85% deles mais de uma MANDARIA mensagem** --
   * ou seja, quem escolhia a mensagem era a ALTURA da caixa, nao a condicao dela.
   *
   * Com uma condicao so, a condicao significa "eu poderia atender este contato". Com todas, ela
   * passa a significar "eu sou a resposta certa para ele".
   */
  const caixa = {
    ...arv.noVazio('material para quem chega por anuncio e ainda nao tem cadastro'),
    condicao: { sinal: 'veioDeAnuncio', negar: false, palavras: [], onde: 'ultima' },
    maisCondicoes: [
      { sinal: 'temEtiquetaDeCidade', negar: true, palavras: [], onde: 'ultima' },
      { sinal: 'jaPediramDados', negar: true, palavras: [], onde: 'ultima' },
    ],
    maisExcecoes: [{ sinal: 'respondidoHoje', negar: false, palavras: [], onde: 'ultima' }],
    acao: { tecla: '4', resposta: null },
  };
  const base = { veioDeAnuncio: true, temEtiquetaDeCidade: false, jaPediramDados: false, respondidoHoje: false, textos: [], ultimoTexto: '' };

  check(arv.casa(caixa, base), 'com TODAS as condicoes verdadeiras, a caixa decide');
  check(!arv.casa(caixa, { ...base, jaPediramDados: true }), 'uma condicao falsa ja tira a caixa do caminho');
  check(!arv.casa(caixa, { ...base, temEtiquetaDeCidade: true }), 'e qualquer uma das outras tambem');
  check(!arv.casa(caixa, { ...base, respondidoHoje: true }), 'basta UMA excecao ser verdade para a caixa nao decidir nada');

  // Numa caixa de REGRA a condicao extra ESTREITA -- nunca amplia.
  const deRegra = {
    ...arv.noVazio('so cumprimentou, mas so quem veio de anuncio'),
    regra: 'ultima-e-so-reacao',
    maisCondicoes: [{ sinal: 'veioDeAnuncio', negar: false, palavras: [], onde: 'ultima' }],
  };
  const comReacao = { ultimaEhSoReacao: true, podeMandarMomento: true, textos: [], ultimoTexto: '' };
  check(arv.casa(deRegra, { ...comReacao, veioDeAnuncio: true }), 'caixa de regra + condicao extra: casa quando as duas valem');
  check(!arv.casa(deRegra, { ...comReacao, veioDeAnuncio: false }), 'e a condicao extra estreita o que o codigo decidiria sozinho');

  /**
   * **As duas sobrevivem a importacao.** Arquivo de fluxo e entrada nao confiavel: sinal que nao
   * existe e descartado com aviso, e o resto passa inteiro.
   */
  const arquivo = JSON.stringify({ formato: 'whatsfill-fluxo', versao: 1, nome: 'x', arvore: [caixa], teclas: {} });
  const lido = arv.deArquivo(arquivo);
  check(lido.arvore?.[0]?.maisCondicoes?.length === 2, 'as condicoes extras sobrevivem a importacao');
  check(lido.arvore?.[0]?.maisExcecoes?.length === 1, 'e as excecoes extras tambem');

  const sujo = JSON.stringify({
    formato: 'whatsfill-fluxo', versao: 1, nome: 'x', teclas: {},
    arvore: [{ ...caixa, maisCondicoes: [{ sinal: 'sinalQueNaoExiste' }, { sinal: 'deOutroDia' }] }],
  });
  const peneirado = arv.deArquivo(sujo);
  check(peneirado.arvore?.[0]?.maisCondicoes?.length === 1, 'sinal inventado e descartado na importacao');
  check(peneirado.avisos.some((a) => a.includes('desconhecido')), 'e o aviso sobrevive para ele ver');

  /**
   * **O EMPATE e acusado** -- escolha dele: *"a de cima ganha, e o quadro acusa"*. So conta quem
   * ENVIA: duas caixas que concluem em silencio nao custam nada.
   */
  const q = arv.arrumar(arv.fluxoPadrao());
  const comEmpate = arv.decidir({
    veioDeAnuncio: true, anuncioReconhecido: false, jaRespondemosAntes: false, temEtiquetaDeCidade: false,
    jaPediramDados: false, pedidoHoje: false, podePedirDados: true, podeEnviar: true, podeMandarMomento: true,
    deOutroDia: true, soExpressaApoio: { motivo: 'x' }, textos: ['x'], ultimoTexto: 'x',
  }, q);
  check((comEmpate?.empate || []).length > 0, `a decisao diz com quem empatou (${(comEmpate?.empate || []).length} caixas)`);

  const semEmpate = arv.decidir({ semInteresse: { motivo: 'x' }, textos: ['x'], ultimoTexto: 'x' }, q);
  check((semEmpate?.empate || []).length === 0, 'quem conclui em silencio nao gera empate');
}

grupo('mandou o endereco: PULA e ele transfere no fim (04/09/2026)');
{
  /**
   * Pedido dele (04/09/2026), com o anuncio novo de material de campanha: *"eu peco endereco... a
   * pessoa deve ser pulada e nao concluida, pois vou transferir pro responsavel a conversa no
   * final"*. E, sobre como reconhecer: *"deixe somente para quando eu pedir endereco, no momento
   * so peco endereco para enviar material"*.
   *
   * Mesma forma da confirmacao de presenca, e pela mesma razao: **concluir tiraria da tela
   * justamente a conversa que precisa ser passada para outra pessoa.**
   */
  const q = arv.arrumar(arv.fluxoPadrao());
  const comEndereco = {
    jaRespondemosAntes: true, temEtiquetaDeCidade: true, informouEndereco: true,
    jaPediramDados: true, pedidoHoje: false, podePedirDados: true,
    podeEnviar: true, enviadoHoje: false, modeloJaNaConversa: true,
    podeMandarMomento: true,
    textos: ['Rua das Flores, 123'], ultimoTexto: 'Rua das Flores, 123',
  };
  const tecla = (c) => arv.decidir(c, q)?.tecla ?? null;

  check(tecla(comEndereco) === '2', 'pula, deixando o atendimento aberto para transferir');
  check(tecla(comEndereco) !== '3', 'e nao CONCLUI, que e o que ele pediu explicitamente');
  check(tecla(comEndereco) !== '1', 'nem manda o modelo por cima de quem ja esta esperando o material');
  check(tecla(comEndereco) !== '5', 'nem a mensagem do momento');

  // Os dois lados da bifurcacao de cidade: protecao que vive num lado so e protecao pela metade.
  check(tecla({ ...comEndereco, temEtiquetaDeCidade: false, jaPediramDados: false }) === '2',
    'sem etiqueta de cidade, tambem pula');

  // Quem chega pelo anuncio e ja manda o endereco na primeira mensagem.
  check(tecla({ ...comEndereco, jaRespondemosAntes: false, temEtiquetaDeCidade: false, jaPediramDados: false,
    veioDeAnuncio: true, anuncioReconhecido: true }) === '2', 'na chegada pelo anuncio, tambem pula');

  // A recusa continua acima: quem pediu para sair nao vira caso de material.
  check(tecla({ ...comEndereco, semInteresse: true }) === 's', 'a recusa vence');

  // Sem o sinal, nada muda.
  check(tecla({ ...comEndereco, informouEndereco: false }) !== '2', 'sem endereco, o fluxo segue como antes');

  /**
   * **E decide mesmo no quadro que ele ainda NAO importou** — a regra esta em `PROTECOES`, entao
   * a ausencia da caixa nao vira envio. E o remendo que a `ultima-e-nossa` obrigou a criar em
   * 03/09, e este caso nasce precisando dele: o anuncio e de hoje.
   */
  const semACaixa = arv.arrumar(arv.fluxoPadrao());
  const podar = (nos) => nos.filter((no) => no.regra !== 'informou-endereco')
    .map((no) => ({
      ...no,
      // Tirar a regra tambem de dentro das caixas JUNTADAS -- senao ela continua no quadro, e a
      // protecao do codigo (que so cobre a ausencia) nao dispara.
      tambemQuando: (no.tambemQuando || []).filter((id) => id !== 'informou-endereco'),
      filhos: podar(no.filhos || []),
    }));
  const decisao = arv.decidir(comEndereco, podar(semACaixa));
  check(decisao?.tecla === '2', 'sem a caixa no quadro dele, a protecao do codigo decide igual');
  check(decisao?.caminho?.[0] === 'protecao do codigo', 'e o Andamento diz de onde veio');
}

grupo('desabafo longo vai para a IA, nao para a mensagem do momento (02/09/2026)');
{
  /**
   * Print da Cris (02/09/2026): contato com etiqueta de cidade e de conteudo escreveu 437
   * caracteres de desabafo — sem esperanca nas eleicoes, urnas, "tudo tempo perdido", "Triste!".
   * O atendimento ficou sem classificacao e ele teve que assumir a mao. Relato dele: *"a IA devia
   * ter assumido e mandado uma mensagem personalizada"*.
   *
   * Dois defeitos somados, e os dois sao de ORDEM dentro do quadro:
   *
   *  1. `ja-respondemos-antes` estava ACIMA das caixas que reconhecem "isto precisa de gente".
   *     Quem ja foi atendida e escreve QUALQUER coisa recebia a mensagem do momento — uma
   *     mensagem de campanha em cima de um desabafo.
   *  2. A caixa "so mandou bom dia" casa por PALAVRA CONTIDA, e o desabafo comeca com "Oi. Bom
   *     dia,". Mesmo sem o defeito 1, um texto longo que comece com saudacao levava a mensagem
   *     do momento por ser confundido com um "bom dia" seco.
   */
  const q = arv.arrumar(arv.fluxoPadrao());
  const desabafo =
    'Oi. Bom dia,\n\nVenho aqui para desabafar, estou muito triste, sem esperanca sobre as ' +
    'eleicoes, sobre futuro do pais. Sim, eu vou votar, vou fazer minha parte como sempre, mas do ' +
    'q adianta se e o sistema que manda? As urnas nao sao confiaveis todos sabem, mentem todo ' +
    'tempo e nada acontece..... Onde trabalho escuto alguns comentarios q da vontade de chorar. ' +
    'E acho q e tudo tempo perdido. Triste!';

  const daCris = {
    textos: [desabafo],
    ultimoTexto: desabafo,
    // O sinal que o painel calcula para texto longo: "e conversa, nao e caso de modelo".
    pedeRespostaPessoal: { motivo: 'escreveu 437 caracteres — e conversa, nao e caso de modelo' },
    temEtiquetaDeCidade: true,
    jaRespondemosAntes: true,
    jaPediramDados: true,
    podeEnviar: true,
    podeMandarMomento: true,
  };

  const r = arv.decidir(daCris, q);
  const nome = (id) => arv.localizar(q, id)?.no?.rotulo || id;
  const caminho = (r?.caminho || []).map(nome).join(' > ');

  /**
   * **A tecla 6 E o caminho da IA**: o painel a chama em `!sugestao || sugestao.tecla === '6'`, e
   * quando ela escala o rascunho personalizado pode sair. Qualquer outra tecla aqui e uma mensagem
   * pronta em cima de um desabafo.
   */
  check(r?.tecla === '6', `desabafo longo vai para quem escreve, nao para o momento (deu ${r?.tecla}, por ${caminho})`);
  check(r?.tecla !== '5', 'e NUNCA a mensagem do momento');

  // O mesmo texto sem a etiqueta de cidade tem que ir para o mesmo lugar: e o texto que decide.
  const semCidade = arv.decidir({ ...daCris, temEtiquetaDeCidade: false, podePedirDados: true }, q);
  check(semCidade?.tecla === '6', `sem etiqueta de cidade tambem vai para gente (deu ${semCidade?.tecla})`);

  /**
   * **A saudacao dentro de um texto longo nao pode valer como "so mandou bom dia".** Sem esta
   * assercao, a caixa de palavras volta a pegar qualquer desabafo que comece com "Bom dia".
   */
  // `soCortesia` junto: e o sinal que um "Bom dia!" seco produz de verdade. Sem ele o teste media
  // a caixa de baixo e prometia, no nome, uma coisa que nao estava exercitando.
  const soSaudacao = { ...daCris, pedeRespostaPessoal: null, soCortesia: { motivo: 'so cumprimentou' }, ultimoTexto: 'Bom dia!', textos: ['Bom dia!'] };
  check(arv.decidir(soSaudacao, q)?.tecla === '5', 'um "Bom dia!" seco continua recebendo a mensagem do momento');
}

grupo('as protecoes valem mesmo fora do quadro dele (03/09/2026)');
{
  /**
   * O quadro de trabalho e uma COPIA do padrao, e nada entra nele sozinho. Certo como desenho -- a
   * posicao e a prioridade, e ele escolhe. O preco apareceu no mesmo dia: ele reportou DUAS vezes a
   * conversa em que so nos falamos recebendo mensagem, eu criei `ultima-e-nossa`, e a regra nao
   * podia decidir nada para ele, porque so existia no padrao.
   *
   * A distincao e entre PREFERENCIA (onde, o que, em que ordem: dele) e PROTECAO ("nao mande
   * nada": nao ha ordem em que seja outra coisa).
   */
  const f = { ordem: [], desligadas: [], teclas: {} };
  const padrao = arv.arrumar(arv.fluxoPadrao());
  const tira = (nos) => nos.filter((n) => {
    n.filhos = tira(n.filhos || []);
    return !['ultima-e-nossa', 'etiqueta-so-conclui', 'sem-interesse'].includes(n.regra);
  });
  const dele = tira(JSON.parse(JSON.stringify(padrao)));

  const chegando = { veioDeAnuncio: true, jaRespondemosAntes: false, podeEnviar: true, podePedirDados: true, podeMandarMomento: true };

  const vazia = arv.decidir({ ...chegando, ultimaEhNossa: 'vazia' }, dele, f);
  check(vazia?.tecla === '3', 'sem a caixa no quadro, a protecao decide = ' + JSON.stringify(vazia));
  check(vazia?.id.startsWith('protecao:'), 'e diz que veio do codigo, nao do quadro');
  check(vazia?.caminho.join('') .includes('protecao'), 'o caminho aparece no log da rodada');

  check(arv.decidir({ ...chegando, etiquetaSoConclui: 'Assessor Cap' }, dele, f)?.tecla === '3', 'a de assessor tambem');
  check(arv.decidir({ ...chegando, semInteresse: { motivo: 'pediu para sair' } }, dele, f)?.tecla === 's', 'e a recusa tambem');

  /**
   * **Tendo a caixa, quem decide e o QUADRO.** A lista so cobre a ausencia -- senao ela passaria
   * por cima da posicao que ele escolheu, que e o oposto do que a janela existe para dar.
   */
  const comAsCaixas = arv.decidir({ ...chegando, ultimaEhNossa: 'vazia' }, padrao, f);
  check(comAsCaixas?.id.startsWith('r:'), 'com a caixa no quadro, quem decide e o quadro');

  // Desligada por ele continua desligada: a lista nao ressuscita escolha dele.
  const desligada = arv.decidir({ ...chegando, ultimaEhNossa: 'vazia' }, dele, { ...f, desligadas: ['ultima-e-nossa'] });
  check(desligada?.tecla !== '3' || desligada?.id.startsWith('r:'), 'desligada por ele, a protecao nao volta');

  // E o caso normal continua andando pelo quadro dele, sem interferencia.
  check(arv.decidir({ ...chegando, anuncioReconhecido: true, ultimaEhNossa: false, textos: ['oi'], ultimoTexto: 'oi' }, dele, f)?.tecla === 'a',
    'quem chega normal continua recebendo modelo + dados');
}

grupo('a EXCECAO da caixa (03/09/2026)');
{
  /**
   * Pedido dele: *"algo que notei que esta faltando nos ramos e em geral: condicao de mandar
   * mensagem e excecao"*. E o buraco mais caro do quadro livre, o mesmo que `problemas` acusava
   * sem poder resolver: a caixa dele PARECE a regra do codigo e tem o mesmo desfecho na tela, mas
   * nao carrega as guardas dela. Ate aqui, a unica forma de dizer "mande, mas nao quando X" era
   * nao usar a caixa.
   */
  const f = { ordem: [], desligadas: [], teclas: {} };
  const caixa = (extra) => ({
    ...arv.noVazio('mandar o modelo'),
    id: 'x',
    condicao: { sinal: 'anuncioReconhecido', negar: false, palavras: [], onde: 'ultima' },
    acao: { tecla: '1', resposta: null },
    ...extra,
  });

  const semExcecao = [caixa()];
  check(arv.decidir({ anuncioReconhecido: true }, semExcecao, f)?.tecla === '1', 'sem excecao, a caixa decide');

  const comExcecao = [caixa({ excecao: { sinal: 'modeloJaNaConversa', negar: false, palavras: [], onde: 'ultima' } })];
  check(arv.decidir({ anuncioReconhecido: true }, comExcecao, f)?.tecla === '1', 'excecao falsa nao atrapalha');
  check(arv.decidir({ anuncioReconhecido: true, modeloJaNaConversa: true }, comExcecao, f) === null,
    'excecao verdadeira impede a caixa de decidir');

  // A excecao NAO para a busca: o irmao de baixo continua sendo tentado.
  const irmaos = [
    caixa({ excecao: { sinal: 'modeloJaNaConversa', negar: false, palavras: [], onde: 'ultima' } }),
    { ...arv.noVazio('entao pede os dados'), id: 'y', condicao: { sinal: '', negar: false, palavras: [], onde: 'ultima' }, acao: { tecla: '4', resposta: null } },
  ];
  check(arv.decidir({ anuncioReconhecido: true, modeloJaNaConversa: true }, irmaos, f)?.tecla === '4',
    'com a excecao valendo, o irmao de baixo decide');

  // Por PALAVRA tambem.
  const porPalavra = [caixa({ excecao: { sinal: '', negar: false, palavras: ['ja recebi'], onde: 'ultima' } })];
  check(arv.decidir({ anuncioReconhecido: true, ultimoTexto: 'obrigado, ja recebi' }, porPalavra, f) === null,
    'excecao por palavra tambem impede');
  check(arv.decidir({ anuncioReconhecido: true, ultimoTexto: 'quero receber' }, porPalavra, f)?.tecla === '1',
    'palavra que nao aparece nao impede');

  /**
   * **Vale para caixa de REGRA, e so para ESTREITAR.** Era o unico lugar do quadro que ele nao
   * podia tocar. Excecao nunca faz mensagem passar a sair; so deixar de sair.
   */
  const daRegra = { ...arv.noVazio('conteudo'), id: 'r', regra: 'conteudo-pedido', condicao: null,
    excecao: { sinal: 'temEtiquetaDeCidade', negar: false, palavras: [], onde: 'ultima' } };
  const ctxRegra = { podeEnviar: true, enviadoHoje: false, modeloJaNaConversa: false, conteudoPedido: 'ADS' };
  check(arv.decidir(ctxRegra, [{ ...daRegra, excecao: { sinal: '', negar: false, palavras: [], onde: 'ultima' } }], f)?.tecla === '1',
    'a regra do codigo decide como sempre');
  check(arv.decidir({ ...ctxRegra, temEtiquetaDeCidade: true }, [daRegra], f) === null,
    'com a excecao, a mesma regra deixa de alcancar aquele contato');

  /**
   * **A excecao conta como GUARDA no `problemas`** -- e para isso que ela serve. A caixa que
   * mandava em toda passada deixa de ser acusada quando ele poe "exceto quando o modelo ja esta na
   * conversa".
   */
  const acusa = (no) => arv.problemas([no]).some((m) => m.includes('mandar de novo'));
  check(acusa(caixa()), 'sem excecao, a caixa e acusada de repetir');
  check(!acusa(caixa({ excecao: { sinal: 'modeloJaNaConversa', negar: false, palavras: [], onde: 'ultima' } })),
    'com a excecao certa, o aviso some');
  check(acusa(caixa({ excecao: { sinal: 'modeloJaNaConversa', negar: true, palavras: [], onde: 'ultima' } })),
    'com a polaridade errada, continua acusando');

  // Sobrevive ao arquivo, e sinal inventado e descartado com aviso.
  const arq = arv.paraArquivo({ arvore: comExcecao, teclas: {} }, 'x');
  const volta = arv.deArquivo(JSON.stringify(arq));
  check(volta.ok && volta.arvore[0].excecao.sinal === 'modeloJaNaConversa', 'a excecao sobrevive ao arquivo');

  const sujo = arv.paraArquivo({ arvore: [caixa({ excecao: { sinal: 'enviarPix', negar: false, palavras: [], onde: 'ultima' } })], teclas: {} }, 'x');
  const peneirado = arv.deArquivo(JSON.stringify(sujo));
  check(peneirado.ok && !peneirado.arvore[0].excecao.sinal, 'sinal inventado na excecao e descartado');
  check((peneirado.avisos || []).some((a) => a.includes('exce')), 'e o descarte aparece no aviso');

  // No texto que ele cola para mim, a excecao aparece.
  check(arv.paraTexto(comExcecao).includes('EXCETO'), 'o texto do fluxo mostra a excecao');
}

grupo('so cumprimentou: nao oferece a mensagem do momento duas vezes (03/09/2026)');
{
  /**
   * Print da Carmem Souza: a caixa mostrava, em amarelo, *"Hoje este contato ja recebeu: Mensagem
   * do momento as 09:36"* -- e recomendava, em destaque, a tecla 5. Ele: *"sugestao totalmente
   * errada, ja identificou que mandou e sugeriu mandar novamente"*.
   *
   * E a armadilha da caixa com tecla FIXA: ela parece a regra do codigo e tem o mesmo desfecho na
   * tela, mas nao carrega as guardas dela. `ultima-e-so-reacao`, logo abaixo, nunca teve o
   * problema -- a tecla dela e funcao e olha `respondidoHoje`.
   *
   * `repeteSozinha` nao acusava, e com razao: `soCortesia` le a rajada DEPOIS da nossa ultima
   * mensagem, entao o envio apaga o sinal. O que houve foi ela escrever de novo no mesmo dia.
   */
  const q = arv.arrumar(arv.fluxoPadrao());
  const base = {
    jaRespondemosAntes: true, temEtiquetaDeCidade: true, jaPediramDados: true,
    soCortesia: { motivo: 'so cumprimentou' }, podeMandarMomento: true,
  };

  check(arv.decidir({ ...base, momentoJaEnviado: false }, q)?.tecla === '5',
    'a do momento ainda nao saiu: a caixa manda');
  const jaFoi = arv.decidir({ ...base, momentoJaEnviado: true, respondidoHoje: true }, q);
  check(jaFoi?.tecla === '3', 'ja saiu hoje: conclui em vez de repetir');
  check(jaFoi?.id === 'r:ja-respondemos-antes', `e quem decide e a caixa generica do fim (${jaFoi?.id})`);

  // Vale nos DOIS lados da bifurcacao de cidade -- a caixa nasce em `dosDoisLados`.
  check(arv.decidir({ ...base, temEtiquetaDeCidade: false, respondidoHoje: false, momentoJaEnviado: true }, q)?.tecla !== '5',
    'sem etiqueta de cidade tambem nao repete');

  check(arv.problemas(q).length === 0, 'e o quadro continua sem problemas acusados');
}

grupo('o lado SEM cidade tambem fecha, e o modelo vem antes do obrigado (03/09/2026)');
{
  const q = arv.arrumar(arv.fluxoPadrao());
  const d = (c) => arv.decidir(c, q);

  /**
   * **Quatro anotacoes, o mesmo buraco.** Antonio Bersch (*"mandou foto ou sticker de boa noite, so
   * concluir"*), jairoc e Sidnei Martins (*"mandou link, pode concluir"*) e Maria de Lourdes
   * (*"quando voltasse pelo mesmo anuncio sem enviar nada alem do texto padrao era pra concluir"*).
   *
   * Os tres grupos do lado "sem etiqueta de cidade" cobrem quem AINDA nao foi respondido hoje, quem
   * tem dado ou modelo a receber, e a chegada por anuncio cadastrado. Quem ja foi respondido hoje e
   * nao tem nada disso atravessava os tres e saia sem desfecho -- o lado "com cidade" nunca teve
   * esse buraco, porque `ja-respondemos-antes` o fecha.
   */
  const semCidade = {
    jaRespondemosAntes: true, temEtiquetaDeCidade: false, respondidoHoje: true,
    jaPediramDados: true, ultimaEhSoReacao: true, podeMandarMomento: true, momentoJaEnviado: true,
  };
  const fecha = d(semCidade);
  check(fecha?.tecla === '3', 'ja respondido hoje, sem cidade: conclui em vez de sair sem desfecho');
  /**
   * **Quem fecha passou a ser a caixa da REACAO** (03/09, ao desfazer a divisao "com pendencia" /
   * "sem pendencia"): ela le o que a pessoa fez e ja tinha `respondidoHoje` na propria tecla. O
   * desfecho e o mesmo -- concluir --, e o motivo na tela ficou melhor.
   *
   * O que este teste protege e o DESFECHO, nao o id: sem nenhuma das duas o contato saia sem nada.
   */
  check(fecha?.id?.includes('ultima-e-so-reacao') || fecha?.id?.includes('ja-respondemos-antes'),
    `e alguma caixa fecha o caso (${fecha?.id})`);

  // E nao rouba a vez de quem ainda nao foi respondido: la a pendencia continua decidindo.
  check(d({ ...semCidade, respondidoHoje: false, momentoJaEnviado: false })?.id === 'r:ultima-e-so-reacao:sem-cidade',
    'ainda nao respondido hoje: a pendencia decide, como antes');

  /**
   * **O modelo vem ANTES do agradecimento** -- anotacao da Rosa: ela ja tinha cidade, voltou
   * clicando num anuncio novo e escreveu so apoio, e a caixa recomendou agradecer. Ele: *"ela veio
   * por um anuncio diferente do padrao, vou mandar o modelo"*.
   *
   * O lado "com etiqueta de cidade" nao tinha `conteudo-pedido`: quem voltava com cidade e clicava
   * num anuncio novo nunca recebia o modelo daquele anuncio.
   */
  const rosa = {
    jaRespondemosAntes: true, temEtiquetaDeCidade: true, jaPediramDados: true, respondidoHoje: false,
    soExpressaApoio: { motivo: 'apoio' }, podeEnviar: true, enviadoHoje: false,
    modeloJaNaConversa: false, anuncioReconhecido: true, veioDeAnuncio: true,
  };
  check(d(rosa)?.tecla === '1', 'anuncio novo com modelo mapeado: o modelo sai');
  check(d(rosa)?.id === 'r:conteudo-pedido:com-cidade-anuncio', 'pela caixa que fica dentro do anuncio reconhecido');

  /**
   * **E o modelo so passa na frente do apoio quando o ANUNCIO foi reconhecido** -- anotacao da
   * Elaine (04/09/2026), que desfez metade do conserto da Rosa: ela ja tinha cidade, escreveu
   * *"Tamos junto capitao"* ONTEM, sem anuncio reconhecido, e recebeu o modelo. Ele: *"nao foi
   * arrumado"*.
   *
   * A diferenca entre as duas e o anuncio, nao o apoio: a Rosa clicou em algo que tem modelo
   * proprio e nunca saiu; a Elaine so disse que esta junto, e o "modelo" dela vem da etiqueta de
   * conteudo -- o caminho que o criterio de tempo do apoio deve decidir.
   */
  const elaine = { ...rosa, anuncioReconhecido: false, deOutroDia: true, podeMandarMomento: true };
  check(d(elaine)?.tecla === '5', `sem anuncio reconhecido, o tempo decide (${d(elaine)?.id})`);
  check(d(elaine)?.id?.includes('contexto-de-outro-dia'), 'pela caixa do tempo');
  // E no mesmo dia, quem decide volta a ser o apoio.
  check(d({ ...elaine, deOutroDia: false })?.tecla === 'i', 'no mesmo dia, o apoio decide');

  /**
   * Quem nao expressou apoio nenhum continua recebendo o modelo pela caixa de baixo -- **desde que
   * tenha escrito hoje**. De outro dia, o tempo decide antes, que e o caso do Giovani.
   */
  const semApoio = { ...elaine, soExpressaApoio: null, deOutroDia: false };
  check(d(semApoio)?.tecla === '1', 'sem apoio e no mesmo dia, o modelo sai como antes');
  check(d(semApoio)?.id === 'r:conteudo-pedido:com-cidade', 'pela copia de baixo');
  check(d({ ...semApoio, deOutroDia: true })?.tecla === '5', 'de outro dia, a do momento (o caso do Giovani)');

  // E as guardas da regra sao o que impede virar repeticao.
  check(d({ ...rosa, modeloJaNaConversa: true })?.tecla === 'i', 'modelo ja na conversa: volta a agradecer');
  check(d({ ...rosa, podeEnviar: false })?.tecla === 'i', 'sem modelo mapeado tambem');

  // A pendencia continua vencendo o modelo nos dois lados.
  check(d({ ...rosa, perguntaAberta: { termo: 'por que' } })?.tecla === '6',
    'pergunta vence o modelo, no lado com cidade');

  check(arv.problemas(q).length === 0, 'e o quadro continua sem problemas acusados');
}

grupo('respondeu o nome e a cidade VENCE o modelo, nos dois lados (03/09/2026)');
{
  /**
   * **Conflito que eu mesmo criei** ao trazer `conteudo-pedido` para `dosDoisLados`. A prioridade
   * esta escrita na regra desde 02/09 -- *"vem ACIMA de conteudo-pedido de proposito: quem
   * respondeu o que pedimos nao precisa de mais material"* -- e valia porque as duas moravam no
   * mesmo grupo. Com o modelo subindo de grupo, o lado sem cidade passou a decidir o modelo antes
   * de chegar la: medido, tecla 1 em vez do agradecimento.
   *
   * **A licao:** ordem escrita numa regra nao se garante sozinha quando as caixas mudam de grupo.
   */
  const q = arv.arrumar(arv.fluxoPadrao());
  const base = { jaRespondemosAntes: true, jaPediramDados: true, respondeuOsDados: true,
    podeEnviar: true, enviadoHoje: false, modeloJaNaConversa: false };

  for (const [lado, cidade, hoje] of [
    ['sem cidade, nao respondido hoje', false, false],
    ['sem cidade, ja respondido hoje', false, true],
    ['com cidade', true, false],
  ]) {
    const r = arv.decidir({ ...base, temEtiquetaDeCidade: cidade, respondidoHoje: hoje }, q);
    check(r?.id?.includes('respondeu-os-dados'), `${lado}: agradece, nao manda o modelo (${r?.id})`);
    check(r?.tecla === 'i', `${lado}: e a tecla e a do agradecimento`);
  }

  // Sem o sinal, o modelo volta a ser o desfecho -- a caixa nova nao roubou a vez de ninguem.
  const semSinal = arv.decidir({ ...base, respondeuOsDados: false, temEtiquetaDeCidade: true }, q);
  check(semSinal?.tecla === '1', 'quem NAO respondeu os dados continua recebendo o modelo');

  /**
   * **Nenhuma caixa do padrao esta morta.** Ele perguntou se havia regra minha impedindo remocao --
   * nao ha, e este teste e a conferencia: toda caixa com desfecho decide em algum contexto.
   */
  const q2 = arv.arrumar(arv.fluxoPadrao());
  const comDesfecho = arv.todosOsNos(q2).filter(({ no }) => no.acao || no.regra);
  const decidiram = new Set();
  const bits = ['temEtiquetaDeCidade', 'jaRespondemosAntes', 'respondidoHoje', 'jaPediramDados'];
  const gatilhos = [
    { semInteresse: { motivo: 'x' } }, { etiquetaSoConclui: 'assessor' }, { ultimaEhNossa: 'nossa' },
    { confirmouPresenca: true }, { etiquetaQueDispensa: 'Sem Retorno', podeMandarMomento: true },
    { informouEndereco: true },
    { pedeAjudaFinanceira: { motivo: 'x' } }, { pedeEmprego: { motivo: 'x' } },
    { pedeLigacao: { motivo: 'x' } },
    { pedeAlgoIndefinido: { motivo: 'x', trecho: 'x' } }, { perguntaAberta: { termo: 'x' } },
    { pedeRespostaPessoal: { motivo: 'x' } }, { soCortesia: { motivo: 'x' }, podeMandarMomento: true },
    { ultimaEhSoReacao: true, podeMandarMomento: true }, { ultimaEhDespedida: true },
    { soExpressaApoio: { motivo: 'x' } }, { respondeuComoAjudar: true }, { respondeuOsDados: true },
    { soRuidoDaPlataforma: true, podePerguntarInteresse: true },
    // O tempo: sem ele na lista, as tres caixas de "a ultima dela e de outro dia" ficam sem gatilho.
    { deOutroDia: true, podeMandarMomento: true },
    { podeEnviar: true }, { podePedirDados: true }, { voltouPorOutroAnuncio: true, modeloJaNaConversa: true },
    // A rajada de cliques (a Irene, 05/09): sem ela aqui, as tres caixas de
    // "so clicou em varios anuncios" aparecem como mortas.
    { rajadaDeAnuncios: { motivo: 'x', quantos: 3 }, podeMandarMomento: true },
    { anuncioReconhecido: true, podeEnviar: true, podePedirDados: true },
    // Sem modelo mapeado: e a unica porta para o ramo "veio de um anuncio que eu reconheco".
    { anuncioReconhecido: true, podeEnviar: false, podePedirDados: true }, {},
  ];
  for (const g of gatilhos) {
    for (let m = 0; m < 16; m++) {
      const c = { podeMandarMomento: true, podePedirDados: true, ...g };
      bits.forEach((b, i) => { if (!(b in g)) c[b] = !!(m & (1 << i)); });
      const r = arv.decidir(c, q2);
      if (r) decidiram.add(r.id);
    }
  }
  const mortas = comDesfecho.filter(({ no }) => !decidiram.has(no.id)).map(({ no }) => no.id);
  check(mortas.length === 0, `nenhuma caixa do padrao esta morta (${mortas.join(', ') || 'ok'})`);
}

{
  grupo('o material pedido nao vence com o dia (05/09/2026)');

  /**
   * Regra dele: *"o modelo de material e uma excecao, ele sempre tem que ser mandado quando
   * requisitado"*. A print: ela chegou pelo anuncio do Facebook escrevendo *"Ola! Eu quero receber
   * o Material da Direita"* as 13:23, a rodada so a alcancou no dia seguinte -- e mandou a
   * **mensagem do momento**, concluindo.
   *
   * Medido antes do conserto: `contexto-de-outro-dia` fica acima da entrega do modelo nos tres
   * ramos, entao o pedido de material vencia o dia. As duas excecoes ficam na CONDICAO, e nao na
   * posicao: assim valem tambem no quadro que ele ja exportou.
   */
  const fluxo = arv.fluxoPadrao();
  const pedido = 'Ola! Eu quero receber o Material da Direita';
  const materialPendente = !!cortesia.pedeMaterial([{ texto: pedido, tipo: 'TEXT' }]);
  check(materialPendente, 'o texto do anuncio de material e reconhecido como pedido');

  const base = {
    veioDeAnuncio: true, podeMandarMomento: true, podePedirDados: true,
    textos: [pedido], ultimoTexto: pedido, deOutroDia: true, materialPendente,
  };

  const chegada = arv.decidir({ ...base, podeEnviar: true }, fluxo, {});
  check(chegada?.tecla === 'a', `de ontem, na chegada, o modelo sai igual (tecla ${chegada?.tecla})`);

  const volta = arv.decidir({ ...base, jaRespondemosAntes: true, temEtiquetaDeCidade: true, podeEnviar: true }, fluxo, {});
  check(volta?.tecla === '1', `de ontem, na volta, o modelo sai igual (tecla ${volta?.tecla})`);

  /**
   * **A guarda contra a repeticao e a ENTREGA, e nao o tempo.** Saindo o modelo, o sinal se apaga
   * (quem calcula soma `!modeloJaNaConversa && !enviadoHoje`) e a caixa do tempo volta a valer --
   * senao o texto do anuncio, que fica na conversa para sempre, viraria maquina de repetir.
   */
  const entregue = arv.decidir(
    { ...base, materialPendente: false, jaRespondemosAntes: true, temEtiquetaDeCidade: true, podeEnviar: true, modeloJaNaConversa: true },
    fluxo, {}
  );
  check(entregue?.tecla === '5', 'entregue o modelo, "a ultima dela e de outro dia" volta a decidir');

  /**
   * A OUTRA caixa que enterrava o pedido, achada na varredura: `respondeu-os-dados` agradece e
   * conclui *"sem mandar modelo, porque o modelo ja foi o recibo da chegada"* -- argumento que
   * deixa de valer quando o recibo nao foi. Caminho real na configuracao dele: sem modelo padrao
   * cadastrado, ela recebe so o formulario, responde "Maria, Canoas" e era concluida sem material.
   */
  const respondeu = arv.decidir(
    { ...base, deOutroDia: false, respondeuOsDados: true, jaPediramDados: true, podeEnviar: true }, fluxo, {}
  );
  check(respondeu?.tecla === '1', `quem respondeu os dados sem ter recebido o material recebe o modelo (tecla ${respondeu?.tecla})`);

  const respondeuComRecibo = arv.decidir(
    { ...base, deOutroDia: false, respondeuOsDados: true, jaPediramDados: true, podeEnviar: true, materialPendente: false, modeloJaNaConversa: true },
    fluxo, {}
  );
  check(respondeuComRecibo?.tecla === 'i', 'tendo recebido, o agradecimento continua sendo o desfecho');
}

{
  grupo('quem tem etiqueta de ADS veio de anuncio (05/09/2026)');

  /**
   * Print dele (o Orides): etiqueta **ADS** no CRM, mandou um video do TikTok, e recebeu as
   * boas-vindas de *"chegou sem anuncio"* com o pedido de cadastro junto. *"a pessoa com etiqueta
   * de ADS e parou no ramo de sem etiqueta"*.
   *
   * A causa estava no painel: o sinal lia so `session.utm`, que e "veio de anuncio NESTA sessao".
   * Quem clicou semanas atras e voltou sozinho abre sessao sem `utm` -- e a etiqueta e justamente
   * o que guarda que ele veio de la. Aqui o teste trava o que o QUADRO faz com o sinal.
   */
  const fluxo = arv.fluxoPadrao();
  const video = [{ texto: '', tipo: 'VIDEO' }];
  const base = {
    soCortesia: cortesia.soCortesia(video, null),
    ultimaEhSoReacao: cortesia.ultimaEhSoReacao(video),
    podeMandarMomento: true,
    podePedirDados: true,
    textos: [''],
    ultimoTexto: '',
  };

  const semAds = arv.decidir({ ...base, veioDeAnuncio: false }, fluxo, {});
  check(semAds?.resposta === 'boas-vindas', 'sem anuncio, a chegada que so cumprimenta recebe boas-vindas');

  const comAds = arv.decidir({ ...base, veioDeAnuncio: true }, fluxo, {});
  check(comAds?.resposta !== 'boas-vindas', 'com anuncio, NAO recebe "chegou sem anuncio" -- era o defeito');
  check(comAds?.tecla === '5', `e cai na caixa da reacao, que manda a mensagem do momento (tecla ${comAds?.tecla})`);
}

{
  grupo('ja atendida antes nao recebe as boas-vindas de novo (05/09/2026)');

  /**
   * Print da ROSA: figura de "bom dia" as 05:49, etiquetas de cidade, de COREDE e de conteudo no
   * CRM, e a rodada mandou *"Bem-vindo. Voce esta falando com o gabinete do Capitao Martim"* e
   * concluiu. Ele: *"nao foi a primeira vez que a pessoa veio, mesmo que esteja sem etiqueta ADS;
   * correto seria mensagem do momento, dois casos seguidos ja"*.
   *
   * Ela voltou sozinha e isso abre SESSAO NOVA: `state.nossas` nasce vazio e `jaRespondemosAntes`
   * dava falso, entao o quadro a mandava para o ramo "pessoa nova". O conserto e no painel -- o
   * sinal passou a ler tambem a marca do CRM (a etiqueta de cidade que ja estava la, e a Data de
   * conclusao). Aqui fica travado o que o QUADRO faz com o sinal, que e a metade testavel.
   *
   * Mesma familia do Orides, logo acima: a sessao e uma janela, a marca no CRM e a memoria.
   */
  const fluxo = arv.fluxoPadrao();
  const figura = [{ texto: '', tipo: 'IMAGE' }];
  const base = {
    soCortesia: cortesia.soCortesia(figura, null),
    ultimaEhSoReacao: cortesia.ultimaEhSoReacao(figura),
    temEtiquetaDeCidade: true,
    podeMandarMomento: true,
    podePedirDados: true,
    veioDeAnuncio: false,
    textos: [''],
    ultimoTexto: '',
  };

  const comoEra = arv.decidir({ ...base, jaRespondemosAntes: false }, fluxo, {});
  check(comoEra?.resposta === 'boas-vindas', 'era isto o que ela recebia: as boas-vindas do gabinete');

  const agora = arv.decidir({ ...base, jaRespondemosAntes: true }, fluxo, {});
  check(agora?.resposta !== 'boas-vindas', 'reconhecida como retorno, NAO recebe as boas-vindas de novo');
  check(agora?.tecla === '5', `e recebe a mensagem do momento, que foi o que ele pediu (tecla ${agora?.tecla})`);
}

{
  grupo('quem chega pelo anuncio recebe o modelo E o pedido de dados (05/09/2026)');

  /**
   * A outra ponta do mesmo sinal, no mesmo dia. Print da NEIVA: ela chegou pelo anuncio do
   * Facebook (campanha CAPITAO MARTIM), escreveu so o texto do proprio anuncio, **nao tem etiqueta
   * de cidade** -- e recebeu o modelo + agradecimento, sem o pedido de nome e cidade. Ele:
   * *"comecou a mandar agradecimento em vez de pedir os dados; segundo caso ja, e claramente e
   * pessoa nova que chegou por anuncio"*.
   *
   * A causa foi minha, horas antes: eu havia posto a **Data de conclusao do contato** dentro de
   * `jaRespondemosAntes`, dizendo que falso positivo era impossivel. E o contrario -- a data prova
   * que ja CONCLUIMOS um atendimento, nao que ja ENTREGAMOS nada, e esta rodada conclui em silencio
   * o tempo todo. Ela saiu; o sinal de primeira mao passou a ser o botao "Ver conversa anterior",
   * que ele apontou.
   *
   * Aqui fica travado o que o QUADRO faz com o sinal: e a diferenca entre a tecla `a` (recibo mais
   * cadastro) e a tecla 1 (so o recibo).
   */
  const fluxo = arv.fluxoPadrao();
  const base = {
    veioDeAnuncio: true,
    temEtiquetaDeCidade: false,
    jaPediramDados: false,
    jaDeuNomeECidade: false,
    podePedirDados: true,
    podeEnviar: true,
    textos: ['Ola! Eu estou do lado da seguranca e apoio o Capitao Martim'],
    ultimoTexto: 'Ola! Eu estou do lado da seguranca e apoio o Capitao Martim',
  };

  const nova = arv.decidir({ ...base, jaRespondemosAntes: false }, fluxo, {});
  check(nova?.tecla === 'a', `pessoa nova do anuncio: modelo + pedido de dados (tecla ${nova?.tecla})`);

  const retorno = arv.decidir({ ...base, jaRespondemosAntes: true }, fluxo, {});
  check(retorno?.tecla === '1', `quem ja veio antes recebe so o modelo (tecla ${retorno?.tecla}) -- era o que ela recebia`);
}

{
  grupo('conversa longa nao e decidida por "sem interesse" (05/09/2026)');

  /**
   * Print dele: um contato que chegou pelo anuncio, escreveu 927 caracteres de analise politica e
   * foi etiquetado como SEM INTERESSE. *"Duas conversas longas foram reconhecidas como sem
   * interesse; for assim, eu que analiso ou a IA."*
   *
   * Recusa de verdade e CURTA -- "nao quero receber", "me tira da lista". Quem escreve nove linhas
   * esta conversando, mesmo quando o assunto e raivoso, e e ai que o detector erra: esta base e de
   * apoiadores que falam mal do adversario.
   *
   * A excecao esta na CONDICAO e nao na ordem do quadro, porque `sem-interesse` e PROTECAO do
   * codigo -- decide mesmo nos quadros que ele ja exportou, onde caixa nova nunca chega. Por isso o
   * teste confere os dois caminhos: com a caixa no quadro, e sem ela.
   */
  const fluxo = arv.fluxoPadrao();
  const base = {
    semInteresse: { motivo: 'xingou' },
    textos: ['x'],
    ultimoTexto: 'x',
    podeMandarMomento: true,
    podePedirDados: true,
    podeEnviar: true,
  };

  const curta = arv.decidir({ ...base }, fluxo, {});
  check(curta?.tecla === 's', `a recusa curta continua sendo etiquetada e concluida (tecla ${curta?.tecla})`);

  const longa = arv.decidir({ ...base, pedeRespostaPessoal: { motivo: 'escreveu 927 caracteres' } }, fluxo, {});
  check(longa?.tecla === '6', `em conversa longa quem decide e ele ou a IA (tecla ${longa?.tecla})`);

  // E a PROTECAO do codigo, que vale nos quadros dele que nao tem a caixa.
  const semACaixa = [{ ...arv.noVazio('so isto'), condicao: { sinal: '', negar: false, palavras: ['zzz'], onde: 'ultima' }, acao: { tecla: '3', resposta: null } }];
  const prot = arv.decidir({ ...base, pedeRespostaPessoal: { motivo: 'escreveu 927 caracteres' } }, semACaixa, {});
  check(prot?.tecla !== 's', 'a protecao do codigo tambem nao marca sem interesse em conversa longa');
}

{
  grupo('mal-estar nao e ignorado nem concluido (05/09/2026)');

  /**
   * Print da Elenir: chegou pelo anuncio, disse que esta com infeccao e febre e que falaria assim
   * que fosse possivel -- e a rodada mandou o agradecimento pelo apoio e CONCLUIU. Medido antes de
   * consertar: tecla `i`.
   *
   * O desfecho certo e a tecla 6. Nao existe resposta pronta para isto, e escrever uma seria pior:
   * o que a pessoa espera e alguem, nao um texto.
   */
  const fluxo = arv.fluxoPadrao();
  const base = {
    veioDeAnuncio: true,
    temEtiquetaDeCidade: true,
    jaRespondemosAntes: true,
    podeEnviar: true,
    podeMandarMomento: true,
    textos: ['x'],
    ultimoTexto: 'x',
  };

  const doente = arv.decidir({ ...base, naoPodeFalarAgora: { motivo: 'esta passando mal' } }, fluxo, {});
  check(doente?.tecla === '6', `quem contou que esta passando mal fica com voce (tecla ${doente?.tecla})`);

  // O lado SEM etiqueta de cidade tem que decidir igual -- protecao que vive num lado so e metade.
  const semCidade = arv.decidir({ ...base, temEtiquetaDeCidade: false, naoPodeFalarAgora: { motivo: 'esta passando mal' } }, fluxo, {});
  check(semCidade?.tecla === '6', `e do outro lado da bifurcacao tambem (tecla ${semCidade?.tecla})`);

  // E na CHEGADA, que e onde a Elenir estava.
  const chegada = arv.decidir({ ...base, jaRespondemosAntes: false, temEtiquetaDeCidade: false, naoPodeFalarAgora: { motivo: 'esta passando mal' } }, fluxo, {});
  check(chegada?.tecla === '6', `e na chegada pelo anuncio (tecla ${chegada?.tecla})`);
}

{
  grupo('rajada de cliques: mensagem do momento, nao o modelo (05/09/2026)');

  /**
   * Print da Irene: tres cliques em anuncios do Instagram e a caixa ofereceu a tecla 1 (o modelo
   * "Campanha Seguranca"). Ele: *"rajada de entrada em anuncio, mensagem do momento e concluir"*.
   *
   * A caixa precisa vencer as DUAS portas do modelo -- o grupo do anuncio reconhecido e
   * `conteudo-pedido` -- e tambem o recibo da chegada (`anuncio-modelo-e-dados`).
   */
  const fluxo = arv.fluxoPadrao();
  const base = {
    veioDeAnuncio: true,
    anuncioReconhecido: true,
    podeEnviar: true,
    podePedirDados: true,
    podeMandarMomento: true,
    rajadaDeAnuncios: { motivo: 'clicou em 3 anuncios seguidos', quantos: 3 },
    textos: ['x'],
    ultimoTexto: 'x',
  };

  const chegada = arv.decidir({ ...base, jaRespondemosAntes: false }, fluxo, {});
  check(chegada?.tecla === '5', `na chegada, mensagem do momento em vez do recibo (tecla ${chegada?.tecla})`);

  const volta = arv.decidir({ ...base, jaRespondemosAntes: true, temEtiquetaDeCidade: true }, fluxo, {});
  check(volta?.tecla === '5', `e na volta tambem, vencendo o modelo do anuncio (tecla ${volta?.tecla})`);

  const semCidade = arv.decidir({ ...base, jaRespondemosAntes: true, temEtiquetaDeCidade: false }, fluxo, {});
  check(semCidade?.tecla === '5', `nos dois lados da bifurcacao (tecla ${semCidade?.tecla})`);

  // Ja tendo recebido a do momento, conclui -- o segundo desfecho que ele descreveu.
  const jaSaiu = arv.decidir({ ...base, jaRespondemosAntes: true, temEtiquetaDeCidade: true, momentoJaEnviado: true }, fluxo, {});
  check(jaSaiu?.tecla === '3', `com a do momento ja enviada, conclui (tecla ${jaSaiu?.tecla})`);

  // E um clique so continua recebendo o recibo: a regra nao pode comer a chegada normal.
  const umClique = arv.decidir({ ...base, jaRespondemosAntes: false, rajadaDeAnuncios: null }, fluxo, {});
  check(umClique?.tecla === 'a', `um clique so continua com o recibo + pedido de dados (tecla ${umClique?.tecla})`);
}

{
  grupo('o arquivo do fluxo diz de qual VERSAO ele veio (05/09/2026)');

  /**
   * Pedido dele: *"o fluxo atualmente nao fala qual versao ele esta utilizando"*.
   *
   * A pergunta e a que mais custa neste projeto: o quadro e uma COPIA do padrao, entao caixa nova
   * do codigo so decide depois que ele importa -- e o quadro dele passou o dia 05/09 no arranjo da
   * 2.41.0 enquanto o padrao andava ate a 2.55.0.
   *
   * A versao ja existia, mas **so dentro do `nome`** ("fluxo padrao 2.54.0"), que e texto livre
   * que ele pode reescrever. Carimbo que some quando alguem renomeia nao e carimbo.
   */
  const arvore = arv.arrumar(arv.fluxoPadrao());
  const arquivo = arv.paraArquivo({ arvore, teclas: {} }, 'fluxo padrao 9.9.9', '9.9.9');

  check(arquivo.extensao === '9.9.9', 'a versao da extensao vai em campo proprio');
  check(arquivo.versao === 1, 'e nao se confunde com a versao do FORMATO, que continua 1');

  const volta = arv.deArquivo(JSON.stringify(arquivo));
  check(volta.ok && volta.extensao === '9.9.9', 'e volta na importacao');

  /**
   * **Arquivo gerado antes disto existir volta com o campo VAZIO**, e quem chama diz "versao
   * desconhecida". Preencher com a versao de agora carimbaria como novo um quadro velho -- que e
   * exatamente a confusao que este campo existe para desfazer.
   */
  const semCarimbo = { ...arquivo };
  delete semCarimbo.extensao;
  const antigo = arv.deArquivo(JSON.stringify(semCarimbo));
  check(antigo.ok, 'arquivo antigo continua importando');
  check(antigo.extensao === '', 'e sem carimbo o campo fica vazio, nunca inventado');

  // Sem quem chame passar nada, o campo fica vazio -- este modulo e puro e nao le o manifesto.
  check(arv.paraArquivo({ arvore, teclas: {} }, 'x').extensao === '', 'sem a versao, o campo sai vazio');
}

{
  grupo('a negativa sai uma vez, e depois o caso e seu (06/09/2026)');

  /**
   * Print da Cleonice: ela ja tinha recebido a negativa de ajuda financeira, mandou um audio longo
   * contando da mae, do cartorio e do dinheiro emprestado -- e recebeu a MESMA negativa de novo.
   * *"mandou mensagem sobre pedido financeiro novamente pra mesma pessoa, so deve ser mandado uma
   * vez, e o contexto tambem pedia resposta minha ou de IA por ser conversa extensa"*.
   *
   * O detector nao estava errado: ele le a RAJADA, ela pediu de novo, o sinal ficou verdadeiro de
   * novo. O que faltava e que **dizer "nao podemos" duas vezes nao e responder, e repetir**.
   *
   * A trava mora no painel (`negativaJaSaiu` zera o sinal quando o texto ja esta na conversa), e o
   * que este teste guarda e o DESFECHO: com o sinal zerado, o caso desce para quem precisa de
   * gente -- que e a outra metade do que ele pediu.
   */
  const fluxo = arv.fluxoPadrao();
  const audio = [{
    texto: 'Ai, vai no CRAS. CRAS e pra vadio. As fraldas da minha mae, eu tenho que ir la no cartorio ainda registrar. ' +
      'Gente, a pessoa, o cidadao nao tem direito a nada. Eu falei aquilo, me desculpe de pedir. Mas hoje, se eu, o meu ' +
      'marido pedir mil reais emprestado, nos vamos pagar tres mil, quatro mil. E horrivel.',
    tipo: 'AUDIO',
    transcrito: true,
  }];
  const base = {
    pedeRespostaPessoal: cortesia.conversaPedeRespostaPessoal(audio, null, []),
    jaRespondemosAntes: true,
    temEtiquetaDeCidade: true,
    podeMandarMomento: true,
    podePedirDados: true,
    textos: audio.map((m) => m.texto),
    ultimoTexto: audio[0].texto,
  };

  const pedeDinheiro = cortesia.pedeAjudaFinanceira(audio, null);
  check(!!pedeDinheiro, 'o detector reconhece o pedido de dinheiro no audio');
  check(!!base.pedeRespostaPessoal, 'e reconhece que e conversa longa');

  const primeira = arv.decidir({ ...base, pedeAjudaFinanceira: pedeDinheiro }, fluxo, {});
  check(primeira?.resposta === 'pedido-ajuda', 'na PRIMEIRA vez, a negativa sai');

  const segunda = arv.decidir({ ...base, pedeAjudaFinanceira: null }, fluxo, {});
  check(segunda?.tecla === '6', `ja tendo negado, o caso vai para voce ou para a IA (tecla ${segunda?.tecla})`);
  check(segunda?.resposta !== 'pedido-ajuda', 'e a negativa NAO sai de novo');
}

{
  grupo('nao se conclui com pergunta em aberto, nem agradecendo (06/09/2026)');

  /**
   * Print da Mari: ela respondeu ao formulario por audio -- *"Boa tarde, tudo bem com voce? Sou de
   * Caxias do Sul."* -- e recebeu *"Obrigado de coracao pelo apoio e pela confianca"*, com a
   * conversa fechada em cima do *"tudo bem com voce?"*. Ele: *"mensagem fora de contexto, IA
   * deveria ter assumido aqui"*.
   *
   * Duas coisas estavam erradas, e a regra que faltava e dele, de 03/09: **nunca concluir com
   * pergunta em aberto**. `ja-respondemos-antes` ganhou a guarda naquele dia; `respondeu-os-dados`
   * nasceu em 02/09 e ficou sem — e o sintoma e invisivel, porque a resposta sai educada e a
   * pergunta dela morre junto com o atendimento.
   *
   * (A segunda: a tecla `i` mandava o texto do APOIO para quem so deu a cidade. Isso e do painel,
   * que nenhuma suite importa.)
   */
  const fluxo = arv.fluxoPadrao();
  const audio = [{ texto: 'Boa tarde, tudo bem com voce? Sou de Caxias do Sul.', tipo: 'AUDIO', transcrito: true }];
  const base = {
    respondeuOsDados: true,
    jaPediramDados: true,
    jaRespondemosAntes: true,
    podeMandarMomento: true,
    podePedirDados: true,
    textos: audio.map((m) => m.texto),
    ultimoTexto: audio[0].texto,
  };

  check(cortesia.perguntaPendente(audio, null), 'o "tudo bem com voce?" conta como pergunta pendente');

  const comPergunta = arv.decidir({ ...base, perguntaPendente: true }, fluxo, {});
  check(comPergunta?.tecla === '6', `com pergunta em aberto, o caso vai para voce ou para a IA (tecla ${comPergunta?.tecla})`);

  const semPergunta = arv.decidir({ ...base, perguntaPendente: false }, fluxo, {});
  check(semPergunta?.tecla === 'i', 'sem pergunta, continua agradecendo e encerrando');
  check(semPergunta?.id?.includes('respondeu-os-dados'), 'e continua sendo a caixa de quem respondeu os dados');
}

{
  grupo('a perda de contexto NAO cai para quem envia (06/09/2026)');

  /**
   * Print da Noeli: ela escreveu *"Eu ja estou com voces.....bom dia"* no dia 05, e no dia 06
   * recebeu **o modelo da campanha**. Ele: *"ignorou a regra da perda de contexto e mandou modelo"*.
   *
   * A regra nao foi ignorada — ela nao CASOU. As duas guardas do momento moravam na condicao, e o
   * comentario antigo dizia com todas as letras que sem elas *"o quadro decide como antes"*.
   * Decidir como antes, ali, e mandar o modelo: exatamente o que a caixa existe para impedir.
   *
   * Hoje a guarda decide o DESFECHO (tecla 5 ou tecla 3), que e o desenho que `ultima-e-so-reacao`
   * sempre teve. Este teste guarda os TRES casos, porque foi o do meio que apareceu em producao.
   */
  const fluxo = arv.fluxoPadrao();
  const base = {
    deOutroDia: true,
    jaRespondemosAntes: true,
    temEtiquetaDeCidade: true,
    podeEnviar: true,
    podePedirDados: true,
    textos: ['Eu ja estou com voces.....bom dia'],
    ultimoTexto: 'Eu ja estou com voces.....bom dia',
  };

  const comMomento = arv.decidir({ ...base, podeMandarMomento: true, momentoJaEnviado: false }, fluxo, {});
  check(comMomento?.tecla === '5', 'com momento disponivel, manda a mensagem do momento');

  const jaEnviado = arv.decidir({ ...base, podeMandarMomento: true, momentoJaEnviado: true }, fluxo, {});
  check(jaEnviado?.tecla === '3', `momento ja enviado: conclui, e NAO manda o modelo (tecla ${jaEnviado?.tecla})`);
  check(jaEnviado?.id?.includes('contexto-de-outro-dia'), 'e quem decide continua sendo a caixa do tempo');

  const semMomento = arv.decidir({ ...base, podeMandarMomento: false, momentoJaEnviado: false }, fluxo, {});
  check(semMomento?.tecla === '3', 'sem momento configurado: conclui, e NAO manda o modelo');
}

{
  grupo('quem RETORNA: o tempo vence o modelo do anuncio (06/09/2026)');

  /**
   * Print da Leonilda: ela clicou no anuncio em 04/09, **nos respondemos** em 05/09 as 11:03, ela
   * escreveu *"Bom dia capitao Martins"* e *"Pode contar com meu voto"* as 11:05 e 11:07 — e no
   * dia 06 recebeu **o modelo**. Ele: *"ela tem conversa anterior, entao recebe mensagem do
   * momento; ela respondeu e retornou, recebeu modelo do contexto perdido"*.
   *
   * A caixa do tempo CASAVA e perdia para o grupo do anuncio reconhecido, que estava logo acima.
   * O argumento antigo era do RECIBO (*"um clique de ontem continua sendo um pedido"*) e nao vale
   * aqui: neste bloco ja a atendemos, o clique dela ja foi respondido, e ela respondeu de volta.
   *
   * As tres ultimas assercoes sao os falsos positivos, que e onde mora o risco desta mudanca.
   */
  const arvore = arv.fluxoPadrao();
  const leonilda = {
    veioDeAnuncio: true,
    anuncioReconhecido: true,
    jaRespondemosAntes: true,
    temEtiquetaDeCidade: true,
    soExpressaApoio: true,
    podeEnviar: true,
    podePedirDados: true,
    deOutroDia: true,
    textos: ['Bom dia capitao Martins', 'Pode contar com meu voto para deputado estadual'],
    ultimoTexto: 'Pode contar com meu voto para deputado estadual',
  };

  const comMomento = arv.decidir({ ...leonilda, podeMandarMomento: true, momentoJaEnviado: false }, arvore, {});
  check(comMomento?.tecla === '5', `retorno de outro dia: mensagem do momento, e nao o modelo (tecla ${comMomento?.tecla})`);
  check(comMomento?.id?.includes('contexto-de-outro-dia'), 'e quem decide e a caixa do tempo, nao o grupo do anuncio');

  const semMomento = arv.decidir({ ...leonilda, podeMandarMomento: false, momentoJaEnviado: false }, arvore, {});
  check(semMomento?.tecla === '3', 'sem momento configurado: conclui, e continua NAO mandando o modelo');

  // FALSO POSITIVO 1 — a Rosa (03/09): ela voltou clicando num anuncio HOJE, e o modelo daquele
  // anuncio e a resposta. O tempo nao alcanca quem escreveu hoje.
  const hoje = arv.decidir({ ...leonilda, deOutroDia: false, podeMandarMomento: true, momentoJaEnviado: false }, arvore, {});
  check(hoje?.tecla === '1', `clicou HOJE: o modelo do anuncio sai igual (tecla ${hoje?.tecla})`);

  // FALSO POSITIVO 2 — o material (05/09): *"o modelo de material e uma excecao, ele sempre tem
  // que ser mandado quando requisitado"*. A guarda esta na CONDICAO da regra, entao nao depende
  // desta posicao.
  const material = arv.decidir({ ...leonilda, materialPendente: true, podeMandarMomento: true, momentoJaEnviado: false }, arvore, {});
  check(material?.tecla === '1', `material pedido e nao entregue: o modelo vence o dia (tecla ${material?.tecla})`);

  // FALSO POSITIVO 3 — a CHEGADA (04/09): quem nunca recebeu nada tem direito ao recibo mesmo que
  // a rodada so a alcance no dia seguinte. La o tempo continua ABAIXO do recibo.
  const chegada = arv.decidir(
    { ...leonilda, jaRespondemosAntes: false, temEtiquetaDeCidade: false, podeMandarMomento: true, momentoJaEnviado: false },
    arvore, {});
  check(chegada?.tecla === '1' || chegada?.tecla === 'a', `pessoa NOVA de ontem: recebe o recibo (tecla ${chegada?.tecla})`);
}

fim();
