/**
 * 管理员权限验证中间件
 * 确保只有管理员用户可以访问管理面板相关功能
 */

import path from 'node:path';

/**
 * 验证用户是否具有管理员权限的中间件
 * @param {import('express').Request} req - Express请求对象
 * @param {import('express').Response} res - Express响应对象
 * @param {import('express').NextFunction} next - Express下一个中间件函数
 * @returns {void}
 */
export function requireAdminMiddleware(req, res, next) {
    // 检查用户是否已登录
    if (!req.user || !req.user.profile) {
        return res.status(401).json({ 
            error: '需要登录才能访问此功能',
            code: 'UNAUTHORIZED' 
        });
    }

    // 检查用户是否具有管理员权限
    if (!req.user.profile.admin) {
        console.warn(`非管理员用户尝试访问管理功能: ${req.user.profile.handle} - ${req.originalUrl}`);
        return res.status(403).json({ 
            error: '需要管理员权限才能访问此功能',
            code: 'FORBIDDEN' 
        });
    }

    // 用户具有管理员权限，继续处理请求
    next();
}

/**
 * 验证管理面板页面访问权限的中间件
 * @param {import('express').Request} req - Express请求对象
 * @param {import('express').Response} res - Express响应对象
 * @param {import('express').NextFunction} next - Express下一个中间件函数
 * @returns {void}
 */
export function adminPageMiddleware(req, res, next) {
    // 检查用户是否已登录
    if (!req.user || !req.user.profile) {
        // 重定向到登录页面
        return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
    }

    // 检查用户是否具有管理员权限
    if (!req.user.profile.admin) {
        // 返回403禁止访问页面
        return res.status(403).sendFile('forbidden-by-whitelist.html', { 
            root: path.join(process.cwd(), 'public/error') 
        });
    }

    // 用户具有管理员权限，继续处理请求
    next();
}