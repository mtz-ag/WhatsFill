import * as store from './src/lib/store.js';

const area = document.getElementById('data');
const msg = document.getElementById('msg');

function say(text, isError = false) {
  msg.textContent = text;
  msg.classList.toggle('err', isError);
}

document.getElementById('export').addEventListener('click', async () => {
  area.value = await store.exportJson();
  say('Exportado para a caixa.');
});

document.getElementById('import').addEventListener('click', async () => {
  try {
    await store.importJson(area.value);
    say('Importado com sucesso. Recarregue a aba do mobiliza.app para o painel pegar as mudanças.');
  } catch (err) {
    say('JSON inválido: ' + err.message, true);
  }
});

document.getElementById('download').addEventListener('click', async () => {
  const json = area.value || (await store.exportJson());
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'whatsfill-backup.json';
  a.click();
  URL.revokeObjectURL(url);
  say('Arquivo gerado.');
});

store.exportJson().then((json) => {
  area.value = json;
});
