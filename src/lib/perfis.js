/**
 * perfis.js — QUEM é o candidato desta conversa.
 *
 * Pedido dele (24/09/2026): *"a extensão atualmente trabalha com o foco no Capitão Martim, ou seja
 * somente um perfil; eu preciso da opção de mais perfis pois tenho agora o Felipe Pedri, então as
 * respostas devem ser específicas pra ele"*.
 *
 * **O que decide o perfil é o CANAL do atendimento** (escolha dele, e a medição a sustenta:
 * `session.channelId` já existe e o painel já o usa para buscar os modelos aprovados daquele
 * número). É DADO, não texto — a mesma doutrina da origem do anúncio (31/08). Automático, sem
 * clique, e sem a chance de mandar a mensagem de um candidato pelo número do outro, que é o erro
 * caro desta tela.
 *
 * **O que é POR PERFIL** (escolha dele): as respostas prontas, os anúncios, o dossiê e as
 * instruções extras da IA. **O que continua compartilhado:** o quadro do fluxo (as decisões são as
 * mesmas, e duas cópias do quadro divergem numa semana — a lição registrada quatro vezes aqui), o
 * parser, as etiquetas de cidade e COREDE, e os modelos aprovados, que a plataforma já entrega
 * por canal.
 *
 * **O INVARIANTE que protege a produção: com UM perfil, nada muda.** O perfil de fábrica lê as
 * chaves de sempre (`templates`, `anuncios`, …), então quem nunca abrir esta tela continua com o
 * comportamento de hoje. Tem teste.
 */

import * as store from './store.js';

/**
 * O id do perfil de fábrica.
 *
 * **Ele é o dono das chaves de topo do armazenamento** — e é por isso que não houve migração
 * nenhuma no dado que ele já tem. Perfil novo guarda o dele em `porPerfil[id]`. A assimetria mora
 * em DUAS funções (`ler` e `gravar`): espalhada, ela seria a armadilha das listas que divergem.
 */
export const PERFIL_PADRAO = 'martim';

/**
 * As chaves que passam a ter uma cópia por perfil. **Lista de PERMISSÃO, nunca de bloqueio** — a
 * inversa faria toda chave nova nascer separada por perfil até alguém notar, e a maior parte da
 * Config é compartilhada de propósito.
 */
export const CHAVES_DO_PERFIL = [
  'templates',
  'anuncios',
  'iaRegras',
  /**
   * **O que entrou em 25/09/2026, e por quê** — relato dele: *"ao trocar o perfil as mensagens não
   * ficam salvas para cada perfil, acabei de trocar a mensagem do momento e ficou com a mensagem do
   * Felipe Pedri; veja se vai acontecer com o resto"*.
   *
   * Medido: das 18 coisas que SAEM para o eleitor, **14 estavam compartilhadas**. A lista de 24/09
   * cobria o texto das respostas prontas e esquecia tudo o que não mora em `templates`.
   *
   * O critério é um só, e é o mesmo do primeiro dia: **entra o que o eleitor recebe ou o que decide
   * o que ele recebe.** O link do grupo vai DENTRO de uma resposta pronta; o modelo aprovado é do
   * CANAL do candidato e nem existe no outro; a arte tem a cara dele; e o texto do anúncio é o que
   * o painel usa para reconhecer o clique.
   */
  'defaultGroupLink',
  'cityLinks',
  'contentTemplates',
  'modelosPadraoAnuncio',
  'modeloPadraoAnuncio',
  /**
   * **As respostas rápidas do comentário** (20/10/2026). Pelo mesmo critério da linha de cima:
   * saem para o eleitor, na página DAQUELE candidato, com a cara dele.
   *
   * **Diferente das outras, o candidato novo não começa vazio:** `facebook-main` passa as de
   * fábrica como `vazio`, e elas podem servir a qualquer um porque nenhuma cita candidato pelo
   * nome. Lista vazia ali faria o painel parecer quebrado — a armadilha que tirou
   * `padroesDeAnuncio` desta lista.
   */
  'respostasComentario',
];

/**
 * **`padroesDeAnuncio` ficou de FORA, e foi a medição que mostrou por quê.**
 *
 * Ele parece do candidato e não é: o valor é a FORMA do texto pré-preenchido do anúncio
 * (`^olá!? eu apoio`), não tem editor na tela, e por perfil o candidato novo leria lista VAZIA —
 * perdendo o reconhecimento do clique que o de fábrica tem. Quem guarda os anúncios DELE é
 * `anuncios`, que já é por perfil.
 */

/**
 * **A arte é separada pelo NOME DA CHAVE, e não por `porPerfil`** — e a razão é o service worker.
 *
 * Os bytes da imagem sobem do worker (20/09), que os lê do armazenamento por uma chave que o painel
 * manda pela ponte. Pondo o arquivo dentro de `porPerfil`, o worker teria de saber quem está logado
 * — mais um lugar sabendo do login, e a ponte carregando o id em toda subida de imagem.
 *
 * Com o sufixo, o worker continua fazendo `store.get(chave)` e nada mudou do lado dele. O perfil de
 * fábrica fica com o nome de sempre, então **a arte que ele já tem guardada continua no lugar**.
 *
 * Chave sufixada não existe no `DEFAULTS`, então ela também não entra no `exportJson` — que é onde
 * os bytes já eram excluídos de propósito.
 */
export function chaveDeImagem(nome, perfilId) {
  if (!perfilId || perfilId === PERFIL_PADRAO) return nome;
  return `${nome}:${perfilId}`;
}

/**
 * **As chaves do candidato que moram DENTRO de `auto`** — a mensagem do momento entre elas.
 *
 * `auto` não pode ser separado inteiro: ele guarda também a configuração do OPERADOR (o limite da
 * rodada, a pausa, "Automatizar", as horas sem resposta, as etiquetas do CRM), e separar aquilo por
 * candidato faria o interruptor da rodada mudar de estado ao trocar de login — coisa que não tem
 * nada a ver com quem é o candidato.
 *
 * Por isso a separação é por SUB-CHAVE, e `autoDoPerfil` é quem a faz valer.
 */
export const CHAVES_DO_PERFIL_EM_AUTO = [
  'mensagemMomento',
  'mensagemMomentoVariantes',
  'pedidoJuntoDoMomento',
  'imagemMomento',
  'imagemMomentoLigada',
  'imagemPedidoDados',
  'imagemPedidoDadosLigada',
  'templateId',
  'templateName',
  // As pecas do disparo: a legenda E o que o eleitor le, entao e de cada candidato. A lista vem de
  // `lote.chavesNoAuto()` e esta escrita aqui para nao haver duas fontes. Vai ate `lote.MAX_PECAS`
  // e nao ate `lotePecas`: a chave da peca 7 tem de estar aqui ANTES de ele criar a peca 7, senao
  // `exigirChaveConhecida` recusa a gravacao no dia em que ele a criar.
  'imagemLote1',
  'legendaLote1',
  'imagemLote2',
  'legendaLote2',
  'imagemLote3',
  'legendaLote3',
  'imagemLote4',
  'legendaLote4',
  'imagemLote5',
  'legendaLote5',
  'imagemLote6',
  'legendaLote6',
  'imagemLote7',
  'legendaLote7',
  'imagemLote8',
  'legendaLote8',
];

/**
 * **O que "não tem valor gravado" quer dizer em cada uma** — e ele nunca é o valor do outro.
 *
 * Escrito aqui e não deduzido do `DEFAULTS` do `store`, porque o default de `auto.etiquetasQuePulam`
 * é `'engajado'` e o de `mensagemMomento` é vazio: herdar o default cego traria de volta exatamente
 * o que esta separação existe para impedir.
 */
const AUTO_VAZIO = {
  mensagemMomento: '',
  mensagemMomentoVariantes: [],
  pedidoJuntoDoMomento: '',
  imagemMomento: '',
  imagemMomentoLigada: false,
  imagemPedidoDados: '',
  imagemPedidoDadosLigada: false,
  templateId: '',
  templateName: '',
  imagemLote1: '',
  legendaLote1: '',
  imagemLote2: '',
  legendaLote2: '',
  imagemLote3: '',
  legendaLote3: '',
  imagemLote4: '',
  legendaLote4: '',
  imagemLote5: '',
  legendaLote5: '',
  imagemLote6: '',
  legendaLote6: '',
  imagemLote7: '',
  legendaLote7: '',
  imagemLote8: '',
  legendaLote8: '',
};

/**
 * O perfil de fábrica, que é o de hoje.
 *
 * `canais: []` quer dizer **atende o que ninguém reivindicou** — sem isso, o dia em que ele criar o
 * segundo perfil e esquecer de preencher o número do primeiro deixaria a base inteira sem perfil e
 * o painel mudo. Errar para o lado de continuar atendendo é o barato aqui.
 */
export const PERFIL_DE_FABRICA = {
  id: PERFIL_PADRAO,
  nome: 'Capitão Martim',
  tratamento: 'o Capitão Martim',
  cargo: 'deputado estadual',
  numero: '10122',
  canais: [],
  dossie: '',
};

/** Só os dígitos — o número da instância aparece escrito de três jeitos na tela da plataforma. */
export function soDigitos(texto) {
  return String(texto || '').replace(/\D/g, '');
}

function textoCurto(valor, limite = 80) {
  return String(valor == null ? '' : valor).replace(/\s+/g, ' ').trim().slice(0, limite);
}

/**
 * **A lista que vem do armazenamento é ENTRADA NÃO CONFIÁVEL** — a mesma disciplina do arquivo de
 * fluxo (01/09): o que está aqui decide qual texto sai para um eleitor real.
 *
 * Campo desconhecido não passa, id repetido perde a vez, e a lista vazia devolve o perfil de
 * fábrica em vez de nada: **um painel sem perfil nenhum não teria nome para escrever**, e o
 * silêncio seria o pior desfecho possível.
 */
export function sanitizar(bruto) {
  const vistos = new Set();
  const saida = [];
  for (const cru of Array.isArray(bruto) ? bruto : []) {
    if (!cru || typeof cru !== 'object') continue;
    const id = textoCurto(cru.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, '');
    const nome = textoCurto(cru.nome, 60);
    if (!id || !nome || vistos.has(id)) continue;
    vistos.add(id);
    saida.push({
      id,
      nome,
      tratamento: textoCurto(cru.tratamento, 60) || `o ${nome}`,
      cargo: textoCurto(cru.cargo, 60),
      numero: soDigitos(textoCurto(cru.numero, 12)),
      canais: [
        ...new Set(
          (Array.isArray(cru.canais) ? cru.canais : []).map((c) => textoCurto(c, 60)).filter(Boolean)
        ),
      ],
      dossie: String(cru.dossie == null ? '' : cru.dossie).slice(0, 40000),
    });
  }
  return saida.length ? saida : [{ ...PERFIL_DE_FABRICA }];
}

/**
 * **Quem atende este canal.**
 *
 * `canal` é o `channelId` da sessão; `numero` é o telefone da instância que a tela mostra, e ele
 * entra como segunda chave porque o `channelId` é um id opaco que ele não tem como digitar — o que
 * ele lê na tela é *"Instância cccad9 · (51) 98051-0122"*. Os dois casam contra a MESMA lista, e o
 * telefone é comparado só por dígitos.
 *
 * **Sem casamento, vence quem não reivindicou canal nenhum** (o de fábrica), e só depois o primeiro
 * da lista. Nunca devolve nulo.
 */
/**
 * **Quem RECLAMOU este canal, e NINGUÉM quando ninguém o reclamou.**
 *
 * **Devolver nulo é o ponto todo.** A primeira versão (24/09) tinha um `doCanal` que nunca devolvia
 * nulo, porque ele ESCOLHIA o candidato — e ele foi apagado em 25/09, quando ele corrigiu o
 * desenho: *"eu queria algo como um perfil de login no Windows"*. Quem escolhe é ele; isto aqui só
 * responde *"o atendimento aberto é de outro número?"*, para a tela avisar.
 *
 * Com o comportamento antigo, *"ninguém reivindicou este número"* e *"é do candidato de sempre"*
 * seriam a mesma resposta, e a tarja apareceria em quase todo atendimento — alarme que toca sempre
 * se aprende a ignorar.
 */
export function donoDoCanal(perfis, canal, numero = '') {
  const lista = sanitizar(perfis);
  const chaves = [String(canal || '').trim(), soDigitos(numero)].filter(Boolean);
  if (!chaves.length) return null;
  for (const p of lista) {
    for (const c of p.canais) {
      const alvo = String(c).trim();
      if (!alvo) continue;
      const digitos = soDigitos(alvo);
      if (chaves.includes(alvo) || (digitos && chaves.includes(digitos))) return p;
    }
  }
  return null;
}

/**
 * **DE QUEM É O NÚMERO DESTE ATENDIMENTO** — e as quatro respostas possíveis são quatro, não duas.
 *
 * Relato dele (25/09/2026), com a print de um atendimento no número do Felipe Pedri: *"eu só
 * adicionei os dois números do Martim, não adicionei o número do Felipe Pedri ainda na extensão;
 * não devia ter uma barreira caso o número não esteja na extensão?"*. Estava certo, e o defeito era
 * meu: `donoDoCanal` devolve `null` tanto para *"ninguém cadastrou nada ainda"* quanto para *"tem
 * cadastro, e este número não está nele"* — e o painel tratava os dois como silêncio.
 *
 * **A distinção que faltava é se JÁ EXISTE cadastro.** Antes de ele preencher o primeiro número,
 * acender seria alarme em 100% dos atendimentos — e alarme que toca sempre se aprende a ignorar.
 * Depois que existe, **a ausência vira informação**: número fora da lista quer dizer *"eu não sei
 * de quem é esta conversa"*, que é justamente o caso perigoso.
 *
 * Uma função e uma resposta, porque três leituras separadas divergem na primeira mudança:
 *
 *  - `quieto` — ninguém cadastrou canal nenhum ainda, ou não há número para comparar;
 *  - `meu` — é do candidato em que você está;
 *  - `outro` — é de outro candidato cadastrado (vem com o `dono`);
 *  - `desconhecido` — há cadastro, e este número não está em nenhum.
 */
export function situacaoDoCanal(perfis, canal, numero, logadoId) {
  const lista = sanitizar(perfis);
  const temCadastro = lista.some((p) => p.canais.length);
  const chaves = [String(canal || '').trim(), soDigitos(numero)].filter(Boolean);
  if (!temCadastro || !chaves.length) return { estado: 'quieto', dono: null };

  const dono = donoDoCanal(lista, canal, numero);
  if (!dono) return { estado: 'desconhecido', dono: null };
  return dono.id === String(logadoId || '') ? { estado: 'meu', dono } : { estado: 'outro', dono };
}

export function porId(perfis, id) {
  const lista = sanitizar(perfis);
  return lista.find((p) => p.id === String(id || '')) || lista[0];
}

/**
 * O valor de uma chave PARA ESTE PERFIL.
 *
 * O de fábrica lê a chave de topo — é o que mantém a produção dele intacta. Os outros leem
 * `porPerfil[id]`, e **quando não há valor gravado devolve o que `vazio` disser, nunca o do outro
 * candidato**: mandar a resposta do Martim pelo número do Felipe é exatamente o defeito que esta
 * tela existe para impedir.
 */
export async function ler(chave, perfilId, vazio = null) {
  exigirChaveConhecida(chave);
  if (!perfilId || perfilId === PERFIL_PADRAO) return store.get(chave);
  const todos = (await store.get('porPerfil')) || {};
  const doPerfil = todos[perfilId];
  if (doPerfil && Object.prototype.hasOwnProperty.call(doPerfil, chave)) return doPerfil[chave];
  return vazio;
}

/**
 * **`CHAVES_DO_PERFIL` é lista de PERMISSÃO, e esta é a função que a faz valer.**
 *
 * Sem ela a constante seria só um comentário — a armadilha do `pedido-emprego`, que existia sem
 * ninguém acioná-lo. Chave fora da lista aqui é erro de programação, não configuração: ou ela
 * entra na lista de propósito (e aí alguém pensou no que acontece com o candidato que não tem
 * valor gravado), ou o dado é compartilhado e não devia passar por aqui.
 */
function exigirChaveConhecida(chave) {
  if (!CHAVES_DO_PERFIL.includes(chave)) {
    throw new Error(`WhatsFill: "${chave}" não é uma chave por candidato (ver perfis.CHAVES_DO_PERFIL).`);
  }
}

export async function gravar(chave, perfilId, valor) {
  exigirChaveConhecida(chave);
  if (!perfilId || perfilId === PERFIL_PADRAO) return store.set(chave, valor);
  const todos = { ...((await store.get('porPerfil')) || {}) };
  todos[perfilId] = { ...(todos[perfilId] || {}), [chave]: valor };
  return store.set('porPerfil', todos);
}

/**
 * A mesma leitura, para **quem não sabe quem está logado**.
 *
 * As bibliotecas (`cities.js`, e quem vier depois) leem o armazenamento sem receber o perfil — e
 * fazer cada uma pedir o id ao painel seria espalhar a assimetria que `ler`/`gravar` existem para
 * conter. Aqui ela continua morando em um lugar só.
 */
export async function lerDoAtivo(chave, vazio = null) {
  return ler(chave, await store.get('perfilAtivo'), vazio);
}

/** A mesma escrita, para quem não sabe quem está logado. */
export async function gravarNoAtivo(chave, valor) {
  return gravar(chave, await store.get('perfilAtivo'), valor);
}

/**
 * **O `auto` deste candidato** — puro, para dar para testar sem armazenamento.
 *
 * O de fábrica recebe o objeto intacto, que é o invariante da produção dele. Para os outros, cada
 * sub-chave da lista vira o que ELE gravou ou o VAZIO — **nunca a do outro candidato**, que é o
 * defeito que ele reportou: *"acabei de trocar a mensagem do momento e ficou com a mensagem do
 * Felipe Pedri"*.
 *
 * O que não está na lista passa direto: a configuração da rodada é do operador e é uma só.
 */
export function autoDoPerfil(auto, perfilId, gravado) {
  const base = { ...(auto || {}) };
  if (!perfilId || perfilId === PERFIL_PADRAO) return base;
  for (const chave of CHAVES_DO_PERFIL_EM_AUTO) {
    base[chave] = gravado && Object.prototype.hasOwnProperty.call(gravado, chave)
      ? gravado[chave]
      : AUTO_VAZIO[chave];
  }
  return base;
}

/** O `auto` deste candidato, lido do armazenamento. */
export async function lerAuto(perfilId) {
  const auto = await store.get('auto');
  if (!perfilId || perfilId === PERFIL_PADRAO) return auto;
  const todos = (await store.get('porPerfil')) || {};
  return autoDoPerfil(auto, perfilId, todos[perfilId]?.auto);
}

/**
 * Grava uma mudança em `auto`, mandando **cada campo para o lugar dele**.
 *
 * Uma escrita por destino, nunca duas na mesma chave: `store.set('auto', …)` duas vezes no mesmo
 * instante é a segunda passando por cima da primeira, e o campo que ele acabou de digitar sumiria.
 *
 * Devolve o `auto` já composto, porque quem chama guarda isso em memória e desenhar com o valor
 * anterior é a tela mentindo sobre o que foi salvo.
 */
export async function gravarAuto(perfilId, mudanca) {
  const daFabrica = !perfilId || perfilId === PERFIL_PADRAO;
  const daCasa = {};
  const doCandidato = {};
  for (const [chave, valor] of Object.entries(mudanca || {})) {
    const separar = !daFabrica && CHAVES_DO_PERFIL_EM_AUTO.includes(chave);
    (separar ? doCandidato : daCasa)[chave] = valor;
  }

  if (Object.keys(daCasa).length) {
    const atual = (await store.get('auto')) || {};
    await store.set('auto', { ...atual, ...daCasa });
  }
  if (Object.keys(doCandidato).length) {
    const todos = { ...((await store.get('porPerfil')) || {}) };
    const meu = { ...(todos[perfilId] || {}) };
    meu.auto = { ...(meu.auto || {}), ...doCandidato };
    todos[perfilId] = meu;
    await store.set('porPerfil', todos);
  }
  return lerAuto(perfilId);
}

/**
 * **Troca o nome do candidato dentro de um texto** — é o que semeia o perfil novo.
 *
 * Perfil recém-criado sem texto nenhum é perfil MUDO, e mudo numa rodada automática é contato
 * saindo da fila sem receber nada. Copiar os textos com o nome trocado dá um ponto de partida que
 * já está no tom certo, e ele edita depois o que quiser.
 *
 * **Troca a forma COMPLETA antes da curta** (`Capitão Martim` antes de `Martim`), senão sobra
 * *"Capitão Felipe Pedri"* — o mesmo cuidado de concordância que a migração de "gabinete" exigiu em
 * 07/09. E **o que não é o nome não é tocado**: a chapa, o Zucco e o Flávio continuam lá, porque
 * eles não mudam com o candidato.
 *
 * A fronteira é `[^\p{L}]` com a flag `u` nas duas pontas, e não `\b`: **`\b` não abre antes nem
 * fecha depois de letra acentuada** — a armadilha do *"É nós"* (31/08) e a do *"Você deve receber"*
 * (06/09), e "Capitão" tem acento no meio.
 */
export function trocarONome(texto, de, para) {
  const origem = String(de || '').trim();
  const destino = String(para || '').trim();
  if (!origem || !destino) return String(texto == null ? '' : texto);

  const partes = origem.split(/\s+/).filter(Boolean);
  const formas = [origem];
  // O sobrenome sozinho ("Martim") só entra quando não é o nome inteiro — senão é a mesma troca.
  if (partes.length > 1) formas.push(partes[partes.length - 1]);

  let saida = String(texto == null ? '' : texto);
  for (const forma of formas) {
    const escapada = forma.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(String.raw`(^|[^\p{L}])` + escapada + String.raw`(?=[^\p{L}]|$)`, 'giu');
    saida = saida.replace(re, (_m, antes) => `${antes}${destino}`);
  }
  return saida;
}

/**
 * Os textos do perfil de origem, com o nome **e o número de urna** trocados — o ponto de partida
 * de um perfil novo.
 *
 * **O número entra junto porque metade destes textos fecha com ele** (*"Vote 10122"*), e um número
 * de urna errado é o erro que manda o eleitor votar em outra pessoa — o mesmo risco que obrigou a
 * trava `conferirChapa` a existir (08/09). Só troca quando os DOIS perfis têm número: sem o do
 * destino, deixar o antigo seria pior que deixar em branco, então o texto fica como está e ele vê
 * na hora de editar.
 */
export function semearTextos(textos, de, para) {
  const nomeDe = de?.nome || '';
  const nomePara = para?.nome || '';
  const numDe = soDigitos(de?.numero);
  const numPara = soDigitos(para?.numero);

  const trocar = (texto) => {
    let saida = trocarONome(texto, nomeDe, nomePara);
    if (numDe && numPara && numDe !== numPara) {
      // O número vem escrito com e sem ponto ("10.122" aparece nas prints), então os dois casam.
      const comPonto = numDe.replace(/^(\d{2})(\d+)$/, '$1.$2');
      for (const forma of [...new Set([numDe, comPonto])]) {
        saida = saida.split(forma).join(numPara);
      }
    }
    return saida;
  };

  return (Array.isArray(textos) ? textos : []).map((t) => ({
    ...t,
    text: trocar(t?.text),
    variantes: Array.isArray(t?.variantes) ? t.variantes.map(trocar) : t?.variantes,
  }));
}
