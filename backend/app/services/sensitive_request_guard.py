"""
索取敏感資料、要求協助攻擊的規則檢查（送進模型前，和違禁詞、提示詞注入同一段）

為什麼要這一關：
  個資遮罩只認得「格式」（身分證字號、手機號碼本身），違禁詞只認得企業列管的字詞，
  語意比對的範例多是「大量」資料（全體薪資、整份客戶名單）。
  「我要王曉明的身分證」這種「指名索取某個人的個資」三關都比對不到，就會直接送進模型。
  這一關用固定規則認「意圖」，不靠嵌入模型、也不靠本機模型，模型沒載入時照樣有效。

三類（命中就攔阻，不送模型，寫一筆資安事件）：
  personal    指名索取他人的個資：身分證、護照、居留證、健保卡、駕照、銀行帳號、信用卡、電話、住址、
              生日、薪資、病歷、前科、考績、車牌、生物特徵、宗教／性傾向等特種個資、別人的對話紀錄
              ＝「某個人（姓名、稱謂、他／她、同事、客戶…）的」＋「個資種類」＋「要取得」
              也擋反查：「這個身分證字號是誰的」
  credential  索取帳號密碼、金鑰、驗證碼：某個人的，或系統的（資料庫、伺服器、管理員、VPN…）
  attack      要求協助攻擊：寫惡意程式、教怎麼入侵／竊取／繞過權限、寫釣魚信、繞過資安閘道

不誤擋的：
  - 沒有指名對象：「身分證遺失怎麼補辦」「密碼要多久更換一次」
  - 自己的：「我的身分證字號格式對嗎」「如何重設我自己的登入密碼」
  - 單位、地點的公開資訊：「公司的地址」「高雄分公司的電話」
  - 辦理流程（沒有要取得內容）：「王曉明的身分證掉了要怎麼補辦」
  - 防禦面：「如何辨識釣魚郵件」「中了勒索病毒怎麼辦」「入侵偵測系統是什麼」

這是規則，換句話說還是可能繞過；後面的語意比對、模型複查是第二層網子。
新的攻擊說法請加進下面的字詞表，並在 tests/test_sensitive_request_guard.py 補一句測試。
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Optional

from app.services.text_normalize import fold, squeeze

PERSONAL = "personal"
CREDENTIAL = "credential"
ATTACK = "attack"

MESSAGES = {
    PERSONAL: "這個問題是在索取他人的個人資料（例如身分證、護照、帳號、電話、住址），依個資保護規定不能提供，請求已攔阻，未送入 AI 模型。",
    CREDENTIAL: "這個問題是在索取帳號密碼、金鑰或驗證碼等登入憑證，請求已攔阻，未送入 AI 模型。如需權限請洽系統管理員。",
    ATTACK: "這個問題是在要求協助入侵、竊取資料、繞過資安防護或製作惡意程式，請求已攔阻，未送入 AI 模型。",
}


@dataclass(frozen=True)
class SensitiveHit:
    category: str    # personal／credential／attack
    kind: str        # 命中的種類（寫進稽核，不含使用者原文）
    message: str     # 給使用者看的拒絕說明


# ── 個資、憑證的種類 ──────────────────────────────────────────────────────
# (種類名稱, 樣式)。中文附簡體寫法；英文不分大小寫
_PERSONAL_KINDS: list[tuple[str, str]] = [
    ("身分證字號", r"身[分份][證证](?:字[號号]|[號号]碼|[號号]码|[號号]|統一編號)?|國民身分證|居留[證证](?:[號号]碼|[號号])?|統一證號"
                  r"|\bid\s*(?:card\s*)?(?:number|no\.?)|national\s+id|identity\s+(?:card|number)|social\s+security(?:\s+number)?|\bssn\b"),
    ("護照號碼", r"護照(?:[號号]碼|[號号])?|护照(?:号码|号)?|passport(?:\s+(?:number|no\.?))?"),
    ("健保卡號", r"健保卡(?:卡?[號号]碼?)?|health\s+insurance\s+(?:card|number)"),
    ("駕照號碼", r"駕照(?:[號号]碼|[號号])?|驾照|driver'?s?\s+licen[cs]e(?:\s+number)?"),
    ("車牌號碼", r"車牌(?:[號号]碼|[號号])?|车牌|licen[cs]e\s+plate"),
    ("銀行帳號", r"(?:銀行|存款|匯款|薪轉|银行)?帳[號戶户]|[账賬][号户號戶]|存摺|bank\s+account(?:\s+number)?|account\s+number|\biban\b|routing\s+number"),
    ("信用卡號", r"信用卡(?:[號号]碼|卡號|[號号])?|卡[號号]|安全碼|credit\s+card(?:\s+number)?|card\s+number|\bcvv\b"),
    ("電話號碼", r"(?:聯絡|联络|行動|私人|家裡|家用)?(?:電話|电话|手機|手机)(?:[號号]碼|号码)?|聯絡方式|联系方式"
                r"|phone(?:\s+number)?|mobile(?:\s+number)|cell\s*(?:phone)?(?:\s+number)?|contact\s+(?:info|information|details)"),
    ("住址", r"住址|地址|住家|戶籍|户籍|住在?哪(?:裡|里|邊)?|家住|home\s+address|\baddress\b|where\s+(?:does\s+)?\w+\s+lives?"),
    ("生日", r"生日|出生(?:日期|年月日)|birthday|date\s+of\s+birth|\bdob\b"),
    ("薪資", r"薪水|薪資|薪资|月薪|年薪|時薪|底薪|獎金|奖金|年終|年终|收入|salary|wages?|paycheck|payslip|bonus|income"),
    ("病歷", r"病歷|病历|病史|病情|健康狀況|健康状况|診斷|诊断|體檢|健檢|就醫紀錄|就醫記錄|medical\s+(?:record|history|condition)s?|health\s+(?:record|condition|status)s?|diagnosis"),
    ("前科", r"前科|犯罪(?:紀錄|記錄|记录)|刑案(?:紀錄|記錄)|良民證|criminal\s+record"),
    ("人事資料", r"考績|績效(?:評[等分比]|考核)|懲處|懲戒|離職原因|請假原因|病假原因|performance\s+review"),
    ("生物特徵", r"指紋|指纹|臉部(?:特徵|資料)|虹膜|生物特徵|fingerprint|biometric"),
    ("特種個資", r"性傾向|性取向|宗教信仰|政治傾向|政治立場|婚姻狀況|sexual\s+orientation|religio(?:n|us\s+belief)"),
    ("對話紀錄", r"(?:對話|聊天|提問|問答)(?:紀錄|記錄|記錄|内容|內容)|问了什么|問了什麼|(?:郵件|信件|email)內容|chat\s+history|conversation\s+history"),
]
_CREDENTIAL_KINDS: list[tuple[str, str]] = [
    ("帳號密碼", r"帳號密碼|帳密|账号密码|密碼|密码|口令|pin\s*(?:碼|code)|password|passcode|credentials?"),
    ("金鑰", r"金鑰|私鑰|秘鑰|密鑰|密钥|私钥|憑證檔|token|api\s*key|secret\s*key|access\s*key|private\s*key|ssh\s*key"),
    ("驗證碼", r"驗證碼|验证码|一次性密碼|\botp\b|2fa\s*code"),
]
# 單位、組織（不是個人）的電話、地址、統編屬公開資訊
_STRONG_PERSONAL = {"身分證字號", "護照號碼", "健保卡號", "駕照號碼", "銀行帳號", "信用卡號", "薪資", "病歷", "前科",
                    "人事資料", "生物特徵", "特種個資"}

# 憑證先比：「帳號密碼」「手機收到的驗證碼」要算憑證，不是銀行帳號、電話
_KIND_RES = [(CREDENTIAL, k, re.compile(p, re.IGNORECASE)) for k, p in _CREDENTIAL_KINDS] + \
            [(PERSONAL, k, re.compile(p, re.IGNORECASE)) for k, p in _PERSONAL_KINDS]

# ── 「是誰的」：指名對象 ─────────────────────────────────────────────────
_SURNAMES_2 = "歐陽|司馬|諸葛|上官|張簡|范姜|欧阳|司马"
_SURNAMES_1 = (
    "陳林黃張李王吳劉蔡楊許鄭謝洪郭邱曾廖賴徐周葉蘇莊呂江何蕭羅高潘簡朱鍾游彭詹胡施沈余盧梁趙顏柯翁魏孫戴范方宋鄧杜"
    "傅侯曹薛丁卓阮馬董温溫唐藍石蔣古紀姚連馮歐程湯黎田康姜汪白鄒尤巫鐘涂龔嚴韓袁金童陸夏柳邵錢伍倪于譚駱熊任甘秦顧毛章史萬俞雷"
    "陈黄张刘杨许郑谢叶苏庄吕钟罗萧赵颜孙邓冯汤邹龚严韩钱谭骆顾"
)
_NAME_RE = re.compile(rf"(?:{_SURNAMES_2}|[{_SURNAMES_1}])[一-鿿]{{1,2}}$")
_NICKNAME_RE = re.compile(r"[小阿][一-鿿]{1,2}$")
# 看起來像姓名、其實是一般詞（姓氏開頭的常用詞）
_NOT_NAMES = (
    "高鐵", "高雄", "高層", "高階", "方法", "方式", "方面", "方案", "石油", "金額", "金融", "白天", "程式", "程序", "連結", "連線",
    "任何", "任務", "萬元", "史上", "夏天", "章節", "官網", "官方", "田野", "古代", "馬上", "江湖", "唐朝", "毛利", "甘特",
    "何時", "何處", "周末", "周年", "周邊", "溫度", "温度", "陸續", "雷射", "童年", "黃金", "藍牙", "白板", "朱紅", "余額",
    "張表", "張圖", "張卡", "金鑰", "高速", "江南", "林口", "康健", "許可", "許多", "曾經", "柯南", "胡亂", "范例", "李子",
)
# 單位、地點：後面接的電話、地址是公開資訊
_ORG_SUFFIX = re.compile(
    r"(?:公司|集團|企業|公所|政府|機關|單位|部門|[部處課組]|中心|大樓|門市|分店|店|銀行|醫院|診所|學校|大學|[局署館廠]|辦公室|總部|分行"
    r"|網站|官網|客服|總機|櫃台|櫃檯|飯店|餐廳|[區市縣鄉鎮里路街站]|會議室|倉庫|工廠|機房)$"
)
_PLACES = re.compile(
    r"(?:台北|臺北|新北|桃園|台中|臺中|台南|臺南|高雄|基隆|新竹|苗栗|彰化|南投|雲林|嘉義|屏東|宜蘭|花蓮|台東|臺東|澎湖|金門|馬祖"
    r"|林口|板橋|中壢|永和|中和|三重|新莊|信義|大安|士林|北投|內湖|南港|松山|萬華|文山)$"
)
_SELF_EXACT = re.compile(r"(?:本人|自己|我自己|咱們|我們|我们|我)$")
_PERSON_NOUNS = re.compile(
    r"(?:員工|职员|職員|同事|同仁|主管|老闆|老板|經理|经理|主任|老師|老师|先生|小姐|女士|太太|客戶|客户|顧客|会员|會員|用戶|用户|使用者"
    r"|病患|病人|學生|学生|家長|應徵者|求職者|鄰居|邻居|朋友|男友|女友|前任|老公|老婆|爸爸|媽媽|爸|媽|董事長|總經理|执行长|執行長|總裁"
    r"|副總|協理|課長|組長|處長|科長|部長|廠長|店長|同學|醫師|醫生|律師|會計師|工程師|秘書|藝人|明星|網紅|立委|議員|市長|總統"
    r"|他們|她們|他们|她们|對方|对方|他|她|TA|ta|人)$"
)
_SYSTEM_NOUNS = re.compile(
    r"(?:資料庫|数据库|數據庫|伺服器|服务器|主機|系統|系统|管理員|管理者|管理员|admin|administrator|root|後台|後臺|vpn|網域|雲端|aws|gcp|azure"
    r"|server|database|db|超級使用者|公司|ERP|CRM|防火牆|郵件伺服器|AD|LDAP|wifi管理|帳號)$",
    re.IGNORECASE,
)
# 名字和個資之間常見的修飾詞（「王曉明的完整身分證字號」「王曉明家裡的地址」）


def _words(*words: str) -> str:
    """字詞清單 → 正規表示式的「其中一個」（清單比一長串 | 好讀、好增補）"""
    return "|".join(words)


_MODIFIERS = re.compile("(?:" + _words(
    "有沒有", "有没有", "有無", "是否有", "是否", "有", "的", "之", "那張", "那支", "那個", "這張", "這支",
    "完整", "詳細", "目前", "現在", "最新", "真實", "真正", "正確", "全部", "所有", "私人", "個人",
    "家裡", "家裏", "老家", "住家", "聯絡", "上面", "上的", "身上", "手上",
) + ")$")
_BULK = re.compile(r"(?:所有|全部|全體|全体|每一?[個位个]|整份|完整|一整批|everyone|every|all)")

# ── 要「取得」的意圖 ─────────────────────────────────────────────────────
_VALUE_REQUEST = re.compile(
    r"給我|给我|告訴我|告诉我|跟我說|說出|是多少|多少|幾號|几号|是什麼(?!意思)|是什么(?!意思)|列出|查出|查詢|查询|查一下|查|找出|找到|找一下|搜"
    r"|拿到|取得|撈|洩漏|泄漏|透露|公布|猜|推測|算出|寫出|號碼是|字號是|唸|念出|報給"
    r"|what\s+is|what's|whats|give|tell|list|find|look\s*up|lookup|retrieve|reveal|share|send|export|dump|guess|search",
    re.IGNORECASE,
)
_ACQUIRE_EXTRA = re.compile(
    r"我要|想要|我需要|需要|想知道|要知道|提供|調出|调出|匯出|导出|整理|彙整|拿|看一下|看看|顯示|生成|產生|編一個|輸出|印出"
    r"|\bget\b|\bneed\b|\bwant\b|provide|print|output|display|generate|\bknow\b|[?？]",
    re.IGNORECASE,
)
# 辦理流程、保護方法：沒有要取得內容
_BENIGN = re.compile(
    r"遺失|弄丟|掉了|不見|補辦|換發|申請|掛失|格式|規則|規定|驗證|檢查碼|怎麼(?:辦|補|申請|換|改|更改|變更|設定|重設|保護|保管|填|寫|處理)"
    r"|如何(?:補|申請|換|改|更改|變更|設定|重設|保護|保管|填|處理)|要帶|需要帶|流程|法規|個資法|保護|遮罩|加密|外洩了|被盜|被冒用|意思|定義"
    r"|打不通|過期|到期|更新|\blost\b|stolen|renew|replace|format|validat|protect|reset|change\s+(?:my|the)|mean",
    re.IGNORECASE,
)
_REVERSE_LOOKUP = re.compile(r"是誰的|是谁的|屬於誰|属于谁|是哪位的|持有人是誰|主人是誰|\bwhose\b|belongs?\s+to\s+(?:who|whom)", re.IGNORECASE)

# 英文：John's passport number／the SSN of John Smith
_EN_SELF = {"my", "me", "mine", "myself", "our", "us", "i"}
_EN_SKIP = {"it", "this", "that", "the", "a", "an", "what", "let", "there", "here", "who", "one", "its", "your"}
_EN_ORG = re.compile(r"\b(?:company|office|store|shop|bank|hospital|school|firm|department|branch|website|restaurant|hotel|headquarters|hq|government|city)\b", re.IGNORECASE)
_EN_SYSTEM = re.compile(r"\b(?:admin|administrator|root|server|database|db|system|vpn|domain|aws|azure|gcp|router|firewall|backend|prod|production)\b", re.IGNORECASE)
_EN_PERSON = re.compile(
    r"\b(?:his|her|their|him|them|someone|somebody|employee|employees|staff|customer|customers|client|clients|user|users|colleague|colleagues"
    r"|coworker|coworkers|boss|manager|ceo|cfo|patient|student|neighbor|everyone|everybody|people|person|mr|mrs|ms|dr)\b",
    re.IGNORECASE,
)

_EN_WORD = r"[a-z][\w\-]*"
_EN_POSSESSIVE_BEFORE = re.compile(rf"({_EN_WORD}(?:\s+{_EN_WORD}){{0,2}})['’]s?\s+(?:[a-z]+\s+){{0,3}}$", re.IGNORECASE)
_EN_PRONOUN_BEFORE = re.compile(r"\b(his|her|their|my|our)\s+(?:[a-z]+\s+){0,3}$", re.IGNORECASE)
_EN_OF_AFTER = re.compile(
    rf"\s*(?:number\s+|no\.?\s+)?(?:of|for|belonging\s+to)\s+(?:the\s+|all\s+|every\s+)?({_EN_WORD}(?:\s+{_EN_WORD}){{0,2}})",
    re.IGNORECASE,
)
_EN_ADJACENT_BEFORE = re.compile(rf"\b({_EN_WORD})\s+$", re.IGNORECASE)

# ── 要求協助攻擊 ─────────────────────────────────────────────────────────
_MALWARE = re.compile(
    r"勒索(?:病毒|軟體|程式|软件)|木馬|木马|後門|后门|鍵盤側錄|側錄程式|惡意(?:程式|軟體|腳本|巨集)|恶意(?:程序|软件)|病毒程式|蠕蟲|殭屍網路"
    r"|釣魚(?:信|郵件|網站|網頁|簡訊|頁面)|钓鱼(?:邮件|网站)"
    r"|rootkit|keylogger|ransomware|malware|trojan|backdoor|botnet|reverse\s+shell|web\s*shell|phishing\s+(?:email|e-mail|page|site|kit|message)",
    re.IGNORECASE,
)
_BUILD = re.compile(_words(
    "寫", "写", "撰寫", "做", "製作", "制作", "產生", "产生", "生成", "開發", "开发", "設計", "给我", "給我", "提供", "弄一",
    "write", "create", "make", "build", "generate", "code", "develop", "craft", "draft",
), re.IGNORECASE)
_INTRUSION = re.compile(
    r"入侵|駭進|駭入|黑進|攻進|攻破|滲透進|提權|權限提升|竊取|窃取|偷(?:取|看|走|拿)|盜(?:取|用|刷)|盗(?:取|用)|側錄|監聽|撞庫|暴力破解"
    r"|破解(?:密碼|帳號|wifi|wi-fi|系統|加密|授權|序號)|ddos|阻斷服務攻擊|sql\s*(?:注入|injection)|xss|拿到(?:別人|他人)的(?:帳號|權限)"
    r"|繞過(?:權限|登入|驗證|認證|防火牆|防毒|監控|稽核|資安|dlp|閘道|檢查|審核|過濾)|跳過(?:權限|登入|驗證|認證|稽核|資安|dlp|閘道)"
    r"|(?:權限|登入|驗證|認證|防火牆|稽核|dlp|資安閘道|資安檢查|過濾)\S{0,6}(?:繞過|跳過|破解|關掉|關閉|停用)"
    r"|(?:不會被|不被|避免被|躲過|逃過)\S{0,6}(?:資安|閘道|dlp|稽核|過濾|偵測|攔|擋)"
    r"|hack\s+(?:into|someone|a\b|the\b)|break\s+into|privilege\s+escalation|bypass\s+(?:authentication|auth|login|the\s+firewall|firewall|antivirus|security|dlp|the\s+filter|filters?|audit)"
    r"|\bsteal\b|exfiltrat\w*|brute[\s-]?force|credential\s+stuffing|crack\s+(?:the\s+)?(?:password|wifi|account)",
    re.IGNORECASE,
)
_HOW = re.compile(_words(
    "怎麼", "怎么", "如何", "教我", "教學", "步驟", "方法", "幫我", "帮我", "給我", "告訴我", "可以", "能不能",
    r"how\s+(?:do|can|to|would)", "steps", "teach", r"help\s+me", r"show\s+me", r"ways?\s+to", "tutorial",
), re.IGNORECASE)
_DEFENSIVE = re.compile(
    r"防範|防范|防止|防禦|防护|防護|預防|预防|避免(?!被)|辨識|辨别|識別|识别|偵測|侦测|檢測|检测|察覺|發現|应变|應變|通報|中了|中毒|被(?:駭|入侵|攻擊|勒索|竊取|盜|偷|釣)"
    r"|保護|教育訓練|宣導|意識|案例|新聞|是什麼|什麼是|原理|定義|差別|區別|有哪些(?:類型|種類)|怎麼辦|處理"
    r"|defend|prevent|protect|detect|identify|recogni[sz]e|spot|avoid|mitigate|respond|awareness|training|what\s+is|explain|signs\s+of",
    re.IGNORECASE,
)

# 規避本系統的資安閘道（「怎麼繞過資安閘道」「怎麼問才不會被資安閘道擋」）
_GATE_WORDS = _words("資安閘道", "資安檢查", "dlp", "稽核紀錄", "稽核", "過濾")
_EVADE_VERBS = _words("繞過", "跳過", "關掉", "關閉", "停用", "躲過", "不會被", "才不會")
_EVADE_GATE = re.compile(
    rf"(?:{_GATE_WORDS})\S{{0,8}}(?:{_EVADE_VERBS})|(?:{_words('繞過', '跳過', '躲過', '避開')})\S{{0,6}}(?:{_GATE_WORDS})",
    re.IGNORECASE,
)

_CJK_SPACE = re.compile(r"(?<=[一-鿿])\s+(?=[一-鿿])")
_PUNCT_SPLIT = re.compile(r"[，。！？、；：,.!?;:\n「」『』（）()\[\]【】]")
_FILLERS = re.compile(r"please|number|no\.|[\s的之字號碼码請麻煩一下拜託謝謝\-:：，。！？?!、]", re.IGNORECASE)


def _normalize(text: str) -> str:
    """全形、零寬字元、拆字還原；中文字之間的空格拿掉（「王 曉 明 的 身 分 證」）"""
    folded, index = fold(unicodedata.normalize("NFKC", text or ""))
    squeezed, _ = squeeze(folded, index)
    return _CJK_SPACE.sub("", squeezed)


def _strip_modifiers(seg: str) -> str:
    """拿掉名字和個資之間的修飾詞（最多剝四層：「王曉明家裡的完整」→「王曉明」）"""
    for _ in range(4):
        stripped = _MODIFIERS.sub("", seg).strip()
        if stripped == seg:
            break
        seg = stripped
    return seg


def _ends_with_name(seg: str) -> bool:
    """結尾像人名（姓氏＋一兩個字、小明、阿華）"""
    name = _NAME_RE.search(seg) or _NICKNAME_RE.search(seg)
    if not name:
        return False
    word = name.group(0)
    prev = seg[: name.start()][-1:]
    # 「這張表」「每位」這種量詞開頭的不是名字；姓氏開頭的常用詞也不是
    if prev and prev in "這那每一哪幾兩三半整这":
        return False
    return not any(word.startswith(w) or word.endswith(w) for w in _NOT_NAMES)


def _owner_zh(before: str) -> str:
    """個資字詞前面那一段，判斷是誰的：self／person／system／org／none"""
    seg = _strip_modifiers(_PUNCT_SPLIT.split(before)[-1].strip()[-16:])
    if not seg:
        return "none"
    if _PLACES.search(seg) or _ORG_SUFFIX.search(seg):
        return "org"
    if seg.endswith(("本人", "自己")):
        return "self"
    if seg.endswith(("其他", "個人")):
        return "none"
    if _PERSON_NOUNS.search(seg) or _ends_with_name(seg):
        return "person"
    if _SELF_EXACT.search(seg):
        return "self"
    if _SYSTEM_NOUNS.search(seg):
        return "system"
    return "none"


def _owner_en(text: str, start: int, end: int) -> str:
    """英文：個資字詞前的所有格（John's、his），或後面的 of／for 某人"""
    before = text[max(0, start - 60):start]
    after = text[end:end + 60]
    # 依序看三個線索；只看最靠近個資字詞的那個字（「Give me John Smith's」看 Smith，不是 me）
    clues = (
        (_EN_PRONOUN_BEFORE.search(before), 0),
        (_EN_POSSESSIVE_BEFORE.search(before), -1),
        (_EN_OF_AFTER.match(after), 0),
    )
    for found, key_index in clues:
        if found:
            owner = found.group(1).strip()
            kind = _classify_en_owner(owner, owner.split()[key_index].lower())
            if kind:
                return kind
    # 只看緊鄰的一個字：admin password、employee salary
    adjacent = _EN_ADJACENT_BEFORE.search(before)
    if adjacent and _EN_SYSTEM.search(adjacent.group(1)):
        return "system"
    if adjacent and _EN_PERSON.search(adjacent.group(1)):
        return "person"
    return "none"


def _classify_en_owner(owner: str, key_word: str) -> Optional[str]:
    """英文的擁有者 → person／self／org／system；看不出來（the、this…）回 None 換下一個線索"""
    if _EN_PERSON.search(owner):
        return "person"
    if key_word in _EN_SELF:
        return "self"
    if _EN_ORG.search(owner):
        return "org"
    if _EN_SYSTEM.search(owner):
        return "system"
    if key_word in _EN_SKIP:
        return None
    return "person"


def _remainder_is_short(text: str, start: int, end: int) -> bool:
    """整句幾乎只有「某人的某個資」（「王曉明的身分證」「John's SSN?」）：本身就是在要"""
    seg_before = _PUNCT_SPLIT.split(text[:start])[-1]
    rest = seg_before[-12:] + text[end:]
    rest = _FILLERS.sub("", rest)
    name = _NAME_RE.search(seg_before.rstrip("的之 "))
    if name:
        rest = rest.replace(name.group(0), "", 1)
    return len(rest) <= 4


def _owner_of(text: str, m: re.Match, category: str) -> str:
    """這個個資字詞是誰的"""
    owner = "none"
    if re.match(r"[a-z]", m.group(0), re.IGNORECASE):
        owner = _owner_en(text, m.start(), m.end())
    if owner == "none":
        owner = _owner_zh(text[: m.start()])
    if owner == "none" and category == PERSONAL and _BULK.search(text[max(0, m.start() - 12): m.start()]):
        owner = "person"  # 「列出所有的電話號碼」：大量索取
    return owner


def _owner_is_sensitive(owner: str, category: str, kind: str) -> bool:
    """這個擁有者的這種資料算不算敏感：個人的都算；單位的只有強個資（身分證、病歷…）；系統的只有憑證"""
    if owner == "person":
        return True
    if owner == "org":
        return category == PERSONAL and kind in _STRONG_PERSONAL and kind != "銀行帳號"
    if owner == "system":
        return category == CREDENTIAL
    return False  # self、none


def _check_data_request(text: str) -> Optional[SensitiveHit]:
    benign_only = bool(_BENIGN.search(text)) and not _VALUE_REQUEST.search(text)
    wants = bool(_VALUE_REQUEST.search(text) or _ACQUIRE_EXTRA.search(text))
    for category, kind, regex in _KIND_RES:
        for m in regex.finditer(text):
            # 反查：「A123456789 這個身分證是誰的」
            if category == PERSONAL and _REVERSE_LOOKUP.search(text):
                return SensitiveHit(category, kind, MESSAGES[category])
            if benign_only or not _owner_is_sensitive(_owner_of(text, m, category), category, kind):
                continue
            if wants or _remainder_is_short(text, m.start(), m.end()):
                return SensitiveHit(category, kind, MESSAGES[category])
    return None


def _check_attack(text: str) -> Optional[SensitiveHit]:
    malware = _MALWARE.search(text)
    if malware and _BUILD.search(text):
        # 「寫一封釣魚郵件」：要做出來，就算說是教育訓練也一樣擋（範本請找資安部門）
        if not re.search(r"辨識|識別|identify|recogni[sz]e|spot|signs\s+of|防範|prevent", text, re.IGNORECASE) or re.search(
            r"寫|写|撰寫|製作|產生|生成|開發|write|create|build|generate|code|develop", text, re.IGNORECASE
        ):
            return SensitiveHit(ATTACK, "惡意程式／釣魚", MESSAGES[ATTACK])
    intrusion = _INTRUSION.search(text)
    if intrusion and _HOW.search(text) and not _DEFENSIVE.search(text):
        return SensitiveHit(ATTACK, "入侵／竊取／繞過防護", MESSAGES[ATTACK])
    # 規避本系統的資安閘道：防禦詞也不能當掩護
    if _EVADE_GATE.search(text):
        return SensitiveHit(ATTACK, "規避資安閘道", MESSAGES[ATTACK])
    return None


def check_sensitive_request(text: str) -> Optional[SensitiveHit]:
    """命中回 SensitiveHit（要攔阻）；沒命中回 None"""
    if not text or not text.strip():
        return None
    normalized = _normalize(text)
    return _check_data_request(normalized) or _check_attack(normalized)


__all__ = ["check_sensitive_request", "SensitiveHit", "PERSONAL", "CREDENTIAL", "ATTACK", "MESSAGES"]
