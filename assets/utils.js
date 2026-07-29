/* ============================================
   ARMY Eclipse Exam System — Utility Functions
   ============================================ */

window.ArmyExamUtils = (function () {
    "use strict";

    function escapeHtml(value) {
        const amp = String.fromCharCode(38) + "amp;";
        const lt = String.fromCharCode(38) + "lt;";
        const gt = String.fromCharCode(38) + "gt;";
        const quot = String.fromCharCode(38) + "quot;";
        return String(value)
            .replace(/&/g, amp)
            .replace(/</g, lt)
            .replace(/>/g, gt)
            .replace(/"/g, quot)
            .replace(/'/g, "&#039;");
    }

    function encodePayload(payload) {
        const json = JSON.stringify(payload);
        const bytes = new TextEncoder().encode(json);
        let binary = "";
        bytes.forEach(function (byte) {
            binary += String.fromCharCode(byte);
        });
        return btoa(binary);
    }

    function decodePayload(key) {
        const binary = atob(key);
        const bytes = Uint8Array.from(binary, function (char) { return char.charCodeAt(0); });
        return JSON.parse(new TextDecoder().decode(bytes));
    }

    function todayIso() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        return year + "-" + month + "-" + day;
    }

    function simpleHash(input) {
        var hash = 2166136261;
        var str = String(input);
        for (var i = 0; i < str.length; i += 1) {
            hash ^= str.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, "0");
    }

    function shuffle(items) {
        var copy = items.slice();
        for (var i = copy.length - 1; i > 0; i -= 1) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = copy[i];
            copy[i] = copy[j];
            copy[j] = temp;
        }
        return copy;
    }

    function formatLectureText(text) {
        return String(text)
            .split(/\n\s*\n/)
            .filter(Boolean)
            .map(function (paragraph) {
                return "<p>" + escapeHtml(paragraph.trim()) + "</p>";
            })
            .join("");
    }

    function attemptKey(rawKey) {
        return "army_exam_attempt_" + simpleHash(rawKey);
    }

    function prepareQuestions(questions, examType) {
        var config = window.ArmyExamConfig.EXAMS[examType] || {};
        var count = config.questionCount || 10;
        return shuffle(questions).slice(0, count).map(function (question, index) {
            var options = shuffle(question.options.map(function (text, originalIndex) {
                return { text: text, originalIndex: originalIndex };
            }));
            return Object.assign({}, question, { number: index + 1, options: options });
        });
    }

    function prepareDemoQuestions(questions) {
        // Берем первые 5 вопросов, не тасуем, не тасуем варианты ответов
        // Сохраняем originalIndex у вариантов для определения correct
        return questions.slice(0, 5).map(function (question, index) {
            var options = question.options.map(function (text, originalIndex) {
                return { text: text, originalIndex: originalIndex };
            });
            return Object.assign({}, question, { number: index + 1, options: options });
        });
    }

    function showAlert(containerId, message, type) {
        if (type === undefined) { type = "error"; }
        var target = document.getElementById(containerId);
        if (!target) return;
        var icon = type === "success" ? "check-circle"
            : type === "warning" ? "triangle-exclamation"
            : "circle-exclamation";
        target.innerHTML = '<div class="alert ' + type + '"><i class="fas fa-' + icon + '"></i><span>' + escapeHtml(message) + '</span></div>';
    }

    function clearAlert(containerId) {
        var target = document.getElementById(containerId);
        if (target) target.innerHTML = "";
    }

    function md5(input) {
        function rotateLeft(value, shift) {
            return (value << shift) | (value >>> (32 - shift));
        }
        function addUnsigned(left, right) {
            var l4 = left & 0x40000000;
            var r4 = right & 0x40000000;
            var l8 = left & 0x80000000;
            var r8 = right & 0x80000000;
            var result = (left & 0x3fffffff) + (right & 0x3fffffff);
            if (l4 & r4) return result ^ 0x80000000 ^ l8 ^ r8;
            if (l4 | r4) return (result & 0x40000000) ? result ^ 0xc0000000 ^ l8 ^ r8 : result ^ 0x40000000 ^ l8 ^ r8;
            return result ^ l8 ^ r8;
        }
        function f(x, y, z) { return (x & y) | (~x & z); }
        function g(x, y, z) { return (x & z) | (y & ~z); }
        function h(x, y, z) { return x ^ y ^ z; }
        function i(x, y, z) { return y ^ (x | ~z); }
        function ff(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(f(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
        function gg(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(g(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
        function hh(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(h(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
        function ii(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(i(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
        function convertToWordArray(str) {
            var messageLength = str.length;
            var numberOfWordsTemp1 = messageLength + 8;
            var numberOfWordsTemp2 = (numberOfWordsTemp1 - (numberOfWordsTemp1 % 64)) / 64;
            var numberOfWords = (numberOfWordsTemp2 + 1) * 16;
            var wordArray = Array(numberOfWords - 1);
            var bytePosition = 0;
            var byteCount = 0;
            while (byteCount < messageLength) {
                var wordCount = (byteCount - (byteCount % 4)) / 4;
                bytePosition = (byteCount % 4) * 8;
                wordArray[wordCount] = (wordArray[wordCount] | (str.charCodeAt(byteCount) << bytePosition));
                byteCount += 1;
            }
            var wordCount = (byteCount - (byteCount % 4)) / 4;
            bytePosition = (byteCount % 4) * 8;
            wordArray[wordCount] = wordArray[wordCount] | (0x80 << bytePosition);
            wordArray[numberOfWords - 2] = messageLength << 3;
            wordArray[numberOfWords - 1] = messageLength >>> 29;
            return wordArray;
        }
        function wordToHex(value) {
            var result = "";
            for (var count = 0; count <= 3; count += 1) {
                var byte = (value >>> (count * 8)) & 255;
                result += ("0" + byte.toString(16)).slice(-2);
            }
            return result;
        }
        var utf8 = unescape(encodeURIComponent(input));
        var x = convertToWordArray(utf8);
        var a = 0x67452301;
        var b = 0xefcdab89;
        var c = 0x98badcfe;
        var d = 0x10325476;
        for (var k = 0; k < x.length; k += 16) {
            var aa = a;
            var bb = b;
            var cc = c;
            var dd = d;
            a = ff(a, b, c, d, x[k + 0], 7, 0xd76aa478);
            d = ff(d, a, b, c, x[k + 1], 12, 0xe8c7b756);
            c = ff(c, d, a, b, x[k + 2], 17, 0x242070db);
            b = ff(b, c, d, a, x[k + 3], 22, 0xc1bdceee);
            a = ff(a, b, c, d, x[k + 4], 7, 0xf57c0faf);
            d = ff(d, a, b, c, x[k + 5], 12, 0x4787c62a);
            c = ff(c, d, a, b, x[k + 6], 17, 0xa8304613);
            b = ff(b, c, d, a, x[k + 7], 22, 0xfd469501);
            a = ff(a, b, c, d, x[k + 8], 7, 0x698098d8);
            d = ff(d, a, b, c, x[k + 9], 12, 0x8b44f7af);
            c = ff(c, d, a, b, x[k + 10], 17, 0xffff5bb1);
            b = ff(b, c, d, a, x[k + 11], 22, 0x895cd7be);
            a = ff(a, b, c, d, x[k + 12], 7, 0x6b901122);
            d = ff(d, a, b, c, x[k + 13], 12, 0xfd987193);
            c = ff(c, d, a, b, x[k + 14], 17, 0xa679438e);
            b = ff(b, c, d, a, x[k + 15], 22, 0x49b40821);
            a = gg(a, b, c, d, x[k + 1], 5, 0xf61e2562);
            d = gg(d, a, b, c, x[k + 6], 9, 0xc040b340);
            c = gg(c, d, a, b, x[k + 11], 14, 0x265e5a51);
            b = gg(b, c, d, a, x[k + 0], 20, 0xe9b6c7aa);
            a = gg(a, b, c, d, x[k + 5], 5, 0xd62f105d);
            d = gg(d, a, b, c, x[k + 10], 9, 0x02441453);
            c = gg(c, d, a, b, x[k + 15], 14, 0xd8a1e681);
            b = gg(b, c, d, a, x[k + 4], 20, 0xe7d3fbc8);
            a = gg(a, b, c, d, x[k + 9], 5, 0x21e1cde6);
            d = gg(d, a, b, c, x[k + 14], 9, 0xc33707d6);
            c = gg(c, d, a, b, x[k + 3], 14, 0xf4d50d87);
            b = gg(b, c, d, a, x[k + 8], 20, 0x455a14ed);
            a = gg(a, b, c, d, x[k + 13], 5, 0xa9e3e905);
            d = gg(d, a, b, c, x[k + 2], 9, 0xfcefa3f8);
            c = gg(c, d, a, b, x[k + 7], 14, 0x676f02d9);
            b = gg(b, c, d, a, x[k + 12], 20, 0x8d2a4c8a);
            a = hh(a, b, c, d, x[k + 5], 4, 0xfffa3942);
            d = hh(d, a, b, c, x[k + 8], 11, 0x8771f681);
            c = hh(c, d, a, b, x[k + 11], 16, 0x6d9d6122);
            b = hh(b, c, d, a, x[k + 14], 23, 0xfde5380c);
            a = hh(a, b, c, d, x[k + 1], 4, 0xa4beea44);
            d = hh(d, a, b, c, x[k + 4], 11, 0x4bdecfa9);
            c = hh(c, d, a, b, x[k + 7], 16, 0xf6bb4b60);
            b = hh(b, c, d, a, x[k + 10], 23, 0xbebfbc70);
            a = hh(a, b, c, d, x[k + 13], 4, 0x289b7ec6);
            d = hh(d, a, b, c, x[k + 0], 11, 0xeaa127fa);
            c = hh(c, d, a, b, x[k + 3], 16, 0xd4ef3085);
            b = hh(b, c, d, a, x[k + 6], 23, 0x04881d05);
            a = hh(a, b, c, d, x[k + 9], 4, 0xd9d4d039);
            d = hh(d, a, b, c, x[k + 12], 11, 0xe6db99e5);
            c = hh(c, d, a, b, x[k + 15], 16, 0x1fa27cf8);
            b = hh(b, c, d, a, x[k + 2], 23, 0xc4ac5665);
            a = ii(a, b, c, d, x[k + 0], 6, 0xf4292244);
            d = ii(d, a, b, c, x[k + 7], 10, 0x432aff97);
            c = ii(c, d, a, b, x[k + 14], 15, 0xab9423a7);
            b = ii(b, c, d, a, x[k + 5], 21, 0xfc93a039);
            a = ii(a, b, c, d, x[k + 12], 6, 0x655b59c3);
            d = ii(d, a, b, c, x[k + 3], 10, 0x8f0ccc92);
            c = ii(c, d, a, b, x[k + 10], 15, 0xffeff47d);
            b = ii(b, c, d, a, x[k + 1], 21, 0x85845dd1);
            a = ii(a, b, c, d, x[k + 8], 6, 0x6fa87e4f);
            d = ii(d, a, b, c, x[k + 15], 10, 0xfe2ce6e0);
            c = ii(c, d, a, b, x[k + 6], 15, 0xa3014314);
            b = ii(b, c, d, a, x[k + 13], 21, 0x4e0811a1);
            a = ii(a, b, c, d, x[k + 4], 6, 0xf7537e82);
            d = ii(d, a, b, c, x[k + 11], 10, 0xbd3af235);
            c = ii(c, d, a, b, x[k + 2], 15, 0x2ad7d2bb);
            b = ii(b, c, d, a, x[k + 9], 21, 0xeb86d391);
            a = addUnsigned(a, aa);
            b = addUnsigned(b, bb);
            c = addUnsigned(c, cc);
            d = addUnsigned(d, dd);
        }
        return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
    }

    return {
        escapeHtml: escapeHtml,
        encodePayload: encodePayload,
        decodePayload: decodePayload,
        todayIso: todayIso,
        simpleHash: simpleHash,
        shuffle: shuffle,
        formatLectureText: formatLectureText,
        attemptKey: attemptKey,
        prepareQuestions: prepareQuestions,
        prepareDemoQuestions: prepareDemoQuestions,
        showAlert: showAlert,
        clearAlert: clearAlert,
        md5: md5
    };
}());