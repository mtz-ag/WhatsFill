/**
 * Os CANDIDATOS — quem é o dono da conversa, e o que muda com ele.
 *
 * Pedido dele (24/09/2026): *"a extensão trabalha com o foco no Capitão Martim, ou seja somente um
 * perfil; eu preciso da opção de mais perfis pois tenho agora o Felipe Pedri, então as respostas
 * devem ser específicas pra ele"*.
 *
 * **O teste que mais importa é o do INVARIANTE**: com um perfil só, o prompt e os textos saem como
 * saíam. Sem ele, ligar esta tela mudaria o que sai para eleitor sem ninguém ter escolhido — é a
 * mesma disciplina do `arvorePadrao` contra o `sugerirAcao`.
 *
 * Rode: node tests/perfis.test.mjs
 */

import { check, grupo, fim, lib, mem } from './_harness.mjs';

const perfis = await lib('perfis.js');
const store = await lib('store.js');
const ia = await lib('ia.js');

const MARTIM = { id: 'martim', nome: 'Capitão Martim', tratamento: 'o Capitão Martim', cargo: 'deputado estadual', numero: '10122', canais: [], dossie: '' };
const PEDRI = { id: 'pedri', nome: 'Felipe Pedri', tratamento: 'o Felipe Pedri', cargo: 'deputado federal', numero: '2228', canais: ['cccad9', '(51) 98051-0122'], dossie: 'Felipe Pedri é deputado federal.' };

grupo('sanitizar: o que vem do armazenamento é entrada NÃO confiável');
{
  check(perfis.sanitizar([]).length === 1, 'lista vazia devolve o candidato de fábrica');
  check(perfis.sanitizar([])[0].nome === 'Capitão Martim', 'e ele é o de sempre');
  check(perfis.sanitizar(null)[0].id === 'martim', 'null também');

  const limpa = perfis.sanitizar([
    { id: 'pedri', nome: 'Felipe Pedri', canais: ['a', 'a', ''], lixo: 1 },
    { id: 'pedri', nome: 'Outro' },
    { id: '', nome: 'Sem id' },
    { id: 'x', nome: '' },
    3,
    null,
  ]);
  check(limpa.length === 1 && limpa[0].id === 'pedri', 'id repetido, id vazio e nome vazio caem fora');
  check(!('lixo' in limpa[0]), 'campo desconhecido não passa');
  check(limpa[0].canais.length === 1, 'canal repetido e vazio somem');
  check(limpa[0].tratamento === 'o Felipe Pedri', 'sem tratamento escrito, ele é derivado do nome');
}

grupo('doCanal: quem atende esta conversa');
{
  const lista = [MARTIM, PEDRI];
  check(perfis.doCanal(lista, 'cccad9').id === 'pedri', 'pelo id do canal');
  check(perfis.doCanal(lista, '', '5198051-0122').id === 'pedri', 'pelo NÚMERO, que é o que ele lê na tela');
  check(perfis.doCanal(lista, '', '51 98051 0122').id === 'pedri', 'e o número casa só por dígitos');

  /**
   * **Sem casamento vence quem não reivindicou canal nenhum.** É o que impede a base inteira de
   * ficar sem candidato no dia em que ele criar o segundo perfil e esquecer de preencher o canal do
   * primeiro — e painel sem candidato é painel sem nome para escrever.
   */
  check(perfis.doCanal(lista, 'outro-canal').id === 'martim', 'canal desconhecido cai no de sempre');
  check(perfis.doCanal(lista, '').id === 'martim', 'sem canal nenhum, idem');
  check(!!perfis.doCanal([], 'x'), 'nunca devolve nulo');
}

grupo('trocarONome: a forma completa antes da curta');
{
  const t = (x) => perfis.trocarONome(x, 'Capitão Martim', 'Felipe Pedri');
  check(t('a equipe do Capitão Martim') === 'a equipe do Felipe Pedri', 'o nome inteiro');
  check(t('O Martim é deputado') === 'O Felipe Pedri é deputado', 'o sobrenome sozinho');
  /**
   * **A COMPLETA vem primeiro de propósito** — pela curta, "Capitão Martim" viraria "Capitão Felipe
   * Pedri". É o mesmo cuidado de concordância que a migração de "gabinete" exigiu em 07/09.
   */
  check(!t('Capitão Martim').includes('Capitão'), 'a completa vence: não sobra "Capitão Felipe Pedri"');
  check(t('Zucco e Flávio') === 'Zucco e Flávio', 'quem não é o candidato não é tocado');
  check(t('') === '', 'vazio não quebra');
  check(perfis.trocarONome('x', '', 'Y') === 'x', 'sem nome de origem não troca nada');
  /** A fronteira é `[^\p{L}]` com `u`: `\b` não abre antes nem fecha depois de letra acentuada. */
  check(perfis.trocarONome('o Capitão é bom', 'Capitão', 'Coronel') === 'o Coronel é bom', 'acento em volta não atrapalha');
}

grupo('semearTextos: o candidato novo não nasce mudo');
{
  const textos = [
    { id: 'a', text: 'Aqui é a equipe do Capitão Martim. Vote 10122!', variantes: ['Fala o Martim, 10.122.'] },
    { id: 'b', text: 'Obrigado pelo apoio.' },
  ];
  const novos = perfis.semearTextos(textos, MARTIM, PEDRI);
  check(novos[0].text === 'Aqui é a equipe do Felipe Pedri. Vote 2228!', 'nome e número trocados');
  check(novos[0].variantes[0] === 'Fala o Felipe Pedri, 2228.', 'a variante também, e o número com ponto junto');
  check(novos[1].text === 'Obrigado pelo apoio.', 'texto sem o nome fica igual');
  check(novos[0].id === 'a', 'o id da resposta não muda — é ele que a rodada reconhece');

  /** Sem número no destino o texto fica como está: número de urna errado manda votar em outro. */
  const semNumero = perfis.semearTextos(textos, MARTIM, { ...PEDRI, numero: '' });
  check(semNumero[0].text.includes('10122'), 'sem número no candidato novo, o antigo NÃO é apagado às cegas');
}

grupo('ler e gravar: o de fábrica nas chaves de sempre, os outros à parte');
{
  delete mem.templates;
  delete mem.porPerfil;
  await store.set('templates', [{ id: 'x', text: 'do Martim' }]);

  const doPadrao = await perfis.ler('templates', 'martim');
  check(doPadrao[0].text === 'do Martim', 'o de fábrica lê a chave de topo — é isto que não mexe na produção dele');

  /**
   * **Perfil sem texto gravado devolve o VAZIO, nunca o do outro candidato.** Mandar a resposta do
   * Martim pelo número do Felipe é exatamente o defeito que esta tela existe para impedir.
   */
  check((await perfis.ler('templates', 'pedri', [])).length === 0, 'perfil novo não herda os textos do outro');

  await perfis.gravar('templates', 'pedri', [{ id: 'x', text: 'do Pedri' }]);
  check((await perfis.ler('templates', 'pedri'))[0].text === 'do Pedri', 'e passa a ler o que foi gravado nele');
  check((await store.get('templates'))[0].text === 'do Martim', 'gravar no Pedri não encosta no do Martim');
}

grupo('a lista de chaves por candidato é de PERMISSÃO, e ela vale');
{
  let estourou = false;
  try {
    await perfis.ler('cityLinks', 'pedri');
  } catch {
    estourou = true;
  }
  check(estourou, 'chave que não é por candidato recusa em vez de criar uma cópia silenciosa');
  check(perfis.CHAVES_DO_PERFIL.includes('templates'), 'as respostas prontas estão na lista');
  check(!perfis.CHAVES_DO_PERFIL.includes('fluxo'), 'e o quadro do fluxo NÃO — ele é compartilhado de propósito');
}

grupo('O INVARIANTE: com um candidato só, o prompt é o de sempre');
{
  const arg = { templates: [], regras: '', gabinete: '' };
  const padrao = ia.montarSistemaRascunho(arg);
  const comOPadraoExplicito = ia.montarSistemaRascunho({ ...arg, candidato: MARTIM });
  check(padrao === comOPadraoExplicito, 'passar o candidato de fábrica dá exatamente o mesmo prompt');
  check(/Capitão Martim/.test(padrao), 'e ele continua sendo o Capitão Martim');

  const outro = ia.montarSistemaRascunho({ ...arg, candidato: PEDRI });
  check(!/Martim/.test(outro), 'no prompt do outro candidato não sobra "Martim" em lugar nenhum');
  check(/Felipe Pedri/.test(outro), 'e o nome dele está lá');

  /**
   * **A CONCORDÂNCIA é metade do trabalho** — a lição de 07/09, e a medição pegou *"a equipe o
   * Capitão Martim"* saindo no perfil de HOJE antes disto ir ao ar. "a equipe" pede DE + artigo.
   */
  for (const texto of [padrao, outro]) {
    check(!/a equipe o /.test(texto) && !/assessoria o /.test(texto), 'nada de "a equipe o Fulano"');
  }
  check(/Somos a equipe do Felipe Pedri/.test(outro), 'a frase da regra 9 sai contraída');

  const contatoPadrao = ia.montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'oi' }] });
  const contatoIgual = ia.montarContatoRascunho({ mensagens: [{ de: 'contato', texto: 'oi' }], candidato: MARTIM });
  check(contatoPadrao === contatoIgual, 'o bloco do contato também é byte a byte o mesmo');
}

grupo('o documento DELE não é editado — só o nome da injeção muda');
{
  const atendimento = await lib('atendimento.js');
  check(/Capitão Martim/.test(atendimento.PADRAO_DE_ATENDIMENTO), 'o arquivo do padrão continua com o nome dele');
  const outro = ia.montarSistemaRascunho({ templates: [], regras: '', gabinete: '', candidato: PEDRI });
  check(/redige a resposta de uma mensagem recebida no WhatsApp do Felipe Pedri/.test(outro),
    'e o que VAI no prompt do outro candidato sai com o nome trocado');
}

fim();
