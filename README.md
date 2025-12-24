# Telegram Chatbot with LLM Integration

Một Telegram chatbot thông minh được xây dựng với NestJS, tích hợp LLM API (DeepSeek/OpenAI/Grok) với khả năng nhớ context và tự động tóm tắt cuộc trò chuyện.

## ✨ Tính năng

- 🤖 **Chatbot thông minh**: Tích hợp LLM API để trả lời câu hỏi
- 💾 **Nhớ context**: Lưu trữ và sử dụng lịch sử cuộc trò chuyện
- 📝 **Auto-summarization**: Tự động tóm tắt sau mỗi 20 tin nhắn
- 👥 **Multi-user support**: Hỗ trợ nhiều users đồng thời
- 🔄 **Conversation management**: Quản lý nhiều cuộc hội thoại
- 🎯 **Token management**: Giới hạn context trong 4000 tokens
- 🔁 **Retry logic**: Tự động retry khi LLM API call thất bại

## 🏗️ Tech Stack

- **Backend**: NestJS với TypeScript
- **Database**: PostgreSQL với TypeORM
- **Telegram**: telegraf và nestjs-telegraf
- **LLM**: OpenAI-compatible API (DeepSeek, OpenAI, Grok)
- **Token Counting**: tiktoken

## 📊 Database Schema

### Tables

1. **telegram_users**: Lưu thông tin user từ Telegram
   - id (UUID)
   - telegramId (bigint, unique)
   - username, firstName, lastName
   - languageCode
   - isActive
   - timestamps

2. **conversations**: Lưu các cuộc hội thoại
   - id (UUID)
   - userId (FK to telegram_users)
   - isActive
   - messageCount
   - totalTokens
   - timestamps

3. **messages**: Lưu chi tiết từng tin nhắn
   - id (UUID)
   - conversationId (FK to conversations)
   - role (user/assistant/system)
   - content (text)
   - tokens (int)
   - metadata (jsonb)
   - createdAt

4. **conversation_summaries**: Lưu tóm tắt conversation
   - id (UUID)
   - conversationId (FK to conversations)
   - summary (text)
   - messageCountAtSummary (int)
   - tokens (int)
   - createdAt

## 🚀 Cài đặt

### 1. Clone repository

```bash
git clone <your-repo-url>
cd telegram-chat-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Setup PostgreSQL

Tạo database PostgreSQL:

```sql
CREATE DATABASE telegram_chatbot;
```

### 4. Configure environment

Copy file `.env.example` thành `.env` và điền thông tin:

```bash
cp .env.example .env
```

Cập nhật các biến trong `.env`:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=telegram_chatbot

# Telegram Bot Token (lấy từ @BotFather)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# LLM API Configuration
LLM_API_KEY=your_api_key
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat

# Context Management
MAX_CONTEXT_TOKENS=4000
MESSAGES_BEFORE_SUMMARY=20
```

### 5. Tạo Telegram Bot

1. Mở Telegram và tìm [@BotFather](https://t.me/botfather)
2. Gửi `/newbot` và làm theo hướng dẫn
3. Copy Bot Token và paste vào `.env`

### 6. Lấy LLM API Key

**DeepSeek** (Recommended - rẻ nhất):
- Đăng ký tại: https://platform.deepseek.com
- Tạo API key
- Base URL: `https://api.deepseek.com/v1`
- Model: `deepseek-chat`

**OpenAI**:
- Đăng ký tại: https://platform.openai.com
- Tạo API key
- Base URL: `https://api.openai.com/v1`
- Model: `gpt-4-turbo-preview` hoặc `gpt-3.5-turbo`

**Grok**:
- Đăng ký tại: https://x.ai
- Tạo API key
- Base URL: `https://api.x.ai/v1`
- Model: `grok-beta`

### 7. Run migrations (nếu có)

```bash
npm run migration:run
```

Hoặc để TypeORM tự động tạo tables (development):
- Set `synchronize: true` trong database config (đã mặc định cho development)

### 8. Start application

Development mode:
```bash
npm run start:dev
```

Production mode:
```bash
npm run build
npm run start:prod
```

## 📱 Sử dụng

### Commands

- `/start` - Khởi động bot và xem giới thiệu
- `/new` - Tạo cuộc trò chuyện mới (reset context)
- `/help` - Hiển thị hướng dẫn

### Workflow

1. User gửi `/start` để khởi động bot
2. User gửi tin nhắn bất kỳ
3. Bot lưu tin nhắn vào database
4. Bot build context từ:
   - System prompt
   - Summaries cũ (nếu có)
   - 20 tin nhắn gần nhất
5. Bot gọi LLM API để generate response
6. Bot lưu response và gửi cho user
7. Sau mỗi 20 tin nhắn, bot tự động:
   - Tạo summary của conversation
   - Xóa messages cũ (giữ lại 10 tin nhắn gần nhất)

## 🏗️ Cấu trúc dự án

```
telegram-chat-bot/
├── src/
│   ├── bot/
│   │   └── bot.update.ts          # Telegram bot handlers
│   ├── config/
│   │   ├── database.config.ts     # Database configuration
│   │   ├── telegram.config.ts     # Telegram configuration
│   │   ├── llm.config.ts          # LLM configuration
│   │   └── typeorm.config.ts      # TypeORM CLI configuration
│   ├── entities/
│   │   ├── telegram-user.entity.ts
│   │   ├── conversation.entity.ts
│   │   ├── message.entity.ts
│   │   └── conversation-summary.entity.ts
│   ├── modules/
│   │   ├── user.module.ts
│   │   ├── conversation.module.ts
│   │   ├── llm.module.ts
│   │   └── bot.module.ts
│   ├── services/
│   │   ├── user.service.ts        # User management
│   │   ├── conversation.service.ts # Conversation management
│   │   └── llm.service.ts         # LLM API integration
│   ├── app.module.ts              # Root module
│   └── main.ts                    # Entry point
├── .env.example                   # Environment template
├── .gitignore
├── nest-cli.json
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 Configuration

### Token Management

- `MAX_CONTEXT_TOKENS`: Giới hạn tokens cho context (default: 4000)
- `MESSAGES_BEFORE_SUMMARY`: Số tin nhắn trước khi tạo summary (default: 20)

### Retry Logic

- `MAX_RETRIES`: Số lần retry khi LLM API fail (default: 3)
- `RETRY_DELAY_MS`: Delay giữa các lần retry (default: 1000ms)

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📝 Scripts

```bash
npm run build          # Build production
npm run start          # Start production
npm run start:dev      # Start development with watch
npm run start:debug    # Start with debug mode
npm run lint           # Lint code
npm run format         # Format code with Prettier
```

## 🔍 Troubleshooting

### Bot không nhận tin nhắn

1. Kiểm tra `TELEGRAM_BOT_TOKEN` trong `.env`
2. Kiểm tra bot đã được start chưa (`/start`)
3. Xem logs để debug

### LLM API errors

1. Kiểm tra `LLM_API_KEY` hợp lệ
2. Kiểm tra `LLM_BASE_URL` đúng
3. Kiểm tra balance API key
4. Xem logs để xem error message cụ thể

### Database connection errors

1. Kiểm tra PostgreSQL đang chạy
2. Kiểm tra credentials trong `.env`
3. Kiểm tra database đã được tạo

## 📚 API Documentation

### LlmService

```typescript
// Generate response
const response = await llmService.generateResponse(messages);

// Generate summary
const summary = await llmService.generateSummary(messages);

// Count tokens
const tokens = llmService.countTokens(text);
```

### ConversationService

```typescript
// Get active conversation
const conversation = await conversationService.getActiveConversation(userId);

// Create new conversation
const newConv = await conversationService.createConversation(userId);

// Add message
await conversationService.addMessage(conversationId, messageDto);

// Check if should summarize
const shouldSummarize = await conversationService.shouldSummarize(conversationId);
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT

## 👨‍💻 Author

Your Name

## 🙏 Acknowledgments

- NestJS team
- Telegraf team
- OpenAI/DeepSeek/Grok teams
#   t e l e g r a m - c h a t - b o t  
 