import { loginWithEmail, registerWithEmail, onAuthStateChange, logout } from './firebase/firebase.js';
import { initLobby } from './components/lobby.js';
import { initRoom } from './components/room.js';
import { showTutorial } from './components/tutorial.js';

// 页面初始化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 根据URL判断当前页面
        const path = window.location.pathname;
        
        // 处理路径，兼容直接访问/public/index.html和通过服务器根目录访问的情况
        const isIndexPage = path.endsWith('/index.html') || path === '/' || path.endsWith('/public/') || path.endsWith('/public');
        const isLobbyPage = path.endsWith('/lobby.html');
        const isRoomPage = path.endsWith('/room.html');
        
        if (isIndexPage) {
            // 登录页面
            setupLoginPage();
        } else if (isLobbyPage) {
            // 大厅页面
            const user = await checkAuth();
            if (user) {
                initLobby(user);
            }
        } else if (isRoomPage) {
            // 游戏房间页面
            const user = await checkAuth();
            if (user) {
                const urlParams = new URLSearchParams(window.location.search);
                const roomId = urlParams.get('id');
                if (roomId) {
                    initRoom(user, roomId);
                } else {
                    alert('房间号无效');
                    window.location.href = './lobby.html';
                }
            }
        }
    } catch (error) {
        console.error('初始化失败:', error);
        alert('初始化失败，请刷新页面重试');
    }
});

// 检查认证状态
const checkAuth = () => {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChange((user) => {
            unsubscribe();
            if (!user) {
                window.location.href = './index.html';
                resolve(null);
            } else {
                resolve(user);
            }
        });
    });
};

// 设置登录页面
const setupLoginPage = () => {
    // 切换登录/注册表单
    const tabBtns = document.querySelectorAll('.tab-btn');
    const formContents = document.querySelectorAll('.form-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            
            // 更新按钮状态
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // 更新表单显示
            formContents.forEach(form => {
                form.classList.remove('active');
                if (form.id === `${tab}Form`) {
                    form.classList.add('active');
                }
            });
        });
    });
    
    // 处理登录表单提交
    const loginForm = document.getElementById('loginForm');
    
    const handleLogin = async (e) => {
        if (e) e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        if (!email || !password) {
            showError(loginForm, '请填写所有必填字段');
            return;
        }
        
        try {
            const loginButton = loginForm.querySelector('button[type="submit"]');
            loginButton.disabled = true;
            loginButton.textContent = '登录中...';
            
            // 登录并获取用户信息
            const user = await loginWithEmail(email, password);
            console.log("登录后的用户信息:", user);
            
            // 如果有用户名, 保存到localStorage
            if (user.displayName) {
                console.log("保存用户名到localStorage:", user.displayName);
                localStorage.setItem('playerName', user.displayName);
            }
            
            window.location.href = './lobby.html';
        } catch (error) {
            const loginButton = loginForm.querySelector('button[type="submit"]');
            loginButton.disabled = false;
            loginButton.textContent = '登录';
            
            showError(loginForm, getErrorMessage(error.code));
        }
    };
    
    // 只监听表单提交
    loginForm.addEventListener('submit', handleLogin);
    
    // 处理注册表单提交
    const registerForm = document.getElementById('registerForm');
    
    const handleRegister = async (e) => {
        if (e) e.preventDefault();
        
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        // 验证所有字段
        if (!name || !email || !password || !confirmPassword) {
            showError(registerForm, '请填写所有必填字段');
            return;
        }
        
        // 验证密码
        if (password !== confirmPassword) {
            showError(registerForm, '两次输入的密码不一致');
            return;
        }
        
        // 验证密码强度
        if (password.length < 6) {
            showError(registerForm, '密码长度至少为6位');
            return;
        }
        
        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showError(registerForm, '请输入有效的邮箱地址');
            return;
        }
        
        try {
            const registerButton = registerForm.querySelector('button[type="submit"]');
            registerButton.disabled = true;
            registerButton.textContent = '注册中...';
            
            // 记录用户名和调试信息
            console.log("注册用户名:", name);
            const user = await registerWithEmail(email, password, name);
            console.log("注册后的用户信息:", user);
            
            // 将用户名存储在localStorage，以便整个应用使用相同的名称
            localStorage.setItem('playerName', name);
            
            window.location.href = './lobby.html';
        } catch (error) {
            const registerButton = registerForm.querySelector('button[type="submit"]');
            registerButton.disabled = false;
            registerButton.textContent = '注册';
            
            showError(registerForm, getErrorMessage(error.code));
        }
    };
    
    // 只监听表单提交
    registerForm.addEventListener('submit', handleRegister);
};

// 显示错误信息
const showError = (form, message) => {
    // 移除旧的错误信息
    const oldError = form.querySelector('.error-message');
    if (oldError) {
        oldError.remove();
    }
    
    // 添加新的错误信息
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    form.insertBefore(errorDiv, form.firstChild);
};

// 获取错误信息
const getErrorMessage = (errorCode) => {
    switch (errorCode) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            return '邮箱或密码错误';
        case 'auth/email-already-in-use':
            return '该邮箱已被注册';
        case 'auth/weak-password':
            return '密码强度太弱';
        case 'auth/invalid-email':
            return '邮箱格式不正确';
        default:
            return '操作失败，请重试';
    }
};

// 监听认证状态变化
onAuthStateChange((user) => {
    if (!user && !window.location.pathname.endsWith('/index.html') && window.location.pathname !== '/') {
        window.location.href = './index.html';
    }
});

// 检查是否首次访问
document.addEventListener('DOMContentLoaded', () => {
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    if (!hasSeenTutorial) {
        showTutorial();
    }
}); 