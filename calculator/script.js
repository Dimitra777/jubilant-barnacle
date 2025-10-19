/**
 * Современный калькулятор с полным функционалом
 * Включает: основные операции, память, историю, темы, горячие клавиши
 */

// ===== UTILITY CLASSES =====

/**
 * Менеджер Toast уведомлений
 */
class ToastManager {
    constructor() {
        this.container = document.getElementById('toast-container');
    }

    show(message, type = 'success', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        this.container.appendChild(toast);
        
        // Автоматическое удаление
        setTimeout(() => {
            toast.style.animation = 'toastSlideIn 0.3s ease reverse';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    success(message) {
        this.show(message, 'success');
    }

    error(message) {
        this.show(message, 'error');
    }

    warning(message) {
        this.show(message, 'warning');
    }
}

/**
 * Менеджер тем
 */
class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem('calculator-theme') || 'light';
        this.themeToggle = document.getElementById('theme-toggle');
        this.themeIcon = this.themeToggle.querySelector('.theme-icon');
        
        this.init();
    }

    init() {
        this.applyTheme(this.currentTheme);
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(this.currentTheme);
        localStorage.setItem('calculator-theme', this.currentTheme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
    }
}

/**
 * Менеджер истории вычислений
 */
class HistoryManager {
    constructor() {
        this.history = JSON.parse(localStorage.getItem('calculator-history')) || [];
        this.historyPanel = document.getElementById('history-panel');
        this.historyList = document.getElementById('history-list');
        this.historyToggle = document.getElementById('history-toggle');
        this.clearHistory = document.getElementById('clear-history');
        this.isVisible = false;
        
        this.init();
    }

    init() {
        this.renderHistory();
        this.historyToggle.addEventListener('click', () => this.togglePanel());
        this.clearHistory.addEventListener('click', () => this.clear());
        this.historyList.addEventListener('click', (e) => this.handleHistoryClick(e));
    }

    add(expression, result) {
        const historyItem = {
            id: Date.now(),
            expression,
            result,
            timestamp: new Date().toLocaleString()
        };
        
        this.history.unshift(historyItem);
        
        // Ограничиваем историю 50 записями
        if (this.history.length > 50) {
            this.history = this.history.slice(0, 50);
        }
        
        this.saveHistory();
        this.renderHistory();
    }

    clear() {
        this.history = [];
        this.saveHistory();
        this.renderHistory();
        window.toast.success('История очищена');
    }

    togglePanel() {
        this.isVisible = !this.isVisible;
        this.historyPanel.classList.toggle('visible', this.isVisible);
    }

    handleHistoryClick(e) {
        const historyItem = e.target.closest('.history-item');
        if (historyItem) {
            const result = historyItem.querySelector('.history-result').textContent;
            window.calculator.setDisplay(result);
            this.togglePanel(); // Закрываем панель после выбора
        }
    }

    renderHistory() {
        if (this.history.length === 0) {
            this.historyList.innerHTML = '<div class="history-empty">История пуста</div>';
            return;
        }

        this.historyList.innerHTML = this.history
            .map(item => `
                <div class="history-item" data-id="${item.id}">
                    <div class="history-expression">${item.expression}</div>
                    <div class="history-result">${item.result}</div>
                </div>
            `).join('');
    }

    saveHistory() {
        localStorage.setItem('calculator-history', JSON.stringify(this.history));
    }
}

/**
 * Менеджер памяти калькулятора
 */
class MemoryManager {
    constructor() {
        this.memory = parseFloat(localStorage.getItem('calculator-memory')) || 0;
        this.memoryButtons = {
            clear: document.getElementById('memory-clear'),
            recall: document.getElementById('memory-recall'),
            add: document.getElementById('memory-add'),
            subtract: document.getElementById('memory-subtract'),
            store: document.getElementById('memory-store')
        };
        
        this.init();
    }

    init() {
        this.updateMemoryDisplay();
        
        Object.entries(this.memoryButtons).forEach(([action, button]) => {
            button.addEventListener('click', () => this[action]());
        });
    }

    clear() {
        this.memory = 0;
        this.saveMemory();
        this.updateMemoryDisplay();
        window.toast.success('Память очищена');
    }

    recall() {
        if (this.memory !== 0) {
            window.calculator.setDisplay(this.memory.toString());
            window.toast.success(`Из памяти: ${this.memory}`);
        } else {
            window.toast.warning('Память пуста');
        }
    }

    add() {
        const currentValue = parseFloat(window.calculator.getCurrentValue());
        if (!isNaN(currentValue)) {
            this.memory += currentValue;
            this.saveMemory();
            this.updateMemoryDisplay();
            window.toast.success(`Добавлено в память: ${currentValue}`);
        }
    }

    subtract() {
        const currentValue = parseFloat(window.calculator.getCurrentValue());
        if (!isNaN(currentValue)) {
            this.memory -= currentValue;
            this.saveMemory();
            this.updateMemoryDisplay();
            window.toast.success(`Вычтено из памяти: ${currentValue}`);
        }
    }

    store() {
        const currentValue = parseFloat(window.calculator.getCurrentValue());
        if (!isNaN(currentValue)) {
            this.memory = currentValue;
            this.saveMemory();
            this.updateMemoryDisplay();
            window.toast.success(`Сохранено в память: ${currentValue}`);
        }
    }

    updateMemoryDisplay() {
        const hasMemory = this.memory !== 0;
        Object.values(this.memoryButtons).forEach(button => {
            button.classList.toggle('active', hasMemory);
        });
    }

    saveMemory() {
        localStorage.setItem('calculator-memory', this.memory.toString());
    }
}

/**
 * Основной класс калькулятора
 */
class Calculator {
    constructor() {
        this.expressionElement = document.getElementById('expression');
        this.resultElement = document.getElementById('result');
        
        // Состояние калькулятора
        this.currentExpression = '';
        this.previousResult = 0;
        this.shouldResetDisplay = false;
        this.lastOperator = null;
        this.lastOperand = null;
        
        // Элементы управления
        this.numberButtons = document.querySelectorAll('.btn-number');
        this.operatorButtons = document.querySelectorAll('.btn-operator');
        this.functionButtons = document.querySelectorAll('.function-btn');
        this.controlButtons = {
            equals: document.getElementById('btn-equals'),
            clear: document.getElementById('btn-clear'),
            clearEntry: document.getElementById('btn-clear-entry'),
            backspace: document.getElementById('btn-backspace'),
            decimal: document.getElementById('btn-decimal'),
            square: document.getElementById('btn-square'),
            sqrt: document.getElementById('btn-sqrt'),
            reciprocal: document.getElementById('btn-reciprocal'),
            percent: document.getElementById('btn-percent')
        };
        
        this.init();
    }

    init() {
        this.attachEventListeners();
        this.attachKeyboardListeners();
        this.updateDisplay();
    }

    attachEventListeners() {
        // Кнопки чисел
        this.numberButtons.forEach(button => {
            button.addEventListener('click', () => {
                const number = button.dataset.number;
                this.inputNumber(number);
            });
        });

        // Кнопки операторов
        this.operatorButtons.forEach(button => {
            button.addEventListener('click', () => {
                const operator = button.dataset.operator;
                this.inputOperator(operator);
            });
        });

        // Кнопки управления
        this.controlButtons.equals.addEventListener('click', () => this.calculate());
        this.controlButtons.clear.addEventListener('click', () => this.clear());
        this.controlButtons.clearEntry.addEventListener('click', () => this.clearEntry());
        this.controlButtons.backspace.addEventListener('click', () => this.backspace());
        this.controlButtons.decimal.addEventListener('click', () => this.inputDecimal());

        // Функциональные кнопки
        this.controlButtons.square.addEventListener('click', () => this.square());
        this.controlButtons.sqrt.addEventListener('click', () => this.sqrt());
        this.controlButtons.reciprocal.addEventListener('click', () => this.reciprocal());
        this.controlButtons.percent.addEventListener('click', () => this.percent());
    }

    attachKeyboardListeners() {
        document.addEventListener('keydown', (e) => {
            e.preventDefault();
            
            // Числа
            if (e.key >= '0' && e.key <= '9') {
                this.inputNumber(e.key);
            }
            // Операторы
            else if (e.key === '+') this.inputOperator('+');
            else if (e.key === '-') this.inputOperator('-');
            else if (e.key === '*') this.inputOperator('*');
            else if (e.key === '/') this.inputOperator('/');
            // Специальные клавиши
            else if (e.key === 'Enter' || e.key === '=') this.calculate();
            else if (e.key === 'Escape') this.clear();
            else if (e.key === 'Delete') this.clearEntry();
            else if (e.key === 'Backspace') this.backspace();
            else if (e.key === '.' || e.key === ',') this.inputDecimal();
            // Горячие клавиши для истории
            else if (e.key.toLowerCase() === 'h') {
                window.historyManager.togglePanel();
            }
        });
    }

    inputNumber(number) {
        if (this.shouldResetDisplay) {
            this.currentExpression = '';
            this.shouldResetDisplay = false;
        }
        
        // Предотвращаем ввод множественных нулей в начале
        if (this.currentExpression === '0' && number === '0') {
            return;
        }
        
        // Заменяем начальный ноль
        if (this.currentExpression === '0' && number !== '0') {
            this.currentExpression = number;
        } else {
            this.currentExpression += number;
        }
        
        this.updateDisplay();
    }

    inputOperator(operator) {
        if (this.currentExpression === '') {
            this.currentExpression = this.previousResult.toString();
        }
        
        // Заменяем последний оператор, если он уже есть
        if (this.isLastCharOperator()) {
            this.currentExpression = this.currentExpression.slice(0, -1) + operator;
        } else {
            this.currentExpression += operator;
        }
        
        this.updateDisplay();
    }

    inputDecimal() {
        if (this.shouldResetDisplay) {
            this.currentExpression = '0';
            this.shouldResetDisplay = false;
        }
        
        const parts = this.currentExpression.split(/[+\-*/]/);
        const lastPart = parts[parts.length - 1];
        
        // Проверяем, есть ли уже десятичная точка в текущем числе
        if (!lastPart.includes('.')) {
            if (this.currentExpression === '' || this.isLastCharOperator()) {
                this.currentExpression += '0.';
            } else {
                this.currentExpression += '.';
            }
            this.updateDisplay();
        }
    }

    calculate() {
        if (this.currentExpression === '') {
            return;
        }
        
        try {
            // Сохраняем оригинальное выражение для истории
            const originalExpression = this.currentExpression;
            
            // Заменяем операторы для корректного вычисления
            const expression = this.currentExpression
                .replace(/×/g, '*')
                .replace(/÷/g, '/');
            
            // Проверяем корректность выражения
            if (this.isValidExpression(expression)) {
                const result = this.evaluateExpression(expression);
                
                if (isNaN(result) || !isFinite(result)) {
                    throw new Error('Неопределенный результат');
                }
                
                this.previousResult = result;
                this.currentExpression = this.formatNumber(result);
                this.shouldResetDisplay = true;
                
                // Добавляем в историю
                window.historyManager.add(
                    this.formatExpressionForHistory(originalExpression), 
                    this.currentExpression
                );
                
            } else {
                throw new Error('Некорректное выражение');
            }
        } catch (error) {
            window.toast.error(error.message || 'Ошибка вычисления');
            this.currentExpression = 'Ошибка';
        }
        
        this.updateDisplay();
    }

    square() {
        const currentValue = this.getCurrentNumber();
        if (currentValue !== null) {
            const result = currentValue * currentValue;
            this.replaceCurrentNumber(result);
            window.historyManager.add(`sqr(${currentValue})`, result.toString());
        }
    }

    sqrt() {
        const currentValue = this.getCurrentNumber();
        if (currentValue !== null) {
            if (currentValue < 0) {
                window.toast.error('Невозможно извлечь корень из отрицательного числа');
                return;
            }
            const result = Math.sqrt(currentValue);
            this.replaceCurrentNumber(result);
            window.historyManager.add(`√(${currentValue})`, result.toString());
        }
    }

    reciprocal() {
        const currentValue = this.getCurrentNumber();
        if (currentValue !== null) {
            if (currentValue === 0) {
                window.toast.error('Деление на ноль невозможно');
                return;
            }
            const result = 1 / currentValue;
            this.replaceCurrentNumber(result);
            window.historyManager.add(`1/(${currentValue})`, result.toString());
        }
    }

    percent() {
        const currentValue = this.getCurrentNumber();
        if (currentValue !== null) {
            const result = currentValue / 100;
            this.replaceCurrentNumber(result);
            window.historyManager.add(`${currentValue}%`, result.toString());
        }
    }

    clear() {
        this.currentExpression = '';
        this.previousResult = 0;
        this.shouldResetDisplay = false;
        this.lastOperator = null;
        this.lastOperand = null;
        this.updateDisplay();
    }

    clearEntry() {
        // Очищаем текущий ввод до последнего оператора
        const lastOperatorIndex = Math.max(
            this.currentExpression.lastIndexOf('+'),
            this.currentExpression.lastIndexOf('-'),
            this.currentExpression.lastIndexOf('*'),
            this.currentExpression.lastIndexOf('/')
        );
        
        if (lastOperatorIndex >= 0) {
            this.currentExpression = this.currentExpression.substring(0, lastOperatorIndex + 1);
        } else {
            this.currentExpression = '';
        }
        
        this.updateDisplay();
    }

    backspace() {
        if (this.currentExpression.length > 0) {
            this.currentExpression = this.currentExpression.slice(0, -1);
            this.updateDisplay();
        }
    }

    // Утилиты

    getCurrentNumber() {
        const parts = this.currentExpression.split(/[+\-*/]/);
        const lastPart = parts[parts.length - 1];
        const number = parseFloat(lastPart);
        return isNaN(number) ? null : number;
    }

    replaceCurrentNumber(newNumber) {
        const formattedNumber = this.formatNumber(newNumber);
        const parts = this.currentExpression.split(/([+\-*/])/);
        parts[parts.length - 1] = formattedNumber;
        this.currentExpression = parts.join('');
        this.updateDisplay();
    }

    getCurrentValue() {
        return this.currentExpression || '0';
    }

    setDisplay(value) {
        this.currentExpression = value;
        this.shouldResetDisplay = true;
        this.updateDisplay();
    }

    isLastCharOperator() {
        const lastChar = this.currentExpression.slice(-1);
        return ['+', '-', '*', '/'].includes(lastChar);
    }

    isValidExpression(expression) {
        // Проверяем базовую структуру выражения
        if (expression === '' || this.isLastCharOperator()) {
            return false;
        }
        
        // Проверяем на корректные символы
        if (!/^[0-9+\-*/.() ]+$/.test(expression)) {
            return false;
        }
        
        return true;
    }

    evaluateExpression(expression) {
        // Используем Function constructor для безопасного вычисления
        try {
            return Function(`"use strict"; return (${expression})`)();
        } catch (error) {
            throw new Error('Ошибка в выражении');
        }
    }

    formatNumber(number) {
        // Форматируем число для отображения
        if (typeof number !== 'number' || isNaN(number)) {
            return '0';
        }
        
        // Округляем до 10 знаков после запятой
        const rounded = Math.round(number * 10000000000) / 10000000000;
        
        // Преобразуем в строку и заменяем точку на запятую
        return rounded.toString().replace('.', ',');
    }

    formatExpressionForHistory(expression) {
        return expression
            .replace(/\*/g, '×')
            .replace(/\//g, '÷')
            .replace(/\./g, ',');
    }

    updateDisplay() {
        // Отображаем выражение
        const displayExpression = this.currentExpression || '0';
        this.expressionElement.textContent = this.formatExpressionForHistory(displayExpression);
        
        // Вычисляем и отображаем промежуточный результат
        if (this.currentExpression && !this.shouldResetDisplay) {
            try {
                const tempExpression = this.currentExpression.replace(/×/g, '*').replace(/÷/g, '/');
                if (this.isValidExpression(tempExpression) && !this.isLastCharOperator()) {
                    const tempResult = this.evaluateExpression(tempExpression);
                    if (!isNaN(tempResult) && isFinite(tempResult)) {
                        this.resultElement.textContent = this.formatNumber(tempResult);
                        return;
                    }
                }
            } catch (error) {
                // Игнорируем ошибки промежуточного вычисления
            }
        }
        
        // Отображаем текущее значение
        this.resultElement.textContent = this.formatExpressionForHistory(displayExpression);
    }
}

// ===== INITIALIZATION =====

// Инициализация приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    // Создаем глобальные экземпляры менеджеров
    window.toast = new ToastManager();
    window.themeManager = new ThemeManager();
    window.historyManager = new HistoryManager();
    window.memoryManager = new MemoryManager();
    window.calculator = new Calculator();
    
    // Показываем приветственное сообщение
    setTimeout(() => {
        window.toast.success('Калькулятор готов к работе!');
    }, 500);
    
    console.log('🧮 Современный калькулятор инициализирован');
    console.log('Доступные команды в консоли:');
    console.log('- calculator: основной объект калькулятора');
    console.log('- historyManager: управление историей');
    console.log('- memoryManager: управление памятью');
    console.log('- themeManager: переключение тем');
});

// Обработка ошибок
window.addEventListener('error', (event) => {
    console.error('Ошибка в калькуляторе:', event.error);
    if (window.toast) {
        window.toast.error('Произошла неожиданная ошибка');
    }
});

// Обработка изменения размера окна для адаптивности
window.addEventListener('resize', () => {
    // Закрываем панель истории на мобильных устройствах при повороте
    if (window.innerWidth <= 768 && window.historyManager && window.historyManager.isVisible) {
        window.historyManager.togglePanel();
    }
});

// Service Worker для оффлайн работы (опционально)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Можно добавить регистрацию Service Worker для PWA функциональности
    });
}