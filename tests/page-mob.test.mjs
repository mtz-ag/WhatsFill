/**
 * **O ADAPTADOR DA PLATAFORMA NOVA** — o que estes testes travam e cada ponto em que eu quase
 * escrevi hipotese e a medicao desmentiu.
 *
 * Rode: node tests/page-mob.test.mjs
 */
import { check, grupo, fim } from './_harness.mjs';
import {
  chaveDaEtiqueta,
  etiquetasDoContato,
  contatoDoBanco,
  ehForaDoRS,
  estadoDaConversa,
  ABERTO,
  EM_ATENDIMENTO,
  RESOLVIDO,
} from '../src/lib/page-mob.js';

grupo('a armadilha do rotulo repetido VOLTOU, com outra cara');
{
  /**
   * Medido na base dele em 27/10/2026: 87 rotulos distintos em 439 contatos, e entre eles o
   * MESMO conceito escrito de tres jeitos. Comparar o texto cru faria a rodada aplicar de novo
   * uma etiqueta que o contato ja tem.
   */
  check(chaveDaEtiqueta('⛔ 1 SEM RETORNO') === chaveDaEtiqueta('⛔ 1 Sem Retorno'), 'emoji e caixa nao fazem duas etiquetas');
  check(chaveDaEtiqueta('METROPOLITANO DELTA DO JACUÍ') === chaveDaEtiqueta('Metropolitano Delta do Jacuí'), 'acento e caixa tambem nao');
  check(chaveDaEtiqueta('SERRA ') === chaveDaEtiqueta('SERRA'), 'espaco no fim nao faz etiqueta nova — e ele EXISTE na base');
  check(chaveDaEtiqueta('🔴PROCURA EMPREGO OU DINHEIRO') === chaveDaEtiqueta('1. PROCURA EMPREGO OU DINHEIRO'), 'o enfeite de ordenacao (emoji ou numero) nao e parte do nome');

  /** E o que e DIFERENTE continua diferente — senao a normalizacao viraria um apagador. */
  check(chaveDaEtiqueta('VALE DO RIO DOS SINOS') !== chaveDaEtiqueta('VALE DO RIO PARDO'), 'dois COREDEs parecidos continuam dois');
  check(chaveDaEtiqueta('CONTEÚDO FLÁVIO') !== chaveDaEtiqueta('CONTEÚDO ZUCCO'), 'dois conteudos continuam dois');
  check(chaveDaEtiqueta('') === '' && chaveDaEtiqueta(null) === '', 'vazio e vazio');

  const linha = { tags: ['⛔ 1 SEM RETORNO', '⛔ 1 Sem Retorno', 'SERRA ', '  ', null] };
  const e = etiquetasDoContato(linha);
  check(e.length === 2, 'as duas grafias viram UMA etiqueta, e o lixo nao entra');
  check(e[0].name === '⛔ 1 SEM RETORNO', 'o `name` guarda a GRAFIA DO BANCO — e ela que volta numa escrita futura');
  check(e.some((t) => t.name === 'SERRA'), 'o espaco do fim sai do nome, mas o nome continua sendo o dele');
  check(etiquetasDoContato({}).length === 0 && etiquetasDoContato(null).length === 0, 'sem tags, lista vazia');
}

grupo('o contato, na forma que o painel ja le');
{
  // Dados FICTICIOS: nenhum telefone ou nome de eleitor entra em arquivo do repositorio.
  const linha = {
    id: 'bd-1',
    nome: 'Marta Fictinha',
    name: 'Marta Fictinha',
    telefone: '5551999990000',
    phone: '5551999990000',
    cidade: 'Caxias do Sul',
    city: 'Caxias do Sul',
    estado: 'RS',
    bairro: 'Centro',
    observacoes: 'anotacao interna',
    notes: null,
    tags: ['SERRA', 'CONTEÚDO FLÁVIO'],
    nao_perturbe: false,
    created_at: '2026-09-01T10:00:00Z',
  };

  const c = contatoDoBanco(linha);
  check(c.id === 'bd-1' && c.name === 'Marta Fictinha', 'id e nome');
  check(c.tagsId.length === 2 && c.tagsId.includes('serra'), 'as etiquetas viram ids normalizados, que e como o painel compara');

  /**
   * `fields.readValues` le `customFieldValues` no formato `{customFieldId, valueString}`. Na
   * plataforma velha esse formato custou o `contract.js` inteiro — um contrato APRENDIDO, porque
   * a API respondia 200 e ignorava o valor fora do formato. Aqui sao colunas, e o adaptador so
   * precisa vesti-las com o nome que o painel espera.
   */
  const porCampo = Object.fromEntries(c.customFieldValues.map((v) => [v.customFieldId, v.valueString]));
  check(porCampo.Cidade === 'Caxias do Sul', 'a coluna `cidade` chega como o campo Cidade');
  check(porCampo.Observacoes === 'anotacao interna', 'e `observacoes` como Observacoes');
  check(!('Profissao' in porCampo), 'coluna vazia nao vira campo vazio — vira ausencia');

  /**
   * **`notes` tem 0 preenchidos e `observacoes` tem 30** (medido). Os outros pares sao espelho
   * perfeito, este NAO e: quem gravasse em `notes` escreveria num campo que a plataforma nao le.
   */
  check(contatoDoBanco({ ...linha, observacoes: null, notes: 'so em notes' })
    .customFieldValues.every((v) => v.customFieldId !== 'Observacoes'), 'o adaptador le `observacoes`, nunca `notes`');

  check(contatoDoBanco(null) === null, 'sem linha, sem contato — e isso e o caso NORMAL: metade das conversas nao tem contato no CRM');
}

grupo('nao_perturbe: a protecao que a plataforma velha nao tinha');
{
  const base = { id: 'bd-2', nome: 'Jose Exemplo', tags: [] };
  check(contatoDoBanco({ ...base, nao_perturbe: true }).naoPerturbe === true, 'marcado, a rodada tem de saber');
  check(contatoDoBanco({ ...base, nao_perturbe: true, nao_perturbe_motivo: 'pediu' }).naoPerturbeMotivo === 'pediu', 'com o motivo junto');
  check(contatoDoBanco(base).naoPerturbe === false, 'sem a coluna, nao e "nao perturbe"');

  /** `null` nao e `true`: ausencia de informacao nunca vira a afirmacao mais forte. */
  check(contatoDoBanco({ ...base, nao_perturbe: null }).naoPerturbe === false, 'nulo nao marca ninguem');
}

grupo('de fora do RS: a coluna responde, e o vazio nao afirma nada');
{
  check(ehForaDoRS('SC') === true && ehForaDoRS('sp') === true, 'outro estado e de fora');
  check(ehForaDoRS('RS') === false && ehForaDoRS('Rio Grande do Sul') === false, 'o nosso nao');
  /**
   * Medido: 556 RS, 41 de fora, **3 vazios**. Vazio e desconhecido, e desconhecido tratado como
   * "de fora" tiraria tres pessoas do filtro estadual sem ninguem ter decidido isso.
   */
  check(ehForaDoRS('') === false && ehForaDoRS(null) === false, 'vazio e desconhecido, nao e "de fora"');
}

grupo('o estado da tela: tres status, e quem responde "acabou?" e o status');
{
  const aberta = (status, extra = {}) => ({
    conversa: { id: 'c-1', status, total_mensagens: 7, ultima_mensagem_em: '2026-10-27T09:00:00Z', ...extra },
    por: 'os-dois',
  });

  const pendente = estadoDaConversa(aberta(ABERTO));
  check(pendente.sessionId === 'c-1', 'o id da conversa aberta vira o sessionId');
  check(pendente.isPending === true && pendente.concluded === false, 'aberto = pendente');

  check(estadoDaConversa(aberta(EM_ATENDIMENTO)).isPending === false, 'em atendimento nao e pendente');
  check(estadoDaConversa(aberta(RESOLVIDO)).concluded === true, 'resolvido e concluido');

  /**
   * **`resolvido_em` NAO decide isso, e medir foi o que salvou:** das 11 conversas resolvidas,
   * **1** tinha `resolvido_em` preenchido. Quem lesse a coluna veria dez atendimentos fechados
   * como abertos, e a rodada voltaria a mexer neles.
   */
  check(estadoDaConversa(aberta(RESOLVIDO, { resolvido_em: null })).concluded === true, 'resolvida SEM resolvido_em continua resolvida — e sao 10 de 11');
  check(estadoDaConversa(aberta(ABERTO, { resolvido_em: '2026-10-01' })).concluded === false, 'e resolvido_em preenchido nao fecha o que o status diz estar aberto');

  /** O sinal de conversa muda quando chega mensagem — e o que faz o painel reanalisar na hora. */
  const antes = estadoDaConversa(aberta(ABERTO)).conversation;
  const depois = estadoDaConversa(aberta(ABERTO, { total_mensagens: 8 })).conversation;
  check(antes !== depois, 'mensagem nova muda o sinal');

  /** Nada aberto e um estado legitimo, nao um erro. */
  const nada = estadoDaConversa(null);
  check(nada.sessionId === null && nada.concluded === false, 'sem conversa aberta, o painel sabe que nao ha nada');
  check(nada.porQuantosSinais === 'nenhum', 'e diz que nao foi por sinal nenhum');

  /**
   * **O painel carrega POR QUANTOS SINAIS soube.** Com um sinal so a tela esta num estado que
   * ninguem mediu, e quem le precisa poder desconfiar — a mesma disciplina do `nao-da-para-saber`
   * do canal removido.
   */
  check(estadoDaConversa({ ...aberta(ABERTO), por: 'so-um-sinal' }).porQuantosSinais === 'so-um-sinal', 'um sinal so chega marcado');

  /**
   * `semControles` fica FALSO de proposito: na plataforma velha ele era a rede de seguranca para
   * o rotulo do botao mudar de nome. Aqui quem responde e o `status`, que e dado — e inventar um
   * terceiro estado sem ter medido seria a hipotese que este projeto nao aceita.
   */
  check(estadoDaConversa(aberta(ABERTO)).semControles === false, 'semControles nao e afirmado');

  /** Dando para ler a tela, a tela ganha: se da para digitar sem assumir NAO foi medido. */
  check(estadoDaConversa(aberta(ABERTO), { hasComposer: true }).hasComposer === true, 'a leitura da tela vence o palpite pelo status');
  check(estadoDaConversa(aberta(ABERTO)).hasComposer === false, 'sem leitura, cai no status');
}

fim();
