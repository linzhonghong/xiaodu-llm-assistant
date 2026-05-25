# xiaodu-llm-assistant

一个 Node.js 20 + TypeScript 的百度 DuerOS / 小度自定义技能 Webhook 服务。用户通过“小度小度，打开豆包”进入技能后，小度把识别到的请求发送到本服务，本服务维护 SQLite 多轮上下文，调用 OpenAI-compatible Chat Completions API，并返回 DuerOS 2.0 JSON 让小度播报。

## 启动方法

本地启动：

```bash
pnpm install
cp .env.example .env
pnpm build
pnpm start
```

开发模式：

```bash
pnpm dev
```

Docker Compose 启动：

```bash
cp xiaodu.env.example xiaodu.env
docker compose up --build
```

服务默认监听 `http://localhost:3000`，健康检查地址是 `GET /health`。

## 群晖 DSM Container Manager 部署

DSM 的 Container Manager 不一定有 `--env-file` 参数入口，所以本项目把运行环境文件写在 `docker-compose.yml` 的 `env_file` 里。部署时按下面做：

1. 在服务器目录里放入项目文件。
2. 复制 `xiaodu.env.example` 为 `xiaodu.env`。
3. 编辑 `xiaodu.env`，填入真实的 `PUBLIC_BASE_URL`、`LLM_API_KEY`，以及需要时的 Home Assistant 配置。
4. 在 DSM Container Manager 里新建 Project，选择项目目录和 `docker-compose.yml`。
5. 启动 Project。

`xiaodu.env` 不要提交到 Git，也不要复制进镜像。`docker-compose.yml` 会在容器启动时通过 `env_file: ./xiaodu.env` 注入这些变量。容器内数据库路径固定为 `/app/data/app.db`，数据保存在 Docker named volume `xiaodu-data` 中，避免 DSM 共享目录权限导致 SQLite 无法打开数据库。

如果从旧版本升级，DSM 里需要重新构建并重建 Project/容器，让新的 `volumes: xiaodu-data:/app/data` 生效。只点 restart 旧容器不会改变挂载方式。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | HTTP 服务端口 |
| `HOST` | `0.0.0.0` | HTTP 监听地址 |
| `NODE_ENV` | `production` | 运行环境 |
| `PUBLIC_BASE_URL` | `https://xiaodu.example.com` | 对外公开访问地址，用于配置技能 |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible API 根地址 |
| `LLM_API_KEY` | `sk-xxxx` | LLM API Key |
| `LLM_MODEL` | `gpt-4.1-mini` | Chat Completions 模型名 |
| `LLM_TIMEOUT_MS` | `30000` | LLM 请求超时时间 |
| `DB_PATH` | `./data/app.db` | SQLite 数据库路径 |
| `MAX_HISTORY_MESSAGES` | `12` | 每个用户读取的最近上下文条数 |
| `MAX_REPLY_CHARS` | `120` | TTS 回复最大字符数，超过会截断并追加继续询问 |
| `DUEROS_VERIFY_SIGNATURE` | `true` | 是否校验 DuerOS 请求签名；公网接入必须保持为 `true` |
| `HA_ENABLED` | `false` | 是否启用 Home Assistant |
| `HA_BASE_URL` | `http://192.168.1.10:8123` | Home Assistant 地址 |
| `HA_TOKEN` | `your_home_assistant_long_lived_access_token` | Home Assistant 长期访问令牌 |
| `HA_TIMEOUT_MS` | `10000` | Home Assistant 请求超时时间 |
| `LOG_LEVEL` | `info` | pino 日志级别 |

## DuerOS 技能配置说明

在百度 DuerOS 技能控制台创建自定义技能，把 HTTPS Webhook 地址配置为：

```text
https://你的域名/dueros
```

建议配置一个自由文本意图，例如 `AskLLMIntent`，并添加 `query`、`text` 或 `content` 槽位承接用户原始问题。本服务提取 query 的优先级是 `slots.query.value`、`slots.text.value`、`slots.content.value`、所有 `slot.value` 拼接。

服务支持 `LaunchRequest`、`IntentRequest`、`SessionEndedRequest`。`LaunchRequest` 会回复“我在，想问什么？”，退出话术“退出、不用了、结束、拜拜、再见”会回复“好的，再见。”并结束会话。

公网接入时保持 `DUEROS_VERIFY_SIGNATURE=true`。服务会校验 DuerOS 请求头中的 `signaturecerturl` 和 `signature`：证书 URL 必须使用 `https`，域名必须是 `duer.bdstatic.com`，路径必须以 `/saiya/flow/` 开始，端口必须是 443，证书 SAN 必须包含 `dueros-api.baidu.com`，并使用证书公钥按 RSA-SHA1 校验原始请求体签名。请求体里的 `request.timestamp` 与服务当前时间相差必须小于 180 秒。验签失败会返回 HTTP 401。

下面的 curl 样例是本地功能测试用的 unsigned 请求。若要直接用 curl 调试 `/dueros`，请只在本地临时设置 `DUEROS_VERIFY_SIGNATURE=false`；公网反代和真机验证不要关闭验签。

## curl 测试样例

健康检查：

```bash
curl http://localhost:3000/health
```

LaunchRequest：

```bash
curl -s http://localhost:3000/dueros \
  -H 'content-type: application/json' \
  -d '{
    "version": "2.0",
    "session": {
      "sessionId": "session-1",
      "application": { "applicationId": "app-1" },
      "user": { "userId": "user-1" }
    },
    "context": {
      "System": {
        "device": { "deviceId": "device-1" }
      }
    },
    "request": { "type": "LaunchRequest" }
  }'
```

AskLLMIntent：

```bash
curl -s http://localhost:3000/dueros \
  -H 'content-type: application/json' \
  -d '{
    "version": "2.0",
    "session": {
      "sessionId": "session-1",
      "application": { "applicationId": "app-1" },
      "user": { "userId": "user-1" }
    },
    "context": {
      "System": {
        "device": { "deviceId": "device-1" }
      }
    },
    "request": {
      "type": "IntentRequest",
      "intent": {
        "name": "AskLLMIntent",
        "slots": {
          "query": { "value": "用一句话介绍一下你自己" }
        }
      }
    }
  }'
```

## 小度测试话术

“小度小度，打开豆包。”

“今天适合做什么？”

“继续。”

“帮我打开客厅灯。”

“客厅空调现在怎么样？”

“再见。”

## Home Assistant 映射说明

当 `HA_ENABLED=false` 时，设备控制请求不会调用 Home Assistant，会进入 LLM 自由问答流程。

当 `HA_ENABLED=true` 时，服务先用规则识别 Home Assistant 意图，不让 LLM 直接任意调用 Home Assistant service。当前内置映射如下：

| 口语名称 | entity_id |
| --- | --- |
| 客厅灯 | `light.living_room` |
| 卧室灯 | `light.bedroom` |
| 客厅空调 | `climate.living_room_ac` |

支持“打开/关闭灯”和“打开/关闭空调”的基础控制，也支持状态查询，例如“客厅灯开着吗”。高风险设备关键词包括门锁、锁、安防、报警、摄像头、燃气、煤气、插座、电热器、热水器、烤箱。涉及这些设备控制时，服务会先创建 60 秒 pending confirmation，不会直接执行控制。
