/**
 * Система авторизации для медиа-портала
 * Управление пользователями, ролями, входом и регистрацией
 */

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        // Загружаем текущего пользователя из localStorage
        const userData = MediaPortal.StorageManager.get(MediaPortal.STORAGE_KEYS.CURRENT_USER);
        if (userData) {
            this.currentUser = userData;
        }

        // Инициализируем обработчики событий
        this.initEventHandlers();
    }

    initEventHandlers() {
        // Обработчик формы входа
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Обработчик формы регистрации
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Обработчик формы восстановления пароля
        const forgotForm = document.getElementById('forgot-password-form');
        if (forgotForm) {
            forgotForm.addEventListener('submit', (e) => this.handleForgotPassword(e));
        }

        // Обработчики кнопок выхода
        const logoutBtns = document.querySelectorAll('#logout-btn, .logout-btn');
        logoutBtns.forEach(btn => {
            btn.addEventListener('click', () => this.logout());
        });

        // Кнопка авторизации в хедере
        const authBtn = document.getElementById('auth-btn');
        if (authBtn) {
            authBtn.addEventListener('click', () => this.handleAuthButtonClick());
        }
    }

    // ===== ВХОД В СИСТЕМУ =====
    async handleLogin(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const email = formData.get('email') || document.getElementById('login-email').value;
        const password = formData.get('password') || document.getElementById('login-password').value;
        const rememberMe = document.getElementById('remember-me')?.checked || false;

        // Валидация
        const errors = this.validateLoginData({ email, password });
        if (errors.length > 0) {
            MediaPortal.NotificationManager.error(errors.join('\n'));
            return;
        }

        // Показываем индикатор загрузки
        this.setFormLoading(e.target, true);

        try {
            const user = await this.authenticate(email, password);
            if (user) {
                await this.loginSuccess(user, rememberMe);
            } else {
                MediaPortal.NotificationManager.error('Неверный email или пароль');
            }
        } catch (error) {
            console.error('Login error:', error);
            MediaPortal.NotificationManager.error('Ошибка при входе в систему');
        } finally {
            this.setFormLoading(e.target, false);
        }
    }

    validateLoginData({ email, password }) {
        const errors = [];

        if (!MediaPortal.Validator.required(email)) {
            errors.push('Email обязателен');
        } else if (!MediaPortal.Validator.email(email)) {
            errors.push('Некорректный формат email');
        }

        if (!MediaPortal.Validator.required(password)) {
            errors.push('Пароль обязателен');
        }

        return errors;
    }

    async authenticate(email, password) {
        // Получаем всех пользователей
        const users = MediaPortal.StorageManager.get(MediaPortal.STORAGE_KEYS.USERS) || [];
        
        // Ищем пользователя по email
        const user = users.find(u => 
            u.email.toLowerCase() === email.toLowerCase() && 
            u.password === password && // В реальном проекте здесь должна быть проверка хеша
            u.isActive
        );

        return user || null;
    }

    async loginSuccess(user, rememberMe) {
        // Удаляем пароль из данных пользователя для хранения
        const userForStorage = { ...user };
        delete userForStorage.password;

        // Сохраняем пользователя
        this.currentUser = userForStorage;
        
        if (rememberMe) {
            MediaPortal.StorageManager.set(MediaPortal.STORAGE_KEYS.CURRENT_USER, userForStorage);
        } else {
            // Используем sessionStorage для временного хранения
            sessionStorage.setItem(MediaPortal.STORAGE_KEYS.CURRENT_USER, JSON.stringify(userForStorage));
        }

        // Уведомляем об успешном входе
        MediaPortal.NotificationManager.success(`Добро пожаловать, ${user.firstName}!`);

        // Перенаправляем в зависимости от роли
        setTimeout(() => {
            if (user.role === MediaPortal.ROLES.ADMIN || user.role === MediaPortal.ROLES.EDITOR) {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'index.html';
            }
        }, 1000);
    }

    // ===== РЕГИСТРАЦИЯ =====
    async handleRegister(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const userData = {
            firstName: formData.get('firstName') || document.getElementById('register-firstname').value,
            lastName: formData.get('lastName') || document.getElementById('register-lastname').value,
            email: formData.get('email') || document.getElementById('register-email').value,
            password: formData.get('password') || document.getElementById('register-password').value,
            confirmPassword: formData.get('confirmPassword') || document.getElementById('register-password-confirm').value,
            role: formData.get('role') || document.getElementById('register-role').value,
            bio: formData.get('bio') || document.getElementById('register-bio').value
        };

        // Валидация
        const errors = this.validateRegistrationData(userData);
        if (errors.length > 0) {
            MediaPortal.NotificationManager.error(errors.join('\n'));
            return;
        }

        // Показываем индикатор загрузки
        this.setFormLoading(e.target, true);

        try {
            const newUser = await this.createUser(userData);
            if (newUser) {
                MediaPortal.NotificationManager.success(
                    'Регистрация прошла успешно! Ваш аккаунт отправлен на модерацию.',
                    8000
                );
                
                // Очищаем форму
                e.target.reset();
                
                // Переключаемся на форму входа
                setTimeout(() => {
                    const loginTab = document.querySelector('[data-form="login"]');
                    if (loginTab) {
                        loginTab.click();
                    }
                }, 2000);
            }
        } catch (error) {
            console.error('Registration error:', error);
            MediaPortal.NotificationManager.error('Ошибка при регистрации');
        } finally {
            this.setFormLoading(e.target, false);
        }
    }

    validateRegistrationData(data) {
        const errors = [];

        if (!MediaPortal.Validator.required(data.firstName)) {
            errors.push('Имя обязательно');
        }

        if (!MediaPortal.Validator.required(data.lastName)) {
            errors.push('Фамилия обязательна');
        }

        if (!MediaPortal.Validator.required(data.email)) {
            errors.push('Email обязателен');
        } else if (!MediaPortal.Validator.email(data.email)) {
            errors.push('Некорректный формат email');
        } else if (this.isEmailTaken(data.email)) {
            errors.push('Пользователь с таким email уже существует');
        }

        if (!MediaPortal.Validator.password(data.password, 6)) {
            errors.push('Пароль должен содержать минимум 6 символов');
        }

        if (data.password !== data.confirmPassword) {
            errors.push('Пароли не совпадают');
        }

        if (!MediaPortal.Validator.required(data.role)) {
            errors.push('Выберите роль');
        }

        return errors;
    }

    isEmailTaken(email) {
        const users = MediaPortal.StorageManager.get(MediaPortal.STORAGE_KEYS.USERS) || [];
        return users.some(user => user.email.toLowerCase() === email.toLowerCase());
    }

    async createUser(userData) {
        const users = MediaPortal.StorageManager.get(MediaPortal.STORAGE_KEYS.USERS) || [];
        
        const newUser = {
            id: MediaPortal.IDGenerator.generate(),
            firstName: userData.firstName.trim(),
            lastName: userData.lastName.trim(),
            email: userData.email.toLowerCase().trim(),
            password: userData.password, // В реальном проекте здесь должно быть хеширование
            role: userData.role,
            bio: userData.bio?.trim() || '',
            avatar: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isActive: userData.role === MediaPortal.ROLES.AUTHOR, // Авторы активны сразу
            isApproved: userData.role === MediaPortal.ROLES.AUTHOR // Авторы одобрены сразу
        };

        users.push(newUser);
        MediaPortal.StorageManager.set(MediaPortal.STORAGE_KEYS.USERS, users);

        return newUser;
    }

    // ===== ВОССТАНОВЛЕНИЕ ПАРОЛЯ =====
    async handleForgotPassword(e) {
        e.preventDefault();
        
        const email = document.getElementById('forgot-email').value;

        if (!MediaPortal.Validator.email(email)) {
            MediaPortal.NotificationManager.error('Введите корректный email');
            return;
        }

        this.setFormLoading(e.target, true);

        try {
            // Эмуляция отправки письма
            await this.simulatePasswordReset(email);
            
            MediaPortal.NotificationManager.success(
                'Если пользователь с таким email существует, инструкции отправлены на почту',
                8000
            );

            // Закрываем модальное окно
            const modal = document.getElementById('forgot-password-modal');
            if (modal) {
                modal.classList.remove('active');
            }

            e.target.reset();

        } catch (error) {
            console.error('Password reset error:', error);
            MediaPortal.NotificationManager.error('Ошибка при восстановлении пароля');
        } finally {
            this.setFormLoading(e.target, false);
        }
    }

    async simulatePasswordReset(email) {
        // В реальном проекте здесь была бы отправка на сервер
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`Password reset requested for: ${email}`);
                resolve();
            }, 1000);
        });
    }

    // ===== ВЫХОД ИЗ СИСТЕМЫ =====
    logout() {
        // Удаляем данные пользователя
        this.currentUser = null;
        MediaPortal.StorageManager.remove(MediaPortal.STORAGE_KEYS.CURRENT_USER);
        sessionStorage.removeItem(MediaPortal.STORAGE_KEYS.CURRENT_USER);

        // Уведомляем о выходе
        MediaPortal.NotificationManager.info('Вы вышли из системы');

        // Перенаправляем на главную
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    }

    // ===== ПРОВЕРКА ПРАВ ДОСТУПА =====
    isAuthenticated() {
        return this.currentUser !== null;
    }

    hasRole(role) {
        return this.isAuthenticated() && this.currentUser.role === role;
    }

    canAccess(requiredRoles = []) {
        if (!this.isAuthenticated()) return false;
        if (requiredRoles.length === 0) return true;
        
        return requiredRoles.includes(this.currentUser.role);
    }

    canManageArticles() {
        return this.hasRole(MediaPortal.ROLES.ADMIN) || 
               this.hasRole(MediaPortal.ROLES.EDITOR);
    }

    canPublishArticles() {
        return this.hasRole(MediaPortal.ROLES.ADMIN) || 
               this.hasRole(MediaPortal.ROLES.EDITOR);
    }

    canModerateComments() {
        return this.hasRole(MediaPortal.ROLES.ADMIN) || 
               this.hasRole(MediaPortal.ROLES.EDITOR);
    }

    canManageUsers() {
        return this.hasRole(MediaPortal.ROLES.ADMIN);
    }

    // ===== ПОЛУЧЕНИЕ ДАННЫХ ПОЛЬЗОВАТЕЛЯ =====
    getCurrentUser() {
        return this.currentUser;
    }

    getUserById(userId) {
        const users = MediaPortal.StorageManager.get(MediaPortal.STORAGE_KEYS.USERS) || [];
        return users.find(user => user.id === userId);
    }

    getAllUsers() {
        return MediaPortal.StorageManager.get(MediaPortal.STORAGE_KEYS.USERS) || [];
    }

    // ===== ОБНОВЛЕНИЕ ПРОФИЛЯ =====
    async updateProfile(userData) {
        if (!this.isAuthenticated()) {
            throw new Error('Пользователь не авторизован');
        }

        const users = MediaPortal.StorageManager.get(MediaPortal.STORAGE_KEYS.USERS) || [];
        const userIndex = users.findIndex(user => user.id === this.currentUser.id);

        if (userIndex === -1) {
            throw new Error('Пользователь не найден');
        }

        // Обновляем данные
        const updatedUser = {
            ...users[userIndex],
            ...userData,
            updatedAt: new Date().toISOString()
        };

        users[userIndex] = updatedUser;
        MediaPortal.StorageManager.set(MediaPortal.STORAGE_KEYS.USERS, users);

        // Обновляем текущего пользователя
        const userForStorage = { ...updatedUser };
        delete userForStorage.password;
        this.currentUser = userForStorage;
        MediaPortal.StorageManager.set(MediaPortal.STORAGE_KEYS.CURRENT_USER, userForStorage);

        return updatedUser;
    }

    // ===== УПРАВЛЕНИЕ UI =====
    updateUI() {
        this.updateAuthButton();
        this.updateUserInfo();
        this.checkPageAccess();
    }

    updateAuthButton() {
        const authBtn = document.getElementById('auth-btn');
        if (!authBtn) return;

        if (this.isAuthenticated()) {
            authBtn.innerHTML = `
                <i class="fas fa-user-circle"></i>
                ${this.currentUser.firstName}
            `;
            authBtn.onclick = () => this.showUserMenu();
        } else {
            authBtn.innerHTML = `
                <i class="fas fa-user"></i>
                Вход
            `;
            authBtn.onclick = () => this.handleAuthButtonClick();
        }
    }

    updateUserInfo() {
        const userInfoElement = document.getElementById('admin-user-info');
        if (userInfoElement && this.isAuthenticated()) {
            const avatarElement = userInfoElement.querySelector('.user-avatar');
            const nameElement = userInfoElement.querySelector('.user-name');
            const roleElement = userInfoElement.querySelector('.user-role');

            if (avatarElement) {
                avatarElement.innerHTML = this.currentUser.avatar ? 
                    `<img src="${this.currentUser.avatar}" alt="Avatar">` : 
                    `<i class="fas fa-user-circle"></i>`;
            }

            if (nameElement) {
                nameElement.textContent = `${this.currentUser.firstName} ${this.currentUser.lastName}`;
            }

            if (roleElement) {
                const roleNames = {
                    [MediaPortal.ROLES.ADMIN]: 'Администратор',
                    [MediaPortal.ROLES.EDITOR]: 'Редактор',
                    [MediaPortal.ROLES.AUTHOR]: 'Автор'
                };
                roleElement.textContent = roleNames[this.currentUser.role] || this.currentUser.role;
            }
        }
    }

    checkPageAccess() {
        const currentPage = window.location.pathname.split('/').pop();
        
        // Проверяем доступ к админке
        if (currentPage === 'admin.html') {
            if (!this.canAccess([MediaPortal.ROLES.ADMIN, MediaPortal.ROLES.EDITOR, MediaPortal.ROLES.AUTHOR])) {
                MediaPortal.NotificationManager.error('Нет доступа к админ-панели');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            }
        }
    }

    handleAuthButtonClick() {
        if (this.isAuthenticated()) {
            this.showUserMenu();
        } else {
            window.location.href = 'login.html';
        }
    }

    showUserMenu() {
        // Создаем контекстное меню для авторизованного пользователя
        const menu = document.createElement('div');
        menu.className = 'user-menu';
        menu.innerHTML = `
            <div class="user-menu-item" onclick="window.location.href='admin.html'">
                <i class="fas fa-tachometer-alt"></i> Панель управления
            </div>
            <div class="user-menu-item" onclick="authManager.logout()">
                <i class="fas fa-sign-out-alt"></i> Выйти
            </div>
        `;
        
        // Показываем меню (упрощенная реализация)
        console.log('User menu:', menu.innerHTML);
    }

    setFormLoading(form, loading) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            if (loading) {
                submitBtn.classList.add('loading');
                submitBtn.disabled = true;
            } else {
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
            }
        }
    }
}

// Создаем глобальный экземпляр
const authManager = new AuthManager();

// Экспортируем в глобальный объект
window.MediaPortal = window.MediaPortal || {};
window.MediaPortal.AuthManager = AuthManager;
window.authManager = authManager;

// Обновляем UI при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    authManager.updateUI();
});

// Также проверяем sessionStorage при загрузке (если не было в localStorage)
document.addEventListener('DOMContentLoaded', function() {
    if (!authManager.currentUser) {
        const sessionUserData = sessionStorage.getItem(MediaPortal.STORAGE_KEYS.CURRENT_USER);
        if (sessionUserData) {
            try {
                authManager.currentUser = JSON.parse(sessionUserData);
                authManager.updateUI();
            } catch (error) {
                console.error('Error parsing session user data:', error);
                sessionStorage.removeItem(MediaPortal.STORAGE_KEYS.CURRENT_USER);
            }
        }
    }
});