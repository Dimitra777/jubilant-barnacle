/**
 * Система управления статьями для медиа-портала
 * CRUD операции, отображение, фильтрация и поиск
 */

class ArticleManager {
    constructor() {
        this.articles = [];
        this.currentFilters = {
            category: '',
            status: '',
            author: '',
            search: '',
            sort: 'date'
        };
        this.currentView = 'grid';
        this.articlesPerPage = 12;
        this.currentPage = 1;
        this.editor = null; // Quill редактор

        this.init();
    }

    init() {
        this.loadArticles();
        this.initEventHandlers();
        this.initEditor();
        this.render();
    }

    initEventHandlers() {
        // Фильтры на главной странице
        const categoryFilter = document.getElementById('category-filter');
        const sortFilter = document.getElementById('sort-filter');
        
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                this.currentFilters.category = e.target.value;
                this.applyFilters();
            });
        }

        if (sortFilter) {
            sortFilter.addEventListener('change', (e) => {
                this.currentFilters.sort = e.target.value;
                this.applyFilters();
            });
        }

        // Переключение вида отображения
        const viewBtns = document.querySelectorAll('.view-btn');
        viewBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.setView(view);
            });
        });

        // Поиск
        const searchInput = document.getElementById('search-input');
        const searchBtn = document.getElementById('search-btn');
        
        if (searchInput) {
            const debouncedSearch = MediaPortal.Performance.debounce((query) => {
                this.search(query);
            }, 500);
            
            searchInput.addEventListener('input', (e) => {
                debouncedSearch(e.target.value);
            });
        }

        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const query = searchInput ? searchInput.value : '';
                this.search(query);
            });
        }

        // Загрузка дополнительных статей
        const loadMoreBtn = document.getElementById('load-more-btn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.loadMore());
        }

        // Админ панель - управление статьями
        this.initAdminHandlers();
    }

    initAdminHandlers() {
        // Форма создания/редактирования статьи
        const articleForm = document.getElementById('article-form');
        if (articleForm) {
            articleForm.addEventListener('submit', (e) => this.handleArticleSubmit(e));
        }

        // Кнопки сохранения
        const saveDraftBtn = document.getElementById('save-draft-btn');
        const submitArticleBtn = document.getElementById('submit-article-btn');

        if (saveDraftBtn) {
            saveDraftBtn.addEventListener('click', () => this.saveArticleDraft());
        }

        if (submitArticleBtn) {
            submitArticleBtn.addEventListener('click', () => this.submitArticle());
        }

        // Фильтры в админке
        const adminStatusFilter = document.getElementById('articles-status-filter');
        const adminCategoryFilter = document.getElementById('articles-category-filter');

        if (adminStatusFilter) {
            adminStatusFilter.addEventListener('change', (e) => {
                this.currentFilters.status = e.target.value;
                this.renderAdminTable();
            });
        }

        if (adminCategoryFilter) {
            adminCategoryFilter.addEventListener('change', (e) => {
                this.currentFilters.category = e.target.value;
                this.renderAdminTable();
            });
        }

        // Кнопка создания статьи
        const createArticleBtn = document.getElementById('create-new-article-btn');
        if (createArticleBtn) {
            createArticleBtn.addEventListener('click', () => this.showCreateArticleForm());
        }

        // Загрузка изображения
        const articleImageInput = document.getElementById('article-image');
        if (articleImageInput) {
            articleImageInput.addEventListener('change', (e) => this.handleImageUpload(e));
        }
    }

    initEditor() {
        const editorContainer = document.getElementById('article-editor');
        if (editorContainer && typeof Quill !== 'undefined') {
            this.editor = new Quill('#article-editor', {
                theme: 'snow',
                modules: {
                    toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        ['blockquote', 'code-block'],
                        ['link', 'image'],
                        ['clean']
                    ]
                },
                placeholder: 'Напишите содержание статьи...'
            });
        }
    }

    // ===== ЗАГРУЗКА И СОХРАНЕНИЕ ДАННЫХ =====
    loadArticles() {
        this.articles = MediaPortal.StorageManager.get(MediaPortal.STORAGE_KEYS.ARTICLES) || [];
    }

    saveArticles() {
        MediaPortal.StorageManager.set(MediaPortal.STORAGE_KEYS.ARTICLES, this.articles);
    }

    // ===== CRUD ОПЕРАЦИИ =====
    createArticle(articleData) {
        const article = {
            id: MediaPortal.IDGenerator.generate(),
            title: articleData.title,
            lead: articleData.lead,
            content: articleData.content,
            authorId: articleData.authorId || (authManager.currentUser ? authManager.currentUser.id : null),
            category: articleData.category,
            tags: Array.isArray(articleData.tags) ? articleData.tags : this.parseTags(articleData.tags),
            status: articleData.status || MediaPortal.ARTICLE_STATUS.DRAFT,
            publishedAt: articleData.status === MediaPortal.ARTICLE_STATUS.PUBLISHED ? new Date().toISOString() : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            views: 0,
            likes: 0,
            image: articleData.image || null,
            allowComments: articleData.allowComments !== false,
            metaTitle: articleData.metaTitle || articleData.title,
            metaDescription: articleData.metaDescription || articleData.lead
        };

        this.articles.unshift(article);
        this.saveArticles();
        return article;
    }

    updateArticle(articleId, updates) {
        const index = this.articles.findIndex(article => article.id === articleId);
        if (index === -1) {
            throw new Error('Статья не найдена');
        }

        // Проверяем права на редактирование
        if (!this.canEditArticle(this.articles[index])) {
            throw new Error('Нет прав на редактирование этой статьи');
        }

        const article = this.articles[index];
        const updatedArticle = {
            ...article,
            ...updates,
            updatedAt: new Date().toISOString(),
            tags: Array.isArray(updates.tags) ? updates.tags : this.parseTags(updates.tags)
        };

        // Если статус изменился на "опубликовано", устанавливаем дату публикации
        if (updates.status === MediaPortal.ARTICLE_STATUS.PUBLISHED && article.status !== MediaPortal.ARTICLE_STATUS.PUBLISHED) {
            updatedArticle.publishedAt = new Date().toISOString();
        }

        this.articles[index] = updatedArticle;
        this.saveArticles();
        return updatedArticle;
    }

    deleteArticle(articleId) {
        const index = this.articles.findIndex(article => article.id === articleId);
        if (index === -1) {
            throw new Error('Статья не найдена');
        }

        // Проверяем права на удаление
        if (!this.canDeleteArticle(this.articles[index])) {
            throw new Error('Нет прав на удаление этой статьи');
        }

        this.articles.splice(index, 1);
        this.saveArticles();
    }

    getArticleById(articleId) {
        return this.articles.find(article => article.id === articleId);
    }

    // ===== ОБРАБОТЧИКИ ФОРМ =====
    async handleArticleSubmit(e) {
        e.preventDefault();
        
        try {
            const articleData = this.getFormData();
            const errors = this.validateArticleData(articleData);
            
            if (errors.length > 0) {
                MediaPortal.NotificationManager.error(errors.join('\n'));
                return;
            }

            const articleId = document.getElementById('article-id').value;
            
            if (articleId) {
                // Обновляем существующую статью
                this.updateArticle(articleId, articleData);
                MediaPortal.NotificationManager.success('Статья обновлена');
            } else {
                // Создаем новую статью
                this.createArticle(articleData);
                MediaPortal.NotificationManager.success('Статья создана');
            }

            // Возвращаемся к списку статей
            this.showArticlesList();
            
        } catch (error) {
            console.error('Article submit error:', error);
            MediaPortal.NotificationManager.error(error.message || 'Ошибка при сохранении статьи');
        }
    }

    getFormData() {
        const title = document.getElementById('article-title').value.trim();
        const lead = document.getElementById('article-lead').value.trim();
        const content = this.editor ? this.editor.root.innerHTML : '';
        const category = document.getElementById('article-category').value;
        const tags = document.getElementById('article-tags').value;
        const status = document.getElementById('article-status').value;
        const allowComments = document.getElementById('article-allow-comments').checked;
        const metaTitle = document.getElementById('article-meta-title').value.trim();
        const metaDescription = document.getElementById('article-meta-description').value.trim();
        const image = document.getElementById('article-image-preview').dataset.imageUrl || null;

        return {
            title,
            lead,
            content,
            category,
            tags,
            status,
            allowComments,
            metaTitle,
            metaDescription,
            image
        };
    }

    validateArticleData(data) {
        const errors = [];

        if (!MediaPortal.Validator.required(data.title)) {
            errors.push('Заголовок обязателен');
        } else if (!MediaPortal.Validator.maxLength(data.title, 120)) {
            errors.push('Заголовок должен быть не длиннее 120 символов');
        }

        if (!MediaPortal.Validator.required(data.lead)) {
            errors.push('Лид обязателен');
        } else if (!MediaPortal.Validator.maxLength(data.lead, 300)) {
            errors.push('Лид должен быть не длиннее 300 символов');
        }

        if (!MediaPortal.Validator.required(data.content)) {
            errors.push('Содержание статьи обязательно');
        }

        if (!MediaPortal.Validator.required(data.category)) {
            errors.push('Выберите рубрику');
        }

        return errors;
    }

    parseTags(tagsString) {
        if (!tagsString) return [];
        return tagsString
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);
    }

    // ===== ОБРАБОТКА ИЗОБРАЖЕНИЙ =====
    async handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Валидация файла
        if (!MediaPortal.Validator.imageFile(file)) {
            MediaPortal.NotificationManager.error('Выберите файл изображения (JPG, PNG, GIF, WebP)');
            e.target.value = '';
            return;
        }

        if (!MediaPortal.Validator.fileSize(file, 5)) {
            MediaPortal.NotificationManager.error('Размер файла не должен превышать 5 МБ');
            e.target.value = '';
            return;
        }

        try {
            const dataUrl = await MediaPortal.FileUtils.readAsDataURL(file);
            this.setImagePreview(dataUrl);
        } catch (error) {
            console.error('Image upload error:', error);
            MediaPortal.NotificationManager.error('Ошибка при загрузке изображения');
        }
    }

    setImagePreview(imageUrl) {
        const preview = document.getElementById('article-image-preview');
        if (preview) {
            preview.innerHTML = `
                <img src="${imageUrl}" alt="Preview" class="preview-image">
                <button type="button" class="remove-image-btn" onclick="articleManager.removeImagePreview()">
                    <i class="fas fa-times"></i>
                </button>
            `;
            preview.classList.add('has-image');
            preview.dataset.imageUrl = imageUrl;
        }
    }

    removeImagePreview() {
        const preview = document.getElementById('article-image-preview');
        const input = document.getElementById('article-image');
        
        if (preview) {
            preview.innerHTML = `
                <div class="upload-placeholder">
                    <i class="fas fa-image"></i>
                    <p>Нажмите для выбора изображения</p>
                </div>
            `;
            preview.classList.remove('has-image');
            delete preview.dataset.imageUrl;
        }
        
        if (input) {
            input.value = '';
        }
    }

    // ===== БЫСТРЫЕ ДЕЙСТВИЯ =====
    saveArticleDraft() {
        const articleData = this.getFormData();
        articleData.status = MediaPortal.ARTICLE_STATUS.DRAFT;
        
        const errors = this.validateArticleData(articleData);
        if (errors.length > 0) {
            MediaPortal.NotificationManager.error(errors.join('\n'));
            return;
        }

        try {
            const articleId = document.getElementById('article-id').value;
            
            if (articleId) {
                this.updateArticle(articleId, articleData);
            } else {
                this.createArticle(articleData);
            }
            
            MediaPortal.NotificationManager.success('Черновик сохранен');
        } catch (error) {
            MediaPortal.NotificationManager.error(error.message || 'Ошибка при сохранении черновика');
        }
    }

    submitArticle() {
        const articleData = this.getFormData();
        
        // Определяем статус в зависимости от роли пользователя
        if (authManager.canPublishArticles()) {
            articleData.status = MediaPortal.ARTICLE_STATUS.PUBLISHED;
        } else {
            articleData.status = MediaPortal.ARTICLE_STATUS.PENDING;
        }
        
        const errors = this.validateArticleData(articleData);
        if (errors.length > 0) {
            MediaPortal.NotificationManager.error(errors.join('\n'));
            return;
        }

        try {
            const articleId = document.getElementById('article-id').value;
            
            if (articleId) {
                this.updateArticle(articleId, articleData);
            } else {
                this.createArticle(articleData);
            }
            
            const message = authManager.canPublishArticles() ? 
                'Статья опубликована' : 
                'Статья отправлена на проверку';
            
            MediaPortal.NotificationManager.success(message);
            this.showArticlesList();
            
        } catch (error) {
            MediaPortal.NotificationManager.error(error.message || 'Ошибка при отправке статьи');
        }
    }

    // ===== ФИЛЬТРАЦИЯ И ПОИСК =====
    applyFilters() {
        this.currentPage = 1;
        this.render();
    }

    search(query) {
        this.currentFilters.search = query;
        this.applyFilters();
        
        // Показываем результаты поиска в модальном окне, если запрос не пустой
        if (query.trim()) {
            this.showSearchResults(query);
        }
    }

    showSearchResults(query) {
        const filteredArticles = this.getFilteredArticles();
        const modal = document.getElementById('search-modal');
        const resultsContainer = document.getElementById('search-results');
        
        if (!modal || !resultsContainer) return;

        if (filteredArticles.length === 0) {
            resultsContainer.innerHTML = `
                <div class="no-search-results">
                    <i class="fas fa-search"></i>
                    <p>По запросу "${query}" ничего не найдено</p>
                </div>
            `;
        } else {
            resultsContainer.innerHTML = filteredArticles
                .slice(0, 10) // Показываем первые 10 результатов
                .map(article => this.createSearchResultItem(article, query))
                .join('');
        }

        modal.classList.add('active');
    }

    createSearchResultItem(article, query) {
        const author = authManager.getUserById(article.authorId);
        const authorName = author ? `${author.firstName} ${author.lastName}` : 'Неизвестный автор';
        const highlightedTitle = this.highlightText(article.title, query);
        const highlightedLead = this.highlightText(MediaPortal.Formatter.truncate(article.lead, 100), query);

        return `
            <div class="search-result-item" onclick="articleManager.openArticle('${article.id}')">
                <div class="search-result-header">
                    <h4 class="search-result-title">${highlightedTitle}</h4>
                    <span class="search-result-category">${MediaPortal.CATEGORIES[article.category.toUpperCase()]?.name || article.category}</span>
                </div>
                <p class="search-result-lead">${highlightedLead}</p>
                <div class="search-result-meta">
                    <span class="search-result-author">${authorName}</span>
                    <span class="search-result-date">${MediaPortal.Formatter.timeAgo(article.publishedAt || article.createdAt)}</span>
                </div>
            </div>
        `;
    }

    highlightText(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    getFilteredArticles() {
        let filtered = [...this.articles];

        // Фильтр по статусу (только опубликованные для публичной части)
        if (window.location.pathname.includes('admin.html')) {
            // В админке показываем все статьи с учетом фильтра
            if (this.currentFilters.status) {
                filtered = filtered.filter(article => article.status === this.currentFilters.status);
            }
        } else {
            // На публичной части показываем только опубликованные
            filtered = filtered.filter(article => article.status === MediaPortal.ARTICLE_STATUS.PUBLISHED);
        }

        // Фильтр по категории
        if (this.currentFilters.category) {
            filtered = filtered.filter(article => article.category === this.currentFilters.category);
        }

        // Фильтр по автору
        if (this.currentFilters.author) {
            filtered = filtered.filter(article => article.authorId === this.currentFilters.author);
        }

        // Поиск
        if (this.currentFilters.search) {
            const query = this.currentFilters.search.toLowerCase();
            filtered = filtered.filter(article => 
                article.title.toLowerCase().includes(query) ||
                article.lead.toLowerCase().includes(query) ||
                article.content.toLowerCase().includes(query) ||
                article.tags.some(tag => tag.toLowerCase().includes(query))
            );
        }

        // Сортировка
        this.sortArticles(filtered);

        return filtered;
    }

    sortArticles(articles) {
        articles.sort((a, b) => {
            switch (this.currentFilters.sort) {
                case 'views':
                    return b.views - a.views;
                case 'likes':
                    return b.likes - a.likes;
                case 'title':
                    return a.title.localeCompare(b.title);
                case 'date':
                default:
                    const aDate = new Date(a.publishedAt || a.createdAt);
                    const bDate = new Date(b.publishedAt || b.createdAt);
                    return bDate - aDate;
            }
        });
    }

    // ===== ОТОБРАЖЕНИЕ =====
    render() {
        const articlesGrid = document.getElementById('articles-grid');
        const heroContent = document.getElementById('hero-content');
        
        if (articlesGrid) {
            this.renderArticlesGrid();
        }
        
        if (heroContent) {
            this.renderHeroSection();
        }

        // Обновляем админ таблицу если мы в админке
        if (window.location.pathname.includes('admin.html')) {
            this.renderAdminTable();
            this.updateDashboardStats();
        }
    }

    renderArticlesGrid() {
        const articlesGrid = document.getElementById('articles-grid');
        if (!articlesGrid) return;

        const filteredArticles = this.getFilteredArticles();
        const startIndex = (this.currentPage - 1) * this.articlesPerPage;
        const endIndex = startIndex + this.articlesPerPage;
        const articlesToShow = filteredArticles.slice(0, endIndex);

        if (articlesToShow.length === 0) {
            articlesGrid.innerHTML = `
                <div class="articles-placeholder">
                    <div class="placeholder-content">
                        <i class="fas fa-file-alt"></i>
                        <p>Статей пока нет</p>
                        ${authManager.isAuthenticated() ? '<a href="#" id="create-article-link">Создайте первую статью</a>' : ''}
                    </div>
                </div>
            `;
            
            // Привязываем обработчик к ссылке создания статьи
            const createLink = document.getElementById('create-article-link');
            if (createLink) {
                createLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (authManager.isAuthenticated()) {
                        window.location.href = 'admin.html#create-article';
                    } else {
                        window.location.href = 'login.html';
                    }
                });
            }
        } else {
            articlesGrid.innerHTML = articlesToShow.map(article => this.createArticleCard(article)).join('');
            articlesGrid.className = `articles-grid ${this.currentView}-view`;
        }

        // Показать/скрыть кнопку "Загрузить еще"
        const loadMoreBtn = document.getElementById('load-more-btn');
        if (loadMoreBtn) {
            if (endIndex < filteredArticles.length) {
                loadMoreBtn.style.display = 'block';
            } else {
                loadMoreBtn.style.display = 'none';
            }
        }
    }

    renderHeroSection() {
        const heroContent = document.getElementById('hero-content');
        if (!heroContent) return;

        const publishedArticles = this.articles.filter(article => 
            article.status === MediaPortal.ARTICLE_STATUS.PUBLISHED
        );

        if (publishedArticles.length === 0) {
            heroContent.innerHTML = `
                <div class="main-article-placeholder">
                    <div class="placeholder-content">
                        <i class="fas fa-newspaper"></i>
                        <p>Пока нет опубликованных статей</p>
                    </div>
                </div>
            `;
            return;
        }

        // Показываем последнюю опубликованную статью
        const latestArticle = publishedArticles
            .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))[0];

        const author = authManager.getUserById(latestArticle.authorId);
        const authorName = author ? `${author.firstName} ${author.lastName}` : 'Неизвестный автор';

        heroContent.innerHTML = `
            <div class="main-article" onclick="articleManager.openArticle('${latestArticle.id}')">
                ${latestArticle.image ? 
                    `<div class="main-article-image">
                        <img src="${latestArticle.image}" alt="${latestArticle.title}">
                    </div>` : 
                    ''
                }
                <div class="main-article-content">
                    <span class="main-article-category">${MediaPortal.CATEGORIES[latestArticle.category.toUpperCase()]?.name || latestArticle.category}</span>
                    <h2 class="main-article-title">${latestArticle.title}</h2>
                    <p class="main-article-lead">${latestArticle.lead}</p>
                    <div class="main-article-meta">
                        <span class="main-article-author">${authorName}</span>
                        <span class="main-article-date">${MediaPortal.Formatter.timeAgo(latestArticle.publishedAt)}</span>
                        <span class="main-article-stats">
                            <i class="fas fa-eye"></i> ${MediaPortal.Formatter.number(latestArticle.views)}
                            <i class="fas fa-heart"></i> ${MediaPortal.Formatter.number(latestArticle.likes)}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }

    createArticleCard(article) {
        const author = authManager.getUserById(article.authorId);
        const authorName = author ? `${author.firstName} ${author.lastName}` : 'Неизвестный автор';
        const authorInitials = author ? MediaPortal.Formatter.initials(`${author.firstName} ${author.lastName}`) : '?';
        const categoryName = MediaPortal.CATEGORIES[article.category.toUpperCase()]?.name || article.category;

        return `
            <div class="article-card" onclick="articleManager.openArticle('${article.id}')">
                <div class="article-image">
                    ${article.image ? 
                        `<img src="${article.image}" alt="${article.title}" loading="lazy">` :
                        `<div class="article-placeholder-image">
                            <i class="fas fa-file-alt"></i>
                        </div>`
                    }
                    <div class="article-category">${categoryName}</div>
                </div>
                <div class="article-content">
                    <h3 class="article-title">${article.title}</h3>
                    <p class="article-lead">${article.lead}</p>
                    <div class="article-meta">
                        <div class="article-author">
                            <div class="author-avatar">${authorInitials}</div>
                            <div class="author-info">
                                <div class="author-name">${authorName}</div>
                                <div class="article-date">${MediaPortal.Formatter.timeAgo(article.publishedAt || article.createdAt)}</div>
                            </div>
                        </div>
                        <div class="article-stats">
                            <span title="Просмотры"><i class="fas fa-eye"></i> ${MediaPortal.Formatter.number(article.views)}</span>
                            <span title="Лайки"><i class="fas fa-heart"></i> ${MediaPortal.Formatter.number(article.likes)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ===== ОТКРЫТИЕ СТАТЬИ =====
    openArticle(articleId) {
        const article = this.getArticleById(articleId);
        if (!article) {
            MediaPortal.NotificationManager.error('Статья не найдена');
            return;
        }

        // Увеличиваем счетчик просмотров
        this.incrementViews(articleId);

        // Показываем статью в модальном окне
        this.showArticleModal(article);

        // Закрываем модальное окно поиска если оно открыто
        const searchModal = document.getElementById('search-modal');
        if (searchModal) {
            searchModal.classList.remove('active');
        }
    }

    showArticleModal(article) {
        const modal = document.getElementById('article-modal');
        const content = document.getElementById('article-content');
        
        if (!modal || !content) return;

        const author = authManager.getUserById(article.authorId);
        const authorName = author ? `${author.firstName} ${author.lastName}` : 'Неизвестный автор';
        const categoryName = MediaPortal.CATEGORIES[article.category.toUpperCase()]?.name || article.category;

        content.innerHTML = `
            <article class="article-full">
                <header class="article-header">
                    <div class="article-meta-top">
                        <span class="article-category-badge">${categoryName}</span>
                        <time class="article-publish-date" datetime="${article.publishedAt || article.createdAt}">
                            ${MediaPortal.Formatter.date(article.publishedAt || article.createdAt)}
                        </time>
                    </div>
                    
                    <h1 class="article-full-title">${article.title}</h1>
                    
                    <div class="article-lead-full">
                        ${article.lead}
                    </div>
                    
                    ${article.image ? `
                        <div class="article-featured-image">
                            <img src="${article.image}" alt="${article.title}">
                        </div>
                    ` : ''}
                    
                    <div class="article-author-info">
                        <div class="author-avatar large">${MediaPortal.Formatter.initials(authorName)}</div>
                        <div class="author-details">
                            <h4 class="author-name">${authorName}</h4>
                            ${author?.bio ? `<p class="author-bio">${author.bio}</p>` : ''}
                        </div>
                        <div class="article-stats-full">
                            <span><i class="fas fa-eye"></i> ${MediaPortal.Formatter.number(article.views)}</span>
                            <span><i class="fas fa-heart"></i> ${MediaPortal.Formatter.number(article.likes)}</span>
                        </div>
                    </div>
                </header>
                
                <div class="article-content-full">
                    ${article.content}
                </div>
                
                <footer class="article-footer">
                    <div class="article-tags">
                        ${article.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
                    </div>
                    
                    <div class="article-actions">
                        <button class="btn btn-outline" onclick="articleManager.likeArticle('${article.id}')">
                            <i class="fas fa-heart"></i>
                            Нравится (${article.likes})
                        </button>
                        
                        <div class="article-share">
                            <span>Поделиться:</span>
                            <button class="share-btn" onclick="articleManager.shareArticle('${article.id}', 'vk')" title="ВКонтакте">
                                <i class="fab fa-vk"></i>
                            </button>
                            <button class="share-btn" onclick="articleManager.shareArticle('${article.id}', 'telegram')" title="Telegram">
                                <i class="fab fa-telegram"></i>
                            </button>
                            <button class="share-btn" onclick="articleManager.copyLink('${article.id}')" title="Скопировать ссылку">
                                <i class="fas fa-link"></i>
                            </button>
                        </div>
                    </div>
                </footer>
            </article>
        `;

        modal.classList.add('active');
    }

    incrementViews(articleId) {
        const article = this.getArticleById(articleId);
        if (article) {
            article.views = (article.views || 0) + 1;
            this.saveArticles();
        }
    }

    likeArticle(articleId) {
        const article = this.getArticleById(articleId);
        if (article) {
            article.likes = (article.likes || 0) + 1;
            this.saveArticles();
            
            // Обновляем отображение лайков
            const likeBtn = document.querySelector(`[onclick="articleManager.likeArticle('${articleId}')"]`);
            if (likeBtn) {
                likeBtn.innerHTML = `
                    <i class="fas fa-heart"></i>
                    Нравится (${article.likes})
                `;
            }
            
            MediaPortal.NotificationManager.success('Спасибо за оценку!', 2000);
        }
    }

    shareArticle(articleId, platform) {
        const article = this.getArticleById(articleId);
        if (!article) return;

        const url = encodeURIComponent(window.location.origin);
        const title = encodeURIComponent(article.title);
        const description = encodeURIComponent(article.lead);

        const shareUrls = {
            vk: `https://vk.com/share.php?url=${url}&title=${title}&description=${description}`,
            telegram: `https://t.me/share/url?url=${url}&text=${title}`,
            twitter: `https://twitter.com/intent/tweet?url=${url}&text=${title}`,
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`
        };

        if (shareUrls[platform]) {
            window.open(shareUrls[platform], '_blank', 'width=600,height=400');
        }
    }

    copyLink(articleId) {
        const link = `${window.location.origin}/#article-${articleId}`;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(link).then(() => {
                MediaPortal.NotificationManager.success('Ссылка скопирована в буфер обмена');
            });
        } else {
            // Fallback для старых браузеров
            const textarea = document.createElement('textarea');
            textarea.value = link;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            MediaPortal.NotificationManager.success('Ссылка скопирована');
        }
    }

    // ===== УПРАВЛЕНИЕ ВИДОМ ОТОБРАЖЕНИЯ =====
    setView(view) {
        this.currentView = view;
        
        // Обновляем активную кнопку
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        // Обновляем сетку
        const articlesGrid = document.getElementById('articles-grid');
        if (articlesGrid) {
            articlesGrid.className = `articles-grid ${view}-view`;
        }
    }

    loadMore() {
        this.currentPage++;
        this.renderArticlesGrid();
    }

    // ===== АДМИНСКИЕ ФУНКЦИИ =====
    renderAdminTable() {
        const tableBody = document.getElementById('articles-table-body');
        if (!tableBody) return;

        const filteredArticles = this.getFilteredArticles();

        if (filteredArticles.length === 0) {
            tableBody.innerHTML = `
                <tr class="no-data-row">
                    <td colspan="7">
                        <div class="no-data">
                            <i class="fas fa-file-alt"></i>
                            <p>Статей пока нет</p>
                            <button class="btn btn-primary" onclick="articleManager.showCreateArticleForm()">
                                Создать первую статью
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = filteredArticles.map(article => {
            const author = authManager.getUserById(article.authorId);
            const authorName = author ? `${author.firstName} ${author.lastName}` : 'Неизвестный автор';
            const categoryName = MediaPortal.CATEGORIES[article.category.toUpperCase()]?.name || article.category;

            return `
                <tr>
                    <td>
                        <div class="article-title-cell">
                            <strong>${article.title}</strong>
                            <small>${MediaPortal.Formatter.truncate(article.lead, 60)}</small>
                        </div>
                    </td>
                    <td>${authorName}</td>
                    <td>${categoryName}</td>
                    <td>
                        <span class="status-badge ${article.status}">${this.getStatusName(article.status)}</span>
                    </td>
                    <td>${MediaPortal.Formatter.date(article.publishedAt || article.createdAt)}</td>
                    <td>${MediaPortal.Formatter.number(article.views)}</td>
                    <td>
                        <div class="table-actions">
                            ${this.canEditArticle(article) ? 
                                `<button class="table-action edit" onclick="articleManager.editArticle('${article.id}')" title="Редактировать">
                                    <i class="fas fa-edit"></i>
                                </button>` : ''
                            }
                            <button class="table-action view" onclick="articleManager.openArticle('${article.id}')" title="Просмотр">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${this.canDeleteArticle(article) ? 
                                `<button class="table-action delete" onclick="articleManager.confirmDeleteArticle('${article.id}')" title="Удалить">
                                    <i class="fas fa-trash"></i>
                                </button>` : ''
                            }
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
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

    showCreateArticleForm() {
        // Очищаем форму
        this.clearArticleForm();
        
        // Показываем секцию создания статьи
        if (typeof window.showSection === 'function') {
            window.showSection('create-article');
        }
        
        // Обновляем заголовок
        const title = document.getElementById('article-form-title');
        if (title) {
            title.textContent = 'Создание статьи';
        }
    }

    editArticle(articleId) {
        const article = this.getArticleById(articleId);
        if (!article) {
            MediaPortal.NotificationManager.error('Статья не найдена');
            return;
        }

        if (!this.canEditArticle(article)) {
            MediaPortal.NotificationManager.error('Нет прав на редактирование этой статьи');
            return;
        }

        // Заполняем форму данными статьи
        this.fillArticleForm(article);
        
        // Показываем секцию редактирования
        if (typeof window.showSection === 'function') {
            window.showSection('create-article');
        }
        
        // Обновляем заголовок
        const title = document.getElementById('article-form-title');
        if (title) {
            title.textContent = 'Редактирование статьи';
        }
    }

    fillArticleForm(article) {
        document.getElementById('article-id').value = article.id;
        document.getElementById('article-title').value = article.title;
        document.getElementById('article-lead').value = article.lead;
        document.getElementById('article-category').value = article.category;
        document.getElementById('article-tags').value = article.tags.join(', ');
        document.getElementById('article-status').value = article.status;
        document.getElementById('article-allow-comments').checked = article.allowComments;
        document.getElementById('article-meta-title').value = article.metaTitle || '';
        document.getElementById('article-meta-description').value = article.metaDescription || '';

        if (this.editor) {
            this.editor.root.innerHTML = article.content;
        }

        if (article.image) {
            this.setImagePreview(article.image);
        }
    }

    clearArticleForm() {
        document.getElementById('article-id').value = '';
        document.getElementById('article-title').value = '';
        document.getElementById('article-lead').value = '';
        document.getElementById('article-category').value = '';
        document.getElementById('article-tags').value = '';
        document.getElementById('article-status').value = MediaPortal.ARTICLE_STATUS.DRAFT;
        document.getElementById('article-allow-comments').checked = true;
        document.getElementById('article-meta-title').value = '';
        document.getElementById('article-meta-description').value = '';

        if (this.editor) {
            this.editor.root.innerHTML = '';
        }

        this.removeImagePreview();
    }

    confirmDeleteArticle(articleId) {
        const article = this.getArticleById(articleId);
        if (!article) return;

        if (!this.canDeleteArticle(article)) {
            MediaPortal.NotificationManager.error('Нет прав на удаление этой статьи');
            return;
        }

        if (confirm(`Вы уверены, что хотите удалить статью "${article.title}"?`)) {
            try {
                this.deleteArticle(articleId);
                MediaPortal.NotificationManager.success('Статья удалена');
                this.renderAdminTable();
                this.updateDashboardStats();
            } catch (error) {
                MediaPortal.NotificationManager.error(error.message || 'Ошибка при удалении статьи');
            }
        }
    }

    showArticlesList() {
        if (typeof window.showSection === 'function') {
            window.showSection('articles');
        }
    }

    // ===== ПРОВЕРКА ПРАВ =====
    canEditArticle(article) {
        if (!authManager.isAuthenticated()) return false;
        
        const currentUser = authManager.getCurrentUser();
        
        // Админы и редакторы могут редактировать любые статьи
        if (authManager.hasRole(MediaPortal.ROLES.ADMIN) || authManager.hasRole(MediaPortal.ROLES.EDITOR)) {
            return true;
        }
        
        // Авторы могут редактировать только свои статьи
        return article.authorId === currentUser.id;
    }

    canDeleteArticle(article) {
        if (!authManager.isAuthenticated()) return false;
        
        const currentUser = authManager.getCurrentUser();
        
        // Админы могут удалять любые статьи
        if (authManager.hasRole(MediaPortal.ROLES.ADMIN)) {
            return true;
        }
        
        // Редакторы могут удалять статьи, кроме опубликованных админом
        if (authManager.hasRole(MediaPortal.ROLES.EDITOR)) {
            const author = authManager.getUserById(article.authorId);
            return !author || author.role !== MediaPortal.ROLES.ADMIN;
        }
        
        // Авторы могут удалять только свои неопубликованные статьи
        if (authManager.hasRole(MediaPortal.ROLES.AUTHOR)) {
            return article.authorId === currentUser.id && 
                   article.status !== MediaPortal.ARTICLE_STATUS.PUBLISHED;
        }
        
        return false;
    }

    // ===== СТАТИСТИКА =====
    updateDashboardStats() {
        const totalArticles = document.getElementById('dash-total-articles');
        const publishedArticles = document.getElementById('dash-published-articles');
        const draftArticles = document.getElementById('dash-draft-articles');
        const pendingArticles = document.getElementById('dash-pending-articles');

        if (totalArticles) {
            totalArticles.textContent = MediaPortal.Formatter.number(this.articles.length);
        }

        if (publishedArticles) {
            const published = this.articles.filter(a => a.status === MediaPortal.ARTICLE_STATUS.PUBLISHED).length;
            publishedArticles.textContent = MediaPortal.Formatter.number(published);
        }

        if (draftArticles) {
            const drafts = this.articles.filter(a => a.status === MediaPortal.ARTICLE_STATUS.DRAFT).length;
            draftArticles.textContent = MediaPortal.Formatter.number(drafts);
        }

        if (pendingArticles) {
            const pending = this.articles.filter(a => a.status === MediaPortal.ARTICLE_STATUS.PENDING).length;
            pendingArticles.textContent = MediaPortal.Formatter.number(pending);
        }

        // Обновляем счетчики в навигации
        const articlesCountBadge = document.getElementById('articles-count');
        if (articlesCountBadge) {
            articlesCountBadge.textContent = this.articles.length;
        }

        // Обновляем статистику на главной странице
        this.updatePublicStats();
    }

    updatePublicStats() {
        const statsArticles = document.getElementById('stats-articles');
        const statsViews = document.getElementById('stats-views');
        
        if (statsArticles) {
            const published = this.articles.filter(a => a.status === MediaPortal.ARTICLE_STATUS.PUBLISHED).length;
            statsArticles.textContent = MediaPortal.Formatter.number(published);
        }

        if (statsViews) {
            const totalViews = this.articles.reduce((sum, article) => sum + (article.views || 0), 0);
            statsViews.textContent = MediaPortal.Formatter.number(totalViews);
        }
    }
}

// Создаем глобальный экземпляр
const articleManager = new ArticleManager();

// Экспортируем в глобальный объект
window.MediaPortal = window.MediaPortal || {};
window.MediaPortal.ArticleManager = ArticleManager;
window.articleManager = articleManager;

// Инициализируем при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    articleManager.render();
});