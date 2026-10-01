/**
 * imagem.js — mandar uma IMAGEM com legenda pelo mesmo caminho que a plataforma usa.
 *
 * **O formato não foi adivinhado: foi GRAVADO.** Em 20/09/2026 ele mandou uma imagem com o
 * gravador ligado (`recorder.aprenderEnvioDeImagem`) e a cadeia apareceu inteira — é a mesma
 * disciplina do contrato de escrita no CRM, e a razão é a de sempre: chutar corpo de requisição
 * aqui é mandar coisa errada para eleitor.
 *
 * **A cadeia tem cinco passos** (o `POST .../read` que apareceu junto é a plataforma marcando a
 * conversa como lida — não faz parte do envio):
 *
 *  1. `POST /core/v1/file/upload` `{name, type:'IMAGE', mimeType}` → devolve `keyS3` e a
 *     **`urlUpload` assinada** do S3.
 *  2. `PUT <urlUpload>` com os BYTES. Sai do service worker, não daqui — ver `MSG_UPLOAD`.
 *  3. `POST /core/v1/file/transform` com a resposta do passo 1 mais `newExtension`/`newMimeType`
 *     → devolve o arquivo convertido, com `keyS3` novo.
 *  4. `PUT /core/v1/file` registra o arquivo e devolve o **`id`**, que é o `fileId` da mensagem.
 *  5. `PUT /chat/v1/session/{sessionId}/message` cria a mensagem `type: 'IMAGE'` com esse
 *     `fileId`. **A legenda é o campo `text`.**
 *
 * **A legenda é conferida relendo a resposta** (`legendaEntrou`): a armadilha mais antiga deste
 * projeto é a API responder 200 e ignorar o valor. Se o `text` não voltar, quem chamou manda o
 * texto do jeito de sempre — o pior caso vira duas mensagens, nunca uma imagem muda.
 */

/** Mensagem para o service worker subir os bytes — ver `background.js`. */
export const MSG_UPLOAD = 'wf-upload-imagem';

/**
 * **Para onde os bytes sobem** — o endereço assinado vem da própria plataforma, e este é o host
 * que ela usou no envio gravado. Ele precisa estar em `host_permissions`, senão o worker nem
 * chega a tentar; por isso a conferência é aqui, com o motivo escrito, e não um erro de rede.
 */
export const HOST_DE_UPLOAD = 'wts-storage.s3.sa-east-1.amazonaws.com';

export function hostConhecido(url) {
  try {
    return new URL(String(url)).host === HOST_DE_UPLOAD;
  } catch (_) {
    return false;
  }
}

/**
 * **Lista de PERMISSÃO dos formatos, nunca de bloqueio.**
 *
 * A conversão do passo 3 é o único pedaço da cadeia cujo valor não dá para derivar: no envio
 * gravado, um `image/jpeg` com extensão `.jpeg` virou `jpg`. O que a plataforma faz com PNG,
 * WEBP ou GIF **não foi observado** — e lista de bloqueio faria todo formato novo nascer aceito
 * até alguém notar (a lição de `MODELOS_COM_ESFORCO`).
 *
 * Para liberar outro formato: mande um à mão com "Aprender de novo o envio de imagem" ligado, e
 * a linha entra aqui com o que a plataforma mostrar.
 */
export const CONVERSAO_POR_MIME = {
  'image/jpeg': { newExtension: 'jpg', newMimeType: 'image/jpeg' },
  'image/jpg': { newExtension: 'jpg', newMimeType: 'image/jpeg' },
};

export function conversaoDe(mime) {
  return CONVERSAO_POR_MIME[String(mime || '').trim().toLowerCase()] || null;
}

/** O que a PLATAFORMA aceita, e o que o passo 3 sabe converter: só o que foi observado. */
export const MIMES_ACEITOS = Object.keys(CONVERSAO_POR_MIME).join(',');

/**
 * **O que o NAVEGADOR converte aqui, antes de a plataforma ver** (01/10/2026, relato dele: *"a
 * extensão ao escolher imagem não atualiza o explorer, baixei uma imagem nova e ela não mostra"*
 * — era PNG, e o `accept` do seletor era a lista acima, então a janela do Windows **escondia o
 * arquivo**. Não havia nada a atualizar: o arquivo estava filtrado).
 *
 * **A lista de permissão da plataforma NÃO mudou, e é esse o ponto.** O que sobe continua sendo
 * `image/jpeg`, o único formato que o envio gravado mostrou; o que mudou é onde o PNG para — ele é
 * desenhado num canvas e sai JPEG **do lado de cá**. Nada novo foi chutado sobre o `transform`, e é
 * por isso que isto não precisa de gravação nova: a cadeia recebe exatamente o que já recebia.
 */
export const CONVERTIVEIS_AQUI = ['image/png', 'image/webp', 'image/gif', 'image/bmp'];

export function podeConverterAqui(mime) {
  return CONVERTIVEIS_AQUI.includes(String(mime || '').trim().toLowerCase());
}

/** O que a janela do Windows mostra: o que a plataforma aceita MAIS o que convertemos aqui. */
export const MIMES_DO_SELETOR = [...Object.keys(CONVERSAO_POR_MIME), ...CONVERTIVEIS_AQUI].join(',');

/**
 * **Fundo BRANCO, e não é enfeite:** JPEG não tem transparência, e PNG recortado desenhado num
 * canvas vazio sai com o fundo **PRETO** — a arte com logo vazado chegaria ao eleitor num quadrado
 * negro. Branco é o fundo em que a colinha foi desenhada para ser lida.
 */
export const FUNDO_DO_JPEG = '#ffffff';

/**
 * **O lado maior.** O WhatsApp recomprime o que passa por ele e entrega ~1600px na imagem padrão:
 * guardar mais que isso gasta o armazenamento da extensão por um detalhe que não chega ao telefone
 * de ninguém. Imagem menor que o teto **não é ampliada**.
 */
export const LADO_MAXIMO = 1600;

/** A qualidade cai só enquanto não couber: a primeira que cabe é a que vai. */
export const QUALIDADES_JPEG = [0.92, 0.85, 0.78, 0.7];

/**
 * **Dois tetos, e por isso são dois.** O de GUARDAR é o armazenamento da extensão (uma arte de
 * WhatsApp cabe folgada em 2 MB); o de ESCOLHER é maior porque **PNG é inchado** — um print de
 * 6 MB vira um JPEG de 300 KB, e recusá-lo pelo tamanho do original é recusar o que cabe.
 */
export const TETO_GUARDADO_BYTES = 2 * 1024 * 1024;
export const TETO_ESCOLHIDO_BYTES = 12 * 1024 * 1024;

/** `colinha.png` → `colinha.jpg`: o nome tem que combinar com o que sobe, que é sempre JPEG. */
export function nomeComoJpeg(nome) {
  const base = String(nome || '').replace(/\.[a-z0-9]{1,5}$/i, '').trim();
  return `${base || 'imagem'}.jpg`;
}

/** Quanto um base64 ocupa de verdade — é o que decide se cabe no armazenamento. */
export function bytesDoBase64(dados) {
  const limpo = String(dados || '').replace(/=+$/, '');
  return Math.floor((limpo.length * 3) / 4);
}

/** A medida do desenho depois do teto do lado maior, mantendo a proporção. */
export function medidaParaDesenhar(largura, altura, lado = LADO_MAXIMO) {
  const l = Math.max(1, Math.round(Number(largura) || 1));
  const a = Math.max(1, Math.round(Number(altura) || 1));
  const maior = Math.max(l, a);
  if (!lado || maior <= lado) return { largura: l, altura: a, reduziu: false };
  const fator = lado / maior;
  return {
    largura: Math.max(1, Math.round(l * fator)),
    altura: Math.max(1, Math.round(a * fator)),
    reduziu: true,
  };
}

export function corpoDoUpload(arquivo) {
  return { name: arquivo.nome, type: 'IMAGE', mimeType: arquivo.mime };
}

/** O passo 3 manda a resposta do passo 1 INTEIRA de volta, mais o par da conversão. */
export function corpoDoTransform(doUpload, conversao) {
  return { ...doUpload, newExtension: conversao.newExtension, newMimeType: conversao.newMimeType };
}

export function corpoDoRegistro(convertido, arquivo) {
  return {
    name: convertido.name,
    originalName: arquivo.nome,
    type: 'IMAGE',
    mimeType: convertido.mimeType,
    extension: convertido.extension,
    keyS3: convertido.keyS3,
    generateThumb: true,
  };
}

/**
 * A mensagem em si. **Vai enxuta de propósito:** o corpo gravado levava um bloco `details.file`
 * inteiro, que é estado da tela dele (`uploading`, `uploadProgress: 90`) — a resposta do servidor
 * traz o arquivo completo de volta, montado por ele. Mandar estado de tela seria copiar o que a
 * interface precisa, não o que a API precisa.
 */
export function corpoDaMensagem({ sessionId, senderId, fileId, legenda, quando }) {
  const agora = quando || new Date().toISOString();
  return {
    sessionId,
    senderId,
    type: 'IMAGE',
    fileId,
    text: String(legenda || '').trim() || null,
    direction: 'TO_HUB',
    createdAt: agora,
    updatedAt: agora,
    timestamp: agora,
    status: 'PROCESSING',
  };
}

/**
 * **A legenda entrou mesmo?** Quem pergunta é quem vai decidir se ainda precisa mandar o texto
 * separado. Basta o `text` ter voltado com conteúdo: comparar palavra por palavra quebraria com
 * qualquer normalização de espaço do servidor, e o risco que importa é o `null`.
 */
export function legendaEntrou(respostaDaMensagem, legenda) {
  if (!String(legenda || '').trim()) return true; // sem legenda, não há o que conferir
  return !!String(respostaDaMensagem?.text || '').trim();
}

/**
 * **Qual imagem vai com este texto** — pura, porque é ela que decide o que sai para eleitor.
 *
 * A mensagem do momento casa pelo ID (ele começa com `momento:`, com um resumo do texto dentro);
 * o pedido de dados casa pelo INVARIANTE do texto, que é como o resto do projeto o reconhece — o
 * pedido sai por três redações diferentes e por modelo aprovado.
 *
 * **O momento ganha quando os dois valem**: o texto combinado (momento + pedido) É a mensagem do
 * momento, e mandar a arte do cadastro ali seria trocar a imagem da ocasião pela outra.
 */
export function imagemDoEnvio({ templateId, ehPedidoDeDados, cfg, imagens }) {
  const id = String(templateId || '');
  if (id.startsWith('momento:') && cfg?.imagemMomentoLigada && imagens?.imagemMomentoArquivo) {
    return { arquivo: imagens.imagemMomentoArquivo, de: 'a mensagem do momento' };
  }
  if (ehPedidoDeDados && cfg?.imagemPedidoDadosLigada && imagens?.imagemPedidoDadosArquivo) {
    return { arquivo: imagens.imagemPedidoDadosArquivo, de: 'o pedido de dados' };
  }
  return null;
}

/**
 * Manda a imagem, na ordem gravada.
 *
 * As dependências entram por parâmetro porque os dois lados da fronteira são diferentes: os
 * quatro passos na API do mobiliza têm que sair da ABA (a API valida o `Origin`), e o PUT no S3
 * tem que sair do SERVICE WORKER (de dentro da aba ele esbarra no CORS, que a permissão de host
 * só resolve lá).
 *
 * @param {object} p
 * @param {string} p.sessionId    o atendimento aberto
 * @param {string} p.senderId     de onde a plataforma manda — sai de uma mensagem da própria sessão
 * @param {{nome:string, mime:string, dados:string}} p.arquivo  o que ele escolheu (base64 no `dados`)
 * @param {string} p.legenda      o texto que vai junto da imagem
 * @param {function} p.api        `apiFetch`
 * @param {function} p.subirBytes `(url, mime) => Promise` — o PUT no S3, pelo worker
 * @returns {Promise<{fileId:string, mensagemId:string, legendaFoi:boolean}>}
 */
export async function enviarImagem({ sessionId, senderId, arquivo, legenda, api, subirBytes, quando }) {
  if (!sessionId) throw new Error('sem atendimento aberto para mandar a imagem');
  if (!arquivo?.dados) throw new Error('nenhuma imagem guardada');

  const conversao = conversaoDe(arquivo.mime);
  if (!conversao) {
    throw new Error(
      `só sei mandar ${Object.keys(CONVERSAO_POR_MIME).join(' e ')} — foi o formato que a plataforma ` +
        `mostrou como faz. Mande um "${arquivo.mime}" à mão com "Aprender de novo o envio de imagem" ligado.`
    );
  }

  const doUpload = await api('/core/v1/file/upload', { method: 'POST', body: corpoDoUpload(arquivo) });
  if (!doUpload?.urlUpload) throw new Error('a plataforma não devolveu para onde subir o arquivo');
  if (!hostConhecido(doUpload.urlUpload)) {
    throw new Error(
      `a plataforma mandou subir o arquivo para outro endereço (${doUpload.urlUpload.slice(0, 60)}…). ` +
        `A extensão só tem permissão para ${HOST_DE_UPLOAD} — me avise para eu liberar o novo.`
    );
  }

  await subirBytes(doUpload.urlUpload, doUpload.mimeType || arquivo.mime);

  const convertido = await api('/core/v1/file/transform', {
    method: 'POST',
    body: corpoDoTransform(doUpload, conversao),
  });
  if (!convertido?.keyS3) throw new Error('a plataforma não devolveu o arquivo convertido');

  const registrado = await api('/core/v1/file', { method: 'PUT', body: corpoDoRegistro(convertido, arquivo) });
  if (!registrado?.id) throw new Error('a plataforma não registrou o arquivo');

  const mensagem = await api(`/chat/v1/session/${sessionId}/message`, {
    method: 'PUT',
    body: corpoDaMensagem({ sessionId, senderId, fileId: registrado.id, legenda, quando }),
  });
  // Mesma conferência de toda escrita aqui: o 2xx não prova nada, a releitura prova.
  if (mensagem?.fileId !== registrado.id) throw new Error('a mensagem saiu sem o arquivo');

  return {
    fileId: registrado.id,
    mensagemId: String(mensagem?.id || ''),
    /**
     * **O status com que a mensagem ficou** — `PROCESSING` é o caminho normal; `QUEUED` quer dizer
     * que a plataforma a guardou para quando puder entregar.
     *
     * Existe por causa de quem CONCLUI depois de mandar (o envio em lote por etiqueta): a própria
     * tela avisa, antes de concluir, que *"uma mensagem está aguardando resposta do contato; se
     * você prosseguir com a conclusão, essas mensagens serão canceladas"* — ou seja, **concluir
     * cancela mensagem em fila**. Sem este campo, a rodada cancelaria o próprio envio e contaria
     * como enviado.
     */
    status: String(mensagem?.status || ''),
    legendaFoi: legendaEntrou(mensagem, legenda),
  };
}
