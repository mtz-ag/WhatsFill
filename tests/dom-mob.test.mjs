/**
 * **ABRIR A CONVERSA CERTA NA TELA DA PLATAFORMA NOVA** — a peca de que a escolha dele depende.
 *
 * Ele deu a condicao antes de escolher o caminho (26/10/2026): *"na antiga eu ainda tinha que ver
 * o que estava acontecendo, pois 90% das vezes o fluxo e a IA respondiam correto, mas faltava os
 * 10% que eu tinha que apagar e responder novamente manualmente"*. E a plataforma nova **nao apaga
 * mensagem** (medido nos 33 pacotes dela), entao ele escolheu ver ANTES, com a tela junto.
 *
 * O que estes testes travam:
 *
 *  1. **a identidade e o `id`, nunca o nome** — nome repetido nesta base abriria a conversa de uma
 *     pessoa com ele conferindo a mensagem de outra;
 *  2. **empate de nome nao vira escolha** — na reserva, duas linhas parecidas devolvem nada;
 *  3. **"nao esta na tela" e normal, nao erro** (medido: 69 linhas no DOM para 100 na consulta);
 *  4. **o clique para ai** — abrir nao marca lida, nao assume e nao digita.
 *
 * Rode: node tests/dom-mob.test.mjs
 */
import { check, grupo, fim } from './_harness.mjs';
import {
  conversaDoNo,
  textoDaLinha,
  linhaParece,
  acharLinha,
  abrirConversa,
  clicarAbaDaFila,
  clicarAssumir,
  conversaAberta,
  linhaAtiva,
  painelDaConversa,
  propsDoFiber,
  ehCampoDeMensagem,
  camposEditaveis,
  campoDeMensagem,
  temCampoDeMensagem,
  lerCampo,
  escreverNoCampo,
  vigiarEnvio,
  ultimoAtoDeEnvio,
  esquecerEnvio,
} from '../src/lib/dom-mob.js';

/**
 * Um `<button>` como o da fila: o React pendura `__reactFiber$<hash>` no proprio no, e a conversa
 * mora no `memoizedProps` de um ANCESTRAL do fiber (medido: nivel 1).
 */
function linhaFalsa(conversa, texto, { nivel = 1, chave = '__reactFiber$no3p7ttmpym' } = {}) {
  let fiber = { memoizedProps: { conversa }, return: null };
  for (let i = 0; i < nivel; i++) fiber = { memoizedProps: { className: 'x' }, return: fiber };

  const no = {
    tagName: 'BUTTON',
    textContent: texto,
    cliques: 0,
    rolou: 0,
    click() { this.cliques++; },
    scrollIntoView() { this.rolou++; },
  };
  no[chave] = fiber;
  return no;
}

const raizCom = (nos) => ({ querySelectorAll: () => nos });

grupo('a conversa que o React guardou no no');
{
  const c = { id: 'c-1', nome: 'Marta Fictinha', external_chat_id: '5551999990000@s.whatsapp.net' };
  const no = linhaFalsa(c, 'MFMarta Fictinha16:09Boa tardeSem atendente');

  check(conversaDoNo(no)?.id === 'c-1', 'acha a conversa subindo pelo fiber');
  check(conversaDoNo(linhaFalsa(c, 'x', { nivel: 7 }))?.id === 'c-1', 'acha ate o setimo nivel');
  check(conversaDoNo(linhaFalsa(c, 'x', { nivel: 20 })) === null, 'desiste depois do teto — nao sobe a arvore inteira');

  /**
   * **Degrada, nunca estoura.** As entranhas do React nao sao contrato publico, e o pacote da
   * plataforma e publicado o tempo todo (o hash mudou entre duas medicoes do mesmo dia). Sem a
   * chave, sem conversa, com `null`: a resposta e "nao sei", e quem chama cai na reserva.
   */
  check(conversaDoNo({ tagName: 'BUTTON', textContent: 'sem react' }) === null, 'no sem fiber devolve null');
  check(conversaDoNo(null) === null, 'no nenhum devolve null');
  check(conversaDoNo(linhaFalsa(null, 'x')) === null, 'fiber sem conversa devolve null');
  check(conversaDoNo(linhaFalsa({ nome: 'Sem id' }, 'x')) === null, 'conversa SEM id nao serve: a identidade e o id');
}

grupo('achar a linha: por ID e identidade, por NOME e palpite');
{
  const a = { id: 'c-1', nome: 'Marta Fictinha' };
  const b = { id: 'c-2', nome: 'Jose Exemplo' };
  const raiz = raizCom([
    linhaFalsa(a, 'MFMarta Fictinha16:09Boa tarde'),
    linhaFalsa(b, 'JEJose Exemplo15:02Bora'),
  ]);

  const achada = acharLinha('c-2', { raiz });
  check(achada?.por === 'id', 'achou pelo id');
  check(achada?.conversa?.nome === 'Jose Exemplo', 'e trouxe a conversa junto');

  /**
   * **O caso COMUM, e ele nao e erro:** medido na pagina dele, 69 linhas no DOM para 100 na
   * consulta — e a fila de verdade tem centenas. Quem chama diz "nao esta na tela" e a conversa
   * continua legivel dentro do painel.
   */
  check(acharLinha('c-404', { raiz }) === null, 'conversa que nao esta na tela devolve null');
  check(acharLinha('', { raiz }) === null, 'sem id nao procura nada');
}

grupo('a reserva por nome, e por que ela avisa');
{
  // Sem o fiber (o React mudou as chaves internas): so sobra o texto.
  const semFiber = (texto) => ({ tagName: 'BUTTON', textContent: texto, cliques: 0, click() { this.cliques++; }, scrollIntoView() {} });
  const raiz = raizCom([semFiber('MFMarta Fictinha16:09Boa tarde'), semFiber('JEJose Exemplo15:02Bora')]);

  const r = acharLinha('c-1', { nome: 'Marta Fictinha', raiz });
  check(r?.por === 'nome', 'sem fiber, cai na reserva');
  check(r?.conversa === null, 'e a reserva NAO afirma qual conversa e — ela so achou um texto parecido');

  /**
   * **Empate nao vira escolha.** Nome repetido e comum nesta base, e abrir a conversa errada e ele
   * conferir a mensagem de uma pessoa e apertar a tecla que responde a outra.
   */
  const duasMartas = raizCom([semFiber('Marta Fictinha16:09oi'), semFiber('Marta Fictinha14:00tudo bem')]);
  check(acharLinha('c-1', { nome: 'Marta Fictinha', raiz: duasMartas }) === null, 'duas linhas com o mesmo nome: nao escolhe nenhuma');

  check(acharLinha('c-1', { raiz }) === null, 'sem nome, a reserva nem roda');
  check(acharLinha('c-1', { nome: 'M', raiz }) === null, 'nome de uma letra nao casa: casaria em quase tudo');

  check(linhaParece(semFiber('Marta Fictinha16:09'), { nome: 'márta fictínha' }), 'acento e caixa nao atrapalham');
  check(textoDaLinha(semFiber('  Marta   Fictinha  ')) === 'marta fictinha', 'o texto e normalizado');
}

grupo('abrir: clica e PARA AI');
{
  const c = { id: 'c-1', nome: 'Marta Fictinha' };
  const no = linhaFalsa(c, 'MFMarta Fictinha16:09Boa tarde');
  const raiz = raizCom([no]);

  const r = abrirConversa('c-1', { raiz });
  check(r.ok === true && r.por === 'id', 'abriu, e disse que foi por identidade');
  check(no.cliques === 1, 'um clique, na linha certa');
  check(no.rolou === 1, 'e rolou ate ela antes — abrir fora da vista nao mostra nada');

  /**
   * **A fronteira:** a extensao poe a conversa na frente dele e para. Marcar lida, assumir ou
   * digitar sao atos que mudam o atendimento, e quem decide e ele. E a mesma linha do `Ocultar`
   * no painel do Facebook, que clica e nao confirma dialogo nenhum.
   */
  const metodos = Object.keys(no).filter((k) => typeof no[k] === 'function');
  check(metodos.length === 2 && metodos.includes('click'), 'o no falso so precisou de click e scrollIntoView: nada mais foi chamado');

  const vazio = abrirConversa('c-404', { raiz });
  check(vazio.ok === false && vazio.motivo === 'nao-esta-na-tela', 'nao estando na tela, diz o motivo em vez de estourar');
}

grupo('a aba da lista: Todas e Minhas, e a linha de conversa nao e aba');
{
  const botao = (texto) => ({ textContent: texto, cliques: 0, click() { this.cliques++; } });
  const todas = botao('Todas 728');
  const minhas = botao('Minhas 1');
  const pessoa = botao('Caxias do Sul - Kika 13:28 Sem mensagens');
  const raiz = raizCom([todas, minhas, pessoa]);

  const r = clicarAbaDaFila('Todas', raiz);
  check(r.ok === true && todas.cliques === 1, 'clica em Todas, que e onde os nao atendidos estao');
  check(minhas.cliques === 0 && pessoa.cliques === 0, 'e nao clica na outra aba nem numa conversa');

  const outra = clicarAbaDaFila('Minhas', raiz);
  check(outra.ok === true && minhas.cliques === 1, 'Minhas e a aba dos que ele ja assumiu');

  const sumiu = clicarAbaDaFila('Todas', raizCom([pessoa]));
  check(sumiu.ok === false && sumiu.motivo === 'aba-ausente', 'sem a aba na tela, diz que nao achou em vez de clicar numa conversa');
}

grupo('Assumir e o botao, e o aviso "Assuma para responder" nao e');
{
  const botao = (texto) => ({ textContent: texto, cliques: 0, click() { this.cliques++; } });
  const doCabecalho = botao('Assumir');
  const doRodape = botao('Assumir');
  const aviso = botao('Assuma para responder');
  const resolver = botao('Resolver');
  const r = clicarAssumir(raizCom([doCabecalho, doRodape, aviso, resolver]));
  check(r.ok === true && doCabecalho.cliques === 1, 'clica no Assumir da tela');
  check(doRodape.cliques === 0 && aviso.cliques === 0 && resolver.cliques === 0, 'um so, e nem o aviso nem o Resolver');
  const sem = clicarAssumir(raizCom([aviso]));
  check(sem.ok === false && sem.motivo === 'sem-botao', 'sem o botao, nao clica no aviso');
}

grupo('QUAL conversa esta aberta: dois sinais que tem de concordar');
{
  /**
   * Na plataforma velha quem respondia isso era o `dom.js`, lendo o cabecalho do atendimento. Aqui
   * **a conversa aberta nao esta na URL** (424 rotas conferidas: `/admin/interacoes/conversas`, sem
   * `/:id`), e o unico lugar onde a resposta existe e o estado do React.
   *
   * Medido na pagina dele: a LINHA marcada `ativa` e o PAINEL da direita apontaram para o mesmo id,
   * e juntos custam **menos de 1 ms** (0,19 + 0,75). Por isso usamos os dois.
   */
  const linha = (conversa, ativa) => {
    const no = { tagName: 'BUTTON', textContent: conversa.nome || '' };
    no['__reactFiber$k'] = { memoizedProps: { conversa, ativa }, return: null };
    return no;
  };
  const painel = (conversa) => {
    const no = { tagName: 'DIV' };
    no['__reactFiber$k'] = {
      memoizedProps: { conversa, onStatusChange() {}, onClose() {}, analise: null },
      return: null,
    };
    return no;
  };
  const tela = (botoes, divs) => ({
    querySelectorAll: (sel) => (sel === 'div' ? divs : botoes),
  });

  const a = { id: 'c-1', nome: 'Marta Fictinha', numero: '5551999990000' };
  const b = { id: 'c-2', nome: 'Jose Exemplo' };

  const osDois = conversaAberta({ raiz: tela([linha(a, true), linha(b, false)], [painel(a)]) });
  check(osDois?.conversa?.id === 'c-1', 'os dois sinais concordando: e esta');
  check(osDois?.por === 'os-dois', 'e o painel sabe que foi por dois sinais');

  /**
   * **Discordando, nao se afirma nada.** A tela esta num estado que ninguem mediu, e afirmar a
   * errada e ele conferir a mensagem de uma pessoa e apertar a tecla que responde a outra.
   */
  check(conversaAberta({ raiz: tela([linha(a, true)], [painel(b)]) }) === null, 'sinais discordando: devolve NADA');

  const soPainel = conversaAberta({ raiz: tela([linha(a, false)], [painel(a)]) });
  check(soPainel?.por === 'so-um-sinal', 'so o painel: responde, mas avisa que foi um sinal so');

  const soLista = conversaAberta({ raiz: tela([linha(a, true)], []) });
  check(soLista?.por === 'so-um-sinal', 'so a lista: idem');

  check(conversaAberta({ raiz: tela([linha(a, false)], []) }) === null, 'nada aberto devolve null');

  /** Duas ativas ao mesmo tempo nao sao verdade nenhuma. */
  check(linhaAtiva([linha(a, true), linha(b, true)]) === null, 'duas linhas ativas: nenhuma vale');
  check(linhaAtiva([linha(a, true)])?.id === 'c-1', 'uma ativa vale');
  check(linhaAtiva([]) === null, 'lista vazia, null');

  /**
   * O painel da direita e reconhecido pela ASSINATURA das props, nao por classe: as classes sao
   * Tailwind geradas e mudam com o tema e com cada publicacao.
   */
  check(painelDaConversa([painel(a)])?.id === 'c-1', 'acha o painel pela assinatura das props');
  const quaseo = { tagName: 'DIV' };
  quaseo['__reactFiber$k'] = { memoizedProps: { conversa: a, onClose() {} }, return: null };
  check(painelDaConversa([quaseo]) === null, 'no que tem conversa mas nao a assinatura inteira nao conta');

  check(propsDoFiber(linha(a, true)).length === 1, 'a cadeia de props e lida do no para cima');
  check(propsDoFiber({ tagName: 'DIV' }).length === 0, 'no sem fiber devolve cadeia vazia');
}

// ---------------------------------------------------------------------------
// O CAMPO DE MENSAGEM
// ---------------------------------------------------------------------------

/**
 * Um campo como os da tela. O `value` vive no PROTOTIPO, que e onde o setter nativo mora de
 * verdade — e por isso `setterNativo` o acha por `getPrototypeOf` e nao por `instanceof`.
 */
function campoFalso({ placeholder = '', aria = '', editavel = false, w = 300, h = 40, disabled = false, readOnly = false } = {}) {
  const proto = {
    get value() { return this._v; },
    set value(v) { this._v = String(v); this._escritas = (this._escritas || 0) + 1; },
  };
  const el = Object.create(proto);
  Object.assign(el, {
    _v: '',
    _escritas: 0,
    eventos: [],
    focos: 0,
    placeholder,
    disabled,
    readOnly,
    isContentEditable: editavel,
    textContent: '',
    getAttribute: (n) => (n === 'aria-label' ? aria : null),
    getBoundingClientRect: () => ({ width: w, height: h }),
    focus() { this.focos++; },
    dispatchEvent(ev) { this.eventos.push(ev?.type || String(ev)); return true; },
  });
  return el;
}

function telaDeCampos(campos) {
  return { querySelectorAll: () => campos };
}

/** A tela MEDIDA em 27/10/2026 numa conversa `aberto`: dois textarea de anotacao, nada mais. */
function telaMedidaSemAssumir() {
  return telaDeCampos([
    campoFalso({ placeholder: 'Nota interna da conversa (só a equipe vê)...' }),
    campoFalso({ placeholder: 'Anotações sobre este contato... (salva automaticamente 1s após parar de digitar)' }),
  ]);
}

grupo('o campo de mensagem NAO e "o primeiro textarea da tela"');
{
  /**
   * **A fixture e a medicao, e e ela que trava o defeito de verdade.** O gancho devolvia `true`
   * aqui, e como esta leitura VENCE o `status` em `page-mob.estadoDaConversa`, ele afirmava campo
   * de mensagem em TODA conversa aberta.
   */
  const semAssumir = telaMedidaSemAssumir();
  check(campoDeMensagem({ raiz: semAssumir }) === null, 'os dois textarea de ANOTACAO nao sao o campo de mensagem');
  check(temCampoDeMensagem({ raiz: semAssumir }) === null, 'e a resposta e "nao sei", para quem chama cair no status');

  const comCampo = telaDeCampos([
    campoFalso({ placeholder: 'Nota interna da conversa (só a equipe vê)...' }),
    campoFalso({ placeholder: 'Digite uma mensagem...' }),
  ]);
  check(campoDeMensagem({ raiz: comCampo })?.placeholder === 'Digite uma mensagem...', 'com o campo na tela, acha ele e nao a nota');
  check(temCampoDeMensagem({ raiz: comCampo }) === true, 'e ai afirma');

  check(temCampoDeMensagem({ raiz: telaDeCampos([]) }) === false, 'tela sem nada editavel: false — nao ha o que digitar, ponto');

  /**
   * **TRES estados, nunca dois** (a licao do `donoDoCanal`, 25/09). O terceiro e o que faz isto
   * envelhecer bem: mudando a redacao do placeholder, a tela para de AFIRMAR em vez de dizer "nao
   * da para digitar" numa conversa que ele acabou de assumir.
   */
  const redacaoNova = telaDeCampos([campoFalso({ placeholder: 'Escreva aqui...' })]);
  check(temCampoDeMensagem({ raiz: redacaoNova }) === null, 'placeholder que mudou de redacao devolve "nao sei", nunca false');

  check(ehCampoDeMensagem(campoFalso({ aria: 'Caixa de mensagem' })) === true, 'o aria-label tambem responde');
  check(ehCampoDeMensagem(campoFalso({ placeholder: 'MENSAGEM' })) === true, 'caixa nao importa');
  check(ehCampoDeMensagem(campoFalso({ placeholder: 'Nota da mensagem interna' })) === false, 'texto que fala de NOTA fica fora mesmo citando mensagem');
  check(ehCampoDeMensagem(campoFalso({ placeholder: 'Anotação da mensagem' })) === false, 'e "anotacao" tambem, com acento ou sem');

  /** Contenteditable na conversa e o campo: as duas anotacoes medidas sao `textarea`. */
  check(ehCampoDeMensagem(campoFalso({ editavel: true })) === true, 'contenteditable conta sem precisar de rotulo');

  check(ehCampoDeMensagem(campoFalso({ placeholder: 'mensagem', disabled: true })) === false, 'campo desabilitado nao conta');
  check(ehCampoDeMensagem(campoFalso({ placeholder: 'mensagem', readOnly: true })) === false, 'nem campo somente-leitura');
  check(ehCampoDeMensagem(campoFalso({ placeholder: 'mensagem', w: 0, h: 0 })) === false, 'nem campo com tamanho zero');
  check(ehCampoDeMensagem(null) === false, 'nada nao e campo');

  /**
   * **A caixa de busca fica de fora por CONSTRUCAO, e e isso que mantem o estado `false` vivo:**
   * ela e um `<input>`, e a lista so olha textarea e contenteditable. Incluindo `input`,
   * `camposEditaveis` nunca viria vazia (a busca esta sempre na tela) e "nao ha o que digitar"
   * deixaria de existir.
   */
  const sel = [];
  camposEditaveis({ querySelectorAll: (s) => { sel.push(s); return []; } });
  check(sel.length === 1 && !/(^|[\s,])input/.test(sel[0]), 'o seletor NAO pede `input` — senao a busca da tela mataria o estado "false"');
  check(/textarea/.test(sel[0]) && /contenteditable/.test(sel[0]), 'pede textarea e contenteditable');
}

grupo('escrever no campo: o setter nativo, e a RELEITURA como prova');
{
  const jaFoi = globalThis.Event;
  globalThis.Event = class { constructor(t, o = {}) { this.type = t; Object.assign(this, o); } };

  const campo = campoFalso({ placeholder: 'Digite uma mensagem...' });
  const r = await escreverNoCampo('bom dia', { raiz: telaDeCampos([campo]), esperar: async () => {} });
  check(r.ok === true, 'escreveu');
  check(lerCampo(campo) === 'bom dia', 'e o texto ficou la');
  check(campo.focos === 1, 'focou o campo antes');
  check(campo.eventos.includes('input'), 'e disparou `input` — sem ele o React nao atualiza o estado e o botao de enviar fica morto');

  /**
   * **A RELEITURA E A MEDICAO.** Campo controlado por React que nao reconheceu a escrita devolve o
   * valor antigo no proximo desenho: o texto aparece e some. Simulado aqui pelo `esperar`, que e
   * exatamente a janela em que o React redesenha.
   */
  const apagado = campoFalso({ placeholder: 'Digite uma mensagem...' });
  const rApagou = await escreverNoCampo('bom dia', {
    raiz: telaDeCampos([apagado]),
    esperar: async () => { apagado._v = ''; },
  });
  check(rApagou.ok === false && rApagou.motivo === 'apagou', 'React que apaga o texto NAO conta como escrito');

  const trocado = campoFalso({ placeholder: 'Digite uma mensagem...' });
  const rTrocou = await escreverNoCampo('bom dia', {
    raiz: telaDeCampos([trocado]),
    esperar: async () => { trocado._v = 'outra coisa'; },
  });
  check(rTrocou.ok === false && rTrocou.motivo === 'ficou-diferente', 'e texto que ficou diferente tambem nao');

  const semCampo = await escreverNoCampo('bom dia', { raiz: telaMedidaSemAssumir(), esperar: async () => {} });
  check(semCampo.ok === false && semCampo.motivo === 'sem-campo', 'sem campo de mensagem, nao escreve em anotacao nenhuma');

  /** Texto vazio e pedido legitimo: e assim que o painel LIMPA o campo. */
  const limpar = campoFalso({ placeholder: 'Digite uma mensagem...' });
  limpar._v = 'sobra';
  const rLimpou = await escreverNoCampo('', { raiz: telaDeCampos([limpar]), esperar: async () => {} });
  check(rLimpou.ok === true && lerCampo(limpar) === '', 'texto vazio limpa o campo, e isso conta como sucesso');

  globalThis.Event = jaFoi;
}

grupo('contenteditable: insertText, e a releitura vale igual');
{
  const docAntes = globalThis.document;
  const chamadas = [];
  const caixa = campoFalso({ editavel: true });
  globalThis.document = {
    execCommand(cmd, _ui, valor) {
      chamadas.push(cmd);
      if (cmd === 'selectAll') caixa.textContent = '';
      if (cmd === 'insertText') caixa.textContent = String(valor);
      return true;
    },
  };

  const r = await escreverNoCampo('bom dia', { raiz: telaDeCampos([caixa]), esperar: async () => {} });
  check(r.ok === true, 'escreveu no contenteditable');
  check(chamadas[0] === 'selectAll' && chamadas[1] === 'insertText', 'limpa a selecao antes — escrever ACRESCENTA, senao o texto velho fica junto');
  check(lerCampo(caixa) === 'bom dia', 'e o que ficou la e o textContent');

  globalThis.document = docAntes;
}

grupo('O ATO DE ENVIAR: apagar o texto NAO e enviar');
{
  /**
   * **Relato dele (29/10/2026):** *"o texto foi pro box de conversa, eu olhei e vi que estava
   * errado, apaguei, e a automacao pulou ou concluiu; o gatilho continua errado, eu nao dei enter
   * ou clickei pra enviar"*.
   *
   * O modo *"Eu mando"* dava a mensagem por enviada quando o campo ESVAZIAVA — invariante certo
   * numa direcao e vazio na outra: a plataforma limpa a caixa ao enviar, e **apagar esvazia
   * igual**. O que isto trava e o gatilho novo: os DOIS atos que ele nomeou, e nada alem deles.
   */
  const ouvintes = new Map();
  const onde = { addEventListener: (tipo, fn) => ouvintes.set(tipo, fn) };

  const campo = campoFalso({ placeholder: 'Mensagem' });
  const botao = { tag: 'button' };
  const fora = { tag: 'button' };
  const linhaDoCampo = { contains: (n) => n === campo || n === botao };
  campo.parentElement = linhaDoCampo;
  linhaDoCampo.contains = (n) => n === campo || n === botao;

  const raiz = telaDeCampos([campo]);
  const alvoQueFecha = (el, dono) => ({ ...el, closest: (sel) => (sel.includes('button') ? dono : null) });

  esquecerEnvio();
  check(vigiarEnvio({ raiz, onde }) === true, 'liga os dois ouvintes');
  check(vigiarEnvio({ raiz, onde }) === true && ouvintes.size === 2,
    'e e idempotente — uma rodada de centenas nao empilha ouvinte por contato');
  check(ultimoAtoDeEnvio().em === 0, 'e comeca sem ato nenhum');

  const teclar = (ev) => ouvintes.get('keydown')(ev);
  const clicar = (ev) => ouvintes.get('click')(ev);

  /** **APAGAR nao produz ato nenhum** — e esta e a assercao que fecha a print dele. */
  teclar({ isTrusted: true, key: 'Backspace', target: campo });
  teclar({ isTrusted: true, key: 'a', ctrlKey: true, target: campo });
  teclar({ isTrusted: true, key: 'Delete', target: campo });
  check(ultimoAtoDeEnvio().em === 0, 'apagar o texto NAO conta como enviar');

  /** **Shift+Enter e quebra de linha**, nao envio. */
  teclar({ isTrusted: true, key: 'Enter', shiftKey: true, target: campo });
  check(ultimoAtoDeEnvio().em === 0, 'Shift+Enter e quebra de linha, nao envio');

  /** **`isTrusted` e a licao de 07/09: a propria extensao despacha teclado na pagina.** */
  teclar({ isTrusted: false, key: 'Enter', target: campo });
  check(ultimoAtoDeEnvio().em === 0, 'e o Enter que a EXTENSAO despacha nao conta');

  /** Enter numa anotacao nao e envio: o alvo tem de ser o campo de MENSAGEM. */
  teclar({ isTrusted: true, key: 'Enter', target: campoFalso({ placeholder: 'Nota interna da conversa' }) });
  check(ultimoAtoDeEnvio().em === 0, 'nem o Enter numa anotacao');

  teclar({ isTrusted: true, key: 'Enter', target: campo });
  check(ultimoAtoDeEnvio().em > 0 && /Enter/.test(ultimoAtoDeEnvio().como), 'o Enter DELE no campo conta');

  /** **O clique tem de ser num botao PERTO do campo** — senao "Resolver" contaria como envio. */
  esquecerEnvio();
  vigiarEnvio({ raiz, onde });
  clicar({ isTrusted: true, target: alvoQueFecha({}, fora) });
  check(ultimoAtoDeEnvio().em === 0, 'botao longe do campo (Resolver, Transferir) NAO e envio');

  clicar({ isTrusted: true, target: alvoQueFecha({}, botao) });
  check(ultimoAtoDeEnvio().em > 0 && /clique/.test(ultimoAtoDeEnvio().como), 'e o botao ao lado do campo conta');

  /** Clique dentro do painel nunca conta: o `ev.target` de um shadow root chega como o host. */
  esquecerEnvio();
  vigiarEnvio({ raiz, onde });
  clicar({ isTrusted: true, target: { closest: (sel) => (sel.includes('whatsfill-host') ? {} : botao) } });
  check(ultimoAtoDeEnvio().em === 0, 'clique dentro do painel nao conta como envio');
}

fim();
