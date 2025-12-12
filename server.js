require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const pino = require('pino');
const pinoHttp = require('pino-http');
const os = require('os');
const process = require('process');
const bodyParser = require('body-parser'); // adicionado explicitamente
const { OpenAI } = require('openai');
const fs = require('fs');

// --- Validação mínima das env vars obrigatórias ---
const requiredEnvs = ['OPENAI_API_KEY'];
const missing = requiredEnvs.filter(e => !process.env[e]);
if (missing.length) {
  console.warn(`⚠️  Variáveis de ambiente faltando: ${missing.join(', ')}. O servidor ainda inicializará, mas algumas integrações podem falhar.`);
}

// Inicialização da API OpenAI
let openai;
try {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} catch (err) {
  console.warn('Não foi possível inicializar OpenAI (verifique OPENAI_API_KEY).', err?.message || err);
}

// placeholders para bibliotecas externas (WooCommerce, MercadoPago). Comentados no package.json
// const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;
// const mercadopago = require('mercadopago');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// 1. Configuração de Logs Estruturados (Pino)
const logger = pino({
  level: NODE_ENV === 'production' ? 'info' : 'debug',
  transport: NODE_ENV === 'production' ? undefined : { target: 'pino-pretty', options: { colorize: true } },
  base: {
    pid: process.pid,
    hostname: os.hostname(),
    service: 'mari-agent-microservice'
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`
});

// Middleware para logs HTTP
app.use(pinoHttp({ logger }));

// Body parsing (inclui suporte a payloads grandes se precisar enviar mídia JSON)
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// 2. Rate Limit por IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // ajuste para tolerância (aumentei um pouco)
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({ ip: req.ip, endpoint: req.originalUrl }, 'Rate limit excedido');
    return res.status(429).json({
      status: 'error',
      message: 'Muitas requisições. Por favor, tente novamente mais tarde.'
    });
  }
});
app.use(limiter);

// 3. Compliance/Bloqueio de Dados Sensíveis (A Cereja Suprema)
const complianceMiddleware = (req, res, next) => {
  const body = JSON.stringify(req.body || '');
  // Regex para CPF (XXX.XXX.XXX-XX ou 11 dígitos) e Cartão de Crédito (16 dígitos contínuos ou espaços/traços)
  const sensitiveDataRegex = /(\d{3}\.\d{3}\.\d{3}-\d{2}|\b\d{11}\b)|((\d{4}[- ]?){3}\d{4})/g;

  if (sensitiveDataRegex.test(body)) {
    logger.warn({ body_snippet: body.substring(0, 200) }, 'Tentativa de envio de dados sensíveis detectada e bloqueada.');
    return res.status(400).json({
      status: 'compliance_error',
      message: "Olá! Detectamos que você pode ter incluído informações sensíveis (como CPF ou número de cartão). Por segurança e conformidade, bloqueamos o processamento. Remova esses dados e tente novamente."
    });
  }

  // Log sanitizado
  const sanitizedBody = body.replace(sensitiveDataRegex, '[DADO_SENSIVEL_MASCARADO]');
  req.log && req.log.info({ body: sanitizedBody }, 'Requisição validada pelo compliance.');
  next();
};

// Aplica o middleware de compliance apenas aos endpoints /api
app.use('/api', complianceMiddleware);

// 4. Health Check Detalhado (/health)
app.get('/health', (req, res) => {
  const uptimeSeconds = process.uptime();
  const uptime = `${Math.floor(uptimeSeconds / 86400)} days, ${new Date(uptimeSeconds * 1000).toISOString().substr(11, 8)}`;

  // Se desejar, substitua por checagens reais (DB, Woo, Pagamentos)
  const integrationsStatus = {
    openai: openai ? { status: 'UP' } : { status: 'UNCONFIGURED' },
    woocommerce: process.env.WOO_STORE_URL ? { status: 'CONFIGURED' } : { status: 'UNCONFIGURED' },
    payment_gateway: process.env.PAYMENT_API_KEY ? { status: 'CONFIGURED' } : { status: 'UNCONFIGURED' }
  };

  const overallStatus = Object.values(integrationsStatus).every(i => i.status === 'UP' || i.status === 'CONFIGURED') ? 'UP' : 'DEGRADED';

  const healthData = {
    status: overallStatus,
    service: 'mari-agent-microservice',
    version: process.env.SERVICE_VERSION || '1.0.0',
    environment: NODE_ENV,
    uptime,
    memory_usage_mb: (process.memoryUsage().rss / 1024 / 1024).toFixed(2),
    integrations: integrationsStatus
  };

  res.status(overallStatus === 'UP' ? 200 : 503).json(healthData);
});

// --- Funções auxiliaries (Woocommerce / pagamento / IA simuladas ou placeholders) ---
const updateWoocommerceCart = async (conversation_id, product_id, quantity) => {
  try {
    logger.info({ conversation_id, product_id, quantity }, 'Chamando Woocommerce API (placeholder) para atualizar carrinho/pedido.');
    // TODO: implementar chamada real ao WooCommerce Store API / Orders
    const newTotal = 150.00;
    return {
      success: true,
      total: newTotal.toFixed(2),
      items: 3,
      response_text: `Produto adicionado ao seu carrinho. O total atual é R$ ${newTotal.toFixed(2)}.`
    };
  } catch (error) {
    logger.error({ err: error?.message || error }, 'Erro ao interagir com a API do Woocommerce.');
    return { success: false, response_text: 'Desculpe, houve um erro ao atualizar seu carrinho. Tente novamente mais tarde.' };
  }
};

const initiatePayment = async (conversation_id, amount, method) => {
  try {
    logger.info({ conversation_id, amount, method }, 'Iniciando pagamento (placeholder).');
    if (method === 'PIX') {
      return {
        success: true,
        type: 'PIX',
        response_text: `PIX gerado: R$ ${amount}. Use o QR Code para pagar.`,
        qr_code_link: 'https://simulado.pix/qrcode/12345',
        expiration_time: '30 minutos'
      };
    } else if (method === 'CARD') {
      return {
        success: true,
        type: 'CARD',
        response_text: `Link de pagamento por cartão gerado: R$ ${amount}.`,
        payment_link: 'https://simulado.pagamento/link/67890'
      };
    }
    return { success: false, response_text: 'Método de pagamento não suportado.' };
  } catch (error) {
    logger.error({ err: error?.message || error }, 'Erro ao iniciar pagamento real.');
    return { success: false, response_text: 'Erro ao processar o pagamento.' };
  }
};

// Memória simulada — substitua por Redis/DB em produção
const getConversationContext = (conversation_id) => {
  return [
    { role: "system", content: "Você é a agente Mari, assistente de vendas gentil e jovial. Ajude o cliente em português." },
    { role: "user", content: "Olá" },
    { role: "assistant", content: "Olá! Como posso te ajudar hoje?" }
  ];
};

// Interpretação de mídia (placeholders)
const interpretAudio = async (audio_url) => {
  logger.debug({ audio_url }, 'interpretAudio: usando simulação (baixar e enviar para Whisper em produção).');
  return 'O usuário disse: "Quero adicionar o tênis azul tamanho 42 ao meu carrinho."';
};

const interpretImage = async (image_url) => {
  if (!openai) return 'Serviço de visão não configurado.';
  try {
    // Exemplo simples — dependendo da versão da SDK, a chamada real pode variar
    const resp = await openai.chat.completions.create?.({
      model: "gpt-4o-mini", // ajuste conforme disponibilidade
      messages: [{ role: 'user', content: `Descreva a imagem: ${image_url}` }],
      max_tokens: 300
    });
    // fallback: se resp estiver vazio
    return (resp?.choices?.[0]?.message?.content) || 'Não foi possível interpretar a imagem.';
  } catch (err) {
    logger.error({ err: err?.message || err }, 'Erro ao interpretar imagem.');
    return 'Não foi possível interpretar a imagem.';
  }
};

const processWithAI = async (conversation_id, content, media_interpretation) => {
  const context = getConversationContext(conversation_id);
  const system_prompt = context[0].content;
  const history = context.slice(1);

  const user_message = media_interpretation ? `${content} (Mídia: ${media_interpretation})` : content;
  const messages = [
    { role: "system", content: system_prompt },
    ...history,
    { role: "user", content: user_message }
  ];

  if (!openai || !openai.chat) {
    logger.warn('OpenAI não configurado ou versão da SDK sem suporte a chat.completions.create. Retornando resposta simulada.');
    return { intent: 'general_query', response_text: `Simulação: ${user_message}` };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // ajuste de modelo se necessário
      messages,
      max_tokens: 400,
      temperature: 0.2
    });

    const raw = response?.choices?.[0]?.message?.content;
    // tenta parsear JSON se a resposta estiver estruturada, senão devolve como texto
    try {
      const parsed = JSON.parse(raw);
      return parsed;
    } catch {
      return { intent: 'general_query', response_text: raw || 'Desculpe, sem resposta da IA.' };
    }
  } catch (err) {
    logger.error({ err: err?.message || err }, 'Erro ao chamar OpenAI.');
    return { intent: 'error', response_text: 'Desculpe, erro ao contactar a IA.' };
  }
};

const interpretMedia = async (attachments) => {
  if (!attachments || attachments.length === 0) return { text: null };
  const first = attachments[0];
  logger.info({ attachment_type: first.type, url: first.url }, 'interpretMedia');
  if (first.type === 'image') {
    const text = await interpretImage(first.url);
    return { text };
  } else if (first.type === 'audio') {
    const text = await interpretAudio(first.url);
    return { text };
  }
  return { text: null };
};

// --- Endpoint principal ---
app.post('/api/process-message', async (req, res) => {
  const { conversation_id, content, attachments } = req.body || {};
  let action = 'reply';
  let response_text = content ? `Olá! Recebi sua mensagem: "${content}".` : 'Olá! Recebi sua mensagem.';
  let handoff_required = false;
  let cart_status = { total: 0.00, items: 0 };

  try {
    const mediaInterpretation = await interpretMedia(attachments);
    const processed_content = content || mediaInterpretation.text || '';

    const ai_result = await processWithAI(conversation_id, processed_content, mediaInterpretation.text);

    // se ai_result for string (fallback) transforma em objeto
    const ai = (typeof ai_result === 'string') ? { intent: 'general_query', response_text: ai_result } : ai_result;

    response_text = ai.response_text || response_text;

    switch (ai.intent) {
      case 'add_to_cart': {
        const product_id = ai.product_id || 123;
        const quantity = ai.quantity || 1;
        const cartResult = await updateWoocommerceCart(conversation_id, product_id, quantity);
        response_text = cartResult.response_text;
        cart_status.total = cartResult.total;
        cart_status.items = cartResult.items;
        break;
      }
      case 'initiate_payment': {
        const total_amount = ai.total_amount || cart_status.total || 150.00;
        const payment_method = ai.payment_method || 'PIX';
        const paymentResult = await initiatePayment(conversation_id, total_amount, payment_method);
        response_text = paymentResult.response_text + (paymentResult.qr_code_link ? `\nLink do QR Code: ${paymentResult.qr_code_link}` : '') + (paymentResult.payment_link ? `\nLink de pagamento: ${paymentResult.payment_link}` : '');
        break;
      }
      case 'handoff': {
        action = 'handoff';
        handoff_required = true;
        response_text = 'Entendido. Vou transferir você para um de nossos atendentes.';
        break;
      }
      case 'error': {
        // IA já retornou mensagem de erro
        break;
      }
      case 'general_query':
      default:
        // resposta já preenchida
        break;
    }

    req.log && req.log.info({ conversation_id, handoff_required, cart_status, ai_intent: ai.intent }, 'Mensagem processada com sucesso com IA.');
    // Não bloquear o servidor com delays aqui — n8n deve controlar UX/delay
    return res.json({
      action,
      response_text,
      handoff_required,
      cart_status
    });

  } catch (err) {
    logger.error({ err: err?.message || err }, 'Erro geral no processamento de mensagem.');
    return res.status(500).json({ action: 'reply', response_text: 'Desculpe, houve um erro interno.' });
  }
});

// Endpoint de Logs (dev only)
app.get('/logs', (req, res) => {
  res.status(501).json({ message: 'Endpoint de logs não implementado para leitura direta em produção. Use ferramentas de observabilidade.' });
});

// Tratamento de SIGTERM para desligamento gracioso
process.on('SIGTERM', () => {
  logger.info('SIGTERM recebido, finalizando servidor...');
  process.exit(0);
});

// Inicialização do Servidor
app.listen(PORT, () => {
  logger.info(`Servidor Mari Agent rodando na porta ${PORT} em modo ${NODE_ENV}`);
});
