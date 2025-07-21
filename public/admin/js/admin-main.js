/**
 * SillyTavern 管理面板主要JavaScript文件
 * 处理导航、通用功能和页面初始化
 */

class AdminPanel {
    constructor() {
        this.currentTab = 'dashboard';
        this.refreshInterval = null;
        this.requestChart = null;
        
        this.init();
    }

    /**
     * 初始化管理面板
     */
    init() {
        this.setupEventListeners();
        this.loadCurrentUser();
        this.switchTab('dashboard');
        this.startAutoRefresh();
        
        // 初始化子模块
        this.initializeModules();
        
        // 显示欢迎消息
        this.showToast('欢迎使用 SillyTavern 管理面板', 'success');
    }

    /**
     * 初始化子模块
     */
    initializeModules() {
        // 初始化用户管理模块
        if (typeof UserManagement !== 'undefined') {
            window.userManagement = new UserManagement(this);
        }
        
        // 初始化服务器监控模块
        if (typeof ServerMonitor !== 'undefined') {
            window.serverMonitor = new ServerMonitor(this);
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 导航菜单点击事件
        $('.nav-item').on('click', (e) => {
            e.preventDefault();
            const tabName = $(e.currentTarget).data('tab');
            this.switchTab(tabName);
        });

        // 退出登录按钮
        $('#logout-btn').on('click', () => {
            this.logout();
        });

        // 图表时间窗口选择
        $('#chart-timeframe').on('change', (e) => {
            this.updateRequestChart($(e.target).val());
        });

        // 模态框关闭事件
        $('.modal-close').on('click', (e) => {
            $(e.target).closest('.modal').removeClass('show');
        });

        // 点击模态框背景关闭
        $('.modal').on('click', (e) => {
            if (e.target === e.currentTarget) {
                $(e.target).removeClass('show');
            }
        });
    }

    /**
     * 切换标签页
     * @param {string} tabName - 标签页名称
     */
    switchTab(tabName) {
        // 更新导航状态
        $('.nav-item').removeClass('active');
        $(`.nav-item[data-tab="${tabName}"]`).addClass('active');

        // 更新内容区域
        $('.admin-tab-content').removeClass('active');
        $(`#${tabName}-tab`).addClass('active');

        this.currentTab = tabName;

        // 加载对应页面的数据
        this.loadTabData(tabName);
    }

    /**
     * 加载标签页数据
     * @param {string} tabName - 标签页名称
     */
    async loadTabData(tabName) {
        try {
            switch (tabName) {
                case 'dashboard':
                    await this.loadDashboardData();
                    break;
                case 'users':
                    if (window.userManagement) {
                        await window.userManagement.loadUsers();
                    } else {
                        console.error('UserManagement module not initialized');
                        this.showError('用户管理模块未初始化');
                    }
                    break;
                case 'storage':
                    await this.loadStorageData();
                    break;
                case 'stats':
                    await this.loadStatsData();
                    // 启动服务器统计页面的自动刷新
                    if (window.serverMonitor) {
                        window.serverMonitor.startAutoRefresh();
                        console.log('✅ 服务器统计自动刷新已启动');
                    } else {
                        // 如果ServerMonitor还没有初始化，延迟启动
                        setTimeout(() => {
                            if (window.serverMonitor) {
                                window.serverMonitor.startAutoRefresh();
                                console.log('✅ 服务器统计自动刷新已延迟启动');
                            }
                        }, 1000);
                    }
                    break;
                case 'system':
                    await this.loadSystemData();
                    break;
            }
        } catch (error) {
            console.error(`加载 ${tabName} 数据失败:`, error);
            this.showToast(`加载 ${tabName} 数据失败: ${error.message}`, 'error');
        }
    }

    /**
     * 加载仪表板数据
     */
    async loadDashboardData() {
        try {
            // 并行加载多个数据源
            const [overviewData, usersData, storageData] = await Promise.all([
                this.fetchAPI('/api/admin/stats'),
                this.fetchAPI('/api/admin/users?page=1&limit=1'),
                this.fetchAPI('/api/admin/storage')
            ]);

            // 调试：打印API响应结构
            console.debug('Dashboard API responses:', {
                overviewData: overviewData,
                usersData: usersData,
                storageData: storageData
            });
            
            // 调试内存信息
            if (overviewData.success && overviewData.data.systemInfo && overviewData.data.systemInfo.memoryUsage) {
                console.debug('Memory info from API:', overviewData.data.systemInfo.memoryUsage);
            }

            // 更新系统状态
            if (overviewData.success && overviewData.data.systemInfo) {
                const systemInfo = overviewData.data.systemInfo;
                $('#system-uptime').text(systemInfo.uptimeFormatted || '-');
                
                // 计算内存使用百分比
                if (systemInfo.memoryUsage) {
                    const memUsage = systemInfo.memoryUsage;
                    const heapPercentage = memUsage.heapTotal > 0 ? 
                        ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(1) : 0;
                    $('#memory-usage').text(heapPercentage + '%');
                } else {
                    $('#memory-usage').text('-');
                }
                
                // CPU核心数
                $('#cpu-cores').text(systemInfo.cpuCount || '-');
            } else {
                // 如果没有系统信息，显示默认值
                $('#system-uptime').text('-');
                $('#memory-usage').text('-');
                $('#cpu-cores').text('-');
            }

            // 更新用户统计
            if (usersData.success) {
                const summary = usersData.data.summary;
                $('#total-users').text(summary.totalUsers);
                $('#admin-users').text(summary.adminUsers);
                $('#enabled-users').text(summary.enabledUsers);
            }

            // 更新请求统计
            if (overviewData.success && overviewData.data.realTimeStats) {
                const realTimeStats = overviewData.data.realTimeStats;
                $('#current-requests').text(realTimeStats.currentMinuteRequests || 0);
                $('#recent-requests').text(realTimeStats.last5MinutesTotal || 0);
                $('#average-requests').text((realTimeStats.last10MinutesAverage || 0).toFixed(1));
            } else {
                // 如果没有实时统计数据，显示默认值
                $('#current-requests').text('0');
                $('#recent-requests').text('0');
                $('#average-requests').text('0.0');
            }

            // 更新存储统计
            if (storageData.success && storageData.data.summary) {
                const summary = storageData.data.summary;
                $('#total-storage').text(summary.totalStorageFormatted || '-');
                $('#average-storage').text(summary.averageStorageFormatted || '-');
            } else {
                $('#total-storage').text('-');
                $('#average-storage').text('-');
            }

            // 更新请求图表
            await this.updateRequestChart();

        } catch (error) {
            console.error('加载仪表板数据失败:', error);
            this.showToast('加载仪表板数据失败', 'error');
        }
    }

    /**
     * 更新请求统计图表
     * @param {string} timeframe - 时间窗口
     */
    async updateRequestChart(timeframe = '10') {
        try {
            const response = await this.fetchAPI(`/api/admin/stats?window=${timeframe}`);
            
            if (!response.success) {
                throw new Error(response.error);
            }

            // 处理统计数据并生成图表数据
            const statsData = response.data.requestStats;
            let timeSeries = [];
            
            if (statsData && typeof statsData === 'object') {
                // 如果是单个时间窗口的数据
                if (statsData.timeSeries) {
                    timeSeries = statsData.timeSeries;
                } 
                // 如果是所有时间窗口的数据，取指定的时间窗口
                else if (statsData.stats && statsData.stats[`${timeframe}min`]) {
                    timeSeries = statsData.stats[`${timeframe}min`].timeSeries || [];
                }
            }
            
            const ctx = document.getElementById('requests-chart');
            
            if (!ctx) return;

            const labels = timeSeries.map(point => point.time || '');
            const data = timeSeries.map(point => point.count || 0);

            // 如果图表不存在，创建新图表
            if (!this.requestChart) {
                this.requestChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'LLM请求数量',
                            data: data,
                            borderColor: '#007bff',
                            backgroundColor: 'rgba(0, 123, 255, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 3,
                            pointHoverRadius: 5
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: {
                            duration: 0 // 初始创建时不使用动画
                        },
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                mode: 'index',
                                intersect: false,
                            }
                        },
                        scales: {
                            x: {
                                display: true,
                                title: {
                                    display: true,
                                    text: '时间'
                                }
                            },
                            y: {
                                display: true,
                                title: {
                                    display: true,
                                    text: '请求数量'
                                },
                                beginAtZero: true
                            }
                        },
                        interaction: {
                            mode: 'nearest',
                            axis: 'x',
                            intersect: false
                        }
                    }
                });
                return;
            }

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
                
                // 使用平滑更新
                this.requestChart.update('active');
                
                console.debug(`图表已更新: ${hasNewDataPoint ? '新数据点' : '数据变化'}`);
            }

        } catch (error) {
            console.error('更新请求图表失败:', error);
        }
    }

    /**
     * 加载存储数据
     */
    async loadStorageData() {
        const container = $('#storage-content');
        container.html('<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> 正在计算存储使用情况...</div>');

        try {
            const response = await this.fetchAPI('/api/admin/storage');
            
            if (!response.success) {
                throw new Error(response.error);
            }

            const data = response.data;
            let html = `
                <div class="storage-summary">
                    <div class="dashboard-grid">
                        <div class="dashboard-card">
                            <div class="card-header">
                                <h3><i class="fas fa-database"></i> 存储概览</h3>
                            </div>
                            <div class="card-content">
                                <div class="status-item">
                                    <span class="status-label">总用户数:</span>
                                    <span class="status-value">${data.summary.totalUsers}</span>
                                </div>
                                <div class="status-item">
                                    <span class="status-label">总存储使用:</span>
                                    <span class="status-value">${data.summary.totalStorageFormatted}</span>
                                </div>
                                <div class="status-item">
                                    <span class="status-label">平均每用户:</span>
                                    <span class="status-value">${data.summary.averageStorageFormatted}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="storage-users">
                    <h3>用户存储详情</h3>
                    <div class="users-list">
            `;

            // 按存储使用量排序
            const sortedUsers = data.users.sort((a, b) => b.totalSize - a.totalSize);

            sortedUsers.forEach(user => {
                html += `
                    <div class="user-item">
                        <div class="user-info">
                            <div class="user-name">${user.userHandle}</div>
                            <div class="user-handle">最后计算: ${new Date(user.lastCalculated).toLocaleString('zh-CN')}</div>
                        </div>
                        <div class="user-storage">
                            <div class="storage-size">${user.totalSizeFormatted}</div>
                            ${user.error ? `<div class="error-text">${user.error}</div>` : ''}
                        </div>
                    </div>
                `;
            });

            html += '</div></div>';
            container.html(html);

        } catch (error) {
            container.html(`<div class="error-message">加载存储数据失败: ${error.message}</div>`);
        }
    }

    /**
     * 加载统计数据
     */
    async loadStatsData() {
        const container = $('#stats-content');
        container.html('<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> 加载统计数据...</div>');

        try {
            const response = await this.fetchAPI('/api/admin/stats');
            
            if (!response.success) {
                throw new Error(response.error);
            }

            const data = response.data;
            let html = `
                <div class="stats-overview">
                    <div class="dashboard-grid">
                        <div class="dashboard-card">
                            <div class="card-header">
                                <h3><i class="fas fa-chart-line"></i> 实时LLM请求统计</h3>
                            </div>
                            <div class="card-content">
                                <div class="status-item">
                                    <span class="status-label">当前分钟请求数:</span>
                                    <span class="status-value">${data.realTimeStats?.currentMinuteRequests || 0}</span>
                                </div>
                                <div class="status-item">
                                    <span class="status-label">最近5分钟总计:</span>
                                    <span class="status-value">${data.realTimeStats?.last5MinutesTotal || 0}</span>
                                </div>
                                <div class="status-item">
                                    <span class="status-label">最近10分钟平均:</span>
                                    <span class="status-value">${(data.realTimeStats?.last10MinutesAverage || 0).toFixed(2)}/分钟</span>
                                </div>
                                <div class="status-item">
                                    <span class="status-label">存储的数据点:</span>
                                    <span class="status-value">${data.realTimeStats?.dataPointsStored || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="stats-details">
                    <h3>各时间窗口统计</h3>
                    <div class="time-windows">
            `;

            // 显示各时间窗口的统计
            if (data.requestStats?.stats) {
                Object.entries(data.requestStats.stats).forEach(([window, stats]) => {
                    html += `
                        <div class="time-window-card">
                            <h4>${window}</h4>
                            <div class="window-stats">
                                <div class="stat-item">
                                    <span>总请求数:</span>
                                    <span>${stats.totalRequests || 0}</span>
                                </div>
                                <div class="stat-item">
                                    <span>平均每分钟:</span>
                                    <span>${(stats.averagePerMinute || 0).toFixed(2)}</span>
                                </div>
                                <div class="stat-item">
                                    <span>数据点:</span>
                                    <span>${stats.dataPoints || 0}</span>
                                </div>
                            </div>
                        </div>
                    `;
                });
            }

            html += `
                    </div>
                </div>
                <div class="stats-note">
                    <p><i class="fas fa-info-circle"></i> 统计数据每分钟更新一次，显示用户向LLM发送的请求次数</p>
                    <p>最后更新时间: ${new Date(data.timestamp).toLocaleString('zh-CN')}</p>
                </div>
            `;

            container.html(html);

        } catch (error) {
            container.html(`<div class="error-message">加载统计数据失败: ${error.message}</div>`);
        }
    }

    /**
     * 加载系统信息
     */
    async loadSystemData() {
        try {
            // 获取版本信息
            const versionResponse = await this.fetchAPI('/version');
            if (versionResponse) {
                $('#st-version').text(versionResponse.pkgVersion || '-');
                $('#git-branch').text(versionResponse.gitBranch || '-');
                $('#git-commit').text(versionResponse.gitRevision ? versionResponse.gitRevision.substring(0, 8) : '-');
            }

            // 获取服务器统计信息
            const statsResponse = await this.fetchAPI('/api/admin/stats');
            if (statsResponse.success && statsResponse.data.systemInfo) {
                const systemInfo = statsResponse.data.systemInfo;
                
                // 更新软件信息
                $('#node-version').text(systemInfo.nodeVersion || '-');
                
                // 更新硬件信息
                const platformName = {
                    'win32': 'Windows',
                    'linux': 'Linux',
                    'darwin': 'macOS',
                    'freebsd': 'FreeBSD'
                }[systemInfo.platform] || systemInfo.platform || '-';
                
                $('#os-info').text(`${platformName} ${systemInfo.arch || ''}`.trim() || '-');
                $('#cpu-arch').text(systemInfo.arch || '-');
                $('#cpu-cores').text(systemInfo.cpuCount || navigator.hardwareConcurrency || '-');
                
                if (systemInfo.memoryUsage) {
                    const memUsage = systemInfo.memoryUsage;
                    // 优先显示系统总内存和可用内存
                    if (memUsage.systemTotal && memUsage.systemFree) {
                        $('#total-memory').text(this.formatBytes(memUsage.systemTotal));
                        $('#free-memory').text(this.formatBytes(memUsage.systemFree));
                        console.log('系统内存信息:', {
                            total: this.formatBytes(memUsage.systemTotal),
                            free: this.formatBytes(memUsage.systemFree),
                            used: this.formatBytes(memUsage.systemUsed || 0)
                        });
                    } else {
                        // 如果没有系统内存信息，显示进程内存
                        $('#total-memory').text(this.formatBytes(memUsage.heapTotal || 0));
                        $('#free-memory').text(this.formatBytes((memUsage.heapTotal || 0) - (memUsage.heapUsed || 0)));
                        console.warn('系统内存信息不可用，显示进程内存');
                    }
                } else {
                    $('#total-memory').text('-');
                    $('#free-memory').text('-');
                    console.warn('内存信息完全不可用');
                }
                
                // 更新网络信息
                $('#listen-address').text(window.location.hostname || 'localhost');
                $('#listen-port').text(window.location.port || '8000');
                $('#https-enabled').text(window.location.protocol === 'https:' ? '是' : '否');
                
                // 更新配置信息
                if (systemInfo.config) {
                    $('#data-root').text(systemInfo.config.dataRoot || '-');
                    $('#whitelist-mode').text(systemInfo.config.whitelistMode ? '启用' : '禁用');
                    $('#csrf-protection').text(systemInfo.config.csrfProtection ? '启用' : '禁用');
                    $('#node-env').text(systemInfo.config.nodeEnv || 'production');
                    $('#auto-browser').text(systemInfo.config.basicAuthMode ? '启用' : '禁用');
                } else {
                    $('#data-root').text('-');
                    $('#whitelist-mode').text('-');
                    $('#csrf-protection').text('-');
                    $('#auto-browser').text('-');
                }
            } else {
                // 如果没有系统信息，显示默认值
                $('#node-version').text('-');
                $('#node-env').text('-');
                $('#os-info').text('-');
                $('#cpu-arch').text('-');
                $('#cpu-cores').text('-');
                $('#total-memory').text('-');
                $('#free-memory').text('-');
                $('#listen-address').text(window.location.hostname || 'localhost');
                $('#listen-port').text(window.location.port || '8000');
                $('#https-enabled').text(window.location.protocol === 'https:' ? '是' : '否');
                $('#data-root').text('-');
                $('#whitelist-mode').text('-');
                $('#csrf-protection').text('-');
                $('#auto-browser').text('-');
            }
        } catch (error) {
            console.error('加载系统信息失败:', error);
        }
    }

    /**
     * 原有的加载系统数据方法（保留兼容性）
     */
    async loadSystemDataOld() {
        const container = $('#system-content');
        container.html('<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> 加载系统信息...</div>');

        try {
            const response = await this.fetchAPI('/api/server-stats/system');
            
            if (!response.success) {
                throw new Error(response.error);
            }

            const data = response.data;
            let html = `
                <div class="system-info-grid">
                    <div class="dashboard-card">
                        <div class="card-header">
                            <h3><i class="fas fa-microchip"></i> CPU 信息</h3>
                        </div>
                        <div class="card-content">
                            <div class="status-item">
                                <span class="status-label">型号:</span>
                                <span class="status-value">${data.cpu.model}</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">核心数:</span>
                                <span class="status-value">${data.cpu.cores}</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">频率:</span>
                                <span class="status-value">${data.cpu.speed} MHz</span>
                            </div>
                        </div>
                    </div>

                    <div class="dashboard-card">
                        <div class="card-header">
                            <h3><i class="fas fa-memory"></i> 内存信息</h3>
                        </div>
                        <div class="card-content">
                            <div class="status-item">
                                <span class="status-label">总内存:</span>
                                <span class="status-value">${data.memory.totalFormatted}</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">已使用:</span>
                                <span class="status-value">${data.memory.usedFormatted} (${data.memory.usagePercentage}%)</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">可用:</span>
                                <span class="status-value">${data.memory.freeFormatted}</span>
                            </div>
                        </div>
                    </div>

                    <div class="dashboard-card">
                        <div class="card-header">
                            <h3><i class="fas fa-server"></i> 系统信息</h3>
                        </div>
                        <div class="card-content">
                            <div class="status-item">
                                <span class="status-label">操作系统:</span>
                                <span class="status-value">${data.system.platform}</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">架构:</span>
                                <span class="status-value">${data.system.arch}</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">主机名:</span>
                                <span class="status-value">${data.system.hostname}</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">系统运行时间:</span>
                                <span class="status-value">${data.system.uptimeFormatted}</span>
                            </div>
                        </div>
                    </div>

                    <div class="dashboard-card">
                        <div class="card-header">
                            <h3><i class="fab fa-node-js"></i> Node.js 进程</h3>
                        </div>
                        <div class="card-content">
                            <div class="status-item">
                                <span class="status-label">Node.js 版本:</span>
                                <span class="status-value">${data.process.nodeVersion}</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">进程 ID:</span>
                                <span class="status-value">${data.process.pid}</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">进程运行时间:</span>
                                <span class="status-value">${data.process.uptimeFormatted}</span>
                            </div>
                            <div class="status-item">
                                <span class="status-label">堆内存使用:</span>
                                <span class="status-value">${data.memory.process.heapUsedFormatted} / ${data.memory.process.heapTotalFormatted}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            container.html(html);

        } catch (error) {
            container.html(`<div class="error-message">加载系统信息失败: ${error.message}</div>`);
        }
    }

    /**
     * 加载当前用户信息
     */
    async loadCurrentUser() {
        try {
            // 这里可以添加获取当前用户信息的API调用
            // 暂时使用静态文本
            $('#current-user-name').text('管理员');
        } catch (error) {
            console.error('加载用户信息失败:', error);
        }
    }

    /**
     * 退出登录
     */
    logout() {
        if (confirm('确定要退出登录吗？')) {
            window.location.href = '/login';
        }
    }

    /**
     * 开始自动刷新
     */
    startAutoRefresh() {
        // 每30秒刷新一次仪表板数据
        this.refreshInterval = setInterval(() => {
            if (this.currentTab === 'dashboard') {
                this.loadDashboardData();
            }
        }, 30000);
        
        // 每2秒刷新一次请求统计图表
        this.chartRefreshInterval = setInterval(() => {
            if (this.currentTab === 'dashboard') {
                this.updateRequestChart();
            }
        }, 2000);
        
        console.log('✅ 自动刷新已启动: 仪表盘数据30秒刷新，图表2秒刷新');
    }

    /**
     * 停止自动刷新
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        if (this.chartRefreshInterval) {
            clearInterval(this.chartRefreshInterval);
            this.chartRefreshInterval = null;
        }
    }

    /**
     * 发送API请求
     * @param {string} url - API URL
     * @param {Object} options - 请求选项
     * @returns {Promise<Object>} API响应
     */
    async fetchAPI(url, options = {}) {
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        };

        const response = await fetch(url, defaultOptions);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * 显示提示消息
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 (success, error, warning, info)
     */
    showToast(message, type = 'info') {
        if (typeof toastr !== 'undefined') {
            toastr[type](message);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    /**
     * 格式化字节大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化的大小字符串
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 显示加载状态
     * @param {string} message - 加载消息
     */
    showLoading(message = '加载中...') {
        if (typeof toastr !== 'undefined') {
            toastr.info(message);
        }
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        if (typeof toastr !== 'undefined') {
            toastr.clear();
        }
    }

    /**
     * 显示成功消息
     * @param {string} message - 成功消息
     */
    showSuccess(message) {
        this.showToast(message, 'success');
    }

    /**
     * 显示错误消息
     * @param {string} message - 错误消息
     */
    showError(message) {
        this.showToast(message, 'error');
    }

    /**
     * 显示信息消息
     * @param {string} message - 信息消息
     */
    showInfo(message) {
        this.showToast(message, 'info');
    }
}

// 页面加载完成后初始化管理面板
$(document).ready(() => {
    window.adminPanel = new AdminPanel();
});