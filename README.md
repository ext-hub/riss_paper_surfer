# RISS Paper Surfer 🏄‍♂️📄

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Extension-blue?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/riss-paper-surfer/mneaffdijjooolhgahgplpbpidcpjpbh?hl=ko&utm_source=ext_sidebar)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)

**RISS Paper Surfer**는 논문 수집에 소모되는 단순 반복 작업을 획기적으로 줄여주는 크롬 확장 프로그램(Chrome Extension)입니다. 
대학 도서관 계정 연동을 통해 **RISS(학술연구정보서비스)** 의 논문들을 한 번의 클릭으로 자동 검색하고, 뷰어에서 원문(PDF)을 추출하여 로컬에 일괄 다운로드합니다.

## ✨ 주요 기능 (Features)

### v1.1 (Latest)
* **논문 유형 선택**: 학술논문(국내/해외) 및 학위논문을 독립적으로 선택하여 원하는 유형만 수집할 수 있습니다.
* **스마트한 파일 관리**: `[검색 키워드]/[논문 유형]` 폴더 자동 분류 및 `[저자]_[제목]_[연도].pdf` 규칙으로 파일을 체계적으로 관리합니다.

### v1.0
* **원클릭 자동 다운로드**: 검색어와 원하는 다운로드 개수만 입력하면 알아서 논문을 탐색하고 다운로드합니다.
* **백그라운드 처리**: 확장 프로그램이 다운로드를 진행하는 동안 사용자는 다른 탭에서 자유롭게 웹 서핑을 할 수 있습니다.
* **동적 팝업 뷰어 핸들링**: 수많은 대학교 도서관의 각기 다른 외부 뷰어 도메인 환경에서도 URL 변화를 감지하여 안정적으로 PDF를 추출합니다.

## 🛠 사용 기술 (Tech Stack)
* **Core**: Vanilla JavaScript, HTML5, CSS3
* **Platform**: Chrome Extension API (Manifest V3)
  * `chrome.tabs`, `chrome.scripting`, `chrome.downloads`

## 🚀 설치 및 사용 방법 (How to Use)

1. [크롬 웹 스토어](https://chromewebstore.google.com/detail/riss-paper-surfer/mneaffdijjooolhgahgplpbpidcpjpbh?hl=ko&utm_source=ext_sidebar) 에서 확장 프로그램을 설치합니다.
2. 대학 도서관 홈페이지(예: oasis.ssu.ac.kr)에 접속하여 **로그인**합니다.
3. 도서관 홈페이지의 링크를 통해 RISS에 접속합니다. (인증 세션 유지)
4. 주소창 우측의 확장 프로그램 아이콘을 클릭하고, 검색할 **키워드**와 **개수**를 입력합니다.
5. `자동 다운로드 시작` 버튼을 누르고 폴더에 논문이 쌓이는 것을 확인합니다.

> **⚠️ 주의사항**  
> 브라우저 우측 상단의 주소창에서 외부 뷰어에 대한 **'팝업 차단'을 반드시 '항상 허용'** 으로 설정해야 자동화가 원활하게 동작합니다.

## 🤝 기여 (Contributing)
버그 리포트, 기능 제안 및 Pull Request는 언제나 환영합니다!
