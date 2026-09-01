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

  const aninhada = arv.aninhar(base, 'b');
  check(aninhada.length === 2 && aninhada[0].filhos[0].id === 'b', 'aninhar poe o no dentro do irmao de cima');
  check(arv.aninhar(base, 'a').length === 3, 'sem irmao acima, aninhar nao inventa pai');

  const solta = arv.desaninhar(aninhada, 'b');
  check(solta.map((n) => n.id).join('') === 'abc', 'desaninhar devolve o no ao nivel do pai, logo abaixo');

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
  const quadro = arv.arvoreDoQuadro();
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
  const bomDia = arv.decidir({ jaRespondemosAntes: true, ultimoTexto: 'Bom dia!' }, quadro);
  check(bomDia?.tecla === '5', `saudacao escrita manda a mensagem do momento (${bomDia?.tecla})`);

  const financeiro = arv.decidir({ jaRespondemosAntes: true, ultimoTexto: 'preciso de ajuda financeira' }, quadro);
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
  check(arv.precisaArrumar(arv.arrumar(arv.arvoreDoQuadro())) === false, 'o preset do quadro arruma inteiro');
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
  check(arv.problemas(arvore).length === 0, `entregar para a IA conta como acao (${JSON.stringify(arv.problemas(arvore))})`);

  const semNada = [{ id: 'x', rotulo: 'vazio', condicao: { palavras: ['oi'] }, acao: {}, filhos: [] }];
  check(arv.problemas(semNada).some((p) => p.includes('vazio')), 'e acao vazia continua sendo acusada');
}

fim();
