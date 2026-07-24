```javascript
// ============================================================
// SMART LIVE CHAT SYSTEM
// script.js
// ============================================================
//
// Flow:
//
// YouTube Live Chat
//       ↓
// Fetcher / Supabase Edge Function
//       ↓
// script.js
//       ↓
// live_chat_messages
//       ↓
// Supabase Trigger
//       ↓
// archived_messages
//       ↓
// Website
//
// IMPORTANT:
// - Change VIDEO_ID only when changing the live stream.
// - Do NOT put the YouTube API secret key in this file.
// - Do NOT put the Supabase Service Role Key in this file.
// - Use only the Supabase Publishable Key in frontend code.
// ============================================================


// ============================================================
// 1. LIVE STREAM CONFIGURATION
// ============================================================

// Change ONLY this when switching to another live stream.
const VIDEO_ID = "WnN_epmXuls";


// ============================================================
// 2. SUPABASE CONFIGURATION
// ============================================================

const SUPABASE_URL =
    "https://urpwmgntrdzooemnvccx.supabase.co";


// Put your Supabase Publishable Key here.
const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_RxvIR8pqoTnrc1SSzBmbbQ_7691v21m";


// Create Supabase client.
const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );


// ============================================================
// 3. DATA FETCHER
// ============================================================
//
// This endpoint should return new YouTube live chat messages.
//
// Expected response:
//
// {
//     "success": true,
//     "video_id": "...",
//     "live_chat_id": "...",
//     "next_page_token": "...",
//     "messages": [
//         {
//             "youtube_message_id": "...",
//             "author_name": "...",
//             "message": "...",
//             "created_at": "..."
//         }
//     ]
// }
//
// IMPORTANT:
// The Edge Function should securely communicate with YouTube API.
// Do not expose the YouTube API key in this frontend file.
// ============================================================

const CHAT_FETCHER_URL =
    `${SUPABASE_URL}/functions/v1/live-chat-fetcher`;


// ============================================================
// 4. SYSTEM SETTINGS
// ============================================================

const POLLING_INTERVAL =
    30000;

const MAX_RETRIES =
    3;

const RETRY_DELAY =
    2000;


// ============================================================
// 5. SYSTEM STATE
// ============================================================

let isRunning =
    false;

let timer =
    null;

let retryCount =
    0;

let liveChatId =
    null;

let nextPageToken =
    null;

let totalMessages =
    0;


// ============================================================
// 6. DOM ELEMENTS
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
// 7. UI HELPERS
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
// 8. VALIDATE CONFIGURATION
// ============================================================

function validateConfiguration() {

    if (
        !VIDEO_ID ||
        typeof VIDEO_ID !==
            "string"
    ) {

        throw new Error(
            "VIDEO_ID غير موجود."
        );

    }


    if (
        VIDEO_ID.length <
        5
    ) {

        throw new Error(
            "VIDEO_ID غير صالح."
        );

    }


    if (
        !SUPABASE_URL
    ) {

        throw new Error(
            "Supabase URL غير موجود."
        );

    }


    if (
        !SUPABASE_PUBLISHABLE_KEY ||
        SUPABASE_PUBLISHABLE_KEY.includes(
            "ضع_مفتاح"
        )
    ) {

        throw new Error(
            "ضع Supabase Publishable Key الصحيح."
        );

    }

}


// ============================================================
// 9. UPDATE STREAM INFORMATION
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
            liveChatId ??
            "غير متوفر";

    }


    if (
        elements.messageCount
    ) {

        elements.messageCount.textContent =
            totalMessages;

    }

}


// ============================================================
// 10. NORMALIZE MESSAGE
// ============================================================

function normalizeMessage(
    message
) {

    return {

        youtube_message_id:

            message.youtube_message_id ??
            message.id ??
            null,

        video_id:

            message.video_id ??
            VIDEO_ID,

        author_name:

            message.author_name ??
            message.authorDisplayName ??
            "مستخدم",

        message:

            message.message ??
            message.text ??
            "",

        created_at:

            message.created_at ??
            new Date().toISOString()

    };

}


// ============================================================
// 11. CREATE MESSAGE ELEMENT
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


    if (
        message.youtube_message_id
    ) {

        wrapper.dataset.messageId =
            message.youtube_message_id;

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
// 12. CHECK IF MESSAGE IS ALREADY DISPLAYED
// ============================================================

function isMessageDisplayed(
    messageId
) {

    if (
        !elements.messages ||
        !messageId
    ) {

        return false;

    }


    return Boolean(

        elements.messages.querySelector(

            `[data-message-id="${CSS.escape(
                messageId
            )}"]`

        )

    );

}


// ============================================================
// 13. RENDER ONE MESSAGE
// ============================================================

function renderMessage(
    message
) {

    if (
        !elements.messages
    ) {

        return;

    }


    const normalized =
        normalizeMessage(
            message
        );


    if (
        normalized.youtube_message_id &&
        isMessageDisplayed(
            normalized.youtube_message_id
        )
    ) {

        return;

    }


    const element =
        createMessageElement(
            normalized
        );


    elements.messages.appendChild(
        element
    );


    elements.messages.scrollTop =
        elements.messages.scrollHeight;

}


// ============================================================
// 14. RENDER MULTIPLE MESSAGES
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
// 15. LOAD ARCHIVED MESSAGES
// ============================================================
//
// Reads archived messages from Supabase.
// These messages are already stored in the database.
//
// ============================================================

async function loadArchivedMessages() {

    setStatus(
        "جاري تحميل الرسائل المؤرشفة..."
    );


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

            "فشل تحميل الرسائل المؤرشفة: " +

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


    totalMessages =
        data?.length ??
        0;


    updateStreamInfo({

        video_id:
            VIDEO_ID

    });


    return data ??
        [];

}


// ============================================================
// 16. SAVE NEW MESSAGES
// ============================================================
//
// Messages are inserted ONCE into live_chat_messages.
//
// Supabase Trigger should automatically copy them
// into archived_messages.
//
// ============================================================

async function saveNewMessages(
    messages
) {

    if (
        !Array.isArray(
            messages
        )
    ) {

        return [];

    }


    if (
        messages.length ===
        0
    ) {

        return [];

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
        rows.length ===
        0
    ) {

        return [];

    }


    const {
        data,
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


    if (
        error
    ) {

        throw new Error(

            "فشل حفظ الرسائل في Supabase: " +

            error.message

        );

    }


    return data ??
        [];

}


// ============================================================
// 17. FETCH NEW LIVE CHAT MESSAGES
// ============================================================

async function fetchLiveMessages() {

    const url =
        new URL(
            CHAT_FETCHER_URL
        );


    url.searchParams.set(
        "video_id",
        VIDEO_ID
    );


    if (
        nextPageToken
    ) {

        url.searchParams.set(
            "page_token",
            nextPageToken
        );

    }


    const response =

        await fetch(

            url.toString(),

            {

                method:
                    "GET",

                headers: {

                    "Content-Type":
                        "application/json"

                }

            }

        );


    let data;


    try {

        data =
            await response.json();

    } catch {

        throw new Error(
            "استجابة غير صالحة من خادم البث."
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

            "فشل جلب رسائل البث."

        );

    }


    liveChatId =

        data.live_chat_id ??

        liveChatId;


    nextPageToken =

        data.next_page_token ??

        nextPageToken;


    const messages =

        Array.isArray(
            data.messages
        )

            ? data.messages

            : [];


    return {

        ...data,

        messages

    };

}


// ============================================================
// 18. PROCESS NEW MESSAGES
// ============================================================

async function processNewMessages(
    messages
) {

    if (
        !messages ||
        messages.length ===
            0
    ) {

        return;

    }


    const normalized =

        messages.map(
            normalizeMessage
        );


    // Save once to Supabase.
    await saveNewMessages(
        normalized
    );


    // Display immediately.
    renderMessages(
        normalized
    );


    totalMessages +=
        normalized.length;


    updateStreamInfo({

        video_id:
            VIDEO_ID,

        live_chat_id:
            liveChatId

    });

}


// ============================================================
// 19. RETRY HELPER
// ============================================================

async function retryOperation(
    operation,
    attempts =
        MAX_RETRIES
) {

    let lastError;


    for (
        let attempt = 1;
        attempt <= attempts;
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

                `Retry ${attempt}/${attempts}`,

                error

            );


            if (
                attempt <
                attempts
            ) {

                await new Promise(

                    resolve =>

                        setTimeout(

                            resolve,

                            RETRY_DELAY *
                            attempt

                        )

                );

            }

        }

    }


    throw lastError;

}


// ============================================================
// 20. RUN ONE SYNC CYCLE
// ============================================================

async function runSyncCycle() {

    if (
        isRunning
    ) {

        return;

    }


    isRunning =
        true;


    try {

        clearError();


        validateConfiguration();


        setStatus(
            "جاري مزامنة البث..."
        );


        const result =

            await retryOperation(

                () =>
                    fetchLiveMessages()

            );


        await processNewMessages(

            result.messages

        );


        updateStreamInfo({

            video_id:
                VIDEO_ID,

            live_chat_id:
                result.live_chat_id ??
                liveChatId

        });


        setStatus(

            result.messages.length > 0

                ? `تم استقبال ${result.messages.length} رسالة جديدة`

                : "لا توجد رسائل جديدة"

        );


        retryCount =
            0;


    } catch (
        error
    ) {

        retryCount++;


        setStatus(
            "حدث خطأ أثناء المزامنة"
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
// 21. START POLLING
// ============================================================

function startPolling() {

    stopPolling();


    timer =

        setInterval(

            () => {

                runSyncCycle();

            },

            POLLING_INTERVAL

        );


    console.log(
        "[SYSTEM] Polling started"
    );

}


// ============================================================
// 22. STOP POLLING
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
        "[SYSTEM] Polling stopped"
    );

}


// ============================================================
// 23. INITIALIZE SYSTEM
// ============================================================

async function startSystem() {

    console.log(
        "===================================="
    );


    console.log(
        "SMART LIVE CHAT SYSTEM"
    );


    console.log(
        "VIDEO_ID:",
        VIDEO_ID
    );


    console.log(
        "===================================="
    );


    try {

        validateConfiguration();


        updateStreamInfo({

            video_id:
                VIDEO_ID

        });


        // First load existing archive.
        await loadArchivedMessages();


        // Then fetch new live messages.
        await runSyncCycle();


        // Continue polling.
        startPolling();


    } catch (
        error
    ) {

        setStatus(
            "فشل تشغيل النظام"
        );


        setError(
            error
        );

    }

}


// ============================================================
// 24. CLEANUP
// ============================================================

window.addEventListener(

    "beforeunload",

    () => {

        stopPolling();

    }

);


// ============================================================
// 25. START
// ============================================================

startSystem();
```
