/**
 * O prazo que a Config ja usava para o fluxo (`horasContextoPerdido`) tambem corta o que a IA le.
 *
 * 09/11/2026: a avaliacao citava uma reclamacao antiga quando as mensagens recentes eram so links.
 * O limitador decidia o fluxo, e o historico inteiro seguia para o encerramento e para o rascunho.
 * `0` desliga. Data ausente fica: nao prova que a mensagem e antiga.
 */
export function limitarContextoIA(mensagens = [], horas, agora = Date.now()) {
  const limite = Number(horas);
  if (!Number.isFinite(limite) || limite <= 0) return mensagens;
  const corte = new Date(agora).getTime() - limite * 3600000;
  return mensagens.filter(m => {
    const t = m?.at ? new Date(m.at).getTime() : NaN;
    return !Number.isFinite(t) || t >= corte;
  });
}
