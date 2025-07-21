/**
 * 管理面板API端点
 * 提供用户管理、服务器统计等管理功能的API接口
 */

import express from 'express';
import storage from 'node-persist';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { requireAdminMiddleware } from '../middleware/admin-auth.js';
import { calculateUserStorage, calculateMultipleUsersStorage, formatBytes } from '../utils/storage-calculator.js';
import { globalRequestTracker } from '../utils/request-tracker.js';
import { getConfigValue } from '../util.js';
import { 
    KEY_PREFIX, 
    getAllUserHandles, 
    getUserAvatar,
    getUserDirectories,
    toKey
} from '../users.js';

export const router = express.Router();

// 所有路由都需要管理员权限
router.use(requireAdminMiddleware);

/**
 * 获取用户列表及其详细信息
 * GET /api/admin/users
 */
router.get('/users', async (req, res) => {
    try {
        // 获取所有用户数据
        const users = await storage.values(x => x.key.startsWith(KEY_PREFIX));
        
        // 获取查询参数
        const { includeStorage = 'false', page = '1', limit = '50' } = req.query;
        const shouldIncludeStorage = includeStorage === 'true';
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);

        // 构建用户视图模型
        const userPromises = users.map(async (user) => {
            const userViewModel = {
                handle: user.handle,
                name: user.name,
                admin: user.admin || false,
                enabled: user.enabled !== false,
                created: user.created || null,
                lastOnline: user.lastOnline || null,
                avatar: await getUserAvatar(user.handle),
                hasPassword: !!(user.salt && user.password)
            };

            // 如果需要包含存储信息
            if (shouldIncludeStorage) {
                try {
                    const storageInfo = await calculateUserStorage(user.handle, globalThis.DATA_ROOT);
                    userViewModel.storage = {
                        totalSize: storageInfo.totalSize,
                        totalSizeFormatted: formatBytes(storageInfo.totalSize),
                        breakdown: storageInfo.breakdown,
                        lastCalculated: storageInfo.lastCalculated
                    };
                } catch (error) {
                    console.error(`计算用户 ${user.handle} 存储空间失败:`, error);
                    userViewModel.storage = {
                        totalSize: 0,
                        totalSizeFormatted: '0 B',
                        error: '计算失败'
                    };
                }
            }

            return userViewModel;
        });

        const userViewModels = await Promise.all(userPromises);

        // 排序：管理员优先，然后按创建时间排序
        userViewModels.sort((a, b) => {
            if (a.admin && !b.admin) return -1;
            if (!a.admin && b.admin) return 1;
            
            const aCreated = new Date(a.created || 0);
            const bCreated = new Date(b.created || 0);
            return bCreated - aCreated;
        });

        // 分页处理
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        const paginatedUsers = userViewModels.slice(startIndex, endIndex);

        res.json({
            success: true,
            data: {
                users: paginatedUsers,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: userViewModels.length,
                    totalPages: Math.ceil(userViewModels.length / limitNum),
                    hasNext: endIndex < userViewModels.length,
                    hasPrev: pageNum > 1
                },
                summary: {
                    totalUsers: userViewModels.length,
                    adminUsers: userViewModels.filter(u => u.admin).length,
                    enabledUsers: userViewModels.filter(u => u.enabled).length,
                    usersWithPasswords: userViewModels.filter(u => u.hasPassword).length
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('获取用户列表失败:', error);
        res.status(500).json({
            success: false,
            error: '获取用户列表失败',
            message: error.message
        });
    }
});

/**
 * 获取特定用户的详细信息
 * GET /api/admin/users/:handle
 */
router.get('/users/:handle', async (req, res) => {
    try {
        const { handle } = req.params;
        const user = await storage.getItem(KEY_PREFIX + handle);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }

        // 计算存储使用情况
        const storageInfo = await calculateUserStorage(handle, globalThis.DATA_ROOT);

        const userDetail = {
            handle: user.handle,
            name: user.name,
            admin: user.admin || false,
            enabled: user.enabled !== false,
            created: user.created || null,
            lastOnline: user.lastOnline || null,
            avatar: await getUserAvatar(handle),
            hasPassword: !!(user.salt && user.password),
            storage: {
                totalSize: storageInfo.totalSize,
                totalSizeFormatted: formatBytes(storageInfo.totalSize),
                breakdown: Object.entries(storageInfo.breakdown).map(([key, size]) => ({
                    category: key,
                    size,
                    sizeFormatted: formatBytes(size),
                    percentage: storageInfo.totalSize > 0 ? ((size / storageInfo.totalSize) * 100).toFixed(1) : 0
                })),
                lastCalculated: storageInfo.lastCalculated
            }
        };

        res.json({
            success: true,
            data: userDetail,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`获取用户 ${req.params.handle} 详细信息失败:`, error);
        res.status(500).json({
            success: false,
            error: '获取用户详细信息失败',
            message: error.message
        });
    }
});

/**
 * 彻底删除用户
 * DELETE /api/admin/users/:handle
 */
router.delete('/users/:handle', async (req, res) => {
    try {
        const { handle } = req.params;
        const { confirm } = req.body;

        // 安全检查：需要确认
        if (confirm !== 'DELETE') {
            return res.status(400).json({
                success: false,
                error: '需要确认删除操作',
                message: '请在请求体中包含 {"confirm": "DELETE"}'
            });
        }

        // 检查用户是否存在
        const user = await storage.getItem(KEY_PREFIX + handle);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }

        // 防止删除最后一个管理员
        if (user.admin) {
            const allUsers = await storage.values(x => x.key.startsWith(KEY_PREFIX));
            const adminUsers = allUsers.filter(u => u.admin);
            
            if (adminUsers.length <= 1) {
                return res.status(400).json({
                    success: false,
                    error: '无法删除最后一个管理员用户'
                });
            }
        }

        // 计算删除前的存储使用情况
        const storageInfo = await calculateUserStorage(handle, globalThis.DATA_ROOT);

        // 执行删除操作
        await storage.removeItem(toKey(handle));
        
        // 删除用户目录（可选，根据需要）
        const directories = getUserDirectories(handle);
        try {
            await fsPromises.rm(directories.root, { recursive: true, force: true });
        } catch (error) {
            console.warn(`删除用户目录失败: ${error.message}`);
        }

        res.json({
            success: true,
            message: `用户 ${handle} 已被彻底删除`,
            data: {
                deletedUser: {
                    handle: user.handle,
                    name: user.name,
                    admin: user.admin,
                    storageFreed: formatBytes(storageInfo.totalSize)
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`删除用户 ${req.params.handle} 失败:`, error);
        res.status(500).json({
            success: false,
            error: '删除用户失败',
            message: error.message
        });
    }
});

/**
 * 获取用户存储使用情况
 * GET /api/admin/storage/:handle
 */
router.get('/storage/:handle', async (req, res) => {
    try {
        const { handle } = req.params;
        
        // 检查用户是否存在
        const user = await storage.getItem(KEY_PREFIX + handle);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }

        const storageInfo = await calculateUserStorage(handle, globalThis.DATA_ROOT);

        res.json({
            success: true,
            data: {
                userHandle: handle,
                totalSize: storageInfo.totalSize,
                totalSizeFormatted: formatBytes(storageInfo.totalSize),
                breakdown: storageInfo.breakdown,
                breakdownFormatted: Object.entries(storageInfo.breakdown).map(([key, size]) => ({
                    category: key,
                    size,
                    sizeFormatted: formatBytes(size)
                })),
                lastCalculated: storageInfo.lastCalculated
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`获取用户 ${req.params.handle} 存储信息失败:`, error);
        res.status(500).json({
            success: false,
            error: '获取存储信息失败',
            message: error.message
        });
    }
});

/**
 * 批量获取所有用户的存储使用情况
 * GET /api/admin/storage
 */
router.get('/storage', async (req, res) => {
    try {
        const userHandles = await getAllUserHandles();
        const storageResults = await calculateMultipleUsersStorage(userHandles, globalThis.DATA_ROOT);

        // 计算总计信息
        const totalStorage = storageResults.reduce((sum, result) => sum + result.totalSize, 0);
        const averageStorage = userHandles.length > 0 ? totalStorage / userHandles.length : 0;

        res.json({
            success: true,
            data: {
                users: storageResults.map(result => ({
                    userHandle: result.userHandle,
                    totalSize: result.totalSize,
                    totalSizeFormatted: formatBytes(result.totalSize),
                    error: result.error || null,
                    lastCalculated: result.lastCalculated
                })),
                summary: {
                    totalUsers: userHandles.length,
                    totalStorage,
                    totalStorageFormatted: formatBytes(totalStorage),
                    averageStorage,
                    averageStorageFormatted: formatBytes(averageStorage)
                }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('批量获取存储信息失败:', error);
        res.status(500).json({
            success: false,
            error: '批量获取存储信息失败',
            message: error.message
        });
    }
});

/**
 * 获取服务器统计信息
 * GET /api/admin/stats
 */
router.get('/stats', async (req, res) => {
    try {
        const { window } = req.query;

        let statsData;
        if (window && ['2', '4', '6', '8', '10'].includes(window)) {
            // 获取特定时间窗口的统计
            statsData = globalRequestTracker.getRequestStats(parseInt(window, 10));
        } else {
            // 获取所有时间窗口的统计
            statsData = globalRequestTracker.getAllStats();
        }

        // 获取实时统计
        const realTimeStats = globalRequestTracker.getRealTimeStats();

        // 获取系统信息
        // 获取系统信息
        const memoryUsage = process.memoryUsage();
        const systemUptime = process.uptime();
        
        // 获取操作系统信息
        const osInfo = {
            platform: process.platform,
            arch: process.arch,
            release: os.release(),
            hostname: os.hostname(),
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            cpuCount: os.cpus().length
        };
        
        const systemInfo = {
            nodeVersion: process.version,
            platform: osInfo.platform,
            arch: osInfo.arch,
            hostname: osInfo.hostname,
            uptime: systemUptime,
            uptimeFormatted: formatUptime(systemUptime),
            memoryUsage: {
                // Node.js进程内存
                rss: memoryUsage.rss,
                heapTotal: memoryUsage.heapTotal,
                heapUsed: memoryUsage.heapUsed,
                external: memoryUsage.external,
                arrayBuffers: memoryUsage.arrayBuffers,
                // 系统内存信息
                systemTotal: osInfo.totalMemory,
                systemFree: osInfo.freeMemory,
                systemUsed: osInfo.totalMemory - osInfo.freeMemory,
                systemUsagePercent: ((osInfo.totalMemory - osInfo.freeMemory) / osInfo.totalMemory * 100).toFixed(1)
            },
            cpuUsage: process.cpuUsage(),
            cpuCount: osInfo.cpuCount,
            // 添加配置信息
            config: {
                dataRoot: globalThis.DATA_ROOT || 'unknown',
                nodeEnv: process.env.NODE_ENV || 'development',
                // 其他配置信息可以从这里获取
                enableAccounts: getConfigValue('enableUserAccounts', false, 'boolean'),
                whitelistMode: getConfigValue('whitelistMode', false, 'boolean'),
                basicAuthMode: globalThis.COMMAND_LINE_ARGS?.basicAuthMode || false,
                csrfProtection: !globalThis.COMMAND_LINE_ARGS?.disableCsrf
            }
        };

        res.json({
            success: true,
            data: {
                requestStats: statsData,
                realTimeStats,
                systemInfo,
                serverTime: new Date().toISOString()
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('获取服务器统计失败:', error);
        res.status(500).json({
            success: false,
            error: '获取服务器统计失败',
            message: error.message
        });
    }
});

/**
 * 格式化运行时间
 * @param {number} seconds - 秒数
 * @returns {string} 格式化的时间字符串
 */
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}天`);
    if (hours > 0) parts.push(`${hours}小时`);
    if (minutes > 0) parts.push(`${minutes}分钟`);
    if (secs > 0) parts.push(`${secs}秒`);

    return parts.join(' ') || '0秒';
}