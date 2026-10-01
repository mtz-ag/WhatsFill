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
  podeConverterAqui,
  MIMES_DO_SELETOR,
  MIMES_ACEITOS,
  nomeComoJpeg,
  bytesDoBase64,
  medidaParaDesenhar,
  LADO_MAXIMO,
  TETO_GUARDADO_BYTES,
  TETO_ESCOLHIDO_BYTES,
  QUALIDADES_JPEG,
  FUNDO_DO_JPEG,
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

/**
 * O PNG escondido no seletor (01/10/2026). O que se protege aqui: a lista da PLATAFORMA nao muda
 * — quem converte e o navegador, antes de ela ver —, e o seletor passa a MOSTRAR o arquivo.
 */
grupo('conversao local: o seletor mostra, mas o que sobe continua sendo JPEG');
{
  check(podeConverterAqui('image/png'), 'PNG e convertido aqui -- era o arquivo que a janela escondia');
  check(podeConverterAqui('IMAGE/WEBP'), 'caixa nao decide formato');
  check(podeConverterAqui('image/gif') && podeConverterAqui('image/bmp'), 'gif e bmp tambem');

  check(!podeConverterAqui('image/jpeg'), 'JPEG nao precisa de conversao: reconverter perde qualidade de graca');
  check(!podeConverterAqui('image/svg+xml'), 'SVG fica de fora: desenho vetorial em canvas depende de fonte e tamanho');
  check(!podeConverterAqui('application/pdf'), 'PDF nao e imagem');
  check(!podeConverterAqui('image/heic'), 'HEIC fica de fora: o Chrome nao decodifica, e o canvas sairia em branco');
  check(!podeConverterAqui('') && !podeConverterAqui(undefined), 'vazio nao passa');

  check(MIMES_DO_SELETOR.includes('image/png'), 'o accept do seletor inclui o PNG -- e isto que destrava o explorer');
  check(MIMES_DO_SELETOR.includes('image/jpeg'), 'e continua incluindo o JPEG');
  for (const mime of MIMES_ACEITOS.split(',')) {
    check(MIMES_DO_SELETOR.includes(mime), `o seletor nunca mostra MENOS que a plataforma aceita (${mime})`);
  }
  check(!MIMES_DO_SELETOR.includes('svg'), 'e nao mostra o que ninguem sabe converter');
}

grupo('o nome tem de combinar com o que sobe, que e sempre JPEG');
{
  check(nomeComoJpeg('colinha.png') === 'colinha.jpg', 'troca a extensao');
  check(nomeComoJpeg('colinha.PNG') === 'colinha.jpg', 'em qualquer caixa');
  check(nomeComoJpeg('colinha.jpeg') === 'colinha.jpg', 'jpeg tambem vira jpg -- e o que o passo 3 devolve');
  check(nomeComoJpeg('arte 10122 v2.webp') === 'arte 10122 v2.jpg', 'espaco e numero no nome nao incomodam');
  check(nomeComoJpeg('colinha.final.png') === 'colinha.final.jpg', 'so a ULTIMA extensao sai');
  check(nomeComoJpeg('colinha') === 'colinha.jpg', 'sem extensao, acrescenta');
  check(nomeComoJpeg('') === 'imagem.jpg' && nomeComoJpeg(null) === 'imagem.jpg', 'sem nome, um nome qualquer serve');
}

grupo('o lado maior tem teto, e imagem pequena NAO e ampliada');
{
  const grande = medidaParaDesenhar(3000, 1500);
  check(grande.reduziu === true, 'acima do teto, reduz');
  check(grande.largura === LADO_MAXIMO, 'o lado maior fica no teto');
  check(grande.altura === 800, 'e a proporcao e mantida');

  const alta = medidaParaDesenhar(1000, 4000);
  check(alta.altura === LADO_MAXIMO && alta.largura === 400, 'vale para o lado maior, seja largura ou altura');

  const pequena = medidaParaDesenhar(800, 600);
  check(pequena.reduziu === false, 'abaixo do teto nao mexe');
  check(pequena.largura === 800 && pequena.altura === 600, 'e NAO amplia: ampliar nao inventa detalhe, so peso');

  const exata = medidaParaDesenhar(LADO_MAXIMO, 900);
  check(exata.reduziu === false, 'no teto exato tambem nao mexe');

  const fina = medidaParaDesenhar(5000, 3);
  check(fina.altura >= 1, 'arredondamento nunca produz altura zero -- canvas de lado 0 lanca');
  check(medidaParaDesenhar(0, 0).largura === 1, 'medida invalida nao virou canvas de lado 0');
}

grupo('o tamanho que decide se cabe e o do base64, nao o do arquivo');
{
  check(bytesDoBase64('AAAA') === 3, 'quatro caracteres de base64 sao tres bytes');
  check(bytesDoBase64('AAA=') === 2, 'o "=" nao conta como dado');
  check(bytesDoBase64('AA==') === 1, 'dois "=" idem');
  check(bytesDoBase64('') === 0 && bytesDoBase64(null) === 0, 'vazio e zero');
}

grupo('os dois tetos e as qualidades');
{
  check(TETO_ESCOLHIDO_BYTES > TETO_GUARDADO_BYTES,
    'escolher aceita mais que guardar: PNG e inchado, e recusar pelo tamanho do original recusa o que cabe');
  check(TETO_GUARDADO_BYTES === 2 * 1024 * 1024, 'o de guardar continua 2 MB');
  check(QUALIDADES_JPEG.length > 1, 'ha mais de uma tentativa de qualidade');
  check(QUALIDADES_JPEG.every((q, i) => i === 0 || q < QUALIDADES_JPEG[i - 1]), 'e elas CAEM: a primeira que cabe vai');
  check(QUALIDADES_JPEG[0] > 0.85, 'a primeira tentativa e de qualidade alta');
  check(QUALIDADES_JPEG.every((q) => q > 0.5), 'e nenhuma chega a borrar a arte');
  check(/^#f{3,6}$/i.test(FUNDO_DO_JPEG),
    'o fundo e BRANCO: sem ele, PNG transparente chega ao eleitor num quadrado preto');
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
