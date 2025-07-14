/**
 * CSRF token for requests.
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
        return displayError(errorData.error || '发生错误');
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
 */
async function registerUser(name, handle, password, confirmPassword, securityQuestion, securityAnswer) {
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
            securityQuestion: securityQuestion,
            securityAnswer: securityAnswer,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        return displayError(errorData.error || '注册失败');
    }

    const successMessage = '注册成功！您现在可以使用新账户登录。';
    displayError(successMessage, 'neutral_good');

    // Clear registration form
    $('#registerName').val('');
    $('#registerHandle').val('');
    $('#registerPassword').val('');
    $('#registerConfirmPassword').val('');
    $('#registerSecurityQuestion').val('');
    $('#registerSecurityAnswer').val('');

    // Switch back to appropriate login view
    $('#registerBlock').hide();
    if (discreetLogin) {
        $('#passwordEntryBlock').show();
    } else {
        $('#userList').show();
    }
}

/**
 * Displays an error message.
 * @param {string} message Error message
 * @param {string} className CSS class name
 */
function displayError(message, className = 'neutral_warning') {
    const errorElement = $('#errorMessage');
    errorElement.removeClass().addClass(className).text(message);
    setTimeout(() => {
        errorElement.text('').removeClass();
    }, 5000);
}

/**
 * Configures the login page for normal login.
 * @param {object} userList List of users
 */
function configureNormalLogin(userList) {
    console.log('正常登录模式已启用');
    $('#normalLoginPrompt').show();
    $('#discreetLoginPrompt').hide();
    $('#handleEntryBlock').hide();

    // Populate user list
    const userListElement = $('#userList');
    userListElement.empty();

    for (const user of userList) {
        const userElement = $('<div></div>').addClass('userSelect');
        userElement.append($('<div></div>').addClass('avatar').append($('<img>').attr('src', user.avatar || 'img/No-Image-Placeholder.svg')));
        userElement.append($('<span></span>').addClass('userName').text(user.name));
        userElement.append($('<small></small>').addClass('userHandle').text(user.handle));
        userElement.on('click', () => {
            $('#userList').hide();
            $('#passwordEntryBlock').show();
            $('#userHandle').val(user.handle);
            $('#userPassword').focus();
        });
        userListElement.append(userElement);
    }

    // Add register button for normal login mode
    const registerBlock = $('<div></div>').addClass('userSelect').css('background-color', 'var(--black30a)');
    registerBlock.append($('<div></div>').addClass('avatar').append($('<i></i>').addClass('fa-solid fa-user-plus').css('font-size', '24px')));
    const createAccountText = '建立一个新账户';
    const registerText = '注册';
    registerBlock.append($('<span></span>').addClass('userName').text(createAccountText));
    registerBlock.append($('<small></small>').addClass('userHandle').text(registerText));
    registerBlock.on('click', () => {
        $('#userList').hide();
        $('#registerBlock').show();
    });

    $('#userList').append(registerBlock);

    // Add register event handlers for normal login mode
    $('#registerButton').off('click').on('click', async () => {
        const name = String($('#registerName').val()).trim();
        const handle = String($('#registerHandle').val()).trim();
        const password = String($('#registerPassword').val());
        const confirmPassword = String($('#registerConfirmPassword').val());
        const securityQuestion = String($('#registerSecurityQuestion').val());
        const securityAnswer = String($('#registerSecurityAnswer').val()).trim();

        if (!name || !handle || !password || !confirmPassword || !securityQuestion || !securityAnswer) {
            return displayError('请填写所有字段');
        }

        if (password !== confirmPassword) {
            return displayError('密码不匹配');
        }

        if (!/^[a-z0-9-]+$/.test(handle)) {
            return displayError('用户名只能包含小写字母、数字和连字符');
        }

        await registerUser(name, handle, password, confirmPassword, securityQuestion, securityAnswer);
    });

    $('#cancelRegister').off('click').on('click', () => {
        $('#registerBlock').hide();
        $('#userList').show();
        $('#errorMessage').text('');
        // Clear registration form
        $('#registerName').val('');
        $('#registerHandle').val('');
        $('#registerPassword').val('');
        $('#registerConfirmPassword').val('');
        $('#registerSecurityQuestion').val('');
        $('#registerSecurityAnswer').val('');
    });

    // Add login button functionality for discreet mode
    $('#loginButton').off('click').on('click', async () => {
        const handle = $('#userHandle').val();
        const password = $('#userPassword').val();

        if (!handle || !password) {
            return displayError('请输入用户名和密码');
        }

        try {
            const response = await fetch('/api/users/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken,
                },
                body: JSON.stringify({
                    handle: handle,
                    password: password,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                return displayError(errorData.error || '登录失败');
            }

            // Login successful, redirect to main page
            window.location.href = '/';
        } catch (error) {
            console.error('Login failed:', error);
            displayError('网络错误，请重试');
        }
    });
}

/**
 * Configures the login page for discreet login.
 */
function configureDiscreetLogin() {
    console.log('隐私登录模式已启用');
    $('#normalLoginPrompt').hide();
    $('#discreetLoginPrompt').show();
    $('#userList').hide();
    $('#handleEntryBlock').show();
    $('#passwordEntryBlock').show();

    $('#showRegisterButton').off('click').on('click', () => {
        $('#passwordEntryBlock').hide();
        $('#registerBlock').show();
    });

    $('#registerButton').off('click').on('click', async () => {
        const name = String($('#registerName').val()).trim();
        const handle = String($('#registerHandle').val()).trim();
        const password = String($('#registerPassword').val());
        const confirmPassword = String($('#registerConfirmPassword').val());
        const securityQuestion = String($('#registerSecurityQuestion').val());
        const securityAnswer = String($('#registerSecurityAnswer').val()).trim();

        if (!name || !handle || !password || !confirmPassword || !securityQuestion || !securityAnswer) {
            return displayError('请填写所有字段');
        }

        if (password !== confirmPassword) {
            return displayError('密码不匹配');
        }

        if (!/^[a-z0-9-]+$/.test(handle)) {
            return displayError('用户名只能包含小写字母、数字和连字符');
        }

        await registerUser(name, handle, password, confirmPassword, securityQuestion, securityAnswer);
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
        $('#registerSecurityQuestion').val('');
        $('#registerSecurityAnswer').val('');
    });

    // Add login button functionality
    $('#loginButton').off('click').on('click', async () => {
        const handle = $('#userHandle').val();
        const password = $('#userPassword').val();

        if (!handle || !password) {
            return displayError('请输入用户名和密码');
        }

        try {
            const response = await fetch('/api/users/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken,
                },
                body: JSON.stringify({
                    handle: handle,
                    password: password,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                return displayError(errorData.error || '登录失败');
            }

            // Login successful, redirect to main page
            window.location.href = '/';
        } catch (error) {
            console.error('Login failed:', error);
            displayError('网络错误，请重试');
        }
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
    
    // Password recovery functionality
    $('#recoverPassword').on('click', async () => {
        const handle = $('#userHandle').val();
        if (!handle) {
            return displayError('请先选择用户或输入用户名');
        }
        
        $('#passwordEntryBlock').hide();
        $('#passwordRecoveryBlock').show();
        $('#userHandle').val(handle); // Keep the handle for recovery
    });

    let recoveryStep = 1;
    let currentSecurityQuestion = '';

    $('#sendRecovery').on('click', async () => {
        const handle = $('#userHandle').val();

        if (!handle) {
            return displayError('用户名不能为空');
        }

        if (recoveryStep === 1) {
            // Step 1: Get security question
            try {
                const response = await fetch('/api/users/recover-step1', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken,
                    },
                    body: JSON.stringify({ handle: handle }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    return displayError(errorData.error || '获取安全问题失败');
                }

                const data = await response.json();
                currentSecurityQuestion = data.securityQuestion;
                
                // Show security question and answer input
                $('#securityQuestionDisplay').text(currentSecurityQuestion).show();
                $('#securityAnswerInput').show();
                $('#sendRecovery').text('验证答案');
                $('#recoverMessage').text('请回答以下安全问题：');
                recoveryStep = 2;
                
            } catch (error) {
                console.error('Recovery step 1 failed:', error);
                displayError('网络错误，请重试');
            }
        } else if (recoveryStep === 2) {
            // Step 2: Verify security answer and get recovery code
            const securityAnswer = $('#securityAnswerInput').val();
            
            if (!securityAnswer) {
                return displayError('请输入安全问题答案');
            }

            try {
                const response = await fetch('/api/users/recover-step2', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken,
                    },
                    body: JSON.stringify({
                        handle: handle,
                        securityAnswer: securityAnswer,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    return displayError(errorData.error || '安全问题答案错误');
                }

                const data = await response.json();
                
                // Show recovery code and password inputs
                $('#recoveryCode').show().val(data.recoveryCode);
                $('#newPassword').show();
                $('#sendRecovery').text('重置密码');
                $('#recoverMessage').html(`验证成功！您的恢复码是: <strong style="color: #4CAF50;">${data.recoveryCode}</strong><br>请输入新密码完成重置。`);
                recoveryStep = 3;
                
            } catch (error) {
                console.error('Recovery step 2 failed:', error);
                displayError('网络错误，请重试');
            }
        } else if (recoveryStep === 3) {
            // Step 3: Reset password with recovery code
            const recoveryCode = $('#recoveryCode').val();
            const newPassword = $('#newPassword').val();
            
            if (!recoveryCode || !newPassword) {
                return displayError('请输入恢复码和新密码');
            }

            try {
                const response = await fetch('/api/users/recover-step3', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken,
                    },
                    body: JSON.stringify({
                        handle: handle,
                        code: recoveryCode,
                        newPassword: newPassword,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    return displayError(errorData.error || '密码重置失败');
                }

                displayError('密码重置成功！请使用新密码登录。', 'neutral_good');
                
                // Reset recovery form and return to login
                resetRecoveryForm();
                
            } catch (error) {
                console.error('Recovery step 3 failed:', error);
                displayError('网络错误，请重试');
            }
        }
    });

    function resetRecoveryForm() {
        recoveryStep = 1;
        currentSecurityQuestion = '';
        $('#securityQuestionDisplay').hide().text('');
        $('#securityAnswerInput').hide().val('');
        $('#recoveryCode').hide().val('');
        $('#newPassword').hide().val('');
        $('#sendRecovery').text('获取安全问题');
        $('#recoverMessage').text('请回答安全问题以获取恢复码。');
        $('#passwordRecoveryBlock').hide();
        $('#passwordEntryBlock').show();
        $('#userPassword').focus();
    }

    $('#cancelRecovery').on('click', () => {
        resetRecoveryForm();
        $('#errorMessage').text('');
    });


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