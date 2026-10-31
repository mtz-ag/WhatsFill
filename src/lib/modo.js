/**
 * **Os dois modos de trabalho: Campanha e Normal** — pedido dele (31/10/2026): *"o bom seria ter
 * o modo campanha e modo normal, no modo de campanha as pessoas chegam por anuncio e tem todo
 * esse fluxo diferente, já fora de eleições as coisas mudam"*.
 *
 * O valor mora em `ia.fase` (store.js) e é trocado na aba Config ("Modo: Campanha / Normal").
 *
 *  - **`'campanha'`** devolve TUDO como estava até 25/10/2026, palavra por palavra: o prompt de
 *    campanha, as respostas prontas de campanha e o fluxo de quem chega pelo anúncio.
 *  - **`'normal'`** é o mandato fora da eleição, e é o padrão.
 *
 * **`'pos-campanha'` continua valendo como `'normal'`** — foi o nome da primeira versão (31/10), e
 * quem já tem ele gravado não pode cair em campanha por causa de uma troca de nome. Qualquer valor
 * que não seja exatamente `'campanha'` é normal: na dúvida, o modo que não pede voto.
 *
 * Este arquivo não importa nada de propósito: ele é lido pelo painel, pela IA e pelo Facebook, e
 * o teste roda sem `chrome`.
 */

export const MODO_CAMPANHA = 'campanha';
export const MODO_NORMAL = 'normal';
export const FASE_PADRAO = MODO_NORMAL;

/** Os rótulos da Config, na ordem em que aparecem. */
export const MODOS = [
  { valor: MODO_CAMPANHA, rotulo: 'Campanha' },
  { valor: MODO_NORMAL, rotulo: 'Normal' },
];

/** `'campanha'` fica `'campanha'`; o resto (`'normal'`, `'pos-campanha'`, vazio) é `'normal'`. */
export function normalizarFase(fase) {
  return String(fase || '').trim().toLowerCase() === MODO_CAMPANHA ? MODO_CAMPANHA : MODO_NORMAL;
}

export function emCampanha(fase) {
  return normalizarFase(fase) === MODO_CAMPANHA;
}

/** O que a Config diz embaixo da escolha — uma frase por modo, para ele saber o que muda. */
export function explicacaoDoModo(fase) {
  return emCampanha(fase)
    ? 'Campanha: as pessoas chegam pelo anúncio. Vale o fluxo do anúncio (modelo do anúncio, ' +
        'modelo padrão, "voltou por outro anúncio"), as respostas prontas de campanha e o texto da ' +
        'IA de campanha.'
    : 'Normal (fora da eleição): o fluxo do anúncio fica desligado, "Quer trabalhar para a ' +
        'campanha" some, "Quer falar com o deputado" passa a repassar para o responsável pela ' +
        'agenda, e a IA não pede endereço para material nem cita a lei eleitoral.';
}

/**
 * **As respostas prontas que só existem na campanha.** Fora dela o caso cai na IA, regra 12
 * ("infelizmente não estamos contratando") — a resposta oferecia voluntariado e mandava procurar
 * o material com o PL, e nada disso existe fora da eleição.
 */
export const RESPOSTAS_SO_NA_CAMPANHA = ['trabalhar-na-campanha'];

/**
 * **O texto de fora da eleição para as respostas que mudam de sentido.** `{{saudacao}}` continua
 * sendo variável da resposta; `[[DE]]` é trocado pela forma contraída do candidato ("do Capitão
 * Martim") em `respostasDoModo` — o mesmo campo `de` que o prompt usa, para outro perfil não
 * herdar o nome dele.
 */
export const RESPOSTAS_DO_MODO_NORMAL = {
  'falar-com-deputado': {
    name: 'Quer falar com o deputado (sem WhatsApp pessoal; repasse ao responsável pela agenda)',
    text:
      '{{saudacao}}! Obrigado por querer falar com ele. 🙏\n\n' +
      'Por segurança, o WhatsApp pessoal do Capitão não é repassado.\n\n' +
      'Me conta por aqui o assunto, que eu passo para o responsável pela agenda [[DE]].',
    variantes: [
      '{{saudacao}}! Que bom que você quer falar com ele.\n\n' +
        'O número pessoal do Capitão não é repassado, por segurança.\n\n' +
        'Se for um convite ou um assunto para ele, me escreve aqui que eu passo para o ' +
        'responsável pela agenda [[DE]].',
      '{{saudacao}}! Obrigado pelo contato.\n\n' +
        'Por segurança, o contato pessoal do Capitão não é repassado.\n\n' +
        'Pode me contar por aqui o que você precisa, que eu passo para o responsável pela agenda ' +
        '[[DE]].',
    ],
  },
};

/**
 * **As respostas prontas COMO ELAS VALEM NO MODO.** Pura: não grava nada.
 *
 * Em campanha devolve a lista que veio, o mesmo array. Em normal tira as de
 * `RESPOSTAS_SO_NA_CAMPANHA` e troca nome/texto/variantes das de `RESPOSTAS_DO_MODO_NORMAL`,
 * mantendo o `id` (o fluxo e a árvore acham a resposta pelo id) e o resto dos campos.
 *
 * **O editor da Config NÃO passa por aqui** — ele mostra e grava o texto guardado, que é o de
 * campanha. Passar o texto normal pelo editor gravaria ele por cima do de campanha, e a volta para
 * o modo Campanha não teria mais o texto original.
 */
export function respostasDoModo(templates, fase, { de = 'do Capitão Martim' } = {}) {
  const lista = Array.isArray(templates) ? templates : [];
  if (emCampanha(fase)) return lista;
  const comDe = (t) => String(t).split('[[DE]]').join(de);
  return lista
    .filter((t) => !RESPOSTAS_SO_NA_CAMPANHA.includes(t?.id))
    .map((t) => {
      const troca = RESPOSTAS_DO_MODO_NORMAL[t?.id];
      if (!troca) return t;
      return {
        ...t,
        name: troca.name,
        text: comDe(troca.text),
        variantes: troca.variantes.map(comDe),
        modoNormal: true,
      };
    });
}
