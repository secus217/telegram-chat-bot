import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    Index,
} from 'typeorm';
import { TelegramUser } from './telegram-user.entity';
import { Message } from './message.entity';
import { ConversationSummary } from './conversation-summary.entity';

@Entity('conversations')
export class Conversation {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    @Index()
    userId: string;

    @ManyToOne(() => TelegramUser, (user) => user.conversations, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'userId' })
    user: TelegramUser;

    @Column({ default: true })
    isActive: boolean;

    @Column({ type: 'int', default: 0 })
    messageCount: number;

    @Column({ type: 'int', default: 0 })
    totalTokens: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => Message, (message) => message.conversation)
    messages: Message[];

    @OneToMany(() => ConversationSummary, (summary) => summary.conversation)
    summaries: ConversationSummary[];
}
