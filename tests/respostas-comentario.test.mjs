/**
 * **AS RESPOSTAS RAPIDAS DO COMENTARIO, COM VARIACOES QUE REVEZAM** — pedido dele em 20/10/2026.
 *
 * Tres coisas sao provadas, e a terceira e a que importa mais:
 *
 *  1. a mecanica (guardar, editar, apagar, peneirar o que vem do storage);
 *  2. **o rodizio**: *"ao apertar o numero 1 ira seguir na sequencia das variacoes (...) e nao se
 *     repetir ate ter ido as 10"* — a volta fecha antes de repetir, e o ponteiro so anda quando
 *     quem chama manda;
 *  3. **que os textos DE FABRICA passam pelas travas do canal publico** — eles saem em nome dele,
 *     numa pagina onde todo mundo ve, e foram escritos por mim. Qualquer reescrita futura que
 *     ponha um pedido de cadastro ou uma promessa de entrega la dentro cai aqui.
 *
 * Rode: node tests/respostas-comentario.test.mjs
 */
import { check, grupo, fim } from './_harness.mjs';
import {
  RESPOSTAS_DE_FABRICA,
  MAX_RESPOSTAS,
  MAX_VARIACOES,
  MAX_NOME,
  nomeDoTexto,
  sanitizar,
  guardar,
  renomear,
  editar,
  apagar,
  variacaoDaVez,
  proximoPonteiro,
  paraTexto,
  deTexto,
} from '../src/lib/respostas-comentario.js';
import { ehPedidoDeDados } from '../src/lib/templates.js';
import { revisarRascunho } from '../src/lib/ia.js';
import * as perfis from '../src/lib/perfis.js';
import * as store from '../src/lib/store.js';

const AGORA = new Date('2026-10-20T14:00:00-03:00');

grupo('os textos de fabrica passam pelas travas do canal PUBLICO');
{
  check(RESPOSTAS_DE_FABRICA.length > 0, 'ha respostas de fabrica');

  let total = 0;
  for (const r of RESPOSTAS_DE_FABRICA) {
    check(r.variacoes.length >= 1 && r.variacoes.length <= MAX_VARIACOES, `${r.id}: 1..${MAX_VARIACOES} variacoes`);
    check(new Set(r.variacoes).size === r.variacoes.length, `${r.id}: nenhuma variacao repetida`);
    check(!!r.nome && r.nome.length <= MAX_NOME, `${r.id}: rotulo curto para o botao`);

    for (const t of r.variacoes) {
      total++;
      // **O formulario e proibido aqui**: pedir nome e cidade num comentario e pedir dado de
      // eleitor onde todo mundo ve.
      check(!ehPedidoDeDados(t), `${r.id}: nao pede o cadastro`);
      // Variavel nao resolve no Facebook — nao ha contato carregado. Sairia `{{saudacao}}` cru.
      check(!/\{\{[a-z_]+\}\}/i.test(t), `${r.id}: sem variavel de template`);
      /**
       * **As mesmas travas da IA**, de proposito: promessa de entregar, afirmar que ja fizemos,
       * afirmar que temos e dizer que a eleicao acabou sao os mesmos riscos, venha o texto do
       * modelo ou da minha mao.
       */
      const revisto = revisarRascunho(t, AGORA, {});
      check(revisto.avisos.length === 0, `${r.id}: zero avisos (${revisto.avisos.join(' | ') || t.slice(0, 30)})`);
      // Uma ou duas frases: comentario longo nao e lido e parece robo.
      check(t.length <= 140, `${r.id}: curta o bastante (${t.length})`);
    }
  }
  check(total >= 20, `ha variacao de verdade para revezar (${total} textos)`);

  const ids = RESPOSTAS_DE_FABRICA.map((r) => r.id);
  check(new Set(ids).size === ids.length, 'nenhum id repetido');
}

grupo('nenhuma de fabrica cita candidato pelo NOME');
{
  /**
   * E o que permite elas servirem de ponto de partida para QUALQUER candidato — `facebook-main`
   * as passa como `vazio` do `perfis.ler`. Com um nome dentro, o candidato novo abriria o painel
   * com o texto do outro.
   */
  const NOMES = ['martim', 'pedri', 'flavio', 'zucco', 'sanderson', 'hattem', 'bolsonaro'];
  for (const r of RESPOSTAS_DE_FABRICA) {
    const onde = `${r.nome} ${r.variacoes.join(' ')}`.toLowerCase();
    const achou = NOMES.filter((n) => onde.includes(n));
    check(achou.length === 0, `${r.id}: sem nome de candidato (${achou.join(', ') || 'ok'})`);
  }
}

grupo('o RODIZIO: a volta fecha antes de repetir');
{
  const apoio = RESPOSTAS_DE_FABRICA.find((r) => r.id === 'apoio');
  check(apoio.variacoes.length === MAX_VARIACOES, 'o "Apoio" tem as dez — e o que mais chega');

  let indices = {};
  const saiu = [];
  for (let i = 0; i < apoio.variacoes.length; i++) {
    saiu.push(variacaoDaVez(apoio, indices).texto);
    indices = proximoPonteiro(apoio, indices);
  }
  check(new Set(saiu).size === apoio.variacoes.length, 'a volta inteira sem repetir nenhuma');

  // E so entao volta ao comeco — e o "nao se repetir ate ter ido as 10".
  check(variacaoDaVez(apoio, indices).texto === apoio.variacoes[0], 'fechada a volta, recomeca da primeira');

  // A posicao e exibida 1-based, que e como ela aparece na tela.
  check(variacaoDaVez(apoio, {}).posicao === 1, 'a primeira e a 1, nao a 0');
  check(variacaoDaVez(apoio, {}).total === MAX_VARIACOES, 'o total vem junto, para a tela dizer "x de y"');
}

grupo('o ponteiro NAO anda sozinho — so quem chama o avanca');
{
  /**
   * A disciplina de `templates.avancarVariante`: ler nao avanca. O painel so grava o ponteiro
   * depois que o texto ENTROU na caixa; avancar numa falha faria a volta de dez virar nove.
   */
  const r = RESPOSTAS_DE_FABRICA.find((x) => x.id === 'apoio');
  const indices = {};
  const a = variacaoDaVez(r, indices).texto;
  const b = variacaoDaVez(r, indices).texto;
  check(a === b, 'duas leituras seguidas dao a MESMA variacao');
  check(Object.keys(indices).length === 0, 'e ler nao escreve no mapa de ponteiros');

  // Uma variacao so: nao ha o que revezar, e o mapa nao cresce a toa.
  const uma = { id: 'x', nome: 'X', variacoes: ['so esta'] };
  check(proximoPonteiro(uma, {}) && Object.keys(proximoPonteiro(uma, {})).length === 0, 'resposta de uma variacao nao cria ponteiro');
  check(variacaoDaVez(uma, {}).texto === 'so esta', 'e ela sai sempre');
}

grupo('ponteiro maior que a lista nao quebra');
{
  /**
   * Acontece de verdade: ele usa a oitava variacao e depois EDITA a lista deixando tres. O
   * ponteiro gravado continua em 8.
   */
  const r = { id: 'y', nome: 'Y', variacoes: ['a', 'b', 'c'] };
  const v = variacaoDaVez(r, { 'fb:y': 8 });
  check(['a', 'b', 'c'].includes(v.texto), 'o indice velho e modulado pela lista de agora');
  check(v.posicao >= 1 && v.posicao <= 3, 'e a posicao exibida fica dentro da lista');
}

grupo('a forma ANTIGA (texto solto) continua sendo lida');
{
  /**
   * Ele guardou respostas de manha, antes de as variacoes existirem. Perder aquilo seria apagar
   * texto dele sem avisar.
   */
  const antiga = [{ id: 'v', nome: 'Velha', texto: 'Texto de antes' }];
  const lido = sanitizar(antiga);
  check(lido.length === 1, 'a resposta antiga sobrevive');
  check(lido[0].variacoes.length === 1 && lido[0].variacoes[0] === 'Texto de antes', 'o texto vira a primeira variacao');
}

grupo('o que vem do armazenamento e entrada NAO confiavel');
{
  const sujo = [
    { id: 'a', nome: 'Boa', variacoes: ['Obrigado!', 'Valeu!'] },
    { id: 'a', nome: 'Repetido', variacoes: ['Outro'] }, // id repetido
    { id: 'b', nome: 'Vazio', variacoes: ['   ', ''] }, // nenhuma variacao util: descartada
    { nome: 'Sem id', variacoes: ['Tem texto'] },
    { id: 'c', variacoes: ['Sem nome nenhum aqui'] },
    { id: 'd', variacoes: ['igual', 'igual', 'outra'] }, // repetida dentro da mesma
    'nao e objeto',
    null,
  ];
  const limpo = sanitizar(sujo);

  check(limpo.length === 5, 'descarta o que nao tem variacao e o que nao e objeto');
  check(new Set(limpo.map((r) => r.id)).size === 5, 'id repetido ganha id novo');
  check(limpo.every((r) => !!r.nome), 'item sem nome ganha rotulo da primeira variacao');
  check(limpo.find((r) => r.id === 'd').variacoes.length === 2, 'variacao repetida dentro da mesma resposta some');
  check(sanitizar(null).length === 0 && sanitizar('x').length === 0, 'lista invalida vira vazia');

  const demais = Array.from({ length: MAX_RESPOSTAS + 5 }, (_, i) => ({ id: 'x' + i, variacoes: ['t' + i] }));
  check(sanitizar(demais).length === MAX_RESPOSTAS, `o teto de ${MAX_RESPOSTAS} respostas vale na leitura`);

  const muitas = [{ id: 'm', variacoes: Array.from({ length: MAX_VARIACOES + 6 }, (_, i) => 'v' + i) }];
  check(sanitizar(muitas)[0].variacoes.length === MAX_VARIACOES, `o teto de ${MAX_VARIACOES} variacoes tambem`);
}

grupo('guardar: do campo para a tira');
{
  const um = guardar([], '  Obrigado pelo apoio!  ');
  check(um.lista.length === 1, 'guarda o texto do campo');
  check(um.lista[0].variacoes[0] === 'Obrigado pelo apoio!', 'o texto vai aparado, como primeira variacao');

  const dois = guardar(um.lista, 'Obrigado pelo apoio!');
  check(dois.jaExistia === um.lista[0].nome, 'texto igual nao vira segunda entrada — e diz de QUEM ele ja e');
  check(dois.lista.length === 1, 'e a lista nao cresce');

  /**
   * A busca varre TODAS as variacoes: guardar de novo um texto que ja e a terceira do "Apoio"
   * criaria um botao duplicado dizendo a mesma coisa.
   */
  const comVarias = [{ id: 'k', nome: 'Apoio', variacoes: ['um', 'dois', 'tres'] }];
  check(guardar(comVarias, 'tres').jaExistia === 'Apoio', 'acha o texto no meio das variacoes de outra resposta');

  check(guardar(um.lista, '   ').lista.length === 1, 'campo vazio nao guarda nada');

  const cheia = Array.from({ length: MAX_RESPOSTAS }, (_, i) => ({ id: 'x' + i, variacoes: ['t' + i] }));
  const estourou = guardar(cheia, 'mais uma');
  check(estourou.cheia === true, 'a tira cheia AVISA em vez de engolir');
  check(estourou.lista.length === MAX_RESPOSTAS, 'e nao passa do teto');
}

grupo('o editor: uma variacao por linha, nos dois sentidos');
{
  const r = { id: 'e', nome: 'E', variacoes: ['primeira', 'segunda'] };
  check(paraTexto(r) === 'primeira\nsegunda', 'a lista vira texto, uma por linha');

  check(deTexto('a\nb\nc').length === 3, 'e o texto volta a virar lista');
  check(deTexto('a\n\n  \nb').length === 2, 'linha vazia some');
  check(deTexto('a\na\nb').length === 2, 'linha repetida some');
  check(deTexto(Array.from({ length: 30 }, (_, i) => 'v' + i).join('\n')).length === MAX_VARIACOES, 'o teto corta');
  check(deTexto('').length === 0, 'texto vazio vira lista vazia');
}

grupo('editar grava nome e variacoes; esvaziar APAGA');
{
  const lista = [{ id: 'z', nome: 'Antigo', variacoes: ['um', 'dois'] }];

  const r = editar(lista, 'z', '  Novo nome  ', ['a', 'b', 'c']);
  check(r.lista[0].nome === 'Novo nome', 'o nome entra aparado');
  check(r.lista[0].variacoes.join(',') === 'a,b,c', 'as variacoes sao substituidas');

  const semNome = editar(lista, 'z', '   ', ['so uma']);
  check(semNome.lista[0].nome === 'so uma', 'nome em branco volta a sair da primeira variacao');

  /**
   * **Esvaziar o editor APAGA**, e e o gesto natural de quem quer tirar um botao. Sem isto ele
   * ficaria com um botao que nao escreve nada.
   */
  const apagou = editar(lista, 'z', 'Nome', []);
  check(apagou.lista.length === 0, 'sem nenhuma variacao, a resposta sai');
  check(apagou.texto === 'um', 'e a primeira variacao volta para o campo');
}

grupo('apagar devolve o texto — e o desfazer barato');
{
  const lista = guardar(guardar([], 'Primeira').lista, 'Segunda').lista;
  const alvo = lista[1].id;

  const { lista: depois, texto } = apagar(lista, alvo);
  check(depois.length === 1, 'sai da tira');
  check(texto === 'Segunda', 'e o texto volta, para o painel por no campo');

  const voltou = guardar(depois, texto);
  check(voltou.lista.length === 2, 'guardar o texto devolvido desfaz o apagar');

  check(apagar(lista, 'nao-existe').texto === '', 'apagar o que nao existe nao devolve texto');
}

grupo('renomear muda o rotulo, nunca as variacoes');
{
  const lista = [{ id: 'n', nome: 'Velho', variacoes: ['um', 'dois'] }];
  const novo = renomear(lista, 'n', '  Apoio  ');
  check(novo[0].nome === 'Apoio', 'o nome novo entra aparado');
  check(novo[0].variacoes.join(',') === 'um,dois', 'as variacoes ficam intactas');
  check(renomear(lista, 'nao-existe', 'x')[0].nome === 'Velho', 'id desconhecido nao mexe em nada');
}

grupo('a cadeia com o armazenamento: chave conhecida, default e por candidato');
{
  /**
   * **`perfis.ler` LANCA para chave fora de `CHAVES_DO_PERFIL`** — e lista de permissao, e sem
   * esta assercao o painel so descobriria no primeiro clique, na aba dele.
   */
  let lancou = false;
  try {
    await perfis.ler('respostasComentario', '');
  } catch (_) {
    lancou = true;
  }
  check(!lancou, 'respostasComentario e chave por candidato reconhecida');

  const deFabrica = await store.get('respostasComentario');
  check(Array.isArray(deFabrica) && deFabrica.length === RESPOSTAS_DE_FABRICA.length, 'o default do store sao as de fabrica');

  /**
   * **O ponteiro vive em `varianteIndex`, que o `exportJson` descarta** — medicao desta maquina,
   * nao configuracao dele. Reusar a chave e o que mantem isso verdadeiro de graca.
   */
  const indices = await store.get('varianteIndex');
  check(indices && typeof indices === 'object', 'varianteIndex existe e e o mapa compartilhado');

  const outro = await perfis.ler('respostasComentario', 'outro-candidato', RESPOSTAS_DE_FABRICA);
  check(outro.length === RESPOSTAS_DE_FABRICA.length, 'candidato sem valor gravado cai nas de fabrica');

  await perfis.gravar('respostasComentario', 'outro-candidato', [{ id: 'z', nome: 'So dele', variacoes: ['Texto dele'] }]);
  const dele = await perfis.ler('respostasComentario', 'outro-candidato', RESPOSTAS_DE_FABRICA);
  check(dele.length === 1 && dele[0].variacoes[0] === 'Texto dele', 'o que ele guarda fica no candidato dele');

  const padraoAinda = await perfis.ler('respostasComentario', '', RESPOSTAS_DE_FABRICA);
  check(padraoAinda.length === RESPOSTAS_DE_FABRICA.length, 'e nao vaza para o candidato de fabrica');
}

fim();
