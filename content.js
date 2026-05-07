chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "EXTRACT") {
        let max = request.max;
        let attempts = 0;
        
        function tryExtract() {
            let resultElements = document.querySelectorAll('.srchResultListW > ul > li');
            
            if (resultElements.length === 0) {
                attempts++;
                if (attempts < 10) {
                    setTimeout(tryExtract, 1000);
                } else {
                    chrome.runtime.sendMessage({action: "ERROR", text: "검색 결과가 없거나 원문보기 버튼을 찾을 수 없습니다."});
                }
                return;
            }
            
            let count = 0;
            let titles = [];
            for (let i = 0; i < resultElements.length; i++) {
                let fullTextBtn = resultElements[i].querySelector("a[onclick*='fulltextDownload'], a[href*='fulltextDownload']");
                if (fullTextBtn) {
                    count++;
                    // 논문 제목 추출 (다양한 RISS 셀렉터 시도)
                    let titleEl = resultElements[i].querySelector('.title a, .cont a.title, a.title, h3 a, .tit a, dt a, .listTit a');
                    let title = titleEl ? titleEl.innerText.trim() : `논문_${count}`;
                    // 파일명으로 사용할 수 없는 특수문자 제거
                    title = title.replace(/[\/\\?%*:|"<>]/g, ' ').replace(/\s+/g, ' ').trim();
                    if (title.length > 80) title = title.substring(0, 80).trim(); // 파일명 최대 80자
                    titles.push(title);
                }
                if (count >= max) break;
            }
            
            if (count === 0) {
                chrome.runtime.sendMessage({action: "ERROR", text: "원문보기 버튼을 찾을 수 없습니다."});
            } else {
                chrome.runtime.sendMessage({action: "COLLECTED_LINKS", total: count, titles: titles});
            }
        }
        
        tryExtract();
    } else if (request.action === "CLICK_INDEX") {
        // 백그라운드 스크립트의 요청에 따라 실제 DOM 엘리먼트 클릭
        let resultElements = document.querySelectorAll('.srchResultListW > ul > li');
        let validElements = [];
        for (let i = 0; i < resultElements.length; i++) {
            let btn = resultElements[i].querySelector("a[onclick*='fulltextDownload'], a[href*='fulltextDownload']");
            if (btn) validElements.push(btn);
        }
        
        if (request.index < validElements.length) {
            validElements[request.index].click();
        }
    }
});
