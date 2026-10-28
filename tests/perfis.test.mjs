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

import { readFileSync } from 'node:fs';
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

grupo('donoDoCanal: o canal AVISA, nunca escolhe (25/09/2026)');
{
  const lista = [MARTIM, PEDRI];
  check(perfis.donoDoCanal(lista, 'cccad9').id === 'pedri', 'pelo id do canal');
  check(perfis.donoDoCanal(lista, '', '5198051-0122').id === 'pedri', 'pelo NÚMERO, que é o que ele lê na tela');
  check(perfis.donoDoCanal(lista, '', '51 98051 0122').id === 'pedri', 'e o número casa só por dígitos');

  /**
   * **Devolver NULO é o ponto todo.** Quem escolhe o candidato é ele (o modelo de login); isto só
   * responde *"este atendimento é do número de outro?"*. Se "ninguém reivindicou" caísse no
   * candidato de sempre, a tarja apareceria em quase todo atendimento — alarme que toca sempre se
   * aprende a ignorar.
   */
  check(perfis.donoDoCanal(lista, 'outro-canal') === null, 'canal que ninguém reivindicou não acende nada');
  check(perfis.donoDoCanal(lista, '') === null, 'sem canal nenhum, idem');
  check(perfis.donoDoCanal(lista, '', '') === null, 'e sem número também');
  check(perfis.donoDoCanal([], 'x') === null, 'lista vazia não estoura');

  /** O candidato de sempre com o canal PREENCHIDO é reivindicação como a de qualquer outro. */
  const comCanal = [{ ...MARTIM, canais: ['ch-1'] }, PEDRI];
  check(perfis.donoDoCanal(comCanal, 'ch-1').id === 'martim', 'o de fábrica também pode reivindicar');
}

grupo('situacaoDoCanal: a barreira do numero nao cadastrado (25/09/2026)');
{
  /**
   * Relato dele: *"eu só adicionei os dois números do Martim, não adicionei o número do Felipe
   * Pedri ainda na extensão; não devia ter uma barreira caso o número não esteja na extensão?"*.
   *
   * **O defeito era tratar duas coisas como uma:** `donoDoCanal` devolve nulo tanto para "ninguém
   * cadastrou nada" quanto para "tem cadastro e este número não está nele". A primeira é silêncio;
   * a segunda é o caso perigoso.
   */
  const comoEstavaHoje = [
    { id: 'martim', nome: 'Capitão Martim', canais: ['5198051-0122', '51980510123'] },
    { id: 'pedri', nome: 'Felipe Pedri', canais: [] },
  ];
  const doFelipe = perfis.situacaoDoCanal(comoEstavaHoje, '095ee1', '51982175973', 'martim');
  check(doFelipe.estado === 'desconhecido', 'o número do Felipe, ainda não cadastrado, e DESCONHECIDO — e barra');

  const doMartim = perfis.situacaoDoCanal(comoEstavaHoje, '', '5198051-0122', 'martim');
  check(doMartim.estado === 'meu', 'o número dele, logado como ele, nao incomoda ninguem');

  const comOsDois = [comoEstavaHoje[0], { ...comoEstavaHoje[1], canais: ['095ee1'] }];
  const outro = perfis.situacaoDoCanal(comOsDois, '095ee1', '', 'martim');
  check(outro.estado === 'outro' && outro.dono.id === 'pedri', 'cadastrado e de outro: a tarja diz de quem');
  check(perfis.situacaoDoCanal(comOsDois, '095ee1', '', 'pedri').estado === 'meu', 'e logado como ele, nao');

  /**
   * **Antes de existir cadastro, tudo fica QUIETO** — acender ali seria alarme em 100% dos
   * atendimentos, e alarme que toca sempre se aprende a ignorar. É o estado de quem nunca abriu
   * esta tela, que é a produção de hoje.
   */
  const semCadastro = [{ id: 'martim', nome: 'Capitão Martim', canais: [] }];
  check(perfis.situacaoDoCanal(semCadastro, 'qualquer', '51999999999', 'martim').estado === 'quieto',
    'sem NENHUM numero cadastrado, nada acende');
  check(perfis.situacaoDoCanal(comoEstavaHoje, '', '', 'martim').estado === 'quieto',
    'e sem canal nem numero para comparar, tambem nao');
}

grupo('porId: quem está logado');
{
  const lista = [MARTIM, PEDRI];
  check(perfis.porId(lista, 'pedri').id === 'pedri', 'acha pelo id');
  check(perfis.porId(lista, 'quem').id === 'martim', 'id que não existe cai no primeiro — painel sem candidato não tem nome para escrever');
  check(perfis.porId(lista, null).id === 'martim', 'null idem');
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
    await perfis.ler('fluxo', 'pedri');
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

grupo('a mensagem do momento e o resto que SAI ficam de cada candidato (25/09/2026)');
{
  /**
   * Relato dele: *"ao trocar o perfil as mensagens nao ficam salvas para cada perfil, acabei de
   * trocar a mensagem do momento e ficou com a mensagem do Felipe Pedri; veja se vai acontecer com
   * o resto"*.
   *
   * Medido: das 18 coisas que SAEM para o eleitor, **14 estavam compartilhadas** -- a lista de
   * 24/09 cobria o texto das respostas prontas e esquecia tudo o que nao mora em `templates`.
   */
  for (const k of mem ? Object.keys(mem) : []) delete mem[k];
  await store.set('auto', { ...(await store.get('auto')), mensagemMomento: 'Texto do MARTIM' });

  check((await perfis.lerAuto('martim')).mensagemMomento === 'Texto do MARTIM', 'o de fabrica le a chave de topo, como sempre');
  check((await perfis.lerAuto('pedri')).mensagemMomento === '', 'e o outro le VAZIO, nunca a do Martim');

  await perfis.gravarAuto('pedri', { mensagemMomento: 'Texto do FELIPE' });
  check((await perfis.lerAuto('pedri')).mensagemMomento === 'Texto do FELIPE', 'o que ele grava fica com ele');
  check((await perfis.lerAuto('martim')).mensagemMomento === 'Texto do MARTIM', 'e a do Martim continua intacta');
  check((await store.get('auto')).mensagemMomento === 'Texto do MARTIM', 'a chave de topo nao foi tocada');

  /**
   * **A metade cara: `auto` nao pode ser separado inteiro.** Ele guarda a configuracao do OPERADOR
   * -- o limite da rodada, a pausa, "Automatizar", as etiquetas -- e separar aquilo faria o
   * interruptor da rodada mudar de estado ao trocar de login.
   */
  await perfis.gravarAuto('pedri', { limite: 44 });
  check((await perfis.lerAuto('martim')).limite === 44, 'o limite da rodada continua sendo UM so');
  check((await store.get('auto')).limite === 44, 'e ele foi para a chave de topo');

  /** Escrita com as duas metades juntas: cada campo para o seu lado, e nenhuma perde para a outra. */
  await perfis.gravarAuto('pedri', { mensagemMomento: 'F2', pausaSeg: 9 });
  check((await perfis.lerAuto('pedri')).mensagemMomento === 'F2', 'o campo do candidato foi para o candidato');
  check((await perfis.lerAuto('martim')).pausaSeg === 9, 'e o do operador para o topo, na mesma chamada');
  check((await perfis.lerAuto('martim')).mensagemMomento === 'Texto do MARTIM', 'sem uma escrita passar por cima da outra');

  /** As nove sub-chaves de `auto` que sao do candidato, uma a uma -- num candidato VIRGEM. */
  for (const chave of perfis.CHAVES_DO_PERFIL_EM_AUTO) {
    const vazio = (await perfis.lerAuto('candidato-novo'))[chave];
    const ehVazio = vazio === '' || vazio === false || (Array.isArray(vazio) && !vazio.length);
    check(ehVazio, `"${chave}" nasce vazia no candidato novo (veio ${JSON.stringify(vazio)})`);
  }

  /** E as chaves de TOPO que entraram junto. */
  await store.set('defaultGroupLink', 'link-do-martim');
  check((await perfis.ler('defaultGroupLink', 'pedri', '')) === '', 'o link do grupo tambem nao vaza');
  await perfis.gravar('contentTemplates', 'pedri', { x: 'modelo-do-felipe' });
  const doMartim = (await perfis.ler('contentTemplates', 'martim', {})) || {};
  check(!('x' in doMartim), 'e o Modelo por conteudo do Felipe nao aparece no Martim');
  check('x' in ((await perfis.ler('contentTemplates', 'pedri', {})) || {}), 'mas aparece no dele');

  /**
   * **A ARTE e separada pelo NOME DA CHAVE**, e nao por `porPerfil`: quem sobe os bytes e o service
   * worker, que faz `store.get(chave)` e nao sabe quem esta logado.
   */
  check(perfis.chaveDeImagem('imagemMomentoArquivo', 'martim') === 'imagemMomentoArquivo',
    'o de fabrica fica com o nome de sempre -- a arte que ele ja tem nao se perde');
  check(perfis.chaveDeImagem('imagemMomentoArquivo', 'pedri') === 'imagemMomentoArquivo:pedri',
    'e o outro ganha sufixo');

  /**
   * **`padroesDeAnuncio` ficou de FORA, e a medicao mostrou por que:** o valor e a FORMA do texto
   * pre-preenchido, nao tem editor na tela, e por perfil o candidato novo leria lista vazia.
   */
  check(!perfis.CHAVES_DO_PERFIL.includes('padroesDeAnuncio'), 'padroesDeAnuncio continua compartilhado');
  check(!perfis.CHAVES_DO_PERFIL_EM_AUTO.includes('automatizarComIA'), 'e "Automatizar" tambem');
  check(!perfis.CHAVES_DO_PERFIL_EM_AUTO.includes('etiquetasQuePulam'), 'e as etiquetas do CRM, que e um so');
}

grupo('o modelo do anuncio SOBREVIVE a troca de perfil (25/09/2026)');
{
  /**
   * Relato dele: *"ao trocar os perfis esta removendo os modelos setados para cada anuncio"*.
   *
   * **Medido: o armazenamento nunca foi tocado** -- ida e volta entre os dois candidatos devolve o
   * mesmo `valor`. Quem "apagava" era a TELA: os modelos aprovados sao do CANAL, entao o nome salvo
   * nao esta entre as `option` do outro candidato, e o `<select>` cai no vazio sobre um valor que
   * esta gravado. **Parece apagado, e um clique em qualquer outro campo do cartao o apagaria de
   * verdade.**
   *
   * Este teste trava a metade que da para travar: o dado. A outra metade e o `<select>`, que hoje
   * mostra o salvo marcado como "(nao e deste canal)" em vez de engolir -- o mesmo que a caixa do
   * modelo da rodada ja fazia.
   */
  const anuncios = await lib('anuncios.js');
  for (const k of Object.keys(mem)) delete mem[k];

  const DO_MARTIM = [{ id: 'a1', nome: 'Material da Direita', trechos: ['material da direita'],
    acao: 'modelo', valor: 'campanha_martim_01', etiquetas: [], ligado: true }];
  await store.set('anuncios', DO_MARTIM);
  await perfis.gravar('anuncios', 'pedri', DO_MARTIM);

  const doMartim = anuncios.normalizar(await store.get('anuncios'));
  const doPedri = anuncios.normalizar(await perfis.ler('anuncios', 'pedri', []));
  check(doMartim[0].valor === 'campanha_martim_01', 'o modelo do Martim continua gravado');
  check(doPedri[0].valor === 'campanha_martim_01', 'e o do Pedri tambem, depois da copia');

  /** Ida e volta varias vezes: e o gesto que ele fez e que motivou o relato. */
  for (let i = 0; i < 3; i++) {
    await perfis.ler('anuncios', 'martim', []);
    await perfis.ler('anuncios', 'pedri', []);
  }
  check(anuncios.normalizar(await store.get('anuncios'))[0].valor === 'campanha_martim_01',
    'trocar de perfil ida e volta nao apaga nada');

  /** `normalizar` e quem peneira a entrada do armazenamento -- ela nao pode comer o `valor`. */
  check(anuncios.normalizar([{ id: 'x', nome: 'n', acao: 'modelo', valor: 'um_modelo' }])[0].valor === 'um_modelo',
    'normalizar preserva o modelo escolhido');
}

grupo('SOMAR O CANAL AO CANDIDATO — a saida que a barreira nao tinha');
{
  /**
   * **A barreira estava certa e era um MURO** (28/10/2026, relato dele: *"agora esta so pulando de
   * contato em contato sem dar nenhuma opcao ou mandar mensagem"*). Ela mandava somar o numero na
   * aba Config, e enquanto ele nao fizesse isso a rodada pulava a fila inteira — corretamente, e
   * sem saida a um clique.
   *
   * **A funcao NAO soma sozinha**, e e isso que a mantem segura: dizer de QUEM e um numero e a
   * decisao que a barreira existe para proteger. Quem clica e ele.
   */
  const lista = [
    { id: 'martim', nome: 'Capitao Martim', canais: [] },
    { id: 'outro', nome: 'Outro Candidato', canais: ['999'] },
  ];
  const CANAL = 'uuid-do-canal';
  const NUMERO = '5551000000000';

  const depois = perfis.somarCanal(lista, 'martim', CANAL, NUMERO);
  const martim = depois.find((p) => p.id === 'martim');
  check(martim.canais.includes(CANAL), 'soma o id do canal');
  check(martim.canais.includes(NUMERO), 'e o numero junto');

  /**
   * **As DUAS chaves, porque elas envelhecem diferente:** o id morre se a instancia for recriada,
   * o telefone nao. `donoDoCanal` casa por qualquer uma.
   */
  check(perfis.donoDoCanal(depois, CANAL, '')?.id === 'martim', 'e o dono passa a ser reconhecido pelo id');
  check(perfis.donoDoCanal(depois, '', NUMERO)?.id === 'martim', 'e pelo numero tambem');

  const intocado = depois.find((p) => p.id === 'outro');
  check(intocado.canais.length === 1 && intocado.canais[0] === '999', 'o outro candidato nao e tocado');

  /** Somar duas vezes nao duplica — `sanitizar` ja deduplica, e a tela repete o clique. */
  const denovo = perfis.somarCanal(depois, 'martim', CANAL, NUMERO);
  check(denovo.find((p) => p.id === 'martim').canais.length === 2, 'somar de novo nao duplica');

  /** Sem chave nenhuma nao mexe em nada: nao ha o que somar, e lista vazia nao vira canal vazio. */
  const semNada = perfis.somarCanal(lista, 'martim', '', '   ');
  check(semNada.find((p) => p.id === 'martim').canais.length === 0, 'sem chave, nao soma nada');

  /** Id de candidato que nao existe nao cria candidato nenhum. */
  const inventado = perfis.somarCanal(lista, 'nao-existe', CANAL);
  check(inventado.length === lista.length, 'candidato inexistente nao vira candidato novo');
  check(!inventado.some((p) => p.canais.includes(CANAL)), 'e o canal nao entra em ninguem');
}

grupo('DESLIGAR a conferencia do numero: UM ponto, e e isso que a torna completa');
{
  /**
   * **Pedido dele (28/10/2026): *"desabilite a funcao de checar o numero por enquanto, esta
   * atrapalhando nessa nova plataforma"*.** A barreira esta certa e virou trava: na plataforma
   * nova o canal e um `instance_id` novo, nada esta cadastrado, e ela pulava a fila inteira. E a
   * licao do teto de 45 (02/10) — **protecao que ele nao alcanca volta como trava**.
   *
   * O interruptor desliga num lugar so: `recalcularCanalDoAtendimento` passa a escrever
   * `estado: 'quieto'`, que **os tres pontos que leem a conta ja tratam como "siga em frente"**.
   *
   * **E e por isso que este teste conta CHAMADAS:** havendo um segundo ponto chamando
   * `situacaoDoCanal` direto, ele escaparia do interruptor — a caixa ficaria desmarcada na tela e
   * a rodada continuaria pulando, que e o pior desfecho possivel (o controle mentindo).
   */
  const painel = readFileSync(new URL('../src/panel/panel.js', import.meta.url), 'utf8');

  const chamadas = (painel.match(/perfisLib\.situacaoDoCanal\(/g) || []).length;
  check(chamadas === 1, `situacaoDoCanal e chamada de UM lugar so no painel (achei ${chamadas})`);

  const leituras = (painel.match(/state\.auto\.cfg\.conferirCanal\b/g) || []).length;
  check(leituras === 1, `a chave \`conferirCanal\` e lida de UM lugar so (achei ${leituras})`);

  check(/function conferirCanalLigado\(\)/.test(painel), 'e esse lugar e `conferirCanalLigado`');

  /**
   * **`quieto` tem de continuar significando "siga em frente"** nos tres pontos — e e o que o
   * desligamento usa. Aqui isso se prova pela funcao de verdade, nao pelo texto do painel.
   */
  const semCadastro = perfis.situacaoDoCanal([{ id: 'martim', nome: 'Capitao Martim', canais: [] }], 'uuid', '5551000000000', 'martim');
  check(semCadastro.estado === 'quieto', 'ninguem reivindicou canal nenhum: `quieto`');

  const comCadastro = perfis.situacaoDoCanal(
    [{ id: 'martim', nome: 'Capitao Martim', canais: ['outro-uuid'] }],
    'uuid-deste-canal', '', 'martim'
  );
  check(comCadastro.estado === 'desconhecido', 'com cadastro e o canal fora dele: `desconhecido` — e o caso que pulava a fila');

  /**
   * **O padrao depende da PLATAFORMA, e o teste trava a razao** (nao o valor, que vive no
   * painel): a plataforma nova nasce desligada porque ha UMA instancia na conta — com um canal so
   * a barreira nao tem o que separar.
   */
  check(/return !naPlataformaNova\(\);/.test(painel), 'sem escolha gravada, quem decide o padrao e a plataforma');
}

fim();
