// ============================================================
// SMART LIVE CHAT SYSTEM
// script.js
// ============================================================
//
// الوظيفة:
//
// 1. VIDEO_ID يحدد البث الحالي.
// 2. Edge Function تجلب الرسائل الجديدة من YouTube.
// 3. الرسائل تحفظ في live_chat_messages.
// 4. Supabase Trigger ينسخها إلى archived_messages.
// 5. الموقع يعرض الرسائل من archived_messages.
// 6. حذف التعليق من YouTube لا يحذف النسخة المؤرشفة.
//
// ============================================================


// ============================================================
// 1. إعداد البث
// ============================================================

// غيّر هذا فقط عند الانتقال إلى بث آخر.
const VIDEO_ID = "WnN_epmXuls";


// ============================================================
// 2. Supabase
// ============================================================

const SUPABASE_URL =
    "https://urpwmgntrdzooemnvccx.supabase.co";


// ضع Publishable Key الخاص بمشروعك هنا.
const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_RxvIR8pqoTnrc1SSzBmbbQ_7691v21m";


// إنشاء عميل Supabase.
const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );


// ============================================================
// 3. Edge Function
// ============================================================
//
// هذه الوظيفة مسؤولة عن:
// - اكتشاف Live Chat ID
// - جلب رسائل YouTube
// - إدارة nextPageToken
// - حفظ الرسائل في Supabase
//
// ============================================================

const SYNC_FUNCTION_URL =
    `${SUPABASE_URL}/functions/v1/live-chat-sync`;


// ============================================================
// 4. إعدادات النظام
// ============================================================

const POLL_INTERVAL =
    15000;

const MAX_RETRIES =
    3;

const INITIAL_RETRY_DELAY =
    1000;


// ============================================================
// 5. حالة النظام
// ============================================================

let isSyncing =
    false;

let pollingTimer =
    null;

let currentLiveChatId =
    null;

let currentNextPageToken =
    null;

let systemStarted =
    false;


// ============================================================
// 6. عناصر الصفحة
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


function showError(
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
// 8. التحقق من الإعدادات
// ============================================================

function validateConfiguration() {

    if (
        !VIDEO_ID ||
        typeof VIDEO_ID !==
            "string"
    ) {

        throw new Error(
            "VIDEO_ID غير صالح."
        );

    }


    if (
        VIDEO_ID.length <
        5
    ) {

        throw new Error(
            "VIDEO_ID قصير أو غير صالح."
        );

    }


    if (
        !SUPABASE_URL
    ) {

        throw new Error(
            "SUPABASE_URL غير موجود."
        );

    }


    if (
        !SUPABASE_PUBLISHABLE_KEY ||
        SUPABASE_PUBLISHABLE_KEY.includes(
            "ضع_مفتاح"
        )
    ) {

        throw new Error(
            "يجب وضع Supabase Publishable Key."
        );

    }

}


// ============================================================
// 9. تحديث معلومات البث
// ============================================================

function updateStreamInfo(
    data = {}
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

            currentLiveChatId ??

            "غير متوفر";

    }

}


// ============================================================
// 10. إنشاء رسالة
// ============================================================

function createMessageElement(
    message
) {

    const container =
        document.createElement(
            "div"
        );


    container.className =
        "chat-message";


    const messageId =

        message.youtube_message_id ??

        message.id;


    if (
        messageId
    ) {

        container.dataset.messageId =
            messageId;

    }


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


    container.appendChild(
        author
    );


    container.appendChild(

        document.createTextNode(
            ": "
        )

    );


    container.appendChild(
        content
    );


    return container;

}


// ============================================================
// 11. التحقق من وجود الرسالة
// ============================================================

function messageAlreadyDisplayed(
    messageId
) {

    if (
        !elements.messages ||
        !messageId
    ) {

        return false;

    }


    const existing =

        elements.messages.querySelector(

            `[data-message-id="${CSS.escape(
                messageId
            )}"]`

        );


    return Boolean(
        existing
    );

}


// ============================================================
// 12. عرض رسالة واحدة
// ============================================================

function renderMessage(
    message
) {

    if (
        !elements.messages
    ) {

        return;

    }


    const messageId =

        message.youtube_message_id ??

        message.id;


    if (
        messageId &&
        messageAlreadyDisplayed(
            messageId
        )
    ) {

        return;

    }


    const element =

        createMessageElement(
            message
        );


    elements.messages.appendChild(
        element
    );


    elements.messages.scrollTop =

        elements.messages.scrollHeight;

}


// ============================================================
// 13. عرض مجموعة رسائل
// ============================================================

function renderMessages(
    messages
) {

    if (
        !Array.isArray(
            messages
        )
    ) {

        return;

    }


    for (
        const message
        of messages
    ) {

        renderMessage(
            message
        );

    }

}


// ============================================================
// 14. تحميل الأرشيف
// ============================================================
//
// الأرشيف هو المصدر الدائم للعرض.
// حتى لو اختفى التعليق من YouTube,
// يبقى موجودًا هنا.
//
// ============================================================

async function loadArchive() {

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
                "archived_at",
                {
                    ascending:
                        true
                }
            );


    if (
        error
    ) {

        throw new Error(

            "فشل تحميل الأرشيف: " +

            error.message

        );

    }


    if (
        elements.messages
    ) {

        elements.messages.innerHTML =
            "";

    }


    renderMessages(
        data ?? []
    );


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
// 15. طلب المزامنة
// ============================================================
//
// لا نرسل الرسائل مباشرة من JavaScript.
// Edge Function هي المسؤولة عن المزامنة.
// ============================================================

async function requestSync() {

    const response =

        await fetch(

            SYNC_FUNCTION_URL,

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
                            VIDEO_ID,

                        live_chat_id:
                            currentLiveChatId,

                        next_page_token:
                            currentNextPageToken

                    })

            }

        );


    let data;


    try {

        data =
            await response.json();

    } catch {

        throw new Error(
            "استجابة غير صالحة من Edge Function."
        );

    }


    if (
        !response.ok
    ) {

        throw new Error(

            data?.message ??

            data?.error ??

            `HTTP ${response.status}`

        );

    }


    if (
        data.success ===
        false
    ) {

        throw new Error(

            data.message ??

            data.error ??

            "فشل تنفيذ المزامنة."

        );

    }


    return data;

}


// ============================================================
// 16. مزامنة الأرشيف بعد جلب الرسائل
// ============================================================

async function refreshArchive() {

    const messages =
        await loadArchive();


    if (
        elements.messageCount
    ) {

        elements.messageCount.textContent =

            messages.length;

    }

}


// ============================================================
// 17. إعادة المحاولة
// ============================================================

async function withRetry(
    operation
) {

    let lastError;


    for (
        let attempt = 1;

        attempt <= MAX_RETRIES;

        attempt++
    ) {

        try {

            return await operation();

        } catch (
            error
        ) {

            lastError =
                error;


            console.warn(

                `[RETRY] ${attempt}/${MAX_RETRIES}`,

                error

            );


            if (
                attempt ===
                MAX_RETRIES
            ) {

                break;

            }


            const delay =

                INITIAL_RETRY_DELAY *

                Math.pow(
                    2,
                    attempt - 1
                );


            await new Promise(

                resolve =>

                    setTimeout(

                        resolve,

                        delay

                    )

            );

        }

    }


    throw lastError;

}


// ============================================================
// 18. دورة المزامنة
// ============================================================

async function syncOnce() {

    if (
        isSyncing
    ) {

        return;

    }


    isSyncing =
        true;


    try {

        clearError();


        setStatus(
            "جاري مزامنة البث..."
        );


        const result =

            await withRetry(

                () =>

                    requestSync()

            );


        currentLiveChatId =

            result.live_chat_id ??

            currentLiveChatId;


        currentNextPageToken =

            result.next_page_token ??

            currentNextPageToken;


        updateStreamInfo({

            video_id:
                VIDEO_ID,

            live_chat_id:
                currentLiveChatId

        });


        const newMessages =

            Array.isArray(
                result.messages
            )

                ? result.messages

                : [];


        if (
            newMessages.length >
            0
        ) {

            renderMessages(
                newMessages
            );


            setStatus(

                `تم استقبال ${newMessages.length} رسالة جديدة`

            );

        } else {

            setStatus(
                "النظام يعمل — لا توجد رسائل جديدة"
            );

        }


    } catch (
        error
    ) {

        showError(
            error
        );


        setStatus(
            "حدث خطأ أثناء المزامنة"
        );

    } finally {

        isSyncing =
            false;

    }

}


// ============================================================
// 19. بدء المزامنة الدورية
// ============================================================

function startPolling() {

    stopPolling();


    pollingTimer =

        setInterval(

            () => {

                syncOnce();

            },

            POLL_INTERVAL

        );


    console.log(
        "[SYSTEM] Polling started"
    );

}


// ============================================================
// 20. إيقاف المزامنة
// ============================================================

function stopPolling() {

    if (
        pollingTimer
    ) {

        clearInterval(
            pollingTimer
        );


        pollingTimer =
            null;

    }


    console.log(
        "[SYSTEM] Polling stopped"
    );

}


// ============================================================
// 21. بدء النظام
// ============================================================

async function startSystem() {

    if (
        systemStarted
    ) {

        return;

    }


    systemStarted =
        true;


    try {

        validateConfiguration();


        updateStreamInfo({

            video_id:
                VIDEO_ID

        });


        setStatus(
            "جاري تحميل الأرشيف..."
        );


        await loadArchive();


        await syncOnce();


        startPolling();


        console.log(
            "[SYSTEM] Started successfully"
        );


    } catch (
        error
    ) {

        showError(
            error
        );


        setStatus(
            "فشل تشغيل النظام"
        );


        systemStarted =
            false;

    }

}


// ============================================================
// 22. تنظيف النظام
// ============================================================

window.addEventListener(

    "beforeunload",

    () => {

        stopPolling();

    }

);


// ============================================================
// 23. تشغيل
// ============================================================

startSystem();
