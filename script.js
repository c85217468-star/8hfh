// =====================================
// إعدادات الموقع
// =====================================

const API_KEY = "AIzaSyCzX3_-OPo7oiDpBNmUS5mLBdzBBSFDsfc";

const VIDEO_URL =
    "https://www.youtube.com/live/WnN_epmXuls?si=sy8SdOinAIhss8n2";


// =====================================
// استخراج Video ID من رابط YouTube
// =====================================

function getVideoId(url) {

    try {

        const parsedUrl = new URL(url);

        if (parsedUrl.hostname.includes("youtu.be")) {
            return parsedUrl.pathname.substring(1);
        }

        return parsedUrl.searchParams.get("v");

    } catch (error) {

        console.error("رابط YouTube غير صالح");

        return null;
    }
}


// =====================================
// المتغيرات
// =====================================

let liveChatId = null;
let nextPageToken = null;
let polling = false;


// =====================================
// عناصر الصفحة
// =====================================

const chatElement =
    document.getElementById("chat");

const statusElement =
    document.getElementById("status");


// =====================================
// إضافة رسالة إلى الصفحة
// =====================================

function addMessage(author, message) {

    const messageElement =
        document.createElement("div");

    messageElement.className = "message";


    const authorElement =
        document.createElement("div");

    authorElement.className = "author";

    authorElement.textContent = author;


    const textElement =
        document.createElement("div");

    textElement.className = "text";

    textElement.textContent = message;


    messageElement.appendChild(authorElement);

    messageElement.appendChild(textElement);


    chatElement.appendChild(messageElement);


    // التمرير إلى آخر رسالة
    chatElement.scrollTop =
        chatElement.scrollHeight;
}


// =====================================
// الحصول على Live Chat ID
// =====================================

async function getLiveChatId(videoId) {

    const url =
        "https://www.googleapis.com/youtube/v3/videos" +
        "?part=liveStreamingDetails" +
        "&id=" + encodeURIComponent(videoId) +
        "&key=" + encodeURIComponent(API_KEY);


    const response =
        await fetch(url);


    const data =
        await response.json();


    if (data.error) {

        throw new Error(
            data.error.message ||
            "حدث خطأ في YouTube API"
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
        data.items[0].liveStreamingDetails;


    if (
        !liveDetails ||
        !liveDetails.activeLiveChatId
    ) {

        throw new Error(
            "هذا البث لا يحتوي على دردشة مباشرة نشطة"
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

        const response =
            await fetch(url);


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
            const item of data.items || []
        ) {

            const author =
                item.authorDetails
                ?.displayName ||
                "مستخدم";


            const message =
                item.snippet
                ?.displayMessage ||
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


        // استخدام pollIntervalMillis
        // الذي يرسله YouTube
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

        console.error(error);


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

        const videoId =
            getVideoId(VIDEO_URL);


        if (!videoId) {

            throw new Error(
                "تعذر استخراج Video ID من الرابط"
            );
        }


        statusElement.textContent =
            "جاري العثور على الدردشة...";


        liveChatId =
            await getLiveChatId(
                videoId
            );


        statusElement.textContent =
            "تم الاتصال بالدردشة";


        getChatMessages();


    } catch (error) {

        console.error(error);


        statusElement.textContent =
            "خطأ: " +
            error.message;
    }
}


start();