import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import databaseConfig from './config/database.config';
import telegramConfig from './config/telegram.config';
import llmConfig from './config/llm.config';
import { BotModule } from './modules/bot.module';
import { TelegramUser } from './entities/telegram-user.entity';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { ConversationSummary } from './entities/conversation-summary.entity';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [databaseConfig, telegramConfig, llmConfig],
        }),
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                type: 'postgres',
                host: configService.get('database.host'),
                port: configService.get('database.port'),
                username: configService.get('database.username'),
                password: configService.get('database.password'),
                database: configService.get('database.database'),
                entities: [TelegramUser, Conversation, Message, ConversationSummary],
                synchronize: configService.get('database.synchronize'),
                logging: configService.get('database.logging'),
            }),
            inject: [ConfigService],
        }),
        BotModule,
    ],
})
export class AppModule { }
