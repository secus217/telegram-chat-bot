import { Injectable, Logger } from '@nestjs/common';
import { Update, Ctx, Start, Help, Command, On, Message } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { UserService } from '../services/user.service';
import { ConversationService } from '../services/conversation.service';
import { LlmService, ChatMessage } from '../services/llm.service';
import { UsageLimitService } from '../services/usage-limit.service';
import { MessageRole } from '../entities/message.entity';

@Update()
@Injectable()
export class BotUpdate {
    private readonly logger = new Logger(BotUpdate.name);

    constructor(
        private readonly userService: UserService,
        private readonly conversationService: ConversationService,
        private readonly llmService: LlmService,
        private readonly usageLimitService: UsageLimitService,
    ) { }

    @Start()
    async onStart(@Ctx() ctx: Context) {
        const telegramUser = ctx.from;

        if (!telegramUser) {
            await ctx.reply('❌ Cannot identify user');
            return;
        }

        // Create or update user
        await this.userService.findOrCreateUser({
            telegramId: telegramUser.id,
            username: telegramUser.username,
            firstName: telegramUser.first_name,
            lastName: telegramUser.last_name,
            languageCode: telegramUser.language_code,
        });

        await ctx.reply(
            '👋 Xin chào! Tôi là chatbot AI thông minh.\n\n' +
            'Tôi có thể:\n' +
            '✅ Trò chuyện và trả lời câu hỏi của bạn\n' +
            '✅ Nhớ ngữ cảnh cuộc trò chuyện\n' +
            '✅ Tự động tóm tắt để duy trì bộ nhớ dài hạn\n\n' +
            'Commands:\n' +
            '/start - Bắt đầu\n' +
            '/new - Tạo cuộc trò chuyện mới\n' +
            '/cleanup - Dọn dẹp lỗi context\n' +
            '/help - Trợ giúp\n\n' +
            'Hãy gửi tin nhắn để bắt đầu trò chuyện! 💬',
        );
    }

    @Help()
    async onHelp(@Ctx() ctx: Context) {
        await ctx.reply(
            '📖 *Hướng dẫn sử dụng*\n\n' +
            '*Commands:*\n' +
            '/start - Khởi động bot và xem giới thiệu\n' +
            '/new - Tạo cuộc trò chuyện mới (xóa lịch sử cũ)\n' +
            '/cleanup - Dọn dẹp tin nhắn lỗi trong context\n' +
            '/help - Hiển thị hướng dẫn này\n\n' +
            '*Cách sử dụng:*\n' +
            '1️⃣ Gửi tin nhắn bất kỳ để trò chuyện\n' +
            '2️⃣ Bot sẽ nhớ ngữ cảnh cuộc trò chuyện\n' +
            '3️⃣ Sau mỗi 20 tin nhắn, bot tự động tóm tắt để giữ bộ nhớ\n' +
            '4️⃣ Dùng /new để bắt đầu chủ đề mới\n' +
            '5️⃣ Dùng /cleanup nếu bot trả lời không đúng ngữ cảnh\n\n' +
            '💡 *Mẹo:* Bot hoạt động tốt nhất với câu hỏi rõ ràng và cụ thể!',
            { parse_mode: 'Markdown' },
        );
    }

    @Command('new')
    async onNewConversation(@Ctx() ctx: Context) {
        const telegramUser = ctx.from;

        if (!telegramUser) {
            await ctx.reply('❌ Cannot identify user');
            return;
        }

        const user = await this.userService.findByTelegramId(telegramUser.id);

        if (!user) {
            await ctx.reply('❌ Lỗi: Không tìm thấy user. Vui lòng dùng /start');
            return;
        }

        // Create new conversation
        await this.conversationService.createConversation(user.id);

        await ctx.reply(
            '✨ Đã tạo cuộc trò chuyện mới!\n\n' +
            'Lịch sử cũ đã được lưu và bạn có thể bắt đầu chủ đề mới. ' +
            'Hãy gửi tin nhắn để tiếp tục! 💬',
        );
    }

    @Command('cleanup')
    async onCleanup(@Ctx() ctx: Context) {
        const telegramUser = ctx.from;

        if (!telegramUser) {
            await ctx.reply('❌ Cannot identify user');
            return;
        }

        const user = await this.userService.findByTelegramId(telegramUser.id);

        if (!user) {
            await ctx.reply('❌ Lỗi: Không tìm thấy user. Vui lòng dùng /start');
            return;
        }

        try {
            // Get current conversation and clean it up
            const conversation = await this.conversationService.getActiveConversation(user.id);

            if (conversation) {
                const cleaned = await this.conversationService.cleanupConsecutiveUserMessages(conversation.id);
                this.logger.log(`🧹 Cleaned up ${cleaned} orphaned user messages for user ${user.id}`);

                await ctx.reply(
                    `🧹 Đã dọn dẹp ${cleaned} tin nhắn lỗi!\n\n` +
                    'Context đã được làm sạch. Bạn có thể tiếp tục trò chuyện bình thường. 💬'
                );
            } else {
                await ctx.reply('✅ Không có gì cần dọn dẹp!');
            }
        } catch (error) {
            this.logger.error('Error during cleanup', error.stack);
            await ctx.reply('❌ Lỗi khi dọn dẹp. Vui lòng dùng /new để tạo conversation mới.');
        }
    }

    @Command('usage')
    async onUsage(@Ctx() ctx: Context) {
        const telegramUser = ctx.from;

        if (!telegramUser) {
            await ctx.reply('❌ Cannot identify user');
            return;
        }

        const user = await this.userService.findByTelegramId(telegramUser.id);

        if (!user) {
            await ctx.reply('❌ Lỗi: Không tìm thấy user. Vui lòng dùng /start');
            return;
        }

        const stats = await this.usageLimitService.getUserUsageStats(user.id);

        if (!stats) {
            await ctx.reply('❌ Không thể lấy thông tin usage');
            return;
        }

        const dailyTokensPercent = ((stats.dailyTokensUsed / stats.dailyTokensLimit) * 100).toFixed(1);
        const monthlyTokensPercent = ((stats.monthlyTokensUsed / stats.monthlyTokensLimit) * 100).toFixed(1);
        const dailyMessagesPercent = ((stats.dailyMessagesCount / stats.dailyMessagesLimit) * 100).toFixed(1);

        await ctx.reply(
            '📊 *Thống kê sử dụng của bạn*\\n\\n' +
            '*Hôm nay:*\\n' +
            `🔹 Tokens: ${stats.dailyTokensUsed.toLocaleString()}/${stats.dailyTokensLimit.toLocaleString()} (${dailyTokensPercent}%)\\n` +
            `🔹 Tin nhắn: ${stats.dailyMessagesCount}/${stats.dailyMessagesLimit} (${dailyMessagesPercent}%)\\n\\n` +
            '*Tháng này:*\\n' +
            `🔹 Tokens: ${stats.monthlyTokensUsed.toLocaleString()}/${stats.monthlyTokensLimit.toLocaleString()} (${monthlyTokensPercent}%)\\n\\n` +
            '💡 *Mẹo:* Tokens reset mỗi ngày và mỗi tháng để bảo vệ credit.',
            { parse_mode: 'Markdown' },
        );
    }

    @On('text')
    async onMessage(@Ctx() ctx: Context & { message: { text: string } }) {
        const telegramUser = ctx.from;
        const messageText = ctx.message.text;

        // Ignore commands
        if (messageText.startsWith('/')) {
            return;
        }

        if (!telegramUser) {
            await ctx.reply('❌ Cannot identify user');
            return;
        }

        try {
            // Show typing indicator
            await ctx.sendChatAction('typing');

            // Get or create user
            const user = await this.userService.findOrCreateUser({
                telegramId: telegramUser.id,
                username: telegramUser.username,
                firstName: telegramUser.first_name,
                lastName: telegramUser.last_name,
                languageCode: telegramUser.language_code,
            });

            // Check usage limits BEFORE processing
            const usageCheck = await this.usageLimitService.canUserSendMessage(user.id);
            if (!usageCheck.allowed) {
                await ctx.reply(usageCheck.reason || '⚠️ Bạn đã đạt giới hạn sử dụng.');
                return;
            }

            // Get or create active conversation
            let conversation = await this.conversationService.getActiveConversation(
                user.id,
            );

            if (!conversation) {
                conversation = await this.conversationService.createConversation(
                    user.id,
                );
            }

            // Save user message
            const userMessageTokens = this.llmService.countTokens(messageText);
            this.logger.debug(`💬 Saving user message (${userMessageTokens} tokens): "${messageText.substring(0, 50)}..."`);

            const userMessage = await this.conversationService.addMessage(conversation.id, {
                role: MessageRole.USER,
                content: messageText,
                tokens: userMessageTokens,
            });
            this.logger.debug(`✅ User message saved with ID: ${userMessage.id}`);

            try {
                // Build context for LLM
                this.logger.debug(`🔨 Building context for conversation ${conversation.id}`);
                const messages = await this.buildContext(conversation.id);
                this.logger.debug(`📝 Context built with ${messages.length} messages`);

                // Generate response
                this.logger.debug(`🤖 Calling LLM API...`);
                const response = await this.llmService.generateResponse(messages);
                this.logger.debug(`✅ LLM response received (${response.tokens} tokens): "${response.content.substring(0, 50)}..."`);

                // Save assistant message
                this.logger.debug(`💾 Saving assistant response...`);
                const assistantMessage = await this.conversationService.addMessage(conversation.id, {
                    role: MessageRole.ASSISTANT,
                    content: response.content,
                    tokens: response.tokens,
                });
                this.logger.debug(`✅ Assistant message saved with ID: ${assistantMessage.id}`);

                // Record token usage AFTER successful API call
                await this.usageLimitService.recordTokenUsage(user.id, response.totalTokens);
                this.logger.debug(`📊 Token usage recorded: ${response.totalTokens} tokens`);

                // Send response to user
                await ctx.reply(response.content);
                this.logger.log(`✅ Message processed successfully for user ${user.id}`);


                // Check if we need to summarize
                const shouldSummarize = await this.conversationService.shouldSummarize(
                    conversation.id,
                );

                if (shouldSummarize) {
                    await this.createSummary(conversation.id);
                }
            } catch (innerError) {
                // Rollback: Delete the user message if processing failed
                this.logger.error(`❌ Failed to process message, rolling back user message ${userMessage.id}`, innerError.stack);
                try {
                    await this.conversationService.deleteMessage(userMessage.id);
                    this.logger.log(`🔄 Rolled back user message ${userMessage.id}`);
                } catch (rollbackError) {
                    this.logger.error(`❌ Failed to rollback message ${userMessage.id}`, rollbackError.stack);
                }
                throw innerError; // Re-throw to be caught by outer catch
            }
        } catch (error) {
            this.logger.error('Error processing message', error.stack);
            await ctx.reply(
                '❌ Xin lỗi, đã có lỗi xảy ra khi xử lý tin nhắn của bạn. ' +
                'Vui lòng thử lại sau.',
            );
        }
    }

    /**
     * Build context for LLM from conversation history and summaries
     */
    private async buildContext(conversationId: string): Promise<ChatMessage[]> {
        const messages: ChatMessage[] = [];

        // Add system message
        messages.push({
            role: 'system',
            content:
                'You are a helpful, friendly, and knowledgeable AI assistant.\n\n' +
                'IMPORTANT INSTRUCTIONS:\n' +
                '1. ALWAYS answer the user\'s CURRENT question directly and accurately\n' +
                '2. Respond in the SAME LANGUAGE as the user\'s current message\n' +
                '3. Be concise but informative\n' +
                '4. You CAN see and remember the ENTIRE conversation history provided to you\n' +
                '5. When asked about previous messages, USE the conversation history to answer\n' +
                '6. Do NOT say "I don\'t remember" or "I can\'t recall" if the information is in the conversation history\n' +
                '7. If you see patterns of incorrect responses in the conversation history, IGNORE them\n' +
                '8. Focus on the LATEST user message and provide the CORRECT answer\n' +
                '9. Do NOT repeat previous responses if they don\'t answer the current question\n' +
                '10. If asked a factual question (math, geography, etc.), provide the FACTUAL answer\n' +
                '11. Be confident and natural - you have access to the conversation context, so use it!\n\n' +
                'Context Awareness:\n' +
                '- If the user introduces themselves (e.g., "I am John"), remember and use their name\n' +
                '- If asked "do you remember who I am?", check the conversation history and answer based on what you see\n' +
                '- If asked about previous topics, reference them from the conversation history\n\n' +
                'Examples:\n' +
                '- "1+1 bằng bao nhiêu?" → Answer: "1+1 = 2"\n' +
                '- "Paris là thủ đô của nước nào?" → Answer: "Paris là thủ đô của Pháp"\n' +
                '- User says "I am Thành", then asks "Do you remember my name?" → Answer: "Có, bạn là Thành!"\n' +
                '- "What is the capital of Vietnam?" → Answer: "The capital of Vietnam is Hanoi"',
        });

        // Get summaries
        const summaries = await this.conversationService.getConversationSummaries(
            conversationId,
        );

        if (summaries.length > 0) {
            const summaryText = summaries
                .map((s, i) => `Summary ${i + 1}: ${s.summary}`)
                .join('\n\n');

            messages.push({
                role: 'system',
                content: `Previous conversation context:\n${summaryText}`,
            });
        }

        // Get recent messages (last 20)
        const recentMessages = await this.conversationService.getRecentMessages(
            conversationId,
            20,
        );

        // Add messages in chronological order, but skip consecutive user messages
        const chronologicalMessages = recentMessages.reverse();

        // Filter out consecutive user messages to maintain proper alternation
        let lastRole: string | null = null;
        let skippedCount = 0;

        for (const msg of chronologicalMessages) {
            // Skip consecutive user messages (keep only the first one)
            if (msg.role === MessageRole.USER && lastRole === MessageRole.USER) {
                skippedCount++;
                this.logger.warn(`⚠️ Skipping consecutive user message: "${msg.content.substring(0, 30)}..."`);
                continue; // Skip this message
            }

            messages.push({
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
            });

            lastRole = msg.role;
        }

        if (skippedCount > 0) {
            this.logger.warn(`⚠️ Skipped ${skippedCount} consecutive user messages. Consider running /cleanup`);
        }

        // Log the final context structure
        const contextSummary = messages.map(m => `${m.role}: ${m.content.substring(0, 30)}...`).join('\n');
        this.logger.debug(`📋 Final context structure:\n${contextSummary}`);

        return messages;
    }

    /**
     * Create summary of conversation
     */
    private async createSummary(conversationId: string): Promise<void> {
        try {
            this.logger.log(`Creating summary for conversation ${conversationId}`);

            // Get all messages since last summary
            const conversation = await this.conversationService.getConversationById(
                conversationId,
            );

            if (!conversation) return;

            const lastSummary = conversation.summaries[conversation.summaries.length - 1];
            const messagesSinceLastSummary = lastSummary
                ? conversation.messages.filter(
                    (m) => m.createdAt > lastSummary.createdAt,
                )
                : conversation.messages;

            if (messagesSinceLastSummary.length === 0) return;

            // Build messages for summarization
            const messagesToSummarize: ChatMessage[] = messagesSinceLastSummary.map(
                (m) => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                }),
            );

            // Generate summary
            const summaryResponse = await this.llmService.generateSummary(
                messagesToSummarize,
            );

            // Save summary
            await this.conversationService.createSummary(
                conversationId,
                summaryResponse.content,
                summaryResponse.tokens,
            );

            // Delete old messages (keep last 10)
            await this.conversationService.deleteOldMessages(conversationId, 10);

            this.logger.log(`Summary created successfully for ${conversationId}`);
        } catch (error) {
            this.logger.error('Error creating summary', error.stack);
        }
    }
}
