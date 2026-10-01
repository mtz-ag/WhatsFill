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

/**
 * O TETO POR NUMERO e a fila (01/10/2026). O que se protege: o teto e por DIA (numero queimado
 * para sempre nao voltaria a servir amanha), a fila cai no numero unico antigo (subir a versao
 * nao pode desligar o lote de quem ja o configurou), e o contador so conta o que SAIU.
 */
grupo('a fila de numeros, e o numero unico antigo como fallback');
{
  check(lote.filaDeNumeros({ loteCanais: ['a', 'b'] }).join(',') === 'a,b', 'a fila dele, na ordem dele');
  check(lote.filaDeNumeros({ loteCanais: ['a', 'b', 'a'] }).join(',') === 'a,b', 'id repetido entra uma vez');
  check(lote.filaDeNumeros({ loteCanais: ['', '  ', 'b'] }).join(',') === 'b', 'vazio nao e numero');
  check(
    lote.filaDeNumeros({ loteCanais: [], loteCanalId: 'velho' }).join(',') === 'velho',
    'sem fila, cai no numero unico: subir a versao NAO pode desligar o lote de quem ja o configurou'
  );
  check(
    lote.filaDeNumeros({ loteCanais: ['a'], loteCanalId: 'velho' }).join(',') === 'a',
    'tendo fila, ela vence o campo antigo'
  );
  check(lote.filaDeNumeros({}).length === 0 && lote.filaDeNumeros().length === 0, 'sem nada, fila vazia');
}

grupo('o dia e LOCAL, nunca UTC');
{
  const d = new Date(2026, 9, 1, 22, 30);
  check(lote.diaLocal(d) === '2026-10-01', '22:30 de 01/10 ainda e dia 01 -- toISOString daria dia 02');
  check(lote.diaLocal(new Date(2026, 0, 5)) === '2026-01-05', 'mes e dia com zero na frente');
}

grupo('o contador: por numero, por dia');
{
  const hoje = '2026-10-01';
  const envios = { a: { dia: hoje, enviados: 44 }, b: { dia: '2026-09-30', enviados: 45 } };
  check(lote.usadosNoDia(envios, 'a', hoje) === 44, 'conta o que saiu hoje');
  check(lote.usadosNoDia(envios, 'b', hoje) === 0, 'dia anterior conta ZERO: a contagem zera na virada');
  check(lote.usadosNoDia(envios, 'nao-existe', hoje) === 0, 'numero sem contagem e zero');
  check(lote.usadosNoDia({}, 'a', hoje) === 0 && lote.usadosNoDia(null, 'a', hoje) === 0, 'vazio e zero');

  const depois = lote.somarEnvio(envios, 'a', hoje);
  check(depois.a.enviados === 45, 'somar anda um');
  check(envios.a.enviados === 44, 'e NAO muta o que recebeu');
  check(lote.somarEnvio(envios, 'b', hoje).b.enviados === 1, 'numero de outro dia recomeca do 1');
  check(Object.keys(lote.somarEnvio(envios, '', hoje)).length === 2, 'sem numero, nao inventa linha');
}

grupo('o teto de 45 e a troca de numero');
{
  const hoje = '2026-10-01';
  check(lote.TETO_POR_NUMERO === 45, 'o teto que ele pediu');

  const fila = ['a', 'b', 'c'];
  const cheio = { a: { dia: hoje, enviados: 45 } };
  check(lote.numeroDaVez({ fila, envios: {}, dia: hoje }).canalId === 'a', 'comeca no primeiro da fila');
  check(lote.numeroDaVez({ fila, envios: cheio, dia: hoje }).canalId === 'b', 'cheio o primeiro, passa para o seguinte');
  check(
    lote.numeroDaVez({ fila, envios: { a: { dia: hoje, enviados: 44 } }, dia: hoje }).canalId === 'a',
    'com 44 ainda e a vez dele: o teto e 45, nao 44'
  );
  check(
    lote.numeroDaVez({ fila, envios: { a: { dia: hoje, enviados: 99 } }, dia: hoje }).canalId === 'b',
    'passar do teto nao destrava: o saldo nao fica negativo'
  );

  const todosCheios = {
    a: { dia: hoje, enviados: 45 },
    b: { dia: hoje, enviados: 45 },
    c: { dia: hoje, enviados: 45 },
  };
  check(lote.numeroDaVez({ fila, envios: todosCheios, dia: hoje }) === null, 'fila esgotada devolve NULO -- a rodada para');
  check(lote.numeroDaVez({ fila: [], envios: {}, dia: hoje }) === null, 'sem fila, nulo');
  check(
    lote.numeroDaVez({ fila, envios: todosCheios, dia: '2026-10-02' }).canalId === 'a',
    'no dia seguinte a fila inteira volta a servir'
  );

  check(lote.saldoTotal({ fila, envios: {}, dia: hoje }) === 135, 'tres numeros vazios cabem 135 hoje');
  check(lote.saldoTotal({ fila, envios: cheio, dia: hoje }) === 90, 'um cheio tira 45 do total');
  check(lote.saldoTotal({ fila, envios: todosCheios, dia: hoje }) === 0, 'todos cheios: zero, e a rodada nem comeca');

  const saldo = lote.saldoDaFila({ fila, envios: { b: { dia: hoje, enviados: 10 } }, dia: hoje });
  check(saldo.length === 3 && saldo[0].canalId === 'a', 'o saldo sai na ORDEM da fila -- e ela que o cartao mostra');
  check(saldo[1].usados === 10 && saldo[1].restam === 35, 'usados e restam, para a tela e para o confirm');
}

/**
 * O VEREDITO DO NUMERO (01/10/2026). O defeito que este grupo existe para travar: `!== CONNECTED`
 * dava verdadeiro para `undefined`, e a rodada se recusou a comecar num numero Z-API que estava
 * NO AR -- `status` e `quality` sao da Cloud API e nao existem no canal nao oficial.
 */
grupo('o numero so e barrado por informacao que EXISTE');
{
  const zapi = { tipo: 'ZAPI_WHATSAPP', saude: '', status: '', qualidade: '' };
  const v = lote.porqueNaoUsarONumero(zapi);
  check(v.barra === false, 'canal Z-API sem status nem qualidade NAO e barrado -- foi este o defeito da print');
  check(!!v.aviso, 'mas a tela diz que nao deu para conferir: barreira que nao protege nao pode ser silenciosa');

  check(lote.porqueNaoUsarONumero({ saude: 'OK' }).barra === false, 'conexao OK passa');
  check(lote.porqueNaoUsarONumero({ status: 'CONNECTED' }).barra === false, 'status CONNECTED passa');
  check(lote.porqueNaoUsarONumero({ saude: 'OK', status: 'CONNECTED' }).barra === false, 'os dois bons passam');
  check(lote.porqueNaoUsarONumero({ saude: 'OK' }).aviso === '', 'e sem aviso: ha informacao e ela e boa');
}

grupo('o que BARRA: a mensagem nao chega');
{
  check(lote.porqueNaoUsarONumero({ saude: 'DISCONNECTED' }).barra, 'numero desconectado -- o caso que ele relatou');
  check(lote.porqueNaoUsarONumero({ saude: 'CRITICAL' }).barra, 'conexao critica');
  check(lote.porqueNaoUsarONumero({ status: 'BANNED' }).barra, 'numero banido');
  check(lote.porqueNaoUsarONumero({ status: 'RESTRICTED' }).barra, 'teto de conversas iniciadas em 24h: a plataforma recusa');
  check(lote.porqueNaoUsarONumero({ status: 'DISCONNECTED' }).barra, 'desconectado tambem chega pelo status');
  check(lote.porqueNaoUsarONumero(null).barra, 'numero que sumiu da conta E evidencia: nao ha por onde mandar');
  check(lote.porqueNaoUsarONumero({ saude: 'disconnected' }).barra, 'caixa nao decide');
  check(!!lote.porqueNaoUsarONumero({ saude: 'DISCONNECTED' }).motivo, 'e o motivo vai escrito, para a tela e para o log');

  check(
    lote.porqueNaoUsarONumero({ saude: 'DISCONNECTED', status: 'CONNECTED' }).barra,
    'conexao caida vence status bom: sao eixos diferentes, e o que decide e a entrega'
  );
}

grupo('o que so AVISA: a mensagem chega, e o risco e decisao dele');
{
  const flagged = lote.porqueNaoUsarONumero({ status: 'FLAGGED' });
  check(flagged.barra === false, 'FLAGGED nao barra: "sinalizado como SPAM" ainda entrega');
  check(flagged.aviso.includes('FLAGGED'), 'mas aparece no aviso');

  const alerta = lote.porqueNaoUsarONumero({ saude: 'ALERT' });
  check(alerta.barra === false && !!alerta.aviso, 'ALERT e "em alerta", nao "caiu"');
  check(lote.porqueNaoUsarONumero({ saude: 'CHECK' }).barra === false, 'CHECK e "verificando conexao"');
}

grupo('a janela de 24h: sem typeDetails o padrao e SEM janela');
{
  check(lote.janelaEmMinutos({ detalhes: { sessionDurationInMinutes: -1 } }) === -1, 'canal sem janela');
  check(lote.janelaEmMinutos({ detalhes: { sessionDurationInMinutes: 1440 } }) === 1440, 'canal com janela de 24h');
  check(
    lote.janelaEmMinutos({ detalhes: null }) === -1,
    'sem detalhes o padrao e -1, como o proprio app faz -- NaN fazia a tela prometer janela que nao existe'
  );
  check(lote.janelaEmMinutos({}) === -1 && lote.janelaEmMinutos(null) === -1, 'vazio tambem');
}

fim();
