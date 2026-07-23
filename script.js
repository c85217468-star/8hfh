// =====================================
// إعدادات الموقع
// =====================================

const API_KEY = "AIzaSyCzX3_-OPo7oiDpBNmUS5mLBdzBBSFDsfc";

const VIDEO_ID = "WnN_epmXuls";


// =====================================
// المتغيرات
// =====================================

let liveChatId = null;
let nextPageToken = null;


// =====================================
// عناصر الصفحة
// =====================================

const chatElement = document.getElementById("chat");
const statusElement = document.getElementById("status");


// =====================================
// إضافة رسالة إلى الصفحة
// =====================================

function addMessage(author, message) {

    const messageElement = document.createElement("div");
    messageElement.className = "message";

    const authorElement = document.createElement("div");
    authorElement.className = "author";
    authorElement.textContent = author;

    const textElement = document.createElement("div");
    textElement.className = "text";
    textElement.textContent = message;

    messageElement.appendChild(authorElement);
    messageElement.appendChild(textElement);

    chatElement.appendChild(messageElement);

    // التمرير إلى آخر رسالة
    chatElement.scrollTop = chatElement.scrollHeight;
}


// =====================================
// الحصول على Live Chat ID
// =====================================

async function getLiveChatId() {

    const url =
        "https://www.googleapis.com/youtube/v3/videos" +
        "?part=liveStreamingDetails" +
        "&id=" + encodeURIComponent(VIDEO_ID) +
        "&key=" + encodeURIComponent(API_KEY);

    const response = await fetch(url);

    const data = await response.json();

    if (data.error) {
        throw new Error(
            data.error.message ||
            "حدث خطأ في YouTube API"
        );
    }

    if (!data.items || data.items.length === 0) {
        throw new Error(
            "لم يتم العثور على الفيديو"
        );
    }

    const liveDetails =
        data.items[0].liveStreamingDetails;

    if (!liveDetails) {
        throw new Error(
            "هذا الفيديو ليس بثًا مباشرًا"
        );
    }

    if (!liveDetails.activeLiveChatId) {
        throw new Error(
            "لا توجد دردشة مباشرة نشطة لهذا البث"
        );
    }

    return liveDetails.activeLiveChatId;
}


// =====================================
// جلب رسائل الدردشة
// =====================================

async function getChatMessages() {

    if (!liveChatId) {
        return;
    }

    let url =
        "https://www.googleapis.com/youtube/v3/liveChat/messages" +
        "?liveChatId=" +
        encodeURIComponent(liveChatId) +
        "&part=snippet,authorDetails" +
        "&maxResults=200" +
        "&key=" +
        encodeURIComponent(API_KEY);

    if (nextPageToken) {

        url +=
            "&pageToken=" +
            encodeURIComponent(nextPageToken);
    }

    try {

        const response = await fetch(url);

        const data = await response.json();

        if (data.error) {
            throw new Error(
                data.error.message ||
                "حدث خطأ أثناء جلب الرسائل"
            );
        }

        nextPageToken =
            data.nextPageToken || null;

        // عرض الرسائل الجديدة
        for (const item of data.items || []) {

            const author =
                item.authorDetails?.displayName ||
                "مستخدم";

            const message =
                item.snippet?.displayMessage ||
                "";

            if (message) {

                addMessage(
                    author,
                    message
                );
            }
        }

        statusElement.textContent =
            "متصل — يتم استقبال الرسائل مباشرة";

        // الوقت الذي تقترحه YouTube API
        const delay =
            Math.max(
                data.pollingIntervalMillis || 5000,
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
            "حدث خطأ: " +
            error.message;

        // إعادة المحاولة
        setTimeout(
            getChatMessages,
            5000
        );
    }
}


// =====================================
// تشغيل الموقع
// =====================================

async function start() {

    try {

        statusElement.textContent =
            "جاري الاتصال بالبث...";

        // الحصول على Live Chat ID
        liveChatId =
            await getLiveChatId();

        statusElement.textContent =
            "تم الاتصال — جاري استقبال الرسائل...";

        // بدء استقبال الرسائل
        getChatMessages();

    } catch (error) {

        console.error(
            "Start Error:",
            error
        );

        statusElement.textContent =
            "خطأ: " +
            error.message;
    }
}


// =====================================
// بدء التشغيل
// =====================================

start();
