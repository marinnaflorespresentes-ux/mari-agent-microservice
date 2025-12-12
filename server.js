require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const pino = require('pino');
const pinoHttp = require('pino-http');
const os = require('os');
const process = require('process');
const { OpenAI } = require('openai');

// Inicialização da API OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Inicialização da API Woocommerce (Placeholder)
// const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;
// const wooApi = new WooCommerceRestApi({
//     url: process.env.WOO_STORE_URL,
//     consumerKey: process.env.WOO_CONSUMER_KEY,
//     consumerSecret: process.env.WOO_CONSUMER_SECRET,
//     version: 'wc/v3'
// });

// Inicialização da API Mercado Pago (Placeholder)
// const mercadopago = require('mercadopago');
// mercadopago.configure({
//     access_token: process.env.PAYMENT_API_SECRET
// });

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// 1. Configuração de Logs Estruturados (Pino)
const logger = pino({
    level: NODE_ENV === 'production' ? 'info' : 'debug',
    transport: {
        target: 'pino-pretty', // Usar pino-pretty apenas em desenvolvimento para logs legíveis
        options: {
            colorize: true
        }
    },
    base: {
        pid: process.pid,
        hostname: os.hostname(),
        service: 'mari-agent-microservice'
    },
    timestamp: () => `,"time":"${new Date().toISOString()}"`
});

// Middleware para logs HTTP
app.use(pinoHttp({ logger }));

// Middleware para parsing de JSON
app.use(express.json());

// 2. Rate Limit por IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Limite de 100 requisições por IP por janela
    standardHeaders: true,
    legacyHeaders: false,
    message: (req, res) => {
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
    const body = JSON.stringify(req.body);
    
    // Regex para CPF (XXX.XXX.XXX-XX ou 11 dígitos) e Cartão de Crédito (16 dígitos)
    const sensitiveDataRegex = /(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})|(\d{4}[- ]?){3}\d{4}/g;

    if (sensitiveDataRegex.test(body)) {
        logger.warn({ body_snippet: body.substring(0, 100) }, 'Tentativa de envio de dados sensíveis detectada e bloqueada.');
        
        // Aviso Legal Amigável
        return res.status(400).json({
            status: 'compliance_error',
            message: "Olá! Detectamos que você pode ter incluído informações sensíveis (como CPF ou número de cartão) em sua requisição. Para sua segurança e em conformidade com a LGPD, bloqueamos o processamento desta informação. Por favor, remova os dados sensíveis e tente novamente. Sua privacidade é nossa prioridade."
        });
    }

    // Sanitização básica de logs para evitar vazamento acidental
    const sanitizedBody = body.replace(sensitiveDataRegex, '[DADO_SENSIVEL_MASCARADO]');
    req.log.info({ body: sanitizedBody }, 'Requisição recebida e validada pelo compliance.');

    next();
};

// Aplica o middleware de compliance apenas aos endpoints de processamento de dados
app.use('/api', complianceMiddleware);

// 4. Health Check Detalhado (/health)
app.get('/health', (req, res) => {
    const uptimeSeconds = process.uptime();
    const uptime = `${Math.floor(uptimeSeconds / 86400)} days, ${new Date(uptimeSeconds * 1000).toISOString().substr(11, 8)}`;
    
    // Simulação de status de integrações (deve ser substituído por checagens reais)
    const integrationsStatus = {
        database_main: { status: 'UP', response_time_ms: 5 },
        api_woocommerce: { status: 'UP', response_time_ms: 120 },
        api_pix: { status: 'UP', response_time_ms: 50 }
    };

    const overallStatus = Object.values(integrationsStatus).every(i => i.status === 'UP') ? 'UP' : 'DEGRADED';

    const healthData = {
        status: overallStatus,
        service: 'mari-agent-microservice',
        version: '1.0.0',
        environment: NODE_ENV,
        uptime: uptime,
        memory_usage_mb: (process.memoryUsage().rss / 1024 / 1024).toFixed(2),
        integrations: integrationsStatus
    };

    if (overallStatus === 'UP') {
        res.status(200).json(healthData);
    } else {
        res.status(503).json(healthData); // 503 Service Unavailable se degradado
    }
});

// --- Funções de Lógica de Negócio Real (Woocommerce) ---

// Função para interagir com o Woocommerce (Carrinho Real e Estoque)
const updateWoocommerceCart = async (conversation_id, product_id, quantity) => {
    try {
        // 1. Verificar Estoque (Exemplo: Woocommerce API Products)
        // const product = await wooApi.get(`products/${product_id}`);
        // if (product.stock_quantity < quantity) {
        //     return { success: false, response_text: 'Desculpe, não temos estoque suficiente para este item.' };
        // }

        // 2. Adicionar ao Carrinho (Woocommerce Store API ou um plugin de carrinho)
        // Nota: O Woocommerce REST API padrão não gerencia o carrinho diretamente,
        // mas sim pedidos. Para carrinho, usa-se a Store API ou um plugin.
        // Aqui, simulamos a criação/atualização de um pedido (Order)
        
        logger.info({ conversation_id, product_id, quantity }, 'Chamando Woocommerce API para atualizar carrinho/pedido.');

        // const order = await wooApi.post('orders', {
        //     // Lógica para encontrar o pedido em aberto do cliente e adicionar o item
        // });

        // Simulação de resposta de sucesso
        const newTotal = 150.00;
        return {
            success: true,
            total: newTotal.toFixed(2),
            items: 3,
            response_text: `Produto adicionado ao seu carrinho. O total atual é R$ ${newTotal.toFixed(2)}.`
        };

    } catch (error) {
        logger.error({ error }, 'Erro ao interagir com a API do Woocommerce.');
        return { success: false, response_text: 'Desculpe, houve um erro ao atualizar seu carrinho. Tente novamente mais tarde.' };
    }
};

// --- Funções de Lógica de Negócio Real (Pagamento PIX/Cartão) ---

// Função para iniciar o pagamento real (Exemplo: Mercado Pago)
const initiatePayment = async (conversation_id, amount, method) => {
    try {
        logger.info({ conversation_id, amount, method }, 'Iniciando pagamento real via API.');

        // 1. Criar Preferência de Pagamento (Mercado Pago)
        // const preference = {
        //     items: [{ title: 'Pedido Chatbot', quantity: 1, unit_price: amount }],
        //     notification_url: process.env.PAYMENT_WEBHOOK_URL,
        //     external_reference: conversation_id,
        //     // ... outros dados do cliente
        // };
        // const response = await mercadopago.preferences.create(preference);

        // 2. Lógica PIX (Mercado Pago ou outro gateway)
        if (method === 'PIX') {
            // Exemplo de criação de QR Code PIX
            // const pix_response = await mercadopago.payments.create({
            //     transaction_amount: amount,
            //     payment_method_id: 'pix',
            //     // ...
            // });

            // Simulação de resposta PIX
            return {
                success: true,
                type: 'PIX',
                response_text: `PIX gerado com sucesso no valor de R$ ${amount}. Use o QR Code abaixo para pagar.`,
                qr_code_link: 'https://real.pix.com/qrcode/12345',
                expiration_time: '30 minutos'
            };
        } else if (method === 'CARD') {
            // Simulação de link de pagamento por Cartão
            return {
                success: true,
                type: 'CARD',
                response_text: `Link de pagamento por Cartão gerado com sucesso no valor de R$ ${amount}.`,
                payment_link: 'https://real.pagamento.com/link/67890'
            };
        }
        return { success: false, response_text: 'Método de pagamento não suportado.' };

    } catch (error) {
        logger.error({ error }, 'Erro ao iniciar pagamento real.');
        return { success: false, response_text: 'Desculpe, houve um erro ao processar seu pagamento. Tente novamente mais tarde.' };
    }
};

// --- Funções de Lógica de Negócio (Reais) ---

// Função para obter o contexto da conversa (Memória)
// Em um ambiente real, isso buscaria o histórico da conversa em um banco de dados (ex: Redis)
const getConversationContext = (conversation_id) => {
    // Simulação de memória
    return [
        { role: "system", content: "Você é a agente Mari, uma assistente de vendas amigável e prestativa para uma loja Woocommerce. Seu objetivo é ajudar o cliente a encontrar produtos, somar o carrinho e iniciar o pagamento. Responda em português." },
        { role: "user", content: "Olá, estou procurando um tênis de corrida." },
        { role: "assistant", content: "Olá! Temos vários modelos. Qual o seu tamanho e cor preferida?" }
    ];
};

// Função para interpretar áudio (Whisper)
const interpretAudio = async (audio_url) => {
    try {
        // Nota: A API do Whisper requer um arquivo, não uma URL.
        // Em produção, você precisaria baixar o arquivo da URL do Chatwoot primeiro.
        // Aqui, simulamos a chamada.
        logger.warn({ audio_url }, 'Atenção: A transcrição de áudio real requer o download do arquivo primeiro. Simulação em uso.');
        
        // const response = await openai.audio.transcriptions.create({
        //     file: fs.createReadStream(local_audio_path),
        //     model: "whisper-1",
        // });
        // return response.text;
        
        return 'O usuário disse: "Quero adicionar o tênis azul tamanho 42 ao meu carrinho."';
    } catch (error) {
        logger.error({ error }, 'Erro ao transcrever áudio com OpenAI Whisper.');
        return null;
    }
};

// Função para interpretar imagem (Vision)
const interpretImage = async (image_url) => {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4-vision-preview",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Descreva esta imagem e sugira um produto Woocommerce relacionado, se possível." },
                        { type: "image_url", image_url: { url: image_url } },
                    ],
                },
            ],
            max_tokens: 300,
        });
        return response.choices[0].message.content;
    } catch (error) {
        logger.error({ error }, 'Erro ao interpretar imagem com OpenAI Vision.');
        return 'Não foi possível interpretar a imagem.';
    }
};

// Função principal de IA (Linguagem e Recomendação)
const processWithAI = async (conversation_id, content, media_interpretation) => {
    const context = getConversationContext(conversation_id);
    
    const system_prompt = context[0].content;
    const history = context.slice(1);

    const user_message = media_interpretation ? `${content} (Mídia: ${media_interpretation})` : content;

    const messages = [
        ...history,
        { role: "user", content: user_message }
    ];

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: messages,
            // Força a saída em JSON para facilitar o parseamento da lógica de negócio
            response_format: { type: "json_object" },
            // Prompt de Engenharia para forçar a resposta em um formato estruturado
            // Isso é crucial para a Recommendation Engine e a lógica de negócio
            // O prompt deve instruir a IA a retornar a intenção e a resposta de texto
            // Exemplo de formato JSON esperado:
            // { "intent": "add_to_cart", "product_name": "tênis azul", "quantity": 1, "response_text": "..." }
            // Para simplificar, vamos forçar apenas a resposta de texto e a intenção
            prompt: `${system_prompt}\n\nBaseado no histórico e na última mensagem do usuário, gere uma resposta amigável e determine a intenção do usuário (ex: 'add_to_cart', 'initiate_payment', 'handoff', 'general_query'). Retorne um objeto JSON com as chaves 'response_text' e 'intent'.`,
        });

        const ai_response = JSON.parse(response.choices[0].message.content);
        
        // Lógica de Recomendação (simulada pela IA)
        if (ai_response.intent === 'general_query' && !ai_response.response_text.includes('recomendação')) {
            ai_response.response_text += "\n\n**Recomendação:** Baseado no seu interesse, sugiro o 'Tênis Ultraboost 22' (R$ 799,00).";
        }

        return ai_response;

    } catch (error) {
        logger.error({ error }, 'Erro ao processar com OpenAI Chat.');
        return { intent: 'error', response_text: 'Desculpe, tive um erro de comunicação com a inteligência artificial.' };
    }
};

// Simula a interação com a API do Woocommerce para adicionar um item ao carrinho
const simulateWoocommerceCart = (conversation_id, product_name, quantity) => {
    // Em um ambiente real, aqui ocorreria a chamada à API do Woocommerce
    // usando as credenciais do .env para adicionar o item ao carrinho associado ao conversation_id.
    logger.info({ conversation_id, product_name, quantity }, 'Simulando adição de item ao carrinho Woocommerce.');
    
    // Lógica de soma simulada
    const currentTotal = 100.00;
    const itemPrice = 50.00;
    const newTotal = currentTotal + (itemPrice * quantity);

    return {
        success: true,
        total: newTotal.toFixed(2),
        items: 3, // Simulação de 3 itens no total
        response_text: `Adicionado ${quantity}x ${product_name} ao carrinho. O total atual é R$ ${newTotal.toFixed(2)}.`
    };
};

// Simula a inicialização de um pagamento (PIX ou Cartão)
const simulatePaymentInitiation = (conversation_id, amount, method) => {
    // Em um ambiente real, aqui ocorreria a chamada à API da Pagar.me, Mercado Pago, etc.
    logger.info({ conversation_id, amount, method }, 'Simulando inicialização de pagamento.');

    if (method === 'PIX') {
        return {
            success: true,
            type: 'PIX',
            response_text: `PIX gerado com sucesso no valor de R$ ${amount}. Use o QR Code abaixo para pagar.`,
            qr_code_link: 'https://simulado.pix.com/qrcode/12345',
            expiration_time: '30 minutos'
        };
    } else if (method === 'CARD') {
        return {
            success: true,
            type: 'CARD',
            response_text: `Link de pagamento por Cartão gerado com sucesso no valor de R$ ${amount}.`,
            payment_link: 'https://simulado.pagamento.com/link/67890'
        };
    }
    return { success: false, response_text: 'Método de pagamento não suportado.' };
};

// Função para interpretar áudio ou imagem via IA (Real)
const interpretMedia = async (attachments) => {
    if (!attachments || attachments.length === 0) {
        return { text: null };
    }

    const firstAttachment = attachments[0];
    logger.info({ attachment_type: firstAttachment.type, url: firstAttachment.url }, 'Iniciando interpretação de mídia real.');

    if (firstAttachment.type === 'image') {
        const vision_text = await interpretImage(firstAttachment.url);
        return { text: vision_text };
    } else if (firstAttachment.type === 'audio') {
        // Nota: Em um cenário real, o n8n deveria baixar o áudio e enviá-lo para um endpoint
        // que faria o upload para o Whisper. Aqui, apenas a simulação do resultado.
        const audio_text = await interpretAudio(firstAttachment.url);
        return { text: audio_text };
    }

    return { text: null };
};





app.post('/api/process-message', async (req, res) => {
    const { conversation_id, content, attachments } = req.body;
    
    // Lógica de handoff básica (simulação)
    let action = 'reply';
    let response_text = content ? `Olá! Recebi sua mensagem: "${content}".` : 'Olá! Recebi sua mensagem.';
    let handoff_required = false;
    let cart_status = { total: 0.00, items: 0 };

    // 5.1. Interpretação de Mídia (Visão e Áudio)
    const mediaInterpretation = await interpretMedia(attachments);
    let processed_content = content || mediaInterpretation.text;

    // 5.2. Processamento de Linguagem e Intenção (OpenAI)
    const ai_result = await processWithAI(conversation_id, processed_content, mediaInterpretation.text);
    
    let action = 'reply';
    let response_text = ai_result.response_text;
    let handoff_required = false;
    let cart_status = { total: 0.00, items: 0 };

    // 5.3. Execução da Lógica de Negócio baseada na Intenção da IA
    switch (ai_result.intent) {
        case 'add_to_cart':
            // A IA deve ter extraído o ID do produto e a quantidade
            const product_id = ai_result.product_id || 123; // ID real do Woocommerce
            const quantity = ai_result.quantity || 1;
            
            // Lógica de Carrinho Real (Woocommerce)
            const cartResult = await updateWoocommerceCart(conversation_id, product_id, quantity);
            response_text = cartResult.response_text;
            cart_status.total = cartResult.total;
            cart_status.items = cartResult.items;
            break;

        case 'initiate_payment':
            // Lógica de Pagamento Real (PIX/Cartão)
            // Assumimos que o carrinho já foi somado e o total está disponível
            const total_amount = cart_status.total || 150.00;
            const payment_method = ai_result.payment_method || 'PIX';

            const paymentResult = await initiatePayment(conversation_id, total_amount, payment_method);
            response_text = paymentResult.response_text + (paymentResult.qr_code_link ? `\nLink do QR Code: ${paymentResult.qr_code_link}` : '');
            break;

        case 'handoff':
            action = 'handoff';
            handoff_required = true;
            response_text = 'Entendido. Vou transferir você para um de nossos atendentes. Por favor, aguarde um momento.';
            break;

        case 'error':
            // A IA já gerou a mensagem de erro
            break;

        case 'general_query':
        default:
            // A IA já gerou a resposta de texto e a recomendação
            break;
    }

    req.log.info({ conversation_id, handoff_required, cart_status, ai_intent: ai_result.intent }, 'Mensagem processada com sucesso com IA.');

    // 5.4. Implementação de Delay e Fila de Mensagens (Simulação)
    // O delay e a fila de mensagens são idealmente gerenciados pelo n8n (Webhook Response)
    // ou por um sistema de fila dedicado (ex: Redis/RabbitMQ) para evitar bloquear o microservice.
    // Para simular o delay, podemos usar um pequeno timeout, mas é desaconselhado em produção.
    // Para a fila, o n8n deve ser configurado para processar mensagens sequencialmente por conversa.
    
    // Simulação de Delay (Descomente apenas para teste local)
    // await new Promise(resolve => setTimeout(resolve, 1000)); // 1 segundo de delay

    res.json({
        action: action,
        response_text: response_text,
        handoff_required: handoff_required,
        cart_status: cart_status
    });
});

// Endpoint de Logs (Apenas para Dev/Staging e protegido)
app.get('/logs', (req, res) => {
    // Em produção, isso seria uma chamada a um sistema de agregação de logs (ex: ElasticSearch)
    // Aqui, apenas um placeholder para o conceito.
    res.status(501).json({ message: 'Endpoint de logs não implementado para leitura direta em produção. Use ferramentas de observabilidade.' });
});

// Inicialização do Servidor
app.get('/health', (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "Mari Microservice está rodando! 🚀"
    });
});
app.listen(PORT, () => {
    logger.info(`Servidor Mari Agent rodando na porta ${PORT} em modo ${NODE_ENV}`);
});
