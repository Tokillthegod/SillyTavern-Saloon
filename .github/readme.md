# SillyTavern - 多用户增强版

<div align="center">

[![GitHub Stars](https://img.shields.io/github/stars/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/forks)
[![GitHub Issues](https://img.shields.io/github/issues/SillyTavern/SillyTavern.svg)](https://github.com/SillyTavern/SillyTavern/issues)

**🌟 专为多用户环境优化的SillyTavern分支版本 🌟**

</div>

---

## 📖 项目简介

这是一个基于官方SillyTavern的增强版本，**主要特色是完整的多用户登录系统**。SillyTavern是一个功能强大的本地安装用户界面，允许您与文本生成LLM、图像生成引擎和TTS语音模型进行交互。

本分支版本在保持原有所有功能的基础上，专门针对多用户使用场景进行了优化和增强。

## 🚀 主要特色功能

### 🔐 完整的多用户系统
- **用户注册与登录**: 支持多个用户独立注册和登录
- **用户权限管理**: 管理员可以管理其他用户账户
- **密码保护**: 每个用户可以设置独立的密码保护
- **会话管理**: 安全的用户会话和自动登录功能
- **数据隔离**: 每个用户拥有独立的数据目录和配置

### 🛡️ 安全特性
- **CSRF保护**: 内置跨站请求伪造保护
- **速率限制**: 登录和注册请求的速率限制
- **密码恢复**: 安全的密码重置机制
- **隐私登录模式**: 可选的隐私登录界面

### 👥 用户管理功能
- **管理员面板**: 完整的用户管理界面
- **用户启用/禁用**: 管理员可以启用或禁用用户账户
- **权限提升**: 可以将普通用户提升为管理员
- **用户数据备份**: 支持用户数据的导出和备份
- **批量用户操作**: 支持批量管理用户账户

### 🔧 配置选项
- **enableUserAccounts**: 启用/禁用多用户模式
- **enableDiscreetLogin**: 启用隐私登录模式（隐藏用户列表）
- **autheliaAuth**: 支持Authelia认证集成
- **perUserBasicAuth**: 每用户基础认证
- **sessionTimeout**: 可配置的会话超时时间

## 📁 用户数据结构

每个用户都有独立的数据目录结构：
```
data/
├── [username]/
│   ├── characters/          # 角色卡片
│   ├── chats/              # 聊天记录
│   ├── backgrounds/        # 背景图片
│   ├── User Avatars/       # 用户头像
│   ├── worlds/             # 世界信息
│   ├── groups/             # 群组设置
│   ├── themes/             # 主题配置
│   ├── extensions/         # 扩展插件
│   ├── settings.json       # 用户设置
│   └── secrets.json        # 密钥配置
└── _storage/               # 用户账户信息
```

## 🛠️ 安装和配置

### 基础安装
```bash
# 克隆仓库
git clone https://github.com/SanVenturas/SillyTavern.git
cd SillyTavern

# 安装依赖
npm install

# 启动服务器
npm start
```

### 启用多用户模式

1. **修改配置文件** (`default/config.yaml`):
```yaml
# 启用多用户模式
enableUserAccounts: true

# 可选：启用隐私登录模式
enableDiscreetLogin: false

# 可选：配置会话超时（秒）
sessionTimeout: 86400  # 24小时
```

2. **启动服务器**:
```bash
node server.js --enableUserAccounts
```

3. **访问登录页面**:
打开浏览器访问 `http://localhost:8000/login`

### 首次设置

1. 首次启动时会自动创建默认管理员账户
2. 访问登录页面进行用户注册
3. 第一个注册的用户将自动获得管理员权限
4. 后续用户可以通过注册页面创建账户

## 👤 用户管理

### 管理员功能
- 查看所有用户列表
- 启用/禁用用户账户
- 提升/降级用户权限
- 删除用户账户（可选择是否删除数据）
- 重置用户密码

### 用户功能
- 注册新账户
- 登录/登出
- 修改个人信息
- 密码重置
- 数据备份导出

## 🔒 安全配置

### 密码策略
- 支持强密码要求
- 密码使用scrypt加密存储
- 每个用户独立的密码盐值

### 会话安全
- 安全的cookie会话管理
- 可配置的会话超时
- 自动登录功能（可选）

### 网络安全
- CSRF令牌保护
- 请求速率限制
- IP地址记录和监控

## 🌐 高级配置

### Authelia集成
```yaml
# 启用Authelia认证
autheliaAuth: true
```

### 反向代理配置
支持Nginx、Traefik、Caddy等反向代理，可配置：
- SSL终止
- 负载均衡
- 访问控制

### Docker部署
```yaml
# docker-compose.yml
version: '3.8'
services:
  sillytavern:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
    environment:
      - ENABLE_USER_ACCOUNTS=true
```

## 📚 API文档

### 用户管理API
- `POST /api/users/register` - 用户注册
- `POST /api/users/login` - 用户登录
- `POST /api/users/list` - 获取用户列表
- `POST /api/users/admin/get` - 管理员获取用户信息
- `POST /api/users/admin/create` - 管理员创建用户
- `POST /api/users/admin/delete` - 管理员删除用户

## 🔧 故障排除

### 常见问题

**Q: 无法访问登录页面？**
A: 确保在config.yaml中设置了`enableUserAccounts: true`

**Q: 忘记管理员密码？**
A: 使用`recover.js`脚本重置密码：
```bash
node recover.js --user admin
```

**Q: 用户数据丢失？**
A: 检查data目录权限，确保SillyTavern有读写权限

**Q: 会话频繁过期？**
A: 调整`sessionTimeout`配置或设置为-1禁用超时 

## 📄 许可证

本项目基于GNU Affero General Public License v3.0许可证开源。

## 🙏 致谢

- 感谢[SillyTavern](https://github.com/SillyTavern/SillyTavern)原项目团队

---

<div align="center">

**⭐ 如果这个项目对您有帮助，请给我们一个星标！ ⭐**

</div>
