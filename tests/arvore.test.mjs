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
  check(tecla({ ...base, respondidoHoje: false }) === '5', 'primeira passada resolve a pendencia');
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
  check(repetida.quantasNoQuadro === 2, 'regra repetida conta as 2 vezes (os dois lados de cidade)');

  const descartada = cat.find((r) => r.id === 'nome-sem-sentido');
  check(descartada && descartada.quantasNoQuadro === 0, 'regra fora do quadro aparece na lista, zerada');

  // Apagar uma caixa devolve a regra a lista — e e isto que torna o apagar reversivel.
  const semDespedida = arv.apagar(q, 'r:ultima-e-despedida:sem-cidade');
  const depois = arv.catalogoDeRegras(semDespedida).find((r) => r.id === 'ultima-e-despedida');
  check(depois.quantasNoQuadro === 1, 'apagar uma caixa desconta a regra do catalogo');
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
  check(tecla({ ...inge, jaRespondemosAntes: true, jaPediramDados: true }) === null, 'quem JA recebeu o formulario nao recebe de novo');
  check(tecla({ ...inge, jaRespondemosAntes: true, pedidoHoje: true }) === null, 'nem quem recebeu o formulario hoje');

  // O ramo e ULTIMO RECURSO: nao rouba a vez de quem ja funcionava.
  check(tecla({ ...inge, jaRespondemosAntes: true, podeEnviar: true }) === '1', 'havendo modelo mapeado, o modelo vence o ramo novo');
  check(tecla({ ...inge, jaRespondemosAntes: true, ultimoTexto: 'bom dia', textos: [texto, 'bom dia'] }) === '5', 'pendencia na frente: "bom dia" ainda resolve primeiro');
  check(arv.decidir({ ...inge, jaRespondemosAntes: true, semInteresse: true }, q)?.tecla === 's', 'e a recusa continua vencendo tudo');

  /**
   * A condicao e `anuncioReconhecido`, nao `veioDeAnuncio`: a origem vem da plataforma e vale para
   * qualquer anuncio, e o sinal so e verdade para anuncio que ELE cadastrou. Assim o ramo nao muda
   * nada para quem chega por campanha nao mapeada.
   */
  check(tecla({ ...inge, jaRespondemosAntes: true, anuncioReconhecido: false }) === null, 'anuncio NAO reconhecido nao entra neste ramo');
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
  check(tecla({ ...chega, etiquetaQueDispensa: 'Sem Retorno' }) === '2', 'etiqueta que dispensa: pula (era regressao, o modelo vencia)');
  /**
   * **A ajuda financeira ESTAVA acima do modelo e saiu, por decisao dele** (02/09, no mesmo dia):
   * *"o modelo nao ira confirmar apoio ao pedido de ajuda ou confirmar que ira ajudar entao pode
   * ser respondido apos"*.
   *
   * Ele esta certo sobre o texto: o modelo e recibo de cadastro e nao promete coisa nenhuma, entao
   * manda-lo antes nao e promessa de beneficio (Lei 9.504/97), que era a minha objecao. A negativa
   * sai na passada seguinte, e continua sendo o `pedido-ajuda` — o que este teste trava e que ela
   * NAO se perde no caminho.
   */
  const remedio = { ultimoTexto: 'preciso de remedio', textos: [ad, 'preciso de remedio'] };
  check(tecla({ ...chega, ...remedio }) === 'a', 'quem pediu ajuda recebe primeiro o recibo do anuncio');
  check(arv.decidir({ ...chega, ...remedio, modeloJaNaConversa: true, jaPediramDados: true }, q)?.resposta === 'pedido-ajuda',
    'e a NEGATIVA sai na passada seguinte -- nao se perde');
  check(arv.decidir({ ...chega, ...remedio, modeloJaNaConversa: true, temEtiquetaDeCidade: true }, q)?.resposta === 'pedido-ajuda',
    'quem ja tinha cidade recebe a negativa logo depois do modelo');
  check(tecla({ ...chega, perguntaAberta: true }) === '6', 'pergunta de posicao: gente, nao modelo (print da Clair)');
  check(tecla({ ...chega, pedeAlgoIndefinido: true }) === '9', 'pediu algo sem dizer o que: pergunta (print da Mari)');

  /**
   * **As pendencias NEUTRAS, depois do modelo** — a ordem que ele pediu. Na 1a passada o modelo
   * ganha; resolvido ele, a pendencia decide.
   */
  const jaFoi = { modeloJaNaConversa: true, jaPediramDados: true };
  check(tecla({ ...chega, ultimoTexto: 'bom dia', textos: [ad, 'bom dia'] }) === 'a', 'na 1a passada o modelo + dados vence "bom dia"');
  check(tecla({ ...chega, ...jaFoi, ultimoTexto: 'bom dia', textos: [ad, 'bom dia'] }) === '5', 'resolvido o modelo, "bom dia" recebe a mensagem do momento');
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

  check(tecla({ ...base, temEtiquetaDeCidade: false }) === '8', 'sem cidade: agradece e conclui');

  /**
   * **Os dois lados da bifurcacao dao o mesmo.** Sem a caixa no lado "com cidade", a mesma pessoa
   * era agradecida ou concluida em silencio dependendo de a etiqueta ja ter sido aplicada -- e isso
   * e decidido pela ORDEM das coisas dentro da rodada, que ela nao ve. Regra que trata dois
   * contatos iguais de forma diferente por estado invisivel e o "alguns concluem e outros nao".
   */
  check(tecla({ ...base, temEtiquetaDeCidade: true }) === '8', 'com cidade: o mesmo agradecimento');

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
    check(tecla({ ...base, temEtiquetaDeCidade: comCidade, etiquetaQueDispensa: 'Sem Retorno' }) === '2', `a etiqueta que dispensa vence (${onde})`);
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

  // A mesma coisa com a outra protecao do projeto.
  check(acusa([R('etiqueta-dispensa-da-fila', [meu('manda', { tecla: '1' })])]).length === 1, 'vale para a etiqueta que dispensa tambem');

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

  const naChegada = chegada.filhos.map((n) => n.regra || n.rotulo);
  const PENDENCIAS = ['pediu ajuda financeira', 'ultima-e-so-reacao', 'ultima-pede-resposta-pessoal', 'ultima-e-despedida'];
  for (const p of PENDENCIAS) {
    check(!naChegada.includes(p), `"${p}" nao esta mais na chegada`);
  }
  check(!naChegada.some((x) => String(x).startsWith('só mandou bom dia')), '"so mandou bom dia" nao esta mais na chegada');

  // E continuam existindo na volta -- e por isso que remover da chegada nao perde nada.
  const naVolta = new Set(arv.todosOsNos(volta.filhos).map(({ no }) => no.regra || no.rotulo));
  for (const p of PENDENCIAS) check(naVolta.has(p), `"${p}" continua na volta`);

  /**
   * O que a chegada resolve e que a volta NAO resolve: as tres saidas do recibo. Sem as duas
   * ultimas, medido, o contato atravessa o quadro sem desfecho.
   */
  check(naChegada.includes('anuncio-modelo-e-dados'), 'o recibo + pedido de dados fica na chegada');
  check(naChegada.includes('conteudo-pedido'), 'o recibo sozinho (ela ja tem cidade) fica na chegada');
  check(naChegada.includes('nunca-pediram-dados'), 'o pedido de dados sozinho (sem modelo) fica na chegada');
  check(chegada.filhos.length === 7, 'e a chegada tem 7 caixas, nao 12');

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
  const bomDia = arv.decidir({ ...b, textos: [ad, 'bom dia'], ultimoTexto: 'bom dia' }, q);
  check(bomDia?.tecla === '5', 'quem chega e diz "bom dia" ainda recebe a mensagem do momento');
  const remedio = arv.decidir({ ...b, textos: [ad, 'preciso de remedio'], ultimoTexto: 'preciso de remedio' }, q);
  check(remedio?.resposta === 'pedido-ajuda', 'e quem pede remedio ainda recebe a negativa');
}


grupo('confirmou presenca e ja temos os dados: agradece (02/09/2026)');
{
  /**
   * Print do Deoclecio: contato com TODAS as etiquetas -- cidade, conteudo, engajado -- recebeu
   * "Que bom! Sera uma grande satisfacao contar com voce... Nome / Cidade" DUAS vezes. Relato dele:
   * *"repetindo resposta em pessoa com todas etiquetas, pediu dados, o caso certo seria so
   * agradecer a presenca no evento e concluir"*.
   *
   * Faltava a regra: `confirmaPresenca` so trocava o TEXTO da tecla 4, entao nao havia desfecho
   * para "confirmou e nao falta dado nenhum" -- o caso descia ate quem pede o cadastro, e pedia o
   * que ja estava no CRM.
   */
  const q = arv.arrumar(arv.fluxoPadrao());
  const deoclecio = {
    jaRespondemosAntes: true, temEtiquetaDeCidade: true, confirmouPresenca: true,
    jaPediramDados: true, pedidoHoje: true, podePedirDados: true,
    podeEnviar: true, enviadoHoje: false, modeloJaNaConversa: true,
    textos: ['Que bom!', 'link'], ultimoTexto: 'https://facebook.com/x',
  };
  const tecla = (c) => arv.decidir(c, q)?.tecla ?? null;

  check(tecla(deoclecio) === '8', 'agradece e conclui, em vez de pedir os dados de novo');
  check(tecla(deoclecio) !== '4', 'e NAO pede nome e cidade');

  /**
   * Sem etiqueta de cidade a regra nao casa, e e certo que nao case: la falta o cadastro, e o
   * pedido de dados (com o preambulo de evento) continua sendo o desfecho.
   */
  check(tecla({ ...deoclecio, temEtiquetaDeCidade: false, jaPediramDados: false, pedidoHoje: false }) === '4',
    'quem confirmou e NAO tem cidade continua recebendo o pedido');

  // As protecoes continuam ganhando.
  check(tecla({ ...deoclecio, semInteresse: true }) === 's', 'a recusa vence');
  check(tecla({ ...deoclecio, etiquetaQueDispensa: 'Sem Retorno' }) === '2', 'a etiqueta que dispensa vence');

  // E quem nao confirmou presenca nao e agradecido por isso.
  check(tecla({ ...deoclecio, confirmouPresenca: false }) !== '8', 'sem confirmacao, nao agradece a presenca');
}

fim();
