let targetKeyword = "";
let targetMax = 0;
let searchTabId = null;
let downloadedUrls = new Set(); // 중복 다운로드 방지용
let paperTitles = []; // 논문 제목 목록

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "START_SCRAPING") {
        targetKeyword = request.keyword;
        targetMax = request.maxDownloads;
        downloadedUrls.clear(); // 새 검색 시작 시 초기화
        
        chrome.runtime.sendMessage({action: "UPDATE_STATUS", text: "검색 페이지로 이동 중..."});
        
        // Find if we already have a RISS tab or SSU oasis tab
        chrome.tabs.query({url: "*://*.riss.kr/*"}, (tabs) => {
            let rissTab = tabs.length > 0 ? tabs[0] : null;
            
            if (!rissTab) {
                chrome.tabs.query({active: true, currentWindow: true}, (activeTabs) => {
                    let activeTab = activeTabs[0];
                    if (activeTab && (activeTab.url.includes('riss.kr') || activeTab.url.includes('ssu.ac.kr'))) {
                        startSearchOnTab(activeTab.id, activeTab.url);
                    } else {
                        // Open a new tab to riss via SSU
                        chrome.tabs.create({url: "https://oasis.ssu.ac.kr/"}, (tab) => {
                            chrome.runtime.sendMessage({action: "ERROR", text: "숭실대 도서관 홈페이지가 열렸습니다. 여기서 로그인을 먼저 하시고 RISS에 접속한 뒤 익스텐션을 다시 실행해주세요."});
                        });
                    }
                });
            } else {
                startSearchOnTab(rissTab.id, rissTab.url);
            }
        });
    } else if (request.action === "COLLECTED_LINKS") {
        // content.js에 찾은 논문 개수와 제목 목록을 전달받음
        let total = request.total;
        paperTitles = request.titles || [];
        chrome.runtime.sendMessage({action: "UPDATE_STATUS", text: `총 ${total}개의 논문을 찾았습니다. 차례대로 원문 열람을 시도합니다...`});
        
        downloadSequentially(total, 0);
    }
});

function startSearchOnTab(tabId, currentUrl) {
    searchTabId = tabId;
    let urlObj = new URL(currentUrl);
    let baseUrl = urlObj.origin; 
    
    // RISS '학위논문' 검색결과 페이지 URL (colName=bib_t)
    let searchUrl = `${baseUrl}/search/Search.do?isDetailSearch=N&searchGubun=true&viewYn=OP&queryText=&strQuery=${encodeURIComponent(targetKeyword)}&exQuery=&exQueryText=&order=%2FDESC&query=${encodeURIComponent(targetKeyword)}&innerSearchYN=N&colName=bib_t`;
    
    chrome.tabs.update(tabId, {url: searchUrl}, (tab) => {
        let listener = function(tId, changeInfo) {
            if (tId === tabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                setTimeout(() => {
                    chrome.runtime.sendMessage({action: "UPDATE_STATUS", text: "검색 완료! 원문 버튼을 확인합니다..."});
                    chrome.scripting.executeScript({
                        target: {tabId: tabId},
                        files: ['content.js']
                    }, () => {
                        chrome.tabs.sendMessage(tabId, {action: "EXTRACT", max: targetMax});
                    });
                }, 2000);
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
    });
}

function downloadSequentially(total, index) {
    if (index >= total || index >= targetMax) {
        chrome.runtime.sendMessage({action: "DONE"});
        return;
    }
    
    let paperTitle = (paperTitles[index] && paperTitles[index].trim() !== '')
        ? paperTitles[index].replace(/[\/\\?%*:|"<>]/g, '-')
        : `논문_${index + 1}`;
    
    chrome.runtime.sendMessage({action: "UPDATE_STATUS", text: `논문 ${index + 1}/${total} 열람 중...\n"${paperTitle}"`});
    
    let popupTabId = null;  // 팝업으로 열린 탭 ID
    let done = false;       // 중복 처리 방지 플래그
    let timeoutId = null;   // 타임아웃 핸들러
    
    // 리스너 및 타이머 정리
    function cleanup() {
        chrome.tabs.onCreated.removeListener(onTabCreated);
        chrome.tabs.onUpdated.removeListener(onTabUpdated);
        if (timeoutId) clearTimeout(timeoutId);
    }
    
    // 다음 논문으로 이동
    function moveToNext() {
        if (done) return;
        done = true;
        cleanup();
        setTimeout(() => downloadSequentially(total, index + 1), 1500);
    }
    
    // 새 탭/팝업이 생성되면 ID를 기억
    function onTabCreated(tab) {
        if (!popupTabId) {
            popupTabId = tab.id;
        }
    }
    
    // 탭 URL이 변경될 때마다 PDF 링크인지 확인
    function onTabUpdated(tabId, changeInfo, tab) {
        let isTargetTab = (popupTabId && tabId === popupTabId) || (!popupTabId && tabId !== searchTabId);
        if (!isTargetTab) return;
        if (tabId === searchTabId) return;
        if (done) return;
        
        let url = changeInfo.url || tab.url || '';
        if (!url) return;
        let urlLower = url.toLowerCase();
        
        // PDF URL 감지 (fulltextdownload.do 를 거쳐서 최종으로 리다이렉트된 주소)
        let isPdf = (urlLower.includes('.pdf') || urlLower.includes('/pdf/'))
                    && !urlLower.includes('fulltextdownload.do');
        
        if (isPdf) {
            let targetUrl = url;
            // ezPDF 등 뷰어가 ?file= 파라미터로 PDF를 감싼 경우 원본 주소 추출
            if (urlLower.includes('file=')) {
                let match = url.match(/[?&]file=([^&]+)/);
                if (match) targetUrl = decodeURIComponent(match[1]);
            }
            
            if (!downloadedUrls.has(targetUrl)) {
                downloadedUrls.add(targetUrl);
                let cleanKeyword = targetKeyword.replace(/[\/\\?%*:|"<>]/g, '-');
                let filename = `${cleanKeyword}/${paperTitle}.pdf`;
                
                chrome.downloads.download({
                    url: targetUrl,
                    filename: filename,
                    saveAs: false
                }, (downloadId) => {
                    moveToNext();
                });
            }
        }
    }
    
    // 이벤트 리스너를 먼저 등록한 뒤 클릭 → 팝업이 열리는 순간부터 감지
    chrome.tabs.onCreated.addListener(onTabCreated);
    chrome.tabs.onUpdated.addListener(onTabUpdated);
    
    // 25초 내에 PDF를 감지 못하면 다음으로 넘어감
    timeoutId = setTimeout(() => {
        chrome.runtime.sendMessage({action: "UPDATE_STATUS", text: `⚠️ 논문 ${index + 1} 시간 초과 — 다음으로 이동합니다`});
        moveToNext();
    }, 25000);
    
    // content.js에 해당 인덱스 버튼 클릭 지시 (리스너 등록 후!)
    chrome.tabs.sendMessage(searchTabId, {action: "CLICK_INDEX", index: index});
}


