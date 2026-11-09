/** Aviso local; nao altera permissao de envio nem presume o provedor do canal. */
export function avisoJanelaResposta(entrantes = [], agora = Date.now()) {
  const datas = entrantes.map(m => m?.at ? new Date(m.at).getTime() : NaN)
    .filter(t => Number.isFinite(t) && t <= agora);
  if (!datas.length) return 'Não foi possível confirmar o prazo de 24h: falta a data da última mensagem recebida.';
  const ultima = Math.max(...datas);
  const fim = ultima + 24 * 60 * 60 * 1000;
  if (agora < fim) return '';
  const data = new Date(ultima).toLocaleString('pt-BR');
  return `⚠ Prazo de resposta de 24h ultrapassado. Última mensagem do contato: ${data}. Na API oficial do WhatsApp, fora dessa janela só é permitido enviar modelo aprovado pela Meta. Uma nova mensagem do contato reabre a janela.`;
}

/** Status compacto sempre visivel, inclusive dentro do prazo. */
export function statusJanelaResposta(entrantes = [], agora = Date.now()) {
  const datas = entrantes.map(m => m?.at ? new Date(m.at).getTime() : NaN)
    .filter(t => Number.isFinite(t) && t <= agora);
  if (!datas.length) return '24h: prazo desconhecido (sem data recebida)';
  const restante = Math.max(...datas) + 86400000 - agora;
  if (restante <= 0) return '⚠ 24h: PRAZO VENCIDO';
  const minutos = Math.ceil(restante / 60000);
  return `24h: restam ${Math.floor(minutos / 60)}h ${String(minutos % 60).padStart(2, '0')}min`;
}
