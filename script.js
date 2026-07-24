// ============================================================
// SMART LIVE CHAT SYSTEM
// script.js
// ============================================================

// ============================================================
// 1. إعدادات البث
// ============================================================

// غيّر هذا فقط عند تغيير البث
const VIDEO_ID = "WnN_epmXuls";

// ============================================================
// 2. رابط Supabase Edge Function
// ============================================================

const WORKER_URL =
    "https://urpwmgntrdzooemnvccx.supabase.co/functions/v1/smart-worker";

// ============================================================
// 3. إعدادات النظام
// ============================================================

const POLLING_INTERVAL = 30000;

let isRunning = false;
let timer = null;

// ============================================================
// 4. عناصر الصفحة
// ============================================================

const elements = {
    messages:
        document.getElementById("messages"),

    status:
        document.getElementById("status"),

    videoId:
        document.getElementById("video-id"),

    liveChatId:
        document.getElementById("live-chat-id"),

    messageCount:
        document.getElementById("message-count"),

    error:
        document.getElementById("error")
};

// ============================================================
// 5. أدوات الواجهة
// ============================================================

function setStatus(text) {

    if (elements.status) {
        elements.status.textContent =
            text;
    }

    console.log(
        "[STATUS]",
        text
    );
}


function setError(error) {

    const message =
        error instanceof Error
            ? error.message
            : String(error);

    if (elements.error) {
        elements.error.textContent =
            message;
    }

    console.error(
        "[ERROR]",
        message
    );
}


function clearError() {

    if (elements.error) {
        elements.error.textContent =
            "";
    }

}


// ============================================================
// 6. التحقق من VIDEO_ID
// ============================================================

function validateVideoId() {

    if (
        !VIDEO_ID ||
        typeof VIDEO_ID !==
            "string"
    ) {

        throw new Error(
            "VIDEO_ID غير موجود"
        );

    }

    if (
        VIDEO_ID.length <
        5
    ) {

        throw new Error(
            "VIDEO_ID غير صالح"
        );

    }

    return true;

}


// ============================================================
// 7. عرض معلومات البث
// ============================================================

function updateStreamInfo(data) {

    if (
        elements.videoId
    ) {

        elements.videoId.textContent =
            data.video_id ??
            VIDEO_ID;

    }


    if (
        elements.liveChatId
    ) {

        elements.liveChatId.textContent =
            data.live_chat_id ??
            "غير متوفر";

    }


    if (
        elements.messageCount
    ) {

        elements.messageCount.textContent =
            data.saved_messages ??
            0;

    }

}


// ============================================================
// 8. إنشاء عنصر رسالة
// ============================================================

function createMessageElement(
    message
) {

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "chat-message";


    const author =
        document.createElement(
            "strong"
        );

    author.className =
        "chat-author";

    author.textContent =
        message.author_name ??
        "مستخدم";


    const content =
        document.createElement(
            "span"
        );

    content.className =
        "chat-content";

    content.textContent =
        message.message ??
        "";


    wrapper.appendChild(
        author
    );

    wrapper.appendChild(
        document.createTextNode(
            ": "
        )
    );

    wrapper.appendChild(
        content
    );


    return wrapper;

}


// ============================================================
// 9. عرض مجموعة رسائل
// ============================================================

function renderMessages(
    messages
) {

    if (
        !elements.messages
    ) {
        return;
    }


    for (
        const message
        of messages
    ) {

        const element =
            createMessageElement(
                message
            );

        elements.messages.appendChild(
            element
        );

    }


    // النزول لآخر رسالة
    elements.messages.scrollTop =
        elements.messages.scrollHeight;

}


// ============================================================
// 10. استدعاء Smart Worker
// ============================================================

async function callWorker() {

    validateVideoId();

    clearError();

    setStatus(
        "جاري مزامنة البث..."
    );


    const response =
        await fetch(
            WORKER_URL,
            {

                method:
                    "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        video_id:
                            VIDEO_ID
                    })

            }
        );


    let data;

    try {

        data =
            await response.json();

    } catch {

        throw new Error(
            "استجابة غير صالحة من الخادم"
        );

    }


    if (
        !response.ok
    ) {

        throw new Error(

            data?.error ??

            `HTTP ${response.status}`

        );

    }


    if (
        data.success !==
        true
    ) {

        throw new Error(

            data?.error ??

            "فشل تنفيذ Smart Worker"

        );

    }


    updateStreamInfo(
        data
    );


    setStatus(
        "تمت المزامنة بنجاح"
    );


    return data;

}


// ============================================================
// 11. تشغيل النظام
// ============================================================

async function runSystem() {

    if (
        isRunning
    ) {

        return;

    }


    isRunning =
        true;


    try {

        await callWorker();

    } catch (
        error
    ) {

        setStatus(
            "حدث خطأ"
        );

        setError(
            error
        );

    } finally {

        isRunning =
            false;

    }

}


// ============================================================
// 12. التشغيل الدوري
// ============================================================

function startPolling() {

    stopPolling();


    timer =
        setInterval(

            () => {

                runSystem();

            },

            POLLING_INTERVAL

        );


    console.log(
        "Polling started"
    );

}


// ============================================================
// 13. إيقاف التشغيل الدوري
// ============================================================

function stopPolling() {

    if (
        timer
    ) {

        clearInterval(
            timer
        );

        timer =
            null;

    }


    console.log(
        "Polling stopped"
    );

}


// ============================================================
// 14. بدء النظام
// ============================================================

async function startSystem() {

    console.log(
        "================================"
    );

    console.log(
        "SMART LIVE CHAT SYSTEM"
    );

    console.log(
        "================================"
    );


    console.log(
        "VIDEO_ID:",
        VIDEO_ID
    );


    try {

        validateVideoId();

        await runSystem();

        startPolling();

    } catch (
        error
    ) {

        setError(
            error
        );

    }

}


// ============================================================
// 15. إيقاف النظام عند مغادرة الصفحة
// ============================================================

window.addEventListener(
    "beforeunload",
    () => {

        stopPolling();

    }
);


// ============================================================
// 16. تشغيل النظام
// ============================================================

startSystem();
