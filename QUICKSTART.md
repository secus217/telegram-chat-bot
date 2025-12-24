# 🚀 Quick Start Guide

## ✅ Installation Complete!

Dependencies đã được cài đặt thành công. Bây giờ bạn cần:

## 📝 Bước tiếp theo (5 phút)

### 1. Setup PostgreSQL Database

Tạo database:
```bash
psql -U postgres
CREATE DATABASE telegram_chatbot;
\q
```

### 2. Configure Environment Variables

File `.env.example` đã được tạo sẵn. Bạn cần:

1. Copy `.env.example` thành `.env`:
   ```bash
   copy .env.example .env
   ```

2. Mở `.env` và điền 3 thông tin quan trọng:

   ```env
   # 1. Database password
   DB_PASSWORD=your_postgres_password
   
   # 2. Telegram Bot Token (lấy từ @BotFather)
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   
   # 3. LLM API Key (DeepSeek/OpenAI/Grok)
   LLM_API_KEY=your_api_key_here
   ```

### 3. Lấy Telegram Bot Token

1. Mở Telegram, tìm `@BotFather`
2. Gửi `/newbot`
3. Đặt tên bot (ví dụ: "My AI Bot")
4. Đặt username (phải kết thúc bằng `bot`, ví dụ: `my_ai_bot`)
5. Copy token và paste vào `.env`

### 4. Lấy LLM API Key

**DeepSeek (Recommended - Rẻ nhất):**
- Đăng ký: https://platform.deepseek.com
- Tạo API key
- Paste vào `.env`

**OpenAI:**
- Đăng ký: https://platform.openai.com
- Tạo API key
- Thay đổi trong `.env`:
  ```env
  LLM_BASE_URL=https://api.openai.com/v1
  LLM_MODEL=gpt-3.5-turbo
  ```

### 5. Start Application

```bash
npm run start:dev
```

Bạn sẽ thấy:
```
🚀 Application is running on: http://localhost:3000
🤖 Telegram bot is active and listening for messages
```

### 6. Test Bot

1. Mở Telegram
2. Tìm bot của bạn
3. Gửi `/start`
4. Gửi tin nhắn bất kỳ!

## 📚 Documentation

- **README.md** - Tổng quan dự án
- **SETUP.md** - Hướng dẫn setup chi tiết
- **WORKFLOW.md** - Workflow và architecture

## 🆘 Troubleshooting

### Lỗi database connection
```bash
# Check PostgreSQL đang chạy
services.msc  # Tìm "postgresql"
```

### Lỗi bot token
- Verify token từ @BotFather
- Check `.env` file

### Lỗi LLM API
- Verify API key
- Check balance/quota

## 💡 Tips

- Dùng DeepSeek để tiết kiệm chi phí (~$0.14/1M tokens)
- Set `MESSAGES_BEFORE_SUMMARY=20` để tự động tóm tắt
- Check logs để debug issues

---

**Chúc bạn thành công! 🎉**

Nếu cần hỗ trợ, xem file SETUP.md để biết thêm chi tiết.
