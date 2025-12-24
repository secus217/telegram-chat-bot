import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { Message, MessageRole } from '../entities/message.entity';
import { ConversationSummary } from '../entities/conversation-summary.entity';
import { ConfigService } from '@nestjs/config';

export interface MessageDto {
    role: MessageRole;
    content: string;
    tokens?: number;
}

@Injectable()
export class ConversationService {
    private readonly logger = new Logger(ConversationService.name);
    private readonly messagesBeforeSummary: number;

    constructor(
        @InjectRepository(Conversation)
        private readonly conversationRepository: Repository<Conversation>,
        @InjectRepository(Message)
        private readonly messageRepository: Repository<Message>,
        @InjectRepository(ConversationSummary)
        private readonly summaryRepository: Repository<ConversationSummary>,
        private readonly configService: ConfigService,
    ) {
        this.messagesBeforeSummary = this.configService.get<number>(
            'llm.messagesBeforeSummary',
        ) ?? 20;
    }

    async getActiveConversation(userId: string): Promise<Conversation | null> {
        return this.conversationRepository.findOne({
            where: { userId, isActive: true },
            relations: ['messages', 'summaries'],
            order: { createdAt: 'DESC' },
        });
    }

    async createConversation(userId: string): Promise<Conversation> {
        // Deactivate all previous conversations
        await this.conversationRepository.update(
            { userId, isActive: true },
            { isActive: false },
        );

        const conversation = this.conversationRepository.create({
            userId,
            isActive: true,
            messageCount: 0,
            totalTokens: 0,
        });

        await this.conversationRepository.save(conversation);
        this.logger.log(`Created new conversation for user ${userId}`);
        return conversation;
    }

    async addMessage(
        conversationId: string,
        messageDto: MessageDto,
    ): Promise<Message> {
        const message = this.messageRepository.create({
            conversationId,
            role: messageDto.role,
            content: messageDto.content,
            tokens: messageDto.tokens || 0,
        });

        await this.messageRepository.save(message);

        // Update conversation stats
        await this.conversationRepository.increment(
            { id: conversationId },
            'messageCount',
            1,
        );
        await this.conversationRepository.increment(
            { id: conversationId },
            'totalTokens',
            message.tokens,
        );

        return message;
    }

    async getConversationMessages(
        conversationId: string,
        limit?: number,
    ): Promise<Message[]> {
        const query = this.messageRepository
            .createQueryBuilder('message')
            .where('message.conversationId = :conversationId', { conversationId })
            .orderBy('message.createdAt', 'ASC');

        if (limit) {
            query.take(limit);
        }

        return query.getMany();
    }

    async getRecentMessages(
        conversationId: string,
        count: number,
    ): Promise<Message[]> {
        return this.messageRepository.find({
            where: { conversationId },
            order: { createdAt: 'DESC' },
            take: count,
        });
    }

    async shouldSummarize(conversationId: string): Promise<boolean> {
        const conversation = await this.conversationRepository.findOne({
            where: { id: conversationId },
        });

        if (!conversation) return false;

        // Get the last summary
        const lastSummary = await this.summaryRepository.findOne({
            where: { conversationId },
            order: { createdAt: 'DESC' },
        });

        const messagesSinceLastSummary = lastSummary
            ? conversation.messageCount - lastSummary.messageCountAtSummary
            : conversation.messageCount;

        return messagesSinceLastSummary >= this.messagesBeforeSummary;
    }

    async createSummary(
        conversationId: string,
        summary: string,
        tokens: number,
    ): Promise<ConversationSummary> {
        const conversation = await this.conversationRepository.findOne({
            where: { id: conversationId },
        });

        if (!conversation) {
            throw new Error(`Conversation ${conversationId} not found`);
        }

        const conversationSummary = this.summaryRepository.create({
            conversationId,
            summary,
            messageCountAtSummary: conversation.messageCount,
            tokens,
        });

        await this.summaryRepository.save(conversationSummary);
        this.logger.log(
            `Created summary for conversation ${conversationId} at ${conversation.messageCount} messages`,
        );

        return conversationSummary;
    }

    async getConversationSummaries(
        conversationId: string,
    ): Promise<ConversationSummary[]> {
        return this.summaryRepository.find({
            where: { conversationId },
            order: { createdAt: 'ASC' },
        });
    }

    async deleteOldMessages(
        conversationId: string,
        keepCount: number,
    ): Promise<void> {
        const messages = await this.messageRepository.find({
            where: { conversationId },
            order: { createdAt: 'DESC' },
        });

        if (messages.length > keepCount) {
            const messagesToDelete = messages.slice(keepCount);
            const idsToDelete = messagesToDelete.map((m) => m.id);
            await this.messageRepository.delete(idsToDelete);
            this.logger.log(
                `Deleted ${idsToDelete.length} old messages from conversation ${conversationId}`,
            );
        }
    }

    async getConversationById(id: string): Promise<Conversation | null> {
        return this.conversationRepository.findOne({
            where: { id },
            relations: ['messages', 'summaries'],
        });
    }

    async deleteMessage(messageId: string): Promise<void> {
        await this.messageRepository.delete(messageId);
        this.logger.log(`Deleted message ${messageId}`);
    }

    async cleanupConsecutiveUserMessages(conversationId: string): Promise<number> {
        // Get all messages in chronological order
        const messages = await this.messageRepository.find({
            where: { conversationId },
            order: { createdAt: 'ASC' },
        });

        this.logger.debug(`🔍 Analyzing ${messages.length} messages for cleanup...`);

        const messagesToDelete: string[] = [];
        let lastRole: string | null = null;

        // Find consecutive user messages (keep first, delete rest until we see assistant)
        for (const msg of messages) {
            this.logger.debug(`  Message: ${msg.role} - "${msg.content.substring(0, 30)}..." (lastRole: ${lastRole})`);

            if (msg.role === MessageRole.USER && lastRole === MessageRole.USER) {
                // This is a consecutive user message - mark for deletion
                messagesToDelete.push(msg.id);
                this.logger.debug(`    ❌ Marked for deletion (consecutive user message)`);
            }

            // Always update lastRole
            lastRole = msg.role;
        }

        this.logger.log(`📋 Found ${messagesToDelete.length} messages to delete`);

        // Delete the orphaned messages
        if (messagesToDelete.length > 0) {
            await this.messageRepository.delete(messagesToDelete);
            this.logger.log(
                `Cleaned up ${messagesToDelete.length} consecutive user messages from conversation ${conversationId}`,
            );
        } else {
            this.logger.log(`✅ No consecutive user messages found in conversation ${conversationId}`);
        }

        return messagesToDelete.length;
    }
}
