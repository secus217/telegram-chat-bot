import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BotUpdate } from '../bot/bot.update';
import { UserModule } from './user.module';
import { ConversationModule } from './conversation.module';
import { LlmModule } from './llm.module';

@Module({
    imports: [
        TelegrafModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => {
                const token = configService.get<string>('telegram.botToken');
                if (!token) {
                    throw new Error('TELEGRAM_BOT_TOKEN is not defined in environment variables');
                }
                return { token };
            },
            inject: [ConfigService],
        }),
        UserModule,
        ConversationModule,
        LlmModule,
    ],
    providers: [BotUpdate],
})
export class BotModule { }
