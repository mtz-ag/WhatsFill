/**
 * vars.js — interpolação das variáveis dos templates.
 *
 * Guarda-corpo principal da extensão: `render` devolve também a lista de variáveis que
 * NÃO puderam ser resolvidas. Quem chama nunca deve enviar quando essa lista não está
 * vazia — é o que impede um "{{link_grupo}}" cru chegar no contato.
 */

import * as cities from './cities.js';
import * as perfis from './perfis.js';

export const KNOWN_VARS = [
  ['{{saudacao}}', 'Bom dia / Boa tarde / Boa noite, conforme a hora'],
  // As duas do nome continuam funcionando, mas saíram das respostas: ver `semVocativo`.
  ['{{nome}}', 'Nome completo do contato (evite: o cadastro erra, e sem valor trava o envio)'],
  ['{{primeiro_nome}}', 'Só o primeiro nome (evite, mesmo motivo)'],
  ['{{cidade}}', 'Cidade classificada do contato'],
  ['{{link_grupo}}', 'Link do grupo do WhatsApp (aba Config)'],
  // Os dois formulários (09/11/2026) — campo na aba Config, por candidato. Vazio BLOQUEIA o envio,
  // que é a trava certa: resposta que promete um formulário não pode sair sem o endereço dele.
  ['{{link_demanda}}', 'Link do formulário de demandas (aba Config)'],
  ['{{link_agenda}}', 'Link do formulário de agenda e visitas (aba Config)'],
  ['{{telefone}}', 'Telefone formatado'],
  // `{{funcao}}` e `{{partido}}` saíram em 01/09/2026 com os campos que os alimentavam. Resposta
  // salva que ainda use uma delas passa a bloquear o envio com o motivo na tela ("variável
  // desconhecida"), que é o comportamento certo: melhor recusar do que mandar o texto com o
  // marcador cru para o eleitor.
];

/**
 * Tira o vocativo de nome de um texto de resposta — "Obrigado, {{primeiro_nome}}!" vira
 * "Obrigado!".
 *
 * Chamar o contato pelo nome saiu do fluxo por decisão do Thiago (10/08), e o motivo é o
 * cadastro: o nome que está no CRM erra com frequência alta demais para ir num texto que a
 * pessoa lê. Já vimos apelido do perfil no lugar do nome ("Zane" por "Rosane Requia"), cidade
 * no campo do nome ("Santa Cruz - Serlei"), sigla de partido colada ("Jeane do PL"), abreviação
 * ("srn") e o apelido automático do anúncio ("[NOVO] (51) 9…"). Errar o nome de alguém é o tipo
 * de erro que o contato percebe na hora — e o acerto não vale nada perto disso.
 *
 * De quebra some o outro lado do problema: `{{primeiro_nome}} `sem valor **bloqueia o envio**, e
 * esse bloqueio já tirou opção da pergunta da rodada duas vezes.
 *
 * Puro e exportado para ter teste: ele reescreve texto que vai para eleitor real.
 */
const VAR_NOME = String.raw`\{\{\s*(?:primeiro_nome|nome)\s*\}\}`;

export function semVocativo(texto) {
  return String(texto || '')
    // "…, {{primeiro_nome}}!" / "…, {{nome}}:" — o vocativo entre vírgula e pontuação.
    .replace(new RegExp(String.raw`,\s*${VAR_NOME}\s*(?=[!?.,:;])`, 'gi'), '')
    // "Olá {{primeiro_nome}}, tudo bem?" — a vírgula é do resto da frase, então fica.
    .replace(new RegExp(String.raw`\s+${VAR_NOME}\s*(?=,)`, 'gi'), '')
    // "{{primeiro_nome}}, agradeço…" — começo de frase.
    .replace(new RegExp(String.raw`^${VAR_NOME}\s*,\s*`, 'gim'), '')
    // Qualquer sobra solta.
    .replace(new RegExp(String.raw`\s*${VAR_NOME}`, 'gi'), '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([!?.,:;])/g, '$1')
    .replace(/[ \t]+$/gm, '');
}

/** O texto ainda chama o contato pelo nome? Usado para avisar no editor de respostas. */
export function usaNome(texto) {
  return new RegExp(VAR_NOME, 'i').test(String(texto || ''));
}

export function saudacao(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function firstName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/);
  return parts[0] || '';
}

/**
 * Primeiro nome que não é nome de gente. Cidade no campo do nome é o caso que a regra do
 * vocativo já recusa ("Santa Cruz - Serlei"); aqui o mesmo lixo não pode virar gênero.
 */
const NAO_E_NOME = new Set(['santa', 'santo', 'porto', 'rio', 'sao', 'nova', 'novo', 'vila', 'morro', 'vale', 'serra']);

/** Não termina em -a e mesmo assim é feminino. Marli é o caso de 06/09. */
const FEMININOS = new Set([
  'beatriz', 'isabel', 'raquel', 'ines', 'rute', 'ruth', 'ester', 'esther', 'miriam',
  'alice', 'nicole', 'caroline', 'ellen', 'karen', 'ingrid', 'jennifer', 'simone',
  'denise', 'marlene', 'neide', 'irene', 'ione', 'rose', 'noemi', 'marli', 'sueli',
  'cleci', 'neli', 'ivani', 'solange', 'josiane', 'eliane',
]);

/** Não termina em -o e mesmo assim é masculino. Cauã vira "caua" sem acento. */
const MASCULINOS = new Set([
  'jose', 'joao', 'andre', 'luiz', 'luis', 'carlos', 'marcos', 'lucas', 'matheus',
  'mateus', 'jonas', 'felipe', 'filipe', 'henrique', 'vicente', 'jorge', 'luca',
  'caua', 'kaua',
]);

/**
 * 'f', 'm' ou null. Null é "não dá para saber" — aí o texto não muda.
 *
 * Só o primeiro nome. O resto do cadastro (sobrenome, cidade) não entra. Apelido de
 * anúncio e nome sem vogal devolvem null: é o mesmo lixo que a regra 1 recusa usar.
 */
export function generoDoNome(nome) {
  if (looksLikePlaceholder(nome) || nomeSemSentido(nome)) return null;
  const primeiro = achatarNome(firstName(nome)).split(' ')[0];
  if (!primeiro || primeiro.length < 2 || NAO_E_NOME.has(primeiro)) return null;
  if (FEMININOS.has(primeiro)) return 'f';
  if (MASCULINOS.has(primeiro)) return 'm';
  if (primeiro.endsWith('a')) return 'f';
  if (primeiro.endsWith('o')) return 'm';
  return null;
}

/**
 * As duas palavras que as boas-vindas usam para falar COM a pessoa.
 *
 * "todo mundo é bem-vindo" fica: aquilo não é o tratamento dela. "bem-vindos" também,
 * porque é plural. O "obrigado" de quem escreve não entra — é do mandato, e continua
 * no masculino por decisão dele.
 */
export function concordarGenero(texto, nome) {
  const g = generoDoNome(nome);
  if (g !== 'f' && g !== 'm') return String(texto || '');
  const pares = g === 'f'
    ? [[/bem-vindo(?!s)/giu, 'bem-vinda'], [/atendê-lo/giu, 'atendê-la'], [/atende-lo/giu, 'atende-la']]
    : [[/bem-vinda(?!s)/giu, 'bem-vindo'], [/atendê-la/giu, 'atendê-lo'], [/atende-la/giu, 'atende-lo']];
  let s = String(texto || '');
  for (const [re, para] of pares) {
    s = s.replace(re, (m, ...rest) => {
      const offset = rest[rest.length - 2];
      const antes = s.slice(Math.max(0, offset - 9), offset);
      if (/mundo é $|mundo e $/i.test(antes)) return m;
      const letra = m[0];
      if (letra !== letra.toLowerCase()) return para[0].toUpperCase() + para.slice(1);
      return para;
    });
  }
  return s;
}

/**
 * O contato que chega do anúncio vem cadastrado como "[NOVO] (51) 99999-9999", e mandar
 * "Boa noite, [NOVO]!" é pior do que não usar nome nenhum. Aqui a extensão reconhece esses
 * apelidos automáticos e trata como "sem nome" — o que faz o envio travar em vez de sair
 * errado, até o parser (ou você) preencher o nome de verdade.
 */
export function looksLikePlaceholder(name) {
  const s = String(name || '').trim();
  if (!s) return true;
  if (/^\[/.test(s)) return true; // "[NOVO] ...", "[SEM NOME]"
  if (/^novo\b/i.test(s)) return true;
  const letras = s.replace(/[^\p{L}]/gu, '');
  return letras.length < 3; // sobrou basicamente um telefone
}

/**
 * O nome do cadastro está SEM SENTIDO ou em falta?
 *
 * Pedido dele (31/08): *"uma exceção pra pedir [os dados] é somente quando o nome da pessoa
 * estiver totalmente sem sentido ou em falta"*. Antes a rodada sugeria pedir dados a quem não
 * tinha etiqueta de cidade — e isso pegava gente já classificada, com etiqueta, só porque a
 * cidade ainda não tinha entrado.
 *
 * Vai além do `looksLikePlaceholder`, que resolve o "em falta" (vazio, "[NOVO] …", telefone no
 * lugar do nome). O "sem sentido" que sobra é o cadastro **sem vogal nenhuma** — "srn", "kkk",
 * iniciais soltas —, que não é nome de gente e não serve para nada no CRM.
 *
 * Separado do `looksLikePlaceholder` de propósito: aquele decide se o **vocativo** pode sair numa
 * mensagem, e alargá-lo mudaria o bloqueio de envio em toda parte.
 */
export function nomeSemSentido(name) {
  if (looksLikePlaceholder(name)) return true;
  const letras = String(name || '').replace(/[^\p{L}]/gu, '');
  return !/[aeiouáàâãéêíóôõúü]/i.test(letras);
}

/** Sem acento e sem caixa, para comparar o que está ESCRITO em dois nomes. */
function achatarNome(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * O nome do cadastro contradiz o que a pessoa acabou de informar?
 *
 * Existe para SEPARAR o contato, não para corrigi-lo. Decisão dele (31/08), diante do caso do
 * cadastro "viver a vida" com a pessoa respondendo "Daniel Ribeiro/Canoas": *"ou trocar o nome
 * pela extensão ou separar esse contato deixando para o final e eu mesmo arrumar"* — e ele
 * escolheu separar. O nome nativo do contato **nunca** é sobrescrito por aqui.
 *
 * **Divergir não é ser diferente.** Três casos que NÃO contam, e cada um viraria uma fila de
 * revisão inútil:
 *
 *  - **um contém o outro** — "Daniel" x "Daniel Ribeiro" é a mesma pessoa dando o nome completo;
 *  - **acento e caixa** — "JOSE" x "José" resolvem para a mesma pessoa;
 *  - **cadastro vazio ou de anúncio** (`looksLikePlaceholder`) — aí não há contradição, há
 *    buraco, e buraco o parser preenche sozinho como sempre fez.
 *
 * O que sobra é o caso dele: o cadastro diz uma coisa e a pessoa diz outra, e alguém precisa
 * olhar. Note que `nomeSemSentido` não serve aqui — "viver a vida" tem vogais e não é
 * placeholder, então passa nele. É a DIVERGÊNCIA que denuncia, não a forma do cadastro.
 *
 * @param {string} cadastro o que está no CRM
 * @param {string} informado o que a pessoa escreveu
 * @returns {boolean}
 */
export function nomeDivergeDoInformado(cadastro, informado) {
  const dado = achatarNome(informado);
  const crm = achatarNome(cadastro);
  if (!dado || !crm) return false;
  if (looksLikePlaceholder(cadastro)) return false;
  if (crm === dado) return false;
  if (crm.includes(dado) || dado.includes(crm)) return false;
  return true;
}

/**
 * O nome do cadastro é só o apelido do perfil do WhatsApp?
 *
 * Caso real: o cadastro dizia "Zane" (nome do perfil) e a pessoa respondeu "Rosane Requia" no
 * formulário. A regra "nunca sobrescrever o CRM" descartava a resposta dela, e o agradecimento
 * sairia "Obrigado pela atenção, Zane!" — erro que o contato percebe na hora.
 *
 * A distinção que resolve: cadastro **igual** ao nome do perfil quer dizer que ninguém digitou
 * nada ali; foi o WhatsApp que preencheu. Nome que um operador escreveu continua ganhando do
 * palpite, como sempre.
 */
export function nomeVeioDoPerfil(contact) {
  const cadastro = String(contact?.name || '').trim();
  const perfil = String(contact?.nameWhatsapp || '').trim();
  if (!cadastro || !perfil) return false;
  return cadastro.localeCompare(perfil, 'pt-BR', { sensitivity: 'base' }) === 0;
}

/**
 * Monta o dicionário de variáveis a partir do contexto do atendimento.
 * @param {object} ctx { contact, nome, cidade, funcao, partido }
 *   `nome` é o que está na aba Dados (parser ou digitado) e tem prioridade sobre o cadastro.
 */
export async function buildContext(ctx = {}) {
  const doCadastro = ctx.contact?.name || ctx.contact?.nameWhatsapp || '';
  const nome = ctx.nome || (looksLikePlaceholder(doCadastro) ? '' : doCadastro);
  const cidade = ctx.cidade || '';

  /**
   * **`linkFor` é chamado mesmo SEM cidade** — a outra metade do conserto de 07/09/2026.
   *
   * Antes, cidade vazia nem consultava: o motivo virava *"Cidade ainda não classificada"* e
   * `{{link_grupo}}` bloqueava o envio. Com o link preenchido, a resposta que só precisa do link
   * (a do grupo da agenda) passa a funcionar na chegada, que é quando ela é usada.
   *
   * **A cidade deixou de importar aqui em 03/11/2026**, quando a tabela de grupos por cidade saiu
   * (*"função nunca foi utilizada"*): há um link só. Antes a nota dizia que a resposta `link-grupo`
   * se protegia sozinha porque exige `{{cidade}}` — e isso era falso, porque `{{cidade}}` só barra
   * a cidade **vazia**: com a tabela vazia e a cidade preenchida, ela saía dizendo *"o grupo de
   * Caxias do Sul"* sobre o link geral. Hoje o texto da resposta não promete mais o grupo da
   * cidade, que é a trava certa.
   */
  const resolved = await cities.linkFor(cidade);
  const linkGrupo = resolved.link || '';
  const linkReason = resolved.reason || null;

  /**
   * **Os dois formulários** (09/11/2026) — lidos do candidato ATIVO, como o link do grupo.
   *
   * Vazio devolve motivo próprio em vez do genérico *"variável sem valor"*: o que ele precisa saber
   * é ONDE se mexe, e a lição é a mesma da cidade em 03/11 — motivo que diz o sintoma custa uma
   * sessão de diagnóstico.
   */
  const linkDemanda = String((await perfis.lerDoAtivo('linkDemanda', '')) || '').trim();
  const linkAgenda = String((await perfis.lerDoAtivo('linkAgenda', '')) || '').trim();

  return {
    values: {
      saudacao: saudacao(),
      nome,
      primeiro_nome: firstName(nome),
      cidade,
      link_grupo: linkGrupo,
      link_demanda: linkDemanda,
      link_agenda: linkAgenda,
      telefone: ctx.contact?.phonenumberFormatted || ctx.contact?.phonenumber || '',
    },
    reasons: {
      /**
       * **O motivo da CIDADE passou a ser dela** (03/11/2026).
       *
       * Até aqui quem dizia *"preencha a Cidade na aba Dados"* era o motivo do `{{link_grupo}}`,
       * porque o link vinha da tabela por cidade. Com a tabela removida, o link deixou de falar da
       * cidade — e uma resposta dele que use `{{cidade}}` cairia no genérico *"Variável {{cidade}}
       * sem valor"*, que diz o sintoma e não onde se mexe.
       */
      cidade: cidade ? null : 'Cidade ainda não classificada — preencha a Cidade na aba Dados.',
      link_grupo: linkReason,
      link_demanda: linkDemanda ? null : 'Link do formulário de demandas ainda não preenchido — cartão "Formulários", aba Config.',
      link_agenda: linkAgenda ? null : 'Link do formulário de agenda ainda não preenchido — cartão "Formulários", aba Config.',
      nome: nome ? null : 'Nome ainda não preenchido (o cadastro está com apelido automático) — preencha na aba Dados.',
      primeiro_nome: nome
        ? null
        : 'Nome ainda não preenchido (o cadastro está com apelido automático) — preencha na aba Dados.',
    },
  };
}

/**
 * @returns {{text:string, missing:string[], reasons:object}}
 */
export function render(template, context) {
  const missing = [];
  const text = String(template || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (full, rawName) => {
    const name = rawName.toLowerCase();
    const value = context.values[name];
    if (value === undefined) {
      missing.push(name);
      return full; // mantém o marcador visível no preview
    }
    if (value === '') {
      missing.push(name);
      return full;
    }
    return value;
  });

  // O texto de fábrica é masculino. O nome do contato, quando dá para saber, concorda.
  // Sem nome (ou nome que não é nome), o texto sai como está.
  // O texto de fábrica é masculino. O nome do contato, quando dá para saber, concorda.
  // Sem nome (ou nome que não é nome), o texto sai como está.
  const concordado = concordarGenero(text, context.values?.nome || '');
  return { text: concordado, missing: [...new Set(missing)], reasons: context.reasons || {} };
}

/** Mensagem curta explicando por que o envio está bloqueado. */
export function explainMissing(missing, reasons) {
  const vistos = new Set();
  return missing
    .map((name) => reasons[name] || `Variável {{${name}}} sem valor.`)
    .filter((motivo) => {
      if (vistos.has(motivo)) return false; // {{nome}} e {{primeiro_nome}} têm o mesmo motivo
      vistos.add(motivo);
      return true;
    })
    .join(' ');
}
