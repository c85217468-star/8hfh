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
// 2. إعدادات Supabase
// ============================================================

const SUPABASE_URL =
    "https://urpwmgntrdzooemnvccx.supabase.co";

// ضع Publishable Key الخاص بـ Supabase هنا
const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_RxvIR8pqoTnrc1SSzBmbbQ_7691v21m";

// ============================================================
// 3. إعدادات YouTube
// ============================================================

// لا تضع مفتاح YouTube السري هنا إذا كان script.js
// منشورًا للعامة على GitHub.
// الأفضل أن يتم جلب بيانات YouTube من Edge Function.
// هذا الكود يفترض وجود Edge Function لهذا الغرض.

// ============================================================
// 4. إنشاء Supabase Client
// ============================================================

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );

// ============================================================
// 5. إعدادات النظام
// ============================================================

const POLLING_INTERVAL =
    30000;

let isRunning =
    false;

let timer =
    null;

let liveChatId =
    null;

let nextPageToken =
    null;

// ============================================================
// 6. عناصر الواجهة
// ============================================================

const elements = {

    messages:
        document.getElementById(
            "messages"
        ),

    status:
        document.getElementById(
            "status"
        ),

    videoId:
        document.getElementById(
            "video-id"
        ),

    liveChatId:
        document.getElementById(
            "live-chat-id"
        ),

    messageCount:
        document.getElementById(
            "message-count"
        ),

    error:
        document.getElementById(
            "error"
        )

};

// ============================================================
// 7. أدوات الواجهة
// ============================================================

function setStatus(
    text
) {

    if (
        elements.status
    ) {

        elements.status.textContent =
            text;

    }

    console.log(
        "[STATUS]",
        text
    );

}


function setError(
    error
) {

    const message =

        error instanceof Error

            ? error.message

            : String(error);


    if (
        elements.error
    ) {

        elements.error.textContent =
            message;

    }


    console.error(
        "[ERROR]",
        message
    );

}


function clearError() {

    if (
        elements.error
    ) {

        elements.error.textContent =
            "";

    }

}

// ============================================================
// 8. التحقق من VIDEO_ID
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
// 9. تحديث معلومات البث
// ============================================================

function updateStreamInfo(
    data
) {

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
// 10. إنشاء عنصر الرسالة
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
// 11. عرض الرسائل
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


    elements.messages.scrollTop =
        elements.messages.scrollHeight;

}

// ============================================================
// 12. قراءة الرسائل المؤرشفة من Supabase
// ============================================================

async function loadArchivedMessages() {

    clearError();


    const {
        data,
        error
    } =

        await supabaseClient

            .from(
                "archived_messages"
            )

            .select(
                "*"
            )

            .eq(
                "video_id",
                VIDEO_ID
            )

            .order(
                "created_at",
                {
                    ascending:
                        true
                }
            );


    if (
        error
    ) {

        throw new Error(

            "خطأ في قراءة الرسائل المؤرشفة: " +

            error.message

        );

    }


    if (
        data &&
        data.length > 0
    ) {

        renderMessages(
            data
        );

    }


    if (
        elements.messageCount
    ) {

        elements.messageCount.textContent =
            data?.length ??
            0;

    }


    return data ??
        [];

}

// ============================================================
// 13. حفظ رسالة في Supabase
// ============================================================

async function saveMessage(
    message
) {

    const {
        error
    } =

        await supabaseClient

            .from(
                "live_chat_messages"
            )

            .upsert(

                {

                    youtube_message_id:
                        message.youtube_message_id,

                    video_id:
                        VIDEO_ID,

                    author_name:
                        message.author_name,

                    message:
                        message.message

                },

                {

                    onConflict:
                        "youtube_message_id"

                }

            );


    if (
        error
    ) {

        throw new Error(

            "فشل حفظ الرسالة: " +

            error.message

        );

    }

}

// ============================================================
// 14. حفظ مجموعة رسائل
// ============================================================

async function saveMessages(
    messages
) {

    if (
        !messages ||
        messages.length ===
            0
    ) {

        return;

    }


    const rows =

        messages.map(
            message => ({

                youtube_message_id:
                    message.youtube_message_id,

                video_id:
                    VIDEO_ID,

                author_name:
                    message.author_name,

                message:
                    message.message

            })
        );


    const {
        error
    } =

        await supabaseClient

            .from(
                "live_chat_messages"
            )

            .upsert(

                rows,

                {

                    onConflict:
                        "youtube_message_id"

                }

            );


    if (
        error
    ) {

        throw new Error(

            "فشل حفظ الرسائل: " +

            error.message

        );

    }

}

// ============================================================
// 15. تحميل الرسائل الجديدة من الأرشيف
// ============================================================

async function loadNewArchivedMessages() {

    const {
        data,
        error
    } =

        await supabaseClient

            .from(
                "archived_messages"
            )

            .select(
                "*"
            )

            .eq(
                "video_id",
                VIDEO_ID
            )

            .order(
                "created_at",
                {
                    ascending:
                        true
                }
            );


    if (
        error
    ) {

        throw new Error(

            "خطأ في تحديث الأرشيف: " +

            error.message

        );

    }


    if (
        data &&
        data.length > 0
    ) {

        if (
            elements.messages
        ) {

            elements.messages.innerHTML =
                "";

        }


        renderMessages(
            data
        );

    }


    return data ??
        [];

}

// ============================================================
// 16. تشغيل النظام
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

        clearError();


        validateVideoId();


        setStatus(
            "جاري تحميل الرسائل..."
        );


        const messages =

            await loadArchivedMessages();


        if (
            elements.messageCount
        ) {

            elements.messageCount.textContent =
                messages.length;

        }


        setStatus(
            "تم تحميل الرسائل بنجاح"
        );


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
// 17. التشغيل الدوري
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
// 18. إيقاف التشغيل الدوري
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
// 19. بدء النظام
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
// 20. إيقاف النظام
// ============================================================

window.addEventListener(

    "beforeunload",

    () => {

        stopPolling();

    }

);

// ============================================================
// 21. تشغيل النظام
// ============================================================

startSystem();
// ============================================================
// 16. تشغيل النظام
// ============================================================

startSystem();
