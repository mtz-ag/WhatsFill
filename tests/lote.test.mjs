/**
 * O ENVIO EM LOTE de imagem + legenda, revezando entre pares.
 *
 * O que este arquivo protege: o par nunca sai pela metade (imagem muda ou texto sem arte), o
 * revezamento SO anda quando a mensagem sai, e quem ja recebeu QUALQUER UM dos quatro pares nao
 * recebe outro -- a armadilha do modelo padrao com rodizio (02/09), onde a conferencia olhava so
 * o item sorteado e bastava o ponteiro andar para o mesmo contato receber de novo.
 *
 * Rode: node tests/lote.test.mjs
 */
import { check, grupo, fim } from './_harness.mjs';
import * as lote from '../src/lib/lote.js';

const arte = (nome) => ({ nome, mime: 'image/jpeg', dados: 'AAAA' });
const LEGENDA_1 =
  'Nesta eleicao a seguranca publica volta a ser prioridade no Rio Grande do Sul, e conto com voce.';
const LEGENDA_2 =
  'A escola civico-militar mudou a vida de muita gente aqui, e e por isso que seguimos defendendo ela.';

const cfg = (extra) => ({ legendaLote1: LEGENDA_1, legendaLote2: LEGENDA_2, ...extra });
const imagens = (extra) => ({
  imagemLoteArquivo1: arte('seguranca.jpg'),
  imagemLoteArquivo2: arte('escola.jpg'),
  ...extra,
});

grupo('o par so entra quando os DOIS lados estao preenchidos');
{
  const pares = lote.paresProntos({ cfg: cfg(), imagens: imagens() });
  check(pares.length === 2, 'dois pares completos, dois vazios: entram dois');
  check(pares[0].n === 1 && pares[1].n === 2, 'na ordem dos campos da tela');
  check(pares[0].legenda === LEGENDA_1, 'a legenda do par e a do mesmo numero');
  check(pares[0].arquivo.nome === 'seguranca.jpg', 'e a arte tambem');

  const soArte = lote.paresProntos({ cfg: { legendaLote1: LEGENDA_1 }, imagens: imagens() });
  check(soArte.length === 1, 'par com arte e sem legenda NAO entra (sairia imagem muda)');

  const soTexto = lote.paresProntos({ cfg: cfg(), imagens: { imagemLoteArquivo1: arte('a.jpg') } });
  check(soTexto.length === 1, 'par com legenda e sem arte NAO entra (nao e rodada de texto)');

  check(lote.paresProntos({}).length === 0, 'sem nada configurado, nenhum par');
}

grupo('a tela diz o que falta, e par vazio nao e falta');
{
  const faltas = lote.oQueFalta({ cfg: cfg({ legendaLote3: 'oi' }), imagens: imagens() });
  check(faltas.length === 1, 'so o par 3 esta pela metade');
  check(faltas[0].includes('par 3') && faltas[0].includes('sem a imagem'), 'e diz qual metade falta');
  check(lote.oQueFalta({ cfg: cfg(), imagens: imagens() }).length === 0, 'pares completos nao reclamam');
  check(lote.oQueFalta({}).length === 0, 'os quatro vazios nao sao quatro avisos');
}

grupo('a chave da arte passa pelo candidato');
{
  const porPerfil = (nome) => `${nome}:felipe`;
  const pares = lote.paresProntos({
    cfg: cfg(),
    imagens: { 'imagemLoteArquivo1:felipe': arte('do-felipe.jpg') },
    chaveDeImagem: porPerfil,
  });
  check(pares.length === 1, 'le a arte do candidato logado');
  check(pares[0].chave === 'imagemLoteArquivo1:felipe', 'e carrega a chave que o worker vai subir');
}

grupo('o revezamento anda em circulo e nao estoura');
{
  const pares = lote.paresProntos({ cfg: cfg(), imagens: imagens() });
  check(lote.parDaVez(pares, 0).n === 1, 'comeca no primeiro');
  check(lote.parDaVez(pares, 1).n === 2, 'depois o segundo');
  check(lote.parDaVez(pares, 2).n === 1, 'e volta para o primeiro');
  check(lote.parDaVez(pares, 97).n === 2, 'indice grande continua dentro da lista');
  check(lote.parDaVez(pares, -1).n === 2, 'indice negativo nao quebra');
  check(lote.parDaVez([], 0) === null, 'sem par pronto nao ha o que mandar');
  check(lote.parDaVez(pares, undefined).n === 1, 'ponteiro ausente comeca do zero');
}

grupo('quem ja recebeu QUALQUER par esta fora -- o conjunto, nunca o sorteado');
{
  const pares = lote.paresProntos({ cfg: cfg(), imagens: imagens() });
  check(lote.jaRecebeu(pares, []) === null, 'conversa sem nada nosso: ninguem recebeu');
  check(lote.jaRecebeu(pares, [{ texto: 'Bom dia!' }]) === null, 'nossa fala curta nao conta');

  const recebeuODois = [{ texto: 'Bom dia!' }, { texto: LEGENDA_2 }];
  check(lote.jaRecebeu(pares, recebeuODois) === 2, 'acusa o par 2 mesmo quando o da vez e o 1');

  const comAcento = [{ texto: 'A escola cívico-militar mudou a vida de muita gente aqui, e é por isso que seguimos defendendo ela.' }];
  check(lote.jaRecebeu(pares, comAcento) === 2, 'acento e caixa nao escondem o que ja saiu');

  const quebrado = [{ texto: `Olha so:\n\n${LEGENDA_1}\n\nQualquer coisa e so chamar.` }];
  check(lote.jaRecebeu(pares, quebrado) === 1, 'legenda dentro de uma mensagem maior conta');

  check(lote.jaRecebeu(pares, ['texto solto nao quebra a funcao']) === null, 'aceita string no lugar do objeto');
}

grupo('legenda curta nao serve de impressao digital');
{
  const curta = lote.paresProntos({ cfg: { legendaLote1: 'Vote 10122!' }, imagens: imagens() });
  check(curta.length === 1, 'ela entra como par (e texto valido)');
  check(
    lote.jaRecebeu(curta, [{ texto: 'Vote 10122!' }]) === null,
    'mas nao decide duplicata: abaixo de 30 caracteres o pedaco casaria em conversa demais'
  );
}

grupo('a ETIQUETA e a memoria de verdade; a conversa e a segunda rede');
{
  const pares = lote.paresProntos({ cfg: cfg(), imagens: imagens() });
  const colinha = { id: 'tag-9', label: 'COLINHA' };

  check(lote.porqueNaoMandar({ pares, nossas: [] }) === null, 'contato limpo recebe');

  const porEtiqueta = lote.porqueNaoMandar({ pares, nossas: [], tagsDoContato: ['tag-9'], tagDoLote: colinha });
  check(!!porEtiqueta, 'quem JA TEM a etiqueta nao recebe de novo');
  check(porEtiqueta.includes('COLINHA'), 'e o motivo diz qual etiqueta foi');

  check(
    lote.porqueNaoMandar({ pares, nossas: [], tagsDoContato: ['outra'], tagDoLote: colinha }) === null,
    'etiqueta de outro assunto no contato nao barra'
  );

  /**
   * A razao de a etiqueta vir PRIMEIRO: conversa e memoria da sessao. Quem volta sozinho abre
   * atendimento novo, `nossas` nasce vazio, e so a etiqueta lembra que a arte ja foi.
   */
  const voltouNoutraSessao = lote.porqueNaoMandar({
    pares,
    nossas: [],
    tagsDoContato: ['tag-9'],
    tagDoLote: colinha,
  });
  check(!!voltouNoutraSessao, 'sessao nova com a etiqueta no CRM continua barrada');

  const semEtiquetaConfigurada = lote.porqueNaoMandar({
    pares,
    nossas: [{ texto: LEGENDA_1 }],
    tagsDoContato: ['tag-9'],
    tagDoLote: null,
  });
  check(
    semEtiquetaConfigurada.includes('par 1'),
    'sem etiqueta configurada a conversa ainda segura quem recebeu nesta sessao'
  );
}

grupo('o confirm diz quantos cada par vai pegar');
{
  const d = lote.comoVaiRevezar(4, 40);
  check(d.length === 4 && d.every((x) => x === 10), '40 contatos em 4 pares: 10 cada');
  const sobrando = lote.comoVaiRevezar(4, 10);
  check(sobrando.join(',') === '3,3,2,2', 'sobra vai para os primeiros, e a soma fecha em 10');
  check(sobrando.reduce((a, b) => a + b, 0) === 10, 'a soma e o limite');
  check(lote.comoVaiRevezar(0, 10).length === 0, 'sem par, nada a dizer');
}

grupo('as chaves do auto sao as que o perfil tem de separar');
{
  const chaves = lote.chavesNoAuto();
  check(chaves.length === lote.QUANTOS_PARES * 2, 'duas por par: o link e a legenda');
  check(chaves.includes('legendaLote4') && chaves.includes('imagemLote4'), 'inclusive o ultimo par');
  check(!chaves.includes(lote.chaveDaImagem(1)), 'os BYTES nao moram no auto: a chave deles e separada');
}

fim();
