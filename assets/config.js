/* ============================================
   ARMY Eclipse Exam System — Configuration
   ============================================ */

window.ArmyExamConfig = {
    SECRET: "army_exam_secret_2024",
    ADMIN_LOGIN: "admin",
    ADMIN_PASSWORD_MD5: "150f5f3d230e89e9f7db3a2effe89a1d",
    DEFAULT_PASS_RATE: 0.8,
    EXAM_DURATION_MS: 30 * 60 * 1000, // 30 минут
    EXAMS: {
        "3-4": { title: "3 -> 4 ранг", file: "exam-3-4.json", questionCount: 10, passRate: 0.8 },
        "4-5": { title: "4 -> 5 ранг", file: "exam-4-5.json", questionCount: 15, passRate: 0.8 },
        "5-6": { title: "5 -> 6 ранг", file: "exam-5-6.json", questionCount: 20, passRate: 0.8 },
        "10-11": { title: "10 -> 11 ранг", file: "exam-10-11.json", questionCount: 30, passRate: 0.8 },
        "11-12": { title: "11 -> 12 ранг", file: "exam-11-12.json", questionCount: 30, passRate: 0.8 }
    }
};