/**
 * Главное приложение медиа-портала
 * Координирует работу всех компонентов
 */

class MediaPortalApp {
    constructor() {
        this.currentPage = 'home';
        this.isAdmin = false;
        this.initialized = false;
        
        this.init();
    }

    async init() {
        if (this.initialized) return;
        
        try {
            // Определяем текущую страницу
            this.detectCurrentPage();
            
            // Инициализируем компоненты
            this.initComponents();
            
            // Инициализируем интерфейс
            this.initUI();
            
            // Инициализируем навигацию
            this.initNavigation();
            
            // Проверяем авторизацию и обновляем UI
            this.updateAuthState();
            
            // Инициализируем роутинг
            this.initRouting();
            
            // Обработчики глобальных событий
            this.initGlobalHandlers();
            
            this.initialized = true;
            
            console.log('MediaPortal App initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize MediaPortal App:', error);
            this.handleInitializationError(error);
        }
    }

    detectCurrentPage() {
        const path = window.location.pathname;
        
        if (path.includes('admin.html')) {
            this.currentPage = 'admin';
            this.isAdmin = true;
        } else if (path.includes('login.html')) {
            this.currentPage = 'login';
        } else {
            this.currentPage = 'public';
            this.isAdmin = false;
        }
        
        console.log(`Current page detected: ${this.currentPage}`);
    }

    initComponents() {
        // Компоненты уже инициализированы в своих файлах
        // Здесь мы просто проверяем их доступность
        if (typeof authManager === 'undefined') {
            throw new Error('AuthManager not initialized');
        }
        
        if (typeof articleManager === 'undefined') {
            throw new Error('ArticleManager not initialized');
        }
        
        if (typeof commentManager === 'undefined') {
            throw new Error('CommentManager not initialized');
        }
        
        if (typeof mediaManager === 'undefined') {
            throw new Error('MediaManager not initialized');
        }
        
        if (typeof searchManager === 'undefined') {
            throw new Error('SearchManager not initialized');
        }
    }

    initUI() {
        if (this.isAdmin) {
            this.initAdminUI();
        } else {
            this.initPublicUI();
        }
    }

    initPublicUI() {
        // Обновляем навигацию
        this.updateNavigation();
        
        // Инициализируем секции
        this.initSectionSwitching();
        
        // Инициализируем статистику
        this.updatePublicStats();
        
        // Инициализируем форму подписки
        this.initSubscriptionForm();
    }

    initAdminUI() {
        // Инициализируем админскую навигацию
        this.initAdminNavigation();
        
        // Инициализируем дашборд
        this.initDashboard();
        
        // Проверяем права доступа
        this.checkAdminAccess();
        
        // Обновляем счетчики
        this.updateAdminCounts();
    }

    initNavigation() {
        // Обработчики для публичной навигации
        const navLinks = document.querySelectorAll('.nav-link[data-section]');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.dataset.section;
                this.showSection(section);
            });
        });

        // Мобильное меню
        const navToggle = document.getElementById('nav-toggle');
        const navMenu = document.querySelector('.nav-menu');
        
        if (navToggle && navMenu) {
            navToggle.addEventListener('click', () => {
                navMenu.classList.toggle('active');
                navToggle.classList.toggle('active');
                
                // Обновляем арию для доступности
                const expanded = navToggle.classList.contains('active');
                navToggle.setAttribute('aria-expanded', expanded);
            });
        }

        // Закрытие мобильного меню при клике вне его
        document.addEventListener('click', (e) => {
            if (navMenu && navToggle) {
                if (!navMenu.contains(e.target) && !navToggle.contains(e.target)) {
                    navMenu.classList.remove('active');
                    navToggle.classList.remove('active');
                    navToggle.setAttribute('aria-expanded', 'false');
                }
            }
        });

        // Категории в дропдауне
        const categoryLinks = document.querySelectorAll('[data-category]');
        categoryLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const category = e.target.dataset.category;
                this.filterByCategory(category);
            });
        });
    }

    initAdminNavigation() {
        // Боковая навигация в админке
        const sidebarLinks = document.querySelectorAll('.admin-sidebar .nav-link[data-section]');
        sidebarLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.dataset.section;
                this.showAdminSection(section);
            });
        });

        // Подменю
        const subMenuLinks = document.querySelectorAll('.has-submenu > .nav-link');
        subMenuLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const parent = link.parentElement;
                parent.classList.toggle('open');
            });
        });

        // Мобильное меню в админке
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const sidebar = document.querySelector('.admin-sidebar');
        
        if (mobileMenuBtn && sidebar) {
            mobileMenuBtn.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });
        }

        // Сворачивание/разворачивание сайдбара
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
            });
        }
    }

    initSectionSwitching() {
        // Переключение между секциями на главной странице
        const sections = ['home', 'authors', 'about'];
        
        // Показываем активную секцию при загрузке
        const hash = window.location.hash.replace('#', '');
        if (hash && sections.includes(hash)) {
            this.showSection(hash);
        } else {
            this.showSection('home');
        }
    }

    initDashboard() {
        // Инициализируем графики и статистику дашборда
        this.updateDashboardStats();
        
        // Загружаем последние статьи
        this.loadRecentArticles();
        
        // Загружаем комментарии на модерации
        this.loadPendingComments();
    }

    initRouting() {
        // Обработчик изменения хеша
        window.addEventListener('hashchange', () => {
            this.handleRouteChange();
        });
        
        // Обработчик при первой загрузке
        this.handleRouteChange();
    }

    handleRouteChange() {
        const hash = window.location.hash.replace('#', '');
        
        if (hash) {
            // Если хеш содержит ID статьи
            if (hash.startsWith('article-')) {
                const articleId = hash.replace('article-', '');
                if (articleManager) {
                    articleManager.openArticle(articleId);
                }
            } else if (hash.startsWith('author-')) {
                const authorId = hash.replace('author-', '');
                this.filterByAuthor(authorId);
            } else {
                // Обычная секция
                this.showSection(hash);
            }
        }
    }

    initGlobalHandlers() {
        // Обработчик ошибок
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.handleGlobalError(event.error);
        });

        // Обработчик отмены загрузки страницы
        window.addEventListener('beforeunload', (event) => {
            // Сохраняем несохраненные данные
            this.saveUnsavedData();
        });

        // Обработчик изменения размера окна
        window.addEventListener('resize', MediaPortal.Performance.throttle(() => {
            this.handleWindowResize();
        }, 100));

        // Обработчик изменения онлайн статуса
        window.addEventListener('online', () => {
            MediaPortal.NotificationManager.success('Соединение восстановлено');
        });

        window.addEventListener('offline', () => {
            MediaPortal.NotificationManager.warning('Нет соединения с интернетом');
        });

        // Глобальные горячие клавиши
        document.addEventListener('keydown', (e) => {
            this.handleGlobalKeyboard(e);
        });
    }

    // ===== НАВИГАЦИЯ =====
    showSection(sectionName) {
        // Для публичной части
        const sections = document.querySelectorAll('.home-section, .authors-section, .about-section');
        const navLinks = document.querySelectorAll('.nav-link[data-section]');
        
        sections.forEach(section => {
            section.classList.remove('active');
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
        });
        
        const targetSection = document.getElementById(`${sectionName}-section`);
        const targetLink = document.querySelector(`.nav-link[data-section="${sectionName}"]`);
        
        if (targetSection) {
            targetSection.classList.add('active');
        }
        
        if (targetLink) {
            targetLink.classList.add('active');
        }
        
        // Обновляем URL
        if (history.pushState) {
            const newUrl = window.location.pathname + (sectionName !== 'home' ? '#' + sectionName : '');
            history.pushState(null, null, newUrl);
        }
        
        // Загружаем данные для секции
        this.loadSectionData(sectionName);
    }

    showAdminSection(sectionName) {
        // Для админской части
        const sections = document.querySelectorAll('.admin-section');
        const navLinks = document.querySelectorAll('.admin-sidebar .nav-link[data-section]');
        
        sections.forEach(section => {
            section.classList.remove('active');
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
        });
        
        const targetSection = document.getElementById(`${sectionName}-section`);
        const targetLink = document.querySelector(`.admin-sidebar .nav-link[data-section="${sectionName}"]`);
        
        if (targetSection) {
            targetSection.classList.add('active');
        }
        
        if (targetLink) {
            targetLink.classList.add('active');
        }
        
        // Обновляем заголовок страницы
        const pageTitle = document.getElementById('current-page-title');
        if (pageTitle) {
            const titles = {
                'dashboard': 'Панель управления',
                'articles': 'Управление статьями',
                'create-article': 'Создание статьи',
                'comments': 'Управление комментариями',
                'users': 'Управление пользователями',
                'media': 'Медиатека',
                'categories': 'Рубрики и теги',
                'settings': 'Настройки'
            };
            pageTitle.textContent = titles[sectionName] || 'Панель управления';
        }
        
        // Загружаем данные для секции
        this.loadAdminSectionData(sectionName);
    }

    loadSectionData(sectionName) {
        switch (sectionName) {
            case 'home':
                if (articleManager) {
                    articleManager.render();
                }
                break;
                
            case 'authors':
                this.loadAuthors();
                break;
                
            case 'about':
                this.updatePublicStats();
                break;
        }
    }

    loadAdminSectionData(sectionName) {
        switch (sectionName) {
            case 'dashboard':
                this.updateDashboardStats();
                this.loadRecentArticles();
                this.loadPendingComments();
                break;
                
            case 'articles':
                if (articleManager) {
                    articleManager.renderAdminTable();
                }
                break;
                
            case 'comments':
                if (commentManager) {
                    commentManager.renderAdminComments();
                }
                break;
                
            case 'media':
                if (mediaManager) {
                    mediaManager.renderMediaLibrary();
                }
                break;
        }
    }

    // ===== ЗАГРУЗКА ДАННЫХ =====
    loadAuthors() {
        const authorsGrid = document.getElementById('authors-grid');
        if (!authorsGrid) return;
        
        const users = authManager ? authManager.getAllUsers() : [];
        const authors = users.filter(user => user.isActive);
        
        if (authors.length === 0) {
            authorsGrid.innerHTML = `
                <div class="authors-placeholder">
                    <div class="placeholder-content">
                        <i class="fas fa-users"></i>
                        <p>Авторов пока нет</p>
                    </div>
                </div>
            `;
            return;
        }
        
        authorsGrid.innerHTML = authors.map(author => this.createAuthorCard(author)).join('');
    }

    createAuthorCard(author) {
        const articles = articleManager ? 
            articleManager.articles.filter(a => a.authorId === author.id && a.status === MediaPortal.ARTICLE_STATUS.PUBLISHED) : 
            [];
        
        const comments = commentManager ? 
            commentManager.comments.filter(c => c.authorId === author.id && c.status === MediaPortal.COMMENT_STATUS.APPROVED) : 
            [];

        const roleNames = {
            [MediaPortal.ROLES.ADMIN]: 'Администратор',
            [MediaPortal.ROLES.EDITOR]: 'Редактор',
            [MediaPortal.ROLES.AUTHOR]: 'Автор'
        };

        return `
            <div class="author-card" onclick="app.filterByAuthor('${author.id}')">
                <div class="author-avatar large">${MediaPortal.Formatter.initials(`${author.firstName} ${author.lastName}`)}</div>
                <h3 class="author-name">${author.firstName} ${author.lastName}</h3>
                <div class="author-role">${roleNames[author.role] || author.role}</div>
                ${author.bio ? `<p class="author-bio">${author.bio}</p>` : ''}
                <div class="author-stats">
                    <div class="author-stat">
                        <div class="author-stat-number">${articles.length}</div>
                        <div class="author-stat-label">Статей</div>
                    </div>
                    <div class="author-stat">
                        <div class="author-stat-number">${comments.length}</div>
                        <div class="author-stat-label">Комментариев</div>
                    </div>
                </div>
                <button class="btn btn-outline btn-sm">
                    Показать статьи
                </button>
            </div>
        `;
    }

    loadRecentArticles() {
        const container = document.getElementById('recent-articles');
        if (!container) return;
        
        const articles = articleManager ? articleManager.articles.slice(0, 5) : [];
        
        if (articles.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-file-alt"></i>
                    <p>Пока статей нет</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = articles.map(article => {
            const author = authManager ? authManager.getUserById(article.authorId) : null;
            const authorName = author ? `${author.firstName} ${author.lastName}` : 'Неизвестный автор';
            
            return `
                <div class="recent-item" onclick="articleManager.openArticle('${article.id}')">
                    <div class="recent-item-content">
                        <h5 class="recent-item-title">${MediaPortal.Formatter.truncate(article.title, 50)}</h5>
                        <div class="recent-item-meta">
                            <span class="author">${authorName}</span>
                            <span class="date">${MediaPortal.Formatter.timeAgo(article.createdAt)}</span>
                            <span class="status status-${article.status}">${this.getStatusName(article.status)}</span>
                        </div>
                    </div>
                    <div class="recent-item-stats">
                        <span title="Просмотры"><i class="fas fa-eye"></i> ${article.views || 0}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    loadPendingComments() {
        const container = document.getElementById('pending-comments');
        if (!container) return;
        
        const comments = commentManager ? 
            commentManager.comments.filter(c => c.status === MediaPortal.COMMENT_STATUS.PENDING).slice(0, 5) : 
            [];
        
        if (comments.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-comments"></i>
                    <p>Нет комментариев на модерации</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = comments.map(comment => {
            const article = articleManager ? articleManager.getArticleById(comment.articleId) : null;
            const articleTitle = article ? article.title : 'Удаленная статья';
            
            return `
                <div class="pending-item">
                    <div class="pending-item-content">
                        <div class="comment-author">${comment.authorName}</div>
                        <div class="comment-text">${MediaPortal.Formatter.truncate(comment.content, 80)}</div>
                        <div class="comment-article">К статье: "${MediaPortal.Formatter.truncate(articleTitle, 30)}"</div>
                    </div>
                    <div class="pending-item-actions">
                        <button class="btn btn-sm btn-success" onclick="commentManager.approveComment('${comment.id}')">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="commentManager.rejectComment('${comment.id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ===== СТАТИСТИКА =====
    updatePublicStats() {
        if (!articleManager || !commentManager) return;
        
        const publishedArticles = articleManager.articles.filter(a => a.status === MediaPortal.ARTICLE_STATUS.PUBLISHED);
        const approvedComments = commentManager.comments.filter(c => c.status === MediaPortal.COMMENT_STATUS.APPROVED);
        const totalViews = articleManager.articles.reduce((sum, article) => sum + (article.views || 0), 0);
        const activeAuthors = new Set(publishedArticles.map(a => a.authorId)).size;
        
        this.updateStatElement('stats-articles', publishedArticles.length);
        this.updateStatElement('stats-authors', activeAuthors);
        this.updateStatElement('stats-comments', approvedComments.length);
        this.updateStatElement('stats-views', totalViews);
    }

    updateDashboardStats() {
        if (!articleManager) return;
        
        const totalArticles = articleManager.articles.length;
        const publishedArticles = articleManager.articles.filter(a => a.status === MediaPortal.ARTICLE_STATUS.PUBLISHED).length;
        const draftArticles = articleManager.articles.filter(a => a.status === MediaPortal.ARTICLE_STATUS.DRAFT).length;
        const pendingArticles = articleManager.articles.filter(a => a.status === MediaPortal.ARTICLE_STATUS.PENDING).length;
        
        this.updateStatElement('dash-total-articles', totalArticles);
        this.updateStatElement('dash-published-articles', publishedArticles);
        this.updateStatElement('dash-draft-articles', draftArticles);
        this.updateStatElement('dash-pending-articles', pendingArticles);
    }

    updateAdminCounts() {
        if (articleManager) {
            const articlesCount = document.getElementById('articles-count');
            if (articlesCount) {
                articlesCount.textContent = articleManager.articles.length;
            }
        }
        
        if (commentManager) {
            const commentsCount = document.getElementById('comments-count');
            if (commentsCount) {
                const pendingCount = commentManager.comments.filter(c => c.status === MediaPortal.COMMENT_STATUS.PENDING).length;
                commentsCount.textContent = pendingCount;
            }
        }
    }

    updateStatElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = MediaPortal.Formatter.number(value);
        }
    }

    // ===== ФИЛЬТРАЦИЯ =====
    filterByCategory(category) {
        if (articleManager) {
            articleManager.currentFilters.category = category;
            articleManager.currentFilters.author = '';
            articleManager.applyFilters();
        }
        
        // Переходим на главную, если мы не на ней
        this.showSection('home');
    }

    filterByAuthor(authorId) {
        if (articleManager) {
            articleManager.currentFilters.author = authorId;
            articleManager.currentFilters.category = '';
            articleManager.applyFilters();
        }
        
        // Переходим на главную, если мы не на ней
        this.showSection('home');
    }

    // ===== ПОДПИСКА =====
    initSubscriptionForm() {
        const subscribeForm = document.getElementById('subscribe-form');
        if (subscribeForm) {
            subscribeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = e.target.querySelector('input[type="email"]').value;
                this.handleSubscription(email);
            });
        }
    }

    handleSubscription(email) {
        if (!MediaPortal.Validator.email(email)) {
            MediaPortal.NotificationManager.error('Введите корректный email');
            return;
        }
        
        // Имитация подписки
        setTimeout(() => {
            MediaPortal.NotificationManager.success('Спасибо за подписку! Вы будете получать уведомления о новых статьях.');
            const form = document.getElementById('subscribe-form');
            if (form) {
                form.reset();
            }
        }, 1000);
    }

    // ===== СЛУЖЕБНЫЕ ФУНКЦИИ =====
    updateNavigation() {
        // Обновляем состояние навигации в зависимости от авторизации
        const authBtn = document.getElementById('auth-btn');
        if (authBtn && authManager) {
            authManager.updateUI();
        }
    }

    updateAuthState() {
        if (authManager) {
            authManager.updateUI();
            
            // Проверяем доступ к странице
            if (this.isAdmin && !authManager.canAccess([MediaPortal.ROLES.ADMIN, MediaPortal.ROLES.EDITOR, MediaPortal.ROLES.AUTHOR])) {
                MediaPortal.NotificationManager.error('Нет доступа к админ-панели');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            }
        }
    }

    checkAdminAccess() {
        if (!authManager || !authManager.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }
        
        if (!authManager.canAccess([MediaPortal.ROLES.ADMIN, MediaPortal.ROLES.EDITOR, MediaPortal.ROLES.AUTHOR])) {
            MediaPortal.NotificationManager.error('Недостаточно прав для доступа к админ-панели');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        }
    }

    getStatusName(status) {
        const statusNames = {
            [MediaPortal.ARTICLE_STATUS.DRAFT]: 'Черновик',
            [MediaPortal.ARTICLE_STATUS.PENDING]: 'На проверке',
            [MediaPortal.ARTICLE_STATUS.PUBLISHED]: 'Опубликовано',
            [MediaPortal.ARTICLE_STATUS.ARCHIVED]: 'В архиве'
        };
        return statusNames[status] || status;
    }

    // ===== ОБРАБОТКА ОШИБОК =====
    handleInitializationError(error) {
        console.error('App initialization error:', error);
        MediaPortal.NotificationManager.error('Ошибка при загрузке приложения. Попробуйте перезагрузить страницу.');
    }

    handleGlobalError(error) {
        console.error('Global error:', error);
        
        // Не показываем ошибки скриптов и сети пользователю
        if (error.name === 'TypeError' || error.name === 'NetworkError') {
            return;
        }
        
        MediaPortal.NotificationManager.error('Произошла ошибка. Попробуйте еще раз.');
    }

    handleWindowResize() {
        // Обновляем размеры элементов при изменении размера окна
        if (this.isAdmin) {
            // Админская панель
            const sidebar = document.querySelector('.admin-sidebar');
            if (sidebar && window.innerWidth < 768) {
                sidebar.classList.add('collapsed');
            }
        }
    }

    handleGlobalKeyboard(e) {
        // Глобальные горячие клавиши
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'k':
                    e.preventDefault();
                    // Фокус на поиск
                    const searchInput = document.getElementById('search-input');
                    if (searchInput) {
                        searchInput.focus();
                    }
                    break;
                    
                case 'n':
                    if (this.isAdmin && authManager && authManager.canAccess([MediaPortal.ROLES.ADMIN, MediaPortal.ROLES.EDITOR, MediaPortal.ROLES.AUTHOR])) {
                        e.preventDefault();
                        this.showAdminSection('create-article');
                    }
                    break;
            }
        }
        
        // Escape для закрытия модальных окон
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                activeModal.classList.remove('active');
            }
        }
    }

    saveUnsavedData() {
        // Сохраняем несохраненные данные перед закрытием страницы
        // Например, черновик статьи
        if (this.isAdmin) {
            const articleForm = document.getElementById('article-form');
            if (articleForm) {
                const formData = new FormData(articleForm);
                const title = formData.get('title');
                const content = formData.get('content');
                
                if (title || content) {
                    // Сохраняем в localStorage
                    MediaPortal.StorageManager.set('unsaved_article_draft', {
                        title,
                        content,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }
    }
}

// Глобальные функции для вызова из HTML
window.showSection = function(sectionName) {
    if (window.app) {
        if (window.app.isAdmin) {
            window.app.showAdminSection(sectionName);
        } else {
            window.app.showSection(sectionName);
        }
    }
};

// Создаем и инициализируем приложение
const app = new MediaPortalApp();

// Экспортируем в глобальный объект
window.MediaPortal = window.MediaPortal || {};
window.MediaPortal.App = MediaPortalApp;
window.app = app;

console.log('MediaPortal App loaded');