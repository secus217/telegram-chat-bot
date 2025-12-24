import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramUser } from '../entities/telegram-user.entity';
import { ConfigService } from '@nestjs/config';

export interface UsageCheckResult {
    allowed: boolean;
    reason?: string;
    dailyTokensRemaining?: number;
    monthlyTokensRemaining?: number;
    dailyMessagesRemaining?: number;
}

@Injectable()
export class UsageLimitService {
    private readonly logger = new Logger(UsageLimitService.name);
    private readonly maxTokensPerUserDaily: number;
    private readonly maxTokensPerUserMonthly: number;
    private readonly maxMessagesPerUserDaily: number;

    constructor(
        @InjectRepository(TelegramUser)
        private readonly userRepository: Repository<TelegramUser>,
        private readonly configService: ConfigService,
    ) {
        this.maxTokensPerUserDaily = this.configService.get<number>(
            'llm.maxTokensPerUserDaily',
        ) ?? 50000;
        this.maxTokensPerUserMonthly = this.configService.get<number>(
            'llm.maxTokensPerUserMonthly',
        ) ?? 500000;
        this.maxMessagesPerUserDaily = this.configService.get<number>(
            'llm.maxMessagesPerUserDaily',
        ) ?? 100;
    }

    /**
     * Check if user can send a message (before processing)
     */
    async canUserSendMessage(userId: string): Promise<UsageCheckResult> {
        const user = await this.userRepository.findOne({ where: { id: userId } });

        if (!user) {
            return { allowed: false, reason: 'User not found' };
        }

        // Reset counters if needed
        await this.resetCountersIfNeeded(user);

        // Check daily message limit
        if (user.dailyMessagesCount >= this.maxMessagesPerUserDaily) {
            return {
                allowed: false,
                reason: `⚠️ Bạn đã đạt giới hạn ${this.maxMessagesPerUserDaily} tin nhắn/ngày. Vui lòng thử lại vào ngày mai.`,
                dailyMessagesRemaining: 0,
            };
        }

        // Check daily token limit
        if (user.dailyTokensUsed >= this.maxTokensPerUserDaily) {
            return {
                allowed: false,
                reason: `⚠️ Bạn đã sử dụng hết ${this.maxTokensPerUserDaily} tokens/ngày. Vui lòng thử lại vào ngày mai.`,
                dailyTokensRemaining: 0,
            };
        }

        // Check monthly token limit
        if (user.monthlyTokensUsed >= this.maxTokensPerUserMonthly) {
            return {
                allowed: false,
                reason: `⚠️ Bạn đã sử dụng hết ${this.maxTokensPerUserMonthly} tokens/tháng. Vui lòng thử lại vào tháng sau.`,
                monthlyTokensRemaining: 0,
            };
        }

        return {
            allowed: true,
            dailyTokensRemaining: this.maxTokensPerUserDaily - user.dailyTokensUsed,
            monthlyTokensRemaining: this.maxTokensPerUserMonthly - user.monthlyTokensUsed,
            dailyMessagesRemaining: this.maxMessagesPerUserDaily - user.dailyMessagesCount,
        };
    }

    /**
     * Record token usage after successful API call
     */
    async recordTokenUsage(userId: string, tokensUsed: number): Promise<void> {
        const user = await this.userRepository.findOne({ where: { id: userId } });

        if (!user) {
            this.logger.warn(`User ${userId} not found for token recording`);
            return;
        }

        // Reset counters if needed
        await this.resetCountersIfNeeded(user);

        // Update usage
        user.dailyTokensUsed += tokensUsed;
        user.monthlyTokensUsed += tokensUsed;
        user.dailyMessagesCount += 1;

        await this.userRepository.save(user);

        this.logger.log(
            `User ${userId}: Used ${tokensUsed} tokens. Daily: ${user.dailyTokensUsed}/${this.maxTokensPerUserDaily}, Monthly: ${user.monthlyTokensUsed}/${this.maxTokensPerUserMonthly}, Messages: ${user.dailyMessagesCount}/${this.maxMessagesPerUserDaily}`,
        );
    }

    /**
     * Get user usage stats
     */
    async getUserUsageStats(userId: string): Promise<{
        dailyTokensUsed: number;
        dailyTokensLimit: number;
        monthlyTokensUsed: number;
        monthlyTokensLimit: number;
        dailyMessagesCount: number;
        dailyMessagesLimit: number;
    } | null> {
        const user = await this.userRepository.findOne({ where: { id: userId } });

        if (!user) {
            return null;
        }

        await this.resetCountersIfNeeded(user);

        return {
            dailyTokensUsed: user.dailyTokensUsed,
            dailyTokensLimit: this.maxTokensPerUserDaily,
            monthlyTokensUsed: user.monthlyTokensUsed,
            monthlyTokensLimit: this.maxTokensPerUserMonthly,
            dailyMessagesCount: user.dailyMessagesCount,
            dailyMessagesLimit: this.maxMessagesPerUserDaily,
        };
    }

    /**
     * Reset daily/monthly counters if time has passed
     */
    private async resetCountersIfNeeded(user: TelegramUser): Promise<void> {
        const now = new Date();
        let needsSave = false;

        // Check daily reset
        if (!user.lastDailyReset || this.shouldResetDaily(user.lastDailyReset, now)) {
            user.dailyTokensUsed = 0;
            user.dailyMessagesCount = 0;
            user.lastDailyReset = now;
            needsSave = true;
            this.logger.log(`Reset daily counters for user ${user.id}`);
        }

        // Check monthly reset
        if (!user.lastMonthlyReset || this.shouldResetMonthly(user.lastMonthlyReset, now)) {
            user.monthlyTokensUsed = 0;
            user.lastMonthlyReset = now;
            needsSave = true;
            this.logger.log(`Reset monthly counters for user ${user.id}`);
        }

        if (needsSave) {
            await this.userRepository.save(user);
        }
    }

    /**
     * Check if daily reset is needed (different day)
     */
    private shouldResetDaily(lastReset: Date, now: Date): boolean {
        const lastResetDate = new Date(lastReset);
        return (
            lastResetDate.getDate() !== now.getDate() ||
            lastResetDate.getMonth() !== now.getMonth() ||
            lastResetDate.getFullYear() !== now.getFullYear()
        );
    }

    /**
     * Check if monthly reset is needed (different month)
     */
    private shouldResetMonthly(lastReset: Date, now: Date): boolean {
        const lastResetDate = new Date(lastReset);
        return (
            lastResetDate.getMonth() !== now.getMonth() ||
            lastResetDate.getFullYear() !== now.getFullYear()
        );
    }

    /**
     * Manually reset user limits (admin function)
     */
    async resetUserLimits(userId: string): Promise<void> {
        const user = await this.userRepository.findOne({ where: { id: userId } });

        if (!user) {
            throw new Error(`User ${userId} not found`);
        }

        user.dailyTokensUsed = 0;
        user.monthlyTokensUsed = 0;
        user.dailyMessagesCount = 0;
        user.lastDailyReset = new Date();
        user.lastMonthlyReset = new Date();

        await this.userRepository.save(user);
        this.logger.log(`Manually reset all limits for user ${userId}`);
    }
}
