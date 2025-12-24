import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { ConversationSummary } from '../entities/conversation-summary.entity';
import { ConversationService } from '../services/conversation.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([Conversation, Message, ConversationSummary]),
    ],
    providers: [ConversationService],
    exports: [ConversationService],
})
export class ConversationModule { }
