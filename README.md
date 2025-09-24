#Smart Form Autofill — Kế hoạch dự án chi tiết

**Loại sản phẩm:** Edge/Chrome Extension (Manifest V3) hỗ trợ điền form đăng ký (Google Forms, HTML thường, form React/Vue) nhanh và chính xác bằng dữ liệu cá nhân đã lưu sẵn.

**Nguyên tắc cốt lõi (không thay đổi xuyên suốt dự án):**

- Extension **không tự bấm Submit**. Người dùng luôn là người bấm nút gửi form cuối cùng.
- Extension **không gửi request hàng loạt**, không polling liên tục, không bypass giới hạn slot/rate-limit của server.
- Chỉ thao tác trên DOM đã render trong tab hiện tại của người dùng — tương đương một người dùng gõ tay nhanh hơn, không phải bot tấn công server.
- Mọi thao tác điền phải đi qua **Policy Gate**: không bao giờ tự tick checkbox đồng ý/điều khoản và luôn bỏ qua field ẩn, không tìm cách vượt qua cơ chế ẩn/hiện của form.

---

## 1. Mục tiêu sản phẩm

|Tiêu chí|Mô tả|
|---|---|
|Tốc độ|Từ lúc form load xong đến lúc điền xong + verify: mục tiêu **< 1 giây** cho form 3-5 trường|
|Độ chính xác|Chỉ điền khi confidence ≥ ngưỡng (mặc định 80). Field không chắc → để trống, báo cho user|
|Độc lập thứ tự field|Matching dựa trên nội dung/label, không dựa vị trí DOM|
|Đa nền tảng form|Generic HTML, Google Forms (ưu tiên), mở rộng Microsoft Forms/React/Vue sau|
|An toàn|Không auto-submit, không spam request, áp dụng Policy Gate; dữ liệu cá nhân chỉ lưu local|

---

## 2. Kiến trúc tổng thể

```
smart-form-autofill/
├── manifest.json
├── src/
│   ├── popup/
│   │   ├── Popup.tsx / popup.html
│   │   ├── ProfileEditor.tsx
│   │   └── popup.ts (entry)
│   │
│   ├── content/
│   │   ├── index.ts                # entry point content script
│   │   ├── scanner.ts               # duyệt DOM, tìm câu hỏi/field
│   │   ├── normalizer.ts            # chuẩn hoá text VI/EN
│   │   ├── aliasDictionary.ts       # bảng alias theo FieldType
│   │   ├── matcher.ts               # sinh candidate + confidence scoring
│   │   ├── classifier.ts            # gộp signal -> quyết định field type
│   │   ├── filler.ts                # set value + dispatch event
│   │   ├── validator.ts             # verify giá trị đã vào DOM/state
│   │   ├── overlayUI.ts             # panel debug nổi trên trang (Shadow DOM)
│   │   └── adapters/
│   │       ├── IFormAdapter.ts
│   │       ├── genericHtmlAdapter.ts
│   │       └── googleFormsAdapter.ts
│   │
│   ├── background/
│   │   └── serviceWorker.ts         # điều phối storage, message passing
│   │
│   ├── shared/
│   │   ├── types.ts                 # FieldType, Profile, MatchResult...
│   │   ├── storage.ts               # wrapper chrome.storage.local
│   │   └── messages.ts              # type cho message giữa các layer
│   │
│   └── styles/
│       └── overlay.css
│
├── tests/
│   ├── normalizer.test.ts
│   ├── matcher.test.ts
│   └── fixtures/                    # HTML mẫu của các loại form
│
├── tsconfig.json
├── vite.config.ts (hoặc esbuild/webpack)
└── package.json
```

**Luồng dữ liệu:**

```
Popup (nhập/sửa Profile)
        │  chrome.storage.local
        ▼
Service Worker  ──message──►  Content Script (mỗi tab)
                                     │
                          SCAN → MATCH → FILL → VERIFY → READY
                                     │
                          Overlay UI hiển thị kết quả cho user
                                     │
                          user tự bấm nút Submit của form
```

---

## 3. Data model

```ts
// shared/types.ts

export type FieldType =
  | "FULL_NAME"
  | "ID_NUMBER"
  | "PHONE"
  | "EMAIL"
  | "DATE_OF_BIRTH"
  | "ADDRESS"
  | "UNKNOWN";

export interface Profile {
  fullName?: string;
  idNumber?: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string; // ISO yyyy-mm-dd, format lại theo field khi fill
  address?: string;
}

export interface FieldSignals {
  visibleQuestionText?: string;
  labelText?: string;
  ariaLabel?: string;
  ariaLabelledByText?: string;
  placeholder?: string;
  name?: string;
  id?: string;
  autocomplete?: string;
  surroundingText?: string;
  inputType?: string;
}

export interface DetectedField {
  elementRef: WeakRef<HTMLElement>; // input/textarea/contenteditable
  signals: FieldSignals;
  candidateType: FieldType;
  confidence: number; // 0-100
  status: "pending" | "filled" | "skipped" | "verify_failed";
}
```

Profile được lưu trong `chrome.storage.local` (không sync lên cloud của Google/Microsoft để tránh rò rỉ CCCD/SĐT qua tài khoản trình duyệt, trừ khi user chủ động bật sync và được cảnh báo).

---

## 4. Field Detection Engine

### 4.1 Thu thập signal (scanner.ts)

Với mỗi input/textarea/`[contenteditable]`/Google Forms question block:

1. Lấy `label[for]`, hoặc label cha gần nhất.
2. `aria-label`, `aria-labelledby` (resolve id sang text).
3. `placeholder`, `name`, `id`, `autocomplete`.
4. Với Google Forms: text trong `div[role="heading"]` hoặc span câu hỏi tương ứng (theo cấu trúc DOM của adapter riêng).
5. Text lân cận trong bán kính DOM gần (parent/sibling) làm tín hiệu phụ, trọng số thấp.

### 4.2 Normalize (normalizer.ts)

- Lowercase, trim, gộp khoảng trắng thừa.
- Bỏ dấu tiếng Việt (dùng bảng ánh xạ hoặc `normalize("NFD")` + strip diacritics) để so khớp cả 2 chiều: có dấu / không dấu.
- Bỏ ký tự đặc biệt, số thứ tự câu hỏi ("1.", "*", "(bắt buộc)").

### 4.3 Alias dictionary (aliasDictionary.ts)

Cấu trúc dạng map `FieldType -> Array<{ pattern: string; weight: number; matchType: "exact" | "contains" | "regex" }>`.

```ts
export const ALIAS_DICTIONARY: Record<FieldType, AliasEntry[]> = {
  FULL_NAME: [
    { pattern: "ho va ten", weight: 100, matchType: "exact" },
    { pattern: "ho ten", weight: 100, matchType: "exact" },
    { pattern: "full name", weight: 100, matchType: "exact" },
    { pattern: "name", weight: 60, matchType: "exact" },       // yếu, dễ nhầm "tên công ty"
  ],
  PHONE: [
    { pattern: "so dien thoai", weight: 100, matchType: "exact" },
    { pattern: "dien thoai", weight: 90, matchType: "contains" },
    { pattern: "sdt", weight: 100, matchType: "exact" },
    { pattern: "phone", weight: 90, matchType: "contains" },
    { pattern: "mobile", weight: 85, matchType: "contains" },
  ],
  ID_NUMBER: [
    { pattern: "cccd", weight: 100, matchType: "exact" },
    { pattern: "can cuoc cong dan", weight: 100, matchType: "contains" },
    { pattern: "cmnd", weight: 95, matchType: "exact" },
    { pattern: "id number", weight: 90, matchType: "contains" },
    { pattern: "citizen id", weight: 90, matchType: "contains" },
  ],
  EMAIL: [
    { pattern: "email", weight: 100, matchType: "contains" },
    { pattern: "e-mail", weight: 100, matchType: "contains" },
  ],
  DATE_OF_BIRTH: [
    { pattern: "ngay sinh", weight: 100, matchType: "contains" },
    { pattern: "date of birth", weight: 100, matchType: "contains" },
    { pattern: "dob", weight: 90, matchType: "exact" },
  ],
  ADDRESS: [
    { pattern: "dia chi", weight: 100, matchType: "contains" },
    { pattern: "address", weight: 90, matchType: "contains" },
  ],
  UNKNOWN: [],
};
```

**Negative patterns** (chặn nhầm) — kiểm tra trước khi cộng điểm dương:

```ts
export const NEGATIVE_PATTERNS: Record<FieldType, string[]> = {
  FULL_NAME: ["ten cong ty", "ten dang nhap", "ten nguoi nhan", "company name", "username"],
  // ... áp dụng tương tự cho các field khác nếu cần
};
```

### 4.4 Confidence scoring (matcher.ts)

Công thức gộp nhiều signal, mỗi signal có trọng số riêng vì độ tin cậy khác nhau:

```ts
const SIGNAL_WEIGHTS = {
  autocomplete: 1.0,      // metadata HTML chuẩn -> tin cậy cao nhất
  visibleQuestionText: 0.9,
  labelText: 0.9,
  ariaLabel: 0.8,
  placeholder: 0.6,
  name: 0.5,
  id: 0.4,
  surroundingText: 0.3,
};

function scoreField(signals: FieldSignals): { type: FieldType; confidence: number } {
  const scoresByType: Record<FieldType, number> = initZero();

  for (const [signalKey, rawText] of Object.entries(signals)) {
    if (!rawText) continue;
    const normalized = normalize(rawText);

    // autocomplete xử lý riêng vì map trực tiếp, không cần alias dictionary
    if (signalKey === "autocomplete") {
      const mapped = mapAutocompleteToFieldType(normalized); // "tel" -> PHONE, "email" -> EMAIL...
      if (mapped) scoresByType[mapped] += 100 * SIGNAL_WEIGHTS.autocomplete;
      continue;
    }

    for (const type of ALL_FIELD_TYPES) {
      if (hasNegativeMatch(type, normalized)) continue; // chặn cứng
      const best = bestAliasMatch(type, normalized);     // trả weight cao nhất khớp được
      if (best) scoresByType[type] += best * (SIGNAL_WEIGHTS as any)[signalKey];
    }
  }

  const [bestType, bestScore] = argmax(scoresByType);
  return { type: bestScore > 0 ? bestType : "UNKNOWN", confidence: Math.min(100, bestScore) };
}
```

Ngưỡng mặc định: **confidence ≥ 80 → auto-fill**, **60–79 → fill nhưng đánh dấu "cần kiểm tra lại"** (viền vàng), **< 60 → bỏ qua, để user tự nhập**.

---

## 5. Adapter pattern

```ts
// content/adapters/IFormAdapter.ts
export interface IFormAdapter {
  isApplicable(): boolean;
  findQuestions(): QuestionBlock[];
  getQuestionText(q: QuestionBlock): FieldSignals;
  findInput(q: QuestionBlock): HTMLElement | null;
  setValue(input: HTMLElement, value: string): void;
  verifyValue(input: HTMLElement, expected: string): boolean;
}
```

### 5.1 GenericHtmlAdapter

- `findQuestions()` chỉ xét control đang hiển thị; loại trừ `hidden`, submit và phần tử không thao tác được. Checkbox/radio được nhận diện để Policy Gate quyết định: checkbox đồng ý/điều khoản luôn skip, còn control lựa chọn được hỗ trợ phải có policy riêng.
- Text câu hỏi lấy từ `<label for>` hoặc label cha gần nhất.
- `setValue` dùng native setter (chi tiết mục 6).

### 5.2 GoogleFormsAdapter

Google Forms render field bằng React nội bộ của Google, DOM không map 1-1 với `<label>` chuẩn. Cần:

Baseline DOM survey và fixture đã được lưu tại
[`docs/google-forms-dom.md`](docs/google-forms-dom.md) và
[`tests/fixtures/google-form-sample.html`](tests/fixtures/google-form-sample.html).
Adapter phải dùng selector theo ARIA trong tài liệu này, không dùng class CSS
do Google sinh ra.

- `findQuestions()`: duyệt các block `div[role="listitem"]`.
- `getQuestionText()`: lấy text tiêu đề trong block (heading span), mô tả phụ nếu có.
- `findInput()`: tuỳ loại câu hỏi — text ngắn (`input[type=text]`), đoạn văn (`textarea`), hoặc radio/dropdown (không autofill tự do, chỉ hỗ trợ text field trong bản đầu).
- `setValue()`: **bắt buộc dùng native value setter + dispatch `input`/`change` bằng `InputEvent`** để React state của Google Forms nhận diện, không chỉ set `.value` suông.

```ts
// content/filler.ts
function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}
```

- `verifyValue()`: đọc lại `element.value` sau một tick (hoặc `requestAnimationFrame`) để chắc chắn React không revert giá trị.

### 5.3 Mở rộng sau: MicrosoftFormsAdapter, GenericReactAdapter (React/Vue nói chung) dùng cùng kỹ thuật native setter + event, chỉ khác cách tìm question block.

---

## 6. Policy Gate và workflow SCAN → MATCH → FILL → VERIFY → READY

**Policy Gate là bước chặn bắt buộc trước khi filler can thiệp vào bất kỳ phần tử nào.** Mục tiêu là chỉ hỗ trợ nhập dữ liệu cá nhân vào trường văn bản đang hiển thị, còn các quyết định, xác nhận và luồng điều kiện vẫn thuộc về người dùng và form.

- **Không auto-submit:** extension không click, không trigger và không gọi bất kỳ cơ chế gửi form nào. Người dùng tự kiểm tra rồi bấm nút gửi gốc.
- **Không spam request:** extension chỉ đọc/ghi DOM cục bộ; không polling network, không gửi request hàng loạt, không retry để tranh slot hay vượt rate-limit.
- **Không tự đồng ý thay người dùng:** luôn skip checkbox/switch và các control mang ý nghĩa đồng ý điều khoản, chính sách, xác nhận, marketing hoặc cam kết — kể cả khi có nhãn/giá trị có thể suy đoán được. Radio Giới tính chỉ được điền khi policy của control lựa chọn cho phép và có option khớp chính xác.
- **Không vượt qua field ẩn:** luôn skip input có `type="hidden"`, phần tử bị `hidden`, `aria-hidden="true"`, `display: none`, `visibility: hidden`, hoặc không còn hiển thị/thao tác được. Extension không đổi CSS, không mở conditional question, không bỏ thuộc tính ẩn và không ghi giá trị vào các field đó.
- Nếu không xác định chắc chắn field có an toàn để điền hay không, Policy Gate trả về `skip`; overlay phải nêu lý do để người dùng tự xử lý.

```
SCAN → MATCH → POLICY GATE → FILL → VERIFY → READY
                         │
                         └── skip + ghi lý do vào overlay
```

```
1. SCAN     : adapter.findQuestions() → DetectedField[]
2. MATCH    : với mỗi field, gom signal → matcher.scoreField() → gán candidateType + confidence
3. POLICY GATE: chỉ cho phép control hiển thị và an toàn; checkbox đồng ý/điều khoản, control xác nhận không thuộc profile và field ẩn → skip
4. FILL     : nếu Policy Gate cho phép, confidence ≥ 80 và profile có giá trị tương ứng → filler.setNativeValue()
5. VERIFY   : đọc lại giá trị, so khớp chuẩn hoá (trim, format phone/date) → cập nhật status
6. READY    : cập nhật overlay UI, liệt kê field đã điền / bỏ qua / cần xem lại
7. (User)   : tự rà lại overlay, tự bấm nút Submit gốc của form — extension không đụng vào nút này
```

**Về tự động hoá "submit":** extension chủ động KHÔNG có tính năng click nút submit, kể cả optional. Nút "SUBMIT" trong UI (nếu có) chỉ nên hiểu là **"tôi đã xem xong, đóng overlay"**, không phải hành động gửi form. Nút gửi thật sự luôn là nút gốc trên trang, do người dùng tự bấm — điều này vừa đúng yêu cầu của bạn, vừa tránh rủi ro vi phạm điều khoản dịch vụ của các trang tổ chức đăng ký.

---

## 7. UI/UX

### 7.1 Popup (quản lý Profile)

- Form nhập 6 trường: Họ tên, CCCD, SĐT, Email, Ngày sinh, Địa chỉ.
- Nút "Lưu Profile" → ghi vào `chrome.storage.local`.
- Toggle "Bật overlay tự động khi mở form" on/off theo domain.

### 7.2 Overlay trên trang (content script, render trong Shadow DOM để tránh vỡ CSS trang gốc)

```
┌───────────────────────────────┐
│ Smart Autofill            [x] │
├───────────────────────────────┤
│ ✓ Họ và tên      matched 99%  │
│ ✓ CCCD           matched 100% │
│ ✓ Số điện thoại  matched 100% │
│ ○ Email          not found    │
│ ○ Ngày sinh      not found    │
├───────────────────────────────┤
│ [ SCAN LẠI ]   [ ĐIỀN LẠI ]   │
│ Hãy tự kiểm tra và bấm Submit │
│ gốc của form khi đã sẵn sàng. │
└───────────────────────────────┘
```

- Click vào 1 dòng field → highlight input tương ứng trên trang (scroll-into-view + outline màu).
- Có nút "sửa nhanh" cho field bị gán sai type, để user re-map thủ công (feedback này có thể dùng để cải thiện threshold sau).

---

## 8. Manifest V3 — quyền tối thiểu cần thiết

```json
{
  "manifest_version": 3,
  "name": "Smart Form Autofill",
  "version": "0.1.0",
  "permissions": ["storage"],
  "host_permissions": ["https://docs.google.com/forms/*"],
  "optional_host_permissions": [
    "https://*.ticketbox.vn/*",
    "https://*.cticket.vn/*",
    "https://forms.office.com/*",
    "https://forms.cloud.microsoft/*"
  ],
  "action": {
    "default_popup": "popup.html"
  },
  "background": {
    "service_worker": "background/serviceWorker.js"
  },
  "content_scripts": [
    {
      "matches": [
        "https://docs.google.com/forms/*",
        "https://*.ticketbox.vn/*",
        "https://*.cticket.vn/*",
        "https://forms.office.com/*",
        "https://forms.cloud.microsoft/*"
      ],
      "js": ["content/index.js"],
      "run_at": "document_idle"
    }
  ]
}
```

Lưu ý:

- Ban đầu chỉ khai báo `host_permissions` cho domain bạn thực sự cần (Google Forms, các domain webform bán vé cụ thể). Việc xin `<all_urls>` ngay từ đầu vừa không cần thiết vừa dễ bị Chrome Web Store review chậm hơn.
- Với các webform khác (ticketbox, cticket...), nên dùng `optional_host_permissions` + `chrome.permissions.request()` để user chủ động cấp quyền theo từng trang, thay vì xin toàn bộ ngay lúc cài đặt.
- Popup chỉ hiển thị nút **Cấp quyền** khi tab hiện tại nằm trên Ticketbox, CTicket hoặc Microsoft Forms. Sau khi người dùng chấp thuận, extension chạy ngay trên tab đó; các lần tải trang sau sẽ tự nhận quyền đã cấp.

---

## 9. Hiệu năng

- **Initial scan**: chạy 1 lần tại `document_idle`.
- **MutationObserver**: theo dõi container chính của form (không theo dõi toàn bộ `document.body`) để bắt các câu hỏi Google Forms render động (ví dụ khi form nhiều trang / conditional questions). Debounce 150–250ms trước khi re-scan.
- **Cache**: lưu map `elementRef -> DetectedField` trong session của content script, tránh chấm điểm lại field không đổi.
- **Không polling network**: toàn bộ hoạt động là DOM-only, không có request nào được extension chủ động gửi ra ngoài — vì vậy không có rủi ro "spam server" ở tầng network.

---

## 10. Testing

### HTML manual fixtures

Serve the repository root before manually testing the extension. This avoids
the extra `file://` permissions required by MV3 content scripts:

```bash
npm run build:dev
npm run serve:fixtures
```

Then open [the fixture directory](http://localhost:4173/tests/fixtures/html/).
The server binds only to `127.0.0.1` and uses port `4173`. Each fixture belongs
in `tests/fixtures/html/`, next to its matching `expected.json` file. Load the
`dist/` folder as the unpacked extension after `build:dev`; it adds
`http://localhost:*/*` only to the development build's content-script matches.
The normal `npm run build` manifest remains publish-safe and excludes it.

|Loại test|Công cụ|Nội dung|
|---|---|---|
|Unit|Vitest/Jest|normalizer (bỏ dấu, chuẩn hoá), matcher (alias + confidence), negative pattern, Policy Gate (checkbox đồng ý/điều khoản và field ẩn luôn bị skip)|
|Fixture-based|Vitest + jsdom|Load HTML mẫu của Form A/B/C trong context.md → assert field được match đúng type|
|Integration thủ công|Trình duyệt thật|Chạy checklist T7.3 trên các form thật; kiểm tra verify không bị framework của form revert giá trị|
|Regression|Snapshot alias dictionary|Đảm bảo thêm alias mới không phá vỡ case cũ (ví dụ "Name" vẫn ở ngưỡng thấp, không đẩy false positive)|

---

### T7.3 — Checklist test trên form thật

Không dùng tiêu chí mơ hồ như "test 5 form bất kỳ". Mỗi lần QA release phải ghi lại URL/domain (hoặc mã nội bộ của form), trình duyệt, thời điểm test, ảnh overlay trước khi người dùng submit, và kết quả của đủ 7 tình huống dưới đây. Chỉ dùng form do đội kiểm soát hoặc form có quyền thử nghiệm; không submit dữ liệu cá nhân thật.

|#|Tình huống bắt buộc|Thao tác và tiêu chí đạt|
|---|---|---|
|1|Cascading **Tỉnh → Xã**|Chọn profile/mapping có giá trị khớp. Extension chọn Tỉnh trước, chờ Xã được nạp và chỉ chọn Xã khi option xuất hiện; không gửi request riêng. Nếu quá timeout, dừng ở Xã, báo `cascade_timeout` trên overlay và không thử chọn cưỡng bức.|
|2|DOB dạng **3 select** Ngày/Tháng/Năm|Dùng ngày sinh profile hợp lệ. Cả ba ô nhận đúng giá trị sau verify; không coi ba select độc lập là cascading và không để ô nào trống/sai thứ tự.|
|3|DOB dạng **text tự do**|Test ít nhất một định dạng mà form chấp nhận (ví dụ `DD/MM/YYYY`). Giá trị sau verify đúng định dạng của field; nếu không xác định được định dạng hoặc verify thất bại, field bị báo để người dùng tự nhập, không tự submit.|
|4|Radio **Giới tính**|Với giá trị profile có option khớp, chỉ một radio đúng được chọn và verify thành công. Với option không khớp, không radio nào bị chọn; overlay báo cần xử lý thủ công.|
|5|Cặp **Email / Xác nhận Email**|Cùng email profile được điền vào cả hai field và giữ nguyên sau verify. Chỉ cặp nhận diện rõ là xác nhận email mới được phép điền lặp; field trùng loại khác vẫn phải được đánh dấu `duplicate_manual`.|
|6|Checkbox **điều khoản**|Chạy autofill khi checkbox chưa được tick. Checkbox phải vẫn chưa tick, có trạng thái `policy_blocked`/skip trên overlay; người dùng tự quyết định tick hay không. Đây là kiểm tra bắt buộc của Policy Gate.|
|7|Đăng ký nhóm, nhiều người có field trùng loại|Với ít nhất hai người có cùng loại field (ví dụ Họ tên hoặc SĐT), chỉ field đầu tiên được điền tự động. Các field trùng còn lại không được sao chép dữ liệu profile và được đánh dấu `duplicate_manual` để người dùng nhập từng người.|

**Điều kiện hoàn thành T7.3:** cả 7 hàng đều pass trên form thật; mọi lỗi, timeout hoặc sai match phải có ảnh/chụp DOM tối thiểu và được mở regression test hoặc ghi rõ lý do loại trừ trước khi đóng QA.

---

## 11. Lộ trình triển khai (đề xuất theo giai đoạn)

**Giai đoạn 1 — Core engine (không phụ thuộc UI)**

- `types.ts`, `storage.ts`
- `normalizer.ts`, `aliasDictionary.ts`, `matcher.ts` + unit test đầy đủ
- Xác định ngưỡng confidence bằng cách chạy thử trên tập fixture Form A/B/C

**Giai đoạn 2 — Generic HTML adapter + Filler + Validator**

- `genericHtmlAdapter.ts`
- `filler.ts` (native setter + dispatch event)
- `validator.ts`
- Test trên 1 form HTML thường tự tạo

**Giai đoạn 3 — Google Forms adapter**

- Khảo sát cấu trúc DOM Google Forms hiện tại (có thể thay đổi theo thời gian, cần fallback selector)
- `googleFormsAdapter.ts`
- Xử lý riêng phần verify vì React của Google Forms có thể re-render

**Giai đoạn 4 — UI**

- Popup Profile editor
- Overlay debug UI (Shadow DOM) hiển thị kết quả match/fill

**Giai đoạn 5 — Performance & polish**

- MutationObserver + debounce
- Cache field mapping
- Xử lý form nhiều bước/trang (multi-page Google Forms)

**Giai đoạn 6 — Mở rộng adapter (tuỳ nhu cầu)**

- Microsoft Forms
- Generic React/Vue form khác ngoài Google

**Giai đoạn 7 — QA & đóng gói**

- T7.1: Hoàn thiện README và Policy Gate.
- T7.2: Rà soát manifest, chỉ giữ quyền thực sự được dùng.
- T7.3: Thực hiện đầy đủ checklist test form thật ở mục 10; lưu bằng chứng kết quả trước khi phát hành.

---

## 12. Rủi ro & giới hạn cần lưu ý

- **DOM Google Forms thay đổi theo thời gian** → adapter cần fallback nhiều selector, và nên có cơ chế "graceful degrade": nếu không tìm được câu hỏi theo cấu trúc mong đợi, overlay báo "không nhận diện được form này" thay vì fill sai.
- **Radio/checkbox/dropdown** phức tạp hơn text field nhiều (matching theo option text), nên để ngoài phạm vi bản đầu, chỉ tập trung text/số điện thoại/email/ngày sinh dạng input text.
- **Vẫn có giới hạn vật lý**: nếu server chỉ nhận 50 response trong 11 giây vì hạ tầng của họ, thì việc điền nhanh hơn giúp bạn tăng cơ hội chứ không đảm bảo tuyệt đối — nghẽn có thể nằm ở tầng network/server, không chỉ tầng client. Nên cân nhắc thêm: kết nối mạng ổn định, tránh mở nhiều tab nặng cùng lúc, chuẩn bị sẵn tab từ trước giờ mở form.

---

Nếu bạn muốn, bước tiếp theo mình có thể bắt đầu code thật theo đúng Giai đoạn 1 (core engine: types, normalizer, alias dictionary, matcher) kèm unit test chạy được ngay, dựa trên 3 case Form A/B/C trong tài liệu gốc của bạn.
