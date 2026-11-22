// KnotFound — English / 한국어. Language is stored in localStorage ("knotfound-lang"); switching reloads the page.
// Papers and arXiv metadata stay in their original language. Korean mode translates the interface, topics,
// learning paths, the map and the open problems, and reads Korean Wikipedia where an article exists.
const LANG = (() => { try { return localStorage.getItem("knotfound-lang") === "ko" ? "ko" : "en"; } catch (e) { return "en"; } })();
document.documentElement.lang = LANG;

const KO = {
  // navigation & static
  "Home": "홈", "Map": "지도", "Problems": "문제", "History": "기록", "Settings": "설정", "Search": "검색",
  "Language": "언어", "Close": "닫기",
  "Open original ↗": "원문 열기 ↗", "Abstract": "초록", "Known": "증명됨", "Open": "미해결",
  "Open problems by difficulty": "난이도별 미해결 문제", "How is this scored?": "점수는 어떻게 계산되나요?", "Clear": "지우기",
  "FOOTER": `논문 출처: <a href="https://arxiv.org" target="_blank" rel="noopener">arXiv</a>. arXiv의 오픈 액세스 상호운용성 사용에 감사드립니다. 각 논문의 저작권은 저자에게 있으며 arXiv.org에서 불러옵니다. 문서 출처: <a href="https://ko.wikipedia.org" target="_blank" rel="noopener">위키백과</a> (<a href="https://creativecommons.org/licenses/by-sa/4.0/deed.ko" target="_blank" rel="noopener">CC BY-SA 4.0</a>).`,
  // time & length
  "{n}s": "{n}초", "{n}m": "{n}분", "{n}h": "{n}시간", "{h}h {m}m": "{h}시간 {m}분", "{n} min": "{n}분",
  "{n} pp": "{n}쪽", "{n} pages": "{n}쪽", "{n} words": "{n}단어", "~{d} read": "약 {d}",
  "Paper": "논문", "Wikipedia": "위키백과", " et al.": " 외", "Concept": "개념",
  // recommendations & home
  "Because you read {x}": "‘{x}’ 기반 추천", "New to you: {x}": "새로운 분야: {x}",
  "All": "전체", "No results": "결과 없음",
  "Learning paths": "학습 경로", "Start from the basics and build up, one step at a time": "기초부터 한 단계씩 차근차근",
  "Scroll left": "왼쪽으로", "Scroll right": "오른쪽으로",
  "steps": "단계", "{d}/{n} done": "{d}/{n} 완료",
  "From basics to “{x}”": "기초부터 “{x}”까지", "Built for this document": "이 문서를 위한 경로",
  "Your path: {x}": "나를 위한 경로: {x}", "Built from what you read": "읽은 기록으로 만든 경로",
  // playlists
  "Knot theory from zero": "매듭 이론, 처음부터", "No background needed": "사전 지식 없이 시작",
  "Polynomial invariants": "다항식 불변량", "Alexander, Jones, HOMFLY": "알렉산더, 존스, HOMFLY",
  "Road to Khovanov homology": "호바노프 호몰로지로 가는 길", "From diagrams to homology": "다이어그램에서 호몰로지까지",
  "Road to the slice–ribbon conjecture": "슬라이스–리본 추측으로 가는 길", "Into 4 dimensions": "4차원으로",
  "Road to knot Floer homology": "매듭 플뢰어 호몰로지로 가는 길", "Floer theory for knots": "매듭을 위한 플뢰어 이론",
  "Road to the volume conjecture": "부피 추측으로 가는 길", "Quantum meets hyperbolic": "양자와 쌍곡 기하의 만남",
  "Hyperbolic knots": "쌍곡 매듭", "Geometry of knot complements": "매듭 여공간의 기하",
  "Dehn surgery & lens spaces": "덴 수술과 렌즈 공간", "Building 3-manifolds from knots": "매듭으로 3차원 다양체 만들기",
  // reading page
  "Step {i} of {n} · {d} done": "{n}단계 중 {i}단계 · {d}개 완료",
  "© the authors · {link} · shown from arXiv.org": "© 저자 · {link} · arXiv.org에서 불러옴",
  "Text from {link} · CC BY-SA 4.0": "출처: {link} · CC BY-SA 4.0",
  "Next step: {x} →": "다음 단계: {x} →", "Path complete ✓": "경로 완료 ✓", "Start from basics ({n} steps)": "기초부터 시작하기 ({n}단계)",
  "Open problems here": "관련 미해결 문제",
  "Loading…": "불러오는 중…", "Core idea · {m} min read": "핵심 개념 · {m}분", " · {n} sections to go deeper": " · 더 깊이 볼 섹션 {n}개",
  "Go deeper": "더 깊이", "{m} min": "{m}분", "Shortened from Wikipedia · CC BY-SA 4.0 · ": "위키백과에서 요약 · CC BY-SA 4.0 · ",
  "Read the full article ↗": "전체 문서 읽기 ↗", "Couldn't load this article.": "문서를 불러오지 못했습니다.", "Open on Wikipedia ↗": "위키백과에서 열기 ↗",
  "Korean Wikipedia": "한국어 위키백과", "Show English original": "영어 원문 보기", "Show in Korean": "한국어로 보기",
  "No Korean article yet, so this is the English original.": "한국어 문서가 아직 없어 영어 원문을 보여 드립니다.",
  // difficulty
  "Years open": "미해결 기간", "Expert attention": "전문가 관심도", "Prerequisite depth": "선행 지식 깊이",
  "Lack of progress": "진척 부족", "Computer-testable (−)": "컴퓨터 실험 가능성 (−)",
  "Good first project": "첫 연구 과제로 적합", "Graduate": "대학원 수준", "Frontier": "연구 최전선", "Legendary": "전설급",
  "FORMULA": "점수 = 100 × (Σ wᵢ·요인ᵢ − w·실험 가능성) / Σ wᵢ — 입력값은 인용 문헌에 근거한 편집자 추정치입니다",
  // map panel
  "Open since {y}": "{y}부터 미해결", "Proved {y}": "{y}년 증명", "First steps": "첫걸음", "Builds on": "기반 개념", "Read": "읽을거리",
  // history
  "total reading time across {n} documents": "총 읽은 시간 · 문서 {n}개",
  "Nothing yet. Time spent reading builds your recommendations.": "아직 기록이 없어요. 읽은 시간이 추천에 반영됩니다.",
};
const EN = {
  "FOOTER": `Papers from <a href="https://arxiv.org" target="_blank" rel="noopener">arXiv</a>. Thank you to arXiv for use of its open access interoperability. Each paper remains © its authors and opens from arXiv.org. Articles from <a href="https://en.wikipedia.org" target="_blank" rel="noopener">Wikipedia</a> under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>.`,
  "FORMULA": "score = 100 × (Σ wᵢ·factorᵢ − w·computer-testable) / Σ wᵢ — inputs are editorial estimates from the cited literature",
  "total reading time across {n} documents": "total reading time across {n} document(s)",
};
function t(key, vars) {
  let s = (LANG === "ko" ? KO[key] : EN[key]) ?? key;
  if (vars) for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
  return s;
}

// Korean names for the Wikipedia concept articles (display only; ids stay English)
const KO_WIKI = { "Knot theory": "매듭 이론", "Reidemeister move": "라이데마이스터 이동", "Trefoil knot": "세잎매듭", "Prime knot": "소매듭",
  "Linking number": "연환수", "Knot invariant": "매듭 불변량", "Crossing number (knot theory)": "교차수", "Unknotting number": "풀림수",
  "Unknotting problem": "풀림 문제", "Torus knot": "원환면 매듭", "Satellite knot": "위성 매듭", "Alternating knot": "교대 매듭",
  "Bracket polynomial": "괄호 다항식", "Jones polynomial": "존스 다항식", "Tait conjectures": "테이트 추측", "HOMFLY polynomial": "HOMFLY 다항식",
  "Kauffman polynomial": "카우프만 다항식", "Seifert surface": "자이페르트 곡면", "Alexander polynomial": "알렉산더 다항식", "Knot group": "매듭군",
  "Knot complement": "매듭 여공간", "Braid group": "땋임군", "Borromean rings": "보로메오 고리", "Finite type invariant": "유한형 불변량",
  "Khovanov homology": "호바노프 호몰로지", "Floer homology": "플뢰어 호몰로지", "Slice knot": "슬라이스 매듭", "Ribbon knot": "리본 매듭",
  "Link concordance": "링크 콘코던스", "Conway knot": "콘웨이 매듭", "Dehn surgery": "덴 수술", "Lens space": "렌즈 공간", "Berge knot": "베르주 매듭",
  "Hyperbolic link": "쌍곡 링크", "Figure-eight knot (mathematics)": "8자 매듭", "Hyperbolic volume": "쌍곡 부피", "Volume conjecture": "부피 추측" };
const dt = d => (LANG === "ko" && d.kind === "article" && KO_WIKI[d.title]) || d.title;
// keep the English text of every map item for matching ideas, whatever the display language
NODES.forEach(n => n._en = { title: n.title, text: n.statement || n.summary || "" });
Object.assign(KO, {
  "Idea": "아이디어",
  "Turn an idea into a research map": "아이디어를 연구 지도로",
  "Describe a problem you'd like to work on. You'll get what it builds on, what's known, what's still open and the latest papers.":
    "풀고 싶은 문제를 적어 보세요. 기반 개념, 알려진 결과, 아직 열린 문제, 최신 논문을 한눈에 보여 드립니다.",
  "e.g. Can machine learning predict the unknotting number of a knot?": "예: 머신러닝으로 매듭의 풀림수를 예측할 수 있을까?",
  "Map it": "지도 만들기", "Try:": "예시:",
  "Your idea is closest to {x}": "이 문제와 가장 가까워요: {x}", "Start by reading this": "이 논문부터 읽어 보면 좋아요",
  "Then try this: {q}": "그다음엔 이걸 해 보세요: {q}",
  "Foundations": "기초 개념", "Known results": "알려진 결과", "Open problems": "미해결 문제", "Recent papers": "최신 논문", "Your idea": "나의 아이디어",
  "Open problem": "미해결 문제", "Closest open problem": "가장 가까운 미해결 문제", "Most related paper": "가장 관련 있는 논문",
  "A question to start with": "시작해 볼 질문", "Difficulty": "난이도",
  "No close matches yet. Try words like knot, polynomial, slice, surgery or unknotting.": "가까운 결과를 찾지 못했어요. 매듭, 다항식, 슬라이스, 수술, 풀림수 같은 단어를 넣어 보세요.",
});

if (LANG === "ko") {
  const KO_TOPIC = { concordance: "슬라이스·콘코던스", khovanov: "호바노프 호몰로지", floer: "매듭 플뢰어", quantum: "존스·양자 불변량",
    volume: "부피 추측", hyperbolic: "쌍곡 매듭", surgery: "덴 수술", unknotting: "풀림", classical: "알렉산더·자이페르트",
    diagrams: "다이어그램·교차수", braids: "땋임", vassiliev: "바실리예프", algorithms: "알고리즘" };
  TOPICS.forEach(x => { if (KO_TOPIC[x.id]) x.label = KO_TOPIC[x.id]; });

  const KO_AREA = { classical: "고전 불변량", diagrams: "다이어그램과 교차수", unknotting: "풀림과 국소 이동", quantum: "양자 불변량",
    vassiliev: "유한형 불변량", khovanov: "호바노프 호몰로지", hfk: "매듭 플뢰어 호몰로지", hyperbolic: "쌍곡 기하",
    surgery: "덴 수술", concordance: "콘코던스와 4차원", computation: "알고리즘과 복잡도" };
  AREAS.forEach(a => { if (KO_AREA[a.id]) a.name = KO_AREA[a.id]; });

  const KO_NOTE = { "classical (knot-table era)": "고전 (매듭표 시대)", "c. 1970s": "1970년대경", "ongoing (KnotInfo)": "진행 중 (KnotInfo)" };

  // [title, summary-or-statement, entry questions (open problems only)]
  const KO_NODE = {
    "alexander-poly": ["알렉산더 다항식", "최초의 다항식 매듭 불변량으로, 자이페르트 행렬이나 다이어그램에서 계산합니다. 많은 매듭을 구별하지만 Δ=1인 매듭은 모두 풀린 매듭처럼 보입니다."],
    "jones-poly": ["존스 다항식", "작용소 대수 연구에서 발견되었고 카우프만 괄호의 스케인 관계로 계산할 수 있습니다. 양자 위상수학의 출발점입니다."],
    "tait": ["테이트 추측", "기약 교대 다이어그램은 교차수가 최소이고, 꼬임수는 불변량이며, 두 기약 교대 다이어그램은 플라이프로 연결됩니다. 테이트 이후 약 100년 만에 존스 다항식으로 해결되었습니다."],
    "kontsevich": ["콘체비치 적분의 보편성", "유리수 계수의 모든 유한형(바실리예프) 불변량은 현 다이어그램 값을 갖는 콘체비치 적분을 거쳐 얻어집니다."],
    "khovanov": ["호바노프 호몰로지", "등급 오일러 지표가 존스 다항식인 이중 등급 호몰로지 이론으로, V(K)보다 엄밀히 강합니다."],
    "kh-unknot": ["호바노프 호몰로지는 풀린 매듭을 검출한다", "Kh(K)의 계수가 1인 매듭은 풀린 매듭뿐이며, 인스탄톤 플뢰어 호몰로지로 증명되었습니다. 존스 다항식 버전은 아직 미해결입니다."],
    "kh-trefoil": ["호바노프는 세잎매듭과 8자 매듭을 검출한다", "풀린 매듭 외에도 호바노프 호몰로지는 세잎매듭과 8자 매듭을 식별합니다."],
    "rasmussen": ["라스무센 s-불변량", "호바노프 호몰로지에서 얻는 콘코던스 불변량으로 슬라이스 종수의 하한을 주며, 밀노어 추측의 조합적 증명을 제공했습니다."],
    "hfk": ["매듭 플뢰어 호몰로지", "알렉산더 다항식의 범주화로, 자이페르트 종수를 정확히 검출합니다."],
    "hfk-fibered": ["HFK는 올뭉치 매듭을 검출한다", "매듭이 올뭉치일 필요충분조건은 매듭 플뢰어 호몰로지 최고 차수 군의 계수가 1인 것입니다."],
    "milnor": ["밀노어 추측 (원환면 매듭의 슬라이스 종수)", "T(p,q)의 4-공 종수는 (p−1)(q−1)/2입니다. 게이지 이론으로 처음 증명되었고, 이후 라스무센이 조합적으로 증명했습니다."],
    "freedman": ["Δ=1 매듭은 위상적으로 슬라이스이다", "위상적 4차원 수술에 의해 알렉산더 다항식이 1인 모든 매듭은 위상적으로 슬라이스이지만, 많은 경우 매끄럽게는 슬라이스가 아닙니다."],
    "conway": ["콘웨이 매듭은 슬라이스가 아니다", "같은 0-트레이스를 갖는 매듭과 라스무센 s-불변량으로 50년 된 질문을 해결했습니다."],
    "lisca": ["2-다리 매듭의 슬라이스–리본 추측", "2-다리 매듭에서는 도널드슨 정리에서 나오는 격자 매장을 이용해 슬라이스 ⇔ 리본이 성립합니다."],
    "ribbon-order": ["리본 콘코던스는 부분 순서이다", "고든의 1981년 추측으로, 매듭군의 표현 다양체를 이용해 증명되었습니다."],
    "hyperbolization": ["원환면 / 위성 / 쌍곡 삼분법", "모든 매듭은 원환면 매듭, 위성 매듭, 쌍곡 매듭 중 하나입니다. 모스토 강성에 의해 쌍곡 부피는 불변량입니다."],
    "gordon-luecke": ["매듭은 여공간으로 결정된다", "두 매듭의 여공간이 위상동형이면 두 매듭은 같습니다."],
    "property-r": ["성질 R", "비자명한 매듭의 0-수술은 결코 S¹×S²를 주지 않으며, 팽팽한 엽층으로 증명되었습니다."],
    "lens-realization": ["렌즈 공간 실현 문제", "S³ 매듭의 정수 수술로 어떤 렌즈 공간이 나오는지 정확히 결정했으며, 베르주의 목록과 일치합니다."],
    "hanselman": ["코스메틱 수술에 대한 강한 제약", "헤가드 플뢰어 호몰로지에 의해 코스메틱 쌍은 ±2 또는 ±1/q이어야 하고 종수 조건도 매우 엄격합니다."],
    "bfkp": ["코스메틱 교차: 종수 1 매듭", "종수 1 매듭에는 자명하지 않은 코스메틱 교차가 없음을 자이페르트 행렬로 보였습니다."],
    "unknot-additive-false": ["풀림수는 가법적이지 않다", "컴퓨터를 이용한 반례: 명시적인 매듭 쌍에서 u(K₁#K₂) < u(K₁)+u(K₂). 오래된 추측이 탐색과 SnapPy로 무너졌습니다."],
    "3move-false": ["몬테시노스–나카니시 3-이동 추측은 거짓이다", "모든 링크가 3-이동으로 자명한 링크가 되지는 않으며, 장애물은 번사이드 군에서 나옵니다."],
    "lackenby-crossing": [null, "정규 곡면을 이용한, 합성 매듭 교차수의 첫 선형 하한입니다."],
    "hlp": ["풀린 매듭 인식은 NP에 속한다", "짧은 증명서(정규 생성 원판)로 다이어그램이 풀린 매듭임을 보일 수 있습니다."],
    "lackenby-conp": ["풀린 매듭 인식은 co-NP에 속한다", "매듭이 꼬여 있다는 것도 짧은 증명서가 있습니다. 따라서 풀린 매듭 인식은 NP ∩ co-NP에 속합니다."],
    "volume-fig8": ["작은 경우의 부피 추측", "8자 매듭, (적절히 해석한) 원환면 매듭 등에서 확인되었지만 일반적으로는 미해결입니다."],
    "jones-24": ["존스 풀린 매듭 추측: 24교차까지 성립", "24교차까지 컴퓨터로 전수 검증되었습니다. 단, 존스 다항식이 자명한 비자명 링크는 존재합니다."],
    "hmv": ["특수 교대 매듭에 대한 폭스 추측", "로렌츠 다항식을 이용해 특수 교대 매듭의 알렉산더 계수가 사다리꼴(실은 로그 오목)임을 보였습니다."],

    "slice-ribbon": ["슬라이스–리본 추측", "S³의 모든 매끄러운 슬라이스 매듭은 리본 매듭이다. (리본 ⇒ 슬라이스는 쉽고, 그 역이 미해결입니다.)",
      ["리스카의 2-다리 매듭 격자 논법을 읽고, 작은 3-가닥 프레첼 매듭족에 적용해 보세요.", "KnotInfo에서 12교차 이하 슬라이스 매듭을 나열하고, 어떤 리본 원판이 명시적으로 알려져 있는지 확인하세요.", "리본 이동을 그리는 법을 익혀 6₁과 8₂₀이 리본임을 손으로 보이세요."]],
    "jones-unknot": ["존스 다항식은 풀린 매듭을 검출하는가?", "매듭 K가 V_K(t) = 1이면 K는 반드시 풀린 매듭인가?",
      ["8교차 이하 모든 매듭의 카우프만 괄호를 코드로 계산해 보세요.", "엘리아후–카우프만–시슬스웨이트의 링크 예를 공부하고, 왜 매듭에서는 그 구성이 통하지 않는지 알아보세요.", "구조가 있는 매듭족(3-땋임, 프레첼 등)에서 V=1인 매듭을 탐색해 보세요."]],
    "volume-conj": ["부피 추측", "쌍곡 매듭 K에 대해 lim (2π/N)·log|J_N(K; e^{2πi/N})| = Vol(S³∖K).",
      ["5₂ 매듭의 색 존스 값을 수치로 계산하고 수렴 속도를 관찰하세요.", "무라카미의 입문서를 읽고 8자 매듭의 경우를 단계별로 다시 유도하세요.", "복소화된 버전을 탐구하세요: 위상 항(천–사이먼스)이 수치적으로 어떻게 보이나요?"]],
    "berge": ["베르주 추측", "S³의 매듭 K에 대한 비자명한 수술이 렌즈 공간을 주면, K는 베르주(이중 원시) 매듭이다.",
      ["작은 베르주 매듭의 렌즈 공간 수술이 예측대로 나오는지 SnapPy로 확인하세요.", "L-공간 매듭이 왜 올뭉치이며 강한 준양성인지 이해하세요.", "그린 논문의 격자 부분을 독립된 조합론 문제로 읽어 보세요."]],
    "cosmetic-surgery": ["코스메틱 수술 추측", "비자명한 매듭에 대한 서로 다른 덴 수술은 방향을 보존하며 위상동형인 3차원 다양체를 주지 않는다.",
      ["핸슬먼 이후 남은 경우를 SnapPy와 쌍곡 부피로 센서스 매듭에서 확인하세요.", "알려진 장애물을 이용해 구체적인 매듭족(예: 트위스트 매듭)에서 추측을 증명하세요.", "16교차 이하에서 어떤 고전 불변량(캐슨, 부호수)이 코스메틱 쌍을 막는지 표로 정리하세요."]],
    "cosmetic-crossing": ["코스메틱 교차 추측", "매듭 다이어그램의 교차 하나를 바꿔도 매듭 유형이 바뀌지 않는다면, 그 교차는 무의미(nugatory)하다.",
      ["종수 1 자이페르트 행렬 논법을 특정 종수 2 매듭족으로 확장하세요.", "12교차 이하 다이어그램의 모든 교차를 바꿔 보며 코스메틱 변화를 찾는 프로그램을 작성하세요.", "올뭉치 매듭을 매듭 플뢰어 호몰로지로 다루는 방법을 읽어 보세요."]],
    "crossing-additivity": ["교차수는 가법적인가?", "모든 매듭에 대해 c(K₁ # K₂) = c(K₁) + c(K₂)인가?",
      ["제한된 매듭 부류에서 래켄비 하한의 상수 152를 개선하세요.", "새로운 부류(예: 원환면 매듭과 교대 매듭의 연결합)에서 가법성을 증명하세요.", "2025년 풀림수 반례 이후, 합성 다이어그램에서 교차수 버전의 반례를 탐색하세요."]],
    "unknot-p": ["풀린 매듭 인식은 P에 속하는가?", "매듭 다이어그램이 풀린 매듭인지 다항 시간에 판정하는 알고리즘이 있는가?",
      ["어려운 풀린 매듭 다이어그램에서 단순화 휴리스틱을 구현하고 성능을 비교하세요.", "하켄의 정규 곡면 알고리즘과 그 지수적 병목을 공부하세요.", "풀기 위해 라이데마이스터 이동이 많이 필요한 풀린 매듭 다이어그램족을 찾아보세요."]],
    "vassiliev-complete": ["바실리예프 불변량은 모든 매듭을 구별하는가?", "유한형 불변량은 모든 매듭을 구별하는가? (풀린 매듭이나 매듭의 방향은 검출하는가?)",
      ["가우스 다이어그램에서 낮은 차수의 바실리예프 불변량을 계산하세요(폴략–비로 공식).", "6차 이하 불변량이 10교차 이하 모든 매듭을 구별하는지 확인하세요.", "방향(가역성)이 유한형 불변량에게 왜 그렇게 어려운지 공부하세요."]],
    "concordance-torsion": ["매끄러운 콘코던스 군의 꼬임", "매끄러운 매듭 콘코던스 군에 위수 2가 아닌 유한 위수 원소(예: 위수 4)가 있는가?",
      ["대수적 콘코던스 군을 배우고 위수 4가 어디서 나오는지 확인하세요.", "대수적으로 위수 4인 후보 매듭들의 부호수, τ, s를 계산하세요.", "어떤 불변량이 위수 2 원소에서 0이 되는지, 그 이유를 정리하세요."]],
    "fox-trapezoidal": ["폭스의 사다리꼴 추측", "교대 매듭의 알렉산더 다항식 계수의 절댓값은 증가했다가 평평해진 뒤 감소한다.",
      ["16교차 이하 모든 교대 매듭에서 추측을 컴퓨터로 확인하세요.", "하프너–메사로시–비다스의 방법을 새로운 교대 매듭족 하나로 확장하세요.", "더 강한 로그 오목 버전을 시험하고 반례에 가까운 경우를 찾아보세요."]],
    "hoste": ["호스트 추측", "교대 매듭의 알렉산더 다항식의 모든 근 z는 Re(z) > −1을 만족한다.",
      ["14교차 이하 모든 교대 매듭의 알렉산더 다항식 근을 그려 보세요.", "2-모수 매듭족(예: 특정 모양의 2-다리 매듭)에서 이 부등식을 증명하세요.", "근이 Re(z) = −1에 가장 가까운 교대 매듭을 찾아보세요."]],
    "aj": ["AJ 추측", "색 존스 다항식이 만족하는 점화식에서 q = 1일 때 A-다항식이 복원된다.",
      ["트위스트 매듭의 A-다항식을 계산하고 색 존스 점화식과 비교하세요.", "컴퓨터 대수로 새로운 2-다리 매듭족에서 AJ 추측을 확인하세요.", "자일버거 알고리즘으로 q-홀로노믹 수열을 배우세요."]],
    "slope": ["기울기 추측", "존스 기울기(색 존스 다항식 최고 차수의 증가율)는 본질적 곡면의 경계 기울기이다.",
      ["프레첼 매듭의 색 존스 차수를 계산하고 경계 기울기와 맞춰 보세요.", "3-탱글 프레첼 매듭족에서 추측을 증명하세요.", "몬테시노스 매듭의 경계 기울기를 구하는 해처–오어텔 알고리즘을 배우세요."]],
    "gen-property-r": ["일반화된 성질 R", "n-성분 링크의 수술이 #ⁿ(S¹×S²)를 주면, 그 링크는 핸들 슬라이드로 자명한 링크와 동치인가?",
      ["가바이의 성질 R 증명 개요를 이해하세요.", "곰프–샬레만–톰프슨의 반례 후보를 공부하세요.", "구체적인 2-성분 링크에서 커비 미적분의 핸들 슬라이드를 익히세요."]],
    "four-move": ["나카니시의 4-이동 추측", "모든 매듭은 4-이동을 반복하여 풀린 매듭으로 만들 수 있다.",
      ["12교차 이하 매듭에서 4-이동 환원 가능성을 컴퓨터로 확인하세요.", "3-이동에서 쓰인 번사이드 군 장애물이 옮겨 올 수 있는지 공부하세요.", "새로운 매듭족(예: 특정 닫힌 3-땋임)에서 추측을 증명하세요."]],
    "unknown-unknotting": ["작은 매듭의 미확인 풀림수", "KnotInfo에서 풀림수가 아직 ‘미상’인 작은 교차수 매듭들의 u(K)를 결정하라.",
      ["KnotInfo에서 풀림수가 미상인 12교차 이하 매듭을 걸러내세요.", "매듭 하나를 골라 교차 변경을 컴퓨터로 탐색해 상한을 구하세요.", "하한(부호수, 라스무센 s, τ)을 모아 상한과 만나는지 확인하세요."]],
    "unknown-4genus": ["작은 매듭의 미확인 4-종수", "KnotInfo에서 아직 범위로만 표시된 작은 매듭의 매끄러운 4-공 종수를 결정하라.",
      ["매끄러운 4-종수가 미상인 12교차 이하 매듭을 나열하세요.", "종수를 줄이는 밴드 이동을 컴퓨터로 탐색하세요.", "s, τ, 부호수 하한을 계산해 상한과 비교하세요."]],
    "kh-detection": ["호바노프 호몰로지는 어떤 매듭을 검출하는가?", "호바노프 호몰로지로 유일하게 결정되는 매듭(과 링크)을 분류하라.",
      ["12교차 이하 매듭의 호바노프 호몰로지를 계산해 같은 호몰로지를 갖는 매듭들을 찾으세요.", "호바노프 호몰로지에서 인스탄톤 호몰로지로 가는 스펙트럼 열을 공부하세요.", "작은 원환면 매듭이나 특정 링크 하나에 대해 검출을 시도하세요."]],
  };
  NODES.forEach(n => {
    const k = KO_NODE[n.id]; if (!k) return;
    if (k[0]) n.title = k[0];
    if (n.type === "open") { n.statement = k[1]; if (k[2]) n.entry = k[2]; } else n.summary = k[1];
    if (n.yearNote && KO_NOTE[n.yearNote]) n.yearNote = KO_NOTE[n.yearNote];
  });
}

// static text in index.html
function applyStaticI18n() {
  document.querySelectorAll("[data-i18n]").forEach(e => e.textContent = t(e.dataset.i18n));
  document.querySelectorAll("[data-i18n-html]").forEach(e => e.innerHTML = t(e.dataset.i18nHtml));
  document.querySelectorAll("[data-i18n-ph]").forEach(e => e.placeholder = t(e.dataset.i18nPh));
  document.querySelectorAll("[data-i18n-aria]").forEach(e => e.setAttribute("aria-label", t(e.dataset.i18nAria)));
}
