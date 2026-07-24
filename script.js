// =====================================================
// إعدادات YouTube
// =====================================================

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

const liveChatElement =
    document.getElementById("liveChat");

const archiveChatElement =
    document.getElementById("archiveChat");

const statusElement =
    document.getElementById("status");

const archiveCountElement =
    document.getElementById("archiveCount");


// =====================================================
// المتغيرات
// =====================================================

let liveChatId = null;

let nextPageToken = null;

let archiveCount = 0;


// منع تكرار الرسائل في الأرشيف
const displayedArchiveMessages =
    new Set();


// =====================================================
// إنشاء عنصر الرسالة
// =====================================================

function createMessageElement(
    author,
    message
) {

    const messageElement =
        document.createElement("div");

    messageElement.className =
        "message";


    const authorElement =
        document.createElement("div");

    authorElement.className =
        "author";

    authorElement.textContent =
        author;


    const textElement =
        document.createElement("div");

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
    author,
    message
) {

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

    // منع التكرار
    if (
        displayedArchiveMessages
            .has(messageId)
    ) {

        return;
    }


    displayedArchiveMessages
        .add(messageId);


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
// حفظ الرسالة في Supabase
// =====================================================

async function saveMessageToSupabase(
    youtubeMessageId,
    author,
    message
) {

    try {

        console.log(
            "جاري حفظ الرسالة:",
            youtubeMessageId
        );


        const {
            data,
            error
        } =
            await supabaseClient
                .from(
                    "live_chat_messages"
                )
                .upsert(

                    {
                        youtube_message_id:
                            youtubeMessageId,

                        author_name:
                            author,

                        message:
                            message,

                        video_id:
                            VIDEO_ID
                    },

                    {
                        onConflict:
                            "youtube_message_id"
                    }
                );


        if (error) {

            console.error(
                "Supabase Error:",
                error
            );


            return false;
        }


        console.log(
            "تم حفظ الرسالة بنجاح"
        );


        return true;


    } catch (error) {

        console.error(
            "Supabase Connection Error:",
            error
        );


        return false;
    }
}


// =====================================================
// تحميل الأرشيف من Supabase
// =====================================================

async function loadArchive() {

    try {

        console.log(
            "جاري تحميل الأرشيف..."
        );


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
            const item of
            data || []
        ) {

            addArchiveMessage(

                item.youtube_message_id,

                item.author_name,

                item.message

            );
        }


        console.log(
            "تم تحميل الأرشيف:",
            data.length,
            "رسالة"
        );


    } catch (error) {

        console.error(
            "Archive Connection Error:",
            error
        );
    }
}


// =====================================================
// Supabase Realtime
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

                console.log(
                    "رسالة جديدة من Supabase:",
                    payload.new
                );


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
                    "Supabase Realtime:",
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


    if (data.error) {

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

    if (!liveChatId) {

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


    if (nextPageToken) {

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


        if (data.error) {

            throw new Error(
                data.error.message
            );
        }


        nextPageToken =

            data.nextPageToken ||
            null;


        for (
            const item of
            data.items || []
        ) {

            const author =

                item.authorDetails
                    ?.displayName ||

                "مستخدم";


            const message =

                item.snippet
                    ?.displayMessage ||

                "";


            if (!message) {

                continue;
            }


            // =================================
            // حفظ الرسالة أولًا
            // =================================

            const saved =

                await saveMessageToSupabase(

                    item.id,

                    author,

                    message

                );


            // =================================
            // بعد نجاح الحفظ
            // عرض الرسالة في البث
            // =================================

            if (saved) {

                addLiveMessage(

                    author,

                    message

                );
            }
        }


        statusElement.textContent =

            "يتم استقبال الرسائل";


        const delay =

            Math.max(

                data.pollingIntervalMillis ||
                    5000,

                2000

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

            5000

        );
    }
}


// =====================================================
// تشغيل التطبيق
// =====================================================

async function start() {

    try {

        // تحميل الأرشيف
        await loadArchive();


        // تشغيل Realtime
        subscribeToArchive();


        // الحصول على Live Chat ID
        liveChatId =

            await getLiveChatId();


        statusElement.textContent =

            "متصل";


        // بدء قراءة الرسائل
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
