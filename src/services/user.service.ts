import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramUser } from '../entities/telegram-user.entity';

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);

    constructor(
        @InjectRepository(TelegramUser)
        private readonly userRepository: Repository<TelegramUser>,
    ) { }

    async findOrCreateUser(telegramUserData: {
        telegramId: number;
        username?: string;
        firstName?: string;
        lastName?: string;
        languageCode?: string;
    }): Promise<TelegramUser> {
        let user = await this.userRepository.findOne({
            where: { telegramId: telegramUserData.telegramId },
        });

        if (!user) {
            user = this.userRepository.create(telegramUserData);
            await this.userRepository.save(user);
            this.logger.log(
                `Created new user: ${telegramUserData.telegramId} (${telegramUserData.username})`,
            );
        } else {
            // Update user info if changed
            let hasChanges = false;
            if (user.username !== telegramUserData.username) {
                user.username = telegramUserData.username ?? null;
                hasChanges = true;
            }
            if (user.firstName !== telegramUserData.firstName) {
                user.firstName = telegramUserData.firstName ?? null;
                hasChanges = true;
            }
            if (user.lastName !== telegramUserData.lastName) {
                user.lastName = telegramUserData.lastName ?? null;
                hasChanges = true;
            }
            if (user.languageCode !== telegramUserData.languageCode) {
                user.languageCode = telegramUserData.languageCode ?? null;
                hasChanges = true;
            }

            if (hasChanges) {
                await this.userRepository.save(user);
                this.logger.log(`Updated user info: ${telegramUserData.telegramId}`);
            }
        }

        return user;
    }

    async findByTelegramId(telegramId: number): Promise<TelegramUser | null> {
        return this.userRepository.findOne({ where: { telegramId } });
    }

    async setUserActive(userId: string, isActive: boolean): Promise<void> {
        await this.userRepository.update(userId, { isActive });
    }
}
