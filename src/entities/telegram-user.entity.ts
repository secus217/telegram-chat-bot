import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    Index,
} from 'typeorm';
import { Conversation } from './conversation.entity';

@Entity('telegram_users')
export class TelegramUser {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'bigint', unique: true })
    @Index()
    telegramId: number;

    @Column({ type: 'varchar', nullable: true })
    username: string | null;

    @Column({ type: 'varchar', nullable: true })
    firstName: string | null;

    @Column({ type: 'varchar', nullable: true })
    lastName: string | null;

    @Column({ type: 'varchar', nullable: true })
    languageCode: string | null;

    @Column({ default: true })
    isActive: boolean;

    // Token usage tracking
    @Column({ type: 'int', default: 0 })
    dailyTokensUsed: number;

    @Column({ type: 'int', default: 0 })
    monthlyTokensUsed: number;

    @Column({ type: 'int', default: 0 })
    dailyMessagesCount: number;

    @Column({ type: 'timestamp', nullable: true })
    lastDailyReset: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    lastMonthlyReset: Date | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => Conversation, (conversation) => conversation.user)
    conversations: Conversation[];
}
