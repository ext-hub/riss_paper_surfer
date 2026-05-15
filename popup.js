document.getElementById('startBtn').addEventListener('click', () => {
    const keyword = document.getElementById('keyword').value.trim();
    const maxDownloads = parseInt(document.getElementById('maxDownloads').value);
    
    // 학술논문: 라디오 (선택 안 함 / 국내 / 해외)
    const academicRadio = document.querySelector('input[name="academic"]:checked');
    
    // 학위논문: 라디오 (O / X)
    const thesisRadio = document.querySelector('input[name="thesis"]:checked');
    const thesisIncluded = thesisRadio && thesisRadio.value === 'yes';
    
    // 선택된 카테고리 수집 (none이면 학술논문 제외)
    const categories = [];
    if (academicRadio && academicRadio.value !== 'none') categories.push(academicRadio.value);
    if (thesisIncluded) categories.push('bib_t');
    
    if (!keyword) {
        alert("키워드를 입력하세요.");
        return;
    }
    
    if (categories.length === 0) {
        alert("논문 유형을 하나 이상 선택하세요.");
        return;
    }
    
    document.getElementById('status').innerText = "작업을 시작합니다...\n창을 닫아도 백그라운드에서 진행됩니다.";
    document.getElementById('startBtn').disabled = true;
    
    chrome.runtime.sendMessage({
        action: "START_SCRAPING",
        keyword: keyword,
        maxDownloads: maxDownloads,
        categories: categories
    });
});

// 라디오 버튼 시각적 토글 (학술논문)
document.querySelectorAll('input[name="academic"]').forEach(radio => {
    radio.addEventListener('change', () => {
        document.querySelectorAll('input[name="academic"]').forEach(r => {
            r.closest('.toggle-item').classList.remove('selected');
        });
        radio.closest('.toggle-item').classList.add('selected');
    });
});

// 라디오 버튼 시각적 토글 (학위논문)
document.querySelectorAll('input[name="thesis"]').forEach(radio => {
    radio.addEventListener('change', () => {
        document.querySelectorAll('input[name="thesis"]').forEach(r => {
            r.closest('.toggle-item').classList.remove('selected');
        });
        radio.closest('.toggle-item').classList.add('selected');
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
