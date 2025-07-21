/**
 * 用户存储空间计算工具
 * 计算用户目录的存储使用情况
 */

import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

/**
 * 递归计算目录大小
 * @param {string} dirPath - 目录路径
 * @returns {Promise<number>} 目录大小（字节）
 */
async function calculateDirectorySize(dirPath) {
    let totalSize = 0;

    try {
        const stats = await stat(dirPath);
        
        if (stats.isFile()) {
            return stats.size;
        }

        if (stats.isDirectory()) {
            const files = await readdir(dirPath);
            
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                try {
                    totalSize += await calculateDirectorySize(filePath);
                } catch (error) {
                    // 忽略无法访问的文件/目录
                    console.warn(`无法访问文件: ${filePath}`, error.message);
                }
            }
        }
    } catch (error) {
        // 目录不存在或无法访问
        console.warn(`无法访问目录: ${dirPath}`, error.message);
        return 0;
    }

    return totalSize;
}

/**
 * 计算用户存储使用情况
 * @param {string} userHandle - 用户句柄
 * @param {string} dataRoot - 数据根目录
 * @returns {Promise<Object>} 存储使用情况详情
 */
export async function calculateUserStorage(userHandle, dataRoot) {
    const userDataPath = path.join(dataRoot, userHandle);
    
    const storageInfo = {
        userHandle,
        totalSize: 0,
        breakdown: {
            characters: 0,
            chats: 0,
            groups: 0,
            worlds: 0,
            backgrounds: 0,
            avatars: 0,
            themes: 0,
            instruct: 0,
            context: 0,
            quickreplies: 0,
            assets: 0,
            user: 0,
            extensions: 0,
            vectors: 0,
            thumbnails: 0,
            sysprompt: 0,
            reasoning: 0,
            other: 0
        },
        lastCalculated: new Date().toISOString()
    };

    try {
        // 检查用户目录是否存在
        const userStats = await stat(userDataPath);
        if (!userStats.isDirectory()) {
            return storageInfo;
        }

        // 计算各个子目录的大小
        const subdirectories = [
            { name: 'characters', key: 'characters' },
            { name: 'chats', key: 'chats' },
            { name: 'groups', key: 'groups' },
            { name: 'worlds', key: 'worlds' },
            { name: 'backgrounds', key: 'backgrounds' },
            { name: 'User Avatars', key: 'avatars' },
            { name: 'themes', key: 'themes' },
            { name: 'instruct', key: 'instruct' },
            { name: 'context', key: 'context' },
            { name: 'QuickReplies', key: 'quickreplies' },
            { name: 'assets', key: 'assets' },
            { name: 'user', key: 'user' },
            { name: 'extensions', key: 'extensions' },
            { name: 'vectors', key: 'vectors' },
            { name: 'thumbnails', key: 'thumbnails' },
            { name: 'sysprompt', key: 'sysprompt' },
            { name: 'reasoning', key: 'reasoning' }
        ];

        for (const subdir of subdirectories) {
            const subdirPath = path.join(userDataPath, subdir.name);
            try {
                storageInfo.breakdown[subdir.key] = await calculateDirectorySize(subdirPath);
            } catch (error) {
                // 如果目录不存在，设置为0而不是报错
                console.debug(`目录不存在，跳过: ${subdirPath}`);
                storageInfo.breakdown[subdir.key] = 0;
            }
        }

        // 计算其他文件的大小
        try {
            const files = await readdir(userDataPath);
            for (const file of files) {
                const filePath = path.join(userDataPath, file);
                try {
                    const fileStats = await stat(filePath);
                    
                    if (fileStats.isFile()) {
                        storageInfo.breakdown.other += fileStats.size;
                    } else if (fileStats.isDirectory()) {
                        // 如果是未在上面列表中的目录，计入other
                        const isKnownDir = subdirectories.some(subdir => subdir.name === file);
                        if (!isKnownDir) {
                            storageInfo.breakdown.other += await calculateDirectorySize(filePath);
                        }
                    }
                } catch (error) {
                    console.debug(`无法访问文件/目录: ${filePath}`, error.message);
                }
            }
        } catch (error) {
            console.debug(`无法读取用户目录: ${userDataPath}`, error.message);
        }

        // 计算总大小
        storageInfo.totalSize = Object.values(storageInfo.breakdown).reduce((sum, size) => sum + size, 0);

    } catch (error) {
        console.error(`计算用户 ${userHandle} 存储空间时出错:`, error);
    }

    return storageInfo;
}

/**
 * 格式化字节大小为人类可读格式
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小字符串
 */
export function formatBytes(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 批量计算多个用户的存储使用情况
 * @param {string[]} userHandles - 用户句柄数组
 * @param {string} dataRoot - 数据根目录
 * @returns {Promise<Object[]>} 所有用户的存储使用情况
 */
export async function calculateMultipleUsersStorage(userHandles, dataRoot) {
    const results = [];
    
    for (const userHandle of userHandles) {
        try {
            const storageInfo = await calculateUserStorage(userHandle, dataRoot);
            results.push(storageInfo);
        } catch (error) {
            console.error(`计算用户 ${userHandle} 存储空间失败:`, error);
            results.push({
                userHandle,
                totalSize: 0,
                breakdown: {},
                error: error.message,
                lastCalculated: new Date().toISOString()
            });
        }
    }
    
    return results;
}