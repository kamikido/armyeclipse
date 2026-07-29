/* ============================================
   ARMY Eclipse Exam System — Application Logic
   ============================================ */

(function () {
    "use strict";

    var C = window.ArmyExamConfig;
    var U = window.ArmyExamUtils;

    var state = {
        keyRaw: "",
        examData: null,
        questions: [],
        answers: {},
        timerIntervalId: null,
        lectures: []
    };

    /* =============================
       THEME
       ============================= */

    function initTheme() {
        var themeSwitch = document.getElementById("themeSwitch");
        if (!themeSwitch) return;

        var apply = function () {
            var isLight = document.body.classList.contains("light");
            var icon = themeSwitch.querySelector("i");
            var span = themeSwitch.querySelector("span");
            if (icon) icon.className = isLight ? "fas fa-moon" : "fas fa-sun";
            if (span) span.textContent = isLight ? "Темная тема" : "Светлая тема";
        };

        if (localStorage.getItem("armyTheme") === "light") {
            document.body.classList.add("light");
        }
        apply();

        themeSwitch.addEventListener("click", function () {
            document.body.classList.toggle("light");
            localStorage.setItem("armyTheme", document.body.classList.contains("light") ? "light" : "dark");
            apply();
        });
    }

    /* =============================
       WELCOME OVERLAY
       ============================= */

    function hideWelcome() {
        var overlay = document.getElementById("welcomeOverlay");
        if (!overlay) return;
        setTimeout(function () {
            overlay.style.opacity = "0";
            setTimeout(function () {
                overlay.style.display = "none";
            }, 1000);
        }, 1400);
    }

    /* =============================
       KEY VALIDATION
       ============================= */

    function validateKey(rawKey) {
        var decoded = U.decodePayload(rawKey);
        if (!decoded || decoded.secret !== C.SECRET) throw new Error("Неверный ключ экзамена.");
        if (!decoded.nick || !decoded.exam || !decoded.date || !decoded.issueId) throw new Error("Ключ неполный.");
        if (!C.EXAMS[decoded.exam]) throw new Error("Неизвестный тип экзамена.");
        if (decoded.date !== U.todayIso()) throw new Error("Ключ действует только в указанную дату экзамена.");
        if (!decoded.expiresAt || Date.now() > decoded.expiresAt) throw new Error("Время действия ключа истекло. Обратитесь к инструктору за новым ключом.");
        return decoded;
    }

    /* =============================
       QUESTIONS LOADING
       ============================= */

    function loadQuestions(exam, examType) {
        var source = window.ArmyExamQuestionsFallback;
        if (!source || !source[exam] || !Array.isArray(source[exam]) || source[exam].length === 0) {
            throw new Error("Не удалось загрузить вопросы экзамена: вопросы не найдены.");
        }
        return U.prepareQuestions(source[exam], examType);
    }

    /* =============================
       INDEX PAGE
       ============================= */

    function initIndex() {
        initTheme();
        hideWelcome();

        var input = document.getElementById("examKey");
        var button = document.getElementById("startBtn");
        if (!input || !button) return;

        button.addEventListener("click", function () {
            var key = input.value.trim();
            U.clearAlert("formAlert");

            if (!key) {
                U.showAlert("formAlert", "Введите ключ экзамена.", "error");
                return;
            }

            try {
                var decoded = validateKey(key);
                if (localStorage.getItem(U.attemptKey(key))) {
                    U.showAlert("formAlert", "Этот ключ уже использовался в данном браузере.", "warning");
                    return;
                }

                sessionStorage.setItem("examKeyRaw", key);
                sessionStorage.setItem("examData", JSON.stringify(decoded));
                window.location.href = "exam.html";
            } catch (error) {
                U.showAlert("formAlert", error.message || "Неверный формат ключа.", "error");
            }
        });
    }

    /* =============================
       EXAM PAGE
       ============================= */

    function initExam(opts) {
        initTheme();
        // В демо-режиме не ставим античит (чтобы можно было копировать)
        if (!opts || !opts.demo) {
            installAntiCheat();
        }

        // Демо-режим
        if (opts && opts.demo && opts.from && opts.to) {
            initDemoExam(opts);
            return;
        }

        // Обычный режим
        var rawKey = sessionStorage.getItem("examKeyRaw");
        var savedData = sessionStorage.getItem("examData");
        if (!rawKey || !savedData) {
            renderBlocked("Экзамен запускается только после ввода ключа на главной странице.");
            return;
        }

        try {
            state.keyRaw = rawKey;
            state.examData = validateKey(rawKey);
            if (localStorage.getItem(U.attemptKey(rawKey))) {
                renderBlocked("Этот ключ уже использовался в данном браузере.");
                return;
            }

            document.getElementById("candidateName").textContent = state.examData.nick;
            document.getElementById("examLevel").textContent = C.EXAMS[state.examData.exam].title;
            state.questions = loadQuestions(state.examData.exam, state.examData.exam);
            renderExam();
            startTimer();
        } catch (error) {
            renderBlocked(error.message || "Не удалось открыть экзамен.");
        }
    }

    /* =============================
       DEMO EXAM MODE
       ============================= */

    function initDemoExam(opts) {
        var examKey = opts.from + "-" + opts.to;

        // Проверяем, есть ли такая группа вопросов
        var source = window.ArmyExamQuestionsFallback;
        if (!source || !source[examKey] || !Array.isArray(source[examKey]) || source[examKey].length === 0) {
            renderBlocked("Вопросы для данного диапазона рангов не найдены.");
            return;
        }

        state.examData = {
            nick: "Демо",
            exam: examKey
        };

        document.getElementById("candidateName").textContent = "Демо";
        document.getElementById("examLevel").textContent = C.EXAMS[examKey] ? C.EXAMS[examKey].title : (opts.from + " -> " + opts.to + " ранг");

        // Берём первые 5 вопросов без тасования
        if (typeof U.prepareDemoQuestions === 'function') {
            state.questions = U.prepareDemoQuestions(source[examKey]);
        } else {
            // Fallback если функция не загрузилась
            state.questions = source[examKey].slice(0, 5).map(function (question, index) {
                return Object.assign({}, question, { number: index + 1 });
            });
        }
        state.demoMode = true;

        renderExam();
    }

    function highlightDemoAnswers() {
        // Подсвечиваем правильные/неправильные ответы без таймера
        var content = document.getElementById("examContent");
        if (!content) return;

        var counter = document.getElementById("questionCounter");
        if (counter) {
            counter.textContent = Object.keys(state.answers).length + "/" + state.questions.length;
        }

        content.querySelectorAll("article.question-card").forEach(function (card, index) {
            var question = state.questions[index];
            if (!question) return;

            var options = card.querySelectorAll(".option-item");
            options.forEach(function (option, optIndex) {
                var radio = option.querySelector("input[type='radio']");
                if (radio) {
                    radio.disabled = true;
                    var isCorrectAnswer = (question.correct === question.options[optIndex].originalIndex);
                    if (radio.checked) {
                        // Пользователь выбрал этот вариант
                        if (isCorrectAnswer) {
                            option.classList.add("demo-correct");
                        } else {
                            option.classList.add("demo-incorrect");
                        }
                    } else if (isCorrectAnswer) {
                        // Правильный ответ, который пользователь не выбрал
                        option.classList.add("demo-correct");
                    }
                }
            });
        });
    }

    function finishDemoExam() {
        var correct = state.questions.reduce(function (score, question) {
            return score + (state.answers[question.id] === question.correct ? 1 : 0);
        }, 0);
        var total = state.questions.length;

        // Подсвечиваем правильные/неправильные ответы
        highlightDemoAnswers();

        // Убираем кнопку "ЗАВЕРШИТЬ ДЕМО"
        var actions = document.querySelector("#examContent .exam-actions");
        if (actions) {
            actions.innerHTML = '\
                <button class="secondary-btn" type="button" onclick="window.close()">\
                    <i class="fas fa-times"></i> ЗАКРЫТЬ\
                </button>\
            ';
        }

        // Показываем результат сверху
        var resultHtml = '\
            <div class="question-card result-card" style="margin-bottom:20px">\
                <div class="result-status pass">ДЕМО-РЕЖИМ</div>\
                <div class="result-score">' + correct + "/" + total + ' правильных ответов</div>\
                <div class="result-meta">\
                    <span class="result-pill">Кандидат: Демо</span>\
                    <span class="result-pill">Экзамен: ' + U.escapeHtml(state.examData.exam) + '</span>\
                </div>\
            </div>\
        ';

        var content = document.getElementById("examContent");
        if (content) {
            content.insertAdjacentHTML("afterbegin", resultHtml);
        }

        U.clearAlert("examAlert");
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    /* =============================
       REGULAR EXAM
       ============================= */

    function renderBlocked(message) {
        var content = document.getElementById("examContent");
        if (!content) return;
        content.innerHTML = '\
            <div class="question-card result-card">\
                <div class="result-status fail">ДОСТУП ЗАКРЫТ</div>\
                <p class="result-score">' + U.escapeHtml(message) + '</p>\
                <div class="exam-actions">\
                    <button class="secondary-btn" type="button" onclick="window.location.href=\'index.html\'">\
                        <i class="fas fa-arrow-left"></i>\
                        К ВВОДУ КЛЮЧА\
                    </button>\
                </div>\
            </div>\
        ';
    }

    function renderExam() {
        var content = document.getElementById("examContent");
        var counter = document.getElementById("questionCounter");
        if (!content || !counter) return;

        counter.textContent = "0/" + state.questions.length;
        content.innerHTML = renderQuestionsHtml() + '\
            <div class="exam-actions">\
                <button class="submit-btn" id="finishExamBtn" type="button">\
                    <i class="fas fa-flag-checkered"></i>\
                    ' + (state.demoMode ? "ЗАВЕРШИТЬ ДЕМО" : "ЗАВЕРШИТЬ ЭКЗАМЕН") + '\
                </button>\
            </div>\
        ';

        content.querySelectorAll("input[type='radio']").forEach(function (input) {
            input.addEventListener("change", function () {
                state.answers[input.name] = Number(input.value);
                counter.textContent = Object.keys(state.answers).length + "/" + state.questions.length;
            });
        });

        document.getElementById("finishExamBtn").addEventListener("click", state.demoMode ? finishDemoExam : finishExam);
    }

    function renderQuestionsHtml() {
        return state.questions.map(function (question) {
            return '\
                <article class="question-card">\
                    <h3 class="question-title">' + question.number + '. ' + U.escapeHtml(question.question) + '</h3>\
                    <div class="options-list">\
                        ' + question.options.map(function (option) {
                            return '\
                                <label class="option-item">\
                                    <input type="radio" name="' + U.escapeHtml(question.id) + '" value="' + option.originalIndex + '">\
                                    <span>' + U.escapeHtml(option.text) + '</span>\
                                </label>\
                            ';
                        }).join("") + '\
                    </div>\
                </article>\
            ';
        }).join("");
    }

    function startTimer() {
        var timerEl = document.getElementById("examTimer");
        if (!timerEl) return;

        var startTime = Date.now();
        var duration = C.EXAM_DURATION_MS;

        state.timerIntervalId = setInterval(function () {
            var elapsed = Date.now() - startTime;
            var remaining = Math.max(0, duration - elapsed);
            var minutes = Math.floor(remaining / 60000);
            var seconds = Math.floor((remaining % 60000) / 1000);
            timerEl.textContent = String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");

            timerEl.classList.remove("warning", "danger");
            if (remaining <= 0) {
                clearInterval(state.timerIntervalId);
                state.timerIntervalId = null;
                timerEl.textContent = "00:00";
                handleTimerExpiry();
                return;
            }
            if (remaining <= 5 * 60 * 1000) {
                timerEl.classList.add("danger");
            } else if (remaining <= 10 * 60 * 1000) {
                timerEl.classList.add("warning");
            }
        }, 1000);
    }

    function handleTimerExpiry() {
        var answered = Object.keys(state.answers).length;
        if (answered < state.questions.length) {
            U.showAlert("examAlert", "Время вышло. Экзамен завершён автоматически.", "warning");
        }
        finishExam(true);
    }

    function finishExam(expired) {
        if (expired === undefined) { expired = false; }

        if (state.timerIntervalId) {
            clearInterval(state.timerIntervalId);
            state.timerIntervalId = null;
        }

        var answered = Object.keys(state.answers).length;
        if (!expired && answered < state.questions.length) {
            U.showAlert("examAlert", "Ответьте на все вопросы: " + answered + "/" + state.questions.length + ".", "warning");
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        var correct = state.questions.reduce(function (score, question) {
            return score + (state.answers[question.id] === question.correct ? 1 : 0);
        }, 0);
        var total = state.questions.length;
        var examConfig = C.EXAMS[state.examData.exam] || {};
        var passRate = examConfig.passRate || C.DEFAULT_PASS_RATE;
        var passed = correct / total >= passRate;
        var finishedAt = new Date().toLocaleString("ru-RU");
        var resultCode = U.simpleHash(state.examData.issueId + ":" + state.examData.nick + ":" + correct + ":" + total);

        localStorage.setItem(U.attemptKey(state.keyRaw), JSON.stringify({
            nick: state.examData.nick,
            exam: state.examData.exam,
            correct: correct,
            total: total,
            passed: passed,
            finishedAt: finishedAt,
            resultCode: resultCode
        }));
        sessionStorage.removeItem("examKeyRaw");
        sessionStorage.removeItem("examData");

        renderResult({ correct: correct, total: total, passed: passed, finishedAt: finishedAt, resultCode: resultCode });
    }

    function renderResult(result) {
        var content = document.getElementById("examContent");
        var counter = document.getElementById("questionCounter");
        if (counter) counter.textContent = result.total + "/" + result.total;
        if (!content) return;

        content.innerHTML = '\
            <div class="question-card result-card">\
                <div class="result-status ' + (result.passed ? "pass" : "fail") + '">' + (result.passed ? "СДАЛ" : "НЕ СДАЛ") + '</div>\
                <div class="result-score">' + result.correct + "/" + result.total + ' правильных ответов</div>\
                <div class="result-meta">\
                    <span class="result-pill">Кандидат: ' + U.escapeHtml(state.examData.nick) + '</span>\
                    <span class="result-pill">Экзамен: ' + U.escapeHtml(C.EXAMS[state.examData.exam].title) + '</span>\
                    <span class="result-pill">Дата: ' + U.escapeHtml(result.finishedAt) + '</span>\
                    <span class="result-pill">Код: ' + result.resultCode + '</span>\
                </div>\
            </div>\
        ';
        U.clearAlert("examAlert");
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function installAntiCheat() {
        document.addEventListener("contextmenu", function (event) { event.preventDefault(); });
        document.addEventListener("copy", function (event) { event.preventDefault(); });
        document.addEventListener("cut", function (event) { event.preventDefault(); });
        document.addEventListener("paste", function (event) { event.preventDefault(); });
        document.addEventListener("keydown", function (event) {
            var key = event.key.toLowerCase();
            var blockedCtrl = event.ctrlKey && ["a", "c", "v", "x", "s", "p", "u"].indexOf(key) !== -1;
            var blockedPrint = key === "printscreen";
            var blockedDevtools = event.key === "F12" || (event.ctrlKey && event.shiftKey && ["i", "j", "c"].indexOf(key) !== -1);
            if (blockedCtrl || blockedPrint || blockedDevtools) {
                event.preventDefault();
                U.showAlert("examAlert", "Это действие заблокировано во время экзамена.", "warning");
            }
        });
    }

    /* =============================
       ADMIN PAGE
       ============================= */

    function initAdmin() {
        initTheme();

        // Load lectures from fallback (avoids CORS issues on file://)
        state.lectures = window.ArmyExamLecturesFallback || [];

        var dateInput = document.getElementById("examDate");
        if (dateInput) dateInput.value = U.todayIso();

        var loginBtn = document.getElementById("loginBtn");
        if (loginBtn) loginBtn.addEventListener("click", handleLogin);

        var generateBtn = document.getElementById("generateBtn");
        if (generateBtn) generateBtn.addEventListener("click", handleGenerateKey);

        var copyBtn = document.getElementById("copyBtn");
        if (copyBtn) copyBtn.addEventListener("click", copyGeneratedKey);

        document.querySelectorAll(".workspace-tab").forEach(function (tab) {
            tab.addEventListener("click", function () { switchWorkspacePanel(tab.dataset.panel); });
        });

        renderLectureList();
    }

    function handleLogin() {
        var login = document.getElementById("login").value.trim();
        var password = document.getElementById("password").value;

        if (login !== C.ADMIN_LOGIN || U.md5(password) !== C.ADMIN_PASSWORD_MD5) {
            U.showAlert("loginAlert", "Неверный логин или пароль.", "error");
            return;
        }

        U.clearAlert("loginAlert");
        document.getElementById("loginCard").classList.add("is-hidden");
        document.getElementById("workspaceCard").classList.remove("is-hidden");
        switchWorkspacePanel("lecturesPanel");
    }

    function switchWorkspacePanel(panelId) {
        document.querySelectorAll(".workspace-panel").forEach(function (panel) {
            panel.classList.toggle("is-hidden", panel.id !== panelId);
        });
        document.querySelectorAll(".workspace-tab").forEach(function (tab) {
            tab.classList.toggle("is-active", tab.dataset.panel === panelId);
        });
    }

    function renderLectureList() {
        var list = document.getElementById("lectureList");
        if (!list) return;

        if (state.lectures.length === 0) {
            list.innerHTML = '<p class="text-muted">Лекции не загружены.</p>';
            return;
        }

        list.innerHTML = state.lectures.map(function (lecture, index) {
            return '\
                <button class="lecture-card ' + (index === 0 ? "is-active" : "") + '" type="button" data-lecture="' + lecture.id + '">\
                    <strong>' + U.escapeHtml(lecture.title) + '</strong>\
                    <span>' + U.escapeHtml(lecture.subtitle) + '</span>\
                </button>\
            ';
        }).join("");

        list.querySelectorAll(".lecture-card").forEach(function (card) {
            card.addEventListener("click", function () {
                list.querySelectorAll(".lecture-card").forEach(function (item) { item.classList.remove("is-active"); });
                card.classList.add("is-active");
                renderLecture(card.dataset.lecture);
            });
        });

        if (state.lectures.length > 0) {
            renderLecture(state.lectures[0].id);
        }
    }

    function renderLecture(lectureId) {
        var lecture = null;
        for (var i = 0; i < state.lectures.length; i++) {
            if (state.lectures[i].id === lectureId) {
                lecture = state.lectures[i];
                break;
            }
        }
        if (!lecture) lecture = state.lectures[0];
        if (!lecture) return;

        var content = document.getElementById("lectureContent");
        if (!content) return;
        U.clearAlert("lectureAlert");

        content.innerHTML = '\
            <div class="lecture-hero">\
                <div>\
                    <h3>' + U.escapeHtml(lecture.title) + ' — ' + U.escapeHtml(lecture.subtitle) + '</h3>\
                    <p>' + U.escapeHtml(lecture.goal) + '</p>\
                </div>\
                <div class="lecture-actions">\
                    <button class="secondary-btn" id="copyLectureAnnouncement" type="button">\
                        <i class="fas fa-copy"></i>\
                        НАЧАЛО\
                    </button>\
                </div>\
            </div>\
            <section class="lecture-section">\
                <h4>Текст лекции</h4>\
                <div class="lecture-script">\
                    ' + lecture.script.map(function (block) {
                        return '\
                            <article class="lecture-block">\
                                <h5>' + U.escapeHtml(block.title) + '</h5>\
                                <div class="lecture-block-text">' + U.formatLectureText(block.text) + '</div>\
                            </article>\
                        ';
                    }).join("") + '\
                </div>\
            </section>\
            <section class="lecture-section">\
                <h4>Главные тезисы</h4>\
                <ul class="lecture-points">\
                    ' + lecture.points.map(function (point) {
                        return '<li>' + U.escapeHtml(point) + '</li>';
                    }).join("") + '\
                </ul>\
            </section>\
            <section class="lecture-section">\
                <h4>Вопросы для закрепления</h4>\
                <ul class="lecture-points">\
                    ' + lecture.check.map(function (question) {
                        return '<li>' + U.escapeHtml(question) + '</li>';
                    }).join("") + '\
                </ul>\
            </section>\
            <section class="lecture-footer">\
                <div>\
                    <h4>Окончание лекции</h4>\
                    <p class="lecture-footer-text">' + U.escapeHtml(lecture.closingAnnouncement || lecture.announcement) + '</p>\
                </div>\
                <button class="secondary-btn" id="copyLectureClosing" type="button">\
                    <i class="fas fa-copy"></i>\
                    ОКОНЧАНИЕ\
                </button>\
            </section>\
        ';

        var announceBtn = document.getElementById("copyLectureAnnouncement");
        if (announceBtn) {
            announceBtn.addEventListener("click", function () { copyLectureText(lecture.announcement, "начала"); });
        }
        var closingBtn = document.getElementById("copyLectureClosing");
        if (closingBtn) {
            closingBtn.addEventListener("click", function () { copyLectureText(lecture.closingAnnouncement || lecture.announcement, "окончания"); });
        }
    }

    async function copyLectureText(text, label) {
        try {
            await navigator.clipboard.writeText(text);
            U.showAlert("lectureAlert", "Текст " + label + " лекции скопирован.", "success");
        } catch (error) {
            U.showAlert("lectureAlert", text, "warning");
        }
    }

    function handleGenerateKey() {
        var nick = document.getElementById("nick").value.trim();
        var exam = document.getElementById("examType").value;
        var date = document.getElementById("examDate").value;

        if (!nick || !exam || !date) {
            U.showAlert("keyAlert", "Заполните никнейм, экзамен и дату.", "error");
            return;
        }

        var payload = {
            nick: nick,
            exam: exam,
            date: date,
            timestamp: Date.now(),
            expiresAt: Date.now() + C.EXAM_DURATION_MS,
            issueId: U.simpleHash(nick + ":" + exam + ":" + date + ":" + Date.now() + ":" + Math.random()),
            secret: C.SECRET
        };

        document.getElementById("generatedKey").value = U.encodePayload(payload);
        U.showAlert("keyAlert", "Ключ создан. Передайте его кандидату перед началом экзамена.", "success");
    }

    async function copyGeneratedKey() {
        var key = document.getElementById("generatedKey").value;
        if (!key) {
            U.showAlert("keyAlert", "Сначала сгенерируйте ключ.", "warning");
            return;
        }
        try {
            await navigator.clipboard.writeText(key);
            U.showAlert("keyAlert", "Ключ скопирован.", "success");
        } catch (error) {
            U.showAlert("keyAlert", "Не удалось скопировать автоматически. Выделите ключ вручную.", "warning");
        }
    }

    /* =============================
       PUBLIC API
       ============================= */

    window.ArmyExam = {
        initIndex: initIndex,
        initExam: initExam,
        initAdmin: initAdmin
    };

}());

// --- ИНИЦИАЛИЗАЦИЯ ИНТЕРФЕЙСА УЧЕБНОГО ЦЕНТРА ---
document.addEventListener('DOMContentLoaded', function() {
    // 1. Логика переключения табов (вкладок)
    const sidebarButtons = document.querySelectorAll('.sidebar-menu-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    if (sidebarButtons.length > 0) {
        sidebarButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');

                // Переключаем активную кнопку меню
                sidebarButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                // Переключаем видимую панель с контентом
                tabPanels.forEach(panel => panel.classList.remove('active'));
                const activePanel = document.getElementById(`tab-${targetTab}`);
                if (activePanel) {
                    activePanel.classList.add('active');
                }
            });
        });
    }

    // 2. Инициализация экзаменационного скрипта, если элементы присутствуют
    if (window.ArmyExam && typeof window.ArmyExam.initIndex === 'function') {
        const hasExamElements = document.getElementById('examKey') && document.getElementById('startBtn');
        if (hasExamElements) {
            window.ArmyExam.initIndex();
        }
    }

    // 2.1 Демо-экзамен: открываем exam.html в новой вкладке
    (function() {
        const demoStartBtn = document.getElementById('demoStartBtn');
        if (!demoStartBtn) return;

        demoStartBtn.addEventListener('click', () => {
            const demoSelect = document.getElementById('demoExamSelect');
            if (!demoSelect) return;

            const examKey = demoSelect.value;
            if (!examKey) {
                alert('Выберите повышение для демо-экзамена.');
                return;
            }

            const parts = examKey.split('-');
            const fromRank = parts[0];
            const toRank = parts[1];

            const url = 'exam.html?demo=true&from=' + fromRank + '&to=' + toRank;
            window.open(url, '_blank');
        });
    })();

    // 3. Плавное скрытие экрана приветствия
    const overlay = document.getElementById('welcomeOverlay');
    if (overlay) {
        setTimeout(() => {
            overlay.style.opacity = '0';
            overlay.style.visibility = 'hidden';
        }, 1200);
    }

    // 4. Логика тумблера смены цветовой темы (светлая/тёмная)
    const themeBtn = document.getElementById('themeSwitch');
    if (themeBtn) {
        const updateThemeButtonUI = () => {
            const isLight = document.body.classList.contains('light');
            themeBtn.innerHTML = isLight
                ? '<i class="fas fa-moon"></i><span>Тёмная тема</span>'
                : '<i class="fas fa-sun"></i><span>Светлая тема</span>';
        };

        // Синхронизируем состояние при первой загрузке
        updateThemeButtonUI();

        themeBtn.addEventListener('click', () => {
            document.body.classList.toggle('light');
            localStorage.setItem(
                'army-theme',
                document.body.classList.contains('light') ? 'light' : 'dark'
            );
            updateThemeButtonUI();
        });
    }
});