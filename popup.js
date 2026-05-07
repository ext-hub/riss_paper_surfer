document.getElementById('startBtn').addEventListener('click', () => {
    const keyword = document.getElementById('keyword').value.trim();
    const maxDownloads = parseInt(document.getElementById('maxDownloads').value);
    
    if (!keyword) {
        alert("키워드를 입력하세요.");
        return;
    }
    
    document.getElementById('status').innerText = "작업을 시작합니다...\n창을 닫아도 백그라운드에서 진행됩니다.";
    document.getElementById('startBtn').disabled = true;
    
    chrome.runtime.sendMessage({
        action: "START_SCRAPING",
        keyword: keyword,
        maxDownloads: maxDownloads
    });
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "UPDATE_STATUS") {
        document.getElementById('status').innerText = message.text;
    } else if (message.action === "DONE") {
        document.getElementById('startBtn').disabled = false;
        document.getElementById('status').innerText += "\n\n✅ 모든 작업이 완료되었습니다!";
    } else if (message.action === "ERROR") {
        document.getElementById('startBtn').disabled = false;
        document.getElementById('status').innerText = "❌ 오류: " + message.text;
    }
});
