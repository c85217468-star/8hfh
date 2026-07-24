// ============================================================
// LIVE CHAT -> SUPABASE -> ARCHIVE
// script.js
// ============================================================

// ============================================================
// 1. إعداداتك فقط
// ============================================================

// ID البث الحالي
const VIDEO_ID = "WnN_epmXuls";

// YouTube Data API Key
const YOUTUBE_API_KEY = "AIzaSyCzX3_-OPo7oiDpBNmUS5mLBdzBBSFDsfc";

// Supabase Publishable Key
const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_RxvIR8pqoTnrc1SSzBmbbQ_7691v21m";

// رابط مشروع Supabase
const SUPABASE_URL =
    "https://urpwmgntrdzooemnvccx.supabase.co";


// ============================================================
// 2. إعدادات النظام
// ============================================================

const POLL_INTERVAL = 15000;

let liveChatId = null;

let nextPageToken = null;

let pollingTimer = null;

let isFetching = false;


// ============================================================
// 3. إنشاء Supabase Client
// ============================================================

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );


// ============================================================
// 4. عناصر الصفحة
// ============================================================

const messagesContainer =
    document.getElementById("messages");

const statusElement =
    document.getElementById("status");

const errorElement =
    document.getElementById("error");

const videoIdElement =
    document.getElementById("video-id");

const liveChatIdElement =
    document.getElementById("live-chat-id");

const messageCountElement =
    document.getElementById("message-count");


// ============================================================
// 5. أدوات الواجهة
// ============================================================

function setStatus(message) {

    if (statusElement) {
        statusElement.textContent =
            message;
    }

    console.log(
        "[STATUS]",
        message
    );
}


function setError(error) {

    const message =
        error instanceof Error
            ? error.message
            : String(error);

    if (errorElement) {
        errorElement.textContent =
            message;
    }

    console.error(
        "[ERROR]",
        message
    );
}


function clearError() {

    if (errorElement) {
        errorElement.textContent =
            "";
    }

}


// ============================================================
// 6. التحقق من الإعدادات
// ============================================================

function validateConfig() {

    if (!VIDEO_ID) {

        throw new Error(
            "VIDEO_ID غير موجود."
        );

    }

    if (
        !YOUTUBE_API_KEY ||
        YOUTUBE_API_KEY.includes(
            "ضع_"
        )
    ) {

        throw new Error(
            "ضع YouTube API Key."
        );

    }

    if (
        !SUPABASE_PUBLISHABLE_KEY ||
        SUPABASE_PUBLISHABLE_KEY.includes(
            "ضع_"
        )
    ) {

        throw new Error(
            "ضع Supabase Publishable Key."
        );

    }

}


// ============================================================
// 7. الاتصال بـ YouTube API
// ============================================================

async function youtubeRequest(
    endpoint,
    params
) {

    const url = new URL(

        `https://www.googleapis.com/youtube/v3/${endpoint}`

    );


    for (
        const [key, value]
        of Object.entries(params)
    ) {

        if (
            value !== undefined &&
            value !== null
        ) {

            url.searchParams.set(
                key,
                value
            );

        }

    }


    url.searchParams.set(
        "key",
        YOUTUBE_API_KEY
    );


    const response =
        await fetch(
            url.toString()
        );


    let data;

    try {

        data =
            await response.json();

    } catch {

        throw new Error(
            "YouTube أرسل استجابة غير صالحة."
        );

    }


    if (!response.ok) {

        const message =

            data?.error?.message ??

            `YouTube API HTTP ${response.status}`;


        throw new Error(
            message
        );

    }


    return data;

}


// ============================================================
// 8. الحصول على Live Chat ID
// ============================================================

async function getLiveChatId() {

    const data =

        await youtubeRequest(

            "videos",

            {

                part:
                    "liveStreamingDetails",

                id:
                    VIDEO_ID

            }

        );


    const video =
        data?.items?.[0];


    if (!video) {

        throw new Error(
            "لم يتم العثور على البث."
        );

    }


    const details =
        video.liveStreamingDetails;


    if (!details) {

        throw new Error(
            "الفيديو ليس بثًا مباشرًا."
        );

    }


    if (
        !details.activeLiveChatId
    ) {

        throw new Error(
            "لا يوجد Live Chat نشط لهذا البث."
        );

    }


    liveChatId =
        details.activeLiveChatId;


    if (liveChatIdElement) {

        liveChatIdElement.textContent =
            liveChatId;

    }


    return liveChatId;

}


// ============================================================
// 9. جلب الرسائل الجديدة
// ============================================================

async function fetchLiveMessages() {

    if (!liveChatId) {

        await getLiveChatId();

    }


    const params = {

        liveChatId:
            liveChatId,

        part:
            "snippet,authorDetails",

        maxResults:
            200

    };


    if (nextPageToken) {

        params.pageToken =
            nextPageToken;

    }


    const data =

        await youtubeRequest(

            "liveChat/messages",

            params

        );


    nextPageToken =

        data.nextPageToken ??
        nextPageToken;


    return data.items ?? [];

}


// ============================================================
// 10. تحويل رسالة YouTube
// ============================================================

function normalizeMessage(
    item
) {

    return {

        youtube_message_id:
            item.id,

        video_id:
            VIDEO_ID,

        author_name:

            item.authorDetails
                ?.displayName ??

            "مستخدم",

        message:

            item.snippet
                ?.displayMessage ??

            "",

        message_created_at:

            item.snippet
                ?.publishedAt ??

            new Date().toISOString()

    };

}


// ============================================================
// 11. إرسال الرسائل إلى Supabase
// ============================================================

async function saveMessages(
    messages
) {

    if (
        !messages.length
    ) {

        return;

    }


    const rows =

        messages

            .map(
                normalizeMessage
            )

            .filter(

                message =>

                    message.youtube_message_id &&

                    message.message

            );


    if (
        !rows.length
    ) {

        return;

    }


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
                        "youtube_message_id",

                    ignoreDuplicates:
                        true

                }

            );


    if (error) {

        throw new Error(

            "فشل حفظ الرسائل في Supabase: " +

            error.message

        );

    }


    return rows;

}


// ============================================================
// 12. التحقق من عدم تكرار الرسالة في الشاشة
// ============================================================

function isMessageDisplayed(
    messageId
) {

    if (
        !messagesContainer ||
        !messageId
    ) {

        return false;

    }


    return Boolean(

        messagesContainer.querySelector(

            `[data-message-id="${CSS.escape(
                messageId
            )}"]`

        )

    );

}


// ============================================================
// 13. عرض الرسالة
// ============================================================

function renderMessage(
    message
) {

    if (
        !messagesContainer
    ) {

        return;

    }


    if (

        isMessageDisplayed(

            message.youtube_message_id

        )

    ) {

        return;

    }


    const wrapper =

        document.createElement(
            "div"
        );


    wrapper.className =
        "chat-message";


    wrapper.dataset.messageId =

        message.youtube_message_id;


    const author =

        document.createElement(
            "strong"
        );


    author.className =
        "chat-author";


    author.textContent =

        message.author_name ??
        "مستخدم";


    const text =

        document.createElement(
            "span"
        );


    text.className =
        "chat-content";


    text.textContent =

        `: ${message.message ?? ""}`;


    wrapper.appendChild(
        author
    );


    wrapper.appendChild(
        text
    );


    messagesContainer.appendChild(
        wrapper
    );


    messagesContainer.scrollTop =

        messagesContainer.scrollHeight;

}


// ============================================================
// 14. عرض مجموعة رسائل
// ============================================================

function renderMessages(
    messages
) {

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
// 15. مزامنة واحدة
// ============================================================

async function syncLiveChat() {

    if (isFetching) {

        return;

    }


    isFetching =
        true;


    try {

        clearError();


        setStatus(
            "جاري جلب رسائل البث..."
        );


        const items =

            await fetchLiveMessages();


        if (
            !items.length
        ) {

            setStatus(
                "النظام يعمل — لا توجد رسائل جديدة."
            );

            return;

        }


        const messages =

            items.map(

                normalizeMessage

            );


        // عرض فوري
        renderMessages(
            messages
        );


        // حفظ في Supabase
        await saveMessages(
            messages
        );


        if (
            messageCountElement
        ) {

            const current =

                messagesContainer
                    ?.children
                    ?.length ?? 0;


            messageCountElement.textContent =

                current;

        }


        setStatus(

            `تم استقبال وحفظ ${messages.length} رسالة`

        );


    } catch (
        error
    ) {

        setError(
            error
        );


        setStatus(
            "حدث خطأ أثناء المزامنة."
        );


        // إعادة اكتشاف Live Chat
        // في المزامنة التالية
        liveChatId =
            null;


    } finally {

        isFetching =
            false;

    }

}


// ============================================================
// 16. بدء النظام
// ============================================================

async function startSystem() {

    try {

        validateConfig();


        if (
            videoIdElement
        ) {

            videoIdElement.textContent =
                VIDEO_ID;

        }


        setStatus(
            "جاري الاتصال بالبث..."
        );


        await getLiveChatId();


        await syncLiveChat();


        pollingTimer =

            setInterval(

                syncLiveChat,

                POLL_INTERVAL

            );


        setStatus(
            "النظام يعمل بنجاح."
        );


    } catch (
        error
    ) {

        setError(
            error
        );


        setStatus(
            "فشل تشغيل النظام."
        );

    }

}


// ============================================================
// 17. تنظيف
// ============================================================

window.addEventListener(

    "beforeunload",

    () => {

        if (
            pollingTimer
        ) {

            clearInterval(
                pollingTimer
            );

        }

    }

);


// ============================================================
// 18. تشغيل
// ============================================================

startSystem();
