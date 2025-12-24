import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { encoding_for_model, TiktokenModel } from 'tiktoken';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LLMResponse {
    content: string;
    tokens: number;
    totalTokens: number;
}

@Injectable()
export class LlmService {
    private readonly logger = new Logger(LlmService.name);
    private readonly axiosClient: AxiosInstance;
    private readonly model: string;
    private readonly maxRetries: number;
    private readonly retryDelayMs: number;
    private readonly maxContextTokens: number;
    private encoding: any;

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('llm.apiKey');
        const baseUrl = this.configService.get<string>('llm.baseUrl');
        this.model = this.configService.get<string>('llm.model') ?? 'gpt-4o-mini';
        this.maxRetries = this.configService.get<number>('llm.maxRetries') ?? 3;
        this.retryDelayMs = this.configService.get<number>('llm.retryDelayMs') ?? 1000;
        this.maxContextTokens = this.configService.get<number>(
            'llm.maxContextTokens',
        ) ?? 4000;

        // Debug: Log config values (mask API key)
        this.logger.log('=== LLM Configuration ===');
        this.logger.log(`API Key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'NOT SET'}`);
        this.logger.log(`Base URL: ${baseUrl || 'NOT SET'}`);
        this.logger.log(`Model: ${this.model}`);
        this.logger.log('========================');

        if (!apiKey) {
            this.logger.error('❌ LLM_API_KEY is not set in .env file!');
        }
        if (!baseUrl) {
            this.logger.error('❌ LLM_BASE_URL is not set in .env file!');
        }

        // Create axios client for YesScale API
        this.axiosClient = axios.create({
            baseURL: baseUrl,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            timeout: 60000, // 60 seconds
        });

        // Initialize tiktoken for token counting
        try {
            this.encoding = encoding_for_model('gpt-3.5-turbo' as TiktokenModel);
        } catch (error) {
            this.logger.warn('Failed to initialize tiktoken, using fallback');
        }
    }

    /**
     * Count tokens in a text string
     */
    countTokens(text: string): number {
        if (!this.encoding) {
            return Math.ceil(text.length / 4);
        }

        try {
            const tokens = this.encoding.encode(text);
            return tokens.length;
        } catch (error) {
            this.logger.warn('Token counting failed, using fallback');
            return Math.ceil(text.length / 4);
        }
    }

    /**
     * Count tokens in messages array
     */
    countMessagesTokens(messages: ChatMessage[]): number {
        let totalTokens = 0;
        for (const message of messages) {
            totalTokens += this.countTokens(message.content);
            totalTokens += 4;
        }
        totalTokens += 3;
        return totalTokens;
    }

    /**
     * Trim messages to fit within token limit
     * NOTE: Input messages should already be in chronological order (oldest to newest)
     */
    trimMessages(messages: ChatMessage[], maxTokens: number): ChatMessage[] {
        const systemMessages = messages.filter((m) => m.role === 'system');
        const otherMessages = messages.filter((m) => m.role !== 'system');

        let currentTokens = this.countMessagesTokens(systemMessages);
        const trimmedMessages: ChatMessage[] = [...systemMessages];

        // Iterate from end (newest) to beginning (oldest) to keep recent messages
        for (let i = otherMessages.length - 1; i >= 0; i--) {
            const message = otherMessages[i];
            const messageTokens = this.countTokens(message.content) + 4;

            if (currentTokens + messageTokens <= maxTokens) {
                // Insert at the beginning of non-system messages to maintain chronological order
                trimmedMessages.splice(systemMessages.length, 0, message);
                currentTokens += messageTokens;
            } else {
                break;
            }
        }

        // Messages are already in correct order: system messages first, then chronological conversation
        // DO NOT reverse here - messages should be oldest to newest for LLM
        return trimmedMessages;
    }

    /**
     * Generate chat completion with retry logic - Direct YesScale API call
     */
    async generateResponse(messages: ChatMessage[]): Promise<LLMResponse> {
        const trimmedMessages = this.trimMessages(messages, this.maxContextTokens);
        console.log("trimmedMessages", trimmedMessages);

        let lastError: Error | undefined;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                this.logger.debug(`Attempt ${attempt}/${this.maxRetries} to generate response`);

                // Direct API call to YesScale
                const response = await this.axiosClient.post('/chat/completions', {
                    model: this.model,
                    messages: trimmedMessages,
                    temperature: 0.7,
                    max_tokens: 1000,
                });

                const content = response.data.choices[0]?.message?.content || '';
                const responseTokens = this.countTokens(content);
                const totalTokens = this.countMessagesTokens(trimmedMessages) + responseTokens;

                this.logger.log(`Generated response with ${responseTokens} tokens (total: ${totalTokens})`);

                return {
                    content,
                    tokens: responseTokens,
                    totalTokens,
                };
            } catch (error) {
                lastError = error;
                const errorMsg = error.response?.data?.error?.message || error.message;
                this.logger.warn(`Attempt ${attempt} failed: ${errorMsg}`);

                if (attempt < this.maxRetries) {
                    await this.sleep(this.retryDelayMs * attempt);
                }
            }
        }

        this.logger.error(`All ${this.maxRetries} attempts failed`, lastError?.stack);
        throw new Error(
            `Failed to generate response after ${this.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
        );
    }

    /**
     * Generate a summary of conversation
     */
    async generateSummary(messages: ChatMessage[]): Promise<LLMResponse> {
        const summaryPrompt: ChatMessage[] = [
            {
                role: 'system',
                content:
                    'You are a helpful assistant that creates concise summaries of conversations. Summarize the key points and context from the following conversation in 2-3 sentences.',
            },
            {
                role: 'user',
                content: `Please summarize this conversation:\n\n${messages
                    .map((m) => `${m.role}: ${m.content}`)
                    .join('\n')}`,
            },
        ];

        return this.generateResponse(summaryPrompt);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    onModuleDestroy() {
        if (this.encoding) {
            this.encoding.free();
        }
    }
}
