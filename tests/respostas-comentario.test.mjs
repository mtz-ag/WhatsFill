/**
 * **AS RESPOSTAS RAPIDAS DO COMENTARIO** — pedido dele em 20/10/2026.
 *
 * Duas coisas sao provadas aqui, e a segunda e a que importa mais:
 *
 *  1. a mecanica (guardar, renomear, apagar, peneirar o que vem do storage);
 *  2. **que os textos DE FABRICA passam pelas travas do canal publico** — eles
 *     saem em nome dele, numa pagina onde todo mundo ve, e foram escritos por
 *     mim. Qualquer reescrita futura que ponha um pedido de cadastro ou uma
 *     promessa de entrega la dentro cai aqui.
 *
 * Rode: node tests/respostas-comentario.test.mjs
 */
import { check, grupo, fim } from './_harness.mjs';
import {
  RESPOSTAS_DE_FABRICA,
  MAX_RESPOSTAS,
  MAX_NOME,
  nomeDoTexto,
  sanitizar,
  guardar,
  renomear,
  apagar,
} from '../src/lib/respostas-comentario.js';
import { ehPedidoDeDados } from '../src/lib/templates.js';
import { revisarRascunho } from '../src/lib/ia.js';
import * as perfis from '../src/lib/perfis.js';
import * as store from '../src/lib/store.js';

const AGORA = new Date('2026-10-20T14:00:00-03:00');

grupo('os textos de fabrica passam pelas travas do canal PUBLICO');
{
  check(RESPOSTAS_DE_FABRICA.length > 0, 'ha respostas de fabrica');

  for (const r of RESPOSTAS_DE_FABRICA) {
    const t = r.texto;

    // **O formulario e proibido aqui**: pedir nome e cidade num comentario e pedir
    // dado de eleitor onde todo mundo ve.
    check(!ehPedidoDeDados(t), `${r.id}: nao pede o cadastro`);

    // Variavel nao resolve no Facebook — nao ha contato carregado. Sairia `{{saudacao}}` cru.
    check(!/\{\{[a-z_]+\}\}/i.test(t), `${r.id}: sem variavel de template`);

    /**
     * **As mesmas travas da IA**, e e de proposito: promessa de entregar, afirmar que ja fizemos,
     * afirmar que temos e dizer que a eleicao acabou sao os mesmos riscos, venha o texto do modelo
     * ou da minha mao.
     */
    const revisto = revisarRascunho(t, AGORA, {});
    check(revisto.avisos.length === 0, `${r.id}: zero avisos da revisao (${revisto.avisos.join(' | ')})`);

    // Uma ou duas frases: comentario longo nao e lido e parece robo.
    check(t.length <= 140, `${r.id}: curta o bastante para um comentario (${t.length})`);

    check(!!r.nome && r.nome.length <= MAX_NOME, `${r.id}: tem rotulo curto para o botao`);
  }

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
    // O ROTULO conta junto: ele aparece no botao, na tela de qualquer candidato.
    const onde = `${r.nome} ${r.texto}`.toLowerCase();
    const achou = NOMES.filter((n) => onde.includes(n));
    check(achou.length === 0, `${r.id}: sem nome de candidato (${achou.join(', ') || 'ok'})`);
  }
}

grupo('o rotulo sai do texto, cortado em palavra inteira');
{
  check(nomeDoTexto('Obrigado!') === 'Obrigado!', 'texto curto vira o rotulo inteiro');
  check(nomeDoTexto('   ') === 'Sem nome', 'texto vazio nao produz rotulo vazio');

  const longo = nomeDoTexto('Muito obrigado pelo apoio e pelo carinho de sempre, seguimos juntos');
  check(longo.length <= MAX_NOME + 1, 'rotulo longo e cortado');
  check(longo.endsWith('…'), 'o corte e visivel');
  check(!/\w…$/.test(longo) || longo.split(' ').length > 1, 'nao corta no meio da palavra');
}

grupo('o que vem do armazenamento e entrada NAO confiavel');
{
  const sujo = [
    { id: 'a', nome: 'Boa', texto: 'Obrigado!' },
    { id: 'a', nome: 'Repetido', texto: 'Outro texto' }, // id repetido
    { id: 'b', nome: 'Vazio', texto: '   ' }, // sem texto: descartado
    { nome: 'Sem id', texto: 'Tem texto' },
    { id: 'c', texto: 'Sem nome nenhum aqui' },
    'nao e objeto',
    null,
  ];
  const limpo = sanitizar(sujo);

  check(limpo.length === 4, 'descarta o que nao tem texto e o que nao e objeto');
  check(new Set(limpo.map((r) => r.id)).size === 4, 'id repetido ganha id novo');
  check(limpo.every((r) => !!r.nome), 'item sem nome ganha rotulo do texto');
  check(sanitizar(null).length === 0 && sanitizar('x').length === 0, 'lista invalida vira vazia');

  const demais = Array.from({ length: MAX_RESPOSTAS + 5 }, (_, i) => ({ id: 'x' + i, texto: 'texto ' + i }));
  check(sanitizar(demais).length === MAX_RESPOSTAS, `o teto de ${MAX_RESPOSTAS} vale na leitura`);
}

grupo('guardar: do campo para a tira');
{
  const vazia = [];
  const um = guardar(vazia, '  Obrigado pelo apoio!  ');
  check(um.lista.length === 1, 'guarda o texto do campo');
  check(um.lista[0].texto === 'Obrigado pelo apoio!', 'o texto vai aparado');
  check(um.lista[0].nome === 'Obrigado pelo apoio!', 'o rotulo sai do texto');

  const dois = guardar(um.lista, 'Obrigado pelo apoio!');
  check(dois.jaExistia === true, 'texto igual nao vira segunda entrada');
  check(dois.lista.length === 1, 'e a lista nao cresce');

  check(guardar(um.lista, '   ').lista.length === 1, 'campo vazio nao guarda nada');

  const cheia = Array.from({ length: MAX_RESPOSTAS }, (_, i) => ({ id: 'x' + i, texto: 't' + i }));
  const estourou = guardar(cheia, 'mais uma');
  check(estourou.cheia === true, 'a tira cheia AVISA em vez de engolir');
  check(estourou.lista.length === MAX_RESPOSTAS, 'e nao passa do teto');
}

grupo('renomear muda o rotulo, nunca o texto');
{
  const lista = guardar([], 'Dia 25 e 22! Leva todo mundo.').lista;
  const id = lista[0].id;

  const novo = renomear(lista, id, '  Dia 25  ');
  check(novo[0].nome === 'Dia 25', 'o nome novo entra aparado');
  check(novo[0].texto === 'Dia 25 e 22! Leva todo mundo.', 'o texto fica intacto');

  const emBranco = renomear(lista, id, '   ');
  check(!!emBranco[0].nome, 'nome em branco volta a sair do texto, nunca fica vazio');

  check(renomear(lista, 'id-que-nao-existe', 'x')[0].nome === lista[0].nome, 'id desconhecido nao mexe em nada');
}

grupo('apagar devolve o texto — e o desfazer barato');
{
  const lista = guardar(guardar([], 'Primeira').lista, 'Segunda').lista;
  const alvo = lista[1].id;

  const { lista: depois, texto } = apagar(lista, alvo);
  check(depois.length === 1, 'sai da tira');
  check(texto === 'Segunda', 'e o texto volta, para o painel por no campo');

  // E guardar de novo desfaz de verdade.
  const voltou = guardar(depois, texto);
  check(voltou.lista.length === 2, 'guardar o texto devolvido desfaz o apagar');

  check(apagar(lista, 'nao-existe').texto === '', 'apagar o que nao existe nao devolve texto');
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

  // O candidato de fabrica le a chave de topo, que cai no DEFAULTS enquanto nada foi guardado.
  const deFabrica = await store.get('respostasComentario');
  check(Array.isArray(deFabrica) && deFabrica.length === RESPOSTAS_DE_FABRICA.length, 'o default do store sao as de fabrica');

  /**
   * **O candidato NOVO nao comeca vazio.** `perfis.ler` devolve o `vazio` quando nao ha valor
   * gravado — e o painel passa as de fabrica justamente para a tira nao nascer vazia e parecer
   * quebrada (a armadilha que tirou `padroesDeAnuncio` daquela lista).
   */
  const outro = await perfis.ler('respostasComentario', 'outro-candidato', RESPOSTAS_DE_FABRICA);
  check(outro.length === RESPOSTAS_DE_FABRICA.length, 'candidato sem valor gravado cai nas de fabrica');

  // E o que ELE guardar fica so dele.
  await perfis.gravar('respostasComentario', 'outro-candidato', [{ id: 'z', nome: 'So dele', texto: 'Texto dele' }]);
  const dele = await perfis.ler('respostasComentario', 'outro-candidato', RESPOSTAS_DE_FABRICA);
  check(dele.length === 1 && dele[0].texto === 'Texto dele', 'o que ele guarda fica no candidato dele');

  const padraoAinda = await perfis.ler('respostasComentario', '', RESPOSTAS_DE_FABRICA);
  check(padraoAinda.length === RESPOSTAS_DE_FABRICA.length, 'e nao vaza para o candidato de fabrica');
}

fim();
