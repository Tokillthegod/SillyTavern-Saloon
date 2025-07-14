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

### 📢 系统公告功能
- **登录页公告栏**: 在登录界面显示系统公告信息
- **实时信息展示**: 管理员可通过公告栏向用户传达重要信息

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
- **安全问题验证**: 密码重置前需要回答预设的安全问题
- **隐私登录模式**: 可选的隐私登录界面

### 👥 用户管理功能
- **管理员面板**: 完整的用户管理界面
- **用户启用/禁用**: 管理员可以启用或禁用用户账户
- **权限提升**: 可以将普通用户提升为管理员
- **用户数据备份**: 支持用户数据的导出和备份
- **数据恢复功能**: 支持从备份文件恢复用户数据
- **安全问题管理**: 用户可在账户设置中配置安全问题
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
5. 注册时需要设置安全问题用于密码恢复

## 👤 用户管理

### 管理员功能
- 查看所有用户列表
- 启用/禁用用户账户
- 提升/降级用户权限
- 删除用户账户（可选择是否删除数据）
- 重置用户密码
- 管理系统公告内容
- 用户数据备份和恢复管理

### 用户功能
- 注册新账户（包含安全问题设置）
- 登录/登出（带公告栏显示）
- 修改个人信息
- 密码重置（基于安全问题验证）
- 安全问题设置和管理
- 数据备份导出
- 备份文件恢复

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
- `POST /api/users/recover-step1` - 密码恢复第一步（生成恢复码）
- `POST /api/users/recover-step2` - 密码恢复第二步（重置密码）
- `POST /api/users/get-recovery-code` - 获取恢复码（新增）
- `POST /api/users/admin/get` - 管理员获取用户信息
- `POST /api/users/admin/create` - 管理员创建用户
- `POST /api/users/admin/delete` - 管理员删除用户

## 🆕 最新更新

### 密码恢复功能优化

我们对密码恢复功能进行了重大改进，提升了用户体验：

#### 🔄 修改前的流程
1. 用户点击"忘记密码"
2. 服务器生成恢复码并**输出到服务器控制台**
3. 用户需要查看服务器控制台获取恢复码
4. 用户在界面输入恢复码和新密码

#### ✨ 修改后的流程
1. 用户点击"忘记密码"
2. 用户点击"发送"按钮
3. 服务器生成恢复码
4. **恢复码直接显示在网页界面上**（绿色高亮显示）
5. 用户在同一界面输入恢复码和新密码
6. 完成密码重置

#### 🎯 主要改进
- **用户体验提升**: 无需访问服务器控制台，所有操作都在网页界面完成
- **界面友好**: 恢复码以醒目的绿色字体显示，清晰易读
- **安全性保持**: 恢复码仍然是临时生成的4位数字，有时间限制
- **错误处理**: 完善的错误提示和状态管理
- **向后兼容**: 保持了原有的API结构，只是添加了新的获取接口

#### 🔧 技术实现
- 新增API端点：`POST /api/users/get-recovery-code`
- 前端JavaScript增强：添加恢复码显示功能
- 界面优化：更新提示信息和用户引导

## 🔧 故障排除

### 常见问题

**Q: 无法访问登录页面？**
A: 确保在config.yaml中设置了`enableUserAccounts: true`

**Q: 忘记管理员密码？**
A: 现在可以直接在登录界面使用"忘记密码"功能，恢复码会直接显示在网页上。或者使用`recover.js`脚本重置密码：
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
