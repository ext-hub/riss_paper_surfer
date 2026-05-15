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
            let papers = []; // 논문 정보 목록 (제목, 저자, 발표연도)
            for (let i = 0; i < resultElements.length; i++) {
                let fullTextBtn = resultElements[i].querySelector("a[onclick*='fulltextDownload'], a[href*='fulltextDownload']");
                if (fullTextBtn) {
                    count++;
                    // 논문 제목 추출 (다양한 RISS 셀렉터 시도)
                    let titleEl = resultElements[i].querySelector('.title a, .cont a.title, a.title, h3 a, .tit a, dt a, .listTit a');
                    let title = titleEl ? titleEl.innerText.trim() : `논문_${count}`;
                    // 파일명으로 사용할 수 없는 특수문자 제거
                    title = title.replace(/[\/\\?%*:|"<>]/g, ' ').replace(/\s+/g, ' ').trim();
                    if (title.length > 80) title = title.substring(0, 80).trim();
                    
                    // 저자 추출
                    let authorEl = resultElements[i].querySelector('.author a, .writer a, .cont .etc span:first-child a, p.etc a:first-of-type, .infoPD a');
                    let author = '';
                    if (authorEl) {
                        author = authorEl.innerText.trim();
                    } else {
                        // 다른 방식으로 저자 추출 시도
                        let etcEl = resultElements[i].querySelector('.etc, .infoPD');
                        if (etcEl) {
                            let etcText = etcEl.innerText.trim();
                            // 첫번째 항목이 보통 저자명
                            let parts = etcText.split(/[|,]/);
                            if (parts.length > 0) {
                                author = parts[0].trim();
                            }
                        }
                    }
                    author = author.replace(/[\/\\?%*:|"<>]/g, '').replace(/\s+/g, ' ').trim();
                    if (author.length > 30) author = author.substring(0, 30).trim();
                    
                    // 발표연도 추출
                    let year = '';
                    let yearEl = resultElements[i].querySelector('.year, .date');
                    if (yearEl) {
                        let yearMatch = yearEl.innerText.match(/(\d{4})/);
                        if (yearMatch) year = yearMatch[1];
                    }
                    if (!year) {
                        // 전체 텍스트에서 연도 패턴 추출 시도
                        let fullText = resultElements[i].innerText;
                        let yearMatch = fullText.match(/(\d{4})\s*년?/);
                        if (yearMatch) year = yearMatch[1];
                        // 마지막 시도: 4자리 숫자 중 1900~2099 범위
                        if (!year) {
                            let allYears = fullText.match(/\b(19|20)\d{2}\b/g);
                            if (allYears && allYears.length > 0) {
                                year = allYears[allYears.length - 1]; // 마지막 연도가 발표연도일 가능성 높음
                            }
                        }
                    }
                    
                    papers.push({ title, author, year });
                }
                if (count >= max) break;
            }
            
            if (count === 0) {
                chrome.runtime.sendMessage({action: "ERROR", text: "원문보기 버튼을 찾을 수 없습니다."});
            } else {
                chrome.runtime.sendMessage({action: "COLLECTED_LINKS", total: count, papers: papers});
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
