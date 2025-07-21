/**
 * 用户管理模块
 * 处理用户列表、用户操作等功能
 */

class UserManagement {
    constructor(adminPanel) {
        this.adminPanel = adminPanel;
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalUsers = 0;
        this.users = [];
        this.filteredUsers = [];
        this.currentFilter = 'all';
        this.searchQuery = '';
        
        this.initializeEventListeners();
    }

    /**
     * 初始化事件监听器
     */
    initializeEventListeners() {
        // 搜索功能
        $('#user-search').on('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.filterAndDisplayUsers();
        });

        // 用户类型过滤
        $('#user-filter').on('change', (e) => {
            this.currentFilter = e.target.value;
            this.filterAndDisplayUsers();
        });

        // 刷新用户列表
        $('#refresh-users-btn').on('click', () => {
            this.loadUsers();
        });

        // 批量操作
        $('#bulk-action-btn').on('click', () => {
            this.handleBulkAction();
        });

        // 全选/取消全选
        $(document).on('change', '#select-all-users', (e) => {
            $('.user-checkbox').prop('checked', e.target.checked);
            this.updateBulkActionButton();
        });

        // 单个用户选择
        $(document).on('change', '.user-checkbox', () => {
            this.updateBulkActionButton();
        });

        // 用户操作按钮
        $(document).on('click', '.user-action-btn', (e) => {
            const action = e.target.dataset.action;
            const userHandle = e.target.dataset.userHandle;
            this.handleUserAction(action, userHandle);
        });

        // 分页
        $(document).on('click', '.pagination-btn', (e) => {
            const page = parseInt(e.target.dataset.page);
            if (page && page !== this.currentPage) {
                this.currentPage = page;
                this.displayUsers();
            }
        });
    }

    /**
     * 加载用户列表
     */
    async loadUsers() {
        try {
            // 显示加载状态
            $('#users-loading').show();
            $('#users-container').hide();
            this.adminPanel.showLoading('正在加载用户列表...');
            
            const response = await this.adminPanel.fetchAPI('/api/admin/users?includeStorage=true');
            console.log('API Response:', response); // 调试日志
            
            if (response && response.success) {
                this.users = response.data.users || [];
                this.totalUsers = response.data.summary.totalUsers || 0;
                this.filterAndDisplayUsers();
                this.updateUserStats(response.data.summary);
                console.log('用户数据加载成功:', this.users.length, '个用户');
            } else {
                throw new Error(response?.error || '加载用户列表失败');
            }
        } catch (error) {
            console.error('加载用户列表失败:', error);
            this.adminPanel.showError('加载用户列表失败: ' + error.message);
            
            // 显示错误状态
            $('#users-container').html(`
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>加载用户列表失败: ${error.message}</p>
                    <button class="btn btn-primary" onclick="window.userManagement.loadUsers()">重试</button>
                </div>
            `);
        } finally {
            // 隐藏加载状态
            $('#users-loading').hide();
            $('#users-container').show();
            this.adminPanel.hideLoading();
        }
    }

    /**
     * 过滤和显示用户
     */
    filterAndDisplayUsers() {
        // 应用过滤器
        this.filteredUsers = this.users.filter(user => {
            // 类型过滤
            if (this.currentFilter === 'admin' && !user.admin) return false;
            if (this.currentFilter === 'regular' && user.admin) return false;
            
            // 搜索过滤
            if (this.searchQuery) {
                const searchLower = this.searchQuery.toLowerCase();
                return user.handle.toLowerCase().includes(searchLower) ||
                       user.name.toLowerCase().includes(searchLower);
            }
            
            return true;
        });

        this.currentPage = 1; // 重置到第一页
        this.displayUsers();
    }

    /**
     * 显示用户列表
     */
    displayUsers() {
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pageUsers = this.filteredUsers.slice(startIndex, endIndex);

        const usersList = $('#users-container');
        usersList.empty();

        if (pageUsers.length === 0) {
            usersList.html(`
                <div class="no-users-message">
                    <i class="fas fa-users"></i>
                    <p>没有找到符合条件的用户</p>
                </div>
            `);
            return;
        }

        // 生成用户列表HTML
        const usersHtml = pageUsers.map(user => this.generateUserRow(user)).join('');
        usersList.html(`
            <div class="users-table-container">
                <table class="users-table">
                    <thead>
                        <tr>
                            <th>
                                <input type="checkbox" id="select-all-users">
                            </th>
                            <th>头像</th>
                            <th>用户名</th>
                            <th>显示名称</th>
                            <th>角色</th>
                            <th>注册时间</th>
                            <th>最后在线</th>
                            <th>存储使用</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${usersHtml}
                    </tbody>
                </table>
            </div>
        `);

        // 生成分页
        this.generatePagination();
        
        // 更新批量操作按钮状态
        this.updateBulkActionButton();
    }

    /**
     * 生成用户行HTML
     */
    generateUserRow(user) {
        const avatarUrl = user.avatar || '/img/No-Image-Placeholder.svg';
        const roleBadge = user.admin ? 
            '<span class="user-badge admin"><i class="fas fa-crown"></i> 管理员</span>' :
            '<span class="user-badge regular">普通用户</span>';
        
        const storageInfo = user.storage ? 
            this.adminPanel.formatBytes(user.storage.totalSize) : '计算中...';
        
        const lastOnline = user.lastOnline ? 
            new Date(user.lastOnline).toLocaleString('zh-CN') : '从未登录';
        
        const createdDate = user.created ? 
            new Date(user.created).toLocaleString('zh-CN') : '未知';

        return `
            <tr class="user-row" data-user-handle="${user.handle}">
                <td>
                    <input type="checkbox" class="user-checkbox" value="${user.handle}">
                </td>
                <td>
                    <img src="${avatarUrl}" alt="${user.name}" class="user-avatar" 
                         onerror="this.src='/img/No-Image-Placeholder.svg'">
                </td>
                <td class="user-handle">${user.handle}</td>
                <td class="user-name">${user.name || user.handle}</td>
                <td>${roleBadge}</td>
                <td class="user-created">${createdDate}</td>
                <td class="user-last-online">${lastOnline}</td>
                <td class="user-storage">${storageInfo}</td>
                <td class="user-actions">
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-info user-action-btn" 
                                data-action="view" data-user-handle="${user.handle}"
                                title="查看详情">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${!user.admin ? `
                            <button class="btn btn-sm btn-warning user-action-btn" 
                                    data-action="toggle-admin" data-user-handle="${user.handle}"
                                    title="设为管理员">
                                <i class="fas fa-user-shield"></i>
                            </button>
                        ` : `
                            <button class="btn btn-sm btn-secondary user-action-btn" 
                                    data-action="toggle-admin" data-user-handle="${user.handle}"
                                    title="取消管理员">
                                <i class="fas fa-user-minus"></i>
                            </button>
                        `}
                        <button class="btn btn-sm btn-danger user-action-btn" 
                                data-action="delete" data-user-handle="${user.handle}"
                                title="删除用户">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * 生成分页控件
     */
    generatePagination() {
        const totalPages = Math.ceil(this.filteredUsers.length / this.pageSize);
        
        if (totalPages <= 1) {
            $('#users-pagination').empty();
            return;
        }

        let paginationHtml = '<div class="pagination-container"><div class="pagination">';
        
        // 上一页按钮
        if (this.currentPage > 1) {
            paginationHtml += `<button class="pagination-btn" data-page="${this.currentPage - 1}">上一页</button>`;
        }
        
        // 页码按钮
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);
        
        if (startPage > 1) {
            paginationHtml += `<button class="pagination-btn" data-page="1">1</button>`;
            if (startPage > 2) {
                paginationHtml += `<span class="pagination-ellipsis">...</span>`;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === this.currentPage ? 'active' : '';
            paginationHtml += `<button class="pagination-btn ${activeClass}" data-page="${i}">${i}</button>`;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHtml += `<span class="pagination-ellipsis">...</span>`;
            }
            paginationHtml += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
        }
        
        // 下一页按钮
        if (this.currentPage < totalPages) {
            paginationHtml += `<button class="pagination-btn" data-page="${this.currentPage + 1}">下一页</button>`;
        }
        
        paginationHtml += '</div></div>';
        
        $('#users-pagination').html(paginationHtml);
    }

    /**
     * 更新用户统计信息
     */
    updateUserStats(summary) {
        $('#total-users').text(summary.totalUsers);
        $('#admin-users').text(summary.adminUsers);
        $('#regular-users').text(summary.totalUsers - summary.adminUsers);
    }

    /**
     * 更新批量操作按钮状态
     */
    updateBulkActionButton() {
        const selectedUsers = $('.user-checkbox:checked').length;
        const bulkBtn = $('#bulk-action-btn');
        
        if (selectedUsers > 0) {
            bulkBtn.prop('disabled', false).text(`批量操作 (${selectedUsers})`);
        } else {
            bulkBtn.prop('disabled', true).text('批量操作');
        }
    }

    /**
     * 处理用户操作
     */
    async handleUserAction(action, userHandle) {
        const user = this.users.find(u => u.handle === userHandle);
        if (!user) {
            this.adminPanel.showError('用户不存在');
            return;
        }

        switch (action) {
            case 'view':
                this.showUserDetails(user);
                break;
            case 'toggle-admin':
                await this.toggleUserAdmin(user);
                break;
            case 'delete':
                await this.deleteUser(user);
                break;
        }
    }

    /**
     * 显示用户详情
     */
    async showUserDetails(user) {
        try {
            // 获取用户详细信息
            const response = await this.adminPanel.fetchAPI(`/api/admin/users/${user.handle}`);
            
            if (!response.success) {
                throw new Error(response.error || '获取用户详情失败');
            }
            
            const userDetails = response.data;
            
            this.displayUserDetailsModal(userDetails);
        } catch (error) {
            console.error('获取用户详情失败:', error);
            this.adminPanel.showError('获取用户详情失败: ' + error.message);
        }
    }
    
    /**
     * 显示用户详情模态框
     */
    displayUserDetailsModal(user) {
        const modalHtml = `
            <div class="modal-overlay" id="user-details-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-user"></i> 用户详情</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="user-details-grid">
                            <div class="user-avatar-section">
                                <img src="${user.avatar || '/img/No-Image-Placeholder.svg'}" 
                                     alt="${user.name}" class="user-details-avatar">
                            </div>
                            <div class="user-info-section">
                                <div class="info-row">
                                    <label>用户名:</label>
                                    <span>${user.handle}</span>
                                </div>
                                <div class="info-row">
                                    <label>显示名称:</label>
                                    <span>${user.name || user.handle}</span>
                                </div>
                                <div class="info-row">
                                    <label>角色:</label>
                                    <span>${user.admin ? '管理员' : '普通用户'}</span>
                                </div>
                                <div class="info-row">
                                    <label>注册时间:</label>
                                    <span>${user.created ? new Date(user.created).toLocaleString('zh-CN') : '未知'}</span>
                                </div>
                                <div class="info-row">
                                    <label>最后在线:</label>
                                    <span>${user.lastOnline ? new Date(user.lastOnline).toLocaleString('zh-CN') : '从未登录'}</span>
                                </div>
                                <div class="info-row">
                                    <label>存储使用:</label>
                                    <span>${user.storage ? this.adminPanel.formatBytes(user.storage.totalSize) : '计算中...'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary modal-close">关闭</button>
                    </div>
                </div>
            </div>
        `;

        $('body').append(modalHtml);
        
        // 绑定关闭事件
        $('.modal-close, .modal-overlay').on('click', (e) => {
            if (e.target === e.currentTarget) {
                $('#user-details-modal').remove();
            }
        });
    }

    /**
     * 切换用户管理员状态
     */
    async toggleUserAdmin(user) {
        const action = user.admin ? '取消管理员权限' : '设为管理员';
        
        if (!confirm(`确定要${action}用户 "${user.handle}" 吗？`)) {
            return;
        }

        try {
            this.adminPanel.showLoading(`正在${action}...`);
            
            const endpoint = user.admin ? '/api/admin/disable' : '/api/admin/enable';
            const response = await this.adminPanel.fetchAPI(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ handle: user.handle })
            });

            if (response.success || response.message) {
                this.adminPanel.showSuccess(`${action}成功`);
                await this.loadUsers(); // 重新加载用户列表
            } else {
                throw new Error(response.error || `${action}失败`);
            }
        } catch (error) {
            console.error(`${action}失败:`, error);
            this.adminPanel.showError(`${action}失败: ` + error.message);
        } finally {
            this.adminPanel.hideLoading();
        }
    }

    /**
     * 删除用户
     */
    async deleteUser(user) {
        if (user.admin) {
            this.adminPanel.showError('不能删除管理员用户');
            return;
        }

        const confirmText = `删除用户 "${user.handle}"`;
        if (!confirm(`确定要${confirmText}吗？此操作不可撤销！\n\n请在下方输入用户名确认:`)) {
            return;
        }

        const inputHandle = prompt(`请输入用户名 "${user.handle}" 以确认删除:`);
        if (inputHandle !== user.handle) {
            this.adminPanel.showError('用户名不匹配，删除操作已取消');
            return;
        }

        try {
            this.adminPanel.showLoading('正在删除用户...');
            
            const response = await this.adminPanel.fetchAPI(`/api/admin/users/${user.handle}`, {
                method: 'DELETE'
            });

            if (response.success) {
                this.adminPanel.showSuccess('用户删除成功');
                await this.loadUsers(); // 重新加载用户列表
            } else {
                throw new Error(response.error || '删除用户失败');
            }
        } catch (error) {
            console.error('删除用户失败:', error);
            this.adminPanel.showError('删除用户失败: ' + error.message);
        } finally {
            this.adminPanel.hideLoading();
        }
    }

    /**
     * 处理批量操作
     */
    async handleBulkAction() {
        const selectedHandles = $('.user-checkbox:checked').map((_, el) => el.value).get();
        
        if (selectedHandles.length === 0) {
            this.adminPanel.showError('请选择要操作的用户');
            return;
        }

        // 显示批量操作菜单
        const menuHtml = `
            <div class="bulk-action-menu">
                <button class="bulk-action-item" data-action="export">导出用户数据</button>
                <button class="bulk-action-item" data-action="disable">批量禁用</button>
                <button class="bulk-action-item danger" data-action="delete">批量删除</button>
            </div>
        `;

        // 这里可以实现批量操作的具体逻辑
        this.adminPanel.showInfo(`已选择 ${selectedHandles.length} 个用户，批量操作功能开发中...`);
    }
}

// 导出模块
window.UserManagement = UserManagement;