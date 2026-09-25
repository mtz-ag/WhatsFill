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
export const CHAVES_DO_PERFIL = ['templates', 'anuncios', 'iaRegras'];

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
