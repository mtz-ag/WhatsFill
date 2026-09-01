/**
 * fluxo.js — a janela do fluxo de atendimento, agora uma ÁRVORE.
 *
 * ## De onde veio este formato
 *
 * Ele desenhou o fluxo num quadro (01/09/2026) e mandou a foto: *"esse é o exemplo que eu estava
 * pensando, está incompleto ainda o fluxo, ele precisa ser incrementado de acordo com a demanda"*.
 * O desenho não é uma cascata que se lê de cima para baixo — é uma árvore que ramifica por
 * SITUAÇÃO ("anúncio, pessoa nova" de um lado, "pessoa retornando" do outro) e só depois por tipo
 * de mensagem, até a ação.
 *
 * A frase que decide o desenho da tela é a segunda: **o fluxo cresce**. Por isso a árvore é
 * desenhada como esquema indentado com cotovelo, e não como o leque horizontal do quadro: o leque
 * dele já ocupava 1800px com 18 nós, e "incrementado de acordo com a demanda" quer dizer o dobro
 * disso em um mês. Indentado, cresce para baixo, que é onde a tela tem espaço.
 *
 * ## O que ele pode montar sozinho, e o que não
 *
 * Escolha dele entre as três que ofereci: a condição de um ramo é **um sinal da lista** (coisas que
 * o código já reconhece, todas com teste) **e/ou palavras que ele digita**. Nunca uma expressão
 * escrita na hora. A ação é uma tecla ou uma resposta pronta. É o que tira o gargalo — ele
 * acrescenta o ramo quando a situação aparece — sem deixar o que sai para eleitor depender de uma
 * condição sem teste.
 *
 * ## A trava que faz isto ser seguro de ligar
 *
 * A árvore nasce sendo a tabela de hoje achatada, e há teste exigindo que as duas decidam igual em
 * 400 contextos (`tests/arvore.test.mjs`). Abrir esta janela, portanto, não muda a rodada. O que
 * muda é o que ele montar depois — e a tela diz, em cima, quando a árvore já não é mais a padrão.
 */

import * as store from './lib/store.js';
import * as sugestaoLib from './lib/sugestao.js';
import * as arvoreLib from './lib/arvore.js';
import {
  semInteresse,
  conversaPedeRespostaPessoal,
  ultimaEhDespedida,
  ultimaEhSoReacao,
  conversaTemPerguntaAberta,
  soExpressaApoio,
  pedeAlgoIndefinido,
  rajadaEhSoRepasse,
  confirmaPresenca,
} from './lib/cortesia.js';

const TECLAS = Object.entries(sugestaoLib.TECLAS).map(([k, v]) => [k, v.rotulo]);

const SELO = {
  envia: 'sai mensagem',
  silencio: 'não sai nada',
  gente: 'precisa de você',
  depende: 'depende',
};

const el = (id) => document.getElementById(id);

let fluxo = { ordem: [], desligadas: [], teclas: {}, vitorias: {}, arvore: null };
/** As respostas prontas, para o menu de ação. Só o id e o nome interessam aqui. */
let respostas = [];
/** O nó com o editor aberto. Um por vez: dezoito formulários abertos é tela ilegível. */
let editando = null;
/** O caminho que venceu no último teste, para acender os nós percorridos. */
let caminhoDoTeste = [];

async function salvarArvore(nova) {
  fluxo = { ...fluxo, arvore: nova };
  await store.set('fluxo', fluxo);
  desenhar();
}

function span(classe, texto) {
  const s = document.createElement('span');
  if (classe) s.className = classe;
  s.textContent = texto;
  return s;
}

function botao(rotulo, titulo, aoClicar, classe) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = classe || 'mini';
  b.textContent = rotulo;
  b.title = titulo;
  b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    aoClicar();
  });
  return b;
}

/** Um `<select>` com opções `[valor, rótulo]`. */
function seletor(opcoes, valorAtual, aoMudar) {
  const s = document.createElement('select');
  for (const [valor, rotulo] of opcoes) {
    const o = document.createElement('option');
    o.value = valor;
    o.textContent = rotulo;
    if (valor === (valorAtual || '')) o.selected = true;
    s.append(o);
  }
  s.addEventListener('change', () => aoMudar(s.value));
  return s;
}

/** O efeito (a cor) do desfecho deste nó: é o que o eleitor recebe. */
function efeitoDoNo(no) {
  if (no.regra) return sugestaoLib.efeitoDaRegra(no.regra, fluxo);
  if (no.acao?.resposta) return 'envia';
  if (no.acao?.tecla) return sugestaoLib.TECLAS[no.acao.tecla]?.efeito || 'depende';
  return null; // não decide: é uma porta, não um desfecho
}

/** A condição em português, para a linha de resumo do nó. */
function condicaoEmPortugues(no) {
  if (no.regra) return sugestaoLib.SOBRE[no.regra]?.quando || '';
  const cond = no.condicao || {};
  const partes = [];
  const sinal = arvoreLib.SINAIS.find((s) => s.id === cond.sinal);
  if (sinal) partes.push(cond.negar ? sinal.nao : sinal.rotulo);
  if ((cond.palavras || []).length) {
    const onde = cond.onde === 'qualquer' ? 'em qualquer mensagem' : 'na última mensagem';
    partes.push(`escreveu "${cond.palavras.join('", "')}" ${onde}`);
  }
  return partes.length ? partes.join(' E ') : 'sem condição — casa sempre';
}

/** O desfecho em português. */
function acaoEmPortugues(no) {
  if (no.regra) {
    const ramos = sugestaoLib.ramosDaRegra(no.regra, fluxo);
    if (!ramos.length) return 'sem desfecho';
    return ramos.map((r) => `tecla ${r.tecla} · ${r.rotulo}${r.se ? ` (se ${r.se})` : ''}`).join('  ou  ');
  }
  if (no.acao?.resposta) {
    const t = respostas.find((r) => r.id === no.acao.resposta);
    return `manda "${t?.name || no.acao.resposta}" e conclui`;
  }
  if (no.acao?.tecla) return `tecla ${no.acao.tecla} · ${sugestaoLib.TECLAS[no.acao.tecla]?.rotulo || '?'}`;
  return null;
}

// ---- o editor de um nó ------------------------------------------------------

/**
 * O formulário do nó, aberto sob demanda.
 *
 * Um por vez de propósito: com dezoito nós na tela, dezoito formulários abertos deixam de ser um
 * mapa e viram um formulário gigante — e o mapa é o que ele pediu.
 */
function editorDoNo(no) {
  const caixa = document.createElement('div');
  caixa.className = 'editor';

  const linha = (rotulo, campo) => {
    const l = document.createElement('label');
    l.className = 'campo';
    l.append(span('campo-rot', rotulo), campo);
    caixa.append(l);
    return l;
  };

  const nome = document.createElement('input');
  nome.type = 'text';
  nome.value = no.rotulo || '';
  nome.addEventListener('change', () => salvarArvore(arvoreLib.editar(fluxo.arvore, no.id, { rotulo: nome.value.trim() || 'ramo sem nome' })));
  linha('Nome do ramo', nome);

  if (no.regra) {
    /**
     * Nó respaldado por regra do código: a condição NÃO se edita aqui.
     *
     * É o que preserva os testes das dezesseis regras — e a condição é o que decide o que sai
     * para eleitor. O que ele pode fazer é trocar a TECLA, desligar, mover, e pendurar ramos mais
     * específicos dentro.
     */
    const aviso = document.createElement('p');
    aviso.className = 'nota';
    aviso.textContent = 'A condição deste ramo vem do código e tem teste — por isso não se edita aqui. Você pode trocar o desfecho, desligar, mover, e pendurar ramos mais específicos dentro dele.';
    caixa.append(aviso);

    const daRegra = sugestaoLib.REGRAS.find((r) => r.id === no.regra);
    const padrao = typeof daRegra?.tecla === 'function' ? 'dois desfechos, conforme o contexto' : `tecla ${daRegra?.tecla}`;
    linha(
      'Desfecho',
      seletor(
        [['', `o do código (${padrao})`], ...TECLAS.map(([k, t]) => [k, `${k} · ${t}`])],
        fluxo.teclas?.[no.regra] || '',
        (valor) => {
          const teclas = { ...(fluxo.teclas || {}) };
          if (valor) teclas[no.regra] = valor;
          else delete teclas[no.regra];
          fluxo = { ...fluxo, teclas };
          store.set('fluxo', fluxo).then(desenhar);
        }
      )
    );
    return caixa;
  }

  const cond = no.condicao || {};
  const trocarCond = (mudanca) =>
    salvarArvore(arvoreLib.editar(fluxo.arvore, no.id, { condicao: { ...cond, ...mudanca } }));

  linha(
    'Quando o contato…',
    seletor(
      [['', '— qualquer contato (é só um agrupamento) —'], ...arvoreLib.SINAIS.map((s) => [s.id, s.rotulo])],
      cond.sinal || '',
      (valor) => trocarCond({ sinal: valor })
    )
  );

  if (cond.sinal) {
    const inverter = document.createElement('label');
    inverter.className = 'chk';
    const c = document.createElement('input');
    c.type = 'checkbox';
    c.checked = !!cond.negar;
    c.addEventListener('change', () => trocarCond({ negar: c.checked }));
    const sinal = arvoreLib.SINAIS.find((s) => s.id === cond.sinal);
    inverter.append(c, span('', `ao contrário: ${sinal?.nao || 'não'}`));
    caixa.append(inverter);
  }

  const palavras = document.createElement('input');
  palavras.type = 'text';
  palavras.placeholder = 'bom dia, boa tarde, boa noite';
  palavras.value = (cond.palavras || []).join(', ');
  palavras.addEventListener('change', () =>
    trocarCond({ palavras: palavras.value.split(',').map((p) => p.trim()).filter(Boolean) })
  );
  linha('E escreveu (separe por vírgula; acento e maiúscula não importam)', palavras);

  linha(
    'Procurar essas palavras',
    seletor(
      [
        ['ultima', 'só na última mensagem dela (recomendado)'],
        ['qualquer', 'em qualquer mensagem da conversa'],
      ],
      cond.onde || 'ultima',
      (valor) => trocarCond({ onde: valor })
    )
  );

  const acao = no.acao || {};
  linha(
    'Então…',
    seletor(
      [
        ['', '— nada: este ramo só agrupa outros —'],
        ...TECLAS.map(([k, t]) => [`t:${k}`, `tecla ${k} · ${t}`]),
        ...respostas.map((r) => [`r:${r.id}`, `mandar "${r.name}" e concluir`]),
      ],
      acao.resposta ? `r:${acao.resposta}` : acao.tecla ? `t:${acao.tecla}` : '',
      (valor) => {
        const nova = !valor
          ? null
          : valor.startsWith('r:')
            ? { tecla: null, resposta: valor.slice(2) }
            : { tecla: valor.slice(2), resposta: null };
        salvarArvore(arvoreLib.editar(fluxo.arvore, no.id, { acao: nova }));
      }
    )
  );

  return caixa;
}

// ---- desenho da árvore ------------------------------------------------------

function cartaoDoNo(no, nivel, indice, total) {
  const efeito = efeitoDoNo(no);
  const linha = document.createElement('div');
  linha.className = `no-linha${no.desligado ? ' off' : ''}${caminhoDoTeste.includes(no.id) ? ' no-caminho' : ''}`;
  linha.style.setProperty('--nivel', String(nivel));

  const card = document.createElement('div');
  card.className = `no-card ${efeito || 'porta'}`;

  // ---- cabeçalho ----
  const topo = document.createElement('div');
  topo.className = 'no-topo';
  const nome = document.createElement('b');
  nome.textContent = no.rotulo || '(sem nome)';
  topo.append(nome);
  if (efeito) topo.append(span(`selo ${efeito}`, SELO[efeito]));
  else topo.append(span('selo porta', 'só agrupa'));
  if (no.regra) topo.append(span('marca-regra', 'regra do código'));

  const vitorias = Number(fluxo.vitorias?.[no.id] || fluxo.vitorias?.[no.regra] || 0);
  if (vitorias) topo.append(span('venceu', `venceu ${vitorias}×`));

  // ---- resumo ----
  const corpo = document.createElement('div');
  corpo.className = 'no-corpo';
  corpo.append(span('quando', condicaoEmPortugues(no)));
  const desfecho = acaoEmPortugues(no);
  if (desfecho) corpo.append(span('entao', `→ ${desfecho}`));
  else if (!(no.filhos || []).length) corpo.append(span('entao vazio', '→ não faz nada ainda; o fluxo segue para os ramos de baixo'));

  // ---- controles ----
  const acoes = document.createElement('div');
  acoes.className = 'no-acoes';
  acoes.append(
    botao('✎', 'Editar este ramo', () => {
      editando = editando === no.id ? null : no.id;
      desenhar();
    }),
    botao('+', 'Criar um ramo DENTRO deste', () => {
      const novo = arvoreLib.noVazio('ramo novo');
      editando = novo.id;
      salvarArvore(arvoreLib.acrescentar(fluxo.arvore, no.id, novo));
    }),
    botao('↑', 'Subir (mais prioridade que os irmãos)', () => salvarArvore(arvoreLib.mover(fluxo.arvore, no.id, -1))),
    botao('↓', 'Descer', () => salvarArvore(arvoreLib.mover(fluxo.arvore, no.id, 1))),
    botao('⇥', 'Pôr dentro do ramo de cima', () => salvarArvore(arvoreLib.aninhar(fluxo.arvore, no.id))),
    botao('⇤', 'Tirar de dentro do ramo pai', () => salvarArvore(arvoreLib.desaninhar(fluxo.arvore, no.id)))
  );

  const liga = document.createElement('label');
  liga.className = 'chk';
  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.checked = !no.desligado;
  chk.title = 'Ligado';
  chk.addEventListener('change', () => salvarArvore(arvoreLib.editar(fluxo.arvore, no.id, { desligado: !chk.checked })));
  liga.append(chk);
  acoes.append(liga);

  acoes.append(
    botao(
      '✕',
      'Apagar este ramo',
      () => {
        const dentro = arvoreLib.todosOsNos([no]).length - 1;
        // O aviso diz quantos vão junto: apagar leva os filhos, e promover os filhos os soltaria
        // numa condição que não é mais a deles.
        const texto = dentro
          ? `Apagar "${no.rotulo}" e os ${dentro} ramos que estão dentro dele?`
          : `Apagar "${no.rotulo}"?`;
        if (confirm(texto)) salvarArvore(arvoreLib.apagar(fluxo.arvore, no.id));
      },
      'mini perigo'
    )
  );

  card.append(topo, corpo, acoes);
  if (editando === no.id) card.append(editorDoNo(no));

  // A posição entre os irmãos é a prioridade, e é a informação que faz o mapa ser um fluxo.
  const pos = span('no-pos', `${indice + 1}/${total}`);
  linha.append(pos, card);
  return linha;
}

function desenharNos(nos, nivel, alvo) {
  (nos || []).forEach((no, i) => {
    alvo.append(cartaoDoNo(no, nivel, i, nos.length));
    if ((no.filhos || []).length) desenharNos(no.filhos, nivel + 1, alvo);
  });
}

function desenharProblemas() {
  const caixa = el('problemas');
  caixa.replaceChildren();
  const lista = arvoreLib.problemas(fluxo.arvore || []);
  caixa.classList.toggle('tem', lista.length > 0);
  for (const p of lista) caixa.append(span('problema', p));
}

function desenharResumo() {
  const caixa = el('contagem');
  caixa.replaceChildren();
  const todos = arvoreLib.todosOsNos(fluxo.arvore || []);
  const c = { envia: 0, silencio: 0, gente: 0, depende: 0, porta: 0, off: 0 };
  for (const { no } of todos) {
    if (no.desligado) c.off++;
    else c[efeitoDoNo(no) || 'porta']++;
  }
  const par = (classe, texto) => caixa.append(span(classe, texto));
  par('c-envia', `${c.envia} enviam mensagem`);
  par('c-silencio', `${c.silencio} não enviam`);
  par('c-gente', `${c.gente} precisam de você`);
  if (c.depende) par('c-depende', `${c.depende} com dois desfechos`);
  if (c.porta) par('c-off', `${c.porta} só agrupam`);
  if (c.off) par('c-off', `${c.off} desligados`);

  /**
   * "Igual ao código" é a informação mais importante do topo: ela responde "eu já mexi nisso?".
   * Comparar o desenho com a árvore padrão é a única forma honesta de dizer isso — guardar uma
   * bandeira "mexeu" mentiria depois de ele desfazer as mudanças à mão.
   */
  const padrao = JSON.stringify(arvoreLib.arvorePadrao(fluxo));
  const igual = JSON.stringify(fluxo.arvore || []) === padrao;
  par(igual ? 'c-igual' : 'c-mexido', igual ? 'igual às regras do código' : 'árvore sua, diferente do código');
}

function desenhar() {
  desenharResumo();
  desenharProblemas();
  const caixa = el('arvore');
  caixa.replaceChildren();
  desenharNos(fluxo.arvore || [], 0, caixa);
}

/** A legenda das teclas, no lado. */
function desenharTeclas() {
  const dl = el('teclas');
  dl.replaceChildren();
  for (const [k, texto] of TECLAS) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = texto;
    dl.append(dt, dd);
  }
}

// ---- o simulador ------------------------------------------------------------

/**
 * Testa uma conversa contra a árvore de agora.
 *
 * **Diz o que não sabe, e isso é metade do valor.** Os sinais de conversa saem do texto colado; os
 * de CRM (etiqueta aplicada, modelo mapeado, pedido feito hoje) dependem do contato e ficam de
 * fora — está escrito na tela. Simulador que fingisse conhecer o CRM daria confiança falsa numa
 * mudança de ordem, e ordem errada manda mensagem errada para eleitor.
 */
function testar() {
  const linhas = el('conversa').value.split('\n').map((t) => t.trim()).filter(Boolean);
  const saida = el('resultado');
  saida.replaceChildren();
  saida.classList.add('tem');

  const escreve = (classe, texto) => {
    const d = document.createElement('div');
    d.className = classe;
    d.textContent = texto;
    saida.append(d);
  };

  if (!linhas.length) {
    escreve('fraco', 'Cole alguma coisa primeiro.');
    return;
  }

  const entrantes = linhas.map((texto) => ({ texto, tipo: 'TEXT' }));
  const nossaUltimaAt = Date.now() - 60 * 60 * 1000;
  const retornando = el('retornando').checked;
  const deAnuncio = el('deanuncio').checked;

  const ctx = {
    semInteresse: semInteresse(entrantes),
    pedeRespostaPessoal: conversaPedeRespostaPessoal(entrantes, nossaUltimaAt),
    ultimaEhDespedida: ultimaEhDespedida(entrantes),
    ultimaEhSoReacao: ultimaEhSoReacao(entrantes),
    perguntaAberta: conversaTemPerguntaAberta(entrantes, nossaUltimaAt),
    soExpressaApoio: soExpressaApoio(entrantes, nossaUltimaAt, []),
    pedeAlgoIndefinido: pedeAlgoIndefinido(entrantes, nossaUltimaAt),
    rajadaEhSoRepasse: rajadaEhSoRepasse(entrantes, nossaUltimaAt),
    confirmaPresenca: confirmaPresenca(entrantes, nossaUltimaAt),
    // O texto, que é o que os ramos de palavra leem.
    textos: linhas,
    ultimoTexto: linhas[linhas.length - 1],
    // As duas chaves do desenho dele, que a tela deixa ele escolher.
    jaRespondemosAntes: retornando,
    jaPediramDados: retornando,
    veioDeAnuncio: deAnuncio,
    // Suposições, para os ramos poderem disparar. A tela avisa que são suposições.
    podePerguntarAjuda: true,
    podePedirDados: true,
    podePerguntarInteresse: true,
    podeMandarMomento: true,
  };

  const r = arvoreLib.decidir(ctx, fluxo.arvore || [], fluxo);
  caminhoDoTeste = r?.caminho || [];

  if (r) {
    const nomes = (r.caminho || [])
      .map((id) => arvoreLib.localizar(fluxo.arvore, id)?.no?.rotulo || id)
      .join(' → ');
    escreve('venceu-linha', nomes);
    escreve(
      'fraco',
      r.resposta ? `desfecho: manda "${respostas.find((t) => t.id === r.resposta)?.name || r.resposta}" e conclui` : `desfecho: tecla ${r.tecla} · ${sugestaoLib.TECLAS[r.tecla]?.rotulo || '?'}`
    );
    escreve('fraco', `motivo na tela: ${r.motivo}`);
  } else {
    escreve('nada', 'Nenhum ramo resolveu.');
    escreve('fraco', 'Este caso iria para a IA — e é ela que decidiria.');
  }

  const achados = Object.entries(ctx)
    .filter(([k, v]) => v && typeof v !== 'boolean' && k !== 'textos' && k !== 'ultimoTexto')
    .map(([k]) => k);
  escreve('fraco', `sinais achados no texto: ${achados.length ? achados.join(', ') : 'nenhum'}`);

  desenhar();
}

// ---- ligação da tela --------------------------------------------------------

el('testar').addEventListener('click', testar);

el('novo').addEventListener('click', () => {
  const novo = arvoreLib.noVazio('ramo novo');
  editando = novo.id;
  salvarArvore(arvoreLib.acrescentar(fluxo.arvore, null, novo));
});

el('quadro').addEventListener('click', () => {
  if (confirm('Substituir a árvore de agora pelo desenho do quadro? As protecões (hater, denúncia, despedida, pergunta aberta) entram acima da bifurcação.')) {
    salvarArvore(arvoreLib.arvoreDoQuadro());
  }
});

el('padrao').addEventListener('click', () => {
  if (confirm('Voltar a árvore para as regras do código, como elas estão hoje? Os ramos que você criou se perdem.')) {
    fluxo = { ...fluxo, teclas: {} };
    salvarArvore(arvoreLib.arvorePadrao({}));
  }
});

el('zerar').addEventListener('click', () => {
  fluxo = { ...fluxo, vitorias: {} };
  store.set('fluxo', fluxo).then(desenhar);
});

/**
 * A rodada roda no painel, dentro da aba, e vai contando as vitórias. Sem isto a janela mostraria
 * a contagem congelada do momento em que foi aberta.
 */
chrome.storage.onChanged.addListener((mudancas, area) => {
  if (area !== 'local' || !mudancas.fluxo) return;
  fluxo = { ...fluxo, ...(mudancas.fluxo.newValue || {}) };
  desenhar();
});

(async function boot() {
  fluxo = await store.get('fluxo');
  try {
    respostas = (await store.get('templates')) || [];
  } catch (_) {
    respostas = [];
  }

  /**
   * Semeia a árvore com a tabela de hoje, **carregando a ordem e as desligadas da versão de
   * lista**. Sem isso, abrir esta janela jogaria fora em silêncio o trabalho que ele já tinha
   * feito arrastando as regras.
   */
  if (!Array.isArray(fluxo.arvore) || !fluxo.arvore.length) {
    fluxo = { ...fluxo, arvore: arvoreLib.arvorePadrao(fluxo) };
    await store.set('fluxo', fluxo);
  }
  desenharTeclas();
  desenhar();
})();
