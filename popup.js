document.getElementById('startBtn').addEventListener('click', () => {
    const keyword = document.getElementById('keyword').value.trim();
    const maxDownloads = parseInt(document.getElementById('maxDownloads').value);
    
    // 선택된 단일 라디오 버튼 카테고리 수집
    const selectedRadio = document.querySelector('input[name="cat"]:checked');
    const categories = selectedRadio ? [selectedRadio.value] : [];
    
    if (!keyword) {
        alert("키워드를 입력하세요.");
        return;
    }
    
    if (categories.length === 0) {
        alert("수집할 카테고리를 선택하세요.");
        return;
    }
    
    document.getElementById('status').innerText = "🚀 수집을 시작합니다...\n창을 닫아도 백그라운드에서 계속 진행됩니다.";
    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;
    
    chrome.runtime.sendMessage({
        action: "START_SCRAPING",
        keyword: keyword,
        maxDownloads: maxDownloads,
        categories: categories
    });
});

document.getElementById('stopBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "STOP_SCRAPING" });
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('status').innerText = "🛑 수집 중단 요청을 보냈습니다.";
});

// 라디오 버튼 클릭 시 시각적 효과 처리
function updateActiveCategory() {
    document.querySelectorAll('.category-item').forEach(item => {
        const radio = item.querySelector('input');
        if (radio.checked) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

document.querySelectorAll('.category-item').forEach(item => {
    const radio = item.querySelector('input');
    
    // 라디오 버튼이나 라벨 클릭 시 상태 업데이트
    item.addEventListener('click', () => {
        radio.checked = true;
        updateActiveCategory();
    });
    
    radio.addEventListener('change', updateActiveCategory);
});

// 초기 상태 반영
updateActiveCategory();

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "UPDATE_STATUS") {
        document.getElementById('status').innerText = message.text;
    } else if (message.action === "DONE") {
        document.getElementById('startBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;
        document.getElementById('status').innerText = "✅ 모든 작업이 완료되었습니다!\n다운로드 폴더를 확인해주세요.";
    } else if (message.action === "ERROR") {
        document.getElementById('startBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;
        document.getElementById('status').innerText = "❌ 오류: " + message.text;
    }
});
