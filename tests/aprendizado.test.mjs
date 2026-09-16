/**
 * O que a IA aprende com as escolhas dele entre os três rascunhos.
 *
 * O erro caro aqui é **promover ruído a regra**: uma lição errada não fica na tela, ela muda o que
 * sai para eleitor real, em todos os contatos, até alguém apagar. Por isso metade destas asserções
 * é sobre a lição NÃO nascer — pouca evidência, empate, ou dimensão em que ele nunca teve escolha.
 *
 * Rode: node tests/aprendizado.test.mjs
 */
import { check, grupo, fim } from './_harness.mjs';
import {
  medir,
  frasesDe,
  vazio,
  registrarEscolha,
  licoes,
  blocoParaOPrompt,
  MINIMO_DE_ESCOLHAS,
  MINIMO_PARA_TAXA,
  TAXA_PARA_SOLTAR,
  taxaDePrimeira,
  prontaParaRodarSozinha,
  abreJanelaDeTreino,
  DIMENSOES,
} from '../src/lib/aprendizado.js';

grupo('medir é só FORMA — nenhuma palavra do texto sai daqui');
{
  const m = medir('Boa tarde! Obrigado pela mensagem. Pode contar com a gente. 🙏');
  check(m.saudacao === true, 'abre com saudação');
  check(m.agradece === true, 'agradece');
  check(m.emoji === true, 'tem emoji');
  check(m.pergunta === false, 'não tem pergunta');
  check(m.frases === 3, 'conta as frases');
  check(!Object.values(m).some((v) => typeof v === 'string'), 'o retrato não guarda texto nenhum');

  check(medir('O Capitão Martim é deputado estadual.').saudacao === false, 'sem saudação');
  check(medir('Qual a sua cidade?').pergunta === true, 'pergunta reconhecida');
  check(medir('Diga ao senhor que recebemos.').senhor === true, '"o senhor" reconhecido');
  check(medir('Você pode contar com a gente.').senhor === false, '"você" não é tratamento formal');
  check(medir('Uma linha.\n\nOutra linha.').paragrafos === true, 'parágrafos reconhecidos');
  check(frasesDe('') === 0, 'texto vazio tem zero frases');
}

grupo('a escolha só ensina onde os textos DIFERIAM');
{
  /**
   * **É a guarda central deste arquivo.** Se os três rascunhos abrirem com saudação e ele escolher
   * um, a escolha não diz nada sobre saudação — ele não teve alternativa. Contar assim encheria a
   * lista de lições que ninguém ensinou, e elas iriam para o prompt como se fossem dele.
   */
  let e = vazio();
  for (let i = 0; i < 10; i += 1) {
    e = registrarEscolha(e, {
      escolhido: 'Boa tarde! Recebemos sua mensagem por aqui.',
      descartados: ['Boa tarde! Sua mensagem chegou.', 'Boa tarde! Está anotado.'],
    });
  }
  check(e.escolhas === 10, 'as dez escolhas foram contadas');
  check(!e.dimensoes.saudacao, 'saudação não acumulou nada: as três tinham');
  check(!licoes(e).some((l) => l.id === 'saudacao'), 'e não virou lição');
}

grupo('preferência clara vira regra depois de evidência suficiente');
{
  let e = vazio();
  const escolher = () =>
    registrarEscolha(e, {
      escolhido: 'Recebemos sua mensagem e vamos acompanhar essa pauta por aqui.',
      descartados: [
        'Boa tarde! Recebemos sua mensagem e vamos acompanhar essa pauta por aqui.',
        'Boa tarde! Obrigado pela confiança. 🙏',
      ],
    });

  for (let i = 0; i < MINIMO_DE_ESCOLHAS - 1; i += 1) e = escolher();
  check(!licoes(e).length, `com ${MINIMO_DE_ESCOLHAS - 1} escolhas ainda não há lição nenhuma`);
  check(blocoParaOPrompt(e) === '', 'e o bloco do prompt continua vazio');

  e = escolher();
  const l = licoes(e);
  const saud = l.find((x) => x.id === 'saudacao');
  check(!!saud, `com ${MINIMO_DE_ESCOLHAS} a lição da saudação nasce`);
  check(/NÃO abra com saudação/.test(saud.regra), 'e ela diz para NÃO abrir com saudação');
  check(saud.proporcao === 1, 'com a proporção medida junto');
  check(/siga/.test(blocoParaOPrompt(e)), 'o bloco do prompt passa a existir');
  check(blocoParaOPrompt(e).includes(saud.regra), 'e carrega a regra');
}

grupo('empate não ensina nada');
{
  let e = vazio();
  const com = { escolhido: 'Boa tarde! Está anotado por aqui.', descartados: ['Está anotado por aqui.'] };
  const sem = { escolhido: 'Está anotado por aqui.', descartados: ['Boa tarde! Está anotado por aqui.'] };
  for (let i = 0; i < 5; i += 1) e = registrarEscolha(e, com);
  for (let i = 0; i < 5; i += 1) e = registrarEscolha(e, sem);
  check(e.dimensoes.saudacao.com === 5 && e.dimensoes.saudacao.sem === 5, 'os dois lados contados');
  check(!licoes(e).some((x) => x.id === 'saudacao'), 'metade e metade não vira regra');
}

grupo('o tamanho é aprendido por POSIÇÃO, nunca em número de frases');
{
  /**
   * *"Ele gosta de 3 frases"* seria falso — o tamanho certo depende do caso. O que se aprende é: das
   * opções que ele teve, ele pega a mais curta?
   */
  let e = vazio();
  for (let i = 0; i < 6; i += 1) {
    e = registrarEscolha(e, {
      escolhido: 'Está anotado.',
      descartados: ['Está anotado. Vamos acompanhar.', 'Está anotado. Vamos acompanhar. Obrigado pela confiança.'],
    });
  }
  const t = licoes(e).find((x) => x.id === 'tamanho');
  check(!!t && /CURTO/.test(t.regra), 'a preferência pela mais curta vira regra');

  let d = vazio();
  for (let i = 0; i < 6; i += 1) {
    d = registrarEscolha(d, {
      escolhido: 'Está anotado. Vamos acompanhar essa pauta. Obrigado pela confiança de sempre.',
      descartados: ['Está anotado.', 'Está anotado. Vamos acompanhar.'],
    });
  }
  const l = licoes(d).find((x) => x.id === 'tamanho');
  check(!!l && /Desenvolva/.test(l.regra), 'e a preferência oposta também — a lição cai para os dois lados');

  let igual = vazio();
  for (let i = 0; i < 6; i += 1) {
    igual = registrarEscolha(igual, { escolhido: 'Uma frase.', descartados: ['Outra frase.', 'Mais uma.'] });
  }
  check(!licoes(igual).some((x) => x.id === 'tamanho'), 'três do mesmo tamanho não ensinam tamanho');
}

grupo('nada acontece sem escolha de verdade');
{
  const e = vazio();
  check(registrarEscolha(e, { escolhido: 'Um texto.', descartados: [] }).escolhas === 0,
    'escolhido sem descartados não conta — não houve escolha');
  check(registrarEscolha(e, { escolhido: '', descartados: ['a', 'b'] }).escolhas === 0, 'escolhido vazio não conta');
  check(licoes(null).length === 0, 'estado nulo não quebra e não inventa lição');
  check(blocoParaOPrompt(undefined) === '', 'nem o bloco do prompt');
  check(licoes({ escolhas: 'muitas', dimensoes: 'nada' }).length === 0, 'estado corrompido não vira regra');

  /** **Não muta o que entrou** — quem chama grava o resultado, e mutar esconderia a falha. */
  const antes = vazio();
  const depois = registrarEscolha(antes, { escolhido: 'Oi. Tudo certo.', descartados: ['Tudo certo.'] });
  check(antes.escolhas === 0 && depois.escolhas === 1, 'o estado velho fica intacto');
}

grupo('as dimensões dizem as DUAS frases, e são mecânicas');
{
  /**
   * Cada dimensão precisa das duas: a preferência pode cair para qualquer lado, e escrever só
   * metade faria a oposta virar silêncio em vez de regra.
   */
  for (const d of DIMENSOES) {
    check(!!d.com && !!d.sem && d.com !== d.sem, `"${d.id}" diz o que fazer nos dois lados`);
    check(typeof d.de('texto qualquer') === 'boolean', `"${d.id}" mede sem julgar`);
  }
  check(new Set(DIMENSOES.map((d) => d.id)).size === DIMENSOES.length, 'nenhum id repetido');
}

grupo('a taxa que diz quando soltar a IA sozinha');
{
  /**
   * Pedido dele (15/09/2026): *"deixe o antigo, que ira rodar sozinho ja com o conhecimento, quando
   * estiver com taxa baixa de erro"*.
   *
   * **A taxa mede uma coisa so, e e preciso dizer qual:** de quantas vezes a PRIMEIRA opcao — a que
   * a IA mandaria se ele nao estivesse treinando — foi a escolhida. Alta, o modo antigo manda o
   * texto que ele escolheria de qualquer jeito.
   */
  const um = (i) => ({
    escolhido: ['Primeira.', 'Segunda.', 'Terceira.'][i],
    descartados: ['Primeira.', 'Segunda.', 'Terceira.'].filter((_, j) => j !== i),
    indice: i,
  });

  let e = vazio();
  check(taxaDePrimeira(e).total === 0, 'sem escolha, a taxa nao existe');
  check(!prontaParaRodarSozinha(e).pronta, 'e nada esta pronto para soltar');

  for (let i = 0; i < MINIMO_PARA_TAXA; i += 1) e = registrarEscolha(e, um(0));
  const t = taxaDePrimeira(e);
  check(t.sim === MINIMO_PARA_TAXA && t.proporcao === 1, 'escolhendo sempre a primeira, taxa cheia');
  check(prontaParaRodarSozinha(e).pronta, 'com a taxa cheia, a tela pode avisar que da para soltar');

  let meio = vazio();
  for (let i = 0; i < 6; i += 1) meio = registrarEscolha(meio, um(0));
  for (let i = 0; i < 6; i += 1) meio = registrarEscolha(meio, um(2));
  check(taxaDePrimeira(meio).proporcao === 0.5, 'metade e metade da meio');
  check(!prontaParaRodarSozinha(meio).pronta, `e ${Math.round(TAXA_PARA_SOLTAR * 100)}% e o corte, entao ainda nao solta`);

  let poucas = vazio();
  for (let i = 0; i < MINIMO_PARA_TAXA - 1; i += 1) poucas = registrarEscolha(poucas, um(0));
  check(!prontaParaRodarSozinha(poucas).pronta,
    `${MINIMO_PARA_TAXA - 1} acertos em ${MINIMO_PARA_TAXA - 1} ainda nao soltam: taxa de amostra pequena e ruido`);

  /** **Indice ausente nao empurra a taxa para lado nenhum** — quem nao sabe a posicao nao vota. */
  const semIndice = registrarEscolha(vazio(), { escolhido: 'Um.', descartados: ['Dois.'] });
  check(taxaDePrimeira(semIndice).total === 0, 'escolha sem posicao nao entra na taxa');
  check(semIndice.escolhas === 1, 'mas continua ensinando as dimensoes');
}

grupo('a rodada automatica nunca espera a janela de treino (16/09/2026)');
{
  /**
   * Relato dele: *"o modo treino interrompeu o fluxo de mandar modelo ao aparecer anuncio"*. Com a janela
   * aberta a rodada automatica parava de abrir contatos. Esta decisao ja foi invertida duas vezes;
   * a terceira tem de cair aqui.
   */
  check(abreJanelaDeTreino({ treinando: true, rodadaAutomatica: false }) === true, 'treino ligado, contato a contato: abre');
  check(abreJanelaDeTreino({ treinando: true, rodadaAutomatica: true }) === false, 'treino ligado, rodada AUTOMATICA: NAO abre');
  check(abreJanelaDeTreino({ treinando: false, rodadaAutomatica: false }) === false, 'treino desligado: nao abre');
  check(abreJanelaDeTreino({ treinando: undefined, rodadaAutomatica: false }) === false, 'sem a chave gravada: nao abre');
  check(abreJanelaDeTreino() === false, 'sem nada: nao abre');
}

fim();
