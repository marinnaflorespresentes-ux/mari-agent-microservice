require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const pino = require('pino');
const pinoHttp = require('pino-http');
const os = require('os');
const process = require('process');
const { OpenAI } = require('openai');

// --- Inicialização OpenAI ---
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// --- Logger ---
const logger = pino({
    level: NODE_ENV === 'production' ? 'info' : 'debug',
    transport: {
        target: 'pino-pretty',
        options: { colorize: true }
    },
    base: {
        pid: process.pid,
        hostname: os.hostname(),
        service: 'mari-agent-microservice'
    },
    timestamp: () => `,"time":"${new Date().toISOString()}"`
});

app.use(pinoHttp({ logger }));
app.use(express.json());

// --- Rate Limit ---
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// --- Compliance LGPD ---
const complianceMiddleware = (req, res, next) => {
    const body = JSON.stringify(req.body);
    const sensitiveDataRegex = /(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})|(\d{4}[- ]?){3}\d{4}/g;

    if (sensitiveDataRegex.test(body)) {
        return res.status(400).json({
            status: 'compliance_error',
            message: "Detectamos dados sensíveis. Remova CPF/cartão e tente novamente."
        });
    }

    next();
};

app.use('/api', complianceMiddleware);

// --- Healthcheck Principal ---
app.get('/health', (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "Mari Microservice rodando! 🚀"
    });
});

// --- Funções auxiliares (mantidas do seu arquivo) ---
const interpretAudio = async () => {
    return 'O usuário disse: "Quero adicionar o tênis azul tamanho 42 ao meu carrinho."';
};

const interpretImage = async () => {
    return "Imagem interpretada (simulação).";
};

const interpretMedia = async (attachments) => {
    if (!attachments || attachments.length === 0) return { text: null };
    const file = attachments[0];

    if (file.type === 'image') return { text: await interpretImage(file.url) };
    if (file.type === 'audio') return { text: await interpretAudio(file.url) };

    return { text: null };
};

const getConversationContext = () => {
    return [
        { role: "system", content: "Você é a agente Mari, uma vendedora simpática da loja." }
    ];
};

const processWithAI = async (conversation_id, content, media) => {
    try {
        const ctx = getConversationContext(conversation_id);

        const ai = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [
                ...ctx,
                { role: "user", content }
            ],
            response_format: { type: "json_object" },
            prompt: "Gere JSON com 'response_text' e 'intent'."
        });

        return JSON.parse(ai.choices[0].message.content);

    } catch (err) {
        logger.error(err);
        return { intent: "error", response_text: "Erro na IA." };
    }
};

const updateWoocommerceCart = async () => {
    return {
        success: true,
        total: "150.00",
        items: 3,
        response_text: "Item adicionado ao carrinho! Total: R$ 150,00"
    };
};

const initiatePayment = async () => {
    return {
        success: true,
        response_text: "PIX gerado com sucesso!",
        qr_code_link: "https://exemplo.com/qrcode"
    };
};

// --- ROTA PRINCIPAL CORRIGIDA ---
app.post('/api/process-message', async (req, res) => {
    const { conversation_id, content, attachments } = req.body;

    let action = 'reply';
    let response_text = content || "Recebi sua mensagem!";
    let handoff_required = false;
    let cart_status = { total: 0, items: 0 };

    // 1. Mídia
    const media = await interpretMedia(attachments);
    const processed = content || media.text;

    // 2. IA
    const ai = await processWithAI(conversation_id, processed, media.text);
    response_text = ai.response_text;

    // 3. Intenções
    switch (ai.intent) {
        case "add_to_cart":
            const c = await updateWoocommerceCart();
            response_text = c.response_text;
            cart_status = { total: c.total, items: c.items };
            break;

        case "initiate_payment":
            const p = await initiatePayment();
            response_text = p.response_text + "\n" + p.qr_code_link;
            break;

        case "handoff":
            action = "handoff";
            handoff_required = true;
            response_text = "Chamando atendente 💛";
            break;
    }

    res.json({
        action,
        response_text,
        handoff_required,
        cart_status
    });
});

// --- Inicia servidor ---
app.listen(PORT, () => {
    logger.info(`Servidor rodando na porta ${PORT}`);
});
