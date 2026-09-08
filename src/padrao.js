/**
 * padrao.js — a janela que mostra o PADRÃO DE ATENDIMENTO dele, em tamanho de leitura.
 *
 * Pedido dele (08/09/2026): *"faça para que abra em popup, as letras estão pequenas demais para
 * ler"*. O `<details>` que existia na aba Config mostrava as 27 seções em 11px numa caixa de 320px
 * de altura, dentro de um painel de 380px — dava para conferir que o texto estava lá, não para lê-lo.
 *
 * **Somente leitura, como era.** O documento é dele, vive em `atendimento.js` e tem histórico no
 * git; a regra do `CLAUDE.md` é "não altere sem ele pedir". O que muda toda semana continua nas
 * Instruções extras da Config.
 *
 * O Markdown é convertido aqui, à mão e para o pouco que o documento usa (títulos, listas, tabela,
 * negrito, itálico, `código`). Trazer uma biblioteca para isso custaria mais que o problema — e a
 * extensão não tem build step.
 */
import { PADRAO_DE_ATENDIMENTO } from './lib/atendimento.js';
import { tokensAproximados, montarSistemaRascunho } from './lib/ia.js';
import * as store from './lib/store.js';

const escapar = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Negrito, itálico e código — o inline que o documento usa. */
function inline(texto) {
  return escapar(texto)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
}

/**
 * Markdown → HTML, só o que o documento tem.
 *
 * A tabela é reconhecida pela linha de separação (`|---|`), que é o que a distingue de um
 * parágrafo com barras. Linha de tabela sem cabeçalho não existe no documento e não é tratada.
 */
export function paraHtml(md) {
  const linhas = String(md).split('\n');
  const saida = [];
  let lista = null;
  let tabela = null;
  /**
   * **O documento quebra a linha em ~100 colunas, e cada quebra NÃO é um parágrafo.**
   *
   * A primeira versão criava um `<p>` por linha do arquivo: 132 parágrafos de meia frase, com o
   * espaço vertical entre eles — exatamente a poluição que esta janela existe para desfazer. Aqui
   * as linhas seguidas viram um parágrafo só, e o que separa é a linha em branco, como no Markdown.
   */
  let paragrafo = [];

  const fecharLista = () => {
    if (lista) {
      saida.push(`</${lista}>`);
      lista = null;
    }
  };
  const fecharTabela = () => {
    if (tabela) {
      saida.push('</tbody></table>');
      tabela = null;
    }
  };
  const fecharParagrafo = () => {
    if (paragrafo.length) {
      saida.push(`<p>${inline(paragrafo.join(' '))}</p>`);
      paragrafo = [];
    }
  };

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const cru = linha.trim();

    if (!cru) {
      fecharParagrafo();
      fecharLista();
      fecharTabela();
      continue;
    }

    const titulo = /^(#{1,4})\s+(.*)$/.exec(cru);
    if (titulo) {
      fecharParagrafo();
      fecharLista();
      fecharTabela();
      const nivel = Math.min(4, titulo[1].length + 1); // "#" do arquivo vira h2 na tela
      saida.push(`<h${nivel}>${inline(titulo[2])}</h${nivel}>`);
      continue;
    }

    // Tabela: a linha de separação confirma que a anterior era o cabeçalho.
    if (cru.startsWith('|') && /^\|[\s:|-]+\|$/.test(linhas[i + 1]?.trim() || '')) {
      fecharParagrafo();
      fecharLista();
      const celulas = cru.split('|').slice(1, -1).map((c) => `<th>${inline(c.trim())}</th>`);
      saida.push(`<table><thead><tr>${celulas.join('')}</tr></thead><tbody>`);
      tabela = true;
      i++; // pula a linha de separação
      continue;
    }
    if (tabela && cru.startsWith('|')) {
      const celulas = cru.split('|').slice(1, -1).map((c) => `<td>${inline(c.trim())}</td>`);
      saida.push(`<tr>${celulas.join('')}</tr>`);
      continue;
    }
    fecharTabela();

    const item = /^[-*]\s+(.*)$/.exec(cru);
    if (item) {
      fecharParagrafo();
      if (lista !== 'ul') {
        fecharLista();
        saida.push('<ul>');
        lista = 'ul';
      }
      saida.push(`<li>${inline(item[1])}</li>`);
      continue;
    }

    const numerado = /^\d+\.\s+(.*)$/.exec(cru);
    if (numerado) {
      fecharParagrafo();
      if (lista !== 'ol') {
        fecharLista();
        saida.push('<ol>');
        lista = 'ol';
      }
      saida.push(`<li>${inline(numerado[1])}</li>`);
      continue;
    }

    // Linha de texto: acumula. O parágrafo só fecha na linha em branco ou no próximo bloco.
    if (lista) fecharLista();
    paragrafo.push(cru);
  }

  fecharParagrafo();
  fecharLista();
  fecharTabela();
  return saida.join('\n');
}

async function montar() {
  const alvo = document.getElementById('texto');
  alvo.innerHTML = paraHtml(PADRAO_DE_ATENDIMENTO);

  /**
   * O resumo diz as três coisas que ele quis saber ao pedir a tela: que o padrão vai **inteiro**,
   * que é **o mesmo nas duas casas** (Claude e ChatGPT), e **quanto do prompt** ele ocupa.
   */
  const cfg = (await store.get('ia').catch(() => null)) || {};
  const prompt = montarSistemaRascunho({
    templates: (await store.get('templates').catch(() => [])) || [],
    regras: cfg.regras || '',
  });
  const doPadrao = tokensAproximados(PADRAO_DE_ATENDIMENTO);
  const doPrompt = tokensAproximados(prompt);
  const secoes = (PADRAO_DE_ATENDIMENTO.match(/^## /gm) || []).length;

  document.getElementById('resumo').textContent =
    `${secoes} seções. Vai inteiro no prompt de sistema, e é o mesmo texto nas duas casas — ` +
    `Claude e ChatGPT. São ${doPadrao} dos ${doPrompt} tokens do prompt. Aqui é só leitura: ` +
    'o que muda toda semana vai nas Instruções extras, na aba Config.';
}

/**
 * O `if` existe para o TESTE poder importar `paraHtml` sem uma tela — a conversão é lógica de
 * verdade (títulos, listas, tabela, negrito) e quebra em silêncio: o texto sairia como um bloco só,
 * e ninguém olharia o console.
 */
if (typeof document !== 'undefined') {
  montar().catch((err) => {
    document.getElementById('resumo').textContent = `Não consegui montar a tela: ${err?.message || err}`;
  });
}
