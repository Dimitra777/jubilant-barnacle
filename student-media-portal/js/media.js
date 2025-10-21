/**
 * Система управления медиафайлами для медиа-портала
 * Загрузка, валидация и организация файлов
 */

class MediaManager {
    constructor() {
        this.mediaFiles = [];
        this.allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        this.allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
        this.allowedAudioTypes = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'];
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        this.maxImageSize = 5 * 1024 * 1024; // 5MB
        
        this.init();
    }

    init() {
        this.loadMediaFiles();
        this.initEventHandlers();
    }

    initEventHandlers() {
        // Кнопка загрузки медиа в админке
        const uploadMediaBtn = document.getElementById('upload-media-btn');
        if (uploadMediaBtn) {
            uploadMediaBtn.addEventListener('click', () => this.showUploadDialog());
        }

        // Drag & Drop для загрузки файлов
        this.initDragAndDrop();
        
        // Обработчики для модальных окон медиатеки
        this.initMediaModal();
    }

    initDragAndDrop() {
        const dropZones = document.querySelectorAll('.image-preview, .media-drop-zone');
        
        dropZones.forEach(zone => {
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                zone.classList.add('drag-over');
            });

            zone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                zone.classList.remove('drag-over');
            });

            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('drag-over');
                
                const files = Array.from(e.dataTransfer.files);
                this.handleFileUpload(files, zone);
            });
        });
    }

    initMediaModal() {
        // Обработчики для выбора медиафайлов
        document.addEventListener('click', (e) => {
            if (e.target.matches('.media-item')) {
                this.selectMediaFile(e.target.dataset.mediaId);
            }
        });
    }

    // ===== ЗАГРУЗКА И СОХРАНЕНИЕ ДАННЫХ =====
    loadMediaFiles() {
        // В реальном приложении медиафайлы хранились бы на сервере
        // Здесь мы используем localStorage только для метаданных
        this.mediaFiles = MediaPortal.StorageManager.get('media_files') || [];
    }

    saveMediaFiles() {
        MediaPortal.StorageManager.set('media_files', this.mediaFiles);
    }

    // ===== ЗАГРУЗКА ФАЙЛОВ =====
    async handleFileUpload(files, targetElement = null) {
        const uploadPromises = files.map(file => this.uploadFile(file));
        
        try {
            const results = await Promise.all(uploadPromises);
            const successful = results.filter(result => result.success);
            
            if (successful.length > 0) {
                MediaPortal.NotificationManager.success(
                    `Загружено файлов: ${successful.length} из ${files.length}`
                );
                
                // Если есть целевой элемент (например, превью изображения), обновляем его
                if (targetElement && successful.length === 1 && this.isImage(successful[0].file)) {
                    this.updateImagePreview(targetElement, successful[0].file);
                }
                
                // Обновляем медиатеку
                this.renderMediaLibrary();
            }
            
        } catch (error) {
            console.error('File upload error:', error);
            MediaPortal.NotificationManager.error('Ошибка при загрузке файлов');
        }
    }

    async uploadFile(file) {
        try {
            // Валидация файла
            const validation = this.validateFile(file);
            if (!validation.valid) {
                MediaPortal.NotificationManager.error(`${file.name}: ${validation.error}`);
                return { success: false, error: validation.error };
            }

            // Создаем объект медиафайла
            const mediaFile = await this.createMediaFile(file);
            
            // Сохраняем в массив
            this.mediaFiles.unshift(mediaFile);
            this.saveMediaFiles();
            
            return { success: true, file: mediaFile };
            
        } catch (error) {
            console.error('File upload error:', error);
            return { success: false, error: error.message };
        }
    }

    async createMediaFile(file) {
        const dataUrl = await MediaPortal.FileUtils.readAsDataURL(file);
        
        return {
            id: MediaPortal.IDGenerator.generate(),
            name: file.name,
            originalName: file.name,
            type: file.type,
            size: file.size,
            url: dataUrl, // В реальном приложении это был бы URL на сервере
            thumbnail: this.isImage(file) ? dataUrl : this.getFileTypeIcon(file.type),
            uploadedBy: authManager.currentUser ? authManager.currentUser.id : null,
            uploadedAt: new Date().toISOString(),
            description: '',
            tags: [],
            width: null,
            height: null
        };
    }

    // ===== ВАЛИДАЦИЯ ФАЙЛОВ =====
    validateFile(file) {
        // Проверяем размер
        if (file.size > this.maxFileSize) {
            return {
                valid: false,
                error: `Файл слишком большой. Максимальный размер: ${MediaPortal.Formatter.fileSize(this.maxFileSize)}`
            };
        }

        // Проверяем тип файла
        if (!this.isAllowedFileType(file.type)) {
            return {
                valid: false,
                error: 'Неподдерживаемый тип файла'
            };
        }

        // Дополнительные проверки для изображений
        if (this.isImage(file)) {
            if (file.size > this.maxImageSize) {
                return {
                    valid: false,
                    error: `Изображение слишком большое. Максимальный размер: ${MediaPortal.Formatter.fileSize(this.maxImageSize)}`
                };
            }
        }

        return { valid: true };
    }

    isAllowedFileType(type) {
        return [...this.allowedImageTypes, ...this.allowedVideoTypes, ...this.allowedAudioTypes]
            .includes(type);
    }

    isImage(file) {
        const type = typeof file === 'string' ? file : file.type;
        return this.allowedImageTypes.includes(type);
    }

    isVideo(file) {
        const type = typeof file === 'string' ? file : file.type;
        return this.allowedVideoTypes.includes(type);
    }

    isAudio(file) {
        const type = typeof file === 'string' ? file : file.type;
        return this.allowedAudioTypes.includes(type);
    }

    getFileTypeIcon(type) {
        if (this.isImage(type)) return 'fas fa-image';
        if (this.isVideo(type)) return 'fas fa-video';
        if (this.isAudio(type)) return 'fas fa-music';
        return 'fas fa-file';
    }

    // ===== УПРАВЛЕНИЕ МЕДИАТЕКОЙ =====
    showUploadDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = [
            ...this.allowedImageTypes,
            ...this.allowedVideoTypes,
            ...this.allowedAudioTypes
        ].join(',');

        input.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                this.handleFileUpload(files);
            }
        });

        input.click();
    }

    renderMediaLibrary() {
        const mediaContent = document.querySelector('#media-section .media-content');
        if (!mediaContent) return;

        if (this.mediaFiles.length === 0) {
            mediaContent.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-images"></i>
                    <p>Медиафайлов пока нет</p>
                    <button class="btn btn-primary" onclick="mediaManager.showUploadDialog()">
                        <i class="fas fa-upload"></i>
                        Загрузить первый файл
                    </button>
                </div>
            `;
            return;
        }

        mediaContent.innerHTML = `
            <div class="media-filters">
                <select id="media-type-filter">
                    <option value="">Все типы</option>
                    <option value="image">Изображения</option>
                    <option value="video">Видео</option>
                    <option value="audio">Аудио</option>
                </select>
                
                <div class="media-search">
                    <input type="text" id="media-search-input" placeholder="Поиск по названию...">
                </div>
                
                <div class="media-view-toggle">
                    <button class="view-btn active" data-view="grid" title="Сетка">
                        <i class="fas fa-th"></i>
                    </button>
                    <button class="view-btn" data-view="list" title="Список">
                        <i class="fas fa-list"></i>
                    </button>
                </div>
            </div>
            
            <div class="media-grid" id="media-grid">
                ${this.mediaFiles.map(file => this.renderMediaItem(file)).join('')}
            </div>
        `;

        // Инициализируем обработчики фильтров
        this.initMediaFilters();
    }

    renderMediaItem(mediaFile) {
        const uploader = authManager.getUserById(mediaFile.uploadedBy);
        const uploaderName = uploader ? `${uploader.firstName} ${uploader.lastName}` : 'Неизвестный пользователь';

        return `
            <div class="media-item" data-media-id="${mediaFile.id}" data-type="${this.getMediaType(mediaFile.type)}">
                <div class="media-preview">
                    ${this.isImage(mediaFile.type) ? 
                        `<img src="${mediaFile.url}" alt="${mediaFile.name}" loading="lazy">` :
                        `<div class="media-icon">
                            <i class="${this.getFileTypeIcon(mediaFile.type)}"></i>
                        </div>`
                    }
                    <div class="media-overlay">
                        <div class="media-actions">
                            <button class="media-action-btn" onclick="mediaManager.previewMedia('${mediaFile.id}')" title="Просмотр">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="media-action-btn" onclick="mediaManager.editMedia('${mediaFile.id}')" title="Редактировать">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="media-action-btn delete" onclick="mediaManager.deleteMedia('${mediaFile.id}')" title="Удалить">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="media-info">
                    <div class="media-name" title="${mediaFile.originalName}">${MediaPortal.Formatter.truncate(mediaFile.name, 20)}</div>
                    <div class="media-meta">
                        <div class="media-size">${MediaPortal.Formatter.fileSize(mediaFile.size)}</div>
                        <div class="media-date">${MediaPortal.Formatter.timeAgo(mediaFile.uploadedAt)}</div>
                    </div>
                    <div class="media-uploader">${uploaderName}</div>
                </div>
            </div>
        `;
    }

    getMediaType(mimeType) {
        if (this.isImage(mimeType)) return 'image';
        if (this.isVideo(mimeType)) return 'video';
        if (this.isAudio(mimeType)) return 'audio';
        return 'other';
    }

    initMediaFilters() {
        const typeFilter = document.getElementById('media-type-filter');
        const searchInput = document.getElementById('media-search-input');
        const viewBtns = document.querySelectorAll('#media-section .view-btn');

        if (typeFilter) {
            typeFilter.addEventListener('change', () => this.filterMedia());
        }

        if (searchInput) {
            const debouncedSearch = MediaPortal.Performance.debounce(() => {
                this.filterMedia();
            }, 300);
            
            searchInput.addEventListener('input', debouncedSearch);
        }

        viewBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                viewBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                const mediaGrid = document.getElementById('media-grid');
                if (mediaGrid) {
                    mediaGrid.className = `media-grid ${e.target.dataset.view}-view`;
                }
            });
        });
    }

    filterMedia() {
        const typeFilter = document.getElementById('media-type-filter');
        const searchInput = document.getElementById('media-search-input');
        const mediaGrid = document.getElementById('media-grid');

        if (!mediaGrid) return;

        const selectedType = typeFilter ? typeFilter.value : '';
        const searchQuery = searchInput ? searchInput.value.toLowerCase() : '';

        let filteredFiles = [...this.mediaFiles];

        // Фильтр по типу
        if (selectedType) {
            filteredFiles = filteredFiles.filter(file => 
                this.getMediaType(file.type) === selectedType
            );
        }

        // Поиск по названию
        if (searchQuery) {
            filteredFiles = filteredFiles.filter(file =>
                file.name.toLowerCase().includes(searchQuery) ||
                file.originalName.toLowerCase().includes(searchQuery)
            );
        }

        mediaGrid.innerHTML = filteredFiles.length > 0 ?
            filteredFiles.map(file => this.renderMediaItem(file)).join('') :
            `<div class="no-media-results">
                <i class="fas fa-search"></i>
                <p>Файлы не найдены</p>
            </div>`;
    }

    // ===== ДЕЙСТВИЯ С МЕДИАФАЙЛАМИ =====
    previewMedia(mediaId) {
        const mediaFile = this.getMediaById(mediaId);
        if (!mediaFile) return;

        // Создаем модальное окно для предварительного просмотра
        const modal = this.createPreviewModal(mediaFile);
        document.body.appendChild(modal);
        modal.classList.add('active');

        // Закрытие по клику на фон
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal(modal);
            }
        });
    }

    createPreviewModal(mediaFile) {
        const modal = MediaPortal.DOMUtils.createElement('div', {
            className: 'modal media-preview-modal'
        });

        let mediaContent = '';
        
        if (this.isImage(mediaFile.type)) {
            mediaContent = `
                <img src="${mediaFile.url}" alt="${mediaFile.name}" class="preview-image">
            `;
        } else if (this.isVideo(mediaFile.type)) {
            mediaContent = `
                <video controls class="preview-video">
                    <source src="${mediaFile.url}" type="${mediaFile.type}">
                    Ваш браузер не поддерживает видео.
                </video>
            `;
        } else if (this.isAudio(mediaFile.type)) {
            mediaContent = `
                <div class="audio-preview">
                    <div class="audio-icon">
                        <i class="fas fa-music"></i>
                    </div>
                    <audio controls class="preview-audio">
                        <source src="${mediaFile.url}" type="${mediaFile.type}">
                        Ваш браузер не поддерживает аудио.
                    </audio>
                </div>
            `;
        }

        modal.innerHTML = `
            <div class="modal-content media-modal-content">
                <div class="modal-header">
                    <h3>${mediaFile.name}</h3>
                    <button class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="media-preview-content">
                        ${mediaContent}
                    </div>
                    <div class="media-details">
                        <div class="detail-row">
                            <span class="detail-label">Размер:</span>
                            <span class="detail-value">${MediaPortal.Formatter.fileSize(mediaFile.size)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Тип:</span>
                            <span class="detail-value">${mediaFile.type}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Загружен:</span>
                            <span class="detail-value">${MediaPortal.Formatter.dateTime(mediaFile.uploadedAt)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">URL:</span>
                            <span class="detail-value">
                                <button class="btn btn-sm btn-outline" onclick="mediaManager.copyFileUrl('${mediaFile.id}')">
                                    <i class="fas fa-copy"></i>
                                    Копировать ссылку
                                </button>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => this.closeModal(modal));

        return modal;
    }

    editMedia(mediaId) {
        const mediaFile = this.getMediaById(mediaId);
        if (!mediaFile) return;

        // Создаем модальное окно редактирования
        const modal = this.createEditModal(mediaFile);
        document.body.appendChild(modal);
        modal.classList.add('active');
    }

    createEditModal(mediaFile) {
        const modal = MediaPortal.DOMUtils.createElement('div', {
            className: 'modal media-edit-modal'
        });

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Редактировать файл</h3>
                    <button class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="edit-media-form" data-media-id="${mediaFile.id}">
                        <div class="form-group">
                            <label for="media-name">Название</label>
                            <input type="text" id="media-name" class="form-control" value="${mediaFile.name}" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="media-description">Описание</label>
                            <textarea id="media-description" class="form-control" rows="3">${mediaFile.description || ''}</textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="media-tags">Теги</label>
                            <input type="text" id="media-tags" class="form-control" 
                                   value="${mediaFile.tags ? mediaFile.tags.join(', ') : ''}" 
                                   placeholder="Введите теги через запятую">
                        </div>
                        
                        <div class="modal-actions">
                            <button type="button" class="btn btn-outline modal-close-btn">Отмена</button>
                            <button type="submit" class="btn btn-primary">Сохранить</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        const form = modal.querySelector('#edit-media-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateMedia(mediaFile.id, form);
            this.closeModal(modal);
        });

        const closeBtns = modal.querySelectorAll('.modal-close, .modal-close-btn');
        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => this.closeModal(modal));
        });

        return modal;
    }

    updateMedia(mediaId, form) {
        const mediaFile = this.getMediaById(mediaId);
        if (!mediaFile) return;

        const formData = new FormData(form);
        const name = document.getElementById('media-name').value.trim();
        const description = document.getElementById('media-description').value.trim();
        const tagsString = document.getElementById('media-tags').value.trim();
        const tags = tagsString ? tagsString.split(',').map(tag => tag.trim()) : [];

        // Обновляем данные
        mediaFile.name = name;
        mediaFile.description = description;
        mediaFile.tags = tags;

        this.saveMediaFiles();
        this.renderMediaLibrary();
        
        MediaPortal.NotificationManager.success('Файл обновлен');
    }

    deleteMedia(mediaId) {
        const mediaFile = this.getMediaById(mediaId);
        if (!mediaFile) return;

        if (confirm(`Вы уверены, что хотите удалить файл "${mediaFile.name}"?`)) {
            const index = this.mediaFiles.findIndex(file => file.id === mediaId);
            if (index !== -1) {
                this.mediaFiles.splice(index, 1);
                this.saveMediaFiles();
                this.renderMediaLibrary();
                MediaPortal.NotificationManager.success('Файл удален');
            }
        }
    }

    copyFileUrl(mediaId) {
        const mediaFile = this.getMediaById(mediaId);
        if (!mediaFile) return;

        // В реальном приложении здесь был бы публичный URL
        const url = mediaFile.url;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => {
                MediaPortal.NotificationManager.success('Ссылка скопирована в буфер обмена');
            });
        } else {
            // Fallback для старых браузеров
            const textarea = document.createElement('textarea');
            textarea.value = url;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            MediaPortal.NotificationManager.success('Ссылка скопирована');
        }
    }

    // ===== ИНТЕГРАЦИЯ С РЕДАКТОРОМ =====
    updateImagePreview(element, mediaFile) {
        if (element.classList.contains('image-preview')) {
            element.innerHTML = `
                <img src="${mediaFile.url}" alt="${mediaFile.name}" class="preview-image">
                <button type="button" class="remove-image-btn" onclick="this.parentElement.querySelector('img').remove(); this.remove();">
                    <i class="fas fa-times"></i>
                </button>
            `;
            element.classList.add('has-image');
            element.dataset.imageUrl = mediaFile.url;
        }
    }

    selectMediaFile(mediaId) {
        const mediaFile = this.getMediaById(mediaId);
        if (!mediaFile) return;

        // Эта функция будет вызываться при выборе медиафайла
        // Здесь можно добавить логику для вставки в редактор или формы
        console.log('Selected media file:', mediaFile);
    }

    // ===== УТИЛИТЫ =====
    getMediaById(mediaId) {
        return this.mediaFiles.find(file => file.id === mediaId);
    }

    closeModal(modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
    }

    // ===== КОМПРЕССИЯ ИЗОБРАЖЕНИЙ =====
    async compressImage(file, maxWidth = 1920, maxHeight = 1080, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // Вычисляем новые размеры
                let { width, height } = img;
                
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }

                canvas.width = width;
                canvas.height = height;

                // Рисуем изображение
                ctx.drawImage(img, 0, 0, width, height);

                // Конвертируем в Blob
                canvas.toBlob(resolve, 'image/jpeg', quality);
            };

            img.src = URL.createObjectURL(file);
        });
    }

    // ===== СТАТИСТИКА =====
    getMediaStats() {
        const totalFiles = this.mediaFiles.length;
        const totalSize = this.mediaFiles.reduce((sum, file) => sum + file.size, 0);
        const imageCount = this.mediaFiles.filter(file => this.isImage(file.type)).length;
        const videoCount = this.mediaFiles.filter(file => this.isVideo(file.type)).length;
        const audioCount = this.mediaFiles.filter(file => this.isAudio(file.type)).length;

        return {
            totalFiles,
            totalSize,
            imageCount,
            videoCount,
            audioCount,
            formattedSize: MediaPortal.Formatter.fileSize(totalSize)
        };
    }
}

// Создаем глобальный экземпляр
const mediaManager = new MediaManager();

// Экспортируем в глобальный объект
window.MediaPortal = window.MediaPortal || {};
window.MediaPortal.MediaManager = MediaManager;
window.mediaManager = mediaManager;

// Инициализируем при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Если мы в админке на странице медиатеки, загружаем медиафайлы
    if (window.location.pathname.includes('admin.html')) {
        setTimeout(() => {
            const mediaSection = document.getElementById('media-section');
            if (mediaSection && mediaSection.classList.contains('active')) {
                mediaManager.renderMediaLibrary();
            }
        }, 500);
    }
});