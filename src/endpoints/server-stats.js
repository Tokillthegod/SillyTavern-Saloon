/**
 * 服务器统计API端点
 * 提供详细的服务器性能和使用情况统计
 */

import express from 'express';
import os from 'node:os';
import { promises as fsPromises } from 'node:fs';
import { requireAdminMiddleware } from '../middleware/admin-auth.js';
import { globalRequestTracker } from '../utils/request-tracker.js';
import { formatBytes } from '../utils/storage-calculator.js';

export const router = express.Router();

// 所有路由都需要管理员权限
router.use(requireAdminMiddleware);

/**
 * 获取系统资源使用情况
 * GET /api/server-stats/system
 */
router.get('/system', async (req, res) => {
    try {
        // CPU信息
        const cpus = os.cpus();
        const cpuUsage = process.cpuUsage();
        
        // 内存信息
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const processMemory = process.memoryUsage();

        // 系统负载（仅在Unix系统上可用）
        let loadAverage = null;
        try {
            loadAverage = os.loadavg();
        } catch (error) {
            // Windows系统不支持loadavg
        }

        // 网络接口信息
        const networkInterfaces = os.networkInterfaces();

        const systemStats = {
            cpu: {
                model: cpus[0]?.model || 'Unknown',
                cores: cpus.length,
                speed: cpus[0]?.speed || 0,
                usage: {
                    user: cpuUsage.user,
                    system: cpuUsage.system
                }
            },
            memory: {
                total: totalMemory,
                totalFormatted: formatBytes(totalMemory),
                free: freeMemory,
                freeFormatted: formatBytes(freeMemory),
                used: usedMemory,
                usedFormatted: formatBytes(usedMemory),
                usagePercentage: ((usedMemory / totalMemory) * 100).toFixed(1),
                process: {
                    rss: processMemory.rss,
                    rssFormatted: formatBytes(processMemory.rss),
                    heapTotal: processMemory.heapTotal,
                    heapTotalFormatted: formatBytes(processMemory.heapTotal),
                    heapUsed: processMemory.heapUsed,
                    heapUsedFormatted: formatBytes(processMemory.heapUsed),
                    external: processMemory.external,
                    externalFormatted: formatBytes(processMemory.external)
                }
            },
            system: {
                platform: os.platform(),
                arch: os.arch(),
                release: os.release(),
                hostname: os.hostname(),
                uptime: os.uptime(),
                uptimeFormatted: formatUptime(os.uptime()),
                loadAverage: loadAverage ? {
                    '1min': loadAverage[0],
                    '5min': loadAverage[1],
                    '15min': loadAverage[2]
                } : null
            },
            process: {
                nodeVersion: process.version,
                pid: process.pid,
                uptime: process.uptime(),
                uptimeFormatted: formatUptime(process.uptime()),
                workingDirectory: process.cwd(),
                execPath: process.execPath
            },
            network: Object.entries(networkInterfaces).map(([name, interfaces]) => ({
                name,
                interfaces: interfaces?.map(iface => ({
                    address: iface.address,
                    family: iface.family,
                    internal: iface.internal,
                    mac: iface.mac
                })) || []
            }))
        };

        res.json({
            success: true,
            data: systemStats,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('获取系统统计失败:', error);
        res.status(500).json({
            success: false,
            error: '获取系统统计失败',
            message: error.message
        });
    }
});

/**
 * 获取请求统计信息
 * GET /api/server-stats/requests
 */
router.get('/requests', async (req, res) => {
    try {
        const { window, format = 'json' } = req.query;

        let statsData;
        if (window && ['2', '4', '6', '8', '10'].includes(window)) {
            statsData = globalRequestTracker.getRequestStats(parseInt(window, 10));
        } else {
            statsData = globalRequestTracker.getAllStats();
        }

        const realTimeStats = globalRequestTracker.getRealTimeStats();

        if (format === 'chart') {
            // 返回适合图表显示的格式
            const chartData = window ? 
                formatChartData(statsData) : 
                Object.entries(statsData.stats).reduce((acc, [key, data]) => {
                    acc[key] = formatChartData(data);
                    return acc;
                }, {});

            res.json({
                success: true,
                data: {
                    chartData,
                    realTimeStats,
                    lastUpdated: new Date().toISOString()
                }
            });
        } else {
            res.json({
                success: true,
                data: {
                    requestStats: statsData,
                    realTimeStats,
                    lastUpdated: new Date().toISOString()
                }
            });
        }

    } catch (error) {
        console.error('获取请求统计失败:', error);
        res.status(500).json({
            success: false,
            error: '获取请求统计失败',
            message: error.message
        });
    }
});

/**
 * 获取磁盘使用情况
 * GET /api/server-stats/disk
 */
router.get('/disk', async (req, res) => {
    try {
        const dataRoot = globalThis.DATA_ROOT;
        
        // 获取数据目录的磁盘使用情况
        const diskUsage = await getDiskUsage(dataRoot);

        res.json({
            success: true,
            data: {
                dataRoot,
                diskUsage,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('获取磁盘统计失败:', error);
        res.status(500).json({
            success: false,
            error: '获取磁盘统计失败',
            message: error.message
        });
    }
});

/**
 * 获取实时状态概览
 * GET /api/server-stats/overview
 */
router.get('/overview', async (req, res) => {
    try {
        // 获取基本系统信息
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const processMemory = process.memoryUsage();

        // 获取请求统计
        const realTimeStats = globalRequestTracker.getRealTimeStats();
        const last10MinStats = globalRequestTracker.getRequestStats(10);

        // 获取负载信息
        let loadAverage = null;
        try {
            loadAverage = os.loadavg();
        } catch (error) {
            // Windows系统不支持
        }

        const overview = {
            system: {
                uptime: process.uptime(),
                uptimeFormatted: formatUptime(process.uptime()),
                memoryUsage: {
                    total: totalMemory,
                    used: usedMemory,
                    percentage: ((usedMemory / totalMemory) * 100).toFixed(1),
                    process: {
                        heapUsed: processMemory.heapUsed,
                        heapTotal: processMemory.heapTotal,
                        percentage: ((processMemory.heapUsed / processMemory.heapTotal) * 100).toFixed(1)
                    }
                },
                loadAverage: loadAverage ? loadAverage[0] : null,
                cpuCores: os.cpus().length
            },
            requests: {
                currentMinute: realTimeStats.currentMinuteRequests,
                last5Minutes: realTimeStats.last5MinutesTotal,
                last10MinutesAverage: realTimeStats.last10MinutesAverage,
                totalLast10Minutes: last10MinStats.totalRequests
            },
            status: 'healthy', // 可以根据实际情况动态计算
            lastUpdated: new Date().toISOString()
        };

        res.json({
            success: true,
            data: overview,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('获取状态概览失败:', error);
        res.status(500).json({
            success: false,
            error: '获取状态概览失败',
            message: error.message
        });
    }
});

/**
 * 格式化图表数据
 * @param {Object} statsData - 统计数据
 * @returns {Object} 格式化的图表数据
 */
function formatChartData(statsData) {
    return {
        labels: statsData.timeSeries?.map(point => point.time) || [],
        datasets: [{
            label: '请求数量',
            data: statsData.timeSeries?.map(point => point.count) || [],
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            tension: 0.1
        }],
        summary: {
            total: statsData.totalRequests,
            average: statsData.averagePerMinute,
            window: statsData.windowMinutes
        }
    };
}

/**
 * 获取磁盘使用情况
 * @param {string} path - 路径
 * @returns {Promise<Object>} 磁盘使用情况
 */
async function getDiskUsage(path) {
    try {
        const stats = await fsPromises.stat(path);
        
        // 注意：Node.js没有直接获取磁盘空间的API
        // 这里返回基本信息，实际实现可能需要使用第三方库
        return {
            path,
            exists: true,
            isDirectory: stats.isDirectory(),
            size: stats.size,
            sizeFormatted: formatBytes(stats.size),
            modified: stats.mtime,
            // 磁盘空间信息需要额外实现
            diskSpace: {
                total: null,
                free: null,
                used: null,
                note: '磁盘空间信息需要额外的系统调用'
            }
        };
    } catch (error) {
        return {
            path,
            exists: false,
            error: error.message
        };
    }
}

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