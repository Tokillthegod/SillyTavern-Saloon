import path from 'node:path';
import { promises as fsPromises } from 'node:fs';
import crypto from 'node:crypto';

import storage from 'node-persist';
import express from 'express';
import multer from 'multer';

import { getUserAvatar, toKey, getPasswordHash, getPasswordSalt, createBackupArchive, restoreBackupArchive, ensurePublicDirectoriesExist, toAvatarKey } from '../users.js';
import { SETTINGS_FILE, UPLOADS_DIRECTORY } from '../constants.js';
import { checkForNewContent, CONTENT_TYPES } from './content-manager.js';
import { color, Cache } from '../util.js';

const RESET_CACHE = new Cache(5 * 60 * 1000);

// Configure multer for backup file uploads
const uploadsPath = path.join(globalThis.DATA_ROOT, UPLOADS_DIRECTORY);
const backupUpload = multer({ 
    dest: uploadsPath, 
    limits: { 
        fieldSize: 50 * 1024 * 1024, // 50MB field size limit
        fileSize: 500 * 1024 * 1024, // 500MB file size limit
        files: 1, // Only allow 1 file
        fields: 10, // Allow multiple fields
        parts: 100 // Allow more parts
    },
    fileFilter: (req, file, cb) => {
        // Accept zip files
        if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
            cb(null, true);
        } else {
            cb(new Error('Only ZIP files are allowed'), false);
        }
    }
});

export const router = express.Router();

router.post('/logout', async (request, response) => {
    try {
        if (!request.session) {
            console.error('Session not available');
            return response.sendStatus(500);
        }

        request.session.handle = null;
        request.session.csrfToken = null;
        request.session = null;
        return response.sendStatus(204);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.get('/me', async (request, response) => {
    try {
        if (!request.user) {
            return response.sendStatus(403);
        }

        const user = request.user.profile;
        const viewModel = {
            handle: user.handle,
            name: user.name,
            avatar: await getUserAvatar(user.handle),
            admin: user.admin,
            password: !!user.password,
            created: user.created,
        };

        return response.json(viewModel);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/change-avatar', async (request, response) => {
    try {
        if (!request.body.handle) {
            console.warn('Change avatar failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        if (request.body.handle !== request.user.profile.handle && !request.user.profile.admin) {
            console.error('Change avatar failed: Unauthorized');
            return response.status(403).json({ error: 'Unauthorized' });
        }

        // Avatar is not a data URL or not an empty string
        if (!request.body.avatar.startsWith('data:image/') && request.body.avatar !== '') {
            console.warn('Change avatar failed: Invalid data URL');
            return response.status(400).json({ error: 'Invalid data URL' });
        }

        /** @type {import('../users.js').User} */
        const user = await storage.getItem(toKey(request.body.handle));

        if (!user) {
            console.error('Change avatar failed: User not found');
            return response.status(404).json({ error: 'User not found' });
        }

        await storage.setItem(toAvatarKey(request.body.handle), request.body.avatar);

        return response.sendStatus(204);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/change-password', async (request, response) => {
    try {
        if (!request.body.handle) {
            console.warn('Change password failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        if (request.body.handle !== request.user.profile.handle && !request.user.profile.admin) {
            console.error('Change password failed: Unauthorized');
            return response.status(403).json({ error: 'Unauthorized' });
        }

        /** @type {import('../users.js').User} */
        const user = await storage.getItem(toKey(request.body.handle));

        if (!user) {
            console.error('Change password failed: User not found');
            return response.status(404).json({ error: 'User not found' });
        }

        if (!user.enabled) {
            console.error('Change password failed: User is disabled');
            return response.status(403).json({ error: 'User is disabled' });
        }

        if (!request.user.profile.admin && user.password && user.password !== getPasswordHash(request.body.oldPassword, user.salt)) {
            console.error('Change password failed: Incorrect password');
            return response.status(403).json({ error: 'Incorrect password' });
        }

        if (request.body.newPassword) {
            const salt = getPasswordSalt();
            user.password = getPasswordHash(request.body.newPassword, salt);
            user.salt = salt;
        } else {
            user.password = '';
            user.salt = '';
        }

        await storage.setItem(toKey(request.body.handle), user);
        return response.sendStatus(204);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/backup', async (request, response) => {
    try {
        const handle = request.body.handle;

        if (!handle) {
            console.warn('Backup failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        if (handle !== request.user.profile.handle && !request.user.profile.admin) {
            console.error('Backup failed: Unauthorized');
            return response.status(403).json({ error: 'Unauthorized' });
        }

        await createBackupArchive(handle, response);
    } catch (error) {
        console.error('Backup failed', error);
        return response.sendStatus(500);
    }
});

router.post('/restore-backup', (request, response) => {
    // Handle multer upload with custom error handling
    backupUpload.single('file')(request, response, async (err) => {
        try {
            if (err) {
                console.error('Multer error:', err);
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return response.status(400).json({ error: 'File too large. Maximum size is 500MB.' });
                } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                    return response.status(400).json({ error: 'Unexpected file field.' });
                } else {
                    return response.status(400).json({ error: err.message || 'File upload error' });
                }
            }

            console.log('Restore backup request received');
            console.log('Request body:', request.body);
            console.log('Request file:', request.file ? { 
                filename: request.file.filename, 
                originalname: request.file.originalname,
                size: request.file.size, 
                mimetype: request.file.mimetype 
            } : 'No file');

            const handle = request.body.handle || request.user.profile.handle;

            if (handle !== request.user.profile.handle && !request.user.profile.admin) {
                console.error('Restore backup failed: Unauthorized');
                return response.status(403).json({ error: 'Unauthorized' });
            }

            if (!request.file) {
                console.warn('Restore backup failed: No file uploaded');
                return response.status(400).json({ error: 'No backup file provided' });
            }

            console.log('Starting backup restore for handle:', handle);
            await restoreBackupArchive(handle, request.file.path);
            console.log('Backup restore completed successfully');
            return response.sendStatus(204);
        } catch (error) {
            console.error('Restore backup failed', error);
            return response.status(500).json({ error: error.message || 'Failed to restore backup' });
        }
    });
});

router.post('/reset-settings', async (request, response) => {
    try {
        const password = request.body.password;

        if (request.user.profile.password && request.user.profile.password !== getPasswordHash(password, request.user.profile.salt)) {
            console.warn('Reset settings failed: Incorrect password');
            return response.status(403).json({ error: 'Incorrect password' });
        }

        const pathToFile = path.join(request.user.directories.root, SETTINGS_FILE);
        await fsPromises.rm(pathToFile, { force: true });
        await checkForNewContent([request.user.directories], [CONTENT_TYPES.SETTINGS]);

        return response.sendStatus(204);
    } catch (error) {
        console.error('Reset settings failed', error);
        return response.sendStatus(500);
    }
});

router.post('/change-name', async (request, response) => {
    try {
        if (!request.body.name || !request.body.handle) {
            console.warn('Change name failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        if (request.body.handle !== request.user.profile.handle && !request.user.profile.admin) {
            console.error('Change name failed: Unauthorized');
            return response.status(403).json({ error: 'Unauthorized' });
        }

        /** @type {import('../users.js').User} */
        const user = await storage.getItem(toKey(request.body.handle));

        if (!user) {
            console.warn('Change name failed: User not found');
            return response.status(404).json({ error: 'User not found' });
        }

        user.name = request.body.name;
        await storage.setItem(toKey(request.body.handle), user);

        return response.sendStatus(204);
    } catch (error) {
        console.error('Change name failed', error);
        return response.sendStatus(500);
    }
});

router.post('/reset-step1', async (request, response) => {
    try {
        const resetCode = String(crypto.randomInt(1000, 9999));
        console.log();
        console.log(color.magenta(`${request.user.profile.name}, your account reset code is: `) + color.red(resetCode));
        console.log();
        RESET_CACHE.set(request.user.profile.handle, resetCode);
        return response.sendStatus(204);
    } catch (error) {
        console.error('Recover step 1 failed:', error);
        return response.sendStatus(500);
    }
});

router.post('/reset-step2', async (request, response) => {
    try {
        if (!request.body.code) {
            console.warn('Recover step 2 failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        if (request.user.profile.password && request.user.profile.password !== getPasswordHash(request.body.password, request.user.profile.salt)) {
            console.warn('Recover step 2 failed: Incorrect password');
            return response.status(400).json({ error: 'Incorrect password' });
        }

        const code = RESET_CACHE.get(request.user.profile.handle);

        if (!code || code !== request.body.code) {
            console.warn('Recover step 2 failed: Incorrect code');
            return response.status(400).json({ error: 'Incorrect code' });
        }

        console.info('Resetting account data:', request.user.profile.handle);
        await fsPromises.rm(request.user.directories.root, { recursive: true, force: true });

        await ensurePublicDirectoriesExist();
        await checkForNewContent([request.user.directories]);

        RESET_CACHE.remove(request.user.profile.handle);
        return response.sendStatus(204);
    } catch (error) {
        console.error('Recover step 2 failed:', error);
        return response.sendStatus(500);
    }
});

router.post('/set-security-question', async (request, response) => {
    try {
        if (!request.body.securityQuestion || !request.body.securityAnswer || !request.body.password) {
            console.warn('Set security question failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        // Verify current password
        if (request.user.profile.password && request.user.profile.password !== getPasswordHash(request.body.password, request.user.profile.salt)) {
            console.warn('Set security question failed: Incorrect password');
            return response.status(400).json({ error: 'Incorrect password' });
        }

        // Hash the security answer
        const securityAnswer = getPasswordHash(request.body.securityAnswer.toLowerCase().trim(), request.user.profile.salt);

        // Update user profile
        const updatedUser = {
            ...request.user.profile,
            securityQuestion: request.body.securityQuestion,
            securityAnswer: securityAnswer,
        };

        await storage.setItem(toKey(request.user.profile.handle), updatedUser);
        console.info('Security question set for user:', request.user.profile.handle);
        
        return response.sendStatus(204);
    } catch (error) {
        console.error('Set security question failed:', error);
        return response.sendStatus(500);
    }
});

router.get('/get-security-question', async (request, response) => {
    try {
        const user = request.user.profile;
        
        return response.json({
            hasSecurityQuestion: !!user.securityQuestion,
            securityQuestion: user.securityQuestion || null,
        });
    } catch (error) {
        console.error('Get security question failed:', error);
        return response.sendStatus(500);
    }
});
