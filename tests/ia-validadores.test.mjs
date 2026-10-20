/**
 * **A API devolve o JSON como TEXTO, e TODO validador tem de ler assim.**
 *
 * `ia-cliente.PROVEDORES[*].texto()` entrega `message.content` (OpenAI) ou o
 * bloco `text` (Anthropic): string, sempre, nas tres casas. Quem lê a resposta
 * precisa do `JSON.parse` — e sete dos oito validadores o fazem com o mesmo
 * bloco copiado.
 *
 * **O oitavo nasceu sem ele** (`validarComentario`, 19/10/2026) e devolvia
 * `null` em 100% das chamadas: a chamada saía PAGA e a tela dizia *"a IA não
 * devolveu um rascunho legível"* — o sintoma, nunca a causa. O teste daquele
 * caminho ficou verde porque o simulado devolvia OBJETO, a forma que eu supus.
 *
 * Este arquivo existe para o NONO modo não repetir isso. A propriedade que ele
 * trava não depende de saber os campos de cada esquema:
 *
 *   **ler a string tem de dar o mesmo resultado que ler o objeto.**
 *
 * Rode: node tests/ia-validadores.test.mjs
 */
import { check, grupo, fim } from './_harness.mjs';
import {
  validarDecisao,
  validarMaterial,
  validarEtiqueta,
  validarEncerramento,
  validarCidade,
  validarRascunho,
  validarComentario,
  validarSimOuNao,
} from '../src/lib/ia.js';

const AGORA = new Date('2026-10-20T14:00:00-03:00');

/**
 * Os oito, com um exemplo PLAUSIVEL de cada — o que o modelo devolveria num
 * caso normal. O exemplo precisa ser aceito de verdade: comparar duas recusas
 * iguais provaria nada.
 */
const VALIDADORES = [
  {
    nome: 'validarDecisao',
    roda: (b) => validarDecisao(b, ['agradecer-apoio']),
    exemplo: { acao: 'responder', templateId: 'agradecer-apoio', confianca: 0.9, motivo: 'apoio' },
  },
  {
    nome: 'validarMaterial',
    roda: (b) => validarMaterial(b),
    exemplo: { acao: 'material', confianca: 0.95, motivo: 'pediu adesivo' },
  },
  {
    nome: 'validarEtiqueta',
    roda: (b) => validarEtiqueta(b),
    exemplo: { acao: 'sim', confianca: 0.95, motivo: 'recusou' },
  },
  {
    nome: 'validarSimOuNao',
    roda: (b) => validarSimOuNao(b, 0.7),
    exemplo: { acao: 'sim', confianca: 0.9, motivo: 'encerrou' },
  },
  {
    nome: 'validarEncerramento',
    roda: (b) => validarEncerramento(b),
    exemplo: { acao: 'sim', confianca: 0.95, motivo: 'se despediu' },
  },
  {
    nome: 'validarCidade',
    roda: (b) => validarCidade(b, { municipios: ['Canoas'] }),
    exemplo: { acao: 'corrigir', cidade: 'Canoas', confianca: 0.95, motivo: 'escreveu Canoas' },
  },
  {
    nome: 'validarRascunho',
    roda: (b) => validarRascunho(b, AGORA, {}),
    exemplo: { texto: 'Obrigado pela mensagem!', confianca: 0.9 },
  },
  {
    nome: 'validarComentario',
    roda: (b) => validarComentario(b),
    exemplo: { texto: 'Obrigado pelo apoio!', confianca: 0.9, naoResponder: false, motivo: 'apoio' },
  },
];

grupo('todo validador le o JSON como TEXTO — e a forma que a API devolve');
for (const v of VALIDADORES) {
  const comoObjeto = JSON.stringify(v.roda(v.exemplo));
  const comoTexto = JSON.stringify(v.roda(JSON.stringify(v.exemplo)));
  check(comoTexto === comoObjeto, `${v.nome}: string e objeto dao o mesmo resultado`);
}

grupo('e o exemplo de cada um e ACEITO — senao duas recusas iguais passariam');
for (const v of VALIDADORES) {
  const r = v.roda(v.exemplo);
  // Os dois formatos de saida do arquivo: `{acao,...}` e o rascunho/comentario,
  // que devolvem o texto (ou `null` quando recusam).
  const aceito = r && (r.acao ? r.acao !== 'incerto' : !!String(r.texto || '').trim());
  check(!!aceito, `${v.nome}: o exemplo plausivel passa pela peneira`);
}

/**
 * **`validarRascunho` e a excecao, e e DELIBERADA:** prosa solta vira texto
 * puro com `confianca: 0`, que e o que a versao anterior ao esquema devolvia.
 * Assim um modelo que ignore o esquema ainda produz rascunho — e sem confianca
 * ele nunca passa do limiar do envio automatico, entao o texto so chega ao
 * CAMPO, para ele ler.
 *
 * **No comentario a escolha e a oposta, e tambem de proposito:** o canal e
 * PUBLICO e nao existe forma antiga para acomodar, entao prosa e recusada com
 * o motivo na tela.
 */
const ACEITA_PROSA = new Set(['validarRascunho']);

grupo('texto que NAO e JSON e recusado, nunca lido pela metade');
for (const v of VALIDADORES) {
  if (ACEITA_PROSA.has(v.nome)) continue;
  const r = v.roda('desculpe, nao posso ajudar com isso');
  const recusou = r === null || r.acao === 'incerto' || !String(r.texto || '').trim();
  check(recusou, `${v.nome}: prosa solta nao vira resposta`);
}

grupo('a excecao e so a do rascunho, e ela nao pode sair sozinha');
{
  const r = validarRascunho('desculpe, nao posso ajudar com isso', AGORA, {});
  check(!!String(r.texto || '').trim(), 'validarRascunho ainda aceita prosa — a forma anterior ao esquema');
  check(r.confianca === 0, 'mas com confianca 0, entao nunca sai sozinha');
  check(r.precisaDeRevisao === true, 'e marcada como precisando de revisao');
}

fim();
