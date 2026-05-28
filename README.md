# 기계팔 공장 평가 웹앱

기계팔 성능 값을 입력하면 공장 평가 점수를 계산하고 결과를 그래프로 보여주는 정적 웹사이트입니다.
종합 점수는 효율 점수와 경제성 점수만 반영합니다.
고장률과 유지보수 시간은 작을수록 좋은 값으로 처리되며, 기준값보다 커질수록 종합 점수에 직접 감점이 적용됩니다.

## 실행 방법

`index.html` 파일을 브라우저로 열면 바로 실행됩니다.

## 온라인 배포 방법

### Netlify

1. <https://app.netlify.com/drop> 접속
2. 이 폴더 전체를 드래그해서 업로드
3. 배포가 끝나면 공개 링크가 생성됩니다

### Vercel

1. <https://vercel.com/new> 접속
2. 이 폴더를 GitHub 저장소에 올린 뒤 프로젝트로 가져오기
3. Framework Preset은 `Other`로 선택
4. Build Command는 비워두고, Output Directory는 `.` 사용

### GitHub Pages

1. 이 폴더의 파일을 GitHub 저장소에 업로드
2. 저장소의 `Settings > Pages`로 이동
3. Source를 `Deploy from a branch`로 설정
4. Branch를 `main`, folder를 `/root`로 선택
5. 저장 후 생성되는 Pages 주소로 접속

## 주요 파일

- `index.html`: 화면 구조
- `styles.css`: 디자인
- `app.js`: 계산 로직과 화면 전환
- `netlify.toml`: Netlify 배포 설정
- `vercel.json`: Vercel 배포 설정
- `.nojekyll`: GitHub Pages 정적 파일 설정
