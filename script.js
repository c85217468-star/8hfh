// =====================================================
// SMART LIVE STREAM CLIENT
// =====================================================

// =====================================================
// 1) تحديد البث
// =====================================================

// ضع VIDEO_ID الخاص بالبث هنا فقط
const VIDEO_ID = "WnN_epmXuls";

// أو يمكنك وضع رابط YouTube هنا:
// const STREAM_URL = "https://www.youtube.com/watch?v=WnN_epmXuls";

// =====================================================
// 2) استخراج VIDEO_ID من رابط YouTube (اختياري)
// =====================================================

function getVideoId(input) {
    if (!input) {
        throw new Error("لم يتم تحديد رابط أو ID البث");
    }

    // إذا كان المستخدم وضع ID مباشرة
    if (!input.includes("youtube.com") &&
        !input.includes("youtu.be")) {
        return input.trim();
    }

    try {
        const url = new URL(input);

        // youtube.com/watch?v=VIDEO_ID
        if (url.searchParams.has("v")) {
            return url.searchParams.get("v");
        }

        // youtu.be/VIDEO_ID
        if (url.hostname === "youtu.be") {
            return url.pathname.substring(1);
        }

        throw new Error("رابط YouTube غير صالح");

    } catch (error) {
        throw new Error(
            "تعذر استخراج VIDEO_ID من الرابط"
        );
    }
}

// =====================================================
// 3) تحديد المصدر
// =====================================================

// الخيار الأول: ID مباشر
const CURRENT_VIDEO_ID = getVideoId(VIDEO_ID);

// الخيار الثاني إذا أردت استخدام الرابط:
// const CURRENT_VIDEO_ID = getVideoId(STREAM_URL);

// =====================================================
// 4) عرض معلومات البث
// =====================================================

console.log(
    "===================================="
);

console.log(
    "SMART LIVE STREAM"
);

console.log(
    "===================================="
);

console.log(
    "VIDEO ID:",
    CURRENT_VIDEO_ID
);

console.log(
    "YouTube URL:",
    `https://www.youtube.com/watch?v=${CURRENT_VIDEO_ID}`
);

// =====================================================
// 5) رابط YouTube API للحصول على بيانات البث
// =====================================================

// ضع مفتاح YouTube API في متغير البيئة
const YOUTUBE_API_KEY =
    "ضع_مفتاح_YouTube_API_هنا";

async function getLiveStreamInfo() {

    const url =
        "https://www.googleapis.com/youtube/v3/videos" +
        "?part=snippet,liveStreamingDetails" +
        "&id=" +
        encodeURIComponent(CURRENT_VIDEO_ID) +
        "&key=" +
        encodeURIComponent(YOUTUBE_API_KEY);

    const response =
        await fetch(url);

    const data =
        await response.json();

    if (data.error) {
        throw new Error(
            data.error.message
        );
    }

    if (!data.items || data.items.length === 0) {
        throw new Error(
            "لم يتم العثور على الفيديو"
        );
    }

    const video =
        data.items[0];

    const liveDetails =
        video.liveStreamingDetails;

    return {
        videoId: CURRENT_VIDEO_ID,

        title:
            video.snippet?.title ?? null,

        channelTitle:
            video.snippet?.channelTitle ?? null,

        liveChatId:
            liveDetails?.activeLiveChatId ?? null,

        scheduledStartTime:
            liveDetails?.scheduledStartTime ?? null,

        actualStartTime:
            liveDetails?.actualStartTime ?? null,

        actualEndTime:
            liveDetails?.actualEndTime ?? null
    };
}

// =====================================================
// 6) تشغيل الفحص
// =====================================================

async function start() {

    try {

        const stream =
            await getLiveStreamInfo();

        console.log(
            "Stream information:",
            stream
        );

        if (!stream.liveChatId) {

            console.log(
                "لا توجد Live Chat نشطة حاليًا."
            );

            return;
        }

        console.log(
            "Live Chat ID:",
            stream.liveChatId
        );

        console.log(
            "البث جاهز للمزامنة."
        );

    } catch (error) {

        console.error(
            "حدث خطأ:",
            error.message
        );

    }
}

// =====================================================
// 7) بدء البرنامج
// =====================================================

start();
