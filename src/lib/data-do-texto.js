/**
 * **A mensagem do momento que fala de OUTRO dia** (31/10/2026).
 *
 * Num sábado, 31/10, a rodada pôs no campo *"Boa tarde! Que esta quinta-feira seja
 * abençoada… Hoje, 29 de outubro, é o Dia Nacional do Livro…"* — a `mensagemMomento` salva na
 * Config, que ele atualiza à mão e ainda não tinha trocado. Nada na cadeia olhava a DATA do
 * texto: a única trava da tecla 5 era variável faltando.
 *
 * Regra dele: texto que fala de um dia da semana ou de uma data que não é hoje NUNCA sai sozinho;
 * a tela avisa *"Mensagem do momento desatualizada (fala de quinta-feira/29 de outubro) —
 * atualize em Config"* e a rodada pula a tecla em vez de mandar.
 *
 * **O que conta como "fala de hoje"** — e o que NÃO conta, porque a mensagem do momento também
 * anuncia evento:
 *  - dia da semana em tom de VOTO/SAUDAÇÃO (*"ótimo sábado"*, *"que esta quinta-feira seja"*,
 *    *"feliz sexta"*, *"hoje, quinta-feira"*) tem que ser o dia de hoje. *"Domingo tem encontro"*
 *    é convite e não é lido;
 *  - data com *"hoje"* perto (*"Hoje, 29 de outubro"*) tem que ser hoje;
 *  - data SEM *"hoje"* só barra quando já passou (até 120 dias atrás e sem ano diferente): o
 *    convite para *"2 de novembro"* segue valendo, o *"29 de outubro"* de anteontem não.
 *
 * Usa a hora local do navegador — a mesma do `{{saudacao}}`.
 *
 * Os três regex globais zeram o `lastIndex` no começo: `matchAll` e `.test` deixam o cursor
 * no fim, e a segunda chamada no mesmo texto lia do meio e deixava passar o dia vencido.
 */

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const DIA_RE = /(?<![\p{L}\p{N}])(segunda|terca|quarta|quinta|sexta)(?:[\s-]*feira)?(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])(sabado|domingo)(?![\p{L}\p{N}])/gu;
const INDICE_DO_DIA = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };

// Tom de voto/saudação logo ANTES do dia: "ótimo sábado", "que esta quinta-feira", "hoje, quinta".
const VOTO_ANTES = /(?:(?<![\p{L}])(?:bo[ma]|otim[oa]|feliz|excelente|abencoad[oa]|lind[oa]|maravilhos[oa]|abencoe|abencoar|aben[cç]oe|santa|santo|abraco\s+de|boas?)\s+(?:e\s+\S+\s+)?|(?:que|uma?|tenha\s+uma?|desejo\s+uma?)\s+(?:\S+\s+)?(?:esta|este|essa|esse|nesta|neste|nessa|nesse)\s+|hoje[\s,]+(?:e\s+|eh\s+)?(?:dia\s+de\s+)?)$/u;
// ... ou voto logo DEPOIS: "esta quinta-feira seja abençoada".
const VOTO_DEPOIS = /^[\s,]*(?:seja|sejam|que\s+seja|abencoad[oa]|cheia?\s+de|de\s+muita|iluminad[oa]|feliz|maravilhos[oa]|e\s+um\s+otimo)/u;

const DATA_EXTENSO = /(?<![\p{L}\p{N}])(\d{1,2})(?:º|o|°)?\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+(\d{4}))?(?![\p{L}])/gu;
const DATA_BARRA = /(?<![\p{N}/])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![\p{N}/])/gu;

function hojeLocal(agora) {
  const d = new Date(agora);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Trechos do texto que falam de um dia que NÃO é hoje.
 * @returns {{ motivo: string, trechos: string[] } | null}
 */
export function datasForaDeHoje(texto, agora = new Date()) {
  DIA_RE.lastIndex = 0;
  DATA_EXTENSO.lastIndex = 0;
  DATA_BARRA.lastIndex = 0;
  const bruto = String(texto || '');
  if (!bruto.trim()) return null;
  const t = semAcento(bruto);
  const hoje = hojeLocal(agora);
  const trechos = [];

  for (const m of t.matchAll(DIA_RE)) {
    const chave = m[1] || m[2];
    const idx = INDICE_DO_DIA[chave];
    if (idx === hoje.getDay()) continue;
    const antes = t.slice(Math.max(0, m.index - 40), m.index);
    const depois = t.slice(m.index + m[0].length, m.index + m[0].length + 30);
    if (VOTO_ANTES.test(antes) || VOTO_DEPOIS.test(depois)) trechos.push(DIAS[idx]);
  }

  const datas = [];
  for (const m of t.matchAll(DATA_EXTENSO)) {
    datas.push({ dia: +m[1], mes: MESES.findIndex((x) => semAcento(x) === m[2]), ano: m[3] ? +m[3] : null, i: m.index, rotulo: `${+m[1]} de ${MESES[MESES.findIndex((x) => semAcento(x) === m[2])]}` });
  }
  for (const m of t.matchAll(DATA_BARRA)) {
    const dia = +m[1];
    const mes = +m[2] - 1;
    if (dia < 1 || dia > 31 || mes < 0 || mes > 11) continue;
    let ano = m[3] ? +m[3] : null;
    if (ano != null && ano < 100) ano += 2000;
    datas.push({ dia, mes, ano, i: m.index, rotulo: `${String(dia).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}` });
  }
  for (const d of datas) {
    const ehHoje = d.dia === hoje.getDate() && d.mes === hoje.getMonth() && (d.ano == null || d.ano === hoje.getFullYear());
    if (ehHoje) continue;
    const antes = t.slice(Math.max(0, d.i - 25), d.i);
    const comHoje = /(?<![\p{L}])hoje(?![\p{L}])[^.!?\n]*$/u.test(antes);
    if (comHoje) { trechos.push(d.rotulo); continue; }
    if (d.ano != null && d.ano !== hoje.getFullYear()) continue;
    const quando = new Date(d.ano ?? hoje.getFullYear(), d.mes, d.dia);
    const dias = (hoje - quando) / 86400000;
    if (dias > 0 && dias <= 120) trechos.push(d.rotulo);
  }

  const unicos = [...new Set(trechos)];
  return unicos.length ? { motivo: `fala de ${unicos.join('/')}`, trechos: unicos } : null;
}

/** A mensagem do momento (texto e variações) fala de outro dia? Qualquer variação vencida trava. */
export function momentoDesatualizado(momento, agora = new Date()) {
  if (!momento) return null;
  const textos = [momento.text, ...(momento.variantes || [])].map((x) => String(x || '').trim()).filter(Boolean);
  const achados = [];
  for (const x of textos) {
    const r = datasForaDeHoje(x, agora);
    if (r) achados.push(...r.trechos);
  }
  const unicos = [...new Set(achados)];
  return unicos.length ? { motivo: `fala de ${unicos.join('/')}`, trechos: unicos } : null;
}

export const avisoMomentoDesatualizado = (r) =>
  `Mensagem do momento desatualizada (${r?.motivo || 'fala de outro dia'}) — atualize em Config`;
