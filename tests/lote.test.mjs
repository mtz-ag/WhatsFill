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

  /**
   * **INVERTIDA em 02/10/2026, a pedido dele** (*"preciso que tenha a opcao de so mandar texto sem
   * imagem"*): peca com texto e SEM arte agora sai como mensagem de texto. A outra metade da regra
   * nao mudou -- arte sem texto continua fora, porque imagem muda nao sai e o `jaRecebeu` precisa
   * do texto para reconhecer na conversa quem ja recebeu.
   */
  const soTexto = lote.paresProntos({ cfg: cfg(), imagens: { imagemLoteArquivo1: arte('a.jpg') } });
  check(soTexto.length === 2, 'peca com texto e sem arte ENTRA: e o disparo de texto');
  check(soTexto[0].temArte === true && soTexto[1].temArte === false, 'e cada uma diz se leva arte');
  check(soTexto[1].chave === null, 'sem arte, nao ha chave de imagem para o envio buscar');
  check(lote.temArte(soTexto) === true, 'o lote leva arte se QUALQUER peca levar');
  check(lote.temArte(soArte) === true && lote.temArte([]) === false, 'e nao leva quando nenhuma leva');
  check(
    lote.temArte(lote.paresProntos({ cfg: cfg(), imagens: {} })) === false,
    'so texto em todas: o contrato de envio de imagem nao e exigido'
  );

  check(lote.paresProntos({}).length === 0, 'sem nada configurado, nenhum par');
}

grupo('a tela diz o que falta, e par vazio nao e falta');
{
  // Texto sem arte deixou de ser falta (ele dispara texto); arte sem texto continua sendo.
  const faltas = lote.oQueFalta({ cfg: cfg(), imagens: { ...imagens(), imagemLoteArquivo3: arte('c.jpg') } });
  check(faltas.length === 1, 'so a peca 3 nao vai sair');
  check(/ 3 /.test(faltas[0]) && faltas[0].includes('sem o texto'), 'e diz o que falta nela');
  check(
    lote.oQueFalta({ cfg: cfg({ legendaLote3: 'oi' }), imagens: imagens() }).length === 0,
    'texto sem arte NAO e falta: e o disparo de texto'
  );
  check(lote.oQueFalta({ cfg: cfg(), imagens: imagens() }).length === 0, 'pecas completas nao reclamam');
  check(lote.oQueFalta({}).length === 0, 'as quatro vazias nao sao quatro avisos');
}

grupo('a chave da arte passa pelo candidato');
{
  const porPerfil = (nome) => `${nome}:felipe`;
  const pares = lote.paresProntos({
    cfg: cfg(),
    imagens: { 'imagemLoteArquivo1:felipe': arte('do-felipe.jpg') },
    chaveDeImagem: porPerfil,
  });
  // Sao DUAS pecas prontas (as duas legendas do `cfg`), e so a primeira leva arte.
  check(pares.length === 2 && pares[0].temArte && !pares[1].temArte, 'le a arte do candidato logado');
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
  check(chaves.length === lote.MAX_PECAS * 2, 'duas por peca: o link e a legenda');
  check(
    chaves.includes(lote.chaveDaLegenda(lote.MAX_PECAS)),
    'e vai ate o TETO, nao ate lotePecas -- a chave da peca 8 tem de existir ANTES de ele cria-la'
  );
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

grupo('ONDE o atendimento recem-criado caiu: ausencia de informacao NAO e evidencia');
{
  const meu = lote.ondeCaiuOAtendimento({ status: 'IN_PROGRESS', userId: 'u-eu' }, 'u-eu');
  check(meu.estado === lote.ONDE_MEU, 'em andamento e com o meu usuario: e isto que o modo promete');

  // A armadilha de 01/10 pela outra porta: `undefined !== 'IN_PROGRESS'` tambem e verdadeiro.
  check(
    lote.ondeCaiuOAtendimento({}, 'u-eu').estado === lote.ONDE_DESCONHECIDO,
    'sem status NENHUM e "desconhecido", nunca "caiu em Novos" nem "esta tudo bem"'
  );
  check(
    lote.ondeCaiuOAtendimento(null, 'u-eu').estado === lote.ONDE_DESCONHECIDO,
    'sessao nula tambem: a rodada para e diz, em vez de prometer o que nao leu'
  );
  check(
    lote.ondeCaiuOAtendimento({ status: 'ARCHIVED' }, 'u-eu').estado === lote.ONDE_DESCONHECIDO,
    'status que nao e nenhum dos tres conhecidos tambem e desconhecido'
  );

  check(
    lote.ondeCaiuOAtendimento({ status: 'PENDING' }, 'u-eu').estado === lote.ONDE_PENDENTE,
    'PENDING e a fila dos "Novos" -- o modo nao entrega isso como se fosse "Meus"'
  );
  check(
    lote.ondeCaiuOAtendimento({ status: 'COMPLETED', userId: 'u-eu' }, 'u-eu').estado === lote.ONDE_CONCLUIDO,
    'nascer concluido nao e o que o modo promete'
  );
  check(
    lote.ondeCaiuOAtendimento({ status: 'IN_PROGRESS', userId: 'u-outro' }, 'u-eu').estado === lote.ONDE_DE_OUTRO,
    'em andamento com OUTRO operador: nao se entra no meio do atendimento de alguem'
  );

  // Os dois casos em que o estado e "nao da para conferir", e os dois SEGUEM, dizendo que seguem.
  check(
    lote.ondeCaiuOAtendimento({ status: 'IN_PROGRESS' }, 'u-eu').estado === lote.ONDE_SEM_DONO,
    'em andamento sem dono legivel: segue, com o motivo escrito'
  );
  check(
    lote.ondeCaiuOAtendimento({ status: 'IN_PROGRESS', userId: 'u-outro' }, '').estado === lote.ONDE_SEM_DONO,
    'sem saber o MEU usuario nao da para acusar outro operador -- "de-outro" exigiria comparar'
  );
  check(
    !!lote.ondeCaiuOAtendimento({ status: 'PENDING' }, 'u-eu').motivo,
    'todo estado leva o motivo escrito, que e o que vai para a linha do Andamento'
  );
  check(
    lote.ondeCaiuOAtendimento({ status: 'in_progress', userId: 'u-eu' }, 'u-eu').estado === lote.ONDE_MEU,
    'caixa do status nao decide'
  );
}

grupo('de quem e a sessao: os apelidos do campo, e desistir em vez de palpitar');
{
  check(lote.donoDaSessao({ userId: 'a' }) === 'a', 'userId e o campo que a contagem de "Meus" usa');
  check(lote.donoDaSessao({ user: { id: 'b' } }) === 'b', 'user.id tambem serve');
  check(lote.donoDaSessao({ agent: { userId: 'c' } }) === 'c', 'agent.userId tambem');
  check(lote.donoDaSessao({ agentId: 'd' }) === 'd', 'agentId tambem');
  check(lote.donoDaSessao({}) === '', 'nao achar devolve VAZIO: palpite aqui viraria "ficou com voce" sem base');
  check(lote.donoDaSessao(null) === '', 'nulo tambem');
  check(lote.donoDaSessao({ userId: '   ' }) === '', 'campo em branco nao e dono');
  check(
    lote.donoDaSessao({ contactId: 'x', channelId: 'y' }) === '',
    'contato e canal NAO sao o dono -- seria o campo errado respondendo a pergunta certa'
  );
}

grupo('as CHAVES da sessao: a FORMA, nunca o conteudo');
{
  const chaves = lote.chavesDaSessao({ id: '1', status: 'IN_PROGRESS', userId: 'u' });
  check(chaves === 'id, status, userId', 'devolve os nomes dos campos, na ordem em que vieram');
  check(
    !lote.chavesDaSessao({ contactPhone: '5199', contactName: 'Fulano' }).includes('5199'),
    'nenhum VALOR aparece: a sessao carrega telefone e nome de eleitor'
  );
  const muitas = {};
  for (let i = 0; i < 40; i++) muitas[`c${i}`] = i;
  check(lote.chavesDaSessao(muitas).includes('(+15)'), 'lista longa e cortada, dizendo quantas sobraram');
  check(lote.chavesDaSessao(null) === '' && lote.chavesDaSessao('x') === '', 'sem objeto nao ha chaves');
}

grupo('o teto e DELE: 45 e so o padrao, e so o ZERO desliga');
{
  check(lote.tetoDoCfg({ tetoPorNumero: 30 }) === 30, 'o numero que ele digitou vale');
  check(lote.tetoDoCfg({ tetoPorNumero: '30' }) === 30, 'o campo da tela chega como texto');
  check(lote.tetoDoCfg({}) === lote.TETO_POR_NUMERO, 'sem valor gravado, o padrao de 45 que ele mesmo ditou');
  check(lote.tetoDoCfg({ tetoPorNumero: '' }) === lote.TETO_POR_NUMERO, 'campo apagado tambem cai no padrao');
  check(lote.tetoDoCfg({ tetoPorNumero: null }) === lote.TETO_POR_NUMERO, 'nulo tambem');
  check(lote.tetoDoCfg() === lote.TETO_POR_NUMERO, 'sem cfg nenhuma tambem');

  check(lote.tetoDoCfg({ tetoPorNumero: 0 }) === lote.SEM_TETO, 'ZERO e a escolha explicita de nao ter teto');
  check(lote.tetoDoCfg({ tetoPorNumero: '0' }) === lote.SEM_TETO, 'o zero digitado tambem');

  // O defeito OPOSTO, e o caro: campo estragado desligando a protecao em silencio.
  check(
    lote.tetoDoCfg({ tetoPorNumero: 'quarenta' }) === lote.TETO_POR_NUMERO,
    'texto sem numero volta ao PADRAO, nunca a "sem teto" -- escorregao nao desliga protecao'
  );
  check(lote.tetoDoCfg({ tetoPorNumero: NaN }) === lote.TETO_POR_NUMERO, 'NaN tambem volta ao padrao');
  check(lote.tetoDoCfg({ tetoPorNumero: 1.9 }) === 1, 'fracao e truncada: teto e contagem de conversas');

  check(lote.textoDoTeto(45) === '45', 'na tela, o numero');
  check(lote.textoDoTeto(lote.SEM_TETO) === 'sem teto', 'e "sem teto" quando nao ha');
}

grupo('sem teto, a fila nunca se esgota -- e ela continua na ORDEM dele');
{
  const fila = ['ch-1', 'ch-2'];
  const envios = { 'ch-1': { dia: '2026-10-02', enviados: 900 } };
  const args = { fila, envios, dia: '2026-10-02', teto: lote.SEM_TETO };

  check(lote.numeroDaVez(args).canalId === 'ch-1', 'com o teto desligado, a vez continua sendo do PRIMEIRO da fila');
  check(lote.saldoTotal(args) === lote.SEM_TETO, 'e o saldo total nunca chega a zero, entao a rodada nao se recusa a comecar');
  check(
    lote.saldoDaFila(args)[0].usados === 900,
    'o contador continua contando: desligar o teto nao apaga a medida, so para de barrar'
  );
  check(lote.textoDoTeto(lote.saldoDaFila(args)[0].restam) === 'sem teto', 'e a tela diz "sem teto" em vez de um numero infinito');

  // Com o teto dele, o mesmo caso troca de numero -- e e por isso que o campo importa.
  const comTeto = { ...args, teto: 45 };
  check(lote.numeroDaVez(comTeto).canalId === 'ch-2', 'com teto de 45, o primeiro esta cheio e a vez e do seguinte');
  const curto = { fila: ['ch-1'], envios, dia: '2026-10-02', teto: 45 };
  check(lote.numeroDaVez(curto) === null, 'fila de um numero cheio nao tem vez -- a recusa que o bloqueou');
  check(lote.numeroDaVez({ ...curto, teto: 1000 }).canalId === 'ch-1', 'e levantar o teto resolve, que e o que ele pediu');
}

grupo('quantas pecas: ele adiciona e remove, e o padrao continua sendo quatro');
{
  check(lote.quantasPecas({}) === lote.PECAS_PADRAO, 'sem valor gravado, as quatro de sempre');
  check(lote.quantasPecas() === lote.PECAS_PADRAO, 'sem cfg nenhuma tambem');
  check(lote.quantasPecas({ lotePecas: 1 }) === 1, 'uma peca so e valido: disparo de uma mensagem');
  check(lote.quantasPecas({ lotePecas: 8 }) === 8, 'e o teto tambem');

  // Fora da faixa NAO vira zero: zero pecas e nada a mandar, e o botao ficaria morto sem motivo.
  check(lote.quantasPecas({ lotePecas: 0 }) === 1, 'zero sobe para uma');
  check(lote.quantasPecas({ lotePecas: -3 }) === 1, 'negativo tambem');
  check(lote.quantasPecas({ lotePecas: 99 }) === lote.MAX_PECAS, 'acima do teto para no teto');
  check(lote.quantasPecas({ lotePecas: 'abc' }) === lote.PECAS_PADRAO, 'lixo volta ao padrao');
  check(lote.quantasPecas({ lotePecas: '6' }) === 6, 'o campo da tela chega como texto');

  // E a conta das pecas prontas RESPEITA o quanto ele pediu: a legenda da peca 3 existe no
  // armazenamento e nao sai enquanto ele estiver usando duas -- remover nao apaga, so para de usar.
  const tres = { lotePecas: 3, legendaLote1: LEGENDA_1, legendaLote2: LEGENDA_2, legendaLote3: LEGENDA_1 };
  check(lote.paresProntos({ cfg: tres, imagens: {} }).length === 3, 'com tres pecas, as tres saem');
  check(
    lote.paresProntos({ cfg: { ...tres, lotePecas: 2 }, imagens: {} }).length === 2,
    'baixando para duas, a terceira para de sair e o texto dela continua guardado'
  );
}

grupo('as etiquetas que ele manda PULAR: a lista que ele digita');
{
  check(lote.nomesPulados('A, B').join('|') === 'A|B', 'separa por virgula e tira o espaco');
  check(lote.nomesPulados('A;B').join('|') === 'A|B', 'ponto e virgula tambem');
  check(lote.nomesPulados('A,,  ,B').join('|') === 'A|B', 'campo vazio no meio nao vira etiqueta vazia');
  check(lote.nomesPulados('A, a, A ').length === 1, 'repetido entra uma vez, sem olhar a caixa');
  check(lote.nomesPulados('Sem Retorno 1').join('|') === 'Sem Retorno 1', 'nome com espaco dentro continua inteiro');
  check(lote.nomesPulados('') .length === 0 && lote.nomesPulados().length === 0, 'vazio e nenhuma etiqueta');
  check(lote.nomesPulados('  ,  ').length === 0, 'so separador tambem');
  // O que ele escreveu e o que vai ser procurado no CRM: a caixa NAO e normalizada.
  check(lote.nomesPulados('CoLiNhA')[0] === 'CoLiNhA', 'guarda a caixa que ele escreveu');
}

grupo('a lista de pular decide antes do recibo e da conversa');
{
  const vip = { id: 't-vip', label: 'VIP' };
  const recibo = { id: 't-colinha', label: 'COLINHA' };

  const r = lote.porqueNaoMandar({ tagsDoContato: ['t-vip'], tagsPuladas: [vip] });
  check(/VIP/.test(r) && /pular/.test(r), 'diz QUAL etiqueta e que foi voce quem mandou pular');

  check(
    /VIP/.test(lote.porqueNaoMandar({ tagsDoContato: ['t-vip', 't-colinha'], tagsPuladas: [vip], tagDoLote: recibo })),
    'tendo as duas, o motivo e o dela: os tres desfechos sao iguais e o motivo e o que ele reconhece'
  );

  // Falso positivo: a etiqueta esta na LISTA e nao no contato -- isso nao pula ninguem.
  check(
    lote.porqueNaoMandar({ tagsDoContato: ['t-outra'], tagsPuladas: [vip] }) === null,
    'contato sem a etiqueta da lista recebe normalmente'
  );
  check(lote.porqueNaoMandar({ tagsDoContato: ['t-vip'], tagsPuladas: [] }) === null, 'lista vazia nao pula ninguem');
  check(lote.porqueNaoMandar({ tagsDoContato: ['t-vip'] }) === null, 'sem o campo tambem -- o disparo antigo nao muda');
  check(
    lote.porqueNaoMandar({ tagsDoContato: [], tagsPuladas: [vip] }) === null,
    'contato sem etiqueta nenhuma recebe'
  );
  check(
    lote.porqueNaoMandar({ tagsDoContato: ['t-vip'], tagsPuladas: [{ label: 'sem id' }] }) === null,
    'etiqueta sem id NAO pula: id vazio casaria com qualquer coisa'
  );
  check(
    /COLINHA/.test(lote.porqueNaoMandar({ tagsDoContato: ['t-colinha'], tagsPuladas: [vip], tagDoLote: recibo })),
    'e o recibo continua pulando quando e ele que casa'
  );
}

fim();
