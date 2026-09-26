# 절임배추 주문·고객·출고 관리 프로그램 (imsil)

소규모 절임배추 농가에서 전화나 문자로 들어오는 주문을 받아 **출고·입금·택배·고객 관리**를 현장에서 즉시 끝낼 수 있도록 만든 모바일 최적화 웹앱(PWA)입니다.

---

## 주요 특징 및 화면 설계 원칙

1. **시니어 친화 UI & 높은 가독성**
   - 불필요한 장식용 이모티콘을 일체 배제하고, 눈에 잘 들어오는 선명한 고대비와 명확한 한글 라벨을 적용했습니다.
   - 글꼴 크기 계층을 명확히 하여 핵심 숫자(오늘 보낼 배추 상자 수, 미입금액)를 큼직하게 표시합니다.
2. **모바일 확대/축소(Pinch-to-Zoom) 100% 지원**
   - 화면 글씨가 작을 때 스마트폰 화면을 두 손가락으로 언제든 시원하게 확대해서 보실 수 있습니다.
   - 현장에서 장갑을 끼고도 쉽게 누를 수 있도록 버튼 터치 높이를 52px 이상으로 넉넉하게 제작했습니다.
3. **한 화면 한 목적 (단순화)**
   - **오늘 출고 현황**: 오늘 보낼 10kg/20kg 상자 수, 총 중량(kg), 미입금 확인 및 [원클릭 입금완료].
   - **3초 주문 입력**: 전화번호 뒷자리만 쳐도 기존 고객 이름과 주소가 자동 완성되며, 큼직한 `+` / `-` 버튼으로 수량을 조절합니다.
   - **출고·택배 관리**: 포장 작업 체크리스트 및 택배사 제출용 엑셀(CSV) 원클릭 다운로드.
   - **고객 장부**: 고객별 전화 걸기, 문자 보내기 및 과거 몇 년도에 얼마를 주문했는지 과거 이력 조회.
   - **농가 정보 설정**: 상호명, 실제 대표 전화번호, 입금 계좌정보(은행/계좌/예금주), 10kg/20kg 단가 수정.

---

## 3분 빠른 시작 가이드 (처음 사용하는 분)

### 1. 저장소 클론 및 패키지 설치
```bash
git clone https://github.com/bongkeun-choi/imsil.git
cd imsil
npm install
```

### 2. Turso 무료 데이터베이스 설정
1. [Turso 웹사이트](https://turso.tech/)에서 무료 계정을 생성합니다.
2. 새 데이터베이스를 생성하고 **Database URL**과 **Auth Token**을 발급받습니다.
3. 프로젝트 루트에 `.env.local` 파일을 생성하고 아래 형식으로 입력합니다:

```env
TURSO_DATABASE_URL=libsql://your-database-name.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
```
*(견본 파일 `.env.example`을 복사하여 이름을 `.env.local`로 변경하셔도 됩니다.)*

### 3. 데이터베이스 테이블 초기화 (원클릭)
다음 명령어를 실행하면 필요한 테이블(`customers`, `products`, `orders`, `settings` 등)과 기본 상품(10kg, 20kg)이 1초 만에 자동 생성됩니다:
```bash
npm run db:setup
```

### 4. 개발 서버 실행
```bash
npm run dev
```
브라우저에서 `http://localhost:3000`으로 접속하시면 즉시 사용하실 수 있습니다.

---

## GitHub Pages 무료 배포 방법 (3단계)

본 프로그램은 서버 없이 GitHub Pages에서 100% 완전 무료로 동작합니다:

1. **GitHub 저장소로 코드 푸시**
   ```bash
   git push -u origin main
   ```
2. **GitHub 저장소 설정에서 Pages 활성화**
   - GitHub 저장소(`https://github.com/bongkeun-choi/imsil`)로 이동합니다.
   - 상단 **Settings** → 좌측 **Pages** 메뉴 클릭.
   - **Build and deployment > Source** 항목을 `Deploy from a branch`에서 **`GitHub Actions`** 로 변경합니다.
3. **배포 완료 및 사용**
   - 상단 **Actions** 탭에서 배포가 1분 만에 자동으로 완료됩니다.
   - 완료 후 제공되는 주소(`https://bongkeun-choi.github.io/imsil/`)로 스마트폰이나 PC에서 접속합니다.
   - 첫 접속 시 나타나는 모달 창에 본인의 **Turso DB URL과 Auth Token**을 입력하면 즉시 나만의 전용 주문관리 시스템으로 동작합니다!
   - 스마트폰 브라우저 메뉴에서 **[홈 화면에 추가]**를 누르면 앱처럼 설치되어 사용할 수 있습니다.

---

## 보안 주의사항
- 실제 Turso Auth Token이나 민감 정보가 들어있는 `.env`, `.env.local` 파일은 `.gitignore`에 의해 GitHub 업로드가 안전하게 차단되어 있습니다.
- 코드를 GitHub에 커밋할 때 개인 비밀키가 커밋되지 않도록 주의해 주세요.

---

## 라이선스
MIT License
