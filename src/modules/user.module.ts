import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramUser } from '../entities/telegram-user.entity';
import { UserService } from '../services/user.service';
import { UsageLimitService } from '../services/usage-limit.service';

@Module({
    imports: [TypeOrmModule.forFeature([TelegramUser])],
    providers: [UserService, UsageLimitService],
    exports: [UserService, UsageLimitService],
})
export class UserModule { }
