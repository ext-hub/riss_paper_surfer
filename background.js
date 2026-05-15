let targetKeyword = "";
let targetMax = 0;
let searchTabId = null;
let downloadedUrls = new Set(); // 중복 다운로드 방지용
let paperList = []; // 논문 정보 목록 (title, author, year)
let selectedCategories = []; // 선택된 카테고리 목록
let currentCategoryIndex = 0; // 현재 처리 중인 카테고리 인덱스
let globalDownloadCount = 0; // 전체 다운로드 수

// 카테고리 코드 → 한글 이름 매핑
const categoryNames = {
    "re_a_kor": "국내학술",
    "bib_t": "학위논문",
    "re_a_over": "해외학술"
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "START_SCRAPING") {
        targetKeyword = request.keyword;
        targetMax = request.maxDownloads;
        selectedCategories = request.categories || ["bib_t"];
        currentCategoryIndex = 0;
        globalDownloadCount = 0;
        downloadedUrls.clear(); // 새 검색 시작 시 초기화
        
        chrome.runtime.sendMessage({action: "UPDATE_STATUS", text: "검색 페이지로 이동 중..."});
        
        // Find if we already have a RISS tab or SSU oasis tab
        chrome.tabs.query({url: "*://*.riss.kr/*"}, (tabs) => {
            let rissTab = tabs.length > 0 ? tabs[0] : null;
            
            if (!rissTab) {
                chrome.tabs.query({active: true, currentWindow: true}, (activeTabs) => {
                    let activeTab = activeTabs[0];
                    if (activeTab && (activeTab.url.includes('riss.kr') || activeTab.url.includes('ssu.ac.kr'))) {
                        searchTabId = activeTab.id;
                        processNextCategory();
                    } else {
                        // Open a new tab to riss via SSU
                        chrome.tabs.create({url: "https://oasis.ssu.ac.kr/"}, (tab) => {
                            chrome.runtime.sendMessage({action: "ERROR", text: "숭실대 도서관 홈페이지가 열렸습니다. 여기서 로그인을 먼저 하시고 RISS에 접속한 뒤 익스텐션을 다시 실행해주세요."});
                        });
                    }
                });
            } else {
                searchTabId = rissTab.id;
                processNextCategory();
            }
        });
    } else if (request.action === "COLLECTED_LINKS") {
        // content.js에서 논문 정보 목록을 전달받음
        let total = request.total;
        paperList = request.papers || [];
        let catName = categoryNames[selectedCategories[currentCategoryIndex]] || selectedCategories[currentCategoryIndex];
        chrome.runtime.sendMessage({action: "UPDATE_STATUS", text: `[${catName}] 총 ${total}개의 논문을 찾았습니다. 차례대로 원문 열람을 시도합니다...`});
        
        downloadSequentially(total, 0);
    }
});

// 다음 카테고리 처리
function processNextCategory() {
    if (currentCategoryIndex >= selectedCategories.length) {
        chrome.runtime.sendMessage({action: "DONE"});
        return;
    }
    
    if (globalDownloadCount >= targetMax) {
        chrome.runtime.sendMessage({action: "DONE"});
        return;
    }
    
    let category = selectedCategories[currentCategoryIndex];
    let catName = categoryNames[category] || category;
    chrome.runtime.sendMessage({action: "UPDATE_STATUS", text: `[${catName}] 검색 중...`});
    
    startSearchOnTab(searchTabId, category);
}

function startSearchOnTab(tabId, colName) {
    // RISS 검색결과 페이지 URL (테스트에서 확인된 필수 파라미터 구조)
    let encodedKeyword = encodeURIComponent(targetKeyword);
    let searchUrl = `https://www.riss.kr/search/Search.do?isDetailSearch=N&searchGubun=true&viewYn=OP&query=${encodedKeyword}&queryText=&iStartCount=0&iGroupView=5&colName=${colName}&exQuery=&exQueryText=&order=%2FDESC&onHanja=false&strSort=RANK&pageScale=10&sflag=1&fsearchMethod=search&isFDetailSearch=N&searchQuery=${encodedKeyword}&resultKeyword=${encodedKeyword}&pageNumber=1`;
    
    chrome.tabs.update(tabId, {url: searchUrl}, (tab) => {
        let listener = function(tId, changeInfo) {
            if (tId === tabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                setTimeout(() => {
                    let catName = categoryNames[colName] || colName;
                    chrome.runtime.sendMessage({action: "UPDATE_STATUS", text: `[${catName}] 검색 완료! 원문 버튼을 확인합니다...`});
                    
                    // 남은 다운로드 수 계산
                    let remaining = targetMax - globalDownloadCount;
                    
                    chrome.scripting.executeScript({
                        target: {tabId: tabId},
                        files: ['content.js']
                    }, () => {
                        chrome.tabs.sendMessage(tabId, {action: "EXTRACT", max: remaining});
                    });
                }, 2000);
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
    });
}

function downloadSequentially(total, index) {
    if (index >= total || globalDownloadCount >= targetMax) {
        // 이 카테고리 완료, 다음 카테고리로
        currentCategoryIndex++;
        processNextCategory();
        return;
    }
    
    let paper = paperList[index] || {};
    let paperTitle = (paper.title && paper.title.trim() !== '') ? paper.title : `논문_${index + 1}`;
    let paperAuthor = (paper.author && paper.author.trim() !== '') ? paper.author : '저자미상';
    let paperYear = (paper.year && paper.year.trim() !== '') ? paper.year : '연도미상';
    
    // 파일명 형식: 저자_제목_발표연도.pdf
    let displayName = `${paperAuthor}_${paperTitle}_${paperYear}`;
    let catName = categoryNames[selectedCategories[currentCategoryIndex]] || selectedCategories[currentCategoryIndex];
    
    chrome.runtime.sendMessage({action: "UPDATE_STATUS", text: `[${catName}] 논문 ${globalDownloadCount + 1}/${targetMax} 열람 중...\n"${displayName}"`});
    
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
                globalDownloadCount++;
                
                // 파일명: 저자_제목_발표연도.pdf (특수문자 제거)
                let safeAuthor = paperAuthor.replace(/[\/\\?%*:|"<>]/g, '-');
                let safeTitle = paperTitle.replace(/[\/\\?%*:|"<>]/g, '-');
                let safeYear = paperYear.replace(/[\/\\?%*:|"<>]/g, '-');
                let cleanKeyword = targetKeyword.replace(/[\/\\?%*:|"<>]/g, '-');
                let catName = categoryNames[selectedCategories[currentCategoryIndex]] || '기타';
                
                let filename = `${cleanKeyword}/${catName}/${safeAuthor}_${safeTitle}_${safeYear}.pdf`;
                
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
        chrome.runtime.sendMessage({action: "UPDATE_STATUS", text: `⚠️ 논문 ${globalDownloadCount + 1} 시간 초과 — 다음으로 이동합니다`});
        moveToNext();
    }, 25000);
    
    // content.js에 해당 인덱스 버튼 클릭 지시 (리스너 등록 후!)
    chrome.tabs.sendMessage(searchTabId, {action: "CLICK_INDEX", index: index});
}
