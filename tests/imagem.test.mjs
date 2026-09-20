/**
 * O envio de IMAGEM com legenda.
 *
 * Os corpos abaixo são os do envio que ELE fez à mão em 20/09/2026, com o gravador ligado — é o
 * único jeito honesto de testar isto: a cadeia não foi inventada, foi copiada, e o teste existe
 * para acusar quando alguém mudar a cópia.
 *
 * O que está em jogo é o que o eleitor recebe: imagem sem legenda, ou legenda sem imagem.
 */
import { check, grupo, fim } from './_harness.mjs';
import {
  conversaoDe,
  corpoDoUpload,
  corpoDoTransform,
  corpoDoRegistro,
  corpoDaMensagem,
  legendaEntrou,
  imagemDoEnvio,
  hostConhecido,
  enviarImagem,
} from '../src/lib/imagem.js';

const ARQUIVO = { nome: 'arte-do-momento.jpeg', mime: 'image/jpeg', dados: 'AAAA' };

// A resposta REAL do passo 1, com os identificadores trocados por fictícios.
const DO_UPLOAD = {
  type: 'IMAGE',
  name: 'arte_do_momento.jpeg',
  extension: '.jpeg',
  keyS3: 'upload/empresa/IMAGE/abc_arte_do_momento.jpeg',
  urlUpload: 'https://wts-storage.s3.sa-east-1.amazonaws.com/upload/empresa/IMAGE/abc.jpeg?X-Amz-Signature=xyz',
  mimeType: 'image/jpeg',
};

const CONVERTIDO = {
  type: 'IMAGE',
  name: 'arte_do_momento_jpeg.jpg',
  extension: 'jpg',
  keyS3: 'upload/empresa/IMAGE/abc_arte_do_momento_jpeg_converted.jpg',
  mimeType: 'image/jpeg',
};

grupo('formatos: lista de PERMISSAO, nunca de bloqueio');
{
  check(!!conversaoDe('image/jpeg'), 'jpeg foi o formato observado');
  check(conversaoDe('image/jpeg').newExtension === 'jpg', 'e a plataforma converte para jpg');
  check(!!conversaoDe('IMAGE/JPEG'), 'caixa nao decide formato');
  check(conversaoDe('image/png') === null, 'png NAO foi observado: fica de fora ate alguem gravar um');
  check(conversaoDe('image/webp') === null, 'webp idem');
  check(conversaoDe('') === null && conversaoDe(undefined) === null, 'vazio nao passa');
}

grupo('os corpos sao os do envio gravado');
{
  const upload = corpoDoUpload(ARQUIVO);
  check(upload.name === ARQUIVO.nome && upload.type === 'IMAGE' && upload.mimeType === 'image/jpeg',
    'passo 1: nome, tipo e mime, e mais nada');
  check(Object.keys(upload).length === 3, 'sem campo a mais — o que a plataforma manda e isto');

  const transform = corpoDoTransform(DO_UPLOAD, conversaoDe('image/jpeg'));
  check(transform.keyS3 === DO_UPLOAD.keyS3 && transform.urlUpload === DO_UPLOAD.urlUpload,
    'passo 3 devolve a resposta do passo 1 INTEIRA');
  check(transform.newExtension === 'jpg' && transform.newMimeType === 'image/jpeg', 'mais o par da conversao');

  const registro = corpoDoRegistro(CONVERTIDO, ARQUIVO);
  check(registro.keyS3 === CONVERTIDO.keyS3, 'passo 4 registra o arquivo CONVERTIDO');
  check(registro.originalName === ARQUIVO.nome, 'e guarda o nome original, que e o do disco dele');
  check(registro.generateThumb === true, 'com miniatura, como a plataforma pede');
}

grupo('a mensagem: a legenda e o campo text');
{
  const msg = corpoDaMensagem({
    sessionId: 'sessao-1',
    senderId: 'remetente-1',
    fileId: 'arquivo-1',
    legenda: 'Bom dia! Hoje tem agenda em Caxias.',
    quando: '2026-09-20T13:25:14.988Z',
  });
  check(msg.type === 'IMAGE' && msg.fileId === 'arquivo-1', 'mensagem de imagem aponta para o arquivo');
  check(msg.text === 'Bom dia! Hoje tem agenda em Caxias.', 'a legenda vai no text');
  check(msg.direction === 'TO_HUB', 'direcao de quem manda');
  check(msg.createdAt === msg.timestamp && msg.timestamp === '2026-09-20T13:25:14.988Z', 'os tres horarios batem');
  check(corpoDaMensagem({ sessionId: 's', legenda: '   ' }).text === null,
    'legenda so de espaco vira null, e nao uma mensagem em branco');
  check(!('details' in msg), 'sem o bloco details: aquilo era estado da tela dele, nao dado da API');
}

grupo('a legenda so e dada por entregue quando a plataforma devolve');
{
  check(legendaEntrou({ text: 'oi' }, 'oi'), 'voltou: entrou');
  check(legendaEntrou({ text: 'oi  ' }, 'oi'), 'espaco a mais nao reprova — o risco e o null');
  check(!legendaEntrou({ text: null }, 'oi'), 'NAO voltou: quem chamou ainda tem de mandar o texto');
  check(!legendaEntrou({}, 'oi'), 'campo ausente conta como nao entrou');
  check(legendaEntrou({ text: null }, ''), 'sem legenda nao ha o que conferir');
}

grupo('qual imagem vai com qual texto');
{
  const cfg = { imagemMomentoLigada: true, imagemPedidoDadosLigada: true };
  const imagens = { imagemMomentoArquivo: { nome: 'momento' }, imagemPedidoDadosArquivo: { nome: 'dados' } };

  check(imagemDoEnvio({ templateId: 'momento:abc', ehPedidoDeDados: false, cfg, imagens }).arquivo.nome === 'momento',
    'a mensagem do momento leva a arte do momento');
  check(imagemDoEnvio({ templateId: 'pedir-dados', ehPedidoDeDados: true, cfg, imagens }).arquivo.nome === 'dados',
    'o pedido de dados casa pelo INVARIANTE do texto, nao pelo id');
  check(imagemDoEnvio({ templateId: 'momento:abc', ehPedidoDeDados: true, cfg, imagens }).arquivo.nome === 'momento',
    'texto combinado (momento + pedido) E a mensagem do momento: a arte da ocasiao ganha');
  check(imagemDoEnvio({ templateId: 'agradecer-apoio', ehPedidoDeDados: false, cfg, imagens }) === null,
    'resposta pronta qualquer nao leva imagem nenhuma');

  check(imagemDoEnvio({ templateId: 'momento:abc', cfg: { imagemMomentoLigada: false }, imagens }) === null,
    'caixa desmarcada: nada sai — e a caixa e liga e desliga, pedido dele');
  check(imagemDoEnvio({ templateId: 'momento:abc', cfg, imagens: {} }) === null,
    'sem imagem guardada, nada sai');
}

grupo('para onde os bytes sobem');
{
  check(hostConhecido(DO_UPLOAD.urlUpload), 'o host do envio gravado e o que a extensao tem permissao de usar');
  check(!hostConhecido('https://outro.exemplo.com/arquivo.jpg'), 'outro endereco para com motivo, em vez de erro de rede');
  check(!hostConhecido('nao e url'), 'lixo nao passa');
}

grupo('a cadeia inteira, com a API de mentira');
{
  const chamadas = [];
  const api = async (caminho, opts) => {
    chamadas.push({ caminho, metodo: opts?.method, body: opts?.body });
    if (caminho === '/core/v1/file/upload') return DO_UPLOAD;
    if (caminho === '/core/v1/file/transform') return CONVERTIDO;
    if (caminho === '/core/v1/file') return { id: 'arquivo-1' };
    return { id: 'msg-1', fileId: 'arquivo-1', text: opts.body.text };
  };
  let subiu = null;
  const r = await enviarImagem({
    sessionId: 'sessao-1',
    senderId: 'remetente-1',
    arquivo: ARQUIVO,
    legenda: 'Feliz Dia dos Pais!',
    api,
    subirBytes: async (url, mime) => {
      subiu = { url, mime };
    },
  });

  check(chamadas.length === 4, 'quatro chamadas na API do mobiliza');
  check(chamadas[0].caminho === '/core/v1/file/upload' && chamadas[0].metodo === 'POST', '1: pede para onde subir');
  check(subiu.url === DO_UPLOAD.urlUpload && subiu.mime === 'image/jpeg',
    '2: os bytes sobem para o endereco assinado, com o mime que foi ASSINADO');
  check(chamadas[1].caminho === '/core/v1/file/transform', '3: converte');
  check(chamadas[2].caminho === '/core/v1/file' && chamadas[2].metodo === 'PUT', '4: registra');
  check(chamadas[3].caminho === '/chat/v1/session/sessao-1/message', '5: a mensagem, no atendimento aberto');
  check(r.legendaFoi === true && r.fileId === 'arquivo-1', 'e a legenda voltou da plataforma');
}

grupo('o que a cadeia recusa — em vez de mandar coisa errada para eleitor');
{
  const api = async () => ({ id: 'x', fileId: 'x' });
  const nada = async () => {};

  let erro = '';
  try {
    await enviarImagem({ sessionId: 's', arquivo: { ...ARQUIVO, mime: 'image/png' }, api, subirBytes: nada });
  } catch (e) {
    erro = e.message;
  }
  check(/png/.test(erro) && /Aprender de novo/.test(erro), 'formato nao observado: recusa dizendo como liberar');

  erro = '';
  try {
    await enviarImagem({ sessionId: '', arquivo: ARQUIVO, api, subirBytes: nada });
  } catch (e) {
    erro = e.message;
  }
  check(/atendimento/.test(erro), 'sem atendimento aberto nao ha onde mandar');

  erro = '';
  try {
    await enviarImagem({
      sessionId: 's',
      arquivo: ARQUIVO,
      api: async (caminho) =>
        caminho === '/core/v1/file/upload'
          ? { ...DO_UPLOAD, urlUpload: 'https://storage.exemplo.com/abc.jpg' }
          : {},
      subirBytes: nada,
    });
  } catch (e) {
    erro = e.message;
  }
  check(/outro endereço/.test(erro), 'endereco de upload desconhecido para antes de tentar');

  /**
   * **O 2xx nao prova nada** — a armadilha mais antiga deste projeto. Se a mensagem voltar sem o
   * arquivo, o que o contato veria e uma mensagem vazia.
   */
  erro = '';
  try {
    await enviarImagem({
      sessionId: 's',
      arquivo: ARQUIVO,
      legenda: 'oi',
      api: async (caminho, opts) => {
        if (caminho === '/core/v1/file/upload') return DO_UPLOAD;
        if (caminho === '/core/v1/file/transform') return CONVERTIDO;
        if (caminho === '/core/v1/file') return { id: 'arquivo-1' };
        return { id: 'msg-1', fileId: null, text: opts.body.text };
      },
      subirBytes: nada,
    });
  } catch (e) {
    erro = e.message;
  }
  check(/sem o arquivo/.test(erro), 'mensagem que voltou sem o fileId e falha, mesmo com 200');
}

fim();
