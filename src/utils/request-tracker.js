/**
 * 请求统计追踪工具
 * 实现请求计数和时间窗口统计功能
 */

/**
 * 请求统计追踪器类
 */
export class RequestTracker {
    constructor() {
        // 存储请求数据的数组，每个元素包含时间戳和请求数
        this.requestData = [];
        
        // 支持的时间窗口（分钟）
        this.timeWindows = [2, 4, 6, 8, 10];
        
        // 当前分钟的请求计数
        this.currentMinuteCount = 0;
        this.currentMinute = this.getCurrentMinute();
        
        // 启动定时器，每分钟保存数据
        this.startPeriodicSave();
    }

    /**
     * 获取当前分钟的时间戳（精确到分钟）
     * @returns {number} 当前分钟的时间戳
     */
    getCurrentMinute() {
        const now = new Date();
        now.setSeconds(0, 0); // 将秒和毫秒设为0
        return now.getTime();
    }

    /**
     * 记录一个新的请求
     */
    recordRequest() {
        const currentMinute = this.getCurrentMinute();
        
        if (currentMinute === this.currentMinute) {
            // 同一分钟内，增加计数
            this.currentMinuteCount++;
        } else {
            // 新的分钟，保存上一分钟的数据并重置
            if (this.currentMinuteCount > 0) {
                this.requestData.push({
                    timestamp: this.currentMinute,
                    count: this.currentMinuteCount
                });
            }
            
            this.currentMinute = currentMinute;
            this.currentMinuteCount = 1;
            
            // 清理过期数据（保留最近15分钟的数据）
            this.cleanupOldData();
        }
    }

    /**
     * 清理过期的请求数据
     */
    cleanupOldData() {
        const cutoffTime = Date.now() - (15 * 60 * 1000); // 15分钟前
        this.requestData = this.requestData.filter(data => data.timestamp >= cutoffTime);
    }

    /**
     * 获取指定时间窗口内的请求统计
     * @param {number} windowMinutes - 时间窗口（分钟）
     * @returns {Object} 统计数据
     */
    getRequestStats(windowMinutes) {
        const cutoffTime = Date.now() - (windowMinutes * 60 * 1000);
        
        // 过滤指定时间窗口内的数据
        const windowData = this.requestData.filter(data => data.timestamp >= cutoffTime);
        
        // 添加当前分钟的数据（如果在时间窗口内）
        if (this.currentMinute >= cutoffTime && this.currentMinuteCount > 0) {
            windowData.push({
                timestamp: this.currentMinute,
                count: this.currentMinuteCount
            });
        }

        // 计算统计信息
        const totalRequests = windowData.reduce((sum, data) => sum + data.count, 0);
        const averagePerMinute = windowData.length > 0 ? totalRequests / windowMinutes : 0;
        
        // 生成时间序列数据（用于图表）
        const timeSeriesData = this.generateTimeSeriesData(windowMinutes, windowData);

        return {
            windowMinutes,
            totalRequests,
            averagePerMinute: Math.round(averagePerMinute * 100) / 100,
            dataPoints: windowData.length,
            timeSeries: timeSeriesData,
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * 生成时间序列数据
     * @param {number} windowMinutes - 时间窗口（分钟）
     * @param {Array} windowData - 窗口内的数据
     * @returns {Array} 时间序列数据数组
     */
    generateTimeSeriesData(windowMinutes, windowData) {
        const timeSeries = [];
        const now = Date.now();
        
        // 创建数据映射，便于查找
        const dataMap = new Map();
        windowData.forEach(data => {
            dataMap.set(data.timestamp, data.count);
        });

        // 生成每分钟的数据点
        for (let i = windowMinutes - 1; i >= 0; i--) {
            const timestamp = now - (i * 60 * 1000);
            const minuteTimestamp = Math.floor(timestamp / 60000) * 60000; // 精确到分钟
            const count = dataMap.get(minuteTimestamp) || 0;
            
            timeSeries.push({
                timestamp: minuteTimestamp,
                time: new Date(minuteTimestamp).toLocaleTimeString('zh-CN', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                }),
                count
            });
        }

        return timeSeries;
    }

    /**
     * 获取所有支持的时间窗口的统计数据
     * @returns {Object} 所有时间窗口的统计数据
     */
    getAllStats() {
        const stats = {};
        
        this.timeWindows.forEach(window => {
            stats[`${window}min`] = this.getRequestStats(window);
        });

        return {
            stats,
            currentTime: new Date().toISOString(),
            totalDataPoints: this.requestData.length + (this.currentMinuteCount > 0 ? 1 : 0)
        };
    }

    /**
     * 启动定期保存数据的定时器
     */
    startPeriodicSave() {
        // 每分钟检查一次，确保数据及时保存
        setInterval(() => {
            const currentMinute = this.getCurrentMinute();
            
            if (currentMinute !== this.currentMinute && this.currentMinuteCount > 0) {
                // 保存上一分钟的数据
                this.requestData.push({
                    timestamp: this.currentMinute,
                    count: this.currentMinuteCount
                });
                
                this.currentMinute = currentMinute;
                this.currentMinuteCount = 0;
                
                // 清理过期数据
                this.cleanupOldData();
            }
        }, 60000); // 每分钟执行一次
    }

    /**
     * 获取实时统计摘要
     * @returns {Object} 实时统计摘要
     */
    getRealTimeStats() {
        return {
            currentMinuteRequests: this.currentMinuteCount,
            last5MinutesTotal: this.getRequestStats(5).totalRequests,
            last10MinutesAverage: this.getRequestStats(10).averagePerMinute,
            dataPointsStored: this.requestData.length,
            lastUpdated: new Date().toISOString()
        };
    }
}

// 创建全局请求追踪器实例
export const globalRequestTracker = new RequestTracker();

/**
 * Express中间件：记录LLM请求
 * @param {import('express').Request} req - Express请求对象
 * @param {import('express').Response} res - Express响应对象
 * @param {import('express').NextFunction} next - Express下一个中间件函数
 */
export function requestTrackingMiddleware(req, res, next) {
    // 只统计LLM相关的请求
    const isLLMRequest = req.method === 'POST' && (
        req.path.includes('/chat/completions') ||
        req.path.includes('/completions') ||
        req.path === '/api/backends/chat-completions/generate' ||
        req.path.startsWith('/api/openai/') ||
        req.path.includes('/generate') ||
        req.path.includes('/v1/chat') ||
        req.path.includes('/v1/completions')
    );
    
    if (isLLMRequest) {
        console.debug('Tracking LLM request:', req.method, req.path);
        globalRequestTracker.recordRequest();
    }
    next();
}