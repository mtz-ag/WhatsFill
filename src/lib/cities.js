/**
 * cities.js — cidade → link do grupo, e o casamento tolerante do que o contato digitou.
 *
 * O campo Cidade no CRM é texto livre (verificado no schema), então quem garante
 * consistência é este arquivo: normaliza, corrige abreviação comum e aceita erro de
 * digitação por distância de Levenshtein.
 *
 * A lista de municípios vem do IBGE na primeira execução e fica em cache. Sem lista
 * (offline), o casamento cai para as cidades que já existem na sua tabela de links.
 */

import * as store from './store.js';

const IBGE_RS = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/RS/municipios';

/** Abreviações que aparecem toda hora no WhatsApp. */
const ALIASES = [
  [/\bsto\.?\b/g, 'santo'],
  [/\bsta\.?\b/g, 'santa'],
  /**
   * `S.` seguido de partícula sai INTEIRO, com a partícula.
   *
   * Tem que vir antes da regra do `S.` genérico, senão "S.do Livramento" viraria
   * "sao do livramento" — e **"São do ..." não é nome de município nenhum**: "São" sempre precede
   * nome de santo. Ali o "S." é "Sant'Ana", e adivinhar errado destruía o casamento.
   *
   * Tirando os dois, sobra "livramento", que o encurtamento resolve para "Santana do Livramento".
   * Perder informação aqui é seguro: o que sobra ambíguo ("S.do Palma" → "palma") não casa com
   * nada, e não casar é o lado certo de errar.
   */
  [/\bs\.\s*d[eoa]\s+/g, ''],
  [/\bs\.\s*/g, 'sao '],
  [/\bpto\.?\b/g, 'porto'],
  [/\bp\.\s*alegre\b/g, 'porto alegre'],
  [/\bpoa\b/g, 'porto alegre'],
  [/\bbge\b/g, 'bage'],
  [/\bcxs\b/g, 'caxias do sul'],
  [/\bsm\b/g, 'santa maria'],
];

export function normalize(value) {
  let s = semAcentoNemCaixa(value);
  for (const [re, to] of ALIASES) s = s.replace(re, to);
  // O ponto vira ESPAÇO, nunca sumiço. Apagar cola as palavras vizinhas e destrói a fronteira de
  // palavra: "Livramento.RS" virava "livramentors", e o encurtamento /\blivramento\b/ deixava de
  // casar. Com espaço, hífen ou vírgula no lugar do ponto o mesmo texto sempre funcionou — era só
  // o ponto colado que ficava de fora. Medido em 01/09/2026 num contato real que escreveu
  // "S.do Livramento.RS": a cidade caiu como não-reconhecida e a rodada sugeriu pedir os dados a
  // quem já tinha respondido nome e cidade.
  return s.replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * S\u00f3 tira acento, caixa e pontua\u00e7\u00e3o \u2014 **sem** expandir abrevia\u00e7\u00e3o.
 *
 * `normalize` aplica os ALIASES ("sto" \u2192 "santo", "poa" \u2192 "porto alegre"), e \u00e9 isso que faz o
 * casamento tolerante funcionar. Mas para conferir GRAFIA isso apaga justamente o que se quer
 * ver: com os aliases, "Sto Angelo" e "Santo \u00c2ngelo" ficam id\u00eanticos, e o campo escrito abreviado
 * passaria por correto. Aqui a compara\u00e7\u00e3o \u00e9 do que est\u00e1 escrito, n\u00e3o do que se entende.
 */
export function semAcentoNemCaixa(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // tira acento (marcas combinantes)
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A cidade escrita no campo confere com o nome oficial do munic\u00edpio?
 *
 * Pedido dele (20/08/2026): *"o que voc\u00ea pode arrumar \u00e9 se est\u00e1 escrita corretamente e me falar se
 * est\u00e1 errada tamb\u00e9m quando eu iniciar o atendimento, tem casos de cidade escritas erradas"*. A
 * base tem cidade digitada \u00e0 m\u00e3o h\u00e1 anos, e o campo \u00e9 texto livre.
 *
 * **Diferen\u00e7a s\u00f3 de acento ou caixa N\u00c3O \u00e9 erro** \u2014 "porto alegre" e "Porto Alegre" resolvem para o
 * mesmo munic\u00edpio, geram a mesma etiqueta e n\u00e3o confundem ningu\u00e9m. Avisar disso seria ru\u00eddo que
 * treina a ignorar o aviso. O que importa:
 *
 *  - **abrevia\u00e7\u00e3o** ("Sto Angelo", "POA", "Cxs"): entende-se, mas o campo fica fora do padr\u00e3o e
 *    duas grafias da mesma cidade convivem na base;
 *  - **erro de digita\u00e7\u00e3o** ("Caxias do Sull", "Erechin"): casou por dist\u00e2ncia, n\u00e3o por igualdade;
 *  - **n\u00e3o \u00e9 munic\u00edpio do RS** ("n\u00e3o sei", "Curitiba"): n\u00e3o h\u00e1 grafia certa a sugerir.
 *
 * @returns {Promise<{ok:boolean, oficial:string|null, confianca:string|null, motivo:string}>}
 */
export async function conferirGrafia(valor) {
  const bruto = String(valor || '').trim();
  if (!bruto) return { ok: true, oficial: null, confianca: null, motivo: '' };

  const casou = await matchCity(bruto);
  if (!casou) {
    /**
     * **Município IGNORADO continua sendo município** — print da Nelci (10/09/2026): Cidade
     * "Capitão" no cadastro e o aviso vermelho *"'Capitão' não casa com nenhum dos 497 municípios do
     * RS"*, com ele mandando a página da Prefeitura Municipal de Capitão.
     *
     * `cidadesIgnoradas` existe para o TEXTO LIVRE — "Capitão" é a patente do candidato e apareceria
     * em toda mensagem como cidade (01/09). `matchCity` usa a lista sem os ignorados, e é certo que use
     * lá. **Aqui o valor já está no campo Cidade**: não há patente a confundir, e a etiqueta de cidade e
     * o COREDE dele saem da planilha oficial, que tem Capitão. Só o aviso mentia.
     *
     * Exige o nome EXATO (sem acento e caixa): igualdade, não parecença.
     */
    const exato = (await loadMunicipios()).find((m) => semAcentoNemCaixa(m) === semAcentoNemCaixa(bruto));
    if (exato) {
      return { ok: true, oficial: exato, confianca: 'exata', motivo: '' };
    }

    /**
     * **Munic\u00edpio de fora do RS n\u00e3o \u00e9 grafia errada** \u2014 pedido dele (08/09/2026), com a etiqueta
     * *"Fora do RS"*.
     *
     * O aviso vermelho existe para cadastro digitado errado, e dizer *"n\u00e3o casa com nenhum dos 497"*
     * sobre **Curitiba** \u00e9 verdade e n\u00e3o \u00e9 \u00fatil: n\u00e3o h\u00e1 grafia a corrigir, a pessoa mora l\u00e1. Com a
     * lista nacional d\u00e1 para dizer o que aquilo \u00e9, e o caso vira etiqueta em vez de alarme.
     */
    const uf = await ufForaDoRS(bruto);
    if (uf) {
      return { ok: true, oficial: bruto, confianca: 'exata', foraDoRS: uf, motivo: '' };
    }
    return {
      ok: false,
      oficial: null,
      confianca: null,
      motivo: `"${bruto}" n\u00e3o casa com nenhum dos 497 munic\u00edpios do RS.`,
    };
  }

  if (semAcentoNemCaixa(bruto) === semAcentoNemCaixa(casou.city)) {
    // S\u00f3 acento/caixa: resolve para o mesmo munic\u00edpio e gera a mesma etiqueta. N\u00e3o \u00e9 erro.
    return { ok: true, oficial: casou.city, confianca: casou.confidence, motivo: '' };
  }

  return {
    ok: false,
    oficial: casou.city,
    /**
     * **Esta correção pode ser feita SOZINHA?** — decisão dele (12/09/2026): *"isso já era pra
     * estar sendo corrigido pela IA; se já escreve a cidade pode reescrever"*.
     *
     * **`confianca: 'exata'` NÃO serve como linha de corte, e medir mostrou por quê:** naquele
     * balde entram `Vitoria → Vitória das Missões` e `Esperanca → Esperança do Sul`, que são o
     * caminho do SUFIXO OMITIDO — a mesma armadilha do *"São Paulo" virando São Paulo das Missões*
     * (08/09). Reescrever ali troca a cidade de um eleitor por outra, com o COREDE e o link do
     * grupo junto.
     *
     * **A linha é a IGUALDADE depois de normalizar:** o que está escrito tem que resolver para o
     * nome INTEIRO do município, diferindo só por abreviação, apelido, acento, caixa ou sigla do
     * estado. `POA`, `Cxs`, `Sto Angelo`, `Sta Maria`, `Canoas RS` passam; **erro de digitação
     * fica de fora** (`Caxias do Sull`, `Erechin`) porque ali quem resolveu foi a distância, não a
     * igualdade — e esse caso continua sendo o botão.
     *
     * Medido contra os 497 nomes oficiais: **nenhum** seria reescrito para outro município.
     */
    podeCorrigirSozinho: normalize(semSufixoDeEstado(bruto)) === normalize(casou.city),
    confianca: casou.confidence,
    motivo:
      casou.confidence === 'exata'
        ? `est\u00e1 escrito "${bruto}", e o nome oficial \u00e9 "${casou.city}".`
        : `est\u00e1 escrito "${bruto}" \u2014 o mais parecido \u00e9 "${casou.city}", mas n\u00e3o \u00e9 igual.`,
  };
}

let municipiosCache = null;

export async function loadMunicipios() {
  if (municipiosCache) return municipiosCache;

  const cached = await store.get('municipios');
  if (cached && cached.length) {
    municipiosCache = cached;
    return municipiosCache;
  }

  try {
    const res = await fetch(IBGE_RS);
    if (!res.ok) throw new Error('IBGE ' + res.status);
    const data = await res.json();
    const names = data.map((m) => m.nome).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (names.length) {
      await store.set('municipios', names);
      municipiosCache = names;
      return names;
    }
  } catch (err) {
    console.warn('[WhatsFill] não consegui buscar os municípios no IBGE:', err.message);
  }

  /**
   * **A lista que VEM COM A EXTENSÃO** — e por que ela precisava estar aqui.
   *
   * O IBGE fora do ar (503, rede bloqueada, primeira abertura sem internet) apagava a capacidade de
   * reconhecer cidade **inteira**: `matchCity` passa a comparar contra uma lista vazia e nada casa
   * nunca. O único sinal era um `console.warn`, e o sintoma na tela é o campo Cidade vazio com a
   * cidade escrita na conversa — que foi o relato dele em 02/09/2026 sobre Porto Alegre não ser
   * capturada.
   *
   * Peguei isso por acidente: montando o teste do "Porto Alegre" o meu próprio banco caiu no
   * `IBGE 503` e **nenhuma** das dezessete formas foi reconhecida, nem "Porto Alegre" puro.
   *
   * O arquivo `coredes-rs.json` já vem no pacote, com os 497 municípios da planilha oficial da
   * SPGG-RS, e é a MESMA fonte que decide o COREDE — então usá-lo aqui também garante que as duas
   * coisas não possam discordar sobre quais municípios existem.
   *
   * Fica DEPOIS do IBGE de propósito: quando a rede funciona, a autoridade continua sendo ele, e
   * município novo aparece sem precisar de commit. O arquivo é a rede de segurança, não a fonte.
   */
  try {
    const res = await fetch(chrome.runtime.getURL('src/data/coredes-rs.json'));
    const dados = await res.json();
    const nomes = Object.keys(dados?.municipios || {}).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (nomes.length) {
      console.warn(`[WhatsFill] usando a lista de municípios que vem com a extensão (${nomes.length}).`);
      // **Não grava no cache do storage.** Se gravasse, a lista de emergência viraria a definitiva
      // e o IBGE nunca mais seria consultado — inclusive depois de a rede voltar.
      municipiosCache = nomes;
      return nomes;
    }
  } catch (err) {
    console.warn('[WhatsFill] não consegui ler a lista de municípios do pacote:', err.message);
  }

  // Último recurso: as cidades que você já cadastrou na tabela de links.
  const links = await store.get('cityLinks');
  municipiosCache = Object.values(links).map((v) => v.label).filter(Boolean);
  return municipiosCache;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

function tolerance(name) {
  if (name.length <= 6) return 1;
  if (name.length <= 12) return 2;
  return 3;
}

/**
 * Procura um município dentro de um texto qualquer.
 * @returns {{city:string, confidence:'exata'|'aproximada', matched:string}|null}
 */
/**
 * O nome do ESTADO contém o nome de um município: "Rio Grande do Sul" tem "Rio Grande" dentro.
 *
 * Como o passo 1 procura o nome do município em qualquer lugar do texto, quem escrevia "sou do
 * Rio Grande do Sul" era gravado como morador de Rio Grande — cidade errada, e o COREDE errado
 * junto, porque a etiqueta de região sai da cidade. Nenhum município do RS se chama "Rio Grande
 * do Sul", então apagar a frase inteira antes de casar não custa nenhum acerto: quem quis dizer
 * a cidade escreve "Rio Grande", que continua casando.
 */
const NOME_DO_ESTADO = /\brio grande do sul\b/g;

/**
 * O mesmo, sobre o texto CRU (com acento e maiúscula) — para tirar o estado antes de medir o
 * tamanho da mensagem em `matchCityComContexto`. Ver a anotação da Iolanda lá.
 */
const NOME_DO_ESTADO_CRU = /\b(rio\s+grande\s+do\s+sul|rio\s+grande\s+d[oa]\s+sul)\b\.?/gi;

/**
 * A sigla do estado pendurada no fim do que a pessoa escreveu: "Canoas RS", "Canoas - RS",
 * "Canoas/RS".
 *
 * Existe para as comparações que exigem a mensagem INTEIRA ser o nome do município — as que
 * decidem se a pessoa **informou** a cidade (`cidadeSozinha`) ou se um pedaço da resposta é só a
 * cidade (`isCityAlone`). O casamento em si nunca precisou disto: "Canoas RS" já achava Canoas.
 * O que quebrava era a igualdade, `"canoas rs" !== "canoas"` — e o efeito era silencioso e
 * grave: a cidade era reconhecida, mas **não contava como informada pela pessoa**, então não
 * substituía o CRM e ficava esperando um clique que, na rodada automatizada, ninguém dá.
 *
 * Visto ao vivo em 01/09/2026: contato mandou o nome numa mensagem e "Canoas RS" na seguinte.
 *
 * Só o SUFIXO: nenhum dos 497 municípios do RS termina em alguma destas siglas, então tirar do
 * fim é seguro. No meio da frase não se mexe — "RS" ali pode ser outra coisa.
 *
 * **As formas abreviadas não são teoria.** Em 01/09/2026, dois contatos seguidos: `Canoas RS` e
 * `Erechim rgds`. A segunda passou batido porque a lista tinha só `rs` — e "às vezes pega a
 * cidade, às vezes não" é o pior sintoma possível, porque parece defeito aleatório. Achou forma
 * nova? Acrescente aqui, não num `if` novo em outro arquivo.
 *
 * **`rio grande` sozinho NÃO entra**, e nunca pode entrar: é município do RS. Só o estado por
 * extenso.
 */
const SUFIXO_DO_ESTADO = /[\s,.\/-]+(rs|rgs|rgds|r\s*s|rio grande do sul)\s*$/;

/**
 * O que a pessoa escreveu, sem a sigla do estado no fim. Já normalizado.
 *
 * Exportada porque quem compara "isto é exatamente o município?" precisa dos dois lados no mesmo
 * formato — e porque a regra tem teste.
 */
export function semSufixoDeEstado(valor) {
  return normalize(valor).replace(SUFIXO_DO_ESTADO, '').trim();
}

/**
 * Expressões que contêm nome de município mas não são endereço de ninguém.
 *
 * A campanha inteira fala em "Capitão Martim" — e **Capitão é município do RS**. Toda mensagem
 * de aceite do anúncio ("aceito receber conteúdos do Capitão Martim e do Zucco") casava com a
 * cidade Capitão, com confiança `exata`, que é a que grava **sozinha, sem clique**. Era cidade
 * errada e COREDE errado em cima de quem só repetiu o nome do candidato.
 *
 * Apagar a expressão inteira antes de casar resolve sem tirar o município da lista: quem mora
 * lá escreve "Capitão" sem "Martim" atrás.
 */
const EXPRESSOES_QUE_NAO_SAO_CIDADE = [
  /\bcapitao martim\b/g,
  /\bcap martim\b/g,
  /\bcapitao martins\b/g,
  // Os outros nomes da campanha. Nenhum é município, mas todos aparecem na mensagem do anúncio
  // separados por vírgula — e vírgula é o que faz o parser achar que está lendo "Nome / Cidade".
  /\bzucco\b/g,
  /\bzuco\b/g,
  /\bflavio bolsonaro\b/g,
  /\bbolsonaro\b/g,
  /\bhiago\b/g,
  /**
   * **"Feliz Natal" é felicitação, e é DUAS cidades ao mesmo tempo** — achado medindo a lista
   * nacional em 08/09/2026. `Feliz` é município do RS e `Feliz Natal` é município do MT, então a
   * mensagem *"Feliz Natal!"* casava exata pelos dois lados e ia para o campo Cidade.
   *
   * **O defeito do lado do RS já existia antes da lista nacional:** a mensagem cabe nos 30
   * caracteres da porta do texto curto e `Feliz` está contido nela — ou seja, `"Feliz Natal!"`
   * gravava **cidade Feliz** com confiança exata, que é a que grava sem clique.
   */
  /\bfeliz natal\b/g,
  /**
   * **Estado civil e ocupação, que a pessoa escreve no cadastro** — print da Dileta Pase
   * (08/09/2026): o cabeçalho do painel mostrava **Cidade: Chapada (aproximada) ← de "casada"**.
   *
   * Medido: `matchCity('casada')` devolve **Chapada** por distância 2, e o caminho da resposta ao
   * formulário aceita `aproximada` — é ele que faz *"Sao lourenso"* virar São Lourenço do Sul.
   *
   * A tolerância existe para o erro de digitação **na posição da cidade**; estas palavras estão
   * nessa posição o tempo todo (*"Dileta, casada, aposentada"*) e não são erro de nada. Saem antes
   * de casar, como o vocabulário da campanha.
   */
  /**
   * As duas exceções saíram da prova contra os 6.068 municípios (Brasil + RS): **Ilha Solteira**
   * (SP) e **Olho d'Água do Casado** (AL) são nomes de verdade, e sem as guardas de contexto eles
   * deixariam de ser reconhecidos. Ninguém escreve "ilha" antes do estado civil.
   */
  /(?<!ilha\s)\bsolteir[oa]\b/g,
  /(?<!\bdo\s)\bcasad[oa]\b/g,
  /\b(viuv[oa]|divorciad[oa]|separad[oa]|aposentad[oa]|pensionista)\b/g,
];

/**
 * Este texto pode ser oferecido como cidade?
 *
 * Existe para o candidato NÃO RECONHECIDO — o que o parser encontra na posição da cidade e não
 * casa com município nenhum. Antes ele virava popup ("Encontrei 'Zucco' como cidade"), porque a
 * mensagem do anúncio lista os nomes separados por vírgula, e vírgula é o que faz o parser achar
 * que está lendo "Nome / Cidade".
 *
 * Junta as duas fontes: o vocabulário da campanha, fixo aqui, e a lista **que ele edita** na
 * Config ("Municípios que NÃO são cidade aqui"). A segunda passou a valer também para candidato
 * não reconhecido — antes ela só tirava município da lista oficial, então "Zucco", que não é
 * município, escapava por ela.
 */
/**
 * **Endereço de máquina nunca é cidade** — print da Maria Antonia (06/09/2026): o campo Cidade dela
 * tinha **`vt.tiktok.com`**, e o cabeçalho avisava *"não casa com nenhum dos 497 municípios do RS"*.
 *
 * É a terceira vez que um endereço vira dado: o link do Instagram (02/09), o do FAQ do WhatsApp
 * (05/09, que veio dentro de um aviso da plataforma) e agora um do TikTok que **ela mesma mandou**.
 * Os dois primeiros foram consertados na origem — o modo generoso do parser e o filtro de ruído da
 * plataforma —, e este não tinha origem para consertar: quem manda o link é a pessoa.
 *
 * Então a peneira passou a ser sobre a FORMA. `www.`, `://`, um domínio com ponto, um arroba ou uma
 * sequência longa de dígitos não são nome de lugar em nenhuma hipótese, e reconhecer isso não
 * depende de lista nenhuma.
 *
 * **Fica em `naoPodeSerCidade`**, que é por onde o modo generoso já pergunta antes de oferecer
 * qualquer palavra solta — um lugar só, e o mesmo que guarda o vocabulário da campanha.
 */
const ENDERECO_DE_MAQUINA = [
  /https?:\/\//i,
  /\bwww\./i,
  // Domínio: "vt.tiktok.com", "faq.whatsapp.com", "bit.ly". Exige um ponto seguido de sufixo de
  // 2 a 6 letras no fim do trecho -- "Santo Antônio da Patrulha" não casa, e "S.do Livramento"
  // também não (o "do" é seguido de espaço, não de fim).
  /[a-z0-9-]+\.[a-z]{2,6}(\/|$)/i,
  /@/,
  /\d{5,}/,
];

/** O texto é endereço de máquina (link, e-mail) em vez de nome de lugar? */
export function ehEnderecoDeMaquina(texto) {
  const bruto = String(texto || '').trim();
  if (!bruto) return false;
  return ENDERECO_DE_MAQUINA.some((re) => re.test(bruto));
}

/**
 * **Palavras que NENHUM município brasileiro tem no nome.**
 *
 * Print do Sabino (08/09/2026): o campo Cidade dele valia **`transformar nosso país`**, e a
 * extensão não limpava nem corrigia. *"a extensão está falhando em limpar ou corrigir cidades
 * erradas"*. `ehEnderecoDeMaquina` não alcança — aquilo não tem forma de endereço, é frase comum,
 * e a limpeza de 07/09 foi escrita de propósito só para a FORMA.
 *
 * O que faltava era um segundo jeito de dizer "isto não é nome de lugar" sem depender de casar
 * com uma lista de municípios — porque cidade de outro estado **também** não casa, e apagá-la
 * seria destruir dado bom. A resposta é o VOCABULÁRIO: nome de município é substantivo próprio
 * mais conector; verbo, pronome e advérbio nunca aparecem.
 *
 * **A lista foi provada contra os 5.571 municípios do Brasil** (IBGE, baixado em 08/09/2026),
 * não contra os 497 do RS — e foi essa passada que a salvou. Contra o RS só aparecia
 * *"Mariano Moro"*; contra o Brasil inteiro apareceram mais **20**, e três classes que eu não
 * teria imaginado:
 *
 *  - **`Pará` normaliza para `para`** e colidia com a preposição — 12 municípios
 *    (*"Pará de Minas"*, *"Santa Maria do Pará"*, *"Grão-Pará"*);
 *  - **`Patrocínio` É município** em MG, SP e PR — e era a palavra mais óbvia do caso da print;
 *  - **`Sem-Peixe`** (MG) tirou `sem`, e **`Nossa Senhora ...`** obrigou a guardar `nossa`.
 *
 * Hoje: **0 falsos positivos em 5.571**. Quem for acrescentar palavra aqui roda a mesma prova
 * antes — a lista de baixo custa uma passada de um segundo, e o erro dela apaga a cidade de um
 * eleitor real.
 */
const PALAVRAS_QUE_NAO_SAO_LUGAR = new Set([
  // pronomes e possessivos
  'nosso', 'nossos', 'nossas', 'meu', 'minha', 'meus', 'minhas', 'seu', 'sua', 'seus', 'suas',
  'teu', 'tua', 'voce', 'vcs', 'eu', 'ele', 'ela', 'isso', 'isto', 'comigo', 'contigo', 'conosco',
  // advérbios e quantificadores
  'mais', 'menos', 'muito', 'muita', 'tudo', 'nada', 'sempre', 'nunca', 'ja', 'tambem', 'apenas',
  'agora', 'hoje', 'ontem', 'amanha',
  // conectores que não são de toponímia ("para" saiu: colide com Pará; "sem" também: Sem-Peixe)
  'com', 'pra', 'pelo', 'pela', 'que', 'quem', 'quando', 'onde', 'porque', 'pq', 'mas', 'como',
  // verbos
  'transformar', 'mudar', 'apoiar', 'ajudar', 'votar', 'receber', 'quero', 'queria', 'preciso',
  'precisa', 'sou', 'somos', 'estou', 'estamos', 'tenho', 'vamos', 'vou', 'fazer', 'trabalhar',
  'trabalho', 'conte', 'manda', 'mandar', 'enviar', 'falar', 'conversar', 'apoio', 'apoiam',
  'juntos',
  // vocabulário desta base ("patrocinio" saiu: é município em MG, SP e PR)
  'apoiador', 'apoiadores', 'voto', 'votos', 'urna', 'pais', 'politica', 'direita', 'esquerda',
  'material', 'conteudo', 'whatsapp', 'instagram', 'facebook', 'tiktok', 'youtube', 'link',
  'obrigado', 'obrigada', 'oi', 'ola', 'abraco', 'amem',
]);

/** `Nossa Senhora ...` e `Nossa Senhora Aparecida ...` são nomes de município; "nossa" solto não. */
const NOSSA_DE_MUNICIPIO = /(^|[^a-z])nossa\s+(senhora|aparecida)/;
const NOSSA_SOLTA = /(^|[^a-z])nossa(\s|$)/;
/** `Mariano Moro` é município; "moro em Canoas" não é nome de lugar. O que separa é o que vem depois. */
const MORO_EM = /(^|[^a-z])mor[ao]\s+(em|no|na|aqui|perto)/;

/**
 * **Este texto não pode ser nome de lugar, em hipótese nenhuma?**
 *
 * Duas peneiras, e nenhuma delas é "não casou com a lista de municípios": a FORMA
 * (`ehEnderecoDeMaquina` — link, e-mail, sequência de dígitos) e o VOCABULÁRIO
 * (`PALAVRAS_QUE_NAO_SAO_LUGAR`).
 *
 * **É o que separa "não reconheço" de "não é".** *"Curitiba"* não casa com os 497 do RS e é um
 * lugar de verdade — passa aqui, e continua protegida contra a limpeza e contra a substituição.
 * *"transformar nosso país"* não é lugar em lugar nenhum.
 */
export function naoPodeSerNomeDeLugar(texto) {
  const bruto = String(texto || '').trim();
  if (!bruto) return false;
  if (ehEnderecoDeMaquina(bruto)) return true;

  const plano = bruto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  if (MORO_EM.test(plano)) return true;
  if (NOSSA_SOLTA.test(plano) && !NOSSA_DE_MUNICIPIO.test(plano)) return true;
  return plano.split(/[^a-z0-9]+/).filter(Boolean).some((p) => PALAVRAS_QUE_NAO_SAO_LUGAR.has(p));
}

export async function naoPodeSerCidade(texto) {
  // Antes de tudo, e sem depender de lista: link, e-mail, número — ou vocabulário de conversa.
  if (naoPodeSerNomeDeLugar(texto)) return true;

  const norm = normalize(texto);
  if (!norm) return true;

  for (const re of EXPRESSOES_QUE_NAO_SAO_CIDADE) {
    re.lastIndex = 0; // são globais: sem zerar, `test` alterna entre true e false a cada chamada
    if (re.test(norm)) return true;
  }

  const ignoradas = await store.get('cidadesIgnoradas');
  return (ignoradas || []).some((c) => normalize(c) === norm);
}

/**
 * Encurtamentos que nenhuma regra genérica alcança, porque não são prefixo do nome oficial.
 *
 * Ficam aqui, e **não** em `ALIASES`: `normalize()` roda também sobre o nome do município, e
 * "Santana do Livramento" viraria "santana do santana do livramento" — o casamento exato
 * quebrava e a cidade caía em "Santana da Boa Vista". Aqui só o texto do contato passa.
 */
const ENCURTAMENTOS = [[/\blivramento\b/g, 'santana do livramento']];

/** Texto pronto para casar: sem o nome do estado e sem as expressões da campanha. */
function prepararTexto(text) {
  let norm = normalize(text).replace(NOME_DO_ESTADO, ' ');
  for (const re of EXPRESSOES_QUE_NAO_SAO_CIDADE) norm = norm.replace(re, ' ');
  for (const [re, to] of ENCURTAMENTOS) norm = norm.replace(re, to);
  return norm.replace(/\s+/g, ' ').trim();
}

/**
 * O que a pessoa escreveu, reduzido à mesma forma que o nome oficial do município.
 *
 * Serve **só** para as comparações que perguntam "este pedaço é exatamente o município?" —
 * `extract.isCityAlone` e `extract.cidadeSozinha`, as duas que decidem se a pessoa INFORMOU a
 * cidade (e portanto se o valor pode substituir o do CRM).
 *
 * Por que `normalize` sozinho não bastava: ele não sabe que "Livramento" é "Santana do
 * Livramento" (isso é `ENCURTAMENTOS`) nem que "RS" no fim é o estado. A comparação falhava e o
 * efeito era o pior possível — a cidade era reconhecida, o nome NÃO era extraído (porque
 * `findStructured` desiste quando nenhum pedaço é "exatamente" cidade), e a rodada pedia os dados
 * a quem acabara de mandar. Visto ao vivo com `Ulises Sanchez / S.do Livramento.RS` (01/09/2026):
 * o contato respondeu o formulário e recebeu o mesmo pedido no dia seguinte.
 *
 * Ordem importa: a sigla do estado sai ANTES dos encurtamentos, senão "rs" pendurado sobra no fim
 * e a igualdade falha de novo.
 */
export function formaCanonica(valor) {
  let norm = semSufixoDeEstado(valor);
  for (const [re, to] of ENCURTAMENTOS) norm = norm.replace(re, to);
  return norm.replace(/\s+/g, ' ').trim();
}

/**
 * Municípios que a extensão ignora, por decisão do Thiago (aba Config).
 *
 * Nasceu de "Capitão", que colide com a patente do candidato em toda mensagem. Fica
 * configurável em vez de fixo no código porque a próxima campanha muda o nome — e porque
 * apagar um município da lista é decisão dele, não minha.
 */
async function municipiosValidos() {
  const municipios = await loadMunicipios();
  const ignoradas = await store.get('cidadesIgnoradas');
  if (!ignoradas?.length) return municipios;
  const fora = new Set(ignoradas.map((c) => normalize(c)));
  return municipios.filter((c) => !fora.has(normalize(c)));
}

/**
 * O que, numa frase, indica que o município citado é a cidade DA PESSOA.
 *
 * Pedido dele (31/08), com a print do Dirceu: *"a cidade deve sair de um contexto, resposta a
 * minha pergunta, ou a pessoa falar (eu moro em (cidade), eu sou de (cidade))"*.
 *
 * O caso que motivou: a mensagem do anúncio diz *"Vamos juntos mudar o **Rio Grande**"* — que é
 * o estado — e "Rio Grande" é município do RS. A guarda `NOME_DO_ESTADO` só apaga "Rio Grande do
 * Sul" escrito por inteiro, então a forma curta passava e virava popup de cidade.
 *
 * Menção solta deixou de valer. É a mesma lógica que já governa o resto do parser: nome de
 * município no meio de uma frase **prova que o texto contém um nome de município**, não que a
 * pessoa more lá — "meu genro mora em Santiago" é o exemplo que já estava no `CLAUDE.md`.
 */
/**
 * A sigla do estado solta no meio do texto — o gancho da passada que olha para TRÁS do nome.
 *
 * Sem `rio grande do sul` por extenso de propósito: `formaCanonica` já apaga o nome do estado antes
 * de casar (senão "Rio Grande" viraria o município), então procurá-lo aqui não acharia nada.
 */
/**
 * A sigla com QUALQUER separador no meio: `RS`, `R/S`, `R . S`, `R-S`.
 *
 * Anotação do Romário (04/09/2026): ele escreveu *"cidade Panambi R / S"*, e o padrão exigia as
 * duas letras coladas. É a mesma lição da lista de siglas de 01/09 (`rs`, `rgs`, `rgds`, `r s`):
 * **sigla incompleta faz o defeito parecer aleatório** — a mesma pessoa escreve de dois jeitos, e
 * um funciona.
 */
const SUFIXO_ESTADO_SOLTO = /[\s,.\/-]+(r\s*[\/.\-]?\s*s|rgs|rgds)\b/gi;

/**
 * Abreviações de CIDADE que só valem coladas na sigla do estado — ver a passada que as usa.
 *
 * Nunca vão para `ALIASES`: lá elas valeriam no texto inteiro, e `RG` é o documento de identidade.
 */
const SIGLAS_DE_CIDADE = { rg: 'rio grande' };

const PISTAS_DE_CIDADE = [
  /\bmoro\s+(em|no|na|nos|nas)\s+/gi,
  /\bmorando\s+(em|no|na)\s+/gi,
  /\bmoramos\s+(em|no|na)\s+/gi,
  /\bresido\s+(em|no|na)\s+/gi,
  /\bsou\s+(de|do|da|dos|das)\s+/gi,
  /\bsomos\s+(de|do|da)\s+/gi,
  /\b(venho|vim)\s+de\s+/gi,
  /\baqui\s+(em|no|na|de|do|da)\s+/gi,
  /\b(minha|nossa)\s+cidade\s+(é|e)\s+/gi,
  /\bcidade\s*[:\-]\s*/gi,
  /**
   * **"cidade de Gravataí"** — anotação da Maria Virgínia (04/09/2026): *"gravataí não foi
   * identificada"*. A lista tinha `minha cidade é` e `cidade:`, e não a forma mais natural de todas.
   */
  /\bcidade\s+(de|do|da)\s+/gi,
  /**
   * **"cidade Panambi", sem preposição nenhuma** — anotação do Romário (04/09/2026): *"Romario
   * gralow cidade Panambi R / S"*, e *"cidade novamente sem reconhecer"*.
   *
   * Fica DEPOIS da forma com preposição de propósito: assim "cidade de Pelotas" consome o "de" e
   * o alcance começa no nome, em vez de gastar dois caracteres da janela.
   */
  /\bcidade\s+/gi,
  /\b(estou|to|tô)\s+(em|no|na)\s+/gi,
  /\bfica\s+(em|no|na)\s+/gi,
  /\bregi[ãa]o\s+(de|do|da)\s+/gi,
  /\bem\s+/gi, // "material impresso em Pelotas" — preposição de lugar, e a mais comum
  /\/\s*/g, // a resposta ao formulário: "Maria / Santo Ângelo"
];

/**
 * Mensagem curta o bastante para ser, ela mesma, a resposta da cidade.
 *
 * "Sao lourenso" — errado de digitação e sem pista nenhuma — continua sendo a pessoa dizendo onde
 * mora. `cidadeSozinha` exige o nome exato e completo; isto cobre o resto, e só em texto curto:
 * numa frase inteira, nome de município prova que há um nome de município, não onde a pessoa está.
 */
const TEXTO_CURTO = 30;

/** Quanto texto depois da pista ainda pode conter o nome da cidade. */
const ALCANCE_DA_PISTA = 40;

/**
 * O município citado vem depois de uma pista de moradia?
 *
 * Procura a pista e casa o município **só no trecho seguinte a ela**. É o que separa "moro em
 * Rio Grande" de "vamos mudar o Rio Grande".
 */
export async function matchCityComContexto(text) {
  /**
   * **O nome do estado sai ANTES da conta de tamanho** — anotação da Iolanda (04/09/2026): ela
   * escreveu *"Iolanda de Capão da Canoa Rio Grande do Sul."* e a cidade não foi reconhecida, com
   * ele apontando o óbvio: *"está presente na mensagem"*.
   *
   * Medido: sem o estado no fim, os mesmos 25 caracteres achavam Capão da Canoa pelo caminho do
   * texto curto. Com ele, são 43 — passa dos 30 de `TEXTO_CURTO`, e não há pista antes da cidade
   * ("de" sozinho não é pista, e não pode ser: é a preposição mais comum do português).
   *
   * `formaCanonica` já apagava o estado, mas só **depois**, na hora de casar; a conta de tamanho
   * via o texto cru. Escrever a UF por extenso é o jeito mais comum de responder de onde se é, e
   * ela estava justamente encurtando a janela em que a resposta é aceita.
   */
  const bruto = String(text || '').replace(NOME_DO_ESTADO_CRU, ' ').replace(/\s+/g, ' ');
  if (!bruto.trim()) return null;

  /**
   * Texto curto é a própria resposta: vale sem pista — mas só o casamento **EXATO**.
   *
   * Anotação do Luiz Zanchet (02/09/2026): *"Seja bem vindo at a vitória"* — "até a vitória" com um
   * "é" comido — virou **Vitória das Missões**, com confiança `aproximada`, e a etiqueta do
   * município foi parar no contato. É frase de campanha, não é onde ele mora.
   *
   * O casamento aproximado existe para o erro de digitação NA POSIÇÃO da cidade, onde já se sabe
   * que aquilo é uma cidade: a resposta ao formulário. Em texto livre ele transforma qualquer
   * palavra parecida com um município em município — e "vitória", "esperança", "progresso",
   * "campina" são palavras comuns antes de serem cidades.
   *
   * Exigir `exata` aqui não custa nada aos casos reais: "Porto Alegre", "POA", "Novo Hamburgo" e
   * "Portão" casam exato. O que se perde é o palpite em cima de um texto que ninguém disse ser uma
   * cidade — e esse palpite estava virando etiqueta permanente no CRM.
   */
  if (bruto.trim().length <= TEXTO_CURTO) {
    /**
     * **A mensagem que é EXATAMENTE um município de fora vence o palpite do RS** — medido em
     * 08/09/2026: *"São Paulo"* virava **São Paulo das Missões**, porque o caminho do "sufixo
     * omitido" existe para *"São Lourenço"* → São Lourenço do Sul e não sabe distinguir os dois
     * casos. Quem responde o formulário com o nome exato de uma capital não está abreviando o nome
     * de um município do interior gaúcho.
     *
     * Só o casamento LITERAL do texto inteiro passa por aqui; qualquer coisa menos que isso segue
     * para o RS, que continua sendo a lista de casa.
     */
    const exataDeFora = await matchForaDoRS(bruto);
    if (exataDeFora && normalize(exataDeFora.matched) === formaCanonica(bruto)) {
      const doRs = await matchCity(bruto);
      // Compara o NOME DO MUNICIPIO, e nao o `matched`: no caminho do sufixo omitido o `matched` e
      // o pedaco do texto, entao "Sao Paulo" batia consigo mesmo e o RS vencia com
      // "Sao Paulo das Missoes". O que decide e se o municipio do RS E o que ela escreveu.
      const rsLiteral = doRs && normalize(doRs.city) === formaCanonica(bruto);
      if (!rsLiteral) {
        return { city: exataDeFora.city, confidence: 'exata', matched: exataDeFora.matched, foraDoRS: exataDeFora.uf };
      }
    }

    const curto = await matchCity(bruto);
    if (curto?.confidence === 'exata') return curto;
    /**
     * O aproximado vale quando a mensagem INTEIRA foi o que casou — "Sao lourenso" é alguém
     * tentando escrever São Lourenço do Sul, e é o caso que a tolerância existe para atender.
     * O que sai é o casamento de um PEDAÇO: em "Seja bem vindo at a vitória" quem casou foi a
     * palavra "vitória", e o resto da frase é a prova de que ninguém falou de cidade nenhuma.
     *
     * É a mesma conferência de `isCityAlone`, e pela mesma razão.
     */
    if (curto?.confidence === 'aproximada' && normalize(curto.matched || '') === formaCanonica(bruto)) {
      return curto;
    }

    /**
     * **Fora do RS, nesta porta, só quando a mensagem INTEIRA é a cidade** — print da Lenir
     * (08/09/2026), que respondeu o formulário com *"Curitiba"*.
     *
     * A guarda é a mesma do casamento aproximado logo acima, e aqui ela é ainda mais necessária:
     * a lista nacional tem 4.828 nomes e muitos são palavra comum. *"Feliz Natal!"* cabe nos 30
     * caracteres desta porta e contém **Natal** — exigir que o casamento consuma a mensagem toda é
     * o que separa uma resposta de cadastro de uma frase qualquer.
     */
    const fora = await matchForaDoRS(bruto);
    if (fora && normalize(fora.matched) === formaCanonica(bruto)) {
      return { city: fora.city, confidence: 'exata', matched: fora.matched, foraDoRS: fora.uf };
    }
  }

  /**
   * **A SIGLA DO ESTADO depois do nome também é contexto** — duas anotações de 04/09/2026.
   *
   *  - **Maria Virgínia**: *"Eu Rio grande do Sul cidade de Gravataí rs Maria Virgínia da Silva"*;
   *  - **Carmem**: *"CARMEM JUSSARA CORRÊA DA CRUZ. URUGUAIANA RS FRONTEIRA."*
   *
   * As duas escreveram o cadastro inteiro numa frase só, sem pista de lugar na frente e longe
   * demais do corte de "texto curto". Mas **ninguém escreve "RS" depois de uma palavra que não é
   * uma cidade daqui** — a sigla é, ela própria, a afirmação de que o que vem antes é um lugar.
   *
   * As pistas normais olham para a FRENTE do nome; esta olha para trás, e por isso é uma passada
   * própria. Exige casamento `exata`: o aproximado em texto livre é o que transformou "at a
   * vitória" em Vitória das Missões (02/09), e a sigla não muda esse risco.
   */
  SUFIXO_ESTADO_SOLTO.lastIndex = 0;
  let sufixo;
  while ((sufixo = SUFIXO_ESTADO_SOLTO.exec(bruto)) !== null) {
    const antes = bruto.slice(Math.max(0, sufixo.index - ALCANCE_DA_PISTA), sufixo.index);
    const hit = await matchCity(antes);
    if (hit?.confidence === 'exata') return { ...hit, pista: sufixo[0].trim() };

    /**
     * **A cidade também vem abreviada nesta posição** — anotação da Marly (04/09/2026):
     * *"…Praia do Cassino. RG RS"*, e ele: *"ela deu a sigla RG — Rio Grande"*.
     *
     * A abreviação só é lida **colada na sigla do estado**, que é a forma "Cidade/UF" (`RG RS`).
     * Fora daí, `RG` é o documento — a palavra mais comum desta base depois de "nome" —, e um
     * apelido em `ALIASES` valeria no texto inteiro: *"meu RG é 123"* viraria Rio Grande. É a
     * mesma razão pela qual `rio grande` sozinho nunca entra na limpeza do nome do estado.
     *
     * Lista curta e literal, e ela só cresce quando ele trouxer o caso: abreviação de cidade é
     * regional, e inventar uma erra a etiqueta de um município inteiro.
     */
    const ultima = /([\p{L}]{2,4})[\s.,;:-]*$/u.exec(antes);
    const expandida = ultima && SIGLAS_DE_CIDADE[semAcentoNemCaixa(ultima[1])];
    if (expandida) {
      const porSigla = await matchCity(expandida);
      if (porSigla?.confidence === 'exata') return { ...porSigla, pista: `${ultima[1]} ${sufixo[0].trim()}` };
    }
  }

  for (const pista of PISTAS_DE_CIDADE) {
    pista.lastIndex = 0; // regex global guarda posição entre chamadas
    let m;
    while ((m = pista.exec(bruto)) !== null) {
      const inicio = m.index + m[0].length;
      const trecho = bruto.slice(inicio, inicio + ALCANCE_DA_PISTA);
      const hit = await matchCity(trecho);
      if (hit) return { ...hit, pista: m[0].trim() };

      /**
       * **Depois da pista, fora do RS também vale** — *"moro em Curitiba"*, *"sou de Florianópolis"*.
       *
       * Aqui não é preciso consumir a mensagem inteira: quem escreveu *"moro em"* já disse que o
       * que vem a seguir é onde mora. É a mesma autorização que o RS usa nesta porta — a diferença
       * é só qual lista responde, e o RS responde primeiro.
       */
      const fora = await matchForaDoRS(trecho);
      if (fora) {
        return { city: fora.city, confidence: 'exata', matched: fora.matched, foraDoRS: fora.uf, pista: m[0].trim() };
      }
    }
  }
  return null;
}

/**
 * **Os municípios do Brasil FORA do RS** — pedido dele (08/09/2026), com a print da etiqueta
 * *"Fora do RS"* que ele criou: *"quando for o caso marcar com a etiqueta da print"*.
 *
 * Veio da print da Lenir, que respondeu o formulário com *"Curitiba"* e ficou sem cadastro nenhum:
 * a extensão só conhece os 497 do RS, então quem mora fora era invisível.
 *
 * **Lista SEPARADA da do RS, e nunca misturada**, por três razões:
 *
 *  1. **o RS tem que vencer sempre** — só se consulta esta quando a busca no RS não achou nada, e
 *     por construção: os 497 não estão aqui dentro;
 *  2. **a etiqueta é outra.** Município do RS vira etiqueta de cidade e de COREDE, que é o filtro
 *     dele; município de fora vira a etiqueta "Fora do RS" e mais nada — o mapa de COREDEs é
 *     estadual, e criar etiqueta de cidade de outro estado partiria o filtro em duas coisas;
 *  3. **o casamento é EXATO e sem tolerância.** São 4.828 nomes, e muitos são palavra comum
 *     ("Natal", "Serra", "Barra", "Bonito", "Vitória", "Progresso"). Com Levenshtein por cima disso
 *     qualquer frase viraria cidade.
 *
 * Nome repetido em mais de um estado guarda só a primeira UF — ela serve para mostrar na tela, não
 * para decidir nada.
 */
let foraDoRsCache = null;

async function municipiosForaDoRS() {
  if (foraDoRsCache) return foraDoRsCache;
  try {
    const res = await fetch(chrome.runtime.getURL('src/data/municipios-br.json'));
    const dados = await res.json();
    foraDoRsCache = dados?.municipios || {};
  } catch (err) {
    console.warn('[WhatsFill] não consegui ler a lista de municípios do Brasil:', err.message);
    foraDoRsCache = {};
  }
  return foraDoRsCache;
}

/**
 * O texto contém um município de FORA do RS? Casamento exato, sem tolerância.
 *
 * Devolve `{ city, uf, matched }` ou `null`. **Quem chama decide se aquele lugar do texto autoriza
 * a leitura** — é a mesma disciplina do RS: cidade só sai de contexto, nunca de menção solta.
 */
export async function matchForaDoRS(text) {
  const norm = prepararTexto(text);
  if (!norm) return null;
  if (naoPodeSerNomeDeLugar(text)) return null;

  const municipios = await municipiosForaDoRS();
  let best = null;
  for (const city of Object.keys(municipios)) {
    const n = normalize(city);
    // O piso de 5 é mais alto que o do RS (4): aqui não há a curadoria de `cidadesIgnoradas`, e
    // nome de três ou quatro letras ("Icó", "Uru", "Ibiá") casaria dentro de palavra comum.
    if (n.length >= 5 && norm.includes(n)) {
      if (!best || n.length > normalize(best).length) best = city;
    }
  }
  return best ? { city: best, uf: municipios[best], matched: best } : null;
}

/**
 * **O valor do campo Cidade É, exatamente, um município de fora do RS?** Devolve a UF, ou `''`.
 *
 * Quem pergunta é o painel, para a etiqueta *"Fora do RS"* e para o aviso de grafia. Exige o valor
 * INTEIRO — *"Rua Natal, 300"* não é Natal, e o campo é texto livre digitado à mão há anos.
 */
export async function ufForaDoRS(valor) {
  const bruto = String(valor || '').trim();
  if (!bruto) return '';
  const fora = await matchForaDoRS(bruto);
  if (!fora || normalize(fora.matched) !== formaCanonica(bruto)) return '';
  // O RS vence sempre: se o mesmo texto também é um município daqui, não é caso de "fora".
  const doRs = await matchCity(bruto);
  if (doRs && normalize(doRs.city) === formaCanonica(bruto)) return '';
  return fora.uf;
}

export async function matchCity(text) {
  const municipios = await municipiosValidos();
  if (!municipios.length) return null;

  const norm = prepararTexto(text);
  if (!norm) return null;

  // 1) Nome inteiro aparece no texto. Preferimos o mais longo ("Santo Ângelo" antes de "Ângelo").
  let best = null;
  for (const city of municipios) {
    const n = normalize(city);
    if (n.length >= 4 && norm.includes(n)) {
      if (!best || n.length > normalize(best).length) best = city;
    }
  }
  if (best) return { city: best, confidence: 'exata', matched: best };

  const words = norm.split(' ').filter(Boolean);
  const lista = municipios.map((city) => {
    const n = normalize(city);
    return { city, n, partes: n.split(' ') };
  });

  // 2) Erro de digitação no nome INTEIRO: "Caxias do Sull", "Erechin".
  let melhor = null;
  for (const m of lista) {
    if (m.n.length < 4) continue;
    // Município de nome curto exige grafia exata (o passo 1 já pega essa). Com tolerância, uma
    // palavra comum de quatro letras virava cidade: "o cara" casava com **Caraá** a distância 1,
    // e o painel oferecia etiqueta de região para quem só elogiou o candidato.
    const tol = m.n.length <= 5 ? 0 : tolerance(m.n);
    for (let size = 1; size <= 4; size++) {
      for (let i = 0; i + size <= words.length; i++) {
        const gram = words.slice(i, i + size).join(' ');
        if (Math.abs(gram.length - m.n.length) > tol) continue;
        const d = levenshtein(gram, m.n);
        if (d <= tol && (!melhor || d < melhor.d)) melhor = { city: m.city, d, gram };
      }
    }
  }
  if (melhor) {
    return { city: melhor.city, confidence: melhor.d === 0 ? 'exata' : 'aproximada', matched: melhor.gram };
  }

  // 3) Sufixo omitido: a pessoa escreve "São Lourenço" e o município é "São Lourenço do Sul".
  //    Não é erro de digitação — a distância até o nome completo é grande demais — então
  //    comparamos com o PREFIXO do município que tem o mesmo número de palavras.
  return prefixoDeMunicipio(words, lista);
}

/**
 * Casa um pedaço do texto com o começo do nome de um município.
 *
 * Três travas, cada uma tirada de um jeito real de errar:
 *
 * - **Uma palavra só é aceita, mas nunca como valor exato.** Era o mínimo de duas, e por isso
 *   "Palmares" (Palmares do Sul) e "Sentinela" (Sentinela do Sul) não eram reconhecidos — o
 *   jeito mais comum de encurtar. Quem protege contra "Carlos" virar "Carlos Barbosa" não é a
 *   contagem de palavras, é a trava da preposição logo abaixo: "Barbosa" não é preposição, então
 *   "Carlos" continua não casando. As duas travas que sobram para o pedaço de uma palavra são
 *   o tamanho mínimo de 6 letras (tira "Passo", "Porto", "Santa") e a confiança **aproximada**,
 *   que espera clique e nunca é gravada sozinha.
 * - **O texto não pode estar continuando o nome.** Em "Vila Nova do Nada", o pedaço
 *   "vila nova" é prefixo de "Vila Nova do Sul", mas a palavra seguinte no texto ("do") é
 *   também a próxima do município: a pessoa está escrevendo um nome mais longo, que não é esse.
 *   Já em "sou de são lourenço e quero ajudar", a seguinte é "e", que não continua o nome.
 * - **O sufixo omitido tem que começar com preposição.** É assim que se encurta nome de cidade
 *   em português: "São Lourenço ~~do Sul~~", "Santa Cruz ~~do Sul~~". Ninguém encurta "Vila Nova
 *   do Sul" para "Vila Nova do" — e era justamente assim que "Vila Nova do Nada", um lugar
 *   inexistente, virava "Vila Nova do Sul".
 * - **Empate não vira palpite.** "Porto" prefixa cinco municípios; nesse caso não devolvemos
 *   nada e o painel oferece as parecidas para você escolher.
 */
const PREPOSICOES = new Set(['do', 'da', 'de', 'dos', 'das']);

function prefixoDeMunicipio(words, lista) {
  let melhor = null;

  for (let i = 0; i < words.length; i++) {
    for (let size = Math.min(4, words.length - i); size >= 1; size--) {
      const gram = words.slice(i, i + size).join(' ');
      if (gram.length < 6) continue;
      const seguinte = words[i + size] || null;

      const candidatos = [];
      for (const m of lista) {
        if (m.partes.length <= size) continue; // precisa sobrar sufixo para ter sido omitido
        if (!PREPOSICOES.has(m.partes[size])) continue; // sufixo que ninguém omite
        const prefixo = m.partes.slice(0, size).join(' ');
        const tol = tolerance(prefixo);
        if (Math.abs(gram.length - prefixo.length) > tol) continue;
        const d = levenshtein(gram, prefixo);
        if (d > tol) continue;
        if (seguinte && seguinte === m.partes[size]) continue; // o texto continua o nome
        candidatos.push({ city: m.city, d });
      }
      if (!candidatos.length) continue;

      const menor = Math.min(...candidatos.map((c) => c.d));
      const empatados = [...new Set(candidatos.filter((c) => c.d === menor).map((c) => c.city))];
      if (empatados.length > 1) continue; // ambíguo: recusa em vez de chutar

      if (!melhor || menor < melhor.d) melhor = { city: empatados[0], d: menor, gram };
      break; // nesta posição já valeu o pedaço mais longo
    }
  }

  if (!melhor) return null;

  /**
   * Quando o prefixo vale como EXATO — que é o que grava sem clique.
   *
   * Escrito certo (`d === 0`) e com duas palavras ou mais, sempre: "Santa Cruz" só pode ser
   * Santa Cruz do Sul.
   *
   * Com uma palavra só, vale quando ela é a resposta INTEIRA. "Caxias", sozinho no campo da
   * cidade, é Caxias do Sul e não havia por que esperar clique — foi o relato dele. Já
   * "trabalhei em Caxias uns anos" é menção no meio de uma frase: continua palpite, porque a
   * palavra solta pode ser nome de gente ("Vitória", "Esperança", "Rosário" também são começo
   * de município) e aí gravar sozinho trocaria a cidade de um eleitor.
   */
  const umaPalavra = melhor.gram.split(' ').length === 1;
  const respostaInteira = melhor.gram === words.join(' ');
  const exato = melhor.d === 0 && (!umaPalavra || respostaInteira);

  return { city: melhor.city, confidence: exato ? 'exata' : 'aproximada', matched: melhor.gram };
}

/**
 * Cadastro no formato "Cidade - Nome" ("Canoas - Marines"), que é como parte da base foi
 * digitada. Sem separar, o primeiro nome vira a cidade e a saudação sai "Boa noite, Canoas!".
 *
 * Só separa quando a esquerda é **exatamente** um município do RS. Duas travas, porque errar
 * aqui troca o nome de um eleitor:
 *  - o casamento tem que ser `exata` (palpite aproximado não separa nada);
 *  - o município casado tem que cobrir a esquerda inteira, senão "Grupo Canoas - Marines"
 *    também seria separado.
 *
 * @returns {Promise<{cidade:string, nome:string}|null>}
 */
/**
 * O texto SEM o pedaço que é o município — preservando acento e caixa do que sobra.
 *
 * Relato dele (02/09/2026): *"não pegou POA como cidade, seria porto alegre"*. A cidade era
 * reconhecida; o que quebrava era **a sobra**. Quem a calculava removia o nome OFICIAL
 * ("Porto Alegre") de um texto onde ela escreveu **"POA"** — não removia nada, e então
 * "Vera POA" virava o nome "Vera Poa" com a cidade rebaixada a palpite, e "POA" sozinho virava
 * o nome "Poa".
 *
 * A raiz é que o casamento acontece no texto NORMALIZADO, onde o apelido já virou "porto alegre",
 * e a remoção acontecia no texto CRU. Aqui os dois passam pelo mesmo `normalize`: procura-se o
 * menor trecho de palavras cujo texto normalizado contenha o município. Por construção não há como
 * discordar do casador — é a mesma função.
 *
 * Devolve o texto inteiro quando não acha (nada a remover é melhor que remover a esmo).
 */
export function semACidade(texto, city) {
  const bruto = String(texto || '').trim();
  const alvo = normalize(city);
  if (!bruto || !alvo) return bruto;

  const palavras = bruto.split(/\s+/);
  let melhor = null;
  for (let i = 0; i < palavras.length; i++) {
    for (let j = i + 1; j <= palavras.length; j++) {
      if (!normalize(palavras.slice(i, j).join(' ')).includes(alvo)) continue;
      // O MENOR trecho que basta: "Vera POA" tem que perder só "POA", não a frase toda.
      if (!melhor || j - i < melhor.j - melhor.i) melhor = { i, j };
      break;
    }
  }
  if (!melhor) return bruto;

  return [...palavras.slice(0, melhor.i), ...palavras.slice(melhor.j)].join(' ').replace(/\s+/g, ' ').trim();
}

export async function splitCidadeNome(texto) {
  const m = /^(.{3,40}?)\s*[-–—|/]\s*(.{2,60})$/.exec(String(texto || '').trim());
  if (!m) return null;

  const esquerda = m[1].trim();
  const direita = m[2].trim();
  if (!esquerda || !direita) return null;

  // "Canoas - Marines": a cidade vem primeiro.
  if (/\p{L}{2}/u.test(direita) && (await ehExatamenteCidade(esquerda))) {
    return { cidade: (await matchCity(esquerda)).city, nome: direita };
  }

  /**
   * "Luci - Porto Alegre": a cidade vem DEPOIS do nome.
   *
   * Metade da base foi digitada assim, e sem este ramo a cidade que está no próprio cadastro
   * ficava invisível — o contato aparecia sem cidade (ou com a cidade velha e errada do CRM)
   * mesmo tendo "Porto Alegre" escrito no nome.
   *
   * Exige o nome COMPLETO do município, nunca prefixo: "Ana - Vitória" não pode virar Vitória
   * das Missões, porque "Vitória" ali é quase certamente gente.
   */
  if (/\p{L}{2}/u.test(esquerda) && (await ehExatamenteCidade(direita))) {
    return { cidade: (await matchCity(direita)).city, nome: esquerda };
  }

  return null;
}

/**
 * O texto é, inteiro, o nome de um município — com certeza suficiente para trocar o nome de um
 * eleitor?
 *
 * Aceita o nome completo ("Porto Alegre", "Sto Angelo" pelo apelido) e o encurtamento de **duas
 * palavras ou mais** ("Santa Cruz" → Santa Cruz do Sul), que não tem como ser outra coisa.
 *
 * Recusa encurtamento de uma palavra só. "Vitória", "Esperança" e "Rosário" são começo de
 * município do RS **e** nome de gente — e aqui um erro não deixa a cidade errada, deixa o
 * eleitor com o nome errado.
 */
async function ehExatamenteCidade(texto) {
  const casou = await matchCity(texto);
  if (!casou || casou.confidence !== 'exata') return false;

  const alvo = normalize(texto);
  if (normalize(casou.city) === alvo) return true;
  return normalize(casou.matched) === alvo && alvo.split(' ').length >= 2;
}

/** As N cidades mais parecidas, para o painel oferecer como botão quando erra. */
export async function suggest(text, n = 3) {
  const municipios = await loadMunicipios();
  const norm = normalize(text);
  if (!norm) return [];
  return municipios
    .map((city) => ({ city, d: levenshtein(norm, normalize(city)) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((x) => x.city);
}

/**
 * Link do grupo para a cidade. Devolve o motivo quando não encontra, para o painel
 * poder explicar por que o envio está bloqueado em vez de mandar {{link_grupo}} cru.
 */
export async function linkFor(city) {
  const links = await store.get('cityLinks');
  const fallback = await store.get('defaultGroupLink');
  const key = normalize(city);

  if (key && links[key]?.link) return { link: links[key].link, source: 'cidade' };

  /**
   * **O link PADRÃO era inalcançável sem cidade — e sem cidade é justamente a chegada.**
   *
   * O `if (!key) return` ficava ACIMA daqui e devolvia *"Cidade não definida"*, então
   * `{{link_grupo}}` bloqueava o envio mesmo com o link padrão preenchido na Config. Ou seja: o
   * campo que existe para o caso *"não tenho o grupo desta cidade"* não valia no caso mais comum
   * de todos, que é **não ter cidade nenhuma** — quem acaba de chegar pelo anúncio.
   *
   * Apareceu em 07/09/2026, quando ele pediu a resposta que manda a pessoa entrar no grupo para
   * acompanhar a agenda: a print era um contato do anúncio *CONVERSE CONOSCO* com Cidade vazia.
   *
   * **A prioridade não muda:** grupo da cidade primeiro, padrão depois. O que muda é o padrão
   * passar a ser consultado sempre — e `source` continua dizendo qual dos dois respondeu, que é o
   * que a aba Dados mostra.
   */
  if (fallback) return { link: fallback, source: 'padrão' };

  // Sem cidade E sem link padrão: as DUAS saídas resolvem, então as duas são ditas. Nomear só uma
  // e o que faz a pessoa ir mexer no lugar errado — a família do aviso que mandava procurar o
  // interruptor na aba de onde ele havia saído.
  if (!key) {
    return {
      link: null,
      reason:
        'Cidade ainda não classificada e sem link padrão de grupo — preencha a Cidade na aba Dados, ' +
        'ou o "Link padrão" na aba Config.',
    };
  }
  return {
    link: null,
    reason: `Sem grupo cadastrado para "${city}" e sem link padrão. Cadastre na aba Config.`,
  };
}

/** Editor da tabela em texto: uma linha por cidade, "Cidade = link". */
export function parseCityLinksText(text) {
  const out = {};
  for (const rawLine of String(text || '').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const label = line.slice(0, idx).trim();
    const link = line.slice(idx + 1).trim();
    if (!label || !link) continue;
    out[normalize(label)] = { label, link };
  }
  return out;
}

export function formatCityLinks(map) {
  return Object.values(map || {})
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
    .map((v) => `${v.label} = ${v.link}`)
    .join('\n');
}
