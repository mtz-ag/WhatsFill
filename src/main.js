/**
 * main.js — o que a extensão monta DENTRO da aba do mobiliza.
 *
 * Modo padrão: painel **encaixado** na borda direita, empurrando a página em vez de cobri-la
 * (ver dock.js). Rodar aqui dentro também é o que faz a API funcionar sem atrito — ela só
 * aceita requisições com `Origin: https://mobiliza.app`.
 *
 * Também mantém a ponte de mensagens, para o painel em janela separada continuar funcionando.
 */

import { createPanel } from './panel/panel.js';
import { installRpcHost, watchPageState, onPageState, setPanelToggle } from './lib/rpc-host.js';
import { setTransport, createFetchTransport } from './lib/api.js';
import { waitForToken } from './lib/bus.js';
import * as store from './lib/store.js';
import * as dock from './lib/dock.js';
import * as mob from './lib/mob.js';

const HOST_ID = 'whatsfill-host';

/**
 * **O TRANSPORTE DEPENDE DA PLATAFORMA, e na nova ele RECUSA em vez de pendurar.**
 *
 * No mobiliza.app a aba e o unico contexto de onde a API aceita requisicao (`Origin`), e o token
 * vem do `page-hook` pelo `waitForToken`.
 *
 * **No mobiliza.me esse token nao existe** — a plataforma e outra, e a sessao mora no
 * `localStorage`. Deixar o transporte antigo aqui faria toda chamada de `api.js` ficar esperando
 * para sempre por um Bearer que ninguem vai interceptar: o painel subiria e travaria, sem erro
 * nenhum na tela. **Pendurar e pior que falhar** (08/09) — e a licao do timeout da IA, que custou
 * duas rodadas paradas em "Andando...".
 *
 * Entao, na plataforma nova, o transporte diz o que aconteceu. Quem le a base nova e o `mob.js`.
 */
const NA_PLATAFORMA_NOVA = location.hostname === mob.HOST;

setTransport(
  NA_PLATAFORMA_NOVA
    ? (path) =>
        Promise.reject(
          new Error(
            `A rota ${path} e da plataforma antiga e nao existe no ${mob.HOST}. ` +
              'Quem le a base nova e o mob.js, pelo adaptador (page-mob.js).',
          ),
        )
    : createFetchTransport(waitForToken),
);

async function boot() {
  if (document.getElementById(HOST_ID)) return;

  installRpcHost();

  const settings = await store.get('settings');
  let largura = dock.clamp(settings.dockWidth);

  const host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = await fetch(chrome.runtime.getURL('src/panel/panel.css')).then((r) => r.text());
  shadow.append(style);

  const panel = createPanel({
    mode: 'dock',
    initialWidth: largura,
    // Chamado a cada movimento do puxador: aplicar é barato, gravar não — por isso a
    // gravação é adiada até você parar de arrastar.
    onResize: (nova) => {
      largura = dock.applyDock(nova);
      agendarGravacaoDaLargura(largura);
      return largura;
    },
    onToggle: (aberto) => {
      if (aberto) dock.applyDock(largura);
      else dock.removeDock();
      persistir({ panelOpen: aberto });
    },
  });

  shadow.append(panel.root);
  document.body.append(host);

  const aberto = settings.panelOpen !== false;
  panel.setCollapsed(!aberto);
  if (aberto) dock.applyDock(largura);

  setPanelToggle(() => panel.toggle());

  // Carga inicial explícita. Sem ela, uma aba que abre SEM atendimento selecionado nunca roda
  // load(): applyPageState só carrega quando o sessionId muda, e no boot ele já é null. O
  // painel subia sem settings — e sem settings a classificação automática fica desligada.
  await panel.refresh();

  onPageState((state) => panel.applyPageState(state));
  watchPageState();

  console.info('[WhatsFill] painel encaixado. Clique no ícone da extensão para mostrar/esconder.');
}

async function persistir(mudancas) {
  const atual = await store.get('settings');
  await store.set('settings', { ...atual, ...mudancas });
}

let timerLargura = null;
function agendarGravacaoDaLargura(largura) {
  clearTimeout(timerLargura);
  timerLargura = setTimeout(() => persistir({ dockWidth: largura }), 400);
}

boot().catch((err) => console.error('[WhatsFill] falha no boot:', err));
