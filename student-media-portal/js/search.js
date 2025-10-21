/**
 * Система поиска для медиа-портала
 * Расширенный поиск с фильтрацией, автодополнением и историей
 */

class SearchManager {
    constructor() {
        this.searchHistory = [];
        this.searchSuggestions = [];
        this.searchIndex = new Map();
        this.currentQuery = '';
        this.searchFilters = {
            category: '',
            author: '',
            dateFrom: '',
            dateTo: '',
            tags: []
        };
        
        this.init();
    }

    init() {
        this.loadSearchHistory();
        this.buildSearchIndex();
        this.initEventHandlers();
    }

    initEventHandlers() {
        // Главный поиск
        const searchInput = document.getElementById('search-input');
        const searchBtn = document.getElementById('search-btn');

        if (searchInput) {
            // Debounced поиск при вводе
            const debouncedSearch = MediaPortal.Performance.debounce((query) => {
                this.performSearch(query);
            }, 300);

            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                this.currentQuery = query;
                
                if (query.length >= 2) {
                    debouncedSearch(query);
                    this.showSuggestions(query);
                } else {
                    this.hideSuggestions();
                }
            });

            // Обработка клавиш
            searchInput.addEventListener('keydown', (e) => {
                this.handleKeyNavigation(e);
            });

            // Фокус и потеря фокуса
            searchInput.addEventListener('focus', () => {
                if (this.currentQuery.length >= 2) {
                    this.showSuggestions(this.currentQuery);
                }
            });

            searchInput.addEventListener('blur', () => {
                // Задержка, чтобы можно было кликнуть на подсказку
                setTimeout(() => this.hideSuggestions(), 200);
            });
        }

        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const query = searchInput ? searchInput.value.trim() : '';
                if (query) {
                    this.performSearch(query, true);
                }
            });
        }

        // Расширенный поиск
        this.initAdvancedSearch();
        
        // Обработчики для результатов поиска
        this.initSearchResults();
    }

    initAdvancedSearch() {
        // Кнопка расширенного поиска
        const advancedBtn = document.getElementById('advanced-search-btn');
        if (advancedBtn) {
            advancedBtn.addEventListener('click', () => this.showAdvancedSearch());
        }

        // Фильтры в расширенном поиске
        const advancedForm = document.getElementById('advanced-search-form');
        if (advancedForm) {
            advancedForm.addEventListener('submit', (e) => this.handleAdvancedSearch(e));
        }
    }

    initSearchResults() {
        // Обработчики модального окна результатов поиска
        const searchModal = document.getElementById('search-modal');
        const searchModalClose = document.getElementById('search-modal-close');

        if (searchModalClose) {
            searchModalClose.addEventListener('click', () => {
                searchModal.classList.remove('active');
            });
        }

        if (searchModal) {
            searchModal.addEventListener('click', (e) => {
                if (e.target === searchModal) {
                    searchModal.classList.remove('active');
                }
            });
        }
    }

    // ===== ИНДЕКСАЦИЯ ДЛЯ ПОИСКА =====
    buildSearchIndex() {
        this.searchIndex.clear();
        
        // Индексируем статьи
        const articles = articleManager ? articleManager.articles : [];
        articles.forEach(article => {
            if (article.status === MediaPortal.ARTICLE_STATUS.PUBLISHED) {
                this.indexArticle(article);
            }
        });

        // Индексируем авторов
        const users = authManager ? authManager.getAllUsers() : [];
        users.forEach(user => {
            this.indexUser(user);
        });

        // Создаем список подсказок
        this.buildSuggestions();
    }

    indexArticle(article) {
        const searchableText = [
            article.title,
            article.lead,
            article.content.replace(/<[^>]*>/g, ''), // Убираем HTML теги
            ...article.tags,
            MediaPortal.CATEGORIES[article.category?.toUpperCase()]?.name || article.category
        ].join(' ').toLowerCase();

        const words = this.extractWords(searchableText);
        
        words.forEach(word => {
            if (!this.searchIndex.has(word)) {
                this.searchIndex.set(word, []);
            }
            
            this.searchIndex.get(word).push({
                type: 'article',
                id: article.id,
                title: article.title,
                lead: article.lead,
                category: article.category,
                publishedAt: article.publishedAt,
                relevance: this.calculateWordRelevance(word, article)
            });
        });
    }

    indexUser(user) {
        const searchableText = [
            user.firstName,
            user.lastName,
            user.bio || ''
        ].join(' ').toLowerCase();

        const words = this.extractWords(searchableText);
        
        words.forEach(word => {
            if (!this.searchIndex.has(word)) {
                this.searchIndex.set(word, []);
            }
            
            this.searchIndex.get(word).push({
                type: 'author',
                id: user.id,
                name: `${user.firstName} ${user.lastName}`,
                role: user.role,
                bio: user.bio,
                relevance: 1
            });
        });
    }

    extractWords(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\sа-яё]/gi, ' ')
            .split(/\s+/)
            .filter(word => word.length >= 2);
    }

    calculateWordRelevance(word, article) {
        let relevance = 1;
        
        // Больший вес для совпадений в заголовке
        if (article.title.toLowerCase().includes(word)) {
            relevance += 3;
        }
        
        // Средний вес для совпадений в лиде
        if (article.lead.toLowerCase().includes(word)) {
            relevance += 2;
        }
        
        // Больший вес для совпадений в тегах
        if (article.tags.some(tag => tag.toLowerCase().includes(word))) {
            relevance += 2;
        }
        
        return relevance;
    }

    buildSuggestions() {
        this.searchSuggestions = [];
        
        // Добавляем популярные поисковые термы
        const popularTerms = this.getPopularSearchTerms();
        this.searchSuggestions.push(...popularTerms);
        
        // Добавляем категории
        Object.values(MediaPortal.CATEGORIES).forEach(category => {
            this.searchSuggestions.push({
                type: 'category',
                text: category.name,
                icon: category.icon
            });
        });
        
        // Добавляем популярные теги
        const popularTags = this.getPopularTags();
        popularTags.forEach(tag => {
            this.searchSuggestions.push({
                type: 'tag',
                text: tag,
                icon: 'fas fa-tag'
            });
        });
    }

    getPopularSearchTerms() {
        // Анализируем историю поиска для получения популярных терминов
        const termCounts = new Map();
        
        this.searchHistory.forEach(query => {
            const words = this.extractWords(query.query);
            words.forEach(word => {
                termCounts.set(word, (termCounts.get(word) || 0) + 1);
            });
        });
        
        return Array.from(termCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([term, count]) => ({
                type: 'term',
                text: term,
                icon: 'fas fa-search',
                count
            }));
    }

    getPopularTags() {
        const articles = articleManager ? articleManager.articles : [];
        const tagCounts = new Map();
        
        articles.forEach(article => {
            if (article.status === MediaPortal.ARTICLE_STATUS.PUBLISHED) {
                article.tags.forEach(tag => {
                    tagCounts.set(tag.toLowerCase(), (tagCounts.get(tag.toLowerCase()) || 0) + 1);
                });
            }
        });
        
        return Array.from(tagCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([tag, count]) => tag);
    }

    // ===== ВЫПОЛНЕНИЕ ПОИСКА =====
    performSearch(query, addToHistory = false) {
        if (!query || query.length < 2) {
            return { articles: [], authors: [], total: 0 };
        }

        const results = this.searchInIndex(query);
        
        if (addToHistory) {
            this.addToSearchHistory(query, results.total);
            this.showSearchResults(query, results);
        }
        
        return results;
    }

    searchInIndex(query) {
        const queryWords = this.extractWords(query);
        const resultMap = new Map();
        
        queryWords.forEach(word => {
            // Поиск точного совпадения
            if (this.searchIndex.has(word)) {
                this.searchIndex.get(word).forEach(result => {
                    const key = `${result.type}-${result.id}`;
                    if (!resultMap.has(key)) {
                        resultMap.set(key, { ...result, score: 0 });
                    }
                    resultMap.get(key).score += result.relevance;
                });
            }
            
            // Поиск частичного совпадения
            this.searchIndex.forEach((results, indexWord) => {
                if (indexWord.includes(word) && indexWord !== word) {
                    results.forEach(result => {
                        const key = `${result.type}-${result.id}`;
                        if (!resultMap.has(key)) {
                            resultMap.set(key, { ...result, score: 0 });
                        }
                        resultMap.get(key).score += result.relevance * 0.5; // Меньший вес для частичных совпадений
                    });
                }
            });
        });
        
        // Группируем результаты по типу
        const articles = [];
        const authors = [];
        
        Array.from(resultMap.values())
            .sort((a, b) => b.score - a.score)
            .forEach(result => {
                if (result.type === 'article') {
                    articles.push(result);
                } else if (result.type === 'author') {
                    authors.push(result);
                }
            });
        
        return {
            articles: articles.slice(0, 20), // Ограничиваем количество результатов
            authors: authors.slice(0, 10),
            total: articles.length + authors.length,
            query
        };
    }

    // ===== ПРОДВИНУТЫЙ ПОИСК =====
    handleAdvancedSearch(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const filters = {
            query: formData.get('query') || '',
            category: formData.get('category') || '',
            author: formData.get('author') || '',
            dateFrom: formData.get('dateFrom') || '',
            dateTo: formData.get('dateTo') || '',
            tags: formData.get('tags') ? formData.get('tags').split(',').map(t => t.trim()) : []
        };
        
        const results = this.advancedSearch(filters);
        this.showSearchResults(this.buildSearchQueryString(filters), results);
        
        // Закрываем модальное окно продвинутого поиска
        const modal = document.getElementById('advanced-search-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    advancedSearch(filters) {
        let articles = articleManager ? [...articleManager.articles] : [];
        
        // Фильтруем только опубликованные статьи
        articles = articles.filter(article => article.status === MediaPortal.ARTICLE_STATUS.PUBLISHED);
        
        // Применяем фильтры
        if (filters.category) {
            articles = articles.filter(article => article.category === filters.category);
        }
        
        if (filters.author) {
            articles = articles.filter(article => article.authorId === filters.author);
        }
        
        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            articles = articles.filter(article => 
                new Date(article.publishedAt || article.createdAt) >= fromDate
            );
        }
        
        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            articles = articles.filter(article => 
                new Date(article.publishedAt || article.createdAt) <= toDate
            );
        }
        
        if (filters.tags.length > 0) {
            articles = articles.filter(article => 
                filters.tags.some(filterTag => 
                    article.tags.some(articleTag => 
                        articleTag.toLowerCase().includes(filterTag.toLowerCase())
                    )
                )
            );
        }
        
        // Если есть текстовый запрос, выполняем поиск по нему
        if (filters.query && filters.query.length >= 2) {
            const textResults = this.searchInIndex(filters.query);
            const articleIds = new Set(textResults.articles.map(a => a.id));
            articles = articles.filter(article => articleIds.has(article.id));
            
            // Сортируем по релевантности из текстового поиска
            const relevanceMap = new Map();
            textResults.articles.forEach(result => {
                relevanceMap.set(result.id, result.score);
            });
            
            articles.sort((a, b) => (relevanceMap.get(b.id) || 0) - (relevanceMap.get(a.id) || 0));
        } else {
            // Сортируем по дате публикации
            articles.sort((a, b) => 
                new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt)
            );
        }
        
        return {
            articles: articles.map(article => ({
                type: 'article',
                id: article.id,
                title: article.title,
                lead: article.lead,
                category: article.category,
                publishedAt: article.publishedAt || article.createdAt
            })),
            authors: [], // В продвинутом поиске пока только статьи
            total: articles.length,
            query: this.buildSearchQueryString(filters)
        };
    }

    buildSearchQueryString(filters) {
        const parts = [];
        
        if (filters.query) parts.push(filters.query);
        if (filters.category) parts.push(`категория:${MediaPortal.CATEGORIES[filters.category.toUpperCase()]?.name || filters.category}`);
        if (filters.author) {
            const author = authManager.getUserById(filters.author);
            if (author) parts.push(`автор:${author.firstName} ${author.lastName}`);
        }
        if (filters.tags.length > 0) parts.push(`теги:${filters.tags.join(', ')}`);
        
        return parts.join(' ');
    }

    // ===== ПОДСКАЗКИ =====
    showSuggestions(query) {
        const suggestions = this.getSuggestions(query);
        if (suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }
        
        let suggestionsContainer = document.getElementById('search-suggestions');
        if (!suggestionsContainer) {
            suggestionsContainer = this.createSuggestionsContainer();
        }
        
        suggestionsContainer.innerHTML = suggestions.map((suggestion, index) => 
            `<div class="search-suggestion" data-index="${index}" onclick="searchManager.selectSuggestion('${suggestion.text}')">
                <i class="${suggestion.icon}"></i>
                <span class="suggestion-text">${this.highlightMatch(suggestion.text, query)}</span>
                ${suggestion.count ? `<span class="suggestion-count">${suggestion.count}</span>` : ''}
            </div>`
        ).join('');
        
        suggestionsContainer.style.display = 'block';
    }

    getSuggestions(query) {
        const queryLower = query.toLowerCase();
        
        return this.searchSuggestions
            .filter(suggestion => suggestion.text.toLowerCase().includes(queryLower))
            .slice(0, 8)
            .sort((a, b) => {
                // Сортируем по релевантности: точные совпадения в начале, потом по типу
                const aExact = a.text.toLowerCase().startsWith(queryLower);
                const bExact = b.text.toLowerCase().startsWith(queryLower);
                
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
                
                // Приоритет типов: term > category > tag
                const typePriority = { term: 3, category: 2, tag: 1 };
                return (typePriority[b.type] || 0) - (typePriority[a.type] || 0);
            });
    }

    createSuggestionsContainer() {
        const searchInput = document.getElementById('search-input');
        if (!searchInput) return null;
        
        const container = document.createElement('div');
        container.id = 'search-suggestions';
        container.className = 'search-suggestions';
        
        searchInput.parentElement.style.position = 'relative';
        searchInput.parentElement.appendChild(container);
        
        return container;
    }

    hideSuggestions() {
        const suggestionsContainer = document.getElementById('search-suggestions');
        if (suggestionsContainer) {
            suggestionsContainer.style.display = 'none';
        }
    }

    selectSuggestion(text) {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = text;
            this.currentQuery = text;
            this.performSearch(text, true);
        }
        this.hideSuggestions();
    }

    highlightMatch(text, query) {
        if (!query) return text;
        
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    handleKeyNavigation(e) {
        const suggestionsContainer = document.getElementById('search-suggestions');
        if (!suggestionsContainer || suggestionsContainer.style.display === 'none') return;
        
        const suggestions = suggestionsContainer.querySelectorAll('.search-suggestion');
        let activeIndex = Array.from(suggestions).findIndex(s => s.classList.contains('active'));
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (activeIndex < suggestions.length - 1) {
                    if (activeIndex >= 0) suggestions[activeIndex].classList.remove('active');
                    suggestions[activeIndex + 1].classList.add('active');
                }
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                if (activeIndex > 0) {
                    suggestions[activeIndex].classList.remove('active');
                    suggestions[activeIndex - 1].classList.add('active');
                } else if (activeIndex === 0) {
                    suggestions[0].classList.remove('active');
                }
                break;
                
            case 'Enter':
                e.preventDefault();
                if (activeIndex >= 0) {
                    const activeText = suggestions[activeIndex].querySelector('.suggestion-text').textContent;
                    this.selectSuggestion(activeText);
                } else {
                    this.performSearch(this.currentQuery, true);
                }
                break;
                
            case 'Escape':
                this.hideSuggestions();
                break;
        }
    }

    // ===== ОТОБРАЖЕНИЕ РЕЗУЛЬТАТОВ =====
    showSearchResults(query, results) {
        const modal = document.getElementById('search-modal');
        const resultsContainer = document.getElementById('search-results');
        
        if (!modal || !resultsContainer) return;
        
        // Обновляем заголовок
        const modalHeader = modal.querySelector('.modal-header h3');
        if (modalHeader) {
            modalHeader.textContent = `Результаты поиска: "${query}"`;
        }
        
        if (results.total === 0) {
            resultsContainer.innerHTML = `
                <div class="no-search-results">
                    <i class="fas fa-search"></i>
                    <h3>Ничего не найдено</h3>
                    <p>По запросу "${query}" ничего не найдено.</p>
                    <div class="search-suggestions-help">
                        <h4>Попробуйте:</h4>
                        <ul>
                            <li>Проверить правильность написания</li>
                            <li>Использовать более общие термины</li>
                            <li>Попробовать синонимы</li>
                            <li>Воспользоваться <button class="btn btn-link" onclick="searchManager.showAdvancedSearch()">расширенным поиском</button></li>
                        </ul>
                    </div>
                </div>
            `;
        } else {
            resultsContainer.innerHTML = `
                <div class="search-results-header">
                    <div class="results-count">Найдено результатов: ${results.total}</div>
                    <button class="btn btn-outline btn-sm" onclick="searchManager.showAdvancedSearch()">
                        <i class="fas fa-sliders-h"></i>
                        Расширенный поиск
                    </button>
                </div>
                
                ${results.articles.length > 0 ? `
                    <div class="search-results-section">
                        <h4 class="results-section-title">
                            <i class="fas fa-file-alt"></i>
                            Статьи (${results.articles.length})
                        </h4>
                        <div class="search-results-list">
                            ${results.articles.map(article => this.renderArticleResult(article, query)).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${results.authors.length > 0 ? `
                    <div class="search-results-section">
                        <h4 class="results-section-title">
                            <i class="fas fa-users"></i>
                            Авторы (${results.authors.length})
                        </h4>
                        <div class="search-results-list">
                            ${results.authors.map(author => this.renderAuthorResult(author, query)).join('')}
                        </div>
                    </div>
                ` : ''}
            `;
        }
        
        modal.classList.add('active');
        
        // Добавляем в историю поиска
        this.addToSearchHistory(query, results.total);
    }

    renderArticleResult(article, query) {
        const categoryName = MediaPortal.CATEGORIES[article.category?.toUpperCase()]?.name || article.category;
        const highlightedTitle = this.highlightMatch(article.title, query);
        const highlightedLead = this.highlightMatch(MediaPortal.Formatter.truncate(article.lead, 120), query);
        
        return `
            <div class="search-result-item article-result" onclick="searchManager.openSearchResult('article', '${article.id}')">
                <div class="result-header">
                    <h5 class="result-title">${highlightedTitle}</h5>
                    <span class="result-category">${categoryName}</span>
                </div>
                <p class="result-lead">${highlightedLead}</p>
                <div class="result-meta">
                    <span class="result-date">
                        <i class="fas fa-calendar"></i>
                        ${MediaPortal.Formatter.date(article.publishedAt)}
                    </span>
                </div>
            </div>
        `;
    }

    renderAuthorResult(author, query) {
        const highlightedName = this.highlightMatch(author.name, query);
        const highlightedBio = author.bio ? this.highlightMatch(MediaPortal.Formatter.truncate(author.bio, 100), query) : '';
        
        const roleNames = {
            [MediaPortal.ROLES.ADMIN]: 'Администратор',
            [MediaPortal.ROLES.EDITOR]: 'Редактор',
            [MediaPortal.ROLES.AUTHOR]: 'Автор'
        };
        
        return `
            <div class="search-result-item author-result" onclick="searchManager.openSearchResult('author', '${author.id}')">
                <div class="result-header">
                    <div class="author-avatar">${MediaPortal.Formatter.initials(author.name)}</div>
                    <div class="author-info">
                        <h5 class="result-title">${highlightedName}</h5>
                        <span class="author-role">${roleNames[author.role] || author.role}</span>
                    </div>
                </div>
                ${highlightedBio ? `<p class="result-bio">${highlightedBio}</p>` : ''}
            </div>
        `;
    }

    openSearchResult(type, id) {
        // Закрываем модальное окно поиска
        const modal = document.getElementById('search-modal');
        if (modal) {
            modal.classList.remove('active');
        }
        
        if (type === 'article') {
            // Открываем статью
            if (window.articleManager) {
                articleManager.openArticle(id);
            }
        } else if (type === 'author') {
            // Переходим на страницу авторов или фильтруем по автору
            this.filterByAuthor(id);
        }
    }

    filterByAuthor(authorId) {
        // Устанавливаем фильтр по автору в менеджере статей
        if (window.articleManager) {
            articleManager.currentFilters.author = authorId;
            articleManager.applyFilters();
        }
        
        // Если мы не на главной странице, переходим туда
        if (!window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
            window.location.href = 'index.html';
        }
    }

    // ===== ИСТОРИЯ ПОИСКА =====
    loadSearchHistory() {
        this.searchHistory = MediaPortal.StorageManager.get('search_history') || [];
    }

    saveSearchHistory() {
        // Ограничиваем размер истории
        if (this.searchHistory.length > 50) {
            this.searchHistory = this.searchHistory.slice(0, 50);
        }
        MediaPortal.StorageManager.set('search_history', this.searchHistory);
    }

    addToSearchHistory(query, resultsCount) {
        // Убираем дубликаты
        this.searchHistory = this.searchHistory.filter(item => item.query !== query);
        
        // Добавляем в начало
        this.searchHistory.unshift({
            query,
            resultsCount,
            timestamp: new Date().toISOString()
        });
        
        this.saveSearchHistory();
    }

    getSearchHistory() {
        return this.searchHistory.slice(0, 10); // Возвращаем последние 10 запросов
    }

    clearSearchHistory() {
        this.searchHistory = [];
        this.saveSearchHistory();
        MediaPortal.NotificationManager.success('История поиска очищена');
    }

    // ===== РАСШИРЕННЫЙ ПОИСК =====
    showAdvancedSearch() {
        // Создаем или показываем модальное окно расширенного поиска
        let modal = document.getElementById('advanced-search-modal');
        
        if (!modal) {
            modal = this.createAdvancedSearchModal();
            document.body.appendChild(modal);
        }
        
        modal.classList.add('active');
    }

    createAdvancedSearchModal() {
        const authors = authManager ? authManager.getAllUsers() : [];
        
        const modal = MediaPortal.DOMUtils.createElement('div', {
            id: 'advanced-search-modal',
            className: 'modal'
        });
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Расширенный поиск</h3>
                    <button class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="advanced-search-form">
                        <div class="form-group">
                            <label for="advanced-query">Поисковый запрос</label>
                            <input type="text" id="advanced-query" name="query" class="form-control" 
                                   placeholder="Введите ключевые слова...">
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="advanced-category">Рубрика</label>
                                <select id="advanced-category" name="category" class="form-control">
                                    <option value="">Все рубрики</option>
                                    ${Object.entries(MediaPortal.CATEGORIES).map(([key, category]) => 
                                        `<option value="${key.toLowerCase()}">${category.name}</option>`
                                    ).join('')}
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="advanced-author">Автор</label>
                                <select id="advanced-author" name="author" class="form-control">
                                    <option value="">Все авторы</option>
                                    ${authors.map(author => 
                                        `<option value="${author.id}">${author.firstName} ${author.lastName}</option>`
                                    ).join('')}
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="advanced-date-from">Дата от</label>
                                <input type="date" id="advanced-date-from" name="dateFrom" class="form-control">
                            </div>
                            
                            <div class="form-group">
                                <label for="advanced-date-to">Дата до</label>
                                <input type="date" id="advanced-date-to" name="dateTo" class="form-control">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="advanced-tags">Теги</label>
                            <input type="text" id="advanced-tags" name="tags" class="form-control" 
                                   placeholder="Введите теги через запятую...">
                        </div>
                        
                        <div class="modal-actions">
                            <button type="button" class="btn btn-outline modal-close-btn">Отмена</button>
                            <button type="button" class="btn btn-ghost" onclick="searchManager.clearAdvancedForm()">Очистить</button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-search"></i>
                                Найти
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        // Обработчики закрытия
        const closeBtns = modal.querySelectorAll('.modal-close, .modal-close-btn');
        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                modal.classList.remove('active');
            });
        });
        
        return modal;
    }

    clearAdvancedForm() {
        const form = document.getElementById('advanced-search-form');
        if (form) {
            form.reset();
        }
    }
}

// Создаем глобальный экземпляр
const searchManager = new SearchManager();

// Экспортируем в глобальный объект
window.MediaPortal = window.MediaPortal || {};
window.MediaPortal.SearchManager = SearchManager;
window.searchManager = searchManager;

// Обновляем индекс при изменении данных
document.addEventListener('DOMContentLoaded', function() {
    // Перестраиваем индекс при загрузке страницы
    setTimeout(() => {
        searchManager.buildSearchIndex();
    }, 1000);
});