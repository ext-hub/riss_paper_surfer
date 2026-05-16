let targetKeyword = "";
let targetMax = 0;
let searchTabId = null;
let downloadedUrls = new Set(); // 중복 다운로드 방지용
let paperList = []; // 논문 정보 목록 (title, author, year)
let selectedCategories = []; // 선택된 카테고리 목록
let currentCategoryIndex = 0; // 현재 처리 중인 카테고리 인덱스
let globalDownloadCount = 0; // 전체 다운로드 수
let currentCategoryPage = 1; // 현재 카테고리의 페이지 번호
let isStopped = false; // 중단 플래그 추가
const PAGE_SCALE = 100; // 한 페이지당 검색 결과 수 (10 -> 100으로 상향)

// 카테고리 코드 → 한글 이름 매핑
const categoryNames = {
    "re_a_kor": "국내학술논문",
    "bib_t": "학위논문",
    "re_a_over": "해외학술논문",
    "bib_s": "학술지",
    "bib_m": "단행본",
    "re_a_report": "연구보고서"
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "START_SCRAPING") {
        isStopped = false; // 시작 시 초기화
        targetKeyword = request.keyword;
        targetMax = request.maxDownloads;
        selectedCategories = request.categories || ["bib_t"];
        currentCategoryIndex = 0;
        currentCategoryPage = 1;
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
    } else if (request.action === "STOP_SCRAPING") {
        isStopped = true;
        chrome.runtime.sendMessage({action: "UPDATE_STATUS", text: "🛑 중단됨: 사용자가 요청을 중단했습니다."});
    } else if (request.action === "COLLECTED_LINKS") {
        if (isStopped) return;
        // content.js에서 논문 정보 목록을 전달받음
        let total = request.total;
        paperList = request.papers || [];
        let catName = categoryNames[selectedCategories[currentCategoryIndex]] || selectedCategories[currentCategoryIndex];
        chrome.runtime.sendMessage({action: "UPDATE_STATUS", text: `[${catName}] ${currentCategoryPage}페이지에서 ${total}개의 논문을 찾았습니다. 차례대로 열람을 시작합니다...`});
        
        downloadSequentially(total, 0);
    } else if (request.action === "NO_RESULTS") {
        if (isStopped) return;
        // 현재 페이지에 결과가 없으면 다음 카테고리로 이동
        let catName = categoryNames[selectedCategories[currentCategoryIndex]] || selectedCategories[currentCategoryIndex];
        chrome.runtime.sendMessage({action: "UPDATE_STATUS", text: `[${catName}] 더 이상 결과가 없습니다. 다음 카테고리로 넘어갑니다.`});
        
        currentCategoryIndex++;
        processNextCategory();
    }
});

// 다음 카테고리 처리
function processNextCategory() {
    if (isStopped) return;
    if (currentCategoryIndex >= selectedCategories.length || globalDownloadCount >= targetMax) {
        chrome.runtime.sendMessage({action: "DONE"});
        return;
    }
    
    currentCategoryPage = 1; // 새 카테고리 시작 시 1페이지부터
    let category = selectedCategories[currentCategoryIndex];
    let catName = categoryNames[category] || category;
    chrome.runtime.sendMessage({action: "UPDATE_STATUS", text: `[${catName}] 1페이지 검색 중...`});
    
    startSearchOnTab(searchTabId, category, currentCategoryPage);
}

function startSearchOnTab(tabId, colName, page = 1) {
    if (isStopped) return;
    let encodedKeyword = encodeURIComponent(targetKeyword);
    let iStartCount = (page - 1) * PAGE_SCALE;
    // pageScale을 100으로 설정하여 더 많은 결과를 한 번에 가져옴
    let searchUrl = `https://www.riss.kr/search/Search.do?isDetailSearch=N&searchGubun=true&viewYn=OP&query=${encodedKeyword}&queryText=&iStartCount=${iStartCount}&iGroupView=5&colName=${colName}&exQuery=&exQueryText=&order=%2FDESC&onHanja=false&strSort=RANK&pageScale=${PAGE_SCALE}&sflag=1&fsearchMethod=search&isFDetailSearch=N&searchQuery=${encodedKeyword}&resultKeyword=${encodedKeyword}&pageNumber=${page}`;
    
    chrome.tabs.update(tabId, {url: searchUrl}, (tab) => {
        let listener = function(tId, changeInfo) {
            if (tId === tabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                setTimeout(() => {
                    let remaining = targetMax - globalDownloadCount;
                    chrome.scripting.executeScript({
                        target: {tabId: tabId},
                        files: ['content.js']
                    }, () => {
                        chrome.tabs.sendMessage(tabId, {action: "EXTRACT", max: remaining});
                    });
                }, 3000); // 2초 -> 3초로 연장
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
    });
}

function downloadSequentially(total, index) {
    if (isStopped) return;
    // 현재 페이지의 모든 논문을 처리했거나 목표 수량에 도달한 경우
    if (index >= total || globalDownloadCount >= targetMax) {
        if (globalDownloadCount < targetMax) {
            // 아직 목표 수량 미달이면 다음 페이지 시도
            currentCategoryPage++;
            let category = selectedCategories[currentCategoryIndex];
            let catName = categoryNames[category] || category;
            chrome.runtime.sendMessage({action: "UPDATE_STATUS", text: `[${catName}] ${currentCategoryPage}페이지로 이동합니다...`});
            startSearchOnTab(searchTabId, category, currentCategoryPage);
        } else {
            // 목표 달성 시 다음 카테고리
            currentCategoryIndex++;
            processNextCategory();
        }
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
        
        // 1. 쿼리 스트링을 제외한 순수 경로 추출
        let urlPath = urlLower.split('?')[0];
        
        // 2. PDF 여부 판별 (더 엄격하게)
        let isPdf = false;
        let targetUrl = url;

        // .pdf 확장자로 끝나거나 경로에 /pdf/가 포함된 경우
        if (urlPath.endsWith('.pdf') || urlLower.includes('/pdf/')) {
            isPdf = true;
        } 
        // ezPDF 등 뷰어 파라미터(?file=...)에서 추출 시도
        else if (urlLower.includes('file=')) {
            let match = url.match(/[?&]file=([^&]+)/);
            if (match) {
                let extractedUrl = decodeURIComponent(match[1]);
                let extractedPath = extractedUrl.toLowerCase().split('?')[0];
                if (extractedPath.endsWith('.pdf') || extractedUrl.toLowerCase().includes('/pdf/')) {
                    targetUrl = extractedUrl;
                    isPdf = true;
                }
            }
        }

        // PDF로 확인된 경우에만 다운로드 진행
        if (isPdf && !downloadedUrls.has(targetUrl)) {
            downloadedUrls.add(targetUrl);
            globalDownloadCount++;
            
            // 현재 탭 ID를 팝업 ID로 확실히 저장
            popupTabId = tabId;

            // 파일명 설정 (특수문자 제거)
            let safeAuthor = paperAuthor.replace(/[\/\\?%*:|"<>]/g, '-');
            let safeTitle = paperTitle.replace(/[\/\\?%*:|"<>]/g, '-');
            let safeYear = paperYear.replace(/[\/\\?%*:|"<>]/g, '-');
            let cleanKeyword = targetKeyword.replace(/[\/\\?%*:|"<>]/g, '-');
            let catName = categoryNames[selectedCategories[currentCategoryIndex]] || '기타';
            
            let filename = `${cleanKeyword}/${catName}/${safeAuthor}_${safeTitle}_${safeYear}.pdf`;
            
            // 닫을 탭 ID를 변수에 고정 (클로저)
            const tabToClose = tabId;

            chrome.downloads.download({
                url: targetUrl,
                filename: filename,
                saveAs: false
            }, (downloadId) => {
                // 다운로드 시작 후 5초 뒤에 해당 탭 닫기
                setTimeout(() => {
                    chrome.tabs.remove(tabToClose, () => {
                        if (chrome.runtime.lastError) {
                            // 이미 닫힌 경우 에러 무시
                        }
                    });
                }, 5000);
                moveToNext();
            });
        }
    }
    
    // 이벤트 리스너 등록
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
