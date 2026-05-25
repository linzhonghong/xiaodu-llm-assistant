请实现一个完整可运行的 Node.js 20 + TypeScript 项目，项目名为 xiaodu-llm-assistant。

目标：
实现一个百度 DuerOS / 小度自定义技能 Webhook 服务。用户通过“小度小度，打开豆包”进入技能后，小度将用户语音识别结果发送到本服务。本服务维护多轮上下文，调用 OpenAI-compatible LLM 生成回复，并返回 DuerOS 兼容 JSON，让小度播报。后续支持 Home Assistant 状态查询和设备控制。

重要要求：
这是一个语音助手，不是网页聊天机器人。所有回复必须适合 TTS 播报：
- 不要 Markdown
- 不要标题
- 不要项目符号
- 不要代码块
- 不要表格

技术栈：
- Node.js 20+
- TypeScript
- Fastify
- zod
- pino
- better-sqlite3
- dotenv
- OpenAI-compatible Chat Completions API
- Docker + docker-compose
- pnpm

项目结构：
xiaodu-llm-assistant/
├── package.json
├── tsconfig.json
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── README.md
├── data/.gitkeep
└── src/
    ├── index.ts
    ├── config.ts
    ├── logger.ts
    ├── routes/
    │   ├── health.ts
    │   └── dueros.ts
    ├── dueros/
    │   ├── types.ts
    │   ├── parser.ts
    │   ├── response.ts
    │   └── intents.ts
    ├── memory/
    │   ├── db.ts
    │   └── conversation.ts
    ├── llm/
    │   ├── client.ts
    │   ├── prompt.ts
    │   └── normalizer.ts
    ├── ha/
    │   ├── client.ts
    │   ├── entities.ts
    │   └── intent.ts
    ├── safety/
    │   ├── guard.ts
    │   └── confirm.ts
    └── utils/
        ├── text.ts
        └── errors.ts

环境变量：
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
PUBLIC_BASE_URL=https://xiaodu.example.com
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-xxxx
LLM_MODEL=gpt-4.1-mini
LLM_TIMEOUT_MS=30000
DB_PATH=./data/app.db
MAX_HISTORY_MESSAGES=12
MAX_REPLY_CHARS=120
HA_ENABLED=false
HA_BASE_URL=http://192.168.1.10:8123
HA_TOKEN=your_home_assistant_long_lived_access_token
HA_TIMEOUT_MS=10000
LOG_LEVEL=info

功能要求：
1. 实现 GET /health，返回 {"ok": true}
2. 实现 POST /dueros，接收 DuerOS 小度技能请求
3. 支持 LaunchRequest、IntentRequest、SessionEndedRequest
4. LaunchRequest 回复“我在，想问什么？”，shouldEndSession=false
5. IntentRequest 需要提取 intentName、slots、query、sessionId、userId、deviceId、applicationId
6. query 提取优先级：slots.query.value、slots.text.value、slots.content.value、所有 slot.value 拼接
7. 支持退出意图：退出、不用了、结束、拜拜、再见，返回“好的，再见。”，shouldEndSession=true
8. 支持帮助意图，回复“你可以问我问题，也可以让我查询或控制家里的设备。”
9. 其他 IntentRequest 进入 LLM 自由问答流程
10. SQLite 保存多轮上下文，按 userKey 读取最近 12 条消息
11. userKey = applicationId + ":" + userId + ":" + deviceId
12. LLM 使用 OpenAI-compatible /chat/completions
13. LLM 异常时返回“我这边暂时有点忙，稍后再试一下。”
14. LLM 回复必须清洗 Markdown、标题、列表、代码块、多余换行
15. 回复超过 MAX_REPLY_CHARS 时截断，并追加“要不要我继续说？”
16. 返回 DuerOS 2.0 JSON，包含 outputSpeech、reprompt、shouldEndSession
17. HA_ENABLED=false 时不调用 Home Assistant
18. HA_ENABLED=true 时实现基础 Home Assistant REST API 客户端
19. 初版 HA 控制只用规则识别，不要让 LLM 直接任意调用 HA service
20. 实现简单 entity 映射，例如：
    客厅灯 -> light.living_room
    卧室灯 -> light.bedroom
    客厅空调 -> climate.living_room_ac
21. 支持打开/关闭灯、打开/关闭空调的基础规则
22. 高风险设备关键词：门锁、锁、安防、报警、摄像头、燃气、煤气、插座、电热器、热水器、烤箱。涉及这些设备控制时必须先确认，不要直接执行
23. pending confirmation 60 秒过期
24. Dockerfile 和 docker-compose.yml 必须可用
25. README 必须包含：启动方法、环境变量说明、DuerOS 技能配置说明、curl 测试样例、小度测试话术、Home Assistant 映射说明

DuerOS 响应格式示例：
{
  "version": "2.0",
  "session": {
    "attributes": {}
  },
  "response": {
    "outputSpeech": {
      "type": "PlainText",
      "text": "我在，想问什么？"
    },
    "reprompt": {
      "outputSpeech": {
        "type": "PlainText",
        "text": "还需要我做什么？"
      }
    },
    "shouldEndSession": false
  }
}

SQLite 表：
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_key TEXT NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_confirmations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_key TEXT NOT NULL,
  session_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

验收标准：
1. pnpm install 成功
2. pnpm build 成功
3. pnpm start 能启动
4. GET /health 返回 ok
5. POST /dueros LaunchRequest 返回“我在，想问什么？”
6. POST /dueros AskLLMIntent 能调用 LLM 并返回 DuerOS JSON
7. 连续两轮请求能读取历史上下文
8. 退出意图 shouldEndSession=true
9. LLM 异常时返回友好语音，不崩溃
10. HA_ENABLED=false 时不会调用 HA
11. Docker Compose 能启动
12. 回复不包含 Markdown、代码块、标题、列表

请直接生成完整项目文件，不要只给伪代码。
