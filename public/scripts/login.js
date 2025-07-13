/**
 * CRSF token for requests.
 */
let csrfToken = '';
let discreetLogin = false;

/**
 * Gets a CSRF token from the server.
 * @returns {Promise<string>} CSRF token
 */
async function getCsrfToken() {
    const response = await fetch('/csrf-token');
    const data = await response.json();
    return data.token;
}

/**
 * Gets a list of users from the server.
 * @returns {Promise<object>} List of users
 */
async function getUserList() {
    const response = await fetch('/api/users/list', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
    });

    if (!response.ok) {
        const errorData = await response.json();
        return displayError(errorData.error || 'An error occurred');
    }

    if (response.status === 204) {
        discreetLogin = true;
        return [];
    }

    const userListObj = await response.json();
    console.log(userListObj);
    return userListObj;
}

/**
 * Registers a new user.
 * @param {string} name Display name
 * @param {string} handle User handle
 * @param {string} password Password
 * @param {string} confirmPassword Confirm password
 * @returns {Promise<void>}
 */
async function registerUser(name, handle, password, confirmPassword) {
    const response = await fetch('/api/users/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
            name: name,
            handle: handle,
            password: password,
            confirmPassword: confirmPassword,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        return displayError(errorData.error || 'Registration failed');
    }

    const data = await response.json();
    const successMessage = window.t ? window.t('Registration successful! You can now login with your new account.') : 'Registration successful! You can now login with your new account.';
    displayError(successMessage, false);
    
    // Clear registration form
    $('#registerName').val('');
    $('#registerHandle').val('');
    $('#registerPassword').val('');
    $('#registerConfirmPassword').val('');
    
    // Switch back to appropriate login view
    $('#registerBlock').hide();
    if (discreetLogin) {
        $('#handleEntryBlock').show();
        $('#userHandle').val(data.handle);
    } else {
        $('#userList').show();
        $('#normalLoginPrompt').show();
        // Refresh the page to show the new user in the list
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    }
}

/**
 * Requests a recovery code for the user.
 * @param {string} handle User handle
 * @returns {Promise<void>}
 */
async function sendRecoveryPart1(handle) {
    const response = await fetch('/api/users/recover-step1', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ handle }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        return displayError(errorData.error || 'An error occurred');
    }

    showRecoveryBlock();
}

/**
 * Sets a new password for the user using the recovery code.
 * @param {string} handle User handle
 * @param {string} code Recovery code
 * @param {string} newPassword New password
 * @returns {Promise<void>}
 */
async function sendRecoveryPart2(handle, code, newPassword) {
    const recoveryData = {
        handle,
        code,
        newPassword,
    };

    const response = await fetch('/api/users/recover-step2', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(recoveryData),
    });

    if (!response.ok) {
        const errorData = await response.json();
        return displayError(errorData.error || 'An error occurred');
    }

    console.log(`Successfully recovered password for ${handle}!`);
    await performLogin(handle, newPassword);
}

/**
 * Attempts to log in the user.
 * @param {string} handle User's handle
 * @param {string} password User's password
 * @returns {Promise<void>}
 */
async function performLogin(handle, password) {
    const userInfo = {
        handle: handle,
        password: password,
    };

    try {
        const response = await fetch('/api/users/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken,
            },
            body: JSON.stringify(userInfo),
        });

        if (!response.ok) {
            const errorData = await response.json();
            return displayError(errorData.error || 'An error occurred');
        }

        const data = await response.json();

        if (data.handle) {
            console.log(`Successfully logged in as ${handle}!`);
            redirectToHome();
        }
    } catch (error) {
        console.error('Error logging in:', error);
        displayError(String(error));
    }
}

/**
 * Handles the user selection event.
 * @param {object} user User object
 * @returns {Promise<void>}
 */
async function onUserSelected(user) {
    // No password, just log in
    if (!user.password) {
        return await performLogin(user.handle, '');
    }

    $('#passwordRecoveryBlock').hide();
    $('#passwordEntryBlock').show();
    $('#loginButton').off('click').on('click', async () => {
        const password = String($('#userPassword').val());
        await performLogin(user.handle, password);
    });

    $('#recoverPassword').off('click').on('click', async () => {
        await sendRecoveryPart1(user.handle);
    });

    $('#sendRecovery').off('click').on('click', async () => {
        const code = String($('#recoveryCode').val());
        const newPassword = String($('#newPassword').val());
        await sendRecoveryPart2(user.handle, code, newPassword);
    });

    displayError('');
}

/**
 * Displays an error message to the user.
 * @param {string} message Error message
 * @param {boolean} isError Whether this is an error (true) or success message (false)
 */
function displayError(message, isError = true) {
    const errorElement = $('#errorMessage');
    errorElement.text(message);
    if (isError) {
        errorElement.removeClass('neutral_good').addClass('neutral_warning');
    } else {
        errorElement.removeClass('neutral_warning').addClass('neutral_good');
    }
}

/**
 * Redirects the user to the home page.
 * Preserves the query string.
 */
function redirectToHome() {
    // Create a URL object based on the current location
    const currentUrl = new URL(window.location.href);

    // After a login there's no need to preserve the
    // noauto parameter (if present)
    currentUrl.searchParams.delete('noauto');

    // Set the pathname to root and keep the updated query string
    currentUrl.pathname = '/';

    // Redirect to the new URL
    window.location.href = currentUrl.toString();
}

/**
 * Hides the password entry block and shows the password recovery block.
 */
function showRecoveryBlock() {
    $('#passwordEntryBlock').hide();
    $('#passwordRecoveryBlock').show();
    displayError('');
}

/**
 * Hides the password recovery block and shows the password entry block.
 */
function onCancelRecoveryClick() {
    $('#passwordRecoveryBlock').hide();
    $('#passwordEntryBlock').show();
    displayError('');
}

/**
 * Configures the login page for normal login.
 * @param {import('../../src/users').UserViewModel[]} userList List of users
 */
function configureNormalLogin(userList) {
    console.log('Discreet login is disabled');
    $('#handleEntryBlock').hide();
    $('#normalLoginPrompt').show();
    $('#discreetLoginPrompt').hide();
    console.log(userList);
    for (const user of userList) {
        const userBlock = $('<div></div>').addClass('userSelect');
        const avatarBlock = $('<div></div>').addClass('avatar');
        avatarBlock.append($('<img>').attr('src', user.avatar));
        userBlock.append(avatarBlock);
        userBlock.append($('<span></span>').addClass('userName').text(user.name));
        userBlock.append($('<small></small>').addClass('userHandle').text(user.handle));
        userBlock.on('click', () => onUserSelected(user));
        $('#userList').append(userBlock);
    }
    
    // Add register button for normal login mode
    const registerBlock = $('<div></div>').addClass('userSelect').css('background-color', 'var(--black30a)');
    registerBlock.append($('<div></div>').addClass('avatar').append($('<i></i>').addClass('fa-solid fa-user-plus').css('font-size', '24px')));
    const createAccountText = window.t ? window.t('Create New Account') : 'Create New Account';
    const registerText = window.t ? window.t('Register') : 'Register';
    registerBlock.append($('<span></span>').addClass('userName').text(createAccountText));
    registerBlock.append($('<small></small>').addClass('userHandle').text(registerText));
    registerBlock.on('click', () => {
        $('#userList').hide();
        $('#normalLoginPrompt').hide();
        $('#registerBlock').show();
        $('#errorMessage').text('');
    });
    $('#userList').append(registerBlock);
    
    // Add register event handlers for normal login mode
    $('#registerButton').off('click').on('click', async () => {
        const name = String($('#registerName').val()).trim();
        const handle = String($('#registerHandle').val()).trim();
        const password = String($('#registerPassword').val());
        const confirmPassword = String($('#registerConfirmPassword').val());

        if (!name || !handle || !password || !confirmPassword) {
            const errorMsg = window.t ? window.t('Please fill in all fields') : 'Please fill in all fields';
            return displayError(errorMsg);
        }

        if (password !== confirmPassword) {
            const errorMsg = window.t ? window.t('Passwords do not match') : 'Passwords do not match';
            return displayError(errorMsg);
        }

        if (!/^[a-z0-9-]+$/.test(handle)) {
            const errorMsg = window.t ? window.t('Username can only contain lowercase letters, numbers, and dashes') : 'Username can only contain lowercase letters, numbers, and dashes';
            return displayError(errorMsg);
        }

        await registerUser(name, handle, password, confirmPassword);
    });

    $('#cancelRegister').off('click').on('click', () => {
        $('#registerBlock').hide();
        $('#userList').show();
        $('#normalLoginPrompt').show();
        $('#errorMessage').text('');
        // Clear registration form
        $('#registerName').val('');
        $('#registerHandle').val('');
        $('#registerPassword').val('');
        $('#registerConfirmPassword').val('');
    });
}

/**
 * Configures the login page for discreet login.
 */
function configureDiscreetLogin() {
    console.log('Discreet login is enabled');
    $('#handleEntryBlock').show();
    $('#normalLoginPrompt').hide();
    $('#discreetLoginPrompt').show();
    $('#userList').hide();
    $('#passwordRecoveryBlock').hide();
    $('#passwordEntryBlock').show();
    $('#loginButton').off('click').on('click', async () => {
        const handle = String($('#userHandle').val());
        const password = String($('#userPassword').val());
        await performLogin(handle, password);
    });

    $('#recoverPassword').off('click').on('click', async () => {
        const handle = String($('#userHandle').val());
        await sendRecoveryPart1(handle);
    });

    $('#sendRecovery').off('click').on('click', async () => {
        const handle = String($('#userHandle').val());
        const code = String($('#recoveryCode').val());
        const newPassword = String($('#newPassword').val());
        await sendRecoveryPart2(handle, code, newPassword);
    });

    $('#showRegisterButton').off('click').on('click', () => {
        $('#passwordEntryBlock').hide();
        $('#passwordRecoveryBlock').hide();
        $('#registerBlock').show();
        $('#errorMessage').text('');
    });

    $('#registerButton').off('click').on('click', async () => {
        const name = String($('#registerName').val()).trim();
        const handle = String($('#registerHandle').val()).trim();
        const password = String($('#registerPassword').val());
        const confirmPassword = String($('#registerConfirmPassword').val());

        if (!name || !handle || !password || !confirmPassword) {
            const errorMsg = window.t ? window.t('Please fill in all fields') : 'Please fill in all fields';
            return displayError(errorMsg);
        }

        if (password !== confirmPassword) {
            const errorMsg = window.t ? window.t('Passwords do not match') : 'Passwords do not match';
            return displayError(errorMsg);
        }

        if (!/^[a-z0-9-]+$/.test(handle)) {
            const errorMsg = window.t ? window.t('Username can only contain lowercase letters, numbers, and dashes') : 'Username can only contain lowercase letters, numbers, and dashes';
            return displayError(errorMsg);
        }

        await registerUser(name, handle, password, confirmPassword);
    });

    $('#cancelRegister').off('click').on('click', () => {
        $('#registerBlock').hide();
        $('#passwordEntryBlock').show();
        $('#errorMessage').text('');
        // Clear registration form
        $('#registerName').val('');
        $('#registerHandle').val('');
        $('#registerPassword').val('');
        $('#registerConfirmPassword').val('');
    });
}

(async function () {
    csrfToken = await getCsrfToken();
    const userList = await getUserList();

    if (discreetLogin) {
        configureDiscreetLogin();
    } else {
        configureNormalLogin(userList);
    }
    document.getElementById('shadow_popup').style.opacity = '';
    $('#cancelRecovery').on('click', onCancelRecoveryClick);
    $(document).on('keydown', (evt) => {
        if (evt.key === 'Enter' && document.activeElement.tagName === 'INPUT') {
            if ($('#passwordRecoveryBlock').is(':visible')) {
                $('#sendRecovery').trigger('click');
            } else if ($('#registerBlock').is(':visible')) {
                $('#registerButton').trigger('click');
            } else {
                $('#loginButton').trigger('click');
            }
        }
    });
})();
