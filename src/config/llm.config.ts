import { registerAs } from '@nestjs/config';

export default registerAs('llm', () => ({
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL || 'https://api.yescale.io/v1',
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
    maxContextTokens: parseInt(process.env.MAX_CONTEXT_TOKENS || '4000', 10),
    messagesBeforeSummary:
        parseInt(process.env.MESSAGES_BEFORE_SUMMARY || '20', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '1000', 10),
    // User limits
    maxTokensPerUserDaily: parseInt(process.env.MAX_TOKENS_PER_USER_DAILY || '50000', 10),
    maxTokensPerUserMonthly: parseInt(process.env.MAX_TOKENS_PER_USER_MONTHLY || '500000', 10),
    maxMessagesPerUserDaily: parseInt(process.env.MAX_MESSAGES_PER_USER_DAILY || '100', 10),
}));
