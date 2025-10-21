/**
 * Утилитарные функции для медиа-портала
 * Содержит общие вспомогательные функции
 */

// ===== КОНСТАНТЫ =====
const STORAGE_KEYS = {
    USERS: 'media_portal_users',
    ARTICLES: 'media_portal_articles',
    COMMENTS: 'media_portal_comments',
    SETTINGS: 'media_portal_settings',
    CURRENT_USER: 'media_portal_current_user',
    CATEGORIES: 'media_portal_categories',
    TAGS: 'media_portal_tags'
};

const ROLES = {
    ADMIN: 'admin',
    EDITOR: 'editor',
    AUTHOR: 'author'
};

const ARTICLE_STATUS = {
    DRAFT: 'draft',
    PENDING: 'pending',
    PUBLISHED: 'published',
    ARCHIVED: 'archived'
};

const COMMENT_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected'
};

const CATEGORIES = {
    REPORTAGE: { id: 'reportage', name: 'Репортаж', icon: 'fas fa-camera' },
    INTERVIEW: { id: 'interview', name: 'Интервью', icon: 'fas fa-microphone' },
    OPINION: { id: 'opinion', name: 'Мнение', icon: 'fas fa-comment-alt' },
    PHOTOPROJECT: { id: 'photoproject', name: 'Фотопроект', icon: 'fas fa-images' },
    PODCAST: { id: 'podcast', name: 'Подкасты', icon: 'fas fa-podcast' },
    NEWS: { id: 'news', name: 'Новости', icon: 'fas fa-newspaper' }
};

// ===== РАБОТА С LOCALSTORAGE =====
class StorageManager {
    static get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return null;
        }
    }

    static set(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error writing to localStorage:', error);
            return false;
        }
    }

    static remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Error removing from localStorage:', error);
            return false;
        }
    }

    static clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Error clearing localStorage:', error);
            return false;
        }
    }

    // Получить все данные для экспорта
    static exportData() {
        const data = {};
        Object.values(STORAGE_KEYS).forEach(key => {
            data[key] = this.get(key);
        });
        return data;
    }

    // Импортировать данные
    static importData(data) {
        try {
            Object.entries(data).forEach(([key, value]) => {
                if (Object.values(STORAGE_KEYS).includes(key) && value !== null) {
                    this.set(key, value);
                }
            });
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }
}

// ===== ВАЛИДАЦИЯ =====
class Validator {
    static email(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    static password(password, minLength = 6) {
        return password && password.length >= minLength;
    }

    static required(value) {
        return value !== null && value !== undefined && value.toString().trim() !== '';
    }

    static minLength(value, length) {
        return value && value.toString().length >= length;
    }

    static maxLength(value, length) {
        return value && value.toString().length <= length;
    }

    static url(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    static phone(phone) {
        const regex = /^[\+]?[1-9][\d]{0,15}$/;
        return regex.test(phone.replace(/\s/g, ''));
    }

    static fileSize(file, maxSizeMB) {
        return file && file.size <= maxSizeMB * 1024 * 1024;
    }

    static fileType(file, allowedTypes) {
        return file && allowedTypes.includes(file.type);
    }

    static imageFile(file) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        return this.fileType(file, allowedTypes);
    }
}

// ===== ФОРМАТИРОВАНИЕ =====
class Formatter {
    static date(date, options = {}) {
        if (!date) return '';
        
        const dateObj = date instanceof Date ? date : new Date(date);
        const defaultOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };

        return dateObj.toLocaleDateString('ru-RU', { ...defaultOptions, ...options });
    }

    static dateTime(date, options = {}) {
        if (!date) return '';
        
        const dateObj = date instanceof Date ? date : new Date(date);
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };

        return dateObj.toLocaleDateString('ru-RU', { ...defaultOptions, ...options });
    }

    static timeAgo(date) {
        if (!date) return '';
        
        const now = new Date();
        const dateObj = date instanceof Date ? date : new Date(date);
        const diffInSeconds = Math.floor((now - dateObj) / 1000);

        if (diffInSeconds < 60) return 'только что';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} мин. назад`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ч. назад`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} дн. назад`;
        
        return this.date(dateObj);
    }

    static fileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static number(number, locale = 'ru-RU') {
        return new Intl.NumberFormat(locale).format(number);
    }

    static truncate(text, length = 100, suffix = '...') {
        if (!text || text.length <= length) return text;
        return text.substring(0, length).trim() + suffix;
    }

    static slug(text) {
        return text
            .toLowerCase()
            .replace(/[а-яё]/g, char => {
                const map = {
                    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
                    'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i',
                    'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
                    'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
                    'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch',
                    'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '',
                    'э': 'e', 'ю': 'yu', 'я': 'ya'
                };
                return map[char] || char;
            })
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    static initials(name) {
        if (!name) return '';
        return name
            .split(' ')
            .map(part => part.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');
    }

    static capitalize(text) {
        if (!text) return '';
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }
}

// ===== РАБОТА С DOM =====
class DOMUtils {
    static $(selector, context = document) {
        return context.querySelector(selector);
    }

    static $$(selector, context = document) {
        return Array.from(context.querySelectorAll(selector));
    }

    static createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'innerHTML') {
                element.innerHTML = value;
            } else if (key === 'textContent') {
                element.textContent = value;
            } else if (key.startsWith('data-')) {
                element.setAttribute(key, value);
            } else {
                element[key] = value;
            }
        });

        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            }
        });

        return element;
    }

    static show(element) {
        if (typeof element === 'string') {
            element = this.$(element);
        }
        if (element) {
            element.style.display = '';
            element.classList.remove('hidden');
        }
    }

    static hide(element) {
        if (typeof element === 'string') {
            element = this.$(element);
        }
        if (element) {
            element.style.display = 'none';
            element.classList.add('hidden');
        }
    }

    static toggle(element, force) {
        if (typeof element === 'string') {
            element = this.$(element);
        }
        if (element) {
            if (force !== undefined) {
                force ? this.show(element) : this.hide(element);
            } else {
                element.classList.contains('hidden') ? this.show(element) : this.hide(element);
            }
        }
    }

    static fadeIn(element, duration = 300) {
        if (typeof element === 'string') {
            element = this.$(element);
        }
        if (element) {
            element.style.opacity = '0';
            element.style.display = '';
            element.classList.remove('hidden');
            
            let start = performance.now();
            
            function animate(currentTime) {
                const elapsed = currentTime - start;
                const progress = Math.min(elapsed / duration, 1);
                
                element.style.opacity = progress;
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                }
            }
            
            requestAnimationFrame(animate);
        }
    }

    static fadeOut(element, duration = 300) {
        if (typeof element === 'string') {
            element = this.$(element);
        }
        if (element) {
            let start = performance.now();
            const initialOpacity = parseFloat(getComputedStyle(element).opacity) || 1;
            
            function animate(currentTime) {
                const elapsed = currentTime - start;
                const progress = Math.min(elapsed / duration, 1);
                
                element.style.opacity = initialOpacity * (1 - progress);
                
                if (progress >= 1) {
                    element.style.display = 'none';
                    element.classList.add('hidden');
                } else {
                    requestAnimationFrame(animate);
                }
            }
            
            requestAnimationFrame(animate);
        }
    }

    static scrollTo(element, offset = 0) {
        if (typeof element === 'string') {
            element = this.$(element);
        }
        if (element) {
            const rect = element.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            window.scrollTo({
                top: rect.top + scrollTop - offset,
                behavior: 'smooth'
            });
        }
    }

    static isInViewport(element) {
        if (typeof element === 'string') {
            element = this.$(element);
        }
        if (element) {
            const rect = element.getBoundingClientRect();
            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
        }
        return false;
    }
}

// ===== СИСТЕМА УВЕДОМЛЕНИЙ =====
class NotificationManager {
    static container = null;

    static init() {
        if (!this.container) {
            this.container = DOMUtils.$('#toast-container') || this.createContainer();
        }
    }

    static createContainer() {
        const container = DOMUtils.createElement('div', {
            id: 'toast-container',
            className: 'toast-container'
        });
        document.body.appendChild(container);
        return container;
    }

    static show(message, type = 'info', duration = 5000, title = null) {
        this.init();

        const toast = this.createToast(message, type, title);
        this.container.appendChild(toast);

        // Показать уведомление
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        // Автоматически скрыть
        if (duration > 0) {
            setTimeout(() => {
                this.hide(toast);
            }, duration);
        }

        return toast;
    }

    static createToast(message, type, title) {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        const titles = {
            success: 'Успешно',
            error: 'Ошибка',
            warning: 'Внимание',
            info: 'Информация'
        };

        const toast = DOMUtils.createElement('div', {
            className: `toast ${type}`
        });

        const icon = DOMUtils.createElement('div', {
            className: 'toast-icon',
            innerHTML: `<i class="${icons[type] || icons.info}"></i>`
        });

        const content = DOMUtils.createElement('div', {
            className: 'toast-content'
        });

        if (title || titles[type]) {
            const titleElement = DOMUtils.createElement('div', {
                className: 'toast-title',
                textContent: title || titles[type]
            });
            content.appendChild(titleElement);
        }

        const messageElement = DOMUtils.createElement('p', {
            className: 'toast-message',
            textContent: message
        });
        content.appendChild(messageElement);

        const closeButton = DOMUtils.createElement('button', {
            className: 'toast-close',
            innerHTML: '<i class="fas fa-times"></i>'
        });

        closeButton.addEventListener('click', () => {
            this.hide(toast);
        });

        toast.appendChild(icon);
        toast.appendChild(content);
        toast.appendChild(closeButton);

        return toast;
    }

    static hide(toast) {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    static success(message, duration = 5000, title = null) {
        return this.show(message, 'success', duration, title);
    }

    static error(message, duration = 8000, title = null) {
        return this.show(message, 'error', duration, title);
    }

    static warning(message, duration = 6000, title = null) {
        return this.show(message, 'warning', duration, title);
    }

    static info(message, duration = 5000, title = null) {
        return this.show(message, 'info', duration, title);
    }

    static clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

// ===== РАБОТА С ФАЙЛАМИ =====
class FileUtils {
    static readAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    static readAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    static downloadAsFile(data, filename, type = 'application/json') {
        const blob = new Blob([data], { type });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }

    static downloadJSON(data, filename = 'data.json') {
        const jsonString = JSON.stringify(data, null, 2);
        this.downloadAsFile(jsonString, filename, 'application/json');
    }
}

// ===== ГЕНЕРАТОР ID =====
class IDGenerator {
    static generate() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    static uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

// ===== ДЕБАУНСИНГ И ТРОТТЛИНГ =====
class Performance {
    static debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    static throttle(func, delay) {
        let lastCall = 0;
        return function (...args) {
            const now = new Date().getTime();
            if (now - lastCall < delay) {
                return;
            }
            lastCall = now;
            return func.apply(this, args);
        };
    }
}

// ===== ИНИЦИАЛИЗАЦИЯ ДЕМО ДАННЫХ =====
class DemoData {
    static initializeIfEmpty() {
        // Создаем демо пользователей, если их нет
        const users = StorageManager.get(STORAGE_KEYS.USERS) || [];
        if (users.length === 0) {
            this.createDemoUsers();
        }

        // Создаем демо статьи, если их нет
        const articles = StorageManager.get(STORAGE_KEYS.ARTICLES) || [];
        if (articles.length === 0) {
            this.createDemoArticles();
        }
    }

    static createDemoUsers() {
        const demoUsers = [
            {
                id: 'admin-1',
                firstName: 'Админ',
                lastName: 'Администратор',
                email: 'admin@media.ru',
                password: 'admin123', // В реальном проекте пароли должны быть захешированы
                role: ROLES.ADMIN,
                bio: 'Главный администратор медиа-портала',
                avatar: null,
                createdAt: new Date().toISOString(),
                isActive: true
            },
            {
                id: 'editor-1',
                firstName: 'Редактор',
                lastName: 'Главный',
                email: 'editor@media.ru',
                password: 'editor123',
                role: ROLES.EDITOR,
                bio: 'Главный редактор портала, отвечаю за качество контента',
                avatar: null,
                createdAt: new Date().toISOString(),
                isActive: true
            },
            {
                id: 'author-1',
                firstName: 'Автор',
                lastName: 'Студент',
                email: 'author@media.ru',
                password: 'author123',
                role: ROLES.AUTHOR,
                bio: 'Студент факультета журналистики, пишу статьи и репортажи',
                avatar: null,
                createdAt: new Date().toISOString(),
                isActive: true
            }
        ];

        StorageManager.set(STORAGE_KEYS.USERS, demoUsers);
    }

    static createDemoArticles() {
        const demoArticles = [
            {
                id: 'article-1',
                title: 'Добро пожаловать в медиа-портал!',
                lead: 'Это первая статья в нашем студенческом медиа-портале. Здесь будут публиковаться работы студентов факультета журналистики.',
                content: '<p>Добро пожаловать в наш новый медиа-портал! Это современная платформа для публикации студенческих работ.</p><p>Здесь вы найдете самые интересные материалы от будущих журналистов.</p>',
                authorId: 'author-1',
                category: 'news',
                tags: ['добро пожаловать', 'новости', 'портал'],
                status: ARTICLE_STATUS.PUBLISHED,
                publishedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                views: 152,
                likes: 23,
                image: null,
                allowComments: true,
                metaTitle: 'Добро пожаловать в медиа-портал',
                metaDescription: 'Первая статья в студенческом медиа-портале факультета журналистики'
            }
        ];

        StorageManager.set(STORAGE_KEYS.ARTICLES, demoArticles);
    }
}

// ===== ЭКСПОРТ ДЛЯ ИСПОЛЬЗОВАНИЯ =====
window.MediaPortal = window.MediaPortal || {};
Object.assign(window.MediaPortal, {
    StorageManager,
    Validator,
    Formatter,
    DOMUtils,
    NotificationManager,
    FileUtils,
    IDGenerator,
    Performance,
    DemoData,
    STORAGE_KEYS,
    ROLES,
    ARTICLE_STATUS,
    COMMENT_STATUS,
    CATEGORIES
});

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Инициализируем демо данные
    DemoData.initializeIfEmpty();
    
    // Инициализируем систему уведомлений
    NotificationManager.init();
    
    console.log('MediaPortal Utils initialized');
});