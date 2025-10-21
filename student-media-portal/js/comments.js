/**
 * Система комментариев для медиа-портала
 * Включает модерацию, CRUD операции и вложенные ответы
 */

class CommentManager {
    constructor() {
        this.comments = [];
        this.init();
    }

    init() {
        this.loadComments();
        this.initEventHandlers();
    }

    initEventHandlers() {
        // Обработчики для админ панели
        this.initAdminHandlers();
        
        // Обработчики для публичной части
        this.initPublicHandlers();
    }

    initAdminHandlers() {
        // Фильтр комментариев в админке
        const commentsStatusFilter = document.getElementById('comments-status-filter');
        if (commentsStatusFilter) {
            commentsStatusFilter.addEventListener('change', (e) => {
                this.filterComments(e.target.value);
            });
        }
    }

    initPublicHandlers() {
        // Инициализируем обработчики для комментариев в статьях
        this.initArticleComments();
    }

    initArticleComments() {
        // Эти обработчики будут добавлены динамически при открытии статьи
        document.addEventListener('click', (e) => {
            if (e.target.matches('.reply-btn')) {
                this.showReplyForm(e.target.dataset.commentId);
            }
            
            if (e.target.matches('.like-comment-btn')) {
                this.likeComment(e.target.dataset.commentId);
            }
        });
    }

    // ===== ЗАГРУЗКА И СОХРАНЕНИЕ ДАННЫХ =====
    loadComments() {
        this.comments = MediaPortal.StorageManager.get(MediaPortal.STORAGE_KEYS.COMMENTS) || [];
    }

    saveComments() {
        MediaPortal.StorageManager.set(MediaPortal.STORAGE_KEYS.COMMENTS, this.comments);
    }

    // ===== CRUD ОПЕРАЦИИ =====
    createComment(commentData) {
        // Валидация данных
        const errors = this.validateCommentData(commentData);
        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }

        // Проверка на спам
        if (this.isSpam(commentData)) {
            throw new Error('Комментарий похож на спам');
        }

        const comment = {
            id: MediaPortal.IDGenerator.generate(),
            articleId: commentData.articleId,
            authorName: commentData.authorName || (authManager.currentUser ? 
                `${authManager.currentUser.firstName} ${authManager.currentUser.lastName}` : 'Гость'),
            authorEmail: commentData.authorEmail || (authManager.currentUser ? 
                authManager.currentUser.email : ''),
            authorId: authManager.currentUser ? authManager.currentUser.id : null,
            content: commentData.content.trim(),
            parentId: commentData.parentId || null,
            status: authManager.currentUser && authManager.hasRole(MediaPortal.ROLES.ADMIN) ? 
                MediaPortal.COMMENT_STATUS.APPROVED : MediaPortal.COMMENT_STATUS.PENDING,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            likes: 0,
            ipAddress: this.getClientIP() // Для отслеживания спама
        };

        this.comments.unshift(comment);
        this.saveComments();
        return comment;
    }

    updateComment(commentId, updates) {
        const index = this.comments.findIndex(comment => comment.id === commentId);
        if (index === -1) {
            throw new Error('Комментарий не найден');
        }

        // Проверяем права на редактирование
        if (!this.canEditComment(this.comments[index])) {
            throw new Error('Нет прав на редактирование этого комментария');
        }

        const updatedComment = {
            ...this.comments[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        this.comments[index] = updatedComment;
        this.saveComments();
        return updatedComment;
    }

    deleteComment(commentId) {
        const index = this.comments.findIndex(comment => comment.id === commentId);
        if (index === -1) {
            throw new Error('Комментарий не найден');
        }

        // Проверяем права на удаление
        if (!this.canDeleteComment(this.comments[index])) {
            throw new Error('Нет прав на удаление этого комментария');
        }

        // Удаляем комментарий и все ответы на него
        this.deleteCommentWithReplies(commentId);
        this.saveComments();
    }

    deleteCommentWithReplies(commentId) {
        // Находим все ответы на комментарий
        const replies = this.comments.filter(comment => comment.parentId === commentId);
        
        // Рекурсивно удаляем ответы
        replies.forEach(reply => {
            this.deleteCommentWithReplies(reply.id);
        });

        // Удаляем сам комментарий
        const index = this.comments.findIndex(comment => comment.id === commentId);
        if (index !== -1) {
            this.comments.splice(index, 1);
        }
    }

    getCommentById(commentId) {
        return this.comments.find(comment => comment.id === commentId);
    }

    getCommentsByArticle(articleId) {
        return this.comments
            .filter(comment => comment.articleId === articleId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    getApprovedCommentsByArticle(articleId) {
        return this.comments
            .filter(comment => 
                comment.articleId === articleId && 
                comment.status === MediaPortal.COMMENT_STATUS.APPROVED
            )
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    // ===== ВАЛИДАЦИЯ =====
    validateCommentData(data) {
        const errors = [];

        if (!MediaPortal.Validator.required(data.articleId)) {
            errors.push('ID статьи обязателен');
        }

        if (!MediaPortal.Validator.required(data.content)) {
            errors.push('Содержание комментария обязательно');
        } else if (!MediaPortal.Validator.minLength(data.content, 10)) {
            errors.push('Комментарий должен содержать минимум 10 символов');
        } else if (!MediaPortal.Validator.maxLength(data.content, 1000)) {
            errors.push('Комментарий не должен превышать 1000 символов');
        }

        // Если пользователь не авторизован, требуем имя и email
        if (!authManager.isAuthenticated()) {
            if (!MediaPortal.Validator.required(data.authorName)) {
                errors.push('Имя обязательно');
            }
            
            if (!MediaPortal.Validator.required(data.authorEmail)) {
                errors.push('Email обязателен');
            } else if (!MediaPortal.Validator.email(data.authorEmail)) {
                errors.push('Некорректный формат email');
            }
        }

        return errors;
    }

    // ===== АНТИСПАМ =====
    isSpam(commentData) {
        const content = commentData.content.toLowerCase();
        
        // Список спам-слов (упрощенный)
        const spamWords = [
            'казино', 'casino', 'viagra', 'loan', 'кредит', 'займ',
            'http://', 'https://', 'www.', '.com', '.ru', '.org'
        ];

        // Проверяем на спам-слова
        const hasSpamWords = spamWords.some(word => content.includes(word));
        
        // Проверяем на повторяющиеся символы
        const hasRepeatingChars = /(.)\1{4,}/.test(content);
        
        // Проверяем на слишком много заглавных букв
        const upperCaseRatio = (content.match(/[A-ZА-Я]/g) || []).length / content.length;
        const tooManyUpperCase = upperCaseRatio > 0.5 && content.length > 20;

        return hasSpamWords || hasRepeatingChars || tooManyUpperCase;
    }

    getClientIP() {
        // В реальном приложении здесь был бы запрос к серверу за IP
        return '127.0.0.1';
    }

    // ===== МОДЕРАЦИЯ =====
    approveComment(commentId) {
        try {
            this.updateComment(commentId, { status: MediaPortal.COMMENT_STATUS.APPROVED });
            MediaPortal.NotificationManager.success('Комментарий одобрен');
            this.renderAdminComments();
            this.updateDashboardStats();
        } catch (error) {
            MediaPortal.NotificationManager.error(error.message);
        }
    }

    rejectComment(commentId) {
        try {
            this.updateComment(commentId, { status: MediaPortal.COMMENT_STATUS.REJECTED });
            MediaPortal.NotificationManager.success('Комментарий отклонен');
            this.renderAdminComments();
            this.updateDashboardStats();
        } catch (error) {
            MediaPortal.NotificationManager.error(error.message);
        }
    }

    // ===== ОТОБРАЖЕНИЕ КОММЕНТАРИЕВ В СТАТЬЕ =====
    renderArticleComments(articleId, container) {
        if (!container) return;

        const comments = this.getApprovedCommentsByArticle(articleId);
        const commentsTree = this.buildCommentsTree(comments);

        container.innerHTML = `
            <div class="comments-section">
                <h3 class="comments-title">
                    Комментарии (${comments.length})
                </h3>
                
                ${authManager.isAuthenticated() || true ? this.renderCommentForm(articleId) : this.renderLoginPrompt()}
                
                <div class="comments-list">
                    ${commentsTree.length > 0 ? 
                        commentsTree.map(comment => this.renderComment(comment)).join('') :
                        '<div class="no-comments"><p>Пока нет комментариев. Будьте первым!</p></div>'
                    }
                </div>
            </div>
        `;

        // Инициализируем обработчики
        this.initCommentFormHandlers(articleId);
    }

    buildCommentsTree(comments) {
        const commentsMap = new Map();
        const rootComments = [];

        // Создаем карту комментариев
        comments.forEach(comment => {
            commentsMap.set(comment.id, { ...comment, replies: [] });
        });

        // Строим дерево
        comments.forEach(comment => {
            if (comment.parentId) {
                const parent = commentsMap.get(comment.parentId);
                if (parent) {
                    parent.replies.push(commentsMap.get(comment.id));
                }
            } else {
                rootComments.push(commentsMap.get(comment.id));
            }
        });

        return rootComments;
    }

    renderComment(comment, level = 0) {
        const maxLevel = 3; // Максимальный уровень вложенности
        const canReply = level < maxLevel;

        return `
            <div class="comment" data-comment-id="${comment.id}" style="margin-left: ${level * 20}px">
                <div class="comment-header">
                    <div class="comment-author">
                        <div class="author-avatar small">${MediaPortal.Formatter.initials(comment.authorName)}</div>
                        <div class="author-info">
                            <span class="author-name">${comment.authorName}</span>
                            <span class="comment-date">${MediaPortal.Formatter.timeAgo(comment.createdAt)}</span>
                        </div>
                    </div>
                    <div class="comment-actions">
                        <button class="comment-action-btn like-comment-btn" data-comment-id="${comment.id}">
                            <i class="fas fa-heart"></i>
                            <span class="likes-count">${comment.likes || 0}</span>
                        </button>
                        ${canReply ? `
                            <button class="comment-action-btn reply-btn" data-comment-id="${comment.id}">
                                <i class="fas fa-reply"></i>
                                Ответить
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div class="comment-content">
                    ${this.formatCommentContent(comment.content)}
                </div>
                <div class="comment-reply-form" id="reply-form-${comment.id}" style="display: none;">
                    <!-- Форма ответа будет вставлена сюда -->
                </div>
                ${comment.replies && comment.replies.length > 0 ? `
                    <div class="comment-replies">
                        ${comment.replies.map(reply => this.renderComment(reply, level + 1)).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderCommentForm(articleId, parentId = null) {
        const isReply = parentId !== null;
        const formId = isReply ? `reply-form-${parentId}` : 'main-comment-form';

        return `
            <div class="comment-form-container" id="${formId}">
                <form class="comment-form" data-article-id="${articleId}" ${isReply ? `data-parent-id="${parentId}"` : ''}>
                    ${!authManager.isAuthenticated() ? `
                        <div class="form-row">
                            <div class="form-group">
                                <input type="text" name="authorName" class="form-control" placeholder="Ваше имя *" required>
                            </div>
                            <div class="form-group">
                                <input type="email" name="authorEmail" class="form-control" placeholder="Email *" required>
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="form-group">
                        <textarea name="content" class="form-control comment-textarea" 
                                rows="4" 
                                placeholder="${isReply ? 'Ваш ответ...' : 'Ваш комментарий...'}" 
                                required></textarea>
                        <div class="textarea-footer">
                            <small class="char-counter">
                                <span class="current">0</span>/<span class="max">1000</span> символов
                            </small>
                        </div>
                    </div>
                    
                    <div class="comment-form-actions">
                        ${isReply ? `
                            <button type="button" class="btn btn-outline cancel-reply-btn">
                                Отмена
                            </button>
                        ` : ''}
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-paper-plane"></i>
                            ${isReply ? 'Ответить' : 'Отправить'}
                        </button>
                    </div>
                </form>
            </div>
        `;
    }

    renderLoginPrompt() {
        return `
            <div class="login-prompt">
                <p>Чтобы оставить комментарий, необходимо <a href="login.html">войти в систему</a></p>
            </div>
        `;
    }

    formatCommentContent(content) {
        // Простое форматирование: переводы строк -> <br>
        return content
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // **жирный**
            .replace(/\*(.+?)\*/g, '<em>$1</em>'); // *курсив*
    }

    // ===== ОБРАБОТЧИКИ ФОРМ =====
    initCommentFormHandlers(articleId) {
        const forms = document.querySelectorAll('.comment-form');
        forms.forEach(form => {
            form.addEventListener('submit', (e) => this.handleCommentSubmit(e));
            
            // Счетчик символов
            const textarea = form.querySelector('.comment-textarea');
            if (textarea) {
                textarea.addEventListener('input', (e) => this.updateCharCounter(e.target));
            }
        });

        // Кнопки отмены ответа
        const cancelBtns = document.querySelectorAll('.cancel-reply-btn');
        cancelBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.cancelReply(e));
        });
    }

    async handleCommentSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        const submitBtn = form.querySelector('button[type="submit"]');
        
        const commentData = {
            articleId: form.dataset.articleId,
            parentId: form.dataset.parentId || null,
            authorName: formData.get('authorName'),
            authorEmail: formData.get('authorEmail'),
            content: formData.get('content')
        };

        // Показываем загрузку
        this.setButtonLoading(submitBtn, true);

        try {
            const comment = this.createComment(commentData);
            
            // Показываем уведомление
            const message = comment.status === MediaPortal.COMMENT_STATUS.APPROVED ? 
                'Комментарий добавлен' : 
                'Комментарий отправлен на модерацию';
            
            MediaPortal.NotificationManager.success(message);
            
            // Обновляем отображение комментариев
            const commentsContainer = document.querySelector('.comments-section').parentElement;
            this.renderArticleComments(commentData.articleId, commentsContainer);
            
        } catch (error) {
            console.error('Comment submit error:', error);
            MediaPortal.NotificationManager.error(error.message || 'Ошибка при отправке комментария');
        } finally {
            this.setButtonLoading(submitBtn, false);
        }
    }

    updateCharCounter(textarea) {
        const counter = textarea.closest('.form-group').querySelector('.char-counter .current');
        if (counter) {
            counter.textContent = textarea.value.length;
            
            // Меняем цвет при приближении к лимиту
            const current = textarea.value.length;
            const max = 1000;
            const ratio = current / max;
            
            if (ratio > 0.9) {
                counter.style.color = 'var(--error)';
            } else if (ratio > 0.8) {
                counter.style.color = 'var(--warning)';
            } else {
                counter.style.color = '';
            }
        }
    }

    // ===== ДЕЙСТВИЯ С КОММЕНТАРИЯМИ =====
    showReplyForm(commentId) {
        // Скрываем все открытые формы ответов
        document.querySelectorAll('.comment-reply-form').forEach(form => {
            form.style.display = 'none';
            form.innerHTML = '';
        });

        const replyContainer = document.getElementById(`reply-form-${commentId}`);
        if (!replyContainer) return;

        const comment = this.getCommentById(commentId);
        if (!comment) return;

        replyContainer.innerHTML = this.renderCommentForm(comment.articleId, commentId);
        replyContainer.style.display = 'block';

        // Инициализируем обработчики для новой формы
        this.initCommentFormHandlers(comment.articleId);

        // Фокусируемся на поле ввода
        const textarea = replyContainer.querySelector('.comment-textarea');
        if (textarea) {
            textarea.focus();
        }
    }

    cancelReply(e) {
        const form = e.target.closest('.comment-form-container');
        if (form) {
            form.style.display = 'none';
            form.innerHTML = '';
        }
    }

    likeComment(commentId) {
        const comment = this.getCommentById(commentId);
        if (!comment) return;

        try {
            comment.likes = (comment.likes || 0) + 1;
            this.saveComments();

            // Обновляем счетчик лайков
            const likeBtn = document.querySelector(`[data-comment-id="${commentId}"].like-comment-btn`);
            if (likeBtn) {
                const likesCount = likeBtn.querySelector('.likes-count');
                if (likesCount) {
                    likesCount.textContent = comment.likes;
                }
                
                // Добавляем визуальный эффект
                likeBtn.classList.add('liked');
                setTimeout(() => likeBtn.classList.remove('liked'), 300);
            }

            MediaPortal.NotificationManager.success('Спасибо за оценку!', 2000);

        } catch (error) {
            MediaPortal.NotificationManager.error('Ошибка при оценке комментария');
        }
    }

    // ===== АДМИНСКИЕ ФУНКЦИИ =====
    renderAdminComments() {
        const commentsList = document.getElementById('comments-list');
        if (!commentsList) return;

        const pendingComments = this.comments.filter(comment => 
            comment.status === MediaPortal.COMMENT_STATUS.PENDING
        );

        if (pendingComments.length === 0) {
            commentsList.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-comments"></i>
                    <p>Нет комментариев на модерации</p>
                </div>
            `;
            return;
        }

        commentsList.innerHTML = pendingComments.map(comment => {
            const article = articleManager.getArticleById(comment.articleId);
            const articleTitle = article ? article.title : 'Удаленная статья';

            return `
                <div class="comment-card pending" data-comment-id="${comment.id}">
                    <div class="comment-header">
                        <div class="comment-author">
                            <div class="author-avatar">${MediaPortal.Formatter.initials(comment.authorName)}</div>
                            <div class="author-info">
                                <div class="author-name">${comment.authorName}</div>
                                <div class="author-email">${comment.authorEmail}</div>
                            </div>
                        </div>
                        <div class="comment-meta">
                            <div class="comment-article">К статье: "${articleTitle}"</div>
                            <div class="comment-date">${MediaPortal.Formatter.timeAgo(comment.createdAt)}</div>
                        </div>
                    </div>
                    
                    <div class="comment-content">
                        ${this.formatCommentContent(comment.content)}
                    </div>
                    
                    <div class="comment-actions">
                        <button class="comment-action approve" onclick="commentManager.approveComment('${comment.id}')">
                            <i class="fas fa-check"></i>
                            Одобрить
                        </button>
                        <button class="comment-action reject" onclick="commentManager.rejectComment('${comment.id}')">
                            <i class="fas fa-times"></i>
                            Отклонить
                        </button>
                        <button class="comment-action delete" onclick="commentManager.confirmDeleteComment('${comment.id}')">
                            <i class="fas fa-trash"></i>
                            Удалить
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    filterComments(status) {
        const commentsList = document.getElementById('comments-list');
        if (!commentsList) return;

        let filteredComments = [...this.comments];

        if (status) {
            filteredComments = filteredComments.filter(comment => comment.status === status);
        }

        // Сортируем по дате создания (новые сначала)
        filteredComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (filteredComments.length === 0) {
            commentsList.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-comments"></i>
                    <p>Комментариев не найдено</p>
                </div>
            `;
            return;
        }

        commentsList.innerHTML = filteredComments.map(comment => {
            const article = articleManager.getArticleById(comment.articleId);
            const articleTitle = article ? article.title : 'Удаленная статья';

            return `
                <div class="comment-card ${comment.status}" data-comment-id="${comment.id}">
                    <div class="comment-header">
                        <div class="comment-author">
                            <div class="author-avatar">${MediaPortal.Formatter.initials(comment.authorName)}</div>
                            <div class="author-info">
                                <div class="author-name">${comment.authorName}</div>
                                <div class="author-email">${comment.authorEmail}</div>
                            </div>
                        </div>
                        <div class="comment-meta">
                            <div class="comment-article">К статье: "${articleTitle}"</div>
                            <div class="comment-date">${MediaPortal.Formatter.timeAgo(comment.createdAt)}</div>
                            <div class="comment-status">${this.getStatusName(comment.status)}</div>
                        </div>
                    </div>
                    
                    <div class="comment-content">
                        ${this.formatCommentContent(comment.content)}
                    </div>
                    
                    <div class="comment-actions">
                        ${comment.status === MediaPortal.COMMENT_STATUS.PENDING ? `
                            <button class="comment-action approve" onclick="commentManager.approveComment('${comment.id}')">
                                <i class="fas fa-check"></i>
                                Одобрить
                            </button>
                            <button class="comment-action reject" onclick="commentManager.rejectComment('${comment.id}')">
                                <i class="fas fa-times"></i>
                                Отклонить
                            </button>
                        ` : ''}
                        
                        ${comment.status === MediaPortal.COMMENT_STATUS.REJECTED ? `
                            <button class="comment-action approve" onclick="commentManager.approveComment('${comment.id}')">
                                <i class="fas fa-check"></i>
                                Одобрить
                            </button>
                        ` : ''}
                        
                        <button class="comment-action delete" onclick="commentManager.confirmDeleteComment('${comment.id}')">
                            <i class="fas fa-trash"></i>
                            Удалить
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    getStatusName(status) {
        const statusNames = {
            [MediaPortal.COMMENT_STATUS.PENDING]: 'На модерации',
            [MediaPortal.COMMENT_STATUS.APPROVED]: 'Одобрен',
            [MediaPortal.COMMENT_STATUS.REJECTED]: 'Отклонен'
        };
        return statusNames[status] || status;
    }

    confirmDeleteComment(commentId) {
        const comment = this.getCommentById(commentId);
        if (!comment) return;

        if (!this.canDeleteComment(comment)) {
            MediaPortal.NotificationManager.error('Нет прав на удаление этого комментария');
            return;
        }

        if (confirm('Вы уверены, что хотите удалить этот комментарий? Все ответы на него также будут удалены.')) {
            try {
                this.deleteComment(commentId);
                MediaPortal.NotificationManager.success('Комментарий удален');
                this.renderAdminComments();
                this.updateDashboardStats();
            } catch (error) {
                MediaPortal.NotificationManager.error(error.message || 'Ошибка при удалении комментария');
            }
        }
    }

    // ===== ПРОВЕРКА ПРАВ =====
    canEditComment(comment) {
        if (!authManager.isAuthenticated()) return false;
        
        const currentUser = authManager.getCurrentUser();
        
        // Админы и редакторы могут редактировать любые комментарии
        if (authManager.hasRole(MediaPortal.ROLES.ADMIN) || authManager.hasRole(MediaPortal.ROLES.EDITOR)) {
            return true;
        }
        
        // Пользователи могут редактировать только свои комментарии
        return comment.authorId === currentUser.id;
    }

    canDeleteComment(comment) {
        if (!authManager.isAuthenticated()) return false;
        
        const currentUser = authManager.getCurrentUser();
        
        // Админы могут удалять любые комментарии
        if (authManager.hasRole(MediaPortal.ROLES.ADMIN)) {
            return true;
        }
        
        // Редакторы могут удалять комментарии, но не от админов
        if (authManager.hasRole(MediaPortal.ROLES.EDITOR)) {
            if (comment.authorId) {
                const author = authManager.getUserById(comment.authorId);
                return !author || author.role !== MediaPortal.ROLES.ADMIN;
            }
            return true;
        }
        
        // Пользователи могут удалять только свои комментарии
        return comment.authorId === currentUser.id;
    }

    // ===== СТАТИСТИКА =====
    updateDashboardStats() {
        // Обновляем счетчик комментариев в админ панели
        const commentsCount = document.getElementById('comments-count');
        if (commentsCount) {
            const pendingCount = this.comments.filter(c => c.status === MediaPortal.COMMENT_STATUS.PENDING).length;
            commentsCount.textContent = pendingCount;
        }

        // Обновляем статистику на главной странице
        const statsComments = document.getElementById('stats-comments');
        if (statsComments) {
            const approvedCount = this.comments.filter(c => c.status === MediaPortal.COMMENT_STATUS.APPROVED).length;
            statsComments.textContent = MediaPortal.Formatter.number(approvedCount);
        }
    }

    // ===== УТИЛИТЫ =====
    setButtonLoading(button, loading) {
        if (loading) {
            button.disabled = true;
            button.classList.add('loading');
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
        } else {
            button.disabled = false;
            button.classList.remove('loading');
            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
                delete button.dataset.originalText;
            }
        }
    }
}

// Создаем глобальный экземпляр
const commentManager = new CommentManager();

// Экспортируем в глобальный объект
window.MediaPortal = window.MediaPortal || {};
window.MediaPortal.CommentManager = CommentManager;
window.commentManager = commentManager;

// Обновляем статистику при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    commentManager.updateDashboardStats();
    
    // Если мы в админке на странице комментариев, загружаем их
    if (window.location.pathname.includes('admin.html')) {
        setTimeout(() => {
            commentManager.renderAdminComments();
        }, 500);
    }
});