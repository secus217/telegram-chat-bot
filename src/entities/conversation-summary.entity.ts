import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Conversation } from './conversation.entity';

@Entity('conversation_summaries')
export class ConversationSummary {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    @Index()
    conversationId: string;

    @ManyToOne(() => Conversation, (conversation) => conversation.summaries, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'conversationId' })
    conversation: Conversation;

    @Column({ type: 'text' })
    summary: string;

    @Column({ type: 'int' })
    messageCountAtSummary: number;

    @Column({ type: 'int', default: 0 })
    tokens: number;

    @CreateDateColumn()
    createdAt: Date;
}
