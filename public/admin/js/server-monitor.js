/**
 * 服务器监控模块
 * 处理服务器统计、请求图表等监控功能
 */

class ServerMonitor {
    constructor(adminPanel) {
        this.adminPanel = adminPanel;
        this.requestChart = null;
        this.updateInterval = null;
        this.timeWindows = [2, 4, 6, 8, 10]; // 分钟
        this.currentTimeWindow = 10; // 默认10分钟
        this.init();
    }

    /**
     * 初始化服务器监控模块
     */
    init() {
        this.bindEvents();
        this.initRequestChart();
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 时间窗口选择
        $(document).on('change', '#stats-time-window-select', (e) => {
            this.currentTimeWindow = parseInt(e.target.value);
            this.updateRequestChart();
        });

        // 刷新按钮
        $(document).on('click', '#refresh-stats-btn', () => {
            this.loadServerStats();
        });

        // 自动刷新开关
        $(document).on('change', '#auto-refresh-toggle', (e) => {
            if (e.target.checked) {
                this.startAutoRefresh();
            } else {
                this.stopAutoRefresh();
            }
        });
    }

    /**
     * 初始化请求统计图表
     */
    initRequestChart() {
        const ctx = document.getElementById('stats-requests-chart');
        if (!ctx) return;

        this.requestChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '请求数量',
                    data: [],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0 // 初始创建时不使用动画
                },
                plugins: {
                    title: {
                        display: true,
                        text: '服务器请求统计',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: '时间'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: '请求数量'
                        },
                        beginAtZero: true
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    /**
     * 加载服务器统计数据
     */
    async loadServerStats() {
        try {
            this.adminPanel.showLoading('正在加载服务器统计...');
            
            const response = await this.adminPanel.fetchAPI('/api/admin/stats');
            
            if (response.success) {
                this.updateStatsDisplay(response.data);
                this.updateRequestChart(response.data.requestStats);
            } else {
                throw new Error(response.error || '获取服务器统计失败');
            }
        } catch (error) {
            console.error('加载服务器统计失败:', error);
            this.adminPanel.showError('加载服务器统计失败: ' + error.message);
        } finally {
            this.adminPanel.hideLoading();
        }
    }

    /**
     * 更新统计数据显示
     */
    updateStatsDisplay(stats) {
        // 从API响应中获取正确的数据结构
        const systemInfo = stats.systemInfo || {};
        const realTimeStats = stats.realTimeStats || {};
        
        // 更新基础统计
        $('#server-uptime').text(systemInfo.uptimeFormatted || '-');
        $('#total-requests').text((realTimeStats.last5MinutesTotal || 0).toLocaleString());
        $('#active-connections').text('0'); // 暂时没有连接数统计
        
        // 更新内存使用 - 注意这里的元素ID可能与仪表盘冲突
        if (systemInfo.memoryUsage) {
            const memUsage = systemInfo.memoryUsage;
            const heapUsed = memUsage.heapUsed || 0;
            const heapTotal = memUsage.heapTotal || 1;
            const memoryPercent = ((heapUsed / heapTotal) * 100).toFixed(1);
            
            // 使用更具体的选择器避免ID冲突
            $('#stats-tab #memory-usage').text(this.formatBytes(heapUsed));
            $('#memory-progress').css('width', memoryPercent + '%');
            $('#memory-percent').text(memoryPercent + '%');
        } else {
            $('#stats-tab #memory-usage').text('-');
            $('#memory-progress').css('width', '0%');
            $('#memory-percent').text('0%');
        }

        // CPU使用率（暂时没有实时CPU统计）
        const cpuPercent = 0;
        $('#cpu-usage').text('0.0%');
        $('#cpu-progress').css('width', '0%');
        
        // 根据CPU使用率设置颜色
        const cpuProgressBar = $('#cpu-progress');
        cpuProgressBar.removeClass('low medium high');
        cpuProgressBar.addClass('low');

        // 更新最后更新时间
        $('#last-update-time').text(new Date().toLocaleString('zh-CN'));
    }

    /**
     * 更新请求统计图表
     */
    async updateRequestChart(requestStats = null) {
        try {
            if (!requestStats) {
                const response = await this.adminPanel.fetchAPI(`/api/admin/stats?window=${this.currentTimeWindow}`);
                if (!response.success) {
                    throw new Error(response.error || '获取请求统计失败');
                }
                requestStats = response.data.requestStats;
            }

            if (!this.requestChart) return;

            let timeSeries = [];
            
            // 处理不同格式的数据
            if (requestStats && typeof requestStats === 'object') {
                if (requestStats.timeSeries && Array.isArray(requestStats.timeSeries)) {
                    // 单个时间窗口数据
                    timeSeries = requestStats.timeSeries;
                } else if (requestStats.stats && requestStats.stats[`${this.currentTimeWindow}min`]) {
                    // 多个时间窗口数据
                    timeSeries = requestStats.stats[`${this.currentTimeWindow}min`].timeSeries || [];
                } else if (Array.isArray(requestStats)) {
                    // 直接是数组格式
                    timeSeries = requestStats;
                }
            }

            // 处理时间标签和数据
            const labels = timeSeries.map(stat => {
                if (stat.time) return stat.time;
                if (stat.timestamp) {
                    const date = new Date(stat.timestamp);
                    return date.toLocaleTimeString('zh-CN', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });
                }
                return '';
            });

            const data = timeSeries.map(stat => stat.count || 0);

            // 检查数据是否有变化
            const currentLabels = this.requestChart.data.labels;
            const currentData = this.requestChart.data.datasets[0].data;
            
            let hasDataChanged = false;
            let hasNewDataPoint = false;
            
            // 检查是否有新的数据点或数据变化
            if (labels.length !== currentLabels.length) {
                hasNewDataPoint = true;
                hasDataChanged = true;
            } else {
                // 检查数据值是否有变化
                for (let i = 0; i < data.length; i++) {
                    if (data[i] !== currentData[i]) {
                        hasDataChanged = true;
                        break;
                    }
                }
            }

            // 只有在数据变化时才更新图表
            if (hasDataChanged) {
                // 启用平滑动画
                this.requestChart.options.animation = {
                    duration: hasNewDataPoint ? 750 : 300,
                    easing: 'easeInOutQuart'
                };

                // 更新数据
                this.requestChart.data.labels = labels;
                this.requestChart.data.datasets[0].data = data;
                
                // 更新图表标题
                this.requestChart.options.plugins.title.text = `LLM请求统计 (最近 ${this.currentTimeWindow} 分钟)`;
                
                // 使用平滑更新
                this.requestChart.update('active');
                
                console.debug(`服务器统计图表已更新: ${hasNewDataPoint ? '新数据点' : '数据变化'}`);
            }

        } catch (error) {
            console.error('更新请求图表失败:', error);
            this.adminPanel.showError('更新请求图表失败: ' + error.message);
        }
    }

    /**
     * 开始自动刷新
     */
    startAutoRefresh() {
        this.stopAutoRefresh(); // 先停止现有的定时器
        
        this.updateInterval = setInterval(() => {
            this.loadServerStats();
        }, 30000); // 每30秒刷新一次
        
        // 每2秒刷新一次请求统计图表
        this.chartUpdateInterval = setInterval(() => {
            this.updateRequestChart();
        }, 2000);

        this.adminPanel.showInfo('已启用自动刷新 (30秒间隔)');
    }

    /**
     * 停止自动刷新
     */
    stopAutoRefresh() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        if (this.chartUpdateInterval) {
            clearInterval(this.chartUpdateInterval);
            this.chartUpdateInterval = null;
        }
    }

    /**
     * 格式化运行时间
     */
    formatUptime(seconds) {
        if (!seconds) return '0秒';
        
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        const parts = [];
        if (days > 0) parts.push(`${days}天`);
        if (hours > 0) parts.push(`${hours}小时`);
        if (minutes > 0) parts.push(`${minutes}分钟`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}秒`);

        return parts.join(' ');
    }

    /**
     * 格式化字节大小
     */
    formatBytes(bytes) {
        return this.adminPanel.formatBytes(bytes);
    }

    /**
     * 销毁监控模块
     */
    destroy() {
        this.stopAutoRefresh();
        
        if (this.requestChart) {
            this.requestChart.destroy();
            this.requestChart = null;
        }
    }
}

// 导出模块
window.ServerMonitor = ServerMonitor;