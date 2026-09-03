/**
 * anuncios.js — **os anúncios do momento: o texto que reconhece e o que fazer com ele.**
 *
 * Pedido dele (02/09/2026): *"falta reconhecer o anúncio, nas configurações bote os anúncios do
 * momento onde botarei o texto para ser reconhecido e o que fazer quando for determinado texto do
 * anúncio"*.
 *
 * ## O que já existia, e o que faltava
 *
 * `hsm.modeloPorTexto` já reconhecia o anúncio pelo texto — e só sabia responder **uma** coisa:
 * qual modelo aprovado mandar. Quem chega por um anúncio que não tem modelo (um convite de evento,
 * uma pesquisa, um anúncio que só pede o cadastro) não tinha como ser tratado: o reconhecimento
 * acontecia e morria ali.
 *
 * Aqui o anúncio virou um registro com as duas metades que ele pediu: **o texto que reconhece** e
 * **o que fazer**. Cada anúncio pode ainda somar etiquetas — é a única forma de ele filtrar depois
 * quem veio de qual campanha, já que a etiqueta ADS diz que veio de anúncio e não de qual.
 *
 * ## Por que isto é um módulo puro
 *
 * O que sai daqui **manda mensagem para eleitor real**. Então a decisão fica em função pura, com
 * teste, e a tela só desenha: o mesmo motivo de `sugestao.js`, `arvore.js` e `ia.js`.
 *
 * ## A regra de casamento é a do `modeloPorTexto`, de propósito
 *
 * Trecho **contido** na conversa, sem acento e sem caixa, e o **mais específico ganha** (o maior).
 * É a regra que ele já conhece de "Modelo por TEXTO da mensagem", e mudá-la aqui faria as duas
 * tabelas casarem diferente contra o mesmo texto — o tipo de divergência que ninguém descobre até
 * uma delas mandar a mensagem errada.
 *
 * Casar por trecho contido é o que torna isto usável: o texto do anúncio chega com emoji, com
 * reticências e às vezes cortado, e copiar a mensagem inteira nunca bateria.
 */

/**
 * Só para valor digitado à mão. Igual ao de `hsm.js` — repetido em vez de exportado de lá porque
 * este módulo não depende de nada, e é o que permite testá-lo sem `window`.
 */
function achatar(texto) {
  return String(texto || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function semAcento(texto) {
  return achatar(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * **O que um anúncio pode fazer.**
 *
 * Lista de PERMISSÃO, e curta de propósito: cada item aqui é um caminho novo por onde texto sai
 * para eleitor. `precisaValor` diz se a escolha exige apontar para algo (o modelo, a resposta);
 * `efeito` é o que a tela pinta, com os mesmos nomes que a janela do fluxo usa.
 *
 * **Não há opção de escrever a mensagem aqui**, e isso é a fronteira do projeto: o texto que sai é,
 * byte a byte, um que ele escreveu na aba Respostas ou aprovou na plataforma. Um campo de texto
 * livre nesta tela transformaria a configuração de anúncio em redator de mensagem sem revisão.
 */
export const ACOES = [
  {
    id: 'modelo',
    rotulo: 'Mandar o modelo aprovado',
    precisaValor: 'modelo',
    efeito: 'envia',
    ajuda: 'O nome exato do modelo na plataforma. É o que atende quem clicou num anúncio de conteúdo.',
  },
  {
    id: 'resposta',
    rotulo: 'Mandar uma resposta pronta',
    precisaValor: 'resposta',
    efeito: 'envia',
    ajuda: 'Uma das suas respostas da aba Respostas. Só chega dentro da janela de 24h.',
  },
  {
    id: 'dados',
    rotulo: 'Pedir nome e cidade',
    precisaValor: '',
    efeito: 'envia',
    ajuda: 'Para anúncio que só traz gente nova: pede o cadastro e nada mais.',
  },
  {
    id: 'fluxo',
    rotulo: 'Só etiquetar, e deixar o fluxo decidir',
    precisaValor: '',
    efeito: 'depende',
    ajuda: 'Aplica as etiquetas e devolve o caso para o quadro do fluxo, que decide como sempre.',
  },
];

export function acaoConhecida(id) {
  return ACOES.some((a) => a.id === id);
}

export function sobreAcao(id) {
  return ACOES.find((a) => a.id === id) || null;
}

let contador = 0;
export function novoId() {
  contador += 1;
  return `a${Date.now().toString(36)}${contador.toString(36)}`;
}

/** Um anúncio em branco, do jeito que a Config cria quando ele clica em "+ Anúncio novo". */
export function anuncioVazio() {
  return { id: novoId(), nome: '', trechos: [], acao: 'fluxo', valor: '', etiquetas: [], ligado: true };
}

/**
 * Peneira o que veio do armazenamento, campo a campo.
 *
 * O mesmo motivo de `arvore.sanitizar`: isto decide o que a rodada manda para eleitor real, e o
 * objeto pode ter sido gravado por uma versão anterior, ter vindo de um import, ou ter uma ação que
 * já não existe. Ação desconhecida **cai para `fluxo`** em vez de ser descartada — perder o anúncio
 * inteiro apagaria os trechos que ele digitou; cair para `fluxo` mantém o reconhecimento e devolve
 * a decisão ao quadro, que é o comportamento mais conservador que existe aqui.
 */
export function normalizar(bruto) {
  const lista = Array.isArray(bruto) ? bruto : [];
  const vistos = new Set();
  const saida = [];

  for (const cru of lista) {
    if (!cru || typeof cru !== 'object') continue;

    let id = typeof cru.id === 'string' && cru.id ? cru.id : novoId();
    while (vistos.has(id)) id = novoId();
    vistos.add(id);

    const trechos = (Array.isArray(cru.trechos) ? cru.trechos : [])
      .map((t) => String(t || '').trim())
      .filter((t) => semAcento(t));

    const etiquetas = (Array.isArray(cru.etiquetas) ? cru.etiquetas : [])
      .map((t) => String(t || '').trim())
      .filter(Boolean);

    saida.push({
      id,
      nome: String(cru.nome || '').trim(),
      trechos,
      acao: acaoConhecida(cru.acao) ? cru.acao : 'fluxo',
      valor: String(cru.valor || '').trim(),
      etiquetas,
      ligado: cru.ligado !== false,
    });
  }
  return saida;
}

/**
 * **Qual anúncio a conversa reconhece.**
 *
 * Devolve `{ anuncio, trecho }` ou `null`. Os trechos de TODOS os anúncios ligados entram numa
 * disputa só, e o mais longo ganha: dois anúncios da mesma campanha costumam compartilhar a
 * abertura ("Olá! Eu apoio"), e sem isso o desempate seria a ordem da lista — invisível na tela e
 * mudando quando ele reordena.
 *
 * Anúncio desligado não participa: é como ele guarda a campanha que acabou sem perder o texto.
 */
export function reconhecer(textos, anuncios) {
  const conversa = (Array.isArray(textos) ? textos : [])
    .map((t) => semAcento(t))
    .filter(Boolean)
    .join(' | ');
  if (!conversa) return null;

  let melhor = null;
  for (const anuncio of normalizar(anuncios)) {
    if (!anuncio.ligado) continue;
    for (const trecho of anuncio.trechos) {
      const alvo = semAcento(trecho);
      if (!alvo || !conversa.includes(alvo)) continue;
      if (!melhor || alvo.length > melhor.tamanho) melhor = { anuncio, trecho, tamanho: alvo.length };
    }
  }
  return melhor ? { anuncio: melhor.anuncio, trecho: melhor.trecho } : null;
}

/**
 * **O que está errado na lista — conferido ANTES de a rodada precisar.**
 *
 * A lição do `modeloPorTexto`: nome de modelo errado não dá erro ao salvar, dá na hora de enviar,
 * no meio de uma rodada, com o contato aberto. Avisar aqui é a diferença entre corrigir uma linha e
 * descobrir com trinta contatos na fila.
 *
 * `modelos` é a lista da plataforma e `respostas` são as dele. Quando `modelos` vem vazia (o painel
 * ainda não abriu atendimento) o nome do modelo **não** é conferido: acusar o que não se pode
 * verificar treina a ignorar o aviso.
 */
export function conferir(anuncios, opcoes) {
  const { modelos, respostas } = opcoes || {};
  const avisos = [];
  const lista = normalizar(anuncios);

  const porTrecho = new Map();
  for (const a of lista) {
    const nome = a.nome || '(sem nome)';

    if (!a.trechos.length) {
      avisos.push(`"${nome}": sem nenhum texto para reconhecer — nunca vai casar com nada.`);
    }

    /**
     * **Anúncio que só devolve ao fluxo e não tem etiqueta não faz NADA.**
     *
     * Encontrado ao vivo em 02/09/2026: ele cadastrou dois anúncios assim, o texto foi reconhecido
     * certo, e o relato foi *"não seguiu o fluxo"*. Estava tudo funcionando como configurado — e a
     * configuração não pedia nada. `fluxo` só faz sentido quando as etiquetas fazem o trabalho, ou
     * quando ele montou no quadro um ramo que usa o sinal "reconheci de qual anúncio ela veio".
     *
     * É o mesmo raciocínio de `arvore.problemas`, que acusa a caixa "sem condição, sem ação e sem
     * ramo dentro": configuração que não faz nada tem que dizer isso na cara, senão o tempo é
     * gasto procurando defeito onde não há.
     */
    if (a.acao === 'fluxo' && !a.etiquetas.length) {
      avisos.push(
        `"${nome}": só devolve ao fluxo e não aplica etiqueta — ou seja, não faz nada. ` +
          'Escolha o que fazer, ponha uma etiqueta, ou use o sinal "Reconheci de QUAL anúncio ela veio" num ramo do quadro.'
      );
    }

    const sobre = sobreAcao(a.acao);
    if (sobre?.precisaValor === 'modelo') {
      if (!a.valor) {
        avisos.push(`"${nome}": está marcado para mandar modelo e nenhum modelo foi escolhido.`);
      } else if (Array.isArray(modelos) && modelos.length) {
        const iguais = modelos.filter((m) => achatar(m?.name) === achatar(a.valor));
        if (!iguais.length) {
          avisos.push(`"${nome}": o modelo "${a.valor}" não está entre os aprovados da plataforma.`);
        } else if (iguais.length > 1) {
          avisos.push(`"${nome}": há ${iguais.length} modelos chamados "${a.valor}". Renomeie um na plataforma.`);
        }
      }
    }
    if (sobre?.precisaValor === 'resposta') {
      if (!a.valor) {
        avisos.push(`"${nome}": está marcado para mandar resposta pronta e nenhuma foi escolhida.`);
      } else if (Array.isArray(respostas) && respostas.length && !respostas.some((r) => r?.id === a.valor)) {
        avisos.push(`"${nome}": a resposta "${a.valor}" não existe mais na aba Respostas.`);
      }
    }

    /**
     * Trecho repetido entre dois anúncios é ambiguidade de verdade: o desempate por tamanho não
     * resolve empate exato, e aí quem ganha é a ordem da lista — invisível para ele.
     */
    for (const trecho of a.trechos) {
      const chave = semAcento(trecho);
      if (porTrecho.has(chave)) {
        avisos.push(`O texto "${trecho}" está em "${porTrecho.get(chave)}" e em "${nome}" — só um dos dois vai valer.`);
      } else {
        porTrecho.set(chave, nome);
      }
    }
  }
  return avisos;
}

/**
 * Traz a tabela antiga "Modelo por TEXTO da mensagem" para cá, uma linha virando um anúncio.
 *
 * Sem isto, estrear esta tela apagaria em silêncio o reconhecimento que já estava funcionando — e
 * ele descobriria pelo modelo que parou de sair. Cada linha vira um anúncio com a ação `modelo`, o
 * trecho como texto e o próprio trecho como nome, que é a única coisa que se sabe sobre ele.
 */
export function deModeloPorTexto(mapa) {
  return Object.entries(mapa || {})
    .filter(([trecho, modelo]) => semAcento(trecho) && String(modelo || '').trim())
    .map(([trecho, modelo]) => ({
      id: novoId(),
      nome: trecho.length > 48 ? `${trecho.slice(0, 45)}…` : trecho,
      trechos: [trecho],
      acao: 'modelo',
      valor: String(modelo).trim(),
      etiquetas: [],
      ligado: true,
    }));
}

/** Só para a tela: o resumo em uma linha do que o anúncio faz. */
export function desfechoEmPortugues(anuncio) {
  const sobre = sobreAcao(anuncio?.acao);
  if (!sobre) return 'sem desfecho';
  if (sobre.precisaValor && anuncio.valor) return `${sobre.rotulo}: "${anuncio.valor}"`;
  if (sobre.precisaValor) return `${sobre.rotulo} — falta escolher qual`;
  return sobre.rotulo;
}

/**
 * **O desfecho final quando um anúncio foi reconhecido — e o limite dele.**
 *
 * Devolve a sugestão que o anúncio impõe, ou `null` para deixar como estava.
 *
 * A ação `modelo` **não** passa por aqui: ela já virou o modelo escolhido antes da regra, e a
 * tecla 1 sai do caminho normal. Aqui ficam as duas que a tabela antiga não sabia expressar —
 * mandar uma resposta pronta e pedir o cadastro — mais o `fluxo`, que de propósito não faz nada.
 *
 * ## A trava: o anúncio NUNCA passa por cima de quem decidiu não mandar nada
 *
 * Este é o mesmo erro que já custou caro duas vezes neste projeto: pôr algo no topo sem olhar o
 * que ele passou a vencer. Quem escreveu o texto do anúncio uma vez carrega esse texto na conversa
 * **para sempre** — então, sem a trava, quem depois pediu para parar, se despediu ("amém") ou
 * ganhou a etiqueta que dispensa da fila voltaria a receber mensagem por causa de um texto de dias
 * atrás. Foi exatamente o caso do "Amém" que recebeu mais uma mensagem 36 min depois.
 *
 * A linha é o EFEITO da regra que venceu: se ela decidiu **não enviar** (`silencio`), ela manda. Se
 * a regra ia enviar de qualquer forma, o anúncio decide **o quê** — que é a escolha explícita dele,
 * e escolha explícita não se substitui por dedução.
 */
export function decidirComAnuncio(anuncio, sugestao, efeitoDaSugestao, opcoes) {
  if (!anuncio || !anuncio.ligado) return null;
  if (anuncio.acao !== 'resposta' && anuncio.acao !== 'dados') return null;

  // A proteção vence: a regra decidiu não mandar nada, e o texto do anúncio é de outro dia.
  if (sugestao && efeitoDaSugestao === 'silencio') return null;

  /**
   * **"Precisa de gente" também vence** — anotação da Maria Genoli (03/09/2026).
   *
   * Ela mandou um áudio de sete minutos explicando por que não consegue ir ao evento, e a caixa
   * ofereceu a resposta pronta do anúncio *"Não conseguirei ir!"*. Quando o fluxo diz que alguém
   * precisa escrever, a resposta enlatada é exatamente o que não serve: ela responde ao clique no
   * anúncio, não ao que a pessoa acabou de dizer.
   *
   * É o mesmo raciocínio do `silencio`, uma linha acima — o anúncio decide o que sai **quando há
   * o que sair**, e não sobrepõe uma leitura da conversa.
   */
  if (sugestao && efeitoDaSugestao === 'gente') return null;

  /**
   * **A ação do anúncio é do momento da CHEGADA — depois de cumprida, ela acaba.**
   *
   * Duas anotações de 03/09/2026, a mesma regra:
   *
   *  - **Lúcia** respondeu ao convite, deu nome e cidade e confirmou presença — e a caixa mandava
   *    de novo a resposta pronta do anúncio. *"só concluir, ela confirmou minha mensagem"*;
   *  - **Deoclécio** já tinha mandado meia dúzia de vídeos depois disso, e a mesma resposta
   *    continuava sendo oferecida. *"ele já mandou várias mensagens, o contexto se perdeu"*.
   *
   * A causa é a que o CLAUDE.md já registra: **o texto do anúncio fica na conversa para sempre.**
   * A trava que existia (`silencio`) cobre só quem decidiu não mandar NADA; para todo o resto o
   * anúncio vencia a regra em toda passada, para sempre.
   *
   * `jaSaiu` é a pergunta que faltava: **esta resposta já foi entregue?** Quem chama olha a
   * CONVERSA (não o registro de envios) — é a mesma lição do pedido de dados, que tem três formas
   * e sai também pela mão dele e pela automação da plataforma.
   *
   * Cumprida a ação, o anúncio se cala e o quadro decide — que é o certo: a conversa andou.
   */
  if (opcoes?.jaSaiu) return null;

  const nome = anuncio.nome || 'anúncio reconhecido';
  if (anuncio.acao === 'resposta') {
    if (!anuncio.valor) return null;
    return {
      id: `anuncio:${anuncio.id}`,
      tecla: null,
      resposta: anuncio.valor,
      motivo: `o anúncio "${nome}" pede esta resposta pronta`,
    };
  }
  return {
    id: `anuncio:${anuncio.id}`,
    tecla: '4',
    motivo: `o anúncio "${nome}" pede o nome e a cidade`,
  };
}

/**
 * **Qual modelo mandar para quem chega por um anúncio.**
 *
 * Redesenho dele (02/09/2026): *"o modelo agora será feito pra cada anúncio específico e será
 * mandado no momento que a pessoa chegar pelo anúncio"* e *"caso o texto do anúncio não seja
 * reconhecido será mandado o modelo padrão"*.
 *
 * Devolve `{ nome, deOnde }` ou `null`. `deOnde` é `'anuncio'` ou `'padrao'`, e existe para a tela
 * poder dizer POR QUE aquele modelo — "Sem modelo" ao lado de uma tecla 1 oferecida é pior que não
 * explicar nada.
 *
 * **O padrão vale só quando o texto NÃO foi reconhecido**, que é o que ele pediu, literalmente. Um
 * anúncio reconhecido cuja ação é outra (resposta pronta, pedir dados, devolver ao quadro) é
 * escolha explícita dele — e escolha explícita não se substitui por dedução, nem por um padrão.
 */
export function modeloDoAnuncio(reconhecido, modeloPadrao, indice) {
  const anuncio = reconhecido?.anuncio || reconhecido || null;

  if (anuncio) {
    if (anuncio.acao !== 'modelo') return null;
    return anuncio.valor ? { nome: anuncio.valor, deOnde: 'anuncio' } : null;
  }

  const daVez = padraoDaVez(modeloPadrao, indice);
  return daVez ? { nome: daVez.nome, deOnde: 'padrao', indice: daVez.indice, proximo: daVez.proximo } : null;
}

/**
 * **O modelo padrão da vez, e qual será o próximo.**
 *
 * Pedido dele (02/09/2026): *"o modelo padrão deve variar entre 3 modelos já que chega bastante
 * gente por eles"*. Mesmo motivo das variações das respostas prontas — quando muita gente chega
 * pela mesma porta, todo mundo receber a frase idêntica é o que faz a mensagem parecer robô.
 *
 * Aceita a lista **ou** o texto único da versão anterior, para quem já tinha um escolhido não
 * perder nada.
 *
 * Devolve `{ nome, indice, proximo }` e **não avança nada**: quem chama tem que gravar `proximo`
 * só depois de a mensagem sair. É a mesma separação de `templates.varianteAtual` /
 * `avancarVariante`, e pela mesma razão — a caixa da rodada mostra o nome antes de o envio
 * acontecer, e queimar o rodízio ali faria o próximo pular sozinho em todo contato que ele
 * decidisse não mandar.
 */
export function padraoDaVez(modelos, indice) {
  const lista = (Array.isArray(modelos) ? modelos : [modelos])
    .map((m) => String(m || '').trim())
    .filter(Boolean);
  if (!lista.length) return null;

  // Índice sujo (negativo, quebrado, maior que a lista depois de ele apagar um modelo) vira 0 em
  // vez de `undefined`: o que sai daqui é uma mensagem para eleitor real.
  const i = Number.isInteger(indice) && indice >= 0 ? indice % lista.length : 0;
  return { nome: lista[i], indice: i, proximo: (i + 1) % lista.length };
}
