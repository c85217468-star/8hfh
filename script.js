// =====================================================
// إعدادات YouTube
// =====================================================

// ضع مفتاح YouTube API الجديد هنا
const YOUTUBE_API_KEY =
    "AIzaSyCzX3_-OPo7oiDpBNmUS5mLBdzBBSFDsfc";


const VIDEO_ID =
    "WnN_epmXuls";


// =====================================================
// إعدادات Supabase
// =====================================================

const SUPABASE_URL =
    "https://urpwmgntrdzooemnvccx.supabase.co";


const SUPABASE_KEY =
    "sb_publishable_RxvIR8pqoTnrc1SSzBmbbQ_7691v21m";


// =====================================================
// إنشاء اتصال Supabase
// =====================================================

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


// =====================================================
// عناصر الصفحة
// =====================================================

const livePage =
    document.getElementById(
        "livePage"
    );


const archivePage =
    document.getElementById(
        "archivePage"
    );


const liveChatElement =
    document.getElementById(
        "liveChat"
    );


const archiveChatElement =
    document.getElementById(
        "archiveChat"
    );


const statusElement =
    document.getElementById(
        "status"
    );


const archiveCountElement =
    document.getElementById(
        "archiveCount"
    );


const openArchiveButton =
    document.getElementById(
        "openArchiveButton"
    );


const backToLiveButton =
    document.getElementById(
        "backToLiveButton"
    );


// =====================================================
// متغيرات النظام
// =====================================================

let liveChatId = null;

let nextPageToken = null;

let archiveCount = 0;


// =====================================================
// منع تكرار رسائل الأرشيف
// =====================================================

const displayedArchiveMessages =
    new Set();


// =====================================================
// منع تكرار رسائل البث
// =====================================================

const displayedLiveMessages =
    new Set();


// =====================================================
// إنشاء عنصر رسالة
// =====================================================

function createMessageElement(
    author,
    message
) {

    const messageElement =
        document.createElement(
            "div"
        );


    messageElement.className =
        "message";


    const authorElement =
        document.createElement(
            "div"
        );


    authorElement.className =
        "author";


    authorElement.textContent =
        author;


    const textElement =
        document.createElement(
            "div"
        );


    textElement.className =
        "text";


    textElement.textContent =
        message;


    messageElement.appendChild(
        authorElement
    );


    messageElement.appendChild(
        textElement
    );


    return messageElement;

}


// =====================================================
// إضافة رسالة للبث المباشر
// =====================================================

function addLiveMessage(
    messageId,
    author,
    message
) {

    if (
        displayedLiveMessages.has(
            messageId
        )
    ) {

        return;

    }


    displayedLiveMessages.add(
        messageId
    );


    const element =
        createMessageElement(
            author,
            message
        );


    liveChatElement.appendChild(
        element
    );


    liveChatElement.scrollTop =
        liveChatElement.scrollHeight;

}


// =====================================================
// إضافة رسالة للأرشيف
// =====================================================

function addArchiveMessage(
    messageId,
    author,
    message
) {

    if (
        displayedArchiveMessages.has(
            messageId
        )
    ) {

        return;

    }


    displayedArchiveMessages.add(
        messageId
    );


    const element =
        createMessageElement(
            author,
            message
        );


    archiveChatElement.appendChild(
        element
    );


    archiveCount++;


    archiveCountElement.textContent =
        archiveCount +
        " رسالة";

}


// =====================================================
// حفظ مجموعة رسائل في Supabase
// =====================================================

async function saveMessagesToSupabase(
    messages
) {

    if (
        !messages.length
    ) {

        return true;

    }


    const rows =
        messages.map(
            item => ({

                youtube_message_id:
                    item.id,

                author_name:
                    item.authorDetails
                        ?.displayName ||
                    "مستخدم",

                message:
                    item.snippet
                        ?.displayMessage ||
                    "",

                video_id:
                    VIDEO_ID

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
                        "youtube_message_id",

                    ignoreDuplicates:
                        true

                }

            );


    if (error) {

        console.error(
            "Supabase Error:",
            error
        );


        return false;

    }


    return true;

}


// =====================================================
// تحميل الأرشيف القديم
// =====================================================

async function loadArchive() {

    try {

        const {
            data,
            error
        } =
            await supabaseClient

                .from(
                    "live_chat_messages"
                )

                .select(
                    "youtube_message_id, author_name, message, created_at"
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


        if (error) {

            console.error(
                "Archive Error:",
                error
            );


            return;

        }


        for (
            const item
            of data || []
        ) {

            addArchiveMessage(

                item.youtube_message_id,

                item.author_name,

                item.message

            );

        }


    } catch (error) {

        console.error(
            "Archive Load Error:",
            error
        );

    }

}


// =====================================================
// تشغيل Supabase Realtime
// =====================================================

function subscribeToArchive() {

    supabaseClient

        .channel(
            "live-chat-archive"
        )

        .on(

            "postgres_changes",

            {

                event:
                    "INSERT",

                schema:
                    "public",

                table:
                    "live_chat_messages",

                filter:
                    `video_id=eq.${VIDEO_ID}`

            },

            payload => {

                const message =
                    payload.new;


                addArchiveMessage(

                    message.youtube_message_id,

                    message.author_name,

                    message.message

                );

            }

        )

        .subscribe(

            status => {

                console.log(
                    "Realtime:",
                    status
                );

            }

        );

}


// =====================================================
// الحصول على Live Chat ID
// =====================================================

async function getLiveChatId() {

    const url =

        "https://www.googleapis.com/youtube/v3/videos" +

        "?part=liveStreamingDetails" +

        "&id=" +
        encodeURIComponent(
            VIDEO_ID
        ) +

        "&key=" +
        encodeURIComponent(
            YOUTUBE_API_KEY
        );


    const response =
        await fetch(
            url
        );


    const data =
        await response.json();


    if (
        data.error
    ) {

        throw new Error(
            data.error.message
        );

    }


    if (
        !data.items ||
        data.items.length === 0
    ) {

        throw new Error(
            "لم يتم العثور على البث"
        );

    }


    const liveDetails =
        data.items[0]
            .liveStreamingDetails;


    if (
        !liveDetails ||
        !liveDetails.activeLiveChatId
    ) {

        throw new Error(
            "لا توجد دردشة مباشرة نشطة"
        );

    }


    return liveDetails.activeLiveChatId;

}


// =====================================================
// جلب رسائل YouTube
// =====================================================

async function getChatMessages() {

    if (
        !liveChatId
    ) {

        return;

    }


    let url =

        "https://www.googleapis.com/youtube/v3/liveChat/messages" +

        "?liveChatId=" +
        encodeURIComponent(
            liveChatId
        ) +

        "&part=snippet,authorDetails" +

        "&maxResults=200" +

        "&key=" +
        encodeURIComponent(
            YOUTUBE_API_KEY
        );


    if (
        nextPageToken
    ) {

        url +=

            "&pageToken=" +

            encodeURIComponent(
                nextPageToken
            );

    }


    try {

        const response =
            await fetch(
                url
            );


        const data =
            await response.json();


        if (
            data.error
        ) {

            throw new Error(
                data.error.message
            );

        }


        nextPageToken =

            data.nextPageToken ||
            null;


        const messages =
            data.items || [];


        const validMessages =

            messages.filter(

                item =>

                    item.snippet
                        ?.displayMessage

            );


        // =========================================
        // عرض الرسائل مباشرة في البث
        // =========================================

        for (
            const item
            of validMessages
        ) {

            const author =

                item.authorDetails
                    ?.displayName ||

                "مستخدم";


            const message =

                item.snippet
                    ?.displayMessage ||

                "";


            addLiveMessage(

                item.id,

                author,

                message

            );

        }


        // =========================================
        // حفظ الرسائل في Supabase
        // =========================================

        await saveMessagesToSupabase(

            validMessages

        );


        // =========================================
        // الانتظار حسب تعليمات YouTube
        // =========================================

        const delay =

            Math.max(

                data.pollingIntervalMillis ||
                    5000,

                1000

            );


        setTimeout(

            getChatMessages,

            delay

        );


    } catch (error) {

        console.error(

            "Chat Error:",

            error

        );


        statusElement.textContent =

            "تعذر الاتصال";


        setTimeout(

            getChatMessages,

            3000

        );

    }

}


// =====================================================
// فتح صفحة الأرشيف
// =====================================================

openArchiveButton.addEventListener(

    "click",

    function () {

        livePage.classList.remove(
            "active"
        );


        archivePage.classList.add(
            "active"
        );

    }

);


// =====================================================
// العودة إلى البث
// =====================================================

backToLiveButton.addEventListener(

    "click",

    function () {

        archivePage.classList.remove(
            "active"
        );


        livePage.classList.add(
            "active"
        );

    }

);


// =====================================================
// تشغيل التطبيق
// =====================================================

async function start() {

    try {

        // تحميل الأرشيف القديم

        await loadArchive();


        // تشغيل Realtime

        subscribeToArchive();


        // الحصول على البث

        liveChatId =

            await getLiveChatId();


        statusElement.textContent =

            "متصل";


        // بدء جلب الرسائل

        getChatMessages();


    } catch (error) {

        console.error(

            "Start Error:",

            error

        );


        statusElement.textContent =

            error.message;

    }

}


// =====================================================
// بدء التطبيق
// =====================================================

start();
